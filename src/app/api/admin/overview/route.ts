import { NextResponse } from 'next/server';
import { isAdmin } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  try {
    const [items, allSales, suppliers, auditCount, todaySessions] = await Promise.all([
      prisma.item.findMany({ select: { quantity: true, threshold: true, price: true } }),
      prisma.sale.findMany({ select: { total: true, quantity: true } }),
      prisma.supplier.count(),
      prisma.auditLog.count(),
      prisma.loginEvent.count({
        where: {
          createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
          success: true,
        },
      }),
    ]);

    const totalRevenue = allSales.reduce((s, sl) => s + sl.total, 0);
    const totalUnitsSold = allSales.reduce((s, sl) => s + sl.quantity, 0);
    const inventoryValue = items.reduce((s, i) => s + i.price * i.quantity, 0);
    const lowStockCount = items.filter((i) => i.quantity > 0 && i.quantity < i.threshold).length;
    const outOfStockCount = items.filter((i) => i.quantity === 0).length;

    return NextResponse.json({
      totalItems: items.length,
      totalRevenue,
      totalUnitsSold,
      inventoryValue,
      lowStockCount,
      outOfStockCount,
      totalSuppliers: suppliers,
      auditLogCount: auditCount,
      activeSessionsToday: todaySessions,
    });
  } catch (error) {
    console.error('Admin overview error:', error);
    return NextResponse.json({ error: 'Failed to fetch overview' }, { status: 500 });
  }
}
