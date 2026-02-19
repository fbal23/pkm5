import mammoth from 'mammoth';

export interface DocumentExtractionResult {
  content: string;
  chunk: string;
  metadata: {
    filename: string;
    file_type: string;
    text_length: number;
    extraction_method: string;
  };
}

export async function extractTextFile(
  buffer: Buffer,
  filename: string,
  mimeType: 'text/plain' | 'text/markdown'
): Promise<DocumentExtractionResult> {
  const text = buffer.toString('utf-8');
  const label = mimeType === 'text/markdown' ? 'Markdown' : 'Text';
  const ext = mimeType === 'text/markdown' ? 'md' : 'txt';

  return {
    content: `Imported ${label} file: ${filename} (${Math.round(text.length / 1000)}k characters)`,
    chunk: text,
    metadata: {
      filename,
      file_type: ext,
      text_length: text.length,
      extraction_method: 'utf8_read',
    },
  };
}

export async function extractDocxFile(
  buffer: Buffer,
  filename: string
): Promise<DocumentExtractionResult> {
  const result = await mammoth.extractRawText({ buffer });
  const text = result.value;

  return {
    content: `Imported Word document: ${filename} (${Math.round(text.length / 1000)}k characters)`,
    chunk: text,
    metadata: {
      filename,
      file_type: 'docx',
      text_length: text.length,
      extraction_method: 'mammoth',
    },
  };
}
