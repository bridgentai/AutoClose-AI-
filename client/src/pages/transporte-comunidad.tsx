import { Link } from "wouter";
import { Route, MapPin, Users, Bus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/lib/authContext";
import { useLocation } from "wouter";
import { useEffect } from "react";

const navigationItems = [
  {
    title: "Gestión de Rutas",
    path: "/transporte/comunidad/rutas",
    icon: Route,
  },
  {
    title: "Gestión de Paraderos",
    path: "/transporte/comunidad/paraderos",
    icon: MapPin,
  },
  {
    title: "Asignación de Estudiantes",
    path: "/transporte/comunidad/asignacion",
    icon: Users,
  },
  {
    title: "Gestión de Vehículos",
    path: "/transporte/comunidad/vehiculos",
    icon: Bus,
  },
];

export default function TransporteComunidadLayout() {
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
    <div className="p-6" data-testid="transporte-comunidad-layout">
      <h1 className="text-2xl font-bold mb-6 text-white font-['Poppins']">
        Comunidad: Gestión de Transporte
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
