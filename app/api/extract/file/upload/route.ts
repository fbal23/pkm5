import { NextRequest, NextResponse } from 'next/server';
import { PaperExtractor } from '@/services/typescript/extractors/paper';
import { extractTextFile, extractDocxFile } from '@/services/typescript/extractors/document';

export const runtime = 'nodejs';

const MAX_SIZE = 50 * 1024 * 1024; // 50MB
const WARN_SIZE = 10 * 1024 * 1024; // 10MB

const SUPPORTED_TYPES: Record<string, string> = {
  'application/pdf': 'pdf',
  'text/plain': 'txt',
  'text/markdown': 'md',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
};

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { success: false, error: 'A file is required' },
        { status: 400 }
      );
    }

    // Normalize MIME type — browsers sometimes send text/plain for .md files
    let mimeType = file.type;
    if (!mimeType || mimeType === 'text/plain') {
      if (file.name.endsWith('.md') || file.name.endsWith('.markdown')) {
        mimeType = 'text/markdown';
      }
    }

    if (!SUPPORTED_TYPES[mimeType]) {
      return NextResponse.json(
        {
          success: false,
          error: `Unsupported file type: ${mimeType}. Supported types: PDF, TXT, MD, DOCX`,
        },
        { status: 400 }
      );
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        {
          success: false,
          error: `File too large (${Math.round(file.size / 1024 / 1024)}MB). Maximum size is 50MB.`,
        },
        { status: 413 }
      );
    }

    const isLargeFile = file.size > WARN_SIZE;
    const buffer = Buffer.from(await file.arrayBuffer());

    let title: string;
    let chunk: string;
    let content: string;
    let metadata: Record<string, unknown>;
    let nodeType: string;

    if (mimeType === 'application/pdf') {
      const extractor = new PaperExtractor();
      const extraction = await extractor.extractFromBuffer(buffer, file.name);
      title = extraction.metadata.title || file.name.replace(/\.pdf$/i, '');
      chunk = extraction.chunk;
      content = `Imported PDF: ${file.name} (${extraction.metadata.pages} pages, ${Math.round(extraction.metadata.text_length / 1000)}k characters)`;
      metadata = {
        source: 'file_upload',
        file_type: 'pdf',
        original_filename: file.name,
        pages: extraction.metadata.pages,
        text_length: extraction.metadata.text_length,
        extraction_method: extraction.metadata.extraction_method,
        imported_at: new Date().toISOString(),
      };
      nodeType = 'pdf';
    } else if (mimeType === 'text/plain' || mimeType === 'text/markdown') {
      const extraction = await extractTextFile(buffer, file.name, mimeType);
      title = file.name.replace(/\.(txt|md|markdown)$/i, '');
      chunk = extraction.chunk;
      content = extraction.content;
      metadata = {
        source: 'file_upload',
        ...extraction.metadata,
        imported_at: new Date().toISOString(),
      };
      nodeType = 'note';
    } else {
      // docx
      const extraction = await extractDocxFile(buffer, file.name);
      title = file.name.replace(/\.docx$/i, '');
      chunk = extraction.chunk;
      content = extraction.content;
      metadata = {
        source: 'file_upload',
        ...extraction.metadata,
        imported_at: new Date().toISOString(),
      };
      nodeType = 'note';
    }

    const nodeApiUrl = new URL('/api/nodes', request.url);
    const createResponse = await fetch(nodeApiUrl.toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, type: nodeType, content, chunk, metadata }),
    });

    if (!createResponse.ok) {
      const errorData = await createResponse.json().catch(() => ({}));
      throw new Error(errorData.error || `Failed to create node: ${createResponse.status}`);
    }

    const nodeResult = await createResponse.json();
    if (!nodeResult.success || !nodeResult.data?.id) {
      throw new Error(nodeResult.error || 'Failed to create node');
    }

    return NextResponse.json({
      success: true,
      nodeId: nodeResult.data.id,
      title,
      fileType: SUPPORTED_TYPES[mimeType],
      textLength: chunk.length,
      warning: isLargeFile
        ? `Large file (${Math.round(file.size / 1024 / 1024)}MB) - processing may take longer`
        : undefined,
    });
  } catch (error) {
    console.error('[File Upload API] Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to process file upload';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
