import { useAuth } from '@/lib/authContext';
import { AppSidebar } from '@/components/app-sidebar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { User, Mail, GraduationCap, Shield } from 'lucide-react';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';

export default function Account() {
  const { user } = useAuth();

  return (
    <SidebarProvider>
      <div className="flex h-screen w-full bg-gradient-to-br from-[#0a0a0c] via-[#1a001c] to-[#3d0045]">
        <AppSidebar />
        <SidebarInset className="flex flex-col flex-1">
          <div className="flex-1 overflow-auto p-8">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-white mb-2 font-['Poppins']">
              Mi Cuenta
            </h1>
            <p className="text-white/60">Información de tu perfil</p>
          </div>

          <div className="space-y-6">
            <Card className="bg-white/5 border-white/10 backdrop-blur-md">
              <CardHeader>
                <CardTitle className="text-white">Información Personal</CardTitle>
                <CardDescription className="text-white/60">Tus datos de usuario</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-4 p-4 bg-white/5 rounded-xl">
                  <div className="w-12 h-12 bg-gradient-to-br from-[#9f25b8] to-[#6a0dad] rounded-xl flex items-center justify-center">
                    <User className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <p className="text-white/60 text-sm">Nombre completo</p>
                    <p className="text-white font-medium">{user?.nombre}</p>
                  </div>
                </div>

                <div className="flex items-center gap-4 p-4 bg-white/5 rounded-xl">
                  <div className="w-12 h-12 bg-gradient-to-br from-[#9f25b8] to-[#6a0dad] rounded-xl flex items-center justify-center">
                    <Mail className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <p className="text-white/60 text-sm">Correo electrónico</p>
                    <p className="text-white font-medium">{user?.email}</p>
                  </div>
                </div>

                <div className="flex items-center gap-4 p-4 bg-white/5 rounded-xl">
                  <div className="w-12 h-12 bg-gradient-to-br from-[#9f25b8] to-[#6a0dad] rounded-xl flex items-center justify-center">
                    <Shield className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <p className="text-white/60 text-sm">Rol</p>
                    <p className="text-white font-medium capitalize">{user?.rol}</p>
                  </div>
                </div>

                {user?.curso && (
                  <div className="flex items-center gap-4 p-4 bg-white/5 rounded-xl">
                    <div className="w-12 h-12 bg-gradient-to-br from-[#9f25b8] to-[#6a0dad] rounded-xl flex items-center justify-center">
                      <GraduationCap className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1">
                      <p className="text-white/60 text-sm">Curso</p>
                      <p className="text-white font-medium">{user.curso}</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="bg-white/5 border-white/10 backdrop-blur-md">
              <CardHeader>
                <CardTitle className="text-white">Acciones</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <button className="w-full p-4 bg-white/5 hover:bg-white/10 rounded-xl text-left text-white transition-colors">
                  <div className="font-medium">Cambiar contraseña</div>
                  <div className="text-sm text-white/50 mt-1">Actualiza tu contraseña de acceso</div>
                </button>
                
                <button className="w-full p-4 bg-white/5 hover:bg-white/10 rounded-xl text-left text-white transition-colors">
                  <div className="font-medium">Notificaciones</div>
                  <div className="text-sm text-white/50 mt-1">Configura tus preferencias de notificación</div>
                </button>
              </CardContent>
            </Card>
          </div>
        </div>
          </div>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
