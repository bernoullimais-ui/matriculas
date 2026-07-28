import { createClient } from '@supabase/supabase-js';
import { processarMensagem } from './services/sofia-agent.js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const ai = { getGenerativeModel: () => ({ generateContent: async () => ({ response: { text: () => 'Test response' } }) }) } as any;

async function run() {
  try {
    const config = {
      identidadeNome: 'Sport for Kids',
      prompt: 'Você é um assistente test',
      nomeAgente: 'Tatoca'
    } as any;
    
    console.log('Calling processarMensagem...');
    const result = await processarMensagem(
      supabase,
      ai,
      '5571991414913',
      'Test message at ' + new Date().toISOString(),
      config,
      undefined,
      undefined,
      'test-msg-' + Date.now(),
      [],
      'https://example.com/avatar.jpg'
    );
    console.log('Result:', result);
  } catch (err) {
    console.error('Error:', err);
  }
}
run();
