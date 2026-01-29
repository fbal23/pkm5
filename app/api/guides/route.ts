import { NextResponse } from 'next/server';
import { listGuides } from '@/services/guides/guideService';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const guides = listGuides();
    return NextResponse.json({ success: true, data: guides });
  } catch (error) {
    console.error('[API /guides] error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to list guides' },
      { status: 500 }
    );
  }
}
