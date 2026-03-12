import dotenv from 'dotenv';
import { resolve } from 'path';

// Usar process.cwd() para obtener la raíz del proyecto (donde se ejecuta npm run dev)
const envPath = resolve(process.cwd(), '.env');
const result = dotenv.config({ path: envPath });

if (result.error) {
  console.warn('⚠️  Advertencia: No se pudo cargar el archivo .env:', result.error.message);
} else {
  console.log('✅ Archivo .env cargado correctamente desde:', envPath);
}

export const ENV = {
  // MongoDB (legacy; no se usa en arranque — solo PostgreSQL/Neon)
  // MONGO_URI: process.env.MONGO_URI || '',
  // MONGODB_URI_DIRECT: process.env.MONGODB_URI_DIRECT || '',
  // MONGODB_USE_PUBLIC_DNS: process.env.MONGODB_USE_PUBLIC_DNS === 'true',
  JWT_SECRET: process.env.JWT_SECRET || '',
  DATABASE_URL: process.env.DATABASE_URL || '',
  /** Si es "true", el backend usa solo PostgreSQL y no conecta MongoDB. */
  USE_POSTGRES_ONLY: process.env.USE_POSTGRES_ONLY === 'true',
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: process.env.PORT || '3000',
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || '',
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET || '',
  GOOGLE_REDIRECT_URI: process.env.GOOGLE_REDIRECT_URI || '',
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:5173',
};

// Validar variables críticas al cargar
if (!ENV.JWT_SECRET) {
  console.error('❌ ADVERTENCIA: JWT_SECRET no está configurado en .env');
}


