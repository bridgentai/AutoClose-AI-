import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { User } from '../models';

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET no está configurado');
}

export interface AuthRequest extends Request {
  userId?: string;
  user?: {
    id: string;
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

    // Cargar datos del usuario para tener acceso a rol, colegioId, etc.
    const userDoc = await User.findById(decoded.id).select('-password');
    if (userDoc) {
      req.user = {
        id: userDoc._id.toString(),
        colegioId: userDoc.colegioId,
        rol: userDoc.rol,
        curso: userDoc.curso,
        materias: userDoc.materias,
      };
    }

    next();
  } catch (error) {
    return res.status(401).json({ message: 'No autorizado. Token inválido.' });
  }
};
