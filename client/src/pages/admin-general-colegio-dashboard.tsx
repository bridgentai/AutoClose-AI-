import React, { useState, useMemo, useEffect } from 'react';
import { useAuth } from '@/lib/authContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useInstitutionColors } from '@/hooks/useInstitutionColors';
import {
  Users, GraduationCap, BookOpen, UserPlus, Plus, Edit, Trash2,
  X, Check, Settings, Bot, Link as LinkIcon, Eye, EyeOff,
  LayoutDashboard, UserCog, School, BookMarked, FileText, Brain, Search, Upload, KeyRound, Copy, ScrollText, LayoutGrid,
  Shield, UserCheck, ChevronDown, ChevronUp, ChevronRight, Download, UserX, Database, Play
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
  asistentes?: number;
  cursos: number;
  materias: number;
  asistenciaResumen?: { totalRegistros: number; presentes: number; porcentajePromedio: number };
}

export function AdminGeneralColegioDashboard() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { colorPrimario, colorSecundario } = useInstitutionColors();
  
  const [activeSection, setActiveSection] = useState<'dashboard' | 'usuarios' | 'cursos' | 'materias' | 'vinculos' | 'carga-masiva' | 'accesos' | 'auditoria'>('dashboard');
  const [activeTab, setActiveTab] = useState<'estudiantes' | 'profesores' | 'padres' | 'directivos' | 'asistentes'>('estudiantes');
  const [searchTerm, setSearchTerm] = useState('');

  // Limpiar búsqueda cuando cambia el tab
  useEffect(() => {
    setSearchTerm('');
  }, [activeTab]);
  
  // Estados para diálogos
  const [createUserOpen, setCreateUserOpen] = useState(false);
  const [createUserType, setCreateUserType] = useState<'estudiante' | 'profesor' | 'padre' | 'directivo' | 'asistente' | 'curso'>('estudiante');
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
  // Asignaciones contextuales en Cursos
  const [assignProfToGroupsProfessorId, setAssignProfToGroupsProfessorId] = useState('');
  const [assignProfToGroupsGroupNames, setAssignProfToGroupsGroupNames] = useState<string[]>([]);
  const [addStudentIdForGroup, setAddStudentIdForGroup] = useState('');
  const [moveStudentTargets, setMoveStudentTargets] = useState<Record<string, string>>({});
  const [profChangeSelections, setProfChangeSelections] = useState<Record<string, string>>({});
  // Caja con datos de la cuenta recién creada (en lugar del mensaje gris externo)
  const [createdUserInfo, setCreatedUserInfo] = useState<{
    nombre: string;
    email: string;
    rol: string;
    passwordTemporal: string;
    _id: string;
    cuentasCreadas?: Array<{ rol: string; nombre: string; email: string; passwordTemporal: string }>;
  } | null>(null);
  // Caja con la nueva contraseña tras restablecer (en el diálogo de información de cuenta)
  const [resetPasswordBox, setResetPasswordBox] = useState<{ passwordTemporal: string } | null>(null);
  const [copyFeedback, setCopyFeedback] = useState(false);
  // Filtros auditoría
  const [auditAction, setAuditAction] = useState('');
  const [auditEntityType, setAuditEntityType] = useState('');
  const [auditStartDate, setAuditStartDate] = useState('');
  const [auditEndDate, setAuditEndDate] = useState('');
  // Crear nueva materia
  const [createMateriaOpen, setCreateMateriaOpen] = useState(false);
  const [nuevaMateriaNombre, setNuevaMateriaNombre] = useState('');
  const [nuevaMateriaDescripcion, setNuevaMateriaDescripcion] = useState('');
  // Editar materia
  const [editMateriaOpen, setEditMateriaOpen] = useState(false);
  const [editingMateria, setEditingMateria] = useState<{ id: string; nombre: string; area: string | null } | null>(null);
  const [editMateriaTab, setEditMateriaTab] = useState<'detalles' | 'cursos'>('detalles');
  // Control de accesos
  const [accessControlFeature, setAccessControlFeature] = useState('');
  const [accessControlReason, setAccessControlReason] = useState('');
  const [accessControlExpires, setAccessControlExpires] = useState('');
  // Editar usuario
  const [editUserFields, setEditUserFields] = useState({ nombre: '', email: '', telefono: '' });
  const [editUserMode, setEditUserMode] = useState<'view' | 'edit'>('view');
  // Vinculos: buscar estudiante
  const [vincBusqueda, setVincBusqueda] = useState('');
  const [vincEstudianteId, setVincEstudianteId] = useState('');
  const [vincPadreId, setVincPadreId] = useState('');
  const [vincAddPadreOpen, setVincAddPadreOpen] = useState(false);
  // Auditoría: filtro por usuario
  const [auditUserSearch, setAuditUserSearch] = useState('');
  // Cursos: expandir estudiantes por grupo
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  // Carga masiva: sub-pestaña (Excel vs Consola SQL Neon)
  const [cargaMasivaTab, setCargaMasivaTab] = useState<'excel' | 'sql'>('excel');
  const [sqlConsoleInput, setSqlConsoleInput] = useState('');
  const [sqlConsoleResult, setSqlConsoleResult] = useState<{
    type: 'select';
    rows: Record<string, unknown>[];
    fields: string[];
  } | { type: 'mutation'; rowCount: number } | { type: 'error'; message: string } | null>(null);

  const isAdminColegio = user?.rol === 'admin-general-colegio' || user?.rol === 'school_admin';

  // Obtener estadísticas
  const { data: stats, isLoading: statsLoading } = useQuery<Stats>({
    queryKey: ['adminStats', user?.colegioId],
    queryFn: () => apiRequest<Stats>('GET', '/api/users/stats'),
    enabled: !!user?.colegioId && (isAdminColegio || user?.rol === 'directivo'),
  });

  // Mapear tab (plural) a rol del API (singular)
  const tabToRol: Record<string, string> = {
    estudiantes: 'estudiante',
    profesores: 'profesor',
    padres: 'padre',
    directivos: 'directivo',
    asistentes: 'asistente',
  };
  const rolForApi = tabToRol[activeTab] || activeTab;

  // Obtener usuarios por rol
  const { data: usuarios = [], isLoading: usuariosLoading } = useQuery<User[]>({
    queryKey: ['usuariosByRole', rolForApi, user?.colegioId],
    queryFn: () => apiRequest<User[]>('GET', `/api/users/by-role?rol=${rolForApi}`),
    enabled: !!user?.colegioId && isAdminColegio && !!rolForApi,
  });

  // Materias del colegio (admin): listado con cursos vinculados y profesor.
  // Usar mismo identificador que stats (colegioId / institution_id) para que lista y KPI coincidan.
  const institutionIdForQueries = user?.colegioId ?? (user as { institution_id?: string })?.institution_id;
  interface MateriaItem {
    id: string;
    _id: string;
    nombre: string;
    descripcion: string | null;
    area: string | null;
    cursos: { groupName: string; teacherId: string; teacherName: string; groupSubjectId: string }[];
  }
  const { data: materiasList = [], isLoading: materiasLoading, isError: materiasError, error: materiasErrorDetail } = useQuery<MateriaItem[]>({
    queryKey: ['materiasList', institutionIdForQueries],
    queryFn: () => apiRequest<MateriaItem[]>('GET', '/api/subjects'),
    enabled: !!institutionIdForQueries && isAdminColegio && (activeSection === 'materias' || (createUserOpen && createUserType === 'profesor')),
  });

  const createMateriaMutation = useMutation({
    mutationFn: (body: { nombre: string; descripcion?: string }) =>
      apiRequest<MateriaItem>('POST', '/api/subjects', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['materiasList'] });
      queryClient.invalidateQueries({ queryKey: ['adminStats'] });
      setCreateMateriaOpen(false);
      setNuevaMateriaNombre('');
      setNuevaMateriaDescripcion('');
    },
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

  // Ordenar: estudiantes por curso (grado 9→12) y luego alfabético por nombre; resto por nombre
  const usuariosOrdenados = useMemo(() => {
    const list = [...usuariosFiltrados];
    if (activeTab === 'estudiantes') {
      const ordenCurso = (curso: string | undefined): [number, string] => {
        if (!curso || !curso.trim()) return [0, ''];
        const match = curso.trim().match(/^(\d+)(.*)$/);
        const grado = match ? parseInt(match[1], 10) : 0;
        const letra = (match && match[2]) ? match[2].toUpperCase() : '';
        return [grado, letra];
      };
      list.sort((a, b) => {
        const [gA, lA] = ordenCurso(a.curso);
        const [gB, lB] = ordenCurso(b.curso);
        if (gA !== gB) return gA - gB;
        if (lA !== lB) return lA.localeCompare(lB);
        return (a.nombre || '').localeCompare(b.nombre || '', 'es');
      });
    } else {
      list.sort((a, b) => (a.nombre || '').localeCompare(b.nombre || '', 'es'));
    }
    return list;
  }, [usuariosFiltrados, activeTab]);

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
    materias: [] as string[], // IDs de materias seleccionadas (existentes o recién creadas)
    cursos: [] as string[],
    // Campos exclusivos para crear estudiante
    cursoGrupo: '', // nombre del grupo (ej. "11A")
    padre1Nombre: '',
    padre1Email: '',
    padre2Nombre: '',
    padre2Email: '',
  });
  // Input local para crear materias dentro del modal "Crear Profesor"
  const [newProfesorMateriaNombre, setNewProfesorMateriaNombre] = useState('');
  const [userPasswordTemporal, setUserPasswordTemporal] = useState<Record<string, string>>({});

  // Formulario para crear curso
  const [newCourse, setNewCourse] = useState({
    curso: '',
    seccion: '',
    directorGrupo: '',
  });

  // Módulo Crear Sección: estado y formulario
  const [createSectionOpen, setCreateSectionOpen] = useState(false);
  const [newSectionNombre, setNewSectionNombre] = useState('');
  const [newSectionCursoIds, setNewSectionCursoIds] = useState<string[]>([]);
  const [newSectionNuevosCursos, setNewSectionNuevosCursos] = useState<string[]>([]);
  const [newSectionNuevoCursoInput, setNewSectionNuevoCursoInput] = useState('');
  const [addCursosToSectionId, setAddCursosToSectionId] = useState('');
  const [addCursosToSectionIds, setAddCursosToSectionIds] = useState<string[]>([]);
  const [addCursosToSectionOpen, setAddCursosToSectionOpen] = useState(false);

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
    enabled: !!user?.colegioId && isAdminColegio && (activeSection === 'vinculos' || activeSection === 'cursos'),
  });
  const { data: padresVinculo = [] } = useQuery<User[]>({
    queryKey: ['padresForVinculo', user?.colegioId],
    queryFn: () => apiRequest<User[]>('GET', '/api/users/by-role?rol=padre'),
    enabled: !!user?.colegioId && isAdminColegio && (activeSection === 'vinculos' || activeSection === 'cursos'),
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
  interface GroupMateria {
    group_subject_id: string;
    subject_id: string;
    subject_name: string;
    teacher_id: string;
    teacher_name: string;
  }
  interface GroupItem {
    _id: string;
    nombre: string;
    materias?: GroupMateria[];
    cantidadEstudiantes?: number;
  }
  interface CourseItem { _id: string; nombre: string; cursos?: string[] }
  const { data: gruposList = [] } = useQuery<GroupItem[]>({
    queryKey: ['groupsAll', user?.colegioId],
    queryFn: () => apiRequest<GroupItem[]>('GET', '/api/groups/all'),
    enabled: !!user?.colegioId && isAdminColegio && (activeSection === 'cursos' || activeSection === 'dashboard' || createUserOpen || createSectionOpen),
  });

  interface SectionItem {
    _id: string;
    nombre: string;
    colegioId: string;
    cursos: { _id: string; nombre: string }[];
  }
  const { data: sectionsList = [], refetch: refetchSections } = useQuery<SectionItem[]>({
    queryKey: ['sections', user?.colegioId],
    queryFn: () => apiRequest<SectionItem[]>('GET', '/api/sections'),
    enabled: !!user?.colegioId && isAdminColegio && (activeSection === 'cursos' || createSectionOpen || addCursosToSectionOpen),
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
      queryClient.invalidateQueries({ queryKey: ['groupsAll'] });
      setAssignCourseId('');
      setAssignProfessorId('');
    },
  });

  const adminSqlMutation = useMutation({
    mutationFn: (body: { sql: string }) =>
      apiRequest<{ rows?: Record<string, unknown>[]; rowCount?: number; fields?: string[]; command?: string; error?: string }>(
        'POST',
        '/api/admin/sql',
        body
      ),
    onSuccess: (data) => {
      if (data?.error) {
        setSqlConsoleResult({ type: 'error', message: data.error });
        return;
      }
      if (Array.isArray(data?.rows)) {
        setSqlConsoleResult({
          type: 'select',
          rows: data.rows,
          fields: data.fields ?? (data.rows[0] ? Object.keys(data.rows[0]) : []),
        });
        return;
      }
      setSqlConsoleResult({
        type: 'mutation',
        rowCount: data?.rowCount ?? 0,
      });
    },
    onError: (err: Error) => {
      setSqlConsoleResult({ type: 'error', message: err.message ?? 'Error al ejecutar la consulta.' });
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
        const cuentasCreadas = (data as any)?.cuentasCreadas ?? [];
        setCreatedUserInfo({
          _id: data.user._id,
          nombre: data.user.nombre ?? '',
          email: data.user.email ?? '',
          rol: data.user.rol ?? variables?.rol ?? '',
          passwordTemporal,
          cuentasCreadas,
        });
      }
      setCreateUserOpen(false);
      setNewUser({
        nombre: '',
        email: '',
        telefono: '',
        celular: '',
        materias: [],
        cursos: [],
        cursoGrupo: '',
        padre1Nombre: '',
        padre1Email: '',
        padre2Nombre: '',
        padre2Email: '',
      });
      setNewProfesorMateriaNombre('');
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

  const createSectionMutation = useMutation({
    mutationFn: async (payload: { nombre: string; cursoIds: string[]; nuevosCursos: string[] }) => {
      const res = await apiRequest<{ section: { _id: string; nombre: string; cursos: { _id: string; nombre: string }[] } }>(
        'POST',
        '/api/sections',
        { nombre: payload.nombre, cursoIds: payload.cursoIds }
      );
      const sectionId = res?.section?._id;
      if (sectionId && payload.nuevosCursos.length > 0) {
        for (const nombre of payload.nuevosCursos) {
          const name = nombre.trim().toUpperCase();
          if (name) {
            await apiRequest('POST', '/api/groups/create', { nombre: name, sectionId });
          }
        }
      }
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sections', 'groupsAll', 'adminStats'] });
      setCreateSectionOpen(false);
      setNewSectionNombre('');
      setNewSectionCursoIds([]);
      setNewSectionNuevosCursos([]);
      setNewSectionNuevoCursoInput('');
    },
  });

  const addCursosToSectionMutation = useMutation({
    mutationFn: (payload: { sectionId: string; addCursoIds: string[] }) =>
      apiRequest('PATCH', `/api/sections/${payload.sectionId}`, { addCursoIds: payload.addCursoIds }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sections', 'groupsAll'] });
      setAddCursosToSectionOpen(false);
      setAddCursosToSectionId('');
      setAddCursosToSectionIds([]);
      refetchSections();
    },
  });

  // Auditoría: logs del colegio (solo admin)
  const auditParams = new URLSearchParams();
  if (auditAction) auditParams.set('action', auditAction);
  if (auditEntityType) auditParams.set('entityType', auditEntityType);
  if (auditStartDate) auditParams.set('startDate', auditStartDate);
  if (auditEndDate) auditParams.set('endDate', auditEndDate);
  auditParams.set('limit', '50');
  const { data: auditData, isLoading: auditLoading } = useQuery<{ logs: Array<{ _id: string; userId: string; role: string; action: string; entityType: string; entityId?: string; colegioId: string; timestamp: string; result: string; requestData?: Record<string, unknown> }>; total: number }>({
    queryKey: ['auditLogs', user?.colegioId, auditAction, auditEntityType, auditStartDate, auditEndDate],
    queryFn: () => apiRequest('GET', `/api/audit/logs?${auditParams.toString()}`),
    enabled: !!user?.colegioId && isAdminColegio && activeSection === 'auditoria',
  });

  const resetPasswordMutation = useMutation({
    mutationFn: (userId: string) =>
      apiRequest<{ passwordTemporal: string }>('POST', '/api/users/reset-password', { userId }),
    onSuccess: (data, userId) => {
      setResetPasswordBox({ passwordTemporal: data.passwordTemporal });
      setUserPasswordTemporal((prev) => ({ ...prev, [userId]: data.passwordTemporal }));
    },
  });

  // Patch usuario (editar datos básicos)
  const patchUserMutation = useMutation({
    mutationFn: ({ id, ...body }: { id: string; nombre?: string; email?: string; telefono?: string }) =>
      apiRequest('PATCH', `/api/users/${id}`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['usuariosByRole'] });
      setEditUserMode('view');
    },
  });

  // Cambiar status (activar/suspender)
  const changeStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'active' | 'suspended' }) =>
      apiRequest('PATCH', `/api/users/${id}/status`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['usuariosByRole'] });
      setEditUserOpen(false);
    },
  });

  // Control de accesos
  interface AccessControlFeature { id: string; blocked_roles: string[]; reason: string | null; expires_at: string | null }
  const { data: accessControlsData, refetch: refetchAccessControls } = useQuery<{ features: Record<string, AccessControlFeature | null> }>({
    queryKey: ['accessControls', user?.colegioId],
    queryFn: () => apiRequest('GET', '/api/access-controls'),
    enabled: !!user?.colegioId && isAdminColegio && activeSection === 'accesos',
  });
  const toggleAccessMutation = useMutation({
    mutationFn: (payload: { feature: string; enabled: boolean; blocked_roles?: string[]; reason?: string; expires_at?: string | null }) =>
      apiRequest('POST', '/api/access-controls/toggle', payload),
    onSuccess: () => refetchAccessControls(),
  });

  // Editar materia
  const editMateriaMutation = useMutation({
    mutationFn: ({ id, nombre, area }: { id: string; nombre: string; area?: string }) =>
      apiRequest('PATCH', `/api/subjects/${id}`, { nombre, area }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['materiasList'] });
      setEditMateriaOpen(false);
      setEditingMateria(null);
    },
  });

  // Vinculos simplificados: buscar vinculaciones por estudiante
  const { data: vincVinculaciones = [], refetch: refetchVincVinculaciones } = useQuery<VinculacionItem[]>({
    queryKey: ['vincVinculaciones', vincEstudianteId],
    queryFn: () => apiRequest('GET', `/api/users/vinculaciones?estudianteId=${vincEstudianteId}`),
    enabled: !!vincEstudianteId,
  });
  const { data: estudiantesVincSearch = [] } = useQuery<User[]>({
    queryKey: ['estudiantesVincSearch', user?.colegioId],
    queryFn: () => apiRequest<User[]>('GET', '/api/users/by-role?rol=estudiante'),
    enabled: !!user?.colegioId && isAdminColegio && activeSection === 'vinculos',
  });
  const { data: padresVincSearch = [] } = useQuery<User[]>({
    queryKey: ['padresVincSearch', user?.colegioId],
    queryFn: () => apiRequest<User[]>('GET', '/api/users/by-role?rol=padre'),
    enabled: !!user?.colegioId && isAdminColegio && (activeSection === 'vinculos' || vincAddPadreOpen),
  });
  const crearVincMutation = useMutation({
    mutationFn: (payload: { padreId: string; estudianteId: string }) =>
      apiRequest('POST', '/api/users/vinculaciones', payload),
    onSuccess: () => {
      refetchVincVinculaciones();
      setVincPadreId('');
      setVincAddPadreOpen(false);
    },
  });

  // Estudiantes de un grupo (lazy, por groupId)
  const { data: groupStudents = [], refetch: refetchGroupStudents } = useQuery<{ _id: string; nombre: string; estado: string }[]>({
    queryKey: ['groupStudents', expandedGroup],
    queryFn: () => apiRequest('GET', `/api/groups/${expandedGroup}/students`),
    enabled: !!expandedGroup,
  });

  const createSubjectForProfessorMutation = useMutation({
    mutationFn: (body: { nombre: string }) =>
      apiRequest<MateriaItem>('POST', '/api/subjects', body),
    onSuccess: (subject) => {
      queryClient.invalidateQueries({ queryKey: ['materiasList'] });
      setNewUser((prev) => ({
        ...prev,
        materias: prev.materias.includes(subject._id) ? prev.materias : [...prev.materias, subject._id],
      }));
      setNewProfesorMateriaNombre('');
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
      if (createUserType === 'estudiante' && !newUser.padre1Email.trim()) {
        alert('El email del padre/tutor principal es obligatorio.');
        return;
      }
      const payload: Record<string, unknown> = {
        nombre: newUser.nombre,
        email: newUser.email,
        rol: createUserType,
        telefono: newUser.telefono || undefined,
        celular: newUser.celular || undefined,
      };
      if (createUserType === 'estudiante') {
        if (newUser.cursoGrupo) payload.curso = newUser.cursoGrupo;
        payload.padre1Nombre = newUser.padre1Nombre || newUser.padre1Email;
        payload.padre1Email = newUser.padre1Email;
        if (newUser.padre2Email.trim()) {
          payload.padre2Nombre = newUser.padre2Nombre || newUser.padre2Email;
          payload.padre2Email = newUser.padre2Email;
        }
      } else if (createUserType === 'profesor') {
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
      case 'vinculos':
        return renderVinculos();
      case 'carga-masiva':
        return (
          <Card className={CARD_STYLE}>
            <CardHeader>
              <CardTitle className="text-white">Carga masiva y base de datos</CardTitle>
              <CardDescription className="text-white/60">
                Sube usuarios por Excel/CSV o ejecuta consultas SQL directamente en Neon (PostgreSQL).
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs value={cargaMasivaTab} onValueChange={(v) => setCargaMasivaTab(v as 'excel' | 'sql')} className="w-full">
                <TabsList className="bg-white/5 mb-4">
                  <TabsTrigger value="excel" className="text-white data-[state=active]:bg-white/10">
                    <Upload className="w-4 h-4 mr-2" />
                    Carga masiva (Excel/CSV)
                  </TabsTrigger>
                  <TabsTrigger value="sql" className="text-white data-[state=active]:bg-white/10">
                    <Database className="w-4 h-4 mr-2" />
                    Consola SQL (Neon)
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="excel" className="mt-0">
                  <BulkUsersUpload />
                </TabsContent>
                <TabsContent value="sql" className="mt-0 space-y-4">
                  <div>
                    <Label className="text-white/90 mb-2 block">Consulta SQL (solo SELECT, una sentencia por ejecución)</Label>
                    <textarea
                      value={sqlConsoleInput}
                      onChange={(e) => setSqlConsoleInput(e.target.value)}
                      placeholder={'SELECT id, full_name, email, role FROM users WHERE institution_id = \'...\' LIMIT 10;'}
                      className="w-full min-h-[180px] rounded-lg bg-white/5 border border-white/10 text-white placeholder:text-white/40 p-3 font-mono text-sm resize-y"
                      spellCheck={false}
                    />
                    <Button
                      className="mt-2"
                      disabled={!sqlConsoleInput.trim() || adminSqlMutation.isPending}
                      style={{ background: `linear-gradient(to right, ${colorPrimario}, ${colorSecundario})` }}
                      onClick={() => {
                        setSqlConsoleResult(null);
                        const trimmed = sqlConsoleInput.trim();
                        // Solo SELECT permitido
                        if (!/^\s*SELECT\b/i.test(trimmed)) {
                          setSqlConsoleResult({ type: 'error', message: 'Esta operación no está permitida desde la consola.' });
                          return;
                        }
                        // Bloquear queries destructivas
                        if (/\b(DROP|TRUNCATE|DELETE|ALTER\s+TABLE|UPDATE)\b/i.test(trimmed) || trimmed.includes('--')) {
                          setSqlConsoleResult({ type: 'error', message: 'Esta operación no está permitida desde la consola.' });
                          return;
                        }
                        adminSqlMutation.mutate({ sql: trimmed });
                      }}
                    >
                      <Play className="w-4 h-4 mr-2" />
                      {adminSqlMutation.isPending ? 'Ejecutando...' : 'Ejecutar'}
                    </Button>
                  </div>
                  {sqlConsoleResult && (
                    <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
                      {sqlConsoleResult.type === 'select' && (
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm text-left">
                            <thead>
                              <tr className="border-b border-white/10">
                                {sqlConsoleResult.fields.map((f) => (
                                  <th key={f} className="px-3 py-2 text-white/80 font-medium whitespace-nowrap">{f}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {sqlConsoleResult.rows.map((row, i) => (
                                <tr key={i} className="border-b border-white/5">
                                  {sqlConsoleResult.fields.map((f) => (
                                    <td key={f} className="px-3 py-2 text-white/90 whitespace-nowrap">
                                      {row[f] === null || row[f] === undefined ? '—' : String(row[f])}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          <p className="px-3 py-2 text-white/50 text-xs border-t border-white/5">
                            {sqlConsoleResult.rows.length} fila(s)
                          </p>
                        </div>
                      )}
                      {sqlConsoleResult.type === 'mutation' && (
                        <p className="p-4 text-green-400">
                          Ejecutado correctamente. Filas afectadas: {sqlConsoleResult.rowCount}
                        </p>
                      )}
                      {sqlConsoleResult.type === 'error' && (
                        <p className="p-4 text-red-400 font-mono text-sm">{sqlConsoleResult.message}</p>
                      )}
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        );
      case 'accesos':
        return renderControlAccesos();
      case 'auditoria':
        return renderAuditoria();
      default:
        return renderDashboard();
    }
  };

  // 1️⃣ Vista Principal (Dashboard Home) — estilo referencia: encabezado, KPIs, notificación, acciones rápidas
  const renderDashboard = () => {
    const dateStr = new Date().toLocaleDateString('es-CO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const cursosSubtitle = gruposList.length > 0 ? gruposList.map((g) => g.nombre).join(' · ') : '—';
    const kpiCard = (
      onClick: () => void,
      label: string,
      value: string | number,
      subtitle: string,
      icon: React.ReactNode
    ) => (
      <Card
        key={label}
        className={`${CARD_STYLE} cursor-pointer hover:bg-white/10 transition-colors rounded-xl border border-white/10`}
        onClick={onClick}
      >
        <CardContent className="p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-white/50 mb-1">{label}</p>
          <div className="flex items-end justify-between">
            <span className="text-3xl font-bold text-white font-['Poppins']">{value}</span>
            {icon}
          </div>
          <p className="text-xs text-white/60 mt-2">{subtitle}</p>
        </CardContent>
      </Card>
    );
    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white font-['Poppins']">
              Bienvenido, {user?.nombre ?? 'Admin'}
            </h1>
            <p className="text-sm text-white/60 mt-0.5 capitalize">
              {dateStr} · EvoOS Beta
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge className="bg-white/10 border-white/20 text-white/90 font-normal rounded-lg px-3 py-1">
              Año {new Date().getFullYear()}
            </Badge>
            <Badge variant="outline" className="border-white/20 text-white/70 font-normal rounded-lg px-3 py-1">
              Colegio
            </Badge>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {kpiCard(
            () => { setActiveSection('usuarios'); setActiveTab('estudiantes'); },
            'Estudiantes',
            statsLoading ? '...' : (stats?.estudiantes ?? 0),
            gruposList.length > 0 ? `${gruposList.length} grupos activos` : '—',
            <Users className="w-5 h-5 text-white/40 shrink-0" />
          )}

          {kpiCard(
            () => { setActiveSection('usuarios'); setActiveTab('profesores'); },
            'Profesores',
            statsLoading ? '...' : (stats?.profesores ?? 0),
            stats?.materias ? `${stats.materias} materias` : '—',
            <GraduationCap className="w-5 h-5 text-white/40 shrink-0" />
          )}
          {kpiCard(
            () => { setActiveSection('usuarios'); setActiveTab('padres'); },
            'Padres',
            statsLoading ? '...' : (stats?.padres ?? 0),
            'Vinculados',
            <Users className="w-5 h-5 text-white/40 shrink-0" />
          )}
          {kpiCard(
            () => {},
            'Asistencia mes',
            statsLoading ? '...' : (stats?.asistenciaResumen?.totalRegistros ? `${stats?.asistenciaResumen?.porcentajePromedio ?? '—'}%` : '—'),
            stats?.asistenciaResumen?.totalRegistros ? `${stats.asistenciaResumen.presentes ?? 0} presentes / ${stats.asistenciaResumen.totalRegistros} registros` : 'Sin registros',
            null
          )}
          {kpiCard(
            () => setActiveSection('cursos'),
            'Cursos',
            statsLoading ? '...' : (stats?.cursos ?? 0),
            cursosSubtitle,
            <School className="w-5 h-5 text-white/40 shrink-0" />
          )}
          {kpiCard(
            () => setActiveSection('materias'),
            'Materias',
            statsLoading ? '...' : (stats?.materias ?? 0),
            'Todas asignadas',
            <BookOpen className="w-5 h-5 text-white/40 shrink-0" />
          )}
          {kpiCard(
            () => { setActiveSection('usuarios'); setActiveTab('directivos'); },
            'Directivos',
            statsLoading ? '...' : (stats?.directivos ?? 0),
            (stats?.directivos ?? 0) > 0 ? 'Directiva' : '—',
            <UserCog className="w-5 h-5 text-white/40 shrink-0" />
          )}
          {kpiCard(
            () => { setActiveSection('usuarios'); setActiveTab('asistentes'); },
            'Asistentes',
            statsLoading ? '...' : (stats?.asistentes ?? 0),
            '—',
            <UserCog className="w-5 h-5 text-white/40 shrink-0" />
          )}
        </div>

        <Card className={`${CARD_STYLE} rounded-xl border border-white/10`}>
          <CardContent className="p-4 flex flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-2.5 h-2.5 rounded-full bg-[#3B82F6]" />
              <div>
                <p className="text-white font-medium">Evo Send — PQRs</p>
                <p className="text-xs text-white/60">Solicitudes y mensajes</p>
              </div>
            </div>
            <Button
              variant="outline"
              className="border-white/20 text-white shrink-0"
              onClick={() => setLocation('/comunicacion')}
            >
              Ver comunicación
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </CardContent>
        </Card>
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-white/50 mb-4">Acciones rápidas</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <button
              type="button"
              onClick={() => { setCreateUserType('estudiante'); setCreateUserOpen(true); }}
              className="flex flex-col items-center justify-center gap-2 h-24 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-white transition-colors"
            >
              <UserPlus className="w-6 h-6 text-white/80" />
              <span className="text-sm">Crear estudiante</span>
            </button>
            <button
              type="button"
              onClick={() => { setCreateUserType('profesor'); setCreateUserOpen(true); }}
              className="flex flex-col items-center justify-center gap-2 h-24 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-white transition-colors"
            >
              <GraduationCap className="w-6 h-6 text-white/80" />
              <span className="text-sm">Crear profesor</span>
            </button>
            <button
              type="button"
              onClick={() => { setCreateUserType('padre'); setCreateUserOpen(true); }}
              className="flex flex-col items-center justify-center gap-2 h-24 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-white transition-colors"
            >
              <Users className="w-6 h-6 text-white/80" />
              <span className="text-sm">Crear padre</span>
            </button>
            <button
              type="button"
              onClick={() => { setCreateUserType('curso'); setNewCourse({ curso: '', seccion: '', directorGrupo: '' }); setCreateUserOpen(true); }}
              className="flex flex-col items-center justify-center gap-2 h-24 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-white transition-colors"
            >
              <School className="w-6 h-6 text-white/80" />
              <span className="text-sm">Crear curso</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveSection('accesos')}
              className="flex flex-col items-center justify-center gap-2 h-24 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-white transition-colors"
            >
              <Shield className="w-6 h-6 text-white/80" />
              <span className="text-sm">Control accesos</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveSection('materias')}
              className="flex flex-col items-center justify-center gap-2 h-24 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-white transition-colors"
            >
              <BookOpen className="w-6 h-6 text-white/80" />
              <span className="text-sm">Crear materia</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveSection('auditoria')}
              className="flex flex-col items-center justify-center gap-2 h-24 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-white transition-colors"
            >
              <ScrollText className="w-6 h-6 text-white/80" />
              <span className="text-sm">Auditoría</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveSection('carga-masiva')}
              className="flex flex-col items-center justify-center gap-2 h-24 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-white transition-colors"
            >
              <Upload className="w-6 h-6 text-white/80" />
              <span className="text-sm">Carga masiva</span>
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-3">
            <button
              type="button"
              onClick={() => { setCreateUserType('directivo'); setCreateUserOpen(true); }}
              className="flex flex-col items-center justify-center gap-2 h-20 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-white transition-colors"
            >
              <UserCog className="w-5 h-5 text-white/80" />
              <span className="text-sm">Crear directiva</span>
            </button>
            <button
              type="button"
              onClick={() => { setCreateUserType('asistente'); setCreateUserOpen(true); }}
              className="flex flex-col items-center justify-center gap-2 h-20 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-white transition-colors"
            >
              <UserCog className="w-5 h-5 text-white/80" />
              <span className="text-sm">Crear asistente</span>
            </button>
            <button
              type="button"
              onClick={() => { setCreateSectionOpen(true); setNewSectionNombre(''); setNewSectionCursoIds([]); setNewSectionNuevosCursos([]); setNewSectionNuevoCursoInput(''); }}
              className="flex flex-col items-center justify-center gap-2 h-20 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-white transition-colors"
            >
              <LayoutGrid className="w-5 h-5 text-white/80" />
              <span className="text-sm">Crear sección</span>
            </button>
          </div>
        </div>
      </div>
    );
  };

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
            <TabsList className="grid w-full grid-cols-5 bg-white/5">
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
              <TabsTrigger value="asistentes" className="text-white data-[state=active]:bg-white/10">
                Asistentes
              </TabsTrigger>
            </TabsList>

            <TabsContent value={activeTab} className="mt-6">
              <div className="space-y-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-white/40" />
                  <Input
                    type="text"
                    placeholder={`Buscar ${activeTab === 'estudiantes' ? 'estudiantes' : activeTab === 'profesores' ? 'profesores' : activeTab === 'padres' ? 'padres' : activeTab === 'directivos' ? 'directivos' : 'asistentes'} por nombre, email${activeTab === 'estudiantes' ? ' o curso' : ''}...`}
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
                      Mostrando {usuariosOrdenados.length} de {usuarios.length} {activeTab}
                      {activeTab === 'estudiantes' && ' (orden: curso 9→12, luego alfabético por nombre)'}
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
                          {usuariosOrdenados.map((usuario) => (
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
                                    title={usuario.estado === 'active' ? 'Suspender' : 'Activar'}
                                    onClick={() => {
                                      const newStatus = usuario.estado === 'active' ? 'suspended' : 'active';
                                      if (window.confirm(`¿${newStatus === 'suspended' ? 'Suspender' : 'Activar'} la cuenta de ${usuario.nombre}?`)) {
                                        changeStatusMutation.mutate({ id: usuario._id, status: newStatus });
                                      }
                                    }}
                                  >
                                    {usuario.estado === 'active' ? <UserX className="w-4 h-4 text-red-400" /> : <UserCheck className="w-4 h-4 text-green-400" />}
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

  // 4️⃣ Cursos y Estructura Académica (flujo: 1.Secciones 2.Cursos 3.Profesores 4.Asignaciones 5.Estudiantes)
  const renderCursos = () => (
    <div className="space-y-6">
      <Card className={CARD_STYLE}>
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <LayoutGrid className="w-5 h-5" />
            Secciones
          </CardTitle>
          <CardDescription className="text-white/60">
            Agrupa cursos en secciones (ej. Primaria, Bachillerato). Puedes crear una sección y añadir cursos al crearla o después.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {sectionsList.length === 0 ? (
            <p className="text-white/60 text-sm">No hay secciones. Usa &quot;Crear Sección&quot; en Acciones Rápidas.</p>
          ) : (
            <div className="space-y-3">
              {sectionsList.map((sec) => (
                <div
                  key={sec._id}
                  className="flex flex-wrap items-center justify-between gap-2 p-4 rounded-xl bg-white/5 border border-white/10"
                >
                  <div>
                    <span className="font-semibold text-white">{sec.nombre}</span>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {sec.cursos.length === 0 ? (
                        <span className="text-white/50 text-sm">Sin cursos</span>
                      ) : (
                        sec.cursos.map((c) => (
                          <Badge key={c._id} className="bg-white/10 text-white border-white/20">
                            {c.nombre}
                          </Badge>
                        ))
                      )}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-white/10 text-white hover:bg-white/10"
                    onClick={() => {
                      setAddCursosToSectionId(sec._id);
                      setAddCursosToSectionIds([]);
                      setAddCursosToSectionOpen(true);
                    }}
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Añadir cursos
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
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
          <CardTitle className="text-white">Cursos y detalles</CardTitle>
          <CardDescription className="text-white/60">Selecciona un curso para ver sus estudiantes, materias y profesores asociados.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {gruposList.map((g) => (
              <Button
                key={g._id}
                size="sm"
                variant={expandedGroup === g._id ? 'default' : 'outline'}
                className={expandedGroup === g._id ? '' : 'border-white/10 text-white/70'}
                onClick={() => {
                  setExpandedGroup(expandedGroup === g._id ? null : g._id);
                  setAddStudentIdForGroup('');
                }}
              >
                {expandedGroup === g._id ? <ChevronUp className="w-3 h-3 mr-1" /> : <ChevronDown className="w-3 h-3 mr-1" />}
                {g.nombre}
              </Button>
            ))}
          </div>
          {expandedGroup && (
            <div className="rounded-xl border border-white/10 bg-white/5">
              {(() => {
                const currentGroup = gruposList.find((g) => g._id === expandedGroup);
                if (!currentGroup) {
                  return <p className="p-3 text-white/50 text-sm">No se encontró información para este curso.</p>;
                }
                return (
                  <div className="divide-y divide-white/5">
                    <div className="p-4 flex items-center justify-between">
                      <div>
                        <p className="text-white font-semibold text-sm">{currentGroup.nombre}</p>
                        <p className="text-white/60 text-xs">
                          {typeof currentGroup.cantidadEstudiantes === 'number'
                            ? `${currentGroup.cantidadEstudiantes} estudiante(s) inscritos`
                            : 'Resumen del curso'}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Label className="text-white/80 text-xs">Agregar estudiante a este curso</Label>
                        <Select
                          value={addStudentIdForGroup}
                          onValueChange={setAddStudentIdForGroup}
                        >
                          <SelectTrigger className="bg-white/5 border-white/10 text-white h-8 w-56 text-xs">
                            <SelectValue placeholder="Selecciona estudiante" />
                          </SelectTrigger>
                          <SelectContent className="bg-[#0a0a2a] border-white/10">
                            {estudiantesForAssign.map((e) => (
                              <SelectItem key={e._id} value={e._id} className="text-white focus:bg-white/10 text-xs">
                                {e.nombre} ({e.email})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          size="sm"
                          disabled={!addStudentIdForGroup || assignStudentMutation.isPending}
                          onClick={() => {
                            if (!addStudentIdForGroup) return;
                            assignStudentMutation.mutate({
                              grupoId: currentGroup.nombre,
                              estudianteId: addStudentIdForGroup,
                            });
                            setAddStudentIdForGroup('');
                            refetchGroupStudents();
                          }}
                          style={{ background: `linear-gradient(to right, ${colorPrimario}, ${colorSecundario})` }}
                        >
                          {assignStudentMutation.isPending ? 'Agregando...' : 'Agregar'}
                        </Button>
                      </div>
                    </div>

                    <div className="p-4 space-y-3">
                      <p className="text-white/80 text-sm font-medium">Estudiantes matriculados</p>
                      {groupStudents.length === 0 ? (
                        <p className="text-white/50 text-sm">Sin estudiantes inscritos en este curso.</p>
                      ) : (
                        <div className="space-y-2">
                          {groupStudents.map((s) => (
                            <div key={s._id} className="flex flex-wrap items-center justify-between gap-3 px-2 py-1.5 rounded-lg bg-white/5 border border-white/5">
                              <div className="flex items-center gap-2">
                                <span className="text-white text-sm">{s.nombre}</span>
                                <Badge className={s.estado === 'active' ? 'bg-green-500/20 text-green-400' : 'bg-amber-500/20 text-amber-400'}>
                                  {s.estado === 'active' ? 'Activo' : s.estado}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-2">
                                <Select
                                  value={moveStudentTargets[s._id] ?? ''}
                                  onValueChange={(v) =>
                                    setMoveStudentTargets((prev) => ({ ...prev, [s._id]: v }))
                                  }
                                >
                                  <SelectTrigger className="bg-white/5 border-white/10 text-white h-8 w-40 text-xs">
                                    <SelectValue placeholder="Mover a otro curso" />
                                  </SelectTrigger>
                                  <SelectContent className="bg-[#0a0a2a] border-white/10">
                                    {gruposList
                                      .filter((g) => g._id !== expandedGroup)
                                      .map((g) => (
                                        <SelectItem
                                          key={g._id}
                                          value={g.nombre}
                                          className="text-white focus:bg-white/10 text-xs"
                                        >
                                          {g.nombre}
                                        </SelectItem>
                                      ))}
                                  </SelectContent>
                                </Select>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="border-white/20 text-white/80"
                                  disabled={!moveStudentTargets[s._id] || assignStudentMutation.isPending}
                                  onClick={() => {
                                    const target = moveStudentTargets[s._id];
                                    if (!target) return;
                                    assignStudentMutation.mutate({
                                      grupoId: target,
                                      estudianteId: s._id,
                                    });
                                  }}
                                >
                                  Mover a otro curso
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="p-4 border-t border-white/5 space-y-3">
                      <p className="text-white/80 text-sm font-medium">Materias y profesores</p>
                      {!currentGroup.materias || currentGroup.materias.length === 0 ? (
                        <p className="text-white/50 text-sm">Este curso aún no tiene materias asignadas.</p>
                      ) : (
                        <div className="space-y-2">
                          {currentGroup.materias.map((m) => (
                            <div
                              key={m.group_subject_id}
                              className="flex flex-wrap items-center justify-between gap-3 px-2 py-1.5 rounded-lg bg-white/5 border border-white/5"
                            >
                              <div>
                                <p className="text-white text-sm font-medium">{m.subject_name}</p>
                                <p className="text-white/60 text-xs">
                                  Profesor actual: {m.teacher_name || 'Sin asignar'}
                                </p>
                              </div>
                              <div className="flex items-center gap-2">
                                <Select
                                  value={profChangeSelections[m.group_subject_id] ?? ''}
                                  onValueChange={(v) =>
                                    setProfChangeSelections((prev) => ({
                                      ...prev,
                                      [m.group_subject_id]: v,
                                    }))
                                  }
                                >
                                  <SelectTrigger className="bg-white/5 border-white/10 text-white h-8 w-44 text-xs">
                                    <SelectValue placeholder="Cambiar profesor" />
                                  </SelectTrigger>
                                  <SelectContent className="bg-[#0a0a2a] border-white/10">
                                    {profesoresForAssign.map((p) => (
                                      <SelectItem
                                        key={p._id}
                                        value={p._id}
                                        className="text-white focus:bg-white/10 text-xs"
                                      >
                                        {p.nombre} ({p.email})
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="border-white/20 text-white/80"
                                  disabled={
                                    !profChangeSelections[m.group_subject_id] ||
                                    assignProfessorMutation.isPending
                                  }
                                  onClick={() => {
                                    const profId = profChangeSelections[m.group_subject_id];
                                    if (!profId) return;
                                    assignProfessorMutation.mutate({
                                      courseId: m.group_subject_id,
                                      professorId: profId,
                                    });
                                  }}
                                >
                                  Cambiar profesor
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );

  // 5️⃣ Materias
  const renderMaterias = () => (
    <div className="space-y-6">
      <Card className={CARD_STYLE}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-white">Materias</CardTitle>
            <CardDescription className="text-white/60">Gestiona las materias del colegio, cursos vinculados y profesores que las dictan.</CardDescription>
          </div>
          <Dialog open={createMateriaOpen} onOpenChange={setCreateMateriaOpen}>
            <DialogTrigger asChild>
              <Button
                className="bg-white/10 border border-white/10 text-white hover:bg-white/20"
                onClick={() => { setNuevaMateriaNombre(''); setNuevaMateriaDescripcion(''); }}
              >
                <Plus className="w-4 h-4 mr-2" />
                Crear nueva materia
              </Button>
            </DialogTrigger>
            <DialogContent className="glass-dropdown border-white/10 text-white max-w-md">
              <DialogHeader>
                <DialogTitle className="text-white">Nueva materia</DialogTitle>
                <DialogDescription className="text-white/70">Crea una materia para el colegio. Luego podrás asignarla a cursos y profesores desde Cursos.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div>
                  <Label className="text-white/90 mb-2 block">Nombre *</Label>
                  <Input
                    value={nuevaMateriaNombre}
                    onChange={(e) => setNuevaMateriaNombre(e.target.value)}
                    placeholder="Ej: Matemáticas"
                    className="bg-white/5 border-white/10 text-white placeholder:text-white/40"
                  />
                </div>
                <div>
                  <Label className="text-white/90 mb-2 block">Descripción (opcional)</Label>
                  <Input
                    value={nuevaMateriaDescripcion}
                    onChange={(e) => setNuevaMateriaDescripcion(e.target.value)}
                    placeholder="Breve descripción"
                    className="bg-white/5 border-white/10 text-white placeholder:text-white/40"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" className="border-white/10 text-white" onClick={() => setCreateMateriaOpen(false)}>Cancelar</Button>
                  <Button
                    className="bg-[#3B82F6] hover:bg-[#2563EB] text-white"
                    disabled={!nuevaMateriaNombre.trim() || createMateriaMutation.isPending}
                    onClick={() => createMateriaMutation.mutate({ nombre: nuevaMateriaNombre.trim(), descripcion: nuevaMateriaDescripcion.trim() || undefined })}
                  >
                    {createMateriaMutation.isPending ? 'Creando...' : 'Crear materia'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {materiasLoading ? (
            <p className="text-white/60">Cargando materias...</p>
          ) : materiasError ? (
            <p className="text-amber-400/90">Error al cargar las materias. {materiasErrorDetail instanceof Error ? materiasErrorDetail.message : 'Vuelve a intentar.'}</p>
          ) : materiasList.length === 0 ? (
            <p className="text-white/60">No hay materias creadas. Usa &quot;Crear nueva materia&quot; para agregar una.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-white/10">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-white/10 bg-white/5">
                    <th className="py-3 px-4 text-xs font-semibold text-white/80 uppercase">Materia</th>
                    <th className="py-3 px-4 text-xs font-semibold text-white/80 uppercase">Cursos vinculados</th>
                    <th className="py-3 px-4 text-xs font-semibold text-white/80 uppercase">Profesor(es)</th>
                    <th className="py-3 px-4 text-xs font-semibold text-white/80 uppercase"></th>
                  </tr>
                </thead>
                <tbody>
                  {materiasList.map((m) => (
                    <tr key={m.id} className="border-b border-white/[0.06] hover:bg-white/[0.03]">
                      <td className="py-3 px-4">
                        <span className="font-medium text-white">{m.nombre}</span>
                        {m.descripcion && <p className="text-xs text-white/50 mt-0.5">{m.descripcion}</p>}
                        {m.area && <p className="text-xs text-white/40">{m.area}</p>}
                      </td>
                      <td className="py-3 px-4 text-sm text-white/80">
                        {m.cursos.length === 0 ? <span className="text-white/50">— Sin asignar</span> : m.cursos.map((c) => c.groupName).filter(Boolean).join(', ') || '—'}
                      </td>
                      <td className="py-3 px-4 text-sm text-white/80">
                        {m.cursos.length === 0 ? <span className="text-white/50">—</span> : Array.from(new Set(m.cursos.map((c) => c.teacherName))).join(', ')}
                      </td>
                      <td className="py-3 px-4">
                        <Button size="sm" variant="ghost" className="text-white/60 hover:text-white" onClick={() => { setEditingMateria({ id: m.id, nombre: m.nombre, area: m.area }); setEditMateriaOpen(true); }}>
                          <Edit className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
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
                <SelectContent className="bg-[#0a0a2a] border-white/10">
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
        <DialogContent className="bg-[#0a0a2a] border-white/10 text-white">
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
                <SelectContent className="bg-[#0a0a2a] border-white/10">
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
                <SelectContent className="bg-[#0a0a2a] border-white/10">
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

  // 6️⃣ Control de Accesos
  const FEATURE_LABELS: Record<string, { label: string; desc: string; defaultRoles: string[] }> = {
    ver_notas: { label: 'Ver calificaciones', desc: 'Bloquea que estudiantes y padres vean sus notas', defaultRoles: ['estudiante', 'padre'] },
    ver_asistencia: { label: 'Ver asistencia', desc: 'Bloquea que estudiantes y padres vean su registro de asistencia', defaultRoles: ['estudiante', 'padre'] },
    descargar_boletin: { label: 'Descargar boletín', desc: 'Bloquea la descarga de boletines de calificaciones', defaultRoles: ['estudiante', 'padre'] },
    chat_estudiantes: { label: 'Chat estudiantil', desc: 'Bloquea el acceso al chat para estudiantes', defaultRoles: ['estudiante'] },
    subir_archivos: { label: 'Subir archivos', desc: 'Bloquea la subida de archivos para estudiantes', defaultRoles: ['estudiante'] },
  };
  const renderControlAccesos = () => {
    const features = accessControlsData?.features ?? {};
    return (
      <div className="space-y-6">
        <Card className={CARD_STYLE}>
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Shield className="w-5 h-5" style={{ color: colorPrimario }} />
              Control de Accesos
            </CardTitle>
            <CardDescription className="text-white/60">
              Activa o desactiva funcionalidades para roles específicos. Útil para períodos de exámenes, eventos especiales o mantenimiento.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {Object.entries(FEATURE_LABELS).map(([feature, meta]) => {
              const control = features[feature];
              const isBlocked = !!control;
              return (
                <div key={feature} className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-white font-medium">{meta.label}</p>
                      <p className="text-white/50 text-sm">{meta.desc}</p>
                      {isBlocked && control && (
                        <div className="mt-1 flex flex-wrap gap-2">
                          {control.blocked_roles.map((r) => <Badge key={r} className="bg-red-500/20 text-red-400 border-red-500/30 text-xs">{r}</Badge>)}
                          {control.reason && <span className="text-xs text-amber-400">"{control.reason}"</span>}
                          {control.expires_at && <span className="text-xs text-white/40">Expira: {new Date(control.expires_at).toLocaleDateString()}</span>}
                        </div>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant={isBlocked ? 'default' : 'outline'}
                      className={isBlocked ? 'bg-red-500/80 hover:bg-red-500 text-white' : 'border-white/20 text-white/70 hover:bg-white/10'}
                      disabled={toggleAccessMutation.isPending}
                      onClick={() => {
                        if (isBlocked) {
                          toggleAccessMutation.mutate({ feature, enabled: true });
                        } else {
                          setAccessControlFeature(feature);
                          setAccessControlReason('');
                          setAccessControlExpires('');
                        }
                      }}
                    >
                      {isBlocked ? 'Bloqueado — Habilitar' : 'Habilitado — Bloquear'}
                    </Button>
                  </div>
                  {accessControlFeature === feature && !isBlocked && (
                    <div className="border-t border-white/10 pt-3 space-y-3">
                      <div>
                        <Label className="text-white/70 text-sm">Razón (opcional)</Label>
                        <Input value={accessControlReason} onChange={(e) => setAccessControlReason(e.target.value)} placeholder="Ej: Período de exámenes" className="bg-white/5 border-white/10 text-white mt-1" />
                      </div>
                      <div>
                        <Label className="text-white/70 text-sm">Fecha de expiración (opcional)</Label>
                        <Input type="date" value={accessControlExpires} onChange={(e) => setAccessControlExpires(e.target.value)} className="bg-white/5 border-white/10 text-white mt-1" />
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" style={{ background: `linear-gradient(to right, ${colorPrimario}, ${colorSecundario})` }}
                          onClick={() => {
                            toggleAccessMutation.mutate({ feature, enabled: false, blocked_roles: meta.defaultRoles, reason: accessControlReason || undefined, expires_at: accessControlExpires || null });
                            setAccessControlFeature('');
                          }}>
                          Confirmar bloqueo
                        </Button>
                        <Button size="sm" variant="ghost" className="text-white/60" onClick={() => setAccessControlFeature('')}>Cancelar</Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>
    );
  };

  // 7️⃣ Auditoría (solo admin)
  const renderAuditoria = () => {
    const logs = auditData?.logs ?? [];
    const total = auditData?.total ?? 0;
    const filteredLogs = auditUserSearch ? logs.filter((l) =>
      (l.role ?? '').toLowerCase().includes(auditUserSearch.toLowerCase()) ||
      JSON.stringify(l.requestData ?? '').toLowerCase().includes(auditUserSearch.toLowerCase())
    ) : logs;
    return (
      <div className="space-y-6">
        <Card className={CARD_STYLE}>
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <ScrollText className="w-5 h-5" style={{ color: colorPrimario }} />
              Auditoría
            </CardTitle>
            <CardDescription className="text-white/60">
              Acciones de administración y uso del sistema. Solo lectura.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2 items-end">
              <div>
                <Label className="text-white/70 text-xs">Usuario</Label>
                <Input
                  type="text"
                  placeholder="Filtrar por usuario..."
                  className="bg-white/5 border-white/10 text-white w-[180px]"
                  value={auditUserSearch}
                  onChange={(e) => setAuditUserSearch(e.target.value)}
                />
              </div>
              <div>
                <Label className="text-white/70 text-xs">Acción</Label>
                <Select value={auditAction || 'all'} onValueChange={(v) => setAuditAction(v === 'all' ? '' : v)}>
                  <SelectTrigger className="bg-white/5 border-white/10 text-white w-[180px]">
                    <SelectValue placeholder="Todas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    <SelectItem value="create_user">create_user</SelectItem>
                    <SelectItem value="create_group">create_group</SelectItem>
                    <SelectItem value="assign_student">assign_student</SelectItem>
                    <SelectItem value="assign_professor_to_groups">assign_professor_to_groups</SelectItem>
                    <SelectItem value="assign_professor">assign_professor</SelectItem>
                    <SelectItem value="enroll_students">enroll_students</SelectItem>
                    <SelectItem value="vinculacion">vinculacion</SelectItem>
                    <SelectItem value="confirmar_vinculacion">confirmar_vinculacion</SelectItem>
                    <SelectItem value="activar_cuentas">activar_cuentas</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-white/70 text-xs">Entidad</Label>
                <Select value={auditEntityType || 'all'} onValueChange={(v) => setAuditEntityType(v === 'all' ? '' : v)}>
                  <SelectTrigger className="bg-white/5 border-white/10 text-white w-[140px]">
                    <SelectValue placeholder="Todas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    <SelectItem value="user">user</SelectItem>
                    <SelectItem value="group">group</SelectItem>
                    <SelectItem value="course">course</SelectItem>
                    <SelectItem value="vinculacion">vinculacion</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-white/70 text-xs">Desde</Label>
                <Input
                  type="date"
                  className="bg-white/5 border-white/10 text-white w-[140px]"
                  value={auditStartDate}
                  onChange={(e) => setAuditStartDate(e.target.value)}
                />
              </div>
              <div>
                <Label className="text-white/70 text-xs">Hasta</Label>
                <Input
                  type="date"
                  className="bg-white/5 border-white/10 text-white w-[140px]"
                  value={auditEndDate}
                  onChange={(e) => setAuditEndDate(e.target.value)}
                />
              </div>
            </div>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <p className="text-white/50 text-sm">Total: {total} registros</p>
              <Button
                size="sm"
                variant="outline"
                className="border-white/10 text-white/70"
                onClick={() => {
                  const header = ['Fecha', 'Rol', 'Acción', 'Entidad', 'Resultado', 'Detalle'].join(',');
                  const rows = filteredLogs.map((l) => [
                    l.timestamp ? new Date(l.timestamp).toLocaleString() : '',
                    l.role ?? '',
                    l.action ?? '',
                    l.entityType ?? '',
                    l.result ?? '',
                    l.requestData ? JSON.stringify(l.requestData).replace(/,/g, ';') : '',
                  ].map((v) => `"${v}"`).join(','));
                  const csv = [header, ...rows].join('\n');
                  const blob = new Blob([csv], { type: 'text/csv' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `auditoria-${new Date().toISOString().slice(0, 10)}.csv`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
              >
                <Download className="w-4 h-4 mr-2" />Exportar CSV
              </Button>
            </div>
            {auditLoading ? (
              <p className="text-white/60">Cargando...</p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-white/10">
                <table className="w-full text-sm text-left">
                  <thead className="bg-white/5 text-white/80">
                    <tr>
                      <th className="px-3 py-2">Fecha</th>
                      <th className="px-3 py-2">Rol</th>
                      <th className="px-3 py-2">Acción</th>
                      <th className="px-3 py-2">Entidad</th>
                      <th className="px-3 py-2">Resultado</th>
                      <th className="px-3 py-2">Detalle</th>
                    </tr>
                  </thead>
                  <tbody className="text-white/80">
                    {filteredLogs.length === 0 ? (
                      <tr><td colSpan={6} className="px-3 py-4 text-white/50">Sin registros</td></tr>
                    ) : (
                      filteredLogs.map((log) => (
                        <tr key={log._id} className="border-t border-white/10">
                          <td className="px-3 py-2">{log.timestamp ? new Date(log.timestamp).toLocaleString() : '-'}</td>
                          <td className="px-3 py-2">{log.role ?? '-'}</td>
                          <td className="px-3 py-2">{log.action ?? '-'}</td>
                          <td className="px-3 py-2">{log.entityType ?? '-'}</td>
                          <td className="px-3 py-2">{log.result ?? '-'}</td>
                          <td className="px-3 py-2 max-w-[200px] truncate" title={log.requestData ? JSON.stringify(log.requestData) : ''}>
                            {log.requestData ? JSON.stringify(log.requestData).slice(0, 60) + '…' : '-'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  };

  // 8️⃣ Vínculos (simplificado)
  const renderVinculos = () => {
    const estudiantesFiltrados = estudiantesVincSearch.filter((e) =>
      !vincBusqueda || e.nombre.toLowerCase().includes(vincBusqueda.toLowerCase()) || e.email.toLowerCase().includes(vincBusqueda.toLowerCase())
    );
    const estudianteSeleccionado = estudiantesVincSearch.find((e) => e._id === vincEstudianteId);
    const canConfirmarVinc = vincVinculaciones.length >= 1 && estudianteSeleccionado?.estado === 'pendiente_vinculacion';
    const canActivarVinc = vincVinculaciones.length >= 1 && estudianteSeleccionado?.estado === 'vinculado';
    return (
      <div className="space-y-6">
        <Card className={CARD_STYLE}>
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <LinkIcon className="w-5 h-5" style={{ color: colorPrimario }} />
              Vínculos Padre ⇄ Estudiante
            </CardTitle>
            <CardDescription className="text-white/60">Busca un estudiante, gestiona sus padres vinculados y activa las cuentas.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
              <Input placeholder="Buscar estudiante por nombre o email..." value={vincBusqueda} onChange={(e) => setVincBusqueda(e.target.value)} className="bg-white/5 border-white/10 text-white pl-10 placeholder:text-white/40" />
            </div>
            {vincBusqueda && (
              <div className="rounded-xl border border-white/10 bg-white/5 divide-y divide-white/5 max-h-48 overflow-y-auto">
                {estudiantesFiltrados.length === 0 ? (
                  <p className="p-3 text-white/50 text-sm">Sin resultados</p>
                ) : estudiantesFiltrados.map((e) => (
                  <div key={e._id} className={`flex items-center justify-between p-3 cursor-pointer hover:bg-white/10 ${vincEstudianteId === e._id ? 'bg-white/10' : ''}`}
                    onClick={() => { setVincEstudianteId(e._id); setVincBusqueda(''); }}>
                    <div>
                      <p className="text-white text-sm font-medium">{e.nombre}</p>
                      <p className="text-white/50 text-xs">{e.email}</p>
                    </div>
                    <Badge className={e.estado === 'active' ? 'bg-green-500/20 text-green-400' : e.estado === 'vinculado' ? 'bg-blue-500/20 text-blue-400' : 'bg-amber-500/20 text-amber-400'}>
                      {e.estado === 'active' ? 'Activo' : e.estado === 'vinculado' ? 'Vinculado' : 'Pend. vinc.'}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
            {vincEstudianteId && estudianteSeleccionado && (
              <div className="space-y-4">
                <div className="rounded-xl bg-white/5 border border-white/10 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-white font-medium">{estudianteSeleccionado.nombre}</p>
                      <p className="text-white/50 text-sm">{estudianteSeleccionado.email}</p>
                    </div>
                    <Button size="sm" variant="ghost" className="text-white/50" onClick={() => setVincEstudianteId('')}><X className="w-4 h-4" /></Button>
                  </div>
                  <p className="text-white/70 text-sm font-medium mb-2">Padres vinculados:</p>
                  {vincVinculaciones.length === 0 ? (
                    <p className="text-white/40 text-sm">Sin padres vinculados.</p>
                  ) : (
                    <ul className="space-y-1">
                      {vincVinculaciones.map((v) => (
                        <li key={(v as any).guardian_id ?? v._id} className="text-sm text-white/70 flex items-center gap-2">
                          <UserCheck className="w-4 h-4 text-green-400" />
                          {(v.padreId as any)?.nombre} — {(v.padreId as any)?.email}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => setVincAddPadreOpen(true)} style={{ background: `linear-gradient(to right, ${colorPrimario}, ${colorSecundario})` }}>
                    <Plus className="w-4 h-4 mr-2" /> Agregar padre
                  </Button>
                  {canConfirmarVinc && (
                    <Button variant="outline" className="border-blue-500/40 text-blue-400" disabled={confirmarVinculacionMutation.isPending}
                      onClick={() => confirmarVinculacionMutation.mutate(vincEstudianteId)}>
                      {confirmarVinculacionMutation.isPending ? 'Confirmando...' : 'Confirmar vinculación'}
                    </Button>
                  )}
                  {canActivarVinc && (
                    <Button variant="outline" className="border-green-500/40 text-green-400" disabled={activarCuentasMutation.isPending}
                      onClick={() => activarCuentasMutation.mutate(vincEstudianteId)}>
                      {activarCuentasMutation.isPending ? 'Activando...' : 'Activar cuentas'}
                    </Button>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
        <Dialog open={vincAddPadreOpen} onOpenChange={setVincAddPadreOpen}>
          <DialogContent className="bg-[#0a0a2a] border-white/10 text-white">
            <DialogHeader><DialogTitle>Agregar padre/tutor</DialogTitle><DialogDescription className="text-white/60">Selecciona un padre existente para vincular con {estudianteSeleccionado?.nombre}.</DialogDescription></DialogHeader>
            <div className="space-y-4">
              <Select value={vincPadreId} onValueChange={setVincPadreId}>
                <SelectTrigger className="bg-white/5 border-white/10 text-white"><SelectValue placeholder="Selecciona padre" /></SelectTrigger>
                <SelectContent className="bg-[#0a0a2a] border-white/10">
                  {padresVincSearch.map((p) => <SelectItem key={p._id} value={p._id} className="text-white focus:bg-white/10">{p.nombre} ({p.email})</SelectItem>)}
                </SelectContent>
              </Select>
              <div className="flex gap-2">
                <Button disabled={!vincPadreId || crearVincMutation.isPending} style={{ background: `linear-gradient(to right, ${colorPrimario}, ${colorSecundario})` }}
                  onClick={() => crearVincMutation.mutate({ padreId: vincPadreId, estudianteId: vincEstudianteId })}>
                  {crearVincMutation.isPending ? 'Vinculando...' : 'Vincular'}
                </Button>
                <Button variant="outline" className="border-white/10 text-white" onClick={() => setVincAddPadreOpen(false)}>Cancelar</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  };

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
              variant={activeSection === 'vinculos' ? 'default' : 'ghost'}
              onClick={() => setActiveSection('vinculos')}
              className={activeSection === 'vinculos' ? '' : 'text-white/70'}
            >
              <LinkIcon className="w-4 h-4 mr-2" />
              Vínculos
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
              variant={activeSection === 'accesos' ? 'default' : 'ghost'}
              onClick={() => setActiveSection('accesos')}
              className={activeSection === 'accesos' ? '' : 'text-white/70'}
            >
              <Shield className="w-4 h-4 mr-2" />
              Control de Accesos
            </Button>
            <Button
              variant={activeSection === 'auditoria' ? 'default' : 'ghost'}
              onClick={() => setActiveSection('auditoria')}
              className={activeSection === 'auditoria' ? '' : 'text-white/70'}
            >
              <ScrollText className="w-4 h-4 mr-2" />
              Auditoría
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
            setNewUser({
              nombre: '',
              email: '',
              telefono: '',
              celular: '',
              materias: [],
              cursos: [],
              cursoGrupo: '',
              padre1Nombre: '',
              padre1Email: '',
              padre2Nombre: '',
              padre2Email: '',
            });
            setNewProfesorMateriaNombre('');
            setNewCourse({ curso: '', seccion: '', directorGrupo: '' });
          }
        }}
      >
        <DialogContent className="bg-[#0a0a2a] border-white/10 text-white">
          <DialogHeader>
            <DialogTitle>Crear {createUserType === 'curso' ? 'Curso' : createUserType === 'estudiante' ? 'Estudiante' : createUserType === 'profesor' ? 'Profesor' : createUserType === 'directivo' ? 'Directiva' : createUserType === 'asistente' ? 'Asistente' : 'Padre'}</DialogTitle>
            <DialogDescription className="text-white/60">
              Completa los datos para crear un nuevo {createUserType === 'curso' ? 'curso' : createUserType === 'directivo' ? 'miembro de directiva' : createUserType === 'asistente' ? 'asistente' : 'usuario'}
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
                    <SelectContent className="bg-[#0a0a2a] border-white/10">
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
                    <SelectContent className="bg-[#0a0a2a] border-white/10">
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
                      : createUserType === 'directivo'
                      ? 'Se genera una contraseña temporal automáticamente. La directiva tendrá acceso al panel de directivo del colegio.'
                      : 'Se genera una contraseña temporal automáticamente. La cuenta solo funciona para este colegio.'}
                  </p>
                </div>
                {createUserType === 'estudiante' && (
                  <>
                    <div>
                      <Label className="text-white/90 mb-2 block">Curso / Grupo</Label>
                      <Select
                        value={newUser.cursoGrupo}
                        onValueChange={(v) => setNewUser({ ...newUser, cursoGrupo: v })}
                      >
                        <SelectTrigger className="bg-white/5 border-white/10 text-white">
                          <SelectValue placeholder="Selecciona el curso (opcional)" />
                        </SelectTrigger>
                        <SelectContent className="bg-[#0a0a2a] border-white/10">
                          {gruposList.map((g) => (
                            <SelectItem key={g._id} value={g.nombre} className="text-white focus:bg-white/10">{g.nombre}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="rounded-lg border border-white/10 p-3 space-y-3">
                      <p className="text-white/70 text-sm font-medium">Padre / Tutor principal *</p>
                      <div>
                        <Label className="text-white/80 text-xs mb-1 block">Nombre completo</Label>
                        <Input
                          value={newUser.padre1Nombre}
                          onChange={(e) => setNewUser({ ...newUser, padre1Nombre: e.target.value })}
                          className="bg-white/5 border-white/10 text-white"
                          placeholder="Ana García"
                        />
                      </div>
                      <div>
                        <Label className="text-white/80 text-xs mb-1 block">Email *</Label>
                        <Input
                          type="email"
                          value={newUser.padre1Email}
                          onChange={(e) => setNewUser({ ...newUser, padre1Email: e.target.value })}
                          className="bg-white/5 border-white/10 text-white"
                          placeholder="ana@ejemplo.com"
                        />
                      </div>
                    </div>
                    <div className="rounded-lg border border-white/10 p-3 space-y-3">
                      <p className="text-white/70 text-sm font-medium">Padre / Tutor 2 (opcional)</p>
                      <div>
                        <Label className="text-white/80 text-xs mb-1 block">Nombre completo</Label>
                        <Input
                          value={newUser.padre2Nombre}
                          onChange={(e) => setNewUser({ ...newUser, padre2Nombre: e.target.value })}
                          className="bg-white/5 border-white/10 text-white"
                          placeholder="Carlos García"
                        />
                      </div>
                      <div>
                        <Label className="text-white/80 text-xs mb-1 block">Email</Label>
                        <Input
                          type="email"
                          value={newUser.padre2Email}
                          onChange={(e) => setNewUser({ ...newUser, padre2Email: e.target.value })}
                          className="bg-white/5 border-white/10 text-white"
                          placeholder="carlos@ejemplo.com"
                        />
                      </div>
                    </div>
                  </>
                )}
                {createUserType === 'profesor' && (
                  <>
                    <div className="rounded-lg border border-white/10 p-3 space-y-3">
                      <p className="text-white/80 text-sm font-medium">Materia(s) que dicta</p>
                      <div className="space-y-2">
                        <p className="text-xs text-white/60 font-medium">Opción A — Vincular a materia existente</p>
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
                          <SelectContent className="bg-[#0a0a2a] border-white/10">
                            {Array.from(
                              new Map(
                                materiasList.map((m) => [m.nombre.trim().toLowerCase(), m])
                              ).values()
                            ).map((m) => (
                              <SelectItem key={m._id} value={m._id} className="text-white focus:bg-white/10">
                                {m.nombre}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <p className="text-xs text-white/60 font-medium">Opción B — Crear materia nueva</p>
                        <div className="flex gap-2">
                          <Input
                            value={newProfesorMateriaNombre}
                            onChange={(e) => setNewProfesorMateriaNombre(e.target.value)}
                            className="bg-white/5 border-white/10 text-white"
                            placeholder="Ej: Matemáticas, Ciencias, Español"
                          />
                          <Button
                            type="button"
                            disabled={createSubjectForProfessorMutation.isPending || !newProfesorMateriaNombre.trim()}
                            onClick={() => {
                              const nombre = newProfesorMateriaNombre.trim();
                              if (!nombre) return;
                              createSubjectForProfessorMutation.mutate({ nombre });
                            }}
                            className="shrink-0"
                            style={{
                              background: `linear-gradient(to right, ${colorPrimario}, ${colorSecundario})`,
                            }}
                          >
                            {createSubjectForProfessorMutation.isPending ? 'Agregando...' : 'Agregar'}
                          </Button>
                        </div>
                      </div>
                      {newUser.materias.length > 0 && (
                        <div className="flex flex-wrap gap-2 pt-2 border-t border-white/10 mt-2">
                          {newUser.materias.map((mId) => {
                            const materia = materiasList.find((m) => m._id === mId);
                            return materia ? (
                              <Badge key={mId} className="bg-white/10 text-white border-white/20">
                                {materia.nombre}
                                <button
                                  type="button"
                                  onClick={() =>
                                    setNewUser({
                                      ...newUser,
                                      materias: newUser.materias.filter((id) => id !== mId),
                                    })
                                  }
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
                        <SelectContent className="bg-[#0a0a2a] border-white/10">
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
                      (createUserType === 'estudiante' && !newUser.padre1Email.trim())
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
                      setNewUser({
                        nombre: '',
                        email: '',
                        telefono: '',
                        celular: '',
                        materias: [],
                        cursos: [],
                        cursoGrupo: '',
                        padre1Nombre: '',
                        padre1Email: '',
                        padre2Nombre: '',
                        padre2Email: '',
                      });
                      setNewProfesorMateriaNombre('');
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

      {/* Diálogo Crear Sección */}
      <Dialog open={createSectionOpen} onOpenChange={setCreateSectionOpen}>
        <DialogContent className="bg-[#0a0a2a] border-white/10 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <LayoutGrid className="w-5 h-5" />
              Crear Sección
            </DialogTitle>
            <DialogDescription className="text-white/60">
              Crea una sección y asigna cursos existentes o añade nuevos ahora.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-white/90">Nombre de la sección *</Label>
              <Input
                value={newSectionNombre}
                onChange={(e) => setNewSectionNombre(e.target.value)}
                className="bg-white/5 border-white/10 text-white mt-1"
                placeholder="Ej: Primaria, Bachillerato"
              />
            </div>
            <div>
              <Label className="text-white/90 mb-2 block">Cursos existentes (opcional)</Label>
              <Select
                value=""
                onValueChange={(v) => {
                  if (v && !newSectionCursoIds.includes(v)) setNewSectionCursoIds([...newSectionCursoIds, v]);
                }}
              >
                <SelectTrigger className="bg-white/5 border-white/10 text-white">
                  <SelectValue placeholder="Añadir curso existente" />
                </SelectTrigger>
                <SelectContent className="bg-[#0a0a2a] border-white/10">
                  {gruposList.map((g) => (
                    <SelectItem key={g._id} value={g.nombre} className="text-white focus:bg-white/10">
                      {g.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {newSectionCursoIds.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {newSectionCursoIds.map((id) => (
                    <Badge key={id} className="bg-white/10 text-white border-white/20">
                      {id}
                      <button type="button" onClick={() => setNewSectionCursoIds(newSectionCursoIds.filter((x) => x !== id))} className="ml-2 hover:text-red-400">×</button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>
            <div>
              <Label className="text-white/90 mb-2 block">Crear nuevos cursos en esta sección (opcional)</Label>
              <div className="flex gap-2">
                <Input
                  value={newSectionNuevoCursoInput}
                  onChange={(e) => setNewSectionNuevoCursoInput(e.target.value)}
                  className="bg-white/5 border-white/10 text-white"
                  placeholder="Ej: 7A, 8B"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      const n = newSectionNuevoCursoInput.trim().toUpperCase();
                      if (n && !newSectionNuevosCursos.includes(n)) {
                        setNewSectionNuevosCursos([...newSectionNuevosCursos, n]);
                        setNewSectionNuevoCursoInput('');
                      }
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  className="border-white/10 text-white shrink-0"
                  onClick={() => {
                    const n = newSectionNuevoCursoInput.trim().toUpperCase();
                    if (n && !newSectionNuevosCursos.includes(n)) {
                      setNewSectionNuevosCursos([...newSectionNuevosCursos, n]);
                      setNewSectionNuevoCursoInput('');
                    }
                  }}
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
              {newSectionNuevosCursos.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {newSectionNuevosCursos.map((c) => (
                    <Badge key={c} className="bg-white/10 text-white border-white/20">
                      {c} (nuevo)
                      <button type="button" onClick={() => setNewSectionNuevosCursos(newSectionNuevosCursos.filter((x) => x !== c))} className="ml-2 hover:text-red-400">×</button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>
            <div className="flex gap-2 pt-2">
              <Button
                onClick={() => {
                  if (!newSectionNombre.trim()) {
                    alert('Indica el nombre de la sección.');
                    return;
                  }
                  createSectionMutation.mutate({
                    nombre: newSectionNombre.trim(),
                    cursoIds: newSectionCursoIds,
                    nuevosCursos: newSectionNuevosCursos,
                  });
                }}
                disabled={createSectionMutation.isPending || !newSectionNombre.trim()}
                style={{ background: `linear-gradient(to right, ${colorPrimario}, ${colorSecundario})` }}
              >
                {createSectionMutation.isPending ? 'Creando...' : 'Crear Sección'}
              </Button>
              <Button variant="outline" onClick={() => setCreateSectionOpen(false)} className="border-white/10 text-white">
                Cancelar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Diálogo Añadir cursos a sección */}
      <Dialog open={addCursosToSectionOpen} onOpenChange={(open) => !open && setAddCursosToSectionOpen(false)}>
        <DialogContent className="bg-[#0a0a2a] border-white/10 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white">Añadir cursos a la sección</DialogTitle>
            <DialogDescription className="text-white/60">
              Elige cursos existentes para asignarlos a esta sección.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Select
              value=""
              onValueChange={(v) => {
                if (v && !addCursosToSectionIds.includes(v)) setAddCursosToSectionIds([...addCursosToSectionIds, v]);
              }}
            >
              <SelectTrigger className="bg-white/5 border-white/10 text-white">
                <SelectValue placeholder="Selecciona un curso" />
              </SelectTrigger>
              <SelectContent className="bg-[#0a0a2a] border-white/10">
                {gruposList.map((g) => (
                  <SelectItem key={g._id} value={g.nombre} className="text-white focus:bg-white/10">
                    {g.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {addCursosToSectionIds.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {addCursosToSectionIds.map((id) => (
                  <Badge key={id} className="bg-white/10 text-white border-white/20">
                    {id}
                    <button type="button" onClick={() => setAddCursosToSectionIds(addCursosToSectionIds.filter((x) => x !== id))} className="ml-2 hover:text-red-400">×</button>
                  </Badge>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <Button
                onClick={() => {
                  if (!addCursosToSectionId || addCursosToSectionIds.length === 0) return;
                  addCursosToSectionMutation.mutate({ sectionId: addCursosToSectionId, addCursoIds: addCursosToSectionIds });
                }}
                disabled={addCursosToSectionMutation.isPending || addCursosToSectionIds.length === 0}
                style={{ background: `linear-gradient(to right, ${colorPrimario}, ${colorSecundario})` }}
              >
                {addCursosToSectionMutation.isPending ? 'Añadiendo...' : 'Añadir cursos'}
              </Button>
              <Button variant="outline" onClick={() => setAddCursosToSectionOpen(false)} className="border-white/10 text-white">
                Cerrar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Caja con información de la cuenta recién creada */}
      <Dialog open={!!createdUserInfo} onOpenChange={(open) => !open && setCreatedUserInfo(null)}>
        <DialogContent className="bg-[#0a0a2a] border-white/10 text-white max-w-md">
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
            <div className="space-y-4 pt-2 max-h-[70vh] overflow-y-auto">
              {/* Cuenta principal (estudiante / usuario) */}
              <div className="rounded-lg border border-white/20 bg-white/5 p-4 space-y-3">
                <p className="text-xs text-white/60 uppercase tracking-wider font-semibold">{createdUserInfo.rol}</p>
                <div>
                  <p className="text-xs text-white/50 uppercase tracking-wider mb-1">Nombre</p>
                  <p className="text-white font-medium">{createdUserInfo.nombre}</p>
                </div>
                <div>
                  <p className="text-xs text-white/50 uppercase tracking-wider mb-1">Email (usuario)</p>
                  <p className="text-white font-mono text-sm break-all">{createdUserInfo.email}</p>
                </div>
                <div>
                  <p className="text-xs text-white/50 uppercase tracking-wider mb-1">Contraseña temporal</p>
                  <p className="text-amber-300 font-mono text-sm bg-amber-500/10 px-3 py-2 rounded border border-amber-500/30 break-all select-all">
                    {createdUserInfo.passwordTemporal}
                  </p>
                </div>
              </div>
              {/* Cuentas de padres creados */}
              {createdUserInfo.cuentasCreadas && createdUserInfo.cuentasCreadas.length > 0 && (
                <>
                  <p className="text-white/70 text-sm font-medium">Cuentas de padres creadas:</p>
                  {createdUserInfo.cuentasCreadas.map((c, i) => (
                    <div key={i} className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-4 space-y-2">
                      <p className="text-xs text-blue-400 uppercase tracking-wider font-semibold">{c.rol}</p>
                      <div>
                        <p className="text-xs text-white/50 uppercase tracking-wider mb-1">Nombre</p>
                        <p className="text-white text-sm">{c.nombre}</p>
                      </div>
                      <div>
                        <p className="text-xs text-white/50 uppercase tracking-wider mb-1">Email</p>
                        <p className="text-white font-mono text-sm break-all">{c.email}</p>
                      </div>
                      <div>
                        <p className="text-xs text-white/50 uppercase tracking-wider mb-1">Contraseña temporal</p>
                        <p className="text-amber-300 font-mono text-sm bg-amber-500/10 px-3 py-2 rounded border border-amber-500/30 break-all select-all">
                          {c.passwordTemporal}
                        </p>
                      </div>
                    </div>
                  ))}
                  <p className="text-blue-400/80 text-xs">Ve a Vínculos para confirmar la vinculación y activar estas cuentas.</p>
                </>
              )}
              {(!createdUserInfo.cuentasCreadas || createdUserInfo.cuentasCreadas.length === 0) && (
                <p className="text-white/60 text-sm">
                  {createdUserInfo.rol === 'estudiante'
                    ? 'El estudiante fue creado. Los padres indicados ya existían — ve a Vínculos para confirmar la vinculación.'
                    : 'Esta cuenta ya puede iniciar sesión con el usuario y la contraseña de arriba.'}
                </p>
              )}
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

      {/* Diálogo: Información/edición de la cuenta */}
      <Dialog
        open={editUserOpen}
        onOpenChange={(open) => {
          if (!open) { setResetPasswordBox(null); setEditUserMode('view'); }
          setEditUserOpen(open);
        }}
      >
        <DialogContent className="bg-[#0a0a2a] border-white/10 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center justify-between">
              <span>{editUserMode === 'edit' ? 'Editar usuario' : 'Información de la cuenta'}</span>
              {editUserMode === 'view' && (
                <Button size="sm" variant="ghost" className="text-white/70 hover:text-white" onClick={() => {
                  setEditUserFields({ nombre: selectedUser?.nombre ?? '', email: selectedUser?.email ?? '', telefono: selectedUser?.telefono ?? selectedUser?.celular ?? '' });
                  setEditUserMode('edit');
                }}>
                  <Edit className="w-4 h-4 mr-1" /> Editar
                </Button>
              )}
            </DialogTitle>
            <DialogDescription className="text-white/60">
              {editUserMode === 'edit' ? 'Modifica los datos del usuario.' : 'Datos de la cuenta. Usuario de login = email.'}
            </DialogDescription>
          </DialogHeader>
          {selectedUser && editUserMode === 'edit' ? (
            <div className="space-y-4 pt-2">
              <div>
                <Label className="text-white/80 text-sm">Nombre completo</Label>
                <Input value={editUserFields.nombre} onChange={(e) => setEditUserFields({ ...editUserFields, nombre: e.target.value })} className="bg-white/5 border-white/10 text-white mt-1" />
              </div>
              <div>
                <Label className="text-white/80 text-sm">Email</Label>
                <Input type="email" value={editUserFields.email} onChange={(e) => setEditUserFields({ ...editUserFields, email: e.target.value })} className="bg-white/5 border-white/10 text-white mt-1" />
              </div>
              <div>
                <Label className="text-white/80 text-sm">Teléfono</Label>
                <Input value={editUserFields.telefono} onChange={(e) => setEditUserFields({ ...editUserFields, telefono: e.target.value })} className="bg-white/5 border-white/10 text-white mt-1" placeholder="Opcional" />
              </div>
              <div className="flex gap-2 pt-2">
                <Button
                  disabled={patchUserMutation.isPending}
                  style={{ background: `linear-gradient(to right, ${colorPrimario}, ${colorSecundario})` }}
                  onClick={() => patchUserMutation.mutate({ id: selectedUser._id, nombre: editUserFields.nombre, email: editUserFields.email, telefono: editUserFields.telefono })}
                >
                  {patchUserMutation.isPending ? 'Guardando...' : 'Guardar cambios'}
                </Button>
                <Button variant="outline" className="border-white/10 text-white" onClick={() => setEditUserMode('view')}>Cancelar</Button>
              </div>
            </div>
          ) : selectedUser ? (
            <div className="space-y-4 pt-2">
              {resetPasswordBox && (
                <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 space-y-3">
                  <div className="flex items-center gap-2 text-amber-300 font-medium">
                    <KeyRound className="w-4 h-4" /> Contraseña restablecida
                  </div>
                  <p className="text-amber-300 font-mono text-sm bg-black/20 px-3 py-2 rounded border border-amber-500/30 break-all select-all">{resetPasswordBox.passwordTemporal}</p>
                  <Button type="button" size="sm" variant="outline" className="w-full border-amber-500/40 text-amber-300 hover:bg-amber-500/20" onClick={() => { navigator.clipboard.writeText(resetPasswordBox.passwordTemporal); setCopyFeedback(true); setTimeout(() => setCopyFeedback(false), 2000); }}>
                    <Copy className="w-4 h-4 mr-2" />{copyFeedback ? 'Copiado' : 'Copiar contraseña'}
                  </Button>
                </div>
              )}
              <div className="grid gap-1"><p className="text-xs text-white/50 uppercase">Nombre</p><p className="text-white font-medium">{selectedUser.nombre}</p></div>
              <div className="grid gap-1"><p className="text-xs text-white/50 uppercase">Email (usuario)</p><p className="text-white font-mono text-sm break-all">{selectedUser.email}</p></div>
              <div className="grid gap-1">
                <p className="text-xs text-white/50 uppercase">Contraseña</p>
                {userPasswordTemporal[selectedUser._id] ? (
                  <p className="text-amber-300 font-mono text-sm bg-white/5 px-3 py-2 rounded border border-amber-500/30 break-all select-all">{userPasswordTemporal[selectedUser._id]}</p>
                ) : (
                  <p className="text-white/50 text-sm">Solo visible al crear o restablecer.</p>
                )}
                <Button type="button" variant="outline" size="sm" className="border-white/20 text-white hover:bg-white/10 w-fit" disabled={resetPasswordMutation.isPending} onClick={() => resetPasswordMutation.mutate(selectedUser._id)}>
                  <KeyRound className="w-4 h-4 mr-2" />{resetPasswordMutation.isPending ? 'Generando...' : 'Restablecer contraseña'}
                </Button>
              </div>
              <div className="grid gap-1"><p className="text-xs text-white/50 uppercase">Estado</p>
                <div className="flex items-center gap-3">
                  <Badge className={selectedUser.estado === 'active' ? 'bg-green-500/20 text-green-400' : selectedUser.estado === 'suspended' ? 'bg-red-500/20 text-red-400' : selectedUser.estado === 'vinculado' ? 'bg-blue-500/20 text-blue-400' : 'bg-amber-500/20 text-amber-400'}>
                    {selectedUser.estado === 'active' ? 'Activo' : selectedUser.estado === 'suspended' ? 'Suspendido' : selectedUser.estado === 'vinculado' ? 'Vinculado' : selectedUser.estado === 'pendiente_vinculacion' ? 'Pend. vinculación' : selectedUser.estado}
                  </Badge>
                  <Button size="sm" variant="outline" className={`border-white/20 text-xs ${selectedUser.estado === 'active' ? 'text-red-400 border-red-500/30' : 'text-green-400 border-green-500/30'}`}
                    disabled={changeStatusMutation.isPending}
                    onClick={() => {
                      const ns = selectedUser.estado === 'active' ? 'suspended' : 'active';
                      if (window.confirm(`¿${ns === 'suspended' ? 'Suspender' : 'Activar'} cuenta de ${selectedUser.nombre}?`)) changeStatusMutation.mutate({ id: selectedUser._id, status: ns });
                    }}>
                    {selectedUser.estado === 'active' ? 'Suspender' : 'Activar'}
                  </Button>
                </div>
              </div>
              {selectedUser.curso && <div className="grid gap-1"><p className="text-xs text-white/50 uppercase">Curso</p><p className="text-white">{selectedUser.curso}</p></div>}
              {(selectedUser.telefono || selectedUser.celular) && <div className="grid gap-1"><p className="text-xs text-white/50 uppercase">Contacto</p><p className="text-white/80 text-sm">{selectedUser.telefono || selectedUser.celular}</p></div>}
              {selectedUser.codigoUnico && <div className="grid gap-1"><p className="text-xs text-white/50 uppercase">Código único</p><p className="text-white font-mono">{selectedUser.codigoUnico}</p></div>}
              {Array.isArray(selectedUser.materias) && selectedUser.materias.length > 0 && <div className="grid gap-1"><p className="text-xs text-white/50 uppercase">Materia(s)</p><p className="text-white/80 text-sm">{selectedUser.materias.join(', ')}</p></div>}
              <Button variant="outline" className="mt-2 border-white/10 text-white" onClick={() => setEditUserOpen(false)}>Cerrar</Button>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Diálogo: Editar Materia */}
      <Dialog
        open={editMateriaOpen}
        onOpenChange={(open) => {
          setEditMateriaOpen(open);
          if (!open) {
            setEditingMateria(null);
            setEditMateriaTab('detalles');
          }
        }}
      >
        <DialogContent className="bg-[#0a0a2a] border-white/10 text-white max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-white">
              Editar materia{editingMateria ? `: ${editingMateria.nombre}` : ''}
            </DialogTitle>
            <DialogDescription className="text-white/60">
              Ajusta los datos de la materia y su asignación a cursos y profesores.
            </DialogDescription>
          </DialogHeader>
          {editingMateria && (
            <Tabs value={editMateriaTab} onValueChange={(v) => setEditMateriaTab(v as 'detalles' | 'cursos')} className="mt-3">
              <TabsList className="bg-white/5">
                <TabsTrigger value="detalles" className="text-white data-[state=active]:bg-white/10">
                  Editar materia
                </TabsTrigger>
                <TabsTrigger value="cursos" className="text-white data-[state=active]:bg-white/10">
                  Cursos y profesores
                </TabsTrigger>
              </TabsList>
              <TabsContent value="detalles" className="mt-4">
                <div className="space-y-4">
                  <div>
                    <Label className="text-white/90 mb-2 block">Nombre *</Label>
                    <Input
                      value={editingMateria.nombre}
                      onChange={(e) => setEditingMateria({ ...editingMateria, nombre: e.target.value })}
                      placeholder="Ej: Matemáticas"
                      className="bg-white/5 border-white/10 text-white placeholder:text-white/40"
                    />
                  </div>
                  <div>
                    <Label className="text-white/90 mb-2 block">Área (opcional)</Label>
                    <Input
                      value={editingMateria.area ?? ''}
                      onChange={(e) => setEditingMateria({ ...editingMateria, area: e.target.value })}
                      placeholder="Ej: Ciencias Exactas"
                      className="bg-white/5 border-white/10 text-white placeholder:text-white/40"
                    />
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <Button
                      variant="outline"
                      className="border-white/10 text-white"
                      onClick={() => setEditMateriaOpen(false)}
                    >
                      Cancelar
                    </Button>
                    <Button
                      disabled={!editingMateria.nombre.trim() || editMateriaMutation.isPending}
                      style={{ background: `linear-gradient(to right, ${colorPrimario}, ${colorSecundario})` }}
                      onClick={() =>
                        editMateriaMutation.mutate({
                          id: editingMateria.id,
                          nombre: editingMateria.nombre.trim(),
                          area: editingMateria.area ?? undefined,
                        })
                      }
                    >
                      {editMateriaMutation.isPending ? 'Guardando...' : 'Guardar cambios'}
                    </Button>
                  </div>
                </div>
              </TabsContent>
              <TabsContent value="cursos" className="mt-4">
                <div className="space-y-4">
                  <p className="text-white/70 text-sm font-medium">Cursos donde se dicta esta materia</p>
                  <p className="text-white/50 text-xs">
                    (La edición de cursos y profesores por materia se gestiona desde la sección &quot;Cursos&quot;,
                    donde cada curso muestra sus materias y profesores asociados.)
                  </p>
                </div>
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
