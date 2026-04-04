import { useState, type ReactNode } from 'react';
import { Plus, Cloud, Link2, FileText, Presentation, Table } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

export interface EvoComposeAddMenuProps {
  disabled?: boolean;
  createPending?: boolean;
  onEvoDrive: () => void;
  onAttachLink: () => void;
  onCreateDoc: () => void;
  onCreateSlide: () => void;
  onCreateSheet: () => void;
}

const rowClass =
  'flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left transition-colors hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#7c3aed]/45 disabled:pointer-events-none disabled:opacity-40';

function IconSquare({ className, children }: { className: string; children: ReactNode }) {
  return (
    <span
      className={cn(
        'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg [&_svg]:h-4 [&_svg]:w-4 [&_svg]:text-white',
        className
      )}
    >
      {children}
    </span>
  );
}

export function EvoComposeAddMenu({
  disabled = false,
  createPending = false,
  onEvoDrive,
  onAttachLink,
  onCreateDoc,
  onCreateSlide,
  onCreateSheet,
}: EvoComposeAddMenuProps) {
  const [open, setOpen] = useState(false);
  const busy = disabled || createPending;

  const close = () => setOpen(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={busy}
          className={cn(
            'inline-flex items-center gap-2 rounded-full border border-white/[0.14] bg-white/[0.06] px-4 py-2 text-[13px] font-medium text-white/90',
            'shadow-sm transition-colors hover:border-[#7c3aed]/45 hover:bg-[rgba(124,58,237,0.14)]',
            'disabled:opacity-45 disabled:pointer-events-none'
          )}
        >
          <Plus className="h-4 w-4 shrink-0 opacity-90" strokeWidth={2.25} />
          Añadir o crear
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="top"
        sideOffset={8}
        className="w-[280px] rounded-2xl border border-white/[0.12] bg-[#1e293b] p-0 shadow-xl shadow-black/40"
      >
        <div className="p-2 space-y-0.5">
          <button
            type="button"
            className={rowClass}
            disabled={busy}
            onClick={() => {
              onEvoDrive();
              close();
            }}
          >
            <IconSquare className="bg-[#3b82f6]">
              <Cloud strokeWidth={2} />
            </IconSquare>
            <span className="text-[13px] font-medium text-white">Evo Drive</span>
          </button>
          <button
            type="button"
            className={rowClass}
            disabled={busy}
            onClick={() => {
              onAttachLink();
              close();
            }}
          >
            <IconSquare className="bg-[#3b82f6]">
              <Link2 strokeWidth={2} />
            </IconSquare>
            <span className="text-[13px] font-medium text-white">Enlace</span>
          </button>
        </div>
        <div className="mx-2 h-px bg-white/[0.08]" />
        <div className="p-2 pb-2.5">
          <p className="px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-wide text-white/45">Crear</p>
          <button
            type="button"
            className={rowClass}
            disabled={busy}
            onClick={() => {
              onCreateDoc();
              close();
            }}
          >
            <IconSquare className="bg-[#1d4ed8]">
              <FileText strokeWidth={2} />
            </IconSquare>
            <span className="text-[13px] font-medium text-white">Documentos</span>
          </button>
          <button
            type="button"
            className={rowClass}
            disabled={busy}
            onClick={() => {
              onCreateSlide();
              close();
            }}
          >
            <IconSquare className="bg-[#f59e0b]">
              <Presentation strokeWidth={2} />
            </IconSquare>
            <span className="text-[13px] font-medium text-white">Presentaciones</span>
          </button>
          <button
            type="button"
            className={rowClass}
            disabled={busy}
            onClick={() => {
              onCreateSheet();
              close();
            }}
          >
            <IconSquare className="bg-[#22c55e]">
              <Table strokeWidth={2} />
            </IconSquare>
            <span className="text-[13px] font-medium text-white">Hojas de cálculo</span>
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
