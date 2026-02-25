import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle } from 'lucide-react';
import type { RiskAssessmentResponse } from '@/hooks/useCourseGrading';

interface RiskIndicatorProps {
  risk: RiskAssessmentResponse | null;
}

export function RiskIndicator({ risk }: RiskIndicatorProps) {
  if (!risk) {
    return (
      <Card className="bg-white/5 border-white/10 backdrop-blur-md rounded-2xl">
        <CardHeader>
          <CardTitle className="text-white text-base">Riesgo académico</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-white/50 text-sm">Sin evaluación de riesgo aún.</p>
        </CardContent>
      </Card>
    );
  }

  const color =
    risk.level === 'high'
      ? 'text-red-400 border-red-500/40 bg-red-500/10'
      : risk.level === 'medium'
        ? 'text-amber-400 border-amber-500/40 bg-amber-500/10'
        : 'text-emerald-400 border-emerald-500/40 bg-emerald-500/10';

  return (
    <Card className="bg-white/5 border-white/10 backdrop-blur-md rounded-2xl">
      <CardHeader>
        <CardTitle className="text-white text-base font-['Poppins'] flex items-center gap-2">
          <AlertTriangle className="w-5 h-5" />
          Riesgo académico
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className={`inline-flex items-center px-3 py-1 rounded-full border capitalize font-medium ${color}`}>
          {risk.level}
        </div>
        {risk.factors && risk.factors.length > 0 && (
          <ul className="text-sm text-white/80 space-y-1">
            {risk.factors.map((f, i) => (
              <li key={i}>• {f}</li>
            ))}
          </ul>
        )}
        {risk.recoveryPotentialScore != null && (
          <p className="text-white/60 text-xs">
            Potencial de recuperación: {(risk.recoveryPotentialScore * 100).toFixed(0)}%
          </p>
        )}
      </CardContent>
    </Card>
  );
}
