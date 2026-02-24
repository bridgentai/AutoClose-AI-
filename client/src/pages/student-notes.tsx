import { useState } from 'react';
import { useAuth } from '@/lib/authContext';
import { useLocation } from 'wouter';
import { 
  BookOpen, 
  TrendingUp, 
  TrendingDown, 
  Minus, 
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
import { NavBackButton } from '@/components/nav-back-button';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

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
  profesorNombre?: string | null;
}

// Interfaces para datos reales
interface NotaReal {
  _id: string;
  tareaId: string;
  tareaTitulo: string;
  nota: number; // 0-100
  logro?: string;
  fecha: string;
  profesorNombre: string;
  comentario?: string;
}

interface MateriaConNotas {
  _id: string;
  nombre: string;
  colorAcento?: string;
  icono?: string;
  notas: NotaReal[];
  promedio: number; // 0-100
  ultimaNota: number; // 0-100
  estado: 'excelente' | 'bueno' | 'regular' | 'bajo';
  tendencia: 'up' | 'down' | 'stable';
  profesorNombre?: string | null;
}

// =========================================================
// COMPONENTE PRINCIPAL
// =========================================================

export default function StudentNotesPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);

  const isPadre = user?.rol === 'padre';
  const isEstudiante = user?.rol === 'estudiante';

  const { data: hijos = [] } = useQuery<{ _id: string; nombre: string }[]>({
    queryKey: ['/api/users/me/hijos'],
    queryFn: () => apiRequest('GET', '/api/users/me/hijos'),
    enabled: !!user?.id && isPadre,
  });
  const primerHijoId = hijos[0]?._id;
  const nombreHijo = hijos[0]?.nombre || 'tu hijo/a';

  const { data: notesDataEstudiante, isLoading: loadingEstudiante, isError: errorEstudiante, refetch: refetchEstudiante } = useQuery<{ materias: MateriaConNotas[]; total: number }>({
    queryKey: ['studentNotes', user?.id],
    queryFn: () => apiRequest('GET', '/api/student/notes'),
    enabled: !!user?.id && isEstudiante,
    staleTime: 0,
  });

  const { data: notesDataHijo, isLoading: loadingHijo, isError: errorHijo, refetch: refetchHijo } = useQuery<{ materias: MateriaConNotas[]; total: number }>({
    queryKey: ['/api/student/hijo', primerHijoId, 'notes'],
    queryFn: () => apiRequest('GET', `/api/student/hijo/${primerHijoId}/notes`),
    enabled: !!primerHijoId && isPadre,
    staleTime: 0,
  });

  const notesData = isEstudiante ? notesDataEstudiante : notesDataHijo;
  const isLoading = isEstudiante ? loadingEstudiante : loadingHijo;
  const isError = isEstudiante ? errorEstudiante : errorHijo;
  const refetch = isEstudiante ? refetchEstudiante : refetchHijo;

  const subjects: SubjectGrade[] = notesData?.materias.map(m => ({
    _id: m._id,
    nombre: m.nombre,
    promedio: m.promedio,
    ultimaNota: m.ultimaNota,
    estado: m.estado,
    tendencia: (m as MateriaConNotas).tendencia ?? 'stable',
    colorAcento: m.colorAcento || '#00c8ff',
  })) || [];

  const selectedSubjectData = selectedSubject 
    ? notesData?.materias.find(m => m._id === selectedSubject)
    : null;

  // Convertir a SubjectDetail para compatibilidad
  const subjectDetail: SubjectDetail | null = selectedSubjectData ? {
    _id: selectedSubjectData._id,
    nombre: selectedSubjectData.nombre,
    promedio: selectedSubjectData.promedio,
    ultimaNota: selectedSubjectData.ultimaNota,
    estado: selectedSubjectData.estado,
    tendencia: selectedSubjectData.tendencia,
    colorAcento: selectedSubjectData.colorAcento || '#00c8ff',
    promedioFinal: selectedSubjectData.promedio,
    profesorNombre: selectedSubjectData.profesorNombre ?? selectedSubjectData.notas?.[0]?.profesorNombre ?? null,
    categorias: [
      {
        categoria: 'Tareas',
        promedio: selectedSubjectData.promedio,
        notas: selectedSubjectData.notas.map(n => ({
          actividad: n.tareaTitulo,
          nota: n.nota, // Escala 0-100
          fecha: n.fecha,
          comentario: n.comentario || n.logro,
        })),
      },
    ],
    // Evolución: cada nota ordenada por fecha para la gráfica de líneas
    evolucion: [...selectedSubjectData.notas]
      .sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime())
      .map((n, i, arr) => {
        const hastaFecha = arr.slice(0, i + 1);
        const promedioAcum = hastaFecha.reduce((s, x) => s + x.nota, 0) / hastaFecha.length;
        return {
          mes: new Date(n.fecha).toLocaleDateString('es-CO', { month: 'short', day: 'numeric', year: '2-digit' }),
          promedio: Math.round(promedioAcum * 10) / 10,
          nota: n.nota,
        };
      }),
  } : null;

  // Calcular promedio general
  const promedioGeneral = subjects.length > 0
    ? subjects.reduce((acc, s) => acc + s.promedio, 0) / subjects.length
    : 0;

  if (isPadre && !primerHijoId && !isLoading) {
    return (
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-10">
        <div className="max-w-7xl mx-auto w-full">
          <NavBackButton to="/dashboard" label="Dashboard" />
          <div className="mt-4">
            <h1 className="text-2xl font-bold text-white mb-2">Notas</h1>
            <p className="text-white/60">Vincula un estudiante en tu perfil para ver sus notas.</p>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-10">
        <div className="max-w-7xl mx-auto w-full">
          <NavBackButton to={isPadre ? '/dashboard' : undefined} label={isPadre ? 'Dashboard' : undefined} />
          <div className="mt-4 text-white/80">Cargando notas...</div>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-10">
        <div className="max-w-7xl mx-auto w-full">
          <NavBackButton to={isPadre ? '/dashboard' : undefined} label={isPadre ? 'Dashboard' : undefined} />
          <Card className="bg-white/5 border-white/10 backdrop-blur-md mt-4">
            <CardContent className="p-8 text-center">
              <p className="text-red-300 mb-4">Error al cargar las notas. Revisa tu conexión.</p>
              <Button onClick={() => refetch()} className="bg-[#00c8ff] hover:bg-[#1e3cff]">Reintentar</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

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
    color: s.colorAcento || '#00c8ff'
  }));

  const chartConfig = {
    promedio: {
      label: 'Promedio',
      color: '#00c8ff'
    }
  };

  // Vista principal (lista de materias)
  if (!selectedSubject) {
    if (subjects.length === 0) {
      const pageTitle = isPadre ? `Notas de ${nombreHijo}` : 'Mis Notas';
      const pageSubtitle = isPadre
        ? `Revisa el rendimiento académico de ${nombreHijo} por materia`
        : 'Revisa tu rendimiento académico por materia';
      const emptyMessage = isPadre
        ? `Las notas aparecerán aquí cuando las tareas de ${nombreHijo} sean calificadas.`
        : 'Las notas aparecerán aquí cuando tus tareas sean calificadas.';
      return (
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-10">
          <div className="max-w-7xl mx-auto w-full">
            <div className="mb-8">
              <NavBackButton to={isPadre ? '/dashboard' : undefined} label={isPadre ? 'Dashboard' : undefined} />
              <div className="mt-4">
                <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-2 font-['Poppins']">
                  {pageTitle}
                </h1>
                <p className="text-white/60 text-sm sm:text-base">
                  {pageSubtitle}
                </p>
              </div>
            </div>
            <Card className="bg-white/5 border-white/10 backdrop-blur-md">
              <CardContent className="p-12 text-center">
                <BookOpen className="w-16 h-16 text-[#00c8ff]/40 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-white mb-2">
                  No hay notas registradas
                </h3>
                <p className="text-white/60 mb-6">
                  {emptyMessage}
                </p>
                <Button
                  variant="outline"
                  className="border-white/20 text-white hover:bg-white/10"
                  onClick={() => refetch()}
                >
                  Refrescar
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      );
    }
    const pageTitle = isPadre ? `Notas de ${nombreHijo}` : 'Mis Notas';
    const pageSubtitle = isPadre
      ? `Revisa el rendimiento académico de ${nombreHijo} por materia (solo visualización)`
      : 'Revisa tu rendimiento académico por materia';
    const historialPath = isPadre ? '/parent/notas/historial' : '/mi-aprendizaje/notas/historial';

    return (
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-10">
        <div className="max-w-7xl mx-auto w-full">
          {/* Header */}
          <div className="mb-8">
            <NavBackButton to={isPadre ? '/dashboard' : undefined} label={isPadre ? 'Dashboard' : undefined} />
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mt-4">
              <div className="min-w-0 flex-1">
                <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-2 font-['Poppins']">
                  {pageTitle}
                </h1>
                <p className="text-white/60 text-sm sm:text-base">
                  {pageSubtitle}
                </p>
              </div>
              <Button
                onClick={() => setLocation(historialPath)}
                className="bg-gradient-to-r from-[#002366] to-[#1e3cff] hover:opacity-90 whitespace-nowrap"
              >
                Historial de notas
              </Button>
            </div>
          </div>

          {/* Gráfica General */}
          <Card className="bg-white/5 border-white/10 backdrop-blur-md mb-8">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-[#00c8ff]" />
                Promedio General por Materia
              </CardTitle>
              <CardDescription className="text-white/60">
                Promedio general: <span className="text-white font-semibold">{Math.round(promedioGeneral * 10) / 10}</span>
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 md:p-6">
              <div className="w-full overflow-x-auto">
                <ChartContainer config={chartConfig} className="h-[280px] md:h-[320px] min-w-[300px]">
                  <BarChart 
                    data={chartData}
                    margin={{ top: 20, right: 20, bottom: 40, left: 20 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                    <XAxis 
                      dataKey="materia" 
                      stroke="rgba(255,255,255,0.5)"
                      tick={{ fill: 'rgba(255,255,255,0.7)', fontSize: 12 }}
                      angle={-45}
                      textAnchor="end"
                      height={60}
                      interval={0}
                    />
                    <YAxis 
                      domain={[0, 100]}
                      stroke="rgba(255,255,255,0.5)"
                      tick={{ fill: 'rgba(255,255,255,0.7)', fontSize: 12 }}
                      width={40}
                    />
                    <ChartTooltip 
                      content={<ChartTooltipContent />}
                      cursor={{ fill: 'rgba(159, 37, 184, 0.1)' }}
                    />
                    <Bar 
                      dataKey="promedio" 
                      fill="#00c8ff"
                      radius={[8, 8, 0, 0]}
                    />
                  </BarChart>
                </ChartContainer>
              </div>
            </CardContent>
          </Card>

          {/* Lista de Materias */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
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
                      style={{ backgroundColor: subject.colorAcento || '#00c8ff' }}
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
                      {Math.round(subject.promedio)}
                    </span>
                    <span className="text-white/50">/ 100</span>
                  </div>
                  <div className="flex items-center gap-2 mb-2">
                    <Badge className={getEstadoColor(subject.estado)}>
                      {subject.estado.charAt(0).toUpperCase() + subject.estado.slice(1)}
                    </Badge>
                  </div>
                  <p className="text-sm text-white/60">
                    Última nota: <span className="text-white font-semibold">{Math.round(subject.ultimaNota)}</span>
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
        color: subjectDetail.colorAcento || '#00c8ff'
      }
    };

    return (
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-10">
        <div className="max-w-7xl mx-auto w-full">
          {/* Header con botón volver */}
          <div className="mb-8">
            <NavBackButton to="/mi-aprendizaje/notas" label="Notas" />
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div className="min-w-0 flex-1">
                <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-1 font-['Poppins'] break-words">
                  {subjectDetail.nombre}
                </h1>
                {subjectDetail.profesorNombre && (
                  <p className="text-white/70 text-sm mb-3">Profesor: {subjectDetail.profesorNombre}</p>
                )}
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-bold text-white">
                      {Math.round(subjectDetail.promedioFinal)}
                    </span>
                    <span className="text-white/50">/ 100</span>
                  </div>
                  <Badge className={getEstadoColor(subjectDetail.estado)}>
                    {subjectDetail.estado.charAt(0).toUpperCase() + subjectDetail.estado.slice(1)}
                  </Badge>
                </div>
              </div>
              <div
                className="w-20 h-20 rounded-2xl flex items-center justify-center"
                style={{ backgroundColor: subjectDetail.colorAcento || '#00c8ff' }}
              >
                <BookOpen className="w-10 h-10 text-white" />
              </div>
            </div>
          </div>

          {/* Gráfica de Evolución */}
          <Card className="bg-white/5 border-white/10 backdrop-blur-md mb-8">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-[#00c8ff]" />
                Evolución del Promedio
              </CardTitle>
              <CardDescription className="text-white/60">
                Progreso mensual en {subjectDetail.nombre}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 md:p-6">
              <div className="w-full overflow-x-auto">
                <ChartContainer config={detailChartConfig} className="h-[280px] md:h-[320px] min-w-[300px]">
                  <LineChart 
                    data={subjectDetail.evolucion}
                    margin={{ top: 20, right: 20, bottom: 40, left: 20 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                    <XAxis 
                      dataKey="mes" 
                      stroke="rgba(255,255,255,0.5)"
                      tick={{ fill: 'rgba(255,255,255,0.7)', fontSize: 12 }}
                      angle={-45}
                      textAnchor="end"
                      height={60}
                    />
                    <YAxis 
                      domain={[0, 100]}
                      stroke="rgba(255,255,255,0.5)"
                      tick={{ fill: 'rgba(255,255,255,0.7)', fontSize: 12 }}
                      width={40}
                    />
                    <ChartTooltip 
                      content={<ChartTooltipContent />}
                      cursor={{ stroke: '#00c8ff', strokeWidth: 1 }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="promedio" 
                      stroke="#00c8ff"
                      strokeWidth={3}
                      dot={{ fill: '#00c8ff', r: 6 }}
                    />
                  </LineChart>
                </ChartContainer>
              </div>
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
                        {Math.round(categoria.promedio)}
                      </span>
                      <span className="text-white/50">/ 100</span>
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
                              {Math.round(nota.nota)}
                            </span>
                            <span className="text-white/50">/ 100</span>
                          </div>
                        </div>
                        {nota.comentario && (
                          <div className="mt-3 p-3 bg-white/5 rounded-lg border border-white/10">
                            <div className="flex items-start gap-2">
                              <MessageSquare className="w-4 h-4 text-[#00c8ff] mt-0.5 flex-shrink-0" />
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

