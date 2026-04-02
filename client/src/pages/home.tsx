import { useAuth } from '@/lib/authContext';
import { useLocation } from 'wouter';
import kiwiMascot from '@/assets/Kiwi.png';
import kiwiChill from '@/assets/kiwi chill.png';
import evoLogo from '@/assets/Screenshot_2026-04-01_at_8.05.11_PM-removebg-preview.png';
import { Button } from '@/components/ui/button';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useEffect, useRef, useState } from 'react';
import {
  BookOpen,
  MessageSquare,
  Users,
  BarChart3,
  Shield,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  Bell,
  User,
  Bot,
} from 'lucide-react';

const PALETTE = {
  bg: '#050a12',
  primary: '#3B82F6',
  accent: '#5B9BF8',
  textMain: '#ffffff',
  textSub: 'rgba(255,255,255,0.5)',
  textTer: 'rgba(255,255,255,0.3)',
  glassBorder: 'rgba(255,255,255,0.1)',
  glassBg: 'rgba(15,23,42,0.5)',
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
  @keyframes koalaBgPulse {
    0%, 100% { transform: translate(-50%, -50%) scale(1); opacity: 0.6; }
    50%       { transform: translate(-50%, -50%) scale(1.12); opacity: 0.9; }
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
  .home-koala-bg { }
  .home-fadein { animation: fadeInUp 0.7s ease both; }
  .home-fadein-d1 { animation: fadeInUp 0.7s 0.1s ease both; }
  .home-fadein-d2 { animation: fadeInUp 0.7s 0.2s ease both; }
  .home-fadein-d3 { animation: fadeInUp 0.7s 0.35s ease both; }
  .home-fadein-d4 { animation: fadeInUp 0.7s 0.5s ease both; }

  .feature-card {
    background: linear-gradient(145deg, rgba(15,23,42,0.5), rgba(6,13,28,0.65));
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 12px;
    padding: 28px 24px;
    box-shadow: 0 0 24px rgba(0,0,0,0.2);
    transition: background 0.22s, border-color 0.22s, transform 0.22s, box-shadow 0.22s;
    cursor: default;
  }
  .feature-card:hover {
    background: linear-gradient(145deg, rgba(30,58,138,0.35), rgba(15,23,42,0.6));
    border-color: rgba(59,130,246,0.3);
    transform: translateY(-2px);
    box-shadow: 0 8px 32px rgba(59,130,246,0.12), 0 0 40px rgba(37,99,235,0.15);
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
    box-shadow: 0 0 20px rgba(59,130,246,0.25);
  }
  .btn-primary:hover {
    background: #2563EB;
    box-shadow: 0 0 28px rgba(59,130,246,0.35);
    transform: translateY(-1px);
  }
  .btn-ghost {
    background: rgba(15,23,42,0.4);
    backdrop-filter: blur(8px);
    color: rgba(255,255,255,0.7);
    border: 1px solid rgba(255,255,255,0.1);
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
    border-color: rgba(255,255,255,0.2);
    color: #fff;
  }
  .btn-dashboard-light {
    background: linear-gradient(145deg, rgba(30,58,138,0.4), rgba(15,23,42,0.6));
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    color: #fff;
    border: 1px solid rgba(255,255,255,0.15);
    border-radius: 10px;
    padding: 9px 20px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: box-shadow 0.18s, transform 0.14s, border-color 0.18s;
    box-shadow: 0 0 20px rgba(59,130,246,0.15);
  }
  .btn-dashboard-light:hover {
    box-shadow: 0 0 28px rgba(59,130,246,0.25);
    border-color: rgba(255,255,255,0.25);
    transform: translateY(-1px);
  }
  @keyframes floatParticle {
    0%, 100% { transform: translate(0, 0); opacity: 0.4; }
    50% { transform: translate(8px, -12px); opacity: 0.8; }
  }
  .home-particle { animation: floatParticle 6s ease-in-out infinite; }

  @keyframes bellShake {
    0%, 100% { transform: rotate(0deg); }
    25% { transform: rotate(-15deg); }
    75% { transform: rotate(15deg); }
  }
  .bell-shake {
    transform-origin: 50% 0%;
    animation: bellShake 600ms ease-in-out;
  }
`;

export default function Home() {
  const { user, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();
  const [bellShake, setBellShake] = useState(false);
  const prevUnreadRef = useRef<number>(0);

  const { data: unreadData } = useQuery({
    queryKey: ['notifications-unread'],
    queryFn: async () => {
      const res = await apiRequest<{ list: unknown[]; unreadCount: number }>('GET', '/api/notifications?limit=1');
      return { unreadCount: res?.unreadCount ?? 0 };
    },
    enabled: isAuthenticated,
    staleTime: 30 * 1000,
    refetchInterval: 30 * 1000,
  });
  const unreadCount = unreadData?.unreadCount ?? 0;

  useEffect(() => {
    const prev = prevUnreadRef.current;
    if (unreadCount > prev) {
      setBellShake(true);
      setTimeout(() => setBellShake(false), 600);
    }
    prevUnreadRef.current = unreadCount;
  }, [unreadCount]);

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
          "Analiza tendencias...",
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
          maxWidth: 560,
          background: 'linear-gradient(145deg, rgba(15,23,42,0.6), rgba(6,13,28,0.7))',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 14,
          padding: '24px 28px 20px',
          boxShadow: '0 0 24px rgba(0,0,0,0.25)',
        }}
      >
        <p style={{ color: '#fff', fontWeight: 700, fontSize: 16, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Sparkles style={{ width: 18, height: 18, color: PALETTE.accent }} />
          {content.title}
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(59,130,246,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <CheckCircle2 style={{ width: 16, height: 16, color: PALETTE.accent }} />
            </div>
            <span style={{ fontSize: 14, color: '#fff', lineHeight: 1.5 }}>{content.features[0]}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(59,130,246,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Bot style={{ width: 16, height: 16, color: PALETTE.accent }} />
            </div>
            <span style={{ fontSize: 14, color: '#fff', lineHeight: 1.5 }}>{content.features[1]}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(59,130,246,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <CheckCircle2 style={{ width: 16, height: 16, color: PALETTE.accent }} />
            </div>
            <span style={{ fontSize: 14, color: '#fff', lineHeight: 1.5 }}>{content.features[2]}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(59,130,246,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Bot style={{ width: 16, height: 16, color: PALETTE.accent }} />
            </div>
            <span style={{ fontSize: 14, color: '#fff', lineHeight: 1.5 }}>{content.features[3]}</span>
          </div>
        </div>
        <div style={{ marginTop: 22 }}>
          <button type="button" className="btn-primary" onClick={handleCTA} data-testid="button-cta-main" style={{ width: '100%', justifyContent: 'center' }}>
            <MessageSquare style={{ width: 18, height: 18 }} /> Ir al Chat IA
          </button>
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
          {/* Wave gradient base — oscurecido */}
          <div
            className="home-wave-bg"
            style={{
              position: 'absolute', inset: 0,
              background: 'linear-gradient(135deg, #050a12 0%, #071430 20%, #0a1628 35%, #061028 50%, #040a14 65%, #081830 80%, #050a12 100%)',
              opacity: 0.95,
            }}
          />
          {/* Orbs — más tenues y oscuros */}
          <div className="home-orb1" style={{ position: 'absolute', top: '-10%', left: '-5%', width: 640, height: 640, borderRadius: '50%', background: 'radial-gradient(circle, rgba(59,130,246,0.14) 0%, transparent 68%)', filter: 'blur(80px)' }} />
          <div className="home-orb2" style={{ position: 'absolute', bottom: '-15%', right: '-8%', width: 560, height: 560, borderRadius: '50%', background: 'radial-gradient(circle, rgba(99,102,241,0.1) 0%, transparent 68%)', filter: 'blur(80px)' }} />
          <div className="home-orb3" style={{ position: 'absolute', top: '42%', left: '38%', width: 380, height: 380, borderRadius: '50%', background: 'radial-gradient(circle, rgba(96,165,250,0.06) 0%, transparent 68%)', filter: 'blur(80px)' }} />
          {/* Grid sutil (más visible arriba-izquierda) */}
          <div style={{
            position: 'absolute', inset: 0,
            backgroundImage: 'linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)',
            backgroundSize: '48px 48px',
            maskImage: 'linear-gradient(to bottom right, black 0%, transparent 55%)',
            WebkitMaskImage: 'linear-gradient(to bottom right, black 0%, transparent 55%)',
          }} />
          {/* Ondas/glow inferior */}
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0, height: 280,
            background: 'linear-gradient(to top, rgba(59,130,246,0.12) 0%, rgba(59,130,246,0.04) 35%, transparent 70%)',
            pointerEvents: 'none',
          }} />
          {/* Partículas sutiles */}
          {[
            [8, 22], [22, 45], [38, 18], [55, 62], [72, 38], [85, 75], [15, 78], [48, 88], [68, 28],
          ].map(([x, y], i) => (
            <div
              key={i}
              className="home-particle"
              style={{
                position: 'absolute',
                left: `${x}%`,
                top: `${y}%`,
                width: 2,
                height: 2,
                borderRadius: '50%',
                background: 'rgba(96,165,250,0.45)',
                animationDelay: `${i * 0.4}s`,
              }}
            />
          ))}
        </div>

        {/* ── NAV ── */}
        <header style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50,
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          background: 'linear-gradient(145deg, rgba(15,23,42,0.6), rgba(6,13,28,0.75))',
          borderBottom: '1px solid rgba(255,255,255,0.1)',
        }}>
          <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 28px', height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            {/* Logo */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <img
                src={evoLogo}
                alt="Evo.OS"
                draggable={false}
                style={{
                  width: 38,
                  height: 38,
                  objectFit: 'contain',
                  userSelect: 'none',
                  filter: 'drop-shadow(0 6px 14px rgba(0,0,0,0.25))',
                  flexShrink: 0,
                }}
              />
              <span style={{ color: '#fff', fontWeight: 700, fontSize: 17, letterSpacing: '-0.3px' }}>Caobos</span>
            </div>

            {/* Nav actions */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              {isAuthenticated ? (
                <>
                  <span style={{ color: '#fff', fontSize: 14 }}>
                    Hola, <strong style={{ color: '#fff' }}>{user?.nombre?.split(' ')[0] || 'Usuario'}</strong>
                  </span>
                  <button className="btn-dashboard-light" onClick={() => setLocation('/dashboard')} data-testid="button-dashboard">
                    Dashboard
                  </button>
                  <button
                    type="button"
                    onClick={() => setLocation('/notificaciones')}
                    aria-label="Notificaciones"
                    style={{
                      position: 'relative',
                      display: 'flex',
                      alignItems: 'center',
                      background: 'transparent',
                      border: 'none',
                      padding: 0,
                      cursor: 'pointer',
                    }}
                  >
                    <Bell className={bellShake ? 'bell-shake' : ''} style={{ width: 22, height: 22, color: '#fff' }} />
                    {unreadCount > 0 && (
                      <span
                        style={{
                          position: 'absolute',
                          top: -4,
                          right: -4,
                          minWidth: 18,
                          height: 18,
                          borderRadius: '50%',
                          background: '#ef4444',
                          color: '#fff',
                          fontSize: 11,
                          fontWeight: 800,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          padding: '0 4px',
                          boxShadow: '0 0 12px rgba(239,68,68,0.35)',
                        }}
                      >
                        {unreadCount > 99 ? '99+' : unreadCount}
                      </span>
                    )}
                  </button>
                  <button type="button" onClick={() => setLocation('/account')} style={{ width: 36, height: 36, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                    <User style={{ width: 20, height: 20, color: '#fff' }} />
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
        <section style={{ position: 'relative', zIndex: 1, paddingTop: 120, paddingBottom: 110, minHeight: '100vh', display: 'flex', alignItems: 'center' }}>
          <div style={{ maxWidth: 1360, margin: '0 auto', padding: '0 32px', width: '100%' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.7fr) 640px', gap: 46, alignItems: 'center' }}>

              {/* Texto: ocupa más espacio y está alineado hacia la derecha (junto al koala) */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                <div style={{ width: '100%', maxWidth: 700 }}>
                  {/* Badge — glass */}
                  <div className="home-fadein" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 999, padding: '6px 16px', marginBottom: 28, boxShadow: '0 0 20px rgba(0,0,0,0.15)' }}>
                    <span className="home-blink" style={{ width: 7, height: 7, borderRadius: '50%', background: PALETTE.accent, flexShrink: 0, display: 'inline-block', boxShadow: `0 0 6px ${PALETTE.accent}` }} />
                    <span style={{ fontSize: 13, color: PALETTE.accent, fontWeight: 500 }}>Desarrollado por Bridgent</span>
                  </div>

                  {/* Title */}
                  <h1 className="home-fadein-d1" style={{ fontSize: 84, fontWeight: 800, lineHeight: 1.04, letterSpacing: '-2.8px', margin: '0 0 14px 0' }}>
                    <span style={{ color: '#fff' }}>La Plataforma<br />Educativa<br /></span>
                    <span style={{ color: PALETTE.accent }}>del Futuro</span>
                  </h1>

                  {/* Institution */}
                  <p className="home-fadein-d2" style={{ fontSize: 22, fontWeight: 700, color: PALETTE.accent, marginBottom: 16, letterSpacing: '-0.3px' }}>
                    Gimnasio Los Caobos
                  </p>

                  {/* Description */}
                  <p className="home-fadein-d2" style={{ fontSize: 19, color: PALETTE.textSub, lineHeight: 1.65, maxWidth: 580, marginBottom: 0 }}>
                    Centraliza todo el ecosistema educativo de tu institución en una sola plataforma
                    inteligente. Un asistente IA personalizado que conoce tu currículo específico.
                  </p>

                  {/* Role content (incluye "Ir al Chat IA" dentro de la tarjeta cuando está logueado) */}
                  {getRoleSpecificContent()}

                  {/* CTAs solo cuando no está logueado */}
                  {!isAuthenticated && (
                    <div className="home-fadein-d4" style={{ display: 'flex', gap: 12, marginTop: 36, flexWrap: 'wrap' }}>
                      <button className="btn-primary" onClick={handleCTA} data-testid="button-cta-main" style={{ fontSize: 16, padding: '14px 30px' }}>
                        Comenzar Ahora <ArrowRight style={{ width: 18, height: 18 }} />
                      </button>
                      <button className="btn-ghost" onClick={() => setLocation('/register')} data-testid="button-cta-register" style={{ fontSize: 16, padding: '14px 26px' }}>
                        Crear Cuenta Gratis
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Koala: columna más estrecha, no es el centro */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                {/* Glow */}
                <div style={{ position: 'absolute', bottom: 12, left: '50%', transform: 'translateX(-50%)', width: 380, height: 150, background: 'radial-gradient(ellipse, rgba(59,130,246,0.35) 0%, transparent 70%)', filter: 'blur(26px)', pointerEvents: 'none', zIndex: 0 }} />
                {/* Image */}
                <img
                  src={kiwiMascot}
                  alt="Kiwi - Mascota Caobos"
                  className="home-koala"
                  style={{ width: '100%', maxWidth: 680, objectFit: 'contain', userSelect: 'none', position: 'relative', zIndex: 1 }}
                />
                {/* Shadow */}
                <div
                  className="home-shadow"
                  style={{ width: 200, height: 20, background: 'rgba(59,130,246,0.35)', borderRadius: '50%', filter: 'blur(12px)', marginTop: -10, position: 'relative', zIndex: 0 }}
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
                { icon: BookOpen, title: "Gestión de Cursos", desc: "Organiza cursos, materiales y tareas en una interfaz intuitiva" },
                { icon: Users, title: "Multi-Rol", desc: "Interfaces para estudiantes, profesores, directivos y padres" },
                { icon: BarChart3, title: "Análisis en Tiempo Real", desc: "Métricas y reportes automáticos del rendimiento académico" },
                { icon: Shield, title: "Seguro y Privado", desc: "Datos protegidos con encriptación y controles por rol" },
                { icon: Sparkles, title: "Personalización Total", desc: "Configura logo, colores y nombre del asistente de tu institución" },
              ].map(({ icon: Icon, title, desc }, idx) => (
                <div key={idx} className="feature-card">
                  <div style={{ width: 44, height: 44, borderRadius: 10, background: 'linear-gradient(145deg, #3B82F6, #2563EB)', border: '1px solid rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 18, boxShadow: '0 4px 12px rgba(59,130,246,0.25)' }}>
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
          <div style={{ maxWidth: 1200, margin: '0 auto' }}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
                gap: 24,
                alignItems: 'center',
              }}
            >
              {/* Card a la izquierda */}
              <div
                style={{
                  background: 'linear-gradient(145deg, rgba(30,58,138,0.35), rgba(15,23,42,0.6))',
                  backdropFilter: 'blur(20px)',
                  WebkitBackdropFilter: 'blur(20px)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 16,
                  padding: '64px 48px',
                  textAlign: 'left',
                  position: 'relative',
                  overflow: 'hidden',
                  boxShadow: '0 0 40px rgba(37,99,235,0.2)',
                }}
              >
                {/* Glow central */}
                <div
                  style={{
                    position: 'absolute',
                    top: '50%',
                    left: '55%',
                    transform: 'translate(-50%,-50%)',
                    width: 420,
                    height: 220,
                    background: 'radial-gradient(ellipse, rgba(59,130,246,0.12) 0%, transparent 70%)',
                    pointerEvents: 'none',
                  }}
                />

                <h2
                  style={{
                    fontSize: 36,
                    fontWeight: 800,
                    letterSpacing: '-1px',
                    color: '#fff',
                    marginBottom: 14,
                    position: 'relative',
                  }}
                >
                  Empieza hoy sin costo
                </h2>
                <p
                  style={{
                    fontSize: 16,
                    color: PALETTE.textSub,
                    marginBottom: 36,
                    maxWidth: 440,
                    position: 'relative',
                  }}
                >
                  {isAuthenticated
                    ? 'Comienza a explorar todas las funcionalidades de la plataforma'
                    : 'Únete y lleva tu institución educativa al siguiente nivel'}
                </p>
                <button
                  className="btn-primary"
                  onClick={handleCTA}
                  data-testid="button-cta-bottom"
                  style={{ fontSize: 16, padding: '15px 36px', position: 'relative' }}
                >
                  {isAuthenticated ? (
                    <>
                      <MessageSquare style={{ width: 18, height: 18 }} /> Ir al Chat IA
                    </>
                  ) : (
                    <>
                      Comenzar Gratis <ArrowRight style={{ width: 18, height: 18 }} />
                    </>
                  )}
                </button>
              </div>

              {/* Kiwi chill a la derecha */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative',
                  minHeight: 360,
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'radial-gradient(circle at 50% 60%, rgba(59,130,246,0.18) 0%, transparent 62%)',
                    filter: 'blur(2px)',
                    pointerEvents: 'none',
                  }}
                />
                <img
                  src={kiwiChill}
                  alt="Kiwi"
                  draggable={false}
                  style={{
                    width: 320,
                    maxWidth: '92%',
                    height: 'auto',
                    userSelect: 'none',
                    position: 'relative',
                    filter: 'drop-shadow(0 14px 40px rgba(0,0,0,0.35))',
                  }}
                />
              </div>
            </div>
          </div>
        </section>

        {/* ── FOOTER ── */}
        <footer style={{ position: 'relative', zIndex: 1, borderTop: '1px solid rgba(255,255,255,0.08)', padding: '28px 28px', textAlign: 'center' }}>
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
