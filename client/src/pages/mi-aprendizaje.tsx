import { Link } from "wouter";
import { BookOpen, FileText, Globe, Calendar } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/lib/authContext";
import { useLocation } from "wouter";
import { useEffect } from "react";

const navigationItems = [
  {
    title: "Materias",
    path: "/mi-aprendizaje/cursos",
    icon: BookOpen,
  },
  {
    title: "Materiales",
    path: "/mi-aprendizaje/materiales",
    icon: FileText,
  },
  {
    title: "Plataformas",
    path: "/mi-aprendizaje/plataformas",
    icon: Globe,
  },
  {
    title: "Calendario",
    path: "/mi-aprendizaje/calendario",
    icon: Calendar,
  },
];

export default function MiAprendizajeLayout() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (user && user.rol !== "estudiante") {
      setLocation("/dashboard");
    }
  }, [user, setLocation]);

  if (!user || user.rol !== "estudiante") {
    return null;
  }

  return (
    <div className="p-6" data-testid="mi-aprendizaje-layout">
      <h1 className="text-2xl font-bold mb-6" data-testid="text-title">
        Mi Aprendizaje: Inicio
      </h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {navigationItems.map((item) => (
          <Link key={item.path} href={item.path}>
            <Card className="hover-elevate cursor-pointer" data-testid={`link-${item.title.toLowerCase()}`}>
              <CardContent className="flex flex-col items-center justify-center p-8">
                <item.icon className="w-12 h-12 mb-4 text-primary" />
                <span className="text-lg font-medium">{item.title}</span>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
