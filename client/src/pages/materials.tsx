import { useAuth } from '@/lib/authContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText, Link as LinkIcon, Video, Download, GraduationCap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLocation } from 'wouter';
import { NavBackButton } from '@/components/nav-back-button';

export default function Materials() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  const materials = [
    { id: 1, titulo: 'Guía de Estudio - Cálculo Diferencial', tipo: 'pdf', curso: 'Matemáticas', fecha: '2025-01-10' },
    { id: 2, titulo: 'Video Tutorial: Ecuaciones Diferenciales', tipo: 'video', curso: 'Matemáticas', fecha: '2025-01-09' },
    { id: 3, titulo: 'Presentación: Leyes de Newton', tipo: 'documento', curso: 'Física', fecha: '2025-01-08' },
    { id: 4, titulo: 'Enlace: Simulador de Física', tipo: 'enlace', curso: 'Física', fecha: '2025-01-07' },
    { id: 5, titulo: 'Tabla Periódica Interactiva', tipo: 'enlace', curso: 'Química', fecha: '2025-01-06' },
    { id: 6, titulo: 'Ejercicios Resueltos - Química Orgánica', tipo: 'pdf', curso: 'Química', fecha: '2025-01-05' },
  ];

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
            <NavBackButton to={user?.rol === 'profesor' ? '/profesor/academia' : '/dashboard'} label={user?.rol === 'profesor' ? 'Academia' : 'Dashboard'} />
            <h1 className="text-4xl font-bold text-white mb-2 font-['Poppins'] mt-4">
              Materiales Educativos
            </h1>
            <p className="text-white/60">
              {user?.rol === 'profesor' 
                ? 'Gestiona y comparte recursos con tus estudiantes' 
                : 'Accede a todos tus materiales de estudio'}
            </p>
          </div>

          <div className="mb-6 flex gap-4">
            {user?.rol === 'profesor' && (
              <button className="px-6 py-3 bg-gradient-to-r from-[#002366] to-[#1e3cff] hover:opacity-90 text-white rounded-xl font-medium transition-opacity">
                + Subir Nuevo Material
              </button>
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
          </div>

          <div className="grid grid-cols-1 gap-4">
            {materials.map((material) => (
              <Card key={material.id} className="backdrop-blur-md hover-elevate transition-all cursor-pointer bg-white/5 border-white/10">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-4 flex-1">
                      <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white bg-gradient-to-br from-[#002366] to-[#1e3cff]">
                        {getIcon(material.tipo)}
                      </div>
                      
                      <div className="flex-1">
                        <h3 className="text-white font-medium mb-1">{material.titulo}</h3>
                        <div className="flex items-center gap-4 text-sm text-white/60 flex-wrap">
                          <span>{material.curso}</span>
                          <span>•</span>
                          <span>{new Date(material.fecha).toLocaleDateString('es-CO')}</span>
                          <span>•</span>
                          <span className="capitalize">{material.tipo}</span>
                        </div>
                      </div>
                    </div>

                    <button className="p-2 rounded-lg transition-colors hover:bg-white/5 text-white/70 hover:text-white">
                      <Download className="w-5 h-5" />
                    </button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
    </div>
  );
}
