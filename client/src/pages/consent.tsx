import React, { useState } from 'react';
import { useLocation } from 'wouter';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Shield, FileText } from 'lucide-react';

const CARD_STYLE = 'bg-white/5 border-white/10 backdrop-blur-md';

export default function ConsentPage() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [terminos, setTerminos] = useState(false);
  const [privacidad, setPrivacidad] = useState(false);

  const consentMutation = useMutation({
    mutationFn: () =>
      apiRequest('POST', '/api/users/me/consent', {
        consentimientoTerminos: true,
        consentimientoPrivacidad: true,
      }),
    onSuccess: () => {
      // Actualizar caché antes de navegar para que AuthGuard no redirija de vuelta a /consent
      queryClient.setQueryData(['user-consent'], {
        consentimientoTerminos: true,
        consentimientoPrivacidad: true,
      });
      setLocation('/dashboard');
    },
  });

  const handleAccept = () => {
    if (!terminos || !privacidad) return;
    consentMutation.mutate();
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-6">
      <Card className={`${CARD_STYLE} w-full max-w-lg`}>
        <CardHeader>
          <CardTitle className="text-white font-['Poppins']">
            Aceptación de términos y privacidad
          </CardTitle>
          <CardDescription className="text-white/60">
            Para continuar usando la plataforma debe aceptar los términos y condiciones y la política de privacidad.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-start gap-3">
            <Checkbox
              id="terminos"
              checked={terminos}
              onCheckedChange={(v) => setTerminos(!!v)}
              className="border-white/30 data-[state=checked]:bg-[#1e3cff] data-[state=checked]:border-[#1e3cff]"
            />
            <div className="flex-1">
              <Label htmlFor="terminos" className="text-white cursor-pointer flex items-center gap-2">
                He leído y acepto los{' '}
                <a
                  href="/terminos"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#00c8ff] hover:underline inline-flex items-center gap-1"
                  onClick={(e) => e.stopPropagation()}
                >
                  <FileText className="w-4 h-4" /> Términos y Condiciones
                </a>
              </Label>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Checkbox
              id="privacidad"
              checked={privacidad}
              onCheckedChange={(v) => setPrivacidad(!!v)}
              className="border-white/30 data-[state=checked]:bg-[#1e3cff] data-[state=checked]:border-[#1e3cff]"
            />
            <div className="flex-1">
              <Label htmlFor="privacidad" className="text-white cursor-pointer flex items-center gap-2">
                He leído y acepto la{' '}
                <a
                  href="/privacidad"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#00c8ff] hover:underline inline-flex items-center gap-1"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Shield className="w-4 h-4" /> Política de Privacidad
                </a>
              </Label>
            </div>
          </div>
          <Button
            className="w-full bg-gradient-to-r from-[#002366] to-[#1e3cff] hover:opacity-90 text-white min-h-[44px]"
            disabled={!terminos || !privacidad || consentMutation.isPending}
            onClick={handleAccept}
          >
            {consentMutation.isPending ? 'Guardando…' : 'Aceptar y continuar'}
          </Button>
          {consentMutation.isError && (
            <p className="text-red-400 text-sm">
              {(consentMutation.error as Error)?.message || 'Error al registrar. Intente de nuevo.'}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
