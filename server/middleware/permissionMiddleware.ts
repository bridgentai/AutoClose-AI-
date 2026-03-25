/**
 * Middleware factory que usa la matriz de rolePermissions.ts.
 */

import { Response, NextFunction } from 'express';
import type { AuthRequest } from './auth.js';
import { can, isAdmin, type Resource, type Action } from '../config/rolePermissions.js';
import { logDeniedAccess } from '../services/auditLogger.js';
import { getClientIP } from './auditMiddleware.js';

export function requirePermission(resource: Resource, action: Action) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    const role = req.user?.rol;

    if (!role) {
      res.status(401).json({ message: 'No autenticado.' });
      return;
    }

    if (!can(role, resource, action)) {
      const institutionId = req.user?.colegioId ?? req.user?.institution_id ?? '';
      if (req.user?.id && institutionId) {
        void logDeniedAccess({
          userId: req.user.id,
          role,
          action: `${action}_${resource}`,
          entityType: resource,
          institutionId,
          ipAddress: getClientIP(req),
          reason: `Rol '${role}' no tiene permiso '${action}' sobre '${resource}'`,
        }).catch(() => {});
      }

      res.status(403).json({
        message: `Tu rol (${role}) no tiene permiso para realizar esta acción.`,
      });
      return;
    }

    next();
  };
}

/** Admin de colegio, administrador general o super admin. */
export function requireAdmin() {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    const role = req.user?.rol;
    if (!role) {
      res.status(401).json({ message: 'No autenticado.' });
      return;
    }
    if (!isAdmin(role)) {
      res.status(403).json({ message: 'Esta acción requiere permisos de administración.' });
      return;
    }
    next();
  };
}

export function requireOwnResource(paramName: string = 'userId') {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    const role = req.user?.rol;
    const targetId = req.params[paramName];
    const ownId = req.user?.id;

    const privilegedRoles = [
      'admin-general-colegio',
      'school_admin',
      'administrador-general',
      'super_admin',
      'directivo',
      'asistente',
    ];

    if (privilegedRoles.includes(role ?? '')) {
      next();
      return;
    }

    if (role === 'profesor') {
      next();
      return;
    }

    if (targetId && targetId !== ownId) {
      res.status(403).json({ message: 'Solo puedes acceder a tus propios recursos.' });
      return;
    }

    next();
  };
}
