import { NextRequest, NextResponse } from 'next/server';
import {
  verifyDeveloperCredentials,
  verifyDeveloperSessionToken,
  getDatabase,
} from '@/lib/db/database';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: 'Email and password are required.' },
        { status: 400 }
      );
    }

    const result = verifyDeveloperCredentials(email, password);
    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || 'Authentication failed.' },
        { status: 401 }
      );
    }

    return NextResponse.json({
      success: true,
      user: result.user,
      token: result.token,
    });
  } catch (error: any) {
    console.error('Developer login error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error.' },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : '';

    if (!token || !verifyDeveloperSessionToken(token)) {
      return NextResponse.json(
        { authenticated: false, error: 'Unauthorized developer session.' },
        { status: 401 }
      );
    }

    const db = getDatabase();
    const admin = db.prepare("SELECT id, email, name, role, phone FROM users WHERE role = 'SUPER_ADMIN' LIMIT 1").get() as any;

    return NextResponse.json({
      authenticated: true,
      user: admin,
    });
  } catch (error: any) {
    return NextResponse.json(
      { authenticated: false, error: error.message },
      { status: 500 }
    );
  }
}
