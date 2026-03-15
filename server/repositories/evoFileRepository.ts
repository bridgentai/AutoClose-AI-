import { queryPg } from '../config/db-pg.js';

const ROLES_PROFESOR = ['profesor', 'directivo', 'administrador-general', 'admin-general-colegio', 'school_admin', 'super_admin'];

// Filtro estricto por materia: cada carpeta solo muestra archivos de esa materia (mismo group_subject_id).
function evoFilesSubjectCondition(groupSubjectId: string | undefined | null, paramPlaceholder: string): string {
  if (groupSubjectId == null) return '';
  return ` AND group_subject_id = ${paramPlaceholder}`;
}

export async function getEvoFiles(
  institutionId: string,
  groupId: string,
  userId: string,
  rol: string,
  groupSubjectId?: string | null
) {
  const params: (string | undefined)[] = [institutionId, groupId];
  if (rol === 'estudiante') params.push(userId);
  if (groupSubjectId != null) params.push(groupSubjectId);
  const n = params.length;
  const subSql = evoFilesSubjectCondition(groupSubjectId, `$${n}`);

  if (ROLES_PROFESOR.includes(rol)) {
    const r = await queryPg<Record<string, unknown>>(
      `SELECT * FROM evo_files WHERE institution_id = $1 AND group_id = $2${subSql} ORDER BY updated_at DESC`,
      params
    );
    return r.rows;
  }
  if (rol === 'estudiante') {
    const r = await queryPg<Record<string, unknown>>(
      `SELECT * FROM evo_files
       WHERE institution_id = $1 AND group_id = $2
         AND (es_publico = true OR (es_publico = false AND propietario_id = $3))${subSql}
       ORDER BY updated_at DESC`,
      params
    );
    return r.rows;
  }
  if (rol === 'padre') {
    const r = await queryPg<Record<string, unknown>>(
      `SELECT * FROM evo_files
       WHERE institution_id = $1 AND group_id = $2 AND es_publico = true${subSql}
       ORDER BY updated_at DESC`,
      params
    );
    return r.rows;
  }
  return [];
}

export async function getRecentFiles(institutionId: string) {
  const r = await queryPg<Record<string, unknown>>(
    `SELECT * FROM evo_files
     WHERE institution_id = $1 AND es_publico = true
     ORDER BY updated_at DESC LIMIT 8`,
    [institutionId]
  );
  return r.rows;
}

export async function createEvoFile(data: {
  institution_id: string;
  nombre: string;
  tipo: string;
  origen: string;
  mime_type?: string;
  group_id: string;
  curso_nombre: string;
  propietario_id: string;
  propietario_nombre: string;
  propietario_rol: string;
  es_publico: boolean;
  group_subject_id?: string | null;
  google_file_id?: string;
  google_web_view_link?: string;
  google_mime_type?: string;
  evo_storage_key?: string;
  evo_storage_url?: string;
  size_bytes?: number;
  etiquetas?: string[];
  category_id?: string | null;
}) {
  const paramsWithCategory = [
    data.institution_id, data.nombre, data.tipo, data.origen, data.mime_type ?? null,
    data.group_id, data.curso_nombre, data.propietario_id, data.propietario_nombre,
    data.propietario_rol, data.es_publico, data.group_subject_id ?? null,
    data.google_file_id ?? null,
    data.google_web_view_link ?? null, data.google_mime_type ?? null,
    data.evo_storage_key ?? null, data.evo_storage_url ?? null,
    data.size_bytes ?? null, data.etiquetas ?? [], data.category_id ?? null,
  ];
  try {
    const r = await queryPg<Record<string, unknown>>(
      `INSERT INTO evo_files
       (institution_id, nombre, tipo, origen, mime_type, group_id, curso_nombre,
        propietario_id, propietario_nombre, propietario_rol, es_publico, group_subject_id,
        google_file_id, google_web_view_link, google_mime_type,
        evo_storage_key, evo_storage_url, size_bytes, etiquetas, category_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
       RETURNING *`,
      paramsWithCategory
    );
    return r.rows[0];
  } catch (err: unknown) {
    const msg = String((err as Error).message ?? '');
    if (msg.includes('category_id')) {
      const paramsNoCategory = paramsWithCategory.slice(0, 19);
      const r = await queryPg<Record<string, unknown>>(
        `INSERT INTO evo_files
         (institution_id, nombre, tipo, origen, mime_type, group_id, curso_nombre,
          propietario_id, propietario_nombre, propietario_rol, es_publico, group_subject_id,
          google_file_id, google_web_view_link, google_mime_type,
          evo_storage_key, evo_storage_url, size_bytes, etiquetas)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
         RETURNING *`,
        paramsNoCategory
      );
      return r.rows[0];
    }
    if (msg.includes('group_subject_id')) {
      const paramsNoGs = [
        data.institution_id, data.nombre, data.tipo, data.origen, data.mime_type ?? null,
        data.group_id, data.curso_nombre, data.propietario_id, data.propietario_nombre,
        data.propietario_rol, data.es_publico,
        data.google_file_id ?? null,
        data.google_web_view_link ?? null, data.google_mime_type ?? null,
        data.evo_storage_key ?? null, data.evo_storage_url ?? null,
        data.size_bytes ?? null, data.etiquetas ?? [], data.category_id ?? null,
      ];
      const r = await queryPg<Record<string, unknown>>(
        `INSERT INTO evo_files
         (institution_id, nombre, tipo, origen, mime_type, group_id, curso_nombre,
          propietario_id, propietario_nombre, propietario_rol, es_publico,
          google_file_id, google_web_view_link, google_mime_type,
          evo_storage_key, evo_storage_url, size_bytes, etiquetas, category_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
         RETURNING *`,
        paramsNoGs
      );
      return r.rows[0];
    }
    throw err;
  }
}

export async function updateEvoFileCategory(
  fileId: string,
  institutionId: string,
  categoryId: string | null
): Promise<Record<string, unknown> | null> {
  try {
    const r = await queryPg<Record<string, unknown>>(
      `UPDATE evo_files SET category_id = $1, updated_at = now()
       WHERE id = $2 AND institution_id = $3 RETURNING *`,
      [categoryId, fileId, institutionId]
    );
    return r.rows[0] ?? null;
  } catch (err: unknown) {
    if (String((err as Error).message ?? '').includes('category_id')) return null;
    throw err;
  }
}

export async function deleteEvoFile(id: string, institutionId: string) {
  await queryPg(
    `DELETE FROM evo_files WHERE id = $1 AND institution_id = $2`,
    [id, institutionId]
  );
}

export async function toggleDestacado(id: string, institutionId: string) {
  const r = await queryPg<Record<string, unknown>>(
    `UPDATE evo_files SET destacado = NOT COALESCE(destacado, false), updated_at = now()
     WHERE id = $1 AND institution_id = $2 RETURNING *`,
    [id, institutionId]
  );
  return r.rows[0] ?? null;
}

export async function getEvoFileById(id: string, institutionId: string) {
  const r = await queryPg<Record<string, unknown>>(
    `SELECT * FROM evo_files WHERE id = $1 AND institution_id = $2`,
    [id, institutionId]
  );
  return r.rows[0] ?? null;
}
