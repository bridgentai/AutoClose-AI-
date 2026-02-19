import { Briefcase, Users, AlertTriangle, ChevronRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useLocation } from 'wouter';

const resumenAcademico = {
  mensajesNuevos: 5,
  mensajesSinLeer: 4,
  materiasDiferentes: 3,
  urgente: {
    remitente: "Prof. Maria Lopez (Matematicas)",
    extracto: "Urgente: La entrega del proyecto de la semana pasada tiene un error de calculo...",
  },
};

const resumenComunidad = {
  mensajesNuevos: 12,
  mensajesSinLeer: 7,
  gruposDiferentes: 5,
  urgente: {
    remitente: "Comite de Estudiantes",
    extracto: "Alerta: Reunion obligatoria para todos los delegados de grupo manana a las 10 AM...",
  },
};

interface ResumenCardProps {
  title: string;
  icon: React.ReactElement;
  data: any;
  type: 'academico' | 'comunidad';
  onClick?: () => void;
}

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
            <span className="text-xl font-bold text-white/90">{isAcademico ? data.materiasDiferentes : data.gruposDiferentes}</span>
          </p>
        </div>

        <div className="mt-8 p-4 bg-red-900/40 border border-red-700/50 rounded-lg">
          <div className="flex items-center gap-2 text-red-400 font-semibold mb-2">
            <AlertTriangle className="w-5 h-5" /> MENSAJE URGENTE
          </div>
          <p className="text-sm text-white font-medium">{data.urgente.remitente}</p>
          <p className="text-xs text-white/70 mt-1 italic truncate">{data.urgente.extracto}</p>
        </div>
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

const ComunicacionHome: React.FC = () => {
  const [, setLocation] = useLocation();

  const handleAcademicoClick = () => {
    setLocation('/comunicacion/academico');
  };

  const handleComunidadClick = () => {
    // TODO: Implementar navegación a comunidad cuando esté lista
    setLocation('/comunicacion/comunidad');
  };

  return (
    <div data-testid="comunicacion-page">
      <div className="mb-10">
        <h1 className="text-4xl font-extrabold tracking-tight text-white">Centro de Comunicacion</h1>
        <p className="text-lg text-white/70 mt-2">Selecciona tu area de interes para gestionar conversaciones academicas o comunitarias.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 min-h-[60vh]">
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
      </div>
    </div>
  );
};

export default ComunicacionHome;
