import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/lib/authContext';
import { useLocation } from 'wouter';
import {
  BookOpen,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertCircle,
  MessageSquare,
  BarChart3,
  ChevronDown,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, BarChart, Bar, Cell, LabelList, ResponsiveContainer, Tooltip } from 'recharts';
import { Breadcrumb } from '@/components/Breadcrumb';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { getGradeLevel, GRADE_COLORS } from '@/lib/gradeUtils';
import {
  weightedGradeWithinLogro,
  courseGradeFromOutcomes,
  hasRecordedScore,
  type OutcomeGradeNode,
} from '@shared/weightedGrades';

// =========================================================
// INTERFACES Y DATOS MOCK
// =========================================================

interface SubjectGrade {
  _id: string;
  groupSubjectId?: string | null;
  nombre: string;
  /** null cuando no hay notas (N/A) */
  promedio: number | null;
  ultimaNota: number | null;
  estado: 'excelente' | 'bueno' | 'regular' | 'bajo' | 'sin_notas';
  tendencia: 'up' | 'down' | 'stable';
  colorAcento?: string;
}

interface GradeDetail {
  categoria: string;
  promedio: number | null;
  notas: {
    actividad: string;
    nota: number | null;
    fecha: string;
    comentario?: string;
  }[];
}

interface SubjectDetail extends SubjectGrade {
  promedioFinal: number | null;
  categorias: GradeDetail[];
  evolucion: { mes: string; promedio: number }[];
  profesorNombre?: string | null;
}

// Interfaces para datos reales
interface NotaReal {
  _id: string;
  assignmentId?: string;
  tareaId?: string;
  tareaTitulo?: string;
  /** null = N/A (sin calificar); 0 es válido */
  nota: number | null;
  logro?: string;
  fecha: string;
  profesorNombre?: string;
  comentario?: string;
  gradingCategoryId?: string;
  categoryWeightPct?: number | null;
}

interface MateriaConNotas {
  _id: string;
  nombre: string;
  groupSubjectId?: string | null;
  colorAcento?: string;
  icono?: string;
  notas: NotaReal[];
  promedio: number | null;
  ultimaNota: number | null;
  estado: 'excelente' | 'bueno' | 'regular' | 'bajo' | 'aprobado' | 'reprobado' | 'sin_notas';
  tendencia: 'up' | 'down' | 'stable';
  profesorNombre?: string | null;
}

interface LogroItem {
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
  indicadores: { _id: string; nombre: string; porcentaje: number; orden?: number }[];
}

interface LogrosApiResponse {
  logros: LogroBloqueApi[];
  indicadoresPlano: LogroItem[];
}

interface GradingPack {
  nested: LogroBloqueApi[];
  plano: LogroItem[];
}

function promedioForScoreMap(
  allNotas: NotaReal[],
  nestedLogros: LogroBloqueApi[] | undefined,
  scoreByAssignmentId: Map<string, number>
): number | null {
  const grouped = new Map<string, NotaReal[]>();
  for (const n of allNotas) {
    const c = n.gradingCategoryId;
    if (!c) continue;
    if (!grouped.has(c)) grouped.set(c, []);
    grouped.get(c)!.push(n);
  }
  const dedupe = (arr: NotaReal[]) => {
    const m = new Map<string, NotaReal>();
    for (const n of arr) {
      const id = n.assignmentId || n._id;
      if (!m.has(id)) m.set(id, n);
    }
    return [...m.values()];
  };
  const getCat = (lid: string) => {
    const arr = dedupe(grouped.get(lid) ?? []);
    if (!arr.length) return null;
    return weightedGradeWithinLogro(
      arr.map((n) => ({ categoryWeightPct: n.categoryWeightPct })),
      arr.map((n) => {
        const id = n.assignmentId || n._id;
        return scoreByAssignmentId.has(id) ? scoreByAssignmentId.get(id)! : null;
      })
    );
  };
  const outcomes: OutcomeGradeNode[] = (nestedLogros ?? []).map((L) => ({
    id: L._id,
    pesoEnCurso: L.pesoEnCurso,
    indicadores: (L.indicadores ?? []).map((i) => ({ id: i._id, porcentaje: i.porcentaje })),
  }));
  if (outcomes.length > 0) {
    return courseGradeFromOutcomes(outcomes, getCat);
  }
  const vals: number[] = [];
  for (const n of allNotas) {
    const id = n.assignmentId || n._id;
    const s = scoreByAssignmentId.get(id);
    if (s !== undefined) vals.push(s);
  }
  if (!vals.length) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

/** Evolución del promedio según notas registradas (N/A no cuenta). */
function computeEvolucion(
  materia: MateriaConNotas,
  nestedLogros: LogroBloqueApi[] | undefined
): { date: Date; dateStr: string; promedio: number }[] {
  const notas = materia.notas ?? [];
  const graded = notas
    .filter((n) => hasRecordedScore(n.nota))
    .sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());
  const out: { date: Date; dateStr: string; promedio: number }[] = [];
  for (let i = 0; i < graded.length; i++) {
    const map = new Map<string, number>();
    for (let j = 0; j <= i; j++) {
      const x = graded[j];
      const id = x.assignmentId || x._id;
      map.set(id, Number(x.nota));
    }
    const p = promedioForScoreMap(notas, nestedLogros, map);
    if (p == null) continue;
    const fecha = new Date(graded[i].fecha);
    if (Number.isNaN(fecha.getTime())) continue;
    out.push({
      date: fecha,
      dateStr: fecha.toLocaleDateString('es-CO', { month: 'short', day: 'numeric', year: '2-digit' }),
      promedio: Math.round(p * 10) / 10,
    });
  }
  return out;
}

function formatNotaFecha(fecha: string): string {
  if (!fecha?.trim()) return '—';
  const d = new Date(fecha);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' });
}

function computeWeightedPromedioAndUltima(
  materia: MateriaConNotas,
  nestedLogros: LogroBloqueApi[] | undefined
): { promedioFinal: number | null; ultimaNota: number | null } {
  const notas = materia.notas ?? [];
  const map = new Map<string, number>();
  for (const n of notas) {
    if (!hasRecordedScore(n.nota)) continue;
    const id = n.assignmentId || n._id;
    map.set(id, Number(n.nota));
  }
  let promedioFinal = promedioForScoreMap(notas, nestedLogros, map);
  if (promedioFinal == null && materia.promedio != null) promedioFinal = materia.promedio;
  if (promedioFinal != null) promedioFinal = Math.round(promedioFinal * 10) / 10;

  let ultimaNota: number | null = null;
  let ultimaMs = 0;
  for (const n of notas) {
    if (!hasRecordedScore(n.nota)) continue;
    const ms = new Date(n.fecha).getTime();
    if (!Number.isNaN(ms) && ms >= ultimaMs) {
      ultimaMs = ms;
      ultimaNota = Number(n.nota);
    }
  }
  return { promedioFinal, ultimaNota };
}

function openKiwiAssistWithPrompt(
  message: string,
  autoSend = true,
  options?: { bodyExtras?: Record<string, unknown> },
) {
  window.dispatchEvent(
    new CustomEvent<{ message: string; autoSend?: boolean; bodyExtras?: Record<string, unknown> }>(
      'evos:kiwi-open',
      {
        detail: { message, autoSend, bodyExtras: options?.bodyExtras },
      },
    ),
  );
}

// =========================================================
// COMPONENTE PRINCIPAL
// =========================================================

export default function StudentNotesPage() {
  const { user } = useAuth();
  const [location, setLocation] = useLocation();
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const [collapsedIndicators, setCollapsedIndicators] = useState<Set<string>>(new Set());

  const role = user?.rol;
  const isPadre = role === 'padre';
  const isEstudiante = role === 'estudiante';
  const canAccessNotes = isEstudiante || isPadre;

  // Permite deep-link a una materia específica (desde dashboard padre): /parent/notas?subjectId=<groupSubjectId>
  useEffect(() => {
    if (selectedSubject) return;
    const qs = location.split('?')[1] ?? '';
    if (!qs) return;
    const sp = new URLSearchParams(qs);
    const subjectId = sp.get('subjectId') || sp.get('materiaId') || sp.get('subject');
    if (subjectId) setSelectedSubject(subjectId);
  }, [location, selectedSubject]);

  const { data: hijosRaw, isLoading: loadingHijos } = useQuery<{ _id: string; nombre: string }[]>({
    queryKey: ['/api/users/me/hijos'],
    queryFn: () => apiRequest('GET', '/api/users/me/hijos'),
    enabled: !!user?.id && isPadre,
  });
  const hijos = Array.isArray(hijosRaw) ? hijosRaw : [];
  const primerHijoId = hijos[0]?._id;
  const nombreHijo = hijos[0]?.nombre || 'tu hijo/a';
  const notasListPath = isPadre ? '/parent/notas' : '/mi-aprendizaje/notas';
  const analyticsHref = (groupSubjectId: string | null | undefined, subjectIdFallback: string) => {
    const cid = groupSubjectId || subjectIdFallback;
    if (isPadre && primerHijoId) return `/parent/analytics/${primerHijoId}/${cid}`;
    return `/student/course/${cid}/analytics`;
  };

  const { data: notesDataEstudiante, isLoading: loadingEstudiante, isError: errorEstudiante, refetch: refetchEstudiante } = useQuery<{ materias: MateriaConNotas[]; total: number }>({
    queryKey: ['studentNotes', user?.id],
    queryFn: () => apiRequest('GET', '/api/student/notes'),
    enabled: !!user?.id && isEstudiante,
    staleTime: 0,
    retry: 1,
    retryDelay: 2000,
  });

  const { data: notesDataHijo, isLoading: loadingHijo, isError: errorHijo, refetch: refetchHijo } = useQuery<{ materias: MateriaConNotas[]; total: number }>({
    queryKey: ['/api/student/hijo', primerHijoId, 'notes'],
    queryFn: () => {
      if (!primerHijoId) return Promise.resolve({ materias: [], total: 0 });
      return apiRequest('GET', `/api/student/hijo/${primerHijoId}/notes`);
    },
    enabled: !!user?.id && !!primerHijoId && isPadre,
    staleTime: 0,
  });

  const notesData = isEstudiante ? notesDataEstudiante : notesDataHijo;
  const isLoadingNotes = isEstudiante ? loadingEstudiante : loadingHijo;
  const isError = isEstudiante ? errorEstudiante : errorHijo;
  const refetch = isEstudiante ? refetchEstudiante : refetchHijo;

  type CourseItem = { _id: string; nombre: string };
  const { data: coursesEstudiante, isLoading: loadingCoursesEstudiante } = useQuery<CourseItem[]>({
    queryKey: ['/api/users/me/courses'],
    queryFn: () => apiRequest('GET', '/api/users/me/courses'),
    enabled: !!user?.id && isEstudiante,
    retry: 1,
    retryDelay: 2000,
  });
  const { data: coursesHijo, isLoading: loadingCoursesHijo } = useQuery<CourseItem[]>({
    queryKey: ['/api/student/hijo', primerHijoId, 'courses'],
    queryFn: () => apiRequest('GET', `/api/student/hijo/${primerHijoId}/courses`),
    enabled: !!user?.id && !!primerHijoId && isPadre,
  });
  const coursesRaw = isEstudiante ? coursesEstudiante : coursesHijo;
  const allCourses = Array.isArray(coursesRaw) ? coursesRaw : [];
  const loadingCourses = isEstudiante ? loadingCoursesEstudiante : (!!primerHijoId && loadingCoursesHijo);
  /* Estudiante: no bloquear en courses (solo notas). Padre: incluir loadingHijos para no mostrar
     "vincula estudiante" mientras el listado de hijos aún carga. */
  const isLoading = isEstudiante
    ? isLoadingNotes
    : loadingHijos || isLoadingNotes || loadingCourses;

  // Todas las materias del estudiante: de allCourses, con notas cuando existan (si no, N/A). Si courses aún no cargó, usar solo materias con notas.
  const subjects: SubjectGrade[] = useMemo(() => {
    const materiasConNotas = notesData?.materias ?? [];
    const byId = new Map<string, MateriaConNotas>();
    for (const m of materiasConNotas) byId.set(m._id, m);
    const coursesToShow = allCourses.length > 0 ? allCourses : materiasConNotas.map((m) => ({ _id: m._id, nombre: m.nombre }));
    return coursesToShow.map((course) => {
      const m = byId.get(course._id);
      if (m) {
        // Importante: NO precargar logros para todas las materias aquí.
        // Eso dispara N requests (/api/logros-calificacion) y hace que la página sea lenta e inestable.
        // Para la lista general y el gráfico, calculamos con las notas disponibles; los pesos (logros)
        // se consultan on-demand al abrir el detalle de una materia.
        const { promedioFinal, ultimaNota } = computeWeightedPromedioAndUltima(m, undefined);
        const estado = getGradeLevel(promedioFinal);
        const colorAcento = GRADE_COLORS[estado].accent;
        return {
          _id: m._id,
          groupSubjectId: m.groupSubjectId ?? null,
          nombre: m.nombre,
          promedio: promedioFinal,
          ultimaNota,
          estado,
          tendencia: m.tendencia ?? 'stable',
          colorAcento,
        };
      }
      return {
        _id: course._id,
        groupSubjectId: course._id,
        nombre: course.nombre,
        promedio: null,
        ultimaNota: null,
        estado: 'sin_notas' as const,
        tendencia: 'stable' as const,
        colorAcento: GRADE_COLORS['sin_notas'].accent,
      };
    });
  }, [allCourses, notesData?.materias]);

  const selectedSubjectData = selectedSubject
    ? notesData?.materias.find(m => m._id === selectedSubject)
    : null;

  const courseIdForLogros = selectedSubjectData?.groupSubjectId ?? '';

  const { data: logrosData } = useQuery<LogrosApiResponse>({
    queryKey: ['/api/logros-calificacion', courseIdForLogros],
    queryFn: () => apiRequest('GET', `/api/logros-calificacion?courseId=${encodeURIComponent(courseIdForLogros)}`),
    enabled: !!courseIdForLogros,
  });

  const subjectDetail: SubjectDetail | null = selectedSubjectData ? (() => {
    const pack: GradingPack | undefined =
      selectedSubjectData.groupSubjectId && logrosData
        ? { nested: logrosData.logros ?? [], plano: logrosData.indicadoresPlano ?? [] }
        : undefined;
    const { promedioFinal: computedFinal, ultimaNota: computedUltima } = computeWeightedPromedioAndUltima(
      selectedSubjectData,
      pack?.nested
    );
    const ultimaNota = computedUltima;
    const estado = getGradeLevel(computedFinal);
    const notas = selectedSubjectData.notas ?? [];
    const logrosList = pack?.plano ?? [];
    const hasWeightedLogros = logrosList.length > 0;

    const categorias: GradeDetail[] = [];
    const promedioFinal = computedFinal;

    const dedupeCat = (arr: NotaReal[]) => {
      const m = new Map<string, NotaReal>();
      for (const n of arr) {
        const id = n.assignmentId || n._id;
        if (!m.has(id)) m.set(id, n);
      }
      return [...m.values()];
    };

    if (hasWeightedLogros && logrosList.length > 0) {
      const logrosOrdenados = [...logrosList].sort((a, b) => (a.orden ?? 999) - (b.orden ?? 999));
      for (const logro of logrosOrdenados) {
        const notasEnCategoria = dedupeCat(
          notas.filter((n) => String(n.gradingCategoryId ?? '') === String(logro._id))
        );
        const promCat = weightedGradeWithinLogro(
          notasEnCategoria.map((n) => ({ categoryWeightPct: n.categoryWeightPct })),
          notasEnCategoria.map((n) => (hasRecordedScore(n.nota) ? Number(n.nota) : null))
        );
        const pct = logro.porcentaje ?? 0;
        categorias.push({
          categoria: `${logro.nombre} (${pct}%)`,
          promedio: promCat != null ? Math.round(promCat * 10) / 10 : null,
          notas: notasEnCategoria.map((n) => ({
            actividad: n.tareaTitulo ?? 'Sin título',
            nota: hasRecordedScore(n.nota) ? Number(n.nota) : null,
            fecha: n.fecha ?? '',
            comentario: n.comentario ?? n.logro,
          })),
        });
      }
      const sinCategoria = dedupeCat(notas.filter((n) => !n.gradingCategoryId));
      if (sinCategoria.length > 0) {
        const scored = sinCategoria.filter((n) => hasRecordedScore(n.nota)).map((n) => Number(n.nota));
        const promSin = scored.length ? scored.reduce((s, x) => s + x, 0) / scored.length : null;
        categorias.push({
          categoria: 'Sin categoría',
          promedio: promSin != null ? Math.round(promSin * 10) / 10 : null,
          notas: sinCategoria.map((n) => ({
            actividad: n.tareaTitulo ?? 'Sin título',
            nota: hasRecordedScore(n.nota) ? Number(n.nota) : null,
            fecha: n.fecha ?? '',
            comentario: n.comentario ?? n.logro,
          })),
        });
      }
    } else {
      const deduped = dedupeCat(notas);
      const scored = deduped.filter((n) => hasRecordedScore(n.nota)).map((n) => Number(n.nota));
      categorias.push({
        categoria: 'Notas',
        promedio:
          scored.length ? Math.round((scored.reduce((a, b) => a + b, 0) / scored.length) * 10) / 10 : null,
        notas: deduped.map((n) => ({
          actividad: n.tareaTitulo ?? 'Sin título',
          nota: hasRecordedScore(n.nota) ? Number(n.nota) : null,
          fecha: n.fecha ?? '',
          comentario: n.comentario ?? n.logro,
        })),
      });
    }

    const evoPts = computeEvolucion(selectedSubjectData, pack?.nested);
    const evolucion = evoPts.map((p) => ({
      mes: p.dateStr,
      promedio: p.promedio,
      nota: p.promedio,
    }));

    return {
      _id: selectedSubjectData._id,
      nombre: selectedSubjectData.nombre,
      promedio: computedFinal,
      ultimaNota,
      estado,
      tendencia: selectedSubjectData.tendencia ?? 'stable',
      colorAcento: GRADE_COLORS[estado].accent,
      promedioFinal,
      profesorNombre: selectedSubjectData.profesorNombre ?? notas[0]?.profesorNombre ?? null,
      categorias,
      evolucion,
    };
  })() : null;

  // Promedio general solo sobre materias con notas
  const subjectsWithGrades = subjects.filter((s) => s.promedio !== null);
  const promedioGeneral = subjectsWithGrades.length > 0
    ? subjectsWithGrades.reduce((acc, s) => acc + (s.promedio ?? 0), 0) / subjectsWithGrades.length
    : 0;

  // Datos para el BarChart horizontal de comparativa de materias
  const barData = useMemo(() => {
    return [...subjects]
      .filter((s) => s.promedio !== null)
      .sort((a, b) => (b.promedio ?? 0) - (a.promedio ?? 0))
      .map((s) => ({
        nombre: s.nombre.length > 20 ? s.nombre.slice(0, 19) + '\u2026' : s.nombre,
        promedio: s.promedio,
        fill: GRADE_COLORS[getGradeLevel(s.promedio)].accent,
      }));
  }, [subjects]);

  const getEstadoColor = (estado: string) => {
    switch (estado) {
      case 'excelente':
        return 'bg-green-500/20 text-green-400 border-green-500/40';
      case 'bueno':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/40';
      case 'regular':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40';
      case 'bajo':
        return 'bg-red-500/20 text-red-400 border-red-500/40';
      case 'sin_notas':
        return 'bg-white/10 text-white/50 border-white/20';
      default:
        return 'bg-white/10 text-white/70 border-white/20';
    }
  };

  const getTendenciaIcon = (tendencia: string) => {
    switch (tendencia) {
      case 'up':
        return <TrendingUp className="w-4 h-4 text-green-400" />;
      case 'down':
        return <TrendingDown className="w-4 h-4 text-red-400" />;
      default:
        return <Minus className="w-4 h-4 text-yellow-400" />;
    }
  };

  // Salidas tempranas solo después de todos los hooks
  if (isLoading) {
    return (
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-10">
        <div className="max-w-7xl mx-auto w-full">
          <Breadcrumb items={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Notas' }]} />
          <div className="mt-4 text-white/80">Cargando notas...</div>
        </div>
      </div>
    );
  }

  if (isPadre && !primerHijoId) {
    return (
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-10">
        <div className="max-w-7xl mx-auto w-full">
          <Breadcrumb items={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Notas' }]} />
          <div className="mt-4">
            <h1 className="text-2xl font-bold text-white mb-2">Notas</h1>
            <p className="text-white/60">Vincula un estudiante en tu perfil para ver sus notas.</p>
          </div>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-10">
        <div className="max-w-7xl mx-auto w-full">
          <Breadcrumb items={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Notas' }]} />
          <Card className="bg-white/5 border-white/10 backdrop-blur-md mt-4">
            <CardContent className="p-8 text-center">
              <p className="text-red-300 mb-4">Error al cargar las notas. Revisa tu conexión.</p>
              <Button onClick={() => refetch()} className="bg-[#00c8ff] hover:bg-[#1e3cff]">Reintentar</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-10">
        <div className="max-w-7xl mx-auto w-full">
          <div className="mt-4 text-white/80">Cargando...</div>
        </div>
      </div>
    );
  }
  if (!canAccessNotes) {
    return (
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-10">
        <div className="max-w-7xl mx-auto w-full">
          <Breadcrumb items={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Notas' }]} />
          <div className="mt-4">
            <h1 className="text-2xl font-bold text-white mb-2">Notas</h1>
            <p className="text-white/60">Solo estudiantes y padres pueden ver esta página.</p>
          </div>
        </div>
      </div>
    );
  }

  // Vista principal (lista de materias)
  if (!selectedSubject) {
    // Usar `subjects` (notas + cursos unificados): si cursos API viene vacío pero hay materias en notas, igual hay filas (evita pantalla vacía errónea para padres).
    if (subjects.length === 0 && !isLoading) {
      const pageTitle = isPadre ? `Notas de ${nombreHijo}` : 'Mis Notas';
      const pageSubtitle = isPadre
        ? `Revisa el rendimiento académico de ${nombreHijo} por materia`
        : 'Revisa tu rendimiento académico por materia';
      const emptyMessage = isPadre
        ? `Las notas aparecerán aquí cuando las tareas de ${nombreHijo} sean calificadas.`
        : 'Las notas aparecerán aquí cuando tus tareas sean calificadas.';
      return (
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-10">
          <div className="max-w-7xl mx-auto w-full">
            <div className="mb-8">
              <Breadcrumb items={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Notas' }]} />
              <div className="mt-4">
                <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-2 font-['Poppins']">
                  {pageTitle}
                </h1>
                <p className="text-white/60 text-sm sm:text-base">
                  {pageSubtitle}
                </p>
              </div>
            </div>
            <Card className="bg-white/5 border-white/10 backdrop-blur-md">
              <CardContent className="p-12 text-center">
                <BookOpen className="w-16 h-16 text-[#00c8ff]/40 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-white mb-2">
                  No hay notas registradas
                </h3>
                <p className="text-white/60 mb-6">
                  {emptyMessage}
                </p>
                <div className="flex flex-col sm:flex-row gap-2 justify-center">
                  <Button
                    variant="outline"
                    className="border-white/20 text-white hover:bg-white/10"
                    onClick={() => refetch()}
                  >
                    Refrescar
                  </Button>
                  {isPadre && (
                    <Button
                      type="button"
                      variant="outline"
                      className="border-[#00c8ff]/45 text-[#00c8ff] hover:bg-[#00c8ff]/10"
                      onClick={() =>
                        openKiwiAssistWithPrompt(
                          `Soy acudiente de ${nombreHijo}. En evoOS aún no aparecen notas de ${nombreHijo}. Quiero orientación general: cómo puedo acompañar el año académico, qué hábitos conviene reforzar en casa y qué puedo preguntarle al colegio o a las materias, sin asumir calificaciones que aún no están cargadas.`,
                          true
                        )
                      }
                    >
                      <Sparkles className="w-4 h-4 mr-2" />
                      Consultar a Kiwi Assist
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      );
    }
    const pageTitle = isPadre ? `Notas de ${nombreHijo}` : 'Mis Notas';
    const pageSubtitle = isPadre
      ? `Revisa el rendimiento académico de ${nombreHijo} por materia (solo visualización)`
      : 'Revisa tu rendimiento académico por materia';
    const historialPath = isPadre ? '/parent/notas/historial' : '/mi-aprendizaje/notas/historial';

    return (
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-10">
        <div className="max-w-7xl mx-auto w-full">
          {/* Header */}
          <div className="mb-8">
            <Breadcrumb items={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Notas' }]} />
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mt-4">
              <div className="min-w-0 flex-1">
                <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-2 font-['Poppins']">
                  {pageTitle}
                </h1>
                <p className="text-white/60 text-sm sm:text-base">
                  {pageSubtitle}
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto sm:shrink-0">
                {isPadre && (
                  <Button
                    type="button"
                    variant="outline"
                    className="border-[#00c8ff]/45 text-[#00c8ff] hover:bg-[#00c8ff]/10 whitespace-nowrap"
                    onClick={() =>
                      openKiwiAssistWithPrompt(
                        `Genera un Evo Doc de análisis académico para ${nombreHijo}. Usa los datos del sistema; no pidas más información al usuario.`,
                        true,
                        {
                          bodyExtras: {
                            intent: 'parent_notes_evo_doc',
                            generateEvoDoc: true,
                            ...(primerHijoId ? { studentId: primerHijoId } : {}),
                          },
                        },
                      )
                    }
                  >
                    <Sparkles className="w-4 h-4 mr-2" />
                    Análisis con Kiwi Assist
                  </Button>
                )}
                <Button
                  onClick={() => setLocation(historialPath)}
                  className="bg-gradient-to-r from-[#002366] to-[#1e3cff] hover:opacity-90 whitespace-nowrap"
                >
                  Historial de notas
                </Button>
              </div>
            </div>
          </div>

          {/* Gráfica Comparativa */}
          <Card className="bg-white/5 border-white/10 backdrop-blur-md mb-6">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-[#00c8ff]" />
                Comparativa de Materias
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 md:p-6">
              {/* Leyenda de tiers */}
              <div className="flex flex-wrap gap-3 mb-4">
                {(['excelente', 'bueno', 'regular', 'bajo'] as const).map((level) => (
                  <div key={level} className="flex items-center gap-1.5">
                    <div
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ background: GRADE_COLORS[level].accent }}
                    />
                    <span className="text-xs text-white/50">
                      {GRADE_COLORS[level].label}
                    </span>
                  </div>
                ))}
              </div>
              {barData.length > 0 ? (
                <div style={{ width: '100%', height: Math.max(200, barData.length * 40 + 60) }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={barData}
                      layout="vertical"
                      margin={{ top: 8, right: 60, bottom: 8, left: 8 }}
                    >
                      <XAxis
                        type="number"
                        domain={[0, 100]}
                        tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 11 }}
                        stroke="rgba(255,255,255,0.15)"
                      />
                      <YAxis
                        type="category"
                        dataKey="nombre"
                        width={160}
                        tick={{ fill: 'rgba(255,255,255,0.85)', fontSize: 12 }}
                        axisLine={false}
                        tickLine={false}
                        interval={0}
                      />
                      <Tooltip
                        contentStyle={{
                          background: 'rgba(15,23,42,0.92)',
                          border: '1px solid rgba(255,255,255,0.10)',
                          borderRadius: 10,
                        }}
                        formatter={(v: number) => [`${Number(v).toFixed(1)}/100`, 'Promedio']}
                        labelStyle={{ color: 'rgba(255,255,255,0.9)', fontSize: 13 }}
                      />
                      <Bar dataKey="promedio" radius={[4, 8, 8, 4]} maxBarSize={24}>
                        {barData.map((entry, i) => (
                          <Cell key={i} fill={entry.fill} />
                        ))}
                        <LabelList
                          dataKey="promedio"
                          position="right"
                          formatter={(v: number) => `${Number(v).toFixed(1)}`}
                          style={{ fill: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: 600 }}
                        />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-[180px] flex items-center justify-center text-white/50 text-sm">
                  No hay promedios registrados aún.
                </div>
              )}
            </CardContent>
          </Card>

          {/* Banner de alerta: materias en riesgo */}
          {subjects.filter((s) => s.promedio !== null && s.promedio < 65).length > 0 && (
            <div
              style={{
                background: 'rgba(239,68,68,0.08)',
                border: '1px solid rgba(239,68,68,0.25)',
                borderRadius: 10,
                padding: '12px 16px',
                marginBottom: 16,
              }}
            >
              <p style={{ color: '#fca5a5', fontWeight: 600, marginBottom: 4, fontSize: 14 }}>
                Tienes {subjects.filter((s) => s.promedio !== null && s.promedio < 65).length} materia(s) que necesitan atención
              </p>
              <p style={{ color: 'rgba(252,165,165,0.7)', fontSize: 13 }}>
                {subjects
                  .filter((s) => s.promedio !== null && s.promedio < 65)
                  .map((s) => s.nombre)
                  .join(' · ')}
              </p>
            </div>
          )}

          {/* KPI Strip */}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}>
            {(() => {
              const generalNum = subjectsWithGrades.length > 0
                ? Math.round(promedioGeneral * 10) / 10
                : null;
              const generalColor = generalNum === null
                ? 'rgba(255,255,255,0.5)'
                : GRADE_COLORS[getGradeLevel(generalNum)].accent;

              const bestSubject = [...subjects]
                .filter((s) => s.promedio !== null)
                .sort((a, b) => (b.promedio ?? 0) - (a.promedio ?? 0))[0];
              const bestName = bestSubject
                ? (bestSubject.nombre.length > 18 ? bestSubject.nombre.slice(0, 17) + '\u2026' : bestSubject.nombre)
                : '—';

              const worstSubject = [...subjects]
                .filter((s) => s.promedio !== null)
                .sort((a, b) => (a.promedio ?? 0) - (b.promedio ?? 0))[0];
              const worstName = worstSubject
                ? (worstSubject.nombre.length > 18 ? worstSubject.nombre.slice(0, 17) + '\u2026' : worstSubject.nombre)
                : '—';

              const chips = [
                {
                  label: 'Promedio general',
                  value: generalNum !== null ? generalNum.toFixed(1) : '—',
                  accentColor: generalColor,
                  borderColor: `${generalColor}40`,
                  bgColor: `${generalColor}10`,
                  borderLeft: undefined as string | undefined,
                },
                {
                  label: 'Mejor materia',
                  value: bestName,
                  accentColor: '#10b981',
                  borderColor: 'rgba(16,185,129,0.25)',
                  bgColor: 'rgba(16,185,129,0.06)',
                  borderLeft: '3px solid #10b981',
                },
                {
                  label: 'Peor materia',
                  value: worstName,
                  accentColor: '#ef4444',
                  borderColor: 'rgba(239,68,68,0.25)',
                  bgColor: 'rgba(239,68,68,0.06)',
                  borderLeft: '3px solid #ef4444',
                },
              ];

              return chips.map((chip, i) => (
                <div
                  key={i}
                  style={{
                    background: chip.bgColor,
                    border: `1px solid ${chip.borderColor}`,
                    borderLeft: chip.borderLeft ?? `1px solid ${chip.borderColor}`,
                    borderRadius: 12,
                    padding: '12px 16px',
                    flex: '1',
                    minWidth: 140,
                  }}
                >
                  <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
                    {chip.label}
                  </p>
                  <p style={{ color: '#ffffff', fontSize: 20, fontWeight: 700, lineHeight: 1.2 }}>
                    {chip.value}
                  </p>
                </div>
              ));
            })()}
          </div>

          {/* Lista de Materias */}
          <div className="mb-4">
            <h2 className="text-xs font-semibold text-white/35 uppercase tracking-widest">Tus materias</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {subjects.map((subject) => {
              const tier = GRADE_COLORS[subject.estado];
              return (
              <Card
                key={subject._id}
                className="hover-elevate cursor-pointer group overflow-hidden"
                style={{
                  background: `radial-gradient(circle at 0% 0%, ${tier.accent}14 0%, rgba(255,255,255,0.02) 55%)`,
                  border: `1px solid ${tier.accent}35`,
                  borderLeft: `4px solid ${tier.accent}`,
                }}
                onClick={() => setSelectedSubject(subject._id)}
              >
                <CardHeader className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div
                      className="w-20 h-20 rounded-2xl flex items-center justify-center transition-transform duration-300 group-hover:scale-105"
                      style={{
                        backgroundColor: tier.bg,
                        border: `2px solid ${tier.accent}50`,
                        boxShadow: `0 0 18px ${tier.accent}35`,
                      }}
                    >
                      <BookOpen className="w-9 h-9 text-white" />
                    </div>
                  </div>
                  <CardTitle className="text-white text-2xl font-bold mb-2">
                    {subject.nombre}
                  </CardTitle>
                  <div className="flex items-center gap-2 mb-3">
                    {subject.promedio !== null ? (
                      <>
                        <span className="text-3xl font-bold text-white">
                          {Math.round(subject.promedio)}
                        </span>
                        <span className="text-white/70">/ 100</span>
                      </>
                    ) : (
                      <span className="text-sm text-white/60">Sin calificar</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="outline" className={`${tier.badgeClass} flex items-center gap-1`}>
                      {tier.arrow && <span>{tier.arrow}</span>}
                      {tier.label}
                    </Badge>
                  </div>
                  <p className="text-sm text-white/70">
                    Última nota: <span className="text-white font-semibold">{subject.ultimaNota !== null ? Math.round(subject.ultimaNota) : '—'}</span>
                  </p>
                </CardHeader>
                <CardContent className="p-6 pt-0">
                  <Button
                    variant="outline"
                    className="w-full text-white hover:bg-white/10 transition-colors"
                    style={{
                      borderColor: `${tier.accent}60`,
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setLocation(analyticsHref(subject.groupSubjectId, subject._id));
                    }}
                  >
                    <BarChart3 className="w-4 h-4 mr-2" />
                    Vista analítica
                  </Button>
                </CardContent>
              </Card>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // Materia seleccionada pero sin notas (solo N/A)
  if (selectedSubject && !subjectDetail) {
    const subjectCard = subjects.find((s) => s._id === selectedSubject);
    return (
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-10">
        <div className="max-w-7xl mx-auto w-full">
          <div className="mb-8">
            <Breadcrumb
              items={[
                { label: 'Dashboard', href: '/dashboard' },
                { label: 'Notas', href: notasListPath },
                { label: subjectCard?.nombre ?? 'Materia' },
              ]}
            />
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div className="min-w-0 flex-1">
                <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-1 font-['Poppins'] break-words">
                  {subjectCard?.nombre ?? 'Materia'}
                </h1>
                <Badge className={getEstadoColor('sin_notas')}>—</Badge>
              </div>
              <div className="w-20 h-20 rounded-2xl flex items-center justify-center" style={{ backgroundColor: subjectCard?.colorAcento }}>
                <BookOpen className="w-10 h-10 text-white" />
              </div>
            </div>
          </div>
          <Card className="bg-white/5 border-white/10 backdrop-blur-md">
            <CardContent className="p-12 text-center">
              <AlertCircle className="w-12 h-12 text-white/40 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">Sin notas registradas</h3>
              <p className="text-white/60 mb-6">Aún no hay calificaciones para esta materia.</p>
              <Button
                variant="outline"
                className="border-[#3B82F6]/50 text-[#00c8ff] hover:bg-[#3B82F6]/10"
                onClick={() =>
                  setLocation(analyticsHref(subjectCard?.groupSubjectId ?? null, selectedSubject))
                }
              >
                <BarChart3 className="w-4 h-4 mr-2" />
                Vista analítica
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Vista detallada de una materia
  if (selectedSubject && subjectDetail) {
    const detailChartConfig = {
      promedio: {
        label: 'Promedio',
        color: subjectDetail.colorAcento
      }
    };

    return (
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-10">
        <div className="max-w-7xl mx-auto w-full">
          <div className="mb-8">
            <Breadcrumb
              items={[
                { label: 'Dashboard', href: '/dashboard' },
                { label: 'Notas', href: notasListPath },
                { label: subjectDetail.nombre },
              ]}
            />
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div className="min-w-0 flex-1">
                <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-1 font-['Poppins'] break-words">
                  {subjectDetail.nombre}
                </h1>
                {subjectDetail.profesorNombre && (
                  <p className="text-white/70 text-sm mb-3">Profesor: {subjectDetail.profesorNombre}</p>
                )}
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-bold text-white">
                      {subjectDetail.promedioFinal != null ? Math.round(subjectDetail.promedioFinal) : '—'}
                    </span>
                    {subjectDetail.promedioFinal != null && <span className="text-white/50">/ 100</span>}
                  </div>
                  <Badge className={getEstadoColor(subjectDetail.estado)}>
                    {subjectDetail.estado.charAt(0).toUpperCase() + subjectDetail.estado.slice(1)}
                  </Badge>
                </div>
              </div>
              <div
                className="w-20 h-20 rounded-2xl flex items-center justify-center"
                style={{ backgroundColor: subjectDetail.colorAcento }}
              >
                <BookOpen className="w-10 h-10 text-white" />
              </div>
            </div>
          </div>

          {/* Gráfica de Evolución */}
          {(() => {
            const evolucion = subjectDetail.evolucion;
            const allSameDateStr =
              evolucion.length > 0 && evolucion.every((p) => p.mes === evolucion[0].mes);
            const showPlaceholder = evolucion.length <= 1 || allSameDateStr;
            const totalNotas = subjectDetail.categorias.reduce(
              (sum, cat) => sum + cat.notas.length,
              0
            );
            return (
              <Card className="bg-white/5 border-white/10 backdrop-blur-md mb-8">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-[#00c8ff]" />
                    Evolución del Promedio
                  </CardTitle>
                  <CardDescription className="text-white/60">
                    Progreso en {subjectDetail.nombre}
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-4 md:p-6">
                  {showPlaceholder ? (
                    <div
                      style={{
                        background: 'rgba(255,255,255,0.02)',
                        border: '1px dashed rgba(255,255,255,0.12)',
                        borderRadius: 12,
                        padding: '32px 24px',
                        textAlign: 'center',
                      }}
                    >
                      <TrendingUp
                        className="mx-auto mb-4"
                        style={{ width: 40, height: 40, color: 'rgba(255,255,255,0.3)' }}
                      />
                      <p style={{ color: 'rgba(255,255,255,0.7)', marginBottom: 8, fontWeight: 500 }}>
                        La evolución se mostrará conforme el profesor califique más actividades
                      </p>
                      <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>
                        Actualmente hay {totalNotas} nota(s) registrada(s)
                      </p>
                    </div>
                  ) : (
                    <div className="w-full overflow-x-auto">
                      <ChartContainer
                        config={detailChartConfig}
                        className="h-[280px] md:h-[320px] min-w-[300px]"
                      >
                        <LineChart
                          data={evolucion}
                          margin={{ top: 20, right: 20, bottom: 40, left: 20 }}
                        >
                          <CartesianGrid
                            strokeDasharray="3 3"
                            stroke="rgba(255,255,255,0.1)"
                          />
                          <XAxis
                            dataKey="mes"
                            stroke="rgba(255,255,255,0.5)"
                            tick={{ fill: 'rgba(255,255,255,0.7)', fontSize: 12 }}
                            angle={-45}
                            textAnchor="end"
                            height={60}
                          />
                          <YAxis
                            domain={[0, 100]}
                            stroke="rgba(255,255,255,0.5)"
                            tick={{ fill: 'rgba(255,255,255,0.7)', fontSize: 12 }}
                            width={40}
                          />
                          <ChartTooltip
                            content={<ChartTooltipContent />}
                            cursor={{ stroke: subjectDetail.colorAcento, strokeWidth: 1 }}
                          />
                          <Line
                            type="monotone"
                            dataKey="promedio"
                            stroke={subjectDetail.colorAcento}
                            strokeWidth={3}
                            dot={{ fill: subjectDetail.colorAcento, r: 6 }}
                          />
                        </LineChart>
                      </ChartContainer>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })()}

          {/* Notas por Logro (jerarquía) o fallback plano */}
          {logrosData?.logros?.length ? (
            <div className="space-y-6">
              {[...logrosData.logros]
                .sort((a, b) => (a.orden ?? 999) - (b.orden ?? 999))
                .map((logro) => {
                  const indicadoresConCat = logro.indicadores.map((ind) => {
                    const catKey = `${ind.nombre} (${ind.porcentaje}%)`;
                    const cat = subjectDetail!.categorias.find((c) => c.categoria === catKey);
                    return { ind, cat };
                  });

                  let weightedSum = 0;
                  let totalPct = 0;
                  for (const { ind, cat } of indicadoresConCat) {
                    if (cat?.promedio != null) {
                      weightedSum += cat.promedio * ind.porcentaje;
                      totalPct += ind.porcentaje;
                    }
                  }
                  const promedioLogro = totalPct > 0 ? weightedSum / totalPct : null;
                  const nivelLogro =
                    promedioLogro == null
                      ? null
                      : promedioLogro >= 85
                        ? 'excelente'
                        : promedioLogro >= 70
                          ? 'bueno'
                          : promedioLogro >= 60
                            ? 'regular'
                            : 'bajo';

                  const notaColor = (n: number | null) =>
                    n == null
                      ? 'rgba(255,255,255,0.4)'
                      : n >= 75
                        ? '#10b981'
                        : n >= 65
                          ? '#f59e0b'
                          : '#ef4444';

                  return (
                    <div
                      key={logro._id}
                      style={{
                        background: 'rgba(255,255,255,0.05)',
                        border: '1px solid rgba(255,255,255,0.10)',
                        borderRadius: 14,
                        overflow: 'hidden',
                      }}
                    >
                      {/* Header del logro */}
                      <div
                        style={{
                          padding: '16px 20px',
                          borderBottom: '1px solid rgba(255,255,255,0.07)',
                        }}
                      >
                        <p
                          style={{
                            fontSize: 11,
                            color: 'rgba(255,255,255,0.5)',
                            textTransform: 'uppercase',
                            letterSpacing: '0.1em',
                            marginBottom: 4,
                          }}
                        >
                          LOGRO &middot; {logro.pesoEnCurso}% DEL CURSO
                        </p>
                        <p
                          style={{
                            color: 'white',
                            fontWeight: 500,
                            marginBottom: 8,
                            lineHeight: 1.5,
                          }}
                        >
                          {logro.descripcion}
                        </p>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>
                            Promedio en este logro:{' '}
                            {promedioLogro != null
                              ? `${(Math.round(promedioLogro * 10) / 10).toFixed(1)}/100`
                              : '—'}
                          </span>
                          {nivelLogro && (
                            <Badge className={getEstadoColor(nivelLogro)}>
                              {nivelLogro.charAt(0).toUpperCase() + nivelLogro.slice(1)}
                            </Badge>
                          )}
                        </div>
                      </div>

                      {/* Indicadores */}
                      <div
                        style={{
                          padding: '12px 16px 16px 24px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 10,
                        }}
                      >
                        {indicadoresConCat.map(({ ind, cat }) => {
                          const isOpen = !collapsedIndicators.has(ind._id);
                          const toggleInd = () => {
                            setCollapsedIndicators((prev) => {
                              const next = new Set(prev);
                              if (next.has(ind._id)) next.delete(ind._id);
                              else next.add(ind._id);
                              return next;
                            });
                          };

                          return (
                            <div
                              key={ind._id}
                              style={{
                                background: 'rgba(255,255,255,0.02)',
                                border: '1px solid rgba(255,255,255,0.06)',
                                borderRadius: 8,
                                overflow: 'hidden',
                              }}
                            >
                              <button
                                type="button"
                                style={{
                                  width: '100%',
                                  padding: '12px 14px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  background: 'none',
                                  border: 'none',
                                  cursor: 'pointer',
                                }}
                                onClick={toggleInd}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  {isOpen ? (
                                    <ChevronDown className="w-4 h-4 text-white/40" />
                                  ) : (
                                    <ChevronRight className="w-4 h-4 text-white/40" />
                                  )}
                                  <span
                                    style={{ color: 'white', fontWeight: 600, fontSize: 14 }}
                                  >
                                    {ind.nombre}
                                  </span>
                                  <span
                                    style={{
                                      fontSize: 11,
                                      color: 'rgba(255,255,255,0.5)',
                                      background: 'rgba(255,255,255,0.08)',
                                      padding: '2px 6px',
                                      borderRadius: 4,
                                    }}
                                  >
                                    {ind.porcentaje}%
                                  </span>
                                </div>
                                <span
                                  style={{
                                    fontSize: 15,
                                    fontWeight: 700,
                                    color: notaColor(cat?.promedio ?? null),
                                    flexShrink: 0,
                                  }}
                                >
                                  {cat?.promedio != null
                                    ? `${(Math.round(cat.promedio * 10) / 10).toFixed(1)}/100`
                                    : !cat || cat.notas.length === 0
                                      ? 'Sin actividades'
                                      : '—'}
                                </span>
                              </button>

                              {isOpen && cat && cat.notas.length > 0 && (
                                <div
                                  style={{
                                    borderTop: '1px solid rgba(255,255,255,0.06)',
                                    padding: '8px 14px 12px 36px',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: 8,
                                  }}
                                >
                                  {cat.notas.map((nota, ni) => (
                                    <div
                                      key={ni}
                                      style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'flex-start',
                                        padding: '8px 10px',
                                        background: 'rgba(255,255,255,0.03)',
                                        borderRadius: 6,
                                      }}
                                    >
                                      <div style={{ flex: 1 }}>
                                        <p
                                          style={{
                                            color: 'white',
                                            fontSize: 13,
                                            fontWeight: 500,
                                            marginBottom: 2,
                                          }}
                                        >
                                          {nota.actividad}
                                        </p>
                                        <p
                                          style={{
                                            color: 'rgba(255,255,255,0.5)',
                                            fontSize: 12,
                                          }}
                                        >
                                          {formatNotaFecha(nota.fecha)}
                                        </p>
                                        {nota.comentario && (
                                          <p
                                            style={{
                                              color: 'rgba(255,255,255,0.6)',
                                              fontSize: 12,
                                              marginTop: 4,
                                            }}
                                          >
                                            {nota.comentario}
                                          </p>
                                        )}
                                      </div>
                                      <div
                                        style={{
                                          flexShrink: 0,
                                          marginLeft: 12,
                                          textAlign: 'right',
                                        }}
                                      >
                                        {nota.nota === null ? (
                                          <span
                                            style={{
                                              fontSize: 12,
                                              padding: '3px 8px',
                                              background: 'rgba(255,255,255,0.06)',
                                              borderRadius: 4,
                                              color: 'rgba(255,255,255,0.5)',
                                            }}
                                          >
                                            Sin calificar
                                          </span>
                                        ) : (
                                          <>
                                            <span
                                              style={{
                                                fontSize: 18,
                                                fontWeight: 700,
                                                color: nota.nota === 0
                                                  ? '#ef4444'
                                                  : notaColor(nota.nota),
                                              }}
                                            >
                                              {nota.nota}
                                            </span>
                                            <span
                                              style={{
                                                fontSize: 11,
                                                color: 'rgba(255,255,255,0.4)',
                                              }}
                                            >
                                              /100
                                            </span>
                                          </>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}

                              {isOpen && (!cat || cat.notas.length === 0) && (
                                <div
                                  style={{
                                    borderTop: '1px solid rgba(255,255,255,0.06)',
                                    padding: '12px 14px 12px 36px',
                                  }}
                                >
                                  <p
                                    style={{
                                      color: 'rgba(255,255,255,0.4)',
                                      fontSize: 13,
                                      fontStyle: 'italic',
                                    }}
                                  >
                                    El profesor aún no ha calificado este indicador
                                  </p>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
            </div>
          ) : (
            /* Fallback: vista plana si no hay logros estructurados */
            <div className="space-y-6">
              {subjectDetail.categorias.map((categoria, idx) => (
                <Card key={idx} className="bg-white/5 border-white/10 backdrop-blur-md">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-white">{categoria.categoria}</CardTitle>
                      <div className="flex items-center gap-2">
                        <span className="text-xl font-bold text-white">
                          {categoria.promedio != null ? Math.round(categoria.promedio) : '—'}
                        </span>
                        {categoria.promedio != null && (
                          <span className="text-white/50">/ 100</span>
                        )}
                      </div>
                    </div>
                    <CardDescription className="text-white/60">
                      {categoria.notas.length}{' '}
                      {categoria.notas.length === 1 ? 'actividad' : 'actividades'}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {categoria.notas.map((nota, notaIdx) => (
                        <div
                          key={notaIdx}
                          className="p-4 bg-white/5 border border-white/10 rounded-lg"
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1">
                              <h4 className="font-semibold text-white mb-1">{nota.actividad}</h4>
                              <p className="text-sm text-white/60">{formatNotaFecha(nota.fecha)}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              {nota.nota === null ? (
                                <span className="text-sm text-white/40">Sin calificar</span>
                              ) : (
                                <>
                                  <span className="text-2xl font-bold text-white">
                                    {Math.round(nota.nota)}
                                  </span>
                                  <span className="text-white/50">/ 100</span>
                                </>
                              )}
                            </div>
                          </div>
                          {nota.comentario && (
                            <div className="mt-3 p-3 bg-white/5 rounded-lg border border-white/10">
                              <div className="flex items-start gap-2">
                                <MessageSquare className="w-4 h-4 text-[#00c8ff] mt-0.5 flex-shrink-0" />
                                <p className="text-sm text-white/80">{nota.comentario}</p>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Fallback para evitar pantalla en blanco si ninguna rama anterior coincidió
  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-10">
      <div className="max-w-7xl mx-auto w-full">
        <Breadcrumb items={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Notas' }]} />
        <div className="mt-4">
          <h1 className="text-2xl font-bold text-white mb-2">{isPadre ? `Notas de ${nombreHijo}` : 'Mis Notas'}</h1>
          <p className="text-white/60 mb-4">Revisa tu rendimiento académico por materia.</p>
          <Button
            variant="outline"
            className="border-white/20 text-white hover:bg-white/10"
            onClick={() => setSelectedSubject(null)}
          >
            Ver lista de materias
          </Button>
        </div>
      </div>
    </div>
  );
}

