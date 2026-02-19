import { Link } from "wouter";
import { ClipboardList, Users, FileText, TrendingUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/lib/authContext";
import { useLocation } from "wouter";
import { useEffect } from "react";

const navigationItems = [
  {
    title: "Registro de Compras",
    path: "/cafeteria/academia/compras",
    icon: ClipboardList,
  },
  {
    title: "Compras por Estudiante",
    path: "/cafeteria/academia/estudiantes",
    icon: Users,
  },
  {
    title: "Compras del Personal",
    path: "/cafeteria/academia/personal",
    icon: Users,
  },
  {
    title: "Reportes de Ventas",
    path: "/cafeteria/academia/reportes",
    icon: FileText,
  },
  {
    title: "Análisis de Ventas",
    path: "/cafeteria/academia/analisis",
    icon: TrendingUp,
  },
];

export default function CafeteriaAcademiaLayout() {
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
    <div className="p-6" data-testid="cafeteria-academia-layout">
      <h1 className="text-2xl font-bold mb-6 text-white font-['Poppins']">
        Academia: Registro de Compras
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

