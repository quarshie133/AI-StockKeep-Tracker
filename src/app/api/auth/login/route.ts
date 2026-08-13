import { NextResponse } from 'next/server';
import { DEFAULT_PASSCODE, setAuthCookie } from '@/lib/auth';
import { hashPasscode, verifyPasscode } from '@/lib/passcode';
import { checkLoginRateLimit, recordFailedLogin, clearLoginAttempts } from '@/lib/rateLimit';
import { prisma } from '@/lib/prisma';

function getClientKey(request: Request): string {
  // Best-effort client identifier for rate limiting. Behind a proxy/CDN,
  // x-forwarded-for carries the real client IP; falls back to a shared
  // bucket if unavailable (still throttles a single-attacker script).
  const forwarded = request.headers.get('x-forwarded-for');
  return forwarded?.split(',')[0]?.trim() || 'unknown';
}

export async function POST(request: Request) {
  const clientKey = getClientKey(request);

  const rl = checkLoginRateLimit(clientKey);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: `Too many attempts. Try again in ${rl.retryAfterSeconds}s.` },
      { status: 429 }
    );
  }

  try {
    const { passcode } = await request.json();

    // The Settings row's passcode is the source of truth. Bootstrap it
    // from APP_PASSCODE (hashed) on first run if it doesn't exist yet.
    let settings = await prisma.settings.findFirst();
    if (!settings) {
      settings = await prisma.settings.create({
        data: {
          id: 1,
          storeName: 'StockKeep Store',
          notifyEmail: false,
          emailAddress: '',
          resendApiKey: '',
          passcode: hashPasscode(DEFAULT_PASSCODE),
        },
      });
    }

    if (typeof passcode === 'string' && verifyPasscode(passcode, settings.passcode)) {
      clearLoginAttempts(clientKey);
      await setAuthCookie();
      return NextResponse.json({ success: true, message: 'Authenticated successfully' });
    }

    recordFailedLogin(clientKey);
    return NextResponse.json({ error: 'Incorrect passcode, try again' }, { status: 401 });
  } catch (error) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
}
