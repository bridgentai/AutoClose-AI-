"use client";

import { useRoute, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { NavBackButton } from "@/components/nav-back-button";
import { Clock, CheckCircle, BookOpen } from "lucide-react";
import { motion } from "framer-motion";

interface Subject {
  _id: string;
  nombre: string;
}

const DIAS_SEMANA = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];
const BLOQUES_HORA = [
  { inicio: '7:00', fin: '8:00', label: '7:00 – 8:00' },
  { inicio: '8:00', fin: '9:00', label: '8:00 – 9:00' },
  { inicio: '9:00', fin: '10:00', label: '9:00 – 10:00' },
  { inicio: '10:00', fin: '11:00', label: '10:00 – 11:00' },
  { inicio: '11:00', fin: '12:00', label: '11:00 – 12:00' },
];

export default function HorarioEscolarPage() {
  const [, params] = useRoute("/course/:grupoId/horario");
  const [, setLocation] = useLocation();
  const grupoId = params?.grupoId || "";
  const grupoDisplay = grupoId.toUpperCase().trim();

  const hoy = new Date();
  const diaActual = hoy.getDay();
  const fechaHoy = hoy.toISOString().slice(0, 10);

  const { data: subjects = [], isLoading } = useQuery<Subject[]>({
    queryKey: ["/api/courses/for-group", grupoId],
    queryFn: () => apiRequest("GET", `/api/courses/for-group/${encodeURIComponent(grupoId)}`),
    enabled: !!grupoId,
  });

  const { data: statusMap = {} } = useQuery<Record<string, { registrado: boolean }>>({
    queryKey: ["attendance-status", grupoId, fechaHoy, subjects],
    queryFn: async () => {
      const map: Record<string, { registrado: boolean }> = {};
      for (const s of subjects) {
        try {
          const r = await apiRequest<{ registrado: boolean }>(
            "GET",
            `/api/attendance/curso/${s._id}/fecha/${fechaHoy}/status`
          );
          map[s._id] = { registrado: r.registrado };
        } catch {
          map[s._id] = { registrado: false };
        }
      }
      return map;
    },
    enabled: !!grupoId && subjects.length > 0,
  });

  const getSubjectForBlock = (blockIndex: number) => subjects[blockIndex] || null;
  const getDateForDiaIndex = (diaIndex: number) => {
    const d = new Date(hoy);
    const offset = diaIndex - (diaActual === 0 ? -1 : diaActual - 1);
    d.setDate(d.getDate() + offset);
    return d.toISOString().slice(0, 10);
  };

  const handleBlockClick = (subject: Subject, bloque: { inicio: string; fin: string }, diaIndex: number) => {
    const fecha = getDateForDiaIndex(diaIndex);
    setLocation(
      `/course/${grupoId}/asistencia/registro?courseId=${subject._id}&fecha=${fecha}&hora=${bloque.inicio}&materia=${encodeURIComponent(subject.nombre)}`
    );
  };

  if (!grupoId) {
    setLocation("/profesor/academia/cursos");
    return null;
  }

  return (
    <div className="min-h-0 w-full" style={{ fontFamily: "Inter, system-ui, sans-serif" }}>
      <div className="relative z-10 w-full flex flex-col min-h-0">
        <div className="mb-6">
          <NavBackButton to="/profesor/academia/cursos" label="Cursos" />
        </div>
        <header className="mb-8">
          <h1 className="text-2xl font-semibold text-[#E2E8F0] mb-2 flex items-center gap-2">
            <Clock className="w-7 h-7 text-[#3B82F6]" />
            Horario Escolar – {grupoDisplay}
          </h1>
          <p className="text-white/60 text-sm">
            Haz clic en un bloque para registrar asistencia de esa clase
          </p>
        </header>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-24 rounded-xl bg-white/5 animate-pulse" />
            ))}
          </div>
        ) : subjects.length === 0 ? (
          <div className="rounded-2xl bg-white/5 border border-white/10 p-8 text-center">
            <BookOpen className="w-16 h-16 text-white/30 mx-auto mb-4" />
            <p className="text-white/60">No hay materias asignadas a este grupo.</p>
          </div>
        ) : (
          <div
            className="rounded-2xl overflow-hidden"
            style={{
              background: "rgba(255,255,255,0.02)",
              backdropFilter: "blur(12px)",
              border: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px] border-collapse">
                <thead>
                  <tr style={{ background: "rgba(255,255,255,0.04)", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                    <th className="w-32 py-4 px-4 text-left text-xs font-semibold text-white/80 uppercase tracking-wider">
                      Hora
                    </th>
                    {DIAS_SEMANA.map((dia, idx) => {
                      const esHoy = diaActual === idx + 1;
                      return (
                        <th
                          key={dia}
                          className="py-4 px-3 text-center text-xs font-semibold uppercase tracking-wider min-w-[140px]"
                          style={{
                            color: esHoy ? "#3B82F6" : "rgba(255,255,255,0.8)",
                            background: esHoy ? "rgba(59,130,246,0.12)" : "transparent",
                          }}
                        >
                          {dia}
                          {esHoy && (
                            <span className="block text-[10px] font-normal text-[#3B82F6]/90 mt-0.5">Hoy</span>
                          )}
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {BLOQUES_HORA.map((bloque, blockIdx) => (
                    <tr
                      key={bloque.inicio}
                      style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
                    >
                      <td className="py-3 px-4 text-sm text-white/70 font-medium">{bloque.label}</td>
                      {DIAS_SEMANA.map((_, diaIdx) => {
                        const subject = getSubjectForBlock(blockIdx);
                        const esHoy = diaActual === diaIdx + 1;
                        const registrado = subject ? statusMap[subject._id]?.registrado : false;
                        return (
                          <td key={diaIdx} className="p-2">
                            {subject ? (
                              <motion.button
                                type="button"
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                className="w-full py-3 px-3 rounded-xl text-left text-sm font-medium transition-all duration-200 flex items-center justify-between gap-2"
                                style={{
                                  background: esHoy ? "rgba(59,130,246,0.15)" : "rgba(255,255,255,0.05)",
                                  border: `1px solid ${esHoy ? "rgba(59,130,246,0.4)" : "rgba(255,255,255,0.08)"}`,
                                  color: "#E2E8F0",
                                }}
                                onClick={() => handleBlockClick(subject, bloque, diaIdx)}
                              >
                                <span className="truncate">{subject.nombre}</span>
                                {esHoy && registrado && (
                                  <span title="Asistencia registrada" className="inline-flex">
                                    <CheckCircle className="w-4 h-4 flex-shrink-0 text-[#10B981]" aria-hidden />
                                  </span>
                                )}
                              </motion.button>
                            ) : (
                              <div className="w-full py-3 px-3 rounded-xl bg-white/[0.02] border border-white/[0.04] text-white/30 text-sm text-center">
                                —
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
