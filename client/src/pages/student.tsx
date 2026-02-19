import { useAuth } from '@/lib/authContext';
import { BookOpen, GraduationCap, MessageSquare } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useLocation } from 'wouter';
import { Calendar } from '@/components/Calendar';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

interface Course {
  _id: string;
  nombre: string;
  colorAcento?: string;
  icono?: string;
  profesorIds: { nombre: string; email: string; }[];
}

interface Assignment {
  _id: string;
  titulo: string;
  descripcion: string;
  curso: string;
  fechaEntrega: string;
  profesorNombre: string;
}

const fetchStudentCourses = async () => {
  return apiRequest('GET', '/api/users/me/courses'); 
};

export default function StudentPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  const { data: courses = [], isLoading: isLoadingCourses } = useQuery<Course[]>({
    queryKey: ['studentCourses', user?.id],
    queryFn: fetchStudentCourses,
    enabled: !!user?.id,
  });

  // Query para obtener tareas del estudiante basado en su grupo (igual que el calendario oficial)
  const { data: assignments = [], isLoading: isLoadingAssignments } = useQuery<Assignment[]>({
    queryKey: ['studentAssignments', user?.curso],
    queryFn: () => apiRequest('GET', '/api/assignments/student'),
    enabled: !!user?.id && !!user?.curso,
    staleTime: 0,
  });

  const handleDayClick = (assignment: any) => {
    setLocation(`/assignment/${assignment._id}`);
  };

  const numCursos = courses.length;

  return (
    <div data-testid="student-page">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-white mb-2 font-['Poppins']">
          Bienvenido, {user?.nombre?.split(' ')[0] || 'Estudiante'}
        </h2>
        <p className="text-white/60">
          {new Date().toLocaleDateString('es-CO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        <Card className="bg-white/5 border-white/10 backdrop-blur-md hover-elevate">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <BookOpen className="w-5 h-5 text-[#1e3cff]" />
              Mis Cursos
            </CardTitle>
            <CardDescription className="text-white/60">Cursos activos</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingCourses ? (
              <div className="text-3xl font-bold text-white">...</div>
            ) : (
              <div className="text-3xl font-bold text-white">{numCursos}</div>
            )}
            <p className="text-sm text-white/50 mt-1">Este semestre</p>
          </CardContent>
        </Card>

        <Card className="bg-white/5 border-white/10 backdrop-blur-md hover-elevate">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <GraduationCap className="w-5 h-5 text-[#1e3cff]" />
              Materiales
            </CardTitle>
            <CardDescription className="text-white/60">Recursos disponibles</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white">24</div>
            <p className="text-sm text-white/50 mt-1">Documentos y guias</p>
          </CardContent>
        </Card>

        <Card className="bg-white/5 border-white/10 backdrop-blur-md hover-elevate">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <MessageSquare className="w-5 h-5 text-[#1e3cff]" />
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-white/5 border-white/10 backdrop-blur-md">
          <CardHeader>
            <CardTitle className="text-white">Acceso Rapido</CardTitle>
            <CardDescription className="text-white/60">Herramientas principales</CardDescription>
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
              onClick={() => setLocation('/courses')}
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
          <CardHeader>
            <CardTitle className="text-white">Calendario de Tareas</CardTitle>
            <CardDescription className="text-white/60">
              {isLoadingAssignments 
                ? 'Cargando tareas...' 
                : `${assignments.length} ${assignments.length === 1 ? 'tarea asignada' : 'tareas asignadas'} este mes`
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingAssignments ? (
              <div className="flex items-center justify-center py-12">
                <p className="text-white/60">Cargando calendario...</p>
              </div>
            ) : (
              <Calendar assignments={assignments} onDayClick={handleDayClick} />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
