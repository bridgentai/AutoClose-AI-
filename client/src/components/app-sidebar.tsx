import { Home, MessageSquare, BookOpen, GraduationCap, Settings, LogOut, Plus, History, User, Calendar } from 'lucide-react';
import { useAuth } from '@/lib/authContext';
import { useLocation } from 'wouter';

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
    { icon: BookOpen, label: 'Cursos', path: '/courses', roles: ['estudiante', 'profesor'] },
    { icon: GraduationCap, label: 'Materiales', path: '/materials', roles: ['estudiante', 'profesor'] },
    { icon: Settings, label: 'Configuración', path: '/settings', roles: ['directivo'] },
    { icon: User, label: 'Mi Cuenta', path: '/account', roles: ['estudiante', 'profesor', 'directivo', 'padre'] },
  ];

  const filteredItems = menuItems.filter(item => item.roles.includes(user?.rol || ''));

  return (
    <div className="fixed left-0 top-0 h-full w-20 hover:w-64 bg-black/80 backdrop-blur-md transition-all duration-300 ease-in-out z-50 overflow-hidden group border-r border-white/5">
      <div className="flex flex-col h-full py-4">
        {/* Logo */}
        <div className="px-4 mb-8">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-[#9f25b8] to-[#6a0dad] rounded-xl flex items-center justify-center flex-shrink-0">
              <span className="text-white font-bold text-xl">AC</span>
            </div>
            <span className="text-white font-bold text-lg font-['Poppins'] opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
              AutoClose AI
            </span>
          </div>
        </div>

        {/* Menu Items */}
        <nav className="flex-1 px-2 space-y-1">
          {filteredItems.map((item) => {
            const Icon = item.icon;
            const isActive = location === item.path;
            
            return (
              <button
                key={item.path}
                onClick={() => setLocation(item.path)}
                className={`
                  w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all
                  ${isActive 
                    ? 'bg-[#6a0dad] text-white' 
                    : 'text-white/70 hover:bg-white/5 hover:text-white'}
                `}
                data-testid={`nav-${item.label.toLowerCase().replace(' ', '-')}`}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                <span className="opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap font-medium">
                  {item.label}
                </span>
              </button>
            );
          })}
        </nav>

        {/* User Info & Logout */}
        <div className="px-2 space-y-2">
          <div className="flex items-center gap-3 px-3 py-2 text-white/50 text-sm">
            <div className="w-5 h-5 bg-[#9f25b8]/30 rounded-full flex-shrink-0" />
            <div className="opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
              <p className="font-medium text-white/90">{user?.nombre}</p>
              <p className="text-xs capitalize">{user?.rol}</p>
            </div>
          </div>
          
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-red-400 hover:bg-red-500/10 transition-all"
            data-testid="button-logout"
          >
            <LogOut className="w-5 h-5 flex-shrink-0" />
            <span className="opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap font-medium">
              Cerrar sesión
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
