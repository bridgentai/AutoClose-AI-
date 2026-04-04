"use client";

import { useMemo, useState } from "react";
import { useAuth } from "@/lib/authContext";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { GraduationCap, Search, Calendar } from "lucide-react";
import { NavBackButton } from "@/components/nav-back-button";
import { DirectivoGuard } from "@/components/directivo-guard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

interface Profesor {
  _id: string;
  nombre: string;
  email?: string;
}

const CARD_STYLE = "bg-white/5 border-white/10 backdrop-blur-md";

export default function DirectivoProfesoresPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [searchTerm, setSearchTerm] = useState("");

  const { data: profesores = [], isLoading } = useQuery<Profesor[]>({
    queryKey: ["/api/users/by-role", "profesor", user?.colegioId],
    queryFn: () => apiRequest<Profesor[]>("GET", "/api/users/by-role?rol=profesor"),
    enabled: !!user?.colegioId,
  });

  const filtrados = useMemo(() => {
    if (!searchTerm.trim()) return profesores;
    const t = searchTerm.toLowerCase().trim();
    return profesores.filter(
      (p) =>
        p.nombre?.toLowerCase().includes(t) ||
        (p.email ?? "").toLowerCase().includes(t)
    );
  }, [profesores, searchTerm]);

  const ordenados = useMemo(() => {
    const list = [...filtrados];
    list.sort((a, b) => (a.nombre || "").localeCompare(b.nombre || "", "es"));
    return list;
  }, [filtrados]);

  return (
    <DirectivoGuard strictDirectivoOnly>
    <div className="p-4 sm:p-6 md:p-10 max-w-5xl mx-auto">
      <NavBackButton to="/directivo/academia/usuarios" label="Usuarios" />
      <div className="mt-4 mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white font-['Poppins'] flex items-center gap-2">
            <GraduationCap className="w-8 h-8 text-[var(--evo-cyan)]" />
            Profesores del colegio
          </h1>
          <p className="text-white/60 mt-1">
            Listado de profesores. Gestiona horarios en Asignación de Horarios.
          </p>
        </div>
        <Button
          variant="outline"
          className="border-[var(--primary-blue)]/50 text-[var(--primary-blue)] hover:bg-[var(--primary-blue)]/10 shrink-0"
          onClick={() => setLocation("/asignacion-horarios")}
        >
          <Calendar className="w-4 h-4 mr-2" />
          Asignación de Horarios
        </Button>
      </div>

      <Card className={CARD_STYLE}>
        <CardHeader>
          <CardTitle className="text-white">Todos los profesores</CardTitle>
          <CardDescription className="text-white/60">
            {profesores.length} profesor{profesores.length !== 1 ? "es" : ""} en el colegio
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
            <Input
              type="text"
              placeholder="Buscar por nombre o email..."
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
              {searchTerm ? "No hay coincidencias." : "No hay profesores registrados."}
            </p>
          ) : (
            <div className="space-y-2">
              {ordenados.map((p) => (
                <div
                  key={p._id}
                  className="flex flex-wrap items-center justify-between gap-2 p-4 rounded-xl bg-white/5 border border-white/10"
                >
                  <div>
                    <span className="font-medium text-white block">{p.nombre}</span>
                    {p.email && (
                      <span className="text-sm text-white/60">{p.email}</span>
                    )}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-[var(--evo-cyan)]/50 text-[var(--evo-cyan)] hover:bg-[var(--evo-cyan)]/10"
                    onClick={() => setLocation("/asignacion-horarios")}
                    title="Ir a Asignación de Horarios para editar el horario de este profesor"
                  >
                    <Calendar className="w-4 h-4 mr-2" />
                    Ver horarios
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
