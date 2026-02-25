import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { useAuth } from '@/lib/authContext';
import { Search, MessageCircle, Users, BookOpen, Clock } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { NavBackButton } from '@/components/nav-back-button';

interface AcademicGroup {
  materiaId: string;
  materiaNombre: string;
  materiaDescripcion?: string;
  profesores: Array<{
    _id: string;
    nombre: string;
    email: string;
  }>;
  estudiantes: Array<{
    _id: string;
    nombre: string;
    email: string;
  }>;
  cursos: string[];
  ultimoMensaje?: {
    texto: string;
    fecha: Date;
    remitente: string;
  } | null;
  mensajesSinLeer: number;
}

const fetchAcademicGroups = async (): Promise<AcademicGroup[]> => {
  const token = localStorage.getItem('token');
  const response = await fetch('/api/courses/academic-groups', {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error('Error al obtener grupos académicos');
  }

  return response.json();
};

const ComunicacionAcademico: React.FC = () => {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');

  const { data: groups = [], isLoading, error } = useQuery<AcademicGroup[]>({
    queryKey: ['academic-groups'],
    queryFn: fetchAcademicGroups,
  });

  const filteredGroups = groups.filter((group) =>
    group.materiaNombre.toLowerCase().includes(searchQuery.toLowerCase()) ||
    group.profesores.some((p) => p.nombre.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getTotalParticipants = (group: AcademicGroup) => {
    return group.profesores.length + group.estudiantes.length;
  };

  const formatTime = (date?: Date) => {
    if (!date) return '';
    const now = new Date();
    const messageDate = new Date(date);
    const diff = now.getTime() - messageDate.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) {
      return messageDate.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    } else if (days === 1) {
      return 'Ayer';
    } else if (days < 7) {
      return messageDate.toLocaleDateString('es-ES', { weekday: 'short' });
    } else {
      return messageDate.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
    }
  };

  const handleGroupClick = (materiaId: string) => {
    // Navegar a la conversación del grupo
    setLocation(`/comunicacion/academico/${materiaId}`);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-white/70">Cargando grupos académicos...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-red-400">Error al cargar los grupos académicos</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <NavBackButton to="/comunicacion" label="Comunicación" />
      {/* Header */}
      <div className="flex items-center gap-4">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight text-white font-['Poppins']">
            Comunicación Académica
          </h1>
          <p className="text-lg text-white/70 mt-2">
            Grupos de materias - Estilo WhatsApp
          </p>
        </div>
      </div>

      {/* Search Bar */}
      <Card className="bg-white/5 border-white/10 backdrop-blur-md">
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-white/50" />
            <Input
              type="text"
              placeholder="Buscar materias o profesores..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-white/10 border-white/20 text-white placeholder:text-white/50 focus:border-[#1e3cff]"
            />
          </div>
        </CardContent>
      </Card>

      {/* Groups List */}
      <div className="space-y-2">
        {filteredGroups.length === 0 ? (
          <Card className="bg-white/5 border-white/10 backdrop-blur-md">
            <CardContent className="p-12 text-center">
              <MessageCircle className="w-16 h-16 text-white/30 mx-auto mb-4" />
              <p className="text-white/70 text-lg">
                {searchQuery ? 'No se encontraron grupos con ese criterio' : 'No hay grupos académicos disponibles'}
              </p>
            </CardContent>
          </Card>
        ) : (
          filteredGroups.map((group) => (
            <Card
              key={group.materiaId}
              className="bg-white/5 border-white/10 backdrop-blur-md hover:bg-white/10 cursor-pointer transition-all duration-200 hover:shadow-lg"
              onClick={() => handleGroupClick(group.materiaId)}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  {/* Avatar del Grupo */}
                  <div className="relative">
                    <Avatar className="w-14 h-14 bg-gradient-to-br from-[#002366] to-[#1e3cff] border-2 border-white/20">
                      <AvatarFallback className="text-white font-bold text-lg">
                        {getInitials(group.materiaNombre)}
                      </AvatarFallback>
                    </Avatar>
                    {group.mensajesSinLeer > 0 && (
                      <div className="absolute -top-1 -right-1 w-6 h-6 bg-[#1e3cff] rounded-full flex items-center justify-center text-white text-xs font-bold border-2 border-[#0a0a0c]">
                        {group.mensajesSinLeer > 9 ? '9+' : group.mensajesSinLeer}
                      </div>
                    )}
                  </div>

                  {/* Contenido del Grupo */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="text-lg font-semibold text-white truncate">
                        {group.materiaNombre}
                      </h3>
                      {group.ultimoMensaje && (
                        <span className="text-xs text-white/50 flex-shrink-0 ml-2">
                          {formatTime(group.ultimoMensaje.fecha)}
                        </span>
                      )}
                    </div>

                    {/* Información del grupo */}
                    <div className="flex items-center gap-4 text-sm text-white/60 mb-2">
                      <div className="flex items-center gap-1">
                        <Users className="w-4 h-4" />
                        <span>{getTotalParticipants(group)} participantes</span>
                      </div>
                      {group.cursos.length > 0 && (
                        <div className="flex items-center gap-1">
                          <BookOpen className="w-4 h-4" />
                          <span>{group.cursos.join(', ')}</span>
                        </div>
                      )}
                    </div>

                    {/* Profesores */}
                    {group.profesores.length > 0 && (
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs text-white/50">Profesores:</span>
                        <span className="text-xs text-white/70">
                          {group.profesores.map((p) => p.nombre).join(', ')}
                        </span>
                      </div>
                    )}

                    {/* Último mensaje */}
                    {group.ultimoMensaje ? (
                      <p className="text-sm text-white/70 truncate flex items-center gap-1">
                        <span className="font-medium text-white/90">
                          {group.ultimoMensaje.remitente}:
                        </span>
                        {group.ultimoMensaje.texto}
                      </p>
                    ) : (
                      <p className="text-sm text-white/50 italic">
                        No hay mensajes aún
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};

export default ComunicacionAcademico;

