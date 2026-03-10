import { useState, useMemo } from 'react';
import { useAuth } from '@/lib/authContext';
import { Calendar as CalendarIcon, Plus, X, Paperclip, Link2, FileText } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useLocation } from 'wouter';
import { Calendar } from '@/components/Calendar';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { NavBackButton } from '@/components/nav-back-button';

interface Assignment {
  _id: string;
  titulo: string;
  descripcion: string;
  curso: string;
  fechaEntrega: string;
  profesorNombre: string;
  courseId?: string;
  adjuntos?: { tipo: string; nombre: string; url: string }[];
}

interface Course {
  _id: string;
  nombre: string;
  cursos: string[];
}

interface ProfessorGroupAssignment {
  groupId: string;
  subjects: Course[];
  totalStudents: number;
}

type AttachmentType = 'pdf' | 'link' | 'imagen' | 'documento' | 'otro';

interface Attachment {
  tipo: AttachmentType;
  nombre: string;
  url: string;
}

export default function TeacherCalendarPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    titulo: '',
    descripcion: '',
    curso: '',
    logroCalificacionId: '',
    fechaEntrega: '',
    horaEntrega: '23:59',
  });
  const [adjuntos, setAdjuntos] = useState<Attachment[]>([]);
  const [newAttachment, setNewAttachment] = useState<Attachment>({ tipo: 'link', nombre: '', url: '' });

  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();
  
  // Calcular días del mes actual para la barra de progreso
  const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();

  const { data: assignments = [], refetch: refetchAssignments } = useQuery<Assignment[]>({
    queryKey: ['teacherAssignments', user?.id],
    queryFn: () => apiRequest<Assignment[]>('GET', '/api/assignments'),
    enabled: !!user?.id && user?.rol === 'profesor',
    staleTime: 60 * 1000,
  });

  const assignmentsThisMonth = useMemo(() => {
    return assignments.filter((a) => {
      const d = new Date(a.fechaEntrega);
      return d.getMonth() + 1 === currentMonth && d.getFullYear() === currentYear;
    });
  }, [assignments, currentMonth, currentYear]);

  const { data: professorGroups = [], isLoading: isLoadingGroups } = useQuery<ProfessorGroupAssignment[]>({
    queryKey: ['professorGroups'],
    queryFn: () => apiRequest('GET', '/api/professor/my-groups'),
    enabled: !!user?.id,
    staleTime: 0,
  });

  const availableGroups = professorGroups.map(g => g.groupId);
  const getSubjectsForGroup = (groupId: string) => {
    const group = professorGroups.find(g => g.groupId === groupId);
    return group?.subjects || [];
  };

  const courseIdForLogros = formData.curso ? getSubjectsForGroup(formData.curso)[0]?._id : '';
  interface LogroItem {
    _id: string;
    nombre: string;
    porcentaje?: number;
  }
  const { data: logrosData } = useQuery<{ logros: LogroItem[] }>({
    queryKey: ['/api/logros-calificacion', courseIdForLogros],
    queryFn: () =>
      apiRequest('GET', `/api/logros-calificacion?courseId=${encodeURIComponent(courseIdForLogros)}`),
    enabled: !!courseIdForLogros,
  });
  const logros = logrosData?.logros ?? [];

  const createAssignmentMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest<{ _id: string }>('POST', '/api/assignments', data);
      return res;
    },
    onSuccess: () => {
      toast({ title: 'Tarea creada', description: 'La tarea se creó correctamente y aparecerá en el calendario.' });
      setIsDialogOpen(false);
      resetForm();

      // Invalidar y refetch explícito del calendario del profesor (misma clave que useQuery)
      const queryKey = ['teacherAssignments', user?.id, currentMonth, currentYear];
      queryClient.invalidateQueries({ queryKey });
      refetchAssignments();

      queryClient.invalidateQueries({ queryKey: ['studentAssignments'] });
      queryClient.invalidateQueries({ queryKey: ['assignments'] });
      queryClient.invalidateQueries({ queryKey: ['/api/assignments/student'], exact: false });
    },
    onError: (error: Error) => {
      const message = error?.message || 'No se pudo crear la tarea';
      toast({ title: 'Error al crear la tarea', description: message, variant: 'destructive' });
    },
  });

  const resetForm = () => {
    setFormData({
      titulo: '',
      descripcion: '',
      curso: '',
      logroCalificacionId: '',
      fechaEntrega: '',
      horaEntrega: '23:59',
    });
    setAdjuntos([]);
  };

  const handleDayClick = (assignment: Assignment) => {
    // Navegar a la página de tareas del grupo (curso)
    if (assignment.curso) {
      setLocation(`/profesor/cursos/${assignment.curso}/tareas`);
    }
  };

  const handleAddAttachment = () => {
    if (newAttachment.nombre && newAttachment.url) {
      setAdjuntos([...adjuntos, newAttachment]);
      setNewAttachment({ tipo: 'link', nombre: '', url: '' });
    }
  };

  const handleRemoveAttachment = (index: number) => {
    setAdjuntos(adjuntos.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.titulo || !formData.descripcion || !formData.curso || !formData.fechaEntrega) {
      toast({ title: 'Error', description: 'Por favor completa todos los campos obligatorios', variant: 'destructive' });
      return;
    }

    const subjectsForGroup = getSubjectsForGroup(formData.curso);
    if (subjectsForGroup.length === 0) {
      toast({ title: 'Error', description: 'No tienes materias asignadas a este grupo.', variant: 'destructive' });
      return;
    }

    const courseId = subjectsForGroup[0]._id;
    const fechaEntregaCompleta = new Date(`${formData.fechaEntrega}T${formData.horaEntrega}`);

    if (logros.length > 0 && !formData.logroCalificacionId) {
      toast({
        title: 'Selecciona un logro',
        description: 'Este curso tiene logros de calificación. Elige uno para asignar la tarea.',
        variant: 'destructive',
      });
      return;
    }

    // Backend espera adjuntos como string[] (URLs o JSON); convertir para no romper el esquema
    const adjuntosPayload = adjuntos.map((a) =>
      typeof a === 'string' ? a : JSON.stringify({ tipo: a.tipo, nombre: a.nombre, url: a.url })
    );

    createAssignmentMutation.mutate({
      titulo: formData.titulo,
      descripcion: formData.descripcion,
      curso: formData.curso,
      courseId,
      fechaEntrega: fechaEntregaCompleta.toISOString(),
      adjuntos: adjuntosPayload,
      categoryId: formData.logroCalificacionId || undefined,
      logroCalificacionId: formData.logroCalificacionId || undefined,
    });
  };

  return (
    <>
    <div className="flex-1 overflow-auto p-8 relative">
            <div className="max-w-5xl mx-auto">
              <div className="mb-8">
                <NavBackButton to="/dashboard" label="Dashboard" />
                <h2 className="text-3xl font-bold text-white mb-2 font-['Poppins'] mt-4">
                  Calendario General
                </h2>
                <p className="text-white/60">
                  Acomoda tus días a tu gusto
                </p>
              </div>

              <Card className="bg-white/5 border-white/10 backdrop-blur-md relative">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CalendarIcon className="w-5 h-5 text-[#00c8ff]" />
                      <CardTitle className="text-white">
                        Calendario del Mes
                      </CardTitle>
                    </div>
                    <Button
                      onClick={() => setIsDialogOpen(true)}
                      className="w-10 h-10 rounded-full bg-gradient-to-r from-[#002366] to-[#1e3cff] hover:opacity-90 shadow-lg shadow-[#1e3cff]/30"
                      size="icon"
                      data-testid="button-create-assignment"
                      aria-label="Crear nueva tarea"
                    >
                      <Plus className="w-5 h-5" />
                    </Button>
                  </div>
                  <CardDescription className="text-white/60">
                    {assignments.length} tarea{assignments.length !== 1 ? 's' : ''} en total (todos tus cursos). Clic en un día o en una tarea para abrirla.
                  </CardDescription>
                  {/* Barra de progreso mensual */}
                  {assignmentsThisMonth.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-white/10">
                      <div className="flex items-center justify-between text-sm mb-2">
                        <span className="text-white/70">Progreso del mes</span>
                        <span className="text-white font-medium">{assignmentsThisMonth.length} tareas este mes</span>
                      </div>
                      <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-[#002366] to-[#1e3cff] transition-all duration-300"
                          style={{ 
                            width: `${Math.min(100, (assignmentsThisMonth.length / Math.max(1, daysInMonth)) * 100)}%` 
                          }}
                        />
                      </div>
                    </div>
                  )}
                </CardHeader>
                <CardContent className="pt-6">
                  <Calendar assignments={assignments} onDayClick={handleDayClick} />
                </CardContent>
              </Card>

              {assignments.length > 0 && (
                <Card className="bg-white/5 border-white/10 backdrop-blur-md mt-8">
                  <CardHeader>
                    <CardTitle className="text-white">Tareas del Mes</CardTitle>
                    <CardDescription className="text-white/60">
                      Resumen organizado de todas las tareas asignadas
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between p-4 bg-white/5 border border-white/10 rounded-lg">
                      <div>
                        <p className="text-white font-medium mb-1">
                          {assignments.length} {assignments.length === 1 ? 'tarea' : 'tareas'} en total
                        </p>
                        <p className="text-sm text-white/60">
                          Ver resumen detallado y organizado
                        </p>
                      </div>
                      <Button
                        onClick={() => setLocation('/profesor/tareas/resumen')}
                        className="bg-gradient-to-r from-[#002366] to-[#1e3cff] hover:opacity-90 text-white"
                      >
                        Ver Resumen
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

            </div>
          </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="bg-[#0a0a2a] border-white/10 text-white max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold">Crear Nueva Tarea</DialogTitle>
            <DialogDescription className="text-white/60">
              Asigna una tarea o trabajo a tus estudiantes
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-6 mt-4">
            <div className="space-y-2">
              <Label htmlFor="titulo">Nombre de la Tarea *</Label>
              <Input
                id="titulo"
                value={formData.titulo}
                onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
                placeholder="Ej: Taller de Álgebra"
                className="bg-white/5 border-white/10 text-white"
                data-testid="input-titulo"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="descripcion">Descripción *</Label>
              <Textarea
                id="descripcion"
                value={formData.descripcion}
                onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                placeholder="Describe los objetivos y requisitos de la tarea..."
                className="bg-white/5 border-white/10 text-white min-h-[100px]"
                data-testid="input-descripcion"
              />
            </div>

            <div className="space-y-2">
              <Label>Curso/Materia *</Label>
              <Select
                value={formData.curso}
                onValueChange={(value) => setFormData({ ...formData, curso: value, logroCalificacionId: '' })}
                disabled={isLoadingGroups || availableGroups.length === 0}
              >
                <SelectTrigger className="bg-white/5 border-white/10 text-white h-auto py-2" data-testid="select-curso">
                  <SelectValue placeholder={
                    isLoadingGroups ? "Cargando grupos..." :
                    availableGroups.length === 0 ? "Sin grupos asignados" : 
                    "Selecciona curso"
                  }>
                    {formData.curso && getSubjectsForGroup(formData.curso).length > 0
                      ? getSubjectsForGroup(formData.curso).map(s => s.nombre).join(', ')
                      : formData.curso || ''}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="bg-[#0a0a2a] border-white/10">
                  {availableGroups.map((grupo) => {
                    const subjects = getSubjectsForGroup(grupo);
                    const subjectNames = subjects.map(s => s.nombre).join(', ') || 'Sin materia asignada';
                    return (
                      <SelectItem key={grupo} value={grupo} className="text-white hover:bg-white/10">
                        <div className="flex flex-col items-start py-1">
                          <span className="font-semibold">{subjectNames}</span>
                          <span className="text-xs text-white/60">Grupo: {grupo}</span>
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              {formData.curso && getSubjectsForGroup(formData.curso).length > 0 && (
                <p className="text-xs text-white/50">
                  Grupo: {formData.curso} • Materia: {getSubjectsForGroup(formData.curso).map(s => s.nombre).join(', ')}
                </p>
              )}
              {!isLoadingGroups && availableGroups.length === 0 && (
                <p className="text-xs text-amber-400">
                  Aún no tienes grupos asignados. El administrador del colegio te asignará a cursos desde su panel.
                </p>
              )}
            </div>

            {formData.curso && (
              <div className="space-y-2">
                <Label className="text-white/90">Logro de calificación</Label>
                {logros.length === 0 ? (
                  <p className="text-sm text-white/60">
                    No hay logros definidos para este curso. Puedes crear la tarea sin asignar a un logro.
                  </p>
                ) : (
                  <Select
                    value={formData.logroCalificacionId}
                    onValueChange={(value) => setFormData({ ...formData, logroCalificacionId: value })}
                  >
                    <SelectTrigger className="bg-white/5 border-white/10 text-white" data-testid="select-logro">
                      <SelectValue placeholder="Selecciona el logro para esta tarea" />
                    </SelectTrigger>
                    <SelectContent className="bg-[#0a0a2a] border-white/10">
                      {logros.map((logro) => (
                        <SelectItem key={logro._id} value={logro._id} className="text-white hover:bg-white/10">
                          {logro.nombre}
                          {logro.porcentaje != null ? ` (${logro.porcentaje}%)` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="fechaEntrega">Fecha de Entrega *</Label>
                <Input
                  id="fechaEntrega"
                  type="date"
                  value={formData.fechaEntrega}
                  onChange={(e) => setFormData({ ...formData, fechaEntrega: e.target.value })}
                  className="bg-white/5 border-white/10 text-white"
                  data-testid="input-fecha"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="horaEntrega">Hora Límite</Label>
                <Input
                  id="horaEntrega"
                  type="time"
                  value={formData.horaEntrega}
                  onChange={(e) => setFormData({ ...formData, horaEntrega: e.target.value })}
                  className="bg-white/5 border-white/10 text-white"
                  data-testid="input-hora"
                />
              </div>
            </div>

            <div className="space-y-4">
              <Label>Adjuntos (PDFs, Links, etc.)</Label>
              
              {adjuntos.length > 0 && (
                <div className="space-y-2">
                  {adjuntos.map((adj, index) => (
                    <div key={index} className="flex items-center gap-2 p-2 bg-white/5 rounded-lg">
                      {adj.tipo === 'link' ? <Link2 className="w-4 h-4 text-[#00c8ff]" /> : <FileText className="w-4 h-4 text-[#00c8ff]" />}
                      <span className="flex-1 text-sm truncate">{adj.nombre}</span>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        onClick={() => handleRemoveAttachment(index)}
                        className="h-6 w-6 text-white/50 hover:text-white"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-2">
                <Select
                  value={newAttachment.tipo}
                  onValueChange={(value) => setNewAttachment({ ...newAttachment, tipo: value as 'pdf' | 'link' | 'imagen' | 'documento' | 'otro' })}
                >
                  <SelectTrigger className="w-28 bg-white/5 border-white/10 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#0a0a2a] border-white/10">
                    <SelectItem value="link" className="text-white hover:bg-white/10">Link</SelectItem>
                    <SelectItem value="pdf" className="text-white hover:bg-white/10">PDF</SelectItem>
                    <SelectItem value="documento" className="text-white hover:bg-white/10">Doc</SelectItem>
                    <SelectItem value="imagen" className="text-white hover:bg-white/10">Imagen</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  placeholder="Nombre"
                  value={newAttachment.nombre}
                  onChange={(e) => setNewAttachment({ ...newAttachment, nombre: e.target.value })}
                  className="bg-white/5 border-white/10 text-white"
                />
                <Input
                  placeholder="URL"
                  value={newAttachment.url}
                  onChange={(e) => setNewAttachment({ ...newAttachment, url: e.target.value })}
                  className="bg-white/5 border-white/10 text-white flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleAddAttachment}
                  className="border-white/10 text-white hover:bg-white/10"
                >
                  <Paperclip className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
                className="flex-1 border-white/10 text-white hover:bg-white/10"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={createAssignmentMutation.isPending}
                className="flex-1 bg-gradient-to-r from-[#002366] to-[#1e3cff] hover:opacity-90"
                data-testid="button-submit-assignment"
              >
                {createAssignmentMutation.isPending ? 'Creando...' : 'Crear Tarea'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
