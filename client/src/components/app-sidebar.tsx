"use client";

import {
  Home,
  MessageSquare,
  Send,
  BookOpen,
  GraduationCap,
  Settings,
  LogOut,
  User,
  Calendar,
  Users,
  Globe,
  Mail,
  FileCheck,
  Cloud,
  Building2,
  Megaphone,
  Shield,
  Bot,
  BarChart3,
  Settings2,
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
    { icon: Home, label: "Inicio", path: "/asistente", roles: ["asistente"] },
    { icon: Home, label: "Dashboard", path: "/asistente-academica", roles: ["asistente-academica"] },
    { icon: Megaphone, label: "Comunicados", path: "/asistente-academica/comunicados", roles: ["asistente-academica"] },
    { icon: Calendar, label: "Calendario", path: "/calendar", roles: ["asistente-academica"] },
    { icon: BookOpen, label: "Gestión", path: "/directivo/gestion", roles: ["asistente-academica"] },
    { icon: Shield, label: "Control de accesos", path: "/asistente-academica/accesos", roles: ["asistente-academica"] },
    { icon: Bot, label: "Kiwi Assist", path: "/chat", roles: ["asistente-academica"] },
    { icon: MessageSquare, label: "Chat AI", path: "/chat", roles: ["estudiante", "profesor", "directivo", "padre"] },

    { icon: GraduationCap, label: "Mi Aprendizaje", path: "/mi-aprendizaje", roles: ["estudiante"] },
    { icon: Building2, label: "GLC", path: "/comunidad/noticias", roles: ["estudiante"] },
    { icon: MessageSquare, label: "Comunicación", path: "/comunicacion", roles: ["profesor", "directivo", "padre"] },
    {
      icon: Send,
      label: "Evo Send",
      path: "/evo-send",
      roles: [
        "estudiante",
        "profesor",
        "directivo",
        "padre",
        "administrador-general",
        "admin-general-colegio",
        "transporte",
        "tesoreria",
        "nutricion",
        "cafeteria",
        "asistente",
        "asistente-academica",
        "school_admin",
        "super_admin"
      ]
    },

    { icon: Mail, label: "Comunicación padres", path: "/asistente/comunicacion", roles: ["asistente"] },
    { icon: FileCheck, label: "Permisos de salida", path: "/permisos", roles: ["asistente"] },

    { icon: Calendar, label: "Calendario", path: "/teacher-calendar", roles: ["profesor"] },
    { icon: Calendar, label: "Calendario", path: "/calendar", roles: ["directivo", "padre"] },

    { icon: BookOpen, label: "Cursos", path: "/courses", roles: ["profesor"] },
    { icon: Users, label: "Asignación de Horarios", path: "/asignacion-horarios", roles: ["directivo"] },

    { icon: Globe, label: "Plataformas", path: "/plataformas", roles: ["profesor", "directivo", "padre"] },
    { icon: GraduationCap, label: "Materiales", path: "/materials", roles: ["profesor"] },
    {
      icon: Cloud,
      label: "Evo Drive",
      path: "/evo-drive",
      roles: [
        "estudiante",
        "profesor",
        "directivo",
        "administrador-general",
        "admin-general-colegio",
        "school_admin",
        "super_admin",
      ],
    },

    { icon: Settings2, label: "Gestión", path: "/directivo/gestion", roles: ["directivo"] },
    { icon: BarChart3, label: "Analítica", path: "/directivo/analitica", roles: ["directivo"] },
    { icon: Settings, label: "Configuración", path: "/settings", roles: ["directivo"] },

    { icon: User, label: "Mi Perfil", path: "/mi-perfil", roles: ["estudiante", "profesor", "directivo", "padre"] }
  ];

  const filteredItems = menuItems.filter(item => item.roles.includes(user?.rol || ""));

  const handleNavClick = (path: string) => setLocation(path);

  return (
    <header className="w-full h-16 panel-grades border-b border-white/10 flex items-center justify-between px-6">

      {/* Logo + info - mismo azul que tabla de notas */}
      <div className="flex items-center gap-3 cursor-pointer" onClick={() => handleNavClick("/dashboard")}>
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-[0_0_20px_rgba(59,130,246,0.4)]" style={{ background: 'linear-gradient(145deg, #3B82F6, #1E40AF)' }}>
          <span className="text-white font-bold text-lg">e</span>
        </div>
        <div>
          <h2 className="text-[#E2E8F0] font-bold text-sm font-['Poppins']">evoOS</h2>
          <p className="text-xs text-white/60 capitalize">{user?.rol}</p>
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
                flex items-center gap-2 text-sm px-3 py-2 rounded-lg transition-all duration-200
                ${isActive
                  ? "text-white shadow-[0_0_20px_rgba(59,130,246,0.4)]"
                  : "text-[#E2E8F0]/80 hover:text-[#E2E8F0] hover:bg-white/5"
                }
              `}
              style={isActive ? { background: 'linear-gradient(180deg, #3B82F6, #1D4ED8)' } : undefined}
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
