import { useState, useMemo, useEffect } from 'react';
import { useAuth } from '@/lib/authContext';
import { useLocation } from 'wouter';
import {
  Calendar as CalendarIcon,
  Clock,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  FileText,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { NavBackButton } from '@/components/nav-back-button';
import { Calendar } from '@/components/Calendar';
import type { CalendarAssignment } from '@/components/Calendar';

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

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export default function StudentTasksPage() {
  const { user } = useAuth();
  const [location, setLocation] = useLocation();
  const isPadre = user?.rol === 'padre';

  useEffect(() => {
    if (isPadre && location.startsWith('/mi-aprendizaje')) {
      setLocation('/parent/tareas');
    }
  }, [isPadre, location, setLocation]);

  const { data: hijos = [] } = useQuery<{ _id: string; nombre: string }[]>({
    queryKey: ['/api/users/me/hijos'],
    queryFn: () => apiRequest('GET', '/api/users/me/hijos'),
    enabled: !!user?.id && isPadre,
  });
  const primerHijoId = hijos[0]?._id;
  const nombreHijo = hijos[0]?.nombre || 'tu hijo/a';
  const viewingStudentId = isPadre ? primerHijoId : user?.id;
  const assignmentFromQuery = isPadre ? '?from=parent' : '';

  const { data: assignmentsStudent = [], isLoading: loadingStudent } = useQuery<Assignment[]>({
    queryKey: ['studentAssignments', user?.id],
    queryFn: () => apiRequest('GET', '/api/assignments/student'),
    enabled: !!user?.id && !isPadre,
    staleTime: 0,
  });

  const { data: assignmentsHijo = [], isLoading: loadingHijo } = useQuery<Assignment[]>({
    queryKey: ['parentAssignments', primerHijoId],
    queryFn: () => apiRequest('GET', `/api/assignments/hijo/${primerHijoId}`),
    enabled: !!user?.id && isPadre && !!primerHijoId,
    staleTime: 0,
  });

  const assignments = isPadre ? assignmentsHijo : assignmentsStudent;
  const isLoading = isPadre ? loadingHijo : loadingStudent;

  // Separar tareas por estado
  const now = new Date();
  const submissions = (assignment: Assignment) => assignment.submissions || assignment.entregas || [];
  const mySubmission = (assignment: Assignment) =>
    viewingStudentId
      ? submissions(assignment).find((e: { estudianteId?: string }) => e.estudianteId === viewingStudentId)
      : undefined;

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

  // Materias únicas para el filtro
  const materiasUnicas = useMemo(() => {
    const set = new Set<string>();
    assignments.forEach(a => {
      const m = a.materiaNombre || a.curso || 'Sin materia';
      if (m) set.add(m);
    });
    return ['', ...Array.from(set).sort()];
  }, [assignments]);

  // Inicializar filtro desde URL
  const [materiaFiltro, setMateriaFiltro] = useState<string>(() => {
    if (typeof window === 'undefined') return '';
    const p = new URLSearchParams(window.location.search);
    return p.get('materia') || '';
  });

  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [visibleCounts, setVisibleCounts] = useState<Record<string, number>>({});

  const coincideMateria = (a: Assignment) => {
    if (!materiaFiltro) return true;
    const m = a.materiaNombre || a.curso || 'Sin materia';
    return m === materiaFiltro;
  };

  const coincideDia = (a: Assignment) => {
    if (!selectedDay) return true;
    return isSameDay(new Date(a.fechaEntrega), selectedDay);
  };

  const tareasPorEntregarFiltradas = useMemo(
    () => tareasPorEntregar.filter(a => coincideMateria(a) && coincideDia(a)),
    [tareasPorEntregar, materiaFiltro, selectedDay]
  );
  const tareasVencidasFiltradas = useMemo(
    () => tareasVencidas.filter(a => coincideMateria(a) && coincideDia(a)),
    [tareasVencidas, materiaFiltro, selectedDay]
  );
  const tareasCompletadasFiltradas = useMemo(
    () => tareasCompletadas.filter(a => coincideMateria(a) && coincideDia(a)),
    [tareasCompletadas, materiaFiltro, selectedDay]
  );

  // Función para determinar el estado visual de una tarea
  const getEstadoTarea = (assignment: Assignment) => {
    const subs = assignment.submissions || assignment.entregas || [];
    const mySub = viewingStudentId
      ? subs.find((e: { estudianteId?: string }) => e.estudianteId === viewingStudentId)
      : undefined;
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
    return { texto: 'Pendiente', color: 'bg-blue-500/20 text-blue-400 border-blue-500/40', icon: Clock };
  };

  const handleDayBubbleClick = (date: Date) => {
    setSelectedDay(prev => (prev && isSameDay(prev, date) ? null : date));
  };

  // Card de tarea — diseño nuevo
  const renderTaskCard = (assignment: Assignment) => {
    const estado = getEstadoTarea(assignment);
    const EstadoIcon = estado.icon;
    const fechaEntrega = new Date(assignment.fechaEntrega);

    return (
      <div
        key={assignment._id}
        className="border border-white/10 rounded-xl p-4 bg-white/[0.03] hover:bg-white/[0.06] transition cursor-pointer"
        onClick={() => setLocation(`/assignment/${assignment._id}${assignmentFromQuery}`)}
      >
        <div className="flex items-start justify-between gap-2 mb-1">
          <p className="font-semibold text-white text-sm leading-snug">{assignment.titulo}</p>
          <Badge className={`${estado.color} shrink-0 text-xs py-0.5 px-2 flex items-center gap-1 whitespace-nowrap`}>
            <EstadoIcon className="w-3 h-3" />
            {estado.texto}
          </Badge>
        </div>
        {assignment.profesorNombre && (
          <p className="text-sm text-white/50 mb-1">{assignment.profesorNombre}</p>
        )}
        {assignment.descripcion && (
          <p className="text-sm text-white/60 truncate">{assignment.descripcion}</p>
        )}
        <div className="flex items-center gap-1.5 text-xs text-white/40 mt-2">
          <CalendarIcon className="w-3 h-3" />
          <span>
            {fechaEntrega.toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })}
            {' · '}
            {fechaEntrega.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      </div>
    );
  };

  // Grupos de materias con acordeón
  const renderMateriaGroups = (tasks: Assignment[], tabKey: string, emptyText: string) => {
    if (tasks.length === 0) {
      return (
        <div className="text-center py-10">
          <FileText className="w-12 h-12 text-white/20 mx-auto mb-3" />
          <p className="text-white/40 text-sm">{emptyText}</p>
        </div>
      );
    }

    const groups: Record<string, Assignment[]> = {};
    tasks.forEach(a => {
      const m = a.materiaNombre || a.curso || 'Sin materia';
      if (!groups[m]) groups[m] = [];
      groups[m].push(a);
    });

    return (
      <div className="space-y-3">
        {Object.entries(groups)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([materia, tareas]) => {
            const groupKey = `${tabKey}_${materia}`;
            const isOpen = expandedGroups[groupKey] !== false;
            const limit = visibleCounts[groupKey] ?? 5;
            const shown = tareas.slice(0, limit);
            const remaining = tareas.length - limit;

            return (
              <Collapsible
                key={materia}
                open={isOpen}
                onOpenChange={o => setExpandedGroups(prev => ({ ...prev, [groupKey]: o }))}
              >
                <CollapsibleTrigger asChild>
                  <button
                    type="button"
                    className="w-full flex items-center justify-between p-3 rounded-lg bg-white/[0.04] border border-white/10 hover:bg-white/[0.07] transition text-left"
                  >
                    <span className="font-medium text-white text-sm">{materia}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-white/40">
                        {tareas.length} tarea{tareas.length !== 1 ? 's' : ''}
                      </span>
                      {isOpen
                        ? <ChevronDown className="w-4 h-4 text-white/40" />
                        : <ChevronRight className="w-4 h-4 text-white/40" />}
                    </div>
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="space-y-2 mt-2">
                    {shown.map(a => renderTaskCard(a))}
                    {remaining > 0 && (
                      <button
                        type="button"
                        className="w-full text-xs text-white/40 hover:text-white/70 py-2 text-center transition"
                        onClick={() =>
                          setVisibleCounts(prev => ({ ...prev, [groupKey]: (prev[groupKey] ?? 5) + 5 }))
                        }
                      >
                        Ver más (+{remaining})
                      </button>
                    )}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            );
          })}
      </div>
    );
  };

  if (isPadre && !primerHijoId && !isLoading) {
    return (
      <div className="flex-1 overflow-y-auto p-6 md:p-10">
        <div className="max-w-7xl mx-auto">
          <NavBackButton to="/parent/aprendizaje" label="Aprendizaje del hijo/a" />
          <h1 className="text-2xl font-bold text-white mt-4 mb-2 font-['Poppins']">Tareas</h1>
          <p className="text-white/60">Vincula un estudiante en tu perfil para ver sus tareas.</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex-1 overflow-y-auto p-6 md:p-10">
        <div className="max-w-7xl mx-auto">
          <div className="text-white">Cargando tareas...</div>
        </div>
      </div>
    );
  }

  const backTo = isPadre && location.startsWith('/parent') ? '/parent/aprendizaje' : undefined;
  const backLabel = isPadre ? 'Aprendizaje del hijo/a' : undefined;

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-10">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <NavBackButton to={backTo} label={backLabel} />
          <h1 className="text-4xl font-bold text-white mb-2 font-['Poppins']">
            {isPadre ? `Tareas de ${nombreHijo}` : 'Mis Tareas'}
          </h1>
          <p className="text-white/60">
            {isPadre
              ? 'Puedes revisar tareas, fechas, estado y calificaciones. Los archivos adjuntos no están disponibles por privacidad.'
              : 'Gestiona todas tus tareas asignadas'}
          </p>
        </div>

        {/* KPI Cards — fila completa */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="rounded-[13px] p-5 bg-white/[0.03] border border-white/10">
            <Clock className="w-5 h-5 text-blue-400 mb-3" />
            <p className="text-3xl font-bold text-white">{tareasPorEntregar.length}</p>
            <p className="text-xs text-white/50 uppercase tracking-wide mt-1">Por Entregar</p>
          </div>
          <div className="rounded-[13px] p-5 bg-white/[0.03] border border-white/10">
            <AlertCircle className="w-5 h-5 text-red-400 mb-3" />
            <p className="text-3xl font-bold text-white">{tareasVencidas.length}</p>
            <p className="text-xs text-white/50 uppercase tracking-wide mt-1">Vencidas</p>
          </div>
          <div className="rounded-[13px] p-5 bg-white/[0.03] border border-white/10">
            <CheckCircle2 className="w-5 h-5 text-green-400 mb-3" />
            <p className="text-3xl font-bold text-white">{tareasCompletadas.length}</p>
            <p className="text-xs text-white/50 uppercase tracking-wide mt-1">Completadas</p>
          </div>
        </div>

        {/* Layout principal: columna izquierda + columna derecha */}
        <div className="grid grid-cols-5 gap-6">
          {/* Columna izquierda: filtro por materia + calendario */}
          <div className="col-span-2 flex flex-col gap-4">
            {/* Filtro por materia */}
            {materiasUnicas.length > 1 && (
              <div className="flex items-center gap-3">
                <Select
                  value={materiaFiltro || 'todas'}
                  onValueChange={v => setMateriaFiltro(v === 'todas' ? '' : v)}
                >
                  <SelectTrigger className="flex-1 bg-white/5 border-white/10 text-white">
                    <SelectValue placeholder="Todas las materias" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas" className="text-white focus:bg-white/10">
                      Todas las materias
                    </SelectItem>
                    {materiasUnicas.filter(Boolean).map(m => (
                      <SelectItem key={m} value={m} className="text-white focus:bg-white/10">
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {materiaFiltro && (
                  <button
                    type="button"
                    className="text-xs text-white/40 hover:text-white/70 transition"
                    onClick={() => setMateriaFiltro('')}
                  >
                    Quitar
                  </button>
                )}
              </div>
            )}

            {/* Calendario */}
            <div className="rounded-xl bg-white/[0.03] border border-white/10 p-4 sticky top-6">
              {selectedDay && (
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm text-white/60">
                    {selectedDay.toLocaleDateString('es-CO', { day: 'numeric', month: 'long' })}
                  </span>
                  <button
                    type="button"
                    className="text-xs text-white/40 hover:text-white/70 transition"
                    onClick={() => setSelectedDay(null)}
                  >
                    Quitar filtro
                  </button>
                </div>
              )}
              <Calendar
                assignments={assignments as unknown as CalendarAssignment[]}
                onDayBubbleClick={handleDayBubbleClick}
                onDayClick={a => setLocation(`/assignment/${a._id}${assignmentFromQuery}`)}
                variant="student"
              />
            </div>
          </div>

          {/* Columna derecha: solo los tabs */}
          <div className="col-span-3">
            {/* Tabs */}
            <Tabs defaultValue="pendientes" className="w-full">
              <TabsList className="bg-transparent border-b border-white/10 mb-4 rounded-none p-0 gap-4">
                <TabsTrigger
                  value="pendientes"
                  className="rounded-none border-b-2 border-transparent pb-2 data-[state=active]:border-blue-400 data-[state=active]:bg-transparent data-[state=active]:text-white text-white/50"
                >
                  Pendientes ({tareasPorEntregarFiltradas.length})
                </TabsTrigger>
                <TabsTrigger
                  value="vencidas"
                  className="rounded-none border-b-2 border-transparent pb-2 data-[state=active]:border-red-400 data-[state=active]:bg-transparent data-[state=active]:text-white text-white/50"
                >
                  Vencidas ({tareasVencidasFiltradas.length})
                </TabsTrigger>
                <TabsTrigger
                  value="completadas"
                  className="rounded-none border-b-2 border-transparent pb-2 data-[state=active]:border-green-400 data-[state=active]:bg-transparent data-[state=active]:text-white text-white/50"
                >
                  Completadas ({tareasCompletadasFiltradas.length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="pendientes">
                {renderMateriaGroups(
                  tareasPorEntregarFiltradas.sort(
                    (a, b) => new Date(a.fechaEntrega).getTime() - new Date(b.fechaEntrega).getTime()
                  ),
                  'pendientes',
                  materiaFiltro
                    ? `No hay tareas pendientes en ${materiaFiltro}`
                    : '¡Sin tareas pendientes!'
                )}
              </TabsContent>

              <TabsContent value="vencidas">
                {renderMateriaGroups(
                  tareasVencidasFiltradas.sort(
                    (a, b) => new Date(a.fechaEntrega).getTime() - new Date(b.fechaEntrega).getTime()
                  ),
                  'vencidas',
                  materiaFiltro
                    ? `No hay tareas vencidas en ${materiaFiltro}`
                    : 'Sin tareas vencidas.'
                )}
              </TabsContent>

              <TabsContent value="completadas">
                {renderMateriaGroups(
                  tareasCompletadasFiltradas.sort((a, b) => {
                    const subsA = a.submissions || a.entregas || [];
                    const subsB = b.submissions || b.entregas || [];
                    const entregaA = viewingStudentId
                      ? subsA.find((e: { estudianteId?: string }) => e.estudianteId === viewingStudentId)
                      : undefined;
                    const entregaB = viewingStudentId
                      ? subsB.find((e: { estudianteId?: string }) => e.estudianteId === viewingStudentId)
                      : undefined;
                    if (!entregaA || !entregaB) return 0;
                    return new Date(entregaB.fechaEntrega).getTime() - new Date(entregaA.fechaEntrega).getTime();
                  }),
                  'completadas',
                  materiaFiltro
                    ? `No hay tareas completadas en ${materiaFiltro}`
                    : 'Las tareas que entregues aparecerán aquí.'
                )}
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  );
}
