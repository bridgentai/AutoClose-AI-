import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Clock } from 'lucide-react';

export default function RegisterStandby() {
  const [, setLocation] = useLocation();

  return (
    <div 
      className="min-h-screen flex items-center justify-center p-6"
      style={{
        background: 'radial-gradient(circle at 20% 20%, #25003d, #0b0013 80%)'
      }}
    >
      <div className="w-full max-w-md">
        <div className="backdrop-blur-xl bg-black/40 border border-white/10 rounded-3xl p-10 shadow-2xl text-center"
             style={{ boxShadow: '0 0 35px rgba(159, 37, 184, 0.25)' }}>
          
          <div className="w-20 h-20 bg-gradient-to-br from-[#9f25b8] to-[#6a0dad] rounded-full flex items-center justify-center mx-auto mb-6">
            <Clock className="w-10 h-10 text-white" />
          </div>

          <h2 className="text-3xl font-bold mb-4 bg-gradient-to-r from-[#9f25b8] to-[#c66bff] bg-clip-text text-transparent font-['Poppins']">
            En Stand By
          </h2>
          
          <p className="text-white/70 mb-8">
            La página de registro está temporalmente deshabilitada para facilitar el desarrollo.
            <br /><br />
            Por favor, utiliza la opción de <strong className="text-white">Roles</strong> en la página principal para acceder directamente.
          </p>

          <Button
            onClick={() => setLocation('/')}
            className="w-full bg-gradient-to-r from-[#9f25b8] to-[#c66bff] hover:opacity-90 text-white font-semibold"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver a la Página Principal
          </Button>
        </div>
      </div>
    </div>
  );
}

