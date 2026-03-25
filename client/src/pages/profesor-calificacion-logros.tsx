"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import { useAuth } from "@/lib/authContext";
import { useLocation, useRoute } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Percent, Plus, Trash2, Edit2, Loader2, CheckSquare, ChevronDown, ChevronUp, ListPlus } from "lucide-react";
import { NavBackButton } from "@/components/nav-back-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  cursos?: string[];
}

interface IndicadorItem {
  _id: string;
  nombre: string;
  porcentaje: number;
  orden?: number;
}

interface LogroBloque {
  _id: string;
  descripcion: string;
  pesoEnCurso: number;
  orden?: number;
  indicadores: IndicadorItem[];
  totalIndicadores: number;
  indicadoresCompletos: boolean;
}

interface LogrosResponse {
  logros: LogroBloque[];
  indicadoresPlano: IndicadorItem[];
  totalPesoLogros: number;
  logrosPesoCompleto: boolean;
}

const CARD_STYLE = "bg-white/5 border-white/10 backdrop-blur-md";

export default function ProfesorCalificacionLogrosPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [, courseLogrosRoute] = useRoute("/course/:cursoId/calificacion-logros");
  const contextualGrupoId = courseLogrosRoute?.cursoId?.trim() ?? "";
  const contextualMode = Boolean(contextualGrupoId);

  const gsQuery =
    contextualMode && typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("gs")?.trim() ?? ""
      : "";
  const returnToQuery =
    contextualMode && typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("returnTo")?.trim() ?? ""
      : "";

  const queryClient = useQueryClient();
  const [cursoSeleccionado, setCursoSeleccionado] = useState<string>("");
  const embedInitKeyRef = useRef<string>("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const [dialogLogroOpen, setDialogLogroOpen] = useState(false);
  const [editingLogroId, setEditingLogroId] = useState<string | null>(null);
  const [descripcionLogro, setDescripcionLogro] = useState("");
  const [pesoLogro, setPesoLogro] = useState("");

  const [dialogIndicadoresOpen, setDialogIndicadoresOpen] = useState(false);
  const [outcomeIdIndicadores, setOutcomeIdIndicadores] = useState<string | null>(null);
  const [indicadoresDraft, setIndicadoresDraft] = useState<{ nombre: string; porcentaje: string }[]>([]);

  const { data: cursos = [], isLoading: loadingCursos } = useQuery<CourseItem[]>({
    queryKey: ["/api/courses"],
    queryFn: () => apiRequest<CourseItem[]>("GET", "/api/courses"),
    enabled: !!user?.colegioId && user?.rol === "profesor" && !contextualMode,
  });

  const { data: subjectsForContext = [], isLoading: loadingSubjectsContext } = useQuery<CourseItem[]>({
    queryKey: ["subjectsForGroup", contextualGrupoId],
    queryFn: () => apiRequest<CourseItem[]>("GET", `/api/courses/for-group/${encodeURIComponent(contextualGrupoId)}`),
    enabled: contextualMode && !!user?.colegioId && user?.rol === "profesor",
  });

  const { data: groupInfoCtx } = useQuery<{ nombre?: string }>({
    queryKey: ["group", contextualGrupoId],
    queryFn: () => apiRequest("GET", `/api/groups/${encodeURIComponent(contextualGrupoId)}`),
    enabled: contextualMode && !!contextualGrupoId,
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (!contextualMode) {
      embedInitKeyRef.current = "";
      return;
    }
    if (!subjectsForContext.length) return;
    const key = `${contextualGrupoId}|${gsQuery}`;
    if (embedInitKeyRef.current === key) return;
    const pick =
      gsQuery && subjectsForContext.some((s) => s._id === gsQuery)
        ? gsQuery
        : subjectsForContext[0]._id;
    setCursoSeleccionado(pick);
    embedInitKeyRef.current = key;
  }, [contextualMode, contextualGrupoId, gsQuery, subjectsForContext]);

  const { data: logrosData, isLoading: loadingLogros } = useQuery<LogrosResponse>({
    queryKey: ["/api/logros-calificacion", cursoSeleccionado],
    queryFn: async () => {
      const raw = await apiRequest<unknown>("GET", `/api/logros-calificacion?courseId=${encodeURIComponent(cursoSeleccionado)}`);
      const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
      return {
        logros: Array.isArray(o.logros) ? (o.logros as LogroBloque[]) : [],
        indicadoresPlano: Array.isArray(o.indicadoresPlano) ? (o.indicadoresPlano as IndicadorItem[]) : [],
        totalPesoLogros: typeof o.totalPesoLogros === "number" ? o.totalPesoLogros : 0,
        logrosPesoCompleto: o.logrosPesoCompleto === true,
      };
    },
    enabled: !!cursoSeleccionado && !!user?.colegioId,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/logros-calificacion", cursoSeleccionado] });
  };

  const createLogroMutation = useMutation({
    mutationFn: (body: { descripcion: string; pesoEnCurso?: number; courseId: string }) =>
      apiRequest<unknown>("POST", "/api/logros-calificacion/logro", body),
    onSuccess: () => {
      invalidate();
      cerrarDialogLogro();
    },
    onError: (err: Error & { message?: string }) => alert(err?.message || "Error al crear logro."),
  });

  const updateLogroMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: { descripcion?: string; pesoEnCurso?: number } }) =>
      apiRequest("PUT", `/api/logros-calificacion/logro/${id}`, body),
    onSuccess: () => {
      invalidate();
      cerrarDialogLogro();
    },
    onError: (err: Error & { message?: string }) => alert(err?.message || "Error al actualizar logro."),
  });

  const deleteLogroMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/logros-calificacion/logro/${id}`),
    onSuccess: () => invalidate(),
  });

  const syncIndicadoresMutation = useMutation({
    mutationFn: (body: { outcomeId: string; indicadores: { nombre: string; porcentaje: number }[] }) =>
      apiRequest("PUT", `/api/logros-calificacion/logro/${body.outcomeId}/indicadores`, {
        indicadores: body.indicadores,
      }),
    onSuccess: () => {
      invalidate();
      cerrarDialogIndicadores();
    },
    onError: (err: Error & { message?: string }) => alert(err?.message || "Error al guardar indicadores."),
  });

  const cerrarDialogLogro = () => {
    setDialogLogroOpen(false);
    setEditingLogroId(null);
    setDescripcionLogro("");
    setPesoLogro("");
  };

  const cerrarDialogIndicadores = () => {
    setDialogIndicadoresOpen(false);
    setOutcomeIdIndicadores(null);
    setIndicadoresDraft([]);
  };

  const abrirCrearLogro = () => {
    setEditingLogroId(null);
    setDescripcionLogro("");
    const bloques = logrosData?.logros ?? [];
    setPesoLogro(bloques.length === 0 ? "100" : "");
    setDialogLogroOpen(true);
  };

  const abrirEditarLogro = (L: LogroBloque) => {
    setEditingLogroId(L._id);
    setDescripcionLogro(L.descripcion);
    setPesoLogro(String(L.pesoEnCurso));
    setDialogLogroOpen(true);
  };

  const abrirDialogIndicadores = (L: LogroBloque) => {
    setOutcomeIdIndicadores(L._id);
    const list = Array.isArray(L.indicadores) ? L.indicadores : [];
    setIndicadoresDraft(
      list.length > 0
        ? [...list]
            .sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0))
            .map((i) => ({ nombre: i.nombre, porcentaje: String(i.porcentaje) }))
        : [{ nombre: "", porcentaje: "" }]
    );
    setDialogIndicadoresOpen(true);
  };

  const submitLogro = () => {
    if (!descripcionLogro.trim()) {
      alert("Describe el logro (texto del párrafo).");
      return;
    }
    const bloques = logrosData?.logros ?? [];
    if (editingLogroId) {
      const w = parseFloat(pesoLogro);
      if (Number.isNaN(w) || w < 0 || w > 100) {
        alert("El peso en el curso debe estar entre 0 y 100.");
        return;
      }
      updateLogroMutation.mutate({
        id: editingLogroId,
        body: { descripcion: descripcionLogro.trim(), pesoEnCurso: w },
      });
    } else {
      let w = parseFloat(pesoLogro);
      if (bloques.length > 0) {
        if (pesoLogro.trim() === "" || Number.isNaN(w)) w = 0;
      } else {
        w = 100;
      }
      if (w < 0 || w > 100) {
        alert("El peso en el curso debe estar entre 0 y 100.");
        return;
      }
      createLogroMutation.mutate({
        descripcion: descripcionLogro.trim(),
        pesoEnCurso: w,
        courseId: cursoSeleccionado,
      });
    }
  };

  const sumaDraftIndicadores = useMemo(() => {
    return indicadoresDraft.reduce((s, r) => {
      const p = parseFloat(r.porcentaje);
      return s + (Number.isNaN(p) ? 0 : p);
    }, 0);
  }, [indicadoresDraft]);

  const submitIndicadoresLote = () => {
    if (!outcomeIdIndicadores) return;
    const conDatos = indicadoresDraft.filter((r) => r.nombre.trim() || r.porcentaje.trim());
    if (conDatos.length === 0) {
      if (!confirm("¿Quitar todos los indicadores de este logro?")) return;
      syncIndicadoresMutation.mutate({ outcomeId: outcomeIdIndicadores, indicadores: [] });
      return;
    }
    for (const r of conDatos) {
      if (!r.nombre.trim() || !r.porcentaje.trim()) {
        alert("Completa nombre y porcentaje en cada fila que uses.");
        return;
      }
      const p = parseFloat(r.porcentaje);
      if (Number.isNaN(p) || p < 0 || p > 100) {
        alert("Cada porcentaje debe estar entre 0 y 100.");
        return;
      }
    }
    const payload = conDatos.map((r) => ({
      nombre: r.nombre.trim(),
      porcentaje: parseFloat(r.porcentaje),
    }));
    const sum = payload.reduce((s, x) => s + x.porcentaje, 0);
    if (Math.abs(sum - 100) >= 0.01) {
      alert(`Los indicadores deben sumar exactamente 100% (suma actual: ${sum.toFixed(1)}%).`);
      return;
    }
    syncIndicadoresMutation.mutate({ outcomeId: outcomeIdIndicadores, indicadores: payload });
  };

  if (!user || user.rol !== "profesor") {
    setLocation("/dashboard");
    return null;
  }

  const backHref = contextualMode
    ? returnToQuery ||
      `/course/${encodeURIComponent(contextualGrupoId)}/grades${
        cursoSeleccionado ? `?${new URLSearchParams({ gs: cursoSeleccionado }).toString()}` : ""
      }`
    : "/profesor/academia";

  const backLabel = contextualMode
    ? groupInfoCtx?.nombre
      ? `Volver · ${groupInfoCtx.nombre}`
      : "Volver a notas del grupo"
    : "Academia";

  if (contextualMode && loadingSubjectsContext && subjectsForContext.length === 0) {
    return (
      <div className="p-4 sm:p-6 md:p-10 max-w-7xl mx-auto">
        <Skeleton className="h-10 w-48 bg-white/10 rounded-md mb-6" />
        <Skeleton className="h-40 w-full bg-white/10 rounded-xl" />
      </div>
    );
  }

  if (contextualMode && !loadingSubjectsContext && subjectsForContext.length === 0) {
    return (
      <div className="p-4 sm:p-6 md:p-10 max-w-7xl mx-auto">
        <NavBackButton to={returnToQuery || `/course-detail/${encodeURIComponent(contextualGrupoId)}`} label="Volver" />
        <p className="text-white/60 mt-6">No tienes materias asignadas en este grupo.</p>
      </div>
    );
  }

  const logros = logrosData?.logros ?? [];
  const totalPesoLogros = logrosData?.totalPesoLogros ?? 0;
  const logrosPesoCompleto = logrosData?.logrosPesoCompleto ?? false;
  const cursoActual = contextualMode
    ? subjectsForContext.find((c) => c._id === cursoSeleccionado)
    : cursos.find((c) => c._id === cursoSeleccionado);
  const cursoActualLabel = cursoActual?.nombre ?? "";

  const toggleExpand = (id: string) => {
    setExpanded((e) => ({ ...e, [id]: !e[id] }));
  };

  return (
    <div className="p-4 sm:p-6 md:p-10 max-w-7xl mx-auto w-full">
      <NavBackButton to={backHref} label={backLabel} />
      <div className="mt-4 mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-white font-['Poppins'] flex items-center gap-2">
          <Percent className="w-8 h-8 text-[#00c8ff] shrink-0" />
          Calificación: Logros
        </h1>
        <p className="text-white/60 mt-2 max-w-4xl">
          Puedes crear un logro (párrafo del criterio) sin indicadores y ajustar después el peso entre logros. Cuando definas indicadores para un logro, deben sumar 100% en ese logro para poder guardarlos. Idealmente los pesos entre logros suman 100% para la nota final.
        </p>
      </div>

      {contextualMode ? (
        <div
          className={`${CARD_STYLE} mb-6 rounded-xl border px-4 py-3 sm:px-5 sm:py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4`}
        >
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-wider text-white/45 mb-1">Materia en este grupo</p>
            <p className="text-white font-medium truncate">{cursoActualLabel || "…"}</p>
          </div>
          {subjectsForContext.length > 1 ? (
            <div className="flex flex-col gap-1 sm:items-end">
              <Label className="text-white/50 text-xs">Cambiar materia</Label>
              <select
                value={cursoSeleccionado}
                onChange={(e) => setCursoSeleccionado(e.target.value)}
                className="h-10 min-w-[min(100%,280px)] sm:min-w-[260px] px-3 rounded-lg bg-white/10 border border-white/20 text-white text-sm focus:ring-2 focus:ring-[#00c8ff]/50 focus:border-[#00c8ff]"
              >
                {subjectsForContext.map((s) => (
                  <option key={s._id} value={s._id}>
                    {s.nombre}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
        </div>
      ) : (
        <Card className={`${CARD_STYLE} mb-6`}>
          <CardHeader>
            <CardTitle className="text-white">Materia y grupo</CardTitle>
            <CardDescription className="text-white/60">
              Selecciona la materia y el grupo para configurar logros e indicadores. Cada combinación materia+grupo tiene su propia configuración.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingCursos ? (
              <Skeleton className="h-10 w-full bg-white/10 rounded-md" />
            ) : cursos.length === 0 ? (
              <p className="text-white/60 py-2">No tienes cursos asignados.</p>
            ) : (
              <select
                value={cursoSeleccionado}
                onChange={(e) => setCursoSeleccionado(e.target.value)}
                className="w-full h-10 px-3 rounded-md bg-white/10 border border-white/20 text-white focus:ring-2 focus:ring-[#00c8ff]/50 focus:border-[#00c8ff]"
              >
                <option value="">Selecciona materia y grupo</option>
                {cursos.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.nombre}
                  </option>
                ))}
              </select>
            )}
          </CardContent>
        </Card>
      )}

      {cursoSeleccionado && (
        <Card className={CARD_STYLE}>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <CardTitle className="text-white flex items-center gap-2">
                  <CheckSquare className="w-5 h-5 text-[#00c8ff]" />
                  Logros e indicadores
                </CardTitle>
                <CardDescription className="text-white/60 mt-1">
                  Para: <span className="text-[#00c8ff] font-medium">{cursoActualLabel}</span>. Los indicadores se guardan en bloque y solo si suman 100% en ese logro. El peso entre logros puedes completarlo cuando quieras.
                </CardDescription>
              </div>
              <Button
                onClick={abrirCrearLogro}
                disabled={loadingLogros}
                className="bg-[#00c8ff] hover:bg-[#00c8ff]/90 text-black font-medium shrink-0"
              >
                <Plus className="w-4 h-4 mr-2" />
                Crear logro
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div
              className={`mb-4 px-4 py-2 rounded-lg ${
                logrosPesoCompleto ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40" : "bg-amber-500/20 text-amber-300 border border-amber-500/40"
              }`}
            >
              Peso entre logros: {totalPesoLogros.toFixed(1)}%{" "}
              {logrosPesoCompleto ? "✓ Listo" : `(opcional por ahora; faltan ${(100 - totalPesoLogros).toFixed(1)}% para 100%)`}
            </div>

            {loadingLogros ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-12 w-full bg-white/10 rounded-lg" />
                ))}
              </div>
            ) : logros.length === 0 ? (
              <p className="text-white/60 py-6 text-center">
                No hay logros. Crea uno con la descripción del criterio; los indicadores son opcionales hasta que los configures.
              </p>
            ) : (
              <ul className="grid gap-3 sm:gap-4 lg:grid-cols-2 xl:gap-5">
                {logros.map((L) => {
                  const open = expanded[L._id] !== false;
                  const indicadoresList = Array.isArray(L.indicadores) ? L.indicadores : [];
                  const totalInd = typeof L.totalIndicadores === "number" ? L.totalIndicadores : indicadoresList.reduce((s, x) => s + (Number(x.porcentaje) || 0), 0);
                  const indCompletos = L.indicadoresCompletos === true || Math.abs(totalInd - 100) < 0.01;
                  return (
                    <li key={L._id} className="rounded-lg bg-white/5 border border-white/10 overflow-hidden">
                      <div className="flex items-start justify-between gap-2 p-4">
                        <button
                          type="button"
                          onClick={() => toggleExpand(L._id)}
                          className="flex-1 text-left flex items-start gap-2 min-w-0"
                        >
                          {open ? <ChevronUp className="w-5 h-5 text-[#00c8ff] shrink-0 mt-0.5" /> : <ChevronDown className="w-5 h-5 text-[#00c8ff] shrink-0 mt-0.5" />}
                          <div className="min-w-0">
                            <p className="text-white/50 text-xs uppercase tracking-wide mb-1">Logro · {Number(L.pesoEnCurso) || 0}% del curso</p>
                            <p className="text-white text-sm whitespace-pre-wrap">{L.descripcion || "(Sin descripción)"}</p>
                            <p
                              className={`text-xs mt-2 ${indCompletos ? "text-emerald-400" : "text-amber-300"}`}
                            >
                              Indicadores: {totalInd.toFixed(1)}% {indCompletos ? "✓" : "(deben sumar 100%)"}
                            </p>
                          </div>
                        </button>
                        <div className="flex gap-1 shrink-0">
                          <Button variant="ghost" size="sm" className="text-[#00c8ff]" onClick={() => abrirEditarLogro(L)}>
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-400"
                            onClick={() => {
                              if (confirm("¿Eliminar este logro y todos sus indicadores?")) deleteLogroMutation.mutate(L._id);
                            }}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                      {open && (
                        <div className="border-t border-white/10 px-4 py-3 bg-black/20">
                          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 mb-2">
                            <span className="text-white/70 text-sm">Indicadores</span>
                            <Button size="sm" variant="outline" className="border-[#00c8ff]/50 text-[#00c8ff]" onClick={() => abrirDialogIndicadores(L)}>
                              <ListPlus className="w-4 h-4 mr-1" />
                              {indicadoresList.length === 0 ? "Definir indicadores" : "Editar indicadores"}
                            </Button>
                          </div>
                          {indicadoresList.length === 0 ? (
                            <p className="text-white/40 text-sm py-2">Sin indicadores. Puedes añadirlos cuando quieras; al guardar, deben sumar 100%.</p>
                          ) : (
                            <ul className="space-y-2">
                              {[...indicadoresList]
                                .sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0))
                                .map((ind) => (
                                  <li
                                    key={ind._id}
                                    className="flex items-center py-2 px-3 rounded-md bg-white/5 border border-white/5"
                                  >
                                    <span className="text-white">
                                      {ind.nombre}{" "}
                                      <span className="text-[#00c8ff] font-semibold ml-2">{ind.porcentaje}%</span>
                                    </span>
                                  </li>
                                ))}
                            </ul>
                          )}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      <Dialog open={dialogLogroOpen} onOpenChange={(o) => !o && cerrarDialogLogro()}>
        <DialogContent className="bg-[#0f0f0f] border-white/10 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white">{editingLogroId ? "Editar logro" : "Crear logro"}</DialogTitle>
            <DialogDescription className="text-white/60">
              Describe el logro en un párrafo. El primer logro queda al 100% del curso; en logros adicionales puedes dejar el peso en 0 y repartir después.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-white/80">Descripción del logro</Label>
              <Textarea
                value={descripcionLogro}
                onChange={(e) => setDescripcionLogro(e.target.value)}
                placeholder="Ej: El estudiante desarrolla pensamiento crítico al analizar fuentes históricas..."
                rows={6}
                className="bg-white/10 border-white/20 text-white resize-y min-h-[120px]"
              />
            </div>
            {(editingLogroId || (logrosData?.logros?.length ?? 0) > 0) && (
              <div className="space-y-2">
                <Label className="text-white/80">Peso en la nota del curso (%)</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step={5}
                  value={pesoLogro}
                  onChange={(e) => setPesoLogro(e.target.value)}
                  placeholder={editingLogroId ? undefined : "0 = definir después"}
                  className="bg-white/10 border-white/20 text-white"
                />
                {!editingLogroId && (logrosData?.logros?.length ?? 0) > 0 && (
                  <p className="text-white/45 text-xs">Vacío o 0: puedes repartir pesos entre logros más tarde.</p>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={cerrarDialogLogro} className="border-white/20 text-white">
              Cancelar
            </Button>
            <Button
              onClick={submitLogro}
              disabled={createLogroMutation.isPending || updateLogroMutation.isPending}
              className="bg-[#00c8ff] hover:bg-[#00c8ff]/90 text-black"
            >
              {(createLogroMutation.isPending || updateLogroMutation.isPending) && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editingLogroId ? "Guardar" : "Crear"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialogIndicadoresOpen} onOpenChange={(o) => !o && cerrarDialogIndicadores()}>
        <DialogContent className="bg-[#0f0f0f] border-white/10 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white">Indicadores del logro</DialogTitle>
            <DialogDescription className="text-white/60">
              Añade filas con nombre y %. Para guardar con indicadores, la suma debe ser exactamente 100%. Deja todas las filas vacías y guarda para quitar indicadores.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-4">
            <div
              className={`text-sm px-3 py-2 rounded-md border ${
                indicadoresDraft.every((r) => !r.nombre.trim() && !r.porcentaje.trim())
                  ? "text-white/50 border-white/10"
                  : Math.abs(sumaDraftIndicadores - 100) < 0.01
                    ? "text-emerald-300 border-emerald-500/40 bg-emerald-500/10"
                    : "text-amber-300 border-amber-500/40 bg-amber-500/10"
              }`}
            >
              Suma actual: {sumaDraftIndicadores.toFixed(1)}%
              {!indicadoresDraft.every((r) => !r.nombre.trim() && !r.porcentaje.trim()) &&
                Math.abs(sumaDraftIndicadores - 100) >= 0.01 &&
                " — debe ser 100% para guardar"}
            </div>
            <div className="space-y-2">
              {indicadoresDraft.map((row, idx) => (
                <div key={idx} className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-end">
                  <div className="flex-1 space-y-1">
                    <Label className="text-white/70 text-xs">Nombre</Label>
                    <Input
                      value={row.nombre}
                      onChange={(e) => {
                        const v = e.target.value;
                        setIndicadoresDraft((d) => d.map((x, i) => (i === idx ? { ...x, nombre: v } : x)));
                      }}
                      placeholder="Ej: Tareas"
                      className="bg-white/10 border-white/20 text-white"
                    />
                  </div>
                  <div className="w-full sm:w-28 space-y-1">
                    <Label className="text-white/70 text-xs">%</Label>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      step={5}
                      value={row.porcentaje}
                      onChange={(e) => {
                        const v = e.target.value;
                        setIndicadoresDraft((d) => d.map((x, i) => (i === idx ? { ...x, porcentaje: v } : x)));
                      }}
                      className="bg-white/10 border-white/20 text-white"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-red-400 shrink-0"
                    onClick={() => setIndicadoresDraft((d) => (d.length <= 1 ? d : d.filter((_, i) => i !== idx)))}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="border-[#00c8ff]/50 text-[#00c8ff]"
              onClick={() => setIndicadoresDraft((d) => [...d, { nombre: "", porcentaje: "" }])}
            >
              <Plus className="w-4 h-4 mr-1" />
              Otra fila
            </Button>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={cerrarDialogIndicadores} className="border-white/20 text-white">
              Cancelar
            </Button>
            <Button
              onClick={submitIndicadoresLote}
              disabled={syncIndicadoresMutation.isPending}
              className="bg-[#00c8ff] hover:bg-[#00c8ff]/90 text-black"
            >
              {syncIndicadoresMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Guardar indicadores
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
