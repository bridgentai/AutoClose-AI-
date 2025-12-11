import { useState } from 'react';
import { useAuth } from '@/lib/authContext';
import { AppSidebar } from '@/components/app-sidebar';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { GraduationCap, User, ArrowRight, AlertCircle, BookOpen, Users, Home, ClipboardList, Settings } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

// =========================================================
// 1. INTERFACES Y CONSTANTES
// =========================================================

interface Professor {
_id: string;
nombre: string;
email: string;
}

// 🎯 INTERFAZ DE MATERIA (Course Subject) - Lo que ve el Estudiante/Padre/Directivo
interface Course {
_id: string; // ID de la Materia (ej. Matemáticas)
nombre: string;
descripcion?: string;
profesorIds?: Professor[]; 
cursos?: string[]; 
colorAcento?: string;
icono?: string;
}

// Interfaz para la vista de Profesor (Sus asignaciones de Grupos)
interface ProfessorGroupAssignment {
groupId: string; // El ID del grupo (ej. "10A")
subjects: Course[]; // Las materias que imparte en ese grupo
totalStudents: number;
}


const GRADIENT_COLORS = [
'from-purple-500 to-pink-500',
'from-blue-500 to-cyan-500',
'from-green-500 to-emerald-500',
'from-yellow-500 to-orange-500',
'from-red-500 to-rose-500',
'from-indigo-500 to-purple-500',
'from-teal-500 to-cyan-500',
'from-amber-500 to-yellow-500',
'from-violet-500 to-purple-500',
'from-fuchsia-500 to-pink-500',
];

// 🎯 FUNCIÓN DE FETCHING - MODIFICADA para reflejar la nueva lógica
const fetchCoursesByRole = async (userRole: string | undefined): Promise<Course[]> => {
if (!userRole) return [];

let endpoint = '';

switch (userRole) {
case 'estudiante':
case 'padre':
endpoint = '/api/users/me/courses'; 
break;
case 'profesor':
            // Esta función ya no se usa para el profesor, pero se mantiene por estructura
return []; 

case 'directivo':
endpoint = '/api/courses/all';
break;
default:
return [];
}

return apiRequest('GET', endpoint);
};

// 🎯 FETCH ESPECÍFICO PARA PROFESOR (Grupos Asignados)
const fetchProfessorGroups = async (): Promise<ProfessorGroupAssignment[]> => {
    // Asumiendo que el backend maneja esta ruta para devolver los grupos que dicta
return apiRequest('GET', '/api/professor/my-groups');
};

// =========================================================
// 2. COMPONENTE PRINCIPAL
// =========================================================

export default function CoursesPage() {
const { user } = useAuth();
const [, setLocation] = useLocation();
const userRole = user?.rol;

// Query para Estudiante, Padre, Directivo (devuelve Course[])
const { data: courses = [], isLoading: isLoadingCourses, error: errorCourses } = useQuery<Course[]>({
queryKey: ['courses', userRole],
queryFn: () => fetchCoursesByRole(userRole),
enabled: !!userRole && userRole !== 'profesor',
});

// 🎯 Query específica para Profesor (devuelve ProfessorGroupAssignment[])
const { data: professorGroups = [], isLoading: isLoadingGroups, error: errorGroups } = useQuery<ProfessorGroupAssignment[]>({
queryKey: ['professorGroups'],
queryFn: fetchProfessorGroups,
enabled: userRole === 'profesor',
});

const isLoading = isLoadingCourses || isLoadingGroups;
const error = errorCourses || errorGroups;
const coursesToRender = userRole === 'profesor' ? professorGroups : courses;

// ------------------------------
// Handlers
// ------------------------------

const handleCourseClick = (id: string, isGroup = false) => {
setLocation(`/course-detail/${id}`);
};

// ------------------------------
// Vistas por rol
// ------------------------------

// 🎯 VISTA PARA PROFESOR - Muestra los GRUPOS que está dictando
const renderProfessorView = () => {

const groups = professorGroups;

return (
<>
{/* 🎯 CAMBIO APLICADO: Botón de Asignación junto al título */}
<div className="flex justify-between items-center mb-6">
<h2 className="text-3xl font-bold text-white font-['Poppins']">Mis Grupos Asignados</h2>
<Button 
variant="outline" 
className="border-white/10 text-white hover:bg-white/10"
onClick={() => setLocation('/group-assignment')} 
>
<Settings className="w-4 h-4 mr-2" />
Gestionar Asignaciones
</Button>
</div>
<p className="text-white/60 mb-8">
Estos son los grupos a los que has asignado tus materias. Haz clic para gestionarlos.
</p>

<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
{groups.map((group, index) => {
const colorClass = GRADIENT_COLORS[index % GRADIENT_COLORS.length];

const subjectNames = group.subjects.map(s => s.nombre);

return (
<Card
key={group.groupId}
className={`bg-white/5 border-white/10 backdrop-blur-md hover-elevate cursor-pointer group`}
onClick={() => handleCourseClick(group.groupId, true)} // Envía el ID del Grupo
>
<CardHeader className="p-4 md:p-6">
<div className="flex items-center justify-between mb-4">
<div
className={`w-16 h-16 rounded-2xl flex items-center justify-center bg-gradient-to-r ${colorClass}`}
>
<Users className="w-8 h-8 text-white" />
</div>
<ArrowRight className="w-5 h-5 text-white/40 group-hover:text-white/80 transition-colors" />
</div>

<CardTitle className="text-white text-3xl font-bold">{group.groupId}</CardTitle>
<CardDescription className="text-white/60 line-clamp-2 mt-1">
Materias: {subjectNames.join(', ') || 'Sin materias asignadas'}
</CardDescription>
<p className="text-sm text-white/40 mt-1">Estudiantes: {group.totalStudents}</p>
</CardHeader>

<CardContent className="p-4 pt-0 md:p-6 md:pt-0">
<Button
variant="outline"
className="w-full border-white/10 text-white hover:bg-white/10"
onClick={e => {
e.stopPropagation();
handleCourseClick(group.groupId, true);
}}
>
Gestionar Tareas
</Button>
</CardContent>
</Card>
);
})}
</div>
</>
);
};


// VISTA PARA ESTUDIANTE / DIRECTIVO (SIN CAMBIOS Mayores)
const renderCourseListView = (isDirectivo = false) => {
const title = isDirectivo ? 'Catálogo de Cursos (Directivo)' : 'Mis Materias Asignadas';
const description = isDirectivo
? 'Lista de todas las materias creadas en el sistema.'
: 'Explora tus materias, revisa tareas y mantente al día.';

return (
<>
<h2 className="text-3xl font-bold text-white mb-2 font-['Poppins']">{title}</h2>
<p className="text-white/60 mb-8">{description}</p>

<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
{courses.map((course, index) => {
const primaryProfessor = course.profesorIds?.[0]?.nombre || 'No Asignado';
const displayColor =
course.colorAcento ||
GRADIENT_COLORS[index % GRADIENT_COLORS.length].split(' ')[0].replace('from-', '');

return (
<Card
key={course._id}
className="bg-white/5 border-white/10 backdrop-blur-md hover-elevate cursor-pointer group"
onClick={() => handleCourseClick(course._id)} // Envía el ID de la Materia
>
<CardHeader className="p-4 md:p-6">
<div className="flex items-center justify-between mb-4">
<div
className="w-16 h-16 rounded-2xl flex items-center justify-center"
style={{ backgroundColor: displayColor }}
>
<BookOpen className="w-8 h-8 text-white" />
</div>
<ArrowRight className="w-5 h-5 text-white/40 group-hover:text-white/80 transition-colors" />
</div>

<CardTitle className="text-white text-2xl font-bold">{course.nombre}</CardTitle>
<CardDescription className="text-white/60 line-clamp-2">
{course.descripcion || 'Sin descripción.'}
</CardDescription>
<p className="text-sm text-white/40 mt-1">Profesor: {primaryProfessor}</p>
<p className="text-xs text-white/30">Grupo(s): {course.cursos?.join(', ') || 'N/A'}</p>
</CardHeader>

<CardContent className="p-4 pt-0 md:p-6 md:pt-0">
<Button
variant="outline"
className="w-full border-white/10 text-white hover:bg-white/10"
onClick={e => {
e.stopPropagation();
handleCourseClick(course._id);
}}
>
{isDirectivo ? 'Ver Detalle' : 'Ingresar'}
</Button>
</CardContent>
</Card>
);
})}
</div>
</>
);
};

// VISTA PARA PADRE (SIN CAMBIOS Mayores)
const renderParentView = () => {
return (
<>
<h2 className="text-3xl font-bold text-white mb-2 font-['Poppins']">Materias de tus Hijos</h2>
<p className="text-white/60 mb-8">
Revisa las materias y el progreso de los estudiantes a tu cargo.
</p>

<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
{courses.map((course, index) => {
const primaryProfessor = course.profesorIds?.[0]?.nombre || 'No Asignado';
const displayColor =
course.colorAcento ||
GRADIENT_COLORS[index % GRADIENT_COLORS.length].split(' ')[0].replace('from-', '');

return (
<Card
key={course._id}
className="bg-white/5 border-white/10 backdrop-blur-md hover-elevate cursor-pointer group"
onClick={() => handleCourseClick(course._id)}
>
<CardHeader className="p-4 md:p-6">
<div className="flex items-center justify-between mb-4">
<div
className="w-16 h-16 rounded-2xl flex items-center justify-center"
style={{ backgroundColor: displayColor }}
>
<ClipboardList className="w-8 h-8 text-white" />
</div>
<ArrowRight className="w-5 h-5 text-white/40 group-hover:text-white/80 transition-colors" />
</div>

<CardTitle className="text-white text-2xl font-bold">{course.nombre}</CardTitle>
<CardDescription className="text-white/60 line-clamp-2">
Materia en el grupo: {course.cursos?.join(', ') || 'N/A'}
</CardDescription>
<p className="text-sm text-white/40 mt-1">Profesor: {primaryProfessor}</p>
</CardHeader>

<CardContent className="p-4 pt-0 md:p-6 md:pt-0">
<Button
variant="outline"
className="w-full border-white/10 text-white hover:bg-white/10"
onClick={e => {
e.stopPropagation();
handleCourseClick(course._id);
}}
>
Ver Progreso
</Button>
</CardContent>
</Card>
);
})}
</div>
</>
);
};

// =========================================================
// 3. RENDER PRINCIPAL
// =========================================================

const viewToRender = () => {
if (isLoading) {
return (
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
{[...Array(4)].map((_, i) => (
<Card key={i} className="bg-white/5 border-white/10 backdrop-blur-md">
<CardHeader className="p-4 md:p-6">
<Skeleton className="w-16 h-16 rounded-2xl bg-white/10" />
<Skeleton className="w-24 h-8 mt-4 bg-white/10" />
<Skeleton className="w-32 h-4 mt-2 bg-white/10" />
</CardHeader>
<CardContent className="p-4 pt-0 md:p-6 md:pt-0">
<Skeleton className="w-full h-10 bg-white/10" />
</CardContent>
</Card>
))}
</div>
);
}

if (error) {
return (
<Alert className="bg-red-500/10 border-red-500/50">
<AlertCircle className="h-4 w-4 text-red-400" />
<AlertTitle className="text-red-200">Error al cargar datos</AlertTitle>
<AlertDescription className="text-red-200">
Ocurrió un error al intentar cargar los datos de cursos/grupos.
</AlertDescription>
</Alert>
);
}

if (coursesToRender.length === 0) {
let emptyMessage = '';
let alertTitle = 'Sin Asignaciones';

if (userRole === 'profesor') {
emptyMessage = 'Aún no te has auto-asignado materias a ningún grupo. Haz clic en "Gestionar Asignaciones" para empezar.';
alertTitle = 'Sin Grupos Activos';
} else if (userRole === 'estudiante') {
emptyMessage = 'No tienes materias inscritas. Por favor, verifica con tu directivo.';
} else if (userRole === 'directivo') {
emptyMessage = 'No hay materias registradas en la plataforma. Crea una nueva materia para empezar.';
} else if (userRole === 'padre') {
emptyMessage = 'No se encontraron materias para tus hijos.';
}

return (
<Alert className="bg-blue-500/10 border-blue-500/50">
<AlertCircle className="h-4 w-4 text-blue-400" />
<AlertTitle className="text-blue-200">{alertTitle}</AlertTitle>
<AlertDescription className="text-blue-200">
{emptyMessage}
</AlertDescription>
</Alert>
);
}

// Llamada a la vista específica
if (userRole === 'profesor') return renderProfessorView();
if (userRole === 'estudiante') return renderCourseListView();
if (userRole === 'directivo') return renderCourseListView(true);
if (userRole === 'padre') return renderParentView();

return <p className="text-white/60">Tu rol no tiene una vista definida para esta sección.</p>;
};

// =========================================================
// RETURN FINAL
// =========================================================

return (
<SidebarProvider>
<div className="flex h-screen w-full bg-gradient-to-br from-[#0a0a0c] via-[#1a001c] to-[#3d0045]">
<AppSidebar />

<SidebarInset className="flex flex-col flex-1">
<header className="flex items-center justify-between p-4 border-b border-white/10 backdrop-blur-xl bg-black/20">
<div className="flex items-center gap-3">
<SidebarTrigger data-testid="button-sidebar-toggle" className="text-white" />
<h1 className="text-xl font-bold text-white font-['Poppins']">
{userRole === 'profesor' ? 'Mis Grupos' : 'Mis Cursos'}
</h1>
</div>

<Button
onClick={() => setLocation('/account')}
variant="ghost"
size="icon"
className="text-white hover:bg-white/10"
data-testid="button-account"
>
<User className="h-5 w-5" />
</Button>
</header>

<main className="flex-1 overflow-y-auto p-6 md:p-10">{viewToRender()}</main>
</SidebarInset>
</div>
</SidebarProvider>
);
}