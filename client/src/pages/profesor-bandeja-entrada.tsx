import React, { useState } from 'react';
import { Inbox, Trash2, MailOpen, User, Send, Search, Filter } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useLocation } from 'wouter';
import { NavBackButton } from '@/components/nav-back-button';

interface Mensaje {
  id: number;
  remitente: string;
  asunto: string;
  extracto: string;
  fecha: string;
  leido: boolean;
  curso?: string;
  cuerpo: string;
}

const mensajesFicticios: Mensaje[] = [
  {
    id: 1,
    remitente: "Estudiante: Juan Pérez",
    asunto: "Consulta sobre la tarea de Matemáticas",
    extracto: "Profesor, tengo una duda sobre el ejercicio 3 de la tarea...",
    fecha: "Hoy, 10:30 AM",
    leido: false,
    curso: "Matemáticas 7B",
    cuerpo: "Estimado profesor, tengo una duda sobre el ejercicio 3 de la tarea asignada. No estoy seguro de cómo aplicar la fórmula. ¿Podría ayudarme?",
  },
  {
    id: 2,
    remitente: "Prof. María López",
    asunto: "Reunión de coordinación académica",
    extracto: "Hola, necesitamos coordinar la reunión de mañana...",
    fecha: "Ayer, 4:00 PM",
    leido: true,
    curso: "Coordinación",
    cuerpo: "Hola, necesitamos coordinar la reunión de mañana para revisar los avances del proyecto académico. ¿Estás disponible a las 3 PM?",
  },
  {
    id: 3,
    remitente: "Estudiante: Ana García",
    asunto: "Solicitud de material adicional",
    extracto: "Buenos días, me gustaría tener acceso al material adicional...",
    fecha: "Dic 09, 9:00 AM",
    leido: true,
    curso: "Historia 8A",
    cuerpo: "Buenos días profesor, me gustaría tener acceso al material adicional sobre la Guerra Fría que mencionó en clase. ¿Podría compartirlo?",
  },
];

const MensajeFila: React.FC<{ mensaje: Mensaje; isSelected: boolean; onClick: () => void }> = ({ mensaje, isSelected, onClick }) => (
  <div
    className={`p-3 border-b border-white/10 cursor-pointer transition-colors ${
      isSelected ? 'bg-white/10 border-l-4 border-[#9f25b8]' : 'hover:bg-white/5'
    } ${!mensaje.leido ? 'font-semibold text-white' : 'text-white/70'}`}
    onClick={onClick}
  >
    <div className="flex justify-between items-center text-sm">
      <span className="truncate">{mensaje.remitente} {mensaje.curso && `(${mensaje.curso})`}</span>
      <span className="text-xs text-white/50 flex-shrink-0">{mensaje.fecha}</span>
    </div>
    <p className={`text-sm mt-1 truncate ${!mensaje.leido ? 'text-white' : 'text-white/70'}`}>{mensaje.asunto}</p>
    <p className="text-xs text-white/50 mt-1 truncate">{mensaje.extracto}</p>
  </div>
);

export default function ProfesorBandejaEntrada() {
  const [, setLocation] = useLocation();
  const [mensajes, setMensajes] = useState(mensajesFicticios);
  const [selectedMensaje, setSelectedMensaje] = useState<Mensaje | null>(mensajesFicticios[0]);

  const handleSelectMensaje = (mensaje: Mensaje) => {
    setSelectedMensaje(mensaje);
    setMensajes(prev => 
      prev.map(m => m.id === mensaje.id ? { ...m, leido: true } : m)
    );
  };

  const handleResponder = () => {
    alert(`Preparando respuesta para: ${selectedMensaje?.remitente}`);
  };

  const handleEliminar = () => {
    if (selectedMensaje) {
      setMensajes(prev => prev.filter(m => m.id !== selectedMensaje.id));
      setSelectedMensaje(mensajes.length > 1 ? mensajes[0] : null);
    }
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <NavBackButton to="/profesor/comunicacion" label="Comunicación" />
        <h1 className="text-3xl font-bold text-white mb-2 font-['Poppins'] mt-4">Bandeja de Entrada</h1>
        <p className="text-white/60">Comunicaciones con estudiantes y colegas</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 min-h-[70vh]">
        <div className="lg:col-span-1">
          <Card className="bg-white/5 border-white/10 backdrop-blur-md p-0 overflow-hidden h-full flex flex-col">
            <div className="p-4 border-b border-white/10 flex justify-between items-center">
              <Button 
                className="w-full bg-gradient-to-r from-[#9f25b8] to-[#6a0dad] hover:opacity-90 flex items-center gap-2"
                onClick={() => setLocation('/profesor/comunicacion/redactar')}
              >
                <Send className="w-4 h-4" />
                Nuevo Mensaje
              </Button>
            </div>

            <div className="p-4 border-b border-white/10 space-y-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-white/50" />
                <Input 
                  type="text" 
                  placeholder="Buscar en mensajes..." 
                  className="pl-10 bg-white/10 border-white/10 text-white placeholder:text-white/50"
                />
              </div>
              <div className="flex gap-2">
                <button className="flex items-center gap-1 text-sm text-white/70 hover:text-white transition-colors">
                  <Filter className="w-4 h-4 text-[#9f25b8]" /> Filtros
                </button>
                <span className="text-sm text-white/50">|</span>
                <span className="text-sm text-white/70">No Leídos: {mensajes.filter(m => !m.leido).length}</span>
              </div>
            </div>

            <div className="flex-grow overflow-y-auto">
              {mensajes.map((msg) => (
                <MensajeFila
                  key={msg.id}
                  mensaje={msg}
                  isSelected={selectedMensaje?.id === msg.id}
                  onClick={() => handleSelectMensaje(msg)}
                />
              ))}
              {mensajes.length === 0 && (
                <p className="p-4 text-white/50 text-center">Bandeja vacía.</p>
              )}
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
                    <User className="w-4 h-4 text-[#9f25b8]" />
                    <span>De: {selectedMensaje.remitente}</span>
                    {selectedMensaje.curso && (
                      <>
                        <MailOpen className="w-4 h-4 text-[#9f25b8]" />
                        <span>Curso: {selectedMensaje.curso}</span>
                      </>
                    )}
                    <span className="ml-auto text-white/50">{selectedMensaje.fecha}</span>
                  </div>
                </div>

                <div className="p-6 flex-grow overflow-y-auto text-white/80 leading-relaxed">
                  <p>{selectedMensaje.cuerpo}</p>
                </div>

                <div className="p-4 border-t border-white/10 flex justify-end gap-3">
                  <Button 
                    onClick={handleEliminar} 
                    variant="outline"
                    className="text-red-400 border-red-400 hover:bg-red-900/50"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Eliminar
                  </Button>
                  <Button 
                    onClick={handleResponder}
                    className="bg-gradient-to-r from-[#9f25b8] to-[#6a0dad] hover:opacity-90"
                  >
                    <Send className="w-4 h-4 mr-2" />
                    Responder
                  </Button>
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-full text-white/50 text-xl">
                <Inbox className="w-8 h-8 mr-2 text-[#9f25b8]" />
                Selecciona un mensaje para leer su contenido.
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

