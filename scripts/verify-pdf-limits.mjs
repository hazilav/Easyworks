// Automated verification script for Easyworks SaaS PDF Download Limit System
import assert from 'node:assert';
import {
  getDatabase,
  getAllPlans,
  ensureUserAndTrial,
  getUserSubscription,
  activateSubscription,
  verifyAndConsumeTrialPdfDownload,
  adjustCustomerPdfLimit,
  addBonusPdfDownloads,
  removeCustomerPdfCredits,
  resetCustomerPdfUsage,
  getCustomerPdfUsageHistory,
  getDeveloperStats,
  getAllCustomersWithDetails,
} from '../src/lib/db/database.ts';

console.log('--- STARTING EASYWORKS PDF DOWNLOAD LIMIT SYSTEM VERIFICATION ---\n');

async function runTests() {
  getDatabase();

  // Test 1: Verify Seeded / Updated Plans
  console.log('1. Checking Database Plans & PDF Download Limits...');
  const plans = getAllPlans(false);
  const plan1m = plans.find(p => p.id === 'plan_1m');
  const plan3m = plans.find(p => p.id === 'plan_3m');
  const plan6m = plans.find(p => p.id === 'plan_6m');

  assert(plan1m, '1m plan exists');
  assert.strictEqual(plan1m.priceINR, 299, '1m plan price is ₹299');
  assert.strictEqual(plan1m.pdfDownloadLimit, 30, '1m plan PDF limit is 30');

  assert(plan3m, '3m plan exists');
  assert.strictEqual(plan3m.priceINR, 849, '3m plan price is ₹849');
  assert.strictEqual(plan3m.pdfDownloadLimit, 90, '3m plan PDF limit is 90');

  assert(plan6m, '6m plan exists');
  assert.strictEqual(plan6m.priceINR, 1699, '6m plan price is ₹1,699');
  assert.strictEqual(plan6m.pdfDownloadLimit, 180, '6m plan PDF limit is 180');

  console.log('✔ PASS: Plans configured correctly: Basic ₹299 (30), Standard ₹849 (90), Premium ₹1,699 (180).\n');

  // Test 2: Free Trial Limit (2 PDFs Total)
  console.log('2. Testing Free Trial Customer PDF Limits (2 Total)...');
  const trialUserId = 'trial_user_' + Date.now();
  const trialEmail = `trial_${Date.now()}@example.com`;
  const { subscription: trialSub } = ensureUserAndTrial(
    trialUserId,
    trialEmail,
    'Trial Builder',
    'Acme Trial Co',
    '9198765' + Math.floor(10000 + Math.random() * 90000)
  );

  assert.strictEqual(trialSub.status, 'TRIALING');
  assert.strictEqual(trialSub.pdfDownloadLimit, 2);
  assert.strictEqual(trialSub.pdfDownloadsUsed, 0);
  assert.strictEqual(trialSub.pdfDownloadsRemaining, 2);

  // 1st download
  const dl1 = verifyAndConsumeTrialPdfDownload(trialUserId, {
    docId: 'quote_001',
    documentType: 'quotation',
    documentNumber: 'QUO-2026-001',
    ipAddress: '127.0.0.1',
    userAgent: 'Mozilla/5.0 TestBrowser',
  });
  assert.strictEqual(dl1.allowed, true);
  assert.strictEqual(dl1.pdfDownloadsUsed, 1);
  assert.strictEqual(dl1.pdfDownloadsRemaining, 1);
  console.log('✔ Download 1 successful (1 used, 1 remaining)');

  // Retry debounce test: same docId within 30s should NOT consume another credit
  const dl1Retry = verifyAndConsumeTrialPdfDownload(trialUserId, {
    docId: 'quote_001',
    documentType: 'quotation',
    documentNumber: 'QUO-2026-001',
    ipAddress: '127.0.0.1',
  });
  assert.strictEqual(dl1Retry.allowed, true);
  assert.strictEqual(dl1Retry.pdfDownloadsUsed, 1, 'Retry did not increment credit count');
  assert.strictEqual(dl1Retry.pdfDownloadsRemaining, 1);
  console.log('✔ Retry debounce verified (no duplicate credit deduction)');

  // 2nd download
  const dl2 = verifyAndConsumeTrialPdfDownload(trialUserId, {
    docId: 'inv_002',
    documentType: 'invoice',
    documentNumber: 'INV-2026-001',
  });
  assert.strictEqual(dl2.allowed, true);
  assert.strictEqual(dl2.pdfDownloadsUsed, 2);
  assert.strictEqual(dl2.pdfDownloadsRemaining, 0);
  console.log('✔ Download 2 successful (2 used, 0 remaining)');

  // 3rd download attempt (MUST BE BLOCKED)
  const dl3 = verifyAndConsumeTrialPdfDownload(trialUserId, {
    docId: 'quote_003',
    documentType: 'quotation',
    documentNumber: 'QUO-2026-003',
  });
  assert.strictEqual(dl3.allowed, false);
  assert.strictEqual(dl3.reason, 'LIMIT_REACHED');
  assert.strictEqual(dl3.pdfDownloadsUsed, 2);
  assert.strictEqual(dl3.pdfDownloadsRemaining, 0);
  console.log('✔ Download 3 BLOCKED: HTTP 403 / LIMIT_REACHED (0 remaining)');

  console.log('✔ PASS: Free trial PDF limit strictly enforced at 2 downloads.\n');

  // Test 3: Upgrade to Basic Plan (₹299, 30 PDFs)
  console.log('3. Testing Upgrade to Basic Plan (₹299, 30 PDFs)...');
  const paidSub = activateSubscription({ userId: trialUserId, planId: 'plan_1m' });
  assert.strictEqual(paidSub.status, 'ACTIVE');
  assert.strictEqual(paidSub.pdfDownloadLimit, 30);
  assert.strictEqual(paidSub.pdfDownloadsUsed, 0);
  assert.strictEqual(paidSub.pdfDownloadsRemaining, 30);

  // Consume all 30 downloads
  for (let i = 1; i <= 30; i++) {
    const res = verifyAndConsumeTrialPdfDownload(trialUserId, {
      docId: `doc_paid_${i}`,
      documentType: i % 2 === 0 ? 'invoice' : 'quotation',
      documentNumber: `DOC-2026-${i}`,
      ipAddress: '192.168.1.50',
    });
    assert.strictEqual(res.allowed, true);
    assert.strictEqual(res.pdfDownloadsUsed, i);
    assert.strictEqual(res.pdfDownloadsRemaining, 30 - i);
  }
  console.log('✔ Consumed 30 downloads under Basic Plan');

  // 31st download attempt (MUST BE BLOCKED)
  const dlPaidBlocked = verifyAndConsumeTrialPdfDownload(trialUserId, {
    docId: 'doc_paid_31',
    documentType: 'invoice',
  });
  assert.strictEqual(dlPaidBlocked.allowed, false);
  assert.strictEqual(dlPaidBlocked.reason, 'LIMIT_REACHED');
  assert.strictEqual(dlPaidBlocked.pdfDownloadsRemaining, 0);
  console.log('✔ 31st Download BLOCKED as expected (LIMIT_REACHED)');

  console.log('✔ PASS: Basic plan PDF limit strictly enforced at 30 downloads.\n');

  // Test 4: Upgrade to Standard Plan (₹849, 90 PDFs)
  console.log('4. Testing Upgrade to Standard Plan (₹849, 90 PDFs)...');
  const standardSub = activateSubscription({ userId: trialUserId, planId: 'plan_3m' });
  assert.strictEqual(standardSub.status, 'ACTIVE');
  assert.strictEqual(standardSub.pdfDownloadLimit, 90);
  assert.strictEqual(standardSub.pdfDownloadsUsed, 0);
  assert.strictEqual(standardSub.pdfDownloadsRemaining, 90);
  console.log('✔ PASS: Standard plan reset allowance to 90 PDFs.\n');

  // Test 5: Developer Actions (Bonus, Remove, Adjust, Reset, History)
  console.log('5. Testing Developer Actions...');

  // A. Add +15 Bonus Downloads
  console.log('  Testing ADD_BONUS_PDF (+15)...');
  const bonusSub = addBonusPdfDownloads(trialUserId, 15, 'developer_admin');
  assert.strictEqual(bonusSub.pdfDownloadLimit, 105);
  assert.strictEqual(bonusSub.pdfDownloadsRemaining, 105);
  console.log('  ✔ +15 bonus successfully increased limit to 105');

  // B. Remove -10 PDF Credits
  console.log('  Testing REMOVE_PDF_CREDITS (-10)...');
  const removedSub = removeCustomerPdfCredits(trialUserId, 10, 'developer_admin');
  assert.strictEqual(removedSub.pdfDownloadLimit, 95);
  assert.strictEqual(removedSub.pdfDownloadsRemaining, 95);
  console.log('  ✔ Removed 10 credits, new limit is 95');

  // C. Consume 80 downloads to test near_limit (80 / 95 = 84.2%)
  console.log('  Simulating downloads to reach Near-Limit status...');
  for (let i = 1; i <= 80; i++) {
    verifyAndConsumeTrialPdfDownload(trialUserId, {
      docId: `doc_std_${i}`,
      documentType: 'invoice',
      documentNumber: `INV-2026-${i}`,
      ipAddress: '10.0.0.1',
    });
  }
  const currentSub = getUserSubscription(trialUserId);
  assert.strictEqual(currentSub.pdfDownloadsUsed, 80);
  assert.strictEqual(currentSub.pdfDownloadsRemaining, 15);
  const usageRatio = currentSub.pdfDownloadsUsed / currentSub.pdfDownloadLimit;
  assert(usageRatio >= 0.8, 'Usage is at or above 80%');
  console.log(`  ✔ Customer is near limit: ${currentSub.pdfDownloadsUsed}/${currentSub.pdfDownloadLimit} (${(usageRatio * 100).toFixed(1)}%)`);

  // D. Check Usage History Logs
  console.log('  Testing getCustomerPdfUsageHistory...');
  const history = getCustomerPdfUsageHistory(trialUserId);
  assert(history.length > 0, 'Usage logs exist');
  assert(history[0].documentType, 'Log has documentType');
  console.log(`  ✔ Fetched ${history.length} PDF audit log entries for customer`);

  // E. Developer Stats & Customer Filters
  console.log('6. Testing Developer Stats & Customer Filters...');
  const stats = getDeveloperStats();
  assert(stats.pdfsGenerated > 0, 'Total PDFs generated is tracked');
  assert(typeof stats.pdfsGeneratedToday === 'number', 'PDFs generated today tracked');
  assert(typeof stats.customersNearLimit === 'number', 'Customers near limit tracked');
  assert(typeof stats.customersAtLimit === 'number', 'Customers at limit tracked');
  console.log(`  ✔ Telemetry Stats: Total=${stats.pdfsGenerated}, Today=${stats.pdfsGeneratedToday}, NearLimit=${stats.customersNearLimit}, AtLimit=${stats.customersAtLimit}`);

  // Test filters
  const nearLimitCustomers = getAllCustomersWithDetails('near_limit');
  const userInNearLimit = nearLimitCustomers.some(c => c.id === trialUserId);
  assert(userInNearLimit, 'Customer found under near_limit filter');
  console.log(`  ✔ Filter 'near_limit' successfully identified test customer`);

  // Reset Usage
  console.log('  Testing RESET_PDF_USAGE...');
  const resetSub = resetCustomerPdfUsage(trialUserId, 'developer_admin');
  assert.strictEqual(resetSub.pdfDownloadsUsed, 0);
  assert.strictEqual(resetSub.pdfDownloadsRemaining, 95);
  console.log('  ✔ Usage reset to 0 (95 remaining)');

  console.log('\n=== ALL EASYWORKS PDF DOWNLOAD LIMIT SYSTEM TESTS PASSED! ===\n');
}

runTests().catch(err => {
  console.error('❌ Verification failed:', err);
  process.exit(1);
});
