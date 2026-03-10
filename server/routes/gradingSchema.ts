import express from 'express';
import { protect, AuthRequest } from '../middleware/auth.js';
import { findGradingSchemaById, findGradingSchemaByGroup } from '../repositories/gradingSchemaRepository.js';
import { findGradingCategoriesBySchema } from '../repositories/gradingCategoryRepository.js';
import { findGroupSubjectById } from '../repositories/groupSubjectRepository.js';
import { queryPg } from '../config/db-pg.js';

const router = express.Router();

// courseId en body = group_subject_id en PG; creamos schema por group_id
router.post('/', protect, async (req: AuthRequest, res) => {
  try {
    const { courseId, nombre } = req.body;
    const userId = req.user?.id;
    const colegioId = req.user?.colegioId;
    if (!userId || !colegioId) return res.status(401).json({ message: 'No autorizado.' });
    if (!courseId) return res.status(400).json({ message: 'courseId es requerido.' });

    const gs = await findGroupSubjectById(courseId);
    if (!gs || gs.teacher_id !== userId) {
      return res.status(403).json({ message: 'No tienes acceso a este curso.' });
    }

    const existing = await findGradingSchemaByGroup(gs.group_id, gs.institution_id);
    if (existing) return res.status(200).json({ id: existing.id, group_id: existing.group_id, name: existing.name, version: existing.version, is_active: existing.is_active });

    const r = await queryPg(
      'INSERT INTO grading_schemas (group_id, institution_id, name, version, is_active) VALUES ($1, $2, $3, 1, true) RETURNING *',
      [gs.group_id, gs.institution_id, nombre ?? null]
    );
    const row = r.rows[0];
    return res.status(201).json(row);
  } catch (e: unknown) {
    console.error(e);
    return res.status(500).json({ message: 'Error al crear esquema de calificación.' });
  }
});

router.get('/:id', protect, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const colegioId = req.user?.colegioId;
    if (!colegioId) return res.status(401).json({ message: 'No autorizado.' });

    const schema = await findGradingSchemaById(id);
    if (!schema || schema.institution_id !== colegioId) return res.status(404).json({ message: 'Esquema no encontrado.' });
    return res.json(schema);
  } catch (e: unknown) {
    console.error(e);
    return res.status(500).json({ message: 'Error al obtener esquema.' });
  }
});

router.get('/:id/categories', protect, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const colegioId = req.user?.colegioId;
    if (!colegioId) return res.status(401).json({ message: 'No autorizado.' });

    const schema = await findGradingSchemaById(id);
    if (!schema || schema.institution_id !== colegioId) return res.status(404).json({ message: 'Esquema no encontrado.' });
    const categories = await findGradingCategoriesBySchema(id);
    return res.json(categories);
  } catch (e: unknown) {
    console.error(e);
    return res.status(500).json({ message: 'Error al listar categorías.' });
  }
});

router.post('/:id/categories', protect, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { name, weight, sort_order, evaluation_type } = req.body;
    const colegioId = req.user?.colegioId;
    if (!colegioId) return res.status(401).json({ message: 'No autorizado.' });

    const schema = await findGradingSchemaById(id);
    if (!schema || schema.institution_id !== colegioId) return res.status(404).json({ message: 'Esquema no encontrado.' });

    const r = await queryPg(
      `INSERT INTO grading_categories (grading_schema_id, institution_id, name, weight, sort_order, evaluation_type, risk_impact_multiplier)
       VALUES ($1, $2, $3, $4, $5, $6, 1) RETURNING *`,
      [id, colegioId, name ?? 'Categoría', weight ?? 100, sort_order ?? 0, evaluation_type ?? 'summative']
    );
    return res.status(201).json(r.rows[0]);
  } catch (e: unknown) {
    console.error(e);
    return res.status(500).json({ message: 'Error al crear categoría.' });
  }
});

router.put('/:id/categories/:categoryId', protect, async (req: AuthRequest, res) => {
  try {
    const { id, categoryId } = req.params;
    const { name, weight, sort_order } = req.body;
    const colegioId = req.user?.colegioId;
    if (!colegioId) return res.status(401).json({ message: 'No autorizado.' });

    const schema = await findGradingSchemaById(id);
    if (!schema || schema.institution_id !== colegioId) return res.status(404).json({ message: 'Esquema no encontrado.' });

    const sets: string[] = [];
    const values: unknown[] = [];
    let i = 1;
    if (name !== undefined) { sets.push(`name = $${i++}`); values.push(name); }
    if (weight !== undefined) { sets.push(`weight = $${i++}`); values.push(weight); }
    if (sort_order !== undefined) { sets.push(`sort_order = $${i++}`); values.push(sort_order); }
    if (sets.length === 0) {
      const cat = await findGradingCategoriesBySchema(id).then((c) => c.find((x) => x.id === categoryId));
      return res.json(cat ?? null);
    }
    values.push(categoryId);
    const r = await queryPg(
      `UPDATE grading_categories SET ${sets.join(', ')}, updated_at = now() WHERE id = $${i} RETURNING *`,
      values
    );
    return res.json(r.rows[0] ?? null);
  } catch (e: unknown) {
    console.error(e);
    return res.status(500).json({ message: 'Error al actualizar categoría.' });
  }
});

router.delete('/:id/categories/:categoryId', protect, async (req: AuthRequest, res) => {
  try {
    const { id, categoryId } = req.params;
    const colegioId = req.user?.colegioId;
    if (!colegioId) return res.status(401).json({ message: 'No autorizado.' });

    const schema = await findGradingSchemaById(id);
    if (!schema || schema.institution_id !== colegioId) return res.status(404).json({ message: 'Esquema no encontrado.' });

    await queryPg('DELETE FROM grading_categories WHERE id = $1', [categoryId]);
    return res.json({ success: true });
  } catch (e: unknown) {
    console.error(e);
    return res.status(500).json({ message: 'Error al eliminar categoría.' });
  }
});

export default router;
