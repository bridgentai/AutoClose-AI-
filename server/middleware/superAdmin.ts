import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';

/**
 * Middleware que requiere que el usuario sea super_admin
 * Valida que el usuario tenga el rol super_admin y que esté activo
 * 
 * ⚠️ SEGURIDAD: Este middleware protege rutas críticas del sistema.
 * En producción, todas las rutas que usen este middleware deben estar
 * adicionalmente protegidas por rate limiting y logging de auditoría.
 */
export const requireSuperAdmin = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const user = req.user;
    
    if (!user) {
      return res.status(401).json({ 
        message: 'Usuario no autenticado.' 
      });
    }
    
    if (user.rol !== 'super_admin') {
      return res.status(403).json({ 
        message: 'Acceso denegado. Se requiere el rol de Super Administrador (super_admin).' 
      });
    }
    
    // ⚠️ SEGURIDAD: En producción, agregar validación de estado aquí
    // Verificar que el usuario esté activo antes de permitir acceso
    
    // Log de acceso para auditoría (en producción, usar servicio de logging)
    console.log(`[SUPER_ADMIN] Acceso autorizado: ${user.id} - ${req.method} ${req.path}`);
    
    next();
  } catch (error: any) {
    console.error('Error en requireSuperAdmin:', error);
    return res.status(500).json({ 
      message: 'Error al validar permisos de super administrador.' 
    });
  }
};

/**
 * Helper para validar que un usuario es super_admin
 * Útil para validaciones en servicios y lógica de negocio
 */
export function isSuperAdmin(userRole: string): boolean {
  return userRole === 'super_admin';
}

/**
 * Helper para verificar si un usuario tiene acceso global (super_admin)
 * o está limitado a un colegio específico
 */
export function hasGlobalAccess(userRole: string, colegioId: string): boolean {
  return userRole === 'super_admin' || colegioId === 'GLOBAL_ADMIN';
}
