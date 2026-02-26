import express from 'express';
import { AssignmentMaterial, Assignment } from '../models';
import { protect, AuthRequest } from '../middleware/auth';

const router = express.Router();

// GET /api/assignment-materials?assignmentId=...
router.get('/', protect, async (req: AuthRequest, res) => {
  const { assignmentId } = req.query;
  if (!assignmentId || typeof assignmentId !== 'string') {
    return res.status(400).json({ message: 'assignmentId es requerido.' });
  }
  try {
    const list = await AssignmentMaterial.find({ assignmentId }).sort({ uploadedAt: -1 }).lean();
    return res.json(list);
  } catch (err: any) {
    return res.status(500).json({ message: err.message || 'Error al listar materiales.' });
  }
});

// POST /api/assignment-materials
router.post('/', protect, async (req: AuthRequest, res) => {
  const { assignmentId, type, url, fileName, mimeType } = req.body;
  if (!assignmentId || !type || !url) {
    return res.status(400).json({ message: 'assignmentId, type y url son requeridos.' });
  }
  if (!['file', 'link', 'gdoc'].includes(type)) {
    return res.status(400).json({ message: 'type debe ser file, link o gdoc.' });
  }
  try {
    const assignment = await Assignment.findById(assignmentId).select('colegioId').lean();
    if (!assignment) return res.status(404).json({ message: 'Asignación no encontrada.' });
    const doc = await AssignmentMaterial.create({
      assignmentId,
      type,
      url: String(url).trim(),
      fileName: fileName ? String(fileName) : undefined,
      mimeType: mimeType ? String(mimeType) : undefined,
    });
    return res.status(201).json(doc);
  } catch (err: any) {
    return res.status(500).json({ message: err.message || 'Error al crear material.' });
  }
});

export default router;
