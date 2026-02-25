import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Lightbulb } from 'lucide-react';
import type { InsightsResponse } from '@/hooks/useCourseGrading';

interface InsightsBlockProps {
  insights: InsightsResponse;
}

export function InsightsBlock({ insights }: InsightsBlockProps) {
  const list = insights.insights ?? [];
  if (list.length === 0) {
    return (
      <Card className="bg-white/5 border-white/10 backdrop-blur-md rounded-2xl">
        <CardHeader>
          <CardTitle className="text-white text-base font-['Poppins'] flex items-center gap-2">
            <Lightbulb className="w-5 h-5 text-[#ffd700]" />
            Resumen e insights
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-white/50 text-sm">No hay insights disponibles aún.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-white/5 border-white/10 backdrop-blur-md rounded-2xl">
      <CardHeader>
        <CardTitle className="text-white text-base font-['Poppins'] flex items-center gap-2">
          <Lightbulb className="w-5 h-5 text-[#ffd700]" />
          Resumen e insights
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2 text-sm text-white/90">
          {list.map((item, i) => (
            <li key={i} className="flex gap-2">
              <span className="text-[#ffd700]">•</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
