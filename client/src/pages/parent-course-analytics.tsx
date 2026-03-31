import { useRoute, useLocation } from 'wouter';
import { useAuth } from '@/lib/authContext';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { NavBackButton } from '@/components/nav-back-button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { InsightsBlock } from '@/components/grading/InsightsBlock';
import { AnalyticsCategoryChart } from '@/components/grading/AnalyticsCategoryChart';
import type { AnalyticsSummaryResponse, CourseIntelligenceResponse } from '@/hooks/useCourseGrading';

export default function ParentCourseAnalyticsPage() {
  const [, params] = useRoute('/parent/analytics/:studentId/:cursoId');
  const cursoId = params?.cursoId ?? '';
  const studentId = params?.studentId ?? '';
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  const canAccess = user?.rol === 'padre';
  if (user && !canAccess) {
    setLocation('/dashboard');
    return null;
  }

  const { data: summary, isLoading: loadingSummary } = useQuery<AnalyticsSummaryResponse>({
    queryKey: ['parent-analytics-summary', cursoId, studentId],
    queryFn: () =>
      apiRequest(
        'GET',
        `/api/courses/${cursoId}/analytics-summary?studentId=${encodeURIComponent(
          studentId
        )}&role=padre`
      ),
    enabled: Boolean(cursoId) && Boolean(studentId),
  });

  const { data: intelligence, isLoading: loadingIntelligence } =
    useQuery<CourseIntelligenceResponse>({
      queryKey: ['parent-course-intelligence', cursoId, studentId],
      queryFn: () =>
        apiRequest(
          'GET',
          `/api/courses/${cursoId}/intelligence?studentId=${encodeURIComponent(studentId)}`
        ),
      enabled: Boolean(cursoId) && Boolean(studentId),
    });

  const isLoading = loadingSummary || loadingIntelligence;

  const promedio = summary?.weightedAverage ?? null;
  const nivel =
    promedio == null
      ? 'Sin datos'
      : promedio >= 85
      ? 'Excelente'
      : promedio >= 70
      ? 'Estable'
      : 'Requiere atención';

  const asistencia = intelligence?.commitment.attendanceRate ?? null;
  const puntualidad = intelligence?.commitment.punctualityRate ?? null;
  const entregas = intelligence?.commitment.tasksCompletionRate ?? null;

  const toPct = (v: number | null | undefined) =>
    v != null ? `${Math.round(v * 100)}%` : 'Sin datos';

  return (
    <div className="w-full max-w-4xl mx-auto text-[#E2E8F0]">
      <div className="mb-6">
        <NavBackButton to="/parent/aprendizaje" label="Aprendizaje del hijo/a" />
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-40 bg-white/10 rounded-2xl" />
          <Skeleton className="h-40 bg-white/10 rounded-2xl" />
          <Skeleton className="h-64 bg-white/10 rounded-2xl" />
        </div>
      ) : (
        <>
          <Card className="panel-grades border-white/10 rounded-2xl mb-6">
              <CardHeader>
                <CardTitle className="text-white font-['Poppins']">
                  Estado académico general
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2 items-center">
                <div>
                  <p className="text-xs uppercase tracking-wide text-white/60 mb-1">
                    Promedio en la materia
                  </p>
                  <p className="text-4xl font-bold text-white tabular-nums leading-none">
                    {promedio != null ? promedio.toFixed(1) : '—'}
                  </p>
                  <p className="text-white/60 text-xs mt-1">/ 100 · {nivel}</p>
                </div>
                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-wide text-white/60">
                    Indicadores clave
                  </p>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-white/80">Asistencia</span>
                    <span className="font-semibold">{toPct(asistencia)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-white/80">Puntualidad</span>
                    <span className="font-semibold">{toPct(puntualidad)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-white/80">Entrega de tareas</span>
                    <span className="font-semibold">{toPct(entregas)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <AnalyticsCategoryChart
              byCategory={summary?.byCategory}
              title="Análisis por logro (categorías de calificación)"
            />

            <div className="mt-2">
              <InsightsBlock
                insights={{ insights: summary?.insights ?? [] }}
                aiSummary={summary?.aiSummary}
                isLoadingAi={false}
                title="Sugerencias para mejorar"
                emptyText="Aún no hay sugerencias disponibles. Se generarán cuando el sistema tenga notas suficientes de tu hijo/a."
              />
            </div>
          </>
        )}
    </div>
  );
}

