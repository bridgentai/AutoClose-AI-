export type GradeLevel = 'excelente' | 'bueno' | 'regular' | 'bajo' | 'sin_notas';

export function getGradeLevel(promedio: number | null): GradeLevel {
  if (promedio === null) return 'sin_notas';
  if (promedio >= 90) return 'excelente';
  if (promedio >= 84) return 'bueno';
  if (promedio >= 75) return 'regular';
  return 'bajo';
}

export const GRADE_COLORS: Record<
  GradeLevel,
  {
    accent: string;
    bg: string;
    badgeText: string;
    badgeClass: string;
    label: string;
    arrow: string;
  }
> = {
  excelente: {
    accent: '#10b981',
    bg: 'rgba(16,185,129,0.12)',
    badgeText: '#065f46',
    badgeClass:
      'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
    label: 'Excelente',
    arrow: '\u2191',
  },
  bueno: {
    accent: '#3b82f6',
    bg: 'rgba(59,130,246,0.12)',
    badgeText: '#1e40af',
    badgeClass:
      'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300',
    label: 'Bueno',
    arrow: '\u2014',
  },
  regular: {
    accent: '#f59e0b',
    bg: 'rgba(245,158,11,0.12)',
    badgeText: '#92400e',
    badgeClass:
      'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300',
    label: 'Regular',
    arrow: '\u2193',
  },
  bajo: {
    accent: '#ef4444',
    bg: 'rgba(239,68,68,0.12)',
    badgeText: '#7f1d1d',
    badgeClass:
      'border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300',
    label: 'Bajo',
    arrow: '\u2193',
  },
  sin_notas: {
    accent: 'rgba(255,255,255,0.2)',
    bg: 'rgba(255,255,255,0.06)',
    badgeText: '#6b7280',
    badgeClass:
      'border-gray-200 bg-gray-50 text-gray-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400',
    label: 'Sin notas',
    arrow: '',
  },
};
