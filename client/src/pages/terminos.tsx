import React from 'react';
import { useLocation } from 'wouter';
import { FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const CARD_STYLE = 'bg-white/5 border-white/10 backdrop-blur-md';

export default function TerminosPage() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen p-4 sm:p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-2xl sm:text-3xl font-bold text-white font-['Poppins'] flex items-center gap-2">
            <FileText className="w-8 h-8 text-[#00c8ff]" />
            Términos y Condiciones
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
            <CardTitle className="text-white">Términos de uso de MindOS</CardTitle>
          </CardHeader>
          <CardContent className="text-white/80 space-y-4 prose prose-invert max-w-none">
            <p className="text-sm">
              Última actualización: {new Date().toLocaleDateString('es')}.
            </p>
            <section>
              <h3 className="text-white font-medium mt-4">1. Aceptación</h3>
              <p>
                Al utilizar la plataforma MindOS usted acepta estos términos y condiciones.
                Si no está de acuerdo, no debe usar el servicio.
              </p>
            </section>
            <section>
              <h3 className="text-white font-medium mt-4">2. Uso del servicio</h3>
              <p>
                La plataforma está destinada al uso educativo en el ámbito del colegio.
                Debe utilizar la plataforma de forma responsable y respetando las normas del centro.
              </p>
            </section>
            <section>
              <h3 className="text-white font-medium mt-4">3. Cuenta y seguridad</h3>
              <p>
                Es responsable de mantener la confidencialidad de su contraseña y de todas las
                actividades realizadas con su cuenta.
              </p>
            </section>
            <section>
              <h3 className="text-white font-medium mt-4">4. Contacto</h3>
              <p>
                Para consultas sobre estos términos, contacte al administrador del colegio.
              </p>
            </section>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
