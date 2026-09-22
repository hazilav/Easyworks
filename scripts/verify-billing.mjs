// Automated verification script for Easyworks SaaS Billing & PDF Download Limitation
import assert from 'node:assert';
import {
  getDatabase,
  getAllPlans,
  updatePlan,
  getUserSubscription,
  ensureUserAndTrial,
  activateSubscription,
  recordPayment,
  getUserPayments,
  createCustomPlanRequest,
  getAllCustomPlanRequests,
  getAllSubscribers,
  adminOverrideSubscription,
  verifyAndConsumeTrialPdfDownload,
} from '../src/lib/db/database.ts';
import { createGatewayOrder, verifyPaymentSignature } from '../src/lib/billing/razorpay.ts';
import { addCalendarMonths, getTrialRemainingDays, evaluateSubscriptionStatus } from '../src/lib/billing/dateUtils.ts';

console.log('--- STARTING EASYWORKS BILLING & PDF DOWNLOAD LIMIT VERIFICATION ---\n');

async function runTests() {
  // Test 1: Database Initialization & Seeded Plans
  console.log('1. Checking Database and Plans (including ₹249 1-month plan)...');
  getDatabase();
  const plans = getAllPlans(false);
  console.log(`Found ${plans.length} active plans:`, plans.map(p => `${p.name} (₹${p.priceINR})`));
  assert(plans.length >= 4, 'Should have at least 4 plans');
  const plan1m = plans.find(p => p.durationMonths === 1 && !p.isCustom);
  const plan3m = plans.find(p => p.durationMonths === 3);
  const plan6m = plans.find(p => p.durationMonths === 6);
  const planCustom = plans.find(p => p.isCustom);
  assert(plan1m && plan1m.priceINR === 249, '1 Month plan should be ₹249');
  assert(plan3m && plan3m.priceINR === 1299, '3 Month plan should be ₹1299');
  assert(plan6m && plan6m.priceINR === 2199, '6 Month plan should be ₹2199');
  assert(planCustom && planCustom.isCustom, 'Custom plan should exist');
  console.log('✔ PASS: Database initialized with correct plans.\n');

  // Test 2: Calendar-Accurate Date Arithmetic
  console.log('2. Testing Calendar-Accurate Date Arithmetic...');
  const jan31 = new Date(Date.UTC(2026, 0, 31, 12, 0, 0));
  const febAdded = addCalendarMonths(jan31, 1);
  assert(febAdded.getUTCMonth() === 1 && febAdded.getUTCDate() === 28, 'Jan 31 + 1 month in non-leap year must clamp to Feb 28');
  console.log('✔ PASS: Calendar date arithmetic verified.\n');

  // Test 3: User Signup, 7-Day Trial & Initial 0 PDF Downloads
  console.log('3. Testing User Signup & 7-Day Trial with 0 Initial PDF Downloads...');
  const testUserId = 'test_user_' + Date.now();
  const testEmail = `test_${Date.now()}@example.com`;
  const { subscription: sub } = ensureUserAndTrial(testUserId, testEmail, 'Test Contractor', 'Acme Construction');
  assert(sub.status === 'TRIALING', 'New signup must be in TRIALING status');
  assert(sub.trialPdfDownloads === 0, 'Initial trialPdfDownloads must be 0');
  assert(sub.maxTrialPdfDownloads === 2, 'maxTrialPdfDownloads must be 2');
  console.log('Created Subscription:', {
    status: sub.status,
    trialPdfDownloads: sub.trialPdfDownloads,
    maxTrialPdfDownloads: sub.maxTrialPdfDownloads,
    trialDaysRemaining: sub.trialDaysRemaining,
  });
  console.log('✔ PASS: 7-day trial provisioned with initial 0/2 downloads.\n');

  // Test 4: PDF Download #1 - Allowed, increments counter to 1
  console.log('4. Testing PDF Download #1 for Trial User...');
  const dl1 = verifyAndConsumeTrialPdfDownload(testUserId);
  console.log('Download #1 response:', dl1);
  assert(dl1.allowed === true, 'PDF Download #1 must be allowed');
  assert(dl1.trialPdfDownloads === 1, 'Counter must increment to 1');
  assert(dl1.isSubscribed === false, 'User is in trial');
  console.log('✔ PASS: PDF Download #1 allowed and counter incremented to 1.\n');

  // Test 5: PDF Download #2 - Allowed, increments counter to 2
  console.log('5. Testing PDF Download #2 for Trial User...');
  const dl2 = verifyAndConsumeTrialPdfDownload(testUserId);
  console.log('Download #2 response:', dl2);
  assert(dl2.allowed === true, 'PDF Download #2 must be allowed');
  assert(dl2.trialPdfDownloads === 2, 'Counter must increment to 2');
  assert(dl2.isSubscribed === false, 'User is in trial');
  console.log('✔ PASS: PDF Download #2 allowed and counter incremented to 2.\n');

  // Test 6: PDF Download #3 - BLOCKED server-side
  console.log('6. Testing PDF Download #3 for Trial User (Limit Reached)...');
  const dl3 = verifyAndConsumeTrialPdfDownload(testUserId);
  console.log('Download #3 response:', dl3);
  assert(dl3.allowed === false, 'PDF Download #3 must be BLOCKED');
  assert(dl3.reason === 'LIMIT_REACHED', 'Reason must be LIMIT_REACHED');
  assert(dl3.trialPdfDownloads === 2, 'Counter must remain at 2');
  assert(dl3.message.includes("You've used your 2 free PDF downloads."), 'Message must inform user');
  console.log('✔ PASS: PDF Download #3 blocked server-side.\n');

  // Test 7: Subscribed User - Unlimited PDF Downloads & No Counter Applied
  console.log('7. Testing Subscribed User (Unlimited Downloads)...');
  const paidUserId = 'paid_user_' + Date.now();
  ensureUserAndTrial(paidUserId, `paid_${Date.now()}@example.com`, 'Paid Contractor', 'Big Builder');
  activateSubscription({ userId: paidUserId, planId: plan1m.id });
  
  // Test multiple downloads for paid user
  for (let i = 1; i <= 5; i++) {
    const paidDl = verifyAndConsumeTrialPdfDownload(paidUserId);
    assert(paidDl.allowed === true, `Subscribed user download #${i} must be allowed`);
    assert(paidDl.isSubscribed === true, 'User must be recognized as subscribed');
    assert(paidDl.trialPdfDownloads === 0, 'No trial counter should be incremented for subscribed user');
  }
  console.log('✔ PASS: Subscribed user has unlimited downloads without counter restriction.\n');

  // Test 8: Billing Page Status Calculation
  console.log('8. Testing Billing Page Status and Remaining Downloads Calculation...');
  const userSub = getUserSubscription(testUserId);
  assert(userSub !== null, 'Subscription must exist');
  const remaining = Math.max(0, 2 - (userSub.trialPdfDownloads ?? 0));
  console.log(`Trial Remaining: ${userSub.trialDaysRemaining} days, ${remaining} / 2 PDF downloads remaining`);
  assert(remaining === 0, 'After 2 downloads, remaining should be 0');
  console.log('✔ PASS: Billing page counters accurately calculate remaining downloads.\n');

  console.log('===============================================================');
  console.log('ALL SAAS BILLING & 2 PDF DOWNLOAD LIMIT TESTS PASSED!!');
  console.log('===============================================================');
}

runTests().catch(err => {
  console.error('VERIFICATION FAILED:', err);
  process.exit(1);
});
