import React, { useState } from 'react';
import { Send, User } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useLocation } from 'wouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { NavBackButton } from '@/components/nav-back-button';

const CARD_STYLE = 'bg-white/5 border-white/10 backdrop-blur-md';

interface ParentUser {
  _id: string;
  nombre: string;
  email?: string;
  correo?: string;
}

export default function ProfesorRedactarMensaje() {
  const [location, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const fromComunicacion = location.startsWith('/comunicacion');
  const [destinatarioId, setDestinatarioId] = useState('');
  const [asunto, setAsunto] = useState('');
  const [mensaje, setMensaje] = useState('');

  const { data: padres = [] } = useQuery({
    queryKey: ['/api/users/by-role', 'padre'],
    queryFn: () => apiRequest<ParentUser[]>('GET', '/api/users/by-role?rol=padre'),
  });

  const sendMutation = useMutation({
    mutationFn: (payload: { destinatarioId: string; asunto: string; texto: string }) =>
      apiRequest('POST', '/api/messages/conversations', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/messages/conversations'] });
      setDestinatarioId('');
      setAsunto('');
      setMensaje('');
      setLocation(fromComunicacion ? '/comunicacion' : '/profesor/comunicacion/bandeja');
    },
  });

  const handleEnviar = () => {
    if (!destinatarioId || !asunto.trim() || !mensaje.trim()) {
      alert('Completa destinatario, asunto y mensaje');
      return;
    }
    sendMutation.mutate({ destinatarioId, asunto: asunto.trim(), texto: mensaje.trim() });
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <NavBackButton to={fromComunicacion ? '/comunicacion' : '/profesor/comunicacion'} label="Comunicación" />
        <h1 className="text-3xl font-bold text-white mb-2 font-['Poppins'] mt-4 flex items-center gap-2">
          <Send className="w-8 h-8 text-[#00c8ff]" />
          Redactar Mensaje
        </h1>
        <p className="text-white/60">Envía un mensaje a un padre o acudiente</p>
      </div>

      <Card className={CARD_STYLE}>
        <CardHeader>
          <CardTitle className="text-white font-['Poppins']">Nuevo Mensaje</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label className="text-white flex items-center gap-2">
              <User className="w-4 h-4 text-[#00c8ff]" />
              Destinatario (padre/acudiente)
            </Label>
            <select
              value={destinatarioId}
              onChange={(e) => setDestinatarioId(e.target.value)}
              className="w-full rounded-lg bg-white/10 border border-white/10 text-white px-3 py-2 focus:ring-2 focus:ring-[#00c8ff]"
            >
              <option value="">Seleccionar padre o acudiente</option>
              {padres.map((p) => (
                <option key={p._id} value={p._id}>{p.nombre} — {p.email || p.correo || ''}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label className="text-white">Asunto</Label>
            <Input
              value={asunto}
              onChange={(e) => setAsunto(e.target.value)}
              placeholder="Asunto del mensaje"
              className="bg-white/10 border-white/10 text-white placeholder:text-white/50"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-white">Mensaje</Label>
            <Textarea
              value={mensaje}
              onChange={(e) => setMensaje(e.target.value)}
              placeholder="Escribe tu mensaje aquí..."
              rows={10}
              className="bg-white/10 border-white/10 text-white placeholder:text-white/50"
            />
          </div>

          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => setLocation(fromComunicacion ? '/comunicacion' : '/profesor/comunicacion')}
              className="border-white/10 text-white hover:bg-white/10"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleEnviar}
              disabled={sendMutation.isPending || !destinatarioId || !asunto.trim() || !mensaje.trim()}
              className="bg-gradient-to-r from-[#002366] to-[#1e3cff] hover:opacity-90"
            >
              <Send className="w-4 h-4 mr-2" />
              {sendMutation.isPending ? 'Enviando...' : 'Enviar Mensaje'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
