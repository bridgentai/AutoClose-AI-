import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card';
import { courseDisplayLabel } from '@/lib/assignmentUtils';

interface Assignment {
  _id: string;
  titulo: string;
  descripcion: string;
  curso: string;
  fechaEntrega: string;
  profesorNombre: string;
  courseId?: string;
  /** Nombre de la materia (ej. Física, Matemáticas) para leyenda y color */
  materiaNombre?: string;
}

interface CalendarProps {
  assignments: Assignment[];
  onDayClick?: (assignment: Assignment) => void;
}

// Paleta con colores muy diferenciados entre sí (ordenados por contraste visual)
const MATERIA_PALETTE = [
  '#1e3cff', // Azul eléctrico
  '#00c8ff', // Cyan brillante
  '#ffd700', // Amarillo (acento GLC)
  '#f97316', // Naranja
  '#22c55e', // Verde
  '#ef4444', // Rojo
  '#14b8a6', // Teal
  '#a3e635', // Lime
  '#06b6d4', // Cyan oscuro
  '#eab308', // Ámbar
  '#002366', // Azul rey
  '#f59e0b', // Amber
];

// Asignar color por índice (materias ordenadas) para máxima diferenciación
const getColorForMateriaIndex = (index: number): string =>
  MATERIA_PALETTE[index % MATERIA_PALETTE.length];

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

  // Lista única de materias para la leyenda (orden estable para asignar colores)
  const uniqueMaterias = useMemo(() => {
    const set = new Set<string>();
    assignments.forEach((assignment) => {
      const name = courseDisplayLabel(assignment);
      if (name) set.add(name);
    });
    return Array.from(set).sort();
  }, [assignments]);

  // Mapa de colores por materia: asignación por índice para colores bien diferenciados
  const materiaColorsMap = useMemo(() => {
    const map = new Map<string, string>();
    uniqueMaterias.forEach((materia, index) => {
      map.set(materia, getColorForMateriaIndex(index));
    });
    return map;
  }, [uniqueMaterias]);

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
      // Agrupar tareas por materia (asignatura) para color y leyenda
      const assignmentsByMateria = new Map<string, Assignment[]>();
      dayAssignments.forEach((assignment) => {
        const key = courseDisplayLabel(assignment) || 'Sin materia';
        if (!assignmentsByMateria.has(key)) {
          assignmentsByMateria.set(key, []);
        }
        assignmentsByMateria.get(key)!.push(assignment);
      });

      const materiasCount = assignmentsByMateria.size;
      const totalAssignments = dayAssignments.length;

      // Un solo color por materia; si hay varias materias, gris neutro
      const isMultipleMaterias = materiasCount > 1;
      const singleMateriaColor = materiasCount === 1
        ? (materiaColorsMap.get(Array.from(assignmentsByMateria.keys())[0]) || '#1e3cff')
        : null;

      const backgroundColor = isMultipleMaterias
        ? '#6b7280'
        : (singleMateriaColor || '#1e3cff');

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
                borderColor: isMultipleMaterias ? '#6b728099' : `${backgroundColor}99`,
              }}
              data-testid={`calendar-day-${day}`}
            >
              <span className="z-10 text-sm">{day}</span>
              {isMultipleMaterias && (
                <span className="absolute bottom-1 text-[10px] font-bold text-white/90 z-10">
                  +{materiasCount}
                </span>
              )}
            </button>
          </HoverCardTrigger>
          <HoverCardContent 
            className="w-80 bg-black/95 border-[#1e3cff]/30 backdrop-blur-lg max-h-96 overflow-y-auto"
            data-testid={`hover-card-day-${day}`}
          >
            <div className="space-y-3">
              <div className="pb-2 border-b border-white/10">
                <p className="text-sm font-semibold text-white">
                  {totalAssignments} {totalAssignments === 1 ? 'tarea' : 'tareas'} • {materiasCount} {materiasCount === 1 ? 'materia' : 'materias'}
                </p>
                <p className="text-xs text-white/60 mt-1">
                  {day} de {monthNames[month]} {year}
                </p>
              </div>
              {Array.from(assignmentsByMateria.entries()).map(([materiaKey, materiaAssignments]) => {
                const color = materiaColorsMap.get(materiaKey) || MATERIA_PALETTE[0];
                const materiaName = materiaKey || 'Sin materia';
                return (
                  <div key={materiaKey} className="space-y-2">
                    <div className="flex items-center gap-2 mb-1">
                      <div 
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: color }}
                      />
                      <p className="text-xs font-semibold text-white/80 uppercase tracking-wider">
                        {materiaName}
                      </p>
                      <span className="text-xs text-white/50">
                        ({materiaAssignments.length})
                      </span>
                    </div>
                    {materiaAssignments.map((assignment) => (
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
                            {courseDisplayLabel(assignment)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })}
              <div className="pt-2 border-t border-white/10">
                <p className="text-xs text-white/50 text-center">
                  Clic para ver detalles
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

      {/* Leyenda de materias (colores por asignatura) */}
      {uniqueMaterias.length > 0 && (
        <div className="mb-4 p-3 bg-white/5 border border-white/10 rounded-lg">
          <p className="text-xs font-semibold text-white/60 uppercase tracking-wider mb-2">
            Leyenda de materias
          </p>
          <div className="flex flex-wrap gap-3">
            {uniqueMaterias.map((materia) => {
              const color = materiaColorsMap.get(materia) || '#1e3cff';
              return (
                <div key={materia} className="flex items-center gap-2">
                  <div 
                    className="w-4 h-4 rounded-full flex-shrink-0 border border-white/20"
                    style={{ backgroundColor: color }}
                  />
                  <span className="text-xs text-white/80 font-medium">{materia}</span>
                </div>
              );
            })}
            {uniqueMaterias.length > 1 && (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full flex-shrink-0 bg-gray-500 border border-white/20" />
                <span className="text-xs text-white/80 font-medium">Varias materias</span>
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
          <div className="w-6 h-6 rounded-full bg-[#1e3cff] border-2 border-[#1e3cff]/30" />
          <span className="text-white/70">Con tareas (una materia)</span>
        </div>
        {uniqueMaterias.length > 1 && (
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-gray-500 border-2 border-gray-500/30" />
            <span className="text-white/70">Varias materias</span>
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