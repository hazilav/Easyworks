import { NextRequest } from 'next/server';
import { recordErrorLog } from '@/lib/db/database';
import { apiSuccess, apiError, safeReadBody } from '@/lib/api/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const parsed = await safeReadBody(req);
    if (!parsed.success) {
      return parsed.response;
    }

    const {
      requestId,
      message,
      stackTrace,
      route,
      userId,
      componentStack,
      userAgent,
    } = parsed.body || {};

    if (!message) {
      return apiError('Error message is required', 400);
    }

    const errorId = recordErrorLog({
      requestId: requestId || undefined,
      category: 'FRONTEND',
      severity: 'MEDIUM',
      route: route || '/client',
      message: String(message).slice(0, 500),
      stackTrace: stackTrace ? String(stackTrace).slice(0, 3000) : undefined,
      userId: userId || undefined,
      recoveryStatus: 'PENDING',
      metadata: {
        componentStack: componentStack ? String(componentStack).slice(0, 1500) : undefined,
        userAgent: userAgent ? String(userAgent).slice(0, 250) : undefined,
      },
    });

    return apiSuccess({
      received: true,
      errorId,
    });
  } catch (err: any) {
    return apiError(err.message || 'Failed to record telemetry', 500);
  }
}
