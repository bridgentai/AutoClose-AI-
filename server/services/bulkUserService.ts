import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { generateUserId } from '../utils/idGenerator';
import { findUserByEmail, findUserByInternalCodeAny, createUser, updateUser } from '../repositories/userRepository.js';

/** Rol aceptado en la carga masiva (inglés o español) → rol interno */
const ROL_MAP: Record<string, 'estudiante' | 'profesor' | 'padre'> = {
  student: 'estudiante',
  estudiante: 'estudiante',
  teacher: 'profesor',
  profesor: 'profesor',
  parent: 'padre',
  padre: 'padre',
};

export interface BulkRowInput {
  nombre: string;
  apellido?: string;
  email: string;
  rol: string;
  codigo_interno?: string;
  curso_grupo?: string;
}

export interface BulkCreatedItem {
  email: string;
  passwordGenerated: string;
  codigoInterno: string;
  colegioId: string;
  nombre: string;
  rol: string;
  rowIndex: number;
}

export interface BulkFailedItem {
  rowIndex: number;
  email?: string;
  error: string;
}

export interface BulkResult {
  summary: { created: number; failed: number; total: number };
  created: BulkCreatedItem[];
  failed: BulkFailedItem[];
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeEmail(email: unknown): string {
  if (typeof email !== 'string') return '';
  return email.trim().toLowerCase();
}

function normalizeRol(rol: unknown): 'estudiante' | 'profesor' | 'padre' | null {
  if (typeof rol !== 'string') return null;
  const r = rol.trim().toLowerCase();
  return (ROL_MAP[r] ?? null) as 'estudiante' | 'profesor' | 'padre' | null;
}

/** Genera contraseña segura (solo para uso en creación; se hashea al guardar). */
export function generateSecurePassword(): string {
  return crypto.randomBytes(16).toString('base64').replace(/[/+=]/g, '').slice(0, 16);
}

/** Valida una fila y comprueba si el email ya existe (globalmente, para evitar duplicados). */
export async function validateBulkRow(
  row: BulkRowInput,
  rowIndex: number,
  colegioId: string
): Promise<{ valid: true } | { valid: false; error: string }> {
  const nombre = typeof row.nombre === 'string' ? row.nombre.trim() : '';
  const apellido = row.apellido != null ? String(row.apellido).trim() : '';
  const fullName = [nombre, apellido].filter(Boolean).join(' ').trim();
  const email = normalizeEmail(row.email);
  const rol = normalizeRol(row.rol);

  if (!fullName) {
    return { valid: false, error: 'Nombre y/o apellido requeridos' };
  }
  if (!email) {
    return { valid: false, error: 'Email requerido' };
  }
  if (!EMAIL_REGEX.test(email)) {
    return { valid: false, error: 'Email inválido' };
  }
  if (!rol) {
    return { valid: false, error: 'Rol debe ser student|teacher|parent (o equivalente en español)' };
  }

  const existing = await findUserByEmail(email);
  if (existing && existing.institution_id === colegioId) {
    return { valid: false, error: 'El email ya existe en este colegio' };
  }

  return { valid: true };
}

async function generateCodigoUnico(): Promise<string> {
  let codigo: string;
  let intentos = 0;
  const maxIntentos = 500;
  do {
    codigo = Math.floor(1000 + Math.random() * 9000).toString();
    const existe = await findUserByInternalCodeAny(codigo);
    if (!existe) return codigo;
    intentos++;
  } while (intentos < maxIntentos);
  return crypto.randomBytes(2).readUInt16BE(0).toString().padStart(4, '0').slice(-4);
}

/**
 * Crea usuarios en batch usando PostgreSQL.
 */
export async function createBulkUsers(
  rows: BulkRowInput[],
  colegioId: string
): Promise<BulkResult> {
  const created: BulkCreatedItem[] = [];
  const failed: BulkFailedItem[] = [];
  const MAX_ROWS = 2000;

  if (rows.length > MAX_ROWS) {
    return {
      summary: { created: 0, failed: rows.length, total: rows.length },
      created: [],
      failed: rows.map((_, i) => ({
        rowIndex: i + 1,
        error: `Máximo ${MAX_ROWS} filas por carga`,
      })),
    };
  }

  for (let i = 0; i < rows.length; i++) {
    const rowIndex = i + 1;
    const row = rows[i];
    const email = normalizeEmail(row?.email);

    const validation = await validateBulkRow(row, rowIndex, colegioId);
    if (!validation.valid) {
      failed.push({ rowIndex, email: email || undefined, error: validation.error });
      continue;
    }

    const nombre = [String(row.nombre).trim(), row.apellido != null ? String(row.apellido).trim() : '']
      .filter(Boolean)
      .join(' ');
    const rol = normalizeRol(row.rol)!;
    const passwordPlain = generateSecurePassword();
    const passwordHash = await bcrypt.hash(passwordPlain, 10);
    const codigoUnico = await generateCodigoUnico();
    const codigoInterno = row.codigo_interno != null ? String(row.codigo_interno).trim() : codigoUnico;
    const curso = row.curso_grupo != null ? String(row.curso_grupo).trim() : undefined;
    const esEstudiante = rol === 'estudiante';

    try {
      const config: Record<string, unknown> = { curso: curso ?? undefined };
      const newUser = await createUser({
        institution_id: colegioId,
        email,
        password_hash: passwordHash,
        full_name: nombre,
        role: rol,
        status: esEstudiante ? 'pendiente_vinculacion' : 'active',
        internal_code: codigoInterno || codigoUnico,
        config,
      });
      const categorized = generateUserId(rol, newUser.id);
      await updateUser(newUser.id, { config: { ...config, userId: categorized.fullId } });

      created.push({
        email,
        passwordGenerated: passwordPlain,
        codigoInterno: codigoInterno || codigoUnico,
        colegioId,
        nombre,
        rol,
        rowIndex,
      });
    } catch (err: unknown) {
      const message = (err as { message?: string; code?: string })?.code === '23505'
        ? 'Email o código ya existe'
        : (err as Error)?.message || 'Error al crear usuario';
      failed.push({ rowIndex, email, error: message });
    }
  }

  return {
    summary: {
      created: created.length,
      failed: failed.length,
      total: rows.length,
    },
    created,
    failed,
  };
}
