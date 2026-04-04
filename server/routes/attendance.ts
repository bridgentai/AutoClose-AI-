import express from 'express';
import { startOfDay, endOfDay } from 'date-fns';
import { protect, AuthRequest } from '../middleware/auth.js';
import { requireStudentAccess } from '../middleware/studentAccessGuard.js';
import { findUserById } from '../repositories/userRepository.js';
import { findGroupSubjectById, findGroupSubjectsByGroupWithDetails } from '../repositories/groupSubjectRepository.js';
import { findGroupsByInstitution } from '../repositories/groupRepository.js';
import { resolveGroupId, resolveGroupSubjectId } from '../utils/resolveLegacyCourse.js';
import { findEnrollmentsByGroup } from '../repositories/enrollmentRepository.js';
import { findUsersByIds } from '../repositories/userRepository.js';
import { findGuardianStudent, findGuardianStudentsByStudent } from '../repositories/guardianStudentRepository.js';
import { findUsersByInstitutionAndRoles } from '../repositories/userRepository.js';
import { notify } from '../repositories/notificationRepository.js';
import { queryPg } from '../config/db-pg.js';
import { getDirectivoGroupIds } from '../utils/sectionFilter.js';
import {
  findAttendanceByGroupSubjectAndDate,
  findAttendanceByStudent,
  findAttendanceByStudentAndDate,
  findAttendanceById,
  findAttendanceByGroupMonth,
  updateAttendanceById,
  upsertAttendance,
} from '../repositories/attendanceRepository.js';

const router = express.Router();

async function getUserEmail(userId: string): Promise<string | undefined> {
  try {
    const r = await queryPg<{ email: string }>('SELECT email FROM users WHERE id = $1', [userId]);
    const email = r.rows[0]?.email;
    return typeof email === 'string' && email.trim() ? email.trim() : undefined;
  } catch {
    return undefined;
  }
}

function restrictTo(...roles: string[]) {
  return (req: AuthRequest, res: express.Response, next: express.NextFunction) => {
    if (!req.user || !roles.includes(req.user.rol)) {
      return res.status(403).json({ message: 'No autorizado para esta acción.' });
    }
    next();
  };
}

function toEstatus(s: string): 'presente' | 'ausente' {
  return s === 'present' ? 'presente' : 'ausente';
}

function fromEstatus(s: string): 'present' | 'absent' {
  return s === 'presente' ? 'present' : 'absent';
}

async function canParentViewStudent(parentId: string, studentId: string): Promise<boolean> {
  const v = await findGuardianStudent(parentId, studentId);
  return !!v;
}

// GET /api/attendance/curso/:cursoId/estudiantes
router.get('/curso/:cursoId/estudiantes', protect, restrictTo('profesor', 'directivo', 'admin-general-colegio', 'asistente', 'asistente-academica'), async (req: AuthRequest, res) => {
  try {
    const { cursoId } = req.params;
    const colegioId = req.user?.colegioId;
    if (!colegioId) return res.status(401).json({ message: 'No autorizado.' });
    const gsId = await resolveGroupSubjectId(cursoId, colegioId);
    if (!gsId) return res.status(404).json({ message: 'Curso no encontrado.' });
    const gs = await findGroupSubjectById(gsId);
    if (!gs) return res.status(404).json({ message: 'Curso no encontrado.' });
    const enrollments = await findEnrollmentsByGroup(gs.group_id);
    const studentIds = enrollments.map((e) => e.student_id);
    if (studentIds.length === 0) return res.json([]);
    const users = await findUsersByIds(studentIds);
    const students = users
      .filter((u) => u.role === 'estudiante')
      .map((u) => ({ _id: u.id, id: u.id, nombre: u.full_name, correo: u.email, curso: (u.config as { curso?: string })?.curso }));
    return res.json(students);
  } catch (e: unknown) {
    console.error(e);
    return res.status(500).json({ message: 'Error al listar estudiantes.' });
  }
});

// GET /api/attendance/curso/:cursoId/fecha/:fecha/status
router.get('/curso/:cursoId/fecha/:fecha/status', protect, restrictTo('profesor', 'directivo', 'admin-general-colegio', 'asistente', 'asistente-academica'), async (req: AuthRequest, res) => {
  try {
    const { cursoId, fecha } = req.params;
    const colegioId = req.user?.colegioId;
    if (!colegioId) return res.status(401).json({ message: 'No autorizado.' });
    const gsId = await resolveGroupSubjectId(cursoId, colegioId);
    if (!gsId) return res.json({ registrado: false, total: 0 });
    const dateStr = startOfDay(new Date(fecha)).toISOString().slice(0, 10);
    const list = await findAttendanceByGroupSubjectAndDate(gsId, dateStr);
    return res.json({ registrado: list.length > 0, total: list.length });
  } catch (e: unknown) {
    console.error(e);
    return res.status(500).json({ message: 'Error al verificar estado.' });
  }
});

// GET /api/attendance/curso/:cursoId/fecha/:fecha
router.get('/curso/:cursoId/fecha/:fecha', protect, restrictTo('profesor', 'directivo', 'admin-general-colegio', 'asistente', 'asistente-academica'), async (req: AuthRequest, res) => {
  try {
    const { cursoId, fecha } = req.params;
    const colegioId = req.user?.colegioId;
    if (!colegioId) return res.status(401).json({ message: 'No autorizado.' });
    const gsId = await resolveGroupSubjectId(cursoId, colegioId);
    if (!gsId) return res.json([]);
    const dateStr = startOfDay(new Date(fecha)).toISOString().slice(0, 10);
    const list = await findAttendanceByGroupSubjectAndDate(gsId, dateStr);
    const userIds = Array.from(new Set(list.map((a) => a.user_id)));
    const users = userIds.length ? await findUsersByIds(userIds) : [];
    const byId = new Map(users.map((u) => [u.id, u]));
    const out = list.map((a) => ({
      _id: a.id,
      estudianteId: byId.get(a.user_id) ? { _id: a.user_id, nombre: byId.get(a.user_id)!.full_name, correo: byId.get(a.user_id)!.email, curso: (byId.get(a.user_id)!.config as { curso?: string })?.curso } : a.user_id,
      fecha: a.date,
      estado: toEstatus(a.status),
      status: a.status,
    }));
    return res.json(out);
  } catch (e: unknown) {
    console.error(e);
    return res.status(500).json({ message: 'Error al listar asistencia.' });
  }
});

// GET /api/attendance/grupo/:grupoId/fecha/:fecha — vista directivo: todos los registros del grupo ese día, con materia, hora y recorded_by
router.get('/grupo/:grupoId/fecha/:fecha', protect, restrictTo('profesor', 'directivo', 'admin-general-colegio', 'asistente', 'asistente-academica'), async (req: AuthRequest, res) => {
  try {
    const grupoParam = decodeURIComponent((req.params.grupoId || '').trim());
    const fechaParam = req.params.fecha || '';
    const institutionId = req.user?.institutionId ?? req.user?.colegioId;
    if (!institutionId || !grupoParam || !fechaParam) return res.status(400).json({ message: 'Faltan grupoId o fecha.' });

    const resolved = await resolveGroupId(grupoParam, institutionId);
    if (!resolved) return res.json([]);

    const gsListWithDetails = await findGroupSubjectsByGroupWithDetails(resolved.id, institutionId);
    const dateStr = startOfDay(new Date(fechaParam)).toISOString().slice(0, 10);
    const out: Array<{
      _id: string;
      estudianteId: string;
      cursoId: { _id: string; nombre: string };
      fecha: string;
      estado: 'presente' | 'ausente';
      horaBloque?: string;
      puntualidad?: 'on_time' | 'late';
      recorded_by_id?: string | null;
    }> = [];
    for (const gs of gsListWithDetails) {
      const list = await findAttendanceByGroupSubjectAndDate(gs.id, dateStr);
      const subjectName = gs.subject_name?.trim() || 'Materia';
      for (const a of list) {
        out.push({
          _id: a.id,
          estudianteId: a.user_id,
          cursoId: { _id: gs.id, nombre: subjectName },
          fecha: a.date,
          estado: toEstatus(a.status),
          horaBloque: a.period_slot ?? undefined,
          puntualidad: (a.punctuality === 'on_time' || a.punctuality === 'late' ? a.punctuality : undefined) as 'on_time' | 'late' | undefined,
          recorded_by_id: a.recorded_by_id ?? undefined,
        });
      }
    }
    const userIds = Array.from(new Set(out.map((o) => o.estudianteId)));
    const recorderIds = Array.from(new Set(out.map((o) => o.recorded_by_id).filter(Boolean))) as string[];
    const allUserIds = Array.from(new Set([...userIds, ...recorderIds]));
    const users = allUserIds.length ? await findUsersByIds(allUserIds) : [];
    const byId = new Map(users.map((u) => [u.id, u]));
    const outWithUsers = out.map((o) => {
      const user = byId.get(o.estudianteId);
      const recordedBy = o.recorded_by_id ? byId.get(o.recorded_by_id) : null;
      return {
        _id: o._id,
        estudianteId: user
          ? { _id: user.id, nombre: user.full_name, correo: user.email, curso: (user.config as { curso?: string })?.curso }
          : o.estudianteId,
        cursoId: o.cursoId,
        fecha: o.fecha,
        estado: o.estado,
        horaBloque: o.horaBloque,
        puntualidad: o.puntualidad,
        recorded_by: recordedBy ? { _id: recordedBy.id, nombre: recordedBy.full_name } : null,
      };
    });
    return res.json(outWithUsers);
  } catch (e: unknown) {
    console.error(e);
    return res.status(500).json({ message: 'Error al listar asistencia del grupo.' });
  }
});

// GET /api/attendance/grupo/:grupoId/historial — historial del grupo con filtros mes, materia, estudiante
router.get('/grupo/:grupoId/historial', protect, restrictTo('profesor', 'directivo', 'admin-general-colegio', 'asistente', 'asistente-academica'), async (req: AuthRequest, res) => {
  try {
    const grupoParam = decodeURIComponent((req.params.grupoId || '').trim());
    const institutionId = req.user?.institutionId ?? req.user?.colegioId;
    if (!institutionId || !grupoParam) return res.status(400).json({ message: 'Faltan grupoId.' });

    const resolved = await resolveGroupId(grupoParam, institutionId);
    if (!resolved) return res.json([]);

    const mes = parseInt(String(req.query.mes || new Date().getMonth() + 1), 10);
    const anio = parseInt(String(req.query.anio || new Date().getFullYear()), 10);
    const groupSubjectId = req.query.groupSubjectId as string | undefined;
    const estudianteId = req.query.estudianteId as string | undefined;

    if (mes < 1 || mes > 12) return res.status(400).json({ message: 'Mes debe ser 1-12.' });

    const rows = await findAttendanceByGroupMonth(resolved.id, institutionId, anio, mes, {
      groupSubjectId: groupSubjectId || undefined,
      estudianteId: estudianteId || undefined,
    });

    const list = rows.map((r) => ({
      _id: r.id,
      fecha: r.date,
      materia: r.subject_name,
      group_subject_id: r.group_subject_id,
      estudianteId: r.user_id,
      estudianteNombre: r.student_name,
      estado: toEstatus(r.status),
      puntualidad: r.punctuality === 'on_time' || r.punctuality === 'late' ? r.punctuality : null,
      registradoPor: r.recorded_by_name ?? undefined,
      horaBloque: r.period_slot ?? undefined,
    }));
    return res.json(list);
  } catch (e: unknown) {
    console.error(e);
    return res.status(500).json({ message: 'Error al obtener historial.' });
  }
});

// GET /api/attendance/grupo/:grupoId/analisis-ia — resumen + análisis OpenAI del mes
router.get('/grupo/:grupoId/analisis-ia', protect, restrictTo('directivo', 'admin-general-colegio', 'asistente-academica'), async (req: AuthRequest, res) => {
  try {
    const { generateAttendanceAnalysis } = await import('../services/openai.js');
    const grupoParam = decodeURIComponent((req.params.grupoId || '').trim());
    const institutionId = req.user?.institutionId ?? req.user?.colegioId;
    if (!institutionId || !grupoParam) return res.status(400).json({ message: 'Faltan grupoId.' });

    const resolved = await resolveGroupId(grupoParam, institutionId);
    if (!resolved) return res.status(404).json({ message: 'Grupo no encontrado.' });

    const mes = parseInt(String(req.query.mes || new Date().getMonth() + 1), 10);
    const anio = parseInt(String(req.query.anio || new Date().getFullYear()), 10);
    if (mes < 1 || mes > 12) return res.status(400).json({ message: 'Mes debe ser 1-12.' });

    const rows = await findAttendanceByGroupMonth(resolved.id, institutionId, anio, mes);
    const groupName = resolved.name ?? grupoParam;
    const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    const monthLabel = `${monthNames[mes - 1]} ${anio}`;

    // Resumen estructurado: por materia (total clases, % asistencia), por estudiante (% y total), días con más ausencias, críticos (<80%)
    const bySubject = new Map<string, { total: number; present: number; name: string }>();
    const byStudent = new Map<string, { total: number; present: number; name: string }>();
    const byDate = new Map<string, { total: number; absent: number }>();

    for (const r of rows) {
      const subKey = r.group_subject_id;
      if (!bySubject.has(subKey)) bySubject.set(subKey, { total: 0, present: 0, name: r.subject_name });
      const ss = bySubject.get(subKey)!;
      ss.total++;
      if (r.status === 'present') ss.present++;

      const stuKey = r.user_id;
      if (!byStudent.has(stuKey)) byStudent.set(stuKey, { total: 0, present: 0, name: r.student_name });
      const st = byStudent.get(stuKey)!;
      st.total++;
      if (r.status === 'present') st.present++;

      const dKey = r.date;
      if (!byDate.has(dKey)) byDate.set(dKey, { total: 0, absent: 0 });
      const dd = byDate.get(dKey)!;
      dd.total++;
      if (r.status === 'absent') dd.absent++;
    }

    const totalClasesPorMateria = Array.from(bySubject.entries()).map(([id, v]) => ({
      materia: v.name,
      total: v.total,
      presentes: v.present,
      porcentaje: v.total ? Math.round((v.present / v.total) * 100) : 0,
    }));
    const porcentajePorEstudiante = Array.from(byStudent.entries()).map(([id, v]) => ({
      estudiante: v.name,
      total: v.total,
      presentes: v.present,
      porcentaje: v.total ? Math.round((v.present / v.total) * 100) : 0,
    }));
    const estudiantesCriticos = porcentajePorEstudiante.filter((e) => e.porcentaje < 80);
    const diasConMasAusencias = Array.from(byDate.entries())
      .map(([fecha, v]) => ({ fecha, ausentes: v.absent, total: v.total }))
      .filter((d) => d.total > 0)
      .sort((a, b) => b.ausentes - a.ausentes)
      .slice(0, 5);

    const resumen = {
      totalRegistros: rows.length,
      porMateria: totalClasesPorMateria,
      porEstudiante: porcentajePorEstudiante,
      estudiantesCriticos: estudiantesCriticos.map((e) => ({ nombre: e.estudiante, porcentaje: e.porcentaje })),
      diasConMasAusencias,
      porcentajeGeneral: rows.length
        ? Math.round((rows.filter((r) => r.status === 'present').length / rows.length) * 100)
        : 0,
    };

    const summaryLines: string[] = [];
    summaryLines.push(`Total de registros en el mes: ${resumen.totalRegistros}.`);
    summaryLines.push(`Asistencia general: ${resumen.porcentajeGeneral}%.`);
    summaryLines.push('Por materia: ' + resumen.porMateria.map((m) => `${m.materia}: ${m.porcentaje}% (${m.presentes}/${m.total})`).join('; ') + '.');
    summaryLines.push('Estudiantes con menos del 80%: ' + (resumen.estudiantesCriticos.length ? resumen.estudiantesCriticos.map((e) => `${e.nombre} (${e.porcentaje}%)`).join(', ') : 'ninguno') + '.');
    summaryLines.push('Días con más ausencias: ' + resumen.diasConMasAusencias.map((d) => `${d.fecha}: ${d.ausentes} ausentes`).join('; ') + '.');

    const analisis = await generateAttendanceAnalysis(summaryLines.join('\n'), groupName, monthLabel);

    return res.json({
      resumen,
      analisis,
      generado_en: new Date().toISOString(),
    });
  } catch (e: unknown) {
    console.error(e);
    return res.status(500).json({ message: 'Error al generar análisis de asistencia.' });
  }
});

// PATCH /api/attendance/:id — actualizar status y/o punctuality (solo directivo, admin-general-colegio)
router.patch('/:id', protect, restrictTo('directivo', 'admin-general-colegio', 'asistente-academica'), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const institutionId = req.user?.institutionId ?? req.user?.colegioId;
    if (!institutionId) return res.status(401).json({ message: 'No autorizado.' });
    const existing = await findAttendanceById(id);
    if (!existing) return res.status(404).json({ message: 'Registro no encontrado.' });
    if (existing.institution_id !== institutionId) return res.status(403).json({ message: 'No autorizado a modificar este registro.' });

    const body = req.body as { estado?: 'presente' | 'ausente'; puntualidad?: 'on_time' | 'late' | null };
    const patch: { status?: string; punctuality?: string | null } = {};
    if (body.estado !== undefined) patch.status = body.estado === 'presente' ? 'present' : 'absent';
    if (body.puntualidad !== undefined) patch.punctuality = body.puntualidad ?? null;

    const row = await updateAttendanceById(id, institutionId, patch);
    if (!row) return res.status(500).json({ message: 'Error al actualizar.' });
    const user = await findUserById(row.user_id);
    return res.json({
      _id: row.id,
      estudianteId: user ? { _id: user.id, nombre: user.full_name, correo: user.email, curso: (user.config as { curso?: string })?.curso } : row.user_id,
      fecha: row.date,
      estado: toEstatus(row.status),
      puntualidad: row.punctuality === 'on_time' || row.punctuality === 'late' ? row.punctuality : null,
    });
  } catch (e: unknown) {
    console.error(e);
    return res.status(500).json({ message: 'Error al actualizar asistencia.' });
  }
});

// POST /api/attendance
router.post('/', protect, restrictTo('profesor', 'directivo', 'admin-general-colegio', 'asistente-academica'), async (req: AuthRequest, res) => {
  try {
    const { cursoId, estudianteId, fecha, estado } = req.body;
    const colegioId = req.user?.colegioId;
    const userId = req.user?.id;
    if (!colegioId || !userId) return res.status(401).json({ message: 'No autorizado.' });
    if (!cursoId || !estudianteId || !fecha || !['presente', 'ausente'].includes(estado)) {
      return res.status(400).json({ message: 'Faltan cursoId, estudianteId, fecha o estado (presente|ausente).' });
    }
    const gsId = await resolveGroupSubjectId(cursoId, colegioId);
    if (!gsId) return res.status(404).json({ message: 'Curso no encontrado.' });
    const gs = await findGroupSubjectById(gsId);
    if (!gs || gs.institution_id !== colegioId) return res.status(404).json({ message: 'Curso no encontrado.' });
    const dateStr = startOfDay(new Date(fecha)).toISOString().slice(0, 10);
    const row = await upsertAttendance({
      institution_id: colegioId,
      group_subject_id: gsId,
      user_id: estudianteId,
      date: dateStr,
      status: fromEstatus(estado),
      recorded_by_id: userId,
    });
    const user = await findUserById(estudianteId);

    if (row.status === 'absent' && user) {
      const subjectName = (gs as { display_name?: string | null }).display_name?.trim() || '';
      const body = `${user.full_name} fue marcado ausente en ${subjectName || 'una materia'} el ${new Date(dateStr).toLocaleDateString('es-CO')}`;
      const title = 'Ausencia registrada';

      const guardians = await findGuardianStudentsByStudent(estudianteId);
      for (const g of guardians) {
        const email = await getUserEmail(g.guardian_id);
        await notify({
          institution_id: colegioId,
          user_id: g.guardian_id,
          user_email: email,
          type: 'ausencia',
          title,
          body,
          action_url: '/dashboard',
        });
      }

      const directivos = await findUsersByInstitutionAndRoles(colegioId, ['directivo']);
      for (const d of directivos) {
        const email = await getUserEmail(d.id);
        await notify({
          institution_id: colegioId,
          user_id: d.id,
          user_email: email,
          type: 'ausencia',
          title,
          body,
          action_url: '/dashboard',
        });
      }
    }

    return res.json({
      _id: row.id,
      estudianteId: user ? { _id: user.id, nombre: user.full_name, correo: user.email, curso: (user.config as { curso?: string })?.curso } : estudianteId,
      fecha: row.date,
      estado: toEstatus(row.status),
    });
  } catch (e: unknown) {
    console.error(e);
    return res.status(500).json({ message: 'Error al registrar asistencia.' });
  }
});

// POST /api/attendance/bulk
router.post('/bulk', protect, restrictTo('profesor', 'directivo', 'admin-general-colegio', 'asistente-academica'), async (req: AuthRequest, res) => {
  try {
    const { cursoId, fecha, horaBloque, registros } = req.body as {
      cursoId: string;
      fecha: string;
      horaBloque?: string;
      registros: { estudianteId: string; estado: 'presente' | 'ausente'; puntualidad?: 'on_time' | 'late' }[];
    };
    const colegioId = req.user?.colegioId;
    const userId = req.user?.id;
    if (!colegioId || !userId) return res.status(401).json({ message: 'No autorizado.' });
    if (!cursoId || !fecha || !Array.isArray(registros)) {
      return res.status(400).json({ message: 'Faltan cursoId, fecha o registros.' });
    }
    const gsId = await resolveGroupSubjectId(cursoId, colegioId);
    if (!gsId) return res.status(404).json({ message: 'Curso no encontrado.' });
    const gs = await findGroupSubjectById(gsId);
    if (!gs || gs.institution_id !== colegioId) return res.status(404).json({ message: 'Curso no encontrado.' });
    const dateStr = startOfDay(new Date(fecha)).toISOString().slice(0, 10);
    for (const r of registros) {
      await upsertAttendance({
        institution_id: colegioId,
        group_subject_id: gsId,
        user_id: r.estudianteId,
        date: dateStr,
        period_slot: horaBloque ?? null,
        status: fromEstatus(r.estado),
        punctuality: r.puntualidad ?? null,
        recorded_by_id: userId,
      });
    }

    const absentIds = registros.filter((r) => r.estado === 'ausente').map((r) => r.estudianteId);
    if (absentIds.length) {
      const users = await findUsersByIds(Array.from(new Set(absentIds)));
      const byId = new Map(users.map((u) => [u.id, u]));
      const subjectName = (gs as { display_name?: string | null }).display_name?.trim() || '';
      const directivos = await findUsersByInstitutionAndRoles(colegioId, ['directivo']);

      for (const sid of absentIds) {
        const stu = byId.get(sid);
        if (!stu) continue;
        const body = `${stu.full_name} fue marcado ausente en ${subjectName || 'una materia'} el ${new Date(dateStr).toLocaleDateString('es-CO')}`;
        const title = 'Ausencia registrada';

        const guardians = await findGuardianStudentsByStudent(sid);
        for (const g of guardians) {
          const email = await getUserEmail(g.guardian_id);
          await notify({
            institution_id: colegioId,
            user_id: g.guardian_id,
            user_email: email,
            type: 'ausencia',
            title,
            body,
            action_url: '/dashboard',
          });
        }
        for (const d of directivos) {
          const email = await getUserEmail(d.id);
          await notify({
            institution_id: colegioId,
            user_id: d.id,
            user_email: email,
            type: 'ausencia',
            title,
            body,
            action_url: '/dashboard',
          });
        }
      }
    }

    const list = await findAttendanceByGroupSubjectAndDate(gsId, dateStr);
    const userIds = Array.from(new Set(list.map((a) => a.user_id)));
    const users = userIds.length ? await findUsersByIds(userIds) : [];
    const byId = new Map(users.map((u) => [u.id, u]));
    const out = list.map((a) => ({
      _id: a.id,
      estudianteId: byId.get(a.user_id) ? { _id: a.user_id, nombre: byId.get(a.user_id)!.full_name, correo: byId.get(a.user_id)!.email, curso: (byId.get(a.user_id)!.config as { curso?: string })?.curso } : a.user_id,
      fecha: a.date,
      estado: toEstatus(a.status),
    }));
    return res.json(out);
  } catch (e: unknown) {
    console.error(e);
    return res.status(500).json({ message: 'Error al registrar asistencia en lote.' });
  }
});

// GET /api/attendance/estudiante/:estudianteId
router.get(
  '/estudiante/:estudianteId',
  protect,
  requireStudentAccess('estudianteId', 'all_teachers'),
  async (req: AuthRequest, res) => {
  try {
    const { estudianteId } = req.params;
    const userId = req.user?.id;
    const rol = req.user?.rol;
    const colegioId = req.user?.colegioId;
    if (!colegioId) return res.status(401).json({ message: 'No autorizado.' });
    const canView =
      rol === 'directivo' ||
      rol === 'admin-general-colegio' ||
      rol === 'asistente-academica' ||
      rol === 'school_admin' ||
      rol === 'administrador-general' ||
      rol === 'super_admin' ||
      rol === 'profesor' ||
      rol === 'asistente' ||
      userId === estudianteId ||
      (rol === 'padre' && (await canParentViewStudent(userId!, estudianteId)));
    if (!canView) return res.status(403).json({ message: 'No autorizado a ver esta asistencia.' });
    const { desde, hasta } = req.query;
    let list = await findAttendanceByStudent(estudianteId);
    if (desde || hasta) {
      const from = desde ? startOfDay(new Date(desde as string)).toISOString().slice(0, 10) : '';
      const to = hasta ? endOfDay(new Date(hasta as string)).toISOString().slice(0, 10) : '';
      list = await findAttendanceByStudentAndDate(estudianteId, from || '1900-01-01', to || '2100-12-31');
    }
    list = list.slice(0, 100);
    const total = list.length;
    const presentes = list.filter((a) => a.status === 'present').length;
    const porcentaje = total ? Math.round((presentes / total) * 100) : 0;
    return res.json({
      list: list.map((a) => ({ _id: a.id, cursoId: a.group_subject_id, fecha: a.date, estado: toEstatus(a.status) })),
      total,
      presentes,
      porcentaje,
    });
  } catch (e: unknown) {
    console.error(e);
    return res.status(500).json({ message: 'Error al obtener asistencia del estudiante.' });
  }
});

// GET /api/attendance/resumen/estudiante/:estudianteId
router.get(
  '/resumen/estudiante/:estudianteId',
  protect,
  requireStudentAccess('estudianteId', 'all_teachers'),
  async (req: AuthRequest, res) => {
  try {
    const { estudianteId } = req.params;
    const userId = req.user?.id;
    const rol = req.user?.rol;
    const colegioId = req.user?.colegioId;
    if (!colegioId) return res.status(401).json({ message: 'No autorizado.' });
    const canView =
      rol === 'directivo' ||
      rol === 'admin-general-colegio' ||
      rol === 'asistente-academica' ||
      rol === 'school_admin' ||
      rol === 'administrador-general' ||
      rol === 'super_admin' ||
      rol === 'profesor' ||
      rol === 'asistente' ||
      userId === estudianteId ||
      (rol === 'padre' && (await canParentViewStudent(userId!, estudianteId)));
    if (!canView) return res.status(403).json({ message: 'No autorizado.' });
    const now = new Date();
    const startMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    const endMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
    const list = await findAttendanceByStudentAndDate(estudianteId, startMonth, endMonth);
    const total = list.length;
    const presentes = list.filter((a) => a.status === 'present').length;
    const porcentaje = total ? Math.round((presentes / total) * 100) : 0;
    return res.json({ porcentaje, total, presentes });
  } catch (e: unknown) {
    console.error(e);
    return res.status(500).json({ message: 'Error al obtener resumen.' });
  }
});

const restrictToStaff = restrictTo(
  'directivo', 'admin-general-colegio', 'super_admin', 'asistente-academica'
);

router.get('/tendencia-institucional', protect, restrictToStaff, async (req: AuthRequest, res) => {
  try {
    const colegioId = req.user?.colegioId ?? req.user?.institutionId;
    if (!colegioId) return res.status(401).json({ message: 'No autorizado.' });

    const semanas = Math.min(4, Math.max(1, parseInt(String(req.query.semanas ?? '2'), 10)));
    const diasAtras = semanas * 7;

    const groupIds = await getDirectivoGroupIds(req);
    if (groupIds !== null && groupIds.length === 0) return res.json([]);

    let attendanceQuery: string;
    let queryParams: unknown[];

    if (groupIds === null) {
      attendanceQuery = `
        SELECT a.date::text AS dia, COUNT(*)::int AS total,
          SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END)::int AS presentes
        FROM attendance a
        WHERE a.institution_id = $1
          AND a.date >= CURRENT_DATE - $2::int
        GROUP BY a.date ORDER BY a.date ASC`;
      queryParams = [colegioId, diasAtras];
    } else {
      const placeholders = groupIds.map((_, i) => `$${i + 3}`).join(', ');
      attendanceQuery = `
        SELECT a.date::text AS dia, COUNT(*)::int AS total,
          SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END)::int AS presentes
        FROM attendance a
        JOIN group_subjects gs ON gs.id = a.group_subject_id
        WHERE a.institution_id = $1
          AND gs.group_id IN (${placeholders})
          AND a.date >= CURRENT_DATE - $2::int
        GROUP BY a.date ORDER BY a.date ASC`;
      queryParams = [colegioId, diasAtras, ...groupIds];
    }

    const r = await queryPg<{ dia: string; total: number; presentes: number }>(
      attendanceQuery,
      queryParams
    );

    const result = r.rows.map((row) => {
      const d = new Date(row.dia + 'T12:00:00');
      const dayLabel = d.toLocaleDateString('es-CO', { weekday: 'short' });
      return {
        dia: dayLabel.charAt(0).toUpperCase() + dayLabel.slice(1),
        fecha: row.dia,
        pct: row.total > 0 ? Math.round((row.presentes / row.total) * 100) : null,
      };
    });

    return res.json(result);
  } catch (e: unknown) {
    console.error(e);
    return res.status(500).json({ message: 'Error al obtener tendencia de asistencia.' });
  }
});

export default router;
