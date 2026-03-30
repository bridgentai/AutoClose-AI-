import { Users, AlertTriangle, ChevronRight, Send, Megaphone } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { NavBackButton } from '@/components/nav-back-button';
import { useAuth } from '@/lib/authContext';

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

interface ResumenCardProps {
  title: string;
  icon: React.ReactElement;
  data: ResumenAcademicoData | ResumenInstitucionalData;
  variant: 'padres' | 'institucional';
  onClick?: () => void;
}

const cardShellBase =
  'bg-white/5 backdrop-blur-md p-8 flex flex-col h-full min-h-[28rem] hover:shadow-xl transition-shadow duration-300';
const cardShellClass = `${cardShellBase} border-white/10`;
const evoSendCardShellClass = `${cardShellBase} border-red-500/25`;

const ResumenCard: React.FC<ResumenCardProps> = ({ title, icon, data, variant, onClick }) => {
  const isPadres = variant === 'padres';
  const ac = isPadres ? (data as ResumenAcademicoData) : null;
  const ins = !isPadres ? (data as ResumenInstitucionalData) : null;

  return (
    <Card className={cardShellClass}>
      <CardContent className="p-0 flex flex-col flex-1 min-h-0">
        <div className="flex items-center gap-4 mb-6">
          <div
            className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 shadow-lg ${
              isPadres ? 'bg-blue-500/20 text-blue-400' : 'bg-teal-500/20 text-teal-400'
            }`}
          >
            {icon}
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white leading-tight">{title}</h2>
        </div>

        <div className="flex-1 flex flex-col min-h-[220px]">
          <div className="space-y-4 text-white/80">
            {isPadres && ac && (
              <>
                <p className="text-base font-medium flex justify-between gap-3 items-baseline">
                  <span className="text-white/70">Mensajes sin leer</span>
                  <span className="text-2xl font-bold text-yellow-400 tabular-nums shrink-0">{ac.mensajesSinLeer}</span>
                </p>
                <p className="text-base flex justify-between gap-3 border-t border-white/10 pt-4 items-baseline">
                  <span className="text-white/70">Respuestas pendientes</span>
                  <span className="text-xl font-bold text-white/90 tabular-nums shrink-0">{ac.respuestasPendientes}</span>
                </p>
                <p className="text-base flex justify-between gap-3 items-baseline">
                  <span className="text-white/70">Cursos / materias con actividad</span>
                  <span className="text-xl font-bold text-white/90 tabular-nums shrink-0">{ac.materiasDiferentes}</span>
                </p>
              </>
            )}
            {!isPadres && ins && (
              <>
                <p className="text-base font-medium flex justify-between gap-3 items-baseline">
                  <span className="text-white/70">Comunicados este mes</span>
                  <span className="text-2xl font-bold text-white tabular-nums shrink-0">{ins.comunicadosMes}</span>
                </p>
                <p className="text-base flex justify-between gap-3 border-t border-white/10 pt-4 items-baseline">
                  <span className="text-white/70">Sin leer</span>
                  <span className="text-xl font-bold text-yellow-400 tabular-nums shrink-0">{ins.mensajesSinLeer}</span>
                </p>
                <p className="text-base flex justify-between gap-3 border-t border-white/10 pt-4 items-start">
                  <span className="text-white/70 shrink-0">Último publicado</span>
                  <span className="text-white/90 font-medium text-right line-clamp-2">{ins.ultimoPublicado || '—'}</span>
                </p>
              </>
            )}
          </div>

          {data.urgente ? (
            <div className="mt-6 p-4 bg-red-900/40 border border-red-700/50 rounded-lg">
              <div className="flex items-center gap-2 text-red-400 font-semibold mb-2">
                <AlertTriangle className="w-5 h-5 shrink-0" /> Destacado
              </div>
              <p className="text-sm text-white font-medium">{data.urgente.remitente}</p>
              <p className="text-xs text-white/70 mt-1 italic line-clamp-2">{data.urgente.extracto}</p>
            </div>
          ) : (
            <div className="mt-6 flex-1 min-h-[5.5rem]" aria-hidden />
          )}
        </div>
      </CardContent>

      <Button
        className="w-full mt-8 flex items-center justify-center gap-2 bg-gradient-to-r from-[#002366] to-[#1e3cff] hover:opacity-90 shrink-0"
        data-testid={`button-bandeja-${variant}`}
        onClick={onClick}
      >
        Ir a {title}
        <ChevronRight className="w-5 h-5" />
      </Button>
    </Card>
  );
};

const EvoSendCard: React.FC<{ onClick: () => void }> = ({ onClick }) => (
  <Card className={evoSendCardShellClass}>
    <CardContent className="p-0 flex flex-col flex-1 min-h-0">
      <div className="flex items-center gap-4 mb-6">
        <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 shadow-lg shadow-red-500/30 bg-gradient-to-br from-red-500 via-red-600 to-rose-500">
          <Send className="w-10 h-10 text-white" />
        </div>
        <h2 className="text-2xl sm:text-3xl font-extrabold text-white leading-tight">Evo Send</h2>
      </div>

      <div className="flex-1 flex flex-col min-h-[220px]">
        <div className="space-y-4 text-white/80">
          <p className="text-base font-medium flex justify-between gap-3 items-baseline">
            <span className="text-white/70">Profesor</span>
            <span className="text-xl font-bold text-white/90 text-right">Grupos por curso</span>
          </p>
          <p className="text-base flex justify-between gap-3 border-t border-white/10 pt-4 items-baseline">
            <span className="text-white/70">Estudiante</span>
            <span className="text-xl font-bold text-white/90 text-right">Chat por materia</span>
          </p>
          <p className="text-base flex justify-between gap-3 border-t border-white/10 pt-4 items-start">
            <span className="text-white/70 shrink-0">Experiencia</span>
            <span className="text-white/90 font-medium text-right line-clamp-2">Tipo WhatsApp, en tiempo real</span>
          </p>
        </div>

        <div className="mt-6 flex-1 min-h-[5.5rem]" aria-hidden />
      </div>
    </CardContent>

    <Button
      className="w-full mt-8 flex items-center justify-center gap-2 shrink-0 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white"
      data-testid="button-evo-send"
      onClick={onClick}
    >
      Abrir Evo Send
      <ChevronRight className="w-5 h-5" />
    </Button>
  </Card>
);

const ComunicacionHome: React.FC = () => {
  const [location, setLocation] = useLocation();
  const { user } = useAuth();
  const showEvoSend = !!user?.rol;
  const isDirectivoView = location.startsWith('/directivo/comunicacion');
  const backTo = isDirectivoView ? '/directivo/academia' : '/dashboard';
  const backLabel = isDirectivoView ? 'Academia' : 'Dashboard';

  const { data: summary, isLoading } = useQuery({
    queryKey: ['communication-summary'],
    queryFn: fetchCommunicationSummary,
  });

  const resumenAcademico = summary?.academico ?? defaultResumenAcademico;
  const resumenInstitucional = summary?.institucional ?? defaultResumenInstitucional;

  const handlePadresClick = () => {
    setLocation('/comunicacion/academico');
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
      <div className="mb-10">
        <h1 className="text-4xl font-extrabold tracking-tight text-white">Centro de Comunicación</h1>
        <p className="text-lg text-white/70 mt-2">
          Comunicados a familias, circulares institucionales y Evo Send.
        </p>
      </div>

      {isLoading ? (
        <div
          className={`grid grid-cols-1 gap-8 min-h-[60vh] ${showEvoSend ? 'lg:grid-cols-3' : 'lg:grid-cols-2'}`}
        >
          <Card className={`${cardShellClass} animate-pulse`}>
            <CardContent className="p-0 h-64 rounded bg-white/5" />
          </Card>
          <Card className={`${cardShellClass} animate-pulse`}>
            <CardContent className="p-0 h-64 rounded bg-white/5" />
          </Card>
          {showEvoSend && (
            <Card className={`${cardShellClass} animate-pulse`}>
              <CardContent className="p-0 h-64 rounded bg-white/5" />
            </Card>
          )}
        </div>
      ) : (
        <div className={`grid grid-cols-1 gap-8 min-h-[60vh] ${showEvoSend ? 'lg:grid-cols-3' : 'lg:grid-cols-2'}`}>
          <ResumenCard
            title="Comunicados a Padres"
            icon={<Megaphone className="w-10 h-10" />}
            data={resumenAcademico}
            variant="padres"
            onClick={handlePadresClick}
          />

          <ResumenCard
            title="Comunicados Institucionales"
            icon={<Users className="w-10 h-10" />}
            data={resumenInstitucional}
            variant="institucional"
            onClick={handleInstitucionalClick}
          />

          {showEvoSend && <EvoSendCard onClick={handleEvoSendClick} />}
        </div>
      )}
    </div>
  );
};

export default ComunicacionHome;
