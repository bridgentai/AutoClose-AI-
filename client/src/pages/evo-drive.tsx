import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { useQuery, useQueries, useMutation, useQueryClient } from '@tanstack/react-query';
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
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
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
  Upload,
  FileSpreadsheet,
  Presentation,
  X,
  Check,
  Star,
  Trash2,
  Pencil,
  Lock,
  RotateCcw,
  Clock,
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
  createdAt?: string | null;
  updatedAt?: string | null;
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

/** Arrastrar archivos del curso a la papelera (sidebar). */
const EVO_DRIVE_FILE_DRAG_TYPE = 'application/x-evo-drive-file-id';

export type EvoDriveTrashContextValue = {
  canManageTrash: boolean;
  trashIds: string[];
  toggleTrash: (id: string) => void;
  openTrashSection: () => void;
};

export const EvoDriveTrashContext = React.createContext<EvoDriveTrashContextValue | null>(null);

/** Abrir en Google (usa webViewLink de la API o URL construida por tipo MIME). */
function googleDrivePreviewUrl(file: GoogleDriveFile): string {
  const link = file.webViewLink?.trim();
  if (link) return link;
  const m = (file.mimeType || '').toLowerCase();
  const id = file.id;
  if (m.includes('folder') || m === 'application/vnd.google-apps.folder') {
    return `https://drive.google.com/drive/folders/${id}`;
  }
  if (m.includes('spreadsheet') || m.includes('sheet') || m === 'application/vnd.google-apps.spreadsheet') {
    return `https://docs.google.com/spreadsheets/d/${id}/edit`;
  }
  if (m.includes('presentation') || m === 'application/vnd.google-apps.presentation') {
    return `https://docs.google.com/presentation/d/${id}/edit`;
  }
  if (m.includes('document') || m.includes('word') || m === 'application/vnd.google-apps.document') {
    return `https://docs.google.com/document/d/${id}/edit`;
  }
  return `https://drive.google.com/file/d/${id}/view`;
}

function googleDriveKindMeta(mimeType?: string): {
  label: string;
  iconBox: string;
  Icon: LucideIcon;
} {
  const m = (mimeType || '').toLowerCase();
  if (m.includes('folder')) {
    return { label: 'Carpeta', iconBox: 'bg-sky-500/25 border-sky-400/30', Icon: FolderOpen };
  }
  if (m.includes('spreadsheet') || m.includes('sheet')) {
    return { label: 'Hoja de cálculo', iconBox: 'bg-emerald-500/25 border-emerald-400/35', Icon: FileSpreadsheet };
  }
  if (m.includes('presentation')) {
    return { label: 'Presentación', iconBox: 'bg-amber-500/25 border-amber-400/35', Icon: Presentation };
  }
  if (m.includes('document') || m.includes('word') || m === 'application/vnd.google-apps.document') {
    return { label: 'Documento', iconBox: 'bg-[#4285f4]/25 border-[#5a9fff]/35', Icon: FileText };
  }
  if (m.includes('pdf')) {
    return { label: 'PDF', iconBox: 'bg-red-500/20 border-red-400/30', Icon: FileText };
  }
  if (m.startsWith('image/')) {
    return { label: 'Imagen', iconBox: 'bg-fuchsia-500/20 border-fuchsia-400/30', Icon: FileText };
  }
  if (m.startsWith('video/')) {
    return { label: 'Video', iconBox: 'bg-violet-500/20 border-violet-400/30', Icon: FileText };
  }
  return { label: 'Archivo', iconBox: 'bg-white/10 border-white/15', Icon: FileText };
}

function GoogleDrivePickerRow({
  file,
  onAdd,
  addPending,
  buttonClassName,
}: {
  file: GoogleDriveFile;
  onAdd: (f: GoogleDriveFile) => void;
  addPending: boolean;
  buttonClassName: string;
}) {
  const { label, iconBox, Icon } = googleDriveKindMeta(file.mimeType);
  return (
    <li className="group flex items-stretch gap-3 p-3 rounded-xl border border-white/[0.06] bg-white/[0.03] hover:bg-white/[0.07] hover:border-[#00c8ff]/20 transition-all">
      <div
        className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border ${iconBox}`}
        aria-hidden
      >
        <Icon className="w-6 h-6 text-white" />
      </div>
      <div className="flex-1 min-w-0 flex flex-col justify-center gap-0.5">
        <p className="text-sm font-medium text-white truncate pr-2" title={file.name}>
          {file.name}
        </p>
        <p className="text-[11px] text-white/45 uppercase tracking-wide">{label}</p>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-9 rounded-xl border border-white/15 text-white/80 hover:text-[#7dd3fc] hover:bg-white/[0.08] hover:border-[#00c8ff]/35 px-3 text-[13px] font-medium"
          onClick={() => {
            window.open(googleDrivePreviewUrl(file), '_blank', 'noopener,noreferrer');
          }}
          title="Abrir en Google para previsualizar"
          aria-label={`Abrir ${file.name} en una pestaña nueva`}
        >
          <ExternalLink className="w-4 h-4 mr-1.5 shrink-0 opacity-90" />
          Abrir
        </Button>
        <Button
          type="button"
          size="sm"
          className={buttonClassName}
          onClick={() => onAdd(file)}
          disabled={addPending}
        >
          {addPending ? 'Agregando…' : 'Agregar'}
        </Button>
      </div>
    </li>
  );
}

const ROLES_WRITE = ['profesor', 'directivo', 'school_admin', 'super_admin', 'admin-general-colegio'];

/** Carpeta por curso solo visible para el docente (no para estudiantes). */
const EVO_TEACHER_PRIVATE_SENTINEL = '__evo_teacher_private__';

const MY_FOLDER_TITLE_STORAGE_PREFIX = 'evoDrive.myFolderTitle.';

/** Nombre API "Materia — Curso" → partes (mismo criterio que el backend). */
function parseTeacherFolderName(name: string): { materia: string; curso: string } {
  const sep = ' — ';
  if (name.includes(sep)) {
    const i = name.indexOf(sep);
    return {
      materia: name.slice(0, i).trim(),
      curso: name.slice(i + sep.length).trim() || name,
    };
  }
  return { materia: name, curso: '' };
}

// Carpeta por materia (vista estudiante / profesor): archivos del curso para esa materia. groupId + groupSubjectId.
function SubjectFolder({
  folder,
  onTeacherSelect,
  teacherSelected,
  subjectSelected,
  nameSuffix,
}: {
  folder: SubjectFolder;
  /** Profesor: al elegir carpeta para subir archivos (toolbar global). */
  onTeacherSelect?: () => void;
  teacherSelected?: boolean;
  /** Estudiante (o vista sin toolbar docente): carpeta activa desde el sidebar. */
  subjectSelected?: boolean;
  /** Ej. nombre del curso debajo del título de la materia */
  nameSuffix?: string;
}) {
  const [open, setOpen] = useState(false);
  const rowActive = Boolean(teacherSelected || subjectSelected);
  useEffect(() => {
    if (rowActive) setOpen(true);
  }, [rowActive]);
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
    <Collapsible open={open} onOpenChange={setOpen} id={`evo-drive-subject-${folder.id}`}>
      <Card
        className={`bg-[#1E3A8A]/25 border-white/10 overflow-hidden ${
          rowActive ? 'ring-2 ring-[#3B82F6]/80 ring-offset-2 ring-offset-[#020617]' : ''
        }`}
      >
        <CollapsibleTrigger asChild>
          <button
            type="button"
            onClick={() => onTeacherSelect?.()}
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
            <span className="flex flex-col items-start min-w-0 flex-1 text-left">
              <span className="font-semibold text-white truncate w-full">{folder.name}</span>
              {nameSuffix ? (
                <span className="text-xs text-[#E2E8F0]/55 font-normal truncate w-full">{nameSuffix}</span>
              ) : null}
            </span>
            <span className="text-[#E2E8F0]/70 text-sm shrink-0">
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

/** Profesor: un bloque por curso (grupo) con carpetas de materia dentro, mismo estilo que el estudiante. */
function ProfessorTeacherPrivateFolder({
  groupId,
  groupName,
  selected,
  onSelect,
}: {
  groupId: string;
  groupName: string;
  selected: boolean;
  onSelect: () => void;
}) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (selected) setOpen(true);
  }, [selected]);
  const { data: privFiles = [], isLoading } = useQuery<EvoFile[]>({
    queryKey: ['evo-drive', 'files', groupId, 'teacher-private'],
    queryFn: () =>
      apiRequest('GET', `/api/evo-drive/files?cursoId=${encodeURIComponent(groupId)}&teacherPrivate=1`),
    enabled: open || selected,
  });
  const sorted = [...privFiles].sort((a, b) =>
    (a.nombre || '').localeCompare(b.nombre || '', undefined, { sensitivity: 'base' })
  );
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card
        className={`bg-violet-950/30 border-violet-500/25 overflow-hidden ${
          selected ? 'ring-2 ring-violet-400/70 ring-offset-2 ring-offset-[#020617]' : ''
        }`}
      >
        <CollapsibleTrigger asChild>
          <button
            type="button"
            onClick={() => onSelect()}
            className="w-full flex items-center gap-3 p-4 text-left hover:bg-violet-500/10 transition-colors"
          >
            {open ? (
              <ChevronDown className="w-5 h-5 text-violet-300 shrink-0" />
            ) : (
              <ChevronRight className="w-5 h-5 text-violet-300 shrink-0" />
            )}
            <Lock className="w-6 h-6 text-violet-400 shrink-0" aria-hidden />
            <span className="flex flex-col items-start min-w-0 flex-1 text-left">
              <span className="font-semibold text-white truncate w-full">Mi carpeta</span>
              <span className="text-[11px] text-violet-200/70 font-normal">Solo docente · no visible para estudiantes</span>
            </span>
            <span className="text-violet-200/80 text-sm shrink-0">
              {privFiles.length} {privFiles.length === 1 ? 'archivo' : 'archivos'}
            </span>
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0 pb-4">
            {isLoading ? (
              <div className="space-y-2 pl-12">
                <Skeleton className="h-12 w-full bg-violet-900/30" />
              </div>
            ) : sorted.length === 0 ? (
              <p className="text-violet-200/60 text-sm pl-12 py-2">
                Aún no hay materiales privados. Selecciona esta carpeta en el panel lateral y usa &quot;Añadir o crear&quot;.
              </p>
            ) : (
              <ul className="space-y-2 pl-12">
                {sorted.map((f) => (
                  <FileRow key={f.id} file={f} allowCourseTrash={false} />
                ))}
              </ul>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

function ProfessorCourseBlock({
  groupId,
  groupName,
  folders,
  selectedGroupSubjectId,
  selectedTeacherPrivate,
  onSelectFolder,
  onSelectTeacherPrivate,
}: {
  groupId: string;
  groupName: string;
  folders: TeacherFolder[];
  selectedGroupSubjectId: string | undefined;
  selectedTeacherPrivate?: boolean;
  onSelectFolder: (f: TeacherFolder) => void;
  onSelectTeacherPrivate: (gid: string, gname: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const shouldExpandCourse =
    selectedTeacherPrivate === true ||
    (!!selectedGroupSubjectId &&
      folders.some((tf) => tf.groupSubjectId === selectedGroupSubjectId));
  useEffect(() => {
    if (shouldExpandCourse) setOpen(true);
  }, [shouldExpandCourse]);
  return (
    <div id={`evo-drive-course-${groupId}`}>
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card className="bg-[#0c1929]/80 border-white/[0.08] overflow-hidden">
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="w-full flex items-center gap-3 p-4 text-left hover:bg-white/[0.04] transition-colors border-b border-white/[0.06]"
          >
            {open ? (
              <ChevronDown className="w-5 h-5 text-[#60A5FA] shrink-0" />
            ) : (
              <ChevronRight className="w-5 h-5 text-[#60A5FA] shrink-0" />
            )}
            <FolderOpen className="w-7 h-7 text-[#60A5FA] shrink-0" />
            <div className="flex flex-col items-start min-w-0 flex-1">
              <span className="text-xs uppercase tracking-wider text-white/45 font-semibold">Curso</span>
              <span className="font-bold text-lg text-white tracking-tight truncate w-full">{groupName}</span>
            </div>
            <span className="text-white/50 text-sm shrink-0">
              {folders.length} {folders.length === 1 ? 'materia' : 'materias'}
            </span>
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-4 pb-4 px-3 space-y-3">
            {folders.map((tf) => {
              const { materia } = parseTeacherFolderName(tf.name);
              return (
                <SubjectFolder
                  key={tf.groupSubjectId}
                  folder={{
                    id: tf.groupSubjectId,
                    name: materia,
                    groupId: tf.groupId,
                    groupName: groupName,
                  }}
                  onTeacherSelect={() => onSelectFolder(tf)}
                  teacherSelected={!selectedTeacherPrivate && selectedGroupSubjectId === tf.groupSubjectId}
                />
              );
            })}
            <ProfessorTeacherPrivateFolder
              groupId={groupId}
              groupName={groupName}
              selected={selectedTeacherPrivate === true}
              onSelect={() => onSelectTeacherPrivate(groupId, groupName)}
            />
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
    </div>
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

/** Carpeta seleccionada (grupo + materia, o carpeta privada docente por curso). */
interface SelectedFolder {
  groupId: string;
  groupSubjectId: string;
  folderName: string;
  groupName: string;
  /** Archivos de apoyo del docente; los estudiantes no ven esta carpeta. */
  isTeacherPrivate?: boolean;
}

/** Conteo real de archivos por materia (misma queryKey que SubjectFolder → caché compartida). */
function SidebarSubjectFileCount({ groupId, subjectId }: { groupId: string; subjectId: string }) {
  const { data = [] } = useQuery<EvoFile[]>({
    queryKey: ['evo-drive', 'files', groupId, subjectId],
    queryFn: () =>
      apiRequest(
        'GET',
        `/api/evo-drive/files?cursoId=${encodeURIComponent(groupId)}&groupSubjectId=${encodeURIComponent(subjectId)}`
      ),
    enabled: !!groupId && !!subjectId,
  });
  return <>{data.length}</>;
}

/** Conteo archivos de Mi carpeta (solo docente) por curso. */
function SidebarTeacherPrivateFileCount({ groupId }: { groupId: string }) {
  const { data = [] } = useQuery<EvoFile[]>({
    queryKey: ['evo-drive', 'files', groupId, 'teacher-private'],
    queryFn: () =>
      apiRequest('GET', `/api/evo-drive/files?cursoId=${encodeURIComponent(groupId)}&teacherPrivate=1`),
    enabled: !!groupId,
  });
  return <>{data.length}</>;
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
  const [librarySection, setLibrarySection] = useState<'all' | 'recent' | 'trash'>('all');
  /** Resumen global (Todos los archivos) vs. navegación por carpetas. */
  const [driveMainView, setDriveMainView] = useState<'overview' | 'browse'>('browse');
  const [overviewTypeFilter, setOverviewTypeFilter] = useState<
    'all' | 'doc' | 'sheet' | 'slide' | 'pdf' | 'link' | 'other'
  >('all');
  const [overviewSearch, setOverviewSearch] = useState('');
  const [personalRootOpen, setPersonalRootOpen] = useState(false);
  const [sortMode, setSortMode] = useState<'recent' | 'oldest' | 'name-asc' | 'name-desc'>('recent');
  const [starredIds, setStarredIds] = useState<string[]>([]);
  const [trashIds, setTrashIds] = useState<string[]>([]);
  const [trashDropActive, setTrashDropActive] = useState(false);
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
  const [myFolderTitleEditOpen, setMyFolderTitleEditOpen] = useState(false);
  const [myFolderTitleDraft, setMyFolderTitleDraft] = useState('Mi carpeta');
  const [renamePersonalFileId, setRenamePersonalFileId] = useState<string | null>(null);
  const [renamePersonalNombre, setRenamePersonalNombre] = useState('');
  const [personalFolderTitle, setPersonalFolderTitle] = useState('Mi carpeta');

  const showPersonalMyFolder = user?.rol === 'estudiante' || user?.rol === 'profesor';

  useEffect(() => {
    if (!user?.id) return;
    try {
      const v = localStorage.getItem(`${MY_FOLDER_TITLE_STORAGE_PREFIX}${user.id}`);
      if (v) setPersonalFolderTitle(v);
    } catch {
      /* ignore */
    }
  }, [user?.id]);

  const { data: googleStatus = { connected: false } } = useQuery<{ connected: boolean }>({
    queryKey: ['evo-drive', 'google-status'],
    queryFn: () => apiRequest('GET', '/api/evo-drive/google/status'),
  });

  const { data: recentFilesFromApi = [], isLoading: recentLoading, dataUpdatedAt } = useQuery<EvoFile[]>({
    queryKey: ['evo-drive', 'recientes', user?.id],
    queryFn: () => apiRequest<EvoFile[]>('GET', '/api/evo-drive/recientes'),
    enabled: !!user?.id,
    refetchInterval: 60_000,
    staleTime: 25_000,
    refetchOnWindowFocus: true,
  });

  const recentVisible = useMemo(
    () => recentFilesFromApi.filter((f) => !trashIds.includes(f.id)),
    [recentFilesFromApi, trashIds]
  );

  const { data: groupsData = [] } = useQuery<TeacherFolder[] | EvoGroupWithSubjects[]>({
    queryKey: ['evo-drive', 'groups'],
    queryFn: () => apiRequest('GET', '/api/evo-drive/groups'),
    enabled: isTeacher,
  });
  const teacherFolders: TeacherFolder[] = isProfesor ? (groupsData as TeacherFolder[]) : [];
  const adminGroups: EvoGroupWithSubjects[] = isAdminOrDirectivo ? (groupsData as EvoGroupWithSubjects[]) : [];

  /** Profesor: un bloque por curso (grupo), con materias dentro — mismo criterio que la vista estudiante. */
  const professorCourses = useMemo(() => {
    if (!isProfesor || teacherFolders.length === 0) return [];
    const map = new Map<string, TeacherFolder[]>();
    for (const f of teacherFolders) {
      if (!map.has(f.groupId)) map.set(f.groupId, []);
      map.get(f.groupId)!.push(f);
    }
    const grouped: { groupId: string; groupName: string; folders: TeacherFolder[] }[] = [];
    map.forEach((folders, groupId) => {
      const groupName = parseTeacherFolderName(folders[0].name).curso || folders[0].name;
      const sorted = [...folders].sort((a, b) => a.name.localeCompare(b.name, 'es'));
      grouped.push({ groupId, groupName, folders: sorted });
    });
    return grouped.sort((a, b) => a.groupName.localeCompare(b.groupName, 'es'));
  }, [isProfesor, teacherFolders]);

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
    enabled: showPersonalMyFolder,
  });

  type EvoDriveAggQuery = {
    queryKey: readonly unknown[];
    queryFn: () => Promise<EvoFile[]>;
    sourceLabel: string;
  };

  const evoDriveAggregateQueries = useMemo((): EvoDriveAggQuery[] => {
    const out: EvoDriveAggQuery[] = [];
    if (isProfesor) {
      for (const c of professorCourses) {
        for (const f of c.folders) {
          const { materia, curso } = parseTeacherFolderName(f.name);
          const sourceLabel = curso ? `${materia} · ${curso}` : f.name;
          out.push({
            queryKey: ['evo-drive', 'files', f.groupId, f.groupSubjectId],
            queryFn: () =>
              apiRequest(
                'GET',
                `/api/evo-drive/files?cursoId=${encodeURIComponent(f.groupId)}&groupSubjectId=${encodeURIComponent(f.groupSubjectId)}`
              ),
            sourceLabel,
          });
        }
        out.push({
          queryKey: ['evo-drive', 'files', c.groupId, 'teacher-private'],
          queryFn: () =>
            apiRequest('GET', `/api/evo-drive/files?cursoId=${encodeURIComponent(c.groupId)}&teacherPrivate=1`),
          sourceLabel: `Mi carpeta (docente) · ${c.groupName}`,
        });
      }
    } else if (isAdminOrDirectivo) {
      for (const g of adminGroups) {
        for (const sub of g.groupSubjects ?? []) {
          out.push({
            queryKey: ['evo-drive', 'files', sub.groupId, sub.groupSubjectId],
            queryFn: () =>
              apiRequest(
                'GET',
                `/api/evo-drive/files?cursoId=${encodeURIComponent(sub.groupId)}&groupSubjectId=${encodeURIComponent(sub.groupSubjectId)}`
              ),
            sourceLabel: sub.name,
          });
        }
      }
    } else if (!isTeacher) {
      for (const folder of subjectFolders) {
        out.push({
          queryKey: ['evo-drive', 'files', folder.groupId, folder.id],
          queryFn: () =>
            apiRequest(
              'GET',
              `/api/evo-drive/files?cursoId=${encodeURIComponent(folder.groupId)}&groupSubjectId=${encodeURIComponent(folder.id)}`
            ),
          sourceLabel: folder.name,
        });
      }
    }
    return out;
  }, [isProfesor, isAdminOrDirectivo, isTeacher, professorCourses, adminGroups, subjectFolders]);

  const evoDriveAggregateResults = useQueries({
    queries: evoDriveAggregateQueries.map((q) => ({
      queryKey: [...q.queryKey],
      queryFn: q.queryFn,
      enabled: evoDriveAggregateQueries.length > 0,
    })),
  });

  const overviewFlatRows = useMemo(() => {
    const rows: { file: EvoFile; sourceLabel: string; rowKey: string }[] = [];
    evoDriveAggregateResults.forEach((res, i) => {
      const meta = evoDriveAggregateQueries[i];
      if (!meta) return;
      const k2 = String(meta.queryKey[2] ?? '');
      const k3 = String(meta.queryKey[3] ?? '');
      for (const f of res.data ?? []) {
        rows.push({
          file: { ...f, cursoNombre: meta.sourceLabel },
          sourceLabel: meta.sourceLabel,
          rowKey: `${k2}-${k3}-${f.id}`,
        });
      }
    });
    if (showPersonalMyFolder) {
      for (const pf of myFolderFiles) {
        rows.push({
          file: {
            id: pf.id,
            nombre: pf.nombre,
            tipo: pf.tipo,
            origen: pf.origen,
            googleWebViewLink: pf.googleWebViewLink,
            evoStorageUrl: pf.url,
            cursoNombre: personalFolderTitle,
          },
          sourceLabel: personalFolderTitle,
          rowKey: `personal-${pf.id}`,
        });
      }
    }
    return rows;
  }, [
    evoDriveAggregateResults,
    evoDriveAggregateQueries,
    myFolderFiles,
    showPersonalMyFolder,
    personalFolderTitle,
  ]);

  const overviewFilteredRows = useMemo(() => {
    const q = overviewSearch.trim().toLowerCase();
    let list = overviewFlatRows.filter((r) => !trashIds.includes(r.file.id));
    if (q) {
      list = list.filter(
        (r) =>
          (r.file.nombre || '').toLowerCase().includes(q) || r.sourceLabel.toLowerCase().includes(q)
      );
    }
    if (overviewTypeFilter !== 'all') {
      const core = new Set(['doc', 'sheet', 'slide', 'pdf', 'link']);
      if (overviewTypeFilter === 'other') {
        list = list.filter((r) => !core.has(r.file.tipo));
      } else {
        list = list.filter((r) => r.file.tipo === overviewTypeFilter);
      }
    }
    return [...list].sort((a, b) =>
      (a.file.nombre || '').localeCompare(b.file.nombre || '', 'es', { sensitivity: 'base' })
    );
  }, [overviewFlatRows, overviewSearch, overviewTypeFilter, trashIds]);

  const overviewLoading =
    evoDriveAggregateQueries.length > 0 &&
    evoDriveAggregateResults.some((r) => r.isPending || r.isFetching);

  const showAllFilesOverview = driveMainView === 'overview' && librarySection === 'all';

  const totalSidebarDriveFiles =
    evoDriveAggregateResults.reduce((acc, r) => acc + (r.data?.length ?? 0), 0) +
    (showPersonalMyFolder ? myFolderFiles.length : 0);

  const isTeacherPrivateFolder = selectedFolder?.isTeacherPrivate === true;
  const cursoId = selectedFolder?.groupId ?? '';
  const selectedGroupSubjectId = selectedFolder && !isTeacherPrivateFolder ? selectedFolder.groupSubjectId : '';

  const { data: files = [], isLoading: filesLoading } = useQuery<EvoFile[]>({
    queryKey: isTeacherPrivateFolder
      ? ['evo-drive', 'files', cursoId, 'teacher-private']
      : ['evo-drive', 'files', cursoId, selectedGroupSubjectId],
    queryFn: () =>
      isTeacherPrivateFolder
        ? apiRequest('GET', `/api/evo-drive/files?cursoId=${encodeURIComponent(cursoId)}&teacherPrivate=1`)
        : apiRequest(
            'GET',
            `/api/evo-drive/files?cursoId=${encodeURIComponent(cursoId)}&groupSubjectId=${encodeURIComponent(selectedGroupSubjectId)}`
          ),
    enabled: isTeacher && !!cursoId && (isTeacherPrivateFolder || !!selectedGroupSubjectId),
  });

  const group = selectedFolder ? { name: selectedFolder.groupName } : null;

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

  const patchPersonalFileMutation = useMutation({
    mutationFn: ({ id, nombre }: { id: string; nombre: string }) =>
      apiRequest('PATCH', `/api/evo-drive/my-folder/${encodeURIComponent(id)}`, { nombre }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['evo-drive', 'my-folder'] });
      setRenamePersonalFileId(null);
      toast({ title: 'Listo', description: 'Nombre actualizado.' });
    },
    onError: (e: Error) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const addFileMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      apiRequest('POST', '/api/evo-drive/files', body),
    onSuccess: (_, variables) => {
      const gid = (variables.cursoId as string) ?? cursoId;
      if (variables.staffOnly) {
        queryClient.invalidateQueries({ queryKey: ['evo-drive', 'files', gid, 'teacher-private'] });
      } else {
        const gsid = (variables.groupSubjectId as string) ?? selectedGroupSubjectId;
        queryClient.invalidateQueries({ queryKey: ['evo-drive', 'files', gid, gsid] });
      }
      if (variables.origen === 'google') {
        setAddFromGoogleOpen(false);
        toast({ title: 'Archivo agregado', description: 'Se vinculó el archivo de Google Drive.' });
      } else {
        setAddFromEvoOpen(false);
        setEvoLinkName('');
        setEvoLinkUrl('');
        toast({ title: 'Archivo agregado', description: 'Se añadió el enlace a Evo Drive.' });
      }
      queryClient.invalidateQueries({ queryKey: ['evo-drive', 'recientes'] });
    },
    onError: (e: Error) => {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    },
  });

  const createNewDocMutation = useMutation({
    mutationFn: (body: {
      nombre: string;
      tipo: 'doc' | 'sheet' | 'slide';
      cursoId: string;
      cursoNombre: string;
      groupSubjectId?: string;
      staffOnly?: boolean;
    }) => apiRequest('POST', '/api/evo-drive/google/create', body),
    onSuccess: (_, vars) => {
      const gid = vars.cursoId;
      if (vars.staffOnly) {
        queryClient.invalidateQueries({ queryKey: ['evo-drive', 'files', gid, 'teacher-private'] });
      } else if (vars.groupSubjectId) {
        queryClient.invalidateQueries({ queryKey: ['evo-drive', 'files', gid, vars.groupSubjectId] });
      }
      setCreateNewOpen(false);
      setCreateNewNombre('');
      toast({ title: 'Documento creado', description: 'Se creó en Google Drive y se añadió a Evo Drive.' });
      queryClient.invalidateQueries({ queryKey: ['evo-drive', 'recientes'] });
    },
    onError: (e: Error) => {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    },
  });

  const addToMyFolderMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) => apiRequest('POST', '/api/evo-drive/my-folder', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['evo-drive', 'my-folder'] });
      queryClient.invalidateQueries({ queryKey: ['evo-drive', 'recientes'] });
      toast({ title: 'Agregado', description: 'Se añadió a Mi carpeta.' });
    },
    onError: (e: Error) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const deleteFromMyFolderMutation = useMutation({
    mutationFn: (id: string) => apiRequest('DELETE', `/api/evo-drive/my-folder/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['evo-drive', 'my-folder'] });
      queryClient.invalidateQueries({ queryKey: ['evo-drive', 'recientes'] });
      toast({ title: 'Eliminado', description: 'Se quitó de Mi carpeta.' });
    },
    onError: (e: Error) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const deleteEvoFileMutation = useMutation({
    mutationFn: (id: string) => apiRequest('DELETE', `/api/evo-drive/files/${encodeURIComponent(id)}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['evo-drive'] });
      toast({ title: 'Eliminado', description: 'El archivo se eliminó de Evo Drive.' });
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
    if (selectedFolder.isTeacherPrivate) {
      createNewDocMutation.mutate({
        nombre: createNewNombre.trim(),
        tipo: createNewType,
        cursoId: selectedFolder.groupId,
        cursoNombre: selectedFolder.groupName,
        staffOnly: true,
      });
      return;
    }
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

  const trashStorageKey = user?.id ? `evo-drive-trash:${user.id}` : 'evo-drive-trash';
  const starredStorageKey = user?.id ? `evo-drive-starred:${user.id}` : 'evo-drive-starred';

  useEffect(() => {
    try {
      const rawStarred = localStorage.getItem(starredStorageKey) ?? localStorage.getItem('evo-drive-starred');
      let rawTrash = localStorage.getItem(trashStorageKey);
      if (!rawTrash && user?.id) rawTrash = localStorage.getItem('evo-drive-trash');
      if (rawStarred) setStarredIds(JSON.parse(rawStarred));
      if (rawTrash) setTrashIds(JSON.parse(rawTrash));
    } catch {
      setStarredIds([]);
      setTrashIds([]);
    }
  }, [starredStorageKey, trashStorageKey, user?.id]);

  useEffect(() => {
    localStorage.setItem(starredStorageKey, JSON.stringify(starredIds));
  }, [starredIds, starredStorageKey]);

  useEffect(() => {
    localStorage.setItem(trashStorageKey, JSON.stringify(trashIds));
  }, [trashIds, trashStorageKey]);

  const aggregateCourseFilesOnly = useMemo(
    () => overviewFlatRows.filter((r) => !r.rowKey.startsWith('personal-')).map((r) => r.file),
    [overviewFlatRows]
  );

  const useAggregateAsFileList = librarySection === 'trash' && isTeacher;
  const filesSource = useAggregateAsFileList ? aggregateCourseFilesOnly : files;
  const filesLoadingSource = useAggregateAsFileList ? overviewLoading : filesLoading;

  const allFilesSorted = [...filesSource];
  const withSearch = fileSearch.trim()
    ? allFilesSorted.filter((f) =>
        (f.nombre || '').toLowerCase().includes(fileSearch.trim().toLowerCase())
      )
    : allFilesSorted;
  const nonTrash = withSearch.filter((f) => !trashIds.includes(f.id));
  const activeSectionFiles =
    librarySection === 'trash'
      ? withSearch.filter((f) => trashIds.includes(f.id))
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
  const scrollDriveElementIntoView = (elementId: string) => {
    window.setTimeout(() => {
      document.getElementById(elementId)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 150);
  };
  const toggleStar = (id: string) => {
    setStarredIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };
  const toggleTrash = (id: string) => {
    setTrashIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const evoDriveTrashContextValue = useMemo(
    () => ({
      canManageTrash: Boolean(isTeacher),
      trashIds,
      toggleTrash,
      openTrashSection: () => setLibrarySection('trash'),
    }),
    [isTeacher, trashIds]
  );

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
    if (!selectedFolder.isTeacherPrivate && !selectedFolder.groupSubjectId) {
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
      ...(selectedFolder.isTeacherPrivate
        ? { staffOnly: true }
        : { groupSubjectId: selectedFolder.groupSubjectId }),
      googleFileId: gfile.id,
      googleWebViewLink: webViewLink,
      googleMimeType: gfile.mimeType,
      mimeType: gfile.mimeType,
      sizeBytes: gfile.size ? parseInt(gfile.size, 10) : undefined,
    });
  };

  const handleAddFromEvo = () => {
    if (!selectedFolder || !evoLinkName.trim()) return;
    if (!selectedFolder.isTeacherPrivate && !selectedFolder.groupSubjectId) {
      toast({
        title: 'Elige una materia',
        description: 'Debes seleccionar una carpeta (materia — curso) antes de agregar un enlace.',
        variant: 'destructive',
      });
      return;
    }
    const url = evoLinkUrl.trim();
    addFileMutation.mutate({
      nombre: evoLinkName.trim(),
      tipo: 'link',
      origen: 'material',
      cursoId: selectedFolder.groupId,
      cursoNombre: selectedFolder.groupName,
      ...(selectedFolder.isTeacherPrivate
        ? { staffOnly: true, googleWebViewLink: url || undefined }
        : { groupSubjectId: selectedFolder.groupSubjectId, evoStorageUrl: url || undefined }),
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

  const overviewTypeChips: ReadonlyArray<{
    key: 'all' | 'doc' | 'sheet' | 'slide' | 'pdf' | 'link' | 'other';
    label: string;
  }> = [
    { key: 'all', label: 'Todos' },
    { key: 'doc', label: 'Documentos' },
    { key: 'sheet', label: 'Hojas' },
    { key: 'slide', label: 'Presentaciones' },
    { key: 'pdf', label: 'PDF' },
    { key: 'link', label: 'Enlaces' },
    { key: 'other', label: 'Otros' },
  ];

  const renderAllFilesOverview = () => (
    <div className="flex-1 min-h-0 flex flex-col px-6 py-6 overflow-auto">
      <div className="shrink-0 mb-5">
        <h2 className="text-xl font-semibold text-white font-['Poppins'] tracking-tight">Todos los archivos</h2>
        <p className="text-sm text-white/45 mt-1 max-w-2xl leading-relaxed">
          Resumen de todo lo que tienes en Evo Drive. Filtra por tipo (documentos, hojas, presentaciones…), busca por
          nombre o por la carpeta de origen.
        </p>
      </div>
      <div className="shrink-0 flex flex-col lg:flex-row lg:items-start gap-4 mb-5">
        <div className="flex-1 flex items-center gap-2 min-w-0 rounded-xl bg-[#1E3A8A]/40 border border-white/10 py-2.5 px-3">
          <Search className="w-4 h-4 text-white/50 shrink-0" />
          <input
            type="search"
            value={overviewSearch}
            onChange={(e) => setOverviewSearch(e.target.value)}
            placeholder="Buscar por nombre o ubicación…"
            className="flex-1 min-w-0 bg-transparent text-[13px] text-[#E2E8F0] placeholder:text-white/40 outline-none"
            aria-label="Buscar archivos en el resumen"
          />
        </div>
        <div className="flex flex-wrap gap-2 lg:max-w-[min(100%,520px)] lg:justify-end">
          {overviewTypeChips.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => setOverviewTypeFilter(c.key)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                overviewTypeFilter === c.key
                  ? 'text-[#93c5fd] border-[#3b82f6]/50 bg-[#3b82f6]/20'
                  : 'text-white/60 border-white/10 bg-white/[0.03] hover:bg-white/[0.06]'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>
      {overviewLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-[72px] w-full rounded-xl bg-[#1E3A8A]/30" />
          <Skeleton className="h-[72px] w-full rounded-xl bg-[#1E3A8A]/30" />
          <Skeleton className="h-[72px] w-full rounded-xl bg-[#1E3A8A]/30" />
        </div>
      ) : overviewFilteredRows.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-white/[0.03] py-16 text-center px-4">
          <FolderOpen className="w-12 h-12 text-white/20 mx-auto mb-3" />
          <p className="text-white/65 font-medium">Sin resultados</p>
          <p className="text-white/45 text-sm mt-1">
            {overviewFlatRows.length === 0
              ? 'Aún no hay archivos en tus carpetas o en Mi carpeta personal.'
              : 'Prueba otro filtro o otra búsqueda.'}
          </p>
        </div>
      ) : (
        <ul className="space-y-2 min-h-0 pb-4">
          {overviewFilteredRows.map(({ file, rowKey }) => (
            <FileRow
              key={rowKey}
              file={file}
              isStarred={starredIds.includes(file.id)}
              onToggleStar={isTeacher ? toggleStar : undefined}
              isInTrash={trashIds.includes(file.id)}
              allowCourseTrash={!rowKey.startsWith('personal-')}
            />
          ))}
        </ul>
      )}
      {!overviewLoading && overviewFlatRows.length > 0 ? (
        <p className="text-[11px] text-white/35 mt-2 shrink-0">
          Mostrando {overviewFilteredRows.length} de {overviewFlatRows.length} archivo
          {overviewFlatRows.length === 1 ? '' : 's'} en el resumen.
        </p>
      ) : null}
    </div>
  );

  const renderRecentQuickAccess = () => (
    <div className="flex-1 min-h-0 flex flex-col px-6 py-6 overflow-auto">
      <div className="shrink-0 mb-5 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-white font-['Poppins'] tracking-tight flex items-center gap-2">
            <Clock className="w-6 h-6 text-[#00c8ff] shrink-0" />
            Recientes
          </h2>
          <p className="text-sm text-white/45 mt-1 max-w-2xl leading-relaxed">
            Los últimos 10 archivos añadidos a Evo Drive (tus materias y Mi carpeta). La lista se actualiza al volver a la
            pestaña y cada minuto mientras permaneces aquí.
          </p>
        </div>
        {dataUpdatedAt ? (
          <p className="text-[11px] text-white/35 shrink-0 tabular-nums">
            Última actualización: {new Date(dataUpdatedAt).toLocaleString('es')}
          </p>
        ) : null}
      </div>
      {recentLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-[72px] w-full rounded-xl bg-[#1E3A8A]/30" />
          <Skeleton className="h-[72px] w-full rounded-xl bg-[#1E3A8A]/30" />
        </div>
      ) : recentVisible.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-white/[0.03] py-16 text-center px-4">
          <Clock className="w-12 h-12 text-white/20 mx-auto mb-3" />
          <p className="text-white/65 font-medium">Aún no hay archivos recientes</p>
          <p className="text-white/45 text-sm mt-1 max-w-md mx-auto">
            Cuando tu profesor o tú agreguen materiales en las carpetas del curso o en Mi carpeta, aparecerán aquí en
            orden de alta.
          </p>
        </div>
      ) : (
        <ul className="space-y-2 min-h-0 pb-4">
          {recentVisible.map((f) => (
            <FileRow
              key={f.id}
              file={{
                ...f,
                cursoNombre: f.cursoNombre || '—',
              }}
              isStarred={starredIds.includes(f.id)}
              onToggleStar={isTeacher ? toggleStar : undefined}
              isInTrash={trashIds.includes(f.id)}
              allowCourseTrash={f.cursoNombre !== 'Mi carpeta'}
            />
          ))}
        </ul>
      )}
      {!recentLoading && recentVisible.length > 0 ? (
        <p className="text-[11px] text-white/35 mt-2 shrink-0">
          Mostrando {recentVisible.length} archivo{recentVisible.length === 1 ? '' : 's'} más reciente
          {recentVisible.length === 1 ? '' : 's'} (máximo 10).
        </p>
      ) : null}
    </div>
  );

  return (
    <>
    <div className="flex-1 min-h-0 flex overflow-hidden min-w-0">
      <EvoDriveTrashContext.Provider value={evoDriveTrashContextValue}>
      <aside
        className="w-[220px] shrink-0 self-stretch flex flex-col border-r border-white/[0.08] overflow-y-auto"
        style={{ background: 'linear-gradient(180deg, #1E3A8A 0%, #0F172A 50%, #020617 100%)' }}
      >
        <div className="pt-5 pb-4 px-4 flex items-center gap-3 shrink-0">
          <div
            className="w-11 h-11 rounded-2xl bg-gradient-to-br from-sky-400 via-[#00c8ff] to-cyan-300 flex items-center justify-center shrink-0 shadow-lg shadow-sky-500/35 border border-white/25"
            aria-hidden
          >
            <FolderOpen className="w-6 h-6 text-white drop-shadow-sm" />
          </div>
          <span className="text-white font-semibold text-base tracking-tight font-['Poppins']">Evo Drive</span>
        </div>
        <section className="mb-4">
          <p className="text-[10px] uppercase font-bold text-white/30 tracking-widest mx-2 mb-2" style={{ letterSpacing: '0.12em' }}>Navegación</p>
          <button
            type="button"
            onClick={() => {
              setLibrarySection('all');
              setDriveMainView('overview');
            }}
            className={`w-[calc(100%-16px)] flex items-center justify-between px-3 py-2 rounded-xl mx-2 transition-colors text-left ${
              showAllFilesOverview ? 'text-white bg-[#3B82F6]/30 border border-white/20' : 'text-white/80 hover:bg-white/10'
            }`}
          >
            <span className="flex items-center gap-2">
              <FolderOpen className="w-4 h-4 text-white" />
              Todos los archivos
            </span>
            <span className="bg-[#3B82F6]/30 text-white border border-white/20 text-[10px] font-semibold px-2 rounded-full">
              {totalSidebarDriveFiles}
            </span>
          </button>
          <button
            type="button"
            onClick={() => {
              setLibrarySection('recent');
              setDriveMainView('browse');
            }}
            className={`w-[calc(100%-16px)] flex items-center gap-2 px-3 py-2 rounded-xl mx-2 transition-colors text-left ${librarySection === 'recent' ? 'text-white bg-[#3B82F6]/30 border border-white/20' : 'text-white/80 hover:bg-white/10'}`}
          >
            <FileText className="w-4 h-4 text-white" />
            Recientes
          </button>
          {isTeacher && (
            <button
              type="button"
              onClick={() => {
                setLibrarySection('trash');
                setDriveMainView('browse');
              }}
              onDragOver={(e) => {
                if (!e.dataTransfer.types.includes(EVO_DRIVE_FILE_DRAG_TYPE) && !e.dataTransfer.types.includes('text/plain')) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                setTrashDropActive(true);
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) setTrashDropActive(false);
              }}
              onDrop={(e) => {
                e.preventDefault();
                setTrashDropActive(false);
                const id =
                  e.dataTransfer.getData(EVO_DRIVE_FILE_DRAG_TYPE) || e.dataTransfer.getData('text/plain').trim();
                if (!id || trashIds.includes(id)) return;
                setTrashIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
                toast({ title: 'En la papelera', description: 'El archivo se ocultó de las carpetas. Restáuralo o elimínalo aquí.' });
                setLibrarySection('trash');
              }}
              className={`w-[calc(100%-16px)] flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl mx-2 transition-all text-left border ${
                trashDropActive
                  ? 'text-white bg-rose-500/35 border-rose-400/60 ring-2 ring-rose-400/40 scale-[1.02]'
                  : librarySection === 'trash'
                    ? 'text-white bg-[#3B82F6]/30 border-white/20'
                    : 'text-white/80 hover:bg-white/10 border-transparent'
              }`}
              title="Suelta aquí un archivo arrastrado o usa el menú contextual"
            >
              <span className="flex items-center gap-2 min-w-0">
                <Trash2 className="w-4 h-4 text-white shrink-0" />
                <span className="truncate">Papelera</span>
              </span>
              {trashIds.length > 0 ? (
                <span className="shrink-0 min-w-[22px] h-[22px] rounded-full bg-rose-600/90 text-white text-[11px] font-bold flex items-center justify-center px-1 border border-rose-400/50">
                  {trashIds.length > 99 ? '99+' : trashIds.length}
                </span>
              ) : null}
            </button>
          )}
        </section>
        <section className="mb-4">
          <p className="text-[10px] uppercase font-bold text-white/30 tracking-widest mx-2 mb-2" style={{ letterSpacing: '0.12em' }}>Cursos</p>
          {isProfesor &&
            professorCourses.map((course) => (
              <div key={course.groupId} className="mb-3">
                <p
                  className="text-[10px] uppercase font-bold text-white/40 tracking-widest mx-2 mb-1.5 truncate"
                  style={{ letterSpacing: '0.12em' }}
                  title={course.groupName}
                >
                  {course.groupName}
                </p>
                {course.folders.map((f) => {
                  const isActive =
                    !selectedFolder?.isTeacherPrivate &&
                    selectedFolder?.groupId === f.groupId &&
                    selectedFolder?.groupSubjectId === f.groupSubjectId;
                  const { materia } = parseTeacherFolderName(f.name);
                  return (
                    <button
                      key={f.groupSubjectId}
                      type="button"
                      onClick={() => {
                        const { curso } = parseTeacherFolderName(f.name);
                        setDriveMainView('browse');
                        setLibrarySection('all');
                        setSelectedFolder({
                          groupId: f.groupId,
                          groupSubjectId: f.groupSubjectId,
                          folderName: f.name,
                          groupName: curso || f.name,
                        });
                        scrollDriveElementIntoView(`evo-drive-subject-${f.groupSubjectId}`);
                      }}
                      className={`w-[calc(100%-16px)] flex items-center justify-between px-3 py-2 rounded-xl mx-2 text-left transition-colors ${isActive ? 'bg-[#3B82F6]/40 border border-white/20 text-white' : 'text-white/80 hover:bg-white/10'}`}
                    >
                      <span className="flex items-center gap-2 min-w-0 truncate">
                        <FolderOpen className="w-4 h-4 shrink-0 text-white" />
                        <span className="truncate">{materia}</span>
                      </span>
                      <span className="bg-white/20 text-white border border-white/20 text-[10px] font-semibold px-2 rounded-full shrink-0 ml-1">
                        <SidebarSubjectFileCount groupId={f.groupId} subjectId={f.groupSubjectId} />
                      </span>
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => {
                    setDriveMainView('browse');
                    setLibrarySection('all');
                    setSelectedFolder({
                      groupId: course.groupId,
                      groupSubjectId: EVO_TEACHER_PRIVATE_SENTINEL,
                      folderName: 'Mi carpeta (solo docente)',
                      groupName: course.groupName,
                      isTeacherPrivate: true,
                    });
                    scrollDriveElementIntoView(`evo-drive-course-${course.groupId}`);
                  }}
                  className={`w-[calc(100%-16px)] flex items-center justify-between px-3 py-2 rounded-xl mx-2 text-left transition-colors ${
                    selectedFolder?.isTeacherPrivate && selectedFolder.groupId === course.groupId
                      ? 'bg-violet-600/40 border border-violet-400/35 text-white'
                      : 'text-white/80 hover:bg-violet-500/15'
                  }`}
                >
                  <span className="flex items-center gap-2 min-w-0 truncate">
                    <Lock className="w-4 h-4 shrink-0 text-violet-300" />
                    <span className="truncate">Mi carpeta</span>
                  </span>
                  <span className="bg-violet-500/25 text-white border border-violet-400/30 text-[10px] font-semibold px-2 rounded-full shrink-0 ml-1">
                    <SidebarTeacherPrivateFileCount groupId={course.groupId} />
                  </span>
                </button>
              </div>
            ))}
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
                      onClick={() => {
                        setDriveMainView('browse');
                        setLibrarySection('all');
                        setSelectedFolder({ groupId: sub.groupId, groupSubjectId: sub.groupSubjectId, folderName: sub.name, groupName });
                        scrollDriveElementIntoView(`evo-drive-course-${sub.groupId}`);
                      }}
                      className={`w-[calc(100%-16px)] ml-6 flex items-center justify-between px-3 py-2 rounded-xl text-left transition-colors ${isActive ? 'bg-[#3B82F6]/40 border border-white/20 text-white' : 'text-white/80 hover:bg-white/10'}`}
                    >
                      <span className="flex items-center gap-2 min-w-0 truncate">
                        <FolderOpen className="w-4 h-4 shrink-0 text-white" />
                        <span className="truncate">{sub.name}</span>
                      </span>
                      <span className="bg-white/20 text-white border border-white/20 text-[10px] font-semibold px-2 rounded-full shrink-0 ml-1">
                        <SidebarSubjectFileCount groupId={sub.groupId} subjectId={sub.groupSubjectId} />
                      </span>
                    </button>
                  );
                })}
              </div>
            );
          })}
          {showPersonalMyFolder && user?.rol === 'estudiante' && (
            <button
              type="button"
              onClick={() => {
                setDriveMainView('browse');
                setSelectedFolder(null);
                setLibrarySection('all');
                setPersonalRootOpen(true);
                scrollDriveElementIntoView('evo-drive-personal-root');
              }}
              className={`w-[calc(100%-16px)] flex items-center justify-between px-3 py-2 rounded-xl mx-2 text-left transition-colors ${
                !selectedFolder && personalRootOpen
                  ? 'bg-amber-500/25 border border-amber-400/35 text-white'
                  : 'text-white/80 hover:bg-white/10'
              }`}
            >
              <span className="flex items-center gap-2 min-w-0 truncate">
                <FolderOpen className="w-4 h-4 shrink-0 text-[#ffd700]" />
                <span className="truncate">{personalFolderTitle}</span>
              </span>
              <span className="bg-white/20 text-white border border-white/20 text-[10px] font-semibold px-2 rounded-full shrink-0 ml-1">
                {myFolderFiles.length}
              </span>
            </button>
          )}
          {!isTeacher &&
            subjectFolders.map((folder) => {
              const isActive =
                !!selectedFolder &&
                !selectedFolder.isTeacherPrivate &&
                selectedFolder.groupSubjectId === folder.id &&
                selectedFolder.groupId === folder.groupId;
              return (
                <button
                  key={folder.id}
                  type="button"
                  onClick={() => {
                    setDriveMainView('browse');
                    setLibrarySection('all');
                    setPersonalRootOpen(false);
                    setSelectedFolder({
                      groupId: folder.groupId,
                      groupSubjectId: folder.id,
                      folderName: folder.name,
                      groupName: folder.groupName,
                    });
                    scrollDriveElementIntoView(`evo-drive-subject-${folder.id}`);
                  }}
                  className={`w-[calc(100%-16px)] flex items-center justify-between px-3 py-2 rounded-xl mx-2 text-left transition-colors ${
                    isActive ? 'bg-[#3B82F6]/40 border border-white/20 text-white' : 'text-white/80 hover:bg-white/10'
                  }`}
                >
                  <span className="flex items-center gap-2 min-w-0 truncate">
                    <FolderOpen className="w-4 h-4 shrink-0 text-white" />
                    <span className="truncate">{folder.name}</span>
                  </span>
                  <span className="bg-white/20 text-white border border-white/20 text-[10px] font-semibold px-2 rounded-full shrink-0 ml-1">
                    <SidebarSubjectFileCount groupId={folder.groupId} subjectId={folder.id} />
                  </span>
                </button>
              );
            })}
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
        {isTeacher && selectedFolder && !showAllFilesOverview && (
          <div className="shrink-0 px-6 pt-4">
            <Button
              type="button"
              variant="ghost"
              className="text-[#3B82F6] hover:text-[#2563EB] hover:bg-white/5 px-0"
              onClick={() => {
                if (selectedFolder.isTeacherPrivate) {
                  setLocation(`/course-detail/${selectedFolder.groupId}`);
                } else {
                  setLocation(`/course-detail/${selectedFolder.groupId}/materia/${selectedFolder.groupSubjectId}`);
                }
              }}
            >
              <ChevronRight className="w-4 h-4 mr-1 rotate-180" />
              Volver al curso
            </Button>
          </div>
        )}
        {isTeacher && selectedFolder && !isProfesor && !showAllFilesOverview && (
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

        {isTeacher && selectedFolder && !showAllFilesOverview && (
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

        {showAllFilesOverview ? (
          renderAllFilesOverview()
        ) : librarySection === 'recent' ? (
          renderRecentQuickAccess()
        ) : isProfesor ? (
          <>
            <div className="flex-1 p-6 overflow-auto space-y-4 min-h-0">
              <Card className="overflow-hidden border-[#00c8ff]/30 bg-[#00c8ff]/[0.06]">
                <Collapsible open={personalRootOpen} onOpenChange={setPersonalRootOpen}>
                  <CollapsibleTrigger asChild>
                    <button
                      type="button"
                      className="w-full flex items-center gap-3 p-4 text-left hover:bg-[#00c8ff]/10 transition-colors"
                    >
                      {personalRootOpen ? (
                        <ChevronDown className="w-5 h-5 text-[#00c8ff] shrink-0" />
                      ) : (
                        <ChevronRight className="w-5 h-5 text-[#00c8ff] shrink-0" />
                      )}
                      <FolderOpen className="w-6 h-6 text-[#00c8ff] shrink-0" />
                      <span className="font-semibold text-white truncate flex-1 text-left">{personalFolderTitle}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-[#00c8ff] hover:text-white hover:bg-white/10 shrink-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          setMyFolderTitleDraft(personalFolderTitle);
                          setMyFolderTitleEditOpen(true);
                        }}
                        aria-label="Renombrar carpeta"
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <span className="text-white/50 text-sm shrink-0">
                        {myFolderFiles.length} {myFolderFiles.length === 1 ? 'archivo' : 'archivos'}
                      </span>
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CardContent className="pt-0 pb-4">
                      <div className="pl-12 space-y-3">
                        <p className="text-xs text-[#00c8ff]/80">
                          Tu espacio personal (color cyan). Aquí subes archivos solo para ti, igual que el estudiante en su Evo Drive.
                        </p>
                        <div className="flex items-center gap-2 flex-wrap">
                          {!googleStatus.connected && (
                            <Button
                              onClick={connectGoogle}
                              variant="outline"
                              size="sm"
                              className="h-8 rounded-md border-[#00c8ff]/40 bg-[#00c8ff]/10 text-[#00c8ff] text-xs font-medium hover:bg-[#00c8ff]/20"
                            >
                              Conectar Google Drive
                            </Button>
                          )}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                size="sm"
                                className="h-9 rounded-full bg-[#00c8ff]/20 border border-[#00c8ff]/50 text-[#00c8ff] text-[13px] font-medium hover:bg-[#00c8ff]/30 px-4"
                              >
                                <Plus className="w-4 h-4 mr-2" />
                                Añadir o crear
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start" sideOffset={8} className="w-[230px] rounded-[14px] border-[#00c8ff]/20 bg-[#0f1c35] shadow-xl p-0 overflow-hidden">
                              <div className="py-2.5">
                                <DropdownMenuItem
                                  onSelect={() => googleStatus.connected && setTimeout(() => setMyFolderAddGoogleOpen(true), 50)}
                                  disabled={!googleStatus.connected}
                                  className="flex items-center gap-3 py-2.5 px-4 text-[13px] text-white/90 hover:bg-[#00c8ff]/10 focus:bg-[#00c8ff]/10 mx-0 rounded-none"
                                >
                                  <div className="w-8 h-8 rounded-[9px] bg-[#00c8ff]/20 flex items-center justify-center shrink-0">
                                    <Cloud className="w-4 h-4 text-[#00c8ff]" />
                                  </div>
                                  Google Drive
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onSelect={() => setTimeout(() => setMyFolderAddEvoOpen(true), 50)}
                                  className="flex items-center gap-3 py-2.5 px-4 text-[13px] text-white/90 hover:bg-[#00c8ff]/10 focus:bg-[#00c8ff]/10 mx-0 rounded-none"
                                >
                                  <div className="w-8 h-8 rounded-[9px] bg-[#00c8ff]/20 flex items-center justify-center shrink-0">
                                    <Link2 className="w-4 h-4 text-[#00c8ff]" />
                                  </div>
                                  Enlace
                                </DropdownMenuItem>
                              </div>
                              <div className="border-t border-[#00c8ff]/10" />
                              <div className="py-2">
                                <p className="px-4 pt-1.5 pb-1 text-[11px] uppercase tracking-wider text-[#00c8ff]/50">Crear</p>
                                <DropdownMenuItem
                                  onSelect={() =>
                                    setTimeout(() => {
                                      setMyFolderCreateNewType('doc');
                                      setMyFolderCreateNewNombre('');
                                      setMyFolderCreateNewOpen(true);
                                    }, 50)
                                  }
                                  className="flex items-center gap-3 py-2.5 px-4 text-[13px] text-white/90 hover:bg-[#00c8ff]/10 focus:bg-[#00c8ff]/10 mx-0 rounded-none"
                                >
                                  <div className="w-8 h-8 rounded-[9px] bg-[#1a56d6] flex items-center justify-center shrink-0">
                                    <FileText className="w-4 h-4 text-white" />
                                  </div>
                                  Documentos
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onSelect={() =>
                                    setTimeout(() => {
                                      setMyFolderCreateNewType('slide');
                                      setMyFolderCreateNewNombre('');
                                      setMyFolderCreateNewOpen(true);
                                    }, 50)
                                  }
                                  className="flex items-center gap-3 py-2.5 px-4 text-[13px] text-white/90 hover:bg-[#00c8ff]/10 focus:bg-[#00c8ff]/10 mx-0 rounded-none"
                                >
                                  <div className="w-8 h-8 rounded-[9px] bg-[#d97706] flex items-center justify-center shrink-0">
                                    <Presentation className="w-4 h-4 text-white" />
                                  </div>
                                  Presentaciones
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onSelect={() =>
                                    setTimeout(() => {
                                      setMyFolderCreateNewType('sheet');
                                      setMyFolderCreateNewNombre('');
                                      setMyFolderCreateNewOpen(true);
                                    }, 50)
                                  }
                                  className="flex items-center gap-3 py-2.5 px-4 text-[13px] text-white/90 hover:bg-[#00c8ff]/10 focus:bg-[#00c8ff]/10 mx-0 rounded-none"
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
                          <p className="text-white/50 text-sm py-2">
                            Aún no hay archivos. Usa &quot;Añadir o crear&quot; para agregar enlaces o crear documentos en tu Drive.
                          </p>
                        ) : (
                          <ul className="space-y-2">
                            {myFolderFiles.map((f) => (
                              <li
                                key={f.id}
                                className="group flex items-center justify-between gap-4 py-2 px-3 rounded-lg bg-white/5 border border-white/10 hover:border-[#00c8ff]/25"
                              >
                                <div className="flex items-center gap-3 min-w-0 flex-1">
                                  <div className="w-8 h-8 rounded-lg bg-[#00c8ff]/20 flex items-center justify-center shrink-0">
                                    {f.origen === 'google' ? (
                                      <FileText className="w-4 h-4 text-[#00c8ff]" />
                                    ) : (
                                      <Link2 className="w-4 h-4 text-[#00c8ff]" />
                                    )}
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <p className="text-sm font-medium text-white truncate">{f.nombre}</p>
                                    {(f.url || f.googleWebViewLink) && (
                                      <a
                                        href={f.url || f.googleWebViewLink || '#'}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-[11px] text-[#00c8ff] hover:underline truncate block"
                                      >
                                        Abrir
                                      </a>
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="text-white/60 hover:text-white h-8 w-8 p-0"
                                    onClick={() => {
                                      setRenamePersonalFileId(f.id);
                                      setRenamePersonalNombre(f.nombre);
                                    }}
                                    aria-label="Renombrar"
                                  >
                                    <Pencil className="w-4 h-4" />
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="text-white/60 hover:text-white h-8 w-8 p-0"
                                    onClick={() => deleteFromMyFolderMutation.mutate(f.id)}
                                    disabled={deleteFromMyFolderMutation.isPending}
                                    aria-label="Quitar"
                                  >
                                    <X className="w-4 h-4" />
                                  </Button>
                                </div>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </CardContent>
                  </CollapsibleContent>
                </Collapsible>
              </Card>

              {selectedFolder?.isTeacherPrivate && (
                <div className="rounded-xl border border-violet-500/35 bg-violet-950/25 p-4 space-y-3">
                  <p className="text-sm text-violet-100 flex items-start gap-2">
                    <Lock className="w-4 h-4 shrink-0 mt-0.5 text-violet-300" />
                    <span>
                      <strong className="text-white">Mi carpeta</strong> en <strong>{selectedFolder.groupName}</strong> — solo tú ves estos
                      materiales; los estudiantes no tienen acceso.
                    </span>
                  </p>
                  {filesLoadingSource ? (
                    <Skeleton className="h-12 w-full bg-violet-900/40 rounded-lg" />
                  ) : filesSource.length === 0 ? (
                    <p className="text-violet-200/70 text-sm pl-6">Sin archivos. Usa &quot;Añadir o crear&quot; en la barra superior.</p>
                  ) : (
                    <ul className="space-y-2 pl-6">
                      {filesSource.map((f) => (
                        <FileRow key={f.id} file={f} allowCourseTrash={false} />
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {teacherFolders.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center rounded-xl border border-white/10 bg-white/[0.03]">
                  <FolderOpen className="w-12 h-12 text-white/30 mb-4" />
                  <p className="text-white/70 font-medium">Sin cursos asignados</p>
                  <p className="text-white/50 text-sm mt-1 max-w-md px-4">
                    Cuando te asignen materias y grupos, verás aquí una carpeta por cada curso con las materias que impartes.
                  </p>
                </div>
              ) : (
                professorCourses.map((course) => (
                  <ProfessorCourseBlock
                    key={course.groupId}
                    groupId={course.groupId}
                    groupName={course.groupName}
                    folders={course.folders}
                    selectedGroupSubjectId={selectedFolder?.groupSubjectId}
                    selectedTeacherPrivate={
                      selectedFolder?.isTeacherPrivate === true && selectedFolder.groupId === course.groupId
                    }
                    onSelectFolder={(tf) => {
                      const { curso } = parseTeacherFolderName(tf.name);
                      setSelectedFolder({
                        groupId: tf.groupId,
                        groupSubjectId: tf.groupSubjectId,
                        folderName: tf.name,
                        groupName: curso || tf.name,
                      });
                    }}
                    onSelectTeacherPrivate={(gid, gname) => {
                      setSelectedFolder({
                        groupId: gid,
                        groupSubjectId: EVO_TEACHER_PRIVATE_SENTINEL,
                        folderName: 'Mi carpeta (solo docente)',
                        groupName: gname,
                        isTeacherPrivate: true,
                      });
                    }}
                  />
                ))
              )}
            </div>
          </>
        ) : isTeacher ? (
          <>
            <div className="flex-1 p-6 overflow-auto">
              {librarySection === 'trash' && (
                <div className="mb-6 rounded-xl border border-rose-500/30 bg-rose-950/20 px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <h2 className="text-white font-semibold font-['Poppins'] flex items-center gap-2">
                      <Trash2 className="w-5 h-5 text-rose-300" />
                      Papelera
                    </h2>
                    <p className="text-sm text-white/55 mt-1 max-w-xl">
                      Los documentos dejan de mostrarse en las carpetas del curso. Para borrarlos del servidor, usa{' '}
                      <strong className="text-white/80">Eliminar definitivamente</strong> (clic derecho o botón en la fila).
                    </p>
                  </div>
                  {trashIds.length > 0 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={deleteEvoFileMutation.isPending}
                      className="border-rose-500/50 text-rose-100 hover:bg-rose-500/20 shrink-0"
                      onClick={() => {
                        if (
                          !window.confirm(
                            `¿Eliminar permanentemente ${trashIds.length} archivo(s) de Evo Drive? Esta acción no se puede deshacer.`
                          )
                        ) {
                          return;
                        }
                        const ids = [...trashIds];
                        void (async () => {
                          for (const id of ids) {
                            try {
                              await apiRequest('DELETE', `/api/evo-drive/files/${encodeURIComponent(id)}`);
                            } catch {
                              /* continuar con el resto */
                            }
                          }
                          setTrashIds([]);
                          queryClient.invalidateQueries({ queryKey: ['evo-drive'] });
                          toast({ title: 'Papelera vaciada', description: 'Se procesó la eliminación en el servidor.' });
                        })();
                      }}
                    >
                      Vaciar papelera (definitivo)
                    </Button>
                  )}
                </div>
              )}
              {!selectedFolder && librarySection !== 'trash' ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <FolderOpen className="w-12 h-12 text-white/30 mb-4" />
                  <p className="text-white/70 font-medium">Selecciona una carpeta</p>
                  <p className="text-white/50 text-sm mt-1">Elige una materia — curso en el sidebar para ver y gestionar archivos.</p>
                </div>
              ) : filesLoadingSource ? (
                <div className="space-y-3">
                  <Skeleton className="h-[72px] w-full rounded-xl bg-[#1E3A8A]/30" />
                  <Skeleton className="h-[72px] w-full rounded-xl bg-[#1E3A8A]/30" />
                </div>
              ) : librarySection === 'trash' && allFiles.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center rounded-xl border border-white/10 bg-white/[0.03]">
                  <Trash2 className="w-12 h-12 text-white/25 mb-3" />
                  <p className="text-white/65 font-medium">La papelera está vacía</p>
                  <p className="text-white/45 text-sm mt-1 max-w-md">
                    Arrastra un archivo aquí en el sidebar, usa el menú contextual (clic derecho) o el icono de papelera en la fila.
                  </p>
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
                      onDeletePermanent={
                        librarySection === 'trash'
                          ? (id) => {
                              if (!window.confirm('¿Eliminar este archivo permanentemente de Evo Drive?')) return;
                              deleteEvoFileMutation.mutate(id, {
                                onSuccess: () => setTrashIds((prev) => prev.filter((x) => x !== id)),
                              });
                            }
                          : undefined
                      }
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
                        <th className="text-[11px] uppercase text-white/40 font-semibold py-2.5 px-4 text-right w-[120px]">Acciones</th>
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
                          onOpenTrash={() => setLibrarySection('trash')}
                          onDeletePermanent={
                            librarySection === 'trash'
                              ? (id) => {
                                  if (!window.confirm('¿Eliminar este archivo permanentemente de Evo Drive?')) return;
                                  deleteEvoFileMutation.mutate(id, {
                                    onSuccess: () => setTrashIds((prev) => prev.filter((x) => x !== id)),
                                  });
                                }
                              : undefined
                          }
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {selectedFolder && !filesLoadingSource && librarySection !== 'trash' && (
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
              <Card id="evo-drive-personal-root" className="overflow-hidden border-white/10 bg-white/[0.04] scroll-mt-4">
                <Collapsible open={personalRootOpen} onOpenChange={setPersonalRootOpen}>
                  <CollapsibleTrigger asChild>
                    <button
                      type="button"
                      className="w-full flex items-center gap-3 p-4 text-left hover:bg-white/5 transition-colors"
                    >
                      {personalRootOpen ? (
                        <ChevronDown className="w-5 h-5 text-[#ffd700] shrink-0" />
                      ) : (
                        <ChevronRight className="w-5 h-5 text-[#ffd700] shrink-0" />
                      )}
                      <FolderOpen className="w-6 h-6 text-[#ffd700] shrink-0" />
                      <span className="font-semibold text-white truncate flex-1 text-left">{personalFolderTitle}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-[#ffd700] hover:text-white hover:bg-white/10 shrink-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          setMyFolderTitleDraft(personalFolderTitle);
                          setMyFolderTitleEditOpen(true);
                        }}
                        aria-label="Renombrar carpeta"
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <span className="text-white/50 text-sm shrink-0">
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
                                <div className="flex items-center gap-1 shrink-0">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="text-white/60 hover:text-white hover:bg-white/10 h-8 w-8 p-0"
                                    onClick={() => {
                                      setRenamePersonalFileId(f.id);
                                      setRenamePersonalNombre(f.nombre);
                                    }}
                                    aria-label="Renombrar"
                                  >
                                    <Pencil className="w-4 h-4" />
                                  </Button>
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
                                </div>
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
                subjectFolders.map((folder) => (
                  <SubjectFolder
                    key={folder.id}
                    folder={folder}
                    subjectSelected={
                      !!selectedFolder &&
                      !selectedFolder.isTeacherPrivate &&
                      selectedFolder.groupSubjectId === folder.id &&
                      selectedFolder.groupId === folder.groupId
                    }
                  />
                ))
              )}
              </div>
            </>
          )}
        </main>
      </EvoDriveTrashContext.Provider>
    </div>

    {/* Agregar desde Google Drive */}
      <Dialog open={addFromGoogleOpen} onOpenChange={setAddFromGoogleOpen}>
        <DialogContent className="bg-[#0b1120] border border-white/[0.1] w-[min(96vw,920px)] max-w-[920px] max-h-[min(90vh,760px)] p-0 gap-0 flex flex-col rounded-2xl overflow-hidden shadow-2xl shadow-black/60 data-[state=open]:animate-in data-[state=open]:zoom-in-95 [&+[data-radix-dialog-overlay]]:bg-black/55">
          <DialogHeader className="px-6 sm:px-8 pt-6 pb-4 border-b border-white/[0.07] shrink-0 bg-gradient-to-r from-[#0c1929] via-[#0f172a] to-[#0c1322]">
            <DialogTitle className="text-white flex items-start sm:items-center gap-4 pr-8">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-sky-400 via-[#00c8ff] to-cyan-300 flex items-center justify-center shrink-0 shadow-lg shadow-sky-500/30 border border-white/20">
                <Cloud className="w-7 h-7 text-white drop-shadow-sm" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-lg sm:text-xl font-semibold text-white block font-['Poppins'] tracking-tight">
                  Tu Google Drive
                </span>
                <span className="text-sm text-white/55 mt-1 block leading-snug">
                  Busca por nombre y vincula archivos con icono y tipo visibles. Solo tú ves tu cuenta de Google.
                </span>
              </div>
            </DialogTitle>
          </DialogHeader>
          {googleDriveDisconnectedInModal ? (
            <div className="space-y-4 px-6 sm:px-8 py-6">
              <p className="text-white/65 text-sm leading-relaxed">
                {googleFilesError ? 'Google Drive se desconectó. Reconéctalo para seguir usando tus archivos.' : 'Conecta Google Drive para agregar archivos desde tu cuenta.'}
              </p>
              <Button type="button" onClick={connectGoogle} className="w-full rounded-xl border border-[#22c55e]/40 bg-[#22c55e]/10 text-[#22c55e] hover:bg-[#22c55e]/20 font-medium h-11">
                <Cloud className="w-4 h-4 mr-2" />
                Reconectar Google Drive
              </Button>
              <p className="text-white/40 text-xs">Serás redirigido a Google y volverás aquí sin cerrar sesión.</p>
            </div>
          ) : !selectedFolder ||
            (!selectedFolder.isTeacherPrivate && !selectedFolder.groupSubjectId) ? (
            <p className="text-white/65 text-sm px-6 sm:px-8 py-8 leading-relaxed">
              Selecciona una materia o la carpeta <strong className="text-white/90">Mi carpeta</strong> (solo docente) en
              el panel lateral.
            </p>
          ) : (
            <div className="flex flex-col flex-1 min-h-0 px-6 sm:px-8 pt-5 pb-2 gap-4">
              <div className="space-y-2 shrink-0">
                <Label className="text-xs font-semibold text-white/50 uppercase tracking-wider">Buscar en tu Drive</Label>
                <div className="relative">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/35 pointer-events-none" />
                  <Input
                    value={googleSearch}
                    onChange={(e) => setGoogleSearch(e.target.value)}
                    placeholder="Nombre del archivo, carpeta o tipo…"
                    className="bg-white/[0.06] border border-white/[0.1] rounded-xl py-3 pl-10 pr-3 text-sm text-white placeholder:text-white/45 focus:border-[#00c8ff]/40 focus:ring-1 focus:ring-[#00c8ff]/20"
                  />
                </div>
              </div>
              <ScrollArea className="min-h-[min(52vh,520px)] max-h-[min(52vh,520px)] rounded-xl border border-white/[0.08] bg-[#020617]/80">
                <div className="p-3 sm:p-4">
                  {googleFilesLoading ? (
                    <div className="space-y-3">
                      {Array.from({ length: 6 }).map((_, i) => (
                        <Skeleton key={i} className="h-[72px] w-full bg-white/[0.08] rounded-xl" />
                      ))}
                    </div>
                  ) : googleFiles.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                      <div className="w-14 h-14 rounded-2xl bg-white/[0.06] border border-white/10 flex items-center justify-center mb-3">
                        <FolderOpen className="w-7 h-7 text-white/30" />
                      </div>
                      <p className="text-white/70 text-sm font-medium">Sin resultados</p>
                      <p className="text-white/45 text-xs mt-1 max-w-sm">
                        Escribe en el buscador para listar archivos de tu Google Drive.
                      </p>
                    </div>
                  ) : (
                    <ul className="space-y-2">
                      {googleFiles.map((gf) => (
                        <GoogleDrivePickerRow
                          key={gf.id}
                          file={gf}
                          onAdd={handleAddFromGoogle}
                          addPending={addFileMutation.isPending}
                          buttonClassName="shrink-0 rounded-xl border-[#00c8ff]/40 bg-[#00c8ff]/15 text-[#7dd3fc] hover:bg-[#00c8ff]/25 font-medium px-4"
                        />
                      ))}
                    </ul>
                  )}
                </div>
              </ScrollArea>
            </div>
          )}
          <DialogFooter className="gap-2 px-6 sm:px-8 py-4 border-t border-white/[0.07] shrink-0 bg-[#0a0f1a]/90">
            <Button
              variant="outline"
              onClick={() => setAddFromGoogleOpen(false)}
              className="border border-white/15 bg-white/[0.04] text-[13px] font-medium text-white/80 hover:bg-white/10 rounded-xl"
            >
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
        <DialogContent className="bg-[#0b1120] border border-white/[0.1] w-[min(96vw,920px)] max-w-[920px] max-h-[min(90vh,760px)] p-0 gap-0 flex flex-col rounded-2xl overflow-hidden shadow-2xl shadow-black/60 [&+[data-radix-dialog-overlay]]:bg-black/55">
          <DialogHeader className="px-6 sm:px-8 pt-6 pb-4 border-b border-white/[0.07] shrink-0 bg-gradient-to-r from-amber-950/40 via-[#0f172a] to-[#0c1322]">
            <DialogTitle className="text-white flex items-start sm:items-center gap-4 pr-8">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400 via-[#ffd700] to-amber-200 flex items-center justify-center shrink-0 shadow-lg shadow-amber-500/25 border border-white/20">
                <Cloud className="w-7 h-7 text-amber-950 drop-shadow-sm" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-lg sm:text-xl font-semibold text-white block font-['Poppins'] tracking-tight">
                  Tu Google Drive
                </span>
                <span className="text-sm text-white/55 mt-1 block leading-snug">
                  Los archivos que elijas se añaden a <strong className="text-[#fde68a]">Mi carpeta</strong> personal.
                </span>
              </div>
            </DialogTitle>
          </DialogHeader>
          {myFolderGoogleDriveDisconnected ? (
            <div className="space-y-4 px-6 sm:px-8 py-6">
              <p className="text-white/65 text-sm leading-relaxed">
                {myFolderGoogleFilesError ? 'Google Drive se desconectó. Reconéctalo para usar tus archivos.' : 'Conecta Google Drive para usar tus archivos.'}
              </p>
              <Button type="button" onClick={connectGoogle} className="w-full rounded-xl border border-[#22c55e]/40 bg-[#22c55e]/10 text-[#22c55e] hover:bg-[#22c55e]/20 font-medium h-11">
                <Cloud className="w-4 h-4 mr-2" />
                Reconectar Google Drive
              </Button>
              <p className="text-white/40 text-xs">Serás redirigido a Google y volverás aquí sin cerrar sesión.</p>
            </div>
          ) : (
            <>
              <div className="flex flex-col flex-1 min-h-0 px-6 sm:px-8 pt-5 pb-2 gap-4">
                <div className="space-y-2 shrink-0">
                  <Label className="text-xs font-semibold text-white/50 uppercase tracking-wider">Buscar en tu Drive</Label>
                  <div className="relative">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-amber-400/50 pointer-events-none" />
                    <Input
                      value={myFolderGoogleSearch}
                      onChange={(e) => setMyFolderGoogleSearch(e.target.value)}
                      placeholder="Nombre del archivo, carpeta o tipo…"
                      className="bg-white/[0.06] border border-amber-500/15 rounded-xl py-3 pl-10 pr-3 text-sm text-white placeholder:text-white/45 focus:border-amber-400/35 focus:ring-1 focus:ring-amber-400/15"
                    />
                  </div>
                </div>
                <ScrollArea className="min-h-[min(52vh,520px)] max-h-[min(52vh,520px)] rounded-xl border border-amber-500/10 bg-[#020617]/80">
                  <div className="p-3 sm:p-4">
                    {myFolderGoogleFilesLoading ? (
                      <div className="space-y-3">
                        {Array.from({ length: 6 }).map((_, i) => (
                          <Skeleton key={i} className="h-[72px] w-full bg-white/[0.08] rounded-xl" />
                        ))}
                      </div>
                    ) : myFolderGoogleFiles.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                        <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-3">
                          <FolderOpen className="w-7 h-7 text-amber-400/40" />
                        </div>
                        <p className="text-white/70 text-sm font-medium">Sin resultados</p>
                        <p className="text-white/45 text-xs mt-1 max-w-sm">
                          Escribe en el buscador para listar archivos de tu Google Drive.
                        </p>
                      </div>
                    ) : (
                      <ul className="space-y-2">
                        {myFolderGoogleFiles.map((gf) => (
                          <GoogleDrivePickerRow
                            key={gf.id}
                            file={gf}
                            onAdd={handleMyFolderAddFromGoogle}
                            addPending={addToMyFolderMutation.isPending}
                            buttonClassName="shrink-0 rounded-xl border-amber-500/50 bg-amber-500/15 text-amber-200 hover:bg-amber-500/25 font-medium px-4"
                          />
                        ))}
                      </ul>
                    )}
                  </div>
                </ScrollArea>
              </div>
              <DialogFooter className="gap-2 px-6 sm:px-8 py-4 border-t border-white/[0.07] shrink-0 bg-[#0a0f1a]/90">
                <Button
                  variant="outline"
                  onClick={() => setMyFolderAddGoogleOpen(false)}
                  className="border border-white/15 bg-white/[0.04] text-[13px] font-medium text-white/80 hover:bg-white/10 rounded-xl"
                >
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

      <Dialog open={myFolderTitleEditOpen} onOpenChange={setMyFolderTitleEditOpen}>
        <DialogContent className="bg-[#0f172a] border border-white/10 max-w-[380px] rounded-2xl p-6 shadow-xl">
          <DialogHeader>
            <DialogTitle className="text-white">Nombre de la carpeta</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 mt-2">
            <Label className="text-xs text-white/60">Visible solo para ti en este dispositivo</Label>
            <Input
              value={myFolderTitleDraft}
              onChange={(e) => setMyFolderTitleDraft(e.target.value)}
              placeholder="Mi carpeta"
              className="bg-white/5 border border-white/10 rounded-md text-white"
            />
          </div>
          <DialogFooter className="gap-2 mt-4 flex-row justify-end">
            <Button variant="outline" className="border-white/10 text-white/80" onClick={() => setMyFolderTitleEditOpen(false)}>
              Cancelar
            </Button>
            <Button
              className="bg-[#1e3cff] hover:opacity-90 text-white"
              onClick={() => {
                const t = myFolderTitleDraft.trim() || 'Mi carpeta';
                if (user?.id) {
                  try {
                    localStorage.setItem(`${MY_FOLDER_TITLE_STORAGE_PREFIX}${user.id}`, t);
                  } catch {
                    /* ignore */
                  }
                }
                setPersonalFolderTitle(t);
                setMyFolderTitleEditOpen(false);
              }}
            >
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!renamePersonalFileId} onOpenChange={(o) => !o && setRenamePersonalFileId(null)}>
        <DialogContent className="bg-[#0f172a] border border-white/10 max-w-[380px] rounded-2xl p-6 shadow-xl">
          <DialogHeader>
            <DialogTitle className="text-white">Renombrar archivo</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 mt-2">
            <Input
              value={renamePersonalNombre}
              onChange={(e) => setRenamePersonalNombre(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-md text-white"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && renamePersonalFileId && renamePersonalNombre.trim()) {
                  patchPersonalFileMutation.mutate({ id: renamePersonalFileId, nombre: renamePersonalNombre.trim() });
                }
              }}
            />
          </div>
          <DialogFooter className="gap-2 mt-4 flex-row justify-end">
            <Button variant="outline" className="border-white/10 text-white/80" onClick={() => setRenamePersonalFileId(null)}>
              Cancelar
            </Button>
            <Button
              className="bg-[#1e3cff] hover:opacity-90 text-white"
              disabled={!renamePersonalFileId || !renamePersonalNombre.trim() || patchPersonalFileMutation.isPending}
              onClick={() => {
                if (renamePersonalFileId && renamePersonalNombre.trim()) {
                  patchPersonalFileMutation.mutate({ id: renamePersonalFileId, nombre: renamePersonalNombre.trim() });
                }
              }}
            >
              Guardar
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
  allowCourseTrash = true,
  onToggleStar,
  onToggleTrash,
  onOpenTrash,
  onDeletePermanent,
}: {
  file: EvoFile;
  isNew?: boolean;
  variant?: 'grid' | 'list';
  isStarred?: boolean;
  isInTrash?: boolean;
  /** Si es false, no se ofrece papelera (p. ej. Mi carpeta privada del docente). */
  allowCourseTrash?: boolean;
  onToggleStar?: (id: string) => void;
  onToggleTrash?: (id: string) => void;
  /** Tras enviar a la papelera, activa la sección Papelera (sidebar). */
  onOpenTrash?: () => void;
  /** Solo en vista Papelera: borrado permanente en servidor. */
  onDeletePermanent?: (id: string) => void;
}) {
  const trashCtx = useContext(EvoDriveTrashContext);
  const allowTrash = allowCourseTrash !== false && trashCtx?.canManageTrash === true;
  const effectiveToggleTrash =
    onToggleTrash ?? (allowTrash && trashCtx ? trashCtx.toggleTrash : undefined);
  const effectiveOpenTrash =
    onOpenTrash ?? (allowTrash && trashCtx ? trashCtx.openTrashSection : undefined);

  const link = file.googleWebViewLink || file.evoStorageUrl || '#';
  const isGoogle = file.origen === 'google';
  const style = FILE_TYPE_STYLES[file.tipo] || defaultStyle;
  const hex = style.hex || style.color;

  const draggable = Boolean(effectiveToggleTrash && !isInTrash);
  const onDragStart = (e: React.DragEvent) => {
    if (!draggable) return;
    e.dataTransfer.setData(EVO_DRIVE_FILE_DRAG_TYPE, file.id);
    e.dataTransfer.setData('text/plain', file.id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const moveToTrash = () => {
    if (!effectiveToggleTrash) return;
    if (!isInTrash) {
      effectiveToggleTrash(file.id);
      effectiveOpenTrash?.();
    } else {
      effectiveToggleTrash(file.id);
    }
  };

  const cmItem =
    'text-white/90 focus:bg-white/10 focus:text-white cursor-pointer data-[highlighted]:bg-white/10 data-[highlighted]:text-white';

  const contextMenuBody = (
    <>
      {link !== '#' && (
        <ContextMenuItem
          className={cmItem}
          onSelect={() => window.open(link, '_blank', 'noopener,noreferrer')}
        >
          <ExternalLink className="mr-2 h-4 w-4 shrink-0" />
          Abrir
        </ContextMenuItem>
      )}
      {onToggleStar && (
        <ContextMenuItem className={cmItem} onSelect={() => onToggleStar(file.id)}>
          <Star className={`mr-2 h-4 w-4 shrink-0 ${isStarred ? 'text-amber-400' : ''}`} />
          {isStarred ? 'Quitar de destacados' : 'Destacar'}
        </ContextMenuItem>
      )}
      {((link !== '#' || !!onToggleStar) &&
        (!!effectiveToggleTrash || (!!onDeletePermanent && isInTrash))) && (
        <ContextMenuSeparator className="bg-white/10" />
      )}
      {effectiveToggleTrash && !isInTrash && (
        <ContextMenuItem className={cmItem} onSelect={moveToTrash}>
          <Trash2 className="mr-2 h-4 w-4 shrink-0" />
          Mover a la papelera
        </ContextMenuItem>
      )}
      {effectiveToggleTrash && isInTrash && (
        <ContextMenuItem
          className={cmItem}
          onSelect={() => {
            effectiveToggleTrash(file.id);
          }}
        >
          <RotateCcw className="mr-2 h-4 w-4 shrink-0" />
          Restaurar
        </ContextMenuItem>
      )}
      {onDeletePermanent && isInTrash && (
        <ContextMenuItem
          className={`${cmItem} text-rose-300 focus:text-rose-200 focus:bg-rose-500/20`}
          onSelect={() => onDeletePermanent(file.id)}
        >
          <Trash2 className="mr-2 h-4 w-4 shrink-0" />
          Eliminar definitivamente
        </ContextMenuItem>
      )}
    </>
  );

  const contextMenuWrap = (child: React.ReactElement) => (
    <ContextMenu>
      <ContextMenuTrigger asChild>{child}</ContextMenuTrigger>
      <ContextMenuContent className="min-w-[220px] border-white/10 bg-[#0f172a]/98 text-white">{contextMenuBody}</ContextMenuContent>
    </ContextMenu>
  );

  if (variant === 'grid') {
    const gridInner = (
      <div
        className={`flex flex-col items-center gap-1.5 outline-none ${draggable ? 'cursor-grab active:cursor-grabbing' : ''}`}
        draggable={draggable}
        onDragStart={onDragStart}
      >
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
            {effectiveToggleTrash && (
              <button
                type="button"
                className="w-7 h-7 rounded-xl flex items-center justify-center text-white/80 hover:bg-white/10"
                aria-label={isInTrash ? 'Restaurar desde la papelera' : 'Mover a la papelera'}
                onClick={(e) => {
                  e.stopPropagation();
                  moveToTrash();
                }}
              >
                {isInTrash ? <RotateCcw className="w-4 h-4" /> : <Trash2 className="w-4 h-4" />}
              </button>
            )}
            {onDeletePermanent && isInTrash && (
              <button
                type="button"
                className="w-7 h-7 rounded-xl flex items-center justify-center text-rose-300 hover:bg-rose-500/20"
                aria-label="Eliminar definitivamente"
                onClick={(e) => {
                  e.stopPropagation();
                  onDeletePermanent(file.id);
                }}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
        <p className="text-[12px] text-white/70 font-medium text-center leading-tight truncate max-w-[90px]">{file.nombre}</p>
        <p className="text-[10.5px] text-white/30 text-center">{file.cursoNombre}</p>
      </div>
    );
    return contextMenuWrap(gridInner);
  }

  if (variant === 'list') {
    const row = (
      <tr
        className={`border-b border-white/10 hover:bg-[#1E3A8A]/30 transition-colors ${draggable ? 'cursor-grab active:cursor-grabbing' : ''}`}
        draggable={draggable}
        onDragStart={onDragStart}
      >
        <td className="py-2.5 px-4">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${hex}26` }}>
              {style.icon}
            </div>
            <span className="text-white font-medium truncate">{file.nombre}</span>
          </div>
        </td>
        <td className="py-2.5 px-4 text-[#E2E8F0]/70">{file.cursoNombre}</td>
        <td className="py-2.5 px-4 text-[#E2E8F0]/70">{file.tipo}</td>
        <td className="py-2.5 px-4 text-[#E2E8F0]/70">—</td>
        <td className="py-2.5 px-4 text-[#E2E8F0]/70">—</td>
        <td className="py-2.5 px-4 text-right">
          <div className="inline-flex items-center justify-end gap-1">
            {link !== '#' && (
              <a
                href={link}
                target="_blank"
                rel="noopener noreferrer"
                className="w-8 h-8 rounded-lg flex items-center justify-center text-white/70 hover:bg-white/10"
                aria-label="Abrir"
                onClick={(e) => e.stopPropagation()}
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            )}
            {onToggleStar && (
              <button
                type="button"
                className={`w-8 h-8 rounded-lg flex items-center justify-center ${isStarred ? 'text-amber-400' : 'text-white/70 hover:bg-white/10'}`}
                aria-label="Destacar"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleStar(file.id);
                }}
              >
                <Star className="w-4 h-4" />
              </button>
            )}
            {effectiveToggleTrash && (
              <button
                type="button"
                className={`w-8 h-8 rounded-lg flex items-center justify-center ${isInTrash ? 'text-rose-300' : 'text-white/70 hover:bg-white/10'}`}
                aria-label={isInTrash ? 'Restaurar' : 'Mover a la papelera'}
                onClick={(e) => {
                  e.stopPropagation();
                  moveToTrash();
                }}
              >
                {isInTrash ? <RotateCcw className="w-4 h-4" /> : <Trash2 className="w-4 h-4" />}
              </button>
            )}
            {onDeletePermanent && isInTrash && (
              <button
                type="button"
                className="w-8 h-8 rounded-lg flex items-center justify-center text-rose-400 hover:bg-rose-500/20"
                aria-label="Eliminar definitivamente"
                onClick={(e) => {
                  e.stopPropagation();
                  onDeletePermanent(file.id);
                }}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </td>
      </tr>
    );
    return contextMenuWrap(row);
  }

  const listItem = (
    <li
      className={`group flex items-center justify-between gap-4 py-[13px] px-4 rounded-xl border transition-colors outline-none ${
        isNew ? 'border-white/20 bg-white/[0.06] animate-in fade-in slide-in-from-top-2 duration-300' : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.06] hover:border-white/20'
      } ${draggable ? 'cursor-grab active:cursor-grabbing' : ''}`}
      draggable={draggable}
      onDragStart={onDragStart}
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
        {effectiveToggleTrash && (
          <button
            type="button"
            className={`w-[30px] h-[30px] rounded-lg flex items-center justify-center transition-colors ${
              isInTrash ? 'text-rose-400 bg-rose-500/10' : 'text-[#E2E8F0]/70 hover:bg-[#1E3A8A]/50 hover:text-white'
            }`}
            aria-label={isInTrash ? 'Restaurar desde la papelera' : 'Mover a la papelera'}
            onClick={moveToTrash}
          >
            {isInTrash ? <RotateCcw className="w-4 h-4" /> : <Trash2 className="w-4 h-4" />}
          </button>
        )}
        {onDeletePermanent && isInTrash && (
          <button
            type="button"
            className="w-[30px] h-[30px] rounded-lg flex items-center justify-center text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 transition-colors"
            aria-label="Eliminar definitivamente"
            onClick={() => onDeletePermanent(file.id)}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>
    </li>
  );
  return contextMenuWrap(listItem);
}
