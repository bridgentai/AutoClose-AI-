/**
 * Seed: Horario para grupo 11H (materias del colegio) y horario para profesor Andres Garcia (grupos/cursos).
 * Ejecutar desde la raíz: npm run seed:horarios
 * Requiere que existan: un grupo con nombre 11H, materias (cursos), y un profesor "Andres Garcia".
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDB } from '../config/db';
import { User, Group, Course } from '../models';
import { GroupSchedule } from '../models/GroupSchedule';
import { ProfessorSchedule } from '../models/ProfessorSchedule';

const GRUPO_NOMBRE = '11H';
const PROFESOR_NOMBRE = 'andres garcia';

async function getColegioId(): Promise<string> {
  const group = await Group.findOne().select('colegioId').lean();
  if (group?.colegioId) return (group as any).colegioId;
  const user = await User.findOne().select('colegioId').lean();
  const id = (user as any)?.colegioId;
  if (!id) throw new Error('No hay colegioId en grupos ni usuarios. Crea datos primero.');
  return id;
}

async function run() {
  console.log('[SEED Horarios] Conectando a MongoDB...');
  await connectDB();
  if (mongoose.connection.readyState !== 1) {
    throw new Error('No se pudo conectar a MongoDB. Revisa MONGO_URI en .env');
  }

  const colegioId = await getColegioId();
  console.log('[SEED Horarios] colegioId:', colegioId);

  // Buscar grupo 11H (nombre exacto o que contenga 11H)
  const group11H = await Group.findOne({
    colegioId,
    $or: [{ nombre: GRUPO_NOMBRE }, { nombre: new RegExp('11H', 'i') }],
  })
    .select('_id nombre')
    .lean();
  if (!group11H) {
    throw new Error(`No se encontró el grupo "${GRUPO_NOMBRE}". Crea el grupo 11H en el colegio.`);
  }
  const grupoId = (group11H as any)._id.toString();
  console.log('[SEED Horarios] Grupo 11H encontrado:', (group11H as any).nombre, grupoId);

  // Materias (cursos) del colegio con profesor
  const courses = await Course.find({ colegioId })
    .populate('profesorIds', 'nombre')
    .select('_id nombre')
    .lean();
  if (!courses.length) {
    throw new Error('No hay materias (cursos) en el colegio. Crea materias primero.');
  }
  const courseIds = courses.map((c: any) => c._id.toString());
  console.log('[SEED Horarios] Materias encontradas:', courses.length, courses.map((c: any) => c.nombre).join(', '));

  // Profesor Andres Garcia (o el primer profesor del colegio si no existe)
  let profesor = await User.findOne({
    colegioId,
    rol: 'profesor',
    nombre: new RegExp(PROFESOR_NOMBRE.replace(/\s+/g, '.*'), 'i'),
  })
    .select('_id nombre')
    .lean();
  if (!profesor) {
    profesor = await User.findOne({ colegioId, rol: 'profesor' }).select('_id nombre').lean();
    if (profesor) console.log('[SEED Horarios] "Andres Garcia" no encontrado; usando primer profesor del colegio.');
  }
  if (!profesor) {
    throw new Error('No se encontró el profesor "Andres Garcia" ni ningún otro profesor. Crea al menos un usuario profesor.');
  }
  const profesorId = (profesor as any)._id.toString();
  console.log('[SEED Horarios] Profesor para horario:', (profesor as any).nombre, profesorId);

  // Todos los grupos del colegio (para el horario del profesor)
  const allGroups = await Group.find({ colegioId }).select('_id nombre').lean();
  const groupIds = allGroups.map((g: any) => g._id.toString());
  console.log('[SEED Horarios] Grupos para profesor:', allGroups.length, allGroups.map((g: any) => g.nombre).join(', '));

  // Períodos enseñables: 1,2,3,5,6,8,9 (4=Break, 7=Almuerzo)
  const teachingPeriods = [1, 2, 3, 5, 6, 8, 9];
  const dias = [1, 2, 3, 4, 5, 6];

  // --- Horario grupo 11H: cada celda (dia, periodo) = una materia (courseId)
  const slotsGrupo: Record<string, string> = {};
  let courseIndex = 0;
  for (const dia of dias) {
    for (const per of teachingPeriods) {
      const key = `${dia}-${per}`;
      slotsGrupo[key] = courseIds[courseIndex % courseIds.length];
      courseIndex++;
    }
  }
  await GroupSchedule.findOneAndUpdate(
    { colegioId, grupoId },
    { $set: { slots: slotsGrupo, updatedAt: new Date() } },
    { upsert: true, new: true }
  );
  console.log('[SEED Horarios] Horario guardado para grupo 11H:', Object.keys(slotsGrupo).length, 'slots');

  // --- Horario profesor Andres Garcia: cada celda = un grupo (para variar: 11H y otros)
  const slotsProfesor: Record<string, string> = {};
  let groupIndex = 0;
  for (const dia of dias) {
    for (const per of teachingPeriods) {
      const key = `${dia}-${per}`;
      slotsProfesor[key] = groupIds[groupIndex % groupIds.length];
      groupIndex++;
    }
  }
  await ProfessorSchedule.findOneAndUpdate(
    { colegioId, profesorId },
    { $set: { slots: slotsProfesor, updatedAt: new Date() } },
    { upsert: true, new: true }
  );
  console.log('[SEED Horarios] Horario guardado para Andres Garcia:', Object.keys(slotsProfesor).length, 'slots');

  console.log('[SEED Horarios] Listo. Ambos horarios confirmados.');
  process.exit(0);
}

run().catch((err) => {
  console.error('[SEED Horarios] Error:', err.message);
  process.exit(1);
});
