"use client";

import { useState, useMemo } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Breadcrumb } from "@/components/Breadcrumb";
import { Button } from "@/components/ui/button";
import { Calendar as CalendarIcon, CheckCircle, ChevronRight, Clock, AlertCircle } from "lucide-react";
import { motion } from "framer-motion";

/** 6 horas de clase, 1 break, 1 almuerzo. Alineado con Horarios Curso/Profesor. */
const PERIODOS = [
  { num: 1, inicio: "7:30", fin: "8:25", especial: null },
  { num: 2, inicio: "8:30", fin: "9:25", especial: null },
  { num: 3, inicio: "9:30", fin: "10:30", especial: null },
  { num: 4, inicio: "10:30", fin: "10:50", especial: "Break" },
  { num: 5, inicio: "10:50", fin: "11:45", especial: null },
  { num: 6, inicio: "11:50", fin: "12:50", especial: null },
  { num: 7, inicio: "12:50", fin: "13:35", especial: "Almuerzo" },
  { num: 8, inicio: "13:35", fin: "14:25", especial: null },
];

const DIAS_OPCIONES = [1, 2, 3, 4, 5, 6];

/** Periodos de clase (sin break ni almuerzo), para modo reemplazo. */
const PERIODOS_CLASE = PERIODOS.filter((p) => !p.especial);

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
  /** Nombres de grupo a los que se dicta esta materia (ej. ["11H"]) */
  cursos?: string[];
}

interface GroupOption {
  _id: string;
  id: string;
  nombre: string;
}

function looksLikeUuid(s: string): boolean {
  return s.length === 36 && s.includes("-");
}

export default function AsistenciaSelectorPage() {
  const [, params] = useRoute("/course/:grupoId/asistencia");
  const [, setLocation] = useLocation();
  const grupoId = params?.grupoId || "";
  const search = typeof window !== "undefined" ? window.location.search : "";
  const searchParams = new URLSearchParams(search);
  const returnTo = searchParams.get("returnTo") || `/course-detail/${grupoId}`;
  const materiaNombreParam = (searchParams.get("materiaNombre") || "").trim();
  const grupoDisplay = grupoId.toUpperCase().trim();

  const { data: groupInfo } = useQuery<{ _id: string; id: string; nombre: string }>({
    queryKey: ["/api/groups", grupoId],
    queryFn: () => apiRequest("GET", `/api/groups/${encodeURIComponent(grupoId)}`),
    enabled: !!grupoId,
    staleTime: 5 * 60 * 1000,
  });
  const groupDisplayName = (groupInfo?.nombre?.trim() || grupoDisplay) as string;
  const asistenciaDisplayName = materiaNombreParam
    ? `${materiaNombreParam} ${groupDisplayName}`.trim()
    : `Grupo ${groupDisplayName}`;

  const hoy = new Date();
  const fechaDefault = hoy.toISOString().slice(0, 10);
  const [fecha, setFecha] = useState(fechaDefault);
  const [diaSeleccionado, setDiaSeleccionado] = useState<number | null>(null);
  const [slotSeleccionado, setSlotSeleccionado] = useState<{ courseId: string; materia: string; inicio: string; fin: string } | null>(null);
  /** Profesor suplente / clase fuera de horario: habilita los 6 días y todos los bloques de clase. */
  const [modoReemplazo, setModoReemplazo] = useState(false);

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

  const { data: groupsList = [] } = useQuery<GroupOption[]>({
    queryKey: ["/api/groups/all"],
    queryFn: () => apiRequest("GET", "/api/groups/all"),
    enabled: !!grupoId,
  });

  const groupIdStr = groupScheduleData?.grupoId ? toId(groupScheduleData.grupoId) : "";
  const grupoNombre = (groupScheduleData?.grupoNombre ?? "").trim();
  const groupNameByUuid = useMemo(() => {
    const map: Record<string, string> = {};
    groupsList.forEach((g) => {
      const id = toId(g._id ?? g.id);
      if (id) map[id] = (g.nombre ?? "").trim();
    });
    return map;
  }, [groupsList]);
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

  /** Si en el horario del profesor aparece este grupo (por nombre, UUID del grupo, o id de la URL) */
  const profScheduleContainsGroup = useMemo(() => {
    const search = (grupoId || "").trim().toUpperCase();
    const nombreUpper = (grupoNombre || "").toUpperCase();
    if (!search && !nombreUpper) return false;
    return Object.values(profSlots).some((v) => {
      const slotVal = (v || "").trim();
      if (!slotVal) return false;
      const slotUpper = slotVal.toUpperCase();
      if (slotVal === groupIdStr) return true;
      if (slotUpper === search) return true;
      if (search && (search.includes(slotUpper) || slotUpper.includes(search))) return true;
      if (looksLikeUuid(slotVal)) {
        const slotGroupName = groupNameByUuid[slotVal];
        if (slotGroupName) {
          const nameUpper = slotGroupName.toUpperCase();
          if (search && (nameUpper === search || nameUpper.includes(search) || search.includes(nameUpper))) return true;
          if (nombreUpper && (nameUpper === nombreUpper || nameUpper.includes(nombreUpper) || nombreUpper.includes(nameUpper))) return true;
        }
      }
      return false;
    });
  }, [grupoId, profSlots, groupIdStr, grupoNombre, groupNameByUuid]);

  /** Comprueba si el valor del slot del profesor corresponde a este grupo.
   * El slot puede ser: UUID del grupo (horario guarda _id del grupo) o nombre (ej. "11H").
   * Acepta coincidencia exacta o cuando el nombre del grupo del slot es parte del nombre actual (ej. "11H" en "FÍSICA 11H"). */
  const slotMatchesGroup = (slotVal: string) => {
    const s = (slotVal || "").trim();
    if (!s) return false;
    if (s === groupIdStr) return true;
    const su = s.toUpperCase();
    const urlNombre = (grupoId || "").trim().toUpperCase();
    if (grupoNombre) {
      const gnu = grupoNombre.toUpperCase();
      if (su === gnu) return true;
      if (gnu.includes(su) || su.includes(gnu)) return true;
    }
    if (urlNombre === su) return true;
    if (urlNombre.includes(su) || su.includes(urlNombre)) return true;
    if (looksLikeUuid(s)) {
      const slotGroupName = groupNameByUuid[s];
      if (slotGroupName) {
        const slotNameUpper = slotGroupName.toUpperCase();
        if (grupoNombre && (grupoNombre.toUpperCase() === slotNameUpper || grupoNombre.toUpperCase().includes(slotNameUpper) || slotNameUpper.includes(grupoNombre.toUpperCase()))) return true;
        if (urlNombre === slotNameUpper || urlNombre.includes(slotNameUpper) || slotNameUpper.includes(urlNombre)) return true;
      }
    }
    return false;
  };

  /** Un group_subject de este grupo (para asistencia): del horario del grupo o un curso del profesor que sea de este grupo. Nunca usar un curso de otro grupo. */
  const courseIdParaEsteGrupo = useMemo(() => {
    const fromSlots = Object.values(groupSlots)[0];
    if (fromSlots) return fromSlots;
    const grupoNorm = (grupoNombre || grupoId || "").toUpperCase().trim();
    if (!grupoNorm) return groupIdStr || "";
    const cursoDeEsteGrupo = courses.find(
      (c) =>
        Array.isArray(c.cursos) &&
        c.cursos.some((cur) => String(cur || "").toUpperCase().trim() === grupoNorm)
    );
    if (cursoDeEsteGrupo) return toId(cursoDeEsteGrupo._id);
    return groupIdStr;
  }, [groupSlots, grupoNombre, grupoId, groupIdStr, courses]);

  /** Slots donde el profesor tiene este grupo: solo los días/horas donde EN SU HORARIO aparece este grupo. */
  const slotsConEsteGrupo = useMemo(() => {
    const list: { dia: number; periodo: number; courseId: string; materia: string; inicio: string; fin: string }[] = [];
    for (let dia = 1; dia <= 6; dia++) {
      for (const per of PERIODOS) {
        if (per.especial) continue;
        const key = slotKey(dia, per.num);
        const profTieneEsteSlot = slotMatchesGroup(profSlots[key]);
        if (!profTieneEsteSlot) continue;
        const courseId = groupSlots[key] || courseIdParaEsteGrupo;
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
  }, [groupIdStr, grupoNombre, grupoId, profSlots, groupSlots, courseById, courses, groupNameByUuid, courseIdParaEsteGrupo]);

  const materiaLabelReemplazo = useMemo(() => {
    const m = (materiaNombreParam || "").trim();
    if (m) return m;
    const cid = courseIdParaEsteGrupo;
    if (cid && courseById[cid]) return courseById[cid];
    return "Materia";
  }, [materiaNombreParam, courseIdParaEsteGrupo, courseById]);

  /** En modo reemplazo: todos los bloques de clase del día con el curso del grupo. */
  const slotsReemplazoDelDia = useMemo(() => {
    if (!modoReemplazo || diaSeleccionado == null) return [];
    const cid = courseIdParaEsteGrupo || grupoId;
    return PERIODOS_CLASE.map((per) => ({
      dia: diaSeleccionado,
      periodo: per.num,
      courseId: cid,
      materia: materiaLabelReemplazo,
      inicio: per.inicio,
      fin: per.fin,
    }));
  }, [modoReemplazo, diaSeleccionado, courseIdParaEsteGrupo, grupoId, materiaLabelReemplazo]);

  const slotsDelDia = useMemo(() => {
    if (diaSeleccionado == null) return [];
    if (modoReemplazo) return slotsReemplazoDelDia;
    return slotsConEsteGrupo.filter((s) => s.dia === diaSeleccionado);
  }, [diaSeleccionado, modoReemplazo, slotsReemplazoDelDia, slotsConEsteGrupo]);

  const handleContinuar = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!slotSeleccionado || !fecha) return;
    const url = `/course/${grupoId}/asistencia/registro?courseId=${encodeURIComponent(slotSeleccionado.courseId)}&fecha=${encodeURIComponent(fecha)}&hora=${encodeURIComponent(slotSeleccionado.inicio)}&materia=${encodeURIComponent(slotSeleccionado.materia)}&returnTo=${encodeURIComponent(returnTo)}`;
    setLocation(url);
  };

  const noTieneClaseConGrupo = groupScheduleError && !profScheduleContainsGroup;
  const errorPeroTieneGrupoEnHorario = groupScheduleError && profScheduleContainsGroup;
  const grupoNoEncontrado = Boolean(groupScheduleData && !groupIdStr && !groupScheduleError);
  const horarioGrupoSinDefinir = Boolean(groupIdStr && slotsConEsteGrupo.length === 0 && groupScheduleData && !groupScheduleError);
  const puedeContinuar = Boolean(fecha && slotSeleccionado && slotsDelDia.length > 0);
  const puedeUsarReemplazo = Boolean(courseIdParaEsteGrupo || grupoId);
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
          <Breadcrumb
            items={[
              { label: "Dashboard", href: "/dashboard" },
              { label: asistenciaDisplayName, href: returnTo },
              { label: "Asistencia" },
            ]}
          />
        </div>

        <header className="mb-8">
          <h1 className="text-2xl font-semibold text-[#E2E8F0] mb-2 flex items-center gap-2">
            <CheckCircle className="w-7 h-7 text-emerald-500" />
            Registrar Asistencia – {asistenciaDisplayName}
          </h1>
          <p className="text-white/60 text-sm">
            Elige la fecha y el día. Por horario solo se habilitan los días en los que tienes clase con este grupo. Usa{" "}
            <span className="text-white/80 font-medium">Reemplazo</span> si cubres una clase fuera de tu horario: se habilitan
            los 6 días y todos los bloques para registrar con normalidad.
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
            <p className="text-white/90 font-medium">Tu horario incluye este grupo ({groupDisplayName}).</p>
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
            <p className="text-white/80 font-medium">No se encontró el grupo {groupDisplayName}.</p>
            <p className="text-white/50 text-sm mt-1">Verifica que el curso exista en el colegio.</p>
          </div>
        ) : (
          <>
            {horarioGrupoSinDefinir && (
              <div className="mb-4 rounded-2xl p-4 border border-amber-500/30 bg-amber-500/10 flex gap-3 items-start">
                <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-white/90 text-sm font-medium">Tu horario no muestra clase con {groupDisplayName}.</p>
                  <p className="text-white/60 text-xs mt-1">
                    Pulsa <strong className="text-white/80">Reemplazo</strong> para habilitar los 6 días y elegir el bloque horario.
                  </p>
                </div>
              </div>
            )}
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
                <div className="flex flex-wrap gap-3">
                  {DIAS_OPCIONES.map((d) => {
                    const tieneClase = modoReemplazo || slotsConEsteGrupo.some((s) => s.dia === d);
                    const isSelected = diaSeleccionado === d;
                    return (
                      <motion.button
                        key={d}
                        type="button"
                        whileHover={tieneClase ? { scale: 1.03 } : {}}
                        whileTap={tieneClase ? { scale: 0.98 } : {}}
                        onClick={() => {
                          if (!tieneClase) return;
                          setDiaSeleccionado(d);
                          setSlotSeleccionado(null);
                          const slots = modoReemplazo
                            ? PERIODOS_CLASE.map((per) => ({
                                dia: d,
                                periodo: per.num,
                                courseId: courseIdParaEsteGrupo || grupoId,
                                materia: materiaLabelReemplazo,
                                inicio: per.inicio,
                                fin: per.fin,
                              }))
                            : slotsConEsteGrupo.filter((s) => s.dia === d);
                          if (slots.length === 1) setSlotSeleccionado(slots[0]);
                        }}
                        className={`
                          min-w-[calc(33.333%-0.5rem)] sm:min-w-0 sm:flex-1 basis-[30%] sm:basis-0 rounded-xl py-4 px-3 text-center font-semibold text-sm transition-all duration-200
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
                  <motion.button
                    type="button"
                    disabled={!puedeUsarReemplazo}
                    whileHover={puedeUsarReemplazo ? { scale: 1.03 } : {}}
                    whileTap={puedeUsarReemplazo ? { scale: 0.98 } : {}}
                    onClick={() => {
                      if (!puedeUsarReemplazo) return;
                      setModoReemplazo((prev) => {
                        const next = !prev;
                        setDiaSeleccionado(null);
                        setSlotSeleccionado(null);
                        return next;
                      });
                    }}
                    title={
                      modoReemplazo
                        ? "Desactivar reemplazo y volver al filtro por horario"
                        : "Habilitar los 6 días y todos los bloques (clase de reemplazo / suplencia)"
                    }
                    className={`
                      w-full min-w-0 max-w-full sm:w-auto sm:min-w-[7.25rem] sm:flex-none sm:shrink-0
                      rounded-xl py-3.5 px-2 sm:px-2.5 text-center font-semibold text-sm transition-all duration-200
                      ${!puedeUsarReemplazo ? "opacity-50 cursor-not-allowed bg-white/[0.02] border border-white/5 text-white/40" : ""}
                      ${puedeUsarReemplazo && modoReemplazo
                        ? "bg-[#3B82F6]/25 border-2 border-[#3B82F6] text-[#93C5FD] shadow-lg shadow-blue-500/20"
                        : puedeUsarReemplazo
                          ? "bg-white/[0.04] border border-white/10 text-white/80 hover:bg-white/[0.08] hover:border-white/20"
                          : ""}
                    `}
                  >
                    <span className="block text-[11px] sm:text-xs font-bold leading-snug tracking-tight text-balance px-0.5">
                      Reemplazo
                    </span>
                    <span className="block text-[10px] opacity-80 mt-1 leading-tight">
                      {modoReemplazo ? "Activo" : "6 días"}
                    </span>
                  </motion.button>
                </div>

                {modoReemplazo && (
                  <p className="mt-3 text-sm text-[#93C5FD]/90 flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 flex-shrink-0 text-emerald-400" />
                    Modo reemplazo activo: elige día y bloque; el registro es el mismo que en horario normal.
                  </p>
                )}

                {diaSeleccionado != null && slotsDelDia.length === 0 && (
                  <p className="mt-4 text-sm text-amber-400/90 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    No tienes clase con {groupDisplayName} el día {diaSeleccionado}. Elige otro día o activa Reemplazo.
                  </p>
                )}

                {diaSeleccionado != null && slotsDelDia.length > 0 && (
                  <div className="mt-4">
                    <label className="block text-sm font-semibold text-white/70 mb-2">
                      {modoReemplazo ? "Bloque horario (modo reemplazo)" : "Clase ese día (según tu horario)"}
                    </label>
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
                onClick={() => setLocation(returnTo)}
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
