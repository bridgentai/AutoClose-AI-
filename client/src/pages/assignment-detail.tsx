import { useState } from 'react';
import { useAuth } from '@/lib/authContext';
import { ArrowLeft, Calendar, Clock, FileText, Link2, Paperclip, X, Edit, Check, Users } from 'lucide-react';
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
}

interface Assignment {
  _id: string;
  titulo: string;
  descripcion: string;
  curso: string;
  courseId?: string;
  fechaEntrega: string;
  profesorId: string;
  profesorNombre: string;
  adjuntos: Attachment[];
  entregas: Submission[];
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

  const isProfesor = user?.rol === 'profesor';

  const { data: assignment, isLoading, refetch } = useQuery<Assignment>({
    queryKey: ['/api/assignments', params.id],
    enabled: !!params.id,
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
      refetch();
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message || 'No se pudo enviar la entrega', variant: 'destructive' });
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

  const mySubmission = assignment?.entregas?.find(e => e.estudianteId === user?.id);
  const isPastDue = assignment ? new Date(assignment.fechaEntrega) < new Date() : false;

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-white">Cargando...</div>
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
              {isProfesor ? (
                <Tabs defaultValue="info" className="w-full">
                  <TabsList className="bg-white/5 border border-white/10 mb-6">
                    <TabsTrigger value="info" className="data-[state=active]:bg-[#9f25b8]">Información</TabsTrigger>
                    <TabsTrigger value="entregas" className="data-[state=active]:bg-[#9f25b8]">
                      Entregas ({assignment.entregas?.length || 0})
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
                              <Badge className="bg-[#9f25b8]">{assignment.curso}</Badge>
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
                            <Button
                              variant="outline"
                              onClick={startEditing}
                              className="border-white/10 text-white hover:bg-white/10"
                              data-testid="button-edit"
                            >
                              <Edit className="w-4 h-4 mr-2" />
                              Editar
                            </Button>
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
                                className="bg-gradient-to-r from-[#9f25b8] to-[#6a0dad]"
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

                        <div>
                          <Label className="text-white/60 mb-2 block">Adjuntos</Label>
                          {isEditing ? (
                            <div className="space-y-3">
                              {editAdjuntos.map((adj, index) => (
                                <div key={index} className="flex items-center gap-2 p-2 bg-white/5 rounded-lg">
                                  {adj.tipo === 'link' ? <Link2 className="w-4 h-4 text-[#9f25b8]" /> : <FileText className="w-4 h-4 text-[#9f25b8]" />}
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
                                  <SelectContent className="bg-[#1a001c] border-white/10">
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
                                    {adj.tipo === 'link' ? <Link2 className="w-4 h-4 text-[#9f25b8]" /> : <FileText className="w-4 h-4 text-[#9f25b8]" />}
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
                          <Users className="w-5 h-5 text-[#9f25b8]" />
                          Entregas de Estudiantes
                        </CardTitle>
                        <CardDescription className="text-white/60">
                          {assignment.entregas?.length || 0} estudiantes han entregado
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        {assignment.entregas && assignment.entregas.length > 0 ? (
                          <div className="space-y-4">
                            {assignment.entregas.map((entrega, index) => (
                              <div key={index} className="p-4 bg-white/5 rounded-lg border border-white/10">
                                <div className="flex items-start justify-between mb-3">
                                  <div>
                                    <h4 className="font-semibold text-white">{entrega.estudianteNombre}</h4>
                                    <p className="text-sm text-white/50">
                                      Entregado: {new Date(entrega.fechaEntrega).toLocaleString('es-CO')}
                                    </p>
                                  </div>
                                  {entrega.calificacion !== undefined && (
                                    <Badge className="bg-green-600">{entrega.calificacion}/100</Badge>
                                  )}
                                </div>
                                {entrega.comentario && (
                                  <p className="text-white/70 text-sm mb-3">{entrega.comentario}</p>
                                )}
                                {entrega.archivos && entrega.archivos.length > 0 && (
                                  <div className="space-y-2">
                                    {entrega.archivos.map((archivo, idx) => (
                                      <a
                                        key={idx}
                                        href={archivo.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-2 p-2 bg-white/5 rounded hover:bg-white/10 transition-colors"
                                      >
                                        <FileText className="w-4 h-4 text-[#9f25b8]" />
                                        <span className="text-sm text-white">{archivo.nombre}</span>
                                      </a>
                                    ))}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-white/50 text-center py-8">Aún no hay entregas</p>
                        )}
                      </CardContent>
                    </Card>
                  </TabsContent>
                </Tabs>
              ) : (
                <div className="space-y-6">
                  <Card className="bg-white/5 border-white/10 backdrop-blur-md">
                    <CardHeader>
                      <CardTitle className="text-2xl font-bold text-white mb-2">{assignment.titulo}</CardTitle>
                      <div className="flex flex-wrap items-center gap-4 text-white/60">
                        <Badge className="bg-[#9f25b8]">{assignment.curso}</Badge>
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
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div>
                        <Label className="text-white/60 mb-2 block">Descripción</Label>
                        <p className="text-white whitespace-pre-wrap">{assignment.descripcion}</p>
                      </div>

                      {assignment.adjuntos && assignment.adjuntos.length > 0 && (
                        <div>
                          <Label className="text-white/60 mb-2 block">Recursos</Label>
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
                                {adj.tipo === 'link' ? <Link2 className="w-4 h-4 text-[#9f25b8]" /> : <FileText className="w-4 h-4 text-[#9f25b8]" />}
                                <span className="text-white">{adj.nombre}</span>
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card className="bg-white/5 border-white/10 backdrop-blur-md">
                    <CardHeader>
                      <CardTitle className="text-white">
                        {mySubmission ? 'Tu Entrega' : 'Enviar Entrega'}
                      </CardTitle>
                      <CardDescription className="text-white/60">
                        {mySubmission 
                          ? `Entregaste el ${new Date(mySubmission.fechaEntrega).toLocaleString('es-CO')}`
                          : 'Adjunta tus archivos y envía tu trabajo'
                        }
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {mySubmission ? (
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
                                    <FileText className="w-4 h-4 text-[#9f25b8]" />
                                    <span className="text-sm text-white">{archivo.nombre}</span>
                                  </a>
                                ))}
                              </div>
                            </div>
                          )}
                          {mySubmission.calificacion !== undefined && (
                            <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
                              <p className="text-green-400 font-semibold">Calificación: {mySubmission.calificacion}/100</p>
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
                                    <FileText className="w-4 h-4 text-[#9f25b8]" />
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
                                <SelectContent className="bg-[#1a001c] border-white/10">
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
                            className="w-full bg-gradient-to-r from-[#9f25b8] to-[#6a0dad] hover:opacity-90"
                            data-testid="button-submit-entrega"
                          >
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
