/**
 * Comprehensive Diagnosis & Verification Script
 * Validates:
 * 1. GET /api/developer/system-health
 * 2. EW-XXXXXX Request ID propagation on all responses (X-Request-Id header)
 * 3. Browser Test A: Send Verification Code (EMAIL & SMS)
 * 4. Browser Test B: Verify Code
 * 5. Browser Test C: Load Pricing Plans
 * 6. Browser Test D: PDF Download Check (GET & POST quota)
 * 7. Browser Test E: Manual Payment Submission
 * 8. Browser Test F: Developer Dashboard Load
 * 9. Browser Test G: Developer Payment Approval
 * 10. Guaranteed non-empty JSON error responses (no HTTP 500 with 0 bytes)
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed++;
    console.log(`  ✅ PASS: ${message}`);
  } else {
    failed++;
    console.error(`  ❌ FAIL: ${message}`);
  }
}

async function run() {
  console.log('=== STARTING EASYWORKS LIVE HTTP 500 ROOT CAUSE DIAGNOSIS & VERIFICATION ===\n');
  console.log(`Target: ${BASE_URL}\n`);

  // Step 1: System Health Check
  console.log('--- 1. SYSTEM HEALTH & DIAGNOSTICS ENDPOINT ---');
  try {
    const res = await fetch(`${BASE_URL}/api/developer/system-health`);
    const status = res.status;
    const reqId = res.headers.get('x-request-id');
    const text = await res.text();
    let data = {};
    try { data = JSON.parse(text); } catch {}

    assert(status === 200, `Health check returned HTTP 200 (got ${status})`);
    assert(Boolean(reqId && reqId.startsWith('EW-')), `Health check returned EW-XXXXXX Request ID (${reqId})`);
    assert(data.success === true, 'Health check reported success: true');
    assert(data.database === 'connected', `Database connected: ${data.database}`);
    assert(data.commit === '9de9e7a', `Reported Git commit hash is 9de9e7a (got ${data.commit})`);
    console.log(`     Details: Env=${data.environment}, Uptime=${data.serverUptime}s, DB=${data.databasePath}`);
  } catch (err) {
    assert(false, `Health check failed to execute: ${err.message}`);
  }

  // Step 2: Browser Test A: Send Verification Code
  console.log('\n--- 2. BROWSER TEST A: Send Verification Code ---');
  const testEmail = `test_live_${Date.now()}@example.com`;
  let signupSessionId = '';
  let debugOtp = '';
  try {
    const res = await fetch(`${BASE_URL}/api/auth/send-verification`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target: testEmail, channel: 'EMAIL' }),
    });
    const reqId = res.headers.get('x-request-id');
    const text = await res.text();
    let data = {};
    try { data = JSON.parse(text); } catch {}

    assert(res.status === 200, `Send verification returned HTTP 200 (got ${res.status})`);
    assert(Boolean(reqId && reqId.startsWith('EW-')), `Send verification returned EW-XXXXXX Request ID (${reqId})`);
    assert(data.success === true, 'Send verification payload success is true');
    assert(Boolean(data.signupSessionId), `Signup session ID created (${data.signupSessionId})`);
    signupSessionId = data.signupSessionId;
    debugOtp = data.debugCode || '123456';
  } catch (err) {
    assert(false, `Send verification request failed: ${err.message}`);
  }

  // Step 3: Browser Test B: Verify Code
  console.log('\n--- 3. BROWSER TEST B: Verify Code ---');
  let verifiedUserId = '';
  try {
    const res = await fetch(`${BASE_URL}/api/auth/verify-code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        target: testEmail,
        code: debugOtp,
        channel: 'EMAIL',
        signupSessionId,
        name: 'Live Test User',
        businessName: 'Live Test Enterprises',
      }),
    });
    const reqId = res.headers.get('x-request-id');
    const text = await res.text();
    let data = {};
    try { data = JSON.parse(text); } catch {}

    assert(res.status === 200, `Verify code returned HTTP 200 (got ${res.status})`);
    assert(Boolean(reqId && reqId.startsWith('EW-')), `Verify code returned EW-XXXXXX Request ID (${reqId})`);
    assert(data.success === true, 'Verify code payload success is true');
    assert(Boolean(data.user?.id), `User created with ID: ${data.user?.id}`);
    assert(data.subscription?.status === 'TRIALING', `Initial status is TRIALING (${data.subscription?.status})`);
    assert(data.subscription?.pdfDownloadLimit === 2, `Trial PDF limit is 2 (${data.subscription?.pdfDownloadLimit})`);
    verifiedUserId = data.user?.id;
  } catch (err) {
    assert(false, `Verify code request failed: ${err.message}`);
  }

  // Step 4: Browser Test C: Load Pricing Plans
  console.log('\n--- 4. BROWSER TEST C: Load Pricing Plans ---');
  try {
    const res = await fetch(`${BASE_URL}/api/billing/plans`);
    const reqId = res.headers.get('x-request-id');
    const text = await res.text();
    let data = {};
    try { data = JSON.parse(text); } catch {}

    assert(res.status === 200, `Load plans returned HTTP 200 (got ${res.status})`);
    assert(Boolean(reqId && reqId.startsWith('EW-')), `Load plans returned EW-XXXXXX Request ID (${reqId})`);
    assert(data.success === true, 'Load plans payload success is true');
    assert(Array.isArray(data.plans) && data.plans.length >= 3, `Returned ${data.plans?.length} plans`);

    const p1 = data.plans.find((p) => p.id === 'plan_1m');
    const p3 = data.plans.find((p) => p.id === 'plan_3m');
    const p6 = data.plans.find((p) => p.id === 'plan_6m');

    assert(p1 && p1.priceINR === 299 && p1.pdfDownloadLimit === 30, `Plan 1M is ₹299 with 30 PDF limit`);
    assert(p3 && p3.priceINR === 849 && p3.pdfDownloadLimit === 90, `Plan 3M is ₹849 with 90 PDF limit`);
    assert(p6 && p6.priceINR === 1699 && p6.pdfDownloadLimit === 180, `Plan 6M is ₹1,699 with 180 PDF limit`);
  } catch (err) {
    assert(false, `Load plans request failed: ${err.message}`);
  }

  // Step 5: Browser Test D: PDF Download Check (GET & POST)
  console.log('\n--- 5. BROWSER TEST D: PDF Download Quota Check ---');
  try {
    const getRes = await fetch(`${BASE_URL}/api/billing/pdf-download?userId=${verifiedUserId}`);
    const getReqId = getRes.headers.get('x-request-id');
    const getText = await getRes.text();
    let getData = {};
    try { getData = JSON.parse(getText); } catch {}

    assert(getRes.status === 200, `GET pdf-download returned HTTP 200 (got ${getRes.status})`);
    assert(Boolean(getReqId && getReqId.startsWith('EW-')), `GET pdf-download returned EW-XXXXXX Request ID (${getReqId})`);
    assert(getData.pdfLimit === 2, `Free trial PDF limit is 2 (got ${getData.pdfLimit})`);
    assert(getData.pdfRemaining === 2, `Free trial PDF remaining is 2 (got ${getData.pdfRemaining})`);

    // Consume 1 PDF
    const postRes1 = await fetch(`${BASE_URL}/api/billing/pdf-download`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: verifiedUserId, documentType: 'INVOICE', documentNumber: 'INV-101' }),
    });
    const postData1 = await postRes1.json();
    assert(postRes1.status === 200, 'POST pdf-download #1 returned HTTP 200');
    assert(postData1.pdfRemaining === 1, `Remaining after #1 is 1 (got ${postData1.pdfRemaining})`);

    // Consume 2nd PDF
    const postRes2 = await fetch(`${BASE_URL}/api/billing/pdf-download`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: verifiedUserId, documentType: 'INVOICE', documentNumber: 'INV-102' }),
    });
    const postData2 = await postRes2.json();
    assert(postRes2.status === 200, 'POST pdf-download #2 returned HTTP 200');
    assert(postData2.pdfRemaining === 0, `Remaining after #2 is 0 (got ${postData2.pdfRemaining})`);

    // Attempt 3rd PDF (should be 403 Forbidden with clear payload, NOT 500)
    const postRes3 = await fetch(`${BASE_URL}/api/billing/pdf-download`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: verifiedUserId, documentType: 'INVOICE', documentNumber: 'INV-103' }),
    });
    const postData3 = await postRes3.json();
    assert(postRes3.status === 403, `POST pdf-download #3 returned HTTP 403 (got ${postRes3.status})`);
    assert(postData3.code === 'PDF_LIMIT_REACHED', `Error code is PDF_LIMIT_REACHED (${postData3.code})`);
    assert(postData3.allowed === false, 'allowed is false');
  } catch (err) {
    assert(false, `PDF download quota check failed: ${err.message}`);
  }

  // Step 6: Browser Test E: Manual Payment Submission
  console.log('\n--- 6. BROWSER TEST E: Manual Payment Submission ---');
  let paymentRequestId = '';
  try {
    const res = await fetch(`${BASE_URL}/api/billing/manual-payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: verifiedUserId,
        planId: 'plan_1m',
        utrNumber: 'UPI_TEST_' + Date.now(),
        notes: 'Live verification test payment',
      }),
    });
    const reqId = res.headers.get('x-request-id');
    const text = await res.text();
    let data = {};
    try { data = JSON.parse(text); } catch {}

    assert(res.status === 200, `Manual payment returned HTTP 200 (got ${res.status})`);
    assert(Boolean(reqId && reqId.startsWith('EW-')), `Manual payment returned EW-XXXXXX Request ID (${reqId})`);
    assert(data.success === true, 'Manual payment payload success is true');
    assert(Boolean(data.paymentRequest?.id), `Payment request ID created (${data.paymentRequest?.id})`);
    paymentRequestId = data.paymentRequest?.id;
  } catch (err) {
    assert(false, `Manual payment request failed: ${err.message}`);
  }

  // Step 7: Browser Test F: Developer Dashboard Load
  console.log('\n--- 7. BROWSER TEST F: Developer Dashboard Load ---');
  let devToken = '';
  try {
    // Login as developer
    const authRes = await fetch(`${BASE_URL}/api/developer/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'muhammedhazilav@gmail.com', password: 'easyworks@lnz321' }),
    });
    const authData = await authRes.json();
    assert(authRes.status === 200, `Developer auth returned HTTP 200 (got ${authRes.status})`);
    assert(Boolean(authData.token), 'Developer auth issued bearer token');
    devToken = authData.token;

    // Load developer stats
    const statsRes = await fetch(`${BASE_URL}/api/developer/stats`, {
      headers: { Authorization: `Bearer ${devToken}` },
    });
    const statsReqId = statsRes.headers.get('x-request-id');
    const statsData = await statsRes.json();
    assert(statsRes.status === 200, `Developer stats returned HTTP 200 (got ${statsRes.status})`);
    assert(Boolean(statsReqId && statsReqId.startsWith('EW-')), `Developer stats returned EW-XXXXXX Request ID (${statsReqId})`);
    assert(statsData.success === true, 'Developer stats success is true');
    assert(typeof statsData.stats?.activeSubscriptions === 'number', `Stats contains active subscriptions count: ${statsData.stats?.activeSubscriptions}`);
  } catch (err) {
    assert(false, `Developer dashboard load failed: ${err.message}`);
  }

  // Step 8: Browser Test G: Developer Payment Approval
  console.log('\n--- 8. BROWSER TEST G: Developer Payment Approval ---');
  try {
    const approveRes = await fetch(`${BASE_URL}/api/admin/payments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${devToken}`,
      },
      body: JSON.stringify({
        requestId: paymentRequestId,
        action: 'APPROVE',
        adminName: 'Developer Test Admin',
      }),
    });
    const approveReqId = approveRes.headers.get('x-request-id');
    const approveData = await approveRes.json();

    assert(approveRes.status === 200, `Payment approval returned HTTP 200 (got ${approveRes.status})`);
    assert(Boolean(approveReqId && approveReqId.startsWith('EW-')), `Payment approval returned EW-XXXXXX Request ID (${approveReqId})`);
    assert(approveData.success === true, 'Payment approval success is true');
    assert(approveData.subscription?.status === 'ACTIVE', `Subscription status is now ACTIVE (${approveData.subscription?.status})`);
    assert(approveData.subscription?.pdfDownloadLimit === 30, `Activated Plan 1M limit is 30 (${approveData.subscription?.pdfDownloadLimit})`);
    assert(approveData.subscription?.pdfDownloadsRemaining === 30, `Remaining limit reset to 30 (${approveData.subscription?.pdfDownloadsRemaining})`);
  } catch (err) {
    assert(false, `Developer payment approval failed: ${err.message}`);
  }

  // Summary
  console.log('\n========================================');
  console.log(`SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('========================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

run();
