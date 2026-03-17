import { useState, useMemo } from 'react';
import { useAuth } from '@/lib/authContext';
import { Calendar as CalendarIcon, Plus, X, Link2, FileText, Cloud, Presentation, FileSpreadsheet, ExternalLink } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
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
  materiaNombre?: string;
  subjectId?: string;
  groupId?: string;
  adjuntos?: { tipo: string; nombre: string; url: string }[];
}

interface Course {
  _id: string;
  nombre: string;
  cursos?: string[];
}

interface ProfessorGroupAssignment {
  groupId: string;
  groupName: string;
  subjects: Course[];
  totalStudents: number;
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
  const [assignmentMaterials, setAssignmentMaterials] = useState<{ type: 'file' | 'link' | 'gdoc'; url: string; fileName?: string }[]>([]);
  const [addFromGoogleOpen, setAddFromGoogleOpen] = useState(false);
  const [addFromEvoOpen, setAddFromEvoOpen] = useState(false);
  const [createNewOpen, setCreateNewOpen] = useState(false);
  const [createNewNombre, setCreateNewNombre] = useState('');
  const [createNewType, setCreateNewType] = useState<'doc' | 'slide' | 'sheet'>('doc');
  const [googleSearch, setGoogleSearch] = useState('');
  const [evoLinkUrl, setEvoLinkUrl] = useState('');
  const [evoLinkName, setEvoLinkName] = useState('');
  const [filterCurso, setFilterCurso] = useState<string>('');

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

  const cursosDelMes = useMemo(() => {
    const set = new Set<string>();
    assignmentsThisMonth.forEach((a) => {
      const c = (a.curso ?? '').trim();
      if (c) set.add(c);
    });
    return Array.from(set).sort();
  }, [assignmentsThisMonth]);

  const tareasFiltradas = useMemo(() => {
    if (!filterCurso) return assignmentsThisMonth;
    return assignmentsThisMonth.filter((a) => (a.curso ?? '').trim() === filterCurso);
  }, [assignmentsThisMonth, filterCurso]);

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

  const { data: googleStatus = { connected: false } } = useQuery<{ connected: boolean }>({
    queryKey: ['evo-drive', 'google-status'],
    queryFn: () => apiRequest('GET', '/api/evo-drive/google/status'),
    enabled: isDialogOpen,
  });
  interface GoogleDriveFile { id: string; name: string; mimeType?: string; webViewLink?: string; size?: string }
  const { data: googleFilesRes, isLoading: googleFilesLoading, isError: googleFilesError } = useQuery<{ files: GoogleDriveFile[] }>({
    queryKey: ['evo-drive', 'google-files-assign', googleSearch],
    queryFn: () => apiRequest('GET', `/api/evo-drive/google/files?q=${encodeURIComponent(googleSearch)}`),
    enabled: addFromGoogleOpen && !!googleStatus.connected,
    retry: false,
  });
  const googleFilesForAssign = googleFilesRes?.files ?? [];
  const googleDriveDisconnected = !googleStatus.connected || (!!googleStatus.connected && googleFilesError);

  const reconnectGoogleDrive = async () => {
    try {
      const data = await apiRequest<{ url: string }>('GET', '/api/evo-drive/google/auth-url');
      if (data?.url && typeof data.url === 'string') window.location.href = data.url;
      else toast({ title: 'Error', description: 'No se pudo obtener el enlace de conexión.', variant: 'destructive' });
    } catch {
      toast({ title: 'Error', description: 'No se pudo conectar con Google Drive.', variant: 'destructive' });
    }
  };

  const createNewDocForAssignMutation = useMutation({
    mutationFn: async (payload: { nombre: string; tipo: 'doc' | 'slide' | 'sheet'; cursoId: string; cursoNombre: string }) => {
      // Deducimos el group_subject (materia) a partir del curso + materias del profesor
      const subjects = getSubjectsForGroup(payload.cursoId);
      const groupSubjectId = subjects[0]?._id || courseIdForLogros || '';
      return apiRequest<{ googleWebViewLink?: string; nombre?: string }>('POST', '/api/evo-drive/google/create', {
        nombre: payload.nombre,
        tipo: payload.tipo,
        cursoId: payload.cursoId,
        cursoNombre: payload.cursoNombre,
        groupSubjectId: groupSubjectId || undefined,
      });
    },
    onSuccess: (data, variables) => {
      const url = data?.googleWebViewLink;
      if (url) {
        setAssignmentMaterials((prev) => [...prev, { type: 'gdoc', url, fileName: data?.nombre || variables.nombre }]);
        toast({ title: 'Documento creado', description: 'Se añadió el enlace a los materiales de la asignación.' });
      }
      setCreateNewOpen(false);
      setCreateNewNombre('');
    },
    onError: (e: Error) => {
      toast({ title: 'Error', description: e.message || 'No se pudo crear el documento.', variant: 'destructive' });
    },
  });

  const createAssignmentMutation = useMutation({
    mutationFn: async (payload: {
      titulo: string;
      descripcion: string;
      curso: string;
      courseId: string;
      fechaEntrega: string;
      adjuntos?: string[];
      categoryId?: string;
      logroCalificacionId?: string;
      materials?: { type: 'file' | 'link' | 'gdoc'; url: string; fileName?: string }[];
    }) => {
      const { materials = [], ...data } = payload;
      const res = await apiRequest<{ _id: string }>('POST', '/api/assignments', data);
      for (const m of materials) {
        await apiRequest('POST', '/api/assignment-materials', {
          assignmentId: res._id,
          type: m.type,
          url: m.url,
          fileName: m.fileName,
        });
      }
      return res;
    },
    onSuccess: () => {
      toast({ title: 'Tarea creada', description: 'La tarea se creó correctamente y aparecerá en el calendario.' });
      setIsDialogOpen(false);
      resetForm();

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
    setAssignmentMaterials([]);
    setAddFromGoogleOpen(false);
    setAddFromEvoOpen(false);
    setCreateNewOpen(false);
    setGoogleSearch('');
    setEvoLinkUrl('');
    setEvoLinkName('');
  };

  const handleDayClick = (assignment: Assignment) => {
    // Navegar a la página de tareas del grupo (curso)
    if (assignment.curso) {
      setLocation(`/profesor/cursos/${assignment.curso}/tareas`);
    }
  };

  const handleAddFromGoogleAssign = (gfile: GoogleDriveFile) => {
    const url = gfile.webViewLink || `https://drive.google.com/file/d/${gfile.id}/view`;
    setAssignmentMaterials((prev) => [...prev, { type: 'gdoc', url, fileName: gfile.name }]);
    setAddFromGoogleOpen(false);
    setGoogleSearch('');
    toast({ title: 'Enlace añadido', description: 'Se añadió el archivo a los materiales de la asignación.' });
  };

  const handleAddFromEvoAssign = () => {
    const url = evoLinkUrl.trim();
    const name = evoLinkName.trim();
    if (!url) return;
    const type = url.includes('docs.google.com') ? 'gdoc' : 'link';
    setAssignmentMaterials((prev) => [...prev, { type, url, fileName: name || url.split('/').pop() || undefined }]);
    setAddFromEvoOpen(false);
    setEvoLinkUrl('');
    setEvoLinkName('');
    toast({ title: 'Enlace añadido', description: 'Se añadió a los materiales de la asignación.' });
  };

  const handleCreateNewDocForAssign = () => {
    const group = formData.curso ? professorGroups.find(g => g.groupId === formData.curso) : null;
    const subjectsForGroup = formData.curso ? getSubjectsForGroup(formData.curso) : [];
    const groupSubjectId = subjectsForGroup[0]?._id;
    const groupName = group?.groupName || formData.curso;
    // cursoId debe ser el groupId/nombre del grupo (no el group_subject_id)
    if (!createNewNombre.trim() || !formData.curso || !groupSubjectId || !groupName) return;
    createNewDocForAssignMutation.mutate({
      nombre: createNewNombre.trim(),
      tipo: createNewType,
      cursoId: formData.curso,
      cursoNombre: groupName,
    });
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

    createAssignmentMutation.mutate({
      titulo: formData.titulo,
      descripcion: formData.descripcion,
      curso: formData.curso,
      courseId,
      fechaEntrega: fechaEntregaCompleta.toISOString(),
      categoryId: formData.logroCalificacionId || undefined,
      logroCalificacionId: formData.logroCalificacionId || undefined,
      materials: assignmentMaterials.length > 0 ? assignmentMaterials : undefined,
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
                  <Calendar assignments={assignments} onDayClick={handleDayClick} variant="teacher" />
                </CardContent>
              </Card>

              {assignmentsThisMonth.length > 0 && (
                <Card className="bg-white/5 border-white/10 backdrop-blur-md mt-8">
                  <CardHeader>
                    <CardTitle className="text-white">Tareas del Mes</CardTitle>
                    <CardDescription className="text-white/60">
                      {assignmentsThisMonth.length} {assignmentsThisMonth.length === 1 ? 'tarea' : 'tareas'} este mes. Filtra por curso.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex flex-wrap items-center gap-3">
                      <Label className="text-white/80 text-sm shrink-0">Filtrar por curso:</Label>
                      <Select value={filterCurso || 'todas'} onValueChange={(v) => setFilterCurso(v === 'todas' ? '' : v)}>
                        <SelectTrigger className="w-[180px] bg-white/10 border-white/20 text-white">
                          <SelectValue placeholder="Todos los cursos" />
                        </SelectTrigger>
                        <SelectContent className="bg-[#0a0a2a] border-white/10">
                          <SelectItem value="todas" className="text-white focus:bg-white/10">
                            Todas ({assignmentsThisMonth.length})
                          </SelectItem>
                          {cursosDelMes.map((curso) => {
                            const n = assignmentsThisMonth.filter((a) => (a.curso ?? '').trim() === curso).length;
                            return (
                              <SelectItem key={curso} value={curso} className="text-white focus:bg-white/10">
                                {curso} ({n})
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-3">
                      {tareasFiltradas
                        .sort((a, b) => new Date(a.fechaEntrega).getTime() - new Date(b.fechaEntrega).getTime())
                        .map((assignment) => (
                          <div
                            key={assignment._id}
                            className="p-4 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
                            onClick={() => setLocation(`/assignment/${assignment._id}`)}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <h4 className="font-semibold text-white mb-1">{assignment.titulo}</h4>
                                <p className="text-xs text-[#00c8ff] font-medium mb-1">{assignment.curso || 'Sin curso'}</p>
                                <p className="text-sm text-white/70 mb-2 line-clamp-2">{assignment.descripcion}</p>
                              </div>
                              <div className="text-right ml-4 shrink-0">
                                <p className="text-sm font-semibold text-[#00c8ff]">
                                  {new Date(assignment.fechaEntrega).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}
                                </p>
                                <p className="text-xs text-white/50">
                                  {new Date(assignment.fechaEntrega).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
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
                    {formData.curso && (() => {
                      const group = professorGroups.find(g => g.groupId === formData.curso);
                      const subjects = getSubjectsForGroup(formData.curso);
                      const courseName = group?.groupName || formData.curso;
                      const subjectNames = subjects.map(s => s.nombre).join(', ') || 'Sin materia';
                      return subjectNames ? `${courseName} — ${subjectNames}` : courseName;
                    })()}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="bg-[#0a0a2a] border-white/10">
                  {professorGroups.map((g) => {
                    const subjects = getSubjectsForGroup(g.groupId);
                    const subjectNames = subjects.map(s => s.nombre).join(', ') || 'Sin materia asignada';
                    const courseLabel = g.groupName || g.groupId;
                    return (
                      <SelectItem key={g.groupId} value={g.groupId} className="text-white hover:bg-white/10">
                        <div className="flex flex-col items-start py-1">
                          <span className="font-semibold">{courseLabel}</span>
                          <span className="text-xs text-white/60">{subjectNames}</span>
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              {formData.curso && getSubjectsForGroup(formData.curso).length > 0 && (() => {
                const group = professorGroups.find(g => g.groupId === formData.curso);
                return (
                  <p className="text-xs text-white/50">
                    Curso: {group?.groupName || formData.curso} • Materia: {getSubjectsForGroup(formData.curso).map(s => s.nombre).join(', ')}
                  </p>
                );
              })()}
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

            <div className="space-y-3">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-white/90">Materiales (Evo Drive)</h3>
              <p className="text-white/50 text-xs">Añade enlaces, archivos de Google Drive o crea documentos nuevos. Se vincularán a esta asignación.</p>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button type="button" variant="outline" size="sm" className="h-9 rounded-[12px] bg-[#4DBBFF]/[0.13] border-[1.5px] border-[#4DBBFF]/50 text-[#4DBBFF] text-[13px] font-medium hover:bg-[#4DBBFF]/20 hover:border-[#4DBBFF]/60 px-4 transition-all duration-150 ease-in-out">
                    <Plus className="w-4 h-4 mr-2" />
                    Añadir o crear
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" sideOffset={8} className="w-[230px] rounded-[14px] border-[#4DBBFF]/20 bg-[#0f1c35] shadow-xl shadow-black/40 p-0 overflow-hidden">
                  <div className="py-2.5">
                    <DropdownMenuItem
                      onSelect={() => googleStatus.connected && setTimeout(() => setAddFromGoogleOpen(true), 50)}
                      disabled={!googleStatus.connected}
                      className="flex items-center gap-3 py-2.5 px-4 text-[13px] text-white/90 hover:bg-[#4DBBFF]/10 focus:bg-[#4DBBFF]/10 mx-0 rounded-none"
                    >
                      <div className="w-8 h-8 rounded-[9px] bg-[#4DBBFF]/20 flex items-center justify-center shrink-0">
                        <Cloud className="w-4 h-4 text-[#4DBBFF]" />
                      </div>
                      Google Drive
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={() => setTimeout(() => { setEvoLinkUrl(''); setEvoLinkName(''); setAddFromEvoOpen(true); }, 50)}
                      className="flex items-center gap-3 py-2.5 px-4 text-[13px] text-white/90 hover:bg-[#4DBBFF]/10 focus:bg-[#4DBBFF]/10 mx-0 rounded-none"
                    >
                      <div className="w-8 h-8 rounded-[9px] bg-[#4DBBFF]/20 flex items-center justify-center shrink-0">
                        <Link2 className="w-4 h-4 text-[#4DBBFF]" />
                      </div>
                      Enlace
                    </DropdownMenuItem>
                  </div>
                  <div className="border-t border-[#4DBBFF]/10" />
                  <div className="py-2">
                    <p className="px-4 pt-1.5 pb-1 text-[11px] uppercase tracking-wider text-[#4DBBFF]/50">Crear</p>
                    <DropdownMenuItem onSelect={() => setTimeout(() => { setCreateNewType('doc'); setCreateNewNombre(''); setCreateNewOpen(true); }, 50)} className="flex items-center gap-3 py-2.5 px-4 text-[13px] text-white/90 hover:bg-[#4DBBFF]/10 focus:bg-[#4DBBFF]/10 mx-0 rounded-none">
                      <div className="w-8 h-8 rounded-[9px] bg-[#1a56d6] flex items-center justify-center shrink-0"><FileText className="w-4 h-4 text-white" /></div>
                      Documentos
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => setTimeout(() => { setCreateNewType('slide'); setCreateNewNombre(''); setCreateNewOpen(true); }, 50)} className="flex items-center gap-3 py-2.5 px-4 text-[13px] text-white/90 hover:bg-[#4DBBFF]/10 focus:bg-[#4DBBFF]/10 mx-0 rounded-none">
                      <div className="w-8 h-8 rounded-[9px] bg-[#d97706] flex items-center justify-center shrink-0"><Presentation className="w-4 h-4 text-white" /></div>
                      Presentaciones
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => setTimeout(() => { setCreateNewType('sheet'); setCreateNewNombre(''); setCreateNewOpen(true); }, 50)} className="flex items-center gap-3 py-2.5 px-4 text-[13px] text-white/90 hover:bg-[#4DBBFF]/10 focus:bg-[#4DBBFF]/10 mx-0 rounded-none">
                      <div className="w-8 h-8 rounded-[9px] bg-[#16a34a] flex items-center justify-center shrink-0"><FileSpreadsheet className="w-4 h-4 text-white" /></div>
                      Hojas de cálculo
                    </DropdownMenuItem>
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>
              {assignmentMaterials.length > 0 && (
                <ul className="space-y-3 mt-2">
                  {assignmentMaterials.map((m, i) => {
                    const isGoogle = m.type === 'gdoc';
                    const displayName = m.fileName || m.url;
                    const u = (m.url || '').toLowerCase();
                    const gdocKind = u.includes('spreadsheets') ? 'sheet' : u.includes('presentation') ? 'slide' : 'doc';
                    const iconBg = m.type === 'gdoc' ? (gdocKind === 'sheet' ? 'bg-emerald-500/15' : gdocKind === 'slide' ? 'bg-orange-500/15' : 'bg-blue-500/15') : 'bg-white/10';
                    const Icon = m.type === 'gdoc' ? (gdocKind === 'sheet' ? FileSpreadsheet : gdocKind === 'slide' ? Presentation : FileText) : Link2;
                    const iconColor = m.type === 'gdoc' ? (gdocKind === 'sheet' ? 'text-[#16a34a]' : gdocKind === 'slide' ? 'text-[#d97706]' : 'text-[#1a73e8]') : 'text-white/70';
                    return (
                      <li key={i} className="group flex items-center justify-between gap-4 py-3 px-4 rounded-[12px] border border-white/10 bg-[#0f172a]/60 hover:bg-white/[0.06] hover:border-[#4DBBFF]/20 transition-all duration-150 ease-in-out">
                        <div className="flex items-center gap-4 min-w-0 flex-1">
                          <div className={`w-[38px] h-[38px] rounded-[10px] flex items-center justify-center shrink-0 ${iconBg}`}>
                            <Icon className={`w-5 h-5 ${iconColor}`} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-white truncate">{displayName}</p>
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              <span className="text-[11px] text-white/60">Material de la asignación</span>
                              {isGoogle && (
                                <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-medium bg-emerald-500/15 text-emerald-400">Google</span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {m.url && (
                            <a href={m.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[11px] font-medium text-[#4DBBFF] hover:underline opacity-0 group-hover:opacity-100 transition-opacity duration-150 ease-in-out">
                              <ExternalLink className="w-3.5 h-3.5" />
                              {isGoogle ? 'Abrir en Drive' : 'Abrir enlace'}
                            </a>
                          )}
                          <Button type="button" variant="ghost" size="sm" className="text-white/70 hover:text-white h-8 w-8 p-0 shrink-0" onClick={() => setAssignmentMaterials((prev) => prev.filter((_, j) => j !== i))} aria-label="Quitar">
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
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

          {/* Modales Evo Drive (materiales de la asignación) */}
          <Dialog open={addFromGoogleOpen} onOpenChange={setAddFromGoogleOpen}>
            <DialogContent className="bg-white/5 border border-white/10 max-w-[380px] rounded-2xl p-6 shadow-xl overflow-hidden">
              <DialogHeader>
                <DialogTitle className="text-white flex items-center gap-3">
                  <div className="w-10 h-10 rounded-[11px] bg-[#4DBBFF]/20 flex items-center justify-center shrink-0"><Cloud className="w-5 h-5 text-[#4DBBFF]" /></div>
                  <div>
                    <span className="text-base font-semibold text-white block">Agregar desde Google Drive</span>
                    <span className="text-xs text-white/60 mt-0.5 block">Selecciona un archivo para vincular a la asignación</span>
                  </div>
                </DialogTitle>
              </DialogHeader>
              {googleDriveDisconnected ? (
                <div className="space-y-4 py-2">
                  <p className="text-white/60 text-sm">
                    {googleFilesError ? 'Google Drive se desconectó. Reconéctalo para seguir usando tus archivos.' : 'Conecta Google Drive para agregar archivos desde tu cuenta.'}
                  </p>
                  <Button type="button" onClick={reconnectGoogleDrive} className="w-full rounded-xl border border-[#22c55e]/40 bg-[#22c55e]/10 text-[#22c55e] hover:bg-[#22c55e]/20 font-medium">
                    <Cloud className="w-4 h-4 mr-2" />
                    Reconectar Google Drive
                  </Button>
                  <p className="text-white/40 text-xs">Serás redirigido a Google y volverás aquí sin cerrar sesión.</p>
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-white/60">Buscar en Drive</Label>
                    <Input value={googleSearch} onChange={(e) => setGoogleSearch(e.target.value)} placeholder="Nombre del archivo..." className="bg-white/5 border border-white/10 rounded-md py-2.5 px-3 text-sm text-white placeholder:text-white/50" />
                  </div>
                  <ScrollArea className="h-[280px] rounded-md border border-white/10">
                    {googleFilesLoading ? (
                      <div className="p-4 space-y-2"><Skeleton className="h-12 w-full bg-white/10 rounded-lg" /><Skeleton className="h-12 w-full bg-white/10 rounded-lg" /></div>
                    ) : googleFilesForAssign.length === 0 ? (
                      <p className="text-white/50 text-sm p-4">No se encontraron archivos o escribe para buscar.</p>
                    ) : (
                      <ul className="p-2 space-y-1">
                        {googleFilesForAssign.map((gf) => (
                          <li key={gf.id} className="flex items-center justify-between gap-2 p-2 rounded-lg hover:bg-white/10 text-white">
                            <span className="truncate text-sm">{gf.name}</span>
                            <Button size="sm" variant="ghost" className="shrink-0 text-[#4DBBFF]" onClick={() => handleAddFromGoogleAssign(gf)}>Agregar</Button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </ScrollArea>
                  <DialogFooter className="gap-2 mt-4">
                    <Button variant="outline" onClick={() => setAddFromGoogleOpen(false)} className="flex-1 border border-white/10 bg-transparent text-[13px] font-medium text-white/60 hover:bg-white/10">Cerrar</Button>
                  </DialogFooter>
                </>
              )}
            </DialogContent>
          </Dialog>

          <Dialog open={addFromEvoOpen} onOpenChange={setAddFromEvoOpen}>
            <DialogContent className="bg-white/5 border border-white/10 max-w-[380px] rounded-2xl p-6 shadow-xl overflow-hidden">
              <DialogHeader>
                <DialogTitle className="text-white flex items-center gap-3">
                  <div className="w-10 h-10 rounded-[11px] bg-[#4DBBFF]/20 flex items-center justify-center shrink-0"><Link2 className="w-5 h-5 text-[#4DBBFF]" /></div>
                  <div>
                    <span className="text-base font-semibold text-white block">Añadir enlace</span>
                    <span className="text-xs text-white/60 mt-0.5 block">URL o nombre del recurso para la asignación</span>
                  </div>
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-white/60">Nombre (opcional)</Label>
                  <Input value={evoLinkName} onChange={(e) => setEvoLinkName(e.target.value)} placeholder="Ej: Guía de estudio" className="bg-white/5 border border-white/10 rounded-md py-2.5 px-3 text-sm text-white placeholder:text-white/50" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-white/60">URL</Label>
                  <Input value={evoLinkUrl} onChange={(e) => setEvoLinkUrl(e.target.value)} placeholder="https://..." className="bg-white/5 border border-white/10 rounded-md py-2.5 px-3 text-sm text-white placeholder:text-white/50" />
                </div>
              </div>
              <DialogFooter className="gap-2 mt-6 grid grid-cols-[1fr_2fr]">
                <Button variant="outline" onClick={() => setAddFromEvoOpen(false)} className="border border-white/10 bg-transparent text-[13px] font-medium text-white/60 hover:bg-white/10">Cancelar</Button>
                <Button onClick={handleAddFromEvoAssign} disabled={!evoLinkUrl.trim()} className="bg-[#1a73e8] hover:bg-[#1558b0] text-white text-[13px] font-medium">Añadir</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={createNewOpen} onOpenChange={setCreateNewOpen}>
            <DialogContent className="bg-white/5 border border-white/10 max-w-[380px] rounded-2xl p-6 shadow-xl overflow-hidden">
              <DialogHeader>
                <DialogTitle className="text-white flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-[11px] flex items-center justify-center shrink-0 ${createNewType === 'doc' ? 'bg-[#1a56d6]' : createNewType === 'slide' ? 'bg-[#d97706]' : 'bg-[#16a34a]'}`}>
                    {createNewType === 'doc' && <FileText className="w-5 h-5 text-white" />}
                    {createNewType === 'slide' && <Presentation className="w-5 h-5 text-white" />}
                    {createNewType === 'sheet' && <FileSpreadsheet className="w-5 h-5 text-white" />}
                  </div>
                  <div>
                    <span className="text-base font-semibold text-white block">
                      {createNewType === 'doc' && 'Nuevo documento'}
                      {createNewType === 'slide' && 'Nueva presentación'}
                      {createNewType === 'sheet' && 'Nueva hoja de cálculo'}
                    </span>
                    <span className="text-xs text-white/60 mt-0.5 block">Se creará en Google Drive y se añadirá a los materiales</span>
                  </div>
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-white/60">Nombre del archivo</Label>
                  <Input value={createNewNombre} onChange={(e) => setCreateNewNombre(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleCreateNewDocForAssign()} placeholder="Ej: Guía del curso" className="bg-white/5 border border-white/10 rounded-md py-2.5 px-3 text-sm text-white placeholder:text-white/50" autoFocus />
                </div>
              </div>
              <DialogFooter className="gap-2 mt-6 grid grid-cols-[1fr_2fr]">
                <Button variant="outline" onClick={() => { setCreateNewOpen(false); setCreateNewNombre(''); }} className="border border-white/10 bg-transparent text-[13px] font-medium text-white/60 hover:bg-white/10">Cancelar</Button>
                <Button onClick={handleCreateNewDocForAssign} disabled={!createNewNombre.trim() || createNewDocForAssignMutation.isPending || !formData.curso} className="bg-[#1a73e8] hover:bg-[#1558b0] text-white text-[13px] font-medium">
                  {createNewDocForAssignMutation.isPending ? 'Creando…' : 'Crear'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </DialogContent>
      </Dialog>
    </>
  );
}
