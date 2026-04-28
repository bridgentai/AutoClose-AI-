/**
 * Seed: 10 cursos (grupos), 25 estudiantes por curso, 2 papás vinculados a cada estudiante.
 * Ejecutar desde la raíz: npm run seed:bodytech
 * Requiere que exista el usuario adminbodytech@gmail.com (admin-general-colegio) para obtener colegioId.
 */
import 'dotenv/config';
import { connectDB, mongoose } from '../config/db';
import { User, Group, GroupStudent, Vinculacion, Course, Materia } from '../models';
import { Types } from 'mongoose';

const ADMIN_EMAIL = 'adminbodytech@gmail.com';
const PASSWORD_PLAIN = 'Bodytech2025!';
const NUM_COURSES = 10;
const STUDENTS_PER_COURSE = 25;
const PARENTS_PER_STUDENT = 2;

const GROUP_NAMES = ['BT7A', 'BT7B', 'BT7C', 'BT8A', 'BT8B', 'BT8C', 'BT9A', 'BT9B', 'BT9C', 'BT10A'];

async function getColegioId(): Promise<string> {
  const admin = await User.findOne({
    $or: [{ email: ADMIN_EMAIL }, { correo: ADMIN_EMAIL }],
  })
    .select('colegioId rol')
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
  console.log(`[SEED] ColegioId: ${colegioId}`);
  return colegioId;
}

async function ensureMateria() {
  let materia = await Materia.findOne({ nombre: 'Matemáticas' }).lean();
  if (!materia) {
    const created = await Materia.create({
      nombre: 'Matemáticas',
      descripcion: 'Matemáticas',
      area: 'General',
    });
    materia = created.toObject();
    console.log('[SEED] Materia "Matemáticas" creada');
  }
  return (materia as any)._id;
}

async function run() {
  console.log('[SEED] Conectando a MongoDB...');
  await connectDB();
  if (!mongoose?.connection?.readyState) {
    throw new Error('No se pudo conectar a MongoDB. Revisa MONGO_URI en .env');
  }

  const colegioId = await getColegioId();
  const materiaId = await ensureMateria();

  // 1) Crear grupos (cursos) si no existen
  const groups: { _id: Types.ObjectId; nombre: string }[] = [];
  for (const nombre of GROUP_NAMES) {
    const existing = await Group.findOne({ nombre, colegioId }).lean();
    let id: Types.ObjectId;
    let name: string;
    if (!existing) {
      const created = await Group.create({
        nombre,
        descripcion: `Grupo ${nombre}`,
        colegioId,
      });
      id = created._id;
      name = created.nombre;
      console.log(`[SEED] Grupo creado: ${nombre}`);
    } else {
      id = existing._id;
      name = existing.nombre;
    }
    groups.push({ _id: id, nombre: name });
  }
  console.log(`[SEED] Grupos listos: ${groups.length}`);

  const allStudentIds: Types.ObjectId[] = [];
  const studentToParents: Array<{ estudianteId: Types.ObjectId; padreIds: Types.ObjectId[] }> = [];

  for (let c = 0; c < groups.length; c++) {
    const group = groups[c];
    const grupoId = group._id;
    const nombreGrupo = group.nombre;

    for (let s = 0; s < STUDENTS_PER_COURSE; s++) {
      const num = String(s + 1).padStart(2, '0');
      const emailEst = `bodytech.est.${nombreGrupo}.${num}@bodytech.local`;
      let student = await User.findOne({ correo: emailEst, colegioId }).select('_id').lean();
      if (!student) {
        const newStudent = new User({
          nombre: `Estudiante ${nombreGrupo} ${s + 1}`,
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
        student = newStudent.toObject();
        console.log(`[SEED] Estudiante creado: ${emailEst}`);
      }
      const estudianteId = (student as any)._id;
      allStudentIds.push(estudianteId);

      const existingGS = await GroupStudent.findOne({
        grupoId,
        estudianteId,
        colegioId,
      });
      if (!existingGS) {
        await GroupStudent.create({
          grupoId,
          estudianteId,
          colegioId,
        });
      }

      const padreIds: Types.ObjectId[] = [];
      for (let p = 0; p < PARENTS_PER_STUDENT; p++) {
        const emailPadre = `bodytech.padre.${nombreGrupo}.${num}.${p + 1}@bodytech.local`;
        let padre = await User.findOne({ correo: emailPadre, colegioId }).select('_id').lean();
        if (!padre) {
          const newPadre = new User({
            nombre: `Padre ${nombreGrupo} ${num} ${p + 1}`,
            correo: emailPadre,
            email: emailPadre,
            password: PASSWORD_PLAIN,
            rol: 'padre',
            colegioId,
            estado: 'active',
            configuraciones: {},
          });
          await newPadre.save();
          padre = newPadre.toObject();
        }
        padreIds.push((padre as any)._id);

        const existingV = await Vinculacion.findOne({
          padreId: (padre as any)._id,
          estudianteId,
          colegioId,
        });
        if (!existingV) {
          await Vinculacion.create({
            padreId: (padre as any)._id,
            estudianteId,
            colegioId,
          });
        }
      }
      studentToParents.push({ estudianteId, padreIds });
    }
  }

  console.log(`[SEED] Estudiantes totales: ${allStudentIds.length}`);
  console.log(`[SEED] Vinculaciones (2 padres por estudiante): ${studentToParents.length * PARENTS_PER_STUDENT}`);

  // Crear Course (materia por grupo) para cada grupo
  for (let gIdx = 0; gIdx < groups.length; gIdx++) {
    const group = groups[gIdx];
    const cursoNombre = `Matemáticas ${group.nombre}`;
    const startIdx = gIdx * STUDENTS_PER_COURSE;
    const endIdx = startIdx + STUDENTS_PER_COURSE;
    const idsForCourse = allStudentIds.slice(startIdx, endIdx);

    const course = await Course.findOne({
      colegioId,
      nombre: cursoNombre,
      cursos: group.nombre,
    }).lean();
    if (!course) {
      await Course.create({
        nombre: cursoNombre,
        materiaId,
        estudiantes: idsForCourse,
        estudianteIds: idsForCourse,
        colegioId,
        descripcion: `Curso ${cursoNombre}`,
        cursos: [group.nombre],
      });
      console.log(`[SEED] Curso creado: ${cursoNombre}`);
    }
  }

  console.log('[SEED] ✅ Finalizado: 10 cursos, 25 estudiantes por curso, 2 papás vinculados por estudiante.');
  process.exit(0);
}

run().catch((err) => {
  console.error('[SEED] Error:', err.message);
  process.exit(1);
});
