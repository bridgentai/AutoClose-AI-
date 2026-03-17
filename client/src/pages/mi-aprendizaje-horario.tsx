"use client";

import { useEffect } from "react";
import { useLocation } from "wouter";
import { NavBackButton } from "@/components/nav-back-button";
import { useAuth } from "@/lib/authContext";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Loader2, Clock } from "lucide-react";

const DIAS = [1, 2, 3, 4, 5, 6] as const;

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

type SlotKey = string;

function slotKey(dia: number, periodo: number): SlotKey {
  return `${dia}-${periodo}`;
}

function toId(val: string | { _id?: string; $oid?: string } | null | undefined): string {
  if (val == null) return "";
  if (typeof val === "string") return val;
  if (typeof val === "object" && val !== null) {
    if (typeof (val as any).$oid === "string") return (val as any).$oid;
    if (typeof (val as any)._id === "string") return (val as any)._id;
  }
  return String(val);
}

interface Materia {
  _id: string;
  nombre: string;
  profesorIds?: { nombre?: string }[];
}

export default function MiAprendizajeHorarioPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (user && user.rol !== "estudiante") {
      setLocation("/dashboard");
    }
  }, [user, setLocation]);

  const { data: scheduleData, isLoading: loadingSchedule } = useQuery<{
    grupoNombre?: string;
    slots: Record<string, string>;
  }>({
    queryKey: ["/api/schedule/my-group", user?.id],
    queryFn: () => apiRequest("GET", "/api/schedule/my-group"),
    enabled: !!user?.id && user?.rol === "estudiante",
    staleTime: 0,
    refetchOnMount: "always",
  });

  const { data: materias = [] } = useQuery<Materia[]>({
    queryKey: ["/api/courses/all"],
    queryFn: () => apiRequest("GET", "/api/courses"),
    enabled: !!user?.id && user?.rol === "estudiante",
  });

  if (!user || user.rol !== "estudiante") {
    return null;
  }

  // Normalizar slots: valores pueden venir como string o { $oid } desde la API
  const rawSlots = scheduleData?.slots && typeof scheduleData.slots === "object" ? scheduleData.slots : {};
  const slots: Record<string, string> = {};
  for (const [k, v] of Object.entries(rawSlots)) {
    if (k && v != null) slots[k] = toId(v as string | { $oid?: string });
  }
  const grupoNombre = scheduleData?.grupoNombre ?? user?.curso ?? "Mi curso";

  return (
    <div className="min-h-screen bg-[#0a0f1a] text-[#E2E8F0] p-6">
      <NavBackButton to="/mi-aprendizaje" label="Mi Aprendizaje" />
      <div className="max-w-6xl mx-auto mt-4">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-xl bg-[#1e3cff]/20 flex items-center justify-center">
            <Clock className="w-6 h-6 text-[#3B82F6]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white font-['Poppins']">Horario</h1>
            <p className="text-[#E2E8F0]/80 text-sm">Curso {grupoNombre} · Solo lectura</p>
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
                <h2 className="text-lg font-bold text-white font-['Poppins']">Tu horario semanal</h2>
                <p className="text-[#E2E8F0]/80 text-sm">
                  Cuando el directivo confirme el horario de tu curso, se actualizará aquí.
                </p>
              </div>
              <p className="text-xs text-white/50">Día 1 a 6 · Última clase 14:25</p>
            </div>
          </div>

          {loadingSchedule ? (
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
                            <CeldaLectura
                              materias={materias}
                              courseId={slots[slotKey(dia, per.num)]}
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
            className="px-6 py-4 border-t border-white/10"
            style={{ background: "rgba(0,0,0,0.15)" }}
          >
            <p className="text-xs text-white/40">Mi Aprendizaje · Horario · EvoOS</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function CeldaLectura({
  materias,
  courseId,
}: {
  materias: Materia[];
  courseId: string | undefined;
}) {
  const idStr = toId(courseId);
  const materia = materias.find((m) => toId(m._id) === idStr);
  const nombre = materia?.nombre ?? "—";
  const profesor = materia?.profesorIds?.[0]?.nombre ?? "";

  return (
    <div
      className="min-h-[52px] rounded-lg border border-white/10 bg-white/[0.03] text-[#E2E8F0] text-xs p-2"
    >
      <span className="block font-medium truncate">{nombre}</span>
      {profesor ? <span className="block text-white/50 truncate">{profesor}</span> : null}
    </div>
  );
}
