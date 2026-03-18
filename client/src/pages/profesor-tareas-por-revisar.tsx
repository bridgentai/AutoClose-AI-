import { useAuth } from '@/lib/authContext';
import { useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { ClipboardList, Calendar, ChevronRight, ArrowLeft, Bell, Sparkles } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Breadcrumb } from '@/components/Breadcrumb';
import { useMemo, useEffect } from 'react';

interface Assignment {
  _id: string;
  titulo: string;
  descripcion?: string;
  curso?: string;
  courseId?: string;
  fechaEntrega: string;
  profesorNombre?: string;
  type?: string;
  requiresSubmission?: boolean;
  materiaNombre?: string;
  createdAt?: string;
  pendientesCalificar?: number;
}

export default function ProfesorTareasPorRevisarPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  const { data: todas = [], isLoading } = useQuery<Assignment[]>({
    queryKey: ['teacherMisAsignaciones', user?.id],
    queryFn: () => apiRequest('GET', `/api/assignments/profesor/${user?.id}/mis-asignaciones`),
    enabled: !!user?.id,
    staleTime: 0,
    refetchOnMount: 'always',
  });

  const byCourse = useMemo(() => {
    const map = new Map<string, Assignment[]>();
    for (const a of todas) {
      const key = (a.curso || 'Sin curso').toString();
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(a);
    }
    for (const [, arr] of map) {
      arr.sort((x, y) => {
        const cx = x.createdAt ? new Date(x.createdAt).getTime() : 0;
        const cy = y.createdAt ? new Date(y.createdAt).getTime() : 0;
        return cy - cx;
      });
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [todas]);

  useEffect(() => {
    if (user && user.rol !== 'profesor') setLocation('/dashboard');
  }, [user, setLocation]);

  if (!user || user.rol !== 'profesor') {
    return null;
  }

  const goToAssignment = (a: Assignment) => {
    const isReminder = a.type === 'reminder';
    const noEntregaPlataforma = a.requiresSubmission === false;
    const pending = (a.pendientesCalificar ?? 0) > 0;
    if (!isReminder && !noEntregaPlataforma && pending) {
      setLocation(`/assignment/${a._id}?tab=entregas`);
    } else {
      setLocation(`/assignment/${a._id}`);
    }
  };

  return (
    <div
      className="min-h-screen p-4 md:p-6 text-[#E2E8F0]"
      style={{
        background: 'radial-gradient(circle at 20% 20%, #1E3A8A 0%, #0F172A 40%, #020617 100%)',
      }}
    >
      <div className="max-w-4xl mx-auto">
        <Breadcrumb
          className="mb-4"
          items={[
            { label: 'Dashboard', href: '/dashboard' },
            { label: 'Tareas', href: '/profesor/academia/tareas' },
            { label: 'Por revisar' },
          ]}
        />

        <div className="mt-6 flex items-center gap-3">
          <ClipboardList className="w-8 h-8 text-[#ffd700]" />
          <div>
            <h1 className="text-2xl font-bold text-white font-['Poppins']">
              Asignaciones
            </h1>
            <p className="text-white/60 text-sm mt-0.5">
              Asignaciones por curso · Con o sin entrega en plataforma
            </p>
          </div>
        </div>

        {isLoading ? (
          <Card className="mt-6 panel-grades border-white/10 rounded-2xl">
            <CardContent className="py-12 text-center">
              <p className="text-white/60">Cargando...</p>
            </CardContent>
          </Card>
        ) : todas.length === 0 ? (
          <Card className="mt-6 panel-grades border-white/10 rounded-2xl">
            <CardContent className="py-16 text-center">
              <ClipboardList className="w-16 h-16 text-white/30 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-white mb-2">
                Aún no hay asignaciones
              </h2>
              <p className="text-white/60 mb-6 max-w-md mx-auto">
                Cuando crees asignaciones en tus cursos, aparecerán aquí agrupadas por curso.
              </p>
              <Button
                onClick={() => setLocation('/profesor/academia/tareas/asignar')}
                className="bg-gradient-to-r from-[#002366] to-[#1e3cff] hover:opacity-90 text-white rounded-xl mb-3"
              >
                <Sparkles className="w-4 h-4 mr-2" />
                Crear asignación
              </Button>
              <div>
                <Button
                  variant="ghost"
                  onClick={() => setLocation('/dashboard')}
                  className="text-white/70 hover:text-white"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Ir al dashboard
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="mt-6 space-y-6">
            {byCourse.map(([courseKey, assignments]) => (
              <Card
                key={courseKey}
                className="panel-grades border-white/10 rounded-2xl overflow-hidden"
              >
                <CardHeader className="pb-2">
                  <CardTitle className="text-white font-['Poppins'] flex items-center justify-between">
                    <span>Curso {courseKey}</span>
                    <span className="text-sm font-normal text-white/60">
                      {assignments.length} {assignments.length === 1 ? 'ítem' : 'ítems'}
                    </span>
                  </CardTitle>
                  <CardDescription className="text-white/60">
                    Las que requieren entrega y tienen pendientes por calificar abren directo en la pestaña de entregas.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {assignments.map((a) => {
                    const isReminder = a.type === 'reminder';
                    const sinEntrega = a.requiresSubmission === false && !isReminder;
                    const pending = a.pendientesCalificar ?? 0;
                    return (
                      <button
                        key={a._id}
                        type="button"
                        onClick={() => goToAssignment(a)}
                        className="w-full flex items-center gap-3 p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all text-left"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            {isReminder ? (
                              <Badge className="bg-amber-500/20 text-amber-200 border-amber-500/40 shrink-0">
                                <Bell className="w-3 h-3 mr-1" />
                                Recordatorio
                              </Badge>
                            ) : sinEntrega ? (
                              <Badge className="bg-slate-500/20 text-slate-200 border-slate-500/40 shrink-0">
                                Sin entrega en plataforma
                              </Badge>
                            ) : (
                              <Badge className="bg-violet-500/20 text-violet-200 border-violet-500/40 shrink-0">
                                Con entrega
                              </Badge>
                            )}
                            {pending > 0 && (
                              <Badge className="bg-orange-500/20 text-orange-200 border-orange-500/40 shrink-0">
                                {pending} por calificar
                              </Badge>
                            )}
                          </div>
                          <p className="font-medium text-white truncate">{a.titulo}</p>
                          {a.materiaNombre && (
                            <p className="text-xs text-white/50 mt-0.5">{a.materiaNombre}</p>
                          )}
                          <div className="flex flex-wrap items-center gap-3 mt-1 text-sm text-white/60">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-4 h-4 flex-shrink-0" />
                              Entrega: {new Date(a.fechaEntrega).toLocaleDateString('es-CO')}
                            </span>
                            {a.createdAt && (
                              <span className="text-white/45">
                                Creada:{' '}
                                {new Date(a.createdAt).toLocaleString('es-CO', {
                                  day: 'numeric',
                                  month: 'short',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                            )}
                          </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-white/50 flex-shrink-0" />
                      </button>
                    );
                  })}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
