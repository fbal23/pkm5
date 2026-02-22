import { NextRequest, NextResponse } from 'next/server';
import { nodeService } from '@/services/database';
import { autoEmbedQueue } from '@/services/embedding/autoEmbedQueue';

export const runtime = 'nodejs';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const nodeId = parseInt(id, 10);
  if (isNaN(nodeId)) {
    return NextResponse.json({ success: false, error: 'Invalid node ID' }, { status: 400 });
  }

  const node = await nodeService.getNodeById(nodeId);
  if (!node) {
    return NextResponse.json({ success: false, error: 'Node not found' }, { status: 404 });
  }

  autoEmbedQueue.enqueue(nodeId, { force: true, reason: 'manual_embed' });

  return NextResponse.json({ success: true, message: `Embed queued for node ${nodeId}` });
}
