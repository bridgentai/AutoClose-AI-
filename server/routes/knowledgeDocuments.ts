import { Router } from 'express';
import { protect, AuthRequest } from '../middleware/auth.js';
import { requireRole } from '../middleware/roleAuth.js';
import { ingestDocument } from '../services/embeddingService.js';
import {
  listDocumentsByInstitution,
  deleteDocumentById,
} from '../repositories/knowledgeDocumentRepository.js';

const router = Router();

/**
 * POST /api/knowledge-documents
 * Ingest a text document for RAG. Admin/directivo only.
 * Body: { title: string, content: string, metadata?: object }
 */
router.post('/', protect, requireRole('admin-general-colegio', 'directivo', 'directora-academica'), async (req: AuthRequest, res) => {
  try {
    const institutionId = req.user!.institution_id ?? req.user!.colegioId;
    const { title, content, metadata } = req.body;

    if (!title || typeof title !== 'string' || !title.trim()) {
      return res.status(400).json({ error: 'El campo "title" es obligatorio.' });
    }
    if (!content || typeof content !== 'string' || content.trim().length < 50) {
      return res.status(400).json({ error: 'El campo "content" debe tener al menos 50 caracteres.' });
    }

    const result = await ingestDocument({
      institutionId,
      title: title.trim(),
      content: content.trim(),
      createdById: req.user!.id,
      metadata: metadata && typeof metadata === 'object' ? metadata : undefined,
    });

    if (!result) {
      return res.status(500).json({ error: 'No se pudo procesar el documento. Verifica que OPENAI_API_KEY esté configurada.' });
    }

    res.json({
      success: true,
      docId: result.docId,
      chunksCreated: result.chunksCreated,
    });
  } catch (err) {
    console.error('[KnowledgeDocs] Error al ingestar documento:', (err as Error).message);
    res.status(500).json({ error: 'Error interno al procesar el documento.' });
  }
});

/**
 * GET /api/knowledge-documents
 * List documents for the institution.
 */
router.get('/', protect, requireRole('admin-general-colegio', 'directivo', 'directora-academica'), async (req: AuthRequest, res) => {
  try {
    const institutionId = req.user!.institution_id ?? req.user!.colegioId;
    const docs = await listDocumentsByInstitution(institutionId);
    res.json({ success: true, documents: docs });
  } catch (err) {
    console.error('[KnowledgeDocs] Error al listar:', (err as Error).message);
    res.status(500).json({ error: 'Error interno.' });
  }
});

/**
 * DELETE /api/knowledge-documents/:id
 * Delete a document and all its chunks.
 */
router.delete('/:id', protect, requireRole('admin-general-colegio', 'directivo'), async (req: AuthRequest, res) => {
  try {
    const institutionId = req.user!.institution_id ?? req.user!.colegioId;
    const deleted = await deleteDocumentById(req.params.id, institutionId);
    if (!deleted) {
      return res.status(404).json({ error: 'Documento no encontrado.' });
    }
    res.json({ success: true });
  } catch (err) {
    console.error('[KnowledgeDocs] Error al eliminar:', (err as Error).message);
    res.status(500).json({ error: 'Error interno.' });
  }
});

export default router;
