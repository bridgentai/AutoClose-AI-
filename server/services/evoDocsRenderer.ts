import puppeteer from 'puppeteer';
import type { Browser } from 'puppeteer';
import { renderEvoDocHTML } from './evoDocTemplate.js';
import type { EvoDocData } from './evoDocTemplate.js';
import { insertEvoDoc } from '../repositories/evoDocsRepository.js';
import { syncEvoDocPdfToUserDrive } from './evoDocsDriveUpload.js';
import * as fs from 'fs';
import * as path from 'path';

const STORAGE_ROOT = path.resolve(process.cwd(), 'server', 'storage', 'evo-docs');

/** Puppeteer/Chromium defaults for server-side Evo Doc PDF rendering. */
const PP_ARGS = ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'];

async function launchPuppeteerForEvoDoc(): Promise<Browser> {
  const base = {
    headless: true,
    args: [...PP_ARGS],
  };
  const execFromEnv = process.env.PUPPETEER_EXECUTABLE_PATH?.trim();

  if (execFromEnv) {
    return puppeteer.launch({ ...base, executablePath: execFromEnv });
  }

  try {
    return await puppeteer.launch({ ...base });
  } catch (firstErr: unknown) {
    const msg = firstErr instanceof Error ? firstErr.message : String(firstErr);
    if (/Could not find Chrome/i.test(msg)) {
      return puppeteer.launch({ ...base, channel: 'chrome' });
    }
    throw firstErr;
  }
}

function ensureDir(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

export async function generateEvoDocPDF(
  data: EvoDocData,
  institutionId: string,
  userId: string,
  options?: { description?: string; subjectId?: string }
): Promise<{ pdfPath: string; docId: string; url: string }> {
  const html = renderEvoDocHTML(data);

  const browser = await launchPuppeteerForEvoDoc();

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 15000 });

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '0', bottom: '0', left: '0', right: '0' },
    });

    const instDir = path.join(STORAGE_ROOT, institutionId);
    ensureDir(instDir);

    const doc = await insertEvoDoc({
      institution_id: institutionId,
      created_by_id: userId,
      title: data.title,
      description: options?.description,
      doc_type: data.docType,
      subject_name: data.subjectName,
      subject_id: options?.subjectId,
      period: data.period,
      metadata: {
        metricsCount: data.metrics.length,
        sectionsCount: data.sections.length,
        recommendationsCount: data.recommendations.length,
      },
      pdf_path: '',
    });

    const fileName = `${doc.id}.pdf`;
    const filePath = path.join(instDir, fileName);
    fs.writeFileSync(filePath, pdfBuffer);

    const relativePath = `evo-docs/${institutionId}/${fileName}`;
    await import('../config/db-pg.js').then(({ queryPg }) =>
      queryPg(`UPDATE evo_docs SET pdf_path = $1 WHERE id = $2`, [relativePath, doc.id])
    );

    const pdfNodeBuffer = Buffer.isBuffer(pdfBuffer) ? pdfBuffer : Buffer.from(pdfBuffer);
    await syncEvoDocPdfToUserDrive({
      userId,
      institutionId,
      evoDocId: doc.id,
      title: data.title,
      pdfBuffer: pdfNodeBuffer,
    });

    return {
      pdfPath: relativePath,
      docId: doc.id,
      url: `/api/evo-docs/${doc.id}/pdf`,
    };
  } finally {
    await browser.close();
  }
}
