import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Bell, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLocation } from 'wouter';

const AvisosNoticias: React.FC = () => {
  const [, setLocation] = useLocation();
  
  return (
    <div className="p-6">
      <NavBackButton to="/comunidad" label="Comunidad" />
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-white mb-2 font-['Poppins']">
          Avisos y Noticias
        </h1>
        <p className="text-white/60">Mantente informado sobre los comunicados institucionales</p>
      </div>

      <Card className="backdrop-blur-md bg-white/5 border-white/10">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Bell className="w-5 h-5 text-[#1e3cff]" />
            En Construcción
          </CardTitle>
          <CardDescription className="text-white/60">
            Esta sección está en desarrollo. Pronto podrás ver todos los avisos y noticias aquí.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-white/60">
            Esta sección mostrará los anuncios, comunicados y noticias generales que afectan a la comunidad educativa.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default AvisosNoticias;