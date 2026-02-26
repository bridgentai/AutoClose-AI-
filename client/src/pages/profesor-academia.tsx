import { Link } from "wouter";
import { BookOpen, Globe, ClipboardList, Percent } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/lib/authContext";
import { useLocation } from "wouter";
import { useEffect } from "react";
import { NavBackButton } from "@/components/nav-back-button";

const navigationItems = [
  { title: "Cursos", path: "/profesor/academia/cursos", icon: BookOpen },
  { title: "Calificación", path: "/profesor/academia/calificacion", icon: Percent },
  { title: "Asistencia", path: "/profesor/academia/asistencia", icon: ClipboardList },
  { title: "Plataformas", path: "/profesor/academia/plataformas", icon: Globe },
];

export default function ProfesorAcademiaLayout() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (user && user.rol !== "profesor") {
      setLocation("/dashboard");
    }
  }, [user, setLocation]);

  if (!user || user.rol !== "profesor") {
    return null;
  }

  return (
    <div className="p-6" data-testid="profesor-academia-layout">
      <NavBackButton to="/dashboard" label="Dashboard" />
      <h1 className="text-2xl font-bold mb-6 mt-4" data-testid="text-title">
        Academia: Inicio
      </h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {navigationItems.map((item) => (
          <Link key={item.path} href={item.path}>
            <Card className="hover-elevate cursor-pointer" data-testid={`link-${item.title.toLowerCase().replace(/\s+/g, '-')}`}>
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
}

