import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card';
import { courseDisplayLabel, calendarColorKey, calendarDisplayLabel, type CalendarVariant } from '@/lib/assignmentUtils';

interface Assignment {
  _id: string;
  titulo: string;
  descripcion: string;
  curso: string;
  fechaEntrega: string;
  profesorNombre: string;
  courseId?: string;
  materiaNombre?: string;
  subjectId?: string;
  groupId?: string;
}

interface CalendarProps {
  assignments: Assignment[];
  onDayClick?: (assignment: Assignment) => void;
  onEmptyDayClick?: (date: Date) => void;
  /**
   * Clic en la burbuja del día (vacía o con tareas): recibe la fecha local de ese celda.
   * Si está definido, el botón principal del día usa esto en lugar de navegar al primer assignment.
   * Las filas dentro del hover card siguen usando onDayClick.
   */
  onDayBubbleClick?: (date: Date) => void;
  /** Estudiante: diferenciar por materia y mostrar nombre de materia. Profesor: por curso. */
  variant?: CalendarVariant;
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

export function Calendar({ assignments, onDayClick, onEmptyDayClick, onDayBubbleClick, variant = 'student' }: CalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const isStudent = variant === 'student';
  const legendTitle = isStudent ? 'Leyenda de materias' : 'Leyenda de cursos';
  const multipleLabel = isStudent ? 'Varias materias' : 'Varios cursos';

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

  // Claves únicas para leyenda y color (materia en estudiante, curso en profesor)
  const uniqueKeys = useMemo(() => {
    const keys = new Set<string>();
    assignments.forEach((a) => {
      const key = calendarColorKey(a, variant);
      if (key) keys.add(key);
    });
    return Array.from(keys).sort();
  }, [assignments, variant]);

  // Mapa clave -> etiqueta legible (nombre materia o curso)
  const keyToLabel = useMemo(() => {
    const map = new Map<string, string>();
    assignments.forEach((a) => {
      const key = calendarColorKey(a, variant);
      const label = calendarDisplayLabel(a, variant);
      if (key && !map.has(key)) map.set(key, label);
    });
    uniqueKeys.forEach((key) => {
      if (!map.has(key)) map.set(key, key);
    });
    return map;
  }, [assignments, variant, uniqueKeys]);

  // Mapa de colores por clave (estable por subjectId/groupId o nombre)
  const colorMap = useMemo(() => {
    const map = new Map<string, string>();
    uniqueKeys.forEach((key, index) => {
      map.set(key, getColorForMateriaIndex(index));
    });
    return map;
  }, [uniqueKeys]);

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
      // Agrupar por clave (materia en estudiante, curso en profesor)
      const assignmentsByKey = new Map<string, Assignment[]>();
      dayAssignments.forEach((a) => {
        const key = calendarColorKey(a, variant) || (isStudent ? 'Sin materia' : 'Sin curso');
        if (!assignmentsByKey.has(key)) assignmentsByKey.set(key, []);
        assignmentsByKey.get(key)!.push(a);
      });

      const keyCount = assignmentsByKey.size;
      const totalAssignments = dayAssignments.length;
      const isMultiple = keyCount > 1;
      const firstKey = Array.from(assignmentsByKey.keys())[0];
      const singleColor = keyCount === 1 ? (colorMap.get(firstKey) || '#1e3cff') : null;
      const backgroundColor = isMultiple ? '#6b7280' : (singleColor || '#1e3cff');
      const dayLabel = keyCount === 1
        ? (keyToLabel.get(firstKey) || firstKey)
        : (isStudent ? `+${keyCount} materias` : `+${keyCount} cursos`);

      calendarDays.push(
        <HoverCard key={day} openDelay={200}>
          <HoverCardTrigger asChild>
            <button
              onClick={() => {
                const cellDate = new Date(year, month, day);
                if (onDayBubbleClick) {
                  onDayBubbleClick(cellDate);
                } else if (dayAssignments.length > 0) {
                  onDayClick?.(dayAssignments[0]);
                }
              }}
              className="aspect-square rounded-full text-white font-semibold hover:opacity-80 transition-opacity flex flex-col items-center justify-center cursor-pointer border-2 relative overflow-hidden"
              style={{
                background: backgroundColor,
                borderColor: isMultiple ? '#6b728099' : `${backgroundColor}99`,
              }}
              data-testid={`calendar-day-${day}`}
            >
              <span className="z-10 text-sm">{day}</span>
              <span className="z-10 text-[10px] font-medium text-white/95 mt-0.5 leading-tight px-0.5 text-center line-clamp-2">
                {dayLabel}
              </span>
            </button>
          </HoverCardTrigger>
          <HoverCardContent 
            className="w-80 bg-black/95 border-[#1e3cff]/30 backdrop-blur-lg max-h-96 overflow-y-auto"
            data-testid={`hover-card-day-${day}`}
          >
            <div className="space-y-3">
              <div className="pb-2 border-b border-white/10">
                <p className="text-sm font-semibold text-white">
                  {totalAssignments} {totalAssignments === 1 ? 'tarea' : 'tareas'} • {keyCount} {isStudent ? (keyCount === 1 ? 'materia' : 'materias') : (keyCount === 1 ? 'curso' : 'cursos')}
                </p>
                <p className="text-xs text-white/60 mt-1">
                  {day} de {monthNames[month]} {year}
                </p>
              </div>
              {Array.from(assignmentsByKey.entries()).map(([key, keyAssignments]) => {
                const color = colorMap.get(key) || MATERIA_PALETTE[0];
                const label = keyToLabel.get(key) || key;
                return (
                  <div key={key} className="space-y-2">
                    <div className="flex items-center gap-2 mb-1">
                      <div 
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: color }}
                      />
                      <p className="text-xs font-semibold text-white/80 uppercase tracking-wider">
                        {label}
                      </p>
                      <span className="text-xs text-white/50">
                        ({keyAssignments.length})
                      </span>
                    </div>
                    {keyAssignments.map((assignment) => (
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
                            {calendarDisplayLabel(assignment, variant)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })}
              <div className="pt-2 border-t border-white/10">
                <p className="text-xs text-white/50 text-center">
                  {onDayBubbleClick
                    ? 'Clic en el día: nueva tarea con esa fecha · Clic en una tarea: ver detalle'
                    : 'Clic para ver detalles'}
                </p>
              </div>
            </div>
          </HoverCardContent>
        </HoverCard>
      );
    } else {
      const dayDate = new Date(year, month, day);
      calendarDays.push(
        <button
          type="button"
          key={day}
          onClick={() => {
            if (onDayBubbleClick) onDayBubbleClick(dayDate);
            else onEmptyDayClick?.(dayDate);
          }}
          className="aspect-square rounded-full bg-white/5 border border-white/10 text-white/60 font-medium hover:bg-white/10 transition-colors flex items-center justify-center"
          data-testid={`calendar-day-${day}`}
        >
          {day}
        </button>
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

      {/* Leyenda (materias para estudiante, cursos para profesor) */}
      {uniqueKeys.length > 0 && (
        <div className="mb-4 p-3 bg-white/5 border border-white/10 rounded-lg">
          <p className="text-xs font-semibold text-white/60 uppercase tracking-wider mb-2">
            {legendTitle}
          </p>
          <div className="flex flex-wrap gap-3">
            {uniqueKeys.map((key) => {
              const color = colorMap.get(key) || '#1e3cff';
              const label = keyToLabel.get(key) || key;
              return (
                <div key={key} className="flex items-center gap-2">
                  <div 
                    className="w-4 h-4 rounded-full flex-shrink-0 border border-white/20"
                    style={{ backgroundColor: color }}
                  />
                  <span className="text-xs text-white/80 font-medium">{label}</span>
                </div>
              );
            })}
            {uniqueKeys.length > 1 && (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full flex-shrink-0 bg-gray-500 border border-white/20" />
                <span className="text-xs text-white/80 font-medium">{multipleLabel}</span>
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
          <span className="text-white/70">{isStudent ? 'Con tareas (una materia)' : 'Con tareas (un curso)'}</span>
        </div>
        {uniqueKeys.length > 1 && (
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-gray-500 border-2 border-gray-500/30" />
            <span className="text-white/70">{multipleLabel}</span>
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