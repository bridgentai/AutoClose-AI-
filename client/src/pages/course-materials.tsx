import { useRoute, useLocation } from 'wouter';
import { FileText } from 'lucide-react';
import { NavBackButton } from '@/components/nav-back-button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

interface Material {
  _id: string;
  titulo: string;
  tipo: string;
  url: string;
  descripcion?: string;
  createdAt: string;
}

const fetchSubjectsForGroup = async (groupId: string): Promise<{ _id: string; nombre: string }[]> => {
  return apiRequest('GET', `/api/courses/for-group/${groupId}`);
};

const fetchMaterials = async (cursoId: string): Promise<Material[]> => {
  const subjects = await fetchSubjectsForGroup(cursoId);
  if (!subjects?.length) return [];
  const subjectIds = subjects.map((s) => s._id);
  const all: Material[] = [];
  for (const materiaId of subjectIds) {
    const list = await apiRequest<Material[]>('GET', `/api/materials?materiaId=${encodeURIComponent(materiaId)}`);
    if (Array.isArray(list)) all.push(...list);
  }
  return all;
};

export default function CourseMaterialsPage() {
  const [, params] = useRoute('/course-detail/:cursoId/materiales');
  const cursoId = params?.cursoId || '';
  const [, setLocation] = useLocation();
  const displayGroupId = cursoId && cursoId.length === 24 && /^[0-9a-fA-F]{24}$/.test(cursoId)
    ? cursoId
    : (cursoId || '').toUpperCase().trim();

  const { data: materials = [], isLoading } = useQuery<Material[]>({
    queryKey: ['materials', cursoId],
    queryFn: () => fetchMaterials(cursoId),
    enabled: !!cursoId,
  });

  return (
    <div className="p-6">
      <NavBackButton to={`/course-detail/${cursoId}`} label={`Grupo ${displayGroupId}`} />
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white font-['Poppins'] mt-4 flex items-center gap-2">
          <FileText className="w-7 h-7 text-[#00c8ff]" />
          Materiales del Grupo {displayGroupId}
        </h1>
        <p className="text-white/60">Materiales vinculados a este curso</p>
      </div>
      <Card className="bg-white/5 border-white/10 backdrop-blur-md">
        <CardHeader>
          <CardTitle className="text-white">Materiales</CardTitle>
          <CardDescription className="text-white/60">
            {materials.length} {materials.length === 1 ? 'material' : 'materiales'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-14 w-full bg-white/10" />
              <Skeleton className="h-14 w-full bg-white/10" />
              <Skeleton className="h-14 w-full bg-white/10" />
            </div>
          ) : materials.length > 0 ? (
            <ul className="space-y-3">
              {materials.map((m) => (
                <li
                  key={m._id}
                  className="p-4 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
                >
                  <div className="font-medium text-white">{m.titulo}</div>
                  {m.descripcion && <p className="text-white/60 text-sm mt-1">{m.descripcion}</p>}
                  {m.url && (
                    <a href={m.url} target="_blank" rel="noopener noreferrer" className="text-[#00c8ff] text-sm mt-2 inline-block hover:underline">
                      Abrir enlace
                    </a>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-center py-12">
              <FileText className="w-16 h-16 text-[#1e3cff]/40 mx-auto mb-4" />
              <p className="text-white/60">No hay materiales para este curso</p>
              <p className="text-white/40 text-sm mt-2">Crea materiales desde el módulo Materiales o al crear una tarea</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
