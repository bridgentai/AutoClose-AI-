import { useAuth } from '@/lib/authContext';
import { DollarSign, TrendingUp, FileText, Users, MessageSquare, CreditCard } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useLocation } from 'wouter';

export default function TesoreriaPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  return (
    <div data-testid="tesoreria-page">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-white mb-2 font-['Poppins']">
          Bienvenido, {user?.nombre?.split(' ')[0] || 'Tesorero'}
        </h2>
        <p className="text-white/60">
          {new Date().toLocaleDateString('es-CO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card className="bg-white/5 border-white/10 backdrop-blur-md hover-elevate">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <DollarSign className="w-5 h-5 text-[#9f25b8]" />
              Pagos Pendientes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white">0</div>
            <p className="text-sm text-white/50 mt-1">Por procesar</p>
          </CardContent>
        </Card>

        <Card className="bg-white/5 border-white/10 backdrop-blur-md hover-elevate">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <TrendingUp className="w-5 h-5 text-[#9f25b8]" />
              Ingresos del Mes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white">$0</div>
            <p className="text-sm text-white/50 mt-1">Recaudado</p>
          </CardContent>
        </Card>

        <Card className="bg-white/5 border-white/10 backdrop-blur-md hover-elevate">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <FileText className="w-5 h-5 text-[#9f25b8]" />
              Facturas Emitidas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white">0</div>
            <p className="text-sm text-white/50 mt-1">Este mes</p>
          </CardContent>
        </Card>

        <Card className="bg-white/5 border-white/10 backdrop-blur-md hover-elevate">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <Users className="w-5 h-5 text-[#9f25b8]" />
              Padres con Deuda
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white">0</div>
            <p className="text-sm text-white/50 mt-1">Pendientes</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-white/5 border-white/10 backdrop-blur-md">
          <CardHeader>
            <CardTitle className="text-white">Acceso Rápido</CardTitle>
            <CardDescription className="text-white/60">Herramientas principales</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              onClick={() => setLocation('/chat')}
              className="w-full justify-start bg-gradient-to-r from-[#9f25b8] to-[#6a0dad] hover:opacity-90"
            >
              <MessageSquare className="w-4 h-4 mr-2" />
              Abrir Chat AI
            </Button>
            <Button
              onClick={() => setLocation('/tesoreria/comunidad')}
              variant="outline"
              className="w-full justify-start border-white/10 text-white hover:bg-white/10"
            >
              <Users className="w-4 h-4 mr-2" />
              Comunicación con Padres
            </Button>
            <Button
              onClick={() => setLocation('/tesoreria/academia')}
              variant="outline"
              className="w-full justify-start border-white/10 text-white hover:bg-white/10"
            >
              <FileText className="w-4 h-4 mr-2" />
              Reportes Financieros
            </Button>
            <Button
              onClick={() => setLocation('/mi-perfil')}
              variant="outline"
              className="w-full justify-start border-white/10 text-white hover:bg-white/10"
            >
              <CreditCard className="w-4 h-4 mr-2" />
              Mi Perfil
            </Button>
          </CardContent>
        </Card>

        <Card className="bg-white/5 border-white/10 backdrop-blur-md">
          <CardHeader>
            <CardTitle className="text-white">Pagos Recientes</CardTitle>
            <CardDescription className="text-white/60">Últimos pagos procesados</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-white/60 text-sm text-center py-8">
              No hay pagos recientes
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

