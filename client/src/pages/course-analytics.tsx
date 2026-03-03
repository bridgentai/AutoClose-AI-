import { useState, useMemo } from 'react';
import { useRoute, useLocation } from 'wouter';
import { useAuth } from '@/lib/authContext';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { NavBackButton } from '@/components/nav-back-button';
import { useCourseGrading, useAnalyticsSummary, useCourseIntelligence } from '@/hooks/useCourseGrading';
import { ForecastGraph } from '@/components/grading/ForecastGraph';
import { StabilityGauge } from '@/components/grading/StabilityGauge';
import { RiskIndicator } from '@/components/grading/RiskIndicator';
import { InsightsBlock } from '@/components/grading/InsightsBlock';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';

interface CourseSubject {
  _id: string;
  nombre: string;
}

interface Student {
  _id: string;
  nombre: string;
}

const allowedRoles = ['profesor', 'directivo', 'admin-general-colegio', 'padre'];

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

  const { data: subjectsForGroup = [] } = useQuery<CourseSubject[]>({
    queryKey: ['subjectsForGroup', cursoId],
    queryFn: () => apiRequest('GET', `/api/courses/for-group/${cursoId}`),
    enabled: !!cursoId && !!user?.id,
  });

  const { data: students = [] } = useQuery<Student[]>({
    queryKey: ['students', cursoId],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/groups/${displayGroupId}/students`);
      return Array.isArray(res) ? res : [];
    },
    enabled: !!displayGroupId && !!user?.id,
  });

  const firstSubjectId = subjectsForGroup[0]?._id;
  const subjectName = subjectsForGroup[0]?.nombre ?? '';
  const effectiveStudentId = selectedStudentId || (students[0]?._id ?? '');

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
  const mergedInsights = (analyticsSummary?.insights?.length ? analyticsSummary.insights : insights?.insights) ?? [];

  const { data: intelligence } = useCourseIntelligence(
    firstSubjectId,
    effectiveStudentId || undefined
  );

  const groupComparison = intelligence?.groupComparison;
  const commitment = intelligence?.commitment;

  const categoryImpactBreakdown = useMemo(() => {
    if (snapshot?.categoryImpacts && categories.length) {
      return categories.map((cat) => ({
        name: cat.nombre,
        impact: snapshot.categoryImpacts[cat._id] ?? 0,
        weight: cat.weight,
      }));
    }
    if (analyticsSummary?.byCategory?.length) {
      const total = analyticsSummary.weightedAverage ?? 1;
      return analyticsSummary.byCategory.map((c) => ({
        name: c.categoryName,
        impact: (c.average * (c.percentage / 100)) || 0,
        weight: c.percentage,
      }));
    }
    return [];
  }, [snapshot, categories, analyticsSummary]);

  const canAccess = user?.rol && allowedRoles.includes(user.rol);
  if (user && !canAccess) {
    setLocation('/dashboard');
    return null;
  }

  return (
    <div className="min-h-screen p-4 md:p-6 text-[#E2E8F0]" style={{ background: 'radial-gradient(circle at 20% 20%, #1E3A8A 0%, #0F172A 40%, #020617 100%)' }}>
      <div className="max-w-5xl mx-auto">
        <div className="mb-6">
          <NavBackButton
            to={`/course-detail/${cursoId}`}
            label="Volver al curso"
          />
        </div>

        <Card className="panel-grades border-white/10 rounded-2xl mb-6">
          <CardHeader>
            <CardTitle className="text-white font-['Poppins']">
              Vista analítica · Inteligencia académica
            </CardTitle>
            <p className="text-white/70 text-sm">
              Grupo {displayGroupId}
              {subjectName && ` · ${subjectName}`}
            </p>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-center gap-4">
              <label className="text-white/80 text-sm font-medium">
                Estudiante
              </label>
              <Select value={effectiveStudentId} onValueChange={setSelectedStudentId}>
                <SelectTrigger className="w-64 bg-white/10 border-white/20 text-white">
                  <SelectValue placeholder="Selecciona un estudiante" />
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
          </CardContent>
        </Card>

        {!firstSubjectId ? (
          <Card className="panel-grades border-white/10 rounded-2xl p-6">
            <p className="text-[#E2E8F0]/80">No hay materias para este grupo.</p>
          </Card>
        ) : gradingLoading ? (
          <div className="grid gap-4 md:grid-cols-2">
            <Skeleton className="h-48 bg-white/10 rounded-2xl" />
            <Skeleton className="h-48 bg-white/10 rounded-2xl" />
          </div>
        ) : (
          <>
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1.1fr)] mb-6">
              <Card className="panel-grades border-white/10 rounded-2xl overflow-hidden">
                <CardHeader>
                  <CardTitle className="text-white/90 text-sm font-medium">
                    Indicadores estratégicos
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-3 items-center">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-white/60 mb-1">
                      Promedio ponderado
                    </p>
                    <p className="text-4xl font-bold text-white tabular-nums leading-none">
                      {(analyticsSummary?.weightedAverage ?? snapshot?.weightedFinalAverage) != null
                        ? (analyticsSummary?.weightedAverage ?? snapshot?.weightedFinalAverage)!.toFixed(1)
                        : '—'}
                    </p>
                    <p className="text-white/50 text-xs mt-1">/ 100</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-white/60 mb-1">
                      Percentil y ranking
                    </p>
                    <p className="text-lg font-semibold tabular-nums text-white">
                      {groupComparison?.percentile != null
                        ? `${groupComparison.percentile.toFixed(1)}ᵉ percentil`
                        : '—'}
                    </p>
                    {groupComparison?.rank != null && groupComparison.totalStudents > 0 && (
                      <p className="text-white/60 text-xs mt-1">
                        Puesto {groupComparison.rank} de {groupComparison.totalStudents}
                      </p>
                    )}
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-white/60 mb-1">
                      Índice de compromiso
                    </p>
                    <p className="text-2xl font-semibold tabular-nums text-white">
                      {commitment?.commitmentIndex != null
                        ? `${Math.round(commitment.commitmentIndex * 100)}%`
                        : '—'}
                    </p>
                    <p className="text-white/60 text-xs mt-1">
                      {commitment?.attendanceRate != null && commitment?.tasksCompletionRate != null
                        ? `Asistencia ${Math.round(commitment.attendanceRate * 100)}% · Tareas ${
                            Math.round(commitment.tasksCompletionRate * 100)
                          }%`
                        : 'Sin datos suficientes'}
                    </p>
                  </div>
                </CardContent>
              </Card>
              <ForecastGraph
                forecast={forecast ?? null}
                snapshotAverage={analyticsSummary?.weightedAverage ?? snapshot?.weightedFinalAverage}
              />
            </div>

            {categoryImpactBreakdown.length > 0 && (
              <Card className="panel-grades border-white/10 rounded-2xl mb-6">
                <CardHeader>
                  <CardTitle className="text-white text-base font-['Poppins']">
                    Impacto por categoría
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {categoryImpactBreakdown.map((item) => (
                    <div key={item.name} className="flex items-center gap-4">
                      <span className="text-white/80 text-sm w-32 truncate">
                        {item.name}
                      </span>
                      <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-[#3B82F6] to-[#1D4ED8] rounded-full"
                          style={{
                            width: `${Math.min(100, ((item.impact || 0) / ((analyticsSummary?.weightedAverage ?? snapshot?.weightedFinalAverage) || 1)) * 100)}%`,
                          }}
                        />
                      </div>
                      <span className="text-white/80 text-sm tabular-nums w-12 text-right">
                        {typeof item.impact === 'number' ? item.impact.toFixed(1) : '0'} pts
                      </span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              <StabilityGauge
                value={risk?.academicStabilityIndex}
                label="Estabilidad académica"
              />
              <RiskIndicator risk={risk ?? null} />
            </div>

            <div className="mt-6">
              <InsightsBlock
                insights={{ ...insights, insights: mergedInsights }}
                aiSummary={analyticsSummaryLoading ? undefined : aiSummary || undefined}
                isLoadingAi={analyticsSummaryLoading}
              />
              <div className="mt-4 flex justify-end">
                <Button
                  variant="outline"
                  className="rounded-xl border-white/30 bg-white/5 text-white hover:bg-white/10"
                  type="button"
                >
                  Crear plan de intervención
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
