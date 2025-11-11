import { useState } from 'react';
import { useAuth } from '@/lib/authContext';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiRequest } from '@/lib/queryClient';
import type { AuthResponse } from '@shared/schema';

export default function Login() {
  const [, setLocation] = useLocation();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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
      setLocation('/dashboard');
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
