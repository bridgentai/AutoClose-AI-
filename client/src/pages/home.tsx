import { useAuth } from '@/lib/authContext';
import { useLocation } from 'wouter';
import kiwiMascot from '@/assets/Kiwi.png';
import { Button } from '@/components/ui/button';
import {
  BookOpen,
  MessageSquare,
  Users,
  BarChart3,
  Shield,
  Sparkles,
  ArrowRight,
  CheckCircle2,
} from 'lucide-react';

const PALETTE = {
  bg: '#0a1628',
  primary: '#3B82F6',
  accent: '#60A5FA',
  textMain: '#ffffff',
  textSub: 'rgba(255,255,255,0.55)',
  textTer: 'rgba(255,255,255,0.35)',
};

const STYLES = `
  @keyframes waveGradient {
    0%   { background-position: 0% 50%; }
    25%  { background-position: 50% 100%; }
    50%  { background-position: 100% 50%; }
    75%  { background-position: 50% 0%; }
    100% { background-position: 0% 50%; }
  }
  @keyframes orb1 {
    0%, 100% { transform: translate(0, 0) scale(1); }
    33%       { transform: translate(60px, -40px) scale(1.08); }
    66%       { transform: translate(-30px, 50px) scale(0.95); }
  }
  @keyframes orb2 {
    0%, 100% { transform: translate(0, 0) scale(1); }
    40%       { transform: translate(-70px, 60px) scale(1.1); }
    80%       { transform: translate(40px, -30px) scale(0.92); }
  }
  @keyframes orb3 {
    0%, 100% { transform: translate(0, 0) scale(1); }
    50%       { transform: translate(50px, 40px) scale(1.06); }
  }
  @keyframes blink {
    0%, 100% { opacity: 1; }
    50%       { opacity: 0.3; }
  }
  @keyframes koalaFloat {
    0%, 100% { transform: translateY(0px); }
    50%       { transform: translateY(-14px); }
  }
  @keyframes shadowPulse {
    0%, 100% { transform: scaleX(1); opacity: 0.45; }
    50%       { transform: scaleX(0.78); opacity: 0.22; }
  }
  @keyframes fadeInUp {
    from { opacity: 0; transform: translateY(24px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  .home-wave-bg { animation: waveGradient 12s ease-in-out infinite; background-size: 300% 300%; }
  .home-orb1 { animation: orb1 14s ease-in-out infinite; }
  .home-orb2 { animation: orb2 18s ease-in-out infinite; }
  .home-orb3 { animation: orb3 22s ease-in-out infinite; }
  .home-blink { animation: blink 1.8s ease-in-out infinite; }
  .home-koala { animation: koalaFloat 3s ease-in-out infinite; }
  .home-shadow { animation: shadowPulse 3s ease-in-out infinite; }
  .home-fadein { animation: fadeInUp 0.7s ease both; }
  .home-fadein-d1 { animation: fadeInUp 0.7s 0.1s ease both; }
  .home-fadein-d2 { animation: fadeInUp 0.7s 0.2s ease both; }
  .home-fadein-d3 { animation: fadeInUp 0.7s 0.35s ease both; }
  .home-fadein-d4 { animation: fadeInUp 0.7s 0.5s ease both; }

  .feature-card {
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 14px;
    padding: 28px 24px;
    transition: background 0.22s, border-color 0.22s, transform 0.22s, box-shadow 0.22s;
    cursor: default;
  }
  .feature-card:hover {
    background: rgba(59,130,246,0.08);
    border-color: rgba(59,130,246,0.35);
    transform: translateY(-2px);
    box-shadow: 0 8px 32px rgba(59,130,246,0.1);
  }

  .btn-primary {
    background: #3B82F6;
    color: #fff;
    border: none;
    border-radius: 10px;
    padding: 13px 28px;
    font-size: 15px;
    font-weight: 600;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    transition: background 0.18s, box-shadow 0.18s, transform 0.14s;
    text-decoration: none;
    box-shadow: 0 0 24px rgba(59,130,246,0.28);
  }
  .btn-primary:hover {
    background: #2563EB;
    box-shadow: 0 0 36px rgba(59,130,246,0.42);
    transform: translateY(-1px);
  }
  .btn-ghost {
    background: transparent;
    color: rgba(255,255,255,0.75);
    border: 1px solid rgba(255,255,255,0.2);
    border-radius: 10px;
    padding: 13px 28px;
    font-size: 15px;
    font-weight: 500;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    transition: background 0.18s, border-color 0.18s, color 0.18s;
    text-decoration: none;
  }
  .btn-ghost:hover {
    background: rgba(255,255,255,0.06);
    border-color: rgba(255,255,255,0.35);
    color: #fff;
  }
`;

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

    const roleContent: Record<string, { title: string; features: string[] }> = {
      estudiante: {
        title: "Tu Asistente de Estudio Personalizado",
        features: [
          "Asistencia 24/7 con tus tareas y estudios",
          "Acceso a materiales de todos tus cursos",
          "Seguimiento de tu progreso académico",
          "Preparación para exámenes personalizadas",
        ],
      },
      profesor: {
        title: "Potencia tu Enseñanza con IA",
        features: [
          "Crea y gestiona cursos fácilmente",
          "Genera materiales educativos automáticamente",
          "Monitorea el progreso de tus estudiantes",
          "Asistente IA para responder dudas frecuentes",
        ],
      },
      directivo: {
        title: "Gestión Académica Inteligente",
        features: [
          "Análisis y métricas institucionales en tiempo real",
          "Gestión centralizada de toda la institución",
          "Configuración personalizada del sistema",
          "Reportes automáticos de rendimiento",
        ],
      },
      padre: {
        title: "Seguimiento del Progreso de tu Hijo",
        features: [
          "Consulta el rendimiento académico en tiempo real",
          "Comunicación directa con profesores",
          "Acceso a materiales y tareas",
          "Notificaciones de eventos importantes",
        ],
      },
    };

    const content = roleContent[user.rol];
    if (!content) return null;

    return (
      <div
        className="home-fadein-d3"
        style={{
          marginTop: 28,
          maxWidth: 520,
          background: 'rgba(59,130,246,0.07)',
          border: '1px solid rgba(59,130,246,0.2)',
          borderRadius: 14,
          padding: '20px 24px',
        }}
      >
        <p style={{ color: PALETTE.accent, fontWeight: 600, fontSize: 14, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Sparkles style={{ width: 15, height: 15 }} />
          {content.title}
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 16px' }}>
          {content.features.map((f, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
              <CheckCircle2 style={{ width: 14, height: 14, color: PALETTE.accent, marginTop: 2, flexShrink: 0 }} />
              <span style={{ fontSize: 13, color: PALETTE.textSub, lineHeight: 1.5 }}>{f}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <>
      <style>{STYLES}</style>

      <div style={{ minHeight: '100vh', width: '100%', background: PALETTE.bg, color: PALETTE.textMain, overflowX: 'hidden', position: 'relative' }}>

        {/* ── BACKGROUND ── */}
        <div style={{ position: 'fixed', inset: 0, zIndex: 0, overflow: 'hidden', pointerEvents: 'none' }}>
          {/* Wave gradient base */}
          <div
            className="home-wave-bg"
            style={{
              position: 'absolute', inset: 0,
              background: 'linear-gradient(135deg, #0a1628 0%, #0d2147 20%, #0a3060 35%, #0d1f4a 50%, #071430 65%, #0e2a5c 80%, #0a1628 100%)',
              opacity: 0.9,
            }}
          />
          {/* Orbs */}
          <div className="home-orb1" style={{ position: 'absolute', top: '-10%', left: '-5%', width: 640, height: 640, borderRadius: '50%', background: 'radial-gradient(circle, rgba(59,130,246,0.22) 0%, transparent 68%)', filter: 'blur(80px)' }} />
          <div className="home-orb2" style={{ position: 'absolute', bottom: '-15%', right: '-8%', width: 560, height: 560, borderRadius: '50%', background: 'radial-gradient(circle, rgba(99,102,241,0.18) 0%, transparent 68%)', filter: 'blur(80px)' }} />
          <div className="home-orb3" style={{ position: 'absolute', top: '42%', left: '38%', width: 380, height: 380, borderRadius: '50%', background: 'radial-gradient(circle, rgba(96,165,250,0.1) 0%, transparent 68%)', filter: 'blur(80px)' }} />
          {/* Grid */}
          <div style={{
            position: 'absolute', inset: 0,
            backgroundImage: 'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)',
            backgroundSize: '52px 52px',
          }} />
        </div>

        {/* ── NAV ── */}
        <header style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50,
          backdropFilter: 'blur(18px)',
          background: 'rgba(10,22,40,0.78)',
          borderBottom: '1px solid rgba(255,255,255,0.07)',
        }}>
          <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 28px', height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            {/* Logo */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ background: PALETTE.primary, borderRadius: 10, width: 38, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <span style={{ color: '#fff', fontWeight: 800, fontSize: 13, letterSpacing: '-0.3px' }}>evo</span>
              </div>
              <span style={{ color: '#fff', fontWeight: 700, fontSize: 17, letterSpacing: '-0.3px' }}>Caobos</span>
            </div>

            {/* Nav actions */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {isAuthenticated ? (
                <>
                  <span style={{ color: PALETTE.textSub, fontSize: 14, marginRight: 4 }}>
                    Hola, <strong style={{ color: '#fff' }}>{user?.nombre?.split(' ')[0] || 'Usuario'}</strong>
                  </span>
                  <button className="btn-ghost" onClick={() => setLocation('/dashboard')} data-testid="button-dashboard" style={{ padding: '9px 20px', fontSize: 14 }}>
                    Dashboard
                  </button>
                </>
              ) : (
                <>
                  <button className="btn-ghost" onClick={() => setLocation('/login')} data-testid="button-login-nav" style={{ padding: '9px 20px', fontSize: 14 }}>
                    Iniciar Sesión
                  </button>
                  <button className="btn-primary" onClick={() => setLocation('/register')} data-testid="button-register-nav" style={{ padding: '9px 20px', fontSize: 14 }}>
                    Registrarse
                  </button>
                </>
              )}
            </div>
          </div>
        </header>

        {/* ── HERO ── */}
        <section style={{ position: 'relative', zIndex: 1, paddingTop: 120, paddingBottom: 100, minHeight: '100vh', display: 'flex', alignItems: 'center' }}>
          <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 28px', width: '100%' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 460px', gap: 48, alignItems: 'center' }}>

              {/* Left */}
              <div>
                {/* Badge */}
                <div className="home-fadein" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.25)', borderRadius: 999, padding: '6px 16px', marginBottom: 28 }}>
                  <span className="home-blink" style={{ width: 7, height: 7, borderRadius: '50%', background: PALETTE.primary, flexShrink: 0, display: 'inline-block', boxShadow: `0 0 6px ${PALETTE.primary}` }} />
                  <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', fontWeight: 500 }}>Desarrollado por Bridgent</span>
                </div>

                {/* Title */}
                <h1 className="home-fadein-d1" style={{ fontSize: 72, fontWeight: 800, lineHeight: 1.05, letterSpacing: '-2.5px', margin: '0 0 12px 0' }}>
                  <span style={{ color: '#fff' }}>La Plataforma<br />Educativa<br /></span>
                  <span style={{ color: PALETTE.accent }}>del Futuro</span>
                </h1>

                {/* Institution */}
                <p className="home-fadein-d2" style={{ fontSize: 20, fontWeight: 700, color: PALETTE.accent, marginBottom: 16, letterSpacing: '-0.3px' }}>
                  Gimnasio Los Caobos
                </p>

                {/* Description */}
                <p className="home-fadein-d2" style={{ fontSize: 17, color: PALETTE.textSub, lineHeight: 1.65, maxWidth: 480, marginBottom: 0 }}>
                  Centraliza todo el ecosistema educativo de tu institución en una sola plataforma
                  inteligente. Un asistente IA personalizado que conoce tu currículo específico.
                </p>

                {/* Role content */}
                {getRoleSpecificContent()}

                {/* CTAs */}
                <div className="home-fadein-d4" style={{ display: 'flex', gap: 12, marginTop: 32, flexWrap: 'wrap' }}>
                  <button className="btn-primary" onClick={handleCTA} data-testid="button-cta-main">
                    {isAuthenticated ? (
                      <><MessageSquare style={{ width: 17, height: 17 }} /> Ir al Chat IA</>
                    ) : (
                      <>Comenzar Ahora <ArrowRight style={{ width: 17, height: 17 }} /></>
                    )}
                  </button>
                  {!isAuthenticated && (
                    <button className="btn-ghost" onClick={() => setLocation('/register')} data-testid="button-cta-register">
                      Crear Cuenta Gratis
                    </button>
                  )}
                </div>
              </div>

              {/* Right — Koala */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0, position: 'relative' }}>
                {/* Glow */}
                <div style={{ position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)', width: 260, height: 120, background: 'radial-gradient(ellipse, rgba(59,130,246,0.3) 0%, transparent 70%)', filter: 'blur(24px)', pointerEvents: 'none', zIndex: 0 }} />
                {/* Image */}
                <img
                  src={kiwiMascot}
                  alt="Kiwi - Mascota Caobos"
                  className="home-koala"
                  style={{ width: '100%', maxWidth: 440, objectFit: 'contain', userSelect: 'none', position: 'relative', zIndex: 1 }}
                />
                {/* Shadow */}
                <div
                  className="home-shadow"
                  style={{ width: 160, height: 20, background: 'rgba(59,130,246,0.35)', borderRadius: '50%', filter: 'blur(12px)', marginTop: -8, position: 'relative', zIndex: 0 }}
                />
              </div>

            </div>
          </div>
        </section>

        {/* ── FEATURES ── */}
        <section style={{ position: 'relative', zIndex: 1, padding: '100px 28px' }}>
          <div style={{ maxWidth: 1200, margin: '0 auto' }}>
            {/* Header */}
            <div style={{ textAlign: 'center', marginBottom: 56 }}>
              <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: PALETTE.accent, marginBottom: 14 }}>Plataforma</p>
              <h2 style={{ fontSize: 40, fontWeight: 800, letterSpacing: '-1.2px', color: '#fff', margin: '0 0 14px 0' }}>
                Todo lo que Necesitas<br />en un Solo Lugar
              </h2>
              <p style={{ fontSize: 17, color: PALETTE.textSub, maxWidth: 400, margin: '0 auto' }}>
                Reemplaza herramientas dispersas con una plataforma unificada
              </p>
            </div>

            {/* Cards grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
              {[
                { icon: MessageSquare, title: "Asistente IA Personalizado", desc: "IA que conoce tu currículo y responde consultas académicas 24/7" },
                { icon: BookOpen,      title: "Gestión de Cursos",          desc: "Organiza cursos, materiales y tareas en una interfaz intuitiva" },
                { icon: Users,         title: "Multi-Rol",                  desc: "Interfaces para estudiantes, profesores, directivos y padres" },
                { icon: BarChart3,     title: "Análisis en Tiempo Real",    desc: "Métricas y reportes automáticos del rendimiento académico" },
                { icon: Shield,        title: "Seguro y Privado",           desc: "Datos protegidos con encriptación y controles por rol" },
                { icon: Sparkles,      title: "Personalización Total",      desc: "Configura logo, colores y nombre del asistente de tu institución" },
              ].map(({ icon: Icon, title, desc }, idx) => (
                <div key={idx} className="feature-card">
                  <div style={{ width: 44, height: 44, borderRadius: 11, background: 'linear-gradient(145deg, #3B82F6, #2563EB)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 18 }}>
                    <Icon style={{ width: 22, height: 22, color: '#fff' }} />
                  </div>
                  <h3 style={{ fontSize: 16, fontWeight: 700, color: '#fff', marginBottom: 8, letterSpacing: '-0.2px' }}>{title}</h3>
                  <p style={{ fontSize: 14, color: PALETTE.textSub, lineHeight: 1.6, margin: 0 }}>{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── CTA FINAL ── */}
        <section style={{ position: 'relative', zIndex: 1, padding: '0 28px 120px' }}>
          <div style={{ maxWidth: 800, margin: '0 auto' }}>
            <div style={{
              background: 'linear-gradient(135deg, rgba(59,130,246,0.2), rgba(99,102,241,0.15))',
              border: '1px solid rgba(59,130,246,0.25)',
              borderRadius: 20,
              padding: '64px 48px',
              textAlign: 'center',
              position: 'relative',
              overflow: 'hidden',
            }}>
              {/* Glow central */}
              <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 400, height: 200, background: 'radial-gradient(ellipse, rgba(59,130,246,0.18) 0%, transparent 70%)', pointerEvents: 'none' }} />

              <h2 style={{ fontSize: 36, fontWeight: 800, letterSpacing: '-1px', color: '#fff', marginBottom: 14, position: 'relative' }}>
                Empieza hoy sin costo
              </h2>
              <p style={{ fontSize: 16, color: PALETTE.textSub, marginBottom: 36, maxWidth: 440, margin: '0 auto 36px', position: 'relative' }}>
                {isAuthenticated
                  ? "Comienza a explorar todas las funcionalidades de la plataforma"
                  : "Únete y lleva tu institución educativa al siguiente nivel"}
              </p>
              <button className="btn-primary" onClick={handleCTA} data-testid="button-cta-bottom" style={{ fontSize: 16, padding: '15px 36px', position: 'relative' }}>
                {isAuthenticated ? (
                  <><MessageSquare style={{ width: 18, height: 18 }} /> Ir al Chat IA</>
                ) : (
                  <>Comenzar Gratis <ArrowRight style={{ width: 18, height: 18 }} /></>
                )}
              </button>
            </div>
          </div>
        </section>

        {/* ── FOOTER ── */}
        <footer style={{ position: 'relative', zIndex: 1, borderTop: '1px solid rgba(255,255,255,0.06)', padding: '28px 28px', textAlign: 'center' }}>
          <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 24, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, color: PALETTE.textTer }}>© 2026 Bridgent · Evo.OS</span>
            <span style={{ color: 'rgba(255,255,255,0.1)' }}>·</span>
            <a href="#" style={{ fontSize: 13, color: PALETTE.textTer, textDecoration: 'none' }} onMouseEnter={e => (e.currentTarget.style.color = PALETTE.textSub)} onMouseLeave={e => (e.currentTarget.style.color = PALETTE.textTer)}>Privacidad</a>
            <a href="#" style={{ fontSize: 13, color: PALETTE.textTer, textDecoration: 'none' }} onMouseEnter={e => (e.currentTarget.style.color = PALETTE.textSub)} onMouseLeave={e => (e.currentTarget.style.color = PALETTE.textTer)}>Términos</a>
          </div>
        </footer>

      </div>
    </>
  );
}
