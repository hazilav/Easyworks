import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';

/**
 * Strips any sensitive credentials, tokens, passwords, or secrets from error messages and logs.
 */
export function sanitizeErrorMessage(message: string): string {
  if (!message) return 'An unexpected error occurred.';
  return message
    .replace(/(password|secret|token|api_key|apiKey|auth|bearer|pin|cvv)\s*[:=]\s*['"]?[^\s,'"]+['"]?/gi, '$1=[REDACTED]')
    .replace(/node_modules\/[^\s:]+/g, '')
    .trim();
}

export interface LogApiErrorParams {
  requestId: string;
  apiRoute: string;
  method: string;
  userId?: string;
  recordId?: string;
  errorMessage: string;
  stackTrace?: string;
}

/**
 * Logs the real error server-side while redacting sensitive customer and credential info.
 */
export function logApiError(params: LogApiErrorParams): void {
  const timestamp = new Date().toISOString();
  const sanitizedMsg = sanitizeErrorMessage(params.errorMessage);
  const sanitizedStack = params.stackTrace ? sanitizeErrorMessage(params.stackTrace) : undefined;

  const header = `[API_ERROR] ${timestamp} | RequestId: ${params.requestId} | Route: ${params.apiRoute} | Method: ${params.method} | User: ${params.userId || 'N/A'}${params.recordId ? ` | Record: ${params.recordId}` : ''}`;
  console.error(header);
  console.error(`Message: ${sanitizedMsg}`);
  if (sanitizedStack) {
    console.error(`Stack: ${sanitizedStack}`);
  }
}

/**
 * Generate server-side Request ID formatted as EW-XXXXXX
 */
export function generateServerRequestId(): string {
  const chars = '0123456789ABCDEF';
  let rand = '';
  for (let i = 0; i < 6; i++) {
    rand += chars[Math.floor(Math.random() * chars.length)];
  }
  return `EW-${rand}`;
}

/**
 * Standard successful JSON response
 */
export function apiSuccess<T extends Record<string, any>>(
  data: T,
  status = 200,
  extraHeaders?: Record<string, string>
): NextResponse {
  const requestId = data?.requestId || extraHeaders?.['x-request-id'] || generateServerRequestId();
  return NextResponse.json(
    {
      success: true,
      requestId,
      ...data,
    },
    {
      status,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store, max-age=0',
        'X-Request-Id': requestId,
        ...(extraHeaders || {}),
      },
    }
  );
}

/**
 * Standard error JSON response with proper HTTP status, code, and requestId.
 * Guarantees that an empty response (0 bytes) is NEVER returned to the client.
 * Automatically logs server-side 500 errors with redacted credentials.
 */
export function apiError(
  error: string | Error | any,
  status = 500,
  code?: string,
  extra?: Record<string, any>
): NextResponse {
  let requestId = extra?.requestId;
  if (!requestId || typeof requestId !== 'string' || !requestId.startsWith('EW-')) {
    requestId = generateServerRequestId();
  }
  const errorCode = code || (status >= 500 ? 'INTERNAL_SERVER_ERROR' : status === 400 ? 'BAD_REQUEST' : status === 404 ? 'NOT_FOUND' : undefined);

  const rawMessage = typeof error === 'string' ? error : error?.message || String(error || 'An unexpected error occurred.');
  const cleanMessage = sanitizeErrorMessage(rawMessage);
  const stackTrace = extra?.stack || (error instanceof Error ? error.stack : undefined);

  if (status >= 500) {
    logApiError({
      requestId,
      apiRoute: extra?.apiRoute || extra?.route || 'API',
      method: extra?.method || 'REQUEST',
      userId: extra?.userId,
      recordId: extra?.recordId,
      errorMessage: cleanMessage,
      stackTrace,
    });

    // Also persist in activity_logs asynchronously so Developer Panel can view it
    try {
      const { logActivity } = require('@/lib/db/database');
      logActivity(
        'API_ERROR',
        `[${requestId}] ${extra?.method || 'REQ'} ${extra?.apiRoute || 'API'} - ${cleanMessage.slice(0, 200)}`,
        'system',
        extra?.userId
      );
    } catch {}
  }

  const safeExtra = { ...extra };
  delete (safeExtra as any).password;
  delete (safeExtra as any).token;
  delete (safeExtra as any).secret;
  delete (safeExtra as any).apiKey;
  delete (safeExtra as any).auth;
  delete (safeExtra as any).stack;

  const payload = {
    success: false,
    error: cleanMessage,
    ...(errorCode ? { code: errorCode } : {}),
    requestId,
    ...safeExtra,
  };

  try {
    return NextResponse.json(payload, {
      status,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store, max-age=0',
        'X-Request-Id': requestId,
      },
    });
  } catch (serializeErr) {
    // Ultimate fallback if NextResponse.json fails serialization
    return new NextResponse(
      JSON.stringify({
        success: false,
        error: 'An internal server error occurred while formatting response.',
        code: 'INTERNAL_SERVER_ERROR',
        requestId,
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'no-store, max-age=0',
          'X-Request-Id': requestId,
        },
      }
    );
  }
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

export type ApiRouteHandler = (
  req: NextRequest,
  context?: any
) => Promise<Response | NextResponse> | Response | NextResponse;

/**
 * Higher-order wrapper for API route handlers that provides:
 * 1. Global try/catch interceptor
 * 2. Guaranteed non-empty JSON error responses (HTTP 500)
 * 3. Structured server-side error logging with sanitized payloads
 * 4. Automatic Request ID assignment (EW-XXXXXX)
 */
export function withApiRouteHandler(
  routeLabel: string,
  handler: ApiRouteHandler
): (req: NextRequest, context?: any) => Promise<Response | NextResponse> {
  return async (req: NextRequest, context?: any) => {
    const incomingId = req.headers.get('x-request-id');
    const requestId = incomingId && incomingId.startsWith('EW-') ? incomingId : generateServerRequestId();
    try {
      const res = await handler(req, context);
      if (res && res.headers && !res.headers.get('x-request-id')) {
        res.headers.set('X-Request-Id', requestId);
      }
      return res;
    } catch (err: any) {
      const message = err?.message || String(err) || 'Internal Server Error';
      const stack = err?.stack;

      let userId: string | undefined;
      try {
        const url = new URL(req.url);
        userId = url.searchParams.get('userId') || undefined;
      } catch {}

      logApiError({
        requestId,
        apiRoute: routeLabel,
        method: req.method,
        userId,
        errorMessage: message,
        stackTrace: stack,
      });

      return apiError(message, 500, 'INTERNAL_SERVER_ERROR', { requestId, apiRoute: routeLabel, method: req.method, userId });
    }
  };
}
