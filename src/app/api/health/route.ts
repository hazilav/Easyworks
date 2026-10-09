import { NextResponse } from 'next/server';
import { getDatabaseDiagnostics } from '@/lib/db/database';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try {
    const dbDiag = getDatabaseDiagnostics();
    const isOk = dbDiag.status === 'connected';

    return NextResponse.json(
      {
        status: isOk ? 'UP' : 'DOWN',
        database: dbDiag.status,
        timestamp: new Date().toISOString(),
      },
      {
        status: isOk ? 200 : 503,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store',
        },
      }
    );
  } catch (err: any) {
    return NextResponse.json(
      {
        status: 'DOWN',
        error: err?.message || 'Health check error',
        timestamp: new Date().toISOString(),
      },
      {
        status: 503,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store',
        },
      }
    );
  }
}
