import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Heart } from 'lucide-react';

const FichaMedica: React.FC = () => {
  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-white mb-2 font-['Poppins']">
          Ficha Médica
        </h1>
        <p className="text-white/60">Información médica y de salud</p>
      </div>

      <Card className="backdrop-blur-md bg-white/5 border-white/10">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Heart className="w-5 h-5 text-[#9f25b8]" />
            En Construcción
          </CardTitle>
          <CardDescription className="text-white/60">
            Esta sección está en desarrollo. Pronto podrás gestionar tu información médica aquí.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-white/60">
            Aquí se mostrará la información médica sensible del estudiante.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default FichaMedica;