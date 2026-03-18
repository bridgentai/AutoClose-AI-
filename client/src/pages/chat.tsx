import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/lib/authContext';
import { useLocation, useParams } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send, Loader2, MessageSquare, Plus, History } from 'lucide-react';
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

export default function Chat() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const params = useParams<{ chatId?: string }>();
  const chatIdFromUrl = params?.chatId ?? null;

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
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
  };

  const handleSelectSession = (selectedChatId: string) => {
    if (selectedChatId === chatIdFromUrl) return;
    setLocation(`/chat/${selectedChatId}`);
  };

  const handleSend = async () => {
    if (!input.trim() || loading) return;

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
      const response = await apiRequest<{
        success: boolean;
        response: string;
        sessionId?: string;
        chatId?: string;
        error?: string;
        executedActions?: string[];
        actionData?: Record<string, any>;
        structuredResponse?: { type: string; data: Record<string, unknown> };
      }>('POST', '/api/ai/chat', {
        message: currentInput,
        sessionId: chatIdFromUrl ?? undefined,
        chatId: chatIdFromUrl ?? undefined,
      });

      if (!response.success) {
        throw new Error(response.error || 'Error al procesar el mensaje');
      }

      const returnedChatId = response.chatId ?? response.sessionId;
      if (returnedChatId && !chatIdFromUrl) {
        setLocation(`/chat/${returnedChatId}`);
      }

      const structured = response.structuredResponse;
      const aiMessage: Message = {
        emisor: 'ai',
        contenido: response.response,
        timestamp: new Date(),
        ...(structured?.type && { type: structured.type }),
        ...(structured?.data != null && { structuredData: structured.data }),
      };
      setMessages((prev) => [...prev, aiMessage]);

      if (response.executedActions && response.executedActions.length > 0) {
        if (
          response.executedActions.includes('crear_permiso') &&
          response.actionData?.crear_permiso
        ) {
          const permisoBackend = response.actionData.crear_permiso;
          const permiso = {
            tipoPermiso: permisoBackend.tipoPermiso,
            nombreEstudiante: permisoBackend.nombreEstudiante,
            fecha: permisoBackend.fecha,
            numeroRutaActual: permisoBackend.numeroRutaActual || '',
            numeroRutaCambio: permisoBackend.numeroRutaCambio || '',
            placaCarroActual: permisoBackend.placaCarroActual || '',
            placaCarroSalida: permisoBackend.placaCarroSalida || '',
            nombreConductor: permisoBackend.nombreConductor || '',
            cedulaConductor: permisoBackend.cedulaConductor || '',
            id: permisoBackend.id || Date.now().toString(),
            fechaCreacion: permisoBackend.fechaCreacion || new Date().toISOString(),
          };
          const permisosGuardados = localStorage.getItem(`permisos_${user?.id}`);
          let permisos: any[] = [];
          if (permisosGuardados) {
            try {
              permisos = JSON.parse(permisosGuardados);
            } catch (e) {
              console.error('Error al parsear permisos:', e);
            }
          }
          const permisoExiste = permisos.some((p: any) => p.id === permiso.id);
          if (!permisoExiste) {
            permisos.push(permiso);
            localStorage.setItem(`permisos_${user?.id}`, JSON.stringify(permisos));
            window.dispatchEvent(new CustomEvent('permisos-updated', { detail: { permiso, totalPermisos: permisos.length } }));
            setTimeout(() => window.dispatchEvent(new CustomEvent('permisos-updated')), 200);
          }
        }
        if (response.executedActions.includes('asignar_tarea')) {
          queryClient.invalidateQueries({ queryKey: ['teacherAssignments'], exact: false });
          queryClient.invalidateQueries({ queryKey: ['studentAssignments'], exact: false });
          queryClient.invalidateQueries({ queryKey: ['assignments'], exact: false });
          queryClient.invalidateQueries({ queryKey: ['/api/assignments'], exact: false });
        }
        if (response.executedActions.includes('calificar_tarea')) {
          queryClient.invalidateQueries({ queryKey: ['assignments'], exact: false });
          queryClient.invalidateQueries({ queryKey: ['studentNotes'], exact: false });
          queryClient.invalidateQueries({ queryKey: ['notas'], exact: false });
        }
        if (response.executedActions.includes('subir_nota')) {
          queryClient.invalidateQueries({ queryKey: ['studentNotes'], exact: false });
          queryClient.invalidateQueries({ queryKey: ['notas'], exact: false });
          queryClient.invalidateQueries({ queryKey: ['notas_curso'], exact: false });
        }
        if (response.executedActions.includes('crear_logros_calificacion')) {
          queryClient.invalidateQueries({ queryKey: ['/api/logros-calificacion'], exact: false });
          setTimeout(() => window.location.reload(), 1500);
        }
      }

      setSidebarRefresh((prev) => prev + 1);
      setTimeout(() => scrollToBottom(), 100);
    } catch (error: any) {
      console.error('Error en chat:', error);
      const errorText =
        error.message ||
        (error.response?.message || error.response?.error) ||
        'Lo siento, ocurrió un error. Intenta de nuevo.';
      setMessages((prev) => [
        ...prev,
        { emisor: 'ai', contenido: errorText, timestamp: new Date() },
      ]);
      setTimeout(() => scrollToBottom(), 100);
    } finally {
      setLoading(false);
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
            disabled={loading}
            data-testid="input-chat"
          />
          <Button
            onClick={handleSend}
            disabled={loading || !input.trim()}
            className="w-12 h-12 rounded-[12px] hover:opacity-90 flex-shrink-0"
            style={{ background: `linear-gradient(to right, ${accentColorDark}, ${accentColor})` }}
            data-testid="button-send"
          >
            {loading ? (
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
