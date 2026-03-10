import { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '@/lib/authContext';
import { Calendar as CalendarIcon, ClipboardList, AlertCircle, BookOpen, Clock, User, FileText, Bell, TrendingUp, Award, ChevronRight, Home, Users, Eye, Settings, Plus, X, Maximize2, Gauge, FileUp, CheckCircle, MessageSquare } from 'lucide-react';
import { NavBackButton } from '@/components/nav-back-button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useLocation, useRoute } from 'wouter';
import { Calendar } from '@/components/Calendar';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';

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

interface LogrosResponse {
    logros: LogroCalificacion[];
    totalPorcentaje: number;
    completo: boolean;
}

// Tipos para notas del estudiante (alineados con /api/student/notes y student-notes.tsx)
interface NotaRealStudent {
    tareaTitulo?: string;
    nota: number;
    fecha: string;
    comentario?: string | null;
    gradingCategoryId?: string;
}
interface MateriaConNotasStudent {
    _id: string;
    nombre: string;
    groupSubjectId?: string | null;
    notas: NotaRealStudent[];
    promedio: number;
    ultimaNota: number | null;
    estado: string;
}
const noteScoreFrom = (n: { nota?: number }) => Number(n?.nota ?? 0) || 0;
function computeWeightedPromedioAndUltima(
    materia: MateriaConNotasStudent,
    logros: { _id: string; porcentaje?: number; orden?: number }[] | undefined
): { promedioFinal: number; ultimaNota: number } {
    const notas = materia.notas ?? [];
    const ultimaNota = notas.length
        ? noteScoreFrom(notas.reduce((a, b) => (new Date(b.fecha ?? 0) > new Date(a.fecha ?? 0) ? b : a)))
        : 0;
    const totalPct = (logros ?? []).reduce((s, l) => s + (l.porcentaje ?? 0), 0);
    const hasWeightedLogros = totalPct > 0 && (logros ?? []).length > 0;
    if (hasWeightedLogros && logros!.length > 0) {
        const logrosOrdenados = [...logros!].sort((a, b) => (a.orden ?? 999) - (b.orden ?? 999));
        let weightedSum = 0;
        for (const logro of logrosOrdenados) {
            const notasEnCategoria = notas.filter((n) => String(n.gradingCategoryId ?? '') === String(logro._id));
            const promCat = notasEnCategoria.length > 0
                ? notasEnCategoria.reduce((s, x) => s + noteScoreFrom(x), 0) / notasEnCategoria.length
                : 0;
            weightedSum += promCat * ((logro.porcentaje ?? 0) / 100);
        }
        return { promedioFinal: Math.round(weightedSum * 10) / 10, ultimaNota };
    }
    const promedioFinal = notas.length > 0
        ? Math.round((notas.reduce((s, x) => s + noteScoreFrom(x), 0) / notas.length) * 10) / 10
        : Number(materia.promedio) || 0;
    return { promedioFinal, ultimaNota };
}

interface CourseSubject {
    _id: string; // ID de la materia
    nombre: string;
    descripcion?: string;
    colorAcento?: string;
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
        // Normalizar groupId a mayúsculas para consistencia
        const grupoIdNormalizado = groupId.toUpperCase().trim();
        console.log(`[FRONTEND] Buscando estudiantes para grupo: ${grupoIdNormalizado}`);
        
        // Obtener estudiantes del grupo desde el endpoint
        const response = await apiRequest('GET', `/api/groups/${grupoIdNormalizado}/students`);
        const students = Array.isArray(response) ? response : [];
        console.log(`[FRONTEND] Recibidos ${students.length} estudiantes para ${grupoIdNormalizado}`);
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
    // La ruta es dinámica. cursoId puede ser: ID de materia o Nombre del Grupo
    const [, params] = useRoute('/course-detail/:cursoId'); 
    const cursoId = params?.cursoId || ''; 
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
    const [assignmentType, setAssignmentType] = useState<'recordatorio' | 'assignment' | null>(null);
    const [showStudentsDialog, setShowStudentsDialog] = useState(false);
    const [formData, setFormData] = useState({
        titulo: '',
        descripcion: '',
        fechaEntrega: '',
        courseId: '', // ID de la materia
    });
    const [logroCalificacionId, setLogroCalificacionId] = useState('');
    const [newMaterialTitle, setNewMaterialTitle] = useState('');
    const [assignmentMaterials, setAssignmentMaterials] = useState<{ type: 'file' | 'link' | 'gdoc'; url: string; fileName?: string }[]>([]);
    const [materialLinkInput, setMaterialLinkInput] = useState('');
    const [creatingGdoc, setCreatingGdoc] = useState(false);

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
    });

    // Query 3: Tareas del Curso/Grupo
    const { data: assignments = [], isLoading: isLoadingAssignments } = useQuery<Assignment[]>({
        queryKey: ['assignments', cursoId, currentMonth, currentYear],
        queryFn: () => fetchAssignments(cursoId, isHandlingGroup, currentMonth, currentYear),
        staleTime: 2 * 60 * 1000, // 2 minutos - las tareas pueden cambiar más frecuentemente
        gcTime: 5 * 60 * 1000, // 5 minutos de caché
    });

    // Query 4: Estudiantes del Grupo (Solo para Profesor)
    const { data: students = [], isLoading: isLoadingStudents } = useQuery<Student[]>({
        queryKey: ['students', cursoId],
        queryFn: () => fetchStudentsByGroup(cursoId),
        enabled: isProfessor && !!cursoId,
        staleTime: 5 * 60 * 1000, // 5 minutos
        gcTime: 10 * 60 * 1000, // 10 minutos de caché
    });

    const firstSubjectId = subjectsForGroup[0]?._id;

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
    const logrosStudent = logrosStudentData?.logros ?? [];

    // Query 6: Tareas para tabla de notas (grupo + materia, sin filtro mes)
    const { data: assignmentsForTable = [], isLoading: isLoadingGradeTable } = useQuery<Assignment[]>({
        queryKey: ['gradeTableAssignments', cursoId, firstSubjectId],
        queryFn: () => fetchGradeTableAssignments(displayGroupId, firstSubjectId || ''),
        enabled: isProfessor && !!cursoId && !!firstSubjectId,
        staleTime: 2 * 60 * 1000,
        gcTime: 5 * 60 * 1000,
    });

    // Query 7: Logros de calificación para la tabla de notas (siempre para la primera materia del grupo)
    const { data: logrosForTableData, isLoading: isLoadingLogrosForTable } = useQuery<LogrosResponse>({
        queryKey: ['/api/logros-calificacion', firstSubjectId],
        queryFn: () =>
            apiRequest<LogrosResponse>('GET', `/api/logros-calificacion?courseId=${encodeURIComponent(firstSubjectId || '')}`),
        enabled: isProfessor && !!firstSubjectId,
        staleTime: 5 * 60 * 1000,
        gcTime: 10 * 60 * 1000,
    });
    const logrosForTable = logrosForTableData?.logros ?? [];

    // Agrupar asignaciones por logro (misma estructura que tabla completa) — TODOS los logros del curso aparecen
    const assignmentsByLogro = useMemo(() => {
        const logros = logrosForTable;
        const logrosOrdenados = [...logros].sort((a, b) => {
            const ordenA = a.orden ?? 999;
            const ordenB = b.orden ?? 999;
            if (ordenA !== ordenB) return ordenA - ordenB;
            return a.nombre.localeCompare(b.nombre);
        });
        const grouped: Record<string, { logro: LogroCalificacion; assignments: Assignment[] }> = {};
        logrosOrdenados.forEach(logro => {
            grouped[logro._id] = { logro, assignments: [] };
        });
        const sinLogro: Assignment[] = [];
        assignmentsForTable.forEach(assignment => {
            if (assignment.logroCalificacionId) {
                const assignmentLogroId = String(assignment.logroCalificacionId);
                const matchingLogro = logrosOrdenados.find(logro => String(logro._id) === assignmentLogroId);
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
    }, [assignmentsForTable, logrosForTable]);

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

    /** Promedio ponderado por logros (solo logros con al menos 1 nota). Misma lógica que /course/:id/grades. Normalización: (weightedSum / totalWeight) * 100. Nunca NaN. */
    const getPromedioForTablaGeneral = (studentId: string): number | string => {
        const entries = Object.entries(assignmentsByLogro) as [string, { logro: LogroCalificacion; assignments: Assignment[] }][];
        const totalPorcentaje = entries.reduce((s, [, { logro }]) => s + (logro.porcentaje ?? 0), 0);
        const hasWeightedLogros = totalPorcentaje > 0;

        const notas: number[] = [];
        allAssignmentsForPromedio.forEach((a) => {
            const v = getGradeForTabla(studentId, a._id);
            if (typeof v === 'number' && !Number.isNaN(v)) notas.push(v);
        });
        if (notas.length === 0) return '—';
        const simpleProm = notas.reduce((s, n) => s + n, 0) / notas.length;

        if (hasWeightedLogros) {
            let weightedSum = 0;
            let totalWeight = 0;
            for (const [, { logro, assignments }] of entries) {
                const pct = logro.porcentaje ?? 0;
                if (pct <= 0) continue;
                const grades: number[] = [];
                assignments.forEach((a) => {
                    const v = getGradeForTabla(studentId, a._id);
                    if (typeof v === 'number' && !Number.isNaN(v)) grades.push(v);
                });
                if (grades.length === 0) continue;
                const prom = grades.reduce((s, n) => s + n, 0) / grades.length;
                totalWeight += pct;
                weightedSum += prom * (pct / 100);
            }
            if (totalWeight === 0) {
                const rounded = Math.round(simpleProm * 10) / 10;
                return Number.isNaN(rounded) ? '—' : rounded;
            }
            const result = (weightedSum / totalWeight) * 100;
            if (Number.isNaN(result)) return Math.round(simpleProm * 10) / 10;
            return Math.round(result * 10) / 10;
        }

        const rounded = Math.round(simpleProm * 10) / 10;
        return Number.isNaN(rounded) ? '—' : rounded;
    };

    // Efecto para Profesor (Auto-seleccionar materia)
    useEffect(() => {
        if (subjectsForGroup.length === 1 && showAssignmentForm) {
            setFormData(prev => ({ ...prev, courseId: subjectsForGroup[0]._id }));
        }
    }, [subjectsForGroup, showAssignmentForm]);

    // Query para obtener logros de calificación
    const courseIdForLogros = formData.courseId || subjectsForGroup[0]?._id || '';
    const { data: logrosData, isLoading: isLoadingLogros } = useQuery<{ logros: { _id: string; nombre: string; porcentaje: number }[] }>({
        queryKey: ['/api/logros-calificacion', courseIdForLogros],
        queryFn: () =>
            apiRequest('GET', `/api/logros-calificacion?courseId=${encodeURIComponent(courseIdForLogros)}`),
        enabled: !!courseIdForLogros && user?.rol === 'profesor',
    });
    const logros = logrosData?.logros ?? [];

    // Efecto para resetear el formulario
    useEffect(() => {
        if (!showAssignmentForm) {
            setFormData({ titulo: '', descripcion: '', fechaEntrega: '', courseId: '' });
            setAssignmentType(null);
            setLogroCalificacionId('');
            setNewMaterialTitle('');
            setAssignmentMaterials([]);
            setMaterialLinkInput('');
        }
    }, [showAssignmentForm]);

    // Abrir formulario de nueva asignación si viene desde tabla de notas (?openAssignmentForm=1&logroId=...)
    useEffect(() => {
        if (!cursoId || !isProfessor) return;
        const params = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
        if (params.get('openAssignmentForm') === '1') {
            setShowAssignmentForm(true);
            const logroId = params.get('logroId');
            if (logroId) setLogroCalificacionId(logroId);
            // Limpiar query para no reabrir al recargar
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
            if (assignmentType === 'assignment' && logros.length > 0 && !logroCalificacionId) {
                throw new Error('Debes seleccionar el logro de calificación para esta asignación');
            }
            const type = assignmentType === 'reminder' ? 'reminder' : 'assignment';
            const created = await apiRequest<{ _id: string }>('POST', '/api/assignments', {
                titulo: data.titulo,
                descripcion: data.descripcion,
                curso: cursoId,
                courseId: data.courseId,
                fechaEntrega: data.fechaEntrega,
                categoryId: assignmentType === 'assignment' ? (logroCalificacionId || undefined) : undefined,
                logroCalificacionId: assignmentType === 'assignment' ? (logroCalificacionId || undefined) : undefined,
                type,
                isGradable: type === 'assignment',
            });
            if (materialTitle?.trim()) {
                try {
                    await apiRequest('POST', '/api/materials', { assignmentId: created._id, titulo: materialTitle.trim() });
                } catch (_) {}
            }
            for (const m of materials) {
                try {
                    await apiRequest('POST', '/api/assignment-materials', { assignmentId: created._id, type: m.type, url: m.url, fileName: m.fileName });
                } catch (_) {}
            }
            return created;
        },
        onSuccess: () => {
            toast({ title: '¡Asignación creada!', description: 'La asignación ha sido asignada al curso exitosamente.' });
            queryClient.invalidateQueries({ queryKey: ['assignments', cursoId] });
            queryClient.invalidateQueries({ queryKey: ['gradeTableAssignments'] });
            queryClient.invalidateQueries({ queryKey: ['materials'] });
            setFormData({ titulo: '', descripcion: '', fechaEntrega: '', courseId: '' });
            setLogroCalificacionId('');
            setNewMaterialTitle('');
            setAssignmentMaterials([]);
            setMaterialLinkInput('');
            setShowAssignmentForm(false);
        },
        onError: (error: any) => {
            toast({ title: 'Error', description: error.message || 'No se pudo crear la asignación', variant: 'destructive' });
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
            queryClient.invalidateQueries({ queryKey: ['gradeTableAssignments', cursoId, firstSubjectId] });
            queryClient.invalidateQueries({ queryKey: ['assignments', cursoId] });
        },
        onError: (err: Error) => {
            toast({ title: 'Error', description: err.message || 'No se pudo actualizar la nota', variant: 'destructive' });
        },
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        createAssignmentMutation.mutate({ data: formData, newMaterialTitle, materials: assignmentMaterials });
    };

    const handleAddMaterialLink = () => {
        const url = materialLinkInput.trim();
        if (!url) return;
        const type = url.includes('docs.google.com') ? 'gdoc' : 'link';
        setAssignmentMaterials((prev) => [...prev, { type, url, fileName: url.split('/').pop() || undefined }]);
        setMaterialLinkInput('');
    };

    const handleCreateGoogleDoc = async () => {
        setCreatingGdoc(true);
        try {
            const res = await apiRequest<{ url: string; documentId?: string }>('POST', '/api/integrations/google/create-doc', { title: formData.titulo || 'Documento' });
            setAssignmentMaterials((prev) => [...prev, { type: 'gdoc', url: res.url, fileName: 'Documento Google' }]);
            toast({ title: 'Documento creado', description: 'Se ha añadido el enlace a los materiales.' });
        } catch (err: unknown) {
            toast({ title: 'Error', description: (err as { message?: string })?.message || 'No se pudo crear el documento.', variant: 'destructive' });
        } finally {
            setCreatingGdoc(false);
        }
    };

    const handleDayClick = (assignment: Assignment) => {
        setLocation(`/assignment/${assignment._id}`);
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


    // 🎯 Vista para Profesor (Gestión de Grupo)
    const renderProfessorView = () => {
        const loading = isLoadingSubjects || isLoadingAssignments || isLoadingStudents;
        const subjects = subjectsForGroup;

        if (loading) {
            return <div className="space-y-4"><Skeleton className="h-10 w-full bg-white/10" /><Skeleton className="h-96 w-full bg-white/10" /></div>;
        }

        // Obtener la primera materia para usar su ID en las notas (si hay materias)
        const firstSubjectId = subjects.length > 0 ? subjects[0]._id : null;

        return (
            <>
                <div className="mb-8">
                    <NavBackButton to="/profesor/academia/cursos" label="Cursos" />
                    <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-white mb-2 font-['Poppins'] break-words">
                        Gestión del Grupo {displayGroupId}
                    </h2>
                    <p className="text-white/60 text-sm sm:text-base">
                        Gestiona estudiantes, notas, tareas y calendario del grupo
                    </p>
                </div>

                {/* 4 Tarjetas: Estudiantes, Tareas, Materiales, Asistencia */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8 max-w-5xl mx-auto">
                    {/* Carta 1: Estudiantes */}
                    <Card 
                        className="bg-gradient-to-br from-white/10 to-white/5 border-white/20 backdrop-blur-xl hover:from-white/15 hover:to-white/10 transition-all cursor-pointer group shadow-lg hover:shadow-xl hover:shadow-[#1e3cff]/20"
                        onClick={() => setLocation(`/course-detail/${cursoId}/estudiantes`)}
                    >
                        <CardHeader className="text-center pb-4">
                            <div className="w-20 h-20 mx-auto mb-4 rounded-3xl bg-gradient-to-br from-[#1e3cff] via-[#002366] to-[#00c8ff] flex items-center justify-center group-hover:scale-110 group-hover:rotate-3 transition-all duration-300 shadow-lg shadow-[#1e3cff]/30">
                                <Users className="w-10 h-10 text-white" />
                            </div>
                            <CardTitle className="text-white text-3xl font-bold font-['Poppins'] mb-2">Estudiantes</CardTitle>
                            <CardDescription className="text-white/70 text-lg">
                                {students.length} {students.length === 1 ? 'estudiante' : 'estudiantes'} registrados
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="text-center pt-0" />
                    </Card>

                    {/* Carta 2: Tareas */}
                    <Card 
                        className="bg-gradient-to-br from-white/10 to-white/5 border-white/20 backdrop-blur-xl hover:from-white/15 hover:to-white/10 transition-all cursor-pointer group shadow-lg hover:shadow-xl hover:shadow-orange-500/20"
                        onClick={() => setLocation(`/profesor/cursos/${cursoId}/tareas`)}
                    >
                        <CardHeader className="text-center pb-4">
                            <div className="w-20 h-20 mx-auto mb-4 rounded-3xl bg-gradient-to-br from-[#002366] via-[#003d7a] to-[#1e3cff] flex items-center justify-center group-hover:scale-110 group-hover:rotate-3 transition-all duration-300 shadow-lg shadow-[#002366]/40">
                                <ClipboardList className="w-10 h-10 text-white" />
                            </div>
                            <CardTitle className="text-white text-3xl font-bold font-['Poppins'] mb-2">Tareas</CardTitle>
                            <CardDescription className="text-white/70 text-lg">
                                {assignments.length} {assignments.length === 1 ? 'tarea' : 'tareas'} asignadas
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="text-center pt-0" />
                    </Card>

                    {/* Carta 3: Materiales */}
                    <Card 
                        className="bg-gradient-to-br from-white/10 to-white/5 border-white/20 backdrop-blur-xl hover:from-white/15 hover:to-white/10 transition-all cursor-pointer group shadow-lg hover:shadow-xl"
                        onClick={() => setLocation(`/course-detail/${cursoId}/materiales`)}
                    >
                        <CardHeader className="text-center pb-4">
                            <div className="w-20 h-20 mx-auto mb-4 rounded-3xl bg-gradient-to-br from-[#003d7a] to-[#00c8ff] flex items-center justify-center group-hover:scale-110 group-hover:rotate-3 transition-all duration-300 shadow-lg">
                                <FileText className="w-10 h-10 text-white" />
                            </div>
                            <CardTitle className="text-white text-3xl font-bold font-['Poppins'] mb-2">Materiales</CardTitle>
                            <CardDescription className="text-white/70 text-lg">
                                Ver y gestionar materiales del curso
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="text-center pt-0" />
                    </Card>

                    {/* Carta 4: Asistencia */}
                    <Card 
                        className="bg-gradient-to-br from-white/10 to-white/5 border-white/20 backdrop-blur-xl hover:from-white/15 hover:to-white/10 transition-all cursor-pointer group shadow-lg hover:shadow-xl hover:shadow-emerald-500/20"
                        onClick={() => setLocation(`/course/${cursoId}/asistencia`)}
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
                </div>

                {/* Tabla General de Notas — integrada al fondo, glass sutil, sin corte */}
                {firstSubjectId && (
                    <section
                        className="mb-8 rounded-[16px] overflow-hidden"
                        style={{
                            background: 'rgba(255,255,255,0.02)',
                            backdropFilter: 'blur(12px)',
                            WebkitBackdropFilter: 'blur(12px)',
                            border: '1px solid rgba(255,255,255,0.06)',
                        }}
                    >
                        {/* Header fluido: mismo fondo, sin bloque separado */}
                        <div className="px-6 pt-6 pb-4">
                            <div className="flex flex-wrap items-start justify-between gap-4">
                                <div>
                                    <h3 className="text-[#E2E8F0] font-semibold flex items-center gap-2 text-lg mb-1">
                                        <Award className="w-5 h-5 text-[#3B82F6]" />
                                        Tabla General de Notas
                                    </h3>
                                    <p className="text-white/60 text-sm">
                                        Las columnas se actualizan al crear asignaciones. Las notas se sincronizan al calificar entregas (Escala: 10-100) — Grupo {displayGroupId}
                                        {subjects.length > 0 && ` · ${subjects[0].nombre}`}
                                    </p>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    <Button
                                        size="sm"
                                        className="rounded-[10px] bg-[#3B82F6] hover:bg-[#2563EB] text-white border-0"
                                        onClick={() => setShowAssignmentForm(true)}
                                    >
                                        <Plus className="w-4 h-4 mr-2" />
                                        Asignar Nueva Asignación
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="rounded-[10px] border-white/20 text-[#E2E8F0] hover:bg-white/5 hover:border-white/30"
                                        onClick={() => setLocation(`/course/${cursoId}/grades`)}
                                    >
                                        <Maximize2 className="w-4 h-4 mr-2" />
                                        Ver Tabla Completa
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="rounded-[10px] border-white/20 text-[#E2E8F0] hover:bg-white/5 hover:border-white/30"
                                        onClick={() => setLocation('/materials')}
                                    >
                                        <FileText className="w-4 h-4 mr-2" />
                                        Materiales
                                    </Button>
                                </div>
                            </div>
                        </div>
                        <div className="px-4 pb-6 pt-0">
                            {isLoadingStudents || isLoadingGradeTable || isLoadingLogrosForTable ? (
                                <div className="space-y-2 py-4">
                                    <Skeleton className="h-12 w-full rounded-xl bg-white/10" />
                                    <Skeleton className="h-12 w-full rounded-xl bg-white/10" />
                                    <Skeleton className="h-12 w-full rounded-xl bg-white/10" />
                                </div>
                            ) : students.length > 0 ? (
                                <div
                                    className="overflow-x-auto rounded-[16px] relative"
                                    style={{
                                        maskImage: 'linear-gradient(to right, transparent, black 24px, black calc(100% - 24px), transparent)',
                                        WebkitMaskImage: 'linear-gradient(to right, transparent, black 24px, black calc(100% - 24px), transparent)',
                                    }}
                                >
                                    <div className="inline-block min-w-full align-middle py-2" style={{ minWidth: '800px' }}>
                                        <table className="min-w-full border-collapse">
                                            <thead>
                                                {Object.keys(assignmentsByLogro).length > 0 ? (
                                                    <>
                                                        <tr
                                                            className="sticky top-0 z-10 border-b border-white/[0.08]"
                                                            style={{ background: 'rgba(255,255,255,0.04)' }}
                                                        >
                                                            <th rowSpan={2} className="sticky left-0 z-20 px-3 py-3 text-left text-xs font-semibold text-white/90 uppercase tracking-wider min-w-[180px] max-w-[180px]" style={{ background: 'rgba(255,255,255,0.04)' }}>
                                                                <div className="flex items-center gap-2">
                                                                    <User className="w-4 h-4 text-white/80" />
                                                                    <span>Estudiante</span>
                                                                </div>
                                                            </th>
                                                            {Object.values(assignmentsByLogro).map((grupo) => {
                                                                const colSpan = grupo.assignments.length > 0 ? grupo.assignments.length : 1;
                                                                const isSinCategoria = grupo.logro._id === 'sin-logro';
                                                                return (
                                                                    <th
                                                                        key={grupo.logro._id}
                                                                        colSpan={colSpan}
                                                                        className={`px-2 py-3 text-center text-xs font-semibold text-white/90 uppercase tracking-wider border-r border-white/[0.06] ${isSinCategoria ? 'text-amber-400/90' : ''}`}
                                                                    >
                                                                        <span>{grupo.logro.nombre.toUpperCase()}</span>
                                                                        {grupo.logro.porcentaje > 0 && (
                                                                            <span className="block text-[10px] text-white/60 font-normal mt-0.5">{grupo.logro.porcentaje}%</span>
                                                                        )}
                                                                    </th>
                                                                );
                                                            })}
                                                            <th rowSpan={2} className="px-3 py-3 text-center text-xs font-semibold text-white/90 uppercase tracking-wider min-w-[80px] max-w-[80px] border-l border-white/[0.06]">
                                                                Promedio
                                                            </th>
                                                            <th rowSpan={2} className="px-3 py-3 text-center text-xs font-semibold text-white/90 uppercase tracking-wider min-w-[80px] max-w-[80px] border-l border-white/[0.06]">
                                                                Predicción
                                                            </th>
                                                        </tr>
                                                        <tr className="border-b border-white/[0.08]" style={{ background: 'rgba(255,255,255,0.03)' }}>
                                                            {Object.values(assignmentsByLogro).flatMap((grupo, grupoIdx) =>
                                                                grupo.assignments.length > 0
                                                                    ? grupo.assignments.map((assignment) => (
                                                                        <th
                                                                            key={assignment._id}
                                                                            className="px-2 py-2 text-center text-[10px] font-medium text-white/70 uppercase tracking-wider border-r border-white/[0.06] min-w-[100px] max-w-[120px]"
                                                                        >
                                                                            <span className="truncate block w-full text-[9px] leading-tight">{assignment.titulo}</span>
                                                                        </th>
                                                                    ))
                                                                    : [(
                                                                        <th key={`empty-${grupo.logro._id}`} className="px-2 py-2 text-center text-[10px] text-white/50 border-r border-white/[0.06] min-w-[100px]">—</th>
                                                                    )]
                                                            )}
                                                        </tr>
                                                    </>
                                                ) : (
                                                    <tr className="sticky top-0 z-10 border-b border-white/[0.08]" style={{ background: 'rgba(255,255,255,0.04)' }}>
                                                        <th className="sticky left-0 z-20 px-3 py-3 text-left text-xs font-semibold text-white/90 uppercase min-w-[180px]" style={{ background: 'rgba(255,255,255,0.04)' }}>
                                                            <div className="flex items-center gap-2"><User className="w-4 h-4 text-white/80" /><span>Estudiante</span></div>
                                                        </th>
                                                        <th className="px-3 py-3 text-center text-xs font-semibold text-white/90 uppercase min-w-[80px]">Promedio</th>
                                                        <th className="px-3 py-3 text-center text-xs font-semibold text-white/90 uppercase min-w-[80px]">Predicción</th>
                                                    </tr>
                                                )}
                                            </thead>
                                            <tbody>
                                                {students.map((student) => {
                                                    const promedio = getPromedioForTablaGeneral(student._id);
                                                    const prediccion = typeof promedio === 'number' ? (promedio / 100 * 5).toFixed(1) : '—';
                                                    return (
                                                        <tr key={student._id} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors duration-200">
                                                            <td
                                                                className="sticky left-0 z-10 px-3 py-2.5 min-w-[180px] max-w-[180px] cursor-pointer group"
                                                                style={{ background: 'inherit' }}
                                                                onClick={() => isProfessor && setLocation(`/profesor/cursos/${cursoId}/estudiantes/${student._id}/notas`)}
                                                            >
                                                                <div className="flex items-center gap-2">
                                                                    <Avatar className="w-7 h-7 flex-shrink-0">
                                                                        <AvatarFallback className="bg-gradient-to-r from-[#3B82F6] to-[#1D4ED8] text-white text-[10px] font-semibold">
                                                                            {student.nombre.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                                                                        </AvatarFallback>
                                                                    </Avatar>
                                                                    <div className="min-w-0 flex-1">
                                                                        <div className={`font-medium text-xs truncate ${isProfessor ? 'text-[#E2E8F0] group-hover:text-[#3B82F6] transition-colors' : 'text-[#E2E8F0]'}`}>{student.nombre}</div>
                                                                        {student.email && <div className="text-[9px] text-white/50 truncate">{student.email}</div>}
                                                                    </div>
                                                                </div>
                                                            </td>
                                                            {Object.keys(assignmentsByLogro).length > 0 && Object.values(assignmentsByLogro).flatMap((grupo) =>
                                                                grupo.assignments.length > 0
                                                                    ? grupo.assignments.map((assignment) => {
                                                                        const subsA = assignment.submissions || assignment.entregas || [];
                                                                        const sub = subsA.find((x: { estudianteId?: { toString?: () => string } }) =>
                                                                            x.estudianteId?.toString?.() === student._id || x.estudianteId === student._id
                                                                        );
                                                                        const cal = (sub as { calificacion?: number })?.calificacion;
                                                                        const displayValue = cal != null && !isNaN(cal) ? cal : '—';
                                                                        const isSinCategoria = grupo.logro._id === 'sin-logro';
                                                                        return (
                                                                            <td key={assignment._id} className="px-2 py-2 align-middle">
                                                                                <PreviewEditableNoteCell
                                                                                    value={displayValue}
                                                                                    isSinCategoria={!!isSinCategoria}
                                                                                    onSave={(calif) => isProfessor && updateGradeMutation.mutate({ assignmentId: assignment._id, estudianteId: student._id, calificacion: calif })}
                                                                                />
                                                                            </td>
                                                                        );
                                                                    })
                                                                    : [(
                                                                        <td key={`empty-${grupo.logro._id}-${student._id}`} className="px-2 py-2 text-center text-xs text-white/40">—</td>
                                                                    )]
                                                            )}
                                                            <td className="px-3 py-2.5 text-center min-w-[80px]">
                                                                <div className="rounded-[12px] bg-white/[0.03] border border-white/[0.06] px-2 py-1.5 inline-block">
                                                                    <span className={`text-sm font-semibold ${promedio === '—' ? 'text-white/40' : 'text-[#E2E8F0]'}`}>
                                                                        {typeof promedio === 'number' ? promedio.toFixed(1) : promedio}
                                                                    </span>
                                                                    {promedio !== '—' && <span className="text-white/50 text-[10px] ml-0.5">/ 100</span>}
                                                                </div>
                                                            </td>
                                                            <td className="px-3 py-2.5 text-center min-w-[80px]">
                                                                <div className="rounded-[12px] bg-white/[0.03] border border-white/[0.06] px-2 py-1.5 inline-block">
                                                                    <span className={`text-sm font-semibold ${prediccion === '—' ? 'text-white/40' : 'text-[#E2E8F0]'}`}>{prediccion}</span>
                                                                    {prediccion !== '—' && <span className="text-white/50 text-[10px] ml-0.5">/ 5</span>}
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center py-12">
                                    <Award className="w-14 h-14 text-white/20 mx-auto mb-3" />
                                    <p className="text-white/50 text-sm">No hay estudiantes para mostrar notas</p>
                                    <p className="text-white/40 text-xs mt-1">Asigna estudiantes al grupo para ver la tabla</p>
                                </div>
                            )}
                        </div>
                    </section>
                )}

                {/* Calendario */}
                {renderCalendarAndAssignmentList(assignments, `Grupo ${displayGroupId}`)}

                {/* Botones de acción y Formulario para asignar asignación (Movido debajo del calendario) */}
                <div className="flex gap-4 mb-8 mt-8">
                    <Button
                        onClick={() => setShowAssignmentForm(!showAssignmentForm)}
                        className="bg-gradient-to-r from-[#002366] to-[#1e3cff] hover:opacity-90"
                        data-testid="button-assign-task"
                    >
                        <ClipboardList className="w-4 h-4 mr-2" />
                        {showAssignmentForm ? 'Cancelar' : 'Asignar Nueva Asignación'}
                    </Button>
                </div>

                {showAssignmentForm && (
                    <Card className="bg-white/5 border-white/10 backdrop-blur-md mb-8">
                           <CardHeader>
                                <CardTitle className="text-white">Nueva Asignación</CardTitle>
                            </CardHeader>
                            <CardContent>
                                {!assignmentType ? (
                                    <div className="space-y-4">
                                        <p className="text-white/70 mb-4">Selecciona el tipo de tarea:</p>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <Button
                                                type="button"
                                                onClick={() => setAssignmentType('recordatorio')}
                                                className="h-32 flex flex-col items-center justify-center gap-3 bg-gradient-to-br from-[#1e3cff]/20 to-[#002366]/20 border border-[#1e3cff]/40 hover:from-[#1e3cff]/30 hover:to-[#002366]/30 hover:border-[#1e3cff]/60 transition-all"
                                            >
                                                <Bell className="w-8 h-8 text-[#00c8ff]" />
                                                <span className="text-white font-semibold">Recordatorio</span>
                                                <span className="text-white/60 text-sm">No entregable, sin nota. Puede tener adjuntos.</span>
                                            </Button>
                                            <Button
                                                type="button"
                                                onClick={() => setAssignmentType('assignment')}
                                                className="h-32 flex flex-col items-center justify-center gap-3 bg-gradient-to-br from-[#1e3cff]/20 to-[#002366]/20 border border-[#1e3cff]/40 hover:from-[#1e3cff]/30 hover:to-[#002366]/30 hover:border-[#1e3cff]/60 transition-all"
                                            >
                                                <ClipboardList className="w-8 h-8 text-[#00c8ff]" />
                                                <span className="text-white font-semibold">Asignación</span>
                                                <span className="text-white/60 text-sm">Entregable, puede generar nota. Requiere logro.</span>
                                            </Button>
                                        </div>
                                    </div>
                                ) : (
                                    // Formulario de tarea
                                    <>
                                        <div className="flex items-center justify-between mb-4">
                                            <div className="flex items-center gap-2">
                                                <Badge className="bg-[#1e3cff]/20 text-white border border-[#1e3cff]/40">
                                                    {assignmentType === 'recordatorio' ? 'Recordatorio' : 'Asignación'}
                                                </Badge>
                                            </div>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => setAssignmentType(null)}
                                                className="text-white/70 hover:text-white"
                                            >
                                                <X className="w-4 h-4 mr-1" />
                                                Cambiar tipo
                                            </Button>
                                        </div>

                                        {subjects.length === 0 && (
                                            <Alert className="mb-4 bg-red-500/10 border-red-500/50">
                                                <AlertCircle className="h-4 w-4 text-red-400" />
                                                <AlertDescription className="text-red-200">
                                                    No tienes materias asignadas a este curso ({displayGroupId}). Por favor contacta al administrador.
                                                </AlertDescription>
                                            </Alert>
                                        )}

                                        <form onSubmit={handleSubmit} className="space-y-4">
                                    {/* Selector de Materia */}
                                    {subjects.length > 1 && (
                                        <div>
                                            <Label htmlFor="materia" className="text-white">Materia *</Label>
                                            <Select
                                                value={formData.courseId}
                                                onValueChange={(value) => setFormData({ ...formData, courseId: value })}
                                                required
                                            >
                                                <SelectTrigger className="bg-white/5 border-white/10 text-white"><SelectValue placeholder="Selecciona la materia" /></SelectTrigger>
                                                <SelectContent>
                                                    {subjects.map((subject) => (
                                                        <SelectItem key={subject._id} value={subject._id}>{subject.nombre}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    )}

                                    {/* Badge de Materia auto-seleccionada */}
                                    {subjects.length === 1 && (
                                        <div>
                                            <Label className="text-white mb-2 block">Materia</Label>
                                            <div className="flex items-center gap-2">
                                                <Badge className="bg-[#1e3cff]/20 text-white border border-[#1e3cff]/40 text-base px-4 py-2">
                                                    {subjects[0].nombre}
                                                </Badge>
                                                <span className="text-white/50 text-sm">(auto-seleccionada)</span>
                                            </div>
                                        </div>
                                    )}

                                    {/* Selector de Logro (obligatorio solo para Asignación entregable) */}
                                    {logros.length > 0 && assignmentType === 'assignment' && (
                                        <div>
                                            <Label htmlFor="logro" className="text-white">Logro de Calificación *</Label>
                                            <Select
                                                value={logroCalificacionId}
                                                onValueChange={setLogroCalificacionId}
                                                required={assignmentType === 'assignment'}
                                            >
                                                <SelectTrigger className="bg-white/5 border-white/10 text-white">
                                                    <SelectValue placeholder="Selecciona el tipo de logro (ej: Tareas, Exámenes, Proyectos)" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {logros.map((logro) => (
                                                        <SelectItem key={logro._id} value={logro._id}>
                                                            {logro.nombre} ({logro.porcentaje}%)
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            <p className="text-white/50 text-xs mt-1">Selecciona a qué categoría de calificación pertenece esta asignación</p>
                                        </div>
                                    )}

                                    {logros.length === 0 && courseIdForLogros && !isLoadingLogros && (
                                        <Alert className="mb-4 bg-amber-500/10 border-amber-500/50">
                                            <AlertCircle className="h-4 w-4 text-amber-400" />
                                            <AlertDescription className="text-amber-200">
                                                Configura los logros de calificación para esta materia antes de crear asignaciones. Ve a <Button variant="link" className="p-0 h-auto text-amber-300 underline" onClick={() => setLocation('/profesor/academia/calificacion/logros')}>Logros de Calificación</Button>
                                            </AlertDescription>
                                        </Alert>
                                    )}

                                            <div><Label htmlFor="titulo" className="text-white">Nombre</Label><Input id="titulo" value={formData.titulo} onChange={(e) => setFormData({ ...formData, titulo: e.target.value })} required className="bg-white/5 border-white/10 text-white" placeholder="Nombre de la tarea" /></div>
                                            <div><Label htmlFor="instrucciones" className="text-white">Instrucciones</Label><Textarea id="instrucciones" value={formData.descripcion} onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })} required className="bg-white/5 border-white/10 text-white" placeholder="Instrucciones para el estudiante" rows={4} /></div>
                                            <div><Label htmlFor="fechaEntrega" className="text-white">Fecha de Entrega</Label><Input id="fechaEntrega" type="datetime-local" value={formData.fechaEntrega} onChange={(e) => setFormData({ ...formData, fechaEntrega: e.target.value })} required className="bg-white/5 border-white/10 text-white" /></div>
                                            <div>
                                                <Label htmlFor="newMaterialTitle" className="text-white">Crear material nuevo (opcional)</Label>
                                                <Input id="newMaterialTitle" value={newMaterialTitle} onChange={(e) => setNewMaterialTitle(e.target.value)} className="bg-white/5 border-white/10 text-white" placeholder="Título del material para vincular a esta tarea" />
                                                <p className="text-white/50 text-xs mt-1">Se creará un material en Materiales y se vinculará a esta asignación</p>
                                            </div>

                                            <div className="space-y-3">
                                                <h3 className="text-sm font-semibold text-white">Materiales</h3>
                                                <div className="flex gap-2">
                                                    <Input
                                                        value={materialLinkInput}
                                                        onChange={(e) => setMaterialLinkInput(e.target.value)}
                                                        onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddMaterialLink())}
                                                        className="bg-white/5 border-white/10 text-white flex-1"
                                                        placeholder="URL (PDF, DOCX, enlace, Google Docs…)"
                                                    />
                                                    <Button type="button" variant="outline" size="sm" className="border-white/20 text-white shrink-0" onClick={handleAddMaterialLink}>
                                                        Añadir enlace
                                                    </Button>
                                                </div>
                                                <Button type="button" variant="outline" size="sm" className="w-full border-white/20 text-white" onClick={handleCreateGoogleDoc} disabled={creatingGdoc}>
                                                    <FileUp className="w-4 h-4 mr-2" />
                                                    {creatingGdoc ? 'Creando…' : 'Crear Documento en Google'}
                                                </Button>
                                                {assignmentMaterials.length > 0 && (
                                                    <ul className="space-y-1.5 mt-2">
                                                        {assignmentMaterials.map((m, i) => (
                                                            <li key={i} className="flex items-center justify-between gap-2 py-1.5 px-2 rounded bg-white/5 border border-white/10 text-white text-sm">
                                                                <span className="truncate">{m.fileName || m.url}</span>
                                                                <Button type="button" variant="ghost" size="sm" className="text-white/70 hover:text-white shrink-0 h-7 w-7 p-0" onClick={() => setAssignmentMaterials((prev) => prev.filter((_, j) => j !== i))}>
                                                                    <X className="w-4 h-4" />
                                                                </Button>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                )}
                                            </div>

                                            <Button type="submit" disabled={createAssignmentMutation.isPending || subjects.length === 0 || (assignmentType === 'assignment' && logros.length > 0 && !logroCalificacionId)} className="w-full bg-gradient-to-r from-[#002366] to-[#1e3cff] hover:opacity-90">
                                                {createAssignmentMutation.isPending ? 'Creando...' : 'Crear Asignación'}
                                            </Button>
                                        </form>
                                    </>
                                )}
                            </CardContent>
                    </Card>
                )}

                {/* Dialog para Lista de Estudiantes */}
                <Dialog open={showStudentsDialog} onOpenChange={setShowStudentsDialog}>
                    <DialogContent className="bg-[#0a0a2a] border-white/10 text-white max-w-4xl max-h-[80vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle className="text-white flex items-center gap-2">
                                <Users className="w-5 h-5 text-[#1e3cff]" />
                                Estudiantes del Grupo {displayGroupId}
                            </DialogTitle>
                            <DialogDescription className="text-white/60">
                                {students.length} {students.length === 1 ? 'estudiante' : 'estudiantes'} conectados a este grupo
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
                                                    setLocation(`/profesor/cursos/${cursoId}/estudiantes/${student._id}`);
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
                    <NavBackButton to="/courses" label="Materias" />
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
                    <NavBackButton to="/courses" label="Materias" />
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
        const { promedioFinal: computedPromedio, ultimaNota: computedUltima } = materiaNotas && logrosStudent.length > 0
            ? computeWeightedPromedioAndUltima(materiaNotas, logrosStudent)
            : materiaNotas
                ? { promedioFinal: Number(materiaNotas.promedio) || 0, ultimaNota: Number(materiaNotas.ultimaNota) || 0 }
                : { promedioFinal: 0, ultimaNota: 0 };
        const promedioReal = materiaNotas != null ? computedPromedio : null;
        const ultimaNotaReal = materiaNotas != null ? computedUltima : null;
        const estadoReal = materiaNotas != null ? (computedPromedio >= 65 ? 'aprobado' : 'reprobado') : null;

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
        const logrosOrdenados = [...logrosStudent].sort((a, b) => (a.orden ?? 999) - (b.orden ?? 999));
        const totalPctLogros = logrosOrdenados.reduce((s, l) => s + (l.porcentaje ?? 0), 0);
        const hasWeightedLogros = totalPctLogros > 0 && logrosOrdenados.length > 0;
        type CategoriaNota = { categoria: string; promedio: number; notas: { actividad: string; nota: number; fecha: string; comentario?: string | null }[] };
        const categoriasNotas: CategoriaNota[] = [];
        if (hasWeightedLogros && logrosOrdenados.length > 0) {
            for (const logro of logrosOrdenados) {
                const notasEnCat = notasList.filter((n) => String(n.gradingCategoryId ?? '') === String(logro._id));
                const promCat = notasEnCat.length > 0 ? notasEnCat.reduce((s, x) => s + noteScoreFrom(x), 0) / notasEnCat.length : 0;
                categoriasNotas.push({
                    categoria: `${logro.nombre} (${logro.porcentaje ?? 0}%)`,
                    promedio: Math.round(promCat * 10) / 10,
                    notas: notasEnCat.map((n) => ({
                        actividad: n.tareaTitulo ?? 'Sin título',
                        nota: noteScoreFrom(n),
                        fecha: n.fecha ?? '',
                        comentario: n.comentario ?? null,
                    })),
                });
            }
            const sinCat = notasList.filter((n) => !n.gradingCategoryId);
            if (sinCat.length > 0) {
                const promSin = sinCat.reduce((s, x) => s + noteScoreFrom(x), 0) / sinCat.length;
                categoriasNotas.push({
                    categoria: 'Sin categoría',
                    promedio: Math.round(promSin * 10) / 10,
                    notas: sinCat.map((n) => ({
                        actividad: n.tareaTitulo ?? 'Sin título',
                        nota: noteScoreFrom(n),
                        fecha: n.fecha ?? '',
                        comentario: n.comentario ?? null,
                    })),
                });
            }
        } else if (notasList.length > 0) {
            const prom = notasList.reduce((s, x) => s + noteScoreFrom(x), 0) / notasList.length;
            categoriasNotas.push({
                categoria: 'Notas',
                promedio: Math.round(prom * 10) / 10,
                notas: notasList.map((n) => ({
                    actividad: n.tareaTitulo ?? 'Sin título',
                    nota: noteScoreFrom(n),
                    fecha: n.fecha ?? '',
                    comentario: n.comentario ?? null,
                })),
            });
        }

        return (
            <>
                {/* Breadcrumbs */}
                <Breadcrumb className="mb-6">
                    <BreadcrumbList>
                        <BreadcrumbItem>
                            <BreadcrumbLink
                                onClick={() => setLocation('/courses')}
                                className="text-white/70 hover:text-[#3B82F6] cursor-pointer transition-colors duration-200"
                            >
                                <Home className="w-4 h-4 mr-1" />
                                Materias
                            </BreadcrumbLink>
                        </BreadcrumbItem>
                        <BreadcrumbSeparator className="text-white/40" />
                        <BreadcrumbItem>
                            <BreadcrumbPage className="text-[#E2E8F0]">{details.nombre}</BreadcrumbPage>
                        </BreadcrumbItem>
                    </BreadcrumbList>
                </Breadcrumb>

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
                                <NavBackButton to="/courses" label="Materias" />
                                <Button
                                    className="bg-[#3B82F6] hover:bg-[#2563EB] text-white border-0 transition-all duration-200 hover:shadow-lg hover:shadow-[#3B82F6]/30"
                                    onClick={() => setLocation('/mi-aprendizaje/tareas')}
                                >
                                    <ClipboardList className="w-4 h-4 mr-2" />
                                    Ver Tareas
                                </Button>
                                <Button
                                    variant="outline"
                                    className="border-white/20 text-[#E2E8F0] hover:bg-white/5 hover:border-white/30 backdrop-blur-sm transition-all duration-200"
                                    onClick={() => setLocation('/mi-aprendizaje/notas')}
                                >
                                    <Award className="w-4 h-4 mr-2" />
                                    Ver Notas
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Resumen General: mismo estilo que tarjetas vista profesor (glass, hover, iconos animados) */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8 max-w-5xl mx-auto">
                    <Card className="bg-gradient-to-br from-white/10 to-white/5 border-white/20 backdrop-blur-xl hover:from-white/15 hover:to-white/10 transition-all duration-300 group shadow-lg hover:shadow-xl hover:shadow-[#3B82F6]/20">
                        <CardContent className="p-6 text-center">
                            <div className="w-20 h-20 mx-auto mb-4 rounded-3xl bg-gradient-to-br from-[#1e3cff] via-[#002366] to-[#00c8ff] flex items-center justify-center group-hover:scale-110 group-hover:rotate-3 transition-all duration-300 shadow-lg shadow-[#1e3cff]/30">
                                <TrendingUp className="w-10 h-10 text-white" />
                            </div>
                            <p className="text-white/70 text-sm mb-1">Promedio</p>
                            <p className="text-3xl font-bold text-[#E2E8F0]">
                                {promedioReal != null ? (Math.round(promedioReal * 10) / 10).toFixed(1) : '—'}
                            </p>
                            <p className="text-white/50 text-xs mt-1">/ 100</p>
                        </CardContent>
                    </Card>
                    <Card className="bg-gradient-to-br from-white/10 to-white/5 border-white/20 backdrop-blur-xl hover:from-white/15 hover:to-white/10 transition-all duration-300 group shadow-lg hover:shadow-xl hover:shadow-[#3B82F6]/20">
                        <CardContent className="p-6 text-center">
                            <div className="w-20 h-20 mx-auto mb-4 rounded-3xl bg-gradient-to-br from-[#002366] via-[#003d7a] to-[#1e3cff] flex items-center justify-center group-hover:scale-110 group-hover:rotate-3 transition-all duration-300 shadow-lg shadow-[#002366]/40">
                                <Award className="w-10 h-10 text-white" />
                            </div>
                            <p className="text-white/70 text-sm mb-1">Última Nota</p>
                            <p className="text-3xl font-bold text-[#E2E8F0]">
                                {ultimaNotaReal != null ? (Math.round(ultimaNotaReal * 10) / 10).toFixed(1) : '—'}
                            </p>
                            <p className="text-white/50 text-xs mt-1">/ 100</p>
                        </CardContent>
                    </Card>
                    <Card className="bg-gradient-to-br from-white/10 to-white/5 border-white/20 backdrop-blur-xl hover:from-white/15 hover:to-white/10 transition-all duration-300 group shadow-lg hover:shadow-xl hover:shadow-emerald-500/20">
                        <CardContent className="p-6 text-center">
                            <div className="w-20 h-20 mx-auto mb-4 rounded-3xl bg-gradient-to-br from-[#059669] via-[#10B981] to-emerald-400 flex items-center justify-center group-hover:scale-110 group-hover:rotate-3 transition-all duration-300 shadow-lg shadow-emerald-500/30">
                                <Gauge className="w-10 h-10 text-white" />
                            </div>
                            <p className="text-white/70 text-sm mb-1">Estado</p>
                            {estadoReal ? (
                                <Badge className={`${getEstadoColor(estadoReal)} text-base px-3 py-1 transition-transform duration-200 hover:scale-105`}>
                                    {estadoReal.charAt(0).toUpperCase() + estadoReal.slice(1)}
                                </Badge>
                            ) : (
                                <span className="text-white/50 text-sm">Sin datos</span>
                            )}
                        </CardContent>
                    </Card>
                    <Card className="bg-gradient-to-br from-white/10 to-white/5 border-white/20 backdrop-blur-xl hover:from-white/15 hover:to-white/10 transition-all duration-300 group shadow-lg hover:shadow-xl hover:shadow-orange-500/20">
                        <CardContent className="p-6 text-center">
                            <div className="w-20 h-20 mx-auto mb-4 rounded-3xl bg-gradient-to-br from-amber-500 via-orange-500 to-yellow-500 flex items-center justify-center group-hover:scale-110 group-hover:rotate-3 transition-all duration-300 shadow-lg shadow-orange-500/30">
                                <Clock className="w-10 h-10 text-white" />
                            </div>
                            <p className="text-white/70 text-sm mb-1">Próxima Tarea</p>
                            {proximaTarea ? (
                                <>
                                    <p className="text-lg font-semibold text-[#E2E8F0] line-clamp-1">{proximaTarea.titulo}</p>
                                    <p className="text-white/50 text-xs mt-1">
                                        {new Date(proximaTarea.fechaEntrega).toLocaleDateString('es-CO', {
                                            day: 'numeric',
                                            month: 'short'
                                        })}
                                    </p>
                                </>
                            ) : (
                                <p className="text-white/60 text-sm">Sin tareas pendientes</p>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* Secciones con Pestañas: mismo estilo que vista profesor (#3B82F6, panel glass) */}
                <Tabs defaultValue="tareas" className="w-full">
                    <TabsList className="panel-grades border border-white/10 rounded-xl mb-6 p-1 gap-1 transition-all duration-200">
                        <TabsTrigger
                            value="tareas"
                            className="data-[state=active]:bg-[#3B82F6] data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#3B82F6] data-[state=active]:to-[#1D4ED8] transition-all duration-200 rounded-lg"
                        >
                            <ClipboardList className="w-4 h-4 mr-2" />
                            Tareas ({assignments.length})
                        </TabsTrigger>
                        <TabsTrigger
                            value="notas"
                            className="data-[state=active]:bg-[#3B82F6] data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#3B82F6] data-[state=active]:to-[#1D4ED8] transition-all duration-200 rounded-lg"
                        >
                            <Award className="w-4 h-4 mr-2" />
                            Notas
                        </TabsTrigger>
                        <TabsTrigger
                            value="materiales"
                            className="data-[state=active]:bg-[#3B82F6] data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#3B82F6] data-[state=active]:to-[#1D4ED8] transition-all duration-200 rounded-lg"
                        >
                            <FileText className="w-4 h-4 mr-2" />
                            Materiales
                        </TabsTrigger>
                        <TabsTrigger
                            value="anuncios"
                            className="data-[state=active]:bg-[#3B82F6] data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#3B82F6] data-[state=active]:to-[#1D4ED8] transition-all duration-200 rounded-lg"
                        >
                            <Bell className="w-4 h-4 mr-2" />
                            Anuncios
                        </TabsTrigger>
                    </TabsList>

                    {/* Pestaña de Tareas */}
                    <TabsContent value="tareas" className="space-y-6 mt-0">
                        {assignments.length > 0 ? (
                            <>
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
                                        <Calendar assignments={assignments} onDayClick={handleDayClick} />
                                    </CardContent>
                                </Card>

                                <Card className="panel-grades border border-white/10 rounded-2xl overflow-hidden transition-all duration-200 hover:shadow-[0_0_40px_rgba(37,99,235,0.2)]">
                                    <CardHeader>
                                        <CardTitle className="text-[#E2E8F0]">Lista de Tareas</CardTitle>
                                        <CardDescription className="text-white/60">
                                            {assignments.length} {assignments.length === 1 ? 'tarea asignada' : 'tareas asignadas'}
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="space-y-3">
                                            {assignments
                                                .sort((a, b) => new Date(a.fechaEntrega).getTime() - new Date(b.fechaEntrega).getTime())
                                                .map((assignment) => {
                                                    const fechaEntrega = new Date(assignment.fechaEntrega);
                                                    const diasRestantes = Math.ceil((fechaEntrega.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                                                    const isVencida = fechaEntrega < now;
                                                    return (
                                                        <div
                                                            key={assignment._id}
                                                            className="p-5 rounded-xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.06] hover:border-white/10 hover:shadow-lg hover:shadow-[#3B82F6]/10 transition-all duration-200 cursor-pointer group"
                                                            onClick={() => setLocation(`/assignment/${assignment._id}`)}
                                                        >
                                                            <div className="flex items-start justify-between gap-4">
                                                                <div className="flex-1">
                                                                    <div className="flex items-center gap-3 mb-2">
                                                                        <h4 className="font-semibold text-[#E2E8F0] text-lg group-hover:text-[#3B82F6] transition-colors">
                                                                            {assignment.titulo}
                                                                        </h4>
                                                                        {isVencida ? (
                                                                            <Badge className="bg-red-500/20 text-red-400 border-red-500/40">
                                                                                Vencida
                                                                            </Badge>
                                                                        ) : diasRestantes <= 3 ? (
                                                                            <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/40">
                                                                                Próxima
                                                                            </Badge>
                                                                        ) : null}
                                                                    </div>
                                                                    <p className="text-sm text-white/70 mb-3 line-clamp-2">
                                                                        {assignment.descripcion}
                                                                    </p>
                                                                    <div className="flex flex-wrap items-center gap-4 text-sm text-white/60">
                                                                        <div className="flex items-center gap-2">
                                                                            <User className="w-4 h-4" />
                                                                            <span>{assignment.profesorNombre}</span>
                                                                        </div>
                                                                        <div className="flex items-center gap-2">
                                                                            <CalendarIcon className="w-4 h-4" />
                                                                            <span>
                                                                                {fechaEntrega.toLocaleDateString('es-CO', {
                                                                                    day: 'numeric',
                                                                                    month: 'long',
                                                                                    year: 'numeric'
                                                                                })}
                                                                            </span>
                                                                        </div>
                                                                        <div className="flex items-center gap-2">
                                                                            <Clock className="w-4 h-4" />
                                                                            <span>
                                                                                {fechaEntrega.toLocaleTimeString('es-CO', {
                                                                                    hour: '2-digit',
                                                                                    minute: '2-digit'
                                                                                })}
                                                                            </span>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                                <ChevronRight className="w-5 h-5 text-white/40 group-hover:text-[#3B82F6] group-hover:translate-x-0.5 transition-all duration-200 flex-shrink-0 mt-1" />
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                        </div>
                                    </CardContent>
                                </Card>
                            </>
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
                            <CardHeader>
                                <CardTitle className="text-[#E2E8F0] flex items-center gap-2">
                                    <Award className="w-5 h-5 text-[#3B82F6]" />
                                    Notas de {details.nombre}
                                </CardTitle>
                                <CardDescription className="text-white/60">
                                    Revisa tu rendimiento académico en esta materia
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                {categoriasNotas.length > 0 ? (
                                    <div className="space-y-6">
                                        {categoriasNotas.map((categoria, idx) => (
                                            <div key={idx} className="space-y-3">
                                                <div className="flex items-center justify-between">
                                                    <h4 className="font-semibold text-[#E2E8F0]">{categoria.categoria}</h4>
                                                    <span className="text-lg font-bold text-[#E2E8F0]">
                                                        {Math.round(categoria.promedio)} <span className="text-white/50">/ 100</span>
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
                                                                    <span className="text-2xl font-bold text-[#E2E8F0]">{Math.round(nota.nota)}</span>
                                                                    <span className="text-white/50">/ 100</span>
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

                    {/* Pestaña de Materiales */}
                    <TabsContent value="materiales" className="mt-0">
                        <Card className="panel-grades border border-white/10 rounded-2xl overflow-hidden transition-all duration-200 hover:shadow-[0_0_40px_rgba(37,99,235,0.2)]">
                            <CardHeader>
                                <CardTitle className="text-[#E2E8F0] flex items-center gap-2">
                                    <FileText className="w-5 h-5 text-[#3B82F6]" />
                                    Materiales de {details.nombre}
                                </CardTitle>
                                <CardDescription className="text-white/60">
                                    Documentos, recursos y materiales del curso
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="text-center py-12">
                                    <FileText className="w-16 h-16 text-[#3B82F6]/50 mx-auto mb-4 transition-transform duration-200 hover:scale-110" />
                                    <h3 className="text-xl font-semibold text-[#E2E8F0] mb-2">
                                        Materiales del curso
                                    </h3>
                                    <p className="text-white/60 mb-6">
                                        Los materiales y recursos estarán disponibles próximamente.
                                    </p>
                                    <Button
                                        variant="outline"
                                        className="border-white/20 text-[#E2E8F0] hover:bg-white/5 hover:border-white/30 transition-all duration-200"
                                        onClick={() => setLocation('/materials')}
                                    >
                                        <FileText className="w-4 h-4 mr-2" />
                                        Ver Materiales Generales
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* Pestaña de Anuncios */}
                    <TabsContent value="anuncios" className="mt-0">
                        <Card className="panel-grades border border-white/10 rounded-2xl overflow-hidden transition-all duration-200 hover:shadow-[0_0_40px_rgba(37,99,235,0.2)]">
                            <CardHeader>
                                <CardTitle className="text-[#E2E8F0] flex items-center gap-2">
                                    <Bell className="w-5 h-5 text-[#3B82F6]" />
                                    Anuncios del Profesor
                                </CardTitle>
                                <CardDescription className="text-white/60">
                                    Comunicaciones importantes de {details.profesor?.nombre || 'tu profesor'}
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="text-center py-12">
                                    <Bell className="w-16 h-16 text-[#3B82F6]/50 mx-auto mb-4 transition-transform duration-200 hover:scale-110" />
                                    <h3 className="text-xl font-semibold text-[#E2E8F0] mb-2">
                                        Sin anuncios
                                    </h3>
                                    <p className="text-white/60">
                                        No hay anuncios nuevos del profesor en este momento.
                                    </p>
                                </div>
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
                    <Calendar assignments={assignments} onDayClick={handleDayClick} />
                </CardContent>
            </Card>
        </>
    );

    // --------------------------------------------------
    // 4. Renderizado Final (Lógica centralizada)
    // --------------------------------------------------

    const renderContent = () => {
        if (isProfessor) {
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

    return (
        <div className="flex-1 overflow-auto p-4 sm:p-6 md:p-8">
            <div className="max-w-7xl mx-auto w-full">
                {renderContent()}
            </div>
        </div>
    );
}