/**
 * Servicio compartido de boletines académicos.
 * Extraído de server/routes/boletin.ts para ser reutilizable
 * desde rutas HTTP y desde el agente Kiwi.
 */

import { queryPg } from '../config/db-pg.js';
import { findGradingSchemaByGroupSubject } from '../repositories/gradingSchemaRepository.js';
import { findGradingCategoriesBySchema } from '../repositories/gradingCategoryRepository.js';
import { generateBoletinResumen } from './openai.js';

export interface BoletinMateriaDetalle {
  materia: string;
  profesor: string;
  promedio: number | null;
  categorias: { nombre: string; peso: number; promedio: number | null; actividades: number }[];
  asistencia: number | null;
  evolucion: { fecha: string; promedio: number }[];
}

export interface BoletinData {
  estudiante: {
    id: string;
    nombre?: string;  // omitido cuando omitName = true
    email?: string;   // omitido cuando omitName = true
  };
  promedioGeneral: number | null;
  estado: string;
  materias: BoletinMateriaDetalle[];
  resumenIA: string;
}

/**
 * Genera los datos completos del boletín para un estudiante.
 * @param omitName Si es true, omite nombre y email del estudiante en el retorno
 *                 (usar desde Kiwi para no exponer datos personales de menores).
 */
export async function getBoletinDataForStudent(
  studentId: string,
  groupId: string,
  institutionId: string,
  omitName = false
): Promise<BoletinData | null> {
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
    `SELECT gs.id as group_subject_id, gs.subject_id,
            COALESCE(gs.display_name, s.name) as subject_name,
            u.full_name as teacher_name
     FROM group_subjects gs
     JOIN subjects s ON gs.subject_id = s.id
     JOIN users u ON gs.teacher_id = u.id
     WHERE gs.group_id = $1 AND gs.institution_id = $2`,
    [groupId, institutionId]
  );

  // 3. Para cada materia: notas por categoría, promedio, asistencia
  const materias: BoletinMateriaDetalle[] = [];
  for (const subject of subjectsRes.rows) {
    const schema = await findGradingSchemaByGroupSubject(subject.group_subject_id, institutionId);
    const categories = schema ? await findGradingCategoriesBySchema(schema.id) : [];

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

    let weightedSum = 0;
    const categoriasDetalle: BoletinMateriaDetalle['categorias'] = [];
    for (const cat of categories) {
      type GradeRow = { score: number; grading_category_id: string; created_at: string };
      const catGrades = gradesRes.rows.filter((g: GradeRow) => g.grading_category_id === cat.id);
      const avg = catGrades.length
        ? catGrades.reduce((s: number, g: GradeRow) => s + Number(g.score), 0) / catGrades.length
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

    const attRes = await queryPg<{ status: string }>(
      `SELECT status FROM attendance WHERE user_id = $1 AND group_subject_id = $2`,
      [studentId, subject.group_subject_id]
    );
    const totalAtt = attRes.rows.length;
    const presents = attRes.rows.filter((a: { status: string }) => a.status === 'present').length;
    const asistenciaPct = totalAtt > 0 ? Math.round((presents / totalAtt) * 100) : null;

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
      promedio: categoriasDetalle.some((c) => c.promedio !== null)
        ? Math.round(weightedSum * 10) / 10
        : null,
      categorias: categoriasDetalle,
      asistencia: asistenciaPct,
      evolucion,
    });
  }

  // 4. Promedio general
  const materiasConNotas = materias.filter((m) => m.promedio !== null);
  const promedioGeneral =
    materiasConNotas.length > 0
      ? Math.round(
          (materiasConNotas.reduce((s, m) => s + m.promedio!, 0) / materiasConNotas.length) * 10
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

  // 6. Resumen IA — usa full_name en el prompt interno, nunca en el retorno si omitName=true
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

    // El prompt usa un identificador anónimo cuando omitName=true
    const studentLabel = omitName ? 'El estudiante' : student.full_name;
    const prompt = `Estudiante: ${studentLabel}.
Estado general: ${estado} (promedio ${promedioGeneral}/100).
Materias: ${detallesMaterias}
Genera un boletín personalizado en 3-4 oraciones.`;

    const generated = await generateBoletinResumen(prompt);
    resumenIA = generated
      ?? `${studentLabel} tiene un promedio general de ${promedioGeneral}/100. Estado: ${estado}.`;
  }

  return {
    estudiante: {
      id: studentId,
      ...(omitName ? {} : { nombre: student.full_name, email: student.email }),
    },
    promedioGeneral,
    estado,
    materias,
    resumenIA,
  };
}
