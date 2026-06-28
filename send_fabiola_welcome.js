const { createClient } = require("@supabase/supabase-js");
const dotenv = require("dotenv");

// Load dotenv from the app directory
dotenv.config({ path: '/Users/brunomaia/Developer/matrícula-online-sport-for-kids/.env' });

const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

async function main() {
  const phone = '71993711515';
  const name = 'Fabíola Dumet';
  const message = `Olá, Fabíola Dumet Que alegria ter vocês com a gente! 🎉
A matrícula de Henrique Dumet Ribeiro em Futsal 3 no B+ foi confirmada com sucesso. Já estamos preparando tudo para que essa jornada seja incrível.🏆

Se tiver qualquer dúvida sobre as aulas, horários ou o que levar, é só responder essa mensagem. Seja muito bem-vindo(a) ao nosso time! 🏆`;
  const unidade = 'Colégio Bernoulli';

  console.log("Sending WhatsApp message via Edge Function...");
  const { data, error } = await supabase.functions.invoke('send-whatsapp', {
    body: {
      toPhone: phone,
      contactName: name,
      message,
      unidadeName: unidade
    }
  });

  if (error) {
    console.error("Error calling Edge Function:", error);
    return;
  }

  console.log("Edge Function response:", data);

  console.log("Updating matriculas table...");
  const { error: updateError } = await supabase
    .from('matriculas')
    .update({ boas_vindas_enviada: true })
    .eq('id', '72c008ff-f9a9-445b-bfe2-5f5da4b99967');

  if (updateError) {
    console.error("Error updating matriculas:", updateError);
  } else {
    console.log("Successfully updated boas_vindas_enviada to true!");
  }
}

main();
