import { NextResponse } from 'next/server';
import { clearAuthCookie, clearAdminCookie } from '@/lib/auth';

export async function POST() {
  await clearAuthCookie();
  await clearAdminCookie();
  return NextResponse.json({ success: true, message: 'Logged out successfully' });
}

