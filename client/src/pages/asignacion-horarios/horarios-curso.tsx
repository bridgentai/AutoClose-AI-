"use client";

import { useState, useEffect, useMemo } from "react";
import { BookOpen, Check, Loader2 } from "lucide-react";
import { NavBackButton } from "@/components/nav-back-button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const DIAS = [1, 2, 3, 4, 5, 6] as const;

/** Horario hasta 2:25: última clase termina a las 14:25 */
const PERIODOS = [
  { num: 1, inicio: "7:30", fin: "8:25", especial: null },
  { num: 2, inicio: "8:25", fin: "9:20", especial: null },
  { num: 3, inicio: "9:20", fin: "10:15", especial: null },
  { num: 4, inicio: "10:15", fin: "10:35", especial: "Break" },
  { num: 5, inicio: "10:35", fin: "11:30", especial: null },
  { num: 6, inicio: "11:30", fin: "12:25", especial: null },
  { num: 7, inicio: "12:25", fin: "13:05", especial: "Almuerzo" },
  { num: 8, inicio: "13:05", fin: "14:00", especial: null },
  { num: 9, inicio: "14:00", fin: "14:25", especial: null },
];

interface Group {
  _id: string;
  nombre: string;
}

interface Professor {
  _id: string;
  nombre: string;
  email?: string;
}

interface Materia {
  _id: string;
  nombre: string;
  profesorIds?: Professor[];
  /** Nombres de grupos a los que se dicta esta materia (ej. ["11H", "10C"]) */
  cursos?: string[];
}

type SlotKey = string;

function slotKey(dia: number, periodo: number): SlotKey {
  return `${dia}-${periodo}`;
}

function toId(val: string | { _id?: string; $oid?: string; toString?: () => string } | null | undefined): string {
  if (val == null) return "";
  if (typeof val === "string") return val;
  if (typeof val === "object" && val !== null) {
    if (typeof (val as any).$oid === "string") return (val as any).$oid;
    if (typeof (val as any)._id === "string") return (val as any)._id;
    if ((val as any).toString && typeof (val as any).toString === "function") return (val as any).toString();
  }
  return String(val);
}

export default function HorariosCursoPage() {
  const [grupoId, setGrupoId] = useState<string>("");
  const [slots, setSlots] = useState<Record<SlotKey, string>>({});
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: groups = [] } = useQuery<Group[]>({
    queryKey: ["/api/groups/all"],
    queryFn: () => apiRequest("GET", "/api/groups/all"),
  });

  const { data: materias = [] } = useQuery<Materia[]>({
    queryKey: ["/api/courses/all"],
    queryFn: () => apiRequest("GET", "/api/courses"),
  });

  const grupoIdStr = toId(grupoId);
  const grupoNombre = groups.find((g) => toId(g._id) === grupoIdStr)?.nombre ?? grupoIdStr;

  /** Solo materias que se dictan a este grupo: así "Física" aparece una vez con el profesor que le da a 11H */
  const materiasParaEsteGrupo = useMemo(() => {
    const nombreNorm = String(grupoNombre || "").toUpperCase().trim();
    if (!nombreNorm) return [];
    return materias.filter(
      (m) =>
        Array.isArray(m.cursos) &&
        m.cursos.some((c) => String(c || "").toUpperCase().trim() === nombreNorm)
    );
  }, [materias, grupoNombre]);

  /** Una opción por materia: nombre + profesor que le da a este grupo (ya filtrado por grupo) */
  const opcionesMaterias = useMemo(
    () =>
      materiasParaEsteGrupo
        .map((m) => ({
          courseId: toId(m._id),
          nombre: (m.nombre || "").trim(),
          profesorNombre: m.profesorIds?.[0]?.nombre ?? "Sin profesor",
        }))
        .sort((a, b) => a.nombre.localeCompare(b.nombre)),
    [materiasParaEsteGrupo]
  );
  const { data: scheduleData, isLoading: loadingSchedule } = useQuery<{ slots: Record<string, string> }>({
    queryKey: ["/api/schedule/group", grupoIdStr],
    queryFn: () => apiRequest("GET", `/api/schedule/group/${encodeURIComponent(grupoIdStr)}`),
    enabled: !!grupoIdStr,
  });

  useEffect(() => {
    if (scheduleData?.slots && typeof scheduleData.slots === "object") {
      const raw = scheduleData.slots as Record<string, unknown>;
      const normalized: Record<SlotKey, string> = {};
      for (const [k, v] of Object.entries(raw)) {
        if (v == null || !k) continue;
        const str = typeof v === "string" ? v : (v && typeof v === "object" && "$oid" in v ? (v as { $oid: string }).$oid : String(v));
        normalized[k as SlotKey] = str;
      }
      setSlots(normalized);
    } else {
      setSlots({});
    }
  }, [scheduleData]);

  const saveMutation = useMutation({
    mutationFn: (payload: Record<string, string>) =>
      apiRequest("PUT", `/api/schedule/group/${encodeURIComponent(grupoIdStr)}`, { slots: payload }),
    onSuccess: (_, payload) => {
      queryClient.setQueryData(["/api/schedule/group", grupoIdStr], { slots: payload });
      queryClient.invalidateQueries({ queryKey: ["/api/schedule/group", grupoIdStr] });
      queryClient.invalidateQueries({ queryKey: ["/api/schedule/group-for-attendance"] });
      toast({ title: "Horario guardado", description: "El horario del curso se ha actualizado correctamente." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message || "No se pudo guardar el horario.", variant: "destructive" });
    },
  });

  const setSlot = (dia: number, periodo: number, courseId: string) => {
    const key = slotKey(dia, periodo);
    if (!courseId) {
      const next = { ...slots };
      delete next[key];
      setSlots(next);
    } else {
      setSlots((prev) => ({ ...prev, [key]: courseId }));
    }
  };

  const handleConfirmar = () => {
    if (!grupoIdStr) {
      toast({ title: "Selecciona un curso", variant: "destructive" });
      return;
    }
    saveMutation.mutate(slots);
  };

  const grupoDisplay = grupoIdStr ? groups.find((g) => toId(g._id) === grupoIdStr)?.nombre ?? grupoIdStr : "—";

  return (
    <div
      className="min-h-[calc(100vh-8rem)] w-full overflow-x-auto"
      style={{ fontFamily: "Inter, system-ui, sans-serif" }}
    >
      <div className="relative z-10 w-full flex flex-col min-h-0 p-6 md:p-10">
        <div className="mb-6">
          <NavBackButton to="/asignacion-horarios" label="Asignación de Horarios" />
        </div>

        <header className="mb-8">
          <h1 className="text-2xl font-semibold text-[#E2E8F0] mb-2 flex items-center gap-2">
            <BookOpen className="w-7 h-7 text-[#3B82F6]" />
            Horarios Curso
          </h1>
          <p className="text-white/60 text-sm">
            Edita cada casilla con una materia del colegio (se muestra su profesor). Confirma al final para guardar el horario del curso.
          </p>
        </header>

        <div className="mb-6 flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-white/70">Curso / Grupo:</span>
            <Select value={grupoIdStr || "none"} onValueChange={(v) => setGrupoId(v === "none" ? "" : v)}>
              <SelectTrigger className="w-[200px] rounded-xl bg-white/[0.06] border-white/10 text-[#E2E8F0]">
                <SelectValue placeholder="Seleccionar grupo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Seleccionar grupo</SelectItem>
                {groups.map((g) => (
                  <SelectItem key={toId(g._id)} value={toId(g._id)}>
                    {g.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div
          className="rounded-2xl overflow-hidden border border-white/10 shadow-xl"
          style={{
            background: "rgba(255,255,255,0.02)",
            backdropFilter: "blur(12px)",
          }}
        >
          <div
            className="px-6 py-4 border-b border-white/10"
            style={{ background: "linear-gradient(180deg, rgba(0,35,102,0.4), rgba(0,61,122,0.2))" }}
          >
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <h2 className="text-lg font-bold text-white font-['Poppins']">Horarios Curso</h2>
                <p className="text-[#E2E8F0]/80 text-sm">{grupoDisplay}</p>
              </div>
              <p className="text-xs text-white/50">Día 1 a 6 · Última clase 14:25</p>
            </div>
          </div>

          {loadingSchedule && grupoIdStr ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-8 h-8 animate-spin text-[#3B82F6]" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px] border-collapse">
                <thead>
                  <tr className="border-b border-white/10" style={{ background: "rgba(59,130,246,0.12)" }}>
                    <th className="w-24 py-3 px-3 text-left text-xs font-semibold text-[#E2E8F0] uppercase tracking-wider border-r border-white/10">
                      Período
                    </th>
                    <th className="w-28 py-3 px-3 text-left text-xs font-semibold text-white/70 uppercase tracking-wider border-r border-white/10">
                      Horario
                    </th>
                    {DIAS.map((d) => (
                      <th
                        key={d}
                        className="min-w-[120px] py-3 px-3 text-center text-xs font-semibold text-[#E2E8F0] uppercase tracking-wider border-r border-white/10 last:border-r-0"
                        style={{ background: "rgba(59,130,246,0.08)" }}
                      >
                        DÍA {d}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {PERIODOS.map((per, idx) => (
                    <tr
                      key={per.num}
                      className={`border-b border-white/[0.06] ${idx % 2 === 1 ? "bg-white/[0.02]" : ""}`}
                    >
                      <td className="py-2.5 px-3 text-sm font-semibold text-[#3B82F6] border-r border-white/10">
                        {per.num}
                      </td>
                      <td className="py-2.5 px-3 text-xs text-white/60 border-r border-white/10">
                        {per.inicio} – {per.fin}
                      </td>
                      {DIAS.map((dia) => (
                        <td
                          key={dia}
                          className="min-w-[120px] py-2.5 px-3 align-top border-r border-white/[0.06] last:border-r-0"
                        >
                          {per.especial ? (
                            <div
                              className="rounded-lg py-2 px-2 text-center text-xs font-medium"
                              style={{
                                background: "rgba(255,255,255,0.06)",
                                color: "rgba(226,232,240,0.8)",
                                border: "1px solid rgba(255,255,255,0.08)",
                              }}
                            >
                              {per.especial}
                            </div>
                          ) : (
                            <CeldaMateria
                              materias={materias}
                              opcionesMaterias={opcionesMaterias}
                              value={slots[slotKey(dia, per.num)]}
                              onSelect={(courseId) => setSlot(dia, per.num, courseId)}
                            />
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div
            className="px-6 py-4 border-t border-white/10 flex flex-wrap items-center justify-between gap-4"
            style={{ background: "rgba(0,0,0,0.15)" }}
          >
            <p className="text-xs text-white/40">Horarios Curso · MindOS</p>
            <Button
              onClick={handleConfirmar}
              disabled={!grupoIdStr || saveMutation.isPending}
              className="rounded-xl bg-[#3B82F6] hover:bg-[#2563EB] text-white font-medium px-6"
            >
              {saveMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Guardando…
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  Confirmar y guardar horario
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function CeldaMateria({
  materias,
  opcionesMaterias,
  value,
  onSelect,
}: {
  materias: Materia[];
  opcionesMaterias: { courseId: string; nombre: string; profesorNombre: string }[];
  value: string;
  onSelect: (courseId: string) => void;
}) {
  const valueStr = toId(value);
  const materia = materias.find((m) => toId(m._id) === valueStr);
  const nombreDisplay = materia?.nombre ?? "—";
  const profesorDisplay = materia?.profesorIds?.[0]?.nombre ?? "—";

  return (
    <Select value={valueStr || "vacío"} onValueChange={(v) => onSelect(v === "vacío" ? "" : v)}>
      <SelectTrigger
        className="h-auto min-h-[52px] rounded-lg border-white/10 bg-white/[0.03] text-[#E2E8F0] text-xs"
      >
        <SelectValue placeholder="Materia">
          {materia ? (
            <>
              <span className="block font-medium truncate">{nombreDisplay}</span>
              <span className="block text-white/50 truncate">{profesorDisplay}</span>
            </>
          ) : (
            <span className="text-white/40">Materia</span>
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="vacío">— Sin asignar</SelectItem>
        {opcionesMaterias.map((u) => (
          <SelectItem key={u.courseId} value={u.courseId}>
            <span>{u.nombre}</span>
            <span className="text-white/60"> — </span>
            <span className="text-xs text-white/60">{u.profesorNombre}</span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
