import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getGeminiModel } from '@/lib/gemini';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, { params }: { params: Promise<{ itemId: string }> }) {
  try {
    const { itemId } = await params;
    const id = parseInt(itemId);
    if (isNaN(id)) return NextResponse.json({ error: 'Invalid item ID' }, { status: 400 });

    const item = await prisma.item.findUnique({
      where: { id },
      include: {
        movements: { orderBy: { createdAt: 'desc' }, take: 30 },
        sales: { orderBy: { soldAt: 'desc' }, take: 20 },
        supplier: true,
      },
    });

    if (!item) return NextResponse.json({ error: 'Item not found' }, { status: 404 });

    // Calculate sales velocity
    const totalSold = item.sales.reduce((s, sl) => s + sl.quantity, 0);
    const daysSinceFirstSale = item.sales.length > 0
      ? Math.max(1, Math.ceil((Date.now() - new Date(item.sales[item.sales.length - 1].soldAt).getTime()) / 86400000))
      : null;
    const avgDailySales = daysSinceFirstSale ? totalSold / daysSinceFirstSale : 0;
    const daysUntilStockout = avgDailySales > 0 ? Math.floor(item.quantity / avgDailySales) : null;

    const prompt = `You are a professional inventory analyst. Analyze this single item and provide a demand forecast.

ITEM DATA:
Name: ${item.name}
Category: ${item.category}
SKU: ${item.sku}
Current Quantity: ${item.quantity}
Low Stock Threshold: ${item.threshold}
Unit Price: $${item.price.toFixed(2)}
Supplier: ${item.supplier?.name || 'None assigned'}
Total Units Sold (all time): ${totalSold}
Sales Count: ${item.sales.length} transactions
Average Daily Sales Rate: ${avgDailySales.toFixed(2)} units/day
Calculated Days Until Stockout: ${daysUntilStockout !== null ? daysUntilStockout : 'Unknown (no sales data)'}

Recent Stock Movements (last 30):
${item.movements.slice(0, 10).map((m) => `- ${m.type}: ${m.quantity} units on ${new Date(m.createdAt).toLocaleDateString()} (${m.note || 'no note'})`).join('\n') || 'None'}

Recent Sales (last 20):
${item.sales.slice(0, 8).map((s) => `- ${s.quantity} units @ $${s.unitPrice.toFixed(2)} on ${new Date(s.soldAt).toLocaleDateString()}`).join('\n') || 'No sales recorded'}

Respond ONLY with JSON (no markdown, no code blocks):
{
  "daysUntilStockout": number or null,
  "reorderQty": number,
  "urgency": "critical" | "soon" | "normal" | "healthy",
  "confidence": "high" | "medium" | "low",
  "summary": "2-3 sentence forecast summary",
  "action": "Specific recommended action for the shop owner"
}`;

    const model = getGeminiModel();
    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    const clean = text.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim();
    const parsed = JSON.parse(clean);

    return NextResponse.json({
      daysUntilStockout: parsed.daysUntilStockout ?? daysUntilStockout,
      reorderQty: parsed.reorderQty ?? Math.max(item.threshold * 2, 10),
      urgency: parsed.urgency ?? 'normal',
      confidence: parsed.confidence ?? 'low',
      summary: parsed.summary ?? 'Insufficient data for a reliable forecast.',
      action: parsed.action ?? 'Monitor stock levels regularly.',
    });
  } catch (error: any) {
    console.error('AI forecast error:', error);
    return NextResponse.json({ error: 'Failed to generate forecast', detail: error.message }, { status: 500 });
  }
}
