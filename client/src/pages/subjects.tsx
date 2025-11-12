import { useAuth } from '@/lib/authContext';
import { AppSidebar } from '@/components/app-sidebar';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { BookOpen, User, ArrowRight, Calendar } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';

interface Subject {
  _id: string;
  nombre: string;
  descripcion?: string;
  colorAcento: string;
  icono?: string;
  profesor: {
    _id: string;
    nombre: string;
    email: string;
  };
  createdAt: Date;
}

export default function SubjectsPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  const { data: subjects = [], isLoading } = useQuery<Subject[]>({
    queryKey: ['/api/subjects/mine'],
    enabled: !!user && user.rol === 'estudiante',
  });

  const handleSubjectClick = (subjectId: string) => {
    setLocation(`/subject/${subjectId}`);
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
                Mis Materias
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
                  Materias de {user?.curso}
                </h2>
                <p className="text-white/60">
                  Explora tus materias, revisa tareas y mantente al día
                </p>
              </div>

              {isLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {[1, 2, 3, 4, 5, 6].map((i) => (
                    <div key={i} className="bg-white/5 border border-white/10 rounded-xl h-48 animate-pulse" />
                  ))}
                </div>
              ) : subjects.length === 0 ? (
                <Card className="bg-white/5 border-white/10 backdrop-blur-md">
                  <CardContent className="p-12 text-center">
                    <BookOpen className="w-16 h-16 text-white/40 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold text-white mb-2">No hay materias asignadas</h3>
                    <p className="text-white/60">
                      Aún no tienes materias asignadas a tu curso
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <>
                  {/* Grid de materias */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {subjects.map((subject) => (
                      <Card 
                        key={subject._id}
                        className="bg-white/5 border-white/10 backdrop-blur-md hover-elevate cursor-pointer group"
                        onClick={() => handleSubjectClick(subject._id)}
                        data-testid={`card-subject-${subject._id}`}
                      >
                        <CardHeader>
                          <div className="flex items-center justify-between mb-4">
                            <div 
                              className="w-16 h-16 rounded-2xl flex items-center justify-center"
                              style={{ 
                                background: `linear-gradient(135deg, ${subject.colorAcento || '#9f25b8'}, ${subject.colorAcento ? subject.colorAcento + '80' : '#6a0dad'})` 
                              }}
                            >
                              <BookOpen className="w-8 h-8 text-white" />
                            </div>
                            <ArrowRight className="w-5 h-5 text-white/40 group-hover:text-white/80 transition-colors" />
                          </div>
                          <CardTitle className="text-white text-2xl font-bold">
                            {subject.nombre}
                          </CardTitle>
                          {subject.descripcion && (
                            <CardDescription className="text-white/60 line-clamp-2">
                              {subject.descripcion}
                            </CardDescription>
                          )}
                        </CardHeader>
                        <CardContent>
                          <div className="flex items-center gap-2 text-sm text-white/60 mb-4">
                            <User className="w-4 h-4" />
                            <span>{subject.profesor.nombre}</span>
                          </div>
                          <Button
                            variant="outline"
                            className="w-full border-white/10 text-white hover:bg-white/10"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSubjectClick(subject._id);
                            }}
                            data-testid={`button-open-${subject._id}`}
                          >
                            Ver Materia
                          </Button>
                        </CardContent>
                      </Card>
                    ))}
                  </div>

                  {/* Acceso rápido al calendario */}
                  <Card className="bg-white/5 border-white/10 backdrop-blur-md mt-8">
                    <CardHeader>
                      <CardTitle className="text-white flex items-center gap-2">
                        <Calendar className="w-5 h-5 text-[#9f25b8]" />
                        Calendario de Tareas
                      </CardTitle>
                      <CardDescription className="text-white/60">
                        Visualiza todas tus tareas en el calendario
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Button
                        onClick={() => setLocation('/calendar')}
                        className="bg-gradient-to-r from-[#9f25b8] to-[#6a0dad] hover:opacity-90"
                        data-testid="button-calendar"
                      >
                        <Calendar className="w-4 h-4 mr-2" />
                        Ir al Calendario
                      </Button>
                    </CardContent>
                  </Card>
                </>
              )}
            </div>
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
