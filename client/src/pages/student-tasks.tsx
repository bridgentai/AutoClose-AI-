import { useState, useMemo } from 'react';
import { useAuth } from '@/lib/authContext';
import { useLocation } from 'wouter';
import { 
  Calendar as CalendarIcon,
  Clock,
  User,
  CheckCircle2,
  Circle,
  FileText,
  AlertCircle,
  Star,
  Filter
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { NavBackButton } from '@/components/nav-back-button';
import { courseDisplayLabel } from '@/lib/assignmentUtils';

interface Assignment {
  _id: string;
  titulo: string;
  descripcion: string;
  curso: string;
  fechaEntrega: string;
  profesorNombre: string;
  /** Nombre de la materia (ej. Física, Matemáticas) */
  materiaNombre?: string;
  estado?: 'pendiente' | 'entregada' | 'calificada';
  submissions?: Array<{
    estudianteId: string;
    fechaEntrega: string;
    calificacion?: number;
    retroalimentacion?: string;
  }>;
  entregas?: Array<{
    estudianteId: string;
    fechaEntrega: string;
    calificacion?: number;
  }>;
}

// Mismo criterio de color que el calendario (por materia)
const MATERIA_COLORS = [
  '#1e3cff', '#002366', '#00c8ff', '#003d7a', '#10b981', '#f59e0b',
  '#ef4444', '#06b6d4', '#f97316', '#14b8a6', '#84cc16', '#ffd700',
];
function colorForMateria(name: string): string {
  if (!name) return MATERIA_COLORS[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return MATERIA_COLORS[Math.abs(hash) % MATERIA_COLORS.length];
}

export default function StudentTasksPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  // Query para obtener todas las tareas del estudiante
  const { data: assignments = [], isLoading } = useQuery<Assignment[]>({
    queryKey: ['studentAssignments', user?.id],
    queryFn: () => apiRequest('GET', '/api/assignments/student'),
    enabled: !!user?.id,
    staleTime: 0,
  });

  // Separar tareas por estado
  const now = new Date();
  const submissions = (assignment: Assignment) => assignment.submissions || assignment.entregas || [];
  const mySubmission = (assignment: Assignment) => submissions(assignment).find(
    (e: any) => e.estudianteId === user?.id
  );
  
  const tareasPorEntregar = assignments.filter(assignment => {
    const estado = assignment.estado || (mySubmission(assignment) 
      ? (mySubmission(assignment)?.calificacion !== undefined ? 'calificada' : 'entregada')
      : 'pendiente');
    const fechaEntrega = new Date(assignment.fechaEntrega);
    return estado === 'pendiente' && fechaEntrega >= now;
  });

  const tareasCompletadas = assignments.filter(assignment => {
    const estado = assignment.estado || (mySubmission(assignment) 
      ? (mySubmission(assignment)?.calificacion !== undefined ? 'calificada' : 'entregada')
      : 'pendiente');
    return estado === 'calificada' || estado === 'entregada';
  });

  const tareasVencidas = assignments.filter(assignment => {
    const estado = assignment.estado || (mySubmission(assignment) 
      ? (mySubmission(assignment)?.calificacion !== undefined ? 'calificada' : 'entregada')
      : 'pendiente');
    const fechaEntrega = new Date(assignment.fechaEntrega);
    return estado === 'pendiente' && fechaEntrega < now;
  });

  // Materias únicas para el filtro (ordenadas)
  const materiasUnicas = useMemo(() => {
    const set = new Set<string>();
    assignments.forEach(a => {
      const m = a.materiaNombre || a.curso || 'Sin materia';
      if (m) set.add(m);
    });
    return ['', ...Array.from(set).sort()];
  }, [assignments]);

  const [materiaFiltro, setMateriaFiltro] = useState<string>('');

  const coincideMateria = (a: Assignment) => {
    if (!materiaFiltro) return true;
    const m = a.materiaNombre || a.curso || 'Sin materia';
    return m === materiaFiltro;
  };

  const tareasPorEntregarFiltradas = useMemo(() => tareasPorEntregar.filter(coincideMateria), [tareasPorEntregar, materiaFiltro]);
  const tareasVencidasFiltradas = useMemo(() => tareasVencidas.filter(coincideMateria), [tareasVencidas, materiaFiltro]);
  const tareasCompletadasFiltradas = useMemo(() => tareasCompletadas.filter(coincideMateria), [tareasCompletadas, materiaFiltro]);

  // Función para determinar el estado de una tarea
  const getEstadoTarea = (assignment: Assignment) => {
    const submissions = assignment.submissions || assignment.entregas || [];
    const mySub = submissions.find((e: any) => e.estudianteId === user?.id);
    const estado = assignment.estado || (mySub 
      ? (mySub.calificacion !== undefined ? 'calificada' : 'entregada')
      : 'pendiente');
    
    const fechaEntrega = new Date(assignment.fechaEntrega);
    
    if (estado === 'calificada') {
      return { texto: 'Calificada', color: 'bg-green-500/20 text-green-400 border-green-500/40', icon: CheckCircle2 };
    }
    if (estado === 'entregada') {
      return { texto: 'Entregada', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40', icon: Clock };
    }
    if (fechaEntrega < now) {
      return { texto: 'Vencida', color: 'bg-red-500/20 text-red-400 border-red-500/40', icon: AlertCircle };
    }
    const diasRestantes = Math.ceil((fechaEntrega.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (diasRestantes <= 3) {
      return { texto: 'Próxima', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40', icon: Clock };
    }
    return { texto: 'Pendiente', color: 'bg-blue-500/20 text-blue-400 border-blue-500/40', icon: Circle };
  };

  // Función para calcular días restantes
  const getDiasRestantes = (fechaEntrega: string) => {
    const fecha = new Date(fechaEntrega);
    const diff = fecha.getTime() - now.getTime();
    const dias = Math.ceil(diff / (1000 * 60 * 60 * 24));
    return dias;
  };

  // Componente para renderizar una tarjeta de tarea
  const renderTaskCard = (assignment: Assignment) => {
    const estado = getEstadoTarea(assignment);
    const EstadoIcon = estado.icon;
    const diasRestantes = getDiasRestantes(assignment.fechaEntrega);
    const fechaEntrega = new Date(assignment.fechaEntrega);
    const materiaNombre = (() => {
      const label = courseDisplayLabel(assignment);
      return label === 'Curso' ? 'Sin materia' : label;
    })();
    const materiaColor = colorForMateria(materiaNombre);

    return (
      <div
        key={assignment._id}
        className="p-6 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-all cursor-pointer group relative overflow-hidden"
        style={{ borderLeftWidth: '4px', borderLeftColor: materiaColor }}
        onClick={() => setLocation(`/assignment/${assignment._id}`)}
      >
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2 flex-wrap">
              <h3 className="font-semibold text-white text-lg group-hover:text-[#00c8ff] transition-colors">
                {assignment.titulo}
              </h3>
              <Badge className={estado.color}>
                <EstadoIcon className="w-3 h-3 mr-1" />
                {estado.texto}
              </Badge>
              <Badge
                className="bg-white/10 text-white/90 border border-white/20 font-medium"
                style={{ backgroundColor: `${materiaColor}22`, borderColor: materiaColor, color: materiaColor }}
              >
                {materiaNombre}
              </Badge>
            </div>
            <p className="text-sm text-white/70 mb-4 line-clamp-2">
              {assignment.descripcion}
            </p>
            <div className="flex flex-wrap items-center gap-4 text-sm">
              <div className="flex items-center gap-2 text-white/60">
                <User className="w-4 h-4" />
                <span>{assignment.profesorNombre}</span>
              </div>
              <div className="flex items-center gap-2 text-white/60">
                <CalendarIcon className="w-4 h-4" />
                <span>
                  {fechaEntrega.toLocaleDateString('es-CO', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric'
                  })}
                </span>
              </div>
              <div className="flex items-center gap-2 text-white/60">
                <Clock className="w-4 h-4" />
                <span>
                  {fechaEntrega.toLocaleTimeString('es-CO', {
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </span>
              </div>
              {(() => {
                const submissions = assignment.submissions || assignment.entregas || [];
                const mySub = submissions.find((e: any) => e.estudianteId === user?.id);
                const estado = assignment.estado || (mySub 
                  ? (mySub.calificacion !== undefined ? 'calificada' : 'entregada')
                  : 'pendiente');
                
                if (estado === 'pendiente') {
                  return (
                    <div className="text-[#00c8ff] font-medium">
                      {diasRestantes > 0 ? `${diasRestantes} días restantes` : 'Vencida'}
                    </div>
                  );
                }
                if (estado === 'calificada' && mySub?.calificacion !== undefined) {
                  return (
                    <div className="text-green-400 font-semibold">
                      Calificación: {mySub.calificacion}/100
                    </div>
                  );
                }
                return null;
              })()}
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex-1 overflow-y-auto p-6 md:p-10">
        <div className="max-w-7xl mx-auto">
          <div className="text-white">Cargando tareas...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-10">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <NavBackButton />
          <div>
            <h1 className="text-4xl font-bold text-white mb-2 font-['Poppins']">
              Mis Tareas
            </h1>
            <p className="text-white/60">
              Gestiona todas tus tareas asignadas
            </p>
          </div>
        </div>

        {/* Estadísticas rápidas */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="bg-white/5 border-white/10 backdrop-blur-md">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-blue-500/20">
                  <Circle className="w-6 h-6 text-blue-400" />
                </div>
                <div>
                  <p className="text-white/60 text-sm">Por Entregar</p>
                  <p className="text-2xl font-bold text-white">{tareasPorEntregar.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-white/5 border-white/10 backdrop-blur-md">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-red-500/20">
                  <AlertCircle className="w-6 h-6 text-red-400" />
                </div>
                <div>
                  <p className="text-white/60 text-sm">Vencidas</p>
                  <p className="text-2xl font-bold text-white">{tareasVencidas.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-white/5 border-white/10 backdrop-blur-md">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-green-500/20">
                  <CheckCircle2 className="w-6 h-6 text-green-400" />
                </div>
                <div>
                  <p className="text-white/60 text-sm">Completadas</p>
                  <p className="text-2xl font-bold text-white">{tareasCompletadas.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filtro por materia */}
        {materiasUnicas.length > 1 && (
          <div className="flex flex-wrap items-center gap-3 mb-6">
            <div className="flex items-center gap-2 text-white/80">
              <Filter className="w-4 h-4 text-[#00c8ff]" />
              <span className="text-sm font-medium">Filtrar por materia</span>
            </div>
            <Select value={materiaFiltro || 'todas'} onValueChange={(v) => setMateriaFiltro(v === 'todas' ? '' : v)}>
              <SelectTrigger className="w-[200px] bg-white/5 border-white/10 text-white">
                <SelectValue placeholder="Todas las materias" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas" className="text-white focus:bg-white/10">
                  Todas las materias
                </SelectItem>
                {materiasUnicas.filter(Boolean).map((m) => (
                  <SelectItem key={m} value={m} className="text-white focus:bg-white/10">
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {materiaFiltro && (
              <Badge
                variant="outline"
                className="cursor-pointer border-white/20 text-white/80 hover:bg-white/10"
                onClick={() => setMateriaFiltro('')}
              >
                Quitar filtro
              </Badge>
            )}
          </div>
        )}

        {/* Tabs para Por Entregar y Completadas (conteos según filtro) */}
        <Tabs defaultValue="por-entregar" className="w-full">
          <TabsList className="bg-white/5 border border-white/10 mb-6">
            <TabsTrigger value="por-entregar" className="data-[state=active]:bg-[#00c8ff] data-[state=active]:text-white">
              Por Entregar ({tareasPorEntregarFiltradas.length + tareasVencidasFiltradas.length})
            </TabsTrigger>
            <TabsTrigger value="completadas" className="data-[state=active]:bg-[#00c8ff] data-[state=active]:text-white">
              Completadas ({tareasCompletadasFiltradas.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="por-entregar">
            <Card className="bg-white/5 border-white/10 backdrop-blur-md">
              <CardHeader>
                <CardTitle className="text-white">Tareas por Entregar</CardTitle>
                <CardDescription className="text-white/60">
                  {materiaFiltro ? `Tareas pendientes y vencidas en ${materiaFiltro}` : 'Tareas pendientes y vencidas'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {tareasVencidasFiltradas.length > 0 && (
                  <div className="mb-6">
                    <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-red-400" />
                      Vencidas ({tareasVencidasFiltradas.length})
                    </h3>
                    <div className="space-y-4">
                      {tareasVencidasFiltradas
                        .sort((a, b) => new Date(a.fechaEntrega).getTime() - new Date(b.fechaEntrega).getTime())
                        .map(assignment => renderTaskCard(assignment))}
                    </div>
                  </div>
                )}
                {tareasPorEntregarFiltradas.length > 0 ? (
                  <div>
                    {tareasVencidasFiltradas.length > 0 && (
                      <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
                        <Clock className="w-4 h-4 text-yellow-400" />
                        Pendientes ({tareasPorEntregarFiltradas.length})
                      </h3>
                    )}
                    <div className="space-y-4">
                      {tareasPorEntregarFiltradas
                        .sort((a, b) => new Date(a.fechaEntrega).getTime() - new Date(b.fechaEntrega).getTime())
                        .map(assignment => renderTaskCard(assignment))}
                    </div>
                  </div>
                ) : (
                  tareasVencidasFiltradas.length === 0 && (
                    <div className="text-center py-12">
                      <FileText className="w-16 h-16 text-[#00c8ff]/40 mx-auto mb-4" />
                      <h3 className="text-xl font-semibold text-white mb-2">
                        {materiaFiltro ? `No hay tareas pendientes en ${materiaFiltro}` : 'No hay tareas pendientes'}
                      </h3>
                      <p className="text-white/60">
                        {materiaFiltro ? 'Prueba otra materia o quita el filtro.' : '¡Excelente! Has completado todas tus tareas.'}
                      </p>
                    </div>
                  )
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="completadas">
            <Card className="bg-white/5 border-white/10 backdrop-blur-md">
              <CardHeader>
                <CardTitle className="text-white">Tareas Completadas</CardTitle>
                <CardDescription className="text-white/60">
                  {materiaFiltro ? `Tareas entregadas en ${materiaFiltro}` : 'Tareas que ya has entregado'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {tareasCompletadasFiltradas.length > 0 ? (
                  <div className="space-y-4">
                    {tareasCompletadasFiltradas
                      .sort((a, b) => {
                        const subsA = a.submissions || a.entregas || [];
                        const subsB = b.submissions || b.entregas || [];
                        const entregaA = subsA.find((e: any) => e.estudianteId === user?.id);
                        const entregaB = subsB.find((e: any) => e.estudianteId === user?.id);
                        if (!entregaA || !entregaB) return 0;
                        return new Date(entregaB.fechaEntrega).getTime() - new Date(entregaA.fechaEntrega).getTime();
                      })
                      .map(assignment => renderTaskCard(assignment))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <CheckCircle2 className="w-16 h-16 text-[#00c8ff]/40 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold text-white mb-2">
                      {materiaFiltro ? `No hay tareas completadas en ${materiaFiltro}` : 'No hay tareas completadas'}
                    </h3>
                    <p className="text-white/60">
                      {materiaFiltro ? 'Prueba otra materia o quita el filtro.' : 'Las tareas que entregues aparecerán aquí.'}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

