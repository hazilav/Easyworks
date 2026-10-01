import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import crypto from 'node:crypto';
import {
  getDatabase,
  getActiveSmsSettings,
  getSmsSettings,
  updateSmsSettings,
  createVerificationCode,
  verifyVerificationCode,
  hasVerifiedEmailInSession,
  getVerifiedEmailInSession,
  completeVerifiedSignup,
  verifyAndConsumeTrialPdfDownload,
  getUserSubscription,
} from '../src/lib/db/database.ts';
import {
  normalizePhone,
  isValidIndianMobile,
} from '../src/lib/abuse/normalizers.ts';
import {
  getSmsConfig,
  sendOtpSms,
  testSmsConnection,
  sendDeveloperTestSms,
  formatOtpSms,
  maskPhoneNumber,
} from '../src/lib/sms/smsService.ts';

const db = getDatabase();

async function runSmsVerificationSuite() {
  console.log('====================================================================');
  console.log('EASYWORKS — SMS PROVIDER, INDIA NUMBER & MOBILE OTP VERIFICATION SUITE');
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

  // -------------------------------------------------------------------------
  // TEST 1: Table Schema & Column Verification
  // -------------------------------------------------------------------------
  console.log('--- TEST 1: Table Schema Verification ---');
  {
    const smsCols = db.prepare("PRAGMA table_info(sms_settings)").all().map((c) => c.name);
    assert(smsCols.includes('id'), 'Column `id` exists in sms_settings table');
    assert(smsCols.includes('provider'), 'Column `provider` exists in sms_settings table');
    assert(smsCols.includes('api_url'), 'Column `api_url` exists in sms_settings table');
    assert(smsCols.includes('account_sid'), 'Column `account_sid` exists in sms_settings table');
    assert(smsCols.includes('auth_token'), 'Column `auth_token` exists in sms_settings table');
    assert(smsCols.includes('sender_id'), 'Column `sender_id` exists in sms_settings table');
    assert(smsCols.includes('message_template'), 'Column `message_template` exists in sms_settings table');
    assert(smsCols.includes('is_active'), 'Column `is_active` exists in sms_settings table');
    assert(smsCols.includes('updated_at'), 'Column `updated_at` exists in sms_settings table');

    const vcCols = db.prepare("PRAGMA table_info(verification_codes)").all().map((c) => c.name);
    assert(vcCols.includes('request_id'), 'Column `request_id` exists in verification_codes table');
    assert(vcCols.includes('phone_number'), 'Column `phone_number` exists in verification_codes table');
    assert(vcCols.includes('otp_hash'), 'Column `otp_hash` exists in verification_codes table');
  }

  // -------------------------------------------------------------------------
  // TEST 2: Indian Phone Number Normalization & Validation (Requirement 4)
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 2: Indian Mobile Number Normalization & Validation ---');
  {
    // Format 1: 10-digit standard Indian mobile starting with 9
    const n1 = normalizePhone('9876543210');
    assert(n1 === '+919876543210', `Normalizes "9876543210" to E.164: ${n1}`);
    assert(isValidIndianMobile(n1) === true, 'Validates 9876543210 as valid Indian mobile');

    // Format 2: E.164 input
    const n2 = normalizePhone('+919876543210');
    assert(n2 === '+919876543210', `Normalizes "+919876543210" to E.164: ${n2}`);
    assert(isValidIndianMobile(n2) === true, 'Validates +919876543210 as valid Indian mobile');

    // Format 3: Spaced input
    const n3 = normalizePhone('+91 98765 43210');
    assert(n3 === '+919876543210', `Normalizes "+91 98765 43210" to E.164: ${n3}`);
    assert(isValidIndianMobile(n3) === true, 'Validates spaced Indian mobile number');

    // Format 4: Trunk prefix 0
    const n4 = normalizePhone('09876543210');
    assert(n4 === '+919876543210', `Normalizes "09876543210" to E.164: ${n4}`);
    assert(isValidIndianMobile(n4) === true, 'Validates 0-prefixed Indian mobile number');

    // Format 5: Valid mobile starting with 6, 7, 8
    assert(isValidIndianMobile('+916234567890') === true, 'Validates Indian number starting with 6');
    assert(isValidIndianMobile('+917834567890') === true, 'Validates Indian number starting with 7');
    assert(isValidIndianMobile('+918134567890') === true, 'Validates Indian number starting with 8');

    // Rejection of invalid phone numbers
    assert(isValidIndianMobile('+911234567890') === false, 'Rejects Indian number starting with 1 (invalid series)');
    assert(isValidIndianMobile('+915234567890') === false, 'Rejects Indian number starting with 5 (invalid series)');
    assert(isValidIndianMobile('98765') === false, 'Rejects incomplete short number (5 digits)');
    assert(isValidIndianMobile('+14155552671') === false, 'Rejects US country code (+1) when validating Indian mobile');
  }

  // -------------------------------------------------------------------------
  // TEST 3: SMS Settings Security & Masking (Requirement 3)
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 3: SMS Settings Security & Masking ---');
  {
    db.prepare('DELETE FROM sms_settings').run();

    updateSmsSettings({
      provider: 'twilio',
      accountSid: 'AC_test_account_sid_123456',
      authToken: 'secret_twilio_auth_token_99999',
      senderId: '+15005550006',
      messageTemplate: 'Easyworks verification code: {{code}}\n\nThis code expires in 10 minutes.',
      isActive: true,
    });

    const publicSettings = getSmsSettings();
    assert(publicSettings.authToken === '••••••••', 'Auth token masked as •••••••• in public settings');
    assert(!JSON.stringify(publicSettings).includes('secret_twilio_auth_token'), 'Plaintext auth token never exposed in public settings');

    const activeSettings = getActiveSmsSettings();
    assert(activeSettings.auth_token === 'secret_twilio_auth_token_99999', 'Internal active config retains raw token for SMS delivery');

    // Partial update preserving masked password
    updateSmsSettings({
      provider: 'twilio',
      accountSid: 'AC_test_account_sid_123456',
      authToken: '••••••••', // User submitted mask back without changing
      senderId: '+15005550007',
    });

    const activeAfter = getActiveSmsSettings();
    assert(activeAfter.auth_token === 'secret_twilio_auth_token_99999', 'Existing auth token preserved when •••••••• submitted');
    assert(activeAfter.sender_id === '+15005550007', 'Non-token field updated successfully');
  }

  // -------------------------------------------------------------------------
  // TEST 4: No Fake Success When SMS Provider Not Configured (Requirement 8)
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 4: Unconfigured SMS Provider Error Handling (HTTP 503) ---');
  {
    db.prepare('DELETE FROM sms_settings').run();
    const origSid = process.env.TWILIO_ACCOUNT_SID;
    const origTok = process.env.TWILIO_AUTH_TOKEN;
    const origSmsProvider = process.env.SMS_PROVIDER;
    delete process.env.TWILIO_ACCOUNT_SID;
    delete process.env.TWILIO_AUTH_TOKEN;
    delete process.env.SMS_PROVIDER;

    const config = getSmsConfig();
    assert(config.isConfigured === false, 'Detects unconfigured SMS provider when database is empty');

    let threwMissing = false;
    let errorCode = '';
    try {
      await sendOtpSms('+919876543210', '123456', 'req_unconfigured_test');
    } catch (e) {
      threwMissing = true;
      errorCode = e.code;
    }

    assert(threwMissing === true, 'Throws error when attempting to send SMS without configured provider');
    assert(errorCode === 'SMS_CONFIG_MISSING', 'Throws specific SMS_CONFIG_MISSING error code');

    // Restore env if any
    if (origSid) process.env.TWILIO_ACCOUNT_SID = origSid;
    if (origTok) process.env.TWILIO_AUTH_TOKEN = origTok;
    if (origSmsProvider) process.env.SMS_PROVIDER = origSmsProvider;
  }

  // -------------------------------------------------------------------------
  // TEST 5: Message Formatting (Requirement 7)
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 5: Message Template Formatting ---');
  {
    const defaultMsg = formatOtpSms('789012');
    assert(defaultMsg.includes('Easyworks verification code: 789012'), 'Contains exact brand header with code');
    assert(defaultMsg.includes('This code expires in 10 minutes'), 'Specifies 10-minute expiry time');
    assert(defaultMsg.includes('If you did not request this code, ignore this message'), 'Contains security ignore statement');

    const customMsg = formatOtpSms('654321', 'Your Easyworks OTP is {{code}}. Do not share.');
    assert(customMsg === 'Your Easyworks OTP is 654321. Do not share.', 'Supports custom template token replacement');
  }

  // -------------------------------------------------------------------------
  // TEST 6: Test Driver Dispatch & Safe Auditing (Requirement 9 & 12)
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 6: SMS Dispatch & Telemetry ---');
  {
    updateSmsSettings({
      provider: 'test',
      accountSid: 'TEST_DRIVER',
      authToken: 'test_token',
      senderId: 'Easyworks',
      isActive: true,
    });

    const config = getSmsConfig();
    assert(config.isConfigured === true, 'Test driver is configured');
    assert(config.diagnostics.source === 'DATABASE', 'Diagnostics report source = DATABASE');
    assert(config.diagnostics.providerConfigured === true, 'Diagnostics report providerConfigured = true');

    const testResult = await sendDeveloperTestSms('+919876543210', 'Test Hello', 'req_diag_test');
    assert(testResult.success === true, 'sendDeveloperTestSms() returns success = true');
    assert(testResult.status === 'ACCEPTED', 'sendDeveloperTestSms() reports status = ACCEPTED');
    assert(typeof testResult.messageId === 'string' && testResult.messageId.startsWith('test_sms_'), 'Generated tracking messageId');

    const masked = maskPhoneNumber('+919876543210');
    assert(masked === '+91******3210', `Masks phone securely for audit logs: ${masked}`);
  }

  // -------------------------------------------------------------------------
  // TEST 7: OTP Cryptographic Security & Lifecycle (Requirement 5 & 11)
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 7: OTP Security, Hashing, Single-Use & Expiry ---');
  {
    const targetPhone = '+919988776655';
    const testSessionId = 'ss_test_' + Date.now();
    const testReqId = 'req_otp_' + Date.now();

    // Clean any prior test rows for this number
    db.prepare('DELETE FROM verification_codes WHERE target = ?').run(targetPhone);

    // Generate OTP
    const { code, expiresAt, signupSessionId } = createVerificationCode(
      targetPhone,
      'SMS',
      testSessionId,
      testReqId
    );

    assert(code.length === 6 && /^\d{6}$/.test(code), 'Generates 6-digit numeric OTP');
    assert(typeof expiresAt === 'string', 'Generated expiresAt ISO timestamp');

    // Inspect database row
    const row = db.prepare('SELECT * FROM verification_codes WHERE target = ? ORDER BY created_at DESC LIMIT 1').get(targetPhone);
    assert(row !== undefined, 'Verification code row persisted in SQLite');
    assert(row.code === '[HASHED]', 'Plaintext OTP is NEVER stored in database (stored as [HASHED])');
    assert(typeof row.code_hash === 'string' && row.code_hash.length === 64, 'SHA-256 hash stored in code_hash');
    assert(row.otp_hash === row.code_hash, 'Aliased otp_hash populated for mobile verification');
    assert(row.phone_number === targetPhone, 'Normalized phone_number populated in record');
    assert(row.request_id === testReqId, 'request_id populated in record');
    assert(row.verified_at === null, 'verified_at is initially null');

    // Test Wrong OTP handling
    const wrongResult = verifyVerificationCode(targetPhone, '000000', signupSessionId);
    assert(wrongResult.success === false, 'Rejects incorrect OTP');
    assert(wrongResult.code === 'INVALID_CODE', 'Returns INVALID_CODE error code');

    const updatedRow = db.prepare('SELECT * FROM verification_codes WHERE target = ? ORDER BY created_at DESC LIMIT 1').get(targetPhone);
    assert(updatedRow.attempts === 1, 'Failed attempt incremented (attempts = 1)');

    // Invalidation on resend
    const newCodeResult = createVerificationCode(targetPhone, 'SMS', testSessionId, 'req_new');
    const oldRowCheck = db.prepare('SELECT * FROM verification_codes WHERE id = ?').get(row.id);
    assert(oldRowCheck === undefined, 'Previous unverified OTP invalidated and purged when new OTP is generated');

    // Test correct verification
    const correctResult = verifyVerificationCode(targetPhone, newCodeResult.code, testSessionId);
    assert(correctResult.success === true, 'Verifies correct 6-digit OTP code');

    // Single-use invalidation
    const reuseResult = verifyVerificationCode(targetPhone, newCodeResult.code, testSessionId);
    assert(reuseResult.success === false, 'Single-use enforced: cannot reuse verified OTP');
  }

  // -------------------------------------------------------------------------
  // TEST 8: Full Two-Step Signup Flow (Requirement 10)
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 8: End-to-End Multi-Step Customer Signup Lifecycle ---');
  {
    const customerEmail = `enterprise_${Date.now()}@indiabiz.in`;
    const customerPhone = '+919876543219';
    const customerName = 'Kavita Ramanathan';
    const customerBiz = 'Ramanathan Luxury Interiors';
    const signupSessionId = 'ss_e2e_' + Date.now();

    // Step 1: User enters email -> Email OTP dispatched
    const emailOtp = createVerificationCode(customerEmail, 'EMAIL', signupSessionId, 'req_step1');

    // Step 2: Email OTP verified -> Account is NOT created yet (deferred until mobile verification)
    const emailVerifyResult = verifyVerificationCode(customerEmail, emailOtp.code, signupSessionId);
    assert(emailVerifyResult.success === true, 'Step 1: Email OTP verified successfully');

    assert(hasVerifiedEmailInSession(signupSessionId) === true, 'Session tracks verified email');
    assert(getVerifiedEmailInSession(signupSessionId) === customerEmail, 'Verified email retrievable from session');

    const preUserCheck = db.prepare('SELECT * FROM users WHERE email = ?').get(customerEmail);
    assert(preUserCheck === undefined, 'Permanent user is NOT created prematurely before mobile OTP');

    // Step 3: User enters mobile number -> Mobile OTP dispatched
    const phoneOtp = createVerificationCode(customerPhone, 'SMS', signupSessionId, 'req_step2');

    // Step 4: Mobile OTP verified -> Permanent Account, Business, 7-day Trial, 2 PDF downloads created!
    const phoneVerifyResult = verifyVerificationCode(customerPhone, phoneOtp.code, signupSessionId);
    assert(phoneVerifyResult.success === true, 'Step 2: Mobile OTP verified successfully');

    // Finalize verified customer signup
    const signup = completeVerifiedSignup({
      email: customerEmail,
      name: customerName,
      businessName: customerBiz,
      phone: customerPhone,
    });

    assert(Boolean(signup.user && signup.user.id), `Customer created with ID: ${signup.user.id}`);
    assert(signup.user.status === 'ACTIVE', 'User status set to ACTIVE');
    assert(signup.user.email === customerEmail, 'User email matches verified email');

    // Check Business
    const bizRow = db.prepare('SELECT * FROM businesses WHERE user_id = ?').get(signup.user.id);
    assert(Boolean(bizRow), 'Business record created');
    assert(bizRow.business_name === customerBiz, 'Business name matches customer input');

    // Check 7-Day Trial & 2 PDF Limit
    const sub = signup.subscription;
    assert(sub.status === 'TRIALING', 'Subscription status = TRIALING');
    assert((sub.pdfDownloadLimit === 2 || sub.pdf_download_limit === 2), 'Subscription PDF download limit = 2');
    assert((sub.pdfDownloadsUsed === 0 || sub.pdf_downloads_used === 0), 'Initial PDF downloads used = 0');

    // Check Trial Identity
    const tidRow = db.prepare('SELECT * FROM trial_identities WHERE user_id = ?').get(signup.user.id);
    assert(Boolean(tidRow), 'Trial identity created');
    assert(tidRow.email_verified === 1, 'Trial identity email_verified = 1');
    assert(tidRow.phone_verified === 1, 'Trial identity phone_verified = 1');
    assert(tidRow.normalized_phone === customerPhone, 'Trial identity normalized_phone stored securely');

    // PDF Limit Consumption Verification: 2 allowed, 3rd blocked
    const pdf1 = verifyAndConsumeTrialPdfDownload(signup.user.id, 'doc_test_1');
    assert(pdf1.allowed === true && pdf1.pdfDownloadsRemaining === 1, 'PDF Download 1/2: Allowed');

    const pdf2 = verifyAndConsumeTrialPdfDownload(signup.user.id, 'doc_test_2');
    assert(pdf2.allowed === true && pdf2.pdfDownloadsRemaining === 0, 'PDF Download 2/2: Allowed (Limit reached)');

    const pdf3 = verifyAndConsumeTrialPdfDownload(signup.user.id, 'doc_test_3');
    assert(pdf3.allowed === false && pdf3.reason === 'LIMIT_REACHED', 'PDF Download 3/2: Strictly blocked with LIMIT_REACHED');

    // Clean up test customer
    db.prepare('DELETE FROM subscriptions WHERE user_id = ?').run(signup.user.id);
    db.prepare('DELETE FROM trial_identities WHERE user_id = ?').run(signup.user.id);
    db.prepare('DELETE FROM businesses WHERE user_id = ?').run(signup.user.id);
    db.prepare('DELETE FROM users WHERE id = ?').run(signup.user.id);
    db.prepare('DELETE FROM verification_codes WHERE target = ? OR target = ?').run(customerEmail, customerPhone);
    console.log('  ✔ Database cleaned for next use.');
  }

  console.log('\n====================================================================');
  console.log(`TOTAL TESTS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log('====================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runSmsVerificationSuite().catch((err) => {
  console.error('Test suite uncaught error:', err);
  process.exit(1);
});
