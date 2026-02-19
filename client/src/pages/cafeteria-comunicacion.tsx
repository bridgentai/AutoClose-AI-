import { Link } from "wouter";
import { Inbox, Send, Mail, Bell, MessageSquare } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/lib/authContext";
import { useLocation } from "wouter";
import { useEffect } from "react";

const navigationItems = [
  {
    title: "Bandeja de Entrada",
    path: "/cafeteria/comunicacion/bandeja",
    icon: Inbox,
  },
  {
    title: "Redactar Mensaje",
    path: "/cafeteria/comunicacion/redactar",
    icon: Send,
  },
  {
    title: "Mensajes Enviados",
    path: "/cafeteria/comunicacion/enviados",
    icon: Mail,
  },
  {
    title: "Notificaciones de Disponibilidad",
    path: "/cafeteria/comunicacion/disponibilidad",
    icon: Bell,
  },
  {
    title: "Chat con Estudiantes/Padres",
    path: "/cafeteria/comunicacion/chat",
    icon: MessageSquare,
  },
];

export default function CafeteriaComunicacionLayout() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (user && user.rol !== "cafeteria") {
      setLocation("/dashboard");
    }
  }, [user, setLocation]);

  if (!user || user.rol !== "cafeteria") {
    return null;
  }

  return (
    <div className="p-6" data-testid="cafeteria-comunicacion-layout">
      <h1 className="text-2xl font-bold mb-6 text-white font-['Poppins']">
        Comunicación: Cafetería
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

