"use client";

import { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/lib/authContext";
import { useLocation, useRoute } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DirectivoGuard } from "@/components/directivo-guard";
import { apiRequest } from "@/lib/queryClient";
import * as XLSX from "xlsx";
import {
  BookOpen,
  Users,
  BarChart3,
  ClipboardList,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  RefreshCw,
  Calendar,
  History,
  Brain,
  Edit2,
  Download,
  UserCog,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Legend,
} from "recharts";
import { Breadcrumb } from "@/components/Breadcrumb";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

const CARD_STYLE = "bg-white/5 border-white/10 backdrop-blur-md";

type TabId = "hoy" | "historial" | "analisis-ia" | "estudiantes";

interface StudentInGroup {
  _id: string;
  nombre: string;
  estado?: string;
}

interface AsistenciaRecord {
  _id: string;
  estudianteId: { _id: string; nombre?: string; correo?: string; curso?: string };
  cursoId: { _id: string; nombre?: string };
  fecha: string;
  horaBloque?: string;
  estado: "presente" | "ausente";
  puntualidad?: "on_time" | "late";
  recorded_by?: { _id: string; nombre: string } | null;
}

interface HistorialRow {
  _id: string;
  fecha: string;
  materia: string;
  group_subject_id: string;
  estudianteId: string;
  estudianteNombre: string;
  estado: "presente" | "ausente";
  puntualidad: "on_time" | "late" | null;
  registradoPor?: string;
  horaBloque?: string;
}

interface AnalisisIAResponse {
  resumen: {
    totalRegistros: number;
    porcentajeGeneral: number;
    porMateria: { materia: string; total: number; presentes: number; porcentaje: number }[];
    porEstudiante: { estudiante: string; total: number; presentes: number; porcentaje: number }[];
    estudiantesCriticos: { nombre: string; porcentaje: number }[];
    diasConMasAusencias: { fecha: string; ausentes: number; total: number }[];
  };
  analisis: string;
  generado_en: string;
}

interface GroupSubjectOption {
  _id: string;
  nombre: string;
}

function toId(v: string | { _id?: string; $oid?: string } | null | undefined): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "object" && v !== null) {
    if (typeof (v as { $oid?: string }).$oid === "string") return (v as { $oid: string }).$oid;
    if (typeof (v as { _id?: string })._id === "string") return (v as { _id: string })._id;
  }
  return String(v);
}

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

export default function DirectivoCursoDetailPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/directivo/cursos/:grupoId");
  const grupoId = params?.grupoId ? decodeURIComponent(params.grupoId) : "";
  const [tab, setTab] = useState<TabId>("hoy");
  const [editModal, setEditModal] = useState<{
    open: boolean;
    record: AsistenciaRecord | null;
    estado: "presente" | "ausente";
    puntualidad: "on_time" | "late" | null;
  }>({ open: false, record: null, estado: "presente", puntualidad: null });

  // Historial filters
  const now = new Date();
  const [historialMes, setHistorialMes] = useState(now.getMonth() + 1);
  const [historialAnio, setHistorialAnio] = useState(now.getFullYear());
  const [historialMateria, setHistorialMateria] = useState<string>("");
  const [historialEstudiante, setHistorialEstudiante] = useState<string>("");

  useEffect(() => {
    if (user && !grupoId) {
      setLocation("/directivo/cursos");
    }
  }, [user, grupoId, setLocation]);

  if (!grupoId) return null;

  const hoy = new Date().toISOString().slice(0, 10);

  const { data: groupInfo } = useQuery<{ _id: string; id: string; nombre: string }>({
    queryKey: ["/api/groups", grupoId],
    queryFn: () =>
      apiRequest<{ _id: string; id: string; nombre: string }>(
        "GET",
        `/api/groups/${encodeURIComponent(grupoId)}`
      ),
    enabled: !!grupoId,
  });
  const groupDisplayName = groupInfo?.nombre?.trim() || grupoId;

  const { data: estudiantes = [], isLoading: loadingStudents } = useQuery<StudentInGroup[]>({
    queryKey: ["/api/groups", grupoId, "students"],
    queryFn: () =>
      apiRequest<StudentInGroup[]>("GET", `/api/groups/${encodeURIComponent(grupoId)}/students`),
    enabled: !!grupoId,
  });

  const { data: groupSubjects = [] } = useQuery<GroupSubjectOption[]>({
    queryKey: ["/api/courses/for-group", grupoId],
    queryFn: async () => {
      const list = await apiRequest<{ _id: string; id: string; nombre: string }[]>(
        "GET",
        `/api/courses/for-group/${encodeURIComponent(grupoId)}`
      );
      return (list || []).map((c) => ({
        _id: c._id || c.id,
        nombre: (c.nombre || "Materia").trim(),
      }));
    },
    enabled: !!grupoId && (tab === "historial" || tab === "analisis-ia"),
  });

  const {
    data: asistenciaList = [],
    isLoading: loadingAsistencia,
    refetch: refetchAsistencia,
    isFetching: fetchingAsistencia,
  } = useQuery<AsistenciaRecord[]>({
    queryKey: ["/api/attendance/grupo", grupoId, "fecha", hoy],
    queryFn: () =>
      apiRequest<AsistenciaRecord[]>(
        "GET",
        `/api/attendance/grupo/${encodeURIComponent(grupoId)}/fecha/${hoy}`
      ),
    enabled: !!grupoId && (tab === "hoy" || !tab),
    refetchInterval: tab === "hoy" ? 10000 : false,
    refetchOnWindowFocus: tab === "hoy",
  });

  const patchAttendanceMutation = useMutation({
    mutationFn: (payload: { id: string; estado: "presente" | "ausente"; puntualidad?: "on_time" | "late" | null }) =>
      apiRequest("PATCH", `/api/attendance/${payload.id}`, {
        estado: payload.estado,
        puntualidad: payload.puntualidad ?? null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/attendance/grupo", grupoId, "fecha", hoy] });
      setEditModal({ open: false, record: null, estado: "presente", puntualidad: null });
    },
  });

  const historialParams = useMemo(() => {
    const p = new URLSearchParams();
    p.set("mes", String(historialMes));
    p.set("anio", String(historialAnio));
    if (historialMateria) p.set("groupSubjectId", historialMateria);
    if (historialEstudiante) p.set("estudianteId", historialEstudiante);
    return p.toString();
  }, [historialMes, historialAnio, historialMateria, historialEstudiante]);

  const { data: historialList = [], isLoading: loadingHistorial } = useQuery<HistorialRow[]>({
    queryKey: ["/api/attendance/grupo", grupoId, "historial", historialParams],
    queryFn: () =>
      apiRequest<HistorialRow[]>(
        "GET",
        `/api/attendance/grupo/${encodeURIComponent(grupoId)}/historial?${historialParams}`
      ),
    enabled: !!grupoId && tab === "historial",
  });

  const analisisMes = now.getMonth() + 1;
  const analisisAnio = now.getFullYear();
  const { data: analisisData, isLoading: loadingAnalisis } = useQuery<AnalisisIAResponse>({
    queryKey: ["/api/attendance/grupo", grupoId, "analisis-ia", analisisMes, analisisAnio],
    queryFn: () =>
      apiRequest<AnalisisIAResponse>(
        "GET",
        `/api/attendance/grupo/${encodeURIComponent(grupoId)}/analisis-ia?mes=${analisisMes}&anio=${analisisAnio}`
      ),
    enabled: !!grupoId && tab === "analisis-ia",
  });

  // Hoy: agrupar por materia + hora (bloque)
  const hoyAgrupado = useMemo(() => {
    const key = (r: AsistenciaRecord) => `${toId(r.cursoId?._id)}-${r.horaBloque ?? "sin-hora"}`;
    const map = new Map<
      string,
      {
        materia: string;
        horaBloque: string | null;
        fecha: string;
        recordedBy: string | null;
        records: AsistenciaRecord[];
      }
    >();
    for (const r of asistenciaList) {
      const k = key(r);
      const materia = (r.cursoId as { nombre?: string })?.nombre ?? "Materia";
      if (!map.has(k)) {
        map.set(k, {
          materia,
          horaBloque: r.horaBloque ?? null,
          fecha: r.fecha,
          recordedBy: r.recorded_by?.nombre ?? null,
          records: [],
        });
      }
      map.get(k)!.records.push(r);
    }
    return Array.from(map.entries()).map(([, v]) => v);
  }, [asistenciaList]);

  const handleExportExcel = () => {
    if (historialList.length === 0) return;
    const wb = XLSX.utils.book_new();
    const byMateria = new Map<string, HistorialRow[]>();
    for (const r of historialList) {
      const name = r.materia || "General";
      if (!byMateria.has(name)) byMateria.set(name, []);
      byMateria.get(name)!.push(r);
    }
    byMateria.forEach((rows, materiaName) => {
      const dates = Array.from(new Set(rows.map((r) => r.fecha))).sort();
      const students = Array.from(new Set(rows.map((r) => r.estudianteNombre))).sort();
      const data: (string | number)[][] = [];
      data.push(["Fecha", ...students]);
      for (const date of dates) {
        const row: (string | number)[] = [date];
        for (const student of students) {
          const rec = rows.find((r) => r.fecha === date && r.estudianteNombre === student);
          row.push(rec ? (rec.estado === "presente" ? "P" : "A") : "—");
        }
        data.push(row);
      }
      const ws = XLSX.utils.aoa_to_sheet(data);
      XLSX.utils.book_append_sheet(wb, ws, materiaName.slice(0, 31));
    });
    XLSX.writeFile(wb, `asistencia-${groupDisplayName.replace(/\s+/g, "-")}-${historialMes}-${historialAnio}.xlsx`);
  };

  const tabs: { id: TabId; label: string; icon: typeof ClipboardList }[] = [
    { id: "hoy", label: "Hoy", icon: Calendar },
    { id: "historial", label: "Historial", icon: History },
    { id: "analisis-ia", label: "Análisis IA", icon: Brain },
    { id: "estudiantes", label: "Estudiantes", icon: Users },
  ];

  return (
    <DirectivoGuard>
    <div className="p-4 sm:p-6 md:p-10 max-w-5xl mx-auto min-h-0">
      <Breadcrumb
        className="mb-4"
        items={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Cursos", href: "/directivo/cursos" },
          { label: groupDisplayName },
        ]}
      />
      <div className="mt-4 mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-white font-['Poppins'] flex items-center gap-2">
          <BookOpen className="w-8 h-8 text-[var(--evo-cyan)]" />
          {groupDisplayName}
        </h1>
        <p className="text-white/60 mt-1">Asistencia, historial, análisis con IA y estudiantes.</p>
      </div>

      <div className="flex gap-2 mb-6 border-b border-white/10 pb-2">
        {tabs.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all",
                tab === t.id
                  ? "bg-[var(--evo-cyan)]/20 text-[var(--evo-cyan)] border border-[var(--evo-cyan)]/40"
                  : "text-white/60 hover:text-white hover:bg-white/5 border border-transparent"
              )}
            >
              <Icon className="w-4 h-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Tab Hoy */}
      {tab === "hoy" && (
        <Card className={CARD_STYLE}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div>
              <CardTitle className="text-white flex items-center gap-2">
                <ClipboardList className="w-5 h-5 text-[var(--evo-cyan)]" />
                Asistencia hoy
              </CardTitle>
              <CardDescription className="text-white/60">
                {hoy}. Agrupado por materia y bloque. Edita estado o puntualidad si necesitas corregir.
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="border-white/20 text-white/80 hover:bg-white/10"
              onClick={() => refetchAsistencia()}
              disabled={fetchingAsistencia}
            >
              {fetchingAsistencia ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            </Button>
          </CardHeader>
          <CardContent>
            {loadingAsistencia && !asistenciaList.length ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-32 w-full rounded-xl bg-white/10" />
                ))}
              </div>
            ) : hoyAgrupado.length === 0 ? (
              <p className="text-white/50 py-8 text-center flex items-center justify-center gap-2">
                <Clock className="w-5 h-5" />
                Sin registros de asistencia hoy aún.
              </p>
            ) : (
              <div className="space-y-6">
                {hoyAgrupado.map((bloque) => {
                  const presentes = bloque.records.filter((r) => r.estado === "presente").length;
                  const total = bloque.records.length;
                  const ausentes = bloque.records.filter((r) => r.estado === "ausente");
                  const nombresAusentes = ausentes.map((r) => (r.estudianteId as { nombre?: string })?.nombre ?? "—");
                  return (
                    <div
                      key={`${bloque.materia}-${bloque.horaBloque ?? ""}`}
                      className="rounded-xl border border-white/10 bg-white/[0.03] overflow-hidden"
                    >
                      <div className="px-4 py-3 border-b border-white/10 flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <span className="font-semibold text-white">{bloque.materia}</span>
                          {bloque.horaBloque && (
                            <span className="text-white/60 text-sm ml-2">· {bloque.horaBloque}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-sm">
                          <span className="text-white/70">
                            Día: {bloque.fecha}
                            {bloque.recordedBy && (
                              <span className="text-white/50 ml-2 flex items-center gap-1">
                                <UserCog className="w-3.5 h-3.5" />
                                {bloque.recordedBy}
                              </span>
                            )}
                          </span>
                          <span className="font-medium text-[var(--evo-cyan)]">
                            {presentes}/{total} presentes
                          </span>
                        </div>
                      </div>
                      {nombresAusentes.length > 0 && (
                        <div className="px-4 py-2 border-b border-white/5 bg-red-500/5">
                          <p className="text-xs text-white/60 mb-1">Ausentes:</p>
                          <p className="text-sm text-red-300">{nombresAusentes.join(", ")}</p>
                        </div>
                      )}
                      <div className="p-4">
                        <Table>
                          <TableHeader>
                            <TableRow className="border-white/10 hover:bg-transparent">
                              <TableHead className="text-white/70">Estudiante</TableHead>
                              <TableHead className="text-white/70">Estado</TableHead>
                              <TableHead className="text-white/70">Puntualidad</TableHead>
                              <TableHead className="text-white/70 w-[80px]"></TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {bloque.records.map((r) => (
                              <TableRow key={r._id} className="border-white/5">
                                <TableCell className="text-white font-medium">
                                  {(r.estudianteId as { nombre?: string })?.nombre ?? "—"}
                                </TableCell>
                                <TableCell>
                                  <span
                                    className={cn(
                                      "font-medium",
                                      r.estado === "presente" ? "text-emerald-400" : "text-red-400"
                                    )}
                                  >
                                    {r.estado === "presente" ? "Presente" : "Ausente"}
                                  </span>
                                </TableCell>
                                <TableCell className="text-white/80 text-sm">
                                  {r.puntualidad === "late" ? "Tarde" : r.puntualidad === "on_time" ? "A tiempo" : "—"}
                                </TableCell>
                                <TableCell>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-[var(--evo-cyan)] hover:bg-[var(--evo-cyan)]/10 h-8"
                                    onClick={() =>
                                      setEditModal({
                                        open: true,
                                        record: r,
                                        estado: r.estado,
                                        puntualidad: r.puntualidad ?? null,
                                      })
                                    }
                                  >
                                    <Edit2 className="w-4 h-4" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Tab Historial */}
      {tab === "historial" && (
        <Card className={CARD_STYLE}>
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <History className="w-5 h-5 text-[var(--evo-cyan)]" />
              Historial de asistencia
            </CardTitle>
            <CardDescription className="text-white/60">
              Filtra por mes, materia y estudiante. Exporta a Excel con una hoja por materia.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-4 items-end">
              <div className="space-y-1">
                <Label className="text-white/70 text-xs">Mes</Label>
                <Select
                  value={String(historialMes)}
                  onValueChange={(v) => setHistorialMes(parseInt(v, 10))}
                >
                  <SelectTrigger className="w-[140px] bg-white/5 border-white/10 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MESES.map((m, i) => (
                      <SelectItem key={m} value={String(i + 1)} className="text-white">
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-white/70 text-xs">Año</Label>
                <Select
                  value={String(historialAnio)}
                  onValueChange={(v) => setHistorialAnio(parseInt(v, 10))}
                >
                  <SelectTrigger className="w-[100px] bg-white/5 border-white/10 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[now.getFullYear(), now.getFullYear() - 1].map((y) => (
                      <SelectItem key={y} value={String(y)} className="text-white">
                        {y}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-white/70 text-xs">Materia</Label>
                <Select value={historialMateria || "todas"} onValueChange={(v) => setHistorialMateria(v === "todas" ? "" : v)}>
                  <SelectTrigger className="w-[180px] bg-white/5 border-white/10 text-white">
                    <SelectValue placeholder="Todas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas" className="text-white">Todas</SelectItem>
                    {groupSubjects.map((s) => (
                      <SelectItem key={s._id} value={s._id} className="text-white">
                        {s.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-white/70 text-xs">Estudiante</Label>
                <Select value={historialEstudiante || "todos"} onValueChange={(v) => setHistorialEstudiante(v === "todos" ? "" : v)}>
                  <SelectTrigger className="w-[180px] bg-white/5 border-white/10 text-white">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos" className="text-white">Todos</SelectItem>
                    {estudiantes.map((e) => (
                      <SelectItem key={e._id} value={e._id} className="text-white">
                        {e.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                variant="outline"
                className="border-[var(--evo-cyan)]/40 text-[var(--evo-cyan)] hover:bg-[var(--evo-cyan)]/10"
                onClick={handleExportExcel}
                disabled={historialList.length === 0}
              >
                <Download className="w-4 h-4 mr-2" />
                Exportar Excel
              </Button>
            </div>
            {loadingHistorial ? (
              <div className="space-y-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-12 w-full bg-white/10 rounded-lg" />
                ))}
              </div>
            ) : historialList.length === 0 ? (
              <p className="text-white/50 py-8 text-center">No hay registros con los filtros seleccionados.</p>
            ) : (
              <div className="rounded-xl border border-white/10 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-white/10 hover:bg-transparent">
                      <TableHead className="text-white/70">Fecha</TableHead>
                      <TableHead className="text-white/70">Materia</TableHead>
                      <TableHead className="text-white/70">Estudiante</TableHead>
                      <TableHead className="text-white/70">Estado</TableHead>
                      <TableHead className="text-white/70">Puntualidad</TableHead>
                      <TableHead className="text-white/70">Registrado por</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {historialList.map((r) => (
                      <TableRow key={r._id} className="border-white/5">
                        <TableCell className="text-white/90">{r.fecha}</TableCell>
                        <TableCell className="text-white/90">{r.materia}</TableCell>
                        <TableCell className="text-white/90">{r.estudianteNombre}</TableCell>
                        <TableCell>
                          <span className={r.estado === "presente" ? "text-emerald-400" : "text-red-400"}>
                            {r.estado === "presente" ? "Presente" : "Ausente"}
                          </span>
                        </TableCell>
                        <TableCell className="text-white/80 text-sm">
                          {r.puntualidad === "late" ? "Tarde" : r.puntualidad === "on_time" ? "A tiempo" : "—"}
                        </TableCell>
                        <TableCell className="text-white/70 text-sm">{r.registradoPor ?? "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Tab Análisis IA */}
      {tab === "analisis-ia" && (
        <Card className={CARD_STYLE}>
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Brain className="w-5 h-5 text-[var(--evo-cyan)]" />
              Análisis IA – {MESES[analisisMes - 1]} {analisisAnio}
            </CardTitle>
            <CardDescription className="text-white/60">
              Resumen del mes y recomendaciones generadas por IA en tiempo real.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {loadingAnalisis ? (
              <div className="space-y-4">
                <Skeleton className="h-24 w-full rounded-xl bg-white/10" />
                <Skeleton className="h-48 w-full rounded-xl bg-white/10" />
                <Skeleton className="h-32 w-full rounded-xl bg-white/10" />
              </div>
            ) : analisisData ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                    <p className="text-xs text-white/50 uppercase tracking-wider">Asistencia general</p>
                    <p className="text-2xl font-bold text-white font-['Poppins'] mt-1">
                      {analisisData.resumen.porcentajeGeneral}%
                    </p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                    <p className="text-xs text-white/50 uppercase tracking-wider">Estudiantes críticos (&lt;80%)</p>
                    <p className="text-2xl font-bold text-white font-['Poppins'] mt-1">
                      {analisisData.resumen.estudiantesCriticos.length}
                    </p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                    <p className="text-xs text-white/50 uppercase tracking-wider">Día con más ausencias</p>
                    <p className="text-lg font-bold text-white font-['Poppins'] mt-1">
                      {analisisData.resumen.diasConMasAusencias[0]
                        ? `${analisisData.resumen.diasConMasAusencias[0].fecha} (${analisisData.resumen.diasConMasAusencias[0].ausentes})`
                        : "—"}
                    </p>
                  </div>
                </div>
                {analisisData.resumen.porMateria.length > 0 && (
                  <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                    <p className="text-sm font-medium text-white/80 mb-4">Asistencia por materia (%)</p>
                    <ResponsiveContainer width="100%" height={260}>
                      <BarChart data={analisisData.resumen.porMateria.map((m) => ({ materia: m.materia, porcentaje: m.porcentaje }))}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                        <XAxis dataKey="materia" stroke="rgba(255,255,255,0.6)" fontSize={12} />
                        <YAxis stroke="rgba(255,255,255,0.6)" fontSize={12} domain={[0, 100]} />
                        <Tooltip contentStyle={{ background: "var(--mid-dark)", border: "1px solid rgba(255,255,255,0.1)" }} />
                        <Bar dataKey="porcentaje" fill="var(--evo-cyan)" radius={[4, 4, 0, 0]} name="%" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
                {analisisData.resumen.porMateria.length > 0 && (() => {
                  const byWeek: Record<string, { total: number; present: number }> = {};
                  for (const r of analisisData.resumen.porEstudiante) {
                    byWeek["Semana"] = byWeek["Semana"] || { total: 0, present: 0 };
                    byWeek["Semana"].total += r.total;
                    byWeek["Semana"].present += r.presentes;
                  }
                  const lineData = analisisData.resumen.diasConMasAusencias.length
                    ? analisisData.resumen.diasConMasAusencias.slice(0, 7).map((d) => ({
                        fecha: d.fecha,
                        ausentes: d.ausentes,
                        total: d.total,
                      }))
                    : [];
                  if (lineData.length === 0) return null;
                  return (
                    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                      <p className="text-sm font-medium text-white/80 mb-4">Ausencias por día (días con más ausencias)</p>
                      <ResponsiveContainer width="100%" height={220}>
                        <LineChart data={lineData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                          <XAxis dataKey="fecha" stroke="rgba(255,255,255,0.6)" fontSize={11} />
                          <YAxis stroke="rgba(255,255,255,0.6)" fontSize={12} />
                          <Tooltip contentStyle={{ background: "var(--mid-dark)", border: "1px solid rgba(255,255,255,0.1)" }} />
                          <Legend />
                          <Line type="monotone" dataKey="ausentes" stroke="var(--evo-danger)" name="Ausentes" strokeWidth={2} dot={{ r: 4 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  );
                })()}
                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <p className="text-sm font-medium text-white/80 mb-2">Análisis y recomendaciones (IA)</p>
                  <p className="text-white/90 text-sm whitespace-pre-wrap leading-relaxed">{analisisData.analisis}</p>
                  <p className="text-white/40 text-xs mt-3">
                    Generado: {new Date(analisisData.generado_en).toLocaleString("es-CO")}
                  </p>
                </div>
              </>
            ) : (
              <p className="text-white/50 py-8 text-center">No hay datos de asistencia para este mes.</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Tab Estudiantes */}
      {tab === "estudiantes" && (
        <Card className={CARD_STYLE}>
          <CardHeader>
            <CardTitle className="text-white">Estudiantes</CardTitle>
            <CardDescription className="text-white/60">
              {estudiantes.length} estudiante{estudiantes.length !== 1 ? "s" : ""} en este curso
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingStudents ? (
              <div className="space-y-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-14 w-full bg-white/10 rounded-lg" />
                ))}
              </div>
            ) : estudiantes.length === 0 ? (
              <p className="text-white/60 py-6 text-center">No hay estudiantes asignados a este curso.</p>
            ) : (
              <div className="space-y-2">
                {estudiantes.map((est) => (
                  <div
                    key={est._id}
                    className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10"
                  >
                    <span className="font-medium text-white">{est.nombre}</span>
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-[var(--evo-cyan)]/50 text-[var(--evo-cyan)] hover:bg-[var(--evo-cyan)]/10"
                      onClick={() =>
                        setLocation(
                          `/directivo/cursos/${encodeURIComponent(grupoId)}/estudiantes/${est._id}/notas`
                        )
                      }
                    >
                      Ver notas
                    </Button>
                  </div>
                ))}
                <Button
                  variant="ghost"
                  className="w-full mt-2 text-white/70 hover:text-white hover:bg-white/5"
                  onClick={() => setLocation(`/directivo/cursos/${encodeURIComponent(grupoId)}/estudiantes`)}
                >
                  Ver lista completa de estudiantes
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Modal Editar registro */}
      <Dialog open={editModal.open} onOpenChange={(open) => !open && setEditModal({ open: false, record: null, estado: "presente", puntualidad: null })}>
        <DialogContent className="bg-[var(--mid-dark)] border-white/10 text-white">
          <DialogHeader>
            <DialogTitle>Editar asistencia</DialogTitle>
          </DialogHeader>
          {editModal.record && (
            <div className="space-y-4 py-2">
              <p className="text-white/70 text-sm">
                Estudiante: {(editModal.record.estudianteId as { nombre?: string })?.nombre ?? "—"}
              </p>
              <div className="space-y-2">
                <Label className="text-white/80">Estado</Label>
                <Select
                  value={editModal.estado}
                  onValueChange={(v) => setEditModal((prev) => ({ ...prev, estado: v as "presente" | "ausente" }))}
                >
                  <SelectTrigger className="bg-white/5 border-white/10 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="presente" className="text-white">Presente</SelectItem>
                    <SelectItem value="ausente" className="text-white">Ausente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-white/80">Puntualidad</Label>
                <Select
                  value={editModal.puntualidad ?? "na"}
                  onValueChange={(v) =>
                    setEditModal((prev) => ({ ...prev, puntualidad: v === "na" ? null : (v as "on_time" | "late") }))
                  }
                >
                  <SelectTrigger className="bg-white/5 border-white/10 text-white">
                    <SelectValue placeholder="Sin especificar" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="na" className="text-white">Sin especificar</SelectItem>
                    <SelectItem value="on_time" className="text-white">A tiempo</SelectItem>
                    <SelectItem value="late" className="text-white">Tarde</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" className="text-white/80" onClick={() => setEditModal({ open: false, record: null, estado: "presente", puntualidad: null })}>
              Cancelar
            </Button>
            <Button
              className="bg-[var(--evo-cyan)] hover:bg-[var(--evo-cyan)]/90 text-white"
              disabled={!editModal.record || patchAttendanceMutation.isPending}
              onClick={() => {
                if (editModal.record) {
                  patchAttendanceMutation.mutate({
                    id: editModal.record._id,
                    estado: editModal.estado,
                    puntualidad: editModal.puntualidad,
                  });
                }
              }}
            >
              {patchAttendanceMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </DirectivoGuard>
  );
}
