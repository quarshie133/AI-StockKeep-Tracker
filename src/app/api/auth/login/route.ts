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

  let passcode: unknown;
  try {
    ({ passcode } = await request.json());
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
  if (typeof passcode !== 'string') {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  // The Settings row's passcode is the source of truth when the database
  // is reachable and writable. If it isn't (e.g. a read-only/ephemeral
  // filesystem on some serverless deployments — see Technical_Debt_Plan.pdf
  // TD-08), login falls back to comparing against the env-configured
  // APP_PASSCODE so the app never becomes completely inaccessible.
  let authenticated = false;
  try {
    let settings = await prisma.settings.findFirst();
    if (!settings) {
      try {
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
      } catch (createError) {
        console.error('Could not bootstrap Settings row (database may be read-only):', createError);
      }
    }
    authenticated = settings ? verifyPasscode(passcode, settings.passcode) : passcode === DEFAULT_PASSCODE;
  } catch (dbError) {
    console.error('Settings lookup failed, falling back to APP_PASSCODE comparison:', dbError);
    authenticated = passcode === DEFAULT_PASSCODE;
  }

  if (authenticated) {
    clearLoginAttempts(clientKey);
    await setAuthCookie();
    return NextResponse.json({ success: true, message: 'Authenticated successfully' });
  }

  recordFailedLogin(clientKey);
  return NextResponse.json({ error: 'Incorrect passcode, try again' }, { status: 401 });
}
