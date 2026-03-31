import { useAuth } from '@/lib/authContext';
import { MessageSquare, TrendingUp, BookOpen, Megaphone } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { parseComunicadoAttachments } from '@/lib/comunicadoAttachments';

interface UnreadComItem {
  id: string;
  title: string;
  body: string | null;
  subject_name: string | null;
  group_name: string | null;
  created_at: string;
  attachments_json?: unknown;
}

export default function ParentPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  const { data: unreadPadres } = useQuery({
    queryKey: ['padres-comunicados-unread-dash'],
    queryFn: async () => {
      const token = localStorage.getItem('autoclose_token') || localStorage.getItem('token');
      const res = await fetch('/api/courses/comunicados-padres-unread?limit=3', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return { items: [] as UnreadComItem[], count: 0 };
      return res.json() as { items: UnreadComItem[]; count: number };
    },
    enabled: user?.rol === 'padre',
  });

  return (
    <div data-testid="parent-page">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-white mb-2 font-['Poppins']">
          Bienvenido, {user?.nombre?.split(' ')[0] || 'Padre/Madre'}
        </h2>
        <p className="text-white/60">
          {new Date().toLocaleDateString('es-CO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {user?.rol === 'padre' && (
        <Card className="bg-white/5 border-white/10 backdrop-blur-md mb-8">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div className="flex items-center gap-2">
              <Megaphone className="w-5 h-5 text-[#3B82F6]" />
              <CardTitle className="text-white">Comunicados</CardTitle>
              {(unreadPadres?.count ?? 0) > 0 && (
                <span className="ml-2 min-w-[24px] h-6 px-2 rounded-full bg-red-600 text-white text-xs font-bold flex items-center justify-center">
                  {unreadPadres!.count > 99 ? '99+' : unreadPadres!.count}
                </span>
              )}
            </div>
            <Button
              variant="ghost"
              className="text-[#3B82F6] hover:text-[#60a5fa] hover:bg-white/5 text-sm"
              onClick={() => setLocation('/comunicacion/academico')}
            >
              Ver todos
            </Button>
          </CardHeader>
          <CardContent>
            {!unreadPadres?.items?.length ? (
              <p className="text-white/50 text-sm">No tienes comunicados sin leer.</p>
            ) : (
              <ul className="space-y-3">
                {unreadPadres.items.map((c) => (
                  <li
                    key={c.id}
                    className="rounded-lg border border-white/10 bg-white/[0.03] p-3 cursor-pointer hover:bg-white/[0.06]"
                    onClick={() => setLocation('/comunicacion/academico')}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') setLocation('/comunicacion/academico');
                    }}
                    role="button"
                    tabIndex={0}
                  >
                    <p className="text-white font-medium text-sm line-clamp-1">{c.title}</p>
                    <p className="text-white/45 text-xs mt-1">
                      {[c.subject_name, c.group_name].filter(Boolean).join(' · ')}
                      {parseComunicadoAttachments(c.attachments_json).some((a) => a.url) && (
                        <span className="ml-2 text-[#00c8ff]/90">· Adjuntos</span>
                      )}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <Card className="bg-white/5 border-white/10 backdrop-blur-md">
          <CardHeader>
            <CardTitle className="text-white">Acceso Rapido</CardTitle>
            <CardDescription className="text-white/60">Herramientas principales</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              onClick={() => setLocation('/chat')}
              className="w-full justify-start bg-gradient-to-r from-[#002366] to-[#1e3cff] hover:opacity-90"
              data-testid="button-chat"
            >
              <MessageSquare className="w-4 h-4 mr-2" />
              Abrir Chat AI
            </Button>
            <Button
              onClick={() => setLocation('/parent/materiales')}
              variant="outline"
              className="w-full justify-start border-white/10 text-white hover:bg-white/10"
              data-testid="button-materials"
            >
              <BookOpen className="w-4 h-4 mr-2" />
              Materiales del hijo/a (solo lectura)
            </Button>
            <Button
              onClick={() => setLocation('/parent/aprendizaje')}
              variant="outline"
              className="w-full justify-start border-white/10 text-white hover:bg-white/10"
            >
              <TrendingUp className="w-4 h-4 mr-2" />
              Todo el aprendizaje (como el estudiante)
            </Button>
          </CardContent>
        </Card>

        <Card className="bg-white/5 border-white/10 backdrop-blur-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <TrendingUp className="w-5 h-5 text-[#1e3cff]" />
              Rendimiento General
            </CardTitle>
            <CardDescription className="text-white/60">Promedio academico</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-5xl font-bold text-white mb-2">90</div>
            <p className="text-sm text-white/50">de 100</p>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-white/5 border-white/10 backdrop-blur-md mb-6">
        <CardHeader>
          <CardTitle className="text-white">Seguimiento del Estudiante</CardTitle>
          <CardDescription className="text-white/60">Progreso academico de su hijo/a</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="p-4 bg-white/5 rounded-xl">
              <div className="flex items-center justify-between mb-3">
                <span className="text-white font-medium">Matematicas</span>
                <span className="text-[#1e3cff] font-bold">90/100</span>
              </div>
              <div className="w-full bg-white/10 rounded-full h-2">
                <div className="bg-gradient-to-r from-[#002366] to-[#1e3cff] h-2 rounded-full" style={{ width: '90%' }} />
              </div>
            </div>

            <div className="p-4 bg-white/5 rounded-xl">
              <div className="flex items-center justify-between mb-3">
                <span className="text-white font-medium">Ciencias</span>
                <span className="text-[#1e3cff] font-bold">84/100</span>
              </div>
              <div className="w-full bg-white/10 rounded-full h-2">
                <div className="bg-gradient-to-r from-[#002366] to-[#1e3cff] h-2 rounded-full" style={{ width: '84%' }} />
              </div>
            </div>

            <div className="p-4 bg-white/5 rounded-xl">
              <div className="flex items-center justify-between mb-3">
                <span className="text-white font-medium">Historia</span>
                <span className="text-[#1e3cff] font-bold">94/100</span>
              </div>
              <div className="w-full bg-white/10 rounded-full h-2">
                <div className="bg-gradient-to-r from-[#002366] to-[#1e3cff] h-2 rounded-full" style={{ width: '94%' }} />
              </div>
            </div>

            <div className="p-4 bg-white/5 rounded-xl">
              <div className="flex items-center justify-between mb-3">
                <span className="text-white font-medium">Fisica</span>
                <span className="text-[#1e3cff] font-bold">88/100</span>
              </div>
              <div className="w-full bg-white/10 rounded-full h-2">
                <div className="bg-gradient-to-r from-[#002366] to-[#1e3cff] h-2 rounded-full" style={{ width: '88%' }} />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-white/5 border-white/10 backdrop-blur-md">
        <CardHeader>
          <CardTitle className="text-white">Comunicación con docentes</CardTitle>
          <CardDescription className="text-white/60">Usa el chat AI para consultas</CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            onClick={() => setLocation('/chat')}
            className="w-full bg-gradient-to-r from-[#002366] to-[#1e3cff] hover:opacity-90"
            data-testid="button-chat-main"
          >
            Iniciar Chat con EvoOS
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
