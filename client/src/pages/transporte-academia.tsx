import { Link } from "wouter";
import { CheckCircle, Clock, Users, Calendar } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/lib/authContext";
import { useLocation } from "wouter";
import { useEffect } from "react";
import { NavBackButton } from "@/components/nav-back-button";

const navigationItems = [
  {
    title: "Asistencia en Transporte",
    path: "/transporte/academia/asistencia",
    icon: CheckCircle,
  },
  {
    title: "Registro de Llegadas",
    path: "/transporte/academia/llegadas",
    icon: Clock,
  },
  {
    title: "Estudiantes por Ruta",
    path: "/transporte/academia/estudiantes",
    icon: Users,
  },
  {
    title: "Calendario de Rutas",
    path: "/transporte/academia/calendario",
    icon: Calendar,
  },
];

export default function TransporteAcademiaLayout() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (user && user.rol !== "transporte") {
      setLocation("/dashboard");
    }
  }, [user, setLocation]);

  if (!user || user.rol !== "transporte") {
    return null;
  }

  return (
    <div className="p-6" data-testid="transporte-academia-layout">
      <NavBackButton to="/transporte" label="Transporte" />
      <h1 className="text-2xl font-bold mb-6 text-white font-['Poppins']">
        Academia: Integración con Asistencia
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
