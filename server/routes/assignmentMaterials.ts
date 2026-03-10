import express from 'express';
import { protect, AuthRequest } from '../middleware/auth.js';
import { findAssignmentMaterialsByAssignment, createAssignmentMaterial } from '../repositories/assignmentMaterialRepository.js';
import { findAssignmentById } from '../repositories/assignmentRepository.js';
import { findGroupSubjectById } from '../repositories/groupSubjectRepository.js';

const router = express.Router();

function toMaterialApi(row: { id: string; assignment_id: string; type: string; url: string; file_name: string | null; mime_type: string | null; uploaded_at: string }) {
  return {
    _id: row.id,
    assignmentId: row.assignment_id,
    type: row.type,
    url: row.url,
    fileName: row.file_name ?? undefined,
    mimeType: row.mime_type ?? undefined,
    uploadedAt: row.uploaded_at,
  };
}

router.get('/', protect, async (req: AuthRequest, res) => {
  try {
    const assignmentId = req.query.assignmentId as string;
    if (!assignmentId) return res.status(400).json({ message: 'assignmentId es requerido.' });

    const assignment = await findAssignmentById(assignmentId);
    if (!assignment) return res.json([]);

    const gs = await findGroupSubjectById(assignment.group_subject_id);
    const colegioId = req.user?.colegioId;
    if (colegioId && gs?.institution_id !== colegioId) return res.status(403).json({ message: 'No autorizado.' });

    const rows = await findAssignmentMaterialsByAssignment(assignmentId);
    return res.json(rows.map((r) => ({
      _id: r.id,
      assignmentId: r.assignment_id,
      type: r.type,
      url: r.url,
      fileName: r.file_name ?? undefined,
      mimeType: r.mime_type ?? undefined,
      uploadedAt: r.uploaded_at,
    })));
  } catch (err: unknown) {
    return res.status(500).json({ message: (err as Error).message || 'Error al listar materiales.' });
  }
});

router.post('/', protect, async (req: AuthRequest, res) => {
  try {
    const { assignmentId, type, url, fileName, mimeType } = req.body;
    if (!assignmentId || !type || !url) {
      return res.status(400).json({ message: 'assignmentId, type y url son requeridos.' });
    }
    if (!['file', 'link', 'gdoc'].includes(type)) {
      return res.status(400).json({ message: 'type debe ser file, link o gdoc.' });
    }

    const assignment = await findAssignmentById(assignmentId);
    if (!assignment) return res.status(404).json({ message: 'Tarea no encontrada.' });

    const gs = await findGroupSubjectById(assignment.group_subject_id);
    const colegioId = req.user?.colegioId;
    if (colegioId && gs?.institution_id !== colegioId) return res.status(403).json({ message: 'No autorizado.' });

    const row = await createAssignmentMaterial({
      assignment_id: assignmentId,
      type,
      url: String(url),
      file_name: fileName ?? null,
      mime_type: mimeType ?? null,
    });
    return res.status(201).json({
      id: row.id,
      assignmentId: row.assignment_id,
      type: row.type,
      url: row.url,
    });
  } catch (err: unknown) {
    return res.status(500).json({ message: (err as Error).message || 'Error al crear material.' });
  }
});

export default router;
