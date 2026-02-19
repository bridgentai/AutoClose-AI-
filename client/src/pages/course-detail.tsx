import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/authContext';
import { Calendar as CalendarIcon, ClipboardList, AlertCircle, BookOpen, Clock, User, FileText, Bell, TrendingUp, Award, ChevronRight, Home, Users, Eye, Settings, Plus, X, Maximize2 } from 'lucide-react';
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
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { DocumentEditor } from '@/components/document-editor';

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
    const [assignmentType, setAssignmentType] = useState<'recordatorio' | 'documento' | null>(null);
    const [documentContent, setDocumentContent] = useState('');
    const [showStudentsDialog, setShowStudentsDialog] = useState(false);
    const [formData, setFormData] = useState({
        titulo: '',
        descripcion: '',
        fechaEntrega: '',
        courseId: '', // ID de la materia
    });

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

    // Query 5: Tareas para tabla de notas (grupo + materia, sin filtro mes)
    const { data: assignmentsForTable = [], isLoading: isLoadingGradeTable } = useQuery<Assignment[]>({
        queryKey: ['gradeTableAssignments', cursoId, firstSubjectId],
        queryFn: () => fetchGradeTableAssignments(displayGroupId, firstSubjectId || ''),
        enabled: isProfessor && !!cursoId && !!firstSubjectId,
        staleTime: 2 * 60 * 1000,
        gcTime: 5 * 60 * 1000,
    });

    // Efecto para Profesor (Auto-seleccionar materia)
    useEffect(() => {
        if (subjectsForGroup.length === 1 && showAssignmentForm) {
            setFormData(prev => ({ ...prev, courseId: subjectsForGroup[0]._id }));
        }
    }, [subjectsForGroup, showAssignmentForm]);

    // Efecto para resetear el formulario
    useEffect(() => {
        if (!showAssignmentForm) {
            setFormData({ titulo: '', descripcion: '', fechaEntrega: '', courseId: '' });
            setAssignmentType(null);
            setDocumentContent('');
        }
    }, [showAssignmentForm]);

    // Mutation (Crear Tarea)
    const createAssignmentMutation = useMutation({
        mutationFn: async (data: typeof formData) => {
            if (!data.courseId) {
                throw new Error('Debes seleccionar una materia para esta tarea');
            }
            // Aquí enviamos el ID del grupo (cursoId) como el campo 'curso' y el ID de la materia como 'courseId'
            return await apiRequest('POST', '/api/assignments', {
                titulo: data.titulo,
                descripcion: data.descripcion,
                contenidoDocumento: assignmentType === 'documento' ? documentContent : undefined,
                curso: cursoId, 
                courseId: data.courseId,
                fechaEntrega: data.fechaEntrega,
                profesorId: user?.id,
                profesorNombre: user?.nombre,
                colegioId: user?.colegioId || 'default_colegio',
            });
        },
        onSuccess: () => {
            toast({ title: '¡Tarea creada!', description: 'La tarea ha sido asignada al curso exitosamente.' });
            queryClient.invalidateQueries({ queryKey: ['assignments', cursoId] });
            queryClient.invalidateQueries({ queryKey: ['gradeTableAssignments'] });
            setFormData({ titulo: '', descripcion: '', fechaEntrega: '', courseId: '' });
            setShowAssignmentForm(false);
        },
        onError: (error: any) => {
            toast({ title: 'Error', description: error.message || 'No se pudo crear la tarea', variant: 'destructive' });
        },
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        createAssignmentMutation.mutate(formData);
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

                {/* 2 Cartas Centradas */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8 max-w-4xl mx-auto">
                    {/* Carta 1: Estudiantes */}
                    <Card 
                        className="bg-gradient-to-br from-white/10 to-white/5 border-white/20 backdrop-blur-xl hover:from-white/15 hover:to-white/10 transition-all cursor-pointer group shadow-lg hover:shadow-xl hover:shadow-[#1e3cff]/20"
                        onClick={() => setShowStudentsDialog(true)}
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
                        <CardContent className="text-center pt-0">
                            <Button
                                variant="outline"
                                className="border-[#1e3cff]/50 text-[#1e3cff] hover:bg-[#1e3cff]/20 hover:border-[#1e3cff] w-full font-semibold"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setShowStudentsDialog(true);
                                }}
                            >
                                <Users className="w-4 h-4 mr-2" />
                                Ver Lista Completa
                            </Button>
                        </CardContent>
                    </Card>

                    {/* Carta 2: Tareas */}
                    <Card 
                        className="bg-gradient-to-br from-white/10 to-white/5 border-white/20 backdrop-blur-xl hover:from-white/15 hover:to-white/10 transition-all cursor-pointer group shadow-lg hover:shadow-xl hover:shadow-orange-500/20"
                        onClick={() => {
                            // Navegar a la página de tareas del grupo
                            setLocation(`/profesor/cursos/${cursoId}/tareas`);
                        }}
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
                        <CardContent className="text-center pt-0">
                            <Button
                                variant="outline"
                                className="border-orange-500/50 text-orange-400 hover:bg-orange-500/20 hover:border-orange-500 w-full font-semibold"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setLocation(`/profesor/cursos/${cursoId}/tareas`);
                                }}
                            >
                                <ClipboardList className="w-4 h-4 mr-2" />
                                Corregir Tareas
                            </Button>
                        </CardContent>
                    </Card>
                </div>

                {/* Tabla General de Notas (fondo blanco, columnas dinámicas desde tareas) */}
                {firstSubjectId && (
                    <Card className="bg-white border-[#002366]/20 shadow-lg mb-8">
                        <CardHeader className="bg-gradient-to-r from-[#002366] to-[#003d7a] text-white rounded-t-lg">
                            <div className="flex items-center justify-between flex-wrap gap-4">
                                <div>
                                    <CardTitle className="text-white flex items-center gap-2">
                                        <Award className="w-5 h-5 text-[#ffd700]" />
                                        Tabla General de Notas
                                    </CardTitle>
                                    <CardDescription className="text-white/80">
                                        Las columnas se actualizan al crear tareas. Las notas se sincronizan al calificar entregas (Escala: 10-100) - Grupo {displayGroupId}
                                        {subjects.length > 0 && ` - ${subjects[0].nombre}`}
                                    </CardDescription>
                                </div>
                                <div className="flex gap-2">
                                    <Button
                                        size="sm"
                                        className="bg-white/20 border-white/40 text-white hover:bg-white/30 hover:border-white/60"
                                        onClick={() => setShowAssignmentForm(true)}
                                    >
                                        <Plus className="w-4 h-4 mr-2" />
                                        Asignar Nueva Tarea
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="border-white/40 text-white hover:bg-white/20 hover:border-white/60"
                                        onClick={() => setLocation(`/profesor/cursos/${cursoId}/notas`)}
                                    >
                                        <Settings className="w-4 h-4 mr-2" />
                                        Gestionar Notas
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="border-white/40 text-white hover:bg-white/20 hover:border-white/60"
                                        onClick={() => setLocation('/materials')}
                                    >
                                        <FileText className="w-4 h-4 mr-2" />
                                        Materiales
                                    </Button>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            {isLoadingStudents || isLoadingGradeTable ? (
                                <div className="space-y-2">
                                    <Skeleton className="h-12 w-full bg-[#002366]/10" />
                                    <Skeleton className="h-12 w-full bg-[#002366]/10" />
                                    <Skeleton className="h-12 w-full bg-[#002366]/10" />
                                </div>
                            ) : students.length > 0 ? (
                                <div className="overflow-x-auto -mx-4 md:mx-0 rounded-xl border border-[#002366]/20 shadow-sm">
                                    <div className="inline-block min-w-full align-middle px-4 md:px-0">
                                        <table className="min-w-full border-collapse bg-white">
                                            <thead>
                                                <tr className="bg-gradient-to-r from-[#002366] to-[#003d7a] border-b-2 border-[#002366]">
                                                    <th className="sticky left-0 z-20 bg-[#002366] px-3 py-3 text-left text-xs font-bold text-white border-r border-white/20 min-w-[200px] shadow-md">
                                                        <div className="flex items-center gap-2">
                                                            <User className="w-3.5 h-3.5 text-white" />
                                                            <span>Estudiante</span>
                                                        </div>
                                                    </th>
                                                    {assignmentsForTable.map((assignment, idx) => (
                                                        <th
                                                            key={assignment._id}
                                                            className="px-2 py-3 text-center text-xs font-bold text-white border-r border-white/20 min-w-[130px]"
                                                            style={{
                                                                background: idx % 2 === 0
                                                                    ? 'linear-gradient(to bottom, #002366, #003d7a)'
                                                                    : 'linear-gradient(to bottom, #003d7a, #002366)'
                                                            }}
                                                        >
                                                            <span className="truncate block max-w-[110px] mx-auto text-[11px]">{assignment.titulo}</span>
                                                        </th>
                                                    ))}
                                                    <th className="px-3 py-3 text-center text-xs font-bold text-white bg-[#002366] min-w-[100px] border-l-2 border-white/30">
                                                        Promedio
                                                    </th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {students.map((student, studentIdx) => {
                                                    const subs = (a: Assignment) => a.submissions || a.entregas || [];
                                                    const notasValidas: number[] = [];
                                                    assignmentsForTable.forEach(a => {
                                                        const s = subs(a).find((x: { estudianteId?: { toString?: () => string } }) =>
                                                            x.estudianteId?.toString?.() === student._id || x.estudianteId === student._id
                                                        );
                                                        const cal = (s as { calificacion?: number })?.calificacion;
                                                        if (cal != null && !isNaN(cal)) notasValidas.push(cal);
                                                    });
                                                    const promedio = notasValidas.length > 0
                                                        ? Math.round(notasValidas.reduce((a, b) => a + b, 0) / notasValidas.length)
                                                        : '-';

                                                    return (
                                                        <tr
                                                            key={student._id}
                                                            className={`border-b border-[#002366]/10 hover:bg-[#1e3cff]/5 transition-all ${
                                                                studentIdx % 2 === 0 ? 'bg-white' : 'bg-[#002366]/5'
                                                            }`}
                                                        >
                                                            <td className="sticky left-0 z-10 px-3 py-2.5 bg-inherit border-r border-[#002366]/20 shadow-sm">
                                                                <div className="flex items-center gap-2">
                                                                    <Avatar className="w-7 h-7 flex-shrink-0">
                                                                        <AvatarFallback className="bg-gradient-to-r from-[#002366] to-[#1e3cff] text-white text-[10px] font-semibold">
                                                                            {student.nombre.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                                                                        </AvatarFallback>
                                                                    </Avatar>
                                                                    <div className="min-w-0 flex-1">
                                                                        <div className="font-semibold text-[#0a0a2a] text-sm truncate leading-tight">{student.nombre}</div>
                                                                        {student.email && (
                                                                            <div className="text-[10px] text-gray-500 truncate leading-tight">{student.email}</div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </td>
                                                            {assignmentsForTable.map((assignment, actIdx) => {
                                                                const subsA = assignment.submissions || assignment.entregas || [];
                                                                const sub = subsA.find((x: { estudianteId?: { toString?: () => string } }) =>
                                                                    x.estudianteId?.toString?.() === student._id || x.estudianteId === student._id
                                                                );
                                                                const cal = (sub as { calificacion?: number })?.calificacion;
                                                                const displayValue = cal != null && !isNaN(cal) ? String(cal) : '--';
                                                                return (
                                                                    <td
                                                                        key={assignment._id}
                                                                        className={`px-1.5 py-1.5 border-r border-[#002366]/20 text-center text-sm font-medium ${
                                                                            actIdx % 2 === 0 ? 'bg-white' : 'bg-[#002366]/5'
                                                                        } hover:bg-[#1e3cff]/10`}
                                                                    >
                                                                        <span className={displayValue === '--' ? 'text-gray-400' : 'text-[#0a0a2a]'}>
                                                                            {displayValue}
                                                                        </span>
                                                                    </td>
                                                                );
                                                            })}
                                                            <td className="px-3 py-2.5 text-center border-l-2 border-[#002366]/20 bg-[#002366]/5">
                                                                <div className="flex items-center justify-center gap-1">
                                                                    <span className={`text-lg font-bold ${promedio === '-' ? 'text-gray-400' : 'text-[#0a0a2a]'}`}>
                                                                        {promedio}
                                                                    </span>
                                                                    {promedio !== '-' && (
                                                                        <span className="text-gray-500 text-[10px]">/ 100</span>
                                                                    )}
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
                                <div className="text-center py-8">
                                    <Award className="w-16 h-16 text-[#002366]/40 mx-auto mb-4" />
                                    <p className="text-gray-500">No hay estudiantes para mostrar notas</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                )}

                {/* Calendario */}
                {renderCalendarAndAssignmentList(assignments, `Grupo ${displayGroupId}`)}

                {/* Botones de acción y Formulario para asignar tarea (Movido debajo del calendario) */}
                <div className="flex gap-4 mb-8 mt-8">
                    <Button
                        onClick={() => setShowAssignmentForm(!showAssignmentForm)}
                        className="bg-gradient-to-r from-[#002366] to-[#1e3cff] hover:opacity-90"
                        data-testid="button-assign-task"
                    >
                        <ClipboardList className="w-4 h-4 mr-2" />
                        {showAssignmentForm ? 'Cancelar' : 'Asignar Nueva Tarea'}
                    </Button>
                </div>

                {showAssignmentForm && (
                    <Card className="bg-white/5 border-white/10 backdrop-blur-md mb-8">
                           <CardHeader>
                                <CardTitle className="text-white">Nueva Tarea</CardTitle>
                            </CardHeader>
                            <CardContent>
                                {!assignmentType ? (
                                    // Selección de tipo de tarea
                                    <div className="space-y-4">
                                        <p className="text-white/70 mb-4">Selecciona el tipo de tarea que deseas crear:</p>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <Button
                                                type="button"
                                                onClick={() => setAssignmentType('recordatorio')}
                                                className="h-32 flex flex-col items-center justify-center gap-3 bg-gradient-to-br from-[#1e3cff]/20 to-[#002366]/20 border border-[#1e3cff]/40 hover:from-[#1e3cff]/30 hover:to-[#002366]/30 hover:border-[#1e3cff]/60 transition-all"
                                            >
                                                <Bell className="w-8 h-8 text-[#00c8ff]" />
                                                <span className="text-white font-semibold">Recordatorio</span>
                                                <span className="text-white/60 text-sm">Tarea simple con título y descripción</span>
                                            </Button>
                                            <Button
                                                type="button"
                                                onClick={() => setAssignmentType('documento')}
                                                className="h-32 flex flex-col items-center justify-center gap-3 bg-gradient-to-br from-[#1e3cff]/20 to-[#002366]/20 border border-[#1e3cff]/40 hover:from-[#1e3cff]/30 hover:to-[#002366]/30 hover:border-[#1e3cff]/60 transition-all"
                                            >
                                                <FileText className="w-8 h-8 text-[#00c8ff]" />
                                                <span className="text-white font-semibold">Documento</span>
                                                <span className="text-white/60 text-sm">Tarea con editor de documentos completo</span>
                                            </Button>
                                        </div>
                                    </div>
                                ) : (
                                    // Formulario de tarea
                                    <>
                                        <div className="flex items-center justify-between mb-4">
                                            <div className="flex items-center gap-2">
                                                <Badge className="bg-[#1e3cff]/20 text-white border border-[#1e3cff]/40">
                                                    {assignmentType === 'recordatorio' ? 'Recordatorio' : 'Documento'}
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

                                            {/* Campos de Título, Descripción y Fecha */}
                                            <div><Label htmlFor="titulo" className="text-white">Título</Label><Input id="titulo" value={formData.titulo} onChange={(e) => setFormData({ ...formData, titulo: e.target.value })} required className="bg-white/5 border-white/10 text-white" placeholder="Título de la tarea" /></div>
                                            <div><Label htmlFor="descripcion" className="text-white">Descripción</Label><Textarea id="descripcion" value={formData.descripcion} onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })} required className="bg-white/5 border-white/10 text-white" placeholder="Descripción de la tarea" rows={4} /></div>
                                            <div><Label htmlFor="fechaEntrega" className="text-white">Fecha de Entrega</Label><Input id="fechaEntrega" type="datetime-local" value={formData.fechaEntrega} onChange={(e) => setFormData({ ...formData, fechaEntrega: e.target.value })} required className="bg-white/5 border-white/10 text-white" /></div>

                                            {/* Editor de documentos solo para tipo "documento" */}
                                            {assignmentType === 'documento' && (
                                                <div>
                                                    <Label className="text-white mb-2 block">Contenido del Documento</Label>
                                                    <DocumentEditor
                                                        content={documentContent}
                                                        onChange={setDocumentContent}
                                                        readOnly={false}
                                                    />
                                                </div>
                                            )}

                                            <Button type="submit" disabled={createAssignmentMutation.isPending || subjects.length === 0} className="w-full bg-gradient-to-r from-[#002366] to-[#1e3cff] hover:opacity-90">
                                                {createAssignmentMutation.isPending ? 'Creando...' : 'Crear Tarea'}
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
        
        // Datos mock para el resumen (en producción vendrían del backend)
        const promedioMock = 4.2;
        const ultimaNotaMock = 4.5;
        const estadoMock = promedioMock >= 4.5 ? 'excelente' : promedioMock >= 4.0 ? 'bueno' : promedioMock >= 3.5 ? 'regular' : 'bajo';
        
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
            <>
                {/* Breadcrumbs */}
                <Breadcrumb className="mb-6">
                    <BreadcrumbList>
                        <BreadcrumbItem>
                            <BreadcrumbLink 
                                onClick={() => setLocation('/courses')}
                                className="text-white/70 hover:text-white cursor-pointer"
                            >
                                <Home className="w-4 h-4 mr-1" />
                                Materias
                            </BreadcrumbLink>
                        </BreadcrumbItem>
                        <BreadcrumbSeparator className="text-white/40" />
                        <BreadcrumbItem>
                            <BreadcrumbPage className="text-white">{details.nombre}</BreadcrumbPage>
                        </BreadcrumbItem>
                    </BreadcrumbList>
                </Breadcrumb>

                {/* Encabezado Visual Mejorado */}
                <div className="mb-8 relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#1e3cff]/20 via-[#002366]/20 to-[#00c8ff]/20 border border-white/10 backdrop-blur-md">
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent"></div>
                    <div className="relative p-4 sm:p-6 md:p-8">
                        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 sm:gap-6">
                            <div className="flex-1">
                                <div className="flex items-center gap-3 mb-4">
                                    <div
                                        className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg"
                                        style={{ 
                                            backgroundColor: titleColor,
                                            boxShadow: `0 8px 32px ${titleColor}40`
                                        }}
                                    >
                                        <BookOpen className="w-8 h-8 text-white" />
                                    </div>
                        <div>
                                        <Badge 
                                            className="bg-white/10 text-white border-white/20 mb-2"
                                        >
                                            {cursoAsignado}
                            </Badge>
                                        <h1 className="text-4xl md:text-5xl font-extrabold text-white mb-2 font-['Poppins']">
                                {details.nombre}
                                        </h1>
                                    </div>
                                </div>
                                
                                {details.descripcion && (
                                    <p className="text-white/80 text-lg mb-4 max-w-2xl">
                                        {details.descripcion}
                                    </p>
                                )}
                                
                                <div className="flex flex-wrap items-center gap-4 text-white/70">
                                    <div className="flex items-center gap-2">
                                        <User className="w-5 h-5 text-white/60" />
                                        <span className="font-medium text-white/90">
                                            {details.profesor?.nombre || 'No Asignado'}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <CalendarIcon className="w-5 h-5 text-white/60" />
                                        <span>Curso: {cursoAsignado}</span>
                                    </div>
                                </div>
                            </div>
                            
                            {/* Botones de Acción Rápida */}
                            <div className="flex flex-col gap-3">
                                <NavBackButton to="/courses" label="Materias" />
                                <Button
                                    className="bg-gradient-to-r from-[#002366] to-[#1e3cff] hover:opacity-90 text-white"
                                    onClick={() => setLocation('/mi-aprendizaje/tareas')}
                                >
                                    <ClipboardList className="w-4 h-4 mr-2" />
                                    Ver Tareas
                                </Button>
                                <Button
                                    variant="outline"
                                    className="bg-white/5 border-[#1e3cff]/40 text-[#1e3cff] hover:bg-[#1e3cff]/10 backdrop-blur-sm"
                                    onClick={() => setLocation('/mi-aprendizaje/notas')}
                                >
                                    <Award className="w-4 h-4 mr-2" />
                                    Ver Notas
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Resumen General */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                    <Card className="bg-white/5 border-white/10 backdrop-blur-md hover:bg-white/8 transition-colors">
                        <CardContent className="p-6">
                            <div className="flex items-center justify-between mb-2">
                                <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-gradient-to-br from-[#002366] to-[#1e3cff]">
                                    <TrendingUp className="w-6 h-6 text-white" />
                                </div>
                            </div>
                            <p className="text-white/60 text-sm mb-1">Promedio</p>
                            <p className="text-3xl font-bold text-white">{promedioMock.toFixed(1)}</p>
                            <p className="text-white/40 text-xs mt-1">/ 5.0</p>
                        </CardContent>
                    </Card>
                    
                    <Card className="bg-white/5 border-white/10 backdrop-blur-md hover:bg-white/8 transition-colors">
                        <CardContent className="p-6">
                            <div className="flex items-center justify-between mb-2">
                                <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-gradient-to-br from-blue-500 to-cyan-500">
                                    <Award className="w-6 h-6 text-white" />
                                </div>
                            </div>
                            <p className="text-white/60 text-sm mb-1">Última Nota</p>
                            <p className="text-3xl font-bold text-white">{ultimaNotaMock.toFixed(1)}</p>
                            <p className="text-white/40 text-xs mt-1">/ 5.0</p>
                        </CardContent>
                    </Card>
                    
                    <Card className="bg-white/5 border-white/10 backdrop-blur-md hover:bg-white/8 transition-colors">
                        <CardContent className="p-6">
                            <div className="flex items-center justify-between mb-2">
                                <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-gradient-to-br from-green-500 to-emerald-500">
                                    <Badge className={getEstadoColor(estadoMock)}>
                                        {estadoMock.charAt(0).toUpperCase() + estadoMock.slice(1)}
                                    </Badge>
                                </div>
                            </div>
                            <p className="text-white/60 text-sm mb-1">Estado</p>
                            <Badge className={`${getEstadoColor(estadoMock)} text-base px-3 py-1`}>
                                {estadoMock.charAt(0).toUpperCase() + estadoMock.slice(1)}
                            </Badge>
                        </CardContent>
                    </Card>
                    
                    <Card className="bg-white/5 border-white/10 backdrop-blur-md hover:bg-white/8 transition-colors">
                        <CardContent className="p-6">
                            <div className="flex items-center justify-between mb-2">
                                <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-gradient-to-br from-yellow-500 to-orange-500">
                                    <Clock className="w-6 h-6 text-white" />
                            </div>
                    </div>
                            <p className="text-white/60 text-sm mb-1">Próxima Tarea</p>
                            {proximaTarea ? (
                                <>
                                    <p className="text-lg font-semibold text-white line-clamp-1">{proximaTarea.titulo}</p>
                                    <p className="text-white/40 text-xs mt-1">
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

                {/* Secciones con Pestañas */}
                <Tabs defaultValue="tareas" className="w-full">
                    <TabsList className="bg-white/5 border border-white/10 backdrop-blur-md mb-6">
                        <TabsTrigger 
                            value="tareas" 
                            className="data-[state=active]:bg-[#1e3cff] data-[state=active]:text-white data-[state=active]:shadow-lg"
                        >
                            <ClipboardList className="w-4 h-4 mr-2" />
                            Tareas ({assignments.length})
                        </TabsTrigger>
                        <TabsTrigger 
                            value="notas" 
                            className="data-[state=active]:bg-[#1e3cff] data-[state=active]:text-white data-[state=active]:shadow-lg"
                        >
                            <Award className="w-4 h-4 mr-2" />
                            Notas
                        </TabsTrigger>
                        <TabsTrigger 
                            value="materiales" 
                            className="data-[state=active]:bg-[#1e3cff] data-[state=active]:text-white data-[state=active]:shadow-lg"
                        >
                            <FileText className="w-4 h-4 mr-2" />
                            Materiales
                        </TabsTrigger>
                        <TabsTrigger 
                            value="anuncios" 
                            className="data-[state=active]:bg-[#1e3cff] data-[state=active]:text-white data-[state=active]:shadow-lg"
                        >
                            <Bell className="w-4 h-4 mr-2" />
                            Anuncios
                        </TabsTrigger>
                    </TabsList>

                    {/* Pestaña de Tareas */}
                    <TabsContent value="tareas" className="space-y-6">
                        {assignments.length > 0 ? (
                            <>
                <Card className="bg-white/5 border-white/10 backdrop-blur-md">
                                    <CardHeader>
                                        <CardTitle className="text-white flex items-center gap-2">
                                            <CalendarIcon className="w-5 h-5 text-[#1e3cff]" />
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

                                <Card className="bg-white/5 border-white/10 backdrop-blur-md">
                                    <CardHeader>
                                        <CardTitle className="text-white">Lista de Tareas</CardTitle>
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
                                                            className="p-5 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-all cursor-pointer group"
                                                            onClick={() => setLocation(`/assignment/${assignment._id}`)}
                                                        >
                                                            <div className="flex items-start justify-between gap-4">
                                                                <div className="flex-1">
                                                                    <div className="flex items-center gap-3 mb-2">
                                                                        <h4 className="font-semibold text-white text-lg group-hover:text-[#1e3cff] transition-colors">
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
                                                                <ChevronRight className="w-5 h-5 text-white/40 group-hover:text-[#1e3cff] transition-colors flex-shrink-0 mt-1" />
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                        </div>
                                    </CardContent>
                                </Card>
                            </>
                        ) : (
                            <Card className="bg-white/5 border-white/10 backdrop-blur-md">
                                <CardContent className="p-12 text-center">
                                    <ClipboardList className="w-16 h-16 text-[#1e3cff]/40 mx-auto mb-4" />
                                    <h3 className="text-xl font-semibold text-white mb-2">
                                        No hay tareas asignadas
                                    </h3>
                                    <p className="text-white/60">
                                        Aún no se han asignado tareas para esta materia.
                                    </p>
                                </CardContent>
                            </Card>
                        )}
                    </TabsContent>

                    {/* Pestaña de Notas */}
                    <TabsContent value="notas">
                        <Card className="bg-white/5 border-white/10 backdrop-blur-md">
                            <CardHeader>
                                <CardTitle className="text-white flex items-center gap-2">
                                    <Award className="w-5 h-5 text-[#1e3cff]" />
                                    Notas de {details.nombre}
                                </CardTitle>
                                <CardDescription className="text-white/60">
                                    Revisa tu rendimiento académico en esta materia
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="text-center py-12">
                                    <Award className="w-16 h-16 text-[#1e3cff]/40 mx-auto mb-4" />
                                    <h3 className="text-xl font-semibold text-white mb-2">
                                        Ver todas tus notas
                                    </h3>
                                    <p className="text-white/60 mb-6">
                                        Accede a la sección completa de notas para ver tu historial detallado.
                                    </p>
                                    <Button
                                        className="bg-gradient-to-r from-[#002366] to-[#1e3cff] hover:opacity-90 text-white"
                                        onClick={() => setLocation('/mi-aprendizaje/notas')}
                                    >
                                        <Award className="w-4 h-4 mr-2" />
                                        Ir a Mis Notas
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* Pestaña de Materiales */}
                    <TabsContent value="materiales">
                        <Card className="bg-white/5 border-white/10 backdrop-blur-md">
                            <CardHeader>
                                <CardTitle className="text-white flex items-center gap-2">
                                    <FileText className="w-5 h-5 text-[#1e3cff]" />
                                    Materiales de {details.nombre}
                                </CardTitle>
                                <CardDescription className="text-white/60">
                                    Documentos, recursos y materiales del curso
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="text-center py-12">
                                    <FileText className="w-16 h-16 text-[#1e3cff]/40 mx-auto mb-4" />
                                    <h3 className="text-xl font-semibold text-white mb-2">
                                        Materiales del curso
                                    </h3>
                                    <p className="text-white/60 mb-6">
                                        Los materiales y recursos estarán disponibles próximamente.
                                    </p>
                                    <Button
                                        variant="outline"
                                        className="bg-white/5 border-white/20 text-white hover:bg-white/10"
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
                    <TabsContent value="anuncios">
                        <Card className="bg-white/5 border-white/10 backdrop-blur-md">
                            <CardHeader>
                                <CardTitle className="text-white flex items-center gap-2">
                                    <Bell className="w-5 h-5 text-[#1e3cff]" />
                                    Anuncios del Profesor
                                </CardTitle>
                                <CardDescription className="text-white/60">
                                    Comunicaciones importantes de {details.profesor?.nombre || 'tu profesor'}
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="text-center py-12">
                                    <Bell className="w-16 h-16 text-[#1e3cff]/40 mx-auto mb-4" />
                                    <h3 className="text-xl font-semibold text-white mb-2">
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