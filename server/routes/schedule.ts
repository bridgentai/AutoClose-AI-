import express from 'express';
import { protect, AuthRequest } from '../middleware/auth.js';
import { resolveGroupId } from '../utils/resolveLegacyCourse.js';
import { getFirstGroupNameForStudent } from '../repositories/enrollmentRepository.js';
import {
  findGroupScheduleByGroup,
  findProfessorScheduleByProfessor,
  upsertGroupSchedule,
  upsertProfessorSchedule,
} from '../repositories/scheduleRepository.js';
import { findGroupSubjectsByGroupAndTeacher } from '../repositories/groupSubjectRepository.js';

const router = express.Router();

router.get('/my-group', protect, async (req: AuthRequest, res) => {
  try {
    if (req.user?.rol !== 'estudiante') {
      return res.status(403).json({ message: 'Solo estudiantes pueden consultar su horario.' });
    }
    const institutionId = req.user?.institutionId ?? req.user?.colegioId;
    const userId = req.user?.id;
    if (!institutionId || !userId) return res.status(401).json({ message: 'No autorizado.' });

    const grupoNombre = req.user?.curso ?? (await getFirstGroupNameForStudent(userId)) ?? '';
    if (!grupoNombre) return res.json({ grupoNombre: '', slots: {} });

    const resolved = await resolveGroupId(grupoNombre, institutionId);
    if (!resolved) return res.json({ grupoNombre, slots: {} });

    const schedule = await findGroupScheduleByGroup(institutionId, resolved.id);
    const slots = schedule?.slots ?? {};
    return res.json({ grupoNombre: resolved.name, slots });
  } catch (e: unknown) {
    console.error('Error GET schedule/my-group:', e);
    return res.status(500).json({ message: (e as Error).message || 'Error al cargar horario.' });
  }
});

router.get('/group/:grupoId', protect, async (req: AuthRequest, res) => {
  try {
    const grupoId = decodeURIComponent(req.params.grupoId ?? '');
    const institutionId = req.user?.institutionId ?? req.user?.colegioId;
    if (!institutionId) return res.status(401).json({ message: 'No autorizado.' });

    const resolved = await resolveGroupId(grupoId, institutionId);
    if (!resolved) return res.json({ grupoId, slots: {} });

    const schedule = await findGroupScheduleByGroup(institutionId, resolved.id);
    return res.json({ grupoId: resolved.name, slots: schedule?.slots ?? {} });
  } catch (e: unknown) {
    console.error('Error GET schedule/group:', e);
    return res.status(500).json({ message: (e as Error).message || 'Error al cargar horario.' });
  }
});

router.put('/group/:grupoId', protect, async (req: AuthRequest, res) => {
  try {
    const grupoId = decodeURIComponent(req.params.grupoId ?? '');
    const { slots } = req.body;
    const institutionId = req.user?.institutionId ?? req.user?.colegioId;
    if (!institutionId) return res.status(401).json({ message: 'No autorizado.' });

    const resolved = await resolveGroupId(grupoId, institutionId);
    if (!resolved) return res.status(404).json({ message: 'Grupo no encontrado.' });

    const safeSlots = typeof slots === 'object' && slots !== null ? slots : {};
    await upsertGroupSchedule(institutionId, resolved.id, safeSlots);
    return res.json({ success: true });
  } catch (e: unknown) {
    console.error('Error PUT schedule/group:', e);
    return res.status(500).json({ message: (e as Error).message || 'Error al actualizar horario.' });
  }
});

router.get('/my-professor', protect, async (req: AuthRequest, res) => {
  try {
    if (req.user?.rol !== 'profesor') return res.status(403).json({ message: 'Solo profesores pueden consultar su horario.' });
    const institutionId = req.user?.institutionId ?? req.user?.colegioId;
    const userId = req.user?.id;
    if (!institutionId || !userId) return res.status(401).json({ message: 'No autorizado.' });

    const schedule = await findProfessorScheduleByProfessor(institutionId, userId);
    return res.json({ slots: schedule?.slots ?? {} });
  } catch (e: unknown) {
    console.error('Error GET schedule/my-professor:', e);
    return res.status(500).json({ message: (e as Error).message || 'Error al cargar horario.' });
  }
});

router.get('/group-for-attendance/:grupoId', protect, async (req: AuthRequest, res) => {
  try {
    const grupoId = decodeURIComponent(req.params.grupoId ?? '');
    const institutionId = req.user?.institutionId ?? req.user?.colegioId;
    if (!institutionId) return res.status(401).json({ message: 'No autorizado.' });

    const resolved = await resolveGroupId(grupoId, institutionId);
    if (!resolved) return res.json({ slots: {} });

    const schedule = await findGroupScheduleByGroup(institutionId, resolved.id);
    return res.json({ grupoId: resolved.id, grupoNombre: resolved.name, slots: schedule?.slots ?? {} });
  } catch (e: unknown) {
    return res.json({ slots: {} });
  }
});

router.get('/professor/:profesorId', protect, async (req: AuthRequest, res) => {
  try {
    const { profesorId } = req.params;
    const institutionId = req.user?.institutionId ?? req.user?.colegioId;
    if (!institutionId) return res.status(401).json({ message: 'No autorizado.' });

    const schedule = await findProfessorScheduleByProfessor(institutionId, profesorId);
    return res.json({ slots: schedule?.slots ?? {} });
  } catch (e: unknown) {
    return res.json({ slots: {} });
  }
});

router.put('/professor/:profesorId', protect, async (req: AuthRequest, res) => {
  try {
    const { profesorId } = req.params;
    const { slots } = req.body;
    const institutionId = req.user?.institutionId ?? req.user?.colegioId;
    if (!institutionId) return res.status(401).json({ message: 'No autorizado.' });

    const safeSlots = typeof slots === 'object' && slots !== null ? slots : {};
    await upsertProfessorSchedule(institutionId, profesorId, safeSlots);

    // Sincronizar horario del profesor → horario de cada curso: al asignar un grupo a un slot,
    // ese curso (grupo) queda con esa materia/profesor en ese slot en su horario.
    for (const [slotKey, groupId] of Object.entries(safeSlots)) {
      const groupIdStr = typeof groupId === 'string' ? groupId.trim() : '';
      if (!groupIdStr) continue;
      const resolved = await resolveGroupId(groupIdStr, institutionId);
      if (!resolved) continue;
      const gsList = await findGroupSubjectsByGroupAndTeacher(resolved.id, profesorId, institutionId);
      if (gsList.length === 0) continue;
      const groupSubjectId = gsList[0].id;
      const existing = await findGroupScheduleByGroup(institutionId, resolved.id);
      const existingSlots = (existing?.slots && typeof existing.slots === 'object') ? existing.slots : {};
      const merged = { ...existingSlots, [slotKey]: groupSubjectId };
      await upsertGroupSchedule(institutionId, resolved.id, merged);
    }

    return res.json({ success: true });
  } catch (e: unknown) {
    return res.status(500).json({ message: (e as Error).message || 'Error al actualizar horario.' });
  }
});

export default router;
