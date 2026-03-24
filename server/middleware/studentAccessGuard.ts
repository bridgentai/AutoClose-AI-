/**
 * studentAccessGuard.ts
 * Helpers para validar que el usuario autenticado tiene permiso
 * para ver datos de un estudiante específico.
 */

import { Response, NextFunction } from 'express';
import type { AuthRequest } from './auth.js';
import { queryPg } from '../config/db-pg.js';

type AccessLevel = 'all_teachers' | 'own_teacher_only';

/**
 * Verifica si el usuario puede ver datos de un estudiante.
 *
 * @param accessLevel
 *   'all_teachers'      → todos los profesores del colegio pueden ver
 *   'own_teacher_only'  → solo el profesor directo del estudiante puede ver
 */
export function requireStudentAccess(
  paramName: string = 'estudianteId',
  accessLevel: AccessLevel = 'all_teachers'
) {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    const rol = req.user?.rol;
    const userId = req.user?.id;
    const colegioId = req.user?.colegioId;
    const estudianteId = req.params[paramName];

    if (!rol || !userId || !estudianteId) {
      res.status(401).json({ message: 'No autenticado.' });
      return;
    }

    const rolesAdminDirectivo = [
      'directivo',
      'admin-general-colegio',
      'school_admin',
      'administrador-general',
      'super_admin',
      'asistente',
    ];
    if (rolesAdminDirectivo.includes(rol)) {
      next();
      return;
    }

    if (rol === 'estudiante' && userId === estudianteId) {
      next();
      return;
    }

    if (rol === 'padre') {
      const r = await queryPg(
        `SELECT 1 FROM guardian_students
         WHERE guardian_id = $1 AND student_id = $2 LIMIT 1`,
        [userId, estudianteId]
      );
      if (r.rows.length > 0) {
        next();
        return;
      }
      res.status(403).json({
        message: 'Solo puedes ver información de tu hijo vinculado.',
      });
      return;
    }

    if (rol === 'profesor') {
      if (!colegioId) {
        res.status(401).json({ message: 'No autenticado.' });
        return;
      }
      const estudianteR = await queryPg<{ institution_id: string }>(
        `SELECT institution_id FROM users WHERE id = $1 LIMIT 1`,
        [estudianteId]
      );
      if (!estudianteR.rows.length || estudianteR.rows[0].institution_id !== colegioId) {
        res.status(403).json({ message: 'Estudiante no encontrado en tu institución.' });
        return;
      }

      if (accessLevel === 'all_teachers') {
        next();
        return;
      }

      if (accessLevel === 'own_teacher_only') {
        const r = await queryPg(
          `SELECT 1
           FROM enrollments e
           JOIN group_subjects gs ON gs.group_id = e.group_id
           WHERE e.student_id = $1
             AND gs.teacher_id = $2
           LIMIT 1`,
          [estudianteId, userId]
        );
        if (r.rows.length > 0) {
          next();
          return;
        }
        res.status(403).json({
          message: 'Solo puedes ver datos de estudiantes de tus cursos.',
        });
        return;
      }
    }

    res.status(403).json({
      message: 'No tienes permiso para ver datos de este estudiante.',
    });
  };
}
