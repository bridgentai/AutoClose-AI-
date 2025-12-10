import { Link } from "wouter";

const PerfilLayout: React.FC = () => {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6" data-testid="text-perfil-title">Mi Perfil</h1>
      
      <div className="grid gap-4 md:grid-cols-3">
        <Link href="/mi-perfil/personal" data-testid="link-perfil-personal">
          <div className="p-4 border rounded-md hover-elevate cursor-pointer">
            <span className="font-medium">Información Personal</span>
          </div>
        </Link>
        
        <Link href="/mi-perfil/medica" data-testid="link-perfil-medica">
          <div className="p-4 border rounded-md hover-elevate cursor-pointer">
            <span className="font-medium">Ficha Médica</span>
          </div>
        </Link>
        
        <Link href="/mi-perfil/cuenta" data-testid="link-perfil-cuenta">
          <div className="p-4 border rounded-md hover-elevate cursor-pointer">
            <span className="font-medium">Mi Cuenta</span>
          </div>
        </Link>
      </div>
    </div>
  );
};

export default PerfilLayout;
