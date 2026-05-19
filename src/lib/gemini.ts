import { GoogleGenerativeAI } from '@google/generative-ai';

const apiKey = process.env.GEMINI_API_KEY || '';
const genAI = new GoogleGenerativeAI(apiKey);

export const getGeminiModel = (modelName: string = 'gemma-4-31b-it', systemInstruction?: string) => {
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
      model: 'gemini-2.5-pro',
      systemInstruction: systemInstruction
    });
  }
};
