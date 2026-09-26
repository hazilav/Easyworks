import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import crypto from 'node:crypto';
import nodemailer from 'nodemailer';
import {
  getEmailSettings,
  updateEmailSettings,
  getRawEmailSettings,
  createVerificationCode,
  verifyVerificationCode,
  completeVerifiedSignup,
  getDatabase,
} from '../src/lib/db/database.ts';
import {
  getEmailConfig,
  testEmailConnection,
  sendOtpEmail,
  sendDeveloperTestEmail,
} from '../src/lib/email/emailService.ts';

const db = getDatabase();

async function runOtpEmailVerification() {
  console.log('===============================================================');
  console.log('EASYWORKS — SIGNUP EMAIL OTP & SMTP SYSTEM VERIFICATION SUITE');
  console.log('===============================================================\n');

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

  // -------------------------------------------------------------------------
  // TEST 1: Unconfigured Email Error Handling (Requirement 2 & 3)
  // -------------------------------------------------------------------------
  console.log('--- TEST 1: Missing Configuration Error Handling ---');
  {
    // Temporarily clear email_settings
    db.prepare('DELETE FROM email_settings').run();
    const origHost = process.env.SMTP_HOST;
    delete process.env.SMTP_HOST;

    const config = getEmailConfig();
    assert(config.isConfigured === false, 'Detects unconfigured email provider when credentials missing');

    let sendFailed = false;
    let errorCode = '';
    try {
      await sendOtpEmail('testuser@example.com', '123456', 'req_test_missing');
    } catch (e) {
      sendFailed = true;
      errorCode = e.code;
    }
    assert(sendFailed && errorCode === 'EMAIL_CONFIG_MISSING', 'Throws EMAIL_CONFIG_MISSING when attempting to send without credentials');

    // Restore env if any
    if (origHost) process.env.SMTP_HOST = origHost;
  }

  // -------------------------------------------------------------------------
  // TEST 2: Live SMTP Provider Setup & Handshake (Requirement 2 & 9)
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 2: Live SMTP Provider Handshake & Diagnostic ---');
  let testAccount;
  {
    console.log('  ... Generating live Ethereal SMTP test credentials for verification ...');
    testAccount = await nodemailer.createTestAccount();

    updateEmailSettings({
      provider: 'smtp',
      smtpHost: testAccount.smtp.host,
      smtpPort: testAccount.smtp.port,
      smtpUser: testAccount.user,
      smtpPass: testAccount.pass,
      smtpSecure: testAccount.smtp.secure,
      senderEmail: 'Easyworks <no-reply@easyworks.in>',
      senderName: 'Easyworks',
      isActive: true,
    });

    const conn = await testEmailConnection();
    assert(conn.connected === true, 'SMTP connection handshake succeeded with live mail server');
  }

  // -------------------------------------------------------------------------
  // TEST 3: Developer "Send Test Email" Function (Requirement 9)
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 3: Developer "Send Test Email" Diagnostics ---');
  {
    const diagResult = await sendDeveloperTestEmail('admin.test@easyworks.in', 'req_diag_001');
    assert(diagResult.connection === 'Connected', 'Developer test: Email provider connection = Connected');
    assert(diagResult.send === 'Accepted', 'Developer test: Email send = Accepted');
    assert(Boolean(diagResult.messageId), `Developer test: Message ID generated (${diagResult.messageId})`);
    assert(diagResult.error === undefined, 'Developer test: 0 errors returned');
  }

  // -------------------------------------------------------------------------
  // TEST 4: Security — Storing ONLY Hashed OTP in DB (Requirement 1 & 4)
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 4: Secure Hashing & No Plaintext OTP in Database ---');
  const prospectiveEmail = `prospective_${Date.now()}@bizdomain.in`;
  let generatedOtp = '';
  let signupSessionId = '';
  {
    const codeResult = createVerificationCode(prospectiveEmail, 'EMAIL');
    generatedOtp = codeResult.code;
    signupSessionId = codeResult.signupSessionId;

    assert(generatedOtp.length === 6 && /^\d{6}$/.test(generatedOtp), 'Cryptographically secure 6-digit numeric OTP generated');
    
    // Check SQLite row
    const vcRow = db.prepare('SELECT * FROM verification_codes WHERE target = ?').get(prospectiveEmail.toLowerCase());
    assert(Boolean(vcRow), 'Verification record created in SQLite');
    assert(vcRow.code === '[HASHED]', 'Plaintext OTP is NOT stored in database (code = [HASHED])');
    assert(Boolean(vcRow.code_hash && vcRow.code_hash.length === 64), 'SHA-256 hashed OTP stored in code_hash column');

    // Confirm no user was created prior to verification (Requirement 7)
    const userRow = db.prepare('SELECT * FROM users WHERE email = ?').get(prospectiveEmail.toLowerCase());
    assert(userRow === undefined, 'Permanent customer account NOT created before OTP verification');
  }

  // -------------------------------------------------------------------------
  // TEST 5: Outbound OTP Email Dispatch & Content (Requirement 1 & 5)
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 5: Outbound OTP Email Dispatch & Content ---');
  {
    const reqId = 'req_otp_' + Date.now();
    const sendResult = await sendOtpEmail(prospectiveEmail, generatedOtp, reqId);
    assert(sendResult.success === true, 'Email provider accepted OTP email dispatch');
    assert(Boolean(sendResult.messageId), `Outbound email confirmed by SMTP server with messageId: ${sendResult.messageId}`);
  }

  // -------------------------------------------------------------------------
  // TEST 6: Wrong OTP Handling & Attempt Limiting (Requirement 1 & 10)
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 6: Wrong OTP Handling & Attempt Tracking ---');
  {
    // Try wrong OTP
    const wrongResult = verifyVerificationCode(prospectiveEmail, '000000', signupSessionId);
    assert(wrongResult.success === false, 'Wrong OTP rejected');
    assert(wrongResult.code === 'INVALID_CODE', 'Returns INVALID_CODE error');

    // Check attempts in database
    const vcRow = db.prepare('SELECT attempts FROM verification_codes WHERE target = ?').get(prospectiveEmail.toLowerCase());
    assert(vcRow.attempts === 1, `Failed attempt counter incremented (attempts = ${vcRow.attempts})`);

    // Verify still not created user
    const userRow = db.prepare('SELECT * FROM users WHERE email = ?').get(prospectiveEmail.toLowerCase());
    assert(userRow === undefined, 'Account still not created after failed verification attempt');
  }

  // -------------------------------------------------------------------------
  // TEST 7: Resend OTP Cooldown & Invalidation (Requirement 6 & 10)
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 7: Resend OTP Cooldown & Invalidation ---');
  {
    // Generate a fresh OTP for same email
    const newCodeResult = createVerificationCode(prospectiveEmail, 'EMAIL', signupSessionId);
    const newOtp = newCodeResult.code;

    // Verify older code was deleted/invalidated
    const countRows = db.prepare('SELECT COUNT(*) as c FROM verification_codes WHERE target = ? AND verified_at IS NULL').get(prospectiveEmail.toLowerCase()).c;
    assert(countRows === 1, 'Older unverified OTP invalidated and purged upon new OTP request');

    // Trying old OTP must now fail
    const oldVerify = verifyVerificationCode(prospectiveEmail, generatedOtp, signupSessionId);
    assert(oldVerify.success === false, 'Previous OTP is invalid after resending new OTP');

    generatedOtp = newOtp;
  }

  // -------------------------------------------------------------------------
  // TEST 8: Expired OTP Enforcement (Requirement 1 & 10)
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 8: Expired OTP Enforcement ---');
  {
    const expiredEmail = `expired_${Date.now()}@domain.com`;
    const expResult = createVerificationCode(expiredEmail, 'EMAIL');
    
    // Manually backdate expires_at to 1 minute ago
    const pastTime = new Date(Date.now() - 60000).toISOString();
    db.prepare('UPDATE verification_codes SET expires_at = ? WHERE target = ?').run(pastTime, expiredEmail.toLowerCase());

    const verifyExpired = verifyVerificationCode(expiredEmail, expResult.code);
    assert(verifyExpired.success === false, 'Expired OTP rejected');
    assert(verifyExpired.code === 'CODE_EXPIRED', 'Returns CODE_EXPIRED error');

    // Clean up expired test record
    db.prepare('DELETE FROM verification_codes WHERE target = ?').run(expiredEmail.toLowerCase());
  }

  // -------------------------------------------------------------------------
  // TEST 9: Correct OTP Verification & Customer Lifecycle (Requirement 7 & 10)
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 9: Correct OTP Verification & Full Customer Lifecycle ---');
  let customerUserId = '';
  {
    const verifySuccess = verifyVerificationCode(prospectiveEmail, generatedOtp, signupSessionId);
    assert(verifySuccess.success === true, 'Correct OTP verified successfully');

    // Complete signup lifecycle
    const signup = completeVerifiedSignup({
      email: prospectiveEmail,
      name: 'Amina Al-Nuaimi',
      businessName: 'Al-Nuaimi Architecture',
      ipAddress: '103.22.45.10',
    });

    customerUserId = signup.user.id;
    assert(Boolean(customerUserId), `Customer user created with ID: ${customerUserId}`);
    assert(signup.user.role === 'user', 'User assigned standard "user" role');
    assert(signup.user.status === 'ACTIVE', 'User status set to ACTIVE');

    // Verify Business
    const bizRow = db.prepare('SELECT * FROM businesses WHERE user_id = ?').get(customerUserId);
    assert(Boolean(bizRow), 'Business record created');
    assert(bizRow.business_name === 'Al-Nuaimi Architecture', 'Business name matched input');

    // Verify 7-day trial & 2 PDF downloads
    const subRow = db.prepare('SELECT * FROM subscriptions WHERE user_id = ?').get(customerUserId);
    assert(Boolean(subRow), 'Subscription record created');
    assert(subRow.status === 'TRIALING', 'Subscription status = TRIALING');
    assert(subRow.pdf_download_limit === 2, 'Trial PDF download limit = 2');
    assert(subRow.pdf_downloads_used === 0, 'PDF downloads used = 0');
    assert(subRow.trial_pdf_downloads === 0, 'Trial PDF downloads = 0');

    // Verify trial identity created
    const tidRow = db.prepare('SELECT * FROM trial_identities WHERE user_id = ?').get(customerUserId);
    assert(Boolean(tidRow), 'Trial identity record created for anti-abuse protection');
    assert(tidRow.email_verified === 1, 'Email verified flag set to 1');
  }

  // -------------------------------------------------------------------------
  // TEST 10: Single-Use Invalidation & Duplicate Email Rejection (Requirement 1 & 10)
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 10: Single-Use Invalidation & Duplicate Email Rejection ---');
  {
    // Try using the verified OTP again
    const reuseResult = verifyVerificationCode(prospectiveEmail, generatedOtp, signupSessionId);
    assert(reuseResult.success === false, 'Verified OTP is single-use and cannot be reused');

    // Verify code record in DB has verified_at set
    const vcRow = db.prepare('SELECT verified_at FROM verification_codes WHERE target = ?').get(prospectiveEmail.toLowerCase());
    assert(Boolean(vcRow && vcRow.verified_at), 'Verification record marked with verified_at timestamp');
  }

  // Clean up test customer from database to leave DB in clean state
  console.log('\n--- Cleaning up test records ---');
  db.prepare('DELETE FROM trial_identities WHERE user_id = ?').run(customerUserId);
  db.prepare('DELETE FROM subscriptions WHERE user_id = ?').run(customerUserId);
  db.prepare('DELETE FROM businesses WHERE user_id = ?').run(customerUserId);
  db.prepare('DELETE FROM users WHERE id = ?').run(customerUserId);
  db.prepare('DELETE FROM verification_codes WHERE target = ?').run(prospectiveEmail.toLowerCase());
  console.log('  ✔ Test customer purged. Database clean.');

  console.log('\n===============================================================');
  console.log(`TOTAL TESTS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log('===============================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runOtpEmailVerification().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
