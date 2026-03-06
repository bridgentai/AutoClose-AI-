/**
 * BoletinPDFView - Vista del Boletín Inteligente preparada para exportación PDF.
 * Este componente renderiza el contenido del boletín de forma que pueda
 * capturarse o convertirse a PDF en una integración futura.
 */
"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

// Design tokens evoOS
const BG = "#0F0F14";
const CARD = "#171721";
const BORDER = "#232334";
const ACCENT = "#7C3AED";
const ACCENT_LIGHT = "#A855F7";

export interface BoletinPDFViewProps {
  /** Clase raíz para customizar contenedor */
  className?: string;
  /** Modo compacto para PDF (menos padding, fuentes más pequeñas) */
  compact?: boolean;
  /** Referencia para captura/PDF */
  innerRef?: React.Ref<HTMLDivElement | null>;
  children: React.ReactNode;
}

export function BoletinPDFView({
  className,
  compact = false,
  innerRef,
  children,
}: BoletinPDFViewProps) {
  return (
    <div
      ref={innerRef as React.Ref<HTMLDivElement> | undefined}
      className={cn("boletin-pdf-view", compact && "boletin-pdf-view--compact", className)}
      style={{
        backgroundColor: BG,
        color: "#FFFFFF",
        minHeight: compact ? "auto" : "100vh",
        padding: compact ? 24 : 40,
      }}
    >
      {children}
    </div>
  );
}
