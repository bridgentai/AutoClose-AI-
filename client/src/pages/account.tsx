import { useAuth } from '@/lib/authContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { User, Mail, GraduationCap, Shield, BookOpen } from 'lucide-react';

export default function Account() {
  const { user } = useAuth();

  const isEstudiante = user?.rol === 'estudiante';
  const bgGradient = isEstudiante 
    ? 'bg-[#001855]'
    : 'bg-gradient-to-br from-[#0a0a0c] via-[#1a001c] to-[#3d0045]';
  const iconGradient = isEstudiante 
    ? 'bg-gradient-to-br from-[#3b82f6] to-[#1e3a8a]'
    : 'bg-gradient-to-br from-[#9f25b8] to-[#6a0dad]';

  return (
    <div className="flex-1 overflow-auto p-8">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-white mb-2 font-['Poppins']">
              Mi Cuenta
            </h1>
            <p className="text-white/60">Información de tu perfil</p>
          </div>

          <div className="space-y-6">
            <Card className={`backdrop-blur-md ${isEstudiante ? 'bg-[#1e3a8a]/20 border-[#3b82f6]/30' : 'bg-white/5 border-white/10'}`}>
              <CardHeader>
                <CardTitle className="text-white">Información Personal</CardTitle>
                <CardDescription className="text-white/60">Tus datos de usuario</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className={`flex items-center gap-4 p-4 rounded-xl ${isEstudiante ? 'bg-[#1e3a8a]/30' : 'bg-white/5'}`}>
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${iconGradient}`}>
                    <User className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <p className="text-white/60 text-sm">Nombre completo</p>
                    <p className="text-white font-medium">{user?.nombre}</p>
                  </div>
                </div>

                <div className={`flex items-center gap-4 p-4 rounded-xl ${isEstudiante ? 'bg-[#1e3a8a]/30' : 'bg-white/5'}`}>
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${iconGradient}`}>
                    <Mail className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <p className="text-white/60 text-sm">Correo electrónico</p>
                    <p className="text-white font-medium">{user?.email}</p>
                  </div>
                </div>

                <div className={`flex items-center gap-4 p-4 rounded-xl ${isEstudiante ? 'bg-[#1e3a8a]/30' : 'bg-white/5'}`}>
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${iconGradient}`}>
                    <Shield className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <p className="text-white/60 text-sm">Rol</p>
                    <p className={`font-medium capitalize ${isEstudiante ? 'text-[#facc15]' : 'text-white'}`}>{user?.rol}</p>
                  </div>
                </div>

                {user?.curso && (
                  <div className={`flex items-center gap-4 p-4 rounded-xl ${isEstudiante ? 'bg-[#1e3a8a]/30' : 'bg-white/5'}`}>
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${iconGradient}`}>
                      <GraduationCap className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1">
                      <p className="text-white/60 text-sm">Curso</p>
                      <p className="text-white font-medium">{user.curso}</p>
                    </div>
                  </div>
                )}

                {user?.materias && user.materias.length > 0 && (
                  <div className={`flex items-start gap-4 p-4 rounded-xl ${isEstudiante ? 'bg-[#1e3a8a]/30' : 'bg-white/5'}`}>
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${iconGradient}`}>
                      <BookOpen className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1">
                      <p className="text-white/60 text-sm mb-2">Materias que dictas</p>
                      <div className="flex flex-wrap gap-2" data-testid="container-materias-display">
                        {user.materias.map((materia) => (
                          <Badge
                            key={materia}
                            className={isEstudiante ? 'bg-[#3b82f6]/20 text-white border border-[#3b82f6]/40' : 'bg-[#9f25b8]/20 text-white border border-[#9f25b8]/40'}
                            data-testid={`badge-materia-${materia.toLowerCase().replace(/\s+/g, '-')}`}
                          >
                            {materia}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className={`backdrop-blur-md ${isEstudiante ? 'bg-[#1e3a8a]/20 border-[#3b82f6]/30' : 'bg-white/5 border-white/10'}`}>
              <CardHeader>
                <CardTitle className="text-white">Acciones</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <button className={`w-full p-4 rounded-xl text-left text-white transition-colors ${isEstudiante ? 'bg-[#1e3a8a]/30 hover:bg-[#1e3a8a]/50' : 'bg-white/5 hover:bg-white/10'}`}>
                  <div className="font-medium">Cambiar contraseña</div>
                  <div className="text-sm text-white/50 mt-1">Actualiza tu contraseña de acceso</div>
                </button>
                
                <button className={`w-full p-4 rounded-xl text-left text-white transition-colors ${isEstudiante ? 'bg-[#1e3a8a]/30 hover:bg-[#1e3a8a]/50' : 'bg-white/5 hover:bg-white/10'}`}>
                  <div className="font-medium">Notificaciones</div>
                  <div className="text-sm text-white/50 mt-1">Configura tus preferencias de notificación</div>
                </button>
              </CardContent>
            </Card>
          </div>
        </div>
    </div>
  );
}
