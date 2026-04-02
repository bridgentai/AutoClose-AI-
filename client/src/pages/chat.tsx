import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/lib/authContext';
import { useLocation, useParams } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send, Loader2, MessageSquare, Plus, History, BookOpen, Users } from 'lucide-react';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { NavBackButton } from '@/components/nav-back-button';
import { ChatSidebar } from '@/components/chat-sidebar';
import { TopStudentCard } from '@/components/chat/TopStudentCard';
import { TasksOverviewCard } from '@/components/chat/TasksOverviewCard';
import { TrendAnalyticsCard } from '@/components/chat/TrendAnalyticsCard';
import { NotesOverviewCard } from '@/components/chat/NotesOverviewCard';
import kiwiImg from '@/assets/kiwi sentado.png';

interface Message {
  emisor: 'user' | 'ai';
  contenido: string;
  timestamp: Date;
  type?: string;
  structuredData?: Record<string, unknown>;
}

function isKiwiConfirmPayload(text: string): boolean {
  return typeof text === 'string' && text.startsWith('__CONFIRM__:');
}

function parseKiwiConfirmPayload(text: string): Record<string, unknown> | null {
  if (!isKiwiConfirmPayload(text)) return null;
  const raw = text.slice('__CONFIRM__:'.length).trim();
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') return parsed as Record<string, unknown>;
    return null;
  } catch {
    return null;
  }
}

type ParsedCourseItem = { subject: string; group: string };

function parseTeacherCoursesFromText(text: string): ParsedCourseItem[] | null {
  if (typeof text !== 'string') return null;
  const t = text.trim();
  if (!t.toLowerCase().includes('tus cursos activos')) return null;

  const lines = t.split('\n').map((l) => l.trim()).filter(Boolean);
  const items: ParsedCourseItem[] = [];

  for (const line of lines) {
    // Ej: "1. **Biología** - 10C" o "1. Biología - 10C"
    const m = line.match(/^\d+\.\s*(?:\*\*)?(.+?)(?:\*\*)?\s*-\s*([A-Za-z0-9]+)\s*$/);
    if (!m) continue;
    const subject = m[1].trim();
    const group = m[2].trim().toUpperCase();
    if (!subject || !group) continue;
    items.push({ subject, group });
  }

  return items.length > 0 ? items : null;
}

type ParsedSubjectGroups = { subject: string; groups: string[] };

function parseSubjectGroupsFromText(text: string): ParsedSubjectGroups | null {
  if (typeof text !== 'string') return null;
  const t = text.trim();
  const m = t.match(/tienes\s+asignados\s+los\s+siguientes\s+grupos\s+de\s+(.+?)\s*:/i);
  if (!m) return null;
  const subject = m[1]?.trim();
  if (!subject) return null;

  // Captura grupos tipo 10C, 11H, 9D... vengan con ** o no.
  const groupMatches = [...t.matchAll(/\b(\d{1,2}[A-Za-z])\b/g)].map((x) => x[1]?.toUpperCase()).filter(Boolean);
  const groups = Array.from(new Set(groupMatches));
  return groups.length > 0 ? { subject, groups } : null;
}

export default function Chat() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const params = useParams<{ chatId?: string }>();
  const chatIdFromUrl = params?.chatId ?? null;

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarRefresh, setSidebarRefresh] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    requestAnimationFrame(() => {
      if (messagesEndRef.current) {
        messagesEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
      }
    });
  };

  // Cargar historial desde la API cuando cambia chatId en la URL (sin LocalStorage)
  useEffect(() => {
    if (!chatIdFromUrl) {
      setMessages([]);
      setLoadingHistory(false);
      return;
    }
    const loadHistory = async () => {
      setLoadingHistory(true);
      try {
        const history = await apiRequest<{
          historial: Array<{
            emisor: 'user' | 'ai';
            contenido: string;
            timestamp: string;
            type?: string;
            structuredData?: Record<string, unknown>;
          }>;
        }>('GET', `/api/chat/${chatIdFromUrl}/history`);
        if (history.historial && Array.isArray(history.historial)) {
          const formatted: Message[] = history.historial.map((msg) => ({
            emisor: msg.emisor,
            contenido: msg.contenido,
            timestamp: new Date(msg.timestamp),
            ...(msg.type && { type: msg.type }),
            ...(msg.structuredData != null && { structuredData: msg.structuredData }),
          }));
          setMessages(formatted);
        } else {
          setMessages([]);
        }
      } catch (error) {
        console.error('Error al cargar historial:', error);
        setMessages([]);
        setLocation('/chat');
      } finally {
        setLoadingHistory(false);
      }
    };
    loadHistory();
  }, [chatIdFromUrl, setLocation]);

  useEffect(() => {
    if (messages.length > 0) scrollToBottom();
  }, [messages]);

  const handleNewChat = () => {
    setLocation('/chat');
    setMessages([]);
    setCurrentSessionId(null);
  };

  const handleSelectSession = (selectedChatId: string) => {
    if (selectedChatId === chatIdFromUrl) return;
    setLocation(`/chat/${selectedChatId}`);
  };

  const handleSend = async () => {
    if (!input.trim() || loading || isStreaming) return;

    const userMessage: Message = {
      emisor: 'user',
      contenido: input,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);
    const currentInput = input;
    setInput('');
    setLoading(true);

    try {
      const token = localStorage.getItem('autoclose_token');
      const response = await fetch('/api/kiwi/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          message: currentInput,
          sessionId: currentSessionId ?? undefined,
        }),
      });

      if (!response.ok) {
        let errorMsg = 'Error al conectar con Kiwi';
        try {
          const errBody = await response.json();
          errorMsg = errBody.error || errorMsg;
        } catch { /* ignore */ }
        throw new Error(errorMsg);
      }

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let firstChunk = true;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.slice(6).trim();
          if (!jsonStr) continue;

          let event: { type: string; text?: string; sessionId?: string; message?: string };
          try {
            event = JSON.parse(jsonStr);
          } catch {
            continue;
          }

          if (event.type === 'chunk' && event.text) {
            // Confirmación estructurada (Kiwi)
            if (firstChunk && isKiwiConfirmPayload(event.text)) {
              const payload = parseKiwiConfirmPayload(event.text);
              setLoading(false);
              setIsStreaming(false);
              setMessages((prev) => [
                ...prev,
                {
                  emisor: 'ai',
                  contenido: '',
                  timestamp: new Date(),
                  type: 'kiwi_confirm',
                  structuredData: payload ?? undefined,
                },
              ]);
              firstChunk = false;
              continue;
            }

            if (firstChunk) {
              setLoading(false);
              setIsStreaming(true);
              setMessages((prev) => [
                ...prev,
                { emisor: 'ai', contenido: event.text!, timestamp: new Date() },
              ]);
              firstChunk = false;
            } else {
              setMessages((prev) => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                updated[updated.length - 1] = {
                  ...last,
                  contenido: last.contenido + event.text,
                };
                return updated;
              });
            }
            scrollToBottom();
          } else if (event.type === 'done') {
            if (event.sessionId) setCurrentSessionId(event.sessionId);
            setIsStreaming(false);
            setSidebarRefresh((prev) => prev + 1);
            setTimeout(() => scrollToBottom(), 100);
          } else if (event.type === 'error') {
            const errMsg = event.message || 'Lo siento, ocurrió un error. Intenta de nuevo.';
            setLoading(false);
            setIsStreaming(false);
            if (firstChunk) {
              setMessages((prev) => [
                ...prev,
                { emisor: 'ai', contenido: errMsg, timestamp: new Date() },
              ]);
            } else {
              setMessages((prev) => {
                const updated = [...prev];
                updated[updated.length - 1] = {
                  ...updated[updated.length - 1],
                  contenido: errMsg,
                };
                return updated;
              });
            }
            setTimeout(() => scrollToBottom(), 100);
          }
        }
      }

      // executedActions — mantenido para compatibilidad futura con acciones Kiwi
      const executedActions: string[] = [];
      if (executedActions && executedActions.length > 0) {
        if (
          executedActions.includes('crear_permiso')
        ) {
          // handler reservado
        }
        if (executedActions.includes('asignar_tarea')) {
          queryClient.invalidateQueries({ queryKey: ['teacherAssignments'], exact: false });
          queryClient.invalidateQueries({ queryKey: ['studentAssignments'], exact: false });
          queryClient.invalidateQueries({ queryKey: ['assignments'], exact: false });
          queryClient.invalidateQueries({ queryKey: ['/api/assignments'], exact: false });
        }
        if (executedActions.includes('calificar_tarea')) {
          queryClient.invalidateQueries({ queryKey: ['assignments'], exact: false });
          queryClient.invalidateQueries({ queryKey: ['studentNotes'], exact: false });
          queryClient.invalidateQueries({ queryKey: ['notas'], exact: false });
        }
        if (executedActions.includes('subir_nota')) {
          queryClient.invalidateQueries({ queryKey: ['studentNotes'], exact: false });
          queryClient.invalidateQueries({ queryKey: ['notas'], exact: false });
          queryClient.invalidateQueries({ queryKey: ['notas_curso'], exact: false });
        }
        if (executedActions.includes('crear_logros_calificacion')) {
          queryClient.invalidateQueries({ queryKey: ['/api/logros-calificacion'], exact: false });
          setTimeout(() => window.location.reload(), 1500);
        }
      }
    } catch (error: any) {
      console.error('Error en chat:', error);
      const errorText =
        error.message ||
        'Lo siento, ocurrió un error. Intenta de nuevo.';
      setMessages((prev) => [
        ...prev,
        { emisor: 'ai', contenido: errorText, timestamp: new Date() },
      ]);
      setTimeout(() => scrollToBottom(), 100);
    } finally {
      setLoading(false);
      setIsStreaming(false);
    }
  };

  const accentColor = '#00c8ff';
  const accentColorDark = '#1e3cff';
  const rol = user?.rol ?? '';
  const emptySubtitle =
    rol === 'estudiante'
      ? 'Pregúntame sobre tus tareas, notas o materias'
      : rol === 'profesor'
        ? 'Crea tareas, revisa entregas o genera materiales'
        : 'Consulta reportes, estadísticas o gestiona el colegio';

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-4 relative" data-testid="chat-page">
      <div className="flex-1 flex flex-col min-w-0 h-full">
        <div className="mb-4 flex items-start justify-between flex-shrink-0">
          <div className="flex-1">
            <NavBackButton to="/dashboard" label="Dashboard" />
            <div className="flex items-center gap-3 mt-4">
              <div>
                <h1 className="text-2xl font-bold text-white font-['Poppins']">EvoOS</h1>
                <p className="text-white/60 text-sm mt-1">Por donde empezamos?</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-4">
            <Button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              variant="outline"
              className="border-white/20 text-white/80 hover:text-white hover:bg-white/10"
              data-testid="button-past-conversations"
            >
              <History className="w-4 h-4 mr-2" />
              Conversaciones Pasadas
            </Button>
            {messages.length > 0 && (
              <Button
                onClick={handleNewChat}
                variant="outline"
                className="border-white/20 text-white/80 hover:text-white hover:bg-white/10"
                data-testid="button-new-chat"
              >
                <Plus className="w-4 h-4 mr-2" />
                Nuevo Chat
              </Button>
            )}
          </div>
        </div>

        <div
          className="flex-1 overflow-y-auto bg-white/5 rounded-2xl border border-white/10 backdrop-blur-md flex flex-col"
          style={{ scrollBehavior: 'smooth' }}
        >
          <div className="p-6 flex-1 overflow-y-auto flex flex-col">
            {loadingHistory ? (
              <div className="flex items-center justify-center flex-1">
                <div className="text-center">
                  <Loader2 className="w-8 h-8 animate-spin text-[#00c8ff] mx-auto mb-4" />
                  <p className="text-white/60">Cargando historial...</p>
                </div>
              </div>
            ) : messages.length === 0 ? (
              <div className="flex items-center justify-center flex-1">
                <div className="text-center">
                  <div className="flex flex-col items-center">
                    <div className="relative" style={{ width: 260, height: 260 }}>
                      <div
                        className="absolute inset-0 -z-10"
                        style={{
                          background:
                            'radial-gradient(60% 60% at 50% 45%, rgba(59,130,246,0.22) 0%, rgba(29,78,216,0.10) 35%, rgba(2,6,23,0) 70%)',
                          filter: 'blur(12px)',
                          transform: 'scale(1.10)',
                        }}
                      />
                      {/* Capa blur del koala para suavizar bordes (sin máscaras/recortes) */}
                      <img
                        src={kiwiImg}
                        alt=""
                        aria-hidden="true"
                        className="select-none absolute left-1/2 top-1/2"
                        style={{
                          width: 260,
                          height: 'auto',
                          transform: 'translate(-50%, -50%) scale(1.03)',
                          filter:
                            'blur(15px) drop-shadow(0 0 52px rgba(59,130,246,0.28))',
                          opacity: 0.72,
                          pointerEvents: 'none',
                        }}
                        draggable={false}
                      />
                      <img
                        src={kiwiImg}
                        alt="Kiwi"
                        className="select-none"
                        style={{
                          width: 260,
                          height: 'auto',
                          filter:
                            'drop-shadow(0 12px 28px rgba(2,6,23,0.55)) drop-shadow(0 0 20px rgba(59,130,246,0.18))',
                        }}
                        draggable={false}
                      />
                    </div>
                    <div
                      className="mt-3"
                      style={{
                        width: 200,
                        height: 18,
                        borderRadius: 999,
                        background: 'rgba(37,99,235,0.30)',
                        filter: 'blur(12px)',
                        opacity: 0.35,
                      }}
                    />
                  </div>
                  <h2 className="mt-6 text-[20px] font-bold text-white">
                    Hola, soy Kiwi
                  </h2>
                  <p className="text-white/60 text-sm mt-2">
                    {emptySubtitle}
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-4 flex-1">
                {messages.map((msg, idx) => (
                  <div
                    key={`${msg.timestamp.getTime()}-${idx}`}
                    className={`flex ${msg.emisor === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}
                  >
                    {msg.emisor === 'user' ? (
                      <div
                        className="max-w-[80%] px-5 py-3 rounded-2xl text-white rounded-br-sm"
                        style={{
                          background: `linear-gradient(to right, ${accentColorDark}, ${accentColor})`,
                        }}
                      >
                        <p className="text-[15px] leading-relaxed whitespace-pre-wrap">
                          {msg.contenido}
                        </p>
                      </div>
                    ) : msg.type === 'top_student_card' && msg.structuredData ? (
                      <TopStudentCard
                        data={{
                          studentName: String(msg.structuredData.studentName ?? ''),
                          average: Number(msg.structuredData.average ?? 0),
                          group: String(msg.structuredData.group ?? ''),
                          ranking: Number(msg.structuredData.ranking ?? 1),
                          ctaRoute: String(msg.structuredData.ctaRoute ?? '#'),
                        }}
                      />
                    ) : msg.type === 'tasks_overview' && msg.structuredData ? (
                      <TasksOverviewCard
                        data={{
                          group: String(msg.structuredData.group ?? ''),
                          tasks: Array.isArray(msg.structuredData.tasks) ? msg.structuredData.tasks as { title: string; dueDate: string; status: string }[] : [],
                          ctaRoute: String(msg.structuredData.ctaRoute ?? '#'),
                        }}
                      />
                    ) : msg.type === 'grade_trend_analysis' && msg.structuredData ? (
                      <TrendAnalyticsCard
                        data={{
                          chartData: Array.isArray(msg.structuredData.chartData) ? msg.structuredData.chartData as { period: string; average: number; count: number }[] : [],
                          aiInsights: String(msg.structuredData.aiInsights ?? ''),
                        }}
                      />
                    ) : msg.type === 'notes_overview' && msg.structuredData ? (
                      <NotesOverviewCard
                        data={{
                          group: String(msg.structuredData.group ?? ''),
                          ctaRoute: String(msg.structuredData.ctaRoute ?? '#'),
                        }}
                      />
                    ) : msg.type === 'kiwi_confirm' && msg.structuredData ? (
                      <div className="w-full flex items-start gap-2 max-w-[80%]">
                        <img
                          src={kiwiImg}
                          alt="Kiwi"
                          className="shrink-0"
                          style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }}
                          draggable={false}
                        />
                        <div className="min-w-0">
                          <div className="text-[11px] text-white/40 mb-1">Kiwi</div>
                          <div
                            className="px-5 py-4 text-white/90 space-y-3"
                            style={{
                              background: 'rgba(37,99,235,0.10)',
                              border: '1px solid rgba(37,99,235,0.18)',
                              borderRadius: '16px 16px 16px 4px',
                            }}
                          >
                            <div>
                              <div className="text-sm font-semibold text-white">Confirmación requerida</div>
                              <div className="text-xs text-white/60 mt-1">
                                Voy a crear una tarea. Revisa el resumen y confirma.
                              </div>
                            </div>

                            <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                              <div className="text-xs text-white/60">Título</div>
                              <div className="text-sm text-white mt-0.5">
                                {String((msg.structuredData.params as any)?.title ?? '')}
                              </div>
                              <div className="text-xs text-white/60 mt-2">Entrega</div>
                              <div className="text-sm text-white mt-0.5">
                                {String((msg.structuredData.params as any)?.dueDate ?? '')}
                              </div>
                            </div>

                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                className="border-white/20 text-white/80 hover:text-white hover:bg-white/10"
                                onClick={() => {
                                  const payload = msg.structuredData ?? {};
                                  setInput(`KIWI_CONFIRM ${JSON.stringify(payload)}`);
                                }}
                              >
                                Revisar / editar
                              </Button>
                              <Button
                                className="hover:opacity-90"
                                style={{ background: `linear-gradient(to right, ${accentColorDark}, ${accentColor})` }}
                                onClick={() => {
                                  const payload = msg.structuredData ?? {};
                                  setInput(`KIWI_CONFIRM ${JSON.stringify(payload)}`);
                                  setTimeout(() => handleSend(), 0);
                                }}
                              >
                                Confirmar y crear
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : msg.emisor === 'ai' && parseTeacherCoursesFromText(msg.contenido) ? (
                      <div className="w-full flex items-start gap-2 max-w-[80%]">
                        <img
                          src={kiwiImg}
                          alt="Kiwi"
                          className="shrink-0"
                          style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }}
                          draggable={false}
                        />
                        <div className="min-w-0">
                          <div className="text-[11px] text-white/40 mb-1">Kiwi</div>
                          <div
                            className="px-5 py-4 text-white/90"
                            style={{
                              background: 'rgba(37,99,235,0.10)',
                              border: '1px solid rgba(37,99,235,0.18)',
                              borderRadius: '16px 16px 16px 4px',
                            }}
                          >
                            <div className="flex items-center gap-2">
                              <div
                                className="w-9 h-9 rounded-xl flex items-center justify-center border border-white/10"
                                style={{
                                  background:
                                    'linear-gradient(145deg, rgba(30,58,138,0.35), rgba(15,23,42,0.6))',
                                  boxShadow: '0 0 22px rgba(37,99,235,0.20)',
                                }}
                              >
                                <BookOpen className="w-4 h-4 text-[#00c8ff]" />
                              </div>
                              <div className="min-w-0">
                                <div className="text-sm font-semibold text-white">Tus cursos activos</div>
                                <div className="text-xs text-white/60">
                                  Selecciona uno para asignar una tarea más rápido.
                                </div>
                              </div>
                            </div>

                            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {parseTeacherCoursesFromText(msg.contenido)!.slice(0, 24).map((c, i) => (
                                <button
                                  key={`${c.subject}-${c.group}-${i}`}
                                  type="button"
                                  onClick={() => setInput(`Asignar una tarea para ${c.group} de ${c.subject}.`)}
                                  className="text-left rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition-colors px-3 py-2"
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="min-w-0">
                                      <div className="text-sm font-medium text-white truncate">{c.subject}</div>
                                      <div className="text-xs text-white/60 flex items-center gap-1.5 mt-0.5">
                                        <Users className="w-3.5 h-3.5 text-white/55" />
                                        <span className="truncate">{c.group}</span>
                                      </div>
                                    </div>
                                    <div
                                      className="shrink-0 text-[11px] font-semibold px-2 py-1 rounded-full"
                                      style={{
                                        background: 'rgba(0,200,255,0.14)',
                                        border: '1px solid rgba(0,200,255,0.28)',
                                        color: 'rgba(125,211,252,0.95)',
                                      }}
                                    >
                                      {c.group}
                                    </div>
                                  </div>
                                </button>
                              ))}
                            </div>

                            <div className="mt-3 text-[12px] text-white/60">
                              Tip: también puedes decir “asigna una tarea para <span className="text-white/80">11H</span> de <span className="text-white/80">Biología</span> para el viernes”.
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : msg.emisor === 'ai' && parseSubjectGroupsFromText(msg.contenido) ? (
                      <div className="w-full flex items-start gap-2 max-w-[80%]">
                        <img
                          src={kiwiImg}
                          alt="Kiwi"
                          className="shrink-0"
                          style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }}
                          draggable={false}
                        />
                        <div className="min-w-0">
                          <div className="text-[11px] text-white/40 mb-1">Kiwi</div>
                          <div
                            className="px-5 py-4 text-white/90"
                            style={{
                              background: 'rgba(37,99,235,0.10)',
                              border: '1px solid rgba(37,99,235,0.18)',
                              borderRadius: '16px 16px 16px 4px',
                            }}
                          >
                            {(() => {
                              const parsed = parseSubjectGroupsFromText(msg.contenido)!;
                              return (
                                <>
                                  <div className="flex items-center gap-2">
                                    <div
                                      className="w-9 h-9 rounded-xl flex items-center justify-center border border-white/10"
                                      style={{
                                        background:
                                          'linear-gradient(145deg, rgba(30,58,138,0.35), rgba(15,23,42,0.6))',
                                        boxShadow: '0 0 22px rgba(37,99,235,0.20)',
                                      }}
                                    >
                                      <BookOpen className="w-4 h-4 text-[#00c8ff]" />
                                    </div>
                                    <div className="min-w-0">
                                      <div className="text-sm font-semibold text-white truncate">
                                        {parsed.subject}
                                      </div>
                                      <div className="text-xs text-white/60">
                                        Tus grupos asignados ({parsed.groups.length})
                                      </div>
                                    </div>
                                  </div>

                                  <div className="mt-4 flex flex-wrap gap-2">
                                    {parsed.groups.slice(0, 24).map((g) => (
                                      <button
                                        key={g}
                                        type="button"
                                        onClick={() => setInput(`Asignar una tarea para ${g} de ${parsed.subject}.`)}
                                        className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 hover:bg-white/10 transition-colors px-3 py-1.5"
                                      >
                                        <Users className="w-4 h-4 text-white/60" />
                                        <span className="text-sm text-white font-medium">{g}</span>
                                      </button>
                                    ))}
                                  </div>

                                  <div className="mt-3 text-[12px] text-white/60">
                                    Tip: toca un grupo para preparar una tarea; luego me dices título, descripción y fecha.
                                  </div>
                                </>
                              );
                            })()}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="w-full flex items-start gap-2 max-w-[80%]">
                        <img
                          src={kiwiImg}
                          alt="Kiwi"
                          className="shrink-0"
                          style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }}
                          draggable={false}
                        />
                        <div className="min-w-0">
                          <div className="text-[11px] text-white/40 mb-1">Kiwi</div>
                          <div
                            className="px-5 py-3 text-white/90"
                            style={{
                              background: 'rgba(37,99,235,0.10)',
                              border: '1px solid rgba(37,99,235,0.15)',
                              borderRadius: '16px 16px 16px 4px',
                            }}
                          >
                            <p className="text-[15px] leading-relaxed whitespace-pre-wrap">
                              {msg.contenido}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
                {loading && (
                  <div className="flex justify-start max-w-[80%]">
                    <div className="flex items-start gap-2">
                      <img
                        src={kiwiImg}
                        alt="Kiwi"
                        className="shrink-0"
                        style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }}
                        draggable={false}
                      />
                      <div>
                        <div className="text-[11px] text-white/40 mb-1">Kiwi</div>
                        <div
                          className="px-4 py-3"
                          style={{
                            background: 'rgba(37,99,235,0.10)',
                            border: '1px solid rgba(37,99,235,0.15)',
                            borderRadius: '16px 16px 16px 4px',
                          }}
                          aria-label="Kiwi está pensando"
                        >
                          <span className="kiwi-dot" />
                          <span className="kiwi-dot" style={{ animationDelay: '0.12s', marginLeft: 6 }} />
                          <span className="kiwi-dot" style={{ animationDelay: '0.24s', marginLeft: 6 }} />
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>
        </div>

        <div className="mt-4 flex gap-3 items-center flex-shrink-0">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Escríbele a Kiwi..."
            className="h-12 rounded-[12px] px-5 text-white placeholder:text-white/40 bg-white/5 border-white/10"
            disabled={loading || isStreaming}
            data-testid="input-chat"
          />
          <Button
            onClick={handleSend}
            disabled={loading || isStreaming || !input.trim()}
            className="w-12 h-12 rounded-[12px] hover:opacity-90 flex-shrink-0"
            style={{ background: `linear-gradient(to right, ${accentColorDark}, ${accentColor})` }}
            data-testid="button-send"
          >
            {(loading || isStreaming) ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </Button>
        </div>
      </div>

      <ChatSidebar
        currentSessionId={chatIdFromUrl}
        onSelectSession={handleSelectSession}
        onNewChat={handleNewChat}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        refreshTrigger={sidebarRefresh}
      />
    </div>
  );
}
