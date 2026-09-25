/**
 * Easyworks Safe API Client
 * Robust response parsing that guarantees "Unexpected end of JSON input" will NEVER be thrown.
 */

export interface SafeApiResponse<T = any> {
  ok: boolean;
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
  status: number;
  statusText?: string;
  rawText?: string;
  [key: string]: any;
}

/**
 * Safely parse any fetch Response without throwing JSON syntax errors.
 * Handles:
 * 1. Empty bodies (0 bytes, 204 No Content)
 * 2. HTML error pages (404, 500, Next.js error pages)
 * 3. Malformed JSON
 * 4. Content-Type inspection
 * 5. Binary/PDF downloads
 */
export async function safeParseResponse<T = any>(res: Response): Promise<SafeApiResponse<T>> {
  const status = res.status;
  const statusText = res.statusText || '';
  const contentType = (res.headers.get('content-type') || '').toLowerCase();

  // 1. If it's a PDF / binary stream, don't attempt JSON parsing
  if (
    contentType.includes('application/pdf') ||
    contentType.includes('application/octet-stream') ||
    contentType.includes('image/')
  ) {
    return {
      ok: res.ok,
      success: res.ok,
      status,
      statusText,
      error: res.ok ? undefined : `File download returned HTTP ${status}`,
      isBinary: true,
      data: undefined,
    };
  }

  // 2. Read body text safely
  let text = '';
  try {
    text = await res.text();
  } catch (readErr: any) {
    console.error('[safeParseResponse] Body read error:', readErr);
    return {
      ok: false,
      success: false,
      status,
      statusText,
      error: `Failed to read server response: ${readErr?.message || 'Network stream error'}`,
      data: undefined,
    };
  }

  // 3. Handle empty response (0 bytes)
  if (!text || !text.trim()) {
    return {
      ok: res.ok,
      success: res.ok,
      status,
      statusText,
      error: res.ok ? undefined : `Server returned empty response (HTTP ${status})`,
      data: null as any,
      rawText: '',
    };
  }

  // 4. Handle HTML responses (e.g. Next.js crash page or proxy 502/404)
  const trimmed = text.trim();
  if (
    contentType.includes('text/html') ||
    trimmed.startsWith('<!DOCTYPE') ||
    trimmed.startsWith('<html')
  ) {
    const errorSnippet = trimmed
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 140);
    return {
      ok: false,
      success: false,
      status,
      statusText,
      error: `Server returned HTML error (HTTP ${status}): ${errorSnippet || 'Non-JSON server response'}`,
      rawText: trimmed,
      data: null as any,
    };
  }

  // 5. Parse JSON safely
  try {
    const parsed = JSON.parse(trimmed);
    if (typeof parsed === 'object' && parsed !== null) {
      const isSuccess = parsed.success !== undefined ? Boolean(parsed.success) : res.ok;
      return {
        ...parsed,
        data: parsed,
        ok: res.ok && isSuccess,
        success: isSuccess,
        status,
        statusText,
        rawText: trimmed,
        error: parsed.error || (!res.ok ? `Request failed (HTTP ${status})` : undefined),
      };
    }
    return {
      ok: res.ok,
      success: res.ok,
      data: parsed,
      status,
      statusText,
      rawText: trimmed,
    };
  } catch (jsonErr: any) {
    console.error('[safeParseResponse] JSON parse error:', jsonErr, 'Raw payload:', trimmed.slice(0, 150));
    return {
      ok: false,
      success: false,
      status,
      statusText,
      rawText: trimmed,
      data: null as any,
      error: `Malformed JSON response (HTTP ${status}): ${trimmed.slice(0, 80)}`,
    };
  }
}

/**
 * Robust fetch wrapper that always returns a SafeApiResponse and never throws JSON syntax errors.
 */
export async function safeFetchJson<T = any>(
  url: string,
  options?: RequestInit
): Promise<SafeApiResponse<T>> {
  try {
    const res = await fetch(url, options);
    return await safeParseResponse<T>(res);
  } catch (networkErr: any) {
    console.error(`[safeFetchJson] Network error for ${url}:`, networkErr);
    return {
      ok: false,
      success: false,
      status: 0,
      statusText: 'Network Error',
      error: networkErr?.message || 'Unable to connect to server. Please check your network connection.',
      data: null as any,
    };
  }
}
