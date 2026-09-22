import { NextRequest, NextResponse } from 'next/server';
import { getDeveloperStats, verifyDeveloperSessionToken } from '@/lib/db/database';

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : '';

    if (!token || !verifyDeveloperSessionToken(token)) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized. Developer session expired or invalid.' },
        { status: 401 }
      );
    }

    const stats = getDeveloperStats();
    return NextResponse.json({ success: true, stats });
  } catch (error: any) {
    console.error('Error fetching developer stats:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch dashboard metrics.' },
      { status: 500 }
    );
  }
}
