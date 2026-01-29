import { NextRequest, NextResponse } from 'next/server';
import { readGuide } from '@/services/guides/guideService';

export const runtime = 'nodejs';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const { name } = await params;
    const guide = readGuide(name);
    if (!guide) {
      return NextResponse.json(
        { success: false, error: `Guide "${name}" not found` },
        { status: 404 }
      );
    }
    return NextResponse.json({ success: true, data: guide });
  } catch (error) {
    console.error('[API /guides/[name]] error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to read guide' },
      { status: 500 }
    );
  }
}
