import { useAuth } from '@/lib/authContext';
import { Calendar as CalendarIcon } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useLocation } from 'wouter';
import { Calendar } from '@/components/Calendar';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

interface Assignment {
  _id: string;
  titulo: string;
  descripcion: string;
  curso: string;
  fechaEntrega: string;
  profesorNombre: string;
}

export default function CalendarPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  // Query para obtener tareas del estudiante basado en su grupo
  const { data: assignments = [] } = useQuery<Assignment[]>({
    queryKey: ['studentAssignments', user?.curso],
    queryFn: () => apiRequest('GET', '/api/assignments/student'),
    enabled: !!user?.id && !!user?.curso,
    staleTime: 0,
  });

  const handleDayClick = (assignment: Assignment) => {
    // Navegar a la página de detalle de la tarea
    setLocation(`/assignment/${assignment._id}`);
  };

  return (
    <div className="flex-1 overflow-auto p-8">
            <div className="max-w-5xl mx-auto">
              <div className="mb-8">
                <h2 className="text-3xl font-bold text-white mb-2 font-['Poppins']">
                  Mis Tareas - Curso {user?.curso || 'No asignado'}
                </h2>
                <p className="text-white/60">
                  Visualiza todas las tareas asignadas a tu curso
                </p>
              </div>

              {/* Calendario */}
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

              {/* Lista de tareas del mes */}
              {assignments.length > 0 && (
                <Card className="bg-white/5 border-white/10 backdrop-blur-md mt-8">
                  <CardHeader>
                    <CardTitle className="text-white">Tareas Próximas</CardTitle>
                    <CardDescription className="text-white/60">
                      Todas las tareas de este mes
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
                                  Profesor: {assignment.profesorNombre}
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

              {assignments.length === 0 && (
                <Card className="bg-white/5 border-white/10 backdrop-blur-md mt-8">
                  <CardContent className="py-12 text-center">
                    <CalendarIcon className="w-16 h-16 text-[#9f25b8]/40 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold text-white mb-2">
                      No hay tareas este mes
                    </h3>
                    <p className="text-white/60">
                      Tu curso {user?.curso} no tiene tareas asignadas para este mes.
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
  );
}
