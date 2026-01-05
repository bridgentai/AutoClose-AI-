import { Link } from "wouter";
import { Users, Shield, Settings } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/lib/authContext";
import { useLocation } from "wouter";
import { useEffect } from "react";

const navigationItems = [
  {
    title: "Gestión de Usuarios",
    path: "/admin/comunidad/usuarios",
    icon: Users,
  },
  {
    title: "Gestión de Roles",
    path: "/admin/comunidad/roles",
    icon: Shield,
  },
  {
    title: "Configuración Institucional",
    path: "/admin/comunidad/configuracion",
    icon: Settings,
  },
];

export default function AdminComunidadLayout() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (user && user.rol !== "administrador") {
      setLocation("/dashboard");
    }
  }, [user, setLocation]);

  if (!user || user.rol !== "administrador") {
    return null;
  }

  return (
    <div className="p-6" data-testid="admin-comunidad-layout">
      <h1 className="text-3xl font-bold text-white mb-2 font-['Poppins']">
        Comunidad
      </h1>
      <p className="text-white/60 mb-6">
        Gestión completa de usuarios y roles
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {navigationItems.map((item) => (
          <Link key={item.path} href={item.path}>
            <Card className="bg-white/5 border-white/10 backdrop-blur-md hover-elevate cursor-pointer">
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

