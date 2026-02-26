import { useState, useMemo, useRef, useEffect } from 'react';
import { useAuth } from '@/lib/authContext';
import { Plus, Settings, Percent, Award, ChevronDown, ChevronUp, Minus } from 'lucide-react';
import { NavBackButton } from '@/components/nav-back-button';
import { Button } from '@/components/ui/button';
import { useLocation, useRoute } from 'wouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { motion, AnimatePresence } from 'framer-motion';
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
  onSave: (calificacion: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [local, setLocal] = useState(() => (value === '' ? '' : String(value)));
  const prevValue = useRef(value);
  if (prevValue.current !== value && !editing) {
    prevValue.current = value;
    setLocal(value === '' ? '' : String(value));
  }
  const handleBlur = () => {
    setEditing(false);
    const n = local === '' ? NaN : parseFloat(local);
    if (!Number.isNaN(n) && n >= 0 && n <= 100) onSave(n);
    else setLocal(value === '' ? '' : String(value));
  };

  const isEmpty = value === '' || value === undefined;

  if (editing) {
    return (
      <div className="w-full flex items-center justify-center p-0">
        <input
          type="number"
          min={0}
          max={100}
          value={local}
          onChange={(e) => setLocal(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          autoFocus
          className="w-full h-full min-h-[44px] text-center font-semibold rounded-xl bg-white/10 border border-white/20 text-[#E2E8F0] focus:border-[#3B82F6] focus:ring-1 focus:ring-[#3B82F6] outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        />
      </div>
    );
  }

  return (
    <motion.div
      role="button"
      tabIndex={0}
      onDoubleClick={() => setEditing(true)}
      className="flex items-center justify-center w-full min-h-[44px] py-2.5 rounded-xl font-medium text-[#E2E8F0] cursor-text bg-white/5 border border-white/[0.07] transition-all duration-200 hover:border-[rgba(59,130,246,0.8)] hover:shadow-[0_0_10px_rgba(59,130,246,0.4)] hover:-translate-y-0.5"
      whileHover={{ y: -2 }}
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
  onSaveGrade,
  predictionResult,
  onStudentClick,
  expandedStudentId,
  onToggleExpand,
}: {
  student: Student;
  assignments: Assignment[];
  getGradeFor: (studentId: string, assignmentId: string) => number | string;
  onSaveGrade: (assignmentId: string, estudianteId: string, calificacion: number) => void;
  predictionResult: PrediccionResult;
  onStudentClick: (studentId: string) => void;
  expandedStudentId: string | null;
  onToggleExpand: (id: string) => void;
}) {
  const isExpanded = expandedStudentId === student._id;

  return (
    <>
      <motion.div
        layout
        className="grid items-center gap-2 min-h-[72px] py-2 border-b border-white/[0.05] transition-colors duration-200 hover:bg-white/[0.03] cursor-pointer"
        style={{ gridTemplateColumns: `260px repeat(${assignments.length}, 120px) 180px` }}
        onClick={() => onToggleExpand(student._id)}
      >
        <div className="flex items-center gap-3 pl-1">
          <StudentAvatar nombre={student.nombre} />
          <span className="font-medium text-[#E2E8F0] truncate">{student.nombre}</span>
        </div>
        {assignments.map((assignment) => (
          <div key={assignment._id} className="flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
            <NoteCell
              assignmentId={assignment._id}
              estudianteId={student._id}
              value={getGradeFor(student._id, assignment._id)}
              onSave={(calificacion) => onSaveGrade(assignment._id, student._id, calificacion)}
            />
          </div>
        ))}
        <div className="flex items-center justify-center pr-2">
          <PredictionCell result={predictionResult} />
        </div>
      </motion.div>
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="overflow-hidden border-b border-white/[0.05]"
          >
            <div className="px-6 py-4 bg-white/[0.02] rounded-b-xl">
              <p className="text-sm text-white/60">Panel de detalle con historial IA (placeholder)</p>
              <Button
                variant="ghost"
                size="sm"
                className="mt-2 text-[#3B82F6] hover:bg-white/5"
                onClick={(e) => {
                  e.stopPropagation();
                  onStudentClick(student._id);
                }}
              >
                Ver notas completas
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
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
  const [activeTab, setActiveTab] = useState<TabId>('');
  const [expandedStudentId, setExpandedStudentId] = useState<string | null>(null);

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
      calificacion: number;
    }) => {
      return apiRequest('PUT', `/api/assignments/${assignmentId}/grade`, {
        estudianteId,
        calificacion: Math.min(100, Math.max(0, calificacion)),
        manualOverride: true,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gradeTableAssignments', cursoId, firstSubjectId] });
      queryClient.invalidateQueries({ queryKey: ['assignments', cursoId] });
    },
  });

  const getGradeFor = (studentId: string, assignmentId: string): number | string => {
    const assignment = assignmentsForTable.find((a) => a._id === assignmentId);
    if (!assignment) return '';
    const subs = assignment.submissions || assignment.entregas || [];
    const sub = subs.find(
      (x: { estudianteId?: { toString?: () => string } }) =>
        x.estudianteId?.toString?.() === studentId || x.estudianteId === studentId
    );
    const cal = (sub as { calificacion?: number })?.calificacion;
    return cal != null && !Number.isNaN(cal) ? cal : '';
  };

  const getPrediccionFor = (estudianteId: string) =>
    calcularPrediccion(estudianteId, assignmentsByLogro, logroEntriesForPrediction);

  const loading = isLoadingSubjects || isLoadingStudents || isLoadingGradeTable || isLoadingLogros;

  useEffect(() => {
    if (user && user.rol !== 'profesor') setLocation('/courses');
  }, [user, setLocation]);

  const pageTitle = `${cursoId} – ${subjectsForGroup[0]?.nombre ?? 'Notas'}`;

  return (
    <div
      className="min-h-screen w-full overflow-x-hidden relative"
      style={{
        background: 'radial-gradient(circle at 20% 20%, #1E3A8A 0%, #0F172A 40%, #020617 100%)',
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
    >
      {/* Optional subtle noise texture */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        }}
      />
      <div className="relative z-10 w-full max-w-[1600px] mx-auto px-4 py-6">
        <div className="mb-4">
          <NavBackButton to={`/course-detail/${cursoId}`} label="Volver al curso" />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="rounded-[24px] p-8 w-full overflow-hidden"
          style={{
            background: 'linear-gradient(145deg, rgba(30,58,138,0.35), rgba(15,23,42,0.6))',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid rgba(255,255,255,0.08)',
            boxShadow: '0 0 40px rgba(37,99,235,0.25)',
          }}
        >
          <header className="mb-8">
            <h1 className="text-2xl font-semibold text-[#E2E8F0] mb-6" style={{ fontFamily: 'Inter' }}>
              {pageTitle}
            </h1>

            <div className="flex flex-wrap gap-2 mb-6">
              <Button
                size="sm"
                className="bg-[#3B82F6] hover:bg-[#2563EB] text-white"
                onClick={() => setLocation(`/course-detail/${cursoId}?openAssignmentForm=1`)}
              >
                <Plus className="h-4 w-4 mr-2" />
                Nueva asignación
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="border-white/10 text-[#E2E8F0] hover:bg-white/5"
                onClick={() => setLocation(`/profesor/cursos/${cursoId}/notas`)}
              >
                <Settings className="h-4 w-4 mr-2" />
                Gestionar Notas
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="border-white/10 text-[#E2E8F0] hover:bg-white/5"
                onClick={() => setLocation(`/course/${cursoId}/analytics`)}
              >
                Vista analítica
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="border-white/10 text-[#E2E8F0] hover:bg-white/5"
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
                  className="px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200"
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
            <div className="space-y-3 py-8">
              <Skeleton className="h-[72px] w-full rounded-xl bg-white/10" />
              <Skeleton className="h-[72px] w-full rounded-xl bg-white/10" />
              <Skeleton className="h-[72px] w-full rounded-xl bg-white/10" />
              <Skeleton className="h-[72px] w-full rounded-xl bg-white/10" />
            </div>
          ) : students.length > 0 ? (
            <div className="overflow-x-auto">
              {/* Header row (grid) */}
              <div
                className="grid items-center gap-2 min-h-[56px] py-3 border-b border-white/10 text-xs font-semibold uppercase tracking-wider text-white/70 mb-0"
                style={{ gridTemplateColumns: `260px repeat(${activeAssignments.length}, 120px) 180px` }}
              >
                <div className="pl-1">Estudiante</div>
                {activeAssignments.map((a) => (
                  <div key={a._id} className="text-center truncate px-1">
                    {a.titulo}
                  </div>
                ))}
                <div className="text-center pr-2">Predicción</div>
              </div>

              {students.map((student) => (
                <StudentRow
                  key={student._id}
                  student={student}
                  assignments={activeAssignments}
                  getGradeFor={getGradeFor}
                  onSaveGrade={(assignmentId, estudianteId, calificacion) =>
                    updateGradeMutation.mutate({ assignmentId, estudianteId, calificacion })
                  }
                  predictionResult={getPrediccionFor(student._id)}
                  onStudentClick={(studentId) =>
                    setLocation(`/profesor/cursos/${cursoId}/estudiantes/${studentId}/notas`)
                  }
                  expandedStudentId={expandedStudentId}
                  onToggleExpand={(id) => setExpandedStudentId((prev) => (prev === id ? null : id))}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-16">
              <Award className="h-20 w-20 text-white/30 mx-auto mb-4" />
              <p className="text-white/60 text-lg">No hay estudiantes para mostrar notas</p>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
