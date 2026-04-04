import { Link } from "wouter";
import { Calendar, FileText } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { NavBackButton } from "@/components/nav-back-button";
import { DirectivoGuard, useDirectivoSection } from "@/components/directivo-guard";

const navigationItems = [
  {
    title: "Boletines por Curso",
    path: "/directivo/reportes",
    icon: FileText,
  },
  {
    title: "Calendario",
    path: "/comunidad/calendario",
    icon: Calendar,
  },
];

function ComunidadContent() {
  const mySection = useDirectivoSection();
  return (
    <div className="p-6" data-testid="directivo-comunidad-layout">
      <NavBackButton to="/dashboard" label="Dashboard" />
      <h1 className="text-2xl font-bold mb-6 text-white font-['Poppins']">
        Comunidad: {mySection?.nombre ?? 'Gestión Institucional'}
      </h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {navigationItems.map((item) => (
          <Link key={item.path} href={item.path}>
            <Card className="hover-elevate cursor-pointer bg-white/5 border-white/10 backdrop-blur-md">
              <CardContent className="flex flex-col items-center justify-center p-8">
                <item.icon className="w-12 h-12 mb-4" style={{ color: 'var(--section-primary, var(--primary-blue))' }} />
                <span className="text-lg font-medium text-white">{item.title}</span>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}

export default function DirectivoComunidadLayout() {
  return (
    <DirectivoGuard strictDirectivoOnly>
      <ComunidadContent />
    </DirectivoGuard>
  );
}
