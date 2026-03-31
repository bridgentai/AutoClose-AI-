import { useMemo, useState } from 'react';
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
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { LineChart, Line, XAxis, YAxis, CartesianGrid } from 'recharts';
import { Breadcrumb } from '@/components/Breadcrumb';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
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

/** Colores distintos por materia (icono y línea en el gráfico). */
const SUBJECT_COLORS = ['#00c8ff', '#1e3cff', '#ffd700', '#10b981', '#f43f5e', '#8b5cf6', '#f97316', '#06b6d4', '#84cc16', '#ec4899'];

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

// =========================================================
// COMPONENTE PRINCIPAL
// =========================================================

export default function StudentNotesPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);

  const role = user?.rol;
  const isPadre = role === 'padre';
  const isEstudiante = role === 'estudiante';
  const canAccessNotes = isEstudiante || isPadre;

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
    return coursesToShow.map((course, index) => {
      const color = SUBJECT_COLORS[index % SUBJECT_COLORS.length];
      const m = byId.get(course._id);
      if (m) {
        // Importante: NO precargar logros para todas las materias aquí.
        // Eso dispara N requests (/api/logros-calificacion) y hace que la página sea lenta e inestable.
        // Para la lista general y el gráfico, calculamos con las notas disponibles; los pesos (logros)
        // se consultan on-demand al abrir el detalle de una materia.
        const { promedioFinal, ultimaNota } = computeWeightedPromedioAndUltima(m, undefined);
        const estado: SubjectGrade['estado'] =
          promedioFinal == null ? 'sin_notas' : promedioFinal >= 65 ? 'bueno' : 'bajo';
        return {
          _id: m._id,
          groupSubjectId: m.groupSubjectId ?? null,
          nombre: m.nombre,
          promedio: promedioFinal,
          ultimaNota,
          estado,
          tendencia: m.tendencia ?? 'stable',
          colorAcento: color,
        };
      }
      return {
        _id: course._id,
        groupSubjectId: course._id,
        nombre: course.nombre,
        promedio: null,
        ultimaNota: null,
        estado: 'sin_notas',
        tendencia: 'stable',
        colorAcento: color,
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
    const estado: SubjectGrade['estado'] =
      computedFinal == null ? 'sin_notas' : computedFinal >= 65 ? 'bueno' : 'bajo';
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
      colorAcento: selectedSubjectData.colorAcento || '#00c8ff',
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

  // Evolución por materia y datos para gráfico (hook antes de cualquier return)
  const { chartData, chartConfig, subjectsWithEvolucion } = useMemo(() => {
    const withGrades = subjects.filter((s) => s.promedio !== null);
    const materiasConNotas = notesData?.materias ?? [];
    const byId = new Map(materiasConNotas.map((m) => [m._id, m]));

    const evolucionPorMateria: Record<string, { date: Date; dateStr: string; promedio: number }[]> = {};
    const allPoints: { date: Date; dateStr: string }[] = [];
    for (const s of withGrades) {
      const m = byId.get(s._id);
      if (!m) continue;
      const ev = computeEvolucion(m, undefined);
      evolucionPorMateria[s._id] = ev;
      for (const p of ev) allPoints.push({ date: p.date, dateStr: p.dateStr });
    }
    allPoints.sort((a, b) => a.date.getTime() - b.date.getTime());
    const seen = new Set<string>();
    const sortedRows: { date: Date; dateStr: string }[] = [];
    for (const p of allPoints) {
      const t = p.date.getTime();
      if (Number.isNaN(t) || !p.dateStr) continue;
      const key = String(t);
      if (seen.has(key)) continue;
      seen.add(key);
      sortedRows.push(p);
    }
    const getValue = (subjectId: string, rowDate: Date): number | undefined => {
      const ev = evolucionPorMateria[subjectId];
      if (!ev?.length) return undefined;
      let last: { promedio: number } | null = null;
      for (const point of ev) {
        if (point.date.getTime() <= rowDate.getTime()) last = point;
        else break;
      }
      return last?.promedio;
    };
    const chartData = sortedRows.map((row) => {
      const rowData: Record<string, string | number> = { period: row.dateStr };
      for (const s of withGrades) {
        const v = getValue(s._id, row.date);
        if (v !== undefined) rowData[s._id] = v;
      }
      return rowData;
    });
    const chartConfig: Record<string, { label: string; color: string }> = {};
    for (const s of withGrades) {
      chartConfig[s._id] = { label: s.nombre, color: s.colorAcento || '#00c8ff' };
    }
    return { chartData, chartConfig, subjectsWithEvolucion: withGrades };
  }, [subjects, notesData?.materias]);

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
                <Button
                  variant="outline"
                  className="border-white/20 text-white hover:bg-white/10"
                  onClick={() => refetch()}
                >
                  Refrescar
                </Button>
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
              <Button
                onClick={() => setLocation(historialPath)}
                className="bg-gradient-to-r from-[#002366] to-[#1e3cff] hover:opacity-90 whitespace-nowrap"
              >
                Historial de notas
              </Button>
            </div>
          </div>

          {/* Gráfica General */}
          <Card className="bg-white/5 border-white/10 backdrop-blur-md mb-8">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-[#00c8ff]" />
                Promedio General por Materia
              </CardTitle>
              <CardDescription className="text-white/60 space-y-2">
                <div className="flex items-center gap-3 flex-wrap">
                  <span>Promedio general: <span className="text-white font-semibold">{subjectsWithGrades.length > 0 ? Math.round(promedioGeneral * 10) / 10 : '—'}</span></span>
                  {subjectsWithGrades.length > 0 && (
                    <div className="flex-1 min-w-[120px] max-w-[200px] h-2 rounded-full bg-white/10 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[#00c8ff] transition-all duration-300"
                        style={{ width: `${Math.min(100, Math.max(0, promedioGeneral))}%` }}
                      />
                    </div>
                  )}
                </div>
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 md:p-6">
              {chartData.length > 0 && subjectsWithEvolucion.length > 0 ? (
                <div className="w-full flex flex-col md:flex-row gap-4">
                  <div className="flex-1 overflow-x-auto">
                    <ChartContainer config={chartConfig} className="h-[280px] md:h-[320px] min-w-[300px]">
                      <LineChart data={chartData} margin={{ top: 20, right: 24, bottom: 40, left: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                        <XAxis
                          dataKey="period"
                          stroke="rgba(255,255,255,0.5)"
                          tick={{ fill: 'rgba(255,255,255,0.7)', fontSize: 12 }}
                          angle={-45}
                          textAnchor="end"
                          height={60}
                          interval={0}
                        />
                        <YAxis
                          domain={[0, 100]}
                          stroke="rgba(255,255,255,0.5)"
                          tick={{ fill: 'rgba(255,255,255,0.7)', fontSize: 12 }}
                          width={40}
                        />
                        <ChartTooltip content={<ChartTooltipContent />} cursor={{ stroke: 'rgba(255,255,255,0.3)' }} />
                        {subjectsWithEvolucion.map((s) => (
                          <Line
                            key={s._id}
                            type="monotone"
                            dataKey={s._id}
                            name={s.nombre}
                            stroke={s.colorAcento || '#00c8ff'}
                            strokeWidth={2}
                            dot={{ fill: s.colorAcento || '#00c8ff', r: 4 }}
                            activeDot={{ r: 6 }}
                            connectNulls
                          />
                        ))}
                      </LineChart>
                    </ChartContainer>
                  </div>

                  {/* Llave de colores / materias */}
                  <div className="md:w-[220px] md:shrink-0">
                    <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-md p-3">
                      <p className="text-xs font-medium uppercase tracking-wider text-white/60 mb-2">Materias</p>
                      <div className="space-y-2">
                        {subjectsWithEvolucion.map((s) => (
                          <div key={s._id} className="flex items-center gap-2">
                            <span
                              className="h-2.5 w-2.5 rounded-sm shrink-0"
                              style={{ backgroundColor: s.colorAcento || '#00c8ff' }}
                              aria-hidden="true"
                            />
                            <span className="text-sm text-white/85 leading-tight truncate" title={s.nombre}>
                              {s.nombre}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="h-[280px] flex items-center justify-center text-white/50 text-sm">
                  No hay promedios por materia aún. Las notas aparecerán aquí cuando se registren calificaciones.
                </div>
              )}
            </CardContent>
          </Card>

          {/* Lista de Materias */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {subjects.map((subject) => (
              <Card
                key={subject._id}
                className="bg-white/5 border-white/10 backdrop-blur-md hover-elevate cursor-pointer group"
                onClick={() => setSelectedSubject(subject._id)}
              >
                <CardHeader className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div
                      className="w-16 h-16 rounded-2xl flex items-center justify-center"
                      style={{ backgroundColor: subject.colorAcento || '#00c8ff' }}
                    >
                      <BookOpen className="w-8 h-8 text-white" />
                    </div>
                    {getTendenciaIcon(subject.tendencia)}
                  </div>
                  <CardTitle className="text-white text-2xl font-bold mb-2">
                    {subject.nombre}
                  </CardTitle>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-3xl font-bold text-white">
                      {subject.promedio !== null ? Math.round(subject.promedio) : '—'}
                    </span>
                    {subject.promedio !== null && <span className="text-white/50">/ 100</span>}
                  </div>
                  <div className="flex items-center gap-2 mb-2">
                    <Badge className={getEstadoColor(subject.estado)}>
                      {subject.estado === 'sin_notas' ? '—' : subject.estado.charAt(0).toUpperCase() + subject.estado.slice(1)}
                    </Badge>
                  </div>
                  <p className="text-sm text-white/60">
                    Última nota: <span className="text-white font-semibold">{subject.ultimaNota !== null ? Math.round(subject.ultimaNota) : '—'}</span>
                  </p>
                </CardHeader>
                <CardContent className="p-6 pt-0">
                  <Button
                    variant="outline"
                    className="w-full border-[#3B82F6]/50 text-[#00c8ff] hover:bg-[#3B82F6]/10 hover:border-[#3B82F6]"
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
            ))}
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
              <div className="w-20 h-20 rounded-2xl flex items-center justify-center" style={{ backgroundColor: subjectCard?.colorAcento || '#00c8ff' }}>
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
        color: subjectDetail.colorAcento || '#00c8ff'
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
                style={{ backgroundColor: subjectDetail.colorAcento || '#00c8ff' }}
              >
                <BookOpen className="w-10 h-10 text-white" />
              </div>
            </div>
          </div>

          {/* Gráfica de Evolución */}
          <Card className="bg-white/5 border-white/10 backdrop-blur-md mb-8">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-[#00c8ff]" />
                Evolución del Promedio
              </CardTitle>
              <CardDescription className="text-white/60">
                Progreso mensual en {subjectDetail.nombre}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 md:p-6">
              <div className="w-full overflow-x-auto">
                <ChartContainer config={detailChartConfig} className="h-[280px] md:h-[320px] min-w-[300px]">
                  <LineChart 
                    data={subjectDetail.evolucion}
                    margin={{ top: 20, right: 20, bottom: 40, left: 20 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
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
                      cursor={{ stroke: '#00c8ff', strokeWidth: 1 }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="promedio" 
                      stroke="#00c8ff"
                      strokeWidth={3}
                      dot={{ fill: '#00c8ff', r: 6 }}
                    />
                  </LineChart>
                </ChartContainer>
              </div>
            </CardContent>
          </Card>

          {/* Notas por Categoría */}
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
                      {categoria.promedio != null && <span className="text-white/50">/ 100</span>}
                    </div>
                  </div>
                  <CardDescription className="text-white/60">
                    Promedio de {categoria.notas.length} {categoria.notas.length === 1 ? 'actividad' : 'actividades'}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {categoria.notas.map((nota, notaIdx) => (
                      <div
                        key={notaIdx}
                        className="p-4 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-colors"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <h4 className="font-semibold text-white mb-1">{nota.actividad}</h4>
                            <p className="text-sm text-white/60">{formatNotaFecha(nota.fecha)}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-2xl font-bold text-white">
                              {nota.nota != null ? Math.round(nota.nota) : '—'}
                            </span>
                            {nota.nota != null && <span className="text-white/50">/ 100</span>}
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

