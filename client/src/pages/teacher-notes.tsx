import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/authContext';
import { useLocation, useRoute } from 'wouter';
import { 
  BookOpen, 
  Users, 
  Plus,
  User,
  Calendar,
  FileText,
  MessageSquare,
  TrendingUp,
  BarChart3
} from 'lucide-react';
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
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line } from 'recharts';

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
    promedio: 4.5,
    ultimaNota: 4.8
  },
  {
    _id: '2',
    nombre: 'María García',
    email: 'maria.garcia@example.com',
    estado: 'activo',
    promedio: 4.8,
    ultimaNota: 5.0
  },
  {
    _id: '3',
    nombre: 'Carlos Rodríguez',
    email: 'carlos.rodriguez@example.com',
    estado: 'activo',
    promedio: 3.9,
    ultimaNota: 4.0
  },
  {
    _id: '4',
    nombre: 'Ana Martínez',
    email: 'ana.martinez@example.com',
    estado: 'activo',
    promedio: 4.2,
    ultimaNota: 4.3
  }
];

const mockStudentDetail: StudentDetail = {
  _id: '1',
  nombre: 'Juan Pérez',
  email: 'juan.perez@example.com',
  estado: 'activo',
  promedio: 4.5,
  ultimaNota: 4.8,
  materiaId: 'mat-1',
  materiaNombre: 'Matemáticas',
  promedioFinal: 4.5,
  categorias: [
    {
      categoria: 'Exámenes',
      promedio: 4.6,
      notas: [
        { actividad: 'Examen Parcial 1', nota: 4.5, fecha: '2024-01-15', comentario: 'Buen trabajo, sigue así' },
        { actividad: 'Examen Parcial 2', nota: 4.7, fecha: '2024-02-20', comentario: 'Excelente progreso' }
      ]
    },
    {
      categoria: 'Tareas',
      promedio: 4.4,
      notas: [
        { actividad: 'Tarea de Álgebra', nota: 4.3, fecha: '2024-01-10', comentario: 'Bien hecho' },
        { actividad: 'Tarea de Geometría', nota: 4.5, fecha: '2024-02-05' }
      ]
    },
    {
      categoria: 'Proyectos',
      promedio: 4.5,
      notas: [
        { actividad: 'Proyecto Final', nota: 4.5, fecha: '2024-03-01', comentario: 'Buen proyecto, bien estructurado' }
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
                      <Label htmlFor="nota" className="text-white">Nota (0.0 - 5.0) *</Label>
                      <Input
                        id="nota"
                        type="number"
                        min="0"
                        max="5"
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
                    <Badge className={studentDetail.promedioFinal >= 4.0 ? 'bg-green-500/20 text-green-400 border-green-500/40' : 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40'}>
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
                      <span className="text-white/50">/ 5.0</span>
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
                              {nota.nota.toFixed(1)}
                            </span>
                            <span className="text-white/50">/ 5.0</span>
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

  // Vista principal: Lista de estudiantes del curso
  const promedioGeneral = students.reduce((acc, s) => acc + s.promedio, 0) / students.length;
  
  // Datos para la gráfica de promedios por estudiante
  const chartData = students.map(s => ({
    nombre: s.nombre.split(' ')[0],
    promedio: s.promedio
  }));

  const chartConfig = {
    promedio: {
      label: 'Promedio',
      color: '#1e3cff'
    }
  };

  // Datos para gráfica por categoría (mock)
  const categoryData = [
    { categoria: 'Exámenes', promedio: 4.5 },
    { categoria: 'Tareas', promedio: 4.3 },
    { categoria: 'Proyectos', promedio: 4.4 },
    { categoria: 'Participación', promedio: 4.2 }
  ];

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

        {/* Gráfica General del Curso */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <Card className="bg-white/5 border-white/10 backdrop-blur-md">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-[#1e3cff]" />
                Promedios por Estudiante
              </CardTitle>
              <CardDescription className="text-white/60">
                Promedio general del curso: <span className="text-white font-semibold">{promedioGeneral.toFixed(2)}</span>
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 md:p-6">
              <div className="w-full overflow-x-auto">
                <ChartContainer config={chartConfig} className="h-[280px] md:h-[320px] min-w-[300px]">
                  <BarChart 
                    data={chartData}
                    margin={{ top: 20, right: 20, bottom: 40, left: 20 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                    <XAxis 
                      dataKey="nombre" 
                      stroke="rgba(255,255,255,0.5)"
                      tick={{ fill: 'rgba(255,255,255,0.7)', fontSize: 12 }}
                      angle={-45}
                      textAnchor="end"
                      height={60}
                      interval={0}
                    />
                    <YAxis 
                      domain={[0, 5]}
                      stroke="rgba(255,255,255,0.5)"
                      tick={{ fill: 'rgba(255,255,255,0.7)', fontSize: 12 }}
                      width={40}
                    />
                    <ChartTooltip 
                      content={<ChartTooltipContent />}
                      cursor={{ fill: 'rgba(159, 37, 184, 0.1)' }}
                    />
                    <Bar 
                      dataKey="promedio" 
                      fill="#1e3cff"
                      radius={[8, 8, 0, 0]}
                    />
                  </BarChart>
                </ChartContainer>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/5 border-white/10 backdrop-blur-md">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-[#1e3cff]" />
                Promedios por Categoría
              </CardTitle>
              <CardDescription className="text-white/60">
                Rendimiento general del curso por categoría
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 md:p-6">
              <div className="w-full overflow-x-auto">
                <ChartContainer config={chartConfig} className="h-[280px] md:h-[320px] min-w-[300px]">
                  <BarChart 
                    data={categoryData}
                    margin={{ top: 20, right: 20, bottom: 40, left: 20 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                    <XAxis 
                      dataKey="categoria" 
                      stroke="rgba(255,255,255,0.5)"
                      tick={{ fill: 'rgba(255,255,255,0.7)', fontSize: 12 }}
                      angle={-45}
                      textAnchor="end"
                      height={60}
                      interval={0}
                    />
                    <YAxis 
                      domain={[0, 5]}
                      stroke="rgba(255,255,255,0.5)"
                      tick={{ fill: 'rgba(255,255,255,0.7)', fontSize: 12 }}
                      width={40}
                    />
                    <ChartTooltip 
                      content={<ChartTooltipContent />}
                      cursor={{ fill: 'rgba(159, 37, 184, 0.1)' }}
                    />
                    <Bar 
                      dataKey="promedio" 
                      fill="#1e3cff"
                      radius={[8, 8, 0, 0]}
                    />
                  </BarChart>
                </ChartContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabla General del Curso */}
        <Card className="bg-white/5 border-white/10 backdrop-blur-md mb-8">
          <CardHeader>
            <CardTitle className="text-white">Resumen General del Curso</CardTitle>
            <CardDescription className="text-white/60">
              Vista rápida del rendimiento de todos los estudiantes
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto -mx-4 md:mx-0">
              <div className="inline-block min-w-full align-middle px-4 md:px-0">
                <Table>
              <TableHeader>
                <TableRow className="border-white/10">
                  <TableHead className="text-white min-w-[200px]">Estudiante</TableHead>
                  <TableHead className="text-white whitespace-nowrap">Promedio</TableHead>
                  <TableHead className="text-white whitespace-nowrap">Última Nota</TableHead>
                  <TableHead className="text-white whitespace-nowrap">Estado</TableHead>
                  <TableHead className="text-white whitespace-nowrap">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {students.map((student) => (
                  <TableRow key={student._id} className="border-white/10">
                    <TableCell className="text-white">
                      <div className="flex items-center gap-3">
                        <Avatar className="w-8 h-8">
                          <AvatarFallback className="bg-gradient-to-r from-[#002366] to-[#1e3cff] text-white text-sm">
                            {student.nombre.split(' ').map(n => n[0]).join('')}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium">{student.nombre}</div>
                          <div className="text-sm text-white/60">{student.email}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-white">
                      <span className="text-lg font-semibold">{student.promedio.toFixed(1)}</span>
                      <span className="text-white/50 text-sm ml-1">/ 5.0</span>
                    </TableCell>
                    <TableCell className="text-white">
                      <span className="font-medium">{student.ultimaNota.toFixed(1)}</span>
                      <span className="text-white/50 text-sm ml-1">/ 5.0</span>
                    </TableCell>
                    <TableCell>
                      <Badge className={student.promedio >= 4.0 ? 'bg-green-500/20 text-green-400 border-green-500/40' : student.promedio >= 3.0 ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40' : 'bg-red-500/20 text-red-400 border-red-500/40'}>
                        {student.promedio >= 4.0 ? 'Excelente' : student.promedio >= 3.0 ? 'Bueno' : 'Requiere Atención'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2 flex-wrap">
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-white/10 text-white hover:bg-white/10 text-xs md:text-sm"
                          onClick={() => setLocation(`/profesor/cursos/${cursoId}/estudiantes/${student._id}/notas`)}
                        >
                          <span className="hidden sm:inline">Ver Notas</span>
                          <span className="sm:hidden">Ver</span>
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-[#1e3cff]/40 text-[#1e3cff] hover:bg-[#1e3cff]/10"
                          onClick={() => {
                            setLocation(`/profesor/cursos/${cursoId}/estudiantes/${student._id}/notas`);
                            setShowAddNoteForm(true);
                          }}
                        >
                          <Plus className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Lista de Estudiantes (Cards) */}
        <div className="mb-8">
          <h2 className="text-xl sm:text-2xl font-bold text-white mb-4 font-['Poppins']">Estudiantes del Curso</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {students.map((student) => (
              <Card
                key={student._id}
                className="bg-white/5 border-white/10 backdrop-blur-md hover-elevate"
              >
                <CardHeader className="p-6">
                  <div className="flex items-center gap-4 mb-4">
                    <Avatar className="w-16 h-16">
                      <AvatarFallback className="bg-gradient-to-r from-[#002366] to-[#1e3cff] text-white text-lg">
                        {student.nombre.split(' ').map(n => n[0]).join('')}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-white">{student.nombre}</h3>
                      <p className="text-sm text-white/60">{student.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mb-4">
                    <Badge className={student.estado === 'activo' ? 'bg-green-500/20 text-green-400 border-green-500/40' : 'bg-red-500/20 text-red-400 border-red-500/40'}>
                      {student.estado}
                    </Badge>
                    <Badge className={student.promedio >= 4.0 ? 'bg-green-500/20 text-green-400 border-green-500/40' : 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40'}>
                      Promedio: {student.promedio.toFixed(1)}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-6 pt-0 space-y-2">
                  <Button
                    variant="outline"
                    className="w-full border-white/10 text-white hover:bg-white/10"
                    onClick={() => setLocation(`/profesor/cursos/${cursoId}/estudiantes/${student._id}/notas`)}
                  >
                    Ver Notas del Estudiante
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full border-[#1e3cff]/40 text-[#1e3cff] hover:bg-[#1e3cff]/10"
                    onClick={() => {
                      setLocation(`/profesor/cursos/${cursoId}/estudiantes/${student._id}/notas`);
                      setShowAddNoteForm(true);
                    }}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Agregar Nota
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
