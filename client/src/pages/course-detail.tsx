import { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '@/lib/authContext';
import { Calendar as CalendarIcon, ClipboardList, AlertCircle, BookOpen, Clock, User, FileText, Bell, TrendingUp, Award, ChevronRight, Home, Users, Eye, Settings, Plus, X, Maximize2, Gauge, FileUp, CheckCircle, MessageSquare, Send, BarChart3, FolderOpen, Cloud, Link2, Presentation, FileSpreadsheet, ExternalLink, ArrowRight } from 'lucide-react';
import { Breadcrumb } from '@/components/Breadcrumb';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useLocation, useRoute } from 'wouter';
import { Calendar } from '@/components/Calendar';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import {
  weightedGradeWithinLogro,
  courseWeightedFromLogros,
  courseGradeFromOutcomes,
  hasRecordedScore,
  type OutcomeGradeNode,
} from '@shared/weightedGrades';
import {
    buildLogroBloquesForSelect,
    countIndicadoresInBloques,
    LogroIndicadorSelects,
} from '@/components/assignment/logroIndicadorSelect';

// =========================================================
// 0. CELDA EDITABLE (preview table)
// =========================================================

function PreviewEditableNoteCell({
    value,
    isSinCategoria,
    onSave,
}: {
    value: number | string;
    isSinCategoria: boolean;
    onSave: (calificacion: number | null) => void;
}) {
    const [editing, setEditing] = useState(false);
    const [local, setLocal] = useState(() => (value === '' || value === '—' ? '' : String(value)));
    const prevValue = useRef(value);
    if (prevValue.current !== value && !editing) {
        prevValue.current = value;
        setLocal(value === '' || value === '—' ? '' : String(value));
    }
    const saveFromValue = (raw: string) => {
        const trimmed = String(raw).trim();
        setEditing(false);
        if (trimmed === '' || trimmed === '—') {
            onSave(null);
            setLocal('');
            return;
        }
        const n = parseFloat(trimmed);
        if (!Number.isNaN(n) && n >= 0 && n <= 100) {
            onSave(n);
            setLocal(trimmed);
        } else {
            setLocal(value === '' || value === '—' ? '' : String(value));
        }
    };
    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
        saveFromValue(e.target?.value ?? local);
    };
    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            saveFromValue(e.currentTarget.value ?? local);
            e.currentTarget.blur();
        }
    };
    const isEmpty = value === '' || value === '—' || value === undefined;
    const baseClass = 'mx-auto max-w-[100px] rounded-[12px] px-2 py-2 text-center text-xs font-medium transition-all duration-200 cursor-text overflow-hidden';
    const styleClass = isSinCategoria
        ? 'bg-amber-500/10 border border-amber-500/20 text-amber-200/90 hover:bg-amber-500/15'
        : 'bg-white/[0.03] border border-white/[0.06] text-[#E2E8F0] hover:bg-[rgba(59,130,246,0.15)] hover:border-[rgba(59,130,246,0.4)]';

    if (editing) {
        return (
            <div className={`${baseClass} ${styleClass}`} onClick={(e) => e.stopPropagation()}>
                <input
                    type="number"
                    min={0}
                    max={100}
                    value={local}
                    onChange={(e) => setLocal(e.target.value)}
                    onBlur={handleBlur}
                    onKeyDown={handleKeyDown}
                    autoFocus
                    className="w-full bg-transparent text-center outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
            </div>
        );
    }
    return (
        <div className={`${baseClass} ${styleClass}`} onClick={(e) => { e.stopPropagation(); setEditing(true); }}>
            <span className={isEmpty ? 'text-white/40' : ''}>{isEmpty ? '—' : String(value)}</span>
        </div>
    );
}

// =========================================================
// 1. INTERFACES
// =========================================================

interface Submission {
    estudianteId: string;
    calificacion?: number;
}

interface Assignment {
    _id: string;
    titulo: string;
    descripcion: string;
    curso: string; // ID del grupo (ej. '10A')
    courseId?: string; // ID de la materia (opcional para compatibilidad)
    fechaEntrega: string;
    profesorNombre: string;
    submissions?: Submission[];
    entregas?: Submission[];
    logroCalificacionId?: string;
}

interface LogroCalificacion {
    _id: string;
    nombre: string;
    porcentaje: number;
    orden?: number;
}

interface LogroBloqueNotas {
    _id: string;
    descripcion: string;
    pesoEnCurso: number;
    orden?: number;
    indicadores: { _id: string; nombre: string; porcentaje: number; orden?: number }[];
}

interface LogrosResponse {
    logros: LogroBloqueNotas[];
    indicadoresPlano: LogroCalificacion[];
    totalPesoLogros: number;
    logrosPesoCompleto: boolean;
}

// Tipos para notas del estudiante (alineados con /api/student/notes y student-notes.tsx)
interface NotaRealStudent {
    assignmentId?: string;
    tareaTitulo?: string;
    nota: number | null;
    fecha: string;
    comentario?: string | null;
    gradingCategoryId?: string;
    categoryWeightPct?: number | null;
}
interface MateriaConNotasStudent {
    _id: string;
    nombre: string;
    groupSubjectId?: string | null;
    notas: NotaRealStudent[];
    promedio: number | null;
    ultimaNota: number | null;
    estado: string;
}
function dedupeNotasStudent(notas: NotaRealStudent[]) {
    const m = new Map<string, NotaRealStudent>();
    for (const n of notas) {
        const id = n.assignmentId || n.tareaTitulo || JSON.stringify(n);
        if (!m.has(id)) m.set(id, n);
    }
    return Array.from(m.values());
}
function computeWeightedPromedioAndUltima(
    materia: MateriaConNotasStudent,
    nestedLogros: LogroBloqueNotas[] | undefined
): { promedioFinal: number | null; ultimaNota: number | null } {
    const notas = materia.notas ?? [];
    const grouped = new Map<string, NotaRealStudent[]>();
    for (const n of notas) {
        const c = n.gradingCategoryId;
        if (!c) continue;
        if (!grouped.has(c)) grouped.set(c, []);
        grouped.get(c)!.push(n);
    }
    const getCat = (lid: string) => {
        const arr = dedupeNotasStudent(grouped.get(lid) ?? []);
        if (!arr.length) return null;
        return weightedGradeWithinLogro(
            arr.map((n) => ({ categoryWeightPct: n.categoryWeightPct })),
            arr.map((n) => (hasRecordedScore(n.nota) ? Number(n.nota) : null))
        );
    };
    const outcomes: OutcomeGradeNode[] = (nestedLogros ?? []).map((L) => ({
        id: L._id,
        pesoEnCurso: L.pesoEnCurso,
        indicadores: (L.indicadores ?? []).map((i) => ({ id: i._id, porcentaje: i.porcentaje })),
    }));
    let promedioFinal: number | null =
        outcomes.length > 0 ? courseGradeFromOutcomes(outcomes, getCat) : null;
    if (promedioFinal == null) {
        const scored = notas.filter((n) => hasRecordedScore(n.nota)).map((n) => Number(n.nota));
        if (scored.length) promedioFinal = scored.reduce((a, b) => a + b, 0) / scored.length;
    }
    if (promedioFinal == null && materia.promedio != null) promedioFinal = materia.promedio;
    if (promedioFinal != null) promedioFinal = Math.round(promedioFinal * 10) / 10;
    let ultimaNota: number | null = null;
    let ultimaMs = 0;
    for (const n of notas) {
        if (!hasRecordedScore(n.nota)) continue;
        const ms = new Date(n.fecha).getTime();
        if (!Number.isNaN(ms) && ms >= ultimaMs) {
            ultimaMs = ms;
            ultimaNota = Number(n.nota);
        }
    }
    return { promedioFinal, ultimaNota };
}

interface CourseSubject {
    _id: string; // ID de la materia (group_subject id cuando viene de for-group)
    nombre: string;
    descripcion?: string;
    colorAcento?: string;
    icono?: string;
    groupSubjectId?: string | null; // desde GET details (estudiante/padre)
    // Campo para el profesor
    profesor?: {
        nombre: string;
    };
    // Campo que el estudiante usa para ver su grupo asignado
    cursoAsignado?: string;
}

interface Student {
    _id: string;
    nombre: string;
    estado: 'excelente' | 'bueno' | 'regular' | 'bajo';
    email?: string;
}

// =========================================================
// 2. FETCHING DE DATOS (CONDICIONAL)
// =========================================================

// Función para obtener la materia detallada (Usado por Estudiante/Padre/Directivo)
const fetchCourseDetails = async (courseId: string): Promise<CourseSubject> => {
    // Asumimos que este endpoint devuelve el detalle de la materia por su ID
    return apiRequest('GET', `/api/courses/${courseId}/details`);
};

// Función para obtener las materias del profesor para un grupo (Usado por Profesor)
const fetchSubjectsForGroup = async (groupId: string): Promise<CourseSubject[]> => {
    // Asumimos que esta ruta devuelve todas las materias que el profesor dicta en ese grupo
    return apiRequest('GET', `/api/courses/for-group/${groupId}`);
};

// Función para obtener tareas (común a todos)
const fetchAssignments = async (id: string, isGroup: boolean, month: number, year: number): Promise<Assignment[]> => {
    const queryParam = isGroup ? `groupId=${id}` : `courseId=${id}`;
    return apiRequest('GET', `/api/assignments?${queryParam}&month=${month}&year=${year}`);
};

// Función para tabla de notas: tareas del grupo + materia (sin filtro de mes)
const fetchGradeTableAssignments = async (groupId: string, courseId: string): Promise<Assignment[]> => {
    return apiRequest('GET', `/api/assignments?groupId=${encodeURIComponent(groupId)}&courseId=${courseId}`);
};

// Función para obtener estudiantes de un grupo (Usado por Profesor)
const fetchStudentsByGroup = async (groupId: string): Promise<Student[]> => {
    try {
        const grupoIdNormalizado = groupId.toUpperCase().trim();
        const response = await apiRequest('GET', `/api/groups/${grupoIdNormalizado}/students`);
        const students = Array.isArray(response) ? response : [];
        return students;
    } catch (error) {
        console.error('Error al obtener estudiantes:', error);
        return [];
    }
};


// =========================================================
// 3. COMPONENTE PRINCIPAL
// =========================================================

export default function CourseDetailPage() {
    const [materiaRouteMatch, materiaRouteParams] = useRoute('/course-detail/:cursoId/materia/:groupSubjectId');
    const [, baseRouteParams] = useRoute('/course-detail/:cursoId');
    const cursoId = (materiaRouteParams?.cursoId || baseRouteParams?.cursoId || '').trim();
    const routeGroupSubjectId = materiaRouteMatch ? materiaRouteParams?.groupSubjectId : undefined;
    const { user } = useAuth();
    const userRole = user?.rol;

    // Normalizar el cursoId para mostrar el nombre del grupo correctamente
    // Si es un ObjectId largo (24 caracteres hexadecimales), mantenerlo como está
    // De lo contrario, normalizar a mayúsculas para mostrar el nombre del grupo
    const displayGroupId = cursoId && cursoId.length === 24 && /^[0-9a-fA-F]{24}$/.test(cursoId)
        ? cursoId // Si es un ObjectId, mantenerlo (aunque no debería pasar para profesores)
        : (cursoId || '').toUpperCase().trim(); // Normalizar a mayúsculas para mostrar

    const isStudent = userRole === 'estudiante';
    const isProfessor = userRole === 'profesor';
    const isPadre = userRole === 'padre';
    const isStudentOrParent = userRole === 'estudiante' || userRole === 'padre';
    const coursesHomeHref =
        userRole === 'directivo' ? '/directivo/cursos'
            : userRole === 'profesor' ? '/profesor/academia/cursos'
                : userRole === 'estudiante' ? '/mi-aprendizaje/cursos'
                    : userRole === 'padre' ? '/parent/materias'
                        : '/courses';
    const coursesHomeLabel = userRole === 'padre' ? 'Materias' : 'Cursos';

    // Nombre legible del grupo (cuando la URL usa UUID, se obtiene del API)
    const { data: groupInfo } = useQuery<{ _id: string; id: string; nombre: string }>({
        queryKey: ['group', cursoId],
        queryFn: () => apiRequest('GET', `/api/groups/${encodeURIComponent(cursoId)}`),
        enabled: isProfessor && !!cursoId,
        staleTime: 5 * 60 * 1000,
    });
    const groupDisplayName = (groupInfo?.nombre?.trim() || displayGroupId) as string;

    const [, setLocation] = useLocation();
    const { toast } = useToast();
    const queryClient = useQueryClient();

    // Redirigir si no es estudiante, profesor ni padre (padre ve solo lectura)
    useEffect(() => {
        if (user && !isStudent && !isProfessor && !isPadre) {
            toast({
                title: 'Acceso denegado',
                description: 'Solo estudiantes, profesores y padres pueden acceder a esta página.',
                variant: 'destructive'
            });
            setLocation('/courses');
        }
    }, [user, isStudent, isProfessor, isPadre, setLocation, toast]);

    // Estados del Formulario
    const [showAssignmentForm, setShowAssignmentForm] = useState(false);
    /** null = cerrado; elegir si pide entrega; form = datos de la asignación */
    const [assignmentCreationPhase, setAssignmentCreationPhase] = useState<null | 'choose-delivery' | 'form'>(null);
    const [assignmentDeliveryMode, setAssignmentDeliveryMode] = useState<'evo' | 'clase' | 'sin-entrega'>('evo');
    const requiresStudentDelivery = assignmentDeliveryMode === 'evo';
    const isGradableAssignment = assignmentDeliveryMode !== 'sin-entrega';
    const [showStudentsDialog, setShowStudentsDialog] = useState(false);
    const [formData, setFormData] = useState({
        titulo: '',
        descripcion: '',
        fechaEntrega: '',
        courseId: '', // ID de la materia
    });
    const [logroCalificacionId, setLogroCalificacionId] = useState('');
    const [assignmentMaterials, setAssignmentMaterials] = useState<{ type: 'file' | 'link' | 'gdoc'; url: string; fileName?: string }[]>([]);
    // Evo Drive (materiales desde Añadir o crear)
    const [addFromGoogleOpen, setAddFromGoogleOpen] = useState(false);
    const [addFromEvoOpen, setAddFromEvoOpen] = useState(false);
    const [createNewOpen, setCreateNewOpen] = useState(false);
    const [createNewNombre, setCreateNewNombre] = useState('');
    const [createNewType, setCreateNewType] = useState<'doc' | 'slide' | 'sheet'>('doc');
    const [googleSearch, setGoogleSearch] = useState('');
    const [evoLinkUrl, setEvoLinkUrl] = useState('');
    const [evoLinkName, setEvoLinkName] = useState('');
    // Modal opciones de materia (nombre visible + ícono) — solo profesor/admin
    const [optionsModalOpen, setOptionsModalOpen] = useState(false);
    const [optionsDisplayName, setOptionsDisplayName] = useState('');
    const [optionsIcon, setOptionsIcon] = useState('');
    const assignmentPanelRef = useRef<HTMLDivElement>(null);

    // Obtener mes y año actuales
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    // Lógica para determinar si se maneja un grupo (siempre TRUE para el Profesor)
    const isHandlingGroup = isProfessor;

    // Query 1: Detalles de la Materia (Solo para Estudiante desde esta ruta)
    const { data: courseDetails, isLoading: isLoadingDetails, error: courseDetailsError } = useQuery<CourseSubject>({
        queryKey: ['courseDetails', cursoId],
        queryFn: () => fetchCourseDetails(cursoId),
        enabled: isStudent && !!cursoId, // Solo para estudiantes y si hay cursoId
        retry: false, // No reintentar si falla (probablemente es un error de acceso)
        staleTime: 5 * 60 * 1000, // 5 minutos - los detalles de materia no cambian frecuentemente
        gcTime: 10 * 60 * 1000, // 10 minutos de caché
    });

    // Query 2: Materias del Profesor para este Grupo (Habilitada SOLO para Profesor)
    const { data: subjectsForGroup = [], isLoading: isLoadingSubjects } = useQuery<CourseSubject[]>({
        queryKey: ['subjectsForGroup', cursoId],
        queryFn: () => fetchSubjectsForGroup(cursoId),
        enabled: isProfessor,
        staleTime: 5 * 60 * 1000, // 5 minutos
        gcTime: 10 * 60 * 1000, // 10 minutos de caché
        refetchOnWindowFocus: false,
    });

    const professorGroupSubjectId = useMemo(() => {
        if (!isProfessor) return '';
        if (!subjectsForGroup.length) return '';
        if (subjectsForGroup.length === 1) return subjectsForGroup[0]._id;
        if (routeGroupSubjectId && subjectsForGroup.some((s) => s._id === routeGroupSubjectId)) return routeGroupSubjectId;
        return '';
    }, [isProfessor, subjectsForGroup, routeGroupSubjectId]);

    const professorMustPickSubject =
        isProfessor && !isLoadingSubjects && subjectsForGroup.length > 1 && !professorGroupSubjectId;

    useEffect(() => {
        if (!isProfessor || isLoadingSubjects || subjectsForGroup.length <= 1) return;
        if (!routeGroupSubjectId) return;
        if (!subjectsForGroup.some((s) => s._id === routeGroupSubjectId)) {
            toast({ title: 'Materia no encontrada', description: 'Vuelve a elegir una materia del grupo.', variant: 'destructive' });
            setLocation(`/course-detail/${cursoId}`);
        }
    }, [isProfessor, isLoadingSubjects, subjectsForGroup, routeGroupSubjectId, cursoId, setLocation, toast]);

    // Query 3: Tareas del Curso/Grupo
    const assignmentsQueryEnabled =
        !!cursoId && (isProfessor || isStudentOrParent || userRole === 'directivo');

    const { data: assignments = [], isLoading: isLoadingAssignments } = useQuery<Assignment[]>({
        queryKey: ['assignments', cursoId, currentMonth, currentYear],
        queryFn: () => fetchAssignments(cursoId, isHandlingGroup, currentMonth, currentYear),
        enabled: assignmentsQueryEnabled,
        staleTime: 2 * 60 * 1000, // 2 minutos - las tareas pueden cambiar más frecuentemente
        gcTime: 5 * 60 * 1000, // 5 minutos de caché
        refetchOnWindowFocus: false,
    });

    const assignmentsForActiveSubject = useMemo(() => {
        if (!isProfessor || !professorGroupSubjectId) return assignments;
        return assignments.filter((a) => String(a.courseId || '') === String(professorGroupSubjectId));
    }, [assignments, isProfessor, professorGroupSubjectId]);

    // Query 4: Estudiantes del Grupo (Solo para Profesor)
    const { data: students = [], isLoading: isLoadingStudents } = useQuery<Student[]>({
        queryKey: ['students', cursoId],
        queryFn: () => fetchStudentsByGroup(cursoId),
        enabled: isProfessor && !!cursoId,
        staleTime: 5 * 60 * 1000, // 5 minutos
        gcTime: 10 * 60 * 1000, // 10 minutos de caché
        refetchOnWindowFocus: false,
    });

    // groupSubjectId para Evo Send: profesor = materia activa; estudiante = cursoId (materia actual)
    const evoSendGroupSubjectId = isProfessor ? professorGroupSubjectId : (isStudent ? cursoId : null);

    // Botón de opciones de materia: solo profesor asignado o admin (display_name e icon)
    const groupSubjectIdForOptions = isProfessor
        ? professorGroupSubjectId
        : ((courseDetails as CourseSubject | undefined)?.groupSubjectId ?? '');
    const showOptionsButton = (isProfessor && !!professorGroupSubjectId) || (['admin-general-colegio', 'directivo'].includes(user?.rol ?? '') && !!groupSubjectIdForOptions);

    const patchGroupSubjectMutation = useMutation({
        mutationFn: (body: { display_name?: string; icon?: string }) =>
            apiRequest('PATCH', `/api/courses/group-subject/${groupSubjectIdForOptions}`, body),
        onSuccess: () => {
            setOptionsModalOpen(false);
            toast({ title: 'Materia actualizada', description: 'Nombre e ícono guardados.' });
            // Invalidar todas las queries que puedan mostrar nombre/ícono de materias o listados de cursos
            queryClient.invalidateQueries({ queryKey: ['subjectsForGroup'] });
            queryClient.invalidateQueries({ queryKey: ['courseDetails'] });
            queryClient.invalidateQueries({ queryKey: ['studentNotes'] });
            queryClient.invalidateQueries({ queryKey: ['/api/users/me/courses'] });
            queryClient.invalidateQueries({ queryKey: ['/api/courses/all'] });
            queryClient.invalidateQueries({ queryKey: ['/api/student/hijo'] });
            queryClient.invalidateQueries({ queryKey: ['/api/schedule/my-group'] });
            queryClient.invalidateQueries({ queryKey: ['courses'] });
            queryClient.invalidateQueries({ queryKey: ['professorGroups'] });
            queryClient.invalidateQueries({ queryKey: ['professorCourses'] });
            queryClient.invalidateQueries({ queryKey: ['gradeTableAssignments'] });
            queryClient.invalidateQueries({ queryKey: ['group'] });
            queryClient.invalidateQueries({ queryKey: ['evo-send-thread-id'] });
            queryClient.invalidateQueries({ queryKey: ['/api/courses/for-group'] });
            queryClient.invalidateQueries({ queryKey: ['/api/evo-send/courses'] });
            queryClient.invalidateQueries({ queryKey: ['/api/professor/courses'] });
            queryClient.invalidateQueries({ queryKey: ['/api/student/subjects'] });
            queryClient.invalidateQueries({ queryKey: ['studentCourses'] });
            queryClient.invalidateQueries({ queryKey: ['coursesAdmin'] });
        },
        onError: (err: Error) => {
            toast({ title: 'Error', description: err?.message ?? 'No se pudo guardar.', variant: 'destructive' });
        },
    });

    // Al abrir el modal, precargar display_name e icon del group_subject actual (solo al abrir, no mientras está abierto)
    const prevOptionsModalOpen = useRef(false);
    useEffect(() => {
        const justOpened = optionsModalOpen && !prevOptionsModalOpen.current;
        prevOptionsModalOpen.current = optionsModalOpen;
        if (!justOpened || !groupSubjectIdForOptions) return;
        if (isProfessor && subjectsForGroup.length > 0) {
            const subject = subjectsForGroup.find((s) => s._id === groupSubjectIdForOptions) ?? subjectsForGroup[0];
            setOptionsDisplayName(subject.nombre ?? '');
            setOptionsIcon(subject.icono ?? '');
        } else if (courseDetails) {
            setOptionsDisplayName(courseDetails.nombre ?? '');
            setOptionsIcon((courseDetails as CourseSubject).icono ?? '');
        }
    }, [optionsModalOpen, groupSubjectIdForOptions, isProfessor, subjectsForGroup, courseDetails]);

    // Query: threadId de Evo Send para este curso (atajo desde la tarjeta — profesor y estudiante)
    const { data: evoThreadIdData } = useQuery<{ threadId: string }>({
        queryKey: ['evo-send-thread-id', evoSendGroupSubjectId],
        queryFn: () => apiRequest<{ threadId: string }>('GET', `/api/evo-send/thread-id-by-group-subject/${evoSendGroupSubjectId}`),
        enabled: !!evoSendGroupSubjectId,
        staleTime: 5 * 60 * 1000,
    });
    const evoSendThreadId = evoThreadIdData?.threadId;

    // Query 5: Notas del estudiante (para tarjetas Promedio / Última Nota / Estado y pestaña Notas)
    const { data: notesData } = useQuery<{ materias: MateriaConNotasStudent[]; total: number }>({
        queryKey: ['studentNotes', user?.id],
        queryFn: () => apiRequest('GET', '/api/student/notes'),
        enabled: isStudent && !!user?.id,
        staleTime: 0,
    });

    // Materia actual para vista estudiante (match por subject id o por groupSubjectId si la URL es gs id)
    const materiaNotasForStudent = useMemo(() => {
        if (!notesData?.materias?.length || !courseDetails) return null;
        const details = courseDetails as { _id: string };
        return notesData.materias.find(
            (m) => String(m._id) === String(details._id) || String(m.groupSubjectId) === String(cursoId)
        ) ?? null;
    }, [notesData?.materias, courseDetails, cursoId]);

    // Logros para promedio ponderado y pestaña Notas (estudiante); courseId = group_subject id
    const courseIdForStudentLogros = materiaNotasForStudent?.groupSubjectId ?? null;
    const { data: logrosStudentData } = useQuery<LogrosResponse>({
        queryKey: ['/api/logros-calificacion', courseIdForStudentLogros],
        queryFn: () =>
            apiRequest<LogrosResponse>('GET', `/api/logros-calificacion?courseId=${encodeURIComponent(courseIdForStudentLogros || '')}`),
        enabled: isStudent && !!courseIdForStudentLogros,
        staleTime: 5 * 60 * 1000,
    });
    const logrosStudentNested = logrosStudentData?.logros ?? [];
    const indicadoresStudentPlano = logrosStudentData?.indicadoresPlano ?? [];

    // Query 6: Tareas para tabla de notas (grupo + materia, sin filtro mes)
    const { data: assignmentsForTable = [], isLoading: isLoadingGradeTable } = useQuery<Assignment[]>({
        queryKey: ['gradeTableAssignments', cursoId, professorGroupSubjectId],
        queryFn: () => fetchGradeTableAssignments(displayGroupId, professorGroupSubjectId || ''),
        enabled: isProfessor && !!cursoId && !!professorGroupSubjectId,
        staleTime: 2 * 60 * 1000,
        gcTime: 5 * 60 * 1000,
    });

    // Query 7: Logros de calificación para la tabla de notas (materia activa)
    const { data: logrosForTableData, isLoading: isLoadingLogrosForTable } = useQuery<LogrosResponse>({
        queryKey: ['/api/logros-calificacion', professorGroupSubjectId],
        queryFn: () =>
            apiRequest<LogrosResponse>('GET', `/api/logros-calificacion?courseId=${encodeURIComponent(professorGroupSubjectId || '')}`),
        enabled: isProfessor && !!professorGroupSubjectId,
        staleTime: 5 * 60 * 1000,
        gcTime: 10 * 60 * 1000,
    });
    const flatIndicadoresProfesorTabla = useMemo((): LogroCalificacion[] => {
        const nested = logrosForTableData?.logros ?? [];
        const plano = logrosForTableData?.indicadoresPlano ?? [];
        const out: LogroCalificacion[] = [];
        const sortedL = [...nested].sort((a, b) => (a.orden ?? 999) - (b.orden ?? 999));
        for (const L of sortedL) {
            const inds = [...(L.indicadores ?? [])].sort((a, b) => (a.orden ?? 999) - (b.orden ?? 999));
            for (const ind of inds) {
                out.push({ _id: ind._id, nombre: ind.nombre, porcentaje: ind.porcentaje, orden: ind.orden });
            }
        }
        return out.length > 0 ? out : plano;
    }, [logrosForTableData]);

    const outcomeNodesProfesorTabla = useMemo((): OutcomeGradeNode[] => {
        const nested = logrosForTableData?.logros ?? [];
        return nested.map((L) => ({
            id: L._id,
            pesoEnCurso: L.pesoEnCurso,
            indicadores: (L.indicadores ?? []).map((i) => ({ id: i._id, porcentaje: i.porcentaje })),
        }));
    }, [logrosForTableData]);

    // Agrupar asignaciones por indicador (grading_category_id)
    const assignmentsByLogro = useMemo(() => {
        const logrosOrdenados = [...flatIndicadoresProfesorTabla].sort((a, b) => {
            const ordenA = a.orden ?? 999;
            const ordenB = b.orden ?? 999;
            if (ordenA !== ordenB) return ordenA - ordenB;
            return (a.nombre || '').localeCompare(b.nombre || '');
        });
        const grouped: Record<string, { logro: LogroCalificacion; assignments: Assignment[] }> = {};
        logrosOrdenados.forEach((logro) => {
            grouped[logro._id] = { logro, assignments: [] };
        });
        const sinLogro: Assignment[] = [];
        assignmentsForTable.forEach((assignment) => {
            if (assignment.logroCalificacionId) {
                const assignmentLogroId = String(assignment.logroCalificacionId);
                const matchingLogro = logrosOrdenados.find((logro) => String(logro._id) === assignmentLogroId);
                if (matchingLogro && grouped[matchingLogro._id]) {
                    grouped[matchingLogro._id].assignments.push(assignment);
                } else {
                    sinLogro.push(assignment);
                }
            } else {
                sinLogro.push(assignment);
            }
        });
        if (sinLogro.length > 0) {
            grouped['sin-logro'] = {
                logro: { _id: 'sin-logro', nombre: 'Sin categoría', porcentaje: 0, orden: 999 },
                assignments: sinLogro,
            };
        }
        return grouped;
    }, [assignmentsForTable, flatIndicadoresProfesorTabla]);

    /** Obtiene la calificación de un estudiante en una asignación (IDs normalizados a string). */
    const getGradeForTabla = (studentId: string, assignmentId: string): number | string => {
        const aid = String(assignmentId);
        const sid = String(studentId);
        const assignment = assignmentsForTable.find((a) => String(a._id) === aid);
        if (!assignment) return '';
        const subs = assignment.submissions || assignment.entregas || [];
        const sub = subs.find(
            (x: { estudianteId?: { toString?: () => string } }) =>
                x.estudianteId?.toString?.() === sid || (x as { estudianteId?: string }).estudianteId === sid
        );
        const cal = (sub as { calificacion?: number })?.calificacion;
        return cal != null && !Number.isNaN(cal) ? cal : '';
    };

    /** Todas las asignaciones para calcular promedio (misma fuente que tabla completa). */
    const allAssignmentsForPromedio = useMemo(
        () =>
            (Object.values(assignmentsByLogro) as { logro: { _id: string }; assignments: Assignment[] }[])
                .flatMap((g) => g.assignments)
                .sort((a, b) => new Date(a.fechaEntrega).getTime() - new Date(b.fechaEntrega).getTime()),
        [assignmentsByLogro]
    );

    /** Promedio: indicadores dentro de cada logro y peso entre logros (alineado con tabla de notas). */
    const getPromedioForTablaGeneral = (studentId: string): number | string => {
        const getCat = (catId: string): number | null => {
            const grp = assignmentsByLogro[catId];
            if (!grp?.assignments?.length) return null;
            const slots = grp.assignments.map((x) => ({ categoryWeightPct: x.categoryWeightPct ?? null }));
            const scores = grp.assignments.map((a) => {
                const v = getGradeForTabla(studentId, a._id);
                return typeof v === 'number' && !Number.isNaN(v) ? v : null;
            });
            return weightedGradeWithinLogro(slots, scores);
        };

        let course: number | null =
            outcomeNodesProfesorTabla.length > 0 ? courseGradeFromOutcomes(outcomeNodesProfesorTabla, getCat) : null;

        if (course == null) {
            const entries = Object.entries(assignmentsByLogro) as [string, { logro: LogroCalificacion; assignments: Assignment[] }][];
            const flat: { _id: string; porcentaje: number }[] = [];
            for (const [, { logro }] of entries) {
                if (logro._id === 'sin-logro' || (logro.porcentaje ?? 0) <= 0) continue;
                flat.push({ _id: logro._id, porcentaje: logro.porcentaje });
            }
            course = courseWeightedFromLogros(flat, getCat);
        }

        if (course == null) {
            const notas: number[] = [];
            allAssignmentsForPromedio.forEach((a) => {
                const v = getGradeForTabla(studentId, a._id);
                if (typeof v === 'number' && !Number.isNaN(v)) notas.push(v);
            });
            if (notas.length === 0) return '—';
            course = notas.reduce((s, n) => s + n, 0) / notas.length;
        }

        const rounded = Math.round(course * 10) / 10;
        return Number.isNaN(rounded) ? '—' : rounded;
    };

    // Efecto para Profesor (Auto-seleccionar materia en el formulario)
    useEffect(() => {
        if (professorGroupSubjectId && showAssignmentForm) {
            setFormData(prev => ({ ...prev, courseId: professorGroupSubjectId }));
        }
    }, [professorGroupSubjectId, showAssignmentForm]);

    // Query para obtener logros de calificación
    const courseIdForLogros = formData.courseId || professorGroupSubjectId || '';
    const { data: logrosData, isLoading: isLoadingLogros } = useQuery<LogrosResponse>({
        queryKey: ['/api/logros-calificacion', courseIdForLogros],
        queryFn: () =>
            apiRequest('GET', `/api/logros-calificacion?courseId=${encodeURIComponent(courseIdForLogros)}`),
        enabled: !!courseIdForLogros && user?.rol === 'profesor',
    });
    const bloquesForAssignmentSelect = useMemo(() => buildLogroBloquesForSelect(logrosData), [logrosData]);
    const hasIndicadoresForAssignment = countIndicadoresInBloques(bloquesForAssignmentSelect) > 0;

    // Evo Drive: estado de conexión y archivos de Google (para modales en formulario de asignación)
    const { data: googleStatus = { connected: false } } = useQuery<{ connected: boolean }>({
        queryKey: ['evo-drive', 'google-status'],
        queryFn: () => apiRequest('GET', '/api/evo-drive/google/status'),
        enabled: showAssignmentForm,
    });
    interface GoogleDriveFile { id: string; name: string; mimeType?: string; webViewLink?: string; size?: string }
    const { data: googleFilesRes, isLoading: googleFilesLoading, isError: googleFilesError } = useQuery<{ files: GoogleDriveFile[] }>({
        queryKey: ['evo-drive', 'google-files-assign', googleSearch],
        queryFn: () => apiRequest('GET', `/api/evo-drive/google/files?q=${encodeURIComponent(googleSearch)}`),
        enabled: addFromGoogleOpen && !!googleStatus.connected,
        retry: false,
    });
    const googleFilesForAssign = googleFilesRes?.files ?? [];
    const googleDriveDisconnected = !googleStatus.connected || (!!googleStatus.connected && googleFilesError);

    const reconnectGoogleDrive = async () => {
        try {
            const data = await apiRequest<{ url: string }>('GET', '/api/evo-drive/google/auth-url');
            if (data?.url && typeof data.url === 'string') window.location.href = data.url;
            else toast({ title: 'Error', description: 'No se pudo obtener el enlace de conexión.', variant: 'destructive' });
        } catch {
            toast({ title: 'Error', description: 'No se pudo conectar con Google Drive.', variant: 'destructive' });
        }
    };

    // Efecto para resetear el formulario
    useEffect(() => {
        if (!showAssignmentForm) {
            setFormData({ titulo: '', descripcion: '', fechaEntrega: '', courseId: '' });
            setAssignmentCreationPhase(null);
            setAssignmentDeliveryMode('evo');
            setLogroCalificacionId('');
            setAssignmentMaterials([]);
            setAddFromGoogleOpen(false);
            setAddFromEvoOpen(false);
            setCreateNewOpen(false);
            setGoogleSearch('');
            setEvoLinkUrl('');
            setEvoLinkName('');
        }
    }, [showAssignmentForm]);

    // Abrir formulario de nueva asignación si viene desde tabla de notas (?openAssignmentForm=1&logroId=...)
    useEffect(() => {
        if (!cursoId || !isProfessor) return;
        const params = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
        if (params.get('openAssignmentForm') === '1') {
            setShowAssignmentForm(true);
            // Mismo flujo que el botón «Nueva Asignación» del detalle: primero elegir tipo de entrega
            setAssignmentCreationPhase('choose-delivery');
            setAssignmentDeliveryMode('evo');
            const logroId = params.get('logroId');
            if (logroId) setLogroCalificacionId(logroId);
            // Limpiar query para no reabrir al recargar (conservar ?t= trimestre y demás)
            const url = new URL(window.location.href);
            url.searchParams.delete('openAssignmentForm');
            url.searchParams.delete('logroId');
            window.history.replaceState({}, '', url.pathname + (url.search || ''));
        }
    }, [cursoId, isProfessor]);

    // Mutation (Crear Asignación; opcional: material vinculado + materiales adjuntos)
    const createAssignmentMutation = useMutation({
        mutationFn: async (payload: { data: typeof formData; newMaterialTitle?: string; materials?: { type: 'file' | 'link' | 'gdoc'; url: string; fileName?: string }[] }) => {
            const { data, newMaterialTitle: materialTitle, materials = [] } = payload;
            if (!data.courseId) throw new Error('Debes seleccionar una materia');
            const needsLogro = countIndicadoresInBloques(buildLogroBloquesForSelect(logrosData)) > 0;
            if (needsLogro && !logroCalificacionId) {
                throw new Error('Debes seleccionar el logro de calificación para esta asignación');
            }
            const tParam =
                typeof window !== 'undefined'
                    ? new URLSearchParams(window.location.search).get('t')
                    : null;
            const trimestreCreacion =
                tParam === '1' || tParam === '2' || tParam === '3' ? Number(tParam) : 1;
            const created = await apiRequest<{ _id: string }>('POST', '/api/assignments', {
                titulo: data.titulo,
                descripcion: data.descripcion,
                curso: cursoId,
                courseId: data.courseId,
                fechaEntrega: data.fechaEntrega,
                categoryId: logroCalificacionId || undefined,
                logroCalificacionId: logroCalificacionId || undefined,
                requiresSubmission: requiresStudentDelivery,
                isGradable: isGradableAssignment,
                trimestre: trimestreCreacion,
            });
            if (materialTitle?.trim()) {
                try {
                    await apiRequest('POST', '/api/materials', { assignmentId: created._id, titulo: materialTitle.trim() });
                } catch (_) { }
            }
            for (const m of materials) {
                try {
                    await apiRequest('POST', '/api/assignment-materials', { assignmentId: created._id, type: m.type, url: m.url, fileName: m.fileName });
                } catch (_) { }
            }
            return created;
        },
        onSuccess: () => {
            toast({ title: '¡Asignación creada!', description: 'La asignación ha sido asignada al curso exitosamente.' });
            // Refrescar todas las vistas que consumen tareas (calendario del curso, listas, etc.)
            queryClient.invalidateQueries({
                predicate: (q) => {
                    const key = q.queryKey as unknown[];
                    return key[0] === 'assignments' && key.includes(cursoId);
                },
            });
            queryClient.invalidateQueries({ queryKey: ['teacherAssignments'] });
            queryClient.invalidateQueries({ queryKey: ['gradeTableAssignments'] });
            queryClient.invalidateQueries({ queryKey: ['materials'] });
            queryClient.invalidateQueries({ queryKey: ['teacherMisAsignaciones'] });
            setFormData({ titulo: '', descripcion: '', fechaEntrega: '', courseId: '' });
            setLogroCalificacionId('');
            setAssignmentMaterials([]);
            setShowAssignmentForm(false);
        },
        onError: (error: any) => {
            toast({ title: 'Error', description: error.message || 'No se pudo crear la asignación', variant: 'destructive' });
        },
    });

    // Crear Doc/Slide/Sheet en Google desde formulario de asignación (Evo Drive) y añadir enlace a materiales
    const createNewDocForAssignMutation = useMutation({
        mutationFn: async (payload: { nombre: string; tipo: 'doc' | 'slide' | 'sheet'; cursoId: string; cursoNombre: string }) => {
            const groupSubjectId = professorGroupSubjectId || '';
            return apiRequest<{ googleWebViewLink?: string; nombre?: string }>('POST', '/api/evo-drive/google/create', {
                nombre: payload.nombre,
                tipo: payload.tipo,
                cursoId: payload.cursoId,
                cursoNombre: payload.cursoNombre,
                groupSubjectId: groupSubjectId || undefined,
            });
        },
        onSuccess: (data, variables) => {
            const url = data?.googleWebViewLink;
            if (url) {
                setAssignmentMaterials((prev) => [...prev, { type: 'gdoc', url, fileName: data?.nombre || variables.nombre }]);
                toast({ title: 'Documento creado', description: 'Se añadió el enlace a los materiales de la asignación.' });
            }
            setCreateNewOpen(false);
            setCreateNewNombre('');
        },
        onError: (e: Error) => {
            toast({ title: 'Error', description: e.message || 'No se pudo crear el documento.', variant: 'destructive' });
        },
    });

    const updateGradeMutation = useMutation({
        mutationFn: async ({ assignmentId, estudianteId, calificacion }: { assignmentId: string; estudianteId: string; calificacion: number | null }) => {
            return apiRequest('PUT', `/api/assignments/${assignmentId}/grade`, {
                estudianteId,
                calificacion: calificacion != null ? Math.min(100, Math.max(0, Number(calificacion))) : null,
                manualOverride: true,
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['gradeTableAssignments', cursoId, professorGroupSubjectId] });
            queryClient.invalidateQueries({ queryKey: ['assignments', cursoId] });
        },
        onError: (err: Error) => {
            toast({ title: 'Error', description: err.message || 'No se pudo actualizar la nota', variant: 'destructive' });
        },
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        createAssignmentMutation.mutate({ data: formData, materials: assignmentMaterials });
    };

    // Evo Drive: añadir archivo de Google a materiales de la asignación (solo enlace, no se registra en Evo Drive)
    const handleAddFromGoogleAssign = (gfile: GoogleDriveFile) => {
        const url = gfile.webViewLink || `https://drive.google.com/file/d/${gfile.id}/view`;
        setAssignmentMaterials((prev) => [...prev, { type: 'gdoc', url, fileName: gfile.name }]);
        setAddFromGoogleOpen(false);
        setGoogleSearch('');
        toast({ title: 'Enlace añadido', description: 'Se añadió el archivo a los materiales de la asignación.' });
    };

    const handleAddFromEvoAssign = () => {
        const url = evoLinkUrl.trim();
        const name = evoLinkName.trim();
        if (!url) return;
        const type = url.includes('docs.google.com') ? 'gdoc' : 'link';
        setAssignmentMaterials((prev) => [...prev, { type, url, fileName: name || url.split('/').pop() || undefined }]);
        setAddFromEvoOpen(false);
        setEvoLinkUrl('');
        setEvoLinkName('');
        toast({ title: 'Enlace añadido', description: 'Se añadió a los materiales de la asignación.' });
    };

    const handleCreateNewDocForAssign = () => {
        if (!createNewNombre.trim() || !cursoId || !groupDisplayName) return;
        createNewDocForAssignMutation.mutate({
            nombre: createNewNombre.trim(),
            tipo: createNewType,
            cursoId,
            cursoNombre: groupDisplayName,
        });
    };

    const handleDayClick = (assignment: Assignment) => {
        setLocation(`/assignment/${assignment._id}`);
    };
    const handleEmptyDayClick = (date: Date) => {
        if (!isProfessor) return;
        const selectedDate = new Date(date);
        const yyyy = selectedDate.getFullYear();
        const mm = String(selectedDate.getMonth() + 1).padStart(2, '0');
        const dd = String(selectedDate.getDate()).padStart(2, '0');
        // datetime-local requiere fecha y hora (sin solo YYYY-MM-DD el control puede quedar vacío)
        setFormData((prev) => ({ ...prev, fechaEntrega: `${yyyy}-${mm}-${dd}T23:59` }));
        setShowAssignmentForm(true);
        setAssignmentCreationPhase('form');
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                assignmentPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            });
        });
    };

    // --------------------------------------------------
    // Vistas por Rol
    // --------------------------------------------------

    // Función auxiliar para obtener el color del estado
    const getEstadoColor = (estado?: string) => {
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


    const professorDetailBasePath =
        subjectsForGroup.length > 1 && professorGroupSubjectId
            ? `/course-detail/${cursoId}/materia/${professorGroupSubjectId}`
            : `/course-detail/${cursoId}`;

    const renderProfessorSubjectPicker = () => (
        <div className="max-w-4xl mx-auto">
            <Breadcrumb
                className="mb-4"
                items={[
                    { label: 'Dashboard', href: '/dashboard' },
                    { label: 'Academia', href: '/profesor/academia' },
                    { label: coursesHomeLabel, href: coursesHomeHref },
                    { label: `Grupo ${groupDisplayName}` },
                ]}
            />
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2 font-['Poppins']">
                Grupo {groupDisplayName}
            </h2>
            <p className="text-white/60 mb-8">
                Dictas más de una materia en este curso. Elige cuál quieres gestionar (cada una tiene sus tareas, notas y calendario por separado).
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {subjectsForGroup.map((s, idx) => {
                    const hue = ['#1e3cff', '#10b981', '#8b5cf6', '#f59e0b', '#ec4899'][idx % 5];
                    return (
                        <Card
                            key={s._id}
                            className="bg-gradient-to-br from-white/10 to-white/5 border-white/20 backdrop-blur-xl cursor-pointer group shadow-lg hover:shadow-xl transition-all hover:scale-[1.02]"
                            style={{ boxShadow: `0 0 0 1px ${hue}33` }}
                            onClick={() => setLocation(`/course-detail/${cursoId}/materia/${s._id}`)}
                        >
                            <CardHeader className="text-center pb-2">
                                <div
                                    className="w-20 h-20 mx-auto mb-4 rounded-3xl flex items-center justify-center text-4xl group-hover:scale-110 transition-transform"
                                    style={{ backgroundColor: `${hue}22`, borderWidth: 2, borderColor: `${hue}55` }}
                                >
                                    {s.icono?.trim() ? (
                                        <span className="leading-none" aria-hidden>
                                            {s.icono.trim()}
                                        </span>
                                    ) : (
                                        <BookOpen className="w-10 h-10 text-white" />
                                    )}
                                </div>
                                <CardTitle className="text-white text-2xl font-bold font-['Poppins']">{s.nombre}</CardTitle>
                                <CardDescription className="text-white/60">Gestionar esta materia en el grupo {groupDisplayName}</CardDescription>
                            </CardHeader>
                            <CardContent className="flex justify-center pb-6">
                                <span className="text-sm font-medium flex items-center gap-2" style={{ color: hue }}>
                                    Entrar <ArrowRight className="w-4 h-4" />
                                </span>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>
        </div>
    );

    // 🎯 Vista para Profesor (Gestión de Grupo + materia activa)
    const renderProfessorView = () => {
        // No bloquear el shell en estudiantes: la tarjeta y el diálogo muestran estado local de carga
        const loading = isLoadingSubjects || isLoadingAssignments;
        const subjects = subjectsForGroup;
        const activeSubject = subjects.find((s) => s._id === professorGroupSubjectId) ?? subjects[0];
        const activeSubjectNombre = activeSubject?.nombre ?? '';
        const subjectsForForm = professorGroupSubjectId
            ? subjects.filter((s) => s._id === professorGroupSubjectId)
            : subjects;

        if (loading) {
            return <div className="space-y-4"><Skeleton className="h-10 w-full bg-white/10" /><Skeleton className="h-96 w-full bg-white/10" /></div>;
        }

        const subjectForOptions = groupSubjectIdForOptions
            ? (subjects.find((s) => s._id === groupSubjectIdForOptions) ?? subjects[0])
            : subjects[0];
        const openOptionsModal = () => {
            setOptionsDisplayName(subjectForOptions?.nombre ?? '');
            setOptionsIcon(subjectForOptions?.icono ?? '');
            setOptionsModalOpen(true);
        };

        return (
            <>
                <div className="mb-8 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                    <div>
                        <div className="flex items-center gap-2 flex-wrap">
                                    <Breadcrumb
                                        items={[
                                            { label: 'Dashboard', href: '/dashboard' },
                                            ...(isProfessor ? [{ label: 'Academia', href: '/profesor/academia' }] : []),
                                            { label: coursesHomeLabel, href: coursesHomeHref },
                                            ...(subjects.length > 1
                                                ? [
                                                      {
                                                          label: `Grupo ${groupDisplayName}`,
                                                          href: `/course-detail/${cursoId}`,
                                                      },
                                                      { label: activeSubjectNombre || 'Materia' },
                                                  ]
                                                : [{ label: `Grupo ${groupDisplayName}` }]),
                                        ]}
                                    />
                        </div>
                        <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-white mb-2 font-['Poppins'] break-words mt-2">
                            {activeSubjectNombre ? (
                                <>
                                    <span className="text-[#00c8ff]">{activeSubjectNombre}</span>
                                    <span className="text-white/50 font-normal text-lg sm:text-xl"> · Grupo {groupDisplayName}</span>
                                </>
                            ) : (
                                <>Gestión del Grupo {groupDisplayName}</>
                            )}
                        </h2>
                    </div>
                    {showOptionsButton && (
                        <Button
                            variant="outline"
                            size="sm"
                            className="border-white/20 text-white/90 hover:bg-white/10 sm:mt-1 self-start sm:self-start sm:ml-auto"
                            onClick={openOptionsModal}
                        >
                            <Settings className="w-4 h-4 mr-1" />
                            Opciones de materia
                        </Button>
                    )}
                </div>

                {/* 6 Tarjetas: Fila 1 — Estudiantes, Tareas, Notas. Fila 2 — Asistencia, Evo Send, Evo Drive */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-8 max-w-6xl mx-auto">
                    {/* Carta 1: Estudiantes */}
                    <Card
                        className="bg-gradient-to-br from-white/10 to-white/5 border-white/20 backdrop-blur-xl hover:from-white/15 hover:to-white/10 transition-all cursor-pointer group shadow-lg hover:shadow-xl hover:shadow-[#1e3cff]/20"
                        onClick={() => {
                            const q = new URLSearchParams();
                            q.set('returnTo', professorDetailBasePath);
                            if (professorGroupSubjectId) q.set('gs', professorGroupSubjectId);
                            setLocation(`/course-detail/${cursoId}/estudiantes?${q.toString()}`);
                        }}
                    >
                        <CardHeader className="text-center pb-4">
                            <div className="w-20 h-20 mx-auto mb-4 rounded-3xl bg-gradient-to-br from-[#1e3cff] via-[#002366] to-[#00c8ff] flex items-center justify-center group-hover:scale-110 group-hover:rotate-3 transition-all duration-300 shadow-lg shadow-[#1e3cff]/30">
                                <Users className="w-10 h-10 text-white" />
                            </div>
                            <CardTitle className="text-white text-3xl font-bold font-['Poppins'] mb-2">Estudiantes</CardTitle>
                            <CardDescription className="text-white/70 text-lg">
                                {isLoadingStudents ? (
                                    <span className="text-white/50">Cargando estudiantes…</span>
                                ) : (
                                    <>
                                        {students.length} {students.length === 1 ? 'estudiante' : 'estudiantes'} registrados
                                    </>
                                )}
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="text-center pt-0" />
                    </Card>

                    {/* Carta 2: Tareas */}
                    <Card
                        className="bg-gradient-to-br from-white/10 to-white/5 border-white/20 backdrop-blur-xl hover:from-white/15 hover:to-white/10 transition-all cursor-pointer group shadow-lg hover:shadow-xl hover:shadow-orange-500/20"
                        onClick={() => {
                            const q = new URLSearchParams();
                            if (professorGroupSubjectId) q.set('materiaId', professorGroupSubjectId);
                            q.set('returnTo', professorDetailBasePath);
                            const qs = q.toString();
                            setLocation(`/profesor/cursos/${cursoId}/tareas${qs ? `?${qs}` : ''}`);
                        }}
                    >
                        <CardHeader className="text-center pb-4">
                            <div className="w-20 h-20 mx-auto mb-4 rounded-3xl bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-500 flex items-center justify-center group-hover:scale-110 group-hover:rotate-3 transition-all duration-300 shadow-lg shadow-violet-500/30">
                                <ClipboardList className="w-10 h-10 text-white" />
                            </div>
                            <CardTitle className="text-white text-3xl font-bold font-['Poppins'] mb-2">Asignaciones</CardTitle>
                            <CardDescription className="text-white/70 text-lg">
                                {assignmentsForActiveSubject.length}{' '}
                                {assignmentsForActiveSubject.length === 1 ? 'tarea' : 'tareas'} en esta materia
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="text-center pt-0" />
                    </Card>

                    {/* Carta 3: Notas — tabla de calificaciones del grupo */}
                    <Card
                        className="bg-gradient-to-br from-white/10 to-white/5 border-white/20 backdrop-blur-xl hover:from-white/15 hover:to-white/10 transition-all cursor-pointer group shadow-lg hover:shadow-xl hover:shadow-[#3B82F6]/20"
                        onClick={() =>
                            setLocation(
                                `/course/${cursoId}/grades?${new URLSearchParams({
                                    ...(professorGroupSubjectId ? { gs: professorGroupSubjectId } : {}),
                                    returnTo: professorDetailBasePath,
                                }).toString()}`
                            )
                        }
                    >
                        <CardHeader className="text-center pb-4">
                            <div className="w-20 h-20 mx-auto mb-4 rounded-3xl bg-gradient-to-br from-amber-500 via-[#ffd700] to-yellow-400 flex items-center justify-center group-hover:scale-110 group-hover:rotate-3 transition-all duration-300 shadow-lg shadow-amber-500/30">
                                <Award className="w-10 h-10 text-white" />
                            </div>
                            <CardTitle className="text-white text-3xl font-bold font-['Poppins'] mb-2">Notas</CardTitle>
                            <CardDescription className="text-white/70 text-lg">
                                Ver y editar tabla de calificaciones
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="text-center pt-0" />
                    </Card>

                    {/* Carta 4: Asistencia */}
                    <Card
                        className="bg-gradient-to-br from-white/10 to-white/5 border-white/20 backdrop-blur-xl hover:from-white/15 hover:to-white/10 transition-all cursor-pointer group shadow-lg hover:shadow-xl hover:shadow-emerald-500/20"
                        onClick={() =>
                            setLocation(
                                `/course/${cursoId}/asistencia?returnTo=${encodeURIComponent(professorDetailBasePath)}&materiaNombre=${encodeURIComponent(activeSubjectNombre || '')}`
                            )
                        }
                    >
                        <CardHeader className="text-center pb-4">
                            <div className="w-20 h-20 mx-auto mb-4 rounded-3xl bg-gradient-to-br from-[#059669] via-[#10B981] to-emerald-400 flex items-center justify-center group-hover:scale-110 group-hover:rotate-3 transition-all duration-300 shadow-lg shadow-emerald-500/30">
                                <CheckCircle className="w-10 h-10 text-white" />
                            </div>
                            <CardTitle className="text-white text-3xl font-bold font-['Poppins'] mb-2">Asistencia</CardTitle>
                            <CardDescription className="text-white/70 text-lg">
                                Registrar asistencia del grupo
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="text-center pt-0" />
                    </Card>

                    {/* Carta 5: Evo Send — atajo al chat del curso */}
                    <Card
                        className="bg-gradient-to-br from-white/10 to-white/5 border-white/20 border-red-500/30 backdrop-blur-xl hover:from-white/15 hover:to-white/10 transition-all cursor-pointer group shadow-lg hover:shadow-xl hover:shadow-red-500/20"
                        onClick={() => {
                            try {
                                sessionStorage.setItem('evo-send-return-path', professorDetailBasePath);
                            } catch {
                                /* ignore */
                            }
                            const params = new URLSearchParams();
                            if (evoSendThreadId) params.set('thread', evoSendThreadId);
                            setLocation(params.toString() ? `/evo-send?${params.toString()}` : '/evo-send');
                        }}
                    >
                        <CardHeader className="text-center pb-4">
                            <div className="w-20 h-20 mx-auto mb-4 rounded-3xl bg-gradient-to-br from-red-500 via-red-600 to-rose-500 flex items-center justify-center group-hover:scale-110 group-hover:rotate-3 transition-all duration-300 shadow-lg shadow-red-500/30">
                                <Send className="w-10 h-10 text-white" />
                            </div>
                            <CardTitle className="text-white text-3xl font-bold font-['Poppins'] mb-2">Evo Send</CardTitle>
                            <CardDescription className="text-white/70 text-lg">
                                Chat del curso, tipo WhatsApp
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="text-center pt-0" />
                    </Card>

                    {/* Carta 6: Evo Drive */}
                    <Card
                        className="bg-gradient-to-br from-white/10 to-white/5 border-white/20 border-sky-400/30 backdrop-blur-xl hover:from-white/15 hover:to-white/10 transition-all cursor-pointer group shadow-lg hover:shadow-xl hover:shadow-sky-400/20"
                        onClick={() => setLocation('/evo-drive')}
                    >
                        <CardHeader className="text-center pb-4">
                            <div className="w-20 h-20 mx-auto mb-4 rounded-3xl bg-gradient-to-br from-sky-400 via-[#00c8ff] to-cyan-300 flex items-center justify-center group-hover:scale-110 group-hover:rotate-3 transition-all duration-300 shadow-lg shadow-sky-400/30">
                                <FolderOpen className="w-10 h-10 text-white" />
                            </div>
                            <CardTitle className="text-white text-3xl font-bold font-['Poppins'] mb-2">Evo Drive</CardTitle>
                            <CardDescription className="text-white/70 text-lg">
                                Acceder al drive de la plataforma
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="text-center pt-0" />
                    </Card>
                </div>


                {/* Calendario: carga total del grupo (todas las materias); la lista de asignaciones debajo sigue siendo por materia activa */}
                {renderCalendarAndAssignmentList(
                    assignments,
                    `Grupo ${groupDisplayName} · todas las materias`
                )}

                {/* Botones de acción y Formulario para asignar asignación (Movido debajo del calendario) */}
                <div ref={assignmentPanelRef} className="scroll-mt-24">
                    <div className="flex flex-row items-center justify-between gap-4 mb-6 mt-8 flex-wrap">
                        <div>
                            <h2 className="text-2xl font-bold text-white font-['Poppins'] tracking-tight">Asignaciones</h2>
                            <p className="text-white/60 text-sm mt-0.5">
                                {activeSubjectNombre ? `${activeSubjectNombre} · ` : ''}Grupo {groupDisplayName}
                            </p>
                        </div>
                        <Button
                            onClick={() => {
                                if (showAssignmentForm) {
                                    setShowAssignmentForm(false);
                                } else {
                                    setShowAssignmentForm(true);
                                    setAssignmentCreationPhase('choose-delivery');
                                }
                            }}
                            className="bg-gradient-to-r from-[#002366] to-[#1e3cff] hover:opacity-90 transition-opacity duration-150 ease-in-out rounded-xl px-5 py-2.5"
                            data-testid="button-assign-task"
                        >
                            <ClipboardList className="w-4 h-4 mr-2" />
                            {showAssignmentForm ? 'Cancelar' : 'Nueva Asignación'}
                        </Button>
                    </div>

                    {showAssignmentForm && (
                    <Card className="bg-[#0a0a2a]/80 border border-white/10 backdrop-blur-md mb-8 rounded-[14px] shadow-xl transition-colors duration-150 ease-in-out">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-white text-xl font-semibold font-['Poppins']">Nueva asignación</CardTitle>
                            <p className="text-white/50 text-sm mt-0.5">Actividad para el curso (con o sin entrega de los estudiantes)</p>
                        </CardHeader>
                        <CardContent className="pt-4">
                            {assignmentCreationPhase === 'choose-delivery' ? (
                                <div className="space-y-4">
                                    <p className="text-white/80 mb-2 font-medium">¿Los estudiantes deben entregar esta actividad?</p>
                                    <p className="text-white/50 text-sm mb-4">
                                        Si eliges <strong className="text-white/80">No</strong>, la tarea aparece en el calendario como cualquier otra, pero no podrán subir entrega ni se calificará por entrega.
                                    </p>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <Button
                                            type="button"
                                            onClick={() => {
                                                setAssignmentDeliveryMode('evo');
                                                setAssignmentCreationPhase('form');
                                            }}
                                            className="h-32 flex flex-col items-center justify-center gap-3 bg-gradient-to-br from-[#1e3cff]/25 to-[#002366]/25 border border-[#1e3cff]/50 hover:from-[#1e3cff]/35 hover:to-[#002366]/35 rounded-[12px] transition-all duration-150 ease-in-out"
                                        >
                                            <ClipboardList className="w-8 h-8 text-[#00c8ff]" />
                                            <span className="text-white font-semibold">Sí requiere entrega en Evo</span>
                                            <span className="text-white/60 text-xs leading-snug text-center px-1 whitespace-normal max-w-full">Los estudiantes envían archivos o texto y se puede calificar la entrega.</span>
                                        </Button>
                                        <Button
                                            type="button"
                                            onClick={() => {
                                                setAssignmentDeliveryMode('clase');
                                                setAssignmentCreationPhase('form');
                                            }}
                                            className="h-32 flex flex-col items-center justify-center gap-3 bg-gradient-to-br from-white/10 to-white/5 border border-white/20 hover:bg-white/10 rounded-[12px] transition-all duration-150 ease-in-out"
                                        >
                                            <FileText className="w-8 h-8 text-white/80" />
                                            <span className="text-white font-semibold">Entrega en Clase</span>
                                            <span className="text-white/60 text-xs leading-snug text-center px-1 whitespace-normal max-w-full">No se sube en la plataforma; el docente puede calificar en clase.</span>
                                        </Button>
                                        <Button
                                            type="button"
                                            onClick={() => {
                                                setAssignmentDeliveryMode('sin-entrega');
                                                setAssignmentCreationPhase('form');
                                            }}
                                            className="h-32 flex flex-col items-center justify-center gap-3 bg-gradient-to-br from-white/10 to-white/5 border border-white/20 hover:bg-white/10 rounded-[12px] transition-all duration-150 ease-in-out"
                                        >
                                            <FileText className="w-8 h-8 text-white/80" />
                                            <span className="text-white font-semibold">No requiere entrega</span>
                                            <span className="text-white/60 text-xs leading-snug text-center px-1 whitespace-normal max-w-full">Solo aviso o actividad informativa; sin entrega ni calificación.</span>
                                        </Button>
                                    </div>
                                </div>
                            ) : assignmentCreationPhase === 'form' ? (
                                <>
                                    <div className="flex items-center justify-between mb-6 flex-wrap gap-2">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <Badge className="bg-[#1e3cff]/20 text-white border border-[#1e3cff]/40 rounded-[10px]">
                                                Asignación
                                            </Badge>
                                            <Badge
                                                className={requiresStudentDelivery
                                                    ? 'bg-emerald-500/20 text-emerald-200 border-emerald-500/40'
                                                    : 'bg-white/10 text-white/80 border-white/25'}
                                            >
                                                {assignmentDeliveryMode === 'evo'
                                                    ? 'Con entrega en Evo'
                                                    : assignmentDeliveryMode === 'clase'
                                                        ? 'Entrega en clase'
                                                        : 'Sin entrega'}
                                            </Badge>
                                        </div>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => setAssignmentCreationPhase('choose-delivery')}
                                            className="text-white/70 hover:text-white rounded-[10px]"
                                        >
                                            <X className="w-4 h-4 mr-1" />
                                            Cambiar
                                        </Button>
                                    </div>

                                    {subjectsForForm.length === 0 && (
                                        <Alert className="mb-4 bg-red-500/10 border-red-500/50">
                                            <AlertCircle className="h-4 w-4 text-red-400" />
                                            <AlertDescription className="text-red-200">
                                                No tienes materias asignadas a este curso ({displayGroupId}). Por favor contacta al administrador.
                                            </AlertDescription>
                                        </Alert>
                                    )}

                                    <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-8 items-start">
                                        {/* Columna izquierda: contenido principal */}
                                        <div className="space-y-6">
                                            <div>
                                                <Label htmlFor="titulo" className="text-white text-xs font-medium uppercase tracking-wider text-white/70">Nombre</Label>
                                                <Input id="titulo" value={formData.titulo} onChange={(e) => setFormData({ ...formData, titulo: e.target.value })} required className="mt-1.5 text-lg font-semibold text-white bg-transparent border-0 border-b border-white/10 rounded-none px-0 py-3 focus-visible:ring-0 focus-visible:border-[#4DBBFF]/50 placeholder:text-white/40 transition-colors duration-150 ease-in-out" placeholder="Nombre de la tarea" />
                                            </div>
                                            <div>
                                                <Label htmlFor="instrucciones" className="text-white text-xs font-medium uppercase tracking-wider text-white/70">Instrucciones</Label>
                                                <Textarea id="instrucciones" value={formData.descripcion} onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })} required className="mt-1.5 min-h-[180px] bg-white/[0.04] border border-white/10 rounded-xl text-white placeholder:text-white/40 py-4 px-4 focus-visible:ring-2 focus-visible:ring-[#4DBBFF]/30 focus-visible:border-[#4DBBFF]/40 transition-all duration-150 ease-in-out" placeholder="Instrucciones para el estudiante" rows={6} />
                                            </div>

                                            <div className="space-y-3">
                                                <h3 className="text-sm font-semibold uppercase tracking-wider text-white/90">Materiales (Evo Drive)</h3>
                                                <p className="text-white/50 text-xs">Añade enlaces, archivos de Google Drive o crea documentos nuevos. Se vincularán a esta asignación.</p>
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button type="button" variant="outline" size="sm" className="h-9 rounded-[12px] bg-[#4DBBFF]/[0.13] border-[1.5px] border-[#4DBBFF]/50 text-[#4DBBFF] text-[13px] font-medium hover:bg-[#4DBBFF]/20 hover:border-[#4DBBFF]/60 px-4 transition-all duration-150 ease-in-out">
                                                            <Plus className="w-4 h-4 mr-2" />
                                                            Añadir o crear
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="start" sideOffset={8} className="w-[230px] rounded-[14px] border-[#4DBBFF]/20 bg-[#0f1c35] shadow-xl shadow-black/40 p-0 overflow-hidden">
                                                        <div className="py-2.5">
                                                            <DropdownMenuItem
                                                                onSelect={() => googleStatus.connected && setTimeout(() => setAddFromGoogleOpen(true), 50)}
                                                                disabled={!googleStatus.connected}
                                                                className="flex items-center gap-3 py-2.5 px-4 text-[13px] text-white/90 hover:bg-[#4DBBFF]/10 focus:bg-[#4DBBFF]/10 mx-0 rounded-none"
                                                            >
                                                                <div className="w-8 h-8 rounded-[9px] bg-[#4DBBFF]/20 flex items-center justify-center shrink-0">
                                                                    <Cloud className="w-4 h-4 text-[#4DBBFF]" />
                                                                </div>
                                                                Google Drive
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem
                                                                onSelect={() => setTimeout(() => { setEvoLinkUrl(''); setEvoLinkName(''); setAddFromEvoOpen(true); }, 50)}
                                                                className="flex items-center gap-3 py-2.5 px-4 text-[13px] text-white/90 hover:bg-[#4DBBFF]/10 focus:bg-[#4DBBFF]/10 mx-0 rounded-none"
                                                            >
                                                                <div className="w-8 h-8 rounded-[9px] bg-[#4DBBFF]/20 flex items-center justify-center shrink-0">
                                                                    <Link2 className="w-4 h-4 text-[#4DBBFF]" />
                                                                </div>
                                                                Enlace
                                                            </DropdownMenuItem>
                                                        </div>
                                                        <div className="border-t border-[#4DBBFF]/10" />
                                                        <div className="py-2">
                                                            <p className="px-4 pt-1.5 pb-1 text-[11px] uppercase tracking-wider text-[#4DBBFF]/50">Crear</p>
                                                            <DropdownMenuItem onSelect={() => setTimeout(() => { setCreateNewType('doc'); setCreateNewNombre(''); setCreateNewOpen(true); }, 50)} className="flex items-center gap-3 py-2.5 px-4 text-[13px] text-white/90 hover:bg-[#4DBBFF]/10 focus:bg-[#4DBBFF]/10 mx-0 rounded-none">
                                                                <div className="w-8 h-8 rounded-[9px] bg-[#1a56d6] flex items-center justify-center shrink-0"><FileText className="w-4 h-4 text-white" /></div>
                                                                Documentos
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem onSelect={() => setTimeout(() => { setCreateNewType('slide'); setCreateNewNombre(''); setCreateNewOpen(true); }, 50)} className="flex items-center gap-3 py-2.5 px-4 text-[13px] text-white/90 hover:bg-[#4DBBFF]/10 focus:bg-[#4DBBFF]/10 mx-0 rounded-none">
                                                                <div className="w-8 h-8 rounded-[9px] bg-[#d97706] flex items-center justify-center shrink-0"><Presentation className="w-4 h-4 text-white" /></div>
                                                                Presentaciones
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem onSelect={() => setTimeout(() => { setCreateNewType('sheet'); setCreateNewNombre(''); setCreateNewOpen(true); }, 50)} className="flex items-center gap-3 py-2.5 px-4 text-[13px] text-white/90 hover:bg-[#4DBBFF]/10 focus:bg-[#4DBBFF]/10 mx-0 rounded-none">
                                                                <div className="w-8 h-8 rounded-[9px] bg-[#16a34a] flex items-center justify-center shrink-0"><FileSpreadsheet className="w-4 h-4 text-white" /></div>
                                                                Hojas de cálculo
                                                            </DropdownMenuItem>
                                                        </div>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                                {assignmentMaterials.length > 0 && (
                                                    <ul className="space-y-3 mt-2">
                                                        {assignmentMaterials.map((m, i) => {
                                                            const isGoogle = m.type === 'gdoc';
                                                            const displayName = m.fileName || m.url;
                                                            const u = (m.url || '').toLowerCase();
                                                            const gdocKind = u.includes('spreadsheets') ? 'sheet' : u.includes('presentation') ? 'slide' : 'doc';
                                                            const iconBg = m.type === 'gdoc' ? (gdocKind === 'sheet' ? 'bg-emerald-500/15' : gdocKind === 'slide' ? 'bg-orange-500/15' : 'bg-blue-500/15') : 'bg-white/10';
                                                            const Icon = m.type === 'gdoc' ? (gdocKind === 'sheet' ? FileSpreadsheet : gdocKind === 'slide' ? Presentation : FileText) : Link2;
                                                            const iconColor = m.type === 'gdoc' ? (gdocKind === 'sheet' ? 'text-[#16a34a]' : gdocKind === 'slide' ? 'text-[#d97706]' : 'text-[#1a73e8]') : 'text-white/70';
                                                            return (
                                                                <li key={i} className="group flex items-center justify-between gap-4 py-3 px-4 rounded-[12px] border border-white/10 bg-[#0f172a]/60 hover:bg-white/[0.06] hover:border-[#4DBBFF]/20 transition-all duration-150 ease-in-out">
                                                                    <div className="flex items-center gap-4 min-w-0 flex-1">
                                                                        <div className={`w-[38px] h-[38px] rounded-[10px] flex items-center justify-center shrink-0 ${iconBg}`}>
                                                                            <Icon className={`w-5 h-5 ${iconColor}`} />
                                                                        </div>
                                                                        <div className="min-w-0 flex-1">
                                                                            <p className="text-sm font-medium text-white truncate">{displayName}</p>
                                                                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                                                                                <span className="text-[11px] text-white/60">Material de la asignación</span>
                                                                                {isGoogle && (
                                                                                    <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-medium bg-emerald-500/15 text-emerald-400">Google</span>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                    <div className="flex items-center gap-2 shrink-0">
                                                                        {m.url && (
                                                                            <a href={m.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[11px] font-medium text-[#4DBBFF] hover:underline opacity-0 group-hover:opacity-100 transition-opacity duration-150 ease-in-out">
                                                                                <ExternalLink className="w-3.5 h-3.5" />
                                                                                {isGoogle ? 'Abrir en Drive' : 'Abrir enlace'}
                                                                            </a>
                                                                        )}
                                                                        <Button type="button" variant="ghost" size="sm" className="text-white/70 hover:text-white h-8 w-8 p-0 shrink-0" onClick={() => setAssignmentMaterials((prev) => prev.filter((_, j) => j !== i))} aria-label="Quitar">
                                                                            <X className="w-4 h-4" />
                                                                        </Button>
                                                                    </div>
                                                                </li>
                                                            );
                                                        })}
                                                    </ul>
                                                )}
                                            </div>

                                            <Button type="submit" disabled={createAssignmentMutation.isPending || subjectsForForm.length === 0 || (hasIndicadoresForAssignment && !logroCalificacionId)} className="w-full rounded-xl py-2.5 bg-gradient-to-r from-[#002366] to-[#1e3cff] hover:opacity-90 transition-opacity duration-150 ease-in-out font-medium">
                                                {createAssignmentMutation.isPending ? 'Creando...' : 'Crear Asignación'}
                                            </Button>
                                        </div>

                                        {/* Columna derecha: configuración */}
                                        <div className="rounded-[12px] border border-white/10 bg-white/[0.03] p-5 space-y-5 lg:sticky lg:top-4 transition-colors duration-150 ease-in-out">
                                            <p className="text-xs font-semibold uppercase tracking-wider text-[#4DBBFF]/70">Configuración</p>
                                            {subjectsForForm.length > 1 && (
                                                <div>
                                                    <Label htmlFor="materia" className="text-white text-xs font-medium">Materia *</Label>
                                                    <Select
                                                        value={formData.courseId}
                                                        onValueChange={(value) => {
                                                            setFormData({ ...formData, courseId: value });
                                                            setLogroCalificacionId('');
                                                        }}
                                                        required
                                                    >
                                                        <SelectTrigger className="mt-1.5 bg-white/5 border-white/10 text-white rounded-[10px] transition-colors duration-150 ease-in-out hover:border-white/20"><SelectValue placeholder="Selecciona la materia" /></SelectTrigger>
                                                        <SelectContent>
                                                            {subjectsForForm.map((subject) => (
                                                                <SelectItem key={subject._id} value={subject._id}>{subject.nombre}</SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                            )}
                                            {subjectsForForm.length === 1 && (
                                                <div>
                                                    <Label className="text-white text-xs font-medium mb-2 block">Materia</Label>
                                                    <div className="flex items-center gap-2">
                                                        <Badge className="bg-[#1e3cff]/20 text-white border border-[#1e3cff]/40 text-base px-4 py-2 rounded-[10px]">
                                                            {subjectsForForm[0].nombre}
                                                        </Badge>
                                                        <span className="text-white/50 text-sm">(esta vista)</span>
                                                    </div>
                                                </div>
                                            )}
                                            {hasIndicadoresForAssignment && (
                                                <div>
                                                    <Label className="text-white text-xs font-medium mb-2 block">Logro de calificación *</Label>
                                                    <LogroIndicadorSelects
                                                        bloques={bloquesForAssignmentSelect}
                                                        indicadorId={logroCalificacionId}
                                                        onIndicadorIdChange={setLogroCalificacionId}
                                                        variant="dark"
                                                    />
                                                </div>
                                            )}
                                            {!hasIndicadoresForAssignment && courseIdForLogros && !isLoadingLogros && (
                                                <Alert className="bg-amber-500/10 border-amber-500/50 rounded-[10px]">
                                                    <AlertCircle className="h-4 w-4 text-amber-400" />
                                                    <AlertDescription className="text-amber-200">
                                                        Configura los logros de calificación para esta materia antes de crear asignaciones. Ve a{' '}
                                                        <Button
                                                            variant="link"
                                                            className="p-0 h-auto text-amber-300 underline"
                                                            onClick={() => {
                                                                const q = new URLSearchParams();
                                                                q.set('returnTo', professorDetailBasePath);
                                                                if (professorGroupSubjectId) q.set('gs', professorGroupSubjectId);
                                                                setLocation(`/course/${cursoId}/calificacion-logros?${q.toString()}`);
                                                            }}
                                                        >
                                                            Logros de Calificación
                                                        </Button>
                                                    </AlertDescription>
                                                </Alert>
                                            )}
                                            <div>
                                                <Label htmlFor="fechaEntrega" className="text-white text-xs font-medium">Fecha de Entrega</Label>
                                                <Input id="fechaEntrega" type="datetime-local" value={formData.fechaEntrega} onChange={(e) => setFormData({ ...formData, fechaEntrega: e.target.value })} required className="mt-1.5 bg-white/5 border-white/10 text-white rounded-[10px] transition-colors duration-150 ease-in-out hover:border-white/20" />
                                            </div>
                                        </div>
                                    </form>
                                </>
                            ) : null}
                        </CardContent>
                    </Card>
                    )}
                </div>

                {/* Modales Evo Drive (materiales de la asignación) */}
                <Dialog open={addFromGoogleOpen} onOpenChange={setAddFromGoogleOpen}>
                    <DialogContent className="bg-white/5 border border-white/10 max-w-[380px] rounded-2xl p-6 shadow-xl overflow-hidden">
                        <DialogHeader>
                            <DialogTitle className="text-white flex items-center gap-3">
                                <div className="w-10 h-10 rounded-[11px] bg-[#4DBBFF]/20 flex items-center justify-center shrink-0"><Cloud className="w-5 h-5 text-[#4DBBFF]" /></div>
                                <div>
                                    <span className="text-base font-semibold text-white block">Agregar desde Google Drive</span>
                                    <span className="text-xs text-white/60 mt-0.5 block">Selecciona un archivo para vincular a la asignación</span>
                                </div>
                            </DialogTitle>
                        </DialogHeader>
                        {googleDriveDisconnected ? (
                            <div className="space-y-4 py-2">
                                <p className="text-white/60 text-sm">
                                    {googleFilesError ? 'Google Drive se desconectó. Reconéctalo para seguir usando tus archivos.' : 'Conecta Google Drive para agregar archivos desde tu cuenta.'}
                                </p>
                                <Button
                                    type="button"
                                    onClick={reconnectGoogleDrive}
                                    className="w-full rounded-xl border border-[#22c55e]/40 bg-[#22c55e]/10 text-[#22c55e] hover:bg-[#22c55e]/20 font-medium"
                                >
                                    <Cloud className="w-4 h-4 mr-2" />
                                    Reconectar Google Drive
                                </Button>
                                <p className="text-white/40 text-xs">Serás redirigido a Google y volverás aquí sin cerrar sesión.</p>
                            </div>
                        ) : (
                            <>
                                <div className="space-y-2">
                                    <Label className="text-xs font-medium text-white/60">Buscar en Drive</Label>
                                    <Input value={googleSearch} onChange={(e) => setGoogleSearch(e.target.value)} placeholder="Nombre del archivo..." className="bg-white/5 border border-white/10 rounded-md py-2.5 px-3 text-sm text-white placeholder:text-white/50" />
                                </div>
                                <ScrollArea className="h-[280px] rounded-md border border-white/10">
                                    {googleFilesLoading ? (
                                        <div className="p-4 space-y-2"><Skeleton className="h-12 w-full bg-white/10 rounded-lg" /><Skeleton className="h-12 w-full bg-white/10 rounded-lg" /></div>
                                    ) : googleFilesForAssign.length === 0 ? (
                                        <p className="text-white/50 text-sm p-4">No se encontraron archivos o escribe para buscar.</p>
                                    ) : (
                                        <ul className="p-2 space-y-1">
                                            {googleFilesForAssign.map((gf) => (
                                                <li key={gf.id} className="flex items-center justify-between gap-2 p-2 rounded-lg hover:bg-white/10 text-white">
                                                    <span className="truncate text-sm">{gf.name}</span>
                                                    <Button size="sm" variant="ghost" className="shrink-0 text-[#4DBBFF]" onClick={() => handleAddFromGoogleAssign(gf)}>Agregar</Button>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </ScrollArea>
                                <DialogFooter className="gap-2 mt-4">
                                    <Button variant="outline" onClick={() => setAddFromGoogleOpen(false)} className="flex-1 border border-white/10 bg-transparent text-[13px] font-medium text-white/60 hover:bg-white/10">Cerrar</Button>
                                </DialogFooter>
                            </>
                        )}
                    </DialogContent>
                </Dialog>

                <Dialog open={addFromEvoOpen} onOpenChange={setAddFromEvoOpen}>
                    <DialogContent className="bg-white/5 border border-white/10 max-w-[380px] rounded-2xl p-6 shadow-xl overflow-hidden">
                        <DialogHeader>
                            <DialogTitle className="text-white flex items-center gap-3">
                                <div className="w-10 h-10 rounded-[11px] bg-[#4DBBFF]/20 flex items-center justify-center shrink-0"><Link2 className="w-5 h-5 text-[#4DBBFF]" /></div>
                                <div>
                                    <span className="text-base font-semibold text-white block">Añadir enlace</span>
                                    <span className="text-xs text-white/60 mt-0.5 block">URL o nombre del recurso para la asignación</span>
                                </div>
                            </DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label className="text-xs font-medium text-white/60">Nombre (opcional)</Label>
                                <Input value={evoLinkName} onChange={(e) => setEvoLinkName(e.target.value)} placeholder="Ej: Guía de estudio" className="bg-white/5 border border-white/10 rounded-md py-2.5 px-3 text-sm text-white placeholder:text-white/50" />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs font-medium text-white/60">URL</Label>
                                <Input value={evoLinkUrl} onChange={(e) => setEvoLinkUrl(e.target.value)} placeholder="https://..." className="bg-white/5 border border-white/10 rounded-md py-2.5 px-3 text-sm text-white placeholder:text-white/50" />
                            </div>
                        </div>
                        <DialogFooter className="gap-2 mt-6 grid grid-cols-[1fr_2fr]">
                            <Button variant="outline" onClick={() => setAddFromEvoOpen(false)} className="border border-white/10 bg-transparent text-[13px] font-medium text-white/60 hover:bg-white/10">Cancelar</Button>
                            <Button onClick={handleAddFromEvoAssign} disabled={!evoLinkUrl.trim()} className="bg-[#1a73e8] hover:bg-[#1558b0] text-white text-[13px] font-medium">Añadir</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                <Dialog open={createNewOpen} onOpenChange={setCreateNewOpen}>
                    <DialogContent className="bg-white/5 border border-white/10 max-w-[380px] rounded-2xl p-6 shadow-xl overflow-hidden">
                        <DialogHeader>
                            <DialogTitle className="text-white flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-[11px] flex items-center justify-center shrink-0 ${createNewType === 'doc' ? 'bg-[#1a56d6]' : createNewType === 'slide' ? 'bg-[#d97706]' : 'bg-[#16a34a]'}`}>
                                    {createNewType === 'doc' && <FileText className="w-5 h-5 text-white" />}
                                    {createNewType === 'slide' && <Presentation className="w-5 h-5 text-white" />}
                                    {createNewType === 'sheet' && <FileSpreadsheet className="w-5 h-5 text-white" />}
                                </div>
                                <div>
                                    <span className="text-base font-semibold text-white block">
                                        {createNewType === 'doc' && 'Nuevo documento'}
                                        {createNewType === 'slide' && 'Nueva presentación'}
                                        {createNewType === 'sheet' && 'Nueva hoja de cálculo'}
                                    </span>
                                    <span className="text-xs text-white/60 mt-0.5 block">Se creará en Google Drive y se añadirá a los materiales</span>
                                </div>
                            </DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 mt-4">
                            <div className="space-y-2">
                                <Label className="text-xs font-medium text-white/60">Nombre del archivo</Label>
                                <Input value={createNewNombre} onChange={(e) => setCreateNewNombre(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleCreateNewDocForAssign()} placeholder="Ej: Guía del curso" className="bg-white/5 border border-white/10 rounded-md py-2.5 px-3 text-sm text-white placeholder:text-white/50" autoFocus />
                            </div>
                        </div>
                        <DialogFooter className="gap-2 mt-6 grid grid-cols-[1fr_2fr]">
                            <Button variant="outline" onClick={() => { setCreateNewOpen(false); setCreateNewNombre(''); }} className="border border-white/10 bg-transparent text-[13px] font-medium text-white/60 hover:bg-white/10">Cancelar</Button>
                            <Button onClick={handleCreateNewDocForAssign} disabled={!createNewNombre.trim() || createNewDocForAssignMutation.isPending || !cursoId} className="bg-[#1a73e8] hover:bg-[#1558b0] text-white text-[13px] font-medium">
                                {createNewDocForAssignMutation.isPending ? 'Creando…' : 'Crear'}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* Dialog para Lista de Estudiantes */}
                <Dialog open={showStudentsDialog} onOpenChange={setShowStudentsDialog}>
                    <DialogContent className="bg-[#0a0a2a] border-white/10 text-white max-w-4xl max-h-[80vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle className="text-white flex items-center gap-2">
                                <Users className="w-5 h-5 text-[#1e3cff]" />
                                Estudiantes del Grupo {groupDisplayName}
                            </DialogTitle>
                            <DialogDescription className="text-white/60">
                                {isLoadingStudents
                                    ? 'Cargando lista…'
                                    : `${students.length} ${students.length === 1 ? 'estudiante' : 'estudiantes'} conectados a este grupo`}
                            </DialogDescription>
                        </DialogHeader>
                        <div className="mt-4">
                            <div className="flex items-center justify-between mb-4">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="border-white/20 text-white hover:bg-white/10"
                                    onClick={async () => {
                                        try {
                                            const grupoIdNormalizado = cursoId.toUpperCase();
                                            const response = await apiRequest('POST', `/api/groups/${grupoIdNormalizado}/sync-students`);
                                            toast({
                                                title: 'Sincronización completada',
                                                description: response.message || `Se sincronizaron ${response.estudiantesSincronizados || 0} estudiantes.`,
                                            });
                                            queryClient.invalidateQueries({ queryKey: ['students', cursoId] });
                                        } catch (error: any) {
                                            console.error('Error al sincronizar estudiantes:', error);
                                            const errorMessage = error?.response?.data?.message || error?.message || 'No se pudo sincronizar los estudiantes';
                                            toast({
                                                title: 'Error',
                                                description: errorMessage,
                                                variant: 'destructive',
                                            });
                                        }
                                    }}
                                >
                                    <Users className="w-4 h-4 mr-2" />
                                    Sincronizar Estudiantes
                                </Button>
                            </div>
                            {isLoadingStudents ? (
                                <div className="space-y-3">
                                    <Skeleton className="h-16 w-full bg-white/10" />
                                    <Skeleton className="h-16 w-full bg-white/10" />
                                    <Skeleton className="h-16 w-full bg-white/10" />
                                </div>
                            ) : students.length > 0 ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {students.map((student) => {
                                        return (
                                            <div
                                                key={student._id}
                                                className="p-4 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-all cursor-pointer"
                                                onClick={() => {
                                                    const q = new URLSearchParams();
                                                    q.set('returnTo', professorDetailBasePath);
                                                    if (professorGroupSubjectId) q.set('gs', professorGroupSubjectId);
                                                    setLocation(
                                                        `/profesor/cursos/${cursoId}/estudiantes/${student._id}?${q.toString()}`
                                                    );
                                                    setShowStudentsDialog(false);
                                                }}
                                            >
                                                <div className="flex items-center justify-between mb-3">
                                                    <h4 className="font-semibold text-white truncate flex-1">{student.nombre}</h4>
                                                </div>
                                                <div className="flex items-center justify-start">
                                                    <Badge className={getEstadoColor(student.estado)}>
                                                        {student.estado.charAt(0).toUpperCase() + student.estado.slice(1)}
                                                    </Badge>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="text-center py-8">
                                    <Users className="w-16 h-16 text-[#1e3cff]/40 mx-auto mb-4" />
                                    <p className="text-white/60">No hay estudiantes registrados en este grupo</p>
                                </div>
                            )}
                        </div>
                    </DialogContent>
                </Dialog>
            </>
        );
    };

    // 🎯 Vista para Estudiante/Padre/Directivo (Contenido de la Materia)
    const renderStudentView = () => {
        const loading = isLoadingDetails || isLoadingAssignments;
        const details = courseDetails;

        if (loading) {
            return (
                <div className="space-y-6">
                    <Skeleton className="h-48 w-full bg-white/10" />
                    <Skeleton className="h-32 w-full bg-white/10" />
                    <Skeleton className="h-96 w-full bg-white/10" />
                </div>
            );
        }

        // Manejar errores de la query
        if (courseDetailsError) {
            // Extraer el mensaje de error del objeto Error
            const errorMessage = courseDetailsError instanceof Error
                ? courseDetailsError.message
                : 'Error al cargar la materia';

            return (
                <div className="space-y-4">
                    <Alert className="bg-red-500/10 border-red-500/50">
                        <AlertCircle className="h-4 w-4 text-red-400" />
                        <AlertTitle className="text-red-200">Error de acceso</AlertTitle>
                        <AlertDescription className="text-red-200">
                            {errorMessage}
                        </AlertDescription>
                    </Alert>
                    <Breadcrumb
                        items={[
                            { label: 'Dashboard', href: '/dashboard' },
                            { label: 'Materias', href: '/courses' },
                            { label: 'Error' },
                        ]}
                    />
                </div>
            );
        }

        if (!details) {
            return (
                <div className="space-y-4">
                    <Alert className="bg-red-500/10 border-red-500/50">
                        <AlertCircle className="h-4 w-4 text-red-400" />
                        <AlertTitle className="text-red-200">Materia no encontrada</AlertTitle>
                        <AlertDescription className="text-red-200">
                            El ID de materia proporcionado es inválido o no tienes acceso a esta materia.
                        </AlertDescription>
                    </Alert>
                    <Breadcrumb
                        items={[
                            { label: 'Dashboard', href: '/dashboard' },
                            { label: 'Materias', href: '/courses' },
                            { label: 'No encontrada' },
                        ]}
                    />
                </div>
            );
        }

        const titleColor = details.colorAcento || '#1e3cff';
        const cursoAsignado = details.cursoAsignado || user?.curso || 'N/A';

        // Calcular estadísticas de la materia
        const now = new Date();
        const tareasPendientes = assignments.filter(a => {
            const fechaEntrega = new Date(a.fechaEntrega);
            return fechaEntrega >= now;
        });
        const proximaTarea = tareasPendientes.length > 0
            ? tareasPendientes.sort((a, b) => new Date(a.fechaEntrega).getTime() - new Date(b.fechaEntrega).getTime())[0]
            : null;

        // Datos reales de notas para esta materia (promedio ponderado por logros como en página de notas)
        const materiaNotas = materiaNotasForStudent;
        const { promedioFinal: computedPromedio, ultimaNota: computedUltima } = materiaNotas
            ? computeWeightedPromedioAndUltima(
                  materiaNotas,
                  logrosStudentNested.length > 0 ? logrosStudentNested : undefined
              )
            : { promedioFinal: null, ultimaNota: null };
        const promedioReal = materiaNotas != null ? computedPromedio : null;
        const ultimaNotaReal = materiaNotas != null ? computedUltima : null;
        const estadoReal =
            materiaNotas != null && computedPromedio != null
                ? computedPromedio >= 65
                    ? 'aprobado'
                    : 'reprobado'
                : null;

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

        // Categorías de notas para la pestaña Notas (igual que página de notas general)
        const notasList = materiaNotas?.notas ?? [];
        const logrosOrdenados = [...indicadoresStudentPlano].sort((a, b) => (a.orden ?? 999) - (b.orden ?? 999));
        const hasWeightedLogros = logrosOrdenados.length > 0;
        type CategoriaNota = {
            categoria: string;
            promedio: number | null;
            notas: { actividad: string; nota: number | null; fecha: string; comentario?: string | null }[];
        };
        const dedupeN = (arr: NotaRealStudent[]) => {
            const m = new Map<string, NotaRealStudent>();
            for (const n of arr) {
                const id = n.assignmentId || n.tareaTitulo || '';
                if (!m.has(id)) m.set(id, n);
            }
            return Array.from(m.values());
        };
        const categoriasNotas: CategoriaNota[] = [];
        if (hasWeightedLogros && logrosOrdenados.length > 0) {
            for (const logro of logrosOrdenados) {
                const notasEnCat = dedupeN(
                    notasList.filter((n) => String(n.gradingCategoryId ?? '') === String(logro._id))
                );
                const promCat = weightedGradeWithinLogro(
                    notasEnCat.map((n) => ({ categoryWeightPct: n.categoryWeightPct })),
                    notasEnCat.map((n) => (hasRecordedScore(n.nota) ? Number(n.nota) : null))
                );
                categoriasNotas.push({
                    categoria: `${logro.nombre} (${logro.porcentaje ?? 0}%)`,
                    promedio: promCat != null ? Math.round(promCat * 10) / 10 : null,
                    notas: notasEnCat.map((n) => ({
                        actividad: n.tareaTitulo ?? 'Sin título',
                        nota: hasRecordedScore(n.nota) ? Number(n.nota) : null,
                        fecha: n.fecha ?? '',
                        comentario: n.comentario ?? null,
                    })),
                });
            }
            const sinCat = dedupeN(notasList.filter((n) => !n.gradingCategoryId));
            if (sinCat.length > 0) {
                const sc = sinCat.filter((n) => hasRecordedScore(n.nota)).map((n) => Number(n.nota));
                const promSin = sc.length ? sc.reduce((a, b) => a + b, 0) / sc.length : null;
                categoriasNotas.push({
                    categoria: 'Sin categoría',
                    promedio: promSin != null ? Math.round(promSin * 10) / 10 : null,
                    notas: sinCat.map((n) => ({
                        actividad: n.tareaTitulo ?? 'Sin título',
                        nota: hasRecordedScore(n.nota) ? Number(n.nota) : null,
                        fecha: n.fecha ?? '',
                        comentario: n.comentario ?? null,
                    })),
                });
            }
        } else if (notasList.length > 0) {
            const d = dedupeN(notasList);
            const sc = d.filter((n) => hasRecordedScore(n.nota)).map((n) => Number(n.nota));
            categoriasNotas.push({
                categoria: 'Notas',
                promedio: sc.length ? Math.round((sc.reduce((a, b) => a + b, 0) / sc.length) * 10) / 10 : null,
                notas: d.map((n) => ({
                    actividad: n.tareaTitulo ?? 'Sin título',
                    nota: hasRecordedScore(n.nota) ? Number(n.nota) : null,
                    fecha: n.fecha ?? '',
                    comentario: n.comentario ?? null,
                })),
            });
        }

        return (
            <>
                <Breadcrumb
                    className="mb-6"
                    items={[
                        { label: 'Dashboard', href: '/dashboard' },
                        { label: 'Materias', href: '/courses' },
                        { label: details.nombre },
                    ]}
                />

                {/* Encabezado: mismo estilo glass que vista profesor (panel-grades) */}
                <div className="mb-8 relative overflow-hidden rounded-2xl panel-grades border border-white/10 transition-all duration-300 hover:shadow-[0_0_48px_rgba(37,99,235,0.3)]">
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent opacity-80" />
                    <div className="relative p-4 sm:p-6 md:p-8">
                        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 sm:gap-6">
                            <div className="flex-1">
                                <div className="flex items-center gap-3 mb-4">
                                    <div
                                        className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg transition-transform duration-300 hover:scale-105"
                                        style={{
                                            backgroundColor: titleColor,
                                            boxShadow: `0 8px 32px ${titleColor}40`
                                        }}
                                    >
                                        <BookOpen className="w-8 h-8 text-white" />
                                    </div>
                                    <div>
                                        <Badge className="bg-white/10 text-white border-white/20 mb-2 transition-colors hover:bg-white/15">
                                            {cursoAsignado}
                                        </Badge>
                                        <h1 className="text-4xl md:text-5xl font-extrabold text-white mb-2 font-['Poppins']">
                                            {details.nombre}
                                        </h1>
                                    </div>
                                </div>
                                {details.descripcion && (
                                    <p className="text-[#E2E8F0]/80 text-lg mb-4 max-w-2xl">
                                        {details.descripcion}
                                    </p>
                                )}
                                <div className="flex flex-wrap items-center gap-4 text-white/70">
                                    <div className="flex items-center gap-2">
                                        <User className="w-5 h-5 text-white/60" />
                                        <span className="font-medium text-[#E2E8F0]">
                                            {details.profesor?.nombre || 'No Asignado'}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <CalendarIcon className="w-5 h-5 text-white/60" />
                                        <span>Curso: {cursoAsignado}</span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex flex-col gap-3">
                                {showOptionsButton && (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="border-white/20 text-white/90 hover:bg-white/10"
                                        onClick={() => {
                                            setOptionsDisplayName(details.nombre ?? '');
                                            setOptionsIcon((details as CourseSubject).icono ?? '');
                                            setOptionsModalOpen(true);
                                        }}
                                    >
                                        <Settings className="w-4 h-4 mr-1" />
                                        Opciones de materia
                                    </Button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Resumen General: mismo estilo que vista profesor — 2 filas de 3 tarjetas (grid lg:grid-cols-3) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-8 max-w-6xl mx-auto">
                    {/* 1. Promedio */}
                    <Card className="bg-gradient-to-br from-white/10 to-white/5 border-white/20 backdrop-blur-xl hover:from-white/15 hover:to-white/10 transition-all duration-300 group shadow-lg hover:shadow-xl hover:shadow-[#3B82F6]/20">
                        <CardHeader className="text-center pb-4">
                            <div className="w-20 h-20 mx-auto mb-4 rounded-3xl bg-gradient-to-br from-[#1e3cff] via-[#002366] to-[#00c8ff] flex items-center justify-center group-hover:scale-110 group-hover:rotate-3 transition-all duration-300 shadow-lg shadow-[#1e3cff]/30">
                                <TrendingUp className="w-10 h-10 text-white" />
                            </div>
                            <CardTitle className="text-white text-3xl font-bold font-['Poppins'] mb-2">Promedio</CardTitle>
                            <CardDescription className="text-white/70 text-lg">
                                {promedioReal != null ? `${(Math.round(promedioReal * 10) / 10).toFixed(1)} / 100` : '—'}
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="text-center pt-0" />
                    </Card>
                    {/* 2. Última Nota */}
                    <Card className="bg-gradient-to-br from-white/10 to-white/5 border-white/20 backdrop-blur-xl hover:from-white/15 hover:to-white/10 transition-all duration-300 group shadow-lg hover:shadow-xl hover:shadow-[#3B82F6]/20">
                        <CardHeader className="text-center pb-4">
                            <div className="w-20 h-20 mx-auto mb-4 rounded-3xl bg-gradient-to-br from-[#002366] via-[#003d7a] to-[#1e3cff] flex items-center justify-center group-hover:scale-110 group-hover:rotate-3 transition-all duration-300 shadow-lg shadow-[#002366]/40">
                                <Award className="w-10 h-10 text-white" />
                            </div>
                            <CardTitle className="text-white text-3xl font-bold font-['Poppins'] mb-2">Última Nota</CardTitle>
                            <CardDescription className="text-white/70 text-lg">
                                {ultimaNotaReal != null ? `${(Math.round(ultimaNotaReal * 10) / 10).toFixed(1)} / 100` : '—'}
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="text-center pt-0" />
                    </Card>
                    {/* 3. Estado */}
                    <Card className="bg-gradient-to-br from-white/10 to-white/5 border-white/20 backdrop-blur-xl hover:from-white/15 hover:to-white/10 transition-all duration-300 group shadow-lg hover:shadow-xl hover:shadow-emerald-500/20">
                        <CardHeader className="text-center pb-4">
                            <div className="w-20 h-20 mx-auto mb-4 rounded-3xl bg-gradient-to-br from-[#059669] via-[#10B981] to-emerald-400 flex items-center justify-center group-hover:scale-110 group-hover:rotate-3 transition-all duration-300 shadow-lg shadow-emerald-500/30">
                                <CheckCircle className="w-10 h-10 text-white" />
                            </div>
                            <CardTitle className="text-white text-3xl font-bold font-['Poppins'] mb-2">Estado</CardTitle>
                            <CardDescription className="text-white/70 text-lg">
                                {estadoReal ? (estadoReal.charAt(0).toUpperCase() + estadoReal.slice(1)) : 'Sin datos'}
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="text-center pt-0" />
                    </Card>
                    {/* 4. Asignaciones — lleva a Mi aprendizaje > Tareas con filtro de esta materia */}
                    <Card
                        className="bg-gradient-to-br from-white/10 to-white/5 border-white/20 backdrop-blur-xl hover:from-white/15 hover:to-white/10 transition-all duration-300 group shadow-lg hover:shadow-xl hover:shadow-orange-500/20 cursor-pointer"
                        onClick={() => {
                            const q = new URLSearchParams();
                            q.set('materia', details.nombre);
                            setLocation(`/mi-aprendizaje/tareas?${q.toString()}`);
                        }}
                    >
                        <CardHeader className="text-center pb-4">
                            <div className="w-20 h-20 mx-auto mb-4 rounded-3xl bg-gradient-to-br from-amber-500 via-orange-500 to-yellow-500 flex items-center justify-center group-hover:scale-110 group-hover:rotate-3 transition-all duration-300 shadow-lg shadow-orange-500/30">
                                <Clock className="w-10 h-10 text-white" />
                            </div>
                            <CardTitle className="text-white text-3xl font-bold font-['Poppins'] mb-2">Asignaciones</CardTitle>
                            <CardDescription className="text-white/70 text-lg">
                                Ver tareas de esta materia
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="text-center pt-0" />
                    </Card>
                    {/* 5. Evo Send */}
                    <Card
                        className="bg-gradient-to-br from-white/10 to-white/5 border-white/20 border-red-500/30 backdrop-blur-xl hover:from-white/15 hover:to-white/10 transition-all cursor-pointer group shadow-lg hover:shadow-xl hover:shadow-red-500/20"
                        onClick={() => {
                            try {
                                sessionStorage.setItem('evo-send-return-path', `/course/${cursoId}`);
                            } catch {
                                /* ignore */
                            }
                            const params = new URLSearchParams();
                            if (evoSendThreadId) params.set('thread', evoSendThreadId);
                            setLocation(params.toString() ? `/evo-send?${params.toString()}` : '/evo-send');
                        }}
                    >
                        <CardHeader className="text-center pb-4">
                            <div className="w-20 h-20 mx-auto mb-4 rounded-3xl bg-gradient-to-br from-red-500 via-red-600 to-rose-500 flex items-center justify-center group-hover:scale-110 group-hover:rotate-3 transition-all duration-300 shadow-lg shadow-red-500/30">
                                <Send className="w-10 h-10 text-white" />
                            </div>
                            <CardTitle className="text-white text-3xl font-bold font-['Poppins'] mb-2">Evo Send</CardTitle>
                            <CardDescription className="text-white/70 text-lg">
                                Chat del curso, tipo WhatsApp
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="text-center pt-0" />
                    </Card>
                    {/* 6. Evo Drive — carpeta de la materia (misma lógica: /evo-drive, el estudiante ve sus carpetas por materia) */}
                    <Card
                        className="bg-gradient-to-br from-white/10 to-white/5 border-white/20 border-sky-400/30 backdrop-blur-xl hover:from-white/15 hover:to-white/10 transition-all cursor-pointer group shadow-lg hover:shadow-xl hover:shadow-sky-400/20"
                        onClick={() => setLocation('/evo-drive')}
                    >
                        <CardHeader className="text-center pb-4">
                            <div className="w-20 h-20 mx-auto mb-4 rounded-3xl bg-gradient-to-br from-sky-400 via-[#00c8ff] to-cyan-300 flex items-center justify-center group-hover:scale-110 group-hover:rotate-3 transition-all duration-300 shadow-lg shadow-sky-400/30">
                                <Cloud className="w-10 h-10 text-white" />
                            </div>
                            <CardTitle className="text-white text-3xl font-bold font-['Poppins'] mb-2">Evo Drive</CardTitle>
                            <CardDescription className="text-white/70 text-lg">
                                Acceder al drive de la plataforma
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="text-center pt-0" />
                    </Card>
                </div>

                {/* Sección Tareas (solo calendario) y Notas */}
                <Tabs defaultValue="tareas" className="w-full">
                    <TabsList className="panel-grades border border-white/10 rounded-xl mb-6 p-1 gap-1 transition-all duration-200">
                        <TabsTrigger
                            value="tareas"
                            className="data-[state=active]:bg-[#3B82F6] data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#3B82F6] data-[state=active]:to-[#1D4ED8] transition-all duration-200 rounded-lg"
                        >
                            <ClipboardList className="w-4 h-4 mr-2" />
                            Calendario
                        </TabsTrigger>
                        <TabsTrigger
                            value="notas"
                            className="data-[state=active]:bg-[#3B82F6] data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#3B82F6] data-[state=active]:to-[#1D4ED8] transition-all duration-200 rounded-lg"
                        >
                            <Award className="w-4 h-4 mr-2" />
                            Notas
                        </TabsTrigger>
                    </TabsList>

                    {/* Pestaña de Tareas — solo calendario (la lista de tareas está en Mi aprendizaje → Tareas) */}
                    <TabsContent value="tareas" className="space-y-6 mt-0">
                        {assignments.length > 0 ? (
                            <Card className="panel-grades border border-white/10 rounded-2xl overflow-hidden transition-all duration-200 hover:shadow-[0_0_40px_rgba(37,99,235,0.2)]">
                                <CardHeader>
                                    <CardTitle className="text-[#E2E8F0] flex items-center gap-2">
                                        <CalendarIcon className="w-5 h-5 text-[#3B82F6]" />
                                        Calendario de Tareas
                                    </CardTitle>
                                    <CardDescription className="text-white/60">
                                        Tareas asignadas para {details.nombre}
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <Calendar assignments={assignments} onDayClick={handleDayClick} onEmptyDayClick={handleEmptyDayClick} />
                                </CardContent>
                            </Card>
                        ) : (
                            <Card className="panel-grades border border-white/10 rounded-2xl">
                                <CardContent className="p-12 text-center">
                                    <ClipboardList className="w-16 h-16 text-[#3B82F6]/50 mx-auto mb-4 transition-transform duration-200 hover:scale-110" />
                                    <h3 className="text-xl font-semibold text-[#E2E8F0] mb-2">
                                        No hay tareas asignadas
                                    </h3>
                                    <p className="text-white/60">
                                        Aún no se han asignado tareas para esta materia.
                                    </p>
                                </CardContent>
                            </Card>
                        )}
                    </TabsContent>

                    {/* Pestaña de Notas — mismas notas de la materia que en la página de notas general */}
                    <TabsContent value="notas" className="space-y-6 mt-0">
                        <Card className="panel-grades border border-white/10 rounded-2xl overflow-hidden transition-all duration-200 hover:shadow-[0_0_40px_rgba(37,99,235,0.2)]">
                            <CardHeader className="flex flex-row items-start justify-between gap-4">
                                <div>
                                    <CardTitle className="text-[#E2E8F0] flex items-center gap-2">
                                        <Award className="w-5 h-5 text-[#3B82F6]" />
                                        Notas de {details.nombre}
                                    </CardTitle>
                                    <CardDescription className="text-white/60">
                                        Revisa tu rendimiento académico en esta materia
                                    </CardDescription>
                                </div>
                                {isStudent && (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="border-[#3B82F6]/50 text-[#00c8ff] hover:bg-[#3B82F6]/10 hover:border-[#3B82F6] backdrop-blur-sm transition-all duration-200 shrink-0"
                                        onClick={() => setLocation(`/course/${cursoId}/analytics`)}
                                    >
                                        <BarChart3 className="w-4 h-4 mr-2" />
                                        Vista analítica
                                    </Button>
                                )}
                            </CardHeader>
                            <CardContent>
                                {categoriasNotas.length > 0 ? (
                                    <div className="space-y-6">
                                        {categoriasNotas.map((categoria, idx) => (
                                            <div key={idx} className="space-y-3">
                                                <div className="flex items-center justify-between">
                                                    <h4 className="font-semibold text-[#E2E8F0]">{categoria.categoria}</h4>
                                                    <span className="text-lg font-bold text-[#E2E8F0]">
                                                        {categoria.promedio != null ? (
                                                            <>
                                                                {Math.round(categoria.promedio)}{' '}
                                                                <span className="text-white/50">/ 100</span>
                                                            </>
                                                        ) : (
                                                            <span className="text-white/50">—</span>
                                                        )}
                                                    </span>
                                                </div>
                                                <p className="text-sm text-white/60 mb-3">
                                                    Promedio de {categoria.notas.length} {categoria.notas.length === 1 ? 'actividad' : 'actividades'}
                                                </p>
                                                <div className="space-y-3">
                                                    {categoria.notas.map((nota, notaIdx) => (
                                                        <div
                                                            key={notaIdx}
                                                            className="p-4 rounded-xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.06] hover:border-white/10 transition-all duration-200"
                                                        >
                                                            <div className="flex items-start justify-between mb-2">
                                                                <div className="flex-1">
                                                                    <h4 className="font-semibold text-[#E2E8F0] mb-1">{nota.actividad}</h4>
                                                                    <p className="text-sm text-white/60">
                                                                        {new Date(nota.fecha).toLocaleDateString('es-CO', {
                                                                            year: 'numeric',
                                                                            month: 'long',
                                                                            day: 'numeric',
                                                                        })}
                                                                    </p>
                                                                </div>
                                                                <div className="flex items-center gap-2">
                                                                    <span className="text-2xl font-bold text-[#E2E8F0]">
                                                                        {nota.nota != null ? Math.round(nota.nota) : '—'}
                                                                    </span>
                                                                    {nota.nota != null && (
                                                                        <span className="text-white/50">/ 100</span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            {nota.comentario && (
                                                                <div className="mt-3 p-3 rounded-lg border border-white/10 bg-white/[0.03]">
                                                                    <div className="flex items-start gap-2">
                                                                        <MessageSquare className="w-4 h-4 text-[#3B82F6] mt-0.5 flex-shrink-0" />
                                                                        <p className="text-sm text-white/80">{nota.comentario}</p>
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center py-12">
                                        <Award className="w-16 h-16 text-[#3B82F6]/50 mx-auto mb-4 transition-transform duration-200 hover:scale-110" />
                                        <h3 className="text-xl font-semibold text-[#E2E8F0] mb-2">Sin notas aún</h3>
                                        <p className="text-white/60 mb-6">
                                            Aún no hay calificaciones registradas para esta materia.
                                        </p>
                                        <Button
                                            variant="outline"
                                            className="border-white/20 text-[#E2E8F0] hover:bg-white/5 hover:border-white/30 transition-all duration-200"
                                            onClick={() => setLocation('/mi-aprendizaje/notas')}
                                        >
                                            <Award className="w-4 h-4 mr-2" />
                                            Ver todas mis notas
                                        </Button>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            </>
        );
    };

    // 🎯 Renderizado Común: Solo Calendario (sin lista de tareas)
    const renderCalendarAndAssignmentList = (assignments: Assignment[], titleContext: string) => (
        <>
            {/* Calendario del curso */}
            <Card className="bg-white/5 border-white/10 backdrop-blur-md mt-8">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-white">
                        <CalendarIcon className="w-5 h-5 text-[#1e3cff]" />
                        Calendario de Tareas
                    </CardTitle>
                    <CardDescription className="text-white/60">
                        Tareas asignadas para {titleContext}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Calendar
                        assignments={assignments}
                        onDayClick={handleDayClick}
                        onDayBubbleClick={handleEmptyDayClick}
                    />
                </CardContent>
            </Card>
        </>
    );

    // --------------------------------------------------
    // 4. Renderizado Final (Lógica centralizada)
    // --------------------------------------------------

    const renderContent = () => {
        if (isProfessor) {
            if (professorMustPickSubject) {
                return renderProfessorSubjectPicker();
            }
            return renderProfessorView();
        }

        // Estudiante, Padre, y ahora Directivo (solo para visualización) usan renderStudentView
        if (isStudentOrParent || userRole === 'directivo') {
            return renderStudentView();
        }

        return (
            <Alert className="bg-white/5 border-white/10 mt-8">
                <AlertCircle className="h-4 w-4 text-white/70" />
                <AlertTitle className="text-white">Rol no compatible</AlertTitle>
                <AlertDescription className="text-white/60">
                    Tu rol no tiene una vista de detalle definida para esta sección.
                </AlertDescription>
            </Alert>
        );
    };

    const MATERIA_ICONS = ['📐', '🔬', '🧪', '🌍', '🖥️', '📖', '🎨', '⚽', '🎵', '🧮', '🏛️', '✏️', '🌱', '💡'];

    return (
        <div className="flex-1 overflow-auto p-4 sm:p-6 md:p-8">
            <div className="max-w-7xl mx-auto w-full">
                {renderContent()}
            </div>
            {/* Modal Opciones de materia (nombre visible + ícono) — profesor/admin */}
            <Dialog open={optionsModalOpen} onOpenChange={setOptionsModalOpen}>
                <DialogContent className="bg-white/5 border border-white/10 max-w-md rounded-2xl p-6 shadow-xl">
                    <DialogHeader>
                        <DialogTitle className="text-white font-['Poppins']">Opciones de la materia</DialogTitle>
                        <DialogDescription className="text-white/60 text-sm">
                            Cambia el nombre visible y el ícono de esta materia (solo afecta cómo se muestra, no el nombre oficial).
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 pt-2">
                        <div>
                            <Label className="text-white/90 mb-2 block">Nombre visible</Label>
                            <Input
                                value={optionsDisplayName}
                                onChange={(e) => setOptionsDisplayName(e.target.value)}
                                placeholder="Ej. Matemáticas 11"
                                className="bg-white/5 border-white/10 text-white placeholder:text-white/50"
                            />
                        </div>
                        <div>
                            <Label className="text-white/90 mb-2 block">Ícono</Label>
                            <div className="grid grid-cols-7 gap-2">
                                {MATERIA_ICONS.map((emoji) => (
                                    <button
                                        key={emoji}
                                        type="button"
                                        onClick={() => setOptionsIcon(emoji)}
                                        className={`w-10 h-10 rounded-lg flex items-center justify-center text-xl transition-all ${
                                            optionsIcon === emoji
                                                ? 'bg-[#1e3cff] text-white ring-2 ring-[#00c8ff]'
                                                : 'bg-white/10 text-white hover:bg-white/20'
                                        }`}
                                    >
                                        {emoji}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                    <DialogFooter className="gap-2 mt-6">
                        <Button variant="outline" className="border-white/10 text-white" onClick={() => setOptionsModalOpen(false)}>
                            Cancelar
                        </Button>
                        <Button
                            className="bg-[#1e3cff] hover:bg-[#002366] text-white"
                            disabled={patchGroupSubjectMutation.isPending}
                            onClick={() => {
                                patchGroupSubjectMutation.mutate({
                                    display_name: optionsDisplayName.trim() || undefined,
                                    icon: optionsIcon || undefined,
                                });
                            }}
                        >
                            {patchGroupSubjectMutation.isPending ? 'Guardando...' : 'Guardar'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}