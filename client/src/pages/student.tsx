import { useAuth } from '@/lib/authContext';
import { AppSidebar } from '@/components/app-sidebar';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { BookOpen, GraduationCap, MessageSquare, User } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useLocation } from 'wouter';
import { Calendar } from '@/components/Calendar';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient'; // <--- Importación de la función de API

// 1. Definir la interfaz de Curso que ahora incluye los datos poblados
interface Course {
  _id: string;
  nombre: string;
  colorAcento?: string;
  icono?: string;
  profesorIds: { nombre: string; email: string; }[]; // Los datos del profesor poblados
  // Otros campos necesarios...
}

interface Assignment {
  _id: string;
  titulo: string;
  descripcion: string;
  curso: string;
  fechaEntrega: string;
  profesorNombre: string;
}

// Función de fetching para las materias del estudiante
const fetchStudentCourses = async () => {
    // Llama a la nueva ruta del Backend que devuelve los cursos poblados
    return apiRequest('GET', '/api/users/me/courses'); 
};


export default function StudentPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  // Query para OBTENER MIS CURSOS ASIGNADOS (NUEVA LÓGICA)
  const { data: courses = [], isLoading: isLoadingCourses } = useQuery<Course[]>({
    queryKey: ['studentCourses', user?.id], // La clave depende del ID del usuario
    queryFn: fetchStudentCourses,
    enabled: !!user?.id,
  });

  // 2. Lógica de Tareas (Adaptada para usar todos los cursos)
  // Nota: La query de tareas DEBE ser modificada para no depender de user?.curso (singular)
  // La mantendremos igual por ahora, pero sabes que debe actualizarse en el futuro.
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  const { data: assignments = [] } = useQuery<Assignment[]>({
    // Este endpoint '/api/assignments/curso' probablemente necesite ser actualizado
    queryKey: ['/api/assignments/curso', user?.curso, currentMonth, currentYear],
    enabled: !!user?.curso,
  });

  const handleDayClick = (assignment: any) => {
    setLocation(`/assignment/${assignment._id}`);
  };

  const numCursos = courses.length; // 3. Obtener el número real de cursos

  return (
    <SidebarProvider>
      <div className="flex h-screen w-full bg-gradient-to-br from-[#0a0a0c] via-[#1a001c] to-[#3d0045]">
        <AppSidebar />
        <SidebarInset className="flex flex-col flex-1">
          <header className="flex items-center justify-between p-4 border-b border-white/10 backdrop-blur-xl bg-black/20">
            {/* ... Encabezado (sin cambios) ... */}
            <div className="flex items-center gap-3">
              <SidebarTrigger data-testid="button-sidebar-toggle" className="text-white" />
              <h1 className="text-xl font-bold text-white font-['Poppins']">
                Portal Estudiante
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
              {/* ... Bienvenida ... */}
              <div className="mb-8">
                <h2 className="text-3xl font-bold text-white mb-2 font-['Poppins']">
                  Bienvenido, {user?.nombre?.split(' ')[0] || 'Estudiante'} 👋
                </h2>
                <p className="text-white/60">
                  {new Date().toLocaleDateString('es-CO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </p>
              </div>

              {/* Quick Stats */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                {/* CARD DE MIS CURSOS (ACTUALIZADA) */}
                <Card className="bg-white/5 border-white/10 backdrop-blur-md hover-elevate">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-white">
                      <BookOpen className="w-5 h-5 text-[#9f25b8]" />
                      Mis Cursos
                    </CardTitle>
                    <CardDescription className="text-white/60">Cursos activos</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {isLoadingCourses ? (
                      <div className="text-3xl font-bold text-white">...</div>
                    ) : (
                      <div className="text-3xl font-bold text-white">{numCursos}</div> // <--- VALOR REAL
                    )}
                    <p className="text-sm text-white/50 mt-1">Este semestre</p>
                  </CardContent>
                </Card>

                {/* ... Otras tarjetas de stats (Materiales, Chat AI) ... */}
                <Card className="bg-white/5 border-white/10 backdrop-blur-md hover-elevate">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-white">
                      <GraduationCap className="w-5 h-5 text-[#9f25b8]" />
                      Materiales
                    </CardTitle>
                    <CardDescription className="text-white/60">Recursos disponibles</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-white">24</div>
                    <p className="text-sm text-white/50 mt-1">Documentos y guías</p>
                  </CardContent>
                </Card>

                <Card className="bg-white/5 border-white/10 backdrop-blur-md hover-elevate">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-white">
                      <MessageSquare className="w-5 h-5 text-[#9f25b8]" />
                      Chat AI
                    </CardTitle>
                    <CardDescription className="text-white/60">Consultas realizadas</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-white">12</div>
                    <p className="text-sm text-white/50 mt-1">Esta semana</p>
                  </CardContent>
                </Card>
              </div>

              {/* Quick Access */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="bg-white/5 border-white/10 backdrop-blur-md">
                  {/* ... Botones de Acceso Rápido (sin cambios) ... */}
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
                      onClick={() => setLocation('/courses')} // Redirige a la vista de las tarjetas de cursos
                      variant="outline"
                      className="w-full justify-start border-white/10 text-white hover:bg-white/10"
                      data-testid="button-courses"
                    >
                      <BookOpen className="w-4 h-4 mr-2" />
                      Ver Mis Cursos
                    </Button>
                    <Button
                      onClick={() => setLocation('/materials')}
                      variant="outline"
                      className="w-full justify-start border-white/10 text-white hover:bg-white/10"
                      data-testid="button-materials"
                    >
                      <GraduationCap className="w-4 h-4 mr-2" />
                      Materiales de Estudio
                    </Button>
                  </CardContent>
                </Card>

                <Card className="bg-white/5 border-white/10 backdrop-blur-md">
                  {/* ... Calendario de Tareas (sin cambios, pero con la limitación mencionada) ... */}
                  <CardHeader>
                    <CardTitle className="text-white">Calendario de Tareas</CardTitle>
                    <CardDescription className="text-white/60">
                      {/* Mostrar la cantidad de cursos en lugar del curso singular */}
                      {isLoadingCourses ? 'Cargando cursos...' : `Tareas de ${numCursos} cursos activos.`}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Calendar assignments={assignments} onDayClick={handleDayClick} />
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
