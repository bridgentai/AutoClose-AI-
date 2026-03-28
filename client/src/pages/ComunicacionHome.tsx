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

const ResumenCard: React.FC<ResumenCardProps> = ({ title, icon, data, variant, onClick }) => {
  const isPadres = variant === 'padres';
  const ac = isPadres ? (data as ResumenAcademicoData) : null;
  const ins = !isPadres ? (data as ResumenInstitucionalData) : null;

  return (
    <Card className="bg-white/5 border-white/10 backdrop-blur-md p-8 flex flex-col justify-between h-full hover:shadow-xl transition-shadow duration-300">
      <CardContent className="p-0">
        <div className="flex items-center gap-4 mb-6">
          <div className={`w-10 h-10 ${isPadres ? 'text-[#3B82F6]' : 'text-teal-400'}`}>
            {icon}
          </div>
          <h2 className="text-3xl font-extrabold text-white">{title}</h2>
        </div>

        <div className="space-y-4 text-white/80 mt-4">
          {isPadres && ac && (
            <>
              <p className="text-lg font-medium flex justify-between">
                <span>Mensajes sin leer</span>
                <span className="text-3xl font-bold text-yellow-400">{ac.mensajesSinLeer}</span>
              </p>
              <p className="text-base flex justify-between border-t border-white/10 pt-4">
                <span>Respuestas pendientes</span>
                <span className="text-xl font-bold text-white/90">{ac.respuestasPendientes}</span>
              </p>
              <p className="text-base flex justify-between">
                <span>Cursos / materias con actividad</span>
                <span className="text-xl font-bold text-white/90">{ac.materiasDiferentes}</span>
              </p>
            </>
          )}
          {!isPadres && ins && (
            <>
              <p className="text-lg font-medium flex justify-between">
                <span>Comunicados este mes</span>
                <span className="text-3xl font-bold text-white">{ins.comunicadosMes}</span>
              </p>
              <p className="text-base flex justify-between border-t border-white/10 pt-4">
                <span>Sin leer</span>
                <span className="text-xl font-bold text-yellow-400">{ins.mensajesSinLeer}</span>
              </p>
              <p className="text-sm text-white/60 border-t border-white/10 pt-4 line-clamp-2">
                Último publicado:{' '}
                <span className="text-white/90 font-medium">{ins.ultimoPublicado || '—'}</span>
              </p>
            </>
          )}
        </div>

        {data.urgente && (
          <div className="mt-8 p-4 bg-red-900/40 border border-red-700/50 rounded-lg">
            <div className="flex items-center gap-2 text-red-400 font-semibold mb-2">
              <AlertTriangle className="w-5 h-5" /> Destacado
            </div>
            <p className="text-sm text-white font-medium">{data.urgente.remitente}</p>
            <p className="text-xs text-white/70 mt-1 italic truncate">{data.urgente.extracto}</p>
          </div>
        )}
      </CardContent>

      <Button
        className="w-full mt-8 flex items-center justify-center gap-2 bg-gradient-to-r from-[#002366] to-[#1e3cff] hover:opacity-90"
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
  <Card className="bg-white/5 border-white/10 backdrop-blur-md p-8 flex flex-col justify-between h-full hover:shadow-xl transition-shadow duration-300 border-emerald-500/20">
    <CardContent className="p-0">
      <div className="flex items-center gap-4 mb-6">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-emerald-500/20 text-emerald-400">
          <Send className="w-10 h-10" />
        </div>
        <h2 className="text-3xl font-extrabold text-white">Evo Send</h2>
      </div>
      <p className="text-white/80 text-base mt-2">
        Chat por curso y materia, tipo WhatsApp. El profesor ve sus cursos como grupos; el estudiante ve cada materia con el nombre del profesor.
      </p>
      <Button
        className="w-full mt-8 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white"
        data-testid="button-evo-send"
        onClick={onClick}
      >
        Abrir Evo Send
        <ChevronRight className="w-5 h-5" />
      </Button>
    </CardContent>
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
        <h1 className="text-4xl font-extrabold tracking-tight text-white">Centro de Comunicacion</h1>
        <p className="text-lg text-white/70 mt-2">
          Comunicados a familias, circulares institucionales y Evo Send.
        </p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-8 min-h-[60vh] lg:grid-cols-2">
          <Card className="bg-white/5 border-white/10 backdrop-blur-md p-8 animate-pulse">
            <CardContent className="p-0 h-64 rounded bg-white/5" />
          </Card>
          <Card className="bg-white/5 border-white/10 backdrop-blur-md p-8 animate-pulse">
            <CardContent className="p-0 h-64 rounded bg-white/5" />
          </Card>
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
