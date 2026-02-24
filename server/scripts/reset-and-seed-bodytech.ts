/**
 * Reset + Seed Bodytech: borra todos los datos del colegio (excepto el admin)
 * y crea 10 cursos (9H, 10C, 10D, 10H, 11C, 11D, 11H, 12C, 12D, 12H),
 * 5 materias con 1 profesor por materia, 10 estudiantes por curso, 2 papás por estudiante.
 * Nombres reales; correo = ese nombre @gmail.com (ej: carlosgarcia@gmail.com). Contraseña: 123456
 * Ejecutar: npm run seed:bodytech:reset
 */
import 'dotenv/config';
import { connectDB, mongoose } from '../config/db';
import {
  User,
  Group,
  GroupStudent,
  Vinculacion,
  Course,
  Materia,
  Assignment,
  Boletin,
  Nota,
  LogroCalificacion,
  Asistencia,
  Evento,
} from '../models';
import { Types } from 'mongoose';

const ADMIN_EMAIL = 'adminbodytech@gmail.com';
const PASSWORD_PLAIN = '123456';
const STUDENTS_PER_COURSE = 10;
const PARENTS_PER_STUDENT = 2;

const GROUP_NAMES = ['9H', '10C', '10D', '10H', '11C', '11D', '11H', '12C', '12D', '12H'];

// 5 materias y 1 profesor (nombre real) por materia
const MATERIAS_Y_PROFESORES: { materia: string; profesorNombre: string }[] = [
  { materia: 'Sociales', profesorNombre: 'Roberto Martínez' },
  { materia: 'Matemáticas', profesorNombre: 'Carmen López' },
  { materia: 'Física', profesorNombre: 'Andrés García' },
  { materia: 'Inglés', profesorNombre: 'Patricia Sánchez' },
  { materia: 'Español', profesorNombre: 'Luis Fernández' },
];

// Nombres reales para estudiantes y padres (combinaciones nombre + apellido)
const NOMBRES: string[] = [
  'Carlos', 'María', 'José', 'Ana', 'Luis', 'Laura', 'Juan', 'Sofía', 'Miguel', 'Elena',
  'Pedro', 'Carmen', 'Pablo', 'Isabel', 'Diego', 'Lucía', 'Andrés', 'Valentina', 'Felipe', 'Paula',
  'Santiago', 'Adriana', 'Daniel', 'Claudia', 'Alejandro', 'Patricia', 'Mateo', 'Sandra', 'Sebastián', 'Carolina',
  'Nicolás', 'Andrea', 'Camilo', 'Rosa', 'David', 'Victoria', 'Jorge', 'Elena', 'Ricardo', 'Mónica',
];
const APELLIDOS: string[] = [
  'García', 'Rodríguez', 'Martínez', 'López', 'González', 'Pérez', 'Sánchez', 'Ramírez', 'Torres', 'Flores',
  'Rivera', 'Gómez', 'Díaz', 'Reyes', 'Morales', 'Ortiz', 'Gutiérrez', 'Ramos', 'Vargas', 'Castillo',
  'Jiménez', 'Moreno', 'Romero', 'Hernández', 'Ruiz', 'Mendoza', 'Silva', 'Castro', 'Suárez', 'Vega',
];

function nombreReal(index: number): string {
  const n = NOMBRES[index % NOMBRES.length];
  const a = APELLIDOS[Math.floor(index / NOMBRES.length) % APELLIDOS.length];
  return `${n} ${a}`;
}

/** Convierte nombre a slug para email: "Carlos García" -> "carlosgarcia" (sin acentos, minúsculas). */
function nombreToSlug(nombre: string): string {
  return nombre
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/\s+/g, '')
    .replace(/[^a-z0-9]/g, '');
}

/** Genera email único con ese nombre: nombre@gmail.com; si existe, nombre2@gmail.com, etc. */
function emailDesdeNombre(nombre: string, usados: Set<string>, sufijoUnico?: string): string {
  const base = nombreToSlug(nombre) || 'usuario';
  const baseEmail = sufijoUnico ? `${base}.${sufijoUnico}@gmail.com` : `${base}@gmail.com`;
  let email = baseEmail;
  let n = 1;
  while (usados.has(email)) {
    email = sufijoUnico ? `${base}.${sufijoUnico}.${++n}@gmail.com` : `${base}${++n}@gmail.com`;
  }
  usados.add(email);
  return email;
}

async function getAdminAndColegioId(): Promise<{ colegioId: string; adminId: Types.ObjectId }> {
  const admin = await User.findOne({
    $or: [{ email: ADMIN_EMAIL }, { correo: ADMIN_EMAIL }],
  })
    .select('_id colegioId rol')
    .lean();
  if (!admin) {
    throw new Error(
      `No se encontró el usuario ${ADMIN_EMAIL}. Crea primero una cuenta admin-general-colegio con ese correo.`
    );
  }
  const colegioId = (admin as any).colegioId;
  if (!colegioId) {
    throw new Error(`El usuario ${ADMIN_EMAIL} no tiene colegioId asignado.`);
  }
  console.log(`[RESET] ColegioId: ${colegioId}`);
  return { colegioId, adminId: (admin as any)._id };
}

async function deleteColegioData(colegioId: string, adminId: Types.ObjectId) {
  console.log('[RESET] Eliminando datos del colegio...');

  const assignmentIds = await Assignment.find({ colegioId }).select('_id').lean();
  const ids = (assignmentIds || []).map((a: any) => a._id);
  if (ids.length > 0) {
    await Nota.deleteMany({ tareaId: { $in: ids } });
  }
  await Assignment.deleteMany({ colegioId });
  await Boletin.deleteMany({ colegioId });
  await LogroCalificacion.deleteMany({ colegioId });
  await Vinculacion.deleteMany({ colegioId });
  await GroupStudent.deleteMany({ colegioId });
  await Course.deleteMany({ colegioId });
  await User.deleteMany({ colegioId, _id: { $ne: adminId } });
  await Group.deleteMany({ colegioId });
  await Asistencia.deleteMany({ colegioId });
  await Evento.deleteMany({ colegioId });
  console.log('[RESET] Datos del colegio eliminados.');
}

async function run() {
  console.log('[RESET+SEED] Conectando a MongoDB...');
  await connectDB();
  if (!mongoose?.connection?.readyState) {
    throw new Error('No se pudo conectar a MongoDB. Revisa MONGO_URI en .env');
  }

  const { colegioId, adminId } = await getAdminAndColegioId();
  await deleteColegioData(colegioId, adminId);

  const emailsUsados = new Set<string>([ADMIN_EMAIL.toLowerCase()]);

  // 1) Crear 5 materias y 5 profesores (nombre real, correo = nombre@gmail.com, clave 123456)
  const materiasYProfesorIds: { materiaId: Types.ObjectId; profesorId: Types.ObjectId; nombreMateria: string }[] = [];

  for (const { materia, profesorNombre } of MATERIAS_Y_PROFESORES) {
    let mat = await Materia.findOne({ nombre: materia }).lean();
    if (!mat) {
      const created = await Materia.create({
        nombre: materia,
        descripcion: materia,
        area: 'General',
      });
      mat = created.toObject();
    }
    const materiaId = (mat as any)._id;

    const emailProf = emailDesdeNombre(profesorNombre, emailsUsados);
    const newProf = new User({
      nombre: profesorNombre,
      correo: emailProf,
      email: emailProf,
      password: PASSWORD_PLAIN,
      rol: 'profesor',
      colegioId,
      estado: 'active',
      materias: [materia],
      configuraciones: {},
    });
    await newProf.save();
    materiasYProfesorIds.push({
      materiaId,
      profesorId: newProf._id as Types.ObjectId,
      nombreMateria: materia,
    });
    console.log(`[SEED] Materia "${materia}" y profesor ${profesorNombre} (${emailProf}, clave 123456)`);
  }

  // 2) Crear grupos
  const groups: { _id: Types.ObjectId; nombre: string }[] = [];
  for (const nombre of GROUP_NAMES) {
    const created = await Group.create({
      nombre,
      descripcion: `Grupo ${nombre}`,
      colegioId,
    });
    groups.push({ _id: created._id as Types.ObjectId, nombre: created.nombre });
  }
  console.log(`[SEED] ${groups.length} grupos creados.`);

  // 3) Por cada grupo: 10 estudiantes (nombres reales) + 2 padres por estudiante (nombres reales), clave 123456
  const allStudentIds: Types.ObjectId[] = [];
  let globalNameIndex = 0;

  for (let c = 0; c < groups.length; c++) {
    const group = groups[c];
    const grupoId = group._id;
    const nombreGrupo = group.nombre;

    for (let s = 0; s < STUDENTS_PER_COURSE; s++) {
      const num = String(s + 1).padStart(2, '0');
      const nombreEst = nombreReal(globalNameIndex++);
      const sufijoEst = `${nombreGrupo}${num}`;
      const emailEst = emailDesdeNombre(nombreEst, emailsUsados, sufijoEst);

      const newStudent = new User({
        nombre: nombreEst,
        correo: emailEst,
        email: emailEst,
        password: PASSWORD_PLAIN,
        rol: 'estudiante',
        colegioId,
        estado: 'vinculado',
        curso: nombreGrupo,
        configuraciones: {},
      });
      await newStudent.save();
      const estudianteId = newStudent._id as Types.ObjectId;
      allStudentIds.push(estudianteId);

      await GroupStudent.create({ grupoId, estudianteId, colegioId });

      for (let p = 0; p < PARENTS_PER_STUDENT; p++) {
        const nombrePadre = nombreReal(globalNameIndex++);
        const sufijoPadre = `${nombreGrupo}${num}.p${p + 1}`;
        const emailPadre = emailDesdeNombre(nombrePadre, emailsUsados, sufijoPadre);
        const newPadre = new User({
          nombre: nombrePadre,
          correo: emailPadre,
          email: emailPadre,
          password: PASSWORD_PLAIN,
          rol: 'padre',
          colegioId,
          estado: 'active',
          configuraciones: {},
        });
        await newPadre.save();
        await Vinculacion.create({
          padreId: newPadre._id,
          estudianteId,
          colegioId,
        });
      }
    }
  }
  console.log(`[SEED] ${allStudentIds.length} estudiantes y 2 padres por cada uno (nombre real, correo = nombre@gmail.com, clave 123456).`);

  // 4) Vincular cada curso (grupo) a cada materia: 10 grupos × 5 materias = 50 Course
  for (let gIdx = 0; gIdx < groups.length; gIdx++) {
    const group = groups[gIdx];
    const startIdx = gIdx * STUDENTS_PER_COURSE;
    const endIdx = startIdx + STUDENTS_PER_COURSE;
    const idsForGroup = allStudentIds.slice(startIdx, endIdx);

    for (const { materiaId, profesorId, nombreMateria } of materiasYProfesorIds) {
      const cursoNombre = `${nombreMateria} ${group.nombre}`;
      await Course.create({
        nombre: cursoNombre,
        materiaId,
        profesorId,
        profesorIds: [profesorId],
        estudiantes: idsForGroup,
        estudianteIds: idsForGroup,
        colegioId,
        descripcion: `Curso ${cursoNombre}`,
        cursos: [group.nombre],
      });
    }
  }
  console.log(`[SEED] 50 cursos creados (10 grupos × 5 materias), cada uno con su profesor y 10 estudiantes.`);

  console.log('[RESET+SEED] ✅ Listo. Todas las cuentas tienen clave 123456. 5 materias, 5 profesores, 10 grupos, 10 estudiantes por grupo, 2 papás por estudiante.');
  process.exit(0);
}

run().catch((err) => {
  console.error('[RESET+SEED] Error:', err.message);
  process.exit(1);
});
