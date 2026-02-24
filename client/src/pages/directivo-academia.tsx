import { Link } from "wouter";
import { BookOpen, Users, BarChart3, FileText, GraduationCap, Settings } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/lib/authContext";
import { useLocation } from "wouter";
import { useEffect } from "react";

const navigationItems = [
  {
    title: "Cursos y estudiantes",
    path: "/directivo/cursos",
    icon: BookOpen,
  },
  {
    title: "Asignación de Profesores",
    path: "/directivo",
    icon: Users,
  },
  {
    title: "Análisis de Rendimiento",
    path: "/directivo/academia/rendimiento",
    icon: BarChart3,
  },
  {
    title: "Reportes Académicos",
    path: "/directivo/academia/reportes",
    icon: FileText,
  },
  {
    title: "Configuración Académica",
    path: "/directivo/academia/configuracion",
    icon: Settings,
  },
  {
    title: "Materiales Institucionales",
    path: "/materials",
    icon: GraduationCap,
  },
];

export default function DirectivoAcademiaLayout() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (user && user.rol !== "directivo") {
      setLocation("/dashboard");
    }
  }, [user, setLocation]);

  if (!user || user.rol !== "directivo") {
    return null;
  }

  return (
    <div className="p-6" data-testid="directivo-academia-layout">
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
  );
}
