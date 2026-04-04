import { Link } from "wouter";
import { UserCircle, Users, FileText, GraduationCap, AlertTriangle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { NavBackButton } from "@/components/nav-back-button";
import { DirectivoGuard, useDirectivoSection } from "@/components/directivo-guard";
import { resolveSectionTheme, useSectionThemeApplier } from "@/hooks/useSectionTheme";

const gestionItems = [
  {
    title: "Usuarios",
    path: "/directivo/academia/usuarios",
    icon: UserCircle,
    variant: "default" as const,
  },
  {
    title: "Asignación de Horarios",
    path: "/asignacion-horarios",
    icon: Users,
    variant: "default" as const,
  },
  {
    title: "Amonestaciones",
    path: "/directivo/gestion/amonestaciones",
    icon: AlertTriangle,
    variant: "amenaza" as const,
  },
];

const analiticaItems = [
  {
    title: "Reportes Académicos",
    path: "/directivo/academia/reportes",
    icon: FileText,
  },
  {
    title: "Análisis de notas",
    path: "/directivo/academia/analitica-notas",
    icon: GraduationCap,
  },
];

function DirectivoGestionHubContent() {
  const mySection = useDirectivoSection();
  const theme = resolveSectionTheme(mySection?.nombre);
  useSectionThemeApplier(theme);

  return (
    <div className="p-6" data-testid="directivo-gestion-hub">
      <NavBackButton to="/dashboard" label="Dashboard" />
      <h1 className="text-2xl font-bold mb-6 text-white font-['Poppins']">
        Gestión: {mySection?.nombre ?? "Mi Sección"}
      </h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {gestionItems.map((item) => (
          <Link key={item.path} href={item.path}>
            <Card
              className={
                item.variant === "amenaza"
                  ? "hover-elevate cursor-pointer bg-red-950/25 border-red-500/25 backdrop-blur-md"
                  : "hover-elevate cursor-pointer bg-white/5 border-white/10 backdrop-blur-md"
              }
            >
              <CardContent className="flex flex-col items-center justify-center p-8">
                <item.icon
                  className="w-12 h-12 mb-4"
                  style={{
                    color:
                      item.variant === "amenaza"
                        ? "rgba(248, 113, 113, 0.95)"
                        : "var(--section-primary, var(--primary-blue))",
                  }}
                />
                <span className="text-lg font-medium text-white">{item.title}</span>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}

function DirectivoAnaliticaHubContent() {
  const mySection = useDirectivoSection();
  const theme = resolveSectionTheme(mySection?.nombre);
  useSectionThemeApplier(theme);

  return (
    <div className="p-6" data-testid="directivo-analitica-hub">
      <NavBackButton to="/dashboard" label="Dashboard" />
      <h1 className="text-2xl font-bold mb-6 text-white font-['Poppins']">
        Analítica: {mySection?.nombre ?? "Mi Sección"}
      </h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {analiticaItems.map((item) => (
          <Link key={item.path} href={item.path}>
            <Card className="hover-elevate cursor-pointer bg-white/5 border-white/10 backdrop-blur-md">
              <CardContent className="flex flex-col items-center justify-center p-8">
                <item.icon
                  className="w-12 h-12 mb-4"
                  style={{ color: "var(--section-primary, var(--primary-blue))" }}
                />
                <span className="text-lg font-medium text-white">{item.title}</span>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}

export function DirectivoGestionHub() {
  return (
    <DirectivoGuard strictDirectivoOnly>
      <DirectivoGestionHubContent />
    </DirectivoGuard>
  );
}

export function DirectivoAnaliticaHub() {
  return (
    <DirectivoGuard strictDirectivoOnly>
      <DirectivoAnaliticaHubContent />
    </DirectivoGuard>
  );
}
