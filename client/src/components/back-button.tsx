"use client";

import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface NavigationOption {
  path: string;
  label: string;
  type: 'history' | 'category';
}

export function BackButton() {
  const [location, setLocation] = useLocation();
  const [canGoBack, setCanGoBack] = useState(false);
  const [navigationOptions, setNavigationOptions] = useState<NavigationOption[]>([]);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Función para obtener la ruta de categoría principal basada en la jerarquía
  const getCategoryPath = (currentPath: string): string | null => {
    // Rutas raíz - no tienen categoría anterior
    const rootRoutes = ["/", "/dashboard", "/home", "/login", "/register"];
    if (rootRoutes.includes(currentPath)) {
      return null;
    }

    // Detectar jerarquía de rutas
    const pathParts = currentPath.split("/").filter(Boolean);
    
    // Si estamos en una ruta con 3+ niveles, volver al nivel anterior
    // Ejemplo: /profesor/academia/tareas -> /profesor/academia
    if (pathParts.length >= 3) {
      return "/" + pathParts.slice(0, 2).join("/");
    }
    
    // Si estamos en una ruta con 2 niveles, volver al primer nivel o dashboard
    // Ejemplo: /profesor/academia -> /profesor o /dashboard
    if (pathParts.length === 2) {
      // Si el primer nivel es un módulo principal, volver a dashboard
      const mainModules = ["profesor", "directivo", "administrador-general", "transporte", "tesoreria", "nutricion", "cafeteria"];
      if (mainModules.includes(pathParts[0])) {
        return "/dashboard";
      }
      // Si es una subcategoría de mi-aprendizaje o mi-perfil, volver a la raíz
      if (pathParts[0] === "mi-aprendizaje" || pathParts[0] === "mi-perfil") {
        return "/" + pathParts[0];
      }
      // Si es comunidad, volver a comunidad
      if (pathParts[0] === "comunidad") {
        return "/comunidad";
      }
      return "/dashboard";
    }
    
    // Si estamos en una ruta de 1 nivel, volver a dashboard
    // Ejemplo: /courses -> /dashboard
    if (pathParts.length === 1) {
      const mainPages = ["chat", "courses", "materials", "calendar", "teacher-calendar", "plataformas"];
      if (mainPages.includes(pathParts[0])) {
        return "/dashboard";
      }
      // Si es una página de módulo principal, volver a dashboard
      const modulePages = ["profesor", "directivo", "administrador-general", "transporte", "tesoreria", "nutricion", "cafeteria"];
      if (modulePages.includes(pathParts[0])) {
        return "/dashboard";
      }
    }
    
    return "/dashboard";
  };

  // Función para obtener el label de la ruta
  const getRouteLabel = (path: string): string => {
    const labels: Record<string, string> = {
      "/dashboard": "Dashboard",
      "/profesor": "Profesor",
      "/profesor/academia": "Academia",
      "/profesor/comunicacion": "Comunicación",
      "/directivo": "Directivo",
      "/directivo/academia": "Academia",
      "/directivo/comunicacion": "Comunicación",
      "/directivo/comunidad": "Comunidad",
      "/administrador-general": "Administrador General",
      "/administrador-general/academia": "Academia",
      "/administrador-general/comunicacion": "Comunicación",
      "/administrador-general/comunidad": "Comunidad",
      "/transporte": "Transporte",
      "/transporte/academia": "Academia",
      "/transporte/comunicacion": "Comunicación",
      "/transporte/comunidad": "Comunidad",
      "/tesoreria": "Tesoría",
      "/tesoreria/academia": "Academia",
      "/tesoreria/comunicacion": "Comunicación",
      "/tesoreria/comunidad": "Comunidad",
      "/nutricion": "Nutrición",
      "/nutricion/academia": "Academia",
      "/nutricion/comunicacion": "Comunicación",
      "/nutricion/comunidad": "Comunidad",
      "/cafeteria": "Cafetería",
      "/cafeteria/academia": "Academia",
      "/cafeteria/comunicacion": "Comunicación",
      "/cafeteria/comunidad": "Comunidad",
      "/mi-aprendizaje": "Mi Aprendizaje",
      "/mi-perfil": "Mi Perfil",
      "/comunidad": "Comunidad",
      "/comunicacion": "Comunicación",
    };
    
    return labels[path] || "Página anterior";
  };

  useEffect(() => {
    const rootRoutes = ["/", "/dashboard", "/home", "/login", "/register"];
    const hasHistory = window.history.length > 1;
    const isRootPage = rootRoutes.includes(location);
    
    const options: NavigationOption[] = [];
    
    // Opción 1: Volver en el historial del navegador
    if (hasHistory && !isRootPage) {
      options.push({
        path: "history",
        label: "Página anterior",
        type: "history",
      });
    }
    
    // Opción 2: Volver a la categoría principal
    const categoryPath = getCategoryPath(location);
    if (categoryPath && categoryPath !== location) {
      options.push({
        path: categoryPath,
        label: getRouteLabel(categoryPath),
        type: "category",
      });
    }
    
    setCanGoBack(options.length > 0);
    setNavigationOptions(options);
  }, [location]);

  const handleNavigation = (option: NavigationOption) => {
    if (option.type === "history") {
      window.history.back();
    } else {
      setLocation(option.path);
    }
    setIsMenuOpen(false);
  };

  if (!canGoBack || navigationOptions.length === 0) {
    return null;
  }

  // Si solo hay una opción, mostrar botón simple
  if (navigationOptions.length === 1) {
    const option = navigationOptions[0];
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => handleNavigation(option)}
              className={cn(
                "fixed top-6 left-6 z-40",
                "w-14 h-14 rounded-full",
                "bg-gradient-to-br from-[#9f25b8] to-[#6a0dad]",
                "hover:from-[#c66bff] hover:to-[#9f25b8]",
                "shadow-lg shadow-[#9f25b8]/30",
                "hover:shadow-xl hover:shadow-[#9f25b8]/50",
                "transition-all duration-200",
                "flex items-center justify-center",
                "hover:scale-110 active:scale-95",
                "border border-white/20",
                "backdrop-blur-md",
                "group",
              )}
              aria-label={option.label}
            >
              <ArrowLeft className="w-6 h-6 text-white group-hover:translate-x-[-2px] transition-transform" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">
            <p>{option.label}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // Si hay múltiples opciones, mostrar menú desplegable
  return (
    <TooltipProvider>
      <DropdownMenu open={isMenuOpen} onOpenChange={setIsMenuOpen}>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <button
                className={cn(
                  "fixed top-6 left-6 z-40",
                  "w-14 h-14 rounded-full",
                  "bg-gradient-to-br from-[#9f25b8] to-[#6a0dad]",
                  "hover:from-[#c66bff] hover:to-[#9f25b8]",
                  "shadow-lg shadow-[#9f25b8]/30",
                  "hover:shadow-xl hover:shadow-[#9f25b8]/50",
                  "transition-all duration-200",
                  "flex items-center justify-center gap-1",
                  "hover:scale-110 active:scale-95",
                  "border border-white/20",
                  "backdrop-blur-md",
                  "group",
                )}
                aria-label="Opciones de navegación"
              >
                <ArrowLeft className="w-5 h-5 text-white group-hover:translate-x-[-2px] transition-transform" />
                <ChevronDown className="w-3 h-3 text-white/80" />
              </button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent side="right">
            <p>Opciones de navegación</p>
          </TooltipContent>
        </Tooltip>
        <DropdownMenuContent
          side="right"
          align="start"
          className={cn(
            "w-56",
            "bg-white/10 backdrop-blur-xl",
            "border border-white/20",
            "rounded-xl",
            "p-2",
            "shadow-2xl",
          )}
        >
          {navigationOptions.map((option, index) => (
            <DropdownMenuItem
              key={`${option.type}-${index}`}
              onClick={() => handleNavigation(option)}
              className={cn(
                "flex items-center gap-3",
                "px-3 py-2.5 rounded-lg",
                "text-white",
                "hover:bg-white/10",
                "cursor-pointer",
                "transition-colors",
                "focus:bg-white/10",
              )}
            >
              <ArrowLeft className="w-4 h-4 text-white/70" />
              <span className="text-sm font-medium">{option.label}</span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </TooltipProvider>
  );
}
