import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { User } from '../models';
import { extractInternalId, generateUserId, normalizeIdForQuery } from '../utils/idGenerator';

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET no está configurado');
}

export interface AuthRequest extends Request {
  userId?: string; // ID interno (ObjectId)
  categorizedUserId?: string; // ID categorizado (ej: "PROF-507f1f77bcf86cd799439011")
  user?: {
    id: string; // ID interno
    categorizedId: string; // ID categorizado
    colegioId: string;
    rol: 'estudiante' | 'profesor' | 'directivo' | 'padre' | 'administrador-general' | 'transporte' | 'tesoreria' | 'nutricion' | 'cafeteria';
    curso?: string;
    materias?: string[];
  };
}

export const protect = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    let token;

    // Obtener token del header Authorization
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({ message: 'No autorizado. Token no proporcionado.' });
    }

    // Verificar token
    const decoded = jwt.verify(token, JWT_SECRET) as { id: string };
    req.userId = decoded.id;

    // Cargar datos del usuario
    const userDoc = await User.findById(decoded.id).select('-password');
    if (!userDoc) {
      return res.status(401).json({ message: 'Usuario no encontrado.' });
    }

    // Generar o obtener userId categorizado
    let categorizedId = userDoc.userId;
    if (!categorizedId && userDoc.rol) {
      try {
        const generated = generateUserId(userDoc.rol, userDoc._id);
        categorizedId = generated.fullId;
        
        // Guardar el userId categorizado en la BD (sin bloquear la request)
        User.findByIdAndUpdate(userDoc._id, { userId: categorizedId }).catch((err) => {
          console.error('Error al guardar userId categorizado:', err);
        });
      } catch (error: any) {
        console.error('Error al generar userId categorizado:', error.message);
        // Usar ID interno como fallback
        categorizedId = userDoc._id.toString();
      }
    }

    req.categorizedUserId = categorizedId;
    req.user = {
      id: userDoc._id.toString(),
      categorizedId: categorizedId || userDoc._id.toString(), // Fallback si no hay categorizado
      colegioId: userDoc.colegioId,
      rol: userDoc.rol,
      curso: userDoc.curso,
      materias: userDoc.materias,
    };

    next();
  } catch (error) {
    return res.status(401).json({ message: 'No autorizado. Token inválido.' });
  }
};
