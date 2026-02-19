import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '@/lib/authContext';
import { getRoleHomePath } from '@/lib/roleRedirect';
import type { AuthResponse } from '@shared/schema';

export default function AuthCallback() {
  const [, setLocation] = useLocation();
  const { login } = useAuth();
  const [status, setStatus] = useState<'loading' | 'error'>('loading');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const error = params.get('error');

    if (error) {
      setStatus('error');
      const errorMessages: Record<string, string> = {
        google_sso_not_configured: 'Inicio con Google no está configurado.',
        missing_code: 'Faltó el código de autorización.',
        token_exchange_failed: 'No se pudo completar la autorización con Google.',
        profile_failed: 'No se pudo obtener tu perfil de Google.',
        no_email: 'Tu cuenta de Google no tiene correo asociado.',
        no_account: 'No hay una cuenta con ese correo. Regístrate primero.',
        account_not_active: 'Tu cuenta no está activa. Contacta al administrador.',
        server_error: 'Error en el servidor. Intenta de nuevo.',
      };
      const message = errorMessages[error] || `Error: ${error}`;
      setLocation(`/login?error=${encodeURIComponent(message)}`);
      return;
    }

    if (!token) {
      setLocation('/login');
      return;
    }

    const id = params.get('id');
    const nombre = params.get('nombre') ?? '';
    const email = params.get('email') ?? '';
    const rol = params.get('rol') as AuthResponse['rol'] | null;
    const colegioId = params.get('colegioId') ?? '';
    const codigoUnico = params.get('codigoUnico') ?? undefined;
    const userId = params.get('userId') ?? undefined;

    if (!id || !rol) {
      setLocation('/login?error=' + encodeURIComponent('Datos de sesión incompletos.'));
      return;
    }

    const userData: AuthResponse = {
      id,
      userId,
      nombre,
      email,
      rol,
      colegioId,
      codigoUnico,
      token,
    };
    login(userData);
    setLocation(getRoleHomePath(rol));
  }, [login, setLocation]);

  if (status === 'error') return null;

  return (
    <div
      className="min-h-screen flex items-center justify-center p-6"
      style={{ background: 'linear-gradient(135deg, #0a0a2a 0%, #002366 45%, #1e3cff 100%)' }}
    >
      <div className="text-white/80">Completando inicio de sesión...</div>
    </div>
  );
}
