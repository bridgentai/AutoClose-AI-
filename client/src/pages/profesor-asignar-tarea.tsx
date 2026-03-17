import React, { useState, useRef, Component } from 'react';
import { useAuth } from '@/lib/authContext';
import { Plus, X, Paperclip, Link2, FileText, Maximize2, Bell, Bold, Italic, Underline, List, Strikethrough, Upload, Youtube, Users, HelpCircle, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useLocation } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Breadcrumb } from '@/components/Breadcrumb';

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

class AsignarTareaErrorBoundary extends Component<{ children: React.ReactNode }, { hasError: boolean }> {
  state = { hasError: false };
  static getDerivedStateFromError = () => ({ hasError: true });
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6">
          <Breadcrumb
            items={[
              { label: 'Dashboard', href: '/dashboard' },
              { label: 'Cursos', href: '/profesor/academia/cursos' },
              { label: 'Tareas', href: '/profesor/academia/tareas' },
              { label: 'Crear asignación' },
            ]}
          />
          <div className="mt-6 p-6 rounded-xl bg-amber-500/20 border border-amber-500/50 text-amber-200 flex flex-col gap-4">
            <p className="font-medium flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              No se pudo cargar la página de crear asignación
            </p>
            <p className="text-sm text-white/80">Vuelve a intentar o contacta al administrador si el problema continúa.</p>
            <Button onClick={() => this.setState({ hasError: false })} variant="outline" className="w-fit border-amber-500/50 text-amber-200 hover:bg-amber-500/20">
              Reintentar
            </Button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function ProfesorAsignarTareaPageInner() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [assignmentType, setAssignmentType] = useState<'recordatorio' | 'documento' | null>(null);
  const [documentContent, setDocumentContent] = useState('');
  const [formData, setFormData] = useState({
    titulo: '',
    descripcion: '',
    curso: '',
    materiaId: '', // courseId - materia cuando hay varias
    fechaEntrega: '',
    horaEntrega: '23:59',
  });
  const [logroCalificacionId, setLogroCalificacionId] = useState('');
  const [adjuntos, setAdjuntos] = useState<Attachment[]>([]);
  const [newAttachment, setNewAttachment] = useState<Attachment>({ tipo: 'link', nombre: '', url: '' });
  const [instrucciones, setInstrucciones] = useState('');
  const [puntos, setPuntos] = useState('100');
  const [tema, setTema] = useState('');
  const [asignarA, setAsignarA] = useState('todos');
  const instruccionesRef = useRef<HTMLDivElement>(null);

  const { data: professorGroupsRaw, isLoading: isLoadingGroups, isError: errorGroups } = useQuery({
    queryKey: ['professorGroups'],
    queryFn: () => apiRequest('GET', '/api/professor/my-groups'),
    enabled: !!(user?.id ?? user?._id),
    staleTime: 0,
  });
  // Aceptar respuesta en formato array o envuelta en { groups } / { data }
  const professorGroups: ProfessorGroupAssignment[] = (() => {
    if (Array.isArray(professorGroupsRaw)) return professorGroupsRaw;
    if (professorGroupsRaw && typeof professorGroupsRaw === 'object') {
      const r = professorGroupsRaw as Record<string, unknown>;
      if (Array.isArray(r.groups)) return r.groups as ProfessorGroupAssignment[];
      if (Array.isArray(r.data)) return r.data as ProfessorGroupAssignment[];
    }
    return [];
  })();

  const availableGroups = professorGroups.map(g => g?.groupId).filter(Boolean) as string[];
  const getSubjectsForGroup = (groupId: string) => {
    const group = professorGroups.find(g => g?.groupId === groupId);
    return Array.isArray(group?.subjects) ? group.subjects : [];
  };

  const courseIdForLogros = formData.materiaId || (formData.curso ? getSubjectsForGroup(formData.curso)[0]?._id : '');
  const { data: logrosData, isLoading: isLoadingLogros, isFetched: logrosFetched } = useQuery<{ logros: { _id: string; nombre: string; porcentaje: number }[] }>({
    queryKey: ['/api/logros-calificacion', courseIdForLogros],
    queryFn: () =>
      apiRequest('GET', `/api/logros-calificacion?courseId=${encodeURIComponent(courseIdForLogros)}`),
    enabled: !!courseIdForLogros,
  });
  const logros = logrosData?.logros ?? [];
  const logroBlocksCreation = !!courseIdForLogros && (isLoadingLogros || (logrosFetched && (logros.length === 0 || !logroCalificacionId)));


  const createAssignmentMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest('POST', '/api/assignments', data);
    },
    onSuccess: () => {
      toast({ title: 'Asignación creada', description: 'La asignación ha sido creada correctamente.' });
      resetForm();
      
      // Invalidar queries del profesor
      queryClient.invalidateQueries({ queryKey: ['teacherAssignments'] });
      
      // CRÍTICO: Invalidar queries de estudiantes para que vean la tarea automáticamente
      queryClient.invalidateQueries({ queryKey: ['studentAssignments'] });
      queryClient.invalidateQueries({ queryKey: ['assignments'] });
      queryClient.invalidateQueries({ 
        queryKey: ['/api/assignments/student'],
        exact: false 
      });
      
      // Invalidar queries de calendarios de estudiantes
      queryClient.invalidateQueries({ 
        queryKey: ['studentAssignments'],
        exact: false 
      });
      
      // Opcional: Redirigir después de crear
      setTimeout(() => {
        setLocation('/profesor/academia/tareas');
      }, 1200);
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message || 'No se pudo crear la asignación', variant: 'destructive' });
    },
  });

  const resetForm = () => {
    setFormData({
      titulo: '',
      descripcion: '',
      curso: '',
      materiaId: '',
      fechaEntrega: '',
      horaEntrega: '23:59',
    });
    setLogroCalificacionId('');
    setAdjuntos([]);
    setAssignmentType(null);
    setDocumentContent('');
    setInstrucciones('');
    setPuntos('100');
    setTema('');
    setAsignarA('todos');
    if (instruccionesRef.current) {
      instruccionesRef.current.innerHTML = '';
    }
  };

  const executeCommand = (command: string, value?: string) => {
    if (!instruccionesRef.current) return;
    
    // Guardar la posición del cursor
    const selection = window.getSelection();
    const range = selection?.getRangeAt(0);
    const savedRange = range?.cloneRange();
    
    // Ejecutar comando
    instruccionesRef.current.focus();
    document.execCommand(command, false, value);
    
    // Restaurar selección si existe
    if (savedRange && selection) {
      selection.removeAllRanges();
      selection.addRange(savedRange);
    }
    
    // Actualizar contenido
    if (instruccionesRef.current) {
      setInstrucciones(instruccionesRef.current.innerHTML);
      setFormData({ ...formData, descripcion: instruccionesRef.current.innerText });
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
    
    if (!formData.titulo || !formData.curso) {
      toast({ title: 'Error', description: 'Por favor completa todos los campos obligatorios', variant: 'destructive' });
      return;
    }

    const subjectsForGroup = getSubjectsForGroup(formData.curso);
    if (subjectsForGroup.length === 0) {
      toast({ title: 'Error', description: 'No tienes materias asignadas a este grupo.', variant: 'destructive' });
      return;
    }

    const courseId = formData.materiaId || subjectsForGroup[0]._id;
    if (logros.length === 0) {
      toast({ title: 'Error', description: 'Configura los logros de calificación para esta materia en Calificación antes de crear asignaciones.', variant: 'destructive' });
      return;
    }
    if (!logroCalificacionId) {
      toast({ title: 'Error', description: 'Selecciona el tipo de logro al que pertenece esta asignación (ej: Tareas, Exámenes).', variant: 'destructive' });
      return;
    }
    const fechaEntregaCompleta = formData.fechaEntrega 
      ? new Date(`${formData.fechaEntrega}T${formData.horaEntrega}`)
      : undefined;

    createAssignmentMutation.mutate({
      titulo: formData.titulo,
      descripcion: instrucciones || formData.descripcion,
      contenidoDocumento: assignmentType === 'documento' ? documentContent : undefined,
      curso: formData.curso,
      courseId,
      fechaEntrega: fechaEntregaCompleta?.toISOString() || undefined,
      adjuntos,
      puntos: puntos !== '0' ? parseInt(puntos) : undefined,
      categoryId: logroCalificacionId || undefined,
      logroCalificacionId: logroCalificacionId || undefined,
    });
  };

  return (
    <div className="flex-1 overflow-auto w-full">
      <div className="mb-6">
        <Breadcrumb
          items={[
            { label: 'Dashboard', href: '/dashboard' },
            { label: 'Cursos', href: '/profesor/academia/cursos' },
            { label: 'Tareas', href: '/profesor/academia/tareas' },
            { label: 'Crear asignación' },
          ]}
        />
        <h2 className="text-3xl font-bold text-white mb-2 font-['Poppins'] mt-4">
          Crear Asignación
        </h2>
      </div>

      {errorGroups && (
        <div className="mb-6 p-4 rounded-xl bg-amber-500/20 border border-amber-500/50 text-amber-200">
          <p className="font-medium">No se pudieron cargar tus grupos.</p>
          <p className="text-sm mt-1 text-white/80">Reintenta más tarde o contacta al administrador.</p>
        </div>
      )}

      {!isLoadingGroups && !errorGroups && availableGroups.length === 0 && (
        <div className="mb-6 p-6 rounded-xl bg-white/5 border border-white/10 backdrop-blur-md">
          <p className="text-white font-medium flex items-center gap-2">
            <Users className="w-5 h-5 text-[#00c8ff]" />
            Sin grupos asignados
          </p>
          <p className="text-white/70 text-sm mt-2">
            El administrador del colegio debe asignarte a uno o más cursos desde su panel (Usuarios → Cursos → Asignar profesor a cursos) para que puedas crear asignaciones.
          </p>
        </div>
      )}

      <div className="force-white-bg rounded-lg shadow-xl overflow-hidden relative z-10" style={{ backgroundColor: '#ffffff', position: 'relative', zIndex: 10 }}>
            <form onSubmit={handleSubmit} className="flex gap-0" style={{ backgroundColor: '#ffffff' }}>
              {/* Columna Izquierda - Contenido Principal */}
              <div className="flex-1 p-8 border-r border-gray-200" style={{ backgroundColor: '#ffffff' }}>
                {/* Título */}
                <div className="mb-6">
                  <Label htmlFor="titulo" className="text-sm font-medium text-gray-700 mb-1 block">
                    Título<span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="titulo"
                    value={formData.titulo}
                    onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
                    placeholder="Ej: Taller de Álgebra"
                    className="border-gray-300 focus:border-[#1e3cff] focus:ring-[#1e3cff] text-gray-900"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">*Obligatorio</p>
                </div>

                {/* Instrucciones con Editor de Texto */}
                <div className="mb-6">
                  <Label className="text-sm font-medium text-gray-700 mb-1 block">
                    Instrucciones (opcional)
                  </Label>
                  {/* Toolbar de Formato */}
                  <div className="border border-gray-300 rounded-t-lg bg-gray-50 p-2 flex items-center gap-1 flex-wrap">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => executeCommand('bold')}
                      className="h-8 w-8 p-0 hover:bg-gray-200"
                      title="Negrita"
                    >
                      <Bold className="w-4 h-4" />
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => executeCommand('italic')}
                      className="h-8 w-8 p-0 hover:bg-gray-200"
                      title="Cursiva"
                    >
                      <Italic className="w-4 h-4" />
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => executeCommand('underline')}
                      className="h-8 w-8 p-0 hover:bg-gray-200"
                      title="Subrayado"
                    >
                      <Underline className="w-4 h-4" />
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => executeCommand('insertUnorderedList')}
                      className="h-8 w-8 p-0 hover:bg-gray-200"
                      title="Lista con viñetas"
                    >
                      <List className="w-4 h-4" />
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => executeCommand('removeFormat')}
                      className="h-8 w-8 p-0 hover:bg-gray-200"
                      title="Limpiar formato"
                    >
                      <Strikethrough className="w-4 h-4" />
                    </Button>
                  </div>
                  {/* Editor de Texto */}
                  <div
                    ref={instruccionesRef}
                    contentEditable
                    onInput={(e) => {
                      if (instruccionesRef.current) {
                        setInstrucciones(instruccionesRef.current.innerHTML);
                        setFormData({ ...formData, descripcion: instruccionesRef.current.innerText });
                      }
                    }}
                    className="border-x border-b border-gray-300 rounded-b-lg p-4 min-h-[200px] focus:outline-none focus:ring-2 focus:ring-[#1e3cff] focus:border-[#1e3cff] text-gray-900"
                    style={{ whiteSpace: 'pre-wrap' }}
                    data-placeholder="Escribe las instrucciones aquí..."
                    suppressContentEditableWarning
                  />
                  <style>{`
                    [contenteditable][data-placeholder]:empty:before {
                      content: attr(data-placeholder);
                      color: #9ca3af;
                      pointer-events: none;
                    }
                  `}</style>
                </div>

                {/* Adjuntar */}
                <div className="mb-6">
                  <Label className="text-sm font-medium text-gray-700 mb-3 block">Adjuntar</Label>
                  <div className="flex items-center gap-4 flex-wrap">
                    {/* Drive */}
                    <button
                      type="button"
                      className="flex flex-col items-center gap-2 p-3 rounded-full hover:bg-gray-100 transition-colors group"
                      title="Google Drive"
                    >
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                        <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M7.71 6.5L1.15 12l6.56 5.5-1.5 1.81L0 12l6.21-6.31L7.71 6.5zm8.58 0l6.56 5.5-6.56 5.5 1.5 1.81L24 12l-6.21-6.31L16.29 6.5z"/>
                        </svg>
                      </div>
                      <span className="text-xs text-gray-600">Drive</span>
                    </button>

                    {/* YouTube */}
                    <button
                      type="button"
                      className="flex flex-col items-center gap-2 p-3 rounded-full hover:bg-gray-100 transition-colors group"
                      title="YouTube"
                    >
                      <div className="w-12 h-12 rounded-full bg-red-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                        <Youtube className="w-6 h-6 text-white" />
                      </div>
                      <span className="text-xs text-gray-600">YouTube</span>
                    </button>

                    {/* Crear */}
                    <button
                      type="button"
                      className="flex flex-col items-center gap-2 p-3 rounded-full hover:bg-gray-100 transition-colors group"
                      title="Crear"
                    >
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-red-500 via-yellow-500 to-green-500 flex items-center justify-center group-hover:scale-110 transition-transform">
                        <Plus className="w-6 h-6 text-white" />
                      </div>
                      <span className="text-xs text-gray-600">Crear</span>
                    </button>

                    {/* Subir */}
                    <button
                      type="button"
                      className="flex flex-col items-center gap-2 p-3 rounded-full hover:bg-gray-100 transition-colors group"
                      title="Subir"
                    >
                      <div className="w-12 h-12 rounded-full bg-blue-500 flex items-center justify-center group-hover:scale-110 transition-transform">
                        <Upload className="w-6 h-6 text-white" />
                      </div>
                      <span className="text-xs text-gray-600">Subir</span>
                    </button>

                    {/* Enlace */}
                    <button
                      type="button"
                      className="flex flex-col items-center gap-2 p-3 rounded-full hover:bg-gray-100 transition-colors group"
                      title="Enlace"
                    >
                      <div className="w-12 h-12 rounded-full bg-gray-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                        <Link2 className="w-6 h-6 text-white" />
                      </div>
                      <span className="text-xs text-gray-600">Enlace</span>
                    </button>

                    {/* NotebookLM */}
                    <button
                      type="button"
                      className="flex flex-col items-center gap-2 p-3 rounded-full hover:bg-gray-100 transition-colors group"
                      title="NotebookLM"
                    >
                      <div className="w-12 h-12 rounded-full bg-black flex items-center justify-center group-hover:scale-110 transition-transform">
                        <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/>
                        </svg>
                      </div>
                      <span className="text-xs text-gray-600">NotebookLM</span>
                    </button>

                    {/* Gem */}
                    <button
                      type="button"
                      className="flex flex-col items-center gap-2 p-3 rounded-full hover:bg-gray-100 transition-colors group"
                      title="Gem"
                    >
                      <div className="w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                        <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                        </svg>
                      </div>
                      <span className="text-xs text-gray-600">Gem</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Columna Derecha - Configuración */}
              <div className="w-80 p-6 border-l border-gray-200" style={{ backgroundColor: '#f9fafb' }}>
                {/* Para */}
                <div className="mb-6">
                  <Label className="text-sm font-medium text-gray-700 mb-2 block">Para</Label>
                  {availableGroups.length > 0 ? (
                    <Select
                      value={formData.curso && availableGroups.includes(formData.curso) ? formData.curso : undefined}
                      onValueChange={(value) => {
                        const subjects = getSubjectsForGroup(value);
                        const materiaId = subjects.length === 1 ? subjects[0]._id : '';
                        setFormData(prev => ({ ...prev, curso: value, materiaId }));
                        setLogroCalificacionId('');
                      }}
                      disabled={isLoadingGroups}
                    >
                      <SelectTrigger className="bg-white border-gray-300 text-gray-900">
                        <SelectValue placeholder={isLoadingGroups ? "Cargando grupos..." : "Selecciona curso"} />
                      </SelectTrigger>
                      <SelectContent className="bg-white">
                        {availableGroups.map((grupo) => {
                          const subjects = getSubjectsForGroup(grupo);
                          const subjectNames = subjects.map(s => s.nombre).join(', ') || 'Sin materia asignada';
                          return (
                            <SelectItem key={grupo} value={grupo} className="text-gray-900">
                              <div className="flex flex-col items-start py-1">
                                <span className="font-semibold">{subjectNames}</span>
                                <span className="text-xs text-gray-600">Grupo: {grupo}</span>
                              </div>
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="h-9 rounded-md border border-gray-300 bg-gray-100 px-3 py-2 text-sm text-gray-500 flex items-center">
                      {isLoadingGroups ? "Cargando grupos..." : "Sin grupos asignados"}
                    </div>
                  )}
                </div>

                {getSubjectsForGroup(formData.curso).length > 1 && (
                  <div className="mb-6">
                    <Label className="text-sm font-medium text-gray-700 mb-2 block">Materia</Label>
                    <Select
                      value={getSubjectsForGroup(formData.curso).some(s => s._id === formData.materiaId) ? formData.materiaId : undefined}
                      onValueChange={(value) => setFormData({ ...formData, materiaId: value })}
                    >
                      <SelectTrigger className="bg-white border-gray-300 text-gray-900">
                        <SelectValue placeholder="Selecciona la materia" />
                      </SelectTrigger>
                      <SelectContent className="bg-white">
                        {getSubjectsForGroup(formData.curso).map((s) => (
                          <SelectItem key={s._id} value={s._id} className="text-gray-900">
                            {s.nombre}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {courseIdForLogros && (
                  <div className="mb-6">
                    <Label className="text-sm font-medium text-gray-700 mb-2 block">
                      Tipo de logro<span className="text-red-500">*</span>
                    </Label>
                    {isLoadingLogros ? (
                      <p className="text-sm text-gray-500 py-2">Cargando logros...</p>
                    ) : logros.length > 0 ? (
                      <>
                        <Select
                          value={logroCalificacionId}
                          onValueChange={setLogroCalificacionId}
                        >
                          <SelectTrigger className="bg-white border-gray-300 text-gray-900">
                            <SelectValue placeholder="Selecciona el logro al que pertenece esta asignación" />
                          </SelectTrigger>
                          <SelectContent className="bg-white">
                            {logros.map((l) => (
                              <SelectItem key={l._id} value={l._id} className="text-gray-900">
                                {l.nombre} ({l.porcentaje}%)
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-gray-500 mt-1">
                          La calificación se calculará según el porcentaje de este logro.
                        </p>
                      </>
                    ) : (
                      <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                        <p className="font-medium">No hay logros configurados</p>
                        <p className="mt-1">Configura los logros de calificación para esta materia en Calificación → Logros antes de crear asignaciones.</p>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="mt-2 border-amber-300 text-amber-800 hover:bg-amber-100"
                          onClick={() => setLocation('/profesor/academia/calificacion')}
                        >
                          Ir a configurar logros
                        </Button>
                      </div>
                    )}
                  </div>
                )}

                {/* Asignar a */}
                <div className="mb-6">
                  <Label className="text-sm font-medium text-gray-700 mb-2 block">Asignar a</Label>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full justify-start bg-white border-gray-300 text-gray-900 hover:bg-gray-50"
                    onClick={() => setAsignarA(asignarA === 'todos' ? 'algunos' : 'todos')}
                  >
                    <Users className="w-4 h-4 mr-2" />
                    {asignarA === 'todos' ? 'Todos los alumnos' : 'Algunos alumnos'}
                  </Button>
                </div>

                {/* Puntos */}
                <div className="mb-6">
                  <Label className="text-sm font-medium text-gray-700 mb-2 block">Puntos</Label>
                  <Select value={puntos} onValueChange={setPuntos}>
                    <SelectTrigger className="bg-white border-gray-300 text-gray-900">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-white">
                      <SelectItem value="100" className="text-gray-900">100</SelectItem>
                      <SelectItem value="50" className="text-gray-900">50</SelectItem>
                      <SelectItem value="25" className="text-gray-900">25</SelectItem>
                      <SelectItem value="10" className="text-gray-900">10</SelectItem>
                      <SelectItem value="0" className="text-gray-900">Sin calificación</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Fecha de entrega */}
                <div className="mb-6">
                  <Label className="text-sm font-medium text-gray-700 mb-2 block">Fecha de entrega</Label>
                  {!formData.fechaEntrega ? (
                    <Select 
                      value="sin-fecha"
                      onValueChange={(value) => {
                        if (value === 'fecha') {
                          const today = new Date().toISOString().split('T')[0];
                          setFormData({ ...formData, fechaEntrega: today });
                        }
                      }}
                    >
                      <SelectTrigger className="bg-white border-gray-300 text-gray-900">
                        <SelectValue>Sin fecha de entrega</SelectValue>
                      </SelectTrigger>
                      <SelectContent className="bg-white">
                        <SelectItem value="sin-fecha" className="text-gray-900">Sin fecha de entrega</SelectItem>
                        <SelectItem value="fecha" className="text-gray-900">Seleccionar fecha</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="space-y-2">
                      <Input
                        type="date"
                        value={formData.fechaEntrega}
                        onChange={(e) => setFormData({ ...formData, fechaEntrega: e.target.value })}
                        className="bg-white border-gray-300 text-gray-900"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setFormData({ ...formData, fechaEntrega: '' })}
                        className="text-xs text-gray-600 hover:text-gray-900"
                      >
                        Quitar fecha
                      </Button>
                    </div>
                  )}
                </div>

                {/* Tema */}
                <div className="mb-6">
                  <Label className="text-sm font-medium text-gray-700 mb-2 block flex items-center gap-1">
                    Tema
                    <HelpCircle className="w-4 h-4 text-gray-400" />
                  </Label>
                  <Select value={tema} onValueChange={setTema}>
                    <SelectTrigger className="bg-white border-gray-300 text-gray-900">
                      <SelectValue placeholder="Sin tema" />
                    </SelectTrigger>
                    <SelectContent className="bg-white">
                      <SelectItem value="" className="text-gray-900">Sin tema</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Rúbrica */}
                <div className="mb-6">
                  <button
                    type="button"
                    className="text-sm text-[#1e3cff] hover:text-[#002366] font-medium"
                  >
                    Rúbrica
                  </button>
                </div>

                {/* Botones de acción */}
                <div className="flex gap-3 pt-4 border-t border-gray-200">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      resetForm();
                      setLocation('/profesor/academia/tareas');
                    }}
                    className="flex-1 border-gray-300 text-gray-700 hover:bg-gray-50"
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    disabled={createAssignmentMutation.isPending || logroBlocksCreation}
                    className="flex-1 bg-[#1e3cff] hover:bg-[#002366] text-white disabled:opacity-60"
                  >
                    {createAssignmentMutation.isPending ? 'Creando...' : 'Asignar'}
                  </Button>
                </div>
              </div>
            </form>
          </div>
    </div>
  );
}

export default function ProfesorAsignarTareaPage() {
  return (
    <AsignarTareaErrorBoundary>
      <ProfesorAsignarTareaPageInner />
    </AsignarTareaErrorBoundary>
  );
}

