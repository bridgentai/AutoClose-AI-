import { useMemo, useState } from 'react';
import { useAuth } from '@/lib/authContext';
import { useLocation } from 'wouter';
import { useQueries } from '@tanstack/react-query';
import { 
  ArrowLeft,
  BookOpen, 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  CheckCircle2,
  AlertCircle,
  XCircle,
  MessageSquare,
  BarChart3
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Legend } from 'recharts';
import { NavBackButton } from '@/components/nav-back-button';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

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
  promedio: number;
  notas: {
    actividad: string;
    nota: number;
    fecha: string;
    comentario?: string;
  }[];
}

interface SubjectDetail extends SubjectGrade {
  promedioFinal: number;
  categorias: GradeDetail[];
  evolucion: { mes: string; promedio: number }[];
  profesorNombre?: string | null;
}

// Interfaces para datos reales
interface NotaReal {
  _id: string;
  tareaId?: string;
  tareaTitulo?: string;
  nota: number;
  logro?: string;
  fecha: string;
  profesorNombre?: string;
  comentario?: string;
  gradingCategoryId?: string;
}

interface MateriaConNotas {
  _id: string;
  nombre: string;
  groupSubjectId?: string | null;
  colorAcento?: string;
  icono?: string;
  notas: NotaReal[];
  promedio: number;
  ultimaNota: number | null;
  estado: 'excelente' | 'bueno' | 'regular' | 'bajo' | 'aprobado' | 'reprobado';
  tendencia: 'up' | 'down' | 'stable';
  profesorNombre?: string | null;
}

interface LogroItem {
  _id: string;
  nombre: string;
  porcentaje: number;
  orden?: number;
}

const noteScoreFrom = (n: { nota?: number; score?: number; calificacion?: number }) =>
  Number((n as { nota?: number }).nota ?? (n as { score?: number }).score ?? (n as { calificacion?: number }).calificacion) || 0;

/** Colores distintos por materia (icono y línea en el gráfico). */
const SUBJECT_COLORS = ['#00c8ff', '#1e3cff', '#ffd700', '#10b981', '#f43f5e', '#8b5cf6', '#f97316', '#06b6d4', '#84cc16', '#ec4899'];

/** Evolución del promedio acumulado por fecha (para gráfico de progreso por materia). */
function computeEvolucion(
  materia: MateriaConNotas,
  logros: LogroItem[] | undefined
): { date: Date; dateStr: string; promedio: number }[] {
  const notas = materia.notas ?? [];
  const logrosList = logros ?? [];
  const totalPct = logrosList.reduce((s, l) => s + (l.porcentaje ?? 0), 0);
  const hasWeightedLogros = totalPct > 0 && logrosList.length > 0;
  const notasOrdenadas = [...notas].sort((a, b) =>
    new Date((a as NotaReal).fecha ?? 0).getTime() - new Date((b as NotaReal).fecha ?? 0).getTime()
  );
  return notasOrdenadas.map((n, i, arr) => {
    const hastaFecha = arr.slice(0, i + 1);
    let promedioAcum: number;
    if (hasWeightedLogros && logrosList.length > 0) {
      const logrosOrdenados = [...logrosList].sort((a, b) => (a.orden ?? 999) - (b.orden ?? 999));
      let weightedSum = 0;
      for (const logro of logrosOrdenados) {
        const notasEnCat = hastaFecha.filter((x) => String((x as NotaReal).gradingCategoryId ?? '') === String(logro._id));
        const promCat = notasEnCat.length > 0 ? notasEnCat.reduce((s, x) => s + noteScoreFrom(x), 0) / notasEnCat.length : 0;
        weightedSum += promCat * ((logro.porcentaje ?? 0) / 100);
      }
      promedioAcum = weightedSum;
    } else {
      promedioAcum = hastaFecha.reduce((s, x) => s + noteScoreFrom(x), 0) / hastaFecha.length;
    }
    const fecha = new Date((n as NotaReal).fecha ?? '');
    const valid = !Number.isNaN(fecha.getTime());
    return valid
      ? {
          date: fecha,
          dateStr: fecha.toLocaleDateString('es-CO', { month: 'short', day: 'numeric', year: '2-digit' }),
          promedio: Math.round(promedioAcum * 10) / 10,
        }
      : null;
  }).filter((p): p is { date: Date; dateStr: string; promedio: number } => p !== null);
}

/** Calcula promedio ponderado por logros y última nota (misma lógica que la vista detalle). */
function computeWeightedPromedioAndUltima(
  materia: MateriaConNotas,
  logros: LogroItem[] | undefined
): { promedioFinal: number; ultimaNota: number } {
  const notas = materia.notas ?? [];
  const ultimaNota = notas.length
    ? noteScoreFrom(notas.reduce((a, b) => (new Date((b as NotaReal).fecha ?? 0) > new Date((a as NotaReal).fecha ?? 0) ? b : a)))
    : 0;
  const totalPct = (logros ?? []).reduce((s, l) => s + (l.porcentaje ?? 0), 0);
  const hasWeightedLogros = totalPct > 0 && (logros ?? []).length > 0;

  if (hasWeightedLogros && logros!.length > 0) {
    const logrosOrdenados = [...logros!].sort((a, b) => (a.orden ?? 999) - (b.orden ?? 999));
    let weightedSum = 0;
    for (const logro of logrosOrdenados) {
      const notasEnCategoria = notas.filter((n) => String((n as NotaReal).gradingCategoryId ?? '') === String(logro._id));
      const promCat = notasEnCategoria.length > 0
        ? notasEnCategoria.reduce((s, x) => s + noteScoreFrom(x), 0) / notasEnCategoria.length
        : 0;
      weightedSum += promCat * ((logro.porcentaje ?? 0) / 100);
    }
    const promedioFinal = Math.round(weightedSum * 10) / 10;
    return { promedioFinal, ultimaNota };
  }
  const promedioFinal = notas.length > 0
    ? Math.round((notas.reduce((s, x) => s + noteScoreFrom(x), 0) / notas.length) * 10) / 10
    : Number(materia.promedio) || 0;
  return { promedioFinal, ultimaNota };
}

// =========================================================
// COMPONENTE PRINCIPAL
// =========================================================

export default function StudentNotesPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);

  const isPadre = user?.rol === 'padre';
  const isEstudiante = user?.rol === 'estudiante';
  const canAccessNotes = isEstudiante || isPadre;

  const { data: hijos = [] } = useQuery<{ _id: string; nombre: string }[]>({
    queryKey: ['/api/users/me/hijos'],
    queryFn: () => apiRequest('GET', '/api/users/me/hijos'),
    enabled: !!user?.id && isPadre,
  });
  const primerHijoId = hijos[0]?._id;
  const nombreHijo = hijos[0]?.nombre || 'tu hijo/a';

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

  // Si no hay usuario o el rol no puede ver notas, mostrar carga o mensaje (evita pantalla en blanco)
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
          <NavBackButton to="/dashboard" label="Dashboard" />
          <div className="mt-4">
            <h1 className="text-2xl font-bold text-white mb-2">Notas</h1>
            <p className="text-white/60">Solo estudiantes y padres pueden ver esta página.</p>
          </div>
        </div>
      </div>
    );
  }

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
  // Para estudiante no bloquear en courses: mostrar contenido en cuanto carguen las notas (evita pantalla azul infinita)
  const isLoading = isEstudiante ? isLoadingNotes : (isLoadingNotes || loadingCourses);

  const groupSubjectIds = useMemo(
    () => [...new Set((notesData?.materias ?? []).map((m) => m.groupSubjectId).filter(Boolean))] as string[],
    [notesData?.materias]
  );

  const logrosQueries = useQueries({
    queries: groupSubjectIds.map((gsId) => ({
      queryKey: ['/api/logros-calificacion', gsId] as const,
      queryFn: () => apiRequest('GET', `/api/logros-calificacion?courseId=${encodeURIComponent(gsId)}`) as Promise<{ logros: LogroItem[] }>,
      enabled: !!gsId,
    })),
  });

  const logrosByGsId = useMemo(() => {
    const map: Record<string, LogroItem[]> = {};
    groupSubjectIds.forEach((id, i) => {
      const logros = logrosQueries[i]?.data?.logros;
      if (logros?.length) map[id] = logros;
    });
    return map;
  }, [groupSubjectIds, logrosQueries]);

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
        const logros = m.groupSubjectId ? logrosByGsId[m.groupSubjectId] : undefined;
        const { promedioFinal, ultimaNota } = computeWeightedPromedioAndUltima(m, logros);
        const estado: SubjectGrade['estado'] = promedioFinal >= 65 ? 'bueno' : 'bajo';
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
  }, [allCourses, notesData?.materias, logrosByGsId]);

  const selectedSubjectData = selectedSubject
    ? notesData?.materias.find(m => m._id === selectedSubject)
    : null;

  const courseIdForLogros = selectedSubjectData?.groupSubjectId ?? '';

  const { data: logrosData } = useQuery<{ logros: LogroItem[]; totalPorcentaje?: number }>({
    queryKey: ['/api/logros-calificacion', courseIdForLogros],
    queryFn: () => apiRequest('GET', `/api/logros-calificacion?courseId=${encodeURIComponent(courseIdForLogros)}`),
    enabled: !!courseIdForLogros,
  });

  const subjectDetail: SubjectDetail | null = selectedSubjectData ? (() => {
    const logros = selectedSubjectData.groupSubjectId ? logrosByGsId[selectedSubjectData.groupSubjectId] : logrosData?.logros;
    const { promedioFinal: computedFinal, ultimaNota: computedUltima } = computeWeightedPromedioAndUltima(selectedSubjectData, logros ?? undefined);
    const promedio = Number(selectedSubjectData.promedio) || 0;
    const ultimaNota = computedUltima;
    const estado: SubjectGrade['estado'] = computedFinal >= 65 ? 'bueno' : 'bajo';
    const notas = selectedSubjectData.notas ?? [];
    const logrosList = logros ?? [];
    const totalPct = logrosList.reduce((s, l) => s + (l.porcentaje ?? 0), 0);
    const hasWeightedLogros = totalPct > 0;

    const categorias: GradeDetail[] = [];
    const promedioFinal = computedFinal;

    if (hasWeightedLogros && logrosList.length > 0) {
      const logrosOrdenados = [...logrosList].sort((a, b) => (a.orden ?? 999) - (b.orden ?? 999));
      for (const logro of logrosOrdenados) {
        const notasEnCategoria = notas.filter((n) => String((n as NotaReal).gradingCategoryId ?? '') === String(logro._id));
        const promCat = notasEnCategoria.length > 0
          ? notasEnCategoria.reduce((s, x) => s + noteScoreFrom(x), 0) / notasEnCategoria.length
          : 0;
        const pct = logro.porcentaje ?? 0;
        categorias.push({
          categoria: `${logro.nombre} (${pct}%)`,
          promedio: Math.round(promCat * 10) / 10,
          notas: notasEnCategoria.map((n) => ({
            actividad: (n as NotaReal).tareaTitulo ?? 'Sin título',
            nota: noteScoreFrom(n),
            fecha: (n as NotaReal).fecha ?? '',
            comentario: (n as NotaReal).comentario ?? (n as NotaReal).logro,
          })),
        });
      }
      const sinCategoria = notas.filter((n) => !(n as NotaReal).gradingCategoryId);
      if (sinCategoria.length > 0) {
        const promSin = sinCategoria.reduce((s, x) => s + noteScoreFrom(x), 0) / sinCategoria.length;
        categorias.push({
          categoria: 'Sin categoría',
          promedio: Math.round(promSin * 10) / 10,
          notas: sinCategoria.map((n) => ({
            actividad: (n as NotaReal).tareaTitulo ?? 'Sin título',
            nota: noteScoreFrom(n),
            fecha: (n as NotaReal).fecha ?? '',
            comentario: (n as NotaReal).comentario ?? (n as NotaReal).logro,
          })),
        });
      }
    } else {
      categorias.push({
        categoria: 'Notas',
        promedio: promedioFinal,
        notas: notas.map((n) => ({
          actividad: (n as NotaReal).tareaTitulo ?? 'Sin título',
          nota: noteScoreFrom(n),
          fecha: (n as NotaReal).fecha ?? '',
          comentario: (n as NotaReal).comentario ?? (n as NotaReal).logro,
        })),
      });
    }

    const notasOrdenadas = [...notas].sort((a, b) =>
      new Date((a as NotaReal).fecha ?? 0).getTime() - new Date((b as NotaReal).fecha ?? 0).getTime()
    );
    // Evolución con promedio ponderado hasta cada fecha (coherente con el número de arriba)
    const evolucion = notasOrdenadas.map((n, i, arr) => {
      const hastaFecha = arr.slice(0, i + 1);
      let promedioAcum: number;
      if (hasWeightedLogros && logrosList.length > 0) {
        const logrosOrdenados = [...logrosList].sort((a, b) => (a.orden ?? 999) - (b.orden ?? 999));
        let weightedSum = 0;
        for (const logro of logrosOrdenados) {
          const notasEnCat = hastaFecha.filter((x) => String((x as NotaReal).gradingCategoryId ?? '') === String(logro._id));
          const promCat = notasEnCat.length > 0 ? notasEnCat.reduce((s, x) => s + noteScoreFrom(x), 0) / notasEnCat.length : 0;
          weightedSum += promCat * ((logro.porcentaje ?? 0) / 100);
        }
        promedioAcum = weightedSum;
      } else {
        promedioAcum = hastaFecha.reduce((s, x) => s + noteScoreFrom(x), 0) / hastaFecha.length;
      }
      return {
        mes: new Date((n as NotaReal).fecha ?? '').toLocaleDateString('es-CO', { month: 'short', day: 'numeric', year: '2-digit' }),
        promedio: Math.round(promedioAcum * 10) / 10,
        nota: noteScoreFrom(n),
      };
    });

    return {
      _id: selectedSubjectData._id,
      nombre: selectedSubjectData.nombre,
      promedio: computedFinal,
      ultimaNota: Number.isNaN(ultimaNota) ? 0 : ultimaNota,
      estado,
      tendencia: selectedSubjectData.tendencia ?? 'stable',
      colorAcento: selectedSubjectData.colorAcento || '#00c8ff',
      promedioFinal,
      profesorNombre: selectedSubjectData.profesorNombre ?? (notas[0] as NotaReal)?.profesorNombre ?? null,
      categorias,
      evolucion,
    };
  })() : null;

  // Promedio general solo sobre materias con notas
  const subjectsWithGrades = subjects.filter((s) => s.promedio !== null);
  const promedioGeneral = subjectsWithGrades.length > 0
    ? subjectsWithGrades.reduce((acc, s) => acc + (s.promedio ?? 0), 0) / subjectsWithGrades.length
    : 0;

  if (isPadre && !primerHijoId && !isLoading) {
    return (
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-10">
        <div className="max-w-7xl mx-auto w-full">
          <NavBackButton to="/dashboard" label="Dashboard" />
          <div className="mt-4">
            <h1 className="text-2xl font-bold text-white mb-2">Notas</h1>
            <p className="text-white/60">Vincula un estudiante en tu perfil para ver sus notas.</p>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-10">
        <div className="max-w-7xl mx-auto w-full">
          <NavBackButton to={isPadre ? '/dashboard' : undefined} label={isPadre ? 'Dashboard' : undefined} />
          <div className="mt-4 text-white/80">Cargando notas...</div>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-10">
        <div className="max-w-7xl mx-auto w-full">
          <NavBackButton to={isPadre ? '/dashboard' : undefined} label={isPadre ? 'Dashboard' : undefined} />
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

  // Función para obtener el color del estado
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

  // Función para obtener el icono de tendencia
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

  // Evolución por materia y datos para gráfico de varias líneas (una por materia con notas)
  const { chartData, chartConfig, subjectsWithEvolucion } = useMemo(() => {
    const withGrades = subjects.filter((s) => s.promedio !== null);
    const materiasConNotas = notesData?.materias ?? [];
    const byId = new Map(materiasConNotas.map((m) => [m._id, m]));

    const evolucionPorMateria: Record<string, { date: Date; dateStr: string; promedio: number }[]> = {};
    const allPoints: { date: Date; dateStr: string }[] = [];
    for (const s of withGrades) {
      const m = byId.get(s._id);
      if (!m) continue;
      const logros = s.groupSubjectId ? logrosByGsId[s.groupSubjectId] : undefined;
      const ev = computeEvolucion(m, logros);
      evolucionPorMateria[s._id] = ev;
      for (const p of ev) allPoints.push({ date: p.date, dateStr: p.dateStr });
    }
    // Ordenar fechas y quedarnos con una fila por fecha (única por dateStr para mostrar)
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
  }, [subjects, notesData?.materias, logrosByGsId]);

  // Vista principal (lista de materias)
  if (!selectedSubject) {
    if (allCourses.length === 0 && !isLoading) {
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
              <NavBackButton to={isPadre ? '/dashboard' : undefined} label={isPadre ? 'Dashboard' : undefined} />
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
            <NavBackButton to={isPadre ? '/dashboard' : undefined} label={isPadre ? 'Dashboard' : undefined} />
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
                  <span>Promedio general: <span className="text-white font-semibold">{subjectsWithGrades.length > 0 ? Math.round(promedioGeneral * 10) / 10 : 'N/A'}</span></span>
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
                <div className="w-full overflow-x-auto">
                  <ChartContainer config={chartConfig} className="h-[280px] md:h-[320px] min-w-[300px]">
                    <LineChart
                      data={chartData}
                      margin={{ top: 20, right: 20, bottom: 40, left: 20 }}
                    >
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
                      <ChartTooltip
                        content={<ChartTooltipContent />}
                        cursor={{ stroke: 'rgba(255,255,255,0.3)' }}
                      />
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
                      <Legend wrapperStyle={{ paddingTop: 12 }} />
                    </LineChart>
                  </ChartContainer>
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
                      {subject.promedio !== null ? Math.round(subject.promedio) : 'N/A'}
                    </span>
                    {subject.promedio !== null && <span className="text-white/50">/ 100</span>}
                  </div>
                  <div className="flex items-center gap-2 mb-2">
                    <Badge className={getEstadoColor(subject.estado)}>
                      {subject.estado === 'sin_notas' ? 'N/A' : subject.estado.charAt(0).toUpperCase() + subject.estado.slice(1)}
                    </Badge>
                  </div>
                  <p className="text-sm text-white/60">
                    Última nota: <span className="text-white font-semibold">{subject.ultimaNota !== null ? Math.round(subject.ultimaNota) : 'N/A'}</span>
                  </p>
                </CardHeader>
                <CardContent className="p-6 pt-0">
                  <Button
                    variant="outline"
                    className="w-full border-[#3B82F6]/50 text-[#00c8ff] hover:bg-[#3B82F6]/10 hover:border-[#3B82F6]"
                    onClick={(e) => {
                      e.stopPropagation();
                      const courseId = subject.groupSubjectId ?? subject._id;
                      setLocation(`/course/${courseId}/analytics`);
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
            <Button variant="ghost" className="text-[#3B82F6] hover:text-[#2563EB] hover:bg-white/5 -ml-2" onClick={() => setSelectedSubject(null)}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Volver a Notas
            </Button>
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div className="min-w-0 flex-1">
                <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-1 font-['Poppins'] break-words">
                  {subjectCard?.nombre ?? 'Materia'}
                </h1>
                <Badge className={getEstadoColor('sin_notas')}>N/A</Badge>
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
                onClick={() => setLocation(`/course/${selectedSubject}/analytics`)}
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
          {/* Header con botón volver */}
          <div className="mb-8">
            <Button variant="ghost" className="text-[#3B82F6] hover:text-[#2563EB] hover:bg-white/5 -ml-2" onClick={() => setSelectedSubject(null)}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Volver a Notas
            </Button>
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
                      {Math.round(subjectDetail.promedioFinal)}
                    </span>
                    <span className="text-white/50">/ 100</span>
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
                        {Math.round(categoria.promedio)}
                      </span>
                      <span className="text-white/50">/ 100</span>
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
                            <p className="text-sm text-white/60">
                              {new Date(nota.fecha).toLocaleDateString('es-CO', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric'
                              })}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-2xl font-bold text-white">
                              {Math.round(nota.nota)}
                            </span>
                            <span className="text-white/50">/ 100</span>
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
        <NavBackButton to={isPadre ? '/dashboard' : undefined} label={isPadre ? 'Dashboard' : undefined} />
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

