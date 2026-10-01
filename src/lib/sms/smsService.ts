import crypto from 'node:crypto';
import { ActiveSmsSettings, SmsDiagnostics, SmsProviderType } from '@/types';
import { getActiveSmsSettings } from '@/lib/db/database';

export interface SmsAuditLogEntry {
  requestId: string;
  phoneMasked?: string;
  stage: string;
  status: 'INFO' | 'SUCCESS' | 'FAILURE';
  provider?: string;
  details?: string;
  error?: string;
  timestamp?: string;
}

/**
 * Mask mobile numbers for audit logs (e.g., +919876543210 -> +91******3210)
 */
export function maskPhoneNumber(phone?: string): string {
  if (!phone) return '[EMPTY_PHONE]';
  const trimmed = phone.trim();
  if (trimmed.length <= 6) return '******';
  const prefix = trimmed.substring(0, 3);
  const suffix = trimmed.substring(trimmed.length - 4);
  return `${prefix}******${suffix}`;
}

/**
 * Safe structured SMS audit logging.
 * STRICT SECURITY: Never logs auth tokens, API secrets, or plaintext OTP codes.
 */
export function logSmsAudit(entry: SmsAuditLogEntry): void {
  const sanitized = {
    requestId: entry.requestId,
    phone: entry.phoneMasked,
    provider: entry.provider || 'unknown',
    stage: entry.stage,
    status: entry.status,
    timestamp: entry.timestamp || new Date().toISOString(),
    ...(entry.details ? { details: entry.details } : {}),
    ...(entry.error ? { error: entry.error } : {}),
  };
  console.log(`[SMS_AUDIT] ${JSON.stringify(sanitized)}`);
}

/**
 * Resolves active SMS configuration following priority:
 * 1. Active Database Settings (sms_settings table with is_active = 1)
 * 2. Environment Variables (TWILIO_*, MSG91_*, SMS_*)
 */
export function getSmsConfig(): {
  isConfigured: boolean;
  provider: SmsProviderType;
  apiUrl?: string;
  accountSid?: string;
  authToken?: string;
  senderId?: string;
  messageTemplate?: string;
  source: 'DATABASE' | 'ENVIRONMENT' | 'NONE';
  diagnostics: SmsDiagnostics;
} {
  const activeDb = getActiveSmsSettings();

  if (activeDb && activeDb.is_active) {
    const provider = activeDb.provider || 'twilio';
    const accountSid = activeDb.account_sid || activeDb.accountSid || '';
    const authToken = activeDb.auth_token || activeDb.rawAuthToken || activeDb.authToken || '';
    const senderId = activeDb.sender_id || activeDb.senderId || 'Easyworks';
    const apiUrl = activeDb.api_url || activeDb.apiUrl || '';
    const messageTemplate = activeDb.message_template || activeDb.messageTemplate || '';

    // Check if configured based on provider requirements
    let hasCreds = false;
    if (provider === 'twilio') {
      hasCreds = Boolean(accountSid && authToken && senderId);
    } else if (provider === 'msg91') {
      hasCreds = Boolean(authToken);
    } else if (provider === 'vonage') {
      hasCreds = Boolean(accountSid && authToken);
    } else if (provider === 'sns') {
      hasCreds = Boolean(accountSid && authToken);
    } else if (provider === 'generic_rest') {
      hasCreds = Boolean(apiUrl);
    } else if (provider === 'test') {
      hasCreds = true;
    }

    return {
      isConfigured: hasCreds,
      provider,
      apiUrl,
      accountSid,
      authToken,
      senderId,
      messageTemplate,
      source: 'DATABASE',
      diagnostics: {
        source: 'DATABASE',
        providerConfigured: Boolean(provider),
        apiCredentialsConfigured: Boolean(accountSid || authToken || (provider === 'generic_rest' && apiUrl)),
        senderConfigured: Boolean(senderId),
        providerName: provider.toUpperCase(),
      },
    };
  }

  // Fallback to Environment Variables
  const envProvider = (process.env.SMS_PROVIDER || 'twilio').toLowerCase() as SmsProviderType;
  const envAccountSid = process.env.TWILIO_ACCOUNT_SID || process.env.SMS_ACCOUNT_SID || process.env.SMS_KEY || '';
  const envAuthToken = process.env.TWILIO_AUTH_TOKEN || process.env.MSG91_AUTH_KEY || process.env.SMS_AUTH_TOKEN || process.env.SMS_SECRET || '';
  const envSenderId = process.env.TWILIO_FROM || process.env.MSG91_SENDER_ID || process.env.SMS_SENDER_ID || 'Easyworks';
  const envApiUrl = process.env.SMS_API_URL || '';
  const envTemplate = process.env.SMS_TEMPLATE || '';

  const hasEnvCreds = Boolean(envAuthToken || (envProvider === 'generic_rest' && envApiUrl) || envProvider === 'test');

  return {
    isConfigured: hasEnvCreds,
    provider: envProvider,
    apiUrl: envApiUrl,
    accountSid: envAccountSid,
    authToken: envAuthToken,
    senderId: envSenderId,
    messageTemplate: envTemplate,
    source: hasEnvCreds ? 'ENVIRONMENT' : 'NONE',
    diagnostics: {
      source: hasEnvCreds ? 'ENVIRONMENT' : 'NONE',
      providerConfigured: Boolean(envProvider),
      apiCredentialsConfigured: Boolean(envAccountSid || envAuthToken || (envProvider === 'generic_rest' && envApiUrl)),
      senderConfigured: Boolean(envSenderId),
      providerName: envProvider.toUpperCase(),
    },
  };
}

/**
 * Format OTP message according to exact system specification:
 * "Easyworks verification code: 123456\n\nThis code expires in 10 minutes. If you did not request this code, ignore this message."
 */
export function formatOtpSms(code: string, customTemplate?: string): string {
  if (customTemplate && customTemplate.includes('{{code}}')) {
    return customTemplate.replace(/\{\{code\}\}/g, code);
  }
  return `Easyworks verification code: ${code}\n\nThis code expires in 10 minutes. If you did not request this code, ignore this message.`;
}

/**
 * Internal driver for Twilio SMS
 */
async function sendViaTwilio(params: {
  accountSid: string;
  authToken: string;
  senderId: string;
  to: string;
  message: string;
  requestId: string;
}): Promise<{ success: boolean; messageId: string; details?: any }> {
  const url = `https://api.twilio.com/2010-04-01/Accounts/${params.accountSid}/Messages.json`;
  const body = new URLSearchParams();
  body.append('To', params.to);
  body.append('From', params.senderId);
  body.append('Body', params.message);

  const authHeader = 'Basic ' + Buffer.from(`${params.accountSid}:${params.authToken}`).toString('base64');

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: authHeader,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.message || `Twilio SMS dispatch failed with HTTP ${res.status}: ${JSON.stringify(data)}`);
  }

  return {
    success: true,
    messageId: data.sid || `tw_${Date.now()}`,
    details: { status: data.status, sid: data.sid },
  };
}

/**
 * Internal driver for MSG91 SMS (India)
 */
async function sendViaMsg91(params: {
  authToken: string;
  senderId: string;
  to: string;
  message: string;
  apiUrl?: string;
  requestId: string;
}): Promise<{ success: boolean; messageId: string; details?: any }> {
  const cleanMobile = params.to.replace(/[^\d]/g, '');
  const url = params.apiUrl || 'https://api.msg91.com/api/v2/sendsms';

  const payload = {
    sender: params.senderId || 'EZWRKS',
    route: '4',
    country: '91',
    sms: [
      {
        message: params.message,
        to: [cleanMobile],
      },
    ],
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      authkey: params.authToken,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || (data.type && data.type === 'error')) {
    throw new Error(data.message || `MSG91 SMS dispatch failed: ${JSON.stringify(data)}`);
  }

  return {
    success: true,
    messageId: data.request_id || data.message || `msg91_${Date.now()}`,
    details: data,
  };
}

/**
 * Internal driver for Vonage (Nexmo) SMS
 */
async function sendViaVonage(params: {
  accountSid: string;
  authToken: string;
  senderId: string;
  to: string;
  message: string;
  requestId: string;
}): Promise<{ success: boolean; messageId: string; details?: any }> {
  const url = 'https://rest.nexmo.com/sms/json';
  const cleanMobile = params.to.replace(/[^\d]/g, '');

  const payload = {
    api_key: params.accountSid,
    api_secret: params.authToken,
    to: cleanMobile,
    from: params.senderId || 'Easyworks',
    text: params.message,
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = await res.json().catch(() => ({}));
  const firstMsg = data.messages?.[0];
  if (!res.ok || (firstMsg && firstMsg.status !== '0')) {
    throw new Error(firstMsg?.['error-text'] || `Vonage SMS dispatch failed with status ${firstMsg?.status}`);
  }

  return {
    success: true,
    messageId: firstMsg?.['message-id'] || `von_${Date.now()}`,
    details: data,
  };
}

/**
 * Internal driver for Generic REST / Webhook
 */
async function sendViaGenericRest(params: {
  apiUrl: string;
  authToken?: string;
  senderId?: string;
  to: string;
  message: string;
  requestId: string;
}): Promise<{ success: boolean; messageId: string; details?: any }> {
  let targetUrl = params.apiUrl;
  targetUrl = targetUrl
    .replace(/\{\{phone\}\}/g, encodeURIComponent(params.to))
    .replace(/\{\{message\}\}/g, encodeURIComponent(params.message))
    .replace(/\{\{sender\}\}/g, encodeURIComponent(params.senderId || ''));

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (params.authToken) {
    headers['Authorization'] = `Bearer ${params.authToken}`;
    headers['x-api-key'] = params.authToken;
  }

  const res = await fetch(targetUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      to: params.to,
      message: params.message,
      sender: params.senderId,
      requestId: params.requestId,
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.message || `Custom SMS webhook responded with status ${res.status}`);
  }

  return {
    success: true,
    messageId: data.messageId || data.id || `rest_${Date.now()}`,
    details: data,
  };
}

/**
 * Internal driver for Automated Test Verification
 */
async function sendViaTestDriver(params: {
  to: string;
  message: string;
  requestId: string;
}): Promise<{ success: boolean; messageId: string; details?: any }> {
  const simulatedId = `test_sms_${crypto.randomBytes(6).toString('hex')}`;
  return {
    success: true,
    messageId: simulatedId,
    details: { simulated: true, recipient: params.to },
  };
}

/**
 * Core outbound SMS dispatch method.
 * Sends OTP or transactional SMS through configured SMS provider.
 * Throws SMS_CONFIG_MISSING if provider is not configured.
 */
export async function sendOtpSms(
  phoneNumber: string,
  otpCode: string,
  requestId: string
): Promise<{ success: boolean; messageId: string; provider: string }> {
  const config = getSmsConfig();

  logSmsAudit({
    requestId,
    phoneMasked: maskPhoneNumber(phoneNumber),
    stage: 'SMS_PROVIDER_DISPATCH_ATTEMPT',
    status: 'INFO',
    provider: config.provider,
    details: `Provider: ${config.provider}, Source: ${config.source}`,
  });

  if (!config.isConfigured) {
    const errorMsg = 'Production SMS provider is not configured. Please configure Twilio, MSG91, or custom SMS gateway in Developer Settings.';
    logSmsAudit({
      requestId,
      phoneMasked: maskPhoneNumber(phoneNumber),
      stage: 'SMS_PROVIDER_DISPATCH',
      status: 'FAILURE',
      provider: config.provider,
      error: errorMsg,
    });
    const err: any = new Error(errorMsg);
    err.code = 'SMS_CONFIG_MISSING';
    throw err;
  }

  const messageText = formatOtpSms(otpCode, config.messageTemplate);
  let dispatchResult: { success: boolean; messageId: string };

  try {
    switch (config.provider) {
      case 'twilio':
        dispatchResult = await sendViaTwilio({
          accountSid: config.accountSid!,
          authToken: config.authToken!,
          senderId: config.senderId || 'Easyworks',
          to: phoneNumber,
          message: messageText,
          requestId,
        });
        break;

      case 'msg91':
        dispatchResult = await sendViaMsg91({
          authToken: config.authToken!,
          senderId: config.senderId || 'EZWRKS',
          to: phoneNumber,
          message: messageText,
          apiUrl: config.apiUrl,
          requestId,
        });
        break;

      case 'vonage':
        dispatchResult = await sendViaVonage({
          accountSid: config.accountSid!,
          authToken: config.authToken!,
          senderId: config.senderId || 'Easyworks',
          to: phoneNumber,
          message: messageText,
          requestId,
        });
        break;

      case 'generic_rest':
        dispatchResult = await sendViaGenericRest({
          apiUrl: config.apiUrl!,
          authToken: config.authToken,
          senderId: config.senderId,
          to: phoneNumber,
          message: messageText,
          requestId,
        });
        break;

      case 'test':
        dispatchResult = await sendViaTestDriver({
          to: phoneNumber,
          message: messageText,
          requestId,
        });
        break;

      default:
        throw new Error(`Unsupported SMS provider: ${config.provider}`);
    }

    logSmsAudit({
      requestId,
      phoneMasked: maskPhoneNumber(phoneNumber),
      stage: 'SMS_PROVIDER_DISPATCH',
      status: 'SUCCESS',
      provider: config.provider,
      details: `Accepted by ${config.provider}, messageId: ${dispatchResult.messageId}`,
    });

    return {
      success: true,
      messageId: dispatchResult.messageId,
      provider: config.provider,
    };
  } catch (error: any) {
    logSmsAudit({
      requestId,
      phoneMasked: maskPhoneNumber(phoneNumber),
      stage: 'SMS_PROVIDER_DISPATCH',
      status: 'FAILURE',
      provider: config.provider,
      error: error.message || 'SMS provider delivery error',
    });
    throw error;
  }
}

/**
 * Verifies SMS provider connection and credentials without sending a message.
 */
export async function testSmsConnection(): Promise<{
  connected: boolean;
  status: 'SUCCESS' | 'FAILED';
  error?: string | null;
  provider: string;
  source: string;
  diagnostics: SmsDiagnostics;
}> {
  const config = getSmsConfig();

  if (!config.isConfigured) {
    return {
      connected: false,
      status: 'FAILED',
      error: 'SMS provider is not configured. Please set credentials in Developer Settings.',
      provider: config.provider,
      source: config.source,
      diagnostics: config.diagnostics,
    };
  }

  try {
    if (config.provider === 'twilio') {
      const url = `https://api.twilio.com/2010-04-01/Accounts/${config.accountSid}.json`;
      const authHeader = 'Basic ' + Buffer.from(`${config.accountSid}:${config.authToken}`).toString('base64');
      const res = await fetch(url, { headers: { Authorization: authHeader } });
      if (!res.ok) {
        throw new Error(`Twilio authentication failed with HTTP ${res.status}`);
      }
    } else if (config.provider === 'vonage') {
      const url = `https://rest.nexmo.com/account/get-balance?api_key=${config.accountSid}&api_secret=${config.authToken}`;
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`Vonage authentication failed with HTTP ${res.status}`);
      }
    } else if (config.provider === 'generic_rest') {
      if (!config.apiUrl) {
        throw new Error('API URL is required for Generic REST provider');
      }
    }

    return {
      connected: true,
      status: 'SUCCESS',
      provider: config.provider,
      source: config.source,
      diagnostics: {
        ...config.diagnostics,
        lastProviderResponse: 'ACCEPTED',
      },
    };
  } catch (err: any) {
    return {
      connected: false,
      status: 'FAILED',
      error: err.message || 'SMS provider connection check failed',
      provider: config.provider,
      source: config.source,
      diagnostics: {
        ...config.diagnostics,
        lastProviderResponse: 'FAILED',
        lastError: err.message,
      },
    };
  }
}

/**
 * Sends a live Developer Test SMS message to verify dispatch and delivery.
 */
export async function sendDeveloperTestSms(
  phoneNumber: string,
  messageText: string,
  requestId: string
): Promise<{
  success: boolean;
  status: 'ACCEPTED' | 'FAILED';
  messageId?: string;
  error?: string | null;
  provider: string;
  source: string;
  diagnostics: SmsDiagnostics;
}> {
  const config = getSmsConfig();

  if (!config.isConfigured) {
    return {
      success: false,
      status: 'FAILED',
      error: 'SMS provider is not configured. Please configure in Developer Settings.',
      provider: config.provider,
      source: config.source,
      diagnostics: config.diagnostics,
    };
  }

  try {
    let dispatchResult: { success: boolean; messageId: string };
    const textToSend = messageText || `Easyworks test SMS sent at ${new Date().toLocaleTimeString('en-IN')}`;

    switch (config.provider) {
      case 'twilio':
        dispatchResult = await sendViaTwilio({
          accountSid: config.accountSid!,
          authToken: config.authToken!,
          senderId: config.senderId || 'Easyworks',
          to: phoneNumber,
          message: textToSend,
          requestId,
        });
        break;

      case 'msg91':
        dispatchResult = await sendViaMsg91({
          authToken: config.authToken!,
          senderId: config.senderId || 'EZWRKS',
          to: phoneNumber,
          message: textToSend,
          apiUrl: config.apiUrl,
          requestId,
        });
        break;

      case 'vonage':
        dispatchResult = await sendViaVonage({
          accountSid: config.accountSid!,
          authToken: config.authToken!,
          senderId: config.senderId || 'Easyworks',
          to: phoneNumber,
          message: textToSend,
          requestId,
        });
        break;

      case 'generic_rest':
        dispatchResult = await sendViaGenericRest({
          apiUrl: config.apiUrl!,
          authToken: config.authToken,
          senderId: config.senderId,
          to: phoneNumber,
          message: textToSend,
          requestId,
        });
        break;

      case 'test':
        dispatchResult = await sendViaTestDriver({
          to: phoneNumber,
          message: textToSend,
          requestId,
        });
        break;

      default:
        throw new Error(`Unsupported SMS provider: ${config.provider}`);
    }

    logSmsAudit({
      requestId,
      phoneMasked: maskPhoneNumber(phoneNumber),
      stage: 'DEVELOPER_SMS_TEST_SEND',
      status: 'SUCCESS',
      provider: config.provider,
      details: `Accepted, messageId: ${dispatchResult.messageId}`,
    });

    return {
      success: true,
      status: 'ACCEPTED',
      messageId: dispatchResult.messageId,
      provider: config.provider,
      source: config.source,
      diagnostics: {
        ...config.diagnostics,
        lastProviderResponse: 'ACCEPTED',
      },
    };
  } catch (err: any) {
    logSmsAudit({
      requestId,
      phoneMasked: maskPhoneNumber(phoneNumber),
      stage: 'DEVELOPER_SMS_TEST_SEND',
      status: 'FAILURE',
      provider: config.provider,
      error: err.message,
    });

    return {
      success: false,
      status: 'FAILED',
      error: err.message || 'SMS test send failed',
      provider: config.provider,
      source: config.source,
      diagnostics: {
        ...config.diagnostics,
        lastProviderResponse: 'FAILED',
        lastError: err.message,
      },
    };
  }
}
