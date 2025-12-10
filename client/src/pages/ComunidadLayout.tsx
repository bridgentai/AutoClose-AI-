// client/src/pages/ComunidadLayout.tsx
import React from 'react';
import { Link } from "wouter";

const ComunidadLayout: React.FC = () => {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Módulo 2: Comunidad</h1>

      <div className="grid gap-4 md:grid-cols-2">

        <Link href="/comunidad/calendario">
          <div className="p-4 border rounded-md hover-elevate cursor-pointer">
            <span className="font-medium">Calendario de Eventos</span>
          </div>
        </Link>

        <Link href="/comunidad/noticias">
          <div className="p-4 border rounded-md hover-elevate cursor-pointer">
            <span className="font-medium">Avisos y Noticias</span>
          </div>
        </Link>

      </div>
    </div>
  );
};

export default ComunidadLayout;