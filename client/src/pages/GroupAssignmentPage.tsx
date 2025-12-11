import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/authContext';
import { AppSidebar } from '@/components/app-sidebar';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { ArrowLeft, BookOpen, Users, Check, AlertCircle, Loader2, User } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useLocation } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';

// =========================================================
// 1. INTERFACES
// =========================================================

interface Group {
    _id: string;
    nombre: string;
}

interface AssignmentData {
    materiaId: string;
    grupoIds: string[];
    profesorId: string;
}

interface CourseByNameResponse {
    _id: string;
    nombre: string;
}

// =========================================================
// 2. FETCHING DE DATOS
// =========================================================

const fetchAllGroups = async (): Promise<Group[]> => {
    return apiRequest('GET', '/api/groups/all');
};

const fetchCurrentAssignments = async (materiaId: string): Promise<string[]> => {
    if (!materiaId) return [];
    const response = await apiRequest('GET', `/api/professor/assignments/${materiaId}`);
    return response.grupoIds || [];
};

const fetchCourseByName = async (nombre: string): Promise<CourseByNameResponse | null> => {
    if (!nombre) return null;
    try {
        return await apiRequest('GET', `/api/courses/by-name?nombre=${encodeURIComponent(nombre)}`);
    } catch {
        return null;
    }
};

// =========================================================
// 3. COMPONENTE PRINCIPAL
// =========================================================

export default function GroupAssignmentPage() {
    const { user } = useAuth();
    const [, setLocation] = useLocation();
    const { toast } = useToast();

    // Usar el campo correcto de AuthResponse
    const professorId = user?.id || '';
    
    // La materia principal es la primera del array de materias del profesor
    const materiaPrincipalNombre = user?.materias?.[0] || '';

    // Estado para los IDs de Grupo seleccionados
    const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);

    // ------------------------------------
    // Queries
    // ------------------------------------

    // Q1: Buscar el ID de la materia por nombre
    const { data: courseData, isLoading: isLoadingCourse } = useQuery({
        queryKey: ['courseByName', materiaPrincipalNombre],
        queryFn: () => fetchCourseByName(materiaPrincipalNombre),
        enabled: !!materiaPrincipalNombre,
    });

    const selectedMateriaId = courseData?._id || '';
    const selectedMateriaNombre = materiaPrincipalNombre || 'Materia No Definida';

    // Q2: Todos los Grupos
    const { data: groups = [], isLoading: isLoadingGroups } = useQuery<Group[]>({
        queryKey: ['allGroups'],
        queryFn: fetchAllGroups,
    });

    // Q3: Asignaciones actuales para la Materia del Profesor
    const { 
        data: currentGroupAssignments = [], 
        isLoading: isLoadingCurrentAssignments,
        refetch: refetchCurrentAssignments,
    } = useQuery<string[]>({
        queryKey: ['currentAssignments', selectedMateriaId],
        queryFn: () => fetchCurrentAssignments(selectedMateriaId),
        enabled: !!selectedMateriaId, 
    });

    // Efecto para sincronizar los checkboxes con las asignaciones actuales
    useEffect(() => {
        if (selectedMateriaId && !isLoadingCurrentAssignments) {
            setSelectedGroupIds(currentGroupAssignments);
        } else if (!selectedMateriaId) {
            setSelectedGroupIds([]);
        }
    }, [currentGroupAssignments, isLoadingCurrentAssignments, selectedMateriaId]);

    // ------------------------------------
    // Mutations (Guardar Asignaciones)
    // ------------------------------------

    const assignmentMutation = useMutation({
        mutationFn: async (data: AssignmentData) => {
            return await apiRequest('POST', '/api/professor/assign-groups', data);
        },
        onSuccess: () => {
            toast({ 
                title: '¡Asignación Exitosa!', 
                description: `La materia ${selectedMateriaNombre} ha sido asignada a los grupos.`, 
                className: 'bg-green-500 text-white' 
            });
            queryClient.invalidateQueries({ queryKey: ['professorGroups'] }); 
            refetchCurrentAssignments();
        },
        onError: (error: any) => {
            console.error(error);
            toast({ 
                title: 'Error de Asignación', 
                description: 'No se pudo guardar la asignación. Intenta de nuevo.', 
                variant: 'destructive' 
            });
        },
    });

    // ------------------------------------
    // Handlers
    // ------------------------------------

    const handleGroupToggle = (groupId: string, isChecked: boolean) => {
        setSelectedGroupIds(prev => 
            isChecked ? [...prev, groupId] : prev.filter(id => id !== groupId)
        );
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!professorId || !materiaPrincipalNombre) {
            toast({ title: 'Error', description: 'Tu materia principal no está definida.', variant: 'destructive' });
            return;
        }

        assignmentMutation.mutate({
            materiaId: selectedMateriaId || 'new', // El backend usará el nombre del profesor si no existe
            grupoIds: selectedGroupIds,
            profesorId: professorId,
        });
    };

    const isGroupsLoading = isLoadingGroups || isLoadingCurrentAssignments || isLoadingCourse;
    const isSaving = assignmentMutation.isPending;

    // Verificar rol de profesor
    if (user?.rol !== 'profesor') {
        return (
            <div className="p-6 md:p-10 w-full">
                <Alert className="bg-red-500/10 border-red-500/50 mt-8 max-w-lg mx-auto">
                    <AlertCircle className="h-4 w-4 text-red-400" />
                    <AlertTitle className="text-red-200">Acceso Denegado</AlertTitle>
                    <AlertDescription className="text-red-200">
                        Solo los profesores pueden gestionar la asignación de grupos.
                    </AlertDescription>
                </Alert>
            </div>
        );
    }

    // Si no tiene materia principal definida
    if (!materiaPrincipalNombre) {
        return (
            <div className="p-6 md:p-10 w-full">
                <Alert className="bg-yellow-500/10 border-yellow-500/50 mt-8 max-w-lg mx-auto">
                    <AlertCircle className="h-4 w-4 text-yellow-400" />
                    <AlertTitle className="text-yellow-200">Materia Principal Faltante</AlertTitle>
                    <AlertDescription className="text-yellow-200">
                        Tu materia principal no está asignada en tu perfil. Por favor, contacta al directivo.
                    </AlertDescription>
                </Alert>
            </div>
        );
    }

    // ------------------------------------
    // Renderizado
    // ------------------------------------
    return (
        <SidebarProvider>
            <div className="flex h-screen w-full bg-gradient-to-br from-[#0a0a0c] via-[#1a001c] to-[#3d0045]">
                <AppSidebar />
                <SidebarInset className="flex flex-col flex-1">
                    <header className="flex items-center justify-between p-4 border-b border-white/10 backdrop-blur-xl bg-black/20">
                        <div className="flex items-center gap-3">
                            <Button
                                variant="ghost" size="icon" onClick={() => setLocation('/courses')}
                                className="text-white hover:bg-white/10"
                                data-testid="button-back"
                            >
                                <ArrowLeft className="w-5 h-5" />
                            </Button>
                            <SidebarTrigger className="text-white" data-testid="button-sidebar-trigger" />
                            <h1 className="text-xl font-bold text-white font-['Poppins']">
                                Gestión de Asignación de Grupos
                            </h1>
                        </div>
                        <Button
                            onClick={() => setLocation('/mi-perfil')} variant="ghost" size="icon"
                            className="text-white hover:bg-white/10"
                            data-testid="button-profile"
                        >
                            <User className="w-5 h-5" />
                        </Button>
                    </header>

                    <main className="flex-1 overflow-y-auto p-6 md:p-10">
                        <div className="max-w-4xl mx-auto">
                            <Card className="bg-white/5 border-white/10 backdrop-blur-md">
                                <CardHeader>
                                    <CardTitle className="text-white flex items-center gap-2">
                                        <BookOpen className="w-6 h-6 text-[#9f25b8]" />
                                        Asignación de Cursos: {selectedMateriaNombre}
                                    </CardTitle>
                                    <p className="text-white/60">
                                        Marca los grupos (IDs) a los que se les mostrará el contenido de tu materia: <strong>{selectedMateriaNombre}</strong>.
                                    </p>
                                    <div className="mt-2">
                                        <Badge className="bg-[#9f25b8]/20 text-white border border-[#9f25b8]/40">
                                            Materia Principal: {selectedMateriaNombre}
                                        </Badge>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <form onSubmit={handleSubmit} className="space-y-6">
                                        {/* Selección de Grupos */}
                                        <div>
                                            <Label className="text-white mb-2 block">1. Selecciona los Grupos/IDs (Ej. 10A)</Label>
                                            <Card className="bg-white/5 border-white/10">
                                                <CardContent className="p-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                                                    {isGroupsLoading ? (
                                                        <>
                                                            <Skeleton className="h-6 w-full bg-white/10" />
                                                            <Skeleton className="h-6 w-full bg-white/10" />
                                                            <Skeleton className="h-6 w-full bg-white/10" />
                                                        </>
                                                    ) : groups.length === 0 ? (
                                                        <p className="text-white/50 col-span-4">No hay grupos disponibles para asignar.</p>
                                                    ) : (
                                                        groups.map(group => (
                                                            <div key={group._id} className="flex items-center space-x-2">
                                                                <Checkbox
                                                                    id={`group-${group._id}`}
                                                                    checked={selectedGroupIds.includes(group._id)}
                                                                    onCheckedChange={(checked) => handleGroupToggle(group._id, checked === true)}
                                                                    className="border-white/50 data-[state=checked]:bg-[#9f25b8] data-[state=checked]:border-[#9f25b8]"
                                                                    data-testid={`checkbox-group-${group._id}`}
                                                                />
                                                                <Label htmlFor={`group-${group._id}`} className="text-white flex items-center gap-2 cursor-pointer">
                                                                    <Users className="w-4 h-4 text-white/70" />
                                                                    {group.nombre}
                                                                </Label>
                                                            </div>
                                                        ))
                                                    )}
                                                </CardContent>
                                            </Card>
                                        </div>

                                        {/* Resumen y Botón de Guardar */}
                                        <div className="mt-8 pt-4 border-t border-white/10">
                                            <h3 className="text-lg font-semibold text-white mb-2">Grupos Seleccionados</h3>
                                            <div className="flex flex-wrap gap-2 mt-2">
                                                {selectedGroupIds.length > 0 ? (
                                                    selectedGroupIds.map(id => (
                                                        <Badge key={id} className="bg-[#9f25b8]/20 text-white border border-[#9f25b8]/40">
                                                            {id}
                                                        </Badge>
                                                    ))
                                                ) : (
                                                    <Badge variant="outline" className="text-white/50 border-white/20">
                                                        Ningún grupo seleccionado
                                                    </Badge>
                                                )}
                                            </div>
                                        </div>

                                        <Button 
                                            type="submit" 
                                            disabled={!materiaPrincipalNombre || isSaving || selectedGroupIds.length === 0}
                                            className="w-full bg-gradient-to-r from-[#9f25b8] to-[#6a0dad] hover:opacity-90 mt-6"
                                            data-testid="button-submit"
                                        >
                                            {isSaving ? (
                                                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Guardando Asignación...</>
                                            ) : (
                                                <><Check className="w-4 h-4 mr-2" /> Guardar Asignaciones</>
                                            )}
                                        </Button>
                                    </form>
                                </CardContent>
                            </Card>
                        </div>
                    </main>
                </SidebarInset>
            </div>
        </SidebarProvider>
    );
}
