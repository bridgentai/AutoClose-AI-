import { queryPg } from '../config/db-pg.js';
import { buildDetailedMateriasNotasForStudent } from './studentAcademicSnapshot.js';
import { generateAcademicInsightsSummary, generateBoletinResumen } from './openai.js';

export interface BoletinLogroDetalle {
  id: string;
  nombre: string;
  peso: number | null;
  promedio: number | null;
  notas: number[];
  actividades: number;
}

export interface BoletinMateriaDetalle {
  groupSubjectId: string;
  materia: string;
  profesor: string;
  promedio: number | null;
  estado: string;
  logros: BoletinLogroDetalle[];
  asistencia: number | null;
  evolucion: { fecha: string; promedio: number }[];
  analisisIA: string;
}

export interface BoletinData {
  estudiante: {
    id: string;
    nombre?: string;
    email?: string;
  };
  grupo?: string;
  periodo?: string;
  fechaEmision?: string;
  promedioGeneral: number | null;
  estado: string;
  materias: BoletinMateriaDetalle[];
  resumenIA: string;
  mejorMateria?: { nombre: string; promedio: number } | null;
  peorMateria?: { nombre: string; promedio: number } | null;
}

function roundToTenth(value: number | null): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  return Math.round(value * 10) / 10;
}

function getGeneralStatus(promedioGeneral: number | null): string {
  if (promedioGeneral === null) return 'sin datos';
  if (promedioGeneral >= 85) return 'excelente';
  if (promedioGeneral >= 75) return 'bueno';
  if (promedioGeneral >= 65) return 'aprobado';
  return 'en riesgo';
}

async function getAttendancePct(studentId: string, groupSubjectId: string): Promise<number | null> {
  const attRes = await queryPg<{ status: string }>(
    `SELECT status FROM attendance WHERE user_id = $1 AND group_subject_id = $2`,
    [studentId, groupSubjectId]
  );
  const total = attRes.rows.length;
  if (total === 0) return null;
  const present = attRes.rows.filter((item: { status: string }) => item.status === 'present').length;
  return Math.round((present / total) * 100);
}

async function buildSubjectInsight(
  studentName: string,
  materia: { materia: string; promedio: number | null; logros: BoletinLogroDetalle[] }
): Promise<string> {
  const byCategory = materia.logros.map((logro) => ({
    categoryName: logro.nombre,
    percentage: logro.peso ?? 0,
    average: roundToTenth(logro.promedio) ?? 0,
    count: logro.actividades,
  }));
  const generated = await generateAcademicInsightsSummary({
    studentName,
    courseName: materia.materia,
    weightedAverage: materia.promedio,
    byCategory,
    engineInsights: byCategory
      .filter((item: { average: number; count: number }) => item.average < 75 && item.count > 0)
      .map(
        (item: { categoryName: string; average: number }) =>
          `${item.categoryName} requiere refuerzo; promedio ${item.average}/100.`
      ),
    role: 'boletin',
  });
  return generated;
}

export async function getBoletinDataForStudent(
  studentId: string,
  groupId: string,
  institutionId: string,
  omitName = false
): Promise<BoletinData | null> {
  const studentRes = await queryPg<{ full_name: string; email: string }>(
    'SELECT full_name, email FROM users WHERE id = $1',
    [studentId]
  );
  const student = studentRes.rows[0];
  if (!student) return null;

  const groupRes = await queryPg<{ name: string }>(
    'SELECT name FROM groups WHERE id = $1 AND institution_id = $2',
    [groupId, institutionId]
  );
  const grupo = groupRes.rows[0]?.name ?? '';

  const detail = await buildDetailedMateriasNotasForStudent(studentId, institutionId, { groupId });
  const materiasBase = detail.materias;

  const materias = await Promise.all(
    materiasBase.map(async (materia) => {
      const asistencia = await getAttendancePct(studentId, materia.groupSubjectId);
      const analisisIA = await buildSubjectInsight(student.full_name, {
        materia: materia.subjectName,
        promedio: materia.promedio,
        logros: materia.logros,
      });
      return {
        groupSubjectId: materia.groupSubjectId,
        materia: materia.subjectName,
        profesor: materia.profesor,
        promedio: materia.promedio,
        estado: materia.estado,
        logros: materia.logros,
        asistencia,
        evolucion: materia.evolucion,
        analisisIA,
      } satisfies BoletinMateriaDetalle;
    })
  );

  const materiasConNotas = materias.filter((materia) => materia.promedio !== null);
  const promedioGeneral = materiasConNotas.length
    ? roundToTenth(
        materiasConNotas.reduce((sum, materia) => sum + Number(materia.promedio), 0) /
          materiasConNotas.length
      )
    : null;
  const estado = getGeneralStatus(promedioGeneral);
  const sortedByAverage = [...materiasConNotas].sort((a, b) => Number(b.promedio) - Number(a.promedio));
  const mejorMateria = sortedByAverage[0]
    ? { nombre: sortedByAverage[0].materia, promedio: Number(sortedByAverage[0].promedio) }
    : null;
  const peorMateria = sortedByAverage.at(-1)
    ? { nombre: sortedByAverage.at(-1)!.materia, promedio: Number(sortedByAverage.at(-1)!.promedio) }
    : null;

  let resumenIA = '';
  if (materiasConNotas.length > 0) {
    const studentLabel = omitName ? 'El estudiante' : student.full_name;
    const detallesMaterias = materiasConNotas
      .map((materia) => {
        const logros = materia.logros
          .filter((logro) => logro.promedio !== null)
          .map((logro) => `${logro.nombre}: ${logro.promedio}/100`)
          .join(', ');
        return `${materia.materia}: promedio ${materia.promedio}/100${logros ? ` (${logros})` : ''}`;
      })
      .join(' | ');
    const mejorTexto = mejorMateria
      ? `Mejor materia: ${mejorMateria.nombre} con ${mejorMateria.promedio}/100.`
      : '';
    const peorTexto = peorMateria
      ? `Materia con mayor oportunidad de mejora: ${peorMateria.nombre} con ${peorMateria.promedio}/100.`
      : '';
    const prompt = `Estudiante: ${studentLabel}.
Promedio general real: ${promedioGeneral ?? 'sin datos'}/100.
Estado general: ${estado}.
${mejorTexto}
${peorTexto}
Se aprueba una materia con 65 o más.
Materias consideradas únicamente con notas reales registradas: ${detallesMaterias}
Redacta un resumen institucional breve y útil, sin inventar información.`;
    const generated = await generateBoletinResumen(prompt);
    resumenIA =
      generated ??
      `${studentLabel} tiene un promedio general de ${promedioGeneral}/100. ${mejorTexto} ${peorTexto}`.trim();
  }

  return {
    estudiante: {
      id: studentId,
      ...(omitName ? {} : { nombre: student.full_name, email: student.email }),
    },
    grupo,
    fechaEmision: new Date().toISOString(),
    promedioGeneral,
    estado,
    materias,
    resumenIA,
    mejorMateria,
    peorMateria,
  };
}
