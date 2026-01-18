import { useState, useMemo } from 'react';
import { useAuth } from '@/lib/authContext';
import { GraduationCap, ArrowRight, AlertCircle, BookOpen, Users, Home, ClipboardList, Settings } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { useLocation } from 'wouter';
import { useQuery, useQueries } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { NavBackButton } from '@/components/nav-back-button';

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

// Función para generar un color único basado en un curso/grupo (igual que en Calendar.tsx)
const generateColorFromId = (id: string): string => {
  if (!id) return '#9f25b8'; // Color por defecto si no hay ID
  
  // Hash simple basado en el string
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  // Paleta de colores vibrantes (incluyendo púrpuras y otros colores)
  const colors = [
    '#9f25b8', // Purple Core
    '#6a0dad', // Purple Deep
    '#c66bff', // Purple Light
    '#3b82f6', // Blue
    '#10b981', // Green
    '#f59e0b', // Amber
    '#ef4444', // Red
    '#8b5cf6', // Violet
    '#06b6d4', // Cyan
    '#f97316', // Orange
    '#ec4899', // Pink
    '#14b8a6', // Teal
    '#6366f1', // Indigo
    '#84cc16', // Lime
    '#f43f5e', // Rose
  ];
  
  // Usar el hash para seleccionar un color de la paleta
  const index = Math.abs(hash) % colors.length;
  return colors[index];
};

// Función para obtener el nombre del grupo desde el grupoId
const getGroupDisplayName = (groupId: string): string => {
  // El backend ahora siempre devuelve el nombre del grupo, no ObjectIds
  // Solo normalizamos a mayúsculas para consistencia
  return groupId.toUpperCase().trim();
};

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

// Función para obtener estudiantes de un grupo (igual que en course-detail.tsx)
const fetchStudentsByGroup = async (groupId: string): Promise<number> => {
  try {
    const grupoIdNormalizado = groupId.toUpperCase().trim();
    const response = await apiRequest('GET', `/api/groups/${grupoIdNormalizado}/students`);
    const students = Array.isArray(response) ? response : [];
    return students.length;
  } catch (error) {
    console.error('Error al obtener estudiantes:', error);
    return 0;
  }
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

// Generar colores únicos para cada grupo (garantiza consistencia) - al nivel del componente
const groupColorsMap = useMemo(() => {
  if (userRole !== 'profesor' || !professorGroups || professorGroups.length === 0) {
    return new Map<string, string>();
  }
  const map = new Map<string, string>();
  professorGroups.forEach((group) => {
    if (!map.has(group.groupId)) {
      map.set(group.groupId, generateColorFromId(group.groupId));
    }
  });
  return map;
}, [professorGroups, userRole]);

// Obtener el número real de estudiantes para cada grupo
const studentsQueries = useQueries({
  queries: userRole === 'profesor' && professorGroups ? professorGroups.map((group) => ({
    queryKey: ['groupStudents', group.groupId],
    queryFn: () => fetchStudentsByGroup(group.groupId),
    enabled: !!group.groupId,
    staleTime: 5 * 60 * 1000, // 5 minutos
    gcTime: 10 * 60 * 1000, // 10 minutos de caché
  })) : [],
});

// Crear un mapa de grupoId -> número de estudiantes
const studentsCountMap = useMemo(() => {
  const map = new Map<string, number>();
  if (userRole === 'profesor' && professorGroups && studentsQueries.length > 0) {
    professorGroups.forEach((group, index) => {
      const studentCount = studentsQueries[index]?.data ?? group.totalStudents ?? 0;
      map.set(group.groupId, studentCount);
    });
  }
  return map;
}, [studentsQueries, professorGroups, userRole]);

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

const groups = professorGroups || [];

return (
<>
<NavBackButton to="/profesor/academia" label="Academia" />
{/* 🎯 CAMBIO APLICADO: Botón de Asignación junto al título */}
<div className="flex justify-between items-center mb-6 mt-4">
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
<p className="text-white/60 mb-8 font-['Inter']">
Estos son los grupos a los que has asignado tus materias. Haz clic para gestionarlos.
</p>

<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
{groups.map((group) => {
const groupDisplayName = getGroupDisplayName(group.groupId);
const groupColor = groupColorsMap.get(group.groupId) || '#9f25b8';

return (
<Card
key={group.groupId}
className="relative bg-white/5 border border-white/10 backdrop-blur-md cursor-pointer group transition-all duration-300 hover:scale-[1.02] hover:bg-white/[0.07] overflow-hidden"
style={{
  boxShadow: '0 0 0 0px transparent',
  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
}}
onMouseEnter={(e) => {
  e.currentTarget.style.boxShadow = `0 8px 32px -4px ${groupColor}40, 0 0 0 1px ${groupColor}30`;
  e.currentTarget.style.borderColor = `${groupColor}50`;
}}
onMouseLeave={(e) => {
  e.currentTarget.style.boxShadow = '0 0 0 0px transparent';
  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
}}
onClick={() => handleCourseClick(group.groupId, true)}
>
{/* Gradiente animado sutil de fondo */}
<div 
  className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
  style={{
    background: `radial-gradient(circle at 50% 0%, ${groupColor}08 0%, transparent 70%)`,
  }}
/>

<CardHeader className="relative p-6 pb-4">
<div className="flex items-center justify-between mb-4">
<div
className="relative w-20 h-20 rounded-2xl flex items-center justify-center transition-all duration-300 group-hover:scale-110 group-hover:shadow-lg"
style={{ 
  backgroundColor: `${groupColor}20`, 
  borderColor: groupColor, 
  borderWidth: '2px',
  boxShadow: `0 0 20px ${groupColor}30`,
  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
}}
>
<Users className="w-10 h-10 transition-all duration-300" style={{ color: groupColor }} />
</div>
<ArrowRight className="w-5 h-5 text-white/40 group-hover:text-white/90 group-hover:translate-x-1 transition-all duration-300" />
</div>

<CardTitle className="text-white text-3xl font-bold mb-3 font-['Poppins']">{groupDisplayName}</CardTitle>
{/* Subtexto informativo */}
<p className="text-sm text-white/60 font-['Inter'] font-medium">
  <span className="text-white/70">Estudiantes:</span> {studentsCountMap.get(group.groupId) ?? group.totalStudents ?? 0}
</p>
</CardHeader>
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
<NavBackButton to="/dashboard" label="Dashboard" />
<h2 className="text-3xl font-bold text-white mb-2 font-['Poppins'] mt-4">{title}</h2>
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

<CardContent className="p-4 pt-0 md:p-6 md:pt-0 space-y-2">
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
{!isDirectivo && (
<Button
variant="outline"
className="w-full border-[#9f25b8]/40 text-[#9f25b8] hover:bg-[#9f25b8]/10"
onClick={e => {
e.stopPropagation();
setLocation('/mi-aprendizaje/notas');
}}
>
<GraduationCap className="w-4 h-4 mr-2" />
Ver Notas
</Button>
)}
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
<NavBackButton to="/dashboard" label="Dashboard" />
<h2 className="text-3xl font-bold text-white mb-2 font-['Poppins'] mt-4">Materias de tus Hijos</h2>
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
emptyMessage = 'Aún no hay materias asignadas a tu grupo. Los profesores deben asignar sus materias a tu curso para que aparezcan aquí.';
alertTitle = 'Sin Materias Asignadas';
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
<div className="flex-1 overflow-y-auto p-6 md:p-10">{viewToRender()}</div>
);
}