import express, { Router } from 'express';
import { protect, AuthRequest } from '../middleware/auth.js';
import { requireRole } from '../middleware/roleAuth.js';
import { findUserById } from '../repositories/userRepository.js';
import { findGroupByNameAndInstitution } from '../repositories/groupRepository.js';
import { getFirstGroupNameForStudent, getFirstGroupForStudent, getAllCourseGroupsForStudent } from '../repositories/enrollmentRepository.js';
import { findGroupSubjectsByGroup, findGroupSubjectsByGroupWithDetails, findGroupSubjectsBySubjectIdWithDetails } from '../repositories/groupSubjectRepository.js';
import { findSubjectById, findSubjectsByInstitution, createSubject } from '../repositories/subjectRepository.js';
import { findAssignmentsByGroupSubject } from '../repositories/assignmentRepository.js';

const router = Router();

// Handler exportado para poder registrar GET /api/subjects explícitamente en routes.ts si hace falta.
export async function listSubjectsHandler(req: AuthRequest, res: express.Response): Promise<void> {
  try {
    const institutionId = req.user?.colegioId ?? req.user?.institution_id;
    if (!institutionId) {
      res.status(401).json({ message: 'No autorizado.' });
      return;
    }
    const subjects = await findSubjectsByInstitution(institutionId);
    const result = await Promise.all(
      subjects.map(async (s) => {
        const gsList = await findGroupSubjectsBySubjectIdWithDetails(s.id, institutionId);
        const cursos = gsList.map((gs) => ({
          groupName: gs.group_name,
          teacherId: gs.teacher_id,
          teacherName: gs.teacher_name,
          groupSubjectId: gs.id,
        }));
        return {
          id: s.id,
          _id: s.id,
          nombre: s.name,
          descripcion: s.description,
          area: s.area,
          cursos,
        };
      })
    );
    res.json(result);
  } catch (e: unknown) {
    console.error('Error GET /api/subjects:', e);
    res.status(500).json({ message: (e as Error).message || 'Error al listar materias.' });
  }
}

// GET /api/subjects - Listar materias del colegio (admin). Con cursos vinculados y profesor por cada uno.
router.get('/', protect, requireRole('admin-general-colegio', 'school_admin'), listSubjectsHandler);

// POST /api/subjects - Crear nueva materia (admin).
router.post('/', protect, requireRole('admin-general-colegio', 'school_admin'), async (req: AuthRequest, res) => {
  try {
    const institutionId = req.user?.colegioId ?? req.user?.institution_id;
    if (!institutionId) return res.status(401).json({ message: 'No autorizado.' });
    const { nombre, descripcion, area } = req.body as { nombre?: string; descripcion?: string; area?: string };
    const name = String(nombre ?? '').trim();
    if (!name) return res.status(400).json({ message: 'El nombre de la materia es obligatorio.' });
    const subject = await createSubject({
      institution_id: institutionId,
      name,
      description: descripcion ?? null,
      area: area ?? null,
    });
    res.status(201).json({
      id: subject.id,
      _id: subject.id,
      nombre: subject.name,
      descripcion: subject.description,
      area: subject.area,
      cursos: [],
    });
  } catch (e: unknown) {
    console.error('Error POST /api/subjects:', e);
    res.status(500).json({ message: (e as Error).message || 'Error al crear la materia.' });
  }
});

// GET /api/subjects/mine - Materias del grupo del estudiante
router.get('/mine', protect, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(404).json({ message: 'Usuario no encontrado' });
    const user = await findUserById(userId);
    if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });
    if (user.role !== 'estudiante') {
      return res.status(403).json({ message: 'Solo estudiantes pueden ver sus materias' });
    }
    let curso = (user.config as { curso?: string })?.curso;
    if (!curso) curso = await getFirstGroupNameForStudent(userId) ?? undefined;
    let group = curso ? await findGroupByNameAndInstitution(user.institution_id, curso.toUpperCase().trim()) : null;
    if (!group) group = await getFirstGroupForStudent(userId, user.institution_id);
    if (!group) return res.json([]);

    const groupSubjects = await findGroupSubjectsByGroupWithDetails(group.id, user.institution_id);
    const formattedSubjects = groupSubjects.map((gs) => ({
      _id: gs.id,
      id: gs.id,
      nombre: (gs.subject_name ?? '').trim() || 'Materia',
      descripcion: gs.subject_description ?? '',
      colorAcento: '',
      icono: gs.icon ?? '',
      profesor: { _id: gs.teacher_id, nombre: gs.teacher_name, email: gs.teacher_email },
      createdAt: gs.created_at,
    }));
    res.json(formattedSubjects);
  } catch (error: unknown) {
    console.error('Error obteniendo materias:', error);
    res.status(500).json({ message: 'Error del servidor' });
  }
});

// GET /api/subjects/:id/overview - Detalle de materia con tareas (id = subject id o group_subject id)
router.get('/:id/overview', protect, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    if (!userId) return res.status(404).json({ message: 'Usuario no encontrado' });
    const user = await findUserById(userId);
    if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });

    const courseGroups = await getAllCourseGroupsForStudent(userId, user.institution_id);
    if (!courseGroups.length) return res.status(403).json({ message: 'No tienes un curso asignado' });

    const allGroupSubjects = (await Promise.all(
      courseGroups.map((g) => findGroupSubjectsByGroup(g.id))
    )).flat();

    const gsRow = allGroupSubjects.find((gs) => gs.subject_id === id || gs.id === id);
    if (!gsRow) return res.status(403).json({ message: 'No tienes acceso a esta materia' });
    const gsId = gsRow.id;

    const subject = await findSubjectById(gsRow.subject_id);
    if (!subject) return res.status(404).json({ message: 'Materia no encontrada' });
    const teacher = await findUserById(gsRow.teacher_id);
    const assignments = await findAssignmentsByGroupSubject(gsId);
    const now = new Date().toISOString();
    const pendingAssignments = assignments.filter((a) => a.due_date > now);
    const pastAssignments = assignments.filter((a) => a.due_date <= now);

    const response = {
      _id: subject?.id ?? id,
      nombre: subject?.name ?? '',
      descripcion: subject?.description ?? '',
      colorAcento: '',
      icono: '',
      profesor: teacher
        ? { _id: teacher.id, nombre: teacher.full_name, email: teacher.email }
        : null,
      assignments: {
        pending: pendingAssignments.map((a) => ({
          _id: a.id,
          titulo: a.title,
          descripcion: a.description,
          fechaEntrega: a.due_date,
          profesorNombre: null,
          createdAt: a.created_at,
        })),
        past: pastAssignments.map((a) => ({
          _id: a.id,
          titulo: a.title,
          descripcion: a.description,
          fechaEntrega: a.due_date,
          profesorNombre: null,
          createdAt: a.created_at,
        })),
      },
      stats: {
        totalAssignments: assignments.length,
        pendingCount: pendingAssignments.length,
        pastCount: pastAssignments.length,
      },
    };
    res.json(response);
  } catch (error: unknown) {
    console.error('Error obteniendo detalle de materia:', error);
    res.status(500).json({ message: 'Error del servidor' });
  }
});

// PATCH /api/subjects/:id — editar nombre/área de una materia (solo admin)
router.patch('/:id', protect, requireRole('admin-general-colegio', 'school_admin'), async (req: AuthRequest, res) => {
  try {
    const institutionId = req.user?.colegioId ?? req.user?.institution_id;
    if (!institutionId) return res.status(401).json({ message: 'No autorizado.' });
    const { id } = req.params;
    const subject = await findSubjectById(id);
    if (!subject || subject.institution_id !== institutionId) {
      return res.status(404).json({ message: 'Materia no encontrada.' });
    }
    const { nombre, area, descripcion } = req.body as { nombre?: string; area?: string; descripcion?: string };
    const { updateSubject } = await import('../repositories/subjectRepository.js');
    const updated = await updateSubject(id, institutionId, {
      name: nombre?.trim() ?? subject.name,
      description: descripcion !== undefined ? (descripcion?.trim() || null) : subject.description,
      area: area !== undefined ? (area?.trim() || null) : subject.area,
    });
    return res.json({ id: updated?.id ?? id, nombre: updated?.name, area: updated?.area, descripcion: updated?.description });
  } catch (e: unknown) {
    console.error('Error PATCH /subjects/:id:', e);
    return res.status(500).json({ message: 'Error al actualizar materia.' });
  }
});

export default router;
