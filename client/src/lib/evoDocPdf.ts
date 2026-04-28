/**
 * Abre el PDF de un Evo Doc (Kiwi) en una pestaña nueva, con el token de sesión.
 */
export async function openEvoDocPdfInNewTab(docId: string): Promise<void> {
  const token = localStorage.getItem('autoclose_token') ?? '';
  const res = await fetch(`/api/evo-docs/${encodeURIComponent(docId)}/pdf`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const j = (await res.json()) as { error?: string };
      if (j?.error) detail = j.error;
    } catch {
      /* ignore */
    }
    throw new Error(detail || 'No se pudo cargar el documento');
  }
  const blob = await res.blob();
  const u = URL.createObjectURL(blob);
  const w = window.open(u, '_blank', 'noopener,noreferrer');
  if (!w) {
    URL.revokeObjectURL(u);
    throw new Error('Permite ventanas emergentes para ver el PDF');
  }
  window.setTimeout(() => URL.revokeObjectURL(u), 120_000);
}
