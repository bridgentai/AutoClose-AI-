import { Link } from "wouter";
import { BookOpen, Database, FileText, Settings, BarChart3, GraduationCap } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/lib/authContext";
import { useLocation } from "wouter";
import { useEffect } from "react";

const navigationItems = [
  {
    title: "Cursos",
    path: "/administrador-general/academia/cursos",
    icon: BookOpen,
  },
  {
    title: "Materias",
    path: "/administrador-general/academia/materias",
    icon: Database,
  },
  {
    title: "Notas",
    path: "/administrador-general/academia/notas",
    icon: FileText,
  },
  {
    title: "Configuraciones",
    path: "/administrador-general/academia/configuraciones",
    icon: Settings,
  },
  {
    title: "Reportes",
    path: "/administrador-general/academia/reportes",
    icon: BarChart3,
  },
  {
    title: "Materiales",
    path: "/materials",
    icon: GraduationCap,
  },
];

export default function AdministradorGeneralAcademiaLayout() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (user && user.rol !== "administrador-general") {
      setLocation("/dashboard");
    }
  }, [user, setLocation]);

  if (!user || user.rol !== "administrador-general") {
    return null;
  }

  return (
    <div className="p-6" data-testid="administrador-general-academia-layout">
      <h1 className="text-2xl font-bold mb-6 text-white font-['Poppins']">
        Academia: Acceso Total
      </h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {navigationItems.map((item) => (
          <Link key={item.path} href={item.path}>
            <Card className="hover-elevate cursor-pointer bg-white/5 border-white/10 backdrop-blur-md">
              <CardContent className="flex flex-col items-center justify-center p-8">
                <item.icon className="w-12 h-12 mb-4 text-[#9f25b8]" />
                <span className="text-lg font-medium text-white">{item.title}</span>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}

