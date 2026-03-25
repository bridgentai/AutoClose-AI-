import { useMemo, useState } from 'react';
import { useAuth } from '@/lib/authContext';
import { useLocation, useRoute } from 'wouter';
import { 
  ArrowLeft,
  User,
  Mail,
  Calendar,
  Award,
  AlertTriangle,
  FileText,
  MessageSquare,
  Phone,
  MapPin,
  School
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useMutation, useQuery } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';

// =========================================================
// INTERFACES
// =========================================================

interface StudentDetail {
  _id: string;
  nombre: string;
  email: string;
  telefono?: string | null;
  celular?: string | null;
  direccion?: string | null;
  barrio?: string | null;
  ciudad?: string | null;
  fechaNacimiento?: string | null;
  colegioId: string;
  curso?: string;
}

interface StudentNote {
  actividad: string;
  nota: number;
  fecha: string;
  comentario?: string;
  categoria: string;
}

interface Amonestacion {
  _id: string;
  gravedad: 'leve' | 'grave' | 'suma gravedad';
  razon: string;
  fecha: string;
  registradoPor?: string;
}

// =========================================================
// FUNCIONES DE API
// =========================================================

const fetchStudentPersonalInfo = async (estudianteId: string): Promise<StudentDetail> => {
  return apiRequest('GET', `/api/student/${estudianteId}/personal-info`);
};

const fetchSubjectsForGroup = async (groupId: string) => apiRequest('GET', `/api/courses/for-group/${groupId}`);
const fetchGradeTableAssignments = async (groupId: string, courseId: string) =>
  apiRequest('GET', `/api/assignments?groupId=${encodeURIComponent(groupId)}&courseId=${courseId}`);

interface LogroItem {
  _id: string;
  nombre: string;
  porcentaje: number;
  orden?: number;
}

interface AssignmentForNotes {
  _id: string;
  titulo: string;
  fechaEntrega?: string;
  logroCalificacionId?: string;
  submissions?: { estudianteId: string; calificacion?: number }[];
  entregas?: { estudianteId: string; calificacion?: number }[];
}

// =========================================================
// COMPONENTE PRINCIPAL
// =========================================================

export default function StudentProfilePage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const search = typeof window !== 'undefined' ? window.location.search : '';
  const searchParams = new URLSearchParams(search);
  
  // Rutas dinámicas
  const [, params] = useRoute('/profesor/cursos/:cursoId/estudiantes/:estudianteId');
  
  const cursoId = params?.cursoId || '';
  const estudianteId = params?.estudianteId || '';
  const returnTo = searchParams.get('returnTo') || `/course-detail/${cursoId}`;
  
  // Obtener información personal del estudiante desde el backend
  const { data: studentDetail, isLoading: isLoadingStudent, error: studentError } = useQuery<StudentDetail>({
    queryKey: ['studentPersonalInfo', estudianteId],
    queryFn: () => fetchStudentPersonalInfo(estudianteId),
    enabled: !!estudianteId,
  });
  
  const displayGroupId =
    cursoId && cursoId.length === 24 && /^[0-9a-fA-F]{24}$/.test(cursoId) ? cursoId : (cursoId || '').toUpperCase().trim();

  // Notas reales: mismas fuentes que la tabla de notas del profesor (teacher-notes.tsx)
  const { data: subjectsForGroup = [] } = useQuery<{ _id: string; nombre?: string }[]>({
    queryKey: ['subjectsForGroup', cursoId],
    queryFn: () => fetchSubjectsForGroup(cursoId),
    enabled: !!cursoId,
    staleTime: 0,
  });
  const firstSubjectId = subjectsForGroup[0]?._id;
  const courseIdForData = firstSubjectId ? firstSubjectId : '';

  const { data: assignmentsRaw = [] } = useQuery<AssignmentForNotes[]>({
    queryKey: ['gradeTableAssignments', cursoId, courseIdForData],
    queryFn: () => fetchGradeTableAssignments(displayGroupId, courseIdForData),
    enabled: !!cursoId && !!courseIdForData,
    staleTime: 0,
  });

  const { data: logrosRaw } = useQuery<{ indicadoresPlano: LogroItem[] }>({
    queryKey: ['logros', courseIdForData],
    queryFn: () =>
      fetch(`/api/logros-calificacion?courseId=${encodeURIComponent(courseIdForData)}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('autoclose_token')}` },
      }).then((r) => r.json()),
    enabled: !!courseIdForData,
    staleTime: 0,
  });
  const logros = logrosRaw?.indicadoresPlano ?? [];

  const getNotaForStudent = (a: AssignmentForNotes, sid: string) => {
    const subs = a.submissions || a.entregas || [];
    const s = subs.find((x) => String(x.estudianteId) === String(sid));
    const cal = s?.calificacion;
    return cal != null && !Number.isNaN(Number(cal)) ? Number(cal) : null;
  };

  const assignmentsByLogro = useMemo(() => {
    const grouped: Record<string, { logro: LogroItem; assignments: AssignmentForNotes[] }> = {};
    const list = [...logros].sort((a, b) => (a.orden ?? 999) - (b.orden ?? 999));
    list.forEach((l) => {
      grouped[l._id] = { logro: l, assignments: [] };
    });
    const sinLogro: AssignmentForNotes[] = [];
    (assignmentsRaw as AssignmentForNotes[]).forEach((a) => {
      const lid = a.logroCalificacionId as string | undefined;
      if (lid && grouped[lid]) grouped[lid].assignments.push(a);
      else sinLogro.push(a);
    });
    if (sinLogro.length) {
      grouped['sin-logro'] = { logro: { _id: 'sin-logro', nombre: 'Sin categoría', porcentaje: 0 }, assignments: sinLogro };
    }
    return grouped;
  }, [assignmentsRaw, logros]);

  const notes: StudentNote[] = useMemo(() => {
    if (!estudianteId) return [];
    const byLogro = assignmentsByLogro;
    const result: StudentNote[] = [];
    Object.values(byLogro).forEach(({ logro, assignments }) => {
      assignments.forEach((a) => {
        const n = getNotaForStudent(a, estudianteId);
        if (n == null) return;
        result.push({
          actividad: a.titulo,
          nota: n,
          fecha: a.fechaEntrega || new Date().toISOString(),
          categoria: logro.nombre,
        });
      });
    });
    // Ordenar por fecha desc
    result.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
    return result;
  }, [assignmentsByLogro, estudianteId]);

  const promedioFinal = useMemo(() => {
    if (!estudianteId) return 0;
    let weightedSum = 0;
    let totalPct = 0;

    Object.values(assignmentsByLogro).forEach(({ logro, assignments }) => {
      if (logro._id === 'sin-logro') return;
      const pct = Number(logro.porcentaje ?? 0);
      if (!pct) return;
      const notas: number[] = [];
      assignments.forEach((a) => {
        const n = getNotaForStudent(a, estudianteId);
        if (n != null) notas.push(n);
      });
      if (!notas.length) {
        totalPct += pct;
        return;
      }
      const prom = notas.reduce((s, x) => s + x, 0) / notas.length;
      weightedSum += (prom * pct) / 100;
      totalPct += pct;
    });

    // Fallback: promedio simple si no hay pesos configurados
    if (totalPct <= 0) {
      if (!notes.length) return 0;
      return Math.round(notes.reduce((acc, n) => acc + n.nota, 0) / notes.length);
    }
    return Math.round(weightedSum);
  }, [assignmentsByLogro, estudianteId, notes]);

  // Amonestaciones reales (sin datos inventados)
  const { data: amonestaciones = [] } = useQuery<Amonestacion[]>({
    queryKey: ['disciplinaryActions', estudianteId],
    queryFn: () => apiRequest('GET', `/api/student/${estudianteId}/disciplinary-actions`),
    enabled: !!estudianteId,
    staleTime: 0,
  });

  const totalAmonestaciones = amonestaciones.length;

  const [newAmonestacion, setNewAmonestacion] = useState<{ gravedad: Amonestacion['gravedad']; razon: string }>({
    gravedad: 'leve',
    razon: '',
  });

  const createAmonestacionMutation = useMutation({
    mutationFn: (body: { gravedad: Amonestacion['gravedad']; razon: string }) =>
      apiRequest('POST', `/api/student/${estudianteId}/disciplinary-actions`, body),
    onSuccess: () => {
      toast({ title: 'Amonestación registrada', description: 'Se notificó a directivos por Evo Send.' });
      setNewAmonestacion({ gravedad: 'leve', razon: '' });
      queryClient.invalidateQueries({ queryKey: ['disciplinaryActions', estudianteId] });
    },
    onError: (e: Error) => {
      toast({ title: 'Error', description: e.message || 'No se pudo registrar la amonestación.', variant: 'destructive' });
    },
  });

  // Función para obtener el color de la gravedad
  const getGravedadColor = (gravedad: string) => {
    switch (gravedad) {
      case 'leve':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40';
      case 'grave':
        return 'bg-red-500/20 text-red-400 border-red-500/40';
      case 'suma gravedad':
        return 'bg-red-700/30 text-red-200 border-red-700/50';
      default:
        return 'bg-gray-500/20 text-gray-400 border-gray-500/40';
    }
  };

  if (!cursoId || !estudianteId) {
    return (
      <div className="flex-1 overflow-y-auto p-6 md:p-10">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-8">
            <AlertTriangle className="w-16 h-16 text-red-500/40 mx-auto mb-4" />
            <p className="text-white/60">Estudiante no encontrado</p>
            <Button
              variant="ghost"
              onClick={() => setLocation(returnTo)}
              className="text-white/70 hover:text-white mt-4"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Volver al Curso
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (isLoadingStudent) {
    return (
      <div className="flex-1 overflow-y-auto p-6 md:p-10">
        <div className="max-w-7xl mx-auto">
          <Skeleton className="h-20 w-full mb-8 bg-white/10" />
          <Skeleton className="h-64 w-full mb-8 bg-white/10" />
        </div>
      </div>
    );
  }

  if (studentError || !studentDetail) {
    return (
      <div className="flex-1 overflow-y-auto p-6 md:p-10">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-8">
            <AlertTriangle className="w-16 h-16 text-red-500/40 mx-auto mb-4" />
            <p className="text-white/60">Error al cargar la información del estudiante</p>
            <Button
              variant="ghost"
              onClick={() => setLocation(returnTo)}
              className="text-white/70 hover:text-white mt-4"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Volver al Curso
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-10">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Button
            variant="ghost"
            onClick={() => setLocation(returnTo)}
            className="text-white/70 hover:text-white mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver al Curso
          </Button>
          <div className="flex items-center gap-4 mb-6">
            <Avatar className="w-20 h-20">
              <AvatarFallback className="bg-gradient-to-r from-[#002366] to-[#1e3cff] text-white text-2xl">
                {studentDetail.nombre.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div>
              <h1 className="text-4xl font-bold text-white mb-2 font-['Poppins']">
                {studentDetail.nombre}
              </h1>
              <p className="text-white/60">{studentDetail.email}</p>
              {studentDetail.curso && (
                <Badge className="mt-2 bg-[#1e3cff]/20 text-white border-[#1e3cff]/40">
                  Grupo {studentDetail.curso}
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Información Personal */}
        <Card className="bg-white/5 border-white/10 backdrop-blur-md mb-8">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <User className="w-5 h-5 text-[#1e3cff]" />
              Información Personal
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex items-start gap-3">
                <Mail className="w-5 h-5 text-[#1e3cff] mt-1 flex-shrink-0" />
                <div>
                  <p className="text-sm text-white/60 mb-1">Correo Electrónico</p>
                  <p className="text-white font-medium">{studentDetail.email || '-'}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Phone className="w-5 h-5 text-[#1e3cff] mt-1 flex-shrink-0" />
                <div>
                  <p className="text-sm text-white/60 mb-1">Teléfono</p>
                  <p className="text-white font-medium">
                    {studentDetail.telefono || studentDetail.celular || '-'}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <MapPin className="w-5 h-5 text-[#1e3cff] mt-1 flex-shrink-0" />
                <div>
                  <p className="text-sm text-white/60 mb-1">Dirección</p>
                  <p className="text-white font-medium">
                    {studentDetail.direccion 
                      ? `${studentDetail.direccion}${studentDetail.barrio ? `, ${studentDetail.barrio}` : ''}${studentDetail.ciudad ? `, ${studentDetail.ciudad}` : ''}`
                      : '-'}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Calendar className="w-5 h-5 text-[#1e3cff] mt-1 flex-shrink-0" />
                <div>
                  <p className="text-sm text-white/60 mb-1">Fecha de Nacimiento</p>
                  <p className="text-white font-medium">
                    {studentDetail.fechaNacimiento
                      ? new Date(studentDetail.fechaNacimiento).toLocaleDateString('es-CO', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })
                      : '-'}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <School className="w-5 h-5 text-[#1e3cff] mt-1 flex-shrink-0" />
                <div>
                  <p className="text-sm text-white/60 mb-1">Grupo</p>
                  <p className="text-white font-medium">{studentDetail.curso || '-'}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Notas Específicas */}
        <Card className="bg-white/5 border-white/10 backdrop-blur-md mb-8">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-white flex items-center gap-2">
                  <Award className="w-5 h-5 text-[#1e3cff]" />
                  Notas Específicas
                </CardTitle>
                <CardDescription className="text-white/60 mt-2">
                  Historial completo de calificaciones (Escala: 10-100)
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-3xl font-bold text-white">
                  {promedioFinal}
                </span>
                <span className="text-white/50 text-lg">/ 100</span>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {notes.length > 0 ? (
              <div className="space-y-4">
                {notes.map((nota, idx) => (
                  <div
                    key={idx}
                    className="p-4 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-all"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h4 className="font-semibold text-white">{nota.actividad}</h4>
                          <Badge className="bg-[#1e3cff]/20 text-white border-[#1e3cff]/40 text-xs">
                            {nota.categoria}
                          </Badge>
                        </div>
                        <p className="text-sm text-white/60">
                          {new Date(nota.fecha).toLocaleDateString('es-CO', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          })}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-2xl font-bold text-white">
                          {nota.nota}
                        </span>
                        <span className="text-white/50">/ 100</span>
                      </div>
                    </div>
                    {nota.comentario && (
                      <div className="mt-3 p-3 bg-white/5 rounded-lg border border-white/10">
                        <div className="flex items-start gap-2">
                          <MessageSquare className="w-4 h-4 text-[#1e3cff] mt-0.5 flex-shrink-0" />
                          <p className="text-sm text-white/80">{nota.comentario}</p>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Award className="w-16 h-16 text-white/20 mx-auto mb-4" />
                <p className="text-white/60">No hay notas registradas</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Amonestaciones */}
        <Card className="bg-red-500/10 border-red-500/30 backdrop-blur-md mb-8">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-red-300 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-red-400" />
                  Amonestaciones
                </CardTitle>
                <CardDescription className="text-red-200/60 mt-2">
                  Registro de amonestaciones disciplinarias
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-3xl font-bold text-red-300">
                  {totalAmonestaciones}
                </span>
                <span className="text-red-200/50 text-lg">amonestaciones</span>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* Formulario corto (sin datos falsos) */}
            {user?.rol === 'profesor' && (
              <div className="mb-6 p-4 rounded-lg border border-red-500/30 bg-red-500/10">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label className="text-red-100/80">Gravedad</Label>
                    <Select
                      value={newAmonestacion.gravedad}
                      onValueChange={(v) => setNewAmonestacion((prev) => ({ ...prev, gravedad: v as Amonestacion['gravedad'] }))}
                    >
                      <SelectTrigger className="mt-1 bg-white/5 border-red-500/30 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-[#0a0a2a] border-red-500/30">
                        <SelectItem value="leve" className="text-white">Leve</SelectItem>
                        <SelectItem value="grave" className="text-white">Grave</SelectItem>
                        <SelectItem value="suma gravedad" className="text-white">Suma gravedad</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="md:col-span-2">
                    <Label className="text-red-100/80">Razón *</Label>
                    <Textarea
                      value={newAmonestacion.razon}
                      onChange={(e) => setNewAmonestacion((prev) => ({ ...prev, razon: e.target.value }))}
                      className="mt-1 bg-white/5 border-red-500/30 text-white"
                      placeholder="Describe brevemente el motivo..."
                      rows={3}
                    />
                  </div>
                </div>
                <div className="flex justify-end mt-4 gap-2">
                  <Button
                    variant="outline"
                    className="border-red-500/30 text-red-100 hover:bg-red-500/10"
                    onClick={() => setNewAmonestacion({ gravedad: 'leve', razon: '' })}
                    disabled={createAmonestacionMutation.isPending}
                  >
                    Limpiar
                  </Button>
                  <Button
                    className="bg-red-500/80 hover:bg-red-500 text-white"
                    disabled={!newAmonestacion.razon.trim() || createAmonestacionMutation.isPending}
                    onClick={() => createAmonestacionMutation.mutate({ gravedad: newAmonestacion.gravedad, razon: newAmonestacion.razon.trim() })}
                  >
                    Notificar amonestación
                  </Button>
                </div>
                <p className="text-xs text-red-200/60 mt-2">
                  Se enviará a directivos como mensaje en Evo Send.
                </p>
              </div>
            )}

            {amonestaciones.length > 0 ? (
              <div className="space-y-4">
                {amonestaciones.map((amonestacion) => (
                  <div
                    key={amonestacion._id}
                    className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg hover:bg-red-500/15 transition-all"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <Badge className={getGravedadColor(amonestacion.gravedad)}>
                            {amonestacion.gravedad.charAt(0).toUpperCase() + amonestacion.gravedad.slice(1)}
                          </Badge>
                        </div>
                        <p className="text-red-200 font-medium mb-2">{amonestacion.razon}</p>
                        <div className="flex items-center gap-4 text-sm text-red-200/70">
                          <div className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            <span>
                              {new Date(amonestacion.fecha).toLocaleDateString('es-CO', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric'
                              })}
                            </span>
                          </div>
                          {amonestacion.registradoPor && (
                            <div className="flex items-center gap-1">
                              <User className="w-4 h-4" />
                              <span>{amonestacion.registradoPor}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <AlertTriangle className="w-16 h-16 text-red-500/20 mx-auto mb-4" />
                <p className="text-red-200/60">No hay amonestaciones registradas</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

