import { QueryClient, QueryFunction } from "@tanstack/react-query";

function pagePort(): string {
  if (typeof window === "undefined") return "";
  const p = window.location.port;
  if (p) return p;
  return window.location.protocol === "https:" ? "443" : "80";
}

// Base URL del API. En `npm run dev` (mismo origen) suele ser ''. Con Vite en otro puerto, apunta a Express (PORT del .env) vía define en vite.config.
function getApiBaseUrl(): string {
  const explicit = import.meta.env.VITE_API_URL;
  if (explicit) return String(explicit).replace(/\/$/, "");

  const env = import.meta.env as Record<string, string | boolean | undefined>;
  const backendOrigin = env.VITE_DEV_BACKEND_ORIGIN;
  const backendPort = env.VITE_DEV_BACKEND_PORT;

  if (
    import.meta.env.DEV &&
    typeof backendOrigin === "string" &&
    typeof backendPort === "string" &&
    typeof window !== "undefined"
  ) {
    if (pagePort() !== backendPort) {
      return backendOrigin.replace(/\/$/, "");
    }
  }

  return "";
}

// Función helper para construir la URL completa
function buildApiUrl(url: string): string {
  // Si la URL ya es absoluta (empieza con http:// o https://), usarla tal cual
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  // Si la URL empieza con /, es relativa al dominio
  const baseUrl = getApiBaseUrl();
  if (baseUrl) {
    // Asegurar que no haya doble slash
    const cleanBase = baseUrl.replace(/\/$/, '');
    const cleanUrl = url.startsWith('/') ? url : `/${url}`;
    return `${cleanBase}${cleanUrl}`;
  }
  return url;
}

function humanizeApiErrorBody(text: string, status: number): string {
  const t = text.trim();
  if (!t) return "";
  if (/^<!DOCTYPE/i.test(t) || /<html[\s>]/i.test(t)) {
    const m = t.match(/<pre[^>]*>([\s\S]*?)<\/pre>/i);
    const pre = m?.[1]?.replace(/<[^>]+>/g, "")?.trim();
    if (pre && /cannot (get|post|put|patch|delete)/i.test(pre)) {
      return `El servidor que respondió no tiene esa ruta de API (${status}). Arranca Express (\`npm run dev\`) o, si usas solo Vite, abre el front en el puerto 5173 (no el mismo que PORT del .env) y deja el API en otro puerto. También puedes fijar VITE_API_URL en .env apuntando al backend.`;
    }
    return `Respuesta inválida del servidor (${status}). ¿El backend está en marcha y la URL de la API es correcta?`;
  }
  return t;
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    let errorMessage = res.statusText;
    try {
      const text = await res.text();
      if (text) {
        try {
          const json = JSON.parse(text);
          errorMessage = json.message || json.error || text;
        } catch {
          errorMessage = humanizeApiErrorBody(text, res.status) || text;
        }
      }
    } catch {
      // Si falla al leer el texto, usar statusText
    }
    
    // Si es un error 401 (no autorizado), limpiar el token y redirigir al login
    if (res.status === 401) {
      localStorage.removeItem('autoclose_token');
      localStorage.removeItem('autoclose_user');
      // Redirigir al login solo si no estamos ya en la página de login
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    
    throw new Error(errorMessage);
  }
}

export async function apiRequest<T = any>(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<T> {
  const token = localStorage.getItem('autoclose_token');
  const headers: HeadersInit = data ? { "Content-Type": "application/json" } : {};
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const fullUrl = buildApiUrl(url);

  try {
    const res = await fetch(fullUrl, {
      method,
      headers,
      body: data ? JSON.stringify(data) : undefined,
      credentials: "include",
    });

    await throwIfResNotOk(res);
    return await res.json();
  } catch (error: any) {
    // Mejorar el manejo de errores de red
    if (error instanceof TypeError && error.message === 'Failed to fetch') {
      throw new Error('No se pudo conectar con el servidor. Verifica que el servidor esté corriendo.');
    }
    throw error;
  }
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const token = localStorage.getItem('autoclose_token');
    const headers: HeadersInit = {};
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const url = queryKey.join("/") as string;
    const fullUrl = buildApiUrl(url);

    try {
      const res = await fetch(fullUrl, {
        credentials: "include",
        headers,
      });

      if (unauthorizedBehavior === "returnNull" && res.status === 401) {
        return null;
      }

      await throwIfResNotOk(res);
      return await res.json();
    } catch (error: any) {
      // Mejorar el manejo de errores de red
      if (error instanceof TypeError && error.message === 'Failed to fetch') {
        throw new Error('No se pudo conectar con el servidor. Verifica que el servidor esté corriendo.');
      }
      throw error;
    }
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
