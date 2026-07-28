import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
dotenv.config();

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const systemInstruction = `Você é um copywriter de marketing profissional especializado em campanhas educacionais e esportivas para a escola de esportes infantil "Sport for Kids".
Sua tarefa é gerar conteúdos persuasivos (copy) para três canais de comunicação com base nas informações fornecidas pelo usuário:
1. E-mail (Assunto e Corpo de e-mail formatado)
2. WhatsApp (Mensagem curta, com emojis e quebras de linha)
3. Landing Page (Descrição persuasiva)

Siga estas diretrizes de tom e voz:
- Amigável, acolhedor, profissional e focado no desenvolvimento infantil (esporte, saúde, fazer amigos, diversão).
- Tom persuasivo mas sem soar artificial ou forçado.
- Use emojis moderadamente para tornar a leitura dinâmica.

Você DEVE retornar APENAS um objeto JSON válido no seguinte formato. Não adicione nenhuma formatação markdown (como blocos de código \`\`\`json), nenhum texto explicativo, introdução ou conclusão. Retorne apenas o JSON puro para que o JSON.parse funcione diretamente.

Formato JSON esperado:
{
  "emailSubject": "Assunto cativante do e-mail",
  "emailBody": "Corpo do e-mail completo com quebras de linha usando \\n e parágrafos estruturados",
  "whatsappText": "Mensagem formatada para o WhatsApp com quebras de linha \\n e emojis",
  "lpDescription": "Descrição longa e persuasiva para a Landing Page detalhando os benefícios da campanha e chamada para ação (CTA)"
}`;

const prompt = `Gere copys de campanha com as seguintes informações:
- Tema/Objetivo: 16h30 às 18h: Judocas de 7 anos pra cima\n📍 Local: Colégio Bernoulli (Quadra 3) — Alameda das Catabas, 156, Caminho das Árvores.`;

async function run() {
  for (let i = 0; i < 5; i++) {
    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: prompt,
      config: {
        systemInstruction,
        temperature: 0.7,
        responseMimeType: 'application/json'
      }
    });
    
    let text = response.text || '{}';
    text = text.replace(/```json/gi, '').replace(/```/g, '').trim();
    try {
      JSON.parse(text);
      console.log(`[${i}] VALID JSON`);
    } catch(e) {
      console.error(`[${i}] INVALID JSON:`, e.message);
      console.log("TEXT:", text);
    }
  }
}
run();
