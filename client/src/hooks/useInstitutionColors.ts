import { useEffect } from 'react';
import { useAuth } from '@/lib/authContext';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

interface InstitutionConfig {
  colegioId: string;
  nombre: string;
  logoUrl?: string;
  nombreIA?: string;
  colorPrimario?: string;
  colorSecundario?: string;
  /** 1–3, desde institutions.settings */
  currentAcademicTerm?: number;
}

/**
 * Hook para cargar y aplicar los colores de la institución del usuario
 * Aplica los colores dinámicamente usando CSS variables
 */
export function useInstitutionColors() {
  const { user } = useAuth();

  const { data: institutionConfig } = useQuery<InstitutionConfig>({
    queryKey: ['institutionConfig', user?.colegioId],
    queryFn: async () => {
      const colegioId = user?.colegioId;
      if (!colegioId) throw new Error('institutionConfig: sin colegioId');
      return apiRequest<InstitutionConfig>('GET', '/api/institution/config');
    },
    enabled: !!user?.colegioId,
    staleTime: 5 * 60 * 1000, // 5 minutos
    gcTime: 10 * 60 * 1000, // 10 minutos
  });

  useEffect(() => {
    if (!institutionConfig) return;

    // Evitar morado: identidad Caobos es azul - rechazar colores púrpura
    const isPurple = (hex: string) => {
      if (!hex || typeof hex !== 'string') return true;
      const h = hex.toLowerCase().replace('#', '');
      const purpleHexes = ['9f25b8', '6a0dad', 'c66bff', '7a1d8a'];
      return purpleHexes.some(p => h === p || h.startsWith(p) || h.endsWith(p));
    };
    const colorPrimario = (institutionConfig.colorPrimario && !isPurple(institutionConfig.colorPrimario))
      ? institutionConfig.colorPrimario : '#002366';
    const colorSecundario = (institutionConfig.colorSecundario && !isPurple(institutionConfig.colorSecundario))
      ? institutionConfig.colorSecundario : '#1e3cff';

    // Convertir colores HEX a HSL para las variables CSS
    const hexToHsl = (hex: string): string => {
      const r = parseInt(hex.slice(1, 3), 16) / 255;
      const g = parseInt(hex.slice(3, 5), 16) / 255;
      const b = parseInt(hex.slice(5, 7), 16) / 255;

      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      let h = 0, s = 0, l = (max + min) / 2;

      if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
          case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
          case g: h = ((b - r) / d + 2) / 6; break;
          case b: h = ((r - g) / d + 4) / 6; break;
        }
      }

      return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
    };
    
    // Convertir HEX a RGB para usar en rgba()
    const hexToRgb = (hex: string): string => {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      return `${r}, ${g}, ${b}`;
    };

    // Aplicar colores como CSS variables en el root
    const root = document.documentElement;
    root.style.setProperty('--institution-primary', colorPrimario);
    root.style.setProperty('--institution-secondary', colorSecundario);
    root.style.setProperty('--institution-primary-hsl', hexToHsl(colorPrimario));
    root.style.setProperty('--institution-secondary-hsl', hexToHsl(colorSecundario));

    // También actualizar las variables de primary y secondary de Tailwind para que se apliquen globalmente
    const primaryHsl = hexToHsl(colorPrimario);
    const secondaryHsl = hexToHsl(colorSecundario);
    root.style.setProperty('--primary', primaryHsl);
    root.style.setProperty('--secondary', secondaryHsl);
    root.style.setProperty('--sidebar-primary', primaryHsl);
    root.style.setProperty('--ring', primaryHsl);
    
    // Variables para gradientes y rgba
    root.style.setProperty('--gradient-primary', colorPrimario);
    root.style.setProperty('--gradient-secondary', colorSecundario);
    root.style.setProperty('--institution-primary-rgb', hexToRgb(colorPrimario));
    root.style.setProperty('--institution-secondary-rgb', hexToRgb(colorSecundario));
    
    // Actualizar el gradiente overlay dinámicamente
    const rgbPrimary = hexToRgb(colorPrimario);
    const rgbSecondary = hexToRgb(colorSecundario);
    root.style.setProperty('--gradient-overlay-bg', 
      `linear-gradient(135deg, rgba(${rgbPrimary}, 0.1) 0%, rgba(${rgbSecondary}, 0.05) 100%)`);

    return () => {
      // Cleanup: restaurar valores por defecto si es necesario
      root.style.removeProperty('--institution-primary');
      root.style.removeProperty('--institution-secondary');
      root.style.removeProperty('--institution-primary-hsl');
      root.style.removeProperty('--institution-secondary-hsl');
    };
  }, [institutionConfig]);

  // Nunca devolver morado - identidad Caobos es azul
  const safePrimary = institutionConfig?.colorPrimario && !['#9f25b8', '#6a0dad', '#c66bff'].includes(institutionConfig.colorPrimario.toLowerCase())
    ? institutionConfig.colorPrimario : '#002366';
  const safeSecondary = institutionConfig?.colorSecundario && !['#9f25b8', '#6a0dad', '#c66bff'].includes(institutionConfig.colorSecundario.toLowerCase())
    ? institutionConfig.colorSecundario : '#1e3cff';

  return {
    institutionConfig,
    colorPrimario: safePrimary,
    colorSecundario: safeSecondary,
  };
}
