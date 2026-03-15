"use client";

import { Sparkles, TrendingUp } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChartContainer, ChartTooltipContent } from "@/components/ui/chart";

const CARD = "#171721";
const BORDER = "#232334";
const ACCENT_LIGHT = "#A855F7";
const CARD_STYLE =
  "rounded-2xl border shadow-lg transition-all duration-300";
const cardInner = { backgroundColor: CARD, borderColor: BORDER };

export interface CategoriaDetalle {
  nombre: string;
  peso: number;
  promedio: number | null;
  actividades: number;
}

export interface MateriaData {
  materia: string;
  profesor: string;
  promedio: number | null;
  categorias: CategoriaDetalle[];
  asistencia: number | null;
  evolucion: { fecha: string; promedio: number }[];
}

export interface BoletinData {
  estudiante: { id: string; nombre: string; email: string };
  grupo: string;
  promedioGeneral: number | null;
  estado: string;
  materias: MateriaData[];
  resumenIA: string;
}

function getEstadoColor(estado: string) {
  switch (estado) {
    case "excelente":
      return "bg-emerald-500/20 text-emerald-400 border-emerald-500/40";
    case "bueno":
      return "bg-blue-500/20 text-blue-400 border-blue-500/40";
    case "en riesgo":
      return "bg-amber-500/20 text-amber-400 border-amber-500/40";
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

export function BoletinContent({ data, className = "" }: BoletinContentProps) {
  const { estudiante, grupo, promedioGeneral, estado, materias, resumenIA } = data;

  return (
    <div className={`space-y-6 ${className}`} style={{ color: "#fff" }}>
      {/* Header */}
      <div className={`${CARD_STYLE} overflow-hidden`} style={cardInner}>
        <div
          className="relative p-6 sm:p-8"
          style={{
            background: `linear-gradient(135deg, rgba(124,58,237,0.08) 0%, rgba(168,85,247,0.04) 50%, transparent 100%)`,
            borderBottom: `1px solid ${BORDER}`,
          }}
        >
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-white font-['Poppins'] mb-1">
                {estudiante.nombre}
              </h2>
              {grupo && (
                <Badge variant="outline" className="border-[#232334] text-white/80 bg-white/5 mb-2">
                  {grupo}
                </Badge>
              )}
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-3xl sm:text-4xl font-bold text-white font-['Poppins']">
                  {promedioGeneral !== null ? promedioGeneral.toFixed(1) : "—"}
                </span>
                <span className="text-white/50">/ 100</span>
                <span className="text-sm text-white/60 ml-2">Promedio general</span>
              </div>
            </div>
            <Badge className={`${getEstadoColor(estado)} border px-3 py-1.5 capitalize`}>
              {estado}
            </Badge>
          </div>
        </div>
      </div>

      {/* Resumen IA */}
      {resumenIA && (
        <Card className={CARD_STYLE} style={cardInner}>
          <CardHeader className="py-4">
            <CardTitle className="text-white text-base font-['Poppins'] flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#A855F7]" />
              Resumen
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-white/80 text-sm leading-relaxed">{resumenIA}</p>
          </CardContent>
        </Card>
      )}

      {/* Por cada materia */}
      {materias.map((m) => (
        <Card key={m.materia} className={CARD_STYLE} style={cardInner}>
          <CardHeader className="py-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="text-white text-base font-['Poppins']">{m.materia}</CardTitle>
              <div className="flex items-center gap-2">
                {m.promedio !== null && (
                  <span className="text-lg font-bold text-white">{m.promedio}/100</span>
                )}
                <Badge className={`${getEstadoColor(estado)} text-xs`}>{estado}</Badge>
              </div>
            </div>
            {m.profesor && (
              <CardDescription className="text-white/60 text-sm">Profesor: {m.profesor}</CardDescription>
            )}
            {m.asistencia !== null && (
              <p className="text-white/60 text-xs">Asistencia: {m.asistencia}%</p>
            )}
          </CardHeader>
          <CardContent className="space-y-3 pt-0">
            {m.categorias.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-white/80 mb-1">Categorías</h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-white/10">
                        <th className="text-left py-1.5 text-white/70">Categoría</th>
                        <th className="text-right py-1.5 text-white/70">Peso %</th>
                        <th className="text-right py-1.5 text-white/70">Promedio</th>
                        <th className="text-right py-1.5 text-white/70">Act.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {m.categorias.map((c) => (
                        <tr key={c.nombre} className="border-b border-white/5">
                          <td className="py-1.5 text-white/90">{c.nombre}</td>
                          <td className="text-right py-1.5 text-white/70">{c.peso}</td>
                          <td className="text-right py-1.5 text-white/90">
                            {c.promedio !== null ? c.promedio : "—"}
                          </td>
                          <td className="text-right py-1.5 text-white/70">{c.actividades}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            {m.evolucion.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-white/80 mb-1 flex items-center gap-1">
                  <TrendingUp className="w-3 h-3" /> Evolución
                </h4>
                <div className="h-[180px] w-full">
                  <ChartContainer
                    config={{ promedio: { label: "Promedio", color: ACCENT_LIGHT } }}
                    className="h-full w-full"
                  >
                    <LineChart
                      data={m.evolucion}
                      margin={{ top: 5, right: 5, bottom: 15, left: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                      <XAxis
                        dataKey="fecha"
                        stroke="rgba(255,255,255,0.5)"
                        tick={{ fill: "rgba(255,255,255,0.7)", fontSize: 10 }}
                      />
                      <YAxis
                        domain={[0, 100]}
                        stroke="rgba(255,255,255,0.5)"
                        tick={{ fill: "rgba(255,255,255,0.7)", fontSize: 10 }}
                        width={28}
                      />
                      <Tooltip
                        content={<ChartTooltipContent />}
                        cursor={{ stroke: BORDER, strokeWidth: 1 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="promedio"
                        stroke={ACCENT_LIGHT}
                        strokeWidth={2}
                        dot={{ fill: ACCENT_LIGHT, r: 2 }}
                        name="Promedio"
                      />
                    </LineChart>
                  </ChartContainer>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
