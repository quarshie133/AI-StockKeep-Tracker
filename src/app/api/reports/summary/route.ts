import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const items = await prisma.item.findMany({
      include: {
        supplier: true,
        movements: {
          take: 1,
          orderBy: { createdAt: 'desc' },
        },
        _count: {
          select: { sales: true },
        },
      },
    });

    const sales = await prisma.sale.findMany({
      orderBy: { soldAt: 'desc' },
      include: { item: true },
    });

    // Compute metrics
    const totalInventoryValue = items.reduce((acc, item) => acc + item.quantity * item.price, 0);
    const totalStockUnits = items.reduce((acc, item) => acc + item.quantity, 0);
    const totalRevenue = sales.reduce((acc, sale) => acc + sale.total, 0);
    const totalSalesUnits = sales.reduce((acc, sale) => acc + sale.quantity, 0);

    // Dead stock: items with quantity > 0 but 0 sales
    const deadStock = items
      .filter((i) => i.quantity > 0 && i._count.sales === 0)
      .map((i) => ({
        id: i.id,
        name: i.name,
        sku: i.sku,
        quantity: i.quantity,
        value: i.quantity * i.price,
        category: i.category,
      }));

    // Category breakdown
    const categoryMap: Record<string, { count: number; totalQty: number; totalValue: number }> = {};
    items.forEach((item) => {
      const cat = item.category || 'General';
      if (!categoryMap[cat]) {
        categoryMap[cat] = { count: 0, totalQty: 0, totalValue: 0 };
      }
      categoryMap[cat].count += 1;
      categoryMap[cat].totalQty += item.quantity;
      categoryMap[cat].totalValue += item.quantity * item.price;
    });

    const categoryBreakdown = Object.entries(categoryMap).map(([category, data]) => ({
      category,
      ...data,
    }));

    return NextResponse.json({
      summary: {
        totalInventoryValue,
        totalStockUnits,
        totalRevenue,
        totalSalesUnits,
        totalItemsCount: items.length,
        deadStockCount: deadStock.length,
      },
      categoryBreakdown,
      deadStock,
    });
  } catch (error) {
    console.error('Error fetching reports summary:', error);
    return NextResponse.json({ error: 'Failed to fetch reports' }, { status: 500 });
  }
}
