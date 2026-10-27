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

    // 2. If not found on disk, fallback to database record (in case of container recreation or server move)
    if (!file) {
      const db = getDatabase();
      const row = db.prepare('SELECT logo_url, logo_original_url, logo_processed_url, logo_background_mode FROM businesses WHERE user_id = ?').get(userId) as any;

      if (row) {
        let candidateUrl = '';
        if (type === 'original') {
          candidateUrl = row.logo_original_url || row.logo_url;
        } else if (type === 'transparent') {
          candidateUrl = row.logo_processed_url || row.logo_url;
        } else {
          candidateUrl = row.logo_url;
        }

        if (candidateUrl && candidateUrl.startsWith('data:')) {
          const match = candidateUrl.match(/^data:([^;]+);base64,(.+)$/);
          if (match) {
            const mimeType = match[1];
            const buffer = Buffer.from(match[2], 'base64');
            file = { buffer, mimeType };

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
      return new NextResponse('Logo not found', { status: 404 });
    }

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
