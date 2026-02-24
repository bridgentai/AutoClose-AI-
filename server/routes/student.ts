import express from 'express';
import { protect, AuthRequest } from '../middleware/auth';
import { Course } from '../models/Course';
import { User } from '../models/User';
import { Nota, Assignment, Materia } from '../models';
import { normalizeIdForQuery } from '../utils/idGenerator';

const router = express.Router();

// =========================================================================
// GET /api/student/subjects
// Obtener todas las materias asignadas al grupo del estudiante
// =========================================================================
router.get('/subjects', protect, async (req: AuthRequest, res) => {
  try {
    const estudianteId = req.user?.id;
    const colegioId = req.user?.colegioId || 'COLEGIO_DEMO_2025';

    if (!estudianteId) {
      return res.status(401).json({ message: 'No autorizado.' });
    }

    // Normalizar estudianteId
    const normalizedEstudianteId = normalizeIdForQuery(estudianteId);

    // Obtener el grupo del estudiante desde su perfil
    const estudiante = await User.findById(normalizedEstudianteId).select('curso rol');
    
    if (!estudiante) {
      return res.status(404).json({ message: 'Estudiante no encontrado.' });
    }

    if (estudiante.rol !== 'estudiante') {
      return res.status(403).json({ message: 'Solo estudiantes pueden acceder a este recurso.' });
    }

    const grupoId = estudiante.curso;
    
    if (!grupoId) {
      return res.json({ 
        subjects: [],
        message: 'El estudiante no tiene grupo asignado.',
        grupoId: null
      });
    }

    // Normalizar grupoId para búsqueda consistente (mayúsculas)
    const grupoIdNormalizado = (grupoId as string).toUpperCase().trim();

    console.log(`[DEBUG /api/student/subjects] Buscando materias para estudiante:`);
    console.log(`  - Estudiante ID: ${estudianteId}`);
    console.log(`  - Grupo del estudiante: ${grupoId} (normalizado: ${grupoIdNormalizado})`);
    console.log(`  - ColegioId: ${colegioId}`);

    // Buscar todas las materias (cursos) que tienen este grupo en su array de grupos
    // MongoDB busca directamente en arrays: { cursos: valor } busca si valor está en el array
    // Usamos $or para buscar variantes normalizadas
    const courses = await Course.find({ 
      $or: [
        { cursos: grupoIdNormalizado },
        { cursos: grupoIdNormalizado.toLowerCase() },
        { cursos: grupoId as string }
      ],
      colegioId: colegioId
    })
    .populate('profesorIds', 'nombre apellido email') // Incluir info del profesor
    .select('nombre descripcion profesorIds colorAcento icono cursos')
    .lean();

    console.log(`[DEBUG /api/student/subjects] Encontradas ${courses.length} materias`);
    courses.forEach(course => {
      console.log(`  - ${course.nombre}: cursos=${JSON.stringify(course.cursos)}`);
    });

    // Formatear la respuesta
    const formattedSubjects = courses.map(course => ({
      _id: course._id,
      nombre: course.nombre,
      descripcion: course.descripcion,
      profesores: course.profesorIds?.map((prof: any) => ({
        _id: prof._id,
        nombre: prof.nombre,
        email: prof.email,
      })) || [],
      colorAcento: course.colorAcento,
      icono: course.icono,
    }));

    res.json({ 
      subjects: formattedSubjects,
      total: formattedSubjects.length,
      grupoId: grupoId
    });

  } catch (error) {
    console.error('Error al obtener materias del estudiante:', error);
    res.status(500).json({ message: 'Error interno del servidor.' });
  }
});

// =========================================================================
// GET /api/student/profile
// Obtener información del perfil del estudiante incluyendo su grupo
// =========================================================================
router.get('/profile', protect, async (req: AuthRequest, res) => {
  try {
    const estudianteId = req.user?.id;

    if (!estudianteId) {
      return res.status(401).json({ message: 'No autorizado.' });
    }

    // Normalizar estudianteId
    const normalizedEstudianteId = normalizeIdForQuery(estudianteId);
    const estudiante = await User.findById(normalizedEstudianteId)
      .select('nombre email curso rol colegioId telefono celular direccion barrio ciudad fechaNacimiento');
    
    if (!estudiante) {
      return res.status(404).json({ message: 'Estudiante no encontrado.' });
    }

    res.json({
      _id: estudiante._id,
      nombre: estudiante.nombre,
      email: estudiante.email,
      grupoId: estudiante.curso,
      rol: estudiante.rol,
      colegioId: estudiante.colegioId,
      telefono: estudiante.telefono,
      celular: estudiante.celular,
      direccion: estudiante.direccion,
      barrio: estudiante.barrio,
      ciudad: estudiante.ciudad,
      fechaNacimiento: estudiante.fechaNacimiento,
    });

  } catch (error) {
    console.error('Error al obtener perfil del estudiante:', error);
    res.status(500).json({ message: 'Error interno del servidor.' });
  }
});

// =========================================================================
// PUT /api/student/profile
// Actualizar información personal del estudiante
// =========================================================================
router.put('/profile', protect, async (req: AuthRequest, res) => {
  try {
    const estudianteId = req.user?.id;

    if (!estudianteId) {
      return res.status(401).json({ message: 'No autorizado.' });
    }

    // Normalizar estudianteId
    const normalizedEstudianteId = normalizeIdForQuery(estudianteId);

    const { telefono, celular, direccion, barrio, ciudad, fechaNacimiento } = req.body;

    const estudiante = await User.findById(normalizedEstudianteId);
    
    if (!estudiante) {
      return res.status(404).json({ message: 'Estudiante no encontrado.' });
    }

    // Actualizar solo los campos proporcionados
    if (telefono !== undefined) estudiante.telefono = telefono;
    if (celular !== undefined) estudiante.celular = celular;
    if (direccion !== undefined) estudiante.direccion = direccion;
    if (barrio !== undefined) estudiante.barrio = barrio;
    if (ciudad !== undefined) estudiante.ciudad = ciudad;
    if (fechaNacimiento !== undefined) estudiante.fechaNacimiento = fechaNacimiento ? new Date(fechaNacimiento) : undefined;

    await estudiante.save();

    res.json({
      message: 'Información personal actualizada correctamente.',
      estudiante: {
        _id: estudiante._id,
        nombre: estudiante.nombre,
        email: estudiante.email,
        telefono: estudiante.telefono,
        celular: estudiante.celular,
        direccion: estudiante.direccion,
        barrio: estudiante.barrio,
        ciudad: estudiante.ciudad,
        fechaNacimiento: estudiante.fechaNacimiento,
      }
    });

  } catch (error) {
    console.error('Error al actualizar información personal:', error);
    res.status(500).json({ message: 'Error interno del servidor.' });
  }
});

// =========================================================================
// GET /api/student/:estudianteId/personal-info
// Obtener información personal de un estudiante (para profesores)
// Optimizado: combina verificación de rol y obtención de datos en una consulta
// =========================================================================
router.get('/:estudianteId/personal-info', protect, async (req: AuthRequest, res) => {
  try {
    const { estudianteId } = req.params;
    const profesorId = req.user?.id;
    const colegioId = req.user?.colegioId;

    if (!profesorId || !colegioId) {
      return res.status(401).json({ message: 'No autorizado.' });
    }

    // Normalizar IDs
    const normalizedProfesorId = normalizeIdForQuery(profesorId || '');
    const normalizedEstudianteId = normalizeIdForQuery(estudianteId);

    // Verificar que el usuario que hace la petición sea profesor o directivo y obtener estudiante en paralelo
    const [usuario, estudiante] = await Promise.all([
      User.findById(normalizedProfesorId).select('rol').lean(),
      User.findById(normalizedEstudianteId)
        .select('nombre email curso rol colegioId telefono celular direccion barrio ciudad fechaNacimiento')
        .lean()
    ]);

    if (!usuario || (usuario.rol !== 'profesor' && usuario.rol !== 'directivo')) {
      return res.status(403).json({ message: 'Solo profesores y directivos pueden acceder a esta información.' });
    }
    
    if (!estudiante) {
      return res.status(404).json({ message: 'Estudiante no encontrado.' });
    }

    // Verificar que el estudiante pertenezca al mismo colegio
    if (estudiante.colegioId !== colegioId) {
      return res.status(403).json({ message: 'No tienes permiso para acceder a esta información.' });
    }

    res.json({
      _id: estudiante._id,
      nombre: estudiante.nombre,
      email: estudiante.email,
      curso: estudiante.curso,
      colegioId: estudiante.colegioId,
      telefono: estudiante.telefono || null,
      celular: estudiante.celular || null,
      direccion: estudiante.direccion || null,
      barrio: estudiante.barrio || null,
      ciudad: estudiante.ciudad || null,
      fechaNacimiento: estudiante.fechaNacimiento || null,
    });

  } catch (error) {
    console.error('Error al obtener información personal del estudiante:', error);
    res.status(500).json({ message: 'Error interno del servidor.' });
  }
});

// =========================================================================
// GET /api/student/hijo/:estudianteId/profile - Perfil del hijo (padre/directivo, solo lectura)
// =========================================================================
router.get('/hijo/:estudianteId/profile', protect, async (req: AuthRequest, res) => {
  try {
    const { estudianteId: paramId } = req.params;
    const userId = req.user?.id;
    const rol = req.user?.rol;
    const normalizedEstudianteId = normalizeIdForQuery(paramId);
    const normalizedUserId = normalizeIdForQuery(userId || '');

    const estudiante = await User.findById(normalizedEstudianteId)
      .select('nombre email curso rol colegioId telefono celular direccion barrio ciudad fechaNacimiento userId codigoUnico')
      .lean();
    if (!estudiante || estudiante.rol !== 'estudiante') {
      return res.status(404).json({ message: 'Estudiante no encontrado.' });
    }

    let allowed = rol === 'directivo' || rol === 'admin-general-colegio';
    if (!allowed && rol === 'padre') {
      const { Vinculacion } = await import('../models');
      const v = await Vinculacion.findOne({
        padreId: normalizedUserId,
        estudianteId: normalizedEstudianteId,
      }).lean();
      allowed = !!v;
    }
    if (!allowed) {
      return res.status(403).json({ message: 'No autorizado a ver el perfil de este estudiante.' });
    }

    res.json({
      _id: estudiante._id,
      nombre: estudiante.nombre,
      email: estudiante.email,
      grupoId: estudiante.curso,
      curso: estudiante.curso,
      rol: estudiante.rol,
      colegioId: estudiante.colegioId,
      telefono: estudiante.telefono,
      celular: estudiante.celular,
      direccion: estudiante.direccion,
      barrio: estudiante.barrio,
      ciudad: estudiante.ciudad,
      fechaNacimiento: estudiante.fechaNacimiento,
      userId: estudiante.userId,
      codigoUnico: estudiante.codigoUnico,
    });
  } catch (error) {
    console.error('Error al obtener perfil del hijo:', error);
    res.status(500).json({ message: 'Error interno del servidor.' });
  }
});

// =========================================================================
// GET /api/student/hijo/:estudianteId/notes - Notas de un hijo (padre o directivo)
// =========================================================================
router.get('/hijo/:estudianteId/notes', protect, async (req: AuthRequest, res) => {
  try {
    const { estudianteId: paramId } = req.params;
    const userId = req.user?.id;
    const rol = req.user?.rol;
    const normalizedEstudianteId = normalizeIdForQuery(paramId);
    const normalizedUserId = normalizeIdForQuery(userId || '');

    const estudiante = await User.findById(normalizedEstudianteId).select('rol colegioId').lean();
    if (!estudiante || estudiante.rol !== 'estudiante') {
      return res.status(404).json({ message: 'Estudiante no encontrado.' });
    }

    let allowed = rol === 'directivo' || rol === 'admin-general-colegio';
    if (!allowed && rol === 'padre') {
      const { Vinculacion } = await import('../models');
      const v = await Vinculacion.findOne({
        padreId: normalizedUserId,
        estudianteId: normalizedEstudianteId,
      }).lean();
      allowed = !!v;
    }
    if (!allowed) {
      return res.status(403).json({ message: 'No autorizado a ver las notas de este estudiante.' });
    }

    const notas = await Nota.find({ estudianteId: normalizedEstudianteId })
      .populate('tareaId', 'titulo descripcion curso cursoId courseId materiaId fechaEntrega submissions')
      .populate('profesorId', 'nombre')
      .sort({ fecha: -1 })
      .lean();

    const notasPorMateria: Record<string, any> = {};
    for (const nota of notas) {
      const tarea = nota.tareaId as any;
      if (!tarea) continue;
      const courseIdRef = tarea.cursoId || tarea.courseId || tarea.materiaId;
      if (!courseIdRef) continue;
      const materiaIdStr = courseIdRef.toString();
      if (!notasPorMateria[materiaIdStr]) {
        const idParaCourse = tarea.cursoId || tarea.courseId;
        const courseDoc = idParaCourse
          ? await Course.findById(idParaCourse).select('nombre colorAcento icono').lean()
          : null;
        const materiaDoc = !(courseDoc as any)?.nombre && tarea.materiaId
          ? await Materia.findById(tarea.materiaId).select('nombre').lean()
          : null;
        const nombre = (courseDoc as any)?.nombre || (materiaDoc as any)?.nombre || 'Materia';
        notasPorMateria[materiaIdStr] = {
          _id: materiaIdStr,
          nombre,
          colorAcento: (courseDoc as any)?.colorAcento || '#9f25b8',
          notas: [],
          promedio: 0,
        };
      }
      const sub = tarea.submissions?.find((s: any) => s.estudianteId?.toString() === normalizedEstudianteId);
      notasPorMateria[materiaIdStr].notas.push({
        _id: nota._id,
        tareaTitulo: tarea.titulo,
        nota: nota.nota,
        logro: nota.logro,
        fecha: nota.fecha,
        profesorNombre: (nota.profesorId as any)?.nombre,
        comentario: sub?.retroalimentacion || nota.logro,
      });
    }
    const materias = Object.values(notasPorMateria).map((materia: any) => {
      const promedio = materia.notas.length ? materia.notas.reduce((s: number, n: any) => s + n.nota, 0) / materia.notas.length : 0;
      return {
        ...materia,
        promedio,
        ultimaNota: materia.notas[0] ? materia.notas[0].nota : 0,
        estado: promedio >= 90 ? 'excelente' : promedio >= 70 ? 'bueno' : promedio >= 50 ? 'regular' : 'bajo',
        tendencia: 'stable',
        profesorNombre: materia.notas.length > 0 ? (materia.notas[0].profesorNombre || null) : null,
      };
    });
    return res.json({ materias, total: materias.length });
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ message: 'Error al obtener notas.' });
  }
});

// =========================================================================
// GET /api/student/notes
// Obtener todas las notas del estudiante autenticado
// =========================================================================
router.get('/notes', protect, async (req: AuthRequest, res) => {
  try {
    const estudianteId = req.user?.id;

    if (!estudianteId) {
      return res.status(401).json({ message: 'No autorizado.' });
    }

    // Normalizar estudianteId
    const normalizedEstudianteId = normalizeIdForQuery(estudianteId);

    // Verificar que el usuario es estudiante
    const estudiante = await User.findById(normalizedEstudianteId).select('rol colegioId').lean();
    
    if (!estudiante) {
      return res.status(404).json({ message: 'Estudiante no encontrado.' });
    }

    if (estudiante.rol !== 'estudiante') {
      return res.status(403).json({ message: 'Solo estudiantes pueden acceder a este recurso.' });
    }

    // Obtener todas las notas del estudiante con información de la tarea
    let notas = await Nota.find({
      estudianteId: normalizedEstudianteId,
    })
    .populate('tareaId', 'titulo descripcion curso cursoId courseId materiaId fechaEntrega submissions')
    .populate('profesorId', 'nombre')
    .sort({ fecha: -1 })
    .lean();

    // Fallback: si no hay documentos en Nota, derivar desde Assignment.submissions calificadas
    const notasPorMateria: Record<string, any> = {};
    const colegioId = (estudiante as any).colegioId;
    if (notas.length === 0) {
      const assignmentQuery: Record<string, unknown> = {
        'submissions.estudianteId': normalizedEstudianteId,
        'submissions.calificacion': { $exists: true, $ne: null },
      };
      if (colegioId) assignmentQuery.colegioId = colegioId;
      const assignments = await Assignment.find(assignmentQuery)
        .select('titulo curso cursoId courseId materiaId profesorId submissions')
        .populate('profesorId', 'nombre')
        .sort({ fechaEntrega: -1 })
        .lean();
      for (const tarea of assignments as any[]) {
        const sub = tarea.submissions?.find((s: any) => s.estudianteId?.toString() === normalizedEstudianteId);
        if (!sub || sub.calificacion == null) continue;
        const courseIdRef = tarea.cursoId || tarea.courseId || tarea.materiaId;
        if (!courseIdRef) continue;
        const materiaIdStr = courseIdRef.toString();
        if (!notasPorMateria[materiaIdStr]) {
          const idParaCourse = tarea.cursoId || tarea.courseId;
          const courseDoc = idParaCourse
            ? await Course.findById(idParaCourse).select('nombre colorAcento icono').lean()
            : null;
          const materiaDoc = !(courseDoc as any)?.nombre && tarea.materiaId
            ? await Materia.findById(tarea.materiaId).select('nombre').lean()
            : null;
          const nombre = (courseDoc as any)?.nombre || (materiaDoc as any)?.nombre || 'Materia';
          notasPorMateria[materiaIdStr] = {
            _id: materiaIdStr,
            nombre,
            colorAcento: (courseDoc as any)?.colorAcento || '#9f25b8',
            icono: (courseDoc as any)?.icono,
            notas: [],
            promedio: 0,
          };
        }
        notasPorMateria[materiaIdStr].notas.push({
          _id: tarea._id.toString() + '-' + normalizedEstudianteId,
          tareaId: tarea._id,
          tareaTitulo: tarea.titulo,
          nota: sub.calificacion,
          logro: sub.logro,
          fecha: sub.fechaEntrega || new Date(),
          profesorNombre: tarea.profesorId?.nombre || 'Profesor',
          comentario: sub.retroalimentacion || sub.logro || null,
        });
      }
    } else {
      for (const nota of notas) {
        const tarea = nota.tareaId as any;
        if (!tarea) continue;

        const courseIdRef = tarea.cursoId || tarea.courseId || tarea.materiaId;
        if (!courseIdRef) continue;

        const materiaIdStr = courseIdRef.toString();

        if (!notasPorMateria[materiaIdStr]) {
          const idParaCourse = tarea.cursoId || tarea.courseId;
          const courseDoc = idParaCourse
            ? await Course.findById(idParaCourse).select('nombre colorAcento icono').lean()
            : null;
          const materiaDoc = !(courseDoc as any)?.nombre && tarea.materiaId
            ? await Materia.findById(tarea.materiaId).select('nombre').lean()
            : null;
          const nombre = (courseDoc as any)?.nombre || (materiaDoc as any)?.nombre || 'Materia';
          notasPorMateria[materiaIdStr] = {
            _id: materiaIdStr,
            nombre,
            colorAcento: (courseDoc as any)?.colorAcento || '#9f25b8',
            icono: (courseDoc as any)?.icono,
            notas: [],
            promedio: 0,
          };
        }

        let retroalimentacion = null;
        if (tarea.submissions && Array.isArray(tarea.submissions)) {
          const submission = tarea.submissions.find((s: any) =>
            s.estudianteId?.toString() === normalizedEstudianteId
          );
          if (submission?.retroalimentacion) retroalimentacion = submission.retroalimentacion;
        }

        notasPorMateria[materiaIdStr].notas.push({
          _id: nota._id,
          tareaId: tarea._id,
          tareaTitulo: tarea.titulo,
          nota: nota.nota,
          logro: nota.logro,
          fecha: nota.fecha,
          profesorNombre: (nota.profesorId as any)?.nombre || 'Profesor',
          comentario: retroalimentacion || nota.logro || null,
        });
      }
    }

    // Calcular promedios por materia (escala 0-100) y añadir profesor
    const materias = Object.values(notasPorMateria).map((materia: any) => {
      const promedio = materia.notas.length > 0
        ? materia.notas.reduce((sum: number, n: any) => sum + n.nota, 0) / materia.notas.length
        : 0;

      return {
        ...materia,
        promedio,
        ultimaNota: materia.notas.length > 0 ? materia.notas[0].nota : 0,
        estado: promedio >= 90 ? 'excelente' : promedio >= 70 ? 'bueno' : promedio >= 50 ? 'regular' : 'bajo',
        tendencia: 'stable',
        profesorNombre: materia.notas.length > 0 ? (materia.notas[0].profesorNombre || null) : null,
      };
    });

    res.json({
      materias,
      total: materias.length,
    });

  } catch (error) {
    console.error('Error al obtener notas del estudiante:', error);
    res.status(500).json({ message: 'Error interno del servidor.' });
  }
});

export default router;
