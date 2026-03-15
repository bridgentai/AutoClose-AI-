import express from 'express';
import { protect, AuthRequest } from '../middleware/auth.js';
import { findUserById } from '../repositories/userRepository.js';
import { findGroupById, findGroupByNameAndInstitution, findGroupsByInstitution } from '../repositories/groupRepository.js';
import {
  findGroupSubjectsByTeacher,
  findGroupSubjectsByTeacherWithDetails,
  findGroupSubjectsByGroup,
  createGroupSubject,
} from '../repositories/groupSubjectRepository.js';
import { findSubjectById, findSubjectByNameAndInstitution, createSubject } from '../repositories/subjectRepository.js';
import { findEnrollmentsByGroup, createEnrollment } from '../repositories/enrollmentRepository.js';
import { findActiveAcademicPeriodForInstitution } from '../repositories/academicPeriodRepository.js';

const router = express.Router();

// GET /api/professor/assignments/:materiaId - Grupos asignados al profesor para una materia
router.get('/assignments/:materiaId', protect, async (req: AuthRequest, res) => {
  try {
    const { materiaId } = req.params;
    const profesorId = req.user?.id;
    if (!materiaId) return res.status(400).json({ message: 'ID de materia requerido.' });
    const gsList = await findGroupSubjectsByTeacher(profesorId!);
    const forSubject = gsList.filter((gs) => gs.subject_id === materiaId);
    const names: string[] = [];
    for (const gs of forSubject) {
      const g = await findGroupById(gs.group_id);
      if (g && !names.includes(g.name)) names.push(g.name);
    }
    res.json({ grupoIds: names });
  } catch (error: unknown) {
    console.error('Error al obtener asignaciones:', (error as Error).message);
    res.status(500).json({ message: 'Error interno del servidor.' });
  }
});

// POST /api/professor/assign-groups
router.post('/assign-groups', protect, async (req: AuthRequest, res) => {
  try {
    const { materiaId, grupoIds, profesorId } = req.body;
    const userId = req.user?.id;
    const colegioId = req.user?.colegioId;
    if (!userId || !colegioId) return res.status(401).json({ message: 'No autorizado.' });
    if (!grupoIds || !Array.isArray(grupoIds)) return res.status(400).json({ message: 'Lista de grupos requerida.' });
    if (profesorId && profesorId !== userId) return res.status(403).json({ message: 'No autorizado para esta acción.' });
    const profesor = await findUserById(userId);
    if (!profesor || profesor.role !== 'profesor') return res.status(404).json({ message: 'Profesor no encontrado.' });
    const materias = (profesor.config as { materias?: string[] })?.materias;
    const materiaNombre = Array.isArray(materias) && materias.length > 0 ? String(materias[0]).trim() : '';
    if (!materiaNombre) return res.status(400).json({ message: 'El profesor no tiene materia asignada.' });
    const normalizedGroups = grupoIds.map((id: string) => String(id).toUpperCase().trim());
    let subject = await findSubjectByNameAndInstitution(colegioId, materiaNombre);
    if (!subject) subject = await createSubject({ institution_id: colegioId, name: materiaNombre, description: `Materia ${materiaNombre}` });
    const period = await findActiveAcademicPeriodForInstitution(colegioId);
    for (const gName of normalizedGroups) {
      const group = await findGroupByNameAndInstitution(colegioId, gName);
      if (!group) continue;
      try {
        await createGroupSubject({ institution_id: colegioId, group_id: group.id, subject_id: subject.id, teacher_id: userId });
      } catch (_) {}
      // Estudiantes ya enrollados en el grupo vía enrollments (no config.curso)
      const enrollmentsInGroup = await findEnrollmentsByGroup(group.id);
      for (const enrollment of enrollmentsInGroup) {
        try {
          await createEnrollment({
            student_id: enrollment.student_id,
            group_id: group.id,
            academic_period_id: period?.id ?? null,
          });
        } catch (_) {}
      }
      // NO actualizar config.curso
    }
    res.json({
      message: 'Asignación guardada exitosamente.',
      course: { _id: subject.id, nombre: subject.name, grupoIds: normalizedGroups, estudiantesVinculados: 0 },
    });
  } catch (error: unknown) {
    console.error('Error al asignar grupos:', (error as Error).message);
    res.status(500).json({ message: 'Error interno del servidor.' });
  }
});

// GET /api/professor/courses
router.get('/courses', protect, async (req: AuthRequest, res) => {
  try {
    const profesorId = req.user?.id;
    const colegioId = req.user?.colegioId;
    if (!profesorId) return res.status(401).json({ message: 'No autorizado.' });
    const gsList = await findGroupSubjectsByTeacherWithDetails(profesorId, colegioId ?? undefined);
    const bySubject = new Map<string, { subjectId: string; name: string; groupIds: Set<string>; count: number }>();
    for (const gs of gsList) {
      const enrollments = await findEnrollmentsByGroup(gs.group_id);
      if (!bySubject.has(gs.subject_id)) bySubject.set(gs.subject_id, { subjectId: gs.subject_id, name: gs.subject_name, groupIds: new Set(), count: 0 });
      const e = bySubject.get(gs.subject_id)!;
      e.groupIds.add(gs.group_name);
      e.count += enrollments.length;
    }
    const courses = Array.from(bySubject.values()).map((e) => ({
      _id: e.subjectId,
      nombre: e.name,
      grupoIds: Array.from(e.groupIds),
      totalEstudiantes: e.count,
      colorAcento: '',
      icono: '',
    }));
    res.json({ courses, total: courses.length });
  } catch (error: unknown) {
    console.error('Error al obtener cursos del profesor:', (error as Error).message);
    res.status(500).json({ message: 'Error interno del servidor.' });
  }
});

// GET /api/professor/my-groups
router.get('/my-groups', protect, async (req: AuthRequest, res) => {
  try {
    const profesorId = req.user?.id;
    const colegioId = req.user?.colegioId;
    if (!profesorId) return res.status(401).json({ message: 'No autorizado.' });
    const gsList = await findGroupSubjectsByTeacherWithDetails(profesorId, colegioId ?? undefined);
    const groupMap = new Map<string, { groupName: string; subjects: { _id: string; nombre: string; groupName: string; descripcion: string | null; colorAcento: string; icono: string }[]; studentIds: Set<string> }>();
    for (const gs of gsList) {
      const gid = gs.group_id;
      if (!groupMap.has(gid)) groupMap.set(gid, { groupName: gs.group_name ?? '', subjects: [], studentIds: new Set() });
      const entry = groupMap.get(gid)!;
      entry.subjects.push({
        _id: gs.id,
        nombre: [gs.subject_name, gs.group_name].filter(Boolean).join(' ').trim() || gs.subject_name || '',
        groupName: gs.group_name ?? '',
        descripcion: gs.subject_description,
        colorAcento: '',
        icono: '',
      });
      const enrollments = await findEnrollmentsByGroup(gs.group_id);
      enrollments.forEach((e) => entry.studentIds.add(e.student_id));
    }
    const result = Array.from(groupMap.entries()).map(([groupId, data]) => ({
      groupId,
      groupName: data.groupName,
      subjects: data.subjects,
      totalStudents: data.studentIds.size,
    }));
    res.json(result);
  } catch (error: unknown) {
    console.error('Error al obtener grupos del profesor:', (error as Error).message);
    res.status(500).json({ message: 'Error interno del servidor.' });
  }
});

export default router;
