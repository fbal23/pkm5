import { NextRequest } from 'next/server';
import { getSQLiteClient } from '@/services/database/sqlite-client';

export async function GET(request: NextRequest) {
  const sessionId = request.nextUrl.searchParams.get('sessionId');

  if (!sessionId) {
    return Response.json({ inputTokens: 0 });
  }

  try {
    const sqlite = getSQLiteClient();
    const row = sqlite.prepare(`
      SELECT json_extract(metadata, '$.input_tokens') as input_tokens
      FROM chats
      WHERE thread_id LIKE ?
      ORDER BY created_at DESC
      LIMIT 1
    `).get(`%${sessionId}%`) as { input_tokens: number | null } | undefined;

    return Response.json({
      inputTokens: row?.input_tokens ?? 0
    });
  } catch (error) {
    console.error('Usage fetch error:', error);
    return Response.json({ inputTokens: 0 });
  }
}
