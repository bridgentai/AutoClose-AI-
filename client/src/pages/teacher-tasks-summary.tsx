import { useState } from 'react';
import { useAuth } from '@/lib/authContext';
import { useLocation } from 'wouter';
import { 
  ClipboardList,
  Calendar as CalendarIcon,
  Clock,
  CheckCircle2,
  Circle,
  ArrowLeft
} from 'lucide-react';
import { NavBackButton } from '@/components/nav-back-button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Skeleton } from '@/components/ui/skeleton';

interface Assignment {
  _id: string;
  titulo: string;
  descripcion: string;
  curso: string;
  fechaEntrega: string;
  profesorNombre: string;
  courseId?: string;
}

export default function TeacherTasksSummaryPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  // Obtener mes y año actuales
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  // Query para obtener todas las tareas del profesor
  const { data: assignments = [], isLoading } = useQuery<Assignment[]>({
    queryKey: ['teacherAssignments', user?.id, currentMonth, currentYear],
    queryFn: async () => {
      const result = await apiRequest('GET', `/api/assignments/profesor/${user?.id}/${currentMonth}/${currentYear}`);
      return result;
    },
    enabled: !!user?.id,
    staleTime: 0,
  });

  // Categorizar tareas
  const assignmentsByStatus = {
    all: assignments,
    upcoming: assignments.filter((a) => new Date(a.fechaEntrega) > now),
    past: assignments.filter((a) => new Date(a.fechaEntrega) <= now),
  };

  // Agrupar por curso
  const assignmentsByCourse = assignments.reduce((acc, assignment) => {
    const curso = assignment.curso || 'Sin curso';
    if (!acc[curso]) {
      acc[curso] = [];
    }
    acc[curso].push(assignment);
    return acc;
  }, {} as Record<string, Assignment[]>);

  const courses = Object.keys(assignmentsByCourse).sort();

  if (isLoading) {
    return (
      <div className="flex-1 overflow-auto p-8">
        <div className="max-w-7xl mx-auto">
          <div className="mb-8">
            <Skeleton className="h-10 w-32 mb-4 bg-white/10" />
            <Skeleton className="h-8 w-64 mb-2 bg-white/10" />
            <Skeleton className="h-4 w-96 bg-white/10" />
          </div>
          <Card className="bg-white/5 border-white/10 backdrop-blur-md">
            <CardContent className="p-6">
              <div className="space-y-3">
                <Skeleton className="h-24 w-full bg-white/10" />
                <Skeleton className="h-24 w-full bg-white/10" />
                <Skeleton className="h-24 w-full bg-white/10" />
              </div>
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
          <NavBackButton to="/teacher-calendar" label="Calendario" />
          <h1 className="text-4xl font-bold text-white mb-2 font-['Poppins'] mt-4">
            Resumen de Tareas
          </h1>
          <p className="text-white/60">
            {currentMonth}/{currentYear} • {assignments.length} {assignments.length === 1 ? 'tarea asignada' : 'tareas asignadas'}
          </p>
        </div>

        <Tabs defaultValue="all" className="w-full">
          <TabsList className="bg-white/5 border border-white/10 backdrop-blur-md mb-6">
            <TabsTrigger value="all" className="data-[state=active]:bg-[#1e3cff] data-[state=active]:text-white">
              Todas ({assignmentsByStatus.all.length})
            </TabsTrigger>
            <TabsTrigger value="upcoming" className="data-[state=active]:bg-[#1e3cff] data-[state=active]:text-white">
              Próximas ({assignmentsByStatus.upcoming.length})
            </TabsTrigger>
            <TabsTrigger value="past" className="data-[state=active]:bg-[#1e3cff] data-[state=active]:text-white">
              Pasadas ({assignmentsByStatus.past.length})
            </TabsTrigger>
            <TabsTrigger value="by-course" className="data-[state=active]:bg-[#1e3cff] data-[state=active]:text-white">
              Por Curso ({courses.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="space-y-4">
            <Card className="bg-white/5 border-white/10 backdrop-blur-md">
              <CardContent className="p-6">
                <div className="space-y-3">
                  {assignmentsByStatus.all.length > 0 ? (
                    assignmentsByStatus.all
                      .sort((a, b) => new Date(a.fechaEntrega).getTime() - new Date(b.fechaEntrega).getTime())
                      .map((assignment) => {
                        const fechaEntrega = new Date(assignment.fechaEntrega);
                        const isPast = fechaEntrega <= now;
                        const diasRestantes = Math.ceil((fechaEntrega.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                        
                        return (
                          <div
                            key={assignment._id}
                            className="p-4 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
                            onClick={() => setLocation(`/assignment/${assignment._id}`)}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-3 mb-2">
                                  <h4 className="font-semibold text-white">{assignment.titulo}</h4>
                                  {isPast ? (
                                    <Badge className="bg-red-500/20 text-red-400 border-red-500/40">
                                      Pasada
                                    </Badge>
                                  ) : diasRestantes <= 3 ? (
                                    <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/40">
                                      Próxima
                                    </Badge>
                                  ) : null}
                                </div>
                                <p className="text-sm text-white/70 mb-2 line-clamp-2">{assignment.descripcion}</p>
                                <div className="flex items-center gap-4 text-xs text-white/50">
                                  <span>Curso: {assignment.curso}</span>
                                  <span>•</span>
                                  <span>
                                    {fechaEntrega.toLocaleDateString('es-CO', {
                                      day: 'numeric',
                                      month: 'long',
                                      year: 'numeric'
                                    })}
                                  </span>
                                </div>
                              </div>
                              <div className="text-right ml-4">
                                <p className="text-sm font-semibold text-[#1e3cff]">
                                  {fechaEntrega.toLocaleTimeString('es-CO', {
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })}
                                </p>
                              </div>
                            </div>
                          </div>
                        );
                      })
                  ) : (
                    <div className="text-center py-12">
                      <ClipboardList className="w-16 h-16 text-[#1e3cff]/40 mx-auto mb-4" />
                      <h3 className="text-xl font-semibold text-white mb-2">No hay tareas</h3>
                      <p className="text-white/60">No se han asignado tareas este mes.</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="upcoming" className="space-y-4">
            <Card className="bg-white/5 border-white/10 backdrop-blur-md">
              <CardContent className="p-6">
                <div className="space-y-3">
                  {assignmentsByStatus.upcoming.length > 0 ? (
                    assignmentsByStatus.upcoming
                      .sort((a, b) => new Date(a.fechaEntrega).getTime() - new Date(b.fechaEntrega).getTime())
                      .map((assignment) => {
                        const fechaEntrega = new Date(assignment.fechaEntrega);
                        const diasRestantes = Math.ceil((fechaEntrega.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                        
                        return (
                          <div
                            key={assignment._id}
                            className="p-4 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
                            onClick={() => setLocation(`/assignment/${assignment._id}`)}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-3 mb-2">
                                  <h4 className="font-semibold text-white">{assignment.titulo}</h4>
                                  {diasRestantes <= 3 && (
                                    <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/40">
                                      Próxima
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-sm text-white/70 mb-2 line-clamp-2">{assignment.descripcion}</p>
                                <div className="flex items-center gap-4 text-xs text-white/50">
                                  <span>Curso: {assignment.curso}</span>
                                  <span>•</span>
                                  <span>
                                    {fechaEntrega.toLocaleDateString('es-CO', {
                                      day: 'numeric',
                                      month: 'long',
                                      year: 'numeric'
                                    })}
                                  </span>
                                  <span>•</span>
                                  <span className="text-[#1e3cff]">
                                    {diasRestantes} {diasRestantes === 1 ? 'día restante' : 'días restantes'}
                                  </span>
                                </div>
                              </div>
                              <div className="text-right ml-4">
                                <p className="text-sm font-semibold text-[#1e3cff]">
                                  {fechaEntrega.toLocaleTimeString('es-CO', {
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })}
                                </p>
                              </div>
                            </div>
                          </div>
                        );
                      })
                  ) : (
                    <div className="text-center py-12">
                      <CheckCircle2 className="w-16 h-16 text-[#1e3cff]/40 mx-auto mb-4" />
                      <h3 className="text-xl font-semibold text-white mb-2">No hay tareas próximas</h3>
                      <p className="text-white/60">Todas las tareas ya han pasado.</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="past" className="space-y-4">
            <Card className="bg-white/5 border-white/10 backdrop-blur-md">
              <CardContent className="p-6">
                <div className="space-y-3">
                  {assignmentsByStatus.past.length > 0 ? (
                    assignmentsByStatus.past
                      .sort((a, b) => new Date(b.fechaEntrega).getTime() - new Date(a.fechaEntrega).getTime())
                      .map((assignment) => {
                        const fechaEntrega = new Date(assignment.fechaEntrega);
                        
                        return (
                          <div
                            key={assignment._id}
                            className="p-4 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-colors cursor-pointer opacity-75"
                            onClick={() => setLocation(`/assignment/${assignment._id}`)}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-3 mb-2">
                                  <h4 className="font-semibold text-white">{assignment.titulo}</h4>
                                  <Badge className="bg-red-500/20 text-red-400 border-red-500/40">
                                    Pasada
                                  </Badge>
                                </div>
                                <p className="text-sm text-white/70 mb-2 line-clamp-2">{assignment.descripcion}</p>
                                <div className="flex items-center gap-4 text-xs text-white/50">
                                  <span>Curso: {assignment.curso}</span>
                                  <span>•</span>
                                  <span>
                                    {fechaEntrega.toLocaleDateString('es-CO', {
                                      day: 'numeric',
                                      month: 'long',
                                      year: 'numeric'
                                    })}
                                  </span>
                                </div>
                              </div>
                              <div className="text-right ml-4">
                                <p className="text-sm font-semibold text-[#1e3cff]">
                                  {fechaEntrega.toLocaleTimeString('es-CO', {
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })}
                                </p>
                              </div>
                            </div>
                          </div>
                        );
                      })
                  ) : (
                    <div className="text-center py-12">
                      <Circle className="w-16 h-16 text-[#1e3cff]/40 mx-auto mb-4" />
                      <h3 className="text-xl font-semibold text-white mb-2">No hay tareas pasadas</h3>
                      <p className="text-white/60">Todas las tareas están por venir.</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="by-course" className="space-y-4">
            {courses.length > 0 ? (
              courses.map((curso) => {
                const courseAssignments = assignmentsByCourse[curso];
                return (
                  <Card key={curso} className="bg-white/5 border-white/10 backdrop-blur-md">
                    <CardHeader>
                      <CardTitle className="text-white flex items-center gap-2">
                        <ClipboardList className="w-5 h-5 text-[#1e3cff]" />
                        {curso}
                      </CardTitle>
                      <CardDescription className="text-white/60">
                        {courseAssignments.length} {courseAssignments.length === 1 ? 'tarea' : 'tareas'}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {courseAssignments
                          .sort((a, b) => new Date(a.fechaEntrega).getTime() - new Date(b.fechaEntrega).getTime())
                          .map((assignment) => {
                            const fechaEntrega = new Date(assignment.fechaEntrega);
                            const isPast = fechaEntrega <= now;
                            
                            return (
                              <div
                                key={assignment._id}
                                className="p-4 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
                                onClick={() => setLocation(`/assignment/${assignment._id}`)}
                              >
                                <div className="flex items-start justify-between">
                                  <div className="flex-1">
                                    <h4 className="font-semibold text-white mb-1">{assignment.titulo}</h4>
                                    <p className="text-sm text-white/70 mb-2 line-clamp-2">{assignment.descripcion}</p>
                                    <p className="text-xs text-white/50">
                                      {fechaEntrega.toLocaleDateString('es-CO', {
                                        day: 'numeric',
                                        month: 'long',
                                        year: 'numeric'
                                      })}
                                    </p>
                                  </div>
                                  <div className="text-right ml-4">
                                    <p className="text-sm font-semibold text-[#1e3cff]">
                                      {fechaEntrega.toLocaleTimeString('es-CO', {
                                        hour: '2-digit',
                                        minute: '2-digit'
                                      })}
                                    </p>
                                    {isPast && (
                                      <Badge className="mt-1 bg-red-500/20 text-red-400 border-red-500/40 text-xs">
                                        Pasada
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            ) : (
              <Card className="bg-white/5 border-white/10 backdrop-blur-md">
                <CardContent className="p-6">
                  <div className="text-center py-12">
                    <ClipboardList className="w-16 h-16 text-[#1e3cff]/40 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold text-white mb-2">No hay cursos</h3>
                    <p className="text-white/60">No se han asignado tareas a ningún curso.</p>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

