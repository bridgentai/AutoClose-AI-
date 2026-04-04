import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/authContext";

const DIRECTIVO_ROLES = ["directivo", "admin-general-colegio"] as const;
type DirectivoRole = (typeof DIRECTIVO_ROLES)[number];

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

  useEffect(() => {
    if (user && !allowedRoles.includes(user.rol)) {
      setLocation("/dashboard");
    }
  }, [user, setLocation, allowedRoles]);

  if (!user || !allowedRoles.includes(user.rol)) {
    return null;
  }

  return <>{children}</>;
}

export function useIsDirectivoAllowed(strictDirectivoOnly = false): boolean {
  const { user } = useAuth();
  if (!user) return false;
  const roles: readonly string[] = strictDirectivoOnly
    ? ["directivo"]
    : DIRECTIVO_ROLES;
  return roles.includes(user.rol);
}
