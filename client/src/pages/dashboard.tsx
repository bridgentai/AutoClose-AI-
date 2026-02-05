import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/authContext';
import { BookOpen, GraduationCap, MessageSquare, TrendingUp, AlertTriangle, Trophy, Send, Loader2, Bot, ClipboardList } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/Calendar';
import { useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

interface Assignment {
  _id: string;
  titulo: string;
  descripcion: string;
  curso: string;
  fechaEntrega: string;
  profesorNombre: string;
}

interface Message {
  emisor: 'user' | 'ai';
  contenido: string;
  timestamp: Date;
}

const PURPLE_ACCENT = '#9f25b8';
const ACCENT_DARK = '#6a0dad';
const CARD_STYLE = `bg-white/5 border-white/10 backdrop-blur-md hover-elevate`;
const GRADIENT_STYLE = `from-[${PURPLE_ACCENT}] to-[${ACCENT_DARK}]`;

interface AIChatBoxProps {
  rol: string;
}

function AIChatBox({ rol }: AIChatBoxProps) {
  const [, setLocation] = useLocation();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    // Usar requestAnimationFrame para asegurar que el DOM se haya actualizado
    requestAnimationFrame(() => {
      if (messagesEndRef.current) {
        messagesEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
      }
    });
  };

  useEffect(() => {
    // Scroll suave cuando se agregan nuevos mensajes
    if (messages.length > 0) {
      scrollToBottom();
    }
  }, [messages]);

  const handleSend = useCallback(async () => {
    if (!input.trim() || loading) return;

    const userMessage: Message = { emisor: 'user', contenido: input, timestamp: new Date() };
    setMessages(prev => [...prev, userMessage]);
    const currentInput = input;
    setInput('');
    setLoading(true);

    try {
      // Construir historial de conversación para el contexto
      const conversationHistory = messages.map(msg => ({
        role: msg.emisor === 'user' ? 'user' as const : 'assistant' as const,
        content: msg.contenido
      }));

      // Llamar al nuevo endpoint del Chat AI Global
      const response = await apiRequest<{ success: boolean; response: string; error?: string }>('POST', '/api/ai/chat', {
        message: currentInput,
        contexto_extra: {
          rol,
          contextoTipo: `${rol}_dashboard`,
        },
        conversationHistory,
      });

      if (!response.success) {
        throw new Error(response.error || 'Error al procesar el mensaje');
      }

      const aiMessage: Message = { emisor: 'ai', contenido: response.response, timestamp: new Date() };
      setMessages(prev => [...prev, aiMessage]);
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
        timestamp: new Date() 
      };
      setMessages(prev => [...prev, errorMessage]);
      // Scroll después de agregar el mensaje de error
      setTimeout(() => scrollToBottom(), 100);
    } finally {
      setLoading(false);
    }
  }, [input, loading, messages, rol]);

  return (
    <Card
      className={`${CARD_STYLE} cursor-pointer flex flex-col h-full gradient-overlay-purple hover-glow`}
      onClick={() => setLocation('/chat')}
    >
      <CardHeader className="pb-3 flex-shrink-0">
        <CardTitle className="text-white flex items-center gap-2 text-lg text-expressive">
          <Bot className="w-5 h-5 text-[#9f25b8] animate-pulse-glow" />
          Asistente AutoClose IA ({rol.toUpperCase()})
        </CardTitle>
        <CardDescription className="text-white/60 text-sm text-expressive-subtitle">
          Pide tareas, revisa pendientes o crea materiales.
        </CardDescription>
      </CardHeader>

      <CardContent onClick={(e) => e.stopPropagation()} className="flex-1 flex flex-col p-4 pt-0 min-h-0">
        <div className="flex-1 space-y-3 overflow-y-auto pr-2">
          {messages.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className={`w-14 h-14 rounded-xl mx-auto mb-3 flex items-center justify-center bg-gradient-to-br ${GRADIENT_STYLE} badge-glow animate-float`}>
                  <MessageSquare className="w-7 h-7 text-white" />
                </div>
                <h2 className="text-lg font-semibold text-white mb-1.5 text-expressive">
                  {rol === 'estudiante' ? 'Tu centro de comandos' : 'Asistente de Productividad'}
                </h2>
                <p className="text-white/60 text-sm text-expressive-subtitle">
                  Escribe un comando o una pregunta para comenzar.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4 py-2">
              {messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`transition-smooth reveal-scale ${
                    msg.emisor === 'user' ? 'flex justify-end' : 'w-full'
                  }`}
                  style={{ animationDelay: `${idx * 0.1}s` }}
                >
                  {msg.emisor === 'user' ? (
                    // Mensaje del usuario: burbuja con gradiente púrpura
                    <div className="max-w-[85%] px-3 py-2 rounded-lg rounded-br-sm text-sm text-white bg-gradient-to-r from-[#9f25b8] to-[#6a0dad] hover-glow">
                      <p className="text-[14px] leading-relaxed whitespace-pre-wrap">{msg.contenido}</p>
                    </div>
                  ) : (
                    // Respuesta de la IA: texto en prosa sin burbuja (estilo ChatGPT)
                    <div className="w-full">
                      <div className="text-white/90 text-[14px] leading-relaxed whitespace-pre-wrap">
                        {msg.contenido}
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {loading && (
                <div className="flex items-center gap-2 text-white/60">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span className="text-sm italic">Escribiendo...</span>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>
        <div className="border-t border-white/10 pt-3 mt-3 flex-shrink-0">
          <div className="relative flex items-end gap-2 bg-white/5 border border-white/10 rounded-xl px-3 py-2 backdrop-blur-sm hover:border-white/20 transition-colors">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Escribe tu mensaje..."
              className="flex-1 border-0 bg-transparent text-white placeholder:text-white/40 focus-visible:ring-0 focus-visible:ring-offset-0 text-sm py-1"
              disabled={loading}
              data-testid="input-dashboard-chat"
            />
            <Button
              onClick={(e) => {
                e.stopPropagation();
                handleSend();
              }}
              disabled={loading || !input.trim()}
              size="icon"
              className="w-8 h-8 rounded-lg bg-gradient-to-r from-[#9f25b8] to-[#6a0dad] hover:opacity-90 text-white disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
              data-testid="button-dashboard-send"
            >
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function EstudianteDashboard() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const RED_ALERT = 'text-red-400';
  const YELLOW_TROPHY = '#facc15';

  // Query para obtener tareas del estudiante
  const { data: assignments = [], isLoading: isLoadingAssignments } = useQuery<Assignment[]>({
    queryKey: ['studentAssignments', user?.curso],
    queryFn: () => apiRequest('GET', '/api/assignments/student'),
    enabled: !!user?.id && !!user?.curso,
    staleTime: 0,
  });

  const handleDayClick = (assignment: Assignment) => {
    setLocation(`/assignment/${assignment._id}`);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card
          className={`${CARD_STYLE} cursor-pointer reveal-scale gradient-overlay-purple`}
          style={{ animationDelay: '0.1s' }}
          onClick={() => setLocation('/mi-aprendizaje/cursos')}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
            <CardTitle className="text-sm font-medium text-white">Mis Materias</CardTitle>
            <BookOpen className="w-5 h-5 text-[#9f25b8] animate-float" style={{ animationDelay: '0.5s' }} />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white font-['Poppins']">4</div>
            <p className="text-xs text-white/60 mt-1">Materias este ano</p>
          </CardContent>
        </Card>

        <Card
          className={`${CARD_STYLE} cursor-pointer reveal-scale gradient-overlay-purple`}
          style={{ animationDelay: '0.2s' }}
          onClick={() => setLocation('/mi-aprendizaje/tareas')}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
            <CardTitle className="text-sm font-medium text-white">Tareas Pendientes</CardTitle>
            <GraduationCap className="w-5 h-5 text-[#9f25b8] animate-pulse-glow" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white font-['Poppins']">{assignments.length}</div>
            <p className="text-xs text-white/60 mt-1">Por entregar esta semana</p>
          </CardContent>
        </Card>

        <Card
          className={`${CARD_STYLE} cursor-pointer reveal-scale gradient-overlay-purple`}
          style={{ animationDelay: '0.3s' }}
          onClick={() => setLocation('/mi-aprendizaje/notas')}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
            <CardTitle className="text-sm font-medium text-white">Materias Perdidas</CardTitle>
            <AlertTriangle className={`w-5 h-5 ${RED_ALERT} animate-pulse-glow`} />
          </CardHeader>
          <CardContent>
            <div className={`text-3xl font-bold ${RED_ALERT} font-['Poppins']`}>2</div>
            <p className="text-xs text-white/60 mt-1">Requieren atencion</p>
          </CardContent>
        </Card>

        <Card
          className={`${CARD_STYLE} cursor-pointer reveal-scale gradient-overlay-purple badge-glow`}
          style={{ animationDelay: '0.4s' }}
          onClick={() => setLocation('/mi-aprendizaje/notas')}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
            <CardTitle className="text-sm font-medium text-white">Puesto en el Salon</CardTitle>
            <Trophy className="w-5 h-5 text-[#facc15] animate-float" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-[#facc15] font-['Poppins']">#5</div>
            <p className="text-xs text-white/60 mt-1">De 32 estudiantes</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card
          className={`${CARD_STYLE} cursor-pointer reveal-slide gradient-overlay-purple`}
          style={{ animationDelay: '0.5s' }}
          onClick={() => setLocation('/mi-aprendizaje/calendario')}
        >
          <CardHeader>
            <CardTitle className="text-white text-expressive">Calendario de Tareas</CardTitle>
            <CardDescription className="text-white/60 text-expressive-subtitle">
              {isLoadingAssignments
                ? 'Cargando tareas...'
                : `${assignments.length} ${assignments.length === 1 ? 'tarea asignada' : 'tareas asignadas'} este mes`
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingAssignments ? (
              <div className="flex items-center justify-center py-12">
                <p className="text-white/60">Cargando calendario...</p>
              </div>
            ) : (
              <div onClick={(e) => e.stopPropagation()} className="pulse-purple">
                <Calendar assignments={assignments} onDayClick={handleDayClick} />
              </div>
            )}
          </CardContent>
        </Card>

        <div className="reveal-slide" style={{ animationDelay: '0.6s' }}>
          <AIChatBox rol="estudiante" />
        </div>
      </div>
    </div>
  );
}

function ProfesorDashboard() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  // Query para obtener tareas del profesor
  const { data: assignments = [], isLoading: isLoadingAssignments } = useQuery<Assignment[]>({
    queryKey: ['teacherAssignments', user?.id, currentMonth, currentYear],
    queryFn: async () => {
      return apiRequest('GET', `/api/assignments/profesor/${user?.id}/${currentMonth}/${currentYear}`);
    },
    enabled: !!user?.id,
    staleTime: 0,
  });

  const handleDayClick = (assignment: Assignment, event?: React.MouseEvent) => {
    if (event) {
      event.stopPropagation(); // Prevenir que se active el onClick de la Card
    }
    setLocation(`/assignment/${assignment._id}`);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card
          className={`${CARD_STYLE} cursor-pointer reveal-scale gradient-overlay-purple`}
          style={{ animationDelay: '0.1s' }}
          onClick={() => setLocation('/courses')}
        >
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white text-expressive">
              <BookOpen className="w-5 h-5 text-[#9f25b8] animate-float" />
              Mis Cursos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white font-['Poppins']">5</div>
            <p className="text-sm text-white/50 mt-1 text-expressive-subtitle">Cursos a cargo</p>
          </CardContent>
        </Card>

        <Card
          className={`${CARD_STYLE} cursor-pointer reveal-scale gradient-overlay-purple`}
          style={{ animationDelay: '0.2s' }}
          onClick={() => setLocation('/profesor/academia/tareas')}
        >
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white text-expressive">
              <ClipboardList className="w-5 h-5 text-[#9f25b8] animate-pulse-glow" />
              Tareas por revisar
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white font-['Poppins']">{assignments.length}</div>
            <p className="text-sm text-white/50 mt-1 text-expressive-subtitle">Pendientes de revisión</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card
          className={`${CARD_STYLE} cursor-pointer reveal-slide gradient-overlay-purple`}
          style={{ animationDelay: '0.3s' }}
          onClick={() => setLocation('/teacher-calendar')}
        >
          <CardHeader>
            <CardTitle className="text-white text-expressive">Calendario de Tareas</CardTitle>
            <CardDescription className="text-white/60 text-expressive-subtitle">
              {isLoadingAssignments
                ? 'Cargando tareas...'
                : `${assignments.length} ${assignments.length === 1 ? 'tarea asignada' : 'tareas asignadas'} este mes`
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingAssignments ? (
              <div className="flex items-center justify-center py-12">
                <p className="text-white/60">Cargando calendario...</p>
              </div>
            ) : (
              <div onClick={(e) => e.stopPropagation()} className="pulse-purple">
                <Calendar assignments={assignments} onDayClick={handleDayClick} />
              </div>
            )}
          </CardContent>
        </Card>

        <div className="reveal-slide" style={{ animationDelay: '0.4s' }}>
          <AIChatBox rol="profesor" />
        </div>
      </div>
    </div>
  );
}

function DirectivoDashboard() {
  const [, setLocation] = useLocation();

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card
          className={`${CARD_STYLE} cursor-pointer reveal-scale gradient-overlay-purple`}
          style={{ animationDelay: '0.1s' }}
          onClick={() => setLocation('/directivo')}
        >
          <CardHeader>
            <CardTitle className="text-white text-sm text-expressive-subtitle">Profesores</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white font-['Poppins']">24</div>
          </CardContent>
        </Card>

        <Card
          className={`${CARD_STYLE} cursor-pointer reveal-scale gradient-overlay-purple`}
          style={{ animationDelay: '0.2s' }}
          onClick={() => setLocation('/directivo')}
        >
          <CardHeader>
            <CardTitle className="text-white text-sm text-expressive-subtitle">Estudiantes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white font-['Poppins']">680</div>
          </CardContent>
        </Card>

        <Card
          className={`${CARD_STYLE} cursor-pointer reveal-scale gradient-overlay-purple`}
          style={{ animationDelay: '0.3s' }}
          onClick={() => setLocation('/courses')}
        >
          <CardHeader>
            <CardTitle className="text-white text-sm text-expressive-subtitle">Cursos Activos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white font-['Poppins']">42</div>
          </CardContent>
        </Card>

        <Card 
          className={`${CARD_STYLE} reveal-scale gradient-overlay-purple hover-glow`}
          style={{ animationDelay: '0.4s' }}
        >
          <CardHeader>
            <CardTitle className="text-white text-sm text-expressive-subtitle">Uso IA</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white font-['Poppins']">1.2k</div>
            <p className="text-sm text-white/50 mt-1 text-expressive-subtitle">Consultas/mes</p>
          </CardContent>
        </Card>
      </div>

      <div className="reveal-fade" style={{ animationDelay: '0.5s' }}>
        <AIChatBox rol="directivo" />
      </div>
    </div>
  );
}

function PadreDashboard() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  // Para padres, intentamos obtener las tareas del hijo si tienen hijoId
  // Si no, mostramos un mensaje o datos mock
  const { data: assignments = [], isLoading: isLoadingAssignments } = useQuery<Assignment[]>({
    queryKey: ['parentAssignments', user?.hijoId],
    queryFn: async () => {
      // Si el padre tiene un hijoId, podríamos obtener las tareas del hijo
      // Por ahora, retornamos array vacío ya que no hay endpoint específico
      return [];
    },
    enabled: !!user?.hijoId,
    staleTime: 0,
  });

  const handleDayClick = (assignment: Assignment) => {
    setLocation(`/assignment/${assignment._id}`);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card
          className={`${CARD_STYLE} cursor-pointer reveal-scale gradient-overlay-purple`}
          style={{ animationDelay: '0.1s' }}
          onClick={() => setLocation('/parent')}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
            <CardTitle className="text-sm font-medium text-white text-expressive-subtitle">Progreso Académico</CardTitle>
            <TrendingUp className="w-5 h-5 text-[#9f25b8] animate-float" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white font-['Poppins']">4.3</div>
            <p className="text-xs text-white/60 mt-1">Promedio general</p>
          </CardContent>
        </Card>

        <Card
          className={`${CARD_STYLE} cursor-pointer reveal-scale gradient-overlay-purple`}
          style={{ animationDelay: '0.2s' }}
          onClick={() => setLocation('/parent')}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
            <CardTitle className="text-sm font-medium text-white text-expressive-subtitle">Tareas del Hijo</CardTitle>
            <GraduationCap className="w-5 h-5 text-[#9f25b8] animate-pulse-glow" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white font-['Poppins']">{assignments.length}</div>
            <p className="text-xs text-white/60 mt-1">Tareas este mes</p>
          </CardContent>
        </Card>

        <Card
          className={`${CARD_STYLE} cursor-pointer reveal-scale gradient-overlay-purple`}
          style={{ animationDelay: '0.3s' }}
          onClick={() => setLocation('/parent')}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
            <CardTitle className="text-sm font-medium text-white text-expressive-subtitle">Materias</CardTitle>
            <BookOpen className="w-5 h-5 text-[#9f25b8] animate-float" style={{ animationDelay: '0.5s' }} />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white font-['Poppins']">5</div>
            <p className="text-xs text-white/60 mt-1">Materias activas</p>
          </CardContent>
        </Card>

        <Card
          className={`${CARD_STYLE} cursor-pointer reveal-scale gradient-overlay-purple badge-glow`}
          style={{ animationDelay: '0.4s' }}
          onClick={() => setLocation('/parent')}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
            <CardTitle className="text-sm font-medium text-white text-expressive-subtitle">Asistencia</CardTitle>
            <Trophy className="w-5 h-5 text-[#facc15] animate-float" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white font-['Poppins']">95%</div>
            <p className="text-xs text-white/60 mt-1">Este mes</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className={CARD_STYLE}>
          <CardHeader>
            <CardTitle className="text-white">Seguimiento del Estudiante</CardTitle>
            <CardDescription className="text-white/60">Progreso academico de su hijo/a</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {['Matematicas', 'Ciencias', 'Historia'].map((materia, index) => {
                const score = [4.5, 4.2, 4.7][index];
                const widthPercent = (score / 5.0) * 100;
                return (
                  <div 
                    key={materia} 
                    className="p-4 bg-white/5 rounded-xl hover-lift reveal-scale gradient-overlay-purple"
                    style={{ animationDelay: `${0.7 + index * 0.1}s` }}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-white font-medium text-expressive-subtitle">{materia}</span>
                      <span className="text-[#9f25b8] font-bold font-['Poppins']">{score}/5.0</span>
                    </div>
                    <div className="w-full bg-white/10 rounded-full h-3 overflow-hidden progress-bar">
                      <div 
                        className="bg-gradient-to-r from-[#9f25b8] to-[#6a0dad] h-3 rounded-full transition-all duration-1000 ease-out hover-glow"
                        style={{ width: `${widthPercent}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {assignments.length > 0 ? (
          <Card
            className={`${CARD_STYLE} cursor-pointer`}
            onClick={() => setLocation('/calendar')}
          >
            <CardHeader>
              <CardTitle className="text-white">Calendario de Tareas</CardTitle>
              <CardDescription className="text-white/60">
                Tareas de tu hijo/a este mes
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div onClick={(e) => e.stopPropagation()}>
                <Calendar assignments={assignments} onDayClick={handleDayClick} />
              </div>
            </CardContent>
          </Card>
        ) : (
          <AIChatBox rol="padre" />
        )}
      </div>

      {assignments.length === 0 && (
        <AIChatBox rol="padre" />
      )}
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  React.useEffect(() => {
    // Redirigir nuevos roles a sus páginas específicas
    if (user?.rol) {
      const roleRedirects: Record<string, string> = {
        'administrador-general': '/administrador-general',
        'transporte': '/transporte',
        'tesoreria': '/tesoreria',
        'nutricion': '/nutricion',
        'cafeteria': '/cafeteria',
        'asistente': '/asistente',
      };

      if (roleRedirects[user.rol]) {
        setLocation(roleRedirects[user.rol]);
        return;
      }
    }
  }, [user?.rol, setLocation]);

  const getDashboardContent = () => {
    switch (user?.rol) {
      case 'estudiante':
        return <EstudianteDashboard />;
      case 'profesor':
        return <ProfesorDashboard />;
      case 'directivo':
        return <DirectivoDashboard />;
      case 'padre':
        return <PadreDashboard />;
      case 'administrador-general':
      case 'transporte':
      case 'tesoreria':
      case 'nutricion':
      case 'cafeteria':
      case 'asistente':
        // Estos roles se redirigen a sus páginas específicas
        return null;
      default:
        return null;
    }
  };

  return (
    <div data-testid="dashboard-page">
      <div className="mb-8 reveal-fade">
        <h1 className="text-4xl font-bold text-white mb-2 text-expressive">
          Bienvenido, {user?.nombre?.split(' ')[0] || 'Usuario'}
        </h1>
        <p className="text-white/60 text-expressive-subtitle">
          {new Date().toLocaleDateString('es-CO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {getDashboardContent()}
    </div>
  );
}
