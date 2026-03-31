import {
  useState,
  useMemo,
  useCallback,
  type CSSProperties,
  type ReactNode,
  type ReactElement,
} from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { cn } from '@/lib/utils';
import {
  calendarColorKey,
  calendarDisplayLabel,
  getAssignmentCalendarLocalParts,
  type CalendarVariant,
} from '@/lib/assignmentUtils';

export interface CalendarAssignment {
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
  estado?: 'pendiente' | 'entregada' | 'calificada';
  requiresSubmission?: boolean;
  type?: string;
}

interface CalendarProps {
  assignments: CalendarAssignment[];
  onDayClick?: (assignment: CalendarAssignment) => void;
  onEmptyDayClick?: (date: Date) => void;
  onDayBubbleClick?: (date: Date) => void;
  variant?: CalendarVariant;
  currentDate?: Date;
  onCurrentDateChange?: (d: Date) => void;
}

const MATERIA_PALETTE = [
  '#1e3cff',
  '#00c8ff',
  '#ffd700',
  '#f97316',
  '#22c55e',
  '#ef4444',
  '#14b8a6',
  '#a3e635',
  '#06b6d4',
  '#eab308',
  '#002366',
  '#f59e0b',
];

const getColorForMateriaIndex = (index: number): string =>
  MATERIA_PALETTE[index % MATERIA_PALETTE.length];

type DeliveryBucket =
  | 'future'
  | 'due_today_pending'
  | 'due_today_done'
  | 'past_late'
  | 'past_ok'
  | 'no_delivery';

function requiresDelivery(a: CalendarAssignment): boolean {
  if (a.type === 'reminder') return false;
  if (a.requiresSubmission === false) return false;
  return true;
}

function getTodayParts(): { y: number; m: number; d: number } {
  const t = new Date();
  return { y: t.getFullYear(), m: t.getMonth(), d: t.getDate() };
}

function compareDay(
  y: number,
  m: number,
  d: number,
  ty: number,
  tm: number,
  td: number
): number {
  if (y !== ty) return y > ty ? 1 : -1;
  if (m !== tm) return m > tm ? 1 : -1;
  if (d !== td) return d > td ? 1 : -1;
  return 0;
}

function getDeliveryBucket(a: CalendarAssignment): DeliveryBucket | null {
  const parts = getAssignmentCalendarLocalParts(a.fechaEntrega);
  if (!parts) return null;
  if (!requiresDelivery(a)) return 'no_delivery';

  const estado = a.estado ?? 'pendiente';
  const { y: ty, m: tm, d: td } = getTodayParts();
  const cmp = compareDay(parts.year, parts.monthIndex, parts.day, ty, tm, td);

  if (cmp > 0) return 'future';
  if (cmp === 0) {
    if (estado === 'pendiente') return 'due_today_pending';
    return 'due_today_done';
  }
  if (estado === 'pendiente') return 'past_late';
  return 'past_ok';
}

const BUCKET_STATUS_COLORS: Record<
  Exclude<DeliveryBucket, 'future' | 'no_delivery'>,
  { border: string; text: string; dot: string; bg: string }
> = {
  past_ok: {
    border: 'rgba(34, 197, 94, 0.55)',
    text: '#4ade80',
    dot: '#22c55e',
    bg: 'rgba(34, 197, 94, 0.08)',
  },
  past_late: {
    border: 'rgba(239, 68, 68, 0.55)',
    text: '#f87171',
    dot: '#ef4444',
    bg: 'rgba(239, 68, 68, 0.08)',
  },
  due_today_pending: {
    border: 'rgba(245, 158, 11, 0.65)',
    text: '#fbbf24',
    dot: '#f59e0b',
    bg: 'rgba(245, 158, 11, 0.1)',
  },
  due_today_done: {
    border: 'rgba(34, 197, 94, 0.55)',
    text: '#4ade80',
    dot: '#22c55e',
    bg: 'rgba(34, 197, 94, 0.1)',
  },
};

const NO_DELIVERY_STYLE = {
  border: 'rgba(156, 163, 175, 0.45)',
  text: 'rgba(255,255,255,0.85)',
  dot: '#9ca3af',
  bg: 'rgba(107, 114, 128, 0.12)',
};

function isStatusBucket(b: DeliveryBucket): b is Exclude<DeliveryBucket, 'future' | 'no_delivery'> {
  return b !== 'future' && b !== 'no_delivery';
}

export function Calendar({
  assignments,
  onDayClick,
  onEmptyDayClick,
  onDayBubbleClick,
  variant = 'student',
  currentDate: controlledDate,
  onCurrentDateChange,
}: CalendarProps) {
  const [internalDate, setInternalDate] = useState(() => new Date());
  const currentDate = controlledDate ?? internalDate;

  const setMonth = useCallback(
    (next: Date) => {
      if (onCurrentDateChange) onCurrentDateChange(next);
      else setInternalDate(next);
    },
    [onCurrentDateChange]
  );

  const isStudent = variant === 'student';
  const legendTitle = isStudent ? 'Leyenda de materias' : 'Leyenda de cursos';
  const multipleLabel = isStudent ? 'Varias materias' : 'Varios cursos';

  const monthNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
  ];
  const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);
  const daysInMonth = lastDayOfMonth.getDate();
  const startingDayOfWeek = firstDayOfMonth.getDay();

  const tasksThisMonth = useMemo(() => {
    let n = 0;
    for (const a of assignments) {
      const p = getAssignmentCalendarLocalParts(a.fechaEntrega);
      if (p && p.year === year && p.monthIndex === month) n++;
    }
    return n;
  }, [assignments, year, month]);

  const uniqueKeys = useMemo(() => {
    const keys = new Set<string>();
    assignments.forEach((a) => {
      const key = calendarColorKey(a, variant);
      if (key) keys.add(key);
    });
    return Array.from(keys).sort();
  }, [assignments, variant]);

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

  const colorMap = useMemo(() => {
    const map = new Map<string, string>();
    uniqueKeys.forEach((key, index) => {
      map.set(key, getColorForMateriaIndex(index));
    });
    return map;
  }, [uniqueKeys]);

  const assignmentsByDay: Record<number, CalendarAssignment[]> = {};
  assignments.forEach((assignment) => {
    const parts = getAssignmentCalendarLocalParts(assignment.fechaEntrega);
    if (!parts || parts.monthIndex !== month || parts.year !== year) return;
    const d = parts.day;
    if (!assignmentsByDay[d]) assignmentsByDay[d] = [];
    assignmentsByDay[d].push(assignment);
  });

  function bucketPriority(b: DeliveryBucket): number {
    switch (b) {
      case 'past_late':
        return 4;
      case 'due_today_pending':
        return 3;
      case 'due_today_done':
      case 'past_ok':
        return 2;
      case 'future':
        return 1;
      case 'no_delivery':
        return 0;
      default:
        return 0;
    }
  }

  function worstBucket(buckets: DeliveryBucket[]): DeliveryBucket {
    return buckets.reduce((w, b) => (bucketPriority(b) > bucketPriority(w) ? b : w), buckets[0]);
  }

  function dotForBucket(b: DeliveryBucket, subjectColor: string): string {
    if (b === 'future') return subjectColor;
    if (b === 'no_delivery') return NO_DELIVERY_STYLE.dot;
    return BUCKET_STATUS_COLORS[b].dot;
  }

  const calendarDays: ReactElement[] = [];

  for (let i = 0; i < startingDayOfWeek; i++) {
    calendarDays.push(<div key={`empty-${i}`} className="min-h-[92px] sm:min-h-[100px]" />);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const dayAssignments = assignmentsByDay[day] || [];
    const hasAssignments = dayAssignments.length > 0;

    if (!hasAssignments) {
      const dayDate = new Date(year, month, day);
      calendarDays.push(
        <button
          type="button"
          key={day}
          onClick={() => {
            if (onDayBubbleClick) onDayBubbleClick(dayDate);
            else onEmptyDayClick?.(dayDate);
          }}
          className="min-h-[92px] sm:min-h-[100px] rounded-xl border border-white/10 bg-white/[0.03] text-white/45 text-sm font-medium hover:bg-white/[0.06] transition-colors flex flex-col items-center justify-center"
          data-testid={`calendar-day-${day}`}
        >
          {day}
        </button>
      );
      continue;
    }

    const assignmentsByKey = new Map<string, CalendarAssignment[]>();
    dayAssignments.forEach((a) => {
      const k = calendarColorKey(a, variant) || (isStudent ? 'Sin materia' : 'Sin curso');
      if (!assignmentsByKey.has(k)) assignmentsByKey.set(k, []);
      assignmentsByKey.get(k)!.push(a);
    });
    const keyCount = assignmentsByKey.size;
    const total = dayAssignments.length;
    const cellDate = new Date(year, month, day);

    const defaultActivate = () => {
      if (onDayBubbleClick) onDayBubbleClick(cellDate);
      else if (dayAssignments.length > 0) onDayClick?.(dayAssignments[0]);
    };

    const hoverBody = (
      <>
        <div className="pb-2 border-b border-white/10">
          <p className="text-sm font-semibold text-white">
            {total} {total === 1 ? 'tarea' : 'tareas'} • {keyCount}{' '}
            {isStudent ? (keyCount === 1 ? 'materia' : 'materias') : keyCount === 1 ? 'curso' : 'cursos'}
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
                <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                <p className="text-xs font-semibold text-white/80 uppercase tracking-wider">{label}</p>
                <span className="text-xs text-white/50">({keyAssignments.length})</span>
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
                  <h4 className="font-semibold text-white text-sm leading-tight mb-1">{assignment.titulo}</h4>
                  <p className="text-xs text-white/70 mt-1 line-clamp-2 leading-relaxed">{assignment.descripcion}</p>
                  <div className="flex items-center gap-2 mt-2 text-xs">
                    <span className="text-white/50">
                      {new Date(assignment.fechaEntrega).toLocaleTimeString('es-CO', {
                        hour: '2-digit',
                        minute: '2-digit',
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
      </>
    );

    const pushDay = (inner: ReactNode, testId: string, buttonClassName?: string, buttonStyle?: CSSProperties) => {
      calendarDays.push(
        <HoverCard key={day} openDelay={200}>
          <HoverCardTrigger asChild>
            <button
              type="button"
              onClick={defaultActivate}
              className={cn(
                'min-h-[92px] sm:min-h-[100px] rounded-xl flex flex-col items-stretch justify-between p-2 sm:p-2.5 text-left transition-opacity hover:opacity-95 cursor-pointer relative overflow-hidden w-full border',
                buttonClassName
              )}
              style={buttonStyle}
              data-testid={testId}
            >
              {inner}
            </button>
          </HoverCardTrigger>
          <HoverCardContent
            className="w-80 bg-black/95 border-[#1e3cff]/30 backdrop-blur-lg max-h-96 overflow-y-auto"
            data-testid={`hover-card-day-${day}`}
          >
            <div className="space-y-3">{hoverBody}</div>
          </HoverCardContent>
        </HoverCard>
      );
    };

    if (!isStudent) {
      const firstKey = Array.from(assignmentsByKey.keys())[0];
      const isMultiple = keyCount > 1;
      const singleColor = keyCount === 1 ? colorMap.get(firstKey) || '#1e3cff' : null;
      const backgroundColor = isMultiple ? '#6b7280' : singleColor || '#1e3cff';
      const dayLabel =
        keyCount === 1 ? keyToLabel.get(firstKey) || firstKey : `+${keyCount} cursos`;

      pushDay(
        <>
          <div className="flex justify-between items-start z-10">
            <span className="text-lg font-bold text-white leading-none">{day}</span>
            <span
              className="w-2 h-2 rounded-full shrink-0 mt-0.5 bg-white/90"
              style={{ opacity: isMultiple ? 0.7 : 1 }}
            />
          </div>
          <span className="text-[10px] sm:text-[11px] font-medium text-white/95 leading-tight line-clamp-2 z-10">
            {dayLabel}
          </span>
          <div className="absolute inset-0 z-0 opacity-95" style={{ background: backgroundColor }} />
        </>,
        `calendar-day-${day}`,
        'border-2',
        {
          background: backgroundColor,
          borderColor: isMultiple ? 'rgba(107,114,128,0.6)' : `${backgroundColor}99`,
        }
      );
      continue;
    }

    const buckets = dayAssignments
      .map((a) => getDeliveryBucket(a))
      .filter((b): b is DeliveryBucket => b !== null);
    const allFuture = buckets.length > 0 && buckets.every((b) => b === 'future');
    const allNoDelivery = buckets.length > 0 && buckets.every((b) => b === 'no_delivery');

    if (keyCount === 1 && total === 1) {
      const a = dayAssignments[0];
      const b = buckets[0] ?? 'no_delivery';
      const key = calendarColorKey(a, variant) || 'Sin materia';
      const subjectColor = colorMap.get(key) || MATERIA_PALETTE[0];
      const label = keyToLabel.get(key) || calendarDisplayLabel(a, variant);

      if (b === 'future') {
        pushDay(
          <>
            <div className="flex justify-between items-start z-10">
              <span className="text-lg font-bold text-white leading-none">{day}</span>
              <span className="w-2 h-2 rounded-full shrink-0 mt-0.5 bg-white/90" />
            </div>
            <span className="text-[10px] sm:text-[11px] font-semibold text-white leading-tight line-clamp-2 z-10">
              {label}
            </span>
            <div className="absolute inset-0 z-0" style={{ background: subjectColor }} />
          </>,
          `calendar-day-${day}`,
          'border-white/20',
          { borderColor: `${subjectColor}88` }
        );
        continue;
      }

      if (b === 'no_delivery') {
        pushDay(
          <>
            <div className="flex justify-between items-start z-10">
              <span className="text-lg font-bold leading-none" style={{ color: NO_DELIVERY_STYLE.text }}>
                {day}
              </span>
              <span
                className="w-2 h-2 rounded-full shrink-0 mt-0.5"
                style={{ backgroundColor: NO_DELIVERY_STYLE.dot }}
              />
            </div>
            <span
              className="text-[10px] sm:text-[11px] font-semibold leading-tight line-clamp-2 z-10"
              style={{ color: NO_DELIVERY_STYLE.text }}
            >
              {label}
            </span>
            <div className="absolute inset-0 z-0" style={{ background: NO_DELIVERY_STYLE.bg }} />
          </>,
          `calendar-day-${day}`,
          undefined,
          { borderColor: NO_DELIVERY_STYLE.border }
        );
        continue;
      }

      if (isStatusBucket(b)) {
        const st = BUCKET_STATUS_COLORS[b];
        pushDay(
          <>
            <div className="flex justify-between items-start z-10">
              <span className="text-lg font-bold leading-none" style={{ color: st.text }}>
                {day}
              </span>
              <span className="w-2 h-2 rounded-full shrink-0 mt-0.5" style={{ backgroundColor: st.dot }} />
            </div>
            <span className="text-[10px] sm:text-[11px] font-semibold leading-tight line-clamp-2 z-10" style={{ color: st.text }}>
              {label}
            </span>
            <div className="absolute inset-0 z-0" style={{ background: st.bg }} />
          </>,
          `calendar-day-${day}`,
          undefined,
          { borderColor: st.border }
        );
      }
      continue;
    }

    if (keyCount === 1 && total > 1) {
      const firstKey = Array.from(assignmentsByKey.keys())[0];
      const subjectColor = colorMap.get(firstKey) || MATERIA_PALETTE[0];
      const merged = worstBucket(buckets);

      if (merged === 'future' && allFuture) {
        pushDay(
          <>
            <div className="flex justify-between items-start z-10">
              <span className="text-lg font-bold text-white leading-none">{day}</span>
              <span className="w-2 h-2 rounded-full shrink-0 mt-0.5 bg-white/90" />
            </div>
            <span className="text-[10px] sm:text-[11px] font-semibold text-white leading-tight line-clamp-2 z-10">
              +{total} tareas
            </span>
            <div className="absolute inset-0 z-0" style={{ background: subjectColor }} />
          </>,
          `calendar-day-${day}`,
          'border-white/20',
          { borderColor: `${subjectColor}88` }
        );
        continue;
      }

      if (merged === 'future') {
        const dots = dayAssignments.map((a) => {
          const k = calendarColorKey(a, variant) || '';
          return colorMap.get(k) || '#9ca3af';
        });
        pushDay(
          <>
            <div className="flex justify-between items-start z-10">
              <span className="text-lg font-bold text-white leading-none">{day}</span>
            </div>
            <span className="text-[10px] sm:text-[11px] font-semibold text-white/90 leading-tight z-10">+{total} tareas</span>
            <div className="flex flex-wrap gap-1 z-10 mt-auto pt-1 justify-center">
              {dots.map((c, i) => (
                <span key={i} className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: c }} />
              ))}
            </div>
            <div className="absolute inset-0 z-0 bg-white/[0.06]" />
          </>,
          `calendar-day-${day}`,
          'border-white/12'
        );
        continue;
      }

      if (merged === 'no_delivery' || allNoDelivery) {
        pushDay(
          <>
            <div className="flex justify-between items-start z-10">
              <span className="text-lg font-bold leading-none" style={{ color: NO_DELIVERY_STYLE.text }}>
                {day}
              </span>
              <span className="w-2 h-2 rounded-full shrink-0 mt-0.5" style={{ backgroundColor: NO_DELIVERY_STYLE.dot }} />
            </div>
            <span className="text-[10px] sm:text-[11px] font-semibold leading-tight line-clamp-2 z-10 text-white/90">
              +{total} tareas
            </span>
            <div className="absolute inset-0 z-0" style={{ background: NO_DELIVERY_STYLE.bg }} />
          </>,
          `calendar-day-${day}`,
          undefined,
          { borderColor: NO_DELIVERY_STYLE.border }
        );
        continue;
      }

      if (isStatusBucket(merged)) {
        const st = BUCKET_STATUS_COLORS[merged];
        pushDay(
          <>
            <div className="flex justify-between items-start z-10">
              <span className="text-lg font-bold leading-none" style={{ color: st.text }}>
                {day}
              </span>
              <span className="w-2 h-2 rounded-full shrink-0 mt-0.5" style={{ backgroundColor: st.dot }} />
            </div>
            <span className="text-[10px] sm:text-[11px] font-semibold leading-tight line-clamp-2 z-10" style={{ color: st.text }}>
              +{total} tareas
            </span>
            <div className="absolute inset-0 z-0" style={{ background: st.bg }} />
          </>,
          `calendar-day-${day}`,
          undefined,
          { borderColor: st.border }
        );
      }
      continue;
    }

    const subjectDots = Array.from(assignmentsByKey.keys()).map((key) => colorMap.get(key) || '#9ca3af');
    const statusDots = dayAssignments.map((a) => {
      const bk = getDeliveryBucket(a) ?? 'no_delivery';
      const k = calendarColorKey(a, variant) || '';
      const subCol = colorMap.get(k) || '#9ca3af';
      return dotForBucket(bk, subCol);
    });

    if (allFuture) {
      pushDay(
        <>
          <div className="flex justify-between items-start z-10">
            <span className="text-lg font-bold text-white leading-none">{day}</span>
          </div>
          <span className="text-[10px] sm:text-[11px] font-semibold text-white/90 leading-tight z-10">+{keyCount} materias</span>
          <div className="flex flex-wrap gap-1 z-10 mt-auto pt-1 justify-center">
            {subjectDots.map((c, i) => (
              <span key={i} className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: c }} />
            ))}
          </div>
          <div
            className="absolute inset-0 z-0 bg-white/[0.06]"
            style={{ borderRadius: 'inherit' }}
          />
        </>,
        `calendar-day-${day}`,
        'border-white/12'
      );
      continue;
    }

    const dominant = worstBucket(buckets);
    const neutralBg = 'rgba(15, 23, 42, 0.55)';
    const borderCol =
      dominant === 'past_late'
        ? BUCKET_STATUS_COLORS.past_late.border
        : dominant === 'due_today_pending'
          ? BUCKET_STATUS_COLORS.due_today_pending.border
          : dominant === 'no_delivery' || allNoDelivery
            ? NO_DELIVERY_STYLE.border
            : 'rgba(255,255,255,0.12)';

    pushDay(
      <>
        <div className="flex justify-between items-start z-10">
          <span className="text-lg font-bold text-white/95 leading-none">{day}</span>
        </div>
        <span className="text-[10px] sm:text-[11px] font-semibold text-white/80 leading-tight z-10">+{keyCount} materias</span>
        <div className="flex flex-wrap gap-1 z-10 mt-auto pt-1 justify-center">
          {statusDots.map((c, i) => (
            <span key={i} className="w-2 h-2 rounded-full shrink-0 ring-1 ring-white/20" style={{ backgroundColor: c }} />
          ))}
        </div>
        <div className="absolute inset-0 z-0" style={{ background: neutralBg }} />
      </>,
      `calendar-day-${day}`,
      undefined,
      { borderColor: borderCol }
    );
  }

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <h3 className="text-xl font-bold text-white font-['Poppins']">
          {monthNames[month]} {year}
        </h3>
        <div className="flex gap-2">
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setMonth(new Date(year, month - 1, 1))}
            className="text-white rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 h-9 w-9"
            data-testid="button-prev-month"
          >
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setMonth(new Date(year, month + 1, 1))}
            className="text-white rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 h-9 w-9"
            data-testid="button-next-month"
          >
            <ChevronRight className="w-5 h-5" />
          </Button>
        </div>
      </div>

      <p className="text-sm text-white/60 mb-5">
        {tasksThisMonth} {tasksThisMonth === 1 ? 'tarea asignada' : 'tareas asignadas'} este mes
      </p>

      {uniqueKeys.length > 0 && (
        <div className="mb-5 p-3 sm:p-4 rounded-2xl bg-white/[0.06] border border-white/10 backdrop-blur-md">
          <p className="text-xs font-semibold text-white/55 uppercase tracking-wider mb-2.5">{legendTitle}</p>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {uniqueKeys.map((key) => {
              const color = colorMap.get(key) || '#1e3cff';
              const label = keyToLabel.get(key) || key;
              return (
                <div key={key} className="flex items-center gap-2">
                  <div className="w-3.5 h-3.5 rounded-full flex-shrink-0 border border-white/15" style={{ backgroundColor: color }} />
                  <span className="text-xs text-white/85 font-medium">{label}</span>
                </div>
              );
            })}
            {uniqueKeys.length > 1 && (
              <div className="flex items-center gap-2">
                <div className="w-3.5 h-3.5 rounded-full flex-shrink-0 bg-gray-500 border border-white/15" />
                <span className="text-xs text-white/85 font-medium">{multipleLabel}</span>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-7 gap-1.5 sm:gap-2 mb-2">
        {dayNames.map((d) => (
          <div key={d} className="text-center text-xs sm:text-sm font-semibold text-white/45 py-1.5">
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1.5 sm:gap-2">{calendarDays}</div>

      {isStudent && (
        <div className="mt-6 p-3 sm:p-4 rounded-2xl bg-white/[0.05] border border-white/10">
          <p className="text-xs font-semibold text-white/55 uppercase tracking-wider mb-3">Estados de entrega</p>
          <ul className="space-y-2 text-xs text-white/75">
            <li className="flex items-start gap-2">
              <span className="w-2.5 h-2.5 rounded-full mt-0.5 shrink-0 bg-emerald-500" />
              <span>Verde: entregado a tiempo (o sin pendiente tras la fecha límite).</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="w-2.5 h-2.5 rounded-full mt-0.5 shrink-0 bg-red-500" />
              <span>Rojo: no entregado o vencido.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="w-2.5 h-2.5 rounded-full mt-0.5 shrink-0 bg-amber-500" />
              <span>Ámbar: vence hoy y aún está pendiente.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="w-2.5 h-2.5 rounded-full mt-0.5 shrink-0 bg-[#1e3cff]" />
              <span>Color vivo (relleno): tarea futura con entrega requerida.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="w-2.5 h-2.5 rounded-full mt-0.5 shrink-0 bg-gray-400" />
              <span>Gris: sin entrega requerida (recordatorio u otro).</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="flex gap-0.5 mt-0.5 shrink-0">
                <span className="w-2 h-2 rounded-full bg-[#1e3cff]" />
                <span className="w-2 h-2 rounded-full bg-orange-500" />
              </span>
              <span>Puntitos: varias materias o varios estados el mismo día.</span>
            </li>
          </ul>
        </div>
      )}
    </div>
  );
}
