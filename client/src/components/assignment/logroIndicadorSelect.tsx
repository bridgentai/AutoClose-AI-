import { useEffect, useMemo, useState } from 'react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

export interface LogroBloqueSelectItem {
  _id: string;
  descripcion: string;
  orden?: number;
  indicadores: { _id: string; nombre: string; porcentaje: number; orden?: number }[];
}

export interface LogrosApiForSelect {
  logros?: LogroBloqueSelectItem[];
  indicadoresPlano?: { _id: string; nombre: string; porcentaje: number; orden?: number }[];
}

export function buildLogroBloquesForSelect(data: LogrosApiForSelect | undefined): LogroBloqueSelectItem[] {
  if (!data) return [];
  const nested = [...(data.logros ?? [])].sort((a, b) => (a.orden ?? 999) - (b.orden ?? 999));
  const withSortedInd = nested.map((b) => ({
    ...b,
    indicadores: [...(b.indicadores ?? [])].sort((a, b) => (a.orden ?? 999) - (b.orden ?? 999)),
  }));
  if (withSortedInd.length > 0) return withSortedInd;
  const plano = [...(data.indicadoresPlano ?? [])].sort((a, b) => (a.orden ?? 999) - (b.orden ?? 999));
  if (plano.length === 0) return [];
  return [
    {
      _id: '__indicadores__',
      descripcion: 'Indicadores de calificación',
      orden: 0,
      indicadores: plano.map((p) => ({
        _id: p._id,
        nombre: p.nombre,
        porcentaje: p.porcentaje,
        orden: p.orden,
      })),
    },
  ];
}

export function countIndicadoresInBloques(bloques: LogroBloqueSelectItem[]): number {
  return bloques.reduce((n, b) => n + (b.indicadores?.length ?? 0), 0);
}

const darkTrigger =
  'mt-1.5 bg-white/5 border-white/10 text-white rounded-[10px] transition-colors duration-150 ease-in-out hover:border-white/20';
const darkContent = 'bg-[#0f172a] border-white/10 text-white';
const lightTrigger = 'bg-white border-gray-300 text-gray-900';
const lightContent = 'bg-white border-gray-200 text-gray-900';

type Variant = 'dark' | 'light';

export function LogroIndicadorSelects({
  bloques,
  indicadorId,
  onIndicadorIdChange,
  disabled,
  variant = 'dark',
  className,
}: {
  bloques: LogroBloqueSelectItem[];
  indicadorId: string;
  onIndicadorIdChange: (id: string) => void;
  disabled?: boolean;
  variant?: Variant;
  className?: string;
}) {
  const sorted = useMemo(
    () =>
      [...bloques]
        .sort((a, b) => (a.orden ?? 999) - (b.orden ?? 999))
        .map((b) => ({
          ...b,
          indicadores: [...(b.indicadores ?? [])].sort((a, b) => (a.orden ?? 999) - (b.orden ?? 999)),
        })),
    [bloques]
  );
  const [bloqueId, setBloqueId] = useState<string>('');

  useEffect(() => {
    if (!indicadorId) {
      setBloqueId('');
      return;
    }
    const parent = sorted.find((b) => (b.indicadores ?? []).some((i) => i._id === indicadorId));
    if (parent) setBloqueId(parent._id);
  }, [indicadorId, sorted]);

  const bloqueActual = sorted.find((b) => b._id === bloqueId);
  const indicadoresDelBloque = bloqueActual?.indicadores ?? [];

  const t = variant === 'dark' ? darkTrigger : lightTrigger;
  const c = variant === 'dark' ? darkContent : lightContent;
  const labelClass = variant === 'dark' ? 'text-white text-xs font-medium' : 'text-sm font-medium text-gray-700';

  if (sorted.length === 0) return null;

  const logroLabel = (b: LogroBloqueSelectItem) => {
    const raw = (b.descripcion ?? '').trim();
    return raw.length > 0 ? raw : 'Logro';
  };

  return (
    <div className={cn('space-y-4', className)}>
      <div>
        <Label className={labelClass}>Logro (categoría) *</Label>
        <Select
          value={bloqueId || undefined}
          onValueChange={(v) => {
            setBloqueId(v);
            onIndicadorIdChange('');
          }}
          disabled={disabled}
        >
          <SelectTrigger className={t}>
            <SelectValue placeholder="Primero elige el logro al que pertenece la actividad" />
          </SelectTrigger>
          <SelectContent className={c}>
            {sorted.map((b) => (
              <SelectItem key={b._id} value={b._id} className={variant === 'dark' ? 'text-white focus:bg-white/10' : ''}>
                {logroLabel(b)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {bloqueId ? (
        <div>
          <Label className={labelClass}>Indicador *</Label>
          <Select value={indicadorId || undefined} onValueChange={onIndicadorIdChange} disabled={disabled}>
            <SelectTrigger className={t}>
              <SelectValue placeholder="Elige el indicador dentro de este logro" />
            </SelectTrigger>
            <SelectContent className={c}>
              {indicadoresDelBloque.map((ind) => (
                <SelectItem key={ind._id} value={ind._id} className={variant === 'dark' ? 'text-white focus:bg-white/10' : ''}>
                  {ind.nombre} ({ind.porcentaje}%)
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className={variant === 'dark' ? 'text-white/50 text-xs mt-1' : 'text-xs text-gray-500 mt-1'}>
            El indicador define cómo pondera esta actividad dentro del logro.
          </p>
        </div>
      ) : null}
    </div>
  );
}
