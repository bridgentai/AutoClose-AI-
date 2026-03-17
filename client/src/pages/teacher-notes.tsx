import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/lib/authContext';
import { useLocation, useRoute } from 'wouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Plus, MessageSquare } from 'lucide-react';
import { Breadcrumb } from '@/components/Breadcrumb';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

// =========================================================
// INTERFACES Y DATOS MOCK
// =========================================================

interface Student {
  _id: string;
  nombre: string;
  email: string;
  avatar?: string;
  estado: 'activo' | 'inactivo';
  promedio: number;
  ultimaNota: number;
}

interface StudentDetail extends Student {
  materiaId: string;
  materiaNombre: string;
  categorias: {
    categoria: string;
    promedio: number;
    notas: {
      actividad: string;
      nota: number;
      fecha: string;
      comentario?: string;
    }[];
  }[];
  promedioFinal: number;
}

// Datos mock - En producción estos vendrían del backend
const mockStudents: Student[] = [
  {
    _id: '1',
    nombre: 'Juan Pérez',
    email: 'juan.perez@example.com',
    estado: 'activo',
    promedio: 90,
    ultimaNota: 96
  },
  {
    _id: '2',
    nombre: 'María García',
    email: 'maria.garcia@example.com',
    estado: 'activo',
    promedio: 96,
    ultimaNota: 100
  },
  {
    _id: '3',
    nombre: 'Carlos Rodríguez',
    email: 'carlos.rodriguez@example.com',
    estado: 'activo',
    promedio: 78,
    ultimaNota: 80
  },
  {
    _id: '4',
    nombre: 'Ana Martínez',
    email: 'ana.martinez@example.com',
    estado: 'activo',
    promedio: 84,
    ultimaNota: 86
  }
];

const PASSED_THRESHOLD = 65;

const mockStudentDetail: StudentDetail = {
  _id: '1',
  nombre: 'Juan Pérez',
  email: 'juan.perez@example.com',
  estado: 'activo',
  promedio: 90,
  ultimaNota: 96,
  materiaId: 'mat-1',
  materiaNombre: 'Matemáticas',
  promedioFinal: 90,
  categorias: [
    {
      categoria: 'Exámenes',
      promedio: 92,
      notas: [
        { actividad: 'Examen Parcial 1', nota: 90, fecha: '2024-01-15', comentario: 'Buen trabajo, sigue así' },
        { actividad: 'Examen Parcial 2', nota: 94, fecha: '2024-02-20', comentario: 'Excelente progreso' }
      ]
    },
    {
      categoria: 'Tareas',
      promedio: 88,
      notas: [
        { actividad: 'Tarea de Álgebra', nota: 86, fecha: '2024-01-10', comentario: 'Bien hecho' },
        { actividad: 'Tarea de Geometría', nota: 90, fecha: '2024-02-05' }
      ]
    },
    {
      categoria: 'Proyectos',
      promedio: 90,
      notas: [
        { actividad: 'Proyecto Final', nota: 90, fecha: '2024-03-01', comentario: 'Buen proyecto, bien estructurado' }
      ]
    }
  ]
};

// =========================================================
// COMPONENTE PRINCIPAL
// =========================================================

const fetchSubjectsForGroup = async (groupId: string) => apiRequest('GET', `/api/courses/for-group/${groupId}`);
const fetchGradeTableAssignments = async (groupId: string, courseId: string) =>
  apiRequest('GET', `/api/assignments?groupId=${encodeURIComponent(groupId)}&courseId=${courseId}`);
const fetchStudentsByGroup = async (groupId: string) => {
  const res = await apiRequest('GET', `/api/groups/${groupId.toUpperCase().trim()}/students`);
  return Array.isArray(res) ? res : [];
};

export default function TeacherNotesPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [, paramsCourse] = useRoute('/profesor/cursos/:cursoId/notas');
  const [, paramsStudent] = useRoute('/profesor/cursos/:cursoId/estudiantes/:estudianteId/notas');
  const cursoId = paramsCourse?.cursoId || paramsStudent?.cursoId || '';
  const estudianteId = paramsStudent?.estudianteId || null;
  const displayGroupId = cursoId && cursoId.length === 24 && /^[0-9a-fA-F]{24}$/.test(cursoId) ? cursoId : (cursoId || '').toUpperCase().trim();

  const { data: groupInfo } = useQuery<{ _id: string; id: string; nombre: string }>({
    queryKey: ['group', cursoId],
    queryFn: () => apiRequest('GET', `/api/groups/${encodeURIComponent(cursoId)}`),
    enabled: !!cursoId,
    staleTime: 5 * 60 * 1000,
  });
  const groupDisplayName = (groupInfo?.nombre?.trim() || displayGroupId) as string;

  const { data: subjectsForGroup = [], isSuccess: subjectsLoaded } = useQuery({
    queryKey: ['subjectsForGroup', cursoId],
    queryFn: () => fetchSubjectsForGroup(cursoId),
    enabled: !!cursoId,
  });

  const firstSubjectId = subjectsForGroup[0]?._id;
  const courseIdForData = subjectsLoaded && firstSubjectId ? firstSubjectId : '';

  const { data: assignmentsForTable = [] } = useQuery({
    queryKey: ['gradeTableAssignments', cursoId, courseIdForData],
    queryFn: () => fetchGradeTableAssignments(displayGroupId, courseIdForData),
    enabled: !!cursoId && !!courseIdForData,
  });
  const { data: students = [] } = useQuery({
    queryKey: ['students', cursoId],
    queryFn: () => fetchStudentsByGroup(cursoId),
    enabled: !!cursoId,
  });
  const { data: logrosRaw } = useQuery({
    queryKey: ['logros', courseIdForData],
    queryFn: () =>
      fetch(`/api/logros-calificacion?courseId=${encodeURIComponent(courseIdForData)}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('autoclose_token')}` },
      }).then((r) => r.json()),
    enabled: !!courseIdForData,
  });

  const logros = logrosRaw?.logros ?? [];

  const updateGradeMutation = useMutation({
    mutationFn: async ({ assignmentId, estudianteId: sid, calificacion }: { assignmentId: string; estudianteId: string; calificacion: number }) =>
      apiRequest('PUT', `/api/assignments/${assignmentId}/grade`, { estudianteId: sid, calificacion: Math.min(100, Math.max(0, calificacion)), manualOverride: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gradeTableAssignments', cursoId, courseIdForData] });
      queryClient.invalidateQueries({ queryKey: ['students', cursoId] });
    },
  });

  const [showAddNoteForm, setShowAddNoteForm] = useState(false);

  const [formData, setFormData] = useState({
    categoria: '',
    actividad: '',
    fecha: '',
    nota: '',
    comentario: ''
  });

  // Resetear formulario
  const resetForm = () => {
    setFormData({
      categoria: '',
      actividad: '',
      fecha: '',
      nota: '',
      comentario: ''
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Aquí iría la lógica para guardar la nota
    console.log('Guardar nota:', formData);
    resetForm();
    setShowAddNoteForm(false);
  };

  useEffect(() => {
    if (!cursoId) setLocation('/profesor/academia/cursos');
  }, [cursoId, setLocation]);

  if (!cursoId) return null;

  const currentStudent = estudianteId ? (students as { _id: string; nombre: string; email?: string }[]).find(s => s._id === estudianteId) : null;
  const assignmentsByLogro = useMemo(() => {
    const grouped: Record<string, { logro: { _id: string; nombre: string; porcentaje: number }; assignments: typeof assignmentsForTable }> = {};
    const list = (logros as { _id: string; nombre: string; porcentaje: number; orden?: number }[]).sort((a, b) => (a.orden ?? 999) - (b.orden ?? 999));
    list.forEach(l => { grouped[l._id] = { logro: l, assignments: [] }; });
    const sinLogro: typeof assignmentsForTable = [];
    (assignmentsForTable as { _id: string; titulo: string; submissions?: { estudianteId: string; calificacion?: number }[]; entregas?: { estudianteId: string; calificacion?: number }[]; logroCalificacionId?: string }[]).forEach(a => {
      const lid = a.logroCalificacionId as string | undefined;
      if (lid && grouped[lid]) grouped[lid].assignments.push(a);
      else sinLogro.push(a);
    });
    if (sinLogro.length) grouped['sin-logro'] = { logro: { _id: 'sin-logro', nombre: 'Sin categoría', porcentaje: 0 }, assignments: sinLogro };
    return grouped;
  }, [assignmentsForTable, logros]);

  const getNotaForStudent = (assignment: { submissions?: { estudianteId: string; calificacion?: number }[]; entregas?: { estudianteId: string; calificacion?: number }[] }, sid: string) => {
    const subs = assignment.submissions || assignment.entregas || [];
    const s = subs.find((x: { estudianteId: string }) => String(x.estudianteId) === String(sid));
    const cal = (s as { calificacion?: number })?.calificacion;
    return cal != null && !isNaN(cal) ? cal : null;
  };
  const promedioPonderado = useMemo(() => {
    if (!estudianteId || !currentStudent) return null;
    let weightedSum = 0;
    Object.values(assignmentsByLogro).forEach(({ logro, assignments }) => {
      if (logro._id === 'sin-logro') return;
      const notas: number[] = [];
      assignments.forEach((a: { submissions?: { estudianteId: string; calificacion?: number }[]; entregas?: { estudianteId: string; calificacion?: number }[] }) => { const n = getNotaForStudent(a, estudianteId); if (n != null) notas.push(n); });
      if (notas.length) {
        const prom = notas.reduce((s, n) => s + n, 0) / notas.length;
        weightedSum += (prom * (logro.porcentaje ?? 0)) / 100;
      }
    });
    const result = Math.round(weightedSum * 10) / 10;
    return Number.isNaN(result) ? null : result;
  }, [estudianteId, currentStudent, assignmentsByLogro]);

  // Vista de notas individual del estudiante (misma fuente que tabla, editable)
  if (estudianteId && currentStudent) {
    const subjectName = (subjectsForGroup as { nombre?: string }[])[0]?.nombre || 'Materia';
    return (
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-10">
        <div className="max-w-7xl mx-auto w-full">
          <div className="mb-8">
            <Breadcrumb
              items={[
                { label: 'Dashboard', href: '/dashboard' },
                { label: 'Cursos', href: '/profesor/academia/cursos' },
                { label: `Grupo ${groupDisplayName}`, href: `/course-detail/${cursoId}` },
                { label: 'Notas', href: `/course/${cursoId}/grades` },
                { label: currentStudent.nombre },
              ]}
            />
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 mt-4">
              <Avatar className="w-16 h-16 sm:w-20 sm:h-20 flex-shrink-0">
                <AvatarFallback className="bg-gradient-to-r from-[#002366] to-[#1e3cff] text-white text-xl">
                  {currentStudent.nombre.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <h1 className="text-2xl sm:text-3xl font-bold text-white font-['Poppins'] break-words">{currentStudent.nombre}</h1>
                {currentStudent.email && <p className="text-white/60 text-sm truncate">{currentStudent.email}</p>}
              </div>
            </div>
          </div>
          <Card className="bg-white/5 border-white/10 backdrop-blur-md mb-8">
            <CardHeader>
              <CardTitle className="text-white">{subjectName}</CardTitle>
              <CardDescription className="text-white/60">Grupo {groupDisplayName}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 bg-white/5 border border-white/10 rounded-lg">
                  <span className="text-white font-semibold">Promedio general</span>
                  <span className="text-2xl font-bold text-white ml-2">{promedioPonderado != null && !Number.isNaN(promedioPonderado) ? promedioPonderado : '—'}</span>
                  <span className="text-white">/ 100</span>
                </div>
                <div className="p-4 bg-white/5 border border-white/10 rounded-lg flex items-center gap-2">
                  <span className="text-white font-semibold">Estado</span>
                  <span
                    className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium text-white"
                    style={{
                      backgroundColor: promedioPonderado != null && !Number.isNaN(promedioPonderado)
                        ? (promedioPonderado >= PASSED_THRESHOLD ? '#16A34A' : '#DC2626')
                        : 'transparent',
                      border: (promedioPonderado == null || Number.isNaN(promedioPonderado)) ? '1px solid rgba(255,255,255,0.3)' : undefined,
                    }}
                  >
                    {promedioPonderado != null && !Number.isNaN(promedioPonderado)
                      ? (promedioPonderado >= PASSED_THRESHOLD ? 'Aprobado' : 'Reprobado')
                      : 'Sin notas'}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
          <div className="space-y-6">
            {Object.values(assignmentsByLogro).map(({ logro, assignments }) => {
              if (assignments.length === 0) return null;
              const notas: number[] = [];
              assignments.forEach((a: { submissions?: { estudianteId: string; calificacion?: number }[]; entregas?: { estudianteId: string; calificacion?: number }[] }) => { const n = getNotaForStudent(a, estudianteId); if (n != null) notas.push(n); });
              const promLogro = notas.length ? Math.round(notas.reduce((s, n) => s + n, 0) / notas.length) : null;
              return (
                <Card key={logro._id} className="bg-white/5 border-white/10 backdrop-blur-md">
                  <CardHeader>
                    <CardTitle className="text-white">{logro.nombre}</CardTitle>
                    <CardDescription className="text-white">
                      Promedio: {promLogro != null && !Number.isNaN(promLogro) ? `${promLogro} / 100` : '—'} {logro.porcentaje > 0 && ` · ${logro.porcentaje}% del total`}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {assignments.map((a: { _id: string; titulo: string; fechaEntrega?: string; submissions?: { estudianteId: string; calificacion?: number }[]; entregas?: { estudianteId: string; calificacion?: number }[] }) => {
                        const val = getNotaForStudent(a, estudianteId);
                        return (
                          <div key={a._id} className="p-4 bg-white/5 border border-white/10 rounded-lg flex items-center justify-between gap-4">
                            <div>
                              <h4 className="font-semibold text-white">{a.titulo}</h4>
                              {a.fechaEntrega && <p className="text-sm text-white">{new Date(a.fechaEntrega).toLocaleDateString('es-CO')}</p>}
                            </div>
                            <Input
                              type="number"
                              min={0}
                              max={100}
                              defaultValue={val != null ? val : ''}
                              className="w-20 text-center font-semibold text-white bg-white/10 border-white/20 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              onBlur={(e) => {
                                const n = parseInt(e.target.value, 10);
                                if (!isNaN(n) && n >= 0 && n <= 100) updateGradeMutation.mutate({ assignmentId: a._id, estudianteId, calificacion: n });
                              }}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  const promedioGeneral =
    students.length > 0
      ? students.reduce((acc, s) => acc + (Number((s as { promedio?: number }).promedio) || 0), 0) / students.length
      : 0;

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-10">
      <div className="max-w-7xl mx-auto w-full">
        {/* Header */}
        <div className="mb-8">
          <Breadcrumb
            items={[
              { label: 'Dashboard', href: '/dashboard' },
              { label: 'Cursos', href: '/profesor/academia/cursos' },
              { label: `Grupo ${groupDisplayName}`, href: `/course-detail/${cursoId}` },
              { label: 'Notas' },
            ]}
          />
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-2 font-['Poppins'] break-words">
                Notas del Curso {groupDisplayName}
              </h1>
              <p className="text-white/60 text-sm sm:text-base">
                Gestiona las notas de tus estudiantes en este curso
              </p>
            </div>
          </div>
        </div>

        {/* Resumen numérico simple */}
        <div className="flex flex-wrap items-center gap-4 mb-6 text-white/80 text-sm">
          <span>
            <strong className="text-white font-medium">{students.length}</strong> estudiantes
          </span>
          <span className="text-white/50">·</span>
          <span>
            Promedio del curso: <strong className="text-[#00c8ff]">{promedioGeneral.toFixed(1)}</strong>
          </span>
        </div>

        {/* Tabla de calificaciones — simple y clara */}
        <div className="rounded-xl border border-white/10 bg-white/[0.03] overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-white/10 hover:bg-transparent">
                  <TableHead className="text-white/70 font-medium text-xs uppercase tracking-wider py-4 pl-5">
                    Estudiante
                  </TableHead>
                  <TableHead className="text-white/70 font-medium text-xs uppercase tracking-wider py-4 text-right w-24">
                    Promedio
                  </TableHead>
                  <TableHead className="text-white/70 font-medium text-xs uppercase tracking-wider py-4 text-right w-28 hidden sm:table-cell">
                    Última nota
                  </TableHead>
                  <TableHead className="text-white/70 font-medium text-xs uppercase tracking-wider py-4 text-center w-28 hidden md:table-cell">
                    Estado
                  </TableHead>
                  <TableHead className="text-white/70 font-medium text-xs uppercase tracking-wider py-4 text-right w-32 pr-5">
                    Acción
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {students.map((student) => (
                  <TableRow
                    key={student._id}
                    className="border-white/5 hover:bg-white/5 transition-colors"
                  >
                    <TableCell className="py-3 pl-5">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-sm font-medium text-white">
                          {student.nombre.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                        </div>
                        <div>
                          <div className="font-medium text-white">{student.nombre}</div>
                          <div className="text-xs text-white/50 truncate max-w-[180px]">{(student as { email?: string }).email ?? ''}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="py-3 text-right">
                      <span className="font-semibold text-white tabular-nums">
                        {(Number((student as { promedio?: number }).promedio) || 0).toFixed(1)}
                      </span>
                      <span className="text-white text-sm ml-0.5">/100</span>
                    </TableCell>
                    <TableCell className="py-3 text-right hidden sm:table-cell text-white/80 tabular-nums">
                      {(Number((student as { ultimaNota?: number }).ultimaNota) ?? (student as { promedio?: number }).promedio ?? 0).toFixed(1)}
                    </TableCell>
                    <TableCell className="py-3 text-center hidden md:table-cell">
                      <span
                        className={`inline-block text-xs font-medium px-2 py-0.5 rounded ${
                          (Number((student as { promedio?: number }).promedio) || 0) >= 70
                            ? 'text-emerald-400/90 bg-emerald-500/10'
                            : (Number((student as { promedio?: number }).promedio) || 0) >= 50
                              ? 'text-amber-400/90 bg-amber-500/10'
                              : 'text-red-400/90 bg-red-500/10'
                        }`}
                      >
                        {(Number((student as { promedio?: number }).promedio) || 0) >= 70 ? 'Aprobado' : (Number((student as { promedio?: number }).promedio) || 0) >= 50 ? 'En proceso' : 'Bajo'}
                      </span>
                    </TableCell>
                    <TableCell className="py-3 pr-5 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-[#00c8ff] hover:text-[#00c8ff] hover:bg-[#00c8ff]/10 border-0 h-8 text-sm"
                        onClick={() => setLocation(`/profesor/cursos/${cursoId}/estudiantes/${student._id}/notas`)}
                      >
                        Ver notas
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </div>
  );
}
