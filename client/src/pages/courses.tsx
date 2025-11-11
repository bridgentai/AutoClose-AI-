import { useAuth } from '@/lib/authContext';
import { AppSidebar } from '@/components/app-sidebar';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { GraduationCap, User, ArrowRight } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useLocation } from 'wouter';

const CURSOS = [
  { id: '9A', nombre: '9A', estudiantes: 32, color: 'from-purple-500 to-pink-500' },
  { id: '9B', nombre: '9B', estudiantes: 30, color: 'from-blue-500 to-cyan-500' },
  { id: '10A', nombre: '10A', estudiantes: 28, color: 'from-green-500 to-emerald-500' },
  { id: '10B', nombre: '10B', estudiantes: 31, color: 'from-yellow-500 to-orange-500' },
  { id: '11H', nombre: '11H', estudiantes: 27, color: 'from-red-500 to-rose-500' },
  { id: '11D', nombre: '11D', estudiantes: 29, color: 'from-indigo-500 to-purple-500' },
  { id: '11C', nombre: '11C', estudiantes: 26, color: 'from-teal-500 to-cyan-500' },
  { id: '12H', nombre: '12H', estudiantes: 24, color: 'from-amber-500 to-yellow-500' },
  { id: '12D', nombre: '12D', estudiantes: 25, color: 'from-violet-500 to-purple-500' },
  { id: '12C', nombre: '12C', estudiantes: 23, color: 'from-fuchsia-500 to-pink-500' },
];

export default function CoursesPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  const handleCursoClick = (cursoId: string) => {
    setLocation(`/course/${cursoId}`);
  };

  return (
    <SidebarProvider>
      <div className="flex h-screen w-full bg-gradient-to-br from-[#0a0a0c] via-[#1a001c] to-[#3d0045]">
        <AppSidebar />
        <SidebarInset className="flex flex-col flex-1">
          <header className="flex items-center justify-between p-4 border-b border-white/10 backdrop-blur-xl bg-black/20">
            <div className="flex items-center gap-3">
              <SidebarTrigger data-testid="button-sidebar-toggle" className="text-white" />
              <h1 className="text-xl font-bold text-white font-['Poppins']">
                Mis Cursos
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
                  Gestión de Cursos
                </h2>
                <p className="text-white/60">
                  Selecciona un curso para gestionar tareas y ver el calendario
                </p>
              </div>

              {/* Grid de cursos */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {CURSOS.map((curso) => (
                  <Card 
                    key={curso.id}
                    className="bg-white/5 border-white/10 backdrop-blur-md hover-elevate cursor-pointer group"
                    onClick={() => handleCursoClick(curso.id)}
                    data-testid={`card-curso-${curso.id}`}
                  >
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${curso.color} flex items-center justify-center`}>
                          <GraduationCap className="w-8 h-8 text-white" />
                        </div>
                        <ArrowRight className="w-5 h-5 text-white/40 group-hover:text-white/80 transition-colors" />
                      </div>
                      <CardTitle className="text-white text-2xl font-bold mt-4">
                        {curso.nombre}
                      </CardTitle>
                      <CardDescription className="text-white/60">
                        {curso.estudiantes} estudiantes
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Button
                        variant="outline"
                        className="w-full border-white/10 text-white hover:bg-white/10"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCursoClick(curso.id);
                        }}
                        data-testid={`button-open-${curso.id}`}
                      >
                        Abrir Curso
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Estadísticas rápidas */}
              <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="bg-white/5 border-white/10 backdrop-blur-md">
                  <CardHeader>
                    <CardTitle className="text-white">Total de Cursos</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-4xl font-bold text-white">{CURSOS.length}</div>
                    <p className="text-sm text-white/60 mt-2">Cursos asignados</p>
                  </CardContent>
                </Card>

                <Card className="bg-white/5 border-white/10 backdrop-blur-md">
                  <CardHeader>
                    <CardTitle className="text-white">Total Estudiantes</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-4xl font-bold text-white">
                      {CURSOS.reduce((acc, curso) => acc + curso.estudiantes, 0)}
                    </div>
                    <p className="text-sm text-white/60 mt-2">En todos los cursos</p>
                  </CardContent>
                </Card>

                <Card className="bg-white/5 border-white/10 backdrop-blur-md">
                  <CardHeader>
                    <CardTitle className="text-white">Promedio por Curso</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-4xl font-bold text-white">
                      {Math.round(CURSOS.reduce((acc, curso) => acc + curso.estudiantes, 0) / CURSOS.length)}
                    </div>
                    <p className="text-sm text-white/60 mt-2">Estudiantes por curso</p>
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
