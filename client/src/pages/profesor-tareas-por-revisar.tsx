import { useState, useMemo, useEffect, type ReactNode } from 'react';
import { useAuth } from '@/lib/authContext';
import { useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import {
  Calendar as CalendarIcon,
  Clock,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  FileText,
  Bell,
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
import { Button } from '@/components/ui/button';
import { Breadcrumb } from '@/components/Breadcrumb';
import { Calendar } from '@/components/Calendar';
import type { CalendarAssignment } from '@/components/Calendar';
import type { AssignmentCourseInfo } from '@/lib/assignmentUtils';

interface Assignment extends AssignmentCourseInfo {
  _id: string;
  titulo: string;
  descripcion?: string | null;
  fechaEntrega: string;
  profesorNombre?: string;
  materiaNombre?: string;
  courseId?: string;
  /** group (grupo) id — calendario docente */
  groupId?: string;
  /** materia subject id */
  subjectId?: string;
  type?: string;
  requiresSubmission?: boolean;
  createdAt?: string;
  pendientesCalificar?: number;
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

type ProfTasksTab = 'todas' | 'por-revisar' | 'vencidas' | 'al-dia';

function isReminder(a: Assignment): boolean {
  return a.type === 'reminder';
}

function isSinEntregaPlataforma(a: Assignment): boolean {
  return Boolean(!isReminder(a) && a.requiresSubmission === false);
}

function pendientes(a: Assignment): number {
  return a.pendientesCalificar ?? 0;
}

/** Tiene entregas pendientes por calificar (flujo con entrega en plataforma). */
function necesitaRevision(a: Assignment): boolean {
  if (isReminder(a) || isSinEntregaPlataforma(a)) return false;
  return pendientes(a) > 0;
}

function puedeMostrarCalendario(a: Assignment): boolean {
  return !isReminder(a);
}

function coincideMateria(a: Assignment, materiaFiltro: string): boolean {
  if (!materiaFiltro) return true;
  const m = a.materiaNombre || (a.curso as string | undefined) || 'Sin materia';
  return m === materiaFiltro;
}

function coincideDia(a: Assignment, selectedDay: Date | null): boolean {
  if (!selectedDay) return true;
  return isSameDay(new Date(a.fechaEntrega), selectedDay);
}

export default function ProfesorTareasPorRevisarPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  const { data: assignments = [], isLoading } = useQuery<Assignment[]>({
    queryKey: ['teacherMisAsignaciones', user?.id],
    queryFn: () => apiRequest('GET', `/api/assignments/profesor/${user?.id}/mis-asignaciones`),
    enabled: !!user?.id,
    staleTime: 0,
    refetchOnMount: 'always',
  });

  const { porRevisarList, vencidasList, alDiaList } = useMemo(() => {
    const snapshot = new Date();
    const porRevisar: Assignment[] = [];
    const vencidas: Assignment[] = [];
    const alDia: Assignment[] = [];
    for (const a of assignments) {
      const due = new Date(a.fechaEntrega);
      if (necesitaRevision(a)) {
        porRevisar.push(a);
        if (due < snapshot) vencidas.push(a);
      } else if (!isReminder(a) && !isSinEntregaPlataforma(a)) {
        alDia.push(a);
      }
    }
    return { porRevisarList: porRevisar, vencidasList: vencidas, alDiaList: alDia };
  }, [assignments]);

  const materiasUnicas = useMemo(() => {
    const set = new Set<string>();
    assignments.forEach((a) => {
      const m = a.materiaNombre || a.curso || 'Sin materia';
      if (m) set.add(m);
    });
    return ['', ...Array.from(set).sort()];
  }, [assignments]);

  const [materiaFiltro, setMateriaFiltro] = useState<string>(() => {
    if (typeof window === 'undefined') return '';
    const p = new URLSearchParams(window.location.search);
    return p.get('materia') || '';
  });

  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [tasksTab, setTasksTab] = useState<ProfTasksTab>('todas');
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [visibleCounts, setVisibleCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const p = new URLSearchParams(window.location.search);
    if (materiaFiltro) p.set('materia', materiaFiltro);
    else p.delete('materia');
    const next = `${window.location.pathname}${p.toString() ? `?${p.toString()}` : ''}`;
    window.history.replaceState(null, '', next);
  }, [materiaFiltro]);

  useEffect(() => {
    if (user && user.rol !== 'profesor') setLocation('/dashboard');
  }, [user, setLocation]);

  const filtrarBase = (list: Assignment[]) =>
    list.filter((a) => coincideMateria(a, materiaFiltro) && coincideDia(a, selectedDay));

  const todasFiltradas = useMemo(
    () => filtrarBase(assignments),
    [assignments, materiaFiltro, selectedDay]
  );
  const porRevisarFiltradas = useMemo(
    () => filtrarBase(porRevisarList),
    [porRevisarList, materiaFiltro, selectedDay]
  );
  const vencidasFiltradas = useMemo(
    () => filtrarBase(vencidasList),
    [vencidasList, materiaFiltro, selectedDay]
  );
  const alDiaFiltradas = useMemo(
    () => filtrarBase(alDiaList),
    [alDiaList, materiaFiltro, selectedDay]
  );

  const assignmentsForCalendar = useMemo(() => {
    const list: Assignment[] =
      tasksTab === 'todas'
        ? todasFiltradas
        : tasksTab === 'por-revisar'
          ? porRevisarFiltradas
          : tasksTab === 'vencidas'
            ? vencidasFiltradas
            : alDiaFiltradas;
    return list
      .filter(puedeMostrarCalendario)
      .filter((a) => {
        if (!materiaFiltro) return true;
        const m = a.materiaNombre || a.curso || 'Sin materia';
        return m === materiaFiltro;
      })
      .map((a) => ({
        ...a,
        descripcion: a.descripcion ?? '',
        profesorNombre: a.profesorNombre ?? '',
        curso: typeof a.curso === 'string' ? a.curso : String(a.curso ?? ''),
      }));
  }, [tasksTab, todasFiltradas, porRevisarFiltradas, vencidasFiltradas, alDiaFiltradas, materiaFiltro]);

  const tasksTabLabel =
    tasksTab === 'todas'
      ? 'Todas'
      : tasksTab === 'por-revisar'
        ? 'Por revisar'
        : tasksTab === 'vencidas'
          ? 'Vencidas'
          : 'Al día';

  const goToAssignment = (a: Assignment) => {
    const noEntregaPlataforma = isSinEntregaPlataforma(a);
    const pend = necesitaRevision(a);
    const isReminderA = isReminder(a);
    if (!isReminderA && !noEntregaPlataforma && pend) {
      setLocation(`/assignment/${a._id}?tab=entregas`);
    } else {
      setLocation(`/assignment/${a._id}`);
    }
  };

  const getEstadoDocente = (a: Assignment, refNow = new Date()) => {
    const due = new Date(a.fechaEntrega);
    if (isReminder(a)) {
      return { texto: 'Recordatorio', color: 'bg-amber-500/20 text-amber-200 border-amber-500/40', icon: Bell };
    }
    if (isSinEntregaPlataforma(a)) {
      return { texto: 'Sin entrega en plataforma', color: 'bg-slate-500/20 text-slate-200 border-slate-500/40', icon: FileText };
    }
    if (necesitaRevision(a)) {
      if (due < refNow) {
        return { texto: 'Vencida · por calificar', color: 'bg-red-500/20 text-red-300 border-red-500/45', icon: AlertCircle };
      }
      const dias = Math.ceil((due.getTime() - refNow.getTime()) / (1000 * 60 * 60 * 24));
      if (dias <= 3) {
        return { texto: 'Próximo cierre · por calificar', color: 'bg-yellow-500/20 text-yellow-200 border-yellow-500/40', icon: AlertTriangle };
      }
      return { texto: 'Por calificar', color: 'bg-blue-500/20 text-blue-200 border-blue-500/35', icon: Clock };
    }
    return { texto: 'Al día', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/35', icon: CheckCircle2 };
  };

  const renderTaskCard = (a: Assignment) => {
    const estado = getEstadoDocente(a);
    const EstadoIcon = estado.icon;
    const fechaEntrega = new Date(a.fechaEntrega);

    return (
      <button
        type="button"
        key={a._id}
        className="w-full text-left border border-white/10 rounded-xl p-4 bg-white/[0.03] hover:bg-white/[0.06] transition cursor-pointer"
        onClick={() => goToAssignment(a)}
      >
        <div className="flex items-start justify-between gap-2 mb-1">
          <p className="font-semibold text-white text-sm leading-snug">{a.titulo}</p>
          <Badge className={`${estado.color} shrink-0 text-xs py-0.5 px-2 flex items-center gap-1 whitespace-nowrap border`}>
            <EstadoIcon className="w-3 h-3" />
            {estado.texto}
          </Badge>
        </div>
        {(a.materiaNombre || (a.curso && !/^[\da-f-]{36}$/i.test(String(a.curso)))) ? (
          <p className="text-sm text-white/50 mb-1">
            {[a.materiaNombre?.trim(), (a.curso && !/^[\da-f-]{36}$/i.test(String(a.curso)) ? String(a.curso) : '')]
              .filter(Boolean)
              .join(' · ')}
          </p>
        ) : null}
        {pendientes(a) > 0 && (
          <p className="text-xs text-white/55 mb-1">
            {pendientes(a)} entrega{pendientes(a) === 1 ? '' : 's'} pendiente{pendientes(a) === 1 ? '' : 's'} de calificar
          </p>
        )}
        {a.descripcion ? (
          <p className="text-sm text-white/60 truncate">{a.descripcion}</p>
        ) : null}
        <div className="flex items-center gap-1.5 text-xs text-white/40 mt-2">
          <CalendarIcon className="w-3 h-3 shrink-0" />
          <span>
            Entrega:{' '}
            {fechaEntrega.toLocaleDateString('es-CO', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            })}
            {' · '}
            {fechaEntrega.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      </button>
    );
  };

  const renderMateriaGroups = (tasks: Assignment[], tabKey: string, emptyText: string): ReactNode => {
    if (tasks.length === 0) {
      return (
        <div className="text-center py-10">
          <FileText className="w-12 h-12 text-white/20 mx-auto mb-3" />
          <p className="text-white/40 text-sm">{emptyText}</p>
        </div>
      );
    }

    const groups: Record<string, Assignment[]> = {};
    tasks.forEach((a) => {
      const m = a.materiaNombre || (a.curso as string | undefined) || 'Sin materia';
      if (!groups[m]) groups[m] = [];
      groups[m].push(a);
    });

    const taskCountUnderlineClass =
      tabKey === 'todas'
        ? 'border-cyan-400'
        : tabKey === 'por-revisar'
          ? 'border-blue-400'
          : tabKey === 'vencidas'
            ? 'border-red-400'
            : 'border-green-400';

    return (
      <div className="space-y-3">
        {Object.entries(groups)
          .sort(([x], [y]) => x.localeCompare(y))
          .map(([materia, tareas]) => {
            const groupKey = `${tabKey}_${materia}`;
            const isOpen = expandedGroups[groupKey] === true;
            const limit = visibleCounts[groupKey] ?? 5;
            const shown = tareas.slice(0, limit);
            const remaining = tareas.length - limit;
            const isVencidasOverload = tabKey === 'vencidas' && tareas.length > 0;
            const isPorRevisarOverload = tabKey === 'por-revisar' && tareas.length > 3;

            const triggerBase =
              'w-full flex items-center justify-between p-3 rounded-lg border transition text-left';
            const triggerNormal = 'bg-white/[0.04] border-white/10 hover:bg-white/[0.07]';
            const triggerAlert =
              'bg-red-500/15 border-red-500/45 hover:bg-red-500/25 shadow-[0_0_0_1px_rgba(239,68,68,0.2)]';
            const triggerWarn =
              'bg-orange-500/12 border-orange-400/35 hover:bg-orange-500/20 shadow-[0_0_0_1px_rgba(251,146,60,0.15)]';

            const triggerSpecial =
              isVencidasOverload ? triggerAlert : isPorRevisarOverload ? triggerWarn : triggerNormal;

            return (
              <Collapsible
                key={materia}
                open={isOpen}
                onOpenChange={(o) => setExpandedGroups((prev) => ({ ...prev, [groupKey]: o }))}
              >
                <CollapsibleTrigger asChild>
                  <button type="button" className={`${triggerBase} ${triggerSpecial}`}>
                    <span className="flex items-center gap-2 min-w-0">
                      {isVencidasOverload && (
                        <AlertCircle className="w-4 h-4 shrink-0 text-red-400" aria-hidden />
                      )}
                      {isPorRevisarOverload && !isVencidasOverload && (
                        <AlertTriangle className="w-4 h-4 shrink-0 text-orange-300" aria-hidden />
                      )}
                      <span
                        className={`font-medium text-sm truncate ${
                          isVencidasOverload ? 'text-red-100' : isPorRevisarOverload ? 'text-white' : 'text-white'
                        }`}
                      >
                        {materia}
                      </span>
                    </span>
                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={`text-xs inline-block pb-0.5 border-b-2 ${taskCountUnderlineClass} text-white/40`}
                      >
                        {tareas.length} tarea{tareas.length !== 1 ? 's' : ''}
                      </span>
                      {isOpen ? (
                        <ChevronDown className="w-4 h-4 text-white/40" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-white/40" />
                      )}
                    </div>
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="space-y-2 mt-2">
                    {shown.map((a) => renderTaskCard(a))}
                    {remaining > 0 && (
                      <button
                        type="button"
                        className="w-full text-xs text-white/40 hover:text-white/70 py-2 text-center transition"
                        onClick={() =>
                          setVisibleCounts((prev) => ({
                            ...prev,
                            [groupKey]: (prev[groupKey] ?? 5) + 5,
                          }))
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

  const handleDayBubbleClick = (date: Date) => {
    setSelectedDay((prev) => (prev && isSameDay(prev, date) ? null : date));
  };

  if (!user || user.rol !== 'profesor') {
    return null;
  }

  if (isLoading) {
    return (
      <div className="flex-1 overflow-y-auto p-6 md:p-10">
        <div className="max-w-7xl mx-auto text-white">Cargando asignaciones…</div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-10 text-[var(--text-primary,#E2E8F0)]">
      <div className="max-w-7xl mx-auto">
        <Breadcrumb
          className="mb-6"
          items={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Revisión de asignaciones' }]}
        />

        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2 font-[Poppins,sans-serif]">
            Revisión de asignaciones
          </h1>
          <p className="text-white/60">
            Misma vista que tus estudiantes en «Mis Asignaciones»: filtros por materia, pestañas y calendario, adaptado al
            trabajo de calificación.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="rounded-[13px] p-5 bg-[var(--card-bg,rgba(255,255,255,0.03))] border border-[var(--card-border,rgba(255,255,255,0.1))]">
            <Clock className="w-5 h-5 text-blue-400 mb-3" aria-hidden />
            <p className="text-3xl font-bold text-white">{porRevisarList.length}</p>
            <p className="text-xs text-white/50 uppercase tracking-wide mt-1">Por revisar</p>
          </div>
          <div className="rounded-[13px] p-5 bg-[var(--card-bg,rgba(255,255,255,0.03))] border border-[var(--card-border,rgba(255,255,255,0.1))]">
            <AlertCircle className="w-5 h-5 text-red-400 mb-3" aria-hidden />
            <p className="text-3xl font-bold text-white">{vencidasList.length}</p>
            <p className="text-xs text-white/50 uppercase tracking-wide mt-1">Vencidas</p>
          </div>
          <div className="rounded-[13px] p-5 bg-[var(--card-bg,rgba(255,255,255,0.03))] border border-[var(--card-border,rgba(255,255,255,0.1))]">
            <CheckCircle2 className="w-5 h-5 text-green-400 mb-3" aria-hidden />
            <p className="text-3xl font-bold text-white">{alDiaList.length}</p>
            <p className="text-xs text-white/50 uppercase tracking-wide mt-1">Al día</p>
          </div>
        </div>

        <div className="mb-8">
          {materiasUnicas.length > 1 && (
            <div className="flex items-center gap-3 mb-4 flex-wrap">
              <Select
                value={materiaFiltro || 'todas'}
                onValueChange={(v) => setMateriaFiltro(v === 'todas' ? '' : v)}
              >
                <SelectTrigger className="w-[220px] bg-white/5 border-white/10 text-white">
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
              {materiaFiltro ? (
                <button
                  type="button"
                  className="text-xs text-white/40 hover:text-white/70 transition"
                  onClick={() => setMateriaFiltro('')}
                >
                  Quitar filtro
                </button>
              ) : null}
            </div>
          )}

          <Tabs value={tasksTab} onValueChange={(v) => setTasksTab(v as ProfTasksTab)} className="w-full">
            <TabsList className="bg-transparent border-b border-white/10 mb-4 rounded-none p-0 gap-4 flex-wrap">
              <TabsTrigger
                value="todas"
                className="rounded-none border-b-2 border-transparent pb-2 data-[state=active]:border-cyan-400 data-[state=active]:bg-transparent data-[state=active]:text-white text-white/50"
              >
                Todas ({todasFiltradas.length})
              </TabsTrigger>
              <TabsTrigger
                value="por-revisar"
                className="rounded-none border-b-2 border-transparent pb-2 data-[state=active]:border-blue-400 data-[state=active]:bg-transparent data-[state=active]:text-white text-white/50"
              >
                Por revisar ({porRevisarFiltradas.length})
              </TabsTrigger>
              <TabsTrigger
                value="vencidas"
                className="rounded-none border-b-2 border-transparent pb-2 data-[state=active]:border-red-400 data-[state=active]:bg-transparent data-[state=active]:text-white text-white/50"
              >
                Vencidas ({vencidasFiltradas.length})
              </TabsTrigger>
              <TabsTrigger
                value="al-dia"
                className="rounded-none border-b-2 border-transparent pb-2 data-[state=active]:border-green-400 data-[state=active]:bg-transparent data-[state=active]:text-white text-white/50"
              >
                Al día ({alDiaFiltradas.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="todas">
              {renderMateriaGroups(
                [...todasFiltradas].sort(
                  (a, b) => new Date(a.fechaEntrega).getTime() - new Date(b.fechaEntrega).getTime()
                ),
                'todas',
                materiaFiltro
                  ? `No hay asignaciones en ${materiaFiltro}`
                  : 'Aún no hay asignaciones creadas por ti.'
              )}
            </TabsContent>

            <TabsContent value="por-revisar">
              {renderMateriaGroups(
                [...porRevisarFiltradas].sort(
                  (a, b) => new Date(a.fechaEntrega).getTime() - new Date(b.fechaEntrega).getTime()
                ),
                'por-revisar',
                materiaFiltro ? `Sin pendientes de calificar en ${materiaFiltro}` : '¡Nada pendiente por calificar!'
              )}
            </TabsContent>

            <TabsContent value="vencidas">
              {renderMateriaGroups(
                [...vencidasFiltradas].sort(
                  (a, b) => new Date(a.fechaEntrega).getTime() - new Date(b.fechaEntrega).getTime()
                ),
                'vencidas',
                materiaFiltro ? `Sin fechas vencidas con pendientes en ${materiaFiltro}` : 'Sin asignaciones vencidas por calificar.'
              )}
            </TabsContent>

            <TabsContent value="al-dia">
              {renderMateriaGroups(
                [...alDiaFiltradas].sort(
                  (a, b) =>
                    new Date(b.createdAt || a.fechaEntrega).getTime() -
                    new Date(a.createdAt || a.fechaEntrega).getTime()
                ),
                'al-dia',
                materiaFiltro ? `Sin asignaciones al día en ${materiaFiltro}` : 'Las que ya no tienen entregas por calificar aparecen aquí.'
              )}
            </TabsContent>
          </Tabs>
        </div>

        {assignments.length === 0 ? (
          <div className="rounded-xl bg-white/[0.03] border border-white/10 p-10 text-center">
            <FileText className="w-16 h-16 text-white/25 mx-auto mb-4" />
            <p className="text-white font-medium mb-2">Aún no hay asignaciones</p>
            <p className="text-white/55 text-sm mb-6">
              Creá tareas desde tus cursos; cuando existan, podrás filtrarlas y verlas en el calendario.
            </p>
            <Button
              className="bg-[hsl(var(--primary))] hover:opacity-90 text-white"
              onClick={() => setLocation('/profesor/academia/cursos')}
            >
              Ir a Mis cursos
            </Button>
          </div>
        ) : (
          <div className="rounded-xl bg-white/[0.03] border border-white/10 p-6">
            {(materiaFiltro || selectedDay || tasksTab !== 'todas') && (
              <div className="space-y-2 mb-4">
                {(materiaFiltro || tasksTab !== 'todas') && (
                  <p className="text-sm text-white/60">
                    Calendario:{' '}
                    <span
                      className={
                        tasksTab === 'todas'
                          ? 'text-cyan-400 font-medium'
                          : tasksTab === 'vencidas'
                            ? 'text-red-400 font-medium'
                            : tasksTab === 'al-dia'
                              ? 'text-green-400 font-medium'
                              : 'text-blue-400 font-medium'
                      }
                    >
                      {tasksTabLabel}
                    </span>
                    {materiaFiltro ? (
                      <>
                        {' · '}
                        <span className="text-blue-400 font-medium">{materiaFiltro}</span>
                      </>
                    ) : null}
                  </p>
                )}
                {selectedDay && (
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm text-white/60">
                      Filtrando tareas del{' '}
                      {selectedDay.toLocaleDateString('es-CO', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })}
                    </span>
                    <button
                      type="button"
                      className="text-xs text-white/40 hover:text-white/70 transition shrink-0"
                      onClick={() => setSelectedDay(null)}
                    >
                      Quitar filtro de día
                    </button>
                  </div>
                )}
              </div>
            )}
            <Calendar
              assignments={assignmentsForCalendar as CalendarAssignment[]}
              onDayClick={(a2) =>
                setLocation(
                  necesitaRevision(a2 as Assignment) &&
                    !isSinEntregaPlataforma(a2 as Assignment) &&
                    !isReminder(a2 as Assignment)
                    ? `/assignment/${a2._id}?tab=entregas`
                    : `/assignment/${a2._id}`
                )
              }
              onDayBubbleClick={handleDayBubbleClick}
              variant="teacher"
              monthLegendOverride="asignaciones con fecha este mes"
            />
          </div>
        )}
      </div>
    </div>
  );
}
