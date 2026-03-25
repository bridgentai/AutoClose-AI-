import { useState, useMemo, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ClipboardList, FileText, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import {
  buildLogroBloquesForSelect,
  countIndicadoresInBloques,
  LogroIndicadorSelects,
} from '@/components/assignment/logroIndicadorSelect';

interface LogrosResponse {
  logros: {
    _id: string;
    descripcion: string;
    pesoEnCurso: number;
    orden?: number;
    indicadores: { _id: string; nombre: string; porcentaje: number; orden?: number }[];
  }[];
  indicadoresPlano: { _id: string; nombre: string; porcentaje: number; orden?: number }[];
}

export interface GradesInlineAssignmentPanelProps {
  cursoId: string;
  displayGroupId: string;
  groupSubjectId: string;
  subjectNombre: string;
  groupDisplayName: string;
  trimestre: 1 | 2 | 3;
  initialIndicadorId?: string;
  onClose: () => void;
}

export function GradesInlineAssignmentPanel({
  cursoId,
  displayGroupId,
  groupSubjectId,
  subjectNombre,
  groupDisplayName,
  trimestre,
  initialIndicadorId = '',
  onClose,
}: GradesInlineAssignmentPanelProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [phase, setPhase] = useState<'choose-delivery' | 'form'>('choose-delivery');
  const [deliveryMode, setDeliveryMode] = useState<'evo' | 'clase' | 'sin-entrega'>('evo');
  const requiresStudentDelivery = deliveryMode === 'evo';
  const isGradableAssignment = deliveryMode !== 'sin-entrega';

  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [fechaEntrega, setFechaEntrega] = useState('');
  const [logroCalificacionId, setLogroCalificacionId] = useState(initialIndicadorId);

  useEffect(() => {
    setLogroCalificacionId(initialIndicadorId);
  }, [initialIndicadorId]);

  const { data: logrosData } = useQuery<LogrosResponse>({
    queryKey: ['/api/logros-calificacion', groupSubjectId],
    queryFn: () =>
      apiRequest<LogrosResponse>('GET', `/api/logros-calificacion?courseId=${encodeURIComponent(groupSubjectId)}`),
    enabled: !!groupSubjectId,
  });

  const bloquesForSelect = useMemo(() => buildLogroBloquesForSelect(logrosData), [logrosData]);
  const needsLogro = countIndicadoresInBloques(bloquesForSelect) > 0;

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!titulo.trim()) throw new Error('Escribe el nombre de la actividad');
      if (!fechaEntrega) throw new Error('Elige fecha y hora de entrega');
      if (needsLogro && !logroCalificacionId) throw new Error('Selecciona logro e indicador de calificación');
      return apiRequest<{ _id: string }>('POST', '/api/assignments', {
        titulo: titulo.trim(),
        descripcion: descripcion.trim() || titulo.trim(),
        curso: displayGroupId,
        courseId: groupSubjectId,
        fechaEntrega,
        categoryId: logroCalificacionId || undefined,
        logroCalificacionId: logroCalificacionId || undefined,
        requiresSubmission: requiresStudentDelivery,
        isGradable: isGradableAssignment,
        trimestre,
      });
    },
    onSuccess: () => {
      toast({ title: 'Asignación creada', description: 'Ya aparece en la tabla de este trimestre.' });
      queryClient.invalidateQueries({ queryKey: ['gradeTableAssignments', cursoId, groupSubjectId, trimestre] });
      queryClient.invalidateQueries({ queryKey: ['assignments', cursoId] });
      queryClient.invalidateQueries({ queryKey: ['teacherAssignments'] });
      onClose();
    },
    onError: (e: Error) => {
      toast({ title: 'Error', description: e.message || 'No se pudo crear la asignación', variant: 'destructive' });
    },
  });

  return (
    <Card className="bg-[#0a0a2a]/80 border border-white/10 backdrop-blur-md mb-4 rounded-[14px] shadow-xl">
      <CardHeader className="pb-2 flex flex-row items-start justify-between gap-2">
        <div>
          <CardTitle className="text-white text-xl font-semibold font-['Poppins']">Nueva asignación</CardTitle>
          <p className="text-white/50 text-sm mt-0.5">
            {subjectNombre} · Grupo {groupDisplayName}
          </p>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={onClose} className="text-white/70 hover:text-white shrink-0">
          <X className="w-4 h-4" />
        </Button>
      </CardHeader>
      <CardContent className="pt-2">
        {phase === 'choose-delivery' ? (
          <div className="space-y-4">
            <p className="text-white/80 font-medium">¿Los estudiantes deben entregar esta actividad?</p>
            <p className="text-white/50 text-sm">
              Si eliges <strong className="text-white/80">No</strong>, la tarea aparece en el calendario como cualquier otra, pero no podrán subir entrega ni se calificará por entrega.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Button
                type="button"
                onClick={() => {
                  setDeliveryMode('evo');
                  setPhase('form');
                }}
                className="h-32 flex flex-col items-center justify-center gap-3 bg-gradient-to-br from-[#1e3cff]/25 to-[#002366]/25 border border-[#1e3cff]/50 hover:from-[#1e3cff]/35 hover:to-[#002366]/35 rounded-[12px]"
              >
                <ClipboardList className="w-8 h-8 text-[#00c8ff]" />
                <span className="text-white font-semibold">Sí requiere entrega en Evo</span>
                <span className="text-white/60 text-xs leading-snug text-center px-1 whitespace-normal max-w-full">
                  Los estudiantes envían archivos o texto y se puede calificar la entrega.
                </span>
              </Button>
              <Button
                type="button"
                onClick={() => {
                  setDeliveryMode('clase');
                  setPhase('form');
                }}
                className="h-32 flex flex-col items-center justify-center gap-3 bg-gradient-to-br from-white/10 to-white/5 border border-white/20 hover:bg-white/10 rounded-[12px]"
              >
                <FileText className="w-8 h-8 text-white/80" />
                <span className="text-white font-semibold">Entrega en Clase</span>
                <span className="text-white/60 text-xs leading-snug text-center px-1 whitespace-normal max-w-full">
                  No se sube en la plataforma; el docente puede calificar en clase.
                </span>
              </Button>
              <Button
                type="button"
                onClick={() => {
                  setDeliveryMode('sin-entrega');
                  setPhase('form');
                }}
                className="h-32 flex flex-col items-center justify-center gap-3 bg-gradient-to-br from-white/10 to-white/5 border border-white/20 hover:bg-white/10 rounded-[12px]"
              >
                <FileText className="w-8 h-8 text-white/80" />
                <span className="text-white font-semibold">No requiere entrega</span>
                <span className="text-white/60 text-xs leading-snug text-center px-1 whitespace-normal max-w-full">
                  Solo aviso o actividad informativa; sin entrega ni calificación.
                </span>
              </Button>
            </div>
          </div>
        ) : (
          <form
            className="space-y-6"
            onSubmit={(e) => {
              e.preventDefault();
              createMutation.mutate();
            }}
          >
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge className="bg-[#1e3cff]/20 text-white border border-[#1e3cff]/40 rounded-[10px]">Asignación</Badge>
                <Badge
                  className={
                    requiresStudentDelivery
                      ? 'bg-emerald-500/20 text-emerald-200 border-emerald-500/40'
                      : 'bg-white/10 text-white/80 border-white/25'
                  }
                >
                  {deliveryMode === 'evo'
                    ? 'Con entrega en Evo'
                    : deliveryMode === 'clase'
                      ? 'Entrega en clase'
                      : 'Sin entrega'}
                </Badge>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setPhase('choose-delivery')}
                className="text-white/70 hover:text-white rounded-[10px]"
              >
                Cambiar tipo de entrega
              </Button>
            </div>

            <div>
              <Label htmlFor="ga-titulo" className="text-white text-xs font-medium uppercase tracking-wider text-white/70">
                Nombre
              </Label>
              <Input
                id="ga-titulo"
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                required
                className="mt-1.5 text-lg font-semibold text-white bg-transparent border-0 border-b border-white/10 rounded-none px-0 py-3 focus-visible:ring-0 focus-visible:border-[#4DBBFF]/50 placeholder:text-white/40"
                placeholder="Nombre de la tarea"
              />
            </div>
            <div>
              <Label htmlFor="ga-desc" className="text-white text-xs font-medium uppercase tracking-wider text-white/70">
                Instrucciones
              </Label>
              <Textarea
                id="ga-desc"
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                required
                className="mt-1.5 min-h-[120px] bg-white/[0.04] border border-white/10 rounded-xl text-white placeholder:text-white/40 py-3 px-4"
                placeholder="Instrucciones para el estudiante"
                rows={4}
              />
            </div>

            <div className="rounded-[12px] border border-white/10 bg-white/[0.03] p-5 space-y-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-[#4DBBFF]/70">Configuración</p>
              <div>
                <Label className="text-white text-xs font-medium mb-2 block">Materia</Label>
                <Badge className="bg-[#1e3cff]/20 text-white border border-[#1e3cff]/40 text-base px-4 py-2 rounded-[10px]">{subjectNombre}</Badge>
                <span className="text-white/50 text-sm ml-2">(esta vista)</span>
              </div>
              {needsLogro ? (
                <LogroIndicadorSelects
                  bloques={bloquesForSelect}
                  indicadorId={logroCalificacionId}
                  onIndicadorIdChange={setLogroCalificacionId}
                  variant="dark"
                />
              ) : null}
              <div>
                <Label htmlFor="ga-fecha" className="text-white text-xs font-medium">
                  Fecha de entrega *
                </Label>
                <Input
                  id="ga-fecha"
                  type="datetime-local"
                  value={fechaEntrega}
                  onChange={(e) => setFechaEntrega(e.target.value)}
                  required
                  className="mt-1.5 bg-white/5 border-white/10 text-white rounded-[10px]"
                />
              </div>
              <p className="text-white/50 text-xs">
                Se creará en el <strong className="text-white/80">{trimestre === 1 ? 'I' : trimestre === 2 ? 'II' : 'III'} trimestre</strong>.
              </p>
            </div>

            <div className="flex gap-2 flex-wrap">
              <Button
                type="submit"
                disabled={createMutation.isPending || (needsLogro && !logroCalificacionId)}
                className="rounded-[10px] bg-gradient-to-r from-[#002366] to-[#1e3cff] hover:opacity-90 text-white"
              >
                {createMutation.isPending ? 'Creando...' : 'Crear asignación'}
              </Button>
              <Button type="button" variant="outline" onClick={onClose} className="rounded-[10px] border-white/10 text-[#E2E8F0] hover:bg-white/5">
                Cancelar
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
