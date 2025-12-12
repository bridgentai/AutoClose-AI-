import React from 'react';
// Importamos los componentes de Layout y UI
import { AppLayout, PageHeader, Card, PrimaryButton } from '../layout/AppLayout'; 
import { Briefcase, Users, MessageSquare, Clock, AlertTriangle, ChevronRight } from 'lucide-react';

// --- Datos Ficticios para los Resúmenes ---
const resumenAcademico = {
  mensajesNuevos: 5,
  mensajesSinLeer: 4,
  materiasDiferentes: 3,
  urgente: {
    remitente: "Prof. María López (Matemáticas)",
    extracto: "Urgente: La entrega del proyecto de la semana pasada tiene un error de cálculo...",
  },
};

const resumenComunidad = {
  mensajesNuevos: 12,
  mensajesSinLeer: 7,
  gruposDiferentes: 5,
  urgente: {
    remitente: "Comité de Estudiantes",
    extracto: "Alerta: Reunión obligatoria para todos los delegados de grupo mañana a las 10 AM...",
  },
};

// --- Componente de Tarjeta Resumen ---
interface ResumenCardProps {
  title: string;
  icon: React.ReactElement;
  data: any;
  type: 'academico' | 'comunidad';
}

const ResumenCard: React.FC<ResumenCardProps> = ({ title, icon, data, type }) => {
  const isAcademico = type === 'academico';

  return (
    <Card className="p-8 flex flex-col justify-between h-full hover:shadow-xl transition-shadow duration-300">
      <div>
        {/* Título y Icono Principal */}
        <div className="flex items-center gap-4 mb-6">
          {React.cloneElement(icon, { className: `w-10 h-10 ${isAcademico ? 'text-[#9f25b8]' : 'text-teal-400'}` })}
          <h2 className="text-3xl font-extrabold text-white">{title}</h2>
        </div>

        {/* Indicadores Clave */}
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

        {/* Mensaje Urgente Destacado */}
        <div className="mt-8 p-4 bg-red-900/40 border border-red-700/50 rounded-lg">
          <div className="flex items-center gap-2 text-red-400 font-semibold mb-2">
            <AlertTriangle className="w-5 h-5" /> MENSAJE URGENTE
          </div>
          <p className="text-sm text-white font-medium">{data.urgente.remitente}</p>
          <p className="text-xs text-white/70 mt-1 italic truncate">{data.urgente.extracto}</p>
        </div>
      </div>

      {/* Botón de Acción Principal */}
      <PrimaryButton className="w-full mt-8 flex items-center justify-center gap-2">
        Ir a la Bandeja de {title}
        <ChevronRight className="w-5 h-5" />
      </PrimaryButton>
    </Card>
  );
};


// --- Componente Principal ---
const ComunicacionHome: React.FC = () => {
  return (
    <AppLayout>
      <PageHeader
        title="Centro de Comunicación"
        description="Selecciona tu área de interés para gestionar conversaciones académicas o comunitarias."
      />

      {/* Contenedor de las dos Cartas Grandes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 min-h-[70vh]">

        {/* Tarjeta de Comunicación Académica */}
        <ResumenCard
          title="Académico"
          icon={<Briefcase />}
          data={resumenAcademico}
          type="academico"
        />

        {/* Tarjeta de Comunicación Comunitaria */}
        <ResumenCard
          title="Comunidad"
          icon={<Users />}
          data={resumenComunidad}
          type="comunidad"
        />

      </div>
    </AppLayout>
  );
};

export default ComunicacionHome;