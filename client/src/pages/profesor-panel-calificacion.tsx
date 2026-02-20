import { useState } from 'react';
import { useAuth } from '@/lib/authContext';
import { useLocation, useParams } from 'wouter';
import { 
  GraduationCap, 
  FileText, 
  Clock, 
  CheckCircle2, 
  Star,
  User,
  Calendar,
  MessageSquare
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { NavBackButton } from '@/components/nav-back-button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface Attachment {
  tipo: 'pdf' | 'link' | 'imagen' | 'documento' | 'otro';
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
  curso: string;
  courseId?: string;
  fechaEntrega: string;
  profesorId: string;
  profesorNombre: string;
  submissions?: Submission[];
  estado?: 'pendiente' | 'entregada' | 'calificada';
}

export default function ProfesorPanelCalificacionPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const params = useParams<{ cursoId: string }>();
  const { toast } = useToast();
  const cursoId = params?.cursoId || '';

  const [gradingData, setGradingData] = useState<Record<string, {
    calificacion: string;
    retroalimentacion: string;
    logro?: string;
  }>>({});

  // Obtener tareas del curso con estado "entregada"
  const { data: assignments = [], isLoading, refetch } = useQuery<Assignment[]>({
    queryKey: ['courseAssignments', cursoId, 'entregada'],
    queryFn: async () => {
      const result = await apiRequest('GET', `/api/assignments?groupId=${cursoId}&estado=entregada`);
      return result;
    },
    enabled: !!cursoId && !!user?.id,
    staleTime: 0,
  });

  // Obtener todas las tareas del curso (incluyendo calificadas) para mostrar en el tab de calificadas
  const { data: allAssignments = [] } = useQuery<Assignment[]>({
    queryKey: ['courseAssignments', cursoId, 'all'],
    queryFn: async () => {
      const result = await apiRequest('GET', `/api/assignments?groupId=${cursoId}`);
      return result;
    },
    enabled: !!cursoId && !!user?.id,
    staleTime: 0,
  });

  const gradeMutation = useMutation({
    mutationFn: async ({ assignmentId, estudianteId, data }: {
      assignmentId: string;
      estudianteId: string;
      data: { calificacion: number; retroalimentacion?: string; logro?: string };
    }) => {
      try {
        const response = await apiRequest('PUT', `/api/assignments/${assignmentId}/grade`, {
          estudianteId,
          calificacion: data.calificacion,
          retroalimentacion: data.retroalimentacion || undefined,
          logro: data.logro || undefined,
        });
        return response;
      } catch (error: any) {
        console.error('Error en gradeMutation:', error);
        throw error;
      }
    },
    onSuccess: (data, variables) => {
      toast({ 
        title: 'Tarea calificada exitosamente',
        description: 'La nota se ha registrado automáticamente en el módulo de notas.'
      });
      queryClient.invalidateQueries({ queryKey: ['courseAssignments', cursoId] });
      queryClient.invalidateQueries({ queryKey: ['/api/assignments'] });
      queryClient.invalidateQueries({ queryKey: ['gradeTableAssignments'] });
      queryClient.invalidateQueries({ queryKey: ['assignments'] });
      queryClient.invalidateQueries({ queryKey: ['studentNotes'] });
      refetch();
      // Limpiar datos del formulario para esta submission específica
      // Usar variables.assignmentId que viene de la mutación
      const submissionKey = Object.keys(gradingData).find(key => key.includes(variables.assignmentId));
      if (submissionKey) {
        setGradingData(prev => {
          const newData = { ...prev };
          delete newData[submissionKey];
          return newData;
        });
      }
    },
    onError: (error: any) => {
      console.error('Error al calificar:', error);
      const errorMessage = error?.response?.data?.message || error?.message || 'No se pudo calificar la tarea';
      toast({ 
        title: 'Error al calificar',
        description: errorMessage,
        variant: 'destructive'
      });
    },
  });

  const handleGrade = (assignmentId: string, estudianteId: string, submissionKey: string) => {
    const data = gradingData[submissionKey];
    if (!data || !data.calificacion) {
      toast({
        title: 'Error',
        description: 'Por favor ingresa una calificación',
        variant: 'destructive'
      });
      return;
    }

    const calificacion = parseFloat(data.calificacion);
    if (isNaN(calificacion) || calificacion < 0 || calificacion > 100) {
      toast({
        title: 'Error',
        description: 'La calificación debe ser un número entre 0 y 100',
        variant: 'destructive'
      });
      return;
    }

    // Asegurar que estudianteId sea un string
    const estudianteIdStr = String(estudianteId);
    
    console.log('Calificando tarea:', {
      assignmentId,
      estudianteId: estudianteIdStr,
      calificacion,
      retroalimentacion: data.retroalimentacion,
      logro: data.logro
    });

    gradeMutation.mutate({
      assignmentId,
      estudianteId: estudianteIdStr,
      data: {
        calificacion,
        retroalimentacion: data.retroalimentacion?.trim() || undefined,
        logro: data.logro?.trim() || undefined,
      },
    });
  };

  const updateGradingData = (submissionKey: string, field: string, value: string) => {
    setGradingData(prev => ({
      ...prev,
      [submissionKey]: {
        ...(prev[submissionKey] || {}),
        [field]: value,
      },
    }));
  };

  // Filtrar tareas entregadas (sin calificar)
  const entregadasAssignments = assignments.filter(assignment => {
    if (!assignment.submissions || assignment.submissions.length === 0) return false;
    return assignment.submissions.some(s => !s.calificacion && s.calificacion !== 0);
  });

  // Filtrar tareas calificadas
  const calificadasAssignments = allAssignments.filter(assignment => {
    if (!assignment.submissions || assignment.submissions.length === 0) return false;
    return assignment.submissions.some(s => s.calificacion !== undefined && s.calificacion !== null);
  });

  if (isLoading) {
    return (
      <div className="flex-1 overflow-auto p-6 md:p-10">
        <div className="max-w-7xl mx-auto">
          <div className="text-white">Cargando tareas...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto p-6 md:p-10">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <NavBackButton to="/profesor/academia/tareas/revision" label="Revisión de Asignaciones" />
          <h1 className="text-4xl font-bold text-white mb-2 font-['Poppins'] mt-4">
            Panel de Calificación
          </h1>
          <p className="text-white/60">
            Curso: <span className="text-[#00c8ff] font-semibold">{cursoId.toUpperCase()}</span>
          </p>
        </div>

        <Tabs defaultValue="entregadas" className="w-full">
          <TabsList className="bg-white/5 border border-white/10 mb-6">
            <TabsTrigger value="entregadas" className="data-[state=active]:bg-[#00c8ff] data-[state=active]:text-white">
              Por Calificar ({entregadasAssignments.length})
            </TabsTrigger>
            <TabsTrigger value="calificadas" className="data-[state=active]:bg-[#00c8ff] data-[state=active]:text-white">
              Calificadas ({calificadasAssignments.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="entregadas">
            {entregadasAssignments.length === 0 ? (
              <Card className="bg-white/5 border-white/10 backdrop-blur-md">
                <CardContent className="p-12 text-center">
                  <CheckCircle2 className="w-16 h-16 text-[#00c8ff]/40 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-white mb-2">
                    No hay tareas pendientes de calificación
                  </h3>
                  <p className="text-white/60">
                    Todas las tareas entregadas han sido calificadas.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-6">
                {entregadasAssignments.map((assignment) => (
                  <Card key={assignment._id} className="bg-white/5 border-white/10 backdrop-blur-md">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="text-white text-xl mb-2">{assignment.titulo}</CardTitle>
                          <CardDescription className="text-white/60">
                            {assignment.descripcion}
                          </CardDescription>
                          <div className="flex items-center gap-4 mt-3 text-sm text-white/60">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-4 h-4" />
                              {new Date(assignment.fechaEntrega).toLocaleDateString('es-CO')}
                            </span>
                            <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/40">
                              {assignment.submissions?.filter(s => !s.calificacion && s.calificacion !== 0).length || 0} entregas pendientes
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {assignment.submissions
                        ?.filter(s => !s.calificacion && s.calificacion !== 0)
                        .map((submission) => {
                          const submissionKey = `${assignment._id}-${submission.estudianteId}`;
                          const currentData = gradingData[submissionKey] || { calificacion: '', retroalimentacion: '', logro: '' };
                          
                          return (
                            <div
                              key={submission.estudianteId}
                              className="p-4 bg-white/5 rounded-lg border border-white/10"
                            >
                              <div className="flex items-start justify-between mb-4">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-2">
                                    <User className="w-4 h-4 text-[#00c8ff]" />
                                    <h4 className="font-semibold text-white">{submission.estudianteNombre}</h4>
                                  </div>
                                  <div className="flex items-center gap-4 text-sm text-white/60 mb-3">
                                    <span className="flex items-center gap-1">
                                      <Clock className="w-4 h-4" />
                                      Entregado: {new Date(submission.fechaEntrega).toLocaleString('es-CO')}
                                    </span>
                                  </div>
                                  {submission.comentario && (
                                    <div className="mb-3 p-3 bg-white/5 rounded border-l-4 border-[#00c8ff]/50">
                                      <div className="flex items-center gap-2 mb-1">
                                        <MessageSquare className="w-4 h-4 text-[#00c8ff]" />
                                        <span className="text-sm font-semibold text-white/80">Comentario del estudiante:</span>
                                      </div>
                                      <p className="text-sm text-white/70">{submission.comentario}</p>
                                    </div>
                                  )}
                                  {submission.archivos && submission.archivos.length > 0 && (
                                    <div className="mb-3">
                                      <p className="text-sm font-semibold text-white/80 mb-2">Archivos entregados:</p>
                                      <div className="space-y-2">
                                        {submission.archivos.map((archivo, idx) => (
                                          <a
                                            key={idx}
                                            href={archivo.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center gap-2 p-2 bg-white/5 rounded hover:bg-white/10 transition-colors"
                                          >
                                            <FileText className="w-4 h-4 text-[#00c8ff]" />
                                            <span className="text-sm text-white">{archivo.nombre}</span>
                                          </a>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 pt-4 border-t border-white/10">
                                <div>
                                  <Label htmlFor={`calificacion-${submissionKey}`} className="text-white/80">
                                    Calificación (0-100) *
                                  </Label>
                                  <Input
                                    id={`calificacion-${submissionKey}`}
                                    type="number"
                                    min="0"
                                    max="100"
                                    value={currentData.calificacion}
                                    onChange={(e) => updateGradingData(submissionKey, 'calificacion', e.target.value)}
                                    className="bg-white/5 border-white/10 text-white mt-1"
                                    placeholder="0-100"
                                  />
                                </div>
                                <div>
                                  <Label htmlFor={`logro-${submissionKey}`} className="text-white/80">
                                    Logro (opcional)
                                  </Label>
                                  <Input
                                    id={`logro-${submissionKey}`}
                                    type="text"
                                    value={currentData.logro || ''}
                                    onChange={(e) => updateGradingData(submissionKey, 'logro', e.target.value)}
                                    className="bg-white/5 border-white/10 text-white mt-1"
                                    placeholder="Ej: Excelente"
                                  />
                                </div>
                                <div className="flex items-end">
                                  <Button
                                    onClick={() => handleGrade(assignment._id, submission.estudianteId, submissionKey)}
                                    disabled={gradeMutation.isPending || !currentData.calificacion}
                                    className="w-full bg-gradient-to-r from-[#002366] to-[#1e3cff] hover:opacity-90"
                                  >
                                    <GraduationCap className="w-4 h-4 mr-2" />
                                    {gradeMutation.isPending ? 'Calificando...' : 'Calificar y Devolver'}
                                  </Button>
                                </div>
                              </div>
                              <div className="mt-4">
                                <Label htmlFor={`retroalimentacion-${submissionKey}`} className="text-white/80">
                                  Retroalimentación (opcional)
                                </Label>
                                <Textarea
                                  id={`retroalimentacion-${submissionKey}`}
                                  value={currentData.retroalimentacion || ''}
                                  onChange={(e) => updateGradingData(submissionKey, 'retroalimentacion', e.target.value)}
                                  className="bg-white/5 border-white/10 text-white mt-1 min-h-[100px]"
                                  placeholder="Escribe comentarios para el estudiante..."
                                />
                              </div>
                            </div>
                          );
                        })}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="calificadas">
            {calificadasAssignments.length === 0 ? (
              <Card className="bg-white/5 border-white/10 backdrop-blur-md">
                <CardContent className="p-12 text-center">
                  <Star className="w-16 h-16 text-[#00c8ff]/40 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-white mb-2">
                    No hay tareas calificadas
                  </h3>
                  <p className="text-white/60">
                    Las tareas que califiques aparecerán aquí.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-6">
                {calificadasAssignments.map((assignment) => (
                  <Card key={assignment._id} className="bg-white/5 border-white/10 backdrop-blur-md">
                    <CardHeader>
                      <CardTitle className="text-white text-xl mb-2">{assignment.titulo}</CardTitle>
                      <CardDescription className="text-white/60">
                        {assignment.descripcion}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {assignment.submissions
                          ?.filter(s => s.calificacion !== undefined && s.calificacion !== null)
                          .map((submission) => (
                            <div
                              key={submission.estudianteId}
                              className="p-4 bg-white/5 rounded-lg border border-white/10"
                            >
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-2">
                                    <User className="w-4 h-4 text-[#00c8ff]" />
                                    <h4 className="font-semibold text-white">{submission.estudianteNombre}</h4>
                                  </div>
                                  <div className="flex items-center gap-4 mb-3">
                                    <Badge className="bg-green-500/20 text-green-400 border-green-500/40">
                                      <Star className="w-3 h-3 mr-1" />
                                      {submission.calificacion}/100
                                    </Badge>
                                    <span className="text-sm text-white/60">
                                      Calificado: {new Date(submission.fechaEntrega).toLocaleDateString('es-CO')}
                                    </span>
                                  </div>
                                  {submission.retroalimentacion && (
                                    <div className="p-3 bg-white/5 rounded border-l-4 border-[#00c8ff]/50">
                                      <p className="text-sm text-white/70">{submission.retroalimentacion}</p>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
