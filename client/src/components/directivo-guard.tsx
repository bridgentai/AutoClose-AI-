import { createContext, useContext, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/authContext";
import { apiRequest } from "@/lib/queryClient";

const DIRECTIVO_ROLES = ["directivo", "admin-general-colegio"] as const;

interface MySectionData {
  id: string;
  _id: string;
  nombre: string;
  grupos: Array<{ id: string; _id: string; nombre: string }>;
  totalGrupos: number;
  totalEstudiantes: number;
}

const DirectivoSectionContext = createContext<MySectionData | null>(null);

interface DirectivoGuardProps {
  children: React.ReactNode;
  strictDirectivoOnly?: boolean;
}

export function DirectivoGuard({ children, strictDirectivoOnly = false }: DirectivoGuardProps) {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  const allowedRoles: readonly string[] = strictDirectivoOnly
    ? ["directivo"]
    : DIRECTIVO_ROLES;

  const { data: mySection } = useQuery<MySectionData>({
    queryKey: ['directivo/my-section', user?.id],
    queryFn: () => apiRequest('GET', '/api/sections/my-section'),
    enabled: user?.rol === 'directivo' && !!user?.colegioId,
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (user && !allowedRoles.includes(user.rol)) {
      setLocation("/dashboard");
    }
  }, [user, setLocation, allowedRoles]);

  if (!user || !allowedRoles.includes(user.rol)) {
    return null;
  }

  return (
    <DirectivoSectionContext.Provider value={mySection ?? null}>
      {children}
    </DirectivoSectionContext.Provider>
  );
}

export function useDirectivoSection(): MySectionData | null {
  return useContext(DirectivoSectionContext);
}

export function useIsDirectivoAllowed(strictDirectivoOnly = false): boolean {
  const { user } = useAuth();
  if (!user) return false;
  const roles: readonly string[] = strictDirectivoOnly
    ? ["directivo"]
    : DIRECTIVO_ROLES;
  return roles.includes(user.rol);
}
