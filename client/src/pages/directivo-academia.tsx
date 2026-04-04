import { Link } from "wouter";
import { UserCircle, Users, BarChart3, FileText } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { NavBackButton } from "@/components/nav-back-button";
import { DirectivoGuard } from "@/components/directivo-guard";

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
  // Pendiente de activar cuando exista la página:
  // {
  //   title: "Analítica Académica",
  //   path: "/directivo/academia/analitica",
  //   icon: BarChart3,
  // },
];

export default function DirectivoAcademiaLayout() {
  return (
    <DirectivoGuard strictDirectivoOnly>
    <div className="p-6" data-testid="directivo-academia-layout">
      <NavBackButton to="/dashboard" label="Dashboard" />
      <h1 className="text-2xl font-bold mb-6 text-white font-['Poppins']">
        Academia: Gestión Académica Global
      </h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {navigationItems.map((item) => (
          <Link key={item.path} href={item.path}>
            <Card className="hover-elevate cursor-pointer bg-white/5 border-white/10 backdrop-blur-md">
              <CardContent className="flex flex-col items-center justify-center p-8">
                <item.icon className="w-12 h-12 mb-4 text-[#1e3cff]" />
                <span className="text-lg font-medium text-white">{item.title}</span>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
    </DirectivoGuard>
  );
}
