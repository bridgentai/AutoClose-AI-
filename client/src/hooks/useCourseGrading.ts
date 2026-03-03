import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

export interface GradingCategory {
  _id: string;
  nombre: string;
  weight: number;
  orden: number;
  evaluationType: string;
  riskImpactMultiplier: number;
}

export interface GradingSchemaResponse {
  schema: { _id: string; courseId: string; version: number; isActive: boolean } | null;
  categories: GradingCategory[];
}

export interface PerformanceSnapshotResponse {
  _id: string;
  studentId: string;
  courseId: string;
  at: string;
  weightedFinalAverage: number;
  categoryAverages: Record<string, number>;
  categoryImpacts: Record<string, number>;
  consistencyIndex?: number;
  trendDirection?: 'up' | 'down' | 'stable';
}

export interface PerformanceForecastResponse {
  _id: string;
  projectedFinalGrade: number;
  confidenceInterval: { low: number; high: number };
  riskProbabilityPercent?: number;
  method?: string;
}

export interface RiskAssessmentResponse {
  _id: string;
  level: 'low' | 'medium' | 'high';
  factors: string[];
  academicStabilityIndex?: number;
  recoveryPotentialScore?: number;
}

export interface InsightsResponse {
  insights: string[];
  academicStabilityIndex?: number;
  recoveryPotentialScore?: number;
}

export interface AnalyticsSummaryResponse {
  weightedAverage: number | null;
  byCategory: Array<{ categoryName: string; percentage: number; average: number; count: number }>;
  snapshot: unknown;
  forecast: unknown;
  risk: unknown;
  aiSummary: string;
  insights: string[];
}

export function useGradingSchema(courseId: string | undefined) {
  return useQuery<GradingSchemaResponse>({
    queryKey: ['grading-schema', courseId],
    queryFn: () => apiRequest('GET', `/api/courses/${courseId}/grading-schema`),
    enabled: Boolean(courseId),
  });
}

export function useSnapshot(courseId: string | undefined, studentId: string | undefined) {
  return useQuery<PerformanceSnapshotResponse[]>({
    queryKey: ['snapshots', courseId, studentId],
    queryFn: () =>
      apiRequest(
        'GET',
        `/api/courses/${courseId}/snapshots${studentId ? `?studentId=${encodeURIComponent(studentId)}` : ''}`
      ),
    enabled: Boolean(courseId),
  });
}

export function useForecast(courseId: string | undefined, studentId: string | undefined) {
  return useQuery<PerformanceForecastResponse | null>({
    queryKey: ['forecast', courseId, studentId],
    queryFn: () =>
      apiRequest(
        'GET',
        `/api/courses/${courseId}/forecast?studentId=${encodeURIComponent(studentId!)}`
      ),
    enabled: Boolean(courseId) && Boolean(studentId),
  });
}

export function useRisk(courseId: string | undefined, studentId: string | undefined) {
  return useQuery<RiskAssessmentResponse | null>({
    queryKey: ['risk', courseId, studentId],
    queryFn: () =>
      apiRequest(
        'GET',
        `/api/courses/${courseId}/risk?studentId=${encodeURIComponent(studentId!)}`
      ),
    enabled: Boolean(courseId) && Boolean(studentId),
  });
}

export function useInsights(courseId: string | undefined, studentId: string | undefined) {
  return useQuery<InsightsResponse>({
    queryKey: ['insights', courseId, studentId],
    queryFn: () =>
      apiRequest(
        'GET',
        `/api/courses/${courseId}/insights?studentId=${encodeURIComponent(studentId!)}`
      ),
    enabled: Boolean(courseId) && Boolean(studentId),
  });
}

export function useAnalyticsSummary(courseId: string | undefined, studentId: string | undefined) {
  return useQuery<AnalyticsSummaryResponse>({
    queryKey: ['analytics-summary', courseId, studentId],
    queryFn: () =>
      apiRequest(
        'GET',
        `/api/courses/${courseId}/analytics-summary?studentId=${encodeURIComponent(studentId!)}`
      ),
    enabled: Boolean(courseId) && Boolean(studentId),
    staleTime: 60 * 1000,
  });
}

export function useCourseGrading(courseId: string | undefined, studentId: string | undefined) {
  const schema = useGradingSchema(courseId);
  const snapshots = useSnapshot(courseId, studentId);
  const forecast = useForecast(courseId, studentId);
  const risk = useRisk(courseId, studentId);
  const insights = useInsights(courseId, studentId);

  const latestSnapshot =
    snapshots.data && snapshots.data.length > 0 ? snapshots.data[0] : null;

  return {
    schema,
    categories: schema.data?.categories ?? [],
    snapshot: latestSnapshot,
    forecast: forecast.data ?? null,
    risk: risk.data ?? null,
    insights: insights.data ?? { insights: [] },
    isLoading:
      schema.isLoading ||
      snapshots.isLoading ||
      forecast.isLoading ||
      risk.isLoading ||
      insights.isLoading,
    refetch: () => {
      schema.refetch();
      snapshots.refetch();
      forecast.refetch();
      risk.refetch();
      insights.refetch();
    },
  };
}

export function useSubmitGrade() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: {
      assignmentId: string;
      studentId: string;
      score: number;
      maxScore?: number;
    }) =>
      apiRequest('POST', '/api/grade-events', {
        assignmentId: params.assignmentId,
        studentId: params.studentId,
        score: params.score,
        maxScore: params.maxScore,
      }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['snapshots'] });
      queryClient.invalidateQueries({ queryKey: ['forecast'] });
      queryClient.invalidateQueries({ queryKey: ['risk'] });
      queryClient.invalidateQueries({ queryKey: ['insights'] });
      queryClient.invalidateQueries({ queryKey: ['gradeTableAssignments'] });
      queryClient.invalidateQueries({ queryKey: ['courseAssignments'] });
    },
  });
}
