/**
 * Middleware de auditoría: registra acciones críticas en analytics.activity_logs
 * tras enviar la respuesta (res.on('finish')).
 */

import { Request, Response, NextFunction } from 'express';
import type { AuthRequest } from './auth.js';
import { logAuditEvent } from '../services/auditLogger.js';

const AUDITED_PATTERNS: Array<{
  method: string;
  pathContains: string;
  action: string;
  entityType: string;
}> = [
  { method: 'POST', pathContains: '/api/users', action: 'create_user', entityType: 'user' },
  { method: 'DELETE', pathContains: '/api/users', action: 'delete_user', entityType: 'user' },
  { method: 'PUT', pathContains: '/api/users', action: 'update_user', entityType: 'user' },
  { method: 'POST', pathContains: '/api/groups', action: 'create_group', entityType: 'group' },
  { method: 'POST', pathContains: '/api/assignments', action: 'create_assignment', entityType: 'assignment' },
  { method: 'PUT', pathContains: '/api/assignments', action: 'mutate_assignment', entityType: 'assignment' },
  { method: 'POST', pathContains: '/api/uploads', action: 'upload', entityType: 'upload' },
];

export function getClientIP(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  if (Array.isArray(forwarded) && forwarded[0]) {
    return forwarded[0].split(',')[0].trim();
  }
  return req.socket?.remoteAddress ?? 'unknown';
}

function matchPath(req: AuthRequest): (typeof AUDITED_PATTERNS)[number] | undefined {
  const urlPath = (req.originalUrl ?? req.url.split('?')[0] ?? req.path).split('?')[0];
  return AUDITED_PATTERNS.find((p) => p.method === req.method && urlPath.includes(p.pathContains));
}

/**
 * Middleware que registra acciones en patrones conocidos (respuesta ya enviada).
 * Requiere req.user (excepto login, que se audita en auth.ts al tener éxito).
 */
export function autoAudit(req: AuthRequest, res: Response, next: NextFunction): void {
  const pattern = matchPath(req);

  if (!pattern || !req.user) {
    next();
    return;
  }

  const institutionId = req.user.colegioId ?? req.user.institution_id ?? req.user.institutionId ?? '';
  if (!institutionId) {
    next();
    return;
  }

  res.on('finish', () => {
    const result =
      res.statusCode < 400 ? 'success' : res.statusCode === 403 ? 'denied' : 'error';
    void logAuditEvent({
      userId: req.user!.id,
      role: req.user!.rol ?? 'unknown',
      action: pattern.action,
      entityType: pattern.entityType,
      entityId: req.params?.id,
      institutionId,
      result,
      ipAddress: getClientIP(req),
      requestData: {
        method: req.method,
        path: req.originalUrl ?? req.path,
        statusCode: res.statusCode,
      },
    });
  });

  next();
}

/**
 * Factory — auditoría para una acción concreta (tras la respuesta).
 */
export function auditAction(action: string, entityType: string) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      next();
      return;
    }

    const institutionId = req.user.colegioId ?? req.user.institution_id ?? req.user.institutionId ?? '';
    if (!institutionId) {
      next();
      return;
    }

    res.on('finish', () => {
      const result =
        res.statusCode < 400 ? 'success' : res.statusCode === 403 ? 'denied' : 'error';
      void logAuditEvent({
        userId: req.user!.id,
        role: req.user!.rol ?? 'unknown',
        action,
        entityType,
        entityId: req.params?.id,
        institutionId,
        result,
        ipAddress: getClientIP(req),
        requestData: {
          method: req.method,
          path: req.originalUrl ?? req.path,
          statusCode: res.statusCode,
        },
      });
    });

    next();
  };
}
