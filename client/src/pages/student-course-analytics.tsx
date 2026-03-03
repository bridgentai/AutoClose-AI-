import { useRoute, useLocation } from 'wouter';
import { useAuth } from '@/lib/authContext';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { NavBackButton } from '@/components/nav-back-button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { InsightsBlock } from '@/components/grading/InsightsBlock';
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

  return (
    <div
      className="min-h-screen p-4 md:p-6 text-[#E2E8F0]"
      style={{
        background:
          'radial-gradient(circle at 20% 20%, #1E3A8A 0%, #0F172A 40%, #020617 100%)',
      }}
    >
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <NavBackButton to="/mi-aprendizaje/cursos" label="Volver a mis cursos" />
        </div>

        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-40 bg-white/10 rounded-2xl" />
            <Skeleton className="h-40 bg-white/10 rounded-2xl" />
          </div>
        ) : (
          <>
            <Card className="panel-grades border-white/10 rounded-2xl mb-6">
              <CardHeader>
                <CardTitle className="text-white font-['Poppins']">
                  Tu progreso en esta materia
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-3 items-center">
                <div>
                  <p className="text-xs uppercase tracking-wide text-white/60 mb-1">
                    Promedio actual
                  </p>
                  <p className="text-4xl font-bold text-white tabular-nums leading-none">
                    {promedio != null ? promedio.toFixed(1) : '—'}
                  </p>
                  <p className="text-white/50 text-xs mt-1">/ 100 · Nivel {nivel}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-white/60 mb-1">
                    Comparado con el grupo
                  </p>
                  <p className="text-lg font-semibold tabular-nums text-white">
                    {groupAverage != null ? `${groupAverage.toFixed(1)} / 100` : '—'}
                  </p>
                  {percentile != null && (
                    <p className="text-white/60 text-xs mt-1">
                      Estás alrededor del percentil {percentile.toFixed(1)}.
                    </p>
                  )}
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-white/60 mb-1">
                    Compromiso
                  </p>
                  <p className="text-2xl font-semibold tabular-nums text-white">
                    {commitmentIndex != null
                      ? `${Math.round(commitmentIndex * 100)}%`
                      : '—'}
                  </p>
                  <p className="text-white/60 text-xs mt-1">
                    Considera asistencia, puntualidad y entrega de tareas.
                  </p>
                </div>
              </CardContent>
            </Card>

            <div className="mt-6">
              <InsightsBlock
                insights={{ insights: summary?.insights ?? [] }}
                aiSummary={summary?.aiSummary}
                isLoadingAi={false}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

