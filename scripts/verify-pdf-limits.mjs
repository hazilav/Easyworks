// Automated verification script for Easyworks SaaS Package-Based PDF Download Limits
import assert from 'node:assert';
import {
  getDatabase,
  getAllPlans,
  ensureUserAndTrial,
  getUserSubscription,
  activateSubscription,
  verifyAndConsumePdfDownload,
  adjustCustomerPdfLimit,
  addBonusPdfDownloads,
  resetCustomerPdfUsage,
} from '../src/lib/db/database.ts';

console.log('--- STARTING PACKAGE-BASED PDF DOWNLOAD LIMIT VERIFICATION ---\n');

async function runTests() {
  getDatabase();

  // Test 1: Verify Seeded / Updated Plans
  console.log('1. Checking Database Plans & PDF Download Limits...');
  const plans = getAllPlans(false);
  const plan1m = plans.find(p => p.id === 'plan_1m');
  const plan3m = plans.find(p => p.id === 'plan_3m');
  const plan6m = plans.find(p => p.id === 'plan_6m');

  assert(plan1m, '1m plan exists');
  assert.strictEqual(plan1m.priceINR, 249, '1m plan price is ₹249');
  assert.strictEqual(plan1m.pdfDownloadLimit, 20, '1m plan PDF limit is 20');

  assert(plan3m, '3m plan exists');
  assert.strictEqual(plan3m.priceINR, 649, '3m plan price is ₹649');
  assert.strictEqual(plan3m.pdfDownloadLimit, 60, '3m plan PDF limit is 60');

  assert(plan6m, '6m plan exists');
  assert.strictEqual(plan6m.priceINR, 1099, '6m plan price is ₹1,099');
  assert.strictEqual(plan6m.pdfDownloadLimit, 120, '6m plan PDF limit is 120');

  console.log('✔ PASS: Plans configured correctly with limits (20, 60, 120).\n');

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
  const dl1 = verifyAndConsumePdfDownload(trialUserId, 'doc_001');
  assert.strictEqual(dl1.allowed, true);
  assert.strictEqual(dl1.pdfDownloadsUsed, 1);
  assert.strictEqual(dl1.pdfDownloadsRemaining, 1);
  console.log('✔ Download 1 successful (1 used, 1 remaining)');

  // 2nd download
  const dl2 = verifyAndConsumePdfDownload(trialUserId, 'doc_002');
  assert.strictEqual(dl2.allowed, true);
  assert.strictEqual(dl2.pdfDownloadsUsed, 2);
  assert.strictEqual(dl2.pdfDownloadsRemaining, 0);
  console.log('✔ Download 2 successful (2 used, 0 remaining)');

  // 3rd download attempt (MUST BE BLOCKED)
  const dl3 = verifyAndConsumePdfDownload(trialUserId, 'doc_003');
  assert.strictEqual(dl3.allowed, false);
  assert.strictEqual(dl3.reason, 'LIMIT_REACHED');
  assert.strictEqual(dl3.pdfDownloadsUsed, 2);
  assert.strictEqual(dl3.pdfDownloadsRemaining, 0);
  console.log('✔ Download 3 BLOCKED: HTTP 403 / LIMIT_REACHED (0 remaining)');

  console.log('✔ PASS: Free trial PDF limit strictly enforced at 2 downloads.\n');

  // Test 3: Upgrade to 1 Month Plan (₹249 -> 20 PDFs)
  console.log('3. Testing Upgrade to 1-Month Plan (₹249, 20 PDFs)...');
  const paidSub = activateSubscription({ userId: trialUserId, planId: 'plan_1m' });
  assert.strictEqual(paidSub.status, 'ACTIVE');
  assert.strictEqual(paidSub.pdfDownloadLimit, 20);
  assert.strictEqual(paidSub.pdfDownloadsUsed, 0);
  assert.strictEqual(paidSub.pdfDownloadsRemaining, 20);

  // Consume all 20 downloads
  for (let i = 1; i <= 20; i++) {
    const res = verifyAndConsumePdfDownload(trialUserId, `doc_paid_${i}`);
    assert.strictEqual(res.allowed, true);
    assert.strictEqual(res.pdfDownloadsUsed, i);
    assert.strictEqual(res.pdfDownloadsRemaining, 20 - i);
  }
  console.log('✔ Consumed 20 downloads under 1-Month Plan');

  // 21st download attempt (MUST BE BLOCKED)
  const dlPaidBlocked = verifyAndConsumePdfDownload(trialUserId, 'doc_paid_21');
  assert.strictEqual(dlPaidBlocked.allowed, false);
  assert.strictEqual(dlPaidBlocked.reason, 'LIMIT_REACHED');
  assert.strictEqual(dlPaidBlocked.pdfDownloadsRemaining, 0);
  console.log('✔ 21st Download BLOCKED as expected (LIMIT_REACHED)');

  console.log('✔ PASS: 1-Month plan PDF limit strictly enforced at 20 downloads.\n');

  // Test 4: Developer Actions (Bonus, Reset, Adjust)
  console.log('4. Testing Developer Actions (Bonus, Reset, Adjust)...');

  // A. Add +5 Bonus Downloads
  console.log('  Testing ADD_BONUS_PDF (+5)...');
  const bonusSub = addBonusPdfDownloads(trialUserId, 5, 'admin_developer');
  assert.strictEqual(bonusSub.pdfDownloadLimit, 25);
  assert.strictEqual(bonusSub.pdfDownloadsUsed, 20);
  assert.strictEqual(bonusSub.pdfDownloadsRemaining, 5);

  const bonusDl = verifyAndConsumePdfDownload(trialUserId, 'doc_bonus_1');
  assert.strictEqual(bonusDl.allowed, true);
  assert.strictEqual(bonusDl.pdfDownloadsUsed, 21);
  assert.strictEqual(bonusDl.pdfDownloadsRemaining, 4);
  console.log('  ✔ +5 bonus allowed immediate PDF download (4 remaining)');

  // B. Reset PDF Usage
  console.log('  Testing RESET_PDF_USAGE...');
  const resetSub = resetCustomerPdfUsage(trialUserId, 'admin_developer');
  assert.strictEqual(resetSub.pdfDownloadsUsed, 0);
  assert.strictEqual(resetSub.pdfDownloadsRemaining, 25);

  const afterResetDl = verifyAndConsumePdfDownload(trialUserId, 'doc_after_reset');
  assert.strictEqual(afterResetDl.allowed, true);
  assert.strictEqual(afterResetDl.pdfDownloadsUsed, 1);
  assert.strictEqual(afterResetDl.pdfDownloadsRemaining, 24);
  console.log('  ✔ Usage reset to 0, downloads resumed successfully');

  // C. Adjust PDF Limit
  console.log('  Testing ADJUST_PDF_LIMIT (set to 50)...');
  const adjustSub = adjustCustomerPdfLimit(trialUserId, 50, 'admin_developer');
  assert.strictEqual(adjustSub.pdfDownloadLimit, 50);
  assert.strictEqual(adjustSub.pdfDownloadsRemaining, 49); // 50 - 1 used
  console.log('  ✔ Limit adjusted to 50, remaining reflects updated limit (49 remaining)');

  console.log('✔ PASS: Developer actions (ADD_BONUS_PDF, RESET_PDF_USAGE, ADJUST_PDF_LIMIT) verified.\n');

  console.log('=== ALL PACKAGE-BASED PDF DOWNLOAD LIMIT TESTS PASSED SUCCESSFULLY! ===\n');
}

runTests().catch(err => {
  console.error('❌ Verification failed:', err);
  process.exit(1);
});
