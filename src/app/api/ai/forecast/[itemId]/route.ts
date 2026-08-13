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

    const fallbackForecast = {
      daysUntilStockout,
      reorderQty: Math.max(item.threshold * 2, 10),
      urgency: item.quantity === 0 ? 'critical' : item.quantity < item.threshold ? 'soon' : 'healthy',
      confidence: item.sales.length > 5 ? 'medium' : 'low',
      summary: item.quantity === 0
        ? `${item.name} is currently out of stock. Immediate reorder recommended.`
        : item.quantity < item.threshold
        ? `${item.name} is below threshold (${item.quantity} remaining). Reorder suggested soon.`
        : `${item.name} has a healthy stock level of ${item.quantity} units.`,
      action: item.quantity < item.threshold ? `Contact ${item.supplier?.name || 'supplier'} to reorder.` : 'Monitor weekly sales.',
    };

    try {
      const prompt = `You are a professional inventory analyst. Analyze this single item and provide a demand forecast.

ITEM DATA:
Name: ${item.name}
Category: ${item.category}
SKU: ${item.sku}
Current Quantity: ${item.quantity}
Low Stock Threshold: ${item.threshold}
Unit Price: $${item.price.toFixed(2)}
Supplier: ${item.supplier?.name || 'None assigned'}
Total Units Sold: ${totalSold}
Sales Count: ${item.sales.length} transactions
Average Daily Sales Rate: ${avgDailySales.toFixed(2)} units/day
Calculated Days Until Stockout: ${daysUntilStockout !== null ? daysUntilStockout : 'Unknown'}

Respond ONLY with JSON (no markdown):
{
  "daysUntilStockout": number or null,
  "reorderQty": number,
  "urgency": "critical" | "soon" | "normal" | "healthy",
  "confidence": "high" | "medium" | "low",
  "summary": "2-3 sentence forecast summary",
  "action": "Specific recommended action"
}`;

      const model = getGeminiModel();
      const result = await model.generateContent(prompt);
      const text = result.response.text().trim();
      const jsonMatch = text.match(/\{[\s\S]*\}/);

      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return NextResponse.json({
          daysUntilStockout: parsed.daysUntilStockout ?? fallbackForecast.daysUntilStockout,
          reorderQty: parsed.reorderQty ?? fallbackForecast.reorderQty,
          urgency: parsed.urgency ?? fallbackForecast.urgency,
          confidence: parsed.confidence ?? fallbackForecast.confidence,
          summary: parsed.summary ?? fallbackForecast.summary,
          action: parsed.action ?? fallbackForecast.action,
        });
      }
    } catch (aiErr) {
      console.warn('AI forecast fallback used:', (aiErr as any)?.message || aiErr);
    }

    return NextResponse.json(fallbackForecast);
  } catch (error: any) {
    console.error('AI forecast error:', String(error?.message || error));
    return NextResponse.json({
      daysUntilStockout: null,
      reorderQty: 10,
      urgency: 'normal',
      confidence: 'low',
      summary: 'Inventory item details retrieved.',
      action: 'Check stock levels.',
    });
  }
}
