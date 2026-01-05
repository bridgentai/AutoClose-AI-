"use client";

import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Clock, X, Home, MessageSquare, BookOpen, Calendar, FileText, Users, Globe, GraduationCap, User, Mail, UsersRound } from "lucide-react";
import { cn } from "@/lib/utils";

interface RecentPage {
  path: string;
  label: string;
  icon: any;
  timestamp: number;
}

// Iconos por ruta
const routeIcons: Record<string, any> = {
  "/dashboard": Home,
  "/chat": MessageSquare,
  "/mi-aprendizaje": GraduationCap,
  "/comunicacion": Mail,
  "/comunidad": UsersRound,
  "/courses": BookOpen,
  "/calendar": Calendar,
  "/teacher-calendar": Calendar,
  "/materials": FileText,
  "/group-assignment": Users,
  "/plataformas": Globe,
  "/directivo": Users,
  "/mi-perfil": User,
};

// Labels por ruta
const routeLabels: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/chat": "Chat AI",
  "/mi-aprendizaje": "Mi Aprendizaje",
  "/comunicacion": "Comunicación",
  "/comunidad": "Comunidad",
  "/courses": "Cursos",
  "/calendar": "Calendario",
  "/teacher-calendar": "Calendario",
  "/materials": "Materiales",
  "/group-assignment": "Asignación de Grupos",
  "/plataformas": "Plataformas",
  "/directivo": "Profesores",
  "/mi-perfil": "Mi Perfil",
};

export function QuickActions() {
  const [location, setLocation] = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [recentPages, setRecentPages] = useState<RecentPage[]>([]);

  // Cargar páginas recientes del localStorage
  useEffect(() => {
    const stored = localStorage.getItem("autoclose_recent_pages");
    if (stored) {
      try {
        const pages = JSON.parse(stored);
        setRecentPages(pages);
      } catch (e) {
        console.error("Error loading recent pages:", e);
      }
    }
  }, []);

  // Guardar página actual cuando cambia la ruta
  useEffect(() => {
    if (location && location !== "/login" && location !== "/register") {
      const icon = routeIcons[location] || Home;
      const label = routeLabels[location] || "Página";
      
      setRecentPages((prev) => {
        // Filtrar si ya existe esta ruta
        const filtered = prev.filter((p) => p.path !== location);
        
        // Agregar la nueva página al inicio
        const updated = [
          { path: location, label, icon, timestamp: Date.now() },
          ...filtered,
        ];
        
        // Mantener solo las últimas 3
        const limited = updated.slice(0, 3);
        
        // Guardar en localStorage
        localStorage.setItem("autoclose_recent_pages", JSON.stringify(limited));
        
        return limited;
      });
    }
  }, [location]);

  const handlePageClick = (path: string) => {
    setLocation(path);
    setIsOpen(false);
  };

  return (
    <>
      {/* Overlay transparente para cerrar al hacer clic fuera */}
      {isOpen && (
        <div
          className="fixed inset-0 z-30 bg-transparent"
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      )}
      
      <div className="fixed bottom-6 left-6 z-40">
        {/* Recent Pages Menu */}
        {isOpen && (
          <div className="absolute bottom-16 left-0 mb-2 flex flex-col gap-2 animate-in fade-in slide-in-from-bottom-2 duration-200 relative z-50">
            {recentPages.length > 0 ? (
              recentPages.map((page, index) => {
                const Icon = page.icon;
                return (
                  <button
                    key={`${page.path}-${page.timestamp}`}
                    onClick={() => handlePageClick(page.path)}
                    className={cn(
                      "group flex items-center gap-3 px-4 py-3 rounded-xl",
                      "bg-white/5 backdrop-blur-xl border border-white/10",
                      "hover:bg-white/10 hover:border-white/20",
                      "transition-all duration-200 shadow-lg",
                      "text-white text-sm font-medium",
                      "animate-in fade-in slide-in-from-left-2",
                      "min-w-[200px]",
                    )}
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    <div className={cn(
                      "w-10 h-10 rounded-lg bg-gradient-to-br from-[#9f25b8] to-[#6a0dad] flex items-center justify-center",
                      "group-hover:scale-110 transition-transform"
                    )}>
                      <Icon className="w-5 h-5 text-white" />
                    </div>
                    <span className="flex-1 text-left">{page.label}</span>
                  </button>
                );
              })
            ) : (
              <div className="px-4 py-3 rounded-xl bg-white/5 backdrop-blur-xl border border-white/10 text-white/60 text-sm min-w-[200px]">
                No hay páginas recientes
              </div>
            )}
          </div>
        )}

        {/* Main Button */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={cn(
            "w-14 h-14 rounded-full",
            "bg-gradient-to-br from-[#9f25b8] to-[#6a0dad]",
            "hover:from-[#c66bff] hover:to-[#9f25b8]",
            "shadow-lg shadow-[#9f25b8]/30",
            "hover:shadow-xl hover:shadow-[#9f25b8]/50",
            "transition-all duration-200",
            "flex items-center justify-center",
            "hover:scale-110 active:scale-95",
            "border border-white/20",
            "relative z-50",
          )}
          aria-label="Páginas recientes"
        >
          {isOpen ? (
            <X className="w-6 h-6 text-white" />
          ) : (
            <Clock className="w-6 h-6 text-white" />
          )}
        </button>
      </div>
    </>
  );
}
