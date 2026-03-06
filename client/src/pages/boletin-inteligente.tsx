"use client";

import { useRef, useEffect } from "react";
import { useAuth } from "@/lib/authContext";
import { useRoute, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import {
  FileText,
  TrendingUp,
  TrendingDown,
  Minus,
  ChevronLeft,
  Download,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Target,
} from "lucide-react";
import { motion } from "framer-motion";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Tooltip,
  Legend,
} from "recharts";
import { NavBackButton } from "@/components/nav-back-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BoletinPDFView } from "@/components/boletin/BoletinPDFView";

// Design tokens evoOS
const BG = "#0F0F14";
const CARD = "#171721";
const BORDER = "#232334";
const ACCENT = "#7C3AED";
const ACCENT_LIGHT = "#A855F7";

// Interfaces
interface Materia {
  _id: string;
  nombre: string;
  nota: number;
  tendencia: number;
  descripcionIA: string;
  sparkline: number[];
}

interface EvolucionPoint {
  periodo: string;
  matemáticas?: number;
  español?: number;
  ciencias?: number;
  inglés?: number;
  sociales?: number;
  promedio?: number;
}

interface Competencias {
  pensamientoCritico: number;
  comunicacion: number;
  trabajoEnEquipo: number;
  autonomia: number;
  resolucionProblemas: number;
}

interface BoletinInteligenteData {
  student: { _id: string; nombre: string; grado: string; periodo: string };
  promedioGeneral: number;
  tendencia: number;
  riesgo: "bajo" | "medio" | "alto";
  materias: Materia[];
  evolucion: EvolucionPoint[];
  competencias: Competencias;
  escenarioFuturo: { materia: string; mejora: number; promedioProyectado: number };
  resumenIA: string;
}

// Estilos base
const CARD_STYLE =
  "rounded-2xl border shadow-lg transition-all duration-300 hover:shadow-[0_0_24px_-4px_rgba(124,58,237,0.25)]";
const cardInner = { backgroundColor: CARD, borderColor: BORDER };

export default function BoletinInteligentePage() {
  const [, params] = useRoute("/profesor/cursos/:cursoId/estudiantes/:estudianteId/boletin-inteligente");
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const pdfRef = useRef<HTMLDivElement>(null);
  const cursoId = params?.cursoId ?? "";
  const estudianteId = params?.estudianteId ?? "";

  const { data, isLoading, error } = useQuery({
    queryKey: ["/api/boletin/inteligente", estudianteId],
    queryFn: () =>
      apiRequest<BoletinInteligenteData>("GET", `/api/boletin/inteligente/${estudianteId}`),
    enabled: !!estudianteId,
  });

  const handleDescargarPDF = () => {
    // Preparado para integración futura con generación backend
    console.log("PDF export - integrar con backend");
    // Futuro: POST /api/boletin/pdf con { studentId, cursoId } -> devuelve PDF
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

  const { student, promedioGeneral, tendencia, riesgo, materias, evolucion, competencias, escenarioFuturo, resumenIA } =
    data;

  const riesgoConfig = {
    bajo: { label: "Bajo riesgo", color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/40", icon: CheckCircle2 },
    medio: { label: "Riesgo medio", color: "bg-amber-500/20 text-amber-400 border-amber-500/40", icon: AlertTriangle },
    alto: { label: "Alto riesgo", color: "bg-red-500/20 text-red-400 border-red-500/40", icon: AlertTriangle },
  };
  const riesgoInfo = riesgoConfig[riesgo];
  const RiesgoIcon = riesgoInfo.icon;

  const chartConfig = {
    promedio: { label: "Promedio", color: ACCENT_LIGHT },
    matemáticas: { label: "Matemáticas", color: "#8B5CF6" },
    español: { label: "Español", color: "#3B82F6" },
    ciencias: { label: "Ciencias", color: "#10B981" },
    inglés: { label: "Inglés", color: "#F59E0B" },
    sociales: { label: "Sociales", color: "#EC4899" },
  };

  const radarData = [
    { subject: "Pensamiento crítico", value: competencias.pensamientoCritico, fullMark: 5 },
    { subject: "Comunicación", value: competencias.comunicacion, fullMark: 5 },
    { subject: "Trabajo en equipo", value: competencias.trabajoEnEquipo, fullMark: 5 },
    { subject: "Autonomía", value: competencias.autonomia, fullMark: 5 },
    { subject: "Resolución de problemas", value: competencias.resolucionProblemas, fullMark: 5 },
  ];

  return (
    <div className="min-h-screen" style={{ backgroundColor: BG }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 py-8">
        {/* Header con navegación */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <NavBackButton
              to={`/profesor/cursos/${cursoId}/estudiantes/${estudianteId}/notas`}
              label="Notas del estudiante"
            />
            <div className="flex items-center gap-3 mt-4">
              <FileText className="w-8 h-8 text-[#A855F7]" style={{ filter: "drop-shadow(0 0 8px rgba(168,85,247,0.4))" }} />
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-white font-['Poppins']">
                  Boletín Inteligente
                </h1>
                <p className="text-white/60 text-sm mt-0.5">
                  Análisis académico y proyección · {student.nombre}
                </p>
              </div>
            </div>
          </div>
          <Button
            onClick={handleDescargarPDF}
            className="border-[#7C3AED]/50 bg-[#7C3AED]/10 text-[#A855F7] hover:bg-[#7C3AED]/20 transition-all"
          >
            <Download className="w-4 h-4 mr-2" />
            Descargar PDF
          </Button>
        </div>

        <BoletinPDFView innerRef={pdfRef} compact={false}>
          <div className="space-y-8">
            {/* Hero Section */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
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
                <div className="absolute top-0 right-0 w-64 h-64 rounded-full opacity-20 blur-3xl" style={{ background: ACCENT }} />
                <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-6">
                  <div>
                    <h2 className="text-xl sm:text-2xl font-bold text-white font-['Poppins'] mb-1">
                      {student.nombre}
                    </h2>
                    <div className="flex flex-wrap gap-2 mb-4">
                      <Badge variant="outline" className="border-[#232334] text-white/80 bg-white/5">
                        {student.grado}
                      </Badge>
                      <Badge variant="outline" className="border-[#232334] text-white/80 bg-white/5">
                        {student.periodo}
                      </Badge>
                    </div>
                    <div className="flex items-baseline gap-3">
                      <span className="text-5xl sm:text-6xl font-bold text-white font-['Poppins']">
                        {promedioGeneral.toFixed(1)}
                      </span>
                      <span className="text-white/50 text-lg">/ 100</span>
                      <span className="text-sm text-white/60">Promedio general</span>
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <div
                      className={`flex items-center gap-2 px-4 py-2 rounded-xl ${
                        tendencia > 0
                          ? "bg-emerald-500/15 text-emerald-400"
                          : tendencia < 0
                          ? "bg-red-500/15 text-red-400"
                          : "bg-white/5 text-white/70"
                      }`}
                    >
                      {tendencia > 0 ? (
                        <TrendingUp className="w-5 h-5" />
                      ) : tendencia < 0 ? (
                        <TrendingDown className="w-5 h-5" />
                      ) : (
                        <Minus className="w-5 h-5" />
                      )}
                      <span className="font-semibold">
                        {tendencia > 0 ? "+" : ""}
                        {tendencia.toFixed(1)} vs periodo anterior
                      </span>
                    </div>
                    <Badge className={`${riesgoInfo.color} border px-4 py-2 gap-2`}>
                      <RiesgoIcon className="w-4 h-4" />
                      {riesgoInfo.label}
                    </Badge>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Evolución Académica */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 }}
              className={`${CARD_STYLE} p-6`}
              style={cardInner}
            >
              <CardHeader className="p-0 mb-6">
                <CardTitle className="text-white font-['Poppins'] flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-[#A855F7]" />
                  Evolución Académica
                </CardTitle>
                <CardDescription className="text-white/60">
                  Líneas por materia y promedio general
                </CardDescription>
              </CardHeader>
              <div className="h-[320px] w-full">
                <ChartContainer config={chartConfig} className="h-full w-full">
                  <LineChart data={evolucion} margin={{ top: 10, right: 20, bottom: 20, left: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                      <XAxis dataKey="periodo" stroke="rgba(255,255,255,0.5)" tick={{ fill: "rgba(255,255,255,0.7)", fontSize: 12 }} />
                      <YAxis domain={[0, 5]} stroke="rgba(255,255,255,0.5)" tick={{ fill: "rgba(255,255,255,0.7)", fontSize: 12 }} width={36} />
                      <Tooltip
                        content={
                          <ChartTooltipContent
                            className="rounded-xl border-[#232334] bg-[#171721]"
                          />
                        }
                        cursor={{ stroke: BORDER, strokeWidth: 1 }}
                      />
                      <Legend wrapperStyle={{ paddingTop: 16 }} />
                      <Line type="monotone" dataKey="matemáticas" stroke="#8B5CF6" strokeWidth={2} dot={{ r: 4 }} name="Matemáticas" />
                      <Line type="monotone" dataKey="español" stroke="#3B82F6" strokeWidth={2} dot={{ r: 4 }} name="Español" />
                      <Line type="monotone" dataKey="ciencias" stroke="#10B981" strokeWidth={2} dot={{ r: 4 }} name="Ciencias" />
                      <Line type="monotone" dataKey="inglés" stroke="#F59E0B" strokeWidth={2} dot={{ r: 4 }} name="Inglés" />
                      <Line type="monotone" dataKey="sociales" stroke="#EC4899" strokeWidth={2} dot={{ r: 4 }} name="Sociales" />
                      <Line type="monotone" dataKey="promedio" stroke={ACCENT_LIGHT} strokeWidth={3} strokeDasharray="5 5" dot={{ r: 5 }} name="Promedio" />
                    </LineChart>
                </ChartContainer>
              </div>
            </motion.div>

            {/* Materias en Cards */}
            <div>
              <h3 className="text-lg font-semibold text-white font-['Poppins'] mb-4 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-[#A855F7]" />
                Materias
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {materias.map((m, i) => (
                  <motion.div
                    key={m._id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: 0.15 + i * 0.05 }}
                    className={`${CARD_STYLE} p-6 group relative overflow-hidden border-[#232334] hover:border-[#7C3AED]/50 transition-colors`}
                    style={cardInner}
                  >
                    <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-gradient-to-r from-[#7C3AED]/5 to-transparent" />
                    <div className="relative">
                      <div className="flex justify-between items-start mb-3">
                        <h4 className="font-semibold text-white">{m.nombre}</h4>
                        <div className="flex items-center gap-2">
                          <span className="text-2xl font-bold text-white">{Math.round(m.nota)}</span>
                          <span
                            className={`flex items-center text-sm ${
                              m.tendencia >= 0 ? "text-emerald-400" : "text-red-400"
                            }`}
                          >
                            {m.tendencia >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                            {m.tendencia >= 0 ? "+" : ""}
                            {m.tendencia.toFixed(1)}
                          </span>
                        </div>
                      </div>
                      <p className="text-sm text-white/60 leading-relaxed">{m.descripcionIA}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Radar de Competencias */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.25 }}
              className={`${CARD_STYLE} p-6`}
              style={cardInner}
            >
              <CardHeader className="p-0 mb-6">
                <CardTitle className="text-white font-['Poppins'] flex items-center gap-2">
                  <Target className="w-5 h-5 text-[#A855F7]" />
                  Radar de Competencias
                </CardTitle>
                <CardDescription className="text-white/60">
                  Evaluación de habilidades transversales
                </CardDescription>
              </CardHeader>
              <div className="h-[300px] w-full flex justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={radarData}>
                    <PolarGrid stroke="rgba(255,255,255,0.15)" />
                    <PolarAngleAxis dataKey="subject" tick={{ fill: "rgba(255,255,255,0.8)", fontSize: 11 }} />
                    <PolarRadiusAxis angle={90} domain={[0, 5]} tick={{ fill: "rgba(255,255,255,0.6)" }} />
                    <Radar
                      name="Competencias"
                      dataKey="value"
                      stroke={ACCENT_LIGHT}
                      fill={ACCENT}
                      fillOpacity={0.3}
                      strokeWidth={2}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: CARD,
                        border: `1px solid ${BORDER}`,
                        borderRadius: 12,
                        color: "#fff",
                      }}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </motion.div>

            {/* Escenario Futuro */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.3 }}
              className={`${CARD_STYLE} overflow-hidden`}
              style={{
                background: `linear-gradient(135deg, rgba(124,58,237,0.2) 0%, rgba(88,28,135,0.15) 50%, rgba(35,35,52,0.9) 100%)`,
                borderColor: "rgba(124,58,237,0.3)",
              }}
            >
              <div className="p-6 sm:p-8">
                <h3 className="text-lg font-semibold text-white font-['Poppins'] mb-2 flex items-center gap-2">
                  <Target className="w-5 h-5 text-[#A855F7]" />
                  Escenario Futuro
                </h3>
                <p className="text-white/90 leading-relaxed">
                  Si mejora <span className="text-[#A855F7] font-semibold">+{escenarioFuturo.mejora}</span> en{" "}
                  <span className="text-white font-medium">{escenarioFuturo.materia}</span>, su promedio proyectado sería{" "}
                  <span className="text-[#A855F7] font-bold">{escenarioFuturo.promedioProyectado.toFixed(1)}</span>.
                </p>
              </div>
            </motion.div>

            {/* Resumen Inteligente */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.35 }}
              className={`${CARD_STYLE} p-8 sm:p-10`}
              style={cardInner}
            >
              <h3 className="text-lg font-semibold text-white font-['Poppins'] mb-4 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-[#A855F7]" />
                Resumen Inteligente
              </h3>
              <div className="prose prose-invert max-w-none">
                <p className="text-white/80 leading-loose text-base sm:text-lg" style={{ letterSpacing: "0.01em" }}>
                  {resumenIA}
                </p>
              </div>
            </motion.div>
          </div>
        </BoletinPDFView>
      </div>
    </div>
  );
}
