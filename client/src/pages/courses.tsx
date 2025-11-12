import { useAuth } from '@/lib/authContext';
import { AppSidebar } from '@/components/app-sidebar';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { GraduationCap, User, ArrowRight, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';

interface Course {
  _id: string;
  nombre: string;
  descripcion?: string;
  profesorId: {
    _id: string;
    nombre: string;
    email: string;
  };
  cursos: string[];
  colorAcento?: string;
  icono?: string;
}

interface CursoCard {
  id: string;
  nombre: string;
  materias: string[];
  color: string;
}

const GRADIENT_COLORS = [
  'from-purple-500 to-pink-500',
  'from-blue-500 to-cyan-500',
  'from-green-500 to-emerald-500',
  'from-yellow-500 to-orange-500',
  'from-red-500 to-rose-500',
  'from-indigo-500 to-purple-500',
  'from-teal-500 to-cyan-500',
  'from-amber-500 to-yellow-500',
  'from-violet-500 to-purple-500',
  'from-fuchsia-500 to-pink-500',
];

export default function CoursesPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  // Fetch courses from API
  const { data: courses = [], isLoading, error } = useQuery<Course[]>({
    queryKey: ['/api/courses'],
  });

  // Transform courses into group-based cards
  // Teachers are already filtered by profesorId on backend, so group by grupo
  const grupoMap = new Map<string, string[]>();
  courses.forEach(course => {
    // Deduplicate grupos within each course using Set
    const uniqueGrupos = Array.from(new Set(course.cursos));
    uniqueGrupos.forEach(grupo => {
      if (!grupoMap.has(grupo)) {
        grupoMap.set(grupo, []);
      }
      grupoMap.get(grupo)!.push(course.nombre);
    });
  });

  const cursoCards: CursoCard[] = Array.from(grupoMap.entries()).map(([grupo, materias], index) => ({
    id: grupo,
    nombre: grupo,
    materias: materias,
    color: GRADIENT_COLORS[index % GRADIENT_COLORS.length],
  }));

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

              {/* Loading State */}
              {isLoading && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                    <Card key={i} className="bg-white/5 border-white/10 backdrop-blur-md">
                      <CardHeader>
                        <Skeleton className="w-16 h-16 rounded-2xl bg-white/10" />
                        <Skeleton className="w-24 h-8 mt-4 bg-white/10" />
                        <Skeleton className="w-32 h-4 mt-2 bg-white/10" />
                      </CardHeader>
                      <CardContent>
                        <Skeleton className="w-full h-10 bg-white/10" />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {/* Error State */}
              {error && (
                <Alert className="bg-red-500/10 border-red-500/50">
                  <AlertCircle className="h-4 w-4 text-red-400" />
                  <AlertTitle className="text-red-200">Error al cargar cursos</AlertTitle>
                  <AlertDescription className="text-red-200">
                    No se pudieron cargar los cursos. Por favor, intenta de nuevo más tarde.
                  </AlertDescription>
                </Alert>
              )}

              {/* Empty State for Teachers */}
              {!isLoading && !error && cursoCards.length === 0 && user?.rol === 'profesor' && (
                <Alert className="bg-blue-500/10 border-blue-500/50">
                  <AlertCircle className="h-4 w-4 text-blue-400" />
                  <AlertTitle className="text-blue-200">No tienes cursos asignados</AlertTitle>
                  <AlertDescription className="text-blue-200">
                    Tu director de sección no te ha asignado cursos todavía. Por favor, contacta al administrador.
                  </AlertDescription>
                </Alert>
              )}

              {/* Grid de cursos */}
              {!isLoading && !error && cursoCards.length > 0 && (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {cursoCards.map((curso) => (
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
                            {curso.materias.join(', ')}
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
                  <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card className="bg-white/5 border-white/10 backdrop-blur-md">
                      <CardHeader>
                        <CardTitle className="text-white">Total de Grupos</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-4xl font-bold text-white">{cursoCards.length}</div>
                        <p className="text-sm text-white/60 mt-2">Grupos asignados</p>
                      </CardContent>
                    </Card>

                    <Card className="bg-white/5 border-white/10 backdrop-blur-md">
                      <CardHeader>
                        <CardTitle className="text-white">Total de Materias</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-4xl font-bold text-white">
                          {courses.length}
                        </div>
                        <p className="text-sm text-white/60 mt-2">Materias que dictas</p>
                      </CardContent>
                    </Card>
                  </div>
                </>
              )}
            </div>
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
