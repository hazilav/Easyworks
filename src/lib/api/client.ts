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
  requestId?: string;
  status: number;
  statusText?: string;
  rawText?: string;
  [key: string]: any;
}

/**
 * Generate client-side Request ID formatted as EW-XXXXXX
 */
export function generateRequestId(): string {
  const chars = '0123456789ABCDEF';
  let rand = '';
  for (let i = 0; i < 6; i++) {
    rand += chars[Math.floor(Math.random() * chars.length)];
  }
  return `EW-${rand}`;
}

/**
 * Safely parse any fetch Response without throwing JSON syntax errors.
 * Handles:
 * 1. Empty bodies (0 bytes, 204 No Content)
 * 2. HTML error pages (404, 500, Next.js error pages)
 * 3. Malformed JSON
 * 4. Content-Type inspection
 * 5. Binary/PDF downloads
 * 6. Request ID propagation (EW-XXXXXX)
 */
export async function safeParseResponse<T = any>(
  res: Response,
  reqRequestId?: string,
  reqMeta?: { url?: string; method?: string }
): Promise<SafeApiResponse<T>> {
  const status = res.status;
  const statusText = res.statusText || '';
  const contentType = (res.headers.get('content-type') || '').toLowerCase();
  const headerRequestId = res.headers.get('x-request-id');
  const requestId = headerRequestId || reqRequestId || generateRequestId();

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
      requestId,
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
    console.error(`[API Error Diagnostics]
Request ID: ${requestId}
HTTP method: ${reqMeta?.method || 'GET'}
API URL: ${reqMeta?.url || 'unknown'}
HTTP status: ${status}
Response Content-Type: ${contentType || 'none'}
Read error: ${readErr?.message || 'Network stream error'}`);

    return {
      ok: false,
      success: false,
      status,
      statusText,
      requestId,
      error: `Server error — Request ID: ${requestId}. Please try again. If the problem continues, provide this Request ID to the Developer.`,
      data: undefined,
    };
  }

  // 3. Handle empty response (0 bytes)
  if (!text || !text.trim()) {
    if (!res.ok) {
      console.error(`[API Error Diagnostics]
Request ID: ${requestId}
HTTP method: ${reqMeta?.method || 'GET'}
API URL: ${reqMeta?.url || 'unknown'}
HTTP status: ${status}
Response Content-Type: ${contentType || 'none'}
Response length: 0 bytes`);
    }

    const defaultMsg =
      status >= 500
        ? `Server error — Request ID: ${requestId}. Please try again. If the problem continues, provide this Request ID to the Developer.`
        : `Request failed (HTTP ${status})`;

    return {
      ok: res.ok,
      success: res.ok,
      status,
      statusText,
      requestId,
      error: res.ok ? undefined : defaultMsg,
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
    console.error(`[API Error Diagnostics]
Request ID: ${requestId}
HTTP method: ${reqMeta?.method || 'GET'}
API URL: ${reqMeta?.url || 'unknown'}
HTTP status: ${status}
Response Content-Type: ${contentType}
Response length: ${trimmed.length} bytes
HTML Preview: ${trimmed.slice(0, 200)}`);

    const defaultMsg =
      status >= 500
        ? `Server error — Request ID: ${requestId}. Please try again. If the problem continues, provide this Request ID to the Developer.`
        : `Request failed with HTML error (HTTP ${status})`;

    return {
      ok: false,
      success: false,
      status,
      statusText,
      requestId,
      error: defaultMsg,
      rawText: trimmed,
      data: null as any,
    };
  }

  // 5. Parse JSON safely
  try {
    const parsed = JSON.parse(trimmed);
    if (typeof parsed === 'object' && parsed !== null) {
      const isSuccess = parsed.success !== undefined ? Boolean(parsed.success) : res.ok;
      const effectiveRequestId = parsed.requestId || requestId;

      let formattedError = parsed.error;
      if (!isSuccess && status >= 500 && !formattedError) {
        formattedError = `Server error — Request ID: ${effectiveRequestId}. Please try again. If the problem continues, provide this Request ID to the Developer.`;
      }

      if (!isSuccess && status >= 500) {
        console.error(`[API Error Diagnostics]
Request ID: ${effectiveRequestId}
HTTP method: ${reqMeta?.method || 'GET'}
API URL: ${reqMeta?.url || 'unknown'}
HTTP status: ${status}
Response Content-Type: ${contentType}
Response length: ${trimmed.length} bytes
Error: ${parsed.error || 'Server error'}`);
      }

      return {
        ...parsed,
        data: parsed,
        ok: res.ok && isSuccess,
        success: isSuccess,
        status,
        statusText,
        requestId: effectiveRequestId,
        rawText: trimmed,
        error: formattedError || (!res.ok ? `Request failed (HTTP ${status})` : undefined),
      };
    }
    return {
      ok: res.ok,
      success: res.ok,
      data: parsed,
      status,
      statusText,
      requestId,
      rawText: trimmed,
    };
  } catch (jsonErr: any) {
    console.error(`[API Error Diagnostics]
Request ID: ${requestId}
HTTP method: ${reqMeta?.method || 'GET'}
API URL: ${reqMeta?.url || 'unknown'}
HTTP status: ${status}
Response Content-Type: ${contentType}
Response length: ${trimmed.length} bytes
JSON parse error: ${jsonErr?.message}
Raw payload: ${trimmed.slice(0, 150)}`);

    return {
      ok: false,
      success: false,
      status,
      statusText,
      requestId,
      rawText: trimmed,
      data: null as any,
      error: `Server error — Request ID: ${requestId}. Please try again. If the problem continues, provide this Request ID to the Developer.`,
    };
  }
}

/**
 * Robust fetch wrapper that always returns a SafeApiResponse and never throws JSON syntax errors.
 * Automatically injects X-Request-Id header in EW-XXXXXX format.
 */
export async function safeFetchJson<T = any>(
  url: string,
  options?: RequestInit
): Promise<SafeApiResponse<T>> {
  const customHeaders: Record<string, string> = {};
  if (options?.headers) {
    if (typeof (options.headers as any).forEach === 'function') {
      (options.headers as any).forEach((value: string, key: string) => {
        customHeaders[key.toLowerCase()] = value;
      });
    } else if (Array.isArray(options.headers)) {
      options.headers.forEach(([k, v]) => {
        customHeaders[k.toLowerCase()] = v;
      });
    } else {
      Object.entries(options.headers).forEach(([k, v]) => {
        customHeaders[k.toLowerCase()] = String(v);
      });
    }
  }

  const clientRequestId = customHeaders['x-request-id'] || generateRequestId();
  const headers = {
    'X-Request-Id': clientRequestId,
    ...(options?.headers || {}),
  };

  const method = (options?.method || 'GET').toUpperCase();

  try {
    const res = await fetch(url, { ...options, headers });
    return await safeParseResponse<T>(res, clientRequestId, { url, method });
  } catch (networkErr: any) {
    console.error(`[API Network Diagnostics]
Request ID: ${clientRequestId}
HTTP method: ${method}
API URL: ${url}
Error: ${networkErr?.message || 'Network failure'}`);

    return {
      ok: false,
      success: false,
      status: 0,
      statusText: 'Network Error',
      requestId: clientRequestId,
      error: `Server error — Request ID: ${clientRequestId}. Please try again. If the problem continues, provide this Request ID to the Developer.`,
      data: null as any,
    };
  }
}
