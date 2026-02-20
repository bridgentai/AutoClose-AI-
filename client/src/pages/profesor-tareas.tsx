import { useAuth } from '@/lib/authContext';
import { useLocation } from 'wouter';
import { useEffect } from 'react';
import { FilePlus, ClipboardCheck } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { NavBackButton } from '@/components/nav-back-button';

export default function ProfesorTareasPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (user && user.rol !== 'profesor') {
      setLocation('/dashboard');
    }
  }, [user, setLocation]);

  if (!user || user.rol !== 'profesor') {
    return null;
  }

  return (
    <div className="flex-1 overflow-auto p-6 md:p-10">
      <div className="max-w-5xl mx-auto">
        <div className="mb-8">
          <NavBackButton />
          <h1 className="text-3xl font-bold text-white mb-2 font-['Poppins'] mt-4">
            Gestión de Asignaciones
          </h1>
          <p className="text-white/60">
            Crea asignaciones y revisa las existentes en tus cursos
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Carta de Asignación */}
          <Card 
            className="bg-white/5 border-white/10 backdrop-blur-md hover-elevate cursor-pointer group transition-all"
            onClick={() => setLocation('/profesor/academia/tareas/asignar')}
          >
            <CardHeader className="p-6">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center bg-gradient-to-r from-[#002366] to-[#1e3cff] mb-4 group-hover:scale-110 transition-transform">
                <FilePlus className="w-8 h-8 text-white" />
              </div>
              <CardTitle className="text-white text-2xl font-bold mb-2">
                Asignación
              </CardTitle>
              <CardDescription className="text-white/60">
                Crea y asigna nuevas asignaciones a tus cursos. Aparecerán en el calendario de profesores y estudiantes.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6 pt-0">
              <Button
                className="w-full bg-gradient-to-r from-[#002366] to-[#1e3cff] hover:opacity-90"
                onClick={(e) => {
                  e.stopPropagation();
                  setLocation('/profesor/academia/tareas/asignar');
                }}
              >
                Crear Nueva Tarea
              </Button>
            </CardContent>
          </Card>

          {/* Carta de Revisión */}
          <Card 
            className="bg-white/5 border-white/10 backdrop-blur-md hover-elevate cursor-pointer group transition-all"
            onClick={() => setLocation('/profesor/academia/tareas/revision')}
          >
            <CardHeader className="p-6">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center bg-gradient-to-r from-[#002366] to-[#1e3cff] mb-4 group-hover:scale-110 transition-transform">
                <ClipboardCheck className="w-8 h-8 text-white" />
              </div>
              <CardTitle className="text-white text-2xl font-bold mb-2">
                Revisión
              </CardTitle>
              <CardDescription className="text-white/60">
                Accede al módulo de asignaciones de cada curso para revisar entregas, calificar y gestionar.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6 pt-0">
              <Button
                variant="outline"
                className="w-full border-[#1e3cff]/40 text-[#1e3cff] hover:bg-[#1e3cff]/10"
                onClick={(e) => {
                  e.stopPropagation();
                  setLocation('/profesor/academia/tareas/revision');
                }}
              >
                Ver Mis Cursos
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

