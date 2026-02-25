import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/authContext';
import { useLocation, useRoute } from 'wouter';
import { Plus, MessageSquare } from 'lucide-react';
import { NavBackButton } from '@/components/nav-back-button';
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

export default function TeacherNotesPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  
  // Rutas dinámicas
  const [, paramsCourse] = useRoute('/profesor/cursos/:cursoId/notas');
  const [, paramsStudent] = useRoute('/profesor/cursos/:cursoId/estudiantes/:estudianteId/notas');
  
  const cursoId = paramsCourse?.cursoId || paramsStudent?.cursoId || '';
  const estudianteId = paramsStudent?.estudianteId || null;
  
  const [showAddNoteForm, setShowAddNoteForm] = useState(false);
  const [students] = useState<Student[]>(mockStudents);
  const [studentDetail] = useState<StudentDetail | null>(mockStudentDetail);

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

  // Si no hay cursoId, redirigir a cursos del módulo de academia
  useEffect(() => {
    if (!cursoId) {
      setLocation('/profesor/academia/cursos');
    }
  }, [cursoId, setLocation]);

  if (!cursoId) {
    return null;
  }

  // Vista de notas individual del estudiante
  if (estudianteId && studentDetail) {
    return (
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-10">
        <div className="max-w-7xl mx-auto w-full">
          {/* Header */}
          <div className="mb-8">
            <NavBackButton to={`/profesor/cursos/${cursoId}/notas`} label="Estudiantes" />
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
                <Avatar className="w-16 h-16 sm:w-20 sm:h-20 flex-shrink-0">
                  <AvatarFallback className="bg-gradient-to-r from-[#002366] to-[#1e3cff] text-white text-xl sm:text-2xl">
                    {studentDetail.nombre.split(' ').map(n => n[0]).join('')}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-2 font-['Poppins'] break-words">
                    {studentDetail.nombre}
                  </h1>
                  <p className="text-white/60 text-sm sm:text-base truncate">{studentDetail.email}</p>
                </div>
              </div>
              <Dialog open={showAddNoteForm} onOpenChange={setShowAddNoteForm}>
                <Button 
                  className="bg-gradient-to-r from-[#002366] to-[#1e3cff] hover:opacity-90"
                  onClick={() => setShowAddNoteForm(true)}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Agregar Nota
                </Button>
                <DialogContent className="bg-[#0a0a2a] border-white/10 text-white max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Agregar Nueva Nota</DialogTitle>
                    <DialogDescription className="text-white/60">
                      Registra una nueva calificación para {studentDetail.nombre}
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                      <Label htmlFor="categoria" className="text-white">Categoría *</Label>
                      <Select
                        value={formData.categoria}
                        onValueChange={(value) => setFormData({ ...formData, categoria: value })}
                        required
                      >
                        <SelectTrigger className="bg-white/5 border-white/10 text-white">
                          <SelectValue placeholder="Selecciona la categoría" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="examenes">Exámenes</SelectItem>
                          <SelectItem value="tareas">Tareas</SelectItem>
                          <SelectItem value="proyectos">Proyectos</SelectItem>
                          <SelectItem value="participacion">Participación</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="actividad" className="text-white">Nombre de Actividad *</Label>
                      <Input
                        id="actividad"
                        value={formData.actividad}
                        onChange={(e) => setFormData({ ...formData, actividad: e.target.value })}
                        required
                        className="bg-white/5 border-white/10 text-white"
                        placeholder="Ej: Examen Parcial 1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="fecha" className="text-white">Fecha *</Label>
                      <Input
                        id="fecha"
                        type="date"
                        value={formData.fecha}
                        onChange={(e) => setFormData({ ...formData, fecha: e.target.value })}
                        required
                        className="bg-white/5 border-white/10 text-white"
                      />
                    </div>
                    <div>
                      <Label htmlFor="nota" className="text-white">Nota (0 - 100) *</Label>
                      <Input
        id="nota"
        type="number"
        min="0"
        max="100"
                        step="0.1"
                        value={formData.nota}
                        onChange={(e) => setFormData({ ...formData, nota: e.target.value })}
                        required
                        className="bg-white/5 border-white/10 text-white"
                        placeholder="4.5"
                      />
                    </div>
                    <div>
                      <Label htmlFor="comentario" className="text-white">Comentario</Label>
                      <Textarea
                        id="comentario"
                        value={formData.comentario}
                        onChange={(e) => setFormData({ ...formData, comentario: e.target.value })}
                        className="bg-white/5 border-white/10 text-white"
                        placeholder="Comentarios adicionales (opcional)"
                        rows={3}
                      />
                    </div>
                    <div className="flex gap-2 justify-end">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          resetForm();
                          setShowAddNoteForm(false);
                        }}
                        className="border-white/10 text-white hover:bg-white/10"
                      >
                        Cancelar
                      </Button>
                      <Button
                        type="submit"
                        className="bg-gradient-to-r from-[#002366] to-[#1e3cff] hover:opacity-90"
                      >
                        Guardar Nota
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {/* Materia del Estudiante */}
          <Card className="bg-white/5 border-white/10 backdrop-blur-md mb-8">
            <CardHeader>
              <CardTitle className="text-white">{studentDetail.materiaNombre}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 bg-white/5 border border-white/10 rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="text-white font-semibold">Promedio Final</span>
                    <span className="text-2xl font-bold text-white">{studentDetail.promedioFinal.toFixed(1)}</span>
                  </div>
                </div>
                <div className="p-4 bg-white/5 border border-white/10 rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="text-white font-semibold">Estado</span>
                    <Badge className={studentDetail.promedioFinal >= 70 ? 'bg-green-500/20 text-green-400 border-green-500/40' : 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40'}>
                      {studentDetail.promedioFinal >= 4.0 ? 'Aprobado' : 'En Proceso'}
                    </Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Notas por Categoría */}
          <div className="space-y-6">
            {studentDetail.categorias.map((categoria, idx) => (
              <Card key={idx} className="bg-white/5 border-white/10 backdrop-blur-md">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-white">{categoria.categoria}</CardTitle>
                    <div className="flex items-center gap-2">
                      <span className="text-xl font-bold text-white">
                        {categoria.promedio.toFixed(1)}
                      </span>
                      <span className="text-white/50">/ 100</span>
                    </div>
                  </div>
                  <CardDescription className="text-white/60">
                    Promedio de {categoria.notas.length} {categoria.notas.length === 1 ? 'actividad' : 'actividades'}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {categoria.notas.map((nota, notaIdx) => (
                      <div
                        key={notaIdx}
                        className="p-4 bg-white/5 border border-white/10 rounded-lg"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <h4 className="font-semibold text-white mb-1">{nota.actividad}</h4>
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
                              {Math.round(nota.nota)}
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
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const promedioGeneral = students.reduce((acc, s) => acc + s.promedio, 0) / students.length;

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-10">
      <div className="max-w-7xl mx-auto w-full">
        {/* Header */}
        <div className="mb-8">
          <NavBackButton to="/profesor/academia/cursos" label="Cursos" />
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-2 font-['Poppins'] break-words">
                Notas del Curso {cursoId}
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
                {students.map((student, index) => (
                  <TableRow
                    key={student._id}
                    className="border-white/5 hover:bg-white/5 transition-colors"
                  >
                    <TableCell className="py-3 pl-5">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-sm font-medium text-white">
                          {student.nombre.split(' ').map(n => n[0]).join('').slice(0, 2)}
                        </div>
                        <div>
                          <div className="font-medium text-white">{student.nombre}</div>
                          <div className="text-xs text-white/50 truncate max-w-[180px]">{student.email}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="py-3 text-right">
                      <span className="font-semibold text-white tabular-nums">{student.promedio.toFixed(1)}</span>
                      <span className="text-white/40 text-sm ml-0.5">/100</span>
                    </TableCell>
                    <TableCell className="py-3 text-right hidden sm:table-cell text-white/80 tabular-nums">
                      {student.ultimaNota.toFixed(1)}
                    </TableCell>
                    <TableCell className="py-3 text-center hidden md:table-cell">
                      <span
                        className={`inline-block text-xs font-medium px-2 py-0.5 rounded ${
                          student.promedio >= 70
                            ? 'text-emerald-400/90 bg-emerald-500/10'
                            : student.promedio >= 50
                              ? 'text-amber-400/90 bg-amber-500/10'
                              : 'text-red-400/90 bg-red-500/10'
                        }`}
                      >
                        {student.promedio >= 70 ? 'Aprobado' : student.promedio >= 50 ? 'En proceso' : 'Bajo'}
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
