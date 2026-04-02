"use client";

import {
  Home,
  MessageSquare,
  BookOpen,
  GraduationCap,
  Settings,
  LogOut,
  User,
  Calendar,
  Users,
  Globe,
  Menu,
  X,
  Cloud,
  Building2,
} from "lucide-react";

import { useAuth } from "@/lib/authContext";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { useState } from "react";

export function TopNavigation() {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    setLocation("/login");
  };

  const menuItems = [
    { icon: Home, label: "Dashboard", path: "/dashboard", roles: ["estudiante", "profesor", "directivo", "padre"] },
    { icon: MessageSquare, label: "Chat AI", path: "/chat", roles: ["estudiante", "profesor", "directivo", "padre"] },

    { icon: GraduationCap, label: "Mi Aprendizaje", path: "/mi-aprendizaje", roles: ["estudiante"] },
    { icon: Building2, label: "GLC", path: "/comunidad/noticias", roles: ["estudiante"] },
    { icon: GraduationCap, label: "Aprendizaje (hijo/a)", path: "/parent/aprendizaje", roles: ["padre"] },
    { icon: MessageSquare, label: "Comunicación", path: "/comunicacion", roles: ["profesor", "directivo", "padre"] },

    { icon: Calendar, label: "Calendario", path: "/teacher-calendar", roles: ["profesor"] },
    { icon: Calendar, label: "Calendario", path: "/calendar", roles: ["directivo", "padre"] },

    { icon: BookOpen, label: "Cursos", path: "/courses", roles: ["profesor"] },
    { icon: Users, label: "Asignación de Horarios", path: "/asignacion-horarios", roles: ["directivo"] },

    { icon: Globe, label: "Plataformas", path: "/plataformas", roles: ["profesor", "directivo", "padre"] },
    { icon: GraduationCap, label: "Materiales", path: "/materials", roles: ["profesor"] },
    { icon: Cloud, label: "Evo Drive", path: "/evo-drive", roles: ["profesor", "directivo"] },

    { icon: BookOpen, label: "Academia", path: "/directivo/academia", roles: ["directivo"] },
    { icon: Settings, label: "Configuracion", path: "/settings", roles: ["directivo"] },

    { icon: User, label: "Mi Perfil", path: "/mi-perfil", roles: ["estudiante", "profesor", "directivo", "padre"] }
  ];

  const filteredItems = menuItems.filter(item => item.roles.includes(user?.rol || ""));

  const handleNavClick = (path: string) => {
    setLocation(path);
    setMobileMenuOpen(false);
  };

  return (
    <header
      className="fixed top-0 left-0 right-0 z-50 h-16 bg-black/60 backdrop-blur-xl border-b border-white/10 relative"
      data-testid="top-navigation"
    >
      <div className="max-w-7xl mx-auto h-full flex items-center justify-between px-4 lg:px-6">

        {/* Logo + Info */}
        <div
          className="flex items-center gap-3 cursor-pointer flex-shrink-0"
          onClick={() => handleNavClick("/dashboard")}
          data-testid="link-logo"
        >
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#002366] to-[#1e3cff] flex items-center justify-center">
            <span className="text-white font-bold text-lg">e</span>
          </div>
          <div className="hidden sm:block">
            <h2 className="text-white font-bold text-sm font-['Poppins']">evoOS</h2>
            <p className="text-xs text-white/50 capitalize">{user?.rol}</p>
          </div>
        </div>

        {/* Desktop Navigation */}
        <nav className="hidden lg:flex items-center gap-1 flex-1 justify-center max-w-3xl mx-4">
          <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide">
            {filteredItems.map((item) => {
              const Icon = item.icon;
              const isActive = location === item.path;

              return (
                <button
                  key={item.path}
                  onClick={() => handleNavClick(item.path)}
                  data-testid={`nav-${item.path.replace("/", "")}`}
                  className={`
                    flex items-center gap-2 text-sm px-3 py-2 rounded-lg transition-all whitespace-nowrap
                    ${isActive
                      ? "bg-[#002366] text-white"
                      : "text-white/70 hover:text-white hover:bg-white/5"
                    }
                  `}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        </nav>

        {/* Right Section - User Info + Logout */}
        <div className="flex items-center gap-3 flex-shrink-0">
          {/* User Info (hidden on mobile) */}
          <div className="hidden md:block text-right">
            <p className="text-white/90 text-sm font-medium truncate max-w-[150px]">{user?.nombre}</p>
            <p className="text-xs text-white/50 truncate max-w-[150px]">{user?.email}</p>
          </div>

          {/* Logout Button */}
          <Button
            onClick={handleLogout}
            variant="ghost"
            size="sm"
            className="hidden sm:flex text-red-400 hover:text-red-300 hover:bg-red-500/10 items-center gap-2"
            data-testid="button-logout"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden md:inline">Cerrar sesion</span>
          </Button>

          {/* Mobile Menu Button */}
          <Button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            variant="ghost"
            size="icon"
            className="lg:hidden text-white hover:bg-white/10"
            data-testid="button-mobile-menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </Button>
        </div>
      </div>

      <span className="absolute top-1 right-3 text-[10px] uppercase tracking-[0.18em] text-white/40 pointer-events-none">
        evoOS
      </span>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="lg:hidden absolute top-16 left-0 right-0 bg-black/95 backdrop-blur-xl border-b border-white/10 max-h-[calc(100vh-4rem)] overflow-y-auto">
          <div className="p-4 space-y-2">
            {/* User Info on Mobile */}
            <div className="pb-3 mb-3 border-b border-white/10">
              <p className="text-white font-medium">{user?.nombre}</p>
              <p className="text-sm text-white/50">{user?.email}</p>
            </div>

            {/* Navigation Items */}
            {filteredItems.map((item) => {
              const Icon = item.icon;
              const isActive = location === item.path;

              return (
                <button
                  key={item.path}
                  onClick={() => handleNavClick(item.path)}
                  data-testid={`mobile-nav-${item.path.replace("/", "")}`}
                  className={`
                    w-full flex items-center gap-3 text-sm px-4 py-3 rounded-lg transition-all
                    ${isActive
                      ? "bg-[#002366] text-white"
                      : "text-white/70 hover:text-white hover:bg-white/5"
                    }
                  `}
                >
                  <Icon className="w-5 h-5" />
                  <span>{item.label}</span>
                </button>
              );
            })}

            {/* Logout on Mobile */}
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 text-sm px-4 py-3 rounded-lg text-red-400 hover:bg-red-500/10 mt-3"
              data-testid="mobile-button-logout"
            >
              <LogOut className="w-5 h-5" />
              <span>Cerrar sesion</span>
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
