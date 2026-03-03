import { useState, useMemo, useRef, useEffect } from 'react';
import { useAuth } from '@/lib/authContext';
import { Plus, Settings, Percent, Award, ChevronDown, ChevronUp, Minus } from 'lucide-react';
import { NavBackButton } from '@/components/nav-back-button';
import { Button } from '@/components/ui/button';
import { useLocation, useRoute } from 'wouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { motion } from 'framer-motion';
import { LineChart, Line, ResponsiveContainer } from 'recharts';
import { Skeleton } from '@/components/ui/skeleton';

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
  logroCalificacionId?: string;
}

interface LogroCalificacion {
  _id: string;
  nombre: string;
  porcentaje: number;
  orden?: number;
}

interface LogrosResponse {
  logros: LogroCalificacion[];
  totalPorcentaje: number;
  completo: boolean;
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
  assignmentsByLogro: Record<string, { logro: LogroCalificacion; assignments: Assignment[] }>,
  tabOrder: { id: string; label: string }[]
): PrediccionResult {
  const toScale5 = (v: number) => v / 20;

  const tareasLogro = tabOrder.find((t) => t.label === 'Tareas') ?? tabOrder[0];
  const examenesLogro = tabOrder.find((t) => t.label === 'Exámenes') ?? tabOrder[1];
  const trabajosLogro = tabOrder.find((t) => t.label === 'Trabajos') ?? tabOrder[2];

  const getGradesForLogro = (key: string | undefined): number[] => {
    if (!key) return [];
    const grupo = assignmentsByLogro[key];
    if (!grupo) return [];
    const grades: number[] = [];
    grupo.assignments.forEach((a) => {
      const subs = a.submissions || a.entregas || [];
      const sub = subs.find(
        (x: { estudianteId?: string }) =>
          String(x.estudianteId) === estudianteId
      );
      const cal = (sub as { calificacion?: number })?.calificacion;
      if (cal != null && !Number.isNaN(cal)) grades.push(toScale5(cal));
    });
    return grades;
  };

  const allAssignmentsWithDates = (Object.values(assignmentsByLogro) as { logro: LogroCalificacion; assignments: Assignment[] }[])
    .flatMap((g) => g.assignments.map((a) => ({ ...a, fecha: a.fechaEntrega })))
    .sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());

  const orderedGrades: number[] = [];
  allAssignmentsWithDates.forEach((a) => {
    const subs = a.submissions || a.entregas || [];
    const sub = subs.find((x: { estudianteId?: string }) => String(x.estudianteId) === estudianteId);
    const cal = (sub as { calificacion?: number })?.calificacion;
    if (cal != null && !Number.isNaN(cal)) orderedGrades.push(toScale5(cal));
  });

  const tareasProm = promedio(getGradesForLogro(tareasLogro?.id));
  const examenesProm = promedio(getGradesForLogro(examenesLogro?.id));
  const trabajosProm = promedio(getGradesForLogro(trabajosLogro?.id));

  const notaActual =
    tareasProm * 0.2 +
    examenesProm * 0.4 +
    trabajosProm * 0.3;

  const primeras3 = orderedGrades.slice(0, 3);
  const ultimas3 = orderedGrades.slice(-3);
  const tendencia = promedio(ultimas3) - promedio(primeras3);
  const prediccion = Math.max(0, Math.min(5, notaActual + tendencia * 0.3));

  const sparklineData = orderedGrades.map((value) => ({ value }));

  return {
    prediccion: Math.round(prediccion * 10) / 10,
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
// CELDA PREDICCIÓN (sparkline + número + flecha)
// =========================================================

function PredictionCell({ result }: { result: PrediccionResult }) {
  const { prediccion, tendencia, sparklineData } = result;
  const strokeColor =
    prediccion < 3 ? '#EF4444' : prediccion <= 4 ? '#FACC15' : '#3B82F6';
  const TrendIcon = tendencia > 0 ? ChevronUp : tendencia < 0 ? ChevronDown : Minus;

  return (
    <div className="flex flex-col items-center justify-center gap-1 py-1">
      <motion.div
        className="flex items-center gap-1"
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <motion.span
          key={prediccion}
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-[20px] font-semibold tabular-nums text-[#E2E8F0]"
        >
          {prediccion > 0 ? prediccion.toFixed(1) : '—'}
        </motion.span>
        {prediccion > 0 && (
          <TrendIcon
            className="w-4 h-4 flex-shrink-0"
            style={{ color: strokeColor }}
          />
        )}
      </motion.div>
      {sparklineData.length > 1 && (
        <div className="w-full h-[30px] min-w-[80px]">
          <ResponsiveContainer width="100%" height={30}>
            <LineChart data={sparklineData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
              <Line
                type="monotone"
                dataKey="value"
                stroke={strokeColor}
                strokeWidth={1.5}
                dot={false}
                isAnimationActive
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
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
  getPromedioFor,
  onSaveGrade,
  predictionResult,
  onStudentClick,
}: {
  student: Student;
  assignments: Assignment[];
  getGradeFor: (studentId: string, assignmentId: string) => number | string;
  getPromedioFor: (studentId: string) => number | string;
  onSaveGrade: (assignmentId: string, estudianteId: string, calificacion: number | null) => void;
  predictionResult: PrediccionResult;
  onStudentClick: (studentId: string) => void;
}) {
  const promedio = getPromedioFor(student._id);

  return (
    <motion.div
      layout
      className="grid items-center gap-2 min-h-[72px] py-2 border-b border-white/[0.04] transition-colors duration-200 hover:bg-white/[0.02]"
      style={{ gridTemplateColumns: `260px repeat(${assignments.length}, 120px) 100px 180px` }}
    >
      <div
        className="flex items-center gap-3 pl-1 cursor-pointer group"
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
      <div className="flex items-center justify-center">
        <div className="rounded-[12px] bg-white/[0.03] border border-white/[0.06] px-2 py-1.5 min-w-[60px] text-center">
          <span className={`text-sm font-semibold ${promedio === '—' ? 'text-white/40' : 'text-[#E2E8F0]'}`}>{promedio}</span>
          {promedio !== '—' && <span className="text-white/50 text-[10px] ml-0.5">/ 100</span>}
        </div>
      </div>
      <div className="flex items-center justify-center pr-2">
        <PredictionCell result={predictionResult} />
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

  const { data: subjectsForGroup = [], isLoading: isLoadingSubjects } = useQuery<CourseSubject[]>({
    queryKey: ['subjectsForGroup', cursoId],
    queryFn: () => fetchSubjectsForGroup(cursoId),
    enabled: !!cursoId && user?.rol === 'profesor',
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const { data: students = [], isLoading: isLoadingStudents } = useQuery<Student[]>({
    queryKey: ['students', cursoId],
    queryFn: () => fetchStudentsByGroup(cursoId),
    enabled: !!cursoId && user?.rol === 'profesor',
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const firstSubjectId = subjectsForGroup[0]?._id;

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

  const assignmentsByLogro = useMemo(() => {
    const logros = logrosData?.logros || [];
    const logrosOrdenados = [...logros].sort((a, b) => {
      const ordenA = a.orden ?? 999;
      const ordenB = b.orden ?? 999;
      if (ordenA !== ordenB) return ordenA - ordenB;
      return a.nombre.localeCompare(b.nombre);
    });
    const grouped: Record<string, { logro: LogroCalificacion; assignments: Assignment[] }> = {};
    logrosOrdenados.forEach((logro) => {
      grouped[logro._id] = { logro, assignments: [] };
    });
    const sinLogro: Assignment[] = [];
    assignmentsForTable.forEach((assignment) => {
      if (assignment.logroCalificacionId) {
        const assignmentLogroId = String(assignment.logroCalificacionId);
        const matchingLogro = logrosOrdenados.find((l) => String(l._id) === assignmentLogroId);
        if (matchingLogro && grouped[matchingLogro._id]) {
          grouped[matchingLogro._id].assignments.push(assignment);
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
  }, [assignmentsForTable, logrosData]);

  const TAB_VISTA_COMPLETA = '__completa__';

  const tabOrder = useMemo(() => {
    const entries = Object.entries(assignmentsByLogro);
    return [
      { id: TAB_VISTA_COMPLETA, label: 'Vista completa' },
      ...entries.map(([id, { logro }]) => ({ id, label: logro.nombre })),
    ];
  }, [assignmentsByLogro]);

  const logroEntriesForPrediction = useMemo(
    () => Object.entries(assignmentsByLogro).map(([id, { logro }]) => ({ id, label: logro.nombre })),
    [assignmentsByLogro]
  );

  useEffect(() => {
    if (tabOrder.length > 0 && !activeTab) setActiveTab(tabOrder[0].id);
  }, [tabOrder, activeTab]);

  const activeAssignments = useMemo(() => {
    if (!activeTab) return [];
    if (activeTab === TAB_VISTA_COMPLETA) {
      return (Object.values(assignmentsByLogro) as { logro: LogroCalificacion; assignments: Assignment[] }[])
        .flatMap((g) => g.assignments)
        .sort((a, b) => new Date(a.fechaEntrega).getTime() - new Date(b.fechaEntrega).getTime());
    }
    return assignmentsByLogro[activeTab]?.assignments ?? [];
  }, [activeTab, assignmentsByLogro]);

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
    const assignment = assignmentsForTable.find((a) => a._id === assignmentId);
    if (!assignment) return '';
    const subs = assignment.submissions || assignment.entregas || [];
    const sub = subs.find(
      (x: { estudianteId?: { toString?: () => string } }) =>
        x.estudianteId?.toString?.() === studentId || (x as { estudianteId?: string }).estudianteId === studentId
    );
    const cal = (sub as { calificacion?: number })?.calificacion;
    return cal != null && !Number.isNaN(cal) ? cal : '';
  };

  const getPrediccionFor = (estudianteId: string) =>
    calcularPrediccion(estudianteId, assignmentsByLogro, logroEntriesForPrediction);

  const getPromedioFor = (estudianteId: string): number | string => {
    const notas: number[] = [];
    activeAssignments.forEach((a) => {
      const v = getGradeFor(estudianteId, a._id);
      if (typeof v === 'number' && !Number.isNaN(v)) notas.push(v);
    });
    if (notas.length === 0) return '—';
    const prom = Math.round(notas.reduce((s, n) => s + n, 0) / notas.length);
    return prom;
  };

  const loading = isLoadingSubjects || isLoadingStudents || isLoadingGradeTable || isLoadingLogros;

  useEffect(() => {
    if (user && user.rol !== 'profesor') setLocation('/courses');
  }, [user, setLocation]);

  const pageTitle = `${cursoId} – ${subjectsForGroup[0]?.nombre ?? 'Notas'}`;

  return (
    <div
      className="min-h-[calc(100vh-8rem)] w-full overflow-x-hidden relative flex flex-col"
      style={{ fontFamily: 'Inter, system-ui, sans-serif' }}
    >
      <div className="relative z-10 w-full flex-1 flex flex-col min-h-0">
        <div className="mb-4 flex-shrink-0">
          <NavBackButton to={`/course-detail/${cursoId}`} label="Volver al curso" />
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
                onClick={() => setLocation(`/profesor/cursos/${cursoId}/notas`)}
              >
                <Settings className="h-4 w-4 mr-2" />
                Gestionar Notas
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="rounded-[10px] border-white/10 text-[#E2E8F0] hover:bg-white/5"
                onClick={() => setLocation(`/course/${cursoId}/analytics`)}
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
              className="overflow-x-auto overflow-y-auto flex-1 min-h-0 -mx-4 sm:-mx-6 px-4 sm:px-6 relative"
              style={{
                maskImage: 'linear-gradient(to right, transparent, black 20px, black calc(100% - 20px), transparent)',
                WebkitMaskImage: 'linear-gradient(to right, transparent, black 20px, black calc(100% - 20px), transparent)',
              }}
            >
              {/* Header row: sticky, glass muy sutil para no crear bloque */}
              <div
                className="sticky top-0 z-10 grid items-center gap-2 min-h-[56px] py-3 border-b border-white/[0.06] text-xs font-semibold uppercase tracking-wider text-white/80 mb-0 backdrop-blur-sm"
                style={{
                  gridTemplateColumns: `260px repeat(${activeAssignments.length}, 120px) 100px 180px`,
                  background: 'rgba(255,255,255,0.02)',
                }}
              >
                <div className="pl-1">Estudiante</div>
                {activeAssignments.map((a) => (
                  <div key={a._id} className="text-center truncate px-1">
                    {a.titulo}
                  </div>
                ))}
                <div className="text-center">Promedio</div>
                <div className="text-center pr-2">Predicción</div>
              </div>

              {students.map((student) => (
                <StudentRow
                  key={student._id}
                  student={student}
                  assignments={activeAssignments}
                  getGradeFor={getGradeFor}
                  getPromedioFor={getPromedioFor}
                  onSaveGrade={(assignmentId, estudianteId, calificacion) =>
                    updateGradeMutation.mutate({ assignmentId, estudianteId, calificacion })
                  }
                  predictionResult={getPrediccionFor(student._id)}
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
