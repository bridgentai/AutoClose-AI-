import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface StabilityGaugeProps {
  value?: number;
  label?: string;
}

export function StabilityGauge({
  value = 0,
  label = 'Índice de estabilidad académica',
}: StabilityGaugeProps) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  const color =
    pct >= 70 ? 'from-emerald-500 to-emerald-400' : pct >= 40 ? 'from-amber-500 to-amber-400' : 'from-red-500 to-red-400';

  return (
    <Card className="bg-white/5 border-white/10 backdrop-blur-md rounded-2xl">
      <CardHeader>
        <CardTitle className="text-white text-base font-['Poppins']">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-4">
          <div className="relative w-24 h-24 flex-shrink-0">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
              <path
                className="text-white/10 stroke-[3]"
                stroke="currentColor"
                fill="none"
                strokeDasharray="100"
                d="M18 2.5 a 15.5 15.5 0 0 1 0 31 a 15.5 15.5 0 0 1 0 -31"
              />
              <path
                className={`stroke-[3] fill-none transition-all ${color}`}
                stroke="currentColor"
                strokeDasharray="100"
                strokeDashoffset={100 - pct}
                strokeLinecap="round"
                d="M18 2.5 a 15.5 15.5 0 0 1 0 31 a 15.5 15.5 0 0 1 0 -31"
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-lg font-bold text-white">
              {value != null ? (value * 100).toFixed(0) : '—'}
            </span>
          </div>
          <p className="text-white/70 text-sm">
            {pct >= 70
              ? 'Rendimiento estable'
              : pct >= 40
                ? 'Estabilidad moderada'
                : 'Requiere atención'}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
