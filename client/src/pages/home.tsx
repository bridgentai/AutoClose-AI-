import { useAuth } from '@/lib/authContext';
import { useLocation } from 'wouter';
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
  Brain,
  Clock,
  TrendingUp
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
      <div className="mt-16 backdrop-blur-xl bg-white/5 border border-[#9f25b8]/30 rounded-3xl p-8">
        <h3 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
          <Sparkles className="w-6 h-6 text-[#9f25b8]" />
          {content.title}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {content.features.map((feature, idx) => (
            <div key={idx} className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-[#9f25b8] flex-shrink-0 mt-0.5" />
              <span className="text-white/80">{feature}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0a0c] via-[#1a001c] to-[#3d0045]">
      {/* Header */}
      <header className="fixed top-0 w-full backdrop-blur-xl bg-black/40 border-b border-white/10 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-[#9f25b8] to-[#6a0dad] rounded-xl flex items-center justify-center">
              <span className="text-white font-bold text-xl">AC</span>
            </div>
            <span className="text-white font-bold text-xl font-['Poppins']">AutoClose AI</span>
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
                  className="border-[#9f25b8]/50 text-white hover:bg-[#9f25b8]/20"
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
                  className="bg-gradient-to-r from-[#9f25b8] to-[#6a0dad] hover:opacity-90 text-white"
                  data-testid="button-register-nav"
                >
                  Registrarse
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-6">
        <div className="max-w-7xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#9f25b8]/20 border border-[#9f25b8]/30 mb-8">
            <Brain className="w-4 h-4 text-[#9f25b8]" />
            <span className="text-white/90 text-sm font-medium">Desarrollado por Bridgent</span>
          </div>

          <h1 className="text-5xl md:text-7xl font-bold mb-6 font-['Poppins']">
            <span className="bg-gradient-to-r from-[#9f25b8] to-[#c66bff] bg-clip-text text-transparent">
              La Plataforma Educativa
            </span>
            <br />
            <span className="text-white">del Futuro</span>
          </h1>

          <p className="text-xl text-white/70 max-w-3xl mx-auto mb-10 leading-relaxed">
            AutoClose AI centraliza todo el ecosistema educativo de tu institución en una sola plataforma
            inteligente. Reemplaza herramientas dispersas con un asistente IA personalizado que conoce
            tu currículo específico.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button
              onClick={handleCTA}
              size="lg"
              className="bg-gradient-to-r from-[#9f25b8] to-[#6a0dad] hover:opacity-90 text-white text-lg px-8 py-6 rounded-xl"
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
                className="border-[#9f25b8]/50 text-white hover:bg-[#9f25b8]/20 text-lg px-8 py-6 rounded-xl"
                data-testid="button-cta-register"
              >
                Crear Cuenta Gratis
              </Button>
            )}
          </div>

          {/* Role-specific content for authenticated users */}
          {getRoleSpecificContent()}
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-6 bg-gradient-to-b from-transparent to-black/30">
        <div className="max-w-7xl mx-auto">
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
                  className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-6 hover:border-[#9f25b8]/50 transition-all group"
                >
                  <div className="w-14 h-14 bg-gradient-to-br from-[#9f25b8] to-[#6a0dad] rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
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
      <section className="py-20 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-4 font-['Poppins']">
              Diseñado para Todos
            </h2>
            <p className="text-white/70 text-lg">
              Cada rol tiene una experiencia optimizada
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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
                icon: Users,
                benefits: ["Seguimiento en tiempo real", "Comunicación directa", "Notificaciones"]
              }
            ].map((roleCard, idx) => {
              const Icon = roleCard.icon;
              return (
                <div
                  key={idx}
                  className="backdrop-blur-xl bg-gradient-to-br from-white/5 to-white/0 border border-white/10 rounded-2xl p-6"
                >
                  <div className="w-12 h-12 bg-[#9f25b8]/20 rounded-xl flex items-center justify-center mb-4">
                    <Icon className="w-6 h-6 text-[#9f25b8]" />
                  </div>
                  <h3 className="text-lg font-bold text-white mb-4">{roleCard.role}</h3>
                  <ul className="space-y-2">
                    {roleCard.benefits.map((benefit, bidx) => (
                      <li key={bidx} className="flex items-start gap-2 text-white/70 text-sm">
                        <CheckCircle2 className="w-4 h-4 text-[#9f25b8] flex-shrink-0 mt-0.5" />
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

      {/* Stats Section */}
      <section className="py-20 px-6 bg-gradient-to-b from-transparent to-black/30">
        <div className="max-w-7xl mx-auto">
          <div className="backdrop-blur-xl bg-white/5 border border-[#9f25b8]/30 rounded-3xl p-12">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
              {[
                { icon: Clock, value: "24/7", label: "Disponibilidad del Asistente IA" },
                { icon: TrendingUp, value: "100%", label: "Centralización de Herramientas" },
                { icon: Shield, value: "4 Roles", label: "Diferentes Perfiles de Usuario" }
              ].map((stat, idx) => {
                const Icon = stat.icon;
                return (
                  <div key={idx}>
                    <Icon className="w-12 h-12 text-[#9f25b8] mx-auto mb-4" />
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
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6 font-['Poppins']">
            ¿Listo para Transformar tu Experiencia Educativa?
          </h2>
          <p className="text-white/70 text-lg mb-10 max-w-2xl mx-auto">
            {isAuthenticated
              ? "Comienza a explorar todas las funcionalidades de AutoClose AI"
              : "Únete a AutoClose AI y lleva tu institución educativa al siguiente nivel"
            }
          </p>
          <Button
            onClick={handleCTA}
            size="lg"
            className="bg-gradient-to-r from-[#9f25b8] to-[#6a0dad] hover:opacity-90 text-white text-xl px-12 py-8 rounded-2xl"
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
      <footer className="border-t border-white/10 py-8 px-6 bg-black/40">
        <div className="max-w-7xl mx-auto text-center">
          <p className="text-white/50 text-sm">
            © 2025 AutoClose AI - Desarrollado por <span className="text-[#9f25b8] font-medium">Bridgent</span>
          </p>
          <p className="text-white/40 text-xs mt-2">
            Plataforma educativa inteligente para instituciones académicas
          </p>
        </div>
      </footer>
    </div>
  );
}
