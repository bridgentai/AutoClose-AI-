import express from 'express';
import { protect, AuthRequest } from '../middleware/auth.js';
import { findGroupByNameAndInstitution } from '../repositories/groupRepository.js';
import { getFirstGroupNameForStudent } from '../repositories/enrollmentRepository.js';
import {
  findGroupScheduleByGroup,
  findProfessorScheduleByProfessor,
  upsertGroupSchedule,
  upsertProfessorSchedule,
} from '../repositories/scheduleRepository.js';

const router = express.Router();

router.get('/my-group', protect, async (req: AuthRequest, res) => {
  try {
    if (req.user?.rol !== 'estudiante') {
      return res.status(403).json({ message: 'Solo estudiantes pueden consultar su horario.' });
    }
    const colegioId = req.user?.colegioId;
    const userId = req.user?.id;
    if (!colegioId || !userId) return res.status(401).json({ message: 'No autorizado.' });

    const grupoNombre = req.user?.curso ?? (await getFirstGroupNameForStudent(userId)) ?? '';
    if (!grupoNombre) return res.json({ grupoNombre: '', slots: {} });

    const group = await findGroupByNameAndInstitution(colegioId, grupoNombre.toUpperCase().trim());
    if (!group) return res.json({ grupoNombre, slots: {} });

    const schedule = await findGroupScheduleByGroup(colegioId, group.id);
    const slots = schedule?.slots ?? {};
    return res.json({ grupoNombre: group.name, slots });
  } catch (e: unknown) {
    console.error('Error GET schedule/my-group:', e);
    return res.status(500).json({ message: (e as Error).message || 'Error al cargar horario.' });
  }
});

router.get('/group/:grupoId', protect, async (req: AuthRequest, res) => {
  try {
    const { grupoId } = req.params;
    const colegioId = req.user?.colegioId;
    if (!colegioId) return res.status(401).json({ message: 'No autorizado.' });

    const group = await findGroupByNameAndInstitution(colegioId, grupoId.toUpperCase().trim());
    if (!group) return res.json({ grupoId, slots: {} });

    const schedule = await findGroupScheduleByGroup(colegioId, group.id);
    return res.json({ grupoId: group.name, slots: schedule?.slots ?? {} });
  } catch (e: unknown) {
    console.error('Error GET schedule/group:', e);
    return res.status(500).json({ message: (e as Error).message || 'Error al cargar horario.' });
  }
});

router.put('/group/:grupoId', protect, async (req: AuthRequest, res) => {
  try {
    const { grupoId } = req.params;
    const { slots } = req.body;
    const colegioId = req.user?.colegioId;
    if (!colegioId) return res.status(401).json({ message: 'No autorizado.' });

    const group = await findGroupByNameAndInstitution(colegioId, grupoId.toUpperCase().trim());
    if (!group) return res.status(404).json({ message: 'Grupo no encontrado.' });

    const safeSlots = typeof slots === 'object' && slots !== null ? slots : {};
    await upsertGroupSchedule(colegioId, group.id, safeSlots);
    return res.json({ success: true });
  } catch (e: unknown) {
    console.error('Error PUT schedule/group:', e);
    return res.status(500).json({ message: (e as Error).message || 'Error al actualizar horario.' });
  }
});

router.get('/my-professor', protect, async (req: AuthRequest, res) => {
  try {
    if (req.user?.rol !== 'profesor') return res.status(403).json({ message: 'Solo profesores pueden consultar su horario.' });
    const colegioId = req.user?.colegioId;
    const userId = req.user?.id;
    if (!colegioId || !userId) return res.status(401).json({ message: 'No autorizado.' });

    const schedule = await findProfessorScheduleByProfessor(colegioId, userId);
    return res.json({ slots: schedule?.slots ?? {} });
  } catch (e: unknown) {
    console.error('Error GET schedule/my-professor:', e);
    return res.status(500).json({ message: (e as Error).message || 'Error al cargar horario.' });
  }
});

router.get('/group-for-attendance/:grupoId', protect, async (req: AuthRequest, res) => {
  try {
    const { grupoId } = req.params;
    const colegioId = req.user?.colegioId;
    if (!colegioId) return res.status(401).json({ message: 'No autorizado.' });

    const group = await findGroupByNameAndInstitution(colegioId, grupoId.toUpperCase().trim());
    if (!group) return res.json({ slots: {} });

    const schedule = await findGroupScheduleByGroup(colegioId, group.id);
    return res.json({ slots: schedule?.slots ?? {} });
  } catch (e: unknown) {
    return res.json({ slots: {} });
  }
});

router.get('/professor/:profesorId', protect, async (req: AuthRequest, res) => {
  try {
    const { profesorId } = req.params;
    const colegioId = req.user?.colegioId;
    if (!colegioId) return res.status(401).json({ message: 'No autorizado.' });

    const schedule = await findProfessorScheduleByProfessor(colegioId, profesorId);
    return res.json({ slots: schedule?.slots ?? {} });
  } catch (e: unknown) {
    return res.json({ slots: {} });
  }
});

router.put('/professor/:profesorId', protect, async (req: AuthRequest, res) => {
  try {
    const { profesorId } = req.params;
    const { slots } = req.body;
    const colegioId = req.user?.colegioId;
    if (!colegioId) return res.status(401).json({ message: 'No autorizado.' });

    const safeSlots = typeof slots === 'object' && slots !== null ? slots : {};
    await upsertProfessorSchedule(colegioId, profesorId, safeSlots);
    return res.json({ success: true });
  } catch (e: unknown) {
    return res.status(500).json({ message: (e as Error).message || 'Error al actualizar horario.' });
  }
});

export default router;
