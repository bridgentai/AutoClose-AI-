import express from 'express';
import { Material } from '../models';
import { protect, restrictTo, AuthRequest } from '../middleware/authMiddleware';

const router = express.Router();

// GET /api/materials - Obtener materiales
router.get('/', protect, async (req: AuthRequest, res) => {
  const { colegioId } = req.user!;
  const { cursoId } = req.query;

  try {
    const query: any = { colegioId };
    if (cursoId) {
      query.cursoId = cursoId;
    }

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

// POST /api/materials - Crear material (profesor/directivo)
router.post('/', protect, restrictTo('profesor', 'directivo'), async (req: AuthRequest, res) => {
  const { cursoId, titulo, descripcion, tipo, url, contenido } = req.body;
  const { colegioId, id: uploadedBy } = req.user!;

  try {
    const nuevoMaterial = await Material.create({
      colegioId,
      cursoId,
      titulo,
      descripcion,
      tipo,
      url,
      contenido,
      uploadedBy,
    });

    res.status(201).json(nuevoMaterial);
  } catch (error: any) {
    console.error('Error al crear material:', error.message);
    res.status(500).json({ message: 'Error en el servidor al crear el material.' });
  }
});

// DELETE /api/materials/:id - Eliminar material
router.delete('/:id', protect, restrictTo('profesor', 'directivo'), async (req: AuthRequest, res) => {
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
