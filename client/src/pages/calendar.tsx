import { useMemo, useState } from 'react';
import { useAuth } from '@/lib/authContext';
import { Calendar as CalendarIcon } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useLocation } from 'wouter';
import { Calendar } from '@/components/Calendar';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { NavBackButton } from '@/components/nav-back-button';

interface Assignment {
  _id: string;
  titulo: string;
  descripcion: string;
  curso: string;
  fechaEntrega: string;
  profesorNombre: string;
  courseId?: string;
  materiaNombre?: string;
  subjectId?: string;
  groupId?: string;
  estado?: 'pendiente' | 'entregada' | 'calificada';
  requiresSubmission?: boolean;
  type?: string;
}

export default function CalendarPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const isPadre = user?.rol === 'padre';

  const { data: hijos = [] } = useQuery<{ _id: string; nombre: string; curso: string }[]>({
    queryKey: ['/api/users/me/hijos'],
    queryFn: () => apiRequest('GET', '/api/users/me/hijos'),
    enabled: !!user?.id && isPadre,
  });
  const primerHijoId = hijos[0]?._id;
  const nombreHijo = hijos[0]?.nombre || 'tu hijo/a';

  const { data: assignmentsStudent = [] } = useQuery<Assignment[]>({
    queryKey: ['studentAssignments', user?.curso],
    queryFn: () => apiRequest('GET', '/api/assignments/student'),
    enabled: !!user?.id && !!user?.curso && !isPadre,
    staleTime: 0,
  });

  const { data: assignmentsHijo = [] } = useQuery<Assignment[]>({
    queryKey: ['parentAssignments', primerHijoId],
    queryFn: () => apiRequest('GET', `/api/assignments/hijo/${primerHijoId}`),
    enabled: !!user?.id && isPadre && !!primerHijoId,
    staleTime: 0,
  });

  const assignments = isPadre ? assignmentsHijo : assignmentsStudent;
  const [filterMateria, setFilterMateria] = useState<string>('');

  // Agrupar tareas por materia para el resumen (categorías)
  const assignmentsByMateria = useMemo(() => {
    const map = new Map<string, Assignment[]>();
    for (const a of assignments) {
      const key = (a.subjectId ?? a.materiaNombre ?? 'Sin materia').trim() || 'Sin materia';
      const label = (a.materiaNombre ?? 'Sin materia').trim() || 'Sin materia';
      const existing = map.get(key);
      if (existing) existing.push(a);
      else map.set(key, [a]);
    }
    // Ordenar tareas dentro de cada grupo por fecha
    const entries = Array.from(map.entries()).map(([key, list]) => {
      const label = list[0]?.materiaNombre?.trim() || 'Sin materia';
      return { key, label, assignments: [...list].sort((x, y) => new Date(x.fechaEntrega).getTime() - new Date(y.fechaEntrega).getTime()) };
    });
    entries.sort((a, b) => a.label.localeCompare(b.label));
    return entries;
  }, [assignments]);

  const materiasFiltradas = useMemo(() => {
    if (!filterMateria) return assignmentsByMateria;
    return assignmentsByMateria.filter((g) => g.key === filterMateria || g.label === filterMateria);
  }, [assignmentsByMateria, filterMateria]);

  const handleDayClick = (assignment: Assignment) => {
    const q = isPadre ? '?from=parent' : '';
    setLocation(`/assignment/${assignment._id}${q}`);
  };

  const pageTitle = isPadre
    ? `Tareas de ${nombreHijo}`
    : `Mis Tareas - Curso ${user?.curso || 'No asignado'}`;
  const pageSubtitle = isPadre
    ? 'Visualiza las tareas de tu hijo/a (solo visualización)'
    : 'Visualiza todas las tareas asignadas a tu curso';

  return (
    <div className="w-full">
      <div className="max-w-5xl mx-auto">
        <NavBackButton />
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-white mb-2 font-['Poppins']">{pageTitle}</h2>
          <p className="text-white/60">{pageSubtitle}</p>
        </div>

        <Card className="bg-white/[0.04] border-white/10 backdrop-blur-md rounded-2xl shadow-none">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <CalendarIcon className="w-5 h-5 text-[#00c8ff]" />
              Calendario del Mes
            </CardTitle>
            <CardDescription className="text-white/60">
              Colores por materia; verdes, rojos y ámbar según el estado de entrega real del estudiante.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-2 pb-6">
            <Calendar
              assignments={assignments}
              viewingStudentId={isPadre ? primerHijoId : user?.id}
              onDayClick={handleDayClick}
              variant="student"
            />
          </CardContent>
        </Card>

              {/* Lista de tareas del mes agrupadas por materia con filtro */}
        {assignments.length > 0 && (
          <Card className="bg-white/[0.04] border-white/10 backdrop-blur-md rounded-2xl mt-8 shadow-none">
                  <CardHeader>
                    <CardTitle className="text-white">Tareas Próximas</CardTitle>
                    <CardDescription className="text-white/60">
                      Tareas de este mes. Filtra por materia.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex flex-wrap items-center gap-3">
                      <Label className="text-white/80 text-sm shrink-0">Filtrar por materia:</Label>
                      <Select value={filterMateria || 'todas'} onValueChange={(v) => setFilterMateria(v === 'todas' ? '' : v)}>
                        <SelectTrigger className="w-[200px] bg-white/10 border-white/20 text-white">
                          <SelectValue placeholder="Todas las materias" />
                        </SelectTrigger>
                        <SelectContent className="bg-[#0a0a2a] border-white/10">
                          <SelectItem value="todas" className="text-white focus:bg-white/10">
                            Todas ({assignments.length})
                          </SelectItem>
                          {assignmentsByMateria.map(({ key, label, assignments: list }) => (
                            <SelectItem key={key} value={key} className="text-white focus:bg-white/10">
                              {label} ({list.length})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-6">
                      {materiasFiltradas.map(({ label, assignments: list }) => (
                        <div key={label}>
                          <h3 className="text-sm font-semibold text-white/80 uppercase tracking-wider mb-3 pb-2 border-b border-white/10">
                            {label}
                          </h3>
                          <div className="space-y-3">
                            {list.map((assignment) => (
                              <div
                                key={assignment._id}
                                className="p-4 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
                                onClick={() => handleDayClick(assignment)}
                                data-testid={`assignment-item-${assignment._id}`}
                              >
                                <div className="flex items-start justify-between">
                                  <div className="flex-1">
                                    <h4 className="font-semibold text-white mb-1">{assignment.titulo}</h4>
                                    <p className="text-sm text-white/70 mb-2 line-clamp-2">{assignment.descripcion}</p>
                                    <p className="text-xs text-white/50">
                                      Profesor: {assignment.profesorNombre}
                                    </p>
                                  </div>
                                  <div className="text-right ml-4">
                                    <p className="text-sm font-semibold text-[#00c8ff]">
                                      {new Date(assignment.fechaEntrega).toLocaleDateString('es-CO', { 
                                        day: 'numeric',
                                        month: 'short'
                                      })}
                                    </p>
                                    <p className="text-xs text-white/50">
                                      {new Date(assignment.fechaEntrega).toLocaleTimeString('es-CO', { 
                                        hour: '2-digit',
                                        minute: '2-digit'
                                      })}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

        {assignments.length === 0 && (
          <Card className="bg-white/[0.04] border-white/10 backdrop-blur-md rounded-2xl mt-8 shadow-none">
                  <CardContent className="py-12 text-center">
                    <CalendarIcon className="w-16 h-16 text-[#00c8ff]/40 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold text-white mb-2">
                      No hay tareas este mes
                    </h3>
                    <p className="text-white/60">
                      {isPadre
                        ? `${nombreHijo} no tiene tareas asignadas para este mes.`
                        : `Tu curso ${user?.curso} no tiene tareas asignadas para este mes.`}
                    </p>
                  </CardContent>
                </Card>
              )}
      </div>
    </div>
  );
}
