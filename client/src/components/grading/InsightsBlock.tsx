import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Lightbulb, Loader2 } from 'lucide-react';
import type { InsightsResponse } from '@/hooks/useCourseGrading';

interface InsightsBlockProps {
  insights: InsightsResponse;
  aiSummary?: string;
  isLoadingAi?: boolean;
}

export function InsightsBlock({ insights, aiSummary, isLoadingAi }: InsightsBlockProps) {
  const list = insights.insights ?? [];
  const hasAi = Boolean(aiSummary?.trim());
  const hasBullets = list.length > 0;

  return (
    <Card className="bg-white/5 border-white/10 backdrop-blur-md rounded-2xl">
      <CardHeader>
        <CardTitle className="text-white text-base font-['Poppins'] flex items-center gap-2">
          <Lightbulb className="w-5 h-5 text-[#ffd700]" />
          Resumen e insights
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoadingAi && (
          <div className="flex items-center gap-2 text-white/60 text-sm mb-3">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Generando análisis con IA...</span>
          </div>
        )}
        {hasAi && (
          <p className="text-white/90 text-sm leading-relaxed mb-4">{aiSummary}</p>
        )}
        {hasBullets && (
          <ul className="space-y-2 text-sm text-white/90">
            {list.map((item, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-[#ffd700]">•</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        )}
        {!isLoadingAi && !hasAi && !hasBullets && (
          <p className="text-white/50 text-sm">No hay insights disponibles aún. Las notas del estudiante se analizarán con IA al cargar.</p>
        )}
      </CardContent>
    </Card>
  );
}
