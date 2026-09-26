import nodemailer from 'nodemailer';
import { getRawEmailSettings } from '@/lib/db/database';
import { extractDomain } from '@/lib/abuse/normalizers';

export interface EmailProviderConfig {
  provider: 'smtp' | 'resend' | 'sendgrid';
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPass: string;
  smtpSecure: boolean;
  senderEmail: string;
  senderName: string;
  isConfigured: boolean;
  source: 'database' | 'environment' | 'none';
}

/**
 * Safe logging helper that conforms strictly to security guidelines:
 * Logs: requestId, emailDomain, stage, status, error (sanitized), timestamp.
 * NEVER logs OTP, email passwords, SMTP credentials, or auth tokens.
 */
export function logOtpAudit(entry: {
  requestId: string;
  emailDomain?: string;
  stage: string;
  status: 'SUCCESS' | 'FAILURE' | 'INFO';
  error?: string;
  details?: string;
}) {
  const sanitizedError = entry.error
    ? entry.error.replace(/[a-zA-Z0-9_\-\.]{20,}/g, '[REDACTED_SECRET]')
    : undefined;

  const logPayload = {
    requestId: entry.requestId,
    domain: entry.emailDomain ? `@${entry.emailDomain}` : undefined,
    stage: entry.stage,
    status: entry.status,
    timestamp: new Date().toISOString(),
    ...(sanitizedError ? { error: sanitizedError } : {}),
    ...(entry.details ? { details: entry.details } : {}),
  };

  if (entry.status === 'FAILURE') {
    console.error(`[OTP_AUDIT] ${JSON.stringify(logPayload)}`);
  } else {
    console.log(`[OTP_AUDIT] ${JSON.stringify(logPayload)}`);
  }
}

/**
 * Resolves active email provider configuration.
 * Priority:
 * 1. Active database `email_settings` table record
 * 2. Environment variables (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, EMAIL_FROM)
 */
export function getEmailConfig(): EmailProviderConfig {
  // 1. Check database settings
  try {
    const dbSettings = getRawEmailSettings();
    if (
      dbSettings &&
      dbSettings.isActive &&
      dbSettings.smtpHost &&
      dbSettings.smtpUser &&
      dbSettings.rawPassword
    ) {
      return {
        provider: dbSettings.provider || 'smtp',
        smtpHost: dbSettings.smtpHost.trim(),
        smtpPort: Number(dbSettings.smtpPort) || 587,
        smtpUser: dbSettings.smtpUser.trim(),
        smtpPass: dbSettings.rawPassword,
        smtpSecure: Boolean(dbSettings.smtpSecure),
        senderEmail: dbSettings.senderEmail?.trim() || dbSettings.smtpUser.trim(),
        senderName: dbSettings.senderName?.trim() || 'Easyworks',
        isConfigured: true,
        source: 'database',
      };
    }
  } catch {
    // database might not be initialized yet, fallback to env
  }

  // 2. Check environment variables
  const host = process.env.SMTP_HOST || '';
  const user = process.env.SMTP_USER || process.env.SMTP_USERNAME || '';
  const pass = process.env.SMTP_PASS || process.env.SMTP_PASSWORD || process.env.EMAIL_PASSWORD || '';
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const secure = process.env.SMTP_SECURE === 'true' || port === 465;
  const senderEmail = process.env.EMAIL_FROM || process.env.SENDER_EMAIL || user;
  const senderName = process.env.EMAIL_FROM_NAME || process.env.SENDER_NAME || 'Easyworks';

  if (host && user && pass) {
    return {
      provider: 'smtp',
      smtpHost: host.trim(),
      smtpPort: port,
      smtpUser: user.trim(),
      smtpPass: pass,
      smtpSecure: secure,
      senderEmail: senderEmail.trim(),
      senderName: senderName.trim(),
      isConfigured: true,
      source: 'environment',
    };
  }

  return {
    provider: 'smtp',
    smtpHost: '',
    smtpPort: 587,
    smtpUser: '',
    smtpPass: '',
    smtpSecure: false,
    senderEmail: '',
    senderName: 'Easyworks',
    isConfigured: false,
    source: 'none',
  };
}

/**
 * Creates a configured Nodemailer transporter instance.
 */
export function createTransporter(config: EmailProviderConfig) {
  if (!config.isConfigured || !config.smtpHost) {
    throw new Error('Email provider is not configured. Missing SMTP host or credentials.');
  }

  return nodemailer.createTransport({
    host: config.smtpHost,
    port: config.smtpPort,
    secure: config.smtpSecure,
    auth: {
      user: config.smtpUser,
      pass: config.smtpPass,
    },
    // Reasonable timeouts to prevent request hanging
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  });
}

/**
 * Tests the email provider connection handshake.
 * Never leaks credentials in errors.
 */
export async function testEmailConnection(): Promise<{
  connected: boolean;
  error?: string;
  configSummary?: {
    host: string;
    port: number;
    user: string;
    sender: string;
    source: string;
  };
}> {
  const config = getEmailConfig();
  if (!config.isConfigured) {
    return {
      connected: false,
      error: 'SMTP credentials not configured. Please set SMTP_HOST, SMTP_USER, and SMTP_PASS or configure in Developer Settings.',
    };
  }

  try {
    const transporter = createTransporter(config);
    await transporter.verify();
    return {
      connected: true,
      configSummary: {
        host: config.smtpHost,
        port: config.smtpPort,
        user: config.smtpUser.replace(/(?<=^.).*(?=@)/, '***'),
        sender: config.senderEmail,
        source: config.source,
      },
    };
  } catch (err: any) {
    // Sanitize any potential secret leakage from error message
    const msg = (err?.message || 'SMTP connection failed')
      .replace(config.smtpPass, '[REDACTED]')
      .replace(/[a-zA-Z0-9_\-\.]{24,}/g, '[REDACTED_KEY]');
    return {
      connected: false,
      error: msg,
    };
  }
}

/**
 * Sends the official Easyworks 6-digit OTP verification email.
 * Matches exact subject and body requirements:
 *
 * Subject:
 * Easyworks — Your Verification Code
 *
 * Body:
 * Your Easyworks verification code is:
 * 
 * 123456
 * 
 * This code expires in 10 minutes.
 * 
 * If you did not request this code, you can safely ignore this email.
 * 
 * Easyworks
 */
export async function sendOtpEmail(
  toEmail: string,
  otp: string,
  requestId: string
): Promise<{ success: boolean; messageId?: string }> {
  const domain = extractDomain(toEmail);
  const config = getEmailConfig();

  logOtpAudit({
    requestId,
    emailDomain: domain,
    stage: 'EMAIL_PROVIDER_DISPATCH_ATTEMPT',
    status: 'INFO',
    details: `Target domain: @${domain}, Provider source: ${config.source}`,
  });

  if (!config.isConfigured) {
    const errorMsg = 'Production email provider is not configured. Missing SMTP host/credentials.';
    logOtpAudit({
      requestId,
      emailDomain: domain,
      stage: 'EMAIL_PROVIDER_DISPATCH',
      status: 'FAILURE',
      error: errorMsg,
    });
    const err: any = new Error(errorMsg);
    err.code = 'EMAIL_CONFIG_MISSING';
    throw err;
  }

  const transporter = createTransporter(config);

  const subject = 'Easyworks — Your Verification Code';

  // Exact required plain text body
  const textBody = `Your Easyworks verification code is:

${otp}

This code expires in 10 minutes.

If you did not request this code, you can safely ignore this email.

Easyworks`;

  // Clean, professional HTML body matching Easyworks brand design
  const htmlBody = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Easyworks Verification Code</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; color: #1e293b;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 520px; background-color: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
          <!-- Header -->
          <tr>
            <td style="background-color: #0f172a; padding: 28px 32px; text-align: left;">
              <table role="presentation" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="width: 36px; height: 36px; background-color: #2563eb; border-radius: 10px; text-align: center; vertical-align: middle; color: #ffffff; font-weight: bold; font-size: 16px;">
                    E
                  </td>
                  <td style="padding-left: 12px; color: #ffffff; font-size: 18px; font-weight: 700; letter-spacing: -0.02em;">
                    Easyworks
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Body Content -->
          <tr>
            <td style="padding: 36px 32px 28px 32px;">
              <p style="margin: 0 0 20px 0; font-size: 15px; line-height: 1.6; color: #334155;">
                Your Easyworks verification code is:
              </p>
              
              <div style="margin: 24px 0; text-align: center;">
                <span style="display: inline-block; font-family: 'SF Mono', Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace; font-size: 32px; font-weight: 700; letter-spacing: 8px; color: #0f172a; background-color: #f1f5f9; padding: 14px 28px; border-radius: 12px; border: 1px solid #cbd5e1;">
                  ${otp}
                </span>
              </div>

              <p style="margin: 24px 0 16px 0; font-size: 14px; line-height: 1.6; color: #475569;">
                This code expires in <strong>10 minutes</strong>.
              </p>

              <p style="margin: 0; font-size: 13px; line-height: 1.6; color: #64748b;">
                If you did not request this code, you can safely ignore this email.
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding: 20px 32px; background-color: #f8fafc; border-top: 1px solid #f1f5f9; font-size: 12px; color: #94a3b8; text-align: left;">
              <strong style="color: #64748b;">Easyworks</strong> &bull; Simple, professional quotations & invoices
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  try {
    const fromAddress = config.senderName
      ? `"${config.senderName}" <${config.senderEmail}>`
      : config.senderEmail;

    const info = await transporter.sendMail({
      from: fromAddress,
      to: toEmail,
      subject,
      text: textBody,
      html: htmlBody,
    });

    const isAccepted = Array.isArray(info.accepted) && info.accepted.length > 0;
    if (!isAccepted && !info.messageId) {
      throw new Error('Email provider rejected destination address.');
    }

    logOtpAudit({
      requestId,
      emailDomain: domain,
      stage: 'EMAIL_PROVIDER_DISPATCH',
      status: 'SUCCESS',
      details: `Accepted: ${JSON.stringify(info.accepted)}, messageId: ${info.messageId}`,
    });

    return { success: true, messageId: info.messageId };
  } catch (error: any) {
    const safeErrorMsg = (error.message || 'Email delivery failed')
      .replace(config.smtpPass, '[REDACTED]')
      .replace(/[a-zA-Z0-9_\-\.]{24,}/g, '[REDACTED_KEY]');

    logOtpAudit({
      requestId,
      emailDomain: domain,
      stage: 'EMAIL_PROVIDER_DISPATCH',
      status: 'FAILURE',
      error: safeErrorMsg,
    });

    const err: any = new Error(safeErrorMsg);
    err.code = 'EMAIL_SEND_FAILED';
    err.originalError = safeErrorMsg;
    throw err;
  }
}

/**
 * Sends a test email for Developer-only diagnostics.
 * Conforms to Requirement 9:
 * - Tests email provider connection
 * - Attempts to deliver test email
 * - Returns Connection: Connected/Failed, Email send: Accepted/Failed, Error message if failed
 * - NEVER leaks credentials or secrets.
 */
export async function sendDeveloperTestEmail(
  toEmail: string,
  requestId: string = 'req_test_' + Date.now().toString(36)
): Promise<{
  connection: 'Connected' | 'Failed';
  send: 'Accepted' | 'Failed';
  error?: string;
  messageId?: string;
  requestId: string;
}> {
  const domain = extractDomain(toEmail);
  const connCheck = await testEmailConnection();

  if (!connCheck.connected) {
    logOtpAudit({
      requestId,
      emailDomain: domain,
      stage: 'DEVELOPER_EMAIL_TEST_CONNECTION',
      status: 'FAILURE',
      error: connCheck.error || 'Connection failed',
    });
    return {
      connection: 'Failed',
      send: 'Failed',
      error: connCheck.error || 'SMTP Connection failed',
      requestId,
    };
  }

  const config = getEmailConfig();
  const transporter = createTransporter(config);

  try {
    const fromAddress = config.senderName
      ? `"${config.senderName}" <${config.senderEmail}>`
      : config.senderEmail;

    const info = await transporter.sendMail({
      from: fromAddress,
      to: toEmail,
      subject: 'Easyworks — Developer Test Email',
      text: `Hello from Easyworks,\n\nThis is a test email sent from the Easyworks Developer Panel.\nYour email provider is properly configured and successfully delivering messages.\n\nTimestamp: ${new Date().toISOString()}\nRequest ID: ${requestId}\n\nEasyworks`,
      html: `<div style="font-family: sans-serif; padding: 20px; color: #1e293b;">
        <h2 style="color: #2563eb;">Easyworks Email Delivery Test</h2>
        <p>This is a test email sent from the Easyworks Developer Panel.</p>
        <p style="color: #16a34a; font-weight: bold;">✔ Email provider is properly configured and accepting outbound mail.</p>
        <div style="font-size: 12px; color: #64748b; margin-top: 20px; border-top: 1px solid #e2e8f0; padding-top: 10px;">
          Timestamp: ${new Date().toISOString()}<br>
          Request ID: ${requestId}
        </div>
      </div>`,
    });

    const isAccepted = Array.isArray(info.accepted) && info.accepted.length > 0;
    if (!isAccepted && !info.messageId) {
      throw new Error('Email provider rejected recipient.');
    }

    logOtpAudit({
      requestId,
      emailDomain: domain,
      stage: 'DEVELOPER_EMAIL_TEST_SEND',
      status: 'SUCCESS',
      details: `Accepted: ${JSON.stringify(info.accepted)}, messageId: ${info.messageId}`,
    });

    return {
      connection: 'Connected',
      send: 'Accepted',
      messageId: info.messageId,
      requestId,
    };
  } catch (error: any) {
    const safeErrorMsg = (error.message || 'Failed to send test email')
      .replace(config.smtpPass, '[REDACTED]')
      .replace(/[a-zA-Z0-9_\-\.]{24,}/g, '[REDACTED_KEY]');

    logOtpAudit({
      requestId,
      emailDomain: domain,
      stage: 'DEVELOPER_EMAIL_TEST_SEND',
      status: 'FAILURE',
      error: safeErrorMsg,
    });

    return {
      connection: 'Connected',
      send: 'Failed',
      error: safeErrorMsg,
      requestId,
    };
  }
}
