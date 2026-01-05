import { useState } from 'react';
import { useAuth } from '@/lib/authContext';
import { useLocation } from 'wouter';
import { 
  BookOpen, 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  XCircle,
  MessageSquare
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, BarChart, Bar } from 'recharts';

// =========================================================
// INTERFACES Y DATOS MOCK
// =========================================================

interface SubjectGrade {
  _id: string;
  nombre: string;
  promedio: number;
  ultimaNota: number;
  estado: 'excelente' | 'bueno' | 'regular' | 'bajo';
  tendencia: 'up' | 'down' | 'stable';
  colorAcento?: string;
}

interface GradeDetail {
  categoria: string;
  promedio: number;
  notas: {
    actividad: string;
    nota: number;
    fecha: string;
    comentario?: string;
  }[];
}

interface SubjectDetail extends SubjectGrade {
  promedioFinal: number;
  categorias: GradeDetail[];
  evolucion: { mes: string; promedio: number }[];
}

// Datos mock para demostración
const mockSubjects: SubjectGrade[] = [
  {
    _id: '1',
    nombre: 'Matemáticas',
    promedio: 4.5,
    ultimaNota: 4.8,
    estado: 'excelente',
    tendencia: 'up',
    colorAcento: '#9f25b8'
  },
  {
    _id: '2',
    nombre: 'Español',
    promedio: 4.2,
    ultimaNota: 4.0,
    estado: 'bueno',
    tendencia: 'stable',
    colorAcento: '#6a0dad'
  },
  {
    _id: '3',
    nombre: 'Ciencias Naturales',
    promedio: 3.8,
    ultimaNota: 3.5,
    estado: 'regular',
    tendencia: 'down',
    colorAcento: '#c66bff'
  },
  {
    _id: '4',
    nombre: 'Historia',
    promedio: 4.6,
    ultimaNota: 4.7,
    estado: 'excelente',
    tendencia: 'up',
    colorAcento: '#9f25b8'
  }
];

const mockSubjectDetail: SubjectDetail = {
  _id: '1',
  nombre: 'Matemáticas',
  promedio: 4.5,
  ultimaNota: 4.8,
  estado: 'excelente',
  tendencia: 'up',
  colorAcento: '#9f25b8',
  promedioFinal: 4.5,
  categorias: [
    {
      categoria: 'Exámenes',
      promedio: 4.6,
      notas: [
        { actividad: 'Examen Parcial 1', nota: 4.5, fecha: '2024-01-15', comentario: 'Excelente trabajo, sigue así' },
        { actividad: 'Examen Parcial 2', nota: 4.7, fecha: '2024-02-20', comentario: 'Muy bien, mejoraste' }
      ]
    },
    {
      categoria: 'Tareas',
      promedio: 4.4,
      notas: [
        { actividad: 'Tarea de Álgebra', nota: 4.3, fecha: '2024-01-10' },
        { actividad: 'Tarea de Geometría', nota: 4.5, fecha: '2024-02-05' }
      ]
    },
    {
      categoria: 'Proyectos',
      promedio: 4.5,
      notas: [
        { actividad: 'Proyecto Final', nota: 4.5, fecha: '2024-03-01', comentario: 'Buen proyecto, bien estructurado' }
      ]
    }
  ],
  evolucion: [
    { mes: 'Ene', promedio: 4.2 },
    { mes: 'Feb', promedio: 4.4 },
    { mes: 'Mar', promedio: 4.5 },
    { mes: 'Abr', promedio: 4.6 }
  ]
};

// =========================================================
// COMPONENTE PRINCIPAL
// =========================================================

export default function StudentNotesPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const [subjects] = useState<SubjectGrade[]>(mockSubjects);
  const [subjectDetail] = useState<SubjectDetail | null>(mockSubjectDetail);

  // Calcular promedio general
  const promedioGeneral = subjects.reduce((acc, s) => acc + s.promedio, 0) / subjects.length;

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

  // Función para obtener el icono de tendencia
  const getTendenciaIcon = (tendencia: string) => {
    switch (tendencia) {
      case 'up':
        return <TrendingUp className="w-4 h-4 text-green-400" />;
      case 'down':
        return <TrendingDown className="w-4 h-4 text-red-400" />;
      default:
        return <Minus className="w-4 h-4 text-yellow-400" />;
    }
  };

  // Datos para la gráfica general
  const chartData = subjects.map(s => ({
    materia: s.nombre.substring(0, 8),
    promedio: s.promedio,
    color: s.colorAcento || '#9f25b8'
  }));

  const chartConfig = {
    promedio: {
      label: 'Promedio',
      color: '#9f25b8'
    }
  };

  // Vista principal (lista de materias)
  if (!selectedSubject) {
    return (
      <div className="flex-1 overflow-y-auto p-6 md:p-10">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center gap-4 mb-4">
              <Button
                variant="ghost"
                onClick={() => setLocation('/mi-aprendizaje')}
                className="text-white/70 hover:text-white"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Volver
              </Button>
            </div>
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-4xl font-bold text-white mb-2 font-['Poppins']">
                  Mis Notas
                </h1>
                <p className="text-white/60">
                  Revisa tu rendimiento académico por materia
                </p>
              </div>
              <Button
                onClick={() => setLocation('/mi-aprendizaje/notas/historial')}
                className="bg-gradient-to-r from-[#9f25b8] to-[#6a0dad] hover:opacity-90"
              >
                Historial de notas
              </Button>
            </div>
          </div>

          {/* Gráfica General */}
          <Card className="bg-white/5 border-white/10 backdrop-blur-md mb-8">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-[#9f25b8]" />
                Promedio General por Materia
              </CardTitle>
              <CardDescription className="text-white/60">
                Promedio general: <span className="text-white font-semibold">{promedioGeneral.toFixed(2)}</span>
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig} className="h-[300px]">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                  <XAxis 
                    dataKey="materia" 
                    stroke="rgba(255,255,255,0.5)"
                    tick={{ fill: 'rgba(255,255,255,0.7)' }}
                  />
                  <YAxis 
                    domain={[0, 5]}
                    stroke="rgba(255,255,255,0.5)"
                    tick={{ fill: 'rgba(255,255,255,0.7)' }}
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar 
                    dataKey="promedio" 
                    fill="#9f25b8"
                    radius={[8, 8, 0, 0]}
                  />
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>

          {/* Lista de Materias */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {subjects.map((subject) => (
              <Card
                key={subject._id}
                className="bg-white/5 border-white/10 backdrop-blur-md hover-elevate cursor-pointer group"
                onClick={() => setSelectedSubject(subject._id)}
              >
                <CardHeader className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div
                      className="w-16 h-16 rounded-2xl flex items-center justify-center"
                      style={{ backgroundColor: subject.colorAcento || '#9f25b8' }}
                    >
                      <BookOpen className="w-8 h-8 text-white" />
                    </div>
                    {getTendenciaIcon(subject.tendencia)}
                  </div>
                  <CardTitle className="text-white text-2xl font-bold mb-2">
                    {subject.nombre}
                  </CardTitle>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-3xl font-bold text-white">
                      {subject.promedio.toFixed(1)}
                    </span>
                    <span className="text-white/50">/ 5.0</span>
                  </div>
                  <div className="flex items-center gap-2 mb-2">
                    <Badge className={getEstadoColor(subject.estado)}>
                      {subject.estado.charAt(0).toUpperCase() + subject.estado.slice(1)}
                    </Badge>
                  </div>
                  <p className="text-sm text-white/60">
                    Última nota: <span className="text-white font-semibold">{subject.ultimaNota.toFixed(1)}</span>
                  </p>
                </CardHeader>
                <CardContent className="p-6 pt-0">
                  <Button
                    variant="outline"
                    className="w-full border-white/10 text-white hover:bg-white/10"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedSubject(subject._id);
                    }}
                  >
                    Ver Detalles
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Vista detallada de una materia
  if (selectedSubject && subjectDetail) {
    const detailChartConfig = {
      promedio: {
        label: 'Promedio',
        color: subjectDetail.colorAcento || '#9f25b8'
      }
    };

    return (
      <div className="flex-1 overflow-y-auto p-6 md:p-10">
        <div className="max-w-7xl mx-auto">
          {/* Header con botón volver */}
          <div className="mb-8">
            <Button
              variant="ghost"
              onClick={() => setSelectedSubject(null)}
              className="text-white/70 hover:text-white mb-4"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Volver a Notas
            </Button>
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-4xl font-bold text-white mb-2 font-['Poppins']">
                  {subjectDetail.nombre}
                </h1>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-bold text-white">
                      {subjectDetail.promedioFinal.toFixed(1)}
                    </span>
                    <span className="text-white/50">/ 5.0</span>
                  </div>
                  <Badge className={getEstadoColor(subjectDetail.estado)}>
                    {subjectDetail.estado.charAt(0).toUpperCase() + subjectDetail.estado.slice(1)}
                  </Badge>
                </div>
              </div>
              <div
                className="w-20 h-20 rounded-2xl flex items-center justify-center"
                style={{ backgroundColor: subjectDetail.colorAcento || '#9f25b8' }}
              >
                <BookOpen className="w-10 h-10 text-white" />
              </div>
            </div>
          </div>

          {/* Gráfica de Evolución */}
          <Card className="bg-white/5 border-white/10 backdrop-blur-md mb-8">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-[#9f25b8]" />
                Evolución del Promedio
              </CardTitle>
              <CardDescription className="text-white/60">
                Progreso mensual en {subjectDetail.nombre}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer config={detailChartConfig} className="h-[300px]">
                <LineChart data={subjectDetail.evolucion}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                  <XAxis 
                    dataKey="mes" 
                    stroke="rgba(255,255,255,0.5)"
                    tick={{ fill: 'rgba(255,255,255,0.7)' }}
                  />
                  <YAxis 
                    domain={[0, 5]}
                    stroke="rgba(255,255,255,0.5)"
                    tick={{ fill: 'rgba(255,255,255,0.7)' }}
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Line 
                    type="monotone" 
                    dataKey="promedio" 
                    stroke="#9f25b8"
                    strokeWidth={3}
                    dot={{ fill: '#9f25b8', r: 6 }}
                  />
                </LineChart>
              </ChartContainer>
            </CardContent>
          </Card>

          {/* Notas por Categoría */}
          <div className="space-y-6">
            {subjectDetail.categorias.map((categoria, idx) => (
              <Card key={idx} className="bg-white/5 border-white/10 backdrop-blur-md">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-white">{categoria.categoria}</CardTitle>
                    <div className="flex items-center gap-2">
                      <span className="text-xl font-bold text-white">
                        {categoria.promedio.toFixed(1)}
                      </span>
                      <span className="text-white/50">/ 5.0</span>
                    </div>
                  </div>
                  <CardDescription className="text-white/60">
                    Promedio de {categoria.notas.length} {categoria.notas.length === 1 ? 'actividad' : 'actividades'}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {categoria.notas.map((nota, notaIdx) => (
                      <div
                        key={notaIdx}
                        className="p-4 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-colors"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <h4 className="font-semibold text-white mb-1">{nota.actividad}</h4>
                            <p className="text-sm text-white/60">
                              {new Date(nota.fecha).toLocaleDateString('es-CO', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric'
                              })}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-2xl font-bold text-white">
                              {nota.nota.toFixed(1)}
                            </span>
                            <span className="text-white/50">/ 5.0</span>
                          </div>
                        </div>
                        {nota.comentario && (
                          <div className="mt-3 p-3 bg-white/5 rounded-lg border border-white/10">
                            <div className="flex items-start gap-2">
                              <MessageSquare className="w-4 h-4 text-[#9f25b8] mt-0.5 flex-shrink-0" />
                              <p className="text-sm text-white/80">{nota.comentario}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return null;
}

