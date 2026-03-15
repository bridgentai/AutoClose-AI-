import { useAuth } from '@/lib/authContext';
import { useLocation } from 'wouter';
import kiwiMascot from '@/assets/Kiwi.png';
import { Button } from '@/components/ui/button';
import {
  GraduationCap,
  BookOpen,
  MessageSquare,
  Users,
  BarChart3,
  Shield,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  Compass,
  Clock,
  TrendingUp,
  User,
  Settings,
  Truck,
  Wallet,
  Apple,
  Coffee,
  UserCog
} from 'lucide-react';

/* Azules más claros para el landing: gradiente suave y luminoso */
const PLATFORM = {
  bgRadial: 'radial-gradient(circle at 20% 20%, #3B82F6 0%, #1D4ED8 25%, #1E40AF 50%, #1E3A8A 75%, #0F172A 100%)',
  primary: '#3B82F6',
  primaryHover: '#2563EB',
  primaryDark: '#1D4ED8',
};

export default function Home() {
  const { user, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();

  const handleCTA = () => {
    if (isAuthenticated) {
      setLocation('/chat');
    } else {
      setLocation('/login');
    }
  };

  const getRoleSpecificContent = () => {
    if (!isAuthenticated || !user) return null;

    const roleContent = {
      estudiante: {
        title: "Tu Asistente de Estudio Personalizado",
        features: [
          "Asistencia 24/7 con tus tareas y estudios",
          "Acceso a materiales de todos tus cursos",
          "Seguimiento de tu progreso académico",
          "Preparación para exámenes personalizadas"
        ]
      },
      profesor: {
        title: "Potencia tu Enseñanza con IA",
        features: [
          "Crea y gestiona cursos fácilmente",
          "Genera materiales educativos automáticamente",
          "Monitorea el progreso de tus estudiantes",
          "Asistente IA para responder dudas frecuentes"
        ]
      },
      directivo: {
        title: "Gestión Académica Inteligente",
        features: [
          "Análisis y métricas institucionales en tiempo real",
          "Gestión centralizada de toda la institución",
          "Configuración personalizada del sistema",
          "Reportes automáticos de rendimiento"
        ]
      },
      padre: {
        title: "Seguimiento del Progreso de tu Hijo",
        features: [
          "Consulta el rendimiento académico en tiempo real",
          "Comunicación directa con profesores",
          "Acceso a materiales y tareas",
          "Notificaciones de eventos importantes"
        ]
      }
    };

    const content = roleContent[user.rol as keyof typeof roleContent];
    if (!content) return null;

    return (
      <div className="mt-16 max-w-2xl mx-auto backdrop-blur-xl bg-white/5 border border-white/10 rounded-3xl p-8">
        <h3 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
          <Sparkles className="w-6 h-6" style={{ color: PLATFORM.primary }} />
          {content.title}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {content.features.map((feature, idx) => (
            <div key={idx} className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: PLATFORM.primary }} />
              <span className="text-white/80">{feature}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen w-full relative overflow-hidden" style={{ color: '#E2E8F0' }}>
      {/* Fondo base con gradiente */}
      <div
        className="fixed inset-0 -z-10"
        style={{
          background: PLATFORM.bgRadial,
          minHeight: '100vh',
          backgroundAttachment: 'fixed',
        }}
        aria-hidden
      />
      {/* Capa de gradiente animado (movimiento suave) */}
      <div
        className="fixed inset-0 -z-10 opacity-40"
        style={{
          background: 'radial-gradient(circle at 30% 30%, rgba(59, 130, 246, 0.35) 0%, transparent 50%), radial-gradient(circle at 70% 70%, rgba(29, 78, 216, 0.25) 0%, transparent 50%)',
          backgroundSize: '200% 200%',
          minHeight: '100vh',
          backgroundAttachment: 'fixed',
          animation: 'gradient-flow 20s ease-in-out infinite',
        }}
        aria-hidden
      />
      {/* Orbes flotantes animados */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <div
          className="absolute top-20 left-10 w-[28rem] h-[28rem] rounded-full blur-3xl opacity-25 animate-float-slow"
          style={{ backgroundColor: PLATFORM.primary }}
        />
        <div
          className="absolute bottom-20 right-20 w-80 h-80 rounded-full blur-3xl opacity-20 animate-float-slow"
          style={{ backgroundColor: PLATFORM.primaryDark, animationDelay: '2s' }}
        />
        <div
          className="absolute top-1/2 left-1/2 w-96 h-96 -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl opacity-10 animate-float-slow"
          style={{ backgroundColor: '#1E40AF', animationDelay: '4s' }}
        />
      </div>

      <header className="fixed top-0 left-0 right-0 w-full backdrop-blur-xl bg-black/30 border-b border-white/10 z-50" style={{ color: '#E2E8F0' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: `linear-gradient(145deg, ${PLATFORM.primary}, ${PLATFORM.primaryDark})` }}
            >
              <span className="text-white font-bold text-lg">evo</span>
            </div>
            <span className="text-xl font-bold text-white font-['Poppins'] tracking-tight">Caobos</span>
          </div>

          <div className="flex items-center gap-4">
            {isAuthenticated ? (
              <>
                <span className="text-white/70 text-sm hidden md:block">
                  Hola, <span className="text-white font-medium">{user?.nombre?.split(' ')[0] || 'Usuario'}</span>
                </span>
                <Button
                  onClick={() => setLocation('/dashboard')}
                  variant="outline"
                  className="border-white/20 text-white hover:bg-white/10"
                  data-testid="button-dashboard"
                >
                  Dashboard
                </Button>
              </>
            ) : (
              <>
                <Button
                  onClick={() => setLocation('/login')}
                  variant="ghost"
                  className="text-white hover:bg-white/10"
                  data-testid="button-login-nav"
                >
                  Iniciar Sesión
                </Button>
                <Button
                  onClick={() => setLocation('/register')}
                  style={{ background: PLATFORM.primary, color: 'white' }}
                  className="hover:opacity-90 rounded-lg"
                  data-testid="button-register-nav"
                >
                  Registrarse
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero: texto izquierda, Kiwi derecha */}
      <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8 w-full" style={{ color: '#E2E8F0' }}>
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 border border-white/10 mb-8">
                <Compass className="w-4 h-4 text-white/80" />
                <span className="text-white/90 text-sm font-medium">Desarrollado por Bridgent</span>
              </div>

              <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold mb-4 font-['Poppins'] text-left leading-tight">
                <span className="text-white">La Plataforma Educativa</span>
                <br />
                <span className="text-white">del Futuro</span>
              </h1>

              <p className="text-2xl md:text-3xl font-bold text-white/95 mb-4 font-['Poppins'] tracking-tight text-left">
                Gimnasio Los Caobos
              </p>

              <p className="text-lg md:text-xl text-white/70 mb-8 leading-relaxed text-left max-w-xl">
                Centraliza todo el ecosistema educativo de tu institución en una sola plataforma
                inteligente. Un asistente IA personalizado que conoce tu currículo específico.
              </p>

              {getRoleSpecificContent()}

              <div className="flex flex-col sm:flex-row items-start gap-4 mt-8">
                <Button
                  onClick={handleCTA}
                  size="lg"
                  style={{ background: PLATFORM.primary, color: 'white' }}
                  className="hover:opacity-90 text-lg px-8 py-6 rounded-xl"
                  data-testid="button-cta-main"
                >
                  {isAuthenticated ? (
                    <>Ir al Chat IA <MessageSquare className="ml-2 w-5 h-5" /></>
                  ) : (
                    <>Comenzar Ahora <ArrowRight className="ml-2 w-5 h-5" /></>
                  )}
                </Button>
                {!isAuthenticated && (
                  <Button
                    onClick={() => setLocation('/register')}
                    size="lg"
                    variant="outline"
                    className="border-white/20 text-white hover:bg-white/10 text-lg px-8 py-6 rounded-xl"
                    data-testid="button-cta-register"
                  >
                    Crear Cuenta Gratis
                  </Button>
                )}
              </div>
            </div>

            <div className="flex justify-center lg:justify-end">
              <img
                src={kiwiMascot}
                alt="Kiwi - Mascota Caobos"
                className="w-full max-w-md lg:max-w-lg xl:max-w-xl h-auto object-contain select-none"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Features - mismo estilo glass que la plataforma */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 w-full">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-4 font-['Poppins']">
              Todo lo que Necesitas en un Solo Lugar
            </h2>
            <p className="text-white/70 text-lg max-w-2xl mx-auto">
              Reemplaza herramientas dispersas con una plataforma unificada
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { icon: MessageSquare, title: "Asistente IA Personalizado", description: "IA que conoce tu currículo y responde consultas académicas 24/7" },
              { icon: BookOpen, title: "Gestión de Cursos", description: "Organiza cursos, materiales y tareas en una interfaz intuitiva" },
              { icon: Users, title: "Multi-Rol", description: "Interfaces para estudiantes, profesores, directivos y padres" },
              { icon: BarChart3, title: "Análisis en Tiempo Real", description: "Métricas y reportes automáticos del rendimiento académico" },
              { icon: Shield, title: "Seguro y Privado", description: "Datos protegidos con encriptación y controles por rol" },
              { icon: Sparkles, title: "Personalización Total", description: "Configura logo, colores y nombre del asistente de tu institución" }
            ].map((feature, idx) => {
              const Icon = feature.icon;
              return (
                <div
                  key={idx}
                  className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-6 hover:border-white/20 transition-all group"
                >
                  <div
                    className="w-14 h-14 rounded-xl flex items-center justify-center mb-4 group-hover:scale-105 transition-transform"
                    style={{ background: `linear-gradient(145deg, ${PLATFORM.primary}, ${PLATFORM.primaryDark})` }}
                  >
                    <Icon className="w-7 h-7 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-3">{feature.title}</h3>
                  <p className="text-white/70 leading-relaxed">{feature.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Beneficios por rol */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 w-full">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-4 font-['Poppins']">
              Diseñado para Todos
            </h2>
            <p className="text-white/70 text-lg">Cada rol tiene una experiencia optimizada</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[
              { role: "Estudiantes", icon: GraduationCap, benefits: ["Asistencia personalizada", "Materiales organizados", "Seguimiento de progreso"] },
              { role: "Profesores", icon: BookOpen, benefits: ["Gestión de cursos", "Creación de materiales", "Análisis de estudiantes"] },
              { role: "Directivos", icon: BarChart3, benefits: ["Métricas institucionales", "Configuración global", "Reportes automáticos"] },
              { role: "Padres", icon: User, benefits: ["Seguimiento en tiempo real", "Comunicación directa", "Notificaciones"] },
              { role: "Administrador General", icon: Settings, benefits: ["Gestión del colegio", "Configuración del sistema", "Control de usuarios"] },
              { role: "Transporte", icon: Truck, benefits: ["Gestión de rutas", "Control de permisos", "Seguimiento de vehículos"] },
              { role: "Tesorería", icon: Wallet, benefits: ["Gestión de pagos", "Reportes financieros", "Facturación"] },
              { role: "Nutrición", icon: Apple, benefits: ["Planificación de menús", "Seguimiento nutricional", "Control de dietas"] },
              { role: "Cafetería", icon: Coffee, benefits: ["Gestión de pedidos", "Control de inventario", "Reportes de ventas"] },
              { role: "Asistente", icon: UserCog, benefits: ["Apoyo administrativo", "Gestión de secciones", "Coordinación académica"] }
            ].map((roleCard, idx) => {
              const Icon = roleCard.icon;
              return (
                <div
                  key={idx}
                  className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-6 hover:border-white/20 transition-all"
                >
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4" style={{ background: `${PLATFORM.primary}20` }}>
                    <Icon className="w-6 h-6" style={{ color: PLATFORM.primary }} />
                  </div>
                  <h3 className="text-lg font-bold text-white mb-4">{roleCard.role}</h3>
                  <ul className="space-y-2">
                    {roleCard.benefits.map((benefit, bidx) => (
                      <li key={bidx} className="flex items-start gap-2 text-white/70 text-sm">
                        <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: PLATFORM.primary }} />
                        <span>{benefit}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 w-full">
        <div className="max-w-7xl mx-auto">
          <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-3xl p-12">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
              {[
                { icon: Clock, value: "24/7", label: "Disponibilidad del Asistente IA" },
                { icon: TrendingUp, value: "100%", label: "Centralización de Herramientas" },
                { icon: Shield, value: "10+ Roles", label: "Perfiles de Usuario" }
              ].map((stat, idx) => {
                const Icon = stat.icon;
                return (
                  <div key={idx}>
                    <Icon className="w-12 h-12 mx-auto mb-4" style={{ color: PLATFORM.primary }} />
                    <div className="text-4xl font-bold text-white mb-2">{stat.value}</div>
                    <div className="text-white/70">{stat.label}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* CTA final */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 w-full">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6 font-['Poppins']">
            ¿Listo para Transformar tu Experiencia Educativa?
          </h2>
          <p className="text-white/70 text-lg mb-10 max-w-2xl mx-auto">
            {isAuthenticated
              ? "Comienza a explorar todas las funcionalidades de la plataforma"
              : "Únete y lleva tu institución educativa al siguiente nivel"
            }
          </p>
          <Button
            onClick={handleCTA}
            size="lg"
            style={{ background: PLATFORM.primary, color: 'white' }}
            className="hover:opacity-90 text-xl px-12 py-8 rounded-2xl"
            data-testid="button-cta-bottom"
          >
            {isAuthenticated ? (
              <>Ir al Chat IA <MessageSquare className="ml-3 w-6 h-6" /></>
            ) : (
              <>Comenzar Gratis <ArrowRight className="ml-3 w-6 h-6" /></>
            )}
          </Button>
        </div>
      </section>

      <footer className="border-t border-white/10 py-8 px-4 sm:px-6 lg:px-8 w-full bg-black/40">
        <div className="max-w-7xl mx-auto text-center">
          <p className="text-white/50 text-sm">
            © 2025 - Desarrollado por <span className="font-medium text-white/70">Bridgent</span>
          </p>
          <p className="text-white/40 text-xs mt-2">
            Plataforma educativa inteligente para instituciones académicas
          </p>
        </div>
      </footer>
    </div>
  );
}
