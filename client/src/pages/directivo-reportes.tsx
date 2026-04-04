"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/authContext";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DirectivoGuard } from "@/components/directivo-guard";
import { apiRequest } from "@/lib/queryClient";
import { FileText, Loader2, CheckCircle, Eye, Download, Info } from "lucide-react";
import { NavBackButton } from "@/components/nav-back-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { BoletinContent, type BoletinData } from "@/components/boletin/BoletinContent";

interface GroupItem {
  _id: string;
  nombre: string;
}

interface BoletinGenerado {
  estudiante: { id: string; nombre: string; email: string };
  promedioGeneral: number | null;
  estado: string;
  materias: BoletinData["materias"];
  resumenIA: string;
}

interface BoletinItem {
  _id: string;
  periodo: string;
  grupoNombre?: string;
  fecha?: string;
  resumen?: { length?: number };
}

const CARD_STYLE = "panel-grades border border-white/10 rounded-xl hover-lift transition-smooth glass-enhanced";
const currentYear = new Date().getFullYear();
const PERIOD_PRESETS = [
  { id: "T1", label: `T1 ${currentYear}`, value: `Primer trimestre ${currentYear}` },
  { id: "T2", label: `T2 ${currentYear}`, value: `Segundo trimestre ${currentYear}` },
  { id: "T3", label: `T3 ${currentYear}`, value: `Tercer trimestre ${currentYear}` },
  { id: "full", label: "Año completo", value: `Año completo ${currentYear}` },
];

export default function DirectivoReportesPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [cursoSeleccionado, setCursoSeleccionado] = useState<string>("");
  const [periodo, setPeriodo] = useState("");
  const [periodoPreset, setPeriodoPreset] = useState<string>("T1");
  const [mensajeExito, setMensajeExito] = useState<string | null>(null);
  const [ultimosBoletines, setUltimosBoletines] = useState<{
    grupo: string;
    totalEstudiantes: number;
    boletines: BoletinGenerado[];
  } | null>(null);
  const [selectedBoletin, setSelectedBoletin] = useState<(BoletinGenerado & { grupo: string }) | null>(null);

  const { data: grupos = [], isLoading: loadingGrupos } = useQuery<GroupItem[]>({
    queryKey: ["/api/groups/all"],
    queryFn: () => apiRequest<GroupItem[]>("GET", "/api/groups/all"),
    enabled: !!user?.colegioId && (user?.rol === "directivo" || user?.rol === "admin-general-colegio"),
  });

  const { data: stats } = useQuery<{ estudiantes: number; cursos: number }>({
    queryKey: ["adminStats", user?.colegioId],
    queryFn: async () => {
      const r = await apiRequest<{ estudiantes: number; cursos: number }>("GET", "/api/users/stats");
      return { estudiantes: r.estudiantes ?? 0, cursos: r.cursos ?? 0 };
    },
    enabled: !!user?.colegioId && (user?.rol === "directivo" || user?.rol === "admin-general-colegio"),
  });

  const { data: boletines = [], isLoading: loadingBoletines } = useQuery<BoletinItem[]>({
    queryKey: ["/api/boletin"],
    queryFn: () => apiRequest<BoletinItem[]>("GET", "/api/boletin"),
    enabled: !!user?.colegioId && (user?.rol === "directivo" || user?.rol === "admin-general-colegio"),
  });

  const generarMutation = useMutation({
    mutationFn: (body: { grupoNombre: string; periodo?: string }) =>
      apiRequest<{ grupo: string; totalEstudiantes: number; boletines: BoletinGenerado[] }>(
        "POST",
        "/api/boletin/generar-por-curso",
        body
      ),
    onSuccess: (data) => {
      setMensajeExito(`Boletines generados para ${data.totalEstudiantes} estudiantes del grupo ${data.grupo}.`);
      setUltimosBoletines(data);
      queryClient.invalidateQueries({ queryKey: ["/api/boletin"] });
      setCursoSeleccionado("");
      setPeriodo("");
      setPeriodoPreset("T1");
      setTimeout(() => setMensajeExito(null), 8000);
    },
    onError: (err: unknown) => {
      const data = (err as { response?: { data?: { error?: string; message?: string } } })?.response?.data;
      const msg = data?.error ?? data?.message ?? (err as Error)?.message ?? "Error al generar boletines.";
      setMensajeExito(null);
      alert(msg);
    },
  });

  useEffect(() => {
    const preset = PERIOD_PRESETS.find((p) => p.id === periodoPreset);
    if (preset) setPeriodo(preset.value);
  }, [periodoPreset]);

  const handleGenerar = () => {
    if (!cursoSeleccionado) {
      alert("Selecciona un curso.");
      return;
    }
    generarMutation.mutate({
      grupoNombre: cursoSeleccionado,
      periodo: periodo.trim() || undefined,
    });
  };

  return (
    <DirectivoGuard>
    <div className="p-6 max-w-6xl mx-auto">
      <NavBackButton to="/directivo/academia" label="Academia" />

      <div className="mt-4 mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-white font-['Poppins'] flex items-center gap-2">
          <FileText className="w-8 h-8 text-[#3B82F6]" />
          Reportes académicos
        </h1>
        <p className="text-white/60 mt-1 text-[#E2E8F0]">
          Genera boletines personalizados por estudiante para un curso completo — todas las materias y promedios incluidos.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Columna izquierda */}
        <div className="space-y-6">
          <Card className={`${CARD_STYLE} cursor-default`}>
            <CardHeader>
              <CardTitle className="text-white text-lg font-semibold">Crear boletines para un curso</CardTitle>
              <CardDescription className="text-white/60 text-sm">
                Se generará un reporte individual para cada estudiante del curso seleccionado.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="text-white/80 text-sm">Curso / Grupo</Label>
                {loadingGrupos ? (
                  <Skeleton className="h-10 w-full bg-white/10 rounded-lg" />
                ) : (
                  <Select value={cursoSeleccionado} onValueChange={setCursoSeleccionado}>
                    <SelectTrigger className="w-full h-10 rounded-lg bg-white/5 border-white/20 text-white [&>span]:text-white/90">
                      <SelectValue placeholder="Selecciona un curso" />
                    </SelectTrigger>
                    <SelectContent className="bg-[#0F172A] border-white/10">
                      {grupos.map((g) => (
                        <SelectItem key={g._id} value={g.nombre} className="text-white focus:bg-white/10 focus:text-white">
                          {g.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
              <div className="space-y-2">
                <Label className="text-white/80 text-sm">Período</Label>
                <input
                  type="text"
                  value={periodo}
                  onChange={(e) => setPeriodo(e.target.value)}
                  placeholder="Ej: Primer trimestre 2026"
                  className="w-full h-10 px-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder-white/40 focus:ring-2 focus:ring-[#3B82F6]/50 focus:border-[#3B82F6]"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                {PERIOD_PRESETS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPeriodoPreset(p.id)}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                      periodoPreset === p.id
                        ? "bg-[#3B82F6] text-white"
                        : "bg-white/5 border border-white/10 text-white/70 hover:bg-white/10"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              {mensajeExito && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                  <CheckCircle className="w-5 h-5 shrink-0" />
                  <span className="text-sm">{mensajeExito}</span>
                </div>
              )}
              <Button
                onClick={handleGenerar}
                disabled={generarMutation.isPending || !cursoSeleccionado}
                className="w-full bg-[#3B82F6] hover:bg-[#2563EB] text-white font-medium rounded-lg"
              >
                {generarMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Generando…
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4 mr-2" />
                    Generar boletines para este curso
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          <Card className={`${CARD_STYLE} cursor-default`}>
            <CardHeader>
              <CardTitle className="text-white text-lg font-semibold">Boletines recientes</CardTitle>
            </CardHeader>
            <CardContent>
              {loadingBoletines ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-12 w-full bg-white/10 rounded-lg" />
                  ))}
                </div>
              ) : boletines.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <FileText className="w-20 h-20 text-white/10 mb-4" strokeWidth={1} />
                  <p className="text-white/50 text-sm">
                    Aún no hay boletines generados. Crea el primero usando el formulario de arriba.
                  </p>
                </div>
              ) : (
                <ul className="space-y-2">
                  {boletines.slice(0, 15).map((b) => (
                    <li
                      key={b._id}
                      className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/10"
                    >
                      <div>
                        <span className="font-medium text-white">{b.periodo}</span>
                        {b.grupoNombre && <span className="ml-2 text-white/60">· {b.grupoNombre}</span>}
                        {b.resumen && (b.resumen as { length?: number }).length != null && (
                          <span className="ml-2 text-white/50 text-sm">
                            ({(b.resumen as { length: number }).length} estudiantes)
                          </span>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-[#3B82F6] hover:bg-[#3B82F6]/10"
                        onClick={async () => {
                          const token = localStorage.getItem("autoclose_token");
                          const url = import.meta.env.VITE_API_URL
                            ? `${String(import.meta.env.VITE_API_URL).replace(/\/$/, "")}/api/boletin/${b._id}/pdf`
                            : `/api/boletin/${b._id}/pdf`;
                          const res = await fetch(url, {
                            headers: token ? { Authorization: `Bearer ${token}` } : {},
                          });
                          if (!res.ok) {
                            const data = await res.json().catch(() => ({}));
                            alert((data as { message?: string }).message ?? "No se pudo cargar el boletín.");
                            return;
                          }
                          const html = await res.text();
                          const w = window.open("", "_blank");
                          if (w) {
                            w.document.write(html);
                            w.document.close();
                          }
                        }}
                      >
                        Ver / PDF
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Columna derecha */}
        <div className="space-y-6">
          <Card className={`${CARD_STYLE} cursor-default`}>
            <CardHeader>
              <CardTitle className="text-white text-lg font-semibold">Resumen del colegio</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                  <p className="text-2xl font-bold text-white font-['Poppins']">{stats?.estudiantes ?? "—"}</p>
                  <p className="text-white/50 text-sm mt-0.5">Estudiantes</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-white font-['Poppins']">{stats?.cursos ?? grupos.length}</p>
                  <p className="text-white/50 text-sm mt-0.5">Cursos</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-white font-['Poppins']">{boletines.length}</p>
                  <p className="text-white/50 text-sm mt-0.5">Boletines</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className={`${CARD_STYLE} cursor-default`}>
            <CardHeader>
              <CardTitle className="text-white text-lg font-semibold">¿Qué incluye cada boletín?</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {[
                  "Nombre y datos del estudiante",
                  "Notas por materia y promedio",
                  "Porcentaje de asistencia",
                  "Observaciones del período",
                  "Formato PDF listo para imprimir",
                ].map((item) => (
                  <li key={item} className="flex items-center gap-2 text-white">
                    <CheckCircle className="w-5 h-5 shrink-0 text-emerald-400" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card className={`${CARD_STYLE} cursor-default border-[#3B82F6]/20`}>
            <CardContent className="flex items-start gap-3 p-4">
              <div className="w-8 h-8 rounded-full bg-[#3B82F6] flex items-center justify-center shrink-0">
                <Info className="w-4 h-4 text-white" />
              </div>
              <p className="text-white/90 text-sm leading-relaxed">
                Consejo: Genera los boletines al final de cada trimestre. Puedes generar uno por curso o por estudiante
                individual desde el perfil del estudiante.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {ultimosBoletines && ultimosBoletines.boletines.length > 0 && (
        <Card className={`${CARD_STYLE} mt-6`}>
          <CardHeader>
            <CardTitle className="text-white">Boletines generados para {ultimosBoletines.grupo}</CardTitle>
            <CardDescription className="text-white/60">
              {ultimosBoletines.totalEstudiantes} estudiante(s). Haz clic en &quot;Ver&quot; para abrir el boletín.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {ultimosBoletines.boletines.map((b, idx) => (
                <li
                  key={b.estudiante.id || idx}
                  className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/10"
                >
                  <div>
                    <span className="font-medium text-white">{b.estudiante.nombre}</span>
                    <span className="ml-2 text-white/60">
                      Promedio: {b.promedioGeneral !== null ? b.promedioGeneral.toFixed(1) : "—"}
                    </span>
                    <span className="ml-2 text-xs text-white/50 capitalize">· {b.estado}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-[#3B82F6] hover:bg-[#3B82F6]/10"
                    onClick={() => setSelectedBoletin({ ...b, grupo: ultimosBoletines.grupo })}
                  >
                    <Eye className="w-4 h-4 mr-1" />
                    Ver
                  </Button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Dialog open={!!selectedBoletin} onOpenChange={(open) => !open && setSelectedBoletin(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col bg-[#0a0a2a] border-white/10">
          <DialogHeader>
            <DialogTitle className="text-white">
              {selectedBoletin ? selectedBoletin.estudiante.nombre : "Boletín"}
            </DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto flex-1 pr-2 -mr-2">
            {selectedBoletin && (
              <BoletinContent
                data={{
                  estudiante: selectedBoletin.estudiante,
                  grupo: selectedBoletin.grupo,
                  promedioGeneral: selectedBoletin.promedioGeneral,
                  estado: selectedBoletin.estado,
                  materias: selectedBoletin.materias,
                  resumenIA: selectedBoletin.resumenIA,
                }}
              />
            )}
          </div>
          <div className="pt-4 border-t border-white/10 flex justify-end">
            <Button
              variant="outline"
              className="border-white/20 text-white hover:bg-white/10"
              onClick={() => setSelectedBoletin(null)}
            >
              Cerrar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
    </DirectivoGuard>
  );
}
