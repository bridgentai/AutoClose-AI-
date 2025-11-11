import express from 'express';
import jwt from 'jsonwebtoken';
import { User } from '../models';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET;
const TOKEN_EXPIRES = '30d';

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET no está configurado');
}

const generateToken = (id: string) => jwt.sign({ id }, JWT_SECRET, { expiresIn: TOKEN_EXPIRES });

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { nombre, email, password, rol, curso, colegioId, hijoId } = req.body;

    if (!nombre || !email || !password || !rol) {
      return res.status(400).json({ message: 'Faltan campos obligatorios.' });
    }

    if (!['estudiante', 'profesor', 'directivo', 'padre'].includes(rol)) {
      return res.status(400).json({ message: 'Rol inválido.' });
    }

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(400).json({ message: 'El correo ya está registrado.' });
    }

    const newUser = new User({
      nombre,
      email: email.toLowerCase(),
      password,
      rol,
      curso: rol === 'estudiante' ? curso : undefined,
      colegioId: colegioId || 'default_colegio',
      hijoId: rol === 'padre' ? hijoId : undefined,
    });

    await newUser.save();

    const token = generateToken(newUser._id.toString());

    return res.status(201).json({
      id: newUser._id,
      nombre: newUser.nombre,
      email: newUser.email,
      rol: newUser.rol,
      curso: newUser.curso,
      colegioId: newUser.colegioId,
      token,
    });
  } catch (err: any) {
    console.error('Error en register:', err.message);
    return res.status(500).json({ message: 'Error interno del servidor.' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Faltan credenciales.' });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({ message: 'Usuario no encontrado.' });
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Contraseña incorrecta.' });
    }

    const token = generateToken(user._id.toString());

    res.json({
      id: user._id,
      nombre: user.nombre,
      email: user.email,
      rol: user.rol,
      curso: user.curso,
      colegioId: user.colegioId,
      token,
    });
  } catch (err: any) {
    console.error('Error en login:', err.message);
    return res.status(500).json({ message: 'Error interno del servidor.' });
  }
});

export default router;
