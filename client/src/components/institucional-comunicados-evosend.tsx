import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/lib/authContext';
import {
  Building2,
  Cloud,
  Eye,
  FileSpreadsheet,
  FileText,
  Loader2,
  Link2,
  Megaphone,
  Pencil,
  Presentation,
  Send,
  Inbox,
  Star,
  Trash2,
  RotateCcw,
  X,
} from 'lucide-react';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { EvoComposeAttachmentBar } from '@/components/evo-compose-attachment-bar';
import { EvoComposeAddMenu } from '@/components/evo-compose-add-menu';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { getGroupSubjectColor } from '@/lib/courseColor';
import {
  Calendar,
  CALENDAR_SUMMARY_LABELS_INSTITUTIONAL_EVENTS,
  type CalendarAssignment,
} from '@/components/Calendar';
import { getAssignmentCalendarLocalParts } from '@/lib/assignmentUtils';

type CategoryKey = 'all' | 'general' | 'circular' | 'evento' | 'calendario' | 'aviso';

/** Adjunto de circular institucional: se guarda en `attachments_json` y aparece en Evo Drive de cada padre destinatario. */
export type CircularPublicationAttachment = {
  name: string;
  url: string | null;
  fileId?: string;
};

interface CategoryCounts {
  all: number;
  general: number;
  circular: number;
  evento: number;
  calendario: number;
  aviso: number;
}

interface InstItem {
  id: string;
  title: string;
  body: string | null;
  status: string | null;
  audience: string | null;
  category: string | null;
  priority: string | null;
  created_at: string;
  sent_at: string | null;
  scheduled_send_at: string | null;
  corrected_at: string | null;
  correction_of: string | null;
  created_by_id: string;
  reads_count: number;
  total_recipients: number;
  has_correction: boolean;
  author_name: string | null;
  author_role: string | null;
}

function authHeaders(): HeadersInit {
  const token = localStorage.getItem('autoclose_token') || localStorage.getItem('token');
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

/** Crea Doc/Sheet/Slide en el Drive del usuario vía OAuth (mismo flujo que entregas de tareas). */
async function googleCreatePersonalFile(
  kind: 'doc' | 'sheet' | 'slide',
  nombre: string
): Promise<{ googleWebViewLink?: string; nombre?: string }> {
  return apiRequest('POST', '/api/evo-drive/google/create-personal', {
    nombre: nombre.trim() || 'Sin título',
    tipo: kind,
  });
}

/** Borde izquierdo identidad bandeja institucional 1:1 (GLC). */
const MAILBOX_VIOLET = '#7c3aed';

function safeParseJson<T>(s: string): T | null {
  try {
    return JSON.parse(s) as T;
  } catch {
    return null;
  }
}

function mailboxPreviewContent(raw: string | undefined | null): string {
  if (raw == null || raw === '') return '';
  const trimmed = raw.trim();
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    const meta = safeParseJson<Record<string, unknown>>(trimmed);
    if (meta && typeof meta.name === 'string' && meta.name.trim()) return meta.name;
    if (meta && typeof meta.title === 'string' && meta.title.trim()) return meta.title;
  }
  return raw;
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

function audienceLabel(a: string | null): string {
  switch (a) {
    case 'all':
      return 'Todos';
    case 'parents':
      return 'Solo padres';
    case 'teachers':
      return 'Solo profesores';
    case 'staff':
      return 'Personal / administración';
    default:
      return a || '—';
  }
}

function categoryPublishLabel(cat: string): string {
  const m: Record<string, string> = {
    general: 'Avisos generales',
    circular: 'Circular',
    evento: 'Evento',
    calendario: 'Calendario escolar',
    aviso: 'Aviso',
  };
  return m[cat] ?? cat;
}

function roleLabel(r: string | null): string {
  if (!r) return '';
  const map: Record<string, string> = {
    directivo: 'Directivo',
    profesor: 'Profesor',
    padre: 'Padre/Madre',
    asistente: 'Asistente',
    'admin-general-colegio': 'Admin colegio',
    rector: 'Rector',
  };
  return map[r] ?? r;
}

function initials(name: string | null): string {
  if (!name) return '?';
  const p = name.split(/\s+/).filter(Boolean);
  const a = p[0]?.[0] ?? '';
  const b = p[1]?.[0] ?? '';
  return (a + b).toUpperCase() || '?';
}

const SIDEBAR: { key: CategoryKey; label: string; apiCat: string | null }[] = [
  { key: 'all', label: 'Todos', apiCat: null },
  { key: 'circular', label: 'Circulares', apiCat: 'circular' },
  { key: 'evento', label: 'Eventos', apiCat: 'evento' },
  { key: 'calendario', label: 'Calendario escolar', apiCat: 'calendario' },
  { key: 'general', label: 'Avisos generales', apiCat: 'general' },
];

interface ApiInstitucionalEventRow {
  _id: string;
  titulo: string;
  descripcion: string;
  fecha: string;
  tipo: string;
  cursoId: { _id: string; nombre: string } | null;
  creadoPor?: { _id: string; nombre: string } | null;
  sourceAnnouncementId?: string | null;
}

function mapApiEventsToCalendarAssignments(events: ApiInstitucionalEventRow[]): CalendarAssignment[] {
  return events.map((e) => {
    const raw = String(e.fecha ?? '');
    const dateStr = raw.length >= 10 ? raw.slice(0, 10) : raw;
    const cursoLabel = e.tipo === 'colegio' ? 'Institucional' : (e.cursoId?.nombre?.trim() || 'Curso');
    const groupKey = e.cursoId?._id ?? '__institucional__';
    return {
      _id: e._id,
      titulo: e.titulo,
      descripcion: e.descripcion ?? '',
      curso: cursoLabel,
      fechaEntrega: dateStr,
      profesorNombre: e.creadoPor?.nombre ?? '',
      groupId: groupKey,
      requiresSubmission: false,
      type: 'reminder',
      sourceAnnouncementId: e.sourceAnnouncementId ?? null,
    };
  });
}

function isValidPubEventoDate(s: string): boolean {
  const t = s.trim();
  if (!t) return false;
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) {
    const d = new Date(`${t}T12:00:00`);
    return !Number.isNaN(d.getTime());
  }
  const d = new Date(t);
  return !Number.isNaN(d.getTime());
}

function serializeEventoFechaForApi(s: string): string {
  const t = s.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) {
    return new Date(`${t}T12:00:00`).toISOString();
  }
  return new Date(t).toISOString();
}

type InstitutoCtx = ReturnType<typeof useInstitucionalEvosendData>;
const Ctx = createContext<InstitutoCtx | null>(null);

function useInstitucionalEvosendData() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeCat, setActiveCat] = useState<CategoryKey>('all');
  const [publishComposeMode, setPublishComposeMode] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [pubTitle, setPubTitle] = useState('');
  const [pubBody, setPubBody] = useState('');
  const [pubCategory, setPubCategory] = useState('general');
  const [pubEventoFecha, setPubEventoFecha] = useState('');
  const [pubAudience, setPubAudience] = useState<'all' | 'parents' | 'teachers' | 'staff'>('parents');
  const [pubCircularAttachments, setPubCircularAttachments] = useState<CircularPublicationAttachment[]>([]);
  /** Adjuntos Drive/enlace para categorías distintas de circular (se guardan en attachments_json como la circular). */
  const [pubGeneralAttachments, setPubGeneralAttachments] = useState<CircularPublicationAttachment[]>([]);
  const [readsFor, setReadsFor] = useState<string | null>(null);
  const [readsRows, setReadsRows] = useState<{ user_id: string; full_name: string; read_at: string | null }[]>([]);
  const [corr, setCorr] = useState<InstItem | null>(null);
  const [corrTitle, setCorrTitle] = useState('');
  const [corrBody, setCorrBody] = useState('');
  const [markedRead, setMarkedRead] = useState<Set<string>>(() => new Set());
  const [institutionalMailbox, setInstitutionalMailbox] = useState<
    'feed' | 'threads' | 'trash' | 'starred'
  >('feed');
  /** Solo en true al pulsar «Redactar». Lista de hilos se muestra mientras no esté en compose. */
  const [mailboxComposeMode, setMailboxComposeMode] = useState(false);
  const [mailboxThreadId, setMailboxThreadId] = useState<string | null>(null);
  const [composePrefillRecipient, setComposePrefillRecipient] = useState<{
    id: string;
    nombre: string;
    rol: string;
  } | null>(null);
  /** Navegación desde calendario escolar → ítem en categoría Eventos. */
  const [pendingComunicadoFocusId, setPendingComunicadoFocusId] = useState<string | null>(null);

  const canPublish =
    !!user?.rol &&
    ['directivo', 'admin-general-colegio', 'asistente', 'asistente-academica', 'rector'].includes(user.rol);

  const institutionId = user?.colegioId;
  const eventsListYear = new Date().getFullYear();
  const eventsYearDesde = `${eventsListYear}-01-01`;
  const eventsYearHasta = `${eventsListYear}-12-31`;

  const { data: institutionalEventsYear = [] } = useQuery({
    queryKey: ['institucional-events-year', institutionId, eventsListYear],
    queryFn: async (): Promise<ApiInstitucionalEventRow[]> => {
      const res = await fetch(
        `/api/events?desde=${encodeURIComponent(eventsYearDesde)}&hasta=${encodeURIComponent(eventsYearHasta)}`,
        { headers: authHeaders() }
      );
      if (!res.ok) throw new Error('events');
      return await res.json();
    },
    enabled: !!institutionId,
    staleTime: 30_000,
  });

  const apiCategory =
    activeCat === 'all' ? undefined : SIDEBAR.find((s) => s.key === activeCat)?.apiCat ?? undefined;

  const { data: instConfig } = useQuery({
    queryKey: ['institution-config'],
    queryFn: async (): Promise<{ nombre: string }> => {
      const res = await fetch('/api/institution/config', { headers: authHeaders() });
      if (!res.ok) return { nombre: 'Institución' };
      const j: unknown = await res.json();
      if (
        typeof j === 'object' &&
        j !== null &&
        'nombre' in j &&
        typeof (j as { nombre: unknown }).nombre === 'string'
      ) {
        return { nombre: (j as { nombre: string }).nombre };
      }
      return { nombre: 'Institución' };
    },
  });

  const { data: counts = { all: 0, general: 0, circular: 0, evento: 0, calendario: 0, aviso: 0 } } =
    useQuery({
      queryKey: ['institucional-categorias'],
      queryFn: async (): Promise<CategoryCounts> => {
        const res = await fetch('/api/institucional/comunicados/categorias', { headers: authHeaders() });
        if (!res.ok) throw new Error('categorias');
        return await res.json();
      },
    });

  const { data: list = [], isLoading } = useQuery({
    queryKey: ['institucional-comunicados', apiCategory ?? 'all'],
    queryFn: async (): Promise<InstItem[]> => {
      const q = apiCategory ? `?category=${encodeURIComponent(apiCategory)}` : '';
      const res = await fetch(`/api/institucional/comunicados${q}`, { headers: authHeaders() });
      if (!res.ok) throw new Error('list');
      return await res.json();
    },
    enabled: activeCat !== 'calendario',
  });

  const monthYear = useMemo(
    () =>
      new Date().toLocaleDateString('es-CO', {
        month: 'long',
        year: 'numeric',
      }),
    []
  );

  const markRead = useCallback(
    (id: string) => {
      setMarkedRead((prev) => {
        if (prev.has(id)) return prev;
        fetch(`/api/institucional/comunicado/${id}/read`, {
          method: 'POST',
          headers: authHeaders(),
        }).then(() => {
          queryClient.invalidateQueries({ queryKey: ['institucional-comunicados'] });
          queryClient.invalidateQueries({ queryKey: ['communication-summary'] });
        });
        return new Set(prev).add(id);
      });
    },
    [queryClient]
  );

  useEffect(() => {
    if (pubCategory !== 'circular') setPubCircularAttachments([]);
  }, [pubCategory]);

  useEffect(() => {
    if (pubCategory === 'circular') setPubGeneralAttachments([]);
  }, [pubCategory]);

  const cancelMut = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/institucional/comunicado/${id}/cancel`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error('cancel');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['institucional-comunicados'] });
      queryClient.invalidateQueries({ queryKey: ['institucional-categorias'] });
      queryClient.invalidateQueries({ queryKey: ['institucional-events-year'] });
      queryClient.invalidateQueries({ queryKey: ['directivoEvents'] });
      queryClient.invalidateQueries({ queryKey: ['/api/events'] });
    },
  });

  const publishMut = useMutation({
    mutationFn: async () => {
      const body: Record<string, unknown> = {
        title: pubTitle.trim(),
        body: pubBody.trim(),
        audience: pubAudience,
        category: pubCategory,
        priority: 'normal',
      };
      if (pubCategory === 'evento') {
        body.eventoFecha = serializeEventoFechaForApi(pubEventoFecha);
      }
      const attachmentSource =
        pubCategory === 'circular' ? pubCircularAttachments : pubGeneralAttachments;
      if (attachmentSource.length > 0) {
        body.attachments = attachmentSource.map((a) => ({
          name: a.name,
          url: a.url || undefined,
          fileId: a.fileId,
        }));
      }
      const res = await fetch('/api/institucional/comunicado', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.text();
        throw new Error(err || 'publish');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['institucional-comunicados'] });
      queryClient.invalidateQueries({ queryKey: ['institucional-categorias'] });
      queryClient.invalidateQueries({ queryKey: ['institucional-events-year'] });
      queryClient.invalidateQueries({ queryKey: ['directivoEvents'] });
      queryClient.invalidateQueries({ queryKey: ['/api/events'] });
      queryClient.invalidateQueries({ queryKey: ['evo-drive', 'padre-circulares'] });
      queryClient.invalidateQueries({ queryKey: ['evo-drive', 'recientes'] });
      setPubTitle('');
      setPubBody('');
      setPubEventoFecha('');
      setPubCircularAttachments([]);
      setPubGeneralAttachments([]);
      setPreviewOpen(false);
      setPublishComposeMode(false);
    },
  });

  const corrMut = useMutation({
    mutationFn: async () => {
      if (!corr) throw new Error('no corr');
      const res = await fetch(`/api/institucional/comunicado/${corr.id}/correccion`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ title: corrTitle.trim(), body: corrBody.trim() }),
      });
      if (!res.ok) throw new Error('corr');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['institucional-comunicados'] });
      setCorr(null);
    },
  });

  const openReads = useCallback(async (id: string) => {
    setReadsFor(id);
    const res = await fetch(`/api/institucional/comunicado/${id}/read-detail`, { headers: authHeaders() });
    if (res.ok) {
      const j = (await res.json()) as {
        recipients: { user_id: string; full_name: string; read_at: string | null }[];
      };
      setReadsRows(j.recipients ?? []);
    } else setReadsRows([]);
  }, []);

  const countForSidebar = (k: CategoryKey) => {
    if (k === 'all') return counts.all;
    if (k === 'calendario') return institutionalEventsYear.length;
    return counts[k as keyof CategoryCounts] ?? 0;
  };

  const openComunicadoInEventosFeed = useCallback((announcementId: string) => {
    setInstitutionalMailbox('feed');
    setMailboxComposeMode(false);
    setMailboxThreadId(null);
    setPublishComposeMode(false);
    setActiveCat('evento');
    setPendingComunicadoFocusId(announcementId);
  }, []);

  const canCorrect = (c: InstItem): boolean => {
    if (!c.sent_at || c.correction_of || c.has_correction) return false;
    if (c.created_by_id !== user?.id) return false;
    if (!canPublish) return false;
    return Date.now() - new Date(c.sent_at).getTime() < 24 * 60 * 60 * 1000;
  };

  const { data: mailboxFolderMeta } = useQuery({
    queryKey: ['institutional-mailbox-meta'],
    queryFn: async () => {
      const res = await fetch('/api/evo-send/institutional-mailbox-meta', { headers: authHeaders() });
      if (!res.ok) throw new Error('meta');
      return (await res.json()) as { trashCount: number; starredCount: number };
    },
    staleTime: 15_000,
  });

  return {
    activeCat,
    setActiveCat,
    publishComposeMode,
    setPublishComposeMode,
    previewOpen,
    setPreviewOpen,
    pubTitle,
    setPubTitle,
    pubBody,
    setPubBody,
    pubCategory,
    setPubCategory,
    pubEventoFecha,
    setPubEventoFecha,
    pubAudience,
    setPubAudience,
    pubCircularAttachments,
    setPubCircularAttachments,
    pubGeneralAttachments,
    setPubGeneralAttachments,
    readsFor,
    setReadsFor,
    readsRows,
    corr,
    setCorr,
    corrTitle,
    setCorrTitle,
    corrBody,
    setCorrBody,
    canPublish,
    instConfig,
    list,
    isLoading,
    monthYear,
    markRead,
    cancelMut,
    publishMut,
    corrMut,
    openReads,
    countForSidebar,
    canCorrect,
    institutionalMailbox,
    setInstitutionalMailbox,
    mailboxComposeMode,
    setMailboxComposeMode,
    mailboxThreadId,
    setMailboxThreadId,
    composePrefillRecipient,
    setComposePrefillRecipient,
    /** Abre el panel de redacción institucional (Gmail), sin mezclar con bandeja lista. */
    openInstitutionalCompose: () => {
      setPublishComposeMode(false);
      setComposePrefillRecipient(null);
      setInstitutionalMailbox('threads');
      setMailboxComposeMode(true);
      setMailboxThreadId(null);
    },
    openInstitutionalComposeToPerson: (p: { id: string; nombre: string; rol: string }) => {
      setPublishComposeMode(false);
      setComposePrefillRecipient(p);
      setInstitutionalMailbox('threads');
      setMailboxComposeMode(true);
      setMailboxThreadId(null);
    },
    mailboxFolderMeta,
    pendingComunicadoFocusId,
    setPendingComunicadoFocusId,
    openComunicadoInEventosFeed,
  };
}

export function InstitutoComunicadosEvoProvider({ children }: { children: ReactNode }) {
  const value = useInstitucionalEvosendData();
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useInstitutoCtx() {
  const v = useContext(Ctx);
  if (!v) throw new Error('InstitutoComunicadosEvoProvider required');
  return v;
}

export function InstitutoCategoriesSidebarNav() {
  const { user } = useAuth();
  const {
    activeCat,
    setActiveCat,
    countForSidebar,
    canPublish,
    publishComposeMode,
    setPublishComposeMode,
    institutionalMailbox,
    setInstitutionalMailbox,
    mailboxComposeMode,
    setMailboxComposeMode,
    setMailboxThreadId,
    openInstitutionalCompose,
    mailboxFolderMeta,
  } = useInstitutoCtx();

  const canMailbox =
    !!user?.rol &&
    [
      'estudiante',
      'profesor',
      'directivo',
      'padre',
      'administrador-general',
      'admin-general-colegio',
      'transporte',
      'tesoreria',
      'nutricion',
      'cafeteria',
      'asistente',
      'asistente-academica',
      'school_admin',
    ].includes(user.rol);

  const { data: institutionalInboxUnread = 0 } = useQuery({
    queryKey: ['director-mailbox-unread-count', user?.id],
    queryFn: async (): Promise<number> => {
      const res = await fetch('/api/evo-send/director-mailbox', { headers: authHeaders() });
      if (!res.ok) return 0;
      const j = (await res.json()) as { threads?: { unreadCount?: number }[] };
      return (j.threads ?? []).reduce((acc, t) => acc + (t.unreadCount ?? 0), 0);
    },
    enabled: canMailbox && !!user?.id,
    refetchInterval: 25_000,
    staleTime: 8_000,
  });

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.04] backdrop-blur-md p-3 shrink-0">
      <div className="flex items-center justify-between mb-2 gap-2">
        <h2 className="text-white font-semibold text-xs">GLC</h2>
        {canPublish ? (
          <Button
            type="button"
            size="sm"
            className={`h-7 text-[11px] shrink-0 px-2 text-white ${
              publishComposeMode
                ? 'bg-[#5b21b6] ring-2 ring-[#a78bfa]/50'
                : 'bg-[#7c3aed] hover:bg-[#6d28d9]'
            }`}
            onClick={() => {
              setMailboxComposeMode(false);
              setMailboxThreadId(null);
              setInstitutionalMailbox('feed');
              setPublishComposeMode(true);
            }}
          >
            + Publicar
          </Button>
        ) : null}
      </div>
      <nav className="space-y-0.5">
        {SIDEBAR.map((s) => {
          const active = activeCat === s.key;
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => {
                setInstitutionalMailbox('feed');
                setMailboxComposeMode(false);
                setPublishComposeMode(false);
                setActiveCat(s.key);
              }}
              className={`w-full flex justify-between items-center rounded-lg px-2 py-1.5 text-[12px] text-left border-l-2 transition-colors ${
                active
                  ? 'border-[#7c3aed] bg-[rgba(124,58,237,0.12)] text-white'
                  : 'border-transparent text-white/75 hover:bg-white/5'
              }`}
            >
              <span>{s.label}</span>
              <span className="text-white/45 text-[10px] tabular-nums">{countForSidebar(s.key)}</span>
            </button>
          );
        })}
      </nav>
      {canMailbox ? (
        <div className="mt-3 pt-3 border-t border-white/[0.06] space-y-1">
          <div className="flex items-center justify-between gap-2 mb-1">
            <h3 className="text-white/70 font-semibold text-[10px] uppercase tracking-wide">Comunicación 1:1</h3>
            <Button
              type="button"
              size="sm"
              className={`h-7 text-[11px] shrink-0 px-2 text-white ${
                institutionalMailbox === 'threads' && mailboxComposeMode
                  ? 'bg-[#5b21b6] ring-2 ring-[#a78bfa]/50'
                  : 'bg-[#7c3aed] hover:bg-[#6d28d9]'
              }`}
              onClick={() => openInstitutionalCompose()}
            >
              Redactar
            </Button>
          </div>
          <button
            type="button"
            onClick={() => {
              setInstitutionalMailbox('threads');
              setMailboxComposeMode(false);
              setPublishComposeMode(false);
              setMailboxThreadId(null);
            }}
            className={`w-full flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-[12px] text-left border-l-2 transition-colors ${
              institutionalMailbox === 'threads' && !mailboxComposeMode
                ? 'border-[#7c3aed] bg-[rgba(124,58,237,0.12)] text-white'
                : 'border-transparent text-white/75 hover:bg-white/5'
            }`}
          >
            <span className="flex items-center gap-2 min-w-0">
              <Inbox className="w-3.5 h-3.5 shrink-0 opacity-80" />
              Comunicados 1:1
            </span>
            {institutionalInboxUnread > 0 ? (
              <span
                className="min-w-[1.25rem] h-5 px-1 rounded-full bg-[hsl(var(--primary))] text-white text-[10px] font-bold tabular-nums flex items-center justify-center shrink-0"
                aria-label={`${institutionalInboxUnread} sin leer`}
              >
                {institutionalInboxUnread > 99 ? '99+' : institutionalInboxUnread}
              </span>
            ) : null}
          </button>
          <button
            type="button"
            onClick={() => {
              setInstitutionalMailbox('trash');
              setMailboxComposeMode(false);
              setPublishComposeMode(false);
              setMailboxThreadId(null);
            }}
            className={`w-full flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-[12px] text-left border-l-2 transition-colors ${
              institutionalMailbox === 'trash'
                ? 'border-[#7c3aed] bg-[rgba(124,58,237,0.12)] text-white'
                : 'border-transparent text-white/75 hover:bg-white/5'
            }`}
          >
            <span className="flex items-center gap-2 min-w-0">
              <Trash2 className="w-3.5 h-3.5 shrink-0 opacity-80" />
              Papelera
            </span>
            {mailboxFolderMeta && mailboxFolderMeta.trashCount > 0 ? (
              <span className="text-white/45 text-[10px] tabular-nums shrink-0">{mailboxFolderMeta.trashCount}</span>
            ) : null}
          </button>
          <button
            type="button"
            onClick={() => {
              setInstitutionalMailbox('starred');
              setMailboxComposeMode(false);
              setPublishComposeMode(false);
              setMailboxThreadId(null);
            }}
            className={`w-full flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-[12px] text-left border-l-2 transition-colors ${
              institutionalMailbox === 'starred'
                ? 'border-[#7c3aed] bg-[rgba(124,58,237,0.12)] text-white'
                : 'border-transparent text-white/75 hover:bg-white/5'
            }`}
          >
            <span className="flex items-center gap-2 min-w-0">
              <Star className="w-3.5 h-3.5 shrink-0 opacity-80" />
              Destacados
            </span>
            {mailboxFolderMeta && mailboxFolderMeta.starredCount > 0 ? (
              <span className="text-white/45 text-[10px] tabular-nums shrink-0">{mailboxFolderMeta.starredCount}</span>
            ) : null}
          </button>
        </div>
      ) : null}
    </div>
  );
}

type MailboxThreadRow = {
  _id: string;
  asunto: string;
  tipo?: string;
  unreadCount?: number;
  peerName?: string;
  peerRole?: string;
  ultimoMensaje?: { contenido: string; fecha: string } | null;
};

type MailboxMsg = {
  _id: string;
  contenido: string;
  tipo: string;
  fecha: string;
  remitenteId: { _id: string; nombre?: string; rol?: string };
  starred?: boolean;
  viewerTrashed?: boolean;
};

function InstMailboxMessageBody({ m }: { m: MailboxMsg }) {
  const driveMeta =
    m.tipo === 'evo_drive'
      ? safeParseJson<{ name?: string; url?: string | null; fileId?: string }>(m.contenido)
      : null;
  const linkMeta =
    m.tipo === 'evo_link' ? safeParseJson<{ url?: string; title?: string }>(m.contenido) : null;

  if (m.tipo === 'evo_link' && linkMeta?.url) {
    return (
      <button
        type="button"
        onClick={() => window.open(linkMeta.url, '_blank')}
        className="mt-2 w-full max-w-full rounded-lg border border-white/10 bg-white/[0.06] px-4 py-3 text-left transition-colors hover:bg-white/[0.09]"
      >
        <p className="text-[10px] font-semibold uppercase tracking-wide text-white/50 flex items-center gap-1.5">
          <Link2 className="h-3.5 w-3.5 opacity-70" />
          Enlace
        </p>
        <p className="mt-1 text-sm font-semibold text-[hsl(var(--primary))] truncate">{linkMeta.title || linkMeta.url}</p>
        <p className="mt-0.5 text-[11px] text-white/45 truncate">{linkMeta.url}</p>
      </button>
    );
  }

  if (m.tipo === 'evo_drive') {
    if (!driveMeta?.url && !driveMeta?.fileId) {
      return <p className="mt-2 whitespace-pre-wrap break-words leading-relaxed text-white/80">{m.contenido}</p>;
    }
    const open = () => {
      const url = driveMeta?.url;
      if (url) window.open(url, '_blank');
      else if (driveMeta?.fileId)
        window.location.href = `/evo-drive?openFile=${encodeURIComponent(driveMeta.fileId)}`;
    };
    return (
      <button
        type="button"
        onClick={open}
        className="mt-2 w-full max-w-full rounded-lg border border-white/10 px-4 py-3 text-left transition-colors hover:bg-white/[0.06]"
        style={{ borderLeftWidth: 4, borderLeftColor: MAILBOX_VIOLET }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-white/50">Evo Drive</p>
            <p className="mt-1 text-sm font-semibold text-white truncate">{driveMeta?.name || 'Archivo'}</p>
          </div>
          <Cloud className="h-5 w-5 shrink-0 text-white/60" />
        </div>
      </button>
    );
  }

  return <p className="mt-2 whitespace-pre-wrap break-words leading-relaxed">{m.contenido}</p>;
}

function DirectorMailboxPanel() {
  const { toast } = useToast();
  const { user } = useAuth();
  const {
    institutionalMailbox,
    mailboxComposeMode,
    setMailboxComposeMode,
    mailboxThreadId,
    setMailboxThreadId,
    composePrefillRecipient,
    setComposePrefillRecipient,
  } = useInstitutoCtx();
  const queryClient = useQueryClient();
  const mailboxThreadIdRef = useRef<string | null>(null);
  useEffect(() => {
    mailboxThreadIdRef.current = mailboxThreadId;
  }, [mailboxThreadId]);

  const showComposeNew = institutionalMailbox === 'threads' && mailboxComposeMode && !mailboxThreadId;

  const [threadRevealTrash, setThreadRevealTrash] = useState(false);

  const [replyDialogOpen, setReplyDialogOpen] = useState(false);
  const [replyDraft, setReplyDraft] = useState('');
  const [composeSubject, setComposeSubject] = useState('');
  const [composeBody, setComposeBody] = useState('');
  const [composeRecipientId, setComposeRecipientId] = useState('');
  const [composeRecipientLabel, setComposeRecipientLabel] = useState('');
  const [recipientSearch, setRecipientSearch] = useState('');
  const [debouncedRecipientSearch, setDebouncedRecipientSearch] = useState('');
  const [recipientMenuOpen, setRecipientMenuOpen] = useState(false);
  const [showDrivePicker, setShowDrivePicker] = useState(false);
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkTitle, setLinkTitle] = useState('');
  const [composeDriveQueue, setComposeDriveQueue] = useState<{ name: string; url: string }[]>([]);
  const composeDriveQueueRef = useRef<{ name: string; url: string }[]>([]);
  useEffect(() => {
    composeDriveQueueRef.current = composeDriveQueue;
  }, [composeDriveQueue]);
  const [mailboxGCreateOpen, setMailboxGCreateOpen] = useState(false);
  const [mailboxGCreateKind, setMailboxGCreateKind] = useState<'doc' | 'sheet' | 'slide' | null>(null);
  const [mailboxGCreateNombre, setMailboxGCreateNombre] = useState('');

  const { data: mailboxGoogleStatus = { connected: false } } = useQuery<{ connected: boolean }>({
    queryKey: ['evo-drive', 'google-status'],
    queryFn: () => apiRequest<{ connected: boolean }>('GET', '/api/evo-drive/google/status'),
    staleTime: 60_000,
  });

  useEffect(() => {
    if (!showComposeNew) {
      setComposeDriveQueue([]);
      composeDriveQueueRef.current = [];
    }
  }, [showComposeNew]);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedRecipientSearch(recipientSearch.trim()), 320);
    return () => window.clearTimeout(t);
  }, [recipientSearch]);

  useEffect(() => {
    if (!composePrefillRecipient || !showComposeNew) return;
    setComposeRecipientId(composePrefillRecipient.id);
    setComposeRecipientLabel(`${composePrefillRecipient.nombre} · ${composePrefillRecipient.rol}`);
    setRecipientSearch('');
    setRecipientMenuOpen(false);
    setComposePrefillRecipient(null);
  }, [composePrefillRecipient, showComposeNew, setComposePrefillRecipient]);

  const appendComposeLine = useCallback((line: string) => {
    setComposeBody((b) => (b.trim() ? `${b.trimEnd()}\n${line}\n` : `${line}\n`));
  }, []);

  const { data: mailboxData, isLoading: loadingMailbox } = useQuery({
    queryKey: ['director-mailbox'],
    queryFn: async (): Promise<{ threads: MailboxThreadRow[] }> => {
      const res = await fetch('/api/evo-send/director-mailbox', {
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error('mailbox');
      return await res.json();
    },
    enabled: institutionalMailbox === 'threads',
  });

  const folderParam = institutionalMailbox === 'trash' ? 'trash' : 'starred';
  const { data: folderData, isLoading: loadingFolder } = useQuery({
    queryKey: ['institutional-mailbox-folder', folderParam],
    queryFn: async () => {
      const res = await fetch(
        `/api/evo-send/institutional-mailbox-folder?folder=${encodeURIComponent(folderParam)}`,
        { headers: authHeaders() }
      );
      if (!res.ok) throw new Error('folder');
      return (await res.json()) as {
        items: Array<{
          messageId: string;
          threadId: string;
          asunto: string;
          preview: string;
          fecha: string;
          senderName: string;
          contentType: string;
        }>;
      };
    },
    enabled: (institutionalMailbox === 'trash' || institutionalMailbox === 'starred') && !mailboxThreadId,
  });

  const { data: rawPeople = [] } = useQuery({
    queryKey: ['director-mailbox-people', debouncedRecipientSearch],
    queryFn: async () => {
      const res = await fetch(
        `/api/evo-send/people-finder?q=${encodeURIComponent(debouncedRecipientSearch)}`,
        { headers: authHeaders() }
      );
      if (!res.ok) return [];
      return (await res.json()) as { id: string; nombre: string; rol: string }[];
    },
    enabled: showComposeNew && debouncedRecipientSearch.length >= 2,
    staleTime: 10_000,
  });

  const { data: threadDetail, isLoading: loadingThread } = useQuery({
    queryKey: ['/api/evo-send/threads', mailboxThreadId, threadRevealTrash],
    queryFn: async () => {
      const q = threadRevealTrash ? '?revealTrash=1' : '';
      const res = await fetch(`/api/evo-send/threads/${mailboxThreadId}${q}`, { headers: authHeaders() });
      if (!res.ok) throw new Error('thread');
      return (await res.json()) as { thread: { asunto: string; tipo: string } | null; messages: MailboxMsg[] };
    },
    enabled: !!mailboxThreadId,
  });

  const viewerId = useMemo(() => {
    const raw = user?.id ?? user?.userId ?? user?._id;
    return raw != null && raw !== '' ? String(raw) : '';
  }, [user?._id, user?.id, user?.userId]);

  const canReplyInThread = useMemo(() => {
    const msgs = threadDetail?.messages ?? [];
    if (!viewerId || msgs.length === 0) return false;
    return msgs.some((m) => {
      const sid = m.remitenteId?._id != null ? String(m.remitenteId._id) : '';
      return sid !== '' && sid !== viewerId;
    });
  }, [threadDetail?.messages, viewerId]);

  useEffect(() => {
    if (!canReplyInThread && replyDialogOpen) {
      setReplyDialogOpen(false);
      setReplyDraft('');
    }
  }, [canReplyInThread, replyDialogOpen]);

  const flagMut = useMutation({
    mutationFn: async (p: { messageId: string; trash?: boolean; star?: boolean }) => {
      const body: { trash?: boolean; star?: boolean } = {};
      if (p.trash !== undefined) body.trash = p.trash;
      if (p.star !== undefined) body.star = p.star;
      const res = await fetch(`/api/evo-send/messages/${p.messageId}/mailbox-flags`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(j.message || 'No se pudo actualizar el mensaje.');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/evo-send/threads'] });
      queryClient.invalidateQueries({ queryKey: ['director-mailbox'] });
      queryClient.invalidateQueries({ queryKey: ['director-mailbox-unread-count'] });
      queryClient.invalidateQueries({ queryKey: ['institutional-mailbox-meta'] });
      queryClient.invalidateQueries({ queryKey: ['institutional-mailbox-folder'] });
    },
  });

  const sendMut = useMutation({
    mutationFn: async (body: { contenido?: string; contentType?: string; meta?: unknown }) => {
      const tid = mailboxThreadId;
      if (!tid) throw new Error('thread');
      const res = await fetch(`/api/evo-send/threads/${tid}/messages`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          contenido: body.contenido ?? '',
          prioridad: 'normal',
          contentType: body.contentType,
          meta: body.meta,
        }),
      });
      if (!res.ok) throw new Error('send');
      return await res.json();
    },
    onSuccess: () => {
      setReplyDraft('');
      setReplyDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ['/api/evo-send/threads'] });
      queryClient.invalidateQueries({ queryKey: ['director-mailbox'] });
      queryClient.invalidateQueries({ queryKey: ['director-mailbox-unread-count'] });
      queryClient.invalidateQueries({ queryKey: ['institutional-mailbox-meta'] });
      queryClient.invalidateQueries({ queryKey: ['institutional-mailbox-folder'] });
    },
  });

  const createDirectMut = useMutation({
    mutationFn: async () => {
      const queue = [...composeDriveQueueRef.current];
      const hasQueue = queue.length > 0;
      const bodyText = composeBody.trim() || (hasQueue ? 'Adjunto(s) en este mensaje.' : '');
      if (!composeRecipientId?.trim() || !composeSubject.trim()) {
        throw new Error('Faltan destinatario o asunto.');
      }
      if (!bodyText.trim()) {
        throw new Error('Escribe el mensaje o adjunta al menos un archivo desde Google Drive.');
      }

      const res = await fetch('/api/evo-send/threads', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          asunto: composeSubject.trim(),
          contenido: bodyText,
          tipo: 'evo_chat_direct',
          targetUserId: composeRecipientId,
          prioridad: 'normal',
        }),
      });
      const j: unknown = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg =
          typeof j === 'object' && j !== null && 'message' in j && typeof (j as { message: unknown }).message === 'string'
            ? (j as { message: string }).message
            : 'No se pudo enviar el mensaje.';
        throw new Error(msg);
      }
      const parsed = j as { _id?: string };
      const threadId = parsed._id != null ? String(parsed._id) : null;
      if (!threadId) throw new Error('Respuesta inválida del servidor.');

      for (const att of queue) {
        const r2 = await fetch(`/api/evo-send/threads/${threadId}/messages`, {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify({
            contenido: '',
            contentType: 'evo_drive',
            meta: { name: att.name, url: att.url },
          }),
        });
        if (!r2.ok) {
          throw new Error(
            'El mensaje se envió, pero no se pudo adjuntar un documento. Abre el hilo y vuelve a adjuntar si hace falta.'
          );
        }
      }
      return parsed;
    },
    onSuccess: (data) => {
      composeDriveQueueRef.current = [];
      setComposeDriveQueue([]);
      if (data._id) setMailboxThreadId(String(data._id));
      setMailboxComposeMode(false);
      setComposeSubject('');
      setComposeBody('');
      setComposeRecipientId('');
      setComposeRecipientLabel('');
      setRecipientSearch('');
      queryClient.invalidateQueries({ queryKey: ['director-mailbox'] });
      queryClient.invalidateQueries({ queryKey: ['director-mailbox-unread-count'] });
      queryClient.invalidateQueries({ queryKey: ['/api/evo-send/threads'] });
      queryClient.invalidateQueries({ queryKey: ['institutional-mailbox-meta'] });
      queryClient.invalidateQueries({ queryKey: ['institutional-mailbox-folder'] });
    },
    onError: (e: Error) => {
      toast({
        title: 'No se pudo enviar el mensaje',
        description: e.message || 'Intenta de nuevo o verifica tu conexión.',
        variant: 'destructive',
      });
    },
  });

  const mailboxGoogleCreateMut = useMutation({
    mutationFn: async (vars: { kind: 'doc' | 'sheet' | 'slide'; nombre: string }) => {
      return googleCreatePersonalFile(vars.kind, vars.nombre.trim() || 'Sin título');
    },
    onSuccess: (data, vars) => {
      const url = data.googleWebViewLink;
      if (!url) return;
      const name = (data.nombre ?? vars.nombre).trim() || 'Documento';
      const tid = mailboxThreadIdRef.current;
      if (tid) {
        sendMut.mutate({ contentType: 'evo_drive', meta: { name, url } });
      } else {
        setComposeDriveQueue((q) => {
          const n = [...q, { name, url }];
          composeDriveQueueRef.current = n;
          return n;
        });
        toast({ title: 'Documento listo', description: 'Se adjuntará al enviar el mensaje como archivo de Drive.' });
      }
      setMailboxGCreateOpen(false);
      setMailboxGCreateNombre('');
      setMailboxGCreateKind(null);
    },
    onError: (e: Error) => {
      toast({
        title: 'Google Drive',
        description:
          e.message || 'No se pudo crear el archivo. Conecta tu cuenta en Evo Drive si aún no lo has hecho.',
        variant: 'destructive',
      });
    },
  });

  const openMailboxGoogleCreate = (kind: 'doc' | 'sheet' | 'slide') => {
    if (!mailboxGoogleStatus.connected) {
      toast({
        title: 'Conecta Google Drive',
        description: 'Abre Evo Drive y conecta tu cuenta para crear documentos.',
        variant: 'destructive',
      });
      return;
    }
    setMailboxGCreateKind(kind);
    setMailboxGCreateNombre('');
    setMailboxGCreateOpen(true);
  };

  const allThreads = mailboxData?.threads ?? [];
  const [threadSearch, setThreadSearch] = useState('');

  const threads = useMemo(() => {
    const q = threadSearch.trim().toLowerCase();
    if (!q) return allThreads;
    return allThreads.filter((t) => {
      const asunto = (t.asunto ?? '').toLowerCase();
      const peer = (t.peerName ?? '').toLowerCase();
      const preview = (t.ultimoMensaje?.contenido ?? '').toLowerCase();
      return asunto.includes(q) || peer.includes(q) || preview.includes(q);
    });
  }, [allThreads, threadSearch]);

  const applyDriveFile = (meta: Record<string, unknown>) => {
    const tid = mailboxThreadIdRef.current;
    if (tid) {
      sendMut.mutate({ contentType: 'evo_drive', meta });
    } else {
      const name = String(meta.name ?? 'Archivo').trim() || 'Archivo';
      const u = typeof meta.url === 'string' ? meta.url.trim() : '';
      const fileId = typeof meta.fileId === 'string' ? meta.fileId.trim() : '';
      const url = u || (fileId ? `https://drive.google.com/file/d/${fileId}/view` : '');
      if (!url) {
        setShowDrivePicker(false);
        return;
      }
      setComposeDriveQueue((q) => {
        const n = [...q, { name, url }];
        composeDriveQueueRef.current = n;
        return n;
      });
      toast({ title: 'Archivo en cola', description: 'Se enviará como documento de Drive al pulsar Enviar.' });
    }
    setShowDrivePicker(false);
  };

  const applyLink = () => {
    const u = linkUrl.trim();
    if (!u) return;
    const t = linkTitle.trim() || u;
    const tid = mailboxThreadIdRef.current;
    if (tid) {
      sendMut.mutate({ contentType: 'evo_link', meta: { url: u, title: t } });
    } else {
      appendComposeLine(`[${t}](${u})`);
    }
    setShowLinkDialog(false);
    setLinkUrl('');
    setLinkTitle('');
  };

  const addMenuDisabled =
    sendMut.isPending || createDirectMut.isPending || mailboxGoogleCreateMut.isPending;
  const composeSendDisabled =
    !composeRecipientId ||
    !composeSubject.trim() ||
    (!composeBody.trim() && composeDriveQueue.length === 0) ||
    createDirectMut.isPending;

  const openThread = (threadId: string, opts?: { fromTrash?: boolean }) => {
    setMailboxComposeMode(false);
    setThreadRevealTrash(!!opts?.fromTrash);
    setMailboxThreadId(threadId);
    void fetch(`/api/evo-send/threads/${threadId}/read`, {
      method: 'PATCH',
      headers: authHeaders(),
    }).then(() => {
      queryClient.invalidateQueries({ queryKey: ['director-mailbox'] });
      queryClient.invalidateQueries({ queryKey: ['director-mailbox-unread-count'] });
    });
  };

  useEffect(() => {
    if (!mailboxThreadId) {
      setReplyDialogOpen(false);
      setReplyDraft('');
      setThreadRevealTrash(false);
    }
  }, [mailboxThreadId]);

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl panel-grades">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {showComposeNew ? (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="shrink-0 border-b border-white/10 bg-white/[0.04] px-4 py-4 sm:px-5">
              <h2
                className="text-lg font-semibold tracking-tight text-[var(--text-primary,#E2E8F0)] border-l-[3px] pl-3 py-0.5"
                style={{ borderLeftColor: MAILBOX_VIOLET }}
              >
                Redactar mensaje
              </h2>
              <p className="mt-1 text-[12px] text-white/55">
                Comunicado institucional: destinatario, asunto y cuerpo. Cada nuevo asunto crea un hilo independiente.
              </p>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-5">
              <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
                <div className="space-y-1.5">
                  <label htmlFor="mailbox-compose-para" className="text-[11px] font-semibold uppercase tracking-wide text-white/45">
                    Para
                  </label>
                  {composeRecipientId ? (
                    <div className="flex items-center gap-2 rounded-lg border border-white/[0.1] bg-white/[0.04] px-3 py-2.5">
                      <span className="flex-1 text-[13px] text-white/90">{composeRecipientLabel}</span>
                      <button
                        type="button"
                        className="rounded-md p-1 text-white/50 transition-colors hover:bg-white/10 hover:text-white"
                        aria-label="Quitar destinatario"
                        onClick={() => {
                          setComposeRecipientId('');
                          setComposeRecipientLabel('');
                          setRecipientSearch('');
                        }}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="relative">
                      <Input
                        id="mailbox-compose-para"
                        value={recipientSearch}
                        onChange={(e) => {
                          setRecipientSearch(e.target.value);
                          setRecipientMenuOpen(true);
                        }}
                        onFocus={() => setRecipientMenuOpen(true)}
                        placeholder="Buscar usuario de la institución (mín. 2 caracteres)…"
                        className="h-10 border-white/[0.12] bg-white/[0.05] text-[13px] text-white placeholder:text-white/35"
                        autoComplete="off"
                      />
                      {recipientMenuOpen && debouncedRecipientSearch.length >= 2 ? (
                        <ul
                          className="absolute z-30 mt-1 max-h-52 w-full overflow-y-auto rounded-lg border border-white/10 py-1 shadow-lg"
                          style={{ background: 'rgba(15,23,42,0.98)' }}
                        >
                          {rawPeople.length === 0 ? (
                            <li className="px-3 py-2 text-[12px] text-white/45">Sin resultados.</li>
                          ) : (
                            rawPeople.map((p) => (
                              <li key={p.id}>
                                <button
                                  type="button"
                                  className="w-full px-3 py-2 text-left text-[13px] text-white/90 hover:bg-white/10"
                                  onClick={() => {
                                    setComposeRecipientId(p.id);
                                    setComposeRecipientLabel(`${p.nombre} · ${p.rol}`);
                                    setRecipientSearch('');
                                    setRecipientMenuOpen(false);
                                  }}
                                >
                                  <span className="font-medium">{p.nombre}</span>
                                  <span className="text-white/40"> · {p.rol}</span>
                                </button>
                              </li>
                            ))
                          )}
                        </ul>
                      ) : null}
                    </div>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="mailbox-compose-subject" className="text-[11px] font-semibold uppercase tracking-wide text-white/45">
                    Asunto
                  </label>
                  <Input
                    id="mailbox-compose-subject"
                    value={composeSubject}
                    onChange={(e) => setComposeSubject(e.target.value)}
                    placeholder="Asunto del mensaje"
                    className="h-10 border-white/[0.12] bg-white/[0.05] text-[13px] text-white placeholder:text-white/35"
                  />
                </div>

                <div className="flex min-h-[min(420px,50vh)] flex-1 flex-col space-y-1.5">
                  <label htmlFor="mailbox-compose-body" className="text-[11px] font-semibold uppercase tracking-wide text-white/45">
                    Mensaje
                  </label>
                  <Textarea
                    id="mailbox-compose-body"
                    value={composeBody}
                    onChange={(e) => setComposeBody(e.target.value)}
                    placeholder="Escribe el cuerpo del mensaje…"
                    className="min-h-[280px] flex-1 resize-y border-white/[0.12] bg-white/[0.05] text-[13px] leading-relaxed text-white placeholder:text-white/35"
                  />
                  {composeDriveQueue.length > 0 ? (
                    <ul className="flex flex-col gap-2 pt-1">
                      {composeDriveQueue.map((f, idx) => (
                        <li
                          key={`${f.url}-${idx}`}
                          className="flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-white/[0.05] px-3 py-2 text-[13px]"
                        >
                          <span className="text-white/90 truncate min-w-0" title={f.name}>
                            {f.name}
                          </span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 shrink-0 text-white/55 hover:text-white"
                            onClick={() => {
                              setComposeDriveQueue((prev) => {
                                const n = prev.filter((_, i) => i !== idx);
                                composeDriveQueueRef.current = n;
                                return n;
                              });
                            }}
                          >
                            Quitar
                          </Button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              </div>
            </div>
            <div className="shrink-0 border-t border-white/10 bg-white/[0.03] px-4 py-4 sm:px-5">
              <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4">
                <EvoComposeAddMenu
                  disabled={addMenuDisabled}
                  createPending={mailboxGoogleCreateMut.isPending}
                  googleConnected={mailboxGoogleStatus.connected}
                  onGoogleDrive={() => {
                    if (!mailboxGoogleStatus.connected) {
                      toast({
                        title: 'Conecta Google Drive',
                        description: 'Abre Evo Drive y conecta tu cuenta.',
                        variant: 'destructive',
                      });
                      return;
                    }
                    setShowDrivePicker(true);
                  }}
                  onAttachLink={() => setShowLinkDialog(true)}
                  onCreateDoc={() => openMailboxGoogleCreate('doc')}
                  onCreateSlide={() => openMailboxGoogleCreate('slide')}
                  onCreateSheet={() => openMailboxGoogleCreate('sheet')}
                />
                <Button type="button" className="min-w-[120px]" disabled={composeSendDisabled} onClick={() => createDirectMut.mutate()}>
                  {createDirectMut.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Send className="mr-2 h-4 w-4" />
                      Enviar
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        ) : (institutionalMailbox === 'trash' || institutionalMailbox === 'starred') && !mailboxThreadId ? (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="shrink-0 border-b border-white/10 bg-white/[0.04] px-4 py-4 sm:px-5">
              <h2
                className="text-lg font-semibold tracking-tight text-[var(--text-primary,#E2E8F0)] border-l-[3px] pl-3 py-0.5"
                style={{ borderLeftColor: MAILBOX_VIOLET }}
              >
                {institutionalMailbox === 'trash' ? 'Papelera' : 'Destacados'}
              </h2>
              <p className="mt-2 text-[12px] text-white/55">
                {institutionalMailbox === 'trash'
                  ? 'Mensajes enviados a la papelera desde el menú contextual (clic derecho) en un mensaje del hilo.'
                  : 'Mensajes que marcaste como destacados. Siguen visibles en el hilo; aquí tienes el listado.'}
              </p>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto [scrollbar-gutter:stable] px-3 pb-3 pt-3 sm:px-4">
              {loadingFolder ? (
                <div className="flex justify-center py-16">
                  <Loader2 className="h-7 w-7 animate-spin text-white/40" />
                </div>
              ) : (folderData?.items ?? []).length === 0 ? (
                <p className="text-white/50 text-sm text-center py-16 px-4">
                  {institutionalMailbox === 'trash' ? 'La papelera está vacía.' : 'No hay mensajes destacados.'}
                </p>
              ) : (
                <ul className="flex flex-col gap-2.5">
                  {(folderData?.items ?? []).map((it) => (
                    <li key={it.messageId}>
                      <div
                        className="flex gap-2 items-stretch rounded-lg border border-white/[0.07] bg-white/[0.03] overflow-hidden"
                        style={{ borderLeftWidth: 4, borderLeftColor: MAILBOX_VIOLET }}
                      >
                        <button
                          type="button"
                          onClick={() => openThread(it.threadId, { fromTrash: institutionalMailbox === 'trash' })}
                          className="min-w-0 flex-1 text-left py-3.5 pl-4 pr-3 sm:pl-5 transition-colors hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]"
                        >
                          <p className="font-semibold text-[var(--text-primary,#E2E8F0)] line-clamp-1 text-[14px]">
                            {it.asunto}
                          </p>
                          <p className="text-[11px] text-white/45 mt-0.5">{it.senderName}</p>
                          <p className="mt-1.5 text-[13px] text-white/55 line-clamp-2 leading-snug">
                            {mailboxPreviewContent(it.preview)}
                          </p>
                          <p className="text-[10px] text-white/35 mt-1 tabular-nums">
                            {new Date(it.fecha).toLocaleString('es-CO', {
                              day: '2-digit',
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </p>
                        </button>
                        {institutionalMailbox === 'trash' ? (
                          <div className="shrink-0 flex items-center pr-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="border-white/25 text-white/90 h-8 text-[11px]"
                              disabled={flagMut.isPending}
                              onClick={(e) => {
                                e.stopPropagation();
                                flagMut.mutate({ messageId: it.messageId, trash: false });
                              }}
                            >
                              <RotateCcw className="w-3.5 h-3.5 mr-1" />
                              Restaurar
                            </Button>
                          </div>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ) : !mailboxThreadId ? (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="shrink-0 border-b border-white/10 bg-white/[0.04] px-4 py-4 sm:px-5 space-y-3">
              <div>
                <h2
                  className="text-lg font-semibold tracking-tight text-[var(--text-primary,#E2E8F0)] pl-3 py-0.5 border-l-[3px]"
                  style={{ borderLeftColor: MAILBOX_VIOLET }}
                >
                  Comunicados 1:1
                </h2>
                <p className="mt-2 text-[12px] text-white/55">
                  Cada asunto con un destinatario crea un hilo independiente. Para hablar de otro tema con la misma persona, redacta un nuevo comunicado.
                </p>
              </div>
              <Input
                type="text"
                placeholder="Buscar por asunto, destinatario o contenido…"
                value={threadSearch}
                onChange={(e) => setThreadSearch(e.target.value)}
                className="h-9 bg-white/[0.05] border-white/[0.1] text-[13px] text-white placeholder:text-white/35"
              />
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto [scrollbar-gutter:stable] px-3 pb-3 pt-3 sm:px-4">
              {loadingMailbox ? (
                <div className="flex justify-center py-16">
                  <Loader2 className="w-7 h-7 animate-spin text-white/40" />
                </div>
              ) : threads.length === 0 ? (
                <p className="text-white/50 text-sm text-center py-16 px-4">
                  {threadSearch.trim()
                    ? 'No se encontraron comunicados con ese criterio.'
                    : 'No hay comunicados. Usa «Redactar» en el panel izquierdo para iniciar un nuevo hilo.'}
                </p>
              ) : (
                <ul className="flex flex-col gap-2.5">
                  {threads.map((t) => (
                    <li key={t._id}>
                      <button
                        type="button"
                        onClick={() => openThread(t._id)}
                        className="w-full text-left rounded-lg border border-white/[0.07] bg-white/[0.03] py-3.5 pl-4 pr-4 sm:py-4 sm:pl-5 sm:pr-5 flex gap-3 items-start transition-colors hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0f172a]"
                        style={{ borderLeftWidth: 4, borderLeftColor: MAILBOX_VIOLET }}
                      >
                        <div className="min-w-0 flex-1 w-full">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <span className="font-semibold text-[var(--text-primary,#E2E8F0)] line-clamp-1 text-[14px] leading-snug">
                                {t.asunto}
                              </span>
                              {t.peerName ? (
                                <span className="text-[11px] text-white/50 mt-0.5 block">
                                  {t.peerName}{t.peerRole ? ` · ${t.peerRole}` : ''}
                                </span>
                              ) : null}
                            </div>
                            <div className="shrink-0 flex flex-col items-end gap-0.5">
                              {t.unreadCount ? (
                                <span className="min-w-[1.25rem] h-5 px-1 rounded-full bg-[hsl(var(--primary))] text-white text-[10px] font-bold tabular-nums flex items-center justify-center">
                                  {t.unreadCount > 99 ? '99+' : t.unreadCount}
                                </span>
                              ) : null}
                              {t.ultimoMensaje?.fecha ? (
                                <span className="text-[10px] tabular-nums text-white/40">
                                  {new Date(t.ultimoMensaje.fecha).toLocaleString('es-CO', {
                                    day: '2-digit',
                                    month: 'short',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </span>
                              ) : null}
                            </div>
                          </div>
                          {t.ultimoMensaje?.contenido ? (
                            <p className="mt-1.5 text-[13px] text-white/55 line-clamp-2 leading-snug">
                              {mailboxPreviewContent(t.ultimoMensaje.contenido)}
                            </p>
                          ) : null}
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ) : loadingThread ? (
          <div className="flex flex-1 items-center justify-center">
            <Loader2 className="h-7 w-7 animate-spin text-white/40" />
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="shrink-0 border-b border-white/10 bg-white/[0.04] px-4 py-4 sm:px-5">
              <div className="flex w-full flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1 border-l-[3px] pl-3" style={{ borderLeftColor: MAILBOX_VIOLET }}>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-white/50">Asunto</p>
                  <h3 className="mt-0.5 text-lg font-semibold text-[var(--text-primary,#E2E8F0)] leading-tight">
                    {threadDetail?.thread?.asunto ?? '…'}
                  </h3>
                  {threadRevealTrash ? (
                    <p className="text-[11px] text-amber-100/85 mt-2 leading-snug">
                      Vista ampliada: incluye mensajes que enviaste a la papelera. Clic derecho en un mensaje para restaurar o
                      destacar.
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2 shrink-0">
                  <Button
                    type="button"
                    variant="outline"
                    className="border-white/20 text-white/90 hover:bg-white/10"
                    onClick={() => {
                      setThreadRevealTrash(false);
                      setMailboxThreadId(null);
                      setReplyDialogOpen(false);
                      setReplyDraft('');
                    }}
                  >
                    Volver a hilos
                  </Button>
                  {canReplyInThread ? (
                    <Button
                      type="button"
                      className="bg-[#7c3aed] hover:bg-[#6d28d9] text-white"
                      onClick={() => {
                        setReplyDraft('');
                        setReplyDialogOpen((prev) => !prev);
                      }}
                    >
                      {replyDialogOpen ? 'Cancelar respuesta' : 'Redactar respuesta'}
                    </Button>
                  ) : null}
                </div>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-5">
              <div className="flex w-full flex-col gap-4">
                {(threadDetail?.messages ?? []).map((m) => (
                  <ContextMenu key={m._id}>
                    <ContextMenuTrigger asChild>
                      <div
                        className={`w-full rounded-lg border border-white/[0.08] bg-white/[0.035] pl-4 pr-4 py-3.5 sm:pl-5 sm:pr-5 sm:py-4 text-[13px] text-white/88 cursor-context-menu ${
                          m.viewerTrashed ? 'opacity-75 ring-1 ring-white/10' : ''
                        }`}
                        style={{ borderLeftWidth: 4, borderLeftColor: MAILBOX_VIOLET }}
                      >
                        <div className="flex items-baseline justify-between gap-2 border-b border-white/[0.06] pb-2">
                          <div className="flex items-center gap-2 min-w-0">
                            {m.starred ? (
                              <Star className="w-3.5 h-3.5 shrink-0 text-amber-400 fill-amber-400/90" aria-hidden />
                            ) : null}
                            <span className="text-[13px] font-medium text-white truncate">
                              {m.remitenteId?.nombre ?? '—'}
                            </span>
                          </div>
                          <span className="text-[10px] tabular-nums text-white/35 shrink-0">
                            {new Date(m.fecha).toLocaleString('es-CO', {
                              day: '2-digit',
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                        {m.viewerTrashed ? (
                          <p className="text-[10px] font-medium uppercase tracking-wide text-amber-200/90 mt-2">
                            En tu papelera
                          </p>
                        ) : null}
                        <InstMailboxMessageBody m={m} />
                      </div>
                    </ContextMenuTrigger>
                    <ContextMenuContent className="min-w-[200px]">
                      {m.viewerTrashed ? (
                        <ContextMenuItem
                          className="flex items-center gap-2"
                          onSelect={() => flagMut.mutate({ messageId: m._id, trash: false })}
                        >
                          <RotateCcw className="w-4 h-4 shrink-0" />
                          Restaurar mensaje
                        </ContextMenuItem>
                      ) : (
                        <ContextMenuItem
                          className="flex items-center gap-2"
                          onSelect={() => flagMut.mutate({ messageId: m._id, trash: true })}
                        >
                          <Trash2 className="w-4 h-4 shrink-0" />
                          Mover a papelera
                        </ContextMenuItem>
                      )}
                      <ContextMenuSeparator />
                      <ContextMenuItem
                        className="flex items-center gap-2"
                        onSelect={() => flagMut.mutate({ messageId: m._id, star: !m.starred })}
                      >
                        <Star className="w-4 h-4 shrink-0" />
                        {m.starred ? 'Quitar destacado' : 'Destacar mensaje'}
                      </ContextMenuItem>
                    </ContextMenuContent>
                  </ContextMenu>
                ))}
                {replyDialogOpen ? (
                  <div
                    className="w-full rounded-lg border border-[#7c3aed]/40 bg-white/[0.04] p-4 sm:p-5 flex flex-col gap-3"
                    style={{ borderLeftWidth: 4, borderLeftColor: MAILBOX_VIOLET }}
                  >
                    <p className="text-[11px] text-white/50 font-medium">
                      Re: {threadDetail?.thread?.asunto ?? '…'}
                    </p>
                    <Textarea
                      autoFocus
                      value={replyDraft}
                      onChange={(e) => setReplyDraft(e.target.value)}
                      placeholder="Escribe tu respuesta…"
                      className="min-h-[140px] w-full resize-y border-white/[0.12] bg-white/[0.05] text-[13px] text-[var(--text-primary,#E2E8F0)] placeholder:text-white/35"
                    />
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <EvoComposeAddMenu
                        disabled={addMenuDisabled}
                        createPending={mailboxGoogleCreateMut.isPending}
                        googleConnected={mailboxGoogleStatus.connected}
                        onGoogleDrive={() => {
                          if (!mailboxGoogleStatus.connected) {
                            toast({
                              title: 'Conecta Google Drive',
                              description: 'Abre Evo Drive y conecta tu cuenta.',
                              variant: 'destructive',
                            });
                            return;
                          }
                          setShowDrivePicker(true);
                        }}
                        onAttachLink={() => setShowLinkDialog(true)}
                        onCreateDoc={() => openMailboxGoogleCreate('doc')}
                        onCreateSlide={() => openMailboxGoogleCreate('slide')}
                        onCreateSheet={() => openMailboxGoogleCreate('sheet')}
                      />
                      <Button
                        type="button"
                        disabled={!replyDraft.trim() || sendMut.isPending || !mailboxThreadId}
                        className="bg-[#7c3aed] hover:bg-[#6d28d9]"
                        onClick={() => sendMut.mutate({ contenido: replyDraft.trim() })}
                      >
                        {sendMut.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <Send className="h-4 w-4 mr-2" />
                            Enviar
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        )}
      </div>
      <Dialog open={showDrivePicker} onOpenChange={setShowDrivePicker}>
        <DialogContent className="bg-[var(--mid-dark,#0f172a)] border-white/10 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle>Mi carpeta (Evo Drive)</DialogTitle>
          </DialogHeader>
          <DirectorDrivePicker onSelect={applyDriveFile} />
        </DialogContent>
      </Dialog>
      <Dialog open={showLinkDialog} onOpenChange={setShowLinkDialog}>
        <DialogContent className="bg-[var(--mid-dark,#0f172a)] border-white/10 text-white max-w-md">
          <DialogHeader>
            <DialogTitle>Adjuntar enlace</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Input
              placeholder="Título"
              value={linkTitle}
              onChange={(e) => setLinkTitle(e.target.value)}
              className="bg-white/5 border-white/15 text-white"
            />
            <Input
              placeholder="https://…"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              className="bg-white/5 border-white/15 text-white"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" className="border-white/20" onClick={() => setShowLinkDialog(false)}>
              Cerrar
            </Button>
            <Button disabled={!linkUrl.trim()} onClick={applyLink}>
              Adjuntar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={mailboxGCreateOpen && !!mailboxGCreateKind}
        onOpenChange={(o) => {
          if (!o) {
            setMailboxGCreateOpen(false);
            setMailboxGCreateNombre('');
            setMailboxGCreateKind(null);
          }
        }}
      >
        <DialogContent className="bg-[#0f172a] border border-white/10 max-w-[380px] rounded-2xl p-6 shadow-xl overflow-hidden text-white">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-[11px] flex items-center justify-center shrink-0 ${
                  mailboxGCreateKind === 'doc'
                    ? 'bg-[#1a56d6]'
                    : mailboxGCreateKind === 'slide'
                      ? 'bg-[#d97706]'
                      : 'bg-[#16a34a]'
                }`}
              >
                {mailboxGCreateKind === 'doc' && <FileText className="w-5 h-5 text-white" />}
                {mailboxGCreateKind === 'slide' && <Presentation className="w-5 h-5 text-white" />}
                {mailboxGCreateKind === 'sheet' && <FileSpreadsheet className="w-5 h-5 text-white" />}
              </div>
              <div>
                <span className="text-base font-semibold text-white block">
                  {mailboxGCreateKind === 'doc' && 'Nuevo documento'}
                  {mailboxGCreateKind === 'slide' && 'Nueva presentación'}
                  {mailboxGCreateKind === 'sheet' && 'Nueva hoja de cálculo'}
                </span>
                <span className="text-xs text-white/60 mt-0.5 block">
                  Se creará en tu Google Drive y se adjuntará como tarjeta de archivo en el hilo (no como texto con
                  enlace).
                </span>
              </div>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label className="text-xs font-medium text-white/60">Nombre del archivo</Label>
              <Input
                value={mailboxGCreateNombre}
                onChange={(e) => setMailboxGCreateNombre(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && mailboxGCreateKind) {
                    e.preventDefault();
                    if (!mailboxGCreateNombre.trim() || mailboxGoogleCreateMut.isPending) return;
                    mailboxGoogleCreateMut.mutate({ kind: mailboxGCreateKind, nombre: mailboxGCreateNombre });
                  }
                }}
                placeholder="Ej: Informe marzo"
                className="bg-white/5 border border-white/10 rounded-md py-2.5 px-3 text-sm text-white placeholder:text-white/50"
                autoFocus
              />
            </div>
          </div>
          <DialogFooter className="gap-2 mt-6 grid grid-cols-[1fr_2fr]">
            <Button
              variant="outline"
              type="button"
              onClick={() => {
                setMailboxGCreateOpen(false);
                setMailboxGCreateNombre('');
                setMailboxGCreateKind(null);
              }}
              className="border border-white/10 bg-transparent text-[13px] font-medium text-white/60 hover:bg-white/10"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={!mailboxGCreateNombre.trim() || !mailboxGCreateKind || mailboxGoogleCreateMut.isPending}
              className="bg-[#7c3aed] hover:bg-[#6d28d9] text-white text-[13px] font-medium"
              onClick={() => {
                if (!mailboxGCreateKind) return;
                mailboxGoogleCreateMut.mutate({ kind: mailboxGCreateKind, nombre: mailboxGCreateNombre });
              }}
            >
              {mailboxGoogleCreateMut.isPending ? 'Creando…' : 'Crear'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DirectorDrivePicker({ onSelect }: { onSelect: (meta: Record<string, unknown>) => void }) {
  const { data: files = [], isLoading } = useQuery({
    queryKey: ['evo-drive', 'my-folder-mailbox'],
    queryFn: async () => {
      const res = await fetch('/api/evo-drive/my-folder', { headers: authHeaders() });
      if (!res.ok) return [];
      return (await res.json()) as { id: string; nombre: string; url?: string; googleWebViewLink?: string }[];
    },
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-white/50" />
      </div>
    );
  }
  if (!files.length) {
    return <p className="text-white/50 text-sm py-4">Tu carpeta personal está vacía.</p>;
  }
  return (
    <ul className="max-h-64 overflow-y-auto space-y-2">
      {files.map((f) => (
        <li key={f.id}>
          <button
            type="button"
            className="w-full text-left rounded-lg px-3 py-2 bg-white/[0.06] hover:bg-white/10 text-sm text-white"
            onClick={() =>
              onSelect({
                fileId: f.id,
                name: f.nombre,
                url: f.url || f.googleWebViewLink || null,
              })
            }
          >
            {f.nombre}
          </button>
        </li>
      ))}
    </ul>
  );
}

/** Pantalla completa tipo «Redactar»: publicar comunicado institucional con Evo Drive real (create-personal). */
function InstitutionalPublishComposePanel() {
  const { toast } = useToast();
  const { user } = useAuth();
  const {
    instConfig,
    monthYear,
    pubTitle,
    setPubTitle,
    pubBody,
    setPubBody,
    pubCategory,
    setPubCategory,
    pubEventoFecha,
    setPubEventoFecha,
    pubAudience,
    setPubAudience,
    pubCircularAttachments,
    setPubCircularAttachments,
    pubGeneralAttachments,
    setPubGeneralAttachments,
    setPreviewOpen,
    publishMut,
    setPublishComposeMode,
  } = useInstitutoCtx();

  const [showDrivePicker, setShowDrivePicker] = useState(false);
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkTitle, setLinkTitle] = useState('');
  const [composeCalDate, setComposeCalDate] = useState(() => new Date());
  const [pubGCreateOpen, setPubGCreateOpen] = useState(false);
  const [pubGCreateKind, setPubGCreateKind] = useState<'doc' | 'sheet' | 'slide' | null>(null);
  const [pubGCreateNombre, setPubGCreateNombre] = useState('');

  const { data: pubGoogleStatus = { connected: false } } = useQuery<{ connected: boolean }>({
    queryKey: ['evo-drive', 'google-status'],
    queryFn: () => apiRequest<{ connected: boolean }>('GET', '/api/evo-drive/google/status'),
    staleTime: 60_000,
  });

  const composeInstId = user?.colegioId;
  const composeY = composeCalDate.getFullYear();
  const composeDesde = `${composeY}-01-01`;
  const composeHasta = `${composeY}-12-31`;

  const { data: composeEvents = [] } = useQuery({
    queryKey: ['institucional-events-year', composeInstId, composeY],
    queryFn: async (): Promise<ApiInstitucionalEventRow[]> => {
      const res = await fetch(
        `/api/events?desde=${encodeURIComponent(composeDesde)}&hasta=${encodeURIComponent(composeHasta)}`,
        { headers: authHeaders() }
      );
      if (!res.ok) throw new Error('events');
      return await res.json();
    },
    enabled: !!composeInstId && pubCategory === 'evento',
  });

  const composeAssignmentsBase = useMemo(() => mapApiEventsToCalendarAssignments(composeEvents), [composeEvents]);

  const previewEventAssignment = useMemo((): CalendarAssignment | null => {
    if (pubCategory !== 'evento' || !isValidPubEventoDate(pubEventoFecha)) return null;
    const t = pubEventoFecha.trim();
    const dateStr = t.length >= 10 ? t.slice(0, 10) : t;
    return {
      _id: '__preview_evt__',
      titulo: pubTitle.trim() || 'Vista previa del evento',
      descripcion: pubBody.trim(),
      curso: 'Institucional',
      fechaEntrega: dateStr,
      profesorNombre: '',
      groupId: '__institucional_preview__',
      requiresSubmission: false,
      type: 'reminder',
    };
  }, [pubCategory, pubEventoFecha, pubTitle, pubBody]);

  const composeCalendarAssignments = useMemo(() => {
    const rows = [...composeAssignmentsBase];
    if (previewEventAssignment) rows.push(previewEventAssignment);
    return rows;
  }, [composeAssignmentsBase, previewEventAssignment]);

  const composeEventsThisMonth = useMemo(() => {
    const ym = composeCalDate.getFullYear();
    const mm = composeCalDate.getMonth();
    let n = 0;
    for (const a of composeCalendarAssignments) {
      const p = getAssignmentCalendarLocalParts(a.fechaEntrega);
      if (p && p.year === ym && p.monthIndex === mm) n++;
    }
    return n;
  }, [composeCalendarAssignments, composeCalDate]);

  const pubGoogleCreateMut = useMutation({
    mutationFn: async (vars: { kind: 'doc' | 'sheet' | 'slide'; nombre: string }) => {
      return googleCreatePersonalFile(vars.kind, vars.nombre.trim() || 'Sin título');
    },
    onSuccess: (data) => {
      const url = data.googleWebViewLink;
      if (!url) return;
      const name = (data.nombre ?? 'Documento').trim() || 'Documento';
      if (pubCategory === 'circular') {
        setPubCircularAttachments((prev) => [...prev, { name, url, fileId: undefined }]);
      } else {
        setPubGeneralAttachments((prev) => [...prev, { name, url, fileId: undefined }]);
        toast({ title: 'Archivo agregado', description: 'Se publicará como adjunto del comunicado.' });
      }
      setPubGCreateOpen(false);
      setPubGCreateNombre('');
      setPubGCreateKind(null);
    },
    onError: (e: Error) => {
      toast({
        title: 'Google Drive',
        description:
          e.message || 'No se pudo crear el archivo. Conecta tu cuenta en Evo Drive si aún no lo has hecho.',
        variant: 'destructive',
      });
    },
  });

  const openPubGoogleCreate = (kind: 'doc' | 'sheet' | 'slide') => {
    if (!pubGoogleStatus.connected) {
      toast({
        title: 'Conecta Google Drive',
        description: 'Abre Evo Drive y conecta tu cuenta para crear documentos.',
        variant: 'destructive',
      });
      return;
    }
    setPubGCreateKind(kind);
    setPubGCreateNombre('');
    setPubGCreateOpen(true);
  };

  const addMenuDisabled = publishMut.isPending || pubGoogleCreateMut.isPending;

  const applyDriveFile = (meta: Record<string, unknown>) => {
    const name = String(meta.name ?? 'Archivo');
    const u = typeof meta.url === 'string' ? meta.url : '';
    const fileId = typeof meta.fileId === 'string' ? meta.fileId : undefined;
    if (pubCategory === 'circular') {
      if (!u && !fileId) {
        setShowDrivePicker(false);
        return;
      }
      setPubCircularAttachments((prev) => [...prev, { name, url: u || null, fileId }]);
    } else {
      if (!u && !fileId) {
        setShowDrivePicker(false);
        return;
      }
      setPubGeneralAttachments((prev) => [...prev, { name, url: u || null, fileId }]);
      toast({ title: 'Archivo agregado', description: 'Se publicará como adjunto del comunicado.' });
    }
    setShowDrivePicker(false);
  };

  const applyLink = () => {
    const u = linkUrl.trim();
    if (!u) return;
    const t = linkTitle.trim() || u;
    if (pubCategory === 'circular') {
      setPubCircularAttachments((prev) => [...prev, { name: t, url: u, fileId: undefined }]);
    } else {
      setPubGeneralAttachments((prev) => [...prev, { name: t, url: u, fileId: undefined }]);
      toast({ title: 'Enlace agregado', description: 'Se publicará como adjunto del comunicado.' });
    }
    setShowLinkDialog(false);
    setLinkUrl('');
    setLinkTitle('');
  };

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl panel-grades">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="shrink-0 border-b border-white/10 bg-white/[0.04] px-4 py-4 sm:px-5">
          <h2
            className="text-lg font-semibold tracking-tight text-[var(--text-primary,#E2E8F0)] border-l-[3px] pl-3 py-0.5"
            style={{ borderLeftColor: MAILBOX_VIOLET }}
          >
            Publicar comunicado institucional
          </h2>
            <p className="mt-1 text-[12px] text-white/55">
            Comunicado oficial para la comunidad ({instConfig?.nombre ?? '…'} · {monthYear}). Si la categoría es
            Circular, adjunta el archivo oficial: se guardará automáticamente en la carpeta Circulares del Evo Drive de
            cada acudiente destinatario.
          </p>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-5">
          <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
            <div className="space-y-1.5">
              <label htmlFor="inst-pub-title" className="text-[11px] font-semibold uppercase tracking-wide text-white/45">
                Título
              </label>
              <Input
                id="inst-pub-title"
                value={pubTitle}
                onChange={(e) => setPubTitle(e.target.value)}
                placeholder="Título del comunicado"
                className="h-10 border-white/[0.12] bg-white/[0.05] text-[13px] text-white placeholder:text-white/35"
              />
            </div>
            <div className="flex min-h-[min(380px,48vh)] flex-1 flex-col space-y-1.5">
              <label htmlFor="inst-pub-body" className="text-[11px] font-semibold uppercase tracking-wide text-white/45">
                Mensaje
              </label>
              <Textarea
                id="inst-pub-body"
                value={pubBody}
                onChange={(e) => setPubBody(e.target.value)}
                placeholder="Escribe el cuerpo del comunicado…"
                className="min-h-[240px] flex-1 resize-y border-white/[0.12] bg-white/[0.05] text-[13px] leading-relaxed text-white placeholder:text-white/35"
              />
            </div>
            {pubCategory !== 'circular' && pubGeneralAttachments.length > 0 ? (
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 space-y-2">
                <p className="text-[11px] uppercase tracking-wide text-white/45">Adjuntos (se publican con el comunicado)</p>
                <ul className="space-y-2 max-h-40 overflow-y-auto">
                  {pubGeneralAttachments.map((a, idx) => (
                    <li
                      key={`${a.url ?? ''}-${a.fileId ?? ''}-${idx}`}
                      className="flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-white/[0.05] px-3 py-2 text-[13px]"
                    >
                      <span className="text-white truncate min-w-0" title={a.name}>
                        {a.name}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 shrink-0 text-white/60 hover:text-white"
                        onClick={() => setPubGeneralAttachments((prev) => prev.filter((_, i) => i !== idx))}
                      >
                        Quitar
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label htmlFor="inst-pub-cat" className="text-[11px] font-semibold uppercase tracking-wide text-white/45">
                  Categoría
                </label>
                <select
                  id="inst-pub-cat"
                  value={pubCategory}
                  onChange={(e) => {
                    const v = e.target.value;
                    setPubCategory(v);
                    if (v !== 'evento') setPubEventoFecha('');
                  }}
                  className="w-full h-10 rounded-md border border-white/[0.12] bg-white/[0.05] px-3 text-[13px] text-white"
                >
                  <option value="general">Avisos generales</option>
                  <option value="circular">Circular</option>
                  <option value="evento">Evento</option>
                  <option value="calendario">Calendario escolar</option>
                  <option value="aviso">Aviso</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label htmlFor="inst-pub-aud" className="text-[11px] font-semibold uppercase tracking-wide text-white/45">
                  Audiencia
                </label>
                <select
                  id="inst-pub-aud"
                  value={pubAudience}
                  onChange={(e) =>
                    setPubAudience(e.target.value as 'all' | 'parents' | 'teachers' | 'staff')
                  }
                  className="w-full h-10 rounded-md border border-white/[0.12] bg-white/[0.05] px-3 text-[13px] text-white"
                >
                  <option value="all">Todos</option>
                  <option value="parents">Solo padres</option>
                  <option value="teachers">Solo profesores</option>
                  <option value="staff">Personal (staff)</option>
                </select>
              </div>
            </div>
            {pubCategory === 'circular' ? (
              <div className="rounded-xl border border-[#00c8ff]/30 bg-[#00c8ff]/10 p-4 space-y-3">
                <p className="text-[12px] text-white/85 font-medium">Circular: archivo para Evo Drive de los padres</p>
                <p className="text-[12px] text-white/65">
                  Debes adjuntar al menos un archivo (desde Evo Drive / Google o un enlace). No se publicará la circular
                  sin adjunto. El mensaje puede describir la circular en el cuerpo del comunicado.
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <EvoComposeAddMenu
                    disabled={addMenuDisabled}
                    createPending={pubGoogleCreateMut.isPending}
                    googleConnected={pubGoogleStatus.connected}
                    onGoogleDrive={() => {
                      if (!pubGoogleStatus.connected) {
                        toast({
                          title: 'Conecta Google Drive',
                          description: 'Abre Evo Drive y conecta tu cuenta.',
                          variant: 'destructive',
                        });
                        return;
                      }
                      setShowDrivePicker(true);
                    }}
                    onAttachLink={() => setShowLinkDialog(true)}
                    onCreateDoc={() => openPubGoogleCreate('doc')}
                    onCreateSlide={() => openPubGoogleCreate('slide')}
                    onCreateSheet={() => openPubGoogleCreate('sheet')}
                  />
                </div>
                {pubCircularAttachments.length === 0 ? (
                  <p className="text-[12px] text-amber-200/90">Aún no hay archivo adjunto para esta circular.</p>
                ) : (
                  <ul className="space-y-2 max-h-48 overflow-y-auto">
                    {pubCircularAttachments.map((a, idx) => (
                      <li
                        key={`${a.url ?? ''}-${a.fileId ?? ''}-${idx}`}
                        className="flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-white/[0.05] px-3 py-2 text-[13px]"
                      >
                        <span className="text-white truncate min-w-0" title={a.name}>
                          {a.name}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 shrink-0 text-white/60 hover:text-white"
                          onClick={() =>
                            setPubCircularAttachments((prev) => prev.filter((_, i) => i !== idx))
                          }
                        >
                          Quitar
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : null}
            {pubCategory === 'evento' ? (
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
                <p className="text-[12px] text-white/70">
                  Se publicará el comunicado y aparecerá en el calendario escolar de toda la comunidad (la misma fuente
                  que el calendario del directivo).
                </p>
                <div className="space-y-1.5 max-w-xs">
                  <label
                    htmlFor="inst-pub-event-date"
                    className="text-[11px] font-semibold uppercase tracking-wide text-white/45"
                  >
                    Fecha del evento
                  </label>
                  <input
                    id="inst-pub-event-date"
                    type="date"
                    value={pubEventoFecha}
                    onChange={(e) => setPubEventoFecha(e.target.value)}
                    className="w-full h-10 rounded-md border border-white/[0.12] bg-white/[0.05] px-3 text-[13px] text-white"
                  />
                </div>
                <div className="max-h-[min(340px,42vh)] overflow-y-auto overflow-x-hidden rounded-lg border border-white/[0.08] p-2">
                  <Calendar
                    assignments={composeCalendarAssignments}
                    variant="teacher"
                    currentDate={composeCalDate}
                    onCurrentDateChange={setComposeCalDate}
                    summaryLabels={CALENDAR_SUMMARY_LABELS_INSTITUTIONAL_EVENTS}
                    monthLegendOverride={`${composeEventsThisMonth} ${composeEventsThisMonth === 1 ? 'evento' : 'eventos'} en este mes (incluye vista previa)`}
                  />
                </div>
              </div>
            ) : null}
          </div>
        </div>
        <div className="shrink-0 border-t border-white/10 bg-white/[0.03] px-4 py-4 sm:px-5">
          <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              {pubCategory !== 'circular' ? (
                <EvoComposeAddMenu
                  disabled={addMenuDisabled}
                  createPending={pubGoogleCreateMut.isPending}
                  googleConnected={pubGoogleStatus.connected}
                  onGoogleDrive={() => {
                    if (!pubGoogleStatus.connected) {
                      toast({
                        title: 'Conecta Google Drive',
                        description: 'Abre Evo Drive y conecta tu cuenta.',
                        variant: 'destructive',
                      });
                      return;
                    }
                    setShowDrivePicker(true);
                  }}
                  onAttachLink={() => setShowLinkDialog(true)}
                  onCreateDoc={() => openPubGoogleCreate('doc')}
                  onCreateSlide={() => openPubGoogleCreate('slide')}
                  onCreateSheet={() => openPubGoogleCreate('sheet')}
                />
              ) : null}
              <Button
                type="button"
                variant="outline"
                className="border-white/20 text-white/90 hover:bg-white/10"
                disabled={publishMut.isPending}
                onClick={() => setPublishComposeMode(false)}
              >
                Cancelar
              </Button>
            </div>
            <Button
              type="button"
              className="min-w-[132px] bg-[#7c3aed] hover:bg-[#6d28d9]"
              disabled={
                !pubTitle.trim() ||
                publishMut.isPending ||
                (pubCategory === 'evento' && !isValidPubEventoDate(pubEventoFecha)) ||
                (pubCategory === 'circular' && pubCircularAttachments.length === 0)
              }
              onClick={() => setPreviewOpen(true)}
            >
              Vista previa
            </Button>
          </div>
        </div>
      </div>
      <Dialog open={showDrivePicker} onOpenChange={setShowDrivePicker}>
        <DialogContent className="bg-[var(--mid-dark,#0f172a)] border-white/10 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle>Mi carpeta (Evo Drive)</DialogTitle>
          </DialogHeader>
          <DirectorDrivePicker onSelect={applyDriveFile} />
        </DialogContent>
      </Dialog>
      <Dialog open={showLinkDialog} onOpenChange={setShowLinkDialog}>
        <DialogContent className="bg-[var(--mid-dark,#0f172a)] border-white/10 text-white max-w-md">
          <DialogHeader>
            <DialogTitle>Adjuntar enlace</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Input
              placeholder="Título"
              value={linkTitle}
              onChange={(e) => setLinkTitle(e.target.value)}
              className="bg-white/5 border-white/15 text-white"
            />
            <Input
              placeholder="https://…"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              className="bg-white/5 border-white/15 text-white"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" className="border-white/20" onClick={() => setShowLinkDialog(false)}>
              Cerrar
            </Button>
            <Button disabled={!linkUrl.trim()} onClick={applyLink}>
              Adjuntar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={pubGCreateOpen && !!pubGCreateKind}
        onOpenChange={(o) => {
          if (!o) {
            setPubGCreateOpen(false);
            setPubGCreateNombre('');
            setPubGCreateKind(null);
          }
        }}
      >
        <DialogContent className="bg-[#0f172a] border border-white/10 max-w-[380px] rounded-2xl p-6 shadow-xl overflow-hidden text-white">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-[11px] flex items-center justify-center shrink-0 ${
                  pubGCreateKind === 'doc'
                    ? 'bg-[#1a56d6]'
                    : pubGCreateKind === 'slide'
                      ? 'bg-[#d97706]'
                      : 'bg-[#16a34a]'
                }`}
              >
                {pubGCreateKind === 'doc' && <FileText className="w-5 h-5 text-white" />}
                {pubGCreateKind === 'slide' && <Presentation className="w-5 h-5 text-white" />}
                {pubGCreateKind === 'sheet' && <FileSpreadsheet className="w-5 h-5 text-white" />}
              </div>
              <div>
                <span className="text-base font-semibold text-white block">
                  {pubGCreateKind === 'doc' && 'Nuevo documento'}
                  {pubGCreateKind === 'slide' && 'Nueva presentación'}
                  {pubGCreateKind === 'sheet' && 'Nueva hoja de cálculo'}
                </span>
                <span className="text-xs text-white/60 mt-0.5 block">
                  Se creará en Google Drive y quedará como adjunto oficial del comunicado.
                </span>
              </div>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label className="text-xs font-medium text-white/60">Nombre del archivo</Label>
              <Input
                value={pubGCreateNombre}
                onChange={(e) => setPubGCreateNombre(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && pubGCreateKind) {
                    e.preventDefault();
                    if (!pubGCreateNombre.trim() || pubGoogleCreateMut.isPending) return;
                    pubGoogleCreateMut.mutate({ kind: pubGCreateKind, nombre: pubGCreateNombre });
                  }
                }}
                placeholder="Ej: Circular marzo"
                className="bg-white/5 border border-white/10 rounded-md py-2.5 px-3 text-sm text-white placeholder:text-white/50"
                autoFocus
              />
            </div>
          </div>
          <DialogFooter className="gap-2 mt-6 grid grid-cols-[1fr_2fr]">
            <Button
              variant="outline"
              type="button"
              onClick={() => {
                setPubGCreateOpen(false);
                setPubGCreateNombre('');
                setPubGCreateKind(null);
              }}
              className="border border-white/10 bg-transparent text-[13px] font-medium text-white/60 hover:bg-white/10"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={!pubGCreateNombre.trim() || !pubGCreateKind || pubGoogleCreateMut.isPending}
              className="bg-[#7c3aed] hover:bg-[#6d28d9] text-white text-[13px] font-medium"
              onClick={() => {
                if (!pubGCreateKind) return;
                pubGoogleCreateMut.mutate({ kind: pubGCreateKind, nombre: pubGCreateNombre });
              }}
            >
              {pubGoogleCreateMut.isPending ? 'Creando…' : 'Crear'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function InstitutionalCommunityCalendarPanel() {
  const { user } = useAuth();
  const { instConfig, monthYear, openComunicadoInEventosFeed } = useInstitutoCtx();
  const { toast } = useToast();
  const [calendarViewDate, setCalendarViewDate] = useState(() => new Date());
  const instId = user?.colegioId;
  const eventoEscolarSwatch = useMemo(
    () => getGroupSubjectColor({ fallbackId: '__institucional__' }),
    []
  );
  const y = calendarViewDate.getFullYear();
  const desde = useMemo(() => `${y}-01-01`, [y]);
  const hasta = useMemo(() => `${y}-12-31`, [y]);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['institucional-events-year', instId, y],
    queryFn: async (): Promise<ApiInstitucionalEventRow[]> => {
      const res = await fetch(
        `/api/events?desde=${encodeURIComponent(desde)}&hasta=${encodeURIComponent(hasta)}`,
        { headers: authHeaders() }
      );
      if (!res.ok) throw new Error('events');
      return await res.json();
    },
    enabled: !!instId,
  });

  const assignments = useMemo(() => mapApiEventsToCalendarAssignments(rows), [rows]);

  const eventsThisMonth = useMemo(() => {
    const ym = calendarViewDate.getFullYear();
    const mm = calendarViewDate.getMonth();
    let n = 0;
    for (const a of assignments) {
      const p = getAssignmentCalendarLocalParts(a.fechaEntrega);
      if (p && p.year === ym && p.monthIndex === mm) n++;
    }
    return n;
  }, [assignments, calendarViewDate]);

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-white/10 bg-white/[0.04] backdrop-blur-md">
      <div className="shrink-0 p-4 md:p-5 border-b border-white/[0.06]">
        <h2 className="text-lg md:text-xl font-bold text-white font-['Poppins']">
          Calendario escolar · {instConfig?.nombre ?? '…'} · {monthYear}
        </h2>
        <p className="text-white/55 text-xs mt-1">
          Eventos institucionales para toda la comunidad (misma vista que el dashboard del directivo).
        </p>
      </div>
      <div
        className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4 md:p-5 [scrollbar-gutter:stable]"
        style={{
          scrollbarWidth: 'thin',
          scrollbarColor: 'rgba(124,58,237,0.45) rgba(255,255,255,0.06)',
        }}
      >
        {isLoading ? (
          <div className="flex justify-center py-12 text-white/50">
            <Loader2 className="w-7 h-7 animate-spin" />
          </div>
        ) : (
          <div className="w-full max-w-none mx-auto flex flex-col min-h-[min(60dvh,44rem)]">
            <Calendar
              assignments={assignments}
              variant="teacher"
              currentDate={calendarViewDate}
              onCurrentDateChange={setCalendarViewDate}
              largeDayCells
              onDayClick={(a) => {
                const cid = a.sourceAnnouncementId?.trim();
                if (cid) {
                  openComunicadoInEventosFeed(cid);
                } else {
                  toast({
                    title: 'Sin comunicado vinculado',
                    description:
                      'Este evento no está enlazado a un comunicado en Eventos. Los creados desde «Publicar» como evento sí abren su aviso.',
                  });
                }
              }}
              summaryLabels={CALENDAR_SUMMARY_LABELS_INSTITUTIONAL_EVENTS}
              monthLegendOverride={`${eventsThisMonth} ${eventsThisMonth === 1 ? 'evento' : 'eventos'} programados este mes`}
            />
            <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-white/60 border-t border-white/[0.06] pt-4">
              <span
                className="w-4 h-4 rounded-md shrink-0 border border-white/15"
                style={{ background: eventoEscolarSwatch }}
                aria-hidden
              />
              <span>
                El relleno de este color en el calendario indica un{' '}
                <span className="text-white/80 font-medium">evento escolar</span> programado.
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function InstitutoComunicadosFeedPanel() {
  const { institutionalMailbox, publishComposeMode, activeCat } = useInstitutoCtx();
  if (institutionalMailbox !== 'feed') {
    return <DirectorMailboxPanel />;
  }
  if (publishComposeMode) {
    return <InstitutionalPublishComposePanel />;
  }
  if (activeCat === 'calendario') {
    return <InstitutionalCommunityCalendarPanel />;
  }
  const {
    instConfig,
    list,
    isLoading,
    monthYear,
    markRead,
    cancelMut,
    canCorrect,
    setCorr,
    setCorrTitle,
    setCorrBody,
    openReads,
    pendingComunicadoFocusId,
    setPendingComunicadoFocusId,
  } = useInstitutoCtx();
  const { toast } = useToast();

  useEffect(() => {
    const id = pendingComunicadoFocusId;
    if (!id || isLoading) return;
    const found = list.some((c) => c.id === id);
    const t = window.setTimeout(() => {
      if (found) {
        const el = document.getElementById(`instit-comunicado-${id}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          el.classList.add(
            'ring-2',
            'ring-[hsl(var(--primary))]',
            'ring-offset-2',
            'ring-offset-[var(--background,#07090f)]'
          );
          window.setTimeout(() => {
            el.classList.remove(
              'ring-2',
              'ring-[hsl(var(--primary))]',
              'ring-offset-2',
              'ring-offset-[var(--background,#07090f)]'
            );
          }, 2200);
        }
      } else {
        toast({
          title: 'Comunicado no visible',
          description: 'Este aviso no aparece en la lista de Eventos (puede estar en otra categoría o ya no existir).',
          variant: 'destructive',
        });
      }
      setPendingComunicadoFocusId(null);
    }, 100);
    return () => window.clearTimeout(t);
  }, [pendingComunicadoFocusId, isLoading, list, setPendingComunicadoFocusId, toast]);

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-white/10 bg-white/[0.04] backdrop-blur-md">
      <div className="shrink-0 p-4 md:p-5 border-b border-white/[0.06]">
        <div className="flex items-start gap-3">
          <Building2 className="w-7 h-7 text-[#7c3aed] shrink-0 mt-0.5" />
          <div className="min-w-0">
            <h2 className="text-lg md:text-xl font-bold text-white">
              Comunicados Institucionales · {instConfig?.nombre ?? '…'} · {monthYear}
            </h2>
            <p className="text-white/55 text-xs mt-1">Circulares, eventos y avisos oficiales de la institución</p>
          </div>
        </div>
      </div>
      <div
        className="min-h-0 flex-1 overflow-y-auto p-4 md:p-5 [scrollbar-gutter:stable]"
        style={{
          scrollbarWidth: 'thin',
          scrollbarColor: 'rgba(124,58,237,0.45) rgba(255,255,255,0.06)',
        }}
      >
        {isLoading ? (
          <div className="flex justify-center py-12 text-white/50">
            <Loader2 className="w-7 h-7 animate-spin" />
          </div>
        ) : null}
        {!isLoading && list.length === 0 ? (
          <p className="text-white/50 text-center py-12 text-sm">No hay comunicados en esta categoría</p>
        ) : null}
        <div className="space-y-3">
          {!isLoading &&
            list.map((c) => (
              <article
                key={c.id}
                id={`instit-comunicado-${c.id}`}
                className="rounded-xl border border-white/10 bg-white/[0.03] p-3 md:p-4 scroll-mt-24"
                onClick={() => markRead(c.id)}
                role="presentation"
              >
                {c.status === 'pending' && c.scheduled_send_at && (
                  <div className="mb-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-100 flex flex-wrap items-center justify-between gap-2">
                    <span>Programado</span>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="border-amber-500/50 text-amber-100 h-7 text-[11px]"
                      disabled={cancelMut.isPending}
                      onClick={(e) => {
                        e.stopPropagation();
                        cancelMut.mutate(c.id);
                      }}
                    >
                      Cancelar envío
                    </Button>
                  </div>
                )}
                <div className="flex gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#3B82F6] to-[#1E40AF] flex items-center justify-center text-white text-xs font-bold shrink-0">
                    {initials(c.author_name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-white font-semibold text-sm">{c.author_name ?? 'Autor'}</span>
                      <span className="text-white/45 text-[11px]">
                        {roleLabel(c.author_role)} · {formatRelative(c.created_at)}
                      </span>
                      {c.corrected_at ? (
                        <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-100 border border-amber-500/35">
                          Corregido
                        </span>
                      ) : null}
                      {c.correction_of ? (
                        <span className="text-[10px] px-2 py-0.5 rounded bg-violet-500/25 text-violet-200">
                          Corrección
                        </span>
                      ) : null}
                    </div>
                    <h3 className="text-white font-bold text-base mt-2">{c.title}</h3>
                    {c.body ? <p className="text-white/80 text-sm mt-2 whitespace-pre-wrap">{c.body}</p> : null}
                    <footer className="mt-3 flex flex-wrap gap-2 items-center text-[11px] text-white/50">
                      <Megaphone className="w-3 h-3 shrink-0" />
                      <span>Enviado a: {audienceLabel(c.audience)}</span>
                      <span className="text-white/35">·</span>
                      <span>
                        Lecturas {c.reads_count}/{c.total_recipients}
                      </span>
                      <div className="w-full sm:w-auto sm:ml-auto flex flex-wrap gap-2">
                        {canCorrect(c) && (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="border-violet-500/40 text-violet-200 h-8 text-[11px]"
                            onClick={(e) => {
                              e.stopPropagation();
                              setCorr(c);
                              setCorrTitle(c.title);
                              setCorrBody(c.body || '');
                            }}
                          >
                            <Pencil className="w-3 h-3 mr-1" /> Corrección
                          </Button>
                        )}
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="border-white/20 text-white/80 h-8 text-[11px]"
                          onClick={(e) => {
                            e.stopPropagation();
                            openReads(c.id);
                          }}
                        >
                          <Eye className="w-3 h-3 mr-1" /> Ver lecturas
                        </Button>
                      </div>
                    </footer>
                  </div>
                </div>
              </article>
            ))}
        </div>
      </div>
    </div>
  );
}

export function InstitutoComunicadosDialogs() {
  const { toast } = useToast();
  const {
    previewOpen,
    setPreviewOpen,
    pubTitle,
    pubBody,
    pubCategory,
    pubEventoFecha,
    pubAudience,
    pubCircularAttachments,
    pubGeneralAttachments,
    publishMut,
    readsFor,
    setReadsFor,
    readsRows,
    corr,
    setCorr,
    corrTitle,
    setCorrTitle,
    corrBody,
    setCorrBody,
    corrMut,
  } = useInstitutoCtx();
  const [corrDriveOpen, setCorrDriveOpen] = useState(false);
  const [corrLinkOpen, setCorrLinkOpen] = useState(false);
  const [corrLinkUrl, setCorrLinkUrl] = useState('');
  const [corrLinkTitle, setCorrLinkTitle] = useState('');
  const appendCorr = useCallback(
    (line: string) => {
      setCorrBody((b) => (b.trim() ? `${b.trim()}\n\n${line}` : line));
    },
    [setCorrBody]
  );

  const corrGoogleErr = (e: unknown) => {
    const msg = e instanceof Error ? e.message : 'No se pudo crear el archivo.';
    toast({
      title: 'Google Drive',
      description: msg,
      variant: 'destructive',
    });
  };

  return (
    <>
      <Dialog open={corrDriveOpen} onOpenChange={setCorrDriveOpen}>
        <DialogContent className="bg-[var(--mid-dark,#0f172a)] border-white/10 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle>Mi carpeta (Evo Drive)</DialogTitle>
          </DialogHeader>
          <DirectorDrivePicker
            onSelect={(meta) => {
              const name = String(meta.name ?? 'Archivo');
              const u = typeof meta.url === 'string' ? meta.url : '';
              const line = u ? `[${name}](${u})` : name;
              appendCorr(line);
              setCorrDriveOpen(false);
            }}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={corrLinkOpen} onOpenChange={setCorrLinkOpen}>
        <DialogContent className="bg-[var(--mid-dark,#0f172a)] border-white/10 text-white max-w-md">
          <DialogHeader>
            <DialogTitle>Adjuntar enlace al cuerpo</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Input
              placeholder="Título"
              value={corrLinkTitle}
              onChange={(e) => setCorrLinkTitle(e.target.value)}
              className="bg-white/5 border-white/15 text-white"
            />
            <Input
              placeholder="https://…"
              value={corrLinkUrl}
              onChange={(e) => setCorrLinkUrl(e.target.value)}
              className="bg-white/5 border-white/15 text-white"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" className="border-white/20" onClick={() => setCorrLinkOpen(false)}>
              Cerrar
            </Button>
            <Button
              className="bg-[#7c3aed]"
              disabled={!corrLinkUrl.trim()}
              onClick={() => {
                const u = corrLinkUrl.trim();
                const t = corrLinkTitle.trim() || u;
                appendCorr(`[${t}](${u})`);
                setCorrLinkOpen(false);
                setCorrLinkUrl('');
                setCorrLinkTitle('');
              }}
            >
              Añadir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="bg-[var(--mid-dark,#0f172a)] border-white/10 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle>Vista previa</DialogTitle>
          </DialogHeader>
          <div className="text-sm space-y-2 border-t border-white/10 pt-4">
            <p className="text-white/60">
              Categoría: <span className="text-white">{categoryPublishLabel(pubCategory)}</span>
            </p>
            <p className="text-white/60">
              Audiencia: <span className="text-white">{audienceLabel(pubAudience)}</span>
            </p>
            {pubCategory === 'evento' && isValidPubEventoDate(pubEventoFecha) ? (
              <p className="text-white/60">
                Fecha en calendario:{' '}
                <span className="text-white">
                  {new Date(
                    /^\d{4}-\d{2}-\d{2}$/.test(pubEventoFecha.trim())
                      ? `${pubEventoFecha.trim()}T12:00:00`
                      : pubEventoFecha.trim()
                  ).toLocaleDateString('es-CO', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </span>
              </p>
            ) : null}
            <p className="text-white font-semibold">{pubTitle}</p>
            {pubCategory === 'circular' && pubCircularAttachments.length > 0 ? (
              <div className="rounded-lg border border-[#00c8ff]/25 bg-[#00c8ff]/10 p-3 space-y-1.5">
                <p className="text-[11px] uppercase tracking-wide text-[#7dd3fc]">Archivo en Evo Drive de los padres</p>
                <ul className="text-sm text-white/90 space-y-1">
                  {pubCircularAttachments.map((a, i) => (
                    <li key={i} className="truncate" title={a.url ?? a.fileId}>
                      {a.name}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {pubCategory !== 'circular' && pubGeneralAttachments.length > 0 ? (
              <div className="rounded-lg border border-white/15 bg-white/[0.06] p-3 space-y-1.5">
                <p className="text-[11px] uppercase tracking-wide text-white/50">Adjuntos</p>
                <ul className="text-sm text-white/90 space-y-1">
                  {pubGeneralAttachments.map((a, i) => (
                    <li key={i} className="truncate" title={a.url ?? a.fileId}>
                      {a.name}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            <p className="text-white/85 whitespace-pre-wrap">{pubBody || '—'}</p>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" className="border-white/20 text-white" onClick={() => setPreviewOpen(false)}>
              Editar
            </Button>
            <Button
              className="bg-[#7c3aed] hover:bg-[#6d28d9]"
              disabled={publishMut.isPending}
              onClick={() => publishMut.mutate()}
            >
              <Send className="w-4 h-4 mr-2" />
              {publishMut.isPending ? 'Enviando…' : 'Confirmar y enviar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!readsFor} onOpenChange={(o) => !o && setReadsFor(null)}>
        <DialogContent className="bg-[var(--mid-dark,#0f172a)] border-white/10 text-white max-w-md">
          <DialogHeader>
            <DialogTitle>Lecturas</DialogTitle>
          </DialogHeader>
          <ul className="max-h-72 overflow-y-auto text-sm space-y-2">
            {readsRows.map((r) => (
              <li key={r.user_id} className="flex justify-between gap-2 border-b border-white/10 pb-2">
                <span className="text-white/90">{r.full_name}</span>
                <span className="text-white/45 shrink-0">
                  {r.read_at ? formatRelative(r.read_at) : 'Pendiente'}
                </span>
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>

      <Dialog open={!!corr} onOpenChange={(o) => !o && setCorr(null)}>
        <DialogContent className="bg-[var(--mid-dark,#0f172a)] border-white/10 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle>Corrección institucional</DialogTitle>
          </DialogHeader>
          <Input
            value={corrTitle}
            onChange={(e) => setCorrTitle(e.target.value)}
            className="bg-white/5 border-white/15 text-white mb-2"
          />
          <Textarea
            value={corrBody}
            onChange={(e) => setCorrBody(e.target.value)}
            className="bg-white/5 border-white/15 text-white min-h-[120px]"
          />
          <div className="rounded-lg border border-white/10 bg-white/[0.03] p-2 mb-2">
            <p className="text-[10px] text-white/45 mb-1.5 uppercase tracking-wide">Incluir en el cuerpo</p>
            <EvoComposeAttachmentBar
              disabled={corrMut.isPending}
              onOpenDrive={() => setCorrDriveOpen(true)}
              showReminder={false}
              onCreateDoc={async () => {
                try {
                  const base = corrTitle.trim() || 'Corrección';
                  const data = await googleCreatePersonalFile('doc', `Documento · ${base}`);
                  const url = data.googleWebViewLink;
                  if (url) appendCorr(`[${data.nombre ?? 'Google Doc'}](${url})`);
                } catch (e) {
                  corrGoogleErr(e);
                }
              }}
              onCreateSheet={async () => {
                try {
                  const base = corrTitle.trim() || 'Corrección';
                  const data = await googleCreatePersonalFile('sheet', `Hoja · ${base}`);
                  const url = data.googleWebViewLink;
                  if (url) appendCorr(`[${data.nombre ?? 'Hoja de cálculo'}](${url})`);
                } catch (e) {
                  corrGoogleErr(e);
                }
              }}
              onCreateSlide={async () => {
                try {
                  const base = corrTitle.trim() || 'Corrección';
                  const data = await googleCreatePersonalFile('slide', `Presentación · ${base}`);
                  const url = data.googleWebViewLink;
                  if (url) appendCorr(`[${data.nombre ?? 'Presentación'}](${url})`);
                } catch (e) {
                  corrGoogleErr(e);
                }
              }}
              onAttachLink={() => setCorrLinkOpen(true)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" className="border-white/20 text-white" onClick={() => setCorr(null)}>
              Cerrar
            </Button>
            <Button
              className="bg-violet-600"
              disabled={corrMut.isPending || !corrTitle.trim()}
              onClick={() => corrMut.mutate()}
            >
              Publicar corrección
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
