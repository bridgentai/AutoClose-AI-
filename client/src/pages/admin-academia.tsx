import { Link } from "wouter";
import { BookOpen, FileText, ClipboardList, Settings } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/lib/authContext";
import { useLocation } from "wouter";
import { useEffect } from "react";
import { isAdminColegioLayoutRole } from "@/lib/adminColegioRoles";

const navigationItems = [
  {
    title: "Cursos",
    path: "/admin/academia/cursos",
    icon: BookOpen,
  },
  {
    title: "Materias",
    path: "/admin/academia/materias",
    icon: FileText,
  },
  {
    title: "Notas",
    path: "/admin/academia/notas",
    icon: ClipboardList,
  },
  {
    title: "Configuraciones",
    path: "/admin/academia/configuracion",
    icon: Settings,
  },
];

export default function AdminAcademiaLayout() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (user && !isAdminColegioLayoutRole(user.rol)) {
      setLocation("/dashboard");
    }
  }, [user, setLocation]);

  if (!user || !isAdminColegioLayoutRole(user.rol)) {
    return null;
  }

  return (
    <div className="p-6" data-testid="admin-academia-layout">
      <h1 className="text-3xl font-bold text-white mb-2 font-['Poppins']">
        Academia
      </h1>
      <p className="text-white/60 mb-6">
        Acceso total a cursos, materias, notas y configuraciones
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {navigationItems.map((item) => (
          <Link key={item.path} href={item.path}>
            <Card className="bg-white/5 border-white/10 backdrop-blur-md hover-elevate cursor-pointer">
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

