import type { ReactNode } from 'react';
import logoCaobosBlanco from '@/assets/logo-caobos-blanco.png';

export interface DashboardWelcomeBannerProps {
  children: ReactNode;
  /** Altura del logo: alinear con line-height del título (p. ej. h-10 con text-4xl). */
  logoHeightClass: string;
  reveal?: boolean;
  className?: string;
}

export function DashboardWelcomeBanner({
  children,
  logoHeightClass,
  reveal,
  className,
}: DashboardWelcomeBannerProps) {
  return (
    <div
      className={`mb-8 flex items-start justify-between gap-4 ${reveal ? 'reveal-fade' : ''} ${className ?? ''}`.trim()}
    >
      <div className="min-w-0 flex-1">{children}</div>
      <img
        src={logoCaobosBlanco}
        alt="Gimnasio Los Caobos"
        className={`${logoHeightClass} w-auto shrink-0 object-contain object-right`}
        decoding="async"
      />
    </div>
  );
}
