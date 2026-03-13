import { Link } from "wouter";
import { Inbox, Send, MessageSquare } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/lib/authContext";
import { useLocation } from "wouter";
import { useEffect } from "react";
import { NavBackButton } from "@/components/nav-back-button";

const navigationItems = [
  { title: "Bandeja de Entrada", path: "/asistente/comunicacion/bandeja", icon: Inbox },
  { title: "Redactar mensaje a padres", path: "/asistente/comunicacion/redactar", icon: Send },
  { title: "Evo Send", path: "/evo-send", icon: MessageSquare, description: "Chat por curso, tipo WhatsApp" },
];

export default function AsistenteComunicacionLayout() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (user && user.rol !== "asistente") {
      setLocation("/dashboard");
    }
  }, [user, setLocation]);

  if (!user || user.rol !== "asistente") {
    return null;
  }

  return (
    <div className="p-6" data-testid="asistente-comunicacion-layout">
      <NavBackButton to="/asistente" label="Vista Asistente" />
      <h1 className="text-2xl font-bold mb-6 text-white font-['Poppins']">
        Comunicación con padres
      </h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {navigationItems.map((item) => {
          const isEvoSend = item.path === "/evo-send";
          return (
            <Link key={item.path} href={item.path}>
              <Card
                className={`hover-elevate cursor-pointer backdrop-blur-md ${
                  isEvoSend ? "bg-emerald-500/10 border-emerald-500/30" : "bg-white/5 border-white/10"
                }`}
              >
                <CardContent className="flex flex-col items-center justify-center p-8">
                  <item.icon className={`w-12 h-12 mb-4 ${isEvoSend ? "text-emerald-400" : "text-[#1e3cff]"}`} />
                  <span className="text-lg font-medium text-white">{item.title}</span>
                  {"description" in item && (
                    <span className="text-sm text-white/60 mt-1 text-center">{item.description}</span>
                  )}
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
