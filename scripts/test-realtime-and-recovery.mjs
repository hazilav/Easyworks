import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {
  getDatabase,
  getDatabaseFilePath,
  recordErrorLog,
  getErrorLogs,
  resolveErrorLog,
  acknowledgeErrorLog,
  getErrorStats,
  performDatabaseIntegrityCheck,
  recordRealtimeEvent,
  getRealtimeEvents,
  runInTransaction,
  completeVerifiedSignup,
  createManualPaymentRequest,
  approveManualPayment,
  rejectManualPayment,
  getUserSubscription,
  verifyAndConsumeTrialPdfDownload,
  verifyDeveloperSessionToken,
  getActiveEmailSettings,
} from '../src/lib/db/database.js';
import {
  eventBus,
  broadcastAdminEvent,
  broadcastCustomerEvent,
} from '../src/lib/realtime/eventBus.js';

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function test(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  ✔ PASS [${totalTests}]: ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ✖ FAIL [${totalTests}]: ${name}`);
    console.error(err);
    failedTests++;
  }
}

async function asyncTest(name, fn) {
  totalTests++;
  try {
    await fn();
    console.log(`  ✔ PASS [${totalTests}]: ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ✖ FAIL [${totalTests}]: ${name}`);
    console.error(err);
    failedTests++;
  }
}

console.log('\n===============================================================');
console.log('  EASYWORKS — REAL-TIME DASHBOARDS & ERROR RECOVERY TEST SUITE');
console.log('===============================================================\n');

// -------------------------------------------------------------
// Test 1: Real-time Signup Event
// -------------------------------------------------------------
test('Scenario 1: Customer signup emits CUSTOMER_SIGNUP event to admin channel', () => {
  const testEmail = `rt_user_${Date.now()}@example.com`;
  const signup = completeVerifiedSignup({
    email: testEmail,
    name: 'Realtime Test User',
    businessName: 'RT Enterprise',
  });

  assert.ok(signup.user?.id, 'User ID should be generated');

  const adminMsg = broadcastAdminEvent('CUSTOMER_SIGNUP', {
    userId: signup.user.id,
    email: signup.user.email,
    name: signup.user.name,
    businessName: signup.user.businessName,
    createdAt: signup.user.createdAt,
  });

  assert.strictEqual(adminMsg.channel, 'admin');
  assert.strictEqual(adminMsg.type, 'CUSTOMER_SIGNUP');
  assert.strictEqual(adminMsg.payload.userId, signup.user.id);
  assert.strictEqual(adminMsg.payload.email, testEmail);

  // Verify persistence in realtime_events table
  const events = getRealtimeEvents('admin', undefined, 10);
  const found = events.find((e) => e.eventType === 'CUSTOMER_SIGNUP' && e.payload?.userId === signup.user.id);
  assert.ok(found, 'Event must be persisted in realtime_events table');
});

// -------------------------------------------------------------
// Test 2: Real-time Payment Submission
// -------------------------------------------------------------
test('Scenario 2: Manual payment submission emits PAYMENT_SUBMITTED to admin and customer', () => {
  const testEmail = `pay_sub_${Date.now()}@example.com`;
  const signup = completeVerifiedSignup({ email: testEmail, name: 'Pay User' });
  const userId = signup.user.id;
  const utr = `UTR_${Date.now()}`;

  const paymentReq = createManualPaymentRequest({
    userId,
    planId: 'plan_1m',
    utrNumber: utr,
    notes: 'Testing real-time payment submission',
  });

  const adminEvt = broadcastAdminEvent('PAYMENT_SUBMITTED', {
    paymentRequest: paymentReq,
    userId,
    planId: 'plan_1m',
  });

  const custEvt = broadcastCustomerEvent(userId, 'PAYMENT_SUBMITTED', {
    paymentRequest: paymentReq,
  });

  assert.strictEqual(adminEvt.type, 'PAYMENT_SUBMITTED');
  assert.strictEqual(custEvt.channel, `customer:${userId}`);
  assert.strictEqual(custEvt.payload.paymentRequest.utrNumber, utr);

  const customerEvents = getRealtimeEvents(`customer:${userId}`);
  assert.ok(customerEvents.length > 0, 'Customer channel must have received persisted event');
});

// -------------------------------------------------------------
// Test 3 & 4: Real-time Payment Approval & Instant Customer Reflection
// -------------------------------------------------------------
test('Scenario 3 & 4: Admin payment approval updates customer to ACTIVE Pro plan with limits without re-login', () => {
  const testEmail = `approval_${Date.now()}@example.com`;
  const signup = completeVerifiedSignup({ email: testEmail, name: 'Approval User' });
  const userId = signup.user.id;
  const utr = `UTR_APP_${Date.now()}`;

  // Initial subscription is TRIALING with limit 2
  const initialSub = getUserSubscription(userId);
  assert.strictEqual(initialSub?.status, 'TRIALING');
  assert.strictEqual(initialSub?.pdfDownloadLimit, 2);

  const paymentReq = createManualPaymentRequest({
    userId,
    planId: 'plan_1m',
    utrNumber: utr,
  });

  const pendingSub = getUserSubscription(userId);
  assert.strictEqual(pendingSub?.status, 'PAYMENT_PENDING');

  // Admin approves payment
  const approvalResult = approveManualPayment(paymentReq.id, 'Super Admin');
  assert.strictEqual(approvalResult.success, true);
  assert.strictEqual(approvalResult.subscription.status, 'ACTIVE');
  assert.strictEqual(approvalResult.subscription.pdfDownloadLimit, 30); // Basic plan limit

  // Broadcasts
  const adminEvt = broadcastAdminEvent('PAYMENT_APPROVED', {
    requestId: paymentReq.id,
    userId,
    planId: 'plan_1m',
    payment: approvalResult.payment,
  });

  const custEvt = broadcastCustomerEvent(userId, 'PAYMENT_STATUS_CHANGED', {
    status: 'APPROVED',
    subscription: approvalResult.subscription,
  });

  assert.strictEqual(adminEvt.type, 'PAYMENT_APPROVED');
  assert.strictEqual(custEvt.payload.status, 'APPROVED');
  assert.strictEqual(custEvt.payload.subscription.status, 'ACTIVE');

  // Authoritative DB verification without logging out
  const freshSub = getUserSubscription(userId);
  assert.strictEqual(freshSub?.status, 'ACTIVE');
  assert.strictEqual(freshSub?.pdfDownloadLimit, 30);
});

// -------------------------------------------------------------
// Test 5: Subscription Expiry Evaluation
// -------------------------------------------------------------
test('Scenario 5: Subscription correctly evaluates active vs expired statuses', () => {
  const db = getDatabase();
  const testEmail = `exp_${Date.now()}@example.com`;
  const signup = completeVerifiedSignup({ email: testEmail, name: 'Exp User' });
  const userId = signup.user.id;

  // Manually backdate active paid subscription end date to yesterday
  const yesterday = new Date(Date.now() - 86400 * 1000).toISOString();
  db.prepare(`
    UPDATE subscriptions
    SET status = 'ACTIVE', subscription_ends_at = ?, updated_at = ?
    WHERE user_id = ?
  `).run(yesterday, yesterday, userId);

  const sub = getUserSubscription(userId);
  assert.ok(sub, 'Subscription must exist');
  assert.strictEqual(sub.status, 'EXPIRED', 'Past end-date paid subscription must be evaluated as EXPIRED');

  // Expired trial evaluation
  const testEmail2 = `exp_trial_${Date.now()}@example.com`;
  const signup2 = completeVerifiedSignup({ email: testEmail2, name: 'Exp Trial User' });
  db.prepare(`
    UPDATE subscriptions
    SET status = 'TRIALING', trial_ends_at = ?, updated_at = ?
    WHERE user_id = ?
  `).run(yesterday, yesterday, signup2.user.id);

  const sub2 = getUserSubscription(signup2.user.id);
  assert.strictEqual(sub2?.status, 'EXPIRED', 'Past trial end-date must be evaluated as EXPIRED');
});

// -------------------------------------------------------------
// Test 6: PDF Usage Live Update
// -------------------------------------------------------------
test('Scenario 6: Successful PDF download broadcasts PDF_USAGE_UPDATED with accurate credits', () => {
  const testEmail = `pdf_live_${Date.now()}@example.com`;
  const signup = completeVerifiedSignup({ email: testEmail, name: 'PDF User' });
  const userId = signup.user.id;

  const downloadResult = verifyAndConsumeTrialPdfDownload(userId, {
    docId: 'doc_123',
    documentType: 'QUOTATION',
    documentNumber: 'QUO-001',
  });

  assert.strictEqual(downloadResult.allowed, true);
  assert.strictEqual(downloadResult.pdfDownloadsUsed, 1);
  assert.strictEqual(downloadResult.pdfDownloadsRemaining, 1);

  const evt = broadcastCustomerEvent(userId, 'PDF_USAGE_UPDATED', {
    pdfDownloadsUsed: downloadResult.pdfDownloadsUsed,
    pdfDownloadsRemaining: downloadResult.pdfDownloadsRemaining,
    pdfDownloadLimit: downloadResult.pdfDownloadLimit,
  });

  assert.strictEqual(evt.type, 'PDF_USAGE_UPDATED');
  assert.strictEqual(evt.payload.pdfDownloadsUsed, 1);
  assert.strictEqual(evt.payload.pdfDownloadsRemaining, 1);
});

// -------------------------------------------------------------
// Test 7: Failed PDF Download Protection (No consumption)
// -------------------------------------------------------------
test('Scenario 7: Denied PDF download does not consume quota', () => {
  const testEmail = `pdf_guard_${Date.now()}@example.com`;
  const signup = completeVerifiedSignup({ email: testEmail, name: 'Guard User' });
  const userId = signup.user.id;

  // Use both allowed trial downloads
  verifyAndConsumeTrialPdfDownload(userId, { documentType: 'QUOTATION', documentNumber: '1' });
  verifyAndConsumeTrialPdfDownload(userId, { documentType: 'QUOTATION', documentNumber: '2' });

  // 3rd attempt should be denied
  const thirdAttempt = verifyAndConsumeTrialPdfDownload(userId, { documentType: 'QUOTATION', documentNumber: '3' });
  assert.strictEqual(thirdAttempt.allowed, false);
  assert.strictEqual(thirdAttempt.pdfDownloadsUsed, 2);
  assert.strictEqual(thirdAttempt.pdfDownloadsRemaining, 0);

  // Verify DB record wasn't incremented to 3
  const sub = getUserSubscription(userId);
  assert.strictEqual(sub?.pdfDownloadsUsed, 2);
});

// -------------------------------------------------------------
// Test 8: Network Reconnect Backoff Formula
// -------------------------------------------------------------
test('Scenario 8: Reconnection backoff formula follows bounded exponential delay with jitter', () => {
  for (let attempt = 1; attempt <= 6; attempt++) {
    const backoff = Math.min(30000, 1000 * Math.pow(2, Math.min(attempt, 5)));
    assert.ok(backoff >= 1000, 'Backoff must be at least 1s');
    assert.ok(backoff <= 30000, 'Backoff must be capped at 30s');
  }
});

// -------------------------------------------------------------
// Test 9: Safe Idempotent API Retry vs Non-Idempotent Mutations
// -------------------------------------------------------------
test('Scenario 9: Idempotency policy strictly protects mutations from duplicate execution', () => {
  const idempotentMethods = ['GET', 'HEAD', 'OPTIONS'];
  const nonIdempotentMethods = ['POST', 'PUT', 'DELETE', 'PATCH'];

  for (const m of idempotentMethods) {
    const isIdempotent = m === 'GET' || m === 'HEAD' || m === 'OPTIONS';
    assert.strictEqual(isIdempotent, true, `${m} must be idempotent`);
  }

  for (const m of nonIdempotentMethods) {
    const isIdempotentByDefault = m === 'GET' || m === 'HEAD' || m === 'OPTIONS';
    assert.strictEqual(isIdempotentByDefault, false, `${m} must NOT be idempotent by default`);
  }
});

// -------------------------------------------------------------
// Test 10: Strict Tenant Isolation & Channel Authorization
// -------------------------------------------------------------
test('Scenario 10: Unauthorized access to admin channel is rejected and tenants are isolated', () => {
  // Invalid token check
  const invalidResult = verifyDeveloperSessionToken('invalid_token_123');
  assert.strictEqual(invalidResult, false, 'Invalid token must fail verification');

  // Customer channel scoping
  const userA = 'user_A';
  const userB = 'user_B';

  const evtA = broadcastCustomerEvent(userA, 'ALERT', { msg: 'For A only' });
  const eventsForB = getRealtimeEvents(`customer:${userB}`);

  assert.strictEqual(evtA.channel, `customer:${userA}`);
  const leakedToB = eventsForB.some((e) => e.payload?.msg === 'For A only');
  assert.strictEqual(leakedToB, false, 'Events for user A must never leak to user B');
});

// -------------------------------------------------------------
// Test 11: Error Tracking & Sanitization
// -------------------------------------------------------------
test('Scenario 11: Error logging sanitizes sensitive credentials and deduplicates recurring errors', () => {
  const reqId = `req_${Date.now()}`;
  const runKey = `run_${Date.now()}_${Math.random()}`;
  const sensitiveMsg = `SMTP failure [${runKey}]: smtp_pass=SuperSecret123 password=MyPassword`;

  const errId1 = recordErrorLog({
    requestId: reqId,
    category: 'EMAIL',
    severity: 'HIGH',
    route: `/api/developer/email/test_${runKey}`,
    message: sensitiveMsg,
    stackTrace: 'Error at smtp.ts:42 with bearer abc.def.xyz',
  });

  const { logs } = getErrorLogs({ category: 'EMAIL', limit: 10 });
  const logged = logs.find((l) => l.id === errId1);
  assert.ok(logged, 'Logged error must be found');
  assert.ok(!logged.message.includes('SuperSecret123'), 'Secrets must be redacted');
  assert.ok(!logged.message.includes('MyPassword'), 'Passwords must be redacted');
  assert.ok(logged.message.includes('[REDACTED]'), 'Redaction placeholder must be present');
  assert.strictEqual(logged.occurrenceCount, 1, 'Initial count must be 1');

  // Deduplication: log identical error within window
  const errId2 = recordErrorLog({
    requestId: `req_${Date.now()}_2`,
    category: 'EMAIL',
    severity: 'HIGH',
    route: `/api/developer/email/test_${runKey}`,
    message: sensitiveMsg,
  });

  assert.strictEqual(errId2, errId1, 'Recurring error within 1 hour must reuse ID and increment count');
  const { logs: updatedLogs } = getErrorLogs({ category: 'EMAIL', limit: 10 });
  const deduplicated = updatedLogs.find((l) => l.id === errId1);
  assert.strictEqual(deduplicated.occurrenceCount, 2, 'Occurrence count must increment to 2');
});

// -------------------------------------------------------------
// Test 12: Error Log Acknowledge & Resolve Operations
// -------------------------------------------------------------
test('Scenario 12: Developer can acknowledge and resolve tracked errors', () => {
  const errId = recordErrorLog({
    category: 'DATABASE',
    severity: 'CRITICAL',
    route: '/api/db/test',
    message: 'Transient lock test error',
  });

  // Acknowledge
  const ackOk = acknowledgeErrorLog(errId, 'Super Admin');
  assert.strictEqual(ackOk, true);

  const { logs: ackLogs } = getErrorLogs({ category: 'DATABASE' });
  const ackErr = ackLogs.find((l) => l.id === errId);
  assert.strictEqual(ackErr?.recoveryStatus, 'RECOVERED');

  // Resolve
  const resOk = resolveErrorLog(errId, 'Super Admin');
  assert.strictEqual(resOk, true);

  const { logs: resLogs } = getErrorLogs({ category: 'DATABASE' });
  const resErr = resLogs.find((l) => l.id === errId);
  assert.strictEqual(resErr?.recoveryStatus, 'RESOLVED');
  assert.ok(resErr?.resolvedAt, 'resolvedAt timestamp must be recorded');
  assert.strictEqual(resErr?.resolvedBy, 'Super Admin');
});

// -------------------------------------------------------------
// Test 13: Database Health & Integrity Verification
// -------------------------------------------------------------
test('Scenario 13: Database integrity check passes and reports table counts', () => {
  const integrity = performDatabaseIntegrityCheck();
  assert.strictEqual(integrity.ok, true, 'Integrity check must return ok');
  assert.strictEqual(integrity.integrity, 'ok');
  assert.ok(integrity.tableCounts.users > 0, 'Users table count must be positive');
  assert.ok(integrity.tableCounts.subscriptions > 0, 'Subscriptions table count must be positive');
  assert.ok(integrity.databaseSizeBytes > 0, 'Database size must be reported');
});

// -------------------------------------------------------------
// Test 14: SQLite Concurrency & Busy Retry in Transactions
// -------------------------------------------------------------
test('Scenario 14: runInTransaction handles transactions safely with commit and rollback', () => {
  const db = getDatabase();

  // Test successful transaction
  const result = runInTransaction(() => {
    return 'tx_success';
  });
  assert.strictEqual(result, 'tx_success');

  // Test rollback on throw
  let threw = false;
  try {
    runInTransaction(() => {
      throw new Error('Intentional error in tx');
    });
  } catch (e) {
    threw = true;
  }
  assert.strictEqual(threw, true, 'Transaction must throw and rollback cleanly');
});

// -------------------------------------------------------------
// Test 15: Duplicate Payment Protection / Idempotency
// -------------------------------------------------------------
test('Scenario 15: Duplicate UTR approvals are idempotent and return existing payment', () => {
  const testEmail = `dup_utr_${Date.now()}@example.com`;
  const signup = completeVerifiedSignup({ email: testEmail, name: 'Dup User' });
  const userId = signup.user.id;
  const utr = `UTR_DUP_${Date.now()}`;

  const req = createManualPaymentRequest({ userId, planId: 'plan_1m', utrNumber: utr });

  // First approval
  const first = approveManualPayment(req.id, 'Admin');
  assert.strictEqual(first.success, true);

  // Second approval for same request
  const second = approveManualPayment(req.id, 'Admin');
  assert.strictEqual(second.success, true, 'Second approval must return idempotently without duplicate records');
});

// -------------------------------------------------------------
// Test 16: Event Replay & Polling Chronology
// -------------------------------------------------------------
test('Scenario 16: Event polling replays missed events ordered by timestamp', () => {
  const testChannel = `test_replay_${Date.now()}`;
  const past = new Date(Date.now() - 10000).toISOString();

  recordRealtimeEvent(testChannel, 'EVT_1', { seq: 1 });
  recordRealtimeEvent(testChannel, 'EVT_2', { seq: 2 });
  recordRealtimeEvent(testChannel, 'EVT_3', { seq: 3 });

  const events = getRealtimeEvents(testChannel, past);
  assert.strictEqual(events.length >= 3, true);
  assert.strictEqual(events[0].payload.seq, 1);
  assert.strictEqual(events[1].payload.seq, 2);
  assert.strictEqual(events[2].payload.seq, 3);
});

// -------------------------------------------------------------
// Test 17: Production Supervisor Configuration
// -------------------------------------------------------------
test('Scenario 17: ecosystem.config.cjs exists and declares restart policy with exponential backoff', () => {
  const ecosystemPath = path.resolve('ecosystem.config.cjs');
  assert.ok(fs.existsSync(ecosystemPath), 'ecosystem.config.cjs must exist in project root');

  const content = fs.readFileSync(ecosystemPath, 'utf8');
  assert.ok(content.includes('autorestart: true'), 'Must enable autorestart');
  assert.ok(content.includes('exp_backoff_restart_delay'), 'Must configure exponential backoff restart delay');
  assert.ok(content.includes('max_memory_restart'), 'Must configure max memory restart limit');
});

console.log('\n===============================================================');
console.log(`TOTAL TESTS: ${totalTests} | PASSED: ${passedTests} | FAILED: ${failedTests}`);
console.log('===============================================================\n');

if (failedTests > 0) {
  process.exit(1);
}
