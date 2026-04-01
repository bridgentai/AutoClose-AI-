import { useAuth } from '@/lib/authContext';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useLocation } from 'wouter';
import {
  Megaphone,
  Shield,
  Users,
  Bell,
  Calendar,
  Plus,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

const CARD_STYLE = 'bg-white/5 border-white/10 backdrop-blur-md hover-elevate';

interface Stats {
  estudiantes: number;
  profesores: number;
  padres: number;
  directivos: number;
  cursos: number;
}

interface ComunicadosResponse {
  items: unknown[];
  total?: number;
}

interface AccessControlsResponse {
  features: Record<string, unknown | null>;
}

interface NotificationsResponse {
  unreadCount: number;
}

export default function AsistenteAcademicaDashboard() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  const { data: stats } = useQuery<Stats>({
    queryKey: ['adminStats', user?.colegioId],
    queryFn: () => apiRequest<Stats>('GET', '/api/users/stats'),
    enabled: !!user?.colegioId,
  });

  const { data: comunicadosData } = useQuery<ComunicadosResponse>({
    queryKey: ['comunicadosInstitucionales', user?.colegioId],
    queryFn: () => apiRequest<ComunicadosResponse>('GET', '/api/institucional/comunicados'),
    enabled: !!user?.colegioId,
  });

  const { data: accessControlsData } = useQuery<AccessControlsResponse>({
    queryKey: ['accessControls', user?.colegioId],
    queryFn: () => apiRequest<AccessControlsResponse>('GET', '/api/access-controls'),
    enabled: !!user?.colegioId,
  });

  const { data: notificationsData } = useQuery<NotificationsResponse>({
    queryKey: ['notifications', user?.id],
    queryFn: () => apiRequest<NotificationsResponse>('GET', '/api/notifications'),
    enabled: !!user?.id,
  });

  const comunicadosCount = comunicadosData?.items?.length ?? comunicadosData?.total ?? 0;
  const accesosActivos = Object.values(accessControlsData?.features ?? {}).filter(Boolean).length;
  const estudiantesCount = stats?.estudiantes ?? 0;
  const mensajesSinLeer = notificationsData?.unreadCount ?? 0;

  return (
    <div data-testid="asistente-academica-page">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2 font-['Poppins']">
          Bienvenida, {user?.nombre?.split(' ')[0] || 'Asistente'}
        </h1>
        <p className="text-white/60">
          {new Date().toLocaleDateString('es-CO', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        </p>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Card
          className={`${CARD_STYLE} cursor-pointer hover:bg-white/10 transition-all`}
          onClick={() => setLocation('/asistente-academica/comunicados')}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-white">Comunicados este mes</CardTitle>
            <Megaphone className="w-5 h-5 text-[var(--color-primary,#2563eb)]" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white font-['Poppins']">{comunicadosCount}</div>
            <p className="text-xs text-white/60 mt-1">Enviados</p>
          </CardContent>
        </Card>

        <Card
          className={`${CARD_STYLE} cursor-pointer hover:bg-white/10 transition-all`}
          onClick={() => setLocation('/asistente-academica/accesos')}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-white">Accesos bloqueados</CardTitle>
            <Shield className="w-5 h-5 text-[var(--color-primary,#2563eb)]" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white font-['Poppins']">{accesosActivos}</div>
            <p className="text-xs text-white/60 mt-1">Funcionalidades restringidas</p>
          </CardContent>
        </Card>

        <Card className={`${CARD_STYLE}`}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-white">Estudiantes</CardTitle>
            <Users className="w-5 h-5 text-[var(--color-primary,#2563eb)]" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white font-['Poppins']">{estudiantesCount}</div>
            <p className="text-xs text-white/60 mt-1">En la institución</p>
          </CardContent>
        </Card>

        <Card className={`${CARD_STYLE}`}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-white">Notificaciones</CardTitle>
            <Bell className="w-5 h-5 text-[var(--color-primary,#2563eb)]" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white font-['Poppins']">{mensajesSinLeer}</div>
            <p className="text-xs text-white/60 mt-1">Sin leer</p>
          </CardContent>
        </Card>
      </div>

      {/* Accesos rápidos */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className={`${CARD_STYLE} cursor-pointer hover:bg-white/10 transition-all`} onClick={() => setLocation('/asistente-academica/comunicados')}>
          <CardContent className="pt-6 flex flex-col items-center text-center gap-3">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(145deg, var(--color-primary,#2563eb), var(--color-secondary,#1d4ed8))' }}>
              <Plus className="w-6 h-6 text-white" />
            </div>
            <p className="text-white font-medium">Nuevo comunicado</p>
            <p className="text-white/50 text-sm">Redactar y publicar un comunicado institucional</p>
          </CardContent>
        </Card>

        <Card className={`${CARD_STYLE} cursor-pointer hover:bg-white/10 transition-all`} onClick={() => setLocation('/asistente-academica/accesos')}>
          <CardContent className="pt-6 flex flex-col items-center text-center gap-3">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-white/10">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <p className="text-white font-medium">Control de accesos</p>
            <p className="text-white/50 text-sm">Gestionar funcionalidades habilitadas por rol</p>
          </CardContent>
        </Card>

        <Card className={`${CARD_STYLE} cursor-pointer hover:bg-white/10 transition-all`} onClick={() => setLocation('/calendar')}>
          <CardContent className="pt-6 flex flex-col items-center text-center gap-3">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-white/10">
              <Calendar className="w-6 h-6 text-white" />
            </div>
            <p className="text-white font-medium">Calendario</p>
            <p className="text-white/50 text-sm">Ver eventos y actividades de la institución</p>
          </CardContent>
        </Card>
      </div>

      {/* Acceso a academia y mensajería */}
      <div className="flex gap-3 mt-6">
        <Button
          variant="outline"
          className="border-white/10 text-white hover:bg-white/10"
          onClick={() => setLocation('/directivo/academia')}
        >
          Academia
        </Button>
        <Button
          variant="outline"
          className="border-white/10 text-white hover:bg-white/10"
          onClick={() => setLocation('/evo-send')}
        >
          Evo Send
        </Button>
      </div>
    </div>
  );
}
