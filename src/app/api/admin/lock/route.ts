import { NextResponse } from 'next/server';
import { isAdmin } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { logAudit } from '@/lib/audit';

export async function PUT(request: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  try {
    const { userReadOnly } = await request.json();
    if (typeof userReadOnly !== 'boolean') {
      return NextResponse.json({ error: 'userReadOnly must be a boolean' }, { status: 400 });
    }

    let settings = await prisma.settings.findFirst();
    if (!settings) {
      settings = await prisma.settings.create({
        data: { id: 1, storeName: 'StockKeep Store', notifyEmail: false },
      });
    }

    const updated = await prisma.settings.update({
      where: { id: settings.id },
      data: { userReadOnly },
    });

    logAudit('LOCK_MODE_CHANGED', 'admin', undefined, { userReadOnly });
    return NextResponse.json({ userReadOnly: updated.userReadOnly });
  } catch (error) {
    console.error('Admin lock error:', error);
    return NextResponse.json({ error: 'Failed to update lock mode' }, { status: 500 });
  }
}
