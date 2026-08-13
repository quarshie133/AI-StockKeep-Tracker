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

    const salesSummaryMap = sales.reduce((acc: Record<string, { name: string; revenue: number; qty: number }>, s) => {
      const name = s.item?.name || `Item #${s.itemId}`;
      if (!acc[name]) acc[name] = { name, revenue: 0, qty: 0 };
      acc[name].revenue += s.total;
      acc[name].qty += s.quantity;
      return acc;
    }, {});
    const salesSummary = Object.values(salesSummaryMap).sort((a, b) => b.revenue - a.revenue);

    // Rule-based fallback insights (always reliable)
    const fallbackResponse = {
      urgentAlerts: [
        ...outOfStock.slice(0, 2).map((i) => `🚨 Out of stock: ${i.name}`),
        ...lowStock.slice(0, 2).map((i) => `⚠️ Low stock warning: ${i.name} (${i.quantity} remaining)`),
      ],
      insights: [
        `Total inventory value is $${totalValue.toFixed(2)} across ${items.length} items.`,
        lowStock.length + outOfStock.length > 0
          ? `${lowStock.length + outOfStock.length} items currently require attention.`
          : 'All stock levels are currently healthy.',
        salesSummary.length > 0
          ? `Top performer: ${salesSummary[0].name} ($${salesSummary[0].revenue.toFixed(2)} revenue).`
          : 'No sales recorded yet.',
      ],
      topItems: salesSummary.slice(0, 3).map((s) => `${s.name} - $${s.revenue.toFixed(2)} (${s.qty} units)`),
      recommendation: outOfStock.length > 0
        ? `Restock ${outOfStock[0].name} immediately to meet customer demand.`
        : lowStock.length > 0
        ? `Reorder ${lowStock[0].name} soon; quantity is below low-stock threshold.`
        : 'Maintain current inventory levels and monitor weekly sales velocity.',
    };

    // Try AI generation if API key configured
    try {
      const inventorySummary = items.map((i) => ({
        name: i.name,
        category: i.category,
        quantity: i.quantity,
        threshold: i.threshold,
        price: i.price,
        status: i.quantity === 0 ? 'OUT_OF_STOCK' : i.quantity < i.threshold ? 'LOW_STOCK' : 'HEALTHY',
      }));

      const prompt = `You are an expert inventory analyst for a shop. Analyze this data and provide concise, actionable insights.

INVENTORY DATA:
- Total items: ${items.length}
- Low stock items (${lowStock.length}): ${lowStock.map((i) => `${i.name} (${i.quantity} left, threshold: ${i.threshold})`).join(', ') || 'None'}
- Out of stock (${outOfStock.length}): ${outOfStock.map((i) => i.name).join(', ') || 'None'}
- Total inventory value: $${totalValue.toFixed(2)}
- Total revenue from recent sales: $${totalRevenue.toFixed(2)}
- Top selling items: ${salesSummary.slice(0, 5).map((s) => `${s.name} ($${s.revenue.toFixed(2)})`).join(', ') || 'No sales yet'}
- Sample items: ${JSON.stringify(inventorySummary.slice(0, 15))}

Respond ONLY with a JSON object in this exact format (no markdown, no code blocks):
{
  "urgentAlerts": ["alert1"],
  "insights": ["insight1", "insight2", "insight3"],
  "topItems": ["item1 - reason"],
  "recommendation": "One key action the shop owner should take today."
}`;

      const model = getGeminiModel();
      const result = await model.generateContent(prompt);
      const text = result.response.text().trim();

      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        const response = {
          urgentAlerts: parsed.urgentAlerts || fallbackResponse.urgentAlerts,
          insights: parsed.insights || fallbackResponse.insights,
          topItems: parsed.topItems || fallbackResponse.topItems,
          recommendation: parsed.recommendation || fallbackResponse.recommendation,
        };
        insightsCache = { data: response, ts: Date.now() };
        return NextResponse.json(response);
      }
    } catch (aiErr) {
      console.warn('Gemini AI insights fallback used:', (aiErr as any)?.message || aiErr);
    }

    // Return smart fallback data if AI call fails or key is unconfigured
    insightsCache = { data: fallbackResponse, ts: Date.now() };
    return NextResponse.json(fallbackResponse);
  } catch (error: any) {
    console.error('AI insights route error:', String(error?.message || error));
    return NextResponse.json({
      urgentAlerts: [],
      insights: ['Inventory system active.'],
      topItems: [],
      recommendation: 'Monitor stock levels regularly.',
    });
  }
}
