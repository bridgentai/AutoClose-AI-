import { useMemo, useState } from 'react';
import { useRoute, useLocation } from 'wouter';
import { useAuth } from '@/lib/authContext';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { NavBackButton } from '@/components/nav-back-button';
import { CategoryOverviewGrid } from '@/components/grading/CategoryOverviewGrid';
import { PerformanceSidebar } from '@/components/grading/PerformanceSidebar';
import { useCourseGrading } from '@/hooks/useCourseGrading';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';

interface CourseSubject {
  _id: string;
  nombre: string;
}

interface Student {
  _id: string;
  nombre: string;
  email?: string;
}

interface Assignment {
  _id: string;
  titulo: string;
  fechaEntrega: string;
  maxScore?: number;
  courseId?: string;
  submissions?: { estudianteId: string; calificacion?: number }[];
  categoryId?: string;
  logroCalificacionId?: string;
}

export default function CourseGradesInputPage() {
  const [, params] = useRoute('/course/:cursoId/grades/input');
  const cursoId = params?.cursoId ?? '';
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');

  const displayGroupId =
    cursoId && cursoId.length === 24 && /^[0-9a-fA-F]{24}$/.test(cursoId)
      ? cursoId
      : (cursoId || '').toUpperCase().trim();

  const { data: groupInfo } = useQuery<{ _id: string; id: string; nombre: string }>({
    queryKey: ['group', cursoId],
    queryFn: () => apiRequest('GET', `/api/groups/${encodeURIComponent(cursoId)}`),
    enabled: !!cursoId,
    staleTime: 5 * 60 * 1000,
  });
  const groupDisplayName = (groupInfo?.nombre?.trim() || displayGroupId) as string;

  const { data: subjectsForGroup = [] } = useQuery<CourseSubject[]>({
    queryKey: ['subjectsForGroup', cursoId],
    queryFn: () => apiRequest('GET', `/api/courses/for-group/${cursoId}`),
    enabled: !!cursoId && user?.rol === 'profesor',
  });

  const { data: students = [] } = useQuery<Student[]>({
    queryKey: ['students', cursoId],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/groups/${displayGroupId}/students`);
      return Array.isArray(res) ? res : [];
    },
    enabled: !!displayGroupId && user?.rol === 'profesor',
  });

  const firstSubjectId = subjectsForGroup[0]?._id;
  const subjectName = subjectsForGroup[0]?.nombre ?? '';

  const { data: assignments = [] } = useQuery<Assignment[]>({
    queryKey: ['gradeTableAssignments', cursoId, firstSubjectId],
    queryFn: () =>
      apiRequest(
        'GET',
        `/api/assignments?groupId=${encodeURIComponent(displayGroupId)}&courseId=${firstSubjectId || ''}`
      ),
    enabled: !!displayGroupId && !!firstSubjectId && user?.rol === 'profesor',
  });

  const {
    categories,
    snapshot,
    forecast,
    risk,
    insights,
    isLoading: gradingLoading,
    refetch,
  } = useCourseGrading(firstSubjectId, selectedStudentId || undefined);

  const assignmentsByCategoryId = useMemo(() => {
    const map: Record<string, Assignment[]> = {};
    for (const cat of categories) {
      map[cat._id] = [];
    }
    for (const a of assignments) {
      const cid = a.categoryId ?? a.logroCalificacionId;
      const key = cid ? String(cid) : '';
      if (key && map[key]) {
        map[key].push(a);
      } else if (key) {
        if (!map[key]) map[key] = [];
        map[key].push(a);
      }
    }
    return map;
  }, [assignments, categories]);

  const effectiveStudentId = selectedStudentId || (students[0]?._id ?? '');

  if (user?.rol !== 'profesor') {
    setLocation('/courses');
    return null;
  }

  return (
    <div className="min-h-screen bg-[#0a0a2a] text-white p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <NavBackButton
            to={`/course-detail/${cursoId}`}
            label="Volver al curso"
          />
        </div>

        <Card className="bg-white/5 border-white/10 backdrop-blur-md rounded-2xl mb-6">
          <CardHeader>
            <CardTitle className="text-white font-['Poppins']">
              Entrada de calificaciones
            </CardTitle>
            <p className="text-white/70 text-sm">
              Grupo {groupDisplayName}
              {subjectName && ` · ${subjectName}`}
            </p>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-center gap-4">
              <label className="text-white/80 text-sm font-medium">
                Estudiante
              </label>
              <Select
                value={effectiveStudentId}
                onValueChange={setSelectedStudentId}
              >
                <SelectTrigger className="w-64 bg-white/10 border-white/20 text-white">
                  <SelectValue placeholder="Selecciona un estudiante" />
                </SelectTrigger>
                <SelectContent>
                  {students.map((s) => (
                    <SelectItem key={s._id} value={s._id}>
                      {s.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {!firstSubjectId ? (
          <Card className="bg-white/5 border-white/10 rounded-2xl p-6">
            <p className="text-white/70">
              No hay materias asignadas a este grupo. Asigna una materia primero.
            </p>
          </Card>
        ) : categories.length === 0 ? (
          <Card className="bg-white/5 border-white/10 rounded-2xl p-6">
            <p className="text-white/70 mb-4">
              Configura el esquema de calificación (categorías con pesos que sumen 100%) para usar la vista por categorías.
            </p>
            <button
              type="button"
              className="text-[#00c8ff] hover:underline"
              onClick={() => setLocation('/profesor/academia/calificacion/logros')}
            >
              Ir a Logros de calificación
            </button>
          </Card>
        ) : (
          <div className="flex flex-col lg:flex-row gap-6">
            <div className="flex-1 min-w-0">
              {gradingLoading ? (
                <Skeleton className="h-64 w-full bg-white/10 rounded-2xl" />
              ) : (
                <CategoryOverviewGrid
                  categories={categories}
                  snapshot={snapshot ?? null}
                  risk={risk ?? null}
                  assignmentsByCategoryId={assignmentsByCategoryId}
                  studentId={effectiveStudentId}
                  courseId={firstSubjectId}
                  onGradeSubmit={refetch}
                />
              )}
            </div>
            <div className="flex-shrink-0">
              <PerformanceSidebar
                snapshot={snapshot ?? null}
                forecast={forecast ?? null}
                risk={risk ?? null}
                insights={insights}
                isLoading={gradingLoading}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
