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
  tipo: 'estudiante' | 'profesor' | 'grupo';
  asunto: string;
  extracto: string;
  fecha: string;
  leido: boolean;
}

const mensajesEnviados: MensajeEnviado[] = [
  {
    id: 1,
    destinatario: "Estudiante: Juan Pérez",
    tipo: 'estudiante',
    asunto: "Recordatorio: Entrega de tarea",
    extracto: "Recuerda que la tarea de Matemáticas debe entregarse mañana...",
    fecha: "Hoy, 9:00 AM",
    leido: true,
  },
  {
    id: 2,
    destinatario: "Grupo: 7B",
    tipo: 'grupo',
    asunto: "Material adicional para la clase",
    extracto: "He subido material adicional sobre el tema que vimos hoy...",
    fecha: "Ayer, 3:30 PM",
    leido: false,
  },
  {
    id: 3,
    destinatario: "Prof. María López",
    tipo: 'profesor',
    asunto: "Coordinación de reunión",
    extracto: "Hola, me gustaría coordinar una reunión para revisar...",
    fecha: "Dic 08, 2:00 PM",
    leido: true,
  },
];

export default function ProfesorMensajesEnviados() {
  const [, setLocation] = useLocation();
  const [selectedMensaje, setSelectedMensaje] = useState<MensajeEnviado | null>(mensajesEnviados[0]);

  return (
    <div className="p-6">
      <div className="mb-6">
        <NavBackButton to="/profesor/comunicacion" label="Comunicación" />
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
                    selectedMensaje?.id === msg.id ? 'bg-white/10 border-l-4 border-[#1e3cff]' : 'hover:bg-white/5'
                  }`}
                  onClick={() => setSelectedMensaje(msg)}
                >
                  <div className="flex justify-between items-center text-sm">
                    <span className="truncate text-white/80">{msg.destinatario}</span>
                    <span className="text-xs text-white/50 flex-shrink-0">{msg.fecha}</span>
                  </div>
                  <p className="text-sm mt-1 truncate text-white/70">{msg.asunto}</p>
                  <div className="flex items-center gap-2 mt-1">
                    {msg.tipo === 'estudiante' && <User className="w-3 h-3 text-white/50" />}
                    {msg.tipo === 'grupo' && <Users className="w-3 h-3 text-white/50" />}
                    {msg.tipo === 'profesor' && <User className="w-3 h-3 text-white/50" />}
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
                <div className="p-6 border-b border-white/10">
                  <h2 className="text-2xl font-bold text-white font-['Poppins']">{selectedMensaje.asunto}</h2>
                  <div className="flex items-center gap-4 mt-2 text-white/70 text-sm">
                    {selectedMensaje.tipo === 'estudiante' && <User className="w-4 h-4 text-[#1e3cff]" />}
                    {selectedMensaje.tipo === 'grupo' && <Users className="w-4 h-4 text-[#1e3cff]" />}
                    {selectedMensaje.tipo === 'profesor' && <User className="w-4 h-4 text-[#1e3cff]" />}
                    <span>Para: {selectedMensaje.destinatario}</span>
                    <span className="ml-auto text-white/50">{selectedMensaje.fecha}</span>
                  </div>
                </div>

                <div className="p-6 flex-grow overflow-y-auto text-white/80 leading-relaxed">
                  <p>{selectedMensaje.extracto}</p>
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-full text-white/50 text-xl">
                <Mail className="w-8 h-8 mr-2 text-[#1e3cff]" />
                Selecciona un mensaje para ver su contenido.
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

