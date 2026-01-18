import mongoose from 'mongoose';
import { User } from '../models';
import { generateUserId } from '../utils/idGenerator';
import * as dotenv from 'dotenv';

// Cargar variables de entorno
dotenv.config();

/**
 * Script para migrar usuarios existentes y asignarles IDs categorizados
 * Ejecutar: npx ts-node server/scripts/migrateUserIds.ts
 */
async function migrateUserIds() {
  try {
    // Conectar a MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/autoclose-ai';
    await mongoose.connect(mongoUri);
    console.log('✅ Conectado a MongoDB');

    // Buscar usuarios sin userId categorizado
    const usersWithoutId = await User.find({
      $or: [
        { userId: { $exists: false } },
        { userId: null },
        { userId: '' }
      ]
    });

    console.log(`📊 Encontrados ${usersWithoutId.length} usuarios sin ID categorizado`);

    if (usersWithoutId.length === 0) {
      console.log('✅ Todos los usuarios ya tienen ID categorizado');
      await mongoose.disconnect();
      return;
    }

    let migrated = 0;
    let errors = 0;

    for (const user of usersWithoutId) {
      try {
        const categorizedId = generateUserId(user.rol, user._id);
        user.userId = categorizedId.fullId;
        await user.save();
        migrated++;
        console.log(`✅ Usuario ${user.nombre} (${user.rol}): ${categorizedId.fullId}`);
      } catch (error: any) {
        console.error(`❌ Error al migrar usuario ${user._id}:`, error.message);
        errors++;
      }
    }

    console.log('\n📈 Resumen de migración:');
    console.log(`   ✅ Migrados: ${migrated}`);
    console.log(`   ❌ Errores: ${errors}`);
    console.log(`   📊 Total procesados: ${usersWithoutId.length}`);

    await mongoose.disconnect();
    console.log('✅ Desconectado de MongoDB');
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Error en migración:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

// Ejecutar migración
migrateUserIds();

