import { Router } from 'express';
import { protect, AuthRequest } from '../middleware/auth.js';
import {
  findEvoDocsByUser,
  findEvoDocById,
} from '../repositories/evoDocsRepository.js';
import * as path from 'path';
import * as fs from 'fs';

const router = Router();

const STORAGE_ROOT = path.resolve(process.cwd(), 'server', 'storage', 'evo-docs');

router.get('/', protect, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const institutionId = req.user!.institution_id ?? req.user!.colegioId;
    const docs = await findEvoDocsByUser(userId, institutionId);
    res.json({ docs });
  } catch (err) {
    console.error('[EvoDocs] list error:', (err as Error).message);
    res.status(500).json({ error: 'Error al obtener documentos.' });
  }
});

router.get('/:id', protect, async (req: AuthRequest, res) => {
  try {
    const institutionId = req.user!.institution_id ?? req.user!.colegioId;
    const doc = await findEvoDocById(req.params.id, institutionId);
    if (!doc) return res.status(404).json({ error: 'Documento no encontrado.' });
    res.json({ doc });
  } catch (err) {
    console.error('[EvoDocs] get error:', (err as Error).message);
    res.status(500).json({ error: 'Error al obtener documento.' });
  }
});

router.get('/:id/pdf', protect, async (req: AuthRequest, res) => {
  try {
    const institutionId = req.user!.institution_id ?? req.user!.colegioId;
    const doc = await findEvoDocById(req.params.id, institutionId);
    if (!doc) return res.status(404).json({ error: 'Documento no encontrado.' });

    const filePath = path.join(STORAGE_ROOT, institutionId, `${doc.id}.pdf`);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Archivo PDF no encontrado.' });
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${doc.title.replace(/[^a-zA-Z0-9 ]/g, '')}.pdf"`);
    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  } catch (err) {
    console.error('[EvoDocs] pdf error:', (err as Error).message);
    res.status(500).json({ error: 'Error al servir el PDF.' });
  }
});

export default router;
