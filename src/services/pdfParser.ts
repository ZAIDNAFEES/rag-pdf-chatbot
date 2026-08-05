import * as pdfjsLib from 'pdfjs-dist';
import Tesseract from 'tesseract.js';

// Configure worker for pdfjs-dist
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

export interface ExtractedPage {
  document_name: string;
  page_number: number;
  text: string;
}

export interface ProcessedDocumentResult {
  filename: string;
  total_pages: number;
  extracted_pages: ExtractedPage[];
  status: 'success' | 'error' | 'warning';
  message: string;
}

export interface ParsingLog {
  timestamp: string;
  level: 'INFO' | 'WARN' | 'ERROR';
  message: string;
}

export class PDFParserService {
  private logs: ParsingLog[] = [];

  private log(level: 'INFO' | 'WARN' | 'ERROR', message: string) {
    const timestamp = new Date().toISOString();
    this.logs.push({ timestamp, level, message });
    console.log(`[PDFParser] [${level}] ${message}`);
  }

  public getLogs(): ParsingLog[] {
    return [...this.logs];
  }

  /**
   * Cleans text extracted via OCR or embedded parsing:
   * - Removes duplicate inline spaces
   * - Removes empty lines
   * - Preserves paragraph line breaks
   */
  private cleanText(rawText: string): string {
    return rawText
      .split(/\r?\n/)
      .map((line) => line.replace(/[ \t]+/g, ' ').trim())
      .filter((line) => line.length > 0)
      .join('\n');
  }

  /**
   * Renders a PDF.js page onto a high-resolution canvas element (2.5x scale)
   * and exports as Data URL for Tesseract OCR.
   */
  private async renderPageToDataUrl(page: any, scale = 2.5): Promise<string> {
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Canvas 2D rendering context is unavailable.');
    }
    canvas.width = viewport.width;
    canvas.height = viewport.height;

    const renderContext = {
      canvasContext: context,
      viewport: viewport,
    };
    await page.render(renderContext).promise;
    return canvas.toDataURL('image/png');
  }

  /**
   * Executes Tesseract.js OCR on a scanned / image-only PDF page.
   */
  private async performOcrOnPage(page: any, pageNum: number): Promise<string> {
    this.log('INFO', `Page ${pageNum} contains no embedded text.`);
    this.log('INFO', `Running OCR on page ${pageNum}...`);
    try {
      const imageDataUrl = await this.renderPageToDataUrl(page, 2.5);
      const result = await Tesseract.recognize(imageDataUrl, 'eng');
      this.log('INFO', `OCR completed for page ${pageNum}.`);
      const rawText = result?.data?.text || '';
      const cleaned = this.cleanText(rawText);
      this.log('INFO', `Extracted ${cleaned.length} characters via OCR.`);
      return cleaned;
    } catch (err: any) {
      this.log('ERROR', `OCR processing failed for page ${pageNum}: ${err?.message || 'Unknown OCR error'}`);
      return '';
    }
  }

  /**
   * Parses a single File object and extracts readable page text preserving page numbers.
   * Uses pdf.js embedded text extraction first; falls back to Tesseract OCR for scanned pages (<10 chars).
   */
  public async parseFile(file: File): Promise<ProcessedDocumentResult> {
    this.log('INFO', `Starting PDF ingestion for file: "${file.name}" (${(file.size / 1024).toFixed(1)} KB)`);

    // 1. Validate file extension and MIME type
    if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
      const msg = `Unsupported file type for "${file.name}". Only PDF files are supported.`;
      this.log('ERROR', msg);
      return {
        filename: file.name,
        total_pages: 0,
        extracted_pages: [],
        status: 'error',
        message: msg,
      };
    }

    try {
      const arrayBuffer = await file.arrayBuffer();

      if (arrayBuffer.byteLength === 0) {
        const msg = `File "${file.name}" is completely empty (0 bytes).`;
        this.log('ERROR', msg);
        return {
          filename: file.name,
          total_pages: 0,
          extracted_pages: [],
          status: 'error',
          message: msg,
        };
      }

      // 2. Load PDF Document via PDF.js
      const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) });

      loadingTask.onPassword = (reason: number) => {
        this.log('WARN', `Password required for file "${file.name}" (reason code: ${reason})`);
      };

      const pdfDoc = await loadingTask.promise.catch((err: any) => {
        if (err?.name === 'PasswordException') {
          throw new Error(`File "${file.name}" is password-protected/encrypted and cannot be parsed.`);
        }
        if (err?.name === 'InvalidPDFException') {
          throw new Error(`File "${file.name}" is corrupted or invalid PDF format.`);
        }
        throw new Error(`Failed to parse PDF "${file.name}": ${err?.message || 'Unknown parsing error'}`);
      });

      const numPages = pdfDoc.numPages;
      if (numPages === 0) {
        const msg = `PDF "${file.name}" contains zero pages.`;
        this.log('WARN', msg);
        return {
          filename: file.name,
          total_pages: 0,
          extracted_pages: [],
          status: 'warning',
          message: msg,
        };
      }

      this.log('INFO', `PDF "${file.name}" loaded successfully with ${numPages} page(s). Extracting text...`);

      const extractedPages: ExtractedPage[] = [];

      // 3. Extract text page by page preserving 1-indexed page numbers
      for (let pageNum = 1; pageNum <= numPages; pageNum++) {
        const page = await pdfDoc.getPage(pageNum);
        const tokenContent = await page.getTextContent();

        // Assemble embedded text from tokens
        const strings = tokenContent.items.map((item: any) => item.str || '');
        let pageText = strings.join(' ').replace(/\s+/g, ' ').trim();

        // Detect scanned page (< 10 embedded characters) and trigger OCR fallback
        if (!pageText || pageText.length < 10) {
          pageText = await this.performOcrOnPage(page, pageNum);
        }

        // Rule: Skip page only if both embedded text extraction and OCR fail (< 3 chars)
        if (!pageText || pageText.length < 3) {
          this.log('INFO', `Page ${pageNum} of "${file.name}" skipped (no readable text found / image-only).`);
          continue;
        }

        extractedPages.push({
          document_name: file.name,
          page_number: pageNum,
          text: pageText,
        });

        this.log('INFO', `Page ${pageNum}/${numPages} extracted successfully (${pageText.length} chars).`);
      }

      if (extractedPages.length === 0) {
        const msg = `PDF "${file.name}" loaded ${numPages} page(s), but no readable text was extracted (scanned/image PDF).`;
        this.log('WARN', msg);
        return {
          filename: file.name,
          total_pages: numPages,
          extracted_pages: [],
          status: 'warning',
          message: msg,
        };
      }

      const successMsg = `✓ ${file.name} — ${extractedPages.length} readable page(s) extracted out of ${numPages} page(s) — extraction completed`;
      this.log('INFO', successMsg);

      return {
        filename: file.name,
        total_pages: extractedPages.length,
        extracted_pages: extractedPages,
        status: 'success',
        message: successMsg,
      };
    } catch (error: any) {
      const errMsg = error.message || `Failed to read file "${file.name}".`;
      this.log('ERROR', `Exception during ingestion of "${file.name}": ${errMsg}`);
      return {
        filename: file.name,
        total_pages: 0,
        extracted_pages: [],
        status: 'error',
        message: errMsg,
      };
    }
  }

  /**
   * Parses multiple File objects sequentially with log auditing.
   */
  public async parseMultipleFiles(files: File[]): Promise<ProcessedDocumentResult[]> {
    this.log('INFO', `Processing batch of ${files.length} PDF file(s)...`);
    const results: ProcessedDocumentResult[] = [];
    for (const file of files) {
      const res = await this.parseFile(file);
      results.push(res);
    }
    this.log('INFO', `Batch processing finished. ${results.filter(r => r.status === 'success').length}/${files.length} succeeded.`);
    return results;
  }
}

export const defaultPdfParser = new PDFParserService();
