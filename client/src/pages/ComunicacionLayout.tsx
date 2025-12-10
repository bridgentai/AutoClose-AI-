// client/src/pages/ComunicacionLayout.tsx
import React from 'react';
import { Link } from "wouter";

const ComunicacionLayout: React.FC = () => {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Módulo 3: Comunicación</h1>

      <div className="grid gap-4 md:grid-cols-3">

        <Link href="/comunicacion/bandeja">
          <div className="p-4 border rounded-md hover-elevate cursor-pointer">
            <span className="font-medium">Bandeja de Entrada</span>
          </div>
        </Link>

        <Link href="/comunicacion/redactar">
          <div className="p-4 border rounded-md hover-elevate cursor-pointer">
            <span className="font-medium">Redactar Mensaje</span>
          </div>
        </Link>

        <Link href="/comunicacion/enviados">
          <div className="p-4 border rounded-md hover-elevate cursor-pointer">
            <span className="font-medium">Mensajes Enviados</span>
          </div>
        </Link>
      </div>
    </div>
  );
};

export default ComunicacionLayout;