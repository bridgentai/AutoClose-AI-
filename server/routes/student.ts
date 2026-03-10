import express from 'express';
import { protect, AuthRequest } from '../middleware/auth.js';
import { findUserById, updateUser } from '../repositories/userRepository.js';
import { findGroupSubjectsByGroup, findGroupSubjectsByGroupWithDetails, findGroupSubjectById } from '../repositories/groupSubjectRepository.js';
import { findSubjectById } from '../repositories/subjectRepository.js';
import { findGuardianStudent } from '../repositories/guardianStudentRepository.js';
import { getFirstGroupNameForStudent, getAllCourseGroupsForStudent, findEnrollmentsByGroup } from '../repositories/enrollmentRepository.js';
import { findGroupByNameAndInstitution } from '../repositories/groupRepository.js';
import { findGradesByUserAndGroup } from '../repositories/gradeRepository.js';
import { findAssignmentById } from '../repositories/assignmentRepository.js';

const router = express.Router();

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
      _id: gs.subject_id,
      nombre: gs.subject_name,
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
    const courseGroups = await getAllCourseGroupsForStudent(estudianteId, user.institution_id);
    if (!courseGroups.length) return res.json({ materias: [], total: 0 });
    const allGrades = (
      await Promise.all(courseGroups.map((g) => findGradesByUserAndGroup(estudianteId, g.id)))
    ).flat();
    const notesWithSubject = await Promise.all(
      allGrades.map(async (g) => {
        const assignment = await findAssignmentById(g.assignment_id);
        const gs = assignment ? await findGroupSubjectById(assignment.group_subject_id) : null;
        const subject = gs ? await findSubjectById(gs.subject_id) : null;
        return {
          _id: g.id,
          subjectId: subject?.id ?? g.assignment_id,
          subjectName: subject?.name ?? 'Sin materia',
          gsId: gs?.id ?? null,
          assignmentCategoryId: assignment?.assignment_category_id ?? null,
          tareaId: { _id: assignment?.id, titulo: assignment?.title, fechaEntrega: assignment?.due_date },
          nota: g.score,
          maxScore: g.max_score,
          fecha: g.recorded_at,
        };
      })
    );
    const bySubject = new Map<string, { _id: string; nombre: string; groupSubjectId: string | null; notas: typeof notesWithSubject; sum: number; count: number }>();
    for (const n of notesWithSubject) {
      const sid = n.subjectId;
      if (!bySubject.has(sid)) bySubject.set(sid, { _id: sid, nombre: n.subjectName, groupSubjectId: null, notas: [], sum: 0, count: 0 });
      const row = bySubject.get(sid)!;
      row.notas.push(n);
      if (n.gsId && !row.groupSubjectId) row.groupSubjectId = n.gsId;
      row.sum += n.nota;
      row.count += 1;
    }
    const materias = Array.from(bySubject.values()).map((row) => {
      const promedio = row.count > 0 ? Math.round((row.sum / row.count) * 10) / 10 : 0;
      const ultimaNota = row.notas.length ? row.notas.reduce((a, b) => (new Date(b.fecha) > new Date(a.fecha) ? b : a)).nota : null;
      const estado = promedio >= 65 ? 'aprobado' : 'reprobado';
      const groupSubjectId = row.groupSubjectId ?? row.notas[0]?.gsId ?? null;
      return {
        _id: row._id,
        nombre: row.nombre,
        groupSubjectId,
        promedio,
        ultimaNota,
        estado,
        tendencia: 'stable' as const,
        colorAcento: '',
        notas: row.notas.map((nn) => ({
          tareaTitulo: nn.tareaId?.titulo,
          nota: nn.nota,
          fecha: nn.fecha,
          comentario: null,
          logro: null,
          gradingCategoryId: nn.assignmentCategoryId ?? undefined,
        })),
      };
    });
    res.json({ materias, total: materias.length });
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
    const courseGroups = await getAllCourseGroupsForStudent(paramId, estudiante.institution_id);
    if (!courseGroups.length) return res.json({ materias: [], total: 0 });
    const allGrades = (
      await Promise.all(courseGroups.map((g) => findGradesByUserAndGroup(paramId, g.id)))
    ).flat();
    const notesWithSubject = await Promise.all(
      allGrades.map(async (g) => {
        const assignment = await findAssignmentById(g.assignment_id);
        const gs = assignment ? await findGroupSubjectById(assignment.group_subject_id) : null;
        const subject = gs ? await findSubjectById(gs.subject_id) : null;
        return {
          _id: g.id,
          subjectId: subject?.id ?? g.assignment_id,
          subjectName: subject?.name ?? 'Sin materia',
          gsId: gs?.id ?? null,
          assignmentCategoryId: assignment?.assignment_category_id ?? null,
          tareaId: { _id: assignment?.id, titulo: assignment?.title, fechaEntrega: assignment?.due_date },
          nota: g.score,
          maxScore: g.max_score,
          fecha: g.recorded_at,
        };
      })
    );
    const bySubject = new Map<string, { _id: string; nombre: string; groupSubjectId: string | null; notas: typeof notesWithSubject; sum: number; count: number }>();
    for (const n of notesWithSubject) {
      const sid = n.subjectId;
      if (!bySubject.has(sid)) bySubject.set(sid, { _id: sid, nombre: n.subjectName, groupSubjectId: null, notas: [], sum: 0, count: 0 });
      const row = bySubject.get(sid)!;
      row.notas.push(n);
      if (n.gsId && !row.groupSubjectId) row.groupSubjectId = n.gsId;
      row.sum += n.nota;
      row.count += 1;
    }
    const materias = Array.from(bySubject.values()).map((row) => {
      const promedio = row.count > 0 ? Math.round((row.sum / row.count) * 10) / 10 : 0;
      const ultimaNota = row.notas.length ? row.notas.reduce((a, b) => (new Date(b.fecha) > new Date(a.fecha) ? b : a)).nota : null;
      const estado = promedio >= 65 ? 'aprobado' : 'reprobado';
      const groupSubjectId = row.groupSubjectId ?? row.notas[0]?.gsId ?? null;
      return {
        _id: row._id,
        nombre: row.nombre,
        groupSubjectId,
        promedio,
        ultimaNota,
        estado,
        tendencia: 'stable' as const,
        colorAcento: '',
        notas: row.notas.map((nn) => ({
          tareaTitulo: nn.tareaId?.titulo,
          nota: nn.nota,
          fecha: nn.fecha,
          comentario: null,
          logro: null,
          gradingCategoryId: nn.assignmentCategoryId ?? undefined,
        })),
      };
    });
    res.json({ materias, total: materias.length });
  } catch (error: unknown) {
    console.error('Error al obtener notas del hijo:', (error as Error).message);
    res.status(500).json({ message: 'Error interno del servidor.' });
  }
});

export default router;
