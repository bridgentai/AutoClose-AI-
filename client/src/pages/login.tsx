import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/authContext';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiRequest } from '@/lib/queryClient';
import { getRoleHomePath } from '@/lib/roleRedirect';
import type { AuthResponse } from '@shared/schema';

function getGoogleAuthUrl(): string {
  const base = (import.meta.env.VITE_API_URL as string) || '';
  if (base) return `${base.replace(/\/$/, '')}/api/auth/google`;
  return `${window.location.origin}/api/auth/google`;
}

export default function Login() {
  const [, setLocation] = useLocation();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlError = params.get('error');
    if (urlError) {
      const messages: Record<string, string> = {
        google_sso_not_configured: 'Inicio con Google no está configurado.',
        missing_code: 'No se pudo completar la autorización.',
        token_exchange_failed: 'Error al verificar con Google. Intenta de nuevo.',
        profile_failed: 'No se pudo obtener tu perfil.',
        no_email: 'Tu cuenta de Google no tiene correo.',
        no_account: 'No hay una cuenta con ese correo. Regístrate primero.',
        account_not_active: 'Tu cuenta no está activa. Contacta al administrador.',
        server_error: 'Error en el servidor. Intenta de nuevo.',
      };
      setError(messages[urlError] || decodeURIComponent(urlError));
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const data = await apiRequest<AuthResponse>('POST', '/api/auth/login', {
        email,
        password,
      });

      login(data);
      // Redirigir según el rol del usuario
      const homePath = getRoleHomePath(data.rol);
      setLocation(homePath);
    } catch (err: any) {
      setError(err.message || 'Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-6 relative"
      style={{ background: 'radial-gradient(circle at 20% 20%, #1E3A8A 0%, #0F172A 40%, #020617 100%)' }}
    >
      <button
        type="button"
        onClick={() => setLocation('/')}
        className="absolute top-6 left-6 z-20 text-2xl font-bold text-[#E2E8F0] font-['Poppins'] tracking-tight hover:text-white transition-colors"
      >
        Caobos
      </button>
      <div className="w-full max-w-md relative z-10">
        <div
          className="panel-grades rounded-3xl p-10 border border-white/10"
        >
          <h2 className="text-3xl font-bold mb-2 text-[#3B82F6] font-['Poppins']">
            Iniciar sesión
          </h2>
          <p className="text-[#E2E8F0]/80 mb-8">Accede a MindOS</p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <Label htmlFor="email" className="text-white/90 mb-2 block">
                Correo electrónico
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="bg-white/5 border-white/10 text-white placeholder:text-white/40"
                placeholder="tu@correo.com"
                data-testid="input-email"
              />
            </div>

            <div>
              <Label htmlFor="password" className="text-white/90 mb-2 block">
                Contraseña
              </Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="bg-white/5 border-white/10 text-white placeholder:text-white/40"
                placeholder="••••••••"
                data-testid="input-password"
              />
            </div>

            {error && (
              <p className="text-red-400 text-sm" data-testid="text-error">{error}</p>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-[#3B82F6] hover:bg-[#2563EB] text-white font-semibold transition-all duration-200 hover:shadow-[0_0_24px_rgba(59,130,246,0.45)]"
              data-testid="button-login"
            >
              {loading ? 'Iniciando sesión...' : 'Ingresar'}
            </Button>

            <div className="relative my-6">
              <span className="block text-center text-white/50 text-sm">o</span>
            </div>
            <Button
              type="button"
              variant="outline"
              className="w-full border-white/20 text-white hover:bg-white/10"
              onClick={() => { window.location.href = getGoogleAuthUrl(); }}
              data-testid="button-google"
            >
              Continuar con Google
            </Button>
          </form>

          <div className="mt-6 space-y-3 text-center">
            <button
              onClick={() => setLocation('/register')}
              className="text-white/60 hover:text-white/90 text-sm transition-colors block w-full"
              data-testid="link-register"
            >
              ¿No tienes cuenta? <span className="text-[#3B82F6] font-semibold hover:text-[#2563EB]">Regístrate</span>
            </button>
            <button
              onClick={() => setLocation('/')}
              className="text-white/50 hover:text-white/80 text-sm transition-colors"
              data-testid="link-landing"
            >
              ← Volver al inicio
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
