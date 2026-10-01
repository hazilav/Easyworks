import nodemailer from 'nodemailer';
import { getActiveEmailSettings, ActiveEmailSettings } from '@/lib/db/database';
import { extractDomain } from '@/lib/abuse/normalizers';

export interface EmailDiagnostics {
  source: 'DATABASE' | 'ENVIRONMENT' | 'NONE';
  smtpHostConfigured: boolean;
  smtpUserConfigured: boolean;
  smtpPasswordConfigured: boolean;
  senderConfigured: boolean;
}

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
  diagnostics: EmailDiagnostics;
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
 * 3. None (unconfigured)
 */
export function getEmailConfig(): EmailProviderConfig {
  // 1. Fetch active settings from SQLite database
  let settings: ActiveEmailSettings | null = null;
  try {
    settings = getActiveEmailSettings();
  } catch (err) {
    console.error('[emailService] Error loading active email_settings from database:', err);
  }

  // 2. Resolve credentials using priority: Database -> Environment
  const host = (settings?.smtp_host || settings?.smtpHost || process.env.SMTP_HOST || '').trim();
  const port = Number(settings?.smtp_port || settings?.smtpPort || process.env.SMTP_PORT) || 587;
  const user = (settings?.smtp_user || settings?.smtpUser || process.env.SMTP_USER || process.env.SMTP_USERNAME || '').trim();
  let pass = (settings?.smtp_pass || settings?.smtpPass || process.env.SMTP_PASS || process.env.SMTP_PASSWORD || '').trim();

  // If host or user is Gmail, automatically strip spaces from 16-character Google App Passwords
  if (
    (host.toLowerCase().includes('gmail') || user.toLowerCase().includes('@gmail.com')) &&
    /^[a-z]{4}\s+[a-z]{4}\s+[a-z]{4}\s+[a-z]{4}$/i.test(pass)
  ) {
    pass = pass.replace(/\s+/g, '');
  }

  const secure = settings?.smtp_secure ?? settings?.smtpSecure ?? (process.env.SMTP_SECURE === 'true' || port === 465);
  const from = (settings?.email_from || settings?.sender_email || settings?.senderEmail || process.env.EMAIL_FROM || process.env.SENDER_EMAIL || user).trim();
  const fromName = (settings?.email_from_name || settings?.sender_name || settings?.senderName || process.env.EMAIL_FROM_NAME || process.env.SENDER_NAME || 'Easyworks').trim();

  // Check which source provided credentials
  const hasDb = Boolean(settings && (settings.smtp_host || settings.smtpHost) && (settings.smtp_user || settings.smtpUser));
  const hasEnv = Boolean(process.env.SMTP_HOST && (process.env.SMTP_USER || process.env.SMTP_USERNAME));
  const source: 'DATABASE' | 'ENVIRONMENT' | 'NONE' = hasDb ? 'DATABASE' : hasEnv ? 'ENVIRONMENT' : 'NONE';

  const smtpHostConfigured = Boolean(host);
  const smtpUserConfigured = Boolean(user);
  const smtpPasswordConfigured = Boolean(pass);
  const senderConfigured = Boolean(from);
  const isConfigured = Boolean(host && user && pass);

  const diagnostics: EmailDiagnostics = {
    source,
    smtpHostConfigured,
    smtpUserConfigured,
    smtpPasswordConfigured,
    senderConfigured,
  };

  return {
    provider: (settings?.provider as any) || 'smtp',
    smtpHost: host,
    smtpPort: port,
    smtpUser: user,
    smtpPass: pass,
    smtpSecure: secure,
    senderEmail: from || user,
    senderName: fromName || 'Easyworks',
    isConfigured,
    source: (source.toLowerCase() as 'database' | 'environment' | 'none'),
    diagnostics,
  };
}

/**
 * Creates a configured Nodemailer transporter instance.
 */
export function createTransporter(config: EmailProviderConfig) {
  if (!config.isConfigured || !config.smtpHost || !config.smtpUser || !config.smtpPass) {
    const err: any = new Error('Email provider is not configured. Missing SMTP host or credentials.');
    err.code = 'EMAIL_CONFIG_MISSING';
    throw err;
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
  success: boolean;
  connected: boolean;
  connection: 'Connected' | 'Failed';
  status: 'success' | 'failed';
  error?: string;
  diagnostics?: EmailDiagnostics;
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
    const missing: string[] = [];
    if (!config.diagnostics.smtpHostConfigured) missing.push('SMTP_HOST');
    if (!config.diagnostics.smtpUserConfigured) missing.push('SMTP_USER');
    if (!config.diagnostics.smtpPasswordConfigured) missing.push('SMTP_PASS');

    return {
      success: false,
      connected: false,
      connection: 'Failed',
      status: 'failed',
      error: `SMTP credentials not configured. Missing: ${missing.join(', ')}. Please configure in Developer Settings or set environment variables.`,
      diagnostics: config.diagnostics,
    };
  }

  try {
    const transporter = createTransporter(config);
    await transporter.verify();
    return {
      success: true,
      connected: true,
      connection: 'Connected',
      status: 'success',
      diagnostics: config.diagnostics,
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
    let msg = err?.message || 'SMTP connection failed';
    if (config.smtpPass) {
      msg = msg.split(config.smtpPass).join('[REDACTED]');
    }
    msg = msg.replace(/[a-zA-Z0-9_\-\.]{24,}/g, '[REDACTED_KEY]');

    return {
      success: false,
      connected: false,
      connection: 'Failed',
      status: 'failed',
      error: msg,
      diagnostics: config.diagnostics,
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
  success: boolean;
  connection: 'Connected' | 'Failed';
  status: 'success' | 'failed';
  send: 'Accepted' | 'Failed';
  error?: string;
  messageId?: string;
  requestId: string;
  diagnostics?: EmailDiagnostics;
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
      success: false,
      connection: 'Failed',
      status: 'failed',
      send: 'Failed',
      error: connCheck.error || 'SMTP Connection failed',
      requestId,
      diagnostics: connCheck.diagnostics,
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
      success: true,
      connection: 'Connected',
      status: 'success',
      send: 'Accepted',
      messageId: info.messageId,
      requestId,
      diagnostics: connCheck.diagnostics,
    };
  } catch (error: any) {
    let safeErrorMsg = (error.message || 'Failed to send test email');
    if (config.smtpPass) {
      safeErrorMsg = safeErrorMsg.split(config.smtpPass).join('[REDACTED]');
    }
    safeErrorMsg = safeErrorMsg.replace(/[a-zA-Z0-9_\-\.]{24,}/g, '[REDACTED_KEY]');

    logOtpAudit({
      requestId,
      emailDomain: domain,
      stage: 'DEVELOPER_EMAIL_TEST_SEND',
      status: 'FAILURE',
      error: safeErrorMsg,
    });

    return {
      success: false,
      connection: 'Connected',
      status: 'success',
      send: 'Failed',
      error: safeErrorMsg,
      requestId,
      diagnostics: connCheck.diagnostics,
    };
  }
}
