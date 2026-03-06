import { useAuth } from '@/lib/authContext';
import { MessageSquare, TrendingUp, BookOpen } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useLocation } from 'wouter';

export default function ParentPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  return (
    <div data-testid="parent-page">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-white mb-2 font-['Poppins']">
          Bienvenido, {user?.nombre?.split(' ')[0] || 'Padre/Madre'}
        </h2>
        <p className="text-white/60">
          {new Date().toLocaleDateString('es-CO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <Card className="bg-white/5 border-white/10 backdrop-blur-md">
          <CardHeader>
            <CardTitle className="text-white">Acceso Rapido</CardTitle>
            <CardDescription className="text-white/60">Herramientas principales</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              onClick={() => setLocation('/chat')}
              className="w-full justify-start bg-gradient-to-r from-[#002366] to-[#1e3cff] hover:opacity-90"
              data-testid="button-chat"
            >
              <MessageSquare className="w-4 h-4 mr-2" />
              Abrir Chat AI
            </Button>
            <Button
              onClick={() => setLocation('/materials')}
              variant="outline"
              className="w-full justify-start border-white/10 text-white hover:bg-white/10"
              data-testid="button-materials"
            >
              <BookOpen className="w-4 h-4 mr-2" />
              Ver Materiales
            </Button>
          </CardContent>
        </Card>

        <Card className="bg-white/5 border-white/10 backdrop-blur-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <TrendingUp className="w-5 h-5 text-[#1e3cff]" />
              Rendimiento General
            </CardTitle>
            <CardDescription className="text-white/60">Promedio academico</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-5xl font-bold text-white mb-2">90</div>
            <p className="text-sm text-white/50">de 100</p>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-white/5 border-white/10 backdrop-blur-md mb-6">
        <CardHeader>
          <CardTitle className="text-white">Seguimiento del Estudiante</CardTitle>
          <CardDescription className="text-white/60">Progreso academico de su hijo/a</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="p-4 bg-white/5 rounded-xl">
              <div className="flex items-center justify-between mb-3">
                <span className="text-white font-medium">Matematicas</span>
                <span className="text-[#1e3cff] font-bold">90/100</span>
              </div>
              <div className="w-full bg-white/10 rounded-full h-2">
                <div className="bg-gradient-to-r from-[#002366] to-[#1e3cff] h-2 rounded-full" style={{ width: '90%' }} />
              </div>
            </div>

            <div className="p-4 bg-white/5 rounded-xl">
              <div className="flex items-center justify-between mb-3">
                <span className="text-white font-medium">Ciencias</span>
                <span className="text-[#1e3cff] font-bold">84/100</span>
              </div>
              <div className="w-full bg-white/10 rounded-full h-2">
                <div className="bg-gradient-to-r from-[#002366] to-[#1e3cff] h-2 rounded-full" style={{ width: '84%' }} />
              </div>
            </div>

            <div className="p-4 bg-white/5 rounded-xl">
              <div className="flex items-center justify-between mb-3">
                <span className="text-white font-medium">Historia</span>
                <span className="text-[#1e3cff] font-bold">94/100</span>
              </div>
              <div className="w-full bg-white/10 rounded-full h-2">
                <div className="bg-gradient-to-r from-[#002366] to-[#1e3cff] h-2 rounded-full" style={{ width: '94%' }} />
              </div>
            </div>

            <div className="p-4 bg-white/5 rounded-xl">
              <div className="flex items-center justify-between mb-3">
                <span className="text-white font-medium">Fisica</span>
                <span className="text-[#1e3cff] font-bold">88/100</span>
              </div>
              <div className="w-full bg-white/10 rounded-full h-2">
                <div className="bg-gradient-to-r from-[#002366] to-[#1e3cff] h-2 rounded-full" style={{ width: '88%' }} />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-white/5 border-white/10 backdrop-blur-md">
        <CardHeader>
          <CardTitle className="text-white">Comunicacion con Docentes</CardTitle>
          <CardDescription className="text-white/60">Usa el chat AI para consultas</CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            onClick={() => setLocation('/chat')}
            className="w-full bg-gradient-to-r from-[#002366] to-[#1e3cff] hover:opacity-90"
            data-testid="button-chat-main"
          >
            Iniciar Chat con MindOS
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
