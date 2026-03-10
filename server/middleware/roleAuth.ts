import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth.js';
import { findUserById } from '../repositories/userRepository.js';
import { validateIdForRole, isValidCategorizedId, normalizeIdForQuery } from '../utils/idGenerator.js';

/**
 * Middleware que valida que un ID de usuario corresponde al rol esperado
 */
export const validateUserAccess = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userIdParam = req.params.userId || req.params.id || req.body.userId || req.body.id;
    
    // Si no hay userId en los parámetros, continuar (puede ser que use req.userId del token)
    if (!userIdParam) {
      return next();
    }

    // Validar formato del ID
    if (!isValidCategorizedId(userIdParam)) {
      return res.status(400).json({ 
        message: 'Formato de ID inválido.' 
      });
    }

    // Obtener el rol del usuario autenticado
    const userRole = req.user?.rol;
    if (!userRole) {
      return res.status(401).json({ 
        message: 'Usuario no autenticado.' 
      });
    }

    // Validar que el ID corresponde al rol del usuario
    if (!validateIdForRole(userIdParam, userRole)) {
      return res.status(403).json({ 
        message: 'No tienes permiso para acceder a este recurso con tu rol actual.' 
      });
    }

    const internalId = normalizeIdForQuery(userIdParam);
    const targetUser = await findUserById(internalId);

    if (!targetUser) {
      return res.status(404).json({ message: 'Usuario no encontrado.' });
    }

    if (userRole === 'estudiante') {
      if (req.userId !== internalId) {
        return res.status(403).json({ message: 'Solo puedes acceder a tu propio perfil.' });
      }
    }

    if (userRole === 'padre') {
      const hijoId = (req.user as { hijoId?: string })?.hijoId;
      if (hijoId && hijoId !== internalId && targetUser.role !== 'estudiante') {
        return res.status(403).json({ message: 'Solo puedes acceder a información de tu hijo.' });
      }
    }

    if (req.user?.rol !== 'super_admin' && targetUser.institution_id !== req.user?.colegioId) {
      return res.status(403).json({ 
        message: 'No tienes acceso a usuarios de otro colegio.' 
      });
    }

    // Agregar usuario objetivo al request para uso posterior
    (req as any).targetUser = targetUser;
    (req as any).targetUserId = internalId;
    next();
  } catch (error: any) {
    console.error('Error en validateUserAccess:', error);
    return res.status(500).json({ message: 'Error al validar acceso.' });
  }
};

/**
 * Middleware que valida que el usuario autenticado tiene un rol específico
 */
export const requireRole = (...allowedRoles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    const userRole = req.user?.rol;
    
    if (!userRole) {
      return res.status(401).json({ message: 'Usuario no autenticado.' });
    }
    
    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({ 
        message: `Esta acción requiere uno de los siguientes roles: ${allowedRoles.join(', ')}` 
      });
    }
    
    next();
  };
};

/**
 * Helper para normalizar IDs en queries de MongoDB
 * Acepta tanto IDs categorizados como ObjectIds directos
 */
export function normalizeUserId(id: string | undefined): string | undefined {
  if (!id) return id;
  return normalizeIdForQuery(id);
}

