import React, { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/lib/authContext';
import { NavBackButton } from '@/components/nav-back-button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

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
      <Card className="bg-white/5 border-white/10 overflow-hidden">
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="w-full flex items-center gap-3 p-4 text-left hover:bg-white/5 transition-colors"
          >
            {open ? (
              <ChevronDown className="w-5 h-5 text-[#00c8ff] shrink-0" />
            ) : (
              <ChevronRight className="w-5 h-5 text-[#00c8ff] shrink-0" />
            )}
            <FolderOpen className="w-6 h-6 text-[#00c8ff] shrink-0" />
            <span className="font-semibold text-white">{folder.name}</span>
            <span className="text-white/50 text-sm ml-auto">
              {files.length} {files.length === 1 ? 'archivo' : 'archivos'}
            </span>
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0 pb-4">
            {isLoading ? (
              <div className="space-y-2 pl-12">
                <Skeleton className="h-12 w-full bg-white/10" />
                <Skeleton className="h-12 w-full bg-white/10" />
              </div>
            ) : sorted.length === 0 ? (
              <p className="text-white/50 text-sm pl-12 py-2">No hay archivos en esta materia aún.</p>
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

export default function EvoDrivePage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [cursoId, setCursoId] = useState<string>('');
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
  const isTeacher = user?.rol && ROLES_WRITE.includes(user.rol);

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

  const { data: groups = [] } = useQuery<EvoGroup[]>({
    queryKey: ['evo-drive', 'groups'],
    queryFn: () => apiRequest('GET', '/api/evo-drive/groups'),
    enabled: isTeacher,
  });

  // Materias del curso seleccionado (profesor): para asociar cada archivo a una materia
  const { data: courseSubjects = [] } = useQuery<Array<{ _id: string; id: string; nombre: string }>>({
    queryKey: ['courses', 'for-group', cursoId],
    queryFn: () => apiRequest('GET', `/api/courses/for-group/${encodeURIComponent(cursoId)}`),
    enabled: isTeacher && !!cursoId,
  });
  const [selectedGroupSubjectId, setSelectedGroupSubjectId] = useState<string>('');
  useEffect(() => {
    if (courseSubjects.length === 1) setSelectedGroupSubjectId(courseSubjects[0]._id || courseSubjects[0].id);
    else if (courseSubjects.length > 0 && !courseSubjects.some((s) => (s._id || s.id) === selectedGroupSubjectId)) setSelectedGroupSubjectId('');
    else if (courseSubjects.length === 0) setSelectedGroupSubjectId('');
  }, [cursoId, courseSubjects, selectedGroupSubjectId]);

  // Misma API que "Mis Materias Asignadas" para que el estudiante vea sus carpetas por materia (Física, Matemáticas, etc.)
  const { data: meCourses = [] } = useQuery<Array<{ _id: string; nombre: string; groupId?: string; groupName?: string; subjectName?: string }>>({
    queryKey: ['users', 'me', 'courses'],
    queryFn: () => apiRequest('GET', '/api/users/me/courses'),
    enabled: !isTeacher,
  });
  const subjectFolders: SubjectFolder[] = meCourses
    .filter((c): c is typeof c & { groupId: string; groupName: string } => !!c.groupId && !!c.groupName)
    .map((c) => ({
      id: c._id,
      name: c.subjectName || c.nombre,
      groupId: c.groupId,
      groupName: c.groupName,
    }));

  const { data: myFolderFiles = [], refetch: refetchMyFolder } = useQuery<MyFolderFile[]>({
    queryKey: ['evo-drive', 'my-folder'],
    queryFn: () => apiRequest('GET', '/api/evo-drive/my-folder'),
    enabled: !isTeacher,
  });

  const { data: files = [], isLoading: filesLoading } = useQuery<EvoFile[]>({
    queryKey: ['evo-drive', 'files', cursoId],
    queryFn: () => apiRequest('GET', `/api/evo-drive/files?cursoId=${encodeURIComponent(cursoId)}`),
    enabled: !!cursoId,
  });

  const { data: googleFilesRes, isLoading: googleFilesLoading } = useQuery<{ files: GoogleDriveFile[] }>({
    queryKey: ['evo-drive', 'google-files', googleSearch],
    queryFn: () =>
      apiRequest('GET', `/api/evo-drive/google/files?q=${encodeURIComponent(googleSearch)}`),
    enabled: addFromGoogleOpen && !!googleStatus.connected,
  });
  const googleFiles = googleFilesRes?.files ?? [];

  const { data: myFolderGoogleFilesRes, isLoading: myFolderGoogleFilesLoading } = useQuery<{
    files: GoogleDriveFile[];
  }>({
    queryKey: ['evo-drive', 'google-files-my', myFolderGoogleSearch],
    queryFn: () =>
      apiRequest('GET', `/api/evo-drive/google/files?q=${encodeURIComponent(myFolderGoogleSearch)}`),
    enabled: myFolderAddGoogleOpen && !!googleStatus.connected,
  });
  const myFolderGoogleFiles = myFolderGoogleFilesRes?.files ?? [];

  useEffect(() => {
    if (isTeacher && groups.length > 0 && !cursoId) setCursoId(groups[0].id);
  }, [isTeacher, groups, cursoId]);

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
      queryClient.invalidateQueries({ queryKey: ['evo-drive', 'files', cursoId] });
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
      queryClient.invalidateQueries({ queryKey: ['evo-drive', 'files', cursoId] });
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
    if (!group || !cursoId || !createNewNombre.trim()) return;
    if (courseSubjects.length > 0 && !selectedGroupSubjectId) {
      toast({
        title: 'Elige una materia',
        description: 'Selecciona la materia para que el documento aparezca en la carpeta correcta.',
        variant: 'destructive',
      });
      return;
    }
    createNewDocMutation.mutate({
      nombre: createNewNombre.trim(),
      tipo: createNewType,
      cursoId,
      cursoNombre: group.name,
      ...(selectedGroupSubjectId ? { groupSubjectId: selectedGroupSubjectId } : {}),
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

  const allFilesSorted = [...files].sort((a, b) =>
    (a.nombre || '').localeCompare(b.nombre || '', undefined, { sensitivity: 'base' })
  );
  const allFiles = fileSearch.trim()
    ? allFilesSorted.filter((f) =>
        (f.nombre || '').toLowerCase().includes(fileSearch.trim().toLowerCase())
      )
    : allFilesSorted;
  const group = groups.find((g) => g.id === cursoId);

  // Enlace para abrir en Drive cuando la API no devuelve webViewLink
  const driveViewLink = (id: string, mimeType?: string) => {
    const m = (mimeType || '').toLowerCase();
    if (m.includes('document')) return `https://docs.google.com/document/d/${id}/edit`;
    if (m.includes('spreadsheet')) return `https://docs.google.com/spreadsheets/d/${id}/edit`;
    if (m.includes('presentation')) return `https://docs.google.com/presentation/d/${id}/edit`;
    return `https://drive.google.com/file/d/${id}/view`;
  };

  const handleAddFromGoogle = (gfile: GoogleDriveFile) => {
    if (!cursoId || !group) {
      toast({
        title: 'Selecciona un curso',
        description: 'Elige un curso en el selector de la barra superior antes de agregar archivos.',
        variant: 'destructive',
      });
      return;
    }
    if (courseSubjects.length > 0 && !selectedGroupSubjectId) {
      toast({
        title: 'Elige una materia',
        description: 'Selecciona la materia (ej. Física, Matemáticas) para que el archivo aparezca en la carpeta correcta.',
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
      cursoId,
      cursoNombre: group.name,
      ...(selectedGroupSubjectId ? { groupSubjectId: selectedGroupSubjectId } : {}),
      googleFileId: gfile.id,
      googleWebViewLink: webViewLink,
      googleMimeType: gfile.mimeType,
      mimeType: gfile.mimeType,
      sizeBytes: gfile.size ? parseInt(gfile.size, 10) : undefined,
    });
  };

  const handleAddFromEvo = () => {
    if (!cursoId || !group || !evoLinkName.trim()) return;
    if (courseSubjects.length > 0 && !selectedGroupSubjectId) {
      toast({
        title: 'Elige una materia',
        description: 'Selecciona la materia para que el archivo aparezca en la carpeta correcta.',
        variant: 'destructive',
      });
      return;
    }
    addFileMutation.mutate({
      nombre: evoLinkName.trim(),
      tipo: 'link',
      origen: 'material',
      cursoId,
      cursoNombre: group.name,
      ...(selectedGroupSubjectId ? { groupSubjectId: selectedGroupSubjectId } : {}),
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
    <div className="flex-1 overflow-auto p-6">
      <div className="max-w-5xl mx-auto">
        <NavBackButton
          to={user?.rol === 'profesor' ? '/profesor/academia' : '/dashboard'}
          label={user?.rol === 'profesor' ? 'Academia' : 'Dashboard'}
        />

        {/* Módulo Evo Drive — contenedor con fondo terciario, 24px padding, esquinas redondeadas */}
        <div className="rounded-2xl bg-white/5 border border-white/10 p-6 mt-4">
          {/* Barra superior */}
          <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-[#1a73e8] flex items-center justify-center shrink-0">
                <FileText className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-[18px] font-semibold text-white tracking-tight" style={{ letterSpacing: '-0.01em' }}>
                  Evo Drive
                </h1>
                <p className="text-xs text-white/60 mt-0.5">
                  {isTeacher ? 'Archivos del curso en un solo lugar' : 'Tus materias y archivos por curso'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2.5">
              {isTeacher && (
                <>
                  <Select value={cursoId} onValueChange={setCursoId}>
                    <SelectTrigger className="w-[200px] h-9 bg-white/5 border border-white/10 rounded-md py-[7px] px-3 text-[13px] font-medium text-white gap-2">
                      <FileText className="w-4 h-4 text-white/60 shrink-0" />
                      <SelectValue placeholder="Selecciona un curso" />
                      <ChevronDown className="w-4 h-4 text-white/60" />
                    </SelectTrigger>
                    <SelectContent>
                      {groups.map((g) => (
                        <SelectItem key={g.id} value={g.id}>
                          {g.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {courseSubjects.length > 0 && (
                    <Select value={selectedGroupSubjectId} onValueChange={setSelectedGroupSubjectId}>
                      <SelectTrigger className="w-[180px] h-9 bg-white/5 border border-white/10 rounded-md py-[7px] px-3 text-[13px] font-medium text-white gap-2">
                        <FolderOpen className="w-4 h-4 text-white/60 shrink-0" />
                        <SelectValue placeholder="Materia" />
                        <ChevronDown className="w-4 h-4 text-white/60" />
                      </SelectTrigger>
                      <SelectContent>
                        {courseSubjects.map((s) => (
                          <SelectItem key={s._id || s.id} value={s._id || s.id}>
                            {s.nombre}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  {!googleStatus.connected && (
                    <Button
                      onClick={connectGoogle}
                      variant="outline"
                      size="sm"
                      className="h-9 rounded-md border-emerald-500/40 bg-emerald-500/10 text-emerald-400 text-xs font-medium hover:bg-emerald-500/20"
                    >
                      Conectar Google Drive
                    </Button>
                  )}
                  {googleStatus.connected && (
                    <span className="inline-flex items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1.5 text-xs font-medium text-emerald-400">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        Google Drive conectado
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={connectGoogle}
                        className="h-8 rounded-md border-[#4DBBFF]/40 bg-transparent px-2.5 text-[11px] font-medium text-[#4DBBFF]/90 hover:bg-[#4DBBFF]/10 hover:text-[#4DBBFF]"
                      >
                        Reconectar Drive
                      </Button>
                    </span>
                  )}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        size="sm"
                        className="h-9 rounded-full bg-[#4DBBFF]/[0.13] border-[1.5px] border-[#4DBBFF]/50 text-[#4DBBFF] text-[13px] font-medium hover:bg-[#4DBBFF]/20 px-4"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Añadir o crear
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" sideOffset={8} className="w-[230px] rounded-[14px] border-[#4DBBFF]/20 bg-[#0f1c35] shadow-xl shadow-black/40 p-0 overflow-hidden">
                      <div className="py-2.5">
                        <DropdownMenuItem
                          onSelect={() => {
                            if (googleStatus.connected) setTimeout(() => setAddFromGoogleOpen(true), 50);
                          }}
                          disabled={!googleStatus.connected}
                          className="flex items-center gap-3 py-2.5 px-4 text-[13px] text-white/90 hover:bg-[#4DBBFF]/10 focus:bg-[#4DBBFF]/10 mx-0 rounded-none"
                        >
                          <div className="w-8 h-8 rounded-[9px] bg-[#4DBBFF]/20 flex items-center justify-center shrink-0">
                            <Cloud className="w-4 h-4 text-[#4DBBFF]" />
                          </div>
                          Google Drive
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onSelect={() => setTimeout(() => setAddFromEvoOpen(true), 50)}
                          className="flex items-center gap-3 py-2.5 px-4 text-[13px] text-white/90 hover:bg-[#4DBBFF]/10 focus:bg-[#4DBBFF]/10 mx-0 rounded-none"
                        >
                          <div className="w-8 h-8 rounded-[9px] bg-[#4DBBFF]/20 flex items-center justify-center shrink-0">
                            <Link2 className="w-4 h-4 text-[#4DBBFF]" />
                          </div>
                          Enlace
                        </DropdownMenuItem>
                        <DropdownMenuItem className="flex items-center gap-3 py-2.5 px-4 text-[13px] text-white/90 hover:bg-[#4DBBFF]/10 focus:bg-[#4DBBFF]/10 mx-0 rounded-none">
                          <div className="w-8 h-8 rounded-[9px] bg-[#4DBBFF]/20 flex items-center justify-center shrink-0">
                            <FileText className="w-4 h-4 text-[#4DBBFF]" />
                          </div>
                          Archivo
                        </DropdownMenuItem>
                      </div>
                      <div className="border-t border-[#4DBBFF]/10" />
                      <div className="py-2">
                        <p className="px-4 pt-1.5 pb-1 text-[11px] uppercase tracking-wider text-[#4DBBFF]/50">Crear</p>
                        <DropdownMenuItem
                          onSelect={() => setTimeout(() => { setCreateNewType('doc'); setCreateNewNombre(''); setCreateNewOpen(true); }, 50)}
                          className="flex items-center gap-3 py-2.5 px-4 text-[13px] text-white/90 hover:bg-[#4DBBFF]/10 focus:bg-[#4DBBFF]/10 mx-0 rounded-none"
                        >
                          <div className="w-8 h-8 rounded-[9px] bg-[#1a56d6] flex items-center justify-center shrink-0">
                            <FileText className="w-4 h-4 text-white" />
                          </div>
                          Documentos
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onSelect={() => setTimeout(() => { setCreateNewType('slide'); setCreateNewNombre(''); setCreateNewOpen(true); }, 50)}
                          className="flex items-center gap-3 py-2.5 px-4 text-[13px] text-white/90 hover:bg-[#4DBBFF]/10 focus:bg-[#4DBBFF]/10 mx-0 rounded-none"
                        >
                          <div className="w-8 h-8 rounded-[9px] bg-[#d97706] flex items-center justify-center shrink-0">
                            <Presentation className="w-4 h-4 text-white" />
                          </div>
                          Presentaciones
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onSelect={() => setTimeout(() => { setCreateNewType('sheet'); setCreateNewNombre(''); setCreateNewOpen(true); }, 50)}
                          className="flex items-center gap-3 py-2.5 px-4 text-[13px] text-white/90 hover:bg-[#4DBBFF]/10 focus:bg-[#4DBBFF]/10 mx-0 rounded-none"
                        >
                          <div className="w-8 h-8 rounded-[9px] bg-[#16a34a] flex items-center justify-center shrink-0">
                            <FileSpreadsheet className="w-4 h-4 text-white" />
                          </div>
                          Hojas de cálculo
                        </DropdownMenuItem>
                      </div>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </>
              )}
            </div>
          </div>

          {/* Barra de búsqueda (solo profesor con curso seleccionado) */}
          {isTeacher && cursoId && (
            <div className="mb-5">
              <div className="flex items-center gap-2 w-full rounded-md border border-white/10 bg-white/5 py-2 px-3 focus-within:border-[#3B82F6] focus-within:bg-white/5 transition-colors">
                <Search className="w-4 h-4 text-white/50 shrink-0" />
                <input
                  type="text"
                  value={fileSearch}
                  onChange={(e) => setFileSearch(e.target.value)}
                  placeholder="Buscar archivos del curso..."
                  className="flex-1 min-w-0 bg-transparent text-[13px] text-white placeholder:text-white/50 outline-none"
                />
              </div>
            </div>
          )}

          {isTeacher ? (
            <>
              {/* Encabezado de sección */}
              <div className="flex items-center justify-between gap-4 mb-4">
                <h2 className="text-sm font-medium uppercase tracking-wider text-white/60 flex items-center gap-2">
                  <FolderOpen className="w-4 h-4 text-white/50" />
                  Archivos del curso
                </h2>
                <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-white/50">
                  {allFiles.length} {allFiles.length === 1 ? 'archivo' : 'archivos'}
                </span>
              </div>

              {filesLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-[72px] w-full rounded-xl bg-white/10" />
                  <Skeleton className="h-[72px] w-full rounded-xl bg-white/10" />
                </div>
              ) : (
                <>
                  <ul className="space-y-3">
                    {allFiles.map((f) => (
                      <FileRow key={f.id} file={f} />
                    ))}
                  </ul>
                  {/* Zona de arrastre */}
                  {isTeacher && (
                    <div className="mt-6 rounded-xl border-2 border-dashed border-white/20 py-7 px-6 flex flex-col items-center justify-center gap-2 hover:border-[#4DBBFF]/50 hover:text-white/70 transition-colors cursor-pointer">
                      <Upload className="w-[22px] h-[22px] text-white/50" />
                      <p className="text-[13px] text-white/50">Arrastra archivos aquí o haz clic para subir</p>
                    </div>
                  )}
                </>
              )}

              {/* Pie del módulo */}
              <div className="mt-5 pt-4 border-t border-white/10 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <div className="w-20 h-1 rounded-full bg-white/10 overflow-hidden">
                    <div className="h-full w-[35%] rounded-full bg-[#3B82F6]" />
                  </div>
                  <span className="text-xs text-white/60">3.5 MB de 10 MB usados</span>
                </div>
                <div className="flex rounded-md border border-white/10 bg-white/5 p-0.5">
                  <button
                    type="button"
                    onClick={() => setViewMode('grid')}
                    className={`h-7 w-7 rounded-[6px] flex items-center justify-center transition-colors ${viewMode === 'grid' ? 'bg-white/10 border border-white/10 text-white' : 'text-white/50 hover:text-white/70'}`}
                  >
                    <LayoutGrid className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('list')}
                    className={`h-7 w-7 rounded-[6px] flex items-center justify-center transition-colors ${viewMode === 'list' ? 'bg-white/10 border border-white/10 text-white' : 'text-white/50 hover:text-white/70'}`}
                  >
                    <List className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="space-y-3">
              {/* Mi carpeta: estilo distinto (dorado/ámbar) y opción Añadir o crear */}
              <Card className="overflow-hidden border-[#ffd700]/30 bg-gradient-to-br from-[#ffd700]/10 to-amber-950/20">
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
                <div className="rounded-xl border border-white/10 bg-white/5 py-8 px-6">
                  <p className="text-white/50 text-sm text-center">
                    No tienes materias asignadas aún. Cuando te inscriban en cursos, verás aquí una carpeta por cada materia con los archivos que suba tu profesor.
                  </p>
                </div>
              ) : (
                subjectFolders.map((folder) => <SubjectFolder key={folder.id} folder={folder} />)
              )}
            </div>
          )}
        </div>
      </div>

      {/* Agregar desde Google Drive — modal con overlay 45% y estilo del prompt */}
      <Dialog open={addFromGoogleOpen} onOpenChange={setAddFromGoogleOpen}>
        <DialogContent className="bg-white/5 border border-white/10 max-w-[380px] rounded-2xl p-6 shadow-xl data-[state=open]:animate-in data-[state=open]:zoom-in-95 data-[state=open]:slide-in-from-bottom-2 overflow-hidden [&+[data-radix-dialog-overlay]]:bg-black/45">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-3">
              <div className="w-10 h-10 rounded-[11px] bg-[#4DBBFF]/20 flex items-center justify-center shrink-0">
                <Cloud className="w-5 h-5 text-[#4DBBFF]" />
              </div>
              <div>
                <span className="text-base font-semibold text-white block">Agregar desde Google Drive</span>
                <span className="text-xs text-white/60 mt-0.5 block">Selecciona un archivo de tu Drive</span>
              </div>
            </DialogTitle>
          </DialogHeader>
          {!googleStatus.connected ? (
            <p className="text-white/60 text-sm py-4">
              Conecta Google Drive primero con el botón de la barra superior.
            </p>
          ) : !cursoId || !group ? (
            <p className="text-white/60 text-sm py-4">
              Selecciona un curso en el selector de la barra superior (ej. 10C) para poder agregar archivos de Google Drive a ese curso.
            </p>
          ) : (
            <>
              <div className="space-y-2">
                <Label className="text-xs font-medium text-white/60">Buscar en Drive</Label>
                <Input
                  value={googleSearch}
                  onChange={(e) => setGoogleSearch(e.target.value)}
                  placeholder="Nombre del archivo..."
                  className="bg-white/5 border border-white/10 rounded-md py-2.5 px-3 text-sm text-white placeholder:text-white/50 focus:border-[#3B82F6] focus:bg-white/5"
                />
              </div>
              <ScrollArea className="h-[280px] rounded-md border border-white/10">
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
                          className="shrink-0 border-[#4DBBFF]/50 bg-[#4DBBFF]/10 text-[#4DBBFF] hover:bg-[#4DBBFF]/20 font-medium"
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
        <DialogContent className="bg-white/5 border border-white/10 max-w-[380px] rounded-2xl p-6 shadow-xl data-[state=open]:animate-in data-[state=open]:zoom-in-95 data-[state=open]:slide-in-from-bottom-2 overflow-hidden [&+[data-radix-dialog-overlay]]:bg-black/45">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-3">
              <div className="w-10 h-10 rounded-[11px] bg-[#4DBBFF]/20 flex items-center justify-center shrink-0">
                <Link2 className="w-5 h-5 text-[#4DBBFF]" />
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
                className="bg-white/5 border border-white/10 rounded-md py-2.5 px-3 text-sm text-white placeholder:text-white/50 focus:border-[#3B82F6] focus:bg-white/5"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-medium text-white/60">URL (opcional)</Label>
              <Input
                value={evoLinkUrl}
                onChange={(e) => setEvoLinkUrl(e.target.value)}
                placeholder="https://..."
                className="bg-white/5 border border-white/10 rounded-md py-2.5 px-3 text-sm text-white placeholder:text-white/50 focus:border-[#3B82F6] focus:bg-white/5"
              />
            </div>
            {group && (
              <div className="space-y-2">
                <Label className="text-xs font-medium text-white/60">Curso</Label>
                <div className="flex items-center gap-2 rounded-md border border-white/10 bg-white/5 py-2.5 px-3">
                  <FileText className="w-4 h-4 text-white/50 shrink-0" />
                  <span className="text-[13px] text-white/80">{group.name}</span>
                </div>
                <p className="text-[11px] text-white/50 flex items-center gap-1.5">
                  <span className="w-4 h-4 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
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
              className="bg-[#1a73e8] hover:bg-[#1558b0] text-white text-[13px] font-medium"
            >
              Crear
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Crear documento nuevo (Google Doc / Presentación / Hoja de cálculo) */}
      <Dialog open={createNewOpen} onOpenChange={setCreateNewOpen}>
        <DialogContent className="bg-white/5 border border-white/10 max-w-[380px] rounded-2xl p-6 shadow-xl data-[state=open]:animate-in data-[state=open]:zoom-in-95 data-[state=open]:slide-in-from-bottom-2 overflow-hidden [&+[data-radix-dialog-overlay]]:bg-black/45">
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
                className="bg-white/5 border border-white/10 rounded-md py-2.5 px-3 text-sm text-white placeholder:text-white/50 focus:border-[#3B82F6] focus:bg-white/5"
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
              disabled={!createNewNombre.trim() || createNewDocMutation.isPending || !group || !cursoId}
              className="bg-[#1a73e8] hover:bg-[#1558b0] text-white text-[13px] font-medium"
            >
              {createNewDocMutation.isPending ? 'Creando…' : 'Crear'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modales Mi carpeta (estudiante) */}
      <Dialog open={myFolderAddGoogleOpen} onOpenChange={setMyFolderAddGoogleOpen}>
        <DialogContent className="bg-white/5 border border-white/10 max-w-[380px] rounded-2xl p-6 shadow-xl overflow-hidden">
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
          {!googleStatus.connected ? (
            <p className="text-white/60 text-sm py-4">Conecta Google Drive primero para usar tus archivos.</p>
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
        <DialogContent className="bg-white/5 border border-white/10 max-w-[380px] rounded-2xl p-6 shadow-xl overflow-hidden">
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
        <DialogContent className="bg-white/5 border border-white/10 max-w-[380px] rounded-2xl p-6 shadow-xl overflow-hidden">
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
    </div>
  );
}

const FILE_TYPE_STYLES: Record<string, { bg: string; icon: React.ReactNode; color: string }> = {
  doc: { bg: 'bg-blue-500/15', icon: <FileText className="w-5 h-5 text-[#1a73e8]" />, color: '#1a73e8' },
  slide: { bg: 'bg-orange-500/15', icon: <Presentation className="w-5 h-5 text-[#d97706]" />, color: '#d97706' },
  sheet: { bg: 'bg-emerald-500/15', icon: <FileSpreadsheet className="w-5 h-5 text-[#16a34a]" />, color: '#16a34a' },
  pdf: { bg: 'bg-red-500/15', icon: <FileText className="w-5 h-5 text-red-500" />, color: '#ef4444' },
  link: { bg: 'bg-white/10', icon: <Link2 className="w-5 h-5 text-white/70" />, color: 'rgba(255,255,255,0.7)' },
};
const defaultStyle = { bg: 'bg-amber-500/15', icon: <FileText className="w-5 h-5 text-amber-500" />, color: '#f59e0b' };

function FileRow({ file, isNew }: { file: EvoFile; isNew?: boolean }) {
  const link = file.googleWebViewLink || file.evoStorageUrl || '#';
  const isGoogle = file.origen === 'google';
  const style = FILE_TYPE_STYLES[file.tipo] || defaultStyle;

  return (
    <li
      className={`group flex items-center justify-between gap-4 py-[13px] px-4 rounded-xl border bg-white/5 hover:bg-white/10 transition-colors ${
        isNew ? 'border-[#4DBBFF]/40 bg-[#4DBBFF]/5 animate-in fade-in slide-in-from-top-2 duration-300' : 'border-white/10 hover:border-white/20'
      }`}
    >
      <div className="flex items-center gap-4 min-w-0 flex-1">
        <div className={`w-[38px] h-[38px] rounded-[10px] flex items-center justify-center shrink-0 ${style.bg}`}>
          {style.icon}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-white truncate">{file.nombre}</p>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className="text-[11px] text-white/60">{file.cursoNombre}</span>
            <span className="w-0.5 h-0.5 rounded-full bg-white/40 shrink-0" />
            {isGoogle && (
              <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-medium bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                Google
              </span>
            )}
            {isNew && (
              <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-medium bg-[#4DBBFF]/15 text-[#4DBBFF]">
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
            className="inline-flex items-center gap-1 text-[11px] font-medium text-[#4DBBFF] hover:underline"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Abrir en Drive
          </a>
        )}
        <button
          type="button"
          className="w-[30px] h-[30px] rounded-lg flex items-center justify-center text-white/60 hover:bg-white/10 hover:text-white transition-colors"
          aria-label="Más opciones"
        >
          <MoreVertical className="w-4 h-4" />
        </button>
      </div>
    </li>
  );
}
