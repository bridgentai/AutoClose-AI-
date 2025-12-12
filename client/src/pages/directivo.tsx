import { useAuth } from '@/lib/authContext';
import { Users, Save, AlertCircle, ChevronDown } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { useState } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

interface Profesor {
  _id: string;
  nombre: string;
  email: string;
  materias: string[];
  createdAt: string;
}

interface Course {
  _id: string;
  nombre: string;
  profesorId: string;
  cursos: string[];
  colegioId: string;
}

const GRUPOS_DISPONIBLES = [
  '6A', '6B', '6C',
  '7A', '7B', '7C',
  '8A', '8B', '8C',
  '9A', '9B', '9C',
  '10A', '10B', '10C',
  '11A', '11B', '11C',
];

export default function DirectivoPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [openProfesorId, setOpenProfesorId] = useState<string | null>(null);

  const { data: profesores = [], isLoading: loadingProfesores, error: errorProfesores } = useQuery<Profesor[]>({
    queryKey: ['/api/users/profesores'],
  });

  const { data: allCourses = [], isLoading: loadingCourses } = useQuery<Course[]>({
    queryKey: ['/api/courses'],
  });

  const assignMutation = useMutation({
    mutationFn: async (data: { profesorId: string; materia: string; grupos: string[] }) => {
      const response = await fetch('/api/courses/assign', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Error al asignar cursos');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/courses'] });
      toast({
        title: 'Asignacion exitosa!',
        description: 'Los grupos han sido asignados al profesor.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error al asignar',
        description: error.message || 'No se pudieron asignar los grupos.',
        variant: 'destructive',
      });
    },
  });

  const getCurrentAssignments = (profesorId: string, materia: string): string[] => {
    const course = allCourses.find(
      c => c.profesorId === profesorId && c.nombre === materia
    );
    return course?.cursos || [];
  };

  return (
    <div data-testid="directivo-page">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-white mb-2 font-['Poppins']">
          Gestion de Profesores
        </h2>
        <p className="text-white/60">
          Asigna grupos a cada profesor segun sus materias
        </p>
      </div>

      {(loadingProfesores || loadingCourses) && (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="bg-white/5 border-white/10 backdrop-blur-md">
              <CardHeader>
                <Skeleton className="w-48 h-6 bg-white/10" />
                <Skeleton className="w-64 h-4 mt-2 bg-white/10" />
              </CardHeader>
            </Card>
          ))}
        </div>
      )}

      {errorProfesores && (
        <Alert className="bg-red-500/10 border-red-500/50">
          <AlertCircle className="h-4 w-4 text-red-400" />
          <AlertTitle className="text-red-200">Error al cargar profesores</AlertTitle>
          <AlertDescription className="text-red-200">
            No se pudieron cargar los profesores. Por favor, intenta de nuevo mas tarde.
          </AlertDescription>
        </Alert>
      )}

      {!loadingProfesores && !errorProfesores && profesores.length === 0 && (
        <Alert className="bg-blue-500/10 border-blue-500/50">
          <Users className="h-4 w-4 text-blue-400" />
          <AlertTitle className="text-blue-200">No hay profesores registrados</AlertTitle>
          <AlertDescription className="text-blue-200">
            Aun no hay profesores registrados en tu institucion.
          </AlertDescription>
        </Alert>
      )}

      {!loadingProfesores && !loadingCourses && profesores.length > 0 && (
        <div className="space-y-4">
          {profesores.map((profesor) => (
            <ProfesorCard
              key={profesor._id}
              profesor={profesor}
              isOpen={openProfesorId === profesor._id}
              onToggle={() => setOpenProfesorId(openProfesorId === profesor._id ? null : profesor._id)}
              getCurrentAssignments={getCurrentAssignments}
              assignMutation={assignMutation}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface ProfesorCardProps {
  profesor: Profesor;
  isOpen: boolean;
  onToggle: () => void;
  getCurrentAssignments: (profesorId: string, materia: string) => string[];
  assignMutation: any;
}

function ProfesorCard({ profesor, isOpen, onToggle, getCurrentAssignments, assignMutation }: ProfesorCardProps) {
  const [selectedMateria, setSelectedMateria] = useState<string>('');
  const [selectedGrupos, setSelectedGrupos] = useState<string[]>([]);

  const handleMateriaChange = (materia: string) => {
    setSelectedMateria(materia);
    const currentAssignments = getCurrentAssignments(profesor._id, materia);
    setSelectedGrupos(currentAssignments);
  };

  const handleGrupoToggle = (grupo: string) => {
    setSelectedGrupos(prev =>
      prev.includes(grupo)
        ? prev.filter(g => g !== grupo)
        : [...prev, grupo]
    );
  };

  const handleSave = () => {
    if (!selectedMateria) {
      return;
    }
    assignMutation.mutate({
      profesorId: profesor._id,
      materia: selectedMateria,
      grupos: selectedGrupos,
    });
  };

  return (
    <Collapsible open={isOpen} onOpenChange={onToggle}>
      <Card className="bg-white/5 border-white/10 backdrop-blur-md">
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover-elevate">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <CardTitle className="text-white text-xl font-bold flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  {profesor.nombre}
                </CardTitle>
                <CardDescription className="text-white/60">
                  {profesor.email}
                </CardDescription>
                <div className="flex flex-wrap gap-2 mt-3">
                  {profesor.materias.map((materia) => (
                    <Badge
                      key={materia}
                      variant="secondary"
                      className="bg-purple-500/20 text-purple-200 border-purple-500/30"
                      data-testid={`badge-materia-${materia}`}
                    >
                      {materia}
                    </Badge>
                  ))}
                </div>
              </div>
              <ChevronDown
                className={`w-5 h-5 text-white/60 transition-transform ${isOpen ? 'rotate-180' : ''}`}
              />
            </div>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="space-y-4 pt-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-white">Selecciona una materia:</label>
              <Select value={selectedMateria} onValueChange={handleMateriaChange}>
                <SelectTrigger
                  className="bg-white/5 border-white/20 text-white"
                  data-testid="select-materia"
                >
                  <SelectValue placeholder="Seleccionar materia..." />
                </SelectTrigger>
                <SelectContent className="bg-[#1a001c] border-white/20">
                  {profesor.materias.map((materia) => (
                    <SelectItem
                      key={materia}
                      value={materia}
                      className="text-white hover:bg-white/10"
                      data-testid={`select-option-${materia}`}
                    >
                      {materia}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedMateria && (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-white">Asignar grupos:</label>
                  <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                    {GRUPOS_DISPONIBLES.map((grupo) => (
                      <label
                        key={grupo}
                        className="flex items-center gap-2 p-3 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 cursor-pointer"
                        data-testid={`checkbox-grupo-${grupo}`}
                      >
                        <Checkbox
                          checked={selectedGrupos.includes(grupo)}
                          onCheckedChange={() => handleGrupoToggle(grupo)}
                          className="border-white/30"
                        />
                        <span className="text-white text-sm">{grupo}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end pt-4">
                  <Button
                    onClick={handleSave}
                    disabled={assignMutation.isPending}
                    className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
                    data-testid="button-save-assignment"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    {assignMutation.isPending ? 'Guardando...' : 'Guardar Asignacion'}
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
