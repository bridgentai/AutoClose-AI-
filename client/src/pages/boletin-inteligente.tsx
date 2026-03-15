"use client";

import { useRef, useEffect } from "react";
import { useAuth } from "@/lib/authContext";
import { useRoute, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import {
  FileText,
  ChevronLeft,
  Download,
  Sparkles,
  AlertTriangle,
  TrendingUp,
} from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import { NavBackButton } from "@/components/nav-back-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChartContainer, ChartTooltipContent } from "@/components/ui/chart";
import { BoletinPDFView } from "@/components/boletin/BoletinPDFView";

const BG = "#0F0F14";
const CARD = "#171721";
const BORDER = "#232334";
const ACCENT = "#7C3AED";
const ACCENT_LIGHT = "#A855F7";

interface CategoriaDetalle {
  nombre: string;
  peso: number;
  promedio: number | null;
  actividades: number;
}

interface MateriaData {
  materia: string;
  profesor: string;
  promedio: number | null;
  categorias: CategoriaDetalle[];
  asistencia: number | null;
  evolucion: { fecha: string; promedio: number }[];
}

interface BoletinData {
  estudiante: { id: string; nombre: string; email: string };
  grupo: string;
  promedioGeneral: number | null;
  estado: string;
  materias: MateriaData[];
  resumenIA: string;
}

const CARD_STYLE =
  "rounded-2xl border shadow-lg transition-all duration-300 hover:shadow-[0_0_24px_-4px_rgba(124,58,237,0.25)]";
const cardInner = { backgroundColor: CARD, borderColor: BORDER };

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

export default function BoletinInteligentePage() {
  const [, params] = useRoute("/profesor/cursos/:cursoId/estudiantes/:estudianteId/boletin-inteligente");
  const [, setLocation] = useLocation();
  const pdfRef = useRef<HTMLDivElement>(null);
  const cursoId = params?.cursoId ?? "";
  const estudianteId = params?.estudianteId ?? "";

  const { data, isLoading, error } = useQuery({
    queryKey: ["/api/boletin/inteligente", estudianteId],
    queryFn: () =>
      apiRequest<BoletinData>("GET", `/api/boletin/inteligente/${estudianteId}`),
    enabled: !!estudianteId,
  });

  const handleDescargarPDF = () => {
    window.print();
  };

  const volverANotas = () => {
    setLocation(`/profesor/cursos/${cursoId}/estudiantes/${estudianteId}/notas`);
  };

  useEffect(() => {
    if (!estudianteId || !cursoId) {
      setLocation("/profesor/academia/cursos");
    }
  }, [estudianteId, cursoId, setLocation]);

  if (!estudianteId || !cursoId) {
    return null;
  }

  if (error) {
    return (
      <div className="min-h-screen p-6" style={{ backgroundColor: BG }}>
        <div className="max-w-4xl mx-auto text-center py-16">
          <AlertTriangle className="w-16 h-16 mx-auto mb-4 text-amber-400" />
          <h2 className="text-xl font-semibold text-white mb-2">Error al cargar el boletín</h2>
          <p className="text-white/60 mb-6">No se pudo obtener la información del estudiante.</p>
          <Button
            variant="outline"
            className="border-[#232334] text-white hover:bg-white/5"
            onClick={volverANotas}
          >
            <ChevronLeft className="w-4 h-4 mr-2" />
            Volver a Notas
          </Button>
        </div>
      </div>
    );
  }

  if (isLoading || !data) {
    return (
      <div className="min-h-screen p-6 flex items-center justify-center" style={{ backgroundColor: BG }}>
        <div className="animate-pulse text-white/60">Cargando boletín...</div>
      </div>
    );
  }

  const { estudiante, grupo, promedioGeneral, estado, materias, resumenIA } = data;

  return (
    <div className="min-h-screen" style={{ backgroundColor: BG }}>
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .boletin-print-area, .boletin-print-area * { visibility: visible; }
          .boletin-print-area { position: absolute; left: 0; top: 0; width: 100%; }
          .no-print { display: none !important; }
        }
      `}</style>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 py-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8 no-print">
          <NavBackButton
            to={`/profesor/cursos/${cursoId}/estudiantes/${estudianteId}/notas`}
            label="Notas del estudiante"
          />
          <Button
            onClick={handleDescargarPDF}
            className="border-[#7C3AED]/50 bg-[#7C3AED]/10 text-[#A855F7] hover:bg-[#7C3AED]/20 transition-all"
          >
            <Download className="w-4 h-4 mr-2" />
            Descargar PDF
          </Button>
        </div>

        <BoletinPDFView innerRef={pdfRef} compact={false}>
          <div className="boletin-print-area space-y-8">
            {/* Header */}
            <div
              className={`${CARD_STYLE} overflow-hidden`}
              style={cardInner}
            >
              <div
                className="relative p-8 sm:p-10"
                style={{
                  background: `linear-gradient(135deg, rgba(124,58,237,0.08) 0%, rgba(168,85,247,0.04) 50%, transparent 100%)`,
                  borderBottom: `1px solid ${BORDER}`,
                }}
              >
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
                  <div>
                    <h1 className="text-2xl sm:text-3xl font-bold text-white font-['Poppins'] mb-1">
                      {estudiante.nombre}
                    </h1>
                    {grupo && (
                      <Badge variant="outline" className="border-[#232334] text-white/80 bg-white/5 mb-2">
                        {grupo}
                      </Badge>
                    )}
                    <div className="flex items-baseline gap-3 mt-2">
                      <span className="text-4xl sm:text-5xl font-bold text-white font-['Poppins']">
                        {promedioGeneral !== null ? promedioGeneral.toFixed(1) : "—"}
                      </span>
                      <span className="text-white/50 text-lg">/ 100</span>
                      <span className="text-sm text-white/60 ml-2">Promedio general</span>
                    </div>
                  </div>
                  <Badge className={`${getEstadoColor(estado)} border px-4 py-2 capitalize`}>
                    {estado}
                  </Badge>
                </div>
              </div>
            </div>

            {/* Resumen IA */}
            {resumenIA && (
              <Card className={CARD_STYLE} style={cardInner}>
                <CardHeader>
                  <CardTitle className="text-white font-['Poppins'] flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-[#A855F7]" />
                    Resumen
                  </CardTitle>
                  <CardDescription className="text-white/60">
                    Análisis personalizado del rendimiento
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-white/80 leading-relaxed">{resumenIA}</p>
                </CardContent>
              </Card>
            )}

            {/* Por cada materia */}
            {materias.map((m) => (
              <Card key={m.materia} className={CARD_STYLE} style={cardInner}>
                <CardHeader>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <CardTitle className="text-white font-['Poppins']">{m.materia}</CardTitle>
                    <div className="flex items-center gap-2">
                      {m.promedio !== null && (
                        <span className="text-xl font-bold text-white">{m.promedio}/100</span>
                      )}
                      <Badge className={getEstadoColor(estado)}>{estado}</Badge>
                    </div>
                  </div>
                  {m.profesor && (
                    <CardDescription className="text-white/60">Profesor: {m.profesor}</CardDescription>
                  )}
                  {m.asistencia !== null && (
                    <p className="text-white/60 text-sm">Asistencia: {m.asistencia}%</p>
                  )}
                </CardHeader>
                <CardContent className="space-y-4">
                  {m.categorias.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold text-white/80 mb-2">Categorías</h4>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-white/10">
                              <th className="text-left py-2 text-white/70">Categoría</th>
                              <th className="text-right py-2 text-white/70">Peso %</th>
                              <th className="text-right py-2 text-white/70">Promedio</th>
                              <th className="text-right py-2 text-white/70">Actividades</th>
                            </tr>
                          </thead>
                          <tbody>
                            {m.categorias.map((c) => (
                              <tr key={c.nombre} className="border-b border-white/5">
                                <td className="py-2 text-white/90">{c.nombre}</td>
                                <td className="text-right py-2 text-white/70">{c.peso}</td>
                                <td className="text-right py-2 text-white/90">
                                  {c.promedio !== null ? c.promedio : "—"}
                                </td>
                                <td className="text-right py-2 text-white/70">{c.actividades}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                  {m.evolucion.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold text-white/80 mb-2 flex items-center gap-1">
                        <TrendingUp className="w-4 h-4" /> Evolución
                      </h4>
                      <div className="h-[220px] w-full">
                        <ChartContainer
                          config={{ promedio: { label: "Promedio", color: ACCENT_LIGHT } }}
                          className="h-full w-full"
                        >
                          <LineChart
                            data={m.evolucion}
                            margin={{ top: 10, right: 10, bottom: 20, left: 10 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                            <XAxis
                              dataKey="fecha"
                              stroke="rgba(255,255,255,0.5)"
                              tick={{ fill: "rgba(255,255,255,0.7)", fontSize: 11 }}
                            />
                            <YAxis
                              domain={[0, 100]}
                              stroke="rgba(255,255,255,0.5)"
                              tick={{ fill: "rgba(255,255,255,0.7)", fontSize: 11 }}
                              width={32}
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
                              dot={{ fill: ACCENT_LIGHT, r: 3 }}
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
        </BoletinPDFView>
      </div>
    </div>
  );
}
