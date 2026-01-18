"use client";

import { 
  Home, MessageSquare, BookOpen, GraduationCap, Settings, 
  LogOut, User, Calendar, Users, Globe 
} from "lucide-react";

import { useAuth } from "@/lib/authContext";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";

export function AppSidebar() {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();

  const handleLogout = () => {
    logout();
    setLocation("/login");
  };

  const menuItems = [
    { icon: Home, label: "Dashboard", path: "/dashboard", roles: ["estudiante", "profesor", "directivo", "padre"] },
    { icon: MessageSquare, label: "Chat AI", path: "/chat", roles: ["estudiante", "profesor", "directivo", "padre"] },

    { icon: GraduationCap, label: "Mi Aprendizaje", path: "/mi-aprendizaje", roles: ["estudiante"] },
    { icon: MessageSquare, label: "Comunicación", path: "/comunicacion", roles: ["estudiante"] },

    { icon: Calendar, label: "Comunidad", path: "/comunidad", roles: ["estudiante", "profesor", "directivo", "padre"] },

    { icon: Calendar, label: "Calendario", path: "/teacher-calendar", roles: ["profesor"] },
    { icon: Calendar, label: "Calendario", path: "/calendar", roles: ["directivo", "padre"] },

    { icon: BookOpen, label: "Cursos", path: "/courses", roles: ["profesor"] },
    { icon: Users, label: "Asignación de Grupos", path: "/group-assignment", roles: ["directivo"] },

    { icon: Globe, label: "Plataformas", path: "/plataformas", roles: ["profesor", "directivo", "padre"] },
    { icon: GraduationCap, label: "Materiales", path: "/materials", roles: ["profesor"] },

    { icon: Users, label: "Profesores", path: "/directivo", roles: ["directivo"] },
    { icon: Settings, label: "Configuración", path: "/settings", roles: ["directivo"] },

    { icon: User, label: "Mi Perfil", path: "/mi-perfil", roles: ["estudiante", "profesor", "directivo", "padre"] }
  ];

  const filteredItems = menuItems.filter(item => item.roles.includes(user?.rol || ""));

  const handleNavClick = (path: string) => setLocation(path);

  return (
    <header className="w-full h-16 bg-black/40 backdrop-blur-xl border-b border-white/10 flex items-center justify-between px-6">

      {/* Logo + info */}
      <div className="flex items-center gap-3 cursor-pointer" onClick={() => handleNavClick("/dashboard")}>
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#9f25b8] to-[#6a0dad] flex items-center justify-center">
          <span className="text-white font-bold text-lg">AC</span>
        </div>
        <div>
          <h2 className="text-white font-bold text-sm font-['Poppins']">AutoClose AI</h2>
          <p className="text-xs text-white/50 capitalize">{user?.rol}</p>
        </div>
      </div>

      {/* MENÚ SUPERIOR */}
      <nav className="flex items-center gap-6">
        {filteredItems.map((item) => {
          const Icon = item.icon;
          const isActive = location === item.path;

          return (
            <button
              key={item.path}
              onClick={() => handleNavClick(item.path)}
              className={`
                flex items-center gap-2 text-sm px-3 py-2 rounded-lg transition-all
                ${isActive 
                  ? "bg-[#6a0dad] text-white" 
                  : "text-white/70 hover:text-white hover:bg-white/5"
                }
              `}
            >
              <Icon className="w-5 h-5" />
              {item.label}
            </button>
          );
        })}
      </nav>

      {/* Perfil + Logout */}
      <div className="flex items-center gap-4">

        <div className="text-right">
          <p className="text-white/90 text-sm font-medium">{user?.nombre}</p>
          <p className="text-xs text-white/50">{user?.email}</p>
        </div>

        <Button
          onClick={handleLogout}
          variant="ghost"
          className="text-red-400 hover:text-red-300 hover:bg-red-500/10 flex items-center gap-2"
        >
          <LogOut className="w-4 h-4" />
          Cerrar sesión
        </Button>
      </div>

    </header>
  );
}
