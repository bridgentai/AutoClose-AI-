import React, { useState, useMemo, useEffect } from 'react';
import { useAuth } from '@/lib/authContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useInstitutionColors } from '@/hooks/useInstitutionColors';
import { 
  Users, GraduationCap, BookOpen, UserPlus, Plus, Edit, Trash2, 
  X, Check, Settings, Bot, Link as LinkIcon, Eye, EyeOff,
  LayoutDashboard, UserCog, School, BookMarked, FileText, Brain, Search
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useLocation } from 'wouter';

const CARD_STYLE = `bg-white/5 border-white/10 backdrop-blur-md hover-elevate`;

interface User {
  _id: string;
  id: string;
  userId: string;
  nombre: string;
  email: string;
  curso?: string;
  estado: 'pending' | 'active' | 'suspended';
  codigoUnico?: string;
  telefono?: string;
  celular?: string;
  createdAt: string;
}

interface Stats {
  estudiantes: number;
  profesores: number;
  padres: number;
  directivos: number;
  cursos: number;
  materias: number;
}

export function AdminGeneralColegioDashboard() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { colorPrimario, colorSecundario } = useInstitutionColors();
  
  const [activeSection, setActiveSection] = useState<'dashboard' | 'usuarios' | 'cursos' | 'materias' | 'asignaciones' | 'ia' | 'config'>('dashboard');
  const [activeTab, setActiveTab] = useState<'estudiantes' | 'profesores' | 'padres' | 'directivos'>('estudiantes');
  const [searchTerm, setSearchTerm] = useState('');

  // Limpiar búsqueda cuando cambia el tab
  useEffect(() => {
    setSearchTerm('');
  }, [activeTab]);
  
  // Estados para diálogos
  const [createUserOpen, setCreateUserOpen] = useState(false);
  const [createUserType, setCreateUserType] = useState<'estudiante' | 'profesor' | 'padre' | 'curso'>('estudiante');
  const [editUserOpen, setEditUserOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [relacionOpen, setRelacionOpen] = useState(false);

  // Obtener estadísticas
  const { data: stats, isLoading: statsLoading } = useQuery<Stats>({
    queryKey: ['adminStats', user?.colegioId],
    queryFn: () => apiRequest<Stats>('GET', '/api/users/stats'),
    enabled: !!user?.colegioId && user?.rol === 'admin-general-colegio',
  });

  // Obtener usuarios por rol
  const { data: usuarios = [], isLoading: usuariosLoading } = useQuery<User[]>({
    queryKey: ['usuariosByRole', activeTab, user?.colegioId],
    queryFn: () => apiRequest<User[]>('GET', `/api/users/by-role?rol=${activeTab}`),
    enabled: !!user?.colegioId && user?.rol === 'admin-general-colegio',
  });

  // Filtrar usuarios según el término de búsqueda
  const usuariosFiltrados = useMemo(() => {
    if (!searchTerm.trim()) {
      return usuarios;
    }
    const termino = searchTerm.toLowerCase().trim();
    return usuarios.filter(usuario => 
      usuario.nombre.toLowerCase().includes(termino) ||
      usuario.email.toLowerCase().includes(termino) ||
      (usuario.curso && usuario.curso.toLowerCase().includes(termino))
    );
  }, [usuarios, searchTerm]);

  // Limpiar búsqueda cuando cambia el tab
  useEffect(() => {
    setSearchTerm('');
  }, [activeTab]);

  // Formulario para crear usuario
  const [newUser, setNewUser] = useState({
    nombre: '',
    email: '',
    password: '',
    curso: '',
    telefono: '',
    celular: '',
  });

  // Formulario para crear curso
  const [newCourse, setNewCourse] = useState({
    curso: '',
    seccion: '',
    directorGrupo: '',
  });

  // Obtener profesores para el selector de director de grupo
  const { data: profesores = [] } = useQuery<User[]>({
    queryKey: ['profesoresForCourse', user?.colegioId],
    queryFn: () => apiRequest<User[]>('GET', `/api/users/by-role?rol=profesor`),
    enabled: !!user?.colegioId && user?.rol === 'admin-general-colegio' && createUserType === 'curso',
  });

  const createUserMutation = useMutation({
    mutationFn: async (userData: any) => {
      return apiRequest('POST', '/api/users/create', userData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['usuariosByRole'] });
      queryClient.invalidateQueries({ queryKey: ['adminStats'] });
      setCreateUserOpen(false);
      setNewUser({ nombre: '', email: '', password: '', curso: '', telefono: '', celular: '' });
    },
  });

  const createCourseMutation = useMutation({
    mutationFn: async (courseData: any) => {
      return apiRequest('POST', '/api/groups/create', courseData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminStats'] });
      setCreateUserOpen(false);
      setNewCourse({ curso: '', seccion: '', directorGrupo: '' });
    },
  });

  const handleCreateUser = () => {
    if (createUserType === 'curso') {
      // Validar campos del curso
      if (!newCourse.curso || !newCourse.seccion || !newCourse.directorGrupo) {
        alert('Por favor completa todos los campos: Curso, Sección y Director de grupo');
        return;
      }
      createCourseMutation.mutate({
        nombre: `${newCourse.curso}${newCourse.seccion}`.toUpperCase(),
        seccion: newCourse.seccion,
        directorGrupoId: newCourse.directorGrupo,
      });
    } else {
      // Validar campos del usuario
      if (!newUser.nombre || !newUser.email || !newUser.password) {
        alert('Por favor completa todos los campos requeridos');
        return;
      }
      createUserMutation.mutate({
        nombre: newUser.nombre,
        email: newUser.email,
        password: newUser.password,
        rol: createUserType,
        curso: createUserType === 'estudiante' ? newUser.curso : undefined,
        telefono: newUser.telefono,
        celular: newUser.celular,
      });
    }
  };

  // Renderizar sección según activeSection
  const renderSection = () => {
    switch (activeSection) {
      case 'dashboard':
        return renderDashboard();
      case 'usuarios':
        return renderUsuarios();
      case 'cursos':
        return renderCursos();
      case 'materias':
        return renderMaterias();
      case 'asignaciones':
        return renderAsignaciones();
      case 'ia':
        return renderIA();
      case 'config':
        return renderConfig();
      default:
        return renderDashboard();
    }
  };

  // 1️⃣ Vista Principal (Dashboard Home) con KPIs
  const renderDashboard = () => (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card className={CARD_STYLE}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-white">👨‍🎓 Estudiantes Activos</CardTitle>
            <Users className="w-5 h-5" style={{ color: colorPrimario }} />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white font-['Poppins']">
              {statsLoading ? '...' : stats?.estudiantes || 0}
            </div>
          </CardContent>
        </Card>

        <Card className={CARD_STYLE}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-white">👨‍🏫 Profesores</CardTitle>
            <GraduationCap className="w-5 h-5" style={{ color: colorPrimario }} />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white font-['Poppins']">
              {statsLoading ? '...' : stats?.profesores || 0}
            </div>
          </CardContent>
        </Card>

        <Card className={CARD_STYLE}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-white">📚 Materias</CardTitle>
            <BookOpen className="w-5 h-5" style={{ color: colorPrimario }} />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white font-['Poppins']">
              {statsLoading ? '...' : stats?.materias || 0}
            </div>
          </CardContent>
        </Card>

        <Card className={CARD_STYLE}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-white">🏫 Cursos / Grupos</CardTitle>
            <School className="w-5 h-5" style={{ color: colorPrimario }} />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white font-['Poppins']">
              {statsLoading ? '...' : stats?.cursos || 0}
            </div>
          </CardContent>
        </Card>

        <Card className={CARD_STYLE}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-white">👨‍👩‍👧 Padres</CardTitle>
            <Users className="w-5 h-5" style={{ color: colorPrimario }} />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white font-['Poppins']">
              {statsLoading ? '...' : stats?.padres || 0}
            </div>
          </CardContent>
        </Card>

        <Card className={CARD_STYLE}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-white">👔 Directivas</CardTitle>
            <UserCog className="w-5 h-5" style={{ color: colorPrimario }} />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white font-['Poppins']">
              {statsLoading ? '...' : stats?.directivos || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 2️⃣ Acciones Rápidas */}
      <Card className={CARD_STYLE}>
        <CardHeader>
          <CardTitle className="text-white">Acciones Rápidas</CardTitle>
          <CardDescription className="text-white/60">Gestiona rápidamente usuarios y cursos</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Button
              onClick={() => {
                setCreateUserType('estudiante');
                setCreateUserOpen(true);
              }}
              className="h-20 flex flex-col gap-2"
              style={{
                background: `linear-gradient(to right, ${colorPrimario}, ${colorSecundario})`
              }}
            >
              <UserPlus className="w-6 h-6" />
              <span>Crear Estudiante</span>
            </Button>
            <Button
              onClick={() => {
                setCreateUserType('profesor');
                setCreateUserOpen(true);
              }}
              className="h-20 flex flex-col gap-2"
              style={{
                background: `linear-gradient(to right, ${colorPrimario}, ${colorSecundario})`
              }}
            >
              <UserPlus className="w-6 h-6" />
              <span>Crear Profesor</span>
            </Button>
            <Button
              onClick={() => {
                setCreateUserType('padre');
                setCreateUserOpen(true);
              }}
              className="h-20 flex flex-col gap-2"
              style={{
                background: `linear-gradient(to right, ${colorPrimario}, ${colorSecundario})`
              }}
            >
              <UserPlus className="w-6 h-6" />
              <span>Crear Padre</span>
            </Button>
            <Button
              onClick={() => {
                setCreateUserType('curso');
                setNewCourse({ curso: '', seccion: '', directorGrupo: '' });
                setCreateUserOpen(true);
              }}
              className="h-20 flex flex-col gap-2"
              style={{
                background: `linear-gradient(to right, ${colorPrimario}, ${colorSecundario})`
              }}
            >
              <Plus className="w-6 h-6" />
              <span>Crear Curso</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  // 3️⃣ Gestión de Usuarios
  const renderUsuarios = () => (
    <div className="space-y-6">
      <Card className={CARD_STYLE}>
        <CardHeader>
          <CardTitle className="text-white">Gestión de Usuarios</CardTitle>
          <CardDescription className="text-white/60">Administra estudiantes, profesores, padres y directivas</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
            <TabsList className="grid w-full grid-cols-4 bg-white/5">
              <TabsTrigger value="estudiantes" className="text-white data-[state=active]:bg-white/10">
                Estudiantes
              </TabsTrigger>
              <TabsTrigger value="profesores" className="text-white data-[state=active]:bg-white/10">
                Profesores
              </TabsTrigger>
              <TabsTrigger value="padres" className="text-white data-[state=active]:bg-white/10">
                Padres
              </TabsTrigger>
              <TabsTrigger value="directivos" className="text-white data-[state=active]:bg-white/10">
                Directivas
              </TabsTrigger>
            </TabsList>

            <TabsContent value={activeTab} className="mt-6">
              <div className="space-y-4">
                {/* Barra de búsqueda */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-white/40" />
                  <Input
                    type="text"
                    placeholder={`Buscar ${activeTab === 'estudiantes' ? 'estudiantes' : activeTab === 'profesores' ? 'profesores' : activeTab === 'padres' ? 'padres' : 'directivos'} por nombre, email${activeTab === 'estudiantes' ? ' o curso' : ''}...`}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="bg-white/5 border-white/10 text-white pl-10 placeholder:text-white/40"
                  />
                </div>

                {usuariosLoading ? (
                  <p className="text-white/60">Cargando...</p>
                ) : usuarios.length === 0 ? (
                  <p className="text-white/60">No hay {activeTab} registrados</p>
                ) : usuariosFiltrados.length === 0 ? (
                  <p className="text-white/60">
                    No se encontraron {activeTab} que coincidan con "{searchTerm}"
                  </p>
                ) : (
                  <>
                    <div className="text-sm text-white/60 mb-2">
                      Mostrando {usuariosFiltrados.length} de {usuarios.length} {activeTab}
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-white/10">
                            <th className="text-left p-2 text-white/80">Nombre</th>
                            <th className="text-left p-2 text-white/80">Email</th>
                            {activeTab === 'estudiantes' && <th className="text-left p-2 text-white/80">Curso</th>}
                            <th className="text-left p-2 text-white/80">Estado</th>
                            <th className="text-left p-2 text-white/80">Acciones</th>
                          </tr>
                        </thead>
                        <tbody>
                          {usuariosFiltrados.map((usuario) => (
                          <tr key={usuario._id} className="border-b border-white/5">
                            <td className="p-2 text-white">{usuario.nombre}</td>
                            <td className="p-2 text-white/70">{usuario.email}</td>
                            {activeTab === 'estudiantes' && (
                              <td className="p-2 text-white/70">{usuario.curso || '-'}</td>
                            )}
                            <td className="p-2">
                              <Badge 
                                className={
                                  usuario.estado === 'active' 
                                    ? 'bg-green-500/20 text-green-400 border-green-500/40'
                                    : usuario.estado === 'suspended'
                                    ? 'bg-red-500/20 text-red-400 border-red-500/40'
                                    : 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40'
                                }
                              >
                                {usuario.estado === 'active' ? 'Activo' : usuario.estado === 'suspended' ? 'Suspendido' : 'Pendiente'}
                              </Badge>
                            </td>
                            <td className="p-2">
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => {
                                    setSelectedUser(usuario);
                                    setEditUserOpen(true);
                                  }}
                                >
                                  <Edit className="w-4 h-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => {
                                    // TODO: Implementar desactivar
                                  }}
                                >
                                  {usuario.estado === 'active' ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </Button>
                              </div>
                            </td>
                          </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );

  // 4️⃣ Cursos y Estructura Académica
  const renderCursos = () => (
    <div className="space-y-6">
      <Card className={CARD_STYLE}>
        <CardHeader>
          <CardTitle className="text-white">Cursos y Estructura Académica</CardTitle>
          <CardDescription className="text-white/60">Gestiona cursos, estudiantes y profesores asignados</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-white/60">Funcionalidad en desarrollo...</p>
        </CardContent>
      </Card>
    </div>
  );

  // 5️⃣ Materias
  const renderMaterias = () => (
    <div className="space-y-6">
      <Card className={CARD_STYLE}>
        <CardHeader>
          <CardTitle className="text-white">Materias</CardTitle>
          <CardDescription className="text-white/60">Gestiona las materias del colegio</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-white/60">Funcionalidad en desarrollo...</p>
        </CardContent>
      </Card>
    </div>
  );

  // 5️⃣ Relaciones Padre-Estudiante
  const renderAsignaciones = () => (
    <div className="space-y-6">
      <Card className={CARD_STYLE}>
        <CardHeader>
          <CardTitle className="text-white">Relaciones Padre ⇄ Estudiante</CardTitle>
          <CardDescription className="text-white/60">Gestiona los vínculos entre padres y estudiantes</CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            onClick={() => setRelacionOpen(true)}
            style={{
              background: `linear-gradient(to right, ${colorPrimario}, ${colorSecundario})`
            }}
          >
            <LinkIcon className="w-4 h-4 mr-2" />
            Crear Nueva Relación
          </Button>
          <p className="text-white/60 mt-4">Funcionalidad en desarrollo...</p>
        </CardContent>
      </Card>
    </div>
  );

  // 6️⃣ IA del Colegio
  const renderIA = () => (
    <div className="space-y-6">
      <Card className={CARD_STYLE}>
        <CardHeader>
          <CardTitle className="text-white">IA Académica</CardTitle>
          <CardDescription className="text-white/60">Configuración básica de IA para materias</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-white/60">Funcionalidad en desarrollo...</p>
        </CardContent>
      </Card>
    </div>
  );

  // 7️⃣ Configuración del Colegio
  const renderConfig = () => (
    <div className="space-y-6">
      <Card className={CARD_STYLE}>
        <CardHeader>
          <CardTitle className="text-white">Configuración del Colegio</CardTitle>
          <CardDescription className="text-white/60">Información básica del colegio</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-white/60">Funcionalidad en desarrollo...</p>
        </CardContent>
      </Card>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Sidebar de Navegación */}
      <Card className={CARD_STYLE}>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-2">
            <Button
              variant={activeSection === 'dashboard' ? 'default' : 'ghost'}
              onClick={() => setActiveSection('dashboard')}
              className={activeSection === 'dashboard' ? '' : 'text-white/70'}
            >
              <LayoutDashboard className="w-4 h-4 mr-2" />
              Dashboard
            </Button>
            <Button
              variant={activeSection === 'usuarios' ? 'default' : 'ghost'}
              onClick={() => setActiveSection('usuarios')}
              className={activeSection === 'usuarios' ? '' : 'text-white/70'}
            >
              <Users className="w-4 h-4 mr-2" />
              Usuarios
            </Button>
            <Button
              variant={activeSection === 'cursos' ? 'default' : 'ghost'}
              onClick={() => setActiveSection('cursos')}
              className={activeSection === 'cursos' ? '' : 'text-white/70'}
            >
              <School className="w-4 h-4 mr-2" />
              Cursos
            </Button>
            <Button
              variant={activeSection === 'materias' ? 'default' : 'ghost'}
              onClick={() => setActiveSection('materias')}
              className={activeSection === 'materias' ? '' : 'text-white/70'}
            >
              <BookMarked className="w-4 h-4 mr-2" />
              Materias
            </Button>
            <Button
              variant={activeSection === 'asignaciones' ? 'default' : 'ghost'}
              onClick={() => setActiveSection('asignaciones')}
              className={activeSection === 'asignaciones' ? '' : 'text-white/70'}
            >
              <LinkIcon className="w-4 h-4 mr-2" />
              Asignaciones
            </Button>
            <Button
              variant={activeSection === 'ia' ? 'default' : 'ghost'}
              onClick={() => setActiveSection('ia')}
              className={activeSection === 'ia' ? '' : 'text-white/70'}
            >
              <Brain className="w-4 h-4 mr-2" />
              IA Académica
            </Button>
            <Button
              variant={activeSection === 'config' ? 'default' : 'ghost'}
              onClick={() => setActiveSection('config')}
              className={activeSection === 'config' ? '' : 'text-white/70'}
            >
              <Settings className="w-4 h-4 mr-2" />
              Configuración
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Contenido de la sección activa */}
      {renderSection()}

      {/* Diálogo para crear usuario o curso */}
      <Dialog 
        open={createUserOpen} 
        onOpenChange={(open) => {
          setCreateUserOpen(open);
          if (!open) {
            // Limpiar formularios al cerrar
            setNewUser({ nombre: '', email: '', password: '', curso: '', telefono: '', celular: '' });
            setNewCourse({ curso: '', seccion: '', directorGrupo: '' });
          }
        }}
      >
        <DialogContent className="bg-[#0b0013] border-white/10 text-white">
          <DialogHeader>
            <DialogTitle>Crear {createUserType === 'curso' ? 'Curso' : createUserType === 'estudiante' ? 'Estudiante' : createUserType === 'profesor' ? 'Profesor' : 'Padre'}</DialogTitle>
            <DialogDescription className="text-white/60">
              Completa los datos para crear un nuevo {createUserType === 'curso' ? 'curso' : 'usuario'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {createUserType === 'curso' ? (
              // Formulario para crear curso
              <>
                <div>
                  <Label htmlFor="curso" className="text-white/90">Curso *</Label>
                  <Input
                    id="curso"
                    value={newCourse.curso}
                    onChange={(e) => setNewCourse({ ...newCourse, curso: e.target.value.toUpperCase() })}
                    className="bg-white/5 border-white/10 text-white mt-1"
                    placeholder="Ej: 7, 8, 9, 10, 11"
                  />
                  <p className="text-xs text-white/50 mt-1">Ingresa el número del curso (ej: 7, 8, 9, 10, 11)</p>
                </div>
                <div>
                  <Label htmlFor="seccion" className="text-white/90">Sección *</Label>
                  <Input
                    id="seccion"
                    value={newCourse.seccion}
                    onChange={(e) => setNewCourse({ ...newCourse, seccion: e.target.value.toUpperCase() })}
                    className="bg-white/5 border-white/10 text-white mt-1"
                    placeholder="Ej: A, B, C"
                  />
                  <p className="text-xs text-white/50 mt-1">Ingresa la sección (ej: A, B, C)</p>
                </div>
                <div>
                  <Label htmlFor="directorGrupo" className="text-white/90">Director de Grupo *</Label>
                  <Select
                    value={newCourse.directorGrupo}
                    onValueChange={(value) => setNewCourse({ ...newCourse, directorGrupo: value })}
                  >
                    <SelectTrigger className="bg-white/5 border-white/10 text-white mt-1">
                      <SelectValue placeholder="Selecciona un profesor" />
                    </SelectTrigger>
                    <SelectContent className="bg-[#0b0013] border-white/10">
                      {profesores.map((profesor) => (
                        <SelectItem 
                          key={profesor._id} 
                          value={profesor._id}
                          className="text-white focus:bg-white/10"
                        >
                          {profesor.nombre} ({profesor.email})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-white/50 mt-1">Selecciona el profesor que será director de este grupo</p>
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={handleCreateUser}
                    disabled={createCourseMutation.isPending}
                    style={{
                      background: `linear-gradient(to right, ${colorPrimario}, ${colorSecundario})`
                    }}
                  >
                    {createCourseMutation.isPending ? 'Creando...' : 'Crear Curso'}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setCreateUserOpen(false);
                      setNewCourse({ curso: '', seccion: '', directorGrupo: '' });
                    }}
                    className="border-white/10 text-white"
                  >
                    Cancelar
                  </Button>
                </div>
              </>
            ) : (
              // Formulario para crear usuario
              <>
                <div>
                  <Label htmlFor="nombre" className="text-white/90">Nombre completo *</Label>
                  <Input
                    id="nombre"
                    value={newUser.nombre}
                    onChange={(e) => setNewUser({ ...newUser, nombre: e.target.value })}
                    className="bg-white/5 border-white/10 text-white mt-1"
                    placeholder="Juan Pérez"
                  />
                </div>
                <div>
                  <Label htmlFor="email" className="text-white/90">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={newUser.email}
                    onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                    className="bg-white/5 border-white/10 text-white mt-1"
                    placeholder="juan@ejemplo.com"
                  />
                </div>
                <div>
                  <Label htmlFor="password" className="text-white/90">Contraseña *</Label>
                  <Input
                    id="password"
                    type="password"
                    value={newUser.password}
                    onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                    className="bg-white/5 border-white/10 text-white mt-1"
                    placeholder="••••••••"
                  />
                </div>
                {createUserType === 'estudiante' && (
                  <div>
                    <Label htmlFor="curso" className="text-white/90">Curso</Label>
                    <Input
                      id="curso"
                      value={newUser.curso}
                      onChange={(e) => setNewUser({ ...newUser, curso: e.target.value.toUpperCase() })}
                      className="bg-white/5 border-white/10 text-white mt-1"
                      placeholder="7A"
                    />
                  </div>
                )}
                <div className="flex gap-2">
                  <Button
                    onClick={handleCreateUser}
                    disabled={createUserMutation.isPending}
                    style={{
                      background: `linear-gradient(to right, ${colorPrimario}, ${colorSecundario})`
                    }}
                  >
                    {createUserMutation.isPending ? 'Creando...' : 'Crear'}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setCreateUserOpen(false);
                      setNewUser({ nombre: '', email: '', password: '', curso: '', telefono: '', celular: '' });
                    }}
                    className="border-white/10 text-white"
                  >
                    Cancelar
                  </Button>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
