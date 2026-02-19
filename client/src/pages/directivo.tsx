import { useAuth } from '@/lib/authContext';
import { Users, AlertCircle, ChevronDown, BookOpen, BarChart3 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useState } from 'react';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

interface Profesor {
  _id: string;
  nombre: string;
  email: string;
  materias: string[];
  createdAt: string;
}

interface Course {
  _id: string;
  nombre: string;
  profesorId: string;
  cursos: string[];
  colegioId: string;
}

interface CursoResumen {
  _id: string;
  nombre: string;
  cursos: string[];
  cantidadEstudiantes: number;
  asistenciaMesPorcentaje: number;
  promedioNotas: number | null;
}

const GRUPOS_DISPONIBLES = [
  '6A', '6B', '6C',
  '7A', '7B', '7C',
  '8A', '8B', '8C',
  '9A', '9B', '9C',
  '10A', '10B', '10C',
  '11A', '11B', '11C',
];

export default function DirectivoPage() {
  const { user } = useAuth();
  const [openProfesorId, setOpenProfesorId] = useState<string | null>(null);

  const { data: profesores = [], isLoading: loadingProfesores, error: errorProfesores } = useQuery<Profesor[]>({
    queryKey: ['/api/users/by-role', 'profesor'],
    queryFn: () => apiRequest<Profesor[]>('GET', '/api/users/by-role?rol=profesor'),
  });

  const { data: allCourses = [], isLoading: loadingCourses } = useQuery<Course[]>({
    queryKey: ['/api/courses'],
    queryFn: () => apiRequest<Course[]>('GET', '/api/courses'),
  });

  const { data: resumenCursos, isLoading: loadingResumen } = useQuery<{ cursos: CursoResumen[] }>({
    queryKey: ['/api/reports/cursos/resumen'],
    queryFn: () => apiRequest<{ cursos: CursoResumen[] }>('GET', '/api/reports/cursos/resumen'),
  });

  const { data: stats } = useQuery<{ estudiantes: number; profesores: number; padres: number; directivos: number; cursos: number; materias: number }>({
    queryKey: ['adminStats', user?.colegioId],
    queryFn: () => apiRequest('GET', '/api/users/stats'),
  });

  const getCurrentAssignments = (profesorId: string, materia: string): string[] => {
    const course = allCourses.find(
      (c: Course) => (c as any).profesorId === profesorId && c.nombre === materia
    );
    return course?.cursos || [];
  };

  return (
    <div data-testid="directivo-page">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-white mb-2 font-['Poppins']">
          Vista Directivo (solo lectura)
        </h2>
        <p className="text-white/60">
          Listas de profesores, cursos y resumen por curso. Sin opciones de edición.
        </p>
      </div>

      {/* KPIs - solo lectura */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        <Card className="bg-white/5 border-white/10 backdrop-blur-md">
          <CardContent className="pt-4">
            <p className="text-white/60 text-xs uppercase">Estudiantes</p>
            <p className="text-2xl font-bold text-white font-['Poppins']">{stats?.estudiantes ?? '-'}</p>
          </CardContent>
        </Card>
        <Card className="bg-white/5 border-white/10 backdrop-blur-md">
          <CardContent className="pt-4">
            <p className="text-white/60 text-xs uppercase">Profesores</p>
            <p className="text-2xl font-bold text-white font-['Poppins']">{stats?.profesores ?? '-'}</p>
          </CardContent>
        </Card>
        <Card className="bg-white/5 border-white/10 backdrop-blur-md">
          <CardContent className="pt-4">
            <p className="text-white/60 text-xs uppercase">Padres</p>
            <p className="text-2xl font-bold text-white font-['Poppins']">{stats?.padres ?? '-'}</p>
          </CardContent>
        </Card>
        <Card className="bg-white/5 border-white/10 backdrop-blur-md">
          <CardContent className="pt-4">
            <p className="text-white/60 text-xs uppercase">Cursos</p>
            <p className="text-2xl font-bold text-white font-['Poppins']">{stats?.cursos ?? '-'}</p>
          </CardContent>
        </Card>
        <Card className="bg-white/5 border-white/10 backdrop-blur-md">
          <CardContent className="pt-4">
            <p className="text-white/60 text-xs uppercase">Materias</p>
            <p className="text-2xl font-bold text-white font-['Poppins']">{stats?.materias ?? '-'}</p>
          </CardContent>
        </Card>
      </div>

      {/* Resumen por curso - solo lectura */}
      <Card className="bg-white/5 border-white/10 backdrop-blur-md mb-8">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-[#00c8ff]" />
            Resumen por curso
          </CardTitle>
          <CardDescription className="text-white/60">
            Estudiantes, asistencia del mes y promedio de notas por materia
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingResumen ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full bg-white/10" />
              ))}
            </div>
          ) : resumenCursos?.cursos?.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead>
                  <tr className="border-b border-white/10 text-white/80">
                    <th className="py-2 pr-4">Materia / Curso</th>
                    <th className="py-2 pr-4">Estudiantes</th>
                    <th className="py-2 pr-4">Asistencia mes %</th>
                    <th className="py-2">Promedio notas</th>
                  </tr>
                </thead>
                <tbody className="text-white/90">
                  {resumenCursos.cursos.map((c) => (
                    <tr key={c._id} className="border-b border-white/5">
                      <td className="py-2 pr-4 font-medium">{c.nombre}</td>
                      <td className="py-2 pr-4">{c.cantidadEstudiantes}</td>
                      <td className="py-2 pr-4">{c.asistenciaMesPorcentaje}%</td>
                      <td className="py-2">{c.promedioNotas != null ? c.promedioNotas.toFixed(1) : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-white/50 py-4">No hay datos de cursos aún.</p>
          )}
        </CardContent>
      </Card>

      {(loadingProfesores || loadingCourses) && (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="bg-white/5 border-white/10 backdrop-blur-md">
              <CardHeader>
                <Skeleton className="w-48 h-6 bg-white/10" />
                <Skeleton className="w-64 h-4 mt-2 bg-white/10" />
              </CardHeader>
            </Card>
          ))}
        </div>
      )}

      {errorProfesores && (
        <Alert className="bg-red-500/10 border-red-500/50">
          <AlertCircle className="h-4 w-4 text-red-400" />
          <AlertTitle className="text-red-200">Error al cargar profesores</AlertTitle>
          <AlertDescription className="text-red-200">
            No se pudieron cargar los profesores. Por favor, intenta de nuevo mas tarde.
          </AlertDescription>
        </Alert>
      )}

      {!loadingProfesores && !errorProfesores && profesores.length === 0 && (
        <Alert className="bg-blue-500/10 border-blue-500/50">
          <Users className="h-4 w-4 text-blue-400" />
          <AlertTitle className="text-blue-200">No hay profesores registrados</AlertTitle>
          <AlertDescription className="text-blue-200">
            Aun no hay profesores registrados en tu institucion.
          </AlertDescription>
        </Alert>
      )}

      {!loadingProfesores && !loadingCourses && profesores.length > 0 && (
        <div className="space-y-4">
          {profesores.map((profesor) => (
            <ProfesorCard
              key={profesor._id}
              profesor={profesor}
              isOpen={openProfesorId === profesor._id}
              onToggle={() => setOpenProfesorId(openProfesorId === profesor._id ? null : profesor._id)}
              getCurrentAssignments={getCurrentAssignments}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface ProfesorCardProps {
  profesor: Profesor;
  isOpen: boolean;
  onToggle: () => void;
  getCurrentAssignments: (profesorId: string, materia: string) => string[];
}

function ProfesorCard({ profesor, isOpen, onToggle, getCurrentAssignments }: ProfesorCardProps) {
  return (
    <Collapsible open={isOpen} onOpenChange={onToggle}>
      <Card className="bg-white/5 border-white/10 backdrop-blur-md">
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover-elevate">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <CardTitle className="text-white text-xl font-bold flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  {profesor.nombre}
                </CardTitle>
                <CardDescription className="text-white/60">
                  {profesor.email}
                </CardDescription>
                <div className="flex flex-wrap gap-2 mt-3">
                  {profesor.materias?.map((materia: string) => (
                    <Badge
                      key={materia}
                      variant="secondary"
                      className="bg-[#00c8ff]/20 text-white border border-[#00c8ff]/40"
                      data-testid={`badge-materia-${materia}`}
                    >
                      {materia}
                    </Badge>
                  ))}
                </div>
              </div>
              <ChevronDown
                className={`w-5 h-5 text-white/60 transition-transform ${isOpen ? 'rotate-180' : ''}`}
              />
            </div>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="pt-4">
            <p className="text-white/60 text-sm mb-3">Grupos asignados por materia (solo lectura):</p>
            <div className="space-y-2">
              {(profesor.materias || []).map((materia: string) => {
                const grupos = getCurrentAssignments(profesor._id, materia);
                return (
                  <div key={materia} className="flex flex-wrap items-center gap-2">
                    <span className="text-white font-medium w-28">{materia}</span>
                    {grupos.length ? (
                      grupos.map((g: string) => (
                        <Badge key={g} variant="outline" className="border-white/20 text-white/90">
                          {g}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-white/50 text-sm">Sin grupos asignados</span>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
