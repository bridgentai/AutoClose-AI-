import express from 'express';
import bcrypt from 'bcryptjs';
import { protect, AuthRequest } from '../middleware/auth.js';
import { requireSuperAdmin } from '../middleware/superAdmin.js';
import { findAllInstitutions, createInstitution, findInstitutionById } from '../repositories/institutionRepository.js';
import { createInstitutionCode } from '../repositories/institutionCodeRepository.js';
import { createUser, findUserByEmailAndInstitution } from '../repositories/userRepository.js';

const router = express.Router();

router.get('/schools', protect, requireSuperAdmin, async (_req: AuthRequest, res) => {
  try {
    const institutions = await findAllInstitutions();
    const schoolsWithStats = institutions.map((inst) => ({
      _id: inst.id,
      colegioId: inst.id,
      nombre: inst.name,
      slug: inst.slug,
      userCount: 0,
      superAdmin: null,
    }));
    return res.json(schoolsWithStats);
  } catch (error: unknown) {
    console.error('Error al listar colegios:', error);
    return res.status(500).json({ message: 'Error al obtener la lista de colegios.' });
  }
});

router.post('/schools', protect, requireSuperAdmin, async (req: AuthRequest, res) => {
  try {
    const { nombre, colegioId } = req.body;
    if (!nombre?.trim() || !colegioId?.trim()) {
      return res.status(400).json({ message: 'El nombre y el ID del colegio son obligatorios.' });
    }
    const slug = String(colegioId).trim().toUpperCase();
    const inst = await createInstitution({
      name: nombre.trim(),
      slug,
      settings: {},
    });
    const codigoAcceso = slug;
    await createInstitutionCode({
      institution_id: inst.id,
      code: codigoAcceso,
      role_assigned: 'admin-general-colegio',
    });
    return res.status(201).json({
      message: 'Colegio creado exitosamente.',
      school: { _id: inst.id, colegioId: inst.id, nombre: inst.name, slug: inst.slug },
      codigoAcceso,
      mensaje: `Código de acceso para administrador: ${codigoAcceso}`,
    });
  } catch (error: unknown) {
    console.error(error);
    return res.status(500).json({ message: 'Error al crear colegio.' });
  }
});

router.post('/schools/:colegioId/assign-admin', protect, requireSuperAdmin, async (req: AuthRequest, res) => {
  try {
    const { colegioId } = req.params;
    const { nombre, email, password } = req.body;
    if (!nombre?.trim() || !email?.trim() || !password?.trim()) {
      return res.status(400).json({ message: 'Nombre, email y contraseña son obligatorios.' });
    }

    let institutionId: string | undefined;
    const inst = await findInstitutionById(colegioId);
    if (inst) institutionId = inst.id;
    else {
      const all = await findAllInstitutions();
      const bySlug = all.find((i) => i.slug === colegioId || i.id === colegioId);
      if (!bySlug) return res.status(404).json({ message: 'Colegio no encontrado.' });
      institutionId = bySlug.id;
    }

    const existing = await findUserByEmailAndInstitution(email.trim().toLowerCase(), institutionId);
    if (existing) return res.status(400).json({ message: 'Ya existe un usuario con ese email en este colegio.' });

    const passwordHash = await bcrypt.hash(password, 10);
    const admin = await createUser({
      institution_id: institutionId,
      email: email.trim().toLowerCase(),
      password_hash: passwordHash,
      full_name: nombre.trim(),
      role: 'admin-general-colegio',
      status: 'active',
    });
    return res.status(201).json({
      message: 'Administrador asignado exitosamente.',
      admin: { _id: admin.id, nombre: admin.full_name, email: admin.email },
    });
  } catch (error: unknown) {
    console.error(error);
    return res.status(500).json({ message: 'Error al asignar administrador.' });
  }
});

router.get('/schools/:colegioId', protect, requireSuperAdmin, async (req: AuthRequest, res) => {
  try {
    const { colegioId } = req.params;
    const institutions = await findAllInstitutions();
    const inst = institutions.find((i) => i.id === colegioId || i.slug === colegioId);
    if (!inst) return res.status(404).json({ message: 'Colegio no encontrado.' });
    return res.json({ ...inst, userCount: 0 });
  } catch (error: unknown) {
    console.error(error);
    return res.status(500).json({ message: 'Error al obtener colegio.' });
  }
});

export default router;
