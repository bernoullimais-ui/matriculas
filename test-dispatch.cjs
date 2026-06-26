const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function test() {
    const campaignId = '4f77e175-99d8-4815-8d5c-5ceafa719672';
    const { data: campaign, error: cErr } = await supabase
      .from('campaigns')
      .select('*, campaign_targets(*), campaign_emails(*), campaign_landing_pages(*)')
      .eq('id', campaignId)
      .maybeSingle();

    if (cErr || !campaign) throw new Error('Campanha não encontrada');

    const emailConfig = campaign.campaign_emails?.[0];
    if (!emailConfig) throw new Error('Configuração de e-mail não encontrada');

    const targets = campaign.campaign_targets || [];

    // build audience
    const emailMap = new Map();
    for (const target of targets) {
      let query = supabase.from('alunos').select('id, nome_completo, email, responsavel_id');
      if (target.tipo_alvo === 'turma') {
        const { data: mats } = await supabase.from('matriculas').select('aluno_id').eq('turma_id', target.valor_alvo).in('status', ['Ativo', 'ativo', 'Ativa', 'ativa']);
        const alunoIds = (mats || []).map(m => m.aluno_id).filter(Boolean);
        if (alunoIds.length === 0) continue;
        query = query.in('id', alunoIds);
      }
      const { data: alunos } = await query;
      if (!alunos || alunos.length === 0) continue;
      const responsavelIds = [...new Set(alunos.map(a => a.responsavel_id).filter(Boolean))];
      const responsaveisMap = new Map();
      if (responsavelIds.length > 0) {
        const { data: respData } = await supabase.from('responsaveis').select('id, email').in('id', responsavelIds);
        if (respData) respData.forEach(r => responsaveisMap.set(r.id, r.email));
      }
      for (const a of alunos) {
        const emailDest = a.email || responsaveisMap.get(a.responsavel_id);
        if (!emailDest || !emailDest.includes('@')) continue;
        if (!emailMap.has(emailDest)) emailMap.set(emailDest, { email: emailDest, nome: a.nome_completo || 'Aluno', alunoId: a.id });
      }
    }
    const audiencia = Array.from(emailMap.values());
    console.log('Audience length:', audiencia.length);

    if (audiencia.length === 0) {
      console.log('Returning {sent:0, errors:0} because audience is empty');
      return { sent: 0, errors: 0 };
    }

    const senderEmail = emailConfig.remetente_email || 'adm@sportforkids.com.br';
    const senderName = emailConfig.remetente_nome || 'Sport For Kids';
    let sent = 0;
    let errors = 0;
    const sendLogs = [];

    const brevoApiKey = process.env.VITE_BREVO_API_KEY || process.env.BREVO_API_KEY || '';
    if(!brevoApiKey) console.log('BREVO API KEY MISSING IN SCRIPT. USING SIMULATION.');

    for (const dest of audiencia) {
      try {
        console.log('Sending to:', dest.email);
        const replaceTags = (text) => text.replace(/\{NOME_ALUNO\}/g, dest.nome).replace(/\{LINK_LP\}/g, '').replace(/\{UNIDADE\}/g, '');
        let htmlContent = '';
        let textContent = '';
        if (emailConfig.formato === 'texto') {
          textContent = replaceTags(emailConfig.conteudo || '');
        } else if (emailConfig.formato === 'html') {
          htmlContent = replaceTags(emailConfig.conteudo || '');
        }

        if (brevoApiKey) {
          const body = {
            sender: { name: senderName, email: senderEmail },
            subject: replaceTags(emailConfig.assunto),
            to: [{ email: dest.email, name: dest.nome }]
          };
          if (htmlContent) body.htmlContent = htmlContent;
          if (textContent) body.textContent = textContent;

          const brevoRes = await fetch('https://api.brevo.com/v3/smtp/email', {
            method: 'POST',
            headers: { 'accept': 'application/json', 'api-key': brevoApiKey, 'content-type': 'application/json' },
            body: JSON.stringify(body)
          });
          if (brevoRes.ok) {
            const brevoData = await brevoRes.json();
            console.log('Brevo SUCCESS:', brevoData);
            sent++;
          } else {
            console.log('Brevo ERROR:', await brevoRes.text());
            errors++;
          }
        } else {
          console.log('SIMULATION SUCCESS');
          sent++;
        }
      } catch (e) {
        console.log('CATCH ERROR:', e.message);
        errors++;
      }
    }
    console.log('Finished loop. Sent:', sent, 'Errors:', errors);
}
test();
