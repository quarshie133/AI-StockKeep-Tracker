import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

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
          passcode: '1234',
        },
      });
    }
    return NextResponse.json(settings);
  } catch (error) {
    console.error('Error fetching settings:', error);
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { storeName, notifyEmail, emailAddress, resendApiKey, passcode } = body;

    let settings = await prisma.settings.findFirst();
    if (!settings) {
      settings = await prisma.settings.create({
        data: {
          id: 1,
          storeName: storeName || 'StockKeep Store',
          notifyEmail: Boolean(notifyEmail),
          emailAddress: emailAddress || '',
          resendApiKey: resendApiKey || '',
          passcode: passcode || '1234',
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
          passcode: passcode !== undefined ? passcode : settings.passcode,
        },
      });
    }

    return NextResponse.json(settings);
  } catch (error) {
    console.error('Error updating settings:', error);
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
  }
}
