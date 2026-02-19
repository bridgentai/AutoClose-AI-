import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/authContext';
import { Award, User, Plus, Settings, FileText } from 'lucide-react';
import { NavBackButton } from '@/components/nav-back-button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useLocation, useRoute } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Skeleton } from '@/components/ui/skeleton';

// =========================================================
// INTERFACES
// =========================================================

interface Submission {
    estudianteId: string;
    calificacion?: number;
}

interface Assignment {
    _id: string;
    titulo: string;
    descripcion: string;
    curso: string;
    courseId?: string;
    fechaEntrega: string;
    profesorNombre: string;
    submissions?: Submission[];
    entregas?: Submission[];
}

interface CourseSubject {
    _id: string;
    nombre: string;
    descripcion?: string;
    colorAcento?: string;
    profesor?: {
        nombre: string;
    };
    cursoAsignado?: string;
}

interface Student {
    _id: string;
    nombre: string;
    estado: 'excelente' | 'bueno' | 'regular' | 'bajo';
    email?: string;
}

// =========================================================
// FETCHING DE DATOS
// =========================================================

const fetchSubjectsForGroup = async (groupId: string): Promise<CourseSubject[]> => {
    return apiRequest('GET', `/api/courses/for-group/${groupId}`);
};

const fetchGradeTableAssignments = async (groupId: string, courseId: string): Promise<Assignment[]> => {
    return apiRequest('GET', `/api/assignments?groupId=${encodeURIComponent(groupId)}&courseId=${courseId}`);
};

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
// COMPONENTE PRINCIPAL
// =========================================================

export default function CourseGradesTablePage() {
    const [, params] = useRoute('/course/:cursoId/grades');
    const cursoId = params?.cursoId || '';
    const { user } = useAuth();
    const [, setLocation] = useLocation();

    const displayGroupId = cursoId && cursoId.length === 24 && /^[0-9a-fA-F]{24}$/.test(cursoId)
        ? cursoId
        : (cursoId || '').toUpperCase().trim();

    // Query 1: Materias del Profesor para este Grupo
    const { data: subjectsForGroup = [], isLoading: isLoadingSubjects } = useQuery<CourseSubject[]>({
        queryKey: ['subjectsForGroup', cursoId],
        queryFn: () => fetchSubjectsForGroup(cursoId),
        enabled: !!cursoId && user?.rol === 'profesor',
        staleTime: 5 * 60 * 1000,
        gcTime: 10 * 60 * 1000,
    });

    // Query 2: Estudiantes del Grupo
    const { data: students = [], isLoading: isLoadingStudents } = useQuery<Student[]>({
        queryKey: ['students', cursoId],
        queryFn: () => fetchStudentsByGroup(cursoId),
        enabled: !!cursoId && user?.rol === 'profesor',
        staleTime: 5 * 60 * 1000,
        gcTime: 10 * 60 * 1000,
    });

    const firstSubjectId = subjectsForGroup[0]?._id;

    // Query 3: Tareas para tabla de notas
    const { data: assignmentsForTable = [], isLoading: isLoadingGradeTable } = useQuery<Assignment[]>({
        queryKey: ['gradeTableAssignments', cursoId, firstSubjectId],
        queryFn: () => fetchGradeTableAssignments(displayGroupId, firstSubjectId || ''),
        enabled: !!cursoId && !!firstSubjectId && user?.rol === 'profesor',
        staleTime: 2 * 60 * 1000,
        gcTime: 5 * 60 * 1000,
    });

    // Redirigir si no es profesor
    useEffect(() => {
        if (user && user.rol !== 'profesor') {
            setLocation('/courses');
        }
    }, [user, setLocation]);

    const loading = isLoadingSubjects || isLoadingStudents || isLoadingGradeTable;
    const subjects = subjectsForGroup;
    const subjectName = subjects.length > 0 ? subjects[0].nombre : '';

    return (
        <div className="w-full min-h-[calc(100vh-8rem)]">
            <div className="w-full max-w-[98vw] mx-auto px-4 md:px-6 lg:px-8 py-4 md:py-6 lg:py-8">
                {/* Botón de regreso */}
                <div className="mb-6">
                    <NavBackButton to={`/course-detail/${cursoId}`} label="Volver al curso" />
                </div>

                {/* Card principal con la tabla */}
                <Card className="bg-white border-[#002366]/20 shadow-2xl">
                    {/* Header con gradiente */}
                    <CardHeader className="bg-gradient-to-r from-[#002366] to-[#003d7a] text-white rounded-t-lg px-6 py-6">
                        <div className="flex items-start justify-between flex-wrap gap-4">
                            <div className="flex-1 min-w-0">
                                <CardTitle className="text-white flex items-center gap-3 text-2xl md:text-3xl font-bold font-['Poppins'] mb-2">
                                    <Award className="w-6 h-6 md:w-7 md:h-7 text-[#ffd700] flex-shrink-0" />
                                    <span>Tabla General de Notas</span>
                                </CardTitle>
                                <CardDescription className="text-white/90 text-sm md:text-base mt-2">
                                    Las columnas se actualizan al crear tareas. Las notas se sincronizan al calificar entregas (Escala: 10-100)
                                    {displayGroupId && ` - Grupo ${displayGroupId}`}
                                    {subjectName && ` - ${subjectName}`}
                                </CardDescription>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                <Button
                                    size="sm"
                                    className="bg-white/20 border-white/40 text-white hover:bg-white/30 hover:border-white/60 text-sm px-4 py-2"
                                    onClick={() => setLocation(`/course-detail/${cursoId}`)}
                                >
                                    <Plus className="w-4 h-4 mr-2" />
                                    Asignar Nueva Tarea
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="border-white/40 text-white hover:bg-white/20 hover:border-white/60 text-sm px-4 py-2"
                                    onClick={() => setLocation(`/profesor/cursos/${cursoId}/notas`)}
                                >
                                    <Settings className="w-4 h-4 mr-2" />
                                    Gestionar Notas
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="border-white/40 text-white hover:bg-white/20 hover:border-white/60 text-sm px-4 py-2"
                                    onClick={() => setLocation('/materials')}
                                >
                                    <FileText className="w-4 h-4 mr-2" />
                                    Materiales
                                </Button>
                            </div>
                        </div>
                    </CardHeader>

                    {/* Contenido de la tabla */}
                    <CardContent className="p-0">
                        {loading ? (
                            <div className="p-6 space-y-3">
                                <Skeleton className="h-12 w-full bg-[#002366]/10" />
                                <Skeleton className="h-12 w-full bg-[#002366]/10" />
                                <Skeleton className="h-12 w-full bg-[#002366]/10" />
                                <Skeleton className="h-12 w-full bg-[#002366]/10" />
                            </div>
                        ) : students.length > 0 ? (
                            <div className="overflow-x-auto rounded-xl border border-[#002366]/20 shadow-sm">
                                <div className="inline-block min-w-full align-middle">
                                    <table className="min-w-full border-collapse bg-white">
                                        <thead>
                                            <tr className="bg-gradient-to-r from-[#002366] to-[#003d7a] border-b-2 border-[#002366]">
                                                <th className="sticky left-0 z-20 bg-[#002366] px-4 py-4 text-left text-xs font-bold text-white uppercase tracking-wider border-r border-white/20 min-w-[220px] shadow-md">
                                                    <div className="flex items-center gap-2">
                                                        <User className="w-4 h-4 text-white" />
                                                        <span>Estudiante</span>
                                                    </div>
                                                </th>
                                                {assignmentsForTable.map((assignment, idx) => (
                                                    <th
                                                        key={assignment._id}
                                                        className="px-3 py-4 text-center text-xs font-bold text-white uppercase tracking-wider border-r border-white/20 min-w-[140px]"
                                                        style={{
                                                            background: idx % 2 === 0
                                                                ? 'linear-gradient(to bottom, #002366, #003d7a)'
                                                                : 'linear-gradient(to bottom, #003d7a, #002366)'
                                                        }}
                                                    >
                                                        <span className="truncate block max-w-[120px] mx-auto text-[11px] leading-tight">
                                                            {assignment.titulo}
                                                        </span>
                                                    </th>
                                                ))}
                                                <th className="px-4 py-4 text-center text-xs font-bold text-white uppercase tracking-wider bg-[#002366] min-w-[120px] border-l-2 border-white/30">
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
                                                        <td className="sticky left-0 z-10 px-4 py-3 bg-inherit border-r border-[#002366]/20 shadow-sm">
                                                            <div className="flex items-center gap-3">
                                                                <Avatar className="w-9 h-9 flex-shrink-0">
                                                                    <AvatarFallback className="bg-gradient-to-r from-[#002366] to-[#1e3cff] text-white text-xs font-semibold">
                                                                        {student.nombre.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                                                                    </AvatarFallback>
                                                                </Avatar>
                                                                <div className="min-w-0 flex-1">
                                                                    <div className="font-semibold text-[#0a0a2a] text-sm truncate leading-tight">
                                                                        {student.nombre}
                                                                    </div>
                                                                    {student.email && (
                                                                        <div className="text-[11px] text-gray-500 truncate leading-tight">
                                                                            {student.email}
                                                                        </div>
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
                                                                    className={`px-3 py-3 border-r border-[#002366]/20 text-center text-sm font-medium ${
                                                                        actIdx % 2 === 0 ? 'bg-white' : 'bg-[#002366]/5'
                                                                    } hover:bg-[#1e3cff]/10 transition-colors`}
                                                                >
                                                                    <span className={displayValue === '--' ? 'text-gray-400' : 'text-[#0a0a2a] font-semibold'}>
                                                                        {displayValue}
                                                                    </span>
                                                                </td>
                                                            );
                                                        })}
                                                        <td className="px-4 py-3 text-center border-l-2 border-[#002366]/20 bg-[#002366]/5">
                                                            <div className="flex items-center justify-center gap-1">
                                                                <span className={`text-lg font-bold ${promedio === '-' ? 'text-gray-400' : 'text-[#0a0a2a]'}`}>
                                                                    {promedio}
                                                                </span>
                                                                {promedio !== '-' && (
                                                                    <span className="text-gray-500 text-xs">/ 100</span>
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
                            <div className="text-center py-16">
                                <Award className="w-20 h-20 text-[#002366]/40 mx-auto mb-4" />
                                <p className="text-gray-500 text-lg">No hay estudiantes para mostrar notas</p>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
