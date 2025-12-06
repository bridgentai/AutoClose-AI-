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
    { icon: Home, label: 'Dashboard', path: '/dashboard', roles: ['estudiante', 'profesor', 'directivo', 'padre'] },
    { icon: MessageSquare, label: 'Chat AI', path: '/chat', roles: ['estudiante', 'profesor', 'directivo', 'padre'] },
    { icon: BookOpen, label: 'Mis Materias', path: '/subjects', roles: ['estudiante'] },
    { icon: Calendar, label: 'Calendario', path: '/calendar', roles: ['estudiante'] },
    { icon: BookOpen, label: 'Cursos', path: '/courses', roles: ['profesor'] },
    { icon: Globe, label: 'Plataformas', path: '/plataformas', roles: ['estudiante', 'profesor', 'directivo', 'padre'] },
    { icon: Users, label: 'Profesores', path: '/directivo', roles: ['directivo'] },
    { icon: GraduationCap, label: 'Materiales', path: '/materials', roles: ['estudiante', 'profesor'] },
    { icon: Settings, label: 'Configuración', path: '/settings', roles: ['directivo'] },
    { icon: User, label: 'Mi Cuenta', path: '/account', roles: ['estudiante', 'profesor', 'directivo', 'padre'] },
  ];

  const filteredItems = menuItems.filter(item => item.roles.includes(user?.rol || ''));

  return (
    <Sidebar className={`border-r backdrop-blur-xl ${isEstudiante ? 'border-[#3b82f6]/20 bg-[#001855]/90' : 'border-white/10 bg-black/40'}`}>
      <SidebarHeader className={`border-b p-4 ${isEstudiante ? 'border-[#3b82f6]/20' : 'border-white/10'}`}>
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${isEstudiante ? 'bg-gradient-to-br from-[#3b82f6] to-[#1e3a8a]' : 'bg-gradient-to-br from-[#9f25b8] to-[#6a0dad]'}`}>
            <span className="text-white font-bold text-lg">AC</span>
          </div>
          <div>
            <h2 className="text-white font-bold text-sm font-['Poppins']">AutoClose AI</h2>
            <p className={`text-xs capitalize ${isEstudiante ? 'text-[#facc15]' : 'text-white/50'}`}>{user?.rol}</p>
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
                          ? isEstudiante 
                            ? 'bg-[#3b82f6] text-white hover:bg-[#3b82f6]/90' 
                            : 'bg-[#6a0dad] text-white hover:bg-[#6a0dad]/90'
                          : 'text-white/70 hover:bg-white/5 hover:text-white'}
                      `}
                      data-testid={`nav-${item.label.toLowerCase().replace(' ', '-')}`}
                    >
                      <Icon className={`w-5 h-5 ${isActive && isEstudiante ? 'text-[#facc15]' : ''}`} />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className={`border-t p-4 ${isEstudiante ? 'border-[#3b82f6]/20' : 'border-white/10'}`}>
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
