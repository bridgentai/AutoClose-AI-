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
  { method: 'POST', pathContains: '/api/attendance', action: 'attendance_mutate', entityType: 'attendance' },
  { method: 'PUT', pathContains: '/api/attendance', action: 'attendance_mutate', entityType: 'attendance' },
  { method: 'POST', pathContains: '/api/boletin', action: 'boletin_mutate', entityType: 'boletin' },
  { method: 'POST', pathContains: '/api/logros-calificacion', action: 'grades_mutate', entityType: 'grading' },
  { method: 'PUT', pathContains: '/api/logros-calificacion', action: 'grades_mutate', entityType: 'grading' },
  { method: 'POST', pathContains: '/api/grade-events', action: 'grade_events_mutate', entityType: 'grading' },
  { method: 'PUT', pathContains: '/api/grade-events', action: 'grade_events_mutate', entityType: 'grading' },
  { method: 'POST', pathContains: '/api/admin/sql', action: 'admin_sql', entityType: 'sql' },
];

export function getClientIP(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  let raw: string;
  if (typeof forwarded === 'string') {
    raw = forwarded.split(',')[0].trim();
  } else if (Array.isArray(forwarded) && forwarded[0]) {
    raw = forwarded[0].split(',')[0].trim();
  } else {
    raw = req.socket?.remoteAddress ?? 'unknown';
  }
  return anonymizeIP(raw);
}

function anonymizeIP(ip: string): string {
  const trimmed = ip.trim();
  const ipv4 = trimmed.match(/^(\d{1,3}\.\d{1,3}\.\d{1,3})\.\d{1,3}$/);
  if (ipv4) return `${ipv4[1]}.x`;

  const ipv4mapped = trimmed.match(/^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3})\.\d{1,3}$/i);
  if (ipv4mapped) {
    return `::ffff:${ipv4mapped[1]}.x`;
  }

  if (trimmed.includes(':')) {
    const parts = trimmed.split(':').filter((p) => p.length > 0);
    if (parts.length >= 4) return `${parts.slice(0, 4).join(':')}::x`;
    if (parts.length > 0) return `${parts[0]}::x`;
  }

  if (!trimmed || trimmed === 'unknown') return 'unknown';
  return 'unknown';
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
