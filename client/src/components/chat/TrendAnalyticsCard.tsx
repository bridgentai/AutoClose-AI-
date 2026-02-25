import { TrendingUp } from 'lucide-react';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { LineChart, Line, XAxis, YAxis, CartesianGrid } from 'recharts';
import { cn } from '@/lib/utils';

export interface TrendAnalyticsCardData {
  chartData: { period: string; average: number; count: number }[];
  aiInsights: string;
}

interface TrendAnalyticsCardProps {
  data: TrendAnalyticsCardData;
  className?: string;
}

const chartConfig = {
  average: { label: 'Promedio', color: '#a78bfa' },
  period: { label: 'Periodo' },
};

export function TrendAnalyticsCard({ data, className }: TrendAnalyticsCardProps) {
  const { chartData, aiInsights } = data;
  const displayData = chartData.map((d) => ({
    ...d,
    period: d.period.replace(/-/g, '/').slice(2),
  }));
  const maxVal = Math.max(...chartData.map((d) => d.average), 1);
  const yDomain = maxVal > 10 ? [0, 100] : [0, 5];

  return (
    <Card
      className={cn(
        'chat-structured-card max-w-md w-full',
        'bg-[#0F0F14] border-[#6366f1]/50',
        'hover:border-[#6366f1]/80 hover:shadow-[0_8px_32px_rgba(99,102,241,0.2)]',
        'transition-all duration-300 ease-out',
        'animate-in fade-in slide-in-from-bottom-2 duration-300',
        className
      )}
    >
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2 text-[#a78bfa]">
          <TrendingUp className="h-5 w-5 shrink-0" aria-hidden />
          <span className="text-sm font-medium uppercase tracking-wide">Tendencia de notas</span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {displayData.length > 0 && (
          <ChartContainer config={chartConfig} className="h-[200px] w-full">
            <LineChart data={displayData} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
              <XAxis
                dataKey="period"
                stroke="rgba(255,255,255,0.4)"
                tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 10 }}
              />
              <YAxis
                domain={yDomain as [number, number]}
                stroke="rgba(255,255,255,0.4)"
                tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 10 }}
                width={28}
              />
              <ChartTooltip content={<ChartTooltipContent />} cursor={{ stroke: 'rgba(99,102,241,0.3)' }} />
              <Line
                type="monotone"
                dataKey="average"
                stroke="#a78bfa"
                strokeWidth={2}
                dot={{ r: 3, fill: '#a78bfa' }}
              />
            </LineChart>
          </ChartContainer>
        )}
        {aiInsights && (
          <p className="text-sm text-white/80 leading-relaxed border-t border-white/10 pt-3">
            {aiInsights}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
