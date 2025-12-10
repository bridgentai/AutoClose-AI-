import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/lib/authContext';
import { AppSidebar } from '@/components/app-sidebar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send, Loader2, MessageSquare } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';

interface Message {
emisor: 'user' | 'ai';
contenido: string;
timestamp: Date;
}

export default function Chat() {
const { user } = useAuth();
const [messages, setMessages] = useState<Message[]>([]);
const [input, setInput] = useState('');
const [loading, setLoading] = useState(false);
const [sessionId, setSessionId] = useState<string | null>(null);
const messagesEndRef = useRef<HTMLDivElement>(null);

const scrollToBottom = () => {
messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
};

useEffect(() => {
scrollToBottom();
}, [messages]);

const handleSend = async () => {
if (!input.trim() || loading) return;

const userMessage: Message = {
emisor: 'user',
contenido: input,
timestamp: new Date(),
};

setMessages(prev => [...prev, userMessage]);
setInput('');
setLoading(true);

try {
// Si no hay sessionId, crear una nueva sesión
let currentSessionId = sessionId;
if (!currentSessionId) {
const newSession = await apiRequest<{ sessionId: string }>('POST', '/api/chat/new', {
titulo: `Chat ${new Date().toLocaleDateString()}`,
contextoTipo: `${user?.rol}_general`,
});
currentSessionId = newSession.sessionId;
setSessionId(currentSessionId);
}

// Enviar mensaje
const response = await apiRequest<{ aiResponse: string }>('POST', `/api/chat/${currentSessionId}/message`, {
mensaje: input,
emisor: 'user',
});

const aiMessage: Message = {
emisor: 'ai',
contenido: response.aiResponse,
timestamp: new Date(),
};

setMessages(prev => [...prev, aiMessage]);
} catch (error: any) {
console.error('Error en chat:', error);
const errorMessage: Message = {
emisor: 'ai',
contenido: 'Lo siento, ocurrió un error al procesar tu mensaje. Por favor intenta de nuevo.',
timestamp: new Date(),
};
setMessages(prev => [...prev, errorMessage]);
} finally {
setLoading(false);
}
};

  // ----------------------------------------------------------------------
  // ¡DEFINICIÓN DE COLORES UNIFICADA! (Paso 1)
  // Eliminamos la condicional isEstudiante para los colores de acento y fondo
  // ----------------------------------------------------------------------
const isEstudiante = user?.rol === 'estudiante'; // Se mantiene para usarla en la lógica, pero no en el estilo

  // Valores Fijos del Profesor (Púrpura)
const bgGradient = 'bg-gradient-to-br from-[#0a0a0c] via-[#1a001c] to-[#3d0045]'; 
const accentColor = '#9f25b8';
const accentColorDark = '#6a0dad';

return (
<SidebarProvider>
<div className={`flex h-screen w-full ${bgGradient}`}>
<AppSidebar />
<SidebarInset className="flex flex-col flex-1">
{/* Header (Paso 2a: Unificado) */}
<div className={`sticky top-0 z-10 backdrop-blur-md border-b px-8 py-4 bg-black/40 border-white/5`}>
<h1 className="text-2xl font-bold text-white font-['Poppins']">
AutoClose AI
</h1>
<p className="text-white/60 text-sm mt-1">
¿Por dónde empezamos?
</p>
</div>

{/* Messages */}
<div className="flex-1 overflow-y-auto px-8 py-6 max-w-4xl mx-auto w-full">
{messages.length === 0 ? (
<div className="flex items-center justify-center h-full">
<div className="text-center">
{/* Ícono Inicial (Paso 2b & 2c: Unificado) */}
<div className={`w-20 h-20 rounded-2xl mx-auto mb-6 flex items-center justify-center bg-gradient-to-br from-[#9f25b8] to-[#6a0dad]`}>
<MessageSquare className={`w-10 h-10 text-white`} />
</div>
<h2 className="text-3xl font-bold text-white mb-3 font-['Poppins']">
¿Por dónde empezamos?
</h2>
<p className="text-white/60 text-lg">
Pregunta sobre tus cursos, tareas o conceptos académicos
</p>
</div>
</div>
) : (
<div className="space-y-4">
{messages.map((msg, idx) => (
<div
key={idx}
className={`flex ${msg.emisor === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}
>
<div
className={`max-w-[80%] px-5 py-3 rounded-2xl ${
msg.emisor === 'user'
? `bg-gradient-to-r from-[${accentColorDark}] to-[${accentColor}] text-white rounded-br-sm`
: `bg-white/95 text-gray-900 border-2 border-[${accentColor}] rounded-bl-sm`
}`}
style={{
// Estos estilos se apoyan en las variables fijas de arriba.
background: msg.emisor === 'user' 
? `linear-gradient(to right, ${accentColorDark}, ${accentColor})` 
: undefined,
borderColor: msg.emisor !== 'user' ? accentColor : undefined
}}
>
<p className="text-[15px] leading-relaxed whitespace-pre-wrap">
{msg.contenido}
</p>
</div>
</div>
))}
{loading && (
<div className="flex justify-start">
<div 
className="bg-white/90 px-5 py-3 rounded-2xl rounded-bl-sm border flex items-center gap-2"
style={{ color: accentColor, borderColor: `${accentColor}30` }}
>
<Loader2 className="w-4 h-4 animate-spin" />
<span className="italic">Escribiendo...</span>
</div>
</div>
)}
<div ref={messagesEndRef} />
</div>
)}
</div>

{/* Input Bar (Paso 2d: Unificado) */}
<div className={`sticky bottom-0 backdrop-blur-md border-t p-6 bg-black/30 border-white/5`}>
<div className="max-w-4xl mx-auto flex gap-3 items-center">
<Input
value={input}
onChange={(e) => setInput(e.target.value)}
onKeyDown={(e) => {
if (e.key === 'Enter' && !e.shiftKey) {
e.preventDefault();
handleSend();
}
}}
placeholder="Escribe tu pregunta..."
className={`h-12 rounded-2xl px-5 text-white placeholder:text-white/40 bg-white/5 border-white/10`}
disabled={loading}
data-testid="input-chat"
/>
<Button
onClick={handleSend}
disabled={loading || !input.trim()}
className="w-12 h-12 rounded-full hover:opacity-90 flex-shrink-0"
style={{ background: `linear-gradient(to right, ${accentColor}, ${accentColorDark})` }}
data-testid="button-send"
>
{loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
</Button>
</div>
</div>
</SidebarInset>
</div>
</SidebarProvider>
);
}