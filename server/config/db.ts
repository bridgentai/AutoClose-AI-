import mongoose from 'mongoose';

const MONGO_URI = process.env.MONGO_URI?.trim();

export let mongoConnected = false;
export let mongoError: string | null = null;

export async function connectDB() {
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

  try {
    await mongoose.connect(MONGO_URI);
    console.log('✅ MongoDB conectado exitosamente a AutoClose AI');
    mongoConnected = true;
    mongoError = null;
  } catch (error: any) {
    const errorMsg = `❌ Error conectando a MongoDB: ${error.message}`;
    console.error(errorMsg);
    mongoError = errorMsg;
    // No exit, permitir que la app arranque en modo degradado
  }
}

export { mongoose };
