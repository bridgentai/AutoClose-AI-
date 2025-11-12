import { useAuth } from '@/lib/authContext';
import { AppSidebar } from '@/components/app-sidebar';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { BookOpen, User, Calendar, ArrowLeft, Clock, CheckCircle2, Circle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useLocation, useRoute } from 'wouter';
import { useQuery } from '@tanstack/react-query';

interface Assignment {
  _id: string;
  titulo: string;
  descripcion: string;
  fechaEntrega: Date;
  profesorNombre: string;
  createdAt: Date;
}

interface SubjectOverview {
  _id: string;
  nombre: string;
  descripcion?: string;
  colorAcento: string;
  icono?: string;
  profesor: {
    _id: string;
    nombre: string;
    email: string;
  };
  assignments: {
    pending: Assignment[];
    past: Assignment[];
  };
  stats: {
    totalAssignments: number;
    pendingCount: number;
    pastCount: number;
  };
}

export default function SubjectDetailPage() {
  const [, params] = useRoute('/subject/:id');
  const subjectId = params?.id || '';
  const [, setLocation] = useLocation();

  const { data: subject, isLoading } = useQuery<SubjectOverview>({
    queryKey: ['/api/subjects', subjectId, 'overview'],
    enabled: !!subjectId,
  });

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('es-CO', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  const getDaysUntil = (date: Date) => {
    const today = new Date();
    const dueDate = new Date(date);
    const diffTime = dueDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return null;
    if (diffDays === 0) return 'Hoy';
    if (diffDays === 1) return 'Mañana';
    return `En ${diffDays} días`;
  };

  return (
    <SidebarProvider>
      <div className="flex h-screen w-full bg-gradient-to-br from-[#0a0a0c] via-[#1a001c] to-[#3d0045]">
        <AppSidebar />
        <SidebarInset className="flex flex-col flex-1">
          <header className="flex items-center justify-between p-4 border-b border-white/10 backdrop-blur-xl bg-black/20">
            <div className="flex items-center gap-3">
              <SidebarTrigger data-testid="button-sidebar-toggle" className="text-white" />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setLocation('/subjects')}
                className="text-white hover:bg-white/10"
                data-testid="button-back"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <h1 className="text-xl font-bold text-white font-['Poppins']">
                Detalle de Materia
              </h1>
            </div>
            <Button
              onClick={() => setLocation('/calendar')}
              variant="ghost"
              className="text-white hover:bg-white/10"
              data-testid="button-calendar"
            >
              <Calendar className="w-4 h-4 mr-2" />
              Ver Calendario
            </Button>
          </header>

          <main className="flex-1 overflow-auto p-8">
            <div className="max-w-5xl mx-auto">
              {isLoading ? (
                <div className="space-y-6">
                  <div className="bg-white/5 border border-white/10 rounded-xl h-48 animate-pulse" />
                  <div className="bg-white/5 border border-white/10 rounded-xl h-96 animate-pulse" />
                </div>
              ) : subject ? (
                <>
                  {/* Header de la materia */}
                  <Card className="bg-white/5 border-white/10 backdrop-blur-md mb-8">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-4">
                          <div 
                            className="w-20 h-20 rounded-2xl flex items-center justify-center"
                            style={{ 
                              background: `linear-gradient(135deg, ${subject.colorAcento || '#9f25b8'}, ${subject.colorAcento ? subject.colorAcento + '80' : '#6a0dad'})` 
                            }}
                          >
                            <BookOpen className="w-10 h-10 text-white" />
                          </div>
                          <div>
                            <CardTitle className="text-white text-3xl font-bold mb-2">
                              {subject.nombre}
                            </CardTitle>
                            {subject.descripcion && (
                              <CardDescription className="text-white/60 text-base">
                                {subject.descripcion}
                              </CardDescription>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="flex items-center gap-3 p-4 bg-white/5 rounded-xl">
                          <User className="w-5 h-5 text-[#9f25b8]" />
                          <div>
                            <p className="text-white/60 text-sm">Profesor</p>
                            <p className="text-white font-medium">{subject.profesor.nombre}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 p-4 bg-white/5 rounded-xl">
                          <Circle className="w-5 h-5 text-yellow-500" />
                          <div>
                            <p className="text-white/60 text-sm">Tareas Pendientes</p>
                            <p className="text-white font-medium">{subject.stats.pendingCount}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 p-4 bg-white/5 rounded-xl">
                          <CheckCircle2 className="w-5 h-5 text-green-500" />
                          <div>
                            <p className="text-white/60 text-sm">Tareas Completadas</p>
                            <p className="text-white font-medium">{subject.stats.pastCount}</p>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Tareas Pendientes */}
                  <Card className="bg-white/5 border-white/10 backdrop-blur-md mb-8">
                    <CardHeader>
                      <CardTitle className="text-white flex items-center gap-2">
                        <Clock className="w-5 h-5 text-yellow-500" />
                        Tareas Pendientes ({subject.stats.pendingCount})
                      </CardTitle>
                      <CardDescription className="text-white/60">
                        Tareas próximas a vencer
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {subject.assignments.pending.length === 0 ? (
                        <div className="text-center py-8">
                          <CheckCircle2 className="w-12 h-12 text-green-500/50 mx-auto mb-3" />
                          <p className="text-white/60">No hay tareas pendientes</p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {subject.assignments.pending.map((assignment) => (
                            <div
                              key={assignment._id}
                              className="p-4 bg-white/5 rounded-xl hover:bg-white/10 transition-colors"
                              data-testid={`assignment-pending-${assignment._id}`}
                            >
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <h3 className="text-white font-medium mb-1">{assignment.titulo}</h3>
                                  <p className="text-white/60 text-sm mb-3 line-clamp-2">{assignment.descripcion}</p>
                                  <div className="flex items-center gap-4 text-sm">
                                    <div className="flex items-center gap-1 text-white/60">
                                      <Calendar className="w-4 h-4" />
                                      <span>{formatDate(assignment.fechaEntrega)}</span>
                                    </div>
                                    {getDaysUntil(assignment.fechaEntrega) && (
                                      <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
                                        {getDaysUntil(assignment.fechaEntrega)}
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Tareas Pasadas */}
                  <Card className="bg-white/5 border-white/10 backdrop-blur-md">
                    <CardHeader>
                      <CardTitle className="text-white flex items-center gap-2">
                        <CheckCircle2 className="w-5 h-5 text-green-500" />
                        Tareas Completadas ({subject.stats.pastCount})
                      </CardTitle>
                      <CardDescription className="text-white/60">
                        Historial de tareas
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {subject.assignments.past.length === 0 ? (
                        <div className="text-center py-8">
                          <Circle className="w-12 h-12 text-white/20 mx-auto mb-3" />
                          <p className="text-white/60">No hay tareas completadas aún</p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {subject.assignments.past.slice(0, 10).map((assignment) => (
                            <div
                              key={assignment._id}
                              className="p-4 bg-white/5 rounded-xl hover:bg-white/10 transition-colors opacity-75"
                              data-testid={`assignment-past-${assignment._id}`}
                            >
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <h3 className="text-white font-medium mb-1">{assignment.titulo}</h3>
                                  <p className="text-white/60 text-sm mb-3 line-clamp-2">{assignment.descripcion}</p>
                                  <div className="flex items-center gap-1 text-sm text-white/60">
                                    <Calendar className="w-4 h-4" />
                                    <span>{formatDate(assignment.fechaEntrega)}</span>
                                  </div>
                                </div>
                                <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-1" />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </>
              ) : (
                <Card className="bg-white/5 border-white/10 backdrop-blur-md">
                  <CardContent className="p-12 text-center">
                    <BookOpen className="w-16 h-16 text-white/40 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold text-white mb-2">Materia no encontrada</h3>
                    <p className="text-white/60 mb-6">
                      No se pudo encontrar la información de esta materia
                    </p>
                    <Button onClick={() => setLocation('/subjects')} variant="outline" className="border-white/10 text-white hover:bg-white/10">
                      Volver a Mis Materias
                    </Button>
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
