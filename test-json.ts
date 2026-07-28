import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';
dotenv.config();

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const prompt = `Gere copys de campanha com as seguintes informações:
- Tema/Objetivo: 16h30 às 18h: Judocas de 7 anos pra cima\n📍 Local: Colégio Bernoulli (Quadra 3) — Alameda das Catabas, 156, Caminho das Árvores.`;

async function run() {
  const response = await ai.models.generateContent({
    model: 'gemini-3.5-flash',
    contents: prompt,
    config: {
      temperature: 0.7,
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          emailSubject: { type: Type.STRING },
          emailBody: { type: Type.STRING },
          whatsappText: { type: Type.STRING },
          lpDescription: { type: Type.STRING }
        }
      }
    }
  });
  
  const text = response.text || '';
  console.log("TEXT:\n", text);
  try {
    JSON.parse(text);
    console.log("VALID JSON");
  } catch(e) {
    console.error("INVALID JSON:", e.message);
  }
}
run();
