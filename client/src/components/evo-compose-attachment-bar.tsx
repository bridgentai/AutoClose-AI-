import { Paperclip, FileText, Table, Presentation, Link2, Bell } from 'lucide-react';

export interface EvoComposeAttachmentBarProps {
  disabled?: boolean;
  onOpenDrive: () => void;
  onOpenReminder?: () => void;
  showReminder?: boolean;
  onCreateDoc: () => void;
  onCreateSheet: () => void;
  onCreateSlide: () => void;
  onAttachLink: () => void;
  createPending?: boolean;
}

const btnBase =
  'w-9 h-9 flex items-center justify-center rounded-lg transition-colors hover:bg-white/[0.06] text-white/35 hover:text-white/60 disabled:opacity-40 shrink-0';

export function EvoComposeAttachmentBar({
  disabled = false,
  onOpenDrive,
  onOpenReminder,
  showReminder = false,
  onCreateDoc,
  onCreateSheet,
  onCreateSlide,
  onAttachLink,
  createPending = false,
}: EvoComposeAttachmentBarProps) {
  const d = disabled || createPending;
  return (
    <div className="flex flex-wrap items-center gap-0.5 sm:gap-1 shrink-0">
      <button type="button" className={btnBase} disabled={d} onClick={onOpenDrive} title="Adjuntar desde Evo Drive">
        <Paperclip className="w-[18px] h-[18px]" strokeWidth={2} />
      </button>
      <button type="button" className={btnBase} disabled={d} onClick={onCreateDoc} title="Crear documento (Google)">
        <FileText className="w-[18px] h-[18px]" strokeWidth={2} />
      </button>
      <button type="button" className={btnBase} disabled={d} onClick={onCreateSheet} title="Crear hoja de cálculo">
        <Table className="w-[18px] h-[18px]" strokeWidth={2} />
      </button>
      <button type="button" className={btnBase} disabled={d} onClick={onCreateSlide} title="Crear presentación">
        <Presentation className="w-[18px] h-[18px]" strokeWidth={2} />
      </button>
      <button type="button" className={btnBase} disabled={d} onClick={onAttachLink} title="Adjuntar enlace">
        <Link2 className="w-[18px] h-[18px]" strokeWidth={2} />
      </button>
      {showReminder && onOpenReminder ? (
        <button type="button" className={btnBase} disabled={d} onClick={onOpenReminder} title="Recordatorio de tarea">
          <Bell className="w-[18px] h-[18px]" strokeWidth={2} />
        </button>
      ) : null}
    </div>
  );
}
