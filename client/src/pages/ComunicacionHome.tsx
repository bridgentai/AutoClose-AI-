import { Users, ArrowRight, Send, Megaphone, AlertTriangle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { NavBackButton } from '@/components/nav-back-button';
import { useAuth } from '@/lib/authContext';
import { cn } from '@/lib/utils';

export interface ResumenUrgente {
  remitente: string;
  extracto: string;
}

export interface ResumenAcademicoData {
  mensajesNuevos: number;
  mensajesSinLeer: number;
  respuestasPendientes: number;
  materiasDiferentes: number;
  urgente: ResumenUrgente | null;
}

export interface ResumenInstitucionalData {
  mensajesNuevos: number;
  mensajesSinLeer: number;
  comunicadosMes: number;
  ultimoPublicado: string | null;
  gruposDiferentes: number;
  urgente: ResumenUrgente | null;
}

interface CommunicationSummaryResponse {
  academico: ResumenAcademicoData;
  institucional: ResumenInstitucionalData;
}

const fetchCommunicationSummary = async (): Promise<CommunicationSummaryResponse> => {
  const token = localStorage.getItem('autoclose_token') || localStorage.getItem('token');
  const res = await fetch('/api/courses/communication-summary', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Error al cargar el resumen');
  return res.json();
};

const defaultResumenAcademico: ResumenAcademicoData = {
  mensajesNuevos: 0,
  mensajesSinLeer: 0,
  respuestasPendientes: 0,
  materiasDiferentes: 0,
  urgente: null,
};

const defaultResumenInstitucional: ResumenInstitucionalData = {
  mensajesNuevos: 0,
  mensajesSinLeer: 0,
  comunicadosMes: 0,
  ultimoPublicado: null,
  gruposDiferentes: 0,
  urgente: null,
};

const cardShell =
  'bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl hover-elevate';
const evoSendShell =
  'bg-white/5 backdrop-blur-md border border-red-500/25 rounded-2xl hover-elevate';

function DestacadoBlock({ remitente, extracto }: ResumenUrgente) {
  return (
    <div className="mt-6 p-4 bg-red-900/40 border border-red-700/50 rounded-lg">
      <div className="flex items-center gap-2 text-red-400 font-semibold mb-2">
        <AlertTriangle className="w-5 h-5 shrink-0" aria-hidden />
        Destacado
      </div>
      <p className="text-sm text-white font-medium">{remitente}</p>
      <p className="text-xs text-white/70 mt-1 italic line-clamp-2">{extracto}</p>
    </div>
  );
}

interface PadresCardProps {
  data: ResumenAcademicoData;
  onVerDetalle: () => void;
}

const PadresCard: React.FC<PadresCardProps> = ({ data, onVerDetalle }) => (
  <Card className={cn(cardShell, 'overflow-hidden')}>
    <CardContent className="p-8 flex flex-col h-full">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-blue-500/20 text-blue-400">
          <Megaphone className="size-5" aria-hidden />
        </div>
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-white">
            Comunicados a Padres
          </h2>
          <p className="mt-1 text-sm text-white/70">Mensajes sin leer</p>
        </div>
      </div>

      <p
        className="mt-8 text-5xl font-bold tabular-nums tracking-tight text-yellow-400"
        aria-live="polite"
      >
        {data.mensajesSinLeer}
      </p>

      <button
        type="button"
        data-testid="button-bandeja-padres"
        onClick={onVerDetalle}
        className="mt-6 inline-flex items-center gap-1.5 self-start text-sm font-medium text-[#3B82F6] hover:text-[#60A5FA] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B82F6]/40 rounded-md"
      >
        Ver detalle
        <ArrowRight className="size-4" strokeWidth={2} aria-hidden />
      </button>

      {data.urgente ? <DestacadoBlock {...data.urgente} /> : null}
    </CardContent>
  </Card>
);

interface InstitucionalCardProps {
  data: ResumenInstitucionalData;
  onVerDetalle: () => void;
}

const InstitucionalCard: React.FC<InstitucionalCardProps> = ({ data, onVerDetalle }) => (
  <Card className={cn(cardShell, 'overflow-hidden')}>
    <CardContent className="p-8 flex flex-col h-full">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-teal-500/20 text-teal-400">
          <Users className="size-5" aria-hidden />
        </div>
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-white">
            Comunicados Institucionales
          </h2>
          <p className="mt-1 text-sm text-white/70">Publicados este mes</p>
        </div>
      </div>

      <p
        className="mt-8 text-5xl font-bold tabular-nums tracking-tight text-white"
        aria-live="polite"
      >
        {data.comunicadosMes}
      </p>

      {data.mensajesSinLeer > 0 ? (
        <div className="mt-3 flex items-center gap-2">
          <span className="size-1.5 shrink-0 rounded-full bg-yellow-400" aria-hidden />
          <span className="text-sm text-white/80">
            {data.mensajesSinLeer === 1
              ? '1 mensaje sin leer'
              : `${data.mensajesSinLeer} mensajes sin leer`}
          </span>
        </div>
      ) : (
        <p className="mt-3 text-sm text-white/40">Todo leído</p>
      )}

      <button
        type="button"
        data-testid="button-bandeja-institucional"
        onClick={onVerDetalle}
        className="mt-6 inline-flex items-center gap-1.5 self-start text-sm font-medium text-[#3B82F6] hover:text-[#60A5FA] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B82F6]/40 rounded-md"
      >
        Ver detalle
        <ArrowRight className="size-4" strokeWidth={2} aria-hidden />
      </button>

      {data.urgente ? <DestacadoBlock {...data.urgente} /> : null}
    </CardContent>
  </Card>
);

interface EvoSendCardProps {
  onAbrir: () => void;
}

const EvoSendCard: React.FC<EvoSendCardProps> = ({ onAbrir }) => (
  <Card className={cn(evoSendShell, 'overflow-hidden')}>
    <CardContent className="p-8 flex flex-col h-full">
      <div className="flex items-start gap-3">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border border-white/[0.1]"
          style={{
            background: 'linear-gradient(135deg, rgba(59,130,246,0.35), rgba(30,64,175,0.25))',
            boxShadow: '0 0 20px rgba(59,130,246,0.25)',
          }}
        >
          <Send className="size-5 text-white" aria-hidden />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold tracking-tight text-white">EvoSend</h2>
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" aria-hidden />
          </div>
          <p className="mt-2 text-sm leading-relaxed text-white/60">
            Comunicación en tiempo real por curso, materia y familia.
          </p>
        </div>
      </div>

      <div className="mt-8">
        <Button
          type="button"
          data-testid="button-evo-send"
          onClick={onAbrir}
          className="w-full sm:w-auto rounded-full text-white border-0 font-semibold shadow-lg shadow-[#3B82F6]/25 hover:opacity-95"
          style={{ background: 'linear-gradient(180deg, #3B82F6, #1D4ED8)' }}
        >
          Abrir EvoSend
          <ArrowRight className="size-4" aria-hidden />
        </Button>
      </div>
    </CardContent>
  </Card>
);

function CardsSkeleton({ showEvoSend }: { showEvoSend: boolean }) {
  return (
    <div
      className={cn(
        'grid gap-6',
        showEvoSend ? 'lg:grid-cols-3' : 'lg:grid-cols-2',
      )}
    >
      {[1, 2, ...(showEvoSend ? [3] : [])].map((k) => (
        <div
          key={k}
          className={cn(
            'h-[280px] rounded-2xl border border-white/10 bg-white/5 animate-pulse',
            showEvoSend && k === 3 && 'border-[#3B82F6]/20',
          )}
        >
          <div className="p-8 space-y-4">
            <div className="h-4 w-24 rounded bg-white/10" />
            <div className="h-4 w-40 rounded bg-white/10" />
            <div className="h-14 w-20 rounded-md bg-white/10 mt-6" />
          </div>
        </div>
      ))}
    </div>
  );
}

const ComunicacionHome: React.FC = () => {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const showEvoSend = !!user?.rol;
  const backTo = '/dashboard';
  const backLabel = 'Dashboard';

  const { data: summary, isLoading } = useQuery({
    queryKey: ['communication-summary'],
    queryFn: fetchCommunicationSummary,
  });

  const resumenAcademico = summary?.academico ?? defaultResumenAcademico;
  const resumenInstitucional = summary?.institucional ?? defaultResumenInstitucional;

  const handlePadresClick = () => {
    setLocation('/evo-send');
  };

  const handleInstitucionalClick = () => {
    setLocation('/comunidad/noticias');
  };

  const handleEvoSendClick = () => {
    setLocation('/evo-send');
  };

  return (
    <div data-testid="comunicacion-page">
      <NavBackButton to={backTo} label={backLabel} />

      <header className="mb-10 max-w-2xl">
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
          Centro de Comunicación
        </h1>
        <p className="mt-3 text-base sm:text-lg text-white/70 leading-relaxed">
          Comunicados a familias, circulares institucionales y Evo Send.
        </p>
      </header>

      {isLoading ? (
        <CardsSkeleton showEvoSend={showEvoSend} />
      ) : (
        <div
          className={cn(
            'grid gap-6',
            showEvoSend ? 'lg:grid-cols-3' : 'lg:grid-cols-2',
          )}
        >
          <PadresCard data={resumenAcademico} onVerDetalle={handlePadresClick} />
          <InstitucionalCard
            data={resumenInstitucional}
            onVerDetalle={handleInstitucionalClick}
          />
          {showEvoSend ? <EvoSendCard onAbrir={handleEvoSendClick} /> : null}
        </div>
      )}
    </div>
  );
};

export default ComunicacionHome;
