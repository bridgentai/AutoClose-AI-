import { useState } from 'react';
import { useAuth } from '@/lib/authContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { User, Mail, GraduationCap, Shield, BookOpen, Settings, Moon, Sun, Bell, Type, Globe } from 'lucide-react';

export default function Account() {
  const { user } = useAuth();
  const [tema, setTema] = useState<string>('oscuro');
  const [notificacionesEmail, setNotificacionesEmail] = useState<boolean>(true);
  const [notificacionesPush, setNotificacionesPush] = useState<boolean>(true);
  const [notificacionesTareas, setNotificacionesTareas] = useState<boolean>(true);
  const [tamanoLetra, setTamanoLetra] = useState<string>('medio');
  const [idioma, setIdioma] = useState<string>('es');

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
          <Card className="backdrop-blur-md bg-white/5 border-white/10">
            <CardHeader>
              <CardTitle className="text-white">Información Personal</CardTitle>
              <CardDescription className="text-white/60">Tus datos de usuario</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4 p-4 rounded-xl bg-white/5">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-gradient-to-br from-[#9f25b8] to-[#6a0dad]">
                  <User className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1">
                  <p className="text-white/60 text-sm">Nombre completo</p>
                  <p className="text-white font-medium">{user?.nombre}</p>
                </div>
              </div>

              <div className="flex items-center gap-4 p-4 rounded-xl bg-white/5">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-gradient-to-br from-[#9f25b8] to-[#6a0dad]">
                  <Mail className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1">
                  <p className="text-white/60 text-sm">Correo electrónico</p>
                  <p className="text-white font-medium">{user?.email}</p>
                </div>
              </div>

              <div className="flex items-center gap-4 p-4 rounded-xl bg-white/5">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-gradient-to-br from-[#9f25b8] to-[#6a0dad]">
                  <Shield className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1">
                  <p className="text-white/60 text-sm">Rol</p>
                  <p className="font-medium capitalize text-white">{user?.rol}</p>
                </div>
              </div>

              {user?.curso && (
                <div className="flex items-center gap-4 p-4 rounded-xl bg-white/5">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-gradient-to-br from-[#9f25b8] to-[#6a0dad]">
                    <GraduationCap className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <p className="text-white/60 text-sm">Curso</p>
                    <p className="text-white font-medium">{user.curso}</p>
                  </div>
                </div>
              )}

              {user?.materias && user.materias.length > 0 && (
                <div className="flex items-start gap-4 p-4 rounded-xl bg-white/5">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-gradient-to-br from-[#9f25b8] to-[#6a0dad]">
                    <BookOpen className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <p className="text-white/60 text-sm mb-2">Materias que dictas</p>
                    <div className="flex flex-wrap gap-2" data-testid="container-materias-display">
                      {user.materias.map((materia) => (
                        <Badge
                          key={materia}
                          className="bg-[#9f25b8]/20 text-white border border-[#9f25b8]/40"
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

          <Card className="backdrop-blur-md bg-white/5 border-white/10">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Settings className="w-5 h-5 text-[#9f25b8]" />
                Configuración de Cuenta
              </CardTitle>
              <CardDescription className="text-white/60">
                Personaliza tu experiencia en la plataforma
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Tema */}
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-white/5">
                    {tema === 'oscuro' ? (
                      <Moon className="w-5 h-5 text-[#9f25b8]" />
                    ) : (
                      <Sun className="w-5 h-5 text-[#9f25b8]" />
                    )}
                  </div>
                  <div className="flex-1">
                    <Label htmlFor="tema" className="text-white font-medium">
                      Tema
                    </Label>
                    <p className="text-sm text-white/60">
                      Selecciona el tema de la interfaz
                    </p>
                  </div>
                </div>
                <Select value={tema} onValueChange={setTema}>
                  <SelectTrigger
                    id="tema"
                    className="bg-white/5 border-white/10 text-white focus:ring-[#9f25b8]"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1a001c] border-white/10">
                    <SelectItem value="oscuro" className="text-white focus:bg-[#9f25b8]/20">
                      <div className="flex items-center gap-2">
                        <Moon className="w-4 h-4" />
                        Oscuro
                      </div>
                    </SelectItem>
                    <SelectItem value="claro" className="text-white focus:bg-[#9f25b8]/20">
                      <div className="flex items-center gap-2">
                        <Sun className="w-4 h-4" />
                        Claro
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Notificaciones */}
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-white/5">
                    <Bell className="w-5 h-5 text-[#9f25b8]" />
                  </div>
                  <div className="flex-1">
                    <Label className="text-white font-medium">Notificaciones</Label>
                    <p className="text-sm text-white/60">
                      Controla cómo recibes las notificaciones
                    </p>
                  </div>
                </div>

                <div className="space-y-3 pl-14">
                  <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/10">
                    <div>
                      <Label htmlFor="notif-email" className="text-white">
                        Notificaciones por Email
                      </Label>
                      <p className="text-sm text-white/60">
                        Recibe notificaciones en tu correo electrónico
                      </p>
                    </div>
                    <Switch
                      id="notif-email"
                      checked={notificacionesEmail}
                      onCheckedChange={setNotificacionesEmail}
                      className="data-[state=checked]:bg-[#9f25b8]"
                    />
                  </div>

                  <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/10">
                    <div>
                      <Label htmlFor="notif-push" className="text-white">
                        Notificaciones Push
                      </Label>
                      <p className="text-sm text-white/60">
                        Recibe notificaciones en tiempo real
                      </p>
                    </div>
                    <Switch
                      id="notif-push"
                      checked={notificacionesPush}
                      onCheckedChange={setNotificacionesPush}
                      className="data-[state=checked]:bg-[#9f25b8]"
                    />
                  </div>

                  <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/10">
                    <div>
                      <Label htmlFor="notif-tareas" className="text-white">
                        Recordatorios de Tareas
                      </Label>
                      <p className="text-sm text-white/60">
                        Notificaciones sobre tareas pendientes
                      </p>
                    </div>
                    <Switch
                      id="notif-tareas"
                      checked={notificacionesTareas}
                      onCheckedChange={setNotificacionesTareas}
                      className="data-[state=checked]:bg-[#9f25b8]"
                    />
                  </div>
                </div>
              </div>

              {/* Tamaño de Letra */}
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-white/5">
                    <Type className="w-5 h-5 text-[#9f25b8]" />
                  </div>
                  <div className="flex-1">
                    <Label htmlFor="tamano-letra" className="text-white font-medium">
                      Tamaño de Letra
                    </Label>
                    <p className="text-sm text-white/60">
                      Ajusta el tamaño del texto para mejor legibilidad
                    </p>
                  </div>
                </div>
                <Select value={tamanoLetra} onValueChange={setTamanoLetra}>
                  <SelectTrigger
                    id="tamano-letra"
                    className="bg-white/5 border-white/10 text-white focus:ring-[#9f25b8]"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1a001c] border-white/10">
                    <SelectItem value="pequeno" className="text-white focus:bg-[#9f25b8]/20">
                      Pequeño
                    </SelectItem>
                    <SelectItem value="medio" className="text-white focus:bg-[#9f25b8]/20">
                      Medio
                    </SelectItem>
                    <SelectItem value="grande" className="text-white focus:bg-[#9f25b8]/20">
                      Grande
                    </SelectItem>
                    <SelectItem value="muy-grande" className="text-white focus:bg-[#9f25b8]/20">
                      Muy Grande
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Idioma */}
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-white/5">
                    <Globe className="w-5 h-5 text-[#9f25b8]" />
                  </div>
                  <div className="flex-1">
                    <Label htmlFor="idioma" className="text-white font-medium">
                      Idioma
                    </Label>
                    <p className="text-sm text-white/60">
                      Selecciona tu idioma preferido
                    </p>
                  </div>
                </div>
                <Select value={idioma} onValueChange={setIdioma}>
                  <SelectTrigger
                    id="idioma"
                    className="bg-white/5 border-white/10 text-white focus:ring-[#9f25b8]"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1a001c] border-white/10">
                    <SelectItem value="es" className="text-white focus:bg-[#9f25b8]/20">
                      Español
                    </SelectItem>
                    <SelectItem value="en" className="text-white focus:bg-[#9f25b8]/20">
                      English
                    </SelectItem>
                    <SelectItem value="pt" className="text-white focus:bg-[#9f25b8]/20">
                      Português
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card className="backdrop-blur-md bg-white/5 border-white/10">
            <CardHeader>
              <CardTitle className="text-white">Acciones</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <button className="w-full p-4 rounded-xl text-left text-white transition-colors bg-white/5 hover:bg-white/10">
                <div className="font-medium">Cambiar contraseña</div>
                <div className="text-sm text-white/50 mt-1">Actualiza tu contraseña de acceso</div>
              </button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
