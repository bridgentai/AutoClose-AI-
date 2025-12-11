import { Home, MessageSquare, BookOpen, GraduationCap, Settings, LogOut, User, Calendar, Users, Globe } from 'lucide-react';
import { useAuth } from '@/lib/authContext';
import { useLocation } from 'wouter';
import {
Sidebar,
SidebarContent,
SidebarFooter,
SidebarGroup,
SidebarGroupContent,
SidebarHeader,
SidebarMenu,
SidebarMenuButton,
SidebarMenuItem,
} from '@/components/ui/sidebar';

export function AppSidebar() {
const { user, logout } = useAuth();
const [location, setLocation] = useLocation();

const handleLogout = () => {
logout();
setLocation('/login');
};

const isEstudiante = user?.rol === 'estudiante';

const menuItems = [
// Se mantiene: Dashboard
{ icon: Home, label: 'Dashboard', path: '/dashboard', roles: ['estudiante', 'profesor', 'directivo', 'padre'] },

// Se mantiene: Chat AI
{ icon: MessageSquare, label: 'Chat AI', path: '/chat', roles: ['estudiante', 'profesor', 'directivo', 'padre'] },

// NUEVO MÓDULO 1: Mi Aprendizaje (Entrada principal del estudiante)
{ icon: GraduationCap, label: 'Mi Aprendizaje', path: '/mi-aprendizaje', roles: ['estudiante'] },

// NUEVO MÓDULO 3: Comunicación (Ya lo tenías definido)
{ icon: MessageSquare, label: 'Comunicación', path: '/comunicacion', roles: ['estudiante'] },

// -------------------------------------------------------------
// NUEVO MÓDULO 2: Comunidad/Calendario (Visible para todos los roles)
// -------------------------------------------------------------
{ icon: Calendar, label: 'Comunidad', path: '/comunidad', roles: ['estudiante', 'profesor', 'directivo', 'padre'] },

// -------------------------------------------------------------
// ELIMINADAS PARA EL ESTUDIANTE: Absorbidas por 'Mi Aprendizaje'
// -------------------------------------------------------------

// Mis Materias: Ahora solo para 'profesor'
{ icon: BookOpen, label: 'Mis Materias', path: '/subjects', roles: ['profesor'] },

// --- INICIO DE CORRECCIÓN PARA EL CALENDARIO ---

// Calendario del Profesor: Apunta a la nueva página /teacher-calendar
{ icon: Calendar, label: 'Calendario', path: '/teacher-calendar', roles: ['profesor'] },

// Calendario General: Se mantiene la ruta original /calendar para otros roles
{ icon: Calendar, label: 'Calendario', path: '/calendar', roles: ['directivo', 'padre'] },

// --- FIN DE CORRECCIÓN PARA EL CALENDARIO ---

// Cursos: Se mantiene solo para 'profesor'
{ icon: BookOpen, label: 'Cursos', path: '/courses', roles: ['profesor'] },
  
  { 
      icon: Users, 
      label: 'Asignación de Grupos', 
      path: '/group-assignment', 
      roles: ['profesor', 'directivo'] 
  },

// Plataformas: Se quita 'estudiante'
{ icon: Globe, label: 'Plataformas', path: '/plataformas', roles: ['profesor', 'directivo', 'padre'] },

// Materiales: Se quita 'estudiante'
{ icon: GraduationCap, label: 'Materiales', path: '/materials', roles: ['profesor'] },

// -------------------------------------------------------------
// OTROS MÓDULOS Y ENLACES (Mantenidos)
// -------------------------------------------------------------

// Se mantiene: Profesores (Solo Directivo)
{ icon: Users, label: 'Profesores', path: '/directivo', roles: ['directivo'] },

// Se mantiene: Configuración (Solo Directivo)
{ icon: Settings, label: 'Configuración', path: '/settings', roles: ['directivo'] },

// MÓDULO 4: Mi Perfil
{ icon: User, label: 'Mi Perfil', path: '/mi-perfil', roles: ['estudiante', 'profesor', 'directivo', 'padre'] },

// NOTA: La ruta original de Mi Cuenta (/account) ya no se usa como enlace de navegación
];

const filteredItems = menuItems.filter(item => item.roles.includes(user?.rol || ''));

// NOTA: La variable isEstudiante se mantiene, pero la lógica de colores
// ha sido ELIMINADA y UNIFICADA al esquema PÚRPURA para todos los roles.

return (
// Fondo de la Sidebar: Fijo y unificado (Sin los colores condicionales del estudiante)
<Sidebar className={`border-r backdrop-blur-xl border-white/10 bg-black/40`}>

{/* Header: Fijo y unificado */}
<SidebarHeader className={`border-b p-4 border-white/10`}>
<div className="flex items-center gap-3">
{/* Logo AC: Usar el degradado Morado/Púrpura siempre */}
<div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-gradient-to-br from-[#9f25b8] to-[#6a0dad]`}>
<span className="text-white font-bold text-lg">AC</span>
</div>
<div>
<h2 className="text-white font-bold text-sm font-['Poppins']">AutoClose AI</h2>
{/* Rol del usuario: Color neutro */}
<p className={`text-xs capitalize text-white/50`}>{user?.rol}</p>
</div>
</div>
</SidebarHeader>

<SidebarContent>
<SidebarGroup>
<SidebarGroupContent>
<SidebarMenu>
{filteredItems.map((item) => {
const Icon = item.icon;
const isActive = location === item.path;

return (
<SidebarMenuItem key={item.path}>
<SidebarMenuButton
onClick={() => setLocation(item.path)}
isActive={isActive}
className={`
${isActive 
// Acento del botón activo: Púrpura/Morado siempre
? 'bg-[#6a0dad] text-white hover:bg-[#6a0dad]/90' 
: 'text-white/70 hover:bg-white/5 hover:text-white'}
`}
data-testid={`nav-${item.label.toLowerCase().replace(' ', '-')}`}
>
{/* Ícono: No necesita condicional de color */}
<Icon className={`w-5 h-5`} /> 
<span>{item.label}</span>
</SidebarMenuButton>
</SidebarMenuItem>
);
})}
</SidebarMenu>
</SidebarGroupContent>
</SidebarGroup>
</SidebarContent>

{/* Footer: Fijo y unificado */}
<SidebarFooter className={`border-t p-4 border-white/10`}>
<div className="mb-3">
<p className="font-medium text-white/90 text-sm truncate">{user?.nombre}</p>
<p className="text-xs text-white/50">{user?.email}</p>
</div>
<button
onClick={handleLogout}
className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-red-400 hover:bg-red-500/10 transition-all text-sm font-medium"
data-testid="button-logout"
>
<LogOut className="w-4 h-4" />
<span>Cerrar sesión</span>
</button>
</SidebarFooter>
</Sidebar>
);
}
