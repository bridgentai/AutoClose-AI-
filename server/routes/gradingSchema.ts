import express from 'express';
import { protect, AuthRequest } from '../middleware/auth.js';
import { findGradingSchemaById, findGradingSchemaByGroupSubject } from '../repositories/gradingSchemaRepository.js';
import { findGradingCategoriesBySchema } from '../repositories/gradingCategoryRepository.js';
import { findGradingOutcomesBySchema } from '../repositories/gradingOutcomeRepository.js';
import { findGroupSubjectById } from '../repositories/groupSubjectRepository.js';
import { resolveGroupSubjectId } from '../utils/resolveLegacyCourse.js';
import { queryPg } from '../config/db-pg.js';

const router = express.Router();

// courseId en body = group_subject_id (UUID) o nombre/legacy; creamos schema por group_id
router.post('/', protect, async (req: AuthRequest, res) => {
  try {
    const { courseId, nombre } = req.body;
    const userId = req.user?.id;
    const institutionId = req.user?.institutionId ?? req.user?.colegioId;
    if (!userId || !institutionId) return res.status(401).json({ message: 'No autorizado.' });
    if (!courseId) return res.status(400).json({ message: 'courseId es requerido.' });

    const gsId = await resolveGroupSubjectId(String(courseId).trim(), institutionId);
    if (!gsId) return res.status(404).json({ message: 'Curso no encontrado.' });
    const gs = await findGroupSubjectById(gsId);
    if (!gs || gs.teacher_id !== userId) {
      return res.status(403).json({ message: 'No tienes acceso a este curso.' });
    }

    const existing = await findGradingSchemaByGroupSubject(gsId, gs.institution_id);
    if (existing) return res.status(200).json({ id: existing.id, group_id: existing.group_id, name: existing.name, version: existing.version, is_active: existing.is_active });

    const r = await queryPg(
      'INSERT INTO grading_schemas (group_id, group_subject_id, institution_id, name, version, is_active) VALUES ($1, $2, $3, $4, 1, true) RETURNING *',
      [gs.group_id, gsId, gs.institution_id, nombre ?? null]
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
    const { name, weight, sort_order, evaluation_type, grading_outcome_id, outcomeId } = req.body as {
      name?: string;
      weight?: number;
      sort_order?: number;
      evaluation_type?: string;
      grading_outcome_id?: string;
      outcomeId?: string;
    };
    const colegioId = req.user?.colegioId;
    if (!colegioId) return res.status(401).json({ message: 'No autorizado.' });

    const schema = await findGradingSchemaById(id);
    if (!schema || schema.institution_id !== colegioId) return res.status(404).json({ message: 'Esquema no encontrado.' });

    let outcomeUuid = (grading_outcome_id ?? outcomeId) as string | undefined;
    if (outcomeUuid) {
      const o = await queryPg(`SELECT id FROM grading_outcomes WHERE id = $1 AND grading_schema_id = $2`, [
        outcomeUuid,
        id,
      ]);
      if (!o.rows[0]) return res.status(400).json({ message: 'Logro (outcome) no válido para este esquema.' });
    } else {
      const outs = await findGradingOutcomesBySchema(id);
      if (outs[0]?.id) {
        outcomeUuid = outs[0].id;
      } else {
        const ins = await queryPg(
          `INSERT INTO grading_outcomes (grading_schema_id, institution_id, description, weight, sort_order)
           VALUES ($1, $2, '', 100, 0) RETURNING id`,
          [id, colegioId]
        );
        outcomeUuid = ins.rows[0]?.id as string | undefined;
      }
    }
    if (!outcomeUuid) return res.status(500).json({ message: 'No se pudo asociar el indicador a un logro.' });

    const r = await queryPg(
      `INSERT INTO grading_categories (grading_schema_id, institution_id, grading_outcome_id, name, weight, sort_order, evaluation_type, risk_impact_multiplier)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 1) RETURNING *`,
      [
        id,
        colegioId,
        outcomeUuid,
        name ?? 'Categoría',
        weight ?? 100,
        sort_order ?? 0,
        evaluation_type ?? 'summative',
      ]
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
