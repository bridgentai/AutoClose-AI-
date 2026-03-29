export type ComunicadoAttachment = {
  name: string;
  url?: string;
  fileId?: string;
  source?: string;
};

export function parseComunicadoAttachments(raw: unknown): ComunicadoAttachment[] {
  if (!Array.isArray(raw)) return [];
  const out: ComunicadoAttachment[] = [];
  for (const item of raw) {
    if (typeof item !== 'object' || item === null) continue;
    const o = item as Record<string, unknown>;
    const name = typeof o.name === 'string' ? o.name.trim() : '';
    if (!name) continue;
    const url = typeof o.url === 'string' && o.url.trim() ? o.url.trim() : undefined;
    const fileId = typeof o.fileId === 'string' && o.fileId.trim() ? o.fileId.trim() : undefined;
    const source = typeof o.source === 'string' && o.source.trim() ? o.source.trim() : undefined;
    out.push({ name, url, fileId, source });
  }
  return out;
}
