import { NextResponse } from 'next/server';
import { generateText } from '@/lib/gemini';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const { name, category } = await request.json();
    if (!name?.trim()) return NextResponse.json({ error: 'Item name is required' }, { status: 400 });

    try {
      const prompt = `Write a short, professional product description (2-3 sentences, max 100 words) for a shop inventory item.
Item Name: "${name}"
Category: "${category || 'General'}"

Write only the description text. No quotes, no prefix, no extra formatting. Make it suitable for a product label or inventory record.`;

      const description = await generateText(prompt);
      if (description?.trim()) {
        return NextResponse.json({ description: description.trim() });
      }
    } catch (aiErr) {
      console.warn('AI describe fallback used:', String((aiErr as any)?.message || aiErr));
    }

    // Default description fallback
    const fallbackDesc = `High-quality ${name} (${category || 'General'}). Suitable for everyday retail and inventory distribution.`;
    return NextResponse.json({ description: fallbackDesc });
  } catch (error: any) {
    console.error('AI describe route error:', String(error?.message || error));
    return NextResponse.json({ description: 'Quality inventory item ready for retail.' });
  }
}
