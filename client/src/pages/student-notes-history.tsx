import { useState } from 'react';
import { useAuth } from '@/lib/authContext';
import { useLocation } from 'wouter';
import { 
  BookOpen, 
  TrendingUp, 
  Award,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Breadcrumb } from '@/components/Breadcrumb';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

// =========================================================
// INTERFACES Y DATOS MOCK
// =========================================================

interface TrimestreData {
  promedioGeneral: number;
  materias: {
    nombre: string;
    promedio: number;
    estado: 'excelente' | 'bueno' | 'regular' | 'bajo';
  }[];
  resumen: {
    materiasAprobadas: number;
    materiasPendientes: number;
    promedioGeneral: number;
    destacado: string;
  };
}

// Datos mock para los trimestres
const mockTrimestres: Record<string, TrimestreData> = {
  '1er': {
    promedioGeneral: 4.3,
    materias: [
      { nombre: 'Matemáticas', promedio: 4.5, estado: 'excelente' },
      { nombre: 'Español', promedio: 4.2, estado: 'bueno' },
      { nombre: 'Ciencias Naturales', promedio: 4.0, estado: 'bueno' },
      { nombre: 'Historia', promedio: 4.6, estado: 'excelente' },
      { nombre: 'Inglés', promedio: 4.1, estado: 'bueno' }
    ],
    resumen: {
      materiasAprobadas: 5,
      materiasPendientes: 0,
      promedioGeneral: 4.3,
      destacado: 'Excelente desempeño en Historia y Matemáticas'
    }
  },
  '2do': {
    promedioGeneral: 4.4,
    materias: [
      { nombre: 'Matemáticas', promedio: 4.6, estado: 'excelente' },
      { nombre: 'Español', promedio: 4.3, estado: 'bueno' },
      { nombre: 'Ciencias Naturales', promedio: 4.2, estado: 'bueno' },
      { nombre: 'Historia', promedio: 4.7, estado: 'excelente' },
      { nombre: 'Inglés', promedio: 4.2, estado: 'bueno' }
    ],
    resumen: {
      materiasAprobadas: 5,
      materiasPendientes: 0,
      promedioGeneral: 4.4,
      destacado: 'Mejora continua, destacando en todas las áreas'
    }
  },
  '3er': {
    promedioGeneral: 4.5,
    materias: [
      { nombre: 'Matemáticas', promedio: 4.8, estado: 'excelente' },
      { nombre: 'Español', promedio: 4.4, estado: 'bueno' },
      { nombre: 'Ciencias Naturales', promedio: 4.3, estado: 'bueno' },
      { nombre: 'Historia', promedio: 4.8, estado: 'excelente' },
      { nombre: 'Inglés', promedio: 4.3, estado: 'bueno' }
    ],
    resumen: {
      materiasAprobadas: 5,
      materiasPendientes: 0,
      promedioGeneral: 4.5,
      destacado: 'Mejor trimestre del año, excelente progreso'
    }
  }
};

// =========================================================
// COMPONENTE PRINCIPAL
// =========================================================

export default function StudentNotesHistoryPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [selectedTrimestre, setSelectedTrimestre] = useState<string>('1er');

  // Obtener el grado del estudiante desde user.curso
  // El formato puede ser "7B", "11H", etc. Extraemos el número del grado
  const grado = user?.curso ? user.curso.match(/\d+/)?.[0] || user.curso : 'No asignado';

  const trimestreData = mockTrimestres[selectedTrimestre] || mockTrimestres['1er'];

  // Función para obtener el color del estado
  const getEstadoColor = (estado: string) => {
    switch (estado) {
      case 'excelente':
        return 'bg-green-500/20 text-green-400 border-green-500/40';
      case 'bueno':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/40';
      case 'regular':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40';
      case 'bajo':
        return 'bg-red-500/20 text-red-400 border-red-500/40';
      default:
        return 'bg-white/10 text-white/70 border-white/20';
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-10">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Breadcrumb
            className="mb-4"
            items={[
              { label: 'Dashboard', href: '/dashboard' },
              { label: 'Notas', href: '/mi-aprendizaje/notas' },
              { label: 'Historial' },
            ]}
          />
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-4xl font-bold text-white mb-2 font-['Poppins']">
                Historial de Notas
              </h1>
              <p className="text-white/60">
                Grado: {grado}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Award className="w-8 h-8 text-[#1e3cff]" />
            </div>
          </div>
        </div>

        {/* Selector de Trimestre */}
        <Card className="bg-white/5 border-white/10 backdrop-blur-md mb-8">
          <CardContent className="p-6">
            <Tabs value={selectedTrimestre} onValueChange={setSelectedTrimestre}>
              <TabsList className="grid w-full grid-cols-3 bg-white/5 border border-white/10">
                <TabsTrigger value="1er" className="data-[state=active]:bg-[#1e3cff] data-[state=active]:text-white">
                  1er Trimestre
                </TabsTrigger>
                <TabsTrigger value="2do" className="data-[state=active]:bg-[#1e3cff] data-[state=active]:text-white">
                  2do Trimestre
                </TabsTrigger>
                <TabsTrigger value="3er" className="data-[state=active]:bg-[#1e3cff] data-[state=active]:text-white">
                  3er Trimestre
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </CardContent>
        </Card>

        {/* Resumen General del Trimestre */}
        <Card className="bg-gradient-to-br from-[#1e3cff]/20 to-[#002366]/20 border-[#1e3cff]/30 backdrop-blur-md mb-8">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-[#1e3cff]" />
              Resumen del {selectedTrimestre} Trimestre
            </CardTitle>
            <CardDescription className="text-white/60">
              Resumen general de tu rendimiento
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="p-4 bg-white/5 rounded-lg border border-white/10">
                <div className="flex items-center gap-3 mb-2">
                  <CheckCircle2 className="w-5 h-5 text-green-400" />
                  <p className="text-white/60 text-sm">Materias Aprobadas</p>
                </div>
                <p className="text-3xl font-bold text-white">{trimestreData.resumen.materiasAprobadas}</p>
              </div>
              <div className="p-4 bg-white/5 rounded-lg border border-white/10">
                <div className="flex items-center gap-3 mb-2">
                  <AlertCircle className="w-5 h-5 text-yellow-400" />
                  <p className="text-white/60 text-sm">Materias Pendientes</p>
                </div>
                <p className="text-3xl font-bold text-white">{trimestreData.resumen.materiasPendientes}</p>
              </div>
              <div className="p-4 bg-white/5 rounded-lg border border-white/10">
                <div className="flex items-center gap-3 mb-2">
                  <Award className="w-5 h-5 text-[#1e3cff]" />
                  <p className="text-white/60 text-sm">Promedio General</p>
                </div>
                <p className="text-3xl font-bold text-white">{trimestreData.resumen.promedioGeneral.toFixed(1)}</p>
                <p className="text-white/50 text-sm">/ 100</p>
              </div>
            </div>
            <div className="mt-6 p-4 bg-white/5 rounded-lg border border-white/10">
              <p className="text-white/80 font-medium mb-1">Destacado del Trimestre</p>
              <p className="text-white/60 text-sm">{trimestreData.resumen.destacado}</p>
            </div>
          </CardContent>
        </Card>

        {/* Lista de Materias del Trimestre */}
        <Card className="bg-white/5 border-white/10 backdrop-blur-md">
          <CardHeader>
            <CardTitle className="text-white">Desempeño por Materia</CardTitle>
            <CardDescription className="text-white/60">
              Detalle de tus calificaciones en el {selectedTrimestre} trimestre
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {trimestreData.materias.map((materia, idx) => (
                <div
                  key={idx}
                  className="p-6 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-colors"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-12 h-12 rounded-xl flex items-center justify-center"
                        style={{ backgroundColor: '#1e3cff' }}
                      >
                        <BookOpen className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-white text-lg">{materia.nombre}</h3>
                        <Badge className={`mt-1 ${getEstadoColor(materia.estado)}`}>
                          {materia.estado.charAt(0).toUpperCase() + materia.estado.slice(1)}
                        </Badge>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-white">
                        {materia.promedio.toFixed(1)}
                      </p>
                      <p className="text-white/50 text-sm">/ 100</p>
                    </div>
                  </div>
                  <div className="w-full bg-white/10 rounded-full h-2">
                    <div
                      className="bg-gradient-to-r from-[#002366] to-[#1e3cff] h-2 rounded-full transition-all"
                      style={{ width: `${Math.min(100, materia.promedio)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

