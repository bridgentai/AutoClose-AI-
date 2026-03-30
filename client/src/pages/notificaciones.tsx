import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Bell,
  CheckCheck,
  ClipboardList,
  Clock,
  MessageCircle,
  ShieldAlert,
  Upload,
  CheckCircle2,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { useLocation } from 'wouter';

type FilterKey = 'todas' | 'sin_leer' | 'tareas' | 'mensajes' | 'asistencia' | 'amonestaciones';

interface NotifItem {
  _id: string;
  titulo: string;
  cuerpo?: string;
  body?: string;
  leido: boolean;
  fecha: string;
  type?: string;
  /** Desde API PG (entity_type) */
  entityType?: string | null;
  actionUrl?: string | null;
}

function timeAgo(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / (60 * 1000));
  if (diffMin <= 0) return 'ahora mismo';
  if (diffMin < 60) return `hace ${diffMin} min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `hace ${diffH}h`;

  const startToday = new Date(now);
  startToday.setHours(0, 0, 0, 0);
  const startThat = new Date(d);
  startThat.setHours(0, 0, 0, 0);
  const dayDiff = Math.round((startToday.getTime() - startThat.getTime()) / (24 * 60 * 60 * 1000));
  if (dayDiff === 1) return 'ayer';
  if (dayDiff >= 2 && dayDiff <= 6) {
    return d.toLocaleDateString('es-CO', { weekday: 'long' });
  }
  return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' });
}

function sectionLabel(iso: string): 'Hoy' | 'Ayer' | 'Esta semana' | 'Anteriores' {
  const d = new Date(iso);
  const now = new Date();
  const startToday = new Date(now);
  startToday.setHours(0, 0, 0, 0);
  const startThat = new Date(d);
  startThat.setHours(0, 0, 0, 0);
  const dayDiff = Math.round((startToday.getTime() - startThat.getTime()) / (24 * 60 * 60 * 1000));
  if (dayDiff === 0) return 'Hoy';
  if (dayDiff === 1) return 'Ayer';
  if (dayDiff >= 2 && dayDiff <= 6) return 'Esta semana';
  return 'Anteriores';
}

function typeLabel(t?: string) {
  switch (t) {
    case 'nueva_tarea':
    case 'nueva_asignacion':
      return 'Tarea';
    case 'tarea_calificada':
      return 'Calificación';
    case 'entrega_recibida':
      return 'Entrega';
    case 'tarea_vence':
      return 'Vence';
    case 'mensaje':
    case 'evo_chat_direct':
      return 'Mensaje';
    case 'ausencia':
      return 'Asistencia';
    case 'amonestacion':
      return 'Amonestación';
    default:
      return 'General';
  }
}

function typeMeta(t?: string) {
  switch (t) {
    case 'nueva_tarea':
    case 'nueva_asignacion':
      return { Icon: ClipboardList, bg: 'rgba(37,99,235,0.15)', fg: '#60a5fa' };
    case 'tarea_calificada':
      return { Icon: CheckCircle2, bg: 'rgba(22,163,74,0.12)', fg: '#4ade80' };
    case 'entrega_recibida':
      return { Icon: Upload, bg: 'rgba(124,58,237,0.12)', fg: '#a78bfa' };
    case 'ausencia':
      return { Icon: AlertTriangle, bg: 'rgba(245,158,11,0.1)', fg: '#fbbf24' };
    case 'amonestacion':
      return { Icon: ShieldAlert, bg: 'rgba(239,68,68,0.1)', fg: '#f87171' };
    case 'mensaje':
    case 'evo_chat_direct':
      return { Icon: MessageCircle, bg: 'rgba(6,182,212,0.1)', fg: '#67e8f9' };
    case 'tarea_vence':
      return { Icon: Clock, bg: 'rgba(245,158,11,0.1)', fg: '#fbbf24' };
    default:
      return { Icon: Bell, bg: 'rgba(255,255,255,0.06)', fg: 'rgba(255,255,255,0.55)' };
  }
}

const TASK_NOTIFICATION_TYPES = new Set([
  'nueva_tarea',
  'nueva_asignacion',
  'tarea_calificada',
  'entrega_recibida',
  'tarea_vence',
]);

function isTaskNotification(n: NotifItem): boolean {
  const t = (n.type ?? 'general').toLowerCase();
  if (TASK_NOTIFICATION_TYPES.has(t)) return true;
  if (n.entityType === 'assignment') return true;
  return false;
}

function isMessageNotification(n: NotifItem): boolean {
  const t = (n.type ?? '').toLowerCase();
  if (t === 'mensaje' || t === 'evo_chat_direct') return true;
  if (n.entityType === 'evo_send_thread') return true;
  return false;
}

function isAttendanceNotification(n: NotifItem): boolean {
  const t = (n.type ?? '').toLowerCase();
  return t === 'ausencia' || t === 'asistencia';
}

function matchesFilter(n: NotifItem, filter: FilterKey) {
  if (filter === 'todas') return true;
  if (filter === 'sin_leer') return !n.leido;
  if (filter === 'tareas') return isTaskNotification(n);
  if (filter === 'mensajes') return isMessageNotification(n);
  if (filter === 'asistencia') return isAttendanceNotification(n);
  if (filter === 'amonestaciones') return (n.type ?? '').toLowerCase() === 'amonestacion';
  return true;
}

export default function NotificacionesPage() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<FilterKey>('todas');

  const { data, isLoading } = useQuery({
    queryKey: ['/api/notifications', 'v2'],
    queryFn: () =>
      apiRequest<{ list: NotifItem[]; unreadCount: number }>('GET', '/api/notifications?limit=100'),
  });

  const markOneMutation = useMutation({
    mutationFn: (id: string) => apiRequest('PATCH', `/api/notifications/${id}/read`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-unread'] });
    },
  });

  const markAllMutation = useMutation({
    mutationFn: () => apiRequest('POST', '/api/notifications/mark-all-read'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-unread'] });
    },
  });

  const rawList = data?.list ?? [];
  const unreadCount = data?.unreadCount ?? 0;

  const list = useMemo(() => rawList.filter((n) => matchesFilter(n, filter)), [rawList, filter]);

  const chipCounts = useMemo(() => {
    const sinLeer = rawList.filter((n) => !n.leido).length;
    return {
      todas: rawList.length,
      sin_leer: sinLeer,
      tareas: rawList.filter((n) => matchesFilter(n, 'tareas')).length,
      mensajes: rawList.filter((n) => matchesFilter(n, 'mensajes')).length,
      asistencia: rawList.filter((n) => matchesFilter(n, 'asistencia')).length,
      amonestaciones: rawList.filter((n) => matchesFilter(n, 'amonestaciones')).length,
    } as Record<FilterKey, number>;
  }, [rawList]);

  const grouped = useMemo(() => {
    const buckets: Record<'Hoy' | 'Ayer' | 'Esta semana' | 'Anteriores', NotifItem[]> = {
      Hoy: [],
      Ayer: [],
      'Esta semana': [],
      Anteriores: [],
    };
    for (const n of list) {
      const k = sectionLabel(n.fecha);
      buckets[k].push(n);
    }
    return buckets;
  }, [list]);

  const emptySubtitle = (() => {
    switch (filter) {
      case 'sin_leer':
        return 'No tienes notificaciones sin leer.';
      case 'tareas':
        return 'No hay notificaciones de tareas.';
      case 'mensajes':
        return 'No hay mensajes nuevos.';
      case 'asistencia':
        return 'No hay alertas de asistencia.';
      case 'amonestaciones':
        return 'No hay amonestaciones recientes.';
      default:
        return 'Todo al día.';
    }
  })();

  const chips: Array<{ key: FilterKey; label: string }> = [
    { key: 'todas', label: 'Todas' },
    { key: 'sin_leer', label: 'Sin leer' },
    { key: 'tareas', label: 'Tareas' },
    { key: 'mensajes', label: 'Mensajes' },
    { key: 'asistencia', label: 'Asistencia' },
    { key: 'amonestaciones', label: 'Amonestaciones' },
  ];

  const chipCount = (key: FilterKey) => chipCounts[key];

  const renderSection = (title: keyof typeof grouped) => {
    const items = grouped[title];
    if (!items.length) return null;
    return (
      <div key={title} className="mt-6">
        <div className="flex items-center gap-3 mb-3">
          <div className="text-xs uppercase tracking-[0.18em] text-white/35">{title}</div>
          <div className="h-px flex-1 bg-white/10" />
        </div>
        <ul className="space-y-2">
          {items.map((n) => {
            const visualType =
              !n.type || n.type === 'general'
                ? n.entityType === 'assignment'
                  ? 'nueva_tarea'
                  : n.entityType === 'evo_send_thread'
                    ? 'mensaje'
                    : n.type
                : n.type;
            const { Icon, bg, fg } = typeMeta(visualType);
            const body = n.cuerpo ?? n.body ?? '';
            const handleClick = async () => {
              if (!n.leido) {
                await markOneMutation.mutateAsync(n._id);
              }
              if (n.actionUrl) setLocation(n.actionUrl);
            };

            return (
              <li key={n._id}>
                <button
                  type="button"
                  onClick={handleClick}
                  className={[
                    'w-full text-left rounded-xl border transition-colors px-4 py-3',
                    'hover:bg-white/5',
                    n.leido
                      ? 'bg-white/[0.02] border-white/10'
                      : 'bg-[#2563eb]/[0.04] border-white/10 border-l-2 border-l-[#3b82f6]',
                  ].join(' ')}
                >
                  <div className="flex items-start gap-3">
                    {/* Punto azul */}
                    <div className="w-2 flex items-center justify-center pt-1.5">
                      {!n.leido ? <div className="w-2 h-2 rounded-full bg-[#3b82f6]" /> : <div className="w-2 h-2" />}
                    </div>

                    {/* Icon */}
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                      style={{ background: bg }}
                    >
                      <Icon className="w-5 h-5" style={{ color: fg }} />
                    </div>

                    {/* Content */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div
                            className={[
                              'text-sm leading-5',
                              n.leido ? 'font-normal text-white/60' : 'font-semibold text-white',
                            ].join(' ')}
                          >
                            {n.titulo}
                          </div>
                        </div>
                        <div className="text-xs text-white/35 whitespace-nowrap">{timeAgo(n.fecha)}</div>
                      </div>

                      {body ? (
                        <div className="text-[13px] leading-5 text-white/45 mt-1 whitespace-pre-wrap">
                          {body}
                        </div>
                      ) : null}

                      <div className="mt-2">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] border border-white/10 bg-white/[0.03] text-white/60">
                          {typeLabel(visualType)}
                        </span>
                      </div>
                    </div>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    );
  };

  return (
    <div className="w-full">
      <div className="w-full">
        {/* Header */}
        <div className="flex items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/[0.04] border border-white/10 flex items-center justify-center">
              <Bell className="w-5 h-5 text-[#60a5fa]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl sm:text-3xl font-bold text-white font-['Poppins']">Notificaciones</h1>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs border border-white/10 bg-white/[0.03] text-white/70">
                  {unreadCount} sin leer
                </span>
              </div>
              <p className="text-white/45 text-sm mt-1">Mensajes y avisos del colegio</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className="border-white/15 text-white hover:bg-white/5 min-h-[44px]"
              onClick={() => markAllMutation.mutate()}
              disabled={markAllMutation.isPending || unreadCount === 0}
            >
              <CheckCheck className="w-4 h-4 mr-2" />
              Marcar todas leídas
            </Button>
          </div>
        </div>

        {/* Chips */}
        <div className="mt-6 flex flex-wrap gap-2">
          {chips.map((c) => {
            const active = c.key === filter;
            const count = chipCount(c.key);
            return (
              <button
                key={c.key}
                type="button"
                aria-pressed={active}
                onClick={() => setFilter(c.key)}
                className={[
                  'inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm border transition-colors',
                  active
                    ? 'text-[#93c5fd] border-[rgba(37,99,235,0.3)] bg-[rgba(37,99,235,0.15)]'
                    : 'text-white/60 border-white/10 bg-white/[0.02] hover:bg-white/[0.04]',
                ].join(' ')}
              >
                <span>{c.label}</span>
                <span
                  className={[
                    'tabular-nums text-[11px] font-semibold min-w-[1.25rem] text-center px-1.5 py-0 rounded-full',
                    active ? 'bg-[rgba(37,99,235,0.35)] text-white' : 'bg-white/[0.08] text-white/55',
                  ].join(' ')}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="mt-12 text-white/50">Cargando…</div>
        ) : list.length === 0 ? (
          <div className="mt-16 flex flex-col items-center text-center">
            <Bell className="w-14 h-14" style={{ color: 'rgba(255,255,255,0.1)' }} />
            <div className="mt-4 text-white font-semibold">Todo al día</div>
            <div className="mt-1 text-sm text-white/45">{emptySubtitle}</div>
          </div>
        ) : (
          <>
            {renderSection('Hoy')}
            {renderSection('Ayer')}
            {renderSection('Esta semana')}
            {renderSection('Anteriores')}
          </>
        )}
      </div>
    </div>
  );
}
