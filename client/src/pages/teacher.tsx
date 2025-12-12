import { useAuth } from '@/lib/authContext';
import { BookOpen, GraduationCap, MessageSquare, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useLocation } from 'wouter';
import { Calendar } from '@/components/Calendar';
import { useQuery } from '@tanstack/react-query';

interface Assignment {
  _id: string;
  titulo: string;
  descripcion: string;
  curso: string;
  fechaEntrega: string;
  profesorNombre: string;
}

export default function TeacherPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  const { data: assignments = [] } = useQuery<Assignment[]>({
    queryKey: ['/api/assignments/profesor', user?.id, currentMonth, currentYear],
    enabled: !!user?.id,
  });

  const handleDayClick = (assignment: Assignment) => {
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-white/5 border-white/10 backdrop-blur-md">
          <CardHeader>
            <CardTitle className="text-white">Acceso Rapido</CardTitle>
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
            <CardTitle className="text-white">Calendario de Tareas</CardTitle>
            <CardDescription className="text-white/60">
              Tus tareas asignadas este mes
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Calendar assignments={assignments} onDayClick={handleDayClick} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
