import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const [items, allSales, movements] = await Promise.all([
      prisma.item.findMany({ include: { supplier: true } }),
      prisma.sale.findMany({
        orderBy: { soldAt: 'desc' },
        include: { item: { select: { id: true, name: true, sku: true, category: true } } },
      }),
      prisma.stockMovement.findMany({
        orderBy: { createdAt: 'desc' },
        take: 50,
        include: { item: { select: { name: true } } },
      }),
    ]);

    // ── KPIs ──────────────────────────────────────────────
    const totalRevenue = allSales.reduce((s, sl) => s + sl.total, 0);
    const inventoryValue = items.reduce((s, i) => s + i.price * i.quantity, 0);
    const unitsSold = allSales.reduce((s, sl) => s + sl.quantity, 0);
    const totalItems = items.length;

    // ── Revenue by Day (last 14 days) ────────────────────
    const revenueByDay: Record<string, { revenue: number; count: number }> = {};
    for (let d = 13; d >= 0; d--) {
      const dt = new Date();
      dt.setDate(dt.getDate() - d);
      const key = dt.toISOString().split('T')[0];
      revenueByDay[key] = { revenue: 0, count: 0 };
    }
    allSales.forEach((s) => {
      const key = new Date(s.soldAt).toISOString().split('T')[0];
      if (revenueByDay[key]) {
        revenueByDay[key].revenue += s.total;
        revenueByDay[key].count += 1;
      }
    });
    const revenueByDayArr = Object.entries(revenueByDay).map(([date, v]) => ({
      date,
      revenue: v.revenue,
      count: v.count,
    }));

    // ── Category Breakdown ────────────────────────────────
    const catMap: Record<string, { count: number; totalQty: number; totalValue: number; revenue: number }> = {};
    items.forEach((i) => {
      const cat = i.category || 'General';
      if (!catMap[cat]) catMap[cat] = { count: 0, totalQty: 0, totalValue: 0, revenue: 0 };
      catMap[cat].count += 1;
      catMap[cat].totalQty += i.quantity;
      catMap[cat].totalValue += i.quantity * i.price;
    });
    allSales.forEach((s) => {
      const cat = s.item?.category || 'General';
      if (catMap[cat]) catMap[cat].revenue += s.total;
    });
    const totalCatValue = Object.values(catMap).reduce((s, c) => s + c.totalValue, 0) || 1;
    const categoryBreakdown = Object.entries(catMap)
      .map(([category, d]) => ({
        category,
        count: d.count,
        totalQty: d.totalQty,
        totalValue: d.totalValue,
        revenue: d.revenue,
        pct: Math.round((d.totalValue / totalCatValue) * 100),
      }))
      .sort((a, b) => b.totalValue - a.totalValue);

    // ── Top Products ─────────────────────────────────────
    const productMap: Record<number, { name: string; sku: string; category: string; revenue: number; unitsSold: number }> = {};
    allSales.forEach((s) => {
      if (!s.item) return;
      if (!productMap[s.itemId]) {
        productMap[s.itemId] = { name: s.item.name, sku: s.item.sku, category: s.item.category, revenue: 0, unitsSold: 0 };
      }
      productMap[s.itemId].revenue += s.total;
      productMap[s.itemId].unitsSold += s.quantity;
    });
    const topProducts = Object.values(productMap)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);
    const maxProductRevenue = topProducts[0]?.revenue || 1;

    // ── Stock Health ─────────────────────────────────────
    const healthy = items.filter((i) => i.quantity >= i.threshold).length;
    const lowStock = items.filter((i) => i.quantity > 0 && i.quantity < i.threshold).length;
    const outOfStock = items.filter((i) => i.quantity === 0).length;

    // ── Recent Activity (movements + sales merged) ────────
    const movementActivity = movements.slice(0, 20).map((m) => ({
      type: m.type as 'IN' | 'OUT',
      itemName: m.item?.name || `Item #${m.itemId}`,
      quantity: m.quantity,
      note: m.note || '',
      date: m.createdAt,
    }));
    const salesActivity = allSales.slice(0, 20).map((s) => ({
      type: 'SALE' as const,
      itemName: s.item?.name || `Item #${s.itemId}`,
      quantity: s.quantity,
      note: `$${s.total.toFixed(2)}`,
      date: s.soldAt,
    }));
    const recentActivity = [...movementActivity, ...salesActivity]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 10);

    return NextResponse.json({
      kpis: { totalRevenue, inventoryValue, totalItems, unitsSold },
      revenueByDay: revenueByDayArr,
      categoryBreakdown,
      topProducts: topProducts.map((p) => ({ ...p, pct: Math.round((p.revenue / maxProductRevenue) * 100) })),
      stockHealth: { healthy, lowStock, outOfStock, total: items.length },
      recentActivity,
    });
  } catch (error) {
    console.error('Analytics error:', error);
    return NextResponse.json({ error: 'Failed to fetch analytics' }, { status: 500 });
  }
}
