import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRoute, useLocation } from 'wouter';
import { useAuth } from '@/lib/authContext';
import { MessageCircle, Loader2, Users } from 'lucide-react';
import { NavBackButton } from '@/components/nav-back-button';
import { cn } from '@/lib/utils';
import { parseComunicadoAttachments } from '@/lib/comunicadoAttachments';
import { ComunicadoAttachmentLinks } from '@/components/ComunicadoWorkspaceAttachments';

interface ParentReply {
  id: string;
  content: string;
  created_at: string;
  sender_id: string;
  parent_display_name?: string;
  linked_student_names?: string | null;
}

interface ComunicadoPadresItem {
  id: string;
  title: string;
  body: string | null;
  status: string | null;
  created_at: string;
  sent_at: string | null;
  group_name: string | null;
  subject_name: string | null;
  replies_count: number;
  parent_replies: ParentReply[];
  attachments_json?: unknown;
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
  return d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('es-CO', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const ComunicacionAcademicoRespuestas: React.FC = () => {
  const [, params] = useRoute('/comunicacion/academico/:materiaId/respuestas/:comunicadoId');
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const materiaId = params?.materiaId ?? '';
  const comunicadoId = params?.comunicadoId ?? '';

  const comunicacionBackTo =
    user?.rol === 'directivo'
      ? '/directivo/comunicacion'
      : user?.rol === 'profesor'
        ? '/profesor/comunicacion'
        : '/comunicacion';

  const {
    data: comunicados = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ['comunicados-padres', materiaId],
    queryFn: async (): Promise<ComunicadoPadresItem[]> => {
      const res = await fetch(`/api/courses/comunicados-padres/${materiaId}`, {
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error('No se pudieron cargar los comunicados');
      return res.json();
    },
    enabled: !!materiaId,
  });

  const comunicado = useMemo(
    () => comunicados.find((c) => c.id === comunicadoId) ?? null,
    [comunicados, comunicadoId]
  );

  const attachments = useMemo(
    () => parseComunicadoAttachments(comunicado?.attachments_json),
    [comunicado?.attachments_json]
  );

  const cursoLabel = [comunicado?.group_name, comunicado?.subject_name].filter(Boolean).join(' · ');

  if (!materiaId || !comunicadoId) {
    return (
      <div className="space-y-4 min-h-[50vh]">
        <NavBackButton to={comunicacionBackTo} label="Comunicación" />
        <p className="text-white/60">Enlace no válido.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 min-h-[70vh] pb-12">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <NavBackButton
            to={`/comunicacion/academico/${materiaId}`}
            label="Comunicados del curso"
          />
          <div className="mt-4 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-[#3B82F6] to-[#1D4ED8] shadow-lg shadow-blue-500/20">
              <MessageCircle className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white font-['Poppins'] tracking-tight">
                Respuestas de familias
              </h1>
              {cursoLabel ? (
                <p className="text-sm text-white/55 mt-0.5 flex items-center gap-2">
                  <Users className="h-3.5 w-3.5 shrink-0 text-[#93C5FD]" />
                  {cursoLabel}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-24 rounded-xl border border-white/10 bg-white/[0.03]">
          <Loader2 className="h-10 w-10 animate-spin text-[#3B82F6]" />
        </div>
      )}

      {error && !isLoading && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-red-200 text-sm">
          No tienes acceso a este curso o hubo un error al cargar los datos.
        </div>
      )}

      {!isLoading && !error && !comunicado && (
        <div className="panel-grades rounded-xl p-8 text-center border border-white/10">
          <p className="text-white/70">No se encontró este comunicado en este curso.</p>
          <button
            type="button"
            onClick={() => setLocation(`/comunicacion/academico/${materiaId}`)}
            className="mt-4 text-[#3B82F6] hover:text-[#2563EB] text-sm font-medium"
          >
            Volver a la lista
          </button>
        </div>
      )}

      {!isLoading && comunicado && (
        <>
          <section className="panel-grades rounded-xl border border-white/10 p-5 sm:p-6 space-y-4">
            <div>
              <p className="text-xs uppercase tracking-wider text-white/45 mb-1">Comunicado</p>
              <h2 className="text-xl font-semibold text-[#E2E8F0]">{comunicado.title}</h2>
              {comunicado.sent_at && (
                <p className="text-xs text-white/45 mt-1">Enviado: {formatDateTime(comunicado.sent_at)}</p>
              )}
            </div>
            {comunicado.body ? (
              <p className="text-sm text-white/80 whitespace-pre-wrap leading-relaxed">{comunicado.body}</p>
            ) : null}
            {attachments.length > 0 && <ComunicadoAttachmentLinks items={attachments} />}
          </section>

          <section>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white font-['Poppins']">
                Respuestas recibidas
              </h3>
              <span className="text-sm text-white/50">
                {(comunicado.replies_count ?? comunicado.parent_replies?.length ?? 0) || 0}{' '}
                {(comunicado.replies_count ?? comunicado.parent_replies?.length ?? 0) === 1
                  ? 'respuesta'
                  : 'respuestas'}
              </span>
            </div>

            {(comunicado.parent_replies ?? []).length === 0 ? (
              <div className="panel-grades rounded-xl border border-white/10 p-8 text-center text-white/55 text-sm">
                Aún no hay respuestas de acudientes en este comunicado.
              </div>
            ) : (
              <ul className="space-y-4">
                {(comunicado.parent_replies ?? []).map((r) => {
                  const parentName = r.parent_display_name?.trim() || 'Acudiente';
                  const studentsRaw = r.linked_student_names?.trim();
                  const students =
                    studentsRaw ||
                    'Sin estudiante vinculado en este curso o en la institución (revisa matrícula y vínculo acudiente–estudiante).';
                  return (
                    <li
                      key={r.id}
                      className={cn(
                        'panel-grades rounded-xl border border-white/10 p-5 sm:p-6',
                        'shadow-[0_0_30px_rgba(37,99,235,0.12)]'
                      )}
                    >
                      <div className="grid gap-4 sm:grid-cols-2 sm:gap-6">
                        <div className="space-y-1">
                          <p className="text-[11px] uppercase tracking-wider text-white/45">Acudiente</p>
                          <p className="text-base font-semibold text-[#E2E8F0]">{parentName}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-[11px] uppercase tracking-wider text-[#93C5FD]/90">
                            Estudiante(s) vinculado(s)
                          </p>
                          <p className="text-sm text-white/90 leading-snug">{students}</p>
                        </div>
                      </div>
                      <div className="mt-4 pt-4 border-t border-white/10">
                        <p className="text-sm text-white/85 whitespace-pre-wrap leading-relaxed">{r.content}</p>
                        <p className="text-xs text-white/40 mt-3">{formatRelative(r.created_at)}</p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
};

export default ComunicacionAcademicoRespuestas;
