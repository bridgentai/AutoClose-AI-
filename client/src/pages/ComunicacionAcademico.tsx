import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocation, useRoute } from 'wouter';
import { useAuth } from '@/lib/authContext';
import {
  Megaphone,
  Plus,
  Send,
  Loader2,
  MessageCircle,
  Pencil,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { NavBackButton } from '@/components/nav-back-button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';

interface CourseListItem {
  id: string;
  _id?: string;
  nombre: string;
  cursos?: string[];
}

interface SidebarStat {
  group_subject_id: string;
  pending: number;
  awaiting_read: number;
  badge: number;
}

interface ParentReply {
  id: string;
  content: string;
  created_at: string;
  sender_id: string;
}

interface ComunicadoPadresItem {
  id: string;
  title: string;
  body: string | null;
  status: string | null;
  priority: string | null;
  created_at: string;
  sent_at: string | null;
  scheduled_send_at: string | null;
  cancelled_at: string | null;
  corrected_at: string | null;
  correction_of: string | null;
  created_by_id: string;
  reads_count: number;
  total_recipients: number;
  has_correction: boolean;
  replies_count: number;
  subject_name: string | null;
  group_name: string | null;
  author_name: string | null;
  parent_replies: ParentReply[];
}

function authHeaders(): HeadersInit {
  const token = localStorage.getItem('autoclose_token') || localStorage.getItem('token');
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

function formatRelative(iso: string): string {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'ahora';
  if (m < 60) return `hace ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h} h`;
  return d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
}

const CountdownBanner: React.FC<{
  scheduledAt: string;
  onCancel: () => void;
  cancelling: boolean;
}> = ({ scheduledAt, onCancel, cancelling }) => {
  const [sec, setSec] = useState(0);
  useEffect(() => {
    const tick = () => {
      const t = new Date(scheduledAt).getTime() - Date.now();
      setSec(Math.max(0, Math.ceil(t / 1000)));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [scheduledAt]);
  return (
    <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-100 flex flex-wrap items-center justify-between gap-2">
      <span>Enviando en {sec}s…</span>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="border-amber-500/50 text-amber-100 hover:bg-amber-500/20"
        disabled={cancelling}
        onClick={onCancel}
      >
        Cancelar
      </Button>
    </div>
  );
};

const ComunicacionAcademico: React.FC = () => {
  const [, setLocation] = useLocation();
  const [matchRoute, paramsRoute] = useRoute('/comunicacion/academico/:materiaId');
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isPadre = user?.rol === 'padre';
  const canPublish =
    !!user?.rol &&
    ['profesor', 'directivo', 'admin-general-colegio', 'asistente'].includes(user.rol);

  const selectedGs = matchRoute && paramsRoute?.materiaId ? paramsRoute.materiaId : '';

  const [draftTitle, setDraftTitle] = useState('');
  const [draftBody, setDraftBody] = useState('');
  const [previewOpen, setPreviewOpen] = useState(false);
  const [correctionFor, setCorrectionFor] = useState<ComunicadoPadresItem | null>(null);
  const [corrTitle, setCorrTitle] = useState('');
  const [corrBody, setCorrBody] = useState('');
  const [replyText, setReplyText] = useState<Record<string, string>>({});
  const [openedRead, setOpenedRead] = useState<Set<string>>(() => new Set());

  const { data: courses = [], isLoading: loadingCourses } = useQuery({
    queryKey: ['courses', 'comunicacion-academico'],
    queryFn: async (): Promise<CourseListItem[]> => {
      const res = await fetch('/api/courses', { headers: authHeaders() });
      if (!res.ok) throw new Error('Error al cargar cursos');
      return res.json();
    },
    enabled: !isPadre && canPublish,
  });

  const { data: sidebarStats = [] } = useQuery({
    queryKey: ['comunicados-padres-stats'],
    queryFn: async (): Promise<SidebarStat[]> => {
      const res = await fetch('/api/courses/comunicados-padres-stats', { headers: authHeaders() });
      if (!res.ok) throw new Error('stats');
      return res.json();
    },
    enabled: !isPadre && canPublish,
  });

  const statsByGs = useMemo(() => {
    const m: Record<string, SidebarStat> = {};
    for (const s of sidebarStats) m[s.group_subject_id] = s;
    return m;
  }, [sidebarStats]);

  const { data: padresCount = 0 } = useQuery({
    queryKey: ['padres-vinculados', selectedGs],
    queryFn: async () => {
      const res = await fetch(`/api/courses/padres-vinculados/${selectedGs}`, {
        headers: authHeaders(),
      });
      if (!res.ok) return 0;
      const j = (await res.json()) as { count: number };
      return j.count ?? 0;
    },
    enabled: !!selectedGs && !isPadre && canPublish,
  });

  const {
    data: comunicados = [],
    isLoading: loadingCom,
    error: errCom,
  } = useQuery({
    queryKey: ['comunicados-padres', isPadre ? 'all' : selectedGs],
    queryFn: async (): Promise<ComunicadoPadresItem[]> => {
      if (isPadre) {
        const res = await fetch('/api/courses/comunicados-padres', { headers: authHeaders() });
        if (!res.ok) throw new Error('Error al cargar comunicados');
        return res.json();
      }
      if (!selectedGs) return [];
      const res = await fetch(`/api/courses/comunicados-padres/${selectedGs}`, {
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error('Error al cargar comunicados');
      return res.json();
    },
    enabled: isPadre || !!selectedGs,
  });

  const markReadMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/courses/comunicado/${id}/read`, {
        method: 'POST',
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error('read');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comunicados-padres'] });
      queryClient.invalidateQueries({ queryKey: ['communication-summary'] });
    },
  });

  const markOpenedIfPadre = useCallback(
    (id: string) => {
      if (!isPadre) return;
      if (openedRead.has(id)) return;
      setOpenedRead((prev) => new Set(prev).add(id));
      markReadMutation.mutate(id);
    },
    [isPadre, openedRead, markReadMutation]
  );

  const cancelMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/courses/comunicado/${id}/cancel`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error((j as { message?: string }).message || 'No se pudo cancelar');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comunicados-padres'] });
      queryClient.invalidateQueries({ queryKey: ['comunicados-padres-stats'] });
      queryClient.invalidateQueries({ queryKey: ['communication-summary'] });
    },
  });

  const sendComunicadoMutation = useMutation({
    mutationFn: async (payload: { title: string; body: string; priority: string }) => {
      const res = await fetch('/api/courses/comunicado-padres', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          group_subject_id: selectedGs,
          title: payload.title,
          body: payload.body,
          priority: payload.priority,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error((j as { message?: string }).message || 'Error al enviar');
      }
      return res.json() as { id: string; scheduled_send_at: string };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comunicados-padres'] });
      queryClient.invalidateQueries({ queryKey: ['comunicados-padres-stats'] });
      queryClient.invalidateQueries({ queryKey: ['communication-summary'] });
      setPreviewOpen(false);
      setDraftTitle('');
      setDraftBody('');
    },
  });

  const correctionMutation = useMutation({
    mutationFn: async (payload: { id: string; title: string; body: string }) => {
      const res = await fetch(`/api/courses/comunicado/${payload.id}/correccion`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ title: payload.title, body: payload.body }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error((j as { message?: string }).message || 'Error');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comunicados-padres'] });
      setCorrectionFor(null);
      setCorrTitle('');
      setCorrBody('');
    },
  });

  const replyMutation = useMutation({
    mutationFn: async ({ id, content }: { id: string; content: string }) => {
      const res = await fetch(`/api/courses/comunicado/${id}/reply`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ content }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error((j as { message?: string }).message || 'Error');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comunicados-padres'] });
    },
  });

  const activeCourse = useMemo(() => {
    if (!selectedGs) return null;
    return courses.find((c) => c.id === selectedGs || c._id === selectedGs) ?? null;
  }, [courses, selectedGs]);

  const comunicacionBackTo =
    user?.rol === 'directivo'
      ? '/directivo/comunicacion'
      : user?.rol === 'profesor'
        ? '/profesor/comunicacion'
        : '/comunicacion';

  const canCorrect = (c: ComunicadoPadresItem): boolean => {
    if (!c.sent_at || c.correction_of) return false;
    if (c.has_correction) return false;
    if (c.created_by_id !== user?.id) return false;
    const sent = new Date(c.sent_at).getTime();
    return Date.now() - sent < 24 * 60 * 60 * 1000;
  };

  const priorityChip = (p: string | null) => {
    const label = p || 'normal';
    const color =
      label === 'alta' || label === 'high'
        ? 'bg-red-500/20 text-red-200 border-red-500/30'
        : label === 'baja' || label === 'low'
          ? 'bg-slate-500/20 text-slate-200'
          : 'bg-blue-500/15 text-blue-200 border-blue-500/25';
    return (
      <span className={`text-xs px-2 py-0.5 rounded border ${color}`}>{label}</span>
    );
  };

  return (
    <div className="space-y-4 min-h-[70vh]">
      <NavBackButton to={comunicacionBackTo} label="Comunicación" />

      <div className="flex items-center gap-3">
        <Megaphone className="w-9 h-9 text-[#3B82F6]" />
        <div>
          <h1 className="text-3xl font-bold text-white font-['Poppins'] tracking-tight">
            {isPadre ? 'Comunicados de tus hijos' : 'Comunicados a padres'}
          </h1>
          <p className="text-white/60 text-sm mt-0.5">
            {isPadre
              ? 'Mensajes de docentes y coordinación por curso'
              : 'Gestiona avisos con retención de 30 s y correcciones dentro de 24 h'}
          </p>
        </div>
      </div>

      <div
        className={`grid gap-4 min-h-[520px] grid-cols-1 ${!isPadre && canPublish ? 'lg:grid-cols-[280px_1fr]' : ''}`}
      >
        {!isPadre && canPublish && (
          <aside className="rounded-xl border border-white/10 bg-white/[0.04] backdrop-blur-md p-3 flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-white font-semibold text-sm">Mis cursos</h2>
              <Button
                size="sm"
                className="h-8 bg-[#3B82F6] hover:bg-[#2563EB] text-white"
                disabled={!selectedGs}
                onClick={() => {
                  if (selectedGs) document.getElementById('redaccion-comunicado')?.scrollIntoView({ behavior: 'smooth' });
                }}
              >
                <Plus className="w-4 h-4 mr-1" /> Nuevo
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-1 pr-1">
              {loadingCourses ? (
                <p className="text-white/50 text-sm p-2">Cargando…</p>
              ) : courses.length === 0 ? (
                <p className="text-white/50 text-sm p-2">Sin cursos asignados</p>
              ) : (
                courses.map((c) => {
                  const id = c.id || c._id || '';
                  const stat = statsByGs[id];
                  const badge = stat?.badge ?? 0;
                  const active = selectedGs === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setLocation(`/comunicacion/academico/${id}`)}
                      className={`w-full text-left rounded-lg px-3 py-2.5 transition-colors border-l-2 ${
                        active
                          ? 'border-[#3B82F6] bg-[rgba(37,99,235,0.08)]'
                          : 'border-transparent hover:bg-white/5'
                      }`}
                    >
                      <div className="flex justify-between gap-2">
                        <span className="text-white font-medium text-sm line-clamp-2">{c.nombre}</span>
                        {badge > 0 && (
                          <span className="shrink-0 min-w-[22px] h-[22px] rounded-full bg-red-600 text-white text-xs flex items-center justify-center px-1">
                            {badge > 99 ? '99+' : badge}
                          </span>
                        )}
                      </div>
                      {c.cursos?.[0] && (
                        <p className="text-white/50 text-xs mt-0.5">Curso {c.cursos[0]}</p>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </aside>
        )}

        <main className="flex flex-col rounded-xl border border-white/10 bg-white/[0.04] backdrop-blur-md min-h-[480px]">
          {!isPadre && !selectedGs && (
            <div className="flex-1 flex items-center justify-center text-white/50 p-8">
              Selecciona un curso en la izquierda
            </div>
          )}

          {(isPadre || selectedGs) && (
            <>
              {!isPadre && activeCourse && (
                <div className="border-b border-white/10 px-4 py-3">
                  <h3 className="text-white font-semibold text-lg">
                    {activeCourse.nombre}
                    {activeCourse.cursos?.[0] ? ` · ${activeCourse.cursos[0]}` : ''}
                  </h3>
                  <p className="text-white/50 text-sm">{padresCount} padres vinculados</p>
                </div>
              )}

              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {loadingCom && (
                  <div className="flex justify-center py-12 text-white/60">
                    <Loader2 className="w-8 h-8 animate-spin" />
                  </div>
                )}
                {errCom && (
                  <p className="text-red-400 text-center">No se pudieron cargar los comunicados</p>
                )}
                {!loadingCom &&
                  comunicados.map((c) => (
                    <Card key={c.id} className="bg-white/[0.03] border-white/10">
                      <CardContent
                        className="p-4 space-y-2 cursor-default"
                        onClick={() => markOpenedIfPadre(c.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') markOpenedIfPadre(c.id);
                        }}
                        role={isPadre ? 'button' : undefined}
                        tabIndex={isPadre ? 0 : undefined}
                      >
                        {c.status === 'pending' && c.scheduled_send_at && (
                          <CountdownBanner
                            scheduledAt={c.scheduled_send_at}
                            cancelling={cancelMutation.isPending}
                            onCancel={() => cancelMutation.mutate(c.id)}
                          />
                        )}
                        <div className="flex flex-wrap gap-2 items-center">
                          {c.correction_of && (
                            <span className="text-xs px-2 py-0.5 rounded bg-violet-500/25 text-violet-200 border border-violet-500/40">
                              Corrección
                            </span>
                          )}
                          {c.corrected_at && (
                            <span className="text-xs px-2 py-0.5 rounded bg-amber-500/20 text-amber-100 border border-amber-500/35">
                              Corregido
                            </span>
                          )}
                          {priorityChip(c.priority)}
                          <span className="text-xs text-white/40">{formatRelative(c.created_at)}</span>
                        </div>
                        <h4 className="text-white font-bold text-base">{c.title}</h4>
                        {c.body && <p className="text-white/80 text-sm whitespace-pre-wrap">{c.body}</p>}
                        <p className="text-white/45 text-xs">
                          Leído por {c.reads_count}/{c.total_recipients || 0} padres
                        </p>
                        {c.parent_replies.length > 0 && (
                          <div className="mt-2 space-y-2 pl-3 border-l-2 border-violet-500/30">
                            {c.parent_replies.map((r) => (
                              <div
                                key={r.id}
                                className="rounded-lg px-3 py-2 text-sm text-white/85"
                                style={{ background: 'rgba(124,58,237,0.04)' }}
                              >
                                {r.content}
                                <div className="text-white/40 text-xs mt-1">
                                  {formatRelative(r.created_at)}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                        {canPublish && canCorrect(c) && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-violet-500/40 text-violet-200 mt-2"
                            onClick={() => {
                              setCorrectionFor(c);
                              setCorrTitle(c.title);
                              setCorrBody(c.body || '');
                            }}
                          >
                            <Pencil className="w-3.5 h-3.5 mr-1" /> Enviar corrección
                          </Button>
                        )}
                        {isPadre && c.status === 'sent' && (
                          <div
                            className="pt-2 border-t border-white/10 mt-2"
                            onClick={(e) => e.stopPropagation()}
                            onKeyDown={(e) => e.stopPropagation()}
                            role="presentation"
                          >
                            <p className="text-white/50 text-xs mb-1 flex items-center gap-1">
                              <MessageCircle className="w-3.5 h-3.5" /> Tu respuesta
                            </p>
                            <Textarea
                              value={replyText[c.id] ?? ''}
                              onChange={(e) =>
                                setReplyText((prev) => ({ ...prev, [c.id]: e.target.value }))
                              }
                              placeholder="Escribe una respuesta al docente…"
                              className="bg-white/5 border-white/15 text-white min-h-[72px] mb-2"
                            />
                            <Button
                              size="sm"
                              className="bg-[#3B82F6] hover:bg-[#2563EB]"
                              disabled={replyMutation.isPending || !(replyText[c.id] || '').trim()}
                              onClick={() => {
                                const t = (replyText[c.id] || '').trim();
                                if (!t) return;
                                replyMutation.mutate({ id: c.id, content: t }, {
                                  onSuccess: () =>
                                    setReplyText((prev) => ({ ...prev, [c.id]: '' })),
                                });
                              }}
                            >
                              Enviar respuesta
                            </Button>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}

                {!loadingCom && comunicados.length === 0 && (
                  <p className="text-white/50 text-center py-12">No hay comunicados en este curso</p>
                )}
              </div>

              {!isPadre && canPublish && selectedGs && (
                <div
                  id="redaccion-comunicado"
                  className="border-t border-white/10 p-4 bg-black/20"
                >
                  <p className="text-white/70 text-sm mb-2">Redactar comunicado</p>
                  <Input
                    value={draftTitle}
                    onChange={(e) => setDraftTitle(e.target.value)}
                    placeholder="Título"
                    className="bg-white/5 border-white/15 text-white mb-2"
                  />
                  <Textarea
                    value={draftBody}
                    onChange={(e) => setDraftBody(e.target.value)}
                    placeholder="Mensaje para padres…"
                    className="bg-white/5 border-white/15 text-white min-h-[100px] mb-2"
                  />
                  <Button
                    className="bg-[#3B82F6] hover:bg-[#2563EB]"
                    disabled={!draftTitle.trim() || sendComunicadoMutation.isPending}
                    onClick={() => setPreviewOpen(true)}
                  >
                    <Send className="w-4 h-4 mr-2" />
                    Enviar
                  </Button>
                  {sendComunicadoMutation.isError && (
                    <p className="text-red-400 text-sm mt-2">
                      {(sendComunicadoMutation.error as Error).message}
                    </p>
                  )}
                </div>
              )}
            </>
          )}
        </main>
      </div>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="bg-[#0f172a] border-white/10 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle>Vista previa del comunicado</DialogTitle>
          </DialogHeader>
          <div className="border-t border-white/10 pt-4 space-y-3 text-sm">
            <p className="text-white/70">
              Para:{' '}
              <span className="text-white font-medium">
                {padresCount} padres de {activeCourse?.nombre}
                {activeCourse?.cursos?.[0] ? ` ${activeCourse.cursos[0]}` : ''}
              </span>
            </p>
            <div>
              <p className="text-white/50 text-xs mb-0.5">Título</p>
              <p className="text-white font-medium">{draftTitle}</p>
            </div>
            <div>
              <p className="text-white/50 text-xs mb-0.5">Mensaje</p>
              <p className="text-white/85 whitespace-pre-wrap">{draftBody || '—'}</p>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" className="border-white/20 text-white" onClick={() => setPreviewOpen(false)}>
              Editar
            </Button>
            <Button
              className="bg-[#3B82F6] hover:bg-[#2563EB]"
              disabled={sendComunicadoMutation.isPending}
              onClick={() =>
                sendComunicadoMutation.mutate({
                  title: draftTitle.trim(),
                  body: draftBody.trim(),
                  priority: 'normal',
                })
              }
            >
              {sendComunicadoMutation.isPending ? 'Enviando…' : 'Confirmar y enviar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!correctionFor} onOpenChange={(o) => !o && setCorrectionFor(null)}>
        <DialogContent className="bg-[#0f172a] border-white/10 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle>Corrección del comunicado</DialogTitle>
          </DialogHeader>
          <Input
            value={corrTitle}
            onChange={(e) => setCorrTitle(e.target.value)}
            className="bg-white/5 border-white/15 text-white mb-2"
          />
          <Textarea
            value={corrBody}
            onChange={(e) => setCorrBody(e.target.value)}
            className="bg-white/5 border-white/15 text-white min-h-[120px]"
          />
          <DialogFooter>
            <Button variant="outline" className="border-white/20 text-white" onClick={() => setCorrectionFor(null)}>
              Cerrar
            </Button>
            <Button
              className="bg-violet-600 hover:bg-violet-500"
              disabled={correctionMutation.isPending || !corrTitle.trim()}
              onClick={() => {
                if (!correctionFor) return;
                correctionMutation.mutate({
                  id: correctionFor.id,
                  title: corrTitle.trim(),
                  body: corrBody.trim(),
                });
              }}
            >
              Publicar corrección
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ComunicacionAcademico;
