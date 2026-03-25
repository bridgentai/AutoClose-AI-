import express from 'express';
import { protect, AuthRequest } from '../middleware/auth.js';
import { findGroupSubjectById } from '../repositories/groupSubjectRepository.js';
import { findGradingSchemaByGroupSubject } from '../repositories/gradingSchemaRepository.js';
import { resolveGroupSubjectId } from '../utils/resolveLegacyCourse.js';
import {
  findGradingCategoriesBySchema,
  findGradingCategoryById,
} from '../repositories/gradingCategoryRepository.js';
import {
  findGradingOutcomesBySchema,
  findGradingOutcomeById,
} from '../repositories/gradingOutcomeRepository.js';
import { getPgPool, queryPg } from '../config/db-pg.js';

const router = express.Router();

const SUM_EPS = 0.01;

function sumsToHundred(total: number): boolean {
  return Math.abs(total - 100) < SUM_EPS;
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

async function assertTeacherOwnsOutcome(
  outcomeId: string,
  userId: string,
  colegioId: string
): Promise<boolean> {
  const r = await queryPg<{ teacher_id: string; institution_id: string }>(
    `SELECT gs.teacher_id, go.institution_id
     FROM grading_outcomes go
     JOIN grading_schemas gsch ON gsch.id = go.grading_schema_id
     LEFT JOIN group_subjects gs ON gs.id = gsch.group_subject_id
     WHERE go.id = $1`,
    [outcomeId]
  );
  const row = r.rows[0];
  if (!row || row.institution_id !== colegioId) return false;
  return row.teacher_id === userId;
}

async function assertTeacherOwnsCategory(
  categoryId: string,
  userId: string,
  colegioId: string
): Promise<boolean> {
  const r = await queryPg<{ teacher_id: string; institution_id: string }>(
    `SELECT gs.teacher_id, gc.institution_id
     FROM grading_categories gc
     JOIN grading_schemas gsch ON gsch.id = gc.grading_schema_id
     LEFT JOIN group_subjects gs ON gs.id = gsch.group_subject_id
     WHERE gc.id = $1`,
    [categoryId]
  );
  const row = r.rows[0];
  if (!row || row.institution_id !== colegioId) return false;
  return row.teacher_id === userId;
}

async function buildResponseForSchema(schemaId: string) {
  const outcomes = await findGradingOutcomesBySchema(schemaId);
  const categories = await findGradingCategoriesBySchema(schemaId);
  const byOutcome = new Map<string, typeof categories>();
  for (const c of categories) {
    const oid = c.grading_outcome_id;
    if (!oid) continue;
    if (!byOutcome.has(oid)) byOutcome.set(oid, []);
    byOutcome.get(oid)!.push(c);
  }

  const logros = outcomes.map((o) => {
    const inds = (byOutcome.get(o.id) || []).slice().sort((a, b) => a.sort_order - b.sort_order);
    const totalInd = inds.reduce((s, x) => s + Number(x.weight), 0);
    return {
      _id: o.id,
      descripcion: o.description ?? '',
      pesoEnCurso: Number(o.weight),
      orden: o.sort_order,
      indicadores: inds.map((c) => ({
        _id: c.id,
        nombre: c.name,
        porcentaje: Number(c.weight),
        orden: c.sort_order,
      })),
      totalIndicadores: totalInd,
      indicadoresCompletos: Math.abs(totalInd - 100) < 0.01,
    };
  });

  const totalPesoLogros = logros.reduce((s, l) => s + l.pesoEnCurso, 0);
  const indicadoresPlano = logros.flatMap((l) =>
    l.indicadores.map((i) => ({
      _id: i._id,
      nombre: i.nombre,
      porcentaje: i.porcentaje,
      orden: i.orden,
      logroId: l._id,
      logroDescripcion: l.descripcion?.slice(0, 120) ?? '',
    }))
  );

  return {
    logros,
    indicadoresPlano,
    totalPesoLogros,
    logrosPesoCompleto: Math.abs(totalPesoLogros - 100) < 0.01,
  };
}

// GET /api/logros-calificacion?courseId=...
router.get('/', protect, async (req: AuthRequest, res) => {
  try {
    const courseIdParam = req.query.courseId as string;
    const colegioId = req.user?.colegioId;
    if (!courseIdParam) return res.status(400).json({ message: 'courseId es requerido.' });
    if (!colegioId) return res.status(401).json({ message: 'No autorizado.' });

    const gsId = await resolveGroupSubjectId(courseIdParam.trim(), colegioId);
    if (!gsId) {
      return res.json({
        logros: [],
        indicadoresPlano: [],
        totalPesoLogros: 0,
        logrosPesoCompleto: false,
      });
    }
    const gs = await findGroupSubjectById(gsId);
    if (!gs) {
      return res.json({
        logros: [],
        indicadoresPlano: [],
        totalPesoLogros: 0,
        logrosPesoCompleto: false,
      });
    }

    const schema = await findGradingSchemaByGroupSubject(gsId, gs.institution_id);
    if (!schema) {
      return res.json({
        logros: [],
        indicadoresPlano: [],
        totalPesoLogros: 0,
        logrosPesoCompleto: false,
      });
    }

    const body = await buildResponseForSchema(schema.id);
    return res.json(body);
  } catch (e: unknown) {
    console.error('Error al listar logros:', e);
    return res.status(500).json({ message: 'Error al listar logros de calificación.' });
  }
});

// POST /api/logros-calificacion/logro — crear logro (párrafo + peso entre logros)
router.post('/logro', protect, async (req: AuthRequest, res) => {
  try {
    const { descripcion, pesoEnCurso, courseId } = req.body as {
      descripcion?: string;
      pesoEnCurso?: number;
      courseId?: string;
    };
    const userId = req.user?.id;
    const colegioId = req.user?.colegioId;
    if (!userId || !colegioId) return res.status(401).json({ message: 'No autorizado.' });
    if (!courseId) return res.status(400).json({ message: 'courseId es requerido.' });

    const schema = await getOrCreateSchemaForCourse(String(courseId).trim(), userId, colegioId);
    if (!schema) return res.status(403).json({ message: 'No tienes acceso a este curso.' });

    const existingOutcomes = await findGradingOutcomesBySchema(schema.id);
    const nextOrder =
      existingOutcomes.length > 0 ? Math.max(...existingOutcomes.map((o) => o.sort_order)) + 1 : 0;

    let weight =
      typeof pesoEnCurso === 'number' ? pesoEnCurso : parseFloat(String(pesoEnCurso ?? 'nan'));
    if (existingOutcomes.length === 0) {
      weight = 100;
    } else {
      if (Number.isNaN(weight)) weight = 0;
      if (weight < 0 || weight > 100) {
        return res.status(400).json({ message: 'pesoEnCurso debe estar entre 0 y 100.' });
      }
    }

    const desc = typeof descripcion === 'string' ? descripcion.trim() : '';

    const r = await queryPg(
      `INSERT INTO grading_outcomes (grading_schema_id, institution_id, description, weight, sort_order)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [schema.id, schema.institution_id, desc, weight, nextOrder]
    );
    const row = r.rows[0];
    if (!row) return res.status(500).json({ message: 'Error al crear logro.' });

    return res.status(201).json({
      _id: row.id,
      descripcion: row.description ?? '',
      pesoEnCurso: Number(row.weight),
      orden: row.sort_order,
      indicadores: [],
      totalIndicadores: 0,
      indicadoresCompletos: false,
    });
  } catch (e: unknown) {
    console.error('Error al crear logro:', e);
    return res.status(500).json({ message: 'Error al crear logro de calificación.' });
  }
});

// PUT /api/logros-calificacion/logro/:id/indicadores — reemplaza todos los indicadores del logro (vacío = sin indicadores; si hay filas, deben sumar 100%)
router.put('/logro/:id/indicadores', protect, async (req: AuthRequest, res) => {
  const outcomeId = req.params.id;
  const { indicadores } = req.body as { indicadores?: { nombre?: string; porcentaje?: number | string }[] };
  const userId = req.user?.id;
  const colegioId = req.user?.colegioId;
  if (!userId || !colegioId) return res.status(401).json({ message: 'No autorizado.' });

  try {
    const ok = await assertTeacherOwnsOutcome(outcomeId, userId, colegioId);
    if (!ok) return res.status(404).json({ message: 'Logro no encontrado.' });

    const outcome = await findGradingOutcomeById(outcomeId);
    if (!outcome) return res.status(404).json({ message: 'Logro no encontrado.' });

    const rawList = Array.isArray(indicadores) ? indicadores : [];
    const normalized: { nombre: string; pct: number }[] = [];
    for (const row of rawList) {
      const n = typeof row.nombre === 'string' ? row.nombre.trim() : '';
      const p = typeof row.porcentaje === 'number' ? row.porcentaje : parseFloat(String(row.porcentaje ?? 'nan'));
      if (!n) {
        return res.status(400).json({ message: 'Cada indicador debe tener nombre.' });
      }
      if (Number.isNaN(p) || p < 0 || p > 100) {
        return res.status(400).json({ message: 'Cada porcentaje debe estar entre 0 y 100.' });
      }
      normalized.push({ nombre: n, pct: p });
    }

    const total = normalized.reduce((s, x) => s + x.pct, 0);
    if (normalized.length > 0 && !sumsToHundred(total)) {
      return res.status(400).json({
        message: `Los indicadores deben sumar exactamente 100% en este logro (suma actual: ${total.toFixed(1)}%).`,
      });
    }

    const pool = getPgPool();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM grading_categories WHERE grading_outcome_id = $1', [outcomeId]);
      let sortOrder = 0;
      for (const row of normalized) {
        await client.query(
          `INSERT INTO grading_categories (grading_schema_id, institution_id, grading_outcome_id, name, weight, sort_order, evaluation_type, risk_impact_multiplier)
           VALUES ($1, $2, $3, $4, $5, $6, 'summative', 1)`,
          [outcome.grading_schema_id, outcome.institution_id, outcomeId, row.nombre, row.pct, sortOrder++]
        );
      }
      await client.query('COMMIT');
      return res.json({ success: true });
    } catch (inner: unknown) {
      await client.query('ROLLBACK');
      throw inner;
    } finally {
      client.release();
    }
  } catch (e: unknown) {
    console.error('Error al sincronizar indicadores:', e);
    return res.status(500).json({ message: 'Error al guardar indicadores del logro.' });
  }
});

// PUT /api/logros-calificacion/logro/:id
router.put('/logro/:id', protect, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { descripcion, pesoEnCurso } = req.body as { descripcion?: string; pesoEnCurso?: number };
    const userId = req.user?.id;
    const colegioId = req.user?.colegioId;
    if (!userId || !colegioId) return res.status(401).json({ message: 'No autorizado.' });

    const ok = await assertTeacherOwnsOutcome(id, userId, colegioId);
    if (!ok) return res.status(404).json({ message: 'Logro no encontrado.' });

    const sets: string[] = [];
    const values: unknown[] = [];
    let i = 1;
    if (descripcion !== undefined) {
      sets.push(`description = $${i++}`);
      values.push(String(descripcion).trim());
    }
    if (pesoEnCurso !== undefined) {
      const w = typeof pesoEnCurso === 'number' ? pesoEnCurso : parseFloat(String(pesoEnCurso));
      if (Number.isNaN(w) || w < 0 || w > 100) {
        return res.status(400).json({ message: 'pesoEnCurso debe estar entre 0 y 100.' });
      }
      sets.push(`weight = $${i++}`);
      values.push(w);
    }
    if (sets.length === 0) {
      const o = await findGradingOutcomeById(id);
      return o
        ? res.json({
            _id: o.id,
            descripcion: o.description ?? '',
            pesoEnCurso: Number(o.weight),
            orden: o.sort_order,
          })
        : res.status(404).json({ message: 'Logro no encontrado.' });
    }
    sets.push('updated_at = now()');
    values.push(id);
    await queryPg(`UPDATE grading_outcomes SET ${sets.join(', ')} WHERE id = $${i}`, values);
    const o = await findGradingOutcomeById(id);
    return o
      ? res.json({
          _id: o.id,
          descripcion: o.description ?? '',
          pesoEnCurso: Number(o.weight),
          orden: o.sort_order,
        })
      : res.status(404).json({ message: 'Logro no encontrado.' });
  } catch (e: unknown) {
    console.error('Error al actualizar logro:', e);
    return res.status(500).json({ message: 'Error al actualizar logro.' });
  }
});

// DELETE /api/logros-calificacion/logro/:id
router.delete('/logro/:id', protect, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    const colegioId = req.user?.colegioId;
    if (!userId || !colegioId) return res.status(401).json({ message: 'No autorizado.' });

    const ok = await assertTeacherOwnsOutcome(id, userId, colegioId);
    if (!ok) return res.status(404).json({ message: 'Logro no encontrado.' });

    await queryPg('DELETE FROM grading_outcomes WHERE id = $1', [id]);
    return res.json({ success: true });
  } catch (e: unknown) {
    console.error('Error al eliminar logro:', e);
    return res.status(500).json({ message: 'Error al eliminar logro.' });
  }
});

// POST /api/logros-calificacion/indicador
router.post('/indicador', protect, async (req: AuthRequest, res) => {
  try {
    const { outcomeId, nombre, porcentaje } = req.body as {
      outcomeId?: string;
      nombre?: string;
      porcentaje?: number;
    };
    const userId = req.user?.id;
    const colegioId = req.user?.colegioId;
    if (!userId || !colegioId) return res.status(401).json({ message: 'No autorizado.' });
    if (!outcomeId) return res.status(400).json({ message: 'outcomeId es requerido.' });
    if (!nombre || typeof nombre !== 'string' || !nombre.trim()) {
      return res.status(400).json({ message: 'nombre es requerido.' });
    }

    const ok = await assertTeacherOwnsOutcome(outcomeId, userId, colegioId);
    if (!ok) return res.status(403).json({ message: 'No tienes acceso a este logro.' });

    const outcome = await findGradingOutcomeById(outcomeId);
    if (!outcome) return res.status(404).json({ message: 'Logro no encontrado.' });

    const weight = typeof porcentaje === 'number' ? porcentaje : parseFloat(String(porcentaje ?? 0));
    if (Number.isNaN(weight) || weight < 0 || weight > 100) {
      return res.status(400).json({ message: 'porcentaje debe estar entre 0 y 100.' });
    }

    const categories = await findGradingCategoriesBySchema(outcome.grading_schema_id);
    const inOutcome = categories.filter((c) => c.grading_outcome_id === outcomeId);
    const nextSort = inOutcome.length > 0 ? Math.max(...inOutcome.map((c) => c.sort_order)) + 1 : 0;

    const pool = getPgPool();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const r = await client.query(
        `INSERT INTO grading_categories (grading_schema_id, institution_id, grading_outcome_id, name, weight, sort_order, evaluation_type, risk_impact_multiplier)
         VALUES ($1, $2, $3, $4, $5, $6, 'summative', 1) RETURNING *`,
        [outcome.grading_schema_id, outcome.institution_id, outcomeId, nombre.trim(), weight, nextSort]
      );
      const row = r.rows[0];
      if (!row) {
        await client.query('ROLLBACK');
        return res.status(500).json({ message: 'Error al crear indicador.' });
      }
      const sumR = await client.query<{ s: string }>(
        `SELECT COALESCE(SUM(weight), 0)::numeric AS s FROM grading_categories WHERE grading_outcome_id = $1`,
        [outcomeId]
      );
      const total = Number(sumR.rows[0]?.s ?? 0);
      if (!sumsToHundred(total)) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          message: `Tras agregar este indicador la suma en el logro debe ser 100% (ahora: ${total.toFixed(1)}%). Usa "Guardar indicadores" para definir varios a la vez.`,
        });
      }
      await client.query('COMMIT');
      return res.status(201).json({
        _id: row.id,
        nombre: row.name,
        porcentaje: Number(row.weight),
        orden: row.sort_order,
      });
    } catch (inner: unknown) {
      await client.query('ROLLBACK');
      throw inner;
    } finally {
      client.release();
    }
  } catch (e: unknown) {
    console.error('Error al crear indicador:', e);
    return res.status(500).json({ message: 'Error al crear indicador.' });
  }
});

// PUT /api/logros-calificacion/indicador/:id
router.put('/indicador/:id', protect, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { nombre, porcentaje } = req.body as { nombre?: string; porcentaje?: number };
    const userId = req.user?.id;
    const colegioId = req.user?.colegioId;
    if (!userId || !colegioId) return res.status(401).json({ message: 'No autorizado.' });

    const ok = await assertTeacherOwnsCategory(id, userId, colegioId);
    if (!ok) return res.status(404).json({ message: 'Indicador no encontrado.' });

    const cat = await findGradingCategoryById(id);
    if (!cat) return res.status(404).json({ message: 'Indicador no encontrado.' });

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
    if (sets.length === 0) {
      return res.json({ _id: cat.id, nombre: cat.name, porcentaje: Number(cat.weight), orden: cat.sort_order });
    }

    if (porcentaje === undefined) {
      sets.push('updated_at = now()');
      values.push(id);
      await queryPg(`UPDATE grading_categories SET ${sets.join(', ')} WHERE id = $${i}`, values);
      const updated = await findGradingCategoryById(id);
      return updated
        ? res.json({
            _id: updated.id,
            nombre: updated.name,
            porcentaje: Number(updated.weight),
            orden: updated.sort_order,
          })
        : res.status(404).json({ message: 'Indicador no encontrado.' });
    }

    const oid = cat.grading_outcome_id;
    if (!oid) {
      return res.status(400).json({ message: 'Indicador sin logro asociado.' });
    }

    const pool = getPgPool();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      sets.push('updated_at = now()');
      values.push(id);
      await client.query(`UPDATE grading_categories SET ${sets.join(', ')} WHERE id = $${i}`, values);
      const sumR = await client.query<{ s: string }>(
        `SELECT COALESCE(SUM(weight), 0)::numeric AS s FROM grading_categories WHERE grading_outcome_id = $1`,
        [oid]
      );
      const total = Number(sumR.rows[0]?.s ?? 0);
      if (!sumsToHundred(total)) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          message: `Los indicadores de este logro deben sumar 100% (suma actual: ${total.toFixed(1)}%). Usa "Guardar indicadores" para ajustar la lista completa.`,
        });
      }
      await client.query('COMMIT');
      const updated = await findGradingCategoryById(id);
      return updated
        ? res.json({
            _id: updated.id,
            nombre: updated.name,
            porcentaje: Number(updated.weight),
            orden: updated.sort_order,
          })
        : res.status(404).json({ message: 'Indicador no encontrado.' });
    } catch (inner: unknown) {
      await client.query('ROLLBACK');
      throw inner;
    } finally {
      client.release();
    }
  } catch (e: unknown) {
    console.error('Error al actualizar indicador:', e);
    return res.status(500).json({ message: 'Error al actualizar indicador.' });
  }
});

// DELETE /api/logros-calificacion/indicador/:id
router.delete('/indicador/:id', protect, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    const colegioId = req.user?.colegioId;
    if (!userId || !colegioId) return res.status(401).json({ message: 'No autorizado.' });

    const ok = await assertTeacherOwnsCategory(id, userId, colegioId);
    if (!ok) return res.status(404).json({ message: 'Indicador no encontrado.' });

    await queryPg('DELETE FROM grading_categories WHERE id = $1', [id]);
    return res.json({ success: true });
  } catch (e: unknown) {
    console.error('Error al eliminar indicador:', e);
    return res.status(500).json({ message: 'Error al eliminar indicador.' });
  }
});

export default router;
