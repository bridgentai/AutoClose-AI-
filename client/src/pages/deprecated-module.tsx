/**
 * Shown when user navigates to removed modules (treasury, boletin).
 * Reports/boletines will be available from Reportes (computed from grades + attendance).
 */

import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";

export default function DeprecatedModulePage() {
  const [, setLocation] = useLocation();
  return (
    <div className="p-6 max-w-md mx-auto text-center">
      <h1 className="text-xl font-semibold text-white mb-2">Módulo no disponible</h1>
      <p className="text-white/70 mb-4">
        Este módulo ha sido reemplazado. Los reportes y boletines se generan desde Reportes académicos.
      </p>
      <Button onClick={() => setLocation("/dashboard")}>Ir al inicio</Button>
    </div>
  );
}
