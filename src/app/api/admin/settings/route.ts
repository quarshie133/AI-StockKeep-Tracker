import { NextResponse } from 'next/server';
import { isAdmin, DEFAULT_ADMIN_PASSCODE } from '@/lib/auth';
import { hashPasscode, verifyPasscode } from '@/lib/passcode';
import { prisma } from '@/lib/prisma';
import { logAudit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  try {
    const settings = await prisma.settings.findFirst({
      select: { id: true, storeName: true, userReadOnly: true, adminPasscode: true },
    });

    return NextResponse.json({
      storeName: settings?.storeName ?? 'StockKeep Store',
      userReadOnly: settings?.userReadOnly ?? false,
      adminPasscodeConfigured: Boolean(settings?.adminPasscode && settings.adminPasscode.length > 0),
    });
  } catch (error) {
    console.error('Admin settings GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch admin settings' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  try {
    const { newAdminPasscode, currentAdminPasscode } = await request.json();

    if (!newAdminPasscode || typeof newAdminPasscode !== 'string' || newAdminPasscode.trim().length < 6) {
      return NextResponse.json({ error: 'Admin passcode must be at least 6 characters' }, { status: 400 });
    }

    let settings = await prisma.settings.findFirst();
    if (!settings) {
      settings = await prisma.settings.create({
        data: { id: 1, storeName: 'StockKeep Store', notifyEmail: false, adminPasscode: hashPasscode(DEFAULT_ADMIN_PASSCODE) },
      });
    } else if (!settings.adminPasscode || settings.adminPasscode.length === 0) {
      // Self-heal, same as /api/auth/admin-login — never compare against
      // the plaintext default indefinitely.
      settings = await prisma.settings.update({
        where: { id: settings.id },
        data: { adminPasscode: hashPasscode(DEFAULT_ADMIN_PASSCODE) },
      });
    }

    // Verify current passcode before allowing change
    const currentIsValid = verifyPasscode(currentAdminPasscode || '', settings.adminPasscode);

    if (!currentIsValid) {
      return NextResponse.json({ error: 'Current admin passcode is incorrect' }, { status: 401 });
    }

    await prisma.settings.update({
      where: { id: settings.id },
      data: { adminPasscode: hashPasscode(newAdminPasscode.trim()) },
    });

    logAudit('ADMIN_PASSCODE_CHANGED', 'admin');
    return NextResponse.json({ success: true, message: 'Admin passcode updated successfully' });
  } catch (error) {
    console.error('Admin settings PUT error:', error);
    return NextResponse.json({ error: 'Failed to update admin settings' }, { status: 500 });
  }
}
