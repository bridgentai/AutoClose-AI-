import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar } from 'lucide-react';

const CalendarioEventos: React.FC = () => {
  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-white mb-2 font-['Poppins']">
          Calendario de Eventos
        </h1>
        <p className="text-white/60">Eventos institucionales y fechas importantes</p>
      </div>

      <Card className="backdrop-blur-md bg-white/5 border-white/10">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Calendar className="w-5 h-5 text-[#9f25b8]" />
            En Construcción
          </CardTitle>
          <CardDescription className="text-white/60">
            Esta sección está en desarrollo. Pronto podrás ver el calendario institucional aquí.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-white/60">
            Aquí se mostrará el calendario institucional, incluyendo eventos, días festivos y fechas importantes para todos los roles.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default CalendarioEventos;