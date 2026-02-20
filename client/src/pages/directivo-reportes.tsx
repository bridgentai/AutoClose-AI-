"use client";

import { useState } from "react";
import { useAuth } from "@/lib/authContext";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { FileText, BookOpen, Loader2, CheckCircle } from "lucide-react";
import { NavBackButton } from "@/components/nav-back-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";

interface GroupItem {
  _id: string;
  nombre: string;
}

interface BoletinItem {
  _id: string;
  periodo: string;
  grupoNombre?: string;
  fecha?: string;
  resumen?: { length?: number };
}

const CARD_STYLE = "bg-white/5 border-white/10 backdrop-blur-md";

export default function DirectivoReportesPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [cursoSeleccionado, setCursoSeleccionado] = useState<string>("");
  const [periodo, setPeriodo] = useState("");
  const [mensajeExito, setMensajeExito] = useState<string | null>(null);

  const { data: grupos = [], isLoading: loadingGrupos } = useQuery<GroupItem[]>({
    queryKey: ["/api/groups/all"],
    queryFn: () => apiRequest<GroupItem[]>("GET", "/api/groups/all"),
    enabled: !!user?.colegioId && (user?.rol === "directivo" || user?.rol === "admin-general-colegio"),
  });

  const { data: boletines = [], isLoading: loadingBoletines } = useQuery<BoletinItem[]>({
    queryKey: ["/api/boletin"],
    queryFn: () => apiRequest<BoletinItem[]>("GET", "/api/boletin"),
    enabled: !!user?.colegioId && (user?.rol === "directivo" || user?.rol === "admin-general-colegio"),
  });

  const generarMutation = useMutation({
    mutationFn: (body: { grupoNombre: string; periodo?: string }) =>
      apiRequest<{ message: string; boletinIds: string[]; estudiantes: number; periodo: string }>(
        "POST",
        "/api/boletin/generar-por-curso",
        body
      ),
    onSuccess: (data) => {
      setMensajeExito(data.message);
      queryClient.invalidateQueries({ queryKey: ["/api/boletin"] });
      setCursoSeleccionado("");
      setPeriodo("");
      setTimeout(() => setMensajeExito(null), 6000);
    },
    onError: (err: any) => {
      const data = err?.response?.data;
      const msg =
        data?.error ||
        data?.message ||
        err?.message ||
        "Error al generar boletines.";
      setMensajeExito(null);
      alert(msg);
    },
  });

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

  if (!user || (user.rol !== "directivo" && user.rol !== "admin-general-colegio")) {
    setLocation("/dashboard");
    return null;
  }

  return (
    <div className="p-4 sm:p-6 md:p-10 max-w-4xl mx-auto">
      <NavBackButton to="/directivo/academia" label="Academia" />
      <div className="mt-4 mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-white font-['Poppins'] flex items-center gap-2">
          <FileText className="w-8 h-8 text-[#00c8ff]" />
          Reportes académicos
        </h1>
        <p className="text-white/60 mt-1">
          Crear boletines o reportes académicos personalizados por estudiante para un curso completo.
        </p>
      </div>

      <Card className={`${CARD_STYLE} mb-8`}>
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-[#00c8ff]" />
            Crear boletines para un curso completo
          </CardTitle>
          <CardDescription className="text-white/60">
            Se generará un reporte académico personalizado para cada estudiante del curso (todas las materias y promedios).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="text-white/80">Curso / Grupo</Label>
            {loadingGrupos ? (
              <Skeleton className="h-10 w-full bg-white/10 rounded-md" />
            ) : (
              <select
                value={cursoSeleccionado}
                onChange={(e) => setCursoSeleccionado(e.target.value)}
                className="w-full h-10 px-3 rounded-md bg-white/10 border border-white/20 text-white focus:ring-2 focus:ring-[#00c8ff]/50 focus:border-[#00c8ff]"
              >
                <option value="">Selecciona un curso</option>
                {grupos.map((g) => (
                  <option key={g._id} value={g.nombre}>
                    {g.nombre}
                  </option>
                ))}
              </select>
            )}
          </div>
          <div className="space-y-2">
            <Label className="text-white/80">Período (opcional)</Label>
            <input
              type="text"
              value={periodo}
              onChange={(e) => setPeriodo(e.target.value)}
              placeholder="Ej: Primer trimestre 2025"
              className="w-full h-10 px-3 rounded-md bg-white/10 border border-white/20 text-white placeholder-white/40 focus:ring-2 focus:ring-[#00c8ff]/50 focus:border-[#00c8ff]"
            />
          </div>
          {mensajeExito && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
              <CheckCircle className="w-5 h-5 shrink-0" />
              <span>{mensajeExito}</span>
            </div>
          )}
          <Button
            onClick={handleGenerar}
            disabled={generarMutation.isPending || !cursoSeleccionado}
            className="bg-[#00c8ff] hover:bg-[#00c8ff]/90 text-black font-medium"
          >
            {generarMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Generando…
              </>
            ) : (
              <>
                <FileText className="w-4 h-4 mr-2" />
                Crear boletines para este curso
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      <Card className={CARD_STYLE}>
        <CardHeader>
          <CardTitle className="text-white">Boletines recientes</CardTitle>
          <CardDescription className="text-white/60">
            Últimos reportes generados del colegio.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingBoletines ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full bg-white/10 rounded-lg" />
              ))}
            </div>
          ) : boletines.length === 0 ? (
            <p className="text-white/60 py-4 text-center">
              Aún no hay boletines. Crea uno usando el formulario de arriba.
            </p>
          ) : (
            <ul className="space-y-2">
              {boletines.slice(0, 15).map((b) => (
                <li
                  key={b._id}
                  className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/10"
                >
                  <div>
                    <span className="font-medium text-white">{b.periodo}</span>
                    {b.grupoNombre && (
                      <span className="ml-2 text-white/60">· {b.grupoNombre}</span>
                    )}
                    {b.resumen && (b.resumen as any).length != null && (
                      <span className="ml-2 text-white/50 text-sm">
                        ({(b.resumen as any).length} estudiantes)
                      </span>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-[#00c8ff] hover:bg-[#00c8ff]/10"
                    onClick={async () => {
                      const token = localStorage.getItem("autoclose_token");
                      const url = import.meta.env.VITE_API_URL
                        ? `${import.meta.env.VITE_API_URL.replace(/\/$/, "")}/api/boletin/${b._id}/pdf`
                        : `/api/boletin/${b._id}/pdf`;
                      const res = await fetch(url, {
                        headers: token ? { Authorization: `Bearer ${token}` } : {},
                      });
                      if (!res.ok) {
                        const data = await res.json().catch(() => ({}));
                        alert(data.message || "No se pudo cargar el boletín.");
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
  );
}
