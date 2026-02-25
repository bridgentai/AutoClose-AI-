import express from 'express';
import { Types } from 'mongoose';
import { GradeEvent, Assignment, Course, User } from '../models';
import { protect, AuthRequest } from '../middleware/auth';
import { normalizeIdForQuery } from '../utils/idGenerator';
import { enqueueRecalculateStudentCourse } from '../services/grading/recalculation';

const router = express.Router();

const DEFAULT_MAX_SCORE = 100;

/**
 * POST /api/grade-events
 * Body: { assignmentId, studentId, score, maxScore? }
 * Creates or updates GradeEvent, optionally updates submission.calificacion, enqueues recalc.
 */
router.post('/', protect, async (req: AuthRequest, res) => {
  try {
    const { assignmentId, studentId, score, maxScore } = req.body;
    const userId = req.user?.id;
    const colegioId = req.user?.colegioId;
    if (!userId || !colegioId) {
      return res.status(401).json({ message: 'No autorizado.' });
    }

    if (!assignmentId || !studentId || score === undefined) {
      return res.status(400).json({
        message: 'Faltan campos obligatorios: assignmentId, studentId, score.',
      });
    }

    const user = await User.findById(normalizeIdForQuery(userId));
    if (!user || user.rol !== 'profesor') {
      return res.status(403).json({ message: 'Solo los profesores pueden registrar calificaciones.' });
    }

    const assignment = await Assignment.findById(normalizeIdForQuery(assignmentId)).lean();
    if (!assignment) {
      return res.status(404).json({ message: 'Asignación no encontrada.' });
    }
    if (assignment.profesorId.toString() !== normalizeIdForQuery(userId)) {
      return res.status(403).json({ message: 'Solo el profesor creador puede calificar.' });
    }
    if (assignment.colegioId !== colegioId) {
      return res.status(403).json({ message: 'No autorizado para este colegio.' });
    }

    const courseId = assignment.courseId ?? assignment.materiaId;
    if (!courseId) {
      return res.status(400).json({ message: 'La asignación no tiene curso asociado.' });
    }

    const categoryId = assignment.categoryId ?? assignment.logroCalificacionId;
    if (!categoryId) {
      return res.status(400).json({
        message: 'La asignación debe tener una categoría (categoryId o logroCalificacionId).',
      });
    }

    const max = maxScore ?? assignment.maxScore ?? DEFAULT_MAX_SCORE;
    const numScore = Number(score);
    if (Number.isNaN(numScore) || numScore < 0 || numScore > max) {
      return res.status(400).json({
        message: `La calificación debe estar entre 0 y ${max}.`,
      });
    }

    const normalizedScore = max > 0 ? (numScore / max) * 100 : 0;
    const normalizedStudentId = new Types.ObjectId(studentId);
    const normalizedCourseId = new Types.ObjectId(courseId);
    const normalizedCategoryId = new Types.ObjectId(categoryId);
    const normalizedAssignmentId = new Types.ObjectId(assignmentId);
    const recordedBy = new Types.ObjectId(userId);

    const event = await GradeEvent.findOneAndUpdate(
      {
        studentId: normalizedStudentId,
        courseId: normalizedCourseId,
        assignmentId: normalizedAssignmentId,
        colegioId,
      },
      {
        $set: {
          categoryId: normalizedCategoryId,
          score: numScore,
          maxScore: max,
          normalizedScore: Math.round(normalizedScore * 100) / 100,
          recordedAt: new Date(),
          recordedBy,
        },
      },
      { upsert: true, new: true }
    ).lean();

    await Assignment.updateOne(
      {
        _id: normalizedAssignmentId,
        'submissions.estudianteId': normalizedStudentId,
      },
      { $set: { 'submissions.$.calificacion': numScore } }
    );

    enqueueRecalculateStudentCourse(studentId, courseId.toString());

    return res.status(200).json({
      gradeEvent: event,
      message: 'Calificación registrada. Recalculando promedios en segundo plano.',
    });
  } catch (e: unknown) {
    console.error('Error en POST /api/grade-events:', e);
    return res.status(500).json({ message: 'Error al registrar la calificación.' });
  }
});

export default router;
