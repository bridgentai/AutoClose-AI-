import { useState, useMemo, useRef, useEffect } from 'react';
import { useAuth } from '@/lib/authContext';
import { Plus, Percent, Award, ChevronDown, ChevronUp, Minus } from 'lucide-react';
import { NavBackButton } from '@/components/nav-back-button';
import { Button } from '@/components/ui/button';
import { useLocation, useRoute } from 'wouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
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

type TabId = string;

// =========================================================
// FETCHING
// =========================================================

const fetchSubjectsForGroup = async (groupId: string): Promise<CourseSubject[]> => {
  return apiRequest('GET', `/api/courses/for-group/${groupId}`);
};

const fetchGradeTableAssignments = async (groupId: string, courseId: string): Promise<Assignment[]> => {
  return apiRequest('GET', `/api/assignments?groupId=${encodeURIComponent(groupId)}&courseId=${courseId}`);
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

  return (
    <motion.div
      role="button"
      tabIndex={0}
      onClick={(e) => { e.stopPropagation(); setEditing(true); }}
      className="flex items-center justify-center w-full min-h-[44px] py-2.5 rounded-[12px] font-medium text-[#E2E8F0] cursor-text bg-white/[0.03] border border-white/[0.06] transition-all duration-200 hover:bg-[rgba(59,130,246,0.15)] hover:border-[rgba(59,130,246,0.4)] hover:shadow-[0_0_0_1px_rgba(59,130,246,0.2)] overflow-hidden"
    >
      {isEmpty ? <span className="text-white/40">—</span> : <span>{String(value)}</span>}
    </motion.div>
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

function PredictionCellFromAI({ courseId, studentId }: { courseId: string; studentId: string }) {
  const { data: forecast } = useForecast(courseId, studentId);
  const value = forecast?.projectedFinalGrade ?? null;
  const display = value != null && !Number.isNaN(value) ? Math.round(value * 10) / 10 : null;

  return (
    <div className="flex flex-col items-center justify-center gap-1 py-1">
      <div className="flex items-center gap-1">
        <span className="text-[20px] font-semibold tabular-nums text-[#E2E8F0]">
          {display != null ? display : '—'}
        </span>
        {display != null && <span className="text-white/50 text-[10px]">/ 100</span>}
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
  getGradeFor,
  getPromedioForDisplay,
  onSaveGrade,
  courseId,
  onStudentClick,
}: {
  student: Student;
  assignments: Assignment[];
  getGradeFor: (studentId: string, assignmentId: string) => number | string;
  getPromedioForDisplay: (studentId: string) => number | string;
  onSaveGrade: (assignmentId: string, estudianteId: string, calificacion: number | null) => void;
  courseId: string;
  onStudentClick: (studentId: string) => void;
}) {
  const promedio = getPromedioForDisplay(student._id);

  return (
    <motion.div
      layout
      className="grid items-center gap-2 min-h-[72px] py-2 border-b border-white/[0.04] transition-colors duration-200 hover:bg-white/[0.02]"
      style={{ gridTemplateColumns: `260px repeat(${assignments.length}, 120px) 100px 180px` }}
    >
      <div
        className="flex items-center gap-3 pl-1 cursor-pointer group sticky left-0 z-10 pr-2 -ml-px backdrop-blur-md"
        style={{ background: 'linear-gradient(145deg, rgba(30, 58, 138, 0.35), rgba(15, 23, 42, 0.6))' }}
        onClick={() => onStudentClick(student._id)}
      >
        <StudentAvatar nombre={student.nombre} />
        <span className="font-medium text-[#E2E8F0] truncate group-hover:text-[#3B82F6] transition-colors">{student.nombre}</span>
      </div>
      {assignments.map((assignment) => (
        <div key={assignment._id} className="flex items-center justify-center min-w-0 overflow-hidden bg-transparent">
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
        <div className="rounded-[12px] bg-white/[0.03] border border-white/[0.06] px-2 py-1.5 min-w-[60px] text-center">
          <span className={`text-sm font-semibold ${promedio === '—' ? 'text-white/40' : 'text-[#E2E8F0]'}`}>
            {typeof promedio === 'number' ? promedio.toFixed(1) : promedio}
          </span>
          {promedio !== '—' && <span className="text-white/50 text-[10px] ml-0.5">/ 100</span>}
        </div>
      </div>
      {/* Columna PREDICCIÓN: pronóstico de la IA integrada (API forecast); si no hay dato, "—" */}
      <div className="flex items-center justify-center pr-2">
        <PredictionCellFromAI courseId={courseId} studentId={student._id} />
      </div>
    </motion.div>
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
  const [activeTab, setActiveTab] = useState<TabId>('');

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

  const gsFromQuery =
    typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('gs') || '' : '';
  const returnToFromQuery =
    typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('returnTo') || '' : '';
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
    queryKey: ['gradeTableAssignments', cursoId, firstSubjectId],
    queryFn: () => fetchGradeTableAssignments(displayGroupId, firstSubjectId || ''),
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
        out.push({
          _id: ind._id,
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
      id: L._id,
      pesoEnCurso: L.pesoEnCurso,
      indicadores: (L.indicadores ?? []).map((i) => ({ id: i._id, porcentaje: i.porcentaje })),
    }));
  }, [logrosData]);

  /** Agrupa assignments por indicador (grading_category_id). */
  const assignmentsByIndicador = useMemo(() => {
    const logrosOrdenados = flatIndicadoresOrdered;
    const grouped: Record<string, { logro: LogroCalificacion; assignments: Assignment[] }> = {};
    logrosOrdenados.forEach((ind) => {
      grouped[ind._id] = {
        logro: { _id: ind._id, nombre: ind.nombre, porcentaje: ind.porcentaje, orden: ind.orden },
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

  const TAB_VISTA_COMPLETA = '__completa__';

  const tabOrder = useMemo(() => {
    const byId = new Map(Object.entries(assignmentsByIndicador));
    const orderedTabs = flatIndicadoresOrdered
      .map((ind) => {
        if (!byId.has(ind._id)) return null;
        return { id: ind._id, label: ind.nombre };
      })
      .filter(Boolean) as { id: string; label: string }[];
    const sin = assignmentsByIndicador['sin-logro'];
    if (sin && sin.assignments.length > 0) {
      orderedTabs.push({ id: 'sin-logro', label: 'Sin categoría' });
    }
    return [{ id: TAB_VISTA_COMPLETA, label: 'Vista completa' }, ...orderedTabs];
  }, [assignmentsByIndicador, flatIndicadoresOrdered]);

  useEffect(() => {
    if (tabOrder.length > 0 && !activeTab) setActiveTab(tabOrder[0].id);
  }, [tabOrder, activeTab]);

  const activeAssignments = useMemo(() => {
    if (!activeTab) return [];
    if (activeTab === TAB_VISTA_COMPLETA) {
      return orderedColumnsForVista.map((c) => c.assignment);
    }
    return assignmentsByIndicador[activeTab]?.assignments ?? [];
  }, [activeTab, orderedColumnsForVista, assignmentsByIndicador]);

  /** Todas las asignaciones del curso, para calcular el promedio global (mismo valor en vista por categoría y vista completa). */
  const allAssignmentsForPromedio = useMemo(
    () =>
      (Object.values(assignmentsByIndicador) as { logro: LogroCalificacion; assignments: Assignment[] }[])
        .flatMap((g) => g.assignments)
        .sort((a, b) => new Date(a.fechaEntrega).getTime() - new Date(b.fechaEntrega).getTime()),
    [assignmentsByIndicador]
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gradeTableAssignments', cursoId, firstSubjectId] });
      queryClient.invalidateQueries({ queryKey: ['assignments', cursoId] });
    },
    onError: (err: Error) => {
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

  /** En Vista completa: promedio final ponderado. En una categoría: solo el promedio de esa categoría. Evita NaN. */
  const getPromedioForDisplay = (estudianteId: string): number | string => {
    if (activeTab === TAB_VISTA_COMPLETA) return getPromedioFor(estudianteId);
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

  const promedioColumnLabel =
    activeTab === TAB_VISTA_COMPLETA
      ? 'Promedio'
      : assignmentsByIndicador[activeTab]?.logro?.nombre
        ? `Promedio (${assignmentsByIndicador[activeTab].logro.nombre})`
        : 'Promedio';

  const loading = isLoadingSubjects || isLoadingStudents || isLoadingGradeTable || isLoadingLogros;

  useEffect(() => {
    if (user && user.rol !== 'profesor') setLocation('/courses');
  }, [user, setLocation]);

  const subjectLabel =
    subjectsForGroup.find((s) => s._id === firstSubjectId)?.nombre ?? subjectsForGroup[0]?.nombre ?? 'Notas';
  const pageTitle = `${groupDisplayName} – ${subjectLabel}`;
  const backToCourseHref =
    returnToFromQuery
      ? returnToFromQuery
      : gsFromQuery && subjectsForGroup.some((s) => s._id === gsFromQuery)
      ? `/course-detail/${cursoId}/materia/${gsFromQuery}`
      : `/course-detail/${cursoId}`;

  return (
    <div
      className="min-h-[calc(100vh-8rem)] w-full overflow-x-hidden relative flex flex-col"
      style={{ fontFamily: 'Inter, system-ui, sans-serif' }}
    >
      <div className="relative z-10 w-full flex-1 flex flex-col min-h-0">
        <div className="mb-4 flex-shrink-0">
          <NavBackButton to={backToCourseHref} label="Volver al curso" />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="w-full flex-1 flex flex-col min-h-0"
        >
          <header className="mb-6 flex-shrink-0">
            <h1 className="text-2xl font-semibold text-[#E2E8F0] mb-4" style={{ fontFamily: 'Inter' }}>
              {pageTitle}
            </h1>

            <div className="flex flex-wrap gap-2 mb-4">
              <Button
                size="sm"
                className="rounded-[10px] bg-[#3B82F6] hover:bg-[#2563EB] text-white"
                onClick={() => setLocation(`/course-detail/${cursoId}?openAssignmentForm=1`)}
              >
                <Plus className="h-4 w-4 mr-2" />
                Nueva asignación
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="rounded-[10px] border-white/10 text-[#E2E8F0] hover:bg-white/5"
                onClick={() => {
                  const qs = firstSubjectId
                    ? `?${new URLSearchParams({ gs: firstSubjectId }).toString()}`
                    : '';
                  setLocation(`/course/${cursoId}/analytics${qs}`);
                }}
              >
                Vista analítica
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="rounded-[10px] border-white/10 text-[#E2E8F0] hover:bg-white/5"
                onClick={() => setLocation('/profesor/academia/calificacion/logros')}
              >
                <Percent className="h-4 w-4 mr-2" />
                Logros de Calificación
              </Button>
            </div>

            {/* Tabs */}
            <div className="flex flex-wrap gap-2">
              {tabOrder.map((tab) => (
                <motion.button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className="px-4 py-2.5 rounded-[10px] text-sm font-medium transition-all duration-200"
                  style={
                    activeTab === tab.id
                      ? {
                          background: 'linear-gradient(180deg, #3B82F6, #1D4ED8)',
                          color: '#fff',
                          boxShadow: '0 0 20px rgba(59,130,246,0.5)',
                        }
                      : {
                          background: 'rgba(255,255,255,0.05)',
                          color: '#E2E8F0',
                        }
                  }
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  {tab.label}
                </motion.button>
              ))}
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
            <div
              className="overflow-x-auto overflow-y-auto flex-1 min-h-0 -mx-8 sm:-mx-16 px-4 sm:px-16 relative"
              style={{
                maskImage: 'linear-gradient(to right, black 260px, black calc(100% - 20px), transparent)',
                WebkitMaskImage: 'linear-gradient(to right, black 260px, black calc(100% - 20px), transparent)',
              }}
            >
              {/* Header: en Vista completa dos filas (categorías + asignaciones); en pestaña categoría una fila */}
              {activeTab === TAB_VISTA_COMPLETA && orderedColumnsForVista.length > 0 ? (
                <>
                  <div
                    className="sticky top-0 z-20 grid items-center gap-2 min-h-[44px] py-2 border-b border-white/[0.06] text-[10px] font-semibold uppercase tracking-wider text-white/70 backdrop-blur-sm"
                    style={{
                      gridTemplateColumns: `260px repeat(${activeAssignments.length}, 120px) 100px 180px`,
                      background: 'rgba(255,255,255,0.02)',
                    }}
                  >
                    <div
                      className="pl-1 sticky left-0 z-30 pr-2 -ml-px backdrop-blur-md"
                      style={{ background: 'linear-gradient(145deg, rgba(30, 58, 138, 0.35), rgba(15, 23, 42, 0.6))' }}
                    >
                      Estudiante
                    </div>
                    {parentHeaderSegments
                      .filter((seg) => seg.span > 0)
                      .map((seg, idx) => (
                        <div
                          key={`${seg.title}-${idx}`}
                          className="text-center truncate px-1 border-r border-white/10"
                          style={{ gridColumn: `span ${seg.span}` }}
                          title={seg.title}
                        >
                          {seg.title}
                        </div>
                      ))}
                    <div className="text-center">{promedioColumnLabel}</div>
                    <div className="text-center pr-2">Predicción</div>
                  </div>
                  <div
                    className="sticky top-[44px] z-20 grid items-center gap-2 min-h-[40px] py-2 border-b border-white/[0.06] text-xs font-semibold uppercase tracking-wider text-white/80 mb-0 backdrop-blur-sm"
                    style={{
                      gridTemplateColumns: `260px repeat(${activeAssignments.length}, 120px) 100px 180px`,
                      background: 'rgba(255,255,255,0.02)',
                    }}
                  >
                    <div
                      className="pl-1 sticky left-0 z-30 pr-2 -ml-px backdrop-blur-md"
                      style={{ background: 'linear-gradient(145deg, rgba(30, 58, 138, 0.35), rgba(15, 23, 42, 0.6))' }}
                    >
                      {' '}
                    </div>
                    {activeAssignments.map((a) => (
                      <div key={a._id} className="text-center truncate px-1">
                        {a.titulo}
                      </div>
                    ))}
                    <div className="text-center" />
                    <div className="text-center pr-2" />
                  </div>
                </>
              ) : (
                <div
                  className="sticky top-0 z-20 grid items-center gap-2 min-h-[56px] py-3 border-b border-white/[0.06] text-xs font-semibold uppercase tracking-wider text-white/80 mb-0 backdrop-blur-sm"
                  style={{
                    gridTemplateColumns: `260px repeat(${activeAssignments.length}, 120px) 100px 180px`,
                    background: 'rgba(255,255,255,0.02)',
                  }}
                >
                  <div
                    className="pl-1 sticky left-0 z-30 pr-2 -ml-px backdrop-blur-md"
                    style={{ background: 'linear-gradient(145deg, rgba(30, 58, 138, 0.35), rgba(15, 23, 42, 0.6))' }}
                  >
                    Estudiante
                  </div>
                  {activeAssignments.map((a) => (
                    <div key={a._id} className="text-center truncate px-1">
                      {a.titulo}
                    </div>
                  ))}
                  <div className="text-center">{promedioColumnLabel}</div>
                  <div className="text-center pr-2">Predicción</div>
                </div>
              )}

              {students.map((student) => (
                <StudentRow
                  key={student._id}
                  student={student}
                  assignments={activeAssignments}
                  getGradeFor={getGradeFor}
                  getPromedioForDisplay={getPromedioForDisplay}
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
