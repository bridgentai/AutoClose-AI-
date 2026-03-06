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
      <div className="mt-16 max-w-2xl mx-auto backdrop-blur-xl bg-white/5 border border-[#1e3cff]/30 rounded-3xl p-8">
        <h3 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
          <Sparkles className="w-6 h-6 text-[#1e3cff]" />
          {content.title}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {content.features.map((feature, idx) => (
            <div key={idx} className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-[#1e3cff] flex-shrink-0 mt-0.5" />
              <span className="text-white/80">{feature}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen w-full relative overflow-hidden">
      {/* Fondo animado - gradiente vertical (top dark → bottom bright) */}
      <div
        className="fixed inset-0 -z-10 animate-gradient-flow"
        style={{
          background: "linear-gradient(180deg, #0a0a2a 0%, #002366 20%, #003d7a 45%, #1e3cff 70%, #00c8ff 90%, #003d7a 100%)",
          backgroundSize: "400% 400%",
          backgroundPosition: "0% 50%",
        }}
        aria-hidden
      />
      {/* Header - full width */}
      <header className="fixed top-0 left-0 right-0 w-full backdrop-blur-xl bg-black/30 border-b border-white/10 z-50">
        <div className="w-full px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <span className="text-xl font-bold text-white font-['Poppins'] tracking-tight">Caobos</span>

          <div className="flex items-center gap-4">
            {isAuthenticated ? (
              <>
                <span className="text-white/70 text-sm hidden md:block">
                  Hola, <span className="text-white font-medium">{user?.nombre?.split(' ')[0] || 'Usuario'}</span>
                </span>
                <Button
                  onClick={() => setLocation('/dashboard')}
                  variant="outline"
                  className="border-[#1e3cff]/50 text-white hover:bg-[#1e3cff]/20"
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
                  className="bg-[#002366] hover:opacity-90 text-white rounded-lg"
                  data-testid="button-register-nav"
                >
                  Registrarse
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section - layout dos columnas: texto izquierda, mascota derecha */}
      <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8 w-full">
        <div className="w-full max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8 items-center">
            {/* Columna izquierda: texto y CTAs */}
            <div>
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-black/30 border border-[#1e3cff]/40 mb-8">
                <Compass className="w-4 h-4 text-[#1e3cff]" />
                <span className="text-white/90 text-sm font-medium">Desarrollado por Bridgent</span>
              </div>

              <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold mb-4 font-['Poppins'] text-left leading-tight">
                <span className="bg-gradient-to-r from-[#1e3cff] to-[#00c8ff] bg-clip-text text-transparent">
                  La Plataforma Educativa
                </span>
                <br />
                <span className="text-white">del Futuro</span>
              </h1>

              <p className="text-4xl md:text-5xl lg:text-6xl font-bold text-white/95 mb-6 font-['Poppins'] tracking-tight text-left">
                Gimnasio Los Caobos
              </p>

              <p className="text-xl md:text-2xl text-white/70 mb-8 leading-relaxed text-left max-w-2xl">
                MindOS centraliza todo el ecosistema educativo de tu institución en una sola plataforma
                inteligente. Reemplaza herramientas dispersas con un asistente IA personalizado que conoce
                tu currículo específico.
              </p>

              {/* Role-specific content for authenticated users */}
              {getRoleSpecificContent()}
            </div>

            {/* Columna derecha: Kiwi arriba + botones abajo */}
            <div className="flex flex-col items-center lg:items-end gap-6">
              {/* Kiwi más arriba y un poco más grande */}
              <div className="relative min-h-[380px] sm:min-h-[440px] lg:min-h-[520px] flex justify-center lg:justify-end items-center w-full">
                <div
                  className="absolute bottom-1/4 left-1/2 -translate-x-1/2 w-[500px] sm:w-[620px] lg:w-[800px] h-[280px] sm:h-[340px] lg:h-[440px] rounded-full opacity-60 pointer-events-none"
                  style={{
                    background: 'radial-gradient(ellipse 60% 50% at 50% 100%, rgba(30, 60, 255, 0.4) 0%, rgba(0, 200, 255, 0.2) 35%, transparent 70%)',
                  }}
                  aria-hidden
                />
                <div className="relative z-10 flex justify-center lg:justify-end w-full max-w-[380px] sm:max-w-[460px] lg:max-w-[560px] xl:max-w-[640px] 2xl:max-w-[720px]">
                  <img
                    src={kiwiMascot}
                    alt="Kiwi - Mascota Caobos"
                    className="w-full h-auto object-contain object-center select-none"
                  />
                </div>
              </div>
              {/* Botones debajo de Kiwi */}
              <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-end gap-4 w-full">
                <Button
                  onClick={handleCTA}
                  size="lg"
                  className="bg-[#002366] hover:opacity-90 text-white text-lg px-8 py-6 rounded-xl"
                  data-testid="button-cta-main"
                >
                  {isAuthenticated ? (
                    <>
                      Ir al Chat IA <MessageSquare className="ml-2 w-5 h-5" />
                    </>
                  ) : (
                    <>
                      Comenzar Ahora <ArrowRight className="ml-2 w-5 h-5" />
                    </>
                  )}
                </Button>
                {!isAuthenticated && (
                  <Button
                    onClick={() => setLocation('/register')}
                    size="lg"
                    variant="outline"
                    className="border-[#00c8ff]/50 text-white bg-transparent hover:bg-white/10 text-lg px-8 py-6 rounded-xl"
                    data-testid="button-cta-register"
                  >
                    Crear Cuenta Gratis
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 w-full">
        <div className="w-full">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-4 font-['Poppins']">
              Todo lo que Necesitas en un Solo Lugar
            </h2>
            <p className="text-white/70 text-lg max-w-2xl mx-auto">
              Reemplaza Phidias, Classroom, Excel y más herramientas dispersas con una plataforma unificada
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                icon: MessageSquare,
                title: "Asistente IA Personalizado",
                description: "IA que conoce tu currículo específico y responde consultas académicas 24/7"
              },
              {
                icon: BookOpen,
                title: "Gestión de Cursos",
                description: "Organiza cursos, materiales y tareas en una interfaz intuitiva"
              },
              {
                icon: Users,
                title: "Multi-Rol",
                description: "Interfaces específicas para estudiantes, profesores, directivos y padres"
              },
              {
                icon: BarChart3,
                title: "Análisis en Tiempo Real",
                description: "Métricas y reportes automáticos del rendimiento académico"
              },
              {
                icon: Shield,
                title: "Seguro y Privado",
                description: "Datos protegidos con encriptación y controles de acceso por rol"
              },
              {
                icon: Sparkles,
                title: "Personalización Total",
                description: "Configura logo, colores y nombre del asistente IA de tu institución"
              }
            ].map((feature, idx) => {
              const Icon = feature.icon;
              return (
                <div
                  key={idx}
                  className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-6 hover:border-[#1e3cff]/50 transition-all group"
                >
                  <div className="w-14 h-14 bg-gradient-to-br from-[#002366] to-[#1e3cff] rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
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

      {/* Benefits by Role */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 w-full">
        <div className="w-full">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-4 font-['Poppins']">
              Diseñado para Todos
            </h2>
            <p className="text-white/70 text-lg">
              Cada rol tiene una experiencia optimizada
            </p>
          </div>

          <div className="space-y-6">
            {/* Primeras 8 tarjetas en grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {[
                {
                  role: "Estudiantes",
                  icon: GraduationCap,
                  benefits: ["Asistencia personalizada", "Materiales organizados", "Seguimiento de progreso"]
                },
                {
                  role: "Profesores",
                  icon: BookOpen,
                  benefits: ["Gestión de cursos", "Creación de materiales", "Análisis de estudiantes"]
                },
                {
                  role: "Directivos",
                  icon: BarChart3,
                  benefits: ["Métricas institucionales", "Configuración global", "Reportes automáticos"]
                },
                {
                  role: "Padres",
                  icon: User,
                  benefits: ["Seguimiento en tiempo real", "Comunicación directa", "Notificaciones"]
                },
                {
                  role: "Administrador General",
                  icon: Settings,
                  benefits: ["Gestión completa del colegio", "Configuración del sistema", "Control de usuarios"]
                },
                {
                  role: "Transporte",
                  icon: Truck,
                  benefits: ["Gestión de rutas", "Control de permisos", "Seguimiento de vehículos"]
                },
                {
                  role: "Tesorería",
                  icon: Wallet,
                  benefits: ["Gestión de pagos", "Reportes financieros", "Control de facturación"]
                },
                {
                  role: "Nutrición",
                  icon: Apple,
                  benefits: ["Planificación de menús", "Seguimiento nutricional", "Control de dietas"]
                }
              ].map((roleCard, idx) => {
                const Icon = roleCard.icon;
                return (
                  <div
                    key={idx}
                    className="backdrop-blur-xl bg-gradient-to-br from-white/5 to-white/0 border border-white/10 rounded-2xl p-6 hover:border-[#1e3cff]/50 transition-all"
                  >
                    <div className="w-12 h-12 bg-[#1e3cff]/20 rounded-xl flex items-center justify-center mb-4">
                      <Icon className="w-6 h-6 text-[#1e3cff]" />
                    </div>
                    <h3 className="text-lg font-bold text-white mb-4">{roleCard.role}</h3>
                    <ul className="space-y-2">
                      {roleCard.benefits.map((benefit, bidx) => (
                        <li key={bidx} className="flex items-start gap-2 text-white/70 text-sm">
                          <CheckCircle2 className="w-4 h-4 text-[#1e3cff] flex-shrink-0 mt-0.5" />
                          <span>{benefit}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
            
            {/* Últimas 2 tarjetas centradas */}
            <div className="flex flex-wrap justify-center gap-6">
              {[
                {
                  role: "Cafetería",
                  icon: Coffee,
                  benefits: ["Gestión de pedidos", "Control de inventario", "Reportes de ventas"]
                },
                {
                  role: "Asistente",
                  icon: UserCog,
                  benefits: ["Apoyo administrativo", "Gestión de secciones", "Coordinación académica"]
                }
              ].map((roleCard, idx) => {
                const Icon = roleCard.icon;
                return (
                  <div
                    key={idx}
                    className="backdrop-blur-xl bg-gradient-to-br from-white/5 to-white/0 border border-white/10 rounded-2xl p-6 hover:border-[#1e3cff]/50 transition-all w-full md:w-[calc(50%-0.75rem)] lg:w-[calc(33.333%-1rem)] xl:w-[calc(25%-1.5rem)]"
                  >
                    <div className="w-12 h-12 bg-[#1e3cff]/20 rounded-xl flex items-center justify-center mb-4">
                      <Icon className="w-6 h-6 text-[#1e3cff]" />
                    </div>
                    <h3 className="text-lg font-bold text-white mb-4">{roleCard.role}</h3>
                    <ul className="space-y-2">
                      {roleCard.benefits.map((benefit, bidx) => (
                        <li key={bidx} className="flex items-start gap-2 text-white/70 text-sm">
                          <CheckCircle2 className="w-4 h-4 text-[#1e3cff] flex-shrink-0 mt-0.5" />
                          <span>{benefit}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 w-full">
        <div className="w-full">
          <div className="backdrop-blur-xl bg-white/5 border border-[#1e3cff]/30 rounded-3xl p-12">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
              {[
                { icon: Clock, value: "24/7", label: "Disponibilidad del Asistente IA" },
                { icon: TrendingUp, value: "100%", label: "Centralización de Herramientas" },
                { icon: Shield, value: "10+ Roles", label: "Diferentes Perfiles de Usuario" }
              ].map((stat, idx) => {
                const Icon = stat.icon;
                return (
                  <div key={idx}>
                    <Icon className="w-12 h-12 text-[#1e3cff] mx-auto mb-4" />
                    <div className="text-4xl font-bold text-white mb-2">{stat.value}</div>
                    <div className="text-white/70">{stat.label}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 w-full">
        <div className="w-full max-w-4xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6 font-['Poppins']">
            ¿Listo para Transformar tu Experiencia Educativa?
          </h2>
          <p className="text-white/70 text-lg mb-10 max-w-2xl mx-auto">
            {isAuthenticated
              ? "Comienza a explorar todas las funcionalidades de MindOS"
              : "Únete a MindOS y lleva tu institución educativa al siguiente nivel"
            }
          </p>
          <Button
            onClick={handleCTA}
            size="lg"
            className="bg-gradient-to-r from-[#002366] to-[#1e3cff] hover:opacity-90 text-white text-xl px-12 py-8 rounded-2xl"
            data-testid="button-cta-bottom"
          >
            {isAuthenticated ? (
              <>
                Ir al Chat IA <MessageSquare className="ml-3 w-6 h-6" />
              </>
            ) : (
              <>
                Comenzar Gratis <ArrowRight className="ml-3 w-6 h-6" />
              </>
            )}
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 py-8 px-4 sm:px-6 lg:px-8 w-full bg-black/40">
        <div className="w-full text-center">
          <p className="text-white/50 text-sm">
            © 2025 MindOS - Desarrollado por <span className="text-[#1e3cff] font-medium">Bridgent</span>
          </p>
          <p className="text-white/40 text-xs mt-2">
            Plataforma educativa inteligente para instituciones académicas
          </p>
        </div>
      </footer>
    </div>
  );
}
