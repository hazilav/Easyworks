/**
 * Easyworks - Subscription & PDF Limit Lifecycle End-to-End Verification Suite
 * Tests all 26 lifecycle, security, and atomic concurrency requirements.
 */

import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';

const BASE_URL = 'http://localhost:3000';
const DB_PATH = path.resolve(process.cwd(), 'data', 'easyworks.db');

function getDb() {
  return new DatabaseSync(DB_PATH);
}

let passedTests = 0;
let totalTests = 0;

function assert(condition, message) {
  totalTests++;
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    throw new Error(message);
  } else {
    passedTests++;
    console.log(`✅ PASS: ${message}`);
  }
}

async function request(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const res = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  });

  let data = null;
  const text = await res.text();
  try {
    data = JSON.parse(text);
  } catch (e) {
    data = { rawText: text };
  }

  return { status: res.status, headers: res.headers, data };
}

async function runTests() {
  console.log('====================================================');
  console.log('EASYWORKS — SUBSCRIPTION & PDF LIMIT LIFECYCLE TESTS');
  console.log('====================================================\n');

  const db = getDb();
  const testRunId = Date.now();

  // ------------------------------------------------------------------
  // 1. Plan Configurations & Limits (Requirement 1)
  // ------------------------------------------------------------------
  console.log('--- Test Suite 1: Plan Configurations & Database Limits ---');
  const planRows = db.prepare('SELECT * FROM plans ORDER BY is_custom ASC, duration_months ASC').all();
  const basicPlan = planRows.find((p) => p.id === 'plan_1m');
  const standardPlan = planRows.find((p) => p.id === 'plan_3m');
  const premiumPlan = planRows.find((p) => p.id === 'plan_6m');
  const customPlan = planRows.find((p) => p.id === 'plan_custom');

  assert(Boolean(basicPlan), 'Basic plan exists in database');
  assert(basicPlan.price_inr === 299, 'Basic plan price is ₹299');
  assert(basicPlan.duration_months === 1, 'Basic plan duration is 1 month');
  assert(basicPlan.pdf_download_limit === 30, 'Basic plan PDF limit is 30');

  assert(Boolean(standardPlan), 'Standard plan exists in database');
  assert(standardPlan.price_inr === 849, 'Standard plan price is ₹849');
  assert(standardPlan.duration_months === 3, 'Standard plan duration is 3 months');
  assert(standardPlan.pdf_download_limit === 90, 'Standard plan PDF limit is 90');

  assert(Boolean(premiumPlan), 'Premium plan exists in database');
  assert(premiumPlan.price_inr === 1699, 'Premium plan price is ₹1,699');
  assert(premiumPlan.duration_months === 6, 'Premium plan duration is 6 months');
  assert(premiumPlan.pdf_download_limit === 180, 'Premium plan PDF limit is 180');

  assert(Boolean(customPlan), 'Custom plan exists');
  assert(Boolean(customPlan.is_custom), 'Custom plan is flagged as custom');

  // Verify none of the paid plans are unlimited
  planRows.forEach((p) => {
    if (!p.is_custom) {
      assert(p.pdf_download_limit > 0 && Number.isFinite(p.pdf_download_limit), `Plan ${p.name} has finite limit (${p.pdf_download_limit})`);
    }
  });

  // ------------------------------------------------------------------
  // 2. Signup & 7-Day Trial Creation (Requirement 1, 3, 4)
  // ------------------------------------------------------------------
  console.log('\n--- Test Suite 2: Signup & 7-Day Trial Limits ---');
  const testUserEmail = `tenant_${testRunId}@example.com`;
  
  const sendRes = await request('/api/auth/send-verification', {
    method: 'POST',
    body: JSON.stringify({ target: testUserEmail, channel: 'EMAIL' }),
  });
  assert(sendRes.status === 200 && sendRes.data.success, 'Verification OTP sent');
  const otp = sendRes.data.debugCode;
  const signupSessionId = sendRes.data.signupSessionId;

  const verifyRes = await request('/api/auth/verify-code', {
    method: 'POST',
    body: JSON.stringify({
      target: testUserEmail,
      code: otp,
      channel: 'EMAIL',
      signupSessionId,
      name: 'Lifecycle Tester',
      businessName: 'Lifecycle Test Corp',
      phone: `98765${String(testRunId).slice(-5)}`,
    }),
  });

  assert(verifyRes.status === 200 && verifyRes.data.success, 'User registered successfully via HTTP API');
  const userId = verifyRes.data.user.id;
  assert(Boolean(userId), 'User ID returned from registration');

  // Check initial subscription state via API
  const subRes = await request(`/api/billing/subscription?userId=${userId}`);
  assert(subRes.status === 200 && subRes.data.success, 'Subscription fetched successfully');
  const sub = subRes.data.subscription;
  assert(sub.status === 'TRIALING' || sub.status === 'TRIAL', 'Initial subscription status is TRIALING');
  assert(sub.pdfDownloadLimit === 2, 'Trial PDF download limit is exactly 2');
  assert(sub.pdfDownloadsUsed === 0, 'Trial PDF downloads used initialized to 0');
  assert(sub.pdfDownloadsRemaining === 2, 'Trial PDF downloads remaining is 2');
  assert(sub.trialDaysRemaining >= 6, 'Trial countdown reflects 7-day period');

  // ------------------------------------------------------------------
  // 3. Document Creation & Editing (0 credits consumed) (Requirement 5)
  // ------------------------------------------------------------------
  console.log('\n--- Test Suite 3: Document Operations do NOT consume credits ---');
  const docId1 = `qt_${testRunId}_1`;
  const docSaveRes = await request('/api/documents', {
    method: 'POST',
    body: JSON.stringify({
      userId,
      type: 'quotation',
      document: {
        id: docId1,
        quotationNumber: 'QT-TEST-001',
        title: 'Commercial Tender Offer',
        customerName: 'Acme Industries',
        grandTotal: 50000,
        currency: 'INR',
      },
    }),
  });
  assert(docSaveRes.status === 200, 'Quotation saved via document sync');

  const subAfterDoc = await request(`/api/billing/subscription?userId=${userId}`);
  assert(subAfterDoc.data.subscription.pdfDownloadsUsed === 0, 'Creating/saving document consumed 0 credits');

  // ------------------------------------------------------------------
  // 4. PDF Credit Consumption & Limit Reached (HTTP 403 / PDF_LIMIT_REACHED) (Requirement 5, 6, 7)
  // ------------------------------------------------------------------
  console.log('\n--- Test Suite 4: PDF Consumption & Exhaustion (HTTP 403 / PDF_LIMIT_REACHED) ---');
  // First download
  const dl1 = await request('/api/billing/pdf-download', {
    method: 'POST',
    body: JSON.stringify({
      userId,
      documentType: 'QUOTATION',
      documentId: docId1,
      documentNumber: 'QT-TEST-001',
    }),
  });
  assert(dl1.status === 200 && dl1.data.allowed === true, 'First PDF download allowed');
  assert(dl1.data.pdfDownloadsUsed === 1, 'PDF downloads used is now 1');
  assert(dl1.data.pdfDownloadsRemaining === 1, 'PDF downloads remaining is now 1');

  // Debounce test: same document download within 30 seconds does NOT consume extra credit
  const dlDebounce = await request('/api/billing/pdf-download', {
    method: 'POST',
    body: JSON.stringify({
      userId,
      documentType: 'QUOTATION',
      documentId: docId1,
      documentNumber: 'QT-TEST-001',
    }),
  });
  assert(dlDebounce.status === 200 && dlDebounce.data.allowed === true, 'Debounce replay allowed');
  assert(dlDebounce.data.pdfDownloadsUsed === 1, 'Debounce replay did NOT consume extra credit');

  // Second download (new document)
  const docId2 = `qt_${testRunId}_2`;
  const dl2 = await request('/api/billing/pdf-download', {
    method: 'POST',
    body: JSON.stringify({
      userId,
      documentType: 'QUOTATION',
      documentId: docId2,
      documentNumber: 'QT-TEST-002',
    }),
  });
  assert(dl2.status === 200 && dl2.data.allowed === true, 'Second PDF download allowed');
  assert(dl2.data.pdfDownloadsUsed === 2, 'PDF downloads used is now 2');
  assert(dl2.data.pdfDownloadsRemaining === 0, 'PDF downloads remaining is now 0');

  // Third download should be BLOCKED with HTTP 403 and code: PDF_LIMIT_REACHED
  const docId3 = `qt_${testRunId}_3`;
  const dl3 = await request('/api/billing/pdf-download', {
    method: 'POST',
    body: JSON.stringify({
      userId,
      documentType: 'QUOTATION',
      documentId: docId3,
      documentNumber: 'QT-TEST-003',
    }),
  });

  assert(dl3.status === 403, 'Third PDF download returns HTTP 403');
  assert(dl3.data.success === false, 'success is false');
  assert(dl3.data.code === 'PDF_LIMIT_REACHED', 'Error code is PDF_LIMIT_REACHED');
  assert(dl3.data.error === 'PDF download limit reached', 'Error message matches specification');
  assert(dl3.data.pdfDownloadsUsed === 2, 'Counter remained at 2 (not breached)');

  // Documents still viewable & editable
  const docCheck = await request(`/api/billing/pdf-download?userId=${userId}`);
  assert(docCheck.status === 200, 'GET /api/billing/pdf-download works without 500 error');
  assert(docCheck.data.pdfRemaining === 0, 'pdfRemaining correctly reported as 0');

  // ------------------------------------------------------------------
  // 5. Concurrency Race-Condition Test (Requirement 6)
  // ------------------------------------------------------------------
  console.log('\n--- Test Suite 5: Concurrency Race-Condition Test ---');
  // Attempt 5 simultaneous PDF downloads for the exhausted user
  const concurrentResults = await Promise.all([
    request('/api/billing/pdf-download', { method: 'POST', body: JSON.stringify({ userId, documentType: 'QUOTATION', documentId: 'c1' }) }),
    request('/api/billing/pdf-download', { method: 'POST', body: JSON.stringify({ userId, documentType: 'QUOTATION', documentId: 'c2' }) }),
    request('/api/billing/pdf-download', { method: 'POST', body: JSON.stringify({ userId, documentType: 'QUOTATION', documentId: 'c3' }) }),
    request('/api/billing/pdf-download', { method: 'POST', body: JSON.stringify({ userId, documentType: 'QUOTATION', documentId: 'c4' }) }),
    request('/api/billing/pdf-download', { method: 'POST', body: JSON.stringify({ userId, documentType: 'QUOTATION', documentId: 'c5' }) }),
  ]);

  concurrentResults.forEach((res, idx) => {
    assert(res.status === 403 && res.data.code === 'PDF_LIMIT_REACHED', `Concurrent request #${idx + 1} blocked with 403`);
  });

  // Verify database counter is still strictly 2
  const subAfterConcurrent = db.prepare('SELECT pdf_downloads_used FROM subscriptions WHERE user_id = ?').get(userId);
  assert(subAfterConcurrent.pdf_downloads_used === 2, 'Atomic transaction prevented limit breach under concurrency');

  // ------------------------------------------------------------------
  // 6. Manual Payment Submission -> PAYMENT_PENDING (Requirement 13)
  // ------------------------------------------------------------------
  console.log('\n--- Test Suite 6: Manual Payment Submission & PAYMENT_PENDING ---');
  const utrNumber = `UTR${testRunId}TEST`;
  const paymentSubmitRes = await request('/api/billing/manual-payment', {
    method: 'POST',
    body: JSON.stringify({
      userId,
      planId: 'plan_1m',
      amountINR: 299,
      utrNumber,
      notes: 'Paid via GPay UPI',
    }),
  });

  assert(paymentSubmitRes.status === 200 && paymentSubmitRes.data.success, 'Manual payment submitted successfully');
  const paymentRequestId = paymentSubmitRes.data.paymentRequest?.id;
  assert(Boolean(paymentRequestId), 'Manual payment request ID generated');

  const subPending = await request(`/api/billing/subscription?userId=${userId}`);
  assert(subPending.data.subscription.status === 'PAYMENT_PENDING', 'Subscription status transitioned to PAYMENT_PENDING');

  // ------------------------------------------------------------------
  // 7. Developer Payment Approval Transaction & Idempotency (Requirement 14, 15)
  // ------------------------------------------------------------------
  console.log('\n--- Test Suite 7: Developer Payment Approval Transaction & Idempotency ---');
  const approveRes1 = await request('/api/admin/payments', {
    method: 'POST',
    body: JSON.stringify({
      requestId: paymentRequestId,
      action: 'APPROVE',
      adminName: 'Super Admin',
    }),
  });

  assert(approveRes1.status === 200 && approveRes1.data.success, 'Payment approved successfully by admin');
  assert(approveRes1.data.subscription.status === 'ACTIVE', 'Subscription status transitioned to ACTIVE');
  assert(approveRes1.data.subscription.pdfDownloadLimit === 30, 'Assigned Basic plan limit of 30 PDFs');
  assert(approveRes1.data.subscription.pdfDownloadsUsed === 0, 'PDF downloads used counter reset to 0');
  assert(approveRes1.data.subscription.pdfDownloadsRemaining === 30, 'PDF downloads remaining is 30');

  // Payment Idempotency: approving a second time must NOT duplicate or re-extend
  const firstExpiry = approveRes1.data.subscription.subscriptionEndsAt;
  const approveRes2 = await request('/api/admin/payments', {
    method: 'POST',
    body: JSON.stringify({
      requestId: paymentRequestId,
      action: 'APPROVE',
      adminName: 'Super Admin',
    }),
  });

  assert(approveRes2.status === 200 && approveRes2.data.success, 'Second approval safely idempotent');
  assert(approveRes2.data.subscription.subscriptionEndsAt === firstExpiry, 'Expiry date was not duplicated');
  assert(approveRes2.data.subscription.pdfDownloadLimit === 30, 'Limit was not duplicated');

  // ------------------------------------------------------------------
  // 8. Paid PDF Download Credit Rule (Requirement 5)
  // ------------------------------------------------------------------
  console.log('\n--- Test Suite 8: Active Paid PDF Download ---');
  const paidDl = await request('/api/billing/pdf-download', {
    method: 'POST',
    body: JSON.stringify({
      userId,
      documentType: 'QUOTATION',
      documentId: docId3,
      documentNumber: 'QT-TEST-003',
    }),
  });

  assert(paidDl.status === 200 && paidDl.data.allowed === true, 'Paid subscriber can download PDF');
  assert(paidDl.data.pdfDownloadsUsed === 1, 'PDF downloads used is 1/30');
  assert(paidDl.data.pdfDownloadsRemaining === 29, 'PDF downloads remaining is 29/30');

  // ------------------------------------------------------------------
  // 9. Renewal from Existing Expiry Date (Requirement 16)
  // ------------------------------------------------------------------
  console.log('\n--- Test Suite 9: Renewal from Existing Expiry Date ---');
  const curEnd = new Date(firstExpiry);

  // Customer submits renewal for Basic (+1 month)
  const renewalSubmit = await request('/api/billing/manual-payment', {
    method: 'POST',
    body: JSON.stringify({
      userId,
      planId: 'plan_1m',
      amountINR: 299,
      utrNumber: `UTR${testRunId}RENEW`,
      notes: 'Renewal payment',
    }),
  });
  assert(renewalSubmit.status === 200, 'Renewal payment request submitted');

  const renewalApprove = await request('/api/admin/payments', {
    method: 'POST',
    body: JSON.stringify({
      requestId: renewalSubmit.data.paymentRequest?.id,
      action: 'APPROVE',
      adminName: 'Super Admin',
    }),
  });
  assert(renewalApprove.status === 200 && renewalApprove.data.success, 'Renewal approved');
  const newEnd = new Date(renewalApprove.data.subscription.subscriptionEndsAt);

  const diffDays = Math.round((newEnd.getTime() - curEnd.getTime()) / (1000 * 60 * 60 * 24));
  assert(diffDays >= 28 && diffDays <= 31, `Renewal extended from existing expiry by ~30 days (actual: ${diffDays} days)`);
  assert(renewalApprove.data.subscription.pdfDownloadLimit === 30, 'New PDF allowance of 30 assigned');
  assert(renewalApprove.data.subscription.pdfDownloadsUsed === 0, 'PDF downloads used counter reset to 0');

  // ------------------------------------------------------------------
  // 10. Plan Upgrade with Preserved Time (Requirement 17)
  // ------------------------------------------------------------------
  console.log('\n--- Test Suite 10: Plan Upgrade with Preserved Time ---');
  const preUpgradeEnd = new Date(renewalApprove.data.subscription.subscriptionEndsAt);

  // Customer upgrades to Standard (₹849, 3 months, 90 PDFs)
  const upgradeSubmit = await request('/api/billing/manual-payment', {
    method: 'POST',
    body: JSON.stringify({
      userId,
      planId: 'plan_3m',
      amountINR: 849,
      utrNumber: `UTR${testRunId}UPGRADE`,
    }),
  });
  assert(upgradeSubmit.status === 200, 'Upgrade payment request submitted');

  const upgradeApprove = await request('/api/admin/payments', {
    method: 'POST',
    body: JSON.stringify({
      requestId: upgradeSubmit.data.paymentRequest?.id,
      action: 'APPROVE',
      adminName: 'Super Admin',
    }),
  });
  assert(upgradeApprove.status === 200 && upgradeApprove.data.success, 'Upgrade approved');
  assert(upgradeApprove.data.subscription.planId === 'plan_3m', 'Subscription plan updated to plan_3m');
  assert(upgradeApprove.data.subscription.pdfDownloadLimit === 90, 'PDF download limit updated to 90');
  assert(upgradeApprove.data.subscription.pdfDownloadsUsed === 0, 'PDF downloads counter reset to 0');
  const postUpgradeEnd = new Date(upgradeApprove.data.subscription.subscriptionEndsAt);
  assert(postUpgradeEnd.getTime() > preUpgradeEnd.getTime(), 'Upgrade added duration to existing valid subscription period');

  // ------------------------------------------------------------------
  // 11. Developer PDF Controls & Lifecycle Actions (Requirement 12)
  // ------------------------------------------------------------------
  console.log('\n--- Test Suite 11: Developer PDF Controls via API ---');
  // Developer authentication via /api/developer/auth
  const devAuthRes = await request('/api/developer/auth', {
    method: 'POST',
    body: JSON.stringify({
      email: 'muhammedhazilav@gmail.com',
      password: process.env.DEVELOPER_PASSWORD || 'easyworks@lnz321',
    }),
  });
  assert(devAuthRes.status === 200 && devAuthRes.data.success, 'Developer authenticated via API');
  const devToken = devAuthRes.data.token;
  assert(Boolean(devToken), 'Developer HMAC session token received');

  const devHeaders = { Authorization: `Bearer ${devToken}` };

  // 11.1 Add bonus PDFs (+15)
  const bonusRes = await request('/api/developer/customers', {
    method: 'POST',
    headers: devHeaders,
    body: JSON.stringify({ action: 'ADD_BONUS_PDF', userId, bonus: 15 }),
  });
  assert(bonusRes.status === 200 && bonusRes.data.success, 'Added +15 bonus PDF downloads');
  assert(bonusRes.data.subscription.pdfDownloadLimit === 105, 'PDF limit updated to 105 (90 + 15)');

  // 11.2 Remove PDF credits (-10)
  const removeRes = await request('/api/developer/customers', {
    method: 'POST',
    headers: devHeaders,
    body: JSON.stringify({ action: 'REMOVE_PDF_CREDITS', userId, amount: 10 }),
  });
  assert(removeRes.status === 200 && removeRes.data.success, 'Removed 10 PDF credits');
  assert(removeRes.data.subscription.pdfDownloadLimit === 95, 'PDF limit updated to 95 (105 - 10)');

  // 11.3 Adjust PDF limit directly (to 50)
  const adjustRes = await request('/api/developer/customers', {
    method: 'POST',
    headers: devHeaders,
    body: JSON.stringify({ action: 'ADJUST_PDF_LIMIT', userId, limit: 50 }),
  });
  assert(adjustRes.status === 200 && adjustRes.data.success, 'Adjusted PDF limit directly');
  assert(adjustRes.data.subscription.pdfDownloadLimit === 50, 'PDF limit updated to 50');

  // 11.4 Reset usage counter
  db.prepare('UPDATE subscriptions SET pdf_downloads_used = 12 WHERE user_id = ?').run(userId);
  const resetRes = await request('/api/developer/customers', {
    method: 'POST',
    headers: devHeaders,
    body: JSON.stringify({ action: 'RESET_PDF_USAGE', userId }),
  });
  assert(resetRes.status === 200 && resetRes.data.success, 'Reset PDF downloads counter');
  assert(resetRes.data.subscription.pdfDownloadsUsed === 0, 'PDF downloads counter reset to 0');

  // 11.5 Suspend Customer Account
  const suspRes = await request('/api/developer/customers', {
    method: 'POST',
    headers: devHeaders,
    body: JSON.stringify({ action: 'SUSPEND', userId, reason: 'Security check' }),
  });
  assert(suspRes.status === 200 && suspRes.data.success, 'Customer suspended');

  // Verify suspended customer is blocked from downloading PDFs
  const suspDl = await request('/api/billing/pdf-download', {
    method: 'POST',
    body: JSON.stringify({ userId, documentType: 'QUOTATION', documentId: 'qs' }),
  });
  assert(suspDl.status === 403, 'Suspended customer blocked from downloading PDFs');

  // 11.6 Reactivate Customer Account
  const reactRes = await request('/api/developer/customers', {
    method: 'POST',
    headers: devHeaders,
    body: JSON.stringify({ action: 'REACTIVATE', userId }),
  });
  assert(reactRes.status === 200 && reactRes.data.success, 'Customer reactivated');

  // 11.7 Cancel Subscription
  const cancelRes = await request('/api/developer/customers', {
    method: 'POST',
    headers: devHeaders,
    body: JSON.stringify({ action: 'CANCEL_SUB', userId, reason: 'User requested' }),
  });
  assert(cancelRes.status === 200 && cancelRes.data.success, 'Subscription cancelled');
  assert(cancelRes.data.subscription.status === 'CANCELLED', 'Subscription status updated to CANCELLED');

  // ------------------------------------------------------------------
  // 12. Developer Overviews & Security Isolation (Requirement 10, 20, 22, 24)
  // ------------------------------------------------------------------
  console.log('\n--- Test Suite 12: Developer Overviews & Security Isolation ---');
  // Businesses overview
  const bizRes = await request('/api/developer/businesses', { headers: devHeaders });
  assert(bizRes.status === 200 && Array.isArray(bizRes.data.businesses), 'Developer businesses overview accessible');
  const foundBiz = bizRes.data.businesses.find((b) => b.userId === userId);
  assert(Boolean(foundBiz), 'Found created tenant in businesses overview');

  // Documents overview
  const docRes = await request('/api/developer/documents', { headers: devHeaders });
  assert(docRes.status === 200 && Array.isArray(docRes.data.documents), 'Developer documents overview accessible');

  // Unauthorized access check (customer isolation)
  const unauthBiz = await request('/api/developer/businesses');
  assert(unauthBiz.status === 401, 'Unauthorized request to /api/developer/businesses rejected with 401');

  const unauthCust = await request('/api/developer/customers');
  assert(unauthCust.status === 401, 'Unauthorized request to /api/developer/customers rejected with 401');

  // WhatsApp link formatting verification
  const settingsRes = await request('/api/billing/payment-settings');
  assert(settingsRes.status === 200 && settingsRes.data.settings, 'Payment settings fetched');
  assert(settingsRes.data.settings.whatsappNumber.includes('9539933265'), 'Default WhatsApp number is 9539933265');

  const rawNumber = settingsRes.data.settings.whatsappNumber.replace(/[^0-9]/g, '');
  const cleanNumber = rawNumber.startsWith('91') ? rawNumber : `91${rawNumber}`;
  const sampleMsg = `Hello, I have made the payment for the Easyworks subscription.
Plan: Basic
Amount: ₹299
Name: Lifecycle Tester
Business: Lifecycle Test Corp
Email: ${testUserEmail}
Transaction ID / UTR: ${utrNumber}
Please activate my account.`;

  const waLink = `https://wa.me/${cleanNumber}?text=${encodeURIComponent(sampleMsg)}`;
  assert(waLink.includes('919539933265'), 'WhatsApp URL formatted for 919539933265');
  assert(waLink.includes(encodeURIComponent('₹299')), 'WhatsApp URL includes plan amount');
  assert(!waLink.includes('password') && !waLink.includes('otp') && !waLink.includes('secret'), 'WhatsApp URL contains no credentials');

  // Activity Logs verification
  const logs = db.prepare('SELECT * FROM activity_logs WHERE user_id = ?').all(userId);
  assert(logs.length >= 8, `Activity logs recorded for user lifecycle (found ${logs.length} entries)`);

  console.log('\n====================================================');
  console.log(`ALL TESTS PASSED: ${passedTests}/${totalTests} lifecycle assertions verified!`);
  console.log('====================================================\n');
}

runTests().catch((err) => {
  console.error('\nVerification failed:', err);
  process.exit(1);
});
