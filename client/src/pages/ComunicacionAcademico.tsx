import React, { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocation, useRoute } from 'wouter';
import { useAuth } from '@/lib/authContext';
import {
  Megaphone,
  Plus,
  Send,
  Loader2,
  MessageCircle,
  Pencil,
  Users,
  ClipboardList,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { NavBackButton } from '@/components/nav-back-button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import {
  ComunicadoWorkspaceAttachments,
  ComunicadoAttachmentLinks,
} from '@/components/ComunicadoWorkspaceAttachments';
import {
  parseComunicadoAttachments,
  type ComunicadoAttachment,
} from '@/lib/comunicadoAttachments';
import { cn } from '@/lib/utils';

interface CourseListItem {
  id: string;
  _id?: string;
  nombre: string;
  cursos?: string[];
  groupId?: string;
}

interface SidebarStat {
  group_subject_id: string;
  pending: number;
  awaiting_read: number;
  badge: number;
}

interface ParentReply {
  id: string;
  content: string;
  created_at: string;
  sender_id: string;
  parent_display_name?: string;
  linked_student_names?: string | null;
}

interface ComunicadoPadresItem {
  id: string;
  title: string;
  body: string | null;
  status: string | null;
  priority: string | null;
  category?: string | null;
  assignment_id?: string | null;
  created_at: string;
  sent_at: string | null;
  scheduled_send_at: string | null;
  cancelled_at: string | null;
  corrected_at: string | null;
  correction_of: string | null;
  created_by_id: string;
  group_id?: string | null;
  group_subject_id?: string | null;
  attachments_json?: unknown;
  reads_count: number;
  total_recipients: number;
  has_correction: boolean;
  replies_count: number;
  subject_name: string | null;
  group_name: string | null;
  author_name: string | null;
  author_role?: string | null;
  staff_last_read_at?: string | null;
  is_read?: boolean;
  parent_replies: ParentReply[];
}

function authHeaders(): HeadersInit {
  const token = localStorage.getItem('autoclose_token') || localStorage.getItem('token');
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

function formatRelative(iso: string): string {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'ahora';
  if (m < 60) return `hace ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h} h`;
  return d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
}

function formatTimeOnly(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
}

type ComunicadoDraftSlice = {
  title: string;
  body: string;
  attachments: ComunicadoAttachment[];
  recipientMode: 'all' | 'selected';
  selectedParentIds: string[];
};

const EMPTY_COMUNICADO_DRAFT: ComunicadoDraftSlice = {
  title: '',
  body: '',
  attachments: [],
  recipientMode: 'all',
  selectedParentIds: [],
};

const CountdownBanner: React.FC<{
  scheduledAt: string;
  onCancel: () => void;
  cancelling: boolean;
}> = ({ scheduledAt, onCancel, cancelling }) => {
  const [sec, setSec] = useState(0);
  useEffect(() => {
    const tick = () => {
      const t = new Date(scheduledAt).getTime() - Date.now();
      setSec(Math.max(0, Math.ceil(t / 1000)));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [scheduledAt]);
  return (
    <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-100 flex flex-wrap items-center justify-between gap-2">
      <span>Enviando en {sec}s…</span>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="border-amber-500/50 text-amber-100 hover:bg-amber-500/20"
        disabled={cancelling}
        onClick={onCancel}
      >
        Cancelar
      </Button>
    </div>
  );
};

const ComunicacionAcademico: React.FC = () => {
  const [, setLocation] = useLocation();
  const [matchRoute, paramsRoute] = useRoute('/comunicacion/academico/:materiaId');
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isPadre = user?.rol === 'padre';
  const canPublish =
    !!user?.rol &&
    ['profesor', 'directivo', 'admin-general-colegio', 'asistente'].includes(user.rol);

  const selectedGs = matchRoute && paramsRoute?.materiaId ? paramsRoute.materiaId : '';

  const [draftsByGs, setDraftsByGs] = useState<Record<string, ComunicadoDraftSlice>>({});
  const [previewOpen, setPreviewOpen] = useState(false);
  const [correctionFor, setCorrectionFor] = useState<ComunicadoPadresItem | null>(null);
  const [corrTitle, setCorrTitle] = useState('');
  const [corrBody, setCorrBody] = useState('');
  const [corrAttachments, setCorrAttachments] = useState<ComunicadoAttachment[]>([]);
  const [replyText, setReplyText] = useState<Record<string, string>>({});
  const [openedRead, setOpenedRead] = useState<Set<string>>(() => new Set());
  const [selectedInboxId, setSelectedInboxId] = useState<string>('');
  const [nuevoDestDialogOpen, setNuevoDestDialogOpen] = useState(false);
  const [destDraftMode, setDestDraftMode] = useState<'all' | 'selected'>('all');
  const [destDraftIds, setDestDraftIds] = useState<Set<string>>(() => new Set());
  const draftTitleRef = useRef<HTMLInputElement>(null);

  const draftSlice = selectedGs ? draftsByGs[selectedGs] ?? EMPTY_COMUNICADO_DRAFT : EMPTY_COMUNICADO_DRAFT;
  const draftTitle = draftSlice.title;
  const draftBody = draftSlice.body;
  const draftAttachments = draftSlice.attachments;
  const recipientMode = draftSlice.recipientMode;
  const selectedParentIds = draftSlice.selectedParentIds;

  const setDraftTitle = useCallback((v: string) => {
    if (!selectedGs) return;
    setDraftsByGs((m) => ({
      ...m,
      [selectedGs]: { ...(m[selectedGs] ?? EMPTY_COMUNICADO_DRAFT), title: v },
    }));
  }, [selectedGs]);

  const setDraftBody = useCallback((v: string) => {
    if (!selectedGs) return;
    setDraftsByGs((m) => ({
      ...m,
      [selectedGs]: { ...(m[selectedGs] ?? EMPTY_COMUNICADO_DRAFT), body: v },
    }));
  }, [selectedGs]);

  const setDraftAttachments: Dispatch<SetStateAction<ComunicadoAttachment[]>> = useCallback(
    (action) => {
      if (!selectedGs) return;
      setDraftsByGs((m) => {
        const cur = m[selectedGs] ?? EMPTY_COMUNICADO_DRAFT;
        const nextAtt = typeof action === 'function' ? action(cur.attachments) : action;
        return { ...m, [selectedGs]: { ...cur, attachments: nextAtt } };
      });
    },
    [selectedGs]
  );

  const { data: courses = [], isLoading: loadingCourses } = useQuery({
    queryKey: ['courses', 'comunicacion-academico'],
    queryFn: async (): Promise<CourseListItem[]> => {
      const res = await fetch('/api/courses', { headers: authHeaders() });
      if (!res.ok) throw new Error('Error al cargar cursos');
      return res.json();
    },
    enabled: !isPadre && canPublish,
  });

  const { data: sidebarStats = [] } = useQuery({
    queryKey: ['comunicados-padres-stats'],
    queryFn: async (): Promise<SidebarStat[]> => {
      const res = await fetch('/api/courses/comunicados-padres-stats', { headers: authHeaders() });
      if (!res.ok) throw new Error('stats');
      return res.json();
    },
    enabled: !isPadre && canPublish,
  });

  const statsByGs = useMemo(() => {
    const m: Record<string, SidebarStat> = {};
    for (const s of sidebarStats) m[s.group_subject_id] = s;
    return m;
  }, [sidebarStats]);

  const { data: padresCtx } = useQuery({
    queryKey: ['padres-vinculados', selectedGs],
    queryFn: async () => {
      const res = await fetch(`/api/courses/padres-vinculados/${selectedGs}?list=1`, {
        headers: authHeaders(),
      });
      if (!res.ok) {
        return {
          count: 0,
          group_id: '' as string | undefined,
          group_name: null as string | null,
          subject_name: null as string | null,
          parents: [] as { id: string; full_name: string }[],
        };
      }
      return (await res.json()) as {
        count: number;
        group_id?: string;
        group_name?: string | null;
        subject_name?: string | null;
        parents?: { id: string; full_name: string }[];
      };
    },
    enabled: !!selectedGs && !isPadre && canPublish,
  });

  const padresList = padresCtx?.parents ?? [];

  const nuevoDialogWasOpenRef = useRef(false);
  useEffect(() => {
    if (nuevoDestDialogOpen && selectedGs) {
      if (!nuevoDialogWasOpenRef.current) {
        const d = draftsByGs[selectedGs];
        setDestDraftMode(d?.recipientMode ?? 'all');
        setDestDraftIds(new Set(d?.selectedParentIds ?? []));
      }
      nuevoDialogWasOpenRef.current = true;
    } else {
      nuevoDialogWasOpenRef.current = false;
    }
  }, [nuevoDestDialogOpen, selectedGs, draftsByGs]);

  const padresCount = padresCtx?.count ?? 0;

  const {
    data: comunicados = [],
    isLoading: loadingCom,
    error: errCom,
  } = useQuery({
    queryKey: ['comunicados-padres', isPadre ? 'all' : selectedGs],
    queryFn: async (): Promise<ComunicadoPadresItem[]> => {
      if (isPadre) {
        const res = await fetch('/api/courses/comunicados-padres', { headers: authHeaders() });
        if (!res.ok) throw new Error('Error al cargar comunicados');
        return res.json();
      }
      if (!selectedGs) return [];
      const res = await fetch(`/api/courses/comunicados-padres/${selectedGs}`, {
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error('Error al cargar comunicados');
      return res.json();
    },
    enabled: isPadre || !!selectedGs,
  });

  /** Tras cargar la bandeja del curso, marca hilos como vistos para que el badge solo cuente mensajes entrantes (padre) posteriores. */
  useEffect(() => {
    if (isPadre || !canPublish || !selectedGs || loadingCom || errCom) return;

    const gs = selectedGs;
    let cancelled = false;

    void (async () => {
      try {
        const res = await fetch(`/api/courses/comunicados-padres/${gs}/mark-threads-viewed`, {
          method: 'POST',
          headers: authHeaders(),
        });
        if (!res.ok || cancelled) return;
        queryClient.invalidateQueries({ queryKey: ['comunicados-padres-stats'] });
        queryClient.invalidateQueries({ queryKey: ['communication-summary'] });
      } catch {
        /* ignore */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedGs, loadingCom, errCom, isPadre, canPublish, queryClient]);

  const markReadMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/courses/comunicado/${id}/read`, {
        method: 'POST',
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error('read');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comunicados-padres'] });
      queryClient.invalidateQueries({ queryKey: ['communication-summary'] });
    },
  });

  const markOpenedIfPadre = useCallback(
    (id: string) => {
      if (!isPadre) return;
      if (openedRead.has(id)) return;
      setOpenedRead((prev) => new Set(prev).add(id));
      markReadMutation.mutate(id);
    },
    [isPadre, openedRead, markReadMutation]
  );

  // Para rol padre: seleccionar primer comunicado automáticamente al cargar
  useEffect(() => {
    if (!isPadre) return;
    if (loadingCom || errCom) return;
    if (!comunicados.length) return;
    setSelectedInboxId((cur) => cur || comunicados[0].id);
  }, [isPadre, comunicados, loadingCom, errCom]);

  const cancelMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/courses/comunicado/${id}/cancel`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error((j as { message?: string }).message || 'No se pudo cancelar');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comunicados-padres'] });
      queryClient.invalidateQueries({ queryKey: ['comunicados-padres-stats'] });
      queryClient.invalidateQueries({ queryKey: ['communication-summary'] });
    },
  });

  const sendComunicadoMutation = useMutation({
    mutationFn: async (payload: {
      groupSubjectId: string;
      title: string;
      body: string;
      priority: string;
      attachments: ComunicadoAttachment[];
      recipientMode: 'all' | 'selected';
      selectedParentIds: string[];
    }) => {
      const body: Record<string, unknown> = {
        group_subject_id: payload.groupSubjectId,
        title: payload.title,
        body: payload.body,
        priority: payload.priority,
        attachments: payload.attachments,
      };
      if (payload.recipientMode === 'selected' && payload.selectedParentIds.length > 0) {
        body.recipient_parent_ids = payload.selectedParentIds;
      }
      const res = await fetch('/api/courses/comunicado-padres', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error((j as { message?: string }).message || 'Error al enviar');
      }
      return res.json() as { id: string; scheduled_send_at: string };
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['comunicados-padres'] });
      queryClient.invalidateQueries({ queryKey: ['comunicados-padres-stats'] });
      queryClient.invalidateQueries({ queryKey: ['communication-summary'] });
      setPreviewOpen(false);
      const gsKey = variables.groupSubjectId;
      setDraftsByGs((m) => {
        const next = { ...m };
        delete next[gsKey];
        return next;
      });
    },
  });

  const correctionMutation = useMutation({
    mutationFn: async (payload: {
      id: string;
      title: string;
      body: string;
      attachments: ComunicadoAttachment[];
    }) => {
      const res = await fetch(`/api/courses/comunicado/${payload.id}/correccion`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          title: payload.title,
          body: payload.body,
          attachments: payload.attachments,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error((j as { message?: string }).message || 'Error');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comunicados-padres'] });
      setCorrectionFor(null);
      setCorrTitle('');
      setCorrBody('');
      setCorrAttachments([]);
    },
  });

  const replyMutation = useMutation({
    mutationFn: async ({ id, content }: { id: string; content: string }) => {
      const res = await fetch(`/api/courses/comunicado/${id}/reply`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ content }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error((j as { message?: string }).message || 'Error');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comunicados-padres'] });
    },
  });

  const activeCourse = useMemo(() => {
    if (!selectedGs) return null;
    return courses.find((c) => c.id === selectedGs || c._id === selectedGs) ?? null;
  }, [courses, selectedGs]);

  const comunicadoGroupId = padresCtx?.group_id || activeCourse?.groupId || '';
  const cursoNombreForDrive =
    [padresCtx?.group_name, padresCtx?.subject_name].filter(Boolean).join(' — ') ||
    (activeCourse?.nombre
      ? `${activeCourse.nombre}${activeCourse.cursos?.[0] ? ` · ${activeCourse.cursos[0]}` : ''}`
      : 'Curso');

  const comunicacionBackTo =
    user?.rol === 'padre'
      ? '/dashboard'
      : user?.rol === 'directivo'
      ? '/directivo/comunicacion'
      : user?.rol === 'profesor'
        ? '/profesor/comunicacion'
        : '/comunicacion';

  const canCorrect = (c: ComunicadoPadresItem): boolean => {
    if (!c.sent_at || c.correction_of) return false;
    if (c.has_correction) return false;
    if (c.created_by_id !== user?.id) return false;
    const sent = new Date(c.sent_at).getTime();
    return Date.now() - sent < 24 * 60 * 60 * 1000;
  };

  const priorityChip = (p: string | null) => {
    const label = p || 'normal';
    const color =
      label === 'alta' || label === 'high'
        ? 'bg-red-500/20 text-red-200 border-red-500/30'
        : label === 'baja' || label === 'low'
          ? 'bg-slate-500/20 text-slate-200'
          : 'bg-blue-500/15 text-blue-200 border-blue-500/25';
    return (
      <span className={`text-xs px-2 py-0.5 rounded border ${color}`}>{label}</span>
    );
  };

  const staffTwoColumn = !isPadre && canPublish;
  const parentTwoColumn = isPadre;

  const selectedComunicado = useMemo(() => {
    if (!isPadre) return null;
    const id = selectedInboxId || comunicados[0]?.id;
    return comunicados.find((c) => c.id === id) ?? null;
  }, [isPadre, selectedInboxId, comunicados]);

  const myParentReplies = useMemo(() => {
    if (!isPadre || !selectedComunicado || !user?.id) return [];
    return (selectedComunicado.parent_replies ?? []).filter((r) => String(r.sender_id) === String(user.id));
  }, [isPadre, selectedComunicado, user?.id]);

  const staffReadAtForThread = selectedComunicado?.staff_last_read_at ?? null;

  return (
    <div className="space-y-6 min-h-[70vh]">
      <NavBackButton to={comunicacionBackTo} label={user?.rol === 'padre' ? 'Dashboard' : 'Comunicación'} />

      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#3B82F6] to-[#1D4ED8] shadow-lg shadow-blue-500/25">
          <Megaphone className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-[#E2E8F0] font-['Poppins'] tracking-tight">
            {isPadre ? 'Comunicados de tus hijos' : 'Comunicados a padres'}
          </h1>
          <p className="text-white/60 text-sm mt-0.5 max-w-2xl">
            {isPadre
              ? 'Mensajes de docentes y coordinación por curso'
              : 'Gestiona avisos con retención de 30 s y correcciones dentro de 24 h'}
          </p>
        </div>
      </div>

      <div
        className={cn(
          'grid min-h-0 grid-cols-1',
          staffTwoColumn &&
            'lg:grid-cols-[minmax(260px,300px)_1fr] lg:grid-rows-1 lg:min-h-[calc(100dvh-11rem)] gap-0 rounded-2xl panel-grades overflow-hidden border border-white/[0.08] shadow-[0_0_48px_rgba(37,99,235,0.18)]',
          !staffTwoColumn &&
            'rounded-2xl panel-grades overflow-hidden border border-white/[0.08] shadow-[0_0_48px_rgba(37,99,235,0.18)] min-h-[min(70vh,calc(100dvh-12rem))]',
        )}
      >
        {staffTwoColumn && (
          <aside className="flex flex-col min-h-0 max-h-[40vh] lg:max-h-none h-full border-b border-white/10 lg:border-b-0 lg:border-r lg:border-white/10 bg-black/20 p-4 lg:py-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[#E2E8F0] font-semibold text-sm tracking-wide">Mis cursos</h2>
              <Button
                size="sm"
                className="h-8 bg-[#3B82F6] hover:bg-[#2563EB] text-white"
                disabled={!selectedGs}
                type="button"
                onClick={() => {
                  if (!selectedGs) return;
                  setNuevoDestDialogOpen(true);
                }}
              >
                <Plus className="w-4 h-4 mr-1" /> Nuevo
              </Button>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto space-y-1.5 pr-1 -mr-1">
              {loadingCourses ? (
                <p className="text-white/50 text-sm p-2">Cargando…</p>
              ) : courses.length === 0 ? (
                <p className="text-white/50 text-sm p-2">Sin cursos asignados</p>
              ) : (
                courses.map((c) => {
                  const id = c.id || c._id || '';
                  const stat = statsByGs[id];
                  const badge = stat?.badge ?? 0;
                  const active = selectedGs === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setLocation(`/comunicacion/academico/${id}`)}
                      className={`w-full text-left rounded-xl px-3 py-3 transition-all border-l-2 ${
                        active
                          ? 'border-[#3B82F6] bg-[rgba(37,99,235,0.14)] shadow-[inset_0_0_0_1px_rgba(59,130,246,0.2)]'
                          : 'border-transparent hover:bg-white/[0.06]'
                      }`}
                    >
                      <div className="flex justify-between gap-2">
                        <span className="text-white font-medium text-sm line-clamp-2">{c.nombre}</span>
                        {badge > 0 && (
                          <span className="shrink-0 min-w-[22px] h-[22px] rounded-full bg-red-600 text-white text-xs flex items-center justify-center px-1">
                            {badge > 99 ? '99+' : badge}
                          </span>
                        )}
                      </div>
                      {c.cursos?.[0] && (
                        <p className="text-white/50 text-xs mt-0.5">Curso {c.cursos[0]}</p>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </aside>
        )}

        <main
          className={cn(
            'flex min-h-0 flex-col overflow-hidden',
            staffTwoColumn
              ? 'min-h-[50vh] lg:min-h-0 lg:h-full bg-gradient-to-b from-black/25 via-transparent to-black/20'
              : 'min-h-[min(70vh,calc(100dvh-12rem))] bg-gradient-to-b from-black/20 via-transparent to-black/25',
          )}
        >
          {!isPadre && !selectedGs && (
            <div className="flex-1 flex flex-col items-center justify-center text-white/50 p-10 gap-3">
              <div className="h-14 w-14 rounded-2xl border border-white/10 bg-white/[0.04] flex items-center justify-center">
                <Users className="w-7 h-7 text-white/35" />
              </div>
              <p className="text-sm text-center max-w-xs">Selecciona un curso a la izquierda para redactar y ver el historial</p>
            </div>
          )}

          {(isPadre || selectedGs) && (
            <>
              {parentTwoColumn && (
                <div className="grid grid-cols-1 lg:grid-cols-[minmax(280px,360px)_1fr] gap-0 min-h-0 flex-1">
                  {/* Bandeja de entrada */}
                  <aside className="min-h-0 border-b border-white/10 lg:border-b-0 lg:border-r lg:border-white/10 bg-black/20 p-4 lg:p-5">
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <div>
                        <h2 className="text-[#E2E8F0] font-semibold text-sm tracking-wide">Bandeja de entrada</h2>
                        <p className="text-white/45 text-xs mt-0.5">
                          {comunicados.length} comunicado{comunicados.length !== 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>

                    <div className="min-h-0 max-h-[44vh] lg:max-h-none lg:h-full overflow-y-auto space-y-2 pr-1 -mr-1">
                      {loadingCom ? (
                        <div className="flex items-center justify-center py-10 text-white/60">
                          <Loader2 className="w-6 h-6 animate-spin" />
                        </div>
                      ) : errCom ? (
                        <p className="text-red-400 text-sm p-2">No se pudieron cargar los comunicados</p>
                      ) : comunicados.length === 0 ? (
                        <p className="text-white/50 text-sm p-2">No hay comunicados aún.</p>
                      ) : (
                        comunicados.map((c) => {
                          const active = (selectedComunicado?.id ?? '') === c.id;
                          const unread = !(c.is_read || openedRead.has(c.id));
                          const from = c.author_name?.trim() || 'Docente';
                          const meta = [c.subject_name, c.group_name].filter(Boolean).join(' · ');
                          return (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => {
                                setSelectedInboxId(c.id);
                                markOpenedIfPadre(c.id);
                              }}
                              className={cn(
                                'w-full text-left rounded-xl px-3 py-3 transition-all border',
                                active
                                  ? 'border-[#3B82F6]/40 bg-[rgba(37,99,235,0.14)] shadow-[inset_0_0_0_1px_rgba(59,130,246,0.18)]'
                                  : 'border-white/10 hover:bg-white/[0.06]',
                              )}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="text-white/85 text-xs font-medium truncate">
                                      {from}
                                    </span>
                                    {unread && (
                                      <span
                                        className="shrink-0 w-2 h-2 rounded-full bg-[#00c8ff] shadow-[0_0_12px_rgba(0,200,255,0.35)]"
                                        aria-label="No leído"
                                      />
                                    )}
                                  </div>
                                  <div className="text-white font-semibold text-sm mt-1 line-clamp-2">
                                    {c.title}
                                  </div>
                                  {meta && (
                                    <div className="text-white/45 text-xs mt-1 truncate">{meta}</div>
                                  )}
                                </div>
                                <div className="shrink-0 text-[11px] text-white/35 tabular-nums">
                                  {formatRelative(c.created_at)}
                                </div>
                              </div>
                            </button>
                          );
                        })
                      )}
                    </div>
                  </aside>

                  {/* Panel de lectura + redacción */}
                  <section className="min-h-0 flex flex-col">
                    <div className="border-b border-white/10 px-5 py-4 sm:px-6 shrink-0 bg-gradient-to-r from-[#1e3a8a]/20 via-transparent to-transparent">
                      <h3 className="text-[#E2E8F0] font-semibold text-lg sm:text-xl tracking-tight">
                        {selectedComunicado ? selectedComunicado.title : 'Selecciona un comunicado'}
                      </h3>
                      <p className="text-white/55 text-sm mt-1">
                        {selectedComunicado?.author_name?.trim()
                          ? `Enviado por ${selectedComunicado.author_name}`
                          : 'Enviado por un docente'}
                        {selectedComunicado?.subject_name || selectedComunicado?.group_name
                          ? ` · ${[selectedComunicado.subject_name, selectedComunicado.group_name].filter(Boolean).join(' · ')}`
                          : ''}
                      </p>
                    </div>

                    <div className="flex-1 min-h-0 overflow-y-auto p-5 sm:p-6 space-y-4 scroll-smooth">
                      {selectedComunicado ? (
                        <Card className="bg-white/[0.03] border-white/10 backdrop-blur-md shadow-lg shadow-black/15">
                          <CardContent className="p-4 sm:p-5 space-y-3">
                            {selectedComunicado.body ? (
                              <p className="text-sm whitespace-pre-wrap text-white/85">
                                {selectedComunicado.body}
                              </p>
                            ) : (
                              <p className="text-sm text-white/50">Sin contenido.</p>
                            )}
                            <ComunicadoAttachmentLinks
                              items={parseComunicadoAttachments(selectedComunicado.attachments_json)}
                            />
                            <div className="flex flex-wrap items-center gap-2 text-xs text-white/45">
                              <span>{formatRelative(selectedComunicado.created_at)}</span>
                            </div>

                            {myParentReplies.length > 0 && (
                              <div className="pt-3 border-t border-white/10">
                                <p className="text-white/55 text-xs font-semibold uppercase tracking-wider mb-2">
                                  Tus mensajes
                                </p>
                                <div className="space-y-2">
                                  {myParentReplies.slice(-5).map((r) => {
                                    const sentAt = r.created_at;
                                    const staffReadAt = staffReadAtForThread;
                                    const seen = !!staffReadAt && new Date(staffReadAt).getTime() >= new Date(sentAt).getTime();
                                    return (
                                      <div
                                        key={r.id}
                                        className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2"
                                      >
                                        <div className="flex items-center justify-between gap-2">
                                          <span className="text-[11px] text-white/45 tabular-nums">
                                            {formatTimeOnly(sentAt)}
                                          </span>
                                          <span className={`text-[11px] tabular-nums ${seen ? 'text-emerald-300/80' : 'text-white/35'}`}>
                                            {seen ? `Visto ${formatTimeOnly(staffReadAt!)}` : 'Enviado'}
                                          </span>
                                        </div>
                                        <p className="text-sm text-white/85 whitespace-pre-wrap mt-1">
                                          {r.content}
                                        </p>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      ) : (
                        <div className="flex items-center justify-center py-14 text-white/50">
                          Selecciona un comunicado de la bandeja para responder.
                        </div>
                      )}
                    </div>

                    <div className="border-t border-white/10 p-5 sm:p-6 shrink-0 bg-black/30 backdrop-blur-sm">
                      <p className="text-[#93C5FD] text-xs font-semibold uppercase tracking-wider mb-2">
                        Redactar mensaje
                      </p>
                      <p className="text-white/45 text-xs mb-3">
                        Responde al comunicado seleccionado. Tu mensaje le llegará al docente/coordinación correspondiente.
                      </p>
                      <Textarea
                        value={selectedComunicado ? (replyText[selectedComunicado.id] ?? '') : ''}
                        onChange={(e) => {
                          const id = selectedComunicado?.id;
                          if (!id) return;
                          setReplyText((prev) => ({ ...prev, [id]: e.target.value }));
                        }}
                        placeholder={selectedComunicado ? 'Escribe tu mensaje…' : 'Selecciona un comunicado para redactar…'}
                        className="bg-white/5 border-white/15 text-white min-h-[90px] mb-3 rounded-xl"
                        disabled={!selectedComunicado}
                      />
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-xs text-white/40">
                          {selectedComunicado?.id ? 'Enter no envía: usa el botón.' : '—'}
                        </div>
                        <Button
                          size="sm"
                          className="bg-[#3B82F6] hover:bg-[#2563EB]"
                          disabled={
                            !selectedComunicado ||
                            replyMutation.isPending ||
                            !((replyText[selectedComunicado.id] ?? '').trim())
                          }
                          onClick={() => {
                            if (!selectedComunicado) return;
                            const t = (replyText[selectedComunicado.id] || '').trim();
                            if (!t) return;
                            replyMutation.mutate(
                              { id: selectedComunicado.id, content: t },
                              {
                                onSuccess: () =>
                                  setReplyText((prev) => ({ ...prev, [selectedComunicado.id]: '' })),
                              }
                            );
                          }}
                        >
                          {replyMutation.isPending ? 'Enviando…' : 'Enviar'}
                        </Button>
                      </div>
                    </div>
                  </section>
                </div>
              )}

              {!isPadre && activeCourse && (
                <div className="border-b border-white/10 px-5 py-4 sm:px-6 shrink-0 bg-gradient-to-r from-[#1e3a8a]/20 via-transparent to-transparent">
                  <h3 className="text-[#E2E8F0] font-semibold text-lg sm:text-xl tracking-tight">
                    {activeCourse.nombre}
                    {activeCourse.cursos?.[0] ? ` · ${activeCourse.cursos[0]}` : ''}
                  </h3>
                  <p className="text-white/55 text-sm mt-1">
                    {padresCount} padres vinculados
                    {recipientMode === 'all' ? (
                      <span className="text-white/40"> · Enviar a todos</span>
                    ) : (
                      <span className="text-[#00c8ff]/90">
                        {' '}
                        · {selectedParentIds.length} seleccionado
                        {selectedParentIds.length !== 1 ? 's' : ''}
                      </span>
                    )}
                  </p>
                </div>
              )}

              {!isPadre && canPublish && selectedGs && (
                <div
                  id="redaccion-comunicado"
                  className="border-b border-white/10 p-5 sm:p-6 shrink-0 bg-black/30 backdrop-blur-sm"
                >
                  <p className="text-[#93C5FD] text-xs font-semibold uppercase tracking-wider mb-3">
                    Redactar comunicado
                  </p>
                  <Input
                    ref={draftTitleRef}
                    value={draftTitle}
                    onChange={(e) => setDraftTitle(e.target.value)}
                    placeholder="Título"
                    className="bg-white/[0.06] border-white/12 text-[#E2E8F0] placeholder:text-white/35 mb-3 rounded-xl h-11"
                  />
                  <Textarea
                    value={draftBody}
                    onChange={(e) => setDraftBody(e.target.value)}
                    placeholder="Mensaje para padres…"
                    className="bg-white/[0.06] border-white/12 text-[#E2E8F0] placeholder:text-white/35 min-h-[140px] mb-3 rounded-xl resize-y"
                  />
                  <ComunicadoWorkspaceAttachments
                    postGroupId={comunicadoGroupId}
                    postGroupSubjectId={selectedGs}
                    postCursoNombre={cursoNombreForDrive}
                    attachments={draftAttachments}
                    onAttachmentsChange={setDraftAttachments}
                    disabled={sendComunicadoMutation.isPending}
                    showTeacherPrivateFolder={user?.rol === 'profesor'}
                  />
                  <Button
                    className="bg-[#3B82F6] hover:bg-[#2563EB]"
                    disabled={
                      !draftTitle.trim() ||
                      sendComunicadoMutation.isPending ||
                      (recipientMode === 'selected' && selectedParentIds.length === 0)
                    }
                    onClick={() => {
                      if (recipientMode === 'selected' && selectedParentIds.length === 0) {
                        toast({
                          variant: 'destructive',
                          title: 'Destinatarios',
                          description: 'Pulsa «Nuevo» y elige padres, o usa «Todos los padres».',
                        });
                        return;
                      }
                      setPreviewOpen(true);
                    }}
                  >
                    <Send className="w-4 h-4 mr-2" />
                    Enviar
                  </Button>
                  {sendComunicadoMutation.isError && (
                    <p className="text-red-400 text-sm mt-2">
                      {(sendComunicadoMutation.error as Error).message}
                    </p>
                  )}
                </div>
              )}

              {!parentTwoColumn && (
              <div className="flex-1 min-h-0 overflow-y-auto p-5 sm:p-6 space-y-4 scroll-smooth">
                {loadingCom && (
                  <div className="flex justify-center py-12 text-white/60">
                    <Loader2 className="w-8 h-8 animate-spin" />
                  </div>
                )}
                {errCom && (
                  <p className="text-red-400 text-center">No se pudieron cargar los comunicados</p>
                )}
                {!loadingCom &&
                  comunicados.map((c) => {
                    const isTaskComunicado = (c.category || '').toLowerCase() === 'tareas';
                    return (
                    <Card
                      key={c.id}
                      className={cn(
                        'backdrop-blur-md shadow-lg shadow-black/15',
                        isTaskComunicado
                          ? 'border border-white/10 border-l-[4px] border-l-[#84cc16] bg-gradient-to-br from-[#84cc16]/[0.08] via-slate-950/30 to-slate-950/50'
                          : 'bg-white/[0.03] border-white/10',
                      )}
                    >
                      <CardContent
                        className="p-4 space-y-2 cursor-default"
                        onClick={() => markOpenedIfPadre(c.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') markOpenedIfPadre(c.id);
                        }}
                        role={isPadre ? 'button' : undefined}
                        tabIndex={isPadre ? 0 : undefined}
                      >
                        {c.status === 'pending' && c.scheduled_send_at && (
                          <CountdownBanner
                            scheduledAt={c.scheduled_send_at}
                            cancelling={cancelMutation.isPending}
                            onCancel={() => cancelMutation.mutate(c.id)}
                          />
                        )}
                        <div className="flex flex-wrap gap-2 items-center">
                          {isTaskComunicado && (
                            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-[#84cc16]/20 text-lime-200 border border-[#84cc16]/45 flex items-center gap-1">
                              <ClipboardList className="w-3 h-3" />
                              Tareas
                            </span>
                          )}
                          {c.correction_of && (
                            <span className="text-xs px-2 py-0.5 rounded bg-violet-500/25 text-violet-200 border border-violet-500/40">
                              Corrección
                            </span>
                          )}
                          {c.corrected_at && (
                            <span className="text-xs px-2 py-0.5 rounded bg-amber-500/20 text-amber-100 border border-amber-500/35">
                              Corregido
                            </span>
                          )}
                          {priorityChip(c.priority)}
                          <span className="text-xs text-white/40">{formatRelative(c.created_at)}</span>
                        </div>
                        <h4 className="text-white font-bold text-base">{c.title}</h4>
                        {c.body && (
                          <p
                            className={cn(
                              'text-sm whitespace-pre-wrap',
                              isTaskComunicado ? 'text-white/85' : 'text-white/80',
                            )}
                          >
                            {c.body}
                          </p>
                        )}
                        <ComunicadoAttachmentLinks
                          items={parseComunicadoAttachments(c.attachments_json)}
                        />
                        {c.assignment_id && (
                          <Button
                            type="button"
                            size="sm"
                            className={cn(
                              'mt-1 rounded-xl',
                              isTaskComunicado
                                ? 'bg-[#84cc16]/25 border border-[#84cc16]/50 text-lime-100 hover:bg-[#84cc16]/35'
                                : 'bg-[#3B82F6]/20 border border-[#3B82F6]/45 text-[#93C5FD] hover:bg-[#3B82F6]/30',
                            )}
                            onClick={(e) => {
                              e.stopPropagation();
                              setLocation(`/assignment/${c.assignment_id}`);
                            }}
                          >
                            <ClipboardList className="w-3.5 h-3.5 mr-1.5" />
                            Abrir tarea
                          </Button>
                        )}
                        <p className="text-white/45 text-xs">
                          Leído por {c.reads_count}/{c.total_recipients || 0} padres
                        </p>
                        {!isPadre && c.parent_replies.length > 0 && selectedGs && (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="mt-2 border-violet-500/45 text-violet-100 hover:bg-violet-500/15"
                            onClick={(e) => {
                              e.stopPropagation();
                              setLocation(`/comunicacion/academico/${selectedGs}/respuestas/${c.id}`);
                            }}
                          >
                            <MessageCircle className="w-4 h-4 mr-2" />
                            Ver respuestas ({c.replies_count || c.parent_replies.length})
                          </Button>
                        )}
                        {canPublish && canCorrect(c) && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-violet-500/40 text-violet-200 mt-2"
                            onClick={() => {
                              setCorrectionFor(c);
                              setCorrTitle(c.title);
                              setCorrBody(c.body || '');
                              setCorrAttachments(parseComunicadoAttachments(c.attachments_json));
                            }}
                          >
                            <Pencil className="w-3.5 h-3.5 mr-1" /> Enviar corrección
                          </Button>
                        )}
                        {isPadre && c.status === 'sent' && (
                          <div
                            className="pt-2 border-t border-white/10 mt-2"
                            onClick={(e) => e.stopPropagation()}
                            onKeyDown={(e) => e.stopPropagation()}
                            role="presentation"
                          >
                            <p className="text-white/50 text-xs mb-1 flex items-center gap-1">
                              <MessageCircle className="w-3.5 h-3.5" /> Tu respuesta
                            </p>
                            <Textarea
                              value={replyText[c.id] ?? ''}
                              onChange={(e) =>
                                setReplyText((prev) => ({ ...prev, [c.id]: e.target.value }))
                              }
                              placeholder="Escribe una respuesta al docente…"
                              className="bg-white/5 border-white/15 text-white min-h-[72px] mb-2"
                            />
                            <Button
                              size="sm"
                              className="bg-[#3B82F6] hover:bg-[#2563EB]"
                              disabled={replyMutation.isPending || !(replyText[c.id] || '').trim()}
                              onClick={() => {
                                const t = (replyText[c.id] || '').trim();
                                if (!t) return;
                                replyMutation.mutate({ id: c.id, content: t }, {
                                  onSuccess: () =>
                                    setReplyText((prev) => ({ ...prev, [c.id]: '' })),
                                });
                              }}
                            >
                              Enviar respuesta
                            </Button>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                  })}

                {!loadingCom && comunicados.length === 0 && (
                  <p className="text-white/50 text-center py-12">No hay comunicados en este curso</p>
                )}
              </div>
              )}
            </>
          )}
        </main>
      </div>

      <Dialog open={nuevoDestDialogOpen} onOpenChange={setNuevoDestDialogOpen}>
        <DialogContent className="bg-[#0a0a2a] border-white/10 text-white max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-['Poppins'] text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-[#00c8ff]" />
              Nuevo comunicado — destinatarios
            </DialogTitle>
          </DialogHeader>
          <p className="text-white/55 text-sm">
            Elige si el mensaje va a todos los acudientes del curso o solo a algunos.
          </p>
          <RadioGroup
            value={destDraftMode}
            onValueChange={(v) => setDestDraftMode(v as 'all' | 'selected')}
            className="gap-3"
          >
            <div className="flex items-start gap-3 rounded-lg border border-white/10 bg-white/[0.04] p-3">
              <RadioGroupItem value="all" id="dest-all" className="mt-0.5 border-[#1e3cff] text-[#1e3cff]" />
              <div className="flex-1 min-w-0">
                <Label htmlFor="dest-all" className="text-white font-medium cursor-pointer">
                  Todos los padres
                </Label>
                <p className="text-white/45 text-xs mt-0.5">
                  {padresCount} acudiente{padresCount !== 1 ? 's' : ''} vinculado{padresCount !== 1 ? 's' : ''} a este curso
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-lg border border-white/10 bg-white/[0.04] p-3">
              <RadioGroupItem value="selected" id="dest-sel" className="mt-0.5 border-[#00c8ff] text-[#00c8ff]" />
              <div className="flex-1 min-w-0">
                <Label htmlFor="dest-sel" className="text-white font-medium cursor-pointer">
                  Solo algunos padres
                </Label>
                <p className="text-white/45 text-xs mt-0.5">Marca los acudientes que deben recibir este aviso</p>
              </div>
            </div>
          </RadioGroup>
          {destDraftMode === 'selected' && (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="border-white/20 text-white/90 h-8"
                  onClick={() => setDestDraftIds(new Set(padresList.map((p) => p.id)))}
                >
                  Marcar todos
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="border-white/20 text-white/90 h-8"
                  onClick={() => setDestDraftIds(new Set())}
                >
                  Quitar todos
                </Button>
              </div>
              <div className="max-h-48 overflow-y-auto rounded-lg border border-white/10 bg-black/25 divide-y divide-white/5">
                {padresList.length === 0 ? (
                  <p className="text-white/45 text-sm p-3">No hay padres vinculados en este curso.</p>
                ) : (
                  padresList.map((p) => (
                    <label
                      key={p.id}
                      className="flex items-center gap-3 px-3 py-2.5 hover:bg-white/[0.04] cursor-pointer"
                    >
                      <Checkbox
                        checked={destDraftIds.has(p.id)}
                        onCheckedChange={() => {
                          setDestDraftIds((prev) => {
                            const next = new Set(prev);
                            if (next.has(p.id)) next.delete(p.id);
                            else next.add(p.id);
                            return next;
                          });
                        }}
                        className="border-white/30 data-[state=checked]:bg-[#1e3cff] data-[state=checked]:border-[#1e3cff]"
                      />
                      <span className="text-sm text-white/90 truncate">{p.full_name}</span>
                    </label>
                  ))
                )}
              </div>
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              variant="outline"
              className="border-white/20 text-white"
              onClick={() => setNuevoDestDialogOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              className="bg-[#3B82F6] hover:bg-[#2563EB] text-white"
              onClick={() => {
                if (!selectedGs) return;
                if (destDraftMode === 'selected' && destDraftIds.size === 0) {
                  toast({
                    variant: 'destructive',
                    title: 'Elige padres',
                    description: 'Marca al menos un acudiente o elige «Todos los padres».',
                  });
                  return;
                }
                setDraftsByGs((m) => ({
                  ...m,
                  [selectedGs]: {
                    ...(m[selectedGs] ?? EMPTY_COMUNICADO_DRAFT),
                    recipientMode: destDraftMode,
                    selectedParentIds: destDraftMode === 'all' ? [] : Array.from(destDraftIds),
                  },
                }));
                setNuevoDestDialogOpen(false);
                requestAnimationFrame(() => draftTitleRef.current?.focus());
              }}
            >
              Continuar a redactar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="bg-[#0f172a] border-white/10 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle>Vista previa del comunicado</DialogTitle>
          </DialogHeader>
          <div className="border-t border-white/10 pt-4 space-y-3 text-sm">
            <p className="text-white/70">
              Para:{' '}
              <span className="text-white font-medium">
                {recipientMode === 'all'
                  ? `Todos los padres vinculados (${padresCount})`
                  : `${selectedParentIds.length} padre(s) seleccionado(s)`}
                {activeCourse?.nombre
                  ? ` · ${activeCourse.nombre}${activeCourse.cursos?.[0] ? ` ${activeCourse.cursos[0]}` : ''}`
                  : ''}
              </span>
            </p>
            <div>
              <p className="text-white/50 text-xs mb-0.5">Título</p>
              <p className="text-white font-medium">{draftTitle}</p>
            </div>
            <div>
              <p className="text-white/50 text-xs mb-0.5">Mensaje</p>
              <p className="text-white/85 whitespace-pre-wrap">{draftBody || '—'}</p>
            </div>
            {draftAttachments.length > 0 && (
              <div>
                <p className="text-white/50 text-xs mb-0.5">Adjuntos</p>
                <ComunicadoAttachmentLinks items={draftAttachments} />
              </div>
            )}
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" className="border-white/20 text-white" onClick={() => setPreviewOpen(false)}>
              Editar
            </Button>
            <Button
              className="bg-[#3B82F6] hover:bg-[#2563EB]"
              disabled={sendComunicadoMutation.isPending}
              onClick={() =>
                sendComunicadoMutation.mutate({
                  groupSubjectId: selectedGs,
                  title: draftTitle.trim(),
                  body: draftBody.trim(),
                  priority: 'normal',
                  attachments: draftAttachments,
                  recipientMode,
                  selectedParentIds,
                })
              }
            >
              {sendComunicadoMutation.isPending ? 'Enviando…' : 'Confirmar y enviar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!correctionFor} onOpenChange={(o) => !o && setCorrectionFor(null)}>
        <DialogContent className="bg-[#0f172a] border-white/10 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle>Corrección del comunicado</DialogTitle>
          </DialogHeader>
          <Input
            value={corrTitle}
            onChange={(e) => setCorrTitle(e.target.value)}
            className="bg-white/5 border-white/15 text-white mb-2"
          />
          <Textarea
            value={corrBody}
            onChange={(e) => setCorrBody(e.target.value)}
            className="bg-white/5 border-white/15 text-white min-h-[120px] mb-3"
          />
          {correctionFor?.group_id && correctionFor?.group_subject_id && (
            <ComunicadoWorkspaceAttachments
              postGroupId={correctionFor.group_id}
              postGroupSubjectId={correctionFor.group_subject_id}
              postCursoNombre={
                [correctionFor.group_name, correctionFor.subject_name].filter(Boolean).join(' — ') ||
                cursoNombreForDrive
              }
              attachments={corrAttachments}
              onAttachmentsChange={setCorrAttachments}
              disabled={correctionMutation.isPending}
              showTeacherPrivateFolder={user?.rol === 'profesor'}
            />
          )}
          <DialogFooter>
            <Button variant="outline" className="border-white/20 text-white" onClick={() => setCorrectionFor(null)}>
              Cerrar
            </Button>
            <Button
              className="bg-violet-600 hover:bg-violet-500"
              disabled={correctionMutation.isPending || !corrTitle.trim()}
              onClick={() => {
                if (!correctionFor) return;
                correctionMutation.mutate({
                  id: correctionFor.id,
                  title: corrTitle.trim(),
                  body: corrBody.trim(),
                  attachments: corrAttachments,
                });
              }}
            >
              Publicar corrección
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ComunicacionAcademico;
