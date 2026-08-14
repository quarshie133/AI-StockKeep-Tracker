import { NextResponse } from 'next/server';
import { ensureSampleDataSeeded } from '@/lib/seed';

export const dynamic = 'force-dynamic';

// Idempotent, non-destructive: populates the database only if it is
// currently empty. There is no wipe/force mode — see src/lib/seed.ts.
export async function POST() {
  try {
    const result = await ensureSampleDataSeeded();
    return NextResponse.json({ message: 'Seed execution completed', result });
  } catch (error: unknown) {
    console.error('Error seeding DB:', error);
    const detail = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: 'Failed to seed database', detail }, { status: 500 });
  }
}

export async function GET() {
  return POST();
}
