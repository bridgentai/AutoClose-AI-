import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/authContext';
import { BookOpen, GraduationCap, MessageSquare, TrendingUp, AlertTriangle, Trophy, Send, Loader2, Bot } from 'lucide-react';
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
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = useCallback(async () => {
    if (!input.trim() || loading) return;

    const userMessage: Message = { emisor: 'user', contenido: input, timestamp: new Date() };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      let currentSessionId = sessionId;
      if (!currentSessionId) {
        const newSession = await apiRequest<{ sessionId: string }>('POST', '/api/chat/new', {
          titulo: `Chat ${new Date().toLocaleDateString()}`,
          contextoTipo: `${rol}_dashboard`,
        });
        currentSessionId = newSession.sessionId;
        setSessionId(currentSessionId);
      }

      const response = await apiRequest<{ aiResponse: string }>('POST', `/api/chat/${currentSessionId}/message`, {
        mensaje: userMessage.contenido,
        emisor: 'user',
      });

      const aiMessage: Message = { emisor: 'ai', contenido: response.aiResponse, timestamp: new Date() };
      setMessages(prev => [...prev, aiMessage]);
    } catch (error: any) {
      console.error('Error en chat:', error);
      const errorMessage: Message = { emisor: 'ai', contenido: 'Lo siento, ocurrio un error al procesar tu mensaje.', timestamp: new Date() };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  }, [input, loading, sessionId, rol]);

  return (
    <Card className={`${CARD_STYLE} flex flex-col h-[60vh] min-h-[400px] mt-6`}>
      <CardHeader className="border-b border-white/10 p-4">
        <CardTitle className="text-white flex items-center gap-2">
          <Bot className="w-6 h-6 text-[#9f25b8]" />
          Asistente AutoClose IA ({rol.toUpperCase()})
        </CardTitle>
        <CardDescription className="text-white/60">
          Pide tareas, revisa pendientes o crea materiales.
        </CardDescription>
      </CardHeader>

      <CardContent className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className={`w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center bg-gradient-to-br ${GRADIENT_STYLE}`}>
                <MessageSquare className={`w-8 h-8 text-white`} />
              </div>
              <h2 className="text-xl font-bold text-white mb-2">
                {rol === 'estudiante' ? 'Tu centro de comandos' : 'Asistente de Productividad'}
              </h2>
              <p className="text-white/60 text-sm">
                Escribe un comando o una pregunta para comenzar.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex ${msg.emisor === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] px-4 py-2 rounded-xl text-sm ${
                    msg.emisor === 'user'
                      ? 'bg-gradient-to-r from-[#9f25b8] to-[#6a0dad] text-white rounded-br-sm'
                      : 'bg-white/95 text-gray-900 border border-[#9f25b8] rounded-bl-sm'
                  }`}
                >
                  <p className="text-[15px] leading-relaxed whitespace-pre-wrap">{msg.contenido}</p>
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-white/10 px-4 py-2 rounded-xl rounded-bl-sm flex items-center gap-2 text-white/70">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="italic">Escribiendo...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </CardContent>

      <div className="p-4 border-t border-white/10 flex gap-3 items-center flex-shrink-0">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder="Escribe un comando o pregunta..."
          className={`h-10 rounded-xl px-4 text-white placeholder:text-white/40 bg-white/5 border-white/10 flex-grow`}
          disabled={loading}
          data-testid="input-dashboard-chat"
        />
        <Button
          onClick={handleSend}
          disabled={loading || !input.trim()}
          className={`w-10 h-10 rounded-full flex-shrink-0`}
          style={{ background: `linear-gradient(to right, ${PURPLE_ACCENT}, ${ACCENT_DARK})` }}
          data-testid="button-dashboard-send"
        >
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
        </Button>
      </div>
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
          className={`${CARD_STYLE} cursor-pointer`}
          onClick={() => setLocation('/mi-aprendizaje/cursos')}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
            <CardTitle className="text-sm font-medium text-white">Mis Materias</CardTitle>
            <BookOpen className="w-5 h-5 text-[#9f25b8]" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white">4</div>
            <p className="text-xs text-white/60 mt-1">Materias este ano</p>
          </CardContent>
        </Card>

        <Card 
          className={`${CARD_STYLE} cursor-pointer`}
          onClick={() => setLocation('/mi-aprendizaje/tareas')}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
            <CardTitle className="text-sm font-medium text-white">Tareas Pendientes</CardTitle>
            <GraduationCap className="w-5 h-5 text-[#9f25b8]" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white">{assignments.length}</div>
            <p className="text-xs text-white/60 mt-1">Por entregar esta semana</p>
          </CardContent>
        </Card>

        <Card 
          className={`${CARD_STYLE} cursor-pointer`}
          onClick={() => setLocation('/mi-aprendizaje/notas')}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
            <CardTitle className="text-sm font-medium text-white">Materias Perdidas</CardTitle>
            <AlertTriangle className={`w-5 h-5 ${RED_ALERT}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-3xl font-bold ${RED_ALERT}`}>2</div>
            <p className="text-xs text-white/60 mt-1">Requieren atencion</p>
          </CardContent>
        </Card>

        <Card 
          className={`${CARD_STYLE} cursor-pointer`}
          onClick={() => setLocation('/mi-aprendizaje/notas')}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
            <CardTitle className="text-sm font-medium text-white">Puesto en el Salon</CardTitle>
            <Trophy className={`w-5 h-5 text-[${YELLOW_TROPHY}]`} />
          </CardHeader>
          <CardContent>
            <div className={`text-3xl font-bold text-[${YELLOW_TROPHY}]`}>#5</div>
            <p className="text-xs text-white/60 mt-1">De 32 estudiantes</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card 
          className={`${CARD_STYLE} cursor-pointer`}
          onClick={() => setLocation('/mi-aprendizaje/calendario')}
        >
          <CardHeader>
            <CardTitle className="text-white">Calendario de Tareas</CardTitle>
            <CardDescription className="text-white/60">
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
              <div onClick={(e) => e.stopPropagation()}>
                <Calendar assignments={assignments} onDayClick={handleDayClick} />
              </div>
            )}
          </CardContent>
        </Card>

        <AIChatBox rol="estudiante" />
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card 
          className={`${CARD_STYLE} cursor-pointer`}
          onClick={() => setLocation('/courses')}
        >
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <BookOpen className="w-5 h-5 text-[#9f25b8]" />
              Mis Cursos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white">5</div>
            <p className="text-sm text-white/50 mt-1">Cursos a cargo</p>
          </CardContent>
        </Card>

        <Card 
          className={`${CARD_STYLE} cursor-pointer`}
          onClick={() => setLocation('/courses')}
        >
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <GraduationCap className="w-5 h-5 text-[#9f25b8]" />
              Estudiantes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white">142</div>
            <p className="text-sm text-white/50 mt-1">Estudiantes totales</p>
          </CardContent>
        </Card>

        <Card 
          className={`${CARD_STYLE} cursor-pointer`}
          onClick={() => setLocation('/materials')}
        >
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <MessageSquare className="w-5 h-5 text-[#9f25b8]" />
              Materiales
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white">38</div>
            <p className="text-sm text-white/50 mt-1">Subidos este mes</p>
          </CardContent>
        </Card>

        <Card className={CARD_STYLE}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <TrendingUp className="w-5 h-5 text-[#9f25b8]" />
              Engagement
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white">85%</div>
            <p className="text-sm text-white/50 mt-1">Participacion promedio</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card 
          className={`${CARD_STYLE} cursor-pointer`}
          onClick={() => setLocation('/teacher-calendar')}
        >
          <CardHeader>
            <CardTitle className="text-white">Calendario de Tareas</CardTitle>
            <CardDescription className="text-white/60">
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
              <div onClick={(e) => e.stopPropagation()}>
                <Calendar assignments={assignments} onDayClick={handleDayClick} />
              </div>
            )}
          </CardContent>
        </Card>

        <AIChatBox rol="profesor" />
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
          className={`${CARD_STYLE} cursor-pointer`}
          onClick={() => setLocation('/directivo')}
        >
          <CardHeader>
            <CardTitle className="text-white text-sm">Profesores</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white">24</div>
          </CardContent>
        </Card>

        <Card 
          className={`${CARD_STYLE} cursor-pointer`}
          onClick={() => setLocation('/directivo')}
        >
          <CardHeader>
            <CardTitle className="text-white text-sm">Estudiantes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white">680</div>
          </CardContent>
        </Card>

        <Card 
          className={`${CARD_STYLE} cursor-pointer`}
          onClick={() => setLocation('/courses')}
        >
          <CardHeader>
            <CardTitle className="text-white text-sm">Cursos Activos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white">42</div>
          </CardContent>
        </Card>

        <Card className={CARD_STYLE}>
          <CardHeader>
            <CardTitle className="text-white text-sm">Uso IA</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white">1.2k</div>
            <p className="text-sm text-white/50 mt-1">Consultas/mes</p>
          </CardContent>
        </Card>
      </div>

      <AIChatBox rol="directivo" />
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
          className={`${CARD_STYLE} cursor-pointer`}
          onClick={() => setLocation('/parent')}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
            <CardTitle className="text-sm font-medium text-white">Progreso Académico</CardTitle>
            <TrendingUp className="w-5 h-5 text-[#9f25b8]" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white">4.3</div>
            <p className="text-xs text-white/60 mt-1">Promedio general</p>
          </CardContent>
        </Card>

        <Card 
          className={`${CARD_STYLE} cursor-pointer`}
          onClick={() => setLocation('/parent')}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
            <CardTitle className="text-sm font-medium text-white">Tareas del Hijo</CardTitle>
            <GraduationCap className="w-5 h-5 text-[#9f25b8]" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white">{assignments.length}</div>
            <p className="text-xs text-white/60 mt-1">Tareas este mes</p>
          </CardContent>
        </Card>

        <Card 
          className={`${CARD_STYLE} cursor-pointer`}
          onClick={() => setLocation('/parent')}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
            <CardTitle className="text-sm font-medium text-white">Materias</CardTitle>
            <BookOpen className="w-5 h-5 text-[#9f25b8]" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white">5</div>
            <p className="text-xs text-white/60 mt-1">Materias activas</p>
          </CardContent>
        </Card>

        <Card 
          className={`${CARD_STYLE} cursor-pointer`}
          onClick={() => setLocation('/parent')}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
            <CardTitle className="text-sm font-medium text-white">Asistencia</CardTitle>
            <Trophy className="w-5 h-5 text-[#facc15]" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white">95%</div>
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
                  <div key={materia} className="p-4 bg-white/5 rounded-xl">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-white font-medium">{materia}</span>
                      <span className="text-[#9f25b8] font-bold">{score}/5.0</span>
                    </div>
                    <div className="w-full bg-white/10 rounded-full h-2">
                      <div className={`bg-gradient-to-r ${GRADIENT_STYLE} h-2 rounded-full`} style={{ width: `${widthPercent}%` }} />
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
        // Estos roles se redirigen a sus páginas específicas
        return null;
      default:
        return null;
    }
  };

  return (
    <div data-testid="dashboard-page">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-white mb-2 font-['Poppins']">
          Bienvenido, {user?.nombre?.split(' ')[0] || 'Usuario'}
        </h1>
        <p className="text-white/60">
          {new Date().toLocaleDateString('es-CO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {getDashboardContent()}
    </div>
  );
}
