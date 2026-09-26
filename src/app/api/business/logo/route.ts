import { NextRequest, NextResponse } from 'next/server';
import {
  updateBusinessLogo,
  toggleBusinessLogo,
  removeBusinessLogo,
  getBusinessLogo,
  getUserById,
} from '@/lib/db/database';
import { apiSuccess, apiError, apiBadRequest, apiNotFound } from '@/lib/api/server';

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

const ALLOWED_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/svg+xml',
]);

/**
 * Validates magic bytes for binary image formats and sanitizes SVG.
 */
function validateImageBuffer(
  buffer: Buffer,
  mimeType: string
): { valid: boolean; normalizedMime?: string; error?: string } {
  if (buffer.length === 0) {
    return { valid: false, error: 'Empty file uploaded.' };
  }
  if (buffer.length > MAX_FILE_SIZE_BYTES) {
    return { valid: false, error: 'File size exceeds maximum limit of 5 MB.' };
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return { valid: true, normalizedMime: 'image/png' };
  }

  // JPEG / JPG: FF D8 FF
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { valid: true, normalizedMime: 'image/jpeg' };
  }

  // WebP: RIFF (52 49 46 46) ... WEBP (57 45 42 50)
  if (
    buffer.length >= 12 &&
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return { valid: true, normalizedMime: 'image/webp' };
  }

  // SVG: Check text XML structure and sanitize against script tags and JS handlers
  if (mimeType === 'image/svg+xml' || buffer.subarray(0, 50).toString('utf-8').includes('<svg')) {
    const text = buffer.toString('utf-8');
    if (!text.includes('<svg') || !text.includes('</svg>')) {
      return { valid: false, error: 'Invalid SVG format.' };
    }
    const dangerousPatterns = [
      /<script[\s\S]*?>[\s\S]*?<\/script>/gi,
      /javascript:/gi,
      /\bon\w+\s*=/gi, // onerror=, onload=, onclick=, etc.
      /<object[\s\S]*?>/gi,
      /<embed[\s\S]*?>/gi,
    ];
    for (const pattern of dangerousPatterns) {
      if (pattern.test(text)) {
        return { valid: false, error: 'SVG contains insecure scripts or handlers.' };
      }
    }
    return { valid: true, normalizedMime: 'image/svg+xml' };
  }

  return {
    valid: false,
    error: 'Unsupported image format. Allowed formats: PNG, JPG/JPEG, WebP, SVG.',
  };
}

/**
 * POST /api/business/logo
 * Uploads and sets the business logo for a user.
 */
export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get('content-type') || '';
    let userId = '';
    let logoDataUrl = '';
    let logoEnabled = true;

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      userId = (formData.get('userId') as string) || '';
      const enabledVal = formData.get('logoEnabled');
      if (enabledVal !== null && enabledVal !== undefined) {
        logoEnabled = enabledVal === 'true' || enabledVal === '1';
      }

      const file = formData.get('file') as File | null;
      if (!file) {
        return apiBadRequest('No logo file provided.');
      }

      if (file.size > MAX_FILE_SIZE_BYTES) {
        return apiBadRequest('File size exceeds 5 MB limit.');
      }

      const rawMime = file.type || '';
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      const validation = validateImageBuffer(buffer, rawMime);
      if (!validation.valid || !validation.normalizedMime) {
        return apiBadRequest(validation.error || 'Invalid image file.');
      }

      logoDataUrl = `data:${validation.normalizedMime};base64,${buffer.toString('base64')}`;
    } else if (contentType.includes('application/json')) {
      const body = await req.json();
      userId = body.userId || '';
      if (body.logoEnabled !== undefined) {
        logoEnabled = Boolean(body.logoEnabled);
      }

      const rawDataUrl = body.logoDataUrl || body.logoUrl || '';
      if (!rawDataUrl || typeof rawDataUrl !== 'string') {
        return apiBadRequest('Valid logoDataUrl or file is required.');
      }

      // Check data URL format: data:<mime>;base64,<data>
      const match = rawDataUrl.match(/^data:([^;]+);base64,(.+)$/);
      if (!match) {
        return apiBadRequest('Invalid data URL format. Expected base64 image data URL.');
      }

      const mimeType = match[1];
      if (!ALLOWED_MIME_TYPES.has(mimeType)) {
        return apiBadRequest('Unsupported image type.');
      }

      const base64Data = match[2];
      const buffer = Buffer.from(base64Data, 'base64');

      const validation = validateImageBuffer(buffer, mimeType);
      if (!validation.valid || !validation.normalizedMime) {
        return apiBadRequest(validation.error || 'Invalid image content.');
      }

      logoDataUrl = `data:${validation.normalizedMime};base64,${buffer.toString('base64')}`;
    } else {
      return apiBadRequest('Unsupported content type. Send multipart/form-data or application/json.');
    }

    if (!userId || !userId.trim()) {
      return apiBadRequest('User ID is required.');
    }

    const user = getUserById(userId);
    if (!user) {
      return apiNotFound('User not found.');
    }

    const result = updateBusinessLogo(userId, logoDataUrl, logoEnabled);
    return apiSuccess({
      message: 'Business logo uploaded successfully.',
      logoUrl: result.logoUrl,
      logoEnabled: result.logoEnabled,
    });
  } catch (error: any) {
    console.error('[POST /api/business/logo] Error:', error);
    return apiError(error.message || 'Failed to upload business logo.', 500);
  }
}

/**
 * PATCH /api/business/logo
 * Toggles logo visibility on documents.
 */
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, logoEnabled } = body;

    if (!userId || typeof userId !== 'string') {
      return apiBadRequest('User ID is required.');
    }

    if (logoEnabled === undefined || typeof logoEnabled !== 'boolean') {
      return apiBadRequest('logoEnabled boolean flag is required.');
    }

    const user = getUserById(userId);
    if (!user) {
      return apiNotFound('User not found.');
    }

    const result = toggleBusinessLogo(userId, logoEnabled);
    return apiSuccess({
      message: `Logo visibility updated to ${logoEnabled ? 'enabled' : 'disabled'}.`,
      logoEnabled: result.logoEnabled,
    });
  } catch (error: any) {
    console.error('[PATCH /api/business/logo] Error:', error);
    return apiError(error.message || 'Failed to update logo visibility.', 500);
  }
}

/**
 * DELETE /api/business/logo
 * Removes business logo.
 */
export async function DELETE(req: NextRequest) {
  try {
    let userId = req.nextUrl.searchParams.get('userId') || '';
    if (!userId) {
      try {
        const body = await req.json();
        userId = body?.userId || '';
      } catch {}
    }

    if (!userId || typeof userId !== 'string') {
      return apiBadRequest('User ID is required.');
    }

    const user = getUserById(userId);
    if (!user) {
      return apiNotFound('User not found.');
    }

    removeBusinessLogo(userId);
    return apiSuccess({
      message: 'Business logo removed successfully.',
    });
  } catch (error: any) {
    console.error('[DELETE /api/business/logo] Error:', error);
    return apiError(error.message || 'Failed to remove business logo.', 500);
  }
}

/**
 * GET /api/business/logo
 * Retrieves logo status and URL.
 */
export async function GET(req: NextRequest) {
  try {
    const userId = req.nextUrl.searchParams.get('userId');
    if (!userId) {
      return apiBadRequest('User ID query parameter is required.');
    }

    const logoInfo = getBusinessLogo(userId);
    return apiSuccess(logoInfo);
  } catch (error: any) {
    console.error('[GET /api/business/logo] Error:', error);
    return apiError(error.message || 'Failed to retrieve business logo.', 500);
  }
}
