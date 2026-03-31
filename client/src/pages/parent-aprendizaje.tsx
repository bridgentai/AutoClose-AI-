import { Link } from "wouter";
import { BookOpen, Calendar, GraduationCap, CheckSquare, Clock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/lib/authContext";
import { useLocation } from "wouter";
import { useEffect } from "react";
import { NavBackButton } from "@/components/nav-back-button";

const navigationItems = [
  { title: "Materias (cursos)", path: "/parent/cursos", icon: BookOpen },
  { title: "Notas", path: "/parent/notas", icon: GraduationCap },
  { title: "Asignaciones", path: "/parent/tareas", icon: CheckSquare },
  { title: "Horario", path: "/parent/horario", icon: Clock },
  { title: "Calendario", path: "/parent/calendario", icon: Calendar },
];

export default function ParentAprendizajePage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (user && user.rol !== "padre") {
      setLocation("/dashboard");
    }
  }, [user, setLocation]);

  if (!user || user.rol !== "padre") {
    return null;
  }

  return (
    <div data-testid="parent-aprendizaje-layout">
      <NavBackButton to="/dashboard" label="Dashboard" />
      <h1 className="text-2xl font-bold mb-2 font-['Poppins'] text-white" data-testid="text-title">
        Aprendizaje del hijo/a
      </h1>
      <p className="text-white/60 text-sm mb-6 max-w-xl">
        Misma información que ve tu hijo o hija en Mi Aprendizaje, en modo solo lectura (sin entregar tareas ni editar).
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {navigationItems.map((item) => (
          <Link key={item.path} href={item.path}>
            <Card className="hover-elevate cursor-pointer bg-white/5 border-white/10 backdrop-blur-md">
              <CardContent className="flex flex-col items-center justify-center p-8">
                <item.icon className="w-12 h-12 mb-4 text-[#1e3cff]" />
                <span className="text-lg font-medium text-white">{item.title}</span>
                <span className="text-xs text-white/45 mt-2">Solo visualización</span>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
