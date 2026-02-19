import { useAuth } from '@/lib/authContext';
import { Users, BookOpen, MessageSquare, Settings, BarChart3 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useLocation } from 'wouter';

export default function DirectorPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  return (
    <div data-testid="director-page">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-white mb-2 font-['Poppins']">
          Bienvenido, Director {user?.nombre?.split(' ')[0] || ''}
        </h2>
        <p className="text-white/60">
          {new Date().toLocaleDateString('es-CO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card className="bg-white/5 border-white/10 backdrop-blur-md hover-elevate">
          <CardHeader>
            <CardTitle className="text-white text-sm">Profesores</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white">24</div>
            <p className="text-sm text-white/50 mt-1">Activos</p>
          </CardContent>
        </Card>

        <Card className="bg-white/5 border-white/10 backdrop-blur-md hover-elevate">
          <CardHeader>
            <CardTitle className="text-white text-sm">Estudiantes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white">680</div>
            <p className="text-sm text-white/50 mt-1">Matriculados</p>
          </CardContent>
        </Card>

        <Card className="bg-white/5 border-white/10 backdrop-blur-md hover-elevate">
          <CardHeader>
            <CardTitle className="text-white text-sm">Cursos Activos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white">42</div>
            <p className="text-sm text-white/50 mt-1">Este periodo</p>
          </CardContent>
        </Card>

        <Card className="bg-white/5 border-white/10 backdrop-blur-md hover-elevate">
          <CardHeader>
            <CardTitle className="text-white text-sm">Uso IA</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white">1.2k</div>
            <p className="text-sm text-white/50 mt-1">Consultas/mes</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-white/5 border-white/10 backdrop-blur-md">
          <CardHeader>
            <CardTitle className="text-white">Acceso Rapido</CardTitle>
            <CardDescription className="text-white/60">Herramientas administrativas</CardDescription>
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
              onClick={() => setLocation('/setup')}
              variant="outline"
              className="w-full justify-start border-white/10 text-white hover:bg-white/10"
              data-testid="button-setup"
            >
              <Settings className="w-4 h-4 mr-2" />
              Configuracion Institucional
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start border-white/10 text-white hover:bg-white/10"
              data-testid="button-analytics"
            >
              <BarChart3 className="w-4 h-4 mr-2" />
              Ver Analiticas
            </Button>
          </CardContent>
        </Card>

        <Card className="bg-white/5 border-white/10 backdrop-blur-md">
          <CardHeader>
            <CardTitle className="text-white">Panel Administrativo</CardTitle>
            <CardDescription className="text-white/60">Gestion institucional</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="p-4 bg-white/5 hover:bg-white/10 rounded-xl transition-colors cursor-pointer">
              <div className="flex items-center gap-3">
                <Settings className="w-5 h-5 text-[#1e3cff]" />
                <div>
                  <div className="font-medium text-white">Identidad Institucional</div>
                  <div className="text-sm text-white/50">Logo, colores, IA</div>
                </div>
              </div>
            </div>
            <div className="p-4 bg-white/5 hover:bg-white/10 rounded-xl transition-colors cursor-pointer">
              <div className="flex items-center gap-3">
                <Users className="w-5 h-5 text-[#1e3cff]" />
                <div>
                  <div className="font-medium text-white">Gestionar Usuarios</div>
                  <div className="text-sm text-white/50">Profesores, estudiantes</div>
                </div>
              </div>
            </div>
            <div className="p-4 bg-white/5 hover:bg-white/10 rounded-xl transition-colors cursor-pointer">
              <div className="flex items-center gap-3">
                <BookOpen className="w-5 h-5 text-[#1e3cff]" />
                <div>
                  <div className="font-medium text-white">Contenido Curricular</div>
                  <div className="text-sm text-white/50">Metodologia y materiales</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
