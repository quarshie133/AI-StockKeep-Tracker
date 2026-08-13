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
Always use specific numbers and item names from the data.
Format responses with simple bullet points when listing items. Keep responses under 200 words.

=== LIVE INVENTORY SNAPSHOT ===
Total Items: ${items.length} | Total Value: $${totalValue.toFixed(2)}
Low Stock: ${lowStock.length} items | Out of Stock: ${outOfStock.length} items
Total Sales Revenue: $${totalRevenue.toFixed(2)} (${sales.length} transactions)
Suppliers: ${suppliers.map((s) => s.name).join(', ') || 'None'}

ITEMS LIST:
${items.map((i) => `- ${i.name} [${i.sku}] | Category: ${i.category} | Qty: ${i.quantity} | Threshold: ${i.threshold} | Price: $${i.price.toFixed(2)} | Status: ${i.quantity === 0 ? 'OUT OF STOCK' : i.quantity < i.threshold ? 'LOW STOCK' : 'HEALTHY'}`).join('\n')}
================================`;

    // Rule-based fallback response if Gemini call fails
    const q = message.toLowerCase();
    let fallbackReply = `I'm StockKeep AI. Currently you have ${items.length} total items in stock with a total value of $${totalValue.toFixed(2)}.`;
    if (q.includes('low') || q.includes('out of stock') || q.includes('shortage')) {
      fallbackReply = `⚠️ Stock Alert Summary:\n` +
        `- Out of Stock (${outOfStock.length}): ${outOfStock.map(i => i.name).join(', ') || 'None'}\n` +
        `- Low Stock (${lowStock.length}): ${lowStock.map(i => `${i.name} (${i.quantity} left)`).join(', ') || 'None'}`;
    } else if (q.includes('revenue') || q.includes('sale') || q.includes('money')) {
      fallbackReply = `💰 Revenue Summary:\nTotal recorded sales revenue is $${totalRevenue.toFixed(2)} across ${sales.length} transactions.`;
    } else if (q.includes('supplier') || q.includes('vendor')) {
      fallbackReply = `🚚 Supplier Directory:\nYou currently have ${suppliers.length} suppliers: ${suppliers.map(s => s.name).join(', ') || 'None'}.`;
    }

    try {
      const conversationContext = (history || [])
        .slice(-6)
        .map((m: { role: string; content: string }) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
        .join('\n');

      const fullPrompt = `${systemPrompt}\n\nCONVERSATION HISTORY:\n${conversationContext}\n\nUser: ${message}\nAssistant:`;

      const model = getGeminiModel();
      const result = await model.generateContent(fullPrompt);
      const reply = result.response.text().trim();

      if (reply) {
        return NextResponse.json({ reply });
      }
    } catch (aiErr) {
      console.warn('Gemini AI chat fallback used:', String((aiErr as any)?.message || aiErr));
    }

    return NextResponse.json({ reply: fallbackReply });
  } catch (error: any) {
    console.error('AI chat route error:', String(error?.message || error));
    return NextResponse.json({ reply: 'I am your StockKeep AI assistant. Ask me about low stock, revenue, or suppliers!' });
  }
}
