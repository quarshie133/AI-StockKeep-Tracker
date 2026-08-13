import { GoogleGenerativeAI } from '@google/generative-ai';

const apiKey = process.env.GEMINI_API_KEY;

function getClient() {
  if (!apiKey) throw new Error('GEMINI_API_KEY is not configured.');
  return new GoogleGenerativeAI(apiKey);
}

// 'gemini-flash-latest' is a Google-maintained alias that always points at
// a currently supported Flash model, chosen deliberately to avoid pinning
// to a specific dated model name that Google can (and did — see
// Technical_Debt_Plan.pdf, TD-13) retire out from under the application.
export function getGeminiModel(modelName = 'gemini-flash-latest') {
  return getClient().getGenerativeModel({ model: modelName });
}

export async function generateText(prompt: string): Promise<string> {
  const model = getGeminiModel();
  const result = await model.generateContent(prompt);
  return result.response.text();
}
