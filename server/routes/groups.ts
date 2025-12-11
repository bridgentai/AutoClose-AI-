import express from 'express';
import { Group } from '../models/Group';
import { protect, AuthRequest } from '../middleware/auth';

const router = express.Router();

// Grupos fijos predefinidos
const GRUPOS_FIJOS = [
  { _id: '9A', nombre: '9A' },
  { _id: '9B', nombre: '9B' },
  { _id: '10A', nombre: '10A' },
  { _id: '10B', nombre: '10B' },
  { _id: '11C', nombre: '11C' },
  { _id: '11D', nombre: '11D' },
  { _id: '11H', nombre: '11H' },
  { _id: '12C', nombre: '12C' },
  { _id: '12D', nombre: '12D' },
  { _id: '12H', nombre: '12H' },
];

// Seed: Crear grupos fijos si no existen
export async function seedGroups(colegioId: string = 'COLEGIO_DEMO_2025') {
  try {
    for (const grupo of GRUPOS_FIJOS) {
      await Group.findByIdAndUpdate(
        grupo._id,
        { ...grupo, colegioId },
        { upsert: true, new: true }
      );
    }
    console.log('✅ Grupos fijos creados/actualizados');
  } catch (error) {
    console.error('❌ Error al crear grupos fijos:', error);
  }
}

// GET /api/groups/all - Obtener todos los grupos
router.get('/all', protect, async (req: AuthRequest, res) => {
  try {
    const colegioId = req.user?.colegioId || 'COLEGIO_DEMO_2025';
    
    // Buscar grupos del colegio
    let groups = await Group.find({ colegioId }).select('_id nombre').lean();
    
    // Si no hay grupos, intentar crearlos
    if (groups.length === 0) {
      await seedGroups(colegioId);
      groups = await Group.find({ colegioId }).select('_id nombre').lean();
    }
    
    res.json(groups);
  } catch (error) {
    console.error('Error al obtener grupos:', error);
    res.status(500).json({ message: 'Error interno del servidor.' });
  }
});

// GET /api/groups/:id - Obtener un grupo por ID
router.get('/:id', protect, async (req: AuthRequest, res) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) {
      return res.status(404).json({ message: 'Grupo no encontrado.' });
    }
    res.json(group);
  } catch (error) {
    console.error('Error al obtener grupo:', error);
    res.status(500).json({ message: 'Error interno del servidor.' });
  }
});

export default router;
