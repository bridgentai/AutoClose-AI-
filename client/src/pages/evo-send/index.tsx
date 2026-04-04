import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/lib/authContext';
import { useEvoSocket } from '@/hooks/useEvoSocket';
import {
  Inbox,
  Send,
  Search,
  FileText,
  AlertCircle,
  BookOpen,
  Users,
  Loader2,
  ChevronRight,
  ChevronDown,
  MessageSquare,
  Shield,
  Cloud,
  Bell,
  Pin,
  MoreHorizontal,
  Building2,
  Eye,
} from 'lucide-react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Breadcrumb, type BreadcrumbItem } from '@/components/Breadcrumb';
import { EvoComposeAttachmentBar } from '@/components/evo-compose-attachment-bar';
import {
  InstitutoCategoriesSidebarNav,
  InstitutoComunicadosDialogs,
  InstitutoComunicadosEvoProvider,
  InstitutoComunicadosFeedPanel,
  useInstitutoCtx,
} from '@/components/institucional-comunicados-evosend';
import { motion, AnimatePresence } from 'framer-motion';
import { generateCourseColor } from '@/lib/courseColor';
import kiwiChatImg from '@/assets/Kiwi-chat.png';

const EVO_BLUE = '#3B82F6';
const EVO_AMBER = '#F59E0B';

/** Alineado con el servidor: hilos 1:1 con estos roles van a Institucional. */
const INSTITUTIONAL_COUNTERPART_ROLES = new Set([
  'directivo',
  'asistente-academica',
  'school_admin',
  'admin-general-colegio',
  'rector',
  'asistente',
]);

function threadInboxCategory(t: EvoThreadItem): 'academico' | 'institucional' {
  if (t.inbox_category) return t.inbox_category;
  if ((t.tipo as string) === 'comunicado_institucional') return 'institucional';
  if (t.tipo === 'evo_chat_support') return 'institucional';
  if (t.tipo === 'evo_chat_staff') return 'academico';
  /** Chat curso–director y cursos: siempre bandeja Académica (evita filtros erróneos si falta inbox_category en caché). */
  if (t.tipo === 'evo_chat_section_director' || t.tipo === 'evo_chat') return 'academico';
  return 'academico';
}

function threadAccent(t: EvoThreadItem): string {
  if (t.tipo === 'evo_chat' && t.cursoId?._id) return generateCourseColor(t.cursoId._id);
  if (t.is_support || t.tipo === 'evo_chat_support') return '#059669';
  if (t.tipo === 'evo_chat_staff') return '#7c3aed';
  if (t.tipo === 'evo_chat_direct') return '#0891b2';
  if (t.tipo === 'evo_chat_section_director') return '#2563eb';
  if (t.tipo === 'evo_chat_family') return '#f43f5e';
  return EVO_BLUE;
}

type ThreadType =
  | 'comunicado_general'
  | 'comunicado_institucional'
  | 'curso'
  | 'asignacion'
  | 'asistencia'
  | 'general'
  | 'evo_chat'
  | 'evo_chat_staff'
  | 'evo_chat_direct'
  | 'evo_chat_family'
  | 'evo_chat_support'
  | 'evo_chat_section_director';

interface EvoThreadItem {
  _id: string;
  asunto: string;
  displayTitle?: string;
  tipo: ThreadType;
  /** Cuando viene del API: clasificación Académico vs Institucional */
  inbox_category?: 'academico' | 'institucional';
  creadoPor?: { _id: string; nombre: string; rol: string };
  cursoId?: { _id: string; nombre: string };
  assignmentId?: { _id: string; titulo: string; fechaEntrega: string };
  ultimoMensaje?: {
    contenido: string;
    fecha: string;
    remitente?: string;
    rolRemitente?: string;
    prioridad?: string;
  } | null;
  unreadCount?: number;
  updatedAt: string;
  is_support?: boolean;
}

interface UnreadByCategory {
  academico: number;
  institucional: number;
}

interface PeopleFinderItem {
  id: string;
  nombre: string;
  rol: string;
  cargo?: string;
  materia?: string;
}

interface EvoMessageItem {
  _id: string;
  contenido: string;
  tipo: string;
  prioridad?: string;
  fecha: string;
  remitenteId: { _id: string; nombre: string; rol?: string };
  rolRemitente: string;
  assignmentId?: string;
  leidoPor?: string[];
}

function safeParseJson<T>(s: string): T | null {
  try {
    return JSON.parse(s) as T;
  } catch {
    return null;
  }
}

interface ThreadDetail {
  thread:
    | (EvoThreadItem & { assignmentId?: { titulo: string; descripcion?: string; fechaEntrega: string } })
    | null;
  messages: EvoMessageItem[];
}

interface ReadDetailResponse {
  recipients: Array<{
    user_id: string;
    full_name: string;
    role: string;
    read_at: string | null;
    status: 'read' | 'pending';
  }>;
}

const tipoLabels: Record<string, string> = {
  comunicado_general: 'Comunicado general',
  comunicado_institucional: 'Institucional',
  curso: 'Curso',
  asignacion: 'Tarea',
  asistencia: 'Asistencia',
  general: 'General',
  evo_chat: 'Chat',
  evo_chat_staff: 'Grupos',
  evo_chat_direct: 'Chat directo',
  evo_chat_family: 'Chat familia',
  evo_chat_support: 'Soporte GLC',
  evo_chat_section_director: 'Curso con director',
};

/** Chats de grupo Evo Send con horario restringido para estudiantes (alineado con el servidor). */
const STUDENT_TIMED_EVO_THREAD_TYPES = new Set([
  'evo_chat',
  'evo_chat_staff',
  'evo_chat_direct',
  'evo_chat_section_director',
]);

const tipoIcons: Record<string, React.ReactNode> = {
  comunicado_general: <Users className="w-4 h-4" />,
  comunicado_institucional: <Building2 className="w-4 h-4" />,
  curso: <BookOpen className="w-4 h-4" />,
  asignacion: <FileText className="w-4 h-4" />,
  asistencia: <AlertCircle className="w-4 h-4" />,
  general: <Inbox className="w-4 h-4" />,
  evo_chat: <MessageSquare className="w-4 h-4" />,
  evo_chat_staff: <Users className="w-4 h-4" />,
  evo_chat_direct: <MessageSquare className="w-4 h-4" />,
  evo_chat_family: <Users className="w-4 h-4" />,
  evo_chat_support: <Shield className="w-4 h-4" />,
  evo_chat_section_director: <BookOpen className="w-4 h-4" />,
};

export default function EvoSendPage() {
  return (
    <InstitutoComunicadosEvoProvider>
      <EvoSendPageInner />
    </InstitutoComunicadosEvoProvider>
  );
}

function EvoSendPageInner() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const institutoMailbox = useInstitutoCtx();
  const queryClient = useQueryClient();
  const token = typeof window !== 'undefined' ? localStorage.getItem('autoclose_token') : null;
  const { connected, joinThread, emitTyping, lastMessage, lastRead, typing, clearLastMessage, clearLastRead, clearTyping } = useEvoSocket(token);
  const processedSocketMsgIds = useRef<Set<string>>(new Set());

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [sidebarPeopleQ, setSidebarPeopleQ] = useState('');
  const [debouncedSidebarPeopleQ, setDebouncedSidebarPeopleQ] = useState('');
  const [inboxTab, setInboxTab] = useState<'academico' | 'institucional'>('academico');

  const [back, setBack] = useState<{ to: string; label: string }>({ to: '/comunicacion', label: 'Comunicación' });

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem('evo-send-return-path');
      if (stored && stored.startsWith('/course-detail/') && !stored.includes(',')) {
        sessionStorage.removeItem('evo-send-return-path');
        setBack({ to: stored, label: 'Volver al curso' });
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (!user?.rol) return;
    setBack((prev) => {
      if (prev.label === 'Volver al curso') return prev;
      if (user.rol === 'padre') return { to: '/dashboard', label: 'Dashboard' };
      if (user.rol === 'estudiante') return { to: '/mi-aprendizaje', label: 'Mi Aprendizaje' };
      return prev;
    });
  }, [user?.rol]);

  const isProfesorOrEstudiante = ['profesor', 'estudiante'].includes(user?.rol || '');
  const isAsistente = user?.rol === 'asistente';
  const isAdminColegio = user?.rol === 'admin-general-colegio';
  const [adminChatsGlcCollapsed, setAdminChatsGlcCollapsed] = useState(true);

  type ThreadsResponse =
    | EvoThreadItem[]
    | {
        mis_cursos?: EvoThreadItem[];
        cursos_director?: EvoThreadItem[];
        colegas: EvoThreadItem[];
        directos?: EvoThreadItem[];
        support_thread?: (EvoThreadItem & { is_support: true }) | null;
      }
    | { threads: EvoThreadItem[]; support_thread?: (EvoThreadItem & { is_support: true }) | null }
    | {
        chats_glc: { evo_chat: EvoThreadItem[]; evo_chat_staff: EvoThreadItem[]; evo_chat_direct: EvoThreadItem[] };
        soporte: EvoThreadItem[];
        unread_by_category?: UnreadByCategory;
      }
    | {
        threads: EvoThreadItem[];
        unread_by_category?: UnreadByCategory;
      };

  const { data: threadsData, isLoading: loadingThreads } = useQuery({
    queryKey: ['/api/evo-send/threads'],
    queryFn: () => apiRequest<ThreadsResponse>('GET', '/api/evo-send/threads'),
  });

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSidebarPeopleQ(sidebarPeopleQ.trim()), 320);
    return () => window.clearTimeout(t);
  }, [sidebarPeopleQ]);

  const { data: sidebarPeopleResults = [], isFetching: sidebarPeopleLoading } = useQuery({
    queryKey: ['/api/evo-send/people-finder', 'sidebar', debouncedSidebarPeopleQ, user?.rol],
    queryFn: () =>
      apiRequest<PeopleFinderItem[]>(
        'GET',
        `/api/evo-send/people-finder?q=${encodeURIComponent(debouncedSidebarPeopleQ)}`
      ),
    enabled: debouncedSidebarPeopleQ.length >= 2,
    staleTime: 15_000,
  });

  const { data: writeWindow } = useQuery({
    queryKey: ['/api/evo-send/write-window'],
    queryFn: () =>
      apiRequest<{
        restricted: boolean;
        allowed: boolean;
        timezone: string;
        windowStart?: string;
        windowEnd?: string;
      }>('GET', '/api/evo-send/write-window'),
    enabled: user?.rol === 'estudiante',
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const { threads: threadsFlat, sections, unreadByCategory } = useMemo(() => {
    const raw = threadsData;
    if (raw == null)
      return {
        threads: [] as EvoThreadItem[],
        sections: null as null,
        unreadByCategory: { academico: 0, institucional: 0 },
      };

    if (Array.isArray(raw)) {
      return {
        threads: raw,
        sections: null as null,
        unreadByCategory: { academico: 0, institucional: 0 },
      };
    }

    if ('chats_glc' in raw && 'soporte' in raw) {
      const g = raw.chats_glc;
      const evoChat = g.evo_chat ?? [];
      const evoChatStaff = g.evo_chat_staff ?? [];
      const evoChatDirect = g.evo_chat_direct ?? [];
      const soporte = raw.soporte ?? [];
      const flat = [...evoChat, ...evoChatStaff, ...evoChatDirect, ...soporte];
      return {
        threads: flat,
        sections: [
          { label: 'Chats GLC', threads: [...evoChat, ...evoChatStaff, ...evoChatDirect] },
          { label: 'Soporte', threads: soporte },
        ],
        unreadByCategory: raw.unread_by_category ?? { academico: 0, institucional: 0 },
      };
    }

    if ('threads' in raw && Array.isArray(raw.threads)) {
      const list = raw.threads as EvoThreadItem[];
      const thPayload = raw as {
        support_thread?: (EvoThreadItem & { is_support: true }) | null;
        unread_by_category?: UnreadByCategory;
      };
      const support = thPayload.support_thread;
      if (support) {
        return {
          threads: [support, ...list],
          sections: [
            { label: 'Soporte', threads: [support] },
            { label: 'Mensajes', threads: list },
          ],
          unreadByCategory: thPayload.unread_by_category ?? { academico: 0, institucional: 0 },
        };
      }
      return {
        threads: list,
        sections: null,
        unreadByCategory: thPayload.unread_by_category ?? { academico: 0, institucional: 0 },
      };
    }

    const staffInboxRaw = raw as {
      mis_cursos?: EvoThreadItem[];
      cursos_director?: EvoThreadItem[];
      colegas?: EvoThreadItem[];
      directos?: EvoThreadItem[];
      support_thread?: (EvoThreadItem & { is_support: true }) | null;
      unread_by_category?: UnreadByCategory;
    };
    const misCursosRaw = staffInboxRaw.mis_cursos ?? [];
    const cursosDirectorRaw = staffInboxRaw.cursos_director ?? [];
    const colegas = staffInboxRaw.colegas ?? [];
    const directos = staffInboxRaw.directos ?? [];
    const support_thread = staffInboxRaw.support_thread;
    const unreadStaff = staffInboxRaw.unread_by_category ?? { academico: 0, institucional: 0 };
    // Deduplicar chats de curso por cursoId (o título) para evitar dobles cuando hay datos legacy.
    const seenCourseKeys = new Set<string>();
    const misCursos = misCursosRaw.filter((t) => {
      const key = t.cursoId?._id || t.displayTitle || t.asunto || t._id;
      if (seenCourseKeys.has(key)) return false;
      seenCourseKeys.add(key);
      return true;
    });
    const seenDirectorKeys = new Set<string>();
    const cursosDirector = cursosDirectorRaw.filter((t) => {
      const key = t.cursoId?._id || t.displayTitle || t.asunto || t._id;
      if (seenDirectorKeys.has(key)) return false;
      seenDirectorKeys.add(key);
      return true;
    });
    const isDirectorLayoutRole =
      user?.rol === 'directivo' || user?.rol === 'school_admin' || user?.rol === 'asistente-academica';
    const flat = isDirectorLayoutRole
      ? [...cursosDirector, ...colegas, ...directos]
      : [...cursosDirector, ...misCursos, ...colegas, ...directos];
    if (support_thread) {
      const withSupport = [support_thread, ...flat];
      if (user?.rol === 'profesor') {
        return {
          threads: withSupport,
          sections: [
            { label: 'Soporte', threads: [support_thread] },
            { label: 'Mis cursos', threads: misCursos },
            { label: 'Colegas', threads: colegas },
            { label: 'Colegas (1:1)', threads: directos },
          ],
          unreadByCategory: unreadStaff,
        };
      }
      if (isDirectorLayoutRole) {
        return {
          threads: withSupport,
          sections: [
            { label: 'Soporte', threads: [support_thread] },
            { label: 'Curso con director', threads: cursosDirector },
            { label: 'Staff / GLC', threads: colegas },
            { label: 'Docentes (1:1)', threads: directos },
          ],
          unreadByCategory: unreadStaff,
        };
      }
      return {
        threads: withSupport,
        sections: [{ label: 'Soporte', threads: [support_thread] }],
        unreadByCategory: unreadStaff,
      };
    }

    if (user?.rol === 'profesor') {
      return {
        threads: flat,
        sections: [
          { label: 'Mis cursos', threads: misCursos },
          { label: 'Colegas', threads: colegas },
          { label: 'Colegas (1:1)', threads: directos },
        ],
        unreadByCategory: unreadStaff,
      };
    }
    if (isDirectorLayoutRole) {
      return {
        threads: flat,
        sections: [
          { label: 'Curso con director', threads: cursosDirector },
          { label: 'Staff / GLC', threads: colegas },
          { label: 'Docentes (1:1)', threads: directos },
        ],
        unreadByCategory: unreadStaff,
      };
    }
    return {
      threads: flat,
      sections: null,
      unreadByCategory: unreadStaff,
    };
  }, [threadsData, user?.rol]);

  const {
    data: threadDetail,
    isLoading: loadingThread,
    isError: threadDetailQueryError,
    refetch: refetchThreadDetail,
  } = useQuery({
    queryKey: ['/api/evo-send/threads', selectedId],
    queryFn: () => apiRequest<ThreadDetail>('GET', `/api/evo-send/threads/${selectedId}`),
    enabled: !!selectedId,
    retry: 1,
  });

  const threadAccessBlocked =
    !!selectedId &&
    !loadingThread &&
    !threadDetailQueryError &&
    threadDetail !== undefined &&
    threadDetail.thread == null;

  const markReadMutation = useMutation({
    mutationFn: (id: string) => apiRequest('PATCH', `/api/evo-send/threads/${id}/read`),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['/api/evo-send/threads'] });
      queryClient.invalidateQueries({ queryKey: ['/api/evo-send/threads', id] });
    },
  });

  const sendReplyMutation = useMutation({
    mutationFn: (payload: { contenido?: string; contentType?: string; meta?: unknown }) =>
      apiRequest<{ _id: string }>('POST', `/api/evo-send/threads/${selectedId}/messages`, {
        contenido: payload.contenido,
        prioridad: 'normal',
        contentType: payload.contentType,
        meta: payload.meta,
      }),
    onSuccess: (data) => {
      if (data?._id) processedSocketMsgIds.current.add(data._id);
      setReplyText('');
      queryClient.invalidateQueries({ queryKey: ['/api/evo-send/threads', selectedId!] });
      queryClient.invalidateQueries({ queryKey: ['/api/evo-send/threads'] });
    },
  });

  const directChatFromSidebarMutation = useMutation({
    mutationFn: (p: PeopleFinderItem) =>
      apiRequest<{ _id?: string; existing?: boolean }>('POST', '/api/evo-send/threads', {
        asunto: `Chat con ${p.nombre}`,
        contenido: ' ',
        tipo: 'evo_chat_direct',
        targetUserId: p.id,
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/evo-send/threads'] });
      setSidebarPeopleQ('');
      if (data && typeof data === 'object' && '_id' in data && data._id) {
        setSelectedId(String(data._id));
      }
    },
  });

  const handlePickPersonFromSidebar = useCallback(
    (p: PeopleFinderItem) => {
      if (inboxTab === 'institucional') {
        institutoMailbox.openInstitutionalComposeToPerson({
          id: p.id,
          nombre: p.nombre,
          rol: p.rol,
        });
        setSidebarPeopleQ('');
        return;
      }
      const tab: 'academico' | 'institucional' = INSTITUTIONAL_COUNTERPART_ROLES.has(p.rol)
        ? 'institucional'
        : 'academico';
      setInboxTab(tab);
      directChatFromSidebarMutation.mutate(p);
    },
    [inboxTab, institutoMailbox, directChatFromSidebarMutation]
  );

  useEffect(() => {
    if (selectedId) {
      joinThread(selectedId);
      markReadMutation.mutate(selectedId);
    } else {
      joinThread(null);
    }
  }, [selectedId]);

  const trackedMessageOpenRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!selectedId || user?.rol !== 'estudiante') return;
    const t = threadsFlat.find((x) => x._id === selectedId);
    if (!t || t.tipo !== 'evo_chat') return;
    if (trackedMessageOpenRef.current.has(selectedId)) return;
    trackedMessageOpenRef.current.add(selectedId);
    const tok = typeof window !== 'undefined' ? localStorage.getItem('autoclose_token') : null;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (tok) headers.Authorization = `Bearer ${tok}`;
    fetch('/api/activity/track', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        entity_type: 'evo_message',
        entity_id: selectedId,
        action: 'message_open',
      }),
    }).catch(() => {});
  }, [selectedId, user?.rol, threadsFlat]);

  // Abrir hilo desde query ?thread= (atajo desde página del curso)
  useEffect(() => {
    if (loadingThreads || threadsFlat.length === 0) return;
    const params = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
    const threadFromUrl = params.get('thread');
    if (threadFromUrl && threadsFlat.some((t) => t._id === threadFromUrl)) {
      setSelectedId(threadFromUrl);
      if (typeof window !== 'undefined' && window.history.replaceState) {
        window.history.replaceState({}, '', window.location.pathname);
      }
    }
  }, [loadingThreads, threadsFlat]);

  // Atajo dock: ?open=family → selecciona el chat familiar (acudientes + estudiante)
  useEffect(() => {
    if (loadingThreads || threadsFlat.length === 0) return;
    const params = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
    if (params.get('open') !== 'family') return;
    const fam = threadsFlat.find((t) => t.tipo === 'evo_chat_family');
    if (fam) {
      setSelectedId(fam._id);
      if (typeof window !== 'undefined' && window.history.replaceState) {
        window.history.replaceState({}, '', window.location.pathname);
      }
    }
  }, [loadingThreads, threadsFlat]);

  useEffect(() => {
    if (!lastMessage) return;
    const m = lastMessage as {
      threadId?: string;
      _id?: string;
      contenido?: string;
      tipo?: string;
      fecha?: string;
      prioridad?: string;
      remitenteId?: { _id: string; nombre: string; rol?: string };
      rolRemitente?: string;
    };
    const mid = m._id;
    if (mid) {
      if (processedSocketMsgIds.current.has(mid)) {
        clearLastMessage();
        return;
      }
      processedSocketMsgIds.current.add(mid);
      if (processedSocketMsgIds.current.size > 400) {
        const keep = Array.from(processedSocketMsgIds.current).slice(-200);
        processedSocketMsgIds.current = new Set(keep);
      }
    }

    queryClient.invalidateQueries({ queryKey: ['/api/evo-send/threads'] });

    if (m.threadId && selectedId && m.threadId === selectedId && mid) {
      queryClient.setQueryData(['/api/evo-send/threads', selectedId], (old: ThreadDetail | undefined) => {
        if (!old?.thread) return old;
        if (old.messages?.some((x) => x._id === mid)) return old;
        const newMsg: EvoMessageItem = {
          _id: mid,
          contenido: m.contenido ?? '',
          tipo: m.tipo ?? 'texto',
          prioridad: m.prioridad,
          fecha: m.fecha ?? new Date().toISOString(),
          remitenteId: m.remitenteId ?? { _id: '', nombre: '', rol: '' },
          rolRemitente: m.rolRemitente ?? '',
        };
        return { ...old, messages: [...(old.messages || []), newMsg] };
      });
    }

    clearLastMessage();
  }, [lastMessage, selectedId, queryClient, clearLastMessage]);

  useEffect(() => {
    if (!lastRead?.threadId || !selectedId) return;
    if (lastRead.threadId !== selectedId) return;
    queryClient.invalidateQueries({ queryKey: ['/api/evo-send/threads', selectedId] });
    clearLastRead();
  }, [lastRead, selectedId, queryClient, clearLastRead]);

  const sortedThreads = useMemo(
    () =>
      [...threadsFlat].sort((a, b) => {
        const dateA = a.ultimoMensaje?.fecha ? new Date(a.ultimoMensaje.fecha).getTime() : new Date(a.updatedAt).getTime();
        const dateB = b.ultimoMensaje?.fecha ? new Date(b.ultimoMensaje.fecha).getTime() : new Date(b.updatedAt).getTime();
        return dateB - dateA;
      }),
    [threadsFlat]
  );

  const threadsForInboxTab = useMemo(
    () => sortedThreads.filter((t) => threadInboxCategory(t) === inboxTab),
    [sortedThreads, inboxTab]
  );

  const sectionsForInboxTab = useMemo(() => {
    if (!sections) return null;
    const out = sections
      .map((sec) => ({
        ...sec,
        threads: sec.threads.filter((t) => threadInboxCategory(t) === inboxTab),
      }))
      .filter((sec) => sec.threads.length > 0);
    return out.length ? out : null;
  }, [sections, inboxTab]);

  useEffect(() => {
    if (!selectedId) return;
    const cur = threadsFlat.find((x) => x._id === selectedId);
    if (cur && threadInboxCategory(cur) !== inboxTab) {
      setSelectedId(null);
    }
  }, [inboxTab, selectedId, threadsFlat]);

  const selectedThread = threadsFlat.find((t) => t._id === selectedId);
  const messages = threadDetail?.messages ?? [];

  const studentComposerBlocked =
    user?.rol === 'estudiante' &&
    writeWindow?.restricted &&
    writeWindow.allowed === false &&
    !!selectedThread &&
    STUDENT_TIMED_EVO_THREAD_TYPES.has(selectedThread.tipo);

  const threadsEmptyHint =
    user?.rol === 'padre'
      ? 'Sin chats: vincula a tu hijo o hija en Mi perfil. Si ya está vinculado, confirma que figuras como acudiente en el colegio.'
      : user?.rol === 'estudiante'
        ? 'Sin chats todavía. Con acudientes vinculados aparece el chat «Familia»; los de curso salen cuando el profesor usa Evo Send en tu grupo.'
        : undefined;

  const handleSendReply = () => {
    if (!replyText.trim() || !selectedId || studentComposerBlocked) return;
    sendReplyMutation.mutate({ contentType: 'texto', contenido: replyText.trim() });
  };

  useEffect(() => {
    const params = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
    const context = params.get('context');
    if (context && !replyText) {
      setReplyText(`Escribiendo sobre: ${context}\n`);
    }
  }, []);

  const breadcrumbItems = useMemo(() => {
    const prev =
      back.label === 'Volver al curso'
        ? { label: 'Curso', href: back.to }
        : { label: back.label, href: back.to };
    return [prev, { label: 'EvoSend' }];
  }, [back]);

  const evoLayoutShared = {
    threads: threadsForInboxTab,
    selectedId,
    setSelectedId,
    selectedThread,
    messages,
    threadDetail,
    user,
    replyText,
    setReplyText,
    onSendReply: handleSendReply,
    sendReplyMutation,
    loadingThreads,
    loadingThread,
    onNewMessage: () => {},
    sidebarPeopleQ,
    setSidebarPeopleQ,
    sidebarPeopleResults,
    sidebarPeopleLoading,
    onPickPersonForChat: handlePickPersonFromSidebar,
    pickPersonPending: directChatFromSidebarMutation.isPending,
    typing,
    emitTyping,
    selectedIdForTyping: selectedId,
    sections: sectionsForInboxTab,
    studentComposerBlocked,
    writeWindowTimezone: writeWindow?.timezone,
    threadsEmptyHint,
    inboxTab,
    setInboxTab,
    unreadByCategory,
    connected,
    chatsGlcCollapsed: isAdminColegio ? adminChatsGlcCollapsed : undefined,
    onToggleChatsGlc: isAdminColegio ? () => setAdminChatsGlcCollapsed((c) => !c) : undefined,
    threadAccessBlocked,
    threadDetailQueryError,
    onRetryThreadDetail: () => void refetchThreadDetail(),
    breadcrumbItems,
  };

  return (
    <div
      className="flex flex-col flex-1 min-h-0 w-full max-h-full overflow-hidden font-sans text-[#E2E8F0]"
      style={{
        background: 'radial-gradient(circle at 20% 20%, #1E3A8A 0%, #0F172A 40%, #020617 100%)',
      }}
    >
      <div className="flex-1 flex flex-col min-h-0 min-w-0 overflow-hidden">
        {isAsistente ? (
          <Tabs defaultValue="asistencia" className="flex flex-col flex-1 min-h-0 overflow-hidden gap-0">
            <div className="shrink-0 px-4 pt-3">
              <TabsList className="bg-white/[0.06] border border-white/[0.08] rounded-xl p-1">
                <TabsTrigger
                  value="asistencia"
                  className="rounded-lg data-[state=active]:bg-[#3B82F6] data-[state=active]:text-white"
                >
                  Inbox Asistencia
                </TabsTrigger>
                <TabsTrigger
                  value="mensajes"
                  className="rounded-lg data-[state=active]:bg-[#3B82F6] data-[state=active]:text-white"
                >
                  Mensajes
                </TabsTrigger>
              </TabsList>
            </div>
            <TabsContent value="asistencia" className="flex-1 min-h-0 overflow-y-auto px-4 pb-4 mt-3">
              <AttendanceInbox />
            </TabsContent>
            <TabsContent value="mensajes" className="flex-1 flex flex-col min-h-0 overflow-hidden mt-0 px-0 pb-0 data-[state=inactive]:hidden">
              <EvoLayout
                {...evoLayoutShared}
                canCreateThread={false}
                showFilters={false}
              />
            </TabsContent>
          </Tabs>
        ) : (
          <EvoLayout
            {...evoLayoutShared}
            canCreateThread={false}
            showFilters={!isProfesorOrEstudiante}
          />
        )}
      </div>

    </div>
  );
}

function AttendanceInbox() {
  const [cursoId, setCursoId] = useState('');
  const [fecha, setFecha] = useState('');
  const { data: records = [] } = useQuery({
    queryKey: ['/api/evo-send/attendance-inbox', cursoId, fecha],
    queryFn: () => {
      const params = new URLSearchParams();
      if (cursoId) params.set('cursoId', cursoId);
      if (fecha) params.set('fecha', fecha);
      return apiRequest<any[]>('GET', `/api/evo-send/attendance-inbox?${params.toString()}`);
    },
  });

  return (
    <Card
      className="rounded-2xl overflow-hidden border border-white/[0.08]"
      style={{
        background: 'linear-gradient(145deg, rgba(30,58,138,0.25), rgba(15,23,42,0.55))',
        backdropFilter: 'blur(20px)',
      }}
    >
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2 text-[#E2E8F0]">
          <AlertCircle className="w-5 h-5" style={{ color: EVO_BLUE }} />
          Registros de asistencia
        </CardTitle>
        <p className="text-white/55 text-sm">Todos los registros en tiempo real</p>
        <div className="flex gap-2 flex-wrap mt-2">
          <Input
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            className="bg-white/10 border-white/10 w-40"
          />
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 max-h-[60vh] overflow-y-auto">
          {records.map((r: any) => (
            <div
              key={r._id}
              className="p-3 rounded-lg bg-white/5 border border-white/10 flex items-center justify-between"
            >
              <div>
                <p className="text-white font-medium">{(r.estudianteId as any)?.nombre}</p>
                <p className="text-white/60 text-sm">{(r.cursoId as any)?.nombre} · {new Date(r.fecha).toLocaleDateString('es')}</p>
              </div>
              <Badge variant={r.estado === 'presente' ? 'default' : 'destructive'}>
                {r.estado === 'presente' ? 'Presente' : 'Ausente'}
              </Badge>
            </div>
          ))}
          {records.length === 0 && <p className="text-white/50 text-center py-8">No hay registros para los filtros seleccionados.</p>}
        </div>
      </CardContent>
    </Card>
  );
}

interface EvoLayoutProps {
  threads: EvoThreadItem[];
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
  selectedThread?: EvoThreadItem;
  messages: EvoMessageItem[];
  threadDetail?: ThreadDetail | null;
  user: any;
  replyText: string;
  setReplyText: (s: string) => void;
  onSendReply: () => void;
  sendReplyMutation: {
    mutate: (p: { contenido?: string; contentType?: string; meta?: unknown }) => void;
    isPending: boolean;
  };
  loadingThreads: boolean;
  loadingThread: boolean;
  canCreateThread: boolean;
  onNewMessage: () => void;
  sidebarPeopleQ: string;
  setSidebarPeopleQ: (s: string) => void;
  sidebarPeopleResults: PeopleFinderItem[];
  sidebarPeopleLoading: boolean;
  onPickPersonForChat: (p: PeopleFinderItem) => void;
  pickPersonPending: boolean;
  showFilters?: boolean;
  typing: { userId?: string; userName?: string; threadId?: string } | null;
  emitTyping: (threadId: string, userName?: string) => void;
  selectedIdForTyping: string | null;
  sections?: { label: string; threads: EvoThreadItem[] }[] | null;
  chatsGlcCollapsed?: boolean;
  onToggleChatsGlc?: () => void;
  /** Solo estudiantes: fuera de 7:00–19:00 en chats de grupo */
  studentComposerBlocked?: boolean;
  writeWindowTimezone?: string;
  threadsEmptyHint?: string;
  inboxTab: 'academico' | 'institucional';
  setInboxTab: (t: 'academico' | 'institucional') => void;
  unreadByCategory: UnreadByCategory;
  connected?: boolean;
  threadAccessBlocked?: boolean;
  threadDetailQueryError?: boolean;
  onRetryThreadDetail?: () => void;
  breadcrumbItems: BreadcrumbItem[];
}

interface EvoDriveFile {
  _id: string;
  nombre: string;
  url?: string;
  googleWebViewLink?: string;
  evoStorageUrl?: string;
}

interface DrivePickerContentProps {
  cursoId?: string;
  onSelect: (formattedMessage: string | null) => void;
}

type PersonalDriveItem = { id: string; nombre: string; url?: string; googleWebViewLink?: string };

function DrivePickerContent({ cursoId, onSelect }: DrivePickerContentProps) {
  const usePersonal = !cursoId?.trim();
  const { data: courseFiles = [], isLoading: loadingCourse } = useQuery<EvoDriveFile[]>({
    queryKey: ['evo-drive', 'files-for-evo-send', cursoId],
    queryFn: () =>
      apiRequest<EvoDriveFile[]>(
        `GET`,
        `/api/evo-drive/files?cursoId=${encodeURIComponent(cursoId || '')}`
      ),
    enabled: !usePersonal,
  });
  const { data: personalFiles = [], isLoading: loadingPersonal } = useQuery<PersonalDriveItem[]>({
    queryKey: ['evo-drive', 'my-folder-evo-send-picker'],
    queryFn: () => apiRequest<PersonalDriveItem[]>('GET', '/api/evo-drive/my-folder'),
    enabled: usePersonal,
  });

  const files: EvoDriveFile[] = usePersonal
    ? personalFiles.map((r) => ({
        _id: r.id,
        nombre: r.nombre,
        url: r.url,
        googleWebViewLink: r.googleWebViewLink,
      }))
    : courseFiles;
  const isLoading = usePersonal ? loadingPersonal : loadingCourse;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-white/60" />
      </div>
    );
  }

  if (!files.length) {
    return (
      <p className="text-white/60 text-sm">
        {usePersonal
          ? 'No hay archivos en tu carpeta personal. Añádelos desde Evo Drive o crea un documento desde el compositor.'
          : 'No hay archivos en Evo Drive para este curso todavía.'}
      </p>
    );
  }

  return (
    <div className="space-y-3 max-h-[420px] overflow-y-auto pt-2">
      {files.map((f) => {
        const resolvedUrl = f.url || f.googleWebViewLink || f.evoStorageUrl || null;
        return (
          <button
            key={f._id}
            type="button"
            onClick={() => onSelect(JSON.stringify({ fileId: f._id, name: f.nombre, url: resolvedUrl }))}
            className="w-full text-left p-3 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.08] transition-colors"
          >
            <p className="text-sm font-medium text-white truncate">{f.nombre}</p>
            <p className="text-[11px] text-white/50 mt-1 truncate">{resolvedUrl || 'Se abrirá en Evo Drive'}</p>
          </button>
        );
      })}
    </div>
  );
}

interface ReminderPickerContentProps {
  cursoId?: string;
  onSelect: (formattedMessage: string | null) => void;
}

interface ReminderAssignment {
  _id: string;
  titulo: string;
  fechaEntrega: string;
}

function ReminderPickerContent({ cursoId, onSelect }: ReminderPickerContentProps) {
  const { user } = useAuth();
  const profesorId = user?.id;

  const { data: assignments = [], isLoading } = useQuery<ReminderAssignment[]>({
    queryKey: ['evo-send', 'reminders', profesorId, cursoId],
    queryFn: () =>
      apiRequest<ReminderAssignment[]>(
        'GET',
        `/api/assignments/profesor/${encodeURIComponent(
          profesorId || ''
        )}/mis-asignaciones?cursoId=${encodeURIComponent(cursoId || '')}`
      ),
    enabled: !!profesorId && !!cursoId,
    // Importante: en este proyecto queries tienen staleTime Infinity global.
    // Para el picker necesitamos ver asignaciones nuevas sin refrescar la app.
    staleTime: 0,
    refetchOnMount: 'always',
  });

  if (!cursoId) {
    return <p className="text-white/60 text-sm">Este chat no está vinculado a un curso.</p>;
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-white/60" />
      </div>
    );
  }

  if (!assignments.length) {
    return (
      <p className="text-white/60 text-sm">
        No hay tareas creadas para este curso todavía.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[420px] overflow-y-auto pt-2">
      {assignments.map((a) => {
        const due = new Date(a.fechaEntrega);
        const fechaStr = due.toLocaleString('es', {
          day: '2-digit',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit',
        });
        return (
          <button
            key={a._id}
            type="button"
            onClick={() =>
              onSelect(
                JSON.stringify({
                  assignmentId: a._id,
                  title: a.titulo,
                  dueAt: a.fechaEntrega,
                  url: `/assignment/${a._id}`,
                })
              )
            }
            className="text-left p-4 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] transition-colors flex flex-col gap-1"
          >
            <span className="text-xs uppercase tracking-wide text-white/50">Recordatorio</span>
            <span className="text-sm font-semibold text-white line-clamp-2">{a.titulo}</span>
            <span className="text-xs text-white/60 mt-1">Entrega: {fechaStr}</span>
          </button>
        );
      })}
    </div>
  );
}

function EvoLayout({
  threads,
  selectedId,
  setSelectedId,
  selectedThread,
  messages,
  threadDetail,
  user,
  replyText,
  setReplyText,
  onSendReply,
  sendReplyMutation,
  loadingThreads,
  loadingThread,
  canCreateThread,
  onNewMessage,
  sidebarPeopleQ,
  setSidebarPeopleQ,
  sidebarPeopleResults,
  sidebarPeopleLoading,
  onPickPersonForChat,
  pickPersonPending,
  showFilters = true,
  typing,
  emitTyping,
  selectedIdForTyping,
  sections,
  chatsGlcCollapsed,
  onToggleChatsGlc,
  studentComposerBlocked = false,
  writeWindowTimezone,
  threadsEmptyHint,
  inboxTab,
  setInboxTab,
  unreadByCategory,
  connected = false,
  threadAccessBlocked = false,
  threadDetailQueryError = false,
  onRetryThreadDetail,
  breadcrumbItems,
}: EvoLayoutProps) {
  const threadSearchInputRef = useRef<HTMLInputElement>(null);
  const [messageViewFilter, setMessageViewFilter] = useState<'todos' | 'recordatorios' | 'mensajes'>('todos');
  const [inThreadSearchOpen, setInThreadSearchOpen] = useState(false);
  const [inThreadQuery, setInThreadQuery] = useState('');
  const [sidebarDirectoryOpen, setSidebarDirectoryOpen] = useState(false);
  const [composerFocused, setComposerFocused] = useState(false);
  const [showDrivePicker, setShowDrivePicker] = useState(false);
  const [showReminderPicker, setShowReminderPicker] = useState(false);
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkTitle, setLinkTitle] = useState('');
  const [collapsedBySection, setCollapsedBySection] = useState<Record<string, boolean>>({});
  const [readsExpanded, setReadsExpanded] = useState(false);
  const cursoIdForThread = selectedThread?.cursoId?._id as string | undefined;

  const googleCreateMutation = useMutation({
    mutationFn: async (kind: 'doc' | 'sheet' | 'slide') => {
      const nombre =
        kind === 'doc' ? 'Documento EvoSend' : kind === 'sheet' ? 'Hoja EvoSend' : 'Presentación EvoSend';
      return apiRequest<{ googleWebViewLink?: string; nombre?: string }>('POST', '/api/evo-drive/google/create-personal', {
        nombre,
        tipo: kind,
      });
    },
    onSuccess: (data, kind) => {
      const url = data.googleWebViewLink;
      if (!url) return;
      const name = data.nombre ?? (kind === 'doc' ? 'Google Doc' : kind === 'sheet' ? 'Hoja de cálculo' : 'Presentación');
      sendReplyMutation.mutate({
        contentType: 'evo_drive',
        meta: { name, url },
      });
    },
  });

  const isInstitutional = inboxTab === 'institucional';
  const tabAccent = isInstitutional ? EVO_AMBER : EVO_BLUE;

  const filteredViewMessages = useMemo(() => {
    return messages.filter((m) => {
      if (messageViewFilter === 'todos') return true;
      if (messageViewFilter === 'recordatorios') return m.tipo === 'assignment_reminder';
      return m.tipo !== 'assignment_reminder';
    });
  }, [messages, messageViewFilter]);

  const displayThreadMessages = useMemo(() => {
    const q = inThreadQuery.trim().toLowerCase();
    if (!q) return filteredViewMessages;
    return filteredViewMessages.filter((m) => (m.contenido ?? '').toLowerCase().includes(q));
  }, [filteredViewMessages, inThreadQuery]);

  const threadIdIsUuid =
    !!selectedId &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(selectedId);
  const showThreadReads =
    user?.rol === 'profesor' && selectedThread?.tipo === 'evo_chat' && threadIdIsUuid;
  const showComunicadoReadDetail =
    (user?.rol === 'profesor' ||
      user?.rol === 'directivo' ||
      user?.rol === 'admin-general-colegio' ||
      user?.rol === 'asistente-academica') &&
    (selectedThread?.tipo === 'comunicado_general' ||
      selectedThread?.tipo === 'curso' ||
      selectedThread?.tipo === 'comunicado_institucional');

  const { data: threadReads } = useQuery({
    queryKey: ['/api/activity/thread', selectedId, 'reads'],
    queryFn: () =>
      apiRequest<{
        total_students: number;
        opened_count: number;
        students: { student_id: string; full_name: string; opened_at: string }[];
      }>('GET', `/api/activity/thread/${selectedId}/reads`),
    enabled: showThreadReads,
    staleTime: 20_000,
  });

  const { data: comunicadoReads } = useQuery({
    queryKey: ['/api/courses/comunicado', selectedId, 'read-detail'],
    queryFn: () =>
      apiRequest<ReadDetailResponse>('GET', `/api/courses/comunicado/${selectedId}/read-detail`),
    enabled: !!selectedId && showComunicadoReadDetail,
    staleTime: 20_000,
  });

  useEffect(() => {
    setReadsExpanded(false);
    setMessageViewFilter('todos');
    setInThreadQuery('');
    setInThreadSearchOpen(false);
  }, [selectedId]);

  const getSectionCollapsed = (label: string) => {
    if (label === 'Chats GLC' && onToggleChatsGlc != null) return chatsGlcCollapsed === true;
    return !!collapsedBySection[label];
  };

  const handleToggleSection = (label: string) => {
    if (label === 'Chats GLC' && onToggleChatsGlc) {
      onToggleChatsGlc();
    } else {
      setCollapsedBySection((prev) => ({ ...prev, [label]: !prev[label] }));
    }
  };

  const accent = selectedThread ? threadAccent(selectedThread) : tabAccent;
  const chatHeaderBarStyle: React.CSSProperties = {
    background: `linear-gradient(145deg, color-mix(in srgb, ${accent} 28%, rgba(15,23,42,0.94)), color-mix(in srgb, ${accent} 12%, rgba(15,23,42,0.78)))`,
    backdropFilter: 'blur(20px)',
    borderBottom: `1px solid color-mix(in srgb, ${accent} 28%, rgba(255,255,255,0.08))`,
  };
  const chatComposerBarStyle: React.CSSProperties = {
    background: `linear-gradient(145deg, color-mix(in srgb, ${accent} 22%, rgba(15,23,42,0.94)), color-mix(in srgb, ${accent} 8%, rgba(15,23,42,0.78)))`,
    backdropFilter: 'blur(20px)',
    borderTop: `1px solid color-mix(in srgb, ${accent} 22%, rgba(255,255,255,0.08))`,
  };

  const messagingBlocked = threadAccessBlocked || threadDetailQueryError;
  const composerDisabled =
    messagingBlocked || loadingThread || !threadDetail?.thread || studentComposerBlocked;

  const evoSidebarChrome = (
    <>
      <div className="shrink-0 border-b border-white/[0.06] px-4 py-2 flex flex-col justify-center gap-0.5 min-h-[72px]">
        <Breadcrumb items={breadcrumbItems} className="!text-[11px] leading-tight" />
        <div className="flex items-center gap-2">
          <h2 className="text-[18px] sm:text-[20px] font-bold text-white tracking-[-0.02em]">EvoSend</h2>
          <div className="w-2 h-2 rounded-full bg-red-500 shrink-0" aria-hidden />
        </div>
        <p className="text-[11px] text-white/45">
          {connected ? 'En línea · ' : ''}
          Comunicación en tiempo real
        </p>
      </div>
      <div className="px-4 py-3 space-y-3 border-b border-white/[0.06] shrink-0">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setInboxTab('academico')}
            className="h-7 flex-1 px-3 text-[11px] font-semibold rounded-full transition-all"
            style={{
              background: inboxTab === 'academico' ? EVO_BLUE : 'rgba(255,255,255,0.06)',
              color: inboxTab === 'academico' ? 'white' : 'rgba(255,255,255,0.55)',
              border: inboxTab === 'academico' ? 'none' : '1px solid rgba(255,255,255,0.08)',
            }}
          >
            Académico{unreadByCategory.academico > 0 ? ` (${unreadByCategory.academico})` : ''}
          </button>
          <button
            type="button"
            onClick={() => setInboxTab('institucional')}
            className="h-7 flex-1 px-3 text-[11px] font-semibold rounded-full transition-all"
            style={{
              background: inboxTab === 'institucional' ? EVO_AMBER : 'rgba(255,255,255,0.06)',
              color: inboxTab === 'institucional' ? 'white' : 'rgba(255,255,255,0.55)',
              border: inboxTab === 'institucional' ? 'none' : '1px solid rgba(255,255,255,0.08)',
            }}
          >
            Institucional{unreadByCategory.institucional > 0 ? ` (${unreadByCategory.institucional})` : ''}
          </button>
        </div>
        {canCreateThread ? (
          <Button
            type="button"
            className="w-full h-8 rounded-full text-[12px] font-semibold border-0 text-white"
            style={{ background: `linear-gradient(180deg, ${EVO_BLUE}, #1D4ED8)` }}
            onClick={onNewMessage}
          >
            <Send className="w-3.5 h-3.5 mr-2" />
            Nuevo mensaje
          </Button>
        ) : null}
        <div className="relative space-y-1">
          <div
            className="flex items-center gap-2 h-9 px-3 rounded-[10px]"
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            <Search className="w-3.5 h-3.5 text-white/45 shrink-0" />
            <Input
              id="evo-send-sidebar-search"
              placeholder={
                inboxTab === 'institucional'
                  ? 'Buscar destinatario (mensaje institucional)…'
                  : 'Buscar persona para chatear…'
              }
              value={sidebarPeopleQ}
              onChange={(e) => {
                setSidebarPeopleQ(e.target.value);
                setSidebarDirectoryOpen(true);
              }}
              onFocus={() => setSidebarDirectoryOpen(true)}
              className="flex-1 border-0 bg-transparent shadow-none focus-visible:ring-0 text-[13px] text-[#E2E8F0] placeholder:text-white/35 h-8 px-0"
              autoComplete="off"
            />
            {sidebarPeopleLoading ? <Loader2 className="w-4 h-4 animate-spin text-white/40 shrink-0" /> : null}
          </div>
          {sidebarDirectoryOpen && sidebarPeopleQ.trim().length >= 2 && sidebarPeopleResults.length > 0 ? (
            <div
              className="absolute left-0 right-0 top-full z-20 mt-1 max-h-56 overflow-y-auto rounded-[10px] border border-white/10 py-1 shadow-lg"
              style={{ background: 'rgba(15,23,42,0.97)' }}
            >
              {sidebarPeopleResults.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  disabled={pickPersonPending}
                  className="w-full px-3 py-2 text-left text-[12px] text-white/90 hover:bg-white/10 disabled:opacity-50"
                  onClick={() => {
                    onPickPersonForChat(p);
                    setSidebarDirectoryOpen(false);
                  }}
                >
                  <span className="font-medium">{p.nombre}</span>
                  <span className="text-white/45"> · {p.rol}</span>
                </button>
              ))}
            </div>
          ) : null}
        </div>
        {inboxTab === 'institucional' ? (
          <div className="pt-1">
            <InstitutoCategoriesSidebarNav />
          </div>
        ) : null}
      </div>
    </>
  );

  if (inboxTab === 'institucional') {
    return (
      <>
        <div className="flex min-h-0 flex-1 flex-row overflow-hidden w-full">
          <div
            className="flex min-h-0 w-[272px] shrink-0 flex-col overflow-hidden border-r border-white/[0.08] sm:w-[300px]"
            style={{
              background: 'linear-gradient(145deg, rgba(30,58,138,0.25), rgba(15,23,42,0.55))',
              backdropFilter: 'blur(20px)',
            }}
          >
            {evoSidebarChrome}
            <div
              className="min-h-0 flex-1 basis-0 overflow-y-auto overflow-x-hidden px-3 py-2 [scrollbar-gutter:stable] text-[11px] text-white/45"
              style={{
                scrollbarWidth: 'thin',
                scrollbarColor: 'rgba(124,58,237,0.45) rgba(255,255,255,0.06)',
              }}
            >
              <p>
                Comunicados oficiales (GLC) en el panel derecho. El buscador abre un nuevo mensaje institucional con esa
                persona (bandeja entrada/salida); el académico sigue en la pestaña «Académico» con hilos tipo chat.
              </p>
            </div>
          </div>
          <div className="flex min-h-0 min-w-0 flex-1 basis-0 flex-col overflow-hidden bg-transparent p-2 sm:p-3">
            <InstitutoComunicadosFeedPanel />
          </div>
        </div>
        <InstitutoComunicadosDialogs />
      </>
    );
  }

  return (
    <>
      <div className="flex min-h-0 flex-1 flex-row overflow-hidden w-full">
        {/* Conversations sidebar */}
        <div
          className="flex min-h-0 w-[272px] shrink-0 flex-col overflow-hidden border-r border-white/[0.08] sm:w-[300px]"
          style={{
            background: 'linear-gradient(145deg, rgba(30,58,138,0.25), rgba(15,23,42,0.55))',
            backdropFilter: 'blur(20px)',
          }}
        >
          {evoSidebarChrome}
          <div
            className="min-h-0 flex-1 basis-0 overflow-y-auto overflow-x-hidden px-2 py-1 [scrollbar-gutter:stable]"
            style={{
              scrollbarWidth: 'thin',
              scrollbarColor: 'rgba(59,130,246,0.45) rgba(255,255,255,0.06)',
            }}
          >
            {loadingThreads ? (
              <div className="flex items-center justify-center p-8">
                <Loader2 className="w-8 h-8 animate-spin text-white/50" />
              </div>
            ) : (
              filteredThreadsList(
                threads,
                selectedId,
                setSelectedId,
                '',
                sections,
                sections && sections.length > 0 ? getSectionCollapsed : undefined,
                sections && sections.length > 0 ? handleToggleSection : undefined,
                threadsEmptyHint,
                tabAccent
              )
            )}
          </div>
        </div>

        {/* Main panel */}
        <div className="flex min-h-0 min-w-0 flex-1 basis-0 flex-col overflow-hidden bg-transparent">
          {selectedThread ? (
            <>
              <div
                className="flex-shrink-0 h-[72px] px-5 flex items-center justify-between gap-3"
                style={chatHeaderBarStyle}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 overflow-hidden"
                    style={{
                      background: `linear-gradient(135deg, color-mix(in srgb, ${accent} 45%, transparent), color-mix(in srgb, ${accent} 22%, transparent))`,
                      border: `1px solid color-mix(in srgb, ${accent} 40%, transparent)`,
                    }}
                  >
                    {(selectedThread.is_support || selectedThread.tipo === 'evo_chat_support') ? (
                      <Shield className="w-4 h-4 text-white" style={{ color: accent }} />
                    ) : (
                      <img src={kiwiChatImg} alt="" className="w-8 h-8 rounded-full object-cover" draggable={false} />
                    )}
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-[16px] font-bold text-white tracking-[-0.02em] truncate">
                      {selectedThread.displayTitle ?? selectedThread.asunto}
                    </h3>
                    {selectedThread.tipo === 'evo_chat_family' ? (
                      <p className="text-[12px] text-white/50 truncate">Chat familia (acudientes y estudiante)</p>
                    ) : (
                      <p className="text-[12px] text-white/50 truncate">
                        {tipoLabels[selectedThread.tipo] ?? selectedThread.tipo}
                        {selectedThread.creadoPor
                          ? ` · ${(selectedThread.creadoPor as { nombre?: string; rol?: string })?.nombre ?? ''}`
                          : ''}
                      </p>
                    )}
                  </div>
                </div>
                <div className="hidden sm:flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    className="h-8 px-3 flex items-center gap-2 rounded-full text-[11px] font-medium transition-colors text-white/55 hover:text-white/80"
                    style={{
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid rgba(255,255,255,0.08)',
                    }}
                    onClick={() => {
                      setInThreadSearchOpen((v) => !v);
                      window.setTimeout(() => threadSearchInputRef.current?.focus(), 0);
                    }}
                  >
                    <Search className="w-3.5 h-3.5" />
                    Buscar en hilo
                  </button>
                  <button
                    type="button"
                    className="h-8 px-3 flex items-center gap-2 rounded-full text-[11px] font-medium text-white/40 cursor-not-allowed"
                    style={{
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(255,255,255,0.06)',
                    }}
                    disabled
                    title="Próximamente"
                  >
                    <Pin className="w-3.5 h-3.5" />
                    Fijados
                  </button>
                  <button
                    type="button"
                    className="h-8 px-3 flex items-center gap-2 rounded-full text-[11px] font-medium text-white/40 cursor-not-allowed"
                    style={{
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(255,255,255,0.06)',
                    }}
                    disabled
                    title="Próximamente"
                  >
                    <MoreHorizontal className="w-3.5 h-3.5" />
                    Más
                  </button>
                </div>
              </div>
              {inThreadSearchOpen ? (
                <div
                  className="flex-shrink-0 px-5 py-2 flex items-center gap-2 border-b border-white/[0.06]"
                  style={{
                    background: 'rgba(15,23,42,0.55)',
                  }}
                >
                  <Search className="w-3.5 h-3.5 text-white/45 shrink-0" />
                  <Input
                    ref={threadSearchInputRef}
                    value={inThreadQuery}
                    onChange={(e) => setInThreadQuery(e.target.value)}
                    placeholder="Palabra en este hilo…"
                    className="flex-1 h-8 border-0 bg-white/[0.06] text-[13px] text-[#E2E8F0] placeholder:text-white/35 focus-visible:ring-1 focus-visible:ring-white/20"
                  />
                  <button
                    type="button"
                    className="text-[11px] text-white/50 hover:text-white/80 shrink-0 px-2"
                    onClick={() => {
                      setInThreadSearchOpen(false);
                      setInThreadQuery('');
                    }}
                  >
                    Cerrar
                  </button>
                </div>
              ) : null}
              {!messagingBlocked ? (
                <>
                  <div
                    className="flex-shrink-0 h-12 px-5 flex items-center gap-3 border-b border-white/[0.06]"
                    style={{
                      background: `linear-gradient(180deg, color-mix(in srgb, ${accent} 14%, rgba(15,23,42,0.55)), rgba(15,23,42,0.38))`,
                    }}
                  >
                    <span className="text-[11px] text-white/40 shrink-0">Vista:</span>
                    <div className="flex gap-2 flex-wrap">
                      {(['todos', 'recordatorios', 'mensajes'] as const).map((f) => (
                        <button
                          key={f}
                          type="button"
                          onClick={() => setMessageViewFilter(f)}
                          className="h-[26px] px-3 text-[11px] font-medium rounded-full capitalize transition-all"
                          style={{
                            background: messageViewFilter === f ? tabAccent : 'rgba(255,255,255,0.06)',
                            color: messageViewFilter === f ? 'white' : 'rgba(255,255,255,0.55)',
                            border:
                              messageViewFilter === f ? 'none' : '1px solid rgba(255,255,255,0.08)',
                          }}
                        >
                          {f}
                        </button>
                      ))}
                    </div>
                  </div>
                  {typing?.threadId === selectedId && typing?.userId !== user?.id ? (
                    <p className="shrink-0 text-white/50 text-xs italic animate-pulse px-5 pt-2 pb-1">
                      {typing.userName || 'Alguien'} está escribiendo...
                    </p>
                  ) : null}
                  {showComunicadoReadDetail && comunicadoReads?.recipients ? (
                    <p className="shrink-0 text-white/45 text-[11px] px-5 pb-2">
                      Acuse: {comunicadoReads.recipients.filter((r) => r.status === 'read').length}/
                      {comunicadoReads.recipients.length}
                    </p>
                  ) : null}
                </>
              ) : null}
              <div
                className="min-h-0 flex-1 basis-0 overflow-y-auto overflow-x-hidden overscroll-contain p-5 [scrollbar-gutter:stable]"
                style={{
                  scrollbarWidth: 'thin',
                  scrollbarColor: 'rgba(59,130,246,0.45) rgba(255,255,255,0.06)',
                }}
              >
                {threadDetailQueryError ? (
                  <div className="flex min-h-[200px] flex-col items-center justify-center gap-4 px-4 py-12 text-center">
                    <Alert className="max-w-md border-red-500/35 bg-red-500/10 text-red-50 [&>svg]:text-red-200">
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle className="text-sm font-semibold text-red-50">No se pudieron cargar los mensajes</AlertTitle>
                      <AlertDescription className="text-xs text-red-100/90">
                        Revisa la conexión o que el servidor esté disponible.
                      </AlertDescription>
                    </Alert>
                    {onRetryThreadDetail ? (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={onRetryThreadDetail}
                        className="border-white/20 text-white hover:bg-white/10"
                      >
                        Reintentar
                      </Button>
                    ) : null}
                  </div>
                ) : threadAccessBlocked ? (
                  <div className="flex min-h-[200px] items-center justify-center px-4 py-12">
                    <Alert className="max-w-lg border-amber-500/40 bg-amber-500/10 text-amber-50 [&>svg]:text-amber-200">
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle className="text-sm font-semibold text-amber-50">Sin acceso a este hilo</AlertTitle>
                      <AlertDescription className="text-xs text-amber-100/90">
                        No puedes ver los mensajes de esta conversación o el hilo ya no está disponible. Elige otro chat
                        en la lista.
                      </AlertDescription>
                    </Alert>
                  </div>
                ) : (
                  <>
                {threadDetail?.thread?.assignmentId && (
                  <div
                    className="p-4 rounded-xl border border-[#3B82F6]/30 bg-[#3B82F6]/10"
                    style={{ borderLeftWidth: '4px', borderLeftColor: EVO_BLUE }}
                  >
                    <p className="text-white font-medium">Tarea: {(threadDetail.thread.assignmentId as any)?.titulo}</p>
                    <p className="text-white/70 text-sm mt-1">Entrega: {new Date((threadDetail.thread.assignmentId as any)?.fechaEntrega).toLocaleDateString('es')}</p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-2 border-[#3B82F6]/50 text-[#93C5FD] rounded-xl"
                      onClick={() => {
                      const aid = (threadDetail.thread as any).assignmentId?._id;
                      window.location.href = aid ? `/assignment/${aid}` : '/mi-aprendizaje/tareas';
                    }}
                    >
                      Ver tarea
                    </Button>
                  </div>
                )}
                {loadingThread ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="w-8 h-8 animate-spin text-white/50" />
                  </div>
                ) : displayThreadMessages.length === 0 ? (
                  <p className="text-center text-white/45 text-sm py-12">
                    {messages.length === 0
                      ? 'Sin mensajes en este hilo todavía.'
                      : inThreadQuery.trim()
                        ? 'Ningún mensaje coincide con la búsqueda.'
                        : 'No hay mensajes para esta vista. Cambia el filtro en la barra superior.'}
                  </p>
                ) : (
                  <div className="space-y-1 space-y-reverse flex flex-col-reverse">
                    <AnimatePresence initial={false}>
                      {[...displayThreadMessages].reverse().map((m) => {
                        const isMine = (m.remitenteId as any)?._id === user?.id;
                        const driveMeta =
                          m.tipo === 'evo_drive'
                            ? safeParseJson<{ name?: string; url?: string | null; fileId?: string }>(m.contenido)
                            : null;
                        const driveHost = (() => {
                          const raw = driveMeta?.url;
                          if (!raw) return null;
                          try {
                            return new URL(raw).host.replace(/^www\./, '');
                          } catch {
                            return null;
                          }
                        })();
                        const linkMeta =
                          m.tipo === 'evo_link'
                            ? safeParseJson<{ url?: string; title?: string }>(m.contenido)
                            : null;
                        const remMeta =
                          m.tipo === 'assignment_reminder'
                            ? safeParseJson<{
                                title?: string;
                                dueAt?: string;
                                url?: string;
                                description?: string;
                                accent?: string;
                                attachments?: { name?: string; url?: string }[];
                              }>(m.contenido)
                            : null;
                        const remAccent =
                          m.tipo === 'assignment_reminder' && remMeta?.accent
                            ? remMeta.accent
                            : accent;
                        return (
                          <motion.div
                            key={m._id}
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -12 }}
                            className={`flex flex-col gap-1 ${isMine ? 'items-end' : 'items-start'}`}
                          >
                            {m.tipo === 'evo_link' && linkMeta?.url ? (
                              <button
                                type="button"
                                onClick={() => window.open(linkMeta.url, '_blank')}
                                className="max-w-[78%] rounded-2xl px-4 py-3 text-left border border-white/10 bg-white/[0.06]"
                              >
                                {!isMine && (
                                  <p className="text-[#93C5FD] text-xs font-medium mb-1">
                                    {(m.remitenteId as { nombre?: string })?.nombre}
                                  </p>
                                )}
                                <p className="text-[11px] uppercase tracking-wide text-white/55">Enlace</p>
                                <p className="text-sm font-semibold text-[#3B82F6] mt-0.5 truncate">
                                  {linkMeta.title || linkMeta.url}
                                </p>
                                <p className="text-[10px] text-white/45 mt-1 truncate">{linkMeta.url}</p>
                              </button>
                            ) : m.tipo === 'evo_drive' ? (
                              <button
                                type="button"
                                onClick={() => {
                                  const url = driveMeta?.url;
                                  if (url) {
                                    window.open(url, '_blank');
                                  } else if (driveMeta?.fileId) {
                                    window.location.href = `/evo-drive?openFile=${encodeURIComponent(driveMeta.fileId)}`;
                                  }
                                }}
                                className="max-w-[78%] w-[520px] rounded-2xl px-5 py-4 text-left transition-colors"
                                style={{
                                  background: `linear-gradient(180deg, rgba(2,6,23,0.62), rgba(2,6,23,0.42))`,
                                  borderLeftWidth: 4,
                                  borderLeftColor: accent,
                                  boxShadow:
                                    'inset 0 0 0 1px rgba(255,255,255,0.10), 0 10px 30px rgba(0,0,0,0.28)',
                                }}
                              >
                                <div className="flex items-start justify-between gap-4">
                                  <div className="min-w-0 flex-1">
                                    {!isMine && (
                                      <p className="text-[#93C5FD] text-xs font-medium mb-1">
                                        {(m.remitenteId as any)?.nombre}
                                      </p>
                                    )}
                                    <p className="text-[11px] uppercase tracking-[0.14em] text-white/55">Evo Drive</p>
                                    <p className="text-base font-semibold text-white truncate mt-1">
                                      {driveMeta?.name || 'Archivo'}
                                    </p>
                                    <div className="flex items-center gap-2 mt-1.5 text-[12px] text-white/55">
                                      {driveHost ? (
                                        <span className="truncate">{driveHost}</span>
                                      ) : (
                                        <span className="truncate">Evo Drive</span>
                                      )}
                                      <span className="text-white/25">•</span>
                                      <span className="truncate">Archivo adjunto</span>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-3 flex-shrink-0">
                                    <div className="h-10 w-10 rounded-full flex items-center justify-center">
                                      <Cloud className="w-5 h-5" style={{ color: accent }} />
                                    </div>
                                    <div className="flex flex-col items-end leading-tight">
                                      <span className="text-[12px] font-medium text-white/85">Abrir</span>
                                      <span className="text-[10px] text-white/45">Ver adjunto</span>
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 mt-3 justify-end">
                                  <span className="text-white/50 text-[10px]">
                                    {new Date(m.fecha).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                </div>
                              </button>
                            ) : m.tipo === 'assignment_reminder' ? (
                              <button
                                type="button"
                                onClick={() => {
                                  const url = remMeta?.url;
                                  if (url) window.location.href = url;
                                }}
                                className="max-w-[75%] w-[460px] rounded-2xl px-4 py-3 shadow-md text-left border border-white/[0.10]"
                                style={{
                                  background: `linear-gradient(180deg, rgba(2,6,23,0.6), color-mix(in srgb, ${remAccent} 14%, transparent))`,
                                  borderLeftWidth: 4,
                                  borderLeftColor: remAccent,
                                }}
                              >
                                {!isMine && (
                                  <p className="text-[#93C5FD] text-xs font-medium mb-1">{(m.remitenteId as any)?.nombre}</p>
                                )}
                                <div className="flex items-center justify-between gap-3">
                                  <div className="min-w-0">
                                    <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/55">
                                      Recordatorio
                                    </p>
                                    <p className="text-sm font-semibold text-white truncate mt-0.5">
                                      {remMeta?.title || 'Tarea'}
                                    </p>
                                    {remMeta?.description ? (
                                      <p className="text-[11px] text-white/65 mt-1 line-clamp-3 whitespace-pre-wrap">
                                        {remMeta.description}
                                      </p>
                                    ) : null}
                                    {remMeta?.dueAt && (
                                      <p className="text-[11px] text-white/60 mt-1">
                                        Entrega:{' '}
                                        {new Date(remMeta.dueAt).toLocaleString('es', {
                                          day: '2-digit',
                                          month: 'short',
                                          hour: '2-digit',
                                          minute: '2-digit',
                                        })}
                                      </p>
                                    )}
                                    {Array.isArray(remMeta?.attachments) && remMeta.attachments.length > 0 ? (
                                      <p className="text-[10px] text-white/50 mt-1.5">
                                        Adjuntos:{' '}
                                        {remMeta.attachments
                                          .map((a) => (a?.name || a?.url || '').trim())
                                          .filter(Boolean)
                                          .slice(0, 4)
                                          .join(' · ')}
                                        {remMeta.attachments.length > 4 ? '…' : ''}
                                      </p>
                                    ) : null}
                                  </div>
                                  <div className="flex items-center gap-2 flex-shrink-0">
                                    <Bell className="w-5 h-5" style={{ color: remAccent }} />
                                    <span className="text-xs text-white/70">Ir</span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 mt-2 justify-end">
                                  <span className="text-white/50 text-[10px]">
                                    {new Date(m.fecha).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                </div>
                              </button>
                            ) : (
                              <div
                                className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${
                                  isMine
                                    ? 'rounded-br-md text-white'
                                    : 'rounded-bl-md bg-white/[0.06] text-[#E2E8F0] border border-white/[0.08]'
                                }`}
                                style={
                                  isMine
                                    ? {
                                        background: `color-mix(in srgb, ${accent} 25%, rgba(15,23,42,0.65))`,
                                        border: `1px solid color-mix(in srgb, ${accent} 35%, transparent)`,
                                        borderRadius: '12px 12px 4px 12px',
                                      }
                                    : { borderLeftWidth: 3, borderLeftColor: accent }
                                }
                              >
                                {!isMine && (
                                  <p className="text-[#93C5FD] text-xs font-medium mb-0.5">
                                    {(m.remitenteId as any)?.nombre}
                                  </p>
                                )}
                                <p className="whitespace-pre-wrap break-words text-sm">{m.contenido}</p>
                                <div className="flex items-center gap-2 mt-1 justify-end">
                                  {m.prioridad === 'urgente' && (
                                    <Badge variant="destructive" className="text-[10px] px-1">
                                      Urgente
                                    </Badge>
                                  )}
                                  {m.prioridad === 'alta' && (
                                    <Badge className="bg-amber-500/20 text-amber-400 text-[10px] px-1">Alta</Badge>
                                  )}
                                  <span className="text-white/50 text-[10px]">
                                    {new Date(m.fecha).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                </div>
                              </div>
                            )}
                            {isMine && showThreadReads && threadReads != null && (
                              <div className="max-w-[75%] w-full flex flex-col items-end gap-1">
                                <button
                                  type="button"
                                  onClick={() => setReadsExpanded((v) => !v)}
                                  className="text-[11px] text-white/55 hover:text-white/80 transition-colors text-left"
                                >
                                  <Eye className="w-3 h-3 inline-block mr-1 opacity-70 align-middle" />
                                  Leído por {threadReads.opened_count}/{threadReads.total_students} estudiantes
                                </button>
                                {readsExpanded && (
                                  <div className="w-full max-w-sm rounded-lg border border-white/10 bg-black/25 p-2 text-[11px] text-white/80 max-h-40 overflow-y-auto space-y-1.5">
                                    {threadReads.students.length === 0 ? (
                                      <p className="text-white/50">Nadie ha abierto este hilo aún.</p>
                                    ) : (
                                      threadReads.students.map((s) => (
                                        <div key={s.student_id} className="flex justify-between gap-2">
                                          <span className="truncate">{s.full_name}</span>
                                          <span className="text-white/50 shrink-0 tabular-nums">
                                            {new Date(s.opened_at).toLocaleString('es-CO', {
                                              day: '2-digit',
                                              month: 'short',
                                              hour: '2-digit',
                                              minute: '2-digit',
                                            })}
                                          </span>
                                        </div>
                                      ))
                                    )}
                                  </div>
                                )}
                              </div>
                            )}
                          </motion.div>
                        );
                      })}
                    </AnimatePresence>
                  </div>
                )}
                  </>
                )}
              </div>
              {!messagingBlocked ? (
              <div className="flex-shrink-0 flex flex-col gap-0">
                {studentComposerBlocked ? (
                  <div className="px-4 pt-2 pb-1 shrink-0 max-h-[30vh] overflow-y-auto">
                    <Alert className="border-amber-500/40 bg-amber-500/10 text-amber-100 [&>svg]:text-amber-200">
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle className="text-sm font-semibold text-amber-50">
                        Horario de chat para estudiantes
                      </AlertTitle>
                      <AlertDescription className="text-xs text-amber-100/90">
                        Solo puedes enviar mensajes en los chats de grupo entre las 7:00 y las 18:59
                        {writeWindowTimezone ? ` (${writeWindowTimezone})` : ''}. Fuera de ese horario el envío no está disponible.
                      </AlertDescription>
                    </Alert>
                  </div>
                ) : null}
                <div className="min-h-[72px] px-4 sm:px-5 flex flex-wrap items-center gap-2 shrink-0 py-2" style={chatComposerBarStyle}>
                <EvoComposeAttachmentBar
                  disabled={composerDisabled}
                  onOpenDrive={() => setShowDrivePicker(true)}
                  showReminder={!!cursoIdForThread}
                  onOpenReminder={() => setShowReminderPicker(true)}
                  onCreateDoc={() => googleCreateMutation.mutate('doc')}
                  onCreateSheet={() => googleCreateMutation.mutate('sheet')}
                  onCreateSlide={() => googleCreateMutation.mutate('slide')}
                  onAttachLink={() => setShowLinkDialog(true)}
                  createPending={googleCreateMutation.isPending}
                />
                <div
                  className="flex-1 relative h-11 rounded-[10px] flex items-center px-4 transition-all min-w-0"
                  style={{
                    background: 'rgba(255,255,255,0.06)',
                    border: composerFocused
                      ? `1px solid color-mix(in srgb, ${accent} 50%, transparent)`
                      : '1px solid rgba(255,255,255,0.1)',
                    boxShadow: composerFocused ? `0 0 12px color-mix(in srgb, ${accent} 18%, transparent)` : 'none',
                  }}
                >
                  <Textarea
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    onFocus={() => {
                      setComposerFocused(true);
                      if (selectedIdForTyping && !composerDisabled) {
                        emitTyping(selectedIdForTyping, user?.nombre);
                      }
                    }}
                    onBlur={() => setComposerFocused(false)}
                    placeholder="Escribe un mensaje o usa @ para mencionar..."
                    disabled={composerDisabled}
                    rows={1}
                    className="flex-1 bg-transparent border-0 shadow-none focus-visible:ring-0 text-[14px] text-[#E2E8F0] placeholder:text-white/35 min-h-[36px] max-h-28 resize-none py-2 disabled:opacity-50"
                  />
                </div>
                <Button
                  type="button"
                  onClick={onSendReply}
                  disabled={!replyText.trim() || sendReplyMutation.isPending || composerDisabled}
                  style={{
                    background: accent,
                    boxShadow: `0 0 16px color-mix(in srgb, ${accent} 35%, transparent)`,
                  }}
                  className="w-10 h-10 shrink-0 rounded-full text-white border-0 p-0 hover:opacity-95"
                >
                  {sendReplyMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </Button>
                </div>
              </div>
              ) : null}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center flex-1 min-h-0 overflow-hidden text-white/50 py-12 px-4">
              <Inbox className="w-16 h-16 mb-4 shrink-0" style={{ color: EVO_BLUE }} />
              <p className="text-lg text-center">Selecciona un chat para ver la conversación.</p>
            </div>
          )}
        </div>
      </div>
      {/* Picker Evo Drive */}
      <Dialog open={showDrivePicker} onOpenChange={setShowDrivePicker}>
        <DialogContent className="bg-[var(--mid-dark)] border-white/10 text-white max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {cursoIdForThread ? 'Adjuntar desde Evo Drive (curso)' : 'Adjuntar desde Mi carpeta (Evo Drive)'}
            </DialogTitle>
          </DialogHeader>
          <DrivePickerContent
            cursoId={cursoIdForThread}
            onSelect={(text) => {
              if (text) sendReplyMutation.mutate({ contentType: 'evo_drive', meta: safeParseJson(text) ?? {} });
              setShowDrivePicker(false);
            }}
          />
        </DialogContent>
      </Dialog>
      {/* Picker Recordatorios */}
      <Dialog open={showReminderPicker} onOpenChange={setShowReminderPicker}>
        <DialogContent className="bg-[var(--mid-dark)] border-white/10 text-white max-w-3xl">
          <DialogHeader>
            <DialogTitle>Enviar recordatorio de tarea</DialogTitle>
          </DialogHeader>
          <ReminderPickerContent
            cursoId={cursoIdForThread}
            onSelect={(text) => {
              if (text) sendReplyMutation.mutate({ contentType: 'assignment_reminder', meta: safeParseJson(text) ?? {} });
              setShowReminderPicker(false);
            }}
          />
        </DialogContent>
      </Dialog>
      <Dialog open={showLinkDialog} onOpenChange={setShowLinkDialog}>
        <DialogContent className="bg-[var(--mid-dark)] border-white/10 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle>Adjuntar enlace</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Input
              placeholder="Título (opcional)"
              value={linkTitle}
              onChange={(e) => setLinkTitle(e.target.value)}
              className="bg-white/10 border-white/10 text-white"
            />
            <Input
              placeholder="https://…"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              className="bg-white/10 border-white/10 text-white"
            />
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" className="border-white/20" onClick={() => setShowLinkDialog(false)}>
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={!linkUrl.trim() || composerDisabled}
              style={{ background: accent }}
              onClick={() => {
                const u = linkUrl.trim();
                if (!u) return;
                sendReplyMutation.mutate({
                  contentType: 'evo_link',
                  meta: { url: u, title: linkTitle.trim() || u },
                });
                setShowLinkDialog(false);
                setLinkUrl('');
                setLinkTitle('');
              }}
            >
              Adjuntar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

const SECTION_LABEL_STYLE = {
  fontSize: 10,
  fontWeight: 600,
  letterSpacing: '0.1em',
  color: 'rgba(255,255,255,0.25)',
  textTransform: 'uppercase' as const,
};

function filteredThreadsList(
  threads: EvoThreadItem[],
  selectedId: string | null,
  setSelectedId: (id: string | null) => void,
  searchQ?: string,
  sections?: { label: string; threads: EvoThreadItem[] }[] | null,
  getSectionCollapsed?: (label: string) => boolean,
  onToggleSection?: (label: string) => void,
  threadsEmptyHint?: string,
  listAccent: string = EVO_BLUE
) {
  const title = (t: EvoThreadItem) => t.displayTitle ?? t.asunto;
  const preview = (t: EvoThreadItem) => {
    const raw = t.ultimoMensaje?.contenido;
    if (!raw) return 'Sin mensajes';

    const trimmed = raw.trim();
    if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) return raw;

    const meta = safeParseJson<Record<string, unknown>>(trimmed);
    if (!meta) return raw;

    const maybeTitle = typeof meta.title === 'string' ? meta.title.trim() : '';
    if (maybeTitle) return maybeTitle;

    const maybeName = typeof meta.name === 'string' ? meta.name.trim() : '';
    if (maybeName) return maybeName;

    return raw;
  };
  const filterBySearch = (list: EvoThreadItem[]) =>
    !searchQ?.trim()
      ? list
      : list.filter((t) => (t.asunto ?? t.displayTitle ?? '').toLowerCase().includes(searchQ.trim().toLowerCase()));
  const sortByDate = (list: EvoThreadItem[]) =>
    [...list].sort((a, b) => {
      const dateA = a.ultimoMensaje?.fecha ? new Date(a.ultimoMensaje.fecha).getTime() : new Date(a.updatedAt).getTime();
      const dateB = b.ultimoMensaje?.fecha ? new Date(b.ultimoMensaje.fecha).getTime() : new Date(b.updatedAt).getTime();
      return dateB - dateA;
    });

  const renderThread = (t: EvoThreadItem) => {
    const isSelected = t._id === selectedId;
    const unreadN = t.unreadCount ?? 0;
    const hasUnread = unreadN > 0;
    const ac = threadAccent(t);
    const badgeColor = listAccent;
    return (
      <div
        key={t._id}
        onClick={() => setSelectedId(t._id)}
        className={`w-full min-h-[68px] shrink-0 px-3 rounded-[10px] cursor-pointer transition-all duration-150 flex items-center gap-3 ${
          isSelected ? '' : 'hover:bg-white/[0.04]'
        }`}
        style={{
          background: isSelected ? `color-mix(in srgb, ${listAccent} 15%, transparent)` : 'transparent',
          borderLeft: isSelected ? `3px solid ${listAccent}` : '3px solid transparent',
        }}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setSelectedId(t._id);
          }
        }}
      >
        <div
          className="w-[42px] h-[42px] rounded-full flex items-center justify-center flex-shrink-0"
          style={{
            background: `linear-gradient(145deg, color-mix(in srgb, ${ac} 45%, transparent), color-mix(in srgb, ${ac} 22%, transparent))`,
            border: `1px solid color-mix(in srgb, ${ac} 40%, transparent)`,
          }}
        >
          {(t.is_support || t.tipo === 'evo_chat_support') ? (
            <Shield className="w-5 h-5 text-white/95" style={{ color: ac }} />
          ) : (
            <img src={kiwiChatImg} alt="" className="w-8 h-8 rounded-full object-cover" draggable={false} />
          )}
        </div>
        <div className="flex-1 min-w-0 text-left">
          <p className={`text-[13px] font-semibold truncate ${hasUnread ? 'text-[#E2E8F0]' : 'text-white/90'}`}>
            {title(t)}
          </p>
          <p className="text-[12px] text-white/45 truncate">{preview(t)}</p>
        </div>
        <div className="flex flex-col items-end flex-shrink-0 gap-1">
          <span className="text-[10px] text-white/35">
            {new Date(t.updatedAt).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}
          </span>
          {hasUnread ? (
            <span
              className="min-w-[18px] h-[18px] flex items-center justify-center text-[10px] font-bold text-white rounded-full px-1"
              style={{ background: badgeColor }}
              title="Mensajes sin leer"
              aria-label={`${unreadN} mensajes sin leer`}
            >
              {unreadN > 99 ? '99+' : unreadN}
            </span>
          ) : null}
        </div>
      </div>
    );
  };

  if (sections && sections.length > 0) {
    const canToggle = getSectionCollapsed != null && onToggleSection != null;

    return (
      <>
        {sections.map((sec) => {
          const filtered = sortByDate(filterBySearch(sec.threads));
          const hasNoThreadsEver = sec.threads.length === 0;
          const q = searchQ?.trim();
          if (filtered.length === 0 && hasNoThreadsEver && !q) return null;
          const collapsed = canToggle ? getSectionCollapsed(sec.label) : false;

          return (
            <div key={sec.label}>
              {canToggle ? (
                <button
                  type="button"
                  onClick={() => onToggleSection(sec.label)}
                  className="w-full px-3 pt-3 pb-1 font-medium tracking-wider flex items-center gap-2 text-left hover:bg-white/[0.04] rounded transition-colors"
                  style={SECTION_LABEL_STYLE}
                  aria-expanded={!collapsed}
                >
                  {collapsed ? (
                    <ChevronRight className="w-3.5 h-3.5 flex-shrink-0 opacity-80" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5 flex-shrink-0 opacity-80" />
                  )}
                  <span className="flex-1 truncate">{sec.label}</span>
                  <span className="text-[10px] font-normal normal-case text-white/25 tabular-nums flex-shrink-0">
                    {sec.threads.length}
                  </span>
                </button>
              ) : (
                <p className="px-3 pt-3 pb-1 font-medium tracking-wider" style={SECTION_LABEL_STYLE}>
                  {sec.label}
                </p>
              )}
              {canToggle && collapsed && sec.threads.length > 0 ? (
                <p className="px-3 pb-2 text-[10px] text-white/40 leading-snug">
                  Toca la sección para desplegar {sec.threads.length}{' '}
                  {sec.threads.length === 1 ? 'conversación' : 'conversaciones'}.
                </p>
              ) : null}
              {!collapsed &&
                (filtered.length > 0 ? (
                  filtered.map((t) => renderThread(t))
                ) : (
                  <p className="px-3 pb-3 text-white/40 text-xs">Sin resultados en esta sección.</p>
                ))}
            </div>
          );
        })}
      </>
    );
  }

  return (
    <>
      {threads.map((t) => renderThread(t))}
      {threads.length === 0 && (
        <p className="p-4 text-white/50 text-center text-sm">
          {threadsEmptyHint?.trim()
            ? threadsEmptyHint
            : 'No hay chats. Tus grupos son tus cursos (profesor) o materias (estudiante).'}
        </p>
      )}
    </>
  );
}
