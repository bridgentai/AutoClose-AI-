import { useLocation } from 'wouter';
import { useAuth } from '@/lib/authContext';
import { getRoleHomePath } from '@/lib/roleRedirect';
import { Button } from '@/components/ui/button';
import { 
  LogIn, 
  UserPlus, 
  Users,
  GraduationCap,
  BookOpen,
  Shield,
  User,
  Truck,
  Wallet,
  Apple,
  Coffee,
  Settings
} from 'lucide-react';
import type { AuthResponse } from '@shared/schema';

type RoleType = 'estudiante' | 'profesor' | 'directivo' | 'padre' | 'administrador-general' | 'transporte' | 'tesoreria' | 'nutricion' | 'cafeteria';

interface RoleInfo {
  label: string;
  icon: typeof GraduationCap;
  color: string;
}

const rolesInfo: Record<RoleType, RoleInfo> = {
  estudiante: {
    label: 'Estudiante',
    icon: GraduationCap,
    color: 'from-blue-500 to-cyan-500'
  },
  profesor: {
    label: 'Profesor',
    icon: BookOpen,
    color: 'from-[#002366] to-[#003d7a]'
  },
  directivo: {
    label: 'Directivo',
    icon: Shield,
    color: 'from-orange-500 to-red-500'
  },
  padre: {
    label: 'Padre/Madre',
    icon: User,
    color: 'from-green-500 to-emerald-500'
  },
  'administrador-general': {
    label: 'Administrador General',
    icon: Settings,
    color: 'from-[#003d7a] to-[#1e3cff]'
  },
  transporte: {
    label: 'Transporte',
    icon: Truck,
    color: 'from-yellow-500 to-orange-500'
  },
  tesoreria: {
    label: 'Tesorería',
    icon: Wallet,
    color: 'from-green-600 to-teal-600'
  },
  nutricion: {
    label: 'Nutrición',
    icon: Apple,
    color: 'from-[#002366] to-[#003d7a]'
  },
  cafeteria: {
    label: 'Cafetería',
    icon: Coffee,
    color: 'from-amber-600 to-orange-600'
  }
};

export default function Entry() {
  const [, setLocation] = useLocation();
  const { login } = useAuth();

  const handleQuickLogin = (rol: RoleType) => {
    // Cursos disponibles para estudiantes
    const cursosDisponibles = ['9A', '9B', '10A', '10B', '11C', '11D', '11H', '12C', '12D', '12H'];
    
    // Materias comunes para profesores
    const materiasComunes = [
      'Matemáticas',
      'Español',
      'Ciencias Naturales',
      'Ciencias Sociales',
      'Inglés',
      'Física',
      'Química',
      'Biología',
      'Historia',
      'Geografía',
      'Filosofía',
      'Educación Física',
      'Arte',
      'Música',
      'Tecnología'
    ];

    // Generar datos específicos según el rol
    let mockUser: AuthResponse;

    switch (rol) {
      case 'estudiante': {
        const cursoAleatorio = cursosDisponibles[Math.floor(Math.random() * cursosDisponibles.length)];
        mockUser = {
          id: `dev_${rol}_${Date.now()}`,
          _id: `dev_${rol}_${Date.now()}`,
          nombre: `Estudiante ${cursoAleatorio}`,
          email: `estudiante.${cursoAleatorio.toLowerCase()}@dev.local`,
          rol: 'estudiante',
          curso: cursoAleatorio,
          colegioId: 'default_colegio',
          token: `dev_token_${rol}_${Date.now()}`,
          codigoUnico: Math.floor(1000 + Math.random() * 9000).toString()
        };
        break;
      }

      case 'profesor': {
        // Asignar 1-3 materias aleatorias
        const numMaterias = Math.floor(Math.random() * 3) + 1;
        const materiasSeleccionadas = materiasComunes
          .sort(() => 0.5 - Math.random())
          .slice(0, numMaterias);
        
        mockUser = {
          id: `dev_${rol}_${Date.now()}`,
          _id: `dev_${rol}_${Date.now()}`,
          nombre: `Prof. ${materiasSeleccionadas[0]}`,
          email: `profesor.${materiasSeleccionadas[0].toLowerCase().replace(/\s+/g, '.')}@dev.local`,
          rol: 'profesor',
          materias: materiasSeleccionadas,
          colegioId: 'default_colegio',
          token: `dev_token_${rol}_${Date.now()}`,
          codigoUnico: Math.floor(1000 + Math.random() * 9000).toString()
        };
        break;
      }

      case 'padre': {
        // Para padre, crear un estudiante mock primero y usar su ID
        const cursoAleatorio = cursosDisponibles[Math.floor(Math.random() * cursosDisponibles.length)];
        const estudianteId = `dev_estudiante_${Date.now()}`;
        
        mockUser = {
          id: `dev_${rol}_${Date.now()}`,
          _id: `dev_${rol}_${Date.now()}`,
          nombre: `Padre/Madre de ${cursoAleatorio}`,
          email: `padre.${cursoAleatorio.toLowerCase()}@dev.local`,
          rol: 'padre',
          colegioId: 'default_colegio',
          token: `dev_token_${rol}_${Date.now()}`,
          codigoUnico: Math.floor(1000 + Math.random() * 9000).toString()
        };
        // Nota: hijoId se podría asignar si se crea el estudiante en el backend
        break;
      }

      case 'directivo': {
        mockUser = {
          id: `dev_${rol}_${Date.now()}`,
          _id: `dev_${rol}_${Date.now()}`,
          nombre: 'Directivo General',
          email: 'directivo@dev.local',
          rol: 'directivo',
          colegioId: 'default_colegio',
          token: `dev_token_${rol}_${Date.now()}`,
          codigoUnico: Math.floor(1000 + Math.random() * 9000).toString()
        };
        break;
      }

      case 'administrador-general': {
        mockUser = {
          id: `dev_${rol}_${Date.now()}`,
          _id: `dev_${rol}_${Date.now()}`,
          nombre: 'Administrador General',
          email: 'admin.general@dev.local',
          rol: 'administrador-general',
          colegioId: 'default_colegio',
          token: `dev_token_${rol}_${Date.now()}`,
          codigoUnico: Math.floor(1000 + Math.random() * 9000).toString()
        };
        break;
      }

      case 'transporte': {
        mockUser = {
          id: `dev_${rol}_${Date.now()}`,
          _id: `dev_${rol}_${Date.now()}`,
          nombre: 'Coordinador de Transporte',
          email: 'transporte@dev.local',
          rol: 'transporte',
          colegioId: 'default_colegio',
          token: `dev_token_${rol}_${Date.now()}`,
          codigoUnico: Math.floor(1000 + Math.random() * 9000).toString()
        };
        break;
      }

      case 'tesoreria': {
        mockUser = {
          id: `dev_${rol}_${Date.now()}`,
          _id: `dev_${rol}_${Date.now()}`,
          nombre: 'Coordinador de Tesorería',
          email: 'tesoreria@dev.local',
          rol: 'tesoreria',
          colegioId: 'default_colegio',
          token: `dev_token_${rol}_${Date.now()}`,
          codigoUnico: Math.floor(1000 + Math.random() * 9000).toString()
        };
        break;
      }

      case 'nutricion': {
        mockUser = {
          id: `dev_${rol}_${Date.now()}`,
          _id: `dev_${rol}_${Date.now()}`,
          nombre: 'Coordinador de Nutrición',
          email: 'nutricion@dev.local',
          rol: 'nutricion',
          colegioId: 'default_colegio',
          token: `dev_token_${rol}_${Date.now()}`,
          codigoUnico: Math.floor(1000 + Math.random() * 9000).toString()
        };
        break;
      }

      case 'cafeteria': {
        mockUser = {
          id: `dev_${rol}_${Date.now()}`,
          _id: `dev_${rol}_${Date.now()}`,
          nombre: 'Coordinador de Cafetería',
          email: 'cafeteria@dev.local',
          rol: 'cafeteria',
          colegioId: 'default_colegio',
          token: `dev_token_${rol}_${Date.now()}`,
          codigoUnico: Math.floor(1000 + Math.random() * 9000).toString()
        };
        break;
      }

      default: {
        mockUser = {
          id: `dev_${rol}_${Date.now()}`,
          _id: `dev_${rol}_${Date.now()}`,
          nombre: `Usuario ${rolesInfo[rol].label}`,
          email: `${rol}@dev.local`,
          rol,
          colegioId: 'default_colegio',
          token: `dev_token_${rol}_${Date.now()}`,
          codigoUnico: Math.floor(1000 + Math.random() * 9000).toString()
        };
      }
    }

    login(mockUser);
    const homePath = getRoleHomePath(rol);
    setLocation(homePath);
  };

  return (
    <div 
      className="min-h-screen flex items-center justify-center p-6 relative"
      style={{
        background: 'linear-gradient(135deg, #0a0a2a 0%, #002366 25%, #003d7a 50%, #002366 75%, #0a0a2a 100%)'
      }}
    >
      {/* Caobos en esquina */}
      <div className="absolute top-6 left-6 z-20">
        <span className="text-2xl font-bold text-white font-['Poppins'] tracking-tight">Caobos</span>
      </div>
      <div className="w-full max-w-6xl relative z-10">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex flex-col items-center gap-4 mb-6">
            <span className="text-white font-bold text-3xl font-['Poppins']">EvoOS</span>
          </div>
          <p className="text-white/70 text-lg">Plataforma Educativa Inteligente</p>
        </div>

        {/* Three Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card 1: Inicio de Sesión */}
          <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-3xl p-8 hover:border-[#1e3cff]/50 transition-all group">
            <div className="flex flex-col items-center text-center h-full">
              <div className="w-16 h-16 bg-gradient-to-br from-[#002366] to-[#1e3cff] rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <LogIn className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-4 font-['Poppins']">
                Inicio de Sesión
              </h3>
              <p className="text-white/70 mb-6 flex-grow">
                Accede a tu cuenta con tus credenciales
              </p>
              <Button
                onClick={() => setLocation('/login')}
                className="w-full bg-gradient-to-r from-[#002366] to-[#1e3cff] hover:opacity-90 text-white font-semibold"
              >
                Iniciar Sesión
              </Button>
            </div>
          </div>

          {/* Card 2: Registro */}
          <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-3xl p-8 hover:border-[#1e3cff]/50 transition-all group">
            <div className="flex flex-col items-center text-center h-full">
              <div className="w-16 h-16 bg-gradient-to-br from-[#002366] to-[#1e3cff] rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <UserPlus className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-4 font-['Poppins']">
                Registro
              </h3>
              <p className="text-white/70 mb-6 flex-grow">
                Crea una nueva cuenta en la plataforma
              </p>
              <Button
                onClick={() => setLocation('/register')}
                className="w-full bg-gradient-to-r from-[#002366] to-[#1e3cff] hover:opacity-90 text-white font-semibold"
              >
                Registrarse
              </Button>
            </div>
          </div>

          {/* Card 3: Roles (Desarrollo) */}
          <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-3xl p-8 hover:border-[#1e3cff]/50 transition-all group">
            <div className="flex flex-col items-center text-center h-full">
              <div className="w-16 h-16 bg-gradient-to-br from-[#002366] to-[#1e3cff] rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Users className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-4 font-['Poppins']">
                Roles
              </h3>
              <p className="text-white/70 mb-6 text-sm">
                Acceso rápido para desarrollo
              </p>
              <div className="w-full space-y-2 max-h-96 overflow-y-auto">
                {(Object.keys(rolesInfo) as RoleType[]).map((rol) => {
                  const roleInfo = rolesInfo[rol];
                  const Icon = roleInfo.icon;
                  return (
                    <Button
                      key={rol}
                      onClick={() => handleQuickLogin(rol)}
                      variant="outline"
                      className="w-full border-white/20 text-white hover:bg-white/10 hover:border-[#1e3cff]/50 justify-start gap-3"
                    >
                      <Icon className="w-4 h-4" />
                      <span>{roleInfo.label}</span>
                    </Button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Footer Note */}
        <div className="mt-8 text-center">
          <p className="text-white/40 text-xs">
            Modo desarrollo activo - Los roles permiten acceso directo sin autenticación
          </p>
        </div>
      </div>
    </div>
  );
}

