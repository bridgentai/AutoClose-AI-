import { useState } from 'react';
import { useRoute } from 'wouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FileText, Link as LinkIcon, Video, Plus } from 'lucide-react';
import { NavBackButton } from '@/components/nav-back-button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { apiRequest } from '@/lib/queryClient';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

interface Material {
  _id: string;
  titulo: string;
  tipo: string;
  url: string;
  descripcion?: string;
  createdAt: string;
}

interface GroupResponse {
  _id: string;
  id: string;
  nombre: string;
}

export default function CourseMaterialsPage() {
  const [, params] = useRoute('/course-detail/:cursoId/materiales');
  const rawCursoId = params?.cursoId || '';
  const queryClient = useQueryClient();

  const { data: group, isLoading: loadingGroup } = useQuery<GroupResponse | null>({
    queryKey: ['group', rawCursoId],
    queryFn: async () => {
      if (!rawCursoId) return null;
      try {
        return await apiRequest<GroupResponse>('GET', `/api/groups/${encodeURIComponent(rawCursoId)}`);
      } catch {
        return null;
      }
    },
    enabled: !!rawCursoId,
  });

  const cursoNombre = group?.nombre ?? (rawCursoId || '').toUpperCase().trim();

  const { data: materials = [], isLoading } = useQuery<Material[]>({
    queryKey: ['course-materials', cursoNombre],
    queryFn: async () => {
      if (!cursoNombre) return [];
      return apiRequest<Material[]>(
        'GET',
        `/api/materials?cursoId=${encodeURIComponent(cursoNombre)}`,
      );
    },
    enabled: !!cursoNombre,
  });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [tab, setTab] = useState<'link' | 'file'>('link');
  const [titulo, setTitulo] = useState('');
  const [tipo, setTipo] = useState<'pdf' | 'enlace' | 'video' | 'documento' | 'other'>('enlace');
  const [url, setUrl] = useState('');
  const [descripcion, setDescripcion] = useState('');

  const createMaterialMutation = useMutation({
    mutationFn: async () => {
      if (!cursoNombre.trim() || !titulo.trim()) {
        throw new Error('Faltan datos');
      }
      await apiRequest('POST', '/api/materials', {
        titulo: titulo.trim(),
        descripcion: descripcion.trim() || undefined,
        tipo,
        url: url.trim() || undefined,
        cursoId: cursoNombre,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['course-materials', cursoNombre] });
      setDialogOpen(false);
      setTitulo('');
      setDescripcion('');
      setUrl('');
      setTipo('enlace');
    },
  });

  const displayGroupId = cursoNombre;

  const getIcon = (t: string) => {
    switch (t) {
      case 'pdf':
      case 'documento':
        return <FileText className="w-5 h-5" />;
      case 'video':
        return <Video className="w-5 h-5" />;
      case 'enlace':
        return <LinkIcon className="w-5 h-5" />;
      default:
        return <FileText className="w-5 h-5" />;
    }
  };

  return (
    <div className="p-6">
      <NavBackButton to={`/course-detail/${rawCursoId}`} label={`Grupo ${displayGroupId}`} />
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white font-['Poppins'] mt-4 flex items-center gap-2">
            <FileText className="w-7 h-7 text-[#00c8ff]" />
            Materiales del Grupo {displayGroupId}
          </h1>
          <p className="text-white/60">Materiales vinculados a este curso</p>
        </div>
        <Button
          className="bg-gradient-to-r from-[#002366] to-[#1e3cff] hover:opacity-90 text-white rounded-xl font-medium flex items-center gap-2 mt-4"
          onClick={() => setDialogOpen(true)}
          disabled={loadingGroup || !cursoNombre}
        >
          <Plus className="w-4 h-4" />
          Crear nuevo material
        </Button>
      </div>
      <Card className="bg-white/5 border-white/10 backdrop-blur-md">
        <CardHeader>
          <CardTitle className="text-white">Materiales</CardTitle>
          <CardDescription className="text-white/60">
            {materials.length} {materials.length === 1 ? 'material' : 'materiales'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading || loadingGroup ? (
            <div className="space-y-3">
              <Skeleton className="h-14 w-full bg-white/10" />
              <Skeleton className="h-14 w-full bg-white/10" />
            </div>
          ) : materials.length > 0 ? (
            <ul className="space-y-3">
              {materials.map((m) => (
                <li
                  key={m._id}
                  className="p-4 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-colors flex items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-4 flex-1">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-gradient-to-br from-[#002366] to-[#1e3cff] text-white">
                      {getIcon(m.tipo)}
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-white">{m.titulo}</div>
                      <div className="text-xs text-white/60 flex items-center gap-2 flex-wrap mt-1">
                        <span>{new Date(m.createdAt).toLocaleDateString('es-CO')}</span>
                        <span>•</span>
                        <span className="capitalize">{m.tipo}</span>
                      </div>
                      {m.descripcion && (
                        <p className="text-white/60 text-sm mt-1">{m.descripcion}</p>
                      )}
                    </div>
                  </div>
                  {m.url && (
                    <a
                      href={m.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#00c8ff] text-sm hover:underline"
                    >
                      Abrir
                    </a>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-center py-12">
              <FileText className="w-16 h-16 text-[#1e3cff]/40 mx-auto mb-4" />
              <p className="text-white/60">No hay materiales para este curso</p>
              <p className="text-white/40 text-sm mt-2">
                Crea materiales desde este curso y se sincronizarán con Evo Drive.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-[#020617] border-white/10 max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-white">Crear nuevo material</DialogTitle>
          </DialogHeader>
          <Tabs value={tab} onValueChange={(v) => setTab(v as 'link' | 'file')} className="mt-2">
            <TabsList className="bg-white/5 border border-white/10">
              <TabsTrigger value="link">Enlace / Recurso online</TabsTrigger>
              <TabsTrigger value="file">PDF / Documento</TabsTrigger>
            </TabsList>
            <TabsContent value="link" className="mt-4 space-y-3">
              <div className="space-y-2">
                <Label className="text-white/80">Título</Label>
                <Input
                  value={titulo}
                  onChange={(e) => setTitulo(e.target.value)}
                  placeholder="Ej: Guía de estudio Unidad 1"
                  className="bg-white/5 border-white/10 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-white/80">URL</Label>
                <Input
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://..."
                  className="bg-white/5 border-white/10 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-white/80">Descripción (opcional)</Label>
                <Textarea
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  placeholder="Contexto o instrucciones para este recurso"
                  className="bg-white/5 border-white/10 text-white min-h-[80px]"
                />
              </div>
            </TabsContent>
            <TabsContent value="file" className="mt-4 space-y-3">
              <p className="text-sm text-white/60">
                Por ahora, adjunta el PDF o documento subiéndolo a una URL (Drive, OneDrive, etc.) y pega el
                enlace aquí. Más adelante se puede integrar subida directa.
              </p>
              <div className="space-y-2">
                <Label className="text-white/80">Título</Label>
                <Input
                  value={titulo}
                  onChange={(e) => setTitulo(e.target.value)}
                  placeholder="Ej: Taller 3 - Derivadas"
                  className="bg-white/5 border-white/10 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-white/80">URL del archivo</Label>
                <Input
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://..."
                  className="bg-white/5 border-white/10 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-white/80">Descripción (opcional)</Label>
                <Textarea
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  placeholder="Indica instrucciones o páginas relevantes"
                  className="bg-white/5 border-white/10 text-white min-h-[80px]"
                />
              </div>
            </TabsContent>
          </Tabs>
          <DialogFooter className="mt-4 flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              className="border-white/20 text-white/80"
            >
              Cancelar
            </Button>
            <Button
              onClick={() => {
                setTipo(tab === 'link' ? 'enlace' : 'pdf');
                createMaterialMutation.mutate();
              }}
              disabled={!titulo.trim() || createMaterialMutation.isPending}
            >
              Guardar material
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

