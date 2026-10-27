import { NextRequest, NextResponse } from 'next/server';
import { getLogoFileFromStorage, saveLogoToStorage } from '@/lib/logoStorage';
import { getDatabase, getUserById } from '@/lib/db/database';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');
    const type = (searchParams.get('type') || 'active') as 'active' | 'original' | 'transparent';

    if (!userId) {
      return new NextResponse('User ID is required', { status: 400 });
    }

    // 1. Check disk storage first
    let file = getLogoFileFromStorage(userId, type);
    let source = file ? 'disk' : 'none';

    // 2. If not found on disk, fallback to database record (in case of container recreation or server move)
    if (!file) {
      const db = getDatabase();
      let row = db.prepare('SELECT logo_url, logo_original_url, logo_processed_url, logo_data, logo_original_data, logo_processed_data, logo_background_mode FROM businesses WHERE user_id = ?').get(userId) as any;
      if (!row && userId.includes('@')) {
        const u = db.prepare('SELECT id FROM users WHERE LOWER(email) = LOWER(?)').get(userId) as any;
        if (u) {
          row = db.prepare('SELECT logo_url, logo_original_url, logo_processed_url, logo_data, logo_original_data, logo_processed_data, logo_background_mode FROM businesses WHERE user_id = ?').get(u.id) as any;
        }
      }

      if (row) {
        let candidateUrl = '';
        if (type === 'original') {
          candidateUrl = row.logo_original_data || row.logo_original_url || row.logo_data || row.logo_url;
        } else if (type === 'transparent') {
          candidateUrl = row.logo_processed_data || row.logo_processed_url || row.logo_data || row.logo_url;
        } else {
          candidateUrl = row.logo_data || row.logo_url || row.logo_processed_data || row.logo_processed_url;
        }

        if (candidateUrl && candidateUrl.startsWith('data:')) {
          const match = candidateUrl.match(/^data:([^;]+);base64,(.+)$/);
          if (match) {
            const mimeType = match[1];
            const buffer = Buffer.from(match[2], 'base64');
            file = { buffer, mimeType };
            source = 'db_fallback';

            // Re-persist to disk so subsequent requests serve directly from filesystem
            try {
              saveLogoToStorage(
                userId,
                buffer,
                mimeType,
                buffer,
                row.logo_background_mode === 'original' ? 'original' : 'transparent'
              );
            } catch (saveErr) {
              console.warn('[logo/file] Failed to restore file to disk:', saveErr);
            }
          }
        }
      }
    }

    if (!file || !file.buffer || file.buffer.length === 0) {
      console.warn(`[LOGO DIAGNOSTIC] GET /api/business/logo/file - NOT FOUND for userId: ${userId}, type: ${type}`);
      return new NextResponse('Logo not found', { status: 404 });
    }

    console.log(`[LOGO DIAGNOSTIC] GET /api/business/logo/file - SERVED for userId: ${userId}, type: ${type}, source: ${source}, bytes: ${file.buffer.length}`);

    // Generate ETag based on length and simple hash
    const etag = `"${userId}-${type}-${file.buffer.length}"`;
    const ifNoneMatch = req.headers.get('if-none-match');
    if (ifNoneMatch === etag) {
      return new NextResponse(null, { status: 304 });
    }

    return new NextResponse(new Uint8Array(file.buffer), {
      status: 200,
      headers: {
        'Content-Type': file.mimeType,
        'Content-Length': String(file.buffer.length),
        'Cache-Control': 'public, max-age=31536000, immutable',
        'ETag': etag,
      },
    });
  } catch (error: any) {
    console.error('[GET /api/business/logo/file] Error:', error);
    return new NextResponse('Internal server error', { status: 500 });
  }
}
