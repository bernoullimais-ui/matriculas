import { GoogleGenAI } from '@google/genai';
import { SOFIA_TOOL_DECLARATIONS } from './services/sofia-tools.js';
import dotenv from 'dotenv';
dotenv.config();

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
async function run() {
  const response = await ai.models.generateContent({
    model: 'gemini-3.5-flash',
    contents: [{ role: 'user', parts: [{ text: 'Gostaria de agendar uma aula experimental de vôlei para Alice' }] }],
    config: {
      tools: [{ functionDeclarations: SOFIA_TOOL_DECLARATIONS }]
    }
  });
  const parts = response.candidates?.[0]?.content?.parts || [];
  console.log(JSON.stringify(parts, null, 2));
}
run();
