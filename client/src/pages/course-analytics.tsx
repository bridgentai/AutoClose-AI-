import { useState, useMemo, useEffect } from 'react';
import { useRoute, useLocation } from 'wouter';
import { useAuth } from '@/lib/authContext';
import { useQuery, useQueries } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useCourseGrading, useAnalyticsSummary, useCourseIntelligence, type PerformanceSnapshotResponse } from '@/hooks/useCourseGrading';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Lightbulb, Loader2 } from 'lucide-react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  Cell,
  LabelList,
} from 'recharts';

interface CourseSubject {
  _id: string;
  nombre: string;
}

interface Student {
  _id: string;
  nombre: string;
}

interface GroupHolisticAnalyticsResponse {
  grupoId: string;
  promedioCurso: number | null;
  materiasTotal: number;
  estudiantes: Array<{
    studentId: string;
    nombre: string;
    promedioHolistico: number | null;
    materiasConNotas: number;
    materiasTotal: number;
    materiaMasDebil: string | null;
    porMateria: Array<{ nombre: string; promedio: number }>;
  }>;
}

// Nota: Padre y Estudiante tienen vistas analíticas dedicadas (/parent/analytics y /student/course/.../analytics)
const allowedRoles = ['profesor', 'directivo', 'admin-general-colegio', 'school_admin', 'super_admin'];

/** Valor del Select para el alcance agregado del directivo (todas las materias del curso). */
const DIRECTIVO_TODAS_MATERIAS_VALUE = '__all__';

// Paleta evoOS (azules + acento) para analíticas
const BAR_COLORS = ['#3B82F6', '#00C8FF', '#1D4ED8', '#38BDF8', '#60A5FA', '#FFD700'];

function analyticsGradeText(n: number | null | undefined): string {
  if (n == null) return 'text-white/40';
  if (n < 65) return 'text-red-400';
  if (n < 75) return 'text-yellow-400';
  return 'text-emerald-400';
}

function studentInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0] ?? '')
    .join('')
    .substring(0, 2)
    .toUpperCase();
}

export default function CourseAnalyticsPage() {
  const [, params] = useRoute('/course/:cursoId/analytics');
  const cursoId = params?.cursoId ?? '';
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  /** Materia (group_subject) elegida por el profesor cuando hay varias; se sincroniza con ?gs= como en /course/:id/grades */
  const [materiaSeleccionada, setMateriaSeleccionada] = useState<string | null>(null);
  /** Directivo: 'all' = KPI holístico del curso; id = group_subject (misma analítica que el profesor en esa materia). */
  const [directivoMateriaFiltro, setDirectivoMateriaFiltro] = useState<'all' | string>('all');
  const [viewMode, setViewMode] = useState<'general' | 'individual'>('general');

  const gsFromQuery =
    typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search).get('gs')?.trim() || ''
      : '';

  /** UUID en minúsculas para coincidir con PostgreSQL; nombres de curso en mayúsculas (9C); legacy 24-hex sin tocar. */
  const groupApiId = useMemo(() => {
    const raw = (cursoId || '').trim();
    if (!raw) return '';
    if (raw.length === 24 && /^[0-9a-fA-F]{24}$/.test(raw)) return raw;
    if (raw.length === 36 && raw.includes('-')) return raw.toLowerCase();
    return raw.toUpperCase();
  }, [cursoId]);

  const { data: groupInfo } = useQuery<{ _id: string; id: string; nombre: string }>({
    queryKey: ['group', cursoId],
    queryFn: () => apiRequest('GET', `/api/groups/${encodeURIComponent(cursoId)}`),
    enabled: !!cursoId,
    staleTime: 5 * 60 * 1000,
  });
  const groupDisplayName = (groupInfo?.nombre?.trim() || groupApiId || cursoId) as string;

  const { data: subjectsForGroup = [] } = useQuery<CourseSubject[]>({
    queryKey: ['subjectsForGroup', cursoId],
    queryFn: () => apiRequest('GET', `/api/courses/for-group/${cursoId}`),
    enabled: !!cursoId && !!user?.id && user?.rol !== 'estudiante',
  });

  const { data: courseDetails } = useQuery<CourseSubject>({
    queryKey: ['courseDetails', cursoId],
    queryFn: () => apiRequest('GET', `/api/courses/${cursoId}/details`),
    enabled: !!cursoId && !!user?.id && user?.rol === 'estudiante',
    staleTime: 5 * 60 * 1000,
  });

  const { data: students = [] } = useQuery<Student[]>({
    queryKey: ['students', cursoId, groupApiId],
    queryFn: async () => {
      try {
        const res = await apiRequest('GET', `/api/groups/${encodeURIComponent(groupApiId)}/students`);
        return Array.isArray(res) ? res : [];
      } catch {
        return [];
      }
    },
    enabled: !!groupApiId && !!user?.id && user?.rol !== 'estudiante',
  });

  const isStudent = user?.rol === 'estudiante';
  const isDirectivo = user?.rol === 'directivo';

  useEffect(() => {
    if (!isDirectivo) return;
    setDirectivoMateriaFiltro('all');
  }, [cursoId, isDirectivo]);

  useEffect(() => {
    if (!isDirectivo || directivoMateriaFiltro === 'all' || subjectsForGroup.length === 0) return;
    if (!subjectsForGroup.some((s) => s._id === directivoMateriaFiltro)) {
      setDirectivoMateriaFiltro('all');
    }
  }, [isDirectivo, directivoMateriaFiltro, subjectsForGroup]);

  const directivoSoloMateriaId = useMemo(() => {
    if (!isDirectivo || directivoMateriaFiltro === 'all') return null;
    return subjectsForGroup.some((s) => s._id === directivoMateriaFiltro) ? directivoMateriaFiltro : null;
  }, [isDirectivo, directivoMateriaFiltro, subjectsForGroup]);

  const {
    data: holisticGroup,
    isLoading: holisticLoading,
    isError: holisticError,
    error: holisticQueryError,
  } = useQuery<GroupHolisticAnalyticsResponse>({
    queryKey: ['reports/group/holistic-resumen', groupApiId, user?.colegioId],
    queryFn: () =>
      apiRequest<GroupHolisticAnalyticsResponse>(
        'GET',
        `/api/reports/group/${encodeURIComponent(groupApiId)}/holistic-resumen`
      ),
    enabled: isDirectivo && directivoMateriaFiltro === 'all' && !!groupApiId && !!user?.colegioId,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (isStudent || isDirectivo) return;
    setMateriaSeleccionada(null);
  }, [cursoId, gsFromQuery, isStudent, isDirectivo]);

  const firstSubjectId = useMemo(() => {
    if (isStudent) return cursoId;
    if (!subjectsForGroup.length) return '';
    if (isDirectivo) {
      return directivoSoloMateriaId ?? '';
    }
    if (materiaSeleccionada && subjectsForGroup.some((s) => s._id === materiaSeleccionada)) {
      return materiaSeleccionada;
    }
    if (gsFromQuery && subjectsForGroup.some((s) => s._id === gsFromQuery)) {
      return gsFromQuery;
    }
    return subjectsForGroup[0]._id;
  }, [isStudent, isDirectivo, cursoId, subjectsForGroup, gsFromQuery, materiaSeleccionada, directivoSoloMateriaId]);

  const subjectName = isStudent
    ? (courseDetails?.nombre ?? '')
    : (subjectsForGroup.find((s) => s._id === firstSubjectId)?.nombre ?? subjectsForGroup[0]?.nombre ?? '');

  /** Alcance analítico: directivo elige todas las materias (holístico) o una materia (snapshots / categorías). */
  const analyticsScopeLabel = isDirectivo
    ? directivoSoloMateriaId
      ? (subjectsForGroup.find((s) => s._id === directivoSoloMateriaId)?.nombre ?? 'Materia')
      : 'Todas las materias'
    : subjectName;
  const effectiveStudentId = isStudent ? (user?.id ?? '') : (selectedStudentId || (students[0]?._id ?? ''));

  /** Directivo en “todas las materias”: sin grading por materia; en una materia concreta: igual que profesor. */
  const gradingCourseId = isDirectivo ? (directivoSoloMateriaId ?? undefined) : firstSubjectId;

  const {
    categories,
    snapshot,
    risk,
    isLoading: gradingLoading,
  } = useCourseGrading(gradingCourseId, effectiveStudentId || undefined);

  const { data: analyticsSummary, isLoading: analyticsSummaryLoading } = useAnalyticsSummary(
    gradingCourseId,
    effectiveStudentId || undefined
  );
  const aiSummary = analyticsSummary?.aiSummary ?? '';

  const { data: intelligence } = useCourseIntelligence(
    gradingCourseId,
    effectiveStudentId || undefined
  );

  const groupComparison = intelligence?.groupComparison;
  const commitment = intelligence?.commitment;

  const generalSnapshotCourseId = isDirectivo ? (directivoSoloMateriaId ?? '') : firstSubjectId;

  const studentSnapshotQueries = useQueries({
    queries:
      !!generalSnapshotCourseId && viewMode === 'general' && students.length > 0 && !isStudent
        ? students.map((s) => ({
            queryKey: ['snapshots', generalSnapshotCourseId, s._id],
            queryFn: () =>
              apiRequest<PerformanceSnapshotResponse[]>(
                'GET',
                `/api/courses/${generalSnapshotCourseId}/snapshots?studentId=${encodeURIComponent(s._id)}`
              ),
            staleTime: 2 * 60 * 1000,
          }))
        : [],
  });

  const studentsWithData = useMemo(() => {
    if (isDirectivo) {
      if (!directivoSoloMateriaId && holisticGroup && Array.isArray(holisticGroup.estudiantes)) {
        const byId = new Map(
          holisticGroup.estudiantes.map((e) => [e.studentId.replace(/-/g, '').toLowerCase(), e])
        );
        const materiasTotal = holisticGroup.materiasTotal;
        return students.map((s) => {
          const h = byId.get(s._id.replace(/-/g, '').toLowerCase());
          if (!h) {
            return {
              student: s,
              avg: null as number | null,
              lowestCategoryName: null as string | null,
              coberturaMateriasPct: materiasTotal > 0 ? 0 : null,
            };
          }
          const pct =
            materiasTotal > 0 ? Math.round((h.materiasConNotas / materiasTotal) * 100) : null;
          return {
            student: s,
            avg: h.promedioHolistico,
            lowestCategoryName: h.materiaMasDebil,
            coberturaMateriasPct: pct,
          };
        });
      }
      if (directivoSoloMateriaId) {
        return students.map((s, i) => {
          const latest = studentSnapshotQueries[i]?.data?.[0] ?? null;
          const avg = latest?.weightedFinalAverage ?? null;
          const categoryImpacts = latest?.categoryImpacts ?? {};
          const categoryNames = latest?.categoryNames;
          const lowestEntry =
            Object.keys(categoryImpacts).length > 0
              ? (Object.entries(categoryImpacts) as [string, number][]).reduce((a, b) =>
                  a[1] < b[1] ? a : b
                )
              : null;
          const lowestCategoryName =
            lowestEntry && categoryNames?.[lowestEntry[0]] ? categoryNames[lowestEntry[0]] : null;
          return { student: s, avg, lowestCategoryName, coberturaMateriasPct: null as number | null };
        });
      }
      return students.map((s) => ({
        student: s,
        avg: null as number | null,
        lowestCategoryName: null as string | null,
        coberturaMateriasPct: null as number | null,
      }));
    }
    return students.map((s, i) => {
      const latest = studentSnapshotQueries[i]?.data?.[0] ?? null;
      const avg = latest?.weightedFinalAverage ?? null;
      const categoryImpacts = latest?.categoryImpacts ?? {};
      const categoryNames = latest?.categoryNames;
      const lowestEntry =
        Object.keys(categoryImpacts).length > 0
          ? (Object.entries(categoryImpacts) as [string, number][]).reduce((a, b) => (a[1] < b[1] ? a : b))
          : null;
      const lowestCategoryName =
        lowestEntry && categoryNames?.[lowestEntry[0]] ? categoryNames[lowestEntry[0]] : null;
      return { student: s, avg, lowestCategoryName, coberturaMateriasPct: null as number | null };
    });
  }, [isDirectivo, directivoSoloMateriaId, holisticGroup, students, studentSnapshotQueries]);

  function riskLabelFromAvg(avg: number | null): string {
    if (avg == null) return '—';
    if (avg < 65) return 'Alto';
    if (avg < 75) return 'Medio';
    return 'Bajo';
  }

  const selectedHolistic = useMemo(() => {
    if (!isDirectivo || directivoSoloMateriaId || !holisticGroup?.estudiantes || !effectiveStudentId)
      return null;
    const key = effectiveStudentId.replace(/-/g, '').toLowerCase();
    return (
      holisticGroup.estudiantes.find(
        (e) => e.studentId.replace(/-/g, '').toLowerCase() === key
      ) ?? null
    );
  }, [isDirectivo, directivoSoloMateriaId, holisticGroup, effectiveStudentId]);

  const directivoStudentRank = useMemo(() => {
    if (!isDirectivo || directivoSoloMateriaId || !holisticGroup?.estudiantes?.length || !effectiveStudentId)
      return null;
    const key = effectiveStudentId.replace(/-/g, '').toLowerCase();
    const ranked = [...holisticGroup.estudiantes]
      .filter((e) => e.promedioHolistico != null)
      .sort((a, b) => (b.promedioHolistico ?? 0) - (a.promedioHolistico ?? 0));
    const idx = ranked.findIndex(
      (e) => e.studentId.replace(/-/g, '').toLowerCase() === key
    );
    if (idx < 0) return null;
    return { rank: idx + 1, total: ranked.length };
  }, [isDirectivo, directivoSoloMateriaId, holisticGroup, effectiveStudentId]);

  const validAvgs = studentsWithData.map((x) => x.avg).filter((x): x is number => x != null);
  const courseAvgGeneral = isDirectivo
    ? directivoSoloMateriaId
      ? validAvgs.length > 0
        ? Math.round((validAvgs.reduce((a, b) => a + b, 0) / validAvgs.length) * 10) / 10
        : null
      : (holisticGroup?.promedioCurso ?? null)
    : validAvgs.length > 0
      ? Math.round((validAvgs.reduce((a, b) => a + b, 0) / validAvgs.length) * 10) / 10
      : null;
  const kpiEnRiesgo = studentsWithData.filter((x) => x.avg != null && x.avg < 65).length;
  const kpiEnAlerta = studentsWithData.filter((x) => x.avg != null && x.avg >= 65 && x.avg < 75).length;
  const kpiAlDia = studentsWithData.filter((x) => x.avg != null && x.avg >= 75).length;

  const sortedStudentsForGeneral = [
    ...studentsWithData.filter((x) => x.avg != null && x.avg < 65),
    ...studentsWithData.filter((x) => x.avg != null && x.avg >= 65 && x.avg < 75),
    ...studentsWithData.filter((x) => x.avg != null && x.avg >= 75),
    ...studentsWithData.filter((x) => x.avg == null),
  ];

  const selectedStudent = students.find((s) => s._id === effectiveStudentId);

  const categoryImpactBreakdown = useMemo(() => {
    if (snapshot?.categoryImpacts && (snapshot.categoryNames || categories.length)) {
      if (snapshot.categoryNames && Object.keys(snapshot.categoryImpacts).length > 0) {
        return Object.entries(snapshot.categoryImpacts).map(([id, impact]) => ({
          name: snapshot.categoryNames![id] ?? id,
          categoria: snapshot.categoryNames![id] ?? id,
          impact: Number(impact),
          weight: snapshot.categoryWeights?.[id] ?? 0,
        }));
      }
      return categories.map((cat) => ({
        name: cat.nombre,
        categoria: cat.nombre,
        impact: snapshot!.categoryImpacts[cat._id] ?? 0,
        weight: cat.weight,
      }));
    }
    if (analyticsSummary?.byCategory?.length) {
      return analyticsSummary.byCategory.map((c) => ({
        name: c.categoryName,
        categoria: c.categoryName,
        impact: (c.average * (c.percentage / 100)) || 0,
        weight: c.percentage,
      }));
    }
    return [];
  }, [snapshot, categories, analyticsSummary]);

  const chartCategoryData = useMemo(() => {
    if (
      isDirectivo &&
      viewMode === 'individual' &&
      !directivoSoloMateriaId &&
      selectedHolistic?.porMateria?.length
    ) {
      const n = Math.max(1, holisticGroup?.materiasTotal ?? selectedHolistic.porMateria.length);
      const w = Math.round(100 / n);
      return selectedHolistic.porMateria.map((p) => ({
        name: p.nombre,
        categoria: p.nombre,
        impact: p.promedio,
        weight: w,
      }));
    }
    return categoryImpactBreakdown;
  }, [
    isDirectivo,
    directivoSoloMateriaId,
    viewMode,
    selectedHolistic,
    holisticGroup?.materiasTotal,
    categoryImpactBreakdown,
  ]);

  const impactChartHeight = useMemo(() => {
    const rows = chartCategoryData.length;
    return Math.min(520, Math.max(260, rows * 42));
  }, [chartCategoryData.length]);

  const truncateLabel = (value: unknown, max = 22) => {
    const s = String(value ?? '');
    if (s.length <= max) return s;
    return `${s.slice(0, Math.max(0, max - 1))}…`;
  };

  const weightedAverage = analyticsSummary?.weightedAverage ?? snapshot?.weightedFinalAverage ?? null;
  const displayWeightedAverage =
    isDirectivo &&
    viewMode === 'individual' &&
    !directivoSoloMateriaId &&
    selectedHolistic?.promedioHolistico != null
      ? selectedHolistic.promedioHolistico
      : weightedAverage;
  const canAccess = user?.rol && allowedRoles.includes(user.rol);

  if (user && !canAccess) {
    return (
      <div className="w-full text-[#E2E8F0]">
        <div className="max-w-5xl mx-auto">
          <Button
            variant="ghost"
            className="text-white/70 hover:text-white mb-6"
            onClick={() =>
              setLocation(isDirectivo ? '/directivo/academia/analitica-notas' : `/course-detail/${cursoId}`)
            }
          >
            <ArrowLeft className="w-4 h-4 mr-2 inline" />
            {isDirectivo ? 'Volver a sección' : 'Volver al curso'}
          </Button>
          <Card className="bg-white/5 border-white/10 rounded-2xl p-6">
            <CardContent>
              <p className="text-[#E2E8F0]/90 mb-4">
                Esta vista analítica es para profesor/directivo. Para estudiante y padre existe una vista dedicada.
              </p>
              <Button
                variant="outline"
                className="rounded-xl border-white/30 bg-white/5 text-white hover:bg-white/10"
                onClick={() => setLocation('/dashboard')}
              >
                Ir al inicio
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full text-[#E2E8F0]">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <Button
            variant="ghost"
            className="text-white/70 hover:text-white p-0 h-auto font-normal"
            onClick={() => {
              if (isStudent) setLocation('/mi-aprendizaje/cursos');
              else if (isDirectivo) setLocation('/directivo/academia/analitica-notas');
              else setLocation(`/course-detail/${cursoId}`);
            }}
          >
            <ArrowLeft className="w-4 h-4 mr-2 inline" />
            {isStudent ? 'Volver a mis cursos' : isDirectivo ? 'Volver a sección' : 'Volver al curso'}
          </Button>
        </div>

        <header className="mb-6 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white font-['Poppins'] mb-1">
              {isStudent ? 'Mi desempeño • Vista analítica' : 'Vista analítica • Inteligencia académica'}
            </h1>
            <p className="text-white/60 text-sm">
              {isStudent
                ? (subjectName ? subjectName : 'Materia')
                : `Grupo ${groupDisplayName}${analyticsScopeLabel ? ` • ${analyticsScopeLabel}` : ''}`}
            </p>
          </div>
          {!isStudent && (
            <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3 sm:gap-4">
              <div className="flex items-center gap-1 bg-white/[0.04] border border-white/[0.08] rounded-xl p-1">
                <button
                  onClick={() => setViewMode('general')}
                  className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${viewMode === 'general' ? 'bg-white/[0.08] border border-white/20 text-white' : 'text-white/50 border border-transparent'}`}
                >
                  Vista general
                </button>
                <button
                  onClick={() => setViewMode('individual')}
                  className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${viewMode === 'individual' ? 'bg-white/[0.08] border border-white/20 text-white' : 'text-white/50 border border-transparent'}`}
                >
                  Por estudiante
                </button>
              </div>
              {isDirectivo && subjectsForGroup.length > 0 ? (
                <div className="flex items-center gap-2">
                  <span className="text-white/60 text-sm whitespace-nowrap">Materia</span>
                  <Select
                    value={
                      directivoMateriaFiltro === 'all'
                        ? DIRECTIVO_TODAS_MATERIAS_VALUE
                        : (directivoSoloMateriaId ?? DIRECTIVO_TODAS_MATERIAS_VALUE)
                    }
                    onValueChange={(v) => {
                      if (v === DIRECTIVO_TODAS_MATERIAS_VALUE) setDirectivoMateriaFiltro('all');
                      else setDirectivoMateriaFiltro(v);
                    }}
                  >
                    <SelectTrigger className="w-[min(100vw-4rem,18rem)] sm:w-64 bg-white/5 border-white/20 text-white rounded-lg">
                      <SelectValue placeholder="Alcance" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={DIRECTIVO_TODAS_MATERIAS_VALUE}>Todas las materias</SelectItem>
                      {subjectsForGroup.map((s) => (
                        <SelectItem key={s._id} value={s._id}>
                          {s.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : !isDirectivo && subjectsForGroup.length > 1 && firstSubjectId ? (
                <div className="flex items-center gap-2">
                  <span className="text-white/60 text-sm whitespace-nowrap">Materia</span>
                  <Select value={firstSubjectId} onValueChange={(id) => setMateriaSeleccionada(id)}>
                    <SelectTrigger className="w-[min(100vw-4rem,16rem)] sm:w-56 bg-white/5 border-white/20 text-white rounded-lg">
                      <SelectValue placeholder="Materia" />
                    </SelectTrigger>
                    <SelectContent>
                      {subjectsForGroup.map((s) => (
                        <SelectItem key={s._id} value={s._id}>
                          {s.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}
              {viewMode === 'individual' && (
                <div className="flex items-center gap-2">
                  <span className="text-white/60 text-sm whitespace-nowrap">Estudiante</span>
                  <Select
                    value={effectiveStudentId || undefined}
                    onValueChange={setSelectedStudentId}
                  >
                    <SelectTrigger className="w-[min(100vw-4rem,16rem)] sm:w-56 bg-white/5 border-white/20 text-white rounded-lg">
                      <SelectValue placeholder={students.length ? 'Seleccionar' : 'Sin estudiantes'} />
                    </SelectTrigger>
                    <SelectContent>
                      {students.map((s) => (
                        <SelectItem key={s._id} value={s._id}>
                          {s.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          )}
        </header>

        {!firstSubjectId && !isDirectivo ? (
          <div className="panel-grades rounded-2xl p-6">
            <p className="text-white/80">
              {isStudent
                ? 'No se pudo cargar la materia. Verifica que estés inscrito en esta materia.'
                : 'No hay materias para este grupo.'}
            </p>
          </div>
        ) : isDirectivo && directivoMateriaFiltro === 'all' && holisticLoading ? (
          viewMode === 'general' ? (
            <div className="space-y-6">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-28 bg-white/10 rounded-2xl" />
                ))}
              </div>
              <Skeleton className="h-[420px] bg-white/10 rounded-2xl" />
            </div>
          ) : (
            <Skeleton className="h-[560px] bg-white/10 rounded-2xl" />
          )
        ) : isDirectivo && directivoMateriaFiltro === 'all' && holisticError && !holisticLoading ? (
          <div className="panel-grades rounded-2xl p-6">
            <p className="text-white font-medium font-['Poppins']">No se pudo cargar la analítica del curso</p>
            <p className="text-white/55 text-sm mt-2 leading-relaxed">
              {(holisticQueryError as Error)?.message ||
                'Verifica tu sesión o que este curso pertenezca a tu sección.'}
            </p>
          </div>
        ) : !isStudent && viewMode === 'general' ? (
          /* ═══════════════════════════════════════════════════════
             VISTA GENERAL
          ═══════════════════════════════════════════════════════ */
          <div className="space-y-6">
            {isDirectivo && directivoSoloMateriaId &&
            studentSnapshotQueries.length > 0 &&
            studentSnapshotQueries.some((q) => q.isFetching) ? (
              <p className="text-white/45 text-sm">Cargando notas por estudiante en esta materia…</p>
            ) : null}
            {/* KPI Row */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="panel-grades rounded-2xl p-4">
                <p className="text-xs uppercase tracking-wider text-white/50 mb-1">Promedio curso</p>
                <p className="text-3xl font-bold text-[#E2E8F0] tabular-nums leading-none">
                  {courseAvgGeneral != null ? courseAvgGeneral.toFixed(1) : '—'}
                </p>
                <p className="text-xs text-white/50 mt-2">{students.length} estudiantes</p>
              </div>
              <div className="panel-grades rounded-2xl p-4">
                <p className="text-xs uppercase tracking-wider text-white/50 mb-1">En riesgo</p>
                <p className="text-3xl font-bold text-red-400 tabular-nums leading-none">{kpiEnRiesgo}</p>
                <p className="text-xs text-white/50 mt-2">Promedio {'<'} 65</p>
              </div>
              <div className="panel-grades rounded-2xl p-4">
                <p className="text-xs uppercase tracking-wider text-white/50 mb-1">En alerta</p>
                <p className="text-3xl font-bold text-yellow-400 tabular-nums leading-none">{kpiEnAlerta}</p>
                <p className="text-xs text-white/50 mt-2">Entre 65 y 74</p>
              </div>
              <div className="panel-grades rounded-2xl p-4">
                <p className="text-xs uppercase tracking-wider text-white/50 mb-1">Al día</p>
                <p className="text-3xl font-bold text-emerald-400 tabular-nums leading-none">{kpiAlDia}</p>
                <p className="text-xs text-white/50 mt-2">Promedio {'>='} 75</p>
              </div>
            </div>

            {/* Student grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {sortedStudentsForGeneral.map(({ student, avg, lowestCategoryName, coberturaMateriasPct }) => {
                const isRisk = avg != null && avg < 65;
                const isAlert = avg != null && avg >= 65 && avg < 75;
                const isOk = avg != null && avg >= 75;
                const borderColor = isRisk
                  ? 'rgba(239,68,68,0.7)'
                  : isAlert
                    ? 'rgba(234,179,8,0.7)'
                    : isOk
                      ? 'rgba(52,211,153,0.7)'
                      : 'rgba(255,255,255,0.15)';
                return (
                  <div
                    key={student._id}
                    className="panel-grades rounded-2xl p-4 cursor-pointer hover:border-white/20 transition-colors"
                    style={{ borderLeft: `3px solid ${borderColor}` }}
                    onClick={() => {
                      setSelectedStudentId(student._id);
                      setViewMode('individual');
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-blue-900/50 text-blue-300 flex items-center justify-center text-xs font-semibold flex-shrink-0">
                        {studentInitials(student.nombre)}
                      </div>
                      <span className="text-sm font-medium text-[#E2E8F0] flex-1 min-w-0 truncate">
                        {student.nombre}
                      </span>
                      {isRisk && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20 flex-shrink-0">
                          Riesgo
                        </span>
                      )}
                      {isAlert && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 flex-shrink-0">
                          Alerta
                        </span>
                      )}
                      {isOk && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex-shrink-0">
                          Al día
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-3 gap-2 border-t border-white/[0.06] mt-3 pt-3">
                      <div className="text-center">
                        <p className={`text-base font-semibold tabular-nums ${analyticsGradeText(avg)}`}>
                          {avg != null ? avg.toFixed(1) : '—'}
                        </p>
                        <p className="text-[11px] text-white/50 mt-0.5">Promedio</p>
                      </div>
                      <div className="text-center">
                        <p className="text-base font-semibold text-white/70 tabular-nums">
                          {isDirectivo
                            ? directivoSoloMateriaId
                              ? commitment?.tasksCompletionRate != null
                                ? `${Math.round(commitment.tasksCompletionRate * 100)}%`
                                : '—'
                              : coberturaMateriasPct != null
                                ? `${coberturaMateriasPct}%`
                                : '—'
                            : commitment?.tasksCompletionRate != null
                              ? `${Math.round(commitment.tasksCompletionRate * 100)}%`
                              : '—'}
                        </p>
                        <p className="text-[11px] text-white/50 mt-0.5">
                          {isDirectivo && !directivoSoloMateriaId ? 'Con notas' : 'Entrega'}
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-base font-semibold text-white/70 tabular-nums">
                          {isDirectivo
                            ? riskLabelFromAvg(avg)
                            : risk?.level === 'high'
                              ? 'Alto'
                              : risk?.level === 'medium'
                                ? 'Medio'
                                : risk?.level === 'low'
                                  ? 'Bajo'
                                  : '—'}
                        </p>
                        <p className="text-[11px] text-white/50 mt-0.5">Riesgo</p>
                      </div>
                    </div>
                    {isRisk && lowestCategoryName && (
                      <span className="mt-2 text-[11px] px-2 py-0.5 rounded-md bg-red-500/[0.08] text-red-400 border border-red-500/20 inline-block">
                        {isDirectivo && !directivoSoloMateriaId
                          ? `Materia más débil: ${lowestCategoryName}`
                          : `Categoría baja: ${lowestCategoryName}`}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ) : gradingLoading ? (
          <Skeleton className="h-96 bg-white/10 rounded-2xl" />
        ) : (
          /* ═══════════════════════════════════════════════════════
             VISTA INDIVIDUAL
          ═══════════════════════════════════════════════════════ */
          <div className="space-y-4">
            {/* Bloque A — Hero row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Col izq — métricas del estudiante */}
              <div className="panel-grades rounded-2xl p-5">
                <p className="text-lg font-semibold text-[#E2E8F0] font-['Poppins']">
                  {selectedStudent?.nombre ?? 'Estudiante'}
                </p>
                <p className="text-sm text-white/50 mt-0.5">
                  {groupDisplayName}
                  {analyticsScopeLabel ? ` • ${analyticsScopeLabel}` : ''}
                </p>
                <div className="border-t border-white/[0.06] my-3" />
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-[11px] uppercase tracking-wider text-white/50 mb-1">Promedio</p>
                    <p className={`text-4xl font-bold font-['Poppins'] tabular-nums leading-none ${analyticsGradeText(displayWeightedAverage)}`}>
                      {displayWeightedAverage != null ? displayWeightedAverage.toFixed(1) : '—'}
                    </p>
                    <p className="text-white/40 text-xs mt-1">/ 100</p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-wider text-white/50 mb-1">Ranking</p>
                    <p className="text-2xl font-semibold text-[#E2E8F0] tabular-nums">
                      {isDirectivo
                        ? directivoSoloMateriaId
                          ? groupComparison?.rank != null && groupComparison.totalStudents > 0
                            ? `#${groupComparison.rank} de ${groupComparison.totalStudents}`
                            : '—'
                          : directivoStudentRank != null
                            ? `#${directivoStudentRank.rank} de ${directivoStudentRank.total}`
                            : '—'
                        : groupComparison?.rank != null && groupComparison.totalStudents > 0
                          ? `#${groupComparison.rank} de ${groupComparison.totalStudents}`
                          : '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-wider text-white/50 mb-1">Entrega</p>
                    <p className="text-2xl font-semibold text-[#E2E8F0] tabular-nums">
                      {isDirectivo
                        ? directivoSoloMateriaId
                          ? commitment?.tasksCompletionRate != null
                            ? `${Math.round(commitment.tasksCompletionRate * 100)}%`
                            : '—'
                          : selectedHolistic &&
                              holisticGroup &&
                              holisticGroup.materiasTotal > 0
                            ? `${Math.round((selectedHolistic.materiasConNotas / holisticGroup.materiasTotal) * 100)}%`
                            : '—'
                        : commitment?.tasksCompletionRate != null
                          ? `${Math.round(commitment.tasksCompletionRate * 100)}%`
                          : '—'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Col der — estado académico / riesgo */}
              <div className="panel-grades rounded-2xl p-5">
                <p className="text-xs uppercase tracking-wider text-white/50 mb-3">Estado académico</p>
                <div className="flex items-center justify-center mb-3">
                  {isDirectivo && !directivoSoloMateriaId ? (
                    displayWeightedAverage == null ? (
                      <span className="text-white/40 text-lg">Sin datos</span>
                    ) : (
                      <span
                        className={`text-lg font-semibold px-4 py-2 rounded-xl border ${
                          displayWeightedAverage < 65
                            ? 'bg-red-500/10 text-red-400 border-red-500/30'
                            : displayWeightedAverage < 75
                              ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30'
                              : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                        }`}
                      >
                        {displayWeightedAverage < 65
                          ? 'Alto riesgo'
                          : displayWeightedAverage < 75
                            ? 'Riesgo medio'
                            : 'Rendimiento estable'}
                      </span>
                    )
                  ) : risk == null ? (
                    <span className="text-white/40 text-lg">Sin datos</span>
                  ) : (
                    <span
                      className={`text-lg font-semibold px-4 py-2 rounded-xl border ${
                        risk.level === 'high'
                          ? 'bg-red-500/10 text-red-400 border-red-500/30'
                          : risk.level === 'medium'
                            ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30'
                            : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                      }`}
                    >
                      {risk.level === 'high'
                        ? 'Alto riesgo'
                        : risk.level === 'medium'
                          ? 'Riesgo medio'
                          : 'Rendimiento estable'}
                    </span>
                  )}
                </div>
                {isDirectivo && !directivoSoloMateriaId && selectedHolistic?.materiaMasDebil ? (
                  <div className="mt-1">
                    <span className="text-[11px] px-2 py-0.5 rounded-md bg-white/[0.04] border border-white/[0.08] text-white/60 inline-block">
                      Materia más débil: {selectedHolistic.materiaMasDebil}
                    </span>
                  </div>
                ) : null}
                {(!isDirectivo || !!directivoSoloMateriaId) && (risk?.factors?.length ?? 0) > 0 && (
                  <div className="mt-1">
                    {risk!.factors.map((f, i) => (
                      <span
                        key={i}
                        className="text-[11px] px-2 py-0.5 rounded-md bg-white/[0.04] border border-white/[0.08] text-white/60 inline-block mr-1 mt-1"
                      >
                        {f}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Bloque B — Análisis IA */}
            {(!isDirectivo || !!directivoSoloMateriaId) && aiSummary && aiSummary.trim().length > 0 && (
              <div className="panel-grades rounded-2xl p-5">
                <div className="flex items-center gap-2">
                  <Lightbulb className="w-4 h-4 text-[#ffd700] flex-shrink-0" />
                  <span className="text-sm font-semibold text-white/80">Análisis IA</span>
                  {analyticsSummaryLoading && <Loader2 className="w-3.5 h-3.5 animate-spin text-white/40 ml-1" />}
                </div>
                <p className="text-sm text-white/70 leading-relaxed mt-3">{aiSummary}</p>
              </div>
            )}

            {/* Bloque C — Gráficos */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Desempeño por categoría */}
              <div className="panel-grades rounded-2xl p-5">
                <h2 className="text-sm font-semibold text-white/80 mb-4">
                  {isDirectivo && viewMode === 'individual' && !directivoSoloMateriaId
                    ? 'Promedio por materia (todo del curso)'
                    : 'Desempeño por categoría'}
                </h2>
                {chartCategoryData.length > 0 ? (
                  <div style={{ height: impactChartHeight }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={chartCategoryData}
                        margin={{ top: 12, right: 28, bottom: 12, left: 12 }}
                        layout="vertical"
                      >
                        <XAxis type="number" hide domain={[0, 'dataMax']} />
                        <YAxis
                          type="category"
                          dataKey="categoria"
                          width={200}
                          tick={{ fill: 'rgba(255,255,255,0.85)', fontSize: 13 }}
                          tickFormatter={(v) => truncateLabel(v, 26)}
                          axisLine={false}
                          tickLine={false}
                          interval={0}
                        />
                        <Tooltip
                          contentStyle={{
                            background: 'linear-gradient(145deg, rgba(30, 58, 138, 0.35), rgba(15, 23, 42, 0.72))',
                            border: '1px solid rgba(255,255,255,0.10)',
                            borderRadius: 14,
                            backdropFilter: 'blur(18px)',
                            boxShadow: '0 0 40px rgba(37, 99, 235, 0.22), 0 10px 30px rgba(0,0,0,0.35)',
                          }}
                          labelStyle={{ color: 'rgba(255,255,255,0.92)', fontSize: 13, fontWeight: 600 }}
                          formatter={(value: number, _name: string, props: any) => {
                            const w = props?.payload?.weight;
                            const wLabel = typeof w === 'number' ? ` (peso ${w}%)` : '';
                            return [`${Number(value).toFixed(1)} pts${wLabel}`, 'Impacto'];
                          }}
                        />
                        <Bar
                          dataKey="impact"
                          radius={[6, 10, 10, 6]}
                          maxBarSize={28}
                          barSize={24}
                          isAnimationActive
                          animationDuration={800}
                          animationEasing="ease-out"
                        >
                          {chartCategoryData.map((_, i) => (
                            <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />
                          ))}
                          <LabelList
                            dataKey="impact"
                            position="right"
                            formatter={(v: number) => `${Number(v).toFixed(1)} pts`}
                            style={{ fill: 'rgba(255,255,255,0.90)', fontSize: 13, fontWeight: 600 }}
                          />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <p className="text-white/40 text-sm text-center py-8">Sin datos suficientes para este trimestre</p>
                )}
              </div>

              {/* Evolución de notas */}
              <div className="panel-grades rounded-2xl p-5">
                <h2 className="text-sm font-semibold text-white/80 mb-4">Evolución de notas</h2>
                {isDirectivo && !directivoSoloMateriaId ? (
                  <p className="text-white/40 text-sm text-center py-8">
                    La evolución temporal se muestra al elegir una materia concreta en el filtro superior.
                  </p>
                ) : snapshot?.evolucion && snapshot.evolucion.labels.length > 1 ? (
                  <div className="h-48 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={snapshot.evolucion.labels.map((label, i) => ({
                          fecha: label,
                          promedio: snapshot.evolucion!.promedios[i],
                        }))}
                        margin={{ top: 8, right: 8, bottom: 24, left: 8 }}
                      >
                        <XAxis
                          dataKey="fecha"
                          stroke="rgba(255,255,255,0.3)"
                          tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 11 }}
                        />
                        <YAxis
                          domain={[0, 100]}
                          stroke="rgba(255,255,255,0.3)"
                          tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 11 }}
                          width={32}
                        />
                        <Tooltip
                          contentStyle={{
                            background: '#0C1B30',
                            border: '1px solid rgba(59,130,246,0.3)',
                            borderRadius: 8,
                          }}
                          labelStyle={{ color: 'rgba(255,255,255,0.9)' }}
                          formatter={(value: number) => [value, 'Promedio']}
                        />
                        <Line
                          type="monotone"
                          dataKey="promedio"
                          stroke="#38BDF8"
                          strokeWidth={2.5}
                          dot={{ fill: 'white', stroke: 'rgba(56,189,248,0.65)', strokeWidth: 2, r: 4 }}
                          activeDot={{ r: 6, fill: '#38BDF8' }}
                          isAnimationActive
                          animationDuration={600}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <p className="text-white/40 text-sm text-center py-8">Sin datos suficientes para este trimestre</p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
