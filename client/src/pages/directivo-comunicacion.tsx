import { Link } from "wouter";
import { Inbox, Send, Mail, Users, MessageSquare } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/lib/authContext";
import { useLocation } from "wouter";
import { useEffect } from "react";

const navigationItems = [
  {
    title: "Bandeja de Entrada",
    path: "/directivo/comunicacion/bandeja",
    icon: Inbox,
  },
  {
    title: "Redactar Mensaje",
    path: "/directivo/comunicacion/redactar",
    icon: Send,
  },
  {
    title: "Mensajes Enviados",
    path: "/directivo/comunicacion/enviados",
    icon: Mail,
  },
  {
    title: "Chat con Profesores",
    path: "/directivo/comunicacion/profesores",
    icon: Users,
  },
  {
    title: "Chat con Padres",
    path: "/directivo/comunicacion/padres",
    icon: MessageSquare,
  },
  {
    title: "Comunicados Institucionales",
    path: "/directivo/comunicacion/comunicados",
    icon: Send,
  },
];

export default function DirectivoComunicacionLayout() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (user && user.rol !== "directivo") {
      setLocation("/dashboard");
    }
  }, [user, setLocation]);

  if (!user || user.rol !== "directivo") {
    return null;
  }

  return (
    <div className="p-6" data-testid="directivo-comunicacion-layout">
      <h1 className="text-2xl font-bold mb-6 text-white font-['Poppins']">
        Comunicación: Canales Institucionales
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
