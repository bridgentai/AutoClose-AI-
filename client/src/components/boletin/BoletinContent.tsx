"use client";

import { ArrowUp, ArrowDown, Sparkles, TrendingUp } from "lucide-react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChartContainer, ChartTooltipContent } from "@/components/ui/chart";
import type { BoletinData, BoletinLogroDetalle, BoletinMateriaDetalle } from "@/lib/boletin-types";

const SUBJECT_CARD =
  "rounded-xl sm:rounded-2xl border border-white/[0.08] shadow-[0_0_40px_rgba(37,99,235,0.18)] transition-all duration-300 panel-grades";

const chartGradientId = (suffix: string) => `boletin-curve-${suffix}`;

function summarizeLogroNotas(logro: BoletinLogroDetalle) {
  if (logro.notas.length === 0) return "Sin notas registradas";
  return logro.notas.map((nota) => nota.toFixed(1).replace(/\.0$/, "")).join(" · ");
}

function normalizeLegacySubject(m: BoletinMateriaDetalle | (BoletinMateriaDetalle & { categorias?: Array<{ nombre: string; peso: number; promedio: number | null; actividades: number }> })) {
  const legacyCategorias = Array.isArray((m as { categorias?: unknown }).categorias)
    ? ((m as { categorias: Array<{ nombre: string; peso: number; promedio: number | null; actividades: number }> }).categorias ?? [])
    : [];
  const logros = m.logros.length > 0
    ? m.logros
    : legacyCategorias.map((categoria, index) => ({
        id: `${m.groupSubjectId || m.materia}-legacy-${index}`,
        nombre: categoria.nombre,
        peso: categoria.peso,
        promedio: categoria.promedio,
        notas: [],
        actividades: categoria.actividades,
      }));
  return {
    ...m,
    logros,
    analisisIA: m.analisisIA ?? "",
    estado: m.estado ?? (m.promedio != null && m.promedio >= 65 ? "aprobado" : "reprobado"),
    groupSubjectId: m.groupSubjectId ?? m.materia,
  };
}

function getEstadoColor(estado: string) {
  switch (estado) {
    case "aprobado":
      return "bg-[rgba(15,118,110,0.35)] text-[var(--evo-cyan)] border-[rgba(45,212,191,0.35)]";
    case "excelente":
      return "bg-emerald-500/20 text-emerald-400 border-emerald-500/40";
    case "bueno":
      return "bg-blue-500/20 text-blue-400 border-blue-500/40";
    case "en riesgo":
      return "bg-amber-500/20 text-amber-400 border-amber-500/40";
    case "reprobado":
    case "crítico":
      return "bg-red-500/20 text-red-400 border-red-500/40";
    default:
      return "bg-white/10 text-white/70 border-white/20";
  }
}

interface BoletinContentProps {
  data: BoletinData;
  className?: string;
}

function renderIaWithBold(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    const m = part.match(/^\*\*([^*]+)\*\*$/);
    if (m) {
      return (
        <strong key={i} className="font-semibold text-white">
          {m[1]}
        </strong>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

function curveTrendUp(evolucion: { promedio: number }[]): boolean | null {
  if (evolucion.length < 2) return null;
  const a = evolucion[evolucion.length - 2]?.promedio;
  const b = evolucion[evolucion.length - 1]?.promedio;
  if (a == null || b == null) return null;
  return b >= a;
}

function renderSubjectCard(m: BoletinMateriaDetalle) {
  const gradId = chartGradientId(m.groupSubjectId.replace(/[^a-zA-Z0-9]/g, "") || "sub");
  const trendUp = curveTrendUp(m.evolucion);
  const promedioStr =
    m.promedio !== null ? m.promedio.toFixed(1).replace(/\.0$/, "") : "—";

  return (
    <Card key={`${m.groupSubjectId}-${m.materia}`} className={SUBJECT_CARD}>
      <CardHeader className="py-5 px-5 sm:px-6 pb-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2 min-w-0">
            <CardTitle className="text-white text-2xl sm:text-[1.65rem] font-bold font-['Poppins'] leading-tight tracking-tight">
              {m.materia}
            </CardTitle>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-[var(--text-primary)]/70">
              {m.profesor ? <span>Profesor: {m.profesor}</span> : null}
              {m.asistencia !== null ? <span>Asistencia: {m.asistencia}%</span> : null}
            </div>
          </div>
          <div className="flex items-start gap-3 sm:shrink-0">
            <div className="text-right">
              <div className="text-3xl sm:text-4xl font-bold text-white font-['Poppins'] tabular-nums leading-none">
                {promedioStr}
              </div>
              <div className="text-xs text-[var(--text-primary)]/55 mt-1.5">Promedio materia</div>
            </div>
            <Badge
              className={`${getEstadoColor(m.estado)} border px-3 py-1.5 capitalize text-sm font-medium rounded-lg mt-0.5`}
            >
              {m.estado}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-5 pb-6 sm:px-6 pt-0 space-y-5">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-stretch">
          <div className="rounded-xl border border-white/[0.08] bg-[rgba(8,15,35,0.28)] p-4 sm:p-5">
            <h4 className="text-base font-semibold text-white mb-4">Notas por logro</h4>
            {m.logros.length > 0 ? (
              <div className="divide-y divide-white/[0.08]">
                {m.logros.map((logro) => {
                  const hasNotas = logro.notas.length > 0;
                  return (
                    <div key={logro.id} className="py-4 first:pt-0 last:pb-0">
                      <div className="flex items-start justify-between gap-3">
                        <p
                          className={`font-semibold leading-snug pr-2 ${hasNotas ? "text-white" : "text-[var(--text-primary)]/55"}`}
                        >
                          {logro.nombre}
                        </p>
                        <span className="text-base font-semibold text-[var(--evo-cyan)] tabular-nums shrink-0">
                          {logro.promedio !== null ? logro.promedio.toFixed(1).replace(/\.0$/, "") : "—"}
                        </span>
                      </div>
                      <p className="text-sm text-[var(--text-primary)]/60 mt-1">
                        {logro.peso != null ? `Peso ${logro.peso}%` : "Sin peso configurado"}
                      </p>
                      <p className="text-sm text-[var(--text-primary)]/65 mt-2 leading-relaxed">
                        {summarizeLogroNotas(logro)}
                      </p>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-[var(--text-primary)]/60 py-6 text-center">
                No hay logros con notas registradas en esta materia.
              </p>
            )}
          </div>

          <div className="rounded-xl border border-white/[0.08] bg-[rgba(8,15,35,0.28)] p-4 sm:p-5 flex flex-col min-h-[280px]">
            <h4 className="text-base font-semibold text-white mb-3 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[var(--evo-cyan)]" />
              Progreso del promedio
            </h4>
            <div className="relative flex-1 rounded-xl border border-white/[0.08] bg-[rgba(2,6,23,0.45)] p-2 min-h-[220px]">
              {m.evolucion.length > 0 ? (
                <>
                  <div className="absolute top-2 right-2 z-10 flex items-center gap-1.5 rounded-lg border border-white/10 bg-[rgba(15,23,42,0.92)] px-2.5 py-1.5 shadow-lg backdrop-blur-sm">
                    <span className="text-sm font-bold text-white tabular-nums">{promedioStr}</span>
                    {trendUp === true ? (
                      <ArrowUp className="w-4 h-4 text-[var(--evo-cyan)]" aria-hidden />
                    ) : trendUp === false ? (
                      <ArrowDown className="w-4 h-4 text-[var(--evo-warning)]" aria-hidden />
                    ) : null}
                  </div>
                  <div className="h-[240px] w-full pt-8">
                    <ChartContainer
                      config={{ promedio: { label: "Promedio", color: "hsl(var(--primary))" } }}
                      className="h-full w-full"
                    >
                      <ComposedChart data={m.evolucion} margin={{ top: 8, right: 8, bottom: 4, left: -8 }}>
                        <defs>
                          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                            <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                        <XAxis
                          dataKey="fecha"
                          stroke="rgba(255,255,255,0.35)"
                          tick={{ fill: "rgba(226,232,240,0.65)", fontSize: 10 }}
                          tickLine={false}
                          axisLine={{ stroke: "rgba(255,255,255,0.12)" }}
                        />
                        <YAxis
                          domain={[0, 100]}
                          stroke="rgba(255,255,255,0.35)"
                          tick={{ fill: "rgba(226,232,240,0.65)", fontSize: 10 }}
                          width={32}
                          tickLine={false}
                          axisLine={{ stroke: "rgba(255,255,255,0.12)" }}
                        />
                        <Tooltip content={<ChartTooltipContent />} cursor={{ stroke: "rgba(255,255,255,0.12)" }} />
                        <Area
                          type="monotone"
                          dataKey="promedio"
                          stroke="none"
                          fill={`url(#${gradId})`}
                          fillOpacity={1}
                        />
                        <Line
                          type="monotone"
                          dataKey="promedio"
                          stroke="hsl(var(--primary))"
                          strokeWidth={2.5}
                          dot={{
                            fill: "var(--deep-dark)",
                            stroke: "hsl(var(--primary))",
                            strokeWidth: 2,
                            r: 4,
                          }}
                          activeDot={{ r: 5, fill: "hsl(var(--primary))", stroke: "#fff", strokeWidth: 2 }}
                          name="Promedio"
                        />
                      </ComposedChart>
                    </ChartContainer>
                  </div>
                </>
              ) : (
                <div className="h-[240px] rounded-lg border border-dashed border-white/10 grid place-items-center text-sm text-[var(--text-primary)]/55 text-center px-4">
                  Aún no hay suficientes notas para construir la curva.
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-white/[0.08] bg-[rgba(8,15,35,0.28)] p-4 sm:p-5">
          <div className="flex items-center gap-3 mb-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--primary-blue)]/25 border border-[var(--primary-blue)]/40">
              <Sparkles className="w-4 h-4 text-[var(--evo-cyan)]" />
            </span>
            <h4 className="text-base font-semibold text-white">Análisis IA de la vista analítica</h4>
          </div>
          <div className="rounded-lg border border-white/[0.06] bg-[rgba(2,6,23,0.35)] px-4 py-3.5">
            <p className="text-sm text-[var(--text-primary)]/80 leading-relaxed">
              {m.analisisIA
                ? renderIaWithBold(m.analisisIA)
                : "Aún no hay análisis IA disponible para esta materia."}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function BoletinContent({ data, className = "" }: BoletinContentProps) {
  const { estudiante, grupo, promedioGeneral, estado, resumenIA, mejorMateria, peorMateria } = data;
  const materias = data.materias.map((materia) => normalizeLegacySubject(materia as BoletinMateriaDetalle & { categorias?: Array<{ nombre: string; peso: number; promedio: number | null; actividades: number }> }));

  return (
    <div className={`space-y-6 ${className}`} style={{ color: "#fff" }}>
      <div className={`${SUBJECT_CARD} overflow-hidden`}>
        <div
          className="relative p-6 sm:p-8"
          style={{
            background:
              "linear-gradient(135deg, rgba(59,130,246,0.22) 0%, rgba(15,23,42,0.15) 48%, rgba(2,6,23,0.05) 100%)",
          }}
        >
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
            <div>
              <p className="text-cyan-300/80 uppercase tracking-[0.22em] text-xs mb-3 font-semibold">Evo EduLab</p>
              <h2 className="text-2xl sm:text-3xl font-bold text-white font-['Poppins'] mb-1">{estudiante.nombre}</h2>
              {grupo && (
                <Badge variant="outline" className="border-white/15 text-white/80 bg-white/5 mb-2">
                  {grupo}
                </Badge>
              )}
              <div className="flex flex-wrap gap-2 mt-3">
                {mejorMateria ? (
                  <Badge className="bg-emerald-500/10 text-emerald-300 border border-emerald-400/20">
                    Mejor materia: {mejorMateria.nombre}
                  </Badge>
                ) : null}
                {peorMateria ? (
                  <Badge className="bg-amber-500/10 text-amber-300 border border-amber-400/20">
                    Por reforzar: {peorMateria.nombre}
                  </Badge>
                ) : null}
              </div>
            </div>
            <div className="flex flex-col items-start lg:items-end gap-3">
              <div className="text-left lg:text-right">
                <div className="text-4xl sm:text-5xl font-bold text-white font-['Poppins']">
                  {promedioGeneral !== null ? promedioGeneral.toFixed(1).replace(/\.0$/, "") : "—"}
                </div>
                <div className="text-sm text-white/60">Promedio general</div>
              </div>
              <Badge className={`${getEstadoColor(estado)} border px-3 py-1.5 capitalize`}>{estado}</Badge>
            </div>
          </div>
        </div>
      </div>

      {resumenIA && (
        <Card className={SUBJECT_CARD}>
          <CardHeader className="py-4">
            <CardTitle className="text-white text-base font-['Poppins'] flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-cyan-300" />
              Resumen general
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-white/80 text-sm leading-relaxed">{resumenIA}</p>
          </CardContent>
        </Card>
      )}

      {materias.map((m) => renderSubjectCard(m))}
    </div>
  );
}
