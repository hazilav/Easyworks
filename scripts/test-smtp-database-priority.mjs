import nodemailer from 'nodemailer';
import {
  getDatabase,
  getActiveEmailSettings,
  getRawEmailSettings,
  getEmailSettings,
  updateEmailSettings,
} from '../src/lib/db/database.ts';
import {
  getEmailConfig,
  testEmailConnection,
  sendDeveloperTestEmail,
  sendOtpEmail,
} from '../src/lib/email/emailService.ts';

const db = getDatabase();

async function runTests() {
  console.log('====================================================================');
  console.log('EASYWORKS — SMTP DATABASE SETTINGS PRIORITY & DIAGNOSTICS TEST SUITE');
  console.log('====================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✔ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      failed++;
    }
  }

  // --------------------------------------------------------------------------
  // TEST 1: Table schema verification (Requirement 1)
  // --------------------------------------------------------------------------
  console.log('--- TEST 1: Table Schema Verification ---');
  {
    const cols = (db.prepare('PRAGMA table_info(email_settings)').all()).map(c => c.name);
    const requiredCols = [
      'smtp_host',
      'smtp_port',
      'smtp_user',
      'smtp_pass',
      'smtp_secure',
      'email_from',
      'email_from_name',
      'is_active',
    ];
    for (const col of requiredCols) {
      assert(cols.includes(col), `Column \`${col}\` exists in email_settings table`);
    }
  }

  // --------------------------------------------------------------------------
  // TEST 2: Password Masking in Public Methods (Requirement 1 & 3)
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 2: Password Masking & Security ---');
  {
    updateEmailSettings({
      provider: 'smtp',
      smtpHost: 'smtp.gmail.com',
      smtpPort: 587,
      smtpUser: 'easyworksofficiall@gmail.com',
      smtpPass: 'super_secret_app_key_1234',
      smtpSecure: false,
      senderEmail: 'easyworksofficiall@gmail.com',
      senderName: 'Easyworks',
      isActive: true,
    });

    const publicSettings = getEmailSettings();
    assert(publicSettings.smtpPass === '••••••••', 'getEmailSettings() masks password as ••••••••');
    assert(!JSON.stringify(publicSettings).includes('super_secret_app_key_1234'), 'Plaintext password never exposed in public settings JSON');

    const rawSettings = getActiveEmailSettings();
    assert(rawSettings?.smtp_pass === 'super_secret_app_key_1234', 'getActiveEmailSettings() retains actual password for Nodemailer internal use');
  }

  // --------------------------------------------------------------------------
  // TEST 3: Preserving Existing Password on Subsequent Updates (Requirement 3 & 4)
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 3: Password Preservation on Partial Update ---');
  {
    // Update only the senderName and leave smtpPass as masked '••••••••'
    updateEmailSettings({
      senderName: 'Easyworks Billing Support',
      smtpPass: '••••••••',
    });

    const rawAfterUpdate = getActiveEmailSettings();
    assert(rawAfterUpdate?.smtp_pass === 'super_secret_app_key_1234', 'Saved password is NOT overwritten when frontend submits mask ••••••••');
    assert(rawAfterUpdate?.email_from_name === 'Easyworks Billing Support', 'Non-password fields successfully updated');
  }

  // --------------------------------------------------------------------------
  // TEST 4: Google App Password Space Auto-Cleanup (Requirement 7)
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 4: Google App Password Whitespace Normalization ---');
  {
    // Google generates passwords like "abcd efgh ijkl mnop"
    updateEmailSettings({
      smtpHost: 'smtp.gmail.com',
      smtpUser: 'easyworksofficiall@gmail.com',
      smtpPass: 'abcd efgh ijkl mnop',
    });

    const raw = getActiveEmailSettings();
    assert(raw?.smtp_pass === 'abcdefghijklmnop', '16-character Google App Password automatically stripped of spaces');
  }

  // --------------------------------------------------------------------------
  // TEST 5: Priority: Active Database email_settings over Environment (Requirement 2)
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 5: Active Database Configuration Priority over ENV ---');
  {
    process.env.SMTP_HOST = 'smtp.env-fallback.org';
    process.env.SMTP_USER = 'env_user@env-fallback.org';
    process.env.SMTP_PASS = 'env_pass';

    const config = getEmailConfig();
    assert(config.source === 'database', 'getEmailConfig() source evaluates to "database"');
    assert(config.smtpHost === 'smtp.gmail.com', 'Database smtpHost takes precedence over environment variable');
    assert(config.smtpUser === 'easyworksofficiall@gmail.com', 'Database smtpUser takes precedence over environment variable');
    assert(config.isConfigured === true, 'isConfigured is true when database settings are complete');

    delete process.env.SMTP_HOST;
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;
  }

  // --------------------------------------------------------------------------
  // TEST 6: Safe Diagnostic Output Format (Requirement 8)
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 6: Safe Diagnostic Output Information ---');
  {
    const config = getEmailConfig();
    assert(Boolean(config.diagnostics), 'Diagnostics object is present on config');
    assert(config.diagnostics.source === 'DATABASE', 'Diagnostics source is DATABASE');
    assert(config.diagnostics.smtpHostConfigured === true, 'Diagnostics smtpHostConfigured is true');
    assert(config.diagnostics.smtpUserConfigured === true, 'Diagnostics smtpUserConfigured is true');
    assert(config.diagnostics.smtpPasswordConfigured === true, 'Diagnostics smtpPasswordConfigured is true');
    assert(config.diagnostics.senderConfigured === true, 'Diagnostics senderConfigured is true');
    assert(!JSON.stringify(config.diagnostics).includes(config.smtpPass), 'Diagnostics does NOT leak password');
  }

  // --------------------------------------------------------------------------
  // TEST 7: Live SMTP Connection & Test Email (Requirement 5 & 6)
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 7: Live SMTP Connection & Test Email Dispatch ---');
  {
    console.log('  ... Generating ephemeral Ethereal SMTP test credentials ...');
    const testAccount = await nodemailer.createTestAccount();

    updateEmailSettings({
      provider: 'smtp',
      smtpHost: testAccount.smtp.host,
      smtpPort: testAccount.smtp.port,
      smtpUser: testAccount.user,
      smtpPass: testAccount.pass,
      smtpSecure: testAccount.smtp.secure,
      senderEmail: 'Easyworks <no-reply@easyworks.in>',
      senderName: 'Easyworks Official',
      isActive: true,
    });

    const conn = await testEmailConnection();
    assert(conn.connected === true, 'testEmailConnection() returns connected: true with database credentials');
    assert(conn.status === 'success' || conn.connection === 'Connected', 'testEmailConnection() reports success connection status');
    assert(conn.diagnostics?.source === 'DATABASE', 'testEmailConnection() confirms database as credentials source');

    const testSendResult = await sendDeveloperTestEmail('test.destination@easyworks.in', 'req_diag_999');
    assert(testSendResult.send === 'Accepted', 'sendDeveloperTestEmail() succeeds with Accepted status');
    assert(Boolean(testSendResult.messageId), `sendDeveloperTestEmail() generated message ID: ${testSendResult.messageId}`);
    assert(testSendResult.diagnostics?.source === 'DATABASE', 'sendDeveloperTestEmail() used DATABASE settings');
  }

  // --------------------------------------------------------------------------
  // TEST 8: Signup OTP uses identical Database resolver (Requirement 6)
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 8: OTP Dispatch Uses Database Settings ---');
  {
    const otpResult = await sendOtpEmail('newuser@easyworks.in', '789123', 'req_otp_test_live');
    assert(otpResult.success === true, 'sendOtpEmail() dispatched OTP email using active database credentials');
    assert(Boolean(otpResult.messageId), `sendOtpEmail() confirmed delivery with messageId: ${otpResult.messageId}`);
  }

  // Clean up test configuration in DB
  db.prepare('DELETE FROM email_settings').run();
  console.log('\n  ✔ Database cleaned for next use.');

  console.log('\n====================================================================');
  console.log(`TOTAL TESTS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log('====================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Test suite uncaught error:', err);
  process.exit(1);
});
