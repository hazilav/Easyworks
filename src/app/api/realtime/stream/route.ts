import { NextRequest } from 'next/server';
import crypto from 'node:crypto';
import { verifyDeveloperSessionToken } from '@/lib/db/database';
import { eventBus } from '@/lib/realtime/eventBus';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const rawChannel = searchParams.get('channel') || 'customer';
  const userId = searchParams.get('userId');
  const token = searchParams.get('token') || req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');

  let authorizedChannel: string;

  if (rawChannel === 'admin') {
    // Strict developer verification
    if (!token || !verifyDeveloperSessionToken(token)) {
      return new Response(JSON.stringify({ error: 'Unauthorized admin channel access' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    authorizedChannel = 'admin';
  } else {
    // Customer channel: strictly scoped to the customer's userId
    if (!userId) {
      return new Response(JSON.stringify({ error: 'User ID is required for customer channel' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    authorizedChannel = `customer:${userId}`;
  }

  const clientId = `client_${crypto.randomBytes(8).toString('hex')}`;
  const textEncoder = new TextEncoder();
  let cleanupSubscriber: (() => void) | null = null;

  const stream = new ReadableStream({
    start(controller) {
      cleanupSubscriber = eventBus.subscribe(clientId, authorizedChannel, controller, userId || undefined);

      // Send initial connection handshake
      const initialPayload = JSON.stringify({
        status: 'CONNECTED',
        clientId,
        channel: authorizedChannel,
        serverTime: new Date().toISOString(),
      });
      controller.enqueue(textEncoder.encode(`id: init_${Date.now()}\nevent: CONNECTED\ndata: ${initialPayload}\n\n`));
    },
    cancel() {
      if (cleanupSubscriber) {
        cleanupSubscriber();
      } else {
        eventBus.unsubscribe(clientId);
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
