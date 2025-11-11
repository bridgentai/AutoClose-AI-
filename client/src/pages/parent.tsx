import { useAuth } from '@/lib/authContext';
import { AppSidebar } from '@/components/app-sidebar';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { MessageSquare, User, TrendingUp, BookOpen } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useLocation } from 'wouter';

export default function ParentPage() {
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
                Portal Padres
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
                  Bienvenido, {user?.nombre?.split(' ')[0] || 'Padre/Madre'} 👋
                </h2>
                <p className="text-white/60">
                  {new Date().toLocaleDateString('es-CO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </p>
              </div>

              {/* Quick Actions */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                <Card className="bg-white/5 border-white/10 backdrop-blur-md">
                  <CardHeader>
                    <CardTitle className="text-white">Acceso Rápido</CardTitle>
                    <CardDescription className="text-white/60">Herramientas principales</CardDescription>
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
                      onClick={() => setLocation('/materials')}
                      variant="outline"
                      className="w-full justify-start border-white/10 text-white hover:bg-white/10"
                      data-testid="button-materials"
                    >
                      <BookOpen className="w-4 h-4 mr-2" />
                      Ver Materiales
                    </Button>
                  </CardContent>
                </Card>

                <Card className="bg-white/5 border-white/10 backdrop-blur-md">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-white">
                      <TrendingUp className="w-5 h-5 text-[#9f25b8]" />
                      Rendimiento General
                    </CardTitle>
                    <CardDescription className="text-white/60">Promedio académico</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-5xl font-bold text-white mb-2">4.5</div>
                    <p className="text-sm text-white/50">de 5.0</p>
                  </CardContent>
                </Card>
              </div>

              {/* Student Progress */}
              <Card className="bg-white/5 border-white/10 backdrop-blur-md mb-6">
                <CardHeader>
                  <CardTitle className="text-white">Seguimiento del Estudiante</CardTitle>
                  <CardDescription className="text-white/60">Progreso académico de su hijo/a</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="p-4 bg-white/5 rounded-xl">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-white font-medium">Matemáticas</span>
                        <span className="text-[#9f25b8] font-bold">4.5/5.0</span>
                      </div>
                      <div className="w-full bg-white/10 rounded-full h-2">
                        <div className="bg-gradient-to-r from-[#9f25b8] to-[#6a0dad] h-2 rounded-full" style={{ width: '90%' }} />
                      </div>
                    </div>

                    <div className="p-4 bg-white/5 rounded-xl">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-white font-medium">Ciencias</span>
                        <span className="text-[#9f25b8] font-bold">4.2/5.0</span>
                      </div>
                      <div className="w-full bg-white/10 rounded-full h-2">
                        <div className="bg-gradient-to-r from-[#9f25b8] to-[#6a0dad] h-2 rounded-full" style={{ width: '84%' }} />
                      </div>
                    </div>

                    <div className="p-4 bg-white/5 rounded-xl">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-white font-medium">Historia</span>
                        <span className="text-[#9f25b8] font-bold">4.7/5.0</span>
                      </div>
                      <div className="w-full bg-white/10 rounded-full h-2">
                        <div className="bg-gradient-to-r from-[#9f25b8] to-[#6a0dad] h-2 rounded-full" style={{ width: '94%' }} />
                      </div>
                    </div>

                    <div className="p-4 bg-white/5 rounded-xl">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-white font-medium">Física</span>
                        <span className="text-[#9f25b8] font-bold">4.4/5.0</span>
                      </div>
                      <div className="w-full bg-white/10 rounded-full h-2">
                        <div className="bg-gradient-to-r from-[#9f25b8] to-[#6a0dad] h-2 rounded-full" style={{ width: '88%' }} />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-white/5 border-white/10 backdrop-blur-md">
                <CardHeader>
                  <CardTitle className="text-white">Comunicación con Docentes</CardTitle>
                  <CardDescription className="text-white/60">Usa el chat AI para consultas</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button
                    onClick={() => setLocation('/chat')}
                    className="w-full bg-gradient-to-r from-[#9f25b8] to-[#6a0dad] hover:opacity-90"
                    data-testid="button-chat-main"
                  >
                    Iniciar Chat con AutoClose AI
                  </Button>
                </CardContent>
              </Card>
            </div>
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
