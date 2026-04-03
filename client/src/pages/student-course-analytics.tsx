import { useMemo } from 'react';
import { useRoute, useLocation } from 'wouter';
import { useAuth } from '@/lib/authContext';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Breadcrumb } from '@/components/Breadcrumb';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { InsightsBlock } from '@/components/grading/InsightsBlock';
import { AnalyticsCategoryChart } from '@/components/grading/AnalyticsCategoryChart';
import type { AnalyticsSummaryResponse, CourseIntelligenceResponse } from '@/hooks/useCourseGrading';

export default function StudentCourseAnalyticsPage() {
  const [, params] = useRoute('/student/course/:cursoId/analytics');
  const cursoId = params?.cursoId ?? '';
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  const studentId = user?.id ?? '';

  const canAccess = user?.rol === 'estudiante';
  if (user && !canAccess) {
    setLocation('/dashboard');
    return null;
  }

  const { data: summary, isLoading: loadingSummary } = useQuery<AnalyticsSummaryResponse>({
    queryKey: ['student-analytics-summary', cursoId, studentId],
    queryFn: () =>
      apiRequest(
        'GET',
        `/api/courses/${cursoId}/analytics-summary?studentId=${encodeURIComponent(
          studentId
        )}&role=estudiante`
      ),
    enabled: Boolean(cursoId) && Boolean(studentId),
  });

  const { data: intelligence, isLoading: loadingIntelligence } =
    useQuery<CourseIntelligenceResponse>({
      queryKey: ['student-course-intelligence', cursoId, studentId],
      queryFn: () =>
        apiRequest(
          'GET',
          `/api/courses/${cursoId}/intelligence?studentId=${encodeURIComponent(studentId)}`
        ),
      enabled: Boolean(cursoId) && Boolean(studentId),
    });

  const isLoading = loadingSummary || loadingIntelligence;

  const promedio = summary?.weightedAverage ?? null;
  const groupAverage = intelligence?.groupComparison.groupAverage ?? null;
  const percentile = intelligence?.groupComparison.percentile ?? null;
  const commitmentIndex = intelligence?.commitment.commitmentIndex ?? null;

  const nivel =
    promedio == null
      ? 'Sin datos'
      : promedio >= 85
      ? 'Sólido'
      : promedio >= 70
      ? 'En crecimiento'
      : 'En riesgo';

  const nivelColor =
    promedio == null
      ? 'text-white'
      : promedio >= 85
      ? 'text-green-400'
      : promedio >= 70
      ? 'text-blue-400'
      : 'text-red-400';

  const attendanceRate = intelligence?.commitment.attendanceRate ?? null;
  const punctualityRate = intelligence?.commitment.punctualityRate ?? null;
  const tasksCompletionRate = intelligence?.commitment.tasksCompletionRate ?? null;

  // Enriquecer byCategory con colores semánticos
  const enrichedByCategory = useMemo(() => {
    if (!summary?.byCategory) return undefined;
    return summary.byCategory.map((c) => ({
      ...c,
      color:
        c.count === 0
          ? 'rgba(255,255,255,0.2)'
          : c.average >= 75
          ? '#2563eb'
          : c.average >= 65
          ? '#f59e0b'
          : '#ef4444',
    }));
  }, [summary?.byCategory]);

  const commitmentBar = (value: number | null, label: string) => {
    const pct = value != null ? Math.round(value * 100) : null;
    const barColor =
      pct == null ? 'rgba(255,255,255,0.2)' : pct >= 75 ? '#10b981' : pct >= 50 ? '#f59e0b' : '#ef4444';
    return (
      <div style={{ marginBottom: 10 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginBottom: 4,
            fontSize: 12,
            color: 'rgba(255,255,255,0.7)',
          }}
        >
          <span>{label}</span>
          <span style={{ fontWeight: 600, color: pct == null ? 'rgba(255,255,255,0.4)' : 'white' }}>
            {pct != null ? `${pct}%` : '—'}
          </span>
        </div>
        <div
          style={{
            height: 4,
            borderRadius: 2,
            background: 'rgba(255,255,255,0.08)',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%',
              borderRadius: 2,
              width: pct != null ? `${Math.min(100, pct)}%` : '0%',
              background: barColor,
              transition: 'width 0.4s ease',
            }}
          />
        </div>
      </div>
    );
  };

  return (
    <div className="w-full max-w-4xl mx-auto text-[#E2E8F0]">
      <div className="mb-6">
        <Breadcrumb
          items={[
            { label: 'Dashboard', href: '/dashboard' },
            { label: 'Cursos', href: '/mi-aprendizaje/cursos' },
            { label: 'Análisis' },
          ]}
        />
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-40 bg-white/10 rounded-2xl" />
          <Skeleton className="h-40 bg-white/10 rounded-2xl" />
          <Skeleton className="h-64 bg-white/10 rounded-2xl" />
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-3 mb-6">
              {/* Card 1: Promedio actual */}
              <Card className="panel-grades border-white/10 rounded-2xl">
                <CardContent className="p-5">
                  <p className="text-xs uppercase tracking-wide text-white/50 mb-3">
                    Promedio actual
                  </p>
                  <p className={`text-4xl font-bold tabular-nums leading-none mb-1 ${nivelColor}`}>
                    {promedio != null ? promedio.toFixed(1) : '—'}
                  </p>
                  <p className="text-white/50 text-xs">/100</p>
                  <p
                    className="text-xs mt-2 font-semibold"
                    style={{
                      color:
                        promedio == null
                          ? 'rgba(255,255,255,0.4)'
                          : promedio >= 85
                          ? '#10b981'
                          : promedio >= 70
                          ? '#2563eb'
                          : '#ef4444',
                    }}
                  >
                    {nivel}
                  </p>
                </CardContent>
              </Card>

              {/* Card 2: Posición en el grupo */}
              <Card className="panel-grades border-white/10 rounded-2xl">
                <CardContent className="p-5">
                  <p className="text-xs uppercase tracking-wide text-white/50 mb-3">
                    Posición en el grupo
                  </p>
                  {groupAverage != null && percentile != null ? (
                    <>
                      <p className="text-2xl font-bold text-white tabular-nums leading-none mb-1">
                        Percentil {percentile.toFixed(0)}
                      </p>
                      <p className="text-white/50 text-xs mb-3">
                        Promedio del grupo: {groupAverage.toFixed(1)}/100
                      </p>
                      {/* Mini barra comparativa */}
                      <div
                        style={{
                          position: 'relative',
                          height: 6,
                          borderRadius: 3,
                          background: 'rgba(255,255,255,0.08)',
                          overflow: 'visible',
                        }}
                      >
                        {/* Marcador del estudiante */}
                        {promedio != null && (
                          <div
                            style={{
                              position: 'absolute',
                              top: -3,
                              left: `${Math.min(98, Math.max(2, promedio))}%`,
                              width: 12,
                              height: 12,
                              borderRadius: '50%',
                              background: nivelColor.includes('green')
                                ? '#10b981'
                                : nivelColor.includes('blue')
                                ? '#2563eb'
                                : '#ef4444',
                              border: '2px solid rgba(255,255,255,0.8)',
                              transform: 'translateX(-50%)',
                            }}
                            title={`Tu promedio: ${promedio.toFixed(1)}`}
                          />
                        )}
                        {/* Línea del grupo */}
                        <div
                          style={{
                            position: 'absolute',
                            top: -4,
                            left: `${Math.min(98, Math.max(2, groupAverage))}%`,
                            width: 2,
                            height: 14,
                            background: 'rgba(255,255,255,0.4)',
                            transform: 'translateX(-50%)',
                          }}
                          title={`Promedio grupo: ${groupAverage.toFixed(1)}`}
                        />
                      </div>
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          marginTop: 8,
                          fontSize: 10,
                          color: 'rgba(255,255,255,0.4)',
                        }}
                      >
                        <span>0</span>
                        <span>100</span>
                      </div>
                    </>
                  ) : (
                    <p className="text-white/40 text-sm">Sin datos grupales disponibles</p>
                  )}
                </CardContent>
              </Card>

              {/* Card 3: Compromiso desglosado */}
              <Card className="panel-grades border-white/10 rounded-2xl">
                <CardContent className="p-5">
                  <p className="text-xs uppercase tracking-wide text-white/50 mb-3">
                    Compromiso
                  </p>
                  {commitmentBar(attendanceRate, 'Asistencia')}
                  {commitmentBar(punctualityRate, 'Puntualidad')}
                  {commitmentBar(tasksCompletionRate, 'Tareas')}
                  <p className="text-white/40 text-xs mt-2">
                    Considera asistencia, puntualidad y entrega de tareas
                  </p>
                </CardContent>
              </Card>
            </div>

            <AnalyticsCategoryChart
              byCategory={enrichedByCategory}
              title="Análisis por logro (categorías de calificación)"
            />

            <div className="mt-2">
              <InsightsBlock
                insights={{ insights: summary?.insights ?? [] }}
                aiSummary={summary?.aiSummary}
                isLoadingAi={false}
                title="Análisis de Kiwi"
                insightStyle="pills"
              />
            </div>
          </>
        )}
    </div>
  );
}

