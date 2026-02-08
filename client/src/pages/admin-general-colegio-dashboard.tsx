import React, { useState, useMemo, useEffect } from 'react';
import { useAuth } from '@/lib/authContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useInstitutionColors } from '@/hooks/useInstitutionColors';
import { 
  Users, GraduationCap, BookOpen, UserPlus, Plus, Edit, Trash2, 
  X, Check, Settings, Bot, Link as LinkIcon, Eye, EyeOff,
  LayoutDashboard, UserCog, School, BookMarked, FileText, Brain, Search, Upload, KeyRound, Copy
} from 'lucide-react';
import { BulkUsersUpload } from '@/components/admin/BulkUsersUpload';
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

// Componente para mostrar relaciones padre-hijo
function UserRelations({ userId, activeTab }: { userId: string; activeTab: string }) {
  const { data: relaciones } = useQuery<{ tipo: string; padres?: any[]; hijos?: any[] }>({
    queryKey: ['relaciones', userId],
    queryFn: () => apiRequest(`GET`, `/api/users/relaciones/${userId}`),
    enabled: (activeTab === 'estudiantes' || activeTab === 'padres') && !!userId,
  });
  
  if (!relaciones) return <span className="text-white/50">-</span>;
  
  if (relaciones.tipo === 'estudiante' && relaciones.padres && relaciones.padres.length > 0) {
    return (
      <span className="text-white/70 text-sm">
        Hijo de: {relaciones.padres.map((p: any) => p.nombre).join(', ')}
      </span>
    );
  }
  if (relaciones.tipo === 'padre' && relaciones.hijos && relaciones.hijos.length > 0) {
    return (
      <span className="text-white/70 text-sm">
        Padre de: {relaciones.hijos.map((h: any) => `${h.nombre}${h.curso ? ` (${h.curso})` : ''}`).join(', ')}
      </span>
    );
  }
  return <span className="text-white/50 text-sm">-</span>;
}

interface User {
  _id: string;
  id: string;
  userId: string;
  nombre: string;
  email: string;
  curso?: string;
  estado: 'pending' | 'active' | 'suspended' | 'pendiente_vinculacion' | 'vinculado';
  codigoUnico?: string;
  telefono?: string;
  celular?: string;
  materias?: string[];
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
  
  const [activeSection, setActiveSection] = useState<'dashboard' | 'usuarios' | 'cursos' | 'materias' | 'asignaciones' | 'carga-masiva' | 'ia' | 'config'>('dashboard');
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
  const [vinculoEstudianteId, setVinculoEstudianteId] = useState('');
  const [vinculoPadreId, setVinculoPadreId] = useState('');
  const [vinculoSelectedEstudianteId, setVinculoSelectedEstudianteId] = useState('');
  const [assignGrupoId, setAssignGrupoId] = useState('');
  const [assignEstudianteId, setAssignEstudianteId] = useState('');
  const [assignCourseId, setAssignCourseId] = useState('');
  const [assignProfessorId, setAssignProfessorId] = useState('');
  // Asignar profesor a grupos (flujo: profesor → cursos existentes)
  const [assignProfToGroupsProfessorId, setAssignProfToGroupsProfessorId] = useState('');
  const [assignProfToGroupsGroupNames, setAssignProfToGroupsGroupNames] = useState<string[]>([]);
  // Caja con datos de la cuenta recién creada (en lugar del mensaje gris externo)
  const [createdUserInfo, setCreatedUserInfo] = useState<{
    nombre: string;
    email: string;
    rol: string;
    passwordTemporal: string;
    _id: string;
  } | null>(null);
  // Caja con la nueva contraseña tras restablecer (en el diálogo de información de cuenta)
  const [resetPasswordBox, setResetPasswordBox] = useState<{ passwordTemporal: string } | null>(null);
  const [copyFeedback, setCopyFeedback] = useState(false);

  const isAdminColegio = user?.rol === 'admin-general-colegio' || user?.rol === 'school_admin';

  // Obtener estadísticas
  const { data: stats, isLoading: statsLoading } = useQuery<Stats>({
    queryKey: ['adminStats', user?.colegioId],
    queryFn: () => apiRequest<Stats>('GET', '/api/users/stats'),
    enabled: !!user?.colegioId && isAdminColegio,
  });

  // Mapear tab (plural) a rol del API (singular)
  const tabToRol: Record<string, string> = {
    estudiantes: 'estudiante',
    profesores: 'profesor',
    padres: 'padre',
    directivos: 'directivo',
  };
  const rolForApi = tabToRol[activeTab] || activeTab;

  // Obtener usuarios por rol
  const { data: usuarios = [], isLoading: usuariosLoading } = useQuery<User[]>({
    queryKey: ['usuariosByRole', rolForApi, user?.colegioId],
    queryFn: () => apiRequest<User[]>('GET', `/api/users/by-role?rol=${rolForApi}`),
    enabled: !!user?.colegioId && isAdminColegio && !!rolForApi,
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
    telefono: '',
    celular: '',
    materiaNombre: '', // Materia que dicta el profesor (string)
    materias: [] as string[],
    cursos: [] as string[],
  });
  const [userPasswordTemporal, setUserPasswordTemporal] = useState<Record<string, string>>({});

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
    enabled: !!user?.colegioId && isAdminColegio && createUserType === 'curso',
  });

  // Estudiantes y padres para vinculación (sección Asignaciones)
  const { data: estudiantesVinculo = [] } = useQuery<User[]>({
    queryKey: ['estudiantesForVinculo', user?.colegioId],
    queryFn: () => apiRequest<User[]>('GET', '/api/users/by-role?rol=estudiante'),
    enabled: !!user?.colegioId && isAdminColegio && activeSection === 'asignaciones',
  });
  const { data: padresVinculo = [] } = useQuery<User[]>({
    queryKey: ['padresForVinculo', user?.colegioId],
    queryFn: () => apiRequest<User[]>('GET', '/api/users/by-role?rol=padre'),
    enabled: !!user?.colegioId && isAdminColegio && activeSection === 'asignaciones',
  });

  interface VinculacionItem {
    _id: string;
    padreId: { _id: string; nombre: string; email: string };
    estudianteId: { _id: string; nombre: string; email: string; estado?: string };
  }
  const { data: vinculacionesList = [], refetch: refetchVinculaciones } = useQuery<VinculacionItem[]>({
    queryKey: ['vinculaciones', vinculoSelectedEstudianteId],
    queryFn: () => apiRequest<VinculacionItem[]>('GET', `/api/users/vinculaciones?estudianteId=${vinculoSelectedEstudianteId}`),
    enabled: !!user?.colegioId && !!vinculoSelectedEstudianteId,
  });

  const crearVinculacionMutation = useMutation({
    mutationFn: (payload: { padreId: string; estudianteId: string }) =>
      apiRequest('POST', '/api/users/vinculaciones', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vinculaciones'] });
      refetchVinculaciones();
      setVinculoEstudianteId('');
      setVinculoPadreId('');
      setRelacionOpen(false);
    },
  });
  const confirmarVinculacionMutation = useMutation({
    mutationFn: (estudianteId: string) =>
      apiRequest('POST', '/api/users/confirmar-vinculacion', { estudianteId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['usuariosByRole', 'estudiantesForVinculo', 'vinculaciones'] });
      refetchVinculaciones();
    },
  });
  const activarCuentasMutation = useMutation({
    mutationFn: (estudianteId: string) =>
      apiRequest('POST', '/api/users/activar-cuentas', { estudianteId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['usuariosByRole', 'estudiantesForVinculo', 'vinculaciones'] });
      refetchVinculaciones();
    },
  });

  // Cursos: grupos, materias, asignar estudiante/profesor
  interface GroupItem { _id: string; nombre: string }
  interface CourseItem { _id: string; nombre: string; cursos?: string[] }
  const { data: gruposList = [] } = useQuery<GroupItem[]>({
    queryKey: ['groupsAll', user?.colegioId],
    queryFn: () => apiRequest<GroupItem[]>('GET', '/api/groups/all'),
    enabled: !!user?.colegioId && isAdminColegio && (activeSection === 'cursos' || createUserOpen),
  });
  const { data: coursesList = [] } = useQuery<CourseItem[]>({
    queryKey: ['coursesAdmin', user?.colegioId],
    queryFn: () => apiRequest<CourseItem[]>('GET', '/api/courses'),
    enabled: !!user?.colegioId && isAdminColegio && (activeSection === 'cursos' || createUserOpen),
  });
  const { data: estudiantesForAssign = [] } = useQuery<User[]>({
    queryKey: ['estudiantesForAssign', user?.colegioId],
    queryFn: () => apiRequest<User[]>('GET', '/api/users/by-role?rol=estudiante'),
    enabled: !!user?.colegioId && isAdminColegio && activeSection === 'cursos',
  });
  const { data: profesoresForAssign = [] } = useQuery<User[]>({
    queryKey: ['profesoresForAssign', user?.colegioId],
    queryFn: () => apiRequest<User[]>('GET', '/api/users/by-role?rol=profesor'),
    enabled: !!user?.colegioId && isAdminColegio && activeSection === 'cursos',
  });
  const assignStudentMutation = useMutation({
    mutationFn: (payload: { grupoId: string; estudianteId: string }) =>
      apiRequest('POST', '/api/groups/assign-student', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['usuariosByRole', 'adminStats'] });
      setAssignGrupoId('');
      setAssignEstudianteId('');
    },
  });
  const assignProfessorMutation = useMutation({
    mutationFn: (payload: { courseId: string; professorId: string }) =>
      apiRequest('PUT', '/api/courses/assign-professor', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coursesAdmin'] });
      setAssignCourseId('');
      setAssignProfessorId('');
    },
  });

  const createUserMutation = useMutation({
    mutationFn: async (userData: any) => {
      return apiRequest<{ user?: { _id: string; nombre?: string; email?: string; rol?: string; passwordTemporal?: string }; message?: string }>('POST', '/api/users/create', userData);
    },
    onSuccess: (data, variables: any) => {
      queryClient.invalidateQueries({ queryKey: ['usuariosByRole'] });
      queryClient.invalidateQueries({ queryKey: ['adminStats'] });
      const passwordTemporal = data?.user?.passwordTemporal ?? (data as any)?.passwordTemporal;
      if (data?.user?._id && passwordTemporal) {
        setUserPasswordTemporal(prev => ({ ...prev, [data.user!._id]: passwordTemporal }));
        setCreatedUserInfo({
          _id: data.user._id,
          nombre: data.user.nombre ?? '',
          email: data.user.email ?? '',
          rol: data.user.rol ?? variables?.rol ?? '',
          passwordTemporal,
        });
      }
      setCreateUserOpen(false);
      setNewUser({ nombre: '', email: '', telefono: '', celular: '', materiaNombre: '', materias: [], cursos: [] });
    },
  });

  const createCourseMutation = useMutation({
    mutationFn: async (courseData: any) => {
      const body: any = { nombre: courseData.nombre, seccion: courseData.seccion };
      if (courseData.directorGrupoId) body.directorGrupoId = courseData.directorGrupoId;
      return apiRequest('POST', '/api/groups/create', body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminStats', 'groupsAll'] });
      setCreateUserOpen(false);
      setNewCourse({ curso: '', seccion: '', directorGrupo: '' });
    },
  });

  const assignProfessorToGroupsMutation = useMutation({
    mutationFn: (payload: { professorId: string; groupNames: string[] }) =>
      apiRequest('POST', '/api/courses/assign-professor-to-groups', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coursesAdmin'] });
      setAssignProfToGroupsProfessorId('');
      setAssignProfToGroupsGroupNames([]);
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: (userId: string) =>
      apiRequest<{ passwordTemporal: string }>('POST', '/api/users/reset-password', { userId }),
    onSuccess: (data, userId) => {
      setResetPasswordBox({ passwordTemporal: data.passwordTemporal });
      setUserPasswordTemporal((prev) => ({ ...prev, [userId]: data.passwordTemporal }));
    },
  });

  const handleCreateUser = () => {
    if (createUserType === 'curso') {
      if (!newCourse.curso || !newCourse.seccion) {
        alert('Por favor completa Curso y Sección. El director de grupo es opcional.');
        return;
      }
      createCourseMutation.mutate({
        nombre: newCourse.curso.toUpperCase().trim(),
        seccion: newCourse.seccion,
        directorGrupoId: newCourse.directorGrupo && newCourse.directorGrupo !== '__none__' ? newCourse.directorGrupo : undefined,
      });
    } else {
      if (!newUser.nombre || !newUser.email) {
        alert('Nombre y email son obligatorios.');
        return;
      }
      if (createUserType === 'profesor' && !newUser.materiaNombre.trim()) {
        alert('Indica la materia que dicta el profesor (ej. Matemáticas).');
        return;
      }
      const payload: Record<string, unknown> = {
        nombre: newUser.nombre,
        email: newUser.email,
        rol: createUserType,
        telefono: newUser.telefono || undefined,
        celular: newUser.celular || undefined,
      };
      if (createUserType === 'profesor') {
        if (newUser.materiaNombre) payload.materia = newUser.materiaNombre;
        if (newUser.materias.length > 0) payload.materias = newUser.materias;
        if (newUser.cursos.length > 0) payload.cursos = newUser.cursos;
      }
      createUserMutation.mutate(payload as any);
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
      case 'carga-masiva':
        return <BulkUsersUpload />;
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
        <Card 
          className={`${CARD_STYLE} cursor-pointer hover:bg-white/10 transition-colors`}
          onClick={() => {
            setActiveSection('usuarios');
            setActiveTab('estudiantes');
          }}
        >
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

        <Card 
          className={`${CARD_STYLE} cursor-pointer hover:bg-white/10 transition-colors`}
          onClick={() => {
            setActiveSection('usuarios');
            setActiveTab('profesores');
          }}
        >
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

        <Card 
          className={`${CARD_STYLE} cursor-pointer hover:bg-white/10 transition-colors`}
          onClick={() => setActiveSection('materias')}
        >
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

        <Card 
          className={`${CARD_STYLE} cursor-pointer hover:bg-white/10 transition-colors`}
          onClick={() => setActiveSection('cursos')}
        >
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

        <Card 
          className={`${CARD_STYLE} cursor-pointer hover:bg-white/10 transition-colors`}
          onClick={() => {
            setActiveSection('usuarios');
            setActiveTab('padres');
          }}
        >
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

        <Card 
          className={`${CARD_STYLE} cursor-pointer hover:bg-white/10 transition-colors`}
          onClick={() => {
            setActiveSection('usuarios');
            setActiveTab('directivos');
          }}
        >
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
          <CardDescription className="text-white/60">
            Todas las cuentas por categoría. Usuario de login = email. La contraseña se muestra solo tras crear la cuenta (guárdala). Haz clic en una fila o en Ver para ver el detalle.
          </CardDescription>
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
                            <th className="text-left p-2 text-white/80">Usuario (email)</th>
                            {activeTab === 'estudiantes' && <th className="text-left p-2 text-white/80">Curso</th>}
                            {(activeTab === 'estudiantes' || activeTab === 'padres') && (
                              <th className="text-left p-2 text-white/80">Relaciones</th>
                            )}
                            <th className="text-left p-2 text-white/80">Contraseña generada</th>
                            <th className="text-left p-2 text-white/80">Estado</th>
                            <th className="text-left p-2 text-white/80">Acciones</th>
                          </tr>
                        </thead>
                        <tbody>
                          {usuariosFiltrados.map((usuario) => (
                            <tr
                              key={usuario._id}
                              className="border-b border-white/5 cursor-pointer hover:bg-white/5 transition-colors"
                              onClick={() => {
                                setSelectedUser(usuario);
                                setEditUserOpen(true);
                              }}
                            >
                              <td className="p-2 text-white">{usuario.nombre}</td>
                              <td className="p-2 text-white/70 font-mono text-sm">{usuario.email}</td>
                              {activeTab === 'estudiantes' && (
                                <td className="p-2 text-white/70">{usuario.curso || '-'}</td>
                              )}
                              {(activeTab === 'estudiantes' || activeTab === 'padres') && (
                                <td className="p-2" onClick={(e) => e.stopPropagation()}>
                                  <UserRelations userId={usuario._id} activeTab={activeTab} />
                                </td>
                              )}
                              <td className="p-2" onClick={(e) => e.stopPropagation()}>
                                {userPasswordTemporal[usuario._id] ? (
                                  <span className="text-xs text-amber-300 font-mono bg-white/5 px-2 py-1 rounded border border-amber-500/30">
                                    {userPasswordTemporal[usuario._id]}
                                  </span>
                                ) : (
                                  <span className="text-white/50 text-sm">—</span>
                                )}
                              </td>
                              <td className="p-2">
                                <Badge 
                                  className={
                                    usuario.estado === 'active' 
                                      ? 'bg-green-500/20 text-green-400 border-green-500/40'
                                      : usuario.estado === 'suspended'
                                      ? 'bg-red-500/20 text-red-400 border-red-500/40'
                                      : usuario.estado === 'vinculado'
                                      ? 'bg-blue-500/20 text-blue-400 border-blue-500/40'
                                      : usuario.estado === 'pendiente_vinculacion'
                                      ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                                      : 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40'
                                  }
                                >
                                  {usuario.estado === 'active' ? 'Activo' : usuario.estado === 'suspended' ? 'Suspendido' : usuario.estado === 'vinculado' ? 'Vinculado' : usuario.estado === 'pendiente_vinculacion' ? 'Pend. vinculación' : 'Pendiente'}
                                </Badge>
                              </td>
                              <td className="p-2" onClick={(e) => e.stopPropagation()}>
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => {
                                      setSelectedUser(usuario);
                                      setEditUserOpen(true);
                                    }}
                                    title="Ver información de la cuenta"
                                  >
                                    <Eye className="w-4 h-4" />
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

  // 4️⃣ Cursos y Estructura Académica (flujo: 1.Cursos 2.Profesores 3.Asignaciones 4.Estudiantes)
  const renderCursos = () => (
    <div className="space-y-6">
      <Card className={CARD_STYLE}>
        <CardHeader>
          <CardTitle className="text-white">Crear curso / grupo</CardTitle>
          <CardDescription className="text-white/60">Los cursos son la base: créalos primero (ej. 11A, 11B). El director de grupo es opcional.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-white/70 text-sm">Desde el botón &quot;Crear Curso&quot; en Acciones Rápidas puedes crear nuevos grupos. Luego asigna profesores y estudiantes.</p>
        </CardContent>
      </Card>
      <Card className={CARD_STYLE}>
        <CardHeader>
          <CardTitle className="text-white">Asignar profesor a cursos</CardTitle>
          <CardDescription className="text-white/60">Elige un profesor (con materia asignada) y los cursos/grupos donde dicta. La materia se toma del profesor.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-white/90 mb-2 block">Profesor</Label>
              <Select value={assignProfToGroupsProfessorId} onValueChange={setAssignProfToGroupsProfessorId}>
                <SelectTrigger className="bg-white/5 border-white/10 text-white">
                  <SelectValue placeholder="Elige profesor" />
                </SelectTrigger>
                <SelectContent className="bg-[#0b0013] border-white/10">
                  {profesoresForAssign.map((p) => (
                    <SelectItem key={p._id} value={p._id} className="text-white focus:bg-white/10">
                      {p.nombre} {p.email ? `(${p.email})` : ''} {Array.isArray((p as any).materias) && (p as any).materias?.length ? `— ${(p as any).materias[0]}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-white/90 mb-2 block">Cursos / Grupos</Label>
              <Select
                value=""
                onValueChange={(g) => {
                  if (g && !assignProfToGroupsGroupNames.includes(g)) {
                    setAssignProfToGroupsGroupNames([...assignProfToGroupsGroupNames, g]);
                  }
                }}
              >
                <SelectTrigger className="bg-white/5 border-white/10 text-white">
                  <SelectValue placeholder="Añadir curso" />
                </SelectTrigger>
                <SelectContent className="bg-[#0b0013] border-white/10">
                  {gruposList.map((gr) => (
                    <SelectItem key={gr._id} value={gr.nombre} className="text-white focus:bg-white/10">{gr.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {assignProfToGroupsGroupNames.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {assignProfToGroupsGroupNames.map((g) => (
                    <Badge key={g} className="bg-white/10 text-white border-white/20">
                      {g}
                      <button type="button" onClick={() => setAssignProfToGroupsGroupNames(assignProfToGroupsGroupNames.filter((x) => x !== g))} className="ml-2 hover:text-red-400">×</button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>
          <Button
            disabled={!assignProfToGroupsProfessorId || assignProfToGroupsGroupNames.length === 0 || assignProfessorToGroupsMutation.isPending}
            style={{ background: `linear-gradient(to right, ${colorPrimario}, ${colorSecundario})` }}
            onClick={() => assignProfessorToGroupsMutation.mutate({ professorId: assignProfToGroupsProfessorId, groupNames: assignProfToGroupsGroupNames })}
          >
            {assignProfessorToGroupsMutation.isPending ? 'Asignando...' : 'Asignar profesor a cursos'}
          </Button>
        </CardContent>
      </Card>
      <Card className={CARD_STYLE}>
        <CardHeader>
          <CardTitle className="text-white">Asignar estudiante a curso</CardTitle>
          <CardDescription className="text-white/60">Solo a cursos ya creados. El estudiante debe ser del mismo colegio.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-white/90 mb-2 block">Curso / Grupo</Label>
              <Select value={assignGrupoId} onValueChange={setAssignGrupoId}>
                <SelectTrigger className="bg-white/5 border-white/10 text-white">
                  <SelectValue placeholder="Elige curso" />
                </SelectTrigger>
                <SelectContent className="bg-[#0b0013] border-white/10">
                  {gruposList.map((g) => (
                    <SelectItem key={g._id} value={g.nombre} className="text-white focus:bg-white/10">{g.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-white/90 mb-2 block">Estudiante</Label>
              <Select value={assignEstudianteId} onValueChange={setAssignEstudianteId}>
                <SelectTrigger className="bg-white/5 border-white/10 text-white">
                  <SelectValue placeholder="Elige estudiante" />
                </SelectTrigger>
                <SelectContent className="bg-[#0b0013] border-white/10">
                  {estudiantesForAssign.map((e) => (
                    <SelectItem key={e._id} value={e._id} className="text-white focus:bg-white/10">{e.nombre} ({e.email})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button
            disabled={!assignGrupoId || !assignEstudianteId || assignStudentMutation.isPending}
            style={{ background: `linear-gradient(to right, ${colorPrimario}, ${colorSecundario})` }}
            onClick={() => assignStudentMutation.mutate({ grupoId: assignGrupoId, estudianteId: assignEstudianteId })}
          >
            {assignStudentMutation.isPending ? 'Asignando...' : 'Asignar estudiante al curso'}
          </Button>
        </CardContent>
      </Card>
      <Card className={CARD_STYLE}>
        <CardHeader>
          <CardTitle className="text-white">Asignar profesor a materia</CardTitle>
          <CardDescription className="text-white/60">Asigna profesores a las materias que dictan.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-white/90 mb-2 block">Materia</Label>
              <Select value={assignCourseId} onValueChange={setAssignCourseId}>
                <SelectTrigger className="bg-white/5 border-white/10 text-white">
                  <SelectValue placeholder="Elige materia" />
                </SelectTrigger>
                <SelectContent className="bg-[#0b0013] border-white/10">
                  {coursesList.map((c) => (
                    <SelectItem key={c._id} value={c._id} className="text-white focus:bg-white/10">{c.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-white/90 mb-2 block">Profesor</Label>
              <Select value={assignProfessorId} onValueChange={setAssignProfessorId}>
                <SelectTrigger className="bg-white/5 border-white/10 text-white">
                  <SelectValue placeholder="Elige profesor" />
                </SelectTrigger>
                <SelectContent className="bg-[#0b0013] border-white/10">
                  {profesoresForAssign.map((p) => (
                    <SelectItem key={p._id} value={p._id} className="text-white focus:bg-white/10">{p.nombre} ({p.email})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button
            disabled={!assignCourseId || !assignProfessorId || assignProfessorMutation.isPending}
            style={{ background: `linear-gradient(to right, ${colorPrimario}, ${colorSecundario})` }}
            onClick={() => assignProfessorMutation.mutate({ courseId: assignCourseId, professorId: assignProfessorId })}
          >
            {assignProfessorMutation.isPending ? 'Asignando...' : 'Asignar profesor a la materia'}
          </Button>
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
  const selectedStudent = vinculoSelectedEstudianteId
    ? estudiantesVinculo.find((e) => e._id === vinculoSelectedEstudianteId)
    : null;
  const canConfirmar = vinculacionesList.length >= 1 && selectedStudent?.estado === 'pendiente_vinculacion';
  const canActivar = vinculacionesList.length >= 1 && selectedStudent?.estado === 'vinculado';

  const renderAsignaciones = () => (
    <div className="space-y-6">
      <Card className={CARD_STYLE}>
        <CardHeader>
          <CardTitle className="text-white">Relaciones Padre ⇄ Estudiante</CardTitle>
          <CardDescription className="text-white/60">Vincula estudiantes con padres. Luego confirma la vinculación y activa las cuentas.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <Label className="text-white/90 mb-2 block">Seleccionar estudiante</Label>
              <Select value={vinculoSelectedEstudianteId} onValueChange={(v) => { setVinculoSelectedEstudianteId(v); }}>
                <SelectTrigger className="bg-white/5 border-white/10 text-white">
                  <SelectValue placeholder="Elige un estudiante" />
                </SelectTrigger>
                <SelectContent className="bg-[#0b0013] border-white/10">
                  {estudiantesVinculo.map((e) => (
                    <SelectItem key={e._id} value={e._id} className="text-white focus:bg-white/10">
                      {e.nombre} ({e.email}) — {e.estado === 'pendiente_vinculacion' ? 'Pend. vinculación' : e.estado === 'vinculado' ? 'Vinculado' : e.estado === 'active' ? 'Activo' : e.estado}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {vinculoSelectedEstudianteId && (
              <>
                <div className="rounded-lg bg-white/5 border border-white/10 p-4">
                  <p className="text-white/80 text-sm font-medium mb-2">Padres vinculados</p>
                  {vinculacionesList.length === 0 ? (
                    <p className="text-white/50 text-sm">Aún no hay padres vinculados. Crea una relación abajo.</p>
                  ) : (
                    <ul className="space-y-1 text-sm text-white/70">
                      {vinculacionesList.map((v) => (
                        <li key={v._id}>
                          {(v.padreId as any)?.nombre} ({(v.padreId as any)?.email})
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    onClick={() => setRelacionOpen(true)}
                    style={{ background: `linear-gradient(to right, ${colorPrimario}, ${colorSecundario})` }}
                  >
                    <LinkIcon className="w-4 h-4 mr-2" />
                    Crear Nueva Relación
                  </Button>
                  {canConfirmar && (
                    <Button
                      variant="outline"
                      className="border-white/10 text-white"
                      disabled={confirmarVinculacionMutation.isPending}
                      onClick={() => confirmarVinculacionMutation.mutate(vinculoSelectedEstudianteId)}
                    >
                      {confirmarVinculacionMutation.isPending ? 'Confirmando...' : 'Confirmar vinculación'}
                    </Button>
                  )}
                  {canActivar && (
                    <Button
                      variant="outline"
                      className="border-green-500/50 text-green-400 hover:bg-green-500/10"
                      disabled={activarCuentasMutation.isPending}
                      onClick={() => activarCuentasMutation.mutate(vinculoSelectedEstudianteId)}
                    >
                      {activarCuentasMutation.isPending ? 'Activando...' : 'Activar cuentas'}
                    </Button>
                  )}
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={relacionOpen} onOpenChange={setRelacionOpen}>
        <DialogContent className="bg-[#0b0013] border-white/10 text-white">
          <DialogHeader>
            <DialogTitle>Crear vinculación Padre – Estudiante</DialogTitle>
            <DialogDescription className="text-white/60">Selecciona el padre y el estudiante para vincular.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-white/90 mb-2 block">Estudiante *</Label>
              <Select value={vinculoEstudianteId} onValueChange={setVinculoEstudianteId}>
                <SelectTrigger className="bg-white/5 border-white/10 text-white">
                  <SelectValue placeholder="Elige estudiante" />
                </SelectTrigger>
                <SelectContent className="bg-[#0b0013] border-white/10">
                  {estudiantesVinculo.map((e) => (
                    <SelectItem key={e._id} value={e._id} className="text-white focus:bg-white/10">{e.nombre} ({e.email})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-white/90 mb-2 block">Padre *</Label>
              <Select value={vinculoPadreId} onValueChange={setVinculoPadreId}>
                <SelectTrigger className="bg-white/5 border-white/10 text-white">
                  <SelectValue placeholder="Elige padre" />
                </SelectTrigger>
                <SelectContent className="bg-[#0b0013] border-white/10">
                  {padresVinculo.map((p) => (
                    <SelectItem key={p._id} value={p._id} className="text-white focus:bg-white/10">{p.nombre} ({p.email})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button
                disabled={!vinculoEstudianteId || !vinculoPadreId || crearVinculacionMutation.isPending}
                style={{ background: `linear-gradient(to right, ${colorPrimario}, ${colorSecundario})` }}
                onClick={() => crearVinculacionMutation.mutate({ estudianteId: vinculoEstudianteId, padreId: vinculoPadreId })}
              >
                {crearVinculacionMutation.isPending ? 'Creando...' : 'Crear vínculo'}
              </Button>
              <Button variant="outline" className="border-white/10 text-white" onClick={() => setRelacionOpen(false)}>Cancelar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
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
              variant={activeSection === 'carga-masiva' ? 'default' : 'ghost'}
              onClick={() => setActiveSection('carga-masiva')}
              className={activeSection === 'carga-masiva' ? '' : 'text-white/70'}
            >
              <Upload className="w-4 h-4 mr-2" />
              Carga masiva
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
                    placeholder="Ej: 7A, 8B, 11H"
                  />
                  <p className="text-xs text-white/50 mt-1">Ingresa el curso completo (ej: 7A, 8B, 11H)</p>
                </div>
                <div>
                  <Label htmlFor="seccion" className="text-white/90">Sección *</Label>
                  <Select
                    value={newCourse.seccion}
                    onValueChange={(value) => setNewCourse({ ...newCourse, seccion: value })}
                  >
                    <SelectTrigger className="bg-white/5 border-white/10 text-white mt-1">
                      <SelectValue placeholder="Selecciona la sección" />
                    </SelectTrigger>
                    <SelectContent className="bg-[#0b0013] border-white/10">
                      <SelectItem value="junior-school" className="text-white focus:bg-white/10">
                        Junior School
                      </SelectItem>
                      <SelectItem value="middle-school" className="text-white focus:bg-white/10">
                        Middle School
                      </SelectItem>
                      <SelectItem value="high-school" className="text-white focus:bg-white/10">
                        High School
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-white/50 mt-1">Selecciona la sección del colegio</p>
                </div>
                <div>
                  <Label htmlFor="directorGrupo" className="text-white/90">Director de Grupo (opcional)</Label>
                  <Select
                    value={newCourse.directorGrupo || '__none__'}
                    onValueChange={(value) => setNewCourse({ ...newCourse, directorGrupo: value })}
                  >
                    <SelectTrigger className="bg-white/5 border-white/10 text-white mt-1">
                      <SelectValue placeholder="Sin director por ahora" />
                    </SelectTrigger>
                    <SelectContent className="bg-[#0b0013] border-white/10">
                      <SelectItem value="__none__" className="text-white/70 focus:bg-white/10">
                        Sin director (asignar después)
                      </SelectItem>
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
                  <p className="text-xs text-white/50 mt-1">Los cursos pueden crearse primero; el director se puede asignar después</p>
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
                  <p className="text-xs text-white/50 mt-1">
                    {createUserType === 'estudiante' 
                      ? 'El correo funciona como usuario. Se genera una contraseña temporal automáticamente. El estudiante no puede iniciar sesión hasta vincularse con un padre y activar la cuenta.'
                      : 'Se genera una contraseña temporal automáticamente. La cuenta solo funciona para este colegio.'}
                  </p>
                </div>
                {createUserType === 'profesor' && (
                  <>
                    <div>
                      <Label className="text-white/90 mb-2 block">Materia que dicta *</Label>
                      <Input
                        value={newUser.materiaNombre}
                        onChange={(e) => setNewUser({ ...newUser, materiaNombre: e.target.value.trim() })}
                        className="bg-white/5 border-white/10 text-white"
                        placeholder="Ej: Matemáticas, Ciencias, Español"
                      />
                      <p className="text-xs text-white/50 mt-1">La materia es un campo del profesor. Luego podrás asignarlo a cursos/grupos.</p>
                    </div>
                    <div>
                      <Label className="text-white/90 mb-2 block">Vincular a materias existentes (opcional)</Label>
                      <Select
                        value=""
                        onValueChange={(materiaId) => {
                          if (materiaId && !newUser.materias.includes(materiaId)) {
                            setNewUser({ ...newUser, materias: [...newUser.materias, materiaId] });
                          }
                        }}
                      >
                        <SelectTrigger className="bg-white/5 border-white/10 text-white">
                          <SelectValue placeholder="Selecciona una materia" />
                        </SelectTrigger>
                        <SelectContent className="bg-[#0b0013] border-white/10">
                          {coursesList.map((c) => (
                            <SelectItem key={c._id} value={c._id} className="text-white focus:bg-white/10">
                              {c.nombre}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {newUser.materias.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-2">
                          {newUser.materias.map((mId) => {
                            const materia = coursesList.find((c) => c._id === mId);
                            return materia ? (
                              <Badge key={mId} className="bg-white/10 text-white border-white/20">
                                {materia.nombre}
                                <button
                                  onClick={() => setNewUser({ ...newUser, materias: newUser.materias.filter((id) => id !== mId) })}
                                  className="ml-2 hover:text-red-400"
                                >
                                  ×
                                </button>
                              </Badge>
                            ) : null;
                          })}
                        </div>
                      )}
                    </div>
                    <div>
                      <Label className="text-white/90 mb-2 block">Cursos/Grupos asignados (opcional)</Label>
                      <Select
                        value=""
                        onValueChange={(grupoNombre) => {
                          if (grupoNombre && !newUser.cursos.includes(grupoNombre)) {
                            setNewUser({ ...newUser, cursos: [...newUser.cursos, grupoNombre] });
                          }
                        }}
                      >
                        <SelectTrigger className="bg-white/5 border-white/10 text-white">
                          <SelectValue placeholder="Selecciona un curso/grupo" />
                        </SelectTrigger>
                        <SelectContent className="bg-[#0b0013] border-white/10">
                          {gruposList.map((g) => (
                            <SelectItem key={g._id} value={g.nombre} className="text-white focus:bg-white/10">
                              {g.nombre}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {newUser.cursos.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-2">
                          {newUser.cursos.map((c) => (
                            <Badge key={c} className="bg-white/10 text-white border-white/20">
                              {c}
                              <button
                                onClick={() => setNewUser({ ...newUser, cursos: newUser.cursos.filter((g) => g !== c) })}
                                className="ml-2 hover:text-red-400"
                              >
                                ×
                              </button>
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                )}
                <div className="flex gap-2">
                  <Button
                    onClick={handleCreateUser}
                    disabled={
                      createUserMutation.isPending ||
                      (createUserType === 'profesor' && !newUser.materiaNombre.trim())
                    }
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
                      setNewUser({ nombre: '', email: '', telefono: '', celular: '', materiaNombre: '', materias: [], cursos: [] });
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

      {/* Caja con información de la cuenta recién creada */}
      <Dialog open={!!createdUserInfo} onOpenChange={(open) => !open && setCreatedUserInfo(null)}>
        <DialogContent className="bg-[#0b0013] border-white/10 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Check className="w-5 h-5 text-green-400" />
              Cuenta creada
            </DialogTitle>
            <DialogDescription className="text-white/60">
              Guarda esta información; la contraseña no se volverá a mostrar.
            </DialogDescription>
          </DialogHeader>
          {createdUserInfo && (
            <div className="space-y-4 pt-2">
              <div className="rounded-lg border border-white/20 bg-white/5 p-4 space-y-3">
                <div>
                  <p className="text-xs text-white/50 uppercase tracking-wider mb-1">Nombre</p>
                  <p className="text-white font-medium">{createdUserInfo.nombre}</p>
                </div>
                <div>
                  <p className="text-xs text-white/50 uppercase tracking-wider mb-1">Usuario (email para iniciar sesión)</p>
                  <p className="text-white font-mono text-sm break-all">{createdUserInfo.email}</p>
                </div>
                <div>
                  <p className="text-xs text-white/50 uppercase tracking-wider mb-1">Contraseña generada</p>
                  <p className="text-amber-300 font-mono text-sm bg-amber-500/10 px-3 py-2 rounded border border-amber-500/30 break-all select-all">
                    {createdUserInfo.passwordTemporal}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-white/50 uppercase tracking-wider mb-1">Rol</p>
                  <p className="text-white capitalize">{createdUserInfo.rol}</p>
                </div>
              </div>
              <p className="text-white/60 text-sm">
                Esta cuenta ya puede iniciar sesión con el usuario y la contraseña de arriba.
              </p>
              <Button
                className="w-full"
                style={{ background: `linear-gradient(to right, ${colorPrimario}, ${colorSecundario})` }}
                onClick={() => setCreatedUserInfo(null)}
              >
                Entendido
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Diálogo: Información de la cuenta (al hacer clic en un usuario) */}
      <Dialog
        open={editUserOpen}
        onOpenChange={(open) => {
          if (!open) setResetPasswordBox(null);
          setEditUserOpen(open);
        }}
      >
        <DialogContent className="bg-[#0b0013] border-white/10 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white">Información de la cuenta</DialogTitle>
            <DialogDescription className="text-white/60">
              Datos de la cuenta. Usuario de login = email.
            </DialogDescription>
          </DialogHeader>
          {selectedUser && (
            <div className="space-y-4 pt-2">
              {/* Caja tras restablecer contraseña: nueva contraseña + info + copiar */}
              {resetPasswordBox && (
                <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 space-y-3">
                  <div className="flex items-center gap-2 text-amber-300 font-medium">
                    <KeyRound className="w-4 h-4" />
                    Contraseña restablecida
                  </div>
                  <div>
                    <p className="text-xs text-white/50 uppercase tracking-wider mb-1">Nombre</p>
                    <p className="text-white font-medium">{selectedUser.nombre}</p>
                  </div>
                  <div>
                    <p className="text-xs text-white/50 uppercase tracking-wider mb-1">Usuario (email)</p>
                    <p className="text-white font-mono text-sm break-all">{selectedUser.email}</p>
                  </div>
                  <div>
                    <p className="text-xs text-white/50 uppercase tracking-wider mb-1">Nueva contraseña</p>
                    <p className="text-amber-300 font-mono text-sm bg-black/20 px-3 py-2 rounded border border-amber-500/30 break-all select-all">
                      {resetPasswordBox.passwordTemporal}
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    className="w-full border-amber-500/40 text-amber-300 hover:bg-amber-500/20"
                    onClick={() => {
                      navigator.clipboard.writeText(resetPasswordBox.passwordTemporal);
                      setCopyFeedback(true);
                      setTimeout(() => setCopyFeedback(false), 2000);
                    }}
                  >
                    <Copy className="w-4 h-4 mr-2" />
                    {copyFeedback ? 'Copiado' : 'Copiar contraseña'}
                  </Button>
                </div>
              )}
              <div className="grid gap-2">
                <p className="text-sm text-white/60">Nombre</p>
                <p className="text-white font-medium">{selectedUser.nombre}</p>
              </div>
              <div className="grid gap-2">
                <p className="text-sm text-white/60">Usuario (email para iniciar sesión)</p>
                <p className="text-white font-mono text-sm break-all">{selectedUser.email}</p>
              </div>
              <div className="grid gap-2">
                <p className="text-sm text-white/60">Contraseña</p>
                {userPasswordTemporal[selectedUser._id] ? (
                  <p className="text-amber-300 font-mono text-sm bg-white/5 px-3 py-2 rounded border border-amber-500/30 break-all select-all">
                    {userPasswordTemporal[selectedUser._id]}
                  </p>
                ) : (
                  <p className="text-white/50 text-sm">Solo visible al crear o al restablecer. Usa el botón de abajo para generar una nueva.</p>
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="border-white/20 text-white hover:bg-white/10 w-fit"
                  disabled={resetPasswordMutation.isPending}
                  onClick={() => resetPasswordMutation.mutate(selectedUser._id)}
                >
                  <KeyRound className="w-4 h-4 mr-2" />
                  {resetPasswordMutation.isPending ? 'Generando...' : 'Restablecer contraseña'}
                </Button>
              </div>
              <div className="grid gap-2">
                <p className="text-sm text-white/60">Rol</p>
                <p className="text-white capitalize">{selectedUser.rol || activeTab}</p>
              </div>
              <div className="grid gap-2">
                <p className="text-sm text-white/60">Estado</p>
                <Badge
                  className={
                    selectedUser.estado === 'active'
                      ? 'bg-green-500/20 text-green-400'
                      : selectedUser.estado === 'vinculado'
                      ? 'bg-blue-500/20 text-blue-400'
                      : selectedUser.estado === 'pendiente_vinculacion'
                      ? 'bg-amber-500/20 text-amber-400'
                      : 'bg-white/10 text-white'
                  }
                >
                  {selectedUser.estado === 'active' ? 'Activo' : selectedUser.estado === 'vinculado' ? 'Vinculado' : selectedUser.estado === 'pendiente_vinculacion' ? 'Pend. vinculación' : selectedUser.estado || '—'}
                </Badge>
              </div>
              {selectedUser.curso && (
                <div className="grid gap-2">
                  <p className="text-sm text-white/60">Curso / Grupo</p>
                  <p className="text-white">{selectedUser.curso}</p>
                </div>
              )}
              {(selectedUser.telefono || selectedUser.celular) && (
                <div className="grid gap-2">
                  <p className="text-sm text-white/60">Contacto</p>
                  <p className="text-white/80 text-sm">
                    {selectedUser.telefono && `Tel: ${selectedUser.telefono}`}
                    {selectedUser.telefono && selectedUser.celular && ' · '}
                    {selectedUser.celular && `Cel: ${selectedUser.celular}`}
                  </p>
                </div>
              )}
              {selectedUser.codigoUnico && (
                <div className="grid gap-2">
                  <p className="text-sm text-white/60">Código único</p>
                  <p className="text-white font-mono">{selectedUser.codigoUnico}</p>
                </div>
              )}
              {Array.isArray(selectedUser.materias) && selectedUser.materias.length > 0 && (
                <div className="grid gap-2">
                  <p className="text-sm text-white/60">Materia(s)</p>
                  <p className="text-white/80 text-sm">{selectedUser.materias.join(', ')}</p>
                </div>
              )}
              <Button
                variant="outline"
                className="mt-2 border-white/10 text-white"
                onClick={() => setEditUserOpen(false)}
              >
                Cerrar
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
