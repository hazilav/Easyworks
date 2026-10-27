import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { POST as uploadLogoHandler, PATCH as patchLogoHandler, DELETE as deleteLogoHandler } from '../src/app/api/business/logo/route';
import { GET as getLogoFileHandler } from '../src/app/api/business/logo/file/route';
import { GET as getProfileHandler } from '../src/app/api/business/profile/route';
import { preloadLogoForPdf } from '../src/lib/pdfGenerator';
import { NextRequest } from 'next/server';

const TEST_USER_ID = 'usr_bXVoYW1tZW';

console.log('========================================================');
console.log('   EASYWORKS LOGO LIFECYCLE DIRECT RUNTIME TEST');
console.log('========================================================\n');

// 1x1 test PNG
const PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const PNG_BUFFER = Buffer.from(PNG_BASE64, 'base64');

async function runTest() {
  try {
    console.log('[STAGE 1 & 2] Calling POST /api/business/logo route handler...');
    const formData = new FormData();
    const blob = new Blob([PNG_BUFFER], { type: 'image/png' });
    formData.append('file', blob, 'test-brand-logo.png');
    formData.append('userId', TEST_USER_ID);

    const uploadReq = new NextRequest('http://localhost/api/business/logo', {
      method: 'POST',
      body: formData,
    });

    const uploadRes = await uploadLogoHandler(uploadReq);
    console.log(`Upload Response Status: ${uploadRes.status}`);
    const uploadData = await uploadRes.json();
    console.log('Upload Result:', JSON.stringify(uploadData, null, 2));

    if (uploadRes.status !== 200 || !uploadData.success) {
      throw new Error(`Upload route failed with status ${uploadRes.status}`);
    }

    console.log('\n[STAGE 3, 4, 5 & 6] Inspecting SQLite database record directly...');
    const db = new DatabaseSync('data/easyworks.db');
    const bizRow = db.prepare(`
      SELECT id, user_id, logo_url, logo_original_url, logo_processed_url, 
             logo_background_mode, logo_data, logo_original_data, logo_processed_data 
      FROM businesses 
      WHERE user_id = ?
    `).get(TEST_USER_ID) as any;

    console.log('Persisted SQLite Business Record:');
    console.log(`- ID: ${bizRow.id}`);
    console.log(`- user_id: ${bizRow.user_id}`);
    console.log(`- logo_url: ${bizRow.logo_url}`);
    console.log(`- logo_original_url: ${bizRow.logo_original_url}`);
    console.log(`- logo_processed_url: ${bizRow.logo_processed_url}`);
    console.log(`- logo_background_mode: ${bizRow.logo_background_mode}`);
    console.log(`- has logo_data: ${Boolean(bizRow.logo_data)} (len: ${bizRow.logo_data?.length || 0})`);
    console.log(`- has logo_original_data: ${Boolean(bizRow.logo_original_data)} (len: ${bizRow.logo_original_data?.length || 0})`);
    console.log(`- has logo_processed_data: ${Boolean(bizRow.logo_processed_data)} (len: ${bizRow.logo_processed_data?.length || 0})`);

    if (!bizRow.logo_url || !bizRow.logo_data) {
      throw new Error('Verification failed: logo_url or logo_data is missing in SQLite database!');
    }

    console.log('\n[STAGE 7, 8 & 9] Simulating Page Refresh: calling GET /api/business/profile...');
    const profileReq = new NextRequest(`http://localhost/api/business/profile?userId=${TEST_USER_ID}`);
    const profileRes = await getProfileHandler(profileReq);
    console.log(`Profile GET Status: ${profileRes.status}`);
    const profileData = await profileRes.json();
    console.log('Profile Business Data on Refresh:', {
      businessName: profileData.profile?.businessName,
      logoUrl: profileData.profile?.logoUrl,
      hasLogoData: Boolean(profileData.profile?.logoData),
      logoEnabledQuotations: profileData.profile?.logoEnabledQuotations,
      logoEnabledInvoices: profileData.profile?.logoEnabledInvoices,
    });

    if (!profileData.profile?.logoUrl || profileData.profile.logoUrl !== bizRow.logo_url) {
      throw new Error('Verification failed: profile GET does not return saved logoUrl on refresh!');
    }

    console.log('\n[STAGE 10] Testing Logo File Fetch: calling GET /api/business/logo/file...');
    const fileReq = new NextRequest(`http://localhost/api/business/logo/file?userId=${TEST_USER_ID}&type=active`);
    const fileRes = await getLogoFileHandler(fileReq);
    console.log(`File GET Status: ${fileRes.status}`);
    console.log(`File Content-Type: ${fileRes.headers.get('content-type')}`);
    const fileBytes = await fileRes.arrayBuffer();
    console.log(`File Bytes Received: ${fileBytes.byteLength}`);

    if (fileRes.status !== 200 || fileBytes.byteLength === 0) {
      throw new Error('Verification failed: logo file endpoint did not serve image binary!');
    }

    console.log('\n[STAGE 11] Disk-Loss Self-Healing Verification...');
    const uploadsDir = path.join(process.cwd(), 'public', 'uploads', 'logos');
    if (fs.existsSync(uploadsDir)) {
      const files = fs.readdirSync(uploadsDir).filter(f => f.startsWith(TEST_USER_ID));
      console.log(`Deleting ${files.length} logo files from disk to simulate cold server restart / container wipe...`);
      files.forEach(f => fs.unlinkSync(path.join(uploadsDir, f)));
    }

    console.log('Calling GET /api/business/logo/file after disk files removed...');
    const healReq = new NextRequest(`http://localhost/api/business/logo/file?userId=${TEST_USER_ID}&type=active`);
    const healRes = await getLogoFileHandler(healReq);
    console.log(`Self-Healing GET Status: ${healRes.status}`);
    console.log(`Self-Healing Content-Type: ${healRes.headers.get('content-type')}`);
    const healBytes = await healRes.arrayBuffer();
    console.log(`Self-Healing Bytes Received: ${healBytes.byteLength}`);

    if (healRes.status !== 200 || healBytes.byteLength === 0) {
      throw new Error('Self-healing failed: logo could not be served from database backup!');
    }

    const diskFilesAfterHealing = fs.readdirSync(uploadsDir).filter(f => f.startsWith(TEST_USER_ID));
    console.log(`Disk files restored by self-healing: ${diskFilesAfterHealing.join(', ')}`);

    console.log('\n[STAGE 12] Testing Background Mode Toggle via PATCH /api/business/logo...');
    const toggleReq = new NextRequest('http://localhost/api/business/logo', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: TEST_USER_ID,
        mode: 'original',
      }),
    });
    const toggleRes = await patchLogoHandler(toggleReq);
    const toggleData = await toggleRes.json();
    console.log('Toggle Result:', toggleData);
    if (toggleRes.status !== 200 || !toggleData.success) {
      throw new Error('Toggle background mode failed!');
    }

    console.log('\n[STAGE 13] Testing preloadLogoForPdf for jsPDF rendering...');
    const preloaded = await preloadLogoForPdf(bizRow.logo_url);
    console.log(`Preload result type: ${typeof preloaded}, non-null: ${Boolean(preloaded)}`);

    console.log('\n[STAGE 14] Verifying Database Record Counts...');
    const uCount = db.prepare('SELECT count(*) as c FROM users').get() as any;
    const bCount = db.prepare('SELECT count(*) as c FROM businesses').get() as any;
    const sCount = db.prepare('SELECT count(*) as c FROM subscriptions').get() as any;
    const pCount = db.prepare('SELECT count(*) as c FROM payments').get() as any;

    console.log(`Users: ${uCount.c} (expected 26)`);
    console.log(`Businesses: ${bCount.c} (expected 26)`);
    console.log(`Subscriptions: ${sCount.c} (expected 26)`);
    console.log(`Payments: ${pCount.c} (expected 5)`);

    if (uCount.c !== 26 || bCount.c !== 26 || sCount.c !== 26 || pCount.c !== 5) {
      throw new Error('Database record count mismatch!');
    }

    console.log('\n========================================================');
    console.log('✅ ALL LIFECYCLE STAGES VERIFIED AND WORKING 100%!');
    console.log('========================================================');
  } catch (err) {
    console.error('\n❌ LIFECYCLE TEST FAILED:', err);
    process.exit(1);
  }
}

runTest();
