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
  Star,
  ChevronRight,
  ChevronDown,
  MessageSquare,
  ArrowLeft,
  Shield,
  Cloud,
  Bell,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { NavBackButton } from '@/components/nav-back-button';
import { motion, AnimatePresence } from 'framer-motion';
import { generateCourseColor } from '@/lib/courseColor';

const EVO_BLUE = '#3B82F6';
const EVO_PANEL =
  'rounded-2xl border border-white/[0.06] bg-slate-950/35 backdrop-blur-xl overflow-hidden shadow-lg shadow-black/20';

function threadAccent(t: EvoThreadItem): string {
  if (t.tipo === 'evo_chat' && t.cursoId?._id) return generateCourseColor(t.cursoId._id);
  if (t.is_support || t.tipo === 'evo_chat_support') return '#059669';
  if (t.tipo === 'evo_chat_staff') return '#7c3aed';
  if (t.tipo === 'evo_chat_direct') return '#0891b2';
  return EVO_BLUE;
}

type ThreadType = 'comunicado_general' | 'curso' | 'asignacion' | 'asistencia' | 'general' | 'evo_chat' | 'evo_chat_staff' | 'evo_chat_direct' | 'evo_chat_support';

interface EvoThreadItem {
  _id: string;
  asunto: string;
  displayTitle?: string;
  tipo: ThreadType;
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
  thread: EvoThreadItem & { assignmentId?: { titulo: string; descripcion?: string; fechaEntrega: string } };
  messages: EvoMessageItem[];
}

const tipoLabels: Record<string, string> = {
  comunicado_general: 'Comunicado general',
  curso: 'Curso',
  asignacion: 'Tarea',
  asistencia: 'Asistencia',
  general: 'General',
  evo_chat: 'Chat',
  evo_chat_staff: 'Grupos',
  evo_chat_direct: 'Chat directo',
  evo_chat_support: 'Soporte GLC',
};

const tipoIcons: Record<string, React.ReactNode> = {
  comunicado_general: <Users className="w-4 h-4" />,
  curso: <BookOpen className="w-4 h-4" />,
  asignacion: <FileText className="w-4 h-4" />,
  asistencia: <AlertCircle className="w-4 h-4" />,
  general: <Inbox className="w-4 h-4" />,
  evo_chat: <MessageSquare className="w-4 h-4" />,
  evo_chat_staff: <Users className="w-4 h-4" />,
  evo_chat_direct: <MessageSquare className="w-4 h-4" />,
  evo_chat_support: <Shield className="w-4 h-4" />,
};

export default function EvoSendPage() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const token = typeof window !== 'undefined' ? localStorage.getItem('autoclose_token') : null;
  const { connected, joinThread, emitTyping, lastMessage, typing, clearLastMessage, clearTyping } = useEvoSocket(token);
  const processedSocketMsgIds = useRef<Set<string>>(new Set());

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [filterTipo, setFilterTipo] = useState<string>('all');
  const [searchQ, setSearchQ] = useState('');
  const [newMessageOpen, setNewMessageOpen] = useState(false);
  const [newAsunto, setNewAsunto] = useState('');
  const [newContenido, setNewContenido] = useState('');
  const [newTipo, setNewTipo] = useState<'comunicado_general' | 'curso'>('comunicado_general');
  const [newCursoId, setNewCursoId] = useState('');
  const [newPrioridad, setNewPrioridad] = useState<'normal' | 'alta' | 'urgente'>('normal');

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

  const isProfesorOrEstudiante = ['profesor', 'estudiante'].includes(user?.rol || '');
  const canCreateThread = !isProfesorOrEstudiante && ['directivo', 'admin-general-colegio'].includes(user?.rol || '');
  const isAsistente = user?.rol === 'asistente';
  const isAdminColegio = user?.rol === 'admin-general-colegio';
  const [adminChatsGlcCollapsed, setAdminChatsGlcCollapsed] = useState(true);

  type ThreadsResponse =
    | EvoThreadItem[]
    | {
        mis_cursos?: EvoThreadItem[];
        colegas: EvoThreadItem[];
        directos?: EvoThreadItem[];
        support_thread?: (EvoThreadItem & { is_support: true }) | null;
      }
    | { threads: EvoThreadItem[]; support_thread?: (EvoThreadItem & { is_support: true }) | null }
    | {
        chats_glc: { evo_chat: EvoThreadItem[]; evo_chat_staff: EvoThreadItem[]; evo_chat_direct: EvoThreadItem[] };
        soporte: EvoThreadItem[];
      };

  const { data: threadsData, isLoading: loadingThreads } = useQuery({
    queryKey: ['/api/evo-send/threads', filterTipo],
    queryFn: () => {
      const params = new URLSearchParams();
      if (filterTipo && filterTipo !== 'all') params.set('tipo', filterTipo);
      return apiRequest<ThreadsResponse>('GET', `/api/evo-send/threads?${params.toString()}`);
    },
  });

  const { threads: threadsFlat, sections } = useMemo(() => {
    const raw = threadsData;
    if (raw == null) return { threads: [] as EvoThreadItem[], sections: null as null };

    if (Array.isArray(raw)) {
      return { threads: raw, sections: null as null };
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
      };
    }

    if ('threads' in raw && Array.isArray(raw.threads)) {
      const list = raw.threads as EvoThreadItem[];
      const support = raw.support_thread;
      if (support) {
        return {
          threads: [support, ...list],
          sections: [
            { label: 'Soporte', threads: [support] },
            { label: 'Mensajes', threads: list },
          ],
        };
      }
      return { threads: list, sections: null };
    }

    const misCursosRaw = (raw as { mis_cursos?: EvoThreadItem[] }).mis_cursos ?? [];
    const colegas = (raw as { colegas: EvoThreadItem[] }).colegas ?? [];
    const directos = (raw as { directos?: EvoThreadItem[] }).directos ?? [];
    const support_thread = (raw as { support_thread?: (EvoThreadItem & { is_support: true }) | null }).support_thread;
    // Deduplicar chats de curso por cursoId (o título) para evitar dobles cuando hay datos legacy.
    const seenCourseKeys = new Set<string>();
    const misCursos = misCursosRaw.filter((t) => {
      const key = t.cursoId?._id || t.displayTitle || t.asunto || t._id;
      if (seenCourseKeys.has(key)) return false;
      seenCourseKeys.add(key);
      return true;
    });
    const flat = [...misCursos, ...colegas, ...directos];
    if (support_thread) {
      const withSupport = [support_thread, ...flat];
      if (user?.rol === 'profesor') {
        return {
          threads: withSupport,
          sections: [
            { label: 'Soporte', threads: [support_thread] },
            { label: 'Mis cursos', threads: misCursos },
            { label: 'Colegas', threads: colegas },
          ],
        };
      }
      if (user?.rol === 'directivo') {
        return {
          threads: withSupport,
          sections: [
            { label: 'Soporte', threads: [support_thread] },
            { label: 'Grupos', threads: colegas },
            { label: 'Colegas', threads: directos },
          ],
        };
      }
      return { threads: withSupport, sections: [{ label: 'Soporte', threads: [support_thread] }] };
    }

    if (user?.rol === 'profesor') {
      return {
        threads: flat,
        sections: [
          { label: 'Mis cursos', threads: misCursos },
          { label: 'Colegas', threads: colegas },
        ],
      };
    }
    if (user?.rol === 'directivo') {
      return {
        threads: flat,
        sections: [
          { label: 'Grupos', threads: colegas },
          { label: 'Colegas', threads: directos },
        ],
      };
    }
    return { threads: flat, sections: null };
  }, [threadsData, user?.rol]);

  const { data: threadDetail, isLoading: loadingThread } = useQuery({
    queryKey: ['/api/evo-send/threads', selectedId],
    queryFn: () => apiRequest<ThreadDetail>('GET', `/api/evo-send/threads/${selectedId}`),
    enabled: !!selectedId,
  });

  const { data: courses = [] } = useQuery({
    queryKey: ['/api/evo-send/courses'],
    queryFn: () => apiRequest<{ _id: string; nombre: string }[]>('GET', '/api/evo-send/courses'),
    enabled: canCreateThread && newMessageOpen,
  });

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
        prioridad: newPrioridad,
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

  const createThreadMutation = useMutation({
    mutationFn: (body: {
      asunto: string;
      contenido: string;
      tipo: string;
      cursoId?: string;
      prioridad?: string;
    }) => apiRequest('POST', '/api/evo-send/threads', body),
    onSuccess: () => {
      setNewMessageOpen(false);
      setNewAsunto('');
      setNewContenido('');
      setNewCursoId('');
      queryClient.invalidateQueries({ queryKey: ['/api/evo-send/threads'] });
    },
  });

  useEffect(() => {
    if (selectedId) {
      joinThread(selectedId);
      markReadMutation.mutate(selectedId);
    } else {
      joinThread(null);
    }
  }, [selectedId]);

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
        const keep = [...processedSocketMsgIds.current].slice(-200);
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

  const filteredThreads = searchQ.trim()
    ? threadsFlat.filter((t) => (t.asunto ?? t.displayTitle ?? '').toLowerCase().includes(searchQ.trim().toLowerCase()))
    : threadsFlat;

  const sortedThreads = useMemo(
    () =>
      [...filteredThreads].sort((a, b) => {
        const dateA = a.ultimoMensaje?.fecha ? new Date(a.ultimoMensaje.fecha).getTime() : new Date(a.updatedAt).getTime();
        const dateB = b.ultimoMensaje?.fecha ? new Date(b.ultimoMensaje.fecha).getTime() : new Date(b.updatedAt).getTime();
        return dateB - dateA;
      }),
    [filteredThreads]
  );

  const selectedThread = threadsFlat.find((t) => t._id === selectedId);
  const messages = threadDetail?.messages || [];

  const handleSendReply = () => {
    if (!replyText.trim() || !selectedId) return;
    sendReplyMutation.mutate({ contentType: 'texto', contenido: replyText.trim() });
  };

  const handleCreateThread = () => {
    if (!newAsunto.trim() || !newContenido.trim()) return;
    createThreadMutation.mutate({
      asunto: newAsunto.trim(),
      contenido: newContenido.trim(),
      tipo: newTipo,
      cursoId: newTipo === 'curso' ? newCursoId || undefined : undefined,
      prioridad: newPrioridad,
    });
  };

  return (
    <div className="p-3 sm:p-5 md:p-6 flex flex-col min-h-screen w-full max-w-[1820px] mx-auto">
      <div className="flex-shrink-0 mb-4">
        {back.label === 'Volver al curso' ? (
          <Button
            variant="ghost"
            onClick={() => setLocation(back.to)}
            className="flex items-center gap-2 text-[#3B82F6] hover:text-[#2563EB] hover:bg-white/5 transition-colors duration-200 mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm font-medium">Volver al curso</span>
          </Button>
        ) : (
          <NavBackButton to={back.to} label={back.label} />
        )}
        <div className="flex items-center gap-3 mt-3">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center shadow-lg"
            style={{ background: 'linear-gradient(145deg, #3B82F6, #1E40AF)' }}
          >
            <Send className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-[#E2E8F0] font-['Poppins']">Evo Send</h1>
            <p className="text-white/60 text-sm">Comunicación y asignaciones en tiempo real</p>
          </div>
          {connected && (
            <Badge className="bg-[#3B82F6]/20 text-[#93C5FD] border-[#3B82F6]/30">En línea</Badge>
          )}
        </div>
      </div>

      <div className="flex-1 flex flex-col min-h-0 w-full" style={{ minHeight: 'calc(100vh - 160px)' }}>
      {isAsistente ? (
        <Tabs defaultValue="asistencia" className="space-y-4">
          <TabsList className="bg-white/10 border border-white/10">
            <TabsTrigger value="asistencia">Inbox Asistencia</TabsTrigger>
            <TabsTrigger value="mensajes">Mensajes</TabsTrigger>
          </TabsList>
          <TabsContent value="asistencia" className="mt-4">
            <AttendanceInbox />
          </TabsContent>
          <TabsContent value="mensajes" className="mt-4 flex-1 flex flex-col min-h-0">
        <EvoLayout
          threads={sortedThreads}
          selectedId={selectedId}
          setSelectedId={setSelectedId}
          selectedThread={selectedThread}
          messages={messages}
          threadDetail={threadDetail}
          user={user}
          replyText={replyText}
          setReplyText={setReplyText}
          onSendReply={handleSendReply}
          sendReplyMutation={sendReplyMutation}
          loadingThreads={loadingThreads}
          loadingThread={loadingThread}
          canCreateThread={false}
          onNewMessage={() => setNewMessageOpen(true)}
          searchQ={searchQ}
          setSearchQ={setSearchQ}
          filterTipo={filterTipo}
          setFilterTipo={setFilterTipo}
          showFilters={false}
          typing={typing}
          emitTyping={emitTyping}
          selectedIdForTyping={selectedId}
          sections={sections}
        />
          </TabsContent>
        </Tabs>
      ) : (
        <EvoLayout
          threads={sortedThreads}
          selectedId={selectedId}
          setSelectedId={setSelectedId}
          selectedThread={selectedThread}
          messages={messages}
          threadDetail={threadDetail}
          user={user}
          replyText={replyText}
          setReplyText={setReplyText}
          onSendReply={handleSendReply}
          sendReplyMutation={sendReplyMutation}
          loadingThreads={loadingThreads}
          loadingThread={loadingThread}
          canCreateThread={canCreateThread}
          onNewMessage={() => setNewMessageOpen(true)}
          searchQ={searchQ}
          setSearchQ={setSearchQ}
          filterTipo={filterTipo}
          setFilterTipo={setFilterTipo}
          showFilters={!isProfesorOrEstudiante}
          typing={typing}
          emitTyping={emitTyping}
          selectedIdForTyping={selectedId}
          sections={sections}
          chatsGlcCollapsed={isAdminColegio ? adminChatsGlcCollapsed : undefined}
          onToggleChatsGlc={isAdminColegio ? () => setAdminChatsGlcCollapsed((c) => !c) : undefined}
        />
      )}
      </div>

      <Dialog open={newMessageOpen} onOpenChange={setNewMessageOpen}>
        <DialogContent className="bg-[var(--mid-dark)] border-white/10 text-white">
          <DialogHeader>
            <DialogTitle>Nuevo mensaje</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Asunto</Label>
              <Input
                value={newAsunto}
                onChange={(e) => setNewAsunto(e.target.value)}
                className="bg-white/10 border-white/10 mt-1"
                placeholder="Asunto del mensaje"
              />
            </div>
            <div>
              <Label>Tipo</Label>
              <Select value={newTipo} onValueChange={(v: 'comunicado_general' | 'curso') => setNewTipo(v)}>
                <SelectTrigger className="bg-white/10 border-white/10 mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {user?.rol === 'directivo' && (
                    <SelectItem value="comunicado_general">Comunicado general</SelectItem>
                  )}
                  {user?.rol === 'profesor' && (
                    <>
                      <SelectItem value="curso">Por curso</SelectItem>
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>
            {newTipo === 'curso' && (
              <div>
                <Label>Curso</Label>
                <Select value={newCursoId} onValueChange={setNewCursoId}>
                  <SelectTrigger className="bg-white/10 border-white/10 mt-1">
                    <SelectValue placeholder="Seleccionar curso" />
                  </SelectTrigger>
                  <SelectContent>
                    {courses.map((c) => (
                      <SelectItem key={c._id} value={c._id}>
                        {c.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label>Mensaje</Label>
              <Textarea
                value={newContenido}
                onChange={(e) => setNewContenido(e.target.value)}
                className="bg-white/10 border-white/10 mt-1 min-h-[120px]"
                placeholder="Escribe tu mensaje..."
              />
            </div>
            <div>
              <Label>Prioridad</Label>
              <Select value={newPrioridad} onValueChange={(v: 'normal' | 'alta' | 'urgente') => setNewPrioridad(v)}>
                <SelectTrigger className="bg-white/10 border-white/10 mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="alta">Alta</SelectItem>
                  <SelectItem value="urgente">Urgente</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewMessageOpen(false)} className="border-white/20">
              Cancelar
            </Button>
            <Button
              onClick={handleCreateThread}
              disabled={!newAsunto.trim() || !newContenido.trim() || createThreadMutation.isPending}
              style={{ background: 'linear-gradient(180deg, #3B82F6, #1D4ED8)' }}
            >
              {createThreadMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Enviar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
    <Card className={EVO_PANEL}>
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <AlertCircle className="w-5 h-5" style={{ color: EVO_BLUE }} />
          Registros de asistencia
        </CardTitle>
        <p className="text-white/60 text-sm">Todos los registros en tiempo real</p>
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
  sendReplyMutation: { mutate: (s: string) => void; isPending: boolean };
  loadingThreads: boolean;
  loadingThread: boolean;
  canCreateThread: boolean;
  onNewMessage: () => void;
  searchQ: string;
  setSearchQ: (s: string) => void;
  filterTipo: string;
  setFilterTipo: (s: string) => void;
  showFilters?: boolean;
  typing: { userId?: string; userName?: string; threadId?: string } | null;
  emitTyping: (threadId: string, userName?: string) => void;
  selectedIdForTyping: string | null;
  sections?: { label: string; threads: EvoThreadItem[] }[] | null;
  chatsGlcCollapsed?: boolean;
  onToggleChatsGlc?: () => void;
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

function DrivePickerContent({ cursoId, onSelect }: DrivePickerContentProps) {
  const { data: files = [], isLoading } = useQuery<EvoDriveFile[]>({
    queryKey: ['evo-drive', 'files-for-evo-send', cursoId],
    queryFn: () =>
      apiRequest<EvoDriveFile[]>(
        `GET`,
        `/api/evo-drive/files?cursoId=${encodeURIComponent(cursoId || '')}`
      ),
    enabled: !!cursoId,
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

  if (!files.length) {
    return (
      <p className="text-white/60 text-sm">
        No hay archivos en Evo Drive para este curso todavía.
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
  searchQ,
  setSearchQ,
  filterTipo,
  setFilterTipo,
  showFilters = true,
  typing,
  emitTyping,
  selectedIdForTyping,
  sections,
  chatsGlcCollapsed,
  onToggleChatsGlc,
}: EvoLayoutProps) {
  const [showDrivePicker, setShowDrivePicker] = useState(false);
  const [showReminderPicker, setShowReminderPicker] = useState(false);
  const cursoIdForThread = selectedThread?.cursoId?._id as string | undefined;

  const accent = selectedThread ? threadAccent(selectedThread) : EVO_BLUE;
  return (
    <div className="grid grid-cols-1 xl:grid-cols-[minmax(300px,360px)_minmax(0,1fr)] gap-5 flex-1 min-h-0 h-full w-full">
      <div className="flex flex-col min-h-0 min-w-0">
        <div className={`${EVO_PANEL} flex flex-col h-full min-h-0`}>
          <div className="p-4 border-b border-white/10 space-y-2 flex-shrink-0">
            {canCreateThread && (
              <Button
                className="w-full rounded-xl"
                style={{ background: 'linear-gradient(180deg, #3B82F6, #1D4ED8)' }}
                onClick={onNewMessage}
              >
                <Send className="w-4 h-4 mr-2" />
                Nuevo mensaje
              </Button>
            )}
            {showFilters && (
              <>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/50" />
                  <Input
                    placeholder="Buscar..."
                    value={searchQ}
                    onChange={(e) => setSearchQ(e.target.value)}
                    className="pl-10 bg-white/[0.06] border-white/[0.08] text-[#E2E8F0] rounded-xl"
                  />
                </div>
                <Select value={filterTipo} onValueChange={setFilterTipo}>
                  <SelectTrigger className="bg-white/[0.06] border-white/[0.08] text-[#E2E8F0] rounded-xl">
                    <SelectValue placeholder="Tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {Object.entries(tipoLabels).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </>
            )}
          </div>
          <div className="flex-1 overflow-y-auto min-h-0">
            {loadingThreads ? (
              <div className="flex items-center justify-center p-8">
                <Loader2 className="w-8 h-8 animate-spin text-white/50" />
              </div>
            ) : (
              filteredThreadsList(threads, selectedId, setSelectedId, searchQ, sections, chatsGlcCollapsed, onToggleChatsGlc)
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-col min-h-0 min-w-0">
        <div className={`${EVO_PANEL} flex flex-col h-full min-h-0`}>
          {selectedThread ? (
            <>
              <div
                className="flex-shrink-0 border-b border-white/10 py-4 px-4"
                style={{ borderLeftWidth: 4, borderLeftColor: accent }}
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-white/60 text-sm">
                    {tipoIcons[selectedThread.tipo]}
                    <span className="ml-1">{tipoLabels[selectedThread.tipo]}</span>
                  </span>
                  {selectedThread.assignmentId && (
                    <Badge className="bg-[#3B82F6]/20 text-[#93C5FD] border-[#3B82F6]/30">Tarea</Badge>
                  )}
                </div>
                <h3 className="text-xl font-semibold text-[#E2E8F0]">{selectedThread.displayTitle ?? selectedThread.asunto}</h3>
                <p className="text-white/60 text-sm">
                  De: {(selectedThread.creadoPor as any)?.nombre} ({(selectedThread.creadoPor as any)?.rol})
                </p>
                {typing?.threadId === selectedId && typing?.userId !== user?.id && (
                  <p className="text-white/50 text-sm italic animate-pulse">{typing.userName || 'Alguien'} está escribiendo...</p>
                )}
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
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
                ) : (
                  <div className="space-y-1 flex flex-col">
                    <AnimatePresence mode="popLayout">
                      {messages.map((m) => {
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
                        const remMeta =
                          m.tipo === 'assignment_reminder'
                            ? safeParseJson<{ title?: string; dueAt?: string; url?: string }>(m.contenido)
                            : null;
                        return (
                          <motion.div
                            key={m._id}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}
                          >
                            {m.tipo === 'evo_drive' ? (
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
                                  background: `linear-gradient(180deg, rgba(2,6,23,0.6), color-mix(in srgb, ${accent} 14%, transparent))`,
                                  borderLeftWidth: 4,
                                  borderLeftColor: accent,
                                }}
                              >
                                {!isMine && (
                                  <p className="text-[#93C5FD] text-xs font-medium mb-1">{(m.remitenteId as any)?.nombre}</p>
                                )}
                                <div className="flex items-center justify-between gap-3">
                                  <div className="min-w-0">
                                    <p className="text-xs uppercase tracking-wide text-white/60">Recordatorio</p>
                                    <p className="text-sm font-semibold text-white truncate mt-0.5">
                                      {remMeta?.title || 'Tarea'}
                                    </p>
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
                                  </div>
                                  <div className="flex items-center gap-2 flex-shrink-0">
                                    <Bell className="w-5 h-5" style={{ color: accent }} />
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
                                className={`max-w-[75%] rounded-2xl px-4 py-2.5 shadow-md ${
                                  isMine
                                    ? 'rounded-br-md text-white'
                                    : 'rounded-bl-md bg-white/[0.06] text-[#E2E8F0] border border-white/[0.08]'
                                }`}
                                style={
                                  isMine
                                    ? {
                                        background: `linear-gradient(145deg, ${accent}, color-mix(in srgb, ${accent} 75%, #000))`,
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
                          </motion.div>
                        );
                      })}
                    </AnimatePresence>
                  </div>
                )}
              </div>
              <div className="flex-shrink-0 p-4 border-t border-white/10 flex gap-2">
                <div className="flex items-end gap-2 flex-1">
                  <div className="flex flex-col gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 rounded-full bg-white/[0.04] hover:bg-white/[0.08] text-[#E2E8F0]"
                      onClick={() => setShowDrivePicker(true)}
                      disabled={!cursoIdForThread}
                      title="Adjuntar desde Evo Drive"
                    >
                      <Cloud className="w-4 h-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 rounded-full bg-white/[0.04] hover:bg-white/[0.08] text-[#E2E8F0]"
                      onClick={() => setShowReminderPicker(true)}
                      disabled={!cursoIdForThread}
                      title="Enviar recordatorio de tarea"
                    >
                      <Bell className="w-4 h-4" />
                    </Button>
                  </div>
                  <Textarea
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    onFocus={() => selectedIdForTyping && emitTyping(selectedIdForTyping, user?.nombre)}
                    placeholder="Escribe tu respuesta..."
                    className="flex-1 bg-white/[0.06] border-white/[0.08] text-[#E2E8F0] placeholder:text-white/50 min-h-[56px] rounded-xl resize-none"
                  />
                </div>
                <Button
                  onClick={onSendReply}
                  disabled={!replyText.trim() || sendReplyMutation.isPending}
                  style={{
                    background: `linear-gradient(180deg, ${accent}, color-mix(in srgb, ${accent} 80%, #000))`,
                  }}
                  className="self-end rounded-xl text-white border-0"
                >
                  {sendReplyMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </Button>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center flex-1 text-white/50 py-16">
              <Inbox className="w-16 h-16 mb-4" style={{ color: EVO_BLUE }} />
              <p className="text-lg">Selecciona un hilo para ver la conversación.</p>
            </div>
          )}
        </div>
      </div>
      {/* Picker Evo Drive */}
      <Dialog open={showDrivePicker} onOpenChange={setShowDrivePicker}>
        <DialogContent className="bg-[var(--mid-dark)] border-white/10 text-white max-w-3xl">
          <DialogHeader>
            <DialogTitle>Adjuntar desde Evo Drive</DialogTitle>
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
    </div>
  );
}

const SECTION_LABEL_STYLE = { fontSize: 11, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase' as const };

function filteredThreadsList(
  threads: EvoThreadItem[],
  selectedId: string | null,
  setSelectedId: (id: string | null) => void,
  searchQ?: string,
  sections?: { label: string; threads: EvoThreadItem[] }[] | null,
  chatsGlcCollapsed?: boolean,
  onToggleChatsGlc?: () => void
) {
  const title = (t: EvoThreadItem) => t.displayTitle ?? t.asunto;
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

  const isChatsGlcSection = (label: string) => label === 'Chats GLC';
  const showCollapseForSection = (label: string) => isChatsGlcSection(label) && onToggleChatsGlc != null;

  const renderThread = (t: EvoThreadItem) => {
    const isSelected = t._id === selectedId;
    const hasUnread = (t.unreadCount ?? 0) > 0;
    const ac = threadAccent(t);
    return (
      <motion.div
        key={t._id}
        layout
        onClick={() => setSelectedId(t._id)}
        className={`p-3 border-b border-white/[0.06] cursor-pointer transition-all min-h-[72px] flex items-center gap-3 ${
          isSelected ? 'bg-white/[0.06] border-l-4' : 'hover:bg-white/[0.04] border-l-4 border-l-transparent'
        }`}
        style={isSelected ? { borderLeftColor: ac } : undefined}
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
          className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ring-2 ring-white/10"
          style={{
            background: `linear-gradient(145deg, color-mix(in srgb, ${ac} 45%, transparent), color-mix(in srgb, ${ac} 25%, #0f172a))`,
          }}
        >
          {(t.is_support || t.tipo === 'evo_chat_support') ? (
            <Shield className="w-6 h-6 text-white/95" style={{ color: ac }} />
          ) : (
            <MessageSquare className="w-6 h-6 text-white/95" style={{ color: ac }} />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className={`font-medium truncate ${hasUnread ? 'text-[#E2E8F0]' : 'text-white/90'}`}>{title(t)}</p>
          <p className="text-white/60 text-sm truncate mt-0.5">
            {t.ultimoMensaje?.contenido || 'Sin mensajes'}
          </p>
        </div>
        <div className="flex flex-col items-end flex-shrink-0 gap-1">
          <span className="text-white/40 text-xs">{new Date(t.updatedAt).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}</span>
          {hasUnread && (
            <span
              className="w-3 h-3 rounded-full bg-[#2563eb] flex-shrink-0 shadow-[0_0_10px_rgba(37,99,235,0.85)] ring-2 ring-[#60a5fa]/50 animate-pulse"
              title="Mensajes sin leer"
              aria-label="Mensajes sin leer"
            />
          )}
        </div>
      </motion.div>
    );
  };

  if (sections && sections.length > 0) {
    return (
      <>
        {sections.map((sec) => {
          const filtered = sortByDate(filterBySearch(sec.threads));
          const isCollapsible = showCollapseForSection(sec.label);
          const collapsed = isCollapsible && chatsGlcCollapsed === true;
          if (filtered.length === 0 && !isCollapsible) return null;
          return (
            <div key={sec.label}>
              {isCollapsible ? (
                <button
                  type="button"
                  onClick={onToggleChatsGlc}
                  className="w-full px-3 pt-3 pb-1 font-medium tracking-wider flex items-center gap-2 text-left hover:bg-white/[0.04] rounded transition-colors"
                  style={SECTION_LABEL_STYLE}
                  aria-expanded={!collapsed}
                >
                  {collapsed ? (
                    <ChevronRight className="w-3.5 h-3.5 flex-shrink-0" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5 flex-shrink-0" />
                  )}
                  {sec.label}
                </button>
              ) : (
                <p className="px-3 pt-3 pb-1 font-medium tracking-wider" style={SECTION_LABEL_STYLE}>
                  {sec.label}
                </p>
              )}
              {!collapsed && filtered.map((t) => renderThread(t))}
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
        <p className="p-4 text-white/50 text-center text-sm">No hay chats. Tus grupos son tus cursos (profesor) o materias (estudiante).</p>
      )}
    </>
  );
}
