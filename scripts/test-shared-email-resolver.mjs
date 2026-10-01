import assert from 'node:assert';
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import crypto from 'node:crypto';
import {
  getEmailProviderConfig,
  getEmailConfig,
  parseEmailAddress,
} from '../src/lib/email/emailService.js';
import {
  getActiveEmailSettings,
  updateEmailSettings,
  getDatabaseFilePath,
} from '../src/lib/db/database.js';

let passed = 0;
let failed = 0;

function it(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(err);
    failed++;
  }
}

async function itAsync(name, fn) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(err);
    failed++;
  }
}

console.log('\n--- Running Shared Email Resolver & Telemetry Verification ---');

// Backup existing email_settings row to guarantee we preserve production settings intact
const dbPath = getDatabaseFilePath();
const db = new DatabaseSync(dbPath);
const originalRow = db.prepare("SELECT * FROM email_settings WHERE id = 'default'").get();

try {
  // Test 1: Function contract & Alias
  it('getEmailProviderConfig and getEmailConfig are defined and return identical shapes', () => {
    assert.strictEqual(typeof getEmailProviderConfig, 'function');
    assert.strictEqual(typeof getEmailConfig, 'function');
    const config1 = getEmailProviderConfig();
    const config2 = getEmailConfig();
    assert.deepStrictEqual(config1, config2);
    assert.ok('diagnostics' in config1);
    assert.ok('source' in config1);
    assert.ok('isConfigured' in config1);
    assert.ok('smtpHostConfigured' in config1.diagnostics);
    assert.ok('smtpUserConfigured' in config1.diagnostics);
    assert.ok('smtpPasswordConfigured' in config1.diagnostics);
    assert.ok('senderConfigured' in config1.diagnostics);
  });

  // Test 2: RFC 5322 Email parser
  it('parseEmailAddress correctly parses formatted sender addresses without double wrapping', () => {
    const res1 = parseEmailAddress('Easyworks <billing@easyworks.in>');
    assert.strictEqual(res1.name, 'Easyworks');
    assert.strictEqual(res1.email, 'billing@easyworks.in');

    const res2 = parseEmailAddress('simple@easyworks.in');
    assert.strictEqual(res2.name, '');
    assert.strictEqual(res2.email, 'simple@easyworks.in');

    const res3 = parseEmailAddress('"Support Team" <support@easyworks.in>');
    assert.strictEqual(res3.name, 'Support Team');
    assert.strictEqual(res3.email, 'support@easyworks.in');
  });

  // Test 3: Database priority over environment variables
  it('Database configuration takes precedence over environment variables when active', () => {
    // Set dummy env variables
    process.env.SMTP_HOST = 'env.smtp.com';
    process.env.SMTP_USER = 'env_user@easyworks.in';
    process.env.SMTP_PASS = 'env_secret_123';

    // Set active DB record
    db.prepare(`
      INSERT INTO email_settings (
        id, provider, smtp_host, smtp_port, smtp_user, smtp_pass, smtp_secure,
        sender_email, sender_name, email_from, email_from_name, is_active, updated_at
      ) VALUES ('default', 'smtp', 'smtp.gmail.com', 587, 'admin@gmail.com', 'db_secret_pass', 0, 'admin@gmail.com', 'Easyworks Admin', 'admin@gmail.com', 'Easyworks Admin', 1, ?)
      ON CONFLICT(id) DO UPDATE SET
        smtp_host = excluded.smtp_host,
        smtp_user = excluded.smtp_user,
        smtp_pass = excluded.smtp_pass,
        is_active = 1,
        updated_at = excluded.updated_at
    `).run(new Date().toISOString());

    const config = getEmailProviderConfig();
    assert.strictEqual(config.source, 'database');
    assert.strictEqual(config.smtpHost, 'smtp.gmail.com');
    assert.strictEqual(config.smtpUser, 'admin@gmail.com');
    assert.strictEqual(config.isConfigured, true);
    assert.strictEqual(config.databaseConfigurationId, 'default');
    assert.strictEqual(config.diagnostics.source, 'DATABASE');
  });

  // Test 4: Space stripping from Google App Passwords
  it('Automatically strips spaces from 16-character Google App Passwords', () => {
    db.prepare(`
      UPDATE email_settings SET 
        smtp_host = 'smtp.gmail.com',
        smtp_user = 'test@gmail.com',
        smtp_pass = 'abcd efgh ijkl mnop',
        is_active = 1
      WHERE id = 'default'
    `).run();

    const config = getEmailProviderConfig();
    assert.strictEqual(config.smtpPass, 'abcdefghijklmnop');
  });

  // Test 5: Fallback to environment variables when database is unconfigured
  it('Falls back to environment variables when database settings are inactive or empty', () => {
    db.prepare(`
      UPDATE email_settings SET 
        is_active = 0,
        smtp_host = '',
        smtp_user = '',
        smtp_pass = ''
      WHERE id = 'default'
    `).run();

    process.env.SMTP_HOST = 'smtp.sendgrid.net';
    process.env.SMTP_PORT = '587';
    process.env.SMTP_USER = 'apikey';
    process.env.SMTP_PASS = 'SG.123456789';
    process.env.EMAIL_FROM = 'no-reply@easyworks.in';

    const config = getEmailProviderConfig();
    assert.strictEqual(config.source, 'environment');
    assert.strictEqual(config.smtpHost, 'smtp.sendgrid.net');
    assert.strictEqual(config.smtpUser, 'apikey');
    assert.strictEqual(config.isConfigured, true);
    assert.strictEqual(config.diagnostics.source, 'ENVIRONMENT');
  });

  // Test 6: Unconfigured state when neither DB nor ENV is set
  it('Returns unconfigured (source: none, isConfigured: false) when no credentials exist', () => {
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_USER;
    delete process.env.SMTP_USERNAME;
    delete process.env.SMTP_PASS;
    delete process.env.SMTP_PASSWORD;

    db.prepare(`
      UPDATE email_settings SET 
        is_active = 0,
        smtp_host = '',
        smtp_user = '',
        smtp_pass = ''
      WHERE id = 'default'
    `).run();

    const config = getEmailProviderConfig();
    assert.strictEqual(config.source, 'none');
    assert.strictEqual(config.isConfigured, false);
    assert.strictEqual(config.diagnostics.source, 'NONE');
    assert.strictEqual(config.diagnostics.smtpHostConfigured, false);
    assert.strictEqual(config.diagnostics.smtpUserConfigured, false);
    assert.strictEqual(config.diagnostics.smtpPasswordConfigured, false);
  });

  // Test 7: HTTP 502 EMAIL_CONFIG_MISSING on /api/auth/send-verification when unconfigured
  await itAsync('/api/auth/send-verification returns HTTP 502 with EMAIL_CONFIG_MISSING when unconfigured', async () => {
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;

    db.prepare(`
      UPDATE email_settings SET 
        is_active = 0,
        smtp_host = '',
        smtp_user = '',
        smtp_pass = ''
      WHERE id = 'default'
    `).run();

    // Dynamically import route
    const { POST } = await import('../src/app/api/auth/send-verification/route.js');
    const req = new Request('http://localhost:3000/api/auth/send-verification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target: 'customer_test_' + Date.now() + '@example.com', channel: 'EMAIL' }),
    });

    const res = await POST(req);
    const body = await res.json();

    assert.strictEqual(res.status, 502);
    assert.strictEqual(body.success, false);
    assert.strictEqual(body.error, 'EMAIL_CONFIG_MISSING');
    assert.ok(body.message.includes('Email service is not configured'));
    assert.ok(body.requestId);
  });

  // Test 8: Safe telemetry & absence of password in logs
  it('Ensures diagnostic telemetry NEVER logs raw passwords or secrets', () => {
    const config = getEmailProviderConfig();
    const str = JSON.stringify(config.diagnostics);
    assert.strictEqual(str.includes('secret'), false);
    assert.strictEqual(str.includes('pass'), false);
  });

  function getDevToken() {
    const admin = db.prepare("SELECT id, email FROM users WHERE role = 'SUPER_ADMIN'").get();
    if (!admin) return '';
    const timestamp = Date.now();
    const secret = process.env.DEVELOPER_SESSION_SECRET || 'easyworks_super_admin_sec_2026';
    const sig = crypto.createHmac('sha256', secret).update(`${admin.id}:${admin.email}:${timestamp}`).digest('hex');
    return Buffer.from(`${admin.id}:${admin.email}:${timestamp}:${sig}`).toString('base64');
  }

  // Test 9: Developer Settings GET includes databaseConfigurationId
  await itAsync('Developer Email Settings GET returns databaseConfigurationId and activeConfig', async () => {
    const { GET } = await import('../src/app/api/developer/email/settings/route.js');
    const devToken = getDevToken();

    const req = new Request('http://localhost:3000/api/developer/email/settings', {
      method: 'GET',
      headers: { Authorization: `Bearer ${devToken}` },
    });

    const res = await GET(req);
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.ok('activeConfig' in body);
    assert.ok('diagnostics' in body);
    assert.ok('databaseConfigurationId' in body.activeConfig);
  });

  // Test 10: Developer Email Test Connection includes databaseConfigurationId
  await itAsync('Developer Email Test Connection returns databaseConfigurationId and activeConfig', async () => {
    const { POST } = await import('../src/app/api/developer/email/test/route.js');
    const devToken = getDevToken();

    const req = new Request('http://localhost:3000/api/developer/email/test', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${devToken}`,
      },
      body: JSON.stringify({ action: 'test_connection' }),
    });

    const res = await POST(req);
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.ok('configSummary' in body);
    assert.ok('databaseConfigurationId' in body.configSummary);
  });

  // Test 11: Live OTP dispatch with Ethereal SMTP & complete signup flow
  await itAsync('Configuring active SMTP credentials enables signup OTP send and completes 7-day trial activation', async () => {
    // Generate ephemeral Ethereal account
    const nodemailer = (await import('nodemailer')).default;
    const testAccount = await nodemailer.createTestAccount();

    db.prepare(`
      INSERT INTO email_settings (
        id, provider, smtp_host, smtp_port, smtp_user, smtp_pass, smtp_secure,
        sender_email, sender_name, email_from, email_from_name, is_active, updated_at
      ) VALUES ('default', 'smtp', ?, ?, ?, ?, 0, ?, 'Easyworks Test', ?, 'Easyworks Test', 1, ?)
      ON CONFLICT(id) DO UPDATE SET
        smtp_host = excluded.smtp_host,
        smtp_port = excluded.smtp_port,
        smtp_user = excluded.smtp_user,
        smtp_pass = excluded.smtp_pass,
        sender_email = excluded.sender_email,
        is_active = 1,
        updated_at = excluded.updated_at
    `).run(
      testAccount.smtp.host,
      testAccount.smtp.port,
      testAccount.user,
      testAccount.pass,
      testAccount.user,
      testAccount.user,
      new Date().toISOString()
    );

    // Verify resolver sees database active settings
    const activeConfig = getEmailProviderConfig();
    assert.strictEqual(activeConfig.source, 'database');
    assert.strictEqual(activeConfig.isConfigured, true);
    assert.strictEqual(activeConfig.databaseConfigurationId, 'default');

    // Test send-verification route
    const { POST: sendVerification } = await import('../src/app/api/auth/send-verification/route.js');
    const customerEmail = 'customer_' + Date.now() + '@example.com';
    const sendReq = new Request('http://localhost:3000/api/auth/send-verification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target: customerEmail, channel: 'EMAIL' }),
    });

    const sendRes = await sendVerification(sendReq);
    assert.strictEqual(sendRes.status, 200);
    const sendBody = await sendRes.json();
    assert.strictEqual(sendBody.success, true);
    assert.ok(sendBody.signupSessionId);
    assert.ok(sendBody.debugCode, 'Debug code returned in non-production mode');

    // Test verify-code route
    const { POST: verifyCode } = await import('../src/app/api/auth/verify-code/route.js');
    const verifyReq = new Request('http://localhost:3000/api/auth/verify-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        target: customerEmail,
        code: sendBody.debugCode,
        channel: 'EMAIL',
        signupSessionId: sendBody.signupSessionId,
        name: 'New Customer',
        businessName: 'Acme Test Corp',
      }),
    });

    const verifyRes = await verifyCode(verifyReq);
    assert.strictEqual(verifyRes.status, 200);
    const verifyBody = await verifyRes.json();
    assert.strictEqual(verifyBody.success, true);
    assert.strictEqual(verifyBody.user.email, customerEmail);
    assert.strictEqual(verifyBody.user.status, 'ACTIVE');
    assert.strictEqual(verifyBody.subscription.status, 'TRIALING');
    assert.strictEqual(verifyBody.subscription.pdfDownloadLimit, 2);

    // Clean up created customer records
    const createdUserId = verifyBody.user.id;
    db.prepare('DELETE FROM trial_identities WHERE user_id = ?').run(createdUserId);
    db.prepare('DELETE FROM subscriptions WHERE user_id = ?').run(createdUserId);
    db.prepare('DELETE FROM businesses WHERE user_id = ?').run(createdUserId);
    db.prepare('DELETE FROM users WHERE id = ?').run(createdUserId);
    db.prepare('DELETE FROM verification_codes WHERE target = ?').run(customerEmail.toLowerCase());
  });

} finally {
  // RESTORE ORIGINAL DATABASE ROW
  if (originalRow) {
    db.prepare(`
      INSERT INTO email_settings (
        id, provider, smtp_host, smtp_port, smtp_user, smtp_pass, smtp_secure,
        sender_email, sender_name, email_from, email_from_name, is_active, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        provider = excluded.provider,
        smtp_host = excluded.smtp_host,
        smtp_port = excluded.smtp_port,
        smtp_user = excluded.smtp_user,
        smtp_pass = excluded.smtp_pass,
        smtp_secure = excluded.smtp_secure,
        sender_email = excluded.sender_email,
        sender_name = excluded.sender_name,
        email_from = excluded.email_from,
        email_from_name = excluded.email_from_name,
        is_active = excluded.is_active,
        updated_at = excluded.updated_at
    `).run(
      originalRow.id,
      originalRow.provider,
      originalRow.smtp_host,
      originalRow.smtp_port,
      originalRow.smtp_user,
      originalRow.smtp_pass,
      originalRow.smtp_secure,
      originalRow.sender_email,
      originalRow.sender_name,
      originalRow.email_from,
      originalRow.email_from_name,
      originalRow.is_active,
      originalRow.updated_at
    );
    console.log('\n[Cleanup] Successfully restored original email_settings database row.');
  }
}

console.log(`\nResults: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exit(1);
}
