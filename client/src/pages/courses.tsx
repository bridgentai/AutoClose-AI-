import { useAuth } from '@/lib/authContext';
import { AppSidebar } from '@/components/app-sidebar';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { GraduationCap, User, ArrowRight, AlertCircle, BookOpen, Users, Home, ClipboardList } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

// =========================================================
// 1. INTERFACES Y CONSTANTES
// =========================================================

interface Professor {
  _id: string;
  nombre: string;
  email: string;
}

interface Course {
  _id: string;
  nombre: string;
  descripcion?: string;
  profesorIds: Professor[];
  cursos: string[];
  colorAcento?: string;
  icono?: string;
}

interface GroupCard {
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

const fetchCoursesByRole = async (userRole: string | undefined): Promise<Course[]> => {
  if (!userRole) return [];

  let endpoint = '';

  switch (userRole) {
    case 'estudiante':
      endpoint = '/api/users/me/courses';
      break;
    case 'profesor':
      endpoint = '/api/courses/mine';
      break;
    case 'directivo':
      endpoint = '/api/courses/all';
      break;
    case 'padre':
      endpoint = '/api/users/me/children/courses';
      break;
    default:
      return [];
  }

  return apiRequest('GET', endpoint);
};

// =========================================================
// 2. COMPONENTE PRINCIPAL
// =========================================================

export default function CoursesPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const userRole = user?.rol;

  const { data: courses = [], isLoading, error } = useQuery<Course[]>({
    queryKey: ['courses', userRole],
    queryFn: () => fetchCoursesByRole(userRole),
    enabled: !!userRole,
  });

  // ------------------------------
  // Handlers
  // ------------------------------

  const handleCourseClick = (courseId: string, isGroup = false) => {
    if (isGroup) {
      setLocation(`/groups/${courseId}`);
    } else {
      setLocation(`/course-detail/${courseId}`);
    }
  };

  // ------------------------------
  // Vistas por rol
  // ------------------------------

  const renderProfessorView = () => {
    const grupoMap = new Map<string, string[]>();

    courses.forEach(course => {
      const uniqueGrupos = Array.from(new Set(course.cursos));
      uniqueGrupos.forEach(grupo => {
        if (!grupoMap.has(grupo)) grupoMap.set(grupo, []);
        grupoMap.get(grupo)!.push(course.nombre);
      });
    });

    const groupCards: GroupCard[] = Array.from(grupoMap.entries()).map(([grupo, materias], index) => ({
      id: grupo,
      nombre: grupo,
      materias,
      color: GRADIENT_COLORS[index % GRADIENT_COLORS.length],
    }));

    return (
      <>
        <h2 className="text-3xl font-bold text-white mb-2 font-['Poppins']">Gestión de Grupos</h2>
        <p className="text-white/60 mb-8">
          Selecciona un grupo que impartes para gestionar tareas y recursos.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {groupCards.map(group => (
            <Card
              key={group.id}
              className="bg-white/5 border-white/10 backdrop-blur-md hover-elevate cursor-pointer group"
              onClick={() => handleCourseClick(group.id, true)}
            >
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div
                    className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${group.color} flex items-center justify-center`}
                  >
                    <Users className="w-8 h-8 text-white" />
                  </div>
                  <ArrowRight className="w-5 h-5 text-white/40 group-hover:text-white/80 transition-colors" />
                </div>

                <CardTitle className="text-white text-2xl font-bold mt-4">
                  Grupo {group.nombre}
                </CardTitle>
                <CardDescription className="text-white/60">
                  {group.materias.length} Materia(s) asignada(s)
                </CardDescription>
              </CardHeader>

              <CardContent>
                <Button
                  variant="outline"
                  className="w-full border-white/10 text-white hover:bg-white/10"
                  onClick={e => {
                    e.stopPropagation();
                    handleCourseClick(group.id, true);
                  }}
                >
                  Gestionar Grupo
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </>
    );
  };

  const renderCourseListView = (isDirectivo = false) => {
    const title = isDirectivo ? 'Catálogo de Cursos (Directivo)' : 'Mis Materias Asignadas';
    const description = isDirectivo
      ? 'Lista de todos los cursos creados en el sistema.'
      : 'Explora tus materias, revisa tareas y mantente al día.';

    return (
      <>
        <h2 className="text-3xl font-bold text-white mb-2 font-['Poppins']">{title}</h2>
        <p className="text-white/60 mb-8">{description}</p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {courses.map((course, index) => {
            const primaryProfessor = course.profesorIds[0]?.nombre || 'No Asignado';
            const displayColor =
              course.colorAcento ||
              GRADIENT_COLORS[index % GRADIENT_COLORS.length]
                .split(' ')[0]
                .replace('from-', '');

            return (
              <Card
                key={course._id}
                className="bg-white/5 border-white/10 backdrop-blur-md hover-elevate cursor-pointer group"
                onClick={() => handleCourseClick(course._id)}
              >
                <CardHeader>
                  <div className="flex items-center justify-between mb-4">
                    <div
                      className="w-16 h-16 rounded-2xl flex items-center justify-center"
                      style={{ backgroundColor: displayColor }}
                    >
                      <BookOpen className="w-8 h-8 text-white" />
                    </div>
                    <ArrowRight className="w-5 h-5 text-white/40 group-hover:text-white/80 transition-colors" />
                  </div>

                  <CardTitle className="text-white text-2xl font-bold">{course.nombre}</CardTitle>
                  <CardDescription className="text-white/60 line-clamp-2">
                    {course.descripcion || 'Sin descripción.'}
                  </CardDescription>
                  <p className="text-sm text-white/40 mt-1">Profesor: {primaryProfessor}</p>
                </CardHeader>

                <CardContent>
                  <Button
                    variant="outline"
                    className="w-full border-white/10 text-white hover:bg-white/10"
                    onClick={e => {
                      e.stopPropagation();
                      handleCourseClick(course._id);
                    }}
                  >
                    {isDirectivo ? 'Gestionar Curso' : 'Ingresar'}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </>
    );
  };

  const renderParentView = () => {
    return (
      <>
        <h2 className="text-3xl font-bold text-white mb-2 font-['Poppins']">Materias de tus Hijos</h2>
        <p className="text-white/60 mb-8">
          Revisa las materias y el progreso de los estudiantes a tu cargo.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {courses.map((course, index) => {
            const primaryProfessor = course.profesorIds[0]?.nombre || 'No Asignado';
            const displayColor =
              course.colorAcento ||
              GRADIENT_COLORS[index % GRADIENT_COLORS.length]
                .split(' ')[0]
                .replace('from-', '');

            return (
              <Card
                key={course._id}
                className="bg-white/5 border-white/10 backdrop-blur-md hover-elevate cursor-pointer group"
                onClick={() => handleCourseClick(course._id)}
              >
                <CardHeader>
                  <div className="flex items-center justify-between mb-4">
                    <div
                      className="w-16 h-16 rounded-2xl flex items-center justify-center"
                      style={{ backgroundColor: displayColor }}
                    >
                      <ClipboardList className="w-8 h-8 text-white" />
                    </div>
                    <ArrowRight className="w-5 h-5 text-white/40 group-hover:text-white/80 transition-colors" />
                  </div>

                  <CardTitle className="text-white text-2xl font-bold">{course.nombre}</CardTitle>
                  <CardDescription className="text-white/60 line-clamp-2">
                    Materia en el grupo: {course.cursos.join(', ')}
                  </CardDescription>
                  <p className="text-sm text-white/40 mt-1">Profesor: {primaryProfessor}</p>
                </CardHeader>

                <CardContent>
                  <Button
                    variant="outline"
                    className="w-full border-white/10 text-white hover:bg-white/10"
                    onClick={e => {
                      e.stopPropagation();
                      handleCourseClick(course._id);
                    }}
                  >
                    Ver Progreso
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </>
    );
  };

  // =========================================================
  // 3. RENDER PRINCIPAL
  // =========================================================

  const viewToRender = () => {
    if (isLoading) {
      return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {[...Array(8)].map((_, i) => (
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
      );
    }

    if (error) {
      return (
        <Alert className="bg-red-500/10 border-red-500/50">
          <AlertCircle className="h-4 w-4 text-red-400" />
          <AlertTitle className="text-red-200">Error al cargar datos</AlertTitle>
          <AlertDescription className="text-red-200">
            Ocurrió un error al intentar cargar los datos de cursos.
          </AlertDescription>
        </Alert>
      );
    }

    if (courses.length === 0) {
      const emptyMessage =
        userRole === 'profesor'
          ? 'Tu director no te ha asignado cursos todavía.'
          : userRole === 'estudiante'
          ? 'No tienes materias inscritas.'
          : userRole === 'directivo'
          ? 'No hay cursos registrados en la plataforma.'
          : 'No se encontraron materias para tus hijos.';

      return (
        <Alert className="bg-blue-500/10 border-blue-500/50">
          <AlertCircle className="h-4 w-4 text-blue-400" />
          <AlertTitle className="text-blue-200">Sin Asignaciones</AlertTitle>
          <AlertDescription className="text-blue-200">
            {emptyMessage}
          </AlertDescription>
        </Alert>
      );
    }

    if (userRole === 'profesor') return renderProfessorView();
    if (userRole === 'estudiante') return renderCourseListView();
    if (userRole === 'directivo') return renderCourseListView(true);
    if (userRole === 'padre') return renderParentView();

    return <p className="text-white/60">Tu rol no tiene una vista definida para esta sección.</p>;
  };

  // =========================================================
  // RETURN FINAL — CORREGIDO
  // =========================================================

  return (
    <SidebarProvider>
      <div className="flex h-screen w-full bg-gradient-to-br from-[#0a0a0c] via-[#1a001c] to-[#3d0045]">
        <AppSidebar />

        <SidebarInset className="flex flex-col flex-1">
          <header className="flex items-center justify-between p-4 border-b border-white/10 backdrop-blur-xl bg-black/20">
            <div className="flex items-center gap-3">
              <SidebarTrigger data-testid="button-sidebar-toggle" className="text-white" />
              <h1 className="text-xl font-bold text-white font-['Poppins']">
                {userRole === 'profesor' ? 'Mis Grupos' : 'Mis Cursos'}
              </h1>
            </div>

            <Button
              onClick={() => setLocation('/account')}
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/10"
              data-testid="button-account"
            >
              <User className="h-5 w-5" />
            </Button>
          </header>

          <main className="flex-1 overflow-y-auto p-6 md:p-10">{viewToRender()}</main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
