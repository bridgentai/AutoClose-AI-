import React, { useState } from 'react';
import { ClipboardList, Calendar, BookOpen, Check, X } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { NavBackButton } from '@/components/nav-back-button';
import { useAuth } from '@/lib/authContext';

const CARD_STYLE = 'bg-white/5 border-white/10 backdrop-blur-md';

export default function AsistenciaProfesor() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [cursoId, setCursoId] = useState<string>('');
  const [fecha, setFecha] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [registros, setRegistros] = useState<Record<string, 'presente' | 'ausente'>>({});

  const { data: cursos = [] } = useQuery({
    queryKey: ['/api/professor/courses'],
    queryFn: () => apiRequest<{ _id: string; nombre: string; cursos: string[] }[]>('GET', '/api/professor/courses'),
  });

  const { data: estudiantes = [], isLoading: loadingEstudiantes } = useQuery({
    queryKey: ['/api/attendance/curso', cursoId, 'estudiantes'],
    queryFn: () => apiRequest<{ _id: string; nombre: string; correo: string; curso: string }[]>('GET', `/api/attendance/curso/${cursoId}/estudiantes`),
    enabled: !!cursoId,
  });

  const { data: asistenciaDelDia = [] } = useQuery({
    queryKey: ['/api/attendance/curso', cursoId, 'fecha', fecha],
    queryFn: () => apiRequest<{ estudianteId: { _id: string }; estado: string }[]>('GET', `/api/attendance/curso/${cursoId}/fecha/${fecha}`),
    enabled: !!cursoId && !!fecha,
  });

  React.useEffect(() => {
    const map: Record<string, 'presente' | 'ausente'> = {};
    asistenciaDelDia.forEach((a: { estudianteId: { _id: string }; estado: string }) => {
      const id = typeof a.estudianteId === 'object' && a.estudianteId?._id ? a.estudianteId._id : (a as any).estudianteId;
      if (id) map[id] = a.estado as 'presente' | 'ausente';
    });
    estudiantes.forEach((e: { _id: string }) => {
      if (map[e._id] === undefined) map[e._id] = 'presente';
    });
    setRegistros(map);
  }, [asistenciaDelDia, estudiantes]);

  const bulkMutation = useMutation({
    mutationFn: (payload: { cursoId: string; fecha: string; registros: { estudianteId: string; estado: 'presente' | 'ausente' }[] }) =>
      apiRequest('POST', '/api/attendance/bulk', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/attendance/curso', cursoId, 'fecha', fecha] });
    },
  });

  const handleToggle = (estudianteId: string) => {
    setRegistros((prev) => ({
      ...prev,
      [estudianteId]: prev[estudianteId] === 'presente' ? 'ausente' : 'presente',
    }));
  };

  const handleGuardar = () => {
    if (!cursoId || !fecha) return;
    const reg = Object.entries(registros).map(([estudianteId, estado]) => ({ estudianteId, estado }));
    bulkMutation.mutate({ cursoId, fecha, registros: reg });
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <NavBackButton to="/profesor/academia" label="Academia" />
        <h1 className="text-3xl font-bold text-white mb-2 font-['Poppins'] mt-4 flex items-center gap-2">
          <ClipboardList className="w-8 h-8 text-[#00c8ff]" />
          Registrar Asistencia
        </h1>
        <p className="text-white/60">Marca la asistencia por curso y fecha</p>
      </div>

      <Card className={`${CARD_STYLE} mb-6`}>
        <CardHeader>
          <CardTitle className="text-white font-['Poppins'] flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-[#00c8ff]" />
            Curso y fecha
          </CardTitle>
          <CardDescription className="text-white/60">Selecciona la materia y el día a registrar</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-4">
          <div className="space-y-2 min-w-[200px]">
            <Label className="text-white/80">Materia</Label>
            <select
              value={cursoId}
              onChange={(e) => setCursoId(e.target.value)}
              className="w-full rounded-lg bg-white/10 border border-white/10 text-white px-3 py-2 focus:ring-2 focus:ring-[#00c8ff]"
            >
              <option value="">Seleccionar materia</option>
              {cursos.map((c) => (
                <option key={c._id} value={c._id}>{c.nombre}</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label className="text-white/80 flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Fecha
            </Label>
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="rounded-lg bg-white/10 border border-white/10 text-white px-3 py-2 focus:ring-2 focus:ring-[#00c8ff]"
            />
          </div>
        </CardContent>
      </Card>

      {cursoId && (
        <Card className={CARD_STYLE}>
          <CardHeader>
            <CardTitle className="text-white font-['Poppins']">Estudiantes</CardTitle>
            <CardDescription className="text-white/60">
              {estudiantes.length} estudiantes · Haz clic para cambiar presente/ausente
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingEstudiantes ? (
              <p className="text-white/60">Cargando...</p>
            ) : estudiantes.length === 0 ? (
              <p className="text-white/60">No hay estudiantes en este curso.</p>
            ) : (
              <ul className="space-y-2">
                {estudiantes.map((e: { _id: string; nombre: string; curso: string }) => (
                  <li
                    key={e._id}
                    className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/8 transition-colors"
                  >
                    <span className="text-white font-medium">{e.nombre}</span>
                    <span className="text-white/50 text-sm">{e.curso}</span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleToggle(e._id)}
                      className={
                        registros[e._id] === 'ausente'
                          ? 'border-amber-500/50 text-amber-400 hover:bg-amber-500/20'
                          : 'border-emerald-500/50 text-emerald-400 hover:bg-emerald-500/20'
                      }
                    >
                      {registros[e._id] === 'ausente' ? (
                        <><X className="w-4 h-4 mr-1" /> Ausente</>
                      ) : (
                        <><Check className="w-4 h-4 mr-1" /> Presente</>
                      )}
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            {estudiantes.length > 0 && (
              <div className="mt-6 flex justify-end">
                <Button
                  onClick={handleGuardar}
                  disabled={bulkMutation.isPending}
                  className="bg-gradient-to-r from-[#002366] to-[#1e3cff] hover:opacity-90"
                >
                  {bulkMutation.isPending ? 'Guardando...' : 'Guardar asistencia'}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
