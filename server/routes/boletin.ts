import express from 'express';
import { protect, AuthRequest } from '../middleware/auth.js';
import { queryPg } from '../config/db-pg.js';
import { resolveGroupId } from '../utils/resolveLegacyCourse.js';
import { findGradingSchemaByGroupSubject } from '../repositories/gradingSchemaRepository.js';
import { findGradingCategoriesBySchema } from '../repositories/gradingCategoryRepository.js';
import { generateBoletinResumen } from '../services/openai.js';

const router = express.Router();

// ─── Helper: datos completos de un estudiante para el boletín ───────────────
async function getBoletinDataForStudent(
  studentId: string,
  groupId: string,
  institutionId: string
) {
  // 1. Datos del estudiante
  const studentRes = await queryPg<{ full_name: string; email: string }>(
    'SELECT full_name, email FROM users WHERE id = $1',
    [studentId]
  );
  const student = studentRes.rows[0];
  if (!student) return null;

  // 2. Todas las materias del grupo
  const subjectsRes = await queryPg<{
    group_subject_id: string;
    subject_id: string;
    subject_name: string;
    teacher_name: string;
  }>(
    `SELECT gs.id as group_subject_id, gs.subject_id, s.name as subject_name,
            u.full_name as teacher_name
     FROM group_subjects gs
     JOIN subjects s ON gs.subject_id = s.id
     JOIN users u ON gs.teacher_id = u.id
     WHERE gs.group_id = $1 AND gs.institution_id = $2`,
    [groupId, institutionId]
  );

  // 3. Para cada materia: notas por categoría, promedio, asistencia
  const materias = [];
  for (const subject of subjectsRes.rows) {
    // Schema y categorías
    const schema = await findGradingSchemaByGroupSubject(
      subject.group_subject_id,
      institutionId
    );
    const categories = schema
      ? await findGradingCategoriesBySchema(schema.id)
      : [];

    // Notas del estudiante en esta materia (vía grades + grading_categories)
    const schemaId = schema?.id ?? '00000000-0000-0000-0000-000000000000';
    const gradesRes = await queryPg<{
      score: number;
      grading_category_id: string;
      created_at: string;
    }>(
      `SELECT gr.score, gr.grading_category_id, gr.recorded_at as created_at
       FROM grades gr
       WHERE gr.user_id = $1 AND gr.group_id = $2
       AND gr.grading_category_id = ANY(
         SELECT id FROM grading_categories WHERE grading_schema_id = $3
       )
       ORDER BY gr.recorded_at ASC`,
      [studentId, groupId, schemaId]
    );

    // Promedio ponderado por categoría
    let weightedSum = 0;
    const categoriasDetalle = [];
    for (const cat of categories) {
      const catGrades = gradesRes.rows.filter(
        (g) => g.grading_category_id === cat.id
      );
      const avg =
        catGrades.length
          ? catGrades.reduce((s, g) => s + Number(g.score), 0) / catGrades.length
          : null;
      if (avg !== null) {
        weightedSum += avg * (Number(cat.weight) / 100);
      }
      categoriasDetalle.push({
        nombre: cat.name,
        peso: Number(cat.weight),
        promedio: avg !== null ? Math.round(avg * 10) / 10 : null,
        actividades: catGrades.length,
      });
    }

    // Asistencia
    const attRes = await queryPg<{ status: string }>(
      `SELECT status FROM attendance
       WHERE user_id = $1 AND group_subject_id = $2`,
      [studentId, subject.group_subject_id]
    );
    const totalAtt = attRes.rows.length;
    const presents = attRes.rows.filter((a) => a.status === 'present').length;
    const asistenciaPct =
      totalAtt > 0 ? Math.round((presents / totalAtt) * 100) : null;

    // Evolución: promedios acumulados por fecha
    const evolucion: { fecha: string; promedio: number }[] = [];
    let runningSum = 0;
    let runningCount = 0;
    for (const g of gradesRes.rows) {
      runningSum += Number(g.score);
      runningCount++;
      const d = new Date(g.created_at);
      evolucion.push({
        fecha: `${d.getDate()}/${d.toLocaleString('es', { month: 'short' })}`,
        promedio: Math.round((runningSum / runningCount) * 10) / 10,
      });
    }

    materias.push({
      materia: subject.subject_name,
      profesor: subject.teacher_name,
      promedio:
        categoriasDetalle.some((c) => c.promedio !== null)
          ? Math.round(weightedSum * 10) / 10
          : null,
      categorias: categoriasDetalle,
      asistencia: asistenciaPct,
      evolucion,
    });
  }

  // 4. Promedio general (promedio de promedios de materias con datos)
  const materiasConNotas = materias.filter((m) => m.promedio !== null);
  const promedioGeneral =
    materiasConNotas.length > 0
      ? Math.round(
          (materiasConNotas.reduce((s, m) => s + m.promedio!, 0) /
            materiasConNotas.length) *
            10
        ) / 10
      : null;

  // 5. Estado
  const estado =
    promedioGeneral === null
      ? 'sin datos'
      : promedioGeneral >= 85
        ? 'excelente'
        : promedioGeneral >= 75
          ? 'bueno'
          : promedioGeneral >= 60
            ? 'en riesgo'
            : 'crítico';

  // 6. Resumen IA personalizado
  let resumenIA = '';
  if (materiasConNotas.length > 0) {
    const detallesMaterias = materiasConNotas
      .map(
        (m) =>
          `${m.materia}: promedio ${m.promedio}/100${
            m.asistencia !== null ? `, asistencia ${m.asistencia}%` : ''
          } (${m.categorias
            .filter((c) => c.promedio !== null)
            .map((c) => `${c.nombre} ${c.peso}%: ${c.promedio}`)
            .join(', ')})`
      )
      .join(' | ');

    const prompt = `Estudiante: ${student.full_name}.
Estado general: ${estado} (promedio ${promedioGeneral}/100).
Materias: ${detallesMaterias}
Genera un boletín personalizado en 3-4 oraciones.`;

    const generated = await generateBoletinResumen(prompt);
    if (generated) {
      resumenIA = generated;
    } else {
      resumenIA = `${student.full_name} tiene un promedio general de ${promedioGeneral}/100. Estado: ${estado}. Configure OPENAI_API_KEY en .env para obtener un resumen generado por IA.`;
    }
  }

  return {
    estudiante: {
      id: studentId,
      nombre: student.full_name,
      email: student.email,
    },
    promedioGeneral,
    estado,
    materias,
    resumenIA,
  };
}

// ─── GET /api/boletin — Lista boletines (directivo/admin) ───────────────────
router.get('/', protect, async (req: AuthRequest, res) => {
  try {
    const rol = req.user?.rol;
    if (
      !['directivo', 'admin-general-colegio', 'school_admin'].includes(rol ?? '')
    ) {
      return res.status(403).json({ message: 'No autorizado.' });
    }
    // Por ahora devuelve lista vacía — se puede implementar persistencia después
    return res.json([]);
  } catch (e) {
    console.error('[boletin] GET /', e);
    return res.status(500).json({ message: 'Error al listar boletines.' });
  }
});

// ─── GET /api/boletin/inteligente/:estudianteId ─────────────────────────────
// Profesor (su materia) o directivo/admin (todas las materias)
router.get(
  '/inteligente/:estudianteId',
  protect,
  async (req: AuthRequest, res) => {
    try {
      const { estudianteId } = req.params;
      const institutionId =
        req.user?.institutionId ?? req.user?.colegioId ?? '';
      const rol = req.user?.rol;
      const userId = req.user?.id;

      const allowedRoles = [
        'profesor',
        'directivo',
        'admin-general-colegio',
        'school_admin',
      ];
      if (!allowedRoles.includes(rol ?? '')) {
        return res.status(403).json({ message: 'No autorizado.' });
      }

      // Obtener el grupo del estudiante
      const enrollRes = await queryPg<{ group_id: string }>(
        `SELECT e.group_id FROM enrollments e
       JOIN groups g ON e.group_id = g.id
       WHERE e.student_id = $1 AND g.institution_id = $2
       LIMIT 1`,
        [estudianteId, institutionId]
      );
      if (!enrollRes.rows[0]) {
        return res
          .status(404)
          .json({ message: 'Estudiante no encontrado en ningún grupo.' });
      }
      const groupId = enrollRes.rows[0].group_id;

      const data = await getBoletinDataForStudent(
        estudianteId,
        groupId,
        institutionId
      );
      if (!data)
        return res.status(404).json({ message: 'Estudiante no encontrado.' });

      const groupRes = await queryPg<{ name: string }>(
        'SELECT name FROM groups WHERE id = $1',
        [groupId]
      );
      const grupoNombre = groupRes.rows[0]?.name ?? '';

      // Profesor: filtrar solo su materia
      if (rol === 'profesor') {
        const gsRes = await queryPg<{ subject_id: string }>(
          `SELECT subject_id FROM group_subjects
         WHERE group_id = $1 AND teacher_id = $2 AND institution_id = $3`,
          [groupId, userId, institutionId]
        );
        const teacherSubjectIds = gsRes.rows.map((r) => r.subject_id);
        const subjectsRes = await queryPg<{ name: string }>(
          `SELECT name FROM subjects WHERE id = ANY($1::uuid[])`,
          [teacherSubjectIds]
        );
        const teacherSubjectNames = subjectsRes.rows.map((r) => r.name);
        data.materias = data.materias.filter((m) =>
          teacherSubjectNames.includes(m.materia)
        );
      }

      return res.json({ ...data, grupo: grupoNombre });
    } catch (e) {
      console.error('[boletin] GET /inteligente/:estudianteId', e);
      return res.status(500).json({ message: 'Error al generar boletín.' });
    }
  }
);

// ─── POST /api/boletin/generar-por-curso ────────────────────────────────────
// Directivo/admin: genera boletines para todos los estudiantes de un grupo
router.post('/generar-por-curso', protect, async (req: AuthRequest, res) => {
  try {
    const rol = req.user?.rol;
    const institutionId =
      req.user?.institutionId ?? req.user?.colegioId ?? '';

    if (
      !['directivo', 'admin-general-colegio', 'school_admin'].includes(rol ?? '')
    ) {
      return res.status(403).json({ message: 'No autorizado.' });
    }

    const { grupoNombre } = req.body as { grupoNombre?: string };
    if (!grupoNombre?.trim()) {
      return res.status(400).json({ message: 'grupoNombre es requerido.' });
    }

    const resolved = await resolveGroupId(grupoNombre.trim(), institutionId);
    if (!resolved) {
      return res.status(404).json({ message: 'Grupo no encontrado.' });
    }

    // Obtener todos los estudiantes del grupo
    const studentsRes = await queryPg<{
      student_id: string;
      full_name: string;
    }>(
      `SELECT e.student_id, u.full_name
       FROM enrollments e
       JOIN users u ON e.student_id = u.id
       WHERE e.group_id = $1`,
      [resolved.id]
    );

    // Generar boletín para cada estudiante
    const boletines = [];
    for (const student of studentsRes.rows) {
      const data = await getBoletinDataForStudent(
        student.student_id,
        resolved.id,
        institutionId
      );
      if (data) boletines.push(data);
    }

    return res.json({
      grupo: resolved.name,
      totalEstudiantes: boletines.length,
      boletines,
    });
  } catch (e) {
    console.error('[boletin] POST /generar-por-curso', e);
    return res.status(500).json({ message: 'Error al generar boletines.' });
  }
});

// ─── GET /api/boletin/:id/pdf ────────────────────────────────────────────────
router.get('/:id/pdf', protect, async (_req, res) => {
  return res.status(404).json({ message: 'PDF no implementado aún.' });
});

export default router;
