import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import { connectDB } from '../config/db';
import { Assignment, User } from '../models';
import { IEntrega, ISubmission } from '../models/Assignment';

// Cargar variables de entorno
dotenv.config();

/**
 * Script de migración para convertir entregas (IEntrega) a submissions (ISubmission)
 * Este script migra los datos existentes sin perder información
 */
async function migrateEntregasToSubmissions() {
  try {
    await connectDB();
    console.log('Conectado a MongoDB');

    const assignments = await Assignment.find({ 
      $or: [
        { entregas: { $exists: true, $ne: [] } },
        { submissions: { $exists: false } }
      ]
    });

    console.log(`Encontradas ${assignments.length} tareas para migrar`);

    let migrated = 0;
    let skipped = 0;

    for (const assignment of assignments) {
      // Si ya tiene submissions, saltar
      if (assignment.submissions && assignment.submissions.length > 0) {
        skipped++;
        continue;
      }

      // Si no tiene entregas, inicializar submissions vacío
      if (!assignment.entregas || assignment.entregas.length === 0) {
        assignment.submissions = [];
        await assignment.save();
        skipped++;
        continue;
      }

      // Migrar entregas a submissions
      const submissions: ISubmission[] = [];

      for (const entrega of assignment.entregas as IEntrega[]) {
        // Obtener información del estudiante
        const estudiante = await User.findById(entrega.estudianteId);
        
        if (!estudiante) {
          console.warn(`Estudiante no encontrado para entrega: ${entrega.estudianteId}`);
          continue;
        }

        // Crear submission desde entrega
        const submission: ISubmission = {
          estudianteId: entrega.estudianteId,
          estudianteNombre: estudiante.nombre,
          archivos: entrega.archivoUrl ? [{
            tipo: 'link',
            nombre: 'Archivo entregado',
            url: entrega.archivoUrl,
          }] : [],
          comentario: undefined,
          fechaEntrega: entrega.fechaEntrega || new Date(),
          calificacion: entrega.nota,
          retroalimentacion: undefined,
        };

        submissions.push(submission);
      }

      // Actualizar assignment con submissions
      assignment.submissions = submissions;
      await assignment.save();
      migrated++;

      console.log(`Migrada tarea: ${assignment.titulo} (${submissions.length} submissions)`);
    }

    console.log(`\nMigración completada:`);
    console.log(`- Migradas: ${migrated}`);
    console.log(`- Omitidas: ${skipped}`);
    console.log(`- Total procesadas: ${assignments.length}`);

    await mongoose.disconnect();
    console.log('Desconectado de MongoDB');
    process.exit(0);
  } catch (error) {
    console.error('Error en migración:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

// Ejecutar migración
migrateEntregasToSubmissions();

