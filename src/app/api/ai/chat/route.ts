import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getGeminiModel } from '@/lib/gemini';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const { message, history } = await request.json();
    if (!message?.trim()) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    // Fetch live inventory snapshot
    const [items, sales, suppliers] = await Promise.all([
      prisma.item.findMany({
        include: {
          supplier: true,
          movements: { orderBy: { createdAt: 'desc' }, take: 5 },
        },
      }),
      prisma.sale.findMany({
        orderBy: { soldAt: 'desc' },
        take: 30,
        include: { item: { select: { name: true, sku: true } } },
      }),
      prisma.supplier.findMany(),
    ]);

    const totalValue = items.reduce((s, i) => s + i.price * i.quantity, 0);
    const totalRevenue = sales.reduce((s, sl) => s + sl.total, 0);
    const lowStock = items.filter((i) => i.quantity > 0 && i.quantity < i.threshold);
    const outOfStock = items.filter((i) => i.quantity === 0);

    const systemPrompt = `You are StockKeep AI, an intelligent inventory assistant for a shop management system.
You have full, real-time access to the store's inventory data below. Answer questions concisely and helpfully.
Always use specific numbers and item names from the data. Use emojis sparingly for key info.
Format responses with simple bullet points when listing items. Keep responses under 250 words.

=== LIVE INVENTORY SNAPSHOT ===
Total Items: ${items.length} | Total Value: $${totalValue.toFixed(2)}
Low Stock: ${lowStock.length} items | Out of Stock: ${outOfStock.length} items
Total Revenue (recent ${sales.length} sales): $${totalRevenue.toFixed(2)}
Suppliers: ${suppliers.length}

ITEMS:
${items.map((i) => `- ${i.name} [${i.sku}] | Category: ${i.category} | Qty: ${i.quantity} | Threshold: ${i.threshold} | Price: $${i.price.toFixed(2)} | Status: ${i.quantity === 0 ? '❌ OUT' : i.quantity < i.threshold ? '⚠️ LOW' : '✅ OK'} | Supplier: ${i.supplier?.name || 'None'}`).join('\n')}

RECENT SALES (last ${sales.length}):
${sales.slice(0, 15).map((s) => `- ${s.item?.name || 'Unknown'}: ${s.quantity} units @ $${s.unitPrice.toFixed(2)} = $${s.total.toFixed(2)} on ${new Date(s.soldAt).toLocaleDateString()}`).join('\n') || 'No sales recorded yet.'}
================================`;

    const model = getGeminiModel();
    const chat = model.startChat({
      history: [
        { role: 'user', parts: [{ text: systemPrompt }] },
        { role: 'model', parts: [{ text: "I'm StockKeep AI, ready to help you manage your inventory. What would you like to know?" }] },
        ...(history || []).map((m: { role: string; content: string }) => ({
          role: m.role as 'user' | 'model',
          parts: [{ text: m.content }],
        })),
      ],
    });

    const result = await chat.sendMessage(message);
    const reply = result.response.text();

    return NextResponse.json({ reply });
  } catch (error: any) {
    console.error('AI chat error:', error);
    return NextResponse.json({ error: 'AI service error', detail: error.message }, { status: 500 });
  }
}
