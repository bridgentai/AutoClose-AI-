import { Link } from "wouter";
import { UserCircle, Users, BarChart3, FileText } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { NavBackButton } from "@/components/nav-back-button";
import { DirectivoGuard, useDirectivoSection } from "@/components/directivo-guard";
import { resolveSectionTheme, useSectionThemeApplier } from "@/hooks/useSectionTheme";

const navigationItems = [
  {
    title: "Usuarios",
    path: "/directivo/academia/usuarios",
    icon: UserCircle,
  },
  {
    title: "Asignación de Horarios",
    path: "/asignacion-horarios",
    icon: Users,
  },
  {
    title: "Reportes Académicos",
    path: "/directivo/academia/reportes",
    icon: FileText,
  },
  {
    title: "Analítica de la Sección",
    path: "/directivo/academia/analitica",
    icon: BarChart3,
  },
];

function AcademiaContent() {
  const mySection = useDirectivoSection();
  const theme = resolveSectionTheme(mySection?.nombre);
  useSectionThemeApplier(theme);

  return (
    <div className="p-6" data-testid="directivo-academia-layout">
      <NavBackButton to="/dashboard" label="Dashboard" />
      <h1 className="text-2xl font-bold mb-6 text-white font-['Poppins']">
        Academia: {mySection?.nombre ?? 'Mi Sección'}
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

export default function DirectivoAcademiaLayout() {
  return (
    <DirectivoGuard strictDirectivoOnly>
      <AcademiaContent />
    </DirectivoGuard>
  );
}
