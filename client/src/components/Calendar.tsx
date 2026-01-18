import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card';

interface Assignment {
  _id: string;
  titulo: string;
  descripcion: string;
  curso: string;
  fechaEntrega: string;
  profesorNombre: string;
  courseId?: string;
}

interface CalendarProps {
  assignments: Assignment[];
  onDayClick?: (assignment: Assignment) => void;
}

// Función para generar un color único basado en un curso/grupo
const generateColorFromId = (id: string): string => {
  if (!id) return '#9f25b8'; // Color por defecto si no hay ID
  
  // Hash simple basado en el string
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  // Paleta de colores vibrantes (incluyendo púrpuras y otros colores)
  const colors = [
    '#9f25b8', // Purple Core
    '#6a0dad', // Purple Deep
    '#c66bff', // Purple Light
    '#3b82f6', // Blue
    '#10b981', // Green
    '#f59e0b', // Amber
    '#ef4444', // Red
    '#8b5cf6', // Violet
    '#06b6d4', // Cyan
    '#f97316', // Orange
    '#ec4899', // Pink
    '#14b8a6', // Teal
    '#6366f1', // Indigo
    '#84cc16', // Lime
    '#f43f5e', // Rose
  ];
  
  // Usar el hash para seleccionar un color de la paleta
  const index = Math.abs(hash) % colors.length;
  return colors[index];
};

export function Calendar({ assignments, onDayClick }: CalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());

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

  const previousMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  // Generar mapa de colores por curso/grupo (una sola vez)
  const courseColorsMap = useMemo(() => {
    const map = new Map<string, string>();
    assignments.forEach((assignment) => {
      const colorKey = assignment.curso || assignment.courseId || '';
      if (colorKey && !map.has(colorKey)) {
        map.set(colorKey, generateColorFromId(colorKey));
      }
    });
    return map;
  }, [assignments]);

  // Obtener lista única de cursos para la leyenda
  const uniqueCourses = useMemo(() => {
    const courses = new Set<string>();
    assignments.forEach((assignment) => {
      if (assignment.curso) {
        courses.add(assignment.curso);
      }
    });
    return Array.from(courses).sort();
  }, [assignments]);

  // Agrupar tareas por día
  const assignmentsByDay: Record<number, Assignment[]> = {};
  assignments.forEach((assignment) => {
    const date = new Date(assignment.fechaEntrega);
    if (date.getMonth() === month && date.getFullYear() === year) {
      const day = date.getDate();
      if (!assignmentsByDay[day]) {
        assignmentsByDay[day] = [];
      }
      assignmentsByDay[day].push(assignment);
    }
  });

  // Generar días del calendario
  const calendarDays = [];
  
  // Días vacíos antes del primer día del mes
  for (let i = 0; i < startingDayOfWeek; i++) {
    calendarDays.push(
      <div key={`empty-${i}`} className="aspect-square" />
    );
  }

  // Días del mes
  for (let day = 1; day <= daysInMonth; day++) {
    const dayAssignments = assignmentsByDay[day] || [];
    const hasAssignments = dayAssignments.length > 0;

    if (hasAssignments) {
      // Agrupar tareas por curso (grupo)
      const assignmentsByCourse = new Map<string, Assignment[]>();
      dayAssignments.forEach((assignment) => {
        const colorKey = assignment.curso || assignment.courseId || '';
        if (!assignmentsByCourse.has(colorKey)) {
          assignmentsByCourse.set(colorKey, []);
        }
        assignmentsByCourse.get(colorKey)!.push(assignment);
      });

      const coursesCount = assignmentsByCourse.size;
      const totalAssignments = dayAssignments.length;

      // Si hay múltiples cursos, usar color neutro (gris/morado por defecto)
      // Si solo hay un curso, usar el color del curso
      const isMultipleCourses = coursesCount > 1;
      const singleCourseColor = coursesCount === 1 
        ? (courseColorsMap.get(Array.from(assignmentsByCourse.keys())[0]) || '#9f25b8')
        : null;

      const backgroundColor = isMultipleCourses 
        ? '#6b7280' // Gris neutro para múltiples cursos
        : (singleCourseColor || '#9f25b8');

      calendarDays.push(
        <HoverCard key={day} openDelay={200}>
          <HoverCardTrigger asChild>
            <button
              onClick={() => {
                if (dayAssignments.length > 0) {
                  onDayClick?.(dayAssignments[0]);
                }
              }}
              className="aspect-square rounded-full text-white font-semibold hover:opacity-80 transition-opacity flex flex-col items-center justify-center cursor-pointer border-2 relative overflow-hidden"
              style={{
                background: backgroundColor,
                borderColor: isMultipleCourses ? '#6b728099' : `${backgroundColor}99`,
              }}
              data-testid={`calendar-day-${day}`}
            >
              <span className="z-10 text-sm">{day}</span>
              {/* Contador +N si hay múltiples cursos */}
              {isMultipleCourses && (
                <span className="absolute bottom-1 text-[10px] font-bold text-white/90 z-10">
                  +{coursesCount}
                </span>
              )}
            </button>
          </HoverCardTrigger>
          <HoverCardContent 
            className="w-80 bg-black/95 border-[#9f25b8]/30 backdrop-blur-lg max-h-96 overflow-y-auto"
            data-testid={`hover-card-day-${day}`}
          >
            <div className="space-y-3">
              <div className="pb-2 border-b border-white/10">
                <p className="text-sm font-semibold text-white">
                  {totalAssignments} {totalAssignments === 1 ? 'tarea' : 'tareas'} • {coursesCount} {coursesCount === 1 ? 'curso' : 'cursos'}
                </p>
                <p className="text-xs text-white/60 mt-1">
                  {day} de {monthNames[month]} {year}
                </p>
              </div>
              {Array.from(assignmentsByCourse.entries()).map(([colorKey, courseAssignments], courseIndex) => {
                const color = courseColorsMap.get(colorKey) || generateColorFromId(colorKey);
                const courseName = colorKey || 'Sin curso';
                const totalCourses = assignmentsByCourse.size;
                
                return (
                  <div key={colorKey} className="space-y-2">
                    {/* Header del curso con color */}
                    <div className="flex items-center gap-2 mb-1">
                      <div 
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: color }}
                      />
                      <p className="text-xs font-semibold text-white/80 uppercase tracking-wider">
                        {courseName}
                      </p>
                      <span className="text-xs text-white/50">
                        ({courseAssignments.length})
                      </span>
                    </div>
                    {courseAssignments.map((assignment) => (
                      <div
                        key={assignment._id}
                        className="border-l-4 pl-3 py-2 cursor-pointer hover:bg-white/5 rounded-r transition-colors"
                        style={{ borderColor: color }}
                        onClick={(e) => {
                          e.stopPropagation();
                          onDayClick?.(assignment);
                        }}
                        data-testid={`assignment-preview-${assignment._id}`}
                      >
                        <h4 className="font-semibold text-white text-sm leading-tight mb-1">
                          {assignment.titulo}
                        </h4>
                        <p className="text-xs text-white/70 mt-1 line-clamp-2 leading-relaxed">
                          {assignment.descripcion}
                        </p>
                        <div className="flex items-center gap-2 mt-2 text-xs">
                          <span className="text-white/50">
                            {new Date(assignment.fechaEntrega).toLocaleTimeString('es-CO', {
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                          <span className="text-white/30">•</span>
                          <span className="text-white/50" style={{ color }}>
                            {assignment.curso}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })}
              <div className="pt-2 border-t border-white/10">
                <p className="text-xs text-white/50 text-center">
                  Click para ver detalles del curso
                </p>
              </div>
            </div>
          </HoverCardContent>
        </HoverCard>
      );
    } else {
      calendarDays.push(
        <div
          key={day}
          className="aspect-square rounded-full bg-white/5 border border-white/10 text-white/60 font-medium hover:bg-white/10 transition-colors flex items-center justify-center"
          data-testid={`calendar-day-${day}`}
        >
          {day}
        </div>
      );
    }
  }

  return (
    <div className="w-full">
      {/* Header del calendario */}
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-bold text-white font-['Poppins']">
          {monthNames[month]} {year}
        </h3>
        <div className="flex gap-2">
          <Button
            size="icon"
            variant="ghost"
            onClick={previousMonth}
            className="text-white hover:bg-white/10"
            data-testid="button-prev-month"
          >
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={nextMonth}
            className="text-white hover:bg-white/10"
            data-testid="button-next-month"
          >
            <ChevronRight className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {/* Leyenda de colores */}
      {uniqueCourses.length > 0 && (
        <div className="mb-4 p-3 bg-white/5 border border-white/10 rounded-lg">
          <p className="text-xs font-semibold text-white/60 uppercase tracking-wider mb-2">
            Leyenda de Cursos
          </p>
          <div className="flex flex-wrap gap-3">
            {uniqueCourses.map((course) => {
              const color = courseColorsMap.get(course) || '#9f25b8';
              return (
                <div key={course} className="flex items-center gap-2">
                  <div 
                    className="w-4 h-4 rounded-full flex-shrink-0 border border-white/20"
                    style={{ backgroundColor: color }}
                  />
                  <span className="text-xs text-white/80 font-medium">{course}</span>
                </div>
              );
            })}
            {uniqueCourses.length > 1 && (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full flex-shrink-0 bg-gray-500 border border-white/20" />
                <span className="text-xs text-white/80 font-medium">Múltiples cursos</span>
              </div>
            )}
          </div>
        </div>
      )}

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

      {/* Grid del calendario */}
      <div className="grid grid-cols-7 gap-2">
        {calendarDays}
      </div>

      {/* Leyenda básica */}
      <div className="mt-6 flex items-center gap-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-[#9f25b8] border-2 border-[#9f25b8]/30" />
          <span className="text-white/70">Con tareas (un curso)</span>
        </div>
        {uniqueCourses.length > 1 && (
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-gray-500 border-2 border-gray-500/30" />
            <span className="text-white/70">Múltiples cursos</span>
          </div>
        )}
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-white/5 border border-white/10" />
          <span className="text-white/70">Sin tareas</span>
        </div>
      </div>
    </div>
  );
}