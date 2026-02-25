import { useAuth } from '@/lib/authContext';
import { Users, Shield, BarChart3, MessageSquare, Settings, Database } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useLocation } from 'wouter';
import { NavBackButton } from '@/components/nav-back-button';

export default function AdministradorGeneralPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  return (
    <div data-testid="administrador-general-page">
      <NavBackButton to="/dashboard" label="Dashboard" />
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-white mb-2 font-['Poppins']">
          Bienvenido, Administrador {user?.nombre?.split(' ')[0] || ''}
        </h2>
        <p className="text-white/60">
          {new Date().toLocaleDateString('es-CO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card className="bg-white/5 border-white/10 backdrop-blur-md hover-elevate">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <Users className="w-5 h-5 text-[#1e3cff]" />
              Usuarios Totales
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white">0</div>
            <p className="text-sm text-white/50 mt-1">Usuarios registrados</p>
          </CardContent>
        </Card>

        <Card className="bg-white/5 border-white/10 backdrop-blur-md hover-elevate">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <Database className="w-5 h-5 text-[#1e3cff]" />
              Cursos Activos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white">0</div>
            <p className="text-sm text-white/50 mt-1">En la plataforma</p>
          </CardContent>
        </Card>

        <Card className="bg-white/5 border-white/10 backdrop-blur-md hover-elevate">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <Shield className="w-5 h-5 text-[#1e3cff]" />
              Auditoría
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white">0</div>
            <p className="text-sm text-white/50 mt-1">Eventos hoy</p>
          </CardContent>
        </Card>

        <Card className="bg-white/5 border-white/10 backdrop-blur-md hover-elevate">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <BarChart3 className="w-5 h-5 text-[#1e3cff]" />
              Accesos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white">0</div>
            <p className="text-sm text-white/50 mt-1">Hoy</p>
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
              className="w-full justify-start bg-gradient-to-r from-[#002366] to-[#1e3cff] hover:opacity-90"
            >
              <MessageSquare className="w-4 h-4 mr-2" />
              Abrir Chat AI
            </Button>
            <Button
              onClick={() => setLocation('/administrador-general/comunidad')}
              variant="outline"
              className="w-full justify-start border-white/10 text-white hover:bg-white/10"
            >
              <Users className="w-4 h-4 mr-2" />
              Gestión de Usuarios
            </Button>
            <Button
              onClick={() => setLocation('/administrador-general/academia')}
              variant="outline"
              className="w-full justify-start border-white/10 text-white hover:bg-white/10"
            >
              <Database className="w-4 h-4 mr-2" />
              Configuración Académica
            </Button>
            <Button
              onClick={() => setLocation('/mi-perfil')}
              variant="outline"
              className="w-full justify-start border-white/10 text-white hover:bg-white/10"
            >
              <Settings className="w-4 h-4 mr-2" />
              Mi Perfil
            </Button>
          </CardContent>
        </Card>

        <Card className="bg-white/5 border-white/10 backdrop-blur-md">
          <CardHeader>
            <CardTitle className="text-white">Actividad Reciente</CardTitle>
            <CardDescription className="text-white/60">Últimas acciones en el sistema</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-white/60 text-sm text-center py-8">
              No hay actividad reciente
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

