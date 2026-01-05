import { useState } from 'react';
import { useAuth } from '@/lib/authContext';
import { useLocation, useRoute } from 'wouter';
import { 
  ArrowLeft,
  ClipboardList,
  Calendar as CalendarIcon,
  Clock,
  User,
  ChevronRight
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Skeleton } from '@/components/ui/skeleton';

interface Assignment {
  _id: string;
  titulo: string;
  descripcion: string;
  curso: string;
  courseId: string;
  fechaEntrega: string;
  profesorNombre: string;
}

export default function TeacherGroupTasksPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [, params] = useRoute('/profesor/cursos/:cursoId/tareas');
  const cursoId = params?.cursoId || '';

  // Obtener mes y año actuales
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  // Query para obtener tareas del grupo
  const { data: assignments = [], isLoading } = useQuery<Assignment[]>({
    queryKey: ['assignments', cursoId, currentMonth, currentYear],
    queryFn: () => {
      return apiRequest('GET', `/api/assignments?groupId=${cursoId}&month=${currentMonth}&year=${currentYear}`);
    },
    enabled: !!cursoId,
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });

  if (!cursoId) {
    return (
      <div className="flex-1 overflow-auto p-8">
        <div className="max-w-7xl mx-auto">
          <Card className="bg-white/5 border-white/10 backdrop-blur-md">
            <CardContent className="p-12 text-center">
              <p className="text-white/60">Grupo no especificado</p>
              <Button
                variant="outline"
                className="mt-4 border-white/20 text-white hover:bg-white/10"
                onClick={() => setLocation('/courses')}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Volver a Cursos
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Button
            variant="ghost"
            onClick={() => setLocation(`/course-detail/${cursoId}`)}
            className="text-white/70 hover:text-white mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver al Grupo
          </Button>
          <div>
            <h1 className="text-4xl font-bold text-white mb-2 font-['Poppins']">
              Tareas del Grupo {cursoId}
            </h1>
            <p className="text-white/60">
              Gestiona y corrige las tareas asignadas a este grupo
            </p>
          </div>
        </div>

        {/* Lista de Tareas */}
        <Card className="bg-white/5 border-white/10 backdrop-blur-md">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-[#9f25b8]" />
              Próximas Tareas
            </CardTitle>
            <CardDescription className="text-white/60">
              {assignments.length} {assignments.length === 1 ? 'tarea pendiente' : 'tareas pendientes'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-24 w-full bg-white/10" />
                <Skeleton className="h-24 w-full bg-white/10" />
                <Skeleton className="h-24 w-full bg-white/10" />
              </div>
            ) : assignments.length > 0 ? (
              <div className="space-y-3">
                {assignments
                  .sort((a, b) => new Date(a.fechaEntrega).getTime() - new Date(b.fechaEntrega).getTime())
                  .map((assignment) => {
                    const fechaEntrega = new Date(assignment.fechaEntrega);
                    const diasRestantes = Math.ceil((fechaEntrega.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                    const isVencida = fechaEntrega < now;
                    
                    return (
                      <div
                        key={assignment._id}
                        className="p-5 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-all cursor-pointer group"
                        onClick={() => setLocation(`/assignment/${assignment._id}`)}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <h4 className="font-semibold text-white text-lg group-hover:text-[#9f25b8] transition-colors">
                                {assignment.titulo}
                              </h4>
                              {isVencida ? (
                                <Badge className="bg-red-500/20 text-red-400 border-red-500/40">
                                  Vencida
                                </Badge>
                              ) : diasRestantes <= 3 ? (
                                <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/40">
                                  Próxima
                                </Badge>
                              ) : null}
                            </div>
                            <p className="text-sm text-white/70 mb-3 line-clamp-2">
                              {assignment.descripcion}
                            </p>
                            <div className="flex flex-wrap items-center gap-4 text-sm text-white/60">
                              <div className="flex items-center gap-2">
                                <User className="w-4 h-4" />
                                <span>{assignment.profesorNombre}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <CalendarIcon className="w-4 h-4" />
                                <span>
                                  {fechaEntrega.toLocaleDateString('es-CO', {
                                    day: 'numeric',
                                    month: 'long',
                                    year: 'numeric'
                                  })}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Clock className="w-4 h-4" />
                                <span>
                                  {fechaEntrega.toLocaleTimeString('es-CO', {
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })}
                                </span>
                              </div>
                              {!isVencida && (
                                <Badge variant="outline" className="border-white/20 text-white/70">
                                  {diasRestantes} {diasRestantes === 1 ? 'día restante' : 'días restantes'}
                                </Badge>
                              )}
                            </div>
                          </div>
                          <ChevronRight className="w-5 h-5 text-white/40 group-hover:text-[#9f25b8] transition-colors flex-shrink-0 mt-1" />
                        </div>
                      </div>
                    );
                  })}
              </div>
            ) : (
              <div className="text-center py-12">
                <ClipboardList className="w-16 h-16 text-[#9f25b8]/40 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-white mb-2">
                  No hay tareas asignadas
                </h3>
                <p className="text-white/60 mb-6">
                  Aún no se han asignado tareas para este grupo.
                </p>
                <Button
                  variant="outline"
                  className="border-white/20 text-white hover:bg-white/10"
                  onClick={() => setLocation(`/course-detail/${cursoId}`)}
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Volver al Grupo
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

