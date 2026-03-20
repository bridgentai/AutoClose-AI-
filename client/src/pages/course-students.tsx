import { useRoute, useLocation } from 'wouter';
import { Users } from 'lucide-react';
import { NavBackButton } from '@/components/nav-back-button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useQuery } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface Student {
  _id: string;
  nombre: string;
  email?: string;
  estado: 'excelente' | 'bueno' | 'regular' | 'bajo';
}

const fetchStudentsByGroup = async (groupId: string): Promise<Student[]> => {
  const grupoIdNormalizado = groupId.toUpperCase().trim();
  const response = await apiRequest('GET', `/api/groups/${grupoIdNormalizado}/students`);
  return Array.isArray(response) ? response : [];
};

function getEstadoColor(estado: string) {
  switch (estado) {
    case 'excelente': return 'bg-green-500/20 text-green-400 border-green-500/40';
    case 'bueno': return 'bg-blue-500/20 text-blue-400 border-blue-500/40';
    case 'regular': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40';
    case 'bajo': return 'bg-red-500/20 text-red-400 border-red-500/40';
    default: return 'bg-white/10 text-white/70 border-white/20';
  }
}

export default function CourseStudentsPage() {
  const [, params] = useRoute('/course-detail/:cursoId/estudiantes');
  const cursoId = params?.cursoId || '';
  const [, setLocation] = useLocation();
  const search = typeof window !== 'undefined' ? window.location.search : '';
  const searchParams = new URLSearchParams(search);
  const returnTo = searchParams.get('returnTo') || `/course-detail/${cursoId}`;
  const { toast } = useToast();
  const displayGroupId = cursoId && cursoId.length === 24 && /^[0-9a-fA-F]{24}$/.test(cursoId)
    ? cursoId
    : (cursoId || '').toUpperCase().trim();

  const { data: groupInfo } = useQuery<{ _id: string; id: string; nombre: string }>({
    queryKey: ['group', cursoId],
    queryFn: () => apiRequest('GET', `/api/groups/${encodeURIComponent(cursoId)}`),
    enabled: !!cursoId,
    staleTime: 5 * 60 * 1000,
  });
  const groupDisplayName = (groupInfo?.nombre?.trim() || displayGroupId) as string;

  const { data: students = [], isLoading } = useQuery<Student[]>({
    queryKey: ['students', cursoId],
    queryFn: () => fetchStudentsByGroup(cursoId),
    enabled: !!cursoId,
  });

  const handleSync = async () => {
    try {
      const response = await apiRequest('POST', `/api/groups/${displayGroupId}/sync-students`);
      toast({ title: 'Sincronización completada', description: response.message || 'Estudiantes actualizados.' });
      queryClient.invalidateQueries({ queryKey: ['students', cursoId] });
    } catch (error: any) {
      toast({ title: 'Error', description: error?.message || 'No se pudo sincronizar', variant: 'destructive' });
    }
  };

  return (
    <div className="p-6">
      <NavBackButton to={returnTo} label={`Grupo ${groupDisplayName}`} />
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white font-['Poppins'] mt-4 flex items-center gap-2">
          <Users className="w-7 h-7 text-[#00c8ff]" />
          Estudiantes del Grupo {groupDisplayName}
        </h1>
        <p className="text-white/60">Lista completa de estudiantes del curso</p>
      </div>
      <Card className="bg-white/5 border-white/10 backdrop-blur-md">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-white">Lista de estudiantes</CardTitle>
            <CardDescription className="text-white/60">
              {students.length} {students.length === 1 ? 'estudiante' : 'estudiantes'} registrados
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" className="border-white/20 text-white hover:bg-white/10" onClick={handleSync}>
            Sincronizar estudiantes
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-16 w-full bg-white/10" />
              <Skeleton className="h-16 w-full bg-white/10" />
              <Skeleton className="h-16 w-full bg-white/10" />
            </div>
          ) : students.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {students.map((student) => (
                <div
                  key={student._id}
                  className="p-4 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-all cursor-pointer"
                  onClick={() => setLocation(`/profesor/cursos/${cursoId}/estudiantes/${student._id}?returnTo=${encodeURIComponent(returnTo)}`)}
                >
                  <h4 className="font-semibold text-white truncate mb-2">{student.nombre}</h4>
                  {student.email && <p className="text-white/60 text-sm truncate mb-2">{student.email}</p>}
                  <Badge className={getEstadoColor(student.estado)}>
                    {student.estado.charAt(0).toUpperCase() + student.estado.slice(1)}
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Users className="w-16 h-16 text-[#1e3cff]/40 mx-auto mb-4" />
              <p className="text-white/60">No hay estudiantes registrados en este grupo</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
