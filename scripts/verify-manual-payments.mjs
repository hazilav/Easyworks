// Automated Verification Script for Manual Payment and WhatsApp Confirmation System
import http from 'node:http';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';

async function request(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  const res = await fetch(url, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const json = await res.json().catch(() => null);
  return { status: res.status, ok: res.ok, data: json };
}

async function runTests() {
  console.log('=== STARTING MANUAL PAYMENT SYSTEM VERIFICATION ===\n');

  // Test 1: Check Plans & Pricing
  console.log('Test 1: Verifying Plans and Pricing (1M: ₹249, 3M: ₹649, 6M: ₹1099)...');
  const plansRes = await request('/api/billing/plans');
  if (!plansRes.ok || !plansRes.data?.plans) {
    throw new Error('Failed to fetch plans: ' + JSON.stringify(plansRes));
  }
  const plans = plansRes.data.plans;
  const p1m = plans.find((p) => p.id === 'plan_1m');
  const p3m = plans.find((p) => p.id === 'plan_3m');
  const p6m = plans.find((p) => p.id === 'plan_6m');

  console.log(`- 1 Month: ₹${p1m?.priceINR} (expected 249)`);
  console.log(`- 3 Months: ₹${p3m?.priceINR} (expected 649)`);
  console.log(`- 6 Months: ₹${p6m?.priceINR} (expected 1099)`);

  if (p1m?.priceINR !== 249 || p3m?.priceINR !== 649 || p6m?.priceINR !== 1099) {
    throw new Error('Plan pricing does not match requirements!');
  }
  console.log('✓ Test 1 Passed.\n');

  // Test 2: Payment Settings API
  console.log('Test 2: Verifying Payment Settings API...');
  const settingsRes = await request('/api/billing/payment-settings');
  if (!settingsRes.ok || !settingsRes.data?.settings) {
    throw new Error('Failed to fetch payment settings: ' + JSON.stringify(settingsRes));
  }
  console.log('Current Settings:', {
    upiId: settingsRes.data.settings.upiId,
    bankName: settingsRes.data.settings.bankName,
    whatsappNumber: settingsRes.data.settings.whatsappNumber,
  });
  console.log('✓ Test 2 Passed.\n');

  // Test 3: Create a test user with a trial
  console.log('Test 3: Creating test user and initializing 7-day trial...');
  const testUserId = 'test_user_' + Date.now();
  const testEmail = `tester_${Date.now()}@example.com`;
  const userRes = await request('/api/billing/subscription', {
    method: 'POST',
    body: {
      userId: testUserId,
      email: testEmail,
      name: 'Verification User',
      businessName: 'Verification Agency Ltd',
    },
  });

  if (!userRes.ok || !userRes.data?.subscription) {
    throw new Error('Failed to initialize user subscription: ' + JSON.stringify(userRes));
  }
  const initialSub = userRes.data.subscription;
  console.log(`- Initial Subscription Status: ${initialSub.status}`);
  console.log(`- Trial Downloads: ${initialSub.trialPdfDownloads} / 2`);
  if (initialSub.status !== 'TRIALING' && initialSub.status !== 'TRIAL') {
    throw new Error('Expected initial status TRIALING, got ' + initialSub.status);
  }
  console.log('✓ Test 3 Passed.\n');

  // Test 4: Submit Manual Payment Confirmation Form
  console.log('Test 4: Submitting Manual Payment Confirmation (UTR & Screenshot)...');
  const testUtr = 'UTR-' + Math.floor(100000000000 + Math.random() * 900000000000);
  const submitRes = await request('/api/billing/manual-payment', {
    method: 'POST',
    body: {
      userId: testUserId,
      planId: 'plan_1m',
      utrNumber: testUtr,
      notes: 'Test payment via Google Pay',
      screenshotUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    },
  });

  if (!submitRes.ok || !submitRes.data?.success) {
    throw new Error('Failed to submit manual payment: ' + JSON.stringify(submitRes));
  }
  console.log('Submit Response:', submitRes.data.message);
  console.log(`- Subscription Status after submission: ${submitRes.data.subscription?.status}`);
  if (submitRes.data.subscription?.status !== 'PAYMENT_PENDING') {
    throw new Error('Expected status PAYMENT_PENDING, got ' + submitRes.data.subscription?.status);
  }
  const requestId = submitRes.data.paymentRequest.id;
  console.log(`- Created Request ID: ${requestId}`);
  console.log('✓ Test 4 Passed.\n');

  // Test 5: Verify Admin can view the pending payment
  console.log('Test 5: Checking Admin payments endpoint for pending request...');
  const adminListRes = await request('/api/admin/payments?status=PENDING');
  if (!adminListRes.ok || !adminListRes.data?.requests) {
    throw new Error('Failed to fetch admin payments: ' + JSON.stringify(adminListRes));
  }
  const found = adminListRes.data.requests.find((r) => r.id === requestId);
  if (!found) {
    throw new Error('Submitted payment request not found in admin list!');
  }
  console.log('Found request in admin queue:', {
    id: found.id,
    user: found.userName,
    business: found.businessName,
    plan: found.planName,
    amount: found.amountINR,
    utr: found.utrNumber,
    status: found.status,
  });
  console.log('✓ Test 5 Passed.\n');

  // Test 6: Admin approves payment
  console.log('Test 6: Admin approves the payment request...');
  const approveRes = await request('/api/admin/payments', {
    method: 'POST',
    body: {
      requestId: requestId,
      action: 'APPROVE',
      adminName: 'Verification Officer',
    },
  });

  if (!approveRes.ok || !approveRes.data?.success) {
    throw new Error('Failed to approve payment: ' + JSON.stringify(approveRes));
  }
  console.log('Approval response message:', approveRes.data.message);
  console.log('Updated subscription:', {
    status: approveRes.data.subscription?.status,
    planId: approveRes.data.subscription?.planId,
    subscriptionStartedAt: approveRes.data.subscription?.subscriptionStartedAt,
    subscriptionEndsAt: approveRes.data.subscription?.subscriptionEndsAt,
  });
  if (approveRes.data.subscription?.status !== 'ACTIVE') {
    throw new Error('Expected status ACTIVE after approval, got ' + approveRes.data.subscription?.status);
  }
  console.log('✓ Test 6 Passed.\n');

  // Test 7: Verify Unlimited PDF Downloads for activated user
  console.log('Test 7: Verifying user has unlimited PDF downloads (limit bypassed)...');
  const dlRes1 = await request('/api/billing/pdf-download', {
    method: 'POST',
    body: { userId: testUserId, documentType: 'quotation', documentId: 'q1' },
  });
  const dlRes2 = await request('/api/billing/pdf-download', {
    method: 'POST',
    body: { userId: testUserId, documentType: 'invoice', documentId: 'i1' },
  });
  const dlRes3 = await request('/api/billing/pdf-download', {
    method: 'POST',
    body: { userId: testUserId, documentType: 'quotation', documentId: 'q2' },
  });

  console.log(`- Download 1 allowed: ${dlRes1.data?.allowed}, isSubscribed: ${dlRes1.data?.isSubscribed}`);
  console.log(`- Download 2 allowed: ${dlRes2.data?.allowed}, isSubscribed: ${dlRes2.data?.isSubscribed}`);
  console.log(`- Download 3 allowed: ${dlRes3.data?.allowed}, isSubscribed: ${dlRes3.data?.isSubscribed}`);

  if (!dlRes3.data?.allowed || !dlRes3.data?.isSubscribed) {
    throw new Error('Subscriber was blocked or not recognized as subscribed!');
  }
  console.log('✓ Test 7 Passed.\n');

  // Test 8: Test Payment Rejection flow
  console.log('Test 8: Testing Payment Rejection flow on second test user...');
  const testUser2Id = 'test_user_rej_' + Date.now();
  await request('/api/billing/subscription', {
    method: 'POST',
    body: { userId: testUser2Id, email: `rej_${Date.now()}@test.com`, name: 'Reject Test User' },
  });
  const submit2 = await request('/api/billing/manual-payment', {
    method: 'POST',
    body: { userId: testUser2Id, planId: 'plan_3m', utrNumber: 'INVALID-UTR-0000' },
  });
  const req2Id = submit2.data.paymentRequest.id;

  const rejectRes = await request('/api/admin/payments', {
    method: 'POST',
    body: {
      requestId: req2Id,
      action: 'REJECT',
      reason: 'UTR number does not match any transaction in statement.',
      adminName: 'Lead Admin',
    },
  });

  if (!rejectRes.ok || !rejectRes.data?.success) {
    throw new Error('Failed to reject payment: ' + JSON.stringify(rejectRes));
  }

  const sub2Res = await request(`/api/billing/manual-payment?userId=${testUser2Id}`);
  const user2Req = sub2Res.data.requests[0];
  console.log('Rejected Request status:', user2Req.status);
  console.log('Rejection reason stored:', user2Req.rejectionReason);

  if (user2Req.status !== 'REJECTED' || !user2Req.rejectionReason) {
    throw new Error('Expected status REJECTED with reason');
  }
  console.log('✓ Test 8 Passed.\n');

  console.log('====================================================');
  console.log('🎉 ALL MANUAL PAYMENT TESTS PASSED SUCCESSFULLY! 🎉');
  console.log('====================================================');
}

runTests().catch((err) => {
  console.error('VERIFICATION FAILED:', err);
  process.exit(1);
});
