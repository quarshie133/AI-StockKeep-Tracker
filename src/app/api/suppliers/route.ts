import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logAudit, isUserReadOnly } from '@/lib/audit';
import { isAdmin } from '@/lib/auth';

export async function GET() {
  try {
    const suppliers = await prisma.supplier.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: { items: true },
        },
      },
    });
    return NextResponse.json(suppliers);
  } catch (error) {
    console.error('Error fetching suppliers:', error);
    return NextResponse.json({ error: 'Failed to fetch suppliers' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const admin = await isAdmin();
    if (!admin && await isUserReadOnly()) {
      return NextResponse.json({ error: 'System is in read-only mode. Contact your administrator.' }, { status: 403 });
    }
    const body = await request.json();
    const { name, contact, phone, email, address } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Supplier name is required' }, { status: 400 });
    }

    const supplier = await prisma.supplier.create({
      data: {
        name: name.trim(),
        contact: contact?.trim() || null,
        phone: phone?.trim() || null,
        email: email?.trim() || null,
        address: address?.trim() || null,
      },
    });

    logAudit('SUPPLIER_CREATED', admin ? 'admin' : 'user', supplier.id, { name: supplier.name });
    return NextResponse.json(supplier, { status: 201 });
  } catch (error) {
    console.error('Error creating supplier:', error);
    return NextResponse.json({ error: 'Failed to create supplier' }, { status: 500 });
  }
}
