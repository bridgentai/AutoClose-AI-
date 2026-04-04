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
    const title = (req.body?.title as string) || 'Documento sin título';
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

router.post('/google/create-sheet', protect, async (req: AuthRequest, res) => {
  try {
    const title = (req.body?.title as string) || 'Hoja sin título';
    const stubUrl = `https://docs.google.com/spreadsheets/d/stub-${Date.now()}/edit?title=${encodeURIComponent(title)}`;
    return res.json({
      url: stubUrl,
      spreadsheetId: `stub-${Date.now()}`,
      message: 'Stub de hoja de cálculo hasta OAuth activo.',
    });
  } catch (err: any) {
    console.error('Error create-sheet:', err.message);
    return res.status(500).json({ message: err.message || 'Error al crear hoja.' });
  }
});

router.post('/google/create-slide', protect, async (req: AuthRequest, res) => {
  try {
    const title = (req.body?.title as string) || 'Presentación sin título';
    const stubUrl = `https://docs.google.com/presentation/d/stub-${Date.now()}/edit?title=${encodeURIComponent(title)}`;
    return res.json({
      url: stubUrl,
      presentationId: `stub-${Date.now()}`,
      message: 'Stub de presentación hasta OAuth activo.',
    });
  } catch (err: any) {
    console.error('Error create-slide:', err.message);
    return res.status(500).json({ message: err.message || 'Error al crear presentación.' });
  }
});

export default router;
