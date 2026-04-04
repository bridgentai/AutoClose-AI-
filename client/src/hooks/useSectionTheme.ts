import { useEffect, useMemo } from 'react';

export interface SectionTheme {
  primaryColor: string;
  accentColor: string;
  sectionName: string;
  sectionSlug: 'highschool' | 'middle' | 'junior' | 'littlekoalas' | 'default';
  isKidsMode: boolean;
}

export const SECTION_THEMES: Record<string, SectionTheme> = {
  'high school': {
    primaryColor: '#2563eb',
    accentColor: '#00C8FF',
    sectionName: 'High School',
    sectionSlug: 'highschool',
    isKidsMode: false,
  },
  'middle school': {
    primaryColor: '#7c3aed',
    accentColor: '#a78bfa',
    sectionName: 'Middle School',
    sectionSlug: 'middle',
    isKidsMode: false,
  },
  'junior school': {
    primaryColor: '#059669',
    accentColor: '#34d399',
    sectionName: 'Junior School',
    sectionSlug: 'junior',
    isKidsMode: false,
  },
  'little koalas': {
    primaryColor: '#d97706',
    accentColor: '#fbbf24',
    sectionName: 'Little Koalas',
    sectionSlug: 'littlekoalas',
    isKidsMode: true,
  },
};

export const DEFAULT_THEME: SectionTheme = {
  primaryColor: '#2563eb',
  accentColor: '#00C8FF',
  sectionName: 'Mi Sección',
  sectionSlug: 'default',
  isKidsMode: false,
};

export function resolveSectionTheme(sectionName?: string | null): SectionTheme {
  if (!sectionName) return DEFAULT_THEME;
  return SECTION_THEMES[sectionName.toLowerCase()] ?? DEFAULT_THEME;
}

/**
 * Applies section theme as CSS variables on the document root.
 * Call in the directivo layout root component.
 */
export function useSectionThemeApplier(theme: SectionTheme) {
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--section-primary', theme.primaryColor);
    root.style.setProperty('--section-accent', theme.accentColor);
    if (theme.isKidsMode) {
      root.style.setProperty('--section-font', '"Nunito", sans-serif');
      root.style.setProperty('--section-radius', '16px');
    } else {
      root.style.setProperty('--section-font', '"Poppins", sans-serif');
      root.style.setProperty('--section-radius', '8px');
    }
    return () => {
      root.style.removeProperty('--section-primary');
      root.style.removeProperty('--section-accent');
      root.style.removeProperty('--section-font');
      root.style.removeProperty('--section-radius');
    };
  }, [theme.sectionSlug, theme.primaryColor, theme.accentColor, theme.isKidsMode]);
}
