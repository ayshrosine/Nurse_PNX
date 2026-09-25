import 'server-only';
import { htmlToText, cleanText } from './importParsers';

// Text extraction for uploaded documents (Architecture doc §7, Backend doc §7.2).
// Files are only ever handed to parser libraries as bytes — never executed or rendered as HTML.

export type OcrProvider = 'tesseract' | 'ocrspace';

export interface ExtractionResult {
  text: string;
  usedOcr: boolean;
  ocrProvider: OcrProvider | null;
  pages?: number;
}

const MAX_OCR_PAGES = 30;
/** Below this many characters per page a PDF is treated as scanned and sent to OCR. */
const MIN_CHARS_PER_PAGE = 40;

function normalise(text: string) {
  return text
    .replace(/\r/g, '')
    .split('\n')
    .map((l) => cleanText(l))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

async function extractPdf(buffer: Buffer, ocrProvider: OcrProvider): Promise<ExtractionResult> {
  const { PDFParse } = await import('pdf-parse');
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  try {
    const result = await parser.getText();
    const text = normalise(result.text);
    const pages = result.total || 1;
    if (text.replace(/\s/g, '').length >= MIN_CHARS_PER_PAGE * Math.min(pages, 3)) {
      return { text, usedOcr: false, ocrProvider: null, pages };
    }
    // Scanned/image PDF: fall back to OCR.
    const ocrText = ocrProvider === 'ocrspace' ? await ocrSpace(buffer, 'application/pdf') : await tesseractPdf(parser, pages);
    return { text: normalise(ocrText), usedOcr: true, ocrProvider, pages };
  } finally {
    await parser.destroy();
  }
}

async function tesseractPdf(parser: import('pdf-parse').PDFParse, pages: number) {
  const shots = await parser.getScreenshot({ first: Math.min(pages, MAX_OCR_PAGES), scale: 2, imageBuffer: true, imageDataUrl: false });
  const { createWorker } = await import('tesseract.js');
  const worker = await createWorker('eng');
  try {
    const out: string[] = [];
    for (const page of shots.pages) {
      const { data } = await worker.recognize(Buffer.from(page.data));
      out.push(data.text);
    }
    return out.join('\n\n');
  } finally {
    await worker.terminate();
  }
}

async function ocrSpace(buffer: Buffer, mime: string) {
  const key = process.env.OCRSPACE_API_KEY || 'helloworld'; // OCR.space's public demo key; rate-limited
  const form = new FormData();
  form.append('file', new Blob([new Uint8Array(buffer)], { type: mime }), mime === 'application/pdf' ? 'upload.pdf' : 'upload.png');
  form.append('isOverlayRequired', 'false');
  form.append('OCREngine', '2');
  const res = await fetch('https://api.ocr.space/parse/image', {
    method: 'POST',
    headers: { apikey: key },
    body: form,
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) throw new Error(`OCR.space request failed (${res.status})`);
  const json = (await res.json()) as { IsErroredOnProcessing?: boolean; ErrorMessage?: string[]; ParsedResults?: { ParsedText: string }[] };
  if (json.IsErroredOnProcessing) throw new Error(`OCR.space: ${json.ErrorMessage?.join('; ') ?? 'processing error'}`);
  return (json.ParsedResults ?? []).map((r) => r.ParsedText).join('\n\n');
}

async function extractDocx(buffer: Buffer): Promise<ExtractionResult> {
  const mammoth = await import('mammoth');
  const { value } = await mammoth.extractRawText({ buffer });
  return { text: normalise(value), usedOcr: false, ocrProvider: null };
}

export async function extractText(
  fileType: 'PDF' | 'DOCX' | 'HTML',
  buffer: Buffer,
  ocrProvider: OcrProvider,
): Promise<ExtractionResult> {
  switch (fileType) {
    case 'PDF':
      return extractPdf(buffer, ocrProvider);
    case 'DOCX':
      return extractDocx(buffer);
    case 'HTML':
      // Text-only extraction; scripts/styles are dropped and no markup survives.
      return { text: normalise(htmlToText(buffer.toString('utf8'))), usedOcr: false, ocrProvider: null };
  }
}

// ---------------------------------------------------------------- upload validation

const SIGNATURES = {
  PDF: (b: Buffer) => b.subarray(0, 5).toString('latin1') === '%PDF-',
  DOCX: (b: Buffer) => b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04, // ZIP container
  HTML: (b: Buffer) => {
    const head = b.subarray(0, 2048).toString('utf8').toLowerCase();
    return !head.includes('\u0000') && /<(!doctype|html|head|body|div|p|table|h[1-6]|ol|ul)[\s>]/.test(head);
  },
};

const EXTENSIONS: Record<string, 'PDF' | 'DOCX' | 'HTML'> = { pdf: 'PDF', docx: 'DOCX', html: 'HTML', htm: 'HTML' };
const MIME: Record<'PDF' | 'DOCX' | 'HTML', string[]> = {
  PDF: ['application/pdf'],
  DOCX: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/octet-stream', 'application/zip'],
  HTML: ['text/html', 'application/xhtml+xml', 'text/plain', 'application/octet-stream'],
};

/** Extension allow-list + MIME check + magic-byte sniff (Backend doc §7.1). */
export function detectFileType(filename: string, mime: string, buffer: Buffer): 'PDF' | 'DOCX' | 'HTML' | null {
  const ext = filename.toLowerCase().split('.').pop() ?? '';
  const type = EXTENSIONS[ext];
  if (!type) return null;
  if (mime && !MIME[type].includes(mime.split(';')[0].trim().toLowerCase())) return null;
  return SIGNATURES[type](buffer) ? type : null;
}
