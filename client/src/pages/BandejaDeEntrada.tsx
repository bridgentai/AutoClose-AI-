import React, { useState } from 'react';
import { Inbox, Trash2, MailOpen, User, Send, Search } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useLocation } from 'wouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { NavBackButton } from '@/components/nav-back-button';
import { useAuth } from '@/lib/authContext';

const CARD_STYLE = 'bg-white/5 border-white/10 backdrop-blur-md';

interface ConversacionItem {
  _id: string;
  asunto: string;
  participanteIds: { _id: string; nombre: string; correo: string; rol: string }[];
  ultimoMensaje: { texto: string; fecha: string; remitente: string } | null;
  createdAt: string;
}

interface MensajeItem {
  _id: string;
  texto: string;
  fecha: string;
  remitenteId: { _id: string; nombre: string };
  leido: boolean;
}

export default function BandejaDeEntrada() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');

  const { data: conversations = [] } = useQuery({
    queryKey: ['/api/messages/conversations'],
    queryFn: () => apiRequest<ConversacionItem[]>('GET', '/api/messages/conversations'),
  });

  const { data: convDetail } = useQuery({
    queryKey: ['/api/messages/conversations', selectedId],
    queryFn: () => apiRequest<{ conversacion: ConversacionItem; mensajes: MensajeItem[] }>('GET', `/api/messages/conversations/${selectedId}`),
    enabled: !!selectedId,
  });

  const markReadMutation = useMutation({
    mutationFn: (conversationId: string) => apiRequest('PATCH', `/api/messages/read/${conversationId}`),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['/api/messages/conversations'] });
      queryClient.invalidateQueries({ queryKey: ['/api/messages/conversations', id] });
    },
  });

  const sendMutation = useMutation({
    mutationFn: (texto: string) => apiRequest('POST', `/api/messages/conversations/${selectedId}`, { texto }),
    onSuccess: () => {
      setReplyText('');
      queryClient.invalidateQueries({ queryKey: ['/api/messages/conversations', selectedId] });
      queryClient.invalidateQueries({ queryKey: ['/api/messages/conversations'] });
    },
  });

  const selected = conversations.find((c) => c._id === selectedId);
  const mensajes = convDetail?.mensajes || [];
  const otherParticipant = selected?.participanteIds?.find((p: { _id: string }) => p._id !== convDetail?.conversacion?.creadoPor);

  React.useEffect(() => {
    if (selectedId) markReadMutation.mutate(selectedId);
  }, [selectedId]);

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-6">
        <NavBackButton to="/comunicacion" label="Comunicación" />
        <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2 font-['Poppins'] mt-4">Bandeja de Entrada</h1>
        <p className="text-white/60 text-sm sm:text-base">Comunicaciones con el colegio y profesores</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 sm:gap-6 min-h-[70vh]">
        <div className="lg:col-span-1">
          <Card className={`${CARD_STYLE} p-0 overflow-hidden h-full flex flex-col`}>
            <div className="p-4 border-b border-white/10">
              <Button
                className="w-full bg-gradient-to-r from-[#002366] to-[#1e3cff] hover:opacity-90 min-h-[44px]"
                onClick={() => setLocation('/comunicacion/redactar')}
              >
                <Send className="w-4 h-4 mr-2" />
                Nuevo Mensaje
              </Button>
            </div>
            <div className="p-4 border-b border-white/10">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/50" />
                <Input placeholder="Buscar..." className="pl-10 bg-white/10 border-white/10 text-white placeholder:text-white/50 min-h-[44px]" />
              </div>
            </div>
            <div className="flex-grow overflow-y-auto">
              {conversations.map((c) => (
                <div
                  key={c._id}
                  onClick={() => setSelectedId(c._id)}
                  className={`p-3 border-b border-white/10 cursor-pointer transition-colors min-h-[52px] flex flex-col justify-center ${
                    selectedId === c._id ? 'bg-white/10 border-l-4 border-[#1e3cff]' : 'hover:bg-white/5'
                  }`}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedId(c._id); } }}
                >
                  <p className="text-white font-medium truncate">{c.asunto}</p>
                  <p className="text-white/50 text-xs truncate">
                    {c.ultimoMensaje?.texto || 'Sin mensajes'}
                  </p>
                  <p className="text-white/40 text-xs mt-1">
                    {new Date(c.createdAt).toLocaleDateString('es-CO')}
                  </p>
                </div>
              ))}
              {conversations.length === 0 && (
                <p className="p-4 text-white/50 text-center">No hay conversaciones.</p>
              )}
            </div>
          </Card>
        </div>

        <div className="lg:col-span-3">
          <Card className={`${CARD_STYLE} p-0 overflow-hidden h-full flex flex-col`}>
            {selected ? (
              <>
                <CardHeader className="p-6 border-b border-white/10">
                  <CardTitle className="text-xl text-white">{selected.asunto}</CardTitle>
                  <p className="text-white/60 text-sm mt-1">
                    Con: {otherParticipant ? (otherParticipant as { nombre?: string }).nombre : '—'}
                  </p>
                </CardHeader>
                <CardContent className="p-6 flex-grow overflow-y-auto space-y-4">
                  {mensajes.map((m) => {
                    const isMine = (m.remitenteId as { _id?: string })?._id === user?.id;
                    return (
                    <div
                      key={m._id}
                      className={`p-3 rounded-lg ${isMine ? 'bg-[#1e3cff]/20 ml-8 mr-0' : 'bg-white/5 ml-0 mr-8'}`}
                    >
                      <p className="text-white/80 text-sm">{(m.remitenteId as { nombre?: string })?.nombre}</p>
                      <p className="text-white mt-1">{m.texto}</p>
                      <p className="text-white/50 text-xs mt-1">{new Date(m.fecha).toLocaleString('es-CO')}</p>
                    </div>
                  );})}
                </CardContent>
                <div className="p-4 border-t border-white/10 flex gap-2">
                  <Textarea
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder="Escribe tu respuesta..."
                    className="flex-grow bg-white/10 border-white/10 text-white placeholder:text-white/50 min-h-[80px]"
                  />
                  <Button
                    onClick={() => sendMutation.mutate(replyText)}
                    disabled={!replyText.trim() || sendMutation.isPending}
                    className="bg-gradient-to-r from-[#002366] to-[#1e3cff] self-end"
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-white/50 py-16">
                <Inbox className="w-12 h-12 text-[#1e3cff] mb-4" />
                <p className="text-lg">Selecciona una conversación para leer y responder.</p>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
