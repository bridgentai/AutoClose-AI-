import { useAuth } from '@/lib/authContext';
import { AppSidebar } from '@/components/app-sidebar';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { BookOpen, GraduationCap, MessageSquare, User, TrendingUp, Plus } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useLocation } from 'wouter';

export default function TeacherPage() {
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
                Portal Profesor
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
                  Bienvenido, Profesor {user?.nombre?.split(' ')[0] || ''} 👋
                </h2>
                <p className="text-white/60">
                  {new Date().toLocaleDateString('es-CO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </p>
              </div>

              {/* Quick Stats */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <Card className="bg-white/5 border-white/10 backdrop-blur-md hover-elevate">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-white">
                      <BookOpen className="w-5 h-5 text-[#9f25b8]" />
                      Mis Cursos
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-white">5</div>
                    <p className="text-sm text-white/50 mt-1">Cursos a cargo</p>
                  </CardContent>
                </Card>

                <Card className="bg-white/5 border-white/10 backdrop-blur-md hover-elevate">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-white">
                      <GraduationCap className="w-5 h-5 text-[#9f25b8]" />
                      Estudiantes
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-white">142</div>
                    <p className="text-sm text-white/50 mt-1">Total</p>
                  </CardContent>
                </Card>

                <Card className="bg-white/5 border-white/10 backdrop-blur-md hover-elevate">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-white">
                      <MessageSquare className="w-5 h-5 text-[#9f25b8]" />
                      Materiales
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-white">38</div>
                    <p className="text-sm text-white/50 mt-1">Este mes</p>
                  </CardContent>
                </Card>

                <Card className="bg-white/5 border-white/10 backdrop-blur-md hover-elevate">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-white">
                      <TrendingUp className="w-5 h-5 text-[#9f25b8]" />
                      Engagement
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-white">85%</div>
                    <p className="text-sm text-white/50 mt-1">Promedio</p>
                  </CardContent>
                </Card>
              </div>

              {/* Quick Actions */}
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
                      data-testid="button-chat"
                    >
                      <MessageSquare className="w-4 h-4 mr-2" />
                      Abrir Chat AI
                    </Button>
                    <Button
                      onClick={() => setLocation('/courses')}
                      variant="outline"
                      className="w-full justify-start border-white/10 text-white hover:bg-white/10"
                      data-testid="button-courses"
                    >
                      <BookOpen className="w-4 h-4 mr-2" />
                      Gestionar Cursos
                    </Button>
                    <Button
                      onClick={() => setLocation('/materials')}
                      variant="outline"
                      className="w-full justify-start border-white/10 text-white hover:bg-white/10"
                      data-testid="button-materials"
                    >
                      <GraduationCap className="w-4 h-4 mr-2" />
                      Subir Materiales
                    </Button>
                  </CardContent>
                </Card>

                <Card className="bg-white/5 border-white/10 backdrop-blur-md">
                  <CardHeader>
                    <CardTitle className="text-white">Gestión de Cursos</CardTitle>
                    <CardDescription className="text-white/60">Administra tus materias</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button
                      className="w-full bg-gradient-to-r from-[#9f25b8] to-[#6a0dad] hover:opacity-90"
                      data-testid="button-create-course"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Crear Nuevo Curso
                    </Button>
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
