import { useAuth } from '@/lib/authContext';
import { Bus, Route, Users, Clock, MessageSquare, MapPin } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useLocation } from 'wouter';

export default function TransportePage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  return (
    <div data-testid="transporte-page">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-white mb-2 font-['Poppins']">
          Bienvenido, {user?.nombre?.split(' ')[0] || 'Gestor de Transporte'}
        </h2>
        <p className="text-white/60">
          {new Date().toLocaleDateString('es-CO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card className="bg-white/5 border-white/10 backdrop-blur-md hover-elevate">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <Bus className="w-5 h-5 text-[#9f25b8]" />
              Rutas Activas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white">0</div>
            <p className="text-sm text-white/50 mt-1">En operación</p>
          </CardContent>
        </Card>

        <Card className="bg-white/5 border-white/10 backdrop-blur-md hover-elevate">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <Users className="w-5 h-5 text-[#9f25b8]" />
              Estudiantes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white">0</div>
            <p className="text-sm text-white/50 mt-1">Asignados a rutas</p>
          </CardContent>
        </Card>

        <Card className="bg-white/5 border-white/10 backdrop-blur-md hover-elevate">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <MapPin className="w-5 h-5 text-[#9f25b8]" />
              Paraderos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white">0</div>
            <p className="text-sm text-white/50 mt-1">Puntos de recogida</p>
          </CardContent>
        </Card>

        <Card className="bg-white/5 border-white/10 backdrop-blur-md hover-elevate">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <Clock className="w-5 h-5 text-[#9f25b8]" />
              Llegadas Hoy
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white">0</div>
            <p className="text-sm text-white/50 mt-1">Registradas</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-white/5 border-white/10 backdrop-blur-md">
          <CardHeader>
            <CardTitle className="text-white">Acceso Rápido</CardTitle>
            <CardDescription className="text-white/60">Herramientas principales</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              onClick={() => setLocation('/chat')}
              className="w-full justify-start bg-gradient-to-r from-[#9f25b8] to-[#6a0dad] hover:opacity-90"
            >
              <MessageSquare className="w-4 h-4 mr-2" />
              Abrir Chat AI
            </Button>
            <Button
              onClick={() => setLocation('/transporte/comunidad')}
              variant="outline"
              className="w-full justify-start border-white/10 text-white hover:bg-white/10"
            >
              <Route className="w-4 h-4 mr-2" />
              Gestión de Rutas
            </Button>
            <Button
              onClick={() => setLocation('/transporte/academia')}
              variant="outline"
              className="w-full justify-start border-white/10 text-white hover:bg-white/10"
            >
              <Users className="w-4 h-4 mr-2" />
              Asistencia en Transporte
            </Button>
            <Button
              onClick={() => setLocation('/mi-perfil')}
              variant="outline"
              className="w-full justify-start border-white/10 text-white hover:bg-white/10"
            >
              <Bus className="w-4 h-4 mr-2" />
              Mi Perfil
            </Button>
          </CardContent>
        </Card>

        <Card className="bg-white/5 border-white/10 backdrop-blur-md">
          <CardHeader>
            <CardTitle className="text-white">Rutas de Hoy</CardTitle>
            <CardDescription className="text-white/60">Estado de las rutas activas</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-white/60 text-sm text-center py-8">
              No hay rutas configuradas
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

