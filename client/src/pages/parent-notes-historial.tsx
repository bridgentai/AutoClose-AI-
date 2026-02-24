import { useEffect } from 'react';
import { useAuth } from '@/lib/authContext';
import { useLocation } from 'wouter';
import { ArrowLeft, BookOpen } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

interface NotaItem {
  _id: string;
  tareaTitulo: string;
  nota: number;
  fecha: string;
  profesorNombre?: string;
  comentario?: string;
}

interface MateriaItem {
  _id: string;
  nombre: string;
  promedio: number;
  ultimaNota: number;
  estado: string;
  notas: NotaItem[];
  colorAcento?: string;
}

export default function ParentNotesHistorialPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  const { data: hijos = [] } = useQuery<{ _id: string; nombre: string }[]>({
    queryKey: ['/api/users/me/hijos'],
    queryFn: () => apiRequest('GET', '/api/users/me/hijos'),
    enabled: !!user?.id && user?.rol === 'padre',
  });
  const primerHijoId = hijos[0]?._id;
  const nombreHijo = hijos[0]?.nombre || 'tu hijo/a';

  const { data: notesData, isLoading } = useQuery<{ materias: MateriaItem[]; total: number }>({
    queryKey: ['/api/student/hijo', primerHijoId, 'notes'],
    queryFn: () => apiRequest('GET', `/api/student/hijo/${primerHijoId}/notes`),
    enabled: !!primerHijoId,
  });

  const materias = notesData?.materias ?? [];

  useEffect(() => {
    if (user && user.rol !== 'padre') {
      setLocation('/dashboard');
    }
  }, [user, setLocation]);

  if (user && user.rol !== 'padre') {
    return null;
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-10">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <Button
            variant="ghost"
            onClick={() => setLocation('/mi-aprendizaje/notas')}
            className="text-white/70 hover:text-white mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver a Notas de {nombreHijo}
          </Button>
          <h1 className="text-4xl font-bold text-white mb-2 font-['Poppins']">
            Historial de notas de {nombreHijo}
          </h1>
          <p className="text-white/60">Solo visualización. Todas las calificaciones por materia.</p>
        </div>

        {isLoading ? (
          <p className="text-white/60">Cargando historial...</p>
        ) : materias.length === 0 ? (
          <Card className="bg-white/5 border-white/10 backdrop-blur-md">
            <CardContent className="py-12 text-center">
              <BookOpen className="w-16 h-16 text-white/30 mx-auto mb-4" />
              <p className="text-white/60">No hay notas registradas para {nombreHijo}.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {materias.map((materia) => (
              <Card key={materia._id} className="bg-white/5 border-white/10 backdrop-blur-md">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <CardTitle className="text-white flex items-center gap-2">
                      <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center"
                        style={{ backgroundColor: materia.colorAcento || '#1e3cff' }}
                      >
                        <BookOpen className="w-5 h-5 text-white" />
                      </div>
                      {materia.nombre}
                    </CardTitle>
                    <span className="text-white/60">
                      Promedio: <span className="text-white font-semibold">{Math.round(materia.promedio)}</span>/100
                    </span>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {materia.notas.length === 0 ? (
                      <p className="text-white/50 text-sm">Sin calificaciones aún.</p>
                    ) : (
                      materia.notas.map((nota) => (
                        <div
                          key={nota._id}
                          className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/10"
                        >
                          <div>
                            <p className="font-medium text-white">{nota.tareaTitulo}</p>
                            <p className="text-sm text-white/60">
                              {new Date(nota.fecha).toLocaleDateString('es-CO', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric',
                              })}
                              {nota.profesorNombre && ` · ${nota.profesorNombre}`}
                            </p>
                            {nota.comentario && (
                              <p className="text-sm text-white/70 mt-1">{nota.comentario}</p>
                            )}
                          </div>
                          <span className="text-xl font-bold text-white">{Math.round(nota.nota)}/100</span>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
