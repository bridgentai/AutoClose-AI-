import mongoose from 'mongoose';
// IMPORTANTE: Importar ENV asegura que .env se carga primero (env.ts carga dotenv)
import { ENV } from './env';

export let mongoConnected = false;
export let mongoError: string | null = null;

export async function connectDB(retries = 3) {
  const MONGO_URI = ENV.MONGO_URI?.trim();

  if (!MONGO_URI) {
    const error = '❌ Error: MONGO_URI no está configurado en las variables de entorno. Por favor configura MONGO_URI en el archivo .env de la raíz del proyecto con tu URL de MongoDB Atlas';
    console.error(error);
    mongoError = error;
    return; // No exit, permitir que la app arranque
  }

  // Validar formato básico
  if (!MONGO_URI.startsWith('mongodb://') && !MONGO_URI.startsWith('mongodb+srv://')) {
    const error = `❌ Error: MONGO_URI tiene formato inválido. Debe comenzar con mongodb:// o mongodb+srv://. Formato actual: ${MONGO_URI.substring(0, 30)}...`;
    console.error(error);
    mongoError = error;
    return; // No exit, permitir que la app arranque
  }

  // Verificar que no haya comillas o espacios extra
  const cleanURI = MONGO_URI.replace(/^["']|["']$/g, '').trim();
  if (cleanURI !== MONGO_URI) {
    console.warn('⚠️  Advertencia: MONGO_URI tenía comillas que fueron removidas');
  }

  try {
    console.log('🔄 Intentando conectar a MongoDB...');
    console.log(`📍 URI: ${MONGO_URI.substring(0, 50)}...`);
    
    // Verificar que la URI no tenga caracteres problemáticos
    if (MONGO_URI.includes(' ') || MONGO_URI.includes('\n') || MONGO_URI.includes('\r')) {
      throw new Error('MONGO_URI contiene caracteres inválidos (espacios, saltos de línea). Verifica el archivo .env');
    }

    // Configuración mejorada de conexión (solo opciones soportadas por el driver actual)
    const connectionOptions = {
      serverSelectionTimeoutMS: 30000, // Aumentado a 30 segundos
      socketTimeoutMS: 45000,
      connectTimeoutMS: 30000,
      maxPoolSize: 10,
      minPoolSize: 1,
      retryWrites: true,
      w: 'majority',
    };

    console.log('⚙️  Opciones de conexión:', {
      serverSelectionTimeoutMS: connectionOptions.serverSelectionTimeoutMS,
      socketTimeoutMS: connectionOptions.socketTimeoutMS,
      connectTimeoutMS: connectionOptions.connectTimeoutMS,
    });

    // Intentar conectar con retry
    let lastError: any = null;
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        if (attempt > 1) {
          console.log(`🔄 Intento ${attempt} de ${retries}...`);
          // Esperar antes de reintentar (backoff exponencial)
          await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
        }
        
        await mongoose.connect(cleanURI, connectionOptions);
        break; // Si conecta exitosamente, salir del loop
      } catch (attemptError: any) {
        lastError = attemptError;
        if (attempt < retries) {
          console.warn(`⚠️  Intento ${attempt} falló: ${attemptError.message}`);
          // Cerrar cualquier conexión parcial antes de reintentar
          if (mongoose.connection.readyState !== 0) {
            await mongoose.connection.close().catch(() => {});
          }
        }
      }
    }

    // Si después de todos los intentos aún falla, lanzar el último error
    if (!mongoose.connection.readyState || mongoose.connection.readyState === 0) {
      throw lastError || new Error('No se pudo conectar después de múltiples intentos');
    }
    
    console.log('✅ MongoDB conectado exitosamente a AutoClose AI');
    console.log(`📊 Base de datos: ${mongoose.connection.db?.databaseName || 'autoclose_ai'}`);
    console.log(`🔗 Host: ${mongoose.connection.host || 'N/A'}`);
    console.log(`🔌 Puerto: ${mongoose.connection.port || 'N/A'}`);
    console.log(`📡 Estado: ${mongoose.connection.readyState === 1 ? 'Conectado' : 'Desconectado'}`);
    
    mongoConnected = true;
    mongoError = null;

    // Manejar eventos de conexión
    mongoose.connection.on('error', (err) => {
      console.error('❌ Error de MongoDB:', err);
      mongoConnected = false;
      mongoError = err.message;
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('⚠️  MongoDB desconectado');
      mongoConnected = false;
      mongoError = 'MongoDB desconectado';
    });

    mongoose.connection.on('reconnected', () => {
      console.log('✅ MongoDB reconectado');
      mongoConnected = true;
      mongoError = null;
    });

    mongoose.connection.on('connecting', () => {
      console.log('🔄 Conectando a MongoDB...');
    });

    mongoose.connection.on('connected', () => {
      console.log('✅ Evento: MongoDB conectado');
    });

  } catch (error: any) {
    const errorMsg = `❌ Error conectando a MongoDB: ${error.message}`;
    console.error(errorMsg);
    console.error('📋 Tipo de error:', error.constructor.name);
    console.error('📋 Código de error:', error.code || 'N/A');
    console.error('📋 Stack completo:', error.stack);
    
    // Información adicional para debugging
    if (error.reason) {
      console.error('📋 Razón del error:', error.reason);
    }
    if (error.cause) {
      console.error('📋 Causa del error:', error.cause);
    }

    // Sugerencias específicas según el tipo de error
    if (error.message.includes('authentication failed')) {
      console.error('💡 SUGERENCIA: Verifica las credenciales (usuario y contraseña) en MONGO_URI');
    } else if (error.message.includes('whitelist')) {
      console.error('💡 SUGERENCIA: Verifica que tu IP esté en la whitelist de MongoDB Atlas');
    } else if (error.message.includes('ENOTFOUND') || error.message.includes('getaddrinfo')) {
      console.error('💡 SUGERENCIA: Verifica que el nombre del cluster sea correcto en MONGO_URI');
    } else if (error.message.includes('ReplicaSetNoPrimary')) {
      console.error('💡 SUGERENCIA: El cluster puede estar pausado o tener problemas. Verifica el estado en MongoDB Atlas');
      console.error('💡 Verifica: https://cloud.mongodb.com/');
    }
    
    mongoError = errorMsg;
    // No exit, permitir que la app arranque en modo degradado
  }
}

export { mongoose };
