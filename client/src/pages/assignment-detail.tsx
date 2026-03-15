import { useState, useMemo } from 'react';
import { useAuth } from '@/lib/authContext';
import { Calendar, Clock, FileText, Link2, Paperclip, X, Edit, Check, Users, Send, Maximize2, UserX, ExternalLink, Presentation, FileSpreadsheet, Cloud, Plus } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useLocation, useParams } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { NavBackButton } from '@/components/nav-back-button';
import { DocumentEditor } from '@/components/document-editor';
import { courseDisplayLabel } from '@/lib/assignmentUtils';

type AttachmentType = 'pdf' | 'link' | 'imagen' | 'documento' | 'otro';

interface Attachment {
  tipo: AttachmentType;
  nombre: string;
  url: string;
}

interface Submission {
  estudianteId: string;
  estudianteNombre: string;
  archivos: Attachment[];
  comentario?: string;
  fechaEntrega: string;
  calificacion?: number;
  retroalimentacion?: string;
}

interface AssignmentMaterialRow {
  _id: string;
  assignmentId: string;
  type: 'file' | 'link' | 'gdoc';
  url: string;
  fileName?: string;
  mimeType?: string;
  uploadedAt?: string;
}

interface Assignment {
  _id: string;
  titulo: string;
  descripcion: string;
  contenidoDocumento?: string;
  curso?: string;
  materiaNombre?: string;
  courseId?: string;
  groupId?: string;
  fechaEntrega: string;
  profesorId: string;
  profesorNombre: string;
  adjuntos: Attachment[];
  submissions?: Submission[];
  entregas?: Submission[]; // Legacy support
  estado?: 'pendiente' | 'entregada' | 'calificada';
}

export default function AssignmentDetailPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const params = useParams<{ id: string }>();
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({ titulo: '', descripcion: '', fechaEntrega: '', horaEntrega: '' });
  const [editAdjuntos, setEditAdjuntos] = useState<Attachment[]>([]);
  const [newAttachment, setNewAttachment] = useState<Attachment>({ tipo: 'link', nombre: '', url: '' });
  
  const [submitData, setSubmitData] = useState({ comentario: '' });
  const [submitArchivos, setSubmitArchivos] = useState<Attachment[]>([]);
  const [newSubmitAttachment, setNewSubmitAttachment] = useState<Attachment>({ tipo: 'link', nombre: '', url: '' });
  const [isEditingMySubmission, setIsEditingMySubmission] = useState(false);
  // Estado para "Añadir o crear" en entrega (estudiante)
  const [submitAddFromGoogleOpen, setSubmitAddFromGoogleOpen] = useState(false);
  const [submitAddFromEvoOpen, setSubmitAddFromEvoOpen] = useState(false);
  const [submitCreateNewOpen, setSubmitCreateNewOpen] = useState(false);
  const [submitCreateNewNombre, setSubmitCreateNewNombre] = useState('');
  const [submitCreateNewType, setSubmitCreateNewType] = useState<'doc' | 'slide' | 'sheet'>('doc');
  const [submitGoogleSearch, setSubmitGoogleSearch] = useState('');
  const [submitEvoLinkUrl, setSubmitEvoLinkUrl] = useState('');
  const [submitEvoLinkName, setSubmitEvoLinkName] = useState('');

  // Estados para calificación (profesor)
  const [gradingStudent, setGradingStudent] = useState<string | null>(null);
  const [gradeData, setGradeData] = useState({ calificacion: '', retroalimentacion: '', logro: '' });

  const isProfesor = user?.rol === 'profesor';
  const isPadre = user?.rol === 'padre';

  const { data: assignment, isLoading, error, refetch } = useQuery<Assignment>({
    queryKey: ['/api/assignments', params.id],
    queryFn: async () => {
      try {
        const result = await apiRequest('GET', `/api/assignments/${params.id}`);
        console.log('Assignment data received:', result);
        // Asegurar que adjuntos sea un array
        if (result && !Array.isArray(result.adjuntos)) {
          result.adjuntos = [];
        }
        return result;
      } catch (err) {
        console.error('Error fetching assignment:', err);
        throw err;
      }
    },
    enabled: !!params.id,
    staleTime: 0,
    refetchInterval: isProfesor ? 15000 : false, // Actualizar cada 15s para ver nuevas entregas al instante
  });

  const { data: assignmentMaterials = [] } = useQuery<AssignmentMaterialRow[]>({
    queryKey: ['assignment-materials', params.id],
    queryFn: () => apiRequest('GET', `/api/assignment-materials?assignmentId=${encodeURIComponent(params.id!)}`),
    enabled: !!params.id && !!assignment?._id,
  });

  // Google Drive para entrega del estudiante (Añadir o crear)
  const { data: submitGoogleStatus = { connected: false } } = useQuery<{ connected: boolean }>({
    queryKey: ['evo-drive', 'google-status'],
    queryFn: () => apiRequest('GET', '/api/evo-drive/google/status'),
    enabled: !!params.id && !isProfesor && !!assignment,
  });
  interface GoogleDriveFileSubmit { id: string; name: string; mimeType?: string; webViewLink?: string }
  const { data: submitGoogleFilesRes, isLoading: submitGoogleFilesLoading } = useQuery<{ files: GoogleDriveFileSubmit[] }>({
    queryKey: ['evo-drive', 'google-files-submit', submitGoogleSearch],
    queryFn: () => apiRequest('GET', `/api/evo-drive/google/files?q=${encodeURIComponent(submitGoogleSearch)}`),
    enabled: submitAddFromGoogleOpen && !!submitGoogleStatus.connected,
  });
  const submitGoogleFiles = submitGoogleFilesRes?.files ?? [];

  const createPersonalDocMutation = useMutation({
    mutationFn: async (payload: { nombre: string; tipo: 'doc' | 'slide' | 'sheet' }) =>
      apiRequest<{ googleWebViewLink?: string; nombre?: string }>('POST', '/api/evo-drive/google/create-personal', payload),
    onSuccess: (data) => {
      const url = data?.googleWebViewLink;
      const name = data?.nombre || submitCreateNewNombre;
      if (url) {
        setSubmitArchivos((prev) => [...prev, { tipo: 'documento', nombre: name || 'Documento', url }]);
        toast({ title: 'Documento creado', description: 'Se añadió a tu entrega. Ábrelo, complétalo y envía.' });
      }
      setSubmitCreateNewOpen(false);
      setSubmitCreateNewNombre('');
    },
    onError: (e: Error) => {
      toast({ title: 'Error', description: e.message || 'No se pudo crear el documento.', variant: 'destructive' });
    },
  });

  const updateAssignmentMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest('PUT', `/api/assignments/${params.id}`, data);
    },
    onSuccess: () => {
      toast({ title: 'Tarea actualizada exitosamente' });
      setIsEditing(false);
      queryClient.invalidateQueries({ queryKey: ['/api/assignments', params.id] });
      refetch();
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message || 'No se pudo actualizar la tarea', variant: 'destructive' });
    },
  });

  const submitAssignmentMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest('POST', `/api/assignments/${params.id}/submit`, data);
    },
    onSuccess: (_data, variables) => {
      const isUpdate = (variables as { isUpdate?: boolean }).isUpdate;
      toast({ title: isUpdate ? 'Entrega actualizada' : 'Entrega enviada exitosamente' });
      setSubmitData({ comentario: '' });
      setSubmitArchivos([]);
      setIsEditingMySubmission(false);
      queryClient.invalidateQueries({ queryKey: ['/api/assignments', params.id] });
      queryClient.invalidateQueries({ queryKey: ['studentAssignments'] });
      refetch();
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message || 'No se pudo enviar la entrega', variant: 'destructive' });
    },
  });

  const gradeAssignmentMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest('PUT', `/api/assignments/${params.id}/grade`, data);
    },
    onSuccess: () => {
      toast({ title: 'Tarea calificada y devuelta al estudiante' });
      setGradingStudent(null);
      setGradeData({ calificacion: '', retroalimentacion: '', logro: '' });
      queryClient.invalidateQueries({ queryKey: ['/api/assignments', params.id] });
      queryClient.invalidateQueries({ queryKey: ['assignments'] });
      queryClient.invalidateQueries({ queryKey: ['gradeTableAssignments'] });
      queryClient.invalidateQueries({ queryKey: ['studentNotes'] });
      queryClient.invalidateQueries({ queryKey: ['studentAssignments'] });
      queryClient.invalidateQueries({ queryKey: ['teacherPendingReview'] });
      refetch();
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message || 'No se pudo calificar la tarea', variant: 'destructive' });
    },
  });

  const startEditing = () => {
    if (assignment) {
      const fecha = new Date(assignment.fechaEntrega);
      setEditData({
        titulo: assignment.titulo,
        descripcion: assignment.descripcion,
        fechaEntrega: fecha.toISOString().split('T')[0],
        horaEntrega: fecha.toTimeString().slice(0, 5),
      });
      setEditAdjuntos(assignment.adjuntos || []);
      setIsEditing(true);
    }
  };

  const handleSaveEdit = () => {
    const fechaCompleta = new Date(`${editData.fechaEntrega}T${editData.horaEntrega}`);
    updateAssignmentMutation.mutate({
      titulo: editData.titulo,
      descripcion: editData.descripcion,
      fechaEntrega: fechaCompleta.toISOString(),
      adjuntos: editAdjuntos,
    });
  };

  const handleAddEditAttachment = () => {
    if (newAttachment.nombre && newAttachment.url) {
      setEditAdjuntos([...editAdjuntos, newAttachment]);
      setNewAttachment({ tipo: 'link', nombre: '', url: '' });
    }
  };

  const handleAddSubmitAttachment = () => {
    if (newSubmitAttachment.nombre && newSubmitAttachment.url) {
      setSubmitArchivos([...submitArchivos, newSubmitAttachment]);
      setNewSubmitAttachment({ tipo: 'link', nombre: '', url: '' });
    }
  };

  const driveViewLink = (id: string, mimeType?: string) => {
    const m = (mimeType || '').toLowerCase();
    if (m.includes('document')) return `https://docs.google.com/document/d/${id}/edit`;
    if (m.includes('spreadsheet')) return `https://docs.google.com/spreadsheets/d/${id}/edit`;
    if (m.includes('presentation')) return `https://docs.google.com/presentation/d/${id}/edit`;
    return `https://drive.google.com/file/d/${id}/view`;
  };

  const handleSubmitAddFromGoogle = (gfile: GoogleDriveFileSubmit) => {
    const url = gfile.webViewLink || driveViewLink(gfile.id, gfile.mimeType);
    setSubmitArchivos((prev) => [...prev, { tipo: 'documento', nombre: gfile.name, url }]);
    setSubmitAddFromGoogleOpen(false);
    setSubmitGoogleSearch('');
    toast({ title: 'Archivo añadido', description: 'Se añadió a tu entrega.' });
  };

  const handleSubmitAddFromEvo = () => {
    const url = submitEvoLinkUrl.trim();
    const name = submitEvoLinkName.trim();
    if (!url) return;
    setSubmitArchivos((prev) => [...prev, { tipo: 'link', nombre: name || url, url }]);
    setSubmitAddFromEvoOpen(false);
    setSubmitEvoLinkUrl('');
    setSubmitEvoLinkName('');
    toast({ title: 'Enlace añadido', description: 'Se añadió a tu entrega.' });
  };

  const handleSubmitCreateNew = () => {
    if (!submitCreateNewNombre.trim()) return;
    createPersonalDocMutation.mutate({ nombre: submitCreateNewNombre.trim(), tipo: submitCreateNewType });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submitAssignmentMutation.mutate({
      archivos: submitArchivos,
      comentario: submitData.comentario,
      isUpdate: isEditingMySubmission,
    });
  };

  const { data: hijos = [] } = useQuery<{ _id: string; nombre: string }[]>({
    queryKey: ['/api/users/me/hijos'],
    queryFn: () => apiRequest('GET', '/api/users/me/hijos'),
    enabled: !!user?.id && isPadre,
  });
  const primerHijoId = hijos[0]?._id;
  const nombreHijo = hijos[0]?.nombre || 'tu hijo/a';

  // Estudiantes del curso/grupo de la tarea (para secciones Entregado / Pendiente en vista profesor)
  const groupId = assignment?.groupId ?? '';
  const cursoName = (assignment?.curso ?? '').trim();
  const groupIdOrName = groupId || cursoName;
  const { data: groupStudents = [], isLoading: loadingGroupStudents, isError: errorGroupStudents, error: groupStudentsError, refetch: refetchGroupStudents } = useQuery<{ _id: string; nombre: string; estado?: string }[]>({
    queryKey: ['/api/groups', groupId, cursoName, 'students'],
    queryFn: async () => {
      if (groupId) {
        try {
          const raw = await apiRequest<{ _id: string; nombre: string; estado?: string }[]>('GET', `/api/groups/${encodeURIComponent(groupId)}/students`);
          return Array.isArray(raw) ? raw : [];
        } catch (e: unknown) {
          const msg = (e as Error)?.message ?? '';
          if (cursoName && (msg.includes('encontrado') || msg.includes('404') || msg.includes('Grupo no'))) {
            const byName = await apiRequest<{ _id: string; nombre: string; estado?: string }[]>('GET', `/api/groups/${encodeURIComponent(cursoName.toUpperCase())}/students`);
            return Array.isArray(byName) ? byName : [];
          }
          throw e;
        }
      }
      if (cursoName) {
        const raw = await apiRequest<{ _id: string; nombre: string; estado?: string }[]>('GET', `/api/groups/${encodeURIComponent(cursoName.toUpperCase())}/students`);
        return Array.isArray(raw) ? raw : [];
      }
      return [];
    },
    enabled: isProfesor && !!(groupId || cursoName),
    retry: false,
  });

  // Usar submissions si existe, sino usar entregas (legacy)
  const submissions = assignment?.submissions || assignment?.entregas || [];
  const submittedIds = useMemo(() => new Set(submissions.map((s: Submission) => String(s.estudianteId))), [submissions]);
  const pendingStudents = useMemo(
    () => groupStudents.filter((s) => !submittedIds.has(String(s._id))),
    [groupStudents, submittedIds]
  );
  const mySubmission = submissions.find((e: Submission) => e.estudianteId === user?.id);
  const hijoSubmission = isPadre && primerHijoId
    ? submissions.find((e: Submission) => e.estudianteId === primerHijoId)
    : null;
  const isPastDue = assignment ? new Date(assignment.fechaEntrega) < new Date() : false;
  const estado = assignment?.estado || (mySubmission 
    ? (mySubmission.calificacion !== undefined ? 'calificada' : 'entregada')
    : 'pendiente');

  const tabFromUrl = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('tab') : null;
  const defaultTab = tabFromUrl === 'entregas' ? 'entregas' : 'info';
  
  const handleGrade = (estudianteId: string) => {
    const submission = submissions.find((s: Submission) => s.estudianteId === estudianteId);
    setGradingStudent(estudianteId);
    setGradeData({
      calificacion: submission?.calificacion?.toString() || '',
      retroalimentacion: submission?.retroalimentacion || '',
      logro: '',
    });
  };

  const handleSubmitGrade = (e: React.FormEvent) => {
    e.preventDefault();
    if (!gradingStudent || !gradeData.calificacion) {
      toast({ title: 'Error', description: 'La calificación es obligatoria', variant: 'destructive' });
      return;
    }
    
    const calificacion = parseFloat(gradeData.calificacion);
    if (isNaN(calificacion) || calificacion < 0 || calificacion > 100) {
      toast({ title: 'Error', description: 'La calificación debe estar entre 0 y 100', variant: 'destructive' });
      return;
    }

    gradeAssignmentMutation.mutate({
      estudianteId: gradingStudent,
      calificacion,
      retroalimentacion: gradeData.retroalimentacion || undefined,
      logro: gradeData.logro || undefined,
    });
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-white">Cargando información de la tarea...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-white">
          <p className="text-red-400 mb-2">Error al cargar la tarea</p>
          <p className="text-white/60 text-sm">{(error as any)?.message || 'Intenta recargar la página'}</p>
        </div>
      </div>
    );
  }

  if (!assignment) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-white">Tarea no encontrada</div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto p-8">
      <div className="max-w-4xl mx-auto">
        {!isProfesor && !isPadre && (
          <NavBackButton to="/mi-aprendizaje/tareas" label="Tareas" />
        )}
        {isPadre && (
          <NavBackButton to="/calendar" label="Calendario" />
        )}
        {isProfesor && (
          <NavBackButton to="/profesor/academia/tareas" label="Tareas" />
        )}
              {isProfesor ? (
                <Tabs defaultValue={defaultTab} className="w-full">
                  <TabsList className="bg-white/5 border border-white/10 mb-6">
                    <TabsTrigger value="info" className="data-[state=active]:bg-[#1e3cff]">Información</TabsTrigger>
                    <TabsTrigger value="entregas" className="data-[state=active]:bg-[#1e3cff]">
                      Entregas ({submissions.length}/{groupStudents.length || 0})
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="info">
                    <Card className="bg-white/5 border-white/10 backdrop-blur-md">
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            {isEditing ? (
                              <Input
                                value={editData.titulo}
                                onChange={(e) => setEditData({ ...editData, titulo: e.target.value })}
                                className="text-2xl font-bold bg-white/5 border-white/10 text-white mb-2"
                                data-testid="edit-titulo"
                              />
                            ) : (
                              <CardTitle className="text-2xl font-bold text-white mb-2">{assignment.titulo}</CardTitle>
                            )}
                            <div className="flex items-center gap-4 text-white/60">
                              <Badge className="bg-[#1e3cff]">{courseDisplayLabel(assignment)}</Badge>
                              <span className="flex items-center gap-1">
                                <Calendar className="w-4 h-4" />
                                {new Date(assignment.fechaEntrega).toLocaleDateString('es-CO')}
                              </span>
                              <span className="flex items-center gap-1">
                                <Clock className="w-4 h-4" />
                                {new Date(assignment.fechaEntrega).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                          </div>
                          {!isEditing ? (
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                onClick={() => setLocation(`/profesor/academia/tareas/editor/${assignment._id}`)}
                                className="border-[#1e3cff]/40 text-[#1e3cff] hover:bg-[#1e3cff]/10"
                              >
                                <Maximize2 className="w-4 h-4 mr-2" />
                                {assignment.contenidoDocumento ? 'Editar Documento' : 'Extender Documento'}
                              </Button>
                              <Button
                                variant="outline"
                                onClick={startEditing}
                                className="border-white/10 text-white hover:bg-white/10"
                                data-testid="button-edit"
                              >
                                <Edit className="w-4 h-4 mr-2" />
                                Editar
                              </Button>
                            </div>
                          ) : (
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                onClick={() => setIsEditing(false)}
                                className="border-white/10 text-white hover:bg-white/10"
                              >
                                Cancelar
                              </Button>
                              <Button
                                onClick={handleSaveEdit}
                                disabled={updateAssignmentMutation.isPending}
                                className="bg-gradient-to-r from-[#002366] to-[#1e3cff]"
                                data-testid="button-save"
                              >
                                <Check className="w-4 h-4 mr-2" />
                                Guardar
                              </Button>
                            </div>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-6">
                        <div>
                          <Label className="text-white/60 mb-2 block">Descripción</Label>
                          {isEditing ? (
                            <Textarea
                              value={editData.descripcion}
                              onChange={(e) => setEditData({ ...editData, descripcion: e.target.value })}
                              className="bg-white/5 border-white/10 text-white min-h-[100px]"
                              data-testid="edit-descripcion"
                            />
                          ) : (
                            <p className="text-white whitespace-pre-wrap">{assignment.descripcion}</p>
                          )}
                        </div>

                        {isEditing && (
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <Label className="text-white/60 mb-2 block">Fecha de Entrega</Label>
                              <Input
                                type="date"
                                value={editData.fechaEntrega}
                                onChange={(e) => setEditData({ ...editData, fechaEntrega: e.target.value })}
                                className="bg-white/5 border-white/10 text-white"
                              />
                            </div>
                            <div>
                              <Label className="text-white/60 mb-2 block">Hora Límite</Label>
                              <Input
                                type="time"
                                value={editData.horaEntrega}
                                onChange={(e) => setEditData({ ...editData, horaEntrega: e.target.value })}
                                className="bg-white/5 border-white/10 text-white"
                              />
                            </div>
                          </div>
                        )}

                        {/* Mostrar documento si existe */}
                        {!isEditing && assignment.contenidoDocumento && (
                          <div className="mt-6">
                            <Label className="text-white/60 mb-2 block">Documento Extendido</Label>
                            <div className="mt-2">
                              <DocumentEditor
                                content={assignment.contenidoDocumento}
                                onChange={() => {}} // Read-only en vista
                                readOnly={true}
                              />
                            </div>
                          </div>
                        )}

                        <div>
                          <Label className="text-white/60 mb-2 block">Adjuntos</Label>
                          {isEditing ? (
                            <div className="space-y-3">
                              {editAdjuntos.map((adj, index) => (
                                <div key={index} className="flex items-center gap-2 p-2 bg-white/5 rounded-lg">
                                  {adj.tipo === 'link' ? <Link2 className="w-4 h-4 text-[#1e3cff]" /> : <FileText className="w-4 h-4 text-[#1e3cff]" />}
                                  <span className="flex-1 text-sm text-white truncate">{adj.nombre}</span>
                                  <Button
                                    type="button"
                                    size="icon"
                                    variant="ghost"
                                    onClick={() => setEditAdjuntos(editAdjuntos.filter((_, i) => i !== index))}
                                    className="h-6 w-6 text-white/50 hover:text-white"
                                  >
                                    <X className="w-4 h-4" />
                                  </Button>
                                </div>
                              ))}
                              <div className="flex gap-2">
                                <Select
                                  value={newAttachment.tipo}
                                  onValueChange={(value) => setNewAttachment({ ...newAttachment, tipo: value as 'pdf' | 'link' | 'imagen' | 'documento' | 'otro' })}
                                >
                                  <SelectTrigger className="w-28 bg-white/5 border-white/10 text-white">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent className="bg-[#0a0a2a] border-white/10">
                                    <SelectItem value="link" className="text-white">Link</SelectItem>
                                    <SelectItem value="pdf" className="text-white">PDF</SelectItem>
                                    <SelectItem value="documento" className="text-white">Doc</SelectItem>
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
                                  onClick={handleAddEditAttachment}
                                  className="border-white/10 text-white hover:bg-white/10"
                                >
                                  <Paperclip className="w-4 h-4" />
                                </Button>
                              </div>
                            </div>
                          ) : (
                            (assignment.adjuntos?.length > 0 || assignmentMaterials.length > 0) ? (
                              <div className="space-y-3">
                                {assignment.adjuntos?.map((adj, index) => (
                                  <a
                                    key={`legacy-${index}`}
                                    href={adj.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="group flex items-center justify-between gap-4 py-3 px-4 rounded-[12px] border border-white/10 bg-[#0f172a]/60 hover:bg-white/[0.06] hover:border-[#4DBBFF]/20 transition-all duration-150 ease-in-out"
                                    data-testid={`adjunto-${index}`}
                                  >
                                    <div className="flex items-center gap-4 min-w-0 flex-1">
                                      <div className="w-[38px] h-[38px] rounded-[10px] flex items-center justify-center shrink-0 bg-white/10">
                                        {adj.tipo === 'link' ? <Link2 className="w-5 h-5 text-white/70" /> : <FileText className="w-5 h-5 text-[#1a73e8]" />}
                                      </div>
                                      <span className="text-sm font-medium text-white truncate">{adj.nombre}</span>
                                    </div>
                                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#4DBBFF] opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                                      <ExternalLink className="w-3.5 h-3.5" /> Abrir enlace
                                    </span>
                                  </a>
                                ))}
                                {assignmentMaterials.map((m) => {
                                  const isGoogle = m.type === 'gdoc';
                                  const displayName = m.fileName || m.url;
                                  const u = (m.url || '').toLowerCase();
                                  const gdocKind = u.includes('spreadsheets') ? 'sheet' : u.includes('presentation') ? 'slide' : 'doc';
                                  const iconBg = isGoogle ? (gdocKind === 'sheet' ? 'bg-emerald-500/15' : gdocKind === 'slide' ? 'bg-orange-500/15' : 'bg-blue-500/15') : 'bg-white/10';
                                  const Icon = isGoogle ? (gdocKind === 'sheet' ? FileSpreadsheet : gdocKind === 'slide' ? Presentation : FileText) : Link2;
                                  const iconColor = isGoogle ? (gdocKind === 'sheet' ? 'text-[#16a34a]' : gdocKind === 'slide' ? 'text-[#d97706]' : 'text-[#1a73e8]') : 'text-white/70';
                                  return (
                                    <a
                                      key={m._id}
                                      href={m.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="group flex items-center justify-between gap-4 py-3 px-4 rounded-[12px] border border-white/10 bg-[#0f172a]/60 hover:bg-white/[0.06] hover:border-[#4DBBFF]/20 transition-all duration-150 ease-in-out"
                                      data-testid={`material-${m._id}`}
                                    >
                                      <div className="flex items-center gap-4 min-w-0 flex-1">
                                        <div className={`w-[38px] h-[38px] rounded-[10px] flex items-center justify-center shrink-0 ${iconBg}`}>
                                          <Icon className={`w-5 h-5 ${iconColor}`} />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                          <p className="text-sm font-medium text-white truncate">{displayName}</p>
                                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                                            {isGoogle && (
                                              <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-medium bg-emerald-500/15 text-emerald-400">Google</span>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#4DBBFF] opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                                        <ExternalLink className="w-3.5 h-3.5" /> {isGoogle ? 'Abrir en Drive' : 'Abrir enlace'}
                                      </span>
                                    </a>
                                  );
                                })}
                              </div>
                            ) : (
                              <p className="text-white/50">Sin adjuntos</p>
                            )
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="entregas">
                    <Card className="bg-white/5 border-white/10 backdrop-blur-md">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-white">
                          <Users className="w-5 h-5 text-[#1e3cff]" />
                          Entregas de Estudiantes
                        </CardTitle>
                        <CardDescription className="text-white/60">
                          {loadingGroupStudents
                            ? 'Cargando lista de estudiantes…'
                            : `${submissions.length} entregado${submissions.length !== 1 ? 's' : ''} · ${pendingStudents.length} pendiente${pendingStudents.length !== 1 ? 's' : ''}`}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-8">
                        <div>
                          <h4 className="text-sm font-semibold text-white/80 mb-3 flex items-center gap-2">
                            <Check className="w-4 h-4 text-green-500" />
                            Entregado ({submissions.length})
                          </h4>
                          {submissions.length === 0 ? (
                            <p className="text-white/50 text-sm py-4">Ningún estudiante ha entregado aún.</p>
                          ) : (
                            <div className="space-y-4">
                              {submissions.map((submission, index) => {
                                const nombre = submission.estudianteNombre || groupStudents.find((e) => String(e._id) === String(submission.estudianteId))?.nombre || 'Estudiante';
                                const hasGrade = submission.calificacion != null && submission.calificacion !== '';
                                return (
                              <div
                                key={submission.estudianteId || index}
                                role="button"
                                tabIndex={0}
                                onClick={() => handleGrade(submission.estudianteId)}
                                onKeyDown={(e) => {
                                  if (e.key !== 'Enter' && e.key !== ' ') return;
                                  const target = e.target as HTMLElement;
                                  if (target.closest('form') || target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') return;
                                  e.preventDefault();
                                  handleGrade(submission.estudianteId);
                                }}
                                className="p-4 rounded-lg border cursor-pointer transition-all focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/50 panel-grades border-white/10 hover:border-white/20"
                              >
                                <div className="flex items-start justify-between mb-3">
                                  <div className="flex-1">
                                    <h4 className="font-semibold text-white">{nombre}</h4>
                                    <p className="text-sm text-white/50">
                                      Entregado: {new Date(submission.fechaEntrega).toLocaleString('es-CO')}
                                    </p>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {hasGrade ? (
                                      <Badge className="bg-green-600">{Number(submission.calificacion)}/100</Badge>
                                    ) : (
                                      <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-[#3B82F6]/20 text-[#93C5FD] border border-[#3B82F6]/40">
                                        —/100 · Clic para calificar
                                      </span>
                                    )}
                                  </div>
                                </div>
                                {submission.comentario && (
                                  <p className="text-white/70 text-sm mb-3">{submission.comentario}</p>
                                )}
                                {submission.archivos && submission.archivos.length > 0 && (
                                  <div className="space-y-2 mb-3">
                                    {submission.archivos.map((archivo, idx) => (
                                      <a
                                        key={idx}
                                        href={archivo.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-2 p-2 bg-white/5 rounded hover:bg-white/10 transition-colors"
                                      >
                                        <FileText className="w-4 h-4 text-[#3B82F6]" />
                                        <span className="text-sm text-white">{archivo.nombre}</span>
                                      </a>
                                    ))}
                                  </div>
                                )}
                                {submission.retroalimentacion && (
                                  <div className="mt-3 p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
                                    <p className="text-sm font-semibold text-green-400 mb-1">Retroalimentación:</p>
                                    <p className="text-sm text-white/80">{submission.retroalimentacion}</p>
                                  </div>
                                )}
                                {gradingStudent === submission.estudianteId && (
                                  <form
                                    onSubmit={handleSubmitGrade}
                                    onClick={(e) => e.stopPropagation()}
                                    onKeyDown={(e) => e.stopPropagation()}
                                    className="mt-4 p-4 rounded-lg border border-white/10 panel-grades"
                                  >
                                    <div className="space-y-3">
                                      <div>
                                        <Label className="text-[#E2E8F0] mb-1 block">Calificación (0-100) *</Label>
                                        <Input
                                          type="number"
                                          min="0"
                                          max="100"
                                          value={gradeData.calificacion}
                                          onChange={(e) => setGradeData({ ...gradeData, calificacion: e.target.value })}
                                          className="bg-white/5 border-white/10 text-[#E2E8F0] focus:border-[#3B82F6] focus:ring-1 focus:ring-[#3B82F6]"
                                          required
                                        />
                                      </div>
                                      <div>
                                        <Label className="text-[#E2E8F0] mb-1 block">Retroalimentación</Label>
                                        <Textarea
                                          value={gradeData.retroalimentacion}
                                          onChange={(e) => setGradeData({ ...gradeData, retroalimentacion: e.target.value })}
                                          className="bg-white/5 border-white/10 text-[#E2E8F0] focus:border-[#3B82F6] focus:ring-1 focus:ring-[#3B82F6]"
                                          rows={3}
                                        />
                                      </div>
                                      <div>
                                        <Label className="text-[#E2E8F0] mb-1 block">Logro (opcional)</Label>
                                        <Input
                                          value={gradeData.logro}
                                          onChange={(e) => setGradeData({ ...gradeData, logro: e.target.value })}
                                          className="bg-white/5 border-white/10 text-[#E2E8F0] focus:border-[#3B82F6] focus:ring-1 focus:ring-[#3B82F6]"
                                          placeholder="Ej: Superado, En proceso..."
                                        />
                                      </div>
                                      <div className="flex gap-2">
                                        <Button
                                          type="submit"
                                          disabled={gradeAssignmentMutation.isPending}
                                          className="bg-[#3B82F6] hover:bg-[#2563EB] text-white"
                                        >
                                          {gradeAssignmentMutation.isPending ? 'Calificando...' : 'Calificar y Devolver'}
                                        </Button>
                                        <Button
                                          type="button"
                                          variant="outline"
                                          onClick={() => {
                                            setGradingStudent(null);
                                            setGradeData({ calificacion: '', retroalimentacion: '', logro: '' });
                                          }}
                                          className="border-white/10 text-[#E2E8F0] hover:bg-white/10"
                                        >
                                          Cancelar
                                        </Button>
                                      </div>
                                    </div>
                                  </form>
                                )}
                              </div>
                            );
                              })}
                            </div>
                          )}
                        </div>

                        <div>
                          <h4 className="text-sm font-semibold text-white/80 mb-3 flex items-center gap-2">
                            <UserX className="w-4 h-4 text-amber-500" />
                            Pendiente ({pendingStudents.length})
                          </h4>
                          {!groupIdOrName ? (
                            <p className="text-white/50 text-sm py-4">Esta tarea no tiene grupo asociado. No se puede mostrar la lista de estudiantes.</p>
                          ) : loadingGroupStudents ? (
                            <p className="text-white/50 text-sm py-4">Cargando estudiantes del curso…</p>
                          ) : errorGroupStudents ? (
                            <div className="py-4 space-y-2">
                              <p className="text-amber-400/90 text-sm">{(groupStudentsError as Error)?.message ?? 'No se pudo cargar la lista de estudiantes.'}</p>
                              <Button type="button" variant="outline" size="sm" className="border-white/20 text-white hover:bg-white/10" onClick={() => refetchGroupStudents()}>
                                Reintentar
                              </Button>
                            </div>
                          ) : pendingStudents.length > 0 ? (
                            <ul className="space-y-2">
                              {pendingStudents.map((est) => (
                                <li
                                  key={est._id}
                                  className="flex items-center gap-3 p-3 bg-white/5 rounded-lg border border-white/10 text-white/90"
                                >
                                  <Users className="w-4 h-4 text-white/50 flex-shrink-0" />
                                  <span className="font-medium">{est.nombre}</span>
                                  <span className="text-xs text-white/50 ml-auto">Sin entregar</span>
                                </li>
                              ))}
                            </ul>
                          ) : groupStudents.length === 0 ? (
                            <p className="text-white/50 text-sm py-4">No hay estudiantes inscritos en este grupo. Sincroniza estudiantes desde el detalle del curso.</p>
                          ) : (
                            <p className="text-white/50 text-sm py-4">Todos los estudiantes del curso han entregado.</p>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>
                </Tabs>
              ) : (
                <div className="space-y-6">
                  {/* Header con información de la tarea */}
                  <Card className="bg-white/5 border-white/10 backdrop-blur-md">
                    <CardHeader>
                      <CardTitle className="text-2xl font-bold text-white mb-2">{assignment.titulo}</CardTitle>
                      <div className="flex flex-wrap items-center gap-4 text-white/60">
                        <Badge className="bg-[#1e3cff]">{courseDisplayLabel(assignment)}</Badge>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          {new Date(assignment.fechaEntrega).toLocaleDateString('es-CO')}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          {new Date(assignment.fechaEntrega).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <span className="text-sm">Por: {assignment.profesorNombre}</span>
                        {isPastDue && <Badge variant="destructive">Fecha límite pasada</Badge>}
                        {estado === 'pendiente' && <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/40">Pendiente</Badge>}
                        {estado === 'entregada' && <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/40">Entregada</Badge>}
                        {estado === 'calificada' && <Badge className="bg-green-500/20 text-green-400 border-green-500/40">Calificada</Badge>}
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div>
                        <Label className="text-white/60 mb-2 block">Descripción</Label>
                        <p className="text-white whitespace-pre-wrap">{assignment.descripcion}</p>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Documento extendido */}
                  {assignment.contenidoDocumento && assignment.contenidoDocumento.trim() !== '' && (
                    <Card className="bg-white/5 border-white/10 backdrop-blur-md">
                      <CardHeader>
                        <CardTitle className="text-white flex items-center gap-2">
                          <FileText className="w-5 h-5 text-[#1e3cff]" />
                          Instrucciones y Contenido
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <DocumentEditor
                          content={assignment.contenidoDocumento || ''}
                          onChange={() => {}} // Read-only para estudiantes
                          readOnly={true}
                        />
                      </CardContent>
                    </Card>
                  )}

                  {/* Recursos adjuntos (legacy + Evo Drive materials) */}
                  {((assignment.adjuntos && Array.isArray(assignment.adjuntos) && assignment.adjuntos.length > 0) || assignmentMaterials.length > 0) && (
                    <Card className="bg-white/5 border-white/10 backdrop-blur-md">
                      <CardHeader>
                        <CardTitle className="text-white text-lg">Archivos de la tarea</CardTitle>
                        <CardDescription className="text-white/60">Materiales y enlaces adjuntos a esta asignación</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          {assignment.adjuntos?.map((adj, index) => {
                            const adjunto = typeof adj === 'string'
                              ? { tipo: 'link' as const, nombre: adj, url: adj }
                              : adj;
                            return (
                              <a
                                key={`legacy-${index}`}
                                href={adjunto.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="group flex items-center justify-between gap-4 py-3 px-4 rounded-[12px] border border-white/10 bg-[#0f172a]/60 hover:bg-white/[0.06] hover:border-[#4DBBFF]/20 transition-all duration-150 ease-in-out"
                                data-testid={`adjunto-${index}`}
                              >
                                <div className="flex items-center gap-4 min-w-0 flex-1">
                                  <div className="w-[38px] h-[38px] rounded-[10px] flex items-center justify-center shrink-0 bg-white/10">
                                    {adjunto.tipo === 'link' ? <Link2 className="w-5 h-5 text-white/70" /> : <FileText className="w-5 h-5 text-[#1a73e8]" />}
                                  </div>
                                  <span className="text-sm font-medium text-white truncate">{adjunto.nombre}</span>
                                </div>
                                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#4DBBFF] opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                                  <ExternalLink className="w-3.5 h-3.5" /> Abrir enlace
                                </span>
                              </a>
                            );
                          })}
                          {assignmentMaterials.map((m) => {
                            const isGoogle = m.type === 'gdoc';
                            const displayName = m.fileName || m.url;
                            const u = (m.url || '').toLowerCase();
                            const gdocKind = u.includes('spreadsheets') ? 'sheet' : u.includes('presentation') ? 'slide' : 'doc';
                            const iconBg = isGoogle ? (gdocKind === 'sheet' ? 'bg-emerald-500/15' : gdocKind === 'slide' ? 'bg-orange-500/15' : 'bg-blue-500/15') : 'bg-white/10';
                            const Icon = isGoogle ? (gdocKind === 'sheet' ? FileSpreadsheet : gdocKind === 'slide' ? Presentation : FileText) : Link2;
                            const iconColor = isGoogle ? (gdocKind === 'sheet' ? 'text-[#16a34a]' : gdocKind === 'slide' ? 'text-[#d97706]' : 'text-[#1a73e8]') : 'text-white/70';
                            return (
                              <a
                                key={m._id}
                                href={m.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="group flex items-center justify-between gap-4 py-3 px-4 rounded-[12px] border border-white/10 bg-[#0f172a]/60 hover:bg-white/[0.06] hover:border-[#4DBBFF]/20 transition-all duration-150 ease-in-out"
                                data-testid={`material-${m._id}`}
                              >
                                <div className="flex items-center gap-4 min-w-0 flex-1">
                                  <div className={`w-[38px] h-[38px] rounded-[10px] flex items-center justify-center shrink-0 ${iconBg}`}>
                                    <Icon className={`w-5 h-5 ${iconColor}`} />
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <p className="text-sm font-medium text-white truncate">{displayName}</p>
                                    {isGoogle && (
                                      <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-medium bg-emerald-500/15 text-emerald-400 mt-1">Google</span>
                                    )}
                                  </div>
                                </div>
                                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#4DBBFF] opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                                  <ExternalLink className="w-3.5 h-3.5" /> {isGoogle ? 'Abrir en Drive' : 'Abrir enlace'}
                                </span>
                              </a>
                            );
                          })}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  <Card className="bg-white/5 border-white/10 backdrop-blur-md">
                    <CardHeader>
                      <CardTitle className="text-white">
                        {isPadre
                          ? `Entrega de ${nombreHijo} (solo visualización)`
                          : mySubmission ? 'Tu Entrega' : 'Enviar Entrega'}
                      </CardTitle>
                      <CardDescription className="text-white/60">
                        {isPadre
                          ? hijoSubmission
                            ? `Entregó el ${new Date(hijoSubmission.fechaEntrega).toLocaleString('es-CO')}`
                            : 'Tu hijo/a aún no ha entregado esta tarea.'
                          : mySubmission
                            ? `Entregaste el ${new Date(mySubmission.fechaEntrega).toLocaleString('es-CO')}`
                            : 'Adjunta tus archivos y envía tu trabajo'}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {isPadre ? (
                        hijoSubmission ? (
                          <div className="space-y-4">
                            {hijoSubmission.comentario && (
                              <div>
                                <Label className="text-white/60 mb-1 block">Comentario:</Label>
                                <p className="text-white">{hijoSubmission.comentario}</p>
                              </div>
                            )}
                            {hijoSubmission.archivos && hijoSubmission.archivos.length > 0 && (
                              <div>
                                <Label className="text-white/60 mb-2 block">Archivos entregados:</Label>
                                <div className="space-y-2">
                                  {hijoSubmission.archivos.map((archivo, idx) => (
                                    <a
                                      key={idx}
                                      href={archivo.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="flex items-center gap-2 p-2 bg-white/5 rounded hover:bg-white/10 transition-colors"
                                    >
                                      <FileText className="w-4 h-4 text-[#1e3cff]" />
                                      <span className="text-sm text-white">{archivo.nombre}</span>
                                    </a>
                                  ))}
                                </div>
                              </div>
                            )}
                            {hijoSubmission.calificacion !== undefined && (
                              <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg space-y-2">
                                <p className="text-green-400 font-semibold text-lg">Calificación: {hijoSubmission.calificacion}/100</p>
                                {hijoSubmission.retroalimentacion && (
                                  <div className="mt-2">
                                    <p className="text-sm font-semibold text-white/80 mb-1">Retroalimentación:</p>
                                    <p className="text-sm text-white/70">{hijoSubmission.retroalimentacion}</p>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        ) : (
                          <p className="text-white/50 text-center py-6">Sin entrega aún.</p>
                        )
                      ) : mySubmission && !isEditingMySubmission ? (
                        <div className="space-y-4">
                          <div>
                            <Label className="text-white/60 mb-1 block">Tu comentario:</Label>
                            <p className="text-white">{mySubmission.comentario?.trim() || 'Sin comentario'}</p>
                          </div>
                          <div>
                            <Label className="text-white/60 mb-2 block">Archivos entregados:</Label>
                            {mySubmission.archivos && mySubmission.archivos.length > 0 ? (
                              <div className="space-y-2">
                                {mySubmission.archivos.map((archivo, idx) => (
                                  <a
                                    key={idx}
                                    href={archivo.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-2 p-2 bg-white/5 rounded hover:bg-white/10 transition-colors"
                                  >
                                    <FileText className="w-4 h-4 text-[#1e3cff]" />
                                    <span className="text-sm text-white">{archivo.nombre}</span>
                                  </a>
                                ))}
                              </div>
                            ) : (
                              <p className="text-white/50 text-sm">No adjuntaste archivos.</p>
                            )}
                          </div>
                          {mySubmission.calificacion !== undefined && (
                            <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg space-y-2">
                              <p className="text-green-400 font-semibold text-lg">Calificación: {mySubmission.calificacion}/100</p>
                              {mySubmission.retroalimentacion && (
                                <div className="mt-2">
                                  <p className="text-sm font-semibold text-white/80 mb-1">Retroalimentación:</p>
                                  <p className="text-sm text-white/70">{mySubmission.retroalimentacion}</p>
                                </div>
                              )}
                            </div>
                          )}
                          <Button
                            onClick={() => {
                              setSubmitData({ comentario: mySubmission.comentario || '' });
                              setSubmitArchivos(Array.isArray(mySubmission.archivos) ? mySubmission.archivos : []);
                              setIsEditingMySubmission(true);
                            }}
                            variant="outline"
                            className="w-full border-white/10 text-white hover:bg-white/10"
                          >
                            Actualizar Entrega
                          </Button>
                        </div>
                      ) : (mySubmission && isEditingMySubmission) || !mySubmission ? (
                        <form onSubmit={handleSubmit} className="space-y-4">
                          <div>
                            <Label className="text-white/60 mb-2 block">Comentario (opcional)</Label>
                            <Textarea
                              value={submitData.comentario}
                              onChange={(e) => setSubmitData({ comentario: e.target.value })}
                              placeholder="Agrega un comentario para tu profesor..."
                              className="bg-white/5 border-white/10 text-white"
                              data-testid="input-comentario"
                            />
                          </div>

                          <div className="space-y-3">
                            <Label className="text-white/60 mb-2 block">Archivos de tu entrega</Label>
                            <p className="text-white/50 text-xs">Añade enlaces, archivos de Google Drive o crea un documento nuevo para entregar.</p>
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
                                    onSelect={() => submitGoogleStatus.connected && setTimeout(() => setSubmitAddFromGoogleOpen(true), 50)}
                                    disabled={!submitGoogleStatus.connected}
                                    className="flex items-center gap-3 py-2.5 px-4 text-[13px] text-white/90 hover:bg-[#4DBBFF]/10 focus:bg-[#4DBBFF]/10 mx-0 rounded-none"
                                  >
                                    <div className="w-8 h-8 rounded-[9px] bg-[#4DBBFF]/20 flex items-center justify-center shrink-0"><Cloud className="w-4 h-4 text-[#4DBBFF]" /></div>
                                    Google Drive
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onSelect={() => setTimeout(() => { setSubmitEvoLinkUrl(''); setSubmitEvoLinkName(''); setSubmitAddFromEvoOpen(true); }, 50)}
                                    className="flex items-center gap-3 py-2.5 px-4 text-[13px] text-white/90 hover:bg-[#4DBBFF]/10 focus:bg-[#4DBBFF]/10 mx-0 rounded-none"
                                  >
                                    <div className="w-8 h-8 rounded-[9px] bg-[#4DBBFF]/20 flex items-center justify-center shrink-0"><Link2 className="w-4 h-4 text-[#4DBBFF]" /></div>
                                    Enlace
                                  </DropdownMenuItem>
                                </div>
                                <div className="border-t border-[#4DBBFF]/10" />
                                <div className="py-2">
                                  <p className="px-4 pt-1.5 pb-1 text-[11px] uppercase tracking-wider text-[#4DBBFF]/50">Crear en mi Drive</p>
                                  <DropdownMenuItem onSelect={() => setTimeout(() => { setSubmitCreateNewType('doc'); setSubmitCreateNewNombre(''); setSubmitCreateNewOpen(true); }, 50)} className="flex items-center gap-3 py-2.5 px-4 text-[13px] text-white/90 hover:bg-[#4DBBFF]/10 focus:bg-[#4DBBFF]/10 mx-0 rounded-none">
                                    <div className="w-8 h-8 rounded-[9px] bg-[#1a56d6] flex items-center justify-center shrink-0"><FileText className="w-4 h-4 text-white" /></div>
                                    Documentos
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onSelect={() => setTimeout(() => { setSubmitCreateNewType('slide'); setSubmitCreateNewNombre(''); setSubmitCreateNewOpen(true); }, 50)} className="flex items-center gap-3 py-2.5 px-4 text-[13px] text-white/90 hover:bg-[#4DBBFF]/10 focus:bg-[#4DBBFF]/10 mx-0 rounded-none">
                                    <div className="w-8 h-8 rounded-[9px] bg-[#d97706] flex items-center justify-center shrink-0"><Presentation className="w-4 h-4 text-white" /></div>
                                    Presentaciones
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onSelect={() => setTimeout(() => { setSubmitCreateNewType('sheet'); setSubmitCreateNewNombre(''); setSubmitCreateNewOpen(true); }, 50)} className="flex items-center gap-3 py-2.5 px-4 text-[13px] text-white/90 hover:bg-[#4DBBFF]/10 focus:bg-[#4DBBFF]/10 mx-0 rounded-none">
                                    <div className="w-8 h-8 rounded-[9px] bg-[#16a34a] flex items-center justify-center shrink-0"><FileSpreadsheet className="w-4 h-4 text-white" /></div>
                                    Hojas de cálculo
                                  </DropdownMenuItem>
                                </div>
                              </DropdownMenuContent>
                            </DropdownMenu>
                            {submitArchivos.length > 0 && (
                              <ul className="space-y-3 mt-2">
                                {submitArchivos.map((archivo, index) => {
                                  const isGoogle = archivo.tipo === 'documento' && archivo.url.includes('google');
                                  const u = (archivo.url || '').toLowerCase();
                                  const gdocKind = u.includes('spreadsheets') ? 'sheet' : u.includes('presentation') ? 'slide' : 'doc';
                                  const iconBg = isGoogle ? (gdocKind === 'sheet' ? 'bg-emerald-500/15' : gdocKind === 'slide' ? 'bg-orange-500/15' : 'bg-blue-500/15') : 'bg-white/10';
                                  const Icon = isGoogle ? (gdocKind === 'sheet' ? FileSpreadsheet : gdocKind === 'slide' ? Presentation : FileText) : Link2;
                                  const iconColor = isGoogle ? (gdocKind === 'sheet' ? 'text-[#16a34a]' : gdocKind === 'slide' ? 'text-[#d97706]' : 'text-[#1a73e8]') : 'text-white/70';
                                  return (
                                    <li key={index} className="group flex items-center justify-between gap-4 py-3 px-4 rounded-[12px] border border-white/10 bg-[#0f172a]/60 hover:bg-white/[0.06] hover:border-[#4DBBFF]/20 transition-all duration-150 ease-in-out">
                                      <div className="flex items-center gap-4 min-w-0 flex-1">
                                        <div className={`w-[38px] h-[38px] rounded-[10px] flex items-center justify-center shrink-0 ${iconBg}`}>
                                          <Icon className={`w-5 h-5 ${iconColor}`} />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                          <p className="text-sm font-medium text-white truncate">{archivo.nombre}</p>
                                          {isGoogle && <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-medium bg-emerald-500/15 text-emerald-400 mt-1">Google</span>}
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-2 shrink-0">
                                        {archivo.url && (
                                          <a href={archivo.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[11px] font-medium text-[#4DBBFF] hover:underline opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                                            <ExternalLink className="w-3.5 h-3.5" /> {isGoogle ? 'Abrir en Drive' : 'Abrir enlace'}
                                          </a>
                                        )}
                                        <Button type="button" variant="ghost" size="sm" className="text-white/70 hover:text-white h-8 w-8 p-0 shrink-0" onClick={() => setSubmitArchivos((prev) => prev.filter((_, i) => i !== index))} aria-label="Quitar">
                                          <X className="w-4 h-4" />
                                        </Button>
                                      </div>
                                    </li>
                                  );
                                })}
                              </ul>
                            )}
                          </div>

                          <div className="flex gap-2">
                            {isEditingMySubmission && (
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => setIsEditingMySubmission(false)}
                                className="border-white/10 text-white hover:bg-white/10"
                              >
                                Cancelar
                              </Button>
                            )}
                            <Button
                              type="submit"
                              disabled={submitAssignmentMutation.isPending}
                              className="flex-1 bg-gradient-to-r from-[#002366] to-[#1e3cff] hover:opacity-90"
                              data-testid="button-submit-entrega"
                            >
                              <Send className="w-4 h-4 mr-2" />
                              {submitAssignmentMutation.isPending
                                ? 'Guardando...'
                                : isEditingMySubmission
                                  ? 'Guardar cambios'
                                  : 'Enviar Entrega'}
                            </Button>
                          </div>
                        </form>
                      ) : null}
                    </CardContent>
                  </Card>
                </div>
              )}

      {/* Modales Añadir o crear (entrega del estudiante) */}
      <Dialog open={submitAddFromGoogleOpen} onOpenChange={setSubmitAddFromGoogleOpen}>
        <DialogContent className="bg-white/5 border border-white/10 max-w-[380px] rounded-2xl p-6 shadow-xl overflow-hidden">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-3">
              <div className="w-10 h-10 rounded-[11px] bg-[#4DBBFF]/20 flex items-center justify-center shrink-0"><Cloud className="w-5 h-5 text-[#4DBBFF]" /></div>
              <div>
                <span className="text-base font-semibold text-white block">Agregar desde Google Drive</span>
                <span className="text-xs text-white/60 mt-0.5 block">Elige un archivo para adjuntar a tu entrega</span>
              </div>
            </DialogTitle>
          </DialogHeader>
          {!submitGoogleStatus.connected ? (
            <p className="text-white/60 text-sm py-4">Conecta Google Drive desde Evo Drive primero para usar tus archivos.</p>
          ) : (
            <>
              <div className="space-y-2">
                <Label className="text-xs font-medium text-white/60">Buscar en Drive</Label>
                <Input value={submitGoogleSearch} onChange={(e) => setSubmitGoogleSearch(e.target.value)} placeholder="Nombre del archivo..." className="bg-white/5 border border-white/10 rounded-md py-2.5 px-3 text-sm text-white placeholder:text-white/50" />
              </div>
              <ScrollArea className="h-[280px] rounded-md border border-white/10">
                {submitGoogleFilesLoading ? (
                  <p className="text-white/50 text-sm p-4">Cargando archivos…</p>
                ) : submitGoogleFiles.length === 0 ? (
                  <p className="text-white/50 text-sm p-4">Escribe para buscar o no hay archivos.</p>
                ) : (
                  <ul className="p-2 space-y-1">
                    {submitGoogleFiles.map((gf) => (
                      <li key={gf.id} className="flex items-center justify-between gap-3 p-3 rounded-lg hover:bg-white/10 text-white border border-transparent hover:border-white/10">
                        <span className="truncate text-sm flex-1 min-w-0">{gf.name}</span>
                        <Button type="button" size="sm" variant="outline" className="shrink-0 border-[#4DBBFF]/50 bg-[#4DBBFF]/10 text-[#4DBBFF] hover:bg-[#4DBBFF]/20 font-medium" onClick={() => handleSubmitAddFromGoogle(gf)}>Agregar</Button>
                      </li>
                    ))}
                  </ul>
                )}
              </ScrollArea>
              <DialogFooter className="gap-2 mt-4">
                <Button variant="outline" onClick={() => setSubmitAddFromGoogleOpen(false)} className="flex-1 border border-white/10 bg-transparent text-[13px] font-medium text-white/60 hover:bg-white/10">Cerrar</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={submitAddFromEvoOpen} onOpenChange={setSubmitAddFromEvoOpen}>
        <DialogContent className="bg-white/5 border border-white/10 max-w-[380px] rounded-2xl p-6 shadow-xl overflow-hidden">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-3">
              <div className="w-10 h-10 rounded-[11px] bg-[#4DBBFF]/20 flex items-center justify-center shrink-0"><Link2 className="w-5 h-5 text-[#4DBBFF]" /></div>
              <div>
                <span className="text-base font-semibold text-white block">Añadir enlace</span>
                <span className="text-xs text-white/60 mt-0.5 block">URL del recurso que quieres entregar</span>
              </div>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs font-medium text-white/60">Nombre (opcional)</Label>
              <Input value={submitEvoLinkName} onChange={(e) => setSubmitEvoLinkName(e.target.value)} placeholder="Ej: Mi trabajo" className="bg-white/5 border border-white/10 rounded-md py-2.5 px-3 text-sm text-white placeholder:text-white/50" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-medium text-white/60">URL *</Label>
              <Input value={submitEvoLinkUrl} onChange={(e) => setSubmitEvoLinkUrl(e.target.value)} placeholder="https://..." className="bg-white/5 border border-white/10 rounded-md py-2.5 px-3 text-sm text-white placeholder:text-white/50" />
            </div>
          </div>
          <DialogFooter className="gap-2 mt-6 grid grid-cols-[1fr_2fr]">
            <Button variant="outline" onClick={() => setSubmitAddFromEvoOpen(false)} className="border border-white/10 bg-transparent text-[13px] font-medium text-white/60 hover:bg-white/10">Cancelar</Button>
            <Button onClick={handleSubmitAddFromEvo} disabled={!submitEvoLinkUrl.trim()} className="bg-[#1a73e8] hover:bg-[#1558b0] text-white text-[13px] font-medium">Añadir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={submitCreateNewOpen} onOpenChange={setSubmitCreateNewOpen}>
        <DialogContent className="bg-white/5 border border-white/10 max-w-[380px] rounded-2xl p-6 shadow-xl overflow-hidden">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-3">
              <div className={`w-10 h-10 rounded-[11px] flex items-center justify-center shrink-0 ${submitCreateNewType === 'doc' ? 'bg-[#1a56d6]' : submitCreateNewType === 'slide' ? 'bg-[#d97706]' : 'bg-[#16a34a]'}`}>
                {submitCreateNewType === 'doc' && <FileText className="w-5 h-5 text-white" />}
                {submitCreateNewType === 'slide' && <Presentation className="w-5 h-5 text-white" />}
                {submitCreateNewType === 'sheet' && <FileSpreadsheet className="w-5 h-5 text-white" />}
              </div>
              <div>
                <span className="text-base font-semibold text-white block">
                  {submitCreateNewType === 'doc' && 'Nuevo documento'}
                  {submitCreateNewType === 'slide' && 'Nueva presentación'}
                  {submitCreateNewType === 'sheet' && 'Nueva hoja de cálculo'}
                </span>
                <span className="text-xs text-white/60 mt-0.5 block">Se creará en tu Google Drive y se añadirá a la entrega</span>
              </div>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label className="text-xs font-medium text-white/60">Nombre del archivo</Label>
              <Input value={submitCreateNewNombre} onChange={(e) => setSubmitCreateNewNombre(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSubmitCreateNew()} placeholder="Ej: Mi tarea" className="bg-white/5 border border-white/10 rounded-md py-2.5 px-3 text-sm text-white placeholder:text-white/50" autoFocus />
            </div>
          </div>
          <DialogFooter className="gap-2 mt-6 grid grid-cols-[1fr_2fr]">
            <Button variant="outline" onClick={() => { setSubmitCreateNewOpen(false); setSubmitCreateNewNombre(''); }} className="border border-white/10 bg-transparent text-[13px] font-medium text-white/60 hover:bg-white/10">Cancelar</Button>
            <Button onClick={handleSubmitCreateNew} disabled={!submitCreateNewNombre.trim() || createPersonalDocMutation.isPending} className="bg-[#1a73e8] hover:bg-[#1558b0] text-white text-[13px] font-medium">
              {createPersonalDocMutation.isPending ? 'Creando…' : 'Crear'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      </div>
    </div>
  );
}
