import { NextResponse } from 'next/server';
import { DEFAULT_PASSCODE, setAuthCookie } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const { passcode } = await request.json();
    if (passcode === DEFAULT_PASSCODE) {
      await setAuthCookie();
      return NextResponse.json({ success: true, message: 'Authenticated successfully' });
    }
    return NextResponse.json({ error: 'Incorrect passcode, try again' }, { status: 401 });
  } catch (error) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
}
