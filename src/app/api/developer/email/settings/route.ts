import { NextRequest, NextResponse } from 'next/server';
import {
  getEmailSettings,
  updateEmailSettings,
  getActiveEmailSettings,
  verifyDeveloperSessionToken,
} from '@/lib/db/database';
import { safeReadBody, withApiRouteHandler } from '@/lib/api/server';
import { getEmailProviderConfig, getEmailConfig } from '@/lib/email/emailService';

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
    const activeConfig = getEmailProviderConfig();

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
          databaseConfigurationId: activeConfig.databaseConfigurationId || null,
        },
        diagnostics: activeConfig.diagnostics,
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

    // Validate required fields (Requirement 4)
    if (!body.smtpHost || !String(body.smtpHost).trim()) {
      return NextResponse.json(
        { success: false, error: 'SMTP Host is required.' },
        { status: 400 }
      );
    }
    if (!body.smtpUser || !String(body.smtpUser).trim()) {
      return NextResponse.json(
        { success: false, error: 'SMTP Username is required.' },
        { status: 400 }
      );
    }

    // Save to database & activate
    const updated = updateEmailSettings({
      provider: body.provider || 'smtp',
      smtpHost: body.smtpHost,
      smtpPort: body.smtpPort ? Number(body.smtpPort) : 587,
      smtpUser: body.smtpUser,
      smtpPass: body.smtpPass,
      smtpSecure: Boolean(body.smtpSecure),
      senderEmail: body.senderEmail || body.smtpUser,
      senderName: body.senderName || 'Easyworks',
      isActive: true,
    });

    // Reload configuration from database & confirm internally that host, user, and pass exist
    const reloaded = getActiveEmailSettings();
    if (!reloaded || !reloaded.smtp_host || !reloaded.smtp_user || !reloaded.smtp_pass) {
      return NextResponse.json(
        {
          success: false,
          error: 'CONFIG_INCOMPLETE',
          message: 'Saved configuration is incomplete. Please ensure SMTP Host, User, and Password are provided.',
        },
        { status: 400 }
      );
    }

    const activeConfig = getEmailProviderConfig();

    return NextResponse.json(
      {
        success: true,
        message: 'Email provider configuration saved successfully.',
        settings: updated,
        activeConfig: {
          isConfigured: activeConfig.isConfigured,
          provider: activeConfig.provider,
          host: activeConfig.smtpHost || null,
          port: activeConfig.smtpPort || null,
          user: activeConfig.smtpUser ? activeConfig.smtpUser.replace(/(?<=^.).*(?=@)/, '***') : null,
          sender: activeConfig.senderEmail || null,
          source: activeConfig.source,
          databaseConfigurationId: activeConfig.databaseConfigurationId || null,
        },
        diagnostics: activeConfig.diagnostics,
      },
      { status: 200 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to save email settings' },
      { status: 400 }
    );
  }
});
