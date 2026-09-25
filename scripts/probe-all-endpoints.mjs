import { safeParseResponse } from '../src/lib/api/client.ts';

const BASE_URL = 'http://localhost:3000';

const endpoints = [
  // General / Customer / Public endpoints
  { method: 'GET', url: '/api/billing/plans' },
  { method: 'GET', url: '/api/billing/subscription' },
  { method: 'GET', url: '/api/billing/subscription?userId=test_user_123' },
  { method: 'POST', url: '/api/billing/subscription', body: { userId: 'test_user_123', email: 'test@example.com' } },
  { method: 'GET', url: '/api/billing/payment-settings' },
  { method: 'GET', url: '/api/billing/pdf-download' },
  { method: 'GET', url: '/api/billing/pdf-download?userId=test_user_123' },
  { method: 'POST', url: '/api/billing/pdf-download', body: { userId: 'test_user_123', documentType: 'QUOTATION' } },
  { method: 'GET', url: '/api/billing/manual-payment?userId=test_user_123' },
  { method: 'POST', url: '/api/billing/manual-payment', body: {} },
  { method: 'POST', url: '/api/billing/create-order', body: { planId: 'plan_1m' } },
  { method: 'POST', url: '/api/billing/custom-plan-request', body: {} },
  { method: 'POST', url: '/api/billing/verify-payment', body: {} },
  { method: 'GET', url: '/api/documents' },
  { method: 'GET', url: '/api/documents?userId=test_user_123' },
  { method: 'POST', url: '/api/documents', body: {} },
  { method: 'POST', url: '/api/auth/send-verification', body: {} },
  { method: 'POST', url: '/api/auth/verify-code', body: {} },
  { method: 'GET', url: '/api/auth/trial-eligibility' },
  { method: 'GET', url: '/api/auth/trial-eligibility?userId=test_user_123' },

  // Admin endpoints
  { method: 'GET', url: '/api/admin/billing' },
  { method: 'POST', url: '/api/admin/billing', body: {} },
  { method: 'GET', url: '/api/admin/payments' },
  { method: 'POST', url: '/api/admin/payments', body: {} },
  { method: 'GET', url: '/api/admin/trials' },
  { method: 'POST', url: '/api/admin/trials', body: {} },

  // Developer endpoints
  { method: 'GET', url: '/api/developer/auth' },
  { method: 'POST', url: '/api/developer/auth', body: { email: 'muhammedhazilav@gmail.com', password: 'wrong' } },
  { method: 'POST', url: '/api/developer/auth', body: { email: 'muhammedhazilav@gmail.com', password: 'easyworks@lnz321' } },
  { method: 'GET', url: '/api/developer/stats' },
  { method: 'GET', url: '/api/developer/plans' },
  { method: 'POST', url: '/api/developer/plans', body: {} },
  { method: 'GET', url: '/api/developer/settings' },
  { method: 'POST', url: '/api/developer/settings', body: {} },
  { method: 'GET', url: '/api/developer/customers' },
  { method: 'POST', url: '/api/developer/customers', body: {} },
  { method: 'GET', url: '/api/developer/customers/cust_123' },
];

async function probe() {
  console.log('--- PROBING ALL EASYWORKS API ENDPOINTS ---\n');
  const results = [];

  for (const ep of endpoints) {
    const fullUrl = BASE_URL + ep.url;
    try {
      const options = {
        method: ep.method,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      };
      if (ep.body) {
        options.body = JSON.stringify(ep.body);
      }

      const res = await fetch(fullUrl, options);
      const text = await res.text();
      const contentType = res.headers.get('content-type') || 'none';
      const contentLength = res.headers.get('content-length') || text.length;

      const is500Empty = res.status === 500 && text.trim().length === 0;
      const isHtml = text.trim().startsWith('<!DOCTYPE') || text.trim().startsWith('<html');
      const isEmpty = text.trim().length === 0;

      let parsed = null;
      let parseError = null;
      try {
        parsed = JSON.parse(text);
      } catch (e) {
        parseError = e.message;
      }

      const result = {
        endpoint: `${ep.method} ${ep.url}`,
        status: res.status,
        contentType,
        bodyLength: text.length,
        bodySnippet: text.slice(0, 100),
        is500Empty,
        isHtml,
        isEmpty,
        parseError,
      };

      results.push(result);

      const statusTag = res.status >= 500 ? `❌ ${res.status}` : res.status >= 400 ? `⚠️ ${res.status}` : `✔ ${res.status}`;
      console.log(`${statusTag} [${ep.method}] ${ep.url} -> Length: ${text.length} bytes, Content-Type: ${contentType}`);
      if (is500Empty || parseError) {
        console.error(`   >>> CRITICAL ERROR: Empty 500 or JSON parse error! Snippet: "${text.slice(0, 100)}"`);
      }
    } catch (netErr) {
      console.error(`❌ Network error for ${ep.method} ${ep.url}:`, netErr.message);
    }
  }

  const failures = results.filter((r) => r.is500Empty || (r.status === 500 && r.isEmpty) || r.isHtml);
  console.log('\n=================================================');
  console.log(`PROBE FINISHED: ${results.length} endpoints probed. Failures: ${failures.length}`);
  if (failures.length > 0) {
    console.error('FAILING ENDPOINTS:');
    console.error(JSON.stringify(failures, null, 2));
  } else {
    console.log('ALL PROBED ENDPOINTS RETURNED VALID NON-EMPTY RESPONSES!');
  }
  console.log('=================================================\n');
}

probe().catch(console.error);
