import express from 'express';
import { startOfDay, endOfDay } from 'date-fns';
import { protect, AuthRequest } from '../middleware/auth.js';
import { findUserById } from '../repositories/userRepository.js';
import { findGroupSubjectById, findGroupSubjectsByGroupWithDetails } from '../repositories/groupSubjectRepository.js';
import { findGroupsByInstitution } from '../repositories/groupRepository.js';
import { resolveGroupId, resolveGroupSubjectId } from '../utils/resolveLegacyCourse.js';
import { findEnrollmentsByGroup } from '../repositories/enrollmentRepository.js';
import { findUsersByIds } from '../repositories/userRepository.js';
import { findGuardianStudent } from '../repositories/guardianStudentRepository.js';
import {
  findAttendanceByGroupSubjectAndDate,
  findAttendanceByStudent,
  findAttendanceByStudentAndDate,
  upsertAttendance,
} from '../repositories/attendanceRepository.js';

const router = express.Router();

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
router.get('/curso/:cursoId/estudiantes', protect, restrictTo('profesor', 'directivo', 'admin-general-colegio', 'asistente'), async (req: AuthRequest, res) => {
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
router.get('/curso/:cursoId/fecha/:fecha/status', protect, restrictTo('profesor', 'directivo', 'admin-general-colegio', 'asistente'), async (req: AuthRequest, res) => {
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
router.get('/curso/:cursoId/fecha/:fecha', protect, restrictTo('profesor', 'directivo', 'admin-general-colegio', 'asistente'), async (req: AuthRequest, res) => {
  try {
    const { cursoId, fecha } = req.params;
    const colegioId = req.user?.colegioId;
    if (!colegioId) return res.status(401).json({ message: 'No autorizado.' });
    const gsId = await resolveGroupSubjectId(cursoId, colegioId);
    if (!gsId) return res.json([]);
    const dateStr = startOfDay(new Date(fecha)).toISOString().slice(0, 10);
    const list = await findAttendanceByGroupSubjectAndDate(gsId, dateStr);
    const userIds = [...new Set(list.map((a) => a.user_id))];
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

// GET /api/attendance/grupo/:grupoId/fecha/:fecha — vista directivo: todos los registros del grupo ese día, con materia y hora
router.get('/grupo/:grupoId/fecha/:fecha', protect, restrictTo('profesor', 'directivo', 'admin-general-colegio', 'asistente'), async (req: AuthRequest, res) => {
  try {
    const grupoParam = decodeURIComponent((req.params.grupoId || '').trim());
    const fechaParam = req.params.fecha || '';
    const institutionId = req.user?.institutionId ?? req.user?.colegioId;
    if (!institutionId || !grupoParam || !fechaParam) return res.status(400).json({ message: 'Faltan grupoId o fecha.' });

    const resolved = await resolveGroupId(grupoParam, institutionId);
    if (!resolved) return res.json([]);
    const group = { id: resolved.id, institution_id: institutionId };

    const gsListWithDetails = await findGroupSubjectsByGroupWithDetails(resolved.id, institutionId);
    const dateStr = startOfDay(new Date(fechaParam)).toISOString().slice(0, 10);
    const out: Array<{
      _id: string;
      estudianteId: string | { _id: string; nombre?: string; correo?: string; curso?: string };
      cursoId: { _id: string; nombre: string };
      fecha: string;
      estado: 'presente' | 'ausente';
      horaBloque?: string;
      puntualidad?: 'on_time' | 'late';
    }> = [];
    for (const gs of gsListWithDetails) {
      const list = await findAttendanceByGroupSubjectAndDate(gs.id, dateStr);
      for (const a of list) {
        out.push({
          _id: a.id,
          estudianteId: a.user_id,
          cursoId: { _id: gs.id, nombre: [gs.subject_name, gs.group_name].filter(Boolean).join(' ').trim() || 'Materia' },
          fecha: a.date,
          estado: toEstatus(a.status),
          horaBloque: a.period_slot ?? undefined,
          puntualidad: (a.punctuality === 'on_time' || a.punctuality === 'late' ? a.punctuality : undefined) as 'on_time' | 'late' | undefined,
        });
      }
    }
    const userIds = [...new Set(out.map((o) => (typeof o.estudianteId === 'object' ? (o.estudianteId as { _id: string })._id : o.estudianteId)))];
    const users = userIds.length ? await findUsersByIds(userIds) : [];
    const byId = new Map(users.map((u) => [u.id, u]));
    const outWithUsers = out.map((o) => {
      const uid = typeof o.estudianteId === 'object' ? (o.estudianteId as { _id: string })._id : o.estudianteId;
      const user = byId.get(uid);
      return {
        ...o,
        estudianteId: user
          ? { _id: user.id, nombre: user.full_name, correo: user.email, curso: (user.config as { curso?: string })?.curso }
          : uid,
      };
    });
    return res.json(outWithUsers);
  } catch (e: unknown) {
    console.error(e);
    return res.status(500).json({ message: 'Error al listar asistencia del grupo.' });
  }
});

// POST /api/attendance
router.post('/', protect, restrictTo('profesor', 'directivo', 'admin-general-colegio'), async (req: AuthRequest, res) => {
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
router.post('/bulk', protect, restrictTo('profesor', 'directivo', 'admin-general-colegio'), async (req: AuthRequest, res) => {
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
    const list = await findAttendanceByGroupSubjectAndDate(gsId, dateStr);
    const userIds = [...new Set(list.map((a) => a.user_id))];
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
router.get('/estudiante/:estudianteId', protect, async (req: AuthRequest, res) => {
  try {
    const { estudianteId } = req.params;
    const userId = req.user?.id;
    const rol = req.user?.rol;
    const colegioId = req.user?.colegioId;
    if (!colegioId) return res.status(401).json({ message: 'No autorizado.' });
    const canView =
      rol === 'directivo' ||
      rol === 'admin-general-colegio' ||
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
router.get('/resumen/estudiante/:estudianteId', protect, async (req: AuthRequest, res) => {
  try {
    const { estudianteId } = req.params;
    const userId = req.user?.id;
    const rol = req.user?.rol;
    const colegioId = req.user?.colegioId;
    if (!colegioId) return res.status(401).json({ message: 'No autorizado.' });
    const canView =
      rol === 'directivo' ||
      rol === 'admin-general-colegio' ||
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

export default router;
