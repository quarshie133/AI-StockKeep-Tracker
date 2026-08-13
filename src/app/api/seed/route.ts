import { NextResponse } from 'next/server';
import { ensureSampleDataSeeded } from '@/lib/seed';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const force = searchParams.get('force') === 'true';

    const result = await ensureSampleDataSeeded(force);
    return NextResponse.json({ message: 'Seed execution completed', result });
  } catch (error: any) {
    console.error('Error seeding DB:', error);
    return NextResponse.json({ error: 'Failed to seed database', detail: error.message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  return POST(request);
}
