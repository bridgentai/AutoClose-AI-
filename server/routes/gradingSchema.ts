import express from 'express';
import { Types } from 'mongoose';
import {
  GradingSchemaModel,
  Category,
  Course,
} from '../models';
import { protect, AuthRequest } from '../middleware/auth';
import { normalizeIdForQuery } from '../utils/idGenerator';

const router = express.Router();

/**
 * POST /api/grading-schemas
 * Body: { courseId, nombre? }
 * Creates an active grading schema for a course (one active per course).
 */
router.post('/', protect, async (req: AuthRequest, res) => {
  try {
    const { courseId, nombre } = req.body;
    const userId = req.user?.id;
    const colegioId = req.user?.colegioId;
    if (!userId || !colegioId) {
      return res.status(401).json({ message: 'No autorizado.' });
    }
    if (!courseId) {
      return res.status(400).json({ message: 'courseId es requerido.' });
    }

    const normalizedCourseId = normalizeIdForQuery(courseId);
    const course = await Course.findOne({
      _id: normalizedCourseId,
      colegioId,
      $or: [{ profesorIds: normalizeIdForQuery(userId) }, { profesorId: normalizeIdForQuery(userId) }],
    }).lean();
    if (!course) {
      return res.status(403).json({ message: 'No tienes acceso a este curso.' });
    }

    const existing = await GradingSchemaModel.findOne({
      courseId: normalizedCourseId,
      colegioId,
      isActive: true,
    }).lean();
    if (existing) {
      return res.status(200).json(existing);
    }

    const schema = await GradingSchemaModel.create({
      courseId: normalizedCourseId,
      colegioId,
      nombre: nombre ?? undefined,
      version: 1,
      isActive: true,
    });
    await Course.findByIdAndUpdate(normalizedCourseId, {
      $set: { gradingSchemaId: schema._id },
    });
    return res.status(201).json(schema);
  } catch (e: unknown) {
    console.error('Error al crear grading schema:', e);
    return res.status(500).json({ message: 'Error al crear esquema de calificación.' });
  }
});

/**
 * GET /api/grading-schemas/:id
 */
router.get('/:id', protect, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const colegioId = req.user?.colegioId;
    if (!colegioId) return res.status(401).json({ message: 'No autorizado.' });

    const schema = await GradingSchemaModel.findOne({
      _id: normalizeIdForQuery(id),
      colegioId,
    })
      .lean();
    if (!schema) return res.status(404).json({ message: 'Esquema no encontrado.' });
    return res.json(schema);
  } catch (e: unknown) {
    console.error('Error al obtener grading schema:', e);
    return res.status(500).json({ message: 'Error al obtener esquema.' });
  }
});

/**
 * GET /api/grading-schemas/:id/categories
 */
router.get('/:id/categories', protect, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const colegioId = req.user?.colegioId;
    if (!colegioId) return res.status(401).json({ message: 'No autorizado.' });

    const schema = await GradingSchemaModel.findOne({
      _id: normalizeIdForQuery(id),
      colegioId,
    }).lean();
    if (!schema) return res.status(404).json({ message: 'Esquema no encontrado.' });

    const categories = await Category.find({
      gradingSchemaId: schema._id,
      colegioId,
    })
      .sort({ orden: 1, createdAt: 1 })
      .lean();
    const totalWeight = categories.reduce((s, c) => s + (c.weight ?? 0), 0);
    return res.json({
      categories,
      totalWeight,
      complete: Math.abs(totalWeight - 100) < 0.01,
    });
  } catch (e: unknown) {
    console.error('Error al listar categorías:', e);
    return res.status(500).json({ message: 'Error al listar categorías.' });
  }
});

/**
 * POST /api/grading-schemas/:id/categories
 * Body: { nombre, weight, orden?, evaluationType?, riskImpactMultiplier? }
 * Validates that category weights sum <= 100%.
 */
router.post('/:id/categories', protect, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { nombre, weight, orden, evaluationType, riskImpactMultiplier } = req.body;
    const colegioId = req.user?.colegioId;
    const userId = req.user?.id;
    if (!colegioId || !userId) return res.status(401).json({ message: 'No autorizado.' });
    if (!nombre || weight === undefined) {
      return res.status(400).json({ message: 'nombre y weight son requeridos.' });
    }

    const schema = await GradingSchemaModel.findOne({
      _id: normalizeIdForQuery(id),
      colegioId,
    }).lean();
    if (!schema) return res.status(404).json({ message: 'Esquema no encontrado.' });

    const w = Number(weight);
    if (Number.isNaN(w) || w < 0 || w > 100) {
      return res.status(400).json({ message: 'weight debe estar entre 0 y 100.' });
    }

    const existing = await Category.find({
      gradingSchemaId: schema._id,
      colegioId,
    }).lean();
    const totalActual = existing.reduce((s, c) => s + (c.weight ?? 0), 0);
    if (totalActual + w > 100.01) {
      return res.status(400).json({
        message: `Los pesos deben sumar 100%. Actual: ${totalActual.toFixed(0)}%, nuevo total sería ${(totalActual + w).toFixed(0)}%.`,
        totalActual: Math.round(totalActual),
        disponible: Math.round(100 - totalActual),
      });
    }

    const category = await Category.create({
      gradingSchemaId: schema._id,
      nombre: String(nombre).trim(),
      weight: w,
      orden: orden != null ? Number(orden) : existing.length,
      evaluationType: evaluationType ?? 'summative',
      riskImpactMultiplier: riskImpactMultiplier != null ? Number(riskImpactMultiplier) : 1,
      colegioId,
    });
    return res.status(201).json(category);
  } catch (e: unknown) {
    console.error('Error al crear categoría:', e);
    return res.status(500).json({ message: 'Error al crear categoría.' });
  }
});

/**
 * PUT /api/grading-schemas/:id/categories/:categoryId
 */
router.put('/:id/categories/:categoryId', protect, async (req: AuthRequest, res) => {
  try {
    const { id, categoryId } = req.params;
    const { nombre, weight, orden, evaluationType, riskImpactMultiplier } = req.body;
    const colegioId = req.user?.colegioId;
    if (!colegioId) return res.status(401).json({ message: 'No autorizado.' });

    const schema = await GradingSchemaModel.findOne({
      _id: normalizeIdForQuery(id),
      colegioId,
    }).lean();
    if (!schema) return res.status(404).json({ message: 'Esquema no encontrado.' });

    const category = await Category.findOne({
      _id: normalizeIdForQuery(categoryId),
      gradingSchemaId: schema._id,
      colegioId,
    }).lean();
    if (!category) return res.status(404).json({ message: 'Categoría no encontrada.' });

    const updates: Record<string, unknown> = {};
    if (nombre !== undefined) updates.nombre = String(nombre).trim();
    if (orden !== undefined) updates.orden = Number(orden);
    if (evaluationType !== undefined) updates.evaluationType = evaluationType;
    if (riskImpactMultiplier !== undefined) updates.riskImpactMultiplier = Number(riskImpactMultiplier);

    if (weight !== undefined) {
      const w = Number(weight);
      if (Number.isNaN(w) || w < 0 || w > 100) {
        return res.status(400).json({ message: 'weight debe estar entre 0 y 100.' });
      }
      updates.weight = w;
    }

    const others = await Category.find({
      gradingSchemaId: schema._id,
      colegioId,
      _id: { $ne: category._id },
    }).lean();
    const totalOthers = others.reduce((s, c) => s + (c.weight ?? 0), 0);
    const newWeight = (updates.weight as number) ?? category.weight;
    if (totalOthers + newWeight > 100.01) {
      return res.status(400).json({
        message: `Los pesos deben sumar 100%. El nuevo total sería ${(totalOthers + newWeight).toFixed(0)}%.`,
      });
    }

    const updated = await Category.findByIdAndUpdate(
      category._id,
      { $set: updates },
      { new: true }
    ).lean();
    return res.json(updated);
  } catch (e: unknown) {
    console.error('Error al actualizar categoría:', e);
    return res.status(500).json({ message: 'Error al actualizar categoría.' });
  }
});

/**
 * DELETE /api/grading-schemas/:id/categories/:categoryId
 */
router.delete('/:id/categories/:categoryId', protect, async (req: AuthRequest, res) => {
  try {
    const { id, categoryId } = req.params;
    const colegioId = req.user?.colegioId;
    if (!colegioId) return res.status(401).json({ message: 'No autorizado.' });

    const schema = await GradingSchemaModel.findOne({
      _id: normalizeIdForQuery(id),
      colegioId,
    }).lean();
    if (!schema) return res.status(404).json({ message: 'Esquema no encontrado.' });

    const category = await Category.findOne({
      _id: normalizeIdForQuery(categoryId),
      gradingSchemaId: schema._id,
      colegioId,
    });
    if (!category) return res.status(404).json({ message: 'Categoría no encontrada.' });

    await Category.findByIdAndDelete(category._id);
    return res.json({ message: 'Categoría eliminada.' });
  } catch (e: unknown) {
    console.error('Error al eliminar categoría:', e);
    return res.status(500).json({ message: 'Error al eliminar categoría.' });
  }
});

export default router;
