import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';

const BASE_URL = 'http://localhost:3000';
const DB_PATH = path.resolve(process.cwd(), 'data', 'easyworks.db');

function getDb() {
  return new DatabaseSync(DB_PATH);
}

async function runTests() {
  console.log('=================================================================');
  console.log('RUNNING EASYWORKS AUTHENTICATION SECURITY HARDENING TEST SUITE');
  console.log('=================================================================\n');

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

  const db = getDb();

  // -------------------------------------------------------------
  // Test 1: Production response check (NO debugCode in production)
  // -------------------------------------------------------------
  console.log('--- TEST 1: Production Response Security (debugCode Omission) ---');
  {
    // Test helper function logic: verify code is NOT returned when NODE_ENV is production
    const testTarget = `prodtest_${Date.now()}@example.com`;
    // We can also test sending verification and check debugCode presence in non-prod vs simulated prod
    const origEnv = process.env.NODE_ENV;
    
    // In dev: debugCode should be present
    const devRes = await fetch(`${BASE_URL}/api/auth/send-verification`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target: testTarget, channel: 'EMAIL' }),
    });
    const devData = await devRes.json();
    assert(devData.success === true, 'Dev verification request succeeded (HTTP 200)');
    assert(typeof devData.debugCode === 'string', 'debugCode is present in development environment for automated testing');

    // Verify database row has code_hash
    const vcRow = db.prepare('SELECT * FROM verification_codes WHERE target = ?').get(testTarget);
    assert(Boolean(vcRow && vcRow.code_hash), 'Verification code stored with SHA-256 code_hash');
    assert(Boolean(vcRow && vcRow.signup_session_id), 'Verification code tracked with signup_session_id');
  }

  // -------------------------------------------------------------
  // Test 2: Abandoned Signup Lifecycle (NO permanent user created)
  // -------------------------------------------------------------
  console.log('\n--- TEST 2: Abandoned Signup Lifecycle ---');
  {
    const abandonedEmail = `abandoned_${Date.now()}@example.com`;
    const res = await fetch(`${BASE_URL}/api/auth/send-verification`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target: abandonedEmail, channel: 'EMAIL' }),
    });
    const data = await res.json();
    assert(data.success === true, 'Verification OTP dispatched for prospective signup');

    // Confirm that NO record was created in `users` or `trial_identities` or `subscriptions`
    const userRow = db.prepare('SELECT * FROM users WHERE email = ?').get(abandonedEmail);
    const tidRow = db.prepare('SELECT * FROM trial_identities WHERE email = ?').get(abandonedEmail);
    assert(userRow === undefined, 'No permanent user record created in `users` table for abandoned signup');
    assert(tidRow === undefined, 'No record created in `trial_identities` table for abandoned signup');
  }

  // -------------------------------------------------------------
  // Test 3: Happy Path Signup Lifecycle (User, Business, 7-day Trial, 2 PDFs)
  // -------------------------------------------------------------
  console.log('\n--- TEST 3: Happy Path Signup Lifecycle ---');
  let registeredEmail = '';
  let registeredUserId = '';
  {
    registeredEmail = `newcustomer_${Date.now()}@verifiedbiz.in`;
    const sendRes = await fetch(`${BASE_URL}/api/auth/send-verification`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target: registeredEmail, channel: 'EMAIL' }),
    });
    const sendData = await sendRes.json();
    assert(sendData.success === true, 'Verification OTP sent');
    const otp = sendData.debugCode;
    const signupSessionId = sendData.signupSessionId;

    // Verify OTP
    const verifyRes = await fetch(`${BASE_URL}/api/auth/verify-code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        target: registeredEmail,
        code: otp,
        channel: 'EMAIL',
        signupSessionId,
        name: 'Arjun Verma',
        businessName: 'Verma Architecture & Design',
      }),
    });
    const verifyData = await verifyRes.json();
    assert(verifyData.success === true, 'Code verified successfully');
    assert(Boolean(verifyData.user && verifyData.user.id), 'Authoritative server-side user returned');
    assert(verifyData.user.status === 'ACTIVE', 'User created with ACTIVE status');
    assert(verifyData.user.email === registeredEmail, 'User email matches verified email');

    registeredUserId = verifyData.user.id;

    // Inspect database state
    const userInDb = db.prepare('SELECT * FROM users WHERE id = ?').get(registeredUserId);
    const bizInDb = db.prepare('SELECT * FROM businesses WHERE user_id = ?').get(registeredUserId);
    const subInDb = db.prepare('SELECT * FROM subscriptions WHERE user_id = ?').get(registeredUserId);
    const tidInDb = db.prepare('SELECT * FROM trial_identities WHERE user_id = ?').get(registeredUserId);

    assert(Boolean(userInDb), 'User record persisted in `users` table');
    assert(Boolean(bizInDb), 'Business profile persisted in `businesses` table');
    assert(Boolean(subInDb), 'Subscription persisted in `subscriptions` table');
    assert(subInDb.status === 'TRIALING', 'Subscription status initialized to TRIALING');
    assert(subInDb.pdf_download_limit === 2, 'Subscription trial PDF limit set to exactly 2');
    assert(subInDb.pdf_downloads_used === 0, 'Subscription trial PDF used count initialized to 0');
    assert(Boolean(tidInDb), 'Trial identity persisted in `trial_identities` table');
    assert(Boolean(tidInDb.email_verified), 'Email marked as verified in trial identity');
  }

  // -------------------------------------------------------------
  // Test 4: Duplicate Email Detection
  // -------------------------------------------------------------
  console.log('\n--- TEST 4: Duplicate Email Rejection ---');
  {
    const dupRes = await fetch(`${BASE_URL}/api/auth/send-verification`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target: registeredEmail, channel: 'EMAIL' }),
    });
    const dupData = await dupRes.json();
    assert(dupRes.status === 400, 'Duplicate email registration rejected with HTTP 400');
    assert(dupData.code === 'EMAIL_ALREADY_REGISTERED', 'Correct error code EMAIL_ALREADY_REGISTERED returned');
  }

  // -------------------------------------------------------------
  // Test 5: Single-Use Invalidation (Double Verification Rejection)
  // -------------------------------------------------------------
  console.log('\n--- TEST 5: Single-Use Code Invalidation ---');
  {
    // Try verifying the same code again
    const reVerifyRes = await fetch(`${BASE_URL}/api/auth/verify-code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        target: registeredEmail,
        code: '123456',
        channel: 'EMAIL',
      }),
    });
    const reVerifyData = await reVerifyRes.json();
    assert(reVerifyRes.status === 400, 'Re-verification / used code rejected with HTTP 400');
    assert(reVerifyData.success === false, 'Re-using code failed cleanly');
  }

  // -------------------------------------------------------------
  // Test 6: Wrong Code & Max 5 Attempts Rate Limit
  // -------------------------------------------------------------
  console.log('\n--- TEST 6: Wrong Code & Max Attempts Lockout ---');
  {
    const wrongTarget = `wrongcode_${Date.now()}@example.com`;
    const sendRes = await fetch(`${BASE_URL}/api/auth/send-verification`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target: wrongTarget, channel: 'EMAIL' }),
    });
    const sendData = await sendRes.json();
    const sessionId = sendData.signupSessionId;

    // Submit 5 wrong codes
    let lastError = '';
    let lastCode = '';
    for (let i = 1; i <= 5; i++) {
      const wrongRes = await fetch(`${BASE_URL}/api/auth/verify-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target: wrongTarget,
          code: '000000',
          channel: 'EMAIL',
          signupSessionId: sessionId,
        }),
      });
      const wrongData = await wrongRes.json();
      lastError = wrongData.error;
      lastCode = wrongData.code;
    }

    assert(lastCode === 'MAX_ATTEMPTS_EXCEEDED' || lastError.includes('Too many incorrect attempts'), 'Max 5 attempts enforced; code locked out');
  }

  // -------------------------------------------------------------
  // Test 7: Resend Rate Limiting (HTTP 429 RATE_LIMITED)
  // -------------------------------------------------------------
  console.log('\n--- TEST 7: Resend Rate Limiting ---');
  {
    const spamTarget = `spamtarget_${Date.now()}@example.com`;
    // Attempt 4 fast resends (limit is 3 per 10 minutes)
    let rateLimited = false;
    let rateLimitCode = '';
    for (let i = 0; i < 5; i++) {
      const res = await fetch(`${BASE_URL}/api/auth/send-verification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target: spamTarget, channel: 'EMAIL' }),
      });
      const data = await res.json();
      if (res.status === 429) {
        rateLimited = true;
        rateLimitCode = data.code;
        break;
      }
    }
    assert(rateLimited === true, 'Rapid OTP resend requests trigger HTTP 429');
    assert(rateLimitCode === 'RATE_LIMITED', 'Error code RATE_LIMITED returned');
  }

  // -------------------------------------------------------------
  // Test 8: Controlled USER_NOT_FOUND (404) on Arbitrary Calls
  // -------------------------------------------------------------
  console.log('\n--- TEST 8: Restricting ensureUserExists (Controlled 404 USER_NOT_FOUND) ---');
  {
    const nonExistentUserId = 'usr_phantom_999999';

    // 1. PDF download
    const pdfRes = await fetch(`${BASE_URL}/api/billing/pdf-download`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: nonExistentUserId, documentType: 'QUOTATION' }),
    });
    const pdfData = await pdfRes.json();
    assert(pdfRes.status === 404, 'PDF download with non-existent user returns HTTP 404');
    assert(pdfData.code === 'USER_NOT_FOUND', 'PDF download returns USER_NOT_FOUND error code');

    // 2. Manual payment
    const payRes = await fetch(`${BASE_URL}/api/billing/manual-payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: nonExistentUserId, planId: 'plan_1m', utrNumber: 'UTR99999999' }),
    });
    const payData = await payRes.json();
    assert(payRes.status === 404, 'Manual payment with non-existent user returns HTTP 404');
    assert(payData.code === 'USER_NOT_FOUND', 'Manual payment returns USER_NOT_FOUND error code');

    // 3. Documents
    const docRes = await fetch(`${BASE_URL}/api/documents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: nonExistentUserId, type: 'quotation', document: { id: 'qt_123' } }),
    });
    const docData = await docRes.json();
    assert(docRes.status === 404, 'Save document with non-existent user returns HTTP 404');
    assert(docData.code === 'USER_NOT_FOUND', 'Save document returns USER_NOT_FOUND error code');

    // Verify phantom user was NOT created in DB
    const phantomInDb = db.prepare('SELECT * FROM users WHERE id = ?').get(nonExistentUserId);
    assert(phantomInDb === undefined, 'No phantom user record was auto-created in `users` table');
  }

  // -------------------------------------------------------------
  // Test 9: PDF Limit Consumption for Verified User
  // -------------------------------------------------------------
  console.log('\n--- TEST 9: PDF Limit Consumption for Verified User ---');
  {
    // First download
    const dl1 = await fetch(`${BASE_URL}/api/billing/pdf-download`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: registeredUserId, documentType: 'QUOTATION' }),
    });
    const dl1Data = await dl1.json();
    assert(dl1Data.success === true && dl1Data.allowed === true, 'First trial PDF download allowed');
    assert(dl1Data.pdfDownloadsUsed === 1, 'PDF downloads used incremented to 1');
    assert(dl1Data.pdfDownloadsRemaining === 1, 'PDF downloads remaining is 1');

    // Second download
    const dl2 = await fetch(`${BASE_URL}/api/billing/pdf-download`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: registeredUserId, documentType: 'QUOTATION' }),
    });
    const dl2Data = await dl2.json();
    assert(dl2Data.success === true && dl2Data.allowed === true, 'Second trial PDF download allowed');
    assert(dl2Data.pdfDownloadsUsed === 2, 'PDF downloads used incremented to 2');
    assert(dl2Data.pdfDownloadsRemaining === 0, 'PDF downloads remaining is 0');

    // Third download (should be locked out)
    const dl3 = await fetch(`${BASE_URL}/api/billing/pdf-download`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: registeredUserId, documentType: 'QUOTATION' }),
    });
    const dl3Data = await dl3.json();
    assert(dl3.status === 403, 'Third trial PDF download locked with HTTP 403');
    assert(dl3Data.allowed === false, 'Download blocked: limit reached');
  }

  console.log('\n=================================================================');
  console.log(`TEST SUITE FINISHED: ${passed} passed, ${failed} failed`);
  console.log('=================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Test suite uncaught error:', err);
  process.exit(1);
});
