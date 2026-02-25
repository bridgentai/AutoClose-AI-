import { useState, useMemo } from 'react';
import { useRoute, useLocation } from 'wouter';
import { useAuth } from '@/lib/authContext';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { NavBackButton } from '@/components/nav-back-button';
import { useCourseGrading } from '@/hooks/useCourseGrading';
import { ForecastGraph } from '@/components/grading/ForecastGraph';
import { StabilityGauge } from '@/components/grading/StabilityGauge';
import { RiskIndicator } from '@/components/grading/RiskIndicator';
import { InsightsBlock } from '@/components/grading/InsightsBlock';
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
}

const allowedRoles = ['profesor', 'directivo', 'admin-general-colegio', 'padre'];

export default function CourseAnalyticsPage() {
  const [, params] = useRoute('/course/:cursoId/analytics');
  const cursoId = params?.cursoId ?? '';
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');

  const displayGroupId =
    cursoId && cursoId.length === 24 && /^[0-9a-fA-F]{24}$/.test(cursoId)
      ? cursoId
      : (cursoId || '').toUpperCase().trim();

  const { data: subjectsForGroup = [] } = useQuery<CourseSubject[]>({
    queryKey: ['subjectsForGroup', cursoId],
    queryFn: () => apiRequest('GET', `/api/courses/for-group/${cursoId}`),
    enabled: !!cursoId && !!user?.id,
  });

  const { data: students = [] } = useQuery<Student[]>({
    queryKey: ['students', cursoId],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/groups/${displayGroupId}/students`);
      return Array.isArray(res) ? res : [];
    },
    enabled: !!displayGroupId && !!user?.id,
  });

  const firstSubjectId = subjectsForGroup[0]?._id;
  const subjectName = subjectsForGroup[0]?.nombre ?? '';
  const effectiveStudentId = selectedStudentId || (students[0]?._id ?? '');

  const {
    categories,
    snapshot,
    forecast,
    risk,
    insights,
    isLoading: gradingLoading,
  } = useCourseGrading(firstSubjectId, effectiveStudentId || undefined);

  const categoryImpactBreakdown = useMemo(() => {
    if (!snapshot?.categoryImpacts || !categories.length) return [];
    return categories.map((cat) => ({
      name: cat.nombre,
      impact: snapshot.categoryImpacts[cat._id] ?? 0,
      weight: cat.weight,
    }));
  }, [snapshot, categories]);

  const canAccess = user?.rol && allowedRoles.includes(user.rol);
  if (user && !canAccess) {
    setLocation('/dashboard');
    return null;
  }

  return (
    <div className="min-h-screen bg-[#0a0a2a] text-white p-4 md:p-6">
      <div className="max-w-5xl mx-auto">
        <div className="mb-6">
          <NavBackButton
            to={`/course-detail/${cursoId}`}
            label="Volver al curso"
          />
        </div>

        <Card className="bg-white/5 border-white/10 backdrop-blur-md rounded-2xl mb-6">
          <CardHeader>
            <CardTitle className="text-white font-['Poppins']">
              Vista analítica · Inteligencia académica
            </CardTitle>
            <p className="text-white/70 text-sm">
              Grupo {displayGroupId}
              {subjectName && ` · ${subjectName}`}
            </p>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-center gap-4">
              <label className="text-white/80 text-sm font-medium">
                Estudiante
              </label>
              <Select value={effectiveStudentId} onValueChange={setSelectedStudentId}>
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
            <p className="text-white/70">No hay materias para este grupo.</p>
          </Card>
        ) : gradingLoading ? (
          <div className="grid gap-4 md:grid-cols-2">
            <Skeleton className="h-48 bg-white/10 rounded-2xl" />
            <Skeleton className="h-48 bg-white/10 rounded-2xl" />
          </div>
        ) : (
          <>
            <div className="grid gap-6 md:grid-cols-2 mb-6">
              <Card className="bg-white/5 border-white/10 backdrop-blur-md rounded-2xl overflow-hidden">
                <CardHeader>
                  <CardTitle className="text-white/90 text-sm font-medium">
                    Promedio ponderado
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-4xl font-bold text-white tabular-nums">
                    {snapshot?.weightedFinalAverage != null
                      ? snapshot.weightedFinalAverage.toFixed(1)
                      : '—'}
                  </p>
                  <p className="text-white/50 text-sm mt-1">/ 100</p>
                </CardContent>
              </Card>
              <ForecastGraph
                forecast={forecast ?? null}
                snapshotAverage={snapshot?.weightedFinalAverage}
              />
            </div>

            {categoryImpactBreakdown.length > 0 && (
              <Card className="bg-white/5 border-white/10 backdrop-blur-md rounded-2xl mb-6">
                <CardHeader>
                  <CardTitle className="text-white text-base font-['Poppins']">
                    Impacto por categoría
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {categoryImpactBreakdown.map((item) => (
                    <div key={item.name} className="flex items-center gap-4">
                      <span className="text-white/80 text-sm w-32 truncate">
                        {item.name}
                      </span>
                      <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-[#002366] to-[#1e3cff] rounded-full"
                          style={{
                            width: `${Math.min(100, (item.impact / (snapshot?.weightedFinalAverage || 1)) * 100)}%`,
                          }}
                        />
                      </div>
                      <span className="text-white/80 text-sm tabular-nums w-12 text-right">
                        {item.impact.toFixed(1)} pts
                      </span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              <StabilityGauge
                value={risk?.academicStabilityIndex}
                label="Estabilidad académica"
              />
              <RiskIndicator risk={risk ?? null} />
            </div>

            <div className="mt-6">
              <InsightsBlock insights={insights} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
