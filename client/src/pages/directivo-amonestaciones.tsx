"use client";

import { useMemo, useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DirectivoGuard, useDirectivoSection } from "@/components/directivo-guard";
import { NavBackButton } from "@/components/nav-back-button";
import { Breadcrumb } from "@/components/Breadcrumb";
import { resolveSectionTheme, useSectionThemeApplier } from "@/hooks/useSectionTheme";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { AlertTriangle, Loader2, Search, UserSearch } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

interface SectionStudentItem {
  id: string;
  nombre: string;
  email: string;
  grupoId: string;
  grupoNombre: string;
}

interface StudentPersonal {
  _id: string;
  nombre: string;
  email: string;
  telefono?: string | null;
  celular?: string | null;
  curso?: string;
  fechaNacimiento?: string | null;
}

interface HistorialRow {
  _id: string;
  estudianteId: string;
  estudianteNombre: string;
  gravedad: "leve" | "grave" | "suma gravedad";
  razon: string;
  fechaHecho: string;
  fechaRegistro: string;
  registradoPor: string;
  grupoId?: string | null;
}

type Gravedad = HistorialRow["gravedad"];

function toDatetimeLocalValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(
    d.getMinutes()
  )}`;
}

function badgeGravedad(gravedad: string) {
  switch (gravedad) {
    case "leve":
      return "bg-amber-500/15 text-amber-400 border-amber-500/30";
    case "grave":
      return "bg-red-500/15 text-red-400 border-red-500/35";
    case "suma gravedad":
      return "bg-red-900/40 text-red-200 border-red-600/40";
    default:
      return "bg-white/10 text-white/70 border-white/20";
  }
}

export default function DirectivoAmonestacionesPage() {
  const mySection = useDirectivoSection();
  const theme = resolveSectionTheme(mySection?.nombre);
  useSectionThemeApplier(theme);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<SectionStudentItem | null>(null);
  const [gravedad, setGravedad] = useState<Gravedad>("leve");
  const [razon, setRazon] = useState("");
  const [fechaHecho, setFechaHecho] = useState(() => toDatetimeLocalValue(new Date()));

  const { data: students = [], isLoading: loadingStudents } = useQuery<SectionStudentItem[]>({
    queryKey: ["sections", "my-section", "students"],
    queryFn: () => apiRequest<SectionStudentItem[]>("GET", "/api/sections/my-section/students"),
  });

  const filteredStudents = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return students;
    return students.filter(
      (s) =>
        s.nombre.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q) ||
        s.grupoNombre.toLowerCase().includes(q)
    );
  }, [students, search]);

  const { data: personal, isLoading: loadingPersonal } = useQuery<StudentPersonal>({
    queryKey: ["studentPersonalInfo", selected?.id],
    queryFn: () => apiRequest<StudentPersonal>("GET", `/api/student/${selected!.id}/personal-info`),
    enabled: !!selected?.id,
  });

  useEffect(() => {
    if (!selected) {
      setRazon("");
      setGravedad("leve");
      setFechaHecho(toDatetimeLocalValue(new Date()));
    }
  }, [selected]);

  const { data: historial = [], isLoading: loadingHistorial } = useQuery<HistorialRow[]>({
    queryKey: ["sections", "my-section", "disciplinary-actions"],
    queryFn: () => apiRequest<HistorialRow[]>("GET", "/api/sections/my-section/disciplinary-actions"),
  });

  const sendMutation = useMutation({
    mutationFn: (body: { student_id: string; gravedad: Gravedad; razon: string; fechaHecho: string }) =>
      apiRequest<{ disciplinaryActionId: string; announcementId: string }>(
        "POST",
        "/api/sections/my-section/amonestaciones",
        body
      ),
    onSuccess: () => {
      toast({
        title: "Amonestación registrada",
        description: "Se guardó el registro y se programó el comunicado a los acudientes.",
      });
      setRazon("");
      setGravedad("leve");
      setFechaHecho(toDatetimeLocalValue(new Date()));
      queryClient.invalidateQueries({ queryKey: ["sections", "my-section", "disciplinary-actions"] });
      queryClient.invalidateQueries({ queryKey: ["disciplinaryActions"] });
      queryClient.invalidateQueries({ queryKey: ["sections", "my-section"] });
    },
    onError: (e: Error) => {
      toast({
        title: "No se pudo enviar",
        description: e.message || "Revisa los datos e intenta de nuevo.",
        variant: "destructive",
      });
    },
  });

  const canSubmit = selected && razon.trim().length > 0 && !sendMutation.isPending;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected || !razon.trim()) return;
    const dt = new Date(fechaHecho);
    if (Number.isNaN(dt.getTime())) {
      toast({ title: "Fecha inválida", description: "Revisa la fecha y hora del hecho.", variant: "destructive" });
      return;
    }
    sendMutation.mutate({
      student_id: selected.id,
      gravedad,
      razon: razon.trim(),
      fechaHecho: dt.toISOString(),
    });
  };

  return (
    <DirectivoGuard strictDirectivoOnly>
      <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-8" data-testid="directivo-amonestaciones">
        <Breadcrumb
          items={[
            { label: "Dashboard", href: "/dashboard" },
            { label: "Gestión", href: "/directivo/gestion" },
            { label: "Amonestaciones" },
          ]}
          className="mb-2"
        />
        <NavBackButton to="/directivo/gestion" label="Gestión" />

        <header>
          <h1 className="text-2xl font-bold text-white font-['Poppins'] flex items-center gap-2">
            <AlertTriangle className="w-7 h-7 text-red-400/90" aria-hidden />
            Amonestaciones
          </h1>
          <p className="text-white/60 text-sm mt-1">
            Registro disciplinario y notificación institucional a acudientes vinculados. Sección:{" "}
            {mySection?.nombre ?? "—"}
          </p>
        </header>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="bg-white/5 border-white/10 backdrop-blur-md">
            <CardHeader>
              <CardTitle className="text-white text-base flex items-center gap-2">
                <UserSearch className="w-5 h-5 text-red-400/80" />
                Directorio de estudiantes
              </CardTitle>
              <CardDescription className="text-white/55">
                Solo estudiantes matriculados en tu sección.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                <Input
                  placeholder="Buscar por nombre, correo o curso…"
                  value={search}
                  onChange={(ev) => setSearch(ev.target.value)}
                  className="pl-9 bg-white/5 border-white/10 text-white placeholder:text-white/40"
                />
              </div>
              <div className="max-h-[220px] overflow-y-auto rounded-lg border border-white/10 bg-black/20">
                {loadingStudents ? (
                  <div className="p-3 space-y-2">
                    {[1, 2, 3, 4].map((i) => (
                      <Skeleton key={i} className="h-10 w-full bg-white/10" />
                    ))}
                  </div>
                ) : filteredStudents.length === 0 ? (
                  <p className="p-4 text-sm text-white/50 text-center">No hay coincidencias.</p>
                ) : (
                  <ul className="divide-y divide-white/10">
                    {filteredStudents.map((s) => (
                      <li key={s.id}>
                        <button
                          type="button"
                          onClick={() => setSelected(s)}
                          className={`w-full text-left px-3 py-2.5 text-sm transition-colors hover:bg-white/10 ${
                            selected?.id === s.id ? "bg-red-950/30 border-l-2 border-l-red-500/50" : ""
                          }`}
                        >
                          <span className="text-white font-medium block">{s.nombre}</span>
                          <span className="text-white/50 text-xs">
                            {s.grupoNombre}
                            {s.email ? ` · ${s.email}` : ""}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/5 border-white/10 backdrop-blur-md">
            <CardHeader>
              <CardTitle className="text-white text-base">Datos del estudiante</CardTitle>
              <CardDescription className="text-white/55">
                Se autocompleta al seleccionar un estudiante en el directorio.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!selected ? (
                <p className="text-sm text-white/50 py-6 text-center">Selecciona un estudiante.</p>
              ) : loadingPersonal ? (
                <div className="space-y-2">
                  <Skeleton className="h-5 w-full bg-white/10" />
                  <Skeleton className="h-5 w-full bg-white/10" />
                </div>
              ) : personal ? (
                <dl className="space-y-2 text-sm">
                  <div className="flex justify-between gap-4">
                    <dt className="text-white/45">Nombre</dt>
                    <dd className="text-white text-right">{personal.nombre}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-white/45">Correo</dt>
                    <dd className="text-white text-right break-all">{personal.email}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-white/45">Curso</dt>
                    <dd className="text-white text-right">{personal.curso ?? "—"}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-white/45">Teléfono</dt>
                    <dd className="text-white text-right">
                      {personal.telefono || personal.celular || "—"}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-white/45">Fecha nac.</dt>
                    <dd className="text-white text-right">
                      {personal.fechaNacimiento
                        ? new Date(personal.fechaNacimiento).toLocaleDateString("es-CO")
                        : "—"}
                    </dd>
                  </div>
                  <div className="pt-2">
                    <Link
                      href={`/directivo/cursos/${encodeURIComponent(selected.grupoId)}/estudiantes/${encodeURIComponent(selected.id)}`}
                    >
                      <span className="text-xs text-[var(--primary-blue)] hover:underline cursor-pointer">
                        Ver ficha completa del estudiante
                      </span>
                    </Link>
                  </div>
                </dl>
              ) : null}
            </CardContent>
          </Card>
        </div>

        <Card className="bg-white/5 border-white/10 backdrop-blur-md border-red-500/20">
          <CardHeader>
            <CardTitle className="text-white">Registrar amonestación</CardTitle>
            <CardDescription className="text-white/55">
              La información se guarda en el historial del estudiante y se envía como comunicado institucional a sus
              acudientes.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4 max-w-xl">
              <div className="space-y-2">
                <Label className="text-white/80">Gravedad</Label>
                <Select value={gravedad} onValueChange={(v) => setGravedad(v as Gravedad)} disabled={!selected}>
                  <SelectTrigger className="bg-white/5 border-white/10 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#0f172a] border-white/10 text-white">
                    <SelectItem value="leve">Falta leve</SelectItem>
                    <SelectItem value="grave">Falta grave</SelectItem>
                    <SelectItem value="suma gravedad">Falta de suma gravedad</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-white/80">Explicación</Label>
                <Textarea
                  value={razon}
                  onChange={(e) => setRazon(e.target.value)}
                  disabled={!selected}
                  placeholder="Describe los hechos…"
                  className="min-h-[100px] bg-white/5 border-white/10 text-white placeholder:text-white/35"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-white/80">Fecha y hora del hecho</Label>
                <Input
                  type="datetime-local"
                  value={fechaHecho}
                  onChange={(e) => setFechaHecho(e.target.value)}
                  disabled={!selected}
                  className="bg-white/5 border-white/10 text-white"
                />
              </div>
              <Button
                type="submit"
                disabled={!canSubmit}
                className="bg-red-600/90 hover:bg-red-600 text-white border border-red-500/40"
              >
                {sendMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Enviando…
                  </>
                ) : (
                  "Enviar"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="bg-white/5 border-white/10 backdrop-blur-md">
          <CardHeader>
            <CardTitle className="text-white">Historial de amonestaciones</CardTitle>
            <CardDescription className="text-white/55">Registros recientes en tu sección.</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingHistorial ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-12 w-full bg-white/10" />
                ))}
              </div>
            ) : historial.length === 0 ? (
              <p className="text-sm text-white/50 py-4 text-center">Aún no hay amonestaciones registradas.</p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-white/10">
                <Table>
                  <TableHeader>
                    <TableRow className="border-white/10 hover:bg-transparent">
                      <TableHead className="text-white/70">Estudiante</TableHead>
                      <TableHead className="text-white/70">Gravedad</TableHead>
                      <TableHead className="text-white/70">Hecho</TableHead>
                      <TableHead className="text-white/70">Registro</TableHead>
                      <TableHead className="text-white/70">Por</TableHead>
                      <TableHead className="text-white/70">Resumen</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {historial.map((row) => {
                      const gid =
                        row.grupoId ||
                        students.find((s) => s.id === row.estudianteId)?.grupoId ||
                        "";
                      return (
                      <TableRow key={row._id} className="border-white/10">
                        <TableCell className="text-white text-sm">
                          {gid ? (
                            <Link
                              href={`/directivo/cursos/${encodeURIComponent(gid)}/estudiantes/${encodeURIComponent(row.estudianteId)}`}
                            >
                              <span className="hover:underline text-[var(--primary-blue)] cursor-pointer">
                                {row.estudianteNombre}
                              </span>
                            </Link>
                          ) : (
                            <span>{row.estudianteNombre}</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={badgeGravedad(row.gravedad)}>
                            {row.gravedad}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-white/80 text-xs whitespace-nowrap">
                          {row.fechaHecho
                            ? new Date(row.fechaHecho).toLocaleString("es-CO", {
                                dateStyle: "short",
                                timeStyle: "short",
                              })
                            : "—"}
                        </TableCell>
                        <TableCell className="text-white/50 text-xs whitespace-nowrap">
                          {new Date(row.fechaRegistro).toLocaleString("es-CO", {
                            dateStyle: "short",
                            timeStyle: "short",
                          })}
                        </TableCell>
                        <TableCell className="text-white/70 text-xs">{row.registradoPor || "—"}</TableCell>
                        <TableCell className="text-white/60 text-xs max-w-[200px] truncate" title={row.razon}>
                          {row.razon}
                        </TableCell>
                      </TableRow>
                    );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DirectivoGuard>
  );
}
