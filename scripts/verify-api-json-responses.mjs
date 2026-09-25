import assert from 'node:assert';
import { safeParseResponse } from '../src/lib/api/client.ts';
import { GET as getSubscription } from '../src/app/api/billing/subscription/route.ts';
import { POST as postPdfDownload, GET as getPdfDownload } from '../src/app/api/billing/pdf-download/route.ts';
import { POST as postDeveloperAuth } from '../src/app/api/developer/auth/route.ts';
import { POST as postDeveloperCustomers } from '../src/app/api/developer/customers/route.ts';
import { POST as postAdminPayments } from '../src/app/api/admin/payments/route.ts';
import {
  ensureUserAndTrial,
  createManualPaymentRequest,
  verifyDeveloperCredentials,
} from '../src/lib/db/database.ts';

console.log('--- STARTING EASYWORKS API JSON RESPONSE ERROR VERIFICATION ---\n');

async function runTests() {
  // Test 1: safeParseResponse unit test on empty / 0-byte body
  console.log('1. Testing safeParseResponse with 0-byte response...');
  const emptyRes = new Response('', {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
  const emptyResult = await safeParseResponse(emptyRes);
  assert.strictEqual(emptyResult.ok, true);
  assert.strictEqual(emptyResult.data, null);
  assert.strictEqual(emptyResult.rawText, '');
  console.log('✔ PASS: 0-byte body safely parsed without throwing SyntaxError.\n');

  // Test 2: safeParseResponse unit test on HTML error response
  console.log('2. Testing safeParseResponse with HTML error page (500)...');
  const htmlRes = new Response('<!DOCTYPE html><html><body><h1>Internal Server Error</h1></body></html>', {
    status: 500,
    headers: { 'Content-Type': 'text/html' },
  });
  const htmlResult = await safeParseResponse(htmlRes);
  assert.strictEqual(htmlResult.ok, false);
  assert.strictEqual(htmlResult.data, null);
  assert(htmlResult.error.includes('Server returned HTML'), 'Should report HTML returned instead of JSON');
  console.log('✔ PASS: HTML error response handled cleanly without JSON parse failure.\n');

  // Test 3: safeParseResponse on valid JSON
  console.log('3. Testing safeParseResponse with valid JSON...');
  const validRes = new Response(JSON.stringify({ success: true, count: 42 }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
  const validResult = await safeParseResponse(validRes);
  assert.strictEqual(validResult.ok, true);
  assert.strictEqual(validResult.data.success, true);
  assert.strictEqual(validResult.data.count, 42);
  console.log('✔ PASS: Valid JSON parsed accurately.\n');

  // Test 4: GET /api/billing/subscription with missing userId
  console.log('4. Testing GET /api/billing/subscription with missing userId...');
  const subReqNoUser = new Request('http://localhost:3000/api/billing/subscription');
  const subResNoUser = await getSubscription(subReqNoUser);
  const subJsonNoUser = await subResNoUser.json();
  assert.strictEqual(subResNoUser.status, 400);
  assert.strictEqual(subJsonNoUser.success, false);
  assert.strictEqual(typeof subJsonNoUser.error, 'string');
  console.log('✔ PASS: Missing userId returns HTTP 400 with standard JSON error.\n');

  // Test 5: GET /api/billing/subscription with non-existent user
  console.log('5. Testing GET /api/billing/subscription with non-existent user...');
  const nonExistentUserId = 'user_non_existent_' + Date.now();
  const subReqNonExistent = new Request(`http://localhost:3000/api/billing/subscription?userId=${nonExistentUserId}`);
  const subResNonExistent = await getSubscription(subReqNonExistent);
  const subJsonNonExistent = await subResNonExistent.json();
  assert.strictEqual(subResNonExistent.status, 200, 'Must return 200 for user with no active subscription');
  assert.strictEqual(subJsonNonExistent.success, true);
  assert.strictEqual(subJsonNonExistent.subscription, null, 'Subscription must be null, not 404 or empty');
  assert.deepStrictEqual(subJsonNonExistent.payments, []);
  console.log('✔ PASS: Safe subscription fallback returns { success: true, subscription: null, payments: [] }.\n');

  // Test 6: POST /api/billing/pdf-download with empty request body
  console.log('6. Testing POST /api/billing/pdf-download with empty request body...');
  const pdfReqEmpty = new Request('http://localhost:3000/api/billing/pdf-download', {
    method: 'POST',
    body: '',
  });
  const pdfResEmpty = await postPdfDownload(pdfReqEmpty);
  const pdfJsonEmpty = await pdfResEmpty.json();
  assert.strictEqual(pdfResEmpty.status, 400);
  assert.strictEqual(pdfJsonEmpty.success, false);
  assert(pdfJsonEmpty.error.includes('User ID is required'), 'Empty body safely handled with error');
  console.log('✔ PASS: Empty request body handled safely without server crash.\n');

  // Test 7: GET /api/billing/pdf-download with missing userId
  console.log('7. Testing GET /api/billing/pdf-download with missing userId...');
  const pdfReqGet = new Request('http://localhost:3000/api/billing/pdf-download');
  const pdfResGet = await getPdfDownload(pdfReqGet);
  const pdfJsonGet = await pdfResGet.json();
  assert.strictEqual(pdfResGet.status, 400);
  assert.strictEqual(pdfJsonGet.success, false);
  console.log('✔ PASS: GET pdf-download endpoint returns standard JSON error.\n');

  // Test 8: POST /api/developer/auth with bad credentials
  console.log('8. Testing POST /api/developer/auth with bad credentials...');
  const authReqBad = new Request('http://localhost:3000/api/developer/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'bad@example.com', password: 'wrong' }),
  });
  const authResBad = await postDeveloperAuth(authReqBad);
  const authJsonBad = await authResBad.json();
  assert.strictEqual(authResBad.status, 401);
  assert.strictEqual(authJsonBad.success, false);
  assert.strictEqual(authJsonBad.error, 'Invalid developer credentials.');
  console.log('✔ PASS: Invalid Super Admin returns 401 with standard JSON error.\n');

  // Test 9: POST /api/developer/customers authorization and empty body handling
  console.log('9. Testing POST /api/developer/customers unauthorized & empty body...');
  const devCustUnauthorized = new Request('http://localhost:3000/api/developer/customers', {
    method: 'POST',
    body: '',
  });
  const devCustUnauthRes = await postDeveloperCustomers(devCustUnauthorized);
  const devCustUnauthJson = await devCustUnauthRes.json();
  assert.strictEqual(devCustUnauthRes.status, 401);
  assert.strictEqual(devCustUnauthJson.success, false);

  const devAuth = verifyDeveloperCredentials('muhammedhazilav@gmail.com', 'easyworks@lnz321');
  assert(devAuth.success && devAuth.token, 'Should authenticate Super Admin');
  const testToken = devAuth.token;
  const devCustEmpty = new Request('http://localhost:3000/api/developer/customers', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${testToken}`,
      'Content-Type': 'application/json',
    },
    body: '',
  });
  const devCustRes = await postDeveloperCustomers(devCustEmpty);
  const devCustJson = await devCustRes.json();
  assert.strictEqual(devCustRes.status, 400);
  assert.strictEqual(devCustJson.success, false);
  console.log('✔ PASS: Developer customer endpoints return clean JSON for 401 and 400.\n');

  // Test 10: Payment Approval API Contract
  console.log('10. Testing Payment Approval API contract: { success: true, message: ..., payment: {}, subscription: {} }...');
  const testUserId = 'test_pay_user_' + Date.now();
  ensureUserAndTrial(testUserId, `${testUserId}@example.com`, 'Pay User', 'Acme Corp');
  const manualReq = createManualPaymentRequest({
    userId: testUserId,
    planId: 'plan_1m',
    amountINR: 299,
    utrNumber: 'UTR_TEST_' + Date.now(),
    userName: 'Pay User',
    userEmail: `${testUserId}@example.com`,
  });

  const approveReq = new Request('http://localhost:3000/api/admin/payments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      requestId: manualReq.id,
      action: 'APPROVE',
      adminName: 'Super Admin',
    }),
  });

  const approveRes = await postAdminPayments(approveReq);
  const approveJson = await approveRes.json();
  assert.strictEqual(approveRes.status, 200);
  assert.strictEqual(approveJson.success, true);
  assert.strictEqual(approveJson.message, 'Payment approved and subscription activated');
  assert(approveJson.payment && typeof approveJson.payment === 'object', 'Payment object must be returned');
  assert(approveJson.subscription && typeof approveJson.subscription === 'object', 'Subscription object must be returned');
  assert.strictEqual(approveJson.subscription.status, 'ACTIVE');
  assert.strictEqual(approveJson.subscription.pdfDownloadLimit, 30);
  console.log('✔ PASS: Payment approval strictly returns exact contract required.\n');

  console.log('===========================================================');
  console.log('ALL API JSON RESPONSE AND ZERO UNEXPECTED END OF JSON INPUT TESTS PASSED!');
  console.log('===========================================================');
}

runTests().catch((err) => {
  console.error('❌ TEST FAILED:', err);
  process.exit(1);
});
