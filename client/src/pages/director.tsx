import { useAuth } from '@/lib/authContext';
import { AppSidebar } from '@/components/app-sidebar';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { Users, BookOpen, MessageSquare, User, Settings, BarChart3 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useLocation } from 'wouter';

export default function DirectorPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  return (
    <SidebarProvider>
      <div className="flex h-screen w-full bg-gradient-to-br from-[#0a0a0c] via-[#1a001c] to-[#3d0045]">
        <AppSidebar />
        <SidebarInset className="flex flex-col flex-1">
          <header className="flex items-center justify-between p-4 border-b border-white/10 backdrop-blur-xl bg-black/20">
            <div className="flex items-center gap-3">
              <SidebarTrigger data-testid="button-sidebar-toggle" className="text-white" />
              <h1 className="text-xl font-bold text-white font-['Poppins']">
                Portal Directivo
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
                  Bienvenido, Director {user?.nombre?.split(' ')[0] || ''} 👋
                </h2>
                <p className="text-white/60">
                  {new Date().toLocaleDateString('es-CO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </p>
              </div>

              {/* Quick Stats */}
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
                    <p className="text-sm text-white/50 mt-1">Este período</p>
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

              {/* Quick Actions */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="bg-white/5 border-white/10 backdrop-blur-md">
                  <CardHeader>
                    <CardTitle className="text-white">Acceso Rápido</CardTitle>
                    <CardDescription className="text-white/60">Herramientas administrativas</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Button
                      onClick={() => setLocation('/chat')}
                      className="w-full justify-start bg-gradient-to-r from-[#9f25b8] to-[#6a0dad] hover:opacity-90"
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
                      Configuración Institucional
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full justify-start border-white/10 text-white hover:bg-white/10"
                      data-testid="button-analytics"
                    >
                      <BarChart3 className="w-4 h-4 mr-2" />
                      Ver Analíticas
                    </Button>
                  </CardContent>
                </Card>

                <Card className="bg-white/5 border-white/10 backdrop-blur-md">
                  <CardHeader>
                    <CardTitle className="text-white">Panel Administrativo</CardTitle>
                    <CardDescription className="text-white/60">Gestión institucional</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="p-4 bg-white/5 hover:bg-white/10 rounded-xl transition-colors cursor-pointer">
                      <div className="flex items-center gap-3">
                        <Settings className="w-5 h-5 text-[#9f25b8]" />
                        <div>
                          <div className="font-medium text-white">Identidad Institucional</div>
                          <div className="text-sm text-white/50">Logo, colores, IA</div>
                        </div>
                      </div>
                    </div>
                    <div className="p-4 bg-white/5 hover:bg-white/10 rounded-xl transition-colors cursor-pointer">
                      <div className="flex items-center gap-3">
                        <Users className="w-5 h-5 text-[#9f25b8]" />
                        <div>
                          <div className="font-medium text-white">Gestionar Usuarios</div>
                          <div className="text-sm text-white/50">Profesores, estudiantes</div>
                        </div>
                      </div>
                    </div>
                    <div className="p-4 bg-white/5 hover:bg-white/10 rounded-xl transition-colors cursor-pointer">
                      <div className="flex items-center gap-3">
                        <BookOpen className="w-5 h-5 text-[#9f25b8]" />
                        <div>
                          <div className="font-medium text-white">Contenido Curricular</div>
                          <div className="text-sm text-white/50">Metodología y materiales</div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
