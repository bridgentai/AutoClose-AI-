import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/authContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FileCheck, User, Calendar, Bus, Car, UserCheck, Hash, MapPin, Plus, Clock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

type TipoPermiso = 
  | 'ruta-a-carro' 
  | 'carro-a-ruta' 
  | 'ruta-a-ruta' 
  | 'carro-a-carro' 
  | 'salida-caminando';

interface FormularioPermiso {
  tipoPermiso: TipoPermiso | '';
  nombreEstudiante: string;
  fecha: string;
  numeroRutaActual: string;
  numeroRutaCambio: string;
  placaCarroSalida: string;
  nombreConductor: string;
  cedulaConductor: string;
  placaCarroActual: string;
}

interface PermisoCreado extends FormularioPermiso {
  id: string;
  fechaCreacion: string;
}

const getTipoPermisoLabel = (tipo: TipoPermiso): string => {
  const labels: Record<TipoPermiso, string> = {
    'ruta-a-carro': 'De ruta a carro',
    'carro-a-ruta': 'De carro a ruta',
    'ruta-a-ruta': 'De ruta a ruta',
    'carro-a-carro': 'De carro a carro',
    'salida-caminando': 'Salida caminando',
  };
  return labels[tipo];
};

export default function PermisosPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [permisos, setPermisos] = useState<PermisoCreado[]>([]);
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [formData, setFormData] = useState<FormularioPermiso>({
    tipoPermiso: '',
    nombreEstudiante: '',
    fecha: '',
    numeroRutaActual: '',
    numeroRutaCambio: '',
    placaCarroSalida: '',
    nombreConductor: '',
    cedulaConductor: '',
    placaCarroActual: '',
  });

  // Función para cargar permisos del localStorage (memoizada)
  const cargarPermisos = useCallback(() => {
    if (!user?.id) return;
    
    const permisosGuardados = localStorage.getItem(`permisos_${user.id}`);
    console.log('[Permisos] Cargando permisos desde localStorage:', permisosGuardados ? 'existe' : 'no existe');
    if (permisosGuardados) {
      try {
        const parsed = JSON.parse(permisosGuardados);
        console.log('[Permisos] Permisos parseados:', parsed.length, 'permisos');
        setPermisos(parsed);
        setMostrarFormulario(false);
      } catch (e) {
        console.error('[Permisos] Error al cargar permisos:', e);
      }
    } else {
      console.log('[Permisos] No hay permisos guardados, mostrando formulario');
      setPermisos([]);
      setMostrarFormulario(true);
    }
  }, [user?.id]);

  // Cargar permisos del localStorage al iniciar
  useEffect(() => {
    cargarPermisos();
  }, [cargarPermisos]);

  // Listener para detectar cambios en localStorage (cuando se crea un permiso desde el chat)
  useEffect(() => {
    if (!user?.id) return;

    // Listener para eventos de storage (cuando se cambia desde otra pestaña/ventana)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === `permisos_${user.id}`) {
        console.log('[Permisos] Cambio detectado en localStorage (storage event), recargando permisos...');
        cargarPermisos();
      }
    };

    // Listener personalizado para cambios en la misma pestaña
    const handleCustomStorageChange = () => {
      console.log('[Permisos] Evento personalizado "permisos-updated" recibido, recargando permisos...');
      // Pequeño delay para asegurar que localStorage se haya actualizado
      setTimeout(() => {
        cargarPermisos();
      }, 100);
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('permisos-updated', handleCustomStorageChange);

    // Polling cada 500ms para detectar cambios (fallback para misma pestaña)
    let lastPermisosCount = permisos.length;
    let lastPermisosIds = permisos.map(p => p.id).sort().join(',');
    
    const interval = setInterval(() => {
      const permisosGuardados = localStorage.getItem(`permisos_${user.id}`);
      if (permisosGuardados) {
        try {
          const parsed = JSON.parse(permisosGuardados);
          const newIds = parsed.map((p: PermisoCreado) => p.id).sort().join(',');
          
          // Actualizar si hay cambios en la cantidad o si los IDs son diferentes
          if (parsed.length !== lastPermisosCount || newIds !== lastPermisosIds) {
            console.log('[Permisos] Cambio detectado por polling:', {
              anterior: lastPermisosCount,
              nuevo: parsed.length,
              recargando: true
            });
            lastPermisosCount = parsed.length;
            lastPermisosIds = newIds;
            cargarPermisos();
          }
        } catch (e) {
          console.error('[Permisos] Error en polling:', e);
        }
      } else if (lastPermisosCount > 0) {
        // Si había permisos pero ahora no hay, también actualizar
        console.log('[Permisos] Permisos eliminados, recargando...');
        lastPermisosCount = 0;
        lastPermisosIds = '';
        cargarPermisos();
      }
    }, 500);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('permisos-updated', handleCustomStorageChange);
      clearInterval(interval);
    };
  }, [user?.id, cargarPermisos]);

  const handleChange = (field: keyof FormularioPermiso, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validación básica
    if (!formData.tipoPermiso || !formData.nombreEstudiante || !formData.fecha) {
      toast({
        title: 'Error',
        description: 'Por favor completa todos los campos obligatorios.',
        variant: 'destructive',
      });
      return;
    }

    // Validación de campos condicionales según el tipo
    const tipo = formData.tipoPermiso;
    
    if (tipo === 'ruta-a-carro' || tipo === 'ruta-a-ruta') {
      if (!formData.numeroRutaActual) {
        toast({
          title: 'Error',
          description: 'El número de ruta actual es requerido.',
          variant: 'destructive',
        });
        return;
      }
    }

    if (tipo === 'carro-a-ruta' || tipo === 'ruta-a-ruta') {
      if (!formData.numeroRutaCambio) {
        toast({
          title: 'Error',
          description: 'El número de ruta a la que cambia es requerido.',
          variant: 'destructive',
        });
        return;
      }
    }

    if (tipo === 'ruta-a-carro' || tipo === 'carro-a-ruta' || tipo === 'carro-a-carro') {
      if (!formData.placaCarroSalida || !formData.nombreConductor || !formData.cedulaConductor) {
        toast({
          title: 'Error',
          description: 'Los datos del vehículo y conductor son requeridos.',
          variant: 'destructive',
        });
        return;
      }
    }

    if (tipo === 'carro-a-ruta' || tipo === 'carro-a-carro') {
      if (!formData.placaCarroActual) {
        toast({
          title: 'Error',
          description: 'La placa del carro actual es requerida.',
          variant: 'destructive',
        });
        return;
      }
    }

    // Crear el permiso
    const nuevoPermiso: PermisoCreado = {
      ...formData,
      id: Date.now().toString(),
      fechaCreacion: new Date().toISOString(),
    };

    // Guardar en estado y localStorage
    const permisosActualizados = [...permisos, nuevoPermiso];
    setPermisos(permisosActualizados);
    localStorage.setItem(`permisos_${user?.id}`, JSON.stringify(permisosActualizados));
    
    // Disparar evento para notificar cambios
    window.dispatchEvent(new Event('permisos-updated'));
    
    toast({
      title: 'Permiso generado',
      description: 'El permiso de salida ha sido generado exitosamente.',
    });

    // Resetear formulario y ocultar si hay permisos
    setFormData({
      tipoPermiso: '',
      nombreEstudiante: '',
      fecha: '',
      numeroRutaActual: '',
      numeroRutaCambio: '',
      placaCarroSalida: '',
      nombreConductor: '',
      cedulaConductor: '',
      placaCarroActual: '',
    });
    
    setMostrarFormulario(false);
  };

  // Ordenar permisos por fecha (próximos primero)
  const permisosOrdenados = [...permisos].sort((a, b) => {
    const fechaA = new Date(a.fecha).getTime();
    const fechaB = new Date(b.fecha).getTime();
    return fechaA - fechaB;
  });

  // Filtrar permisos futuros o de hoy
  const permisosProximos = permisosOrdenados.filter(permiso => {
    const fechaPermiso = new Date(permiso.fecha);
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    fechaPermiso.setHours(0, 0, 0, 0);
    return fechaPermiso >= hoy;
  });

  const tipoPermiso = formData.tipoPermiso;
  const necesitaRutaActual = tipoPermiso === 'ruta-a-carro' || tipoPermiso === 'ruta-a-ruta';
  const necesitaRutaCambio = tipoPermiso === 'carro-a-ruta' || tipoPermiso === 'ruta-a-ruta';
  const necesitaDatosCarro = tipoPermiso === 'ruta-a-carro' || tipoPermiso === 'carro-a-ruta' || tipoPermiso === 'carro-a-carro';
  const necesitaPlacaActual = tipoPermiso === 'carro-a-ruta' || tipoPermiso === 'carro-a-carro';

  // Si no hay permisos, mostrar solo el formulario
  if (permisos.length === 0 || mostrarFormulario) {
    return (
      <div className="flex-1 overflow-auto p-6 md:p-8">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-white mb-2 font-['Poppins'] flex items-center gap-3">
              <FileCheck className="w-10 h-10 text-[#00c8ff]" />
              Permisos de Salida
            </h1>
            <p className="text-white/60 font-['Inter']">
              Genera permisos de salida para tu hijo/a
            </p>
          </div>

          <form onSubmit={handleSubmit}>
          <Card className="backdrop-blur-md bg-white/5 border-white/10">
            <CardHeader>
              <CardTitle className="text-white font-['Poppins']">Nuevo Permiso de Salida</CardTitle>
              <CardDescription className="text-white/60 font-['Inter']">
                Completa la información requerida para generar el permiso
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Tipo de Permiso */}
              <div className="space-y-3">
                <Label htmlFor="tipoPermiso" className="text-white font-['Inter'] text-base flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-[#00c8ff]" />
                  Tipo de Permiso *
                </Label>
                <Select
                  value={formData.tipoPermiso}
                  onValueChange={(value) => handleChange('tipoPermiso', value)}
                >
                  <SelectTrigger
                    id="tipoPermiso"
                    className="bg-white/5 border-white/10 text-white focus:ring-[#00c8ff] h-12 font-['Inter']"
                  >
                    <SelectValue placeholder="Selecciona el tipo de permiso" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#0a0a2a] border-white/10">
                    <SelectItem value="ruta-a-carro" className="text-white focus:bg-[#00c8ff]/20">
                      De ruta a carro
                    </SelectItem>
                    <SelectItem value="carro-a-ruta" className="text-white focus:bg-[#00c8ff]/20">
                      De carro a ruta
                    </SelectItem>
                    <SelectItem value="ruta-a-ruta" className="text-white focus:bg-[#00c8ff]/20">
                      De ruta a ruta
                    </SelectItem>
                    <SelectItem value="carro-a-carro" className="text-white focus:bg-[#00c8ff]/20">
                      De carro a carro
                    </SelectItem>
                    <SelectItem value="salida-caminando" className="text-white focus:bg-[#00c8ff]/20">
                      Salida caminando
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Nombre del Estudiante */}
              <div className="space-y-3">
                <Label htmlFor="nombreEstudiante" className="text-white font-['Inter'] text-base flex items-center gap-2">
                  <User className="w-4 h-4 text-[#00c8ff]" />
                  Nombre del Estudiante *
                </Label>
                <Input
                  id="nombreEstudiante"
                  type="text"
                  placeholder="Ingresa el nombre completo del estudiante"
                  value={formData.nombreEstudiante}
                  onChange={(e) => handleChange('nombreEstudiante', e.target.value)}
                  className="bg-white/5 border-white/10 text-white placeholder:text-white/40 h-12 font-['Inter'] focus:ring-2 focus:ring-[#00c8ff]"
                />
              </div>

              {/* Fecha */}
              <div className="space-y-3">
                <Label htmlFor="fecha" className="text-white font-['Inter'] text-base flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-[#00c8ff]" />
                  Fecha *
                </Label>
                <Input
                  id="fecha"
                  type="date"
                  value={formData.fecha}
                  onChange={(e) => handleChange('fecha', e.target.value)}
                  className="bg-white/5 border-white/10 text-white h-12 font-['Inter'] focus:ring-2 focus:ring-[#00c8ff] max-w-md"
                />
              </div>

              {/* Campos Condicionales */}
              {tipoPermiso && tipoPermiso !== 'salida-caminando' && (
                <div className="space-y-6 pt-4 border-t border-white/10">
                  {/* Número de Ruta Actual */}
                  {necesitaRutaActual && (
                    <div className="space-y-3">
                      <Label htmlFor="numeroRutaActual" className="text-white font-['Inter'] text-base flex items-center gap-2">
                        <Bus className="w-4 h-4 text-[#00c8ff]" />
                        Número de Ruta Actual *
                      </Label>
                      <Input
                        id="numeroRutaActual"
                        type="text"
                        placeholder="Ej: Ruta 5"
                        value={formData.numeroRutaActual}
                        onChange={(e) => handleChange('numeroRutaActual', e.target.value)}
                        className="bg-white/5 border-white/10 text-white placeholder:text-white/40 h-12 font-['Inter'] focus:ring-2 focus:ring-[#00c8ff]"
                      />
                    </div>
                  )}

                  {/* Número de Ruta a la que Cambia */}
                  {necesitaRutaCambio && (
                    <div className="space-y-3">
                      <Label htmlFor="numeroRutaCambio" className="text-white font-['Inter'] text-base flex items-center gap-2">
                        <Bus className="w-4 h-4 text-[#00c8ff]" />
                        Número de Ruta a la que Cambia *
                      </Label>
                      <Input
                        id="numeroRutaCambio"
                        type="text"
                        placeholder="Ej: Ruta 8"
                        value={formData.numeroRutaCambio}
                        onChange={(e) => handleChange('numeroRutaCambio', e.target.value)}
                        className="bg-white/5 border-white/10 text-white placeholder:text-white/40 h-12 font-['Inter'] focus:ring-2 focus:ring-[#00c8ff]"
                      />
                    </div>
                  )}

                  {/* Placa de Carro Actual */}
                  {necesitaPlacaActual && (
                    <div className="space-y-3">
                      <Label htmlFor="placaCarroActual" className="text-white font-['Inter'] text-base flex items-center gap-2">
                        <Car className="w-4 h-4 text-[#00c8ff]" />
                        Placa de Carro Actual *
                      </Label>
                      <Input
                        id="placaCarroActual"
                        type="text"
                        placeholder="Ej: ABC123"
                        value={formData.placaCarroActual}
                        onChange={(e) => handleChange('placaCarroActual', e.target.value.toUpperCase())}
                        className="bg-white/5 border-white/10 text-white placeholder:text-white/40 h-12 font-['Inter'] focus:ring-2 focus:ring-[#00c8ff] uppercase"
                      />
                    </div>
                  )}

                  {/* Datos del Vehículo y Conductor */}
                  {necesitaDatosCarro && (
                    <>
                      <div className="space-y-3">
                        <Label htmlFor="placaCarroSalida" className="text-white font-['Inter'] text-base flex items-center gap-2">
                          <Car className="w-4 h-4 text-[#00c8ff]" />
                          Placa del Carro en el que Sale *
                        </Label>
                        <Input
                          id="placaCarroSalida"
                          type="text"
                          placeholder="Ej: XYZ789"
                          value={formData.placaCarroSalida}
                          onChange={(e) => handleChange('placaCarroSalida', e.target.value.toUpperCase())}
                          className="bg-white/5 border-white/10 text-white placeholder:text-white/40 h-12 font-['Inter'] focus:ring-2 focus:ring-[#00c8ff] uppercase"
                        />
                      </div>

                      <div className="space-y-3">
                        <Label htmlFor="nombreConductor" className="text-white font-['Inter'] text-base flex items-center gap-2">
                          <UserCheck className="w-4 h-4 text-[#00c8ff]" />
                          Nombre de quien Maneja el Carro *
                        </Label>
                        <Input
                          id="nombreConductor"
                          type="text"
                          placeholder="Nombre completo del conductor"
                          value={formData.nombreConductor}
                          onChange={(e) => handleChange('nombreConductor', e.target.value)}
                          className="bg-white/5 border-white/10 text-white placeholder:text-white/40 h-12 font-['Inter'] focus:ring-2 focus:ring-[#00c8ff]"
                        />
                      </div>

                      <div className="space-y-3">
                        <Label htmlFor="cedulaConductor" className="text-white font-['Inter'] text-base flex items-center gap-2">
                          <Hash className="w-4 h-4 text-[#00c8ff]" />
                          Cédula de quien Maneja el Carro *
                        </Label>
                        <Input
                          id="cedulaConductor"
                          type="text"
                          placeholder="Número de cédula"
                          value={formData.cedulaConductor}
                          onChange={(e) => handleChange('cedulaConductor', e.target.value)}
                          className="bg-white/5 border-white/10 text-white placeholder:text-white/40 h-12 font-['Inter'] focus:ring-2 focus:ring-[#00c8ff]"
                        />
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Botones */}
              <div className="flex justify-end gap-4 pt-6 border-t border-white/10">
                <Button
                  type="button"
                  variant="outline"
                  className="border-white/20 text-white hover:bg-white/10 font-['Inter']"
                  onClick={() => {
                    setFormData({
                      tipoPermiso: '',
                      nombreEstudiante: '',
                      fecha: '',
                      numeroRutaActual: '',
                      numeroRutaCambio: '',
                      placaCarroSalida: '',
                      nombreConductor: '',
                      cedulaConductor: '',
                      placaCarroActual: '',
                    });
                  }}
                >
                  Limpiar
                </Button>
                <Button
                  type="submit"
                  className="bg-gradient-to-r from-[#002366] to-[#1e3cff] hover:opacity-90 text-white font-['Inter']"
                >
                  <FileCheck className="w-4 h-4 mr-2" />
                  Generar Permiso
                </Button>
              </div>
            </CardContent>
          </Card>
        </form>
      </div>
    </div>
    );
  }

  // Si hay permisos, mostrar dos paneles
  return (
    <div className="flex-1 overflow-auto p-6 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2 font-['Poppins'] flex items-center gap-3">
            <FileCheck className="w-10 h-10 text-[#00c8ff]" />
            Permisos de Salida
          </h1>
          <p className="text-white/60 font-['Inter']">
            Gestiona los permisos de salida para tu hijo/a
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Panel: Crear Permiso */}
          <Card className="backdrop-blur-md bg-white/5 border-white/10">
            <CardHeader>
              <CardTitle className="text-white font-['Poppins'] flex items-center gap-2">
                <Plus className="w-5 h-5 text-[#00c8ff]" />
                Crear Permiso
              </CardTitle>
              <CardDescription className="text-white/60 font-['Inter']">
                Genera un nuevo permiso de salida
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                onClick={() => setMostrarFormulario(true)}
                className="w-full bg-gradient-to-r from-[#002366] to-[#1e3cff] hover:opacity-90 text-white font-['Inter'] h-12"
              >
                <Plus className="w-4 h-4 mr-2" />
                Nuevo Permiso
              </Button>
            </CardContent>
          </Card>

          {/* Panel: Próximos Permisos */}
          <Card className="backdrop-blur-md bg-white/5 border-white/10">
            <CardHeader>
              <CardTitle className="text-white font-['Poppins'] flex items-center gap-2">
                <Clock className="w-5 h-5 text-[#00c8ff]" />
                Próximos Permisos
              </CardTitle>
              <CardDescription className="text-white/60 font-['Inter']">
                {permisosProximos.length > 0 
                  ? `${permisosProximos.length} permiso(s) programado(s)`
                  : 'No hay permisos próximos'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {permisosProximos.length > 0 ? (
                <div className="space-y-4 max-h-96 overflow-y-auto">
                  {permisosProximos.map((permiso) => (
                    <div
                      key={permiso.id}
                      className="p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge className="bg-[#00c8ff]/20 text-white border border-[#00c8ff]/40 font-['Inter']">
                              {getTipoPermisoLabel(permiso.tipoPermiso as TipoPermiso)}
                            </Badge>
                          </div>
                          <p className="text-white font-medium font-['Inter']">{permiso.nombreEstudiante}</p>
                          <p className="text-white/60 text-sm font-['Inter'] mt-1">
                            <Calendar className="w-3 h-3 inline mr-1" />
                            {new Date(permiso.fecha).toLocaleDateString('es-CO', {
                              weekday: 'long',
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric'
                            })}
                          </p>
                        </div>
                      </div>
                      {permiso.numeroRutaActual && (
                        <p className="text-white/50 text-xs font-['Inter'] mt-2">
                          <Bus className="w-3 h-3 inline mr-1" />
                          Ruta actual: {permiso.numeroRutaActual}
                        </p>
                      )}
                      {permiso.numeroRutaCambio && (
                        <p className="text-white/50 text-xs font-['Inter']">
                          <Bus className="w-3 h-3 inline mr-1" />
                          Ruta destino: {permiso.numeroRutaCambio}
                        </p>
                      )}
                      {permiso.placaCarroSalida && (
                        <p className="text-white/50 text-xs font-['Inter']">
                          <Car className="w-3 h-3 inline mr-1" />
                          Placa: {permiso.placaCarroSalida}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-white/40 font-['Inter']">
                  No hay permisos próximos programados
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Formulario modal cuando se hace clic en "Nuevo Permiso" */}
        {mostrarFormulario && (
          <div className="mt-6">
            <Card className="backdrop-blur-md bg-white/5 border-white/10">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-white font-['Poppins']">Nuevo Permiso de Salida</CardTitle>
                    <CardDescription className="text-white/60 font-['Inter']">
                      Completa la información requerida para generar el permiso
                    </CardDescription>
                  </div>
                  <Button
                    variant="ghost"
                    onClick={() => setMostrarFormulario(false)}
                    className="text-white/60 hover:text-white"
                  >
                    ×
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* Tipo de Permiso */}
                  <div className="space-y-3">
                    <Label htmlFor="tipoPermiso-modal" className="text-white font-['Inter'] text-base flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-[#00c8ff]" />
                      Tipo de Permiso *
                    </Label>
                    <Select
                      value={formData.tipoPermiso}
                      onValueChange={(value) => handleChange('tipoPermiso', value)}
                    >
                      <SelectTrigger
                        id="tipoPermiso-modal"
                        className="bg-white/5 border-white/10 text-white focus:ring-[#00c8ff] h-12 font-['Inter']"
                      >
                        <SelectValue placeholder="Selecciona el tipo de permiso" />
                      </SelectTrigger>
                      <SelectContent className="bg-[#0a0a2a] border-white/10">
                        <SelectItem value="ruta-a-carro" className="text-white focus:bg-[#00c8ff]/20">
                          De ruta a carro
                        </SelectItem>
                        <SelectItem value="carro-a-ruta" className="text-white focus:bg-[#00c8ff]/20">
                          De carro a ruta
                        </SelectItem>
                        <SelectItem value="ruta-a-ruta" className="text-white focus:bg-[#00c8ff]/20">
                          De ruta a ruta
                        </SelectItem>
                        <SelectItem value="carro-a-carro" className="text-white focus:bg-[#00c8ff]/20">
                          De carro a carro
                        </SelectItem>
                        <SelectItem value="salida-caminando" className="text-white focus:bg-[#00c8ff]/20">
                          Salida caminando
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Nombre del Estudiante */}
                  <div className="space-y-3">
                    <Label htmlFor="nombreEstudiante-modal" className="text-white font-['Inter'] text-base flex items-center gap-2">
                      <User className="w-4 h-4 text-[#00c8ff]" />
                      Nombre del Estudiante *
                    </Label>
                    <Input
                      id="nombreEstudiante-modal"
                      type="text"
                      placeholder="Ingresa el nombre completo del estudiante"
                      value={formData.nombreEstudiante}
                      onChange={(e) => handleChange('nombreEstudiante', e.target.value)}
                      className="bg-white/5 border-white/10 text-white placeholder:text-white/40 h-12 font-['Inter'] focus:ring-2 focus:ring-[#00c8ff]"
                    />
                  </div>

                  {/* Fecha */}
                  <div className="space-y-3">
                    <Label htmlFor="fecha-modal" className="text-white font-['Inter'] text-base flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-[#00c8ff]" />
                      Fecha *
                    </Label>
                    <Input
                      id="fecha-modal"
                      type="date"
                      value={formData.fecha}
                      onChange={(e) => handleChange('fecha', e.target.value)}
                      className="bg-white/5 border-white/10 text-white h-12 font-['Inter'] focus:ring-2 focus:ring-[#00c8ff] max-w-md"
                    />
                  </div>

                  {/* Campos Condicionales */}
                  {tipoPermiso && tipoPermiso !== 'salida-caminando' && (
                    <div className="space-y-6 pt-4 border-t border-white/10">
                      {/* Número de Ruta Actual */}
                      {necesitaRutaActual && (
                        <div className="space-y-3">
                          <Label htmlFor="numeroRutaActual-modal" className="text-white font-['Inter'] text-base flex items-center gap-2">
                            <Bus className="w-4 h-4 text-[#00c8ff]" />
                            Número de Ruta Actual *
                          </Label>
                          <Input
                            id="numeroRutaActual-modal"
                            type="text"
                            placeholder="Ej: Ruta 5"
                            value={formData.numeroRutaActual}
                            onChange={(e) => handleChange('numeroRutaActual', e.target.value)}
                            className="bg-white/5 border-white/10 text-white placeholder:text-white/40 h-12 font-['Inter'] focus:ring-2 focus:ring-[#00c8ff]"
                          />
                        </div>
                      )}

                      {/* Número de Ruta a la que Cambia */}
                      {necesitaRutaCambio && (
                        <div className="space-y-3">
                          <Label htmlFor="numeroRutaCambio-modal" className="text-white font-['Inter'] text-base flex items-center gap-2">
                            <Bus className="w-4 h-4 text-[#00c8ff]" />
                            Número de Ruta a la que Cambia *
                          </Label>
                          <Input
                            id="numeroRutaCambio-modal"
                            type="text"
                            placeholder="Ej: Ruta 8"
                            value={formData.numeroRutaCambio}
                            onChange={(e) => handleChange('numeroRutaCambio', e.target.value)}
                            className="bg-white/5 border-white/10 text-white placeholder:text-white/40 h-12 font-['Inter'] focus:ring-2 focus:ring-[#00c8ff]"
                          />
                        </div>
                      )}

                      {/* Placa de Carro Actual */}
                      {necesitaPlacaActual && (
                        <div className="space-y-3">
                          <Label htmlFor="placaCarroActual-modal" className="text-white font-['Inter'] text-base flex items-center gap-2">
                            <Car className="w-4 h-4 text-[#00c8ff]" />
                            Placa de Carro Actual *
                          </Label>
                          <Input
                            id="placaCarroActual-modal"
                            type="text"
                            placeholder="Ej: ABC123"
                            value={formData.placaCarroActual}
                            onChange={(e) => handleChange('placaCarroActual', e.target.value.toUpperCase())}
                            className="bg-white/5 border-white/10 text-white placeholder:text-white/40 h-12 font-['Inter'] focus:ring-2 focus:ring-[#00c8ff] uppercase"
                          />
                        </div>
                      )}

                      {/* Datos del Vehículo y Conductor */}
                      {necesitaDatosCarro && (
                        <>
                          <div className="space-y-3">
                            <Label htmlFor="placaCarroSalida-modal" className="text-white font-['Inter'] text-base flex items-center gap-2">
                              <Car className="w-4 h-4 text-[#00c8ff]" />
                              Placa del Carro en el que Sale *
                            </Label>
                            <Input
                              id="placaCarroSalida-modal"
                              type="text"
                              placeholder="Ej: XYZ789"
                              value={formData.placaCarroSalida}
                              onChange={(e) => handleChange('placaCarroSalida', e.target.value.toUpperCase())}
                              className="bg-white/5 border-white/10 text-white placeholder:text-white/40 h-12 font-['Inter'] focus:ring-2 focus:ring-[#00c8ff] uppercase"
                            />
                          </div>

                          <div className="space-y-3">
                            <Label htmlFor="nombreConductor-modal" className="text-white font-['Inter'] text-base flex items-center gap-2">
                              <UserCheck className="w-4 h-4 text-[#00c8ff]" />
                              Nombre de quien Maneja el Carro *
                            </Label>
                            <Input
                              id="nombreConductor-modal"
                              type="text"
                              placeholder="Nombre completo del conductor"
                              value={formData.nombreConductor}
                              onChange={(e) => handleChange('nombreConductor', e.target.value)}
                              className="bg-white/5 border-white/10 text-white placeholder:text-white/40 h-12 font-['Inter'] focus:ring-2 focus:ring-[#00c8ff]"
                            />
                          </div>

                          <div className="space-y-3">
                            <Label htmlFor="cedulaConductor-modal" className="text-white font-['Inter'] text-base flex items-center gap-2">
                              <Hash className="w-4 h-4 text-[#00c8ff]" />
                              Cédula de quien Maneja el Carro *
                            </Label>
                            <Input
                              id="cedulaConductor-modal"
                              type="text"
                              placeholder="Número de cédula"
                              value={formData.cedulaConductor}
                              onChange={(e) => handleChange('cedulaConductor', e.target.value)}
                              className="bg-white/5 border-white/10 text-white placeholder:text-white/40 h-12 font-['Inter'] focus:ring-2 focus:ring-[#00c8ff]"
                            />
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {/* Botones */}
                  <div className="flex justify-end gap-4 pt-6 border-t border-white/10">
                    <Button
                      type="button"
                      variant="outline"
                      className="border-white/20 text-white hover:bg-white/10 font-['Inter']"
                      onClick={() => {
                        setFormData({
                          tipoPermiso: '',
                          nombreEstudiante: '',
                          fecha: '',
                          numeroRutaActual: '',
                          numeroRutaCambio: '',
                          placaCarroSalida: '',
                          nombreConductor: '',
                          cedulaConductor: '',
                          placaCarroActual: '',
                        });
                        setMostrarFormulario(false);
                      }}
                    >
                      Cancelar
                    </Button>
                    <Button
                      type="submit"
                      className="bg-gradient-to-r from-[#002366] to-[#1e3cff] hover:opacity-90 text-white font-['Inter']"
                    >
                      <FileCheck className="w-4 h-4 mr-2" />
                      Generar Permiso
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
