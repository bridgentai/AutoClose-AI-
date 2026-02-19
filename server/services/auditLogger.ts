import { Types } from 'mongoose';
import { AIActionLog, type IAIActionLog } from '../models/AIActionLog';

export interface AuditLogData {
  userId: string | Types.ObjectId;
  role: string;
  action: string;
  entityType: string;
  entityId?: string | Types.ObjectId;
  cursoId?: string | Types.ObjectId;
  colegioId: string;
  result: 'success' | 'denied' | 'error';
  error?: string;
  requestData?: Record<string, any>;
}

/** Acciones críticas de admin para auditoría (crear usuario, asignar grupo, vincular, etc.) */
export type AdminAuditAction =
  | 'create_user'
  | 'create_group'
  | 'assign_student'
  | 'assign_professor_to_groups'
  | 'assign_professor'
  | 'enroll_students'
  | 'vinculacion'
  | 'confirmar_vinculacion'
  | 'activar_cuentas';

/**
 * Registra una acción de administración (admin general del colegio) para auditoría y cumplimiento.
 * Usa la misma colección que las acciones de IA (ai_action_logs) con action distintivo.
 */
export async function logAdminAction(data: {
  userId: string | Types.ObjectId;
  role: string;
  action: AdminAuditAction | string;
  entityType: string;
  entityId?: string | Types.ObjectId;
  colegioId: string;
  requestData?: Record<string, unknown>;
}): Promise<void> {
  try {
    await AIActionLog.create({
      userId: typeof data.userId === 'string' ? new Types.ObjectId(data.userId) : data.userId,
      role: data.role,
      action: data.action,
      entityType: data.entityType,
      entityId: data.entityId
        ? (typeof data.entityId === 'string' ? new Types.ObjectId(data.entityId) : data.entityId)
        : undefined,
      colegioId: data.colegioId,
      timestamp: new Date(),
      result: 'success',
      requestData: data.requestData as Record<string, any> | undefined,
    });
  } catch (error: any) {
    console.error('Error al registrar acción de admin en auditoría:', error.message);
  }
}

/**
 * Registra una acción ejecutada por IA en el sistema de auditoría
 * CRÍTICO: Registra incluso las acciones denegadas para seguridad
 */
export async function logAIAction(data: AuditLogData): Promise<void> {
  try {
    await AIActionLog.create({
      userId: typeof data.userId === 'string' ? new Types.ObjectId(data.userId) : data.userId,
      role: data.role,
      action: data.action,
      entityType: data.entityType,
      entityId: data.entityId 
        ? (typeof data.entityId === 'string' ? new Types.ObjectId(data.entityId) : data.entityId)
        : undefined,
      cursoId: data.cursoId
        ? (typeof data.cursoId === 'string' ? new Types.ObjectId(data.cursoId) : data.cursoId)
        : undefined,
      colegioId: data.colegioId,
      timestamp: new Date(),
      result: data.result,
      error: data.error,
      requestData: data.requestData,
    });
  } catch (error: any) {
    // No lanzar error para no interrumpir el flujo principal
    // Pero registrar en consola para debugging
    console.error('Error al registrar acción de IA en auditoría:', error.message);
  }
}

export interface AuditLogsFilter {
  action?: string;
  entityType?: string;
  startDate?: string; // ISO
  endDate?: string; // ISO
  limit?: number;
  skip?: number;
}

/**
 * Obtiene logs de auditoría para el colegio (solo admin). Incluye acciones de admin y de IA.
 */
export async function getAuditLogs(
  colegioId: string,
  filters: AuditLogsFilter = {}
): Promise<{ logs: IAIActionLog[]; total: number }> {
  try {
    const query: Record<string, unknown> = { colegioId };
    if (filters.action) query.action = filters.action;
    if (filters.entityType) query.entityType = filters.entityType;
    if (filters.startDate || filters.endDate) {
      query.timestamp = {};
      if (filters.startDate) (query.timestamp as Record<string, Date>).$gte = new Date(filters.startDate);
      if (filters.endDate) (query.timestamp as Record<string, Date>).$lte = new Date(filters.endDate);
    }
    const limit = Math.min(Math.max(1, filters.limit || 50), 200);
    const skip = Math.max(0, filters.skip || 0);
    const [logs, total] = await Promise.all([
      AIActionLog.find(query).sort({ timestamp: -1 }).skip(skip).limit(limit).lean(),
      AIActionLog.countDocuments(query),
    ]);
    return { logs, total };
  } catch (error: any) {
    console.error('Error al obtener logs de auditoría:', error.message);
    return { logs: [], total: 0 };
  }
}

/**
 * Obtiene el historial de acciones de IA para un usuario
 */
export async function getAIActionHistory(
  userId: string | Types.ObjectId,
  limit: number = 50
): Promise<IAIActionLog[]> {
  try {
    const userIdObj = typeof userId === 'string' ? new Types.ObjectId(userId) : userId;
    return await AIActionLog.find({ userId: userIdObj })
      .sort({ timestamp: -1 })
      .limit(limit)
      .lean();
  } catch (error: any) {
    console.error('Error al obtener historial de acciones de IA:', error.message);
    return [];
  }
}

/**
 * Obtiene estadísticas de acciones de IA por rol
 */
export async function getAIActionStats(
  colegioId: string,
  startDate?: Date,
  endDate?: Date
): Promise<{
  total: number;
  byResult: Record<string, number>;
  byAction: Record<string, number>;
  byRole: Record<string, number>;
}> {
  try {
    const query: any = { colegioId };
    
    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) query.timestamp.$gte = startDate;
      if (endDate) query.timestamp.$lte = endDate;
    }

    const logs = await AIActionLog.find(query).lean();

    const stats = {
      total: logs.length,
      byResult: {} as Record<string, number>,
      byAction: {} as Record<string, number>,
      byRole: {} as Record<string, number>,
    };

    logs.forEach(log => {
      stats.byResult[log.result] = (stats.byResult[log.result] || 0) + 1;
      stats.byAction[log.action] = (stats.byAction[log.action] || 0) + 1;
      stats.byRole[log.role] = (stats.byRole[log.role] || 0) + 1;
    });

    return stats;
  } catch (error: any) {
    console.error('Error al obtener estadísticas de acciones de IA:', error.message);
    return {
      total: 0,
      byResult: {},
      byAction: {},
      byRole: {},
    };
  }
}

