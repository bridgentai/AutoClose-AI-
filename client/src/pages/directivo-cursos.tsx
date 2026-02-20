"use client";

import { useEffect } from "react";
import { useAuth } from "@/lib/authContext";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { BookOpen, ChevronRight, Users } from "lucide-react";
import { NavBackButton } from "@/components/nav-back-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface GroupItem {
  _id: string;
  nombre: string;
}

const CARD_STYLE = "bg-white/5 border-white/10 backdrop-blur-md hover-elevate";

export default function DirectivoCursosPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (user && user.rol !== "directivo") {
      setLocation("/dashboard");
    }
  }, [user, setLocation]);

  const { data: grupos = [], isLoading } = useQuery<GroupItem[]>({
    queryKey: ["/api/groups/all"],
    queryFn: () => apiRequest<GroupItem[]>("GET", "/api/groups/all"),
    enabled: !!user?.colegioId && user?.rol === "directivo",
  });

  if (!user || user.rol !== "directivo") return null;

  return (
    <div className="p-4 sm:p-6 md:p-10 max-w-5xl mx-auto">
      <NavBackButton to="/directivo/academia" label="Academia" />
      <div className="mt-4 mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-white font-['Poppins'] flex items-center gap-2">
          <BookOpen className="w-8 h-8 text-[#00c8ff]" />
          Cursos del colegio
        </h1>
        <p className="text-white/60 mt-1">
          Selecciona un curso para ver los estudiantes y sus notas.
        </p>
      </div>

      <Card className={CARD_STYLE}>
        <CardHeader>
          <CardTitle className="text-white">Todos los cursos / grupos</CardTitle>
          <CardDescription className="text-white/60">
            Información real de tu colegio. Haz clic en un curso para ver estudiantes y notas.
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
                  onClick={() => setLocation(`/directivo/cursos/${encodeURIComponent(g.nombre)}/estudiantes`)}
                  className="flex items-center justify-between w-full p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-colors text-left"
                >
                  <span className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#00c8ff]/20 text-[#00c8ff]">
                      <Users className="w-5 h-5" />
                    </span>
                    <span className="font-semibold text-white">{g.nombre}</span>
                  </span>
                  <ChevronRight className="w-5 h-5 text-white/50" />
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
