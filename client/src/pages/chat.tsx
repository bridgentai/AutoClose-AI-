import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/lib/authContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send, Loader2, MessageSquare, Plus, History } from 'lucide-react';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { NavBackButton } from '@/components/nav-back-button';
import { ChatSidebar } from '@/components/chat-sidebar';

interface Message {
  emisor: 'user' | 'ai';
  contenido: string;
  timestamp: Date;
}

const SESSION_STORAGE_KEY = 'chatSessionId';

export default function Chat() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarRefresh, setSidebarRefresh] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    // Usar requestAnimationFrame para asegurar que el DOM se haya actualizado
    requestAnimationFrame(() => {
      if (messagesEndRef.current) {
        messagesEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
      }
    });
  };

  // Cargar sessionId del localStorage y historial al montar
  useEffect(() => {
    const loadSessionAndHistory = async () => {
      const savedSessionId = localStorage.getItem(SESSION_STORAGE_KEY);
      if (savedSessionId) {
        setSessionId(savedSessionId);
        setLoadingHistory(true);
        try {
          const history = await apiRequest<{ historial: Array<{ emisor: 'user' | 'ai'; contenido: string; timestamp: string }> }>('GET', `/api/chat/${savedSessionId}/history`);
          
          if (history.historial && Array.isArray(history.historial)) {
            const formattedMessages: Message[] = history.historial.map(msg => ({
              emisor: msg.emisor,
              contenido: msg.contenido,
              timestamp: new Date(msg.timestamp)
            }));
            setMessages(formattedMessages);
          }
        } catch (error: any) {
          console.error('Error al cargar historial:', error);
          // Si hay error al cargar historial, limpiar sessionId
          setSessionId(null);
          localStorage.removeItem(SESSION_STORAGE_KEY);
        } finally {
          setLoadingHistory(false);
        }
      }
    };

    loadSessionAndHistory();
  }, []);

  useEffect(() => {
    // Scroll suave cuando se agregan nuevos mensajes
    if (messages.length > 0) {
      scrollToBottom();
    }
  }, [messages]);

  const handleNewChat = () => {
    setSessionId(null);
    setMessages([]);
    localStorage.removeItem(SESSION_STORAGE_KEY);
  };

  const handleSelectSession = async (selectedSessionId: string) => {
    if (selectedSessionId === sessionId) return;
    
    setSessionId(selectedSessionId);
    localStorage.setItem(SESSION_STORAGE_KEY, selectedSessionId);
    setLoadingHistory(true);
    
    try {
      const history = await apiRequest<{ historial: Array<{ emisor: 'user' | 'ai'; contenido: string; timestamp: string }> }>('GET', `/api/chat/${selectedSessionId}/history`);
      
      if (history.historial && Array.isArray(history.historial)) {
        const formattedMessages: Message[] = history.historial.map(msg => ({
          emisor: msg.emisor,
          contenido: msg.contenido,
          timestamp: new Date(msg.timestamp)
        }));
        setMessages(formattedMessages);
      }
    } catch (error: any) {
      console.error('Error al cargar historial:', error);
      setMessages([]);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMessage: Message = {
      emisor: 'user',
      contenido: input,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    const currentInput = input;
    setInput('');
    setLoading(true);

    try {
      // Asegurarse de tener el sessionId más reciente (del estado o localStorage)
      const currentSessionId = sessionId || localStorage.getItem(SESSION_STORAGE_KEY);
      
      console.log('[Chat Frontend] Enviando mensaje con sessionId:', currentSessionId);
      
      // Llamar al endpoint del Chat AI Global con sessionId
      const response = await apiRequest<{ 
        success: boolean; 
        response: string; 
        sessionId?: string;
        error?: string;
        executedActions?: string[];
        actionData?: Record<string, any>;
      }>('POST', '/api/ai/chat', {
        message: currentInput,
        sessionId: currentSessionId || undefined,
      });

      if (!response.success) {
        throw new Error(response.error || 'Error al procesar el mensaje');
      }

      // SIEMPRE actualizar sessionId si se recibió uno (nuevo o existente)
      // Esto es crítico para mantener la sesión entre mensajes
      if (response.sessionId) {
        const newSessionId = response.sessionId;
        // Actualizar siempre, incluso si es el mismo, para asegurar sincronización
        if (newSessionId !== sessionId) {
          console.log('[Chat Frontend] Actualizando sessionId:', sessionId, '->', newSessionId);
          setSessionId(newSessionId);
        }
        // Siempre guardar en localStorage para persistencia
        localStorage.setItem(SESSION_STORAGE_KEY, newSessionId);
      } else {
        console.warn('[Chat Frontend] ⚠️ No se recibió sessionId en la respuesta');
      }

      const aiMessage: Message = {
        emisor: 'ai',
        contenido: response.response,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, aiMessage]);
      
      // Invalidar queries basado en las acciones ejecutadas
      if (response.executedActions && response.executedActions.length > 0) {
        console.log('[Chat] Acciones ejecutadas:', response.executedActions);
        
        // Si se creó un permiso, guardarlo en localStorage
        if (response.executedActions.includes('crear_permiso') && response.actionData?.crear_permiso) {
          const permisoBackend = response.actionData.crear_permiso;
          console.log('[Chat] Permiso recibido del backend:', permisoBackend);
          
          // Asegurar que el permiso tenga el formato correcto (igual al del formulario)
          // Eliminar campos extra que no son necesarios para la interfaz
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
              console.log('[Chat] Permisos existentes:', permisos.length);
            } catch (e) {
              console.error('[Chat] Error al parsear permisos:', e);
            }
          }
          
          // Verificar que el permiso no esté ya guardado (por si acaso)
          const permisoExiste = permisos.some((p: any) => p.id === permiso.id);
          if (!permisoExiste) {
            permisos.push(permiso);
            localStorage.setItem(`permisos_${user?.id}`, JSON.stringify(permisos));
            console.log('[Chat] ✅ Permiso guardado en localStorage. Total de permisos:', permisos.length);
            console.log('[Chat] Permiso guardado:', JSON.stringify(permiso, null, 2));
            
            // Disparar evento personalizado para notificar a otras páginas
            // Usar CustomEvent para mejor compatibilidad
            const event = new CustomEvent('permisos-updated', {
              detail: { permiso, totalPermisos: permisos.length }
            });
            window.dispatchEvent(event);
            console.log('[Chat] ✅ Evento "permisos-updated" disparado');
            
            // Forzar recarga después de un pequeño delay para asegurar que se guardó
            setTimeout(() => {
              window.dispatchEvent(new CustomEvent('permisos-updated'));
            }, 200);
          } else {
            console.log('[Chat] ⚠️ El permiso ya existe, no se duplicará');
          }
        }
        
        // Si se asignó una tarea, invalidar todas las queries relacionadas
        if (response.executedActions.includes('asignar_tarea')) {
          console.log('[Chat] Invalidando queries de assignments después de crear tarea');
          queryClient.invalidateQueries({ queryKey: ['teacherAssignments'], exact: false });
          queryClient.invalidateQueries({ queryKey: ['studentAssignments'], exact: false });
          queryClient.invalidateQueries({ queryKey: ['assignments'], exact: false });
          queryClient.invalidateQueries({ queryKey: ['/api/assignments'], exact: false });
          queryClient.invalidateQueries({ queryKey: ['/api/assignments/student'], exact: false });
          queryClient.invalidateQueries({ queryKey: ['/api/assignments/profesor'], exact: false });
        }
        
        // Si se calificó una tarea, invalidar queries de notas y assignments
        if (response.executedActions.includes('calificar_tarea')) {
          console.log('[Chat] Invalidando queries después de calificar tarea');
          queryClient.invalidateQueries({ queryKey: ['assignments'], exact: false });
          queryClient.invalidateQueries({ queryKey: ['studentNotes'], exact: false });
          queryClient.invalidateQueries({ queryKey: ['notas'], exact: false });
        }
        
        // Si se subió una nota, invalidar queries de notas
        if (response.executedActions.includes('subir_nota')) {
          console.log('[Chat] Invalidando queries después de subir nota');
          queryClient.invalidateQueries({ queryKey: ['studentNotes'], exact: false });
          queryClient.invalidateQueries({ queryKey: ['notas'], exact: false });
          queryClient.invalidateQueries({ queryKey: ['notas_curso'], exact: false });
        }
        
        // Si se crearon logros de calificación, invalidar queries y refrescar
        if (response.executedActions.includes('crear_logros_calificacion')) {
          console.log('[Chat] Invalidando queries después de crear logros de calificación');
          queryClient.invalidateQueries({ queryKey: ['/api/logros-calificacion'], exact: false });
          // Refrescar la página después de un breve delay para mostrar los cambios
          setTimeout(() => {
            window.location.reload();
          }, 1500);
        }
      }
      
      // Refrescar sidebar para mostrar sesión actualizada
      setSidebarRefresh(prev => prev + 1);
      // Scroll después de agregar el mensaje de AI
      setTimeout(() => scrollToBottom(), 100);
    } catch (error: any) {
      console.error('Error en chat:', error);
      let errorText = 'Lo siento, ocurrió un error al procesar tu mensaje. Por favor intenta de nuevo.';
      
      if (error.message) {
        errorText = error.message;
      } else if (error.response) {
        errorText = error.response.message || error.response.error || errorText;
      }
      
      const errorMessage: Message = {
        emisor: 'ai',
        contenido: errorText,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
      // Scroll después de agregar el mensaje de error
      setTimeout(() => scrollToBottom(), 100);
    } finally {
      setLoading(false);
    }
  };

  const accentColor = '#00c8ff';
  const accentColorDark = '#1e3cff';

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-4 relative" data-testid="chat-page">
      {/* Contenedor principal del chat */}
      <div className="flex-1 flex flex-col min-w-0 h-full">
        <div className="mb-4 flex items-start justify-between flex-shrink-0">
          <div className="flex-1">
            <NavBackButton to="/dashboard" label="Dashboard" />
            <div className="flex items-center gap-3 mt-4">
              <div>
                <h1 className="text-2xl font-bold text-white font-['Poppins']">
                  AutoClose AI
                </h1>
                <p className="text-white/60 text-sm mt-1">
                  Por donde empezamos?
                </p>
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

      <div className="flex-1 overflow-y-auto bg-white/5 rounded-2xl border border-white/10 backdrop-blur-md flex flex-col" style={{ scrollBehavior: 'smooth' }}>
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
                <div className="w-20 h-20 rounded-2xl mx-auto mb-6 flex items-center justify-center bg-gradient-to-br from-[#002366] to-[#1e3cff]">
                  <MessageSquare className="w-10 h-10 text-white" />
                </div>
                <h2 className="text-3xl font-bold text-white mb-3 font-['Poppins']">
                  Por donde empezamos?
                </h2>
                <p className="text-white/60 text-lg">
                  Pregunta sobre tus cursos, tareas o conceptos academicos
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4 flex-1">
              {messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex ${msg.emisor === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}
                >
                  <div
                    className={`max-w-[80%] px-5 py-3 rounded-2xl ${
                      msg.emisor === 'user'
                        ? 'text-white rounded-br-sm'
                        : 'bg-white/95 text-gray-900 rounded-bl-sm'
                    }`}
                    style={{
                      background: msg.emisor === 'user' 
                        ? `linear-gradient(to right, ${accentColorDark}, ${accentColor})` 
                        : undefined,
                      borderColor: msg.emisor !== 'user' ? accentColor : undefined,
                      borderWidth: msg.emisor !== 'user' ? '2px' : undefined
                    }}
                  >
                    <p className="text-[15px] leading-relaxed whitespace-pre-wrap">
                      {msg.contenido}
                    </p>
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex justify-start">
                  <div 
                    className="bg-white/90 px-5 py-3 rounded-2xl rounded-bl-sm border flex items-center gap-2"
                    style={{ color: accentColor, borderColor: `${accentColor}30` }}
                  >
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="italic">Escribiendo...</span>
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
          placeholder="Escribe tu pregunta..."
          className="h-12 rounded-2xl px-5 text-white placeholder:text-white/40 bg-white/5 border-white/10"
          disabled={loading}
          data-testid="input-chat"
        />
        <Button
          onClick={handleSend}
          disabled={loading || !input.trim()}
          className="w-12 h-12 rounded-full hover:opacity-90 flex-shrink-0"
          style={{ background: `linear-gradient(to right, ${accentColor}, ${accentColorDark})` }}
          data-testid="button-send"
        >
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
        </Button>
      </div>
      </div>

      {/* Sidebar de conversaciones */}
      <ChatSidebar
        currentSessionId={sessionId}
        onSelectSession={handleSelectSession}
        onNewChat={handleNewChat}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        refreshTrigger={sidebarRefresh}
      />
    </div>
  );
}
