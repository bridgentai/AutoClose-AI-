import { useMemo, useState } from 'react';
import { useLocation } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useAuth } from '@/lib/authContext';
import { apiRequest } from '@/lib/queryClient';
import { DirectivoGuard, useDirectivoSection } from '@/components/directivo-guard';
import { Breadcrumb } from '@/components/Breadcrumb';
import { resolveSectionTheme, useSectionThemeApplier } from '@/hooks/useSectionTheme';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Lightbulb, Loader2, SlidersHorizontal } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface NotasAnaliticaResponse {
  sectionName: string | null;
  promedioSeccion: number | null;
  cursos: Array<{
    grupoId: string;
    grupo: string;
    promedioGeneral: number | null;
    estudiantes: number;
    enRiesgo: number;
    enAlerta: number;
    alDia: number;
  }>;
  totales: {
    enRiesgo: number;
    enAlerta: number;
    alDia: number;
    estudiantes: number;
  };
}

function analyticsGradeText(n: number | null | undefined): string {
  if (n == null) return 'text-white/40';
  if (n < 65) return 'text-red-400';
  if (n < 75) return 'text-yellow-400';
  return 'text-emerald-400';
}

function courseInitials(name: string): string {
  const t = name.replace(/\s+/g, ' ').trim();
  if (!t) return '??';
  const parts = t.split(' ');
  if (parts.length >= 2) {
    return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase().slice(0, 2);
  }
  return t.slice(0, 2).toUpperCase();
}

function courseStatusLabel(p: number | null): { label: string; className: string } {
  if (p == null) return { label: 'Sin datos', className: 'bg-white/10 text-white/50 border-white/20' };
  if (p < 65) return { label: 'Riesgo', className: 'bg-red-500/10 text-red-400 border-red-500/20' };
  if (p < 75) return { label: 'Alerta', className: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' };
  return { label: 'Al día', className: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' };
}

function riskBandFromPromedio(p: number | null): string {
  if (p == null) return '—';
  if (p < 65) return 'Alto';
  if (p < 75) return 'Medio';
  return 'Bajo';
}

function NotasAnaliticaContent() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const mySection = useDirectivoSection();
  const theme = resolveSectionTheme(mySection?.nombre);
  useSectionThemeApplier(theme);

  const [sortKey, setSortKey] = useState<'nombre' | 'promedio_desc' | 'promedio_asc' | 'riesgo'>('nombre');
  const [filterKey, setFilterKey] = useState<'todos' | 'con_riesgo' | 'alerta'>('todos');

  const { data, isLoading } = useQuery<NotasAnaliticaResponse>({
    queryKey: ['reports/section/notas-analitica', user?.colegioId, user?.id],
    queryFn: () => apiRequest('GET', '/api/reports/section/notas-analitica'),
    enabled: !!user?.colegioId && user?.rol === 'directivo',
    staleTime: 60_000,
  });

  const insightsMutation = useMutation({
    mutationFn: () =>
      apiRequest<{ summary: string }>('GET', '/api/reports/section/notas-analitica/insights'),
  });

  const insightsSummary = insightsMutation.data?.summary;
  const loadingInsights = insightsMutation.isPending;

  const sectionTitle = data?.sectionName ?? mySection?.nombre ?? 'Mi sección';

  const filteredSorted = useMemo(() => {
    let list = [...(data?.cursos ?? [])];
    if (filterKey === 'con_riesgo') list = list.filter((c) => c.enRiesgo > 0);
    if (filterKey === 'alerta') list = list.filter((c) => c.enAlerta > 0 || (c.promedioGeneral != null && c.promedioGeneral >= 65 && c.promedioGeneral < 75));

    list.sort((a, b) => {
      if (sortKey === 'nombre') return a.grupo.localeCompare(b.grupo, 'es');
      if (sortKey === 'promedio_desc')
        return (b.promedioGeneral ?? -1) - (a.promedioGeneral ?? -1);
      if (sortKey === 'promedio_asc')
        return (a.promedioGeneral ?? 999) - (b.promedioGeneral ?? 999);
      return b.enRiesgo - a.enRiesgo;
    });
    return list;
  }, [data?.cursos, filterKey, sortKey]);

  const promedioSeccion = data?.promedioSeccion ?? null;
  const tot = data?.totales;

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6">
      <Breadcrumb
        items={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Analítica', href: '/directivo/analitica' },
          { label: 'Análisis de notas' },
        ]}
        className="mb-2"
      />

      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white font-['Poppins'] mb-1">
            Vista analítica · Inteligencia académica
          </h1>
          <p className="text-white/60 text-sm">
            Sección {sectionTitle} · Promedios 0–100 (metodología jerárquica institucional)
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4 text-white/40 shrink-0" />
            <Select value={sortKey} onValueChange={(v) => setSortKey(v as typeof sortKey)}>
              <SelectTrigger className="w-[200px] bg-white/5 border-white/10 text-white text-sm">
                <SelectValue placeholder="Orden" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="nombre">Orden: nombre del curso</SelectItem>
                <SelectItem value="promedio_desc">Orden: mayor promedio</SelectItem>
                <SelectItem value="promedio_asc">Orden: menor promedio</SelectItem>
                <SelectItem value="riesgo">Orden: más estudiantes en riesgo</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Select value={filterKey} onValueChange={(v) => setFilterKey(v as typeof filterKey)}>
            <SelectTrigger className="w-[200px] bg-white/5 border-white/10 text-white text-sm">
              <SelectValue placeholder="Filtro" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos los cursos</SelectItem>
              <SelectItem value="con_riesgo">Con estudiantes en riesgo</SelectItem>
              <SelectItem value="alerta">Alerta o promedio curso 65–74</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </header>

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-28 bg-white/10 rounded-2xl" />
          <Skeleton className="h-64 bg-white/10 rounded-2xl" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="panel-grades rounded-2xl p-4">
              <p className="text-xs uppercase tracking-wider text-white/50 mb-1">Promedio sección</p>
              <p className={`text-3xl font-bold font-['Poppins'] tabular-nums leading-none ${analyticsGradeText(promedioSeccion)}`}>
                {promedioSeccion != null ? promedioSeccion.toFixed(1) : '—'}
              </p>
              <p className="text-xs text-white/50 mt-2">{tot?.estudiantes ?? 0} estudiantes matriculados</p>
            </div>
            <div className="panel-grades rounded-2xl p-4">
              <p className="text-xs uppercase tracking-wider text-white/50 mb-1">En riesgo</p>
              <p className="text-3xl font-bold text-red-400 tabular-nums leading-none">{tot?.enRiesgo ?? 0}</p>
              <p className="text-xs text-white/50 mt-2">Promedio holístico &lt; 65</p>
            </div>
            <div className="panel-grades rounded-2xl p-4">
              <p className="text-xs uppercase tracking-wider text-white/50 mb-1">En alerta</p>
              <p className="text-3xl font-bold text-yellow-400 tabular-nums leading-none">{tot?.enAlerta ?? 0}</p>
              <p className="text-xs text-white/50 mt-2">Entre 65 y 74</p>
            </div>
            <div className="panel-grades rounded-2xl p-4">
              <p className="text-xs uppercase tracking-wider text-white/50 mb-1">Al día</p>
              <p className="text-3xl font-bold text-emerald-400 tabular-nums leading-none">{tot?.alDia ?? 0}</p>
              <p className="text-xs text-white/50 mt-2">Promedio holístico ≥ 75</p>
            </div>
          </div>

          <Card className="bg-white/5 border-white/10 backdrop-blur-md rounded-2xl">
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <Lightbulb className="w-4 h-4 text-[var(--section-accent,#ffd700)] shrink-0" />
                <span className="text-sm font-semibold text-white/85">Análisis IA · Directivo</span>
                {loadingInsights && <Loader2 className="w-4 h-4 animate-spin text-white/40" />}
              </div>
              {insightsSummary ? (
                <p className="text-sm text-white/70 leading-relaxed whitespace-pre-wrap">{insightsSummary}</p>
              ) : !loadingInsights ? (
                <p className="text-sm text-white/45">
                  Pulsa el botón para generar un informe con IA (requiere datos de cursos y OPENAI_API_KEY). No se llama
                  automáticamente al cargar la página.
                </p>
              ) : (
                <p className="text-sm text-white/45">Generando informe…</p>
              )}
              <Button
                variant="outline"
                size="sm"
                className="mt-4 border-white/20 text-white/80 hover:bg-white/10"
                disabled={loadingInsights || !data?.cursos?.length}
                onClick={() => {
                  insightsMutation.mutate();
                }}
              >
                {insightsSummary ? 'Regenerar informe IA' : 'Generar informe IA'}
              </Button>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredSorted.map((c) => {
              const st = courseStatusLabel(c.promedioGeneral);
              const withGrades = c.enRiesgo + c.enAlerta + c.alDia;
              const entregaPct =
                c.estudiantes > 0 && withGrades > 0
                  ? Math.round((withGrades / c.estudiantes) * 100)
                  : null;
              const borderColor =
                c.promedioGeneral != null && c.promedioGeneral < 65
                  ? 'rgba(239,68,68,0.65)'
                  : c.promedioGeneral != null && c.promedioGeneral < 75
                    ? 'rgba(234,179,8,0.65)'
                    : c.promedioGeneral != null
                      ? 'rgba(52,211,153,0.65)'
                      : 'rgba(255,255,255,0.12)';

              return (
                <div
                  key={c.grupoId}
                  role="button"
                  tabIndex={0}
                  className="panel-grades rounded-2xl p-4 cursor-pointer hover:border-white/25 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[var(--section-primary,#2563eb)]"
                  style={{ borderLeft: `3px solid ${borderColor}` }}
                  onClick={() => setLocation(`/course/${c.grupoId}/analytics`)}
                  onKeyDown={(ev) => {
                    if (ev.key === 'Enter' || ev.key === ' ') {
                      ev.preventDefault();
                      setLocation(`/course/${c.grupoId}/analytics`);
                    }
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 bg-[var(--section-primary,#2563eb)]/25 text-[var(--section-accent,#93C5FD)] border border-white/10">
                      {courseInitials(c.grupo)}
                    </div>
                    <span className="text-sm font-medium text-[#E2E8F0] flex-1 min-w-0 truncate">
                      Curso {c.grupo}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full border shrink-0 ${st.className}`}>
                      {st.label}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 border-t border-white/[0.06] mt-3 pt-3">
                    <div className="text-center">
                      <p className={`text-base font-semibold tabular-nums ${analyticsGradeText(c.promedioGeneral)}`}>
                        {c.promedioGeneral != null ? c.promedioGeneral.toFixed(1) : '—'}
                      </p>
                      <p className="text-[11px] text-white/50 mt-0.5">Promedio</p>
                    </div>
                    <div className="text-center">
                      <p className="text-base font-semibold text-white/75 tabular-nums">
                        {entregaPct != null ? `${entregaPct}%` : '—'}
                      </p>
                      <p className="text-[11px] text-white/50 mt-0.5">Con notas</p>
                    </div>
                    <div className="text-center">
                      <p className="text-base font-semibold text-white/75 tabular-nums">
                        {riskBandFromPromedio(c.promedioGeneral)}
                      </p>
                      <p className="text-[11px] text-white/50 mt-0.5">Riesgo</p>
                    </div>
                  </div>
                  {c.enRiesgo > 0 && (
                    <p className="mt-2 text-[11px] px-2 py-1 rounded-md bg-red-500/[0.08] text-red-400 border border-red-500/20">
                      {c.enRiesgo} estudiante{c.enRiesgo !== 1 ? 's' : ''} con promedio holístico bajo
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          {filteredSorted.length === 0 && (
            <p className="text-center text-white/45 py-12 text-sm">No hay cursos que coincidan con el filtro.</p>
          )}
        </>
      )}
    </div>
  );
}

export default function DirectivoNotasAnaliticaPage() {
  return (
    <DirectivoGuard strictDirectivoOnly>
      <NotasAnaliticaContent />
    </DirectivoGuard>
  );
}
