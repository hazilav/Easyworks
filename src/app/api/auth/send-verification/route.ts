import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';
import {
  createVerificationCode,
  checkRateLimit,
  isEmailRegistered,
} from '@/lib/db/database';
import { isDisposableEmail } from '@/lib/abuse/disposableEmails';
import { normalizeEmail, normalizePhone } from '@/lib/abuse/normalizers';
import { safeReadBody, withApiRouteHandler } from '@/lib/api/server';
import { sendOtpEmail, logOtpAudit, getEmailProviderConfig } from '@/lib/email/emailService';

export const POST = withApiRouteHandler('POST /api/auth/send-verification', async (req: NextRequest) => {
  const requestId = 'req_' + Date.now().toString(36) + '_' + crypto.randomBytes(4).toString('hex');
  let cleanTarget = '';

  try {
    const parsed = await safeReadBody(req);
    if (!parsed.success) {
      return parsed.response;
    }
    const body = parsed.body || {};
    const { target, signupSessionId } = body;
    const channel = (body.channel || 'EMAIL').toUpperCase();
    cleanTarget = String(target || '').trim();

    if (!cleanTarget) {
      logOtpAudit({
        requestId,
        stage: 'VALIDATE_REQUEST',
        status: 'FAILURE',
        error: 'Missing target email address',
      });
      return NextResponse.json(
        {
          success: false,
          error: 'BAD_REQUEST',
          message: 'Target email address is required.',
          requestId,
        },
        { status: 400 }
      );
    }

    if (channel !== 'EMAIL') {
      logOtpAudit({
        requestId,
        stage: 'VALIDATE_REQUEST',
        status: 'FAILURE',
        error: `Unsupported verification channel: ${channel}`,
      });
      return NextResponse.json(
        {
          success: false,
          error: 'BAD_REQUEST',
          message: 'Only EMAIL verification is supported. Mobile number verification has been removed.',
          requestId,
        },
        { status: 400 }
      );
    }

    // 1. Email format, duplication, and disposable checks
    const cleanEmail = cleanTarget.toLowerCase();
    const domain = cleanEmail.split('@')[1];

    // Format validation
    if (!cleanEmail.includes('@') || !domain || !domain.includes('.')) {
      return NextResponse.json(
        {
          success: false,
          error: 'INVALID_EMAIL_FORMAT',
          message: 'Please provide a valid email address.',
          requestId,
        },
        { status: 400 }
      );
    }

    if (isEmailRegistered(cleanEmail)) {
      logOtpAudit({
        requestId,
        emailDomain: domain,
        stage: 'CHECK_EXISTING_USER',
        status: 'FAILURE',
        details: 'Email already registered',
      });
      return NextResponse.json(
        {
          success: false,
          code: 'EMAIL_ALREADY_REGISTERED',
          error: 'EMAIL_ALREADY_REGISTERED',
          message: 'An account with this email already exists.',
          requestId,
        },
        { status: 400 }
      );
    }

    if (isDisposableEmail(cleanEmail)) {
      logOtpAudit({
        requestId,
        emailDomain: domain,
        stage: 'CHECK_DISPOSABLE',
        status: 'FAILURE',
        details: 'Disposable email rejected',
      });
      return NextResponse.json(
        {
          success: false,
          code: 'DISPOSABLE_EMAIL',
          error: 'DISPOSABLE_EMAIL',
          message: 'Disposable / temporary email addresses are not permitted. Please use a valid work or personal email.',
          requestId,
        },
        { status: 400 }
      );
    }

    const normalizedTarget = normalizeEmail(cleanEmail);

    // 2. Sliding window cooldown: 60-second cooldown between consecutive OTP requests for same target
    const cooldownCheck = checkRateLimit(`otp_cd_${normalizedTarget}`, 1, 60);
    if (!cooldownCheck.allowed) {
      logOtpAudit({
        requestId,
        emailDomain: domain,
        stage: 'COOLDOWN_CHECK',
        status: 'FAILURE',
        details: `Cooldown active: ${cooldownCheck.resetInSeconds}s remaining`,
      });
      return NextResponse.json(
        {
          success: false,
          code: 'RATE_LIMITED',
          error: 'RATE_LIMITED',
          message: `Please wait ${cooldownCheck.resetInSeconds || 60} seconds before requesting another verification code.`,
          resetInSeconds: cooldownCheck.resetInSeconds,
          requestId,
        },
        { status: 429 }
      );
    }

    // 3. Sliding window rate limit: Max 3 OTP requests per target per 10 minutes (600s)
    const rateCheck = checkRateLimit(`otp_req_${normalizedTarget}`, 3, 600);
    if (!rateCheck.allowed) {
      logOtpAudit({
        requestId,
        emailDomain: domain,
        stage: 'RATE_LIMIT_CHECK',
        status: 'FAILURE',
        details: 'Exceeded 3 requests in 10 minutes',
      });
      return NextResponse.json(
        {
          success: false,
          code: 'RATE_LIMITED',
          error: 'RATE_LIMITED',
          message: 'Maximum verification code requests exceeded for this email. Please try again after 10 minutes.',
          resetInSeconds: rateCheck.resetInSeconds,
          requestId,
        },
        { status: 429 }
      );
    }

    // 4. Resolve email provider configuration
    const emailConfig = getEmailProviderConfig();

    // Diagnostic Telemetry (Requirement 6)
    console.log(`[EMAIL_CONFIG_CHECK] ${JSON.stringify({
      requestId,
      source: emailConfig.diagnostics.source,
      smtpHostConfigured: emailConfig.diagnostics.smtpHostConfigured,
      smtpUserConfigured: emailConfig.diagnostics.smtpUserConfigured,
      smtpPasswordConfigured: emailConfig.diagnostics.smtpPasswordConfigured,
      senderConfigured: emailConfig.diagnostics.senderConfigured,
      isConfigured: emailConfig.isConfigured,
      databaseConfigurationId: emailConfig.databaseConfigurationId,
    })}`);

    if (!emailConfig.isConfigured) {
      // Audit Logging (Requirement 7)
      console.error(`[OTP_AUDIT] ${JSON.stringify({
        requestId,
        route: '/api/auth/send-verification',
        emailConfigLoaded: false,
        emailConfigSource: emailConfig.diagnostics.source,
        databaseConfigurationId: emailConfig.databaseConfigurationId,
        emailProviderResponseStatus: 'FAILED',
        errorCode: 'EMAIL_CONFIG_MISSING',
        error: 'Email service is not configured. Please configure SMTP credentials in Developer Settings or environment variables.',
        timestamp: new Date().toISOString(),
      })}`);

      // Strict Error Handling (Requirement 8)
      return NextResponse.json(
        {
          success: false,
          error: 'EMAIL_CONFIG_MISSING',
          message: 'Email service is not configured. Please configure SMTP credentials in Developer Settings or environment variables.',
          requestId,
        },
        { status: 502 }
      );
    }

    // 5. Generate verification OTP & store SHA-256 hash in database
    const { code, expiresAt, signupSessionId: sessionId } = createVerificationCode(
      normalizedTarget,
      channel,
      signupSessionId
    );

    logOtpAudit({
      requestId,
      emailDomain: domain,
      stage: 'GENERATE_AND_STORE_OTP',
      status: 'SUCCESS',
      details: 'Hashed OTP stored with 10-minute expiry',
    });

    // 6. Dispatch OTP through email provider (Only return success after provider accepts)
    console.log(`[OTP_AUDIT] ${JSON.stringify({
      requestId,
      route: '/api/auth/send-verification',
      emailConfigLoaded: true,
      emailConfigSource: emailConfig.diagnostics.source,
      databaseConfigurationId: emailConfig.databaseConfigurationId,
      emailProviderResponseStatus: 'PENDING',
      timestamp: new Date().toISOString(),
    })}`);

    let sendResult: { success: boolean; messageId?: string } | undefined;
    try {
      sendResult = await sendOtpEmail(normalizedTarget, code, requestId);
      console.log(`[OTP_AUDIT] ${JSON.stringify({
        requestId,
        route: '/api/auth/send-verification',
        emailConfigLoaded: true,
        emailConfigSource: emailConfig.diagnostics.source,
        databaseConfigurationId: emailConfig.databaseConfigurationId,
        emailProviderResponseStatus: 'ACCEPTED',
        messageId: sendResult?.messageId,
        timestamp: new Date().toISOString(),
      })}`);
    } catch (sendError: any) {
      const safeErrorMessage = (sendError.message || 'Email provider failed to deliver verification code.')
        .replace(/[a-zA-Z0-9_\-\.]{24,}/g, '[REDACTED]');

      console.error(`[OTP_AUDIT] ${JSON.stringify({
        requestId,
        route: '/api/auth/send-verification',
        emailConfigLoaded: true,
        emailConfigSource: emailConfig.diagnostics.source,
        databaseConfigurationId: emailConfig.databaseConfigurationId,
        emailProviderResponseStatus: 'FAILED',
        errorCode: sendError.code || 'EMAIL_SEND_FAILED',
        error: safeErrorMessage,
        timestamp: new Date().toISOString(),
      })}`);

      return NextResponse.json(
        {
          success: false,
          error: 'EMAIL_SEND_FAILED',
          message: safeErrorMessage,
          requestId,
        },
        { status: 502 }
      );
    }

    // 6. Return standard success response
    return NextResponse.json(
      {
        success: true,
        message: `Verification code sent to ${normalizedTarget}.`,
        signupSessionId: sessionId,
        expiresAt,
        requestId,
        // debugCode provided ONLY in non-production environments for automated testing
        ...(process.env.NODE_ENV !== 'production' ? { debugCode: code } : {}),
      },
      { status: 200 }
    );
  } catch (error: any) {
    const errorMsg = error?.message || 'Internal server error processing verification request.';
    logOtpAudit({
      requestId,
      stage: 'UNEXPECTED_EXCEPTION',
      status: 'FAILURE',
      error: errorMsg,
    });

    return NextResponse.json(
      {
        success: false,
        code: 'INTERNAL_SERVER_ERROR',
        error: 'INTERNAL_SERVER_ERROR',
        message: errorMsg,
        requestId,
      },
      { status: 500 }
    );
  }
});
