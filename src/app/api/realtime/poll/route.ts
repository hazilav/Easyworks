import { NextRequest } from 'next/server';
import { verifyDeveloperSessionToken, getRealtimeEvents } from '@/lib/db/database';
import { apiSuccess, apiError } from '@/lib/api/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const rawChannel = searchParams.get('channel') || 'customer';
    const userId = searchParams.get('userId');
    const since = searchParams.get('since') || undefined;
    const token = searchParams.get('token') || req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');

    let authorizedChannel: string;

    if (rawChannel === 'admin') {
      if (!token || !verifyDeveloperSessionToken(token)) {
        return apiError('Unauthorized admin access', 401);
      }
      authorizedChannel = 'admin';
    } else {
      if (!userId) {
        return apiError('User ID is required for customer channel', 400);
      }
      authorizedChannel = `customer:${userId}`;
    }

    const events = getRealtimeEvents(authorizedChannel, since, 50);

    return apiSuccess({
      channel: authorizedChannel,
      events,
      serverTime: new Date().toISOString(),
    });
  } catch (error: any) {
    return apiError(error.message || 'Failed to poll events', 500);
  }
}
