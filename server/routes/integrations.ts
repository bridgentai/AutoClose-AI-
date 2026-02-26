import express from 'express';
import { protect, AuthRequest } from '../middleware/auth';

const router = express.Router();

/**
 * POST /api/integrations/google/create-doc
 * Crea un documento en Google Drive usando el token OAuth2 almacenado.
 * Seguro: manejado en servidor, sin exponer API key en frontend.
 * Stub: devuelve URL placeholder hasta que Google OAuth/Drive esté configurado.
 */
router.post('/google/create-doc', protect, async (req: AuthRequest, res) => {
  try {
    // TODO: Obtener token OAuth2 del usuario/colegio, llamar a Google Drive API para crear doc
    // const token = await getStoredGoogleToken(req.userId);
    // const drive = google.drive({ version: 'v3', auth: oauth2Client });
    // const file = await drive.files.create({ requestBody: { name: '...', mimeType: 'application/vnd.google-apps.document' }, ... });
    // return res.json({ url: `https://docs.google.com/document/d/${file.data.id}/edit`, documentId: file.data.id });

    const title = (req.body?.title as string) || 'Documento sin título';
    // Stub: devolver URL placeholder. En producción, crear doc real y devolver su link.
    const stubUrl = `https://docs.google.com/document/d/stub-${Date.now()}/edit?title=${encodeURIComponent(title)}`;
    return res.json({
      url: stubUrl,
      documentId: `stub-${Date.now()}`,
      message: 'Integración con Google Drive en configuración. Se usará documento real cuando OAuth esté activo.',
    });
  } catch (err: any) {
    console.error('Error create-doc:', err.message);
    return res.status(500).json({ message: err.message || 'Error al crear documento.' });
  }
});

export default router;
