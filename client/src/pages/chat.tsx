import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/lib/authContext';
import { AppSidebar } from '@/components/app-sidebar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send, Loader2 } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';

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

  return (
    <div className="h-screen bg-gradient-to-br from-[#0a0a0c] via-[#1a001c] to-[#3d0045] flex">
      <AppSidebar />

      <div className="flex-1 ml-20 flex flex-col">
        {/* Header */}
        <div className="sticky top-0 z-10 backdrop-blur-md bg-black/40 border-b border-white/5 px-8 py-4">
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
                <div className="w-20 h-20 bg-gradient-to-br from-[#9f25b8] to-[#6a0dad] rounded-2xl mx-auto mb-6 flex items-center justify-center">
                  <span className="text-4xl">🤖</span>
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
                        ? 'bg-gradient-to-r from-[#6a0dad] to-[#9f25b8] text-white rounded-br-sm'
                        : 'bg-white/95 text-gray-900 border-2 border-[#9f25b8] rounded-bl-sm'
                    }`}
                  >
                    <p className="text-[15px] leading-relaxed whitespace-pre-wrap">
                      {msg.contenido}
                    </p>
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex justify-start">
                  <div className="bg-white/90 text-[#9f25b8] px-5 py-3 rounded-2xl rounded-bl-sm border border-[#9f25b8]/30 flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="italic">Escribiendo...</span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input */}
        <div className="sticky bottom-0 backdrop-blur-md bg-black/30 border-t border-white/5 p-6">
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
              className="bg-white/5 border-white/10 text-white placeholder:text-white/40 h-12 rounded-2xl px-5"
              disabled={loading}
              data-testid="input-chat"
            />
            <Button
              onClick={handleSend}
              disabled={loading || !input.trim()}
              className="w-12 h-12 rounded-full bg-gradient-to-r from-[#9f25b8] to-[#6a0dad] hover:opacity-90 flex-shrink-0"
              data-testid="button-send"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
