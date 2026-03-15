"use client";

import { useState } from "react";
import { useAuth } from "@/lib/authContext";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Percent, Plus, Trash2, Edit2, Loader2, CheckSquare } from "lucide-react";
import { NavBackButton } from "@/components/nav-back-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface CourseItem {
  _id: string;
  nombre: string;
  /** Nombre del grupo/curso (ej. "10A") — para mostrar "Materia (Grupo)" */
  cursos?: string[];
}

interface LogroItem {
  _id: string;
  nombre: string;
  porcentaje: number;
  orden?: number;
}

interface LogrosResponse {
  logros: LogroItem[];
  totalPorcentaje: number;
  completo: boolean;
}

const CARD_STYLE = "bg-white/5 border-white/10 backdrop-blur-md";

export default function ProfesorCalificacionLogrosPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [cursoSeleccionado, setCursoSeleccionado] = useState<string>("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [nombre, setNombre] = useState("");
  const [porcentaje, setPorcentaje] = useState("");

  const { data: cursos = [], isLoading: loadingCursos } = useQuery<CourseItem[]>({
    queryKey: ["/api/courses"],
    queryFn: () => apiRequest<CourseItem[]>("GET", "/api/courses"),
    enabled: !!user?.colegioId && user?.rol === "profesor",
  });

  const { data: logrosData, isLoading: loadingLogros } = useQuery<LogrosResponse>({
    queryKey: ["/api/logros-calificacion", cursoSeleccionado],
    queryFn: () =>
      apiRequest<LogrosResponse>("GET", `/api/logros-calificacion?courseId=${encodeURIComponent(cursoSeleccionado)}`),
    enabled: !!cursoSeleccionado && !!user?.colegioId,
  });

  const createMutation = useMutation({
    mutationFn: (body: { nombre: string; porcentaje: number; courseId: string }) =>
      apiRequest<LogroItem>("POST", "/api/logros-calificacion", body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/logros-calificacion", cursoSeleccionado] });
      cerrarDialog();
    },
    onError: (err: Error & { message?: string }) => {
      alert(err?.message || "Error al crear logro.");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: { nombre?: string; porcentaje?: number } }) =>
      apiRequest<LogroItem>("PUT", `/api/logros-calificacion/${id}`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/logros-calificacion", cursoSeleccionado] });
      cerrarDialog();
    },
    onError: (err: Error & { message?: string }) => {
      alert(err?.message || "Error al actualizar logro.");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/logros-calificacion/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/logros-calificacion", cursoSeleccionado] });
    },
  });

  const cerrarDialog = () => {
    setDialogOpen(false);
    setEditingId(null);
    setNombre("");
    setPorcentaje("");
  };

  const abrirCrear = () => {
    setEditingId(null);
    setNombre("");
    setPorcentaje("");
    setDialogOpen(true);
  };

  const abrirEditar = (logro: LogroItem) => {
    setEditingId(logro._id);
    setNombre(logro.nombre);
    setPorcentaje(String(logro.porcentaje));
    setDialogOpen(true);
  };

  const handleSubmit = () => {
    const pct = parseFloat(porcentaje);
    if (!nombre.trim()) {
      alert("Ingresa el nombre del logro.");
      return;
    }
    if (isNaN(pct) || pct < 0 || pct > 100) {
      alert("El porcentaje debe estar entre 0 y 100.");
      return;
    }
    if (editingId) {
      updateMutation.mutate({
        id: editingId,
        body: { nombre: nombre.trim(), porcentaje: pct },
      });
    } else {
      createMutation.mutate({
        nombre: nombre.trim(),
        porcentaje: pct,
        courseId: cursoSeleccionado,
      });
    }
  };

  if (!user || user.rol !== "profesor") {
    setLocation("/dashboard");
    return null;
  }

  const logros = logrosData?.logros ?? [];
  const totalPorcentaje = logrosData?.totalPorcentaje ?? 0;
  const completo = logrosData?.completo ?? false;
  const cursoActual = cursos.find((c) => c._id === cursoSeleccionado);
  const cursoActualLabel = cursoActual?.nombre ?? "";

  return (
    <div className="p-4 sm:p-6 md:p-10 max-w-4xl mx-auto">
      <NavBackButton to="/profesor/academia" label="Academia" />
      <div className="mt-4 mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-white font-['Poppins'] flex items-center gap-2">
          <Percent className="w-8 h-8 text-[#00c8ff]" />
          Calificación: Logros
        </h1>
        <p className="text-white/60 mt-1">
          Define los logros de calificación (tareas, exámenes, etc.) y el porcentaje de cada uno. El total debe ser 100%.
        </p>
      </div>

      <Card className={`${CARD_STYLE} mb-6`}>
        <CardHeader>
          <CardTitle className="text-white">Materia y grupo</CardTitle>
          <CardDescription className="text-white/60">
            Selecciona la materia y el grupo (curso) para configurar los logros de calificación. Cada combinación materia+grupo tiene su propia configuración.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingCursos ? (
            <Skeleton className="h-10 w-full bg-white/10 rounded-md" />
          ) : cursos.length === 0 ? (
            <p className="text-white/60 py-2">
              No tienes cursos asignados. Contacta a tu coordinación para que te asignen materias y grupos.
            </p>
          ) : (
            <select
              value={cursoSeleccionado}
              onChange={(e) => setCursoSeleccionado(e.target.value)}
              className="w-full h-10 px-3 rounded-md bg-white/10 border border-white/20 text-white focus:ring-2 focus:ring-[#00c8ff]/50 focus:border-[#00c8ff]"
            >
              <option value="">✔ Selecciona materia y grupo</option>
              {cursos.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.nombre}
                </option>
              ))}
            </select>
          )}
        </CardContent>
      </Card>

      {cursoSeleccionado && (
        <Card className={CARD_STYLE}>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <CardTitle className="text-white flex items-center gap-2">
                  <CheckSquare className="w-5 h-5 text-[#00c8ff]" />
                  Logros de calificación
                </CardTitle>
                <CardDescription className="text-white/60 mt-1">
                  Para: <span className="text-[#00c8ff] font-medium">{cursoActualLabel}</span>. Los logros deben sumar 100%. Usa el botón &quot;Crear logro para este curso&quot; para agregar categorías.
                </CardDescription>
              </div>
              <Button
                onClick={abrirCrear}
                disabled={loadingLogros}
                className="bg-[#00c8ff] hover:bg-[#00c8ff]/90 text-black font-medium shrink-0"
              >
                <Plus className="w-4 h-4 mr-2" />
                Crear logro para este curso
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div
              className={`mb-4 px-4 py-2 rounded-lg ${
                completo ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40" : "bg-amber-500/20 text-amber-300 border border-amber-500/40"
              }`}
            >
              Total: {totalPorcentaje.toFixed(1)}% {completo ? "✓ Completado" : `(faltan ${(100 - totalPorcentaje).toFixed(1)}%)`}
            </div>

            {loadingLogros ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-12 w-full bg-white/10 rounded-lg" />
                ))}
              </div>
            ) : logros.length === 0 ? (
              <p className="text-white/60 py-6 text-center">
                No hay logros. Haz clic en &quot;Crear logro&quot; para agregar (ej: Tareas 30%, Exámenes 50%, Proyectos 20%).
              </p>
            ) : (
              <ul className="space-y-2">
                {logros.map((l) => (
                  <li
                    key={l._id}
                    className="flex items-center justify-between p-4 rounded-lg bg-white/5 border border-white/10"
                  >
                    <div>
                      <span className="font-medium text-white">{l.nombre}</span>
                      <span className="ml-3 text-[#00c8ff] font-semibold">{l.porcentaje}%</span>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-[#00c8ff] hover:bg-[#00c8ff]/10"
                        onClick={() => abrirEditar(l)}
                      >
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-400 hover:bg-red-500/10"
                        onClick={() => {
                          if (confirm(`¿Eliminar el logro "${l.nombre}"?`)) {
                            deleteMutation.mutate(l._id);
                          }
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      <Dialog open={dialogOpen} onOpenChange={(o) => (!o && cerrarDialog())}>
        <DialogContent className="bg-[#0f0f0f] border-white/10">
          <DialogHeader>
            <DialogTitle className="text-white">
              {editingId ? "Editar logro" : "Crear logro"}
            </DialogTitle>
            <DialogDescription className="text-white/60">
              Ejemplos: Tareas, Exámenes, Proyectos, Participación. El porcentaje debe sumar 100% en total.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-white/80">Nombre</Label>
              <Input
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Ej: Tareas, Exámenes, Proyectos"
                className="bg-white/10 border-white/20 text-white"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-white/80">Porcentaje (%)</Label>
              <Input
                type="number"
                min={0}
                max={100}
                step={5}
                value={porcentaje}
                onChange={(e) => setPorcentaje(e.target.value)}
                placeholder="Ej: 30"
                className="bg-white/10 border-white/20 text-white"
              />
              {!editingId && (
                <p className="text-white/50 text-sm">
                  Disponible: {Math.round(100 - totalPorcentaje)}%
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={cerrarDialog} className="border-white/20 text-white">
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending}
              className="bg-[#00c8ff] hover:bg-[#00c8ff]/90 text-black"
            >
              {(createMutation.isPending || updateMutation.isPending) && (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              )}
              {editingId ? "Guardar" : "Crear"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
