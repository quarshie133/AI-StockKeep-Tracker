import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkAndSendLowStockNotification } from '@/lib/notify';
import { logAudit, isUserReadOnly } from '@/lib/audit';
import { isAdmin } from '@/lib/auth';

export async function GET() {
  try {
    const sales = await prisma.sale.findMany({
      orderBy: { soldAt: 'desc' },
      take: 100,
      include: {
        item: {
          select: {
            id: true,
            name: true,
            sku: true,
            category: true,
          },
        },
      },
    });

    const totalRevenue = sales.reduce((acc, s) => acc + s.total, 0);
    const totalUnitsSold = sales.reduce((acc, s) => acc + s.quantity, 0);

    return NextResponse.json({
      sales,
      summary: {
        totalRevenue,
        totalUnitsSold,
        count: sales.length,
      },
    });
  } catch (error) {
    console.error('Error fetching sales:', error);
    return NextResponse.json({ error: 'Failed to fetch sales' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const admin = await isAdmin();
    if (!admin && await isUserReadOnly()) {
      return NextResponse.json({ error: 'System is in read-only mode. Contact your administrator.' }, { status: 403 });
    }
    const body = await request.json();
    const { itemId, quantity, unitPrice, note } = body;

    const parsedItemId = parseInt(itemId);
    const parsedQty = parseInt(quantity);
    const parsedPrice = parseFloat(unitPrice);

    if (isNaN(parsedItemId) || isNaN(parsedQty) || parsedQty <= 0) {
      return NextResponse.json({ error: 'Valid item and positive quantity required' }, { status: 400 });
    }

    const item = await prisma.item.findUnique({ where: { id: parsedItemId } });
    if (!item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    if (item.quantity < parsedQty) {
      return NextResponse.json(
        { error: `Insufficient stock! Requested ${parsedQty} units, but current stock is ${item.quantity}.` },
        { status: 400 }
      );
    }

    const priceToUse = !isNaN(parsedPrice) && parsedPrice >= 0 ? parsedPrice : item.price;
    const total = parsedQty * priceToUse;

    const [sale, updatedItem] = await prisma.$transaction([
      prisma.sale.create({
        data: {
          itemId: parsedItemId,
          quantity: parsedQty,
          unitPrice: priceToUse,
          total,
          note: note || 'Sale transaction',
        },
      }),
      prisma.item.update({
        where: { id: parsedItemId },
        data: { quantity: item.quantity - parsedQty },
      }),
      prisma.stockMovement.create({
        data: {
          itemId: parsedItemId,
          type: 'OUT',
          quantity: parsedQty,
          note: `Sale #${item.sku} (${parsedQty} units @ $${priceToUse.toFixed(2)})`,
        },
      }),
    ]);

    if (updatedItem.quantity < updatedItem.threshold) {
      checkAndSendLowStockNotification(updatedItem).catch(console.error);
    }

    logAudit('SALE_RECORDED', admin ? 'admin' : 'user', parsedItemId, { quantity: parsedQty, unitPrice: priceToUse, total });
    return NextResponse.json({
      sale,
      item: updatedItem,
      message: `Sale recorded successfully! Total: $${total.toFixed(2)}`,
    });
  } catch (error) {
    console.error('Error recording sale:', error);
    return NextResponse.json({ error: 'Failed to record sale' }, { status: 500 });
  }
}
