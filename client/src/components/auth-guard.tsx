import { useAuth } from '@/lib/authContext';
import { useLocation } from 'wouter';
import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

const CONSENT_EXEMPT_PATHS = ['/consent', '/terminos', '/privacidad'];

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [location, setLocation] = useLocation();

  const { data: consent, isLoading: consentLoading } = useQuery<{
    consentimientoTerminos: boolean;
    consentimientoPrivacidad: boolean;
  }>({
    queryKey: ['user-consent'],
    queryFn: () => apiRequest('GET', '/api/users/me/consent'),
    enabled: isAuthenticated && !CONSENT_EXEMPT_PATHS.includes(location),
  });

  useEffect(() => {
    if (!isAuthenticated) {
      setLocation('/login');
    }
  }, [isAuthenticated, setLocation]);

  useEffect(() => {
    if (!isAuthenticated || consentLoading || CONSENT_EXEMPT_PATHS.includes(location)) return;
    if (consent && !consent.consentimientoTerminos || !consent?.consentimientoPrivacidad) {
      setLocation('/consent');
    }
  }, [isAuthenticated, consent, consentLoading, location, setLocation]);

  if (!isAuthenticated) {
    return null;
  }

  if (!CONSENT_EXEMPT_PATHS.includes(location) && consentLoading) {
    return null;
  }
  if (!CONSENT_EXEMPT_PATHS.includes(location) && consent && (!consent.consentimientoTerminos || !consent.consentimientoPrivacidad)) {
    return null;
  }

  return <>{children}</>;
}

export function GuestGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (isAuthenticated) {
      setLocation('/dashboard');
    }
  }, [isAuthenticated, setLocation]);

  if (isAuthenticated) {
    return null;
  }

  return <>{children}</>;
}
