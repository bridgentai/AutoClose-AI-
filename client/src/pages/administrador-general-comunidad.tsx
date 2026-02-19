import { Link } from "wouter";
import { Users, Shield, UserPlus, Settings } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/lib/authContext";
import { useLocation } from "wouter";
import { useEffect } from "react";

const navigationItems = [
  {
    title: "Gestión de Usuarios",
    path: "/administrador-general/comunidad/usuarios",
    icon: Users,
  },
  {
    title: "Gestión de Roles",
    path: "/administrador-general/comunidad/roles",
    icon: Shield,
  },
  {
    title: "Crear Usuario",
    path: "/administrador-general/comunidad/crear-usuario",
    icon: UserPlus,
  },
  {
    title: "Configuración de Permisos",
    path: "/administrador-general/comunidad/permisos",
    icon: Settings,
  },
];

export default function AdministradorGeneralComunidadLayout() {
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
    <div className="p-6" data-testid="administrador-general-comunidad-layout">
      <h1 className="text-2xl font-bold mb-6 text-white font-['Poppins']">
        Comunidad: Gestión Completa de Usuarios
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

