import { NextResponse } from 'next/server';
import { isAdmin } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  const admin = await isAdmin();
  try {
    const settings = await prisma.settings.findFirst({ select: { userReadOnly: true } });
    return NextResponse.json({
      role: admin ? 'admin' : 'user',
      readOnly: settings?.userReadOnly ?? false,
    });
  } catch {
    return NextResponse.json({ role: admin ? 'admin' : 'user', readOnly: false });
  }
}
