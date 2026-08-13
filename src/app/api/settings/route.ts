import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hashPasscode } from '@/lib/passcode';
import { DEFAULT_PASSCODE } from '@/lib/auth';

// Strips secret fields from a Settings row before it is ever sent to the
// client, replacing them with booleans the UI can use to render
// "already configured" state without exposing the underlying value.
// See Technical_Debt_Plan.pdf, TD-06.
function toPublicSettings(settings: {
  id: number;
  storeName: string;
  notifyEmail: boolean;
  emailAddress: string | null;
  resendApiKey: string | null;
  passcode: string;
  updatedAt: Date;
}) {
  const { resendApiKey, passcode, ...rest } = settings;
  return {
    ...rest,
    resendApiKeyConfigured: Boolean(resendApiKey && resendApiKey.length > 0),
    passcodeConfigured: true,
  };
}

// Returned when the database is unreachable/unwritable (see
// Technical_Debt_Plan.pdf, TD-08) so the Settings screen still renders
// something sensible instead of a hard error.
const FALLBACK_SETTINGS = {
  id: 1,
  storeName: 'StockKeep Store',
  notifyEmail: false,
  emailAddress: '',
  updatedAt: new Date(0),
  resendApiKeyConfigured: false,
  passcodeConfigured: true,
};

export async function GET() {
  try {
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
    return NextResponse.json(toPublicSettings(settings));
  } catch (error) {
    console.error('Error fetching settings (falling back to defaults — database may be unwritable, see TD-08):', error);
    return NextResponse.json(FALLBACK_SETTINGS);
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { storeName, notifyEmail, emailAddress, resendApiKey, passcode } = body;

    if (passcode !== undefined && (typeof passcode !== 'string' || passcode.trim().length < 4)) {
      return NextResponse.json({ error: 'Passcode must be at least 4 characters' }, { status: 400 });
    }

    const hashedPasscode = passcode !== undefined && passcode.trim() !== '' ? hashPasscode(passcode.trim()) : undefined;

    let settings = await prisma.settings.findFirst();
    if (!settings) {
      settings = await prisma.settings.create({
        data: {
          id: 1,
          storeName: storeName || 'StockKeep Store',
          notifyEmail: Boolean(notifyEmail),
          emailAddress: emailAddress || '',
          resendApiKey: resendApiKey || '',
          passcode: hashedPasscode || hashPasscode(DEFAULT_PASSCODE),
        },
      });
    } else {
      settings = await prisma.settings.update({
        where: { id: settings.id },
        data: {
          storeName: storeName !== undefined ? storeName : settings.storeName,
          notifyEmail: notifyEmail !== undefined ? Boolean(notifyEmail) : settings.notifyEmail,
          emailAddress: emailAddress !== undefined ? emailAddress : settings.emailAddress,
          resendApiKey: resendApiKey !== undefined ? resendApiKey : settings.resendApiKey,
          passcode: hashedPasscode !== undefined ? hashedPasscode : settings.passcode,
        },
      });
    }

    return NextResponse.json(toPublicSettings(settings));
  } catch (error) {
    console.error('Error updating settings:', error);
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
  }
}
