import { AlertCircle, RefreshCw, Inbox } from "lucide-react";

interface QueryErrorProps {
  message?: string;
  onRetry?: () => void;
}

export function QueryError({ message = "Error al cargar los datos", onRetry }: QueryErrorProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3 text-white/50">
      <AlertCircle className="w-8 h-8 text-red-400/60" />
      <p className="text-sm">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="flex items-center gap-2 text-xs text-white/40 hover:text-white/70 transition-colors mt-1"
        >
          <RefreshCw className="w-3 h-3" /> Reintentar
        </button>
      )}
    </div>
  );
}

interface EmptyStateProps {
  message?: string;
  icon?: React.ReactNode;
}

export function EmptyState({ message = "No hay datos disponibles", icon }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3 text-white/40">
      {icon ?? <Inbox className="w-8 h-8" />}
      <p className="text-sm">{message}</p>
    </div>
  );
}
