import React, { useState, useEffect } from 'react';
import { useAuth } from '@/lib/authContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { 
  User, 
  Mail, 
  GraduationCap, 
  Shield, 
  FileText, 
  Phone, 
  MapPin, 
  Calendar,
  Users,
  Plus,
  X,
  Hash
} from 'lucide-react';

const InformacionPersonal: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  
  // Obtener información personal del usuario (estudiante)
  const { data: userProfile, isLoading: isLoadingProfile } = useQuery({
    queryKey: ['studentProfile', user?.id],
    queryFn: () => apiRequest('GET', '/api/student/profile'),
    enabled: !!user?.id && user?.rol === 'estudiante',
  });

  // Para padre: hijos vinculados y sus perfiles (datos del estudiante compartidos)
  const { data: hijos = [] } = useQuery<{ _id: string; nombre: string; correo?: string; curso?: string }[]>({
    queryKey: ['/api/users/me/hijos'],
    queryFn: () => apiRequest('GET', '/api/users/me/hijos'),
    enabled: !!user?.id && user?.rol === 'padre',
  });
  const hijosProfiles = useQuery({
    queryKey: ['hijosProfiles', hijos.map((h) => h._id).join(',')],
    queryFn: async () => {
      const results = await Promise.all(
        hijos.map((h) => apiRequest<Record<string, unknown>>('GET', `/api/student/hijo/${h._id}/profile`).catch(() => null))
      );
      return results;
    },
    enabled: !!user?.id && user?.rol === 'padre' && hijos.length > 0,
  });
  const perfilesHijos = (hijosProfiles.data ?? []).filter(Boolean) as Array<{
    _id: string;
    nombre: string;
    email?: string;
    curso?: string;
    telefono?: string;
    celular?: string;
    direccion?: string;
    barrio?: string;
    ciudad?: string;
    fechaNacimiento?: string;
    userId?: string;
    codigoUnico?: string;
  }>;

  // Estado para información personal editable
  const [personalInfo, setPersonalInfo] = useState({
    tipoDocumento: '',
    numeroDocumento: '',
    ciudadDocumento: '',
    telefono: '',
    celular: '',
    direccion: '',
    barrio: '',
    ciudad: '',
    fechaNacimiento: '',
  });

  // Cargar información personal cuando se obtiene del backend
  useEffect(() => {
    if (userProfile) {
      setPersonalInfo({
        tipoDocumento: '',
        numeroDocumento: '',
        ciudadDocumento: '',
        telefono: userProfile.telefono || '',
        celular: userProfile.celular || '',
        direccion: userProfile.direccion || '',
        barrio: userProfile.barrio || '',
        ciudad: userProfile.ciudad || '',
        fechaNacimiento: userProfile.fechaNacimiento 
          ? new Date(userProfile.fechaNacimiento).toISOString().split('T')[0]
          : '',
      });
    }
  }, [userProfile]);

  // Estado para información de familia
  const [familiaInfo, setFamiliaInfo] = useState({
    nombreFamilia: '',
    codigoFamilia: '',
    familiares: [] as Array<{ nombre: string; relacion: string; telefono: string }>,
  });

  // Estado para nuevo familiar
  const [nuevoFamiliar, setNuevoFamiliar] = useState({
    nombre: '',
    relacion: '',
    telefono: '',
  });

  const handlePersonalInfoChange = (field: string, value: string) => {
    setPersonalInfo(prev => ({ ...prev, [field]: value }));
  };

  const handleFamiliaInfoChange = (field: string, value: string) => {
    setFamiliaInfo(prev => ({ ...prev, [field]: value }));
  };

  const handleAddFamiliar = () => {
    if (nuevoFamiliar.nombre && nuevoFamiliar.relacion) {
      setFamiliaInfo(prev => ({
        ...prev,
        familiares: [...prev.familiares, nuevoFamiliar],
      }));
      setNuevoFamiliar({ nombre: '', relacion: '', telefono: '' });
    }
  };

  const handleRemoveFamiliar = (index: number) => {
    setFamiliaInfo(prev => ({
      ...prev,
      familiares: prev.familiares.filter((_, i) => i !== index),
    }));
  };

  // Mutación para guardar información personal
  const savePersonalInfoMutation = useMutation({
    mutationFn: async (data: {
      telefono?: string;
      celular?: string;
      direccion?: string;
      barrio?: string;
      ciudad?: string;
      fechaNacimiento?: string;
    }) => {
      return apiRequest('PUT', '/api/student/profile', data);
    },
    onSuccess: () => {
      toast({
        title: 'Información guardada',
        description: 'Tu información personal se ha guardado correctamente.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error?.response?.data?.message || 'No se pudo guardar la información.',
        variant: 'destructive',
      });
    },
  });

  const handleSave = () => {
    if (user?.rol !== 'estudiante') {
      toast({
        title: 'Error',
        description: 'Solo los estudiantes pueden guardar información personal.',
        variant: 'destructive',
      });
      return;
    }

    savePersonalInfoMutation.mutate({
      telefono: personalInfo.telefono || undefined,
      celular: personalInfo.celular || undefined,
      direccion: personalInfo.direccion || undefined,
      barrio: personalInfo.barrio || undefined,
      ciudad: personalInfo.ciudad || undefined,
      fechaNacimiento: personalInfo.fechaNacimiento || undefined,
    });
  };

  return (
    <div className="flex-1 overflow-auto p-6 md:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-white mb-2 font-['Poppins']">
          Información Personal
        </h1>
          <p className="text-white/60 font-['Inter']">
            Completa y gestiona tus datos personales
          </p>
        </div>

        <div className="space-y-6">
          {/* Sección 1: Información Básica (Precargada - No Editable) */}
          <Card className="backdrop-blur-md bg-white/5 border-white/10">
            <CardHeader>
              <CardTitle className="text-white font-['Poppins'] flex items-center gap-2">
                <Shield className="w-5 h-5 text-[#00c8ff]" />
                Información Básica
              </CardTitle>
              <CardDescription className="text-white/60 font-['Inter']">
                Datos precargados desde tu cuenta
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center gap-4 p-4 rounded-xl bg-white/5 border border-white/10">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-gradient-to-br from-[#002366] to-[#1e3cff] flex-shrink-0">
                    <User className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <Label className="text-white/60 text-sm font-['Inter']">Nombre completo</Label>
                    <p className="text-white font-medium font-['Inter'] truncate">{user?.nombre || '—'}</p>
                  </div>
                </div>

                <div className="flex items-center gap-4 p-4 rounded-xl bg-white/5 border border-white/10">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-gradient-to-br from-[#002366] to-[#1e3cff] flex-shrink-0">
                    <Mail className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <Label className="text-white/60 text-sm font-['Inter']">Correo institucional</Label>
                    <p className="text-white font-medium font-['Inter'] truncate">{user?.email || '—'}</p>
                  </div>
                </div>

                <div className="flex items-center gap-4 p-4 rounded-xl bg-white/5 border border-white/10">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-gradient-to-br from-[#002366] to-[#1e3cff] flex-shrink-0">
                    <Hash className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <Label className="text-white/60 text-sm font-['Inter']">Código único</Label>
                    <p className="text-white font-medium font-['Inter'] font-mono text-lg">
                      {user?.codigoUnico || '—'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4 p-4 rounded-xl bg-white/5 border border-white/10">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-gradient-to-br from-[#002366] to-[#1e3cff] flex-shrink-0">
                    <GraduationCap className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <Label className="text-white/60 text-sm font-['Inter']">Curso actual</Label>
                    <p className="text-white font-medium font-['Inter']">{user?.curso || '—'}</p>
                  </div>
                </div>

                <div className="flex items-center gap-4 p-4 rounded-xl bg-white/5 border border-white/10">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-gradient-to-br from-[#002366] to-[#1e3cff] flex-shrink-0">
                    <Shield className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <Label className="text-white/60 text-sm font-['Inter']">Rol</Label>
                    <p className="text-white font-medium font-['Inter'] capitalize">{user?.rol || '—'}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Sección 2: Información Personal Editable */}
          <Card className="backdrop-blur-md bg-white/5 border-white/10">
            <CardHeader>
              <CardTitle className="text-white font-['Poppins'] flex items-center gap-2">
                <FileText className="w-5 h-5 text-[#00c8ff]" />
                Información Personal
              </CardTitle>
              <CardDescription className="text-white/60 font-['Inter']">
                Completa tus datos personales
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Documento */}
              <div className="space-y-4">
                <Label className="text-white font-['Inter'] text-base">Documento de Identidad</Label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="tipoDocumento" className="text-white/70 text-sm font-['Inter'] mb-2 block">
                      Tipo de documento
                    </Label>
                    <Select
                      value={personalInfo.tipoDocumento}
                      onValueChange={(value) => handlePersonalInfoChange('tipoDocumento', value)}
                    >
                      <SelectTrigger className="bg-white/5 border-white/10 text-white h-11 font-['Inter']">
                        <SelectValue placeholder="Selecciona" />
                      </SelectTrigger>
                      <SelectContent className="bg-[#0a0a2a] border-white/10">
                        <SelectItem value="cc" className="text-white">Cédula de Ciudadanía</SelectItem>
                        <SelectItem value="ti" className="text-white">Tarjeta de Identidad</SelectItem>
                        <SelectItem value="ce" className="text-white">Cédula de Extranjería</SelectItem>
                        <SelectItem value="pa" className="text-white">Pasaporte</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="numeroDocumento" className="text-white/70 text-sm font-['Inter'] mb-2 block">
                      Número de documento
                    </Label>
                    <Input
                      id="numeroDocumento"
                      type="text"
                      placeholder="Ingresa el número"
                      value={personalInfo.numeroDocumento}
                      onChange={(e) => handlePersonalInfoChange('numeroDocumento', e.target.value)}
                      className="bg-white/5 border-white/10 text-white placeholder:text-white/40 h-11 font-['Inter'] focus:ring-2 focus:ring-[#00c8ff]"
                    />
                  </div>
                  <div>
                    <Label htmlFor="ciudadDocumento" className="text-white/70 text-sm font-['Inter'] mb-2 block">
                      Ciudad de expedición
                    </Label>
                    <Input
                      id="ciudadDocumento"
                      type="text"
                      placeholder="Ciudad"
                      value={personalInfo.ciudadDocumento}
                      onChange={(e) => handlePersonalInfoChange('ciudadDocumento', e.target.value)}
                      className="bg-white/5 border-white/10 text-white placeholder:text-white/40 h-11 font-['Inter'] focus:ring-2 focus:ring-[#00c8ff]"
                    />
                  </div>
                </div>
              </div>

              {/* Contacto */}
              <div className="space-y-4">
                <Label className="text-white font-['Inter'] text-base">Contacto</Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="telefono" className="text-white/70 text-sm font-['Inter'] mb-2 block">
                      Teléfono fijo
                    </Label>
                    <Input
                      id="telefono"
                      type="tel"
                      placeholder="Ej: 6012345678"
                      value={personalInfo.telefono}
                      onChange={(e) => handlePersonalInfoChange('telefono', e.target.value)}
                      className="bg-white/5 border-white/10 text-white placeholder:text-white/40 h-11 font-['Inter'] focus:ring-2 focus:ring-[#00c8ff]"
                    />
                  </div>
                  <div>
                    <Label htmlFor="celular" className="text-white/70 text-sm font-['Inter'] mb-2 block">
                      Celular
                    </Label>
                    <Input
                      id="celular"
                      type="tel"
                      placeholder="Ej: 3001234567"
                      value={personalInfo.celular}
                      onChange={(e) => handlePersonalInfoChange('celular', e.target.value)}
                      className="bg-white/5 border-white/10 text-white placeholder:text-white/40 h-11 font-['Inter'] focus:ring-2 focus:ring-[#00c8ff]"
                    />
                  </div>
                </div>
              </div>

              {/* Dirección */}
              <div className="space-y-4">
                <Label className="text-white font-['Inter'] text-base">Dirección</Label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="md:col-span-3">
                    <Label htmlFor="direccion" className="text-white/70 text-sm font-['Inter'] mb-2 block">
                      Dirección
                    </Label>
                    <Input
                      id="direccion"
                      type="text"
                      placeholder="Calle, carrera, número, etc."
                      value={personalInfo.direccion}
                      onChange={(e) => handlePersonalInfoChange('direccion', e.target.value)}
                      className="bg-white/5 border-white/10 text-white placeholder:text-white/40 h-11 font-['Inter'] focus:ring-2 focus:ring-[#00c8ff]"
                    />
                  </div>
                  <div>
                    <Label htmlFor="barrio" className="text-white/70 text-sm font-['Inter'] mb-2 block">
                      Barrio
                    </Label>
                    <Input
                      id="barrio"
                      type="text"
                      placeholder="Nombre del barrio"
                      value={personalInfo.barrio}
                      onChange={(e) => handlePersonalInfoChange('barrio', e.target.value)}
                      className="bg-white/5 border-white/10 text-white placeholder:text-white/40 h-11 font-['Inter'] focus:ring-2 focus:ring-[#00c8ff]"
                    />
                  </div>
                  <div>
                    <Label htmlFor="ciudad" className="text-white/70 text-sm font-['Inter'] mb-2 block">
                      Ciudad
                    </Label>
                    <Input
                      id="ciudad"
                      type="text"
                      placeholder="Ciudad"
                      value={personalInfo.ciudad}
                      onChange={(e) => handlePersonalInfoChange('ciudad', e.target.value)}
                      className="bg-white/5 border-white/10 text-white placeholder:text-white/40 h-11 font-['Inter'] focus:ring-2 focus:ring-[#00c8ff]"
                    />
                  </div>
                </div>
              </div>

              {/* Fecha de Nacimiento */}
              <div className="space-y-4">
                <Label htmlFor="fechaNacimiento" className="text-white font-['Inter'] text-base">
                  Fecha de Nacimiento
                </Label>
                <Input
                  id="fechaNacimiento"
                  type="date"
                  value={personalInfo.fechaNacimiento}
                  onChange={(e) => handlePersonalInfoChange('fechaNacimiento', e.target.value)}
                  className="bg-white/5 border-white/10 text-white h-11 font-['Inter'] focus:ring-2 focus:ring-[#00c8ff] max-w-md"
                />
              </div>
            </CardContent>
          </Card>

          {/* Sección 3: Información familiar (padre = datos del estudiante vinculado; otros = formulario familia) */}
          <Card className="backdrop-blur-md bg-white/5 border-white/10">
            <CardHeader>
              <CardTitle className="text-white font-['Poppins'] flex items-center gap-2">
                <Users className="w-5 h-5 text-[#00c8ff]" />
                Información Familiar
              </CardTitle>
              <CardDescription className="text-white/60 font-['Inter']">
                {user?.rol === 'padre'
                  ? 'Datos del estudiante vinculado a tu cuenta (solo visualización)'
                  : 'Datos de tu familia'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {user?.rol === 'padre' ? (
                hijosProfiles.isLoading || !perfilesHijos.length ? (
                  <div className="text-center py-8 text-white/40 font-['Inter']">
                    {hijosProfiles.isLoading ? 'Cargando información del estudiante...' : 'No hay estudiantes vinculados a tu cuenta.'}
                  </div>
                ) : (
                  <div className="space-y-6">
                    {perfilesHijos.map((est) => (
                      <div key={est._id} className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-4">
                        <p className="text-white font-semibold font-['Poppins'] border-b border-white/10 pb-2">
                          {est.nombre}
                        </p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <Label className="text-white/60 text-sm font-['Inter'] mb-1 block">Correo</Label>
                            <p className="text-white font-['Inter']">{est.email || '—'}</p>
                          </div>
                          <div>
                            <Label className="text-white/60 text-sm font-['Inter'] mb-1 block">Curso / Grupo</Label>
                            <p className="text-white font-['Inter']">{est.curso || '—'}</p>
                          </div>
                          <div>
                            <Label className="text-white/60 text-sm font-['Inter'] mb-1 block">Teléfono</Label>
                            <p className="text-white font-['Inter']">{est.telefono || est.celular || '—'}</p>
                          </div>
                          <div>
                            <Label className="text-white/60 text-sm font-['Inter'] mb-1 block">Celular</Label>
                            <p className="text-white font-['Inter']">{est.celular || '—'}</p>
                          </div>
                          <div className="md:col-span-2">
                            <Label className="text-white/60 text-sm font-['Inter'] mb-1 block">Dirección</Label>
                            <p className="text-white font-['Inter']">{est.direccion || '—'}</p>
                          </div>
                          <div>
                            <Label className="text-white/60 text-sm font-['Inter'] mb-1 block">Barrio</Label>
                            <p className="text-white font-['Inter']">{est.barrio || '—'}</p>
                          </div>
                          <div>
                            <Label className="text-white/60 text-sm font-['Inter'] mb-1 block">Ciudad</Label>
                            <p className="text-white font-['Inter']">{est.ciudad || '—'}</p>
                          </div>
                          <div>
                            <Label className="text-white/60 text-sm font-['Inter'] mb-1 block">Fecha de nacimiento</Label>
                            <p className="text-white font-['Inter']">
                              {est.fechaNacimiento
                                ? new Date(est.fechaNacimiento).toLocaleDateString('es-CO')
                                : '—'}
                            </p>
                          </div>
                          <div>
                            <Label className="text-white/60 text-sm font-['Inter'] mb-1 block">Código único</Label>
                            <p className="text-white font-['Inter'] font-mono">{est.codigoUnico || '—'}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="nombreFamilia" className="text-white/70 text-sm font-['Inter'] mb-2 block">
                        Nombre de la familia
                      </Label>
                      <Input
                        id="nombreFamilia"
                        type="text"
                        placeholder="Ej: Familia García"
                        value={familiaInfo.nombreFamilia}
                        onChange={(e) => handleFamiliaInfoChange('nombreFamilia', e.target.value)}
                        className="bg-white/5 border-white/10 text-white placeholder:text-white/40 h-11 font-['Inter'] focus:ring-2 focus:ring-[#00c8ff]"
                      />
                    </div>
                    <div>
                      <Label htmlFor="codigoFamilia" className="text-white/70 text-sm font-['Inter'] mb-2 block">
                        Código de familia
                      </Label>
                      <Input
                        id="codigoFamilia"
                        type="text"
                        placeholder="Código único de familia"
                        value={familiaInfo.codigoFamilia}
                        onChange={(e) => handleFamiliaInfoChange('codigoFamilia', e.target.value)}
                        className="bg-white/5 border-white/10 text-white placeholder:text-white/40 h-11 font-['Inter'] focus:ring-2 focus:ring-[#00c8ff]"
                      />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <Label className="text-white font-['Inter'] text-base">Familiares</Label>
                    <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <Label htmlFor="familiarNombre" className="text-white/70 text-sm font-['Inter'] mb-2 block">Nombre completo</Label>
                          <Input
                            id="familiarNombre"
                            type="text"
                            placeholder="Nombre del familiar"
                            value={nuevoFamiliar.nombre}
                            onChange={(e) => setNuevoFamiliar(prev => ({ ...prev, nombre: e.target.value }))}
                            className="bg-white/5 border-white/10 text-white placeholder:text-white/40 h-11 font-['Inter'] focus:ring-2 focus:ring-[#00c8ff]"
                          />
                        </div>
                        <div>
                          <Label htmlFor="familiarRelacion" className="text-white/70 text-sm font-['Inter'] mb-2 block">Relación</Label>
                          <Select
                            value={nuevoFamiliar.relacion}
                            onValueChange={(value) => setNuevoFamiliar(prev => ({ ...prev, relacion: value }))}
                          >
                            <SelectTrigger className="bg-white/5 border-white/10 text-white h-11 font-['Inter']">
                              <SelectValue placeholder="Selecciona" />
                            </SelectTrigger>
                            <SelectContent className="bg-[#0a0a2a] border-white/10">
                              <SelectItem value="padre" className="text-white">Padre</SelectItem>
                              <SelectItem value="madre" className="text-white">Madre</SelectItem>
                              <SelectItem value="acudiente" className="text-white">Acudiente</SelectItem>
                              <SelectItem value="hermano" className="text-white">Hermano/a</SelectItem>
                              <SelectItem value="otro" className="text-white">Otro</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label htmlFor="familiarTelefono" className="text-white/70 text-sm font-['Inter'] mb-2 block">Teléfono</Label>
                          <Input
                            id="familiarTelefono"
                            type="tel"
                            placeholder="Teléfono de contacto"
                            value={nuevoFamiliar.telefono}
                            onChange={(e) => setNuevoFamiliar(prev => ({ ...prev, telefono: e.target.value }))}
                            className="bg-white/5 border-white/10 text-white placeholder:text-white/40 h-11 font-['Inter'] focus:ring-2 focus:ring-[#00c8ff]"
                          />
                        </div>
                      </div>
                      <Button
                        onClick={handleAddFamiliar}
                        className="bg-gradient-to-r from-[#002366] to-[#1e3cff] hover:opacity-90 text-white font-['Inter']"
                      >
                        <Plus className="w-4 h-4" />
                        Agregar Familiar
                      </Button>
                    </div>

                    {familiaInfo.familiares.length > 0 ? (
                      <div className="space-y-3">
                        {familiaInfo.familiares.map((familiar, index) => (
                          <div
                            key={index}
                            className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10"
                          >
                            <div className="flex-1">
                              <p className="text-white font-medium font-['Inter']">{familiar.nombre}</p>
                              <div className="flex items-center gap-3 mt-1">
                                <Badge className="bg-[#00c8ff]/20 text-white border border-[#00c8ff]/40 font-['Inter'] capitalize">
                                  {familiar.relacion}
                                </Badge>
                                {familiar.telefono && (
                                  <span className="text-white/60 text-sm font-['Inter']">{familiar.telefono}</span>
                                )}
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleRemoveFamiliar(index)}
                              className="text-white/60 hover:text-white hover:bg-white/10"
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-white/40 font-['Inter']">
                        No hay familiares agregados aún
                      </div>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Sección 4: Grupos */}
      <Card className="backdrop-blur-md bg-white/5 border-white/10">
        <CardHeader>
              <CardTitle className="text-white font-['Poppins'] flex items-center gap-2">
                <Users className="w-5 h-5 text-[#00c8ff]" />
                Grupos Asignados
              </CardTitle>
              <CardDescription className="text-white/60 font-['Inter']">
                Grupos en los que participas
          </CardDescription>
        </CardHeader>
        <CardContent>
              {user?.curso ? (
                <div className="flex items-center gap-4 p-4 rounded-xl bg-white/5 border border-white/10">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-gradient-to-br from-[#002366] to-[#1e3cff]">
                    <GraduationCap className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <p className="text-white font-medium font-['Inter']">{user.curso}</p>
                    <p className="text-white/60 text-sm font-['Inter']">Curso actual</p>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-white/40 font-['Inter']">
                  No tienes grupos asignados
                </div>
              )}
        </CardContent>
      </Card>

          {/* Botón de Guardar (solo para estudiante) */}
          {user?.rol === 'estudiante' && (
            <div className="flex justify-end gap-4 pt-4">
              <Button
                variant="outline"
                className="border-white/20 text-white hover:bg-white/10 font-['Inter']"
                onClick={() => {
                  if (userProfile) {
                    setPersonalInfo({
                      tipoDocumento: '',
                      numeroDocumento: '',
                      ciudadDocumento: '',
                      telefono: userProfile.telefono || '',
                      celular: userProfile.celular || '',
                      direccion: userProfile.direccion || '',
                      barrio: userProfile.barrio || '',
                      ciudad: userProfile.ciudad || '',
                      fechaNacimiento: userProfile.fechaNacimiento 
                        ? new Date(userProfile.fechaNacimiento).toISOString().split('T')[0]
                        : '',
                    });
                  }
                }}
              >
                Cancelar
              </Button>
              <Button
                className="bg-gradient-to-r from-[#002366] to-[#1e3cff] hover:opacity-90 text-white font-['Inter']"
                onClick={handleSave}
                disabled={savePersonalInfoMutation.isPending || isLoadingProfile}
              >
                {savePersonalInfoMutation.isPending ? 'Guardando...' : 'Guardar Cambios'}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default InformacionPersonal;
