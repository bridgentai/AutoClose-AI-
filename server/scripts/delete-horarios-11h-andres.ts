/**
 * Borra los horarios creados por el seed para grupo 11H y profesor (profe2/Andres Garcia).
 * Ejecutar: npm run delete:horarios
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDB } from '../config/db';
import { Group } from '../models/Group';
import { User } from '../models/User';
import { GroupSchedule } from '../models/GroupSchedule';
import { ProfessorSchedule } from '../models/ProfessorSchedule';

async function getColegioId(): Promise<string> {
  const group = await Group.findOne().select('colegioId').lean();
  if (group?.colegioId) return (group as any).colegioId;
  const user = await User.findOne().select('colegioId').lean();
  const id = (user as any)?.colegioId;
  if (!id) throw new Error('No hay colegioId en la base.');
  return id;
}

async function run() {
  console.log('[DELETE Horarios] Conectando a MongoDB...');
  await connectDB();
  if (mongoose.connection.readyState !== 1) {
    throw new Error('No se pudo conectar a MongoDB.');
  }

  const colegioId = await getColegioId();
  console.log('[DELETE Horarios] colegioId:', colegioId);

  const group11H = await Group.findOne({
    colegioId,
    $or: [{ nombre: '11H' }, { nombre: /11H/i }],
  })
    .select('_id nombre')
    .lean();

  if (group11H) {
    const grupoId = (group11H as any)._id.toString();
    const r = await GroupSchedule.deleteMany({ colegioId, grupoId });
    console.log('[DELETE Horarios] Horario grupo 11H eliminado:', r.deletedCount, 'documento(s)');
  } else {
    console.log('[DELETE Horarios] No se encontró grupo 11H, nada que borrar.');
  }

  const prof = await User.findOne({
    colegioId,
    rol: 'profesor',
    nombre: /andres.*garcia/i,
  })
    .select('_id nombre')
    .lean();
  const profesorToDelete = prof || (await User.findOne({ colegioId, rol: 'profesor' }).select('_id nombre').lean());

  if (profesorToDelete) {
    const profesorId = (profesorToDelete as any)._id.toString();
    const r = await ProfessorSchedule.deleteMany({ colegioId, profesorId });
    console.log('[DELETE Horarios] Horario profesor eliminado:', r.deletedCount, 'documento(s)', (profesorToDelete as any).nombre);
  } else {
    console.log('[DELETE Horarios] No se encontró profesor, nada que borrar.');
  }

  console.log('[DELETE Horarios] Listo.');
  process.exit(0);
}

run().catch((err) => {
  console.error('[DELETE Horarios] Error:', err.message);
  process.exit(1);
});
