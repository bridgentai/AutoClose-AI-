import { useState } from 'react';
import { useAuth } from '@/lib/authContext';
import { useLocation, useRoute } from 'wouter';
import { 
  ArrowLeft,
  User,
  Mail,
  Calendar,
  Award,
  AlertTriangle,
  FileText,
  MessageSquare,
  Phone,
  MapPin,
  School
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Skeleton } from '@/components/ui/skeleton';

// =========================================================
// INTERFACES
// =========================================================

interface StudentDetail {
  _id: string;
  nombre: string;
  email: string;
  telefono?: string | null;
  celular?: string | null;
  direccion?: string | null;
  barrio?: string | null;
  ciudad?: string | null;
  fechaNacimiento?: string | null;
  colegioId: string;
  curso?: string;
}

interface StudentNote {
  actividad: string;
  nota: number;
  fecha: string;
  comentario?: string;
  categoria: string;
}

interface Amonestacion {
  _id: string;
  cantidad: number;
  gravedad: 'leve' | 'moderada' | 'grave' | 'muy grave';
  razon: string;
  fecha: string;
  registradoPor?: string;
}

// =========================================================
// FUNCIONES DE API
// =========================================================

const fetchStudentPersonalInfo = async (estudianteId: string): Promise<StudentDetail> => {
  return apiRequest('GET', `/api/student/${estudianteId}/personal-info`);
};

const mockNotes: StudentNote[] = [
  { actividad: 'Examen Parcial 1', nota: 85, fecha: '2024-01-15', comentario: 'Buen trabajo, sigue así', categoria: 'Exámenes' },
  { actividad: 'Tarea de Álgebra', nota: 90, fecha: '2024-01-10', comentario: 'Bien hecho', categoria: 'Tareas' },
  { actividad: 'Examen Parcial 2', nota: 88, fecha: '2024-02-20', comentario: 'Excelente progreso', categoria: 'Exámenes' },
  { actividad: 'Proyecto Final', nota: 92, fecha: '2024-03-01', comentario: 'Buen proyecto, bien estructurado', categoria: 'Proyectos' },
  { actividad: 'Tarea de Geometría', nota: 87, fecha: '2024-02-05', categoria: 'Tareas' }
];

const mockAmonestaciones: Amonestacion[] = [
  {
    _id: '1',
    cantidad: 2,
    gravedad: 'moderada',
    razon: 'Falta de respeto a compañeros durante la clase',
    fecha: '2024-02-10',
    registradoPor: 'Prof. María García'
  },
  {
    _id: '2',
    cantidad: 1,
    gravedad: 'leve',
    razon: 'Llegada tardía a clase sin justificación',
    fecha: '2024-01-25',
    registradoPor: 'Prof. Carlos Rodríguez'
  },
  {
    _id: '3',
    cantidad: 1,
    gravedad: 'grave',
    razon: 'Uso de dispositivos electrónicos durante examen',
    fecha: '2024-03-05',
    registradoPor: 'Prof. Ana Martínez'
  }
];

// =========================================================
// COMPONENTE PRINCIPAL
// =========================================================

export default function StudentProfilePage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  
  // Rutas dinámicas
  const [, params] = useRoute('/profesor/cursos/:cursoId/estudiantes/:estudianteId');
  
  const cursoId = params?.cursoId || '';
  const estudianteId = params?.estudianteId || '';
  
  // Obtener información personal del estudiante desde el backend
  const { data: studentDetail, isLoading: isLoadingStudent, error: studentError } = useQuery<StudentDetail>({
    queryKey: ['studentPersonalInfo', estudianteId],
    queryFn: () => fetchStudentPersonalInfo(estudianteId),
    enabled: !!estudianteId,
  });
  
  // Datos mock para notas y amonestaciones (en producción vendrían del backend)
  const [notes] = useState<StudentNote[]>(mockNotes);
  const [amonestaciones] = useState<Amonestacion[]>(mockAmonestaciones);

  // Calcular promedio de notas
  const promedioFinal = notes.length > 0
    ? Math.round(notes.reduce((acc, nota) => acc + nota.nota, 0) / notes.length)
    : 0;

  // Calcular total de amonestaciones
  const totalAmonestaciones = amonestaciones.reduce((acc, am) => acc + am.cantidad, 0);

  // Función para obtener el color de la gravedad
  const getGravedadColor = (gravedad: string) => {
    switch (gravedad) {
      case 'leve':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40';
      case 'moderada':
        return 'bg-orange-500/20 text-orange-400 border-orange-500/40';
      case 'grave':
        return 'bg-red-500/20 text-red-400 border-red-500/40';
      case 'muy grave':
        return 'bg-red-600/30 text-red-300 border-red-600/50';
      default:
        return 'bg-gray-500/20 text-gray-400 border-gray-500/40';
    }
  };

  if (!cursoId || !estudianteId) {
    return (
      <div className="flex-1 overflow-y-auto p-6 md:p-10">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-8">
            <AlertTriangle className="w-16 h-16 text-red-500/40 mx-auto mb-4" />
            <p className="text-white/60">Estudiante no encontrado</p>
            <Button
              variant="ghost"
              onClick={() => setLocation(`/course-detail/${cursoId}`)}
              className="text-white/70 hover:text-white mt-4"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Volver al Curso
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (isLoadingStudent) {
    return (
      <div className="flex-1 overflow-y-auto p-6 md:p-10">
        <div className="max-w-7xl mx-auto">
          <Skeleton className="h-20 w-full mb-8 bg-white/10" />
          <Skeleton className="h-64 w-full mb-8 bg-white/10" />
        </div>
      </div>
    );
  }

  if (studentError || !studentDetail) {
    return (
      <div className="flex-1 overflow-y-auto p-6 md:p-10">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-8">
            <AlertTriangle className="w-16 h-16 text-red-500/40 mx-auto mb-4" />
            <p className="text-white/60">Error al cargar la información del estudiante</p>
            <Button
              variant="ghost"
              onClick={() => setLocation(`/course-detail/${cursoId}`)}
              className="text-white/70 hover:text-white mt-4"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Volver al Curso
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-10">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Button
            variant="ghost"
            onClick={() => setLocation(`/course-detail/${cursoId}`)}
            className="text-white/70 hover:text-white mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver al Curso
          </Button>
          <div className="flex items-center gap-4 mb-6">
            <Avatar className="w-20 h-20">
              <AvatarFallback className="bg-gradient-to-r from-[#9f25b8] to-[#6a0dad] text-white text-2xl">
                {studentDetail.nombre.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div>
              <h1 className="text-4xl font-bold text-white mb-2 font-['Poppins']">
                {studentDetail.nombre}
              </h1>
              <p className="text-white/60">{studentDetail.email}</p>
              {studentDetail.curso && (
                <Badge className="mt-2 bg-[#9f25b8]/20 text-white border-[#9f25b8]/40">
                  Grupo {studentDetail.curso}
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Información Personal */}
        <Card className="bg-white/5 border-white/10 backdrop-blur-md mb-8">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <User className="w-5 h-5 text-[#9f25b8]" />
              Información Personal
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex items-start gap-3">
                <Mail className="w-5 h-5 text-[#9f25b8] mt-1 flex-shrink-0" />
                <div>
                  <p className="text-sm text-white/60 mb-1">Correo Electrónico</p>
                  <p className="text-white font-medium">{studentDetail.email || '-'}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Phone className="w-5 h-5 text-[#9f25b8] mt-1 flex-shrink-0" />
                <div>
                  <p className="text-sm text-white/60 mb-1">Teléfono</p>
                  <p className="text-white font-medium">
                    {studentDetail.telefono || studentDetail.celular || '-'}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <MapPin className="w-5 h-5 text-[#9f25b8] mt-1 flex-shrink-0" />
                <div>
                  <p className="text-sm text-white/60 mb-1">Dirección</p>
                  <p className="text-white font-medium">
                    {studentDetail.direccion 
                      ? `${studentDetail.direccion}${studentDetail.barrio ? `, ${studentDetail.barrio}` : ''}${studentDetail.ciudad ? `, ${studentDetail.ciudad}` : ''}`
                      : '-'}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Calendar className="w-5 h-5 text-[#9f25b8] mt-1 flex-shrink-0" />
                <div>
                  <p className="text-sm text-white/60 mb-1">Fecha de Nacimiento</p>
                  <p className="text-white font-medium">
                    {studentDetail.fechaNacimiento
                      ? new Date(studentDetail.fechaNacimiento).toLocaleDateString('es-CO', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })
                      : '-'}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <School className="w-5 h-5 text-[#9f25b8] mt-1 flex-shrink-0" />
                <div>
                  <p className="text-sm text-white/60 mb-1">Grupo</p>
                  <p className="text-white font-medium">{studentDetail.curso || '-'}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Notas Específicas */}
        <Card className="bg-white/5 border-white/10 backdrop-blur-md mb-8">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-white flex items-center gap-2">
                  <Award className="w-5 h-5 text-[#9f25b8]" />
                  Notas Específicas
                </CardTitle>
                <CardDescription className="text-white/60 mt-2">
                  Historial completo de calificaciones (Escala: 10-100)
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-3xl font-bold text-white">
                  {promedioFinal}
                </span>
                <span className="text-white/50 text-lg">/ 100</span>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {notes.length > 0 ? (
              <div className="space-y-4">
                {notes.map((nota, idx) => (
                  <div
                    key={idx}
                    className="p-4 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-all"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h4 className="font-semibold text-white">{nota.actividad}</h4>
                          <Badge className="bg-[#9f25b8]/20 text-white border-[#9f25b8]/40 text-xs">
                            {nota.categoria}
                          </Badge>
                        </div>
                        <p className="text-sm text-white/60">
                          {new Date(nota.fecha).toLocaleDateString('es-CO', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          })}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-2xl font-bold text-white">
                          {nota.nota}
                        </span>
                        <span className="text-white/50">/ 100</span>
                      </div>
                    </div>
                    {nota.comentario && (
                      <div className="mt-3 p-3 bg-white/5 rounded-lg border border-white/10">
                        <div className="flex items-start gap-2">
                          <MessageSquare className="w-4 h-4 text-[#9f25b8] mt-0.5 flex-shrink-0" />
                          <p className="text-sm text-white/80">{nota.comentario}</p>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Award className="w-16 h-16 text-white/20 mx-auto mb-4" />
                <p className="text-white/60">No hay notas registradas</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Amonestaciones */}
        <Card className="bg-red-500/10 border-red-500/30 backdrop-blur-md mb-8">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-red-300 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-red-400" />
                  Amonestaciones
                </CardTitle>
                <CardDescription className="text-red-200/60 mt-2">
                  Registro de amonestaciones disciplinarias
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-3xl font-bold text-red-300">
                  {totalAmonestaciones}
                </span>
                <span className="text-red-200/50 text-lg">amonestaciones</span>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {amonestaciones.length > 0 ? (
              <div className="space-y-4">
                {amonestaciones.map((amonestacion) => (
                  <div
                    key={amonestacion._id}
                    className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg hover:bg-red-500/15 transition-all"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <Badge className={getGravedadColor(amonestacion.gravedad)}>
                            {amonestacion.gravedad.charAt(0).toUpperCase() + amonestacion.gravedad.slice(1)}
                          </Badge>
                          <span className="text-red-300 font-semibold">
                            Cantidad: {amonestacion.cantidad}
                          </span>
                        </div>
                        <p className="text-red-200 font-medium mb-2">{amonestacion.razon}</p>
                        <div className="flex items-center gap-4 text-sm text-red-200/70">
                          <div className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            <span>
                              {new Date(amonestacion.fecha).toLocaleDateString('es-CO', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric'
                              })}
                            </span>
                          </div>
                          {amonestacion.registradoPor && (
                            <div className="flex items-center gap-1">
                              <User className="w-4 h-4" />
                              <span>{amonestacion.registradoPor}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <AlertTriangle className="w-16 h-16 text-red-500/20 mx-auto mb-4" />
                <p className="text-red-200/60">No hay amonestaciones registradas</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

