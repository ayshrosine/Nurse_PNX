import 'server-only';
import { randomUUID } from 'node:crypto';
import { query, queryOne, transaction } from '../db';
import { ApiError, Errors } from '../../errors';
import type { DocumentRow, DocumentStatus, Question, User } from '@/types';
import * as storage from '../storage';
import { extractText, type OcrProvider } from '../extract';
import { generateMcqs } from '../ai';
import { parseTextMcqs } from '../importParsers';
import { getSettings } from './settingsService';
import { insertMany } from './questionService';
import { logAudit } from './auditService';

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

const DOC_COLUMNS = `d.id, d.test_series_id, d.uploaded_by, d.original_filename, d.file_type, d.mime_type, d.size_bytes,
  d.storage_key, d.status, d.extracted_text_key, d.ocr_provider, d.ai_provider, d.error_message, d.created_at, d.updated_at,
  (SELECT COUNT(*) FROM questions q WHERE q.source_document_id = d.id AND q.review_status = 'PENDING_REVIEW')::int AS pending_count`;

export async function get(id: string) {
  const doc = await queryOne<DocumentRow>(`SELECT ${DOC_COLUMNS} FROM documents d WHERE d.id = $1`, [id]);
  if (!doc) throw Errors.notFound('Document');
  return doc;
}

export async function getWithPreview(id: string) {
  const doc = await get(id);
  let text_preview: string | null = null;
  let text_length: number | null = null;
  if (doc.extracted_text_key) {
    try {
      const text = (await storage.getFile(doc.extracted_text_key)).toString('utf8');
      text_length = text.length;
      text_preview = text.slice(0, 3000);
    } catch {
      text_preview = null;
    }
  }
  return { ...doc, text_preview, text_length };
}

export async function listForSeries(testSeriesId: string) {
  return query<DocumentRow>(
    `SELECT ${DOC_COLUMNS} FROM documents d WHERE d.test_series_id = $1 ORDER BY d.created_at DESC`,
    [testSeriesId],
  );
}

export async function upload(
  admin: User,
  input: { testSeriesId: string; filename: string; mime: string; fileType: 'PDF' | 'DOCX' | 'HTML'; buffer: Buffer },
) {
  const series = await queryOne(`SELECT 1 FROM test_series WHERE id = $1`, [input.testSeriesId]);
  if (!series) throw Errors.notFound('Test series');
  const id = randomUUID();
  const safeName = input.filename.replace(/[^\w.\-]+/g, '_').slice(-120) || 'upload';
  const key = `documents/${id}/${safeName}`;
  await storage.uploadFile(key, input.buffer, input.mime || 'application/octet-stream');
  const doc = await queryOne<DocumentRow>(
    `INSERT INTO documents AS d (id, test_series_id, uploaded_by, original_filename, file_type, mime_type, size_bytes, storage_key)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING ${DOC_COLUMNS}`,
    [id, input.testSeriesId, admin.id, input.filename.slice(0, 255), input.fileType, input.mime || 'application/octet-stream',
      input.buffer.length, key],
  );
  await logAudit(admin.id, 'DOCUMENT_UPLOADED', 'document', id, { filename: input.filename, size: input.buffer.length });
  return doc!;
}

/** Atomically moves a document into a working state; prevents two concurrent runs of the same step. */
async function claim(id: string, from: DocumentStatus[], to: DocumentStatus) {
  const row = await queryOne<DocumentRow>(
    `UPDATE documents SET status = $3, error_message = NULL WHERE id = $1 AND status = ANY($2::document_status[])
     RETURNING id, file_type, storage_key, extracted_text_key, test_series_id`,
    [id, from, to],
  );
  if (!row) {
    const exists = await queryOne<{ status: DocumentStatus }>(`SELECT status FROM documents WHERE id = $1`, [id]);
    if (!exists) throw Errors.notFound('Document');
    throw new ApiError(409, 'CONFLICT', `Document is ${exists.status.toLowerCase().replace('_', ' ')}; this step is not available now`);
  }
  return row;
}

async function fail(id: string, status: DocumentStatus, err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`[documents] ${status} ${id}:`, message);
  await query(`UPDATE documents SET status = $2, error_message = $3 WHERE id = $1`, [id, status, message.slice(0, 1000)]);
}

export async function beginExtract(id: string) {
  return claim(id, ['UPLOADED', 'EXTRACT_FAILED', 'EXTRACTED', 'GENERATE_FAILED'], 'EXTRACTING');
}

/** Runs after the response is sent (next/server `after`); the UI polls GET /api/admin/documents/:id. */
export async function runExtract(admin: User, doc: Awaited<ReturnType<typeof beginExtract>>) {
  try {
    const settings = await getSettings();
    const buffer = await storage.getFile(doc.storage_key);
    const result = await extractText(doc.file_type, buffer, settings.ocr_provider as OcrProvider);
    if (result.text.replace(/\s/g, '').length < 50) throw new Error('No readable text was found in this document');
    const textKey = `documents/${doc.id}/extracted.txt`;
    await storage.uploadFile(textKey, Buffer.from(result.text, 'utf8'), 'text/plain; charset=utf-8');
    await query(
      `UPDATE documents SET status = 'EXTRACTED', extracted_text_key = $2, ocr_provider = $3 WHERE id = $1`,
      [doc.id, textKey, result.ocrProvider],
    );
    await logAudit(admin.id, 'DOCUMENT_EXTRACTED', 'document', doc.id, { chars: result.text.length, ocr: result.usedOcr });
  } catch (err) {
    await fail(doc.id, 'EXTRACT_FAILED', err);
  }
}

export async function beginGenerate(id: string) {
  const doc = await claim(id, ['EXTRACTED', 'GENERATED', 'GENERATE_FAILED'], 'GENERATING');
  if (!doc.extracted_text_key) {
    await query(`UPDATE documents SET status = 'UPLOADED' WHERE id = $1`, [id]);
    throw Errors.conflict('Extract the text first');
  }
  return doc;
}

/**
 * mode "ai": LLM writes new MCQs from the text. mode "parse": the document already contains MCQs in the
 * "1. … A) … Answer: B" format and they are parsed directly (no AI needed). Either way the results land as
 * PENDING_REVIEW drafts that students cannot see until an admin approves them.
 */
export async function runGenerate(admin: User, doc: Awaited<ReturnType<typeof beginGenerate>>, opts: { mode: 'ai' | 'parse'; count?: number }) {
  try {
    const text = (await storage.getFile(doc.extracted_text_key!)).toString('utf8');
    let questions;
    let provider: string;
    if (opts.mode === 'parse') {
      const parsed = parseTextMcqs(text);
      if (parsed.questions.length === 0) {
        throw new Error('No questions in "1. … A) … Answer: X" format were found. Try AI generation instead.');
      }
      questions = parsed.questions;
      provider = 'parser';
    } else {
      const settings = await getSettings();
      const result = await generateMcqs(text, opts.count ?? settings.mcq_default_count, settings.ai_provider);
      questions = result.questions;
      provider = result.provider;
    }
    await transaction(async (db) => {
      // Regenerating replaces earlier unreviewed drafts from this document instead of piling up duplicates.
      await query(`DELETE FROM questions WHERE source_document_id = $1 AND review_status = 'PENDING_REVIEW'`, [doc.id], db);
      await insertMany(db, doc.test_series_id!, questions, { source: 'AI_GENERATED', reviewStatus: 'PENDING_REVIEW', documentId: doc.id });
      await query(`UPDATE documents SET status = 'GENERATED', ai_provider = $2 WHERE id = $1`, [doc.id, provider], db);
    });
    await logAudit(admin.id, 'DOCUMENT_GENERATED', 'document', doc.id, { count: questions.length, provider });
  } catch (err) {
    await fail(doc.id, 'GENERATE_FAILED', err);
  }
}

export async function preview(id: string) {
  await get(id);
  return query<Question>(
    `SELECT id, test_series_id, question_text, option_a, option_b, option_c, option_d, correct_answer, explanation,
            question_order, source, source_document_id, review_status, created_at, updated_at
       FROM questions WHERE source_document_id = $1 AND review_status IN ('PENDING_REVIEW', 'REJECTED')
      ORDER BY question_order`,
    [id],
  );
}

/** Approves every remaining PENDING_REVIEW draft (rejected ones stay excluded) and appends them to the series. */
export async function approve(admin: User, id: string, questionIds?: string[]) {
  return transaction(async (db) => {
    const doc = await queryOne<{ test_series_id: string | null; status: DocumentStatus }>(
      `SELECT test_series_id, status FROM documents WHERE id = $1 FOR UPDATE`,
      [id],
      db,
    );
    if (!doc) throw Errors.notFound('Document');
    if (!doc.test_series_id) throw Errors.conflict('Link this document to a test series first');
    const drafts = await query<{ id: string }>(
      `SELECT id FROM questions WHERE source_document_id = $1 AND review_status = 'PENDING_REVIEW'
         AND ($2::uuid[] IS NULL OR id = ANY($2::uuid[]))
       ORDER BY question_order`,
      [id, questionIds ?? null],
      db,
    );
    if (drafts.length === 0) throw Errors.conflict('There are no draft questions to approve');
    // Approved questions are appended after the series' current approved questions.
    await query(`SELECT 1 FROM test_series WHERE id = $1 FOR UPDATE`, [doc.test_series_id], db);
    const { max } = (await queryOne<{ max: number }>(
      `SELECT COALESCE(MAX(question_order), 0) AS max FROM questions WHERE test_series_id = $1`,
      [doc.test_series_id],
      db,
    ))!;
    await db.query('SET CONSTRAINTS uq_question_order DEFERRED');
    await query(
      `UPDATE questions q SET review_status = 'APPROVED', question_order = $2 + v.ord
         FROM unnest($1::uuid[]) WITH ORDINALITY AS v(id, ord) WHERE q.id = v.id`,
      [drafts.map((d) => d.id), max],
      db,
    );
    const remaining = await queryOne<{ n: number }>(
      `SELECT COUNT(*)::int AS n FROM questions WHERE source_document_id = $1 AND review_status = 'PENDING_REVIEW'`,
      [id],
      db,
    );
    if (remaining!.n === 0) await query(`UPDATE documents SET status = 'APPROVED' WHERE id = $1`, [id], db);
    await logAudit(admin.id, 'DOCUMENT_APPROVED', 'document', id, { approved: drafts.length }, db);
    return { approved: drafts.length, testSeriesId: doc.test_series_id };
  });
}

export async function remove(admin: User, id: string) {
  const doc = await get(id);
  if (doc.status === 'EXTRACTING' || doc.status === 'GENERATING') throw Errors.conflict('Wait for processing to finish');
  await transaction(async (db) => {
    await query(`DELETE FROM questions WHERE source_document_id = $1 AND review_status <> 'APPROVED'`, [id], db);
    await query(`DELETE FROM documents WHERE id = $1`, [id], db);
  });
  await storage.deleteFile(doc.storage_key).catch(() => {});
  if (doc.extracted_text_key) await storage.deleteFile(doc.extracted_text_key).catch(() => {});
}
