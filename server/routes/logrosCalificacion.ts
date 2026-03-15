import express from 'express';
import { protect, AuthRequest } from '../middleware/auth.js';
import { findGroupSubjectById } from '../repositories/groupSubjectRepository.js';
import { findGradingSchemaByGroupSubject } from '../repositories/gradingSchemaRepository.js';
import { resolveGroupSubjectId } from '../utils/resolveLegacyCourse.js';
import {
  findGradingCategoriesBySchema,
  findGradingCategoryById,
} from '../repositories/gradingCategoryRepository.js';
import { queryPg } from '../config/db-pg.js';

const router = express.Router();

function toLogroFormat(row: { id: string; name: string; weight: number; sort_order: number }) {
  return {
    _id: row.id,
    nombre: row.name,
    porcentaje: Number(row.weight),
    orden: row.sort_order,
  };
}

async function getOrCreateSchemaForCourse(
  courseId: string,
  userId: string,
  colegioId: string
): Promise<{ id: string; group_id: string; institution_id: string } | null> {
  const gsId = await resolveGroupSubjectId(courseId.trim(), colegioId);
  if (!gsId) return null;
  const gs = await findGroupSubjectById(gsId);
  if (!gs || gs.teacher_id !== userId) return null;

  const existing = await findGradingSchemaByGroupSubject(gsId, gs.institution_id);
  if (existing) return existing;

  const r = await queryPg(
    'INSERT INTO grading_schemas (group_id, group_subject_id, institution_id, name, version, is_active) VALUES ($1, $2, $3, $4, 1, true) RETURNING id, group_id, institution_id',
    [gs.group_id, gsId, gs.institution_id, null]
  );
  return r.rows[0] ?? null;
}

// GET /api/logros-calificacion?courseId=... (courseId = group_subject_id o nombre legacy)
router.get('/', protect, async (req: AuthRequest, res) => {
  try {
    const courseIdParam = req.query.courseId as string;
    const colegioId = req.user?.colegioId;
    if (!courseIdParam) return res.status(400).json({ message: 'courseId es requerido.' });
    if (!colegioId) return res.status(401).json({ message: 'No autorizado.' });

    const gsId = await resolveGroupSubjectId(courseIdParam.trim(), colegioId);
    if (!gsId) return res.json({ logros: [], totalPorcentaje: 0, completo: false });
    const gs = await findGroupSubjectById(gsId);
    if (!gs) return res.json({ logros: [], totalPorcentaje: 0, completo: false });

    const schema = await findGradingSchemaByGroupSubject(gsId, gs.institution_id);
    if (!schema) return res.json({ logros: [], totalPorcentaje: 0, completo: false });

    const categories = await findGradingCategoriesBySchema(schema.id);
    const logros = categories.map(toLogroFormat);
    const totalPorcentaje = categories.reduce((s, c) => s + Number(c.weight), 0);
    const completo = Math.abs(totalPorcentaje - 100) < 0.01;

    return res.json({ logros, totalPorcentaje, completo });
  } catch (e: unknown) {
    console.error('Error al listar logros:', e);
    return res.status(500).json({ message: 'Error al listar logros de calificación.' });
  }
});

// POST /api/logros-calificacion
router.post('/', protect, async (req: AuthRequest, res) => {
  try {
    const { nombre, porcentaje, courseId } = req.body;
    const userId = req.user?.id;
    const colegioId = req.user?.colegioId;
    if (!userId || !colegioId) return res.status(401).json({ message: 'No autorizado.' });
    if (!courseId) return res.status(400).json({ message: 'courseId es requerido.' });
    if (!nombre || typeof nombre !== 'string' || !nombre.trim()) {
      return res.status(400).json({ message: 'nombre es requerido.' });
    }
    const weight = typeof porcentaje === 'number' ? porcentaje : parseFloat(String(porcentaje ?? 0));
    if (Number.isNaN(weight) || weight < 0 || weight > 100) {
      return res.status(400).json({ message: 'porcentaje debe estar entre 0 y 100.' });
    }

    const schema = await getOrCreateSchemaForCourse(String(courseId).trim(), userId, colegioId);
    if (!schema) return res.status(403).json({ message: 'No tienes acceso a este curso.' });

    const categories = await findGradingCategoriesBySchema(schema.id);
    const nextSortOrder = categories.length > 0
      ? Math.max(...categories.map((c) => c.sort_order)) + 1
      : 0;

    const r = await queryPg(
      `INSERT INTO grading_categories (grading_schema_id, institution_id, name, weight, sort_order, evaluation_type, risk_impact_multiplier)
       VALUES ($1, $2, $3, $4, $5, 'summative', 1) RETURNING *`,
      [schema.id, schema.institution_id, nombre.trim(), weight, nextSortOrder]
    );
    const row = r.rows[0];
    if (!row) return res.status(500).json({ message: 'Error al crear logro.' });

    return res.status(201).json(toLogroFormat(row));
  } catch (e: unknown) {
    console.error('Error al crear logro:', e);
    return res.status(500).json({ message: 'Error al crear logro de calificación.' });
  }
});

// GET /api/logros-calificacion/:id
router.get('/:id', protect, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const colegioId = req.user?.colegioId;
    if (!colegioId) return res.status(401).json({ message: 'No autorizado.' });

    const cat = await findGradingCategoryById(id);
    if (!cat || cat.institution_id !== colegioId) {
      return res.status(404).json({ message: 'Logro no encontrado.' });
    }
    return res.json(toLogroFormat(cat));
  } catch (e: unknown) {
    console.error('Error al obtener logro:', e);
    return res.status(500).json({ message: 'Error al obtener logro.' });
  }
});

// PUT /api/logros-calificacion/:id
router.put('/:id', protect, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { nombre, porcentaje } = req.body;
    const colegioId = req.user?.colegioId;
    if (!colegioId) return res.status(401).json({ message: 'No autorizado.' });

    const cat = await findGradingCategoryById(id);
    if (!cat || cat.institution_id !== colegioId) {
      return res.status(404).json({ message: 'Logro no encontrado.' });
    }

    const sets: string[] = [];
    const values: unknown[] = [];
    let i = 1;
    if (nombre !== undefined) {
      sets.push(`name = $${i++}`);
      values.push(String(nombre).trim());
    }
    if (porcentaje !== undefined) {
      const weight = typeof porcentaje === 'number' ? porcentaje : parseFloat(String(porcentaje));
      if (Number.isNaN(weight) || weight < 0 || weight > 100) {
        return res.status(400).json({ message: 'porcentaje debe estar entre 0 y 100.' });
      }
      sets.push(`weight = $${i++}`);
      values.push(weight);
    }
    if (sets.length === 0) return res.json(toLogroFormat(cat));

    values.push(id);
    const r = await queryPg(
      `UPDATE grading_categories SET ${sets.join(', ')}, updated_at = now() WHERE id = $${i} RETURNING *`,
      values
    );
    const row = r.rows[0];
    return row ? res.json(toLogroFormat(row)) : res.json(toLogroFormat(cat));
  } catch (e: unknown) {
    console.error('Error al actualizar logro:', e);
    return res.status(500).json({ message: 'Error al actualizar logro.' });
  }
});

// DELETE /api/logros-calificacion/:id
router.delete('/:id', protect, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const colegioId = req.user?.colegioId;
    if (!colegioId) return res.status(401).json({ message: 'No autorizado.' });

    const cat = await findGradingCategoryById(id);
    if (!cat || cat.institution_id !== colegioId) {
      return res.status(404).json({ message: 'Logro no encontrado.' });
    }

    await queryPg('DELETE FROM grading_categories WHERE id = $1', [id]);
    return res.json({ success: true });
  } catch (e: unknown) {
    console.error('Error al eliminar logro:', e);
    return res.status(500).json({ message: 'Error al eliminar logro.' });
  }
});

export default router;
