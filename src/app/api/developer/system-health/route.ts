import { NextRequest } from 'next/server';
import { apiSuccess, apiError, withApiRouteHandler } from '@/lib/api/server';
import { getDatabaseDiagnostics } from '@/lib/db/database';

export const dynamic = 'force-dynamic';

export const GET = withApiRouteHandler('GET /api/developer/system-health', async (req: NextRequest) => {
  try {
    const dbDiag = getDatabaseDiagnostics();

    return apiSuccess({
      environment: process.env.NODE_ENV || 'development',
      build: 'Next.js App Router (Turbopack)',
      commit: '9de9e7a',
      database: dbDiag.status,
      databasePath: dbDiag.databaseName,
      ...(dbDiag.error ? { databaseError: dbDiag.error } : {}),
      timestamp: new Date().toISOString(),
      serverUptime: Math.floor(process.uptime()),
      nodeVersion: process.version,
    });
  } catch (err: any) {
    return apiError(err?.message || 'Failed to check system health', 500, 'HEALTH_CHECK_FAILED');
  }
});
