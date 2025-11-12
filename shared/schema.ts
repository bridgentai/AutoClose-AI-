// AutoClose AI - MongoDB Schemas with Mongoose
// Using TypeScript interfaces for type safety

export interface User {
  _id: string;
  nombre: string;
  email: string;
  password: string;
  rol: 'estudiante' | 'profesor' | 'directivo' | 'padre';
  curso?: string;
  colegioId: string;
  hijoId?: string; // Para padres - ID del estudiante hijo
  createdAt: Date;
}

export interface InsertUser {
  nombre: string;
  email: string;
  password: string;
  rol: 'estudiante' | 'profesor' | 'directivo' | 'padre';
  curso?: string;
  colegioId: string;
  hijoId?: string;
}

export interface Course {
  _id: string;
  colegioId: string;
  nombre: string;
  descripcion?: string;
  profesorId: string;
  cursos: string[]; // Array de cursos/grados (e.g., ["10A", "11B"])
  colorAcento?: string;
  icono?: string;
  createdAt: Date;
}

export interface InsertCourse {
  colegioId: string;
  nombre: string;
  descripcion?: string;
  profesorId: string;
  cursos?: string[];
  colorAcento?: string;
  icono?: string;
}

export interface Material {
  _id: string;
  colegioId: string;
  cursoId: string; // Referencia al curso
  titulo: string;
  descripcion?: string;
  tipo: 'pdf' | 'documento' | 'video' | 'enlace' | 'otro';
  url?: string;
  contenido?: string; // Texto del material para contexto de IA
  uploadedBy: string; // ID del profesor
  createdAt: Date;
}

export interface InsertMaterial {
  colegioId: string;
  cursoId: string;
  titulo: string;
  descripcion?: string;
  tipo: 'pdf' | 'documento' | 'video' | 'enlace' | 'otro';
  url?: string;
  contenido?: string;
  uploadedBy: string;
}

export interface ChatMessage {
  emisor: 'user' | 'ai';
  contenido: string;
  timestamp: Date;
}

export interface ChatSession {
  _id: string;
  colegioId: string;
  userId: string;
  titulo: string;
  contexto: {
    tipo: string; // 'estudiante_general', 'profesor_materia', etc.
    referenciaId?: string; // ID de curso o material si aplica
  };
  historial: ChatMessage[];
  createdAt: Date;
  updatedAt: Date;
}

export interface InsertChatSession {
  colegioId: string;
  userId: string;
  titulo: string;
  contexto: {
    tipo: string;
    referenciaId?: string;
  };
}

export interface InstitutionConfig {
  _id: string;
  colegioId: string;
  nombreIA: string; // Nombre personalizado del asistente
  logo?: string;
  colorPrimario: string;
  colorSecundario?: string;
  metodologia?: string; // Descripción de la metodología educativa
  curriculum?: string; // Información del currículo
  createdAt: Date;
  updatedAt: Date;
}

export interface InsertInstitutionConfig {
  colegioId: string;
  nombreIA: string;
  logo?: string;
  colorPrimario: string;
  colorSecundario?: string;
  metodologia?: string;
  curriculum?: string;
}

// Auth Response Types
export interface AuthResponse {
  id: string;
  nombre: string;
  email: string;
  rol: 'estudiante' | 'profesor' | 'directivo' | 'padre';
  curso?: string;
  materias?: string[];
  colegioId: string;
  token: string;
}

export interface ChatMessageResponse {
  message: string;
  aiResponse: string;
  sessionId: string;
}
