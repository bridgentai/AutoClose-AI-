import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { User } from '../models';

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET no está configurado');
}

interface JwtPayload {
  id: string;
}

export interface AuthRequest extends Request {
  user?: {
    id: string;
    colegioId: string;
    rol: 'estudiante' | 'profesor' | 'directivo' | 'padre' | 'administrador-general' | 'transporte' | 'tesoreria' | 'nutricion' | 'cafeteria';
    curso?: string;
  };
}

export const protect = async (req: AuthRequest, res: Response, next: NextFunction) => {
  let token: string | undefined;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
      
      console.log('[AUTH] Token decodificado, buscando usuario con ID:', decoded.id);
      
      const userDoc = await User.findById(decoded.id).select('-password');
      
      if (!userDoc) {
        console.error('[AUTH] Usuario no encontrado en BD con ID:', decoded.id);
        return res.status(401).json({ message: 'Usuario no encontrado. Token inválido.' });
      }

      console.log('[AUTH] Usuario autenticado:', userDoc.nombre, 'Rol:', userDoc.rol);

      req.user = {
        id: userDoc._id.toString(),
        colegioId: userDoc.colegioId,
        rol: userDoc.rol,
        curso: userDoc.curso,
      };

      return next();
    } catch (error: any) {
      console.error('[AUTH] Error de autenticación:', error.message);
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({ message: 'Token expirado. Por favor, inicia sesión nuevamente.' });
      }
      if (error.name === 'JsonWebTokenError') {
        return res.status(401).json({ message: 'Token inválido. Por favor, inicia sesión nuevamente.' });
      }
      return res.status(401).json({ message: 'Token no válido o expirado.' });
    }
  }

  console.warn('[AUTH] No se encontró token en el header Authorization');
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
