import { Link } from "wouter";
import { BookOpen, Users, FileText, CheckSquare, ClipboardList, Globe } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/lib/authContext";
import { useLocation } from "wouter";
import { useEffect } from "react";

const navigationItems = [
  {
    title: "Cursos",
    path: "/profesor/academia/cursos",
    icon: BookOpen,
  },
  {
    title: "Materiales",
    path: "/profesor/academia/materiales",
    icon: FileText,
  },
  {
    title: "Asignación de Grupos",
    path: "/profesor/academia/grupos",
    icon: Users,
  },
  {
    title: "Tareas",
    path: "/profesor/academia/tareas",
    icon: CheckSquare,
  },
  {
    title: "Notas",
    path: "/profesor/academia/notas",
    icon: ClipboardList,
  },
  {
    title: "Plataformas",
    path: "/profesor/academia/plataformas",
    icon: Globe,
  },
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
      <h1 className="text-2xl font-bold mb-6" data-testid="text-title">
        Academia: Inicio
      </h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {navigationItems.map((item) => (
          <Link key={item.path} href={item.path}>
            <Card className="hover-elevate cursor-pointer" data-testid={`link-${item.title.toLowerCase().replace(/\s+/g, '-')}`}>
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

