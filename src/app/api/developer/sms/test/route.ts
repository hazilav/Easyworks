import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { verifyDeveloperSessionToken } from '@/lib/db/database';
import { safeReadBody, withApiRouteHandler } from '@/lib/api/server';
import {
  testSmsConnection,
  sendDeveloperTestSms,
  getSmsConfig,
} from '@/lib/sms/smsService';
import { normalizePhone, isValidIndianMobile } from '@/lib/abuse/normalizers';

export const POST = withApiRouteHandler('POST /api/developer/sms/test', async (req: NextRequest) => {
  const requestId = 'req_smstest_' + Date.now().toString(36) + '_' + crypto.randomBytes(4).toString('hex');

  try {
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : '';

    if (!token || !verifyDeveloperSessionToken(token)) {
      return NextResponse.json(
        {
          success: false,
          error: 'UNAUTHORIZED',
          message: 'Super Admin clearance required.',
          requestId,
        },
        { status: 401 }
      );
    }

    const parsed = await safeReadBody(req);
    const body = parsed.success ? parsed.body || {} : {};
    const { testPhone, message, action = 'send' } = body;

    const config = getSmsConfig();

    // 1. Connection-only check
    if (action === 'test_connection' || !testPhone) {
      const conn = await testSmsConnection();

      return NextResponse.json(
        {
          success: conn.connected,
          configured: config.isConfigured ? 'YES' : 'NO',
          connection: conn.connected ? 'SUCCESS' : 'FAILED',
          send: 'NOT_ATTEMPTED',
          error: conn.error || null,
          diagnostics: conn.diagnostics || config.diagnostics,
          provider: config.provider.toUpperCase(),
          source: config.source,
          requestId,
        },
        { status: 200 }
      );
    }

    // 2. Normalize and validate Indian mobile number
    const normalizedPhone = normalizePhone(String(testPhone).trim());
    if (!isValidIndianMobile(normalizedPhone)) {
      return NextResponse.json(
        {
          success: false,
          error: 'INVALID_PHONE_NUMBER',
          message: 'Please enter a valid 10-digit Indian mobile number (e.g. 9876543210 or +91 98765 43210).',
          requestId,
        },
        { status: 400 }
      );
    }

    // 3. Dispatch Live Test SMS
    const testText = message || `Easyworks test SMS sent at ${new Date().toLocaleTimeString('en-IN')}`;
    const result = await sendDeveloperTestSms(normalizedPhone, testText, requestId);

    return NextResponse.json(
      {
        success: result.success,
        configured: config.isConfigured ? 'YES' : 'NO',
        connection: result.success ? 'SUCCESS' : 'FAILED',
        send: result.status,
        messageId: result.messageId || null,
        error: result.error || null,
        recipient: normalizedPhone.replace(/(\+91)\d{6}(\d{4})/, '$1******$2'),
        diagnostics: result.diagnostics,
        provider: config.provider.toUpperCase(),
        source: config.source,
        requestId,
      },
      { status: 200 }
    );
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to execute SMS test',
        requestId,
      },
      { status: 500 }
    );
  }
});
