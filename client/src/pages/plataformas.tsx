import { useAuth } from '@/lib/authContext';
import { ExternalLink, Mail, Calendar, FileText, FolderOpen, Video, MessageCircle, Users, PenTool, BarChart3, Globe, MonitorPlay } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useLocation } from 'wouter';
import { NavBackButton } from '@/components/nav-back-button';

const plataformas = [
  {
    id: 'gmail',
    nombre: 'Gmail',
    descripcion: 'Correo electrónico institucional',
    url: 'https://mail.google.com',
    icono: Mail,
    color: 'from-red-500 to-red-600'
  },
  {
    id: 'drive',
    nombre: 'Google Drive',
    descripcion: 'Almacenamiento en la nube',
    url: 'https://drive.google.com',
    icono: FolderOpen,
    color: 'from-yellow-500 to-yellow-600'
  },
  {
    id: 'docs',
    nombre: 'Google Docs',
    descripcion: 'Documentos de texto',
    url: 'https://docs.google.com',
    icono: FileText,
    color: 'from-blue-500 to-blue-600'
  },
  {
    id: 'sheets',
    nombre: 'Google Sheets',
    descripcion: 'Hojas de cálculo',
    url: 'https://sheets.google.com',
    icono: BarChart3,
    color: 'from-green-500 to-green-600'
  },
  {
    id: 'Cengage',
    nombre: 'Webassign ',
    descripcion: 'Trabajos Matemáticas',
    url: 'https://www.cengage.com/',
    icono: MonitorPlay,
    color: 'from-orange-500 to-orange-600'
  },
  {
    id: 'calendar',
    nombre: 'Google Calendar',
    descripcion: 'Calendario y eventos',
    url: 'https://calendar.google.com',
    icono: Calendar,
    color: 'from-blue-400 to-blue-500'
  },
  {
    id: 'meet',
    nombre: 'Google Meet',
    descripcion: 'Videollamadas',
    url: 'https://meet.google.com',
    icono: Video,
    color: 'from-green-600 to-teal-500'
  },
  {
    id: 'chat',
    nombre: 'Google Chat',
    descripcion: 'Mensajería instantánea',
    url: 'https://chat.google.com',
    icono: MessageCircle,
    color: 'from-green-500 to-green-600'
  },
  {
    id: 'classroom',
    nombre: 'Google Classroom',
    descripcion: 'Gestión de clases',
    url: 'https://classroom.google.com',
    icono: Users,
    color: 'from-yellow-600 to-orange-500'
  },
  {
    id: 'forms',
    nombre: 'Google Forms',
    descripcion: 'Formularios y encuestas',
    url: 'https://forms.google.com',
    icono: PenTool,
    color: 'from-[#002366] to-[#003d7a]'
  },
  {
    id: 'sites',
    nombre: 'Google Sites',
    descripcion: 'Creación de sitios web',
    url: 'https://sites.google.com',
    icono: Globe,
    color: 'from-indigo-500 to-indigo-600'
  },
  {
    id: 'keep',
    nombre: 'Google Keep',
    descripcion: 'Notas y recordatorios',
    url: 'https://keep.google.com',
    icono: FileText,
    color: 'from-amber-400 to-amber-500'
  }
];

export default function PlataformasPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  
  return (
    <div className="flex-1 overflow-auto p-8">
            <div className="max-w-7xl mx-auto">
              <NavBackButton />
              <div className="mb-8">
                <h2 className="text-3xl font-bold text-white mb-2 font-['Poppins']">
                  Herramientas Google Workspace
                </h2>
                <p className="text-white/60">
                  Accede a todas las aplicaciones de Google Workspace para tu trabajo educativo
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {plataformas.map((plataforma) => {
                  const IconComponent = plataforma.icono;
                  return (
                    <Card 
                      key={plataforma.id} 
                      className="backdrop-blur-md hover-elevate group bg-white/5 border-white/10"
                      data-testid={`card-plataforma-${plataforma.id}`}
                    >
                      <CardHeader className="pb-3">
                        <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${plataforma.color} flex items-center justify-center mb-3`}>
                          <IconComponent className="w-6 h-6 text-white" />
                        </div>
                        <CardTitle className="text-white text-lg">
                          {plataforma.nombre}
                        </CardTitle>
                        <CardDescription className="text-white/60 text-sm">
                          {plataforma.descripcion}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <Button
                          onClick={() => window.open(plataforma.url, '_blank')}
                          className="w-full hover:opacity-90 bg-gradient-to-r from-[#002366] to-[#1e3cff]"
                          data-testid={`button-open-${plataforma.id}`}
                        >
                          <ExternalLink className="w-4 h-4 mr-2" />
                          Abrir
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
    </div>
  );
}
