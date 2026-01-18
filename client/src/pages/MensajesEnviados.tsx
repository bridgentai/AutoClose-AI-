import React, { useState } from 'react';
import { Mail, User, Users, CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useLocation } from 'wouter';
import { NavBackButton } from '@/components/nav-back-button';

interface MensajeEnviado {
  id: number;
  destinatario: string;
  tipo: 'profesor' | 'administrativo';
  asunto: string;
  extracto: string;
  fecha: string;
  leido: boolean;
}

const mensajesEnviados: MensajeEnviado[] = [
  {
    id: 1,
    destinatario: "Prof. María López",
    tipo: 'profesor',
    asunto: "Consulta sobre la tarea de Matemáticas",
    extracto: "Estimado profesor, tengo una duda sobre el ejercicio 3...",
    fecha: "Hoy, 9:00 AM",
    leido: true,
  },
  {
    id: 2,
    destinatario: "Administración",
    tipo: 'administrativo',
    asunto: "Solicitud de certificado de notas",
    extracto: "Buenos días, me gustaría solicitar un certificado de notas...",
    fecha: "Ayer, 3:30 PM",
    leido: false,
  },
];

const MensajesEnviados: React.FC = () => {
  const [, setLocation] = useLocation();
  const [selectedMensaje, setSelectedMensaje] = useState<MensajeEnviado | null>(mensajesEnviados[0]);

  return (
    <div className="p-6">
      <div className="mb-6">
        <NavBackButton to="/comunicacion" label="Comunicación" />
        <h1 className="text-3xl font-bold text-white mb-2 font-['Poppins'] mt-4">Mensajes Enviados</h1>
        <p className="text-white/60">Historial de mensajes que has enviado</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 min-h-[70vh]">
        <div className="lg:col-span-1">
          <Card className="bg-white/5 border-white/10 backdrop-blur-md p-0 overflow-hidden h-full flex flex-col">
            <div className="p-4 border-b border-white/10">
              <Input 
                placeholder="Buscar mensajes..." 
                className="bg-white/10 border-white/10 text-white placeholder:text-white/50"
              />
            </div>

            <div className="flex-grow overflow-y-auto">
              {mensajesEnviados.map((msg) => (
                <div
                  key={msg.id}
                  className={`p-3 border-b border-white/10 cursor-pointer transition-colors ${
                    selectedMensaje?.id === msg.id ? 'bg-white/10 border-l-4 border-[#9f25b8]' : 'hover:bg-white/5'
                  }`}
                  onClick={() => setSelectedMensaje(msg)}
                >
                  <div className="flex justify-between items-center text-sm">
                    <span className="truncate text-white/80">{msg.destinatario}</span>
                    <span className="text-xs text-white/50 flex-shrink-0">{msg.fecha}</span>
                  </div>
                  <p className="text-sm mt-1 truncate text-white/70">{msg.asunto}</p>
                  <div className="flex items-center gap-2 mt-1">
                    {msg.tipo === 'profesor' && <User className="w-3 h-3 text-white/50" />}
                    {msg.tipo === 'administrativo' && <Users className="w-3 h-3 text-white/50" />}
                    {msg.leido && <CheckCircle2 className="w-3 h-3 text-green-400" />}
                    <span className="text-xs text-white/50">{msg.leido ? 'Leído' : 'No leído'}</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <div className="lg:col-span-3">
          <Card className="bg-white/5 border-white/10 backdrop-blur-md p-0 overflow-hidden h-full flex flex-col">
            {selectedMensaje ? (
              <>
                <CardHeader className="p-6 border-b border-white/10">
                  <CardTitle className="text-2xl font-bold text-white font-['Poppins']">{selectedMensaje.asunto}</CardTitle>
                  <div className="flex items-center gap-4 mt-2 text-white/70 text-sm">
                    {selectedMensaje.tipo === 'profesor' && <User className="w-4 h-4 text-[#9f25b8]" />}
                    {selectedMensaje.tipo === 'administrativo' && <Users className="w-4 h-4 text-[#9f25b8]" />}
                    <span>Para: {selectedMensaje.destinatario}</span>
                    <span className="ml-auto text-white/50">{selectedMensaje.fecha}</span>
                  </div>
                </CardHeader>

                <CardContent className="p-6 flex-grow overflow-y-auto text-white/80 leading-relaxed">
                  <p>{selectedMensaje.extracto}</p>
                </CardContent>
              </>
            ) : (
              <div className="flex items-center justify-center h-full text-white/50 text-xl">
                <Mail className="w-8 h-8 mr-2 text-[#9f25b8]" />
                Selecciona un mensaje para ver su contenido.
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
};

export default MensajesEnviados;