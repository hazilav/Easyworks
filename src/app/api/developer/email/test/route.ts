import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { verifyDeveloperSessionToken } from '@/lib/db/database';
import { safeReadBody, withApiRouteHandler } from '@/lib/api/server';
import {
  testEmailConnection,
  sendDeveloperTestEmail,
  getEmailProviderConfig,
  getEmailConfig,
} from '@/lib/email/emailService';

export const POST = withApiRouteHandler('POST /api/developer/email/test', async (req: NextRequest) => {
  const requestId = 'req_test_' + Date.now().toString(36) + '_' + crypto.randomBytes(4).toString('hex');

  try {
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : '';

    if (!token || !verifyDeveloperSessionToken(token)) {
      return NextResponse.json(
        {
          success: false,
          error: 'UNAUTHORIZED',
          message: 'Unauthorized. Super Admin clearance required.',
          requestId,
        },
        { status: 401 }
      );
    }

    const parsed = await safeReadBody(req);
    const body = parsed.success ? parsed.body || {} : {};
    const { testEmail, action = 'send' } = body;

    // 1. Connection-only check (Requirement 5 & 8)
    if (action === 'test_connection' || !testEmail) {
      const conn = await testEmailConnection();
      const config = getEmailProviderConfig();

      return NextResponse.json(
        {
          success: conn.connected,
          connection: conn.connected ? 'success' : 'failed',
          status: conn.connected ? 'Connected' : 'Failed',
          send: 'Not Attempted',
          error: conn.error || null,
          diagnostics: conn.diagnostics || config.diagnostics,
          configSummary: {
            isConfigured: config.isConfigured,
            provider: config.provider,
            host: config.smtpHost || null,
            port: config.smtpPort || null,
            user: config.smtpUser ? config.smtpUser.replace(/(?<=^.).*(?=@)/, '***') : null,
            sender: config.senderEmail || null,
            source: config.source,
            databaseConfigurationId: config.databaseConfigurationId || null,
          },
          requestId,
        },
        { status: 200 }
      );
    }

    // 2. Full delivery test (Requirement 6 & 8)
    const cleanEmail = String(testEmail).trim().toLowerCase();
    if (!cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      return NextResponse.json(
        {
          success: false,
          error: 'INVALID_TEST_EMAIL',
          message: 'Please provide a valid destination email for testing.',
          requestId,
        },
        { status: 400 }
      );
    }

    const result = await sendDeveloperTestEmail(cleanEmail, requestId);

    return NextResponse.json(
      {
        success: result.send === 'Accepted',
        connection: result.connection === 'Connected' ? 'success' : 'failed',
        status: result.connection,
        send: result.send,
        error: result.error || null,
        messageId: result.messageId || null,
        recipient: cleanEmail,
        diagnostics: result.diagnostics,
        requestId,
      },
      { status: 200 }
    );
  } catch (error: any) {
    const config = getEmailProviderConfig();
    return NextResponse.json(
      {
        success: false,
        connection: 'failed',
        status: 'Failed',
        send: 'Failed',
        error: error.message || 'Internal error executing email diagnostic.',
        diagnostics: config.diagnostics,
        requestId,
      },
      { status: 500 }
    );
  }
});
