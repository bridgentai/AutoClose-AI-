import { useAuth } from '@/lib/authContext';
import { AppSidebar } from '@/components/app-sidebar';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { Calendar as CalendarIcon, User } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useLocation } from 'wouter';
import { Calendar } from '@/components/Calendar';
import { useQuery } from '@tanstack/react-query';

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

  // Obtener mes y año actuales
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  // Query para obtener tareas del curso del estudiante
  const { data: assignments = [] } = useQuery<Assignment[]>({
    queryKey: ['/api/assignments/curso', user?.curso, currentMonth, currentYear],
    enabled: !!user?.curso,
  });

  const handleDayClick = (assignment: Assignment) => {
    // Navegar a la página de detalle de la tarea
    setLocation(`/assignment/${assignment._id}`);
  };

  return (
    <SidebarProvider>
      <div className="flex h-screen w-full bg-gradient-to-br from-[#0a1628] via-[#0f172a] to-[#1e3a8a]">
        <AppSidebar />
        <SidebarInset className="flex flex-col flex-1">
          <header className="flex items-center justify-between p-4 border-b border-[#3b82f6]/20 backdrop-blur-xl bg-[#0a1628]/80">
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

          <main className="flex-1 overflow-auto p-8">
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
              <Card className="bg-[#1e3a8a]/20 border-[#3b82f6]/30 backdrop-blur-md">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-white">
                    <CalendarIcon className="w-5 h-5 text-[#facc15]" />
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
                <Card className="bg-[#1e3a8a]/20 border-[#3b82f6]/30 backdrop-blur-md mt-8">
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
                            className="p-4 bg-[#1e3a8a]/30 border border-[#3b82f6]/20 rounded-lg hover:bg-[#1e3a8a]/50 transition-colors cursor-pointer"
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
                                <p className="text-sm font-semibold text-[#facc15]">
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
                <Card className="bg-[#1e3a8a]/20 border-[#3b82f6]/30 backdrop-blur-md mt-8">
                  <CardContent className="py-12 text-center">
                    <CalendarIcon className="w-16 h-16 text-[#3b82f6]/40 mx-auto mb-4" />
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
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
