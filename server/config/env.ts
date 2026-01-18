import dotenv from 'dotenv';
import { resolve } from 'path';

// Usar process.cwd() para obtener la raíz del proyecto (donde se ejecuta npm run dev)
const envPath = resolve(process.cwd(), '.env');
dotenv.config({ path: envPath });

export const ENV = {
  MONGO_URI: process.env.MONGO_URI!,
  JWT_SECRET: process.env.JWT_SECRET!,
  DATABASE_URL: process.env.DATABASE_URL!,
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: process.env.PORT || '3000',
  OPENAI_API_KEY: process.env.OPENAI_API_KEY!, // aquí debe estar
};


