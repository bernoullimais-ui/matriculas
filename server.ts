import cron from "node-cron";
import express from "express";
import * as path from "path";
import { fileURLToPath } from "url";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as util from "util";
import PDFDocument from 'pdfkit';
import axios from "axios";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import * as fs from "fs";

// Handle __dirname and __filename for both ESM and CJS environments
const currentDirname = process.cwd();

dotenv.config();

// Initialize local SQLite for settings (Deprecated, moving to Supabase)
// const localDb = new Database("settings.db");
// localDb.exec("CREATE TABLE IF NOT EXISTS configuracoes (chave TEXT PRIMARY KEY, valor TEXT)");

const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || "";
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const appUrl = (process.env.APP_URL || '').replace(/\/$/, ''); // URL base da aplicação (sem barra final)

// ─── Helpers de Senha (bcrypt) ────────────────────────────────────────────────
const BCRYPT_ROUNDS = 10;

/** Gera o hash bcrypt de uma senha plaintext */
async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

/**
 * Verifica uma senha contra o hash armazenado.
 * Suporta migração transparente: aceita comparação direta (plaintext legado)
 * ou bcrypt. Retorna { valid, needsRehash } para que o chamador possa
 * atualizar a coluna para bcrypt quando necessário.
 */
async function verifyPassword(plaintext: string, stored: string): Promise<{ valid: boolean; needsRehash: boolean }> {
  if (!stored) return { valid: false, needsRehash: false };
  // Detecta se é um hash bcrypt (começa com $2b$ ou $2a$)
  if (stored.startsWith('$2b$') || stored.startsWith('$2a$')) {
    const valid = await bcrypt.compare(plaintext, stored);
    return { valid, needsRehash: false };
  }
  // Legado: comparação direta em plaintext → válido, mas precisa de rehash
  const valid = stored === plaintext;
  return { valid, needsRehash: valid };
}

/** Gera uma senha temporária aleatória (8 caracteres alfanuméricos) */
function generateTempPassword(): string {
  return crypto.randomBytes(4).toString('hex'); // ex: "a3f2b1c4"
}

let supabase: SupabaseClient<any, "public", any>;

if (!supabaseUrl || (!supabaseAnonKey && !supabaseServiceRoleKey)) {
  console.error("CRITICAL: Supabase URL or Key is missing in environment variables!");
  supabase = createClient("https://dummy.supabase.co", "dummy-key");
} else {
  // Use service role key if available for administrative/server-side operations
  const keyToUse = supabaseServiceRoleKey || supabaseAnonKey;
  console.log(`[Supabase] Initializing client with key type: ${supabaseServiceRoleKey ? 'SERVICE_ROLE' : 'ANON'}`);
  supabase = createClient(supabaseUrl, keyToUse);
}

async function getSetting(key: string, defaultValue: string = ''): Promise<string> {
  try {
    const { data, error } = await supabase
      .from('configuracoes')
      .select('valor')
      .eq('chave', key)
      .maybeSingle();
    
    if (error || !data) return defaultValue;
    return data.valor || defaultValue;
  } catch (err) {
    console.error(`Error fetching setting ${key}:`, err);
    return defaultValue;
  }
}

async function generatePDFBuffer(text: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const buffers: Buffer[] = [];
    doc.on('data', (chunk) => buffers.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);
    
    doc.fontSize(18).text('CONTRATO DE PRESTAÇÃO DE SERVIÇOS', { align: 'center' });
    doc.moveDown();
    doc.fontSize(10).text(text, { align: 'justify', lineGap: 2 });
    doc.end();
  });
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const formatDate = (dateStr: any) => {
  if (!dateStr) return null;
  let s = String(dateStr).trim().replace(/,/g, '');
  if (!s) return null;
  
  // Remove time part if present
  s = s.split(/\s+/)[0];
  
  // Try YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.substring(0, 10);
  
  // Try DD/MM/YYYY or MM/DD/YYYY or YYYY/MM/DD or DD.MM.YYYY
  const parts = s.split(/[\/\-\.]/);
  if (parts.length === 3) {
    let day, month, year;
    if (parts[0].length === 4) { // YYYY/MM/DD
      year = parts[0];
      month = parts[1];
      day = parts[2];
    } else if (parts[2].length === 4 || parts[2].length === 2) { // DD/MM/YYYY or MM/DD/YYYY
      day = parts[0];
      month = parts[1];
      year = parts[2];
      if (year && year.length === 2) {
        year = parseInt(year) > 50 ? `19${year}` : `20${year}`;
      }
      
      // Basic heuristic for DD/MM vs MM/DD
      // If first part > 12, it must be the day (DD/MM/YYYY)
      // If second part > 12, it must be the day (MM/DD/YYYY)
      if (month && day && parseInt(month) > 12 && parseInt(day) <= 12) {
        [day, month] = [month, day];
      }
    }
    
    if (day && month && year) {
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
  }
  return null;
};

const formatTimestamp = (tsStr: any) => {
  if (!tsStr) return null;
  const s = String(tsStr).trim();
  if (!s) return null;

  // If it's already in YYYY-MM-DD HH:MM:SS or ISO
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    if (s.length === 10) return `${s} 00:00:00`;
    return s.replace('T', ' ').substring(0, 19);
  }
  
  // Try DD/MM/YYYY HH:MM:SS
  const parts = s.split(/\s+/);
  const datePart = formatDate(parts[0]);
  if (datePart) {
    let timePart = parts[1] || '00:00:00';
    // Ensure timePart is HH:MM:SS
    const timeParts = timePart.split(':');
    if (timeParts.length === 2) timePart += ':00';
    return `${datePart} ${timePart}`;
  }
  
  return null;
};


const getErrorMessage = (err: any): string => {
  if (!err) return 'Unknown error';
  if (typeof err === 'string') return err;
  if (err.message) return err.message;
  if (err.error_description) return err.error_description;
  if (err.error) return typeof err.error === 'string' ? err.error : getErrorMessage(err.error);
  try {
    const str = JSON.stringify(err);
    if (str !== '{}') return str;
  } catch {}
  return String(err);
};

async function sendBrevoEmail(
  toEmail: string, 
  toName: string, 
  subject: string, 
  htmlContent: string, 
  attachments?: { content: string, name: string }[],
  unidadeName?: string
) {
  try {
    const { data, error } = await supabase.functions.invoke('send-email', {
      body: {
        toEmail,
        toName,
        subject,
        htmlContent,
        attachments,
        unidadeName
      }
    });

    if (error) {
      throw new Error(`Edge Function error: ${error.message}`);
    }

    console.log(`Email sent successfully to ${toEmail} via Edge Function`);
  } catch (error) {
    console.error("Error sending email via Edge Function:", error);
  }
}

async function sendWhatsAppMessage(toPhone: string, contactName: string, message: string, unidadeName?: string) {
  if (!toPhone) {
    console.error("Cannot send WhatsApp message: toPhone is empty");
    return;
  }
  try {
    const { data, error } = await supabase.functions.invoke('send-whatsapp', {
      body: {
        toPhone,
        contactName,
        message,
        unidadeName
      }
    });

    if (error) {
      throw new Error(`Edge Function error: ${error.message}`);
    }

    console.log(`WhatsApp message sent successfully to ${toPhone} via Edge Function`);
  } catch (error) {
    console.error("Error sending WhatsApp message via Edge Function:", error);
    throw error;
  }
}

const recentNotifications = new Map<string, number>();

async function sendPaymentFailureNotification(guardianId: string, studentName: string, className: string, reason: string, unidadeName?: string, matriculaId?: string) {
  if (matriculaId) {
    const now = Date.now();
    const lastSent = recentNotifications.get(matriculaId);
    if (lastSent && (now - lastSent) < 5 * 60 * 1000) {
      console.log(`[Notificação] Notificação de falha para a matrícula ${matriculaId} bloqueada (enviada recentemente).`);
      return;
    }
    recentNotifications.set(matriculaId, now);
  }

  try {
    const { data: guardian, error: gError } = await supabase
      .from('responsaveis')
      .select('nome_completo, email, telefone')
      .eq('id', guardianId)
      .single();

    if (gError || !guardian) {
      console.error(`[Notificação] Erro ao buscar dados do responsável ${guardianId}:`, gError);
      return;
    }

    let identidade = `na *Sport for Kids*${unidadeName ? ` (${unidadeName})` : ''}`;
    if (unidadeName) {
      const { data: mappingData } = await supabase
        .from('unidades_mapping')
        .select('identidade')
        .eq('nome', unidadeName.trim())
        .limit(1)
        .maybeSingle();
      
      if (mappingData && mappingData.identidade) {
        identidade = mappingData.identidade;
      } else {
        const { data: fallbackMapping } = await supabase
          .from('unidades_mapping')
          .select('identidade')
          .eq('nome_unidade', unidadeName.trim())
          .limit(1)
          .maybeSingle();
        if (fallbackMapping && fallbackMapping.identidade) {
          identidade = fallbackMapping.identidade;
        }
      }
    }

    const subject = "Falha no Pagamento da Matrícula - Sport for Kids";
    const message = `
Olá ${guardian.nome_completo},

Infelizmente, o pagamento da matrícula de ${studentName} na turma ${className} ${identidade} não pôde ser processado.

Motivo: ${reason}

Sua matrícula não foi confirmada. Por favor, acesse o portal para revisar os dados de pagamento ou tente realizar a matrícula novamente.

Se precisar de ajuda, entre em contato conosco.
    `;

    const htmlContent = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
        <h2 style="color: #e11d48;">Falha no Pagamento da Matrícula</h2>
        <p>Olá <strong>${guardian.nome_completo}</strong>,</p>
        <p>Infelizmente, o pagamento da matrícula de <strong>${studentName}</strong> na turma <strong>${className}</strong> ${identidade} não pôde ser processado.</p>
        <div style="background-color: #fff1f2; border-left: 4px solid #e11d48; padding: 10px; margin: 20px 0;">
          <p style="margin: 0;"><strong>Motivo:</strong> ${reason}</p>
        </div>
        <p>Sua matrícula <strong>não foi confirmada</strong>. Por favor, acesse o portal para revisar os dados de pagamento ou tente realizar a matrícula novamente.</p>
        <p>Se tiver problemas com seu cartão, você pode atualizá-lo clicando no link abaixo:</p>
        <div style="text-align: center; margin: 20px 0;">
          <a href="${appUrl}/pagamento/atualizar/${matriculaId}" style="background-color: #3b82f6; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Atualizar Cartão de Crédito</a>
        </div>
        <p>Se precisar de ajuda, entre em contato conosco.</p>
        <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
        <p style="font-size: 12px; color: #64748b; text-align: center;">Sport for Kids - Transformando vidas através do esporte</p>
      </div>
    `;

    // Enviar E-mail via Brevo
    if (guardian.email) {
      await sendBrevoEmail(guardian.email, guardian.nome_completo, subject, htmlContent, undefined, unidadeName);
    }

    // Enviar WhatsApp via UTalk
    if (guardian.telefone) {
      await sendWhatsAppMessage(guardian.telefone, guardian.nome_completo, message, unidadeName).catch(e => console.error("Erro ao enviar WhatsApp de falha:", e));
    }
    
  } catch (error) {
    console.error("[Notificação] Erro crítico ao enviar notificação:", error);
  }
}

async function sendRecurringPaymentFailureNotification(guardianId: string, studentName: string, className: string, reason: string, unidadeName?: string, matriculaId?: string) {
  try {
    const { data: guardian, error: gError } = await supabase
      .from('responsaveis')
      .select('nome_completo, email, telefone')
      .eq('id', guardianId)
      .single();

    if (gError || !guardian) {
      console.error(`[Notificação] Erro ao buscar dados do responsável ${guardianId}:`, gError);
      return;
    }

    let identidade = `na *Sport for Kids*${unidadeName ? ` (${unidadeName})` : ''}`;
    if (unidadeName) {
      const { data: mappingData } = await supabase
        .from('unidades_mapping')
        .select('identidade')
        .eq('nome', unidadeName.trim())
        .limit(1)
        .maybeSingle();
      
      if (mappingData && mappingData.identidade) {
        identidade = mappingData.identidade;
      } else {
        const { data: fallbackMapping } = await supabase
          .from('unidades_mapping')
          .select('identidade')
          .eq('nome_unidade', unidadeName.trim())
          .limit(1)
          .maybeSingle();
        if (fallbackMapping && fallbackMapping.identidade) {
          identidade = fallbackMapping.identidade;
        }
      }
    }

    const subject = "Aviso sobre o pagamento da mensalidade - Sport for Kids";
    const whatsappMessage = `Olá, *${guardian.nome_completo}*! Tudo bem?

Identificamos que não foi possível processar o pagamento da mensalidade de *${studentName}* (Turma: *${className}* ${identidade}).

⚠️ *Motivo retornado pelo banco:* ${reason}

Mas não se preocupe! Nosso sistema fará *novas tentativas automáticas* de cobrança nos próximos dias. 🔄

${matriculaId ? `💳 Caso você precise *atualizar o seu cartão de crédito* para que as próximas tentativas e as futuras mensalidades sejam cobradas no novo cartão, você pode fazer isso diretamente no link abaixo:
${appUrl}/pagamento/atualizar/${matriculaId}` : '💳 Caso você precise *atualizar o seu cartão de crédito* para que as próximas tentativas e as futuras mensalidades sejam cobradas no novo cartão, basta acessar o portal do aluno ou entrar em contato com o suporte.'}

Qualquer dúvida, seguimos à disposição! 🏆`;

    const htmlContent = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
        <h2 style="color: #e11d48;">Aviso sobre o pagamento da mensalidade</h2>
        <p>Olá, <strong>${guardian.nome_completo}</strong>,</p>
        <p>Gostaríamos de informar que o pagamento da mensalidade de <strong>${studentName}</strong> (Turma: <strong>${className}</strong> ${identidade}) não pôde ser processado com sucesso.</p>
        <div style="background-color: #fff1f2; border-left: 4px solid #e11d48; padding: 10px; margin: 20px 0;">
          <p style="margin: 0;"><strong>Motivo da recusa:</strong> ${reason}</p>
        </div>
        <h3>O que acontece agora?</h3>
        <p>Nosso sistema está programado para realizar <strong>novas tentativas automáticas</strong> de cobrança nos próximos dias. Você não precisa se preocupar.</p>
        ${matriculaId ? `
        <h3>Atualizar Cartão de Crédito</h3>
        <p>Se o cartão cadastrado foi cancelado ou expirou, você pode atualizá-lo clicando no link abaixo:</p>
        <div style="text-align: center; margin: 20px 0;">
          <a href="${appUrl}/pagamento/atualizar/${matriculaId}" style="background-color: #3b82f6; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold;">Atualizar Cartão de Crédito</a>
        </div>
        ` : `
        <h3>Precisa trocar o cartão?</h3>
        <p>Se o cartão cadastrado foi cancelado, expirou ou se você deseja alterá-lo para as próximas tentativas e futuras cobranças, por favor, acesse o nosso portal ou entre em contato com a nossa equipe de atendimento.</p>
        `}
        <p>Se precisar de ajuda, estamos à disposição!</p>
        <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
        <p style="font-size: 14px; color: #334155;">Atenciosamente,<br/><strong>Equipe Sport for Kids</strong></p>
      </div>
    `;

    // Enviar E-mail via Brevo
    if (guardian.email) {
      await sendBrevoEmail(guardian.email, guardian.nome_completo, subject, htmlContent, undefined, unidadeName);
    }

    // Enviar WhatsApp via UTalk
    if (guardian.telefone) {
      await sendWhatsAppMessage(guardian.telefone, guardian.nome_completo, whatsappMessage, unidadeName).catch(e => console.error("Erro ao enviar WhatsApp de falha recorrente:", e));
    }
    
  } catch (error) {
    console.error("[Notificação] Erro crítico ao enviar notificação de falha recorrente:", error);
  }
}

async function sendLojaNotificationByPedidoId(pedidoId: string, eventType: 'pago' | 'aguardando_pagamento' | 'falha') {
  try {
    const { data: pedido, error } = await supabase
      .from('loja_pedidos')
      .select('*, loja_pedido_itens(*)')
      .eq('id', pedidoId)
      .maybeSingle();

    if (error || !pedido) return;

    const telefone = pedido.telefone_cliente;
    const nomeCliente = pedido.nome_cliente;
    if (!telefone) return;

    let itemsStr = '';
    let studentName = '';
    if (pedido.loja_pedido_itens && pedido.loja_pedido_itens.length > 0) {
      itemsStr = pedido.loja_pedido_itens.map((item: any) => {
        let variantInfo = '';
        if (item.variante_selecionada) {
          try {
            const parsed = typeof item.variante_selecionada === 'string' ? JSON.parse(item.variante_selecionada) : item.variante_selecionada;
            
            // Extract student name
            if (parsed.estudante && typeof parsed.estudante === 'string') {
               if (!studentName) studentName = parsed.estudante;
            } else if (parsed.Estudante && typeof parsed.Estudante === 'string') {
               if (!studentName) studentName = parsed.Estudante;
            }

            const displayValues = [];
            for (const [key, val] of Object.entries(parsed)) {
               const lowerKey = key.toLowerCase();
               if (lowerKey === 'estudante' || lowerKey.includes('id')) {
                 continue;
               }
               if (typeof val === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val)) {
                 continue;
               }
               if (val) displayValues.push(val);
            }

            if (displayValues.length > 0) {
              variantInfo = ` (${displayValues.join(' ')})`;
            }
          } catch(e) {}
        }
        return `* ${item.quantidade}x ${item.nome_produto}${variantInfo}`;
      }).join('\n');
    }

    let resumoHeader = '*Resumo do Pedido:*';
    if (studentName) {
      resumoHeader = `*Resumo do Pedido para "${studentName}"*`;
    }

    let message = '';
    if (eventType === 'pago') {
      message = `Olá, *${nomeCliente}*! Tudo bem?\n\n` +
                `Recebemos a confirmação do pagamento do seu pedido (*#${pedidoId.substring(0,8)}*) na loja da *Sport for Kids*! 🎉\n\n` +
                `${resumoHeader}\n${itemsStr}\n\n` +
                `*Total:* R$ ${Number(pedido.total).toFixed(2).replace('.', ',')}\n\n` +
                `📦 Se o seu pedido for de entrega na unidade (como uniformes), ele será entregue em até *5 dias úteis* diretamente na unidade em que o estudante está matriculado.\n\n` +
                `Agradecemos a confiança! Qualquer dúvida, estamos à disposição. 🏆`;
    } else if (eventType === 'aguardando_pagamento') {
      message = `Olá, *${nomeCliente}*! Tudo bem?\n\n` +
                `Identificamos o seu interesse nos produtos da loja da *Sport for Kids* (Pedido *#${pedidoId.substring(0,8)}*) e notamos que o pagamento ainda está pendente. 🛒\n\n` +
                `${resumoHeader}\n${itemsStr}\n\n` +
                `Se você escolheu Pix, você pode realizar o pagamento acessando a área do cliente ou utilizando o código Pix gerado no checkout.\n\n` +
                `Para acessar seus pedidos, utilize o link:\n${appUrl}/portal\n\n` +
                `Qualquer dúvida ou se precisar de ajuda, é só nos chamar!`;
    } else if (eventType === 'falha') {
      message = `Olá, *${nomeCliente}*! Tudo bem?\n\n` +
                `Identificamos o seu interesse nos produtos da loja da *Sport for Kids* (Pedido *#${pedidoId.substring(0,8)}*), mas infelizmente houve uma falha e o pagamento *não foi autorizado* pelo seu banco ou operadora de cartão. ❌\n\n` +
                `${resumoHeader}\n${itemsStr}\n\n` +
                `Mas não se preocupe! Você pode refazer o seu pedido escolhendo uma nova forma de pagamento (ou um novo cartão) acessando nossa loja:\n${appUrl}/loja\n\n` +
                `Ou acesse a área do cliente para acompanhar:\n${appUrl}/portal\n\n` +
                `Qualquer dúvida, estamos à disposição!`;
    }

    if (message) {
      await sendWhatsAppMessage(telefone, nomeCliente, message).catch(e => console.error("Erro ao enviar WhatsApp da loja:", e));
    }
  } catch (error) {
    console.error("[Notificação] Erro ao enviar notificação da loja:", error);
  }
}

async function syncAllPendingPayments() {
  const secretKey = getPagarmeSecretKey();
  if (!secretKey) {
    console.warn('[Sync Cron] Pagar.me Secret Key não configurada. Pulando sincronização.');
    return { message: 'Chave não configurada', updatedCount: 0 };
  }
  
  const authHeader = Buffer.from(`${secretKey}:`).toString('base64');

  try {
    console.log('[Sync Cron] Iniciando sincronização automática de pagamentos pendentes...');
    
    // 1. Get all pending payments from Supabase
    const { data: pendingPayments, error: pError } = await supabase
      .from('pagamentos')
      .select('*')
      .eq('status', 'pendente')
      .order('created_at', { ascending: false })
      .limit(50); // Limit to avoid timeouts

    if (pError) throw pError;

    if (!pendingPayments || pendingPayments.length === 0) {
      console.log('[Sync Cron] Nenhum pagamento pendente para sincronizar.');
      return { message: 'Nenhum pagamento pendente', updatedCount: 0 };
    }

    console.log(`[Sync Cron] Encontrados ${pendingPayments.length} pagamentos pendentes.`);

    let updatedCount = 0;
    const results = [];

    for (const payment of pendingPayments) {
      const paymentId = payment.id;
      let order: any = null;

      // Try to fetch from Pagar.me
      if (payment.pagarme) {
        try {
          const endpoint = payment.pagarme.startsWith('sub_') ? 'subscriptions' : 'orders';
          const response = await axios.get(`https://api.pagar.me/core/v5/${endpoint}/${payment.pagarme}`, {
            headers: {
              'Authorization': `Basic ${authHeader}`,
              'Content-Type': 'application/json'
            }
          });
          order = response.data;
        } catch (err: any) {
          // console.warn(`[Sync Cron] Erro ao buscar pelo ID ${payment.pagarme} para o pagamento ${paymentId}:`, err.message);
        }
      }

      // If not found by ID, try by code
      if (!order) {
        try {
          const response = await axios.get(`https://api.pagar.me/core/v5/orders?code=${paymentId}`, {
            headers: {
              'Authorization': `Basic ${authHeader}`,
              'Content-Type': 'application/json'
            }
          });
          const orders = response.data.data;
          if (orders && orders.length > 0) {
            order = orders[0];
          }
        } catch (err: any) {
          // console.warn(`[Sync Cron] Erro ao buscar pelo código ${paymentId}:`, err.message);
        }
      }

      if (order) {
        if (order.status === 'paid') {
          const { error: updateError } = await supabase
            .from('pagamentos')
            .update({ 
              status: 'pago',
              data_pagamento: new Date().toISOString(),
              pagarme: order.id
            })
            .eq('id', paymentId);

          if (!updateError) {
            updatedCount++;
            results.push({ id: paymentId, status: 'pago' });

            // Activate enrollment if applicable
            if (payment.matricula_id) {
              await supabase
                .from('matriculas')
                .update({ status: 'ativo' })
                .eq('id', payment.matricula_id);
            }
          }
        } else if (order.status === 'canceled' || order.status === 'failed') {
           await supabase
            .from('pagamentos')
            .update({ 
              status: 'falha',
              motivo_falha: order.last_transaction?.gateway_message || 'Cancelado ou falhou no Pagar.me'
            })
            .eq('id', paymentId);
          results.push({ id: paymentId, status: 'falha' });
        }
      }
    }

    console.log(`[Sync Cron] Sincronização concluída. ${updatedCount} pagamentos atualizados.`);
    return { 
      message: `Sincronização concluída. ${updatedCount} atualizados.`,
      updatedCount,
      results
    };
  } catch (error) {
    console.error('[Sync Cron] Erro crítico na sincronização automática:', error);
    return { error: 'Erro na sincronização', updatedCount: 0 };
  }
}

function getPagarmeSecretKey() {
  let secretKey = (process.env.PAGARME_SECRET_KEY || "").trim();
  
  // Remove aspas se o usuário tiver colado com elas
  if ((secretKey.startsWith('"') && secretKey.endsWith('"')) || (secretKey.startsWith("'") && secretKey.endsWith("'"))) {
    secretKey = secretKey.substring(1, secretKey.length - 1);
  }
  
  return secretKey;
}

async function getFranquiaConfig(franquiaName?: string) {
  if (!franquiaName) return null;

  let identName = franquiaName;
  const { data: mapping } = await supabase
    .from('unidades_mapping')
    .select('identidade')
    .eq('nome', franquiaName)
    .maybeSingle();

  if (mapping && mapping.identidade) {
    identName = mapping.identidade;
  }

  const { data, error } = await supabase
    .from('identidades')
    .select('*')
    .eq('nome', identName)
    .single();

  if (error || !data) {
    console.warn(`Identidade ${identName} não encontrada ou erro:`, error);
    return null;
  }

  // Sanitize keys to remove any invisible/control characters that might break HTTP headers
  if (data.pagarme_api_key) {
    data.pagarme_api_key = data.pagarme_api_key.replace(/[\x00-\x1F\x7F-\x9F]/g, '').trim();
  }

  return data;
}

async function createPagarmeOrder(data: {
  customer: {
    name: string;
    email: string;
    cpf: string;
    phone: string;
    address?: string;
  };
  card?: {
    number: string;
    holderName: string;
    expMonth: string;
    expYear: string;
    cvv: string;
    cpf?: string;
  };
  amount: number; // in cents
  paymentMethod: 'pix' | 'credit_card';
  description: string;
  code: string; // Reference ID for webhook
  softDescriptor?: string;
  ip?: string;
  franquia?: string;
  installments?: number;
}) {
  let secretKey = getPagarmeSecretKey();
  let splitRules: any[] | undefined = undefined;

  const franquiaConfig = await getFranquiaConfig(data.franquia);
  if (franquiaConfig) {
    if (franquiaConfig.modelo_pagamento === 'saas') {
      secretKey = franquiaConfig.pagarme_api_key;
    } else if (franquiaConfig.modelo_pagamento === 'split') {
      secretKey = process.env.VITE_PAGARME_MASTER_KEY || process.env.PAGARME_MASTER_KEY || secretKey;
      const masterRecipientId = process.env.VITE_PAGARME_MASTER_RECIPIENT_ID || process.env.PAGARME_MASTER_RECIPIENT_ID;

      if (!masterRecipientId) {
        console.warn("PAGARME_MASTER_RECIPIENT_ID não configurado para o modelo split. O split não será aplicado corretamente.");
      } else {
        const totalAmount = Math.round(Math.max(100, data.amount));
        const percentualFee = franquiaConfig.taxa_split_percentual || 0;
        const fixedFeeCents = Math.round((franquiaConfig.taxa_split_fixa || 0) * 100);

        const commissionAmountRaw = Math.round(totalAmount * (percentualFee / 100)) + fixedFeeCents;
        const commissionAmount = Math.min(totalAmount, commissionAmountRaw);
        const clientAmount = totalAmount - commissionAmount;

        splitRules = [];
        if (clientAmount > 0) {
          splitRules.push({
            amount: clientAmount,
            recipient_id: franquiaConfig.pagarme_recipient_id,
            type: "flat",
            options: {
              charge_processing_fee: true,
              charge_remainder_fee: true,
              liable: true
            }
          });
        }
        if (commissionAmount > 0) {
          splitRules.push({
            amount: commissionAmount,
            recipient_id: masterRecipientId,
            type: "flat",
            options: {
              charge_processing_fee: false,
              charge_remainder_fee: false,
              liable: false
            }
          });
        }
        if (splitRules.length === 0) splitRules = undefined;
      }
    }
  }
  
  if (!secretKey) {
    throw new Error("PAGARME_SECRET_KEY não configurada nas variáveis de ambiente (Menu Settings).");
  }

  if (secretKey.startsWith('pk_')) {
    throw new Error("PAGARME_SECRET_KEY parece ser uma Chave Pública (pk_). Para criar pedidos, você deve usar a Chave Secreta (sk_).");
  }

  // Log de diagnóstico seguro
  console.log(`[Pagar.me] Diagnóstico da Chave:`);
  console.log(`- Prefixo: ${secretKey.substring(0, 8)}`);
  console.log(`- Sufixo: ...${secretKey.substring(secretKey.length - 4)}`);
  console.log(`- Tamanho total: ${secretKey.length} caracteres`);

  // Sanitização e Validação de Dados para Pagar.me
  const cleanCPF = data.customer.cpf.replace(/\D/g, '');
  const cleanPhone = data.customer.phone.replace(/\D/g, '');
  
  // Pagar.me exige nome e sobrenome (mínimo 2 palavras)
  let cleanName = data.customer.name.trim();
  if (!cleanName.includes(' ')) {
    cleanName = `${cleanName} ${cleanName}`; 
  }

  // Pagar.me exige DDD (2 dígitos) e Número (8 ou 9 dígitos)
  // Se o número vier com 11 dígitos (DDD + 9 + número), extraímos corretamente
  let areaCode = "11";
  let phoneNumber = "999999999";

  if (cleanPhone.length >= 10) {
    areaCode = cleanPhone.substring(0, 2);
    phoneNumber = cleanPhone.substring(2);
  } else if (cleanPhone.length >= 8) {
    phoneNumber = cleanPhone;
  }
  
  // Limites de tamanho para o número (8 ou 9 dígitos)
  if (phoneNumber.length > 9) phoneNumber = phoneNumber.substring(phoneNumber.length - 9);
  if (phoneNumber.length < 8) phoneNumber = phoneNumber.padStart(8, '9');

  // Validação de CPF (deve ter 11 dígitos e ser válido)
  // Se for inválido, o Pagar.me vai rejeitar. Vamos tentar manter o que o usuário enviou
  // ou usar um CPF de teste válido se estivermos em ambiente de teste (opcional)
  const validCPF = cleanCPF.length === 11 ? cleanCPF : cleanCPF.padStart(11, '0');

  // Validação de Email básica
  let cleanEmail = data.customer.email.trim();
  if (!cleanEmail.includes('@') || !cleanEmail.includes('.')) {
    cleanEmail = "contato@sportforkids.com.br"; 
  }

  const addressString = data.customer.address || "Rua Teste, 123, Bairro, Sao Paulo - SP";
  let billingAddress: any = {
    line_1: "Rua Teste, 123, Bairro",
    zip_code: "01234567",
    city: "Sao Paulo",
    state: "SP",
    country: "BR"
  };

  try {
    if (addressString.startsWith('{')) {
      const parsed = JSON.parse(addressString);
      billingAddress = {
        line_1: `${parsed.street || 'Rua'}, ${parsed.number || 'S/N'}, ${parsed.neighborhood || 'Bairro'}`.substring(0, 255),
        ...(parsed.complement ? { line_2: parsed.complement.substring(0, 255) } : {}),
        zip_code: (parsed.zipCode || '01234567').replace(/\D/g, '').substring(0, 8).padStart(8, '0'),
        city: (parsed.city || 'Sao Paulo').substring(0, 64),
        state: (parsed.state || 'SP').substring(0, 2).toUpperCase(),
        country: "BR"
      };
    } else {
      const addressParts = addressString.split(',').map(p => p.trim());
      let line_1 = addressParts[0] || "Rua Teste";
      if (addressParts.length > 1) line_1 += `, ${addressParts[1]}`;
      if (addressParts.length > 2) line_1 += `, ${addressParts[2]}`;
      billingAddress.line_1 = line_1.substring(0, 255);
    }
  } catch (e) {
    console.error('Error parsing address:', e);
  }

  const payload: any = {
    code: data.code,
    items: [
      {
        amount: Math.round(Math.max(100, data.amount)), 
        description: data.description.substring(0, 255),
        quantity: 1,
        code: data.code,
        ...(splitRules ? { split: splitRules } : {})
      }
    ],
    customer: {
      name: cleanName.substring(0, 64),
      email: cleanEmail,
      type: "individual",
      document: validCPF,
      phones: {
        mobile_phone: {
          country_code: "55",
          area_code: areaCode,
          number: phoneNumber
        }
      }
    },
    metadata: {
      payment_id: data.code
    },
    payments: [
      {
        payment_method: data.paymentMethod,
        [data.paymentMethod === 'pix' ? 'pix' : 'credit_card']: data.paymentMethod === 'pix' ? {
          expires_in: 86400 
        } : {
          installments: data.installments || 1,
          statement_descriptor: (data.softDescriptor || "SportForKids").substring(0, 13),
          card: {
            number: data.card?.number?.replace(/\D/g, ''),
            holder_name: data.card?.holderName?.substring(0, 64),
            holder_document: data.card?.cpf ? data.card.cpf.replace(/\D/g, '') : undefined,
            exp_month: parseInt(data.card?.expMonth, 10),
            exp_year: parseInt(data.card?.expYear?.length === 2 ? `20${data.card.expYear}` : data.card?.expYear, 10),
            cvv: data.card?.cvv,
            billing_address: billingAddress
          }
        }
      }
    ]
  };

  // Adiciona IP se disponível para ajudar no antifraude
  if (data.ip) {
    payload.ip = data.ip;
  }

  try {
    // Codificação manual para garantir o formato Basic Auth (username:password)
    const authHeader = Buffer.from(`${secretKey}:`).toString('base64');
    
    console.log(`[Pagar.me] Enviando pedido. Code: ${payload.code}, Amount: ${payload.items[0].amount}`);

    const response = await axios.post('https://api.pagar.me/core/v5/orders', payload, {
      headers: {
        'Authorization': `Basic ${authHeader}`,
        'Content-Type': 'application/json'
      }
    });

    return response.data;
  } catch (error: any) {
    const apiError = error.response?.data;
    
    if (apiError) {
      console.error("--- ERRO API PAGAR.ME ---");
      console.error("Mensagem:", apiError.message);
      if (apiError.errors) {
        console.error("Detalhes dos Erros:");
        Object.keys(apiError.errors).forEach(key => {
          console.error(`  - ${key}: ${apiError.errors[key].join(', ')}`);
        });
      }
      console.error("-------------------------");
    }
    
    if (error.response?.status === 401 || apiError?.message?.includes('Authorization has been denied')) {
      throw new Error(`Chave Pagar.me Inválida (401). Verifique se a chave '${secretKey.substring(0, 8)}...' está correta no menu Settings.`);
    }
    
    if (apiError) {
      const details = apiError.errors ? JSON.stringify(apiError.errors) : '';
      throw new Error(`Erro Pagar.me: ${apiError.message} ${details}`);
    }
    
    throw error;
  }
}

async function createPagarmeSubscription(data: {
  customer: {
    name: string;
    email: string;
    cpf: string;
    phone: string;
    address?: string;
  };
  card?: {
    number: string;
    holderName: string;
    expMonth: string;
    expYear: string;
    cvv: string;
    cpf?: string;
  };
  paymentMethod?: 'pix' | 'credit_card';
  amount: number; // in cents
  description: string;
  code: string; // Reference ID for webhook
  cycles?: number;
  start_at?: string; // ISO date string
  softDescriptor?: string;
  ip?: string;
  franquia?: string;
}) {
  let secretKey = getPagarmeSecretKey();
  let splitRules: any[] | undefined = undefined;

  const franquiaConfig = await getFranquiaConfig(data.franquia);
  if (franquiaConfig) {
    if (franquiaConfig.modelo_pagamento === 'saas') {
      secretKey = franquiaConfig.pagarme_api_key;
    } else if (franquiaConfig.modelo_pagamento === 'split') {
      secretKey = process.env.VITE_PAGARME_MASTER_KEY || process.env.PAGARME_MASTER_KEY || secretKey;
      const masterRecipientId = process.env.VITE_PAGARME_MASTER_RECIPIENT_ID || process.env.PAGARME_MASTER_RECIPIENT_ID;

      if (!masterRecipientId) {
        console.warn("PAGARME_MASTER_RECIPIENT_ID não configurado para o modelo split. O split não será aplicado corretamente.");
      } else {
        const totalAmount = Math.round(Math.max(100, data.amount));
        const percentualFee = franquiaConfig.taxa_split_percentual || 0;
        const fixedFeeCents = Math.round((franquiaConfig.taxa_split_fixa || 0) * 100);

        const commissionAmount = Math.round(totalAmount * (percentualFee / 100)) + fixedFeeCents;
        const clientAmount = totalAmount - commissionAmount;

        splitRules = [
          {
            amount: clientAmount,
            recipient_id: franquiaConfig.pagarme_recipient_id,
            type: "flat",
            options: {
              charge_processing_fee: true,
              charge_remainder_fee: true,
              liable: true
            }
          },
          {
            amount: commissionAmount,
            recipient_id: masterRecipientId,
            type: "flat",
            options: {
              charge_processing_fee: false,
              charge_remainder_fee: false,
              liable: false
            }
          }
        ];
      }
    }
  }
  
  if (!secretKey) {
    throw new Error("PAGARME_SECRET_KEY não configurada nas variáveis de ambiente (Menu Settings).");
  }

  if (secretKey.startsWith('pk_')) {
    throw new Error("PAGARME_SECRET_KEY parece ser uma Chave Pública (pk_). Para criar assinaturas, você deve usar a Chave Secreta (sk_).");
  }

  // Sanitização e Validação de Dados para Pagar.me
  const cleanCPF = (data.customer.cpf || '00000000000').replace(/\D/g, '');
  const cleanPhone = (data.customer.phone || '11999999999').replace(/\D/g, '');
  
  let cleanName = (data.customer.name || 'Cliente Sem Nome').trim();
  if (!cleanName.includes(' ')) {
    cleanName = `${cleanName} ${cleanName}`; 
  }

  let areaCode = "11";
  let phoneNumber = "999999999";

  if (cleanPhone.length >= 10) {
    areaCode = cleanPhone.substring(0, 2);
    phoneNumber = cleanPhone.substring(2);
  } else if (cleanPhone.length >= 8) {
    phoneNumber = cleanPhone;
  }
  
  if (phoneNumber.length > 9) phoneNumber = phoneNumber.substring(phoneNumber.length - 9);
  if (phoneNumber.length < 8) phoneNumber = phoneNumber.padStart(8, '9');

  const validCPF = cleanCPF.length === 11 ? cleanCPF : cleanCPF.padStart(11, '0');

  let cleanEmail = data.customer.email.trim();
  if (!cleanEmail.includes('@') || !cleanEmail.includes('.')) {
    cleanEmail = "contato@sportforkids.com.br"; 
  }

  const addressString = data.customer.address || "Rua Teste, 123, Bairro, Sao Paulo - SP";
  let billingAddress: any = {
    line_1: "Rua Teste, 123, Bairro",
    zip_code: "01234567",
    city: "Sao Paulo",
    state: "SP",
    country: "BR"
  };

  try {
    if (addressString.startsWith('{')) {
      const parsed = JSON.parse(addressString);
      billingAddress = {
        line_1: `${parsed.street || 'Rua'}, ${parsed.number || 'S/N'}, ${parsed.neighborhood || 'Bairro'}`.substring(0, 255),
        ...(parsed.complement ? { line_2: parsed.complement.substring(0, 255) } : {}),
        zip_code: (parsed.zipCode || '01234567').replace(/\D/g, '').substring(0, 8).padStart(8, '0'),
        city: (parsed.city || 'Sao Paulo').substring(0, 64),
        state: (parsed.state || 'SP').substring(0, 2).toUpperCase(),
        country: "BR"
      };
    } else {
      const addressParts = addressString.split(',').map(p => p.trim());
      let line_1 = addressParts[0] || "Rua Teste";
      if (addressParts.length > 1) line_1 += `, ${addressParts[1]}`;
      if (addressParts.length > 2) line_1 += `, ${addressParts[2]}`;
      billingAddress.line_1 = line_1.substring(0, 255);
    }
  } catch (e) {
    console.error('Error parsing address:', e);
  }

  const paymentMethod = data.paymentMethod || 'credit_card';

  const payload: any = {
    code: data.code,
    payment_method: paymentMethod,
    interval: "month",
    interval_count: 1,
    billing_type: "prepaid",
    installments: 1,
    cycles: data.cycles,
    start_at: data.start_at,
    customer: {
      name: cleanName.substring(0, 64),
      email: cleanEmail,
      type: "individual",
      document: validCPF,
      phones: {
        mobile_phone: {
          country_code: "55",
          area_code: areaCode,
          number: phoneNumber
        }
      }
    },
    metadata: {
      payment_id: data.code
    },
    items: [
      {
        code: data.code,
        description: data.description.substring(0, 255),
        quantity: 1,
        pricing_scheme: {
          scheme_type: "unit",
          price: Math.round(Math.max(100, data.amount))
        },
        ...(splitRules ? { split: splitRules } : {})
      }
    ]
  };

  if (paymentMethod === 'credit_card' && data.card) {
    payload.statement_descriptor = (data.softDescriptor || "SportForKids").substring(0, 13);
    payload.card = {
      number: data.card.number.replace(/\D/g, ''),
      holder_name: data.card.holderName.substring(0, 64),
      holder_document: data.card.cpf ? data.card.cpf.replace(/\D/g, '') : undefined,
      exp_month: parseInt(data.card.expMonth, 10),
      exp_year: parseInt(data.card.expYear.length === 2 ? `20${data.card.expYear}` : data.card.expYear, 10),
      cvv: data.card.cvv,
      billing_address: billingAddress
    };
  } else if (paymentMethod === 'pix') {
    // Adiciona configuração de expiração do PIX na assinatura
    payload.pix = {
      expires_in: 86400 // 24 horas para pagar cada ciclo
    };
  }

  // Adiciona IP se disponível para ajudar no antifraude
  if (data.ip) {
    payload.ip = data.ip;
  }

  try {
    const authHeader = Buffer.from(`${secretKey}:`).toString('base64');
    
    console.log(`[Pagar.me] Enviando assinatura. Code: ${payload.code}, Amount: ${payload.items[0].pricing_scheme.price}`);

    const response = await axios.post('https://api.pagar.me/core/v5/subscriptions', payload, {
      headers: {
        'Authorization': `Basic ${authHeader}`,
        'Content-Type': 'application/json'
      }
    });

    return response.data;
  } catch (error: any) {
    const apiError = error.response?.data;
    
    if (apiError) {
      console.error("--- ERRO API PAGAR.ME (ASSINATURA) ---");
      console.error("Mensagem:", apiError.message);
      let errorDetails = "";
      if (apiError.errors) {
        console.error("Detalhes dos Erros:");
        Object.keys(apiError.errors).forEach(key => {
          const detail = `${key}: ${apiError.errors[key].join(', ')}`;
          console.error(`  - ${detail}`);
          errorDetails += ` ${detail} |`;
        });
      }
      console.error("-------------------------");
      throw new Error(`Erro Pagar.me: ${apiError.message} ${errorDetails}`);
    }
    
    if (error.response?.status === 401 || apiError?.message?.includes('Authorization has been denied')) {
      throw new Error(`Chave Pagar.me Inválida (401). Verifique se a chave '${secretKey.substring(0, 8)}...' está correta no menu Settings.`);
    }
    
    throw error;
  }
}

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ─── Admin Auth ───────────────────────────────────────────────────────────────
// Credenciais definidas via variáveis de ambiente ADMIN_USERNAME e ADMIN_PASSWORD.
// Token HMAC-SHA256 com expiração de 8h, assinado por ADMIN_JWT_SECRET.

const ADMIN_TOKEN_SECRET = process.env.ADMIN_JWT_SECRET || (() => {
  console.warn('[Auth] ADMIN_JWT_SECRET não configurado. Usando valor gerado automaticamente (não persiste entre deploys).');
  return crypto.randomBytes(32).toString('hex');
})();

function createAdminToken(username: string): string {
  const payload = JSON.stringify({ user: username, exp: Date.now() + 8 * 60 * 60 * 1000 });
  const payloadB64 = Buffer.from(payload).toString('base64url');
  const sig = crypto.createHmac('sha256', ADMIN_TOKEN_SECRET).update(payloadB64).digest('hex');
  return `${payloadB64}.${sig}`;
}



async function requireAdminAuth(req: any, res: any, next: any) {
  try {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Não autorizado. Faça login no painel admin.' });
    }
    const token = authHeader.split(' ')[1];
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
      return res.status(401).json({ error: 'Token inválido ou expirado.' });
    }
    next();
  } catch (err) {
    console.error('requireAdminAuth error:', err);
    return res.status(500).json({ error: 'Erro interno na validação de token.' });
  }
}


// API Routes
app.post('/api/admin/login', async (req, res) => {
  try {
    const email = (req.body?.email || '').trim();
    const password = (req.body?.password || '').trim();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.session) {
      return res.status(401).json({ error: 'E-mail ou senha inválidos.' });
    }

    const userUuid = data.session.user.id;
    let resolvedRole = 'master';
    let userName = 'Administrador';
    let userNivel = 'Gestor Master';

    const { data: dbUser } = await supabase
      .from('usuarios')
      .select('nome, nivel')
      .eq('auth_id', userUuid)
      .maybeSingle();

    if (dbUser) {
      userName = dbUser.nome || userName;
      userNivel = dbUser.nivel || 'Gestor';
      const nivelLower = userNivel.toLowerCase();
      const isMaster = nivelLower.includes('master');
      const isAdm = nivelLower.includes('administrativo');

      if (!isMaster && !isAdm) {
        return res.status(403).json({ error: 'Acesso negado. Apenas Gestor Master e Gestor Administrativo têm acesso.' });
      }

      if (isMaster) {
        resolvedRole = 'master';
      } else {
        resolvedRole = 'administrativo';
      }
    } else {
      const metadataRole = data.session.user?.user_metadata?.role;
      if (metadataRole && (metadataRole === 'master' || metadataRole === 'administrativo')) {
        resolvedRole = metadataRole;
        userNivel = metadataRole === 'master' ? 'Gestor Master' : 'Gestor Administrativo';
      } else {
        return res.status(403).json({ error: 'Acesso negado. Perfil de acesso não autorizado.' });
      }
    }

    return res.json({ 
      token: data.session.access_token, 
      refreshToken: data.session.refresh_token,
      role: resolvedRole,
      userName,
      userNivel
    });
  } catch (err) {
    return res.status(500).json({ error: 'Erro interno no login.' });
  }
});

app.post('/api/admin/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(400).json({ error: 'No refresh token provided' });
    const { data, error } = await supabase.auth.refreshSession({ refresh_token: refreshToken });
    if (error || !data.session) {
      return res.status(401).json({ error: 'Sessão expirada.' });
    }
    return res.json({
      token: data.session.access_token,
      refreshToken: data.session.refresh_token
    });
  } catch(e) {
    return res.status(500).json({ error: 'Erro ao renovar token' });
  }
});

app.post('/api/admin/verify', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ valid: false });
    }
    const token = authHeader.split(' ')[1];
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
      return res.status(401).json({ valid: false });
    }

    const userUuid = user.id;
    let resolvedRole = 'master';
    let userName = 'Administrador';
    let userNivel = 'Gestor Master';

    const { data: dbUser } = await supabase
      .from('usuarios')
      .select('nome, nivel')
      .eq('auth_id', userUuid)
      .maybeSingle();

    if (dbUser) {
      userName = dbUser.nome || userName;
      userNivel = dbUser.nivel || 'Gestor';
      const nivelLower = userNivel.toLowerCase();
      const isMaster = nivelLower.includes('master');
      const isAdm = nivelLower.includes('administrativo');

      if (!isMaster && !isAdm) {
        return res.status(403).json({ valid: false, error: 'Acesso negado.' });
      }

      if (isMaster) {
        resolvedRole = 'master';
      } else {
        resolvedRole = 'administrativo';
      }
    } else {
      const metadataRole = user.user_metadata?.role;
      if (metadataRole && (metadataRole === 'master' || metadataRole === 'administrativo')) {
        resolvedRole = metadataRole;
        userNivel = metadataRole === 'master' ? 'Gestor Master' : 'Gestor Administrativo';
      } else {
        return res.status(403).json({ valid: false });
      }
    }

    return res.json({ 
      valid: true, 
      role: resolvedRole,
      userName,
      userNivel
    });
  } catch (err) {
    return res.status(500).json({ valid: false });
  }
});

app.use('/api/admin', requireAdminAuth);




  app.get("/api/settings/bulk", async (req, res) => {
    const { keys } = req.query;
    if (!keys || typeof keys !== 'string') {
      return res.status(400).json({ error: "Keys must be a comma-separated string" });
    }
    const keyList = keys.split(',');
    try {
      const { data, error } = await supabase
        .from('configuracoes')
        .select('chave, valor')
        .in('chave', keyList);
      
      if (error) throw error;
      const result: Record<string, string> = {};
      data?.forEach(item => {
        result[item.chave] = item.valor || "";
      });
      // Fill in missing keys with empty strings
      keyList.forEach(k => {
        if (!(k in result)) result[k] = "";
      });
      res.json(result);
    } catch (error: any) {
      console.warn("Error fetching bulk settings from Supabase:", error.message);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/settings/:key", async (req, res) => {
    const { key } = req.params;
    try {
      const { data, error } = await supabase
        .from('configuracoes')
        .select('valor')
        .eq('chave', key)
        .maybeSingle();
      
      if (error) throw error;
      res.json({ valor: data?.valor || "" });
    } catch (error: any) {
      console.warn("Error fetching setting from Supabase:", error.message);
      res.json({ valor: "" });
    }
  });

  app.post("/api/settings", async (req, res) => {
    const { key, value } = req.body;
    try {
      const { error } = await supabase
        .from('configuracoes')
        .upsert({ chave: key, valor: value }, { onConflict: 'chave' });
      
      if (error) throw error;
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error saving setting to Supabase:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // --- Website Configs Endpoints ---
  app.get("/api/website-configs", async (req, res) => {
    try {
      const { data, error } = await supabase
        .from('website_configs')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      const { data: speedSet } = await supabase.from('configuracoes').select('valor').eq('chave', 'testimonials_speed').maybeSingle();
      res.json({ ...(data || { banner_title: '', banner_subtitle: '', banner_url: '', video_url: '', differentials: [], testimonials: [] }), testimonials_speed: speedSet?.valor ? parseInt(speedSet.valor) : null });
    } catch (error: any) {
      console.error("Error fetching website configs:", error.message);
      res.status(500).json({ error: error.message });
    }
  });
  app.get("/api/admin/notifications", async (req, res) => {
    try {
      const adminId = 'admin';
      
      const { data: readData, error: readError } = await supabase.from('admin_notifications_read').select('last_read_at').eq('admin_id', adminId).maybeSingle();
      const lastReadAt = readData ? new Date(readData.last_read_at) : new Date((global as any).adminLastReadAt || 0);

      const { data: matriculas } = await supabase.from('matriculas')
        .select('id, created_at, nome_aluno')
        .order('created_at', { ascending: false })
        .limit(20);

      const { data: pagamentosWix } = await supabase.from('pagamentos_wix')
        .select('id, created_at, status_transacao, valor, cobranca_email, aluno_id')
        .in('status_transacao', ['DECLINED', 'FAILED', 'CHARGEBACK', 'falhou', 'recusado'])
        .order('created_at', { ascending: false })
        .limit(20);

      const { data: pagamentosPagSeguro } = await supabase.from('pagamentos_pagseguro')
        .select('id, created_at, status, valor, email, aluno_id')
        .in('status', ['DECLINED', 'FAILED', 'CHARGEBACK', 'falhou', 'recusado', 'CANCELED'])
        .order('created_at', { ascending: false })
        .limit(20);

      let notifications: any[] = [];
      if (matriculas) {
        matriculas.forEach(m => notifications.push({
          id: `mat_${m.id}`,
          type: 'matricula',
          title: 'Nova Matrícula',
          message: `O aluno ${m.nome_aluno || 'N/A'} realizou uma nova matrícula.`,
          created_at: m.created_at,
          is_read: new Date(m.created_at) <= lastReadAt
        }));
      }
      
      const pushFailedPayments = (arr: any[], provider: string) => {
        if (!arr) return;
        arr.forEach(p => notifications.push({
          id: `pay_${p.id}`,
          type: 'falha_pagamento',
          title: 'Falha de Pagamento',
          message: `Pagamento recusado (${provider}): R$ ${Number(p.valor || 0).toFixed(2)}. Email/Aluno: ${p.cobranca_email || p.email || p.aluno_id || 'N/A'}`,
          created_at: p.created_at,
          is_read: new Date(p.created_at) <= lastReadAt
        }));
      };

      pushFailedPayments(pagamentosWix || [], 'Wix');
      pushFailedPayments(pagamentosPagSeguro || [], 'PagSeguro');

      notifications.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      
      notifications = notifications.slice(0, 30);

      res.json({ notifications, lastReadAt });
    } catch (error: any) {
      console.error('Erro ao buscar notificações:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/admin/notifications/read", async (req, res) => {
    try {
      const adminId = 'admin';
      const now = new Date().toISOString();
      const { error } = await supabase.from('admin_notifications_read').upsert({ admin_id: adminId, last_read_at: now });
      
      if (error && error.code === '42P01') {
        // Fallback to memory if table doesn't exist yet
        (global as any).adminLastReadAt = now;
      }
      
      res.json({ success: true, last_read_at: now });
    } catch (error: any) {
      console.error('Erro ao ler notificações:', error);
      res.status(500).json({ error: error.message });
    }
  });


  app.get("/api/admin/website-configs", async (req, res) => {
    try {
      const { data, error } = await supabase
        .from('website_configs')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      const { data: speedSet } = await supabase.from('configuracoes').select('valor').eq('chave', 'testimonials_speed').maybeSingle();
      res.json({ ...(data || { banner_title: '', banner_subtitle: '', banner_url: '', video_url: '', differentials: [], testimonials: [] }), testimonials_speed: speedSet?.valor ? parseInt(speedSet.valor) : null });
    } catch (error: any) {
      console.error("Error fetching website configs:", error.message);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/admin/website-configs", async (req, res) => {
    const { testimonials_speed, ...payload } = req.body;
    try {
      if (testimonials_speed !== undefined) {
        await supabase.from('configuracoes').upsert({ chave: 'testimonials_speed', valor: String(testimonials_speed) });
      }
      const { data: existing } = await supabase.from('website_configs').select('id').limit(1).maybeSingle();
      if (existing) {
        const { error } = await supabase.from('website_configs').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('website_configs').insert([payload]);
        if (error) throw error;
      }
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error saving website configs:", error.message);
      res.status(500).json({ error: error.message });
    }
  });

  // --- Leads Endpoints ---
  app.get("/api/admin/leads", async (req, res) => {
    try {
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      res.json(data);
    } catch (error: any) {
      console.error("Error fetching leads from Supabase:", error.message);
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/admin/leads/:id", async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    try {
      const { error } = await supabase.from('leads').update({ status }).eq('id', id);
      if (error) throw error;
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error updating lead status:", error.message);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/leads", async (req, res) => {
    const { nome, email, whatsapp } = req.body;
    try {
      if (!nome || !email || !whatsapp) {
        return res.status(400).json({ error: "Nome, email e whatsapp são obrigatórios" });
      }
      const { data, error } = await supabase
        .from('leads')
        .insert([{ nome, email, whatsapp }]);
      
      if (error) throw error;
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error saving lead to Supabase:", error.message);
      res.status(500).json({ error: error.message });
    }
  });
  // -----------------------

  // ─── Analytics Endpoints ─────────────────────────────────────────────────────

  // PUBLIC: record a page view (no auth required)
  app.post('/api/analytics/pageview', async (req, res) => {
    try {
      const { session_id, pagina, titulo, dispositivo, navegador, referrer, utm_source, tempo_segundos } = req.body;
      if (!session_id || !pagina) return res.status(400).json({ error: 'session_id e pagina são obrigatórios' });
      const { error } = await supabase.from('page_analytics').insert([{
        session_id, pagina, titulo, dispositivo: dispositivo || 'desktop',
        navegador, referrer, utm_source, tempo_segundos: tempo_segundos || 0
      }]);
      if (error) throw error;
      res.json({ ok: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ADMIN: summary KPIs
  app.get('/api/admin/analytics/resumo', async (req, res) => {
    try {
      const dias = parseInt(String(req.query.periodo || '30'));
      const desde = new Date(Date.now() - dias * 86400000).toISOString();
      const { data, error } = await supabase.from('page_analytics').select('session_id, pagina').gte('created_at', desde);
      if (error) throw error;
      const rows = data || [];
      const visitantes = new Set(rows.map((r: any) => r.session_id)).size;
      const pageviews = rows.length;
      const { count: leads } = await supabase.from('leads').select('*', { count: 'exact', head: true }).gte('created_at', desde);
      const { count: pedidos } = await supabase.from('loja_pedidos').select('*', { count: 'exact', head: true }).gte('created_at', desde);
      const { count: inscricoes } = await supabase.from('evento_inscricoes').select('*', { count: 'exact', head: true }).gte('created_at', desde);
      const visitantesLoja = new Set(rows.filter((r: any) => r.pagina.startsWith('/loja')).map((r: any) => r.session_id)).size;
      const visitantesEventos = new Set(rows.filter((r: any) => r.pagina.startsWith('/eventos')).map((r: any) => r.session_id)).size;
      res.json({
        visitantes, pageviews,
        taxa_lead: visitantes > 0 ? Math.min(100, ((leads || 0) / visitantes * 100)).toFixed(1) : '0',
        taxa_compra: visitantesLoja > 0 
          ? Math.min(100, ((pedidos || 0) / visitantesLoja * 100)).toFixed(1) 
          : (visitantes > 0 ? Math.min(100, ((pedidos || 0) / visitantes * 100)).toFixed(1) : '0'),
        taxa_inscricao: visitantesEventos > 0 
          ? Math.min(100, ((inscricoes || 0) / visitantesEventos * 100)).toFixed(1) 
          : (visitantes > 0 ? Math.min(100, ((inscricoes || 0) / visitantes * 100)).toFixed(1) : '0'),
      });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ADMIN: top pages
  app.get('/api/admin/analytics/por-pagina', async (req, res) => {
    try {
      const dias = parseInt(String(req.query.periodo || '30'));
      const desde = new Date(Date.now() - dias * 86400000).toISOString();
      const { data, error } = await supabase.from('page_analytics').select('pagina, titulo, tempo_segundos').gte('created_at', desde);
      if (error) throw error;
      const map: Record<string, { titulo: string; views: number; total_tempo: number }> = {};
      (data || []).forEach((r: any) => {
        if (!map[r.pagina]) map[r.pagina] = { titulo: r.titulo || r.pagina, views: 0, total_tempo: 0 };
        map[r.pagina].views++;
        map[r.pagina].total_tempo += r.tempo_segundos || 0;
      });
      const result = Object.entries(map).map(([pagina, v]) => ({
        pagina, titulo: v.titulo, views: v.views,
        tempo_medio: v.views > 0 ? Math.round(v.total_tempo / v.views) : 0
      })).sort((a, b) => b.views - a.views).slice(0, 10);
      res.json(result);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ADMIN: devices
  app.get('/api/admin/analytics/dispositivos', async (req, res) => {
    try {
      const dias = parseInt(String(req.query.periodo || '30'));
      const desde = new Date(Date.now() - dias * 86400000).toISOString();
      const { data, error } = await supabase.from('page_analytics').select('dispositivo').gte('created_at', desde);
      if (error) throw error;
      const map: Record<string, number> = { mobile: 0, desktop: 0, tablet: 0 };
      (data || []).forEach((r: any) => { map[r.dispositivo] = (map[r.dispositivo] || 0) + 1; });
      const total = (data || []).length || 1;
      res.json(Object.entries(map).map(([dispositivo, count]) => ({
        dispositivo, count, pct: (count / total * 100).toFixed(1)
      })));
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ADMIN: por hora
  app.get('/api/admin/analytics/por-hora', async (req, res) => {
    try {
      const dias = parseInt(String(req.query.periodo || '30'));
      const desde = new Date(Date.now() - dias * 86400000).toISOString();
      const { data, error } = await supabase.from('page_analytics').select('created_at').gte('created_at', desde);
      if (error) throw error;
      const counts = Array(24).fill(0);
      (data || []).forEach((r: any) => { counts[new Date(r.created_at).getHours()]++; });
      res.json(counts.map((count, hora) => ({ hora, count })));
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ADMIN: por dia (evolução)
  app.get('/api/admin/analytics/por-dia', async (req, res) => {
    try {
      const dias = parseInt(String(req.query.periodo || '30'));
      const desde = new Date(Date.now() - dias * 86400000).toISOString();
      const { data, error } = await supabase.from('page_analytics').select('created_at, session_id').gte('created_at', desde);
      if (error) throw error;
      const map: Record<string, { views: number; sessions: Set<string> }> = {};
      (data || []).forEach((r: any) => {
        const dia = r.created_at.split('T')[0];
        if (!map[dia]) map[dia] = { views: 0, sessions: new Set() };
        map[dia].views++;
        map[dia].sessions.add(r.session_id);
      });
      const result = [];
      for (let i = dias - 1; i >= 0; i--) {
        const d = new Date(Date.now() - i * 86400000).toISOString().split('T')[0];
        result.push({ dia: d, views: map[d]?.views || 0, visitantes: map[d]?.sessions.size || 0 });
      }
      res.json(result);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ADMIN: origens
  app.get('/api/admin/analytics/origens', async (req, res) => {
    try {
      const dias = parseInt(String(req.query.periodo || '30'));
      const desde = new Date(Date.now() - dias * 86400000).toISOString();
      const { data, error } = await supabase.from('page_analytics').select('referrer, utm_source').gte('created_at', desde);
      if (error) throw error;
      const map: Record<string, number> = {};
      (data || []).forEach((r: any) => {
        let origem = 'Direto';
        if (r.utm_source) { origem = r.utm_source; }
        else if (r.referrer) {
          try { origem = new URL(r.referrer).hostname.replace('www.', ''); } catch { origem = r.referrer.substring(0, 30); }
        }
        map[origem] = (map[origem] || 0) + 1;
      });
      const total = (data || []).length || 1;
      res.json(Object.entries(map).map(([origem, count]) => ({
        origem, count, pct: (count / total * 100).toFixed(1)
      })).sort((a, b) => b.count - a.count).slice(0, 8));
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });
  // ─────────────────────────────────────────────────────────────────────────────
  // RH & REPASSES B2B
  // ─────────────────────────────────────────────────────────────────────────────

  // GET: Fetch all staff and their financial configs
  app.get('/api/admin/rh/contratos', async (req, res) => {
    try {
      // Get all usuarios
      const { data: usuarios, error: errUsu } = await supabase.from('usuarios').select('id, nome, nivel');
      if (errUsu) throw errUsu;

      // Get configs
      const { data: configs, error: errCfg } = await supabase.from('config_financeira_colaboradores').select('*');
      if (errCfg) throw errCfg;

      const merged = (usuarios || []).map(u => {
        const cfg = (configs || []).find(c => c.usuario_id === u.id) || null;
        return { ...u, config: cfg };
      });

      res.json(merged);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // PUT: Upsert staff financial config
  app.put('/api/admin/rh/contratos/:userId', async (req, res) => {
    try {
      const { userId } = req.params;
      const payload = req.body;
      
      const { data: existing } = await supabase.from('config_financeira_colaboradores').select('id').eq('usuario_id', userId).maybeSingle();
      
      if (existing) {
        const { error } = await supabase.from('config_financeira_colaboradores').update({
          ...payload,
          updated_at: new Date().toISOString()
        }).eq('usuario_id', userId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('config_financeira_colaboradores').insert([{
          ...payload,
          usuario_id: userId
        }]);
        if (error) throw error;
      }

      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // POST: Calculate payroll
  app.post('/api/admin/payroll/calculate', async (req, res) => {
    try {
      const { mes_referencia } = req.body;
      if (!mes_referencia) return res.status(400).json({ error: "mes_referencia is required (YYYY-MM-DD)" });

      // 1. Get all users with active financial configs
      const { data: configs, error: errCfg } = await supabase.from('config_financeira_colaboradores').select('*, usuarios(id, nome, nivel)');
      if (errCfg) throw errCfg;

      const folhas = [];

      for (const config of configs || []) {
        const usuario = config.usuarios;
        if (!usuario) continue;

        let valor_bruto = 0;
        let valor_descontos = 0;
        let detalhes = [];

        // 2. Horista Calculation
        if (config.tipo_contrato === 'CLT_HORISTA' || config.tipo_contrato === 'CLT_INTERMITENTE') {
          // FIXME: Buscar presenças reais do módulo de chamadas.
          // Por enquanto, usando um valor mockado de aulas para demonstração
          const aulasDadasMock = 20; 
          const valorAulas = aulasDadasMock * (config.valor_hora_aula || 0);
          
          // Cálculo DSR: (Horas / Dias Uteis) * Domingos/Feriados
          // Mockando: 22 dias uteis, 4 domingos/feriados
          const dsr = (valorAulas / 22) * 4;

          valor_bruto += valorAulas + dsr;
          
          detalhes.push(`Aulas dadas (Mock 20) x R$ ${config.valor_hora_aula} = R$ ${valorAulas.toFixed(2)}`);
          detalhes.push(`DSR (Base 22/4) = R$ ${dsr.toFixed(2)}`);
        }
        
        // 3. PJ Repasse Calculation
        else if (config.tipo_contrato === 'PJ_REPASSE') {
          // FIXME: Deveria buscar pagamentos filtrados por turmas vinculadas ao PJ.
          // Por agora, pegaremos pagamentos do mes para demonstrar o repasse.
          const { data: pagamentos } = await supabase.from('pagamentos')
            .select('valor')
            .in('status', ['pago', 'conciliado'])
            .gte('created_at', mes_referencia)
            .lt('created_at', new Date(new Date(mes_referencia).setMonth(new Date(mes_referencia).getMonth() + 1)).toISOString());
            
          const totalReceita = (pagamentos || []).reduce((acc: number, p: any) => acc + Number(p.valor), 0);
          // Usando um teto para demonstração pra não ficar absurdo
          const receitaConsiderada = Math.min(totalReceita, 5000); 
          const repasse = receitaConsiderada * ((config.percentual_repasse_padrao || 0) / 100);

          valor_bruto += repasse;
          detalhes.push(`Receita base: R$ ${receitaConsiderada.toFixed(2)} | Repasse: ${config.percentual_repasse_padrao}% = R$ ${repasse.toFixed(2)}`);
        }

        // 4. Salário Fixo
        else if (config.tipo_contrato === 'FIXO') {
          valor_bruto += (config.salario_base || 0);
          detalhes.push(`Salário Base = R$ ${(config.salario_base || 0).toFixed(2)}`);
        }

        // 5. VT Rule
        if (config.aplica_vt && config.salario_base) {
          const teto6Percent = config.salario_base * 0.06;
          const custoReal = config.custo_mensal_vt || 0;
          
          if (teto6Percent < custoReal) {
            // Desconta os 6%
            valor_descontos += teto6Percent;
            detalhes.push(`Desconto VT (6% de R$ ${config.salario_base}) = R$ ${teto6Percent.toFixed(2)}`);
            detalhes.push(`Benefício VT Creditado (Custo Real R$ ${custoReal} - Teto) = R$ ${(custoReal - teto6Percent).toFixed(2)}`);
            // O valor do benefício entra como provento
            valor_bruto += (custoReal - teto6Percent);
          } else {
            detalhes.push(`VT não descontado (6% > Custo Real)`);
          }
        }

        const valor_liquido = valor_bruto - valor_descontos;

        folhas.push({
          usuario,
          config,
          mes_referencia,
          valor_bruto,
          valor_descontos,
          valor_liquido,
          status: 'EM_ANALISE',
          json_detalhamento: detalhes
        });
      }

      res.json({ success: true, folhas });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });
  // ─────────────────────────────────────────────────────────────────────────────
  // B2B Repasses Endpoints

  app.get('/api/admin/b2b/config', async (req, res) => {
    try {
      const { data: unidades, error: uErr } = await supabase.from('unidades').select('*').order('nome');
      if (uErr) throw uErr;

      const { data: configs, error: cErr } = await supabase.from('config_financeira_unidades').select('*');
      if (cErr) throw cErr;

      const map = new Map();
      (configs || []).forEach(c => map.set(c.unidade_id, c));

      const responseData = (unidades || []).map(u => ({
        unidade: u,
        config: map.get(u.id) || null
      }));

      res.json(responseData);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.put('/api/admin/b2b/config/:unidadeId', async (req, res) => {
    try {
      const { unidadeId } = req.params;
      const { tipo_repasse, percentual_repasse } = req.body;
      
      if (!unidadeId || !tipo_repasse || percentual_repasse === undefined) {
        return res.status(400).json({ error: "Missing fields" });
      }

      // Check if config exists
      const { data: existing } = await supabase.from('config_financeira_unidades').select('id').eq('unidade_id', unidadeId).single();

      let result;
      if (existing) {
        result = await supabase.from('config_financeira_unidades')
          .update({ tipo_repasse, percentual_repasse, updated_at: new Date().toISOString() })
          .eq('unidade_id', unidadeId);
      } else {
        result = await supabase.from('config_financeira_unidades')
          .insert([{ unidade_id: unidadeId, tipo_repasse, percentual_repasse }]);
      }

      if (result.error) throw result.error;
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/admin/b2b/calculate', async (req, res) => {
    try {
      const { mes_referencia } = req.body;
      if (!mes_referencia) return res.status(400).json({ error: "mes_referencia is required" });

      const start = new Date(mes_referencia);
      const end = new Date(start);
      end.setMonth(end.getMonth() + 1);

      // Get configs
      const { data: configs } = await supabase.from('config_financeira_unidades').select('*, unidades(*)');
      
      // Get all pagamentos in this month
      const { data: pagamentos } = await supabase.from('pagamentos')
        .select('valor, matricula_id, aluno_id, status')
        .in('status', ['pago', 'conciliado', 'aprovado'])
        .gte('created_at', start.toISOString())
        .lt('created_at', end.toISOString());

      // Get all matriculas to map pagamentos to unidades
      const { data: matriculas } = await supabase.from('matriculas').select('id, unidade_id');
      const matMap = new Map();
      (matriculas || []).forEach(m => matMap.set(m.id, m.unidade_id));

      const resultados = [];

      for (const config of configs || []) {
        const uId = config.unidade_id;
        if (!uId) continue;

        // Filter payments for this unit
        const paysForUnit = (pagamentos || []).filter((p: any) => matMap.get(p.matricula_id) === uId);
        const valorArrecadado = paysForUnit.reduce((acc, p) => acc + Number(p.valor || 0), 0);
        
        const perc = Number(config.percentual_repasse || 0) / 100;
        const valorRepasse = valorArrecadado * perc;

        const detalhes = [
          `Total de Alunos Pagantes (Matrículas vinculadas): ${paysForUnit.length}`,
          `Valor Total Arrecadado na Unidade: R$ ${valorArrecadado.toFixed(2)}`,
          `Tipo de Repasse: ${config.tipo_repasse}`,
          `Percentual Aplicado: ${config.percentual_repasse}%`,
          `Valor do Acerto Calculado: R$ ${valorRepasse.toFixed(2)}`
        ];

        resultados.push({
          unidade: config.unidades,
          config,
          mes_referencia,
          valor_arrecadado: valorArrecadado,
          valor_repasse: valorRepasse,
          status: 'EM_ANALISE',
          json_detalhamento: detalhes
        });
      }

      res.json({ success: true, resultados });
    } catch(e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/admin/b2b/close', async (req, res) => {
    try {
      const { resultados } = req.body;
      if (!resultados || !resultados.length) return res.status(400).json({ error: "Nenhum resultado para fechar" });

      const inserts = resultados.map((r: any) => ({
        unidade_id: r.unidade.id,
        mes_referencia: r.mes_referencia,
        valor_arrecadado: r.valor_arrecadado,
        valor_repasse: r.valor_repasse,
        status: 'FECHADO',
        json_detalhamento: r.json_detalhamento
      }));

      // Upsert
      for (const row of inserts) {
        const { data: existing } = await supabase.from('fechamentos_b2b_mensal')
          .select('id').eq('unidade_id', row.unidade_id).eq('mes_referencia', row.mes_referencia).single();
        
        if (existing) {
          await supabase.from('fechamentos_b2b_mensal').update(row).eq('id', existing.id);
        } else {
          await supabase.from('fechamentos_b2b_mensal').insert([row]);
        }
      }

      res.json({ success: true });
    } catch(e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/admin/b2b/history', async (req, res) => {
    try {
      const { data, error } = await supabase.from('fechamentos_b2b_mensal')
        .select('*, unidades(*)')
        .order('mes_referencia', { ascending: false });
      if (error) throw error;
      res.json(data);
    } catch(e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ─────────────────────────────────────────────────────────────────────────────

  // Helper to sanitize CPF
  const sanitizeCPF = (cpf: string) => {
    if (!cpf) return '';
    return String(cpf).replace(/\D/g, '').trim();
  };

  app.post("/api/admin/impersonate", async (req, res) => {
    try {
      const { id } = req.body;
      if (!id) {
        return res.status(400).json({ error: "ID do responsável é obrigatório" });
      }

      // Check admin role
      const authHeader = req.headers['authorization'];
      const token = authHeader ? authHeader.split(' ')[1] : null;
      let isReadOnly = true;
      if (token) {
        const { data: { user } } = await supabase.auth.getUser(token);
        if (user) {
          const { data: dbUser } = await supabase.from('usuarios').select('nivel').eq('auth_id', user.id).maybeSingle();
          const userNivel = dbUser?.nivel || user.user_metadata?.role || '';
          if (userNivel.toLowerCase().includes('master')) {
            isReadOnly = false;
          }
        }
      }

      // Fetch guardian
      const { data: guardian, error: gError } = await supabase
        .from('responsaveis')
        .select('*')
        .eq('id', id)
        .single();

      if (gError || !guardian) {
        return res.status(404).json({ error: "Responsável não encontrado" });
      }

      // Fetch students
      const { data: students, error: sError } = await supabase
        .from('alunos')
        .select('*, matriculas(*)')
        .eq('responsavel_id', guardian.id);

      const data = { ...guardian, alunos: students || [] };

      // Flatten like access
      const { data: turmasComp } = await supabase.from('turmas').select('nome, dias_horarios');
      const turmaScheduleMap = new Map();
      (turmasComp || []).forEach(t => {
        if (t.nome && t.dias_horarios) {
          turmaScheduleMap.set(t.nome.trim().toLowerCase(), t.dias_horarios);
        }
      });

      const flatAlunos: any[] = [];
      data.alunos?.forEach((aluno: any) => {
        if (aluno.matriculas && aluno.matriculas.length > 0) {
          aluno.matriculas.forEach((mat: any) => {
            const lookupName = (mat.turma || "").trim().toLowerCase();
            flatAlunos.push({
              ...aluno,
              id: mat.id,
              aluno_id: aluno.id,
              turma: mat.turma,
              unidade: mat.unidade,
              status: mat.status,
              data_cancelamento: mat.data_cancelamento,
              data_matricula: mat.data_matricula,
              pagarme_subscription_id: mat.pagarme_subscription_id,
              horario: turmaScheduleMap.get(lookupName) || null,
              matriculas: undefined
            });
          });
        } else {
          flatAlunos.push({
            ...aluno,
            aluno_id: aluno.id,
            turma: null,
            unidade: null
          });
        }
      });

      const hasActiveEnrollments = flatAlunos.some(a => (a.status || '').toLowerCase() === 'ativo');

      res.json({
        ...data,
        alunos: flatAlunos,
        hasActiveEnrollments,
        isReadOnly
      });
    } catch (error: any) {
      console.error("Error impersonating guardian:", error);
      res.status(500).json({ error: error.message || "Erro interno no servidor" });
    }
  });

  app.post("/api/guardian/access", async (req, res) => {
    const { identifier, password } = req.body;
    try {
      if (!identifier) {
        return res.status(400).json({ error: "Identificador (CPF ou Email) é obrigatório" });
      }

      const isEmail = identifier.includes('@');
      let query = supabase.from('responsaveis').select('*');
      
      if (isEmail) {
        query = query.eq('email', identifier.trim().toLowerCase());
      } else {
        const cleanCPF = identifier.replace(/\D/g, '').trim();
        query = query.eq('cpf', cleanCPF);
      }

      const { data: guardian, error: gError } = await query.order('created_at', { ascending: false }).limit(1).maybeSingle();

      if (gError) throw gError;
      
      if (!guardian) {
        return res.status(404).json({ error: "Responsável não encontrado" });
      }

      // Verificar senha com suporte a migração transparente (plaintext → bcrypt)
      if (password && guardian.senha) {
        const { valid, needsRehash } = await verifyPassword(password, guardian.senha);
        if (!valid) {
          return res.status(401).json({ error: "Senha incorreta" });
        }
        // Se a senha ainda está em plaintext, aproveita o login para migrar para bcrypt
        if (needsRehash) {
          const hashed = await hashPassword(password);
          await supabase.from('responsaveis').update({ senha: hashed }).eq('id', guardian.id);
        }
      }

      // If password is required but not provided
      if (!password && guardian.senha) {
        return res.status(401).json({ error: "Senha é obrigatória", passwordRequired: true });
      }

      // Defer needsProfileCompletion check until after fetching students
      const isTemporaryCpf = guardian.cpf && guardian.cpf.startsWith('IMP');

      // If found by CPF or found by email with CPF already set
      // Fetch students separately to avoid complex join issues
      const { data: students, error: sError } = await supabase
        .from('alunos')
        .select('*, matriculas(*)')
        .eq('responsavel_id', guardian.id);

      if (sError) {
        console.warn("Error fetching students for guardian:", sError);
      }

      const data = { ...guardian, alunos: students || [] };

      // Fetch all turmas to get schedules
      const { data: turmasComp, error: tError } = await supabase
        .from('turmas')
        .select('nome, dias_horarios');

      if (tError) {
        console.warn("Error fetching turmas:", tError);
      }

      const allTurmas = turmasComp || [];
      const turmaScheduleMap = new Map();
      allTurmas.forEach(t => {
        if (t.nome && t.dias_horarios) {
          const normalizedName = t.nome.trim().toLowerCase();
          turmaScheduleMap.set(normalizedName, t.dias_horarios);
        }
      });

      const flatAlunos: any[] = [];
      data.alunos?.forEach((aluno: any) => {
        if (aluno.matriculas && aluno.matriculas.length > 0) {
          aluno.matriculas.forEach((mat: any) => {
            const lookupName = (mat.turma || "").trim().toLowerCase();
            flatAlunos.push({
              ...aluno,
              id: mat.id,
              aluno_id: aluno.id,
              turma: mat.turma,
              unidade: mat.unidade,
              status: mat.status,
              data_cancelamento: mat.data_cancelamento,
              data_matricula: mat.data_matricula,
              pagarme_subscription_id: mat.pagarme_subscription_id,
              horario: turmaScheduleMap.get(lookupName) || null,
              matriculas: undefined
            });
          });
        } else {
          flatAlunos.push({
            ...aluno,
            aluno_id: aluno.id,
            turma: null,
            unidade: null
          });
        }
      });
      
      const hasActiveEnrollments = flatAlunos.some(a => (a.status || '').toLowerCase() === 'ativo');

      if (!guardian.cpf || isTemporaryCpf || !guardian.senha) {
        return res.json({ 
          needsProfileCompletion: true, 
          isTemporaryCpf: !!isTemporaryCpf,
          isFirstAccess: !guardian.senha,
          guardian: {
            id: guardian.id,
            nome_completo: guardian.nome_completo,
            email: guardian.email,
            telefone: guardian.telefone,
            endereco: guardian.endereco,
            cpf: isTemporaryCpf ? guardian.cpf : (guardian.cpf || ''),
            alunos: flatAlunos,
            hasActiveEnrollments
          }
        });
      }

      res.json({
        ...data,
        alunos: flatAlunos,
        hasActiveEnrollments
      });
    } catch (error: any) {
      console.error("Error accessing guardian panel:", error);
      res.status(500).json({ error: error.message || "Erro interno no servidor" });
    }
  });

  app.post("/api/guardian/complete-profile", async (req, res) => {
    const { id, cpf, name, email, phone, address, password } = req.body;
    try {
      if (!id || !cpf) {
        return res.status(400).json({ error: "ID e CPF são obrigatórios" });
      }

      const cleanCPF = sanitizeCPF(cpf);
      
      // Check if CPF already exists for another user
      const { data: existing, error: checkError } = await supabase
        .from('responsaveis')
        .select('id')
        .eq('cpf', cleanCPF)
        .neq('id', id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existing) {
        return res.status(400).json({ error: "Este CPF já está cadastrado para outro usuário." });
      }

      const { data, error } = await supabase
        .from('responsaveis')
        .update({
          nome_completo: name,
          cpf: cleanCPF,
          email: email,
          telefone: phone,
          endereco: address,
          senha: await hashPassword(password)
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      // After updating, fetch students to return full data
      const { data: students } = await supabase
        .from('alunos')
        .select('*, matriculas(*)')
        .eq('responsavel_id', id);

      const flatAlunos: any[] = [];
      students?.forEach((aluno: any) => {
        if (aluno.matriculas && aluno.matriculas.length > 0) {
          aluno.matriculas.forEach((mat: any) => {
            flatAlunos.push({
              ...aluno,
              id: mat.id,
              aluno_id: aluno.id,
              turma: mat.turma,
              unidade: mat.unidade,
              status: mat.status,
              data_matricula: mat.data_matricula,
              pagarme_subscription_id: mat.pagarme_subscription_id,
              horario: mat.horario,
              data_cancelamento: mat.data_cancelamento
            });
          });
        } else {
          flatAlunos.push({
            ...aluno,
            aluno_id: aluno.id,
            turma: null,
            unidade: null
          });
        }
      });

      res.json({ 
        success: true, 
        guardian: { ...data, alunos: flatAlunos } 
      });
    } catch (error: any) {
      console.error("Error completing guardian profile:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/guardian/:id/alunos", async (req, res) => {
    const { id } = req.params;
    try {
      const { data: students, error: sError } = await supabase
        .from('alunos')
        .select('*, matriculas(*)')
        .eq('responsavel_id', id);

      if (sError) throw sError;

      const { data: turmasComp } = await supabase
        .from('turmas')
        .select('nome, dias_horarios');

      const allTurmas = turmasComp || [];
      const turmaScheduleMap = new Map();
      allTurmas.forEach(t => {
        if (t.nome && t.dias_horarios) {
          const normalizedName = t.nome.trim().toLowerCase();
          turmaScheduleMap.set(normalizedName, t.dias_horarios);
        }
      });

      const flatAlunos: any[] = [];
      students?.forEach((aluno: any) => {
        if (aluno.matriculas && aluno.matriculas.length > 0) {
          aluno.matriculas.forEach((mat: any) => {
            const lookupName = (mat.turma || "").trim().toLowerCase();
            flatAlunos.push({
              ...aluno,
              id: mat.id,
              aluno_id: aluno.id,
              turma: mat.turma,
              unidade: mat.unidade,
              status: mat.status,
              data_cancelamento: mat.data_cancelamento,
              data_matricula: mat.data_matricula,
              pagarme_subscription_id: mat.pagarme_subscription_id,
              horario: turmaScheduleMap.get(lookupName) || null,
              matriculas: undefined
            });
          });
        } else {
          flatAlunos.push({
            ...aluno,
            aluno_id: aluno.id,
            turma: null,
            unidade: null
          });
        }
      });

      res.json({ alunos: flatAlunos });
    } catch (error: any) {
      console.error("Error fetching guardian alunos:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/guardian/:cpf", async (req, res) => {
    const { cpf } = req.params;
    try {
      const { data, error } = await supabase
        .from('responsaveis')
        .select('id, cpf, nome_completo')
        .eq('cpf', cpf)
        .maybeSingle();

      if (error) throw error;
      
      if (data) {
        // Check for active enrollments to inform about fidelity discount
        const { data: students } = await supabase
          .from('alunos')
          .select('id')
          .eq('responsavel_id', data.id);
        
        const studentIds = students?.map(s => s.id) || [];
        
        const { count: activeCount } = await supabase
          .from('matriculas')
          .select('*', { count: 'exact', head: true })
          .in('status', ['ativo', 'Ativo'])
          .in('aluno_id', studentIds);

        res.json({ 
          exists: true, 
          name: data.nome_completo,
          hasActiveEnrollments: (activeCount || 0) > 0
        });
      } else {
        res.json({ exists: false });
      }
    } catch (error: any) {
      console.error("Error fetching guardian:", error);
      res.status(500).json({ error: error.message, details: error });
    }
  });

  app.post("/api/guardian/verify", async (req, res) => {
    const { cpf, password } = req.body;
    try {
      const cleanCPF = String(cpf || '').replace(/\D/g, '').trim();
      // Buscar responsável por CPF e verificar senha com suporte a migração bcrypt
      const { data: guardian, error: gError } = await supabase
        .from('responsaveis')
        .select('*')
        .eq('cpf', cleanCPF)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (gError) throw gError;

      if (!guardian) {
        return res.status(401).json({ error: "Senha incorreta" });
      }

      const { valid, needsRehash } = await verifyPassword(password, guardian.senha);
      if (!valid) {
        return res.status(401).json({ error: "Senha incorreta" });
      }
      if (needsRehash) {
        const hashed = await hashPassword(password);
        await supabase.from('responsaveis').update({ senha: hashed }).eq('id', guardian.id);
      }
        // Fetch students separately to avoid complex join issues
        const { data: students, error: sError } = await supabase
          .from('alunos')
          .select('*, matriculas(*)')
          .eq('responsavel_id', guardian.id);

        if (sError) {
          console.warn("Error fetching students for guardian:", sError);
        }

        const data = { ...guardian, alunos: students || [] };

        // Fetch all turmas to get schedules
        const { data: turmasComp, error: tError } = await supabase
          .from('turmas')
          .select('nome, dias_horarios');

        if (tError) {
          console.warn("Error fetching turmas:", tError);
        }

        const allTurmas = turmasComp || [];

        // Create a normalized map for better matching
        const turmaScheduleMap = new Map();
        allTurmas.forEach(t => {
          if (t.nome && t.dias_horarios) {
            const normalizedName = t.nome.trim().toLowerCase();
            turmaScheduleMap.set(normalizedName, t.dias_horarios);
          }
        });

        // Flatten for frontend compatibility if needed, or keep nested
        const flatAlunos: any[] = [];
        data.alunos?.forEach((aluno: any) => {
          if (aluno.matriculas && aluno.matriculas.length > 0) {
            aluno.matriculas.forEach((mat: any) => {
              const lookupName = (mat.turma || "").trim().toLowerCase();
              flatAlunos.push({
                ...aluno,
                id: mat.id,
                aluno_id: aluno.id,
                turma: mat.turma,
                unidade: mat.unidade,
                status: mat.status,
                data_cancelamento: mat.data_cancelamento,
                data_matricula: mat.data_matricula,
                pagarme_subscription_id: mat.pagarme_subscription_id,
                horario: turmaScheduleMap.get(lookupName) || null,
                matriculas: undefined
              });
            });
          } else {
            // Student without enrollments
            flatAlunos.push({
              ...aluno,
              aluno_id: aluno.id,
              turma: null,
              unidade: null
            });
          }
        });
        
        const hasActiveEnrollments = flatAlunos.some(a => (a.status || '').toLowerCase() === 'ativo');

        res.json({
          ...data,
          alunos: flatAlunos,
          hasActiveEnrollments
        });
    } catch (error: any) {
      console.error("Error verifying guardian:", util.inspect(error, { depth: null, colors: true }));
      
      res.status(500).json({ 
        error: error.message || "Internal Server Error", 
        details: error,
        code: error.code
      });
    }
  });

  app.post("/api/guardian/register", async (req, res) => {
    const { name, cpf, email, phone, address, password } = req.body;
    try {
      const cleanCPF = sanitizeCPF(cpf);
      const normalizedEmail = email ? email.trim().toLowerCase() : '';

      // Check if email or CPF already exists
      const { data: existingGuardian, error: checkError } = await supabase
        .from('responsaveis')
        .select('id, email, cpf')
        .or(`email.eq.${normalizedEmail},cpf.eq.${cleanCPF}`)
        .maybeSingle();

      if (checkError) {
        console.error("[Register] Error checking existing guardian:", checkError);
      }

      if (existingGuardian) {
        const isCpfMatch = existingGuardian.cpf === cleanCPF;
        return res.status(400).json({ 
          code: 'GUARDIAN_ALREADY_EXISTS',
          error: isCpfMatch ? 'Já existe um cadastro com este CPF.' : 'Já existe um cadastro com este e-mail.',
          identifier: isCpfMatch ? cpf : email
        });
      }

      const { data, error } = await supabase
        .from('responsaveis')
        .insert([{
          nome_completo: name,
          cpf: cleanCPF,
          email: email,
          telefone: phone,
          endereco: address,
          senha: await hashPassword(password)
        }])
        .select()
        .single();

      if (error) {
        console.error("Error registering guardian:", error);
        return res.status(400).json({ error: error.message, details: error });
      }

      res.json({ success: true, guardian: data });
    } catch (error: any) {
      console.error("Internal error registering guardian:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/guardian/recover-password", async (req, res) => {
    const { cpf, identifier } = req.body;
    try {
      let query = supabase.from('responsaveis').select('id, nome_completo, telefone, senha');
      
      if (identifier) {
        const isEmail = identifier.includes('@');
        if (isEmail) {
          query = query.eq('email', identifier.trim().toLowerCase());
        } else {
          const cleanCPF = sanitizeCPF(identifier);
          query = query.eq('cpf', cleanCPF);
        }
      } else if (cpf) {
        const cleanCPF = sanitizeCPF(cpf);
        query = query.eq('cpf', cleanCPF);
      } else {
        return res.status(400).json({ error: "CPF ou Identificador é obrigatório" });
      }

      const { data, error } = await query.order('created_at', { ascending: false }).limit(1).maybeSingle();

      if (error) throw error;
      
      if (!data) {
        return res.status(404).json({ error: "Responsável não encontrado" });
      }

      if (!data.telefone) {
        return res.status(400).json({ error: "Telefone não cadastrado para este responsável. Entre em contato com o suporte." });
      }

      // Try to find a unit for this guardian to use the correct WhatsApp sender
      let unitName: string | undefined;
      try {
        const { data: students } = await supabase
          .from('alunos')
          .select('id')
          .eq('responsavel_id', data.id);
        
        if (students && students.length > 0) {
          const studentIds = students.map(s => s.id);
          const { data: mat } = await supabase
            .from('matriculas')
            .select('unidade')
            .in('aluno_id', studentIds)
            .in('status', ['ativo', 'Ativo'])
            .limit(1)
            .maybeSingle();
          
          if (mat) {
            unitName = mat.unidade;
          }
        }
      } catch (err) {
        console.warn("Error finding unit for password recovery:", err);
      }

      // Gerar senha temporária e enviar via WhatsApp (nunca revelar a senha atual)
      const tempPassword = generateTempPassword();
      const hashedTemp = await hashPassword(tempPassword);

      await supabase
        .from('responsaveis')
        .update({ senha: hashedTemp })
        .eq('id', data.id);

      await sendWhatsAppMessage(
        data.telefone,
        data.nome_completo,
        `Olá *${data.nome_completo}*, sua senha de acesso ao *Sport for Kids* foi redefinida.\n\nNova senha temporária: *${tempPassword}*\n\nRecomendamos que você a altere após o primeiro acesso.`,
        unitName
      );

      res.json({ success: true, message: "Senha temporária enviada para o WhatsApp cadastrado" });
    } catch (error: any) {
      console.error("Error recovering password:", error);
      res.status(500).json({ error: error.message || "Erro interno no servidor" });
    }
  });

  app.post("/api/guardian/update", async (req, res) => {
    const { id, cpf, name, email, phone, address, password } = req.body;
    try {
      const updateData: any = {
        nome_completo: name,
        email: email,
        telefone: phone,
        endereco: address
      };
      
      if (cpf && !cpf.startsWith('IMP')) {
        updateData.cpf = cpf;
      }
      
      if (password) {
        updateData.senha = await hashPassword(password);
      }

      let query = supabase.from('responsaveis').update(updateData);
      if (id) {
        query = query.eq('id', id);
      } else {
        query = query.eq('cpf', cpf);
      }

      const { data, error } = await query.select().single();

      if (error) throw error;
      res.json({ success: true, guardian: data });
    } catch (error: any) {
      console.error("Error updating guardian:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Portal Endpoints: Card Update & Documents
  app.patch("/api/portal/subscription/card", async (req, res) => {
    const { enrollmentId, card } = req.body;
    try {
      const { data: matData, error: matError } = await supabase
        .from('matriculas')
        .select('pagarme_subscription_id, unidade')
        .eq('id', enrollmentId)
        .single();

      if (matError || !matData?.pagarme_subscription_id) {
        return res.status(404).json({ error: "Assinatura não encontrada para esta matrícula." });
      }

      let secretKey = (process.env.PAGARME_SECRET_KEY || "").trim();
      
      const franquiaConfig = await getFranquiaConfig(matData.unidade);
      if (franquiaConfig) {
        if (franquiaConfig.modelo_pagamento === 'saas') {
          secretKey = franquiaConfig.pagarme_api_key;
        } else if (franquiaConfig.modelo_pagamento === 'split') {
          secretKey = process.env.VITE_PAGARME_MASTER_KEY || process.env.PAGARME_MASTER_KEY || secretKey;
        }
      }

      if (!secretKey) throw new Error("PAGARME_SECRET_KEY não configurada.");

      const authHeader = `Basic ${Buffer.from(`${secretKey}:`).toString('base64')}`;

      // Update card in Pagar.me subscription
      await axios.patch(`https://api.pagar.me/core/v5/subscriptions/${matData.pagarme_subscription_id}/card`, {
        card: {
          number: card.number.replace(/\s/g, ''),
          holder_name: card.holder_name,
          holder_document: card.cpf ? card.cpf.replace(/\D/g, '') : undefined,
          exp_month: card.exp_month,
          exp_year: card.exp_year,
          cvv: card.cvv
        }
      }, {
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json'
        }
      });

      res.json({ success: true, message: "Cartão atualizado com sucesso na assinatura." });
    } catch (error: any) {
      console.error("Error updating subscription card:", error.response?.data || error.message);
      const errorMsg = error.response?.data?.message || error.message;
      res.status(500).json({ error: `Erro ao atualizar cartão: ${errorMsg}` });
    }
  });

  app.get("/api/portal/documents/contract/:enrollmentId", async (req, res) => {
    const { enrollmentId } = req.params;
    try {
      // 1. Fetch enrollment
      const { data: mat, error: matError } = await supabase
        .from('matriculas')
        .select('*')
        .eq('id', enrollmentId)
        .single();

      if (matError) {
        console.error("Supabase error fetching enrollment:", matError);
        return res.status(500).send(`Erro ao buscar matrícula: ${matError.message}`);
      }
      if (!mat) return res.status(404).send("Matrícula não encontrada.");

      // 1.1 Fetch class data for values
      let valorSistema = 0;
      if (mat.turma_id) {
        const { data: classData } = await supabase
          .from('turmas')
          .select('valor_mensalidade, precos_unidade')
          .eq('id', mat.turma_id)
          .maybeSingle();
        valorSistema = classData?.precos_unidade?.[mat.unidade] ?? (classData?.valor_mensalidade || 0);
      }

      // 1.2 Fetch first payment to get the actual charged value
      const { data: firstPayment } = await supabase
        .from('pagamentos')
        .select('valor')
        .eq('matricula_id', enrollmentId)
        .order('data_vencimento', { ascending: true })
        .limit(1)
        .maybeSingle();

      const valorPadrao = valorSistema * 1.10;
      const descontoTaxaZero = valorSistema * 0.10;
      const valorCheio = valorSistema;
      const valorMatricula = firstPayment?.valor || valorSistema;

      // 2. Fetch student
      const { data: student, error: sError } = await supabase
        .from('alunos')
        .select('*')
        .eq('id', mat.aluno_id)
        .single();

      if (sError || !student) {
        console.error("Error fetching student for contract:", sError);
        return res.status(500).send("Erro ao buscar dados do aluno.");
      }

      // 3. Fetch guardian
      const { data: guardian, error: gError } = await supabase
        .from('responsaveis')
        .select('*')
        .eq('id', student.responsavel_id)
        .single();

      if (gError || !guardian) {
        console.error("Error fetching guardian for contract:", gError);
        return res.status(500).send("Erro ao buscar dados do responsável.");
      }

      // 4. Fetch terms template
      const { data: termsData } = await supabase
        .from('configuracoes')
        .select('valor')
        .eq('chave', 'terms_template')
        .maybeSingle();

      let termsText = termsData?.valor || "Termos e condições não definidos.";
      
      // Format address
      let formattedAddress = "Não informado";
      if (guardian.endereco) {
        try {
          const addr = typeof guardian.endereco === 'string' ? JSON.parse(guardian.endereco) : guardian.endereco;
          const street = addr.logradouro || addr.street || '';
          const number = addr.numero || addr.number || '';
          const complement = addr.complemento || addr.complement ? ` - ${addr.complemento || addr.complement}` : '';
          const neighborhood = addr.bairro || addr.neighborhood || '';
          const city = addr.cidade || addr.city || '';
          const state = addr.estado || addr.state || '';
          const zip = addr.cep || addr.zipCode || '';
          
          formattedAddress = `${street}, ${number}${complement}, ${neighborhood}, ${city}/${state}, CEP: ${zip}`;
        } catch (e) {
          formattedAddress = String(guardian.endereco);
        }
      }

      // Values from enrollment logic
      // valorPadrao, valorCheio, desconto, valorMatricula are already calculated above

      // Helper to format currency
      const formatCurrency = (val: number) => 
        new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

      // Replace placeholders (both {{}} and [] formats)
      const replacements: Record<string, string> = {
        "NOME_RESPONSAVEL": guardian.nome_completo || "",
        "RESPONSAVEL": guardian.nome_completo || "",
        "CPF_RESPONSAVEL": guardian.cpf || "",
        "CPF": guardian.cpf || "",
        "EMAIL_RESPONSAVEL": guardian.email || "",
        "TELEFONE_RESPONSAVEL": guardian.telefone || "",
        "ENDERECO_RESPONSAVEL": formattedAddress,
        "ENDERECO": formattedAddress,
        "NOME_ALUNO": student.nome_completo || "",
        "ESTUDANTE": student.nome_completo || "",
        "TURMA": mat.turma || "",
        "CURSO": mat.turma || "",
        "UNIDADE": mat.unidade || "",
        "DATA_MATRICULA": new Date(mat.created_at).toLocaleDateString('pt-BR'),
        "VALOR PADRAO": formatCurrency(valorPadrao),
        "VALOR CHEIO": formatCurrency(valorCheio),
        "VALOR LIQUIDO": formatCurrency(valorMatricula),
        "VALOR": formatCurrency(valorMatricula),
        "desconto taxa zero": formatCurrency(descontoTaxaZero)
      };

      for (const [key, value] of Object.entries(replacements)) {
        const regexBraces = new RegExp(`{{${key}}}`, 'g');
        const regexBrackets = new RegExp(`\\[${key}\\]`, 'g');
        termsText = termsText.replace(regexBraces, value).replace(regexBrackets, value);
      }

      const doc = new PDFDocument({ margin: 50 });
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=Contrato_${student.nome_completo.replace(/\s/g, '_')}.pdf`);
      doc.pipe(res);

      doc.fontSize(20).text('CONTRATO DE PRESTAÇÃO DE SERVIÇOS ESPORTIVOS', { align: 'center' });
      doc.moveDown();
      doc.fontSize(12).text(`CONTRATANTE: ${guardian.nome_completo}`);
      doc.text(`CPF: ${guardian.cpf}`);
      doc.text(`ENDEREÇO: ${formattedAddress}`);
      doc.moveDown();
      doc.text(`OBJETO: Prestação de serviços de aulas de ${mat.turma} na unidade ${mat.unidade}.`);
      doc.text(`ALUNO(A): ${student.nome_completo}`);
      doc.moveDown();
      doc.text('CLÁUSULAS E CONDIÇÕES:');
      doc.moveDown();
      doc.fontSize(10).text(termsText, { align: 'justify', lineGap: 2 });
      doc.moveDown();
      doc.fontSize(12).text(`DATA DA MATRÍCULA: ${new Date(mat.created_at).toLocaleDateString('pt-BR')}`);
      doc.moveDown(4);
      doc.text('________________________________________________', { align: 'center' });
      doc.text('Assinatura do Responsável (Digital)', { align: 'center' });

      doc.end();
    } catch (error: any) {
      console.error("Error generating contract:", error);
      res.status(500).send("Erro ao gerar contrato.");
    }
  });
  app.get("/api/portal/history/:guardianId", async (req, res) => {
    try {
      const { guardianId } = req.params;
      
      // Get enrollments (matriculas)
      const { data: matriculas } = await supabase
        .from('matriculas')
        .select('*, turmas(*)')
        .eq('responsavel_id', guardianId);
        
      // Get payments history (pagamentos_wix and pagamentos_pagseguro and pagamentos)
      const { data: payWix } = await supabase.from('pagamentos_wix').select('*').eq('responsavel_id', guardianId);
      const { data: payPagSeguro } = await supabase.from('pagamentos_pagseguro').select('*').eq('responsavel_id', guardianId);
      const { data: payManual } = await supabase.from('pagamentos').select('*').eq('responsavel_id', guardianId);
      const { data: payMensalidades } = await supabase.from('mensalidades').select('*').eq('responsavel_id', guardianId);
      
      // Get events inscriptions
      const { data: eventos } = await supabase.from('evento_inscricoes').select('*, eventos(*)').eq('responsavel_id', guardianId);

      const allPayments = [
        ...(payWix || []).map((p: any) => ({ ...p, provider: 'Wix', title: p.descricao || 'Pagamento Online', date: p.created_at, status: p.status_transacao })),
        ...(payPagSeguro || []).map((p: any) => ({ ...p, provider: 'PagSeguro', title: 'Pagamento Online', date: p.created_at, status: p.status })),
        ...(payManual || []).map((p: any) => ({ ...p, provider: 'Manual', title: 'Pagamento Manual', date: p.created_at, status: p.status })),
        ...(payMensalidades || []).map((p: any) => ({ ...p, provider: 'Mensalidade', title: `Mensalidade ${p.mes}/${p.ano}`, date: p.created_at, status: p.status }))
      ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      res.json({
        matriculas: matriculas || [],
        pagamentos: allPayments,
        eventos: eventos || []
      });
    } catch (err: any) {
      console.error('Error fetching portal history:', err);
      res.status(500).json({ error: err.message });
    }
  });


  app.get("/api/portal/documents/receipt/:paymentId", async (req, res) => {
    const { paymentId } = req.params;
    try {
      // 1. Fetch payment
      const { data: payment, error: pError } = await supabase
        .from('pagamentos')
        .select('*')
        .eq('id', paymentId)
        .single();

      if (pError || !payment) {
        console.error("Error fetching payment for receipt:", pError);
        return res.status(404).send("Pagamento não encontrado.");
      }

      // 2. Fetch student
      let student: any = null;
      if (payment.aluno_id) {
        const { data: sData } = await supabase.from('alunos').select('*').eq('id', payment.aluno_id).single();
        student = sData;
      }

      // Fallback if aluno_id is missing in pagamentos (try to get from matricula)
      if (!student && payment.matricula_id) {
        const { data: mat } = await supabase.from('matriculas').select('aluno_id').eq('id', payment.matricula_id).single();
        if (mat) {
          const { data: s2 } = await supabase.from('alunos').select('*').eq('id', mat.aluno_id).single();
          student = s2;
        }
      }

      if (!student) {
        console.error("Could not find student for receipt");
        return res.status(500).send("Erro ao buscar dados do aluno.");
      }

      // 3. Fetch guardian
      const { data: guardian, error: gError } = await supabase
        .from('responsaveis')
        .select('*')
        .eq('id', student.responsavel_id)
        .single();

      if (gError || !guardian) {
        console.error("Error fetching guardian for receipt:", gError);
        return res.status(500).send("Erro ao buscar dados do responsável.");
      }

      const doc = new PDFDocument();
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=Recibo_${student.nome_completo.replace(/\s/g, '_')}_${paymentId.substring(0, 8)}.pdf`);
      doc.pipe(res);

      doc.fontSize(20).text('RECIBO DE PAGAMENTO', { align: 'center' });
      doc.moveDown();
      doc.fontSize(12).text(`RECEBEMOS DE: ${guardian.nome_completo}`);
      doc.text(`CPF: ${guardian.cpf}`);
      doc.moveDown();
      doc.text(`A IMPORTÂNCIA DE: R$ ${payment.valor?.toFixed(2)}`);
      doc.text(`REFERENTE A: Mensalidade de ${payment.turma || 'Esportes'} - Unidade ${payment.unidade || 'Sport for Kids'}`);
      doc.text(`ALUNO(A): ${student.nome_completo}`);
      doc.moveDown();
      doc.text(`DATA DO PAGAMENTO: ${new Date(payment.data_pagamento || payment.created_at).toLocaleDateString('pt-BR')}`);
      doc.text(`MÉTODO: ${payment.metodo_pagamento?.toUpperCase() || 'CARTÃO DE CRÉDITO'}`);
      doc.moveDown(2);
      doc.text('Pelo presente, damos plena e geral quitação pelo valor recebido.');
      doc.moveDown(4);
      doc.text('________________________________________________', { align: 'center' });
      doc.text('SPORT FOR KIDS LTDA', { align: 'center' });
      doc.text('CNPJ: 00.000.000/0001-00', { align: 'center' });

      doc.end();
    } catch (error: any) {
      console.error("Error generating receipt:", error);
      res.status(500).send("Erro ao gerar recibo.");
    }
  });

  app.post("/api/enroll", async (req, res) => {
    const { guardian, student, paymentMethod, couponId } = req.body;
    const clientIp = (req.headers['x-forwarded-for'] as string || req.socket.remoteAddress || '').split(',')[0].trim();
    
    try {
      // 0. Get the class data (price and ID)
      let valorCobrado = 0;
      let turmaId = null;
      if (student.turmaComplementar) {
        const { data: classData, error: classError } = await supabase
          .from('turmas')
          .select('id, valor_mensalidade, precos_unidade')
          .eq('nome', student.turmaComplementar.trim())
          .limit(1)
          .maybeSingle();
        
        if (classError) {
          console.warn("Error fetching class data:", classError);
        }
        valorCobrado = classData?.precos_unidade?.[student.unit] ?? (classData?.valor_mensalidade || 0);
        turmaId = classData?.id;
      }

      // 0.1 Handle Coupon
      let discount = 0;
      let couponData = null;
      if (couponId) {
        const { data: coupon, error: cError } = await supabase
          .from('cupons')
          .select('*')
          .eq('id', couponId)
          .single();
        
        if (!cError && coupon && coupon.ativo) {
          // Server-side validation
          const now = new Date();
          const start = new Date(coupon.data_inicio);
          const end = coupon.data_expiracao ? new Date(coupon.data_expiracao) : null;
          
          let isValid = now >= start && (!end || now <= end);
          if (isValid && coupon.limite_uso && coupon.usos_atuais >= coupon.limite_uso) {
            isValid = false;
          }

          if (isValid) {
            couponData = coupon;
            if (coupon.tipo === 'fixo') {
              discount = coupon.valor;
            } else {
              discount = (valorCobrado * coupon.valor) / 100;
            }
            valorCobrado = Math.max(0, valorCobrado - discount);
          }
        }
      }

      // 1. Find or Create Guardian
      let guardianId: any;
      const cleanCPF = sanitizeCPF(guardian.cpf);
      
      const { data: existingGuardian, error: findError } = await supabase
        .from('responsaveis')
        .select('id')
        .eq('cpf', cleanCPF)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (findError) {
        console.error("Error searching for existing guardian:", JSON.stringify(findError, null, 2));
      }

      if (existingGuardian) {
        // Update existing guardian info
        const updateData: any = {
          nome_completo: guardian.name,
          email: guardian.email,
          telefone: guardian.phone,
          endereco: guardian.address
        };
        
        if (guardian.password) {
          updateData.senha = guardian.password;
        }

        const { data: updatedGuardian, error: uError } = await supabase
          .from('responsaveis')
          .update(updateData)
          .eq('id', existingGuardian.id)
          .select()
          .maybeSingle();

        if (uError) {
          console.error("Guardian Update Error Details:", JSON.stringify(uError, null, 2));
          throw uError;
        }
        guardianId = updatedGuardian.id;
      } else {
        // Insert new guardian
        const { data: newGuardianData, error: gError } = await supabase
          .from('responsaveis')
          .insert([{
            nome_completo: guardian.name,
            cpf: cleanCPF,
            email: guardian.email,
            telefone: guardian.phone,
            endereco: guardian.address,
            senha: guardian.password
          }])
          .select();

        if (gError) {
          console.error("Guardian Insert Error Details:", JSON.stringify(gError, null, 2));
          throw gError;
        }
        
        if (!newGuardianData || newGuardianData.length === 0) {
          throw new Error("Erro ao criar responsável: Nenhum dado retornado pelo banco.");
        }
        guardianId = newGuardianData[0].id;
      }

      // 1.1 Fidelity Discount Check
      // If the guardian already has at least one active enrollment, apply 10% discount
      const { data: guardianStudents } = await supabase
        .from('alunos')
        .select('id')
        .eq('responsavel_id', guardianId);
      
      const studentIds = guardianStudents?.map(s => s.id) || [];
      
      const { count: activeEnrollmentsCount } = await supabase
        .from('matriculas')
        .select('*', { count: 'exact', head: true })
        .in('status', ['ativo', 'Ativo'])
        .in('aluno_id', studentIds);
      
      if (activeEnrollmentsCount && activeEnrollmentsCount > 0) {
        const fidelityDiscount = valorCobrado * 0.10;
        valorCobrado = Math.max(0, valorCobrado - fidelityDiscount);
        console.log(`Fidelity discount applied: 10% off. New value: ${valorCobrado}`);
      }

      // 2. Find or Create Student
      let alunoId: any;
      const { data: existingStudent, error: studentFindError } = await supabase
        .from('alunos')
        .select('id')
        .eq('responsavel_id', guardianId)
        .ilike('nome_completo', student.name.trim())
        .eq('data_nascimento', student.birthDate)
        .limit(1)
        .maybeSingle();

      if (studentFindError) {
        console.error("Error searching for existing student:", JSON.stringify(studentFindError, null, 2));
      }

      if (existingStudent) {
        // Update student info
        const { error: sUpdateError } = await supabase
          .from('alunos')
          .update({
            serie_ano: student.grade,
            turma_escolar: student.turmaEscolar,
            responsavel_1: student.responsavel1,
            whatsapp_1: student.whatsapp1,
            responsavel_2: student.responsavel2,
            whatsapp_2: student.whatsapp2,
            unidade_origem_id: student.unidadeOrigemId || null
          })
          .eq('id', existingStudent.id);
        
        if (sUpdateError) throw sUpdateError;
        alunoId = existingStudent.id;
      } else {
        // Insert new student
        const { data: newStudent, error: sError } = await supabase
          .from('alunos')
          .insert([{
            responsavel_id: guardianId,
            nome_completo: student.name.trim(),
            data_nascimento: student.birthDate,
            serie_ano: student.grade,
            turma_escolar: student.turmaEscolar,
            responsavel_1: student.responsavel1,
            whatsapp_1: student.whatsapp1,
            responsavel_2: student.responsavel2,
            whatsapp_2: student.whatsapp2,
            unidade_origem_id: student.unidadeOrigemId || null
          }])
          .select()
          .single();

        if (sError) {
          console.error("Student Insert Error Details:", JSON.stringify(sError, null, 2));
          throw sError;
        }
        alunoId = newStudent.id;
      }

      // 2.5 Check for duplicate enrollment
      if (alunoId) {
        const { data: existingEnrollment, error: checkError } = await supabase
          .from('matriculas')
          .select('id')
          .eq('aluno_id', alunoId)
          .eq('turma', student.turmaComplementar)
          .in('status', ['ativo', 'Ativo'])
          .limit(1)
          .maybeSingle();

        if (checkError) {
          console.error("Error checking for duplicate enrollment:", checkError);
          return res.status(500).json({ success: false, error: 'Erro ao verificar matrícula existente.' });
        }

        if (existingEnrollment) {
          return res.status(400).json({ success: false, error: 'O estudante já possui uma matrícula ativa nesta turma.' });
        }
      }

      // 3. Insert Enrollment
      const { data: newMatricula, error: mError } = await supabase
        .from('matriculas')
        .insert([{
          aluno_id: alunoId,
          unidade: student.unidade,
          turma: student.turmaComplementar,
          turma_id: turmaId,
          status: 'pendente'
        }])
        .select()
        .single();

      if (mError) {
        console.error("Enrollment Insert Error Details:", JSON.stringify(mError, null, 2));
        throw mError;
      }

      const matriculaId = newMatricula?.id;

      // 4. Generate Installments based on Unit Mapping
      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];
      let inicioAulas: Date | null = null;
      let fimAulas: Date | null = null;
      let unitMapping: any = null;

      try {
        const unidadeNome = (student.unidade || '').trim();
        
        // Busca todas as configurações para a unidade, ordenadas por data de início
        // Filtramos para pegar apenas as que ainda não terminaram (fim_aulas >= hoje)
        const { data: mappings, error: mappingError } = await supabase
          .from('unidades_mapping')
          .select('inicio_aulas, fim_aulas, identidade, ano_letivo')
          .ilike('nome', unidadeNome)
          .gte('fim_aulas', todayStr)
          .order('inicio_aulas', { ascending: true });
        
        if (mappingError) {
          console.warn("Error fetching mapping with 'nome':", mappingError.message);
          // Fallback para 'nome_unidade'
          const { data: fallbackMappings } = await supabase
            .from('unidades_mapping')
            .select('inicio_aulas, fim_aulas, identidade, ano_letivo')
            .ilike('nome_unidade', unidadeNome)
            .gte('fim_aulas', todayStr)
            .order('inicio_aulas', { ascending: true });
          
          if (fallbackMappings && fallbackMappings.length > 0) {
            unitMapping = fallbackMappings[0];
          }
        } else if (mappings && mappings.length > 0) {
          unitMapping = mappings[0];
        }
        
        // Se ainda não encontrou (talvez todas as datas já passaram), pega a mais recente de todas
        if (!unitMapping && unidadeNome) {
          const { data: latestMappings } = await supabase
            .from('unidades_mapping')
            .select('inicio_aulas, fim_aulas, identidade, ano_letivo')
            .or(`nome.eq."${unidadeNome}",nome_unidade.eq."${unidadeNome}"`)
            .order('inicio_aulas', { ascending: false })
            .limit(1);
          
          if (latestMappings && latestMappings.length > 0) {
            unitMapping = latestMappings[0];
          }
        }
        
        console.log(`Unit mapping selecionado para "${unidadeNome}":`, JSON.stringify(unitMapping));
        
        if (unitMapping) {
          if (unitMapping.inicio_aulas) {
            const d = new Date(unitMapping.inicio_aulas);
            if (!isNaN(d.getTime())) inicioAulas = d;
          }
          if (unitMapping.fim_aulas) {
            const d = new Date(unitMapping.fim_aulas);
            if (!isNaN(d.getTime())) fimAulas = d;
          }
        }
      } catch (err) {
        console.warn("Erro ao processar unidades_mapping:", err);
      }

      const installments = [];
      
      // First payment (Registration/Enrollment) - Always today
      const firstPayment: any = {
        responsavel_id: guardianId,
        aluno_id: alunoId,
        valor: valorCobrado,
        metodo_pagamento: paymentMethod === 'pix' ? 'pix' : 'cartao_credito',
        status: 'pendente',
        data_vencimento: todayStr
      };

      if (matriculaId) {
        firstPayment.matricula_id = matriculaId;
      }
      
      installments.push(firstPayment);

      if (inicioAulas && fimAulas) {
        let baseDay = inicioAulas.getDate();
        
        // Se a matrícula for realizada após o início das aulas, o dia base passa a ser o dia da matrícula
        if (today > inicioAulas) {
          baseDay = today.getDate();
        }

        // Se o dia base for 31, ajusta para 30 para evitar pular meses sem dia 31
        if (baseDay === 31) {
          baseDay = 30;
        }

        let nextVencimento = new Date(today);
        
        // If today is before classes start, we start counting from the start month
        if (nextVencimento < inicioAulas) {
          nextVencimento = new Date(inicioAulas);
        }

        // Move to the next month for the first monthly installment
        // Set to day 1 first to avoid skipping months when current day is 31
        nextVencimento.setDate(1);
        nextVencimento.setMonth(nextVencimento.getMonth() + 1);
        nextVencimento.setDate(baseDay);

        // Handle month overflow (e.g., Jan 31 -> Feb 28)
        if (nextVencimento.getDate() !== baseDay) {
          nextVencimento.setDate(0); // Go to last day of previous month
        }

        while (nextVencimento <= fimAulas) {
          // Calcula o saldo de dias entre o vencimento e o fim das aulas
          const diffTime = fimAulas.getTime() - nextVencimento.getTime();
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          
          // Só gera a parcela se o saldo de dias for superior a 12 dias
          if (diffDays <= 12) {
            break;
          }

          let valorParcela = valorCobrado; // Valor sempre cheio

          const installment: any = {
            responsavel_id: guardianId,
            aluno_id: alunoId,
            valor: Number(valorParcela.toFixed(2)),
            metodo_pagamento: paymentMethod === 'pix' ? 'pix' : 'cartao_credito',
            status: 'pendente',
            data_vencimento: nextVencimento.toISOString().split('T')[0]
          };

          if (matriculaId) {
            installment.matricula_id = matriculaId;
          }

          installments.push(installment);

          // Advance to next month
          nextVencimento = new Date(nextVencimento);
          // Set to day 1 first to avoid skipping months when current day is 31
          nextVencimento.setDate(1);
          nextVencimento.setMonth(nextVencimento.getMonth() + 1);
          nextVencimento.setDate(baseDay);
          
          // Handle month overflow
          if (nextVencimento.getDate() !== baseDay) {
            nextVencimento.setDate(0);
          }
        }
      }

      let firstPaymentId = null;

      const isAutomaticRecurrent = (paymentMethod === 'credit_card');
      const installmentsToInsert = isAutomaticRecurrent ? [installments[0]] : installments;

      const { data: pData, error: pError } = await supabase
        .from('pagamentos')
        .insert(installmentsToInsert)
        .select();

      if (pData && pData.length > 0) {
        firstPaymentId = pData[0].id;
      }

      if (pError) {
        // Extremely robust error logging
        console.error("--- PAYMENT INSERT ERROR START ---");
        const errorMessage = String(pError.message || "");
        const errorCode = String(pError.code || "");
        console.error(`Error Code: ${errorCode}, Message: ${errorMessage}`);
        
        const errDetails: any = {};
        Object.getOwnPropertyNames(pError).forEach(prop => {
          errDetails[prop] = (pError as any)[prop];
        });
        console.error("Formatted Error Details:", JSON.stringify(errDetails, null, 2));
        console.error("--- PAYMENT INSERT ERROR END ---");
        
        // Check for "undefined_column" (42703) or PostgREST schema cache error (PGRST204)
        const isUndefinedColumn = errorCode === '42703' || 
                                 errorCode === 'PGRST204' ||
                                 errorMessage.toLowerCase().includes('column') || 
                                 errorMessage.toLowerCase().includes('coluna');

        if (isUndefinedColumn) {
          console.warn("Detected missing column in 'pagamentos', attempting dynamic recovery...");
          
          // Try to extract the column name from the error message
          // Format 1: "column \"data_vencimento\" of relation \"pagamentos\" does not exist"
          // Format 2: "Could not find the 'aluno_id' column of 'pagamentos' in the schema cache"
          const columnMatch = errorMessage.match(/column "([^"]+)"/i) || 
                             errorMessage.match(/coluna "([^"]+)"/i) ||
                             errorMessage.match(/find the '([^']+)' column/i);
          
          const missingColumn = columnMatch ? columnMatch[1] : null;
          
          if (missingColumn) {
            console.warn(`Identified missing column: ${missingColumn}. Retrying without it.`);
          }

          const retryInstallments = installmentsToInsert.map(inst => {
            const cleaned: any = { ...inst };
            if (missingColumn) {
              delete cleaned[missingColumn];
            }
            
            // Also apply some common fallbacks if we suspect they are missing based on message
            const lowerMsg = errorMessage.toLowerCase();
            if (lowerMsg.includes('data_vencimento')) {
              delete cleaned.data_vencimento;
              // Maybe it's just 'vencimento'?
              if (!lowerMsg.includes('vencimento')) {
                cleaned.vencimento = inst.data_vencimento;
              }
            }
            
            if (lowerMsg.includes('metodo_pagamento')) {
              delete cleaned.metodo_pagamento;
            }
            
            if (lowerMsg.includes('aluno_id')) {
              delete cleaned.aluno_id;
            }

            if (lowerMsg.includes('matricula_id')) {
              delete cleaned.matricula_id;
            }

            return cleaned;
          });
          
          const { data: pRetryData, error: pRetryError } = await supabase
            .from('pagamentos')
            .insert(retryInstallments)
            .select();
            
          if (pRetryData && pRetryData.length > 0) {
            firstPaymentId = pRetryData[0].id;
          }
            
          if (pRetryError) {
            console.error("--- PAYMENT RETRY ERROR START ---");
            const retryMsg = String(pRetryError.message || "");
            const retryCode = String(pRetryError.code || "");
            console.error(`Retry Error Code: ${retryCode}, Message: ${retryMsg}`);
            
            // If it still fails due to ANOTHER missing column, try one more time with a very aggressive cleanup
            if (retryCode === '42703' || retryCode === 'PGRST204' || retryMsg.toLowerCase().includes('column')) {
              console.warn("Second missing column detected, applying aggressive cleanup...");
              const aggressiveCleanup = installmentsToInsert.map(inst => ({
                responsavel_id: inst.responsavel_id,
                valor: inst.valor,
                status: inst.status
                // We drop aluno_id, metodo_pagamento, matricula_id, data_vencimento entirely
              }));
              
              const { data: pAggressiveData, error: pAggressiveError } = await supabase
                .from('pagamentos')
                .insert(aggressiveCleanup)
                .select();

              if (pAggressiveData && pAggressiveData.length > 0) {
                firstPaymentId = pAggressiveData[0].id;
              }
              if (pAggressiveError) {
                console.error("Aggressive cleanup failed:", pAggressiveError.message);
              } else {
                console.log("Aggressive cleanup succeeded.");
              }
            }
            
            // Final fallback if everything else failed
            console.warn("Final fallback attempt with absolute minimum fields...");
            
            const absoluteMinimum: any = {
              valor: valorCobrado,
              status: 'pendente'
            };
            
            // Only add responsavel_id if it's not the one causing the error
            if (!pRetryError.message?.includes('responsavel_id')) {
              absoluteMinimum.responsavel_id = guardianId;
            } else if (!pRetryError.message?.includes('guardian_id')) {
              absoluteMinimum.guardian_id = guardianId;
            }

            const { data: pFinalData, error: pFinalError } = await supabase
              .from('pagamentos')
              .insert([absoluteMinimum])
              .select();
            
            if (pFinalData && pFinalData.length > 0) {
              firstPaymentId = pFinalData[0].id;
            }
            
            if (pFinalError) {
              console.error("Final payment insertion failed:", pFinalError.message);
              // Last ditch effort: just log it and continue, don't crash the whole enrollment
              console.error("CRITICAL: Could not record payment in database.");
            }
            console.error("--- PAYMENT RETRY ERROR END ---");
          }
        } else {
          // For other errors, we might want to throw or just log
          console.error("Non-column error in payment insertion:", pError);
        }
      }

      // 5. Record Coupon Usage
      if (couponId) {
        await supabase
          .from('cupons_usos')
          .insert([{
            cupom_id: couponId,
            responsavel_id: guardianId
          }]);
        
        // Increment usage count
        const { data: currentCoupon } = await supabase
          .from('cupons')
          .select('usos_atuais')
          .eq('id', couponId)
          .single();
        
        await supabase
          .from('cupons')
          .update({ usos_atuais: (currentCoupon?.usos_atuais || 0) + 1 })
          .eq('id', couponId);
      }

      let paymentInfo = null;
      if (valorCobrado > 0) {
        const isBernoulli = (student.unidade || "").includes("Bernoulli");
        const softDescriptorKey = isBernoulli ? 'pagarme_soft_descriptor_bernoulli' : 'pagarme_soft_descriptor';
        const defaultSoftDescriptor = isBernoulli ? 'BernoulliMais' : 'SportForKids';
        const softDescriptor = await getSetting(softDescriptorKey, defaultSoftDescriptor);
        
        try {
          if (paymentMethod === 'pix' || (paymentMethod === 'credit_card' && req.body.card)) {
            const today = new Date();
            const isBeforeStart = inicioAulas && today < inicioAulas;
            const needsSplit = (isBeforeStart || paymentMethod === 'pix') && installments.length > 1;
            
            if (needsSplit) {
              console.log(`[Pagar.me] Split detectado (PIX ou Matrícula Antecipada). Cobrando matrícula hoje e agendando assinatura para ${installments[1].data_vencimento}`);
              
              // 1. Cobra a Matrícula como um Pedido Avulso (Order)
              const order = await createPagarmeOrder({
                customer: {
                  name: guardian.name,
                  email: guardian.email,
                  cpf: guardian.cpf,
                  phone: guardian.phone,
                  address: guardian.address
                },
                card: req.body.card,
                amount: Math.round(valorCobrado * 100),
                paymentMethod: paymentMethod,
                description: `Matrícula - ${student.name} (${student.turmaComplementar})`,
                code: firstPaymentId ? `${firstPaymentId}_r_${Date.now()}` : `enroll_${Date.now()}`,
                softDescriptor,
                ip: clientIp,
                franquia: req.body.franquia
              });

              if (order.status === 'failed' || order.status === 'canceled' || order.status === 'cancelado') {
                throw new Error("Pagamento inicial não autorizado pelo gateway ou dados inválidos.");
              }
              
              // 2. Cria a Assinatura agendada para o início das aulas + 1 mês
              const subscription = await createPagarmeSubscription({
                customer: {
                  name: guardian.name,
                  email: guardian.email,
                  cpf: guardian.cpf,
                  phone: guardian.phone,
                  address: guardian.address
                },
                card: req.body.card,
                paymentMethod: paymentMethod,
                amount: Math.round(valorCobrado * 100),
                description: `Mensalidade - ${student.name} (${student.turmaComplementar})`,
                code: firstPaymentId ? `${firstPaymentId}_s_${Date.now()}` : `sub_${Date.now()}`,
                cycles: installments.length - 1,
                start_at: new Date(installments[1].data_vencimento + "T12:00:00Z").toISOString(),
                softDescriptor,
                ip: clientIp,
                franquia: req.body.franquia
              });

              if (subscription.status === 'failed' || subscription.status === 'canceled' || subscription.status === 'cancelado') {
                throw new Error("Pagamento da assinatura não autorizado pelo gateway ou dados inválidos.");
              }
              
              paymentInfo = { order, subscription };
              console.log("Pagar.me order and scheduled subscription created successfully");
              
              // Salva o ID da assinatura na matrícula
              if (subscription && subscription.id && matriculaId) {
                await supabase
                  .from('matriculas')
                  .update({ pagarme_subscription_id: subscription.id })
                  .eq('id', matriculaId)
                  .then(({ error }) => {
                    if (error) console.log("Nota: Erro ao salvar ID da assinatura na matrícula.");
                  });
              }

              // Salva o ID do pedido no primeiro pagamento
              if (order && order.id && firstPaymentId) {
                await supabase
                  .from('pagamentos')
                  .update({ pagarme: order.id })
                  .eq('id', firstPaymentId);
              }
            } else if (paymentMethod === 'pix' && installments.length === 1) {
              // Apenas um pedido avulso PIX
              console.log(`[Pagar.me] Criando pedido PIX único para ${guardian.name}, valor: ${valorCobrado}`);
              const order = await createPagarmeOrder({
                customer: {
                  name: guardian.name,
                  email: guardian.email,
                  cpf: guardian.cpf,
                  phone: guardian.phone,
                  address: guardian.address
                },
                amount: Math.round(valorCobrado * 100), // convert to cents
                paymentMethod: 'pix',
                description: `Matrícula - ${student.name} (${student.turmaComplementar})`,
                code: firstPaymentId ? `${firstPaymentId}_p_${Date.now()}` : `enroll_pix_${Date.now()}`,
                softDescriptor,
                ip: clientIp,
                franquia: req.body.franquia
              });

              if (order.status === 'failed' || order.status === 'canceled' || order.status === 'cancelado') {
                throw new Error("Pagamento PIX não autorizado pelo gateway ou dados inválidos.");
              }

              paymentInfo = order;
              console.log("Pagar.me PIX order created successfully:", order.id);
              
              // Salva o ID do pedido no primeiro pagamento
              if (order && order.id && firstPaymentId) {
                await supabase
                  .from('pagamentos')
                  .update({ pagarme: order.id })
                  .eq('id', firstPaymentId);
              }
            } else {
              // Fluxo padrão (Cartão iniciando hoje): Assinatura começa hoje
              console.log(`Creating Pagar.me subscription for ${guardian.name}, amount: ${valorCobrado}, method: ${paymentMethod}`);
              const subscription = await createPagarmeSubscription({
                customer: {
                  name: guardian.name,
                  email: guardian.email,
                  cpf: guardian.cpf,
                  phone: guardian.phone,
                  address: guardian.address
                },
                card: req.body.card,
                paymentMethod: paymentMethod,
                amount: Math.round(valorCobrado * 100), // convert to cents
                description: `Mensalidade - ${student.name} (${student.turmaComplementar})`,
                code: firstPaymentId ? `${firstPaymentId}_${Date.now()}` : `enroll_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
                cycles: installments.length,
                softDescriptor,
                ip: clientIp,
                franquia: req.body.franquia
              });

              if (subscription.status === 'failed' || subscription.status === 'canceled' || subscription.status === 'cancelado') {
                throw new Error("Pagamento da assinatura não autorizado pelo gateway ou dados inválidos.");
              }

              paymentInfo = subscription;
              console.log("Pagar.me subscription created successfully:", subscription.id);
              
              // Salva o ID da assinatura imediatamente no primeiro pagamento
              if (subscription && subscription.id && firstPaymentId) {
                await supabase
                  .from('pagamentos')
                  .update({ pagarme: subscription.id })
                  .eq('id', firstPaymentId);
              }
              
              // Também salva na matrícula
              if (subscription && subscription.id && matriculaId) {
                await supabase
                  .from('matriculas')
                  .update({ pagarme_subscription_id: subscription.id })
                  .eq('id', matriculaId)
                  .then(({ error }) => {
                    if (error) console.log("Nota: Erro ao salvar ID da assinatura na matrícula.");
                  });
              }
            }
          } else if (paymentMethod === 'credit_card') {
            // Se for cartão mas não tiver os dados do cartão
            console.warn("Pagamento via cartão selecionado mas dados do cartão ausentes.");
          }
        } catch (pError: any) {
          const apiError = pError.response?.data;
          console.error("Erro ao criar pedido Pagar.me:", JSON.stringify(apiError || pError.message, null, 2));
          
          // Se houver erros de validação específicos, logar cada um
          if (apiError && apiError.errors) {
            console.error("Erros de validação Pagar.me:");
            Object.keys(apiError.errors).forEach(key => {
              console.error(`- ${key}: ${apiError.errors[key].join(', ')}`);
            });
          }

          // Notificar responsável sobre a falha no pagamento
          const failureReason = apiError?.message || 
                               apiError?.errors?.[Object.keys(apiError.errors || {})[0]]?.[0] || 
                               pError.message || 
                               "Transação recusada pela operadora do cartão.";
          
          await sendPaymentFailureNotification(
            guardianId,
            student.name,
            student.turmaComplementar,
            failureReason,
            student.unidade,
            undefined
          );

          // We continue anyway, as the enrollment was successful in the DB
        }
      } else {
        console.log("Valor da matrícula é zero ou negativo, pulando criação de pedido no Pagar.me");
      }

      res.json({ success: true, guardianId: guardianId, paymentInfo });

    } catch (error: any) {
      const errObj = error instanceof Error ? { message: error.message, stack: error.stack, ...error } : error;
      console.error("Full Enrollment Error Context:", JSON.stringify(errObj, null, 2));
      res.status(400).json({ 
        error: error.message || "Erro desconhecido no banco de dados",
        details: error.details || error,
        hint: error.hint,
        code: error.code
      });
    }
  });

  app.post("/api/enroll/retry", async (req, res) => {
    const { enrollmentId, card } = req.body;
    const clientIp = (req.headers['x-forwarded-for'] as string || req.socket.remoteAddress || '').split(',')[0].trim();

    try {
      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];

      // 1. Fetch enrollment
      let { data: enrollment, error: eError } = await supabase
        .from('matriculas')
        .select('*')
        .eq('id', enrollmentId)
        .maybeSingle();

      // Fallback: If not found by ID, check if this ID was actually an aluno_id 
      if (!enrollment && !eError) {
        const { data: fallbackEnrollment } = await supabase
          .from('matriculas')
          .select('*')
          .eq('aluno_id', enrollmentId)
          .eq('status', 'pendente')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        
        if (fallbackEnrollment) {
          enrollment = fallbackEnrollment;
        }
      }

      if (eError || !enrollment) {
        console.error("Enrollment fetch error:", eError || "Not found");
        return res.status(404).json({ error: 'Matrícula não encontrada. Por favor, recarregue a página.' });
      }

      if (enrollment.status !== 'pendente' && enrollment.status !== 'falha') {
        return res.status(400).json({ error: 'Esta matrícula já está ativa ou foi cancelada.' });
      }

      // 2. Fetch student data separately
      const { data: student, error: sError } = await supabase
        .from('alunos')
        .select('*')
        .eq('id', enrollment.aluno_id)
        .single();

      if (sError || !student) {
        return res.status(404).json({ error: 'Dados do aluno não encontrados.' });
      }

      // 3. Fetch guardian data separately
      const { data: guardian, error: gError } = await supabase
        .from('responsaveis')
        .select('*')
        .eq('id', student.responsavel_id)
        .single();

      if (gError || !guardian) {
        return res.status(404).json({ error: 'Dados do responsável não encontrados.' });
      }

      // 2. Fetch installments that are not paid for this enrollment
      const { data: installments, error: pError } = await supabase
        .from('pagamentos')
        .select('*')
        .eq('matricula_id', enrollmentId)
        .neq('status', 'pago')
        .order('data_vencimento', { ascending: true });

      if (pError || !installments || installments.length === 0) {
        return res.status(400).json({ error: 'Não foram encontrados pagamentos em aberto para esta matrícula.' });
      }

      const valorCobrado = installments[0].valor;
      
      if (!valorCobrado || valorCobrado <= 0) {
        return res.status(400).json({ error: 'O valor da mensalidade não foi identificado. Por favor, entre em contato com o suporte.' });
      }

      const firstPaymentId = installments[0].id;

      // 3. Pagar.me Logic
      let inicioAulas: Date | null = null;
      let fimAulas: Date | null = null;
      let unitMapping: any = null;

      try {
        const unidadeNome = (enrollment.unidade || '').trim();
        
        const { data: mappings, error: mappingError } = await supabase
          .from('unidades_mapping')
          .select('inicio_aulas, fim_aulas, identidade, ano_letivo')
          .ilike('nome', unidadeNome)
          .gte('fim_aulas', todayStr)
          .order('inicio_aulas', { ascending: true });
        
        if (mappingError) {
          console.warn("Error fetching mapping with 'nome':", mappingError.message);
          const { data: fallbackMappings } = await supabase
            .from('unidades_mapping')
            .select('inicio_aulas, fim_aulas, identidade, ano_letivo')
            .ilike('nome_unidade', unidadeNome)
            .gte('fim_aulas', todayStr)
            .order('inicio_aulas', { ascending: true });
          
          if (fallbackMappings && fallbackMappings.length > 0) {
            unitMapping = fallbackMappings[0];
          }
        } else if (mappings && mappings.length > 0) {
          unitMapping = mappings[0];
        }
        
        if (!unitMapping && unidadeNome) {
          const { data: latestMappings } = await supabase
            .from('unidades_mapping')
            .select('inicio_aulas, fim_aulas, identidade, ano_letivo')
            .or(`nome.eq."${unidadeNome}",nome_unidade.eq."${unidadeNome}"`)
            .order('inicio_aulas', { ascending: false })
            .limit(1);
          
          if (latestMappings && latestMappings.length > 0) {
            unitMapping = latestMappings[0];
          }
        }
        
        if (unitMapping) {
          if (unitMapping.inicio_aulas) {
            const d = new Date(unitMapping.inicio_aulas);
            if (!isNaN(d.getTime())) inicioAulas = d;
          }
          if (unitMapping.fim_aulas) {
            const d = new Date(unitMapping.fim_aulas);
            if (!isNaN(d.getTime())) fimAulas = d;
          }
        }
      } catch (err) {
        console.warn("Erro ao processar unidades_mapping no retry:", err);
      }

      const virtualInstallmentDates: string[] = [];
      virtualInstallmentDates.push(todayStr);

      if (inicioAulas && fimAulas) {
        let baseDay = inicioAulas.getDate();
        if (today > inicioAulas) {
          baseDay = today.getDate();
        }
        if (baseDay === 31) {
          baseDay = 30;
        }

        let nextVencimento = new Date(today);
        if (nextVencimento < inicioAulas) {
          nextVencimento = new Date(inicioAulas);
        }

        nextVencimento.setDate(1);
        nextVencimento.setMonth(nextVencimento.getMonth() + 1);
        nextVencimento.setDate(baseDay);

        if (nextVencimento.getDate() !== baseDay) {
          nextVencimento.setDate(0);
        }

        while (nextVencimento <= fimAulas) {
          const diffTime = fimAulas.getTime() - nextVencimento.getTime();
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          if (diffDays <= 12) {
            break;
          }

          virtualInstallmentDates.push(nextVencimento.toISOString().split('T')[0]);

          nextVencimento = new Date(nextVencimento);
          nextVencimento.setDate(1);
          nextVencimento.setMonth(nextVencimento.getMonth() + 1);
          nextVencimento.setDate(baseDay);
          if (nextVencimento.getDate() !== baseDay) {
            nextVencimento.setDate(0);
          }
        }
      }

      const computedCycles = virtualInstallmentDates.length;

      const isBernoulli = (enrollment.unidade || "").includes("Bernoulli");
      const softDescriptorKey = isBernoulli ? 'pagarme_soft_descriptor_bernoulli' : 'pagarme_soft_descriptor';
      const defaultSoftDescriptor = isBernoulli ? 'BernoulliMais' : 'SportForKids';
      const softDescriptor = await getSetting(softDescriptorKey, defaultSoftDescriptor);

      let paymentInfo = null;
      
      // Map card data to Pagar.me helper format
      const pagarmeCard = {
        number: card.number,
        holderName: card.holder_name,
        expMonth: card.exp_month,
        expYear: card.exp_year,
        cvv: card.cvv,
        cpf: card.cpf
      };

      // Determine if we need split (scheduled subscription)
      const firstDueDate = installments[0].data_vencimento;
      const isBeforeStart = firstDueDate && todayStr < firstDueDate;
      const needsSplit = isBeforeStart && computedCycles > 1;

      if (needsSplit) {
        console.log(`[Retry] Split detectado. Cobrando matrícula hoje e agendando assinatura para ${virtualInstallmentDates[1]}`);
        
        // 1. Cobra a Matrícula como um Pedido Avulso (Order)
        const order = await createPagarmeOrder({
          customer: {
            name: guardian.nome_completo,
            email: guardian.email,
            cpf: guardian.cpf,
            phone: guardian.telefone,
            address: guardian.endereco
          },
          card: pagarmeCard,
          amount: Math.round(valorCobrado * 100),
          paymentMethod: 'credit_card',
          description: `Matrícula - ${student.nome_completo} (${enrollment.turma})`,
          code: `${firstPaymentId}_r_${Date.now()}`,
          softDescriptor,
          ip: clientIp,
          franquia: req.body.franquia
        });
        
        // 2. Cria a Assinatura agendada
        const subscription = await createPagarmeSubscription({
          customer: {
            name: guardian.nome_completo,
            email: guardian.email,
            cpf: guardian.cpf,
            phone: guardian.telefone,
            address: guardian.endereco
          },
          card: pagarmeCard,
          paymentMethod: 'credit_card',
          amount: Math.round(valorCobrado * 100),
          description: `Mensalidade - ${student.nome_completo} (${enrollment.turma})`,
          code: `${firstPaymentId}_z_${Date.now()}`,
          cycles: computedCycles - 1,
          start_at: new Date(virtualInstallmentDates[1] + "T12:00:00Z").toISOString(),
          softDescriptor,
          ip: clientIp,
          franquia: req.body.franquia
        });
        
        paymentInfo = { order, subscription };

        // Check if order was paid immediately
        const isOrderPaid = order.status === 'paid';
        
        // Update enrollment and payment
        // We update to 'ativo' if the order was paid, otherwise keep 'pendente' (webhook will update later)
        if (isOrderPaid) {
          await supabase.from('matriculas').update({ 
            pagarme_subscription_id: subscription.id, 
            status: 'ativo',
            data_matricula: new Date().toISOString()
          }).eq('id', enrollmentId);
          
          await supabase.from('pagamentos').update({ 
            pagarme: order.id, 
            status: 'pago',
            data_pagamento: new Date().toISOString()
          }).eq('id', firstPaymentId);
        } else {
          // Just link the IDs so webhook can find them
          await supabase.from('matriculas').update({ pagarme_subscription_id: subscription.id }).eq('id', enrollmentId);
          await supabase.from('pagamentos').update({ pagarme: order.id }).eq('id', firstPaymentId);
        }

      } else {
        // Fluxo padrão: Assinatura começa hoje
        console.log(`[Retry] Criando assinatura iniciando hoje para ${guardian.nome_completo}`);
        const subscription = await createPagarmeSubscription({
          customer: {
            name: guardian.nome_completo,
            email: guardian.email,
            cpf: guardian.cpf,
            phone: guardian.telefone,
            address: guardian.endereco
          },
          card: pagarmeCard,
          paymentMethod: 'credit_card',
          amount: Math.round(valorCobrado * 100),
          description: `Mensalidade - ${student.nome_completo} (${enrollment.turma})`,
          code: `${firstPaymentId}_r_${Date.now()}`,
          cycles: computedCycles,
          softDescriptor,
          ip: clientIp,
          franquia: req.body.franquia
        });
        
        paymentInfo = subscription;

        // Check if subscription is active (first charge successful)
        const isSubActive = subscription.status === 'active';

        // Update enrollment and payment
        if (isSubActive) {
          await supabase.from('matriculas').update({ 
            pagarme_subscription_id: subscription.id, 
            status: 'ativo',
            data_matricula: new Date().toISOString()
          }).eq('id', enrollmentId);
          
          await supabase.from('pagamentos').update({ 
            pagarme: subscription.id, 
            status: 'pago',
            data_pagamento: new Date().toISOString()
          }).eq('id', firstPaymentId);
        } else {
          await supabase.from('matriculas').update({ pagarme_subscription_id: subscription.id }).eq('id', enrollmentId);
          await supabase.from('pagamentos').update({ pagarme: subscription.id }).eq('id', firstPaymentId);
        }
      }

      res.json({ success: true, paymentInfo });

    } catch (error: any) {
      const apiError = error.response?.data;
      console.error("Erro ao retentar pagamento:", JSON.stringify(apiError || error.message, null, 2));
      res.status(400).json({ 
        error: apiError?.message || error.message || "Erro ao processar pagamento.",
        details: apiError?.errors
      });
    }
  });

  app.get("/api/payments/:guardianId", async (req, res) => {
    const { guardianId } = req.params;
    try {
      const { data, error } = await supabase
        .from('pagamentos')
        .select('*')
        .eq('responsavel_id', guardianId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      res.json(data || []);
    } catch (error: any) {
      console.error("Error fetching payments:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/payments/cancel/:id", async (req, res) => {
    try {
      const { id } = req.params;
      console.log(`[Cancelamento] Iniciando cancelamento do pagamento ${id}`);

      // 1. Buscar pagamento no Supabase
      const { data: payment, error: pError } = await supabase
        .from('pagamentos')
        .select('*')
        .eq('id', id)
        .single();

      if (pError || !payment) {
        return res.status(404).json({ error: 'Pagamento não encontrado.' });
      }

      if (payment.status === 'pago') {
        return res.status(400).json({ error: 'Pagamentos já quitados devem ser estornados, não cancelados.' });
      }

      if (payment.status === 'cancelado') {
        return res.status(400).json({ error: 'Este pagamento já está cancelado.' });
      }

      // 2. Tentar cancelar no Pagar.me se houver ID
      if (payment.pagarme) {
        const authHeader = Buffer.from(`${getPagarmeSecretKey()}:`).toString('base64');
        
        try {
          if (payment.pagarme.startsWith('ord_')) {
            // Cancelar Pedido
            await axios.patch(`https://api.pagar.me/core/v5/orders/${payment.pagarme}/closed`, 
              { status: 'canceled' },
              {
                headers: {
                  'Authorization': `Basic ${authHeader}`,
                  'Content-Type': 'application/json'
                }
              }
            );
            console.log(`[Cancelamento] Pedido ${payment.pagarme} cancelado no Pagar.me`);
          } else if (payment.pagarme.startsWith('sub_')) {
            console.log(`[Cancelamento] Pagamento vinculado à assinatura ${payment.pagarme}. Cancelando apenas localmente.`);
          }
        } catch (err: any) {
          console.error(`[Cancelamento] Erro ao cancelar no Pagar.me:`, err.response?.data || err.message);
        }
      }

      // 3. Atualizar status no Supabase
      const { error: updateError } = await supabase
        .from('pagamentos')
        .update({ status: 'cancelado' })
        .eq('id', id);

      if (updateError) throw updateError;

      res.json({ success: true, message: 'Pagamento cancelado com sucesso.' });
    } catch (error: any) {
      console.error(`[Cancelamento] Erro crítico:`, error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/payments/refund/:id", async (req, res) => {
    const { id } = req.params;
    const { amount } = req.body;
    console.log(`[Estorno] Iniciando estorno do pagamento ${id}`);

    try {
      // 1. Buscar pagamento no Supabase (em todas as tabelas possíveis)
      let payment = null;
      let table = 'pagamentos';

      // Tenta na tabela principal
      const { data: pData } = await supabase.from('pagamentos').select('*').eq('id', id).maybeSingle();
      if (pData) {
        payment = pData;
        table = 'pagamentos';
      } else {
        // Tenta na tabela Wix
        const { data: wData } = await supabase.from('pagamentos_wix').select('*').eq('id', id).maybeSingle();
        if (wData) {
          payment = wData;
          table = 'pagamentos_wix';
        } else {
          // Tenta na tabela PagSeguro
          const { data: psData } = await supabase.from('pagamentos_pagseguro').select('*').eq('id', id).maybeSingle();
          if (psData) {
            payment = psData;
            table = 'pagamentos_pagseguro';
          }
        }
      }

      if (!payment) {
        console.error(`[Estorno] Pagamento ${id} não encontrado em nenhuma tabela.`);
        return res.status(404).json({ error: 'Pagamento não encontrado.' });
      }

      console.log(`[Estorno] Pagamento encontrado na tabela ${table}. Status atual: ${payment.status || payment.status_transacao}`);

      // Se for um pagamento externo (Wix ou PagSeguro), apenas atualizamos o status localmente
      if (table !== 'pagamentos') {
        console.log(`[Estorno] Pagamento externo detectado (${table}). Atualizando apenas status local.`);
        const updatePayload: any = {};
        if (table === 'pagamentos_wix') {
          updatePayload.status_transacao = 'Estornado';
        } else {
          updatePayload.status = 'Estornado';
        }

        const { error: updateError } = await supabase
          .from(table)
          .update(updatePayload)
          .eq('id', id);

        if (updateError) throw updateError;
        return res.json({ success: true, message: 'Status atualizado para estornado (registro externo).' });
      }

      // Para a tabela 'pagamentos', verificamos se é Pagar.me
      if (payment.status !== 'pago' && payment.status !== 'conciliado') {
        return res.status(400).json({ error: 'Apenas pagamentos com status "pago" podem ser estornados.' });
      }

      // NOVO: Se o método for Wix ou PagSeguro, mesmo na tabela 'pagamentos', tratamos como externo
      const metodo = (payment.metodo_pagamento || '').toLowerCase();
      if (metodo === 'wix' || metodo === 'pagseguro') {
        console.log(`[Estorno] Pagamento externo detectado pelo método (${metodo}). Atualizando apenas status local.`);
        const { error: updateError } = await supabase
          .from('pagamentos')
          .update({ status: 'estornado' })
          .eq('id', id);
        if (updateError) throw updateError;
        return res.json({ success: true, message: 'Status atualizado para estornado (registro externo identificado pelo método).' });
      }

      if (!payment.pagarme) {
        // Se não tem ID do Pagar.me, mas está pago, permitimos estorno manual (apenas status)
        console.log(`[Estorno] Pagamento sem ID Pagar.me. Realizando estorno manual.`);
        const { error: updateError } = await supabase
          .from('pagamentos')
          .update({ status: 'estornado' })
          .eq('id', id);
        if (updateError) throw updateError;
        return res.json({ success: true, message: 'Estorno manual realizado com sucesso (sem integração Pagar.me).' });
      }

      console.log(`[Estorno] Pagamento ${id} vinculado ao ID Pagar.me: ${payment.pagarme}`);
      const authHeader = Buffer.from(`${getPagarmeSecretKey()}:`).toString('base64');
      let chargeId = null;

      // 2. Obter o ID da transação (charge_id)
      try {
        if (payment.pagarme.startsWith('ch_')) {
          chargeId = payment.pagarme;
        } else if (payment.pagarme.startsWith('ord_') || payment.pagarme.startsWith('or_')) {
          console.log(`[Estorno] Buscando pedido ${payment.pagarme} no Pagar.me`);
          try {
            const orderRes = await axios.get(`https://api.pagar.me/core/v5/orders/${payment.pagarme}`, {
              headers: { 'Authorization': `Basic ${authHeader}` },
              timeout: 15000
            });
            const charges = orderRes.data.charges;
            if (charges && charges.length > 0) {
              chargeId = charges[0].id;
              console.log(`[Estorno] ChargeId encontrado no pedido: ${chargeId}`);
            }
          } catch (e: any) {
            if (e.response?.status === 404) {
              console.log(`[Estorno] Pedido ${payment.pagarme} não encontrado.`);
              // Deixa chargeId como null para tentar busca por code ou fallback local
            } else throw e;
          }
        } else if (payment.pagarme.startsWith('sub_')) {
          console.log(`[Estorno] Buscando faturas da assinatura ${payment.pagarme} no Pagar.me`);
          try {
            const subRes = await axios.get(`https://api.pagar.me/core/v5/subscriptions/${payment.pagarme}/invoices`, {
              headers: { 'Authorization': `Basic ${authHeader}` },
              timeout: 15000
            });
            const invoices = subRes.data.data;
            if (invoices && invoices.length > 0) {
              const amountInCents = Math.round(payment.valor * 100);
              let paidInvoice = invoices.find((inv: any) => 
                inv.status === 'paid' && 
                Math.abs(inv.amount - amountInCents) < 10
              );
              if (!paidInvoice) paidInvoice = invoices.find((inv: any) => inv.status === 'paid');
              if (paidInvoice && paidInvoice.charge) {
                chargeId = paidInvoice.charge.id;
                console.log(`[Estorno] ChargeId encontrado na fatura da assinatura: ${chargeId}`);
              }
            }
          } catch (e: any) {
            if (e.response?.status === 404) {
              console.log(`[Estorno] Assinatura ${payment.pagarme} não encontrada.`);
            } else throw e;
          }
        } else if (payment.pagarme.startsWith('in_')) {
          console.log(`[Estorno] Buscando fatura ${payment.pagarme} no Pagar.me`);
          try {
            const invRes = await axios.get(`https://api.pagar.me/core/v5/invoices/${payment.pagarme}`, {
              headers: { 'Authorization': `Basic ${authHeader}` },
              timeout: 15000
            });
            if (invRes.data.charge) {
              chargeId = invRes.data.charge.id;
              console.log(`[Estorno] ChargeId encontrado na fatura: ${chargeId}`);
            }
          } catch (e: any) {
            if (e.response?.status === 404) {
              console.log(`[Estorno] Fatura ${payment.pagarme} não encontrada.`);
            } else throw e;
          }
        } else if (/^\d+$/.test(payment.pagarme)) {
          chargeId = payment.pagarme;
        } else {
          // Se não tem prefixo conhecido e não é numérico, tenta usar como chargeId diretamente
          // O fallback de 404 no refund vai tratar se isso falhar
          chargeId = payment.pagarme;
        }

        // Busca por code se ainda não encontrou chargeId
        if (!chargeId) {
          console.log(`[Estorno] ChargeId não encontrado. Tentando buscar pedido pelo code: ${id}`);
          try {
            const searchRes = await axios.get(`https://api.pagar.me/core/v5/orders?code=${id}`, {
              headers: { 'Authorization': `Basic ${authHeader}` },
              timeout: 15000
            });
            if (searchRes.data.data && searchRes.data.data.length > 0) {
              const order = searchRes.data.data[0];
              if (order.charges && order.charges.length > 0) {
                chargeId = order.charges[0].id;
                console.log(`[Estorno] ChargeId encontrado via busca por code: ${chargeId}`);
              }
            }
          } catch (e: any) {
            console.error(`[Estorno] Erro ao buscar pedido por code:`, e.message);
          }
        }
      } catch (err: any) {
        console.error(`[Estorno] Erro ao buscar dados no Pagar.me:`, err.response?.data || err.message);
        return res.status(500).json({ error: 'Não foi possível localizar a transação no Pagar.me para estorno.' });
      }

      if (!chargeId) {
        console.warn(`[Estorno] Nenhum chargeId encontrado para o pagamento ${id} após todas as tentativas.`);
        // Se chegamos aqui e temos um ID Pagar.me que resultou em 404 ou falha de busca, permitimos estorno local
        console.log(`[Estorno] Realizando estorno local como fallback para evitar bloqueio.`);
        const { error: updateError } = await supabase
          .from('pagamentos')
          .update({ status: 'estornado' })
          .eq('id', id);
        if (updateError) throw updateError;
        return res.json({ success: true, message: 'Estorno realizado localmente (transação não localizada no Pagar.me).' });
      }

      // 3. Realizar o estorno no Pagar.me
      try {
        const refundPayload: any = {};
        if (amount) {
          refundPayload.amount = Math.round(amount * 100);
        }

        console.log(`[Estorno] Enviando solicitação de estorno para charge ${chargeId}`, refundPayload);
        // Tenta refund padrão com DELETE
        try {
          await axios.delete(`https://api.pagar.me/core/v5/charges/${chargeId}`, 
            {
              headers: {
                'Authorization': `Basic ${authHeader}`,
                'Content-Type': 'application/json'
              },
              data: Object.keys(refundPayload).length > 0 ? refundPayload : undefined,
              timeout: 15000
            }
          );
        } catch (refundErr: any) {
          // Se for 404, não adianta tentar confirm-refund, vamos direto para o fallback local
          if (refundErr.response?.status === 404) {
            throw refundErr; // Será pego pelo catch externo que fará o fallback local
          }

          console.warn(`[Estorno] Tentativa de refund falhou com erro: ${refundErr.response?.data?.message || refundErr.message}.`);
          throw refundErr; // Na v5 não existe confirm-refund de charge, falhamos direto se deu erro
        }

        console.log(`[Estorno] Charge ${chargeId} estornada com sucesso no Pagar.me`);
      } catch (err: any) {
        console.error(`[Estorno] Erro ao processar estorno no Pagar.me:`, err.response?.data || err.message);
        
        // Fallback local se for 404 (transação não encontrada no Pagar.me)
        if (err.response?.status === 404) {
          console.warn(`[Estorno] Pagar.me retornou 404 para a charge ${chargeId}. Realizando estorno apenas local.`);
          const { error: updateError } = await supabase
            .from('pagamentos')
            .update({ status: 'estornado' })
            .eq('id', id);
          if (updateError) throw updateError;
          return res.json({ success: true, message: 'Estorno realizado localmente (transação não encontrada no Pagar.me).' });
        }

        const pagarmeError = err.response?.data?.message || err.message;
        return res.status(500).json({ error: `Erro no Pagar.me: ${pagarmeError}` });
      }

      // 4. Atualizar status no Supabase
      const { error: updateError } = await supabase
        .from('pagamentos')
        .update({ status: 'estornado' })
        .eq('id', id);

      if (updateError) throw updateError;

      res.json({ success: true, message: 'Estorno realizado com sucesso.' });
    } catch (error: any) {
      console.error(`[Estorno] Erro crítico:`, error);
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/payments/update-value/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { newValue, updateFutureInstallments } = req.body;

      if (newValue === undefined || isNaN(newValue) || newValue <= 0) {
        return res.status(400).json({ error: 'Valor inválido.' });
      }

      // 1. Buscar pagamento no Supabase
      const { data: payment, error: pError } = await supabase
        .from('pagamentos')
        .select('*')
        .eq('id', id)
        .single();

      if (pError || !payment) {
        return res.status(404).json({ error: 'Pagamento não encontrado.' });
      }

      if (payment.status === 'pago' && !updateFutureInstallments) {
        return res.status(400).json({ error: 'Não é possível alterar o valor de um pagamento já quitado.' });
      }

      // Atualizar o pagamento específico que foi clicado
      const { error: updateError } = await supabase
        .from('pagamentos')
        .update({ valor: newValue })
        .eq('id', id);

      if (updateError) throw updateError;

      // 2. Se for para atualizar parcelas futuras de uma assinatura
      if (updateFutureInstallments && payment.matricula_id) {
        // Buscar a matrícula para pegar o ID da assinatura
        const { data: matricula, error: mError } = await supabase
          .from('matriculas')
          .select('pagarme_subscription_id')
          .eq('id', payment.matricula_id)
          .single();

        if (matricula?.pagarme_subscription_id) {
          const subId = matricula.pagarme_subscription_id;
          const authHeader = Buffer.from(`${getPagarmeSecretKey()}:`).toString('base64');

          try {
            // Buscar assinatura para pegar o ID do item
            const subRes = await axios.get(`https://api.pagar.me/core/v5/subscriptions/${subId}`, {
              headers: { 'Authorization': `Basic ${authHeader}` }
            });

            const itemId = subRes.data.items?.[0]?.id;
            if (itemId) {
              // Atualizar o valor do item na assinatura
              await axios.patch(`https://api.pagar.me/core/v5/subscriptions/${subId}/items/${itemId}`, 
                {
                  pricing_scheme: {
                    scheme_type: "unit",
                    price: Math.round(newValue * 100)
                  }
                },
                {
                  headers: {
                    'Authorization': `Basic ${authHeader}`,
                    'Content-Type': 'application/json'
                  }
                }
              );
              console.log(`[Pagar.me] Assinatura ${subId} atualizada para novo valor: ${newValue}`);
            }
          } catch (err: any) {
            console.error(`[Pagar.me] Erro ao atualizar assinatura:`, err.response?.data || err.message);
            // Mesmo que falhe no Pagar.me, podemos continuar atualizando localmente se o usuário desejar, 
            // mas é melhor avisar.
          }
        }

        // Atualizar todos os pagamentos pendentes desta matrícula (excluindo o atual que já foi atualizado)
        const { error: bulkUpdateError } = await supabase
          .from('pagamentos')
          .update({ valor: newValue })
          .eq('matricula_id', payment.matricula_id)
          .eq('status', 'pendente')
          .neq('id', id);

        if (bulkUpdateError) throw bulkUpdateError;
      }

      let message = 'Valor atualizado com sucesso.';
      if (updateFutureInstallments && payment.matricula_id) {
        message = 'Valor atualizado com sucesso neste pagamento, nas parcelas futuras e na assinatura do Pagar.me.';
      }

      res.json({ success: true, message });
    } catch (error: any) {
      console.error(`[UpdateValue] Erro crítico:`, error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/options", async (req, res) => {
    try {
      let turmasData: any[] = [];
      const [series, unidades, turmasQuery, matriculas, professores, parceiros, turmaUnidades] = await Promise.all([
        supabase.from('series_anos').select('nome').order('ordem'),
        supabase.from('unidades').select('*').order('nome'),
        supabase.from('turmas').select('*').order('ordem', { ascending: true }).order('nome', { ascending: true }),
        supabase.from('matriculas').select('turma, unidade').in('status', ['ativo', 'Ativo']),
        supabase.from('professores').select('*').order('nome'),
        supabase.from('parceiros').select('*').order('nome'),
        supabase.from('turma_unidades').select('*')
      ]);

      if (turmasQuery.error) {
        console.error("Error fetching turmas sorted by ordem, trying by name:", turmasQuery.error);
        const retryQuery = await supabase.from('turmas').select('*').order('nome', { ascending: true });
        if (retryQuery.error) {
          console.error("Error fetching turmas sorted by name:", retryQuery.error);
        } else {
          turmasData = retryQuery.data || [];
        }
      } else {
        turmasData = turmasQuery.data || [];
      }

      console.log(`Fetched ${turmasData.length} turmas from turmas`);
      if (turmasData.length > 0) {
        console.log("Sample turma:", turmasData[0]);
      }

      // Count active enrollments per class and unit
      const occupancyMap: { [key: string]: number } = {};
      matriculas.data?.forEach(m => {
        if (m.turma && m.unidade) {
          const key = `${m.unidade}|${m.turma}`;
          occupancyMap[key] = (occupancyMap[key] || 0) + 1;
        }
      });

      // Map units to classes
      const turmaUnidadesMap: Record<string, string[]> = {};
      if (turmaUnidades.data && unidades.data) {
        turmaUnidades.data.forEach(tu => {
          const unidadeObj = unidades.data.find(u => String(u.id) === String(tu.unidade_id));
          if (!turmaUnidadesMap[tu.turma_id]) turmaUnidadesMap[tu.turma_id] = [];
          if (unidadeObj) turmaUnidadesMap[tu.turma_id].push(unidadeObj.nome);
        });
      }

      res.json({
        series: series.data?.map(s => s.nome) || [],
        unidades: unidades.data || [],
        turmas: turmasData.filter(t => 
          !['Voleibol 4', 'Voleibol 5', 'Voleibol 6', 'Ginástica Rítmica 3', 'Jazz Dance 2'].includes(t.nome)
        ).map(t => {
          const u_selecionadas = turmaUnidadesMap[t.id] || (t.unidade_nome ? [t.unidade_nome] : []);
          return {
            ...t,
            unidades_selecionadas: u_selecionadas,
            status: t.ativa === false ? 'inativo' : 'ativo',
            ocupacao_atual: u_selecionadas.reduce((acc, unitName) => acc + (occupancyMap[`${unitName}|${t.nome}`] || 0), 0)
          };
        }) || [],
        professores: professores.data || [],
        parceiros: parceiros.data || []
      });
    } catch (error: any) {

      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/options/turmas/reorder", async (req, res) => {
    try {
      const { orders } = req.body;
      if (!Array.isArray(orders)) {
        return res.status(400).json({ error: "Invalid payload: orders must be an array" });
      }

      console.log(`Reordering ${orders.length} turmas...`);
      const promises = orders.map(o => 
        supabase.from('turmas').update({ ordem: o.ordem }).eq('id', o.id)
      );
      await Promise.all(promises);

      res.json({ success: true });
    } catch (error: any) {
      console.error("Error reordering turmas:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/options/:type", async (req, res) => {
    const { type } = req.params;
    const { 
      nome, 
      ordem, 
      unidade_nome, 
      unidades_selecionadas,
      series_permitidas,
      idade_minima,
      idade_maxima,
      dias_horarios,
      valor_mensalidade,
      capacidade,
      local_aula,
      data_inicio,
      professor,
      status,
      logo_url,
      imagem_url,
      slug,
      parceria,
      logo_parceiro_url,
      descricao,
      foto_professor_url,
      professor_id,
      parceiro_id,
      access_type
    } = req.body;

    let table = '';
    if (type === 'series') table = 'series_anos';
    else if (type === 'unidades') table = 'unidades';
    else if (type === 'turmas') table = 'turmas';
    else return res.status(400).json({ error: 'Invalid type' });

    try {
      const insertData: any = { 
        nome, 
        ...(ordem !== undefined ? { ordem } : {}),
        ...(unidade_nome !== undefined ? { unidade_nome } : {}),
        ...(series_permitidas !== undefined ? { series_permitidas } : {}),
        ...(idade_minima !== undefined ? { idade_minima } : {}),
        ...(idade_maxima !== undefined ? { idade_maxima } : {}),
        ...(dias_horarios !== undefined ? { dias_horarios } : {}),
        ...(valor_mensalidade !== undefined ? { valor_mensalidade } : {}),
        ...(capacidade !== undefined ? { capacidade } : {}),
        ...(local_aula !== undefined ? { local_aula } : {}),
        ...(data_inicio !== undefined ? { data_inicio } : {}),
        ...(professor !== undefined ? { professor } : {}),
        ...(logo_url !== undefined ? { logo_url } : {}),
        ...(imagem_url !== undefined ? { imagem_url } : {}),
        ...(slug !== undefined ? { slug } : {}),
        ...(parceria !== undefined ? { parceria } : {}),
        ...(logo_parceiro_url !== undefined ? { logo_parceiro_url } : {}),
        ...(descricao !== undefined ? { descricao } : {}),
        ...(foto_professor_url !== undefined ? { foto_professor_url } : {}),
        ...(professor_id !== undefined ? { professor_id: professor_id || null } : {}),
        ...(parceiro_id !== undefined ? { parceiro_id: parceiro_id || null } : {}),
        ...(access_type !== undefined ? { access_type } : {})
      };

      if (status !== undefined) {
        if (type === 'turmas') {
          insertData.ativa = (status === 'ativo');
        } else {
          insertData.status = status;
        }
      }

      const { data, error } = await supabase
        .from(table)
        .insert([insertData])
        .select();
      if (error) throw error;
      
      const newOption = data[0];

      if (type === 'turmas' && Array.isArray(unidades_selecionadas) && unidades_selecionadas.length > 0) {
        const { data: unidadesData } = await supabase.from('unidades').select('id, nome').in('nome', unidades_selecionadas);
        if (unidadesData && unidadesData.length > 0) {
          const turmaUnidadesInserts = unidadesData.map(u => ({
            turma_id: newOption.id,
            unidade_id: u.id
          }));
          await supabase.from('turma_unidades').insert(turmaUnidadesInserts);
        }
      }

      res.json(newOption);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.put("/api/options/:type/:oldNome", async (req, res) => {
    const { type, oldNome } = req.params;
    const { 
      nome, 
      ordem, 
      unidade_nome, 
      unidades_selecionadas,
      series_permitidas,
      idade_minima,
      idade_maxima,
      dias_horarios,
      valor_mensalidade,
      capacidade,
      local_aula,
      data_inicio,
      professor,
      status,
      logo_url,
      imagem_url,
      slug,
      parceria,
      logo_parceiro_url,
      descricao,
      foto_professor_url,
      professor_id,
      parceiro_id,
      access_type
    } = req.body;

    let table = '';
    if (type === 'series') table = 'series_anos';
    else if (type === 'unidades') table = 'unidades';
    else if (type === 'turmas') table = 'turmas';
    else return res.status(400).json({ error: 'Invalid type' });

    try {
      const updateData: any = { 
        nome, 
        ...(ordem !== undefined ? { ordem } : {}),
        ...(unidade_nome !== undefined ? { unidade_nome } : {}),
        ...(series_permitidas !== undefined ? { series_permitidas } : {}),
        ...(idade_minima !== undefined ? { idade_minima } : {}),
        ...(idade_maxima !== undefined ? { idade_maxima } : {}),
        ...(dias_horarios !== undefined ? { dias_horarios } : {}),
        ...(valor_mensalidade !== undefined ? { valor_mensalidade } : {}),
        ...(capacidade !== undefined ? { capacidade } : {}),
        ...(local_aula !== undefined ? { local_aula } : {}),
        ...(data_inicio !== undefined ? { data_inicio } : {}),
        ...(professor !== undefined ? { professor } : {}),
        ...(logo_url !== undefined ? { logo_url } : {}),
        ...(imagem_url !== undefined ? { imagem_url } : {}),
        ...(slug !== undefined ? { slug } : {}),
        ...(parceria !== undefined ? { parceria } : {}),
        ...(logo_parceiro_url !== undefined ? { logo_parceiro_url } : {}),
        ...(descricao !== undefined ? { descricao } : {}),
        ...(foto_professor_url !== undefined ? { foto_professor_url } : {}),
        ...(professor_id !== undefined ? { professor_id: professor_id || null } : {}),
        ...(parceiro_id !== undefined ? { parceiro_id: parceiro_id || null } : {}),
        ...(access_type !== undefined ? { access_type } : {})
      };

      if (status !== undefined) {
        if (type === 'turmas') {
          updateData.ativa = (status === 'ativo');
        } else {
          updateData.status = status;
        }
      }

      const { data, error } = await supabase
        .from(table)
        .update(updateData)
        .eq('nome', decodeURIComponent(oldNome))
        .select();

      if (error) throw error;
      const updatedOption = data[0];

      if (type === 'turmas' && Array.isArray(unidades_selecionadas)) {
        await supabase.from('turma_unidades').delete().eq('turma_id', updatedOption.id);
        
        if (unidades_selecionadas.length > 0) {
          const { data: unidadesData } = await supabase.from('unidades').select('id, nome').in('nome', unidades_selecionadas);
          if (unidadesData && unidadesData.length > 0) {
            const turmaUnidadesInserts = unidadesData.map(u => ({
              turma_id: updatedOption.id,
              unidade_id: u.id
            }));
            await supabase.from('turma_unidades').insert(turmaUnidadesInserts);
          }
        }
      }

      res.json(updatedOption);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });


  app.delete("/api/options/:type/:nome", async (req, res) => {
    const { type, nome } = req.params;

    let table = '';
    if (type === 'series') table = 'series_anos';
    else if (type === 'unidades') table = 'unidades';
    else if (type === 'turmas') table = 'turmas';
    else return res.status(400).json({ error: 'Invalid type' });

    try {
      const { error } = await supabase
        .from(table)
        .delete()
        .eq('nome', nome);

      if (error) throw error;
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // CRUD - Professores
  app.get("/api/professores", async (req, res) => {
    try {
      const { data, error } = await supabase
        .from('professores')
        .select('*')
        .order('nome');
      if (error) throw error;
      res.json(data || []);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/professores", async (req, res) => {
    try {
      const { nome, foto_url, bio } = req.body;
      const { data, error } = await supabase
        .from('professores')
        .insert([{ nome, foto_url, bio }])
        .select();
      if (error) throw error;
      res.json(data[0]);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.put("/api/professores/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { nome, foto_url, bio } = req.body;
      const { data, error } = await supabase
        .from('professores')
        .update({ nome, foto_url, bio })
        .eq('id', id)
        .select();
      if (error) throw error;
      res.json(data[0]);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/professores/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { error } = await supabase
        .from('professores')
        .delete()
        .eq('id', id);
      if (error) throw error;
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // CRUD - Parceiros
  app.get("/api/parceiros", async (req, res) => {
    try {
      const { data, error } = await supabase
        .from('parceiros')
        .select('*')
        .order('nome');
      if (error) throw error;
      res.json(data || []);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/parceiros", async (req, res) => {
    try {
      const { nome, logo_url } = req.body;
      const { data, error } = await supabase
        .from('parceiros')
        .insert([{ nome, logo_url }])
        .select();
      if (error) throw error;
      res.json(data[0]);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.put("/api/parceiros/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { nome, logo_url } = req.body;
      const { data, error } = await supabase
        .from('parceiros')
        .update({ nome, logo_url })
        .eq('id', id)
        .select();
      if (error) throw error;
      res.json(data[0]);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/parceiros/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { error } = await supabase
        .from('parceiros')
        .delete()
        .eq('id', id);
      if (error) throw error;
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/test-alunos", async (req, res) => {
    const { data, error } = await supabase.from('alunos').select('*').limit(1);
    res.json(data);
  });

  app.put("/api/alunos/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { nome_completo, data_nascimento, serie_ano, turma_escolar, unidade_origem_id } = req.body;
      
      const updateData: any = {};
      if (nome_completo !== undefined) updateData.nome_completo = nome_completo;
      if (data_nascimento !== undefined) updateData.data_nascimento = data_nascimento;
      if (serie_ano !== undefined) updateData.serie_ano = serie_ano;
      if (turma_escolar !== undefined) updateData.turma_escolar = turma_escolar;
      if (unidade_origem_id !== undefined) updateData.unidade_origem_id = unidade_origem_id || null;

      const { data, error } = await supabase
        .from('alunos')
        .update(updateData)
        .eq('id', id)
        .select();

      if (error) throw error;
      res.json(data[0]);
    } catch (error: any) {
      console.error("[Edit Aluno] Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/test-tarefas", async (req, res) => {
    const { data, error } = await supabase.from('tarefas').select('*, alunos(nome_completo)').order('created_at', { ascending: false }).limit(10);
    res.json(data);
  });

  app.post("/api/tasks/create", async (req, res) => {
    const { tipo, responsavel_id, aluno_id, matricula_id, detalhes } = req.body;
    console.log("[Tasks] Creating task:", { tipo, responsavel_id, aluno_id, matricula_id, detalhes });
    try {
      const { data, error } = await supabase
        .from('tarefas')
        .insert([{
          tipo,
          responsavel_id,
          aluno_id,
          matricula_id,
          detalhes,
          status: 'pendente',
          created_at: new Date().toISOString()
        }]);
      if (error) throw error;
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error creating task:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/tasks", async (req, res) => {
    try {
      console.log("[Tasks] Fetching tasks...");
      const { data, error } = await supabase
        .from('tarefas')
        .select(`
          *,
          responsaveis(nome_completo),
          alunos(nome_completo),
          matriculas(turma, unidade, alunos(nome_completo))
        `)
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error("[Tasks] Supabase Error:", error);
        throw error;
      }
      
      console.log(`[Tasks] Found ${data?.length || 0} tasks`);
      res.json(data);
    } catch (error: any) {
      console.error("[Tasks] Catch Error:", error);
      res.status(500).json({ error: error.message || "Erro desconhecido ao buscar tarefas" });
    }
  });

  app.post("/api/tasks/update-status", async (req, res) => {
    const { taskId, status } = req.body;
    try {
      const { error } = await supabase
        .from('tarefas')
        .update({ status })
        .eq('id', taskId);
      if (error) throw error;
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error updating task status:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/enrollment/cancel", async (req, res) => {
    const { enrollmentId, cancellationDate, justificativa } = req.body;
    try {
      const { data: currentEnrollment } = await supabase
        .from('matriculas')
        .select('status')
        .eq('id', enrollmentId)
        .single();

      if (currentEnrollment?.status === 'transferido' || currentEnrollment?.status === 'cancelado') {
        return res.status(400).json({ error: "Não é possível realizar movimentações em uma matrícula transferida ou cancelada." });
      }

      let finalCancellationDate = cancellationDate;
      if (finalCancellationDate && finalCancellationDate.length === 10) {
        // Formato YYYY-MM-DD recebido do input type="date"
        const now = new Date();
        const brazilDateStr = new Date(now.getTime() - 3 * 60 * 60 * 1000).toISOString().split('T')[0];
        
        if (finalCancellationDate === brazilDateStr) {
          // Se a data escolhida for hoje, salva com o horário exato atual
          finalCancellationDate = now.toISOString();
        } else {
          // Se for retroativa/futura, salva ao meio-dia UTC para evitar cair no dia anterior devido ao fuso GMT-3
          finalCancellationDate = `${finalCancellationDate}T12:00:00Z`;
        }
      }

      const updateData: any = {
        data_cancelamento: finalCancellationDate,
        status: 'cancelado'
      };

      const actionTimestamp = new Date().toISOString();
      if (justificativa) {
        updateData.justificativa_cancelamento = `[ACTION_DATE:${actionTimestamp}] ${justificativa}`;
      } else {
        updateData.justificativa_cancelamento = `[ACTION_DATE:${actionTimestamp}]`;
      }

      const { error } = await supabase
        .from('matriculas')
        .update(updateData)
        .eq('id', enrollmentId);

      if (error) throw error;

      // 1.5. Cancelar pagamentos pendentes vinculados a esta matrícula
      await supabase
        .from('pagamentos')
        .update({ status: 'cancelado' })
        .eq('matricula_id', enrollmentId)
        .eq('status', 'pendente');

      // 2. Fidelity Discount Reversion Logic
      // If one enrollment is cancelled and only one remains, the next payment loses the discount
      const { data: enrollmentData } = await supabase
        .from('matriculas')
        .select('aluno_id, turma, unidade')
        .eq('id', enrollmentId)
        .single();
      
      if (enrollmentData) {
        const { data: studentData } = await supabase
          .from('alunos')
          .select('responsavel_id')
          .eq('id', enrollmentData.aluno_id)
          .single();
        
        if (studentData) {
          const guardianId = studentData.responsavel_id;
          
          // Count remaining active enrollments
          const { data: guardianStudents } = await supabase
            .from('alunos')
            .select('id')
            .eq('responsavel_id', guardianId);
          
          const studentIds = guardianStudents?.map(s => s.id) || [];
          
          const { count: remainingCount } = await supabase
            .from('matriculas')
            .select('*', { count: 'exact', head: true })
            .in('status', ['ativo', 'Ativo'])
            .in('aluno_id', studentIds);
          
          // If only 1 enrollment remains, it loses the fidelity discount on the next payment
          if (remainingCount === 1) {
             const { data: nextPayment } = await supabase
               .from('pagamentos')
               .select('*')
               .eq('responsavel_id', guardianId)
               .eq('status', 'pendente')
               .order('created_at', { ascending: true })
               .limit(1)
               .maybeSingle();
             
             if (nextPayment) {
               const { data: remainingEnrollment } = await supabase
                 .from('matriculas')
                 .select('turma_id, unidade')
                 .in('status', ['ativo', 'Ativo'])
                 .in('aluno_id', studentIds)
                 .single();
               
               if (remainingEnrollment && remainingEnrollment.turma_id) {
                 const { data: turmaData } = await supabase
                   .from('turmas')
                   .select('valor_mensalidade, precos_unidade')
                   .eq('id', remainingEnrollment.turma_id)
                   .single();
                 
                 if (turmaData) {
                   await supabase
                     .from('pagamentos')
                     .update({ valor: turmaData.precos_unidade?.[remainingEnrollment.unidade] ?? turmaData.valor_mensalidade })
                     .eq('id', nextPayment.id);
                 }
               }
             }
          }
        }
      }

      // 3. Cancelar assinatura no Pagar.me (se existir)
      const { data: allPayments } = await supabase
        .from('pagamentos')
        .select('pagarme')
        .eq('matricula_id', enrollmentId)
        .not('pagarme', 'is', null);

      let subscriptionId = null;
      
      // Tenta buscar primeiro na própria matrícula (caso a coluna tenha sido adicionada)
      const { data: matData } = await supabase
        .from('matriculas')
        .select('pagarme_subscription_id')
        .eq('id', enrollmentId)
        .maybeSingle();
      
      if (matData && matData.pagarme_subscription_id) {
        subscriptionId = matData.pagarme_subscription_id;
      } else if (allPayments && allPayments.length > 0) {
        // Tenta encontrar um ID que comece com sub_ nos pagamentos
        const subPayment = allPayments.find(p => p.pagarme && p.pagarme.startsWith('sub_'));
        if (subPayment) {
          subscriptionId = subPayment.pagarme;
        } else {
          // Se não achou sub_, tenta resolver a partir de uma fatura (in_) ou pedido (or_)
          const otherPayment = allPayments.find(p => p.pagarme && (p.pagarme.startsWith('in_') || p.pagarme.startsWith('or_')));
          if (otherPayment) {
            try {
              const secretKey = getPagarmeSecretKey();
              const authHeader = Buffer.from(`${secretKey}:`).toString('base64');
              const id = otherPayment.pagarme;
              const endpoint = id.startsWith('in_') ? 'invoices' : 'orders';
              
              const resSub = await axios.get(`https://api.pagar.me/core/v5/${endpoint}/${id}`, {
                headers: { 'Authorization': `Basic ${authHeader}` }
              });
              
              subscriptionId = resSub.data.subscription_id || (resSub.data.subscription && resSub.data.subscription.id);
              if (subscriptionId) {
                console.log(`[Cancelamento] Subscription ID ${subscriptionId} recuperado a partir de ${id}`);
              }
            } catch (err: any) {
              console.error(`[Cancelamento] Erro ao tentar recuperar subscription_id:`, err.message);
            }
          }
        }
      }

      if (subscriptionId) {
        try {
          const secretKey = getPagarmeSecretKey();
          const authHeader = Buffer.from(`${secretKey}:`).toString('base64');
          await axios.delete(`https://api.pagar.me/core/v5/subscriptions/${subscriptionId}`, {
            headers: {
              'Authorization': `Basic ${authHeader}`,
              'Content-Type': 'application/json'
            }
          });
          console.log(`[Cancelamento] Assinatura ${subscriptionId} cancelada no Pagar.me com sucesso.`);
          
          // Se recuperamos o ID agora, salvamos na matrícula para histórico
          await supabase
            .from('matriculas')
            .update({ pagarme_subscription_id: subscriptionId })
            .eq('id', enrollmentId)
            .then(({ error }) => {
              if (error) console.log("Nota: Erro ao salvar ID da assinatura na matrícula (provavelmente coluna não existe).");
            });
        } catch (err: any) {
          console.error(`[Cancelamento] Erro ao cancelar assinatura no Pagar.me:`, err.response?.data || err.message);
        }
      } else {
        console.warn(`[Cancelamento] Nenhuma assinatura Pagar.me encontrada para a matrícula ${enrollmentId}`);
      }

      // 4. Enviar WhatsApp para o responsável
      if (enrollmentData) {
        const { data: studentData } = await supabase
          .from('alunos')
          .select('nome_completo, responsavel_id')
          .eq('id', enrollmentData.aluno_id)
          .single();
        
        if (studentData) {
          const { data: guardianData } = await supabase
            .from('responsaveis')
            .select('nome_completo, telefone')
            .eq('id', studentData.responsavel_id)
            .single();

          if (guardianData && guardianData.telefone) {
            let identidade = `na *Sport for Kids* (${enrollmentData.unidade})`;
            if (enrollmentData.unidade) {
              const { data: mappingData } = await supabase
                .from('unidades_mapping')
                .select('identidade')
                .eq('nome', enrollmentData.unidade.trim())
                .limit(1)
                .maybeSingle();
              
              if (mappingData && mappingData.identidade) {
                identidade = mappingData.identidade;
              } else {
                const { data: fallbackMapping } = await supabase
                  .from('unidades_mapping')
                  .select('identidade')
                  .eq('nome_unidade', enrollmentData.unidade.trim())
                  .limit(1)
                  .maybeSingle();
                if (fallbackMapping && fallbackMapping.identidade) {
                  identidade = fallbackMapping.identidade;
                }
              }
            }
            
            const msg = `Olá *${guardianData.nome_completo}*! Confirmamos o cancelamento da matrícula de *${studentData.nome_completo}* da turma *${enrollmentData.turma}* ${identidade}. Os débitos mensais referentes a esta matrícula foram cessados. Agradecemos o tempo que estiveram conosco! Caso possamos ajudar em qualquer necessidade, nos sinalize.`;
            await sendWhatsAppMessage(guardianData.telefone, guardianData.nome_completo, msg, enrollmentData.unidade)
              .catch(e => console.error("Erro ao enviar WhatsApp de cancelamento:", e));
          }
        }
      }

      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/enrollment/freeze", async (req, res) => {
    const { enrollmentId, startDate, endDate } = req.body;
    try {
      const { data: currentEnrollment } = await supabase
        .from('matriculas')
        .select('status')
        .eq('id', enrollmentId)
        .single();

      if (currentEnrollment?.status === 'transferido' || currentEnrollment?.status === 'cancelado') {
        return res.status(400).json({ error: "Não é possível realizar movimentações em uma matrícula transferida ou cancelada." });
      }

      // 1. Update enrollment status
      const { error: updateError } = await supabase
        .from('matriculas')
        .update({ 
          status: 'trancado',
          data_trancamento_inicio: startDate,
          data_trancamento_fim: endDate || null
        })
        .eq('id', enrollmentId);

      if (updateError) throw updateError;

      // 2. Get subscription ID
      const { data: matData } = await supabase
        .from('matriculas')
        .select('pagarme_subscription_id')
        .eq('id', enrollmentId)
        .single();

      // 3. Postpone Pagar.me Subscription to 2099 to pause billing
      if (matData.pagarme_subscription_id) {
        try {
          const secretKey = getPagarmeSecretKey();
          const authHeader = Buffer.from(`${secretKey}:`).toString('base64');
          
          // Get current subscription to find current next_billing_at
          const subRes = await axios.get(`https://api.pagar.me/core/v5/subscriptions/${matData.pagarme_subscription_id}`, {
            headers: { 'Authorization': `Basic ${authHeader}` }
          });

          const currentNextBilling = subRes.data.next_billing_at;
          const currentMetadata = subRes.data.metadata || {};

          // Update subscription with far future billing date and store original date
          await axios.patch(`https://api.pagar.me/core/v5/subscriptions/${matData.pagarme_subscription_id}`, {
            next_billing_at: '2099-12-31T00:00:00Z',
            metadata: {
              ...currentMetadata,
              original_next_billing_at: currentNextBilling
            }
          }, {
            headers: { 
              'Authorization': `Basic ${authHeader}`,
              'Content-Type': 'application/json'
            }
          });
          console.log(`[Trancamento] Assinatura ${matData.pagarme_subscription_id} pausada. Data original: ${currentNextBilling}`);
        } catch (err: any) {
          console.error(`[Trancamento] Erro ao pausar assinatura no Pagar.me:`, err.response?.data || err.message);
        }
      }
      
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error freezing enrollment:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/enrollment/reactivate", async (req, res) => {
    const { enrollmentId, reactivationDate } = req.body;
    try {
      // 1. Get freeze info
      const { data: matData, error: fetchError } = await supabase
        .from('matriculas')
        .select('status, data_trancamento_inicio, pagarme_subscription_id')
        .eq('id', enrollmentId)
        .single();

      if (fetchError) throw fetchError;
      if (matData.status !== 'trancado') {
        return res.status(400).json({ error: "Matrícula não está trancada." });
      }

      const freezeStart = new Date(matData.data_trancamento_inicio);
      const reactivateDate = new Date(reactivationDate);
      const diffTime = Math.abs(reactivateDate.getTime() - freezeStart.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      // 2. Update Pagar.me Subscription if exists
      if (matData.pagarme_subscription_id) {
        try {
          const secretKey = getPagarmeSecretKey();
          const authHeader = Buffer.from(`${secretKey}:`).toString('base64');
          
          // Get current subscription to find original next_billing_at
          const subRes = await axios.get(`https://api.pagar.me/core/v5/subscriptions/${matData.pagarme_subscription_id}`, {
            headers: { 'Authorization': `Basic ${authHeader}` }
          });

          const currentMetadata = subRes.data.metadata || {};
          let currentNextBilling;
          
          if (currentMetadata.original_next_billing_at) {
            currentNextBilling = new Date(currentMetadata.original_next_billing_at);
            delete currentMetadata.original_next_billing_at;
          } else {
            currentNextBilling = new Date(subRes.data.next_billing_at);
          }

          const newNextBilling = new Date(currentNextBilling.getTime() + (diffDays * 24 * 60 * 60 * 1000));

          // Update subscription with new billing date and clear the original date from metadata
          await axios.patch(`https://api.pagar.me/core/v5/subscriptions/${matData.pagarme_subscription_id}`, {
            next_billing_at: newNextBilling.toISOString(),
            metadata: currentMetadata
          }, {
            headers: { 
              'Authorization': `Basic ${authHeader}`,
              'Content-Type': 'application/json'
            }
          });
          
          console.log(`[Reativação] Assinatura ${matData.pagarme_subscription_id} postergada em ${diffDays} dias. Nova data: ${newNextBilling.toISOString()}`);
        } catch (err: any) {
          console.error(`[Reativação] Erro ao atualizar assinatura no Pagar.me:`, err.response?.data || err.message);
          // We continue even if Pagar.me fails, but maybe we should warn?
        }
      }

      // 3. Update enrollment status back to active
      await supabase
        .from('matriculas')
        .update({ 
          status: 'ativo',
          data_trancamento_fim: reactivationDate
        })
        .eq('id', enrollmentId);

      res.json({ success: true, daysPostponed: diffDays });
    } catch (error: any) {
      console.error("Error reactivating enrollment:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/enrollment/transfer", async (req, res) => {
    const { enrollmentId, newTurma, newUnidade } = req.body;
    try {
      const { data: currentEnrollment } = await supabase
        .from('matriculas')
        .select('status')
        .eq('id', enrollmentId)
        .single();

      if (currentEnrollment?.status === 'transferido' || currentEnrollment?.status === 'cancelado') {
        return res.status(400).json({ error: "Não é possível realizar movimentações em uma matrícula transferida ou cancelada." });
      }

      // 1. Get current enrollment data to preserve history
      const { data: oldEnrollment, error: fetchError } = await supabase
        .from('matriculas')
        .select('*')
        .eq('id', enrollmentId)
        .single();

      if (fetchError) throw fetchError;

      // 2. Get the new turma_id
      const { data: classData } = await supabase
        .from('turmas')
        .select('id')
        .eq('nome', newTurma)
        .maybeSingle();

      // 2.5 Check if already enrolled in the new class
      const { data: existingEnrollment, error: enrollError } = await supabase
        .from('matriculas')
        .select('id')
        .eq('aluno_id', oldEnrollment.aluno_id)
        .eq('turma', newTurma)
        .in('status', ['ativo', 'Ativo'])
        .limit(1)
        .maybeSingle();

      if (enrollError) {
        console.error("Error checking enrollment:", enrollError);
        return res.status(500).json({ error: 'Erro ao verificar matrícula existente.' });
      }

      if (existingEnrollment) {
        return res.status(400).json({ error: 'O estudante já possui uma matrícula ativa nesta turma.' });
      }

      // 3. Mark current enrollment as 'transferido' and set dates
      const { error: updateError } = await supabase
        .from('matriculas')
        .update({ 
          status: 'transferido',
          data_cancelamento: new Date().toISOString().split('T')[0],
          data_transferencia: new Date().toISOString().split('T')[0]
        })
        .eq('id', enrollmentId);

      if (updateError) throw updateError;

      // 4. Create a NEW enrollment record for the new class
      const { error: insertError } = await supabase
        .from('matriculas')
        .insert([{
          aluno_id: oldEnrollment.aluno_id,
          unidade: newUnidade,
          turma: newTurma,
          turma_id: classData?.id || null,
          status: 'ativo',
          pagarme_subscription_id: oldEnrollment.pagarme_subscription_id,
          plano: oldEnrollment.plano
        }]);

      if (insertError) throw insertError;

      // 5. Enviar WhatsApp para o responsável
      const { data: studentData } = await supabase
        .from('alunos')
        .select('nome_completo, responsavel_id')
        .eq('id', oldEnrollment.aluno_id)
        .single();
      
      if (studentData) {
        const { data: guardianData } = await supabase
          .from('responsaveis')
          .select('nome_completo, telefone')
          .eq('id', studentData.responsavel_id)
          .single();

        if (guardianData && guardianData.telefone) {
          let identidade = `na *Sport for Kids* (${oldEnrollment.unidade})`;
          if (oldEnrollment.unidade) {
            const { data: mappingData } = await supabase
              .from('unidades_mapping')
              .select('identidade')
              .eq('nome', oldEnrollment.unidade.trim())
              .limit(1)
              .maybeSingle();
            
            if (mappingData && mappingData.identidade) {
              identidade = mappingData.identidade;
            } else {
              const { data: fallbackMapping } = await supabase
                .from('unidades_mapping')
                .select('identidade')
                .eq('nome_unidade', oldEnrollment.unidade.trim())
                .limit(1)
                .maybeSingle();
              if (fallbackMapping && fallbackMapping.identidade) {
                identidade = fallbackMapping.identidade;
              }
            }
          }
          
          const msg = `Olá *${guardianData.nome_completo}*! Confirmamos a transferência da matrícula de *${studentData.nome_completo}* da turma *${oldEnrollment.turma}* para *${newTurma}* ${identidade}. Seguimos a disposição para qualquer necessidade..`;
          await sendWhatsAppMessage(guardianData.telefone, guardianData.nome_completo, msg, oldEnrollment.unidade)
            .catch(e => console.error("Erro ao enviar WhatsApp de transferência:", e));
        }
      }

      res.json({ success: true });
    } catch (error: any) {
      console.error("Transfer Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/enrollments", async (req, res) => {
    try {
      const fetchAll = async (table: string, selectStr: string) => {
        let allData: any[] = [];
        let from = 0;
        let to = 999;
        let hasMore = true;
        while (hasMore) {
          const { data, error } = await supabase.from(table).select(selectStr).order('created_at', { ascending: false }).range(from, to);
          if (error) throw error;
          allData = allData.concat(data);
          if (data.length < 1000) {
            hasMore = false;
          } else {
            from += 1000;
            to += 1000;
          }
        }
        return { data: allData, error: null };
      };

      // Fetch all necessary data separately to avoid complex join issues
      const [
        { data: responsaveis, error: rError },
        { data: alunos, error: aError },
        { data: matriculas, error: mError },
        { data: pagamentos, error: pError }
      ] = await Promise.all([
        fetchAll('responsaveis', 'id, nome_completo, email, telefone, cpf'),
        fetchAll('alunos', 'id, nome_completo, serie_ano, responsavel_id, data_nascimento'),
        fetchAll('matriculas', 'id, aluno_id, turma, unidade, status, data_cancelamento, data_matricula, plano'),
        fetchAll('pagamentos', 'id, responsavel_id, matricula_id, status, metodo_pagamento, data_vencimento, valor, pagarme, data_pagamento')
      ]);

      if (rError) throw rError;
      if (aError) throw aError;
      if (mError) throw mError;
      if (pError) throw pError;

      // Join the data in memory to match the expected frontend structure
      const result = (responsaveis || []).map(r => {
        const rAlunos = (alunos || [])
          .filter(a => String(a.responsavel_id).trim() === String(r.id).trim())
          .map(a => ({
            ...a,
            matriculas: (matriculas || []).filter(m => String(m.aluno_id).trim() === String(a.id).trim())
          }));
        
        const rPagamentos = (pagamentos || []).filter(p => p.responsavel_id === r.id);

        return {
          ...r,
          alunos: rAlunos,
          pagamentos: rPagamentos
        };
      });

      // Filter out responsaveis who don't have any students or enrollments to keep the list clean
      // but only if that's what's expected. The frontend mapping handles empty arrays anyway.
      res.json(result);
    } catch (error: any) {
      console.error("Detailed Enrollment Fetch Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/waitlist", async (req, res) => {
    const { guardian, student } = req.body;
    try {
      // 1. Find or Create Guardian
      let guardianId: any;
      const { data: existingGuardian, error: gFindError } = await supabase
        .from('responsaveis')
        .select('id')
        .eq('cpf', guardian.cpf)
        .maybeSingle();

      if (gFindError) throw gFindError;

      if (existingGuardian) {
        guardianId = existingGuardian.id;
      } else {
        const { data: newGuardian, error: gInsertError } = await supabase
          .from('responsaveis')
          .insert([{
            nome_completo: guardian.name,
            cpf: guardian.cpf,
            email: guardian.email,
            telefone: guardian.phone,
            endereco: guardian.address,
            senha: guardian.password
          }])
          .select()
          .single();
        
        if (gInsertError) throw gInsertError;
        if (!newGuardian) throw new Error("Falha ao criar responsável");
        guardianId = newGuardian.id;
      }

      // 2. Find or Create Student
      let alunoId: any;
      const { data: existingStudent, error: sFindError } = await supabase
        .from('alunos')
        .select('id')
        .eq('responsavel_id', guardianId)
        .ilike('nome_completo', student.name.trim())
        .limit(1)
        .maybeSingle();

      if (sFindError) throw sFindError;

      if (existingStudent) {
        alunoId = existingStudent.id;
      } else {
        const { data: newStudent, error: sInsertError } = await supabase
          .from('alunos')
          .insert([{
            responsavel_id: guardianId,
            nome_completo: student.name.trim(),
            data_nascimento: student.birthDate,
            serie_ano: student.grade,
            turma_escolar: student.turmaEscolar,
            responsavel_1: student.responsavel1,
            whatsapp_1: student.whatsapp1
          }])
          .select()
          .single();
        
        if (sInsertError) throw sInsertError;
        if (!newStudent) throw new Error("Falha ao criar aluno");
        alunoId = newStudent.id;
      }

      // 2.5 Check for duplicate waitlist entry
      const { data: turmasData, error: turmasError } = await supabase
        .from('turmas')
        .select('*');
      
      if (turmasError) throw turmasError;
      const options = { turmas: turmasData || [] };

      if (alunoId) {
        const { data: existingWaitlist, error: waitlistError } = await supabase
          .from('lista_espera')
          .select('id')
          .eq('aluno_id', alunoId)
          .eq('turma', student.turmaComplementar)
          .eq('status', 'aguardando')
          .limit(1)
          .maybeSingle();

        if (waitlistError) {
          console.error("Error checking waitlist:", waitlistError);
          return res.status(500).json({ error: 'Erro ao verificar lista de espera.' });
        }

        if (existingWaitlist) {
          return res.status(400).json({ error: 'O estudante já está na lista de espera desta turma.' });
        }
        
        // Also check if they are already enrolled
        const { data: existingEnrollment, error: enrollError } = await supabase
          .from('matriculas')
          .select('id')
          .eq('aluno_id', alunoId)
          .eq('turma', student.turmaComplementar)
          .in('status', ['ativo', 'Ativo'])
          .limit(1)
          .maybeSingle();

        if (enrollError) {
          console.error("Error checking enrollment:", enrollError);
          return res.status(500).json({ error: 'Erro ao verificar matrícula existente.' });
        }

        if (existingEnrollment) {
          return res.status(400).json({ error: 'O estudante já possui uma matrícula ativa nesta turma.' });
        }
      }

      // 3. Add to Waitlist
      const selectedTurma = options.turmas.find(t => t.nome === student.turmaComplementar);
      const { error: wError } = await supabase
        .from('lista_espera')
        .insert([{
          aluno_id: alunoId,
          responsavel_id: guardianId,
          unidade: student.unidade,
          turma: student.turmaComplementar,
          status: 'aguardando',
          estudante: student.name.trim(),
          ano_escolar: student.grade,
          turma_escolar: student.turmaEscolar,
          responsavel1: guardian.name,
          whatsapp1: guardian.phone,
          horario: selectedTurma?.dias_horarios
        }]);

      if (wError) throw wError;

      // 4. Get position in waitlist
      const { count, error: countError } = await supabase
        .from('lista_espera')
        .select('*', { count: 'exact', head: true })
        .eq('turma', student.turmaComplementar)
        .eq('status', 'aguardando');
      
      if (countError) {
        console.error("Error counting waitlist:", countError);
        return res.json({ success: true });
      }

      res.json({ success: true, position: count });
    } catch (error: any) {
      console.error("Waitlist error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/waitlist", async (req, res) => {
    try {
      const [
        { data: waitlist, error: wError },
        { data: alunos, error: aError },
        { data: responsaveis, error: rError }
      ] = await Promise.all([
        supabase.from('lista_espera').select('*').order('created_at', { ascending: true }),
        supabase.from('alunos').select('id, nome_completo, serie_ano'),
        supabase.from('responsaveis').select('id, nome_completo, telefone')
      ]);

      if (wError) throw wError;
      if (aError) throw aError;
      if (rError) throw rError;

      const result = (waitlist || []).map(item => ({
        ...item,
        alunos: (alunos || []).find(a => a.id === item.aluno_id),
        responsaveis: (responsaveis || []).find(r => r.id === item.responsavel_id)
      }));

      res.json(result);
    } catch (error: any) {
      console.error("Waitlist fetch error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // --- COUPON ROUTES ---
  app.get("/api/coupons", async (req, res) => {
    try {
      const { data, error } = await supabase
        .from('cupons')
        .select('*, cupom_usos(id)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/waitlist/notify", async (req, res) => {
    const { waitlistId, whatsapp } = req.body;
    try {
      // Fetch waitlist item to get all necessary data
      const { data: item, error: fetchError } = await supabase
        .from('lista_espera')
        .select('*')
        .eq('id', waitlistId)
        .single();
      
      if (fetchError) throw fetchError;

      const message = `Olá *${item.responsavel1}*, acabou de surgir uma vaga disponível para *${item.estudante}* na turma *${item.turma}* que estavam aguardando! a matrícula já pode ser realizada!`;
      
      await sendWhatsAppMessage(whatsapp, item.responsavel1, message, item.unidade);
      
      console.log(`[Notify] Updating waitlist item ${waitlistId} to 'chamado'`);
      
      // Prepare the update object with all required fields to satisfy NOT NULL constraints
      const updateDataPayload = {
        ...item,
        status: 'chamado',
        data_status_atualizado: new Date().toISOString()
      };

      console.log(`[Notify] Payload for upsert:`, JSON.stringify(updateDataPayload, null, 2));

      // Using upsert with the ID to ensure it finds and updates the specific row
      const { error: updateError, data: updateData } = await supabase
        .from('lista_espera')
        .upsert(updateDataPayload)
        .select();
      
      if (updateError) {
        console.error(`[Notify] Error updating waitlist item ${waitlistId}:`, JSON.stringify(updateError, null, 2));
        throw updateError;
      }
      console.log(`[Notify] Successfully updated waitlist item ${waitlistId}:`, updateData);
      
      res.json({ success: true });
    } catch (error: any) {
      console.error('Error notifying waitlist:', error);
      res.status(500).json({ error: 'Erro ao notificar vaga.' });
    }
  });

  app.post("/api/coupons", async (req, res) => {
    try {
      const { error } = await supabase.from('cupons').insert([req.body]);
      if (error) throw error;
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/coupons/:id", async (req, res) => {
    try {
      const { error } = await supabase.from('cupons').delete().eq('id', req.params.id);
      if (error) throw error;
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.put("/api/coupons/:id", async (req, res) => {
    try {
      const { error } = await supabase.from('cupons').update(req.body).eq('id', req.params.id);
      if (error) throw error;
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/coupons/validate", async (req, res) => {
    const { code, guardianId, cpf } = req.body;
    try {
      const today = new Date().toISOString().split('T')[0];
      const { data: coupon, error } = await supabase
        .from('cupons')
        .select('*')
        .eq('codigo', code.toUpperCase())
        .eq('ativo', true)
        .single();

      if (error || !coupon) return res.status(404).json({ error: "Cupom inválido ou expirado" });

      // Check expiration
      if (coupon.data_expiracao && coupon.data_expiracao < today) {
        return res.status(400).json({ error: "Este cupom já expirou" });
      }

      // Check usage limit
      if (coupon.limite_uso !== null && coupon.usos_atuais >= coupon.limite_uso) {
        return res.status(400).json({ error: "Este cupom atingiu o limite de usos" });
      }

      // Check unique usage per customer
      if (coupon.uso_unico_cliente) {
        let gId = guardianId;
        
        // If no guardianId, try to find by CPF
        if (!gId && cpf) {
          const { data: guardian } = await supabase
            .from('responsaveis')
            .select('id')
            .eq('cpf', cpf)
            .maybeSingle();
          if (guardian) gId = guardian.id;
        }

        if (gId) {
          const { data: usage } = await supabase
            .from('cupons_usos')
            .select('id')
            .eq('cupom_id', coupon.id)
            .eq('responsavel_id', gId)
            .maybeSingle();
          
          if (usage) return res.status(400).json({ error: "Você já utilizou este cupom" });
        }
      }

      // Check usage per user limit
      if (coupon.limite_por_usuario !== null && coupon.limite_por_usuario !== undefined) {
        let gId = guardianId;
        
        // If no guardianId, try to find by CPF
        if (!gId && cpf) {
          const { data: guardian } = await supabase
            .from('responsaveis')
            .select('id')
            .eq('cpf', cpf)
            .maybeSingle();
          if (guardian) gId = guardian.id;
        }

        if (gId) {
          const { count, error: userCountErr } = await supabase
            .from('cupons_usos')
            .select('*', { count: 'exact', head: true })
            .eq('cupom_id', coupon.id)
            .eq('responsavel_id', gId);

          if (!userCountErr && count !== null && count >= coupon.limite_por_usuario) {
            return res.status(400).json({ error: "Você já atingiu o limite de uso deste cupom" });
          }
        }
      }

      res.json(coupon);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/admin/dashboard", async (req, res) => {
    try {
      const now = new Date();
      const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const firstDayOfMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;

      const { data: matriculasAtivasData } = await supabase.from('matriculas')
        .select('aluno_id, status, data_cancelamento')
        .in('status', ['ativo', 'Ativo'])
        .is('data_cancelamento', null);
      const matriculasAtivasCount = matriculasAtivasData?.length || 0;
      const alunosAtivosSet = new Set(matriculasAtivasData?.map(m => m.aluno_id));
      const alunosAtivosCount = alunosAtivosSet.size;

      const { data: pagamentosFalhos } = await supabase.from('pagamentos').select('aluno_id, status').eq('status', 'falha');
      const inadimplentesCount = new Set(pagamentosFalhos?.map(p => p.aluno_id)).size;

      let receitaMes = 0;
      const chartDataMap: Record<string, { name: string, receita: number, matriculas: number }> = {};
      for (let i = 1; i <= now.getDate(); i++) {
        const dateStr = `${i.toString().padStart(2, '0')}/${(now.getMonth()+1).toString().padStart(2, '0')}`;
        chartDataMap[dateStr] = { name: dateStr, receita: 0, matriculas: 0 };
      }

      try {
        const fetchAllAndSum = async () => {
          let sum = 0;
          // Calculate limitStart and limitEnd in GMT-3 timezone relative to current server time.
          const dateNow = new Date();
          const targetOffset = -3;
          const utc = dateNow.getTime() + (dateNow.getTimezoneOffset() * 60000);
          const nowBrt = new Date(utc + (3600000 * targetOffset));
          
          const limitStart = new Date(nowBrt.getFullYear(), nowBrt.getMonth(), 1, 0, 0, 0, 0);
          // Adjust limitStart back to UTC to compare with database timestamps
          limitStart.setHours(limitStart.getHours() - targetOffset);
          
          const limitEnd = new Date(nowBrt.getFullYear(), nowBrt.getMonth() + 1, 0, 23, 59, 59, 999);
          limitEnd.setHours(limitEnd.getHours() - targetOffset);

          const processDate = (dateStr: string, created: string) => {
            let d = dateStr || created;
            if (typeof d === 'string' && d.includes('/')) {
              const parts = d.split(' ')[0].split('/');
              if (parts.length === 3) {
                let y = parts[2]; if (y.length === 2) y = `20${y}`;
                d = `${y}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}T12:00:00Z`;
              }
            }
            return new Date(d);
          };
          
          const fetchAllFromSupabase = async (table: string, selectFields = '*') => {
            const { count } = await supabase
              .from(table)
              .select('*', { count: 'exact', head: true });
            
            if (!count) {
              const { data } = await supabase.from(table).select(selectFields);
              return data || [];
            }
            
            const pageSize = 1000;
            const totalPages = Math.ceil(count / pageSize);
            const promises = [];
            
            for (let i = 0; i < totalPages; i++) {
              promises.push(
                supabase
                  .from(table)
                  .select(selectFields)
                  .range(i * pageSize, (i + 1) * pageSize - 1)
              );
            }
            
            const results = await Promise.all(promises);
            let allData: any[] = [];
            for (const res of results) {
              if (res.data) allData = allData.concat(res.data);
            }
            return allData;
          };

          // Fetch only current month's payments using server-side date filtering
          const limitStartISO = limitStart.toISOString();
          const limitEndISO = limitEnd.toISOString();

          const [pagamentos, pagamentosWix, pagamentosPagSeguro, eventos, loja] = await Promise.all([
            fetchAllFromSupabase('pagamentos', 'valor, status, data_vencimento, created_at'),
            fetchAllFromSupabase('pagamentos_wix', 'valor, status_transacao, provedor_pagamento, data_pagamento_gmt_03, created_at, aluno_id, cobranca_email, produto_nome'),
            fetchAllFromSupabase('pagamentos_pagseguro', 'valor_bruto, status, data_transacao, created_at'),
            fetchAllFromSupabase('evento_inscricoes', 'valor_pago, status, taxa_paga, provedor_pagamento, created_at'),
            fetchAllFromSupabase('loja_pedidos', 'total, status, provedor_pagamento, created_at')
          ]);

          pagamentos.forEach((p: any) => {
            if (p.status === 'pago' || p.status === 'conciliado') {
              const d = new Date(p.data_vencimento || p.created_at);
              if (d >= limitStart && d <= limitEnd) {
                const val = Number(p.valor || 0);
                sum += val;
                const dLocal = new Date(d.getTime() + targetOffset * 3600000);
                const dateStr = `${dLocal.getDate().toString().padStart(2, '0')}/${(dLocal.getMonth()+1).toString().padStart(2, '0')}`;
                if (chartDataMap[dateStr]) chartDataMap[dateStr].receita += val;
              }
            }
          });

          const uniqueWixMap = new Map();
          pagamentosWix.forEach((w: any) => {
            let dateStr = '';
            if (w.data_pagamento_gmt_03) {
              dateStr = w.data_pagamento_gmt_03; // Exact string to prevent merging different payments on same day/month
            } else if (typeof w.created_at === 'string') {
              dateStr = w.created_at;
            }
            const sig = `${w.aluno_id || w.cobranca_email}-${dateStr}-${w.valor}-${w.produto_nome || ''}`;
            const existing = uniqueWixMap.get(sig);
            if (!existing) {
              uniqueWixMap.set(sig, w);
            } else {
              const wStatus = (w.status_transacao || '').toLowerCase();
              const eStatus = (existing.status_transacao || '').toLowerCase();
              const wSuccess = wStatus.includes('bem-sucedido') || wStatus === 'pago';
              const eSuccess = eStatus.includes('bem-sucedido') || eStatus === 'pago';
              const wIsWebhook = w.provedor_pagamento === 'Wix Webhook';
              const eIsWebhook = existing.provedor_pagamento === 'Wix Webhook';

              if (wIsWebhook && !eIsWebhook) {
                uniqueWixMap.set(sig, w);
              } else if (!wIsWebhook && eIsWebhook) {
              } else {
                if (wSuccess && !eSuccess) {
                  uniqueWixMap.set(sig, w);
                } else if (wSuccess && eSuccess && w.provedor_pagamento === 'Wix API Cron' && existing.provedor_pagamento !== 'Wix API Cron') {
                  uniqueWixMap.set(sig, w);
                }
              }
            }
          });

          Array.from(uniqueWixMap.values()).forEach((p: any) => {
            const st = (p.status_transacao || '').toLowerCase();
            if (st.includes('bem-sucedido') || st === 'pago') {
              const d = processDate(p.data_pagamento_gmt_03, p.created_at);
              if (d >= limitStart && d <= limitEnd) {
                const val = Number(p.valor || 0);
                sum += val;
                const dLocal = new Date(d.getTime() + targetOffset * 3600000);
                const dateStr = `${dLocal.getDate().toString().padStart(2, '0')}/${(dLocal.getMonth()+1).toString().padStart(2, '0')}`;
                if (chartDataMap[dateStr]) chartDataMap[dateStr].receita += val;
              }
            }
          });

          pagamentosPagSeguro.forEach((p: any) => {
            const st = (p.status || '').toLowerCase();
            if (st.includes('aprovad') || st.includes('paga') || st.includes('disponivel') || st.includes('conciliado')) {
              const d = processDate(p.data_transacao, p.created_at);
              if (d >= limitStart && d <= limitEnd) {
                const val = Number(p.valor_bruto || 0);
                sum += val;
                const dLocal = new Date(d.getTime() + targetOffset * 3600000);
                const dateStr = `${dLocal.getDate().toString().padStart(2, '0')}/${(dLocal.getMonth()+1).toString().padStart(2, '0')}`;
                if (chartDataMap[dateStr]) chartDataMap[dateStr].receita += val;
              }
            }
          });

          eventos.forEach((i: any) => {
            if (i.taxa_paga || (i.status || '').toLowerCase() === 'confirmada' || i.status === 'pago') {
              const d = new Date(i.created_at);
              if (d >= limitStart && d <= limitEnd) {
                const val = Number(i.valor_pago || 0);
                sum += val;
                const dLocal = new Date(d.getTime() + targetOffset * 3600000);
                const dateStr = `${dLocal.getDate().toString().padStart(2, '0')}/${(dLocal.getMonth()+1).toString().padStart(2, '0')}`;
                if (chartDataMap[dateStr]) chartDataMap[dateStr].receita += val;
              }
            }
          });

          loja.forEach((p: any) => {
            if (p.status === 'pago') {
              const d = new Date(p.created_at);
              if (d >= limitStart && d <= limitEnd) {
                const val = Number(p.total || 0);
                sum += val;
                const dLocal = new Date(d.getTime() + targetOffset * 3600000);
                const dateStr = `${dLocal.getDate().toString().padStart(2, '0')}/${(dLocal.getMonth()+1).toString().padStart(2, '0')}`;
                if (chartDataMap[dateStr]) chartDataMap[dateStr].receita += val;
              }
            }
          });

          return sum;
        };
        receitaMes = await fetchAllAndSum();
      } catch (err) {
        console.error("Erro ao calcular receitaMes no dashboard", err);
      }

      const { data: novasMatriculasMes } = await supabase.from('matriculas')
        .select('id, created_at')
        .gte('created_at', firstDayOfMonth);
      const matriculasMesCount = novasMatriculasMes?.length || 0;

      const { data: cancelamentosMes } = await supabase.from('matriculas')
        .select('id, data_cancelamento')
        .eq('status', 'cancelado')
        .gte('data_cancelamento', firstDayOfMonthStr);
      const cancelamentosMesCount = cancelamentosMes?.length || 0;

      const { data: transferidosMes } = await supabase.from('matriculas')
        .select('id, data_cancelamento')
        .in('status', ['transferido', 'Transferido'])
        .gte('data_cancelamento', firstDayOfMonthStr);
      const transferidosMesCount = transferidosMes?.length || 0;

      const feed: any[] = [];
      
      const { data: feedMatriculas } = await supabase.from('matriculas')
        .select('id, created_at, status, alunos(nome_completo), turma')
        .order('created_at', { ascending: false })
        .limit(30);
        
      if (feedMatriculas) {
        feedMatriculas.forEach((m: any) => {
          // Não inclui cancelamentos nem transferências como nova matrícula
          if (m.status !== 'cancelado' && m.status !== 'Cancelado' && m.status !== 'transferido' && m.status !== 'Transferido') {
            feed.push({
              id: `mat_${m.id}`,
              tipo: 'matricula',
              descricao: `Nova Matrícula: ${m.alunos?.nome_completo || 'N/A'}`,
              detalhe: m.turma || '',
              data: m.created_at
            });
          }
        });
      }

      const { data: feedCancelamentos } = await supabase.from('matriculas')
        .select('id, data_cancelamento, justificativa_cancelamento, status, alunos(nome_completo), turma')
        .not('data_cancelamento', 'is', null)
        .order('data_cancelamento', { ascending: false })
        .limit(30);

      if (feedCancelamentos) {
        feedCancelamentos.forEach((m: any) => {
          if (m.status === 'cancelado') {
            let actionDate = m.data_cancelamento;
            if (m.justificativa_cancelamento && m.justificativa_cancelamento.includes('[ACTION_DATE:')) {
              const match = m.justificativa_cancelamento.match(/\[ACTION_DATE:(.+?)\]/);
              if (match && match[1]) {
                actionDate = match[1];
              }
            }

            feed.push({
              id: `canc_${m.id}`,
              tipo: 'cancelamento',
              descricao: `Cancelamento de Matrícula: ${m.alunos?.nome_completo || 'N/A'}`,
              detalhe: m.turma || '',
              data: actionDate
            });
          }
        });
      }

      const { data: feedTransferencias } = await supabase.from('matriculas')
        .select('id, aluno_id, data_cancelamento, alunos(nome_completo), turma')
        .in('status', ['transferido', 'Transferido'])
        .not('data_cancelamento', 'is', null)
        .order('data_cancelamento', { ascending: false })
        .limit(30);

      if (feedTransferencias && feedTransferencias.length > 0) {
        // Obter novas turmas para esses alunos transferidos
        const alunoIds = feedTransferencias.map(t => t.aluno_id).filter(Boolean);
        const { data: novasMatriculasTransferidas } = await supabase.from('matriculas')
          .select('aluno_id, turma')
          .in('status', ['ativo', 'Ativo'])
          .in('aluno_id', alunoIds);
        
        feedTransferencias.forEach((m: any) => {
          // Encontrar a turma mais recente (ativa) do mesmo aluno
          const novaTurma = (novasMatriculasTransferidas?.find(n => String(n.aluno_id) === String(m.aluno_id)) as any)?.turma || 'Outra Turma';
          feed.push({
            id: `transf_${m.id}`,
            tipo: 'transferencia',
            descricao: `Transferência: ${m.alunos?.nome_completo || 'N/A'} transferido de ${m.turma || 'N/A'} para ${novaTurma}`,
            detalhe: '',
            data: m.data_cancelamento
          });
        });
      }

      const { data: feedFalhas } = await supabase.from('pagamentos')
        .select('id, created_at, valor, status, responsaveis(nome_completo)')
        .eq('status', 'falha')
        .order('created_at', { ascending: false })
        .limit(20);

      if (feedFalhas) {
        feedFalhas.forEach((p: any) => {
          feed.push({
            id: `pag_${p.id}`,
            tipo: 'falha_pagamento',
            descricao: `Falha no Pagamento: ${p.responsaveis?.nome_completo || 'N/A'}`,
            detalhe: `R$ ${p.valor}`,
            data: p.created_at
          });
        });
      }

      const { data: feedPedidos } = await supabase.from('loja_pedidos')
        .select('id, created_at, total, nome_cliente')
        .eq('status', 'pago')
        .order('created_at', { ascending: false })
        .limit(20);

      if (feedPedidos) {
        feedPedidos.forEach((p: any) => {
          feed.push({
            id: `ped_${p.id}`,
            tipo: 'loja',
            descricao: `Nova Venda na Loja: ${p.nome_cliente || 'Cliente'}`,
            detalhe: `R$ ${Number(p.total || 0).toFixed(2)}`,
            data: p.created_at
          });
        });
      }

      const { data: feedSolicitacoes } = await supabase.from('loja_pedidos_solicitacoes')
        .select('id, created_at, tipo, status, data_autorizacao, loja_pedidos(nome_cliente)')
        .order('created_at', { ascending: false })
        .limit(20);

      if (feedSolicitacoes) {
        feedSolicitacoes.forEach((s: any) => {
          const nomeCliente = s.loja_pedidos?.nome_cliente || 'Cliente';
          const tipoSolicitacao = s.tipo === 'devolucao' ? 'Devolução' : (s.tipo === 'troca_tamanho' ? 'Troca de Tamanho' : 'Substituição');
          
          feed.push({
            id: `sol_req_${s.id}`,
            tipo: 'loja',
            descricao: `Solicitação de ${tipoSolicitacao} (${nomeCliente})`,
            detalhe: 'Aguardando Análise',
            data: s.created_at
          });

          if (s.status !== 'pendente') {
            feed.push({
              id: `sol_res_${s.id}`,
              tipo: 'loja',
              descricao: `${tipoSolicitacao} ${s.status === 'aprovado' ? 'Aprovada' : 'Rejeitada'} (${nomeCliente})`,
              detalhe: 'Processada',
              data: s.data_autorizacao || s.created_at
            });
          }
        });
      }

      const { data: feedInscricoes } = await supabase.from('evento_inscricoes')
        .select('id, created_at, nome_aluno, nome_responsavel, valor_pago, status, eventos(titulo)')
        .in('status', ['pago', 'confirmado', 'confirmada'])
        .order('created_at', { ascending: false })
        .limit(20);

      if (feedInscricoes) {
        feedInscricoes.forEach((i: any) => {
          feed.push({
            id: `ins_${i.id}`,
            tipo: 'evento',
            descricao: `Inscrição em Evento: ${i.nome_aluno || i.nome_responsavel || 'N/A'}`,
            detalhe: `${(i as any).eventos?.titulo || ''} • R$ ${Number(i.valor_pago || 0).toFixed(2)}`,
            data: i.created_at
          });
        });
      }

      const { data: feedCadastros } = await supabase.from('responsaveis')
        .select('id, created_at, nome_completo, email')
        .order('created_at', { ascending: false })
        .limit(20);

      if (feedCadastros) {
        feedCadastros.forEach((c: any) => {
          feed.push({
            id: `cad_${c.id}`,
            tipo: 'cadastro',
            descricao: `Novo Cadastro: ${c.nome_completo || 'N/A'}`,
            detalhe: c.email || '',
            data: c.created_at
          });
        });
      }

      feed.sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());

      // Chart data populated during fetchAllAndSum

      novasMatriculasMes?.forEach(m => {
        if (m.created_at) {
          const d = new Date(m.created_at);
          const dateStr = `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth()+1).toString().padStart(2, '0')}`;
          if (chartDataMap[dateStr]) chartDataMap[dateStr].matriculas += 1;
        }
      });

      const chartData = Object.values(chartDataMap);

      res.json({
        metrics: {
          alunosAtivos: alunosAtivosCount,
          matriculasAtivas: matriculasAtivasCount,
          inadimplentes: inadimplentesCount,
          receitaMes,
          matriculasMes: matriculasMesCount,
          cancelamentosMes: cancelamentosMesCount,
          transferidosMes: transferidosMesCount
        },
        charts: chartData,
        feed: feed.slice(0, 50)
      });

    } catch (error: any) {
      console.error('Erro ao buscar dados do dashboard:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/admin/financial-report", async (req, res) => {
    try {
      console.log("Fetching financial report data...");

      // Support optional date-range params from frontend (defaults to current month)
      const now = new Date();
      const defaultStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const defaultEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999).toISOString();
      const startDate = (req.query.startDate as string) || defaultStart;
      const endDate = (req.query.endDate as string) || defaultEnd;

      const fetchFiltered = async (table: string, selectFields = '*'): Promise<any[]> => {
        const { data } = await supabase.from(table).select(selectFields)
          .gte('created_at', startDate).lte('created_at', endDate);
        return data || [];
      };

      const fetchAllFromSupabase = async (table: string, selectFields = '*') => {
        const { count } = await supabase
          .from(table)
          .select('*', { count: 'exact', head: true });
        
        if (!count) {
          const { data } = await supabase.from(table).select(selectFields);
          return data || [];
        }
        
        const pageSize = 1000;
        const totalPages = Math.ceil(count / pageSize);
        const promises = [];
        
        for (let i = 0; i < totalPages; i++) {
          promises.push(
            supabase
              .from(table)
              .select(selectFields)
              .range(i * pageSize, (i + 1) * pageSize - 1)
          );
        }
        
        const results = await Promise.all(promises);
        let allData: any[] = [];
        for (const res of results) {
          if (res.data) allData = allData.concat(res.data);
        }
        return allData;
      };

      // Fetch all payments (to ensure CSV imported records aren't missed by created_at)
      const [
        pagamentos,
        pagamentosWix,
        pagamentosPagSeguro,
        responsaveis,
        alunos,
        rawMatriculas
      ] = await Promise.all([
        fetchAllFromSupabase('pagamentos', '*'),
        fetchAllFromSupabase('pagamentos_wix', '*'),
        fetchAllFromSupabase('pagamentos_pagseguro', '*'),
        fetchAllFromSupabase('responsaveis', 'id, nome_completo, email'),
        fetchAllFromSupabase('alunos', 'id, nome_completo, responsavel_id, turma_escolar, email'),
        fetchAllFromSupabase('matriculas', 'id, aluno_id, turma_id, status, plano, unidade, turma, data_matricula, data_cancelamento')
      ]);

      let turmas: any[] = [];
      try {
        turmas = await fetchAllFromSupabase('turmas', 'id, nome, professor, unidade_nome, valor_mensalidade, precos_unidade');
      } catch (err: any) {
        console.warn("Column 'professor' missing in 'turmas' or query failed, retrying without it...");
        const partialTurmas = await fetchAllFromSupabase('turmas', 'id, nome, unidade_nome, valor_mensalidade, precos_unidade');
        turmas = partialTurmas.map(t => ({ ...t, professor: null }));
      }

      // Enrich matriculas with class info if missing
      const matriculas = rawMatriculas.map(m => {
        if (!m.unidade || !m.turma) {
          const t = turmas.find(tr => String(tr.id) === String(m.turma_id));
          if (t) {
            return {
              ...m,
              unidade: m.unidade || t.unidade_nome,
              turma: m.turma || t.nome
            };
          }
        }
        return m;
      });

      console.log(`Data fetched: ${pagamentos.length} payments, ${pagamentosWix.length} Wix payments, ${pagamentosPagSeguro.length} PagSeguro payments, ${responsaveis.length} guardians, ${alunos.length} students, ${matriculas.length} enrollments, ${turmas.length} classes.`);

      // Deduplicate Wix payments by signature to avoid showing duplicates from Webhook vs Cron vs CSV
      const uniqueWixMap = new Map();
      
      pagamentosWix.forEach(w => {
        let dateStr = '';
        if (w.data_pagamento_gmt_03) {
          dateStr = w.data_pagamento_gmt_03; // Usa a string exata (inclui hora/minuto)
        } else if (typeof w.created_at === 'string') {
          dateStr = w.created_at;
        }
        
        const sig = `${w.aluno_id || w.cobranca_email}-${dateStr}-${w.valor}-${w.produto_nome || ''}`;
        
        const existing = uniqueWixMap.get(sig);
        if (!existing) {
          uniqueWixMap.set(sig, w);
        } else {
          const wStatus = (w.status_transacao || '').toLowerCase();
          const eStatus = (existing.status_transacao || '').toLowerCase();
          
          const wSuccess = wStatus.includes('bem-sucedido') || wStatus === 'pago';
          const eSuccess = eStatus.includes('bem-sucedido') || eStatus === 'pago';
          
          const wIsWebhook = w.provedor_pagamento === 'Wix Webhook';
          const eIsWebhook = existing.provedor_pagamento === 'Wix Webhook';

          if (wIsWebhook && !eIsWebhook) {
            // Webhook é fonte da verdade oficial e em tempo real sobre cobranças avulsas/falhas reais
            uniqueWixMap.set(sig, w);
          } else if (!wIsWebhook && eIsWebhook) {
            // Mantém a existente que é Webhook
          } else {
            // Se ambas são do mesmo tipo (ex: dois Webhooks), mantém a bem-sucedida
            if (wSuccess && !eSuccess) {
              uniqueWixMap.set(sig, w);
            } else if (wSuccess && eSuccess) {
              if (w.provedor_pagamento === 'Wix API Cron' && existing.provedor_pagamento !== 'Wix API Cron') {
                uniqueWixMap.set(sig, w);
              }
            }
          }
        }
      });

      const deduplicatedWix = Array.from(uniqueWixMap.values());

      // Map Wix payments to common format
      const mappedWix = deduplicatedWix.map(w => {
        let dataVenc = (w.data_pagamento_gmt_03 && w.data_pagamento_gmt_03.trim()) || w.created_at;
        
        // Se a data for no formato dd/mm/aaaa (com ou sem hora), tenta converter para ISO
        if (typeof dataVenc === 'string' && dataVenc.includes('/')) {
          const datePart = dataVenc.split(' ')[0]; // Pega apenas a parte da data se houver hora
          const parts = datePart.split('/');
          if (parts.length === 3) {
            const day = parts[0].padStart(2, '0');
            const month = parts[1].padStart(2, '0');
            let year = parts[2];
            if (year.length === 2) year = `20${year}`;
            dataVenc = `${year}-${month}-${day}T12:00:00Z`;
          }
        }

        return {
          ...w,
          id: w.id,
          responsavel_id: w.responsavel_id,
          matricula_id: w.matricula_id,
          aluno_id: w.aluno_id,
          valor: w.valor,
          status: (w.status_transacao || '').toLowerCase().includes('bem-sucedido') ? 'pago' : 
                  ((w.status_transacao || '').toLowerCase().includes('recusado') || 
                   (w.status_transacao || '').toLowerCase().includes('falhou') || 
                   (w.status_transacao || '').toLowerCase().includes('falha') || 
                   (w.status_transacao || '').toLowerCase().includes('failed')) ? 'falha' : 
                  (w.status_transacao || '').toLowerCase() === 'pago' ? 'pago' : 'pendente',
          metodo_pagamento: 'wix',
          data_vencimento: dataVenc || w.created_at,
          created_at: w.created_at,
          tipo_pedido: w.tipo_pedido,
          is_wix: true
        };
      });

      // Map PagSeguro payments to common format
      const mappedPagSeguro = pagamentosPagSeguro.map(ps => {
        let dataVenc = ps.data_transacao || ps.created_at;
        
        // Se a data for no formato dd/mm/aaaa (com ou sem hora), tenta converter para ISO
        if (typeof dataVenc === 'string' && dataVenc.includes('/')) {
          const datePart = dataVenc.split(' ')[0]; // Pega apenas a parte da data se houver hora
          const parts = datePart.split('/');
          if (parts.length === 3) {
            const day = parts[0].padStart(2, '0');
            const month = parts[1].padStart(2, '0');
            let year = parts[2];
            if (year.length === 2) year = `20${year}`;
            dataVenc = `${year}-${month}-${day}T12:00:00Z`;
          }
        }

        const statusLower = (ps.status || '').toLowerCase();
        let normalizedStatus = 'pendente';
        if (statusLower.includes('aprovad') || statusLower.includes('paga') || statusLower.includes('disponivel') || statusLower.includes('conciliado')) {
          normalizedStatus = 'pago';
        } else if (statusLower.includes('cancelad') || statusLower.includes('devolvida') || statusLower.includes('estornado')) {
          normalizedStatus = 'cancelado';
        } else if (statusLower.includes('falhou') || statusLower.includes('recusado')) {
          normalizedStatus = 'falha';
        }

        return {
          ...ps,
          id: ps.id,
          responsavel_id: ps.responsavel_id,
          matricula_id: ps.matricula_id,
          aluno_id: ps.aluno_id,
          valor: ps.valor_bruto,
          status: normalizedStatus,
          metodo_pagamento: 'pagseguro',
          data_vencimento: dataVenc || ps.created_at,
          created_at: ps.created_at,
          is_pagseguro: true
        };
      });

      const allPagamentos = [...pagamentos, ...mappedWix, ...mappedPagSeguro];

      // Join the data in memory
      const detailedPagamentos = allPagamentos.map(p => {
        let resp = responsaveis.find(r => String(r.id) === String(p.responsavel_id));
        let matchAlunoIdByEmail = null;

        if (!resp && (p.cobranca_email || p.comprador_email)) {
          const searchEmail = (p.cobranca_email || p.comprador_email).toLowerCase().trim();
          resp = responsaveis.find(r => r.email && r.email.toLowerCase().trim() === searchEmail);
          
          if (!resp) {
            // Check if it matches an aluno email
            const matchedAluno = alunos.find(a => a.email && a.email.toLowerCase().trim() === searchEmail);
            if (matchedAluno) {
               matchAlunoIdByEmail = matchedAluno.id;
               resp = responsaveis.find(r => String(r.id) === String(matchedAluno.responsavel_id));
            }
          }
        }
        let respAlunos = [];

        // If payment is linked to a specific enrollment, use it
        if (p.matricula_id) {
          const mat = matriculas.find(m => String(m.id).trim() === String(p.matricula_id).trim());
          if (mat) {
            const aluno = alunos.find(a => String(a.id).trim() === String(mat.aluno_id).trim());
            if (aluno) {
              respAlunos = [{
                ...aluno,
                matriculas: [mat]
              }];
            }
          }
        } 
        
        // If still no students found, try by aluno_id if present (common in Wix)
        const searchAlunoId = p.aluno_id || matchAlunoIdByEmail;
        if (respAlunos.length === 0 && searchAlunoId) {
          const aluno = alunos.find(a => String(a.id).trim() === String(searchAlunoId).trim());
          if (aluno) {
            respAlunos = [{
              ...aluno,
              matriculas: matriculas.filter(m => String(m.aluno_id).trim() === String(aluno.id).trim())
            }];
          }
        }

        // Final fallback: link to all students of the guardian (old behavior)
        if (respAlunos.length === 0 && resp) {
          respAlunos = alunos
            .filter(a => String(a.responsavel_id) === String(resp.id))
            .map(a => ({
              ...a,
              matriculas: matriculas.filter(m => String(m.aluno_id) === String(a.id))
            }));
        }

        // Ultimate fallback: If STILL no students, search alunos directly by email
        if (respAlunos.length === 0 && (p.cobranca_email || p.comprador_email)) {
          const searchEmail = (p.cobranca_email || p.comprador_email).toLowerCase().trim();
          const matchedAluno = alunos.find(a => a.email && a.email.toLowerCase().trim() === searchEmail);
          if (matchedAluno) {
            respAlunos = [{
              ...matchedAluno,
              matriculas: matriculas.filter(m => String(m.aluno_id).trim() === String(matchedAluno.id).trim())
            }];
            resp = responsaveis.find(r => String(r.id) === String(matchedAluno.responsavel_id)) || resp;
          }
        }

        return {
          ...p,
          responsaveis: resp ? {
            ...resp,
            alunos: respAlunos
          } : null
        };
      });

      // Sort payments by date (data_vencimento or created_at) in descending order
      detailedPagamentos.sort((a, b) => {
        const dateA = new Date(a.data_vencimento || a.created_at).getTime();
        const dateB = new Date(b.data_vencimento || b.created_at).getTime();
        return dateB - dateA;
      });

      console.log(`Sending financial report with ${detailedPagamentos.length} payments and ${turmas.length} classes.`);
       res.json({ 
        pagamentos: detailedPagamentos, 
        turmas: turmas,
        matriculas: matriculas,
        alunos: alunos,
        responsaveis: responsaveis
      });
    } catch (error: any) {
      console.error("Financial Report Error Detailed:", error);
      res.status(500).json({ 
        error: error.message || "Unknown error fetching financial report",
        details: error.details || error
      });
    }
  });

  // Debug Pagar.me Connectivity
  app.get('/api/debug/pagarme', async (req, res) => {
    const secretKey = getPagarmeSecretKey();
    if (!secretKey) {
      return res.status(400).json({ error: 'PAGARME_SECRET_KEY não configurada' });
    }

    try {
      const authHeader = Buffer.from(`${secretKey}:`).toString('base64');
      const response = await axios.get('https://api.pagar.me/core/v5/orders?size=1', {
        headers: {
          'Authorization': `Basic ${authHeader}`,
          'Content-Type': 'application/json'
        }
      });
      res.json({ 
        success: true, 
        message: 'Conexão com Pagar.me estabelecida com sucesso',
        keyPrefix: secretKey.substring(0, 8),
        ordersFound: response.data.data?.length || 0
      });
    } catch (error: any) {
      console.error('[Debug Pagar.me] Erro:', error.response?.data || error.message);
      res.status(500).json({ 
        success: false, 
        error: error.message,
        pagarmeError: error.response?.data
      });
    }
  });

  app.get("/api/admin/delinquencies", async (req, res) => {
    try {
      console.log("Fetching delinquencies report data...");
      
      const today = new Date();
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(today.getDate() - 30);
      const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0];
      const fiveDaysAgo = new Date();
      fiveDaysAgo.setDate(today.getDate() - 5);
      const fiveDaysAgoStr = fiveDaysAgo.toISOString().split('T')[0];

      // Fetch all required data in parallel
      const [
        mRes,
        aRes,
        rRes,
        pRes,
        prRes,
        tRes,
        uRes
      ] = await Promise.all([
        supabase.from('matriculas').select('*').limit(10000),
        supabase.from('alunos').select('id, nome_completo, responsavel_id, responsavel_1, whatsapp_1, whatsapp_2, email, data_nascimento').limit(10000),
        supabase.from('responsaveis').select('id, nome_completo, email, telefone').limit(10000),
        supabase.from('pagamentos').select('*').limit(10000),
        supabase.from('presencas').select('*').gte('data', thirtyDaysAgoStr).limit(10000),
        supabase.from('turmas').select('id, nome, valor_mensalidade, unidade_nome, precos_unidade').limit(10000),
        supabase.from('unidades_mapping').select('*').limit(1000)
      ]);

      if (mRes.error) throw new Error(`Matriculas error: ${mRes.error.message}`);
      if (aRes.error) throw new Error(`Alunos error: ${aRes.error.message}`);
      if (rRes.error) throw new Error(`Responsaveis error: ${rRes.error.message}`);
      if (pRes.error) throw new Error(`Pagamentos error: ${pRes.error.message}`);
      if (prRes.error) throw new Error(`Presencas error: ${prRes.error.message}`);
      if (tRes.error) throw new Error(`Turmas error: ${tRes.error.message}`);
      if (uRes.error) throw new Error(`Unidades mapping error: ${uRes.error.message}`);

      const matriculasList = mRes.data || [];
      const alunosList = aRes.data || [];
      const responsaveisList = rRes.data || [];
      const presencasList = prRes.data || [];
      const turmasList = tRes.data || [];
      const mappingList = uRes.data || [];

      // Paginate through ALL WIX payments (Supabase PostgREST caps each page at 1000 rows).
      // Without pagination, students whose payments fall beyond row 1000 appear as delinquent
      // even when fully paid.
      const allWixPayments: any[] = [];
      {
        let wixPage = 0;
        const pageSize = 1000;
        let hasMore = true;
        while (hasMore) {
          const { data: chunk, error: wErr } = await supabase
            .from('pagamentos_wix')
            .select('id, responsavel_id, matricula_id, aluno_id, valor, status_transacao, data_pagamento_gmt_03, created_at')
            .range(wixPage * pageSize, (wixPage + 1) * pageSize - 1);
          if (wErr) {
            console.warn(`[Delinquencies] WIX payments page ${wixPage} error (non-fatal): ${wErr.message}`);
            break;
          }
          if (!chunk || chunk.length === 0) {
            hasMore = false;
          } else {
            allWixPayments.push(...chunk);
            if (chunk.length < pageSize) hasMore = false;
            else wixPage++;
          }
        }
        console.log(`[Delinquencies] Fetched ${allWixPayments.length} WIX payments across ${wixPage + 1} page(s).`);
      }

      // Paginate through WIX (pagamentos_pagseguro) payments as well
      const allPagseguroPayments: any[] = [];
      {
        let psPage = 0;
        const pageSize = 1000;
        let hasMore = true;
        while (hasMore) {
          const { data: chunk, error: psErr } = await supabase
            .from('pagamentos_pagseguro')
            .select('id, responsavel_id, matricula_id, aluno_id, valor_bruto, status, data_transacao, created_at')
            .range(psPage * pageSize, (psPage + 1) * pageSize - 1);
          if (psErr) {
            console.warn(`[Delinquencies] PagSeguro page ${psPage} error (non-fatal): ${psErr.message}`);
            break;
          }
          if (!chunk || chunk.length === 0) {
            hasMore = false;
          } else {
            allPagseguroPayments.push(...chunk);
            if (chunk.length < pageSize) hasMore = false;
            else psPage++;
          }
        }
      }

      // Normalize WIX payments to a common format with status 'pago'/'falha'/'pendente'
      const pagamentosWixNorm = allWixPayments.map(w => ({
        id: `wix_${w.id}`,
        responsavel_id: w.responsavel_id,
        matricula_id: w.matricula_id,
        aluno_id: w.aluno_id,
        valor: w.valor,
        data_vencimento: w.data_pagamento_gmt_03 || w.created_at,
        created_at: w.created_at,
        status: (w.status_transacao || '').toLowerCase().includes('bem-sucedido') || (w.status_transacao || '').toLowerCase() === 'pago' ? 'pago' :
                ((w.status_transacao || '').toLowerCase().includes('recusado') || (w.status_transacao || '').toLowerCase().includes('falhou') || (w.status_transacao || '').toLowerCase().includes('falha') || (w.status_transacao || '').toLowerCase().includes('failed')) ? 'falha' : 'pendente',
        source: 'wix'
      }));

      // Normalize PagSeguro payments to a common format
      const pagamentosPsNorm = allPagseguroPayments.map(ps => {
        const s = (ps.status || '').toLowerCase();
        let normalizedStatus = 'pendente';
        if (s.includes('aprovad') || s.includes('paga') || s.includes('disponivel') || s.includes('conciliado')) {
          normalizedStatus = 'pago';
        } else if (s.includes('cancelad') || s.includes('devolvida') || s.includes('estornado')) {
          normalizedStatus = 'cancelado';
        } else if (s.includes('falhou') || s.includes('recusado')) {
          normalizedStatus = 'falha';
        }
        return {
          id: `ps_${ps.id}`,
          responsavel_id: ps.responsavel_id,
          matricula_id: ps.matricula_id,
          aluno_id: ps.aluno_id,
          valor: ps.valor_bruto,
          data_vencimento: ps.data_transacao || ps.created_at,
          created_at: ps.created_at,
          status: normalizedStatus,
          source: 'pagseguro'
        };
      });

      // Merge all payment sources
      const pagamentosList = [
        ...(pRes.data || []),
        ...pagamentosWixNorm,
        ...pagamentosPsNorm
      ];

      const delinquents = [];

      for (const mat of matriculasList) {
        const aluno = alunosList.find(a => String(a.id) === String(mat.aluno_id));
        if (!aluno) continue;

        const resp = responsaveisList.find(r => String(r.id) === String(aluno.responsavel_id));
        
        // Find corresponding class to get value
        const turma = turmasList.find(t => String(t.id) === String(mat.turma_id)) ||
                      turmasList.find(t => String(t.nome).trim().toLowerCase() === String(mat.turma).trim().toLowerCase() && 
                                           String(t.unidade_nome).trim().toLowerCase() === String(mat.unidade).trim().toLowerCase());
        
        const valorMensalidade = mat.valor_mensalidade || (turma ? (turma.precos_unidade?.[mat.unidade] ?? turma.valor_mensalidade) : 0) || 292; // default if not specified

        // Find unit mapping for start/end of classes
        const mapping = mappingList.find(u => String(u.nome).trim().toLowerCase() === String(mat.unidade).trim().toLowerCase());
        let inicioAulas: Date | null = null;
        let fimAulas: Date | null = null;

        if (mapping) {
          if (mapping.inicio_aulas) {
            const d = new Date(mapping.inicio_aulas);
            if (!isNaN(d.getTime())) inicioAulas = d;
          }
          if (mapping.fim_aulas) {
            const d = new Date(mapping.fim_aulas);
            if (!isNaN(d.getTime())) fimAulas = d;
          }
        }

        // Active range
        const dataMatriculaStr = mat.data_matricula || mat.created_at;
        if (!dataMatriculaStr) continue;

        const start = new Date(dataMatriculaStr);
        let end = new Date(today);
        if (mat.status === 'Cancelado' || mat.status === 'cancelado' || mat.data_cancelamento || mat.status === 'falha') {
          const cancelStr = mat.data_cancelamento;
          if (cancelStr) {
            const d = new Date(cancelStr);
            if (!isNaN(d.getTime())) end = d;
          }
        }

        // Apply school year boundaries if available
        let calcStart = new Date(start);
        if (inicioAulas && inicioAulas > calcStart) {
          calcStart = new Date(inicioAulas);
        }

        let calcEnd = new Date(end);
        if (fimAulas && fimAulas < calcEnd) {
          calcEnd = new Date(fimAulas);
        }
        if (today < calcEnd) {
          calcEnd = new Date(today);
        }

        // Calculate expected installments
        let expectedCount = 0;
        const expectedDates: string[] = [];

        if (calcStart <= calcEnd) {
          // The first installment (registration/adesao) is due on calcStart
          // We only count it as expected if its due date is at least 5 days ago
          const firstDueDate = calcStart.toISOString().split('T')[0];
          if (firstDueDate <= fiveDaysAgoStr) {
            expectedCount++;
            expectedDates.push(firstDueDate);
          }

          let baseDay = calcStart.getDate();
          if (baseDay === 31) baseDay = 30;

          let nextVencimento = new Date(calcStart);
          nextVencimento.setDate(1);
          nextVencimento.setMonth(nextVencimento.getMonth() + 1);
          nextVencimento.setDate(baseDay);

          if (nextVencimento.getDate() !== baseDay) {
            nextVencimento.setDate(0);
          }

          while (nextVencimento <= calcEnd) {
            // Check if class end is near (diffDays <= 12 logic)
            if (fimAulas) {
              const diffTime = fimAulas.getTime() - nextVencimento.getTime();
              const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
              if (diffDays <= 12) break;
            }

            const dueDateStr = nextVencimento.toISOString().split('T')[0];
            if (dueDateStr <= fiveDaysAgoStr) {
              expectedCount++;
              expectedDates.push(dueDateStr);
            }

            // Move to next month
            nextVencimento = new Date(nextVencimento);
            nextVencimento.setDate(1);
            nextVencimento.setMonth(nextVencimento.getMonth() + 1);
            nextVencimento.setDate(baseDay);
            if (nextVencimento.getDate() !== baseDay) {
              nextVencimento.setDate(0);
            }
          }
        }

        // Count paid payments for this enrollment
        const payments = pagamentosList.filter(p => 
          String(p.matricula_id) === String(mat.id) || 
          (!p.matricula_id && String(p.aluno_id) === String(mat.aluno_id))
        );
        const paidPayments = payments.filter(p => p.status === 'pago');
        const paidCount = paidPayments.length;

        if (paidCount < expectedCount) {
          // Check recent presence
          const studentPresences = presencasList.filter(p => String(p.aluno_id) === String(aluno.id));
          const sortedPresences = [...studentPresences].sort((a, b) => b.data.localeCompare(a.data));
          const hasRecentPresence = studentPresences.some(p => p.status === 'Presente');

          let category = 'ativo'; // Inadimplente Ativo
          if (mat.status === 'Cancelado' || mat.status === 'cancelado' || mat.data_cancelamento || mat.status === 'falha') {
            category = 'cancelado';
          } else if (!hasRecentPresence) {
            category = 'evasao';
          }

          const missingCount = expectedCount - paidCount;
          const valorDevido = missingCount * valorMensalidade;

          delinquents.push({
            matriculaId: mat.id,
            alunoId: aluno.id,
            alunoNome: aluno.nome_completo,
            responsavelNome: resp ? resp.nome_completo : (aluno.responsavel_1 || 'Não informado'),
            responsavelEmail: resp ? resp.email : (aluno.email || 'Não informado'),
            responsavelTelefone: resp ? resp.telefone : (aluno.whatsapp_1 || 'Não informado'),
            unidade: mat.unidade,
            turma: mat.turma,
            valorMensalidade,
            expectedCount,
            paidCount,
            missingCount,
            valorDevido,
            category,
            lastPresenceDate: sortedPresences.length > 0 ? sortedPresences[0].data : null,
            expectedDates,
            paidDates: paidPayments.map(p => p.data_vencimento || p.data || p.created_at).sort()
          });
        }
      }

      res.json({
        delinquents,
        totals: {
          totalDevido: delinquents.reduce((acc, curr) => acc + curr.valorDevido, 0),
          totalAlunos: new Set(delinquents.map(d => d.alunoId)).size,
          ativosCount: delinquents.filter(d => d.category === 'ativo').length,
          evasaoCount: delinquents.filter(d => d.category === 'evasao').length,
          canceladosCount: delinquents.filter(d => d.category === 'cancelado').length
        }
      });
    } catch (error: any) {
      console.error("Error generating delinquencies report:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Franquia Config Endpoint
  app.get("/api/franquia/:nome", async (req, res) => {
    try {
      const { nome } = req.params;
      const config = await getFranquiaConfig(nome);
      if (!config) {
        return res.status(404).json({ error: "Franquia não encontrada" });
      }
      // Return only safe public config
      res.json({ 
        nome: config.nome,
        modelo_pagamento: config.modelo_pagamento,
        cor_primaria: config.cor_primaria,
        logo_url: config.logo_url,
        whatsapp: config.utalk_from_phone
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Manual Payment Sync
  app.get('/api/payments/sync/:paymentId', async (req, res) => {
    const { paymentId } = req.params;
    const secretKey = getPagarmeSecretKey();

    try {
      console.log(`[Sync] Iniciando sincronização para o pagamento: ${paymentId}`);
      
      // 1. Get payment from Supabase
      const { data: payment, error: pError } = await supabase
        .from('pagamentos')
        .select('*')
        .eq('id', paymentId)
        .single();

      if (pError || !payment) {
        console.error(`[Sync] Pagamento ${paymentId} não encontrado no Supabase:`, pError?.message);
        return res.status(404).json({ error: 'Pagamento não encontrado no banco de dados' });
      }

      // 2. Fetch order from Pagar.me
      const authHeader = Buffer.from(`${secretKey}:`).toString('base64');
      
      let order: any = null;

      if (payment.pagarme) {
        console.log(`[Sync] Buscando transação Pagar.me pelo ID salvo: ${payment.pagarme}`);
        try {
          const endpoint = payment.pagarme.startsWith('sub_') ? 'subscriptions' : 'orders';
          const response = await axios.get(`https://api.pagar.me/core/v5/${endpoint}/${payment.pagarme}`, {
            headers: {
              'Authorization': `Basic ${authHeader}`,
              'Content-Type': 'application/json'
            }
          });
          order = response.data;
          console.log(`[Sync] Transação encontrada pelo ID! Status: ${order.status}`);
        } catch (err: any) {
          console.warn(`[Sync] Erro ao buscar pelo ID ${payment.pagarme}:`, err.message);
        }
      }

      if (!order) {
        console.log(`[Sync] Buscando pedido na Pagar.me com code=${paymentId}`);
        // Tenta buscar pelo código exato primeiro
        let response = await axios.get(`https://api.pagar.me/core/v5/orders?code=${paymentId}`, {
          headers: {
            'Authorization': `Basic ${authHeader}`,
            'Content-Type': 'application/json'
          }
        });

        let orders = response.data.data;
        console.log(`[Sync] Pedidos encontrados por código exato: ${orders?.length || 0}`);
        
        // Se não encontrar, busca nos últimos 100 pedidos e filtra manualmente
        if (!orders || orders.length === 0) {
          console.log(`[Sync] Pedido não encontrado por código exato. Buscando nos últimos 100 pedidos...`);
          response = await axios.get(`https://api.pagar.me/core/v5/orders?size=100`, {
            headers: {
              'Authorization': `Basic ${authHeader}`,
              'Content-Type': 'application/json'
            }
          });
          orders = response.data.data;
          console.log(`[Sync] Total de pedidos recuperados para busca manual: ${orders?.length || 0}`);
        }

        order = orders?.find((o: any) => {
          const match = o.code === paymentId || o.code.startsWith(`${paymentId}_`);
          if (match) console.log(`[Sync] Match encontrado! Order ID: ${o.id}, Code: ${o.code}, Status: ${o.status}`);
          return match;
        });

        // Se ainda não encontrou, busca nas assinaturas
        if (!order) {
          console.log(`[Sync] Pedido não encontrado. Buscando nas últimas 100 assinaturas...`);
          try {
            const subResponse = await axios.get(`https://api.pagar.me/core/v5/subscriptions?size=100`, {
              headers: {
                'Authorization': `Basic ${authHeader}`,
                'Content-Type': 'application/json'
              }
            });
            const subscriptions = subResponse.data.data;
            order = subscriptions?.find((s: any) => {
              const match = s.code === paymentId || s.code.startsWith(`${paymentId}_`);
              if (match) console.log(`[Sync] Match encontrado em assinaturas! Sub ID: ${s.id}, Code: ${s.code}, Status: ${s.status}`);
              return match;
            });
          } catch (err: any) {
            console.warn(`[Sync] Erro ao buscar assinaturas:`, err.message);
          }
        }
      }

      if (!order) {
        console.warn(`[Sync] Pedido com código ${paymentId} não encontrado na Pagar.me`);
        return res.status(404).json({ error: 'Pedido não encontrado no Pagar.me' });
      }

      console.log(`[Sync] Pedido encontrado! ID Pagar.me: ${order.id}, Status: ${order.status}`);

      if (order.status === 'paid') {
        console.log(`[Sync] Pedido confirmado como pago na Pagar.me. Atualizando Supabase para o ID: ${paymentId}`);
        
        // 1. Tenta atualização completa (Melhor cenário)
        const fullUpdate: any = { 
          status: 'pago',
          data_pagamento: new Date().toISOString(),
          pagarme: order.id
        };
        
        const { error: updateError } = await supabase
          .from('pagamentos')
          .update(fullUpdate)
          .eq('id', paymentId);

        if (updateError) {
          console.warn(`[Sync] Erro na atualização completa: ${updateError.message}. Tentando fallback apenas com status...`);
          
          // 2. Fallback: Tenta apenas o status (Cenário de segurança)
          const { error: fallbackError } = await supabase
            .from('pagamentos')
            .update({ status: 'pago' })
            .eq('id', paymentId);
            
          if (fallbackError) {
            console.error(`[Sync] Erro fatal no fallback: ${fallbackError.message}`);
            return res.status(500).json({ error: 'Erro ao atualizar banco de dados', details: fallbackError.message });
          }
        }

        console.log(`[Sync] Pagamento ${paymentId} atualizado com sucesso para PAGO`);

        if (payment.matricula_id) {
          await supabase
            .from('matriculas')
            .update({ status: 'ativo' })
            .eq('id', payment.matricula_id);
          console.log(`[Sync] Matrícula ${payment.matricula_id} ativada`);
        }

        console.log(`[Sync] Pagamento ${paymentId} sincronizado com sucesso como PAGO`);
        return res.json({ status: 'pago', updated: true });
      } else if (order.status === 'failed' || order.status === 'canceled') {
        const newStatus = order.status === 'failed' ? 'falhou' : 'cancelado';
        console.log(`[Sync] Pedido com status ${order.status} na Pagar.me. Atualizando Supabase para ${newStatus}...`);
        
        await supabase
          .from('pagamentos')
          .update({ status: newStatus })
          .eq('id', paymentId);
          
        return res.json({ status: newStatus, updated: true });
      }

      console.log(`[Sync] O pedido ${paymentId} ainda está com status: ${order.status}`);
      res.json({ status: order.status, updated: false });
    } catch (error: any) {
      console.error('[Sync] Erro ao sincronizar pagamento:', error.response?.data || error.message);
      res.status(500).json({ error: 'Erro ao sincronizar com Pagar.me' });
    }
  });

  app.get("/api/admin/check-schema", async (req, res) => {
    try {
      const response = await fetch(`${supabaseUrl}/rest/v1/?apikey=${supabaseAnonKey}`);
      const data = await response.json();
      const tableSchema = data.definitions['aulas_experimentais'];
      res.json({ required: tableSchema ? tableSchema.required : 'Table not found' });
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  app.get("/api/admin/check-tables", async (req, res) => {
    try {
      const tables = ['responsaveis', 'alunos', 'matriculas', 'aulas_experimentais', 'ocorrencias', 'presencas'];
      const results: any = {};
      
      for (const table of tables) {
        // Try to get columns from information_schema
        const { data: colData, error: colError } = await supabase.rpc('get_table_columns', { table_name: table });
        
        let columns: string[] = [];
        if (!colError && colData) {
          columns = colData.map((c: any) => c.column_name);
        } else {
          // Fallback to select * limit 1
          const { data, error } = await supabase.from(table).select('*').limit(1);
          columns = data && data.length > 0 ? Object.keys(data[0]) : [];
        }

        console.log(`Table '${table}' columns:`, columns);
        results[table] = { 
          exists: true, // If we got here, we assume it exists or we'll get an error below
          columns,
          error: null
        };
      }
      
      return res.json(results);
    } catch (err: any) {
      console.error('Error in check-tables:', err);
      return res.status(500).json({ error: err.message });
    }
  });

  // Pagar.me Webhook
  app.post('/api/webhooks/pagarme', async (req, res) => {
    const event = req.body || {};
    const signature = req.headers['x-pagarme-signature'] as string;
    const secretKey = getPagarmeSecretKey();

    console.log(`[Webhook Pagar.me] Evento recebido: ${event.type}`);

    // Verificação de assinatura (opcional mas recomendado para produção)
    if (signature && secretKey) {
      try {
        const crypto = await import('crypto');
        const expectedSignature = crypto
          .createHmac('sha256', secretKey)
          .update(JSON.stringify(req.body))
          .digest('hex');
        
        if (signature !== expectedSignature) {
          console.warn(`[Webhook Pagar.me] Assinatura inválida detectada. Recebida: ${signature}, Esperada: ${expectedSignature}`);
          // Em modo de transição ou se houver dúvidas sobre o formato do body, apenas logamos o aviso
          // Em produção rigorosa, retornaríamos 401
        } else {
          console.log(`[Webhook Pagar.me] Assinatura verificada com sucesso.`);
        }
      } catch (e) {
        console.error(`[Webhook Pagar.me] Erro ao verificar assinatura:`, e);
      }
    }

    try {
      if (
        event.type === 'order.paid' || 
        event.type === 'charge.paid' || 
        event.type === 'order.payment_failed' ||
        event.type === 'charge.payment_failed' ||
        event.type === 'charge.created' ||
        event.type === 'charge.processing' ||
        event.type === 'invoice.paid' ||
        event.type === 'invoice.payment_failed' ||
        event.type === 'invoice.created' ||
        event.type === 'subscription.created' ||
        event.type === 'subscription.updated' ||
        event.type === 'subscription.canceled' ||
        event.type === 'subscription_item.created' ||
        event.type === 'charge.refunded' ||
        event.type === 'order.canceled'
      ) {
        const data = event.data;
        let paymentId = null;
        
        // Prioritize metadata if available
        if (data.metadata && data.metadata.payment_id) {
          paymentId = data.metadata.payment_id;
        } else if (data.order && data.order.metadata && data.order.metadata.payment_id) {
          paymentId = data.order.metadata.payment_id;
        } else if (data.subscription && data.subscription.metadata && data.subscription.metadata.payment_id) {
          paymentId = data.subscription.metadata.payment_id;
        } else if (data.invoice && data.invoice.subscription && data.invoice.subscription.metadata && data.invoice.subscription.metadata.payment_id) {
          paymentId = data.invoice.subscription.metadata.payment_id;
        }
        
        // Prioritize subscription code as it contains our UUID for recurrences
        if (!paymentId && data.subscription && data.subscription.code) {
          paymentId = data.subscription.code;
        } else if (!paymentId && data.invoice && data.invoice.subscription && data.invoice.subscription.code) {
          paymentId = data.invoice.subscription.code;
        } else if (!paymentId && data.order && data.order.code) {
          paymentId = data.order.code;
        } else if (!paymentId && data.code) {
          paymentId = data.code;
        }
        
        // Fallback to items if needed
        if (!paymentId && data.subscription && data.subscription.items && data.subscription.items.length > 0 && data.subscription.items[0].code) {
          paymentId = data.subscription.items[0].code;
        } else if (!paymentId && data.invoice && data.invoice.items && data.invoice.items.length > 0 && data.invoice.items[0].code) {
          paymentId = data.invoice.items[0].code;
        } else if (!paymentId && data.order && data.order.items && data.order.items.length > 0 && data.order.items[0].code) {
          paymentId = data.order.items[0].code;
        } else if (!paymentId && data.items && data.items.length > 0 && data.items[0].code) {
          paymentId = data.items[0].code;
        }

        // If still null, use the Pagar.me ID so we can fetch the original code via API
        if (!paymentId) {
          paymentId = data.id || (data.order && data.order.id) || (data.subscription && data.subscription.id);
        }
        
        if (!paymentId) {
          console.warn(`[Webhook Pagar.me] ALERTA: Não foi possível extrair o paymentId do evento ${event.type}. Payload:`, JSON.stringify(data, null, 2));
        } else {
          console.log(`[Webhook Pagar.me] Evento: ${event.type}, Code detectado: ${paymentId}`);
        }

        if (paymentId && (paymentId.startsWith('or_') || paymentId.startsWith('ch_') || paymentId.startsWith('sub_') || paymentId.startsWith('in_'))) {
          console.warn(`[Webhook Pagar.me] ALERTA: O code detectado (${paymentId}) parece ser um ID interno do Pagar.me, não o nosso UUID. Tentando buscar o código original da assinatura...`);
          
          try {
            const secretKey = getPagarmeSecretKey();
            const authHeader = Buffer.from(`${secretKey}:`).toString('base64');
            
            let subscriptionId = null;
            if (data.subscription && data.subscription.id) {
              subscriptionId = data.subscription.id;
            } else if (data.invoice && (data.invoice.subscription_id || data.invoice.subscriptionId)) {
              subscriptionId = data.invoice.subscription_id || data.invoice.subscriptionId;
            } else if (data.subscription_id) {
              subscriptionId = data.subscription_id;
            }
            
            if (subscriptionId) {
              console.log(`[Webhook Pagar.me] Buscando detalhes da assinatura ${subscriptionId} na API...`);
              const axios = await import('axios');
              const response = await axios.default.get(`https://api.pagar.me/core/v5/subscriptions/${subscriptionId}`, {
                headers: {
                  'Authorization': `Basic ${authHeader}`
                }
              });
              
              if (response.data && response.data.code) {
                console.log(`[Webhook Pagar.me] Código original recuperado com sucesso: ${response.data.code}`);
                paymentId = response.data.code;
              }
            } else if (data.order && data.order.id) {
              console.log(`[Webhook Pagar.me] Buscando detalhes do pedido ${data.order.id} na API...`);
              const axios = await import('axios');
              const response = await axios.default.get(`https://api.pagar.me/core/v5/orders/${data.order.id}`, {
                headers: {
                  'Authorization': `Basic ${authHeader}`
                }
              });
              
              if (response.data && response.data.code) {
                console.log(`[Webhook Pagar.me] Código original recuperado do pedido com sucesso: ${response.data.code}`);
                paymentId = response.data.code;
              }
            } else if (data.id && data.id.startsWith('ch_')) {
              console.log(`[Webhook Pagar.me] Buscando detalhes da cobrança ${data.id} na API...`);
              const axios = await import('axios');
              const response = await axios.default.get(`https://api.pagar.me/core/v5/charges/${data.id}`, {
                headers: {
                  'Authorization': `Basic ${authHeader}`
                }
              });
              
              if (response.data && response.data.code) {
                console.log(`[Webhook Pagar.me] Código original recuperado da cobrança com sucesso: ${response.data.code}`);
                paymentId = response.data.code;
              } else if (response.data && response.data.order && response.data.order.code) {
                console.log(`[Webhook Pagar.me] Código original recuperado do pedido da cobrança com sucesso: ${response.data.order.code}`);
                paymentId = response.data.order.code;
              }
            }
          } catch (err: any) {
            console.error(`[Webhook Pagar.me] Erro ao buscar código original da assinatura:`, err.message);
          }
        }

        let originalCode = paymentId;
        
        if (originalCode && originalCode.startsWith('loja_')) {
          console.log(`[Webhook Pagar.me] Processando pagamento da loja: ${originalCode}`);
          const parts = originalCode.split('_');
          const realPedidoId = parts[1];
          
          const isPaid = 
            event.type === 'order.paid' || 
            event.type === 'invoice.paid';
            
          const isFailed = 
            event.type === 'order.payment_failed' || 
            event.type === 'invoice.payment_failed' ||
            event.type === 'charge.payment_failed' ||
            event.type === 'charge.failed' ||
            (data.last_transaction && (data.last_transaction.success === false || data.last_transaction.status === 'not_authorized'));
            
          const isCanceled = 
            event.type === 'order.canceled' ||
            event.type === 'charge.canceled';

          if (isPaid) {
            const { data: currentOrder } = await supabase
              .from('loja_pedidos')
              .select('status')
              .eq('id', realPedidoId)
              .maybeSingle();
            
            if (currentOrder && currentOrder.status !== 'pago') {
              await supabase
                .from('loja_pedidos')
                .update({ status: 'pago' })
                .eq('id', realPedidoId);
              
              await processarBaixaEstoquePedido(realPedidoId);
              
              // Notificar cliente
              sendLojaNotificationByPedidoId(realPedidoId, 'pago');
            }
          } else if (isCanceled || isFailed) {
            const { data: currentOrder } = await supabase
              .from('loja_pedidos')
              .select('status')
              .eq('id', realPedidoId)
              .maybeSingle();

            if (currentOrder && currentOrder.status !== 'cancelado' && currentOrder.status !== 'falha') {
              await supabase
                .from('loja_pedidos')
                .update({ status: isCanceled ? 'cancelado' : 'falha' })
                .eq('id', realPedidoId);

              // Notificar cliente sobre falha
              sendLojaNotificationByPedidoId(realPedidoId, 'falha');
            }
          }
          
          return res.status(200).json({ received: true, type: 'loja' });
        }
        
        if (originalCode && originalCode.startsWith('evento_')) {
          console.log(`[Webhook Pagar.me] Processando pagamento de evento: ${originalCode}`);
          const parts = originalCode.split('_');
          const realEventoId = parts[1];
          
          const isPaid = 
            event.type === 'order.paid' || 
            event.type === 'invoice.paid';
            
          const isFailed = 
            event.type === 'order.payment_failed' || 
            event.type === 'invoice.payment_failed' ||
            event.type === 'charge.payment_failed' ||
            event.type === 'charge.failed' ||
            (data.last_transaction && (data.last_transaction.success === false || data.last_transaction.status === 'not_authorized'));
            
          const isCanceled = 
            event.type === 'order.canceled' ||
            event.type === 'charge.canceled';

          if (isPaid) {
            const { data: currentInscricao } = await supabase
              .from('evento_inscricoes')
              .select('*, eventos(*)')
              .eq('id', realEventoId)
              .maybeSingle();
            
            if (currentInscricao && (!currentInscricao.taxa_paga || currentInscricao.status !== 'confirmada')) {
              await supabase
                .from('evento_inscricoes')
                .update({ status: 'confirmada', taxa_paga: true })
                .eq('id', realEventoId);
                
              // Enviar notificação de pagamento confirmado via WhatsApp
              if (currentInscricao.eventos) {
                try {
                  const targetPhone = currentInscricao.telefone_responsavel || (currentInscricao.respostas_personalizadas as any)?.['WhatsApp do Responsável'];
                  if (targetPhone) {
                    const numInscricao = currentInscricao.numero_inscricao || String(currentInscricao.id).padStart(6, '0');
                    const dataEv = new Date(currentInscricao.eventos.data_inicio);
                    const dataFormatada = dataEv.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', day: 'numeric', month: 'long', year: 'numeric' });
                    const horaFormatada = dataEv.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' });
                    
                    const msg = `Olá, ${currentInscricao.nome_responsavel}!\n` +
                      `Sua inscrição no evento *${currentInscricao.eventos.titulo}* teve o pagamento confirmado com sucesso! 🎉\n\n` +
                      `*Detalhes da Inscrição:*\n` +
                      `- Código: ${numInscricao}\n` +
                      `- Aluno(a): ${currentInscricao.nome_aluno}\n` +
                      `- Categoria: ${currentInscricao.categoria || 'Geral'}\n\n` +
                      `*Detalhes do Evento:*\n` +
                      `- Data: ${dataFormatada} às ${horaFormatada}h\n` +
                      `- Local: ${currentInscricao.eventos.local || 'A definir'}\n\n` +
                      `Sua participação está garantida! Te esperamos lá!`;
                      
                    await sendWhatsAppMessage(targetPhone, currentInscricao.nome_responsavel, msg, currentInscricao.unidade).catch(e => 
                      console.error('[WhatsApp Webhook Eventos] Falha ao enviar:', e)
                    );
                  }
                } catch (err) {
                  console.error('[WhatsApp Webhook Eventos] Falha ao montar/enviar mensagem:', err);
                }
              }
            }
          } else if (isCanceled || isFailed) {
            const { data: currentInscricao } = await supabase
              .from('evento_inscricoes')
              .select('status')
              .eq('id', realEventoId)
              .maybeSingle();

            if (currentInscricao && currentInscricao.status !== 'cancelada' && currentInscricao.status !== 'falha') {
              await supabase
                .from('evento_inscricoes')
                .update({ status: isCanceled ? 'cancelada' : 'falha', taxa_paga: false })
                .eq('id', realEventoId);
            }
          }
          
          return res.status(200).json({ received: true, type: 'evento' });
        }
        
        const isRecurringCode = paymentId && /-\d+$/.test(paymentId);
        
        // Don't split if it's a recurring code (e.g., -02, -03), so the recurring block can handle finding the next pending installment
        if (paymentId && paymentId.includes('_') && !paymentId.startsWith('enroll_') && !paymentId.startsWith('or_') && !paymentId.startsWith('ch_') && !paymentId.startsWith('sub_') && !paymentId.startsWith('in_')) {
          if (!isRecurringCode) {
            paymentId = paymentId.split('_')[0];
          }
        }

        if (paymentId && !paymentId.startsWith('enroll_')) {
          console.log(`[Webhook Pagar.me] Processando pagamento: ${paymentId}`);
          
          const isPaid = 
            event.type === 'order.paid' || 
            event.type === 'charge.paid' || 
            event.type === 'invoice.paid' ||
            ((event.type === 'subscription.created' || event.type === 'subscription.updated') && data.status === 'active');
            
          const isFailed = 
            event.type === 'order.payment_failed' || 
            event.type === 'invoice.payment_failed' ||
            event.type === 'charge.payment_failed' ||
            event.type === 'charge.failed' ||
            event.type === 'charge.antifraud_reproval' ||
            event.type === 'charge.antifraud_reproved' ||
            (data.last_transaction && (data.last_transaction.success === false || data.last_transaction.status === 'not_authorized'));

          const isCanceled = 
            event.type === 'subscription.canceled' || 
            event.type === 'order.canceled' ||
            event.type === 'charge.canceled' ||
            event.type === 'invoice.canceled';

          const isRefunded = event.type === 'charge.refunded';
          const isCreated = event.type === 'invoice.created';
          
          if (!isPaid && !isFailed && !isCanceled && !isRefunded && !isCreated) {
            console.log(`[Webhook Pagar.me] Evento ignorado (não é pago, falha, cancelamento, estorno nem criação). Status: ${data.status}`);
            return res.status(200).json({ received: true });
          }

          const status = isPaid ? 'pago' : (isCanceled ? 'cancelado' : (isRefunded ? 'estornado' : (isCreated ? 'pendente' : 'falha')));

          // Check if it's a recurring payment (cycle > 1) OR a split subscription (cycle 1 is the 2nd payment)
          const invoice = data.invoice || (data.charges && data.charges[0] && data.charges[0].invoice) || (event.type === 'invoice.paid' || event.type === 'invoice.created' ? data : null);
          const isSubscription = !!(data.subscription_id || (invoice && (invoice.subscription_id || invoice.subscription || invoice.subscriptionId)) || event.type.startsWith('subscription.'));
          
          let cycleNum = 1;
          if (invoice && invoice.cycle) {
            cycleNum = typeof invoice.cycle === 'object' ? invoice.cycle.cycle : invoice.cycle;
          } else if (data.current_cycle) {
            cycleNum = data.current_cycle;
          }

          let targetPaymentId = paymentId;
          
          const isSplitSubscription = originalCode && originalCode.includes('_sub_');

          // 1. Tenta atualização completa
          // Extrair o valor real do evento (em centavos → reais)
          const eventAmount = (() => {
            const raw = 
              data.amount ||
              invoice?.amount ||
              data.charge?.amount ||
              (data.charges && data.charges[0]?.amount) ||
              data.last_transaction?.amount ||
              null;
            return raw != null ? Number(raw) / 100 : null;
          })();

          const updatePayload: any = { 
            status: status
          };

          // Sempre atualizar o valor quando o evento trouxer um amount válido
          if (eventAmount != null && eventAmount > 0) {
            updatePayload.valor = eventAmount;
          }
          
          const invoiceId = invoice?.id || invoice?.invoice_id || data.invoice_id || (data.id && data.id.startsWith('in_') ? data.id : null);
          const pagarmeId = data.charge?.id || data.id;
          const identifierId = invoiceId || pagarmeId;

          if (isPaid || isFailed || isCreated) {
            updatePayload.pagarme = identifierId;
            if (isPaid) {
              updatePayload.data_pagamento = new Date().toISOString();
            }
          }

          if (isFailed) {
            updatePayload.motivo_falha = 
              data.last_transaction?.gateway_response?.errors?.[0]?.message || 
              data.last_transaction?.acquirer_message || 
              data.antifraud_response?.message ||
              data.message ||
              (event.type === 'charge.antifraud_reproval' || event.type === 'charge.antifraud_reproved' ? "Reprovado pelo sistema de antifraude." : "Transação recusada pela operadora do cartão.");
          }

          const isRecurringCodeBlock = originalCode && /-\d+$/.test(originalCode);
          if ((isSubscription || isRecurringCodeBlock) && (cycleNum >= 1 || isSplitSubscription || isRecurringCodeBlock)) {
            console.log(`[Webhook Pagar.me] Pagamento recorrente ou split detectado. Ciclo: ${cycleNum}, Split: ${isSplitSubscription}`);

            const subscriptionId = data.subscription_id || (invoice && (invoice.subscription_id || invoice.subscription || invoice.subscriptionId)) || (data.subscription && data.subscription.id);
            let matriculaId = null;

            if (subscriptionId) {
              const { data: matBySub, error: matSubError } = await supabase
                .from('matriculas')
                .select('id')
                .eq('pagarme_subscription_id', subscriptionId)
                .maybeSingle();

              if (matSubError) {
                console.error(`[Webhook Pagar.me] Erro ao buscar matrícula pela assinatura ${subscriptionId}:`, matSubError);
              }
              if (matBySub) {
                matriculaId = matBySub.id;
                console.log(`[Webhook Pagar.me] Matrícula encontrada diretamente pela assinatura Pagar.me (${subscriptionId}): ${matriculaId}`);
              }
            }

            // Extrair ID base para busca de pagamento original (necessário para achar a matrícula se falhar acima, e para o ciclo 1)
            const baseUUIDMatch = paymentId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
            const searchId = baseUUIDMatch ? baseUUIDMatch[0] : paymentId;
            const isValidUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(searchId);

            if (!matriculaId && isValidUUID) {
              console.log(`[Webhook Pagar.me] Buscando pagamento original: ${searchId}`);
              const { data: originalPayment, error: originalError } = await supabase
                .from('pagamentos')
                .select('matricula_id')
                .eq('id', searchId)
                .maybeSingle();

              if (originalError) {
                console.error(`[Webhook Pagar.me] Erro ao buscar pagamento original:`, originalError);
              }
              if (originalPayment && originalPayment.matricula_id) {
                matriculaId = originalPayment.matricula_id;
                console.log(`[Webhook Pagar.me] Matrícula encontrada via pagamento original: ${matriculaId}`);
              }
            }

            if (cycleNum === 1 && !isSplitSubscription) {
              // Para o ciclo 1, sempre atualizamos o pagamento original criado na matrícula
              if (isValidUUID) {
                targetPaymentId = searchId;
                console.log(`[Webhook Pagar.me] Ciclo 1: Atualizando pagamento original (${targetPaymentId})`);
              }
            } else if (matriculaId) {
              // Para ciclos 2+, buscamos se já criamos o registro para este invoiceId
              if (invoiceId) {
                const { data: existingPayment } = await supabase
                  .from('pagamentos')
                  .select('id')
                  .eq('pagarme', invoiceId)
                  .eq('matricula_id', matriculaId)
                  .maybeSingle();

                if (existingPayment) {
                  targetPaymentId = existingPayment.id;
                  console.log(`[Webhook Pagar.me] Parcela recorrente já existente encontrada (Invoice ${invoiceId}): ${targetPaymentId}`);
                } else {
                  console.log(`[Webhook Pagar.me] Nenhuma parcela existente encontrada para a fatura ${invoiceId}. Criando novo registro...`);
                  // Fetch matrícula details to create a new payment
                  const { data: matricula, error: matError } = await supabase
                    .from('matriculas')
                    .select('aluno_id, turma, unidade, alunos(responsavel_id)')
                    .eq('id', matriculaId)
                    .single();
                    
                  if (matError) {
                    console.error(`[Webhook Pagar.me] Erro ao buscar matricula para novo pagamento:`, matError);
                  }

                  if (matricula) {
                    const newPayment = {
                      matricula_id: matriculaId,
                      responsavel_id: (matricula as any).alunos?.responsavel_id,
                      aluno_id: matricula.aluno_id,
                      status: status,
                      metodo_pagamento: 'cartão',
                      valor: eventAmount || (data.amount ? data.amount / 100 : 0),
                      data_vencimento: new Date().toISOString(),
                      pagarme: identifierId,
                      data_pagamento: isPaid ? new Date().toISOString() : null
                    };
                    
                    const { data: insertedPayment, error: insertError } = await supabase
                      .from('pagamentos')
                      .insert([newPayment])
                      .select();
                      
                    if (insertError) {
                      console.error(`[Webhook Pagar.me] Erro ao criar novo pagamento:`, insertError);
                    }

                    if (insertedPayment && insertedPayment.length > 0) {
                      targetPaymentId = insertedPayment[0].id;
                      console.log(`[Webhook Pagar.me] Novo registro de pagamento criado: ${targetPaymentId}`);
                    }
                  }
                }
              } else {
                console.log(`[Webhook Pagar.me] Ciclo recorrente, mas sem invoiceId válido. Usando target = ${targetPaymentId}`);
              }
            } else {
              console.log(`[Webhook Pagar.me] Matrícula não encontrada via assinatura ou pagamento original. Impossível tratar parcela recorrente.`);
            }
          }

          const { error: pError } = await supabase
            .from('pagamentos')
            .update(updatePayload)
            .eq('id', targetPaymentId);

          if (pError) {
            console.warn(`[Webhook Pagar.me] Erro na atualização: ${pError.message}. Tentando apenas status...`);
            await supabase.from('pagamentos').update({ status: status }).eq('id', targetPaymentId);
          }
          
          if (isCreated) {
            // Se for uma nova fatura de assinatura PIX, envia o QR Code
            const invoiceData = data; // data é a fatura
            const order = invoiceData.order;
            const charge = order?.charges?.[0];
            const lastTransaction = charge?.last_transaction;
            
            if (lastTransaction && lastTransaction.transaction_type === 'pix') {
              const qrCodeUrl = lastTransaction.qr_code_url;
              const qrCode = lastTransaction.qr_code;
              
              // Busca dados do responsável para enviar WhatsApp
              const { data: paymentData } = await supabase
                .from('pagamentos')
                .select('responsavel_id, matricula_id, data_vencimento')
                .eq('id', targetPaymentId)
                .single();
              
              if (paymentData && paymentData.responsavel_id) {
                const { data: guardian } = await supabase
                  .from('responsaveis')
                  .select('nome_completo, telefone')
                  .eq('id', paymentData.responsavel_id)
                  .single();
                
                if (guardian && guardian.telefone) {
                  const { data: matricula } = await supabase
                    .from('matriculas')
                    .select('aluno_id, unidade')
                    .eq('id', paymentData.matricula_id)
                    .single();
                  
                  const { data: student } = await supabase
                    .from('alunos')
                    .select('nome_completo')
                    .eq('id', matricula?.aluno_id)
                    .single();
                  
                  const vencimentoStr = paymentData.data_vencimento ? new Date(paymentData.data_vencimento).toLocaleDateString('pt-BR') : 'não informada';
                  const msg = `Olá, *${guardian.nome_completo}*! Sua mensalidade de *${student?.nome_completo || 'seu filho(a)'}* com vencimento em *${vencimentoStr}* foi gerada.\n\nVocê pode pagar via PIX utilizando o QR Code abaixo:\n\n${qrCodeUrl}\n\nOu copie e cole o código:\n\n${qrCode}`;
                  
                  await sendWhatsAppMessage(guardian.telefone, guardian.nome_completo, msg, matricula?.unidade)
                    .catch(e => console.error("[Webhook Pagar.me] Erro ao enviar QR Code PIX:", e));
                }
              }
            }
            return res.status(200).json({ received: true });
          }

          if (isPaid) {
            // 2. Notificações e Ativação de Matrícula
            const { data: paymentData } = await supabase
              .from('pagamentos')
              .select('responsavel_id, matricula_id')
              .eq('id', targetPaymentId)
              .single();

            if (paymentData && paymentData.matricula_id) {
              // Check if matricula is currently pending
              const { data: matricula } = await supabase
                .from('matriculas')
                .select('status, turma_id, unidade, turma, created_at, aluno_id')
                .eq('id', paymentData.matricula_id)
                .single();

              if (matricula && (matricula.status || '').toLowerCase() === 'pendente') {
                console.log(`[Webhook Pagar.me] Tentando ativar matrícula ${paymentData.matricula_id}...`);
                
                // Update matricula status to 'ativo' and set data_matricula ONLY if it is currently pending
                const { data: updatedMatricula, error: updateError } = await supabase
                  .from('matriculas')
                  .update({ 
                    status: 'ativo',
                    data_matricula: new Date().toISOString()
                  })
                  .eq('id', paymentData.matricula_id)
                  .in('status', ['pendente', 'Pendente'])
                  .select()
                  .maybeSingle();


                if (!updatedMatricula) {
                  console.log(`[Webhook Pagar.me] Matrícula ${paymentData.matricula_id} já foi ativada por outro evento. Ignorando notificações duplicadas.`);
                  return res.status(200).json({ received: true, message: "Matrícula já ativada" });
                }

                console.log(`[Webhook Pagar.me] Matrícula ${paymentData.matricula_id} ativada com sucesso. Preparando notificações...`);

                // Fetch class data for values
                const { data: classData } = await supabase
                  .from('turmas')
                  .select('valor_mensalidade, precos_unidade')
                  .eq('id', matricula.turma_id)
                  .maybeSingle();

                // Fetch first payment for actual charged value
                const { data: firstPayment } = await supabase
                  .from('pagamentos')
                  .select('valor')
                  .eq('matricula_id', paymentData.matricula_id)
                  .order('data_vencimento', { ascending: true })
                  .limit(1)
                  .maybeSingle();

                const valorSistema = classData?.precos_unidade?.[matricula.unidade] ?? (classData?.valor_mensalidade || 0);
                const valorPadrao = valorSistema * 1.10;
                const descontoTaxaZero = valorSistema * 0.10;
                const valorCheio = valorSistema;
                const valorMatricula = firstPayment?.valor || valorSistema;

                // Fetch guardian and student details for notifications
                const { data: guardian } = await supabase
                  .from('responsaveis')
                  .select('*')
                  .eq('id', paymentData.responsavel_id)
                  .single();

                const { data: student } = await supabase
                  .from('alunos')
                  .select('nome_completo, turma_complementar, unidade')
                  .eq('id', matricula.aluno_id)
                  .single();

                if (guardian) {
                  // Send WhatsApp
                  if (guardian.telefone) {
                    const guardianName = (guardian.nome_completo || '').trim();
                    const studentName = student?.nome_completo || 'seu filho(a)';
                    let identidade = `*Sport for Kids* (${matricula.unidade})`;
                    if (matricula.unidade) {
                      const { data: mappingData } = await supabase
                        .from('unidades_mapping')
                        .select('identidade')
                        .eq('nome', matricula.unidade.trim())
                        .limit(1)
                        .maybeSingle();
                      
                      if (mappingData && mappingData.identidade) {
                        identidade = mappingData.identidade.replace(/^na\s+/i, '');
                      } else {
                        const { data: fallbackMapping } = await supabase
                          .from('unidades_mapping')
                          .select('identidade')
                          .eq('nome_unidade', matricula.unidade.trim())
                          .limit(1)
                          .maybeSingle();
                        if (fallbackMapping && fallbackMapping.identidade) {
                          identidade = fallbackMapping.identidade.replace(/^na\s+/i, '');
                        }
                      }
                    }

                    const whatsappMsg = `Olá, ${guardianName} Que alegria ter vocês com a gente! 🎉
A matrícula de ${studentName} em ${matricula.turma} em ${identidade} foi confirmada com sucesso. Já estamos preparando tudo para que essa jornada seja incrível.🏆

Se tiver qualquer dúvida sobre as aulas, horários ou o que levar, é só responder essa mensagem. Seja muito bem-vindo(a) ao nosso time! 🏆`;

                    await sendWhatsAppMessage(
                      guardian.telefone,
                      guardian.nome_completo,
                      whatsappMsg,
                      matricula.unidade
                    ).catch(e => console.error("Erro ao enviar WhatsApp de confirmação:", e));
                  }

                  // Send Email with PDF
                  if (guardian.email) {
                    try {
                      const { data: termsData } = await supabase
                        .from('configuracoes')
                        .select('valor')
                        .eq('chave', 'terms_template')
                        .maybeSingle();

                      let termsText = termsData?.valor || "Termos e condições não definidos.";
                      
                      // Format address
                      let formattedAddress = "Não informado";
                      if (guardian.endereco) {
                        try {
                          const addr = typeof guardian.endereco === 'string' ? JSON.parse(guardian.endereco) : guardian.endereco;
                          const street = addr.logradouro || addr.street || '';
                          const number = addr.numero || addr.number || '';
                          const complement = addr.complemento || addr.complement ? ` - ${addr.complemento || addr.complement}` : '';
                          const neighborhood = addr.bairro || addr.neighborhood || '';
                          const city = addr.cidade || addr.city || '';
                          const state = addr.estado || addr.state || '';
                          const zip = addr.cep || addr.zipCode || '';
                          
                          formattedAddress = `${street}, ${number}${complement}, ${neighborhood}, ${city}/${state}, CEP: ${zip}`;
                        } catch (e) {
                          formattedAddress = String(guardian.endereco);
                        }
                      }

                      // Helper to format currency
                      const formatCurrency = (val: number) => 
                        new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

                      const replacements: Record<string, string> = {
                        "NOME_RESPONSAVEL": guardian.nome_completo || "",
                        "RESPONSAVEL": guardian.nome_completo || "",
                        "CPF_RESPONSAVEL": guardian.cpf || "",
                        "CPF": guardian.cpf || "",
                        "EMAIL_RESPONSAVEL": guardian.email || "",
                        "TELEFONE_RESPONSAVEL": guardian.telefone || "",
                        "ENDERECO_RESPONSAVEL": formattedAddress,
                        "ENDERECO": formattedAddress,
                        "NOME_ALUNO": student?.nome_completo || "",
                        "ESTUDANTE": student?.nome_completo || "",
                        "TURMA": matricula.turma || "",
                        "CURSO": matricula.turma || "",
                        "UNIDADE": matricula.unidade || "",
                        "DATA_MATRICULA": new Date(matricula.created_at).toLocaleDateString('pt-BR'),
                        "VALOR PADRAO": formatCurrency(valorPadrao),
                        "VALOR CHEIO": formatCurrency(valorCheio),
                        "VALOR LIQUIDO": formatCurrency(valorMatricula),
                        "VALOR": formatCurrency(valorMatricula),
                        "desconto taxa zero": formatCurrency(descontoTaxaZero)
                      };

                      // Apply replacements for both {{}} and [] formats
                      for (const [key, value] of Object.entries(replacements)) {
                        const regexBraces = new RegExp(`{{${key}}}`, 'g');
                        const regexBrackets = new RegExp(`\\[${key}\\]`, 'g');
                        termsText = termsText.replace(regexBraces, value).replace(regexBrackets, value);
                      }

                      const pdfBuffer = await generatePDFBuffer(termsText);
                      const base64Pdf = pdfBuffer.toString('base64');

                      const emailHtml = `
                        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                          <h1 style="color: #2563eb;">Confirmação de Matrícula</h1>
                          <p>Olá <strong>${guardian.nome_completo}</strong>,</p>
                          <p>Recebemos a confirmação do seu pagamento e a matrícula de <strong>${student?.nome_completo || 'seu filho(a)'}</strong> foi <strong>ativada com sucesso</strong>!</p>
                          <p>Em anexo, enviamos o contrato de prestação de serviços para seus registros.</p>
                          <br/>
                          <p>Seja muito bem-vindo à Sport for Kids!</p>
                          <p>Atenciosamente,<br/>Equipe Sport for Kids</p>
                        </div>
                      `;

                      await sendBrevoEmail(
                        guardian.email,
                        guardian.nome_completo,
                        "Confirmação de Matrícula - Sport for Kids",
                        emailHtml,
                        [{ content: base64Pdf, name: 'Contrato_SportForKids.pdf' }],
                        matricula.unidade
                      );
                    } catch (emailError) {
                      console.error("Erro ao gerar PDF ou enviar email de confirmação:", emailError);
                    }
                  }
                }
              } else {
                console.log(`[Webhook Pagar.me] Matrícula ${paymentData.matricula_id} já está ativa ou cancelada. Nenhuma notificação de boas-vindas enviada.`);
              }
            }
          } else if (isFailed) {
            // Handle failed payment -> cancel matricula if it was pending
            const { data: paymentData } = await supabase
              .from('pagamentos')
              .select('responsavel_id, matricula_id')
              .eq('id', targetPaymentId)
              .single();

            if (paymentData && paymentData.matricula_id) {
              const { data: matricula } = await supabase
                .from('matriculas')
                .select('status, turma, aluno_id, unidade')
                .eq('id', paymentData.matricula_id)
                .single();

              if (matricula && matricula.status === 'pendente') {
                console.log(`[Webhook Pagar.me] Cancelando matrícula ${paymentData.matricula_id} devido a falha no pagamento...`);
                await supabase
                  .from('matriculas')
                  .update({ 
                    status: 'cancelado',
                    data_cancelamento: new Date().toISOString()
                  })
                  .eq('id', paymentData.matricula_id);

                // Fetch student details for notification
                const { data: student } = await supabase
                  .from('alunos')
                  .select('nome_completo')
                  .eq('id', matricula.aluno_id)
                  .single();

                const failureReason = 
                  data.last_transaction?.gateway_response?.errors?.[0]?.message || 
                  data.last_transaction?.acquirer_message || 
                  data.antifraud_response?.message ||
                  data.message ||
                  (event.type === 'charge.antifraud_reproval' || event.type === 'charge.antifraud_reproved' ? "Reprovado pelo sistema de antifraude." : "Transação recusada pela operadora do cartão.");

                await sendPaymentFailureNotification(
                  paymentData.responsavel_id,
                  student?.nome_completo || "Estudante",
                  matricula.turma || "Turma não identificada",
                  failureReason,
                  matricula.unidade,
                  paymentData.matricula_id
                );
              } else if (matricula && (matricula.status || '').toLowerCase() === 'ativo') {
                console.log(`[Webhook Pagar.me] Falha em pagamento recorrente da matrícula ${paymentData.matricula_id}. Enviando notificação...`);
                
                const { data: student } = await supabase
                  .from('alunos')
                  .select('nome_completo')
                  .eq('id', matricula.aluno_id)
                  .single();

                const failureReason = 
                  data.last_transaction?.gateway_response?.errors?.[0]?.message || 
                  data.last_transaction?.acquirer_message || 
                  data.antifraud_response?.message ||
                  data.message ||
                  (event.type === 'charge.antifraud_reproval' || event.type === 'charge.antifraud_reproved' ? "Reprovado pelo sistema de antifraude." : "Transação recusada pela operadora do cartão.");

                await sendRecurringPaymentFailureNotification(
                  paymentData.responsavel_id,
                  student?.nome_completo || "Estudante",
                  matricula.turma || "Turma não identificada",
                  failureReason,
                  matricula.unidade,
                  paymentData.matricula_id
                );
              }
            }
          } else if (isCanceled || isRefunded) {
            // 4. Cancelamento de Matrícula via Webhook de Assinatura, Pedido ou Estorno
            const subscriptionId = data.id || (data.subscription && data.subscription.id);
            const orderId = data.id || (data.order && data.order.id);
            
            if (subscriptionId && subscriptionId.startsWith('sub_')) {
              console.log(`[Webhook Pagar.me] Assinatura ${subscriptionId} cancelada/estornada. Atualizando matrícula...`);
              
              // Find the enrollment to get its ID for payment cancellation
              const { data: mData } = await supabase
                .from('matriculas')
                .select('id')
                .eq('pagarme_subscription_id', subscriptionId)
                .maybeSingle();

              await supabase
                .from('matriculas')
                .update({ 
                  status: 'cancelado',
                  data_cancelamento: new Date().toISOString()
                })
                .eq('pagarme_subscription_id', subscriptionId);

              if (mData && mData.id) {
                await supabase
                  .from('pagamentos')
                  .update({ status: 'cancelado' })
                  .eq('matricula_id', mData.id)
                  .eq('status', 'pendente');
              }
            } else if (orderId && (orderId.startsWith('or_') || orderId.startsWith('ch_'))) {
              console.log(`[Webhook Pagar.me] Pedido/Cobrança ${orderId} cancelado/estornado. Atualizando matrícula...`);
              // Find the payment to get the matricula_id
              const { data: pData } = await supabase
                .from('pagamentos')
                .select('matricula_id')
                .eq('pagarme', orderId)
                .maybeSingle();
              
              if (pData && pData.matricula_id) {
                await supabase
                  .from('matriculas')
                  .update({ 
                    status: 'cancelado',
                    data_cancelamento: new Date().toISOString()
                  })
                  .eq('id', pData.matricula_id);

                await supabase
                  .from('pagamentos')
                  .update({ status: 'cancelado' })
                  .eq('matricula_id', pData.matricula_id)
                  .eq('status', 'pendente');
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('[Webhook Pagar.me] Erro ao processar webhook:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
    
    return res.status(200).json({ received: true });
  });

const superNormalize = (t: any) => 
  String(t || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, '');

async function syncWixRecurringPayments() {
  console.log('[Cron] Iniciando sincronização do Wix API (Recurring Payments)...');
  const apiKey = process.env.WIX_API_KEY;
  const accountId = process.env.WIX_ACCOUNT_ID;
  const siteIds = [];
  if (process.env.WIX_SITE_ID) siteIds.push(process.env.WIX_SITE_ID);
  else siteIds.push('b4fb0ff7-7e69-4f24-8cd5-5551ce7720b1');
  
  if (process.env.WIX_SITE_ID_2) siteIds.push(process.env.WIX_SITE_ID_2);

  if (!apiKey || !accountId) {
    console.error('[Cron] Erro: Variáveis WIX_API_KEY ou WIX_ACCOUNT_ID ausentes.');
    return;
  }

  // PRE-FETCH CACHES (avoid N+1 queries in loops)
  console.log('[Cron] Carregando caches do banco de dados para sincronização em lote...');
  const allExisting: any[] = [];
  let dbPage = 0;
  const dbPageSize = 1000;
  let hasMoreDb = true;
  while (hasMoreDb) {
    const { data: chunk, error: errExist } = await supabase
      .from('pagamentos_wix')
      .select('id, status_transacao, id_provedor_pagamento, aluno_id, matricula_id, turma_id, responsavel_id, cobranca_email, produto_nome, provedor_pagamento, data_pagamento_gmt_03, data_transacao_gmt_03, id_pedido, tipo_pedido')
      .range(dbPage * dbPageSize, (dbPage + 1) * dbPageSize - 1);
      
    if (errExist) {
      console.error('[Cron] Erro ao carregar pagamentos_wix:', errExist.message);
      break;
    }
    if (!chunk || chunk.length === 0) {
      hasMoreDb = false;
    } else {
      allExisting.push(...chunk);
      if (chunk.length < dbPageSize) {
        hasMoreDb = false;
      } else {
        dbPage++;
      }
    }
  }
  
  const existingMap = new Map<string, any>();
  const signatureMap = new Map<string, any>();
  for (const row of allExisting) {
    if (row.id_provedor_pagamento) {
      existingMap.set(row.id_provedor_pagamento, row);
    }
    const studentOrEmail = row.aluno_id || (row.cobranca_email || '').toLowerCase().trim();
    const date = row.data_pagamento_gmt_03 || row.data_transacao_gmt_03 || '';
    if (studentOrEmail && date && row.produto_nome) {
      const month = date.substring(0, 7);
      const plan = superNormalize(row.produto_nome);
      const sig = `${studentOrEmail}|${month}|${plan}`;
      
      const existingInSig = signatureMap.get(sig);
      if (!existingInSig) {
        signatureMap.set(sig, row);
      } else {
        const isCronA = existingInSig.provedor_pagamento === 'Wix API Cron' || String(existingInSig.id_provedor_pagamento).includes('-cycle-');
        const isCronB = row.provedor_pagamento === 'Wix API Cron' || String(row.id_provedor_pagamento).includes('-cycle-');
        
        if (isCronA && !isCronB) {
          signatureMap.set(sig, row);
        } else if (isCronA === isCronB) {
          const statusA = (existingInSig.status_transacao || '').toLowerCase();
          const statusB = (row.status_transacao || '').toLowerCase();
          const isFailA = statusA.includes('falh') || statusA.includes('recus');
          const isFailB = statusB.includes('falh') || statusB.includes('recus');
          
          if (!isFailA && isFailB) {
            signatureMap.set(sig, row);
          }
        }
      }
    }
  }
  const orderToStudentMap = new Map<string, string>();
  for (const row of allExisting) {
    if (row.id_pedido && row.aluno_id) {
      orderToStudentMap.set(row.id_pedido, row.aluno_id);
    }
  }

  const { data: allResponsaveis, error: errResp } = await supabase.from('responsaveis').select('id, nome_completo, telefone, email');
  if (errResp) console.error('[Cron] Erro ao carregar responsaveis:', errResp.message);
  
  const responsaveisMap = new Map<string, any>();
  const responsavelIdToEmail = new Map<string, string>();
  if (allResponsaveis) {
    for (const r of allResponsaveis) {
      if (r.email) {
        const emailKey = r.email.trim().toLowerCase();
        responsaveisMap.set(emailKey, r);
        if (r.id) {
          responsavelIdToEmail.set(r.id, emailKey);
        }
      }
    }
  }

  const { data: allAlunos, error: errAlun } = await supabase.from('alunos').select('id, responsavel_id');
  if (errAlun) console.error('[Cron] Erro ao carregar alunos:', errAlun.message);
  
  const alunosByParentEmail = new Map<string, any[]>();
  if (allAlunos) {
    for (const a of allAlunos) {
      if (a.responsavel_id) {
        const emailKey = responsavelIdToEmail.get(a.responsavel_id);
        if (emailKey) {
          const list = alunosByParentEmail.get(emailKey) || [];
          list.push(a);
          alunosByParentEmail.set(emailKey, list);
        }
      }
    }
  }

  const { data: allMatriculas, error: errMat } = await supabase.from('matriculas').select('id, aluno_id, turma_id, plano, status, turma');
  if (errMat) console.error('[Cron] Erro ao carregar matriculas:', errMat.message);
  
  const matriculasByAluno = new Map<string, any[]>();
  if (allMatriculas) {
    for (const m of allMatriculas) {
      if (m.aluno_id) {
        const list = matriculasByAluno.get(m.aluno_id) || [];
        list.push(m);
        matriculasByAluno.set(m.aluno_id, list);
      }
    }
  }

  console.log(`[Cron] Caches inicializados: ${existingMap.size} pagamentos, ${responsaveisMap.size} responsaveis, ${allAlunos?.length || 0} alunos, ${allMatriculas?.length || 0} matriculas.`);

  for (const siteId of siteIds) {
    console.log(`[Cron] Processando pagamentos recorrentes do site ID: ${siteId}`);
    const headers = {
      'Authorization': apiKey,
      'wix-account-id': accountId,
      'wix-site-id': siteId
    };

  try {
    // 1. Fetch ALL Orders with offset-based pagination (WIX returns max 50 per page)
    const orders: any[] = [];
    let offset = 0;
    const limit = 50;
    let hasNext = true;
    do {
      const params: any = { limit, offset };
      const resOrders = await axios.get('https://www.wixapis.com/pricing-plans/v2/orders', { headers, params });
      const page = resOrders.data.orders || [];
      orders.push(...page);
      const meta = resOrders.data.pagingMetadata;
      hasNext = meta?.hasNext || false;
      offset += limit;
      if (page.length < limit || !hasNext) break; // last page
      await new Promise(r => setTimeout(r, 200)); // rate limit pause
    } while (hasNext);
    console.log(`[Cron] Encontradas ${orders.length} assinaturas totais no Wix (site ${siteId}).`);


    // 2. Fetch Contacts in batch (optimized)
    const contactIds = Array.from(new Set(orders.map((o: any) => o.buyer?.contactId).filter(Boolean)));
    const contactsMap: Record<string, string> = {};
    
    const BATCH_SIZE = 500;
    for (let i = 0; i < contactIds.length; i += BATCH_SIZE) {
      const batchIds = contactIds.slice(i, i + BATCH_SIZE);
      try {
        const resQuery = await axios.post(
          'https://www.wixapis.com/contacts/v4/contacts/query',
          {
            query: {
              filter: {
                id: { $in: batchIds }
              },
              paging: {
                limit: BATCH_SIZE
              }
            }
          },
          { headers }
        );
        const contacts = resQuery.data.contacts || [];
        for (const contact of contacts) {
          const email = contact.primaryInfo?.email;
          if (email && contact.id) {
            contactsMap[contact.id] = email;
          }
        }
      } catch (err: any) {
        console.warn(`[Cron] Erro ao buscar lote de contatos (index ${i}):`, err.message);
        // Fallback: fetch sequentially for this batch if bulk query fails
        for (const cid of batchIds) {
          try {
            const resContact = await axios.get(`https://www.wixapis.com/contacts/v4/contacts/${cid}`, { headers });
            const email = resContact.data.contact?.primaryInfo?.email;
            if (email) contactsMap[cid as string] = email;
          } catch (e: any) {
            console.warn(`[Cron] Fallback erro ao buscar contato ${cid}:`, e.message);
          }
          await new Promise(r => setTimeout(r, 50));
        }
      }
      await new Promise(r => setTimeout(r, 200));
    }

    // 3. Process Orders — iterate over ALL cycles to avoid missing past payments
    for (const order of orders) {
      const email = contactsMap[order.buyer?.contactId];
      if (!email) continue;

      // Extract details
      const wixOrderId = order.id;
      const planName = order.planName;
      const amount = parseFloat(order.priceDetails?.total || '0');
      let currentCycleIndex = order.currentCycle?.index;
      if (!currentCycleIndex && order.cycles && order.cycles.length > 0) {
        currentCycleIndex = Math.max(...order.cycles.map((c: any) => c.index));
      }
      if (!currentCycleIndex) {
        currentCycleIndex = 1;
      }
      const orderCreatedDate = order.createdDate || order.currentCycle?.startedDate;

      // Determine billing interval in days (default 30 = monthly)
      const intervalUnit: string = (order.pricing?.subscription?.cycleDuration?.unit || 'MONTH').toUpperCase();
      const intervalCount: number = parseInt(order.pricing?.subscription?.cycleDuration?.count || '1');
      const daysPerCycle = intervalUnit === 'YEAR' ? intervalCount * 365
                         : intervalUnit === 'WEEK' ? intervalCount * 7
                         : intervalCount * 30; // MONTH default

      // Resolve responsavel/aluno once per order in-memory
      const responsavel = email ? responsaveisMap.get(email.trim().toLowerCase()) : null;

      let aluno_id = null;
      let matricula_id = null;
      let turma_id = null;

      if (responsavel && email) {
        const students = alunosByParentEmail.get(email.trim().toLowerCase()) || [];
        if (students.length > 0) {
          // Find which student is already assigned to this specific wixOrderId
          const preAssignedStudentId = orderToStudentMap.get(wixOrderId);
          
          // Gather all candidate enrollments for matching plan name
          const candidates: any[] = [];
          const normOrderPlan = superNormalize(planName);
          
          for (const s of students) {
            const enrollments = matriculasByAluno.get(s.id) || [];
            for (const e of enrollments) {
              const normPlano = superNormalize(e.plano || e.turma);
              if (normPlano && (normPlano.includes(normOrderPlan) || normOrderPlan.includes(normPlano))) {
                candidates.push(e);
              }
            }
          }

          // Fallback 1: Match by sport/activity prefix keyword
          if (candidates.length === 0) {
            const getSportPrefix = (name: string) => {
              const norm = superNormalize(name);
              const sports = ['futsal', 'volei', 'ballet', 'judo', 'xadrez', 'teatro', 'basquete', 'game', 'natac', 'pickleball', 'capoeira', 'tenis'];
              for (const sport of sports) {
                if (norm.includes(sport)) return sport;
              }
              return norm.substring(0, 4);
            };

            const orderSport = getSportPrefix(planName);

            for (const s of students) {
              const enrollments = matriculasByAluno.get(s.id) || [];
              for (const e of enrollments) {
                const enrollSport = getSportPrefix(e.plano || e.turma);
                if (orderSport && enrollSport === orderSport) {
                  candidates.push(e);
                }
              }
            }
          }

          // Fallback 2: if still no matched activity, use all enrollments of all students
          if (candidates.length === 0) {
            for (const s of students) {
              const enrollments = matriculasByAluno.get(s.id) || [];
              candidates.push(...enrollments);
            }
          }

          let selectedEnrollment = null;

          if (preAssignedStudentId) {
            // Priority 1: Use enrollment of the pre-assigned student
            const studentEnrollments = candidates.filter(e => e.aluno_id === preAssignedStudentId);
            const active = studentEnrollments.filter(e => e.status === 'ativo');
            selectedEnrollment = active.length > 0 ? active[0] : studentEnrollments[0];
          }

          if (!selectedEnrollment && candidates.length > 0) {
            // Priority 2: Try to find a student who is NOT yet assigned to another order for this plan
            const unassignedCandidates = candidates.filter(c => {
              const isAssigned = Array.from(orderToStudentMap.entries()).some(([oid, sid]) => {
                if (oid === wixOrderId) return false;
                if (sid !== c.aluno_id) return false;
                // Only match if the order was for the same planName
                const otherOrder = orders.find(o => o.id === oid);
                return otherOrder && superNormalize(otherOrder.planName) === normOrderPlan;
              });
              return !isAssigned;
            });

            const searchPool = unassignedCandidates.length > 0 ? unassignedCandidates : candidates;
            const active = searchPool.filter(e => e.status === 'ativo');
            selectedEnrollment = active.length > 0 ? active[0] : searchPool[0];
          }

          if (selectedEnrollment) {
            aluno_id = selectedEnrollment.aluno_id;
            matricula_id = selectedEnrollment.id;
            turma_id = selectedEnrollment.turma_id;
          } else {
            aluno_id = students[0].id;
          }

          if (aluno_id) {
            orderToStudentMap.set(wixOrderId, aluno_id);
          }
        }
      }

      // Iterate over ALL cycles from 1 to currentCycleIndex
      for (let cycleIndex = 1; cycleIndex <= currentCycleIndex; cycleIndex++) {
        const uniquePaymentId = `${wixOrderId}-cycle-${cycleIndex}`;

        // Get the start date for this cycle from the Wix order cycles list
        const cycleObj = order.cycles?.find((c: any) => c.index === cycleIndex);
        let cycleStartDate = cycleObj ? cycleObj.startedDate : null;

        if (!cycleStartDate) {
          // Fallback to calculation if cycles array is missing
          cycleStartDate = orderCreatedDate;
          if (cycleIndex === currentCycleIndex && order.currentCycle?.startedDate) {
            cycleStartDate = order.currentCycle.startedDate;
          } else if (orderCreatedDate && cycleIndex > 1) {
            const baseDate = new Date(orderCreatedDate);
            baseDate.setDate(baseDate.getDate() + daysPerCycle * (cycleIndex - 1));
            cycleStartDate = baseDate.toISOString();
          }
        }

        // Status: only the current cycle has a real lastPaymentStatus; past cycles assumed PAID
        const cycleStatus = cycleIndex === currentCycleIndex
          ? order.lastPaymentStatus  // PAID, FAILED, PENDING
          : 'PAID';

        const statusLabel = cycleStatus === 'PAID' ? 'Bem-sucedido'
                           : cycleStatus === 'FAILED' ? 'Falhou'
                           : 'Pendente';

        const wixRowData: any = {
          data_pagamento_gmt_03: cycleStartDate,
          id_provedor_pagamento: uniquePaymentId,
          data_transacao_gmt_03: cycleStartDate,
          moeda: 'BRL',
          valor: amount,
          status_transacao: statusLabel,
          cobranca_nome: responsavel?.nome_completo || 'Desconhecido',
          cobranca_email: email,
          produto_nome: planName,
          responsavel_id: responsavel?.id || null,
          aluno_id: aluno_id,
          matricula_id: matricula_id,
          turma_id: turma_id,
          provedor_pagamento: 'Wix API Cron',
          id_pedido: wixOrderId,
          tipo_pedido: 'Pricing Plans',
        };

        const sig = `${aluno_id || email.toLowerCase().trim()}|${cycleStartDate.substring(0, 7)}|${superNormalize(planName)}`;
        const existing = existingMap.get(uniquePaymentId) || signatureMap.get(sig);

        if (existing) {
          // Rule 1: Never overwrite manual or CSV entries in Cron Sync
          const isExistingCron = existing.provedor_pagamento === 'Wix API Cron' || String(existing.id_provedor_pagamento).includes('-cycle-');
          if (!isExistingCron) {
            console.log(`[Cron] Ciclo ${cycleIndex} da ordem ${wixOrderId} já possui registro manual/CSV (${existing.id_provedor_pagamento}). Pulando.`);
            continue;
          }

          // Rule 2: If database has a failure status, do not overwrite it with success/pending
          const existingStatusLower = String(existing.status_transacao || '').toLowerCase();
          const isExistingFailed = existingStatusLower.includes('falh') || existingStatusLower.includes('recus');
          const statusLabelLower = statusLabel.toLowerCase();
          const isNewFailed = statusLabelLower.includes('falh') || statusLabelLower.includes('recus');

          if (isExistingFailed && !isNewFailed) {
            console.log(`[Cron] Ciclo ${cycleIndex} da ordem ${wixOrderId} já está marcado como falha (${existing.status_transacao}). Evitando sobrescrever com ${statusLabel}.`);
            continue;
          }

          // Rule 3: Only update if the status actually changed, OR if we resolved missing IDs
          const needsIdUpdate = (!existing.matricula_id && matricula_id) || 
                                (!existing.aluno_id && aluno_id) || 
                                (!existing.turma_id && turma_id) ||
                                (!existing.responsavel_id && responsavel?.id) ||
                                (!existing.tipo_pedido);

          if (existing.status_transacao !== statusLabel || needsIdUpdate) {
            const updatePayload: any = {};
            if (existing.status_transacao !== statusLabel) {
              updatePayload.status_transacao = statusLabel;
              updatePayload.data_pagamento_gmt_03 = cycleStartDate;
              updatePayload.data_transacao_gmt_03 = cycleStartDate;
            }
            if (!existing.matricula_id && matricula_id) {
              updatePayload.matricula_id = matricula_id;
              existing.matricula_id = matricula_id;
            }
            if (!existing.aluno_id && aluno_id) {
              updatePayload.aluno_id = aluno_id;
              existing.aluno_id = aluno_id;
            }
            if (!existing.turma_id && turma_id) {
              updatePayload.turma_id = turma_id;
              existing.turma_id = turma_id;
            }
            if (!existing.responsavel_id && responsavel?.id) {
              updatePayload.responsavel_id = responsavel.id;
              existing.responsavel_id = responsavel.id;
            }
            if (!existing.tipo_pedido) {
              updatePayload.tipo_pedido = 'Pricing Plans';
              existing.tipo_pedido = 'Pricing Plans';
            }

            const { error: updateErr } = await supabase
              .from('pagamentos_wix')
              .update(updatePayload)
              .eq('id', existing.id);

            if (updateErr) {
              console.error(`[Cron] Erro ao atualizar ciclo ${cycleIndex} da ordem ${wixOrderId}:`, updateErr.message);
            } else {
              console.log(`[Cron] Ciclo ${cycleIndex} do Wix ${wixOrderId} atualizado: ${existing.status_transacao} → ${statusLabel}.`);
              existing.status_transacao = statusLabel; // update map cache
              if (existing.status_transacao !== 'Falhou' && statusLabel === 'Falhou' && responsavel?.telefone && matricula_id) {
                await dispararAvisoFalhaWix(responsavel.telefone, responsavel.nome_completo);
              }
            }
          }
        } else {
          const { data: inserted, error: insertErr } = await supabase.from('pagamentos_wix').insert([wixRowData]).select('id');
          if (insertErr) {
            console.error(`[Cron] Erro ao inserir ciclo ${cycleIndex} do Wix ${wixOrderId}:`, insertErr.message);
          } else {
            console.log(`[Cron] Ciclo ${cycleIndex} do Wix ${wixOrderId} inserido como ${statusLabel}.`);
            if (inserted && inserted.length > 0) {
              const newRow = { id: inserted[0].id, status_transacao: statusLabel, id_provedor_pagamento: uniquePaymentId, provedor_pagamento: 'Wix API Cron' };
              existingMap.set(uniquePaymentId, newRow);
              signatureMap.set(sig, newRow);
            }
          }
          if (statusLabel === 'Falhou' && responsavel?.telefone && matricula_id) {
            await dispararAvisoFalhaWix(responsavel.telefone, responsavel.nome_completo);
          }
        }
      }
    }

    console.log(`[Cron] Sincronização do Wix (Site ID: ${siteId}) concluída com sucesso.`);
  } catch (error: any) {
    console.error(`[Cron] Erro geral na sincronização do Wix (Site ID: ${siteId}):`, error.response?.data || error.message);
  }
  } // fim do for siteId
}

async function dispararAvisoFalhaWix(celular: string, nome: string) {
  try {
    const edgeFunctionUrl = process.env.SUPABASE_URL + '/functions/v1/send-whatsapp';
    const apiKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
    const mensagem = `Olá, *${nome}*! Identificamos uma falha no processamento da sua assinatura via Wix. Por favor, atualize o seu método de pagamento para garantir a continuidade das aulas.`;
    
    await axios.post(edgeFunctionUrl, {
      to: celular,
      message: mensagem
    }, {
      headers: { 'Authorization': `Bearer ${apiKey}` }
    });
    console.log(`[Cron] WhatsApp disparado para ${celular}`);
  } catch (err: any) {
    console.error('[Cron] Falha ao disparar WhatsApp de erro Wix:', err.message);
  }
}


  
// Rota para disparar o cron job manualmente ou via Vercel Cron
app.get('/api/cron/wix-sync', async (req, res) => {
  try {
    // You could add a secret check here if needed, but for now we let it run
    await syncWixRecurringPayments();
    res.json({ success: true, message: 'Wix sync executed' });
  } catch(e: any) {
    res.status(500).json({ error: e.message });
  }
});

async function syncPagarmeRecurringPayments(maxPages: number = 3) {
  console.log('[Cron] Iniciando sincronização do Pagar.me (Recurring Payments)...');
  const secretKey = getPagarmeSecretKey();
  if (!secretKey) {
    console.warn('[Cron] Pagar.me Secret Key não configurada. Sincronização cancelada.');
    return;
  }

  const authHeader = Buffer.from(`${secretKey}:`).toString('base64');

  // PRE-FETCH CACHES (avoid N+1 queries in loops)
  console.log('[Cron] Carregando caches do banco de dados para Pagar.me...');
  const { data: allMatriculas, error: errMat } = await supabase
    .from('matriculas')
    .select('id, aluno_id, status, pagarme_subscription_id, plano, turma, turma_id');
  if (errMat) console.error('[Cron] Erro ao carregar matriculas:', errMat.message);

  const { data: allAlunos, error: errAlun } = await supabase
    .from('alunos')
    .select('id, nome_completo, responsavel_id');
  if (errAlun) console.error('[Cron] Erro ao carregar alunos:', errAlun.message);

  const { data: allResponsaveis, error: errResp } = await supabase
    .from('responsaveis')
    .select('id, nome_completo, email, telefone');
  if (errResp) console.error('[Cron] Erro ao carregar responsaveis:', errResp.message);

  // We also cache existing payments from 'pagamentos' table to avoid duplicate checks
  const existingPaymentsSet = new Set<string>();
  let dbPage = 0;
  const dbPageSize = 1000;
  let hasMoreDb = true;
  while (hasMoreDb) {
    const { data: chunk, error: errExist } = await supabase
      .from('pagamentos')
      .select('pagarme')
      .not('pagarme', 'is', null)
      .range(dbPage * dbPageSize, (dbPage + 1) * dbPageSize - 1);
      
    if (errExist) {
      console.error('[Cron] Erro ao carregar pagamentos:', errExist.message);
      break;
    }
    if (!chunk || chunk.length === 0) {
      hasMoreDb = false;
    } else {
      for (const row of chunk) {
        if (row.pagarme) existingPaymentsSet.add(row.pagarme);
      }
      if (chunk.length < dbPageSize) {
        hasMoreDb = false;
      } else {
        dbPage++;
      }
    }
  }

  // Create Maps for fast O(1) lookups
  const matriculaBySubMap = new Map<string, any>();
  const matriculasByAlunoMap = new Map<string, any[]>();
  if (allMatriculas) {
    for (const m of allMatriculas) {
      if (m.pagarme_subscription_id) {
        matriculaBySubMap.set(m.pagarme_subscription_id, m);
      }
      if (m.aluno_id) {
        const list = matriculasByAlunoMap.get(m.aluno_id) || [];
        list.push(m);
        matriculasByAlunoMap.set(m.aluno_id, list);
      }
    }
  }

  const responsaveisMap = new Map<string, any>();
  if (allResponsaveis) {
    for (const r of allResponsaveis) {
      if (r.email) {
        responsaveisMap.set(r.email.trim().toLowerCase(), r);
      }
    }
  }

  const studentsByParentMap = new Map<string, any[]>();
  const studentsMap = new Map<string, any>();
  if (allAlunos) {
    for (const a of allAlunos) {
      studentsMap.set(a.id, a);
      if (a.responsavel_id) {
        const list = studentsByParentMap.get(a.responsavel_id) || [];
        list.push(a);
        studentsByParentMap.set(a.responsavel_id, list);
      }
    }
  }

  console.log(`[Cron] Caches inicializados: ${existingPaymentsSet.size} pagamentos, ${responsaveisMap.size} responsaveis, ${allAlunos?.length || 0} alunos, ${allMatriculas?.length || 0} matriculas.`);

  let page = 1;
  let totalProcessed = 0;
  let totalCreated = 0;
  let totalIgnored = 0;

  while (page <= maxPages) {
    try {
      console.log(`[Cron] Buscando página ${page} de faturas Pagar.me...`);
      const response = await axios.get(`https://api.pagar.me/core/v5/invoices?status=paid&page=${page}&size=50`, {
        headers: { 'Authorization': `Basic ${authHeader}` }
      });

      const invoices = response.data.data;
      if (!invoices || invoices.length === 0) {
        break; // Sem mais faturas
      }

      for (const invoice of invoices) {
        totalProcessed++;
        const invoiceId = invoice.id;
        const subscriptionId = invoice.subscription?.id || invoice.subscription_id || (invoice.subscription ? invoice.subscription.id : null);

        if (!subscriptionId) {
          totalIgnored++;
          continue;
        }

        // Verifica se a fatura já existe no banco
        if (existingPaymentsSet.has(invoiceId)) {
          totalIgnored++;
          continue;
        }

        let matriculaId = null;
        let responsavelId = null;
        let alunoId = null;

        // 1. Tentar achar por pagarme_subscription_id no cache
        let matchedMatricula = matriculaBySubMap.get(subscriptionId);

        if (matchedMatricula) {
          matriculaId = matchedMatricula.id;
          alunoId = matchedMatricula.aluno_id;
          const student = studentsMap.get(alunoId);
          responsavelId = student?.responsavel_id || null;
        } else {
          // 2. Se não encontrar, tentar fluxo de AUTO-HEAL (Self-Healing)
          const description = invoice.items?.[0]?.description || '';
          const match = description.match(/Mensalidade\s*-\s*([^(]+)\(([^)]+)\)/i);
          
          if (match && invoice.customer?.email) {
            const parsedStudentName = match[1].trim();
            const parsedClassName = match[2].split('-')[0].trim();
            
            const customerEmailClean = invoice.customer.email.trim().toLowerCase();
            const resolvedResponsavel = responsaveisMap.get(customerEmailClean);
            
            if (resolvedResponsavel) {
              responsavelId = resolvedResponsavel.id;
              const parentStudents = studentsByParentMap.get(resolvedResponsavel.id) || [];
              
              // Tentar dar match no estudante
              const matchedStudent = parentStudents.find((s: any) => 
                superNormalize(s.nome_completo) === superNormalize(parsedStudentName)
              );
              
              if (matchedStudent) {
                alunoId = matchedStudent.id;
                const studentMatriculas = matriculasByAlunoMap.get(matchedStudent.id) || [];
                
                // Tentar dar match na matricula pela turma ou plano
                const normParsedClass = superNormalize(parsedClassName);
                
                let targetMat = studentMatriculas.find((m: any) => {
                  const normTurmaOrPlano = superNormalize(m.plano || m.turma || '');
                  return normTurmaOrPlano.includes(normParsedClass) || normParsedClass.includes(normTurmaOrPlano);
                });
                
                // Fallback 1: se não achar, pegar qualquer matrícula ativa
                if (!targetMat) {
                  const activeMatriculas = studentMatriculas.filter((m: any) => m.status === 'ativo' || m.status === 'Ativo');
                  if (activeMatriculas.length > 0) {
                    targetMat = activeMatriculas[0];
                  }
                }
                
                // Fallback 2: se ainda não achar, pegar a primeira matrícula qualquer
                if (!targetMat && studentMatriculas.length > 0) {
                  targetMat = studentMatriculas[0];
                }
                
                if (targetMat) {
                  matriculaId = targetMat.id;
                  
                  // Executar a auto-cura no banco de dados!
                  console.log(`[Cron] 🩹 [AUTO-HEAL] Associando assinatura ${subscriptionId} à matrícula ${matriculaId} (Aluno: ${matchedStudent.nome_completo}, Turma: ${parsedClassName})`);
                  
                  const { error: healErr } = await supabase
                    .from('matriculas')
                    .update({ pagarme_subscription_id: subscriptionId })
                    .eq('id', matriculaId);
                    
                  if (healErr) {
                    console.error(`[Cron] Erro ao salvar auto-cura no banco:`, healErr.message);
                  } else {
                    targetMat.pagarme_subscription_id = subscriptionId;
                    matriculaBySubMap.set(subscriptionId, targetMat);
                  }
                }
              }
            }
          }
          
          // 3. Fallback de segurança original: se ainda não encontrou matricula, procurar por pagamentos anteriores
          if (!matriculaId) {
            const { data: originalPayment } = await supabase
              .from('pagamentos')
              .select('matricula_id, responsavel_id, aluno_id')
              .eq('pagarme', subscriptionId)
              .maybeSingle();

            if (originalPayment) {
              matriculaId = originalPayment.matricula_id;
              alunoId = originalPayment.aluno_id;
              responsavelId = originalPayment.responsavel_id;
            }
          }
        }

        if (!matriculaId) {
          console.log(`[Cron] Fatura Pagar.me ${invoiceId}: Matrícula não encontrada para a assinatura ${subscriptionId}.`);
          totalIgnored++;
          continue;
        }

        const valorReal = invoice.amount / 100;
        const mappedMethod = invoice.payment_method === 'credit_card' ? 'cartao_credito'
                           : invoice.payment_method === 'pix' ? 'pix'
                           : 'cartao_credito';

        const newPayment = {
          matricula_id: matriculaId,
          responsavel_id: responsavelId || null,
          aluno_id: alunoId || null,
          status: 'pago',
          metodo_pagamento: mappedMethod,
          valor: valorReal,
          data_vencimento: invoice.due_at || new Date(invoice.created_at).toISOString(),
          pagarme: invoiceId,
          data_pagamento: invoice.charge?.paid_at || invoice.paid_at || invoice.due_at || invoice.created_at || new Date().toISOString()
        };

        const { error: insertError } = await supabase
          .from('pagamentos')
          .insert([newPayment]);

        if (insertError) {
          console.error(`[Cron] Fatura Pagar.me ${invoiceId}: Erro ao inserir no banco: ${insertError.message}`);
        } else {
          totalCreated++;
          existingPaymentsSet.add(invoiceId);
          console.log(`[Cron] Fatura Pagar.me ${invoiceId} sincronizada com sucesso! (R$ ${valorReal})`);
        }
      }

      page++;
    } catch (err: any) {
      console.error('[Cron] Erro ao sincronizar faturas Pagar.me na página ' + page + ':', err.response?.data || err.message);
      break;
    }
  }

  console.log(`[Cron] Sincronização Pagar.me finalizada. Total Processadas: ${totalProcessed}, Criadas: ${totalCreated}, Ignoradas/Existentes: ${totalIgnored}`);
}

// Rota para disparar o cron job do Pagar.me manualmente ou via Vercel Cron
app.get('/api/cron/pagarme-sync', async (req, res) => {
  try {
    const pages = req.query.pages ? parseInt(req.query.pages as string, 10) : 3;
    await syncPagarmeRecurringPayments(pages);
    res.json({ success: true, message: `Pagar.me sync executed for up to ${pages} pages` });
  } catch(e: any) {
    res.status(500).json({ error: e.message });
  }
});


// Fix corrupted date records in pagamentos_wix
app.get('/api/fix-corrupted-dates', async (req, res) => {
  try {
    const apiKey = process.env.WIX_API_KEY;
    const accountId = process.env.WIX_ACCOUNT_ID;
    const siteIds: string[] = [];
    if (process.env.WIX_SITE_ID) siteIds.push(process.env.WIX_SITE_ID);
    else siteIds.push('b4fb0ff7-7e69-4f24-8cd5-5551ce7720b1');
    if (process.env.WIX_SITE_ID_2) siteIds.push(process.env.WIX_SITE_ID_2);

    const stats = { total: 0, fixedByClean: 0, fixedByWixAPI: 0, failed: 0, skipped: 0 };

    // 1. Fetch all records with corrupted dates
    // Two separate queries because a comma in LIKE breaks PostgREST .or() parser
    const { data: withComma, error: err1 } = await supabase
      .from('pagamentos_wix')
      .select('id, data_pagamento_gmt_03, data_transacao_gmt_03, id_provedor_pagamento, provedor_pagamento')
      .like('data_pagamento_gmt_03', '%,%');  // dates with comma inside

    const { data: withNull, error: err2 } = await supabase
      .from('pagamentos_wix')
      .select('id, data_pagamento_gmt_03, data_transacao_gmt_03, id_provedor_pagamento, provedor_pagamento')
      .is('data_pagamento_gmt_03', null);     // null dates

    if (err1) throw err1;
    if (err2) throw err2;

    // Merge and deduplicate by id
    const seen = new Set<string>();
    const corrupted: any[] = [];
    for (const r of [...(withComma || []), ...(withNull || [])]) {
      if (!seen.has(r.id)) { seen.add(r.id); corrupted.push(r); }
    }

    if (corrupted.length === 0) {
      return res.json({ message: 'Nenhum registro com data corrompida encontrado.', stats });
    }

    stats.total = corrupted.length;
    console.log(`[FixDates] ${corrupted.length} registros com datas corrompidas encontrados.`);

    // 2. Build WIX orders map: orderId → { createdDate, currentCycleIndex, daysPerCycle, currentCycleStartedDate }
    const wixOrderMap: Record<string, any> = {};
    if (apiKey && accountId) {
      for (const siteId of siteIds) {
        try {
          const headers = { 'Authorization': apiKey, 'wix-account-id': accountId, 'wix-site-id': siteId };
          const orders: any[] = [];
          let offset = 0;
          const limit = 50;
          let hasNext = true;
          do {
            const params: any = { limit, offset };
            const res2 = await axios.get('https://www.wixapis.com/pricing-plans/v2/orders', { headers, params });
            const page = res2.data.orders || [];
            orders.push(...page);
            const meta = res2.data.pagingMetadata;
            hasNext = meta?.hasNext || false;
            offset += limit;
            if (page.length < limit || !hasNext) break;
            await new Promise(r => setTimeout(r, 200));
          } while (hasNext);

          for (const order of orders) {
            const intervalUnit = (order.pricing?.subscription?.cycleDuration?.unit || 'MONTH').toUpperCase();
            const intervalCount = parseInt(order.pricing?.subscription?.cycleDuration?.count || '1');
            const daysPerCycle = intervalUnit === 'YEAR' ? intervalCount * 365
                               : intervalUnit === 'WEEK' ? intervalCount * 7
                               : intervalCount * 30;
            wixOrderMap[order.id] = {
              createdDate: order.createdDate,
              currentCycleIndex: order.currentCycle?.index || 1,
              currentCycleStartedDate: order.currentCycle?.startedDate,
              daysPerCycle
            };
          }
        } catch(e: any) {
          console.warn(`[FixDates] Erro ao buscar ordens do site ${siteId}:`, e.message);
        }
      }
    }

    // 3. Process each corrupted record
    for (const rec of corrupted) {
      let fixedDate: string | null = null;

      // Strategy A: Try to clean the date string directly (remove commas, extra text)
      const rawDate = (rec.data_pagamento_gmt_03 || rec.data_transacao_gmt_03 || '');
      if (rawDate) {
        // Replace commas with empty strings and trim
        const cleaned = rawDate.replace(/,/g, '').trim();
        // Validate: must look like a date
        if (/^\d{4}-\d{2}-\d{2}/.test(cleaned)) {
          fixedDate = cleaned;
          stats.fixedByClean++;
        } else if (/^\d{2}\/\d{2}\/\d{4}/.test(cleaned)) {
          // dd/mm/yyyy → yyyy-mm-dd
          const [d, m, y] = cleaned.split('/');
          fixedDate = `${y}-${m}-${d}`;
          stats.fixedByClean++;
        }
      }

      // Strategy B: Use WIX API order map via id_provedor_pagamento (format: orderId-cycle-N)
      if (!fixedDate && rec.id_provedor_pagamento) {
        const match = String(rec.id_provedor_pagamento).match(/^(.+)-cycle-(\d+)$/);
        if (match) {
          const orderId = match[1];
          const cycleIdx = parseInt(match[2]);
          const orderInfo = wixOrderMap[orderId];
          if (orderInfo) {
            if (cycleIdx === orderInfo.currentCycleIndex && orderInfo.currentCycleStartedDate) {
              fixedDate = orderInfo.currentCycleStartedDate.split('T')[0];
            } else if (orderInfo.createdDate) {
              const base = new Date(orderInfo.createdDate);
              base.setDate(base.getDate() + orderInfo.daysPerCycle * (cycleIdx - 1));
              fixedDate = base.toISOString().split('T')[0];
            }
            if (fixedDate) stats.fixedByWixAPI++;
          }
        }
      }

      if (fixedDate) {
        const { error: updateErr } = await supabase
          .from('pagamentos_wix')
          .update({ data_pagamento_gmt_03: fixedDate, data_transacao_gmt_03: fixedDate })
          .eq('id', rec.id);

        if (updateErr) {
          console.warn(`[FixDates] Erro ao atualizar registro ${rec.id}:`, updateErr.message);
          stats.failed++;
          if (fixedDate) {
            stats.fixedByClean = Math.max(0, stats.fixedByClean - 1);
            stats.fixedByWixAPI = Math.max(0, stats.fixedByWixAPI - 1);
          }
        } else {
          console.log(`[FixDates] Registro ${rec.id} corrigido: ${rawDate} → ${fixedDate}`);
        }
      } else {
        stats.skipped++;
        console.warn(`[FixDates] Não foi possível corrigir registro ${rec.id} (data: ${rawDate}, id_prov: ${rec.id_provedor_pagamento})`);
      }

      await new Promise(r => setTimeout(r, 30)); // avoid supabase rate limits
    }

    res.json({
      message: 'Correção de datas concluída.',
      stats,
      summary: `${stats.fixedByClean + stats.fixedByWixAPI} de ${stats.total} registros corrigidos.`
    });

  } catch(e: any) {
    console.error('[FixDates] Erro geral:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// Audit endpoint: compares pagamentos_wix DB records vs WIX API
app.get('/api/wix-audit', async (req, res) => {
  try {
    const apiKey = process.env.WIX_API_KEY;
    const accountId = process.env.WIX_ACCOUNT_ID;
    const siteIds: string[] = [];
    if (process.env.WIX_SITE_ID) siteIds.push(process.env.WIX_SITE_ID);
    else siteIds.push('b4fb0ff7-7e69-4f24-8cd5-5551ce7720b1');
    if (process.env.WIX_SITE_ID_2) siteIds.push(process.env.WIX_SITE_ID_2);

    // 1. Count records in DB by month (2026) - paginated to fetch more than 1000 rows
    const dbRows: any[] = [];
    let page = 0;
    const pageSize = 1000;
    let hasMoreDb = true;
    while (hasMoreDb) {
      const { data: chunk, error: dbErr } = await supabase
        .from('pagamentos_wix')
        .select('data_pagamento_gmt_03, status_transacao, provedor_pagamento')
        .gte('data_pagamento_gmt_03', '2026-01-01')
        .order('data_pagamento_gmt_03', { ascending: true })
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (dbErr) throw dbErr;
      if (!chunk || chunk.length === 0) {
        hasMoreDb = false;
      } else {
        dbRows.push(...chunk);
        if (chunk.length < pageSize) {
          hasMoreDb = false;
        } else {
          page++;
        }
      }
    }

    const byMonth: Record<string, { total: number, bemSucedido: number, falhou: number, pendente: number }> = {};
    (dbRows || []).forEach((r: any) => {
      const month = (r.data_pagamento_gmt_03 || '').substring(0, 7);
      if (!byMonth[month]) byMonth[month] = { total: 0, bemSucedido: 0, falhou: 0, pendente: 0 };
      byMonth[month].total++;
      const s = (r.status_transacao || '').toLowerCase();
      if (s === 'bem-sucedido' || s === 'creditado' || s === 'paid') byMonth[month].bemSucedido++;
      else if (s === 'falhou' || s === 'recusado' || s === 'failed') byMonth[month].falhou++;
      else byMonth[month].pendente++;
    });

    // 2. Count expected cycles from WIX API
    const wixSummary: any[] = [];
    if (apiKey && accountId) {
      for (const siteId of siteIds) {
        try {
          const headers = { 'Authorization': apiKey, 'wix-account-id': accountId, 'wix-site-id': siteId };
          // Paginate through ALL orders using offset-based pagination
          const orders: any[] = [];
          let offset = 0;
          const limit = 50;
          let hasNext = true;
          do {
            const params: any = { limit, offset };
            const resOrders = await axios.get('https://www.wixapis.com/pricing-plans/v2/orders', { headers, params });
            const page = resOrders.data.orders || [];
            orders.push(...page);
            const meta = resOrders.data.pagingMetadata;
            hasNext = meta?.hasNext || false;
            offset += limit;
            if (page.length < limit || !hasNext) break;
            await new Promise(r => setTimeout(r, 200));
          } while (hasNext);

          let totalCycles = 0;
          const cyclesByMonth: Record<string, number> = {};

          for (const order of orders) {
            const currentCycleIndex = order.currentCycle?.index || 1;
            const createdDate = order.createdDate || '';
            const intervalUnit = (order.pricing?.subscription?.cycleDuration?.unit || 'MONTH').toUpperCase();
            const intervalCount = parseInt(order.pricing?.subscription?.cycleDuration?.count || '1');
            const daysPerCycle = intervalUnit === 'YEAR' ? intervalCount * 365 : intervalUnit === 'WEEK' ? intervalCount * 7 : intervalCount * 30;

            for (let i = 1; i <= currentCycleIndex; i++) {
              let cycleDate = createdDate;
              if (i === currentCycleIndex && order.currentCycle?.startedDate) {
                cycleDate = order.currentCycle.startedDate;
              } else if (createdDate && i > 1) {
                const d = new Date(createdDate);
                d.setDate(d.getDate() + daysPerCycle * (i - 1));
                cycleDate = d.toISOString();
              }
              const month = cycleDate.substring(0, 7);
              if (month >= '2026-01') {
                totalCycles++;
                cyclesByMonth[month] = (cyclesByMonth[month] || 0) + 1;
              }
            }
          }
          wixSummary.push({ siteId, totalOrders: orders.length, totalCycles2026: totalCycles, cyclesByMonth });
        } catch(e: any) {
          wixSummary.push({ siteId, error: e.message });
        }
      }
    }

    const totalInDB = (dbRows || []).length;
    const totalExpected = wixSummary.reduce((acc, s) => acc + (s.totalCycles2026 || 0), 0);

    res.json({
      status: totalInDB >= totalExpected ? 'OK - Conciliado' : 'ALERTA - Faltam registros',
      totalInDB,
      totalExpectedFromWIX: totalExpected,
      difference: totalExpected - totalInDB,
      dbByMonth: byMonth,
      wixSites: wixSummary
    });
  } catch(e: any) {
    res.status(500).json({ error: e.message });
  }
});


  // Global API error handler
  
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
    
    console.log(`[Webhook Wix] Recebido evento: ${event}, Status: ${status}, WixId: ${wixId}`);
    
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
      console.log(`[Webhook Wix] Pagamento ${wixId} atualizado com sucesso.`);
    } else {
      await supabase.from('pagamentos_wix').insert([wixRowData]);
      console.log(`[Webhook Wix] Pagamento ${wixId} criado com sucesso.`);
    }

    // Processamento de Inadimplência
    if (status && (status.toLowerCase().includes('falh') || status.toLowerCase().includes('recusad') || status.toLowerCase().includes('fail'))) {
      if (responsavel && matricula_id) {
        console.log(`[Webhook Wix] Falha detectada para matrícula ${matricula_id}. Acionando disparo de WhatsApp...`);
        try {
          const edgeFunctionUrl = process.env.SUPABASE_URL + '/functions/v1/send-whatsapp';
          const apiKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
          
          // Busca telefone do responsável
          const { data: respDataFull } = await supabase.from('responsaveis').select('celular, nome_completo').eq('id', responsavel.id).single();
          if (respDataFull && respDataFull.celular) {
            const mensagem = `Olá, *${respDataFull.nome_completo}*! Identificamos uma falha no processamento da sua assinatura via Wix. Por favor, atualize o seu método de pagamento para garantir a continuidade das aulas.`;
            
            await fetch(edgeFunctionUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
              },
              body: JSON.stringify({
                to: respDataFull.celular,
                message: mensagem
              })
            });
            console.log(`[Webhook Wix] Notificação de falha enviada para ${respDataFull.celular}`);
          }
        } catch (edgeErr) {
          console.error(`[Webhook Wix] Erro ao disparar WhatsApp de falha:`, edgeErr);
        }
      }
    }

    res.json({ success: true, message: 'Webhook processado com sucesso' });
  } catch (err: any) {
    console.error('[Webhook Wix] Erro ao processar:', err);
    res.status(500).json({ error: 'Erro interno', details: err.message });
  }
});

  // ─── LOJA VIRTUAL ENDPOINTS ───────────────────────────────────────────────────

  // 1. List active categories
  app.get("/api/loja/categorias", async (req, res) => {
    try {
      const { data, error } = await supabase
        .from('loja_categorias')
        .select('*')
        .eq('ativo', true)
        .order('ordem', { ascending: true });
      if (error) throw error;
      res.json({ categorias: data });
    } catch (err: any) {
      console.error('[API Loja Categorias] Erro:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // 2. List products with filters
  app.get("/api/loja/produtos", async (req, res) => {
    try {
      const { categoria, q, destaque } = req.query;
      let query = supabase.from('loja_produtos').select('*').eq('ativo', true);
      if (destaque === 'true') {
        query = query.eq('destaque', true);
      }
      if (q) {
        query = query.ilike('nome', `%${q}%`);
      }
      const { data: produtos, error: pError } = await query.order('ordem', { ascending: true });
      if (pError) throw pError;

      // Fetch categories to map in memory
      const { data: categorias, error: cError } = await supabase.from('loja_categorias').select('*');
      if (cError) throw cError;

      const mapped = (produtos || []).map((p: any) => ({
        ...p,
        loja_categorias: categorias?.find((c: any) => c.id === p.categoria_id) || null
      }));

      let filtered = mapped;
      if (categoria) {
        filtered = mapped.filter((p: any) => p.loja_categorias && p.loja_categorias.slug === categoria);
      }
      res.json({ produtos: filtered });
    } catch (err: any) {
      console.error('[API Loja Produtos] Erro:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // 3. Product details
  app.get("/api/loja/produtos/:slug", async (req, res) => {
    try {
      const { slug } = req.params;
      const { data: produto, error: pError } = await supabase
        .from('loja_produtos')
        .select('*')
        .eq('slug', slug)
        .eq('ativo', true)
        .maybeSingle();
      if (pError) throw pError;
      if (!produto) return res.status(404).json({ error: 'Produto não encontrado' });

      let categoria = null;
      if (produto.categoria_id) {
        const { data: catData } = await supabase
          .from('loja_categorias')
          .select('*')
          .eq('id', produto.categoria_id)
          .maybeSingle();
        categoria = catData;
      }

      let kit_itens = [];
      if (produto.is_kit) {
        const { data: kitData, error: kitErr } = await supabase
          .from('loja_kit_itens')
          .select('*')
          .eq('kit_produto_id', produto.id);
        
        if (!kitErr && kitData && kitData.length > 0) {
          const compIds = kitData.map(k => k.componente_produto_id);
          const { data: compProds } = await supabase
            .from('loja_produtos')
            .select('*')
            .in('id', compIds);
          
          if (compProds) {
            kit_itens = kitData.map(k => {
              const comp = compProds.find(p => p.id === k.componente_produto_id);
              return { ...k, componente: comp };
            });
          }
        }
      }

      res.json({ produto: { ...produto, categoria, kit_itens } });
    } catch (err: any) {
      console.error('[API Loja Produto] Erro:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // 4. Create Order / Checkout
  app.post("/api/loja/pedidos", async (req, res) => {
    try {
      const {
        responsavel_id,
        items,
        total,
        metodo_pagamento,
        tipo_entrega,
        endereco_entrega,
        observacoes,
        nome_cliente,
        email_cliente,
        telefone_cliente,
        cpf_cliente,
        card,
        unidade,
        cupom_id,
        installments
      } = req.body;

      if (!items || items.length === 0) {
        return res.status(400).json({ error: 'Itens do pedido não informados.' });
      }

      // 1. Criar o pedido no banco com status 'aguardando_pagamento'
      const { data: pedido, error: orderError } = await supabase
        .from('loja_pedidos')
        .insert([{
          responsavel_id,
          status: 'aguardando_pagamento',
          total,
          metodo_pagamento,
          observacoes,
          endereco_entrega,
          tipo_entrega,
          nome_cliente,
          email_cliente,
          telefone_cliente,
          cupom_id: cupom_id || null,
          created_at: new Date().toISOString()
        }])
        .select()
        .single();

      if (orderError) throw orderError;

      // 2. Criar os itens do pedido
      const itemsToInsert = [];
      for (const item of items) {
        let targetAlunoId = item.aluno_id;
        let alunoNome = item.aluno_nome || '';

        if (responsavel_id && item.aluno_id === 'novo' && item.studentData) {
          // Check if student already exists for this guardian
          const { data: existingStudent } = await supabase
            .from('alunos')
            .select('id, nome_completo')
            .eq('responsavel_id', responsavel_id)
            .ilike('nome_completo', item.studentData.name.trim())
            .eq('data_nascimento', item.studentData.birthDate)
            .limit(1)
            .maybeSingle();

          if (existingStudent) {
            targetAlunoId = existingStudent.id;
            alunoNome = existingStudent.nome_completo;
          } else {
            // Fetch guardian details for contacts
            const { data: guardianData } = await supabase
              .from('responsaveis')
              .select('nome_completo, telefone')
              .eq('id', responsavel_id)
              .single();

            // Create new student
            const { data: newStudent, error: sError } = await supabase
              .from('alunos')
              .insert([{
                responsavel_id,
                nome_completo: item.studentData.name.trim(),
                data_nascimento: item.studentData.birthDate,
                serie_ano: item.studentData.grade,
                is_lead: true,
                responsavel_1: guardianData?.nome_completo || nome_cliente,
                whatsapp_1: guardianData?.telefone || telefone_cliente
              }])
              .select()
              .single();

            if (sError || !newStudent) {
              console.error('Error inserting student in checkout:', sError);
              throw new Error('Erro ao cadastrar dependente para o produto.');
            }
            targetAlunoId = newStudent.id;
            alunoNome = newStudent.nome_completo;
          }
        } else if (item.aluno_id && item.aluno_id !== 'guest') {
          // Fetch student name if not provided
          if (!alunoNome) {
            const { data: student } = await supabase
              .from('alunos')
              .select('nome_completo')
              .eq('id', item.aluno_id)
              .single();
            if (student) {
              alunoNome = student.nome_completo;
            }
          }
        }

        const variantSelected = { ...item.variante_selecionada };
        if (alunoNome) {
          variantSelected['Aluno'] = alunoNome;
          variantSelected['aluno_id'] = targetAlunoId;
        }

        itemsToInsert.push({
          pedido_id: pedido.id,
          produto_id: item.produto_id,
          nome_produto: item.nome_produto,
          variante_selecionada: variantSelected,
          quantidade: item.quantidade,
          preco_unitario: item.preco_unitario
        });
      }

      const { error: itemsError } = await supabase
        .from('loja_pedido_itens')
        .insert(itemsToInsert);

      if (itemsError) throw itemsError;

      // 3. Processar pagamento via Pagar.me
      const softDescriptor = await getSetting('pagarme_soft_descriptor', 'SportForKids');
      const orderCode = `loja_${pedido.id}`;
      
      const ip = req.ip || req.headers['x-forwarded-for'] || '127.0.0.1';
      const clientIp = Array.isArray(ip) ? ip[0] : ip;

      console.log(`[Pagar.me Loja] Criando pedido no Pagar.me para o pedido ${pedido.id}`);
      
      const pagarmeOrder = await createPagarmeOrder({
        customer: {
          name: nome_cliente,
          email: email_cliente,
          cpf: cpf_cliente || '',
          phone: telefone_cliente,
          address: typeof endereco_entrega === 'object' ? JSON.stringify(endereco_entrega) : undefined
        },
        card: card,
        amount: Math.round(total * 100),
        paymentMethod: metodo_pagamento === 'pix' ? 'pix' : 'credit_card',
        description: `Pedido Loja SFK #${pedido.id.substring(0, 8)}`,
        code: orderCode,
        softDescriptor: softDescriptor,
        ip: clientIp,
        franquia: unidade,
        installments: installments ? Number(installments) : 1
      });

      const charge = pagarmeOrder?.charges?.[0];
      const chargeId = charge?.id;
      const pagarmeStatus = pagarmeOrder?.status;

      let finalStatus = 'aguardando_pagamento';
      if (pagarmeStatus === 'paid') {
        finalStatus = 'pago';
      } else if (pagarmeStatus === 'failed') {
        finalStatus = 'cancelado';
      }

      // Atualizar pedido com IDs do Pagar.me
      await supabase
        .from('loja_pedidos')
        .update({
          status: finalStatus,
          pagarme_order_id: pagarmeOrder.id,
          pagarme_charge_id: chargeId
        })
        .eq('id', pedido.id);

      if (finalStatus === 'cancelado') {
        return res.status(400).json({ error: 'Pagamento não autorizado pelo gateway ou dados inválidos.' });
      }

      if (finalStatus === 'pago') {
        await processarBaixaEstoquePedido(pedido.id);
      }

      // Se tiver cupom, salvar o uso dele
      if (cupom_id) {
        await supabase
          .from('cupom_usos')
          .insert([{
            cupom_id,
            responsavel_id,
            pedido_id: pedido.id,
            created_at: new Date().toISOString()
          }]);
      }

      // Enviar notificação UTalk
      if (finalStatus === 'pago') {
        sendLojaNotificationByPedidoId(pedido.id, 'pago');
      } else if (finalStatus === 'cancelado') {
        sendLojaNotificationByPedidoId(pedido.id, 'falha');
      } else if (finalStatus === 'aguardando_pagamento') {
        sendLojaNotificationByPedidoId(pedido.id, 'aguardando_pagamento');
      }

      // Fetch updated list of students and flatten for frontend compatibility
      let flatAlunos: any[] = [];
      if (responsavel_id) {
        try {
          const { data: students, error: sError } = await supabase
            .from('alunos')
            .select('*, matriculas(*)')
            .eq('responsavel_id', responsavel_id);

          if (!sError) {
            const { data: turmasComp } = await supabase
              .from('turmas')
              .select('nome, dias_horarios');

            const allTurmas = turmasComp || [];
            const turmaScheduleMap = new Map();
            allTurmas.forEach(t => {
              if (t.nome && t.dias_horarios) {
                const normalizedName = t.nome.trim().toLowerCase();
                turmaScheduleMap.set(normalizedName, t.dias_horarios);
              }
            });

            students?.forEach((aluno: any) => {
              if (aluno.matriculas && aluno.matriculas.length > 0) {
                aluno.matriculas.forEach((mat: any) => {
                  const lookupName = (mat.turma || "").trim().toLowerCase();
                  flatAlunos.push({
                    ...aluno,
                    id: mat.id,
                    aluno_id: aluno.id,
                    turma: mat.turma,
                    unidade: mat.unidade,
                    status: mat.status,
                    data_cancelamento: mat.data_cancelamento,
                    data_matricula: mat.data_matricula,
                    pagarme_subscription_id: mat.pagarme_subscription_id,
                    horario: turmaScheduleMap.get(lookupName) || null,
                    matriculas: undefined
                  });
                });
              } else {
                flatAlunos.push({
                  ...aluno,
                  aluno_id: aluno.id,
                  turma: null,
                  unidade: null
                });
              }
            });
          }
        } catch (errAlunos) {
          console.warn("Error refetching students in checkout response:", errAlunos);
        }
      }

      // Responder com o resultado
      let paymentInfo: any = {};
      if (metodo_pagamento === 'pix') {
        // Função auxiliar para buscar chaves recursivamente (ex: qr_code pode estar aninhado em variações da API V5)
        const getNestedVal = (obj: any, key: string): any => {
          if (!obj || typeof obj !== 'object') return null;
          if (obj[key]) return obj[key];
          for (const k in obj) {
            const v = getNestedVal(obj[k], key);
            if (v) return v;
          }
          return null;
        };

        const lastTransaction = charge?.last_transaction || {};
        paymentInfo = {
          qr_code: lastTransaction?.qr_code || charge?.qr_code || getNestedVal(pagarmeOrder, 'qr_code') || getNestedVal(pagarmeOrder, 'pix_qr_code'),
          qr_code_url: lastTransaction?.qr_code_url || charge?.qr_code_url || getNestedVal(pagarmeOrder, 'qr_code_url') || getNestedVal(pagarmeOrder, 'pix_qr_code_url')
        };
      }

      res.json({
        success: true,
        pedido_id: pedido.id,
        status: finalStatus,
        paymentInfo,
        pagarmeOrderId: pagarmeOrder.id,
        alunos: flatAlunos
      });

    } catch (err: any) {
      console.error('[API Criar Pedido Loja] Erro:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // ─── EVENTOS ENDPOINTS ────────────────────────────────────────────────────────

  // 1. List events
  app.get("/api/eventos", async (req, res) => {
    try {
      const { data, error } = await supabase
        .from('eventos')
        .select('*')
        .eq('status', 'publicado')
        .order('data_inicio', { ascending: true });
      if (error) throw error;
      res.json({ eventos: data });
    } catch (err: any) {
      console.error('[API Listar Eventos] Erro:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // 2. Event details
  app.get("/api/eventos/:slug", async (req, res) => {
    try {
      const { slug } = req.params;
      const { data, error } = await supabase
        .from('eventos')
        .select('*')
        .eq('slug', slug)
        .eq('status', 'publicado')
        .maybeSingle();
      if (error) throw error;
      if (!data) return res.status(404).json({ error: 'Evento não encontrado' });
      res.json(data);
    } catch (err: any) {
      console.error('[API Detalhes Evento] Erro:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // 3. Register for event
  app.post("/api/eventos/:id/inscricoes", async (req, res) => {
    try {
      const { id: eventoId } = req.params;
      const {
        responsavel_id,
        aluno_id,
        categoria,
        observacoes,
        nome_aluno,
        nome_responsavel,
        email_responsavel,
        telefone_responsavel,
        cpf_responsavel,
        metodo_pagamento,
        card,
        unidade,
        aluno_data_nascimento,
        responsavel_whatsapp,
        respostas_personalizadas,
        cupom_id,
        valor_desconto,
        installments
      } = req.body;

      // 1. Buscar evento
      const { data: evento, error: evError } = await supabase
        .from('eventos')
        .select('*')
        .eq('id', eventoId)
        .single();
      
      if (evError || !evento) {
        return res.status(404).json({ error: 'Evento não encontrado.' });
      }

      // 1.1 Verificar prazo de inscrição
      if (evento.prazo_inscricao && new Date() > new Date(evento.prazo_inscricao)) {
        return res.status(400).json({ error: 'Inscrições para este evento já foram encerradas.' });
      }

      // 1.2 Validar campos dinâmicos personalizados
      const respostas = respostas_personalizadas || {};
      const campos = evento.campos_personalizados || [];
      for (const campo of campos) {
        if (campo.obrigatorio && !respostas[campo.label]) {
          return res.status(400).json({ error: `O campo "${campo.label}" é obrigatório.` });
        }
      }

      // 1.3 Calcular a taxa correta com base no modelo de preço
      let taxa = 0;
      if (evento.tipo_preco === 'fixo') {
        taxa = Number(evento.taxa_inscricao || 0);
      } else if (evento.tipo_preco === 'categorias') {
        const opc = (evento.opcoes_precos || []).find((o: any) => o.nome === categoria);
        taxa = opc ? Number(opc.preco || 0) : 0;
      }

      // Aplicar desconto se houver cupom
      let finalTaxa = taxa;
      if (cupom_id && valor_desconto) {
        finalTaxa = taxa - Number(valor_desconto);
        if (finalTaxa < 0) finalTaxa = 0;
      }

      const isFree = finalTaxa === 0;

      // 2. Criar a inscrição
      const numInscricao = `INS_${eventoId.substring(0, 4)}_${Date.now().toString().slice(-6)}`;
      const { data: inscricao, error: insError } = await supabase
        .from('evento_inscricoes')
        .insert([{
          evento_id: eventoId,
          responsavel_id,
          aluno_id,
          categoria,
          status: 'pendente',
          taxa_paga: isFree,
          observacoes,
          numero_inscricao: numInscricao,
          nome_aluno,
          nome_responsavel,
          email_responsavel,
          respostas_personalizadas: {
            ...respostas,
            "Data de Nascimento do Aluno": aluno_data_nascimento,
            "WhatsApp do Responsável": responsavel_whatsapp,
            "CPF do Responsável": cpf_responsavel,
            "metodo_pagamento": metodo_pagamento === 'pix' ? 'PIX' : 'Cartão de Crédito'
          },
          valor_pago: finalTaxa,
          cupom_id: cupom_id || null,
          created_at: new Date().toISOString()
        }])
        .select()
        .single();

      if (insError) throw insError;

      const targetPhone = telefone_responsavel || responsavel_whatsapp;
      const buildWhatsAppMsg = (status: string) => {
        const dataEv = new Date(evento.data_inicio);
        const dataFormatada = dataEv.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', day: 'numeric', month: 'long', year: 'numeric' });
        const horaFormatada = dataEv.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' });
        
        let msg = `Olá, ${nome_responsavel}!\n` +
          `Sua inscrição no evento *${evento.titulo}* foi realizada com sucesso! 🎉\n\n` +
          `*Detalhes da Inscrição:*\n` +
          `- Código: ${numInscricao}\n` +
          `- Aluno(a): ${nome_aluno}\n` +
          `- Categoria: ${categoria || 'Geral'}\n\n` +
          `*Detalhes do Evento:*\n` +
          `- Data: ${dataFormatada} às ${horaFormatada}h\n` +
          `- Local: ${evento.local || 'A definir'}\n\n`;
        
        if (isFree) {
          msg += `Sua participação está confirmada!`;
        } else if (metodo_pagamento === 'pix' && status === 'pendente') {
          msg += `Lembre-se de efetuar o pagamento do PIX para garantir sua vaga.`;
        } else if (status === 'confirmado') {
          msg += `Pagamento confirmado e participação garantida!`;
        } else {
          msg += `Aguardamos a confirmação do pagamento.`;
        }
        return msg;
      };

      // Se o evento for gratuito, inscrição está finalizada
      if (isFree) {
        await supabase
          .from('evento_inscricoes')
          .update({ status: 'confirmado', taxa_paga: true })
          .eq('id', inscricao.id);
        
        try {
          const msg = buildWhatsAppMsg('confirmado');
          await sendWhatsAppMessage(targetPhone, nome_responsavel, msg, unidade).catch(e => 
            console.error('[WhatsApp Eventos] Falha ao enviar:', e)
          );
        } catch (err) {
          console.error('[WhatsApp Eventos] Falha ao montar/enviar mensagem:', err);
        }
        
        return res.json({
          success: true,
          inscricao_id: inscricao.id,
          status: 'confirmado',
          gratuito: true
        });
      }

      // 3. Processar taxa de inscrição via Pagar.me
      const softDescriptor = await getSetting('pagarme_soft_descriptor', 'SportForKids');
      const orderCode = `evento_${inscricao.id}`;
      
      const ip = req.ip || req.headers['x-forwarded-for'] || '127.0.0.1';
      const clientIp = Array.isArray(ip) ? ip[0] : ip;

      console.log(`[Pagar.me Eventos] Cobrando taxa de R$ ${finalTaxa} para inscrição ${inscricao.id}`);

      const pagarmeOrder = await createPagarmeOrder({
        customer: {
          name: nome_responsavel,
          email: email_responsavel,
          cpf: cpf_responsavel || '',
          phone: telefone_responsavel,
        },
        card: card,
        amount: Math.round(finalTaxa * 100),
        paymentMethod: metodo_pagamento === 'pix' ? 'pix' : 'credit_card',
        description: `Taxa Evento - ${evento.titulo} - ${nome_aluno}`,
        code: orderCode,
        softDescriptor: softDescriptor,
        ip: clientIp,
        franquia: unidade,
        installments: installments ? Number(installments) : 1
      });

      const charge = pagarmeOrder?.charges?.[0];
      const chargeId = charge?.id;
      const pagarmeStatus = pagarmeOrder?.status;

      let finalStatus = 'pendente';
      let taxaPaga = false;
      if (pagarmeStatus === 'paid') {
        finalStatus = 'confirmado';
        taxaPaga = true;
      } else if (pagarmeStatus === 'failed') {
        finalStatus = 'cancelado';
      }

      await supabase
        .from('evento_inscricoes')
        .update({
          status: finalStatus,
          taxa_paga: taxaPaga,
          pagarme_order_id: pagarmeOrder.id
        })
        .eq('id', inscricao.id);

      if (finalStatus === 'cancelado') {
        return res.status(400).json({ error: 'Pagamento não autorizado pelo gateway ou dados inválidos.' });
      }

      // Se tiver cupom, salvar o uso dele
      if (cupom_id) {
        await supabase
          .from('cupom_usos')
          .insert([{
            cupom_id,
            responsavel_id,
            inscricao_id: inscricao.id,
            created_at: new Date().toISOString()
          }]);
      }

      let paymentInfo: any = {};
      if (metodo_pagamento === 'pix') {
        // Função auxiliar para buscar chaves recursivamente
        const getNestedVal = (obj: any, key: string): any => {
          if (!obj || typeof obj !== 'object') return null;
          if (obj[key]) return obj[key];
          for (const k in obj) {
            const v = getNestedVal(obj[k], key);
            if (v) return v;
          }
          return null;
        };

        const lastTransaction = charge?.last_transaction || {};
        paymentInfo = {
          qr_code: lastTransaction?.qr_code || charge?.qr_code || getNestedVal(pagarmeOrder, 'qr_code') || getNestedVal(pagarmeOrder, 'pix_qr_code'),
          qr_code_url: lastTransaction?.qr_code_url || charge?.qr_code_url || getNestedVal(pagarmeOrder, 'qr_code_url') || getNestedVal(pagarmeOrder, 'pix_qr_code_url')
        };
      }

      try {
        const msg = buildWhatsAppMsg(finalStatus);
        await sendWhatsAppMessage(targetPhone, nome_responsavel, msg, unidade).catch(e => 
          console.error('[WhatsApp Eventos] Falha ao enviar:', e)
        );
      } catch (err) {
        console.error('[WhatsApp Eventos] Falha ao montar/enviar mensagem:', err);
      }

      res.json({
        success: true,
        inscricao_id: inscricao.id,
        status: finalStatus,
        paymentInfo,
        pagarmeOrderId: pagarmeOrder.id
      });

    } catch (err: any) {
      console.error('[API Criar Inscrição Evento] Erro:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // ─── ADMIN/PORTAL EXTRA ENDPOINTS ─────────────────────────────────────────────

  // Admin list products
  app.get("/api/admin/loja/produtos", async (req, res) => {
    try {
      const { data: produtos, error: pError } = await supabase.from('loja_produtos').select('*').order('ordem', { ascending: true });
      if (pError) throw pError;

      const { data: categorias, error: cError } = await supabase.from('loja_categorias').select('*');
      if (cError) throw cError;

      const mapped = (produtos || []).map((p: any) => ({
        ...p,
        loja_categorias: categorias?.find((c: any) => c.id === p.categoria_id) || null
      }));

      res.json(mapped);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Admin reorder products
  app.put("/api/admin/loja/produtos/reorder", async (req, res) => {
    try {
      const { order } = req.body;
      if (!Array.isArray(order)) return res.status(400).json({ error: 'Formato inválido' });
      for (const item of order) {
        if (!item.id || item.ordem === undefined) continue;
        await supabase.from('loja_produtos').update({ ordem: item.ordem }).eq('id', item.id);
      }
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Admin save/create product
  app.post("/api/admin/loja/produtos", async (req, res) => {
    try {
      const cleanBody = { ...req.body };
      delete cleanBody.loja_categorias;
      delete cleanBody.categoria;
      delete cleanBody.id;
      const { data, error } = await supabase.from('loja_produtos').insert([cleanBody]).select().single();
      if (error) throw error;
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Admin edit product
  app.put("/api/admin/loja/produtos/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const cleanBody = { ...req.body };
      delete cleanBody.loja_categorias;
      delete cleanBody.categoria;
      const { data, error } = await supabase.from('loja_produtos').update(cleanBody).eq('id', id).select().single();
      if (error) throw error;
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Admin delete product
  app.delete("/api/admin/loja/produtos/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { error } = await supabase.from('loja_produtos').delete().eq('id', id);
      if (error) throw error;
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Admin list all product stock history
  app.get("/api/admin/loja/estoque/historico", requireAdminAuth, async (req, res) => {
    try {
      const { data, error } = await supabase
        .from('loja_produto_historico_estoque')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      res.json(data);
    } catch (err: any) {
      console.error("Error listing global stock history:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // Admin list product stock history
  app.get("/api/admin/loja/produtos/:id/estoque/historico", async (req, res) => {
    try {
      const { id } = req.params;
      const { data, error } = await supabase
        .from('loja_produto_historico_estoque')
        .select('*')
        .eq('produto_id', id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      res.json(data || []);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Admin add stock to product variant
  app.post("/api/admin/loja/produtos/:id/estoque/adicionar", async (req, res) => {
    try {
      const { id } = req.params;
      const { variante_key, quantidade, data_registro, motivo } = req.body;
      const qty = parseInt(quantidade, 10);
      if (isNaN(qty) || qty === 0) {
        return res.status(400).json({ error: 'Quantidade inválida. Não pode ser zero.' });
      }

      // 1. Get product current stock
      const { data: prod, error: pErr } = await supabase
        .from('loja_produtos')
        .select('estoque_por_variante')
        .eq('id', id)
        .single();
      
      if (pErr || !prod) {
        return res.status(404).json({ error: 'Produto não encontrado.' });
      }

      const estoque = prod.estoque_por_variante || {};
      const key = variante_key || 'default';
      const currentQty = parseInt(estoque[key] || '0', 10);
      estoque[key] = currentQty + qty;

      // 2. Update product stock JSON
      const { error: updateErr } = await supabase
        .from('loja_produtos')
        .update({ estoque_por_variante: estoque })
        .eq('id', id);
      
      if (updateErr) throw updateErr;

      // 3. Insert history record
      const { data: hist, error: histErr } = await supabase
        .from('loja_produto_historico_estoque')
        .insert([{
          produto_id: id,
          variante_key: key,
          quantidade: qty,
          tipo: qty < 0 ? 'saida' : 'entrada',
          motivo: motivo || (qty < 0 ? 'ajuste' : 'adicao'),
          created_at: data_registro ? new Date(data_registro).toISOString() : new Date().toISOString()
        }])
        .select()
        .single();

      if (histErr) throw histErr;

      res.json({ success: true, estoque, historico: hist });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Admin list categories
  app.get("/api/admin/loja/categorias", async (req, res) => {
    try {
      const { data, error } = await supabase.from('loja_categorias').select('*').order('ordem', { ascending: true });
      if (error) throw error;
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Admin save/create category
  app.post("/api/admin/loja/categorias", async (req, res) => {
    try {
      const { data, error } = await supabase.from('loja_categorias').insert([req.body]).select().single();
      if (error) throw error;
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Admin edit category
  app.put("/api/admin/loja/categorias/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { data, error } = await supabase.from('loja_categorias').update(req.body).eq('id', id).select().single();
      if (error) throw error;
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Admin delete category
  app.delete("/api/admin/loja/categorias/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { error } = await supabase.from('loja_categorias').delete().eq('id', id);
      if (error) throw error;
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Admin list events
  app.get("/api/admin/eventos", async (req, res) => {
    try {
      const { data, error } = await supabase.from('eventos').select('*').order('data_inicio', { ascending: false });
      if (error) throw error;
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Admin save/create event
  app.post("/api/admin/eventos", async (req, res) => {
    try {
      const { data, error } = await supabase.from('eventos').insert([req.body]).select().single();
      if (error) throw error;
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Admin edit event
  app.put("/api/admin/eventos/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { data, error } = await supabase.from('eventos').update(req.body).eq('id', id).select().single();
      if (error) throw error;
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Admin delete event
  app.delete("/api/admin/eventos/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { error } = await supabase.from('eventos').delete().eq('id', id);
      if (error) throw error;
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Admin view event inscriptions
  app.get("/api/admin/eventos/:id/inscricoes", async (req, res) => {
    try {
      const { id } = req.params;
      const { data, error } = await supabase
        .from('evento_inscricoes')
        .select('*')
        .eq('evento_id', id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Validate a coupon for usage
  app.post("/api/cupons/validar", async (req, res) => {
    try {
      const { codigo, responsavel_id, contexto, itemId, valorOriginal } = req.body;
      if (!codigo || !responsavel_id || !contexto || valorOriginal === undefined) {
        return res.status(400).json({ error: 'Parâmetros de validação ausentes.' });
      }

      // Find active coupon
      const { data: coupon, error } = await supabase
        .from('cupons')
        .select('*')
        .eq('codigo', codigo.trim().toUpperCase())
        .eq('ativo', true)
        .single();

      if (error || !coupon) {
        return res.status(404).json({ error: 'Cupom inválido ou inativo.' });
      }

      // Check validity date
      if (coupon.validade && new Date(coupon.validade) < new Date()) {
        return res.status(400).json({ error: 'Cupom expirado.' });
      }

      // Check global limit
      if (coupon.limite_total_uso !== null && coupon.limite_total_uso !== undefined) {
        const { count, error: countErr } = await supabase
          .from('cupom_usos')
          .select('*', { count: 'exact', head: true })
          .eq('cupom_id', coupon.id);
        
        if (!countErr && count !== null && count >= coupon.limite_total_uso) {
          return res.status(400).json({ error: 'Este cupom atingiu o limite de usos.' });
        }
      }

      // Check usage per user limit
      if (coupon.limite_por_usuario !== null && coupon.limite_por_usuario !== undefined) {
        const { count, error: userCountErr } = await supabase
          .from('cupom_usos')
          .select('*', { count: 'exact', head: true })
          .eq('cupom_id', coupon.id)
          .eq('responsavel_id', responsavel_id);

        if (!userCountErr && count !== null && count >= coupon.limite_por_usuario) {
          return res.status(400).json({ error: 'Você já atingiu o limite de uso deste cupom.' });
        }
      }

      // Scope checks
      if (contexto === 'loja') {
        if (coupon.escopo !== 'loja_todos' && coupon.escopo !== 'loja_especifico') {
          return res.status(400).json({ error: 'Este cupom não é válido para produtos da loja.' });
        }
        if (coupon.escopo === 'loja_especifico' && coupon.produto_id && coupon.produto_id !== itemId) {
          return res.status(400).json({ error: 'Cupom não se aplica ao produto selecionado.' });
        }
      } else if (contexto === 'eventos') {
        if (coupon.escopo !== 'eventos_todos' && coupon.escopo !== 'eventos_especifico') {
          return res.status(400).json({ error: 'Este cupom não é válido para inscrições de eventos.' });
        }
        if (coupon.escopo === 'eventos_especifico' && coupon.evento_id && coupon.evento_id !== itemId) {
          return res.status(400).json({ error: 'Cupom não se aplica ao evento selecionado.' });
        }
      }

      // Calculate discount value
      let desconto = 0;
      if (coupon.tipo_desconto === 'porcentagem') {
        desconto = Number(valorOriginal) * (Number(coupon.valor) / 100);
      } else {
        desconto = Number(coupon.valor);
      }

      if (desconto > Number(valorOriginal)) {
        desconto = Number(valorOriginal);
      }

      res.json({
        valid: true,
        cupom_id: coupon.id,
        codigo: coupon.codigo,
        desconto: Number(desconto.toFixed(2)),
        tipo_desconto: coupon.tipo_desconto,
        valor_cupom: coupon.valor
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Admin GET all coupons
  app.get("/api/admin/cupons", async (req, res) => {
    try {
      const { data, error } = await supabase
        .from('cupons')
        .select('*, cupom_usos(id)')
        .order('created_at', { ascending: false });

      if (error) throw error;
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Admin POST create coupon
  app.post("/api/admin/cupons", async (req, res) => {
    try {
      console.log('--- CREATE COUPON PAYLOAD ---');
      console.log(req.body);
      const { codigo, tipo_desconto, valor, escopo, produto_id, evento_id, limite_total_uso, limite_por_usuario, validade, aplicar_em, turma_id } = req.body;
      
      const { data, error } = await supabase
        .from('cupons')
        .insert([{
          codigo: codigo.trim().toUpperCase(),
          nome: codigo.trim().toUpperCase(),
          tipo_desconto,
          tipo: tipo_desconto === 'porcentagem' ? 'percentual' : 'fixo',
          aplicar_em: aplicar_em || 'todas_parcelas',
          data_inicio: new Date().toISOString().split('T')[0],
          valor: Number(valor),
          escopo,
          produto_id: produto_id || null,
          evento_id: evento_id || null,
          limite_total_uso: limite_total_uso ? Number(limite_total_uso) : null,
          limite_uso: limite_total_uso ? Number(limite_total_uso) : null, // Sync for courses
          limite_por_usuario: limite_por_usuario ? Number(limite_por_usuario) : null,
          validade: validade ? new Date(validade).toISOString() : null,
          data_expiracao: validade ? new Date(validade).toISOString().split('T')[0] : null, // Sync for courses
          ativo: true,
          created_at: new Date().toISOString(),
          turma_id: turma_id || null
        }])
        .select()
        .single();

      if (error) throw error;
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Admin PUT update coupon
  app.put("/api/admin/cupons/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { codigo, tipo_desconto, valor, escopo, produto_id, evento_id, limite_total_uso, limite_por_usuario, validade, ativo, usos_atuais, aplicar_em, turma_id } = req.body;

      const updates: any = {};
      if (codigo !== undefined) {
        updates.codigo = codigo.trim().toUpperCase();
        updates.nome = codigo.trim().toUpperCase();
      }
      if (tipo_desconto !== undefined) {
        updates.tipo_desconto = tipo_desconto;
        updates.tipo = tipo_desconto === 'porcentagem' ? 'percentual' : 'fixo';
      }
      if (valor !== undefined) updates.valor = Number(valor);
      if (escopo !== undefined) updates.escopo = escopo;
      if (produto_id !== undefined) updates.produto_id = produto_id || null;
      if (evento_id !== undefined) updates.evento_id = evento_id || null;
      if (validade !== undefined) {
        updates.validade = validade ? new Date(validade).toISOString() : null;
        updates.data_expiracao = validade ? new Date(validade).toISOString().split('T')[0] : null; // Sync for courses
      }
      if (ativo !== undefined) updates.ativo = ativo;
      if (aplicar_em !== undefined) updates.aplicar_em = aplicar_em;
      if (turma_id !== undefined) updates.turma_id = turma_id || null;

      // Handle limit fields:
      // - A positive number → update to that value
      // - Explicitly the string '__clear__' → set to null (intentional removal)
      // - Empty string, null or undefined → do NOT touch the existing DB value
      if (limite_total_uso !== undefined && limite_total_uso !== '' && limite_total_uso !== null) {
        updates.limite_total_uso = limite_total_uso === '__clear__' ? null
          : (Number(limite_total_uso) > 0 ? Number(limite_total_uso) : null);
        updates.limite_uso = updates.limite_total_uso; // Sync for courses
      }
      if (limite_por_usuario !== undefined && limite_por_usuario !== '' && limite_por_usuario !== null) {
        updates.limite_por_usuario = limite_por_usuario === '__clear__' ? null
          : (Number(limite_por_usuario) > 0 ? Number(limite_por_usuario) : null);
      }

      const { data, error } = await supabase
        .from('cupons')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Admin DELETE coupon
  app.delete("/api/admin/cupons/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { error } = await supabase.from('cupons').delete().eq('id', id);
      if (error) throw error;
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Portal orders for client/guardian
  app.get("/api/portal/loja/pedidos", async (req, res) => {
    try {
      // Accept responsavel_id from Authorization header (guardian session) OR query param as fallback
      let responsavel_id = req.query.responsavel_id as string;
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        const { data: { user } } = await supabase.auth.getUser(token);
        if (user) {
          // Look up responsavel by Supabase auth user id
          const { data: resp } = await supabase.from('responsaveis').select('id').eq('auth_user_id', user.id).single();
          if (resp) responsavel_id = resp.id;
        }
      }
      if (!responsavel_id) return res.status(400).json({ error: 'responsavel_id é obrigatório.' });
      
      const { data, error } = await supabase
        .from('loja_pedidos')
        .select('*, loja_pedido_itens(*), loja_pedidos_solicitacoes(*)')
        .eq('responsavel_id', responsavel_id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });


  // Portal create order exchange/return request
  app.post("/api/portal/loja/pedidos/solicitacoes", async (req, res) => {
    try {
      const { pedido_id, tipo, detalhes, item_id, novo_produto_id, nova_variante, diferenca_valor } = req.body;
      if (!pedido_id || !tipo || !detalhes) {
        return res.status(400).json({ error: 'Parâmetros inválidos.' });
      }
      const { data, error } = await supabase
        .from('loja_pedidos_solicitacoes')
        .insert([{ 
          pedido_id, 
          tipo, 
          detalhes, 
          item_id: item_id || null,
          novo_produto_id: novo_produto_id || null,
          nova_variante: nova_variante || null,
          diferenca_valor: diferenca_valor || 0,
          status: 'pendente', 
          created_at: new Date().toISOString() 
        }])
        .select()
        .single();
      
      if (error) throw error;
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Portal book trial class
  app.post("/api/portal/aulas-experimentais/agendar", async (req, res) => {
    try {
      const { guardianId, alunoId, studentData, bookingData } = req.body;
      if (!guardianId || !bookingData || !bookingData.unidade || !bookingData.turma || !bookingData.dataAula) {
        return res.status(400).json({ error: 'Parâmetros obrigatórios ausentes.' });
      }

      // Fetch guardian details
      const { data: guardianData, error: guardianError } = await supabase
        .from('responsaveis')
        .select('nome_completo, telefone')
        .eq('id', guardianId)
        .single();
      
      if (guardianError || !guardianData) {
        return res.status(404).json({ error: 'Responsável não encontrado.' });
      }

      let targetAlunoId = alunoId;
      let studentGrade = '';

      if (alunoId === 'novo' || !alunoId) {
        if (!studentData || !studentData.name || !studentData.birthDate || !studentData.grade) {
          return res.status(400).json({ error: 'Dados do novo aluno incompletos.' });
        }

        // Check if student already exists for this guardian
        const { data: existingStudent } = await supabase
          .from('alunos')
          .select('id, serie_ano')
          .eq('responsavel_id', guardianId)
          .ilike('nome_completo', studentData.name.trim())
          .eq('data_nascimento', studentData.birthDate)
          .limit(1)
          .maybeSingle();

        if (existingStudent) {
          targetAlunoId = existingStudent.id;
          studentGrade = existingStudent.serie_ano;
        } else {
          // Create new student
          const { data: newStudent, error: sError } = await supabase
            .from('alunos')
            .insert([{
              responsavel_id: guardianId,
              nome_completo: studentData.name.trim(),
              data_nascimento: studentData.birthDate,
              serie_ano: studentData.grade,
              is_lead: true,
              responsavel_1: guardianData.nome_completo,
              whatsapp_1: guardianData.telefone
            }])
            .select()
            .single();

          if (sError || !newStudent) {
            console.error('Error inserting student:', sError);
            return res.status(500).json({ error: 'Erro ao cadastrar novo aluno.' });
          }
          targetAlunoId = newStudent.id;
          studentGrade = newStudent.serie_ano;
        }
      } else {
        // Fetch existing student details
        const { data: existingStudent, error: studentError } = await supabase
          .from('alunos')
          .select('serie_ano')
          .eq('id', alunoId)
          .single();

        if (studentError || !existingStudent) {
          return res.status(404).json({ error: 'Aluno não encontrado.' });
        }
        studentGrade = existingStudent.serie_ano;
      }

      // Fetch class details
      const { data: classData } = await supabase
        .from('turmas')
        .select('nome, dias_horarios')
        .eq('nome', bookingData.turma)
        .limit(1)
        .maybeSingle();

      // Create trial class booking
      const { data: trialClass, error: tError } = await supabase
        .from('aulas_experimentais')
        .insert([{
          id: crypto.randomUUID(),
          unidade: bookingData.unidade,
          curso: classData?.nome ? classData.nome.split(' ')[0] : 'Esporte',
          aula: bookingData.dataAula,
          horario: classData?.dias_horarios || '',
          responsavel1: guardianData.nome_completo,
          whatsapp1: guardianData.telefone,
          status: 'Pendente',
          etapa: 'Agendado',
          ano_escolar: studentGrade,
          turma_escolar: bookingData.turma,
          aluno_id: targetAlunoId
        }])
        .select()
        .single();

      if (tError) {
        console.error('Error booking trial class:', tError);
        return res.status(500).json({ error: 'Erro ao agendar aula experimental.' });
      }

      // Fetch updated list of students and flatten for frontend compatibility
      const { data: students, error: sError } = await supabase
        .from('alunos')
        .select('*, matriculas(*)')
        .eq('responsavel_id', guardianId);

      if (sError) {
        console.warn("Error fetching students on trial booking:", sError);
      }

      // Fetch all turmas to get schedules
      const { data: turmasComp } = await supabase
        .from('turmas')
        .select('nome, dias_horarios');

      const allTurmas = turmasComp || [];
      const turmaScheduleMap = new Map();
      allTurmas.forEach(t => {
        if (t.nome && t.dias_horarios) {
          const normalizedName = t.nome.trim().toLowerCase();
          turmaScheduleMap.set(normalizedName, t.dias_horarios);
        }
      });

      const flatAlunos: any[] = [];
      students?.forEach((aluno: any) => {
        if (aluno.matriculas && aluno.matriculas.length > 0) {
          aluno.matriculas.forEach((mat: any) => {
            const lookupName = (mat.turma || "").trim().toLowerCase();
            flatAlunos.push({
              ...aluno,
              id: mat.id,
              aluno_id: aluno.id,
              turma: mat.turma,
              unidade: mat.unidade,
              status: mat.status,
              data_cancelamento: mat.data_cancelamento,
              data_matricula: mat.data_matricula,
              pagarme_subscription_id: mat.pagarme_subscription_id,
              horario: turmaScheduleMap.get(lookupName) || null,
              matriculas: undefined
            });
          });
        } else {
          flatAlunos.push({
            ...aluno,
            aluno_id: aluno.id,
            turma: null,
            unidade: null
          });
        }
      });

      res.json({ success: true, trialClass, alunos: flatAlunos });
    } catch (err: any) {
      console.error('Server error on trial class booking:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // Portal event inscriptions for client/guardian
  app.get("/api/portal/eventos/inscricoes", async (req, res) => {
    try {
      // Accept responsavel_id from Authorization header (guardian session) OR query param as fallback
      let responsavel_id = req.query.responsavel_id as string;
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        const { data: { user } } = await supabase.auth.getUser(token);
        if (user) {
          const { data: resp } = await supabase.from('responsaveis').select('id').eq('auth_user_id', user.id).single();
          if (resp) responsavel_id = resp.id;
        }
      }
      if (!responsavel_id) return res.status(400).json({ error: 'responsavel_id é obrigatório.' });
      
      const { data, error } = await supabase
        .from('evento_inscricoes')
        .select('*, eventos(*)')
        .eq('responsavel_id', responsavel_id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });


  // Admin GET orders (last 15 days or pending delivery)
  app.get("/api/admin/loja/pedidos", async (req, res) => {
    try {
      const { all } = req.query;
      let query = supabase
        .from('loja_pedidos')
        .select('*, loja_pedido_itens(*), loja_pedidos_solicitacoes(*)');

      if (all !== 'true') {
        const date15DaysAgo = new Date();
        date15DaysAgo.setDate(date15DaysAgo.getDate() - 15);
        query = query.or(`created_at.gte.${date15DaysAgo.toISOString()},status.eq.pendente_entrega`);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Admin PUT update order status
  app.put("/api/admin/loja/pedidos/:id/status", async (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;
      const { data, error } = await supabase
        .from('loja_pedidos')
        .update({ status })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Admin PUT update order status_entrega
  app.put("/api/admin/loja/pedidos/:id/status-entrega", async (req, res) => {
    try {
      const { id } = req.params;
      const { status_entrega } = req.body;

      // Pegar pedido antigo para verificar se o status mudou
      const { data: oldOrder, error: oldError } = await supabase
        .from('loja_pedidos')
        .select('status_entrega, nome_cliente, telefone_cliente')
        .eq('id', id)
        .single();
        
      if (oldError) throw oldError;

      let updatePayload: any = { status_entrega };

      const { data, error } = await supabase
        .from('loja_pedidos')
        .update(updatePayload)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      // Disparar WhatsApp se mudou para disponivel_unidade (de qualquer outro status)
      if (oldOrder && oldOrder.status_entrega !== 'disponivel_unidade' && status_entrega === 'disponivel_unidade') {
        const telefone = oldOrder.telefone_cliente;
        const nomeCliente = oldOrder.nome_cliente;
        if (telefone) {
          const shortId = id.substring(0, 8);
          const msg = `Olá, *${nomeCliente}*! Tudo bem? Passando para avisar que o seu pedido (#${shortId}) de uniformes da Sport for Kids já está *Disponível na Unidade* para retirada. Quando for à escola ou ao treino, é só pegar a sacola! 📦`;
          
          // Chama o helper existente de WhatsApp (fire and forget ou aguarda, aqui vamos aguardar com log)
          sendWhatsAppMessage(telefone, nomeCliente, msg).catch(err => {
            console.error(`Erro ao enviar WhatsApp de pedido disponível (ID: ${id}):`, err);
          });
        }
      }

      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Admin DELETE loja pedido
  app.delete("/api/admin/loja/pedidos/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { error } = await supabase
        .from('loja_pedidos')
        .delete()
        .eq('id', id);

      if (error) throw error;
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Admin GET solicitacoes
  app.get("/api/admin/loja/pedidos/solicitacoes", async (req, res) => {
    try {
      const { data, error } = await supabase
        .from('loja_pedidos_solicitacoes')
        .select('*, loja_pedidos(*)')
        .order('created_at', { ascending: false });

      if (error) throw error;
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Admin PUT update solicitacao status
  app.put("/api/admin/loja/pedidos/solicitacoes/:id/status", async (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;
      
      if (status === 'aprovado') {
        // Obter detalhes da solicitação
        const { data: sol } = await supabase.from('loja_pedidos_solicitacoes').select('*, loja_pedidos(responsavel_id), loja_pedido_itens(produto_id, variante_selecionada)').eq('id', id).single();
        
        if (sol) {
          let cupomGeradoId = null;
          let linkPagamento = null;
          
          // Gerar Cupom se diferenca < 0
          if (sol.diferenca_valor < 0) {
            const valorCredito = Math.abs(sol.diferenca_valor);
            const codigoCupom = `TROCA${id.substring(0,6).toUpperCase()}`;
            const { data: cupom } = await supabase.from('cupons').insert([{
              codigo: codigoCupom,
              tipo: 'fixo',
              valor: valorCredito,
              quantidade: 1,
              ativo: true,
              usos_restantes: 1
            }]).select().single();
            if (cupom) cupomGeradoId = cupom.id;
          } else if (sol.diferenca_valor > 0) {
            linkPagamento = "Aguardando geração manual Pagar.me";
          }

          // Atualizar inventário
          if (sol.item_id && sol.loja_pedido_itens?.produto_id) {
             const oldProdId = sol.loja_pedido_itens.produto_id;
             // +1 no produto antigo (Não temos endpoint direto para decrementar variante em JSONB, vamos deixar o Gestor fazer ajuste manual se for JSONB complexo)
          }

          // Atualizar solicitação
          const { data, error } = await supabase
            .from('loja_pedidos_solicitacoes')
            .update({ status, cupom_gerado_id: cupomGeradoId, link_pagamento_gerado: linkPagamento, data_autorizacao: new Date().toISOString() })
            .eq('id', id)
            .select()
            .single();
            
          if (error) throw error;
          return res.json(data);
        }
      }

      const { data, error } = await supabase
        .from('loja_pedidos_solicitacoes')
        .update({ status })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Admin GET event inscriptions
  app.get("/api/admin/eventos/inscricoes", async (req, res) => {
    try {
      const { data, error } = await supabase
        .from('evento_inscricoes')
        .select('*, eventos(*)')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Manually fetch responsaveis to map missing phone numbers
      const responsaveisIds = Array.from(new Set(data?.map((i: any) => i.responsavel_id).filter(Boolean)));
      
      let responsaveisData: any[] = [];
      if (responsaveisIds.length > 0) {
        const { data: rData } = await supabase
          .from('responsaveis')
          .select('id, telefone, celular')
          .in('id', responsaveisIds);
        if (rData) responsaveisData = rData;
      }

      const responsaveisMap = new Map();
      responsaveisData.forEach((r: any) => responsaveisMap.set(r.id, r));

      const mappedData = data?.map((inscricao: any) => {
        if (!inscricao.telefone_responsavel && !inscricao.whatsapp_responsavel && inscricao.responsavel_id) {
          const resp = responsaveisMap.get(inscricao.responsavel_id);
          if (resp) {
            inscricao.whatsapp_responsavel = resp.celular || resp.telefone || '';
          }
        }
        return inscricao;
      });

      res.json(mappedData);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Admin POST Toggle check-in status
  app.post("/api/admin/eventos/inscricoes/:id/checkin", async (req, res) => {
    try {
      const { id } = req.params;
      const { checkin } = req.body;
      const { data, error } = await supabase
        .from('evento_inscricoes')
        .update({ checkin })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Admin PUT edit event inscription
  app.put("/api/admin/eventos/inscricoes/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      const { data, error } = await supabase
        .from('evento_inscricoes')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Admin DELETE event inscription
  app.delete("/api/admin/eventos/inscricoes/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { error } = await supabase
        .from('evento_inscricoes')
        .delete()
        .eq('id', id);

      if (error) throw error;
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Admin list kit items
  app.get("/api/admin/loja/produtos/:id/kit-itens", async (req, res) => {
    try {
      const { id } = req.params;
      const { data, error } = await supabase
        .from('loja_kit_itens')
        .select('*')
        .eq('kit_produto_id', id);
      
      if (error) throw error;
      res.json(data || []);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Admin save kit items
  app.post("/api/admin/loja/produtos/:id/kit-itens", async (req, res) => {
    try {
      const { id } = req.params;
      const items = req.body; // Array of { componente_produto_id, componente_variante_key, quantidade }

      // 1. Delete existing items
      const { error: delErr } = await supabase
        .from('loja_kit_itens')
        .delete()
        .eq('kit_produto_id', id);
      
      if (delErr) throw delErr;

      if (!items || items.length === 0) {
        return res.json({ success: true, count: 0 });
      }

      // 2. Insert new items
      const toInsert = items.map((item: any) => ({
        kit_produto_id: id,
        componente_produto_id: item.componente_produto_id,
        componente_variante_key: item.componente_variante_key || 'default',
        quantidade: item.quantidade || 1
      }));

      const { data, error } = await supabase
        .from('loja_kit_itens')
        .insert(toInsert)
        .select();

      if (error) throw error;
      res.json({ success: true, data });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Admin send generic whatsapp message
  app.post("/api/admin/whatsapp/send", async (req, res) => {
    try {
      const { phone, name, message, mediaUrl } = req.body;
      if (!phone || !message) {
        return res.status(400).json({ error: 'Phone and message are required' });
      }

      // Buscar configuração do Utalk na tabela identidades (prioridade para Sport for Kids)
      const { data: identidades, error } = await supabase.from('identidades').select('*');
      if (error) throw error;
      
      let identity = identidades.find((i: any) => i.nome?.toLowerCase().includes('sport for kids')) || identidades[0];
      
      if (!identity || !identity.utalk_token) {
         // Fallback para a Edge Function antiga
         await sendWhatsAppMessage(phone, name || '', message, 'Master');
         return res.json({ success: true, via: 'edge_function' });
      }

      // Formatar telefone para uTalk
      let cleanTo = phone.replace(/\D/g, '');
      if (cleanTo.length >= 10 && !cleanTo.startsWith('55')) {
        cleanTo = '55' + cleanTo;
      }
      
      const cleanFrom = (identity.utalk_from_phone || '').replace(/\D/g, '');

      const payload: any = {
        toPhone: cleanTo,
        fromPhone: cleanFrom,
        organizationId: identity.utalk_organization_id,
        message: message || ""
      };

      if (mediaUrl) {
        payload.mediaUrl = mediaUrl;
      }

      const response = await fetch("https://app-utalk.umbler.com/api/v1/messages/simplified/", {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${identity.utalk_token}`,
          'token': identity.utalk_token,
          'x-token': identity.utalk_token
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error("Erro no Utalk:", errText);
        throw new Error("Erro na API Utalk: " + response.status);
      }

      res.json({ success: true, via: 'utalk' });
    } catch (err: any) {
      console.error("[uTalk Backend] Error:", err);
      res.status(500).json({ error: err.message });
    }
  });

async function processarBaixaEstoquePedido(pedidoId: string) {
  try {
    console.log(`[Estoque] Iniciando baixa de estoque para o pedido ${pedidoId}`);
    
    // 1. Get order items
    const { data: itens, error: itensErr } = await supabase
      .from('loja_pedido_itens')
      .select('*')
      .eq('pedido_id', pedidoId);
    
    if (itensErr || !itens) {
      console.error(`[Estoque] Erro ao carregar itens do pedido ${pedidoId}:`, itensErr);
      return;
    }

    for (const item of itens) {
      const prodId = item.produto_id;
      if (!prodId) continue;
      const variantSelected = item.variante_selecionada || {};
      const qty = item.quantidade;

      // 2. Check if product is a kit
      const { data: prod, error: prodErr } = await supabase
        .from('loja_produtos')
        .select('is_kit, variantes')
        .eq('id', prodId)
        .single();
      
      if (prodErr || !prod) {
        console.error(`[Estoque] Erro ao buscar produto ${prodId}:`, prodErr);
        continue;
      }

      if (prod.is_kit) {
        console.log(`[Estoque] Produto ${prodId} é um kit! Baixando estoque dos componentes...`);
        // 3. Get kit components
        const { data: kitItens, error: kitItensErr } = await supabase
          .from('loja_kit_itens')
          .select('*')
          .eq('kit_produto_id', prodId);
        
        if (kitItensErr || !kitItens) {
          console.error(`[Estoque] Erro ao carregar componentes do kit ${prodId}:`, kitItensErr);
          continue;
        }

        for (const kitItem of kitItens) {
          const compProdId = kitItem.componente_produto_id;
          const compVariantKey = kitItem.componente_variante_key && kitItem.componente_variante_key !== 'default'
            ? kitItem.componente_variante_key
            : (variantSelected[compProdId] || 'default');
          const compQty = kitItem.quantidade * qty;

          await reduzirEstoqueProduto(compProdId, compVariantKey, compQty, `venda_kit_${pedidoId}`);
        }
      } else {
        // Simple product
        let variantKey = 'default';
        if (prod.variantes && prod.variantes.length > 0) {
          const sortedValues: string[] = [];
          for (const v of prod.variantes) {
            if (variantSelected[v.tipo]) {
              sortedValues.push(variantSelected[v.tipo]);
            }
          }
          if (sortedValues.length > 0) {
            variantKey = sortedValues.join(' - ');
          }
        }
        await reduzirEstoqueProduto(prodId, variantKey, qty, `venda_pedido_${pedidoId}`);
      }
    }
  } catch (err) {
    console.error(`[Estoque] Erro geral ao processar baixa de estoque do pedido ${pedidoId}:`, err);
  }
}

async function reduzirEstoqueProduto(prodId: string, variantKey: string, quantidade: number, motivo: string) {
  try {
    const { data: prod, error } = await supabase
      .from('loja_produtos')
      .select('estoque_por_variante')
      .eq('id', prodId)
      .single();

    if (error || !prod) {
      console.error(`[Estoque] Erro ao buscar estoque do produto ${prodId}:`, error);
      return;
    }

    const estoque = prod.estoque_por_variante || {};
    const key = variantKey || 'default';
    const currentQty = parseInt(estoque[key] || '0', 10);
    
    estoque[key] = Math.max(0, currentQty - quantidade);

    await supabase
      .from('loja_produtos')
      .update({ estoque_por_variante: estoque })
      .eq('id', prodId);

    // Record stock history entry
    await supabase
      .from('loja_produto_historico_estoque')
      .insert([{
        produto_id: prodId,
        variante_key: key,
        quantidade: -quantidade,
        tipo: 'saida',
        motivo: motivo,
        created_at: new Date().toISOString()
      }]);

    console.log(`[Estoque] Estoque do produto ${prodId} (variante: ${key}) reduzido em ${quantidade}. Novo saldo: ${estoque[key]}`);
  } catch (e) {
    console.error(`[Estoque] Erro ao reduzir estoque para ${prodId}:`, e);
  }
}
app.use('/api', (err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('API Error:', err);
    res.status(err.status || 500).json({
      error: err.message || 'Internal Server Error',
      details: err.stack
    });
  });

// --- DYNAMIC SEO / SSR ROUTES ---
const getBaseIndexHtml = async () => {
  try {
    return fs.readFileSync(path.join(currentDirname, "dist", "index.html"), "utf-8");
  } catch (e) {
    try {
      return fs.readFileSync(path.join(currentDirname, "index.html"), "utf-8");
    } catch (err) {
      const url = process.env.APP_URL || 'https://www.sportforkids.com.br';
      try {
        const res = await axios.get(url);
        return res.data;
      } catch (netErr) {
        return "";
      }
    }
  }
};

const replaceOgTags = (html: string, title: string, description: string, image: string) => {
  let newHtml = html;
  newHtml = newHtml.replace(/<title>.*?<\/title>/, `<title>${title}</title>`);
  newHtml = newHtml.replace(/<meta property="og:title" content="[^"]*" \/>/, `<meta property="og:title" content="${title}" />`);
  newHtml = newHtml.replace(/<meta property="og:description" content="[^"]*" \/>/, `<meta property="og:description" content="${description}" />`);
  newHtml = newHtml.replace(/<meta property="og:image" content="[^"]*" \/>/, `<meta property="og:image" content="${image}" />`);
  newHtml = newHtml.replace(/<meta name="twitter:title" content="[^"]*" \/>/, `<meta name="twitter:title" content="${title}" />`);
  newHtml = newHtml.replace(/<meta name="twitter:description" content="[^"]*" \/>/, `<meta name="twitter:description" content="${description}" />`);
  newHtml = newHtml.replace(/<meta name="twitter:image" content="[^"]*" \/>/, `<meta name="twitter:image" content="${image}" />`);
  return newHtml;
};

app.get('/loja/produto/:slug', async (req, res, next) => {
  if (req.path.includes('.')) return next();
  try {
    const { slug } = req.params;
    const { data: produto } = await supabase.from('loja_produtos').select('*').eq('slug', slug).single();
    
    let html = await getBaseIndexHtml();
    if (produto && html) {
      const title = `${produto.nome} — Loja Sport for Kids`;
      const description = produto.descricao ? produto.descricao.replace(/"/g, '&quot;').substring(0, 160) : "Confira este produto na loja oficial da Sport for Kids.";
      const image = produto.imagens && produto.imagens.length > 0 ? produto.imagens[0] : 'https://www.sportforkids.com.br/sfk-og-logo.png';
      html = replaceOgTags(html, title, description, image);
      return res.send(html);
    }
  } catch (err) {
    console.error('Erro SSR Produto:', err);
  }
  next();
});

app.get('/eventos/:slug', async (req, res, next) => {
  if (req.path.includes('.')) return next();
  try {
    const { slug } = req.params;
    const { data: evento } = await supabase.from('eventos').select('*').eq('slug', slug).single();
    
    let html = await getBaseIndexHtml();
    if (evento && html) {
      const title = `${evento.titulo} — Sport for Kids`;
      const description = evento.descricao ? evento.descricao.replace(/"/g, '&quot;').substring(0, 160) : "Participe deste evento da Sport for Kids.";
      const image = evento.imagem_capa || evento.imagem_banner || 'https://www.sportforkids.com.br/sfk-og-logo.png';
      html = replaceOgTags(html, title, description, image);
      return res.send(html);
    }
  } catch (err) {
    console.error('Erro SSR Evento:', err);
  }
  next();
});

app.get('/portal/:unidadeSlug/turma/:turmaId', async (req, res, next) => {
  if (req.path.includes('.')) return next();
  try {
    const { unidadeSlug, turmaId } = req.params;
    const { data: turma } = await supabase.from('turmas').select('*, unidades(nome)').eq('id', turmaId).single();
    
    let html = await getBaseIndexHtml();
    if (turma && html) {
      const unidadeNome = (turma as any).unidades?.nome || 'nossa unidade';
      const title = `${turma.nome} — ${unidadeNome}`;
      
      let description = `Turma aberta para ${Array.isArray(turma.series_permitidas) ? turma.series_permitidas.join(', ') : turma.series_permitidas}. `;
      if (turma.dias_horarios) description += `Aulas: ${turma.dias_horarios}. `;
      description += "Agende uma aula experimental gratuita ou matricule-se online!";
      
      const image = turma.imagem_url || 'https://www.sportforkids.com.br/sfk-og-logo.png';
      
      html = replaceOgTags(html, title, description, image);
      return res.send(html);
    }
  } catch (err) {
    console.error('Erro SSR Turma:', err);
  }
  next();
});
  // --- FLUXO DE MATRÍCULA PRESENCIAL (CHECKOUT MANUAL) ---


  app.post("/api/checkout-manual", async (req, res) => {
    const { matriculaId, card, customer } = req.body;
    try {
      const { data: matricula } = await supabase
        .from('matriculas')
        .select('*, alunos(*)')
        .eq('id', matriculaId)
        .maybeSingle();

      if (!matricula) throw new Error("Matrícula não encontrada");
      if (matricula.status === 'ativo' || matricula.status === 'Ativo') {
        throw new Error("Esta matrícula já está ativa e paga.");
      }

      const aluno = Array.isArray(matricula.alunos) ? matricula.alunos[0] : matricula.alunos;
      const { data: classData } = await supabase
        .from('turmas')
        .select('id, valor_mensalidade, precos_unidade')
        .eq('id', matricula.turma_id)
        .maybeSingle();
      
      let valorCobrado = classData?.precos_unidade?.[matricula.unidade] ?? (classData?.valor_mensalidade || 0);

      if (matricula.valor_desconto) {
        valorCobrado -= Number(matricula.valor_desconto);
      }
      if (matricula.tem_fidelidade) {
        valorCobrado = valorCobrado * 0.9;
      }
      if (valorCobrado < 0) valorCobrado = 0;

      let firstPaymentId = null;
      if (aluno && aluno.responsavel_id) {
        const { data: newPayment } = await supabase.from('pagamentos').insert([{
          matricula_id: matriculaId,
          aluno_id: matricula.aluno_id,
          responsavel_id: aluno.responsavel_id,
          valor: valorCobrado,
          status: 'pendente',
          metodo_pagamento: 'cartão',
          data_vencimento: new Date().toISOString()
        }]).select().single();
        firstPaymentId = newPayment?.id;
      }

      const clientIp = (req.headers['x-forwarded-for'] as string || req.socket.remoteAddress || '').split(',')[0].trim();
      
      const subscription = await createPagarmeSubscription({
        customer: {
          name: customer.name,
          email: customer.email || aluno?.email || 'contato@sportforkids.com.br',
          cpf: customer.cpf,
          phone: customer.phone || aluno?.whatsapp_1 || '',
          address: customer.address
        },
        card: card,
        amount: Math.round(valorCobrado * 100),
        paymentMethod: 'credit_card',
        description: `Mensalidade ${matricula.turma}`,
        code: firstPaymentId ? `${firstPaymentId}_${Date.now()}` : matriculaId,
        softDescriptor: 'SportForKids',
        ip: clientIp,
        franquia: matricula.unidade
      });

      if (!subscription || subscription.status === 'failed' || subscription.status === 'canceled') {
        throw new Error("O pagamento foi recusado pelo banco. Verifique os dados do cartão.");
      }

      if (firstPaymentId) {
        await supabase.from('pagamentos').update({ pagarme: subscription.id }).eq('id', firstPaymentId);
      }

      await supabase.from('matriculas').update({ 
        pagarme_subscription_id: subscription.id,
        plano: 'Mensal'
      }).eq('id', matriculaId);

      // Register coupon usage if a coupon was used
      if (matricula.cupom_id) {
        await supabase.from('cupons_usos').insert([{
          cupom_id: matricula.cupom_id,
          matricula_id: matriculaId,
          aluno_id: matricula.aluno_id
        }]);

        // Increment coupon usage count
        const { data: cupomDb } = await supabase
          .from('cupons')
          .select('quantidade_usos')
          .eq('id', matricula.cupom_id)
          .single();
          
        if (cupomDb) {
          await supabase.from('cupons').update({
            quantidade_usos: (cupomDb.quantidade_usos || 0) + 1
          }).eq('id', matricula.cupom_id);
        }
      }

      res.json({ success: true, subscriptionId: subscription.id });
    } catch (err: any) {
      console.error("[Checkout Manual] Erro:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/checkout-manual/:id", async (req, res) => {
    try {
      const { data: matricula } = await supabase
        .from('matriculas')
        .select('*, alunos(*)')
        .eq('id', req.params.id)
        .maybeSingle();
      if (!matricula) return res.status(404).json({ error: 'Not found' });

      const { data: classData } = await supabase
        .from('turmas')
        .select('valor_mensalidade, precos_unidade')
        .eq('id', matricula.turma_id)
        .maybeSingle();
      
      let valorCobrado = classData?.precos_unidade?.[matricula.unidade] ?? (classData?.valor_mensalidade || 0);

      if (matricula.valor_desconto) {
        valorCobrado -= Number(matricula.valor_desconto);
      }
      if (matricula.tem_fidelidade) {
        valorCobrado = valorCobrado * 0.9;
      }
      if (valorCobrado < 0) valorCobrado = 0;

      res.json({ matricula, valor: valorCobrado, valorBase: classData?.precos_unidade?.[matricula.unidade] ?? (classData?.valor_mensalidade || 0) });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  
  // --- INÍCIO: FLUXO DE EXCEÇÃO PIX ---
  app.post("/api/admin/enroll-pix-existing", async (req, res) => {
    try {
      const { adminId, guardianId, studentId, turmaId, unidade, valor_mensal, dia_vencimento, motivo_excecao, cupom_id } = req.body;
      
      const { data: guardian } = await supabase.from('responsaveis').select('*').eq('id', guardianId).single();
      const { data: student } = await supabase.from('alunos').select('*').eq('id', studentId).single();
      const { data: turma } = await supabase.from('turmas').select('*').eq('id', turmaId).single();

      if (!guardian || !student || !turma) throw new Error("Dados não encontrados.");

      const mockPaymentId = `pix_exc_${Date.now()}`;
      let nextBillingDate = new Date();
      if (dia_vencimento) {
        nextBillingDate.setDate(Number(dia_vencimento));
        if (nextBillingDate <= new Date()) {
           nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);
        }
      }

      const subscription = await createPagarmeSubscription({
        customer: {
          name: guardian.nome_completo,
          email: guardian.email || "contato@sportforkids.com.br",
          cpf: guardian.cpf,
          phone: guardian.telefone || "11999999999"
        },
        paymentMethod: 'pix',
        amount: Math.round(Number(valor_mensal) * 100),
        description: `Mensalidade Exceção PIX - ${student.nome_completo} (${turma.nome})`,
        code: mockPaymentId,
        cycles: 12,
        start_at: new Date().toISOString() // Start today so first invoice generates immediately
      });

      const { data: matricula, error: matError } = await supabase.from('matriculas').insert([{
        aluno_id: studentId,
        unidade,
        turma: turma.nome,
        turma_id: turma.id,
        status: 'pendente',
        plano: 'Mensal',
        pagarme_subscription_id: subscription.id,
        motivo_excecao_pix: motivo_excecao,
        criado_por_admin_id: adminId,
        tipo_pagamento: 'pix_excecao',
        cupom_id: cupom_id || null
      }]).select().single();

      if (matError) throw matError;

      // Create initial payment record
      await supabase.from('pagamentos').insert([{
        responsavel_id: guardianId,
        matricula_id: matricula.id,
        valor: Number(valor_mensal),
        status: 'pendente',
        metodo_pagamento: 'pix',
        pagarme: subscription.id,
        data_vencimento: new Date().toISOString()
      }]);

      res.json({ success: true, matricula });
    } catch (err: any) {
      console.error("[PIX Excecao] Erro:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/admin/enroll-pix-new", async (req, res) => {
    try {
      const { adminId, guardian, student, turmaId, unidade, valor_mensal, dia_vencimento, motivo_excecao, cupom_id } = req.body;
      
      const cleanCPF = sanitizeCPF(guardian.cpf);
      
      // 1. Create Guardian
      const { data: newGuardian, error: gError } = await supabase.from('responsaveis').insert([{
        nome_completo: guardian.name,
        cpf: cleanCPF,
        email: guardian.email,
        telefone: guardian.phone,
        endereco: guardian.address
      }]).select().single();
      
      if (gError) throw gError;

      // 2. Create Student
      const { data: newStudent, error: sError } = await supabase.from('alunos').insert([{
        nome_completo: student.name,
        data_nascimento: student.birthdate,
        responsavel_id: newGuardian.id
      }]).select().single();

      if (sError) throw sError;

      const { data: turma } = await supabase.from('turmas').select('*').eq('id', turmaId).single();

      const mockPaymentId = `pix_exc_${Date.now()}`;

      const subscription = await createPagarmeSubscription({
        customer: {
          name: newGuardian.nome_completo,
          email: newGuardian.email || "contato@sportforkids.com.br",
          cpf: newGuardian.cpf,
          phone: newGuardian.telefone || "11999999999"
        },
        paymentMethod: 'pix',
        amount: Math.round(Number(valor_mensal) * 100),
        description: `Mensalidade Exceção PIX - ${newStudent.nome_completo} (${turma.nome})`,
        code: mockPaymentId,
        cycles: 12,
        start_at: new Date().toISOString()
      });

      const { data: matricula, error: matError } = await supabase.from('matriculas').insert([{
        aluno_id: newStudent.id,
        unidade,
        turma: turma.nome,
        turma_id: turma.id,
        status: 'pendente',
        plano: 'Mensal',
        pagarme_subscription_id: subscription.id,
        motivo_excecao_pix: motivo_excecao,
        criado_por_admin_id: adminId,
        tipo_pagamento: 'pix_excecao',
        cupom_id: cupom_id || null
      }]).select().single();

      if (matError) throw matError;

      await supabase.from('pagamentos').insert([{
        responsavel_id: newGuardian.id,
        matricula_id: matricula.id,
        valor: Number(valor_mensal),
        status: 'pendente',
        metodo_pagamento: 'pix',
        pagarme: subscription.id,
        data_vencimento: new Date().toISOString()
      }]);

      res.json({ success: true, matricula });
    } catch (err: any) {
      console.error("[PIX Excecao Novo] Erro:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/admin/resend-pix", async (req, res) => {
    try {
      const { paymentId } = req.body;
      
      const { data: payment } = await supabase.from('pagamentos').select('*, responsaveis(*), matriculas(*)').eq('id', paymentId).single();
      if (!payment) throw new Error("Pagamento não encontrado.");
      
      const guardian = payment.responsaveis;
      
      const orderCode = `retry_pix_${Date.now()}`;
      const orderPayload = {
        code: orderCode,
        items: [{
          amount: Math.round(payment.valor * 100),
          description: `Reenvio Mensalidade PIX`,
          quantity: 1,
          code: orderCode
        }],
        customer: {
          name: guardian.nome_completo,
          email: guardian.email || 'contato@sportforkids.com.br',
          type: 'individual',
          document: guardian.cpf.replace(/\D/g, '').padStart(11, '0'),
          phones: {
            mobile_phone: {
              country_code: "55",
              area_code: guardian.telefone ? guardian.telefone.replace(/\D/g, '').substring(0, 2) : "11",
              number: guardian.telefone ? guardian.telefone.replace(/\D/g, '').substring(2) : "999999999"
            }
          }
        },
        metadata: { payment_id: payment.id },
        payments: [{
          payment_method: 'pix',
          pix: { expires_in: 86400 }
        }]
      };

      let secretKey = getPagarmeSecretKey();
      const authHeader = Buffer.from(`${secretKey}:`).toString('base64');
      const { data: orderData } = await axios.post('https://api.pagar.me/core/v5/orders', orderPayload, {
        headers: { 'Authorization': `Basic ${authHeader}`, 'Content-Type': 'application/json' }
      });

      const qrCode = orderData.charges?.[0]?.last_transaction?.qr_code || orderData.charges?.[0]?.last_transaction?.pix_qr_code || orderData.qr_code;
      const qrCodeUrl = orderData.charges?.[0]?.last_transaction?.qr_code_url || orderData.charges?.[0]?.last_transaction?.pix_qr_code_url || orderData.qr_code_url;

      if (qrCode) {
        const msg = `Olá, *${guardian.nome_completo}*! Segue a nova cobrança da mensalidade.\n\nVocê pode pagar via PIX utilizando o QR Code abaixo:\n\n${qrCodeUrl}\n\nOu copie e cole o código:\n\n${qrCode}`;
        await sendWhatsAppMessage(guardian.telefone, guardian.nome_completo, msg);
        
        // Update payment with new qr codes
        await supabase.from('pagamentos').update({ 
          qr_code: qrCode, 
          qr_code_url: qrCodeUrl,
          status: 'pendente' 
        }).eq('id', payment.id);
      }

      res.json({ success: true, orderData });
    } catch (err: any) {
      console.error("[PIX Excecao Resend] Erro:", err.response?.data || err.message);
      res.status(500).json({ error: err.message });
    }
  });
  // Vite middleware for development
  async function startServer() {
    const PORT = 3000;
    if (process.env.NODE_ENV !== "production") {
      const { createServer: createViteServer } = await import("vite");
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa",
      });
      app.use(vite.middlewares);
    } else {
      app.use(express.static(path.join(currentDirname, "dist")));
      app.get("*", (req, res) => {
        res.sendFile(path.join(currentDirname, "dist", "index.html"));
      });
    }



    app.listen(Number(PORT), "0.0.0.0", () => {
      console.log(`Server running on http://localhost:${PORT}`);
      
      // Configurar Cron Job para sincronização automática a cada hora
      // '0 * * * *' = No minuto 0 de cada hora
      cron.schedule('0 * * * *', () => {
        syncAllPendingPayments().catch(err => console.error('[Cron] Erro ao executar syncAllPendingPayments:', err));
        syncWixRecurringPayments().catch(err => console.error('[Cron] Erro ao executar syncWixRecurringPayments:', err));
        syncPagarmeRecurringPayments().catch(err => console.error('[Cron] Erro ao executar syncPagarmeRecurringPayments:', err));
      });
      
      console.log('[Cron] Job de sincronização financeira agendado (1x por hora).');
    });
  }

  if (process.env.VERCEL !== "1") {
    startServer();
  }

export default app;
