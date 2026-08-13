import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ItemSchema } from '@/lib/validations';
import { ensureSampleDataSeeded } from '@/lib/seed';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    await ensureSampleDataSeeded();
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search')?.toLowerCase() || '';
    const category = searchParams.get('category') || '';
    const lowStockOnly = searchParams.get('lowStock') === 'true';

    let items = await prisma.item.findMany({
      orderBy: { updatedAt: 'desc' },
      include: {
        supplier: true,
        movements: {
          take: 5,
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (search) {
      items = items.filter(
        (i) =>
          i.name.toLowerCase().includes(search) ||
          i.category.toLowerCase().includes(search) ||
          i.sku.toLowerCase().includes(search)
      );
    }

    if (category) {
      items = items.filter((i) => i.category.toLowerCase() === category.toLowerCase());
    }

    if (lowStockOnly) {
      items = items.filter((i) => i.quantity < i.threshold);
    }

    const allItems = await prisma.item.findMany();
    const totalItems = allItems.length;
    const lowStockCount = allItems.filter((i) => i.quantity > 0 && i.quantity < i.threshold).length;
    const outOfStockCount = allItems.filter((i) => i.quantity === 0).length;

    return NextResponse.json({
      items,
      stats: {
        total: totalItems,
        lowStock: lowStockCount,
        outOfStock: outOfStockCount,
      },
    });
  } catch (error) {
    console.error('Error fetching items:', error);
    return NextResponse.json({ error: 'Failed to fetch items' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const validatedData = ItemSchema.parse(body);

    const count = await prisma.item.count();
    const generatedSku = `SKU-${String(count + 1).padStart(3, '0')}`;

    const newItem = await prisma.item.create({
      data: {
        name: validatedData.name,
        sku: generatedSku,
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

    if (newItem.quantity > 0) {
      await prisma.stockMovement.create({
        data: {
          itemId: newItem.id,
          type: 'IN',
          quantity: newItem.quantity,
          note: 'Initial stock setup',
        },
      });
    }

    return NextResponse.json(newItem, { status: 201 });
  } catch (error: any) {
    if (error?.name === 'ZodError') {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    console.error('Error creating item:', error);
    return NextResponse.json({ error: 'Failed to create item' }, { status: 500 });
  }
}
