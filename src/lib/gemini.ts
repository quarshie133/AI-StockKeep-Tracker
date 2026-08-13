import { GoogleGenerativeAI } from '@google/generative-ai';

const apiKey = process.env.GEMINI_API_KEY;

function getClient() {
  if (!apiKey) throw new Error('GEMINI_API_KEY is not configured.');
  return new GoogleGenerativeAI(apiKey);
}

export function getGeminiModel(modelName = 'gemini-1.5-flash') {
  return getClient().getGenerativeModel({ model: modelName });
}

export async function generateText(prompt: string): Promise<string> {
  const model = getGeminiModel();
  const result = await model.generateContent(prompt);
  return result.response.text();
}
