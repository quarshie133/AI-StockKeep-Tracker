import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ItemSchema } from '@/lib/validations';
import { logAudit, isUserReadOnly } from '@/lib/audit';
import { isAdmin } from '@/lib/auth';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const itemId = parseInt(id);
    if (isNaN(itemId)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    }

    const item = await prisma.item.findUnique({
      where: { id: itemId },
      include: {
        supplier: true,
        movements: {
          orderBy: { createdAt: 'desc' },
        },
        sales: {
          orderBy: { soldAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    return NextResponse.json(item);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch item' }, { status: 500 });
  }
}

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
    const itemId = parseInt(id);
    if (isNaN(itemId)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    }

    const body = await request.json();
    const validatedData = ItemSchema.parse(body);

    const updatedItem = await prisma.item.update({
      where: { id: itemId },
      data: {
        name: validatedData.name,
        category: validatedData.category,
        quantity: validatedData.quantity,
        threshold: validatedData.threshold,
        price: validatedData.price,
        location: validatedData.location,
        description: validatedData.description,
        supplierId: body.supplierId ? parseInt(body.supplierId) : null,
        expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
      },
    });

    logAudit('ITEM_UPDATED', admin ? 'admin' : 'user', itemId, { name: updatedItem.name });
    return NextResponse.json(updatedItem);
  } catch (error: any) {
    if (error?.name === 'ZodError') {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to update item' }, { status: 500 });
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
    const itemId = parseInt(id);
    if (isNaN(itemId)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    }

    await prisma.item.delete({
      where: { id: itemId },
    });

    logAudit('ITEM_DELETED', admin ? 'admin' : 'user', itemId);
    return NextResponse.json({ success: true, message: 'Item deleted successfully' });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete item' }, { status: 500 });
  }
}
