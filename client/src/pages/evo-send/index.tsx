import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
  MessageSquare,
  ArrowLeft,
  Shield,
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

const EVO_BLUE = '#3B82F6';
const EVO_BLUE_DARK = '#1D4ED8';
const EVO_PANEL = 'panel-grades rounded-2xl border border-white/[0.08] overflow-hidden';

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
  const { connected, joinThread, emitTyping, lastMessage, lastRead, typing, clearLastMessage, clearTyping } = useEvoSocket(token);

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

    const misCursos = (raw as { mis_cursos?: EvoThreadItem[] }).mis_cursos ?? [];
    const colegas = (raw as { colegas: EvoThreadItem[] }).colegas ?? [];
    const directos = (raw as { directos?: EvoThreadItem[] }).directos ?? [];
    const support_thread = (raw as { support_thread?: (EvoThreadItem & { is_support: true }) | null }).support_thread;
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
    mutationFn: (contenido: string) =>
      apiRequest('POST', `/api/evo-send/threads/${selectedId}/messages`, { contenido, prioridad: newPrioridad }),
    onSuccess: () => {
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
    const m = lastMessage as { threadId?: string };
    if (m.threadId && m.threadId === selectedId) {
      queryClient.invalidateQueries({ queryKey: ['/api/evo-send/threads', selectedId!] });
      queryClient.invalidateQueries({ queryKey: ['/api/evo-send/threads'] });
    }
    clearLastMessage();
  }, [lastMessage, selectedId]);

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
    sendReplyMutation.mutate(replyText.trim());
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
    <div className="p-4 sm:p-6 flex flex-col min-h-screen">
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

      <div className="flex-1 flex flex-col min-h-0" style={{ minHeight: 'calc(100vh - 180px)' }}>
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
}: EvoLayoutProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 flex-1 min-h-0 h-full">
      <div className="lg:col-span-4 flex flex-col min-h-0">
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
              filteredThreadsList(threads, selectedId, setSelectedId, searchQ, sections)
            )}
          </div>
        </div>
      </div>

      <div className="lg:col-span-8 flex flex-col min-h-0">
        <div className={`${EVO_PANEL} flex flex-col h-full min-h-0`}>
          {selectedThread ? (
            <>
              <div className="flex-shrink-0 border-b border-white/10 py-4 px-4">
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
                        return (
                          <motion.div
                            key={m._id}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}
                          >
                            <div
                              className={`max-w-[75%] rounded-2xl px-4 py-2.5 shadow-md ${
                                isMine
                                  ? 'rounded-br-md text-white'
                                  : 'rounded-bl-md bg-white/[0.08] text-[#E2E8F0] border border-white/[0.08]'
                              }`}
                              style={isMine ? { background: 'linear-gradient(145deg, #3B82F6, #1D4ED8)' } : undefined}
                            >
                              {!isMine && (
                                <p className="text-[#93C5FD] text-xs font-medium mb-0.5">{(m.remitenteId as any)?.nombre}</p>
                              )}
                              <p className="whitespace-pre-wrap break-words text-sm">{m.contenido}</p>
                              <div className="flex items-center gap-2 mt-1 justify-end">
                                {m.prioridad === 'urgente' && <Badge variant="destructive" className="text-[10px] px-1">Urgente</Badge>}
                                {m.prioridad === 'alta' && <Badge className="bg-amber-500/20 text-amber-400 text-[10px] px-1">Alta</Badge>}
                                <span className="text-white/50 text-[10px]">{new Date(m.fecha).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}</span>
                              </div>
                            </div>
                          </motion.div>
                        );
                      })}
                    </AnimatePresence>
                  </div>
                )}
              </div>
              <div className="flex-shrink-0 p-4 border-t border-white/10 flex gap-2">
                <Textarea
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  onFocus={() => selectedIdForTyping && emitTyping(selectedIdForTyping, user?.nombre)}
                  placeholder="Escribe tu respuesta..."
                  className="flex-1 bg-white/[0.06] border-white/[0.08] text-[#E2E8F0] placeholder:text-white/50 min-h-[56px] rounded-xl resize-none"
                />
                <Button
                  onClick={onSendReply}
                  disabled={!replyText.trim() || sendReplyMutation.isPending}
                  style={{ background: 'linear-gradient(180deg, #3B82F6, #1D4ED8)' }}
                  className="self-end rounded-xl"
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
    </div>
  );
}

const SECTION_LABEL_STYLE = { fontSize: 11, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase' as const };

function filteredThreadsList(
  threads: EvoThreadItem[],
  selectedId: string | null,
  setSelectedId: (id: string | null) => void,
  searchQ?: string,
  sections?: { label: string; threads: EvoThreadItem[] }[] | null
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

  const renderThread = (t: EvoThreadItem) => {
    const isSelected = t._id === selectedId;
    const hasUnread = (t.unreadCount ?? 0) > 0;
    return (
      <motion.div
        key={t._id}
        layout
        onClick={() => setSelectedId(t._id)}
        className={`p-3 border-b border-white/[0.06] cursor-pointer transition-all min-h-[72px] flex items-center gap-3 ${
          isSelected ? 'bg-[#3B82F6]/15 border-l-4' : 'hover:bg-white/[0.04]'
        }`}
        style={isSelected ? { borderLeftColor: EVO_BLUE } : undefined}
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
          className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ background: 'linear-gradient(145deg, rgba(59, 130, 246, 0.4), rgba(30, 64, 175, 0.5))' }}
        >
          {(t.is_support || t.tipo === 'evo_chat_support') ? (
            <Shield className="w-6 h-6 text-[#93C5FD]" />
          ) : (
            <MessageSquare className="w-6 h-6 text-[#93C5FD]" />
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
            <span className="w-2.5 h-2.5 rounded-full bg-[#3B82F6] flex-shrink-0" title="No leídos" aria-label="No leídos" />
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
          if (filtered.length === 0) return null;
          return (
            <div key={sec.label}>
              <p className="px-3 pt-3 pb-1 font-medium tracking-wider" style={SECTION_LABEL_STYLE}>
                {sec.label}
              </p>
              {filtered.map((t) => renderThread(t))}
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
