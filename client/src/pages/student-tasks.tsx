import { useAuth } from '@/lib/authContext';
import { useLocation } from 'wouter';
import { 
  ArrowLeft,
  Calendar as CalendarIcon,
  Clock,
  User,
  CheckCircle2,
  Circle,
  FileText,
  AlertCircle
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

interface Assignment {
  _id: string;
  titulo: string;
  descripcion: string;
  curso: string;
  fechaEntrega: string;
  profesorNombre: string;
  entregas?: Array<{
    estudianteId: string;
    fechaEntrega: string;
  }>;
}

export default function StudentTasksPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  // Query para obtener todas las tareas del estudiante
  const { data: assignments = [], isLoading } = useQuery<Assignment[]>({
    queryKey: ['studentAssignments', user?.curso],
    queryFn: () => apiRequest('GET', '/api/assignments/student'),
    enabled: !!user?.id && !!user?.curso,
    staleTime: 0,
  });

  // Separar tareas por entregar y completadas
  const now = new Date();
  const tareasPorEntregar = assignments.filter(assignment => {
    const fechaEntrega = new Date(assignment.fechaEntrega);
    const tieneEntrega = assignment.entregas?.some(
      e => e.estudianteId === user?.id
    );
    return fechaEntrega >= now && !tieneEntrega;
  });

  const tareasCompletadas = assignments.filter(assignment => {
    const tieneEntrega = assignment.entregas?.some(
      e => e.estudianteId === user?.id
    );
    return tieneEntrega;
  });

  const tareasVencidas = assignments.filter(assignment => {
    const fechaEntrega = new Date(assignment.fechaEntrega);
    const tieneEntrega = assignment.entregas?.some(
      e => e.estudianteId === user?.id
    );
    return fechaEntrega < now && !tieneEntrega;
  });

  // Función para determinar el estado de una tarea
  const getEstadoTarea = (assignment: Assignment) => {
    const fechaEntrega = new Date(assignment.fechaEntrega);
    const tieneEntrega = assignment.entregas?.some(
      e => e.estudianteId === user?.id
    );
    
    if (tieneEntrega) {
      return { texto: 'Completada', color: 'bg-green-500/20 text-green-400 border-green-500/40', icon: CheckCircle2 };
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

    return (
      <div
        key={assignment._id}
        className="p-6 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-all cursor-pointer group"
        onClick={() => setLocation(`/assignment/${assignment._id}`)}
      >
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h3 className="font-semibold text-white text-lg group-hover:text-[#9f25b8] transition-colors">
                {assignment.titulo}
              </h3>
              <Badge className={estado.color}>
                <EstadoIcon className="w-3 h-3 mr-1" />
                {estado.texto}
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
              {!assignment.entregas?.some(e => e.estudianteId === user?.id) && (
                <div className="text-[#9f25b8] font-medium">
                  {diasRestantes > 0 ? `${diasRestantes} días restantes` : 'Vencida'}
                </div>
              )}
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
          <Button
            variant="ghost"
            onClick={() => setLocation('/mi-aprendizaje')}
            className="text-white/70 hover:text-white mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver
          </Button>
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

        {/* Tabs para Por Entregar y Completadas */}
        <Tabs defaultValue="por-entregar" className="w-full">
          <TabsList className="bg-white/5 border border-white/10 mb-6">
            <TabsTrigger value="por-entregar" className="data-[state=active]:bg-[#9f25b8] data-[state=active]:text-white">
              Por Entregar ({tareasPorEntregar.length + tareasVencidas.length})
            </TabsTrigger>
            <TabsTrigger value="completadas" className="data-[state=active]:bg-[#9f25b8] data-[state=active]:text-white">
              Completadas ({tareasCompletadas.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="por-entregar">
            <Card className="bg-white/5 border-white/10 backdrop-blur-md">
              <CardHeader>
                <CardTitle className="text-white">Tareas por Entregar</CardTitle>
                <CardDescription className="text-white/60">
                  Tareas pendientes y vencidas
                </CardDescription>
              </CardHeader>
              <CardContent>
                {tareasVencidas.length > 0 && (
                  <div className="mb-6">
                    <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-red-400" />
                      Vencidas ({tareasVencidas.length})
                    </h3>
                    <div className="space-y-4">
                      {tareasVencidas
                        .sort((a, b) => new Date(a.fechaEntrega).getTime() - new Date(b.fechaEntrega).getTime())
                        .map(assignment => renderTaskCard(assignment))}
                    </div>
                  </div>
                )}
                {tareasPorEntregar.length > 0 ? (
                  <div>
                    {tareasVencidas.length > 0 && (
                      <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
                        <Clock className="w-4 h-4 text-yellow-400" />
                        Pendientes ({tareasPorEntregar.length})
                      </h3>
                    )}
                    <div className="space-y-4">
                      {tareasPorEntregar
                        .sort((a, b) => new Date(a.fechaEntrega).getTime() - new Date(b.fechaEntrega).getTime())
                        .map(assignment => renderTaskCard(assignment))}
                    </div>
                  </div>
                ) : (
                  tareasVencidas.length === 0 && (
                    <div className="text-center py-12">
                      <FileText className="w-16 h-16 text-[#9f25b8]/40 mx-auto mb-4" />
                      <h3 className="text-xl font-semibold text-white mb-2">
                        No hay tareas pendientes
                      </h3>
                      <p className="text-white/60">
                        ¡Excelente! Has completado todas tus tareas.
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
                  Tareas que ya has entregado
                </CardDescription>
              </CardHeader>
              <CardContent>
                {tareasCompletadas.length > 0 ? (
                  <div className="space-y-4">
                    {tareasCompletadas
                      .sort((a, b) => {
                        const entregaA = a.entregas?.find(e => e.estudianteId === user?.id);
                        const entregaB = b.entregas?.find(e => e.estudianteId === user?.id);
                        if (!entregaA || !entregaB) return 0;
                        return new Date(entregaB.fechaEntrega).getTime() - new Date(entregaA.fechaEntrega).getTime();
                      })
                      .map(assignment => renderTaskCard(assignment))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <CheckCircle2 className="w-16 h-16 text-[#9f25b8]/40 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold text-white mb-2">
                      No hay tareas completadas
                    </h3>
                    <p className="text-white/60">
                      Las tareas que entregues aparecerán aquí.
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

