import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

interface EmailIngestBody {
  subject: string;
  body: string;
  from: string;
  date: string;
  to?: string;
  attachments?: string[];
}

/**
 * Strip deeply-nested quoted reply chains (lines starting with ">>" or more).
 * Keeps first-level quotes (single ">") for context but removes deep nesting.
 */
function cleanEmailBody(body: string): string {
  const lines = body.split('\n');
  const cleaned: string[] = [];
  let consecutiveQuotedLines = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    // Deep quote (>>...) — skip aggressively
    if (/^>{2,}/.test(trimmed)) {
      consecutiveQuotedLines++;
      if (consecutiveQuotedLines <= 3) {
        cleaned.push(line); // Keep a few lines for context
      }
      continue;
    }
    consecutiveQuotedLines = 0;
    cleaned.push(line);
  }

  return cleaned.join('\n').trim();
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Partial<EmailIngestBody>;

    if (!body.subject || typeof body.subject !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Missing required field: subject' },
        { status: 400 }
      );
    }
    if (!body.body || typeof body.body !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Missing required field: body' },
        { status: 400 }
      );
    }
    if (!body.from || typeof body.from !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Missing required field: from' },
        { status: 400 }
      );
    }
    if (!body.date || typeof body.date !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Missing required field: date' },
        { status: 400 }
      );
    }

    const cleanedBody = cleanEmailBody(body.body);

    const nodeApiUrl = new URL('/api/nodes', request.url);
    const createResponse = await fetch(nodeApiUrl.toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: body.subject,
        type: 'note',
        // notes = cleaned body shown in UI
        notes: cleanedBody,
        // chunk = full raw body for embedding
        chunk: body.body,
        metadata: {
          source: 'email',
          from: body.from,
          date: body.date,
          ...(body.to ? { to: body.to } : {}),
          ...(body.attachments?.length ? { attachments: body.attachments } : {}),
          imported_at: new Date().toISOString(),
        },
      }),
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
      title: body.subject,
    }, { status: 201 });
  } catch (error) {
    console.error('[Email Ingest API] Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to ingest email';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
