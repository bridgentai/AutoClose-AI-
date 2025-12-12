import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/authContext';
import { Calendar as CalendarIcon, ClipboardList, ArrowLeft, AlertCircle, BookOpen, Clock, User } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { useLocation, useRoute } from 'wouter';
import { Calendar } from '@/components/Calendar';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';

// =========================================================
// 1. INTERFACES
// =========================================================

interface Assignment {
    _id: string;
    titulo: string;
    descripcion: string;
    curso: string; // ID del grupo (ej. '10A')
    courseId: string; // ID de la materia
    fechaEntrega: string;
    profesorNombre: string;
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


// =========================================================
// 3. COMPONENTE PRINCIPAL
// =========================================================

export default function CourseDetailPage() {
    // La ruta es dinámica. cursoId puede ser: ID de materia o Nombre del Grupo
    const [, params] = useRoute('/course-detail/:cursoId'); 
    const cursoId = params?.cursoId || ''; 
    const { user } = useAuth();
    const userRole = user?.rol;

    // Roles de la aplicación
    const isProfessor = userRole === 'profesor';
    const isStudentOrParent = userRole === 'estudiante' || userRole === 'padre';
    // El directivo ya no tiene lógica de gestión aquí, solo de visualización.

    const [, setLocation] = useLocation();
    const { toast } = useToast();

    // Estados del Formulario
    const [showAssignmentForm, setShowAssignmentForm] = useState(false);
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

    // Query 1: Detalles de la Materia (Habilitada para Estudiante, Padre y Directivo)
    const { data: courseDetails, isLoading: isLoadingDetails } = useQuery<CourseSubject>({
        queryKey: ['courseDetails', cursoId],
        queryFn: () => fetchCourseDetails(cursoId),
        enabled: !isProfessor, // Se habilita si el rol NO es profesor
    });

    // Query 2: Materias del Profesor para este Grupo (Habilitada SOLO para Profesor)
    const { data: subjectsForGroup = [], isLoading: isLoadingSubjects } = useQuery<CourseSubject[]>({
        queryKey: ['subjectsForGroup', cursoId],
        queryFn: () => fetchSubjectsForGroup(cursoId),
        enabled: isProfessor,
    });

    // Query 3: Tareas del Curso/Grupo
    const { data: assignments = [], isLoading: isLoadingAssignments } = useQuery<Assignment[]>({
        queryKey: ['assignments', cursoId, currentMonth, currentYear],
        queryFn: () => fetchAssignments(cursoId, isHandlingGroup, currentMonth, currentYear),
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
        }
    }, [showAssignmentForm]);

    // Mutation (Crear Tarea) - Sin cambios
    const createAssignmentMutation = useMutation({
        mutationFn: async (data: typeof formData) => {
            if (!data.courseId) {
                throw new Error('Debes seleccionar una materia para esta tarea');
            }
            // Aquí enviamos el ID del grupo (cursoId) como el campo 'curso' y el ID de la materia como 'courseId'
            return await apiRequest('POST', '/api/assignments', {
                titulo: data.titulo,
                descripcion: data.descripcion,
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

    // 🎯 Vista para Profesor (Gestión de Grupo)
    const renderProfessorView = () => {
        const loading = isLoadingSubjects || isLoadingAssignments;
        const subjects = subjectsForGroup;

        if (loading) {
            return <div className="space-y-4"><Skeleton className="h-10 w-full bg-white/10" /><Skeleton className="h-96 w-full bg-white/10" /></div>;
        }

        return (
            <>
                <div className="mb-8">
                    <h2 className="text-3xl font-bold text-white mb-2 font-['Poppins']">
                        Gestión del Grupo {cursoId}
                    </h2>
                    <p className="text-white/60">
                        Asigna tareas a tus materias en este grupo y revisa el calendario
                    </p>
                </div>

                {/* Botones de acción y Formulario para asignar tarea (Lógica existente) */}
                <div className="flex gap-4 mb-8">
                    <Button
                        onClick={() => setShowAssignmentForm(!showAssignmentForm)}
                        className="bg-gradient-to-r from-[#9f25b8] to-[#6a0dad] hover:opacity-90"
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
                                {subjects.length === 0 && (
                                    <Alert className="mb-4 bg-red-500/10 border-red-500/50">
                                        <AlertCircle className="h-4 w-4 text-red-400" />
                                        <AlertDescription className="text-red-200">
                                            No tienes materias asignadas a este curso ({cursoId}). Por favor contacta al administrador.
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
                                                <Badge className="bg-[#9f25b8]/20 text-white border border-[#9f25b8]/40 text-base px-4 py-2">
                                                    {subjects[0].nombre}
                                                </Badge>
                                                <span className="text-white/50 text-sm">(auto-seleccionada)</span>
                                            </div>
                                        </div>
                                    )}

                                    {/* Campos de Título, Descripción y Fecha (Sin cambios) */}
                                    <div><Label htmlFor="titulo" className="text-white">Título</Label><Input id="titulo" value={formData.titulo} onChange={(e) => setFormData({ ...formData, titulo: e.target.value })} required className="bg-white/5 border-white/10 text-white" placeholder="Título de la tarea" /></div>
                                    <div><Label htmlFor="descripcion" className="text-white">Descripción</Label><Textarea id="descripcion" value={formData.descripcion} onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })} required className="bg-white/5 border-white/10 text-white" placeholder="Descripción de la tarea" rows={4} /></div>
                                    <div><Label htmlFor="fechaEntrega" className="text-white">Fecha de Entrega</Label><Input id="fechaEntrega" type="datetime-local" value={formData.fechaEntrega} onChange={(e) => setFormData({ ...formData, fechaEntrega: e.target.value })} required className="bg-white/5 border-white/10 text-white" /></div>

                                    <Button type="submit" disabled={createAssignmentMutation.isPending || subjects.length === 0} className="w-full bg-gradient-to-r from-[#9f25b8] to-[#6a0dad] hover:opacity-90">
                                        {createAssignmentMutation.isPending ? 'Creando...' : 'Crear Tarea'}
                                    </Button>
                                </form>
                            </CardContent>
                    </Card>
                )}

                {/* Calendario y Lista de Tareas (Común) */}
                {renderCalendarAndAssignmentList(assignments, `Grupo ${cursoId}`)}
            </>
        );
    };

    // 🎯 Vista para Estudiante/Padre/Directivo (Contenido de la Materia)
    const renderStudentView = () => {
        const loading = isLoadingDetails || isLoadingAssignments;
        const details = courseDetails;

        if (loading) {
            return <div className="space-y-4"><Skeleton className="h-40 w-full bg-white/10" /><Skeleton className="h-96 w-full bg-white/10" /></div>;
        }

        if (!details) {
            return (
                <Alert className="bg-red-500/10 border-red-500/50">
                    <AlertCircle className="h-4 w-4 text-red-400" />
                    <AlertTitle className="text-red-200">Materia no encontrada</AlertTitle>
                    <AlertDescription className="text-red-200">
                        El ID de materia proporcionado es inválido o no tienes acceso.
                    </AlertDescription>
                </Alert>
            );
        }

        const titleColor = details.colorAcento || '#9f25b8';

        return (
            <>
                <div className="mb-8 p-6 rounded-xl" style={{ backgroundColor: `${titleColor}20`, borderLeft: `5px solid ${titleColor}` }}>
                    <div className="flex items-start justify-between">
                        <div>
                            <Badge variant="outline" className={`border-white/20 text-white mb-2`} style={{ backgroundColor: titleColor }}>
                                {userRole === 'estudiante' ? details.cursoAsignado || 'Tu Materia' : 'Materia Oficial'}
                            </Badge>
                            <h2 className="text-4xl font-extrabold text-white mb-1 font-['Poppins']">
                                {details.nombre}
                            </h2>
                            <p className="text-white/70 text-lg">
                                {details.descripcion || 'Sin descripción detallada.'}
                            </p>
                        </div>
                        <BookOpen className="w-12 h-12 text-white/50" />
                    </div>
                    <div className="mt-4 text-sm text-white/80 flex items-center gap-4">
                           <div className="flex items-center gap-2">
                                <User className="w-4 h-4" />
                                <span>**Profesor:** {details.profesor?.nombre || 'No Asignado'}</span>
                            </div>
                    </div>
                </div>

                {/* SECCIÓN DE CONTENIDO (FALTA IMPLEMENTAR) */}
                <h3 className="text-2xl font-bold text-white mb-4 mt-8">Materiales y Módulos</h3>
                <Card className="bg-white/5 border-white/10 backdrop-blur-md">
                    <CardContent className="p-6 text-white/60 text-center">
                        <Clock className="w-8 h-8 mx-auto mb-3 text-white/40" />
                        <p>Esta sección contendrá los módulos, documentos y recursos del curso.</p>
                        <Button variant="ghost" className="text-[#9f25b8] mt-2" onClick={() => setLocation('/materials')}>
                            Ir a Materiales Generales
                        </Button>
                    </CardContent>
                </Card>

                {/* Calendario y Lista de Tareas (Común) */}
                {renderCalendarAndAssignmentList(assignments, details.nombre)}
            </>
        );
    };

    // 🎯 Renderizado Común: Calendario y Lista de Tareas
    const renderCalendarAndAssignmentList = (assignments: Assignment[], titleContext: string) => (
        <>
            {/* Calendario del curso */}
            <Card className="bg-white/5 border-white/10 backdrop-blur-md mt-8">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-white">
                        <CalendarIcon className="w-5 h-5 text-[#9f25b8]" />
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

            {/* Lista de tareas */}
            {assignments.length > 0 && (
                <Card className="bg-white/5 border-white/10 backdrop-blur-md mt-8">
                    <CardHeader>
                        <CardTitle className="text-white">Próximas Tareas</CardTitle>
                        <CardDescription className="text-white/60">
                            {assignments.length} {assignments.length === 1 ? 'tarea pendiente' : 'tareas pendientes'}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            {assignments.map((assignment) => (
                                <div
                                    key={assignment._id}
                                    className="p-4 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
                                    onClick={() => setLocation(`/assignment/${assignment._id}`)}
                                >
                                    <h4 className="font-semibold text-white mb-1">{assignment.titulo}</h4>
                                    <p className="text-sm text-white/70 mb-2">
                                        {assignment.descripcion.substring(0, 80)}...
                                    </p>
                                    <div className="flex justify-between items-center text-xs">
                                        <p className="text-[#9f25b8] font-medium">
                                            Entrega: {new Date(assignment.fechaEntrega).toLocaleString('es-CO')}
                                        </p>
                                        <Badge variant="outline" className="border-white/20 text-white/70">
                                            {isProfessor ? assignment.curso : assignment.profesorNombre}
                                        </Badge>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}
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
        <div className="flex-1 overflow-auto p-8">
            <div className="max-w-7xl mx-auto">
                {renderContent()}
            </div>
        </div>
    );
}