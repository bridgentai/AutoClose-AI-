import React, { createContext, useContext, useState, useEffect } from 'react';
import type { AuthResponse } from '@shared/schema';

interface AuthContextType {
  user: AuthResponse | null;
  login: (userData: AuthResponse) => void;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthResponse | null>(null);

  useEffect(() => {
    // Cargar usuario del localStorage al iniciar
    const storedUser = localStorage.getItem('autoclose_user');
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (e) {
        localStorage.removeItem('autoclose_user');
      }
    }
  }, []);

  const login = (userData: AuthResponse) => {
    console.log('[AUTH] Login con datos:', userData);
    console.log('[AUTH] Código único recibido:', userData.codigoUnico);
    setUser(userData);
    localStorage.setItem('autoclose_user', JSON.stringify(userData));
    localStorage.setItem('autoclose_token', userData.token);
    console.log('[AUTH] Usuario guardado en localStorage');
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('autoclose_user');
    localStorage.removeItem('autoclose_token');
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth debe ser usado dentro de AuthProvider');
  }
  return context;
}
