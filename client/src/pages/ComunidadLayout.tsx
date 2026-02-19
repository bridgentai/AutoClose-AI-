// client/src/pages/ComunidadLayout.tsx
import React from 'react';
import { Link } from "wouter";
import { Calendar, Bell } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

const navigationItems = [
  {
    title: "Calendario de Eventos",
    path: "/comunidad/calendario",
    icon: Calendar,
  },
  {
    title: "Avisos y Noticias",
    path: "/comunidad/noticias",
    icon: Bell,
  },
];

const ComunidadLayout: React.FC = () => {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Módulo 2: Comunidad</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {navigationItems.map((item) => (
          <Link key={item.path} href={item.path}>
            <Card className="hover-elevate cursor-pointer">
              <CardContent className="flex flex-col items-center justify-center p-8">
                <item.icon className="w-12 h-12 mb-4 text-[#1e3cff]" />
                <span className="text-lg font-medium">{item.title}</span>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
};

export default ComunidadLayout;