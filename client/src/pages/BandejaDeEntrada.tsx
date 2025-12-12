import React, { useState } from 'react';
// Asumimos que estos componentes están definidos en AppLayout.tsx o importados desde una librería de UI.
import { AppLayout, PageHeader, Card, PrimaryButton } from '../Layout/AppLayout'; 
// También agregué PrimaryButton por si lo necesita en esa página
// Importar iconos necesarios
import { Inbox, Trash2, MailOpen, User, Send, ChevronDown, Search, Filter } from 'lucide-react';

// --- Datos Ficticios para la Demostración ---
interface Mensaje {
  id: number;
  remitente: string;
  asunto: string;
  extracto: string;
  fecha: string;
  leido: boolean;
  materia: string;
  cuerpo: string;
}

const mensajesFicticios: Mensaje[] = [
  {
    id: 1,
    remitente: "Prof. María López",
    asunto: "Revisión de la Tarea de Sistemas No Lineales",
    extracto: "He revisado tu entrega. Necesito que clarifiques el punto 3...",
    fecha: "Hoy, 10:30 AM",
    leido: false,
    materia: "Matemáticas Avanzadas",
    cuerpo: "Estimado/a, he notado que la interpretación del Teorema de Poincaré en el punto 3 no es del todo correcta. Por favor, reenvíame una corrección antes de mañana. Saludos.",
  },
  {
    id: 2,
    remitente: "Administración Central",
    asunto: "Anuncio: Actualización de Horarios de Exámenes",
    extracto: "Por favor, revisen el documento adjunto con las nuevas fechas...",
    fecha: "Ayer, 4:00 PM",
    leido: true,
    materia: "General",
    cuerpo: "A todos los estudiantes y profesores, se han ajustado los horarios finales del semestre. El examen de Física se movió al día 15. Ver anexo.",
  },
  {
    id: 3,
    remitente: "Prof. Andrés Gaviria",
    asunto: "Material Adicional para la Clase de Historia",
    extracto: "Subí un nuevo PDF sobre la Guerra Fría. Es lectura obligatoria...",
    fecha: "Dic 09, 9:00 AM",
    leido: true,
    materia: "Historia Universal",
    cuerpo: "Adjunto encontrarán un resumen muy útil para la próxima sesión. No olviden preparar sus preguntas.",
  },
  // ... más mensajes
];


// --- Componente Fila de Mensaje ---
const MensajeFila: React.FC<{ mensaje: Mensaje; isSelected: boolean; onClick: () => void }> = ({ mensaje, isSelected, onClick }) => (
  <div
    className={`p-3 border-b border-white/10 cursor-pointer transition-colors ${
      isSelected ? 'bg-white/10 border-l-4 border-[#9f25b8]' : 'hover:bg-white/5'
    } ${!mensaje.leido ? 'font-semibold text-white' : 'text-white/70'}`}
    onClick={onClick}
  >
    <div className="flex justify-between items-center text-sm">
      <span className="truncate">{mensaje.remitente} ({mensaje.materia})</span>
      <span className="text-xs text-white/50 flex-shrink-0">{mensaje.fecha}</span>
    </div>
    <p className={`text-sm mt-1 truncate ${!mensaje.leido ? 'text-white' : 'text-white/70'}`}>{mensaje.asunto}</p>
    <p className="text-xs text-white/50 mt-1 truncate">{mensaje.extracto}</p>
  </div>
);

// --- Componente Bandeja de Entrada Principal ---
const BandejaDeEntrada: React.FC = () => {
  const [mensajes, setMensajes] = useState(mensajesFicticios);
  const [selectedMensaje, setSelectedMensaje] = useState<Mensaje | null>(mensajesFicticios[0]);

  const handleSelectMensaje = (mensaje: Mensaje) => {
    setSelectedMensaje(mensaje);
    // Marcar como leído
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
    <AppLayout>
      <PageHeader
        title="Bandeja de Entrada"
        description="Comunicaciones académicas y notificaciones importantes."
      />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 min-h-[70vh]">

        {/* Columna Izquierda: Lista de Mensajes (2/5 o 1/3) */}
        <div className="lg:col-span-1">
          <Card className="p-0 overflow-hidden h-full flex flex-col">
            <div className="p-4 border-b border-white/10 flex justify-between items-center">
                <PrimaryButton className="flex items-center gap-2">
                    <Send className="w-4 h-4" />
                    Nuevo Mensaje
                </PrimaryButton>
            </div>

            {/* Barra de Búsqueda y Filtro */}
            <div className="p-4 border-b border-white/10 space-y-2">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-white/50" />
                    <input 
                        type="text" 
                        placeholder="Buscar en mensajes..." 
                        className="w-full pl-10 pr-4 py-2 bg-white/10 rounded-lg text-white placeholder-white/50 border border-transparent focus:border-[#9f25b8] focus:outline-none"
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

            {/* Lista de Items de Mensaje */}
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

        {/* Columna Derecha: Contenido del Mensaje (3/5 o 2/3) */}
        <div className="lg:col-span-3">
          <Card className="p-0 overflow-hidden h-full flex flex-col">
            {selectedMensaje ? (
              <>
                {/* Header de la Conversación */}
                <div className="p-6 border-b border-white/10">
                  <h2 className="text-2xl font-bold text-white">{selectedMensaje.asunto}</h2>
                  <div className="flex items-center gap-4 mt-2 text-white/70 text-sm">
                    <User className="w-4 h-4 text-[#9f25b8]" />
                    <span>De: {selectedMensaje.remitente}</span>
                    <MailOpen className="w-4 h-4 text-[#9f25b8]" />
                    <span>Materia: {selectedMensaje.materia}</span>
                    <span className="ml-auto text-white/50">{selectedMensaje.fecha}</span>
                  </div>
                </div>

                {/* Cuerpo del Mensaje */}
                <div className="p-6 flex-grow overflow-y-auto text-white/80 leading-relaxed">
                  <p>{selectedMensaje.cuerpo}</p>
                  {/* Podrías añadir aquí adjuntos, imágenes, etc. */}
                </div>

                {/* Footer de Acciones */}
                <div className="p-4 border-t border-white/10 flex justify-end gap-3">
                  <button 
                    onClick={handleEliminar} 
                    className="flex items-center gap-2 px-4 py-2 text-red-400 border border-red-400 rounded-lg hover:bg-red-900/50 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                    Eliminar
                  </button>
                  <PrimaryButton onClick={handleResponder} className="flex items-center gap-2">
                    <Send className="w-4 h-4" />
                    Responder
                  </PrimaryButton>
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
    </AppLayout>
  );
};

export default BandejaDeEntrada;