import { Link } from "wouter";
import { User, Heart, Settings } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

const navigationItems = [
  {
    title: "Información Personal",
    path: "/mi-perfil/personal",
    icon: User,
    testId: "link-perfil-personal",
  },
  {
    title: "Ficha Médica",
    path: "/mi-perfil/medica",
    icon: Heart,
    testId: "link-perfil-medica",
  },
  {
    title: "Mi Cuenta",
    path: "/mi-perfil/cuenta",
    icon: Settings,
    testId: "link-perfil-cuenta",
  },
];

const PerfilLayout: React.FC = () => {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6" data-testid="text-perfil-title">Mi Perfil</h1>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {navigationItems.map((item) => (
          <Link key={item.path} href={item.path} data-testid={item.testId}>
            <Card className="hover-elevate cursor-pointer">
              <CardContent className="flex flex-col items-center justify-center p-8">
                <item.icon className="w-12 h-12 mb-4 text-[#1e3cff]" />
                <span className="text-lg font-medium">{item.title}</span>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
};

export default PerfilLayout;
