import { useAuth } from '@/lib/authContext';
import { useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useMemo, useEffect } from 'react';
import { NavBackButton } from '@/components/nav-back-button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileText, Link as LinkIcon, Video, Download, GraduationCap } from 'lucide-react';

interface MaterialItem {
  _id: string;
  titulo: string;
  tipo: string;
  url: string;
  descripcion?: string;
  createdAt: string;
}

export default function Materials() {
  const { user } = useAuth();
  const [location, setLocation] = useLocation();
  const urlParams =
    typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const cursoIdFromUrl = urlParams.get('cursoId') || undefined;
  const isParentMaterials = location.startsWith('/parent/materiales');

  useEffect(() => {
    if (isParentMaterials && user && user.rol !== 'padre') {
      setLocation('/dashboard');
    }
  }, [isParentMaterials, user, setLocation]);

  const { data: hijosMat = [] } = useQuery<{ _id: string; nombre: string; curso?: string }[]>({
    queryKey: ['/api/users/me/hijos'],
    queryFn: () => apiRequest('GET', '/api/users/me/hijos'),
    enabled: !!user?.id && user?.rol === 'padre' && isParentMaterials,
  });
  const nombreHijoMat = hijosMat[0]?.nombre;

  const cursoIdFilter = useMemo(() => {
    if (isParentMaterials && user?.rol === 'padre') {
      const c = hijosMat[0]?.curso?.trim();
      return c || undefined;
    }
    return cursoIdFromUrl;
  }, [isParentMaterials, user?.rol, hijosMat, cursoIdFromUrl]);

  const { data: materials = [], isLoading } = useQuery<MaterialItem[]>({
    queryKey: ['materials', cursoIdFilter],
    queryFn: () =>
      apiRequest(
        'GET',
        cursoIdFilter ? `/api/materials?cursoId=${encodeURIComponent(cursoIdFilter)}` : '/api/materials',
      ),
  });

  const getIcon = (tipo: string) => {
    switch (tipo) {
      case 'pdf':
      case 'documento':
        return <FileText className="w-5 h-5" />;
      case 'video':
        return <Video className="w-5 h-5" />;
      case 'enlace':
        return <LinkIcon className="w-5 h-5" />;
      default:
        return <FileText className="w-5 h-5" />;
    }
  };

  return (
    <div className="flex-1 overflow-auto p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <NavBackButton
            to={
              user?.rol === 'profesor'
                ? '/profesor/academia'
                : isParentMaterials
                  ? '/parent/aprendizaje'
                  : '/dashboard'
            }
            label={
              user?.rol === 'profesor'
                ? 'Academia'
                : isParentMaterials
                  ? 'Aprendizaje del hijo/a'
                  : 'Dashboard'
            }
          />
          <h1 className="text-4xl font-bold text-white mb-2 font-['Poppins'] mt-4">Materiales Educativos</h1>
          <p className="text-white/60">
            {user?.rol === 'profesor'
              ? 'Gestiona y comparte recursos con tus estudiantes'
              : isParentMaterials && user?.rol === 'padre'
                ? `Recursos del curso de ${nombreHijoMat ?? 'tu hijo/a'} (solo visualización; mismo criterio que materiales por curso del colegio).`
                : 'Accede a todos tus materiales de estudio'}
          </p>
        </div>

        <div className="mb-6 flex gap-4">
          {user?.rol === 'profesor' && (
            <Button className="bg-gradient-to-r from-[#002366] to-[#1e3cff] hover:opacity-90 text-white rounded-xl font-medium">
              + Subir Nuevo Material
            </Button>
          )}
          {user?.rol === 'estudiante' && (
            <Button
              variant="outline"
              className="border-[#1e3cff]/40 text-[#1e3cff] hover:bg-[#1e3cff]/10"
              onClick={() => setLocation('/mi-aprendizaje/notas')}
            >
              <GraduationCap className="w-4 h-4 mr-2" />
              Ver mis Notas
            </Button>
          )}
          {isParentMaterials && user?.rol === 'padre' && (
            <Button
              variant="outline"
              className="border-[#1e3cff]/40 text-[#1e3cff] hover:bg-[#1e3cff]/10"
              onClick={() => setLocation('/parent/notas')}
            >
              <GraduationCap className="w-4 h-4 mr-2" />
              Ver notas del hijo/a
            </Button>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4">
          {isLoading ? (
            <p className="text-white/60">Cargando materiales...</p>
          ) : materials.length === 0 ? (
            <Card className="bg-white/5 border-white/10">
              <CardContent className="p-8 text-center text-white/60">
                No hay materiales.{' '}
                {user?.rol === 'profesor' && 'Sube un material para compartir con tus estudiantes.'}
              </CardContent>
            </Card>
          ) : (
            materials.map((material) => (
              <Card
                key={material._id}
                className="backdrop-blur-md hover-elevate transition-all bg-white/5 border-white/10"
              >
                <CardContent className="p-5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-4 flex-1">
                      <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white bg-gradient-to-br from-[#002366] to-[#1e3cff]">
                        {getIcon(material.tipo)}
                      </div>
                      <div className="flex-1">
                        <h3 className="text-white font-medium mb-1">{material.titulo}</h3>
                        <div className="flex items-center gap-4 text-sm text-white/60 flex-wrap">
                          <span>{new Date(material.createdAt).toLocaleDateString('es-CO')}</span>
                          <span>•</span>
                          <span className="capitalize">{material.tipo}</span>
                        </div>
                        {material.descripcion && (
                          <p className="text-sm text-white/50 mt-1">{material.descripcion}</p>
                        )}
                      </div>
                    </div>
                    {material.url && (
                      <a
                        href={material.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 rounded-lg hover:bg-white/5 text-white/70 hover:text-white"
                      >
                        <Download className="w-5 h-5" />
                      </a>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

