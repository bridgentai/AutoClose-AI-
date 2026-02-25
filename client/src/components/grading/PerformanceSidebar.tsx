import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Minus, AlertTriangle } from 'lucide-react';
import type { PerformanceSnapshotResponse } from '@/hooks/useCourseGrading';
import type { PerformanceForecastResponse } from '@/hooks/useCourseGrading';
import type { RiskAssessmentResponse } from '@/hooks/useCourseGrading';
import type { InsightsResponse } from '@/hooks/useCourseGrading';

interface PerformanceSidebarProps {
  snapshot: PerformanceSnapshotResponse | null;
  forecast: PerformanceForecastResponse | null;
  risk: RiskAssessmentResponse | null;
  insights: InsightsResponse;
  isLoading?: boolean;
}

export function PerformanceSidebar({
  snapshot,
  forecast,
  risk,
  insights,
  isLoading,
}: PerformanceSidebarProps) {
  const trendIcon =
    snapshot?.trendDirection === 'up'
      ? TrendingUp
      : snapshot?.trendDirection === 'down'
        ? TrendingDown
        : Minus;
  const TrendIcon = trendIcon;
  const riskColor =
    risk?.level === 'high'
      ? 'text-red-400'
      : risk?.level === 'medium'
        ? 'text-amber-400'
        : 'text-emerald-400';

  if (isLoading) {
    return (
      <Card className="bg-white/5 border-white/10 backdrop-blur-md rounded-2xl w-72 flex-shrink-0">
        <CardHeader className="pb-2">
          <CardTitle className="text-white/90 text-sm font-medium">Rendimiento</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-white/60 text-sm animate-pulse">
          <div className="h-8 bg-white/10 rounded" />
          <div className="h-6 bg-white/10 rounded w-3/4" />
          <div className="h-6 bg-white/10 rounded w-1/2" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-white/5 border-white/10 backdrop-blur-md rounded-2xl w-72 flex-shrink-0 shadow-xl">
      <CardHeader className="pb-2">
        <CardTitle className="text-white text-base font-semibold font-['Poppins']">
          Resumen de rendimiento
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-white/70 text-sm">Promedio ponderado</span>
          <span className="text-2xl font-bold text-white tabular-nums">
            {snapshot?.weightedFinalAverage != null
              ? snapshot.weightedFinalAverage.toFixed(1)
              : '—'}
          </span>
        </div>
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-white/70 text-sm">Proyección final</span>
          <span className="text-lg font-semibold text-[#00c8ff] tabular-nums">
            {forecast?.projectedFinalGrade != null
              ? forecast.projectedFinalGrade.toFixed(1)
              : '—'}
          </span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-white/70 text-sm">Riesgo</span>
          <span className={`text-sm font-medium capitalize ${riskColor}`}>
            {risk?.level ?? '—'}
          </span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-white/70 text-sm">Consistencia</span>
          <span className="text-sm text-white tabular-nums">
            {snapshot?.consistencyIndex != null
              ? (snapshot.consistencyIndex * 100).toFixed(0) + '%'
              : '—'}
          </span>
        </div>
        <div className="flex items-center gap-2 pt-1 border-t border-white/10">
          <TrendIcon className="w-4 h-4 text-white/80" />
          <span className="text-white/80 text-sm capitalize">
            {snapshot?.trendDirection ?? 'stable'}
          </span>
        </div>
        {insights.insights && insights.insights.length > 0 && (
          <div className="pt-2 border-t border-white/10">
            <p className="text-white/70 text-xs font-medium mb-2">Insights</p>
            <ul className="space-y-1 text-xs text-white/80">
              {insights.insights.slice(0, 3).map((item, i) => (
                <li key={i} className="flex gap-2">
                  <AlertTriangle className="w-3.5 h-3.5 text-[#ffd700] flex-shrink-0 mt-0.5" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
