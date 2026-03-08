import React, { useState, useEffect, useCallback } from 'react';
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
} from 'lucide-react';
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
const CARD_STYLE = 'bg-white/5 border-white/10 backdrop-blur-md';

type ThreadType = 'comunicado_general' | 'curso' | 'asignacion' | 'asistencia' | 'general';

interface EvoThreadItem {
  _id: string;
  asunto: string;
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

const tipoLabels: Record<ThreadType, string> = {
  comunicado_general: 'Comunicado general',
  curso: 'Curso',
  asignacion: 'Tarea',
  asistencia: 'Asistencia',
  general: 'General',
};

const tipoIcons: Record<ThreadType, React.ReactNode> = {
  comunicado_general: <Users className="w-4 h-4" />,
  curso: <BookOpen className="w-4 h-4" />,
  asignacion: <FileText className="w-4 h-4" />,
  asistencia: <AlertCircle className="w-4 h-4" />,
  general: <Inbox className="w-4 h-4" />,
};

export default function EvoSendPage() {
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

  const canCreateThread = ['directivo', 'profesor', 'admin-general-colegio'].includes(user?.rol || '');
  const isAsistente = user?.rol === 'asistente';

  const { data: threads = [], isLoading: loadingThreads } = useQuery({
    queryKey: ['/api/evo-send/threads', filterTipo],
    queryFn: () => {
      const params = new URLSearchParams();
      if (filterTipo && filterTipo !== 'all') params.set('tipo', filterTipo);
      return apiRequest<EvoThreadItem[]>('GET', `/api/evo-send/threads?${params.toString()}`);
    },
  });

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
    ? threads.filter((t) => t.asunto?.toLowerCase().includes(searchQ.trim().toLowerCase()))
    : threads;

  const selectedThread = threads.find((t) => t._id === selectedId);
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
    <div className="p-4 sm:p-6 min-h-screen">
      <div className="mb-6">
        <NavBackButton to="/dashboard" label="Dashboard" />
        <div className="flex items-center gap-3 mt-4">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center shadow-lg"
            style={{ background: 'linear-gradient(145deg, #3B82F6, #1D4ED8)' }}
          >
            <Send className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white font-['Poppins']">Evo Send</h1>
            <p className="text-white/60 text-sm">Comunicación y asignaciones en tiempo real</p>
          </div>
          {connected && (
            <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">En línea</Badge>
          )}
        </div>
      </div>

      {isAsistente ? (
        <Tabs defaultValue="asistencia" className="space-y-4">
          <TabsList className="bg-white/10 border border-white/10">
            <TabsTrigger value="asistencia">Inbox Asistencia</TabsTrigger>
            <TabsTrigger value="mensajes">Mensajes</TabsTrigger>
          </TabsList>
          <TabsContent value="asistencia" className="mt-4">
            <AttendanceInbox />
          </TabsContent>
          <TabsContent value="mensajes" className="mt-4">
            <EvoLayout
              threads={filteredThreads}
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
              typing={typing}
              emitTyping={emitTyping}
              selectedIdForTyping={selectedId}
            />
          </TabsContent>
        </Tabs>
      ) : (
        <EvoLayout
          threads={filteredThreads}
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
          typing={typing}
          emitTyping={emitTyping}
          selectedIdForTyping={selectedId}
        />
      )}

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
    <Card className={CARD_STYLE}>
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
  typing: { userId?: string; userName?: string; threadId?: string } | null;
  emitTyping: (threadId: string, userName?: string) => void;
  selectedIdForTyping: string | null;
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
  typing,
  emitTyping,
  selectedIdForTyping,
}: EvoLayoutProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 min-h-[70vh]">
      <div className="lg:col-span-4">
        <Card className={`${CARD_STYLE} h-full flex flex-col overflow-hidden`}>
          <div className="p-4 border-b border-white/10 space-y-2">
            {canCreateThread && (
              <Button
                className="w-full"
                style={{ background: 'linear-gradient(180deg, #3B82F6, #1D4ED8)' }}
                onClick={onNewMessage}
              >
                <Send className="w-4 h-4 mr-2" />
                Nuevo mensaje
              </Button>
            )}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/50" />
              <Input
                placeholder="Buscar..."
                value={searchQ}
                onChange={(e) => setSearchQ(e.target.value)}
                className="pl-10 bg-white/10 border-white/10 text-white"
              />
            </div>
            <Select value={filterTipo} onValueChange={setFilterTipo}>
              <SelectTrigger className="bg-white/10 border-white/10 text-white">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {Object.entries(tipoLabels).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1 overflow-y-auto">
            {loadingThreads ? (
              <div className="flex items-center justify-center p-8">
                <Loader2 className="w-8 h-8 animate-spin text-white/50" />
              </div>
            ) : (
              filteredThreadsList(threads, selectedId, setSelectedId)
            )}
          </div>
        </Card>
      </div>

      <div className="lg:col-span-8">
        <Card className={`${CARD_STYLE} h-full flex flex-col overflow-hidden`}>
          {selectedThread ? (
            <>
              <CardHeader className="border-b border-white/10 py-4">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-white/60 text-sm">
                    {tipoIcons[selectedThread.tipo]}
                    <span className="ml-1">{tipoLabels[selectedThread.tipo]}</span>
                  </span>
                  {selectedThread.assignmentId && (
                    <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/30">Tarea</Badge>
                  )}
                </div>
                <CardTitle className="text-xl text-white">{selectedThread.asunto}</CardTitle>
                <p className="text-white/60 text-sm">
                  De: {(selectedThread.creadoPor as any)?.nombre} ({(selectedThread.creadoPor as any)?.rol})
                </p>
                {typing?.threadId === selectedId && typing?.userId !== user?.id && (
                  <p className="text-white/50 text-sm italic animate-pulse">{typing.userName || 'Alguien'} está escribiendo...</p>
                )}
              </CardHeader>
              <CardContent className="flex-1 overflow-y-auto p-4 space-y-3">
                {threadDetail?.thread?.assignmentId && (
                  <div
                    className="p-4 rounded-lg border border-blue-500/30 bg-blue-500/10"
                    style={{ borderLeftWidth: '4px', borderLeftColor: EVO_BLUE }}
                  >
                    <p className="text-white font-medium">Tarea: {(threadDetail.thread.assignmentId as any)?.titulo}</p>
                    <p className="text-white/70 text-sm mt-1">Entrega: {new Date((threadDetail.thread.assignmentId as any)?.fechaEntrega).toLocaleDateString('es')}</p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-2 border-blue-500/50 text-blue-300"
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
                  <AnimatePresence mode="popLayout">
                    {messages.map((m) => {
                      const isMine = (m.remitenteId as any)?._id === user?.id;
                      return (
                        <motion.div
                          key={m._id}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          className={`p-3 rounded-xl max-w-[85%] ${isMine ? 'ml-auto bg-blue-500/20 border border-blue-500/30' : 'bg-white/5 border border-white/10'}`}
                        >
                          <p className="text-white/80 text-sm font-medium">{(m.remitenteId as any)?.nombre} · {m.rolRemitente}</p>
                          <p className="text-white mt-1 whitespace-pre-wrap">{m.contenido}</p>
                          <div className="flex items-center gap-2 mt-2">
                            <p className="text-white/50 text-xs">{new Date(m.fecha).toLocaleString('es')}</p>
                            {m.prioridad === 'urgente' && <Badge variant="destructive" className="text-xs">Urgente</Badge>}
                            {m.prioridad === 'alta' && <Badge className="bg-amber-500/20 text-amber-400 text-xs">Alta</Badge>}
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                )}
              </CardContent>
              <div className="p-4 border-t border-white/10 flex gap-2">
                <Textarea
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  onFocus={() => selectedIdForTyping && emitTyping(selectedIdForTyping, user?.nombre)}
                  placeholder="Escribe tu respuesta..."
                  className="flex-1 bg-white/10 border-white/10 text-white placeholder:text-white/50 min-h-[80px]"
                />
                <Button
                  onClick={onSendReply}
                  disabled={!replyText.trim() || sendReplyMutation.isPending}
                  style={{ background: 'linear-gradient(180deg, #3B82F6, #1D4ED8)' }}
                  className="self-end"
                >
                  {sendReplyMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </Button>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-white/50 py-16">
              <Inbox className="w-16 h-16 mb-4" style={{ color: EVO_BLUE }} />
              <p className="text-lg">Selecciona un hilo para ver la conversación.</p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function filteredThreadsList(
  threads: EvoThreadItem[],
  selectedId: string | null,
  setSelectedId: (id: string | null) => void
) {
  return (
    <>
      {threads.map((t) => {
        const isSelected = t._id === selectedId;
        return (
          <motion.div
            key={t._id}
            layout
            onClick={() => setSelectedId(t._id)}
            className={`p-3 border-b border-white/10 cursor-pointer transition-all min-h-[72px] flex flex-col justify-center ${
              isSelected ? 'bg-blue-500/15 border-l-4' : 'hover:bg-white/5'
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
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-white font-medium truncate">{t.asunto}</p>
                <p className="text-white/50 text-xs truncate mt-0.5">
                  {t.ultimoMensaje?.contenido || 'Sin mensajes'}
                </p>
                <p className="text-white/40 text-xs mt-1">
                  {tipoLabels[t.tipo]} · {new Date(t.updatedAt).toLocaleDateString('es')}
                </p>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                {t.unreadCount ? (
                  <Badge className="bg-blue-500 text-white text-xs">{t.unreadCount}</Badge>
                ) : null}
                <ChevronRight className="w-4 h-4 text-white/40" />
              </div>
            </div>
          </motion.div>
        );
      })}
      {threads.length === 0 && (
        <p className="p-4 text-white/50 text-center">No hay hilos.</p>
      )}
    </>
  );
}
