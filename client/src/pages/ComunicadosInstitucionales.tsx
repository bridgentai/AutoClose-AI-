import React, { useCallback, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { NavBackButton } from '@/components/nav-back-button';
import { useAuth } from '@/lib/authContext';
import { Building2, Eye, Loader2, Megaphone, Pencil, Send } from 'lucide-react';

type CategoryKey = 'all' | 'general' | 'circular' | 'evento' | 'calendario' | 'aviso';

interface CategoryCounts {
  all: number;
  general: number;
  circular: number;
  evento: number;
  calendario: number;
  aviso: number;
}

interface InstItem {
  id: string;
  title: string;
  body: string | null;
  status: string | null;
  audience: string | null;
  category: string | null;
  priority: string | null;
  created_at: string;
  sent_at: string | null;
  scheduled_send_at: string | null;
  corrected_at: string | null;
  correction_of: string | null;
  created_by_id: string;
  reads_count: number;
  total_recipients: number;
  has_correction: boolean;
  author_name: string | null;
  author_role: string | null;
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

function audienceLabel(a: string | null): string {
  switch (a) {
    case 'all':
      return 'Todos';
    case 'parents':
      return 'Solo padres';
    case 'teachers':
      return 'Solo profesores';
    case 'staff':
      return 'Personal / administración';
    default:
      return a || '—';
  }
}

function roleLabel(r: string | null): string {
  if (!r) return '';
  const map: Record<string, string> = {
    directivo: 'Directivo',
    profesor: 'Profesor',
    padre: 'Padre/Madre',
    asistente: 'Asistente',
    'admin-general-colegio': 'Admin colegio',
    rector: 'Rector',
  };
  return map[r] ?? r;
}

function initials(name: string | null): string {
  if (!name) return '?';
  const p = name.split(/\s+/).filter(Boolean);
  const a = p[0]?.[0] ?? '';
  const b = p[1]?.[0] ?? '';
  return (a + b).toUpperCase() || '?';
}

const SIDEBAR: { key: CategoryKey; label: string; apiCat: string | null }[] = [
  { key: 'all', label: 'Todos', apiCat: null },
  { key: 'circular', label: 'Circulares', apiCat: 'circular' },
  { key: 'evento', label: 'Eventos', apiCat: 'evento' },
  { key: 'calendario', label: 'Calendario escolar', apiCat: 'calendario' },
  { key: 'general', label: 'Avisos generales', apiCat: 'general' },
];

const CountdownBanner: React.FC<{
  scheduledAt: string;
  onCancel: () => void;
  cancelling: boolean;
}> = ({ scheduledAt, onCancel, cancelling }) => {
  const [sec, setSec] = React.useState(0);
  React.useEffect(() => {
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
      <span>Publicando en {sec}s…</span>
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

const ComunicadosInstitucionales: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeCat, setActiveCat] = useState<CategoryKey>('all');
  const [publishOpen, setPublishOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [pubTitle, setPubTitle] = useState('');
  const [pubBody, setPubBody] = useState('');
  const [pubCategory, setPubCategory] = useState('general');
  const [pubAudience, setPubAudience] = useState<'all' | 'parents' | 'teachers' | 'staff'>('parents');
  const [readsFor, setReadsFor] = useState<string | null>(null);
  const [readsRows, setReadsRows] = useState<{ user_id: string; full_name: string; read_at: string | null }[]>([]);
  const [corr, setCorr] = useState<InstItem | null>(null);
  const [corrTitle, setCorrTitle] = useState('');
  const [corrBody, setCorrBody] = useState('');
  const [markedRead, setMarkedRead] = useState<Set<string>>(() => new Set());

  const canPublish =
    !!user?.rol &&
    ['directivo', 'admin-general-colegio', 'asistente', 'rector'].includes(user.rol);

  const apiCategory =
    activeCat === 'all' ? undefined : SIDEBAR.find((s) => s.key === activeCat)?.apiCat ?? undefined;

  const { data: instConfig } = useQuery({
    queryKey: ['institution-config'],
    queryFn: async () => {
      const res = await fetch('/api/institution/config', { headers: authHeaders() });
      if (!res.ok) return { nombre: 'Institución' };
      return (await res.json()) as { nombre: string };
    },
  });

  const { data: counts = { all: 0, general: 0, circular: 0, evento: 0, calendario: 0, aviso: 0 } } =
    useQuery({
      queryKey: ['institucional-categorias'],
      queryFn: async (): Promise<CategoryCounts> => {
        const res = await fetch('/api/institucional/comunicados/categorias', { headers: authHeaders() });
        if (!res.ok) throw new Error('categorias');
        return await res.json();
      },
    });

  const { data: list = [], isLoading } = useQuery({
    queryKey: ['institucional-comunicados', apiCategory ?? 'all'],
    queryFn: async (): Promise<InstItem[]> => {
      const q = apiCategory ? `?category=${encodeURIComponent(apiCategory)}` : '';
      const res = await fetch(`/api/institucional/comunicados${q}`, { headers: authHeaders() });
      if (!res.ok) throw new Error('list');
      return await res.json();
    },
  });

  const monthYear = useMemo(
    () =>
      new Date().toLocaleDateString('es-CO', {
        month: 'long',
        year: 'numeric',
      }),
    []
  );

  const markRead = useCallback(
    (id: string) => {
      setMarkedRead((prev) => {
        if (prev.has(id)) return prev;
        fetch(`/api/institucional/comunicado/${id}/read`, {
          method: 'POST',
          headers: authHeaders(),
        }).then(() => {
          queryClient.invalidateQueries({ queryKey: ['institucional-comunicados'] });
          queryClient.invalidateQueries({ queryKey: ['communication-summary'] });
        });
        return new Set(prev).add(id);
      });
    },
    [queryClient]
  );

  const cancelMut = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/institucional/comunicado/${id}/cancel`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error('cancel');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['institucional-comunicados'] });
      queryClient.invalidateQueries({ queryKey: ['institucional-categorias'] });
    },
  });

  const publishMut = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/institucional/comunicado', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          title: pubTitle.trim(),
          body: pubBody.trim(),
          audience: pubAudience,
          category: pubCategory,
          priority: 'normal',
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error((j as { message?: string }).message || 'Error');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['institucional-comunicados'] });
      queryClient.invalidateQueries({ queryKey: ['institucional-categorias'] });
      queryClient.invalidateQueries({ queryKey: ['communication-summary'] });
      setPreviewOpen(false);
      setPublishOpen(false);
      setPubTitle('');
      setPubBody('');
    },
  });

  const corrMut = useMutation({
    mutationFn: async () => {
      if (!corr) return;
      const res = await fetch(`/api/institucional/comunicado/${corr.id}/correccion`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ title: corrTitle.trim(), body: corrBody.trim() }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error((j as { message?: string }).message || 'Error');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['institucional-comunicados'] });
      setCorr(null);
    },
  });

  const openReads = async (id: string) => {
    setReadsFor(id);
    const res = await fetch(`/api/institucional/comunicado/${id}/read-detail`, { headers: authHeaders() });
    if (res.ok) {
      const j = (await res.json()) as {
        recipients: { user_id: string; full_name: string; read_at: string | null }[];
      };
      setReadsRows(j.recipients ?? []);
    } else setReadsRows([]);
  };

  const countForSidebar = (key: CategoryKey): number => {
    if (key === 'all') return counts.all;
    return counts[key as keyof CategoryCounts] ?? 0;
  };

  const canCorrect = (c: InstItem): boolean => {
    if (!c.sent_at || c.correction_of || c.has_correction) return false;
    if (c.created_by_id !== user?.id) return false;
    if (!canPublish) return false;
    return Date.now() - new Date(c.sent_at).getTime() < 24 * 60 * 60 * 1000;
  };

  return (
    <div className="p-2 md:p-4 min-h-[70vh]">
      <NavBackButton
        to={user?.rol === 'estudiante' ? '/mi-aprendizaje' : '/evo-send'}
        label={user?.rol === 'estudiante' ? 'Mi Aprendizaje' : 'Comunicación'}
      />

      <div className="grid gap-4 mt-6 grid-cols-1 md:grid-cols-[240px_1fr]">
        <aside className="rounded-xl border border-white/10 bg-white/[0.04] backdrop-blur-md p-3 h-fit">
          <div className="flex items-center justify-between mb-3 gap-2">
            <h2 className="text-white font-semibold text-sm">Categorías</h2>
            {canPublish && (
              <Button
                size="sm"
                className="h-8 bg-[#7c3aed] hover:bg-[#6d28d9] text-white shrink-0"
                onClick={() => setPublishOpen(true)}
              >
                + Publicar
              </Button>
            )}
          </div>
          <nav className="space-y-1">
            {SIDEBAR.map((s) => {
              const active = activeCat === s.key;
              return (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => setActiveCat(s.key)}
                  className={`w-full flex justify-between items-center rounded-lg px-3 py-2 text-sm text-left border-l-2 transition-colors ${
                    active
                      ? 'border-[#7c3aed] bg-[rgba(124,58,237,0.12)] text-white'
                      : 'border-transparent text-white/75 hover:bg-white/5'
                  }`}
                >
                  <span>{s.label}</span>
                  <span className="text-white/45 text-xs">{countForSidebar(s.key)}</span>
                </button>
              );
            })}
          </nav>
        </aside>

        <section className="rounded-xl border border-white/10 bg-white/[0.04] backdrop-blur-md p-4 md:p-6">
          <div className="flex items-start gap-3 mb-6">
            <Building2 className="w-8 h-8 text-[#7c3aed] shrink-0 mt-1" />
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-white font-['Poppins']">
                Comunicados Institucionales · {instConfig?.nombre ?? '…'} · {monthYear}
              </h1>
              <p className="text-white/55 text-sm mt-1">
                Circulares, eventos y avisos oficiales de la institución
              </p>
            </div>
          </div>

          {isLoading && (
            <div className="flex justify-center py-16 text-white/50">
              <Loader2 className="w-8 h-8 animate-spin" />
            </div>
          )}

          {!isLoading && list.length === 0 && (
            <p className="text-white/50 text-center py-16">No hay comunicados en esta categoría</p>
          )}

          <div className="space-y-4">
            {!isLoading &&
              list.map((c) => (
                <article
                  key={c.id}
                  className="rounded-xl border border-white/10 bg-white/[0.03] p-4"
                  onClick={() => markRead(c.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') markRead(c.id);
                  }}
                  role="presentation"
                >
                  {c.status === 'pending' && c.scheduled_send_at && (
                    <div className="mb-3">
                      <CountdownBanner
                        scheduledAt={c.scheduled_send_at}
                        cancelling={cancelMut.isPending}
                        onCancel={() => cancelMut.mutate(c.id)}
                      />
                    </div>
                  )}
                  <div className="flex gap-3">
                    <div className="w-11 h-11 rounded-full bg-gradient-to-br from-[#3B82F6] to-[#1E40AF] flex items-center justify-center text-white text-sm font-bold shrink-0">
                      {initials(c.author_name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-white font-semibold">{c.author_name ?? 'Autor'}</span>
                        <span className="text-white/45 text-xs">
                          {roleLabel(c.author_role)} · {formatRelative(c.created_at)}
                        </span>
                        {c.corrected_at && (
                          <span className="text-xs px-2 py-0.5 rounded bg-amber-500/20 text-amber-100 border border-amber-500/35">
                            Corregido
                          </span>
                        )}
                        {c.correction_of && (
                          <span className="text-xs px-2 py-0.5 rounded bg-violet-500/25 text-violet-200">
                            Corrección
                          </span>
                        )}
                      </div>
                      <h3 className="text-white font-bold text-lg mt-2">{c.title}</h3>
                      {c.body && (
                        <p className="text-white/80 text-sm mt-2 whitespace-pre-wrap">{c.body}</p>
                      )}
                      <footer className="mt-4 flex flex-wrap gap-2 items-center text-xs text-white/50">
                        <Megaphone className="w-3.5 h-3.5" />
                        <span>Enviado a: {audienceLabel(c.audience)}</span>
                        <span className="text-white/35">·</span>
                        <span>
                          Lecturas {c.reads_count}/{c.total_recipients}
                        </span>
                        <div className="w-full sm:w-auto sm:ml-auto flex flex-wrap gap-2">
                          {canCorrect(c) && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-violet-500/40 text-violet-200"
                              onClick={(e) => {
                                e.stopPropagation();
                                setCorr(c);
                                setCorrTitle(c.title);
                                setCorrBody(c.body || '');
                              }}
                            >
                              <Pencil className="w-3.5 h-3.5 mr-1" /> Enviar corrección
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-white/20 text-white/80"
                            onClick={(e) => {
                              e.stopPropagation();
                              openReads(c.id);
                            }}
                          >
                            <Eye className="w-3.5 h-3.5 mr-1" /> Ver lecturas
                          </Button>
                        </div>
                      </footer>
                    </div>
                  </div>
                </article>
              ))}
          </div>
        </section>
      </div>

      <Dialog open={publishOpen} onOpenChange={setPublishOpen}>
        <DialogContent className="bg-[#0f172a] border-white/10 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle>Nuevo comunicado institucional</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              placeholder="Título"
              value={pubTitle}
              onChange={(e) => setPubTitle(e.target.value)}
              className="bg-white/5 border-white/15 text-white"
            />
            <Textarea
              placeholder="Cuerpo del mensaje"
              value={pubBody}
              onChange={(e) => setPubBody(e.target.value)}
              className="bg-white/5 border-white/15 text-white min-h-[140px]"
            />
            <div>
              <label className="text-xs text-white/50 block mb-1">Categoría</label>
              <select
                value={pubCategory}
                onChange={(e) => setPubCategory(e.target.value)}
                className="w-full rounded-md bg-white/10 border border-white/20 text-white px-3 py-2"
              >
                <option value="general">Avisos generales</option>
                <option value="circular">Circular</option>
                <option value="evento">Evento</option>
                <option value="calendario">Calendario escolar</option>
                <option value="aviso">Aviso</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-white/50 block mb-1">Audiencia</label>
              <select
                value={pubAudience}
                onChange={(e) =>
                  setPubAudience(e.target.value as 'all' | 'parents' | 'teachers' | 'staff')
                }
                className="w-full rounded-md bg-white/10 border border-white/20 text-white px-3 py-2"
              >
                <option value="all">Todos</option>
                <option value="parents">Solo padres</option>
                <option value="teachers">Solo profesores</option>
                <option value="staff">Personal (staff)</option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="border-white/20 text-white" onClick={() => setPublishOpen(false)}>
              Cerrar
            </Button>
            <Button
              className="bg-[#7c3aed] hover:bg-[#6d28d9]"
              disabled={!pubTitle.trim()}
              onClick={() => {
                setPublishOpen(false);
                setPreviewOpen(true);
              }}
            >
              Vista previa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="bg-[#0f172a] border-white/10 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle>Vista previa</DialogTitle>
          </DialogHeader>
          <div className="text-sm space-y-2 border-t border-white/10 pt-4">
            <p className="text-white/60">
              Audiencia: <span className="text-white">{audienceLabel(pubAudience)}</span>
            </p>
            <p className="text-white font-semibold">{pubTitle}</p>
            <p className="text-white/85 whitespace-pre-wrap">{pubBody || '—'}</p>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" className="border-white/20 text-white" onClick={() => setPreviewOpen(false)}>
              Editar
            </Button>
            <Button
              className="bg-[#7c3aed] hover:bg-[#6d28d9]"
              disabled={publishMut.isPending}
              onClick={() => publishMut.mutate()}
            >
              <Send className="w-4 h-4 mr-2" />
              {publishMut.isPending ? 'Enviando…' : 'Confirmar y enviar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!readsFor} onOpenChange={(o) => !o && setReadsFor(null)}>
        <DialogContent className="bg-[#0f172a] border-white/10 text-white max-w-md">
          <DialogHeader>
            <DialogTitle>Lecturas</DialogTitle>
          </DialogHeader>
          <ul className="max-h-72 overflow-y-auto text-sm space-y-2">
            {readsRows.map((r) => (
              <li key={r.user_id} className="flex justify-between gap-2 border-b border-white/10 pb-2">
                <span className="text-white/90">{r.full_name}</span>
                <span className="text-white/45 shrink-0">
                  {r.read_at ? formatRelative(r.read_at) : 'Pendiente'}
                </span>
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>

      <Dialog open={!!corr} onOpenChange={(o) => !o && setCorr(null)}>
        <DialogContent className="bg-[#0f172a] border-white/10 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle>Corrección institucional</DialogTitle>
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
            <Button variant="outline" className="border-white/20 text-white" onClick={() => setCorr(null)}>
              Cerrar
            </Button>
            <Button
              className="bg-violet-600"
              disabled={corrMut.isPending || !corrTitle.trim()}
              onClick={() => corrMut.mutate()}
            >
              Publicar corrección
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ComunicadosInstitucionales;
