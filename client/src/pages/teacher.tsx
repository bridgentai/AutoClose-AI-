import { useAuth } from '@/lib/authContext';
import { BookOpen, GraduationCap, MessageSquare, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useLocation } from 'wouter';
import { Calendar, type CalendarAssignment } from '@/components/Calendar';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

interface Assignment {
  _id: string;
  titulo: string;
  descripcion: string;
  curso?: string;
  materiaNombre?: string;
  courseId?: string;
  fechaEntrega: string;
  profesorNombre: string;
}

export default function TeacherPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  const { data: assignments = [], isLoading: loadingAssignments } = useQuery<Assignment[]>({
    queryKey: ['/api/assignments', 'profesor', user?.id],
    queryFn: () => apiRequest<Assignment[]>('GET', '/api/assignments'),
    enabled: !!user?.id && user?.rol === 'profesor',
  });

  const calendarAssignments: CalendarAssignment[] = assignments.map((a) => ({
    ...a,
    curso: a.curso ?? '',
  }));

  const handleDayClick = (assignment: CalendarAssignment) => {
    setLocation(`/assignment/${assignment._id}`);
  };

  return (
    <div data-testid="teacher-page">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-white mb-2 font-['Poppins']">
          Bienvenido, Profesor {user?.nombre?.split(' ')[0] || ''}
        </h2>
        <p className="text-white/60">
          {new Date().toLocaleDateString('es-CO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card className="bg-white/5 border-white/10 backdrop-blur-md hover-elevate">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <BookOpen className="w-5 h-5 text-[#1e3cff]" />
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
              <GraduationCap className="w-5 h-5 text-[#1e3cff]" />
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
              <MessageSquare className="w-5 h-5 text-[#1e3cff]" />
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
              <TrendingUp className="w-5 h-5 text-[#1e3cff]" />
              Engagement
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white">85%</div>
            <p className="text-sm text-white/50 mt-1">Promedio</p>
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
            <CardTitle className="text-white">Calendario de Tareas</CardTitle>
            <CardDescription className="text-white/60">
              {loadingAssignments
                ? 'Cargando…'
                : `${assignments.length} tarea${assignments.length !== 1 ? 's' : ''} en total (todos tus cursos). Clic en un día o en una tarea para abrirla.`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Calendar assignments={calendarAssignments} onDayClick={handleDayClick} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
