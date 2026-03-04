"use client";

import { useState, useMemo } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { NavBackButton } from "@/components/nav-back-button";
import { Button } from "@/components/ui/button";
import { Calendar as CalendarIcon, CheckCircle, ChevronRight, Clock, AlertCircle } from "lucide-react";
import { motion } from "framer-motion";

/** Mismos períodos que el horario del directivo (Horarios Curso/Profesor) */
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

const DIAS_OPCIONES = [1, 2, 3, 4, 5, 6];

function toId(v: string | { _id?: string; $oid?: string } | null | undefined): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "object" && v !== null) {
    if (typeof (v as any).$oid === "string") return (v as any).$oid;
    if (typeof (v as any)._id === "string") return (v as any)._id;
  }
  return String(v);
}

function slotKey(dia: number, periodo: number): string {
  return `${dia}-${periodo}`;
}

interface Course {
  _id: string;
  nombre: string;
}

export default function AsistenciaSelectorPage() {
  const [, params] = useRoute("/course/:grupoId/asistencia");
  const [, setLocation] = useLocation();
  const grupoId = params?.grupoId || "";
  const grupoDisplay = grupoId.toUpperCase().trim();

  const hoy = new Date();
  const fechaDefault = hoy.toISOString().slice(0, 10);
  const [fecha, setFecha] = useState(fechaDefault);
  const [diaSeleccionado, setDiaSeleccionado] = useState<number | null>(null);
  const [slotSeleccionado, setSlotSeleccionado] = useState<{ courseId: string; materia: string; inicio: string; fin: string } | null>(null);

  const { data: profScheduleData } = useQuery<{ slots: Record<string, string> }>({
    queryKey: ["/api/schedule/my-professor"],
    queryFn: () => apiRequest("GET", "/api/schedule/my-professor"),
    enabled: !!grupoId,
  });

  const { data: groupScheduleData, isError: groupScheduleError, refetch: refetchGroupSchedule } = useQuery<{ grupoId?: string; grupoNombre?: string; slots: Record<string, string> }>({
    queryKey: ["/api/schedule/group-for-attendance", grupoId],
    queryFn: () => apiRequest("GET", `/api/schedule/group-for-attendance/${encodeURIComponent(grupoId)}`),
    enabled: !!grupoId,
    retry: 2,
    staleTime: 0,
    refetchOnMount: "always",
  });

  const { data: courses = [] } = useQuery<Course[]>({
    queryKey: ["/api/courses/all"],
    queryFn: () => apiRequest("GET", "/api/courses"),
    enabled: !!grupoId,
  });

  const groupIdStr = groupScheduleData?.grupoId ? toId(groupScheduleData.grupoId) : "";
  const grupoNombre = (groupScheduleData?.grupoNombre ?? "").trim();
  const profSlots = useMemo(() => {
    const raw = profScheduleData?.slots && typeof profScheduleData.slots === "object" ? profScheduleData.slots : {};
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(raw)) {
      if (k && v != null) out[k] = toId(v as string | { $oid?: string });
    }
    return out;
  }, [profScheduleData?.slots]);
  const groupSlots = useMemo(() => {
    const raw = groupScheduleData?.slots && typeof groupScheduleData.slots === "object" ? groupScheduleData.slots : {};
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(raw)) {
      if (k && v != null) out[k] = toId(v as string | { $oid?: string });
    }
    return out;
  }, [groupScheduleData?.slots]);

  const courseById = useMemo(() => {
    const map: Record<string, string> = {};
    courses.forEach((c) => {
      map[toId(c._id)] = c.nombre || "";
    });
    return map;
  }, [courses]);

  /** Si en el horario del profesor aparece este grupo (por nombre o id de la URL) */
  const profScheduleContainsGroup = useMemo(() => {
    const search = (grupoId || "").trim().toUpperCase();
    if (!search) return false;
    return Object.values(profSlots).some((v) => (v || "").trim().toUpperCase() === search);
  }, [grupoId, profSlots]);

  /** Comprueba si el valor del slot del profesor corresponde a este grupo (_id o nombre de API, o nombre de la URL) */
  const slotMatchesGroup = (slotVal: string) => {
    const s = (slotVal || "").trim();
    if (!s) return false;
    if (s === groupIdStr) return true;
    if (grupoNombre && s.toUpperCase() === grupoNombre.toUpperCase()) return true;
    if ((grupoId || "").trim().toUpperCase() === s.toUpperCase()) return true;
    return false;
  };

  /** Slots donde el profesor tiene este grupo: solo los días/horas donde EN SU HORARIO aparece este grupo. */
  const slotsConEsteGrupo = useMemo(() => {
    const list: { dia: number; periodo: number; courseId: string; materia: string; inicio: string; fin: string }[] = [];
    const fallbackCourseId = Object.values(groupSlots)[0] || (courses.length ? toId(courses[0]._id) : "");
    for (let dia = 1; dia <= 6; dia++) {
      for (const per of PERIODOS) {
        if (per.especial) continue;
        const key = slotKey(dia, per.num);
        const profTieneEsteSlot = slotMatchesGroup(profSlots[key]);
        if (!profTieneEsteSlot) continue;
        const courseId = groupSlots[key] || fallbackCourseId;
        list.push({
          dia,
          periodo: per.num,
          courseId,
          materia: courseById[courseId] || "Materia",
          inicio: per.inicio,
          fin: per.fin,
        });
      }
    }
    return list;
  }, [groupIdStr, grupoNombre, grupoId, profSlots, groupSlots, courseById, courses]);

  const slotsDelDia = useMemo(() => {
    if (diaSeleccionado == null) return [];
    return slotsConEsteGrupo.filter((s) => s.dia === diaSeleccionado);
  }, [diaSeleccionado, slotsConEsteGrupo]);

  const handleContinuar = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!slotSeleccionado || !fecha) return;
    const url = `/course/${grupoId}/asistencia/registro?courseId=${encodeURIComponent(slotSeleccionado.courseId)}&fecha=${encodeURIComponent(fecha)}&hora=${encodeURIComponent(slotSeleccionado.inicio)}&materia=${encodeURIComponent(slotSeleccionado.materia)}`;
    setLocation(url);
  };

  const noTieneClaseConGrupo = groupScheduleError && !profScheduleContainsGroup;
  const errorPeroTieneGrupoEnHorario = groupScheduleError && profScheduleContainsGroup;
  const grupoNoEncontrado = Boolean(groupScheduleData && !groupIdStr && !groupScheduleError);
  const horarioGrupoSinDefinir = Boolean(groupIdStr && slotsConEsteGrupo.length === 0 && groupScheduleData && !groupScheduleError);
  const puedeContinuar = Boolean(fecha && slotSeleccionado && slotsDelDia.length > 0);
  const isLoading = !groupScheduleData && !groupScheduleError;

  if (!grupoId) {
    setLocation("/profesor/academia/cursos");
    return null;
  }

  return (
    <div
      className="min-h-[calc(100vh-8rem)] w-full"
      style={{ fontFamily: "Inter, system-ui, sans-serif" }}
    >
      <div className="relative z-10 w-full flex flex-col min-h-0 max-w-2xl mx-auto">
        <div className="mb-6">
          <NavBackButton to={`/course-detail/${grupoId}`} label={`Grupo ${grupoDisplay}`} />
        </div>

        <header className="mb-8">
          <h1 className="text-2xl font-semibold text-[#E2E8F0] mb-2 flex items-center gap-2">
            <CheckCircle className="w-7 h-7 text-emerald-500" />
            Registrar Asistencia – {grupoDisplay}
          </h1>
          <p className="text-white/60 text-sm">
            Elige la fecha y el día. Solo podrás continuar si tienes clase con este grupo ese día según tu horario.
          </p>
        </header>

        {isLoading ? (
          <div className="space-y-4">
            <div className="h-24 rounded-2xl bg-white/5 animate-pulse" />
            <div className="h-32 rounded-2xl bg-white/5 animate-pulse" />
          </div>
        ) : errorPeroTieneGrupoEnHorario ? (
          <div
            className="rounded-2xl p-8 text-center border border-emerald-500/30 bg-emerald-500/10"
          >
            <CheckCircle className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
            <p className="text-white/90 font-medium">Tu horario incluye este grupo ({grupoDisplay}).</p>
            <p className="text-white/60 text-sm mt-1">No se pudo cargar el detalle del horario. Recarga la página o pulsa Reintentar.</p>
            <Button
              type="button"
              onClick={() => refetchGroupSchedule()}
              className="mt-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white"
            >
              Reintentar
            </Button>
          </div>
        ) : noTieneClaseConGrupo ? (
          <div
            className="rounded-2xl p-8 text-center border border-amber-500/30 bg-amber-500/10"
          >
            <AlertCircle className="w-12 h-12 text-amber-400 mx-auto mb-3" />
            <p className="text-white/90 font-medium">No se pudo cargar el horario.</p>
            <p className="text-white/60 text-sm mt-1">Revisa tu conexión o intenta de nuevo más tarde.</p>
          </div>
        ) : grupoNoEncontrado ? (
          <div
            className="rounded-2xl p-8 text-center border border-white/10 bg-white/[0.03]"
          >
            <p className="text-white/80 font-medium">No se encontró el grupo {grupoDisplay}.</p>
            <p className="text-white/50 text-sm mt-1">Verifica que el curso exista en el colegio.</p>
          </div>
        ) : horarioGrupoSinDefinir ? (
          <div
            className="rounded-2xl p-8 text-center border border-white/10 bg-white/[0.03]"
          >
            <Clock className="w-12 h-12 text-white/30 mx-auto mb-3" />
            <p className="text-white/80 font-medium">Tu horario no tiene clase con este grupo en ningún día.</p>
            <p className="text-white/50 text-sm mt-1">Solo puedes tomar asistencia en los días y horas donde tu horario indica que tienes clase con {grupoDisplay}.</p>
          </div>
        ) : (
          <>
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="rounded-2xl overflow-hidden space-y-8"
              style={{
                background: "rgba(255,255,255,0.02)",
                backdropFilter: "blur(12px)",
                border: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              <div className="p-6 sm:p-8">
                <label className="block text-sm font-semibold text-[#3B82F6] uppercase tracking-wider mb-3 flex items-center gap-2">
                  <CalendarIcon className="w-4 h-4" />
                  Fecha
                </label>
                <input
                  type="date"
                  value={fecha}
                  onChange={(e) => setFecha(e.target.value)}
                  className="w-full rounded-xl px-4 py-3.5 bg-white/[0.06] border border-white/10 text-[#E2E8F0] placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/50 focus:border-[#3B82F6]/50 transition-all"
                />
              </div>

              <div className="px-6 sm:px-8 pb-6 sm:pb-8">
                <label className="block text-sm font-semibold text-white/70 uppercase tracking-wider mb-4">
                  Día (1 a 6)
                </label>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
                  {DIAS_OPCIONES.map((d) => {
                    const tieneClase = slotsConEsteGrupo.some((s) => s.dia === d);
                    const isSelected = diaSeleccionado === d;
                    return (
                      <motion.button
                        key={d}
                        type="button"
                        whileHover={tieneClase ? { scale: 1.03 } : {}}
                        whileTap={tieneClase ? { scale: 0.98 } : {}}
                        onClick={() => {
                          setDiaSeleccionado(d);
                          setSlotSeleccionado(null);
                          const slots = slotsConEsteGrupo.filter((s) => s.dia === d);
                          if (slots.length === 1) setSlotSeleccionado(slots[0]);
                        }}
                        className={`
                          rounded-xl py-4 px-3 text-center font-semibold text-sm transition-all duration-200
                          ${!tieneClase ? "opacity-50 cursor-not-allowed bg-white/[0.02] border border-white/5 text-white/40" : ""}
                          ${tieneClase && isSelected
                            ? "bg-[#10B981]/25 border-2 border-[#10B981] text-[#6EE7B7] shadow-lg shadow-emerald-500/20"
                            : tieneClase
                              ? "bg-white/[0.04] border border-white/10 text-white/80 hover:bg-white/[0.08] hover:border-white/20"
                              : ""}
                        `}
                      >
                        <span className="block text-lg font-bold">{d}</span>
                        <span className="block text-xs opacity-80 mt-0.5">Día {d}</span>
                      </motion.button>
                    );
                  })}
                </div>

                {diaSeleccionado != null && slotsDelDia.length === 0 && (
                  <p className="mt-4 text-sm text-amber-400/90 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    No tienes clase con {grupoDisplay} el día {diaSeleccionado}. Elige otro día.
                  </p>
                )}

                {diaSeleccionado != null && slotsDelDia.length > 0 && (
                  <div className="mt-4">
                    <label className="block text-sm font-semibold text-white/70 mb-2">Clase ese día (según tu horario)</label>
                    <div className="space-y-2">
                      {slotsDelDia.map((slot) => {
                        const isSelected = slotSeleccionado?.courseId === slot.courseId && slotSeleccionado?.inicio === slot.inicio;
                        return (
                          <button
                            key={`${slot.dia}-${slot.periodo}-${slot.courseId}`}
                            type="button"
                            onClick={() => setSlotSeleccionado(slot)}
                            className={`w-full rounded-xl py-3 px-4 text-left flex items-center gap-3 transition-all border
                              ${isSelected
                                ? "bg-[#10B981]/20 border-[#10B981] text-[#E2E8F0]"
                                : "bg-white/[0.04] border-white/10 text-white/80 hover:bg-white/[0.08]"
                              }`}
                          >
                            <Clock className="w-5 h-5 text-[#10B981] flex-shrink-0" />
                            <div>
                              <span className="font-medium block">{slot.materia}</span>
                              <span className="text-xs text-white/50">{slot.inicio} – {slot.fin}</span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>

            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              <Button
                type="button"
                onClick={handleContinuar}
                disabled={!puedeContinuar}
                className="rounded-[12px] bg-[#10B981] hover:bg-emerald-600 text-white font-medium px-6 py-3 flex items-center justify-center gap-2"
              >
                Continuar
                <ChevronRight className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                onClick={() => setLocation(`/course-detail/${grupoId}`)}
                className="rounded-[12px] border-white/10 text-[#E2E8F0] hover:bg-white/5"
              >
                Cancelar
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
