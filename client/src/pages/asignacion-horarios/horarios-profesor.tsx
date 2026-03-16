"use client";

import { useState, useEffect } from "react";
import { User, Check, Loader2 } from "lucide-react";
import { NavBackButton } from "@/components/nav-back-button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const DIAS = [1, 2, 3, 4, 5, 6] as const;

/** Mismos períodos que Horarios Curso: última clase hasta 14:25 */
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

export default function HorariosProfesorPage() {
  const [profesorId, setProfesorId] = useState<string>("");
  const [slots, setSlots] = useState<Record<SlotKey, string>>({});
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: professors = [] } = useQuery<Professor[]>({
    queryKey: ["/api/users/by-role", "profesor"],
    queryFn: () => apiRequest("GET", "/api/users/by-role?rol=profesor"),
  });

  const { data: groups = [] } = useQuery<Group[]>({
    queryKey: ["/api/groups/all"],
    queryFn: () => apiRequest("GET", "/api/groups/all"),
  });

  const profesorIdStr = toId(profesorId);
  const { data: scheduleData, isLoading: loadingSchedule } = useQuery<{ slots: Record<string, string> }>({
    queryKey: ["/api/schedule/professor", profesorIdStr],
    queryFn: () => apiRequest("GET", `/api/schedule/professor/${encodeURIComponent(profesorIdStr)}`),
    enabled: !!profesorIdStr,
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
      apiRequest("PUT", `/api/schedule/professor/${encodeURIComponent(profesorIdStr)}`, { slots: payload }),
    onSuccess: (_, payload) => {
      queryClient.setQueryData(["/api/schedule/professor", profesorIdStr], { slots: payload });
      queryClient.invalidateQueries({ queryKey: ["/api/schedule/professor", profesorIdStr] });
      queryClient.invalidateQueries({ queryKey: ["/api/schedule/my-professor"] });
      toast({ title: "Horario guardado", description: "El horario del profesor se ha actualizado correctamente." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message || "No se pudo guardar el horario.", variant: "destructive" });
    },
  });

  const setSlot = (dia: number, periodo: number, grupoId: string) => {
    const key = slotKey(dia, periodo);
    if (!grupoId) {
      const next = { ...slots };
      delete next[key];
      setSlots(next);
    } else {
      setSlots((prev) => ({ ...prev, [key]: grupoId }));
    }
  };

  const handleConfirmar = () => {
    if (!profesorIdStr) {
      toast({ title: "Selecciona un profesor", variant: "destructive" });
      return;
    }
    saveMutation.mutate(slots);
  };

  const profesorDisplay = profesorIdStr
    ? professors.find((p) => toId(p._id) === profesorIdStr)?.nombre ?? "—"
    : "—";

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
            <User className="w-7 h-7 text-emerald-400" />
            Horarios Profesor
          </h1>
          <p className="text-white/60 text-sm">
            Edita cada casilla con un grupo o curso existente del colegio. Confirma al final para guardar el horario del profesor.
          </p>
        </header>

        <div className="mb-6 flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-white/70">Profesor:</span>
            <Select value={profesorIdStr || "none"} onValueChange={(v) => setProfesorId(v === "none" ? "" : v)}>
              <SelectTrigger className="w-[220px] rounded-xl bg-white/[0.06] border-white/10 text-[#E2E8F0]">
                <SelectValue placeholder="Seleccionar profesor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Seleccionar profesor</SelectItem>
                {professors.map((p) => (
                  <SelectItem key={toId(p._id)} value={toId(p._id)}>
                    {p.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div
          className="rounded-2xl overflow-hidden border border-white/10 shadow-xl"
          style={{
            background: "linear-gradient(145deg, rgba(30,58,138,0.35), rgba(15,23,42,0.6))",
            backdropFilter: "blur(20px)",
            boxShadow: "0 0 40px rgba(37,99,235,0.25)",
          }}
        >
          <div
            className="px-6 py-4 border-b border-white/10"
            style={{ background: "linear-gradient(180deg, rgba(5,150,105,0.35), rgba(16,185,129,0.15))" }}
          >
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <h2 className="text-lg font-bold text-white font-['Poppins']">Horarios Profesor</h2>
                <p className="text-[#E2E8F0]/80 text-sm">{profesorDisplay}</p>
              </div>
              <p className="text-xs text-white/50">Día 1 a 6 · Última clase 14:25</p>
            </div>
          </div>

          {loadingSchedule && profesorIdStr ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px] border-collapse">
                <thead>
                  <tr className="border-b border-white/10" style={{ background: "rgba(16,185,129,0.12)" }}>
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
                        style={{ background: "rgba(16,185,129,0.08)" }}
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
                      <td className="py-2.5 px-3 text-sm font-semibold text-emerald-400 border-r border-white/10">
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
                            <CeldaGrupo
                              dia={dia}
                              periodo={per.num}
                              groups={groups}
                              value={slots[slotKey(dia, per.num)]}
                              onSelect={(grupoId) => setSlot(dia, per.num, grupoId)}
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
            <p className="text-xs text-white/40">Horarios Profesor · MindOS</p>
            <Button
              onClick={handleConfirmar}
              disabled={!profesorIdStr || saveMutation.isPending}
              className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-6"
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

function CeldaGrupo({
  dia,
  periodo,
  groups,
  value,
  onSelect,
}: {
  dia: number;
  periodo: number;
  groups: Group[];
  value: string;
  onSelect: (grupoId: string) => void;
}) {
  const valueStr = toId(value);
  const group = groups.find((g) => toId(g._id) === valueStr);

  return (
    <Select value={valueStr || "vacío"} onValueChange={(v) => onSelect(v === "vacío" ? "" : v)}>
      <SelectTrigger
        className="h-auto min-h-[52px] rounded-lg border-white/10 bg-white/[0.03] text-[#E2E8F0] text-xs"
      >
        <SelectValue placeholder="Grupo">
          {group ? (
            <span className="block font-medium truncate">{group.nombre}</span>
          ) : (
            <span className="text-white/40">Grupo / Curso</span>
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="vacío">— Sin asignar</SelectItem>
        {groups.map((g) => (
          <SelectItem key={toId(g._id)} value={toId(g._id)}>
            {g.nombre}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
