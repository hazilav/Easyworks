import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';

/**
 * Strips any sensitive credentials or secrets from client-facing error messages.
 */
export function sanitizeErrorMessage(message: string): string {
  if (!message) return 'An unexpected error occurred.';
  return message
    .replace(/(password|secret|token|api_key|key|auth|bearer)\s*[:=]\s*[^\s,]+/gi, '$1=[REDACTED]')
    .replace(/node_modules\/[^\s:]+/g, '')
    .trim();
}

/**
 * Standard successful JSON response
 */
export function apiSuccess<T extends Record<string, any>>(data: T, status = 200): NextResponse {
  return NextResponse.json(
    {
      success: true,
      ...data,
    },
    {
      status,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store, max-age=0',
      },
    }
  );
}

/**
 * Standard error JSON response with proper HTTP status and optional requestId
 */
export function apiError(
  error: string,
  status = 500,
  code?: string,
  extra?: Record<string, any>
): NextResponse {
  const requestId = extra?.requestId || 'req_' + crypto.randomBytes(4).toString('hex');
  return NextResponse.json(
    {
      success: false,
      error: sanitizeErrorMessage(error),
      ...(code ? { code } : {}),
      requestId,
      ...extra,
    },
    {
      status,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store, max-age=0',
      },
    }
  );
}

/**
 * Standard 401 Unauthorized response
 */
export function apiUnauthorized(
  message = 'Authentication required',
  code = 'UNAUTHORIZED'
): NextResponse {
  return apiError(message, 401, code);
}

/**
 * Safely parse JSON request body from NextRequest.
 * Will NEVER throw "Unexpected end of JSON input".
 * If body is empty or whitespace, resolves to `{ success: true, body: {} }`.
 */
export async function safeReadBody<T = any>(
  req: NextRequest
): Promise<{ success: true; body: T } | { success: false; error: string; response: NextResponse }> {
  try {
    const text = await req.text();
    if (!text || !text.trim()) {
      return { success: true, body: {} as T };
    }
    const body = JSON.parse(text);
    return { success: true, body };
  } catch (err: any) {
    const errorMsg = 'Invalid JSON request payload: ' + (err?.message || 'Empty or malformed JSON');
    return {
      success: false,
      error: errorMsg,
      response: apiError(errorMsg, 400, 'INVALID_JSON'),
    };
  }
}
