import { google } from 'googleapis';
import { Readable } from 'stream';
import { queryPg } from '../config/db-pg.js';
import { createPersonalFile } from '../repositories/evoPersonalFileRepository.js';
import { getAuthedOAuth2ForUser } from './googleDriveUserOAuth.js';

const EVO_DOCS_FOLDER_NAME = 'Evo Docs';

async function findOrCreateEvoDocsFolder(
  drive: ReturnType<typeof google.drive>
): Promise<string> {
  const escaped = EVO_DOCS_FOLDER_NAME.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  const q = `mimeType = 'application/vnd.google-apps.folder' and name = '${escaped}' and trashed = false`;
  const list = await drive.files.list({
    q,
    fields: 'files(id)',
    pageSize: 5,
    spaces: 'drive',
  });
  const first = list.data.files?.[0];
  if (first?.id) return first.id;
  const create = await drive.files.create({
    requestBody: { name: EVO_DOCS_FOLDER_NAME, mimeType: 'application/vnd.google-apps.folder' },
    fields: 'id',
  });
  const id = create.data.id;
  if (!id) throw new Error('Could not create Evo Docs folder in Drive');
  return id;
}

function safePdfFileName(title: string): string {
  const base = title.replace(/[/\\?%*:|"<>]/g, ' ').trim() || 'documento';
  return `${base}.pdf`;
}

/**
 * Sube el PDF al Drive del usuario (carpeta "Evo Docs"), guarda referencia en metadata del evo_doc
 * y registra el archivo en Mi carpeta (evo_personal_files) para que aparezca en Evo Drive.
 * Si Google no está conectado o falla la API, solo registra log — no bloquea la generación local.
 */
export async function syncEvoDocPdfToUserDrive(params: {
  userId: string;
  institutionId: string;
  evoDocId: string;
  title: string;
  pdfBuffer: Buffer;
}): Promise<void> {
  const auth = await getAuthedOAuth2ForUser(params.userId);
  if (!auth) {
    console.warn('[EvoDocsDrive] Google Drive no conectado; PDF solo en servidor local.');
    return;
  }
  try {
    const drive = google.drive({ version: 'v3', auth });
    const folderId = await findOrCreateEvoDocsFolder(drive);
    const fileName = safePdfFileName(params.title);
    const createRes = await drive.files.create({
      requestBody: {
        name: fileName,
        parents: [folderId],
      },
      media: {
        mimeType: 'application/pdf',
        body: Readable.from(params.pdfBuffer),
      },
      fields: 'id, webViewLink',
    });
    const fileId = createRes.data.id;
    let webViewLink = createRes.data.webViewLink ?? '';
    if (!webViewLink && fileId) {
      const getRes = await drive.files.get({ fileId, fields: 'webViewLink' });
      webViewLink = getRes.data.webViewLink ?? '';
    }
    const patch = {
      google_drive: {
        file_id: fileId ?? null,
        web_view_link: webViewLink || null,
      },
    };
    await queryPg(
      `UPDATE evo_docs SET metadata = COALESCE(metadata, '{}'::jsonb) || $1::jsonb WHERE id = $2 AND institution_id = $3`,
      [JSON.stringify(patch), params.evoDocId, params.institutionId]
    );
    await createPersonalFile({
      user_id: params.userId,
      institution_id: params.institutionId,
      nombre: params.title,
      tipo: 'pdf',
      url: null,
      google_file_id: fileId ?? null,
      google_web_view_link: webViewLink || null,
      google_mime_type: 'application/pdf',
    });
  } catch (e) {
    console.error('[EvoDocsDrive] sync error:', e instanceof Error ? e.message : e);
  }
}
