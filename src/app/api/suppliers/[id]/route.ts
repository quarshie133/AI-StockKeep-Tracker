import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logAudit, isUserReadOnly } from '@/lib/audit';
import { isAdmin } from '@/lib/auth';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await isAdmin();
    if (!admin && await isUserReadOnly()) {
      return NextResponse.json({ error: 'System is in read-only mode. Contact your administrator.' }, { status: 403 });
    }
    const { id } = await params;
    const supplierId = parseInt(id);
    if (isNaN(supplierId)) {
      return NextResponse.json({ error: 'Invalid supplier ID' }, { status: 400 });
    }

    const body = await request.json();
    const { name, contact, phone, email, address } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Supplier name is required' }, { status: 400 });
    }

    const updated = await prisma.supplier.update({
      where: { id: supplierId },
      data: {
        name: name.trim(),
        contact: contact?.trim() || null,
        phone: phone?.trim() || null,
        email: email?.trim() || null,
        address: address?.trim() || null,
      },
    });

    logAudit('SUPPLIER_UPDATED', admin ? 'admin' : 'user', supplierId, { name: updated.name });
    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error updating supplier:', error);
    return NextResponse.json({ error: 'Failed to update supplier' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await isAdmin();
    if (!admin && await isUserReadOnly()) {
      return NextResponse.json({ error: 'System is in read-only mode. Contact your administrator.' }, { status: 403 });
    }
    const { id } = await params;
    const supplierId = parseInt(id);
    if (isNaN(supplierId)) {
      return NextResponse.json({ error: 'Invalid supplier ID' }, { status: 400 });
    }

    await prisma.supplier.delete({
      where: { id: supplierId },
    });

    logAudit('SUPPLIER_DELETED', admin ? 'admin' : 'user', supplierId);
    return NextResponse.json({ message: 'Supplier deleted successfully' });
  } catch (error) {
    console.error('Error deleting supplier:', error);
    return NextResponse.json({ error: 'Failed to delete supplier' }, { status: 500 });
  }
}
