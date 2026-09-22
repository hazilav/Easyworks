import { NextRequest, NextResponse } from 'next/server';
import {
  getPaymentSettings,
  updatePaymentSettings,
  updateDeveloperPassword,
  verifyDeveloperSessionToken,
  getDatabase,
} from '@/lib/db/database';

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : '';

    if (!token || !verifyDeveloperSessionToken(token)) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized. Developer session required.' },
        { status: 401 }
      );
    }

    const settings = getPaymentSettings();
    const db = getDatabase();
    const admin = db.prepare("SELECT email, name, role, phone, created_at FROM users WHERE role = 'SUPER_ADMIN' LIMIT 1").get();

    return NextResponse.json({
      success: true,
      paymentSettings: settings,
      developer: admin,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch settings.' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : '';

    if (!token || !verifyDeveloperSessionToken(token)) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized. Developer session required.' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { type, paymentSettings, newPassword } = body;

    if (type === 'PAYMENT_SETTINGS') {
      const updated = updatePaymentSettings(paymentSettings);
      return NextResponse.json({
        success: true,
        message: 'Payment settings updated successfully.',
        settings: updated,
      });
    } else if (type === 'CHANGE_PASSWORD') {
      if (!newPassword || newPassword.length < 8) {
        return NextResponse.json(
          { success: false, error: 'New password must be at least 8 characters long.' },
          { status: 400 }
        );
      }
      updateDeveloperPassword(newPassword);
      return NextResponse.json({
        success: true,
        message: 'Developer password changed successfully.',
      });
    } else {
      return NextResponse.json({ success: false, error: 'Invalid setting type.' }, { status: 400 });
    }
  } catch (error: any) {
    console.error('Error updating settings:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update settings.' },
      { status: 500 }
    );
  }
}
