import { QueryClient, QueryFunction } from "@tanstack/react-query";

// Función helper para obtener la URL base de la API
// En desarrollo, usa URL relativa (mismo servidor)
// En producción o si está configurada, usa VITE_API_URL
function getApiBaseUrl(): string {
  // Si hay una variable de entorno configurada, usarla
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  // Por defecto, usar URL relativa (funciona cuando frontend y backend están en el mismo servidor)
  return '';
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
          errorMessage = text;
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
