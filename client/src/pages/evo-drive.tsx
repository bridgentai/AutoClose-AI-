import React, { useEffect, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/lib/authContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  FolderOpen,
  FileText,
  ExternalLink,
  Plus,
  Cloud,
  Link2,
  ChevronDown,
  ChevronRight,
  Search,
  LayoutGrid,
  List,
  MoreVertical,
  Upload,
  FileSpreadsheet,
  Presentation,
  X,
  Check,
  Star,
  Trash2,
  Pencil,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useLocation } from 'wouter';

/** Carpeta por materia para profesor (cada ítem = group_subject). */
interface TeacherFolder {
  id: string;
  name: string;
  groupId: string;
  groupSubjectId: string;
}

/** Curso con materias anidadas para admin/directivo (dos niveles: curso → materia). */
interface EvoGroupWithSubjects {
  id: string;
  name: string;
  groupSubjects?: { id: string; name: string; groupId: string; groupSubjectId: string }[];
}

interface EvoGroup {
  id: string;
  name: string;
}

/** Carpeta por materia para estudiantes (group_subject). */
interface SubjectFolder {
  id: string;
  name: string;
  groupId: string;
  groupName: string;
  icon?: string;
}

interface EvoFile {
  id: string;
  nombre: string;
  tipo: string;
  origen: string;
  googleWebViewLink?: string;
  evoStorageUrl?: string;
  cursoNombre: string;
}

/** Ítem de Mi carpeta (personal del estudiante). */
interface MyFolderFile {
  id: string;
  nombre: string;
  tipo: string;
  url: string;
  googleWebViewLink?: string;
  origen: string;
}

interface GoogleDriveFile {
  id: string;
  name: string;
  mimeType?: string;
  webViewLink?: string;
  size?: string;
}

const ROLES_WRITE = ['profesor', 'directivo', 'school_admin', 'super_admin', 'admin-general-colegio'];

// Carpeta por materia (vista estudiante): archivos del profesor para esa materia. groupId + groupSubjectId.
function SubjectFolder({ folder }: { folder: SubjectFolder }) {
  const [open, setOpen] = useState(true);
  const { data: files = [], isLoading } = useQuery<EvoFile[]>({
    queryKey: ['evo-drive', 'files', folder.groupId, folder.id],
    queryFn: () =>
      apiRequest(
        'GET',
        `/api/evo-drive/files?cursoId=${encodeURIComponent(folder.groupId)}&groupSubjectId=${encodeURIComponent(folder.id)}`
      ),
  });
  const sorted = [...files].sort((a, b) =>
    (a.nombre || '').localeCompare(b.nombre || '', undefined, { sensitivity: 'base' })
  );

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card className="bg-[#1E3A8A]/25 border-white/10 overflow-hidden">
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="w-full flex items-center gap-3 p-4 text-left hover:bg-[#1E3A8A]/40 transition-colors"
          >
            {open ? (
              <ChevronDown className="w-5 h-5 text-[#3B82F6] shrink-0" />
            ) : (
              <ChevronRight className="w-5 h-5 text-[#3B82F6] shrink-0" />
            )}
            {folder.icon ? (
              <span className="text-xl leading-none w-6 flex items-center justify-center shrink-0" aria-hidden>{folder.icon}</span>
            ) : (
              <FolderOpen className="w-6 h-6 text-[#3B82F6] shrink-0" />
            )}
            <span className="font-semibold text-white">{folder.name}</span>
            <span className="text-[#E2E8F0]/70 text-sm ml-auto">
              {files.length} {files.length === 1 ? 'archivo' : 'archivos'}
            </span>
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0 pb-4">
            {isLoading ? (
              <div className="space-y-2 pl-12">
                <Skeleton className="h-12 w-full bg-[#1E3A8A]/30" />
                <Skeleton className="h-12 w-full bg-[#1E3A8A]/30" />
              </div>
            ) : sorted.length === 0 ? (
              <p className="text-[#E2E8F0]/70 text-sm pl-12 py-2">No hay archivos en esta materia aún.</p>
            ) : (
              <ul className="space-y-2 pl-12">
                {sorted.map((f) => (
                  <FileRow key={f.id} file={f} />
                ))}
              </ul>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

function mimeToTipo(mime: string): string {
  if (!mime) return 'file';
  if (mime.includes('document') || mime.includes('word')) return 'doc';
  if (mime.includes('spreadsheet') || mime.includes('sheet')) return 'sheet';
  if (mime.includes('presentation') || mime.includes('slide')) return 'slide';
  if (mime.includes('pdf')) return 'pdf';
  if (mime.includes('video')) return 'video';
  if (mime.includes('image')) return 'image';
  return 'link';
}

/** Carpeta seleccionada (grupo + materia) para listar archivos. */
interface SelectedFolder {
  groupId: string;
  groupSubjectId: string;
  folderName: string;
  groupName: string;
}

export default function EvoDrivePage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [selectedFolder, setSelectedFolder] = useState<SelectedFolder | null>(null);
  const [addFromGoogleOpen, setAddFromGoogleOpen] = useState(false);
  const [addFromEvoOpen, setAddFromEvoOpen] = useState(false);
  const [evoLinkName, setEvoLinkName] = useState('');
  const [evoLinkUrl, setEvoLinkUrl] = useState('');
  const [googleSearch, setGoogleSearch] = useState('');
  const [fileSearch, setFileSearch] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [createNewOpen, setCreateNewOpen] = useState(false);
  const [createNewType, setCreateNewType] = useState<'doc' | 'sheet' | 'slide'>('doc');
  const [createNewNombre, setCreateNewNombre] = useState('');
  const [expandedAdminCourseId, setExpandedAdminCourseId] = useState<string | null>(null);
  const [librarySection, setLibrarySection] = useState<'all' | 'recent' | 'starred' | 'trash'>('all');
  const [sortMode, setSortMode] = useState<'recent' | 'oldest' | 'name-asc' | 'name-desc'>('recent');
  const [starredIds, setStarredIds] = useState<string[]>([]);
  const [trashIds, setTrashIds] = useState<string[]>([]);
  const isTeacher = user?.rol && ROLES_WRITE.includes(user.rol);
  const isProfesor = user?.rol === 'profesor';
  const isAdminOrDirectivo = ['admin-general-colegio', 'directivo', 'school_admin', 'super_admin'].includes(user?.rol || '');

  // Mi carpeta (estudiante): modales y estado
  const [myFolderAddGoogleOpen, setMyFolderAddGoogleOpen] = useState(false);
  const [myFolderAddEvoOpen, setMyFolderAddEvoOpen] = useState(false);
  const [myFolderCreateNewOpen, setMyFolderCreateNewOpen] = useState(false);
  const [myFolderCreateNewType, setMyFolderCreateNewType] = useState<'doc' | 'sheet' | 'slide'>('doc');
  const [myFolderCreateNewNombre, setMyFolderCreateNewNombre] = useState('');
  const [myFolderEvoLinkName, setMyFolderEvoLinkName] = useState('');
  const [myFolderEvoLinkUrl, setMyFolderEvoLinkUrl] = useState('');
  const [myFolderGoogleSearch, setMyFolderGoogleSearch] = useState('');

  const { data: googleStatus = { connected: false } } = useQuery<{ connected: boolean }>({
    queryKey: ['evo-drive', 'google-status'],
    queryFn: () => apiRequest('GET', '/api/evo-drive/google/status'),
  });

  const { data: groupsData = [] } = useQuery<TeacherFolder[] | EvoGroupWithSubjects[]>({
    queryKey: ['evo-drive', 'groups'],
    queryFn: () => apiRequest('GET', '/api/evo-drive/groups'),
    enabled: isTeacher,
  });
  const teacherFolders: TeacherFolder[] = isProfesor ? (groupsData as TeacherFolder[]) : [];
  const adminGroups: EvoGroupWithSubjects[] = isAdminOrDirectivo ? (groupsData as EvoGroupWithSubjects[]) : [];

  // Derivados de la carpeta seleccionada (profesor y admin/directivo)
  const cursoId = selectedFolder?.groupId ?? '';
  const selectedGroupSubjectId = selectedFolder?.groupSubjectId ?? '';
  const group = selectedFolder ? { name: selectedFolder.groupName } : null;

  // Misma API que "Mis Materias Asignadas" para que el estudiante vea sus carpetas por materia (Física, Matemáticas, etc.)
  const { data: meCourses = [] } = useQuery<Array<{ _id: string; nombre: string; groupId?: string; groupName?: string; subjectName?: string; icono?: string }>>({
    queryKey: ['users', 'me', 'courses'],
    queryFn: () => apiRequest('GET', '/api/users/me/courses'),
    enabled: !isTeacher,
  });
  const subjectFolders: SubjectFolder[] = meCourses
    .filter((c): c is typeof c & { groupId: string; groupName: string } => !!c.groupId && !!c.groupName)
    .map((c) => ({
      id: c._id,
      name: c.groupName ? `${c.subjectName || c.nombre} — ${c.groupName}` : (c.subjectName || c.nombre),
      groupId: c.groupId,
      groupName: c.groupName,
      icon: c.icono?.trim() || undefined,
    }));

  const { data: myFolderFiles = [], refetch: refetchMyFolder } = useQuery<MyFolderFile[]>({
    queryKey: ['evo-drive', 'my-folder'],
    queryFn: () => apiRequest('GET', '/api/evo-drive/my-folder'),
    enabled: !isTeacher,
  });

  const { data: files = [], isLoading: filesLoading } = useQuery<EvoFile[]>({
    queryKey: ['evo-drive', 'files', cursoId, selectedGroupSubjectId],
    queryFn: () =>
      apiRequest(
        'GET',
        `/api/evo-drive/files?cursoId=${encodeURIComponent(cursoId)}&groupSubjectId=${encodeURIComponent(selectedGroupSubjectId)}`
      ),
    enabled: !!cursoId && !!selectedGroupSubjectId,
  });

  const { data: googleFilesRes, isLoading: googleFilesLoading, isError: googleFilesError } = useQuery<{ files: GoogleDriveFile[] }>({
    queryKey: ['evo-drive', 'google-files', googleSearch],
    queryFn: () =>
      apiRequest('GET', `/api/evo-drive/google/files?q=${encodeURIComponent(googleSearch)}`),
    enabled: addFromGoogleOpen && !!googleStatus.connected,
    retry: false,
  });
  const googleFiles = googleFilesRes?.files ?? [];
  const googleDriveDisconnectedInModal = !googleStatus.connected || (!!googleStatus.connected && googleFilesError);

  const { data: myFolderGoogleFilesRes, isLoading: myFolderGoogleFilesLoading, isError: myFolderGoogleFilesError } = useQuery<{
    files: GoogleDriveFile[];
  }>({
    queryKey: ['evo-drive', 'google-files-my', myFolderGoogleSearch],
    queryFn: () =>
      apiRequest('GET', `/api/evo-drive/google/files?q=${encodeURIComponent(myFolderGoogleSearch)}`),
    enabled: myFolderAddGoogleOpen && !!googleStatus.connected,
    retry: false,
  });
  const myFolderGoogleFiles = myFolderGoogleFilesRes?.files ?? [];
  const myFolderGoogleDriveDisconnected = !googleStatus.connected || (!!googleStatus.connected && myFolderGoogleFilesError);

  useEffect(() => {
    if (isProfesor && teacherFolders.length > 0 && !selectedFolder) {
      const f = teacherFolders[0];
      const groupName = f.name.includes(' — ') ? f.name.split(' — ')[1]?.trim() ?? f.name : f.name;
      setSelectedFolder({
        groupId: f.groupId,
        groupSubjectId: f.groupSubjectId,
        folderName: f.name,
        groupName,
      });
    }
  }, [isProfesor, teacherFolders, selectedFolder]);

  const connectGoogle = async () => {
    try {
      const data = await apiRequest<{ url: string }>('GET', '/api/evo-drive/google/auth-url');
      const url = data?.url;
      if (url && typeof url === 'string') {
        window.location.href = url;
      } else {
        toast({
          title: 'Error',
          description: 'No se pudo obtener la URL de Google. Revisa la configuración del backend.',
          variant: 'destructive',
        });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error al conectar con Google Drive';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    }
  };

  const addFileMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      apiRequest('POST', '/api/evo-drive/files', body),
    onSuccess: (_, variables) => {
      const gid = (variables.cursoId as string) ?? cursoId;
      const gsid = (variables.groupSubjectId as string) ?? selectedGroupSubjectId;
      queryClient.invalidateQueries({ queryKey: ['evo-drive', 'files', gid, gsid] });
      if (variables.origen === 'google') {
        setAddFromGoogleOpen(false);
        toast({ title: 'Archivo agregado', description: 'Se vinculó el archivo de Google Drive.' });
      } else {
        setAddFromEvoOpen(false);
        setEvoLinkName('');
        setEvoLinkUrl('');
        toast({ title: 'Archivo agregado', description: 'Se añadió el enlace a Evo Drive.' });
      }
    },
    onError: (e: Error) => {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    },
  });

  const createNewDocMutation = useMutation({
    mutationFn: (body: { nombre: string; tipo: 'doc' | 'sheet' | 'slide'; cursoId: string; cursoNombre: string; groupSubjectId?: string }) =>
      apiRequest('POST', '/api/evo-drive/google/create', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['evo-drive', 'files', cursoId, selectedGroupSubjectId] });
      setCreateNewOpen(false);
      setCreateNewNombre('');
      toast({ title: 'Documento creado', description: 'Se creó en Google Drive y se añadió a Evo Drive.' });
    },
    onError: (e: Error) => {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    },
  });

  const addToMyFolderMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) => apiRequest('POST', '/api/evo-drive/my-folder', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['evo-drive', 'my-folder'] });
      toast({ title: 'Agregado', description: 'Se añadió a Mi carpeta.' });
    },
    onError: (e: Error) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const deleteFromMyFolderMutation = useMutation({
    mutationFn: (id: string) => apiRequest('DELETE', `/api/evo-drive/my-folder/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['evo-drive', 'my-folder'] });
      toast({ title: 'Eliminado', description: 'Se quitó de Mi carpeta.' });
    },
    onError: (e: Error) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const createPersonalDocForMyMutation = useMutation({
    mutationFn: (body: { nombre: string; tipo: 'doc' | 'sheet' | 'slide' }) =>
      apiRequest<{ googleWebViewLink?: string; nombre?: string }>('POST', '/api/evo-drive/google/create-personal', body),
    onSuccess: (data) => {
      const link = data?.googleWebViewLink;
      const nombre = (data?.nombre || 'Documento').trim();
      if (link) {
        addToMyFolderMutation.mutate({
          nombre,
          tipo: 'doc',
          url: link,
          googleWebViewLink: link,
        });
      }
      setMyFolderCreateNewOpen(false);
      setMyFolderCreateNewNombre('');
      toast({ title: 'Creado', description: 'Se creó en tu Drive y se añadió a Mi carpeta.' });
    },
    onError: (e: Error) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const handleCreateNewDoc = () => {
    if (!selectedFolder || !createNewNombre.trim()) return;
    if (!selectedGroupSubjectId) {
      toast({
        title: 'Elige una carpeta',
        description: 'Debes seleccionar una carpeta (materia — curso) antes de crear un documento.',
        variant: 'destructive',
      });
      return;
    }
    createNewDocMutation.mutate({
      nombre: createNewNombre.trim(),
      tipo: createNewType,
      cursoId: selectedFolder.groupId,
      cursoNombre: selectedFolder.groupName,
      groupSubjectId: selectedFolder.groupSubjectId,
    });
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('googleConnected') === 'true') {
      window.history.replaceState({}, '', '/evo-drive');
      queryClient.invalidateQueries({ queryKey: ['evo-drive', 'google-status'] });
      toast({ title: 'Conectado', description: 'Google Drive se conectó correctamente.' });
    }
    if (params.get('error')) {
      const err = params.get('error');
      toast({
        title: 'Error al conectar',
        description:
          err === 'missing_params'
            ? 'Faltan parámetros. Vuelve a intentar.'
            : err === 'auth_failed'
              ? 'No se pudo autorizar con Google.'
              : 'Error de conexión con Google.',
        variant: 'destructive',
      });
      window.history.replaceState({}, '', '/evo-drive');
    }
  }, [queryClient, toast]);

  useEffect(() => {
    try {
      const rawStarred = localStorage.getItem('evo-drive-starred');
      const rawTrash = localStorage.getItem('evo-drive-trash');
      if (rawStarred) setStarredIds(JSON.parse(rawStarred));
      if (rawTrash) setTrashIds(JSON.parse(rawTrash));
    } catch {
      setStarredIds([]);
      setTrashIds([]);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('evo-drive-starred', JSON.stringify(starredIds));
  }, [starredIds]);

  useEffect(() => {
    localStorage.setItem('evo-drive-trash', JSON.stringify(trashIds));
  }, [trashIds]);

  const allFilesSorted = [...files];
  const withSearch = fileSearch.trim()
    ? allFilesSorted.filter((f) =>
        (f.nombre || '').toLowerCase().includes(fileSearch.trim().toLowerCase())
      )
    : allFilesSorted;
  const nonTrash = withSearch.filter((f) => !trashIds.includes(f.id));
  const activeSectionFiles = librarySection === 'trash'
    ? withSearch.filter((f) => trashIds.includes(f.id))
    : librarySection === 'starred'
      ? nonTrash.filter((f) => starredIds.includes(f.id))
      : librarySection === 'recent'
        ? [...nonTrash]
        : nonTrash;
  const indexedFiles = activeSectionFiles.map((f, idx) => ({ f, idx }));
  const allFiles = [...indexedFiles].sort((a, b) => {
    if (sortMode === 'recent') return b.idx - a.idx;
    if (sortMode === 'oldest') return a.idx - b.idx;
    const nameA = (a.f.nombre || '').toLowerCase();
    const nameB = (b.f.nombre || '').toLowerCase();
    if (sortMode === 'name-asc') return nameA.localeCompare(nameB);
    if (sortMode === 'name-desc') return nameB.localeCompare(nameA);
    return 0;
  }).map((x) => x.f);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const toggleStar = (id: string) => {
    setStarredIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };
  const toggleTrash = (id: string) => {
    setTrashIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  // Enlace para abrir en Drive cuando la API no devuelve webViewLink
  const driveViewLink = (id: string, mimeType?: string) => {
    const m = (mimeType || '').toLowerCase();
    if (m.includes('document')) return `https://docs.google.com/document/d/${id}/edit`;
    if (m.includes('spreadsheet')) return `https://docs.google.com/spreadsheets/d/${id}/edit`;
    if (m.includes('presentation')) return `https://docs.google.com/presentation/d/${id}/edit`;
    return `https://drive.google.com/file/d/${id}/view`;
  };

  const handleAddFromGoogle = (gfile: GoogleDriveFile) => {
    if (!selectedFolder) {
      toast({
        title: 'Selecciona una carpeta',
        description: 'Elige una carpeta (materia — curso) en el sidebar antes de agregar archivos.',
        variant: 'destructive',
      });
      return;
    }
    if (!selectedGroupSubjectId) {
      toast({
        title: 'Elige una materia',
        description: 'Debes seleccionar una materia antes de agregar un archivo.',
        variant: 'destructive',
      });
      return;
    }
    const tipo = mimeToTipo(gfile.mimeType || '');
    const webViewLink = gfile.webViewLink || driveViewLink(gfile.id, gfile.mimeType);
    addFileMutation.mutate({
      nombre: gfile.name,
      tipo,
      origen: 'google',
      cursoId: selectedFolder.groupId,
      cursoNombre: selectedFolder.groupName,
      groupSubjectId: selectedFolder.groupSubjectId,
      googleFileId: gfile.id,
      googleWebViewLink: webViewLink,
      googleMimeType: gfile.mimeType,
      mimeType: gfile.mimeType,
      sizeBytes: gfile.size ? parseInt(gfile.size, 10) : undefined,
    });
  };

  const handleAddFromEvo = () => {
    if (!selectedFolder || !evoLinkName.trim()) return;
    if (!selectedGroupSubjectId) {
      toast({
        title: 'Elige una materia',
        description: 'Debes seleccionar una carpeta (materia — curso) antes de agregar un enlace.',
        variant: 'destructive',
      });
      return;
    }
    addFileMutation.mutate({
      nombre: evoLinkName.trim(),
      tipo: 'link',
      origen: 'material',
      cursoId: selectedFolder.groupId,
      cursoNombre: selectedFolder.groupName,
      groupSubjectId: selectedFolder.groupSubjectId,
      evoStorageUrl: evoLinkUrl.trim() || undefined,
    });
  };

  const handleMyFolderAddFromGoogle = (gfile: GoogleDriveFile) => {
    const tipo = mimeToTipo(gfile.mimeType || '');
    const webViewLink = gfile.webViewLink || driveViewLink(gfile.id, gfile.mimeType);
    addToMyFolderMutation.mutate({
      nombre: gfile.name,
      tipo,
      url: webViewLink,
      googleFileId: gfile.id,
      googleWebViewLink: webViewLink,
      googleMimeType: gfile.mimeType,
    });
    setMyFolderAddGoogleOpen(false);
    setMyFolderGoogleSearch('');
  };

  const handleMyFolderAddFromEvo = () => {
    if (!myFolderEvoLinkUrl.trim() && !myFolderEvoLinkName.trim()) return;
    addToMyFolderMutation.mutate({
      nombre: myFolderEvoLinkName.trim() || 'Enlace',
      tipo: 'link',
      url: myFolderEvoLinkUrl.trim() || '',
    });
    setMyFolderAddEvoOpen(false);
    setMyFolderEvoLinkName('');
    setMyFolderEvoLinkUrl('');
  };

  const handleMyFolderCreateNew = () => {
    if (!myFolderCreateNewNombre.trim()) return;
    createPersonalDocForMyMutation.mutate({
      nombre: myFolderCreateNewNombre.trim(),
      tipo: myFolderCreateNewType,
    });
  };

  return (
    <>
    <div className="flex-1 min-h-0 flex overflow-hidden min-w-0">
      <aside
        className="w-[220px] shrink-0 self-stretch flex flex-col border-r border-white/[0.08] overflow-y-auto"
        style={{ background: 'linear-gradient(180deg, #1E3A8A 0%, #0F172A 50%, #020617 100%)' }}
      >
        <div className="pt-5 pb-4 px-4 flex items-center gap-2 shrink-0">
          <div className="w-9 h-9 rounded-lg bg-white/10 border border-white/20 flex items-center justify-center shrink-0">
            <FileText className="w-5 h-5 text-white" />
          </div>
          <span className="text-white font-semibold text-base tracking-tight">Evo Drive</span>
        </div>
        <section className="mb-4">
          <p className="text-[10px] uppercase font-bold text-white/30 tracking-widest mx-2 mb-2" style={{ letterSpacing: '0.12em' }}>Navegación</p>
          <button type="button" onClick={() => setLibrarySection('all')} className={`w-[calc(100%-16px)] flex items-center justify-between px-3 py-2 rounded-xl mx-2 transition-colors text-left ${librarySection === 'all' ? 'text-white bg-[#3B82F6]/30 border border-white/20' : 'text-white/80 hover:bg-white/10'}`}>
            <span className="flex items-center gap-2">
              <FolderOpen className="w-4 h-4 text-white" />
              Todos los archivos
            </span>
            <span className="bg-[#3B82F6]/30 text-white border border-white/20 text-[10px] font-semibold px-2 rounded-full">{allFiles.length}</span>
          </button>
          <button type="button" onClick={() => setLibrarySection('recent')} className={`w-[calc(100%-16px)] flex items-center gap-2 px-3 py-2 rounded-xl mx-2 transition-colors text-left ${librarySection === 'recent' ? 'text-white bg-[#3B82F6]/30 border border-white/20' : 'text-white/80 hover:bg-white/10'}`}>
            <FileText className="w-4 h-4 text-white" />
            Recientes
          </button>
          <button type="button" onClick={() => setLibrarySection('starred')} className={`w-[calc(100%-16px)] flex items-center gap-2 px-3 py-2 rounded-xl mx-2 transition-colors text-left ${librarySection === 'starred' ? 'text-white bg-[#3B82F6]/30 border border-white/20' : 'text-white/80 hover:bg-white/10'}`}>
            <Star className="w-4 h-4 text-white" />
            Destacados
          </button>
          <button type="button" onClick={() => setLibrarySection('trash')} className={`w-[calc(100%-16px)] flex items-center gap-2 px-3 py-2 rounded-xl mx-2 transition-colors text-left ${librarySection === 'trash' ? 'text-white bg-[#3B82F6]/30 border border-white/20' : 'text-white/80 hover:bg-white/10'}`}>
            <Trash2 className="w-4 h-4 text-white" />
            Papelera
          </button>
        </section>
        <section className="mb-4">
          <p className="text-[10px] uppercase font-bold text-white/30 tracking-widest mx-2 mb-2" style={{ letterSpacing: '0.12em' }}>Cursos</p>
          {isProfesor && teacherFolders.map((f) => {
            const isActive = selectedFolder?.groupSubjectId === f.groupSubjectId;
            return (
              <button
                key={f.groupSubjectId}
                type="button"
                onClick={() => {
                  const groupName = f.name.includes(' — ') ? f.name.split(' — ')[1]?.trim() ?? f.name : f.name;
                  setSelectedFolder({ groupId: f.groupId, groupSubjectId: f.groupSubjectId, folderName: f.name, groupName });
                }}
                className={`w-[calc(100%-16px)] flex items-center justify-between px-3 py-2 rounded-xl mx-2 text-left transition-colors ${isActive ? 'bg-[#3B82F6]/40 border border-white/20 text-white' : 'text-white/80 hover:bg-white/10'}`}
              >
                <span className="flex items-center gap-2 min-w-0 truncate">
                  <FolderOpen className="w-4 h-4 shrink-0 text-white" />
                  <span className="truncate">{f.name}</span>
                </span>
                <span className="bg-white/20 text-white border border-white/20 text-[10px] font-semibold px-2 rounded-full shrink-0 ml-1">{isActive ? allFiles.length : 0}</span>
              </button>
            );
          })}
          {isAdminOrDirectivo && adminGroups.map((g) => {
            const expanded = expandedAdminCourseId === g.id;
            return (
              <div key={g.id} className="mx-2">
                <button
                  type="button"
                  onClick={() => setExpandedAdminCourseId(expanded ? null : g.id)}
                  className="w-[calc(100%-0px)] flex items-center justify-between px-3 py-2 rounded-xl text-left transition-colors text-white/80 hover:bg-white/10"
                >
                  <span className="flex items-center gap-2 min-w-0 truncate">
                    <ChevronRight className={`w-4 h-4 shrink-0 transition-transform ${expanded ? 'rotate-90' : ''}`} />
                    <FolderOpen className="w-4 h-4 shrink-0 text-white" />
                    <span className="truncate">{g.name}</span>
                  </span>
                </button>
                {expanded && g.groupSubjects?.map((sub) => {
                  const isActive = selectedFolder?.groupSubjectId === sub.groupSubjectId;
                  const groupName = sub.name.includes(' — ') ? sub.name.split(' — ')[1]?.trim() ?? sub.name : sub.name;
                  return (
                    <button
                      key={sub.groupSubjectId}
                      type="button"
                      onClick={() => setSelectedFolder({ groupId: sub.groupId, groupSubjectId: sub.groupSubjectId, folderName: sub.name, groupName })}
                      className={`w-[calc(100%-16px)] ml-6 flex items-center justify-between px-3 py-2 rounded-xl text-left transition-colors ${isActive ? 'bg-[#3B82F6]/40 border border-white/20 text-white' : 'text-white/80 hover:bg-white/10'}`}
                    >
                      <span className="flex items-center gap-2 min-w-0 truncate">
                        <FolderOpen className="w-4 h-4 shrink-0 text-white" />
                        <span className="truncate">{sub.name}</span>
                      </span>
                      <span className="bg-white/20 text-white border border-white/20 text-[10px] font-semibold px-2 rounded-full shrink-0 ml-1">{isActive ? allFiles.length : 0}</span>
                    </button>
                  );
                })}
              </div>
            );
          })}
          {!isTeacher && subjectFolders.map((folder) => (
            <button key={folder.id} type="button" className="w-[calc(100%-16px)] flex items-center justify-between px-3 py-2 rounded-xl mx-2 text-white/80 hover:bg-white/10 transition-colors text-left">
              <span className="truncate">{folder.name}</span>
              <span className="bg-white/20 text-white border border-white/20 text-[10px] font-semibold px-2 rounded-full shrink-0">0</span>
            </button>
          ))}
        </section>
        <section className="mt-auto pt-4 border-t border-white/10">
          <div className="mx-2 mb-2 rounded-xl p-3 border border-white/10 bg-[#0F172A]/60">
            <div className="flex items-center gap-2 text-white/90 mb-1">
              <Cloud className="w-4 h-4 shrink-0" />
              <span className="text-sm font-medium">Google Drive</span>
              {googleStatus.connected && <span className="w-2 h-2 rounded-full bg-[#22c55e] shrink-0 ml-auto" />}
            </div>
            <div className="h-1 rounded-full bg-white/10 overflow-hidden mt-2">
              <div className="h-full rounded-full bg-[#3B82F6]" style={{ width: '12%' }} />
            </div>
          </div>
        </section>
      </aside>

      <main className="flex-1 min-w-0 min-h-0 flex flex-col overflow-auto relative">
        {isTeacher && selectedFolder && (
          <div className="shrink-0 px-6 pt-4">
            <Button
              type="button"
              variant="ghost"
              className="text-[#3B82F6] hover:text-[#2563EB] hover:bg-white/5 px-0"
              onClick={() => setLocation(`/course-detail/${selectedFolder.groupId}/materia/${selectedFolder.groupSubjectId}`)}
            >
              <ChevronRight className="w-4 h-4 mr-1 rotate-180" />
              Volver al curso
            </Button>
          </div>
        )}
        {isTeacher && selectedFolder && (
          <div className="shrink-0 flex items-center gap-4 px-6 py-3 border-b border-white/10">
            <div className="flex-1 flex items-center gap-2 min-w-0 rounded-xl bg-[#1E3A8A]/40 border border-white/10 py-2 px-3">
              <Search className="w-4 h-4 text-white/50 shrink-0" />
              <input
                type="text"
                value={fileSearch}
                onChange={(e) => setFileSearch(e.target.value)}
                placeholder={group ? `Buscar en ${group.name}...` : 'Buscar en curso...'}
                className="flex-1 min-w-0 bg-transparent text-[13px] text-[#E2E8F0] placeholder:text-white/40 outline-none"
              />
            </div>
            <div className="flex items-center gap-1 rounded-xl p-0.5 bg-[#1E3A8A]/30 border border-white/10">
              <button type="button" onClick={() => setViewMode('grid')} className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${viewMode === 'grid' ? 'bg-[#3B82F6]/50 text-white' : 'text-white/60 hover:text-white'}`}>
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button type="button" onClick={() => setViewMode('list')} className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${viewMode === 'list' ? 'bg-[#3B82F6]/50 text-white' : 'text-white/60 hover:text-white'}`}>
                <List className="w-4 h-4" />
              </button>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button type="button" className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[#E2E8F0] hover:bg-[#1E3A8A]/40 border border-white/10 text-sm">
                  {sortMode === 'recent' && 'Más reciente primero'}
                  {sortMode === 'oldest' && 'Más antiguo primero'}
                  {sortMode === 'name-asc' && 'Nombre A-Z'}
                  {sortMode === 'name-desc' && 'Nombre Z-A'}
                  <ChevronDown className="w-4 h-4 text-white/50" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-[#0F172A] border border-white/10 rounded-xl p-1 min-w-[180px]">
                <DropdownMenuItem onClick={() => setSortMode('recent')} className="flex items-center gap-2 rounded-lg py-2 px-3 text-white/90 focus:bg-white/[0.06] focus:text-white">
                  <Check className={`w-4 h-4 text-[#00c8ff] ${sortMode === 'recent' ? 'opacity-100' : 'opacity-0'}`} />
                  Más reciente primero
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSortMode('oldest')} className="flex items-center gap-2 rounded-lg py-2 px-3 text-white/50 focus:bg-white/[0.06] focus:text-white">
                  <Check className={`w-4 h-4 text-[#00c8ff] ${sortMode === 'oldest' ? 'opacity-100' : 'opacity-0'}`} />
                  Más antiguo primero
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSortMode('name-asc')} className="flex items-center gap-2 rounded-lg py-2 px-3 text-white/50 focus:bg-white/[0.06] focus:text-white">
                  <Check className={`w-4 h-4 text-[#00c8ff] ${sortMode === 'name-asc' ? 'opacity-100' : 'opacity-0'}`} />
                  Nombre A-Z
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSortMode('name-desc')} className="flex items-center gap-2 rounded-lg py-2 px-3 text-white/50 focus:bg-white/[0.06] focus:text-white">
                  <Check className={`w-4 h-4 text-[#00c8ff] ${sortMode === 'name-desc' ? 'opacity-100' : 'opacity-0'}`} />
                  Nombre Z-A
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}

        {isTeacher && selectedFolder && (
          <div className="shrink-0 flex flex-wrap items-center gap-2.5 px-6 py-2 border-b border-white/10">
            {!googleStatus.connected && (
              <Button onClick={connectGoogle} variant="outline" size="sm" className="h-9 rounded-xl border-[#22c55e]/40 bg-[#22c55e]/10 text-[#22c55e] text-xs font-medium hover:bg-[#22c55e]/20">
                Conectar Google Drive
              </Button>
            )}
            {googleStatus.connected && (
              <Button type="button" variant="outline" size="sm" onClick={connectGoogle} className="h-8 rounded-xl border-white/10 bg-transparent px-2.5 text-[11px] font-medium text-white/90 hover:bg-white/10 hover:text-white">
                Reconectar Drive
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" title={!selectedFolder ? 'Selecciona una carpeta primero' : ''} className="h-9 rounded-full bg-white/10 border border-white/20 text-white text-[13px] font-medium hover:bg-white/15 px-4">
                  <Plus className="w-4 h-4 mr-2" />
                  Añadir o crear
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" sideOffset={8} className="w-[230px] rounded-xl border border-white/10 bg-[#0f172a] shadow-xl p-0 overflow-hidden">
                <div className="py-2.5">
                  <DropdownMenuItem onSelect={() => { if (googleStatus.connected) setTimeout(() => setAddFromGoogleOpen(true), 50); }} disabled={!googleStatus.connected} className="flex items-center gap-3 py-2.5 px-4 text-[13px] text-white/90 hover:bg-[#00c8ff]/10 focus:bg-[#00c8ff]/10 mx-0 rounded-none">
                    <div className="w-8 h-8 rounded-lg bg-[#00c8ff]/20 flex items-center justify-center shrink-0"><Cloud className="w-4 h-4 text-[#00c8ff]" /></div>
                    Google Drive
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => setTimeout(() => setAddFromEvoOpen(true), 50)} className="flex items-center gap-3 py-2.5 px-4 text-[13px] text-white/90 hover:bg-[#00c8ff]/10 focus:bg-[#00c8ff]/10 mx-0 rounded-none">
                    <div className="w-8 h-8 rounded-lg bg-[#00c8ff]/20 flex items-center justify-center shrink-0"><Link2 className="w-4 h-4 text-[#00c8ff]" /></div>
                    Enlace
                  </DropdownMenuItem>
                  <DropdownMenuItem className="flex items-center gap-3 py-2.5 px-4 text-[13px] text-white/90 hover:bg-[#00c8ff]/10 focus:bg-[#00c8ff]/10 mx-0 rounded-none">
                    <div className="w-8 h-8 rounded-lg bg-[#00c8ff]/20 flex items-center justify-center shrink-0"><FileText className="w-4 h-4 text-[#00c8ff]" /></div>
                    Archivo
                  </DropdownMenuItem>
                </div>
                <div className="border-t border-white/10" />
                <div className="py-2">
                  <p className="px-4 pt-1.5 pb-1 text-[11px] uppercase tracking-wider text-[#00c8ff]/50">Crear</p>
                  <DropdownMenuItem onSelect={() => setTimeout(() => { setCreateNewType('doc'); setCreateNewNombre(''); setCreateNewOpen(true); }, 50)} className="flex items-center gap-3 py-2.5 px-4 text-[13px] text-white/90 hover:bg-[#00c8ff]/10 focus:bg-[#00c8ff]/10 mx-0 rounded-none">
                    <div className="w-8 h-8 rounded-lg bg-[#1a56d6] flex items-center justify-center shrink-0"><FileText className="w-4 h-4 text-white" /></div>
                    Documentos
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => setTimeout(() => { setCreateNewType('slide'); setCreateNewNombre(''); setCreateNewOpen(true); }, 50)} className="flex items-center gap-3 py-2.5 px-4 text-[13px] text-white/90 hover:bg-[#00c8ff]/10 focus:bg-[#00c8ff]/10 mx-0 rounded-none">
                    <div className="w-8 h-8 rounded-lg bg-[#d97706] flex items-center justify-center shrink-0"><Presentation className="w-4 h-4 text-white" /></div>
                    Presentaciones
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => setTimeout(() => { setCreateNewType('sheet'); setCreateNewNombre(''); setCreateNewOpen(true); }, 50)} className="flex items-center gap-3 py-2.5 px-4 text-[13px] text-white/90 hover:bg-[#00c8ff]/10 focus:bg-[#00c8ff]/10 mx-0 rounded-none">
                    <div className="w-8 h-8 rounded-lg bg-[#16a34a] flex items-center justify-center shrink-0"><FileSpreadsheet className="w-4 h-4 text-white" /></div>
                    Hojas de cálculo
                  </DropdownMenuItem>
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}

        {isTeacher ? (
          <>
            <div className="flex-1 p-6 overflow-auto">
              {!selectedFolder ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <FolderOpen className="w-12 h-12 text-white/30 mb-4" />
                  <p className="text-white/70 font-medium">Selecciona una carpeta</p>
                  <p className="text-white/50 text-sm mt-1">Elige una materia — curso en el sidebar para ver y gestionar archivos.</p>
                </div>
              ) : filesLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-[72px] w-full rounded-xl bg-[#1E3A8A]/30" />
                  <Skeleton className="h-[72px] w-full rounded-xl bg-[#1E3A8A]/30" />
                </div>
              ) : viewMode === 'grid' ? (
                <div className="grid grid-cols-[repeat(auto-fill,minmax(110px,1fr))] gap-4">
                  {allFiles.map((f) => (
                    <FileRow
                      key={f.id}
                      file={f}
                      variant="grid"
                      isStarred={starredIds.includes(f.id)}
                      isInTrash={trashIds.includes(f.id)}
                      onToggleStar={toggleStar}
                      onToggleTrash={toggleTrash}
                      onOpenTrash={() => setLibrarySection('trash')}
                    />
                  ))}
                </div>
              ) : (
                <div className="w-full overflow-x-auto rounded-xl border border-white/10 bg-white/[0.03]">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-white/10">
                        <th className="text-[11px] uppercase text-white/40 font-semibold py-2.5 px-4 text-left">Nombre</th>
                        <th className="text-[11px] uppercase text-white/40 font-semibold py-2.5 px-4 text-left">Curso</th>
                        <th className="text-[11px] uppercase text-white/40 font-semibold py-2.5 px-4 text-left">Tipo</th>
                        <th className="text-[11px] uppercase text-white/40 font-semibold py-2.5 px-4 text-left">Modificado</th>
                        <th className="text-[11px] uppercase text-white/40 font-semibold py-2.5 px-4 text-left">Tamaño</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allFiles.map((f) => (
                        <FileRow
                          key={f.id}
                          file={f}
                          variant="list"
                          isStarred={starredIds.includes(f.id)}
                          isInTrash={trashIds.includes(f.id)}
                          onToggleStar={toggleStar}
                          onToggleTrash={toggleTrash}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {selectedFolder && !filesLoading && (
                <div
                  className="mt-6 rounded-xl border-2 border-dashed border-white/10 py-7 px-6 flex flex-col items-center justify-center gap-2 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.06] transition-colors cursor-pointer"
                  onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); e.dataTransfer.dropEffect = 'copy'; }}
                  onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const files = e.dataTransfer.files;
                    if (files?.length) toast({ title: 'Archivos listos', description: `${files.length} archivo(s) recibido(s). Usa "Añadir o crear" para vincular desde Google Drive.` });
                  }}
                  onClick={() => fileInputRef.current?.click()}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInputRef.current?.click(); } }}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      const files = e.target.files;
                      if (files?.length) toast({ title: 'Archivos listos', description: `${files.length} archivo(s) recibido(s). Usa "Añadir o crear" para vincular desde Google Drive.` });
                      e.target.value = '';
                    }}
                  />
                  <Upload className="w-[22px] h-[22px] text-[#3B82F6]" />
                  <p className="text-[13px] text-[#E2E8F0]/80">Arrastra archivos aquí o haz clic para subir</p>
                </div>
              )}
            </div>
          </>
        ) : (
            <>
              <div className="flex-1 p-6 overflow-auto space-y-3">
                {/* Mi carpeta: acento dorado sobre azul de plataforma */}
              <Card className="overflow-hidden border-white/10 bg-white/[0.04]">
                <Collapsible defaultOpen>
                  <CollapsibleTrigger asChild>
                    <button
                      type="button"
                      className="w-full flex items-center gap-3 p-4 text-left hover:bg-white/5 transition-colors"
                    >
                      <ChevronDown className="w-5 h-5 text-[#ffd700] shrink-0" />
                      <FolderOpen className="w-6 h-6 text-[#ffd700] shrink-0" />
                      <span className="font-semibold text-white">Mi carpeta</span>
                      <span className="text-white/50 text-sm ml-auto">
                        {myFolderFiles.length} {myFolderFiles.length === 1 ? 'archivo' : 'archivos'}
                      </span>
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CardContent className="pt-0 pb-4">
                      <div className="pl-12 space-y-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          {!googleStatus.connected && (
                            <Button
                              onClick={connectGoogle}
                              variant="outline"
                              size="sm"
                              className="h-8 rounded-md border-amber-500/40 bg-amber-500/10 text-amber-400 text-xs font-medium hover:bg-amber-500/20"
                            >
                              Conectar Google Drive
                            </Button>
                          )}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                size="sm"
                                className="h-9 rounded-full bg-[#ffd700]/20 border border-[#ffd700]/50 text-[#ffd700] text-[13px] font-medium hover:bg-[#ffd700]/30 px-4"
                              >
                                <Plus className="w-4 h-4 mr-2" />
                                Añadir o crear
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start" sideOffset={8} className="w-[230px] rounded-[14px] border-amber-500/20 bg-[#0f1c35] shadow-xl p-0 overflow-hidden">
                              <div className="py-2.5">
                                <DropdownMenuItem
                                  onSelect={() => googleStatus.connected && setTimeout(() => setMyFolderAddGoogleOpen(true), 50)}
                                  disabled={!googleStatus.connected}
                                  className="flex items-center gap-3 py-2.5 px-4 text-[13px] text-white/90 hover:bg-amber-500/10 focus:bg-amber-500/10 mx-0 rounded-none"
                                >
                                  <div className="w-8 h-8 rounded-[9px] bg-amber-500/20 flex items-center justify-center shrink-0">
                                    <Cloud className="w-4 h-4 text-amber-400" />
                                  </div>
                                  Google Drive
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onSelect={() => setTimeout(() => setMyFolderAddEvoOpen(true), 50)}
                                  className="flex items-center gap-3 py-2.5 px-4 text-[13px] text-white/90 hover:bg-amber-500/10 focus:bg-amber-500/10 mx-0 rounded-none"
                                >
                                  <div className="w-8 h-8 rounded-[9px] bg-amber-500/20 flex items-center justify-center shrink-0">
                                    <Link2 className="w-4 h-4 text-amber-400" />
                                  </div>
                                  Enlace
                                </DropdownMenuItem>
                              </div>
                              <div className="border-t border-amber-500/10" />
                              <div className="py-2">
                                <p className="px-4 pt-1.5 pb-1 text-[11px] uppercase tracking-wider text-amber-500/50">Crear</p>
                                <DropdownMenuItem
                                  onSelect={() => setTimeout(() => { setMyFolderCreateNewType('doc'); setMyFolderCreateNewNombre(''); setMyFolderCreateNewOpen(true); }, 50)}
                                  className="flex items-center gap-3 py-2.5 px-4 text-[13px] text-white/90 hover:bg-amber-500/10 focus:bg-amber-500/10 mx-0 rounded-none"
                                >
                                  <div className="w-8 h-8 rounded-[9px] bg-[#1a56d6] flex items-center justify-center shrink-0">
                                    <FileText className="w-4 h-4 text-white" />
                                  </div>
                                  Documentos
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onSelect={() => setTimeout(() => { setMyFolderCreateNewType('slide'); setMyFolderCreateNewNombre(''); setMyFolderCreateNewOpen(true); }, 50)}
                                  className="flex items-center gap-3 py-2.5 px-4 text-[13px] text-white/90 hover:bg-amber-500/10 focus:bg-amber-500/10 mx-0 rounded-none"
                                >
                                  <div className="w-8 h-8 rounded-[9px] bg-[#d97706] flex items-center justify-center shrink-0">
                                    <Presentation className="w-4 h-4 text-white" />
                                  </div>
                                  Presentaciones
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onSelect={() => setTimeout(() => { setMyFolderCreateNewType('sheet'); setMyFolderCreateNewNombre(''); setMyFolderCreateNewOpen(true); }, 50)}
                                  className="flex items-center gap-3 py-2.5 px-4 text-[13px] text-white/90 hover:bg-amber-500/10 focus:bg-amber-500/10 mx-0 rounded-none"
                                >
                                  <div className="w-8 h-8 rounded-[9px] bg-[#16a34a] flex items-center justify-center shrink-0">
                                    <FileSpreadsheet className="w-4 h-4 text-white" />
                                  </div>
                                  Hojas de cálculo
                                </DropdownMenuItem>
                              </div>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                        {myFolderFiles.length === 0 ? (
                          <p className="text-white/50 text-sm py-2">Aún no hay archivos. Usa &quot;Añadir o crear&quot; para agregar enlaces o crear documentos en tu Drive.</p>
                        ) : (
                          <ul className="space-y-2">
                            {myFolderFiles.map((f) => (
                              <li
                                key={f.id}
                                className="group flex items-center justify-between gap-4 py-2 px-3 rounded-lg bg-white/5 border border-white/10 hover:border-amber-500/20"
                              >
                                <div className="flex items-center gap-3 min-w-0 flex-1">
                                  <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center shrink-0">
                                    {f.origen === 'google' ? (
                                      <FileText className="w-4 h-4 text-amber-400" />
                                    ) : (
                                      <Link2 className="w-4 h-4 text-amber-400" />
                                    )}
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <p className="text-sm font-medium text-white truncate">{f.nombre}</p>
                                    {(f.url || f.googleWebViewLink) && (
                                      <a
                                        href={f.url || f.googleWebViewLink || '#'}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-[11px] text-amber-400 hover:underline truncate block"
                                      >
                                        Abrir
                                      </a>
                                    )}
                                  </div>
                                </div>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="text-white/60 hover:text-white hover:bg-white/10 h-8 w-8 p-0 shrink-0"
                                  onClick={() => deleteFromMyFolderMutation.mutate(f.id)}
                                  disabled={deleteFromMyFolderMutation.isPending}
                                  aria-label="Quitar"
                                >
                                  <X className="w-4 h-4" />
                                </Button>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </CardContent>
                  </CollapsibleContent>
                </Collapsible>
              </Card>

              {/* Carpetas por materia (siempre todas, vacías o no) */}
              {subjectFolders.length === 0 ? (
                <div className="rounded-xl border border-white/10 bg-white/[0.03] py-8 px-6">
                  <p className="text-[#E2E8F0]/70 text-sm text-center">
                    No tienes materias asignadas aún. Cuando te inscriban en cursos, verás aquí una carpeta por cada materia con los archivos que suba tu profesor.
                  </p>
                </div>
              ) : (
                subjectFolders.map((folder) => <SubjectFolder key={folder.id} folder={folder} />)
              )}
              </div>
            </>
          )}
        </main>
    </div>

    {/* Agregar desde Google Drive */}
      <Dialog open={addFromGoogleOpen} onOpenChange={setAddFromGoogleOpen}>
        <DialogContent className="bg-[#0f172a] border border-white/10 max-w-[380px] rounded-2xl p-6 shadow-xl data-[state=open]:animate-in data-[state=open]:zoom-in-95 data-[state=open]:slide-in-from-bottom-2 overflow-hidden [&+[data-radix-dialog-overlay]]:bg-black/45">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-3">
              <div className="w-10 h-10 rounded-[11px] bg-[#00c8ff]/20 flex items-center justify-center shrink-0">
                <Cloud className="w-5 h-5 text-[#00c8ff]" />
              </div>
              <div>
                <span className="text-base font-semibold text-white block">Agregar desde Google Drive</span>
                <span className="text-xs text-white/60 mt-0.5 block">Selecciona un archivo de tu Drive</span>
              </div>
            </DialogTitle>
          </DialogHeader>
          {googleDriveDisconnectedInModal ? (
            <div className="space-y-4 py-2">
              <p className="text-white/60 text-sm">
                {googleFilesError ? 'Google Drive se desconectó. Reconéctalo para seguir usando tus archivos.' : 'Conecta Google Drive para agregar archivos desde tu cuenta.'}
              </p>
              <Button type="button" onClick={connectGoogle} className="w-full rounded-xl border border-[#22c55e]/40 bg-[#22c55e]/10 text-[#22c55e] hover:bg-[#22c55e]/20 font-medium">
                <Cloud className="w-4 h-4 mr-2" />
                Reconectar Google Drive
              </Button>
              <p className="text-white/40 text-xs">Serás redirigido a Google y volverás aquí sin cerrar sesión.</p>
            </div>
          ) : !selectedFolder ? (
            <p className="text-white/60 text-sm py-4">
              Selecciona una carpeta (materia — curso) en el sidebar para poder agregar archivos de Google Drive.
            </p>
          ) : (
            <>
              <div className="space-y-2">
                <Label className="text-xs font-medium text-white/60">Buscar en Drive</Label>
                <Input
                  value={googleSearch}
                  onChange={(e) => setGoogleSearch(e.target.value)}
                  placeholder="Nombre del archivo..."
                  className="bg-white/[0.06] border border-white/[0.08] rounded-xl py-2.5 px-3 text-sm text-white placeholder:text-white/50 focus:border-white/20"
                />
              </div>
              <ScrollArea className="h-[280px] rounded-xl border border-white/[0.08]">
                {googleFilesLoading ? (
                  <div className="p-4 space-y-2">
                    <Skeleton className="h-12 w-full bg-white/10 rounded-lg" />
                    <Skeleton className="h-12 w-full bg-white/10 rounded-lg" />
                  </div>
                ) : googleFiles.length === 0 ? (
                  <p className="text-white/50 text-sm p-4">No se encontraron archivos o escribe para buscar.</p>
                ) : (
                  <ul className="p-2 space-y-1">
                    {googleFiles.map((gf) => (
                      <li
                        key={gf.id}
                        className="flex items-center justify-between gap-3 p-3 rounded-lg hover:bg-white/10 text-white border border-transparent hover:border-white/10"
                      >
                        <span className="truncate text-sm flex-1 min-w-0">{gf.name}</span>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="shrink-0 border-white/20 bg-white/10 text-white hover:bg-white/15 font-medium"
                          onClick={() => handleAddFromGoogle(gf)}
                          disabled={addFileMutation.isPending}
                        >
                          {addFileMutation.isPending ? 'Agregando…' : 'Agregar'}
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </ScrollArea>
            </>
          )}
          <DialogFooter className="gap-2 sm:gap-2 mt-4">
            <Button variant="outline" onClick={() => setAddFromGoogleOpen(false)} className="flex-1 border border-white/10 bg-transparent text-[13px] font-medium text-white/60 hover:bg-white/10">
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Agregar enlace (Evo) — modal estilo creación del prompt */}
      <Dialog open={addFromEvoOpen} onOpenChange={setAddFromEvoOpen}>
        <DialogContent className="bg-[#0f172a] border border-white/10 max-w-[380px] rounded-2xl p-6 shadow-xl data-[state=open]:animate-in data-[state=open]:zoom-in-95 data-[state=open]:slide-in-from-bottom-2 overflow-hidden [&+[data-radix-dialog-overlay]]:bg-black/45">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-3">
              <div className="w-10 h-10 rounded-[11px] bg-[#00c8ff]/20 flex items-center justify-center shrink-0">
                <Link2 className="w-5 h-5 text-[#00c8ff]" />
              </div>
              <div>
                <span className="text-base font-semibold text-white block">Agregar enlace (Evo)</span>
                <span className="text-xs text-white/60 mt-0.5 block">{group ? `Enlace · ${group.name}` : 'Recurso del curso'}</span>
              </div>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs font-medium text-white/60">Nombre del archivo</Label>
              <Input
                value={evoLinkName}
                onChange={(e) => setEvoLinkName(e.target.value)}
                placeholder="Ej: Guía de estudio"
                className="bg-white/[0.06] border border-white/[0.08] rounded-xl py-2.5 px-3 text-sm text-white placeholder:text-white/50 focus:border-white/20"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-medium text-white/60">URL (opcional)</Label>
              <Input
                value={evoLinkUrl}
                onChange={(e) => setEvoLinkUrl(e.target.value)}
                placeholder="https://..."
                className="bg-white/[0.06] border border-white/[0.08] rounded-xl py-2.5 px-3 text-sm text-white placeholder:text-white/50 focus:border-white/20"
              />
            </div>
            {group && (
              <div className="space-y-2">
                <Label className="text-xs font-medium text-white/60">Curso</Label>
                <div className="flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.06] py-2.5 px-3">
                  <FileText className="w-4 h-4 text-white/50 shrink-0" />
                  <span className="text-[13px] text-white/80">{group.name}</span>
                </div>
                <p className="text-[11px] text-white/50 flex items-center gap-1.5">
                  <span className="w-4 h-4 rounded-full bg-[#22c55e]/20 flex items-center justify-center shrink-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#22c55e]" />
                  </span>
                  Se guardará en la carpeta Evo / {group.name} de tu Drive
                </p>
              </div>
            )}
          </div>
          <DialogFooter className="gap-2 sm:gap-2 mt-6 grid grid-cols-[1fr_2fr]">
            <Button variant="outline" onClick={() => setAddFromEvoOpen(false)} className="border border-white/10 bg-transparent text-[13px] font-medium text-white/60 hover:bg-white/10">
              Cancelar
            </Button>
            <Button
              onClick={handleAddFromEvo}
              disabled={!evoLinkName.trim() || addFileMutation.isPending}
              className="bg-white/10 border border-white/20 text-white hover:bg-white/15 text-[13px] font-medium"
            >
              Crear
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Crear documento nuevo (Google Doc / Presentación / Hoja de cálculo) */}
      <Dialog open={createNewOpen} onOpenChange={setCreateNewOpen}>
        <DialogContent className="bg-[#0f172a] border border-white/10 max-w-[380px] rounded-2xl p-6 shadow-xl data-[state=open]:animate-in data-[state=open]:zoom-in-95 data-[state=open]:slide-in-from-bottom-2 overflow-hidden">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-[11px] flex items-center justify-center shrink-0 ${
                  createNewType === 'doc' ? 'bg-[#1a56d6]' : createNewType === 'slide' ? 'bg-[#d97706]' : 'bg-[#16a34a]'
                }`}
              >
                {createNewType === 'doc' && <FileText className="w-5 h-5 text-white" />}
                {createNewType === 'slide' && <Presentation className="w-5 h-5 text-white" />}
                {createNewType === 'sheet' && <FileSpreadsheet className="w-5 h-5 text-white" />}
              </div>
              <div>
                <span className="text-base font-semibold text-white block">
                  {createNewType === 'doc' && 'Nuevo documento'}
                  {createNewType === 'slide' && 'Nueva presentación'}
                  {createNewType === 'sheet' && 'Nueva hoja de cálculo'}
                </span>
                <span className="text-xs text-white/60 mt-0.5 block">
                  {createNewType === 'doc' && 'Google Docs'}
                  {createNewType === 'slide' && 'Google Slides'}
                  {createNewType === 'sheet' && 'Google Sheets'}
                  {group && ` · ${group.name}`}
                </span>
              </div>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label className="text-xs font-medium text-white/60">Nombre del archivo</Label>
              <Input
                value={createNewNombre}
                onChange={(e) => setCreateNewNombre(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreateNewDoc()}
                placeholder="Ej: Guía del curso"
                className="bg-white/5 border border-white/10 rounded-md py-2.5 px-3 text-sm text-white placeholder:text-white/50 focus:border-white/20 focus:bg-white/5"
                autoFocus
              />
            </div>
            {group && (
              <>
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-white/60">Curso</Label>
                  <div className="flex items-center gap-2 rounded-md border border-white/10 bg-white/5 py-2.5 px-3">
                    <FileText className="w-4 h-4 text-white/50 shrink-0" />
                    <span className="text-[13px] text-white/80">{group.name}</span>
                  </div>
                </div>
                <p className="text-[11px] text-white/50 flex items-center gap-1.5">
                  <span className="w-4 h-4 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  </span>
                  Se guardará automáticamente en la carpeta Evo / {group.name} de tu Drive
                </p>
              </>
            )}
          </div>
          <DialogFooter className="gap-2 sm:gap-2 mt-6 grid grid-cols-[1fr_2fr]">
            <Button
              variant="outline"
              onClick={() => { setCreateNewOpen(false); setCreateNewNombre(''); }}
              className="border border-white/10 bg-transparent text-[13px] font-medium text-white/60 hover:bg-white/10"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleCreateNewDoc}
              disabled={!createNewNombre.trim() || !selectedFolder || createNewDocMutation.isPending}
              className="bg-[#1a73e8] hover:bg-[#1558b0] text-white text-[13px] font-medium"
            >
              {createNewDocMutation.isPending ? 'Creando…' : 'Crear'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modales Mi carpeta (estudiante) */}
      <Dialog open={myFolderAddGoogleOpen} onOpenChange={setMyFolderAddGoogleOpen}>
        <DialogContent className="bg-[#0f172a] border border-white/10 max-w-[380px] rounded-2xl p-6 shadow-xl overflow-hidden">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-3">
              <div className="w-10 h-10 rounded-[11px] bg-amber-500/20 flex items-center justify-center shrink-0">
                <Cloud className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <span className="text-base font-semibold text-white block">Agregar desde Google Drive</span>
                <span className="text-xs text-white/60 mt-0.5 block">Se añadirá a Mi carpeta</span>
              </div>
            </DialogTitle>
          </DialogHeader>
          {myFolderGoogleDriveDisconnected ? (
            <div className="space-y-4 py-2">
              <p className="text-white/60 text-sm">
                {myFolderGoogleFilesError ? 'Google Drive se desconectó. Reconéctalo para usar tus archivos.' : 'Conecta Google Drive para usar tus archivos.'}
              </p>
              <Button type="button" onClick={connectGoogle} className="w-full rounded-xl border border-[#22c55e]/40 bg-[#22c55e]/10 text-[#22c55e] hover:bg-[#22c55e]/20 font-medium">
                <Cloud className="w-4 h-4 mr-2" />
                Reconectar Google Drive
              </Button>
              <p className="text-white/40 text-xs">Serás redirigido a Google y volverás aquí sin cerrar sesión.</p>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <Label className="text-xs font-medium text-white/60">Buscar en Drive</Label>
                <Input
                  value={myFolderGoogleSearch}
                  onChange={(e) => setMyFolderGoogleSearch(e.target.value)}
                  placeholder="Nombre del archivo..."
                  className="bg-white/5 border border-white/10 rounded-md py-2.5 px-3 text-sm text-white placeholder:text-white/50"
                />
              </div>
              <ScrollArea className="h-[280px] rounded-md border border-white/10">
                {myFolderGoogleFilesLoading ? (
                  <p className="text-white/50 text-sm p-4">Cargando…</p>
                ) : myFolderGoogleFiles.length === 0 ? (
                  <p className="text-white/50 text-sm p-4">Escribe para buscar o no hay archivos.</p>
                ) : (
                  <ul className="p-2 space-y-1">
                    {myFolderGoogleFiles.map((gf) => (
                      <li
                        key={gf.id}
                        className="flex items-center justify-between gap-3 p-3 rounded-lg hover:bg-white/10 text-white"
                      >
                        <span className="truncate text-sm flex-1 min-w-0">{gf.name}</span>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="shrink-0 border-amber-500/50 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 font-medium"
                          onClick={() => handleMyFolderAddFromGoogle(gf)}
                          disabled={addToMyFolderMutation.isPending}
                        >
                          Agregar
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </ScrollArea>
              <DialogFooter className="gap-2 mt-4">
                <Button variant="outline" onClick={() => setMyFolderAddGoogleOpen(false)} className="flex-1 border border-white/10 bg-transparent text-[13px] font-medium text-white/60 hover:bg-white/10">
                  Cerrar
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={myFolderAddEvoOpen} onOpenChange={setMyFolderAddEvoOpen}>
        <DialogContent className="bg-[#0f172a] border border-white/10 max-w-[380px] rounded-2xl p-6 shadow-xl overflow-hidden">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-3">
              <div className="w-10 h-10 rounded-[11px] bg-amber-500/20 flex items-center justify-center shrink-0">
                <Link2 className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <span className="text-base font-semibold text-white block">Añadir enlace</span>
                <span className="text-xs text-white/60 mt-0.5 block">Se añadirá a Mi carpeta</span>
              </div>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs font-medium text-white/60">Nombre (opcional)</Label>
              <Input
                value={myFolderEvoLinkName}
                onChange={(e) => setMyFolderEvoLinkName(e.target.value)}
                placeholder="Ej: Mi recurso"
                className="bg-white/5 border border-white/10 rounded-md py-2.5 px-3 text-sm text-white placeholder:text-white/50"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-medium text-white/60">URL</Label>
              <Input
                value={myFolderEvoLinkUrl}
                onChange={(e) => setMyFolderEvoLinkUrl(e.target.value)}
                placeholder="https://..."
                className="bg-white/5 border border-white/10 rounded-md py-2.5 px-3 text-sm text-white placeholder:text-white/50"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 mt-6 grid grid-cols-[1fr_2fr]">
            <Button variant="outline" onClick={() => setMyFolderAddEvoOpen(false)} className="border border-white/10 bg-transparent text-[13px] font-medium text-white/60 hover:bg-white/10">
              Cancelar
            </Button>
            <Button
              onClick={handleMyFolderAddFromEvo}
              disabled={!myFolderEvoLinkUrl.trim() && !myFolderEvoLinkName.trim()}
              className="bg-amber-500 hover:bg-amber-600 text-white text-[13px] font-medium"
            >
              Añadir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={myFolderCreateNewOpen} onOpenChange={setMyFolderCreateNewOpen}>
        <DialogContent className="bg-[#0f172a] border border-white/10 max-w-[380px] rounded-2xl p-6 shadow-xl overflow-hidden">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-[11px] flex items-center justify-center shrink-0 ${
                  myFolderCreateNewType === 'doc' ? 'bg-[#1a56d6]' : myFolderCreateNewType === 'slide' ? 'bg-[#d97706]' : 'bg-[#16a34a]'
                }`}
              >
                {myFolderCreateNewType === 'doc' && <FileText className="w-5 h-5 text-white" />}
                {myFolderCreateNewType === 'slide' && <Presentation className="w-5 h-5 text-white" />}
                {myFolderCreateNewType === 'sheet' && <FileSpreadsheet className="w-5 h-5 text-white" />}
              </div>
              <div>
                <span className="text-base font-semibold text-white block">
                  {myFolderCreateNewType === 'doc' && 'Nuevo documento'}
                  {myFolderCreateNewType === 'slide' && 'Nueva presentación'}
                  {myFolderCreateNewType === 'sheet' && 'Nueva hoja de cálculo'}
                </span>
                <span className="text-xs text-white/60 mt-0.5 block">Se creará en tu Google Drive y se añadirá a Mi carpeta</span>
              </div>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label className="text-xs font-medium text-white/60">Nombre del archivo</Label>
              <Input
                value={myFolderCreateNewNombre}
                onChange={(e) => setMyFolderCreateNewNombre(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleMyFolderCreateNew()}
                placeholder="Ej: Mi documento"
                className="bg-white/5 border border-white/10 rounded-md py-2.5 px-3 text-sm text-white placeholder:text-white/50"
                autoFocus
              />
            </div>
          </div>
          <DialogFooter className="gap-2 mt-6 grid grid-cols-[1fr_2fr]">
            <Button
              variant="outline"
              onClick={() => { setMyFolderCreateNewOpen(false); setMyFolderCreateNewNombre(''); }}
              className="border border-white/10 bg-transparent text-[13px] font-medium text-white/60 hover:bg-white/10"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleMyFolderCreateNew}
              disabled={!myFolderCreateNewNombre.trim() || createPersonalDocForMyMutation.isPending}
              className="bg-amber-500 hover:bg-amber-600 text-white text-[13px] font-medium"
            >
              {createPersonalDocForMyMutation.isPending ? 'Creando…' : 'Crear'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

const FILE_TYPE_STYLES: Record<string, { icon: React.ReactNode; color: string; hex: string }> = {
  doc: { icon: <FileText className="w-5 h-5 text-[#4a90ff]" />, color: '#4a90ff', hex: '#4a90ff' },
  slide: { icon: <Presentation className="w-5 h-5 text-[#f59e0b]" />, color: '#f59e0b', hex: '#f59e0b' },
  sheet: { icon: <FileSpreadsheet className="w-5 h-5 text-[#22c55e]" />, color: '#22c55e', hex: '#22c55e' },
  pdf: { icon: <FileText className="w-5 h-5 text-[#ef4444]" />, color: '#ef4444', hex: '#ef4444' },
  link: { icon: <Link2 className="w-5 h-5 text-[#00c8ff]" />, color: '#00c8ff', hex: '#00c8ff' },
};
const defaultStyle = { icon: <FileText className="w-5 h-5 text-[#f59e0b]" />, color: '#f59e0b', hex: '#f59e0b' };

function FileRow({
  file,
  isNew,
  variant,
  isStarred = false,
  isInTrash = false,
  onToggleStar,
  onToggleTrash,
  onOpenTrash,
}: {
  file: EvoFile;
  isNew?: boolean;
  variant?: 'grid' | 'list';
  isStarred?: boolean;
  isInTrash?: boolean;
  onToggleStar?: (id: string) => void;
  onToggleTrash?: (id: string) => void;
  /** Tras enviar a la papelera, activa la sección Papelera (sidebar). */
  onOpenTrash?: () => void;
}) {
  const link = file.googleWebViewLink || file.evoStorageUrl || '#';
  const isGoogle = file.origen === 'google';
  const style = FILE_TYPE_STYLES[file.tipo] || defaultStyle;
  const hex = style.hex || style.color;

  if (variant === 'grid') {
    return (
      <div className="flex flex-col items-center gap-1.5">
        <div
          className="relative w-16 h-16 rounded-2xl bg-[#1E3A8A]/40 border border-white/10 transition-colors group/icon hover:bg-[#1E3A8A]/60"
          style={{ borderColor: `${hex}47` }}
        >
          <div className="absolute inset-0 flex items-center justify-center" style={{ color: hex }}>
            {style.icon && React.cloneElement(style.icon as React.ReactElement<{ className?: string }>, { className: 'w-8 h-8' })}
          </div>
          <div className="absolute inset-0 flex items-center justify-center gap-0.5 opacity-0 group-hover/icon:opacity-100 transition-opacity bg-[#0F172A]/95 rounded-2xl">
            {link !== '#' && (
              <a href={link} target="_blank" rel="noopener noreferrer" className="w-7 h-7 rounded-xl flex items-center justify-center text-white/80 hover:bg-white/10" aria-label="Abrir en Drive">
                <ExternalLink className="w-4 h-4" />
              </a>
            )}
            <button type="button" className="w-7 h-7 rounded-xl flex items-center justify-center text-white/80 hover:bg-white/10" aria-label="Renombrar">
              <Pencil className="w-4 h-4" />
            </button>
            {onToggleTrash ? (
              <button
                type="button"
                className="w-7 h-7 rounded-xl flex items-center justify-center text-white/80 hover:bg-white/10"
                aria-label={isInTrash ? 'Restaurar desde la papelera' : 'Mover a la papelera'}
                onClick={(e) => {
                  e.stopPropagation();
                  if (!isInTrash) {
                    onToggleTrash(file.id);
                    onOpenTrash?.();
                  } else {
                    onToggleTrash(file.id);
                  }
                }}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            ) : (
              <button type="button" className="w-7 h-7 rounded-xl flex items-center justify-center text-white/80 hover:bg-white/10" aria-label="Eliminar">
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
        <p className="text-[12px] text-white/70 font-medium text-center leading-tight truncate max-w-[90px]">{file.nombre}</p>
        <p className="text-[10.5px] text-white/30 text-center">{file.cursoNombre}</p>
      </div>
    );
  }

  if (variant === 'list') {
    return (
      <tr className="border-b border-white/10 hover:bg-[#1E3A8A]/30 transition-colors">
        <td className="py-2.5 px-4">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${hex}26` }}>{style.icon}</div>
            <span className="text-white font-medium truncate">{file.nombre}</span>
          </div>
        </td>
        <td className="py-2.5 px-4 text-[#E2E8F0]/70">{file.cursoNombre}</td>
        <td className="py-2.5 px-4 text-[#E2E8F0]/70">{file.tipo}</td>
        <td className="py-2.5 px-4 text-[#E2E8F0]/70">—</td>
        <td className="py-2.5 px-4 text-[#E2E8F0]/70">—</td>
      </tr>
    );
  }

  return (
    <li
      className={`group flex items-center justify-between gap-4 py-[13px] px-4 rounded-xl border transition-colors ${
        isNew ? 'border-white/20 bg-white/[0.06] animate-in fade-in slide-in-from-top-2 duration-300' : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.06] hover:border-white/20'
      }`}
    >
      <div className="flex items-center gap-4 min-w-0 flex-1">
        <div className="w-[38px] h-[38px] rounded-[10px] flex items-center justify-center shrink-0" style={{ backgroundColor: `${hex}26` }}>
          {style.icon}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-white truncate">{file.nombre}</p>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className="text-[11px] text-[#E2E8F0]/70">{file.cursoNombre}</span>
            <span className="w-0.5 h-0.5 rounded-full bg-white/40 shrink-0" />
            {isGoogle && (
              <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-medium bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                Google
              </span>
            )}
            {isNew && (
              <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-medium bg-[#3B82F6]/30 text-[#93C5FD]">
                Recién creado
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        {link !== '#' && (
          <a
            href={link}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[11px] font-medium text-[#3B82F6] hover:text-[#60A5FA] hover:underline"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Abrir en Drive
          </a>
        )}
        {onToggleStar && (
          <button
            type="button"
            className={`w-[30px] h-[30px] rounded-lg flex items-center justify-center transition-colors ${
              isStarred ? 'text-amber-400 bg-amber-500/10' : 'text-[#E2E8F0]/70 hover:bg-[#1E3A8A]/50 hover:text-white'
            }`}
            aria-label="Destacar archivo"
            onClick={() => onToggleStar(file.id)}
          >
            <Star className="w-4 h-4" />
          </button>
        )}
        {onToggleTrash && (
          <button
            type="button"
            className={`w-[30px] h-[30px] rounded-lg flex items-center justify-center transition-colors ${
              isInTrash ? 'text-rose-400 bg-rose-500/10' : 'text-[#E2E8F0]/70 hover:bg-[#1E3A8A]/50 hover:text-white'
            }`}
            aria-label={isInTrash ? 'Restaurar desde la papelera' : 'Mover a la papelera'}
            onClick={() => {
              if (!isInTrash) {
                onToggleTrash(file.id);
                onOpenTrash?.();
              } else {
                onToggleTrash(file.id);
              }
            }}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
        <button
          type="button"
          className="w-[30px] h-[30px] rounded-lg flex items-center justify-center text-[#E2E8F0]/70 hover:bg-[#1E3A8A]/50 hover:text-white transition-colors"
          aria-label="Más opciones"
        >
          <MoreVertical className="w-4 h-4" />
        </button>
      </div>
    </li>
  );
}
