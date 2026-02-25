import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card';

interface CalendarEvent {
  _id: string;
  titulo: string;
  descripcion?: string;
  fecha: string;
  tipo: 'curso' | 'colegio';
  cursoId?: { nombre: string };
}

interface CalendarGeneralProps {
  events: CalendarEvent[];
  onDayClick?: (event: CalendarEvent) => void;
}

// Paleta de colores para tipos de eventos generales
const EVENT_TYPE_COLORS: Record<string, string> = {
  'reunion': '#1e3cff',      // Azul eléctrico - Reuniones
  'evento': '#00c8ff',        // Cyan brillante - Eventos generales
  'salida': '#ffd700',        // Amarillo - Salidas
  'bloqueado': '#ef4444',     // Rojo - Días bloqueados
};

// Función para determinar el tipo de evento basado en el título o descripción
const getEventType = (event: CalendarEvent): string => {
  const tituloLower = event.titulo.toLowerCase();
  const descripcionLower = (event.descripcion || '').toLowerCase();
  const textoCompleto = `${tituloLower} ${descripcionLower}`;

  // Detectar tipo basado en palabras clave
  if (textoCompleto.includes('reunión') || textoCompleto.includes('reunion') || textoCompleto.includes('meeting')) {
    return 'reunion';
  }
  if (textoCompleto.includes('salida') || textoCompleto.includes('excursión') || textoCompleto.includes('excursion')) {
    return 'salida';
  }
  if (textoCompleto.includes('bloqueado') || textoCompleto.includes('cerrado') || textoCompleto.includes('no disponible')) {
    return 'bloqueado';
  }
  // Por defecto, es un evento general
  return 'evento';
};

export function CalendarGeneral({ events, onDayClick }: CalendarGeneralProps) {
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

  // Agrupar eventos por día y tipo
  const eventsByDay: Record<number, CalendarEvent[]> = {};
  events.forEach((event) => {
    const date = new Date(event.fecha);
    if (date.getMonth() === month && date.getFullYear() === year) {
      const day = date.getDate();
      if (!eventsByDay[day]) {
        eventsByDay[day] = [];
      }
      eventsByDay[day].push(event);
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
    const dayEvents = eventsByDay[day] || [];
    const hasEvents = dayEvents.length > 0;

    if (hasEvents) {
      // Agrupar eventos por tipo
      const eventsByType = new Map<string, CalendarEvent[]>();
      dayEvents.forEach((event) => {
        const type = getEventType(event);
        if (!eventsByType.has(type)) {
          eventsByType.set(type, []);
        }
        eventsByType.get(type)!.push(event);
      });

      const typesCount = eventsByType.size;
      const totalEvents = dayEvents.length;

      // Si hay múltiples tipos, usar color gris; si es uno solo, usar su color
      const isMultipleTypes = typesCount > 1;
      const singleType = typesCount === 1 ? Array.from(eventsByType.keys())[0] : null;
      const backgroundColor = isMultipleTypes
        ? '#6b7280'
        : (singleType ? EVENT_TYPE_COLORS[singleType] || EVENT_TYPE_COLORS['evento'] : EVENT_TYPE_COLORS['evento']);

      calendarDays.push(
        <HoverCard key={day} openDelay={200}>
          <HoverCardTrigger asChild>
            <button
              onClick={() => {
                if (dayEvents.length > 0) {
                  onDayClick?.(dayEvents[0]);
                }
              }}
              className="aspect-square rounded-full text-white font-semibold hover:opacity-80 transition-opacity flex flex-col items-center justify-center cursor-pointer border-2 relative overflow-hidden"
              style={{
                background: backgroundColor,
                borderColor: isMultipleTypes ? '#6b728099' : `${backgroundColor}99`,
              }}
              data-testid={`calendar-day-${day}`}
            >
              <span className="z-10 text-sm">{day}</span>
              {isMultipleTypes && (
                <span className="absolute bottom-1 text-[10px] font-bold text-white/90 z-10">
                  +{typesCount}
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
                  {totalEvents} {totalEvents === 1 ? 'evento' : 'eventos'} • {typesCount} {typesCount === 1 ? 'tipo' : 'tipos'}
                </p>
                <p className="text-xs text-white/60 mt-1">
                  {day} de {monthNames[month]} {year}
                </p>
              </div>
              {Array.from(eventsByType.entries()).map(([type, typeEvents]) => {
                const color = EVENT_TYPE_COLORS[type] || EVENT_TYPE_COLORS['evento'];
                const typeLabels: Record<string, string> = {
                  'reunion': 'Reunión',
                  'evento': 'Evento',
                  'salida': 'Salida',
                  'bloqueado': 'Bloqueado',
                };
                const typeLabel = typeLabels[type] || 'Evento';
                return (
                  <div key={type} className="space-y-2">
                    <div className="flex items-center gap-2 mb-1">
                      <div 
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: color }}
                      />
                      <p className="text-xs font-semibold text-white/80 uppercase tracking-wider">
                        {typeLabel}
                      </p>
                      <span className="text-xs text-white/50">
                        ({typeEvents.length})
                      </span>
                    </div>
                    {typeEvents.map((event) => (
                      <div
                        key={event._id}
                        className="border-l-4 pl-3 py-2 cursor-pointer hover:bg-white/5 rounded-r transition-colors"
                        style={{ borderColor: color }}
                        onClick={(e) => {
                          e.stopPropagation();
                          onDayClick?.(event);
                        }}
                        data-testid={`event-preview-${event._id}`}
                      >
                        <h4 className="font-semibold text-white text-sm leading-tight mb-1">
                          {event.titulo}
                        </h4>
                        {event.descripcion && (
                          <p className="text-xs text-white/70 mt-1 line-clamp-2 leading-relaxed">
                            {event.descripcion}
                          </p>
                        )}
                        <div className="flex items-center gap-2 mt-2 text-xs">
                          <span className="text-white/50">
                            {new Date(event.fecha).toLocaleTimeString('es-CO', {
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                          {event.cursoId && (
                            <>
                              <span className="text-white/30">•</span>
                              <span className="text-white/50">
                                {event.cursoId.nombre}
                              </span>
                            </>
                          )}
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

      {/* Leyenda de tipos de eventos */}
      <div className="mb-4 p-3 bg-white/5 border border-white/10 rounded-lg">
        <p className="text-xs font-semibold text-white/60 uppercase tracking-wider mb-2">
          Leyenda de eventos
        </p>
        <div className="flex flex-wrap gap-3">
          {Object.entries({
            'reunion': 'Reunión',
            'evento': 'Evento',
            'salida': 'Salida',
            'bloqueado': 'Bloqueado',
          }).map(([type, label]) => {
            const color = EVENT_TYPE_COLORS[type];
            return (
              <div key={type} className="flex items-center gap-2">
                <div 
                  className="w-4 h-4 rounded-full flex-shrink-0 border border-white/20"
                  style={{ backgroundColor: color }}
                />
                <span className="text-xs text-white/80 font-medium">{label}</span>
              </div>
            );
          })}
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

      {/* Leyenda básica */}
      <div className="mt-6 flex items-center gap-4 text-sm flex-wrap">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-[#1e3cff] border-2 border-[#1e3cff]/30" />
          <span className="text-white/70">Con eventos</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-white/5 border border-white/10" />
          <span className="text-white/70">Sin eventos</span>
        </div>
      </div>
    </div>
  );
}
