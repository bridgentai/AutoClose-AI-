import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/authContext';
import { AppSidebar } from '@/components/app-sidebar';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { Calendar as CalendarIcon, ClipboardList, User, ArrowLeft, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { useLocation, useRoute } from 'wouter';
import { Calendar } from '@/components/Calendar';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface Assignment {
  _id: string;
  titulo: string;
  descripcion: string;
  curso: string;
  fechaEntrega: string;
  profesorNombre: string;
}

interface CourseSubject {
  _id: string;
  nombre: string;
  descripcion?: string;
  colorAcento?: string;
}

export default function CourseDetailPage() {
  const [, params] = useRoute('/course/:cursoId');
  const cursoId = params?.cursoId || '';
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [showAssignmentForm, setShowAssignmentForm] = useState(false);
  const [formData, setFormData] = useState({
    titulo: '',
    descripcion: '',
    fechaEntrega: '',
    courseId: '',
  });

  // Obtener mes y año actuales
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  // Query para obtener tareas del curso
  const { data: assignments = [] } = useQuery<Assignment[]>({
    queryKey: ['/api/assignments/curso', cursoId, currentMonth, currentYear],
  });

  // Query para obtener las materias del profesor para este grupo
  const { data: subjectsForGroup = [] } = useQuery<CourseSubject[]>({
    queryKey: ['/api/courses/for-group', cursoId],
    enabled: user?.rol === 'profesor',
  });

  // Auto-seleccionar materia si el profesor solo dicta una
  useEffect(() => {
    if (subjectsForGroup.length === 1 && showAssignmentForm) {
      setFormData(prev => ({ ...prev, courseId: subjectsForGroup[0]._id }));
    }
  }, [subjectsForGroup, showAssignmentForm]);

  // Resetear formData cuando se cierra el formulario
  useEffect(() => {
    if (!showAssignmentForm) {
      setFormData({ titulo: '', descripcion: '', fechaEntrega: '', courseId: '' });
    }
  }, [showAssignmentForm]);

  // Mutation para crear tarea
  const createAssignmentMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      if (!data.courseId) {
        throw new Error('Debes seleccionar una materia para esta tarea');
      }
      
      return await apiRequest('POST', '/api/assignments', {
        titulo: data.titulo,
        descripcion: data.descripcion,
        curso: cursoId,
        courseId: data.courseId,
        fechaEntrega: data.fechaEntrega,
        profesorId: user?.id,
        profesorNombre: user?.nombre,
        colegioId: user?.colegioId || 'default_colegio',
      });
    },
    onSuccess: () => {
      toast({
        title: '¡Tarea creada!',
        description: 'La tarea ha sido asignada al curso exitosamente.',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/assignments/curso', cursoId] });
      setFormData({ titulo: '', descripcion: '', fechaEntrega: '', courseId: '' });
      setShowAssignmentForm(false);
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'No se pudo crear la tarea',
        variant: 'destructive',
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createAssignmentMutation.mutate(formData);
  };

  const handleDayClick = (assignment: Assignment) => {
    setLocation(`/assignment/${assignment._id}`);
  };

  return (
    <SidebarProvider>
      <div className="flex h-screen w-full bg-gradient-to-br from-[#0a0a0c] via-[#1a001c] to-[#3d0045]">
        <AppSidebar />
        <SidebarInset className="flex flex-col flex-1">
          <header className="flex items-center justify-between p-4 border-b border-white/10 backdrop-blur-xl bg-black/20">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setLocation('/courses')}
                className="text-white hover:bg-white/10"
                data-testid="button-back"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <SidebarTrigger data-testid="button-sidebar-toggle" className="text-white" />
              <h1 className="text-xl font-bold text-white font-['Poppins']">
                Curso {cursoId}
              </h1>
            </div>
            <Button
              onClick={() => setLocation('/account')}
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/10"
              data-testid="button-account"
            >
              <User className="w-5 h-5" />
            </Button>
          </header>

          <main className="flex-1 overflow-auto p-8">
            <div className="max-w-7xl mx-auto">
              <div className="mb-8">
                <h2 className="text-3xl font-bold text-white mb-2 font-['Poppins']">
                  Gestión del Curso {cursoId}
                </h2>
                <p className="text-white/60">
                  Asigna tareas y revisa el calendario del curso
                </p>
              </div>

              {/* Botones de acción */}
              <div className="flex gap-4 mb-8">
                <Button
                  onClick={() => setShowAssignmentForm(!showAssignmentForm)}
                  className="bg-gradient-to-r from-[#9f25b8] to-[#6a0dad] hover:opacity-90"
                  data-testid="button-assign-task"
                >
                  <ClipboardList className="w-4 h-4 mr-2" />
                  {showAssignmentForm ? 'Cancelar' : 'Asignar Nueva Tarea'}
                </Button>
              </div>

              {/* Formulario para asignar tarea */}
              {showAssignmentForm && (
                <Card className="bg-white/5 border-white/10 backdrop-blur-md mb-8">
                  <CardHeader>
                    <CardTitle className="text-white">Nueva Tarea</CardTitle>
                    <CardDescription className="text-white/60">
                      Asignar tarea para el curso {cursoId}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {subjectsForGroup.length === 0 && (
                      <Alert className="mb-4 bg-red-500/10 border-red-500/50">
                        <AlertCircle className="h-4 w-4 text-red-400" />
                        <AlertDescription className="text-red-200">
                          No tienes materias asignadas a este curso. Por favor contacta al administrador para que te asignen materias.
                        </AlertDescription>
                      </Alert>
                    )}
                    
                    <form onSubmit={handleSubmit} className="space-y-4">
                      {/* Mostrar selector solo si el profesor dicta MÁS DE UNA materia */}
                      {subjectsForGroup.length > 1 && (
                        <div>
                          <Label htmlFor="materia" className="text-white">Materia *</Label>
                          <Select
                            value={formData.courseId}
                            onValueChange={(value) => setFormData({ ...formData, courseId: value })}
                            required
                          >
                            <SelectTrigger 
                              className="bg-white/5 border-white/10 text-white"
                              data-testid="select-materia"
                            >
                              <SelectValue placeholder="Selecciona la materia" />
                            </SelectTrigger>
                            <SelectContent>
                              {subjectsForGroup.map((subject) => (
                                <SelectItem key={subject._id} value={subject._id}>
                                  {subject.nombre}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                      
                      {/* Mostrar badge si el profesor dicta UNA SOLA materia (auto-seleccionada) */}
                      {subjectsForGroup.length === 1 && (
                        <div>
                          <Label className="text-white mb-2 block">Materia</Label>
                          <div className="flex items-center gap-2">
                            <Badge 
                              className="bg-[#9f25b8]/20 text-white border border-[#9f25b8]/40 text-base px-4 py-2"
                              data-testid="badge-materia-auto-selected"
                            >
                              {subjectsForGroup[0].nombre}
                            </Badge>
                            <span className="text-white/50 text-sm">(auto-seleccionada)</span>
                          </div>
                        </div>
                      )}
                      <div>
                        <Label htmlFor="titulo" className="text-white">Título</Label>
                        <Input
                          id="titulo"
                          value={formData.titulo}
                          onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
                          required
                          className="bg-white/5 border-white/10 text-white"
                          placeholder="Título de la tarea"
                          data-testid="input-titulo"
                        />
                      </div>
                      <div>
                        <Label htmlFor="descripcion" className="text-white">Descripción</Label>
                        <Textarea
                          id="descripcion"
                          value={formData.descripcion}
                          onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                          required
                          className="bg-white/5 border-white/10 text-white"
                          placeholder="Descripción de la tarea"
                          rows={4}
                          data-testid="input-descripcion"
                        />
                      </div>
                      <div>
                        <Label htmlFor="fechaEntrega" className="text-white">Fecha de Entrega</Label>
                        <Input
                          id="fechaEntrega"
                          type="datetime-local"
                          value={formData.fechaEntrega}
                          onChange={(e) => setFormData({ ...formData, fechaEntrega: e.target.value })}
                          required
                          className="bg-white/5 border-white/10 text-white"
                          data-testid="input-fecha-entrega"
                        />
                      </div>
                      <Button
                        type="submit"
                        disabled={createAssignmentMutation.isPending || subjectsForGroup.length === 0}
                        className="w-full bg-gradient-to-r from-[#9f25b8] to-[#6a0dad] hover:opacity-90"
                        data-testid="button-submit-task"
                      >
                        {createAssignmentMutation.isPending ? 'Creando...' : 'Crear Tarea'}
                      </Button>
                    </form>
                  </CardContent>
                </Card>
              )}

              {/* Calendario del curso */}
              <Card className="bg-white/5 border-white/10 backdrop-blur-md">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-white">
                    <CalendarIcon className="w-5 h-5 text-[#9f25b8]" />
                    Calendario del Curso
                  </CardTitle>
                  <CardDescription className="text-white/60">
                    Tareas asignadas para {cursoId}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Calendar assignments={assignments} onDayClick={handleDayClick} />
                </CardContent>
              </Card>

              {/* Lista de tareas */}
              {assignments.length > 0 && (
                <Card className="bg-white/5 border-white/10 backdrop-blur-md mt-8">
                  <CardHeader>
                    <CardTitle className="text-white">Tareas del Mes</CardTitle>
                    <CardDescription className="text-white/60">
                      {assignments.length} {assignments.length === 1 ? 'tarea asignada' : 'tareas asignadas'}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {assignments.map((assignment) => (
                        <div
                          key={assignment._id}
                          className="p-4 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
                          onClick={() => setLocation(`/assignment/${assignment._id}`)}
                          data-testid={`assignment-item-${assignment._id}`}
                        >
                          <h4 className="font-semibold text-white mb-1">{assignment.titulo}</h4>
                          <p className="text-sm text-white/70 mb-2">{assignment.descripcion}</p>
                          <p className="text-xs text-[#9f25b8]">
                            Entrega: {new Date(assignment.fechaEntrega).toLocaleString('es-CO')}
                          </p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
