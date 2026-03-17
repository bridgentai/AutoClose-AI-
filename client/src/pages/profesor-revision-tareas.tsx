import { useAuth } from '@/lib/authContext';
import { GraduationCap, ArrowRight, AlertCircle, Users, ClipboardList, Star } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Breadcrumb } from '@/components/Breadcrumb';

// Función para obtener el nombre del grupo desde el grupoId
const getGroupDisplayName = (groupId: string): string => {
  // El backend ahora siempre devuelve el nombre del grupo, no ObjectIds
  // Solo normalizamos a mayúsculas para consistencia
  return groupId.toUpperCase().trim();
};

interface Course {
  _id: string;
  nombre: string;
  cursos: string[];
}

interface ProfessorGroupAssignment {
  groupId: string;
  subjects: Course[];
  totalStudents: number;
}

const GRADIENT_COLORS = [
  'from-[#002366] to-[#003d7a]',
  'from-blue-500 to-cyan-500',
  'from-green-500 to-emerald-500',
  'from-yellow-500 to-orange-500',
  'from-red-500 to-rose-500',
  'from-[#003d7a] to-[#1e3cff]',
  'from-teal-500 to-cyan-500',
  'from-amber-500 to-yellow-500',
  'from-[#002366] to-[#1e3cff]',
  'from-[#003d7a] to-[#1e3cff]',
];

const fetchProfessorGroups = async (): Promise<ProfessorGroupAssignment[]> => {
  return apiRequest('GET', '/api/professor/my-groups');
};

export default function ProfesorRevisionTareasPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  const { data: professorGroups = [], isLoading: isLoadingGroups, error: errorGroups } = useQuery<ProfessorGroupAssignment[]>({
    queryKey: ['professorGroups'],
    queryFn: fetchProfessorGroups,
    enabled: user?.rol === 'profesor',
  });

  const handleCourseClick = (groupId: string) => {
    // Al hacer clic en un curso, lleva al módulo de tareas de ese curso
    setLocation(`/profesor/cursos/${groupId}/tareas`);
  };

  if (isLoadingGroups) {
    return (
      <div className="flex-1 overflow-auto p-6 md:p-10">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mt-8">
            {[...Array(4)].map((_, i) => (
              <Card key={i} className="bg-white/5 border-white/10 backdrop-blur-md">
                <CardHeader className="p-4 md:p-6">
                  <Skeleton className="w-16 h-16 rounded-2xl bg-white/10" />
                  <Skeleton className="w-24 h-8 mt-4 bg-white/10" />
                  <Skeleton className="w-32 h-4 mt-2 bg-white/10" />
                </CardHeader>
                <CardContent className="p-4 pt-0 md:p-6 md:pt-0">
                  <Skeleton className="w-full h-10 bg-white/10" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (errorGroups) {
    return (
      <div className="flex-1 overflow-auto p-6 md:p-10">
        <div className="max-w-7xl mx-auto">
          <Alert className="bg-red-500/10 border-red-500/50 mt-8">
            <AlertCircle className="h-4 w-4 text-red-400" />
            <AlertTitle className="text-red-200">Error al cargar datos</AlertTitle>
            <AlertDescription className="text-red-200">
              Ocurrió un error al intentar cargar los grupos asignados.
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  if (professorGroups.length === 0) {
    return (
      <div className="flex-1 overflow-auto p-6 md:p-10">
        <div className="max-w-7xl mx-auto">
          <Alert className="bg-blue-500/10 border-blue-500/50 mt-8">
            <AlertCircle className="h-4 w-4 text-blue-400" />
            <AlertTitle className="text-blue-200">Sin Grupos Asignados</AlertTitle>
            <AlertDescription className="text-blue-200">
              Aún no tienes grupos asignados. El administrador del colegio te asignará a cursos desde su panel.
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto p-6 md:p-10">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <Breadcrumb
            items={[
              { label: 'Dashboard', href: '/dashboard' },
              { label: 'Cursos', href: '/profesor/academia/cursos' },
              { label: 'Tareas', href: '/profesor/academia/tareas' },
              { label: 'Revisión' },
            ]}
          />
          <h2 className="text-3xl font-bold text-white mb-2 font-['Poppins'] mt-4">
            Panel de Cursos - Revisión de Asignaciones
          </h2>
          <p className="text-white/60">
            Selecciona un curso para acceder al módulo de tareas y gestionar las tareas asignadas.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {professorGroups.map((group, index) => {
            const colorClass = GRADIENT_COLORS[index % GRADIENT_COLORS.length];
            const subjectNames = group.subjects.map(s => s.nombre);
            const groupDisplayName = getGroupDisplayName(group.groupId);

            return (
              <Card
                key={group.groupId}
                className={`bg-white/5 border-white/10 backdrop-blur-md hover-elevate cursor-pointer group`}
                onClick={() => handleCourseClick(group.groupId)}
              >
                <CardHeader className="p-4 md:p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div
                      className={`w-16 h-16 rounded-2xl flex items-center justify-center bg-gradient-to-r ${colorClass}`}
                    >
                      <Users className="w-8 h-8 text-white" />
                    </div>
                    <ArrowRight className="w-5 h-5 text-white/40 group-hover:text-white/80 transition-colors" />
                  </div>

                  <CardTitle className="text-white text-3xl font-bold">{groupDisplayName}</CardTitle>
                  <CardDescription className="text-white/60 line-clamp-2 mt-1">
                    Materias: {subjectNames.join(', ') || 'Sin materias asignadas'}
                  </CardDescription>
                  <p className="text-sm text-white/40 mt-1">Estudiantes: {group.totalStudents}</p>
                </CardHeader>

                <CardContent className="p-4 pt-0 md:p-6 md:pt-0 space-y-2">
                  <Button
                    variant="outline"
                    className="w-full border-[#1e3cff]/40 text-[#1e3cff] hover:bg-[#1e3cff]/10"
                    onClick={e => {
                      e.stopPropagation();
                      handleCourseClick(group.groupId);
                    }}
                  >
                    <ClipboardList className="w-4 h-4 mr-2" />
                    Ver Asignaciones del Curso
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full border-green-500/40 text-green-400 hover:bg-green-500/10"
                    onClick={e => {
                      e.stopPropagation();
                      setLocation(`/profesor/academia/tareas/calificacion/${group.groupId}`);
                    }}
                  >
                    <GraduationCap className="w-4 h-4 mr-2" />
                    Panel de Calificación
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}

