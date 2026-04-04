import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { NavBackButton } from '@/components/nav-back-button';
import { DirectivoGuard, useDirectivoSection } from '@/components/directivo-guard';
import { resolveSectionTheme, useSectionThemeApplier } from '@/hooks/useSectionTheme';
import { apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/lib/authContext';
import { Users, BookOpen, TrendingUp } from 'lucide-react';

const CARD_STYLE = 'bg-white/5 border-white/10 backdrop-blur-md';

interface SectionOverview {
  grupos: number;
  estudiantes: number;
  profesores: number;
  asistenciaPromedio: number | null;
}

interface GradeByGroup {
  grupoId: string;
  grupo: string;
  promedio: number | null;
  totalNotas: number;
  estudiantes: number;
}

interface AtRiskStudent {
  estudianteId: string;
  nombre: string;
  grupo: string;
  promedio: number | null;
  pctAsistencia: number | null;
  riesgo: 'alto' | 'medio' | 'bajo';
}

function getBarColor(promedio: number | null): string {
  if (promedio === null) return '#6b7280';
  if (promedio >= 4.0) return 'var(--section-accent, #00C8FF)';
  if (promedio >= 3.0) return '#f59e0b';
  return '#ef4444';
}

function getRiskBadge(riesgo: string) {
  const styles: Record<string, string> = {
    alto: 'bg-red-500/20 text-red-400 border-red-500/40',
    medio: 'bg-amber-500/20 text-amber-400 border-amber-500/40',
    bajo: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40',
  };
  const labels: Record<string, string> = { alto: 'Alto', medio: 'Medio', bajo: 'Bajo' };
  return <Badge className={styles[riesgo] ?? styles.bajo}>{labels[riesgo] ?? riesgo}</Badge>;
}

function AnaliticaContent() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const mySection = useDirectivoSection();
  const theme = resolveSectionTheme(mySection?.nombre);
  useSectionThemeApplier(theme);

  const { data: overview, isLoading: loadingOverview } = useQuery<SectionOverview>({
    queryKey: ['analytics/section/overview', user?.colegioId],
    queryFn: () => apiRequest('GET', '/api/reports/section/overview'),
    enabled: !!user?.colegioId,
    staleTime: 60_000,
  });

  const { data: gradesByGroup = [], isLoading: loadingGrades } = useQuery<GradeByGroup[]>({
    queryKey: ['analytics/section/grades-by-group', user?.colegioId],
    queryFn: () => apiRequest('GET', '/api/reports/section/grades-by-group'),
    enabled: !!user?.colegioId,
    staleTime: 60_000,
  });

  const { data: atRisk = [], isLoading: loadingRisk } = useQuery<AtRiskStudent[]>({
    queryKey: ['analytics/section/at-risk', user?.colegioId],
    queryFn: () => apiRequest('GET', '/api/reports/section/at-risk'),
    enabled: !!user?.colegioId,
    staleTime: 60_000,
  });

  return (
    <div className="p-6 space-y-6">
      <NavBackButton to="/directivo/academia" label="Academia" />
      <h1 className="text-2xl font-bold text-white font-['Poppins']">
        Analítica: {mySection?.nombre ?? 'Mi Sección'}
      </h1>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className={CARD_STYLE}>
          <CardHeader className="pb-1">
            <CardTitle className="text-white/80 text-xs font-medium uppercase tracking-wider flex items-center gap-2">
              <BookOpen className="w-4 h-4" /> Grupos activos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white font-['Poppins']">
              {loadingOverview ? '...' : (overview?.grupos ?? 0)}
            </div>
          </CardContent>
        </Card>

        <Card className={CARD_STYLE}>
          <CardHeader className="pb-1">
            <CardTitle className="text-white/80 text-xs font-medium uppercase tracking-wider flex items-center gap-2">
              <Users className="w-4 h-4" /> Estudiantes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white font-['Poppins']">
              {loadingOverview ? '...' : (overview?.estudiantes ?? 0)}
            </div>
          </CardContent>
        </Card>

        <Card className={CARD_STYLE}>
          <CardHeader className="pb-1">
            <CardTitle className="text-white/80 text-xs font-medium uppercase tracking-wider flex items-center gap-2">
              <TrendingUp className="w-4 h-4" /> Asistencia del mes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white font-['Poppins']">
              {loadingOverview
                ? '...'
                : overview?.asistenciaPromedio != null
                ? `${overview.asistenciaPromedio}%`
                : 'N/A'}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bar Chart - Grades by group */}
      <Card className={CARD_STYLE}>
        <CardHeader>
          <CardTitle className="text-white text-lg">Promedio por curso</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingGrades ? (
            <div className="text-white/50 py-8 text-center">Cargando...</div>
          ) : gradesByGroup.length === 0 ? (
            <div className="text-white/50 py-8 text-center">Sin datos de calificaciones</div>
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(250, gradesByGroup.length * 40)}>
              <BarChart data={gradesByGroup} layout="vertical" margin={{ left: 10, right: 20, top: 5, bottom: 5 }}>
                <XAxis type="number" domain={[0, 5]} tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 12 }} axisLine={false} />
                <YAxis
                  type="category"
                  dataKey="grupo"
                  width={70}
                  tick={{ fill: 'rgba(255,255,255,0.7)', fontSize: 12 }}
                  axisLine={false}
                />
                <Tooltip
                  contentStyle={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }}
                  labelStyle={{ color: '#fff' }}
                  itemStyle={{ color: '#fff' }}
                  formatter={(value: number) => [value?.toFixed(2) ?? 'N/A', 'Promedio']}
                />
                <Bar
                  dataKey="promedio"
                  radius={[0, 6, 6, 0]}
                  cursor="pointer"
                  onClick={(data) => {
                    if (data?.grupoId) setLocation(`/directivo/cursos/${data.grupoId}`);
                  }}
                >
                  {gradesByGroup.map((entry, idx) => (
                    <Cell key={idx} fill={getBarColor(entry.promedio)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* At-Risk Students Table */}
      <Card className={CARD_STYLE}>
        <CardHeader>
          <CardTitle className="text-white text-lg">Estudiantes en riesgo</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingRisk ? (
            <div className="text-white/50 py-8 text-center">Cargando...</div>
          ) : atRisk.length === 0 ? (
            <div className="py-8 text-center">
              <div className="text-2xl mb-2">&#10003;</div>
              <div className="text-white/70">No hay estudiantes en riesgo</div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left p-2 text-white/80 text-sm">Nombre</th>
                    <th className="text-left p-2 text-white/80 text-sm">Curso</th>
                    <th className="text-left p-2 text-white/80 text-sm">Promedio</th>
                    <th className="text-left p-2 text-white/80 text-sm">Asistencia</th>
                    <th className="text-left p-2 text-white/80 text-sm">Riesgo</th>
                  </tr>
                </thead>
                <tbody>
                  {atRisk.map((s) => (
                    <tr
                      key={`${s.estudianteId}-${s.grupo}`}
                      className="border-b border-white/5 hover:bg-white/5 cursor-pointer transition-colors"
                      onClick={() => setLocation(`/directivo/estudiantes`)}
                    >
                      <td className="p-2 text-white text-sm">{s.nombre}</td>
                      <td className="p-2 text-white/70 text-sm">{s.grupo}</td>
                      <td className="p-2 text-white/70 text-sm">{s.promedio?.toFixed(1) ?? 'N/A'}</td>
                      <td className="p-2 text-white/70 text-sm">{s.pctAsistencia != null ? `${s.pctAsistencia}%` : 'N/A'}</td>
                      <td className="p-2">{getRiskBadge(s.riesgo)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function DirectivoAnaliticaPage() {
  return (
    <DirectivoGuard strictDirectivoOnly>
      <AnaliticaContent />
    </DirectivoGuard>
  );
}
