import { Link } from "wouter";
import { Users, Bell, Calendar, FileText } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/lib/authContext";
import { useLocation } from "wouter";
import { useEffect } from "react";
import { NavBackButton } from "@/components/nav-back-button";

const navigationItems = [
  {
    title: "Gestión de Grupos",
    path: "/directivo/comunidad/grupos",
    icon: Users,
  },
  {
    title: "Boletines Institucionales",
    path: "/directivo/comunidad/boletines",
    icon: FileText,
  },
  {
    title: "Notificaciones Masivas",
    path: "/directivo/comunidad/notificaciones",
    icon: Bell,
  },
  {
    title: "Calendario de Eventos",
    path: "/comunidad/calendario",
    icon: Calendar,
  },
];

export default function DirectivoComunidadLayout() {
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
    <div className="p-6" data-testid="directivo-comunidad-layout">
      <NavBackButton to="/directivo" label="Vista Directivo" />
      <h1 className="text-2xl font-bold mb-6 text-white font-['Poppins']">
        Comunidad: Gestión Institucional
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
