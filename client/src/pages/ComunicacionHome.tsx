import { Briefcase, Users, AlertTriangle, ChevronRight, Send } from 'lucide-react';
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
  materiasDiferentes: number;
  urgente: ResumenUrgente | null;
}

export interface ResumenComunidadData {
  mensajesNuevos: number;
  mensajesSinLeer: number;
  gruposDiferentes: number;
  urgente: ResumenUrgente | null;
}

interface CommunicationSummaryResponse {
  academico: ResumenAcademicoData;
  comunidad: ResumenComunidadData;
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
  materiasDiferentes: 0,
  urgente: null,
};

const defaultResumenComunidad: ResumenComunidadData = {
  mensajesNuevos: 0,
  mensajesSinLeer: 0,
  gruposDiferentes: 0,
  urgente: null,
};

interface ResumenCardProps {
  title: string;
  icon: React.ReactElement;
  data: ResumenAcademicoData | ResumenComunidadData;
  type: 'academico' | 'comunidad';
  onClick?: () => void;
}

const EVO_SEND_ROLES = ['estudiante', 'profesor', 'directivo', 'asistente', 'admin-general-colegio'];

const ResumenCard: React.FC<ResumenCardProps> = ({ title, icon, data, type, onClick }) => {
  const isAcademico = type === 'academico';
  const IconWithStyle = () => {
    const iconClass = `w-10 h-10 ${isAcademico ? 'text-[#1e3cff]' : 'text-teal-400'}`;
    return <span className={iconClass}>{icon}</span>;
  };

  return (
    <Card className="bg-white/5 border-white/10 backdrop-blur-md p-8 flex flex-col justify-between h-full hover:shadow-xl transition-shadow duration-300">
      <CardContent className="p-0">
        <div className="flex items-center gap-4 mb-6">
          <div className={`w-10 h-10 ${isAcademico ? 'text-[#1e3cff]' : 'text-teal-400'}`}>
            {isAcademico ? <Briefcase className="w-10 h-10" /> : <Users className="w-10 h-10" />}
          </div>
          <h2 className="text-3xl font-extrabold text-white">{title}</h2>
        </div>

        <div className="space-y-4 text-white/80 mt-4">
          <p className="text-lg font-medium flex justify-between">
            <span>Mensajes Nuevos:</span>
            <span className="text-3xl font-bold text-white">{data.mensajesNuevos}</span>
          </p>
          <p className="text-base flex justify-between border-t border-white/10 pt-4">
            <span>Mensajes Sin Leer:</span>
            <span className="text-xl font-bold text-yellow-400">{data.mensajesSinLeer}</span>
          </p>
          <p className="text-base flex justify-between">
            <span>{isAcademico ? 'Materias Diferentes:' : 'Grupos Diferentes:'}</span>
            <span className="text-xl font-bold text-white/90">{isAcademico ? (data as ResumenAcademicoData).materiasDiferentes : (data as ResumenComunidadData).gruposDiferentes}</span>
          </p>
        </div>

        {data.urgente && (
          <div className="mt-8 p-4 bg-red-900/40 border border-red-700/50 rounded-lg">
            <div className="flex items-center gap-2 text-red-400 font-semibold mb-2">
              <AlertTriangle className="w-5 h-5" /> MENSAJE URGENTE
            </div>
            <p className="text-sm text-white font-medium">{data.urgente.remitente}</p>
            <p className="text-xs text-white/70 mt-1 italic truncate">{data.urgente.extracto}</p>
          </div>
        )}
      </CardContent>

      <Button 
        className="w-full mt-8 flex items-center justify-center gap-2 bg-gradient-to-r from-[#002366] to-[#1e3cff] hover:opacity-90"
        data-testid={`button-bandeja-${type}`}
        onClick={onClick}
      >
        Ir a la Bandeja de {title}
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
  const showEvoSend = user?.rol && EVO_SEND_ROLES.includes(user.rol);
  const isDirectivoView = location.startsWith('/directivo/comunicacion');
  const backTo = isDirectivoView ? '/directivo/academia' : '/dashboard';
  const backLabel = isDirectivoView ? 'Academia' : 'Dashboard';

  const { data: summary, isLoading } = useQuery({
    queryKey: ['communication-summary'],
    queryFn: fetchCommunicationSummary,
  });

  const resumenAcademico = summary?.academico ?? defaultResumenAcademico;
  const resumenComunidad = summary?.comunidad ?? defaultResumenComunidad;

  const handleAcademicoClick = () => {
    setLocation('/comunicacion/academico');
  };

  const handleComunidadClick = () => {
    setLocation('/comunicacion/comunidad');
  };

  const handleEvoSendClick = () => {
    setLocation('/evo-send');
  };

  return (
    <div data-testid="comunicacion-page">
      <NavBackButton to={backTo} label={backLabel} />
      <div className="mb-10">
        <h1 className="text-4xl font-extrabold tracking-tight text-white">Centro de Comunicacion</h1>
        <p className="text-lg text-white/70 mt-2">Selecciona tu area de interes para gestionar conversaciones academicas o comunitarias.</p>
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
            title="Academico"
            icon={<Briefcase />}
            data={resumenAcademico}
            type="academico"
            onClick={handleAcademicoClick}
          />

          <ResumenCard
            title="Comunidad"
            icon={<Users />}
            data={resumenComunidad}
            type="comunidad"
            onClick={handleComunidadClick}
          />

          {showEvoSend && (
            <EvoSendCard onClick={handleEvoSendClick} />
          )}
        </div>
      )}
    </div>
  );
};

export default ComunicacionHome;
