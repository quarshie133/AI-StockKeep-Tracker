import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { StockAdjustmentSchema } from '@/lib/validations';
import { checkAndSendLowStockNotification } from '@/lib/notify';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const itemId = parseInt(id);
    if (isNaN(itemId)) {
      return NextResponse.json({ error: 'Invalid item ID' }, { status: 400 });
    }

    const body = await request.json();
    const validatedData = StockAdjustmentSchema.parse(body);

    const existingItem = await prisma.item.findUnique({
      where: { id: itemId },
    });

    if (!existingItem) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    // Zero-floor rule validation
    if (validatedData.type === 'OUT' && existingItem.quantity < validatedData.quantity) {
      return NextResponse.json(
        { error: `Cannot remove ${validatedData.quantity} units. Current stock is ${existingItem.quantity}. Stock cannot drop below 0.` },
        { status: 400 }
      );
    }

    const newQuantity =
      validatedData.type === 'IN'
        ? existingItem.quantity + validatedData.quantity
        : existingItem.quantity - validatedData.quantity;

    // Database Transaction
    const [updatedItem, movement] = await prisma.$transaction([
      prisma.item.update({
        where: { id: itemId },
        data: { quantity: newQuantity },
      }),
      prisma.stockMovement.create({
        data: {
          itemId,
          type: validatedData.type,
          quantity: validatedData.quantity,
          note: validatedData.note,
        },
      }),
    ]);

    // Send email notification if low stock
    if (updatedItem.quantity < updatedItem.threshold) {
      checkAndSendLowStockNotification(updatedItem).catch(console.error);
    }

    return NextResponse.json({
      item: updatedItem,
      movement,
      message: `Stock successfully adjusted (${validatedData.type} ${validatedData.type === 'IN' ? '+' : '-'}${validatedData.quantity})`,
    });
  } catch (error: any) {
    if (error?.name === 'ZodError') {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    console.error('Error adjusting stock:', error);
    return NextResponse.json({ error: 'Failed to adjust stock' }, { status: 500 });
  }
}
