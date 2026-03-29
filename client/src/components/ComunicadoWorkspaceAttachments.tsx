import React, { useState, useEffect, useMemo, type Dispatch, type SetStateAction } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  ChevronDown,
  ChevronRight,
  Cloud,
  ExternalLink,
  File,
  FileText,
  FolderOpen,
  Image as ImageIcon,
  Link2,
  Loader2,
  Lock,
  Presentation,
  Plus,
  Table2,
  X,
} from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import type { ComunicadoAttachment } from '@/lib/comunicadoAttachments';

interface EvoDriveFileRow {
  id: string;
  nombre: string;
  tipo?: string;
  mimeType?: string;
  googleMimeType?: string;
  origen?: string;
  googleWebViewLink?: string;
  evoStorageUrl?: string;
  googleFileId?: string;
}

interface GoogleDriveFileRow {
  id: string;
  name: string;
  mimeType?: string;
  webViewLink?: string;
}

interface FlatFolderRow {
  id: string;
  name: string;
  groupId: string;
  groupSubjectId: string;
}

interface NestedGroup {
  id: string;
  name: string;
  groupSubjects?: { id: string; name: string; groupId: string; groupSubjectId: string }[];
}

interface CourseBlock {
  groupId: string;
  courseTitle: string;
  subjects: { groupSubjectId: string; label: string; fullName: string }[];
}

function buildCourseBlocks(raw: unknown): CourseBlock[] {
  if (!Array.isArray(raw) || raw.length === 0) return [];
  const first = raw[0] as Record<string, unknown>;
  if (Array.isArray(first.groupSubjects)) {
    return (raw as NestedGroup[]).map((g) => ({
      groupId: g.id,
      courseTitle: g.name,
      subjects: (g.groupSubjects ?? []).map((s) => ({
        groupSubjectId: s.groupSubjectId,
        label: s.name.includes(' — ') ? (s.name.split(' — ')[0]?.trim() ?? s.name) : s.name,
        fullName: s.name,
      })),
    }));
  }
  const map = new Map<string, { courseTitle: string; subjects: CourseBlock['subjects'] }>();
  const flat = raw as FlatFolderRow[];
  if (!flat[0] || typeof flat[0].groupId !== 'string') {
    return [];
  }
  for (const row of flat) {
    const parts = row.name.split(' — ');
    const subjLabel = parts[0]?.trim() || row.name;
    const courseTitle = parts[1]?.trim() || 'Curso';
    if (!map.has(row.groupId)) {
      map.set(row.groupId, { courseTitle, subjects: [] });
    }
    map.get(row.groupId)!.subjects.push({
      groupSubjectId: row.groupSubjectId,
      label: subjLabel,
      fullName: row.name,
    });
  }
  return Array.from(map.entries()).map(([groupId, v]) => ({
    groupId,
    courseTitle: v.courseTitle,
    subjects: v.subjects,
  }));
}

function driveViewLink(id: string, mimeType?: string): string {
  const m = (mimeType || '').toLowerCase();
  if (m.includes('document')) return `https://docs.google.com/document/d/${id}/edit`;
  if (m.includes('spreadsheet')) return `https://docs.google.com/spreadsheets/d/${id}/edit`;
  if (m.includes('presentation')) return `https://docs.google.com/presentation/d/${id}/edit`;
  return `https://drive.google.com/file/d/${id}/view`;
}

function urlForEvoFile(f: EvoDriveFileRow): string | undefined {
  return (
    f.googleWebViewLink ||
    f.evoStorageUrl ||
    (f.googleFileId ? driveViewLink(f.googleFileId, f.mimeType || f.googleMimeType) : undefined)
  );
}

function dedupeAdd(
  prev: ComunicadoAttachment[],
  next: ComunicadoAttachment
): ComunicadoAttachment[] {
  const key = (next.url || next.fileId || '').trim();
  if (key && prev.some((p) => (p.url || p.fileId) === key)) return prev;
  if (prev.length >= 10) return prev;
  return [...prev, next];
}

function fileTypeIcon(f: EvoDriveFileRow) {
  const t = (f.tipo || '').toLowerCase();
  const m = (f.mimeType || f.googleMimeType || '').toLowerCase();
  if (t === 'sheet' || m.includes('spreadsheet')) {
    return <Table2 className="w-4 h-4 shrink-0 text-emerald-400" aria-hidden />;
  }
  if (t === 'slide' || m.includes('presentation')) {
    return <Presentation className="w-4 h-4 shrink-0 text-orange-400" aria-hidden />;
  }
  if (t === 'doc' || m.includes('document')) {
    return <FileText className="w-4 h-4 shrink-0 text-[#1e3cff]" aria-hidden />;
  }
  if (m.startsWith('image/')) {
    return <ImageIcon className="w-4 h-4 shrink-0 text-sky-400" aria-hidden />;
  }
  return <File className="w-4 h-4 shrink-0 text-white/45" aria-hidden />;
}

function EvoFilePickerRow({
  file,
  courseTag,
  onAttach,
}: {
  file: EvoDriveFileRow;
  courseTag: string;
  onAttach: () => void;
}) {
  const url = urlForEvoFile(file);
  const origen = (file.origen || '').toLowerCase();
  const isGoogle = origen === 'google' || !!file.googleFileId;
  return (
    <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5">
      {fileTypeIcon(file)}
      <div className="flex-1 min-w-0">
        <p className="text-sm text-white font-medium truncate">{file.nombre}</p>
        <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
          <span className="text-[11px] text-white/45">{courseTag}</span>
          {isGoogle && (
            <span className="text-[10px] px-1.5 py-0 rounded bg-emerald-500/20 text-emerald-200 border border-emerald-500/35">
              Google
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-8 px-2 text-white/80 hover:bg-white/10 hover:text-white"
          disabled={!url}
          title="Abrir en nueva pestaña"
          onClick={() => url && window.open(url, '_blank', 'noopener,noreferrer')}
        >
          <ExternalLink className="w-4 h-4 mr-1" />
          Abrir
        </Button>
        <Button
          type="button"
          size="sm"
          className="h-8 px-2 bg-[#1e3cff] hover:bg-[#1a36d9] text-white"
          disabled={!url}
          onClick={onAttach}
        >
          <Plus className="w-4 h-4 mr-1" />
          Adjuntar
        </Button>
      </div>
    </div>
  );
}

function EvoSubjectFileCount({
  groupId,
  groupSubjectId,
  expanded,
}: {
  groupId: string;
  groupSubjectId: string;
  expanded: boolean;
}) {
  const { data: files = [], isFetching } = useQuery({
    queryKey: ['evo-drive', 'files', 'comunicado-tree', groupId, groupSubjectId],
    queryFn: () =>
      apiRequest<EvoDriveFileRow[]>(
        'GET',
        `/api/evo-drive/files?cursoId=${encodeURIComponent(groupId)}&groupSubjectId=${encodeURIComponent(groupSubjectId)}`
      ),
    enabled: expanded && !!groupId && !!groupSubjectId,
  });
  if (!expanded) return null;
  if (isFetching) return <span className="text-xs text-white/40">…</span>;
  return (
    <span className="text-xs text-white/45">
      {files.length} archivo{files.length !== 1 ? 's' : ''}
    </span>
  );
}

function EvoPrivateFileCount({
  groupId,
  expanded,
  enabled,
}: {
  groupId: string;
  expanded: boolean;
  enabled: boolean;
}) {
  const { data: files = [], isFetching, isError } = useQuery({
    queryKey: ['evo-drive', 'files', 'comunicado-private', groupId],
    queryFn: () =>
      apiRequest<EvoDriveFileRow[]>(
        'GET',
        `/api/evo-drive/files?cursoId=${encodeURIComponent(groupId)}&teacherPrivate=1`
      ),
    enabled: expanded && enabled && !!groupId,
    retry: false,
  });
  if (!expanded) return null;
  if (!enabled || isError) return null;
  if (isFetching) return <span className="text-xs text-white/40">…</span>;
  return (
    <span className="text-xs text-white/45">
      {files.length} archivo{files.length !== 1 ? 's' : ''}
    </span>
  );
}

function EvoSubjectFilesList({
  groupId,
  groupSubjectId,
  expanded,
  courseTag,
  onPick,
}: {
  groupId: string;
  groupSubjectId: string;
  expanded: boolean;
  courseTag: string;
  onPick: (f: EvoDriveFileRow) => void;
}) {
  const { data: files = [], isFetching } = useQuery({
    queryKey: ['evo-drive', 'files', 'comunicado-tree', groupId, groupSubjectId],
    queryFn: () =>
      apiRequest<EvoDriveFileRow[]>(
        'GET',
        `/api/evo-drive/files?cursoId=${encodeURIComponent(groupId)}&groupSubjectId=${encodeURIComponent(groupSubjectId)}`
      ),
    enabled: expanded && !!groupId && !!groupSubjectId,
  });

  if (!expanded) return null;

  if (isFetching) {
    return (
      <div className="flex justify-center py-4 text-white/50">
        <Loader2 className="w-5 h-5 animate-spin" />
      </div>
    );
  }

  if (files.length === 0) {
    return <p className="text-white/40 text-xs py-2 pl-2">Sin archivos en esta materia.</p>;
  }

  return (
    <div className="space-y-2 pl-2 border-l border-white/10 ml-1 py-1">
      {files.map((f) => (
        <EvoFilePickerRow
          key={f.id}
          file={f}
          courseTag={courseTag}
          onAttach={() => onPick(f)}
        />
      ))}
    </div>
  );
}

function EvoTeacherPrivateList({
  groupId,
  expanded,
  enabled,
  courseTag,
  onPick,
}: {
  groupId: string;
  expanded: boolean;
  enabled: boolean;
  courseTag: string;
  onPick: (f: EvoDriveFileRow) => void;
}) {
  const { data: files = [], isFetching, isError } = useQuery({
    queryKey: ['evo-drive', 'files', 'comunicado-private', groupId],
    queryFn: () =>
      apiRequest<EvoDriveFileRow[]>(
        'GET',
        `/api/evo-drive/files?cursoId=${encodeURIComponent(groupId)}&teacherPrivate=1`
      ),
    enabled: expanded && enabled && !!groupId,
    retry: false,
  });

  if (!expanded) return null;

  if (!enabled) {
    return (
      <p className="text-white/40 text-xs py-2 pl-2">La carpeta privada solo está disponible para docentes.</p>
    );
  }

  if (isError) {
    return <p className="text-white/40 text-xs py-2 pl-2">No se pudo cargar Mi carpeta.</p>;
  }

  if (isFetching) {
    return (
      <div className="flex justify-center py-4 text-white/50">
        <Loader2 className="w-5 h-5 animate-spin" />
      </div>
    );
  }

  if (files.length === 0) {
    return <p className="text-white/40 text-xs py-2 pl-2">0 archivos en Mi carpeta.</p>;
  }

  return (
    <div className="space-y-2 pl-2 border-l border-violet-500/25 ml-1 py-1">
      {files.map((f) => (
        <EvoFilePickerRow
          key={f.id}
          file={f}
          courseTag={`${courseTag} · privado`}
          onAttach={() => onPick(f)}
        />
      ))}
    </div>
  );
}

export function ComunicadoAttachmentLinks({ items }: { items: ComunicadoAttachment[] }) {
  const withUrl = items.filter((a) => a.url);
  if (!withUrl.length) return null;
  return (
    <div className="flex flex-wrap gap-2 mt-2">
      {withUrl.map((a, i) => (
        <a
          key={`${a.url}-${i}`}
          href={a.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs px-2.5 py-1 rounded-lg border border-[#00c8ff]/35 bg-[#00c8ff]/10 text-[#7dd3fc] hover:bg-[#00c8ff]/20 transition-colors"
          onClick={(e) => e.stopPropagation()}
        >
          {a.name}
        </a>
      ))}
    </div>
  );
}

interface Props {
  /** Materia destino del comunicado: crear Doc/Sheet/Slide aquí */
  postGroupId: string;
  postGroupSubjectId: string;
  postCursoNombre: string;
  attachments: ComunicadoAttachment[];
  onAttachmentsChange: Dispatch<SetStateAction<ComunicadoAttachment[]>>;
  disabled?: boolean;
  /** Carpeta privada del docente por curso (API solo para profesor) */
  showTeacherPrivateFolder?: boolean;
}

export const ComunicadoWorkspaceAttachments: React.FC<Props> = ({
  postGroupId,
  postGroupSubjectId,
  postCursoNombre,
  attachments,
  onAttachmentsChange,
  disabled,
  showTeacherPrivateFolder = false,
}) => {
  const { toast } = useToast();
  const [evoOpen, setEvoOpen] = useState(false);
  const [googleOpen, setGoogleOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [googleQ, setGoogleQ] = useState('');
  const [submitGoogleQ, setSubmitGoogleQ] = useState('');
  const [linkName, setLinkName] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [createTipo, setCreateTipo] = useState<'doc' | 'sheet' | 'slide'>('doc');
  const [createNombre, setCreateNombre] = useState('');
  const [openCourses, setOpenCourses] = useState<Set<string>>(() => new Set());
  const [openSubjects, setOpenSubjects] = useState<Set<string>>(() => new Set());
  const [openPrivate, setOpenPrivate] = useState<Set<string>>(() => new Set());

  const createTargetsReady = !!postGroupId && !!postGroupSubjectId;

  const { data: googleStatus } = useQuery<{ connected?: boolean }>({
    queryKey: ['evo-drive', 'google-status', 'comunicado'],
    queryFn: () => apiRequest('GET', '/api/evo-drive/google/status'),
  });
  const googleConnected = googleStatus?.connected === true;

  const { data: rawDriveGroups, isFetching: groupsLoading } = useQuery({
    queryKey: ['evo-drive', 'groups', 'comunicado-picker'],
    queryFn: () => apiRequest<unknown>('GET', '/api/evo-drive/groups'),
    enabled: evoOpen,
  });

  const courseBlocks = useMemo(() => buildCourseBlocks(rawDriveGroups), [rawDriveGroups]);

  useEffect(() => {
    if (!evoOpen) return;
    setOpenCourses((prev) => {
      const next = new Set(prev);
      if (postGroupId) next.add(postGroupId);
      return next;
    });
    if (postGroupId && postGroupSubjectId) {
      setOpenSubjects(new Set([`${postGroupId}:${postGroupSubjectId}`]));
    }
    setOpenPrivate(new Set());
  }, [evoOpen, postGroupId, postGroupSubjectId]);

  const toggleCourse = (groupId: string) => {
    setOpenCourses((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  };

  const toggleSubject = (key: string) => {
    setOpenSubjects((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const togglePrivate = (groupId: string) => {
    setOpenPrivate((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  };

  const pickEvoFile = (f: EvoDriveFileRow) => {
    const url = urlForEvoFile(f);
    if (!url) {
      toast({ variant: 'destructive', title: 'Sin enlace', description: 'Este archivo no tiene URL para abrir.' });
      return;
    }
    onAttachmentsChange((prev) =>
      dedupeAdd(prev, {
        name: f.nombre,
        url,
        fileId: f.id,
        source: 'evo_drive',
      })
    );
    toast({ title: 'Adjunto añadido' });
    setEvoOpen(false);
  };

  const { data: googleFilesRes, isFetching: googleLoading } = useQuery({
    queryKey: ['evo-drive', 'google-files', 'comunicado', submitGoogleQ],
    queryFn: () =>
      apiRequest<{ files: GoogleDriveFileRow[] }>(
        'GET',
        `/api/evo-drive/google/files?q=${encodeURIComponent(submitGoogleQ)}`
      ),
    enabled: googleOpen && googleConnected,
  });
  const googleFiles = googleFilesRes?.files ?? [];

  const createMutation = useMutation({
    mutationFn: (payload: { nombre: string; tipo: 'doc' | 'sheet' | 'slide' }) =>
      apiRequest<EvoDriveFileRow>('POST', '/api/evo-drive/google/create', {
        nombre: payload.nombre,
        tipo: payload.tipo,
        cursoId: postGroupId,
        cursoNombre: postCursoNombre,
        groupSubjectId: postGroupSubjectId,
      }),
    onSuccess: (data) => {
      const url = urlForEvoFile(data);
      if (!url) {
        toast({ title: 'Creado', description: 'No se obtuvo enlace; búscalo en Evo Drive.' });
        setCreateOpen(false);
        setCreateNombre('');
        return;
      }
      onAttachmentsChange((prev) =>
        dedupeAdd(prev, {
          name: data.nombre || 'Documento',
          url,
          fileId: String(data.id),
          source: 'evo_drive',
        })
      );
      toast({ title: 'Adjunto', description: 'Se añadió el archivo nuevo.' });
      setCreateOpen(false);
      setCreateNombre('');
    },
    onError: (e: Error) => {
      toast({
        variant: 'destructive',
        title: 'No se pudo crear',
        description: e.message || 'Revisa Google Drive conectado.',
      });
    },
  });

  const openCreate = (tipo: 'doc' | 'sheet' | 'slide') => {
    if (!googleConnected) {
      toast({
        variant: 'destructive',
        title: 'Google Drive',
        description: 'Conecta Google Drive desde Evo Drive para crear documentos.',
      });
      return;
    }
    if (!createTargetsReady) {
      toast({
        variant: 'destructive',
        title: 'Selecciona un curso',
        description: 'Elige una materia en la barra lateral para crear archivos en su carpeta.',
      });
      return;
    }
    setCreateTipo(tipo);
    setCreateNombre('');
    setCreateOpen(true);
  };

  const removeAt = (index: number) => {
    onAttachmentsChange((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-2">
      <p className="text-white/50 text-xs">Adjuntos (Evo Drive / Google)</p>
      <div className="flex flex-wrap gap-1.5 items-center">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8 px-2.5 gap-1.5 border-[#ffd700]/35 bg-[#ffd700]/[0.08] text-white/95 hover:bg-[#ffd700]/15 hover:border-[#ffd700]/50"
          disabled={disabled}
          onClick={() => setEvoOpen(true)}
        >
          <FolderOpen className="w-4 h-4 shrink-0 text-[#ffd700]" aria-hidden />
          <span className="text-xs font-medium">Evo Drive</span>
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8 px-2.5 gap-1.5 border-[#00c8ff]/35 bg-[#00c8ff]/[0.08] text-white/95 hover:bg-[#00c8ff]/15 hover:border-[#00c8ff]/50"
          disabled={disabled}
          onClick={() => {
            if (!googleConnected) {
              toast({
                variant: 'destructive',
                title: 'Google Drive no conectado',
                description: 'Conéctalo desde la página Evo Drive.',
              });
              return;
            }
            setGoogleOpen(true);
            setGoogleQ('');
            setSubmitGoogleQ('');
          }}
        >
          <Cloud className="w-4 h-4 shrink-0 text-[#00c8ff]" aria-hidden />
          <span className="text-xs font-medium">Mi Drive</span>
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8 px-2.5 gap-1.5 border-[#4285F4]/40 bg-[#4285F4]/[0.12] text-white/95 hover:bg-[#4285F4]/20 hover:border-[#4285F4]/55"
          disabled={disabled || !createTargetsReady}
          onClick={() => openCreate('doc')}
          title="Nuevo Google Doc"
        >
          <FileText className="w-4 h-4 shrink-0 text-[#4285F4]" aria-hidden />
          <span className="text-xs font-medium">Docs</span>
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8 px-2.5 gap-1.5 border-[#0F9D58]/40 bg-[#0F9D58]/[0.12] text-white/95 hover:bg-[#0F9D58]/20 hover:border-[#0F9D58]/55"
          disabled={disabled || !createTargetsReady}
          onClick={() => openCreate('sheet')}
          title="Nueva hoja de cálculo (Google Sheets)"
        >
          <Table2 className="w-4 h-4 shrink-0 text-[#34A853]" aria-hidden />
          <span className="text-xs font-medium">Sheets</span>
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8 px-2.5 gap-1.5 border-[#F4B400]/45 bg-[#F4B400]/[0.12] text-white/95 hover:bg-[#F4B400]/22 hover:border-[#FBBC04]/60"
          disabled={disabled || !createTargetsReady}
          onClick={() => openCreate('slide')}
          title="Nueva presentación (Google Slides)"
        >
          <Presentation className="w-4 h-4 shrink-0 text-[#FBBC04]" aria-hidden />
          <span className="text-xs font-medium">Slides</span>
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8 px-2.5 gap-1.5 border-white/15 bg-white/[0.04] text-white/90 hover:bg-white/10"
          disabled={disabled}
          onClick={() => {
            setLinkName('');
            setLinkUrl('');
            setLinkOpen(true);
          }}
        >
          <Link2 className="w-4 h-4 shrink-0 text-white/70" aria-hidden />
          <span className="text-xs font-medium">Enlace</span>
        </Button>
      </div>
      {attachments.length > 0 && (
        <ul className="flex flex-wrap gap-2 pt-1">
          {attachments.map((a, i) => (
            <li
              key={`${a.name}-${i}`}
              className="flex items-center gap-1 text-xs pl-2 pr-1 py-1 rounded-lg bg-white/5 border border-white/10 text-white/85 max-w-full"
            >
              <span className="truncate">{a.name}</span>
              <button
                type="button"
                className="p-0.5 rounded hover:bg-white/10 text-white/60 shrink-0"
                aria-label="Quitar adjunto"
                disabled={disabled}
                onClick={() => removeAt(i)}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={evoOpen} onOpenChange={setEvoOpen}>
        <DialogContent className="bg-[#0a0a2a] border-white/10 text-white w-[min(96vw,760px)] max-w-[760px] max-h-[min(88vh,820px)] flex flex-col gap-0 p-0 overflow-hidden">
          <DialogHeader className="px-6 pt-6 pb-3 shrink-0 border-b border-white/10">
            <DialogTitle className="text-lg font-['Poppins'] text-white">Evo Drive</DialogTitle>
            <p className="text-white/50 text-sm font-normal mt-1">
              Elige un archivo de cualquiera de tus carpetas por curso o de Mi carpeta (solo docente).
            </p>
          </DialogHeader>
          <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-2">
            {groupsLoading && (
              <div className="flex justify-center py-16 text-white/50">
                <Loader2 className="w-8 h-8 animate-spin" />
              </div>
            )}
            {!groupsLoading && courseBlocks.length === 0 && (
              <p className="text-white/50 text-sm text-center py-10">No hay carpetas de Evo Drive disponibles.</p>
            )}
            {!groupsLoading &&
              courseBlocks.map((course) => {
                const courseOpen = openCourses.has(course.groupId);
                const nSubjects = course.subjects.length;
                return (
                  <div
                    key={course.groupId}
                    className="rounded-xl border border-white/10 bg-white/[0.03] overflow-hidden"
                  >
                    <button
                      type="button"
                      className="w-full flex items-center gap-2 px-3 py-3 text-left hover:bg-white/[0.06] transition-colors"
                      onClick={() => toggleCourse(course.groupId)}
                    >
                      {courseOpen ? (
                        <ChevronDown className="w-4 h-4 shrink-0 text-[#00c8ff]" />
                      ) : (
                        <ChevronRight className="w-4 h-4 shrink-0 text-white/50" />
                      )}
                      <FolderOpen className="w-4 h-4 shrink-0 text-[#ffd700]" />
                      <span className="flex-1 font-semibold text-white text-sm uppercase tracking-wide">
                        Curso {course.courseTitle}
                      </span>
                      <span className="text-xs text-white/45">
                        {nSubjects} materia{nSubjects !== 1 ? 's' : ''}
                      </span>
                    </button>
                    {courseOpen && (
                      <div className="px-2 pb-3 space-y-1 border-t border-white/5 pt-2">
                        {course.subjects.map((sub) => {
                          const sk = `${course.groupId}:${sub.groupSubjectId}`;
                          const subOpen = openSubjects.has(sk);
                          return (
                            <div key={sk} className="rounded-lg border border-white/5 bg-black/20">
                              <button
                                type="button"
                                className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-white/[0.05]"
                                onClick={() => toggleSubject(sk)}
                              >
                                {subOpen ? (
                                  <ChevronDown className="w-3.5 h-3.5 shrink-0 text-white/60" />
                                ) : (
                                  <ChevronRight className="w-3.5 h-3.5 shrink-0 text-white/40" />
                                )}
                                <FolderOpen className="w-3.5 h-3.5 shrink-0 text-white/50" />
                                <span className="flex-1 text-sm text-white/90">{sub.label}</span>
                                <EvoSubjectFileCount
                                  groupId={course.groupId}
                                  groupSubjectId={sub.groupSubjectId}
                                  expanded={subOpen}
                                />
                              </button>
                              <EvoSubjectFilesList
                                groupId={course.groupId}
                                groupSubjectId={sub.groupSubjectId}
                                expanded={subOpen}
                                courseTag={course.courseTitle}
                                onPick={pickEvoFile}
                              />
                            </div>
                          );
                        })}
                        <div className="rounded-lg border border-violet-500/20 bg-violet-500/[0.06] mt-2">
                          <button
                            type="button"
                            className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-white/[0.05]"
                            onClick={() => togglePrivate(course.groupId)}
                          >
                            {openPrivate.has(course.groupId) ? (
                              <ChevronDown className="w-3.5 h-3.5 shrink-0 text-violet-300" />
                            ) : (
                              <ChevronRight className="w-3.5 h-3.5 shrink-0 text-white/40" />
                            )}
                            <Lock className="w-3.5 h-3.5 shrink-0 text-violet-300" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-white font-medium">Mi carpeta</p>
                              <p className="text-[11px] text-white/45">Solo docente · no visible para estudiantes</p>
                            </div>
                            <EvoPrivateFileCount
                              groupId={course.groupId}
                              expanded={openPrivate.has(course.groupId)}
                              enabled={showTeacherPrivateFolder}
                            />
                          </button>
                          <EvoTeacherPrivateList
                            groupId={course.groupId}
                            expanded={openPrivate.has(course.groupId)}
                            enabled={showTeacherPrivateFolder}
                            courseTag={course.courseTitle}
                            onPick={pickEvoFile}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
          <DialogFooter className="px-6 py-4 shrink-0 border-t border-white/10 bg-black/20">
            <Button variant="outline" className="border-white/20 text-white" onClick={() => setEvoOpen(false)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={googleOpen} onOpenChange={setGoogleOpen}>
        <DialogContent className="bg-[#0f172a] border-white/10 text-white max-w-md">
          <DialogHeader>
            <DialogTitle>Buscar en tu Google Drive</DialogTitle>
          </DialogHeader>
          <div className="flex gap-2">
            <Input
              value={googleQ}
              onChange={(e) => setGoogleQ(e.target.value)}
              placeholder="Nombre del archivo…"
              className="bg-white/5 border-white/15 text-white"
              onKeyDown={(e) => {
                if (e.key === 'Enter') setSubmitGoogleQ(googleQ.trim());
              }}
            />
            <Button
              type="button"
              className="bg-[#1e3cff] shrink-0"
              onClick={() => setSubmitGoogleQ(googleQ.trim())}
            >
              Buscar
            </Button>
          </div>
          <div className="max-h-[45vh] overflow-y-auto space-y-1 pr-1">
            {googleLoading && (
              <div className="flex justify-center py-8 text-white/50">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
            )}
            {!googleLoading &&
              googleFiles.map((g) => {
                const url = g.webViewLink || driveViewLink(g.id, g.mimeType);
                return (
                  <button
                    key={g.id}
                    type="button"
                    className="w-full text-left rounded-lg px-3 py-2 text-sm hover:bg-white/10 border border-transparent hover:border-white/10"
                    onClick={() => {
                      onAttachmentsChange((prev) =>
                        dedupeAdd(prev, {
                          name: g.name,
                          url,
                          fileId: g.id,
                          source: 'google_drive',
                        })
                      );
                      toast({ title: 'Adjunto añadido' });
                      setGoogleOpen(false);
                    }}
                  >
                    {g.name}
                  </button>
                );
              })}
            {!googleLoading && googleFiles.length === 0 && (
              <p className="text-white/50 text-sm py-4 text-center">Sin resultados. Prueba otro término.</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" className="border-white/20 text-white" onClick={() => setGoogleOpen(false)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={linkOpen} onOpenChange={setLinkOpen}>
        <DialogContent className="bg-[#0f172a] border-white/10 text-white max-w-md">
          <DialogHeader>
            <DialogTitle>Enlace externo</DialogTitle>
          </DialogHeader>
          <Input
            value={linkName}
            onChange={(e) => setLinkName(e.target.value)}
            placeholder="Nombre visible"
            className="bg-white/5 border-white/15 text-white mb-2"
          />
          <Input
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            placeholder="https://…"
            className="bg-white/5 border-white/15 text-white"
          />
          <DialogFooter>
            <Button variant="outline" className="border-white/20 text-white" onClick={() => setLinkOpen(false)}>
              Cancelar
            </Button>
            <Button
              className="bg-[#3B82F6]"
              disabled={!linkName.trim() || !linkUrl.trim()}
              onClick={() => {
                const u = linkUrl.trim();
                const n = linkName.trim();
                if (!u || !n) return;
                onAttachmentsChange((prev) => dedupeAdd(prev, { name: n, url: u, source: 'link' }));
                setLinkOpen(false);
                toast({ title: 'Enlace añadido' });
              }}
            >
              Añadir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="bg-[#0f172a] border-white/10 text-white max-w-md">
          <DialogHeader>
            <DialogTitle>
              {createTipo === 'doc' && 'Nuevo Google Doc'}
              {createTipo === 'sheet' && 'Nueva hoja de cálculo'}
              {createTipo === 'slide' && 'Nueva presentación'}
            </DialogTitle>
          </DialogHeader>
          <Input
            value={createNombre}
            onChange={(e) => setCreateNombre(e.target.value)}
            placeholder="Nombre del archivo"
            className="bg-white/5 border-white/15 text-white"
          />
          <DialogFooter>
            <Button variant="outline" className="border-white/20 text-white" onClick={() => setCreateOpen(false)}>
              Cancelar
            </Button>
            <Button
              className="bg-[#1e3cff]"
              disabled={!createNombre.trim() || createMutation.isPending}
              onClick={() => createMutation.mutate({ nombre: createNombre.trim(), tipo: createTipo })}
            >
              {createMutation.isPending ? 'Creando…' : 'Crear y adjuntar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
