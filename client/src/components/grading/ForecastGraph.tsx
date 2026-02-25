import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { PerformanceForecastResponse } from '@/hooks/useCourseGrading';

interface ForecastGraphProps {
  forecast: PerformanceForecastResponse | null;
  snapshotAverage?: number;
}

export function ForecastGraph({ forecast, snapshotAverage }: ForecastGraphProps) {
  if (!forecast) {
    return (
      <Card className="bg-white/5 border-white/10 backdrop-blur-md rounded-2xl">
        <CardHeader>
          <CardTitle className="text-white text-base">Proyección final</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-white/50 text-sm">Sin datos de pronóstico aún.</p>
        </CardContent>
      </Card>
    );
  }

  const { projectedFinalGrade, confidenceInterval } = forecast;
  const low = confidenceInterval?.low ?? projectedFinalGrade - 5;
  const high = confidenceInterval?.high ?? projectedFinalGrade + 5;
  const range = Math.max(1, high - low);
  const widthPct = (v: number) => Math.max(0, Math.min(100, ((v - (low - 2)) / (range + 4)) * 100));

  return (
    <Card className="bg-white/5 border-white/10 backdrop-blur-md rounded-2xl">
      <CardHeader>
        <CardTitle className="text-white text-base font-['Poppins']">
          Proyección final
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-3xl font-bold text-[#00c8ff] tabular-nums">
          {projectedFinalGrade.toFixed(1)}
          <span className="text-lg font-normal text-white/60 ml-1">/ 100</span>
        </div>
        {snapshotAverage != null && (
          <p className="text-white/60 text-sm">
            Promedio actual: <span className="text-white font-medium">{snapshotAverage.toFixed(1)}</span>
          </p>
        )}
        <div className="space-y-2">
          <p className="text-white/60 text-xs">Intervalo de confianza</p>
          <div className="relative h-3 bg-white/10 rounded-full overflow-hidden">
            <div
              className="absolute h-full bg-[#1e3cff]/50 rounded-full"
              style={{
                left: `${widthPct(low)}%`,
                width: `${widthPct(high) - widthPct(low)}%`,
              }}
            />
            <div
              className="absolute top-0 w-1 h-full bg-[#00c8ff] rounded-full"
              style={{ left: `${widthPct(projectedFinalGrade)}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-white/50">
            <span>{low.toFixed(0)}</span>
            <span>{high.toFixed(0)}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
