"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/authContext";
import { useLocation, useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import {
  BookOpen,
  Users,
  BarChart3,
  ClipboardList,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { NavBackButton } from "@/components/nav-back-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const CARD_STYLE = "bg-white/5 border-white/10 backdrop-blur-md";

type TabId = "asistencia" | "analisis" | "estudiantes";

interface StudentInGroup {
  _id: string;
  nombre: string;
  estado?: string;
}

interface AsistenciaRecord {
  _id: string;
  estudianteId: { _id: string; nombre?: string; correo?: string; curso?: string };
  cursoId: { _id: string; nombre?: string };
  fecha: string;
  horaBloque?: string;
  estado: "presente" | "ausente";
  puntualidad?: "on_time" | "late";
}

function toId(v: string | { _id?: string; $oid?: string } | null | undefined): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "object" && v !== null) {
    if (typeof (v as { $oid?: string }).$oid === "string") return (v as { $oid: string }).$oid;
    if (typeof (v as { _id?: string })._id === "string") return (v as { _id: string })._id;
  }
  return String(v);
}

export default function DirectivoCursoDetailPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/directivo/cursos/:grupoId");
  const grupoId = params?.grupoId ? decodeURIComponent(params.grupoId) : "";
  const [tab, setTab] = useState<TabId>("asistencia");

  useEffect(() => {
    if (user && user.rol !== "directivo") {
      setLocation("/dashboard");
    }
  }, [user, setLocation]);

  if (!user || user.rol !== "directivo") return null;
  if (!grupoId) {
    setLocation("/directivo/cursos");
    return null;
  }

  const hoy = new Date().toISOString().slice(0, 10);

  const { data: estudiantes = [], isLoading: loadingStudents } = useQuery<StudentInGroup[]>({
    queryKey: ["/api/groups", grupoId, "students"],
    queryFn: () =>
      apiRequest<StudentInGroup[]>("GET", `/api/groups/${encodeURIComponent(grupoId)}/students`),
    enabled: !!grupoId,
  });

  const {
    data: asistenciaList = [],
    isLoading: loadingAsistencia,
    refetch: refetchAsistencia,
    isFetching: fetchingAsistencia,
  } = useQuery<AsistenciaRecord[]>({
    queryKey: ["/api/attendance/grupo", grupoId, "fecha", hoy],
    queryFn: () =>
      apiRequest<AsistenciaRecord[]>(
        "GET",
        `/api/attendance/grupo/${encodeURIComponent(grupoId)}/fecha/${hoy}`
      ),
    enabled: !!grupoId && tab === "asistencia",
    refetchInterval: 10000,
  });

  const byStudent = (() => {
    const map: Record<
      string,
      { nombre: string; records: { materia: string; hora?: string; estado: string; puntualidad?: string }[] }
    > = {};
    estudiantes.forEach((e) => {
      map[toId(e._id)] = { nombre: e.nombre || "—", records: [] };
    });
    asistenciaList.forEach((r) => {
      const id = toId(r.estudianteId?._id ?? r.estudianteId);
      const materia = (r.cursoId as { nombre?: string })?.nombre || "Materia";
      const hora = r.horaBloque;
      const estado = r.estado === "presente" ? "Presente" : "Ausente";
      const puntualidad = r.puntualidad === "late" ? "Tarde" : r.puntualidad === "on_time" ? "A tiempo" : undefined;
      if (!map[id]) map[id] = { nombre: (r.estudianteId as { nombre?: string })?.nombre || "—", records: [] };
      map[id].records.push({ materia, hora, estado, puntualidad });
    });
    return map;
  })();

  const tabs: { id: TabId; label: string; icon: typeof ClipboardList }[] = [
    { id: "asistencia", label: "Asistencia", icon: ClipboardList },
    { id: "analisis", label: "Análisis", icon: BarChart3 },
    { id: "estudiantes", label: "Estudiantes", icon: Users },
  ];

  return (
    <div className="p-4 sm:p-6 md:p-10 max-w-5xl mx-auto min-h-[calc(100vh-8rem)]">
      <NavBackButton to="/directivo/cursos" label="Cursos" />
      <div className="mt-4 mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-white font-['Poppins'] flex items-center gap-2">
          <BookOpen className="w-8 h-8 text-[#00c8ff]" />
          {grupoId}
        </h1>
        <p className="text-white/60 mt-1">Asistencia, análisis y estudiantes del curso.</p>
      </div>

      <div className="flex gap-2 mb-6 border-b border-white/10 pb-2">
        {tabs.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all",
                tab === t.id
                  ? "bg-[#00c8ff]/20 text-[#00c8ff] border border-[#00c8ff]/40"
                  : "text-white/60 hover:text-white hover:bg-white/5 border border-transparent"
              )}
            >
              <Icon className="w-4 h-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === "asistencia" && (
        <Card className={CARD_STYLE}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div>
              <CardTitle className="text-white flex items-center gap-2">
                <ClipboardList className="w-5 h-5 text-[#00c8ff]" />
                Reporte de asistencia – hoy
              </CardTitle>
              <CardDescription className="text-white/60">
                {hoy}. Registros tomados por los profesores; se actualiza automáticamente cada 10 s. Por estudiante: presente, ausente, llegó tarde y a qué clase.
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="border-white/20 text-white/80 hover:bg-white/10"
              onClick={() => refetchAsistencia()}
              disabled={fetchingAsistencia}
            >
              {fetchingAsistencia ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
            </Button>
          </CardHeader>
          <CardContent>
            {loadingAsistencia && !asistenciaList.length ? (
              <div className="space-y-3">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-24 w-full rounded-xl bg-white/10" />
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                {Object.entries(byStudent).map(([estId, { nombre, records }]) => (
                  <div
                    key={estId}
                    className="rounded-xl border border-white/10 bg-white/[0.03] overflow-hidden"
                  >
                    <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
                      <span className="font-semibold text-white">{nombre}</span>
                      <span className="text-xs text-white/50">
                        {records.length} registro{records.length !== 1 ? "s" : ""} hoy
                      </span>
                    </div>
                    <div className="p-4">
                      {records.length === 0 ? (
                        <p className="text-white/50 text-sm flex items-center gap-2">
                          <Clock className="w-4 h-4" />
                          Sin registros de asistencia hoy aún.
                        </p>
                      ) : (
                        <ul className="space-y-2">
                          {records.map((rec, i) => (
                            <li
                              key={i}
                              className={cn(
                                "flex items-center gap-3 py-2 px-3 rounded-lg text-sm",
                                rec.estado === "Presente"
                                  ? "bg-emerald-500/10 border border-emerald-500/20"
                                  : "bg-red-500/10 border border-red-500/20"
                              )}
                            >
                              {rec.estado === "Presente" ? (
                                <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                              ) : (
                                <XCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
                              )}
                              <span className="text-white/90 font-medium flex-1">
                                {rec.materia}
                                {rec.hora ? ` · ${rec.hora}` : ""}
                              </span>
                              <span
                                className={cn(
                                  "font-medium",
                                  rec.estado === "Presente" ? "text-emerald-400" : "text-red-400"
                                )}
                              >
                                {rec.estado}
                              </span>
                              {rec.puntualidad === "Tarde" && (
                                <span className="text-amber-400 text-xs font-medium flex items-center gap-1">
                                  <Clock className="w-3.5 h-3.5" />
                                  Llegó tarde
                                </span>
                              )}
                              {rec.puntualidad === "A tiempo" && rec.estado === "Presente" && (
                                <span className="text-white/50 text-xs">A tiempo</span>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                ))}
                {!Object.keys(byStudent).length && !loadingStudents && (
                  <p className="text-white/50 py-8 text-center">No hay estudiantes en este curso.</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {tab === "analisis" && (
        <Card className={CARD_STYLE}>
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-[#00c8ff]" />
              Análisis
            </CardTitle>
            <CardDescription className="text-white/60">
              Vista de análisis de rendimiento y estadísticas del curso (próximamente).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-white/50 text-center py-12">Módulo de análisis en construcción.</p>
          </CardContent>
        </Card>
      )}

      {tab === "estudiantes" && (
        <Card className={CARD_STYLE}>
          <CardHeader>
            <CardTitle className="text-white">Estudiantes</CardTitle>
            <CardDescription className="text-white/60">
              {estudiantes.length} estudiante{estudiantes.length !== 1 ? "s" : ""} en este curso
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingStudents ? (
              <div className="space-y-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-14 w-full bg-white/10 rounded-lg" />
                ))}
              </div>
            ) : estudiantes.length === 0 ? (
              <p className="text-white/60 py-6 text-center">No hay estudiantes asignados a este curso.</p>
            ) : (
              <div className="space-y-2">
                {estudiantes.map((est) => (
                  <div
                    key={est._id}
                    className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10"
                  >
                    <span className="font-medium text-white">{est.nombre}</span>
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-[#00c8ff]/50 text-[#00c8ff] hover:bg-[#00c8ff]/10"
                      onClick={() =>
                        setLocation(
                          `/directivo/cursos/${encodeURIComponent(grupoId)}/estudiantes/${est._id}/notas`
                        )
                      }
                    >
                      Ver notas
                    </Button>
                  </div>
                ))}
                <Button
                  variant="ghost"
                  className="w-full mt-2 text-white/70 hover:text-white hover:bg-white/5"
                  onClick={() =>
                    setLocation(`/directivo/cursos/${encodeURIComponent(grupoId)}/estudiantes`)
                  }
                >
                  Ver lista completa de estudiantes
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

