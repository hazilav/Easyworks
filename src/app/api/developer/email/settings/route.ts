import { NextRequest, NextResponse } from 'next/server';
import {
  getEmailSettings,
  updateEmailSettings,
  verifyDeveloperSessionToken,
} from '@/lib/db/database';
import { safeReadBody, withApiRouteHandler } from '@/lib/api/server';
import { getEmailConfig } from '@/lib/email/emailService';

export const GET = withApiRouteHandler('GET /api/developer/email/settings', async (req: NextRequest) => {
  try {
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : '';

    if (!token || !verifyDeveloperSessionToken(token)) {
      return NextResponse.json(
        { success: false, error: 'UNAUTHORIZED', message: 'Super Admin clearance required.' },
        { status: 401 }
      );
    }

    const settings = getEmailSettings();
    const activeConfig = getEmailConfig();

    return NextResponse.json(
      {
        success: true,
        settings,
        activeConfig: {
          isConfigured: activeConfig.isConfigured,
          provider: activeConfig.provider,
          host: activeConfig.smtpHost || null,
          port: activeConfig.smtpPort || null,
          user: activeConfig.smtpUser ? activeConfig.smtpUser.replace(/(?<=^.).*(?=@)/, '***') : null,
          sender: activeConfig.senderEmail || null,
          source: activeConfig.source,
        },
      },
      { status: 200 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch email settings' },
      { status: 500 }
    );
  }
});

export const POST = withApiRouteHandler('POST /api/developer/email/settings', async (req: NextRequest) => {
  try {
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : '';

    if (!token || !verifyDeveloperSessionToken(token)) {
      return NextResponse.json(
        { success: false, error: 'UNAUTHORIZED', message: 'Super Admin clearance required.' },
        { status: 401 }
      );
    }

    const parsed = await safeReadBody(req);
    if (!parsed.success) {
      return parsed.response;
    }

    const body = parsed.body || {};
    const updated = updateEmailSettings({
      provider: body.provider || 'smtp',
      smtpHost: body.smtpHost,
      smtpPort: body.smtpPort ? Number(body.smtpPort) : 587,
      smtpUser: body.smtpUser,
      smtpPass: body.smtpPass,
      smtpSecure: Boolean(body.smtpSecure),
      senderEmail: body.senderEmail,
      senderName: body.senderName || 'Easyworks',
      isActive: body.isActive !== undefined ? Boolean(body.isActive) : true,
    });

    return NextResponse.json(
      {
        success: true,
        message: 'Email provider configuration saved successfully.',
        settings: updated,
      },
      { status: 200 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to save email settings' },
      { status: 500 }
    );
  }
});
