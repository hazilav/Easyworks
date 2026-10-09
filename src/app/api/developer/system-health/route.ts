import { NextRequest } from 'next/server';
import { apiSuccess, apiError, withApiRouteHandler } from '@/lib/api/server';
import {
  getDatabaseDiagnostics,
  performDatabaseIntegrityCheck,
  getActiveEmailSettings,
  getErrorStats,
  verifyDeveloperSessionToken,
} from '@/lib/db/database';
import { eventBus } from '@/lib/realtime/eventBus';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const GET = withApiRouteHandler('GET /api/developer/system-health', async (req: NextRequest) => {
  try {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get('token') || req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');

    // Optional check: if token is supplied, verify it
    const isAuthenticatedAdmin = token ? verifyDeveloperSessionToken(token) : false;

    const dbDiag = getDatabaseDiagnostics();
    const dbIntegrity = performDatabaseIntegrityCheck();
    const emailSettings = getActiveEmailSettings();
    const errorStats = getErrorStats();
    const realtimeMetrics = eventBus.getMetrics();

    const isDbHealthy = dbDiag.status === 'connected' && dbIntegrity.ok;
    const isEmailConfigured = Boolean(emailSettings && emailSettings.smtpHost && emailSettings.smtpUser);
    const hasCriticalErrors = errorStats.criticalCount > 0;

    let overallStatus: 'HEALTHY' | 'DEGRADED' | 'FAILED' = 'HEALTHY';
    if (!isDbHealthy) {
      overallStatus = 'FAILED';
    } else if (!isEmailConfigured || hasCriticalErrors) {
      overallStatus = 'DEGRADED';
    }

    return apiSuccess({
      status: overallStatus,
      environment: process.env.NODE_ENV || 'production',
      build: 'Next.js 16 (App Router + Turbopack)',
      commit: '9de9e7a',
      serverUptime: Math.floor(process.uptime()),
      nodeVersion: process.version,
      timestamp: new Date().toISOString(),
      database: {
        status: dbDiag.status,
        databasePath: dbDiag.databaseName,
        integrity: dbIntegrity.integrity,
        ok: dbIntegrity.ok,
        databaseSizeBytes: dbIntegrity.databaseSizeBytes,
        tableCounts: dbIntegrity.tableCounts,
        walMode: true,
      },
      email: {
        configured: isEmailConfigured,
        provider: isEmailConfigured ? 'SMTP' : 'NONE',
        host: emailSettings?.smtpHost || null,
        port: emailSettings?.smtpPort || null,
        senderEmail: emailSettings?.senderEmail || emailSettings?.smtpUser || null,
        secure: emailSettings?.smtpSecure ?? false,
      },
      realtime: {
        status: 'ACTIVE',
        transport: 'SSE + Polling Fallback',
        ...realtimeMetrics,
      },
      errors: {
        totalUnresolved: errorStats.totalUnresolved,
        criticalCount: errorStats.criticalCount,
        highCount: errorStats.highCount,
        last24hCount: errorStats.last24hCount,
        categories: errorStats.categories,
      },
      memory: {
        rssMB: Math.round(process.memoryUsage().rss / (1024 * 1024)),
        heapUsedMB: Math.round(process.memoryUsage().heapUsed / (1024 * 1024)),
        heapTotalMB: Math.round(process.memoryUsage().heapTotal / (1024 * 1024)),
      },
      isAuthenticatedAdmin,
    });
  } catch (err: any) {
    return apiError(err?.message || 'Failed to check system health', 500, 'HEALTH_CHECK_FAILED');
  }
});
