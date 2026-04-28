"use client";

import { useRef, useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Download, AlertTriangle } from "lucide-react";
import { NavBackButton } from "@/components/nav-back-button";
import { Button } from "@/components/ui/button";
import { BoletinPDFView } from "@/components/boletin/BoletinPDFView";
import { BoletinContent } from "@/components/boletin/BoletinContent";
import type { BoletinData } from "@/lib/boletin-types";

const BG = "#0F0F14";

export default function BoletinInteligentePage() {
  const [, params] = useRoute("/profesor/cursos/:cursoId/estudiantes/:estudianteId/boletin-inteligente");
  const [, setLocation] = useLocation();
  const pdfRef = useRef<HTMLDivElement>(null);
  const cursoId = params?.cursoId ?? "";
  const estudianteId = params?.estudianteId ?? "";

  const { data, isLoading, error } = useQuery({
    queryKey: ["/api/boletin/inteligente", estudianteId],
    queryFn: () =>
      apiRequest<BoletinData>("GET", `/api/boletin/inteligente/${estudianteId}`),
    enabled: !!estudianteId,
  });

  const handleDescargarPDF = () => {
    window.print();
  };

  const volverANotas = () => {
    setLocation(`/profesor/cursos/${cursoId}/estudiantes/${estudianteId}/notas`);
  };

  useEffect(() => {
    if (!estudianteId || !cursoId) {
      setLocation("/profesor/academia/cursos");
    }
  }, [estudianteId, cursoId, setLocation]);

  if (!estudianteId || !cursoId) {
    return null;
  }

  if (error) {
    return (
      <div className="min-h-0 p-6" style={{ backgroundColor: BG }}>
        <div className="max-w-4xl mx-auto text-center py-16">
          <AlertTriangle className="w-16 h-16 mx-auto mb-4 text-amber-400" />
          <h2 className="text-xl font-semibold text-white mb-2">Error al cargar el boletín</h2>
          <p className="text-white/60 mb-6">No se pudo obtener la información del estudiante.</p>
          <Button
            variant="outline"
            className="border-[#232334] text-white hover:bg-white/5"
            onClick={volverANotas}
          >
            Volver a Notas
          </Button>
        </div>
      </div>
    );
  }

  if (isLoading || !data) {
    return (
      <div className="min-h-0 p-6 flex items-center justify-center" style={{ backgroundColor: BG }}>
        <div className="animate-pulse text-white/60">Cargando boletín...</div>
      </div>
    );
  }
  return (
    <div className="min-h-0" style={{ backgroundColor: BG }}>
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .boletin-print-area, .boletin-print-area * { visibility: visible; }
          .boletin-print-area { position: absolute; left: 0; top: 0; width: 100%; }
          .no-print { display: none !important; }
        }
      `}</style>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 py-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8 no-print">
          <NavBackButton
            to={`/profesor/cursos/${cursoId}/estudiantes/${estudianteId}/notas`}
            label="Notas del estudiante"
          />
          <Button
            onClick={handleDescargarPDF}
            className="border-[#7C3AED]/50 bg-[#7C3AED]/10 text-[#A855F7] hover:bg-[#7C3AED]/20 transition-all"
          >
            <Download className="w-4 h-4 mr-2" />
            Descargar PDF
          </Button>
        </div>

        <BoletinPDFView innerRef={pdfRef} compact={false}>
          <div className="boletin-print-area">
            <BoletinContent data={data} />
          </div>
        </BoletinPDFView>
      </div>
    </div>
  );
}
