"use client";

import { useState, useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { NavBackButton } from "@/components/nav-back-button";
import { Button } from "@/components/ui/button";
import { Clock, User, CheckCircle, XCircle, Timer } from "lucide-react";
import { motion } from "framer-motion";
import { useToast } from "@/hooks/use-toast";

interface Student {
  _id: string;
  nombre: string;
  correo?: string;
  curso?: string;
}

interface AttendanceRecord {
  estudianteId: { _id: string } | string;
  estado: "presente" | "ausente";
  puntualidad?: "on_time" | "late";
}

type Puntualidad = "on_time" | "late";
type Presencia = "presente" | "ausente";

export default function RegistroAsistenciaPage() {
  const [, params] = useRoute("/course/:grupoId/asistencia/registro");
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const grupoId = params?.grupoId || "";

  const search = typeof window !== "undefined" ? window.location.search : "";
  const searchParams = new URLSearchParams(search);
  const courseId = searchParams.get("courseId") || "";
  const fechaParam = searchParams.get("fecha") || new Date().toISOString().slice(0, 10);
  const horaParam = searchParams.get("hora") || "7:00";
  const materiaNombre = searchParams.get("materia") || "Clase";

  const grupoDisplay = grupoId.toUpperCase().trim();
  const titulo = `Registro de Asistencia – ${grupoDisplay} ${materiaNombre} – ${horaParam}`;

  const [registros, setRegistros] = useState<Record<string, { puntualidad: Puntualidad; presencia: Presencia }>>({});

  const { data: students = [], isLoading: loadingStudents } = useQuery<Student[]>({
    queryKey: ["/api/attendance/curso", courseId, "estudiantes"],
    queryFn: () =>
      apiRequest("GET", `/api/attendance/curso/${courseId}/estudiantes`),
    enabled: !!courseId,
  });

  const { data: existingAttendance = [] } = useQuery<AttendanceRecord[]>({
    queryKey: ["/api/attendance/curso", courseId, "fecha", fechaParam],
    queryFn: () =>
      apiRequest("GET", `/api/attendance/curso/${courseId}/fecha/${fechaParam}`),
    enabled: !!courseId && !!fechaParam,
  });

  useEffect(() => {
    const map: Record<string, { puntualidad: Puntualidad; presencia: Presencia }> = {};
    existingAttendance.forEach((a) => {
      const id = typeof a.estudianteId === "object" && a.estudianteId?._id
        ? a.estudianteId._id
        : String(a.estudianteId);
      map[id] = {
        puntualidad: (a as AttendanceRecord & { puntualidad?: Puntualidad }).puntualidad || "on_time",
        presencia: a.estado,
      };
    });
    students.forEach((s) => {
      if (!map[s._id]) map[s._id] = { puntualidad: "on_time", presencia: "presente" };
    });
    setRegistros(map);
  }, [existingAttendance, students]);

  const bulkMutation = useMutation({
    mutationFn: (payload: {
      cursoId: string;
      fecha: string;
      horaBloque?: string;
      grupoId?: string;
      registros: { estudianteId: string; estado: Presencia; puntualidad?: Puntualidad }[];
    }) => apiRequest("POST", "/api/attendance/bulk", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/attendance/curso", courseId, "fecha", fechaParam] });
      queryClient.invalidateQueries({ queryKey: ["attendance-status"] });
      toast({ title: "Asistencia guardada", description: "Los registros se han actualizado correctamente." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message || "No se pudo guardar.", variant: "destructive" });
    },
  });

  const handlePuntualidad = (estudianteId: string, valor: Puntualidad) => {
    setRegistros((prev) => ({
      ...prev,
      [estudianteId]: { ...prev[estudianteId], puntualidad: valor, presencia: prev[estudianteId]?.presencia ?? "presente" },
    }));
  };

  const handlePresencia = (estudianteId: string, valor: Presencia) => {
    setRegistros((prev) => ({
      ...prev,
      [estudianteId]: { ...prev[estudianteId], presencia: valor, puntualidad: prev[estudianteId]?.puntualidad ?? "on_time" },
    }));
  };

  const handleGuardar = () => {
    const reg = Object.entries(registros).map(([estudianteId, r]) => ({
      estudianteId,
      estado: r.presencia,
      puntualidad: r.puntualidad,
    }));
    bulkMutation.mutate({
      cursoId,
      fecha: fechaParam,
      horaBloque: horaParam,
      grupoId,
      registros: reg,
    });
  };


  if (!courseId || !grupoId) {
    setLocation(`/course/${grupoId}/horario`);
    return null;
  }

  return (
    <div className="min-h-[calc(100vh-8rem)] w-full" style={{ fontFamily: "Inter, system-ui, sans-serif" }}>
      <div className="relative z-10 w-full flex flex-col min-h-0">
        <div className="mb-6">
          <NavBackButton to={`/course/${grupoId}/horario`} label="Volver al Horario" />
        </div>
        <header className="mb-8">
          <h1 className="text-2xl font-semibold text-[#E2E8F0] mb-2 flex items-center gap-2">
            <Clock className="w-7 h-7 text-[#3B82F6]" />
            {titulo}
          </h1>
          <p className="text-white/60 text-sm">
            Marca puntualidad y asistencia para cada estudiante
          </p>
        </header>

        {loadingStudents ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-20 rounded-xl bg-white/5 animate-pulse" />
            ))}
          </div>
        ) : students.length === 0 ? (
          <div
            className="rounded-2xl p-8 text-center"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
          >
            <User className="w-16 h-16 text-white/30 mx-auto mb-4" />
            <p className="text-white/60">No hay estudiantes en este curso.</p>
          </div>
        ) : (
          <>
          <div
            className="rounded-2xl overflow-hidden mb-8"
            style={{
              background: "rgba(255,255,255,0.02)",
              backdropFilter: "blur(12px)",
              border: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            <div className="divide-y divide-white/[0.06]">
              {students.map((student, idx) => {
                const r = registros[student._id] ?? { puntualidad: "on_time" as Puntualidad, presencia: "presente" as Presencia };
                return (
                  <motion.div
                    key={student._id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.03 }}
                    className="grid gap-4 p-4 sm:p-6 sm:grid-cols-[1fr_auto_auto] grid-cols-1 items-center"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-[#E2E8F0] truncate">{student.nombre}</p>
                      {student.curso && (
                        <p className="text-sm text-white/50 truncate">{student.curso}</p>
                      )}
                    </div>

                    <div className="flex flex-col gap-2">
                      <p className="text-xs font-semibold text-[#3B82F6] uppercase tracking-wider flex items-center gap-1">
                        <Timer className="w-3 h-3" /> Puntualidad
                      </p>
                      <div className="flex gap-2">
                        <PillButton
                          active={r.puntualidad === "on_time"}
                          label="A Tiempo"
                          onClick={() => handlePuntualidad(student._id, "on_time")}
                          activeColor="#3B82F6"
                        />
                        <PillButton
                          active={r.puntualidad === "late"}
                          label="Tarde"
                          onClick={() => handlePuntualidad(student._id, "late")}
                          activeColor="#F59E0B"
                        />
                      </div>
                    </div>

                    <div className="flex flex-col gap-2">
                      <p className="text-xs font-semibold text-white/60 uppercase tracking-wider flex items-center gap-1">
                        <User className="w-3 h-3" /> Asistencia
                      </p>
                      <div className="flex gap-2">
                        <PillButton
                          active={r.presencia === "presente"}
                          label="Presente"
                          onClick={() => handlePresencia(student._id, "presente")}
                          activeColor="#10B981"
                          icon={<CheckCircle className="w-4 h-4" />}
                        />
                        <PillButton
                          active={r.presencia === "ausente"}
                          label="Ausente"
                          onClick={() => handlePresencia(student._id, "ausente")}
                          activeColor="#EF4444"
                          icon={<XCircle className="w-4 h-4" />}
                        />
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>

          <div className="flex gap-4">
            <Button
              onClick={handleGuardar}
              disabled={bulkMutation.isPending}
              className="rounded-[10px] bg-[#3B82F6] hover:bg-[#2563EB] text-white"
            >
              {bulkMutation.isPending ? "Guardando…" : "Guardar asistencia"}
            </Button>
            <Button
              variant="outline"
              onClick={() => setLocation(`/course/${grupoId}/horario`)}
              className="rounded-[10px] border-white/10 text-[#E2E8F0] hover:bg-white/5"
            >
              Volver al Horario
            </Button>
          </div>
          </>
        )}
      </div>
    </div>
  );
}

function PillButton({
  active,
  label,
  onClick,
  activeColor,
  icon,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  activeColor: string;
  icon?: React.ReactNode;
}) {
  return (
    <motion.button
      type="button"
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={`
        px-4 py-2.5 rounded-[12px] text-sm font-medium transition-all duration-200 flex items-center gap-2
        ${active ? "" : "bg-white/[0.04] border border-white/[0.08] text-white/70 hover:bg-white/[0.08]"}
      `}
      style={
        active
          ? {
              background: `${activeColor}25`,
              border: `1px solid ${activeColor}60`,
              color: activeColor === "#EF4444" ? "#FCA5A5" : "#E2E8F0",
            }
          : undefined
      }
    >
      {icon}
      {label}
    </motion.button>
  );
}
