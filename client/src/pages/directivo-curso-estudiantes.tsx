"use client";

import { useEffect } from "react";
import { useAuth } from "@/lib/authContext";
import { useLocation, useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Users, FileText, ChevronLeft } from "lucide-react";
import { NavBackButton } from "@/components/nav-back-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

interface StudentInGroup {
  _id: string;
  nombre: string;
  estado: string;
}

const CARD_STYLE = "bg-white/5 border-white/10 backdrop-blur-md";

export default function DirectivoCursoEstudiantesPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/directivo/cursos/:grupoId/estudiantes");
  const grupoId = params?.grupoId ? decodeURIComponent(params.grupoId) : "";

  useEffect(() => {
    if (user && user.rol !== "directivo") {
      setLocation("/dashboard");
    }
  }, [user, setLocation]);

  const { data: estudiantes = [], isLoading } = useQuery<StudentInGroup[]>({
    queryKey: ["/api/groups", grupoId, "students"],
    queryFn: () =>
      apiRequest<StudentInGroup[]>("GET", `/api/groups/${encodeURIComponent(grupoId)}/students`),
    enabled: !!user?.colegioId && user?.rol === "directivo" && !!grupoId,
  });

  if (!user || user.rol !== "directivo") return null;
  if (!grupoId) {
    setLocation("/directivo/cursos");
    return null;
  }

  return (
    <div className="p-4 sm:p-6 md:p-10 max-w-5xl mx-auto">
      <NavBackButton to="/directivo/cursos" label="Cursos" />
      <div className="mt-4 mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-white font-['Poppins'] flex items-center gap-2">
          <Users className="w-8 h-8 text-[#00c8ff]" />
          {grupoId}
        </h1>
        <p className="text-white/60 mt-1">Estudiantes del curso. Ver notas en solo lectura.</p>
      </div>

      <Card className={CARD_STYLE}>
        <CardHeader>
          <CardTitle className="text-white">Estudiantes</CardTitle>
          <CardDescription className="text-white/60">
            {estudiantes.length} estudiante{estudiantes.length !== 1 ? "s" : ""} en este curso
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
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
                  <div className="flex items-center gap-3">
                    <span className="font-medium text-white">{est.nombre}</span>
                    <Badge
                      className={
                        est.estado === "excelente"
                          ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40"
                          : est.estado === "bueno"
                          ? "bg-green-500/20 text-green-400 border-green-500/40"
                          : est.estado === "regular"
                          ? "bg-amber-500/20 text-amber-400 border-amber-500/40"
                          : "bg-red-500/20 text-red-400 border-red-500/40"
                      }
                    >
                      {est.estado}
                    </Badge>
                  </div>
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
                    <FileText className="w-4 h-4 mr-2" />
                    Ver notas
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
