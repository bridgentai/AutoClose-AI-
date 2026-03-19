import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { protect, type AuthRequest } from '../middleware/auth.js';
import { queryPg } from '../config/db-pg.js';
import { findUserById } from '../repositories/userRepository.js';
import { findAssignmentById } from '../repositories/assignmentRepository.js';
import { findGroupSubjectById } from '../repositories/groupSubjectRepository.js';

const router = Router();

const uploadDir = path.join(process.cwd(), 'uploads', 'scans');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `scan-${unique}${path.extname(file.originalname)}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    cb(null, allowed.includes(file.mimetype));
  },
});

type ScanAttachment = {
  type: 'scan';
  url: string;
  file_name: string;
  mime_type: string;
  uploaded_at: string;
};

async function appendSubmissionAttachment(submissionId: string, attachment: ScanAttachment) {
  await queryPg(
    `UPDATE submissions
     SET attachments = COALESCE(attachments, '[]'::jsonb) || $1::jsonb,
         updated_at = NOW()
     WHERE id = $2`,
    [JSON.stringify([attachment]), submissionId]
  );
}

// POST /api/uploads/scan
// multipart/form-data: scan (file) + (submissionId | assignmentId+studentId)
router.post('/scan', protect, upload.single('scan'), async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id ?? req.userId;
    const colegioId = req.user?.colegioId;
    if (!userId || !colegioId) return res.status(401).json({ error: 'No autorizado.' });

    const user = await findUserById(userId);
    if (!user || user.role !== 'profesor') {
      return res.status(403).json({ error: 'Solo los profesores pueden subir escaneos.' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No se recibió ninguna imagen.' });
    }

    const fileUrl = `/uploads/scans/${req.file.filename}`;
    const attachment: ScanAttachment = {
      type: 'scan',
      url: fileUrl,
      file_name: req.file.originalname || req.file.filename,
      mime_type: req.file.mimetype,
      uploaded_at: new Date().toISOString(),
    };

    const submissionId = typeof req.body?.submissionId === 'string' ? req.body.submissionId : '';
    const assignmentId = typeof req.body?.assignmentId === 'string' ? req.body.assignmentId : '';
    const studentId = typeof req.body?.studentId === 'string' ? req.body.studentId : '';

    if (submissionId) {
      await appendSubmissionAttachment(submissionId, attachment);
    } else if (assignmentId && studentId) {
      const assignment = await findAssignmentById(assignmentId);
      if (!assignment) return res.status(404).json({ error: 'Tarea no encontrada.' });
      if (assignment.created_by !== userId) {
        return res.status(403).json({ error: 'Solo el profesor creador puede adjuntar escaneos.' });
      }

      const gs = await findGroupSubjectById(assignment.group_subject_id);
      if (!gs || gs.institution_id !== colegioId) {
        return res.status(403).json({ error: 'No autorizado.' });
      }

      const existing = await queryPg<{ id: string }>(
        'SELECT id FROM submissions WHERE assignment_id = $1 AND student_id = $2 LIMIT 1',
        [assignmentId, studentId]
      );
      const existingId = existing.rows[0]?.id ?? null;

      let finalSubmissionId = existingId;
      if (!finalSubmissionId) {
        const created = await queryPg<{ id: string }>(
          `INSERT INTO submissions (assignment_id, student_id, status, attachments, created_at, updated_at)
           VALUES ($1, $2, 'draft', $3::jsonb, NOW(), NOW())
           RETURNING id`,
          [assignmentId, studentId, JSON.stringify([attachment])]
        );
        finalSubmissionId = created.rows[0]?.id ?? null;
      } else {
        await appendSubmissionAttachment(finalSubmissionId, attachment);
      }
    }

    return res.json({
      ok: true,
      url: fileUrl,
      fileName: req.file.filename,
    });
  } catch (err: unknown) {
    console.error('[uploads/scan]', err);
    const msg = err instanceof Error ? err.message : 'Error al subir el escaneo';
    return res.status(500).json({ error: msg });
  }
});

export default router;

