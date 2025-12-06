import { useAuth } from '@/lib/authContext';
import { AppSidebar } from '@/components/app-sidebar';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { User, ExternalLink, Globe, BookOpen, Video, FileText, Presentation } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useLocation } from 'wouter';

const plataformas = [
  {
    id: 1,
    nombre: 'Google Classroom',
    descripcion: 'Gestión de clases y tareas',
    url: 'https://classroom.google.com',
    icono: BookOpen,
    color: 'from-green-500 to-green-600'
  },
  {
    id: 2,
    nombre: 'Microsoft Teams',
    descripcion: 'Videollamadas y colaboración',
    url: 'https://teams.microsoft.com',
    icono: Video,
    color: 'from-blue-500 to-blue-600'
  },
  {
    id: 3,
    nombre: 'Moodle',
    descripcion: 'Plataforma de aprendizaje',
    url: 'https://moodle.org',
    icono: Globe,
    color: 'from-orange-500 to-orange-600'
  },
  {
    id: 4,
    nombre: 'Canva Educación',
    descripcion: 'Diseño de presentaciones',
    url: 'https://www.canva.com/education',
    icono: Presentation,
    color: 'from-purple-500 to-purple-600'
  },
  {
    id: 5,
    nombre: 'Genially',
    descripcion: 'Contenido interactivo',
    url: 'https://genial.ly',
    icono: FileText,
    color: 'from-cyan-500 to-cyan-600'
  },
  {
    id: 6,
    nombre: 'Kahoot!',
    descripcion: 'Cuestionarios interactivos',
    url: 'https://kahoot.com',
    icono: Globe,
    color: 'from-pink-500 to-pink-600'
  }
];

export default function PlataformasPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  if (user?.rol !== 'profesor') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0a0a0c] via-[#1a001c] to-[#3d0045]">
        <Card className="bg-white/5 border-white/10 backdrop-blur-md">
          <CardContent className="p-8 text-center">
            <p className="text-white/70">No tienes acceso a esta página</p>
            <Button 
              onClick={() => setLocation('/dashboard')} 
              className="mt-4"
              data-testid="button-go-dashboard"
            >
              Ir al Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div className="flex h-screen w-full bg-gradient-to-br from-[#0a0a0c] via-[#1a001c] to-[#3d0045]">
        <AppSidebar />
        <SidebarInset className="flex flex-col flex-1">
          <header className="flex items-center justify-between p-4 border-b border-white/10 backdrop-blur-xl bg-black/20">
            <div className="flex items-center gap-3">
              <SidebarTrigger data-testid="button-sidebar-toggle" className="text-white" />
              <h1 className="text-xl font-bold text-white font-['Poppins']">
                Plataformas Educativas
              </h1>
            </div>
            <Button
              onClick={() => setLocation('/account')}
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/10"
              data-testid="button-account"
            >
              <User className="w-5 h-5" />
            </Button>
          </header>

          <main className="flex-1 overflow-auto p-8">
            <div className="max-w-7xl mx-auto">
              <div className="mb-8">
                <h2 className="text-3xl font-bold text-white mb-2 font-['Poppins']">
                  Herramientas Externas
                </h2>
                <p className="text-white/60">
                  Accede a las plataformas educativas que utilizas en tus clases
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {plataformas.map((plataforma) => {
                  const IconComponent = plataforma.icono;
                  return (
                    <Card 
                      key={plataforma.id} 
                      className="bg-white/5 border-white/10 backdrop-blur-md hover-elevate group"
                      data-testid={`card-plataforma-${plataforma.id}`}
                    >
                      <CardHeader>
                        <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${plataforma.color} flex items-center justify-center mb-3`}>
                          <IconComponent className="w-6 h-6 text-white" />
                        </div>
                        <CardTitle className="text-white flex items-center gap-2">
                          {plataforma.nombre}
                        </CardTitle>
                        <CardDescription className="text-white/60">
                          {plataforma.descripcion}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <Button
                          onClick={() => window.open(plataforma.url, '_blank')}
                          className="w-full bg-gradient-to-r from-[#9f25b8] to-[#6a0dad] hover:opacity-90"
                          data-testid={`button-open-${plataforma.id}`}
                        >
                          <ExternalLink className="w-4 h-4 mr-2" />
                          Abrir Plataforma
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
