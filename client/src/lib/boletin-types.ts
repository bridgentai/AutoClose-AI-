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
  estudiante: { id: string; nombre?: string; email?: string };
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
