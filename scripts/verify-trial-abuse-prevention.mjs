import { getDatabase } from '../src/lib/db/database.js';
import { isDisposableEmail } from '../src/lib/abuse/disposableEmails.js';
import {
  normalizeEmail,
  normalizePhone,
  normalizeBusinessName,
  extractDomain,
} from '../src/lib/abuse/normalizers.js';
import {
  createVerificationCode,
  verifyVerificationCode,
  checkRateLimit,
  createOrUpdateTrialIdentity,
  evaluateTrialEligibility,
  verifyAndConsumeTrialPdfDownload,
  adminApproveTrial,
  adminRejectTrial,
  getAllTrialIdentities,
} from '../src/lib/db/database.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  PASS: ${message}`);
    passed++;
  } else {
    console.error(`  FAIL: ${message}`);
    failed++;
  }
}

console.log('=== Easyworks 7-Day Free-Trial Abuse Prevention Verification ===\n');

// -------------------------------------------------------------
// Test 1: Disposable Email Detection
// -------------------------------------------------------------
console.log('1. Testing Disposable Email Detection...');
assert(isDisposableEmail('user@mailinator.com') === true, 'Blocks mailinator.com');
assert(isDisposableEmail('test@tempmail.com') === true, 'Blocks tempmail.com');
assert(isDisposableEmail('anon@10minutemail.com') === true, 'Blocks 10minutemail.com');
assert(isDisposableEmail('bot@guerrillamail.biz') === true, 'Blocks guerrillamail.biz');
assert(isDisposableEmail('legit@gmail.com') === false, 'Allows legit gmail.com');
assert(isDisposableEmail('ceo@apexstudio.in') === false, 'Allows custom company domain apexstudio.in');
assert(isDisposableEmail('contact@outlook.com') === false, 'Allows outlook.com');

// -------------------------------------------------------------
// Test 2: Email Normalization
// -------------------------------------------------------------
console.log('\n2. Testing Email Normalization...');
assert(
  normalizeEmail('John.Doe+trial1@gmail.com') === 'johndoe@gmail.com',
  'Strips dots and +tag for Gmail'
);
assert(
  normalizeEmail('  Sameer.Khan@GOOGLEMAIL.COM  ') === 'sameerkhan@gmail.com',
  'Normalizes googlemail to gmail'
);
assert(
  normalizeEmail('billing+test@company.co.in') === 'billing@company.co.in',
  'Strips +tag for corporate email'
);

// -------------------------------------------------------------
// Test 3: Phone Normalization (E.164)
// -------------------------------------------------------------
console.log('\n3. Testing Phone Normalization...');
assert(
  normalizePhone('9539933265') === '+919539933265',
  '10-digit number normalizes to +919539933265'
);
assert(
  normalizePhone('095399 33265') === '+919539933265',
  'Leading 0 normalizes to +91'
);
assert(
  normalizePhone('+91 95399-33265') === '+919539933265',
  'Formatted string normalizes to strict E.164'
);

// -------------------------------------------------------------
// Test 4: Business Normalization
// -------------------------------------------------------------
console.log('\n4. Testing Business Name Normalization...');
assert(
  normalizeBusinessName('Acme Solutions Pvt. Ltd.') === 'acme',
  'Strips corporate stop words pvt, ltd, solutions'
);
assert(
  normalizeBusinessName('Apex Interior Studio & Co.') === 'apexinterior',
  'Strips studio and co'
);

// -------------------------------------------------------------
// Test 5: Sliding-Window Rate Limiting
// -------------------------------------------------------------
console.log('\n5. Testing Sliding-Window Rate Limiter...');
const rateKey = 'test_rate_' + Date.now();
const r1 = checkRateLimit(rateKey, 3, 60);
const r2 = checkRateLimit(rateKey, 3, 60);
const r3 = checkRateLimit(rateKey, 3, 60);
const r4 = checkRateLimit(rateKey, 3, 60);
assert(r1.allowed === true && r1.remaining === 2, 'Rate limit attempt 1 allowed');
assert(r2.allowed === true && r2.remaining === 1, 'Rate limit attempt 2 allowed');
assert(r3.allowed === true && r3.remaining === 0, 'Rate limit attempt 3 allowed (last)');
assert(r4.allowed === false && r4.remaining === 0, 'Rate limit attempt 4 blocked (rate exceeded)');

// -------------------------------------------------------------
// Test 6: Verification Code Issue & Validation
// -------------------------------------------------------------
console.log('\n6. Testing Verification OTP Lifecycle...');
const targetEmail = `audit_${Date.now()}@easyworks-test.com`;
const codeObj = createVerificationCode(targetEmail, 'EMAIL');
assert(codeObj.code.length === 6, 'Generated 6-digit numeric OTP');

const wrongVerify = verifyVerificationCode(targetEmail, '000000');
assert(wrongVerify.success === false, 'Rejects incorrect OTP');

const rightVerify = verifyVerificationCode(targetEmail, codeObj.code);
assert(rightVerify.success === true, 'Accepts correct OTP');

const reuseVerify = verifyVerificationCode(targetEmail, codeObj.code);
assert(reuseVerify.success === false, 'Cannot reuse already verified OTP');

// -------------------------------------------------------------
// Test 7: One Trial Per Verified Phone Number
// -------------------------------------------------------------
console.log('\n7. Testing One Trial Per Verified Phone Number...');
const timestamp = Date.now();
const testPhone = `+9198${String(timestamp).slice(-8)}`;

// User A: Clean signup with testPhone
const userAId = `usr_test_a_${timestamp}`;
const userAEmail = `user_a_${timestamp}@legitcorp.in`;
const db = getDatabase();

// Create user A
db.prepare(`
  INSERT INTO users (id, email, name, business_name, role, created_at)
  VALUES (?, ?, 'User A', 'Alpha Design Studio', 'user', ?)
`).run(userAId, userAEmail, new Date().toISOString());

// Create trial identity for User A
createOrUpdateTrialIdentity({
  userId: userAId,
  email: userAEmail,
  phone: testPhone,
  emailVerified: true,
  phoneVerified: true,
  businessName: 'Alpha Design Studio',
});

// Run eligibility for User A
const evalA = evaluateTrialEligibility(userAId);
assert(evalA.status === 'ELIGIBLE', 'User A with verified phone is ELIGIBLE');
assert(evalA.isEligible === true, 'User A has trial activated');

// User B: Creates account with DIFFERENT email, but verifies the SAME phone!
const userBId = `usr_test_b_${timestamp}`;
const userBEmail = `user_b_different_${timestamp}@gmail.com`;

db.prepare(`
  INSERT INTO users (id, email, name, business_name, role, created_at)
  VALUES (?, ?, 'User B', 'Beta Solutions', 'user', ?)
`).run(userBId, userBEmail, new Date().toISOString());

createOrUpdateTrialIdentity({
  userId: userBId,
  email: userBEmail,
  phone: testPhone, // Same phone!
  emailVerified: true,
  phoneVerified: true,
  businessName: 'Beta Solutions',
});

const evalB = evaluateTrialEligibility(userBId);
assert(evalB.status === 'NOT_ELIGIBLE', 'User B with same phone is flagged NOT_ELIGIBLE');
assert(evalB.isEligible === false, 'User B trial access is blocked');
assert(
  evalB.flagReason && evalB.flagReason.includes('already used'),
  `User B flag reason records duplicate phone: "${evalB.flagReason}"`
);

// -------------------------------------------------------------
// Test 8: Business Identity (GSTIN) Cross-Check
// -------------------------------------------------------------
console.log('\n8. Testing Business GSTIN Cross-Check...');
const userCId = `usr_test_c_${timestamp}`;
const userCEmail = `user_c_${timestamp}@enterprise.in`;
const testGstin = `29ABCDE1234F1Z5`;

// Set user A's GSTIN
db.prepare('UPDATE trial_identities SET gstin = ? WHERE user_id = ?').run(testGstin, userAId);

db.prepare(`
  INSERT INTO users (id, email, name, business_name, role, created_at)
  VALUES (?, ?, 'User C', 'Gamma Corp', 'user', ?)
`).run(userCId, userCEmail, new Date().toISOString());

createOrUpdateTrialIdentity({
  userId: userCId,
  email: userCEmail,
  phone: `+9197${String(timestamp).slice(-8)}`, // new phone
  gstin: testGstin, // duplicate GSTIN
  emailVerified: true,
  phoneVerified: true,
  businessName: 'Gamma Corp',
});

const evalC = evaluateTrialEligibility(userCId);
assert(evalC.status === 'REVIEW_REQUIRED', 'User C with duplicate GSTIN flags REVIEW_REQUIRED');
assert(evalC.riskScore >= 50, `Risk score reflects duplicate GSTIN: ${evalC.riskScore}`);

// -------------------------------------------------------------
// Test 9: Cluster-Bound 2-PDF Download Limit
// -------------------------------------------------------------
console.log('\n9. Testing Cluster-Bound 2-PDF Limit...');
// Setup subscription record for user A
db.prepare(`
  INSERT OR REPLACE INTO subscriptions (
    id, user_id, plan_id, status, trial_started_at, trial_ends_at, trial_pdf_downloads, created_at, updated_at
  ) VALUES (?, ?, 'plan_1m', 'TRIALING', ?, ?, 0, ?, ?)
`).run(
  'sub_' + userAId,
  userAId,
  new Date().toISOString(),
  new Date(Date.now() + 7 * 86400000).toISOString(),
  new Date().toISOString(),
  new Date().toISOString()
);

const pdf1 = verifyAndConsumeTrialPdfDownload(userAId);
assert(pdf1.allowed === true && pdf1.trialPdfDownloads === 1, 'PDF download #1 allowed (1/2)');

const pdf2 = verifyAndConsumeTrialPdfDownload(userAId);
assert(pdf2.allowed === true && pdf2.trialPdfDownloads === 2, 'PDF download #2 allowed (2/2)');

const pdf3 = verifyAndConsumeTrialPdfDownload(userAId);
assert(pdf3.allowed === false && pdf3.reason === 'LIMIT_REACHED', 'PDF download #3 blocked (limit reached)');

// -------------------------------------------------------------
// Test 10: Admin Override & Approvals
// -------------------------------------------------------------
console.log('\n10. Testing Admin Approval & Override...');
const adminApproveRes = adminApproveTrial(userCId, 'Verified legitimate business partner');
assert(adminApproveRes.success === true, 'Admin successfully overrides and approves trial');

const postApprovalEval = evaluateTrialEligibility(userCId);
assert(postApprovalEval.status === 'ELIGIBLE', 'User C is now ELIGIBLE after admin approval');

const adminRejectRes = adminRejectTrial(userBId, 'Fraudulent multi-account signup');
assert(adminRejectRes.success === true, 'Admin rejects abusive attempt');

const postRejectEval = evaluateTrialEligibility(userBId);
assert(postRejectEval.status === 'NOT_ELIGIBLE', 'User B remains NOT_ELIGIBLE');

// -------------------------------------------------------------
// Test 11: Admin Trial Identity Listing
// -------------------------------------------------------------
console.log('\n11. Testing Admin Trial Identity Listing...');
const allTrials = getAllTrialIdentities();
assert(Array.isArray(allTrials) && allTrials.length >= 3, `Retrieved ${allTrials.length} trial records for admin inspection`);

console.log(`\n===============================================================`);
console.log(`Total: ${passed + failed} | Passed: ${passed} | Failed: ${failed}`);
console.log(`===============================================================\n`);

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
