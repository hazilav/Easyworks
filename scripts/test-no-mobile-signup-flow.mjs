import { DatabaseSync } from 'node:sqlite';
import crypto from 'node:crypto';
import {
  getDatabase,
  createVerificationCode,
  verifyVerificationCode,
  completeVerifiedSignup,
  evaluateTrialEligibility,
  getTrialIdentityByUserId,
  getUserById,
  getUserSubscription,
  checkRateLimit,
} from '../src/lib/db/database.ts';
import { POST as sendVerificationRoute } from '../src/app/api/auth/send-verification/route.ts';
import { POST as verifyCodeRoute } from '../src/app/api/auth/verify-code/route.ts';

const db = getDatabase();

async function runNoMobileSignupTests() {
  console.log('===============================================================');
  console.log('EASYWORKS — REMOVAL OF MOBILE NUMBER VERIFICATION TEST SUITE');
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
  // TEST 1: SMS Channel Rejection in Verification Handlers (Requirements 3 & 4)
  // -------------------------------------------------------------------------
  console.log('--- TEST 1: Channel Rejection & EMAIL Exclusivity ---');
  {
    // Check createVerificationCode default channel
    const emailRes = createVerificationCode('test.user@nomobile.in', 'EMAIL');
    assert(Boolean(emailRes.code && emailRes.code.length === 6), 'createVerificationCode successfully creates 6-digit EMAIL code');
    assert(emailRes.expiresAt !== undefined, 'Verification code has valid expiration timestamp');

    // Confirm that verification_codes table has no leftover SMS codes
    const smsCodes = db.prepare("SELECT COUNT(*) as c FROM verification_codes WHERE channel = 'SMS'").get();
    assert(smsCodes.c === 0, 'No SMS verification codes exist in verification_codes table');
  }

  // -------------------------------------------------------------------------
  // TEST 2: Email OTP Security Kept Intact (Requirement 6)
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 2: Email OTP Security Invariants ---');
  {
    const emailTarget = `secure.otp.${Date.now()}@biz.in`;
    const { code, signupSessionId } = createVerificationCode(emailTarget, 'EMAIL');

    // 1. No plaintext OTP in database
    const dbRecord = db.prepare('SELECT * FROM verification_codes WHERE target = ? AND verified_at IS NULL').get(emailTarget);
    assert(dbRecord.code === '[HASHED]', 'Plaintext OTP is NEVER stored in database (stored as [HASHED])');
    assert(Boolean(dbRecord.code_hash), 'SHA-256 hash is securely persisted in code_hash column');

    // 2. 10-minute expiry
    const expiresMs = new Date(dbRecord.expires_at).getTime() - Date.now();
    assert(expiresMs > 9 * 60 * 1000 && expiresMs <= 10 * 60 * 1000 + 5000, 'OTP expiry is set to exactly 10 minutes');

    // 3. Rate limiting: 60s cooldown
    const cdKey = `otp_cd_test_${Date.now()}`;
    const cooldown1 = checkRateLimit(cdKey, 1, 60);
    assert(cooldown1.allowed === true, 'First OTP request allowed');
    const cooldown2 = checkRateLimit(cdKey, 1, 60);
    assert(cooldown2.allowed === false, 'Subsequent immediate OTP request blocked by 60s cooldown');

    // 4. Rate limiting: Max 3 per 10 minutes
    const testKey = `otp_req_test_${Date.now()}`;
    assert(checkRateLimit(testKey, 3, 600).allowed === true, 'Request 1/3 allowed');
    assert(checkRateLimit(testKey, 3, 600).allowed === true, 'Request 2/3 allowed');
    assert(checkRateLimit(testKey, 3, 600).allowed === true, 'Request 3/3 allowed');
    assert(checkRateLimit(testKey, 3, 600).allowed === false, 'Request 4/3 blocked by sliding window rate limit');

    // 5. Max 5 verification attempts lockout
    const badTarget = `bad.attempts.${Date.now()}@biz.in`;
    createVerificationCode(badTarget, 'EMAIL');
    for (let i = 1; i <= 4; i++) {
      const wrong = verifyVerificationCode(badTarget, '000000');
      assert(wrong.success === false && wrong.code === 'INVALID_CODE', `Attempt ${i}: Rejected with INVALID_CODE`);
    }
    const attempt5 = verifyVerificationCode(badTarget, '000000');
    assert(attempt5.success === false && attempt5.code === 'MAX_ATTEMPTS_EXCEEDED', 'Attempt 5: Lockout triggered with MAX_ATTEMPTS_EXCEEDED');

    // 6. Single-use invalidation
    const singleUseTarget = `singleuse.${Date.now()}@biz.in`;
    const suCode = createVerificationCode(singleUseTarget, 'EMAIL');
    const verify1 = verifyVerificationCode(singleUseTarget, suCode.code);
    assert(verify1.success === true, 'First verification succeeds');
    const verify2 = verifyVerificationCode(singleUseTarget, suCode.code);
    assert(verify2.success === false && verify2.code === 'INVALID_CODE', 'Reused OTP code is immediately rejected');
  }

  // -------------------------------------------------------------------------
  // TEST 3: Signup Without Mobile Number (Requirements 1, 4, 5, 9, 10)
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 3: Complete Signup Flow with NO Mobile Number ---');
  let testUserId = '';
  {
    const cleanEmail = `owner_${Date.now()}@fastgrowth.in`;
    const userName = 'Rohan Gupta';
    const bizName = 'Gupta Design Architecture';

    // Step A: Verification Code sent to Email
    const { code, signupSessionId } = createVerificationCode(cleanEmail, 'EMAIL');

    // Confirm no permanent user exists before OTP verification
    const preUser = db.prepare('SELECT id FROM users WHERE email = ?').get(cleanEmail);
    assert(!preUser, 'No permanent user record exists prior to email verification');

    // Step B: Verify Code without phone
    const verifyRes = verifyVerificationCode(cleanEmail, code, signupSessionId);
    assert(verifyRes.success === true, 'Email OTP successfully verified');

    // Step C: Complete Signup (Without Phone)
    const signup = completeVerifiedSignup({
      email: cleanEmail,
      name: userName,
      businessName: bizName,
      // NOTE: phone is intentionally omitted
    });

    assert(Boolean(signup.user && signup.user.id), 'Customer user created with server-generated ID');
    assert(signup.user.status === 'ACTIVE', 'Customer account created with ACTIVE status');
    assert(signup.user.email === cleanEmail, 'Customer email correctly matches verified email');
    assert(signup.user.name === userName, 'Customer name saved accurately');
    testUserId = signup.user.id;

    // Step D: Business record created
    const biz = db.prepare('SELECT * FROM businesses WHERE user_id = ?').get(testUserId);
    assert(Boolean(biz), 'Business record created automatically');
    assert(biz.business_name === bizName, 'Business name correctly stored');

    // Step E: 7-Day Free Trial Subscription Created
    assert(Boolean(signup.subscription), 'Subscription created immediately upon email verification');
    assert(signup.subscription.status === 'TRIALING', 'Subscription status is TRIALING');
    assert(signup.subscription.pdfDownloadLimit === 2, 'Free trial PDF download limit is exactly 2');
    assert(signup.subscription.pdfDownloadsUsed === 0, 'PDF downloads used initialized to 0');
    assert(signup.subscription.pdfDownloadsRemaining === 2, 'PDF downloads remaining is exactly 2');
    assert(signup.subscription.trialDaysRemaining >= 6, 'Trial countdown reflects 7-day duration');

    // Step F: Trial Eligibility Check (No phone requirement)
    const eligibility = evaluateTrialEligibility(testUserId);
    assert(eligibility.status === 'ELIGIBLE', 'Trial eligibility evaluates to ELIGIBLE without phone');
    assert(eligibility.isEligible === true, 'Customer is eligible for 7-day trial');
    assert(eligibility.requiresPhoneVerification === false, 'requiresPhoneVerification is FALSE');
    assert(eligibility.requiresEmailVerification === false, 'requiresEmailVerification is FALSE');
  }

  // -------------------------------------------------------------------------
  // TEST 4: Existing Customers with Mobile Number Compatibility (Requirement 7 & 8)
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 4: Backward Compatibility with Existing Phone Records ---');
  {
    const legacyEmail = `legacy_customer_${Date.now()}@studio.in`;
    const legacyPhone = '+919539933265';

    const signup = completeVerifiedSignup({
      email: legacyEmail,
      name: 'Legacy Customer',
      businessName: 'Studio Eleven',
      phone: legacyPhone,
    });

    const user = signup.user;
    const tid = getTrialIdentityByUserId(user.id);
    assert(Boolean(tid), 'Trial identity created for customer with phone');
    assert(tid.phone === legacyPhone, 'Phone number successfully preserved in database');
    assert(Boolean(tid.normalizedPhone), 'Normalized phone retained in database column');

    // Confirm eligibility passes smoothly
    const evalRes = evaluateTrialEligibility(user.id);
    assert(evalRes.status === 'ELIGIBLE', 'Existing customer with phone evaluates to ELIGIBLE');
    assert(evalRes.requiresPhoneVerification === false, 'requiresPhoneVerification is FALSE for existing user');

    // Clean up
    db.prepare('DELETE FROM trial_identities WHERE user_id IN (?, ?)').run(testUserId, user.id);
    db.prepare('DELETE FROM subscriptions WHERE user_id IN (?, ?)').run(testUserId, user.id);
    db.prepare('DELETE FROM businesses WHERE user_id IN (?, ?)').run(testUserId, user.id);
    db.prepare('DELETE FROM users WHERE id IN (?, ?)').run(testUserId, user.id);
  }

  // -------------------------------------------------------------------------
  // TEST 5: API Route Handlers HTTP Contract (Requirements 1, 3, 4, 5, 9, 10)
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 5: API Route Handlers Rejections & Success Responses ---');
  {
    // A: send-verification rejects SMS
    const reqSms = new Request('http://localhost/api/auth/send-verification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target: '+919539933265', channel: 'SMS' }),
    });
    const resSms = await sendVerificationRoute(reqSms);
    const dataSms = await resSms.json();
    assert(resSms.status === 400, 'POST /api/auth/send-verification with channel=SMS returns 400');
    assert(dataSms.error === 'BAD_REQUEST', 'Error code is BAD_REQUEST');
    assert(dataSms.message.includes('Only EMAIL verification is supported'), 'Rejection message explains EMAIL exclusivity');

    // B: verify-code rejects SMS
    const reqVerifySms = new Request('http://localhost/api/auth/verify-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target: '+919539933265', code: '123456', channel: 'SMS' }),
    });
    const resVerifySms = await verifyCodeRoute(reqVerifySms);
    const dataVerifySms = await resVerifySms.json();
    assert(resVerifySms.status === 400, 'POST /api/auth/verify-code with channel=SMS returns 400');
    assert((dataVerifySms.error || dataVerifySms.message).includes('Only EMAIL verification is supported'), 'verify-code explains EMAIL exclusivity');

    // C: Happy path signup via verify-code with NO phone
    const testEmail = `http_signup_${Date.now()}@innovate.in`;
    const codeRec = createVerificationCode(testEmail, 'EMAIL');

    const reqVerifyOk = new Request('http://localhost/api/auth/verify-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        target: testEmail,
        code: codeRec.code,
        name: 'HTTP Client Tester',
        businessName: 'Innovate Studio',
        signupSessionId: codeRec.signupSessionId,
      }),
    });
    const resVerifyOk = await verifyCodeRoute(reqVerifyOk);
    const dataVerifyOk = await resVerifyOk.json();
    assert(resVerifyOk.status === 200, 'POST /api/auth/verify-code returns 200 for email OTP without phone');
    assert(dataVerifyOk.success === true, 'Response reports success: true');
    assert(Boolean(dataVerifyOk.user && dataVerifyOk.user.id), 'User returned with valid ID');
    assert(dataVerifyOk.user.status === 'ACTIVE', 'User status is ACTIVE');
    assert(Boolean(dataVerifyOk.subscription), 'Subscription returned');
    assert(dataVerifyOk.subscription.status === 'TRIALING', 'Subscription is TRIALING');
    assert(dataVerifyOk.subscription.pdfDownloadLimit === 2, 'Subscription PDF download limit is 2');
    assert(dataVerifyOk.eligibility.status === 'ELIGIBLE', 'Eligibility status is ELIGIBLE');
    assert(dataVerifyOk.eligibility.requiresPhoneVerification === false, 'requiresPhoneVerification is FALSE');

    // Clean up
    if (dataVerifyOk.user?.id) {
      const uid = dataVerifyOk.user.id;
      db.prepare('DELETE FROM trial_identities WHERE user_id = ?').run(uid);
      db.prepare('DELETE FROM subscriptions WHERE user_id = ?').run(uid);
      db.prepare('DELETE FROM businesses WHERE user_id = ?').run(uid);
      db.prepare('DELETE FROM users WHERE id = ?').run(uid);
    }
  }

  console.log('\n===============================================================');
  console.log(`TOTAL TESTS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log('===============================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runNoMobileSignupTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
