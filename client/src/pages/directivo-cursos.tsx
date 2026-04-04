"use client";

import { useAuth } from "@/lib/authContext";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { BookOpen, ChevronRight, Users } from "lucide-react";
import { NavBackButton } from "@/components/nav-back-button";
import { DirectivoGuard } from "@/components/directivo-guard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface MateriaItem {
  group_subject_id: string;
  subject_id: string;
  subject_name: string;
  teacher_id: string;
  teacher_name: string;
}

interface GroupItem {
  _id: string;
  id: string;
  nombre: string;
  materias?: MateriaItem[];
  cantidadEstudiantes?: number;
}

const CARD_STYLE = "bg-white/5 border-white/10 backdrop-blur-md hover-elevate";

export default function DirectivoCursosPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  const { data: grupos = [], isLoading } = useQuery<GroupItem[]>({
    queryKey: ["/api/groups/all"],
    queryFn: () => apiRequest<GroupItem[]>("GET", "/api/groups/all"),
    enabled: !!user?.colegioId,
  });

  return (
    <DirectivoGuard strictDirectivoOnly>
    <div className="p-4 sm:p-6 md:p-10 max-w-5xl mx-auto">
      <NavBackButton to="/directivo/academia/usuarios" label="Usuarios" />
      <div className="mt-4 mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-white font-['Poppins'] flex items-center gap-2">
          <BookOpen className="w-8 h-8 text-[#00c8ff]" />
          Cursos del colegio
        </h1>
        <p className="text-white/60 mt-1">
          Selecciona un curso para ver asistencia, análisis y estudiantes.
        </p>
      </div>

      <Card className={CARD_STYLE}>
        <CardHeader>
          <CardTitle className="text-white">Todos los cursos / grupos</CardTitle>
          <CardDescription className="text-white/60">
            Información real de tu colegio. Haz clic en un curso para ver asistencia del día, análisis y lista de estudiantes.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-14 w-full bg-white/10 rounded-lg" />
              ))}
            </div>
          ) : grupos.length === 0 ? (
            <p className="text-white/60 py-6 text-center">No hay cursos registrados en el colegio.</p>
          ) : (
            <div className="grid gap-2">
              {grupos.map((g) => (
                <button
                  key={g._id}
                  type="button"
                  onClick={() => setLocation(`/directivo/cursos/${encodeURIComponent(g._id)}`)}
                  className="flex items-center justify-between w-full p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-colors text-left"
                >
                  <span className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#00c8ff]/20 text-[#00c8ff]">
                      <Users className="w-5 h-5" />
                    </span>
                    <span className="text-left">
                      <span className="font-semibold text-white block">{g.nombre}</span>
                      {Array.isArray(g.materias) && g.materias.length > 0 && (
                        <span className="text-xs text-white/60 mt-0.5 block">
                          {g.materias.map((m) => m.subject_name).join(", ")}
                        </span>
                      )}
                    </span>
                  </span>
                  <span className="flex items-center gap-2">
                    {typeof g.cantidadEstudiantes === "number" && (
                      <span className="text-sm text-white/70">{g.cantidadEstudiantes} estudiantes</span>
                    )}
                    <ChevronRight className="w-5 h-5 text-white/50" />
                  </span>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
    </DirectivoGuard>
  );
}
