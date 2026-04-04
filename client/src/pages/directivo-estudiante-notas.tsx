"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/authContext";
import { useLocation, useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { DirectivoGuard } from "@/components/directivo-guard";
import { Download, Eye, EyeOff, FileText, MessageSquare, Pencil } from "lucide-react";
import { Breadcrumb } from "@/components/Breadcrumb";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface NotaItem {
  _id: string;
  tareaTitulo: string;
  nota: number;
  logro?: string;
  fecha: string;
  profesorNombre?: string;
  comentario?: string;
}

interface MateriaNotas {
  _id: string;
  nombre: string;
  colorAcento?: string;
  notas: NotaItem[];
  promedio: number;
  ultimaNota: number;
  estado: string;
}

interface HijoNotesResponse {
  materias: MateriaNotas[];
  total: number;
}

const CARD_STYLE = "bg-white/5 border-white/10 backdrop-blur-md";

interface ActivityFeedItem {
  id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  metadata: Record<string, unknown> | null;
  duration_seconds: number | null;
  created_at: string;
  entity_title: string | null;
  materia_label: string | null;
}

function formatRelativeTimeEs(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const sec = Math.floor((Date.now() - d.getTime()) / 1000);
  if (sec < 45) return "hace un momento";
  const min = Math.floor(sec / 60);
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h}h`;
  const days = Math.floor(h / 24);
  if (days < 7) return `hace ${days} día${days !== 1 ? "s" : ""}`;
  return d.toLocaleDateString("es-CO", { day: "2-digit", month: "short" });
}

function activityDescription(row: ActivityFeedItem): string {
  const title = row.entity_title?.trim() || "esta actividad";
  const file =
    row.metadata && typeof row.metadata.file_name === "string" ? row.metadata.file_name : "archivo";
  const dur = row.duration_seconds ?? 0;
  const dm = Math.floor(dur / 60);
  const ds = dur % 60;

  switch (row.action) {
    case "view_open":
      if (row.entity_type === "assignment") return `Abrió tarea ${title}`;
      if (row.entity_type === "evo_message") return "Abrió hilo en Evo Send";
      return `Abrió ${title}`;
    case "view_close":
      if (row.entity_type === "assignment") return `Cerró tarea ${title} · ${dm} min ${ds} seg`;
      return `Cerró ${title} · ${dm} min ${ds} seg`;
    case "download":
      return `Descargó ${file} de ${title}`;
    case "start_writing":
      return `Empezó a escribir en ${title}`;
    case "message_open":
      return "Leyó mensaje en Evo Send";
    default:
      return row.action;
  }
}

function activityIcon(action: string) {
  switch (action) {
    case "view_open":
      return <Eye className="w-4 h-4 text-[#00c8ff]" />;
    case "view_close":
      return <EyeOff className="w-4 h-4 text-white/60" />;
    case "download":
      return <Download className="w-4 h-4 text-[#ffd700]" />;
    case "start_writing":
      return <Pencil className="w-4 h-4 text-emerald-400" />;
    case "message_open":
      return <MessageSquare className="w-4 h-4 text-[#1e3cff]" />;
    default:
      return <FileText className="w-4 h-4 text-white/50" />;
  }
}

export default function DirectivoEstudianteNotasPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/directivo/cursos/:grupoId/estudiantes/:estudianteId/notas");
  const grupoId = params?.grupoId ? decodeURIComponent(params.grupoId) : "";
  const estudianteId = params?.estudianteId ?? "";
  const [mainTab, setMainTab] = useState<"notas" | "actividad">("notas");

  const { data: groupInfo } = useQuery<{ _id: string; id: string; nombre: string }>({
    queryKey: ["/api/groups", grupoId],
    queryFn: () => apiRequest("GET", `/api/groups/${encodeURIComponent(grupoId)}`),
    enabled: !!grupoId,
  });
  const groupDisplayName = groupInfo?.nombre?.trim() || grupoId;

  useEffect(() => {
    if (user && (!grupoId || !estudianteId)) {
      setLocation("/directivo/cursos");
    }
  }, [user, grupoId, estudianteId, setLocation]);

  const { data: notesData, isLoading } = useQuery<HijoNotesResponse>({
    queryKey: ["/api/student/hijo", estudianteId, "notes"],
    queryFn: () =>
      apiRequest<HijoNotesResponse>("GET", `/api/student/hijo/${estudianteId}/notes`),
    enabled: !!user?.colegioId && !!estudianteId,
  });

  const { data: activityData, isLoading: activityLoading } = useQuery<{ items: ActivityFeedItem[] }>({
    queryKey: ["/api/activity/student", estudianteId, 20],
    queryFn: () =>
      apiRequest<{ items: ActivityFeedItem[] }>(
        "GET",
        `/api/activity/student/${estudianteId}?limit=20`
      ),
    enabled: !!user?.colegioId && !!estudianteId && mainTab === "actividad",
  });

  if (!grupoId || !estudianteId) return null;

  const materias = notesData?.materias ?? [];

  return (
    <DirectivoGuard strictDirectivoOnly>
    <div className="p-4 sm:p-6 md:p-10 max-w-5xl mx-auto">
      <Breadcrumb
        className="mb-4"
        items={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Cursos", href: "/directivo/cursos" },
          { label: `Grupo ${groupDisplayName}`, href: `/directivo/cursos/${encodeURIComponent(grupoId)}/estudiantes` },
          { label: "Estudiantes", href: `/directivo/cursos/${encodeURIComponent(grupoId)}/estudiantes` },
          { label: "Notas" },
        ]}
      />
      <div className="mt-4 mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-white font-['Poppins'] flex items-center gap-2">
          <FileText className="w-8 h-8 text-[#00c8ff]" />
          Notas del estudiante
        </h1>
        <p className="text-white/60 mt-1">Vista solo lectura. Curso: {groupDisplayName}</p>
      </div>

      <Tabs value={mainTab} onValueChange={(v) => setMainTab(v as "notas" | "actividad")} className="w-full">
        <TabsList className="bg-white/5 border border-white/10 mb-6">
          <TabsTrigger value="notas" className="data-[state=active]:bg-[#1e3cff]">
            Notas
          </TabsTrigger>
          <TabsTrigger value="actividad" className="data-[state=active]:bg-[#1e3cff]">
            Actividad
          </TabsTrigger>
        </TabsList>

        <TabsContent value="notas" className="mt-0">
          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-32 w-full bg-white/10 rounded-xl" />
              <Skeleton className="h-48 w-full bg-white/10 rounded-xl" />
            </div>
          ) : materias.length === 0 ? (
            <Card className={CARD_STYLE}>
              <CardContent className="py-12 text-center text-white/60">
                No hay notas registradas para este estudiante.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              {materias.map((materia) => (
                <Card key={materia._id} className={CARD_STYLE}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-white">{materia.nombre}</CardTitle>
                      <div className="flex items-center gap-2">
                        <span className="text-xl font-bold text-white">
                          {Math.round(materia.promedio ?? 0)}
                        </span>
                        <span className="text-white/50">/ 100</span>
                        <span
                          className={`text-sm ${
                            materia.estado === "excelente"
                              ? "text-emerald-400"
                              : materia.estado === "bueno"
                              ? "text-green-400"
                              : materia.estado === "regular"
                              ? "text-amber-400"
                              : "text-red-400"
                          }`}
                        >
                          {materia.estado}
                        </span>
                      </div>
                    </div>
                    <CardDescription className="text-white/60">
                      {materia.notas.length} nota{materia.notas.length !== 1 ? "s" : ""} registrada
                      {materia.notas.length !== 1 ? "s" : ""}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {materia.notas.map((nota) => (
                        <div
                          key={nota._id}
                          className="p-4 bg-white/5 border border-white/10 rounded-lg"
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1">
                              <h4 className="font-semibold text-white mb-1">{nota.tareaTitulo}</h4>
                              <p className="text-sm text-white/60">
                                {nota.fecha
                                  ? new Date(nota.fecha).toLocaleDateString("es-CO", {
                                      year: "numeric",
                                      month: "long",
                                      day: "numeric",
                                    })
                                  : ""}
                                {nota.profesorNombre ? ` · ${nota.profesorNombre}` : ""}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-2xl font-bold text-white">
                                {nota.nota != null ? Math.round(nota.nota) : "—"}
                              </span>
                              <span className="text-white/50">/ 100</span>
                            </div>
                          </div>
                          {(nota.comentario || nota.logro) && (
                            <div className="mt-3 p-3 bg-white/5 rounded-lg border border-white/10">
                              <div className="flex items-start gap-2">
                                <MessageSquare className="w-4 h-4 text-[#00c8ff] mt-0.5 flex-shrink-0" />
                                <p className="text-sm text-white/80">
                                  {nota.comentario || nota.logro || ""}
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="actividad" className="mt-0">
          <Card className={CARD_STYLE}>
            <CardHeader>
              <CardTitle className="text-white">Actividad reciente</CardTitle>
              <CardDescription className="text-white/60">
                Últimas acciones del estudiante en tareas y Evo Send.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {activityLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-14 w-full bg-white/10 rounded-lg" />
                  <Skeleton className="h-14 w-full bg-white/10 rounded-lg" />
                </div>
              ) : !activityData?.items?.length ? (
                <p className="text-white/50 text-sm py-6 text-center">Sin actividad registrada aún.</p>
              ) : (
                <ul className="space-y-2">
                  {activityData.items.map((row) => (
                    <li
                      key={row.id}
                      className="flex gap-3 p-3 rounded-lg border border-white/10 bg-white/[0.03]"
                    >
                      <div className="mt-0.5 shrink-0">{activityIcon(row.action)}</div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-white">{activityDescription(row)}</p>
                        <p className="text-xs text-white/50 mt-1">
                          {row.materia_label ? `${row.materia_label} · ` : ""}
                          {formatRelativeTimeEs(row.created_at)}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
    </DirectivoGuard>
  );
}
