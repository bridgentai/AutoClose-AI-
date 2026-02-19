import { Link } from "wouter";
import { Inbox, Send, Mail, Eye, MessageSquare } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/lib/authContext";
import { useLocation } from "wouter";
import { useEffect } from "react";

const navigationItems = [
  {
    title: "Bandeja de Entrada",
    path: "/administrador-general/comunicacion/bandeja",
    icon: Inbox,
  },
  {
    title: "Redactar Mensaje",
    path: "/administrador-general/comunicacion/redactar",
    icon: Send,
  },
  {
    title: "Mensajes Enviados",
    path: "/administrador-general/comunicacion/enviados",
    icon: Mail,
  },
  {
    title: "Monitoreo de Mensajes",
    path: "/administrador-general/comunicacion/monitoreo",
    icon: Eye,
  },
  {
    title: "Todos los Canales",
    path: "/administrador-general/comunicacion/canales",
    icon: MessageSquare,
  },
];

export default function AdministradorGeneralComunicacionLayout() {
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
    <div className="p-6" data-testid="administrador-general-comunicacion-layout">
      <h1 className="text-2xl font-bold mb-6 text-white font-['Poppins']">
        Comunicación: Acceso a Todos los Canales
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

