import * as fs from 'fs';

let content = fs.readFileSync('server.ts', 'utf-8');

const webhookCode = `
// Wix Webhook (Automations)
app.post('/api/webhooks/wix', async (req, res) => {
  try {
    const secret = req.query.secret;
    const configuredSecret = process.env.WIX_WEBHOOK_SECRET || 'wix_default_secret_2026';
    
    if (secret !== configuredSecret) {
      console.warn('[Webhook Wix] Tentativa de acesso não autorizada.');
      return res.status(401).json({ error: 'Não autorizado' });
    }

    const { event, status, wixId, email, contactName, planName, amount } = req.body;
    
    console.log(\`[Webhook Wix] Recebido evento: \${event}, Status: \${status}, WixId: \${wixId}\`);
    
    if (!wixId || !email) {
      return res.status(400).json({ error: 'wixId e email são obrigatórios' });
    }

    // Busca o responsável
    let responsavel = null;
    let { data: respData } = await supabase.from('responsaveis').select('id, nome_completo').ilike('email', email.trim()).maybeSingle();
    
    if (respData) responsavel = respData;
    else if (contactName) {
      const { data: respDataName } = await supabase.from('responsaveis').select('id, nome_completo').ilike('nome_completo', contactName.trim()).maybeSingle();
      if (respDataName) responsavel = respDataName;
    }

    let aluno_id = null;
    let matricula_id = null;
    let turma_id = null;

    if (responsavel) {
      const { data: students } = await supabase.from('alunos').select('id, nome_completo').eq('responsavel_id', responsavel.id);
      if (students && students.length > 0) {
        // Vincula ao primeiro aluno por padrão se não conseguir match pelo plano
        aluno_id = students[0].id;
        
        // Tenta achar a matrícula
        const studentIds = students.map(s => s.id);
        const { data: enrollments } = await supabase.from('matriculas').select('id, aluno_id, turma_id, plano, status').in('aluno_id', studentIds);
        
        if (enrollments && enrollments.length > 0) {
          // Fallback para a primeira matrícula ativa
          const active = enrollments.filter(e => e.status === 'ativo');
          const match = active.length > 0 ? active[0] : enrollments[0];
          
          aluno_id = match.aluno_id;
          matricula_id = match.id;
          turma_id = match.turma_id;
        }
      }
    }

    const parsedAmount = parseFloat(String(amount || '0').replace(',', '.'));
    
    // Mapeamento para pagamentos_wix
    const wixRowData = {
      data_pagamento_gmt_03: new Date().toISOString(),
      id_provedor_pagamento: wixId,
      data_transacao_gmt_03: new Date().toISOString(),
      moeda: 'BRL',
      valor: parsedAmount,
      status_transacao: status || 'Bem-sucedido',
      cobranca_nome: contactName,
      cobranca_email: email,
      produto_nome: planName,
      responsavel_id: responsavel?.id || null,
      aluno_id: aluno_id,
      matricula_id: matricula_id,
      turma_id: turma_id,
      provedor_pagamento: 'Wix Webhook'
    };

    // Upsert usando id_provedor_pagamento
    const { data: existing } = await supabase.from('pagamentos_wix').select('id').eq('id_provedor_pagamento', wixId).maybeSingle();
    
    if (existing) {
      await supabase.from('pagamentos_wix').update(wixRowData).eq('id', existing.id);
      console.log(\`[Webhook Wix] Pagamento \${wixId} atualizado com sucesso.\`);
    } else {
      await supabase.from('pagamentos_wix').insert([wixRowData]);
      console.log(\`[Webhook Wix] Pagamento \${wixId} criado com sucesso.\`);
    }

    // Processamento de Inadimplência
    if (status && (status.toLowerCase().includes('falh') || status.toLowerCase().includes('recusad') || status.toLowerCase().includes('fail'))) {
      if (responsavel && matricula_id) {
        console.log(\`[Webhook Wix] Falha detectada para matrícula \${matricula_id}. Acionando disparo de WhatsApp...\`);
        try {
          const edgeFunctionUrl = process.env.SUPABASE_URL + '/functions/v1/send-whatsapp';
          const apiKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
          
          // Busca telefone do responsável
          const { data: respDataFull } = await supabase.from('responsaveis').select('celular, nome_completo').eq('id', responsavel.id).single();
          if (respDataFull && respDataFull.celular) {
            const mensagem = \`Olá, *\${respDataFull.nome_completo}*! Identificamos uma falha no processamento da sua assinatura via Wix. Por favor, atualize o seu método de pagamento para garantir a continuidade das aulas.\`;
            
            await fetch(edgeFunctionUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': \`Bearer \${apiKey}\`
              },
              body: JSON.stringify({
                to: respDataFull.celular,
                message: mensagem
              })
            });
            console.log(\`[Webhook Wix] Notificação de falha enviada para \${respDataFull.celular}\`);
          }
        } catch (edgeErr) {
          console.error(\`[Webhook Wix] Erro ao disparar WhatsApp de falha:\`, edgeErr);
        }
      }
    }

    res.json({ success: true, message: 'Webhook processado com sucesso' });
  } catch (err: any) {
    console.error('[Webhook Wix] Erro ao processar:', err);
    res.status(500).json({ error: 'Erro interno', details: err.message });
  }
});

app.use('/api', (err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {`;

content = content.replace(/app\.use\('\/api', \(err: any, req: express\.Request, res: express\.Response, next: express\.NextFunction\) => \{/, webhookCode);

fs.writeFileSync('server.ts', content);
console.log('Wix Webhook added to server.ts');
