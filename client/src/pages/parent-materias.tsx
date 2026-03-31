import { useAuth } from '@/lib/authContext';
import { useLocation } from 'wouter';
import { ArrowRight, BookOpen, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { NavBackButton } from '@/components/nav-back-button';
import { generateCourseColor } from '@/lib/courseColor';

interface Professor {
  _id: string;
  nombre: string;
  email: string;
}

interface Course {
  _id: string;
  nombre: string;
  descripcion?: string;
  profesorIds?: Professor[];
  cursos?: string[];
  colorAcento?: string;
  icono?: string;
}

export default function ParentMateriasPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  const { data: hijos = [] } = useQuery<{ _id: string; nombre: string; curso: string }[]>({
    queryKey: ['/api/users/me/hijos'],
    queryFn: () => apiRequest('GET', '/api/users/me/hijos'),
    enabled: !!user?.id,
  });
  const primerHijoId = hijos[0]?._id;
  const nombreHijo = hijos[0]?.nombre || 'tu hijo/a';

  const {
    data: courses = [],
    isLoading,
    error,
    refetch,
  } = useQuery<Course[]>({
    queryKey: ['courses', 'padre', primerHijoId, 'materias-page'],
    queryFn: () => apiRequest<Course[]>('GET', `/api/student/hijo/${primerHijoId}/courses`),
    enabled: !!primerHijoId,
    staleTime: 0,
  });

  const handleCourseClick = (id: string) => {
    setLocation(`/course-detail/${id}`);
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-10">
      <div className="max-w-7xl mx-auto">
        <NavBackButton to="/parent/aprendizaje" label="Aprendizaje del hijo/a" />
        <h1 className="text-3xl font-bold text-white mt-4 mb-2 font-['Poppins']">
          Materias de {nombreHijo}
        </h1>
        <p className="text-white/60 mb-8 max-w-3xl leading-relaxed">
          Misma vista que «Mis materias» del estudiante. Solo lectura: revisa tareas y materiales desde el detalle.
        </p>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[...Array(4)].map((_, i) => (
              <Card key={i} className="bg-white/5 border border-white/10 backdrop-blur-md rounded-2xl overflow-hidden">
                <CardHeader className="p-6 pb-2">
                  <Skeleton className="w-14 h-14 rounded-2xl bg-white/10" />
                  <Skeleton className="w-3/4 h-8 mt-4 bg-white/10" />
                  <Skeleton className="w-full h-4 mt-3 bg-white/10" />
                  <Skeleton className="w-2/3 h-4 mt-2 bg-white/10" />
                </CardHeader>
                <CardContent className="p-6 pt-2">
                  <Skeleton className="w-full h-10 rounded-xl bg-white/10" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : error ? (
          <div className="space-y-4">
            <Alert className="bg-red-500/10 border-red-500/50">
              <AlertCircle className="h-4 w-4 text-red-400" />
              <AlertTitle className="text-red-200">Error al cargar materias</AlertTitle>
              <AlertDescription className="text-red-200">Intenta de nuevo en unos segundos.</AlertDescription>
            </Alert>
            <Button
              variant="outline"
              className="border-white/20 text-white hover:bg-white/10"
              onClick={() => refetch()}
            >
              Reintentar
            </Button>
          </div>
        ) : courses.length === 0 ? (
          <Alert className="bg-blue-500/10 border-blue-500/50 max-w-2xl">
            <AlertCircle className="h-4 w-4 text-blue-400" />
            <AlertTitle className="text-blue-200">
              {primerHijoId ? 'Sin materias' : 'Sin estudiante vinculado'}
            </AlertTitle>
            <AlertDescription className="text-blue-200">
              {primerHijoId
                ? 'Aún no hay materias asignadas al curso de tu hijo/a.'
                : 'Vincula un estudiante en Mi perfil para ver sus materias.'}
            </AlertDescription>
          </Alert>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {courses.map((course) => {
              const primaryProfessor = course.profesorIds?.[0]?.nombre || 'No asignado';
              const displayColor = course.colorAcento || generateCourseColor(course._id);
              const showEmoji = course.icono && course.icono.trim().length > 0;
              return (
                <Card
                  key={course._id}
                  className="relative flex flex-col min-h-[220px] bg-white/5 border border-white/10 backdrop-blur-md cursor-pointer group transition-all duration-300 hover:scale-[1.02] hover:bg-white/[0.07] overflow-hidden rounded-2xl"
                  style={{
                    boxShadow: '0 0 0 0px transparent',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.boxShadow = `0 8px 32px -4px ${displayColor}40, 0 0 0 1px ${displayColor}30`;
                    e.currentTarget.style.borderColor = `${displayColor}50`;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.boxShadow = '0 0 0 0px transparent';
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                  }}
                  onClick={() => handleCourseClick(course._id)}
                >
                  <div
                    className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                    style={{
                      background: `radial-gradient(circle at 50% 0%, ${displayColor}08 0%, transparent 70%)`,
                    }}
                  />
                  <CardHeader className="relative flex-1 flex flex-col p-6 pb-2">
                    <div className="flex items-center justify-between mb-4 min-h-[56px]">
                      <div
                        className="relative w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 transition-all duration-300 group-hover:scale-105"
                        style={{
                          backgroundColor: `${displayColor}20`,
                          borderColor: displayColor,
                          borderWidth: '2px',
                          boxShadow: `0 0 16px ${displayColor}30`,
                        }}
                      >
                        {showEmoji ? (
                          <span className="text-2xl leading-none" aria-hidden>
                            {course.icono!.trim()}
                          </span>
                        ) : (
                          <BookOpen className="w-7 h-7" style={{ color: displayColor }} />
                        )}
                      </div>
                      <ArrowRight className="w-5 h-5 text-white/40 group-hover:text-white/90 group-hover:translate-x-1 transition-all duration-300 flex-shrink-0" />
                    </div>
                    <CardTitle className="text-white text-2xl font-bold mb-2 font-['Poppins'] truncate">
                      {course.nombre}
                    </CardTitle>
                    <p className="text-sm text-white/50 mt-2 truncate">
                      <span className="text-white/60">Profesor:</span> {primaryProfessor}
                    </p>
                  </CardHeader>
                  <CardContent className="relative p-6 pt-2 flex flex-col gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full rounded-xl border-white/15 text-[#E2E8F0] hover:bg-white/10 hover:border-white/25"
                      onClick={(e) => {
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
        )}
      </div>
    </div>
  );
}
