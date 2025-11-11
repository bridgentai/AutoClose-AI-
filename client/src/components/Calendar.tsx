import { useState } from 'react';
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
}

interface CalendarProps {
  assignments: Assignment[];
  onDayClick?: (assignment: Assignment) => void;
}

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
      calendarDays.push(
        <HoverCard key={day} openDelay={200}>
          <HoverCardTrigger asChild>
            <button
              onClick={() => onDayClick?.(dayAssignments[0])}
              className="aspect-square rounded-full bg-gradient-to-br from-[#9f25b8] to-[#7a1a91] text-white font-semibold hover:opacity-80 transition-opacity flex items-center justify-center cursor-pointer border-2 border-[#9f25b8]/30"
              data-testid={`calendar-day-${day}`}
            >
              {day}
            </button>
          </HoverCardTrigger>
          <HoverCardContent 
            className="w-80 bg-black/90 border-[#9f25b8]/30 backdrop-blur-lg"
            data-testid={`hover-card-day-${day}`}
          >
            <div className="space-y-3">
              <p className="text-sm text-white/60 font-semibold">
                {dayAssignments.length} {dayAssignments.length === 1 ? 'tarea' : 'tareas'}
              </p>
              {dayAssignments.map((assignment, idx) => (
                <div 
                  key={assignment._id} 
                  className="border-l-2 border-[#9f25b8] pl-3 py-1"
                  data-testid={`assignment-preview-${idx}`}
                >
                  <h4 className="font-semibold text-white text-sm">{assignment.titulo}</h4>
                  <p className="text-xs text-white/70 mt-1 line-clamp-2">
                    {assignment.descripcion}
                  </p>
                  <p className="text-xs text-[#9f25b8] mt-1">
                    Por: {assignment.profesorNombre}
                  </p>
                </div>
              ))}
              <p className="text-xs text-white/50 text-center pt-2 border-t border-white/10">
                Click para ver detalles
              </p>
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

      {/* Leyenda */}
      <div className="mt-6 flex items-center gap-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[#9f25b8] to-[#7a1a91] border-2 border-[#9f25b8]/30" />
          <span className="text-white/70">Con tareas</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-white/5 border border-white/10" />
          <span className="text-white/70">Sin tareas</span>
        </div>
      </div>
    </div>
  );
}
