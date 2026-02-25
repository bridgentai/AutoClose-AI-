import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/lib/authContext';
import { Award, User, Plus, Settings, Percent } from 'lucide-react';
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

    // Query 3: Asignaciones para tabla de notas
    const { data: assignmentsForTable = [], isLoading: isLoadingGradeTable } = useQuery<Assignment[]>({
        queryKey: ['gradeTableAssignments', cursoId, firstSubjectId],
        queryFn: () => fetchGradeTableAssignments(displayGroupId, firstSubjectId || ''),
        enabled: !!cursoId && !!firstSubjectId && user?.rol === 'profesor',
        staleTime: 2 * 60 * 1000,
        gcTime: 5 * 60 * 1000,
    });

    // Query 4: Logros de calificación para esta materia
    const { data: logrosData, isLoading: isLoadingLogros } = useQuery<LogrosResponse>({
        queryKey: ['/api/logros-calificacion', firstSubjectId],
        queryFn: () =>
            apiRequest<LogrosResponse>('GET', `/api/logros-calificacion?courseId=${encodeURIComponent(firstSubjectId || '')}`),
        enabled: !!firstSubjectId && user?.rol === 'profesor',
        staleTime: 5 * 60 * 1000,
        gcTime: 10 * 60 * 1000,
    });

    // Agrupar asignaciones por logro y ordenar
    const assignmentsByLogro = useMemo(() => {
        const logros = logrosData?.logros || [];
        // Ordenar logros por su campo 'orden' o por nombre si no tienen orden
        const logrosOrdenados = [...logros].sort((a, b) => {
            const ordenA = a.orden ?? 999;
            const ordenB = b.orden ?? 999;
            if (ordenA !== ordenB) return ordenA - ordenB;
            return a.nombre.localeCompare(b.nombre);
        });
        
        const grouped: Record<string, { logro: LogroCalificacion; assignments: Assignment[] }> = {};
        
        // Inicializar grupos por logro (en orden)
        logrosOrdenados.forEach(logro => {
            grouped[logro._id] = { logro, assignments: [] };
        });
        
        // Agregar asignaciones sin logro a un grupo especial
        const sinLogro: Assignment[] = [];
        
        assignmentsForTable.forEach(assignment => {
            if (assignment.logroCalificacionId) {
                // Normalizar IDs para comparación (pueden venir como string u ObjectId)
                const assignmentLogroId = String(assignment.logroCalificacionId);
                const matchingLogro = logrosOrdenados.find(logro => 
                    String(logro._id) === assignmentLogroId
                );
                
                if (matchingLogro && grouped[matchingLogro._id]) {
                    grouped[matchingLogro._id].assignments.push(assignment);
                } else {
                    // Si no encuentra el logro, agregar a sin logro
                    console.warn(`Asignación ${assignment._id} tiene logroCalificacionId ${assignmentLogroId} que no existe en los logros`);
                    sinLogro.push(assignment);
                }
            } else {
                sinLogro.push(assignment);
            }
        });
        
        // Si hay asignaciones sin logro, crear un grupo temporal al final
        if (sinLogro.length > 0) {
            grouped['sin-logro'] = {
                logro: { _id: 'sin-logro', nombre: 'Sin categoría', porcentaje: 0, orden: 999 },
                assignments: sinLogro
            };
        }
        
        return grouped;
    }, [assignmentsForTable, logrosData]);

    // Calcular promedio ponderado por logros
    const calcularPromedioPonderado = (studentId: string): number | string => {
        const logros = logrosData?.logros || [];
        if (logros.length === 0) {
            // Si no hay logros configurados, calcular promedio simple
            const subs = (a: Assignment) => a.submissions || a.entregas || [];
            const notasValidas: number[] = [];
            assignmentsForTable.forEach(a => {
                const s = subs(a).find((x: { estudianteId?: { toString?: () => string } }) =>
                    x.estudianteId?.toString?.() === studentId || x.estudianteId === studentId
                );
                const cal = (s as { calificacion?: number })?.calificacion;
                if (cal != null && !isNaN(cal)) notasValidas.push(cal);
            });
            return notasValidas.length > 0
                ? Math.round(notasValidas.reduce((a, b) => a + b, 0) / notasValidas.length)
                : '-';
        }

        let totalPonderado = 0;
        let totalPorcentaje = 0;

        logros.forEach(logro => {
            const assignmentsDelLogro = assignmentsByLogro[logro._id]?.assignments || [];
            const subs = (a: Assignment) => a.submissions || a.entregas || [];
            const notasDelLogro: number[] = [];
            
            assignmentsDelLogro.forEach(a => {
                const s = subs(a).find((x: { estudianteId?: { toString?: () => string } }) =>
                    x.estudianteId?.toString?.() === studentId || x.estudianteId === studentId
                );
                const cal = (s as { calificacion?: number })?.calificacion;
                if (cal != null && !isNaN(cal)) notasDelLogro.push(cal);
            });

            if (notasDelLogro.length > 0) {
                const promedioLogro = notasDelLogro.reduce((a, b) => a + b, 0) / notasDelLogro.length;
                const ponderacion = (promedioLogro * logro.porcentaje) / 100;
                totalPonderado += ponderacion;
                totalPorcentaje += logro.porcentaje;
            }
        });

        if (totalPonderado === 0) return '-';
        
        // Si el total de porcentajes es menor a 100, ajustar
        const factorAjuste = totalPorcentaje > 0 ? (100 / totalPorcentaje) : 1;
        return Math.round(totalPonderado * factorAjuste);
    };

    // Redirigir si no es profesor
    useEffect(() => {
        if (user && user.rol !== 'profesor') {
            setLocation('/courses');
        }
    }, [user, setLocation]);

    const loading = isLoadingSubjects || isLoadingStudents || isLoadingGradeTable || isLoadingLogros;
    const subjects = subjectsForGroup;
    const subjectName = subjects.length > 0 ? subjects[0].nombre : '';

    return (
        <div className="w-full min-h-[calc(100vh-8rem)]">
            <div className="w-full mx-auto px-2 md:px-4 lg:px-6 py-4 md:py-6 lg:py-8">
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
                                    Las notas se sincronizan automáticamente al calificar entregas (Escala: 10-100)
                                    {displayGroupId && ` - Grupo ${displayGroupId}`}
                                    {subjectName && ` - ${subjectName}`}
                                </CardDescription>
                            </div>
                            <div className="flex flex-wrap gap-2">
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
                                    onClick={() => setLocation(`/course/${cursoId}/grades/input`)}
                                >
                                    Vista por categorías
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="border-white/40 text-white hover:bg-white/20 hover:border-white/60 text-sm px-4 py-2"
                                    onClick={() => setLocation(`/course/${cursoId}/analytics`)}
                                >
                                    Vista analítica
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="border-white/40 text-white hover:bg-white/20 hover:border-white/60 text-sm px-4 py-2"
                                    onClick={() => setLocation('/profesor/academia/calificacion/logros')}
                                >
                                    <Percent className="w-4 h-4 mr-2" />
                                    Logros de Calificación
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
                            <div className="w-full rounded-xl border border-[#002366]/20 shadow-sm" style={{ overflowX: 'auto', maxWidth: '100%' }}>
                                <div className="inline-block min-w-full align-middle">
                                    <table className="border-collapse bg-white" style={{ width: '100%', minWidth: '800px' }}>
                                        <thead>
                                            {/* Fila de encabezados de logros (categorías) */}
                                            {Object.keys(assignmentsByLogro).length > 0 && (
                                                <tr className="bg-gradient-to-r from-[#1e3cff] to-[#002366] border-b-2 border-white/30">
                                                    <th 
                                                        rowSpan={2}
                                                        className="sticky left-0 z-20 bg-[#1e3cff] px-3 py-3 text-left text-xs font-bold text-white uppercase tracking-wider border-r-2 border-white/30 shadow-md min-w-[180px] max-w-[180px]"
                                                    >
                                                        <div className="flex items-center gap-2">
                                                            <User className="w-4 h-4 text-white" />
                                                            <span>Estudiante</span>
                                                        </div>
                                                    </th>
                                                    {Object.values(assignmentsByLogro).map((grupo, grupoIdx) => {
                                                        if (grupo.assignments.length === 0) return null;
                                                        const colSpan = grupo.assignments.length;
                                                        const isSinCategoria = grupo.logro._id === 'sin-logro';
                                                        return (
                                                            <th
                                                                key={grupo.logro._id}
                                                                colSpan={colSpan}
                                                                className={`px-3 py-3 text-center text-xs font-bold text-white uppercase tracking-wider border-r-2 border-white/30 ${
                                                                    isSinCategoria ? 'bg-amber-600/80' : grupoIdx % 2 === 0 ? 'bg-[#1e3cff]' : 'bg-[#002366]'
                                                                }`}
                                                            >
                                                                <div className="flex flex-col items-center justify-center gap-1">
                                                                    <span className="font-bold">{grupo.logro.nombre.toUpperCase()}</span>
                                                                    {grupo.logro.porcentaje > 0 && (
                                                                        <span className="text-[10px] text-white/90 font-normal">
                                                                            {grupo.logro.porcentaje}% del total
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </th>
                                                        );
                                                    })}
                                                    <th 
                                                        rowSpan={2}
                                                        className="px-3 py-3 text-center text-xs font-bold text-white uppercase tracking-wider bg-[#1e3cff] min-w-[100px] max-w-[100px] border-l-2 border-white/30"
                                                    >
                                                        Promedio
                                                    </th>
                                                </tr>
                                            )}
                                            {/* Fila de encabezados de asignaciones individuales */}
                                            <tr className="bg-gradient-to-r from-[#002366] to-[#003d7a] border-b-2 border-[#002366]">
                                                {Object.values(assignmentsByLogro).flatMap((grupo, grupoIdx) =>
                                                    grupo.assignments.map((assignment, idx) => {
                                                        const isSinCategoria = grupo.logro._id === 'sin-logro';
                                                        return (
                                                            <th
                                                                key={assignment._id}
                                                                className={`px-2 py-2 text-center text-[10px] font-bold text-white uppercase tracking-wider border-r border-white/20 min-w-[100px] max-w-[120px] ${
                                                                    isSinCategoria 
                                                                        ? 'bg-amber-500/60' 
                                                                        : idx % 2 === 0
                                                                        ? 'bg-[#002366]'
                                                                        : 'bg-[#003d7a]'
                                                                }`}
                                                            >
                                                                <span className="truncate block w-full mx-auto text-[9px] leading-tight px-1">
                                                                    {assignment.titulo}
                                                                </span>
                                                            </th>
                                                        );
                                                    })
                                                )}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {students.map((student, studentIdx) => {
                                                const promedio = calcularPromedioPonderado(student._id);

                                                return (
                                                    <tr
                                                        key={student._id}
                                                        className={`border-b border-[#002366]/10 hover:bg-[#1e3cff]/5 transition-all ${
                                                            studentIdx % 2 === 0 ? 'bg-white' : 'bg-[#002366]/5'
                                                        }`}
                                                    >
                                                        <td className="sticky left-0 z-10 px-2 py-2 bg-inherit border-r border-[#002366]/20 shadow-sm min-w-[180px] max-w-[180px]">
                                                            <div className="flex items-center gap-2">
                                                                <Avatar className="w-7 h-7 flex-shrink-0">
                                                                    <AvatarFallback className="bg-gradient-to-r from-[#002366] to-[#1e3cff] text-white text-[10px] font-semibold">
                                                                        {student.nombre.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                                                                    </AvatarFallback>
                                                                </Avatar>
                                                                <div className="min-w-0 flex-1">
                                                                    <div className="font-semibold text-[#0a0a2a] text-xs truncate leading-tight">
                                                                        {student.nombre}
                                                                    </div>
                                                                    {student.email && (
                                                                        <div className="text-[9px] text-gray-500 truncate leading-tight">
                                                                            {student.email}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </td>
                                                        {Object.values(assignmentsByLogro).flatMap((grupo, grupoIdx) =>
                                                            grupo.assignments.map((assignment, actIdx) => {
                                                                const subsA = assignment.submissions || assignment.entregas || [];
                                                                const sub = subsA.find((x: { estudianteId?: { toString?: () => string } }) =>
                                                                    x.estudianteId?.toString?.() === student._id || x.estudianteId === student._id
                                                                );
                                                                const cal = (sub as { calificacion?: number })?.calificacion;
                                                                const displayValue = cal != null && !isNaN(cal) ? String(cal) : '--';
                                                                const isSinCategoria = grupo.logro._id === 'sin-logro';
                                                                return (
                                                                    <td
                                                                        key={assignment._id}
                                                                        className={`px-2 py-2 border-r-2 border-[#002366]/30 text-center text-xs font-medium min-w-[100px] max-w-[120px] ${
                                                                            isSinCategoria
                                                                                ? 'bg-amber-50 hover:bg-amber-100'
                                                                                : actIdx % 2 === 0 
                                                                                ? 'bg-white' 
                                                                                : 'bg-[#002366]/5'
                                                                        } hover:bg-[#1e3cff]/10 transition-colors`}
                                                                    >
                                                                        <span className={displayValue === '--' ? 'text-gray-400' : 'text-[#0a0a2a] font-semibold'}>
                                                                            {displayValue}
                                                                        </span>
                                                                    </td>
                                                                );
                                                            })
                                                        )}
                                                        <td className="px-2 py-2 text-center border-l-2 border-[#002366]/20 bg-[#002366]/5 min-w-[100px] max-w-[100px]">
                                                            <div className="flex items-center justify-center gap-1">
                                                                <span className={`text-sm font-bold ${promedio === '-' ? 'text-gray-400' : 'text-[#0a0a2a]'}`}>
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
