import type { ReactNode } from 'react';
import { Plus, Cloud, Link2, FileText, Presentation, Table } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

export interface EvoComposeAddMenuProps {
  disabled?: boolean;
  createPending?: boolean;
  googleConnected?: boolean;
  onGoogleDrive: () => void;
  onAttachLink: () => void;
  onCreateDoc: () => void;
  onCreateSlide: () => void;
  onCreateSheet: () => void;
}

function IconSquare({ className, children }: { className: string; children: ReactNode }) {
  return (
    <span
      className={cn(
        'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg [&_svg]:h-4 [&_svg]:w-4 [&_svg]:text-white',
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
  googleConnected = true,
  onGoogleDrive,
  onAttachLink,
  onCreateDoc,
  onCreateSlide,
  onCreateSheet,
}: EvoComposeAddMenuProps) {
  const busy = disabled || createPending;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
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
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        side="top"
        sideOffset={8}
        className="w-[230px] rounded-[14px] border border-white/10 bg-[#0f172a] p-0 shadow-xl overflow-hidden"
      >
        <div className="py-2.5">
          <DropdownMenuItem
            disabled={busy || !googleConnected}
            className="flex items-center gap-3 py-2.5 px-4 text-[13px] text-white/90 hover:bg-[#00c8ff]/10 focus:bg-[#00c8ff]/10 mx-0 rounded-none cursor-pointer"
            onSelect={() => {
              setTimeout(() => onGoogleDrive(), 50);
            }}
          >
            <div className="w-8 h-8 rounded-[9px] bg-[#00c8ff]/20 flex items-center justify-center shrink-0">
              <Cloud className="w-4 h-4 text-[#00c8ff]" />
            </div>
            Google Drive
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={busy}
            className="flex items-center gap-3 py-2.5 px-4 text-[13px] text-white/90 hover:bg-[#00c8ff]/10 focus:bg-[#00c8ff]/10 mx-0 rounded-none cursor-pointer"
            onSelect={() => {
              setTimeout(() => onAttachLink(), 50);
            }}
          >
            <div className="w-8 h-8 rounded-[9px] bg-[#00c8ff]/20 flex items-center justify-center shrink-0">
              <Link2 className="w-4 h-4 text-[#00c8ff]" />
            </div>
            Enlace
          </DropdownMenuItem>
        </div>
        <div className="border-t border-white/10" />
        <div className="py-2">
          <p className="px-4 pt-1.5 pb-1 text-[11px] uppercase tracking-wider text-[#00c8ff]/50">Crear</p>
          <DropdownMenuItem
            disabled={busy || !googleConnected}
            className="flex items-center gap-3 py-2.5 px-4 text-[13px] text-white/90 hover:bg-[#00c8ff]/10 focus:bg-[#00c8ff]/10 mx-0 rounded-none cursor-pointer"
            onSelect={() => {
              setTimeout(() => onCreateDoc(), 50);
            }}
          >
            <IconSquare className="bg-[#1a56d6]">
              <FileText strokeWidth={2} />
            </IconSquare>
            Documentos
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={busy || !googleConnected}
            className="flex items-center gap-3 py-2.5 px-4 text-[13px] text-white/90 hover:bg-[#00c8ff]/10 focus:bg-[#00c8ff]/10 mx-0 rounded-none cursor-pointer"
            onSelect={() => {
              setTimeout(() => onCreateSlide(), 50);
            }}
          >
            <IconSquare className="bg-[#f59e0b]">
              <Presentation strokeWidth={2} />
            </IconSquare>
            Presentaciones
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={busy || !googleConnected}
            className="flex items-center gap-3 py-2.5 px-4 text-[13px] text-white/90 hover:bg-[#00c8ff]/10 focus:bg-[#00c8ff]/10 mx-0 rounded-none cursor-pointer"
            onSelect={() => {
              setTimeout(() => onCreateSheet(), 50);
            }}
          >
            <IconSquare className="bg-[#22c55e]">
              <Table strokeWidth={2} />
            </IconSquare>
            Hojas de cálculo
          </DropdownMenuItem>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
