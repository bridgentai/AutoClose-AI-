import React, { useState } from 'react';
import { FileText, Calendar, Printer, Download } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/lib/authContext';
import { NavBackButton } from '@/components/nav-back-button';

const CARD_STYLE = 'bg-white/5 border-white/10 backdrop-blur-md';

interface MateriaItem {
  _id: string;
  nombre: string;
  promedio: number;
  ultimaNota: number;
  estado: string;
  colorAcento?: string;
}

interface BoletinDoc {
  _id: string;
  periodo: string;
  fecha: string;
  cursoId?: { nombre: string };
  grupoNombre?: string;
  resumen?: { estudianteId: string; nombre: string; promedioGeneral: number; materias: { nombre: string; promedio: number }[] }[];
}

export default function BoletínPage() {
  const { user } = useAuth();
  const [selectedBoletinId, setSelectedBoletinId] = useState<string | null>(null);

  const { data: hijos = [] } = useQuery({
    queryKey: ['/api/users/me/hijos'],
    queryFn: () => apiRequest<{ _id: string; nombre: string }[]>('GET', '/api/users/me/hijos'),
    enabled: user?.rol === 'padre',
  });
  const hijoId = user?.rol === 'padre' ? hijos[0]?._id : undefined;

  const { data: notesStudent } = useQuery({
    queryKey: ['/api/student/notes'],
    queryFn: () => apiRequest<{ materias: MateriaItem[]; total: number }>('GET', '/api/student/notes'),
    enabled: user?.rol === 'estudiante',
  });

  const { data: notesHijo } = useQuery({
    queryKey: ['/api/student/hijo', hijoId, 'notes'],
    queryFn: () => apiRequest<{ materias: MateriaItem[]; total: number }>('GET', `/api/student/hijo/${hijoId}/notes`),
    enabled: user?.rol === 'padre' && !!hijoId,
  });

  const { data: boletinesList = [] } = useQuery({
    queryKey: ['/api/boletin'],
    queryFn: () => apiRequest<BoletinDoc[]>('GET', '/api/boletin'),
  });

  const { data: boletinDetail } = useQuery({
    queryKey: ['/api/boletin', selectedBoletinId],
    queryFn: () => apiRequest<BoletinDoc>('GET', `/api/boletin/${selectedBoletinId}`),
    enabled: !!selectedBoletinId,
  });

  const data = user?.rol === 'estudiante' ? notesStudent : notesHijo;
  const materias = data?.materias ?? [];
  const titulo = user?.rol === 'padre' && hijos[0] ? `Boletín de ${hijos[0].nombre}` : 'Mi boletín';

  const handlePrint = () => window.print();

  const handleDownloadPdf = async () => {
    const id = selectedBoletinId || boletinesList[0]?._id;
    if (!id) return;
    try {
      const token = localStorage.getItem('autoclose_token');
      const base = (import.meta.env.VITE_API_URL as string) || '';
      const url = `${base.replace(/\/$/, '')}/api/boletin/${id}/pdf`;
      const res = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      if (!res.ok) throw new Error('No se pudo generar el boletín.');
      const html = await res.text();
      const w = window.open('', '_blank');
      if (w) {
        w.document.write(html);
        w.document.close();
      }
    } catch (e) {
      console.error(e);
      alert('No se pudo abrir el boletín. Use Imprimir y elija "Guardar como PDF".');
    }
  };

  return (
    <div className="p-4 sm:p-6">
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #boletin-print, #boletin-print * { visibility: visible; }
          #boletin-print { position: absolute; left: 0; top: 0; width: 100%; }
          .print\\:hidden { display: none !important; }
        }
      `}</style>
      <div className="mb-6 print:hidden">
        <NavBackButton to={user?.rol === 'padre' ? '/dashboard' : '/mi-aprendizaje'} label={user?.rol === 'padre' ? 'Dashboard' : 'Mi Aprendizaje'} />
        <div className="flex flex-wrap items-center justify-between gap-4 mt-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2 font-['Poppins'] flex items-center gap-2">
              <FileText className="w-8 h-8 text-[#00c8ff] shrink-0" />
              {titulo}
            </h1>
            <p className="text-white/60 text-sm sm:text-base">Resumen de calificaciones por materia</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="border-white/20 text-white hover:bg-white/10 min-h-[44px]" onClick={handlePrint}>
              <Printer className="w-4 h-4 mr-2" />
              Imprimir
            </Button>
            <Button
              variant="outline"
              className="border-white/20 text-white hover:bg-white/10 min-h-[44px]"
              onClick={handleDownloadPdf}
              disabled={!selectedBoletinId && !boletinesList[0]?._id}
            >
              <Download className="w-4 h-4 mr-2" />
              Descargar PDF
            </Button>
          </div>
        </div>
      </div>

      <div id="boletin-print">
      {boletinesList.length > 0 && (
        <Card className={`${CARD_STYLE} mb-6`}>
          <CardHeader>
            <CardTitle className="text-white font-['Poppins'] flex items-center gap-2">
              <Calendar className="w-5 h-5 text-[#00c8ff]" />
              Boletines por período
            </CardTitle>
            <CardDescription className="text-white/60">Documentos generados por el colegio</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {boletinesList.map((b) => (
                <li key={b._id}>
                  <button
                    type="button"
                    onClick={() => setSelectedBoletinId(selectedBoletinId === b._id ? null : b._id)}
                    className={`w-full text-left p-3 rounded-xl border transition-colors ${selectedBoletinId === b._id ? 'bg-[#00c8ff]/20 border-[#00c8ff]/40' : 'bg-white/5 border-white/10 hover:bg-white/8'}`}
                  >
                    <span className="text-white font-medium">{b.periodo}</span>
                    <span className="text-white/60 text-sm ml-2">
                      {(b.cursoId as { nombre?: string })?.nombre || b.grupoNombre || ''} · {new Date(b.fecha).toLocaleDateString('es-CO')}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            {boletinDetail && (
              <div className="mt-4 p-4 rounded-xl bg-white/5 border border-white/10">
                <h3 className="text-white font-['Poppins'] mb-3">{boletinDetail.periodo}</h3>
                <div className="space-y-3">
                  {(boletinDetail.resumen || []).map((r) => (
                    <div key={r.estudianteId} className="text-white/90">
                      <p className="font-medium">{r.nombre} — Promedio: {(r.promedioGeneral ?? 0).toFixed(1)}</p>
                      <ul className="text-sm text-white/70 ml-2">
                        {(r.materias || []).map((m, i) => (
                          <li key={i}>{m.nombre}: {(m.promedio ?? 0).toFixed(1)}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card className={CARD_STYLE}>
        <CardHeader>
          <CardTitle className="text-white font-['Poppins']">Calificaciones</CardTitle>
          <CardDescription className="text-white/60">Escala 0 - 100</CardDescription>
        </CardHeader>
        <CardContent>
          {materias.length === 0 ? (
            <p className="text-white/50 py-8 text-center">No hay calificaciones registradas aún.</p>
          ) : (
            <>
              <div className="hidden md:block overflow-x-auto -mx-2 sm:mx-0">
                <table className="w-full text-left min-w-[320px]">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className="py-3 px-4 text-white font-['Poppins']">Materia</th>
                      <th className="py-3 px-4 text-white font-['Poppins']">Promedio (0-100)</th>
                      <th className="py-3 px-4 text-white font-['Poppins']">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {materias.map((m) => (
                      <tr key={m._id} className="border-b border-white/5 hover:bg-white/5">
                        <td className="py-3 px-4 text-white">{m.nombre}</td>
                        <td className="py-3 px-4 font-['Poppins'] font-semibold text-[#00c8ff]">{(m.ultimaNota ?? m.promedio).toFixed(1)}</td>
                        <td className="py-3 px-4">
                          <span className={`text-sm ${m.estado === 'excelente' ? 'text-emerald-400' : m.estado === 'bueno' ? 'text-green-400' : m.estado === 'regular' ? 'text-amber-400' : 'text-red-400'}`}>
                            {m.estado}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="md:hidden space-y-3">
                {materias.map((m) => (
                  <div key={m._id} className="p-4 rounded-xl bg-white/5 border border-white/10 min-h-[44px] flex flex-wrap items-center justify-between gap-2">
                    <span className="text-white font-medium">{m.nombre}</span>
                    <span className="font-['Poppins'] font-semibold text-[#00c8ff]">{(m.ultimaNota ?? m.promedio).toFixed(1)}</span>
                    <span className={`text-sm w-full sm:w-auto ${m.estado === 'excelente' ? 'text-emerald-400' : m.estado === 'bueno' ? 'text-green-400' : m.estado === 'regular' ? 'text-amber-400' : 'text-red-400'}`}>
                      {m.estado}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>
      </div>
    </div>
  );
}
