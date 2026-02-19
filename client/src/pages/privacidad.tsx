import React from 'react';
import { useLocation } from 'wouter';
import { Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const CARD_STYLE = 'bg-white/5 border-white/10 backdrop-blur-md';

export default function PrivacidadPage() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen p-4 sm:p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-2xl sm:text-3xl font-bold text-white font-['Poppins'] flex items-center gap-2">
            <Shield className="w-8 h-8 text-[#00c8ff]" />
            Política de Privacidad
          </h1>
          <Button
            variant="outline"
            className="border-white/20 text-white hover:bg-white/10"
            onClick={() => setLocation('/consent')}
          >
            Volver
          </Button>
        </div>
        <Card className={CARD_STYLE}>
          <CardHeader>
            <CardTitle className="text-white">Política de privacidad de AutoClose AI</CardTitle>
          </CardHeader>
          <CardContent className="text-white/80 space-y-4 prose prose-invert max-w-none">
            <p className="text-sm">
              Última actualización: {new Date().toLocaleDateString('es')}.
            </p>
            <section>
              <h3 className="text-white font-medium mt-4">1. Datos que recogemos</h3>
              <p>
                Recogemos los datos necesarios para el funcionamiento del servicio educativo:
                nombre, correo, rol, curso (cuando aplica) y datos de actividad en la plataforma.
              </p>
            </section>
            <section>
              <h3 className="text-white font-medium mt-4">2. Uso de los datos</h3>
              <p>
                Los datos se utilizan exclusivamente para la gestión académica, comunicaciones
                del colegio y el correcto funcionamiento de la plataforma.
              </p>
            </section>
            <section>
              <h3 className="text-white font-medium mt-4">3. Protección</h3>
              <p>
                Aplicamos medidas técnicas y organizativas para proteger sus datos personales
                frente a accesos no autorizados o pérdida.
              </p>
            </section>
            <section>
              <h3 className="text-white font-medium mt-4">4. Sus derechos</h3>
              <p>
                Puede solicitar acceso, rectificación o supresión de sus datos personales
                contactando al administrador del colegio.
              </p>
            </section>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
