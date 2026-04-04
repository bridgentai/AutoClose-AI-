"use client";

import { useMemo, useState } from "react";
import { useAuth } from "@/lib/authContext";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Users, FileText, Search } from "lucide-react";
import { NavBackButton } from "@/components/nav-back-button";
import { DirectivoGuard } from "@/components/directivo-guard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

interface Estudiante {
  _id: string;
  nombre: string;
  email?: string;
  curso?: string;
  estado?: string;
}

const CARD_STYLE = "bg-white/5 border-white/10 backdrop-blur-md";

export default function DirectivoEstudiantesPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [searchTerm, setSearchTerm] = useState("");

  const { data: estudiantes = [], isLoading } = useQuery<Estudiante[]>({
    queryKey: ["/api/users/by-role", "estudiante", user?.colegioId],
    queryFn: () => apiRequest<Estudiante[]>("GET", "/api/users/by-role?rol=estudiante"),
    enabled: !!user?.colegioId,
  });

  const filtrados = useMemo(() => {
    if (!searchTerm.trim()) return estudiantes;
    const t = searchTerm.toLowerCase().trim();
    return estudiantes.filter(
      (e) =>
        e.nombre?.toLowerCase().includes(t) ||
        e.email?.toLowerCase().includes(t) ||
        e.curso?.toLowerCase().includes(t)
    );
  }, [estudiantes, searchTerm]);

  const ordenados = useMemo(() => {
    const list = [...filtrados];
    const ordenCurso = (curso: string | undefined): [number, string] => {
      if (!curso || !curso.trim()) return [0, ''];
      const match = curso.trim().match(/^(\d+)(.*)$/);
      const grado = match ? parseInt(match[1], 10) : 0;
      const letra = (match && match[2]) ? match[2].toUpperCase() : '';
      return [grado, letra];
    };
    list.sort((a, b) => {
      const [gA, lA] = ordenCurso(a.curso);
      const [gB, lB] = ordenCurso(b.curso);
      if (gA !== gB) return gA - gB;
      if (lA !== lB) return lA.localeCompare(lB);
      return (a.nombre || '').localeCompare(b.nombre || '', 'es');
    });
    return list;
  }, [filtrados]);

  return (
    <DirectivoGuard strictDirectivoOnly>
    <div className="p-4 sm:p-6 md:p-10 max-w-5xl mx-auto">
      <NavBackButton to="/directivo/academia" label="Academia" />
      <div className="mt-4 mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-white font-['Poppins'] flex items-center gap-2">
          <Users className="w-8 h-8 text-[#00c8ff]" />
          Estudiantes del colegio
        </h1>
        <p className="text-white/60 mt-1">
          Listado real de estudiantes. Ver notas por estudiante (por curso).
        </p>
      </div>

      <Card className={CARD_STYLE}>
        <CardHeader>
          <CardTitle className="text-white">Todos los estudiantes</CardTitle>
          <CardDescription className="text-white/60">
            {estudiantes.length} estudiante{estudiantes.length !== 1 ? "s" : ""} en el colegio
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
            <Input
              type="text"
              placeholder="Buscar por nombre, email o curso..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-white/40"
            />
          </div>
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-14 w-full bg-white/10 rounded-lg" />
              ))}
            </div>
          ) : filtrados.length === 0 ? (
            <p className="text-white/60 py-6 text-center">
              {searchTerm ? 'No hay coincidencias.' : 'No hay estudiantes registrados.'}
            </p>
          ) : (
            <div className="space-y-2">
              {ordenados.map((est) => (
                <div
                  key={est._id}
                  className="flex flex-wrap items-center justify-between gap-2 p-4 rounded-xl bg-white/5 border border-white/10"
                >
                  <div>
                    <span className="font-medium text-white block">{est.nombre}</span>
                    <span className="text-sm text-white/60">
                      {est.email ?? ""}
                      {est.curso ? ` · Curso ${est.curso}` : ""}
                    </span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-[#00c8ff]/50 text-[#00c8ff] hover:bg-[#00c8ff]/10"
                    onClick={() => {
                      const curso = est.curso || "";
                      if (curso) {
                        setLocation(
                          `/directivo/cursos/${encodeURIComponent(curso)}/estudiantes/${est._id}/notas`
                        );
                      } else {
                        setLocation("/directivo/cursos");
                      }
                    }}
                    disabled={!est.curso}
                    title={est.curso ? "Ver notas del estudiante" : "Asigna un curso al estudiante para ver notas"}
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
    </DirectivoGuard>
  );
}
