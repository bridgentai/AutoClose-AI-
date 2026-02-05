import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';

/**
 * Middleware que requiere que el usuario sea school_admin
 * Valida que el usuario tenga el rol school_admin y que esté activo
 */
export const requireSchoolAdmin = (
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
    
    if (user.rol !== 'school_admin') {
      return res.status(403).json({ 
        message: 'Acceso denegado. Se requiere el rol de Administrador del Colegio (school_admin).' 
      });
    }
    
    // Verificar que el usuario esté activo (si el estado está disponible)
    // Nota: Esto requiere que el estado se cargue en el middleware de autenticación
    // Por ahora, solo validamos el rol
    
    next();
  } catch (error: any) {
    console.error('Error en requireSchoolAdmin:', error);
    return res.status(500).json({ 
      message: 'Error al validar permisos de administrador del colegio.' 
    });
  }
};

/**
 * Middleware que valida que el usuario school_admin solo pueda acceder a recursos de su propio colegio
 * Debe usarse después de requireSchoolAdmin
 */
export const validateSchoolAccess = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const user = req.user;
    const targetColegioId = req.body.colegioId || req.params.colegioId || req.query.colegioId;
    
    if (!user || user.rol !== 'school_admin') {
      return res.status(403).json({ 
        message: 'Acceso denegado. Se requiere el rol de Administrador del Colegio.' 
      });
    }
    
    // Si hay un colegioId en la petición, validar que sea el mismo del usuario
    if (targetColegioId && targetColegioId !== user.colegioId) {
      return res.status(403).json({ 
        message: 'No tienes acceso a recursos de otros colegios.' 
      });
    }
    
    next();
  } catch (error: any) {
    console.error('Error en validateSchoolAccess:', error);
    return res.status(500).json({ 
      message: 'Error al validar acceso al colegio.' 
    });
  }
};

/**
 * Helper para validar que un recurso pertenece al mismo colegio que el school_admin
 * Útil para validaciones en rutas específicas
 */
export function validateSameSchool(userColegioId: string, targetColegioId: string): boolean {
  return userColegioId === targetColegioId;
}
