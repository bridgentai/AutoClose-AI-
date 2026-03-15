import { useState } from 'react';
import { useRoute, useLocation } from 'wouter';
import { useAuth } from '@/lib/authContext';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useCourseGrading, useAnalyticsSummary, useCourseIntelligence } from '@/hooks/useCourseGrading';
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
import { ArrowLeft, AlertTriangle, Lightbulb, Loader2 } from 'lucide-react';
import { useMemo } from 'react';
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
} from 'recharts';

interface CourseSubject {
  _id: string;
  nombre: string;
}

interface Student {
  _id: string;
  nombre: string;
}

const allowedRoles = ['profesor', 'directivo', 'admin-general-colegio', 'padre', 'school_admin', 'super_admin', 'estudiante'];

const BAR_COLORS = ['#3B82F6', '#00c8ff', '#8b5cf6', '#06b6d4', '#f59e0b'];

export default function CourseAnalyticsPage() {
  const [, params] = useRoute('/course/:cursoId/analytics');
  const cursoId = params?.cursoId ?? '';
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');

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
    queryKey: ['students', cursoId],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/groups/${displayGroupId}/students`);
      return Array.isArray(res) ? res : [];
    },
    enabled: !!displayGroupId && !!user?.id && user?.rol !== 'estudiante',
  });

  const isStudent = user?.rol === 'estudiante';
  const firstSubjectId = isStudent ? cursoId : (subjectsForGroup[0]?._id ?? '');
  const subjectName = isStudent ? (courseDetails?.nombre ?? '') : (subjectsForGroup[0]?.nombre ?? '');
  const effectiveStudentId = isStudent ? (user?.id ?? '') : (selectedStudentId || (students[0]?._id ?? ''));

  const {
    categories,
    snapshot,
    forecast,
    risk,
    insights,
    isLoading: gradingLoading,
  } = useCourseGrading(firstSubjectId, effectiveStudentId || undefined);

  const { data: analyticsSummary, isLoading: analyticsSummaryLoading } = useAnalyticsSummary(
    firstSubjectId,
    effectiveStudentId || undefined
  );
  const aiSummary = analyticsSummary?.aiSummary ?? '';
  const mergedInsights = [
    ...(analyticsSummary?.insights ?? []),
    ...(insights?.insights ?? []),
  ].filter((item, index, arr) => arr.indexOf(item) === index);

  const { data: intelligence } = useCourseIntelligence(
    firstSubjectId,
    effectiveStudentId || undefined
  );

  const groupComparison = intelligence?.groupComparison;
  const commitment = intelligence?.commitment;

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

  const weightedAverage = analyticsSummary?.weightedAverage ?? snapshot?.weightedFinalAverage ?? null;
  const canAccess = user?.rol && allowedRoles.includes(user.rol);

  if (user && !canAccess) {
    return (
      <div className="min-h-screen p-4 md:p-6 text-[#E2E8F0]">
        <div className="max-w-5xl mx-auto">
          <Button
            variant="ghost"
            className="text-white/70 hover:text-white mb-6"
            onClick={() => setLocation(`/course-detail/${cursoId}`)}
          >
            <ArrowLeft className="w-4 h-4 mr-2 inline" />
            Volver al curso
          </Button>
          <Card className="bg-white/5 border-white/10 rounded-2xl p-6">
            <CardContent>
              <p className="text-[#E2E8F0]/90 mb-4">No tienes permiso para ver la vista analítica.</p>
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
    <div className="min-h-screen p-4 md:p-6 text-[#E2E8F0]">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <Button
            variant="ghost"
            className="text-white/70 hover:text-white p-0 h-auto font-normal"
            onClick={() => setLocation(isStudent ? '/mi-aprendizaje/cursos' : `/course-detail/${cursoId}`)}
          >
            <ArrowLeft className="w-4 h-4 mr-2 inline" />
            {isStudent ? 'Volver a mis cursos' : 'Volver al curso'}
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
                : `Grupo ${groupDisplayName}${subjectName ? ` • ${subjectName}` : ''}`}
            </p>
          </div>
          {!isStudent && (
            <div className="flex items-center gap-3">
              <span className="text-white/60 text-sm">Estudiante</span>
              <Select value={effectiveStudentId} onValueChange={setSelectedStudentId}>
                <SelectTrigger className="w-56 bg-white/5 border-white/20 text-white rounded-lg">
                  <SelectValue placeholder="Seleccionar" />
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
        </header>

        {!firstSubjectId ? (
          <Card className="bg-white/5 border-white/10 backdrop-blur-md rounded-2xl border p-6">
            <p className="text-white/80">
              {isStudent ? 'No se pudo cargar la materia. Verifica que estés inscrito en esta materia.' : 'No hay materias para este grupo.'}
            </p>
          </Card>
        ) : gradingLoading ? (
          <Skeleton className="h-96 bg-white/10 rounded-2xl" />
        ) : (
          <Card className="bg-white/5 border-white/10 backdrop-blur-md rounded-2xl border overflow-hidden">
            <CardContent className="p-6 md:p-8 space-y-8">
              {/* 1. Indicadores + Proyección en una fila */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div>
                  <h2 className="text-lg font-semibold text-white font-['Poppins'] mb-4">
                    Indicadores estratégicos
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                    <div>
                      <p className="text-xs uppercase tracking-wider text-white/50 mb-1">Promedio ponderado</p>
                      <p className="text-4xl font-bold text-white tabular-nums leading-none">
                        {weightedAverage != null ? weightedAverage.toFixed(1) : '—'}
                      </p>
                      <p className="text-white/50 text-xs mt-1">/ 100</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wider text-white/50 mb-1">Percentil y ranking</p>
                      <p className="text-xl font-semibold tabular-nums text-white">
                        {groupComparison?.percentile != null
                          ? `${groupComparison.percentile.toFixed(1)}° percentil`
                          : '—'}
                      </p>
                      {groupComparison?.rank != null && groupComparison.totalStudents > 0 && (
                        <p className="text-white/60 text-xs mt-1">
                          Puesto {groupComparison.rank} de {groupComparison.totalStudents}
                        </p>
                      )}
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wider text-white/50 mb-1">Índice de compromiso</p>
                      <p className="text-2xl font-semibold tabular-nums text-white">
                        {commitment?.commitmentIndex != null
                          ? `${Math.round(commitment.commitmentIndex * 100)}%`
                          : '—'}
                      </p>
                      <p className="text-white/60 text-xs mt-1">
                        {commitment?.attendanceRate != null && commitment?.tasksCompletionRate != null
                          ? `Asistencia ${Math.round(commitment.attendanceRate * 100)}% • Tareas ${Math.round(commitment.tasksCompletionRate * 100)}%`
                          : 'Sin datos suficientes'}
                      </p>
                    </div>
                  </div>
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white font-['Poppins'] mb-4">
                    Proyección final
                  </h2>
                  {forecast ? (
                    <div className="space-y-4">
                      <p className="text-3xl font-bold text-[#3B82F6] tabular-nums">
                        {forecast.projectedFinalGrade.toFixed(1)}
                        <span className="text-lg font-normal text-white/60 ml-1">/ 100</span>
                      </p>
                      {weightedAverage != null && (
                        <p className="text-white/60 text-sm">
                          Promedio actual: <span className="text-white font-medium">{weightedAverage.toFixed(1)}</span>
                        </p>
                      )}
                      <div className="space-y-2">
                        <p className="text-white/60 text-xs">Intervalo de confianza</p>
                        <div className="relative h-3 bg-white/10 rounded-full overflow-hidden">
                          <div
                            className="absolute h-full bg-[#3B82F6]/70 rounded-full transition-all duration-700 ease-out"
                            style={{
                              left: `${Math.max(0, Math.min(100, forecast.confidenceInterval.low))}%`,
                              width: `${Math.max(0, Math.min(100 - forecast.confidenceInterval.low, forecast.confidenceInterval.high - forecast.confidenceInterval.low))}%`,
                            }}
                          />
                        </div>
                        <div className="flex justify-between text-xs text-white/50">
                          <span>{Math.round(forecast.confidenceInterval.low)}</span>
                          <span>{Math.round(forecast.confidenceInterval.high)}</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="text-white/50 text-sm">Sin datos de pronóstico aún.</p>
                  )}
                </div>
              </div>

              {/* 2. Impacto por categoría — gráfico con nombres de categorías */}
              <div>
                <h2 className="text-lg font-semibold text-white font-['Poppins'] mb-4">
                  Impacto por categoría
                </h2>
                {categoryImpactBreakdown.length > 0 ? (
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={categoryImpactBreakdown}
                        margin={{ top: 12, right: 12, bottom: 32, left: 8 }}
                        layout="vertical"
                      >
                        <XAxis type="number" hide />
                        <YAxis
                          type="category"
                          dataKey="categoria"
                          width={120}
                          tick={{ fill: 'rgba(255,255,255,0.85)', fontSize: 12 }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <Tooltip
                          contentStyle={{
                            background: 'rgba(12, 27, 48, 0.95)',
                            border: '1px solid rgba(59, 130, 246, 0.3)',
                            borderRadius: '8px',
                          }}
                          labelStyle={{ color: 'rgba(255,255,255,0.9)' }}
                          formatter={(value: number) => [`${value.toFixed(1)} pts`, 'Impacto']}
                          labelFormatter={(label) => `Categoría: ${label}`}
                        />
                        <Bar
                          dataKey="impact"
                          radius={[0, 6, 6, 0]}
                          maxBarSize={28}
                          isAnimationActive
                          animationDuration={800}
                          animationEasing="ease-out"
                        >
                          {categoryImpactBreakdown.map((_, i) => (
                            <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                    <div className="flex flex-wrap gap-4 mt-2 text-xs text-white/60">
                      {categoryImpactBreakdown.map((item, i) => (
                        <span key={item.name}>
                          <span
                            className="inline-block w-3 h-3 rounded-sm mr-1.5 align-middle"
                            style={{ backgroundColor: BAR_COLORS[i % BAR_COLORS.length] }}
                          />
                          {item.name}: {typeof item.impact === 'number' ? item.impact.toFixed(1) : '0'} pts
                        </span>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-white/50 text-sm">No hay datos por categoría.</p>
                )}
              </div>

              {/* Evolución de notas */}
              {snapshot?.evolucion && snapshot.evolucion.labels.length > 1 && (
                <div>
                  <h2 className="text-lg font-semibold text-white font-['Poppins'] mb-4">
                    Evolución de notas
                  </h2>
                  <div className="h-40 w-full">
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
                </div>
              )}

              {/* 3. Estabilidad + Riesgo en una fila */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                  <h2 className="text-lg font-semibold text-white font-['Poppins'] mb-4">
                    Estabilidad académica
                  </h2>
                  <div className="flex items-center gap-4">
                    <div className="relative w-24 h-24 flex-shrink-0">
                      <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                        <path
                          className="text-white/10 stroke-[3]"
                          stroke="currentColor"
                          fill="none"
                          strokeDasharray="100"
                          d="M18 2.5 a 15.5 15.5 0 0 1 0 31 a 15.5 15.5 0 0 1 0 -31"
                        />
                        <path
                          className="stroke-[3] fill-none transition-all duration-700 ease-out stroke-[#3B82F6]"
                          stroke="currentColor"
                          strokeDasharray="100"
                          strokeDashoffset={
                            100 -
                            (risk?.academicStabilityIndex != null ? risk.academicStabilityIndex * 100 : 0)
                          }
                          strokeLinecap="round"
                          d="M18 2.5 a 15.5 15.5 0 0 1 0 31 a 15.5 15.5 0 0 1 0 -31"
                        />
                      </svg>
                      <span className="absolute inset-0 flex items-center justify-center text-xl font-bold text-white">
                        {risk?.academicStabilityIndex != null
                          ? (risk.academicStabilityIndex * 100).toFixed(0)
                          : '—'}
                      </span>
                    </div>
                    <p className="text-white/70 text-sm">
                      {risk?.academicStabilityIndex != null
                        ? risk.academicStabilityIndex >= 0.7
                          ? 'Rendimiento estable'
                          : risk.academicStabilityIndex >= 0.4
                            ? 'Estabilidad moderada'
                            : 'Requiere atención'
                        : 'Sin datos'}
                    </p>
                  </div>
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white font-['Poppins'] flex items-center gap-2 mb-4">
                    <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0" />
                    Riesgo académico
                  </h2>
                  {risk ? (
                    <div className="space-y-3">
                      <div
                        className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium capitalize ${
                          risk.level === 'high'
                            ? 'bg-red-500/20 text-red-400 border border-red-500/40'
                            : risk.level === 'medium'
                              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                              : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                        }`}
                      >
                        {risk.level}
                      </div>
                      <ul className="text-sm text-white/70 space-y-1">
                        {commitment?.attendanceRate != null &&
                          !risk.factors?.some((f) => f.toLowerCase().includes('asistencia')) && (
                            <li>• Asistencia {Math.round(commitment.attendanceRate * 100)}%</li>
                          )}
                        {risk.factors?.map((f, i) => (
                          <li key={i}>• {f}</li>
                        ))}
                        {risk.recoveryPotentialScore != null &&
                          !risk.factors?.some((f) => f.toLowerCase().includes('recuperación')) && (
                            <li>• Potencial de recuperación: {(risk.recoveryPotentialScore * 100).toFixed(0)}%</li>
                          )}
                      </ul>
                    </div>
                  ) : (
                    <p className="text-white/50 text-sm">Sin evaluación de riesgo aún.</p>
                  )}
                </div>
              </div>

              {/* 4. Retroalimentación IA — análisis y feedback sobre el estudiante */}
              <div className="pt-4 border-t border-white/10">
                <h2 className="text-lg font-semibold text-white font-['Poppins'] flex items-center gap-2 mb-4">
                  <Lightbulb className="w-5 h-5 text-[#ffd700]" />
                  Retroalimentación sobre el estudiante
                </h2>
                {analyticsSummaryLoading && (
                  <div className="flex items-center gap-2 text-white/60 text-sm mb-4">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Generando análisis con IA...</span>
                  </div>
                )}
                {aiSummary && (
                  <div className="p-4 rounded-xl bg-white/5 border border-white/10 mb-4">
                    <p className="text-white/90 text-sm leading-relaxed whitespace-pre-wrap">{aiSummary}</p>
                  </div>
                )}
                {mergedInsights.length > 0 && (
                  <ul className="space-y-2 text-sm text-white/90">
                    {mergedInsights.map((item, i) => (
                      <li key={i} className="flex gap-2">
                        <span className="text-[#ffd700] flex-shrink-0">•</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {!analyticsSummaryLoading && !aiSummary && mergedInsights.length === 0 && (
                  <p className="text-white/50 text-sm">
                    No hay retroalimentación disponible aún. El análisis con IA se generará al cargar los datos del estudiante.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
