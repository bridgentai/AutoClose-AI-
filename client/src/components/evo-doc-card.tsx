import { useState } from 'react';
import { Bell, FileText, ArrowRight, Loader2 } from 'lucide-react';
import { openEvoDocPdfInNewTab } from '@/lib/evoDocPdf';
import { useToast } from '@/hooks/use-toast';

interface EvoDocCardProps {
  title: string;
  description?: string;
  period?: string;
  docId: string;
  url?: string;
  compact?: boolean;
}

export function EvoDocCard({ title, description, period, docId, compact }: EvoDocCardProps) {
  const { toast } = useToast();
  const [opening, setOpening] = useState(false);

  return (
    <div
      className="relative overflow-hidden cursor-pointer group"
      style={{
        background: 'linear-gradient(145deg, rgba(15,23,42,0.95), rgba(7,9,15,0.98))',
        border: '1px solid rgba(168,85,247,0.2)',
        borderRadius: 16,
        padding: compact ? '16px 20px' : '20px 24px',
        maxWidth: compact ? 360 : 480,
      }}
      onClick={() => {
        if (opening) return;
        setOpening(true);
        void openEvoDocPdfInNewTab(docId)
          .catch((e: unknown) => {
            toast({
              title: 'No se pudo abrir el documento',
              description: e instanceof Error ? e.message : 'Intenta de nuevo',
              variant: 'destructive',
            });
          })
          .finally(() => setOpening(false));
      }}
    >
      {/* Gradient accent at bottom */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: '50%',
          background: 'linear-gradient(180deg, transparent 0%, rgba(168,85,247,0.08) 50%, rgba(236,72,153,0.12) 100%)',
          pointerEvents: 'none',
        }}
      />
      {/* Left border accent */}
      <div
        style={{
          position: 'absolute',
          top: 8,
          left: 0,
          bottom: 8,
          width: 3,
          background: 'linear-gradient(180deg, #a855f7, #ec4899)',
          borderRadius: 2,
        }}
      />

      <div className="relative z-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div
              style={{
                width: 28,
                height: 28,
                background: 'linear-gradient(135deg, #3b82f6, #7c3aed)',
                borderRadius: 8,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <FileText className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="text-sm font-semibold text-white/90">Evo Docs</span>
          </div>
          <div className="flex items-center gap-2">
            {opening ? (
              <Loader2 className="w-4 h-4 animate-spin text-purple-400" />
            ) : (
              <Bell className="w-4 h-4 text-purple-400/60" />
            )}
            <span className="text-xs font-medium text-purple-400 group-hover:text-purple-300 transition-colors flex items-center gap-1">
              Abrir PDF <ArrowRight className="w-3 h-3" />
            </span>
          </div>
        </div>

        {/* Category label */}
        {period && (
          <div className="text-[10px] uppercase tracking-widest text-purple-400/70 mb-1.5">
            {title.length > 40 ? title.slice(0, 40) + '...' : title}
          </div>
        )}

        {/* Title */}
        <h3
          className="font-semibold text-white/95 mb-1"
          style={{ fontSize: compact ? 16 : 18, lineHeight: 1.3 }}
        >
          {title}
        </h3>

        {/* Description */}
        {description && (
          <p className="text-xs text-white/45 line-clamp-2">{description}</p>
        )}
      </div>
    </div>
  );
}
