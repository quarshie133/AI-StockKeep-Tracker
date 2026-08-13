import { NextResponse } from 'next/server';
import { generateText } from '@/lib/gemini';

export async function POST(request: Request) {
  try {
    const { name, category } = await request.json();
    if (!name?.trim()) return NextResponse.json({ error: 'Item name is required' }, { status: 400 });

    const prompt = `Write a short, professional product description (2-3 sentences, max 120 words) for a shop inventory item.
Item Name: "${name}"
Category: "${category || 'General'}"

Write only the description text. No quotes, no prefix, no extra formatting. Make it suitable for a product label or inventory record.`;

    const description = await generateText(prompt);
    return NextResponse.json({ description: description.trim() });
  } catch (error: any) {
    console.error('AI describe error:', error);
    return NextResponse.json({ error: 'Failed to generate description', detail: error.message }, { status: 500 });
  }
}
