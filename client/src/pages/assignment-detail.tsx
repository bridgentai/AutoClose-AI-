import { useState, useMemo } from 'react';
import { useAuth } from '@/lib/authContext';
import { Calendar, Clock, FileText, Link2, Paperclip, X, Edit, Check, Users, Send, Maximize2, UserX } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useLocation, useParams } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { NavBackButton } from '@/components/nav-back-button';
import { DocumentEditor } from '@/components/document-editor';

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

interface Assignment {
  _id: string;
  titulo: string;
  descripcion: string;
  contenidoDocumento?: string;
  curso: string;
  courseId?: string;
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
    onSuccess: () => {
      toast({ title: 'Entrega enviada exitosamente' });
      setSubmitData({ comentario: '' });
      setSubmitArchivos([]);
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
      toast({ title: 'Tarea calificada exitosamente' });
      setGradingStudent(null);
      setGradeData({ calificacion: '', retroalimentacion: '', logro: '' });
      queryClient.invalidateQueries({ queryKey: ['/api/assignments', params.id] });
      queryClient.invalidateQueries({ queryKey: ['assignments'] });
      queryClient.invalidateQueries({ queryKey: ['studentNotes'] }); // Invalidar notas del estudiante
      queryClient.invalidateQueries({ queryKey: ['studentAssignments'] }); // Invalidar tareas del estudiante
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submitAssignmentMutation.mutate({
      archivos: submitArchivos,
      comentario: submitData.comentario,
    });
  };

  const { data: hijos = [] } = useQuery<{ _id: string; nombre: string }[]>({
    queryKey: ['/api/users/me/hijos'],
    queryFn: () => apiRequest('GET', '/api/users/me/hijos'),
    enabled: !!user?.id && isPadre,
  });
  const primerHijoId = hijos[0]?._id;
  const nombreHijo = hijos[0]?.nombre || 'tu hijo/a';

  // Estudiantes del curso/grupo de la tarea (para sección Pendiente en vista profesor)
  const cursoNombre = assignment?.curso?.trim() ?? '';
  const { data: groupStudents = [] } = useQuery<{ _id: string; nombre: string; estado?: string }[]>({
    queryKey: ['/api/groups', cursoNombre, 'students'],
    queryFn: () => apiRequest('GET', `/api/groups/${encodeURIComponent(cursoNombre)}/students`),
    enabled: isProfesor && !!cursoNombre,
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
                <Tabs defaultValue="info" className="w-full">
                  <TabsList className="bg-white/5 border border-white/10 mb-6">
                    <TabsTrigger value="info" className="data-[state=active]:bg-[#1e3cff]">Información</TabsTrigger>
                    <TabsTrigger value="entregas" className="data-[state=active]:bg-[#1e3cff]">
                      Entregas ({submissions.length})
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
                              <Badge className="bg-[#1e3cff]">{assignment.curso}</Badge>
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
                            assignment.adjuntos && assignment.adjuntos.length > 0 ? (
                              <div className="space-y-2">
                                {assignment.adjuntos.map((adj, index) => (
                                  <a
                                    key={index}
                                    href={adj.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-2 p-3 bg-white/5 rounded-lg hover:bg-white/10 transition-colors"
                                    data-testid={`adjunto-${index}`}
                                  >
                                    {adj.tipo === 'link' ? <Link2 className="w-4 h-4 text-[#1e3cff]" /> : <FileText className="w-4 h-4 text-[#1e3cff]" />}
                                    <span className="text-white">{adj.nombre}</span>
                                  </a>
                                ))}
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
                          {submissions.length} han entregado · {pendingStudents.length} pendientes
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-8">
                        {submissions.length > 0 && (
                          <div>
                            <h4 className="text-sm font-semibold text-white/80 mb-3 flex items-center gap-2">
                              <Check className="w-4 h-4 text-green-500" />
                              Han entregado ({submissions.length})
                            </h4>
                            <div className="space-y-4">
                              {submissions.map((submission, index) => (
                              <div key={index} className="p-4 bg-white/5 rounded-lg border border-white/10">
                                <div className="flex items-start justify-between mb-3">
                                  <div className="flex-1">
                                    <h4 className="font-semibold text-white">{submission.estudianteNombre}</h4>
                                    <p className="text-sm text-white/50">
                                      Entregado: {new Date(submission.fechaEntrega).toLocaleString('es-CO')}
                                    </p>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {submission.calificacion !== undefined && (
                                      <Badge className="bg-green-600">{submission.calificacion}/100</Badge>
                                    )}
                                    {submission.calificacion === undefined && (
                                      <Button
                                        size="sm"
                                        onClick={() => handleGrade(submission.estudianteId)}
                                        className="bg-[#1e3cff] hover:bg-[#002366]"
                                      >
                                        Calificar
                                      </Button>
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
                                        <FileText className="w-4 h-4 text-[#1e3cff]" />
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
                                  <form onSubmit={handleSubmitGrade} className="mt-4 p-4 bg-white/5 rounded-lg border border-[#1e3cff]/30">
                                    <div className="space-y-3">
                                      <div>
                                        <Label className="text-white/60 mb-1 block">Calificación (0-100) *</Label>
                                        <Input
                                          type="number"
                                          min="0"
                                          max="100"
                                          value={gradeData.calificacion}
                                          onChange={(e) => setGradeData({ ...gradeData, calificacion: e.target.value })}
                                          className="bg-white/5 border-white/10 text-white"
                                          required
                                        />
                                      </div>
                                      <div>
                                        <Label className="text-white/60 mb-1 block">Retroalimentación</Label>
                                        <Textarea
                                          value={gradeData.retroalimentacion}
                                          onChange={(e) => setGradeData({ ...gradeData, retroalimentacion: e.target.value })}
                                          className="bg-white/5 border-white/10 text-white"
                                          rows={3}
                                        />
                                      </div>
                                      <div>
                                        <Label className="text-white/60 mb-1 block">Logro (opcional)</Label>
                                        <Input
                                          value={gradeData.logro}
                                          onChange={(e) => setGradeData({ ...gradeData, logro: e.target.value })}
                                          className="bg-white/5 border-white/10 text-white"
                                          placeholder="Ej: Superado, En proceso..."
                                        />
                                      </div>
                                      <div className="flex gap-2">
                                        <Button
                                          type="submit"
                                          disabled={gradeAssignmentMutation.isPending}
                                          className="bg-[#1e3cff] hover:bg-[#002366]"
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
                                          className="border-white/10 text-white hover:bg-white/10"
                                        >
                                          Cancelar
                                        </Button>
                                      </div>
                                    </div>
                                  </form>
                                )}
                              </div>
                            ))}
                            </div>
                          </div>
                        )}

                        <div>
                          <h4 className="text-sm font-semibold text-white/80 mb-3 flex items-center gap-2">
                            <UserX className="w-4 h-4 text-amber-500" />
                            Pendiente ({pendingStudents.length})
                          </h4>
                          {pendingStudents.length > 0 ? (
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
                        <Badge className="bg-[#1e3cff]">{assignment.curso}</Badge>
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

                  {/* Recursos adjuntos */}
                  {assignment.adjuntos && Array.isArray(assignment.adjuntos) && assignment.adjuntos.length > 0 && (
                    <Card className="bg-white/5 border-white/10 backdrop-blur-md">
                      <CardHeader>
                        <CardTitle className="text-white text-lg">Recursos Adicionales</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {assignment.adjuntos.map((adj, index) => {
                            // Manejar tanto objetos Attachment como strings
                            const adjunto = typeof adj === 'string' 
                              ? { tipo: 'link' as const, nombre: adj, url: adj }
                              : adj;
                            return (
                              <a
                                key={index}
                                href={adjunto.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 p-3 bg-white/5 rounded-lg hover:bg-white/10 transition-colors"
                                data-testid={`adjunto-${index}`}
                              >
                                {adjunto.tipo === 'link' ? <Link2 className="w-4 h-4 text-[#1e3cff]" /> : <FileText className="w-4 h-4 text-[#1e3cff]" />}
                                <span className="text-white">{adjunto.nombre}</span>
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
                      ) : mySubmission ? (
                        <div className="space-y-4">
                          {mySubmission.comentario && (
                            <div>
                              <Label className="text-white/60 mb-1 block">Tu comentario:</Label>
                              <p className="text-white">{mySubmission.comentario}</p>
                            </div>
                          )}
                          {mySubmission.archivos && mySubmission.archivos.length > 0 && (
                            <div>
                              <Label className="text-white/60 mb-2 block">Archivos entregados:</Label>
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
                            </div>
                          )}
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
                              setSubmitArchivos(mySubmission.archivos || []);
                            }}
                            variant="outline"
                            className="w-full border-white/10 text-white hover:bg-white/10"
                          >
                            Actualizar Entrega
                          </Button>
                        </div>
                      ) : (
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

                          <div>
                            <Label className="text-white/60 mb-2 block">Archivos</Label>
                            {submitArchivos.length > 0 && (
                              <div className="space-y-2 mb-3">
                                {submitArchivos.map((archivo, index) => (
                                  <div key={index} className="flex items-center gap-2 p-2 bg-white/5 rounded-lg">
                                    <FileText className="w-4 h-4 text-[#1e3cff]" />
                                    <span className="flex-1 text-sm text-white truncate">{archivo.nombre}</span>
                                    <Button
                                      type="button"
                                      size="icon"
                                      variant="ghost"
                                      onClick={() => setSubmitArchivos(submitArchivos.filter((_, i) => i !== index))}
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
                                value={newSubmitAttachment.tipo}
                                onValueChange={(value) => setNewSubmitAttachment({ ...newSubmitAttachment, tipo: value as 'pdf' | 'link' | 'imagen' | 'documento' | 'otro' })}
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
                                value={newSubmitAttachment.nombre}
                                onChange={(e) => setNewSubmitAttachment({ ...newSubmitAttachment, nombre: e.target.value })}
                                className="bg-white/5 border-white/10 text-white"
                              />
                              <Input
                                placeholder="URL"
                                value={newSubmitAttachment.url}
                                onChange={(e) => setNewSubmitAttachment({ ...newSubmitAttachment, url: e.target.value })}
                                className="bg-white/5 border-white/10 text-white flex-1"
                              />
                              <Button
                                type="button"
                                variant="outline"
                                onClick={handleAddSubmitAttachment}
                                className="border-white/10 text-white hover:bg-white/10"
                              >
                                <Paperclip className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>

                          <Button
                            type="submit"
                            disabled={submitAssignmentMutation.isPending}
                            className="w-full bg-gradient-to-r from-[#002366] to-[#1e3cff] hover:opacity-90"
                            data-testid="button-submit-entrega"
                          >
                            <Send className="w-4 h-4 mr-2" />
                            {submitAssignmentMutation.isPending ? 'Enviando...' : 'Enviar Entrega'}
                          </Button>
                        </form>
                      )}
                    </CardContent>
                  </Card>
                </div>
              )}
      </div>
    </div>
  );
}
