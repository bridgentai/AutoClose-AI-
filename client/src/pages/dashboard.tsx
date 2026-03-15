import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/lib/authContext';
import { BookOpen, GraduationCap, MessageSquare, TrendingUp, AlertTriangle, Trophy, Send, Loader2, Bot, ClipboardList, Building2, Plus, UserPlus, Users, CheckCircle2, XCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Calendar } from '@/components/Calendar';
import { CalendarGeneral } from '@/components/CalendarGeneral';
import { useLocation } from 'wouter';
import { useQuery, useQueries } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useInstitutionColors } from '@/hooks/useInstitutionColors';
import { AdminGeneralColegioDashboard } from './admin-general-colegio-dashboard';

interface Assignment {
  _id: string;
  titulo: string;
  descripcion: string;
  curso: string;
  fechaEntrega: string;
  profesorNombre: string;
}

interface ProfessorGroupAssignment {
  groupId: string;
  subjects?: unknown[];
  totalStudents?: number;
}

interface Message {
  emisor: 'user' | 'ai';
  contenido: string;
  timestamp: Date;
}

const CARD_STYLE = `panel-grades border border-white/10 rounded-2xl hover-elevate`;
const GRADIENT_STYLE = 'from-[#3B82F6] to-[#1D4ED8]';

interface AIChatBoxProps {
  rol: string;
}

function AIChatBox({ rol }: AIChatBoxProps) {
  const [, setLocation] = useLocation();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const { colorPrimario, colorSecundario } = useInstitutionColors();
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
      const response = await apiRequest<{ success: boolean; response: string; error?: string; executedActions?: string[]; actionData?: Record<string, any> }>('POST', '/api/ai/chat', {
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
      
      // Si se ejecutaron acciones, refrescar la página o mostrar notificación
      if (response.executedActions && response.executedActions.length > 0) {
        // Si se crearon logros de calificación, refrescar la página después de un breve delay
        if (response.executedActions.includes('crear_logros_calificacion')) {
          setTimeout(() => {
            window.location.reload();
          }, 1500);
        }
      }
      
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
      className={`${CARD_STYLE} cursor-pointer flex flex-col h-full gradient-overlay-blue hover-glow`}
      onClick={() => setLocation('/chat')}
    >
      <CardHeader className="pb-3 flex-shrink-0">
        <CardTitle className="text-white flex items-center gap-2 text-lg text-expressive">
          <Bot className="w-5 h-5 text-[#ffd700] animate-pulse-glow" />
          Kiwi Assist
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
                <div 
                  className="w-14 h-14 rounded-xl mx-auto mb-3 flex items-center justify-center badge-glow animate-float"
                  style={{
                    background: `linear-gradient(to bottom right, ${colorPrimario}, ${colorSecundario})`
                  }}
                >
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
                    <div
                      className="max-w-[85%] px-3 py-2 rounded-lg rounded-br-sm text-sm text-white hover-glow"
                      style={{
                        background: `linear-gradient(to right, ${colorPrimario}, ${colorSecundario})`
                      }}
                    >
                      <p className="text-[14px] leading-relaxed whitespace-pre-wrap">{msg.contenido}</p>
                    </div>
                  ) : (
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
              className="w-8 h-8 rounded-lg bg-gradient-to-r from-[#002366] to-[#1e3cff] hover:opacity-90 text-white disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
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

  // Query para obtener cursos del estudiante
  const { data: courses = [], isLoading: isLoadingCourses } = useQuery<any[]>({
    queryKey: ['studentCourses', user?.id],
    queryFn: () => apiRequest('GET', '/api/users/me/courses'),
    enabled: !!user?.id && user?.rol === 'estudiante',
    staleTime: 0,
  });

  // Query para obtener tareas del estudiante (todas; el calendario filtra por mes en cliente)
  const { data: assignments = [], isLoading: isLoadingAssignments } = useQuery<Assignment[]>({
    queryKey: ['studentAssignments', user?.curso],
    queryFn: () => apiRequest('GET', '/api/assignments/student'),
    enabled: !!user?.id && !!user?.curso,
    staleTime: 0,
  });

  const now = new Date();
  const assignmentsThisMonth = useMemo(() => {
    const m = now.getMonth();
    const y = now.getFullYear();
    return assignments.filter((a) => {
      const d = new Date(a.fechaEntrega);
      return d.getMonth() === m && d.getFullYear() === y;
    });
  }, [assignments]);

  // Separar tareas por estado (misma lógica que student-tasks.tsx)
  const submissions = (assignment: Assignment) => (assignment as any).submissions || (assignment as any).entregas || [];
  const mySubmission = (assignment: Assignment) => submissions(assignment).find(
    (e: any) => e.estudianteId === user?.id
  );
  
  const tareasPorEntregar = useMemo(() => {
    return assignments.filter(assignment => {
      const estado = (assignment as any).estado || (mySubmission(assignment) 
        ? (mySubmission(assignment)?.calificacion !== undefined ? 'calificada' : 'entregada')
        : 'pendiente');
      const fechaEntrega = new Date(assignment.fechaEntrega);
      return estado === 'pendiente' && fechaEntrega >= now;
    });
  }, [assignments, user?.id, now]);

  const tareasCompletadas = useMemo(() => {
    return assignments.filter(assignment => {
      const estado = (assignment as any).estado || (mySubmission(assignment) 
        ? (mySubmission(assignment)?.calificacion !== undefined ? 'calificada' : 'entregada')
        : 'pendiente');
      return estado === 'calificada' || estado === 'entregada';
    });
  }, [assignments, user?.id]);

  // Notas del estudiante (misma fuente que Mis Notas): para contar materias perdidas (promedio ponderado < 65)
  const { data: notesData } = useQuery<{
    materias: {
      _id: string;
      nombre: string;
      groupSubjectId?: string | null;
      promedio: number;
      notas: { nota: number; gradingCategoryId?: string; fecha?: string }[];
    }[];
    total: number;
  }>({
    queryKey: ['studentNotes', user?.id],
    queryFn: () => apiRequest('GET', '/api/student/notes'),
    enabled: !!user?.id && user?.rol === 'estudiante',
    staleTime: 0,
  });

  const { data: rankingData } = useQuery<{
    puesto: number;
    total: number;
    promedio: number;
    grado: string | null;
  }>({
    queryKey: ['studentRanking', user?.id],
    queryFn: () => apiRequest('GET', '/api/student/ranking'),
    enabled: !!user?.id && user?.rol === 'estudiante',
    staleTime: 60 * 1000,
  });

  const groupSubjectIds = useMemo(
    () => [...new Set((notesData?.materias ?? []).map((m) => m.groupSubjectId).filter(Boolean))] as string[],
    [notesData?.materias]
  );
  const logrosQueries = useQueries({
    queries: groupSubjectIds.map((gsId) => ({
      queryKey: ['/api/logros-calificacion', gsId] as const,
      queryFn: () =>
        apiRequest('GET', `/api/logros-calificacion?courseId=${encodeURIComponent(gsId)}`) as Promise<{
          logros: { _id: string; nombre: string; porcentaje: number; orden?: number }[];
        }>,
      enabled: !!gsId,
    })),
  });
  const logrosByGsId = useMemo(() => {
    const map: Record<string, { _id: string; porcentaje: number; orden?: number }[]> = {};
    groupSubjectIds.forEach((id, i) => {
      const logros = logrosQueries[i]?.data?.logros;
      if (logros?.length) map[id] = logros;
    });
    return map;
  }, [groupSubjectIds, logrosQueries]);

  // Mismo criterio que Mis Notas: promedio ponderado por logros; reprobada = promedio < 65
  const materiasPerdidas = useMemo(() => {
    const materias = notesData?.materias ?? [];
    return materias.filter((m) => {
      const logros = m.groupSubjectId ? logrosByGsId[m.groupSubjectId] : undefined;
      const notas = m.notas ?? [];
      const totalPct = (logros ?? []).reduce((s, l) => s + (l.porcentaje ?? 0), 0);
      const hasWeightedLogros = totalPct > 0 && (logros ?? []).length > 0;
      let promedioFinal: number;
      if (hasWeightedLogros && logros!.length > 0) {
        const logrosOrdenados = [...logros!].sort((a, b) => (a.orden ?? 999) - (b.orden ?? 999));
        let weightedSum = 0;
        for (const logro of logrosOrdenados) {
          const notasEnCategoria = notas.filter((n) => String(n.gradingCategoryId ?? '') === String(logro._id));
          const promCat =
            notasEnCategoria.length > 0
              ? notasEnCategoria.reduce((s, x) => s + (x.nota ?? 0), 0) / notasEnCategoria.length
              : 0;
          weightedSum += promCat * ((logro.porcentaje ?? 0) / 100);
        }
        promedioFinal = weightedSum;
      } else {
        promedioFinal =
          notas.length > 0 ? notas.reduce((s, x) => s + (x.nota ?? 0), 0) / notas.length : m.promedio ?? 0;
      }
      return promedioFinal < 65;
    }).length;
  }, [notesData?.materias, logrosByGsId]);

  const handleDayClick = (assignment: Assignment) => {
    setLocation(`/assignment/${assignment._id}`);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card
          className={`${CARD_STYLE} cursor-pointer reveal-scale gradient-overlay-blue`}
          style={{ animationDelay: '0.1s' }}
          onClick={() => setLocation('/mi-aprendizaje/cursos')}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
            <CardTitle className="text-sm font-medium text-white">Mis Materias</CardTitle>
            <BookOpen className="w-5 h-5 text-[#ffd700] animate-float" style={{ animationDelay: '0.5s' }} />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white font-['Poppins']">
              {isLoadingCourses ? '—' : courses.length}
            </div>
            <p className="text-xs text-white/60 mt-1">Materias este año</p>
          </CardContent>
        </Card>

        <Card
          className={`${CARD_STYLE} cursor-pointer reveal-scale gradient-overlay-blue`}
          style={{ animationDelay: '0.2s' }}
          onClick={() => setLocation('/mi-aprendizaje/tareas')}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
            <CardTitle className="text-sm font-medium text-white">Tareas</CardTitle>
            <GraduationCap className="w-5 h-5 text-[#ffd700] animate-pulse-glow" />
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-white/60">Completadas</span>
                <span className="text-xl font-bold text-green-400 font-['Poppins']">
                  {isLoadingAssignments ? '—' : tareasCompletadas.length}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-white/60">Pendientes</span>
                <span className="text-xl font-bold text-yellow-400 font-['Poppins']">
                  {isLoadingAssignments ? '—' : tareasPorEntregar.length}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card
          className={`${CARD_STYLE} cursor-pointer reveal-scale gradient-overlay-blue`}
          style={{ animationDelay: '0.3s' }}
          onClick={() => setLocation('/mi-aprendizaje/notas')}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
            <CardTitle className="text-sm font-medium text-white">Materias Perdidas</CardTitle>
            <AlertTriangle className={`w-5 h-5 ${RED_ALERT} animate-pulse-glow`} />
          </CardHeader>
          <CardContent>
            <div className={`text-3xl font-bold ${RED_ALERT} font-['Poppins']`}>
              {notesData === undefined ? '—' : materiasPerdidas}
            </div>
            <p className="text-xs text-white/60 mt-1">Requieren atención (promedio menor a 65)</p>
          </CardContent>
        </Card>

        <Card
          className={`${CARD_STYLE} cursor-pointer reveal-scale gradient-overlay-blue badge-glow`}
          style={{ animationDelay: '0.4s' }}
          onClick={() => setLocation('/mi-aprendizaje/notas')}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
            <CardTitle className="text-sm font-medium text-white">Puesto en el Salon</CardTitle>
            <Trophy className="w-5 h-5 text-[#facc15] animate-float" />
          </CardHeader>
          <CardContent>
            {rankingData === undefined ? (
              <>
                <div className="text-3xl font-bold text-[#facc15] font-['Poppins']">—</div>
                <p className="text-xs text-white/60 mt-1">Cargando...</p>
              </>
            ) : rankingData.total < 2 || rankingData.puesto === 0 ? (
              <>
                <div className="text-lg font-semibold text-white/80 font-['Poppins']">Sin datos suficientes</div>
                <p className="text-xs text-white/60 mt-1">
                  {rankingData.grado ? `Grado ${rankingData.grado}` : 'Menos de 2 estudiantes con notas'}
                </p>
              </>
            ) : (
              <>
                <div className="text-3xl font-bold text-[#facc15] font-['Poppins']">#{rankingData.puesto}</div>
                <p className="text-xs text-white/60 mt-1">De {rankingData.total} estudiantes</p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card
          className={`${CARD_STYLE} cursor-pointer reveal-slide gradient-overlay-blue`}
          style={{ animationDelay: '0.5s' }}
          onClick={() => setLocation('/mi-aprendizaje/calendario')}
        >
          <CardHeader>
            <CardTitle className="text-white text-expressive">Calendario de Tareas</CardTitle>
            <CardDescription className="text-white/60 text-expressive-subtitle">
              {isLoadingAssignments
                ? 'Cargando tareas...'
                : `${assignmentsThisMonth.length} ${assignmentsThisMonth.length === 1 ? 'tarea asignada' : 'tareas asignadas'} este mes`
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingAssignments ? (
              <div className="flex items-center justify-center py-12">
                <p className="text-white/60">Cargando calendario...</p>
              </div>
            ) : (
              <div onClick={(e) => e.stopPropagation()} className="pulse-blue">
                <Calendar assignments={assignments} onDayClick={handleDayClick} variant="student" />
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

  // Query para grupos asignados (misma fuente que "Mis Grupos Asignados")
  const { data: professorGroups = [], isLoading: isLoadingCourses } = useQuery<ProfessorGroupAssignment[]>({
    queryKey: ['professorGroups'],
    queryFn: () => apiRequest('GET', '/api/professor/my-groups'),
    enabled: !!user?.id && user?.rol === 'profesor',
    staleTime: 0,
  });

  // Query para obtener todas las tareas del profesor (todos sus cursos) para el calendario
  const { data: assignments = [], isLoading: isLoadingAssignments } = useQuery<Assignment[]>({
    queryKey: ['teacherAssignments', user?.id],
    queryFn: () => apiRequest<Assignment[]>('GET', '/api/assignments'),
    enabled: !!user?.id && user?.rol === 'profesor',
    staleTime: 60 * 1000,
  });

  const assignmentsThisMonth = useMemo(() => {
    return assignments.filter((a) => {
      const d = new Date(a.fechaEntrega);
      return d.getMonth() + 1 === currentMonth && d.getFullYear() === currentYear;
    });
  }, [assignments, currentMonth, currentYear]);

  // Query para tareas por revisar (estado entregada / por calificar)
  const { data: pendingReview = [], isLoading: isLoadingPending } = useQuery<Assignment[]>({
    queryKey: ['teacherPendingReview', user?.id],
    queryFn: async () => {
      return apiRequest('GET', `/api/assignments/profesor/${user?.id}/pending-review`);
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
          className={`${CARD_STYLE} cursor-pointer reveal-scale gradient-overlay-blue`}
          style={{ animationDelay: '0.1s' }}
          onClick={() => setLocation('/courses')}
        >
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white text-expressive">
              <BookOpen className="w-5 h-5 text-[#ffd700] animate-float" />
              Mis Cursos
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingCourses ? (
              <div className="text-3xl font-bold text-white font-['Poppins'] animate-pulse">...</div>
            ) : (
              <div className="text-3xl font-bold text-white font-['Poppins']">{professorGroups.length}</div>
            )}
            <p className="text-sm text-white/50 mt-1 text-expressive-subtitle">Cursos a cargo</p>
          </CardContent>
        </Card>

        <Card
          className={`${CARD_STYLE} cursor-pointer reveal-scale gradient-overlay-blue`}
          style={{ animationDelay: '0.2s' }}
          onClick={() => setLocation('/profesor/tareas-por-revisar')}
        >
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white text-expressive">
              <ClipboardList className="w-5 h-5 text-[#ffd700] animate-pulse-glow" />
              Asignaciones
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingPending ? (
              <div className="text-3xl font-bold text-white font-['Poppins'] animate-pulse">...</div>
            ) : (
              <div className="text-3xl font-bold text-white font-['Poppins']">{pendingReview.length}</div>
            )}
            <p className="text-sm text-white/50 mt-1 text-expressive-subtitle">Pendientes de revisión</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card
          className={`${CARD_STYLE} cursor-pointer reveal-slide gradient-overlay-blue`}
          style={{ animationDelay: '0.3s' }}
          onClick={() => setLocation('/teacher-calendar')}
        >
          <CardHeader>
            <CardTitle className="text-white text-expressive">Calendario de Tareas</CardTitle>
            <CardDescription className="text-white/60 text-expressive-subtitle">
              {isLoadingAssignments
                ? 'Cargando tareas...'
                : `${assignmentsThisMonth.length} ${assignmentsThisMonth.length === 1 ? 'tarea asignada' : 'tareas asignadas'} este mes (${assignments.length} en total)`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingAssignments ? (
              <div className="flex items-center justify-center py-12">
                <p className="text-white/60">Cargando calendario...</p>
              </div>
            ) : (
              <div onClick={(e) => e.stopPropagation()} className="pulse-blue">
                <Calendar assignments={assignments} onDayClick={handleDayClick} variant="teacher" />
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
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  // Obtener estadísticas reales del colegio
  const { data: stats, isLoading: isLoadingStats } = useQuery<{ estudiantes: number; profesores: number; padres: number; directivos: number; cursos: number; materias: number }>({
    queryKey: ['adminStats', user?.colegioId],
    queryFn: () => apiRequest('GET', '/api/users/stats'),
    enabled: !!user?.colegioId && user?.rol === 'directivo',
    staleTime: 0,
  });

  // Obtener eventos del calendario general para el directivo
  const desde = useMemo(() => {
    const firstDay = new Date(currentYear, currentMonth - 1, 1);
    return firstDay.toISOString().slice(0, 10);
  }, [currentYear, currentMonth]);

  const hasta = useMemo(() => {
    const lastDay = new Date(currentYear, currentMonth, 0);
    return lastDay.toISOString().slice(0, 10);
  }, [currentYear, currentMonth]);

  const { data: calendarEvents = [], isLoading: isLoadingEvents } = useQuery<any[]>({
    queryKey: ['directivoEvents', user?.colegioId, desde, hasta],
    queryFn: () => apiRequest('GET', `/api/events?desde=${desde}&hasta=${hasta}`),
    enabled: !!user?.colegioId && user?.rol === 'directivo',
    staleTime: 0,
  });

  const eventsThisMonth = useMemo(() => {
    const m = now.getMonth();
    const y = now.getFullYear();
    return calendarEvents.filter((e) => {
      const d = new Date(e.fecha);
      return d.getMonth() === m && d.getFullYear() === y;
    });
  }, [calendarEvents, now]);

  const handleEventClick = (event: any) => {
    // Navegar al calendario de eventos completo
    setLocation('/comunidad/calendario');
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card
          className={`${CARD_STYLE} cursor-pointer reveal-scale gradient-overlay-blue`}
          style={{ animationDelay: '0.1s' }}
          onClick={() => setLocation('/directivo')}
        >
          <CardHeader>
            <CardTitle className="text-white text-sm text-expressive-subtitle">Profesores</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white font-['Poppins']">
              {isLoadingStats ? '—' : (stats?.profesores ?? '—')}
            </div>
          </CardContent>
        </Card>

        <Card
          className={`${CARD_STYLE} cursor-pointer reveal-scale gradient-overlay-blue`}
          style={{ animationDelay: '0.2s' }}
          onClick={() => setLocation('/directivo')}
        >
          <CardHeader>
            <CardTitle className="text-white text-sm text-expressive-subtitle">Estudiantes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white font-['Poppins']">
              {isLoadingStats ? '—' : (stats?.estudiantes ?? '—')}
            </div>
          </CardContent>
        </Card>

        <Card
          className={`${CARD_STYLE} cursor-pointer reveal-scale gradient-overlay-blue`}
          style={{ animationDelay: '0.3s' }}
          onClick={() => setLocation('/directivo/cursos')}
        >
          <CardHeader>
            <CardTitle className="text-white text-sm text-expressive-subtitle">Cursos Activos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white font-['Poppins']">
              {isLoadingStats ? '—' : (stats?.cursos ?? '—')}
            </div>
          </CardContent>
        </Card>

        <Card 
          className={`${CARD_STYLE} cursor-pointer reveal-scale gradient-overlay-blue hover-glow`}
          style={{ animationDelay: '0.4s' }}
          onClick={() => setLocation('/directivo/cursos')}
        >
          <CardHeader>
            <CardTitle className="text-white text-sm text-expressive-subtitle">Materias</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white font-['Poppins']">
              {isLoadingStats ? '—' : (stats?.materias ?? '—')}
            </div>
            <p className="text-sm text-white/50 mt-1 text-expressive-subtitle">Cursos / grupos</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card
          className={`${CARD_STYLE} cursor-pointer reveal-slide gradient-overlay-blue`}
          style={{ animationDelay: '0.5s' }}
          onClick={() => setLocation('/comunidad/calendario')}
        >
          <CardHeader>
            <CardTitle className="text-white text-expressive">Calendario de Eventos</CardTitle>
            <CardDescription className="text-white/60 text-expressive-subtitle">
              {isLoadingEvents
                ? 'Cargando eventos...'
                : `${eventsThisMonth.length} ${eventsThisMonth.length === 1 ? 'evento programado' : 'eventos programados'} este mes`
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingEvents ? (
              <div className="flex items-center justify-center py-12">
                <p className="text-white/60">Cargando calendario...</p>
              </div>
            ) : (
              <div onClick={(e) => e.stopPropagation()} className="pulse-blue">
                <CalendarGeneral events={calendarEvents} onDayClick={handleEventClick} />
              </div>
            )}
          </CardContent>
        </Card>

        <div className="reveal-slide flex flex-col min-h-[500px]" style={{ animationDelay: '0.6s' }}>
          <AIChatBox rol="directivo" />
        </div>
      </div>
    </div>
  );
}

function SuperAdminDashboard() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [schools, setSchools] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Obtener colores de la institución para usar en los botones
  const { colorPrimario, colorSecundario } = useInstitutionColors();

  // Estados para crear colegio
  const [createSchoolOpen, setCreateSchoolOpen] = useState(false);
  const [newSchool, setNewSchool] = useState({
    nombre: '',
    colegioId: '',
    nombreIA: 'MindOS',
    colorPrimario: '#002366',
    colorSecundario: '#1e3cff',
  });
  const [creatingSchool, setCreatingSchool] = useState(false);

  // Estados para asignar admin
  const [assignAdminOpen, setAssignAdminOpen] = useState(false);
  const [selectedSchoolId, setSelectedSchoolId] = useState('');
  const [newAdmin, setNewAdmin] = useState({
    nombre: '',
    email: '',
    password: '',
  });
  const [assigningAdmin, setAssigningAdmin] = useState(false);

  useEffect(() => {
    loadSchools();
  }, []);

  const loadSchools = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await apiRequest<any[]>('GET', '/api/super-admin/schools');
      setSchools(data);
    } catch (err: any) {
      setError(err.message || 'Error al cargar los colegios');
      console.error('Error al cargar colegios:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSchool = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatingSchool(true);
    setError('');
    setSuccess('');

    try {
      const response = await apiRequest<{ message: string; school: any; codigoAcceso: string; mensaje: string }>('POST', '/api/super-admin/schools', newSchool);
      setSuccess(`Colegio creado exitosamente. ${response.mensaje || `Código de acceso: ${response.codigoAcceso}`}`);
      setCreateSchoolOpen(false);
      setNewSchool({
        nombre: '',
        colegioId: '',
        nombreIA: 'MindOS',
        colorPrimario: '#002366',
        colorSecundario: '#1e3cff',
      });
      loadSchools();
      setTimeout(() => setSuccess(''), 5000); // Mostrar por más tiempo para que se vea el código
    } catch (err: any) {
      setError(err.message || 'Error al crear el colegio');
    } finally {
      setCreatingSchool(false);
    }
  };

  const handleAssignAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAssigningAdmin(true);
    setError('');
    setSuccess('');

    try {
      await apiRequest('POST', `/api/super-admin/schools/${selectedSchoolId}/assign-admin`, newAdmin);
      setSuccess('Super admin del colegio asignado exitosamente');
      setAssignAdminOpen(false);
      setNewAdmin({ nombre: '', email: '', password: '' });
      setSelectedSchoolId('');
      loadSchools();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message || 'Error al asignar super admin');
    } finally {
      setAssigningAdmin(false);
    }
  };

  const openAssignAdminDialog = (colegioId: string) => {
    const school = schools.find(s => s.colegioId === colegioId);
    setSelectedSchoolId(colegioId);
    setNewAdmin({ 
      nombre: school?.superAdmin?.nombre || '', 
      email: school?.superAdmin?.email || '', 
      password: '' 
    });
    setAssignAdminOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Mensajes de éxito/error */}
      {success && (
        <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
          <div className="flex items-center gap-3 mb-2">
            <CheckCircle2 className="w-5 h-5 text-green-400" />
            <p className="text-green-400 font-semibold">¡Éxito!</p>
          </div>
          <p className="text-green-300 text-sm mb-2">{success}</p>
          {success.includes('Código de acceso') && (
            <div className="mt-3 p-3 bg-white/5 rounded border border-white/10">
              <p className="text-white/80 text-xs mb-2 font-semibold">⚠️ IMPORTANTE: Código generado (copia este código COMPLETO):</p>
              <div className="bg-black/30 p-3 rounded border border-green-500/30">
                <code className="text-green-300 font-mono text-xl font-bold block break-all text-center">
                  {(() => {
                    const match = success.match(/Código de acceso generado: ([A-Z0-9_]+)/) || 
                                 success.match(/Código de acceso: ([A-Z0-9_]+)/);
                    return match ? match[1] : 'No encontrado';
                  })()}
                </code>
              </div>
              <p className="text-yellow-300 text-xs mt-2 text-center">
                ⚠️ Debes copiar TODO el código incluyendo los números al final (ejemplo: BODYTECH_1234)
              </p>
            </div>
          )}
        </div>
      )}
      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-3">
          <XCircle className="w-5 h-5 text-red-400" />
          <p className="text-red-400">{error}</p>
        </div>
      )}

      {/* Estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className={CARD_STYLE}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-white">Total Colegios</CardTitle>
            <Building2 className="w-5 h-5 text-[#ffd700]" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white font-['Poppins']">{schools.length}</div>
            <p className="text-xs text-white/60 mt-1">Instituciones registradas</p>
          </CardContent>
        </Card>

        <Card className={CARD_STYLE}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-white">Total Usuarios</CardTitle>
            <Users className="w-5 h-5 text-[#ffd700]" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white font-['Poppins']">
              {schools.reduce((sum, school) => sum + (school.userCount || 0), 0)}
            </div>
            <p className="text-xs text-white/60 mt-1">Usuarios en el sistema</p>
          </CardContent>
        </Card>

        <Card className={CARD_STYLE}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-white">Super Admins Asignados</CardTitle>
            <UserPlus className="w-5 h-5 text-[#ffd700]" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white font-['Poppins']">
              {schools.filter(s => s.superAdmin).length}
            </div>
            <p className="text-xs text-white/60 mt-1">Colegios con super administrador</p>
          </CardContent>
        </Card>
      </div>

      {/* Acciones principales */}
      <div className="flex gap-4">
        <Dialog open={createSchoolOpen} onOpenChange={setCreateSchoolOpen}>
          <DialogTrigger asChild>
            <Button 
              className="hover:opacity-90 text-white"
              style={{
                background: `linear-gradient(to right, ${colorPrimario}, ${colorSecundario})`
              }}
            >
              <Plus className="w-4 h-4 mr-2" />
              Crear Nuevo Colegio
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-[#0a0a2a]/95 border-white/10 text-white max-w-2xl">
            <DialogHeader>
              <DialogTitle>Crear Nuevo Colegio</DialogTitle>
              <DialogDescription className="text-white/60">
                Ingresa la información del nuevo colegio
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateSchool} className="space-y-4">
              <div>
                <Label htmlFor="nombre" className="text-white/90">Nombre del Colegio *</Label>
                <Input
                  id="nombre"
                  value={newSchool.nombre}
                  onChange={(e) => setNewSchool({ ...newSchool, nombre: e.target.value })}
                  className="bg-white/5 border-white/10 text-white mt-1"
                  required
                />
              </div>
              <div>
                <Label htmlFor="colegioId" className="text-white/90">ID del Colegio *</Label>
                <Input
                  id="colegioId"
                  value={newSchool.colegioId}
                  onChange={(e) => setNewSchool({ ...newSchool, colegioId: e.target.value.toUpperCase() })}
                  className="bg-white/5 border-white/10 text-white mt-1"
                  placeholder="Ej: COLEGIO_NUEVO_2025"
                  required
                />
                <p className="text-xs text-white/50 mt-1">Debe ser único y en mayúsculas</p>
              </div>
              <div>
                <Label htmlFor="logoUrl" className="text-white/90">URL del Logo</Label>
                <Input
                  id="logoUrl"
                  value={newSchool.logoUrl}
                  onChange={(e) => setNewSchool({ ...newSchool, logoUrl: e.target.value })}
                  className="bg-white/5 border-white/10 text-white mt-1"
                  placeholder="https://..."
                />
              </div>
              <div>
                <Label className="text-white/90 mb-3 block">Paleta de Colores</Label>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="colorPrimario" className="text-white/80 text-sm mb-2 block">Color Primario</Label>
                    <div className="flex gap-3 items-center">
                      <Input
                        id="colorPrimario"
                        type="color"
                        value={newSchool.colorPrimario}
                        onChange={(e) => setNewSchool({ ...newSchool, colorPrimario: e.target.value })}
                        className="bg-white/5 border-white/10 h-12 w-20 cursor-pointer"
                      />
                      <Input
                        type="text"
                        value={newSchool.colorPrimario}
                        onChange={(e) => setNewSchool({ ...newSchool, colorPrimario: e.target.value })}
                        className="bg-white/5 border-white/10 text-white flex-1 font-mono text-sm"
                        placeholder="#002366"
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="colorSecundario" className="text-white/80 text-sm mb-2 block">Color Secundario</Label>
                    <div className="flex gap-3 items-center">
                      <Input
                        id="colorSecundario"
                        type="color"
                        value={newSchool.colorSecundario}
                        onChange={(e) => setNewSchool({ ...newSchool, colorSecundario: e.target.value })}
                        className="bg-white/5 border-white/10 h-12 w-20 cursor-pointer"
                      />
                      <Input
                        type="text"
                        value={newSchool.colorSecundario}
                        onChange={(e) => setNewSchool({ ...newSchool, colorSecundario: e.target.value })}
                        className="bg-white/5 border-white/10 text-white flex-1 font-mono text-sm"
                        placeholder="#1e3cff"
                      />
                    </div>
                  </div>
                  
                  {/* Paleta de colores predefinidos */}
                  <div>
                    <Label className="text-white/80 text-sm mb-2 block">Colores Predefinidos (clic para seleccionar)</Label>
                    <div className="grid grid-cols-8 gap-2">
                      {[
                        { name: 'Azul Rey', primary: '#002366', secondary: '#1e3cff' },
                        { name: 'Azul', primary: '#3b82f6', secondary: '#1e40af' },
                        { name: 'Verde', primary: '#10b981', secondary: '#059669' },
                        { name: 'Rojo', primary: '#ef4444', secondary: '#dc2626' },
                        { name: 'Naranja', primary: '#f97316', secondary: '#ea580c' },
                        { name: 'Amarillo', primary: '#eab308', secondary: '#ca8a04' },
                        { name: 'Rosa', primary: '#ec4899', secondary: '#db2777' },
                        { name: 'Cian', primary: '#06b6d4', secondary: '#0891b2' },
                        { name: 'Índigo', primary: '#6366f1', secondary: '#4f46e5' },
                        { name: 'Esmeralda', primary: '#14b8a6', secondary: '#0d9488' },
                        { name: 'Violeta', primary: '#8b5cf6', secondary: '#7c3aed' },
                        { name: 'Fucsia', primary: '#d946ef', secondary: '#c026d3' },
                        { name: 'Azul Oscuro', primary: '#1e3a8a', secondary: '#1e40af' },
                        { name: 'Verde Oscuro', primary: '#065f46', secondary: '#047857' },
                        { name: 'Rojo Oscuro', primary: '#991b1b', secondary: '#b91c1c' },
                        { name: 'Gris', primary: '#6b7280', secondary: '#4b5563' },
                      ].map((color, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setNewSchool({ 
                            ...newSchool, 
                            colorPrimario: color.primary, 
                            colorSecundario: color.secondary 
                          })}
                          className="group relative"
                          title={color.name}
                        >
                          <div 
                            className="w-full h-12 rounded-lg border-2 border-white/20 hover:border-white/40 transition-all"
                            style={{
                              background: `linear-gradient(135deg, ${color.primary}, ${color.secondary})`
                            }}
                          />
                          <span className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-white text-xs font-semibold bg-black/30 rounded-lg">
                            {color.name}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCreateSchoolOpen(false)}
                  className="border-white/10 text-white hover:bg-white/10"
                >
                  Cancelar
                </Button>
                  <Button
                    type="submit"
                    disabled={creatingSchool}
                    className="hover:opacity-90 text-white"
                    style={{
                      background: `linear-gradient(to right, ${colorPrimario}, ${colorSecundario})`
                    }}
                  >
                  {creatingSchool ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Creando...
                    </>
                  ) : (
                    'Crear Colegio'
                  )}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Lista de colegios */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-[#ffd700]" />
        </div>
      ) : schools.length === 0 ? (
        <Card className={CARD_STYLE}>
          <CardContent className="py-12 text-center">
            <Building2 className="w-16 h-16 text-white/30 mx-auto mb-4" />
            <p className="text-white/60">No hay colegios registrados aún</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {schools.map((school) => (
            <Card key={school._id} className={CARD_STYLE}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-white text-xl mb-1">{school.nombre}</CardTitle>
                    <CardDescription className="text-white/60">
                      ID: {school.colegioId}
                    </CardDescription>
                  </div>
                  <Badge className="bg-[#002366]/30 text-[#ffd700] border-[#002366]/40">
                    {school.userCount || 0} usuarios
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-white/60">Super Administrador:</span>
                    {school.superAdmin ? (
                      <div className="flex items-center gap-2">
                        <Badge className="bg-green-500/20 text-green-400 border-green-500/40">
                          {school.superAdmin.nombre}
                        </Badge>
                        <span className="text-white/40 text-xs">{school.superAdmin.email}</span>
                      </div>
                    ) : (
                      <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/40">
                        Sin asignar
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-white/60">Creado:</span>
                    <span className="text-white/80">
                      {new Date(school.createdAt).toLocaleDateString('es-CO')}
                    </span>
                  </div>
                </div>
                <div className="flex gap-2 pt-2">
                  <Dialog open={assignAdminOpen && selectedSchoolId === school.colegioId} onOpenChange={(open) => {
                    setAssignAdminOpen(open);
                    if (!open) setSelectedSchoolId('');
                  }}>
                    <DialogTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openAssignAdminDialog(school.colegioId)}
                        className="flex-1 border-white/10 text-white hover:bg-white/10"
                      >
                        <UserPlus className="w-4 h-4 mr-2" />
                        {school.superAdmin ? 'Cambiar Super Admin' : 'Asignar Super Admin'}
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="bg-[#0a0a2a]/95 border-white/10 text-white">
                      <DialogHeader>
                        <DialogTitle>
                          {school.superAdmin ? 'Cambiar Super Admin del Colegio' : 'Asignar Super Admin del Colegio'}
                        </DialogTitle>
                        <DialogDescription className="text-white/60">
                          {school.superAdmin 
                            ? 'Actualiza la información del super administrador del colegio'
                            : 'Crea un nuevo super administrador para este colegio'}
                        </DialogDescription>
                      </DialogHeader>
                      <form onSubmit={handleAssignAdmin} className="space-y-4">
                        <div>
                          <Label htmlFor="admin-nombre" className="text-white/90">Nombre *</Label>
                          <Input
                            id="admin-nombre"
                            value={newAdmin.nombre}
                            onChange={(e) => setNewAdmin({ ...newAdmin, nombre: e.target.value })}
                            className="bg-white/5 border-white/10 text-white mt-1"
                            required
                          />
                        </div>
                        <div>
                          <Label htmlFor="admin-email" className="text-white/90">Email *</Label>
                          <Input
                            id="admin-email"
                            type="email"
                            value={newAdmin.email}
                            onChange={(e) => setNewAdmin({ ...newAdmin, email: e.target.value })}
                            className="bg-white/5 border-white/10 text-white mt-1"
                            required
                          />
                        </div>
                        <div>
                          <Label htmlFor="admin-password" className="text-white/90">
                            {school.superAdmin ? 'Nueva Contraseña (opcional)' : 'Contraseña *'}
                          </Label>
                          <Input
                            id="admin-password"
                            type="password"
                            value={newAdmin.password}
                            onChange={(e) => setNewAdmin({ ...newAdmin, password: e.target.value })}
                            className="bg-white/5 border-white/10 text-white mt-1"
                            required={!school.superAdmin}
                          />
                        </div>
                        <div className="flex justify-end gap-3 pt-4">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                              setAssignAdminOpen(false);
                              setSelectedSchoolId('');
                            }}
                            className="border-white/10 text-white hover:bg-white/10"
                          >
                            Cancelar
                          </Button>
                          <Button
                            type="submit"
                            disabled={assigningAdmin}
                            className="hover:opacity-90 text-white"
                            style={{
                              background: `linear-gradient(to right, ${colorPrimario}, ${colorSecundario})`
                            }}
                          >
                            {assigningAdmin ? (
                              <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                {school.superAdmin ? 'Actualizando...' : 'Asignando...'}
                              </>
                            ) : (
                              school.superAdmin ? 'Actualizar' : 'Asignar'
                            )}
                          </Button>
                        </div>
                      </form>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function PadreDashboard() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { colorPrimario, colorSecundario } = useInstitutionColors();

  const { data: hijos = [] } = useQuery({
    queryKey: ['/api/users/me/hijos'],
    queryFn: () => apiRequest<{ _id: string; nombre: string; curso: string }[]>('GET', '/api/users/me/hijos'),
  });
  const primerHijoId = hijos[0]?._id;

  const { data: attendanceResumen } = useQuery({
    queryKey: ['/api/attendance/resumen/estudiante', primerHijoId],
    queryFn: () => apiRequest<{ porcentaje: number; total: number; presentes: number }>('GET', `/api/attendance/resumen/estudiante/${primerHijoId}`),
    enabled: !!primerHijoId,
  });

  const { data: notasData } = useQuery({
    queryKey: ['/api/student/hijo', primerHijoId, 'notes'],
    queryFn: () => apiRequest<{ materias: { nombre: string; promedio: number; ultimaNota: number }[]; total: number }>('GET', `/api/student/hijo/${primerHijoId}/notes`),
    enabled: !!primerHijoId,
  });

  const { data: assignments = [] } = useQuery<Assignment[]>({
    queryKey: ['parentAssignments', primerHijoId],
    queryFn: () => apiRequest<Assignment[]>('GET', `/api/assignments/hijo/${primerHijoId}`),
    enabled: !!primerHijoId,
    staleTime: 0,
  });

  const materias = notasData?.materias ?? [];
  const promedioGeneral = materias.length
    ? materias.reduce((s, m) => s + (m.promedio ?? 0), 0) / materias.length
    : 0;
  const promedioDisplay = promedioGeneral.toFixed(1);
  const nombreHijo = hijos[0]?.nombre || 'tu hijo/a';

  const now = new Date();
  const assignmentsThisMonth = useMemo(() => {
    const m = now.getMonth();
    const y = now.getFullYear();
    return assignments.filter((a) => {
      const d = new Date(a.fechaEntrega);
      return d.getMonth() === m && d.getFullYear() === y;
    });
  }, [assignments]);

  const handleDayClick = (assignment: Assignment) => {
    setLocation(`/assignment/${assignment._id}`);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card
          className={`${CARD_STYLE} cursor-pointer reveal-scale gradient-overlay-blue`}
          style={{ animationDelay: '0.1s' }}
          onClick={() => setLocation('/mi-aprendizaje/notas')}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
            <CardTitle className="text-sm font-medium text-white text-expressive-subtitle">Progreso Académico</CardTitle>
            <TrendingUp className="w-5 h-5 text-[#ffd700] animate-float" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white font-['Poppins']">{promedioDisplay}</div>
            <p className="text-xs text-white/60 mt-1">Promedio general ({nombreHijo})</p>
          </CardContent>
        </Card>

        <Card
          className={`${CARD_STYLE} cursor-pointer reveal-scale gradient-overlay-blue`}
          style={{ animationDelay: '0.2s' }}
          onClick={() => setLocation('/calendar')}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
            <CardTitle className="text-sm font-medium text-white text-expressive-subtitle">Tareas de {nombreHijo}</CardTitle>
            <GraduationCap className="w-5 h-5 text-[#ffd700] animate-pulse-glow" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white font-['Poppins']">{assignmentsThisMonth.length}</div>
            <p className="text-xs text-white/60 mt-1">Tareas este mes (solo visualización)</p>
          </CardContent>
        </Card>

        <Card
          className={`${CARD_STYLE} cursor-pointer reveal-scale gradient-overlay-blue`}
          style={{ animationDelay: '0.3s' }}
          onClick={() => setLocation('/parent/materias')}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
            <CardTitle className="text-sm font-medium text-white text-expressive-subtitle">Materias de {nombreHijo}</CardTitle>
            <BookOpen className="w-5 h-5 text-[#ffd700] animate-float" style={{ animationDelay: '0.5s' }} />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white font-['Poppins']">{materias.length}</div>
            <p className="text-xs text-white/60 mt-1">Materias activas (solo visualización)</p>
          </CardContent>
        </Card>

        <Card
          className={`${CARD_STYLE} cursor-pointer reveal-scale gradient-overlay-blue badge-glow`}
          style={{ animationDelay: '0.4s' }}
          onClick={() => setLocation('/parent')}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
            <CardTitle className="text-sm font-medium text-white text-expressive-subtitle">Asistencia de {nombreHijo}</CardTitle>
            <Trophy className="w-5 h-5 text-[#facc15] animate-float" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white font-['Poppins']">{attendanceResumen?.porcentaje ?? '—'}%</div>
            <p className="text-xs text-white/60 mt-1">Este mes</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className={CARD_STYLE}>
          <CardHeader>
            <CardTitle className="text-white">Seguimiento de {nombreHijo}</CardTitle>
            <CardDescription className="text-white/60">Progreso académico (solo visualización)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {materias.length === 0 ? (
                <p className="text-white/60 py-4">No hay notas cargadas aún. {!primerHijoId && 'Vincula un estudiante en tu perfil.'}</p>
              ) : (
                materias.map((materia, index) => {
                  const score = materia.ultimaNota ?? materia.promedio;
                  const widthPercent = Math.min(100, score);
                  return (
                    <div
                      key={materia._id || materia.nombre}
                      className="p-4 bg-white/5 rounded-xl hover-lift reveal-scale gradient-overlay-blue"
                      style={{ animationDelay: `${0.7 + index * 0.1}s` }}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-white font-medium text-expressive-subtitle">{materia.nombre}</span>
                        <span className="text-[#ffd700] font-bold font-['Poppins']">{Math.round(score || 0)}/100</span>
                      </div>
                      <div className="w-full bg-white/10 rounded-full h-3 overflow-hidden progress-bar">
                        <div
                          className="h-3 rounded-full transition-all duration-1000 ease-out hover-glow"
                          style={{
                            background: `linear-gradient(to right, ${colorPrimario}, ${colorSecundario})`,
                            width: `${widthPercent}%`
                          }}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>

        <Card
          className={`${CARD_STYLE} cursor-pointer`}
          onClick={() => setLocation('/calendar')}
        >
          <CardHeader>
            <CardTitle className="text-white">Tareas de {nombreHijo}</CardTitle>
            <CardDescription className="text-white/60">
              Calendario (igual que el de tu hijo, solo visualización)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div onClick={(e) => e.stopPropagation()}>
              <Calendar assignments={assignments} onDayClick={handleDayClick} variant="student" />
            </div>
          </CardContent>
        </Card>
      </div>

      <AIChatBox rol="padre" />
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
      case 'admin-general-colegio':
      case 'school_admin':
        return <AdminGeneralColegioDashboard />;
      case 'administrador-general':
      case 'transporte':
      case 'tesoreria':
      case 'nutricion':
      case 'cafeteria':
      case 'asistente':
        // Estos roles se redirigen a sus páginas específicas
        return null;
      case 'super_admin':
        // Super admin general ve su dashboard de gestión
        return <SuperAdminDashboard />;
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
