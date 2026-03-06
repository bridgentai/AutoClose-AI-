import { useAuth } from '@/lib/authContext';
import { useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { ClipboardList, Calendar, ChevronRight, ArrowLeft } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { NavBackButton } from '@/components/nav-back-button';
import { useMemo } from 'react';

interface Assignment {
  _id: string;
  titulo: string;
  descripcion?: string;
  curso?: string;
  courseId?: string;
  fechaEntrega: string;
  profesorNombre?: string;
}

export default function ProfesorTareasPorRevisarPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  const { data: pendingReview = [], isLoading } = useQuery<Assignment[]>({
    queryKey: ['teacherPendingReview', user?.id],
    queryFn: () => apiRequest('GET', `/api/assignments/profesor/${user?.id}/pending-review`),
    enabled: !!user?.id,
    staleTime: 0,
  });

  const byCourse = useMemo(() => {
    const map = new Map<string, Assignment[]>();
    for (const a of pendingReview) {
      const key = (a.courseId || a.curso || 'Sin curso').toString();
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(a);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [pendingReview]);

  if (user?.rol !== 'profesor') {
    setLocation('/dashboard');
    return null;
  }

  return (
    <div
      className="min-h-screen p-4 md:p-6 text-[#E2E8F0]"
      style={{
        background: 'radial-gradient(circle at 20% 20%, #1E3A8A 0%, #0F172A 40%, #020617 100%)',
      }}
    >
      <div className="max-w-4xl mx-auto">
        <NavBackButton to="/dashboard" label="Volver al dashboard" />

        <div className="mt-6 flex items-center gap-3">
          <ClipboardList className="w-8 h-8 text-[#ffd700]" />
          <div>
            <h1 className="text-2xl font-bold text-white font-['Poppins']">
              Tareas por revisar
            </h1>
            <p className="text-white/60 text-sm mt-0.5">
              Agrupadas por curso · Pendientes de calificación
            </p>
          </div>
        </div>

        {isLoading ? (
          <Card className="mt-6 panel-grades border-white/10 rounded-2xl">
            <CardContent className="py-12 text-center">
              <p className="text-white/60">Cargando tareas...</p>
            </CardContent>
          </Card>
        ) : pendingReview.length === 0 ? (
          <Card className="mt-6 panel-grades border-white/10 rounded-2xl">
            <CardContent className="py-16 text-center">
              <ClipboardList className="w-16 h-16 text-white/30 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-white mb-2">
                No hay tareas pendientes de revisión
              </h2>
              <p className="text-white/60 mb-6 max-w-md mx-auto">
                Cuando los estudiantes entreguen tareas, aparecerán aquí agrupadas por curso.
              </p>
              <Button
                onClick={() => setLocation('/dashboard')}
                className="bg-[#3B82F6] hover:bg-[#2563EB] text-white rounded-xl"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Volver al dashboard
              </Button>
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
                      {assignments.length} {assignments.length === 1 ? 'tarea' : 'tareas'}
                    </span>
                  </CardTitle>
                  <CardDescription className="text-white/60">
                    Haz clic en una tarea para ir al panel de calificación del curso.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {assignments.map((a) => (
                    <button
                      key={a._id}
                      type="button"
                      onClick={() =>
                        setLocation(
                          `/profesor/academia/tareas/calificacion/${a.courseId || a.curso}`
                        )
                      }
                      className="w-full flex items-center gap-3 p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all text-left"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-white truncate">{a.titulo}</p>
                        <div className="flex items-center gap-2 mt-1 text-sm text-white/60">
                          <Calendar className="w-4 h-4 flex-shrink-0" />
                          <span>
                            Entrega: {new Date(a.fechaEntrega).toLocaleDateString('es-CO')}
                          </span>
                        </div>
                      </div>
                      <ChevronRight className="w-5 h-5 text-white/50 flex-shrink-0" />
                    </button>
                  ))}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
