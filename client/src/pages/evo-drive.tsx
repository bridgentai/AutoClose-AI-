import { useEffect, useState } from 'react';
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
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface EvoGroup {
  id: string;
  name: string;
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

interface GoogleDriveFile {
  id: string;
  name: string;
  mimeType?: string;
  webViewLink?: string;
  size?: string;
}

const ROLES_WRITE = ['profesor', 'directivo', 'school_admin', 'super_admin', 'admin-general-colegio'];

// Carpeta por materia/curso: muestra los archivos que el profesor subió para ese curso (vista estudiante).
function CourseFolder({ group }: { group: EvoGroup }) {
  const [open, setOpen] = useState(true);
  const { data: files = [], isLoading } = useQuery<EvoFile[]>({
    queryKey: ['evo-drive', 'files', group.id],
    queryFn: () => apiRequest('GET', `/api/evo-drive/files?cursoId=${encodeURIComponent(group.id)}`),
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
            <span className="font-semibold text-white">{group.name}</span>
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
  const isTeacher = user?.rol && ROLES_WRITE.includes(user.rol);

  const { data: googleStatus = { connected: false } } = useQuery<{ connected: boolean }>({
    queryKey: ['evo-drive', 'google-status'],
    queryFn: () => apiRequest('GET', '/api/evo-drive/google/status'),
  });

  const { data: groups = [] } = useQuery<EvoGroup[]>({
    queryKey: ['evo-drive', 'groups'],
    queryFn: () => apiRequest('GET', '/api/evo-drive/groups'),
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

  const allFiles = [...files].sort((a, b) =>
    (a.nombre || '').localeCompare(b.nombre || '', undefined, { sensitivity: 'base' })
  );
  const group = groups.find((g) => g.id === cursoId);

  const handleAddFromGoogle = (gfile: GoogleDriveFile) => {
    if (!cursoId || !group) return;
    addFileMutation.mutate({
      nombre: gfile.name,
      tipo: mimeToTipo(gfile.mimeType || ''),
      origen: 'google',
      cursoId,
      cursoNombre: group.name,
      googleFileId: gfile.id,
      googleWebViewLink: gfile.webViewLink,
      googleMimeType: gfile.mimeType,
      sizeBytes: gfile.size ? parseInt(gfile.size, 10) : undefined,
    });
  };

  const handleAddFromEvo = () => {
    if (!cursoId || !group || !evoLinkName.trim()) return;
    addFileMutation.mutate({
      nombre: evoLinkName.trim(),
      tipo: 'link',
      origen: 'material',
      cursoId,
      cursoNombre: group.name,
      evoStorageUrl: evoLinkUrl.trim() || undefined,
    });
  };

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="max-w-5xl mx-auto">
        <NavBackButton
          to={user?.rol === 'profesor' ? '/profesor/academia' : '/dashboard'}
          label={user?.rol === 'profesor' ? 'Academia' : 'Dashboard'}
        />
        <h1 className="text-2xl font-bold text-white font-['Poppins'] mt-4 flex items-center gap-2">
          <FolderOpen className="w-7 h-7 text-[#00c8ff]" />
          Evo Drive
        </h1>
        <p className="text-white/60 mb-6">
          {isTeacher ? 'Archivos del curso en un solo lugar' : 'Tus materias y archivos por curso'}
        </p>

        <div className="flex flex-wrap items-center gap-4 mb-6">
          {isTeacher && (
            <div className="flex items-center gap-2">
              <Label className="text-white/80">Curso</Label>
              <Select value={cursoId} onValueChange={setCursoId}>
                <SelectTrigger className="w-[200px] bg-white/5 border-white/10 text-white">
                  <SelectValue placeholder="Selecciona un curso" />
                </SelectTrigger>
                <SelectContent>
                  {groups.map((g) => (
                    <SelectItem key={g.id} value={g.id}>
                      {g.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {isTeacher && (
            <>
              {!googleStatus.connected && (
                <Button
                  onClick={connectGoogle}
                  variant="outline"
                  className="border-[#00c8ff]/50 text-[#00c8ff]"
                >
                  Conectar Google Drive
                </Button>
              )}
              {googleStatus.connected && (
                <span className="text-sm text-white/60">Google Drive conectado</span>
              )}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button className="bg-[#00c8ff]/20 text-[#00c8ff] border border-[#00c8ff]/50 hover:bg-[#00c8ff]/30">
                    <Plus className="w-4 h-4 mr-2" />
                    Agregar archivos
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="bg-[#0f172a] border-white/10">
                  <DropdownMenuItem
                    onClick={() => setAddFromGoogleOpen(true)}
                    disabled={!googleStatus.connected}
                    className="text-white/90"
                  >
                    <Cloud className="w-4 h-4 mr-2" />
                    Desde Google Drive
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setAddFromEvoOpen(true)} className="text-white/90">
                    <Link2 className="w-4 h-4 mr-2" />
                    Desde Evo (enlace)
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}
        </div>

        {isTeacher ? (
          filesLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-24 w-full bg-white/10" />
              <Skeleton className="h-24 w-full bg-white/10" />
            </div>
          ) : (
            <Card className="bg-white/5 border-white/10">
              <CardHeader className="pb-2">
                <CardTitle className="text-white flex items-center gap-2 text-lg">
                  <FileText className="w-5 h-5 text-[#00c8ff]" />
                  Archivos del curso
                </CardTitle>
              </CardHeader>
              <CardContent>
                {allFiles.length === 0 ? (
                  <p className="text-white/50 text-sm py-8 text-center">
                    Aún no hay archivos. Usa &quot;Agregar archivos&quot; para añadir desde Google Drive o Evo.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {allFiles.map((f) => (
                      <FileRow key={f.id} file={f} />
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          )
        ) : (
          <div className="space-y-3">
            {groups.length === 0 ? (
              <Card className="bg-white/5 border-white/10">
                <CardContent className="py-8">
                  <p className="text-white/50 text-sm text-center">
                    No tienes materias asignadas aún. Cuando te inscriban en cursos, verás aquí una carpeta por cada materia con los archivos que suba tu profesor.
                  </p>
                </CardContent>
              </Card>
            ) : (
              groups.map((g) => <CourseFolder key={g.id} group={g} />)
            )}
          </div>
        )}
      </div>

      {/* Agregar desde Google Drive */}
      <Dialog open={addFromGoogleOpen} onOpenChange={setAddFromGoogleOpen}>
        <DialogContent className="bg-[#0f172a] border-white/10 max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Cloud className="w-5 h-5 text-[#00c8ff]" />
              Agregar desde Google Drive
            </DialogTitle>
          </DialogHeader>
          {!googleStatus.connected ? (
            <p className="text-white/60 text-sm py-4">
              Conecta Google Drive primero con el botón de la barra superior.
            </p>
          ) : (
            <>
              <div className="space-y-2">
                <Label className="text-white/80">Buscar en Drive</Label>
                <Input
                  value={googleSearch}
                  onChange={(e) => setGoogleSearch(e.target.value)}
                  placeholder="Nombre del archivo..."
                  className="bg-white/5 border-white/10 text-white"
                />
              </div>
              <ScrollArea className="h-[280px] rounded-md border border-white/10">
                {googleFilesLoading ? (
                  <div className="p-4 space-y-2">
                    <Skeleton className="h-12 w-full bg-white/10" />
                    <Skeleton className="h-12 w-full bg-white/10" />
                  </div>
                ) : googleFiles.length === 0 ? (
                  <p className="text-white/50 text-sm p-4">No se encontraron archivos o escribe para buscar.</p>
                ) : (
                  <ul className="p-2 space-y-1">
                    {googleFiles.map((gf) => (
                      <li
                        key={gf.id}
                        className="flex items-center justify-between gap-2 p-2 rounded-lg hover:bg-white/10 text-white"
                      >
                        <span className="truncate text-sm">{gf.name}</span>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="shrink-0 text-[#00c8ff]"
                          onClick={() => handleAddFromGoogle(gf)}
                          disabled={addFileMutation.isPending}
                        >
                          Agregar
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </ScrollArea>
            </>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddFromGoogleOpen(false)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Agregar desde Evo (enlace) */}
      <Dialog open={addFromEvoOpen} onOpenChange={setAddFromEvoOpen}>
        <DialogContent className="bg-[#0f172a] border-white/10">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Link2 className="w-5 h-5 text-[#00c8ff]" />
              Agregar enlace (Evo)
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-white/80">Nombre del recurso *</Label>
              <Input
                value={evoLinkName}
                onChange={(e) => setEvoLinkName(e.target.value)}
                placeholder="Ej: Guía de estudio"
                className="bg-white/5 border-white/10 text-white"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-white/80">URL (opcional)</Label>
              <Input
                value={evoLinkUrl}
                onChange={(e) => setEvoLinkUrl(e.target.value)}
                placeholder="https://..."
                className="bg-white/5 border-white/10 text-white"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddFromEvoOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleAddFromEvo}
              disabled={!evoLinkName.trim() || addFileMutation.isPending}
            >
              Agregar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FileRow({ file }: { file: EvoFile }) {
  const link = file.googleWebViewLink || file.evoStorageUrl || '#';
  const isGoogle = file.origen === 'google';

  return (
    <li className="flex items-center justify-between gap-2 p-3 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10">
      <div className="flex items-center gap-3 min-w-0">
        {isGoogle ? (
          <Cloud className="w-5 h-5 text-[#00c8ff]/80 shrink-0" />
        ) : (
          <FileText className="w-5 h-5 text-white/60 shrink-0" />
        )}
        <div className="min-w-0">
          <p className="text-white font-medium truncate">{file.nombre}</p>
          <p className="text-white/50 text-sm flex items-center gap-1">
            {file.cursoNombre}
            {isGoogle && <span className="text-[#00c8ff]/70 text-xs">Google</span>}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {link !== '#' && (
          <a
            href={link}
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 rounded-lg hover:bg-white/10 text-white/70"
          >
            <ExternalLink className="w-4 h-4" />
          </a>
        )}
      </div>
    </li>
  );
}
