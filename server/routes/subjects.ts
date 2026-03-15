import { Router } from 'express';
import { protect, AuthRequest } from '../middleware/auth';
import { findUserById } from '../repositories/userRepository.js';
import { findGroupByNameAndInstitution } from '../repositories/groupRepository.js';
import { getFirstGroupNameForStudent, getFirstGroupForStudent, getAllCourseGroupsForStudent } from '../repositories/enrollmentRepository.js';
import { findGroupSubjectsByGroup, findGroupSubjectsByGroupWithDetails } from '../repositories/groupSubjectRepository.js';
import { findSubjectById } from '../repositories/subjectRepository.js';
import { findAssignmentsByGroupSubject } from '../repositories/assignmentRepository.js';

const router = Router();

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
      nombre: [gs.subject_name, gs.group_name].filter(Boolean).join(' ').trim() || gs.subject_name || '',
      descripcion: gs.subject_description ?? '',
      colorAcento: '',
      icono: '',
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

export default router;
