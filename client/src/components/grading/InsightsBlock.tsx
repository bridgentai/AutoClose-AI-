import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Lightbulb, Loader2, Star } from 'lucide-react';
import type { InsightsResponse } from '@/hooks/useCourseGrading';

interface InsightsBlockProps {
  insights: InsightsResponse;
  aiSummary?: string;
  isLoadingAi?: boolean;
  title?: string;
  emptyText?: string;
  insightStyle?: 'bullets' | 'pills';
}

export function InsightsBlock({
  insights,
  aiSummary,
  isLoadingAi,
  title = 'Resumen e insights',
  emptyText = 'No hay insights disponibles aún. Las notas del estudiante se analizarán con IA al cargar.',
  insightStyle = 'bullets',
}: InsightsBlockProps) {
  const list = insights.insights ?? [];
  const hasAi = Boolean(aiSummary?.trim());
  const hasBullets = list.length > 0;
  const isKiwi = title === 'Análisis de Kiwi';

  return (
    <Card className="bg-white/5 border-white/10 backdrop-blur-md rounded-2xl">
      <CardHeader>
        <CardTitle className="text-white text-base font-['Poppins'] flex items-center gap-2">
          {isKiwi ? (
            <Star className="w-5 h-5" style={{ color: '#ffd700' }} />
          ) : (
            <Lightbulb className="w-5 h-5 text-[#ffd700]" />
          )}
          {title}
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
          <p
            style={{ fontSize: 14, lineHeight: 1.7, color: 'rgba(255,255,255,0.85)' }}
            className="mb-4"
          >
            {aiSummary}
          </p>
        )}
        {hasBullets && insightStyle === 'pills' && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {list.map((item, i) => (
              <span
                key={i}
                style={{
                  background: 'rgba(239,68,68,0.10)',
                  border: '1px solid rgba(239,68,68,0.25)',
                  borderRadius: 6,
                  padding: '4px 10px',
                  fontSize: 12,
                  color: '#fca5a5',
                }}
              >
                {item}
              </span>
            ))}
          </div>
        )}
        {hasBullets && insightStyle === 'bullets' && (
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
          <p className="text-white/50 text-sm">{emptyText}</p>
        )}
      </CardContent>
    </Card>
  );
}
