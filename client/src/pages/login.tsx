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
    <div className="min-h-screen flex items-center justify-center p-6" 
         style={{
           background: 'radial-gradient(circle at 20% 20%, #25003d, #0b0013 80%)'
         }}>
      <div className="w-full max-w-md">
        <div className="backdrop-blur-xl bg-black/40 border border-white/10 rounded-3xl p-10 shadow-2xl"
             style={{ boxShadow: '0 0 35px rgba(159, 37, 184, 0.25)' }}>
          
          <h2 className="text-3xl font-bold mb-2 bg-gradient-to-r from-[#9f25b8] to-[#c66bff] bg-clip-text text-transparent font-['Poppins']">
            Iniciar sesión
          </h2>
          <p className="text-white/70 mb-8">Accede a AutoClose AI</p>

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
              className="w-full bg-gradient-to-r from-[#9f25b8] to-[#c66bff] hover:opacity-90 text-white font-semibold"
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

          <div className="mt-6 text-center">
            <button
              onClick={() => setLocation('/register')}
              className="text-white/60 hover:text-white/90 text-sm transition-colors"
              data-testid="link-register"
            >
              ¿No tienes cuenta? <span className="text-[#9f25b8] font-semibold">Regístrate</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
