import { Link } from "wouter";
import { Users, MessageSquare, Mail, Bell } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/lib/authContext";
import { useLocation } from "wouter";
import { useEffect } from "react";

const navigationItems = [
  {
    title: "Comunicación con Padres",
    path: "/tesoreria/comunidad/padres",
    icon: Users,
  },
  {
    title: "Chat con Padres",
    path: "/tesoreria/comunidad/chat",
    icon: MessageSquare,
  },
  {
    title: "Envío de Recordatorios",
    path: "/tesoreria/comunidad/recordatorios",
    icon: Mail,
  },
  {
    title: "Notificaciones de Pago",
    path: "/tesoreria/comunidad/notificaciones",
    icon: Bell,
  },
];

export default function TesoreriaComunidadLayout() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (user && user.rol !== "tesoreria") {
      setLocation("/dashboard");
    }
  }, [user, setLocation]);

  if (!user || user.rol !== "tesoreria") {
    return null;
  }

  return (
    <div className="p-6" data-testid="tesoreria-comunidad-layout">
      <h1 className="text-2xl font-bold mb-6 text-white font-['Poppins']">
        Comunidad: Comunicación con Padres
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
