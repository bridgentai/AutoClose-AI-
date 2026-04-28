/**
 * Re-export del auth canónico + restrictTo para rutas que importaban este módulo.
 */
import type { Response, NextFunction } from 'express';
import {
  protect as protectCanonical,
  type AuthRequest as CanonicalAuthRequest,
} from './auth.js';

export type AuthRequest = CanonicalAuthRequest;

export const protect = protectCanonical;

export const restrictTo = (...roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.rol)) {
      return res.status(403).json({
        message: `Acceso denegado. Se requiere uno de estos roles: ${roles.join(', ')}`,
      });
    }
    next();
  };
};
