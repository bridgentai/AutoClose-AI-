import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/authContext';
import { useLocation, useParams } from 'wouter';
import { Save, X, FileText } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { NavBackButton } from '@/components/nav-back-button';
import { DocumentEditor } from '@/components/document-editor';

interface Assignment {
  _id: string;
  titulo: string;
  descripcion: string;
  contenidoDocumento?: string;
  curso: string;
  fechaEntrega: string;
}

export default function ProfesorEditorDocumentoPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const params = useParams<{ id: string }>();
  const { toast } = useToast();
  const assignmentId = params?.id;

  const [documentContent, setDocumentContent] = useState('');
  const [titulo, setTitulo] = useState('');

  const { data: assignment, isLoading } = useQuery<Assignment>({
    queryKey: ['/api/assignments', assignmentId],
    queryFn: () => apiRequest('GET', `/api/assignments/${assignmentId}`),
    enabled: !!assignmentId,
    onSuccess: (data) => {
      if (data) {
        setTitulo(data.titulo);
        setDocumentContent(data.contenidoDocumento || '');
      }
    },
  });

  const updateDocumentMutation = useMutation({
    mutationFn: async (content: string) => {
      return apiRequest('PUT', `/api/assignments/${assignmentId}`, {
        contenidoDocumento: content,
      });
    },
    onSuccess: () => {
      toast({ 
        title: 'Documento guardado exitosamente',
        description: 'El contenido se ha actualizado correctamente.'
      });
      queryClient.invalidateQueries({ queryKey: ['/api/assignments', assignmentId] });
    },
    onError: (error: any) => {
      toast({ 
        title: 'Error al guardar',
        description: error.message || 'No se pudo guardar el documento',
        variant: 'destructive'
      });
    },
  });

  const handleSave = () => {
    updateDocumentMutation.mutate(documentContent);
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-white">Cargando...</div>
      </div>
    );
  }

  if (!assignment) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-white">Tarea no encontrada</div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto p-6 md:p-10">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <NavBackButton 
            to={assignmentId ? `/assignment/${assignmentId}` : '/profesor/academia/tareas/asignar'} 
            label="Volver"
          />
        </div>

        <Card className="bg-white/5 border-white/10 backdrop-blur-md">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <CardTitle className="text-white text-2xl mb-2 flex items-center gap-2">
                  <FileText className="w-6 h-6 text-[#1e3cff]" />
                  Editor de Documento
                </CardTitle>
                <p className="text-white/60">
                  Tarea: <span className="text-white font-semibold">{titulo}</span>
                </p>
                <p className="text-sm text-white/50 mt-1">
                  Curso: {assignment.curso}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setLocation(assignmentId ? `/assignment/${assignmentId}` : '/profesor/academia/tareas/asignar')}
                  className="border-white/10 text-white hover:bg-white/10"
                >
                  <X className="w-4 h-4 mr-2" />
                  Cancelar
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={updateDocumentMutation.isPending}
                  className="bg-gradient-to-r from-[#002366] to-[#1e3cff] hover:opacity-90"
                >
                  <Save className="w-4 h-4 mr-2" />
                  {updateDocumentMutation.isPending ? 'Guardando...' : 'Guardar Documento'}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <DocumentEditor
              content={documentContent}
              onChange={setDocumentContent}
              readOnly={false}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

