import { useAuth } from '@/lib/authContext';
import { AppSidebar } from '@/components/app-sidebar';
import { BookOpen, GraduationCap, MessageSquare, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function Dashboard() {
  const { user } = useAuth();

  const getDashboardContent = () => {
    switch (user?.rol) {
      case 'estudiante':
        return <EstudianteDashboard />;
      case 'profesor':
        return <ProfesorDashboard />;
      case 'directivo':
        return <DirectivoDashboard />;
      case 'padre':
        return <PadreDashboard />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0a0c] via-[#1a001c] to-[#3d0045]">
      <AppSidebar />
      
      <div className="ml-20 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-white mb-2 font-['Poppins']">
              Bienvenido, {user?.nombre.split(' ')[0]} 👋
            </h1>
            <p className="text-white/60">
              {new Date().toLocaleDateString('es-CO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>

          {getDashboardContent()}
        </div>
      </div>
    </div>
  );
}

function EstudianteDashboard() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card className="bg-white/5 border-white/10 backdrop-blur-md hover-elevate">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <BookOpen className="w-5 h-5 text-[#9f25b8]" />
              Mis Cursos
            </CardTitle>
            <CardDescription className="text-white/60">4 cursos activos</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white">4</div>
            <p className="text-sm text-white/50 mt-1">Cursos este semestre</p>
          </CardContent>
        </Card>

        <Card className="bg-white/5 border-white/10 backdrop-blur-md hover-elevate">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <GraduationCap className="w-5 h-5 text-[#9f25b8]" />
              Materiales
            </CardTitle>
            <CardDescription className="text-white/60">Recursos disponibles</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white">24</div>
            <p className="text-sm text-white/50 mt-1">Documentos y guías</p>
          </CardContent>
        </Card>

        <Card className="bg-white/5 border-white/10 backdrop-blur-md hover-elevate">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <MessageSquare className="w-5 h-5 text-[#9f25b8]" />
              Chat AI
            </CardTitle>
            <CardDescription className="text-white/60">Consultas realizadas</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white">12</div>
            <p className="text-sm text-white/50 mt-1">Esta semana</p>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-white/5 border-white/10 backdrop-blur-md">
        <CardHeader>
          <CardTitle className="text-white">Cursos Recientes</CardTitle>
          <CardDescription className="text-white/60">Tus materias de este período</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {['Matemáticas', 'Física', 'Química', 'Historia'].map((curso) => (
            <div key={curso} className="flex items-center justify-between p-4 bg-white/5 rounded-xl hover:bg-white/10 transition-colors cursor-pointer">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-[#9f25b8] to-[#6a0dad] rounded-lg" />
                <div>
                  <p className="font-medium text-white">{curso}</p>
                  <p className="text-sm text-white/50">Curso activo</p>
                </div>
              </div>
              <button className="px-4 py-2 bg-[#9f25b8] hover:bg-[#6a0dad] text-white rounded-lg text-sm font-medium transition-colors">
                Ver curso
              </button>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function ProfesorDashboard() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="bg-white/5 border-white/10 backdrop-blur-md hover-elevate">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <BookOpen className="w-5 h-5 text-[#9f25b8]" />
              Mis Cursos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white">5</div>
            <p className="text-sm text-white/50 mt-1">Cursos a cargo</p>
          </CardContent>
        </Card>

        <Card className="bg-white/5 border-white/10 backdrop-blur-md hover-elevate">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <GraduationCap className="w-5 h-5 text-[#9f25b8]" />
              Estudiantes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white">142</div>
            <p className="text-sm text-white/50 mt-1">Estudiantes totales</p>
          </CardContent>
        </Card>

        <Card className="bg-white/5 border-white/10 backdrop-blur-md hover-elevate">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <MessageSquare className="w-5 h-5 text-[#9f25b8]" />
              Materiales
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white">38</div>
            <p className="text-sm text-white/50 mt-1">Subidos este mes</p>
          </CardContent>
        </Card>

        <Card className="bg-white/5 border-white/10 backdrop-blur-md hover-elevate">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <TrendingUp className="w-5 h-5 text-[#9f25b8]" />
              Engagement
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white">85%</div>
            <p className="text-sm text-white/50 mt-1">Participación promedio</p>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-white/5 border-white/10 backdrop-blur-md">
        <CardHeader>
          <CardTitle className="text-white">Gestión de Cursos</CardTitle>
          <CardDescription className="text-white/60">Administra tus materias</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <button className="px-6 py-3 bg-gradient-to-r from-[#9f25b8] to-[#6a0dad] hover:opacity-90 text-white rounded-xl font-medium transition-opacity">
              Crear Nuevo Curso
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function DirectivoDashboard() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="bg-white/5 border-white/10 backdrop-blur-md hover-elevate">
          <CardHeader>
            <CardTitle className="text-white text-sm">Profesores</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white">24</div>
          </CardContent>
        </Card>

        <Card className="bg-white/5 border-white/10 backdrop-blur-md hover-elevate">
          <CardHeader>
            <CardTitle className="text-white text-sm">Estudiantes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white">680</div>
          </CardContent>
        </Card>

        <Card className="bg-white/5 border-white/10 backdrop-blur-md hover-elevate">
          <CardHeader>
            <CardTitle className="text-white text-sm">Cursos Activos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white">42</div>
          </CardContent>
        </Card>

        <Card className="bg-white/5 border-white/10 backdrop-blur-md hover-elevate">
          <CardHeader>
            <CardTitle className="text-white text-sm">Uso IA</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white">1.2k</div>
            <p className="text-sm text-white/50 mt-1">Consultas/mes</p>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-white/5 border-white/10 backdrop-blur-md">
        <CardHeader>
          <CardTitle className="text-white">Panel Administrativo</CardTitle>
          <CardDescription className="text-white/60">Configuración institucional</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <button className="w-full p-4 bg-white/5 hover:bg-white/10 rounded-xl text-left text-white transition-colors">
            <div className="font-medium">Configurar Identidad Institucional</div>
            <div className="text-sm text-white/50 mt-1">Logo, colores, nombre de IA</div>
          </button>
          <button className="w-full p-4 bg-white/5 hover:bg-white/10 rounded-xl text-left text-white transition-colors">
            <div className="font-medium">Gestionar Usuarios</div>
            <div className="text-sm text-white/50 mt-1">Profesores, estudiantes, padres</div>
          </button>
          <button className="w-full p-4 bg-white/5 hover:bg-white/10 rounded-xl text-left text-white transition-colors">
            <div className="font-medium">Contenido Curricular</div>
            <div className="text-sm text-white/50 mt-1">Metodología y materiales</div>
          </button>
        </CardContent>
      </Card>
    </div>
  );
}

function PadreDashboard() {
  return (
    <div className="space-y-6">
      <Card className="bg-white/5 border-white/10 backdrop-blur-md">
        <CardHeader>
          <CardTitle className="text-white">Seguimiento del Estudiante</CardTitle>
          <CardDescription className="text-white/60">Progreso académico de su hijo/a</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="p-4 bg-white/5 rounded-xl">
              <div className="flex items-center justify-between mb-3">
                <span className="text-white font-medium">Matemáticas</span>
                <span className="text-[#9f25b8] font-bold">4.5/5.0</span>
              </div>
              <div className="w-full bg-white/10 rounded-full h-2">
                <div className="bg-gradient-to-r from-[#9f25b8] to-[#6a0dad] h-2 rounded-full" style={{ width: '90%' }} />
              </div>
            </div>

            <div className="p-4 bg-white/5 rounded-xl">
              <div className="flex items-center justify-between mb-3">
                <span className="text-white font-medium">Ciencias</span>
                <span className="text-[#9f25b8] font-bold">4.2/5.0</span>
              </div>
              <div className="w-full bg-white/10 rounded-full h-2">
                <div className="bg-gradient-to-r from-[#9f25b8] to-[#6a0dad] h-2 rounded-full" style={{ width: '84%' }} />
              </div>
            </div>

            <div className="p-4 bg-white/5 rounded-xl">
              <div className="flex items-center justify-between mb-3">
                <span className="text-white font-medium">Historia</span>
                <span className="text-[#9f25b8] font-bold">4.7/5.0</span>
              </div>
              <div className="w-full bg-white/10 rounded-full h-2">
                <div className="bg-gradient-to-r from-[#9f25b8] to-[#6a0dad] h-2 rounded-full" style={{ width: '94%' }} />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-white/5 border-white/10 backdrop-blur-md">
        <CardHeader>
          <CardTitle className="text-white">Comunicación con Docentes</CardTitle>
          <CardDescription className="text-white/60">Usa el chat AI para consultas</CardDescription>
        </CardHeader>
        <CardContent>
          <button className="w-full px-4 py-3 bg-gradient-to-r from-[#9f25b8] to-[#6a0dad] hover:opacity-90 text-white rounded-xl font-medium transition-opacity">
            Iniciar Chat con AutoClose AI
          </button>
        </CardContent>
      </Card>
    </div>
  );
}
