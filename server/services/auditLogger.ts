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

