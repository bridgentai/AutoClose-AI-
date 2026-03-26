import express from 'express';
import { protect, AuthRequest } from '../middleware/auth.js';
import { requireStudentAccess } from '../middleware/studentAccessGuard.js';
import { findUserById, updateUser } from '../repositories/userRepository.js';
import { findGroupSubjectsByGroup, findGroupSubjectsByGroupWithDetails, findGroupSubjectById } from '../repositories/groupSubjectRepository.js';
import { findSubjectById } from '../repositories/subjectRepository.js';
import { findGuardianStudent } from '../repositories/guardianStudentRepository.js';
import { getFirstGroupNameForStudent, getAllCourseGroupsForStudent, findEnrollmentsByGroup, getFirstGroupForStudent } from '../repositories/enrollmentRepository.js';
import { findGroupById, findGroupByNameAndInstitution } from '../repositories/groupRepository.js';
import { findGradesByUserAndGroup } from '../repositories/gradeRepository.js';
import { buildMateriasNotasForStudent } from '../services/studentNotesBuilder.js';
import { findUsersByInstitutionAndRoles, findUserById as findUserPgById } from '../repositories/userRepository.js';
import { notify } from '../repositories/notificationRepository.js';
import {
  createDisciplinaryAction,
  listDisciplinaryActionsByStudent,
  type DisciplinarySeverity,
} from '../repositories/disciplinaryActionRepository.js';
import {
  addAnnouncementRecipients,
  createAnnouncement,
  createAnnouncementMessage,
  findDirectThreadBetweenUsers,
} from '../repositories/announcementRepository.js';
import { emitEvoMessageBroadcast } from '../socket.js';

const router = express.Router();

const DISCIPLINE_ALLOWED_ROLES = ['profesor', 'directivo'] as const;
/** Quién puede listar amonestaciones (alineado con requireStudentAccess + negocio). */
const DISCIPLINE_VIEW_ROLES = [
  'profesor',
  'directivo',
  'estudiante',
  'padre',
  'admin-general-colegio',
  'school_admin',
  'administrador-general',
  'super_admin',
  'asistente',
] as const;
const isValidSeverity = (s: unknown): s is DisciplinarySeverity =>
  s === 'leve' || s === 'grave' || s === 'suma gravedad';

// GET /api/student/subjects
router.get('/subjects', protect, async (req: AuthRequest, res) => {
  try {
    const estudianteId = req.user?.id;
    const colegioId = req.user?.colegioId;
    if (!estudianteId) return res.status(401).json({ message: 'No autorizado.' });
    const user = await findUserById(estudianteId);
    if (!user) return res.status(404).json({ message: 'Estudiante no encontrado.' });
    if (user.role !== 'estudiante') return res.status(403).json({ message: 'Solo estudiantes pueden acceder a este recurso.' });
    const courseGroups = await getAllCourseGroupsForStudent(estudianteId, colegioId ?? undefined);
    if (!courseGroups.length) return res.json({ subjects: [], total: 0, grupoId: null });
    const gradoNombre = await getFirstGroupNameForStudent(estudianteId);
    const allGsList = await Promise.all(
      courseGroups.map((g) => findGroupSubjectsByGroupWithDetails(g.id, colegioId ?? undefined))
    );
    const subjects = allGsList.flat().map((gs) => ({
      _id: gs.id,
      nombre: [gs.subject_name, gs.group_name].filter(Boolean).join(' ').trim() || gs.subject_name || '',
      descripcion: gs.subject_description ?? '',
      profesores: [{ _id: gs.teacher_id, nombre: gs.teacher_name, email: gs.teacher_email }],
      colorAcento: '',
      icono: '',
    }));
    res.json({ subjects, total: subjects.length, grupoId: gradoNombre });
  } catch (error: unknown) {
    console.error('Error al obtener materias del estudiante:', (error as Error).message);
    res.status(500).json({ message: 'Error interno del servidor.' });
  }
});

// GET /api/student/:estudianteId/disciplinary-actions (profesor/directivo)
router.get(
  '/:estudianteId/disciplinary-actions',
  protect,
  requireStudentAccess('estudianteId', 'all_teachers'),
  async (req: AuthRequest, res) => {
  try {
    const { estudianteId } = req.params;
    const requesterId = req.user?.id;
    const institutionId = req.user?.colegioId;
    if (!requesterId || !institutionId) return res.status(401).json({ message: 'No autorizado.' });

    const requester = await findUserPgById(requesterId);
    if (
      !requester ||
      !DISCIPLINE_VIEW_ROLES.includes(requester.role as (typeof DISCIPLINE_VIEW_ROLES)[number])
    ) {
      return res.status(403).json({ message: 'No autorizado.' });
    }

    const estudiante = await findUserPgById(estudianteId);
    if (!estudiante || estudiante.role !== 'estudiante' || estudiante.institution_id !== institutionId) {
      return res.status(404).json({ message: 'Estudiante no encontrado.' });
    }

    const rows = await listDisciplinaryActionsByStudent(institutionId, estudianteId, 100);
    const creatorIds = Array.from(new Set(rows.map((r) => r.created_by_id)));
    const creators = creatorIds.length ? await Promise.all(creatorIds.map((id) => findUserPgById(id))) : [];
    const creatorMap = new Map(creators.filter(Boolean).map((u) => [u!.id, u!]));

    return res.json(
      rows.map((r) => {
        const creator = creatorMap.get(r.created_by_id);
        return {
          _id: r.id,
          gravedad: r.severity,
          razon: r.reason,
          fecha: r.created_at,
          registradoPor: creator?.full_name ?? '',
        };
      })
    );
  } catch (e: unknown) {
    console.error('Error al listar amonestaciones:', (e as Error).message);
    return res.status(500).json({ message: 'Error al listar amonestaciones.' });
  }
});

// POST /api/student/:estudianteId/disciplinary-actions (profesor)
router.post('/:estudianteId/disciplinary-actions', protect, async (req: AuthRequest, res) => {
  try {
    const { estudianteId } = req.params;
    const requesterId = req.user?.id;
    const institutionId = req.user?.colegioId;
    if (!requesterId || !institutionId) return res.status(401).json({ message: 'No autorizado.' });

    const requester = await findUserPgById(requesterId);
    if (!requester || requester.role !== 'profesor') {
      return res.status(403).json({ message: 'Solo profesores pueden registrar amonestaciones.' });
    }

    const estudiante = await findUserPgById(estudianteId);
    if (!estudiante || estudiante.role !== 'estudiante' || estudiante.institution_id !== institutionId) {
      return res.status(404).json({ message: 'Estudiante no encontrado.' });
    }

    const severityRaw = (req.body?.gravedad ?? req.body?.severity) as unknown;
    const reasonRaw = (req.body?.razon ?? req.body?.reason) as unknown;
    if (!isValidSeverity(severityRaw)) return res.status(400).json({ message: 'Gravedad inválida.' });
    const reason = typeof reasonRaw === 'string' ? reasonRaw.trim() : '';
    if (!reason) return res.status(400).json({ message: 'La razón es obligatoria.' });

    const created = await createDisciplinaryAction({
      institution_id: institutionId,
      student_id: estudianteId,
      created_by_id: requesterId,
      severity: severityRaw,
      reason,
    });

    // Notificar a directivos via Evo Send (hilo directo profesor <-> directivo) + notificación
    const directivos = await findUsersByInstitutionAndRoles(institutionId, ['directivo']);
    const grupoNombre = (await getFirstGroupNameForStudent(estudianteId)) ?? undefined;
    const group = await getFirstGroupForStudent(estudianteId, institutionId);
    const title = `Amonestación · ${estudiante.full_name}${grupoNombre ? ` (${grupoNombre})` : ''}`;
    const content =
      `Se registró una amonestación.\n\n` +
      `Estudiante: ${estudiante.full_name}${grupoNombre ? ` · Grupo: ${grupoNombre}` : ''}\n` +
      `Gravedad: ${severityRaw}\n` +
      `Razón: ${reason}\n\n` +
      `Registrado por: ${requester.full_name}`;

    for (const d of directivos) {
      let thread = await findDirectThreadBetweenUsers(d.id, requesterId, institutionId);
      if (!thread) {
        // Fallback (por si no existe aún): crear hilo directo
        thread = await createAnnouncement({
          institution_id: institutionId,
          title: requester.full_name,
          body: null,
          type: 'evo_chat_direct',
          group_id: null,
          group_subject_id: null,
          created_by_id: d.id,
        });
        await addAnnouncementRecipients(thread.id, [d.id, requesterId]);
      }

      const msg = await createAnnouncementMessage({
        announcement_id: thread.id,
        sender_id: requesterId,
        sender_role: requester.role,
        content: `${title}\n\n${content}`,
        priority: severityRaw === 'grave' || severityRaw === 'suma gravedad' ? 'alta' : 'normal',
      });

      emitEvoMessageBroadcast(
        thread.id,
        {
          _id: msg.id,
          contenido: msg.content,
          prioridad: msg.priority,
          fecha: msg.created_at,
          remitenteId: { _id: requesterId, nombre: requester.full_name, rol: requester.role },
          rolRemitente: requester.role,
        },
        [d.id, requesterId]
      );

      await notify({
        institution_id: institutionId,
        user_id: d.id,
        user_email: d.email,
        type: 'amonestacion',
        entity_type: 'student',
        entity_id: estudianteId,
        action_url: group?.id ? `/directivo/cursos/${group.id}/estudiantes/${estudianteId}/notas` : '/dashboard',
        title,
        body: content,
      });
    }

    return res.status(201).json({
      _id: created.id,
      gravedad: created.severity,
      razon: created.reason,
      fecha: created.created_at,
      registradoPor: requester.full_name,
    });
  } catch (e: unknown) {
    console.error('Error al crear amonestación:', (e as Error).message);
    return res.status(500).json({ message: 'Error al registrar la amonestación.' });
  }
});

// GET /api/student/profile
router.get('/profile', protect, async (req: AuthRequest, res) => {
  try {
    const estudianteId = req.user?.id;
    if (!estudianteId) return res.status(401).json({ message: 'No autorizado.' });
    const user = await findUserById(estudianteId);
    if (!user) return res.status(404).json({ message: 'Estudiante no encontrado.' });
    const grupoId = await getFirstGroupNameForStudent(estudianteId) ?? undefined;
    res.json({
      _id: user.id,
      nombre: user.full_name,
      email: user.email,
      grupoId: grupoId ?? null,
      rol: user.role,
      colegioId: user.institution_id,
      telefono: user.phone,
      celular: user.phone,
      direccion: null,
      barrio: null,
      ciudad: null,
      fechaNacimiento: user.date_of_birth,
    });
  } catch (error: unknown) {
    console.error('Error al obtener perfil del estudiante:', (error as Error).message);
    res.status(500).json({ message: 'Error interno del servidor.' });
  }
});

// PUT /api/student/profile
router.put('/profile', protect, async (req: AuthRequest, res) => {
  try {
    const estudianteId = req.user?.id;
    if (!estudianteId) return res.status(401).json({ message: 'No autorizado.' });
    const { telefono, celular, direccion, barrio, ciudad, fechaNacimiento } = req.body;
    const user = await findUserById(estudianteId);
    if (!user) return res.status(404).json({ message: 'Estudiante no encontrado.' });
    await updateUser(estudianteId, {
      phone: telefono ?? celular ?? user.phone,
      date_of_birth: fechaNacimiento ?? user.date_of_birth ?? null,
    });
    const updated = await findUserById(estudianteId);
    res.json({
      message: 'Información personal actualizada correctamente.',
      estudiante: {
        _id: updated?.id,
        nombre: updated?.full_name,
        email: updated?.email,
        telefono: updated?.phone,
        celular: updated?.phone,
        direccion: null,
        barrio: null,
        ciudad: null,
        fechaNacimiento: updated?.date_of_birth,
      },
    });
  } catch (error: unknown) {
    console.error('Error al actualizar información personal:', (error as Error).message);
    res.status(500).json({ message: 'Error interno del servidor.' });
  }
});

// GET /api/student/notes - Notas del estudiante autenticado (debe ir antes de /:estudianteId)
router.get('/notes', protect, async (req: AuthRequest, res) => {
  try {
    const estudianteId = req.user?.id;
    if (!estudianteId) return res.status(401).json({ message: 'No autorizado.' });
    const user = await findUserById(estudianteId);
    if (!user || user.role !== 'estudiante') return res.status(404).json({ message: 'Estudiante no encontrado.' });
    const { materias, total } = await buildMateriasNotasForStudent(estudianteId, user.institution_id);
    res.json({ materias, total });
  } catch (error: unknown) {
    console.error('Error al obtener notas:', (error as Error).message);
    res.status(500).json({ message: 'Error interno del servidor.' });
  }
});

// GET /api/student/ranking — puesto en el salón por promedio general del grado
router.get('/ranking', protect, async (req: AuthRequest, res) => {
  try {
    const estudianteId = req.user?.id;
    const colegioId = req.user?.colegioId;
    if (!estudianteId) return res.status(401).json({ message: 'No autorizado.' });
    const user = await findUserById(estudianteId);
    if (!user || user.role !== 'estudiante') return res.status(404).json({ message: 'Estudiante no encontrado.' });
    const institutionId = colegioId ?? user.institution_id;
    if (!institutionId) return res.status(400).json({ message: 'Institución no definida.' });

    const grado = await getFirstGroupNameForStudent(estudianteId);
    if (!grado) {
      return res.json({ puesto: 0, total: 0, promedio: 0, grado: null });
    }
    const gradeGroup = await findGroupByNameAndInstitution(institutionId, grado);
    if (!gradeGroup) {
      return res.json({ puesto: 0, total: 0, promedio: 0, grado });
    }
    const enrollments = await findEnrollmentsByGroup(gradeGroup.id);
    const studentIds = enrollments.map((e) => e.student_id);

    type StudentAverage = { studentId: string; promedio: number };
    const averages: StudentAverage[] = [];

    for (const sid of studentIds) {
      const courseGroups = await getAllCourseGroupsForStudent(sid, institutionId);
      const allGrades = (
        await Promise.all(courseGroups.map((g) => findGradesByUserAndGroup(sid, g.id)))
      ).flat();
      const scores = allGrades.map((g) => Number(g.score)).filter((s) => s != null && !Number.isNaN(s));
      if (scores.length === 0) continue;
      const promedio = scores.reduce((a, b) => a + b, 0) / scores.length;
      averages.push({ studentId: sid, promedio: Math.round(promedio * 100) / 100 });
    }

    averages.sort((a, b) => b.promedio - a.promedio);
    const total = averages.length;

    if (total < 2) {
      const current = averages.find((a) => a.studentId === estudianteId);
      return res.json({
        puesto: 0,
        total,
        promedio: current?.promedio ?? 0,
        grado,
      });
    }

    const position = averages.findIndex((a) => a.studentId === estudianteId);
    const puesto = position >= 0 ? position + 1 : 0;
    const currentRow = averages.find((a) => a.studentId === estudianteId);

    res.json({
      puesto,
      total,
      promedio: currentRow?.promedio ?? 0,
      grado,
    });
  } catch (error: unknown) {
    console.error('Error al obtener ranking:', (error as Error).message);
    res.status(500).json({ message: 'Error interno del servidor.' });
  }
});

// GET /api/student/:estudianteId/personal-info (profesor/directivo)
router.get('/:estudianteId/personal-info', protect, async (req: AuthRequest, res) => {
  try {
    const { estudianteId } = req.params;
    const userId = req.user?.id;
    const colegioId = req.user?.colegioId;
    if (!userId || !colegioId) return res.status(401).json({ message: 'No autorizado.' });
    const currentUser = await findUserById(userId);
    if (!currentUser || (currentUser.role !== 'profesor' && currentUser.role !== 'directivo')) {
      return res.status(403).json({ message: 'Solo profesores y directivos pueden acceder a esta información.' });
    }
    const estudiante = await findUserById(estudianteId);
    if (!estudiante) return res.status(404).json({ message: 'Estudiante no encontrado.' });
    if (estudiante.role !== 'estudiante' || estudiante.institution_id !== colegioId) {
      return res.status(403).json({ message: 'No tienes permiso para acceder a esta información.' });
    }
    const cursoFromEnrollment = await getFirstGroupNameForStudent(estudianteId);
    res.json({
      _id: estudiante.id,
      nombre: estudiante.full_name,
      email: estudiante.email,
      curso: cursoFromEnrollment ?? undefined,
      colegioId: estudiante.institution_id,
      telefono: estudiante.phone,
      celular: estudiante.phone,
      direccion: null,
      barrio: null,
      ciudad: null,
      fechaNacimiento: estudiante.date_of_birth,
    });
  } catch (error: unknown) {
    console.error('Error al obtener información personal del estudiante:', (error as Error).message);
    res.status(500).json({ message: 'Error interno del servidor.' });
  }
});

// GET /api/student/hijo/:estudianteId/profile
router.get('/hijo/:estudianteId/profile', protect, async (req: AuthRequest, res) => {
  try {
    const { estudianteId: paramId } = req.params;
    const userId = req.user?.id;
    const rol = req.user?.rol;
    const estudiante = await findUserById(paramId);
    if (!estudiante || estudiante.role !== 'estudiante') return res.status(404).json({ message: 'Estudiante no encontrado.' });
    let allowed = rol === 'directivo' || rol === 'admin-general-colegio';
    if (!allowed && rol === 'padre') allowed = !!(await findGuardianStudent(userId!, paramId));
    if (!allowed) return res.status(403).json({ message: 'No autorizado a ver el perfil de este estudiante.' });
    const grupoIdFromEnrollment = await getFirstGroupNameForStudent(paramId);
    res.json({
      _id: estudiante.id,
      nombre: estudiante.full_name,
      email: estudiante.email,
      grupoId: grupoIdFromEnrollment ?? undefined,
      curso: grupoIdFromEnrollment ?? undefined,
      rol: estudiante.role,
      colegioId: estudiante.institution_id,
      telefono: estudiante.phone,
      celular: estudiante.phone,
      direccion: null,
      barrio: null,
      ciudad: null,
      fechaNacimiento: estudiante.date_of_birth,
      userId: (estudiante.config as { userId?: string })?.userId,
      codigoUnico: estudiante.internal_code,
    });
  } catch (error: unknown) {
    console.error('Error al obtener perfil del hijo:', (error as Error).message);
    res.status(500).json({ message: 'Error interno del servidor.' });
  }
});

// GET /api/student/hijo/:estudianteId/courses - Todas las materias del hijo (para padre)
router.get('/hijo/:estudianteId/courses', protect, async (req: AuthRequest, res) => {
  try {
    const { estudianteId: paramId } = req.params;
    const userId = req.user?.id;
    const rol = req.user?.rol;
    const estudiante = await findUserById(paramId);
    if (!estudiante || estudiante.role !== 'estudiante') return res.status(404).json({ message: 'Estudiante no encontrado.' });
    let allowed = rol === 'directivo' || rol === 'admin-general-colegio';
    if (!allowed && rol === 'padre') allowed = !!(await findGuardianStudent(userId!, paramId));
    if (!allowed) return res.status(403).json({ message: 'No autorizado a ver los cursos de este estudiante.' });
    const courseGroups = await getAllCourseGroupsForStudent(paramId, estudiante.institution_id);
    if (!courseGroups.length) return res.status(200).json([]);
    const courses: Array<{ _id: string; nombre: string; descripcion: string; colorAcento: string; icono: string; profesorIds: Array<{ _id: string; nombre: string; email: string }>; cursos: string[] }> = [];
    for (const g of courseGroups) {
      const details = await findGroupSubjectsByGroupWithDetails(g.id, estudiante.institution_id ?? undefined);
      for (const gs of details) {
        courses.push({
          _id: gs.id,
          nombre: [gs.subject_name, gs.group_name].filter(Boolean).join(' ').trim() || gs.subject_name || '',
          descripcion: gs.subject_description ?? '',
          colorAcento: '',
          icono: '',
          profesorIds: [{ _id: gs.teacher_id, nombre: gs.teacher_name, email: gs.teacher_email }],
          cursos: [g.name],
        });
      }
    }
    return res.status(200).json(courses);
  } catch (error: unknown) {
    console.error('Error al obtener cursos del hijo:', (error as Error).message);
    res.status(500).json({ message: 'Error interno del servidor.' });
  }
});

// GET /api/student/hijo/:estudianteId/notes
router.get('/hijo/:estudianteId/notes', protect, async (req: AuthRequest, res) => {
  try {
    const { estudianteId: paramId } = req.params;
    const userId = req.user?.id;
    const rol = req.user?.rol;
    const estudiante = await findUserById(paramId);
    if (!estudiante || estudiante.role !== 'estudiante') return res.status(404).json({ message: 'Estudiante no encontrado.' });
    let allowed = rol === 'directivo' || rol === 'admin-general-colegio';
    if (!allowed && rol === 'padre') allowed = !!(await findGuardianStudent(userId!, paramId));
    if (!allowed) return res.status(403).json({ message: 'No autorizado a ver las notas de este estudiante.' });
    const { materias, total } = await buildMateriasNotasForStudent(paramId, estudiante.institution_id);
    res.json({ materias, total });
  } catch (error: unknown) {
    console.error('Error al obtener notas del hijo:', (error as Error).message);
    res.status(500).json({ message: 'Error interno del servidor.' });
  }
});

export default router;
