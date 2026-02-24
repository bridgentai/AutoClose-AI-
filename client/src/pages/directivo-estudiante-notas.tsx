"use client";

import { useEffect } from "react";
import { useAuth } from "@/lib/authContext";
import { useLocation, useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { FileText, MessageSquare } from "lucide-react";
import { NavBackButton } from "@/components/nav-back-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

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

export default function DirectivoEstudianteNotasPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/directivo/cursos/:grupoId/estudiantes/:estudianteId/notas");
  const grupoId = params?.grupoId ? decodeURIComponent(params.grupoId) : "";
  const estudianteId = params?.estudianteId ?? "";

  useEffect(() => {
    if (user && user.rol !== "directivo") {
      setLocation("/dashboard");
    }
  }, [user, setLocation]);

  const { data: notesData, isLoading } = useQuery<HijoNotesResponse>({
    queryKey: ["/api/student/hijo", estudianteId, "notes"],
    queryFn: () =>
      apiRequest<HijoNotesResponse>("GET", `/api/student/hijo/${estudianteId}/notes`),
    enabled: !!user?.colegioId && user?.rol === "directivo" && !!estudianteId,
  });

  if (!user || user.rol !== "directivo") return null;
  if (!grupoId || !estudianteId) {
    setLocation("/directivo/cursos");
    return null;
  }

  const materias = notesData?.materias ?? [];

  return (
    <div className="p-4 sm:p-6 md:p-10 max-w-5xl mx-auto">
      <NavBackButton
        to={`/directivo/cursos/${encodeURIComponent(grupoId)}/estudiantes`}
        label={grupoId}
      />
      <div className="mt-4 mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-white font-['Poppins'] flex items-center gap-2">
          <FileText className="w-8 h-8 text-[#00c8ff]" />
          Notas del estudiante
        </h1>
        <p className="text-white/60 mt-1">Vista solo lectura. Curso: {grupoId}</p>
      </div>

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
                            {nota.nota != null ? Math.round(nota.nota) : '—'}
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
    </div>
  );
}
