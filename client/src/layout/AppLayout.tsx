import React from 'react';
import { ChevronDown } from 'lucide-react'; 

// --- Definiciones de Tipos ---
interface AppLayoutProps {
  children: React.ReactNode;
}

interface PageHeaderProps {
  title: string;
  description: string;
}

interface CardProps {
  children: React.ReactNode;
  className?: string;
}

// ---------------------------------------------------------------------
// LAYOUT PRINCIPAL — ESTÉTICO, ESPACIOSO, TIPO GOOGLE
// ---------------------------------------------------------------------

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-black via-[#1a0020] to-[#0c0010] text-white">

      {/* Margen superior para que no choque con la barra de navegación */}
      <div className="pt-24" />

      {/* Contenedor amplio como Google Docs/Drive */}
      <div className="max-w-7xl mx-auto px-10 py-8">
        {children}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------
// HEADERS MODERNOS
// ---------------------------------------------------------------------

export function PageHeader({ title, description }: PageHeaderProps) {
  return (
    <div className="mb-10">
      <h1 className="text-4xl font-extrabold tracking-tight">{title}</h1>
      <p className="text-lg text-white/70 mt-2">{description}</p>
    </div>
  );
}

// ---------------------------------------------------------------------
// CARDS ESTÉTICOS (GLASSMORPHISM ELEGANTE)
// ---------------------------------------------------------------------

export function Card({ children, className = "" }: CardProps) {
  return (
    <div
      className={`rounded-2xl shadow-xl overflow-hidden 
                  bg-white/5 border border-white/10 
                  backdrop-blur-xl ${className}`}
    >
      {children}
    </div>
  );
}

export const CardHeader: React.FC<CardProps> = ({ children }) => (
  <div className="p-8 pb-3">{children}</div>
);

export const CardContent: React.FC<CardProps> = ({ children, className = '' }) => (
  <div className={`p-8 pt-3 ${className}`}>{children}</div>
);

export const CardTitle: React.FC<CardProps> = ({ children }) => (
  <h3 className="text-2xl font-semibold tracking-tight">{children}</h3>
);

export const CardDescription: React.FC<CardProps> = ({ children }) => (
  <p className="text-base text-white/60 mt-1">{children}</p>
);

// ---------------------------------------------------------------------
// COMPONENTES REUTILIZABLES
// ---------------------------------------------------------------------

export const PrimaryButton: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement>> = ({
  children,
  className,
  ...props
}) => (
  <button
    className={`
      px-5 py-3
      bg-gradient-to-r from-[#002366] to-[#1e3cff]
      hover:opacity-90 transition 
      rounded-xl font-medium text-white
      ${className}
    `}
    {...props}
  >
    {children}
  </button>
);

export const Input: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = (props) => (
  <input
    className="
      w-full p-4 rounded-xl 
      bg-white/5 border border-white/20 
      text-white placeholder-white/50 
      focus:border-[#1e3cff] focus:outline-none 
      transition-colors
    "
    {...props}
  />
);
