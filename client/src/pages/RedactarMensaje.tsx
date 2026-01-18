import React, { useState } from 'react';
import { Send, User, Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useLocation } from 'wouter';
import { NavBackButton } from '@/components/nav-back-button';

const RedactarMensaje: React.FC = () => {
  const [, setLocation] = useLocation();
  const [destinatario, setDestinatario] = useState('');
  const [tipoDestinatario, setTipoDestinatario] = useState<'profesor' | 'administrativo'>('profesor');
  const [asunto, setAsunto] = useState('');
  const [mensaje, setMensaje] = useState('');

  const handleEnviar = () => {
    if (!destinatario || !asunto || !mensaje) {
      alert('Por favor completa todos los campos');
      return;
    }
    alert(`Mensaje enviado a ${destinatario}`);
    // Reset form
    setDestinatario('');
    setAsunto('');
    setMensaje('');
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <NavBackButton to="/comunicacion" label="Comunicación" />
        <h1 className="text-3xl font-bold text-white mb-2 font-['Poppins'] mt-4">Redactar Mensaje</h1>
        <p className="text-white/60">Envía mensajes a profesores o personal administrativo</p>
      </div>

      <Card className="bg-white/5 border-white/10 backdrop-blur-md">
        <CardHeader>
          <CardTitle className="text-white font-['Poppins']">Nuevo Mensaje</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="tipo" className="text-white">Tipo de Destinatario</Label>
            <Select value={tipoDestinatario} onValueChange={(value: 'profesor' | 'administrativo') => setTipoDestinatario(value)}>
              <SelectTrigger className="bg-white/10 border-white/10 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="profesor">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4" />
                    Profesor
                  </div>
                </SelectItem>
                <SelectItem value="administrativo">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    Personal Administrativo
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="destinatario" className="text-white">
              {tipoDestinatario === 'profesor' ? 'Profesor' : 'Personal Administrativo'}
            </Label>
            <Input
              id="destinatario"
              value={destinatario}
              onChange={(e) => setDestinatario(e.target.value)}
              placeholder={`Selecciona ${tipoDestinatario === 'profesor' ? 'un profesor' : 'personal administrativo'}`}
              className="bg-white/10 border-white/10 text-white placeholder:text-white/50"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="asunto" className="text-white">Asunto</Label>
            <Input
              id="asunto"
              value={asunto}
              onChange={(e) => setAsunto(e.target.value)}
              placeholder="Asunto del mensaje"
              className="bg-white/10 border-white/10 text-white placeholder:text-white/50"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="mensaje" className="text-white">Mensaje</Label>
            <Textarea
              id="mensaje"
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
              onClick={() => setLocation('/comunicacion')}
              className="border-white/10 text-white hover:bg-white/10"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleEnviar}
              className="bg-gradient-to-r from-[#9f25b8] to-[#6a0dad] hover:opacity-90"
            >
              <Send className="w-4 h-4 mr-2" />
              Enviar Mensaje
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default RedactarMensaje;