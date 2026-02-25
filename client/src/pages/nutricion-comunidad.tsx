import { Link } from "wouter";
import { UtensilsCrossed, Calendar, Users, Apple, CalendarDays } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/lib/authContext";
import { useLocation } from "wouter";
import { useEffect } from "react";
import { NavBackButton } from "@/components/nav-back-button";

const navigationItems = [
  {
    title: "Planificación de Menús",
    path: "/nutricion/comunidad/menus",
    icon: UtensilsCrossed,
  },
  {
    title: "Calendario de Menús",
    path: "/nutricion/comunidad/calendario",
    icon: Calendar,
  },
  {
    title: "Comunicación con Padres",
    path: "/nutricion/comunidad/padres",
    icon: Users,
  },
  {
    title: "Dietas Especiales",
    path: "/nutricion/comunidad/dietas",
    icon: Apple,
  },
  {
    title: "Calendario de Eventos",
    path: "/comunidad/calendario",
    icon: CalendarDays,
  },
];

export default function NutricionComunidadLayout() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (user && user.rol !== "nutricion") {
      setLocation("/dashboard");
    }
  }, [user, setLocation]);

  if (!user || user.rol !== "nutricion") {
    return null;
  }

  return (
    <div className="p-6" data-testid="nutricion-comunidad-layout">
      <NavBackButton to="/nutricion" label="Nutrición" />
      <h1 className="text-2xl font-bold mb-6 text-white font-['Poppins']">
        Comunidad: Planificación de Menús
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

