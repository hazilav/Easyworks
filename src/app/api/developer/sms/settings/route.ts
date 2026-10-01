import { NextRequest, NextResponse } from 'next/server';
import {
  getSmsSettings,
  updateSmsSettings,
  getActiveSmsSettings,
  verifyDeveloperSessionToken,
} from '@/lib/db/database';
import { safeReadBody, withApiRouteHandler } from '@/lib/api/server';
import { getSmsConfig } from '@/lib/sms/smsService';
import { SmsProviderType } from '@/types';

export const GET = withApiRouteHandler('GET /api/developer/sms/settings', async (req: NextRequest) => {
  try {
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : '';

    if (!token || !verifyDeveloperSessionToken(token)) {
      return NextResponse.json(
        { success: false, error: 'UNAUTHORIZED', message: 'Super Admin clearance required.' },
        { status: 401 }
      );
    }

    const settings = getSmsSettings();
    const activeConfig = getSmsConfig();

    return NextResponse.json(
      {
        success: true,
        settings,
        activeConfig: {
          isConfigured: activeConfig.isConfigured,
          provider: activeConfig.provider,
          apiUrl: activeConfig.apiUrl || null,
          accountSid: activeConfig.accountSid ? `${activeConfig.accountSid.substring(0, 4)}...` : null,
          senderId: activeConfig.senderId || null,
          source: activeConfig.source,
        },
        diagnostics: activeConfig.diagnostics,
      },
      { status: 200 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch SMS settings' },
      { status: 500 }
    );
  }
});

export const POST = withApiRouteHandler('POST /api/developer/sms/settings', async (req: NextRequest) => {
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
    const provider = (body.provider || 'twilio').toLowerCase() as SmsProviderType;

    // Validate provider specific required fields
    if (provider === 'twilio') {
      if (!body.accountSid || !String(body.accountSid).trim()) {
        return NextResponse.json(
          { success: false, error: 'Twilio Account SID is required.' },
          { status: 400 }
        );
      }
      if (!body.senderId || !String(body.senderId).trim()) {
        return NextResponse.json(
          { success: false, error: 'Twilio Sender ID (Phone Number or Messaging Service SID) is required.' },
          { status: 400 }
        );
      }
    } else if (provider === 'generic_rest') {
      if (!body.apiUrl || !String(body.apiUrl).trim()) {
        return NextResponse.json(
          { success: false, error: 'API URL is required for Generic REST provider.' },
          { status: 400 }
        );
      }
    }

    // Save to database & activate
    const updated = updateSmsSettings({
      provider,
      apiUrl: body.apiUrl,
      accountSid: body.accountSid,
      authToken: body.authToken,
      senderId: body.senderId || 'Easyworks',
      messageTemplate: body.messageTemplate,
      isActive: body.isActive !== undefined ? Boolean(body.isActive) : true,
    });

    const activeConfig = getSmsConfig();

    return NextResponse.json(
      {
        success: true,
        message: 'SMS provider settings saved successfully.',
        settings: updated,
        activeConfig: {
          isConfigured: activeConfig.isConfigured,
          provider: activeConfig.provider,
          apiUrl: activeConfig.apiUrl || null,
          accountSid: activeConfig.accountSid ? `${activeConfig.accountSid.substring(0, 4)}...` : null,
          senderId: activeConfig.senderId || null,
          source: activeConfig.source,
        },
        diagnostics: activeConfig.diagnostics,
      },
      { status: 200 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to save SMS settings' },
      { status: 500 }
    );
  }
});
