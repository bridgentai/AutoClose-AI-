import { useState, useMemo, useRef, useEffect } from 'react';
import { useAuth } from '@/lib/authContext';
import { Plus, Percent, Award, ChevronDown, ListFilter, TrendingUp, TrendingDown } from 'lucide-react';
import { NavBackButton } from '@/components/nav-back-button';
import { Button } from '@/components/ui/button';
import { GradesInlineAssignmentPanel } from '@/components/assignment/GradesInlineAssignmentPanel';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useLocation, useRoute } from 'wouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useForecast } from '@/hooks/useCourseGrading';
import { motion } from 'framer-motion';
import { LineChart, Line, ResponsiveContainer } from 'recharts';
import { Skeleton } from '@/components/ui/skeleton';
import {
  weightedGradeWithinLogro,
  courseWeightedFromLogros,
  courseGradeFromOutcomes,
  hasRecordedScore,
  type OutcomeGradeNode,
} from '@shared/weightedGrades';

// =========================================================
// TIPOS
// =========================================================

interface Submission {
  estudianteId: string;
  calificacion?: number;
}

interface Assignment {
  _id: string;
  titulo: string;
  descripcion: string;
  curso: string;
  courseId?: string;
  fechaEntrega: string;
  profesorNombre: string;
  submissions?: Submission[];
  entregas?: Submission[];
  /** Id de grading_categories (logro); usado para agrupar columnas por categoría */
  logroCalificacionId?: string;
  categoryWeightPct?: number | null;
  /** 1–3: período académico (filtrado en servidor cuando se pide ?trimestre=) */
  trimestre?: number;
}

interface LogroCalificacion {
  _id: string;
  nombre: string;
  porcentaje: number;
  orden?: number;
}

interface IndicadorEnLogro {
  _id: string;
  nombre: string;
  porcentaje: number;
  orden?: number;
}

interface LogroBloqueApi {
  _id: string;
  descripcion: string;
  pesoEnCurso: number;
  orden?: number;
  indicadores: IndicadorEnLogro[];
}

interface LogrosResponse {
  logros: LogroBloqueApi[];
  indicadoresPlano: LogroCalificacion[];
  totalPesoLogros: number;
  logrosPesoCompleto: boolean;
}

interface CourseSubject {
  _id: string;
  nombre: string;
  descripcion?: string;
  colorAcento?: string;
  profesor?: { nombre: string };
  cursoAsignado?: string;
}

interface Student {
  _id: string;
  nombre: string;
  estado: 'excelente' | 'bueno' | 'regular' | 'bajo';
  email?: string;
}

// =========================================================
// FETCHING
// =========================================================

const fetchSubjectsForGroup = async (groupId: string): Promise<CourseSubject[]> => {
  return apiRequest('GET', `/api/courses/for-group/${groupId}`);
};

function defaultAcademicTrimestre(): 1 | 2 | 3 {
  const m = new Date().getMonth() + 1;
  return m <= 4 ? 1 : m <= 8 ? 2 : 3;
}

function parseTrimestreFromSearch(search: string): 1 | 2 | 3 {
  const t = new URLSearchParams(search).get('t');
  if (t === '1' || t === '2' || t === '3') return Number(t) as 1 | 2 | 3;
  return defaultAcademicTrimestre();
}

function buildGradesTableSearchParams(opts: { gs: string; trimestre: 1 | 2 | 3; returnTo?: string }): string {
  const q = new URLSearchParams();
  if (opts.gs) q.set('gs', opts.gs);
  q.set('t', String(opts.trimestre));
  if (opts.returnTo?.trim()) q.set('returnTo', opts.returnTo.trim());
  return q.toString();
}

const fetchGradeTableAssignments = async (
  groupId: string,
  courseId: string,
  trimestre: 1 | 2 | 3
): Promise<Assignment[]> => {
  const qs = new URLSearchParams({
    groupId,
    courseId,
    trimestre: String(trimestre),
  });
  return apiRequest('GET', `/api/assignments?${qs.toString()}`);
};

const fetchStudentsByGroup = async (groupId: string): Promise<Student[]> => {
  try {
    const grupoIdNormalizado = groupId.toUpperCase().trim();
    const response = await apiRequest('GET', `/api/groups/${grupoIdNormalizado}/students`);
    return Array.isArray(response) ? response : [];
  } catch {
    return [];
  }
};

/** Columnas de la grilla: estudiante sticky + N actividades + promedio + predicción */
function buildGradesGridColumns(assignCount: number): string {
  const n = Math.max(0, assignCount);
  if (n === 0) return `minmax(260px, 300px) minmax(104px, 120px) minmax(152px, 180px)`;
  return `minmax(260px, 300px) repeat(${n}, minmax(132px, 150px)) minmax(104px, 120px) minmax(152px, 180px)`;
}

// =========================================================
// PREDICCIÓN (especificación exacta)
// =========================================================

function promedio(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

interface PrediccionResult {
  prediccion: number;
  tendencia: number;
  sparklineData: { value: number }[];
  notaActual: number;
}

function calcularPrediccion(
  estudianteId: string,
  assignmentsByIndicador: Record<string, { logro: LogroCalificacion; assignments: Assignment[] }>,
  outcomes: OutcomeGradeNode[]
): PrediccionResult {
  const scoreFor = (a: Assignment): number | null => {
    const subs = a.submissions || a.entregas || [];
    const sub = subs.find((x: { estudianteId?: string }) => String(x.estudianteId) === estudianteId);
    const cal = (sub as { calificacion?: number })?.calificacion;
    if (cal === null || cal === undefined || Number.isNaN(Number(cal))) return null;
    return Number(cal);
  };

  const allAssignmentsWithDates = (Object.values(assignmentsByIndicador) as { logro: LogroCalificacion; assignments: Assignment[] }[])
    .flatMap((g) => g.assignments.map((a) => ({ ...a, fecha: a.fechaEntrega })))
    .sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());

  const orderedGrades: number[] = [];
  allAssignmentsWithDates.forEach((a) => {
    const s = scoreFor(a as Assignment);
    if (hasRecordedScore(s)) orderedGrades.push(Number(s));
  });

  const getCategoryGrade = (catId: string): number | null => {
    const grp = assignmentsByIndicador[catId];
    if (!grp?.assignments?.length) return null;
    const scores = grp.assignments.map((x) => scoreFor(x));
    const slots = grp.assignments.map((x) => ({ categoryWeightPct: x.categoryWeightPct ?? null }));
    return weightedGradeWithinLogro(slots, scores);
  };
  let notaActual: number | null =
    outcomes.length > 0 ? courseGradeFromOutcomes(outcomes, getCategoryGrade) : null;
  if (notaActual == null) {
    const flat: { _id: string; porcentaje: number }[] = [];
    for (const [, { logro }] of Object.entries(assignmentsByIndicador)) {
      if (logro._id === 'sin-logro' || (logro.porcentaje ?? 0) <= 0) continue;
      flat.push({ _id: logro._id, porcentaje: logro.porcentaje });
    }
    notaActual = courseWeightedFromLogros(flat, getCategoryGrade);
  }
  if (notaActual == null) {
    notaActual = orderedGrades.length > 0 ? promedio(orderedGrades) : 0;
  }
  if (Number.isNaN(notaActual)) notaActual = orderedGrades.length ? promedio(orderedGrades) : 0;

  const primeras3 = orderedGrades.slice(0, 3);
  const ultimas3 = orderedGrades.slice(-3);
  const tendencia = promedio(ultimas3) - promedio(primeras3);
  const prediccion = Math.max(0, Math.min(100, notaActual + tendencia * 0.3));

  const sparklineData = orderedGrades.map((value) => ({ value }));

  return {
    prediccion: Math.round(prediccion),
    tendencia,
    sparklineData: sparklineData.length > 0 ? sparklineData : [{ value: notaActual }],
    notaActual,
  };
}

// =========================================================
// SEMÁFORO DE COLOR
// =========================================================

function gradeColor(value: number | string | undefined | null): { text: string; bg: string; border: string } {
  if (value === '' || value === undefined || value === null)
    return { text: 'text-white/40', bg: 'bg-transparent', border: 'border-white/[0.06]' };
  const n = Number(value);
  if (Number.isNaN(n)) return { text: 'text-white/40', bg: 'bg-transparent', border: 'border-white/[0.06]' };
  if (n < 65) return { text: 'text-red-400', bg: 'bg-red-500/[0.10]', border: 'border-red-500/30' };
  if (n < 75) return { text: 'text-yellow-400', bg: 'bg-yellow-500/[0.08]', border: 'border-yellow-500/25' };
  return { text: 'text-emerald-400', bg: 'bg-emerald-500/[0.08]', border: 'border-emerald-500/25' };
}

// =========================================================
// CELDA DE NOTA (mini card)
// =========================================================

function NoteCell({
  value,
  onSave,
}: {
  assignmentId: string;
  estudianteId: string;
  value: number | string;
  onSave: (calificacion: number | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [local, setLocal] = useState(() => (value === '' ? '' : String(value)));
  const prevValue = useRef(value);
  if (prevValue.current !== value && !editing) {
    prevValue.current = value;
    setLocal(value === '' ? '' : String(value));
  }
  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    setEditing(false);
    const raw = e.target?.value ?? local;
    const trimmed = String(raw).trim();
    if (trimmed === '') {
      onSave(null);
      setLocal('');
      return;
    }
    const n = parseFloat(trimmed);
    if (!Number.isNaN(n) && n >= 0 && n <= 100) {
      onSave(n);
      setLocal(trimmed);
    } else {
      setLocal(value === '' ? '' : String(value));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const input = e.currentTarget;
      const raw = input.value ?? local;
      const trimmed = String(raw).trim();
      setEditing(false);
      if (trimmed === '') {
        onSave(null);
        setLocal('');
      } else {
        const n = parseFloat(trimmed);
        if (!Number.isNaN(n) && n >= 0 && n <= 100) {
          onSave(n);
          setLocal(trimmed);
        } else {
          setLocal(value === '' ? '' : String(value));
        }
      }
      input.blur();
    }
    if (e.key === 'Escape') {
      setLocal(value === '' ? '' : String(value));
      setEditing(false);
      e.currentTarget.blur();
    }
  };

  const isEmpty = value === '' || value === undefined;

  if (editing) {
    return (
      <div className="w-full flex items-center justify-center p-0 overflow-hidden rounded-[12px]" onClick={(e) => e.stopPropagation()}>
        <input
          type="number"
          min={0}
          max={100}
          placeholder="—"
          value={local}
          onChange={(e) => setLocal(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          autoFocus
          className="w-full h-full min-h-[44px] text-center font-semibold rounded-[12px] bg-white/[0.06] border border-white/[0.08] text-[#E2E8F0] focus:border-[#3B82F6] focus:ring-1 focus:ring-[#3B82F6] outline-none transition-all duration-200 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        />
      </div>
    );
  }

  const gc = gradeColor(isEmpty ? '' : local);
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={(e) => {
        e.stopPropagation();
        setEditing(true);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          setEditing(true);
        }
      }}
      className={`flex items-center justify-center w-full min-h-[44px] py-2.5 rounded-[12px] font-medium cursor-text border transition-colors duration-150 hover:bg-[rgba(59,130,246,0.15)] hover:border-[rgba(59,130,246,0.4)] overflow-hidden ${gc.bg} ${gc.border}`}
    >
      {isEmpty ? <span className="text-white/40">—</span> : <span className={`tabular-nums ${gc.text}`}>{String(value)}</span>}
    </div>
  );
}

// =========================================================
// AVATAR ESTUDIANTE
// =========================================================

function StudentAvatar({ nombre }: { nombre: string }) {
  const initials = nombre
    .split(' ')
    .map((n) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();
  return (
    <div
      className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-semibold flex-shrink-0"
      style={{
        background: 'linear-gradient(145deg, #3B82F6, #1E40AF)',
      }}
    >
      {initials}
    </div>
  );
}

// =========================================================
// CELDA PREDICCIÓN (solo pronóstico de la IA integrada; si no hay dato, "—")
// =========================================================

function PredictionCellFromAI({ courseId, studentId, tendencia }: { courseId: string; studentId: string; tendencia?: number }) {
  const { data: forecast } = useForecast(courseId, studentId);
  const value = forecast?.projectedFinalGrade ?? null;
  const display = value != null && !Number.isNaN(value) ? Math.round(value * 10) / 10 : null;
  const gc = gradeColor(display);

  return (
    <div className="flex flex-col items-center justify-center gap-0.5 py-1">
      <span className="text-[9px] uppercase tracking-widest text-white/40 leading-none">Proyección</span>
      <div className="flex items-center gap-1">
        <span className={`text-[20px] font-semibold tabular-nums ${display != null ? gc.text : 'text-white/40'}`}>
          {display != null ? display : '—'}
        </span>
        {display != null && <span className="text-white/50 text-[10px]">/ 100</span>}
        {tendencia != null && tendencia > 2 && <TrendingUp className="h-3.5 w-3.5 text-emerald-400 shrink-0" />}
        {tendencia != null && tendencia < -2 && <TrendingDown className="h-3.5 w-3.5 text-red-400 shrink-0" />}
      </div>
    </div>
  );
}

// =========================================================
// FILA ESTUDIANTE (grid)
// =========================================================

function StudentRow({
  student,
  assignments,
  gridTemplateColumns,
  getGradeFor,
  getPromedioForDisplay,
  getTendencia,
  onSaveGrade,
  courseId,
  onStudentClick,
}: {
  student: Student;
  assignments: Assignment[];
  gridTemplateColumns: string;
  getGradeFor: (studentId: string, assignmentId: string) => number | string;
  getPromedioForDisplay: (studentId: string) => number | string;
  getTendencia: (studentId: string) => number;
  onSaveGrade: (assignmentId: string, estudianteId: string, calificacion: number | null) => void;
  courseId: string;
  onStudentClick: (studentId: string) => void;
}) {
  const promedio = getPromedioForDisplay(student._id);
  const tendencia = getTendencia(student._id);

  return (
    <div
      className="grid items-center gap-x-2 gap-y-1 min-h-[68px] py-2 border-b border-white/[0.06] transition-colors duration-150 hover:bg-white/[0.025]"
      style={{ gridTemplateColumns }}
    >
      <div
        className="flex items-center gap-3 pl-2 cursor-pointer group sticky left-0 z-10 pr-2 py-1 rounded-r-lg min-w-0 border-r border-white/[0.06]"
        style={{ background: 'linear-gradient(145deg, rgba(30, 58, 138, 0.95), rgba(15, 23, 42, 0.98))' }}
        onClick={() => onStudentClick(student._id)}
      >
        <StudentAvatar nombre={student.nombre} />
        <span className="font-medium text-[#E2E8F0] text-sm leading-snug line-clamp-2 group-hover:text-[#3B82F6] transition-colors">
          {student.nombre}
        </span>
      </div>
      {assignments.map((assignment) => (
        <div key={assignment._id} className="flex items-center justify-center min-w-0 px-0.5 bg-transparent">
          <NoteCell
            assignmentId={assignment._id}
            estudianteId={student._id}
            value={getGradeFor(student._id, assignment._id)}
            onSave={(calificacion) => onSaveGrade(assignment._id, student._id, calificacion)}
          />
        </div>
      ))}
      {/* Columna PROMEDIO: mismo valor que la tarjeta de la materia (promedio ponderado por logros) */}
      <div className="flex items-center justify-center">
        {(() => {
          const gc = gradeColor(promedio === '—' ? '' : promedio);
          return (
            <div className={`rounded-[12px] border px-2 py-1.5 min-w-[60px] text-center ${gc.bg} ${gc.border}`}>
              <span className={`text-sm font-semibold ${promedio === '—' ? 'text-white/40' : gc.text}`}>
                {typeof promedio === 'number' ? promedio.toFixed(1) : promedio}
              </span>
              {promedio !== '—' && <span className="text-white/50 text-[10px] ml-0.5">/ 100</span>}
            </div>
          );
        })()}
      </div>
      {/* Columna PREDICCIÓN: pronóstico de la IA integrada (API forecast); si no hay dato, "—" */}
      <div className="flex items-center justify-center pr-2">
        <PredictionCellFromAI courseId={courseId} studentId={student._id} tendencia={tendencia} />
      </div>
    </div>
  );
}

// =========================================================
// PÁGINA PRINCIPAL
// =========================================================

export default function CourseGradesTablePage() {
  const [, params] = useRoute('/course/:cursoId/grades');
  const cursoId = params?.cursoId || '';
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const TAB_VISTA_COMPLETA = '__completa__';
  const TAB_SIN_LOGRO = 'sin-logro';
  /** Dentro de un logro: columnas de todos sus indicadores a la vez */
  const TAB_LOGRO_TODOS_INDICADORES = '__logro_todos_indicadores__';

  const [activePrimaryTab, setActivePrimaryTab] = useState<string>(TAB_VISTA_COMPLETA);
  const [activeIndicadorTab, setActiveIndicadorTab] = useState<string>(TAB_LOGRO_TODOS_INDICADORES);
  const [trimestreActivo, setTrimestreActivo] = useState<1 | 2 | 3>(() =>
    typeof window !== 'undefined' ? parseTrimestreFromSearch(window.location.search) : defaultAcademicTrimestre()
  );
  const [showInlineAssignment, setShowInlineAssignment] = useState(false);

  const displayGroupId =
    cursoId && cursoId.length === 24 && /^[0-9a-fA-F]{24}$/.test(cursoId)
      ? cursoId
      : (cursoId || '').toUpperCase().trim();

  const { data: groupInfo } = useQuery<{ _id: string; id: string; nombre: string }>({
    queryKey: ['group', cursoId],
    queryFn: () => apiRequest('GET', `/api/groups/${encodeURIComponent(cursoId)}`),
    enabled: !!cursoId,
    staleTime: 5 * 60 * 1000,
  });
  const groupDisplayName = (groupInfo?.nombre?.trim() || displayGroupId) as string;

  const { data: subjectsForGroup = [], isLoading: isLoadingSubjects } = useQuery<CourseSubject[]>({
    queryKey: ['subjectsForGroup', cursoId],
    queryFn: () => fetchSubjectsForGroup(cursoId),
    enabled: !!cursoId && user?.rol === 'profesor',
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const searchStr = typeof window !== 'undefined' ? window.location.search : '';
  const gsFromQuery = new URLSearchParams(searchStr).get('gs') || '';
  const returnToFromQuery = new URLSearchParams(searchStr).get('returnTo') || '';

  useEffect(() => {
    setTrimestreActivo(parseTrimestreFromSearch(window.location.search));
  }, [cursoId]);

  useEffect(() => {
    const onPopState = () => {
      setTrimestreActivo(parseTrimestreFromSearch(window.location.search));
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const firstSubjectId = useMemo(() => {
    if (!subjectsForGroup.length) return '';
    if (gsFromQuery && subjectsForGroup.some((s) => s._id === gsFromQuery)) return gsFromQuery;
    return subjectsForGroup[0]._id;
  }, [subjectsForGroup, gsFromQuery]);

  const { data: students = [], isLoading: isLoadingStudents } = useQuery<Student[]>({
    queryKey: ['students', cursoId],
    queryFn: () => fetchStudentsByGroup(cursoId),
    enabled: !!cursoId && user?.rol === 'profesor',
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const { data: assignmentsForTable = [], isLoading: isLoadingGradeTable } = useQuery<Assignment[]>({
    queryKey: ['gradeTableAssignments', cursoId, firstSubjectId, trimestreActivo],
    queryFn: () => fetchGradeTableAssignments(displayGroupId, firstSubjectId || '', trimestreActivo),
    enabled: !!cursoId && !!firstSubjectId && user?.rol === 'profesor',
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });

  const { data: logrosData, isLoading: isLoadingLogros } = useQuery<LogrosResponse>({
    queryKey: ['/api/logros-calificacion', firstSubjectId],
    queryFn: () =>
      apiRequest<LogrosResponse>(
        'GET',
        `/api/logros-calificacion?courseId=${encodeURIComponent(firstSubjectId || '')}`
      ),
    enabled: !!firstSubjectId && user?.rol === 'profesor',
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const logrosBloquesSorted = useMemo(
    () => [...(logrosData?.logros ?? [])].sort((a, b) => (a.orden ?? 999) - (b.orden ?? 999)),
    [logrosData?.logros]
  );

  const flatIndicadoresOrdered = useMemo(() => {
    type Row = { _id: string; nombre: string; porcentaje: number; orden: number; grupoTitle: string };
    const out: Row[] = [];
    const logrosBloques = logrosData?.logros ?? [];
    const sortedL = [...logrosBloques].sort((a, b) => (a.orden ?? 999) - (b.orden ?? 999));
    for (const L of sortedL) {
      const raw = (L.descripcion ?? '').trim();
      const grupoTitle = raw.length > 0 ? (raw.length > 52 ? `${raw.slice(0, 52)}…` : raw) : 'Logro';
      const inds = [...(L.indicadores ?? [])].sort((a, b) => (a.orden ?? 999) - (b.orden ?? 999));
      for (const ind of inds) {
        const id = String(ind._id ?? '');
        if (!id) continue;
        out.push({
          _id: id,
          nombre: ind.nombre,
          porcentaje: ind.porcentaje,
          orden: ind.orden ?? 0,
          grupoTitle,
        });
      }
    }
    return out;
  }, [logrosData]);

  const outcomeNodesForGrades = useMemo((): OutcomeGradeNode[] => {
    const logrosBloques = logrosData?.logros ?? [];
    return logrosBloques.map((L) => ({
      id: String(L._id),
      pesoEnCurso: L.pesoEnCurso,
      indicadores: (L.indicadores ?? []).map((i) => ({ id: String(i._id), porcentaje: i.porcentaje })),
    }));
  }, [logrosData]);

  /** Agrupa assignments por indicador (grading_category_id). */
  const assignmentsByIndicador = useMemo(() => {
    const logrosOrdenados = flatIndicadoresOrdered;
    const grouped: Record<string, { logro: LogroCalificacion; assignments: Assignment[] }> = {};
    logrosOrdenados.forEach((ind) => {
      const kid = String(ind._id);
      grouped[kid] = {
        logro: { _id: kid, nombre: ind.nombre, porcentaje: ind.porcentaje, orden: ind.orden },
        assignments: [],
      };
    });
    const sinLogro: Assignment[] = [];
    assignmentsForTable.forEach((assignment) => {
      const categoryId = assignment.logroCalificacionId;
      if (categoryId) {
        const idStr = String(categoryId);
        if (grouped[idStr]) {
          grouped[idStr].assignments.push(assignment);
        } else {
          sinLogro.push(assignment);
        }
      } else {
        sinLogro.push(assignment);
      }
    });
    if (sinLogro.length > 0) {
      grouped['sin-logro'] = {
        logro: { _id: 'sin-logro', nombre: 'Sin categoría', porcentaje: 0, orden: 999 },
        assignments: sinLogro,
      };
    }
    return grouped;
  }, [assignmentsForTable, flatIndicadoresOrdered]);

  const orderedColumnsForVista = useMemo(() => {
    const cols: { assignment: Assignment; grupoTitle: string }[] = [];
    for (const ind of flatIndicadoresOrdered) {
      const g = assignmentsByIndicador[ind._id];
      const sorted = (g?.assignments ?? []).slice().sort(
        (a, b) => new Date(a.fechaEntrega).getTime() - new Date(b.fechaEntrega).getTime()
      );
      for (const a of sorted) cols.push({ assignment: a, grupoTitle: ind.grupoTitle });
    }
    const sin = assignmentsByIndicador['sin-logro']?.assignments ?? [];
    const sinSorted = sin.slice().sort(
      (a, b) => new Date(a.fechaEntrega).getTime() - new Date(b.fechaEntrega).getTime()
    );
    for (const a of sinSorted) cols.push({ assignment: a, grupoTitle: 'Sin categoría' });
    return cols;
  }, [flatIndicadoresOrdered, assignmentsByIndicador]);

  const parentHeaderSegments = useMemo(() => {
    const segs: { title: string; span: number }[] = [];
    let i = 0;
    while (i < orderedColumnsForVista.length) {
      const t = orderedColumnsForVista[i].grupoTitle;
      let j = i;
      while (j < orderedColumnsForVista.length && orderedColumnsForVista[j].grupoTitle === t) j++;
      segs.push({ title: t, span: j - i });
      i = j;
    }
    return segs;
  }, [orderedColumnsForVista]);

  const filterMenuSummary = useMemo(() => {
    if (activePrimaryTab === TAB_VISTA_COMPLETA) return 'Vista completa';
    if (activePrimaryTab === TAB_SIN_LOGRO) return 'Sin categoría';
    const bloque = logrosBloquesSorted.find((L) => String(L._id) === String(activePrimaryTab));
    const logroNombre = (bloque?.descripcion ?? '').trim() || 'Logro';
    if (activeIndicadorTab === TAB_LOGRO_TODOS_INDICADORES) return logroNombre;
    const ind = flatIndicadoresOrdered.find((x) => String(x._id) === String(activeIndicadorTab));
    const indNombre = (ind?.nombre ?? '').trim();
    return indNombre ? `${logroNombre} → ${indNombre}` : logroNombre;
  }, [
    activePrimaryTab,
    activeIndicadorTab,
    logrosBloquesSorted,
    flatIndicadoresOrdered,
  ]);

  useEffect(() => {
    setActivePrimaryTab(TAB_VISTA_COMPLETA);
    setActiveIndicadorTab(TAB_LOGRO_TODOS_INDICADORES);
  }, [trimestreActivo]);

  const activeAssignments = useMemo(() => {
    if (activePrimaryTab === TAB_VISTA_COMPLETA) {
      return orderedColumnsForVista.map((c) => c.assignment);
    }
    if (activePrimaryTab === TAB_SIN_LOGRO) {
      return assignmentsByIndicador[TAB_SIN_LOGRO]?.assignments ?? [];
    }
    const bloque = logrosBloquesSorted.find((L) => String(L._id) === String(activePrimaryTab));
    if (!bloque) return [];
    const indIds = (bloque.indicadores ?? [])
      .map((i) => String(i._id ?? ''))
      .filter(Boolean);
    if (activeIndicadorTab === TAB_LOGRO_TODOS_INDICADORES) {
      const all: Assignment[] = [];
      for (const id of indIds) {
        const g = assignmentsByIndicador[id];
        if (g?.assignments?.length) all.push(...g.assignments);
      }
      return all.sort((a, b) => new Date(a.fechaEntrega).getTime() - new Date(b.fechaEntrega).getTime());
    }
    const indKey = String(activeIndicadorTab);
    return assignmentsByIndicador[indKey]?.assignments ?? [];
  }, [
    activePrimaryTab,
    activeIndicadorTab,
    orderedColumnsForVista,
    assignmentsByIndicador,
    logrosBloquesSorted,
  ]);

  const gradeGridTemplate = useMemo(
    () => buildGradesGridColumns(activeAssignments.length),
    [activeAssignments.length]
  );

  /** Todas las asignaciones del curso, para calcular el promedio global (mismo valor en vista por categoría y vista completa). */
  const allAssignmentsForPromedio = useMemo(
    () =>
      (Object.values(assignmentsByIndicador) as { logro: LogroCalificacion; assignments: Assignment[] }[])
        .flatMap((g) => g.assignments)
        .sort((a, b) => new Date(a.fechaEntrega).getTime() - new Date(b.fechaEntrega).getTime()),
    [assignmentsByIndicador]
  );

  const gradeTableQueryKey = useMemo(
    () => ['gradeTableAssignments', cursoId, firstSubjectId, trimestreActivo] as const,
    [cursoId, firstSubjectId, trimestreActivo]
  );

  const updateGradeMutation = useMutation({
    mutationFn: async ({
      assignmentId,
      estudianteId,
      calificacion,
    }: {
      assignmentId: string;
      estudianteId: string;
      calificacion: number | null;
    }) => {
      return apiRequest('PUT', `/api/assignments/${assignmentId}/grade`, {
        estudianteId,
        calificacion: calificacion != null ? Math.min(100, Math.max(0, Number(calificacion))) : null,
        manualOverride: true,
      });
    },
    onMutate: async (vars) => {
      await queryClient.cancelQueries({ queryKey: gradeTableQueryKey });
      const previous = queryClient.getQueryData<Assignment[]>([...gradeTableQueryKey]);
      queryClient.setQueryData<Assignment[]>([...gradeTableQueryKey], (old) => {
        if (!old) return old;
        const sid = String(vars.estudianteId);
        return old.map((a) => {
          if (String(a._id) !== String(vars.assignmentId)) return a;
          const subs = [...(a.submissions ?? a.entregas ?? [])];
          const idx = subs.findIndex((s) => {
            const x = s as { estudianteId?: string; studentId?: string; student_id?: string };
            const id = x.estudianteId ?? x.studentId ?? x.student_id;
            return String(id) === sid;
          });
          const nextCal = vars.calificacion;
          if (idx >= 0) {
            const copy = { ...subs[idx] } as Submission & { score?: number };
            if (nextCal == null) {
              copy.calificacion = undefined;
              copy.score = undefined;
            } else {
              copy.calificacion = nextCal;
              copy.score = nextCal;
            }
            subs[idx] = copy;
          } else if (nextCal != null) {
            subs.push({ estudianteId: sid, calificacion: nextCal });
          }
          return { ...a, submissions: subs, entregas: subs };
        });
      });
      return { previous };
    },
    onError: (err: Error, _vars, ctx) => {
      if (ctx?.previous) queryClient.setQueryData([...gradeTableQueryKey], ctx.previous);
      toast({ title: 'Error', description: err.message || 'No se pudo actualizar la nota', variant: 'destructive' });
    },
  });

  const getGradeFor = (studentId: string, assignmentId: string): number | string => {
    const aid = String(assignmentId);
    const sid = String(studentId);
    const assignment = assignmentsForTable.find((a) => String(a._id) === aid);
    if (!assignment) return '';
    const subs = assignment.submissions || assignment.entregas || [];
    const sub = subs.find((x: { estudianteId?: string; studentId?: string; student_id?: string; userId?: string; user_id?: string }) => {
      const xId = x.estudianteId ?? x.studentId ?? x.student_id ?? x.userId ?? x.user_id;
      return String(xId) === sid;
    });
    const cal = (sub as { calificacion?: number; score?: number })?.calificacion ?? (sub as { calificacion?: number; score?: number })?.score;
    return cal != null && !Number.isNaN(Number(cal)) ? Number(cal) : '';
  };

  /** Promedio: indicadores dentro de cada logro; luego peso entre logros. N/A no cuenta; 0 sí. */
  const getPromedioFor = (estudianteId: string): number | string => {
    const score = (a: Assignment): number | null => {
      const v = getGradeFor(estudianteId, a._id);
      if (v === '' || v === undefined) return null;
      const n = Number(v);
      return Number.isNaN(n) ? null : n;
    };
    const getCat = (catId: string): number | null => {
      const grp = assignmentsByIndicador[catId];
      if (!grp?.assignments?.length) return null;
      return weightedGradeWithinLogro(
        grp.assignments.map((x) => ({ categoryWeightPct: x.categoryWeightPct ?? null })),
        grp.assignments.map((x) => score(x))
      );
    };
    let course: number | null =
      outcomeNodesForGrades.length > 0 ? courseGradeFromOutcomes(outcomeNodesForGrades, getCat) : null;
    if (course == null) {
      const flat: { _id: string; porcentaje: number }[] = [];
      for (const [, { logro }] of Object.entries(assignmentsByIndicador)) {
        if (logro._id === 'sin-logro' || (logro.porcentaje ?? 0) <= 0) continue;
        flat.push({ _id: logro._id, porcentaje: logro.porcentaje });
      }
      course = courseWeightedFromLogros(flat, getCat);
    }
    if (course == null) {
      const all: number[] = [];
      allAssignmentsForPromedio.forEach((a) => {
        const s = score(a);
        if (hasRecordedScore(s)) all.push(Number(s));
      });
      if (all.length === 0) return '—';
      course = all.reduce((x, y) => x + y, 0) / all.length;
    }
    const rounded = Math.round(course * 10) / 10;
    return Number.isNaN(rounded) ? '—' : rounded;
  };

  const getPredictionDataFor = (estudianteId: string) =>
    calcularPrediccion(estudianteId, assignmentsByIndicador, outcomeNodesForGrades);

  /** En Vista completa: promedio final ponderado. En una categoría: solo el promedio de esa categoría. Evita NaN. */
  const getPromedioForDisplay = (estudianteId: string): number | string => {
    if (activePrimaryTab === TAB_VISTA_COMPLETA) return getPromedioFor(estudianteId);
    if (activeAssignments.length === 0) return '—';
    const score = (a: Assignment): number | null => {
      const v = getGradeFor(estudianteId, a._id);
      if (v === '' || v === undefined) return null;
      const n = Number(v);
      return Number.isNaN(n) ? null : n;
    };
    const g = weightedGradeWithinLogro(
      activeAssignments.map((x) => ({ categoryWeightPct: x.categoryWeightPct ?? null })),
      activeAssignments.map((x) => score(x))
    );
    if (g == null) return '—';
    const result = Math.round(g * 10) / 10;
    return Number.isNaN(result) ? '—' : result;
  };

  /** Contexto del filtro (logro/indicador): se muestra arriba de la tabla; la columna solo dice «Promedio». */
  const gradesTableContextBanner = useMemo((): string | null => {
    if (activePrimaryTab === TAB_VISTA_COMPLETA) return null;
    if (activePrimaryTab === TAB_SIN_LOGRO) return 'Actividades sin categoría de logro asignada.';
    const bloque = logrosBloquesSorted.find((L) => String(L._id) === String(activePrimaryTab));
    if (!bloque) return null;
    const desc = (bloque.descripcion ?? '').trim();
    if (activeIndicadorTab === TAB_LOGRO_TODOS_INDICADORES) {
      return desc.length > 0 ? desc : null;
    }
    const ind = flatIndicadoresOrdered.find((x) => String(x._id) === String(activeIndicadorTab));
    const indName = (ind?.nombre ?? '').trim();
    if (indName && desc) return `${indName} — ${desc}`;
    return indName || desc || null;
  }, [activePrimaryTab, activeIndicadorTab, logrosBloquesSorted, flatIndicadoresOrdered]);

  const loading = isLoadingSubjects || isLoadingStudents || isLoadingGradeTable || isLoadingLogros;
  const showTrimesterEmptyState = students.length > 0 && assignmentsForTable.length === 0;
  const showFilteredLogroEmptyState =
    !loading &&
    students.length > 0 &&
    !showTrimesterEmptyState &&
    activePrimaryTab !== TAB_VISTA_COMPLETA &&
    activeAssignments.length === 0;
  const filteredEmptyMessage =
    activePrimaryTab === TAB_SIN_LOGRO
      ? 'No hay actividades sin categoría en este trimestre.'
      : activeIndicadorTab !== TAB_LOGRO_TODOS_INDICADORES
        ? 'No hay notas para este indicador.'
        : 'No hay notas para este logro.';
  const hasSinLogroAssignments =
    (assignmentsByIndicador[TAB_SIN_LOGRO]?.assignments?.length ?? 0) > 0;

  const trimestreLabel = trimestreActivo === 1 ? 'I' : trimestreActivo === 2 ? 'II' : 'III';

  useEffect(() => {
    if (user && user.rol !== 'profesor') setLocation('/courses');
  }, [user, setLocation]);

  const subjectLabel =
    subjectsForGroup.find((s) => s._id === firstSubjectId)?.nombre ?? subjectsForGroup[0]?.nombre ?? 'Notas';
  const pageTitle = `${groupDisplayName} – ${subjectLabel}`;
  const initialIndicadorDesdeFiltro =
    activeIndicadorTab !== TAB_LOGRO_TODOS_INDICADORES &&
    activePrimaryTab !== TAB_VISTA_COMPLETA &&
    activePrimaryTab !== TAB_SIN_LOGRO
      ? activeIndicadorTab
      : '';
  const backToCourseHref =
    returnToFromQuery
      ? returnToFromQuery
      : gsFromQuery && subjectsForGroup.some((s) => s._id === gsFromQuery)
        ? `/course-detail/${cursoId}/materia/${gsFromQuery}`
        : `/course-detail/${cursoId}`;

  return (
    <div
      className="min-h-[calc(100vh-8rem)] w-full max-w-full overflow-x-auto relative flex flex-col"
      style={{ fontFamily: 'Inter, system-ui, sans-serif' }}
    >
      <div className="relative z-10 w-full flex-1 flex flex-col min-h-0">
        <div className="mb-4 flex-shrink-0">
          <NavBackButton to={backToCourseHref} label="Volver al curso" />
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.35 }}
          className="w-full flex-1 flex flex-col min-h-0 min-w-0"
        >
          <header className="mb-6 flex-shrink-0">
            <h1 className="text-2xl font-semibold text-[#E2E8F0] mb-4" style={{ fontFamily: 'Inter' }}>
              {pageTitle}
            </h1>

            {showInlineAssignment && firstSubjectId ? (
              <GradesInlineAssignmentPanel
                key={`inline-${trimestreActivo}-${firstSubjectId}-${initialIndicadorDesdeFiltro}`}
                cursoId={cursoId}
                displayGroupId={displayGroupId}
                groupSubjectId={firstSubjectId}
                subjectNombre={subjectLabel}
                groupDisplayName={groupDisplayName}
                trimestre={trimestreActivo}
                initialIndicadorId={initialIndicadorDesdeFiltro}
                onClose={() => setShowInlineAssignment(false)}
              />
            ) : null}

            <div className="flex flex-wrap items-center gap-2 mb-4">
              <Button
                size="sm"
                className="rounded-[10px] bg-gradient-to-r from-[#002366] to-[#1e3cff] hover:opacity-90 text-white border-0 shadow-sm transition-opacity duration-150 shrink-0"
                disabled={!firstSubjectId}
                title={!firstSubjectId ? 'Espera a cargar la materia o elige una desde el curso' : undefined}
                onClick={() => {
                  if (!firstSubjectId) return;
                  setShowInlineAssignment((prev) => !prev);
                }}
              >
                <Plus className="h-4 w-4 mr-2 shrink-0" />
                {showInlineAssignment ? 'Cerrar' : 'Nueva asignación'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className={cn(
                  'rounded-[10px] border-white/20 bg-white/[0.04] text-[#E2E8F0] hover:bg-white/10 shrink-0 grades-toolbar-btn-analytics'
                )}
                onClick={() => {
                  const inner = buildGradesTableSearchParams({
                    gs: firstSubjectId,
                    trimestre: trimestreActivo,
                    returnTo: returnToFromQuery || undefined,
                  });
                  const qs = inner ? `?${inner}` : '';
                  setLocation(`/course/${cursoId}/analytics${qs}`);
                }}
              >
                Vista analítica
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="rounded-[10px] border-white/10 text-[#E2E8F0] hover:bg-white/5 shrink-0"
                onClick={() => {
                  const gradesQs = buildGradesTableSearchParams({
                    gs: firstSubjectId,
                    trimestre: trimestreActivo,
                    returnTo: returnToFromQuery || undefined,
                  });
                  const returnPath = `/course/${cursoId}/grades${gradesQs ? `?${gradesQs}` : ''}`;
                  const q = new URLSearchParams();
                  q.set('returnTo', returnPath);
                  if (firstSubjectId) q.set('gs', firstSubjectId);
                  setLocation(`/course/${cursoId}/calificacion-logros?${q.toString()}`);
                }}
              >
                <Percent className="h-4 w-4 mr-2 shrink-0" />
                Logros de Calificación
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-[10px] border-white/10 text-[#E2E8F0] hover:bg-white/5 gap-1.5 min-w-0 max-w-[min(100%,20rem)] shrink"
                  >
                    <ListFilter className="h-4 w-4 shrink-0 opacity-90" />
                    <span className="truncate">Filtro</span>
                    <span className="text-white/45 text-xs font-normal truncate hidden sm:inline max-w-[10rem]">
                      · {filterMenuSummary}
                    </span>
                    <ChevronDown className="h-4 w-4 shrink-0 opacity-70" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-[min(100vw-2rem,22rem)] max-h-[min(70vh,28rem)] border-white/10 bg-[#0f172a]/95 backdrop-blur-xl">
                  <DropdownMenuLabel className="text-white/90 text-xs font-semibold uppercase tracking-wide">
                    Vista y logros
                  </DropdownMenuLabel>
                  <DropdownMenuItem
                    className="cursor-pointer"
                    onSelect={() => {
                      setActivePrimaryTab(TAB_VISTA_COMPLETA);
                      setActiveIndicadorTab(TAB_LOGRO_TODOS_INDICADORES);
                    }}
                  >
                    Vista completa
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-white/10" />
                  {logrosBloquesSorted.map((L) => {
                    const inds = [...(L.indicadores ?? [])].sort((a, b) => (a.orden ?? 999) - (b.orden ?? 999));
                    const logroTitle = (L.descripcion ?? '').trim() || 'Logro';
                    const shortTitle = logroTitle.length > 52 ? `${logroTitle.slice(0, 52)}…` : logroTitle;
                    const bloqueId = String(L._id);
                    return (
                      <div key={bloqueId} className="py-0.5 border-b border-white/[0.06] last:border-b-0">
                        <DropdownMenuLabel
                          className="text-[11px] text-white/45 font-normal px-2 py-1.5 whitespace-normal leading-snug"
                          title={logroTitle}
                        >
                          {shortTitle}
                        </DropdownMenuLabel>
                        <DropdownMenuItem
                          className="cursor-pointer pl-4"
                          onSelect={() => {
                            setActivePrimaryTab(bloqueId);
                            setActiveIndicadorTab(TAB_LOGRO_TODOS_INDICADORES);
                          }}
                        >
                          Ver todo el logro
                        </DropdownMenuItem>
                        {inds.map((ind) => {
                          const indId = String(ind._id ?? '');
                          if (!indId) return null;
                          return (
                            <DropdownMenuItem
                              key={indId}
                              className="cursor-pointer pl-4 whitespace-normal items-start py-2"
                              onSelect={() => {
                                setActivePrimaryTab(bloqueId);
                                setActiveIndicadorTab(indId);
                              }}
                            >
                              <span className="text-sm leading-snug text-[#E2E8F0]">
                                {(ind.nombre ?? '').trim() || 'Indicador'} ({ind.porcentaje}%)
                              </span>
                            </DropdownMenuItem>
                          );
                        })}
                      </div>
                    );
                  })}
                  {hasSinLogroAssignments ? (
                    <>
                      <DropdownMenuSeparator className="bg-white/10" />
                      <DropdownMenuItem
                        className="cursor-pointer"
                        onSelect={() => {
                          setActivePrimaryTab(TAB_SIN_LOGRO);
                          setActiveIndicadorTab(TAB_LOGRO_TODOS_INDICADORES);
                        }}
                      >
                        Sin categoría
                      </DropdownMenuItem>
                    </>
                  ) : null}
                </DropdownMenuContent>
              </DropdownMenu>

              <div className="flex-1 min-w-[1rem]" aria-hidden />

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-[10px] border-white/10 text-[#E2E8F0] hover:bg-white/5 shrink-0 gap-1.5"
                  >
                    Trimestre · {trimestreLabel}
                    <ChevronDown className="h-4 w-4 opacity-70" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-[10rem] border-white/10 bg-[#0f172a]/95 backdrop-blur-xl">
                  {([1, 2, 3] as const).map((n) => (
                    <DropdownMenuItem
                      key={n}
                      className={cn('cursor-pointer', trimestreActivo === n && 'bg-white/10')}
                      onSelect={() => {
                        setTrimestreActivo(n);
                        const qs = buildGradesTableSearchParams({
                          gs: firstSubjectId,
                          trimestre: n,
                          returnTo: returnToFromQuery || undefined,
                        });
                        setLocation(`/course/${cursoId}/grades?${qs}`);
                      }}
                    >
                      {n === 1 ? 'I' : n === 2 ? 'II' : 'III'} trimestre
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

          </header>

          {loading ? (
            <div className="space-y-3 py-8 flex-1">
              <Skeleton className="h-[72px] w-full rounded-xl bg-white/10" />
              <Skeleton className="h-[72px] w-full rounded-xl bg-white/10" />
              <Skeleton className="h-[72px] w-full rounded-xl bg-white/10" />
              <Skeleton className="h-[72px] w-full rounded-xl bg-white/10" />
            </div>
          ) : students.length > 0 ? (
            <div className="flex-1 min-h-0 w-full rounded-xl border border-white/[0.08] bg-white/[0.02] backdrop-blur-md shadow-[0_0_40px_rgba(37,99,235,0.12)] overflow-hidden">
            <div className="overflow-x-auto overflow-y-auto h-full w-full">
              {showTrimesterEmptyState ? (
                <div className="min-w-[min(100%,560px)] px-2 sm:px-4 py-2">
                  <div
                    className="sticky top-0 z-20 grid items-center gap-2 min-h-[56px] py-3 border-b border-white/[0.08] text-xs font-semibold uppercase tracking-wider text-white/80 mb-0"
                    style={{
                      gridTemplateColumns: buildGradesGridColumns(0),
                      background: 'rgba(255,255,255,0.03)',
                    }}
                  >
                    <div
                      className="pl-1 sticky left-0 z-30 pr-2 -ml-px"
                      style={{ background: 'linear-gradient(145deg, rgba(30, 58, 138, 0.95), rgba(15, 23, 42, 0.98))' }}
                    >
                      Estudiante
                    </div>
                    <div className="text-center">Promedio</div>
                    <div className="text-center pr-2">Predicción</div>
                  </div>
                  <div className="py-16 text-center">
                    <p className="text-white/75 text-lg font-medium">El trimestre no ha comenzado</p>
                    <p className="text-white/45 text-sm mt-2">No hay actividades cargadas para este trimestre.</p>
                  </div>
                </div>
              ) : showFilteredLogroEmptyState ? (
                <div className="px-4 sm:px-6 py-16 text-center">
                  <p className="text-white/85 text-lg font-medium">{filteredEmptyMessage}</p>
                  <p className="text-white/45 text-sm mt-2 max-w-md mx-auto">
                    El filtro ya está aplicado: no hay columnas de tareas para esta selección. Prueba «Vista completa» en Filtro u otro logro o indicador.
                  </p>
                </div>
              ) : (
                <div className="px-2 sm:px-3 pt-2 pb-1 min-w-0">
                  {gradesTableContextBanner ? (
                    <div
                      className="mb-3 rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-3 sm:px-5 sm:py-3.5"
                      role="note"
                    >
                      <p className="text-sm sm:text-base leading-relaxed text-white/[0.88] break-words">
                        {gradesTableContextBanner}
                      </p>
                    </div>
                  ) : null}
                  {/* Header: en Vista completa dos filas (categorías + asignaciones); en pestaña categoría una fila */}
                  {activePrimaryTab === TAB_VISTA_COMPLETA && orderedColumnsForVista.length > 0 ? (
                    <>
                      <div
                        className="sticky top-0 z-20 grid items-stretch gap-x-2 gap-y-1 min-h-[48px] py-2 border-b border-white/[0.08] text-[10px] font-semibold uppercase tracking-wider text-white/75"
                        style={{
                          gridTemplateColumns: gradeGridTemplate,
                          background: 'rgba(255,255,255,0.03)',
                        }}
                      >
                        <div
                          className="pl-2 sticky left-0 z-30 pr-2 py-2 flex items-center border-r border-white/[0.06] rounded-r-lg"
                          style={{ background: 'linear-gradient(145deg, rgba(30, 58, 138, 0.95), rgba(15, 23, 42, 0.98))' }}
                        >
                          Estudiante
                        </div>
                        {parentHeaderSegments
                          .filter((seg) => seg.span > 0)
                          .map((seg, idx) => (
                            <div
                              key={`${seg.title}-${idx}`}
                              className="text-center px-2 py-2 flex items-center justify-center border-r border-white/[0.06] last:border-r-0"
                              style={{
                                gridColumn: `span ${seg.span}`,
                                background: 'rgba(37, 99, 235, 0.10)',
                                borderBottom: '2px solid rgba(37, 99, 235, 0.6)',
                              }}
                              title={seg.title}
                            >
                              <span className="line-clamp-2 leading-tight break-words text-[11px] font-bold uppercase tracking-widest text-blue-300">{seg.title}</span>
                            </div>
                          ))}
                        <div
                          className="text-center flex items-center justify-center px-1 text-[10px] uppercase tracking-wider text-white/75"
                          style={{ background: 'rgba(255,255,255,0.02)' }}
                        >
                          Promedio
                        </div>
                        <div
                          className="text-center pr-2 flex items-center justify-center text-[10px] uppercase tracking-wider text-white/75"
                          style={{ background: 'rgba(255,255,255,0.02)' }}
                        >
                          Predicción
                        </div>
                      </div>
                      <div
                        className="sticky top-[58px] z-20 grid items-stretch gap-x-2 gap-y-1 min-h-[52px] py-2 border-b border-white/[0.08] text-[11px] font-semibold text-white/85"
                        style={{
                          gridTemplateColumns: gradeGridTemplate,
                          background: 'rgba(255,255,255,0.025)',
                        }}
                      >
                        <div
                          className="pl-2 sticky left-0 z-30 pr-2 border-r border-white/[0.06] rounded-r-lg"
                          style={{ background: 'linear-gradient(145deg, rgba(30, 58, 138, 0.95), rgba(15, 23, 42, 0.98))' }}
                        />
                        {activeAssignments.map((a) => (
                          <div key={a._id} className="text-center px-1.5 py-1 flex items-center justify-center min-h-[48px]">
                            <span className="line-clamp-3 leading-snug break-words font-medium" title={a.titulo}>
                              {a.titulo}
                            </span>
                          </div>
                        ))}
                        <div className="text-center" />
                        <div className="text-center pr-2" />
                      </div>
                    </>
                  ) : (
                    <div
                      className="sticky top-0 z-20 grid items-center gap-x-2 gap-y-1 py-2 border-b border-white/[0.08] text-xs font-semibold text-white/85 mb-0"
                      style={{
                        gridTemplateColumns: gradeGridTemplate,
                        background: 'rgba(255,255,255,0.03)',
                      }}
                    >
                      <div
                        className="pl-2 sticky left-0 z-30 pr-2 py-1.5 flex items-center self-center border-r border-white/[0.06] rounded-r-lg min-h-0 text-[10px] uppercase tracking-wider text-white/75"
                        style={{ background: 'linear-gradient(145deg, rgba(30, 58, 138, 0.95), rgba(15, 23, 42, 0.98))' }}
                      >
                        Estudiante
                      </div>
                      {activeAssignments.map((a) => (
                        <div
                          key={a._id}
                          className="text-center px-1.5 py-1.5 flex items-center justify-center self-center min-h-0 max-h-[4.5rem] bg-white/[0.02] rounded-lg border border-white/[0.06]"
                        >
                          <span
                            className="line-clamp-2 leading-snug break-words text-[11px] font-semibold text-white/85 w-full"
                            title={a.titulo}
                          >
                            {a.titulo}
                          </span>
                        </div>
                      ))}
                      <div className="text-center flex items-center justify-center px-1 py-1 self-center min-h-0 text-[10px] uppercase tracking-wider text-white/75">
                        Promedio
                      </div>
                      <div className="text-center pr-2 flex items-center justify-center py-1 self-center min-h-0 text-[10px] uppercase tracking-wider text-white/75">
                        Predicción
                      </div>
                    </div>
                  )}

                  <div className="pb-3">
                    {students.map((student) => (
                      <StudentRow
                        key={student._id}
                        student={student}
                        assignments={activeAssignments}
                        gridTemplateColumns={gradeGridTemplate}
                        getGradeFor={getGradeFor}
                        getPromedioForDisplay={getPromedioForDisplay}
                        getTendencia={(id) => getPredictionDataFor(id).tendencia}
                        onSaveGrade={(assignmentId, estudianteId, calificacion) =>
                          updateGradeMutation.mutate({ assignmentId, estudianteId, calificacion })
                        }
                        courseId={firstSubjectId || ''}
                        onStudentClick={(studentId) =>
                          setLocation(`/profesor/cursos/${cursoId}/estudiantes/${studentId}/notas`)
                        }
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
            </div>
          ) : (
            <div className="text-center py-16 flex-1">
              <Award className="h-20 w-20 text-white/30 mx-auto mb-4" />
              <p className="text-white/60 text-lg">No hay estudiantes para mostrar notas</p>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
