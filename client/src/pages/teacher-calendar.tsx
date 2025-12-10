import { useState } from 'react';
import { useAuth } from '@/lib/authContext';
import { AppSidebar } from '@/components/app-sidebar';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { Calendar as CalendarIcon, User, Plus, X, Paperclip, Link2, FileText } from 'lucide-react';
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

interface Assignment {
  _id: string;
  titulo: string;
  descripcion: string;
  curso: string;
  fechaEntrega: string;
  profesorNombre: string;
  adjuntos?: { tipo: string; nombre: string; url: string }[];
}

interface Course {
  _id: string;
  nombre: string;
  cursos: string[];
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
    courseId: '',
    fechaEntrega: '',
    horaEntrega: '23:59',
  });
  const [adjuntos, setAdjuntos] = useState<Attachment[]>([]);
  const [newAttachment, setNewAttachment] = useState<Attachment>({ tipo: 'link', nombre: '', url: '' });

  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  const { data: assignments = [], refetch: refetchAssignments } = useQuery<Assignment[]>({
    queryKey: ['/api/assignments/profesor', user?.id, currentMonth, currentYear],
    enabled: !!user?.id,
  });

  const { data: courses = [] } = useQuery<Course[]>({
    queryKey: ['/api/courses/mine'],
    enabled: !!user?.id,
  });

  const createAssignmentMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest('POST', '/api/assignments', data);
    },
    onSuccess: () => {
      toast({ title: 'Tarea creada exitosamente' });
      setIsDialogOpen(false);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ['/api/assignments/profesor'] });
      refetchAssignments();
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message || 'No se pudo crear la tarea', variant: 'destructive' });
    },
  });

  const resetForm = () => {
    setFormData({
      titulo: '',
      descripcion: '',
      curso: '',
      courseId: '',
      fechaEntrega: '',
      horaEntrega: '23:59',
    });
    setAdjuntos([]);
  };

  const handleDayClick = (assignment: Assignment) => {
    setLocation(`/assignment/${assignment._id}`);
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
    
    if (!formData.titulo || !formData.descripcion || !formData.curso || !formData.courseId || !formData.fechaEntrega) {
      toast({ title: 'Error', description: 'Por favor completa todos los campos obligatorios', variant: 'destructive' });
      return;
    }

    const fechaEntregaCompleta = new Date(`${formData.fechaEntrega}T${formData.horaEntrega}`);

    createAssignmentMutation.mutate({
      titulo: formData.titulo,
      descripcion: formData.descripcion,
      curso: formData.curso,
      courseId: formData.courseId,
      fechaEntrega: fechaEntregaCompleta.toISOString(),
      adjuntos,
    });
  };

  const selectedCourse = courses.find(c => c._id === formData.courseId);
  const availableGroups = selectedCourse?.cursos || [];

  return (
    <SidebarProvider>
      <div className="flex h-screen w-full bg-gradient-to-br from-[#0a0a0c] via-[#1a001c] to-[#3d0045]">
        <AppSidebar />
        <SidebarInset className="flex flex-col flex-1">
          <header className="flex items-center justify-between p-4 border-b border-white/10 backdrop-blur-xl bg-black/20">
            <div className="flex items-center gap-3">
              <SidebarTrigger data-testid="button-sidebar-toggle" className="text-white" />
              <h1 className="text-xl font-bold text-white font-['Poppins']">
                Calendario de Tareas
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

          <main className="flex-1 overflow-auto p-8 relative">
            <div className="max-w-5xl mx-auto">
              <div className="mb-8">
                <h2 className="text-3xl font-bold text-white mb-2 font-['Poppins']">
                  Mis Tareas Asignadas
                </h2>
                <p className="text-white/60">
                  Gestiona las tareas y trabajos para tus estudiantes
                </p>
              </div>

              <Card className="bg-white/5 border-white/10 backdrop-blur-md">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-white">
                    <CalendarIcon className="w-5 h-5 text-[#9f25b8]" />
                    Calendario del Mes
                  </CardTitle>
                  <CardDescription className="text-white/60">
                    {assignments.length} {assignments.length === 1 ? 'tarea asignada' : 'tareas asignadas'} este mes
                  </CardDescription>
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
                      Todas las tareas que has asignado
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {assignments
                        .sort((a, b) => new Date(a.fechaEntrega).getTime() - new Date(b.fechaEntrega).getTime())
                        .map((assignment) => (
                          <div
                            key={assignment._id}
                            className="p-4 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
                            onClick={() => setLocation(`/assignment/${assignment._id}`)}
                            data-testid={`assignment-item-${assignment._id}`}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <h4 className="font-semibold text-white mb-1">{assignment.titulo}</h4>
                                <p className="text-sm text-white/70 mb-2 line-clamp-2">{assignment.descripcion}</p>
                                <p className="text-xs text-white/50">
                                  Curso: {assignment.curso}
                                </p>
                              </div>
                              <div className="text-right ml-4">
                                <p className="text-sm font-semibold text-[#9f25b8]">
                                  {new Date(assignment.fechaEntrega).toLocaleDateString('es-CO', { 
                                    day: 'numeric',
                                    month: 'short'
                                  })}
                                </p>
                                <p className="text-xs text-white/50">
                                  {new Date(assignment.fechaEntrega).toLocaleTimeString('es-CO', { 
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            <Button
              onClick={() => setIsDialogOpen(true)}
              className="fixed bottom-8 right-8 w-14 h-14 rounded-full bg-gradient-to-r from-[#9f25b8] to-[#6a0dad] hover:opacity-90 shadow-lg shadow-purple-500/30"
              size="icon"
              data-testid="button-create-assignment"
            >
              <Plus className="w-6 h-6" />
            </Button>
          </main>
        </SidebarInset>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="bg-[#1a001c] border-white/10 text-white max-w-2xl max-h-[90vh] overflow-y-auto">
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

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Materia *</Label>
                <Select
                  value={formData.courseId}
                  onValueChange={(value) => setFormData({ ...formData, courseId: value, curso: '' })}
                >
                  <SelectTrigger className="bg-white/5 border-white/10 text-white" data-testid="select-materia">
                    <SelectValue placeholder="Selecciona materia" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1a001c] border-white/10">
                    {courses.map((course) => (
                      <SelectItem key={course._id} value={course._id} className="text-white hover:bg-white/10">
                        {course.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Grupo/Curso *</Label>
                <Select
                  value={formData.curso}
                  onValueChange={(value) => setFormData({ ...formData, curso: value })}
                  disabled={!formData.courseId}
                >
                  <SelectTrigger className="bg-white/5 border-white/10 text-white" data-testid="select-curso">
                    <SelectValue placeholder="Selecciona grupo" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1a001c] border-white/10">
                    {availableGroups.map((grupo) => (
                      <SelectItem key={grupo} value={grupo} className="text-white hover:bg-white/10">
                        {grupo}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

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
                      {adj.tipo === 'link' ? <Link2 className="w-4 h-4 text-[#9f25b8]" /> : <FileText className="w-4 h-4 text-[#9f25b8]" />}
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
                  <SelectContent className="bg-[#1a001c] border-white/10">
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
                className="flex-1 bg-gradient-to-r from-[#9f25b8] to-[#6a0dad] hover:opacity-90"
                data-testid="button-submit-assignment"
              >
                {createAssignmentMutation.isPending ? 'Creando...' : 'Crear Tarea'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </SidebarProvider>
  );
}
