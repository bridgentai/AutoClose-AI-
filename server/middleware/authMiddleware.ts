import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { User } from '../models';

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  console.error('❌ Error: JWT_SECRET no está configurado');
  process.exit(1);
}

interface JwtPayload {
  id: string;
}

export interface AuthRequest extends Request {
  user?: {
    id: string;
    colegioId: string;
    rol: 'estudiante' | 'profesor' | 'directivo' | 'padre';
    curso?: string;
  };
}

export const protect = async (req: AuthRequest, res: Response, next: NextFunction) => {
  let token: string | undefined;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
      
      const userDoc = await User.findById(decoded.id).select('-password');
      
      if (!userDoc) {
        return res.status(401).json({ message: 'Usuario no encontrado. Token inválido.' });
      }

      req.user = {
        id: userDoc._id.toString(),
        colegioId: userDoc.colegioId,
        rol: userDoc.rol,
        curso: userDoc.curso,
      };

      return next();
    } catch (error: any) {
      console.error('Error de autenticación:', error.message);
      return res.status(401).json({ message: 'Token no válido o expirado.' });
    }
  }

  return res.status(401).json({ message: 'No autorizado, no se encontró token.' });
};

export const restrictTo = (...roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.rol)) {
      return res.status(403).json({ 
        message: `Acceso denegado. Se requiere uno de estos roles: ${roles.join(', ')}` 
      });
    }
    next();
  };
};
