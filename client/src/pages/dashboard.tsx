import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/lib/authContext';
import { BookOpen, GraduationCap, MessageSquare, TrendingUp, AlertTriangle, Trophy, Send, Loader2, Bot, ClipboardList, Building2, Plus, UserPlus, Users, CheckCircle2, XCircle, Mail, FileText, ArrowUp, ArrowDown, Bell, FileCheck, ChevronRight, Eye, Cloud } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import kiwiImg from '@/assets/kiwi sentado.png';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Calendar,
  CALENDAR_SUMMARY_LABELS_INSTITUTIONAL_EVENTS,
  type CalendarAssignment,
} from '@/components/Calendar';
import { useLocation } from 'wouter';
import { useQuery, useQueries } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useInstitutionColors } from '@/hooks/useInstitutionColors';
import {
  weightedGradeWithinLogro,
  courseGradeFromOutcomes,
  hasRecordedScore,
  type OutcomeGradeNode,
} from '@shared/weightedGrades';
import { AdminGeneralColegioDashboard } from './admin-general-colegio-dashboard';
import { getAssignmentCalendarLocalParts } from '@/lib/assignmentUtils';
import { DashboardWelcomeBanner } from '@/components/dashboard-welcome-banner';
import { EvoDocCard } from '@/components/evo-doc-card';
import { useKiwiChatStream } from '@/hooks/useKiwiChatStream';

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
  groupName?: string;
  subjects?: unknown[];
  totalStudents?: number;
}

const CARD_STYLE = `panel-grades border border-white/10 rounded-2xl hover-elevate`;
const GRADIENT_STYLE = 'from-[#3B82F6] to-[#1D4ED8]';

function readPermisosSalidaCount(userId: string | undefined): number {
  if (!userId || typeof window === 'undefined') return 0;
  try {
    const raw = window.localStorage.getItem(`permisos_${userId}`);
    if (!raw) return 0;
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.length : 0;
  } catch {
    return 0;
  }
}

interface AIChatBoxProps {
  rol: string;
  footer?: React.ReactNode;
  /** Vista reducida (p. ej. mitad inferior del dashboard padre junto al calendario). */
  compact?: boolean;
  endHeader?: React.ReactNode;
}

function AIChatBox({ rol, footer, compact, endHeader }: AIChatBoxProps) {
  const [, setLocation] = useLocation();
  const {
    messages,
    input,
    setInput,
    loading,
    isStreaming,
    activeToolStep,
    messagesEndRef,
    sendMessage,
    handleSendFromInput,
  } = useKiwiChatStream();
  const { colorPrimario, colorSecundario } = useInstitutionColors();

  const emptySubtitle =
    rol === 'estudiante'
      ? 'Pregúntame sobre tus tareas, notas o materias'
      : rol === 'profesor'
        ? 'Crea tareas, revisa entregas o genera materiales'
        : rol === 'padre'
          ? '¿Qué tareas tiene pendientes? ¿Cómo va en Matemáticas?'
          : 'Consulta reportes, estadísticas o gestiona el colegio';

  const mascotSize = compact ? 120 : 220;
  const mascotWrap = compact ? 120 : 220;
  const compactHero = Boolean(
    compact && (rol === 'padre' || rol === 'directivo') && messages.length === 0
  );
  const directivoCompactHero = compactHero && rol === 'directivo';

  const compactHeroTagline =
    rol === 'padre'
      ? 'Pide tareas, revisa pendientes o crea materiales.'
      : 'Consulta métricas del colegio, redacta ideas para comunicados o prioriza fechas institucionales.';

  return (
    <Card
      className={`cursor-pointer flex flex-col hover-glow ${compactHero
        ? directivoCompactHero
          ? 'relative overflow-hidden rounded-2xl border border-[rgba(59,130,246,0.18)] bg-gradient-to-br from-[#0a1018] via-[#0c1626] to-[#101e32] backdrop-blur-md shadow-[0_0_40px_rgba(37,99,235,0.14),inset_0_1px_0_rgba(255,255,255,0.06)]'
          : 'relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-[#0a0e1c] via-[#0f1628] to-[#141e38] backdrop-blur-md shadow-[0_0_40px_rgba(37,99,235,0.12),inset_0_1px_0_rgba(255,255,255,0.06)]'
        : `${CARD_STYLE} gradient-overlay-blue ${rol === 'padre'
          ? 'bg-gradient-to-br from-[rgba(37,99,235,0.08)] to-[rgba(255,215,0,0.04)] backdrop-blur-lg border border-[rgba(255,215,0,0.12)]'
          : ''
        } ${compact ? 'min-h-0' : ''}`}`}
      onClick={() => setLocation('/chat')}
    >
      {compactHero ? (
        <div
          className="pointer-events-none absolute inset-0 opacity-90"
          aria-hidden
          style={{
            background:
              directivoCompactHero
                ? 'radial-gradient(ellipse 80% 65% at 95% 95%, rgba(0,200,255,0.12) 0%, rgba(15,23,42,0) 55%)'
                : 'radial-gradient(ellipse 85% 70% at 100% 100%, rgba(59,130,246,0.18) 0%, rgba(15,23,42,0) 55%)',
          }}
        />
      ) : null}

      <CardHeader className={`relative flex-shrink-0 z-[1] ${compactHero ? 'pb-1.5 pt-3.5 px-4' : compact ? 'pb-2 pt-4 px-4' : 'pb-3'}`}>
        <div className="flex items-center justify-between gap-3">
          <CardTitle className={`text-white flex items-center gap-2 font-semibold text-expressive ${compactHero ? 'text-base' : compact ? 'text-base' : 'text-lg'}`}>
            <Bot
              className={`${directivoCompactHero ? 'text-[var(--color-primario)]' : 'text-[var(--evo-gold)]'} shrink-0 ${compactHero ? 'w-[18px] h-[18px]' : compact ? 'w-4 h-4 animate-pulse-glow' : 'w-5 h-5 animate-pulse-glow'}`}
            />
            Kiwi Assist
          </CardTitle>
          {endHeader ? (
            <div className="shrink-0 text-sm text-white/50 hover:text-white/75 transition-colors">
              {endHeader}
            </div>
          ) : null}
        </div>
        {!compactHero ? (
          <CardDescription className={`text-white/60 text-expressive-subtitle mt-2 ${compact ? 'text-xs line-clamp-2' : 'text-sm'}`}>
            {emptySubtitle}
          </CardDescription>
        ) : null}
      </CardHeader>

      <CardContent onClick={(e) => e.stopPropagation()} className={`relative z-[1] ${compactHero ? 'flex flex-col px-4 pb-3 pt-0 overflow-hidden' : compact ? 'flex flex-col p-3 pt-2' : 'flex-1 flex flex-col min-h-0 p-4 pt-4'}`}>
        <div className={compactHero ? '' : compact ? 'space-y-3 pr-2' : 'flex-1 space-y-3 overflow-y-auto pr-2 min-h-0'}>
          {messages.length === 0 ? (
            compactHero ? (
              <div
                className={`relative ${directivoCompactHero ? 'min-h-[102px] h-[108px] sm:h-[118px]' : 'min-h-[88px] h-[92px] sm:h-[100px]'}`}
              >
                <p className="text-left text-xs leading-snug text-white/55 max-w-[56%] sm:max-w-[52%] pr-1 pt-0.5 line-clamp-3">
                  {compactHeroTagline}
                </p>
                {directivoCompactHero ? (
                  <div className="relative z-[1] flex flex-wrap gap-1 mt-1.5 max-w-[95%]">
                    {[
                      'Resumen de indicadores',
                      'Circular a padres',
                      'Eventos del mes',
                    ].map((prompt) => (
                      <button
                        key={prompt}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setInput(prompt);
                        }}
                        className="rounded-full border border-white/12 bg-white/[0.06] text-white/55 hover:bg-white/10 hover:text-white/90 transition-colors text-[9px] px-1.5 py-0.5"
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                ) : null}
                <div
                  className="pointer-events-none absolute right-[-6px] bottom-0 w-[102px] sm:w-[118px]"
                  aria-hidden
                >
                  <div
                    className="absolute -inset-4 opacity-60"
                    style={{
                      background:
                        'radial-gradient(50% 50% at 55% 50%, rgba(59,130,246,0.32) 0%, transparent 70%)',
                      filter: 'blur(12px)',
                    }}
                  />
                  <img
                    src={kiwiImg}
                    alt=""
                    className="relative w-full h-auto max-h-[96px] sm:max-h-[108px] object-contain object-bottom select-none"
                    style={{
                      filter:
                        'drop-shadow(0 10px 20px rgba(2,6,23,0.55)) drop-shadow(0 0 16px rgba(59,130,246,0.22))',
                    }}
                    draggable={false}
                  />
                </div>
              </div>
            ) : (
              <div className={`flex items-center justify-center py-1 ${compact ? '' : 'h-full min-h-0'}`}>
                <div className={`text-center ${compact ? 'max-w-full px-1' : ''}`}>
                  <div className="flex flex-col items-center">
                    <div
                      className="relative"
                      style={{
                        width: mascotWrap,
                        height: mascotWrap,
                      }}
                    >
                      <div
                        className="absolute inset-0 -z-10"
                        style={{
                          background:
                            'radial-gradient(60% 60% at 50% 45%, rgba(59,130,246,0.22) 0%, rgba(29,78,216,0.10) 35%, rgba(2,6,23,0) 70%)',
                          filter: 'blur(10px)',
                          transform: 'scale(1.08)',
                        }}
                      />
                      <img
                        src={kiwiImg}
                        alt=""
                        aria-hidden="true"
                        className="select-none absolute left-1/2 top-1/2"
                        style={{
                          width: mascotSize,
                          height: 'auto',
                          transform: 'translate(-50%, -50%) scale(1.03)',
                          filter:
                            'blur(14px) drop-shadow(0 0 44px rgba(59,130,246,0.28))',
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
                          width: mascotSize,
                          height: 'auto',
                          filter:
                            'drop-shadow(0 10px 22px rgba(2,6,23,0.55)) drop-shadow(0 0 18px rgba(59,130,246,0.18))',
                        }}
                        draggable={false}
                      />
                    </div>
                    <div
                      className={compact ? 'mt-1' : 'mt-2'}
                      style={{
                        width: compact ? 100 : 170,
                        height: compact ? 10 : 16,
                        borderRadius: 999,
                        background: 'rgba(37,99,235,0.30)',
                        filter: 'blur(12px)',
                        opacity: 0.35,
                      }}
                    />
                  </div>
                  <h2 className={`font-bold text-white text-expressive ${compact ? 'mt-2 text-sm' : 'mt-5 text-[20px]'}`}>
                    Hola, soy Kiwi
                  </h2>
                  <p className={`text-white/60 text-expressive-subtitle ${compact ? 'text-[11px] mt-1 line-clamp-2' : 'text-sm mt-2'}`}>
                    {emptySubtitle}
                  </p>
                  {rol === 'padre' && (
                    <div className={`flex flex-wrap gap-1.5 justify-center ${compact ? 'mt-2' : 'mt-3'}`}>
                      {[
                        '¿Qué tareas tiene pendientes?',
                        '¿Cómo va en sus notas?',
                        'Crear un permiso de salida',
                      ].map((prompt) => (
                        <button
                          key={prompt}
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setInput(prompt); }}
                          className={`rounded-full border border-white/15 bg-white/5 text-white/60 hover:bg-white/10 hover:text-white/90 transition-colors ${compact ? 'text-[10px] px-2 py-1' : 'text-xs px-3 py-1.5'}`}
                        >
                          {prompt}
                        </button>
                      ))}
                    </div>
                  )}
                  {rol === 'directivo' && !compact && (
                    <div className="flex flex-wrap gap-1.5 justify-center mt-3">
                      {[
                        'Resumen de indicadores de la sección',
                        'Ideas para un comunicado a padres',
                        '¿Qué eventos institucionales hay este mes?',
                      ].map((prompt) => (
                        <button
                          key={prompt}
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setInput(prompt); }}
                          className="rounded-full border border-white/15 bg-white/5 text-white/60 hover:bg-white/10 hover:text-white/90 transition-colors text-xs px-3 py-1.5"
                        >
                          {prompt}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )
          ) : (
            <div className="space-y-4 py-2">
              {messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`transition-smooth reveal-scale ${msg.emisor === 'user' ? 'flex justify-end' : 'w-full'
                    }`}
                  style={{ animationDelay: `${idx * 0.1}s` }}
                >
                  {msg.emisor === 'user' ? (
                    msg.contextLabel === 'parent_notes' ? (
                      <details className="max-w-[85%] rounded-lg rounded-br-sm border border-white/15 bg-white/5 text-white open:bg-white/[0.07]">
                        <summary className="cursor-pointer list-none px-3 py-2 text-xs text-[#00c8ff]/90 font-medium [&::-webkit-details-marker]:hidden">
                          Contexto desde Notas (toca para expandir)
                        </summary>
                        <p className="px-3 pb-3 pt-0 text-[13px] leading-relaxed whitespace-pre-wrap text-white/85 border-t border-white/10">
                          {msg.contenido}
                        </p>
                      </details>
                    ) : (
                      <div
                        className="max-w-[85%] px-3 py-2 rounded-lg rounded-br-sm text-sm text-white hover-glow"
                        style={{
                          background: `linear-gradient(to right, ${colorPrimario}, ${colorSecundario})`,
                        }}
                      >
                        <p className="text-[14px] leading-relaxed whitespace-pre-wrap">{msg.contenido}</p>
                      </div>
                    )
                  ) : msg.type === 'evo_doc' && msg.structuredData ? (
                    <div className="w-full flex items-start gap-2">
                      <img
                        src={kiwiImg}
                        alt="Kiwi"
                        className="shrink-0"
                        style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }}
                        draggable={false}
                      />
                      <div className="min-w-0 max-w-[85%]">
                        <div className="text-[11px] text-white/40 mb-1">Kiwi</div>
                        <EvoDocCard
                          title={String(msg.structuredData.title ?? 'Documento')}
                          description={String(msg.structuredData.description ?? '')}
                          period={String(msg.structuredData.period ?? '')}
                          docId={String(msg.structuredData.docId ?? '')}
                          compact
                        />
                      </div>
                    </div>
                  ) : msg.type === 'kiwi_confirm' && msg.structuredData ? (
                    <div className="w-full flex items-start gap-2">
                      <img
                        src={kiwiImg}
                        alt="Kiwi"
                        className="shrink-0"
                        style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }}
                        draggable={false}
                      />
                      <div className="min-w-0 max-w-[85%]">
                        <div className="text-[11px] text-white/40 mb-1">Kiwi</div>
                        <div
                          className="px-3 py-3 text-white/90 space-y-2"
                          style={{
                            background: 'rgba(37,99,235,0.10)',
                            border: '1px solid rgba(37,99,235,0.18)',
                            borderRadius: '16px 16px 16px 4px',
                          }}
                        >
                          <div className="text-xs font-semibold text-white">Confirmación requerida</div>
                          <div className="rounded-lg border border-white/10 bg-white/5 p-2 text-xs">
                            <div className="text-white/60">Título</div>
                            <div className="text-sm text-white">
                              {String((msg.structuredData.params as { title?: string })?.title ?? '')}
                            </div>
                            <div className="text-white/60 mt-1">Entrega</div>
                            <div className="text-sm text-white">
                              {String((msg.structuredData.params as { dueDate?: string })?.dueDate ?? '')}
                            </div>
                          </div>
                          <div className="flex gap-2 flex-wrap">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="border-white/20 text-white/80"
                              onClick={() => {
                                setInput(`KIWI_CONFIRM ${JSON.stringify(msg.structuredData ?? {})}`);
                              }}
                            >
                              Editar
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              className="bg-gradient-to-r from-[#002366] to-[#1e3cff]"
                              onClick={() => {
                                void sendMessage(`KIWI_CONFIRM ${JSON.stringify(msg.structuredData ?? {})}`);
                              }}
                            >
                              Confirmar
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="w-full flex items-start gap-2">
                      <img
                        src={kiwiImg}
                        alt="Kiwi"
                        className="shrink-0"
                        style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }}
                        draggable={false}
                      />
                      <div className="min-w-0 max-w-[85%]">
                        <div className="text-[11px] text-white/40 mb-1">Kiwi</div>
                        <div
                          className="px-3 py-2 text-white/90 text-[14px] leading-relaxed whitespace-pre-wrap"
                          style={{
                            background: 'rgba(37,99,235,0.10)',
                            border: '1px solid rgba(37,99,235,0.15)',
                            borderRadius: '16px 16px 16px 4px',
                          }}
                        >
                          {msg.contenido}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {(loading || isStreaming || activeToolStep) && (
                <div className="w-full flex items-start gap-2">
                  <img
                    src={kiwiImg}
                    alt="Kiwi"
                    className="shrink-0"
                    style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }}
                    draggable={false}
                  />
                  <div className="min-w-0 max-w-[85%]">
                    <div className="text-[11px] text-white/40 mb-1">Kiwi</div>
                    <div
                      className="px-3 py-2"
                      style={{
                        background: 'rgba(37,99,235,0.10)',
                        border: '1px solid rgba(37,99,235,0.15)',
                        borderRadius: '16px 16px 16px 4px',
                      }}
                      aria-label="Kiwi está pensando"
                    >
                      {activeToolStep ? (
                        <span className="text-xs text-blue-400 flex items-center gap-1.5">
                          <Loader2 className="w-3 h-3 animate-spin" />
                          {activeToolStep.replace(/_/g, ' ')}...
                        </span>
                      ) : (
                        <>
                          <span className="kiwi-dot" />
                          <span className="kiwi-dot" style={{ animationDelay: '0.12s', marginLeft: 6 }} />
                          <span className="kiwi-dot" style={{ animationDelay: '0.24s', marginLeft: 6 }} />
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>
        <div className={`border-t border-white/10 flex-shrink-0 ${compactHero ? 'pt-2 mt-2' : compact ? 'pt-2 mt-2' : 'pt-3 mt-3'}`}>
          <div className={`relative flex items-end gap-2 bg-white/5 border border-white/10 rounded-[12px] backdrop-blur-sm hover:border-white/20 transition-colors ${compactHero ? 'px-2 py-1' : compact ? 'px-2 py-1.5' : 'px-3 py-2'}`}>
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendFromInput();
                }
              }}
              placeholder="Escríbele a Kiwi..."
              className={`flex-1 border-0 bg-transparent text-white placeholder:text-white/40 focus-visible:ring-0 focus-visible:ring-offset-0 ${compactHero ? 'text-sm py-0.5 min-h-[36px]' : 'text-sm py-1'}`}
              disabled={loading || isStreaming}
              data-testid="input-dashboard-chat"
            />
            <Button
              onClick={(e) => {
                e.stopPropagation();
                handleSendFromInput();
              }}
              disabled={loading || isStreaming || !input.trim()}
              size="icon"
              className={`rounded-lg bg-gradient-to-r from-[#002366] to-[#1e3cff] hover:opacity-90 text-white disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0 ${compactHero ? 'w-7 h-7' : 'w-8 h-8'}`}
              data-testid="button-dashboard-send"
            >
              {(loading || isStreaming) ? <Loader2 className={`${compactHero ? 'w-3 h-3' : 'w-3.5 h-3.5'} animate-spin`} /> : <Send className={compactHero ? 'w-3 h-3' : 'w-3.5 h-3.5'} />}
            </Button>
          </div>
        </div>
        {footer ? (
          <div
            className="border-t border-white/10 pt-3 mt-3 flex-shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            {footer}
          </div>
        ) : null}
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
      notas: { nota: number; gradingCategoryId?: string; fecha?: string; categoryWeightPct?: number }[];
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

  const { data: estudianteNotifData } = useQuery({
    queryKey: ['notifications-dashboard-estudiante', user?.id],
    queryFn: () => apiRequest<{ list: DashboardNotifItem[]; unreadCount: number }>('GET', '/api/notifications?limit=3'),
    enabled: !!user?.colegioId && user?.rol === 'estudiante',
    staleTime: 30 * 1000,
  });
  const estudianteNotifications = estudianteNotifData?.list ?? [];

  const groupSubjectIds = useMemo(
    () => Array.from(new Set((notesData?.materias ?? []).map((m) => m.groupSubjectId).filter(Boolean))) as string[],
    [notesData?.materias]
  );
  const logrosQueries = useQueries({
    queries: groupSubjectIds.map((gsId) => ({
      queryKey: ['/api/logros-calificacion', gsId] as const,
      queryFn: () =>
        apiRequest('GET', `/api/logros-calificacion?courseId=${encodeURIComponent(gsId)}`) as Promise<{
          logros: Array<{
            _id: string;
            pesoEnCurso: number;
            indicadores: { _id: string; porcentaje: number }[];
          }>;
        }>,
      enabled: !!gsId,
    })),
  });
  const nestedLogrosByGsId = useMemo(() => {
    const map: Record<string, OutcomeGradeNode[]> = {};
    groupSubjectIds.forEach((id, i) => {
      const logros = logrosQueries[i]?.data?.logros;
      if (!logros?.length) return;
      map[id] = logros.map((L) => ({
        id: L._id,
        pesoEnCurso: L.pesoEnCurso,
        indicadores: (L.indicadores ?? []).map((ind) => ({ id: ind._id, porcentaje: ind.porcentaje })),
      }));
    });
    return map;
  }, [groupSubjectIds, logrosQueries]);

  // Mismo criterio que Mis Notas: logros anidados (indicadores + peso entre logros); reprobada = promedio < 65
  const materiasPerdidas = useMemo(() => {
    const materias = notesData?.materias ?? [];
    return materias.filter((m) => {
      const outcomes = m.groupSubjectId ? nestedLogrosByGsId[m.groupSubjectId] : undefined;
      const notas = m.notas ?? [];
      const getCat = (catId: string): number | null => {
        const arr = notas.filter((n) => String(n.gradingCategoryId ?? '') === String(catId));
        if (!arr.length) return null;
        return weightedGradeWithinLogro(
          arr.map((n) => ({ categoryWeightPct: n.categoryWeightPct ?? null })),
          arr.map((n) => (hasRecordedScore(n.nota) ? Number(n.nota) : null))
        );
      };
      let promedioFinal: number | null =
        outcomes && outcomes.length > 0 ? courseGradeFromOutcomes(outcomes, getCat) : null;
      if (promedioFinal == null) {
        promedioFinal =
          notas.length > 0 ? notas.reduce((s, x) => s + (x.nota ?? 0), 0) / notas.length : m.promedio ?? 0;
      }
      return promedioFinal < 65;
    }).length;
  }, [notesData?.materias, nestedLogrosByGsId]);

  const handleDayClick = (assignment: Assignment) => {
    setLocation(`/assignment/${assignment._id}`);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1 — Mis Materias */}
        <Card
          className={`${CARD_STYLE} cursor-pointer reveal-scale gradient-overlay-blue`}
          style={{ animationDelay: '0.1s' }}
          onClick={() => setLocation('/mi-aprendizaje/cursos')}
        >
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-white/70 text-xs font-medium uppercase tracking-wider">
              <BookOpen className="w-4 h-4 text-[#3B82F6]" />
              Mis Materias
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white font-['Poppins']">
              {isLoadingCourses ? '—' : courses.length}
            </div>
            <div className="flex items-center gap-2 mt-2">
              <Badge
                variant="outline"
                className="border-transparent bg-transparent shadow-none text-[#93C5FD] text-xs font-semibold px-0 py-0 hover:bg-transparent"
              >
                {courses.length} activas
              </Badge>
            </div>
            <p className="text-xs text-white/50 mt-1">Materias este año</p>
          </CardContent>
        </Card>

        {/* KPI 2 — Tareas */}
        <Card
          className={`${CARD_STYLE} cursor-pointer reveal-scale gradient-overlay-blue`}
          style={{ animationDelay: '0.2s' }}
          onClick={() => setLocation('/mi-aprendizaje/tareas')}
        >
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-white/70 text-xs font-medium uppercase tracking-wider">
              <ClipboardList className="w-4 h-4 text-[#3B82F6]" />
              Tareas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white font-['Poppins']">
              {isLoadingAssignments ? '—' : tareasCompletadas.length + tareasPorEntregar.length}
            </div>
            <div className="flex items-center gap-2 mt-2">
              <Badge
                variant="outline"
                className={
                  tareasPorEntregar.length === 0
                    ? 'border-transparent bg-transparent shadow-none text-emerald-300 text-xs font-semibold px-0 py-0 hover:bg-transparent'
                    : 'border-transparent bg-transparent shadow-none text-amber-300 text-xs font-semibold px-0 py-0 hover:bg-transparent'
                }
              >
                {tareasPorEntregar.length === 0 ? 'Al día' : `${tareasPorEntregar.length} pendientes`}
              </Badge>
            </div>
            {!isLoadingAssignments && (tareasCompletadas.length + tareasPorEntregar.length) > 0 && (
              <div className="mt-3 w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-[#3B82F6] transition-all duration-700"
                  style={{ width: `${Math.round(tareasCompletadas.length / (tareasCompletadas.length + tareasPorEntregar.length) * 100)}%` }}
                />
              </div>
            )}
            <p className="text-xs text-white/50 mt-1">Tareas asignadas</p>
          </CardContent>
        </Card>

        {/* KPI 3 — Materias Perdidas */}
        <Card
          className={`${CARD_STYLE} cursor-pointer reveal-scale gradient-overlay-blue`}
          style={{ animationDelay: '0.3s' }}
          onClick={() => setLocation('/mi-aprendizaje/notas')}
        >
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-white/70 text-xs font-medium uppercase tracking-wider">
              {materiasPerdidas === 0 && notesData !== undefined
                ? <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                : <AlertTriangle className="w-4 h-4 text-[#3B82F6]" />}
              Materias Perdidas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-3xl font-bold font-['Poppins'] ${materiasPerdidas === 0 && notesData !== undefined ? 'text-emerald-400' : RED_ALERT}`}>
              {notesData === undefined ? '—' : materiasPerdidas}
            </div>
            <div className="flex items-center gap-2 mt-2">
              <Badge
                variant="outline"
                className={
                  materiasPerdidas === 0 && notesData !== undefined
                    ? 'border-transparent bg-transparent shadow-none text-emerald-300 text-xs font-semibold px-0 py-0 hover:bg-transparent'
                    : 'border-transparent bg-transparent shadow-none text-red-300 text-xs font-semibold px-0 py-0 hover:bg-transparent'
                }
              >
                {materiasPerdidas === 0 && notesData !== undefined ? 'Al día' : 'Requiere atención'}
              </Badge>
            </div>
            <p className="text-xs text-white/50 mt-1">Promedio menor a 65</p>
          </CardContent>
        </Card>

        {/* KPI 4 — Puesto en el Salón */}
        <Card
          className={`${CARD_STYLE} cursor-pointer reveal-scale gradient-overlay-blue`}
          style={{ animationDelay: '0.4s' }}
          onClick={() => setLocation('/mi-aprendizaje/notas')}
        >
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-white/70 text-xs font-medium uppercase tracking-wider">
              <Trophy className="w-4 h-4 text-[#3B82F6]" />
              Puesto en el Salón
            </CardTitle>
          </CardHeader>
          <CardContent>
            {rankingData === undefined ? (
              <>
                <div className="text-3xl font-bold text-[#facc15] font-['Poppins']">—</div>
                <p className="text-xs text-white/50 mt-1">Cargando...</p>
              </>
            ) : rankingData.total < 2 || rankingData.puesto === 0 ? (
              <>
                <div className="text-lg font-semibold text-white/80 font-['Poppins']">Sin datos</div>
                <p className="text-xs text-white/50 mt-1">
                  {rankingData.grado ? `Grado ${rankingData.grado}` : 'Menos de 2 estudiantes con notas'}
                </p>
              </>
            ) : (
              <>
                <div className="text-3xl font-bold text-[#facc15] font-['Poppins']">#{rankingData.puesto}</div>
                <div className="flex items-center gap-2 mt-2">
                  <Badge
                    variant="outline"
                    className={
                      rankingData.puesto === 1
                        ? 'border-transparent bg-transparent shadow-none text-[#facc15] text-xs font-semibold px-0 py-0 hover:bg-transparent'
                        : rankingData.puesto <= 3
                          ? 'border-transparent bg-transparent shadow-none text-[#93C5FD] text-xs font-semibold px-0 py-0 hover:bg-transparent'
                          : 'border-transparent bg-transparent shadow-none text-white/60 text-xs font-semibold px-0 py-0 hover:bg-transparent'
                    }
                  >
                    {rankingData.puesto === 1 ? 'Primer puesto' : rankingData.puesto <= 3 ? 'Top 3' : `Top ${Math.round(rankingData.puesto / rankingData.total * 100)}%`}
                  </Badge>
                </div>
                <p className="text-xs text-white/50 mt-1">De {rankingData.total} estudiantes</p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:items-start">
        <div className="lg:col-span-5 flex flex-col gap-4 order-2 lg:order-1">
          <Card className={`${CARD_STYLE} rounded-2xl shrink-0 reveal-slide`} style={{ animationDelay: '0.5s' }}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-5 pt-5 gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-[rgba(139,92,246,0.12)]">
                  <MessageSquare className="w-4 h-4 text-[var(--color-primario)]" />
                </div>
                <div className="min-w-0">
                  <CardTitle className="text-sm font-semibold text-white leading-tight">
                    Actividad reciente: EvoSend
                  </CardTitle>
                  <CardDescription className="text-[11px] text-white/45 mt-0.5">
                    Últimas 3 notificaciones del colegio
                  </CardDescription>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setLocation('/notificaciones')}
                className="text-xs font-medium text-[var(--color-primario)] hover:text-white/90 whitespace-nowrap shrink-0 flex items-center gap-0.5 transition-colors"
              >
                Ver todos
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </CardHeader>
            <CardContent className="px-5 pb-5 pt-0 space-y-2">
              {estudianteNotifications.length === 0 ? (
                <p className="text-xs text-white/50 py-3 text-center leading-relaxed">
                  No hay notificaciones recientes.
                </p>
              ) : (
                estudianteNotifications.map((n) => {
                  const bodyText = n.cuerpo ?? n.body ?? '';
                  const plain = bodyText ? stripHtmlLite(bodyText) : '';
                  const snippet = plain.slice(0, 72);
                  const when = formatRelativeTimeEs(n.fecha);
                  return (
                    <button
                      key={n._id}
                      type="button"
                      onClick={() => n.actionUrl ? setLocation(n.actionUrl) : setLocation('/notificaciones')}
                      className={[
                        'w-full text-left rounded-xl border p-3 transition-colors',
                        n.leido
                          ? 'border-white/10 bg-white/[0.04] hover:bg-white/[0.07]'
                          : 'border-white/10 border-l-2 border-l-[#3b82f6] bg-[#2563eb]/[0.04] hover:bg-[#2563eb]/[0.07]',
                      ].join(' ')}
                    >
                      <div className="flex gap-2.5">
                        <div
                          className="h-9 w-9 shrink-0 rounded-lg flex items-center justify-center border-0 bg-gradient-to-br from-red-500 via-red-600 to-rose-500 shadow-md shadow-red-500/30"
                          aria-hidden
                        >
                          <Send className="w-4 h-4 text-white" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className={`text-sm font-semibold leading-snug line-clamp-2 ${n.leido ? 'text-white/60' : 'text-white'}`}>
                              {n.titulo}
                            </span>
                            <span className="text-[10px] text-white/40 shrink-0 tabular-nums">{when}</span>
                          </div>
                          {snippet ? (
                            <p className="text-[11px] text-white/45 mt-1 line-clamp-1">
                              {plain.length > 72 ? `${snippet}…` : snippet}
                            </p>
                          ) : null}
                          <div className="flex items-center gap-3 mt-2 pt-2 border-t border-white/[0.06]">
                            <span
                              className="inline-flex items-center gap-1 text-[10px] font-medium"
                              style={{ color: notifTypeColor(n.type) }}
                            >
                              <Send className="w-2.5 h-2.5" aria-hidden />
                              {notifTypeLabel(n.type)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </CardContent>
          </Card>

          <div className="shrink-0 reveal-slide mb-1 sm:mb-2" style={{ animationDelay: '0.6s' }}>
            <AIChatBox rol="estudiante" compact />
          </div>
        </div>

        <div className="lg:col-span-7 order-1 lg:order-2">
          <Card className={`${CARD_STYLE} reveal-slide rounded-2xl`} style={{ animationDelay: '0.5s' }}>
            <CardHeader className="pb-2 px-5 pt-5">
              <CardTitle className="text-white text-base font-semibold">Calendario de Tareas</CardTitle>
              <CardDescription className="text-white/50 text-sm mt-1">
                {isLoadingAssignments
                  ? 'Cargando tareas...'
                  : `${assignmentsThisMonth.length} ${assignmentsThisMonth.length === 1 ? 'tarea asignada' : 'tareas asignadas'} este mes. Toca un día para ver la asignación.`
                }
              </CardDescription>
            </CardHeader>
            <CardContent className="px-4 pb-5 pt-0">
              {isLoadingAssignments ? (
                <div className="h-48 flex items-center justify-center">
                  <Loader2 className="w-6 h-6 animate-spin text-white/50" />
                </div>
              ) : (
                <div className="overflow-auto rounded-xl pulse-blue">
                  <Calendar
                    assignments={assignments}
                    viewingStudentId={user?.id}
                    onDayClick={handleDayClick}
                    variant="student"
                  />
                </div>
              )}
            </CardContent>
          </Card>
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

  const { data: profesorNotifData } = useQuery({
    queryKey: ['notifications-dashboard-profesor', user?.id],
    queryFn: () => apiRequest<{ list: DashboardNotifItem[]; unreadCount: number }>('GET', '/api/notifications?limit=3'),
    enabled: !!user?.colegioId && user?.rol === 'profesor',
    staleTime: 30 * 1000,
  });
  const profesorNotifications = profesorNotifData?.list ?? [];

  type EvoDriveRecienteItem = {
    id: string;
    nombre: string;
    cursoNombre?: string | null;
  };

  const { data: evoDriveRecientes = [], isLoading: evoRecientesLoading } = useQuery<EvoDriveRecienteItem[]>({
    queryKey: ['evo-drive', 'recientes', user?.id],
    queryFn: () => apiRequest<EvoDriveRecienteItem[]>('GET', '/api/evo-drive/recientes'),
    enabled: !!user?.id && user?.rol === 'profesor',
    staleTime: 25_000,
    refetchOnWindowFocus: true,
  });
  const ultimoArchivoEvoDrive = evoDriveRecientes[0];

  const { data: scheduleData } = useQuery<{ slots: Record<string, string> }>({
    queryKey: ['/api/schedule/my-professor', user?.id],
    queryFn: () => apiRequest('GET', '/api/schedule/my-professor'),
    enabled: !!user?.id && user?.rol === 'profesor',
    staleTime: 5 * 60 * 1000,
  });

  const PERIODOS_HORARIO: Record<number, { inicio: string; fin: string }> = {
    1: { inicio: '7:30', fin: '8:25' },
    2: { inicio: '8:30', fin: '9:25' },
    3: { inicio: '9:30', fin: '10:30' },
    5: { inicio: '10:50', fin: '11:45' },
    6: { inicio: '11:50', fin: '12:50' },
    8: { inicio: '13:35', fin: '14:25' },
  };

  const clasesHoy = useMemo(() => {
    const slots = scheduleData?.slots ?? {};
    // Jueves 2 abril 2026 = día escolar 4
    const REF_DATE = new Date(2026, 3, 2); // mes 3 = abril (0-indexed)
    const REF_DIA_ESCOLAR = 4;

    const contarDiasHabiles = (desde: Date, hasta: Date): number => {
      let count = 0;
      const cursor = new Date(desde);
      cursor.setHours(0, 0, 0, 0);
      const target = new Date(hasta);
      target.setHours(0, 0, 0, 0);
      const dir = target >= cursor ? 1 : -1;
      while (cursor.getTime() !== target.getTime()) {
        cursor.setDate(cursor.getDate() + dir);
        const dow = cursor.getDay();
        if (dow !== 0 && dow !== 6) count += dir;
      }
      return count;
    };

    const hoy = new Date(now);
    hoy.setHours(0, 0, 0, 0);
    const dowHoy = hoy.getDay();

    // Fin de semana: no hay clases
    if (dowHoy === 0 || dowHoy === 6) return [];

    const diasDesdeRef = contarDiasHabiles(REF_DATE, hoy);
    // diaEscolar: ciclo 1-6
    const diaEscolar = ((REF_DIA_ESCOLAR - 1 + diasDesdeRef) % 6 + 6) % 6 + 1;

    const ahora = now.getHours() * 60 + now.getMinutes();

    const clasesDelDia = Object.entries(slots)
      .filter(([key]) => {
        const [dia, periodo] = key.split('-').map(Number);
        return dia === diaEscolar && PERIODOS_HORARIO[periodo] !== undefined;
      })
      .map(([key, groupId]) => {
        const [, periodo] = key.split('-').map(Number);
        const p = PERIODOS_HORARIO[periodo];
        const [hI, mI] = p.inicio.split(':').map(Number);
        const [hF, mF] = p.fin.split(':').map(Number);
        const inicioMin = hI * 60 + mI;
        const finMin = hF * 60 + mF;
        const groupName = professorGroups.find(g => g.groupId === groupId)?.groupName ?? groupId;
        const enCurso = ahora >= inicioMin && ahora < finMin;
        const esSiguiente = ahora < inicioMin;
        return { groupId, groupName, inicio: p.inicio, fin: p.fin, inicioMin, enCurso, esSiguiente };
      })
      .sort((a, b) => a.inicioMin - b.inicioMin);

    let marcado = false;
    return clasesDelDia.map(c => {
      if (!marcado && (c.enCurso || c.esSiguiente)) {
        marcado = true;
        return { ...c, destacar: true };
      }
      return { ...c, destacar: false };
    });
  }, [scheduleData, professorGroups, now]);

  const handleDayClick = (assignment: Assignment, event?: React.MouseEvent) => {
    if (event) {
      event.stopPropagation(); // Prevenir que se active el onClick de la Card
    }
    setLocation(`/assignment/${assignment._id}`);
  };

  return (
    <div className="space-y-6">

      {/* SECCIÓN 1 — 4 KPIs misma altura (como otros roles) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:items-stretch">

        {/* KPI 1 — Mis Cursos */}
        <Card
          className={`${CARD_STYLE} cursor-pointer reveal-scale h-full flex flex-col`}
          style={{ animationDelay: '0.1s' }}
          onClick={() => setLocation('/courses')}
        >
          <CardHeader className="pb-2 shrink-0">
            <CardTitle className="flex items-center gap-2 text-white/70 text-xs font-medium uppercase tracking-wider">
              <BookOpen className="w-4 h-4 text-[#3B82F6]" />
              Mis Cursos
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col pt-0">
            <div className="text-3xl font-bold text-white font-['Poppins']">
              {isLoadingCourses ? '—' : professorGroups.length}
            </div>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <Badge
                variant="outline"
                className="border-transparent bg-transparent shadow-none text-[#93C5FD] text-xs font-semibold px-0 py-0 hover:bg-transparent"
              >
                {professorGroups.reduce((s, g) => s + (g.totalStudents ?? 0), 0)} estudiantes
              </Badge>
            </div>
            <p className="text-xs text-white/50 mt-auto pt-3">Cursos a cargo</p>
          </CardContent>
        </Card>

        {/* KPI 2 — Evo Drive (último archivo + mismo icono que AI Dock) */}
        <Card
          className={`${CARD_STYLE} cursor-pointer reveal-scale h-full flex flex-col`}
          style={{ animationDelay: '0.15s' }}
          onClick={() => setLocation('/evo-drive')}
          role="link"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setLocation('/evo-drive');
            }
          }}
        >
          <CardHeader className="pb-2 shrink-0">
            <CardTitle className="flex items-center gap-2 text-white/70 text-xs font-medium uppercase tracking-wider">
              <div
                className="rounded-lg flex h-9 w-9 shrink-0 items-center justify-center shadow-inner border border-white/10"
                style={{ background: 'rgba(0, 200, 255, 0.22)' }}
                aria-hidden
              >
                <Cloud className="w-[18px] h-[18px] text-white/95" strokeWidth={1.75} />
              </div>
              Evo Drive
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col pt-0 min-h-0">
            {evoRecientesLoading ? (
              <p className="text-xs text-white/40 mt-auto">Cargando…</p>
            ) : !ultimoArchivoEvoDrive ? (
              <p className="text-xs text-white/45 leading-snug mt-auto">
                Sin archivos recientes en tus cursos ni en Mi carpeta.
              </p>
            ) : (
              <div className="mt-auto flex flex-col gap-1.5 pt-2">
                {ultimoArchivoEvoDrive.cursoNombre ? (
                  <p
                    className="text-[11px] text-white/50 font-medium leading-snug truncate"
                    title={ultimoArchivoEvoDrive.cursoNombre ?? undefined}
                  >
                    {ultimoArchivoEvoDrive.cursoNombre}
                  </p>
                ) : null}
                <p
                  className="text-sm font-semibold text-white leading-snug line-clamp-2"
                  title={ultimoArchivoEvoDrive.nombre}
                >
                  {ultimoArchivoEvoDrive.nombre}
                </p>
                <p className="text-[10px] text-white/35 uppercase tracking-wide">Último agregado</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* KPI 3 — Por revisar */}
        <Card
          className={`${CARD_STYLE} cursor-pointer reveal-scale h-full flex flex-col`}
          style={{ animationDelay: '0.2s' }}
          onClick={() => setLocation('/profesor/academia/tareas/revision')}
        >
          <CardHeader className="pb-2 shrink-0">
            <CardTitle className="flex items-center gap-2 text-white/70 text-xs font-medium uppercase tracking-wider">
              <FileCheck className="w-4 h-4 text-[#3B82F6]" />
              Por revisar
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col pt-0">
            <div className="text-3xl font-bold text-white font-['Poppins']">
              {isLoadingPending ? '—' : pendingReview.length}
            </div>
            <div className="flex items-center gap-2 mt-2">
              <Badge
                variant="outline"
                className={
                  pendingReview.length > 0
                    ? 'border-transparent bg-transparent shadow-none text-amber-300 text-xs font-semibold px-0 py-0 hover:bg-transparent'
                    : 'border-transparent bg-transparent shadow-none text-emerald-300 text-xs font-semibold px-0 py-0 hover:bg-transparent'
                }
              >
                {pendingReview.length > 0 ? 'Requiere atención' : 'Al día'}
              </Badge>
            </div>
            <p className="text-xs text-white/50 mt-auto pt-3">Entregas pendientes</p>
          </CardContent>
        </Card>

        {/* KPI 4 — Hoy */}
        <Card className={`${CARD_STYLE} reveal-scale h-full flex flex-col`} style={{ animationDelay: '0.25s' }}>
          <CardHeader className="pb-2 shrink-0">
            <CardTitle className="flex items-center gap-2 text-white/70 text-xs font-medium uppercase tracking-wider">
              <Users className="w-4 h-4 text-[#3B82F6]" />
              Hoy
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col pt-0 min-h-0">
            <div className="space-y-1.5 flex-1 max-h-[5.75rem] overflow-y-auto pr-0.5">
              {now.getDay() === 0 ? (
                <p className="text-xs text-white/40">No hay clases hoy</p>
              ) : clasesHoy.length === 0 ? (
                <p className="text-xs text-white/40">Sin clases registradas</p>
              ) : clasesHoy.map((clase) => (
                <button
                  key={`${clase.groupId}-${clase.inicioMin}`}
                  type="button"
                  onClick={() => setLocation(`/course-detail/${clase.groupId}`)}
                  className="w-full flex items-center justify-between py-1 hover:opacity-80 transition-opacity"
                >
                  <span className="text-xs text-white/80 font-medium truncate pr-2">{clase.groupName}</span>
                  <Badge
                    variant="outline"
                    className={
                      clase.enCurso
                        ? 'border-transparent bg-transparent shadow-none text-emerald-300 text-[10px] font-semibold px-0 py-0 shrink-0 hover:bg-transparent'
                        : clase.destacar
                          ? 'border-transparent bg-transparent shadow-none text-[#93C5FD] text-[10px] font-semibold px-0 py-0 shrink-0 hover:bg-transparent'
                          : 'border-transparent bg-transparent shadow-none text-white/50 text-[10px] font-semibold px-0 py-0 shrink-0 hover:bg-transparent'
                    }
                  >
                    {clase.enCurso ? 'En curso' : clase.destacar ? 'Siguiente' : `${clase.inicio}–${clase.fin}`}
                  </Badge>
                </button>
              ))}
            </div>
            <p className="text-xs text-white/50 mt-auto pt-3">Horario del día</p>
          </CardContent>
        </Card>

      </div>

      {/* SECCIÓN 2 — Mismo patrón que estudiante: notificaciones + Kiwi | calendario */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-6 lg:items-start">
        <div className="lg:col-span-5 flex flex-col gap-3 order-2 lg:order-1">
          <Card className={`${CARD_STYLE} rounded-2xl shrink-0 reveal-slide`} style={{ animationDelay: '0.3s' }}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-4 sm:px-5 pt-4 sm:pt-5 gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <div className="flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-[rgba(139,92,246,0.12)]">
                  <MessageSquare className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[var(--color-primario)]" />
                </div>
                <div className="min-w-0">
                  <CardTitle className="text-[13px] sm:text-sm font-semibold text-white leading-tight">
                    Actividad reciente: EvoSend
                  </CardTitle>
                  <CardDescription className="text-[10px] sm:text-[11px] text-white/45 mt-0.5">
                    Últimas 3 notificaciones del colegio
                  </CardDescription>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setLocation('/notificaciones')}
                className="text-[11px] sm:text-xs font-medium text-[var(--color-primario)] hover:text-white/90 whitespace-nowrap shrink-0 flex items-center gap-0.5 transition-colors"
              >
                Ver todos
                <ChevronRight className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              </button>
            </CardHeader>
            <CardContent className="px-4 sm:px-5 pb-4 sm:pb-5 pt-0 space-y-2">
              {profesorNotifications.length === 0 ? (
                <p className="text-[11px] text-white/50 py-2.5 text-center leading-relaxed">
                  No hay notificaciones recientes.
                </p>
              ) : (
                profesorNotifications.map((n) => {
                  const bodyText = n.cuerpo ?? n.body ?? '';
                  const plain = bodyText ? stripHtmlLite(bodyText) : '';
                  const snippet = plain.slice(0, 64);
                  const when = formatRelativeTimeEs(n.fecha);
                  return (
                    <button
                      key={n._id}
                      type="button"
                      onClick={() => n.actionUrl ? setLocation(n.actionUrl) : setLocation('/notificaciones')}
                      className={[
                        'w-full text-left rounded-xl border p-2.5 sm:p-3 transition-colors',
                        n.leido
                          ? 'border-white/10 bg-white/[0.04] hover:bg-white/[0.07]'
                          : 'border-white/10 border-l-2 border-l-[#3b82f6] bg-[#2563eb]/[0.04] hover:bg-[#2563eb]/[0.07]',
                      ].join(' ')}
                    >
                      <div className="flex gap-2">
                        <div
                          className="h-8 w-8 sm:h-9 sm:w-9 shrink-0 rounded-lg flex items-center justify-center border-0 bg-gradient-to-br from-red-500 via-red-600 to-rose-500 shadow-md shadow-red-500/25"
                          aria-hidden
                        >
                          <Send className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className={`text-xs sm:text-sm font-semibold leading-snug line-clamp-2 ${n.leido ? 'text-white/60' : 'text-white'}`}>
                              {n.titulo}
                            </span>
                            <span className="text-[9px] sm:text-[10px] text-white/40 shrink-0 tabular-nums">{when}</span>
                          </div>
                          {snippet ? (
                            <p className="text-[10px] sm:text-[11px] text-white/45 mt-0.5 line-clamp-1">
                              {plain.length > 64 ? `${snippet}…` : snippet}
                            </p>
                          ) : null}
                          <div className="flex items-center gap-3 mt-1.5 pt-1.5 border-t border-white/[0.06]">
                            <span
                              className="inline-flex items-center gap-1 text-[9px] sm:text-[10px] font-medium"
                              style={{ color: notifTypeColor(n.type) }}
                            >
                              <Send className="w-2.5 h-2.5" aria-hidden />
                              {notifTypeLabel(n.type)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </CardContent>
          </Card>

          <div className="shrink-0 reveal-slide mb-0.5 sm:mb-1" style={{ animationDelay: '0.35s' }}>
            <AIChatBox rol="profesor" compact />
          </div>
        </div>

        <div className="lg:col-span-7 order-1 lg:order-2">
          <Card className={`${CARD_STYLE} reveal-slide rounded-2xl`} style={{ animationDelay: '0.3s' }}>
            <CardHeader className="pb-2 px-4 sm:px-5 pt-4 sm:pt-5">
              <CardTitle className="text-white text-sm sm:text-base font-semibold">Calendario de Tareas</CardTitle>
              <CardDescription className="text-white/50 text-xs sm:text-sm mt-1">
                {isLoadingAssignments
                  ? 'Cargando tareas...'
                  : `${assignmentsThisMonth.length} ${assignmentsThisMonth.length === 1 ? 'tarea asignada' : 'tareas asignadas'} este mes. Toca un día para ver la asignación.`}
              </CardDescription>
            </CardHeader>
            <CardContent className="px-3 sm:px-4 pb-4 sm:pb-5 pt-0">
              {isLoadingAssignments ? (
                <div className="h-40 sm:h-48 flex items-center justify-center">
                  <Loader2 className="w-6 h-6 animate-spin text-white/50" />
                </div>
              ) : (
                <div className="overflow-auto rounded-xl pulse-blue" onClick={(e) => e.stopPropagation()}>
                  <Calendar assignments={assignments} onDayClick={handleDayClick} variant="teacher" />
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

    </div>
  );
}

interface DirectivoCalendarEventRow {
  _id: string;
  titulo: string;
  descripcion: string;
  fecha: string;
  tipo: string;
  cursoId: { _id: string; nombre: string } | null;
  creadoPor?: { _id: string; nombre: string } | null;
}

function mapDirectivoEventsToCalendarAssignments(events: DirectivoCalendarEventRow[]): CalendarAssignment[] {
  return events.map((e) => {
    const raw = String(e.fecha ?? '');
    const dateStr = raw.length >= 10 ? raw.slice(0, 10) : raw;
    const cursoLabel = e.tipo === 'colegio' ? 'Institucional' : (e.cursoId?.nombre?.trim() || 'Curso');
    const groupKey = e.cursoId?._id ?? '__institucional__';
    return {
      _id: e._id,
      titulo: e.titulo,
      descripcion: e.descripcion ?? '',
      curso: cursoLabel,
      fechaEntrega: dateStr,
      profesorNombre: e.creadoPor?.nombre ?? '',
      groupId: groupKey,
      requiresSubmission: false,
      type: 'reminder',
    };
  });
}

function DirectivoDashboard() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [calendarViewDate, setCalendarViewDate] = useState(() => new Date());
  const calendarFetchYear = calendarViewDate.getFullYear();

  const { data: mySection, isLoading: isLoadingMySection } = useQuery<{
    id: string;
    nombre: string;
    totalGrupos: number;
    totalEstudiantes: number;
    totalProfesores: number;
    totalMaterias: number;
    promedioGeneral: number | null;
    totalAmonestaciones: number;
  }>({
    queryKey: ['directivo/my-section', user?.id],
    queryFn: () => apiRequest('GET', '/api/sections/my-section'),
    enabled: user?.rol === 'directivo' && !!user?.colegioId,
    staleTime: 5 * 60 * 1000,
  });

  // Eventos del año que muestra el mini-calendario (navegación mes a mes)
  const desde = useMemo(
    () => new Date(calendarFetchYear, 0, 1).toISOString().slice(0, 10),
    [calendarFetchYear]
  );
  const hasta = useMemo(
    () => new Date(calendarFetchYear, 11, 31).toISOString().slice(0, 10),
    [calendarFetchYear]
  );

  const { data: calendarEvents = [], isLoading: isLoadingEvents } = useQuery<DirectivoCalendarEventRow[]>({
    queryKey: ['directivoEvents', user?.colegioId, calendarFetchYear],
    queryFn: () => apiRequest('GET', `/api/events?desde=${desde}&hasta=${hasta}`),
    enabled: !!user?.colegioId && user?.rol === 'directivo',
    staleTime: 0,
  });

  const calendarAssignments = useMemo(
    () => mapDirectivoEventsToCalendarAssignments(calendarEvents),
    [calendarEvents]
  );

  const { data: notificationsData } = useQuery({
    queryKey: ['notifications-dashboard-directivo', user?.id],
    queryFn: () => apiRequest<{ list: DashboardNotifItem[]; unreadCount: number }>('GET', '/api/notifications?limit=3'),
    enabled: !!user?.colegioId && user?.rol === 'directivo',
    staleTime: 30 * 1000,
  });
  const latestNotifications = notificationsData?.list ?? [];

  const eventsThisMonth = useMemo(() => {
    const y = calendarViewDate.getFullYear();
    const m = calendarViewDate.getMonth();
    let n = 0;
    for (const a of calendarAssignments) {
      const p = getAssignmentCalendarLocalParts(a.fechaEntrega);
      if (p && p.year === y && p.monthIndex === m) n++;
    }
    return n;
  }, [calendarAssignments, calendarViewDate]);

  const handleEventClick = () => setLocation('/comunidad/calendario');

  const { data: academicTermData } = useQuery<{ currentAcademicTerm: number }>({
    queryKey: ['institution-academic-term', user?.colegioId],
    queryFn: () => apiRequest('GET', '/api/institution/academic-term'),
    enabled: !!user?.colegioId && user?.rol === 'directivo',
    staleTime: 60 * 1000,
  });

  const trimestreNum = academicTermData?.currentAcademicTerm ?? 1;
  const promedioSeccion = mySection?.promedioGeneral ?? null;

  return (
    <div className="space-y-6">
      {mySection && (
        <Badge className="bg-[var(--section-primary,#2563eb)]/20 text-[var(--section-accent,#00C8FF)] border border-[var(--section-primary,#2563eb)]/30 text-sm px-3 py-1">
          Director de {mySection.nombre}
        </Badge>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className={`${CARD_STYLE} cursor-pointer`} onClick={() => setLocation('/directivo/cursos')}>
          <CardHeader className="pb-1">
            <CardTitle className="text-white/80 text-xs font-medium uppercase tracking-wider">Cursos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white font-['Poppins']">{isLoadingMySection ? '—' : (mySection?.totalGrupos ?? 0)}</div>
            <div className="flex flex-col gap-0.5 mt-1">
              <span className="text-[#93C5FD] text-sm font-medium">Grupos</span>
              <span className="text-white/50 text-sm">{mySection?.totalEstudiantes ?? 0} estudiantes</span>
            </div>
          </CardContent>
        </Card>

        <Card className={`${CARD_STYLE} cursor-pointer`} onClick={() => setLocation('/directivo/profesores')}>
          <CardHeader className="pb-1">
            <CardTitle className="text-white/80 text-xs font-medium uppercase tracking-wider">Docentes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white font-['Poppins']">{isLoadingMySection ? '—' : (mySection?.totalProfesores ?? 0)}</div>
            <div className="flex items-center gap-2 mt-1 text-emerald-400 text-sm">
              <ArrowUp className="w-4 h-4" /> <span>{mySection?.totalMaterias ?? 0} materias</span>
            </div>
          </CardContent>
        </Card>

        <Card
          className={`${CARD_STYLE} cursor-pointer hover-elevate`}
          onClick={() => setLocation('/directivo/academia/analitica-notas')}
        >
          <CardHeader className="pb-1">
            <CardTitle className="text-white/80 text-xs font-medium uppercase tracking-wider">Promedio general</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white font-['Poppins']">
              {promedioSeccion != null ? Number(promedioSeccion).toFixed(1) : (isLoadingMySection ? '—' : '—')}
            </div>
            <div className="flex items-center gap-2 mt-1 text-amber-400/90 text-sm">
              <ArrowDown className="w-4 h-4" /> <span>Trimestre activo {trimestreNum}</span>
            </div>
            <p className="text-white/40 text-xs mt-2">Ver análisis por curso e IA</p>
          </CardContent>
        </Card>

        <Card className={`${CARD_STYLE} cursor-pointer`} onClick={() => setLocation('/directivo/estudiantes')}>
          <CardHeader className="pb-1">
            <CardTitle className="text-white/80 text-xs font-medium uppercase tracking-wider">Amonestaciones</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white font-['Poppins']">{isLoadingMySection ? '—' : (mySection?.totalAmonestaciones ?? 0)}</div>
            <p className="text-red-400 text-sm mt-1">Revisar</p>
            <p className="text-white/40 text-xs mt-2">Ver en perfiles de estudiantes</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:items-start">
        <div className="lg:col-span-5 flex flex-col gap-4 order-2 lg:order-1">
          <Card className={`${CARD_STYLE} rounded-2xl shrink-0 reveal-slide`}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-5 pt-5 gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-[rgba(139,92,246,0.12)]">
                  <MessageSquare className="w-4 h-4 text-[var(--color-primario)]" />
                </div>
                <div className="min-w-0">
                  <CardTitle className="text-sm font-semibold text-white leading-tight">
                    Actividad reciente: EvoSend
                  </CardTitle>
                  <CardDescription className="text-[11px] text-white/45 mt-0.5">
                    Últimas 3 notificaciones del colegio
                  </CardDescription>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setLocation('/notificaciones')}
                className="text-xs font-medium text-[var(--color-primario)] hover:text-white/90 whitespace-nowrap shrink-0 flex items-center gap-0.5 transition-colors"
              >
                Ver todos
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </CardHeader>
            <CardContent className="px-5 pb-5 pt-0 space-y-2">
              {latestNotifications.length === 0 ? (
                <p className="text-xs text-white/50 py-3 text-center leading-relaxed">
                  No hay notificaciones recientes.
                </p>
              ) : (
                latestNotifications.map((n) => {
                  const bodyText = n.cuerpo ?? n.body ?? '';
                  const plain = bodyText ? stripHtmlLite(bodyText) : '';
                  const snippet = plain.slice(0, 72);
                  const when = formatRelativeTimeEs(n.fecha);
                  return (
                    <button
                      key={n._id}
                      type="button"
                      onClick={() => n.actionUrl ? setLocation(n.actionUrl) : setLocation('/notificaciones')}
                      className={[
                        'w-full text-left rounded-xl border p-3 transition-colors',
                        n.leido
                          ? 'border-white/10 bg-white/[0.04] hover:bg-white/[0.07]'
                          : 'border-white/10 border-l-2 border-l-[#3b82f6] bg-[#2563eb]/[0.04] hover:bg-[#2563eb]/[0.07]',
                      ].join(' ')}
                    >
                      <div className="flex gap-2.5">
                        <div
                          className="h-9 w-9 shrink-0 rounded-lg flex items-center justify-center border-0 bg-gradient-to-br from-red-500 via-red-600 to-rose-500 shadow-md shadow-red-500/30"
                          aria-hidden
                        >
                          <Send className="w-4 h-4 text-white" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className={`text-sm font-semibold leading-snug line-clamp-2 ${n.leido ? 'text-white/60' : 'text-white'}`}>
                              {n.titulo}
                            </span>
                            <span className="text-[10px] text-white/40 shrink-0 tabular-nums">{when}</span>
                          </div>
                          {snippet ? (
                            <p className="text-[11px] text-white/45 mt-1 line-clamp-1">
                              {plain.length > 72 ? `${snippet}…` : snippet}
                            </p>
                          ) : null}
                          <div className="flex items-center gap-3 mt-2 pt-2 border-t border-white/[0.06]">
                            <span
                              className="inline-flex items-center gap-1 text-[10px] font-medium"
                              style={{ color: notifTypeColor(n.type) }}
                            >
                              <Send className="w-2.5 h-2.5" aria-hidden />
                              {notifTypeLabel(n.type)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </CardContent>
          </Card>

          <div className="shrink-0 reveal-slide mb-1 sm:mb-2">
            <AIChatBox rol="directivo" compact />
          </div>
        </div>

        <div className="lg:col-span-7 order-1 lg:order-2">
          <Card className={`${CARD_STYLE} reveal-slide rounded-2xl`}>
            <CardHeader className="pb-2 px-5 pt-5">
              <CardTitle className="text-white text-base font-semibold">Calendario del colegio</CardTitle>
              <CardDescription className="text-white/50 text-sm mt-1">
                {isLoadingEvents
                  ? 'Cargando eventos...'
                  : `Eventos institucionales y fechas clave. ${eventsThisMonth} ${eventsThisMonth === 1 ? 'evento este mes' : 'eventos este mes'}. Toca un día para ver el calendario completo.`}
              </CardDescription>
            </CardHeader>
            <CardContent className="px-4 pb-5 pt-0">
              {isLoadingEvents ? (
                <div className="h-48 flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-white/50" /></div>
              ) : (
                <div className="overflow-auto rounded-xl pulse-blue">
                  <Calendar
                    assignments={calendarAssignments}
                    variant="teacher"
                    currentDate={calendarViewDate}
                    onCurrentDateChange={setCalendarViewDate}
                    onDayClick={() => handleEventClick()}
                    summaryLabels={CALENDAR_SUMMARY_LABELS_INSTITUTIONAL_EVENTS}
                    monthLegendOverride={
                      `${eventsThisMonth} ${eventsThisMonth === 1 ? 'evento' : 'eventos'} programados este mes`
                    }
                  />
                </div>
              )}
            </CardContent>
          </Card>
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
    nombreIA: 'EvoOS',
    colorPrimario: '#002366',
    colorSecundario: '#1e3cff',
    logoUrl: '',
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
        nombreIA: 'EvoOS',
        colorPrimario: '#002366',
        colorSecundario: '#1e3cff',
        logoUrl: '',
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
        <Button
          type="button"
          variant="outline"
          className="border-white/20 text-white hover:bg-white/10"
          onClick={() => setLocation('/evo-send')}
        >
          <Mail className="w-4 h-4 mr-2" />
          Evo Send
        </Button>
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

interface ComunicadoPadresResumenItem {
  id: string;
  title: string;
  body: string | null;
  author_name: string | null;
  author_role: string | null;
  created_at: string;
  reads_count?: number;
  total_recipients?: number;
}

function stripHtmlLite(raw: string): string {
  return raw.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function formatRelativeTimeEs(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const s = Math.floor((Date.now() - date.getTime()) / 1000);
  if (s < 60) return 'hace un momento';
  const m = Math.floor(s / 60);
  if (m < 60) return `hace ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `hace ${d} d`;
  return date.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
}

function authorRoleLabelEs(role: string | null | undefined): string {
  if (!role) return 'Colegio';
  const r = role.toLowerCase();
  if (r === 'directivo') return 'Directivo';
  if (r === 'profesor') return 'Docente';
  if (r === 'admin-general-colegio' || r === 'school_admin') return 'Administración';
  return role.charAt(0).toUpperCase() + role.slice(1);
}

function initialsFromFullName(name: string | null | undefined): string {
  if (!name?.trim()) return '?';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return parts[0].slice(0, 2).toUpperCase();
}

interface DirectivoInstitucionalDashItem {
  id: string;
  title: string;
  body: string | null;
  audience: string | null;
  created_at: string;
  created_by_id: string;
  reads_count: number;
  total_recipients: number;
  author_name: string | null;
  author_role: string | null;
}

interface DashboardNotifItem {
  _id: string;
  titulo: string;
  cuerpo?: string;
  body?: string;
  type?: string;
  entityType?: string | null;
  actionUrl?: string | null;
  leido: boolean;
  fecha: string;
}

function institutionalAudienceLabelEs(audience: string | null | undefined): string {
  const a = (audience ?? 'all').toLowerCase();
  if (a === 'all') return 'toda la comunidad';
  if (a === 'parents') return 'padres';
  if (a === 'teachers') return 'docentes';
  if (a === 'staff') return 'personal';
  return 'destinatarios';
}

function notifTypeLabel(type: string | undefined): string {
  switch (type) {
    case 'comunicado_institucional': return 'Institucional';
    case 'comunicado_padres': return 'Comunicado';
    case 'mensaje': return 'EvoSend';
    case 'nueva_tarea':
    case 'nueva_asignacion': return 'Tarea';
    case 'tarea_calificada': return 'Calificación';
    case 'entrega_recibida': return 'Entrega';
    case 'tarea_vence': return 'Vencimiento';
    case 'ausencia': return 'Asistencia';
    case 'amonestacion': return 'Amonestación';
    default: return 'Notificación';
  }
}

function notifTypeColor(type: string | undefined): string {
  switch (type) {
    case 'comunicado_institucional': return 'rgba(255,215,0,0.8)';
    case 'comunicado_padres': return 'rgba(147,197,253,0.8)';
    case 'mensaje': return 'rgba(103,232,249,0.8)';
    case 'nueva_tarea':
    case 'nueva_asignacion': return 'rgba(96,165,250,0.8)';
    case 'tarea_calificada': return 'rgba(74,222,128,0.8)';
    case 'ausencia': return 'rgba(251,191,36,0.8)';
    case 'amonestacion': return 'rgba(248,113,113,0.8)';
    default: return 'rgba(255,255,255,0.5)';
  }
}

function PadreDashboard() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [permisosActualesCount, setPermisosActualesCount] = useState(0);

  const { data: hijos = [] } = useQuery({
    queryKey: ['/api/users/me/hijos'],
    queryFn: () => apiRequest<{ _id: string; nombre: string; curso: string }[]>('GET', '/api/users/me/hijos'),
  });
  const primerHijoId = hijos[0]?._id;

  useEffect(() => {
    if (!user?.id) return;
    const sync = () => setPermisosActualesCount(readPermisosSalidaCount(user.id));
    sync();
    const onStorage = (e: StorageEvent) => {
      if (e.key === `permisos_${user.id}`) sync();
    };
    const onCustom = () => sync();
    window.addEventListener('storage', onStorage);
    window.addEventListener('permisos-updated', onCustom as EventListener);
    const onVis = () => {
      if (document.visibilityState === 'visible') sync();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('permisos-updated', onCustom as EventListener);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [user?.id]);

  const { data: notasData } = useQuery({
    queryKey: ['/api/student/hijo', primerHijoId, 'notes'],
    queryFn: () => apiRequest<{ materias: { _id?: string; nombre: string; promedio: number | null; ultimaNota: number | null }[]; total: number }>('GET', `/api/student/hijo/${primerHijoId}/notes`),
    enabled: !!primerHijoId,
  });

  const { data: cursosHijo = [] } = useQuery<{ _id: string; nombre: string; groupSubjectId?: string }[]>({
    queryKey: ['/api/student/hijo', primerHijoId, 'courses'],
    queryFn: () => apiRequest('GET', `/api/student/hijo/${primerHijoId}/courses`),
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

  const { data: padreNotificationsData } = useQuery({
    queryKey: ['notifications-dashboard-padre', user?.id],
    queryFn: () => apiRequest<{ list: DashboardNotifItem[]; unreadCount: number }>('GET', '/api/notifications?limit=3'),
    enabled: !!user?.colegioId && user?.rol === 'padre',
    staleTime: 30 * 1000,
  });
  const padreLatestNotifications = padreNotificationsData?.list ?? [];

  /** Tareas con entrega hoy o después; las vencidas no entran en el resumen ni en el total grande. */
  const submissionsHijo = (assignment: Assignment) =>
    (assignment as { submissions?: unknown[]; entregas?: unknown[] }).submissions ||
    (assignment as { submissions?: unknown[]; entregas?: unknown[] }).entregas ||
    [];
  const submissionHijo = (assignment: Assignment) =>
    (submissionsHijo(assignment) as { estudianteId?: string; calificacion?: unknown }[]).find(
      (e) => e.estudianteId === primerHijoId
    ) as { calificacion?: unknown } | undefined;

  const estadoAsignacionHijo = (assignment: Assignment): 'pendiente' | 'entregada' | 'calificada' => {
    const s = submissionHijo(assignment);
    const estado =
      (assignment as { estado?: string }).estado ||
      (s ? (s.calificacion !== undefined ? 'calificada' : 'entregada') : 'pendiente');
    if (estado === 'pendiente' || estado === 'entregada' || estado === 'calificada') return estado;
    return 'pendiente';
  };

  const assignmentsActivasHijo = useMemo(() => {
    const d = new Date();
    const startOfToday = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    return assignments.filter((a) => new Date(a.fechaEntrega) >= startOfToday);
  }, [assignments]);

  const asignacionesHijoEntregadas = useMemo(
    () =>
      assignmentsActivasHijo.filter((a) => {
        const e = estadoAsignacionHijo(a);
        return e === 'entregada' || e === 'calificada';
      }).length,
    [assignmentsActivasHijo, primerHijoId]
  );

  const asignacionesHijoPendientes = useMemo(
    () =>
      assignmentsActivasHijo.filter((a) => estadoAsignacionHijo(a) === 'pendiente').length,
    [assignmentsActivasHijo, primerHijoId]
  );

  const goParentTareas = () => setLocation('/parent/tareas');

  const handleDayClick = (_assignment: Assignment) => {
    goParentTareas();
  };

  return (
    <div className="space-y-6">
      <div className="mb-6">
        <p className="text-[11px] font-semibold uppercase tracking-[1.5px] text-white/40 mb-1">
          Panel familiar
        </p>
        <h2 className="text-lg font-bold text-white font-['Poppins']">
          {nombreHijo ? `Seguimiento de ${nombreHijo.split(' ')[0]}` : 'Mi panel'}
        </h2>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 items-stretch mb-6">
        <Card
          className={`${CARD_STYLE} col-span-2 lg:col-span-1 cursor-pointer reveal-scale gradient-overlay-blue h-full flex flex-col`}
          style={{ animationDelay: '0.1s' }}
          onClick={() => setLocation('/parent/notas')}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
            <CardTitle className="text-sm font-medium text-white text-expressive-subtitle">Promedio</CardTitle>
            <TrendingUp className="w-5 h-5 text-[var(--evo-gold)] animate-float" />
          </CardHeader>
          <CardContent className="p-5 flex-1 flex flex-col">
            <div className="flex items-end gap-1">
              <span className="text-3xl font-bold text-white font-['Poppins'] tabular-nums">
                {primerHijoId ? promedioDisplay : '—'}
              </span>
              <span className="text-sm text-white/40 mb-1 font-normal">/100</span>
            </div>
            <p className="text-[10px] text-white/40 mt-1 uppercase tracking-wider">
              {materias.filter(m => (m.promedio ?? 0) > 0).length} materias calificadas
            </p>
          </CardContent>
        </Card>

        <Card
          className={`${CARD_STYLE} cursor-pointer reveal-scale gradient-overlay-blue h-full flex flex-col`}
          style={{ animationDelay: '0.2s' }}
          onClick={goParentTareas}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
            <CardTitle className="text-sm font-medium text-white text-expressive-subtitle">Asignaciones</CardTitle>
            <GraduationCap className="w-5 h-5 text-[var(--evo-gold)] animate-pulse-glow" />
          </CardHeader>
          <CardContent className="p-5 flex-1 flex flex-col justify-center">
            {!primerHijoId ? (
              <p className="text-sm text-white/50">Vincula un estudiante para ver tareas.</p>
            ) : (
              <div className="flex items-end justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-3xl font-bold text-white font-['Poppins'] tabular-nums leading-none">
                    {assignmentsActivasHijo.length}
                  </div>
                  <p className="text-[10px] text-white/40 mt-1.5 uppercase tracking-wider leading-snug max-w-[9rem]">
                    Solo con entrega hoy o futura
                  </p>
                </div>
                <div className="shrink-0 flex flex-col gap-2 pl-3 border-l border-white/10 text-right">
                  <div>
                    <p className="text-[10px] text-white/45 uppercase tracking-wide">Entregadas</p>
                    <p className="text-base font-bold text-green-400 font-['Poppins'] tabular-nums leading-tight">
                      {asignacionesHijoEntregadas}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-white/45 uppercase tracking-wide">Pendientes</p>
                    <p className="text-base font-bold text-yellow-400 font-['Poppins'] tabular-nums leading-tight">
                      {asignacionesHijoPendientes}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card
          className={`${CARD_STYLE} cursor-pointer reveal-scale gradient-overlay-blue h-full flex flex-col`}
          style={{ animationDelay: '0.3s' }}
          onClick={() => setLocation('/parent/materias')}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
            <CardTitle className="text-sm font-medium text-white text-expressive-subtitle">Materias</CardTitle>
            <BookOpen className="w-5 h-5 text-[var(--evo-gold)] animate-float" style={{ animationDelay: '0.5s' }} />
          </CardHeader>
          <CardContent className="p-5 flex-1 flex flex-col">
            <div className="text-3xl font-bold text-white font-['Poppins']">{cursosHijo.length || materias.length}</div>
            <p className="text-xs text-white/50 mt-2 leading-snug">Cursos matriculados este año.</p>
          </CardContent>
        </Card>

        <Card
          className={`${CARD_STYLE} cursor-pointer reveal-scale gradient-overlay-blue h-full flex flex-col ${permisosActualesCount > 0 ? 'badge-glow' : ''}`}
          style={{ animationDelay: '0.4s' }}
          onClick={() => setLocation('/permisos')}
          role="link"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setLocation('/permisos');
            }
          }}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
            <CardTitle className="text-sm font-medium text-white text-expressive-subtitle">Permisos actuales</CardTitle>
            <FileCheck className="w-5 h-5 text-[var(--evo-gold)] animate-float" />
          </CardHeader>
          <CardContent className="p-5 flex-1 flex flex-col">
            <div className="text-3xl font-bold text-white font-['Poppins'] tabular-nums">{permisosActualesCount}</div>
            <p className="text-xs text-white/50 mt-2 leading-snug">Autorizaciones de salida vigentes.</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:items-start">
        <div className="lg:col-span-5 flex flex-col gap-4 order-2 lg:order-1">
          <Card className={`${CARD_STYLE} rounded-2xl shrink-0`}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-5 pt-5 gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-[rgba(139,92,246,0.12)]">
                  <MessageSquare className="w-4 h-4 text-[var(--color-primario)]" />
                </div>
                <div className="min-w-0">
                  <CardTitle className="text-sm font-semibold text-white leading-tight">
                    Actividad reciente: EvoSend
                  </CardTitle>
                  <CardDescription className="text-[11px] text-white/45 mt-0.5">
                    Últimas 3 notificaciones del colegio
                  </CardDescription>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setLocation('/notificaciones')}
                className="text-xs font-medium text-[var(--color-primario)] hover:text-white/90 whitespace-nowrap shrink-0 flex items-center gap-0.5 transition-colors"
              >
                Ver todos
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </CardHeader>
            <CardContent className="px-5 pb-5 pt-0 space-y-2">
              {padreLatestNotifications.length === 0 ? (
                <p className="text-xs text-white/50 py-3 text-center leading-relaxed">
                  No hay notificaciones recientes.
                </p>
              ) : (
                padreLatestNotifications.map((n) => {
                  const bodyText = n.cuerpo ?? n.body ?? '';
                  const plain = bodyText ? stripHtmlLite(bodyText) : '';
                  const snippet = plain.slice(0, 72);
                  const when = formatRelativeTimeEs(n.fecha);
                  return (
                    <button
                      key={n._id}
                      type="button"
                      onClick={() => n.actionUrl ? setLocation(n.actionUrl) : setLocation('/notificaciones')}
                      className={[
                        'w-full text-left rounded-xl border p-3 transition-colors',
                        n.leido
                          ? 'border-white/10 bg-white/[0.04] hover:bg-white/[0.07]'
                          : 'border-white/10 border-l-2 border-l-[#3b82f6] bg-[#2563eb]/[0.04] hover:bg-[#2563eb]/[0.07]',
                      ].join(' ')}
                    >
                      <div className="flex gap-2.5">
                        <div
                          className="h-9 w-9 shrink-0 rounded-lg flex items-center justify-center border-0 bg-gradient-to-br from-red-500 via-red-600 to-rose-500 shadow-md shadow-red-500/30"
                          aria-hidden
                        >
                          <Send className="w-4 h-4 text-white" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className={`text-sm font-semibold leading-snug line-clamp-2 ${n.leido ? 'text-white/60' : 'text-white'}`}>
                              {n.titulo}
                            </span>
                            <span className="text-[10px] text-white/40 shrink-0 tabular-nums">{when}</span>
                          </div>
                          {snippet ? (
                            <p className="text-[11px] text-white/45 mt-1 line-clamp-1">
                              {plain.length > 72 ? `${snippet}…` : snippet}
                            </p>
                          ) : null}
                          <div className="flex items-center gap-3 mt-2 pt-2 border-t border-white/[0.06]">
                            <span
                              className="inline-flex items-center gap-1 text-[10px] font-medium"
                              style={{ color: notifTypeColor(n.type) }}
                            >
                              <Send className="w-2.5 h-2.5" aria-hidden />
                              {notifTypeLabel(n.type)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </CardContent>
          </Card>

          <div className="shrink-0 reveal-slide mb-1 sm:mb-2">
            <AIChatBox rol="padre" compact />
          </div>
        </div>

        <div className="lg:col-span-7 order-1 lg:order-2">
          <Card className={`${CARD_STYLE} reveal-slide rounded-2xl`}>
            <CardHeader className="pb-2 px-5 pt-5">
              <CardTitle className="text-white text-base font-semibold">Calendario de tareas</CardTitle>
              <CardDescription className="text-white/50 text-sm mt-1">
                Tareas de {nombreHijo}. Toca un día para ver asignaciones.
              </CardDescription>
            </CardHeader>
            <CardContent className="px-4 pb-5 pt-0">
              <div className="overflow-auto rounded-xl">
                <Calendar
                  assignments={assignments}
                  viewingStudentId={primerHijoId}
                  onDayClick={handleDayClick}
                  onEmptyDayClick={goParentTareas}
                  variant="student"
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
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
      <DashboardWelcomeBanner logoHeightClass="h-10" reveal>
        <h1 className="text-4xl font-bold text-white mb-2 text-expressive">
          Bienvenido, {user?.nombre?.split(' ')[0] || 'Usuario'}
        </h1>
        <p className="text-white/60 text-expressive-subtitle">
          {new Date().toLocaleDateString('es-CO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </DashboardWelcomeBanner>

      {getDashboardContent()}
    </div>
  );
}
