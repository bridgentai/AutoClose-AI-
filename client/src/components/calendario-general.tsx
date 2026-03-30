"use client";

import { useState, useMemo } from 'react';
import { useAuth } from '@/lib/authContext';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card';
import { courseDisplayLabel, getAssignmentCalendarLocalParts } from '@/lib/assignmentUtils';

interface Assignment {
  _id: string;
  titulo: string;
  descripcion: string;
  curso: string;
  fechaEntrega: string;
  profesorNombre?: string;
  courseId?: string;
}

interface Course {
  _id: string;
  nombre: string;
  colorAcento?: string;
}

interface CalendarEvent {
  _id: string;
  titulo: string;
  descripcion?: string;
  fecha: string;
  tipo: 'institucional';
}

type ViewMode = 'month' | 'week' | 'day';

// Paleta de colores para cursos (si no tienen colorAcento)
const DEFAULT_COLORS = [
  '#1e3cff', // Purple Core
  '#3b82f6', // Blue
  '#10b981', // Green
  '#f59e0b', // Amber
  '#ef4444', // Red
  '#8b5cf6', // Violet
  '#06b6d4', // Cyan
  '#f97316', // Orange
  '#ec4899', // Pink
  '#14b8a6', // Teal
];

const INSTITUTIONAL_COLOR = '#002366'; // Purple Deep para eventos institucionales

export function CalendarioGeneral() {
  const { user } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('month');

  const currentMonth = currentDate.getMonth() + 1;
  const currentYear = currentDate.getFullYear();

  // Misma fuente que /teacher-calendar (el endpoint /profesor/:id/:mes/:año era un stub vacío)
  const { data: assignments = [] } = useQuery<Assignment[]>({
    queryKey: ['teacherAssignments', user?.id],
    queryFn: () => apiRequest<Assignment[]>('GET', '/api/assignments'),
    enabled: !!user?.id,
    staleTime: 0,
  });

  // Obtener todos los cursos del profesor
  const { data: coursesData } = useQuery<{ courses: Course[] }>({
    queryKey: ['professorCourses', user?.id],
    queryFn: async () => {
      return apiRequest('GET', '/api/professor/courses');
    },
    enabled: !!user?.id,
    staleTime: 0,
  });

  const courses = coursesData?.courses || [];

  // Crear mapa de colores por curso
  const courseColorMap = useMemo(() => {
    const map = new Map<string, string>();
    courses.forEach((course, index) => {
      map.set(course._id, course.colorAcento || DEFAULT_COLORS[index % DEFAULT_COLORS.length]);
    });
    return map;
  }, [courses]);

  // Crear mapa de colores por nombre de curso (para tareas sin courseId)
  const courseNameColorMap = useMemo(() => {
    const map = new Map<string, string>();
    courses.forEach((course, index) => {
      map.set(course.nombre.toLowerCase(), course.colorAcento || DEFAULT_COLORS[index % DEFAULT_COLORS.length]);
    });
    return map;
  }, [courses]);

  // Obtener color para una tarea
  const getAssignmentColor = (assignment: Assignment): string => {
    if (assignment.courseId && courseColorMap.has(assignment.courseId)) {
      return courseColorMap.get(assignment.courseId)!;
    }
    // Intentar por nombre del curso
    const courseName = assignment.curso?.toLowerCase();
    if (courseName && courseNameColorMap.has(courseName)) {
      return courseNameColorMap.get(courseName)!;
    }
    // Color por defecto
    return DEFAULT_COLORS[0];
  };

  // Eventos institucionales (placeholder - por ahora vacío)
  const institutionalEvents: CalendarEvent[] = [];

  // Agrupar tareas y eventos por día
  const eventsByDay = useMemo(() => {
    const map = new Map<number, { assignments: Assignment[]; events: CalendarEvent[] }>();
    
    assignments.forEach((assignment) => {
      const parts = getAssignmentCalendarLocalParts(assignment.fechaEntrega);
      if (!parts || parts.monthIndex + 1 !== currentMonth || parts.year !== currentYear) return;
      const day = parts.day;
      if (!map.has(day)) {
        map.set(day, { assignments: [], events: [] });
      }
      map.get(day)!.assignments.push(assignment);
    });

    institutionalEvents.forEach((event) => {
      const date = new Date(event.fecha);
      if (date.getMonth() + 1 === currentMonth && date.getFullYear() === currentYear) {
        const day = date.getDate();
        if (!map.has(day)) {
          map.set(day, { assignments: [], events: [] });
        }
        map.get(day)!.events.push(event);
      }
    });

    return map;
  }, [assignments, institutionalEvents, currentMonth, currentYear]);

  const monthNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);
  const daysInMonth = lastDayOfMonth.getDate();
  const startingDayOfWeek = firstDayOfMonth.getDay();

  const previousPeriod = () => {
    if (viewMode === 'month') {
      setCurrentDate(new Date(year, month - 1, 1));
    } else if (viewMode === 'week') {
      setCurrentDate(new Date(currentDate.getTime() - 7 * 24 * 60 * 60 * 1000));
    } else {
      setCurrentDate(new Date(currentDate.getTime() - 24 * 60 * 60 * 1000));
    }
  };

  const nextPeriod = () => {
    if (viewMode === 'month') {
      setCurrentDate(new Date(year, month + 1, 1));
    } else if (viewMode === 'week') {
      setCurrentDate(new Date(currentDate.getTime() + 7 * 24 * 60 * 60 * 1000));
    } else {
      setCurrentDate(new Date(currentDate.getTime() + 24 * 60 * 60 * 1000));
    }
  };

  // Renderizar vista de mes
  const renderMonthView = () => {
    const calendarDays = [];
    
    // Días vacíos antes del primer día del mes
    for (let i = 0; i < startingDayOfWeek; i++) {
      calendarDays.push(
        <div key={`empty-${i}`} className="aspect-square" />
      );
    }

    // Días del mes
    for (let day = 1; day <= daysInMonth; day++) {
      const dayEvents = eventsByDay.get(day) || { assignments: [], events: [] };
      const hasEvents = dayEvents.assignments.length > 0 || dayEvents.events.length > 0;

      if (hasEvents) {
        // Agrupar tareas por curso para mostrar múltiples colores
        const assignmentsByCourse = new Map<string, Assignment[]>();
        dayEvents.assignments.forEach((assignment) => {
          const courseId = assignment.courseId || assignment.curso;
          if (!assignmentsByCourse.has(courseId)) {
            assignmentsByCourse.set(courseId, []);
          }
          assignmentsByCourse.get(courseId)!.push(assignment);
        });

        calendarDays.push(
          <HoverCard key={day} openDelay={200}>
            <HoverCardTrigger asChild>
              <button
                className="aspect-square rounded-lg bg-white/5 border-2 border-white/20 hover:bg-white/10 transition-all flex flex-col items-center justify-center cursor-pointer p-1 relative overflow-hidden"
              >
                <span className="text-sm font-semibold text-white z-10">{day}</span>
                <div className="absolute bottom-1 left-1 right-1 flex gap-0.5 justify-center flex-wrap">
                  {Array.from(assignmentsByCourse.entries()).slice(0, 3).map(([courseId, courseAssignments]) => {
                    const color = getAssignmentColor(courseAssignments[0]);
                    return (
                      <div
                        key={courseId}
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ backgroundColor: color }}
                      />
                    );
                  })}
                  {dayEvents.events.length > 0 && (
                    <div
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ backgroundColor: INSTITUTIONAL_COLOR }}
                    />
                  )}
                  {(assignmentsByCourse.size > 3 || dayEvents.events.length > 0) && (
                    <span className="text-[8px] text-white/60">+</span>
                  )}
                </div>
              </button>
            </HoverCardTrigger>
            <HoverCardContent 
              className="w-80 bg-black/90 border-[#1e3cff]/30 backdrop-blur-lg max-h-96 overflow-y-auto"
            >
              <div className="space-y-3">
                <p className="text-sm text-white/60 font-semibold">
                  {dayEvents.assignments.length + dayEvents.events.length} {dayEvents.assignments.length + dayEvents.events.length === 1 ? 'evento' : 'eventos'}
                </p>
                {dayEvents.assignments.map((assignment) => {
                  const color = getAssignmentColor(assignment);
                  return (
                    <div 
                      key={assignment._id} 
                      className="border-l-4 pl-3 py-1"
                      style={{ borderColor: color }}
                    >
                      <h4 className="font-semibold text-white text-sm">{assignment.titulo}</h4>
                      <p className="text-xs text-white/70 mt-1 line-clamp-2">
                        {assignment.descripcion}
                      </p>
                      <p className="text-xs mt-1" style={{ color }}>
                        Curso: {courseDisplayLabel(assignment)}
                      </p>
                    </div>
                  );
                })}
                {dayEvents.events.map((event) => (
                  <div 
                    key={event._id} 
                    className="border-l-4 pl-3 py-1"
                    style={{ borderColor: INSTITUTIONAL_COLOR }}
                  >
                    <h4 className="font-semibold text-white text-sm">{event.titulo}</h4>
                    {event.descripcion && (
                      <p className="text-xs text-white/70 mt-1 line-clamp-2">
                        {event.descripcion}
                      </p>
                    )}
                    <p className="text-xs mt-1" style={{ color: INSTITUTIONAL_COLOR }}>
                      Evento del colegio
                    </p>
                  </div>
                ))}
              </div>
            </HoverCardContent>
          </HoverCard>
        );
      } else {
        calendarDays.push(
          <div
            key={day}
            className="aspect-square rounded-lg bg-white/5 border border-white/10 text-white/60 font-medium hover:bg-white/10 transition-colors flex items-center justify-center"
          >
            {day}
          </div>
        );
      }
    }

    return (
      <div className="grid grid-cols-7 gap-2">
        {calendarDays}
      </div>
    );
  };

  // Renderizar vista de semana
  const renderWeekView = () => {
    const startOfWeek = new Date(currentDate);
    startOfWeek.setDate(currentDate.getDate() - currentDate.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    // Verificar que el día esté en el mes actual y obtener eventos
    const getDayEvents = (day: Date) => {
      if (day.getMonth() === month && day.getFullYear() === year) {
        const dayNumber = day.getDate();
        return eventsByDay.get(dayNumber) || { assignments: [], events: [] };
      }
      return { assignments: [], events: [] };
    };

    const weekDays = [];
    for (let i = 0; i < 7; i++) {
      const day = new Date(startOfWeek);
      day.setDate(startOfWeek.getDate() + i);
      const dayEvents = getDayEvents(day);
      const dayNumber = day.getDate();

      weekDays.push(
        <div key={i} className="border border-white/10 rounded-lg p-3 bg-white/5">
          <div className="text-center mb-2">
            <p className="text-xs text-white/50">{dayNames[i]}</p>
            <p className="text-lg font-semibold text-white">{day.getDate()}</p>
          </div>
          <div className="space-y-2 mt-3">
            {dayEvents.assignments.slice(0, 3).map((assignment) => {
              const color = getAssignmentColor(assignment);
              return (
                <div
                  key={assignment._id}
                  className="p-2 rounded text-xs border-l-2"
                  style={{ borderColor: color, backgroundColor: `${color}20` }}
                >
                  <p className="text-white font-medium truncate">{assignment.titulo}</p>
                  <p className="text-white/60 text-[10px] mt-0.5">{courseDisplayLabel(assignment)}</p>
                </div>
              );
            })}
            {dayEvents.events.slice(0, 2).map((event) => (
              <div
                key={event._id}
                className="p-2 rounded text-xs border-l-2"
                style={{ borderColor: INSTITUTIONAL_COLOR, backgroundColor: `${INSTITUTIONAL_COLOR}20` }}
              >
                <p className="text-white font-medium truncate">{event.titulo}</p>
                <p className="text-white/60 text-[10px] mt-0.5">Evento del colegio</p>
              </div>
            ))}
            {(dayEvents.assignments.length > 3 || dayEvents.events.length > 2) && (
              <p className="text-xs text-white/50 text-center">
                +{dayEvents.assignments.length - 3 + dayEvents.events.length - 2} más
              </p>
            )}
          </div>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-7 gap-3">
        {weekDays}
      </div>
    );
  };

  // Renderizar vista de día
  const renderDayView = () => {
    const dayNumber = currentDate.getDate();
    const dayEvents = eventsByDay.get(dayNumber) || { assignments: [], events: [] };

    return (
      <div className="space-y-3">
        {dayEvents.assignments.map((assignment) => {
          const color = getAssignmentColor(assignment);
          return (
            <Card
              key={assignment._id}
              className="bg-white/5 border-white/10 backdrop-blur-md"
              style={{ borderLeftColor: color, borderLeftWidth: '4px' }}
            >
              <CardContent className="p-4">
                <h4 className="font-semibold text-white mb-2">{assignment.titulo}</h4>
                <p className="text-sm text-white/70 mb-2">{assignment.descripcion}</p>
                <div className="flex items-center gap-2 text-xs">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: color }}
                  />
                  <span className="text-white/60">Curso: {courseDisplayLabel(assignment)}</span>
                  <span className="text-white/40">•</span>
                  <span className="text-white/60">
                    {new Date(assignment.fechaEntrega).toLocaleTimeString('es-CO', {
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </span>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {dayEvents.events.map((event) => (
          <Card
            key={event._id}
            className="bg-white/5 border-white/10 backdrop-blur-md"
            style={{ borderLeftColor: INSTITUTIONAL_COLOR, borderLeftWidth: '4px' }}
          >
            <CardContent className="p-4">
              <h4 className="font-semibold text-white mb-2">{event.titulo}</h4>
              {event.descripcion && (
                <p className="text-sm text-white/70 mb-2">{event.descripcion}</p>
              )}
              <div className="flex items-center gap-2 text-xs">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: INSTITUTIONAL_COLOR }}
                />
                <span className="text-white/60">Evento del colegio</span>
              </div>
            </CardContent>
          </Card>
        ))}
        {dayEvents.assignments.length === 0 && dayEvents.events.length === 0 && (
          <div className="text-center py-12">
            <CalendarIcon className="w-16 h-16 text-[#1e3cff]/40 mx-auto mb-4" />
            <p className="text-white/60">No hay eventos para este día</p>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <Card className="bg-white/5 border-white/10 backdrop-blur-md flex-1 flex flex-col overflow-hidden">
        <CardHeader className="border-b border-white/10">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-white">
                <CalendarIcon className="w-5 h-5 text-[#1e3cff]" />
                Calendario General
              </CardTitle>
              <p className="text-sm text-white/60 mt-1">
                {viewMode === 'month' && `${monthNames[month]} ${year}`}
                {viewMode === 'week' && (() => {
                  const startOfWeek = new Date(currentDate);
                  startOfWeek.setDate(currentDate.getDate() - currentDate.getDay());
                  return `Semana del ${startOfWeek.toLocaleDateString('es-CO')}`;
                })()}
                {viewMode === 'day' && `${dayNames[currentDate.getDay()]}, ${currentDate.getDate()} de ${monthNames[month]} ${year}`}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex gap-1 bg-white/5 rounded-lg p-1">
                <Button
                  size="sm"
                  variant={viewMode === 'month' ? 'default' : 'ghost'}
                  onClick={() => setViewMode('month')}
                  className={cn(
                    "h-8 px-3 text-xs",
                    viewMode === 'month' 
                      ? "bg-[#1e3cff] text-white" 
                      : "text-white/70 hover:text-white hover:bg-white/10"
                  )}
                >
                  Mes
                </Button>
                <Button
                  size="sm"
                  variant={viewMode === 'week' ? 'default' : 'ghost'}
                  onClick={() => setViewMode('week')}
                  className={cn(
                    "h-8 px-3 text-xs",
                    viewMode === 'week' 
                      ? "bg-[#1e3cff] text-white" 
                      : "text-white/70 hover:text-white hover:bg-white/10"
                  )}
                >
                  Semana
                </Button>
                <Button
                  size="sm"
                  variant={viewMode === 'day' ? 'default' : 'ghost'}
                  onClick={() => setViewMode('day')}
                  className={cn(
                    "h-8 px-3 text-xs",
                    viewMode === 'day' 
                      ? "bg-[#1e3cff] text-white" 
                      : "text-white/70 hover:text-white hover:bg-white/10"
                  )}
                >
                  Día
                </Button>
              </div>
              <div className="flex gap-1">
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={previousPeriod}
                  className="text-white hover:bg-white/10"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={nextPeriod}
                  className="text-white hover:bg-white/10"
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex-1 overflow-y-auto p-4">
          <div className="flex gap-4 h-full">
            {/* Calendario */}
            <div className="flex-1">
              {viewMode === 'month' && (
                <>
                  {/* Nombres de los días */}
                  <div className="grid grid-cols-7 gap-2 mb-2">
                    {dayNames.map((day) => (
                      <div
                        key={day}
                        className="text-center text-sm font-semibold text-white/50 py-2"
                      >
                        {day}
                      </div>
                    ))}
                  </div>
                  {renderMonthView()}
                </>
              )}
              {viewMode === 'week' && renderWeekView()}
              {viewMode === 'day' && renderDayView()}
            </div>

            {/* Clave de colores */}
            <div className="w-64 flex-shrink-0">
              <Card className="bg-white/5 border-white/10 backdrop-blur-md">
                <CardHeader>
                  <CardTitle className="text-sm text-white">Clave de Colores</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Cursos */}
                  <div>
                    <p className="text-xs font-semibold text-white/60 uppercase tracking-wider mb-2">
                      Cursos
                    </p>
                    <div className="space-y-2">
                      {courses.map((course) => {
                        const color = course.colorAcento || DEFAULT_COLORS[courses.indexOf(course) % DEFAULT_COLORS.length];
                        return (
                          <div key={course._id} className="flex items-center gap-2">
                            <div
                              className="w-4 h-4 rounded-full flex-shrink-0"
                              style={{ backgroundColor: color }}
                            />
                            <span className="text-xs text-white/80 truncate">{course.nombre}</span>
                          </div>
                        );
                      })}
                      {courses.length === 0 && (
                        <p className="text-xs text-white/40">No hay cursos asignados</p>
                      )}
                    </div>
                  </div>

                  {/* Eventos institucionales */}
                  <div className="pt-3 border-t border-white/10">
                    <p className="text-xs font-semibold text-white/60 uppercase tracking-wider mb-2">
                      Eventos del Colegio
                    </p>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-4 h-4 rounded-full flex-shrink-0"
                        style={{ backgroundColor: INSTITUTIONAL_COLOR }}
                      />
                      <span className="text-xs text-white/80">Eventos institucionales</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

