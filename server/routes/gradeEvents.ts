import express from 'express';
import { protect, AuthRequest } from '../middleware/auth.js';
import { findUserById } from '../repositories/userRepository.js';
import { findAssignmentById } from '../repositories/assignmentRepository.js';
import { findGroupSubjectById } from '../repositories/groupSubjectRepository.js';
import { findGradingSchemaByGroup } from '../repositories/gradingSchemaRepository.js';
import { findGradingCategoriesBySchema } from '../repositories/gradingCategoryRepository.js';
import { upsertGrade } from '../repositories/gradeRepository.js';

const router = express.Router();
const DEFAULT_MAX_SCORE = 100;

router.post('/', protect, async (req: AuthRequest, res) => {
  try {
    const { assignmentId, studentId, score, maxScore } = req.body;
    const userId = req.user?.id ?? req.userId;
    const colegioId = req.user?.colegioId;
    if (!userId || !colegioId) return res.status(401).json({ message: 'No autorizado.' });

    if (!assignmentId || !studentId || score === undefined) {
      return res.status(400).json({ message: 'Faltan campos obligatorios: assignmentId, studentId, score.' });
    }

    const user = await findUserById(userId);
    if (!user || user.role !== 'profesor') {
      return res.status(403).json({ message: 'Solo los profesores pueden registrar calificaciones.' });
    }

    const assignment = await findAssignmentById(assignmentId);
    if (!assignment) return res.status(404).json({ message: 'Asignación no encontrada.' });
    if (assignment.created_by !== userId) {
      return res.status(403).json({ message: 'Solo el profesor creador puede calificar.' });
    }

    const gs = await findGroupSubjectById(assignment.group_subject_id);
    if (!gs) return res.status(400).json({ message: 'Curso no encontrado.' });

    let gradingCategoryId = assignment.assignment_category_id;
    if (!gradingCategoryId) {
      const schema = await findGradingSchemaByGroup(gs.group_id, gs.institution_id);
      if (schema) {
        const cats = await findGradingCategoriesBySchema(schema.id);
        gradingCategoryId = cats[0]?.id ?? null;
      }
    }
    if (!gradingCategoryId) {
      return res.status(400).json({ message: 'Configure categoría de calificación para este curso.' });
    }

    const max = maxScore ?? assignment.max_score ?? DEFAULT_MAX_SCORE;
    await upsertGrade({
      assignment_id: assignmentId,
      user_id: studentId,
      group_id: gs.group_id,
      grading_category_id: gradingCategoryId,
      score: Number(score),
      max_score: max,
      recorded_by_id: userId,
    });

    return res.status(201).json({ message: 'Calificación registrada.' });
  } catch (e: unknown) {
    console.error(e);
    return res.status(500).json({ message: 'Error al registrar calificación.' });
  }
});

router.get('/', protect, async (_req: AuthRequest, res) => {
  return res.json([]);
});

export default router;
