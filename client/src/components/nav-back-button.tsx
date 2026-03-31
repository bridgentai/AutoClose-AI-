"use client";

import { useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { Breadcrumb } from "@/components/Breadcrumb";

interface NavBackButtonProps {
  /** Ruta a la que volver. Si no se proporciona, se calcula automáticamente */
  to?: string;
  /** Texto del botón. Si no se proporciona, se calcula automáticamente */
  label?: string;
  /** Clases adicionales */
  className?: string;
  /** Si true, no muestra el ícono de flecha */
  hideIcon?: boolean;
}

/**
 * Componente de navegación contextual que muestra un botón "Volver a..."
 * Si no se proporcionan `to` o `label`, los calcula automáticamente según la ruta actual
 */
export function NavBackButton({ to, label, className, hideIcon }: NavBackButtonProps) {
  const [location, setLocation] = useLocation();

  // Compat: si alguien sigue usando hideIcon, no romper TS.
  void hideIcon;

  // Función para obtener la ruta de retorno basada en la jerarquía
  const getBackPath = (currentPath: string): string | null => {
    // Si se proporciona una ruta explícita, usarla
    if (to) return to;

    // Rutas raíz - no tienen página anterior
    const rootRoutes = ["/", "/dashboard", "/home", "/login", "/register"];
    if (rootRoutes.includes(currentPath)) {
      return null;
    }

    const pathParts = currentPath.split("/").filter(Boolean);

    // Caso especial: /assignment/:id -> tareas del estudiante o del padre
    if (pathParts.length === 2 && pathParts[0] === "assignment") {
      if (typeof window !== "undefined") {
        const sp = new URLSearchParams(window.location.search);
        if (sp.get("from") === "parent") return "/parent/tareas";
      }
      return "/mi-aprendizaje/tareas";
    }

    // Caso especial: /course-detail/:id o /course/:id -> volver según contexto
    if (pathParts.length === 2 && (pathParts[0] === "course-detail" || pathParts[0] === "course")) {
      // Intentar determinar desde dónde se vino
      return "/courses";
    }

    // Si estamos en una ruta con 4+ niveles, volver al nivel de módulo específico
    // Ejemplo: /profesor/academia/tareas/asignar -> /profesor/academia/tareas
    if (pathParts.length >= 4) {
      return "/" + pathParts.slice(0, 3).join("/");
    }

    // Si estamos en una ruta con 3 niveles, volver al módulo principal
    // Ejemplo: /profesor/academia/tareas -> /profesor/academia
    // Ejemplo: /mi-aprendizaje/notas -> /mi-aprendizaje
    if (pathParts.length === 3) {
      const parentPath = "/" + pathParts.slice(0, 2).join("/");

      // Casos especiales
      if (pathParts[0] === "comunicacion") {
        return "/comunicacion";
      }
      if (pathParts[0] === "mi-aprendizaje") {
        return "/mi-aprendizaje";
      }
      if (pathParts[0] === "mi-perfil") {
        return "/mi-perfil";
      }
      if (pathParts[0] === "comunidad") {
        return "/comunicacion";
      }

      return parentPath;
    }

    // Si estamos en una ruta con 2 niveles, volver al módulo principal o dashboard
    // Ejemplo: /profesor/academia -> /profesor
    // Ejemplo: /mi-aprendizaje -> /dashboard
    if (pathParts.length === 2) {
      const mainModules = [
        "profesor",
        "directivo",
        "administrador-general",
        "transporte",
        "tesoreria",
        "nutricion",
        "cafeteria",
      ];
      if (mainModules.includes(pathParts[0])) {
        // Para módulos principales, volver a dashboard
        return "/dashboard";
      }
      // Si es una subcategoría de mi-aprendizaje o mi-perfil, volver a la raíz
      if (pathParts[0] === "mi-aprendizaje" || pathParts[0] === "mi-perfil") {
        return "/" + pathParts[0];
      }
      // Si es comunicación, volver a comunicación (página principal)
      if (pathParts[0] === "comunicacion") {
        return "/comunicacion";
      }
      // Rutas bajo /comunidad (calendario, noticias): el hub es Comunicación
      if (pathParts[0] === "comunidad") {
        return "/comunicacion";
      }
      return "/dashboard";
    }

    // Si estamos en una ruta de 1 nivel, volver a dashboard
    // Ejemplo: /courses -> /dashboard
    if (pathParts.length === 1) {
      const mainPages = [
        "chat",
        "courses",
        "materials",
        "calendar",
        "teacher-calendar",
        "plataformas",
      ];
      if (mainPages.includes(pathParts[0])) {
        return "/dashboard";
      }
      // Si es una página de módulo principal, volver a dashboard
      const modulePages = [
        "profesor",
        "directivo",
        "administrador-general",
        "transporte",
        "tesoreria",
        "nutricion",
        "cafeteria",
      ];
      if (modulePages.includes(pathParts[0])) {
        return "/dashboard";
      }
    }

    return "/dashboard";
  };

  // Función para obtener el label de la ruta
  const getRouteLabel = (path: string): string => {
    // Si se proporciona un label explícito, usarlo
    if (label) return label;

    if (path.startsWith("/course-detail/") || path.startsWith("/course/")) {
      return "Cursos";
    }

    const labels: Record<string, string> = {
      "/dashboard": "Dashboard",
      "/profesor": "Profesor",
      "/profesor/academia": "Academia",
      "/profesor/academia/cursos": "Cursos",
      "/profesor/academia/tareas": "Asignaciones",
      "/profesor/comunicacion": "Comunicación",
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
      "/mi-aprendizaje/tareas": "Tareas",
      "/mi-aprendizaje/notas": "Notas",
      "/mi-aprendizaje/materiales": "Materiales",
      "/mi-aprendizaje/cursos": "Cursos",
      "/mi-aprendizaje/horario": "Horario",
      "/mi-aprendizaje/calendario": "Calendario",
      "/mi-perfil": "Mi Perfil",
      "/comunidad": "Comunicación",
      "/comunicacion": "Comunicación",
      "/comunicacion/academico": "Comunicación Académica",
      "/courses": "Cursos",
      "/materials": "Materiales",
      "/calendar": "Calendario",
      "/teacher-calendar": "Calendario",
      "/plataformas": "Plataformas",
    };

    if (labels[path]) return labels[path];
    // Fallback: humanizar el último segmento de la ruta.
    const parts = path.split("/").filter(Boolean);
    const last = parts[parts.length - 1] || "Dashboard";
    return decodeURIComponent(last)
      .replace(/[-_]+/g, " ")
      .replace(/\b\w/g, (m) => m.toUpperCase());
  };

  const backPath = getBackPath(location);

  // Si no hay ruta de retorno (y no hay historial), no mostrar el botón
  const canGoBack = typeof window !== "undefined" && window.history.length > 1;
  if (!backPath && !canGoBack) {
    return null;
  }

  // Destino de fallback según jerarquía (módulo → página → etc.)
  const fallbackDestination = backPath ?? "/dashboard";
  const fallbackLabel = getRouteLabel(fallbackDestination);

  const currentLabel = getRouteLabel(location);
  const items = fallbackLabel === currentLabel
    ? [{ label: currentLabel, href: fallbackDestination }]
    : [
      { label: fallbackLabel, href: fallbackDestination },
      { label: currentLabel },
    ];

  return (
    <Breadcrumb
      className={cn("mb-4", className)}
      items={items}
    />
  );
}

