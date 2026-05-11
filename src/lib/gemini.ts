import { GoogleGenerativeAI } from '@google/generative-ai';

const apiKey = process.env.GEMINI_API_KEY || '';
const genAI = new GoogleGenerativeAI(apiKey);

export const getGeminiModel = (modelName: string = 'gemini-2.5-pro', systemInstruction?: string) => {
  try {
    return genAI.getGenerativeModel({
      model: modelName,
      systemInstruction: systemInstruction,
      tools: [
        {
          googleSearch: {},
        },
      ] as any,
    });
  } catch (err) {
    // Fallback to a more stable model if initialization fails
    return genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      systemInstruction: systemInstruction
    });
  }
};
