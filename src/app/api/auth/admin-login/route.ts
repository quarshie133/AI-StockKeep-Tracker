import { NextResponse } from 'next/server';
import { DEFAULT_PASSCODE, DEFAULT_ADMIN_PASSCODE, setAuthCookie, setAdminCookie } from '@/lib/auth';
import { hashPasscode, verifyPasscode } from '@/lib/passcode';
import { checkLoginRateLimit, recordFailedLogin, clearLoginAttempts } from '@/lib/rateLimit';
import { logLoginEvent } from '@/lib/audit';
import { prisma } from '@/lib/prisma';

function getClientKey(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  return forwarded?.split(',')[0]?.trim() || 'unknown';
}

export async function POST(request: Request) {
  const clientKey = getClientKey(request);

  const rl = checkLoginRateLimit(`admin:${clientKey}`);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: `Too many attempts. Try again in ${rl.retryAfterSeconds}s.` },
      { status: 429 }
    );
  }

  let adminPasscode: unknown;
  try {
    ({ adminPasscode } = await request.json());
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
  if (typeof adminPasscode !== 'string') {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  let authenticated = false;
  try {
    let settings = await prisma.settings.findFirst();
    if (!settings) {
      // Bootstrap: the regular user passcode and the admin passcode are
      // two different secrets and must each be hashed into their own
      // column. (Earlier code mistakenly hashed the admin default into
      // the shared `passcode` field here, which would have corrupted
      // regular login on any deployment where this route ran first.)
      settings = await prisma.settings.create({
        data: {
          id: 1,
          storeName: 'StockKeep Store',
          notifyEmail: false,
          emailAddress: '',
          resendApiKey: '',
          passcode: hashPasscode(DEFAULT_PASSCODE),
          adminPasscode: hashPasscode(DEFAULT_ADMIN_PASSCODE),
        },
      });
    } else if (!settings.adminPasscode || settings.adminPasscode.length === 0) {
      // Self-heal: an existing row with no admin passcode set yet.
      // Hash and persist the default immediately rather than comparing
      // the submitted value against a plaintext constant on every
      // request indefinitely — this closes the fallback path down to a
      // single one-time bootstrap instead of a standing exposure.
      const hashed = hashPasscode(DEFAULT_ADMIN_PASSCODE);
      settings = await prisma.settings.update({
        where: { id: settings.id },
        data: { adminPasscode: hashed },
      });
    }

    authenticated = verifyPasscode(adminPasscode, settings.adminPasscode);
  } catch (dbError) {
    console.error('Settings lookup failed:', dbError);
    authenticated = false;
  }

  const ip = getClientKey(request);
  if (authenticated) {
    clearLoginAttempts(`admin:${clientKey}`);
    // Admins get both cookies: regular auth + admin escalation
    await setAuthCookie();
    await setAdminCookie();
    logLoginEvent('admin', true, ip);
    return NextResponse.json({ success: true, role: 'admin', message: 'Admin authenticated successfully' });
  }

  recordFailedLogin(`admin:${clientKey}`);
  logLoginEvent('admin', false, ip);
  return NextResponse.json({ error: 'Incorrect admin passcode, try again' }, { status: 401 });
}
