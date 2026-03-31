import { useMemo } from 'react';
import {
  Bar,
  BarChart,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const BAR_COLORS = ['#3B82F6', '#00C8FF', '#1D4ED8', '#38BDF8', '#60A5FA', '#FFD700'];

export type AnalyticsCategoryRow = {
  categoryName: string;
  percentage: number;
  average: number;
  count: number;
};

function truncateLabel(value: unknown, max = 24): string {
  const s = String(value ?? '');
  if (s.length <= max) return s;
  return `${s.slice(0, Math.max(0, max - 1))}…`;
}

interface AnalyticsCategoryChartProps {
  byCategory: AnalyticsCategoryRow[] | undefined;
  /** Título de la tarjeta (ej. logros vs categorías según contexto) */
  title?: string;
}

/**
 * Barras horizontales: promedio por categoría de calificación (logros del esquema).
 * Misma idea visual que la vista analítica del profesor, con datos del summary.
 */
export function AnalyticsCategoryChart({
  byCategory,
  title = 'Desempeño por categoría (logros)',
}: AnalyticsCategoryChartProps) {
  const data = useMemo(() => {
    if (!byCategory?.length) return [];
    return byCategory.map((c) => ({
      categoria: c.categoryName,
      promedio: Math.round(c.average * 10) / 10,
      peso: c.percentage,
      impacto: Math.round(c.average * (c.percentage / 100) * 10) / 10,
      notas: c.count,
    }));
  }, [byCategory]);

  const height = useMemo(() => Math.min(520, Math.max(200, data.length * 44)), [data.length]);

  if (!data.length) {
    return (
      <Card className="panel-grades border-white/10 rounded-2xl mb-6">
        <CardHeader>
          <CardTitle className="text-white font-['Poppins'] text-lg">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-white/50 text-sm">
            Aún no hay datos por categoría. Aparecerá cuando haya calificaciones asociadas a logros.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="panel-grades border-white/10 rounded-2xl mb-6">
      <CardHeader>
        <CardTitle className="text-white font-['Poppins'] text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="w-full" style={{ height }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              layout="vertical"
              margin={{ top: 12, right: 36, bottom: 12, left: 8 }}
            >
              <XAxis
                type="number"
                domain={[0, 100]}
                tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 11 }}
                stroke="rgba(255,255,255,0.15)"
              />
              <YAxis
                type="category"
                dataKey="categoria"
                width={188}
                tick={{ fill: 'rgba(255,255,255,0.88)', fontSize: 12 }}
                tickFormatter={(v) => truncateLabel(v, 26)}
                axisLine={false}
                tickLine={false}
                interval={0}
              />
              <Tooltip
                contentStyle={{
                  background:
                    'linear-gradient(145deg, rgba(30, 58, 138, 0.35), rgba(15, 23, 42, 0.72))',
                  border: '1px solid rgba(255,255,255,0.10)',
                  borderRadius: 14,
                  backdropFilter: 'blur(18px)',
                }}
                labelStyle={{ color: 'rgba(255,255,255,0.92)', fontSize: 13, fontWeight: 600 }}
                formatter={(value: number, _name: string, item: { payload?: { peso?: number; impacto?: number; notas?: number } }) => {
                  const p = item?.payload;
                  return [
                    `Promedio ${Number(value).toFixed(1)}/100 · Peso ${p?.peso ?? 0}% · Aporte ~${(p?.impacto ?? 0).toFixed(1)} pts · ${p?.notas ?? 0} nota(s)`,
                    'Categoría',
                  ];
                }}
              />
              <Bar dataKey="promedio" radius={[6, 10, 10, 6]} maxBarSize={26} barSize={22}>
                {data.map((_, i) => (
                  <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />
                ))}
                <LabelList
                  dataKey="promedio"
                  position="right"
                  formatter={(v: number) => `${Number(v).toFixed(1)}`}
                  style={{ fill: 'rgba(255,255,255,0.92)', fontSize: 12, fontWeight: 600 }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
