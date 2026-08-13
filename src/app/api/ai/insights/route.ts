import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getGeminiModel } from '@/lib/gemini';

export const dynamic = 'force-dynamic';

// Simple in-memory cache (5 min TTL)
let insightsCache: { data: any; ts: number } | null = null;
const CACHE_TTL = 5 * 60 * 1000;

export async function GET() {
  try {
    if (insightsCache && Date.now() - insightsCache.ts < CACHE_TTL) {
      return NextResponse.json(insightsCache.data);
    }

    const [items, sales] = await Promise.all([
      prisma.item.findMany({
        include: { movements: { orderBy: { createdAt: 'desc' }, take: 10 } },
      }),
      prisma.sale.findMany({
        orderBy: { soldAt: 'desc' },
        take: 50,
        include: { item: true },
      }),
    ]);

    const totalValue = items.reduce((s, i) => s + i.price * i.quantity, 0);
    const lowStock = items.filter((i) => i.quantity > 0 && i.quantity < i.threshold);
    const outOfStock = items.filter((i) => i.quantity === 0);
    const totalRevenue = sales.reduce((s, sl) => s + sl.total, 0);

    const inventorySummary = items.map((i) => ({
      name: i.name,
      category: i.category,
      quantity: i.quantity,
      threshold: i.threshold,
      price: i.price,
      status: i.quantity === 0 ? 'OUT_OF_STOCK' : i.quantity < i.threshold ? 'LOW_STOCK' : 'HEALTHY',
    }));

    const salesSummary = Object.entries(
      sales.reduce((acc: Record<string, number>, s) => {
        const name = s.item?.name || `Item #${s.itemId}`;
        acc[name] = (acc[name] || 0) + s.total;
        return acc;
      }, {})
    )
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, rev]) => ({ name, revenue: rev }));

    const prompt = `You are an expert inventory analyst for a shop. Analyze this data and provide concise, actionable insights.

INVENTORY DATA:
- Total items: ${items.length}
- Low stock items (${lowStock.length}): ${lowStock.map((i) => `${i.name} (${i.quantity} left, threshold: ${i.threshold})`).join(', ') || 'None'}
- Out of stock (${outOfStock.length}): ${outOfStock.map((i) => i.name).join(', ') || 'None'}
- Total inventory value: $${totalValue.toFixed(2)}
- Total revenue from recent sales: $${totalRevenue.toFixed(2)}
- Top selling items: ${salesSummary.map((s) => `${s.name} ($${s.revenue.toFixed(2)})`).join(', ') || 'No sales yet'}
- All items: ${JSON.stringify(inventorySummary.slice(0, 20))}

Respond ONLY with a JSON object in this exact format (no markdown, no code blocks):
{
  "urgentAlerts": ["alert1", "alert2"],
  "insights": ["insight1", "insight2", "insight3"],
  "topItems": ["item1 - reason", "item2 - reason"],
  "recommendation": "One key action the shop owner should take today."
}

Be specific, use real item names from the data. Keep each string under 100 chars.`;

    const model = getGeminiModel();
    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();

    // Strip markdown code fences if present
    const clean = text.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim();
    const parsed = JSON.parse(clean);

    const response = {
      urgentAlerts: parsed.urgentAlerts || [],
      insights: parsed.insights || [],
      topItems: parsed.topItems || [],
      recommendation: parsed.recommendation || '',
    };

    insightsCache = { data: response, ts: Date.now() };
    return NextResponse.json(response);
  } catch (error: any) {
    console.error('AI insights error:', error);
    return NextResponse.json({ error: 'Failed to generate insights', detail: error.message }, { status: 500 });
  }
}
