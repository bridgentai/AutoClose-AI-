import crypto from 'crypto';
import { User } from '../models/User';
import { generateUserId } from '../utils/idGenerator';

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

/** Genera contraseña segura (solo para uso en creación; se hashea en pre-save). */
export function generateSecurePassword(): string {
  return crypto.randomBytes(16).toString('base64').replace(/[/+=]/g, '').slice(0, 16);
}

/** Valida una fila y comprueba si el email ya existe en el mismo colegio. */
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

  const existing = await User.findOne({
    $or: [{ correo: email }, { email }],
    colegioId,
  });
  if (existing) {
    return { valid: false, error: 'El email ya existe en este colegio' };
  }

  return { valid: true };
}

/** Genera código único de 4 dígitos (para codigoUnico en BD). */
async function generateCodigoUnico(): Promise<string> {
  let codigo: string;
  let intentos = 0;
  const maxIntentos = 500;
  do {
    codigo = Math.floor(1000 + Math.random() * 9000).toString();
    const existe = await User.findOne({ codigoUnico: codigo });
    if (!existe) return codigo;
    intentos++;
  } while (intentos < maxIntentos);
  return crypto.randomBytes(2).readUInt16BE(0).toString().padStart(4, '0').slice(-4);
}

/**
 * Crea usuarios en batch. No aborta todo si una fila falla; devuelve creados y fallidos.
 * colegioId siempre del admin autenticado.
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
    const codigoUnico = await generateCodigoUnico();
    const codigoInterno = row.codigo_interno != null ? String(row.codigo_interno).trim() : codigoUnico;
    const curso = row.curso_grupo != null ? String(row.curso_grupo).trim() : undefined;
    const esEstudiante = rol === 'estudiante';

    try {
      const newUser = new User({
        nombre,
        correo: email,
        email,
        password: passwordPlain,
        rol,
        colegioId,
        estado: esEstudiante ? 'pendiente_vinculacion' : 'active',
        curso,
        codigoUnico,
        codigoInterno: codigoInterno || undefined,
        configuraciones: {},
      });

      await newUser.save();

      try {
        const categorized = generateUserId(rol, newUser._id);
        newUser.userId = categorized.fullId;
        await newUser.save();
      } catch (_) {
        // userId opcional
      }

      created.push({
        email,
        passwordGenerated: passwordPlain,
        codigoInterno,
        colegioId,
        nombre,
        rol,
        rowIndex,
      });
    } catch (err: any) {
      const message = err?.message || err?.code === 11000 ? 'Email o código ya existe' : 'Error al crear usuario';
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
