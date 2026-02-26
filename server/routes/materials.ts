import express from 'express';
import { Material, Assignment } from '../models';
import { protect, restrictTo, AuthRequest } from '../middleware/authMiddleware';
import { Types } from 'mongoose';

const router = express.Router();

// GET /api/materials - Obtener materiales (cursoId, assignmentId opcionales)
router.get('/', protect, async (req: AuthRequest, res) => {
  const { colegioId } = req.user!;
  const { cursoId, materiaId, assignmentId } = req.query;

  try {
    const query: Record<string, unknown> = { colegioId };
    if (cursoId) query.cursoId = cursoId;
    if (materiaId) query.materiaId = materiaId;
    if (assignmentId) query.linkedAssignments = assignmentId;

    const materials = await Material.find(query)
      .populate('cursoId', 'nombre')
      .populate('uploadedBy', 'nombre')
      .sort({ createdAt: -1 });

    res.json(materials);
  } catch (error: any) {
    console.error('Error al obtener materiales:', error.message);
    res.status(500).json({ message: 'Error en el servidor al cargar los materiales.' });
  }
});

// POST /api/materials - Crear material (profesor/directivo). Opcional: assignmentId para crear y vincular a una tarea.
router.post('/', protect, restrictTo('profesor', 'directivo', 'school_admin', 'super_admin'), async (req: AuthRequest, res) => {
  const { cursoId, materiaId, titulo, descripcion, tipo, url, contenido, files, documentId, linkedAssignments, assignmentId } = req.body;
  const { colegioId, id: uploadedBy } = req.user!;

  try {
    let finalCursoId = cursoId;
    let finalMateriaId = materiaId;
    let finalLinked = Array.isArray(linkedAssignments) ? linkedAssignments : [];

    if (assignmentId) {
      const assignment = await Assignment.findById(assignmentId).select('cursoId courseId materiaId').lean();
      if (!assignment) return res.status(400).json({ message: 'Asignación no encontrada.' });
      const cid = (assignment as any).courseId ?? (assignment as any).cursoId ?? (assignment as any).materiaId;
      const mid = (assignment as any).materiaId ?? cid;
      finalCursoId = (assignment as any).cursoId ?? cid;
      finalMateriaId = mid;
      finalLinked = [new Types.ObjectId(assignmentId)];
    }

    if (!finalCursoId || !finalMateriaId) {
      return res.status(400).json({ message: 'cursoId y materiaId son obligatorios (o proporciona assignmentId).' });
    }
    if (!titulo || typeof titulo !== 'string' || !titulo.trim()) {
      return res.status(400).json({ message: 'titulo es obligatorio.' });
    }

    const nuevoMaterial = await Material.create({
      titulo: titulo.trim(),
      tipo: tipo || 'otro',
      url: url || '',
      cursoId: finalCursoId,
      materiaId: finalMateriaId,
      files: Array.isArray(files) ? files : [],
      documentId: documentId || undefined,
      linkedAssignments: finalLinked,
      colegioId,
      descripcion,
      contenido,
      uploadedBy,
    });

    res.status(201).json(nuevoMaterial);
  } catch (error: any) {
    console.error('Error al crear material:', error.message);
    res.status(500).json({ message: 'Error en el servidor al crear el material.' });
  }
});

// PATCH /api/materials/:id - Actualizar material (linkedAssignments, etc.)
router.patch('/:id', protect, restrictTo('profesor', 'directivo', 'school_admin', 'super_admin'), async (req: AuthRequest, res) => {
  const { id } = req.params;
  const { titulo, descripcion, tipo, url, contenido, files, documentId, linkedAssignments } = req.body;

  try {
    const material = await Material.findById(id);
    if (!material) return res.status(404).json({ message: 'Material no encontrado.' });

    if (titulo !== undefined) material.titulo = titulo;
    if (descripcion !== undefined) material.descripcion = descripcion;
    if (tipo !== undefined) material.tipo = tipo;
    if (url !== undefined) material.url = url;
    if (contenido !== undefined) material.contenido = contenido;
    if (Array.isArray(files)) material.files = files;
    if (documentId !== undefined) material.documentId = documentId;
    if (Array.isArray(linkedAssignments)) material.linkedAssignments = linkedAssignments;

    await material.save();
    return res.json(material);
  } catch (error: any) {
    console.error('Error al actualizar material:', error.message);
    res.status(500).json({ message: 'Error en el servidor.' });
  }
});

// DELETE /api/materials/:id - Eliminar material
// ⚠️ SEGURIDAD: super_admin puede eliminar materiales de cualquier colegio
router.delete('/:id', protect, restrictTo('profesor', 'directivo', 'school_admin', 'super_admin'), async (req: AuthRequest, res) => {
  const { id } = req.params;

  try {
    const material = await Material.findByIdAndDelete(id);

    if (!material) {
      return res.status(404).json({ message: 'Material no encontrado.' });
    }

    res.json({ message: 'Material eliminado exitosamente.' });
  } catch (error: any) {
    console.error('Error al eliminar material:', error.message);
    res.status(500).json({ message: 'Error en el servidor.' });
  }
});

export default router;
