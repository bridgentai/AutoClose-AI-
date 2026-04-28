import { buildDetailedMateriasNotasForStudent } from './studentAcademicSnapshot.js';

export async function buildMateriasNotasForStudent(
  studentId: string,
  institutionId: string
): Promise<{
  materias: Array<{
    _id: string;
    nombre: string;
    groupSubjectId: string;
    promedio: number | null;
    ultimaNota: number | null;
    estado: string;
    tendencia: 'stable';
    colorAcento: string;
    notas: Array<{
      assignmentId?: string;
      tareaTitulo?: string;
      nota: number | null;
      fecha: string;
      comentario: null;
      logro: null;
      gradingCategoryId?: string;
      categoryWeightPct?: number | null;
    }>;
  }>;
  total: number;
}> {
  const detail = await buildDetailedMateriasNotasForStudent(studentId, institutionId);
  return {
    materias: detail.materias.map((materia) => ({
      _id: materia._id,
      nombre: materia.nombre,
      groupSubjectId: materia.groupSubjectId,
      promedio: materia.promedio,
      ultimaNota: materia.ultimaNota,
      estado: materia.estado,
      tendencia: materia.tendencia,
      colorAcento: materia.colorAcento,
      notas: materia.notas,
    })),
    total: detail.total,
  };
}
