import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { useAuth } from '@/lib/authContext';
import { Inbox, ClipboardList, FileCheck, Mail, Send } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { NavBackButton } from '@/components/nav-back-button';

interface AcademicFeedItem {
  id: string;
  type: 'nueva_asignacion' | 'nueva_nota' | 'mensaje_academico';
  title: string;
  body: string | null;
  assignment_id: string | null;
  group_subject_id: string | null;
  created_at: string;
  subject_name: string | null;
  group_name: string | null;
}

interface GroupSubjectOption {
  id: string;
  subject_name: string;
  group_name: string;
}

/** Respuesta de GET /api/courses (cada ítem = group_subject con id, nombre materia, cursos) */
interface CourseListItem {
  id: string;
  _id?: string;
  nombre: string;
  cursos?: string[];
}

const fetchAcademicFeed = async (): Promise<AcademicFeedItem[]> => {
  const token = localStorage.getItem('autoclose_token') || localStorage.getItem('token');
  const response = await fetch('/api/courses/academic-feed', {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
  if (!response.ok) throw new Error('Error al cargar la bandeja');
  return response.json();
};

/** Usa GET /api/courses (misma API que "mis cursos") para llenar el selector de cursos. */
const fetchCoursesForInbox = async (): Promise<GroupSubjectOption[]> => {
  const token = localStorage.getItem('autoclose_token') || localStorage.getItem('token');
  const response = await fetch('/api/courses', {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  if (!response.ok) throw new Error('Error al cargar los cursos');
  const list: CourseListItem[] = await response.json();
  return list.map((c) => ({
    id: c.id || (c._id as string),
    subject_name: c.nombre || '',
    group_name: (c.cursos && c.cursos[0]) || '',
  }));
};

const ComunicacionAcademico: React.FC = () => {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showCompose, setShowCompose] = useState(false);
  const [composeTitle, setComposeTitle] = useState('');
  const [composeBody, setComposeBody] = useState('');
  const [composeGroupSubjectId, setComposeGroupSubjectId] = useState('');

  const canSend = user?.rol && ['profesor', 'directivo', 'asistente', 'admin-general-colegio', 'school_admin'].includes(user.rol);

  const { data: feedItems = [], isLoading, error } = useQuery<AcademicFeedItem[]>({
    queryKey: ['academic-feed'],
    queryFn: fetchAcademicFeed,
  });

  const { data: groupOptions = [], isLoading: loadingCourses, error: errorCourses } = useQuery<GroupSubjectOption[]>({
    queryKey: ['courses', 'for-academic-inbox'],
    queryFn: fetchCoursesForInbox,
    enabled: canSend && showCompose,
  });

  const sendMessageMutation = useMutation({
    mutationFn: async (payload: { title: string; body: string; group_subject_id: string }) => {
      const token = localStorage.getItem('autoclose_token') || localStorage.getItem('token');
      const res = await fetch('/api/courses/academic-message', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || 'Error al enviar');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['academic-feed'] });
      queryClient.invalidateQueries({ queryKey: ['communication-summary'] });
      setShowCompose(false);
      setComposeTitle('');
      setComposeBody('');
      setComposeGroupSubjectId('');
    },
  });

  const formatFeedDate = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days === 0) return d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    if (days === 1) return 'Ayer';
    if (days < 7) return d.toLocaleDateString('es-ES', { weekday: 'short' });
    return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
  };

  const getTypeLabel = (type: AcademicFeedItem['type']) => {
    if (type === 'nueva_asignacion') return 'Nueva tarea';
    if (type === 'nueva_nota') return 'Nueva nota';
    return 'Mensaje';
  };

  const getTypeIcon = (type: AcademicFeedItem['type']) => {
    if (type === 'nueva_asignacion') return <ClipboardList className="w-5 h-5 text-[#1e3cff]" />;
    if (type === 'nueva_nota') return <FileCheck className="w-5 h-5 text-[#1e3cff]" />;
    return <Mail className="w-5 h-5 text-[#1e3cff]" />;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-white/70">Cargando bandeja de entrada...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-red-400">Error al cargar los mensajes académicos</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <NavBackButton to="/comunicacion" label="Comunicación" />

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight text-white font-['Poppins']">
            Comunicación Académica
          </h1>
          <p className="text-lg text-white/70 mt-2">
            Bandeja de entrada: tareas, notas y mensajes para estudiantes
          </p>
        </div>
        {canSend && (
          <Button
            onClick={() => setShowCompose(!showCompose)}
            className="bg-[#1e3cff] hover:bg-[#1e3cff]/90 text-white shrink-0"
          >
            <Send className="w-4 h-4 mr-2" />
            {showCompose ? 'Cerrar' : 'Nuevo mensaje'}
          </Button>
        )}
      </div>

      {showCompose && canSend && (
        <Card className="bg-white/5 border-white/10 backdrop-blur-md">
          <CardContent className="p-4 space-y-4">
            <h3 className="text-lg font-semibold text-white">Enviar mensaje a estudiantes</h3>
            <div>
              <label className="block text-sm text-white/70 mb-1">Enviar a (curso)</label>
              <select
                value={composeGroupSubjectId}
                onChange={(e) => setComposeGroupSubjectId(e.target.value)}
                className="w-full rounded-md bg-white/10 border border-white/20 text-white px-3 py-2 focus:border-[#1e3cff] outline-none"
                disabled={loadingCourses}
              >
                <option value="">
                  {loadingCourses ? 'Cargando cursos...' : 'Seleccione un curso'}
                </option>
                {groupOptions.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.subject_name} — {opt.group_name}
                  </option>
                ))}
              </select>
              {errorCourses && (
                <p className="text-sm text-red-400 mt-1">No se pudieron cargar los cursos. Intente de nuevo.</p>
              )}
              {!loadingCourses && !errorCourses && groupOptions.length === 0 && (
                <p className="text-sm text-white/50 mt-1">No tiene cursos asignados.</p>
              )}
            </div>
            <div>
              <label className="block text-sm text-white/70 mb-1">Asunto</label>
              <Input
                value={composeTitle}
                onChange={(e) => setComposeTitle(e.target.value)}
                placeholder="Asunto del mensaje"
                className="bg-white/10 border-white/20 text-white placeholder:text-white/50"
              />
            </div>
            <div>
              <label className="block text-sm text-white/70 mb-1">Mensaje</label>
              <textarea
                value={composeBody}
                onChange={(e) => setComposeBody(e.target.value)}
                placeholder="Escriba el mensaje..."
                rows={4}
                className="w-full rounded-md bg-white/10 border border-white/20 text-white px-3 py-2 placeholder:text-white/50 focus:border-[#1e3cff] outline-none resize-y"
              />
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => {
                  if (!composeTitle.trim() || !composeGroupSubjectId) return;
                  sendMessageMutation.mutate({
                    title: composeTitle.trim(),
                    body: composeBody.trim(),
                    group_subject_id: composeGroupSubjectId,
                  });
                }}
                disabled={!composeTitle.trim() || !composeGroupSubjectId || sendMessageMutation.isPending}
                className="bg-[#1e3cff] hover:bg-[#1e3cff]/90 text-white"
              >
                {sendMessageMutation.isPending ? 'Enviando...' : 'Enviar'}
              </Button>
              <Button variant="outline" onClick={() => setShowCompose(false)} className="border-white/20 text-white">
                Cancelar
              </Button>
            </div>
            {sendMessageMutation.isError && (
              <p className="text-sm text-red-400">{String(sendMessageMutation.error.message)}</p>
            )}
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        {feedItems.length === 0 ? (
          <Card className="bg-white/5 border-white/10 backdrop-blur-md">
            <CardContent className="p-12 text-center">
              <Inbox className="w-16 h-16 text-white/30 mx-auto mb-4" />
              <p className="text-white/70 text-lg">No hay mensajes en la bandeja</p>
              <p className="text-white/50 text-sm mt-1">
                Las nuevas tareas y los mensajes de profesores o coordinación aparecerán aquí
              </p>
            </CardContent>
          </Card>
        ) : (
          feedItems.map((item) => (
            <Card
              key={item.id}
              className="bg-white/5 border-white/10 backdrop-blur-md hover:bg-white/10 transition-all duration-200"
            >
              <CardContent className="p-4">
                <div
                  className={`flex items-start gap-3 ${item.assignment_id ? 'cursor-pointer' : ''}`}
                  onClick={() => item.assignment_id && setLocation(`/assignment/${item.assignment_id}`)}
                  onKeyDown={(e) => {
                    if (item.assignment_id && (e.key === 'Enter' || e.key === ' ')) {
                      e.preventDefault();
                      setLocation(`/assignment/${item.assignment_id}`);
                    }
                  }}
                  role={item.assignment_id ? 'button' : undefined}
                  tabIndex={item.assignment_id ? 0 : undefined}
                >
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-[#1e3cff]/20 flex items-center justify-center">
                    {getTypeIcon(item.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <span className="text-xs font-medium text-[#1e3cff] uppercase tracking-wide">
                        {getTypeLabel(item.type)}
                      </span>
                      <span className="text-xs text-white/50 flex-shrink-0">
                        {formatFeedDate(item.created_at)}
                      </span>
                    </div>
                    <h3 className="text-white font-medium truncate">{item.title}</h3>
                    {(item.subject_name || item.group_name) && (
                      <p className="text-sm text-white/60 mt-0.5">
                        {[item.subject_name, item.group_name].filter(Boolean).join(' · ')}
                      </p>
                    )}
                    {item.body && (
                      <p className="text-sm text-white/70 mt-1 line-clamp-2">{item.body}</p>
                    )}
                    {item.assignment_id && (
                      <span className="text-xs text-[#1e3cff] mt-1 inline-block">Ver tarea →</span>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};

export default ComunicacionAcademico;
