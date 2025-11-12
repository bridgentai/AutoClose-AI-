import { Home, MessageSquare, BookOpen, GraduationCap, Settings, LogOut, User, Calendar } from 'lucide-react';
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

  const menuItems = [
    { icon: Home, label: 'Dashboard', path: '/dashboard', roles: ['estudiante', 'profesor', 'directivo', 'padre'] },
    { icon: MessageSquare, label: 'Chat AI', path: '/chat', roles: ['estudiante', 'profesor', 'directivo', 'padre'] },
    { icon: Calendar, label: 'Calendario', path: '/calendar', roles: ['estudiante'] },
    { icon: BookOpen, label: 'Cursos', path: '/courses', roles: ['profesor'] },
    { icon: GraduationCap, label: 'Materiales', path: '/materials', roles: ['estudiante', 'profesor'] },
    { icon: Settings, label: 'Configuración', path: '/settings', roles: ['directivo'] },
    { icon: User, label: 'Mi Cuenta', path: '/account', roles: ['estudiante', 'profesor', 'directivo', 'padre'] },
  ];

  const filteredItems = menuItems.filter(item => item.roles.includes(user?.rol || ''));

  return (
    <Sidebar className="border-r border-white/10 bg-black/40 backdrop-blur-xl">
      <SidebarHeader className="border-b border-white/10 p-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-[#9f25b8] to-[#6a0dad] rounded-xl flex items-center justify-center flex-shrink-0">
            <span className="text-white font-bold text-lg">AC</span>
          </div>
          <div>
            <h2 className="text-white font-bold text-sm font-['Poppins']">AutoClose AI</h2>
            <p className="text-white/50 text-xs capitalize">{user?.rol}</p>
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
                          ? 'bg-[#6a0dad] text-white hover:bg-[#6a0dad]/90' 
                          : 'text-white/70 hover:bg-white/5 hover:text-white'}
                      `}
                      data-testid={`nav-${item.label.toLowerCase().replace(' ', '-')}`}
                    >
                      <Icon className="w-5 h-5" />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-white/10 p-4">
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
