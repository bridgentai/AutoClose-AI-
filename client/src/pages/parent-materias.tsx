import { useAuth } from '@/lib/authContext';
import { useLocation } from 'wouter';
import { BookOpen, ChevronRight } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { NavBackButton } from '@/components/nav-back-button';

interface MateriaItem {
  _id: string;
  nombre: string;
  promedio: number;
  ultimaNota: number;
  estado?: string;
  colorAcento?: string;
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

  const { data: notesData, isLoading } = useQuery<{ materias: MateriaItem[]; total: number }>({
    queryKey: ['/api/student/hijo', primerHijoId, 'notes'],
    queryFn: () => apiRequest('GET', `/api/student/hijo/${primerHijoId}/notes`),
    enabled: !!primerHijoId,
  });

  const materias = notesData?.materias ?? [];

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-10">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <NavBackButton to="/dashboard" label="Dashboard" />
          <h1 className="text-3xl font-bold text-white mt-4 mb-2 font-['Poppins']">
            Materias de {nombreHijo}
          </h1>
          <p className="text-white/60">
            Solo visualización. Haz clic en una materia para ver el detalle.
          </p>
        </div>

        {isLoading ? (
          <p className="text-white/60">Cargando materias...</p>
        ) : materias.length === 0 ? (
          <Card className="bg-white/5 border-white/10 backdrop-blur-md">
            <CardContent className="py-12 text-center">
              <BookOpen className="w-16 h-16 text-white/30 mx-auto mb-4" />
              <p className="text-white/60">No hay notas cargadas aún para {nombreHijo}.</p>
              <p className="text-white/40 text-sm mt-2">Las materias aparecerán cuando tenga calificaciones.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {materias.map((materia) => (
              <Card
                key={materia._id}
                className="bg-white/5 border-white/10 backdrop-blur-md hover:bg-white/10 transition-colors cursor-pointer"
                onClick={() => setLocation(`/course-detail/${materia._id}`)}
              >
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: materia.colorAcento || '#1e3cff' }}
                    >
                      <BookOpen className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <p className="font-semibold text-white">{materia.nombre}</p>
                      <p className="text-sm text-white/60">
                        Promedio: {Math.round(materia.promedio)}/100 · Última nota: {Math.round(materia.ultimaNota)}/100
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-white/50 flex-shrink-0" />
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
