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

// Handle __dirname and __filename for both ESM and CJS environments
const currentDirname = process.cwd();

dotenv.config();

// Initialize local SQLite for settings (Deprecated, moving to Supabase)
// const localDb = new Database("settings.db");
// localDb.exec("CREATE TABLE IF NOT EXISTS configuracoes (chave TEXT PRIMARY KEY, valor TEXT)");

const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || "";
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

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

const checkTable = async (tableName: string) => {
  try {
    const { error } = await supabase.from(tableName).select('id').limit(1);
    if (error && (error.code === '42P01' || error.message?.includes('does not exist'))) {
      return { exists: false, error: error.message };
    }
    return { exists: true, error: error?.message };
  } catch (err: any) {
    return { exists: false, error: err.message };
  }
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
  senderName: string = "Sport for Kids",
  senderEmail: string = "adm@sportforkids.com.br"
) {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) {
    console.warn("BREVO_API_KEY not configured. Skipping email.");
    return;
  }

  try {
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'api-key': apiKey,
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        sender: { name: senderName, email: senderEmail },
        to: [{ email: toEmail, name: toName }],
        subject: subject,
        htmlContent: htmlContent,
        attachment: attachments
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Brevo API error: ${JSON.stringify(errorData)}`);
    }

    console.log(`Email sent successfully to ${toEmail} via Brevo`);
  } catch (error) {
    console.error("Error sending email via Brevo:", error);
  }
}

async function sendWhatsAppMessage(toPhone: string, contactName: string, message: string) {
  if (!toPhone) {
    console.error("Cannot send WhatsApp message: toPhone is empty");
    return;
  }
  const utalkToken = process.env.UTALK_TOKEN || "sfk-api-token-2026-03-12-2094-03-30--47482FB3C78CF7D176AB52761A3374A558374940DE977AD9EB7F5EE12163C662";
  const utalkFrom = process.env.UTALK_FROM_PHONE || "+557130457777";
  const utalkOrgId = process.env.UTALK_ORGANIZATION_ID || "aZhaeS9bnyeDpiMs";
  const utalkUrl = process.env.UTALK_URL || "https://app-utalk.umbler.com/api/v1/messages/simplified/";

  // Clean phone number (remove non-digits, ensure it starts with +55)
  let phone = toPhone.replace(/\D/g, '');
  
  if (!phone) {
    console.error(`Cannot send WhatsApp message: phone is empty after cleaning (original: ${toPhone})`);
    return;
  }

  // Remove leading zero if present
  if (phone.startsWith('0')) {
    phone = phone.substring(1);
  }

  // Add country code 55 if missing (assuming Brazil)
  if (phone.length === 11 || phone.length === 10) {
    phone = '55' + phone;
  }
  
  // Ensure it starts with + for E.164 format
  if (!phone.startsWith('+')) {
    phone = '+' + phone;
  }

  console.log(`Sending WhatsApp message to ${phone} (original: ${toPhone})`);

  try {
    const response = await fetch(utalkUrl, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${utalkToken}`
      },
      body: JSON.stringify({
        toPhone: phone,
        fromPhone: utalkFrom,
        organizationId: utalkOrgId,
        message: message,
        contactName: contactName
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error("UTalk API Error Details:", JSON.stringify(errorData, null, 2));
      
      let errorMessage = "Falha ao enviar mensagem via WhatsApp";
      if (errorData.errors) {
        const details = Object.entries(errorData.errors)
          .map(([field, msgs]) => {
            const msgStr = Array.isArray(msgs) ? msgs.join(', ') : String(msgs);
            return `${field}: ${msgStr}`;
          })
          .join('; ');
        errorMessage += ` (${details})`;
      } else if (errorData.message) {
        errorMessage = errorData.message;
      }
      throw new Error(errorMessage);
    }

    console.log(`WhatsApp message sent successfully to ${phone} via UTalk`);
  } catch (error) {
    console.error("Error sending WhatsApp message:", error);
    throw error;
  }
}

async function sendPaymentFailureNotification(guardianId: string, studentName: string, className: string, reason: string) {
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

    const subject = "Falha no Pagamento da Matrícula - Sport for Kids";
    const message = `
Olá ${guardian.nome_completo},

Infelizmente, o pagamento da matrícula de ${studentName} na turma ${className} não pôde ser processado.

Motivo: ${reason}

Sua matrícula não foi confirmada. Por favor, acesse o portal para revisar os dados de pagamento ou tente realizar a matrícula novamente.

Se precisar de ajuda, entre em contato conosco.
    `;

    const htmlContent = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
        <h2 style="color: #e11d48;">Falha no Pagamento da Matrícula</h2>
        <p>Olá <strong>${guardian.nome_completo}</strong>,</p>
        <p>Infelizmente, o pagamento da matrícula de <strong>${studentName}</strong> na turma <strong>${className}</strong> não pôde ser processado.</p>
        <div style="background-color: #fff1f2; border-left: 4px solid #e11d48; padding: 10px; margin: 20px 0;">
          <p style="margin: 0;"><strong>Motivo:</strong> ${reason}</p>
        </div>
        <p>Sua matrícula <strong>não foi confirmada</strong>. Por favor, acesse o portal para revisar os dados de pagamento ou tente realizar a matrícula novamente.</p>
        <p>Se precisar de ajuda, entre em contato conosco.</p>
        <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
        <p style="font-size: 12px; color: #64748b; text-align: center;">Sport for Kids - Transformando vidas através do esporte</p>
      </div>
    `;

    // Enviar E-mail via Brevo
    if (guardian.email) {
      await sendBrevoEmail(guardian.email, guardian.nome_completo, subject, htmlContent);
    }

    // Enviar WhatsApp via UTalk
    if (guardian.telefone) {
      await sendWhatsAppMessage(guardian.telefone, guardian.nome_completo, message).catch(e => console.error("Erro ao enviar WhatsApp de falha:", e));
    }
    
  } catch (error) {
    console.error("[Notificação] Erro crítico ao enviar notificação:", error);
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
  };
  amount: number; // in cents
  paymentMethod: 'pix' | 'credit_card';
  description: string;
  code: string; // Reference ID for webhook
  softDescriptor?: string;
  ip?: string;
}) {
  const secretKey = getPagarmeSecretKey();
  
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
    cleanName = `${cleanName} Silva`; 
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
        code: data.code
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
          installments: 1,
          statement_descriptor: (data.softDescriptor || "SportForKids").substring(0, 13),
          card: {
            number: data.card?.number?.replace(/\D/g, ''),
            holder_name: data.card?.holderName?.substring(0, 64),
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
  card: {
    number: string;
    holderName: string;
    expMonth: string;
    expYear: string;
    cvv: string;
  };
  amount: number; // in cents
  description: string;
  code: string; // Reference ID for webhook
  cycles?: number;
  start_at?: string; // ISO date string
  softDescriptor?: string;
  ip?: string;
}) {
  const secretKey = getPagarmeSecretKey();
  
  if (!secretKey) {
    throw new Error("PAGARME_SECRET_KEY não configurada nas variáveis de ambiente (Menu Settings).");
  }

  if (secretKey.startsWith('pk_')) {
    throw new Error("PAGARME_SECRET_KEY parece ser uma Chave Pública (pk_). Para criar assinaturas, você deve usar a Chave Secreta (sk_).");
  }

  // Sanitização e Validação de Dados para Pagar.me
  const cleanCPF = data.customer.cpf.replace(/\D/g, '');
  const cleanPhone = data.customer.phone.replace(/\D/g, '');
  
  let cleanName = data.customer.name.trim();
  if (!cleanName.includes(' ')) {
    cleanName = `${cleanName} Silva`; 
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

  const payload: any = {
    code: data.code,
    payment_method: "credit_card",
    interval: "month",
    interval_count: 1,
    billing_type: "prepaid",
    installments: 1,
    statement_descriptor: (data.softDescriptor || "SportForKids").substring(0, 13),
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
    card: {
      number: data.card.number.replace(/\D/g, ''),
      holder_name: data.card.holderName.substring(0, 64),
      exp_month: parseInt(data.card.expMonth, 10),
      exp_year: parseInt(data.card.expYear.length === 2 ? `20${data.card.expYear}` : data.card.expYear, 10),
      cvv: data.card.cvv,
      billing_address: billingAddress
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
        }
      }
    ]
  };

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
    
    throw error;
  }
}

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// API Routes
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
        const cleanCPF = identifier.replace(/\D/g, '');
        query = query.eq('cpf', cleanCPF);
      }

      const { data: guardian, error: gError } = await query.maybeSingle();

      if (gError) throw gError;
      
      if (!guardian) {
        return res.status(404).json({ error: "Responsável não encontrado" });
      }

      // Verify password if provided
      if (password && guardian.senha && guardian.senha !== password) {
        return res.status(401).json({ error: "Senha incorreta" });
      }

      // If password is required but not provided
      if (!password && guardian.senha) {
        return res.status(401).json({ error: "Senha é obrigatória", passwordRequired: true });
      }

      // If found by email but CPF is missing or temporary, OR if password is not set yet
      const isTemporaryCpf = guardian.cpf && guardian.cpf.startsWith('IMP');
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
            cpf: isTemporaryCpf ? guardian.cpf : (guardian.cpf || '')
          }
        });
      }

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
        .from('turmas_complementares')
        .select('nome, dias_horarios');

      if (tError) {
        console.warn("Error fetching turmas_complementares:", tError);
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
      
      const hasActiveEnrollments = flatAlunos.some(a => a.status === 'ativo');

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

      const cleanCPF = cpf.replace(/\D/g, '');
      
      // Check if CPF already exists for another user
      const { data: existing, error: checkError } = await supabase
        .from('responsaveis')
        .select('id')
        .eq('cpf', cleanCPF)
        .neq('id', id)
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
          senha: password
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
          .eq('status', 'ativo')
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
      const { data: guardian, error: gError } = await supabase
        .from('responsaveis')
        .select('*')
        .eq('cpf', cpf)
        .eq('senha', password)
        .maybeSingle();

      if (gError) throw gError;
      
      if (guardian) {
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
          .from('turmas_complementares')
          .select('nome, dias_horarios');

        if (tError) {
          console.warn("Error fetching turmas_complementares:", tError);
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
        
        const hasActiveEnrollments = flatAlunos.some(a => a.status === 'ativo');

        res.json({
          ...data,
          alunos: flatAlunos,
          hasActiveEnrollments
        });
      } else {
        res.status(401).json({ error: "Senha incorreta" });
      }
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
      const { data, error } = await supabase
        .from('responsaveis')
        .insert([{
          nome_completo: name,
          cpf: cpf,
          email: email,
          telefone: phone,
          endereco: address,
          senha: password
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
      let query = supabase.from('responsaveis').select('nome_completo, telefone, senha');
      
      if (identifier) {
        const isEmail = identifier.includes('@');
        if (isEmail) {
          query = query.eq('email', identifier.trim().toLowerCase());
        } else {
          const cleanCPF = identifier.replace(/\D/g, '');
          query = query.eq('cpf', cleanCPF);
        }
      } else if (cpf) {
        query = query.eq('cpf', cpf);
      } else {
        return res.status(400).json({ error: "CPF ou Identificador é obrigatório" });
      }

      const { data, error } = await query.maybeSingle();

      if (error) throw error;
      
      if (!data) {
        return res.status(404).json({ error: "Responsável não encontrado" });
      }

      if (!data.telefone) {
        return res.status(400).json({ error: "Telefone não cadastrado para este responsável. Entre em contato com o suporte." });
      }

      await sendWhatsAppMessage(
        data.telefone,
        data.nome_completo,
        `Olá *${data.nome_completo}*, sua senha de acesso ao *Sport for Kids* é: ${data.senha}`
      );

      res.json({ success: true, message: "Senha enviada para o WhatsApp cadastrado" });
    } catch (error: any) {
      console.error("Error recovering password:", error);
      res.status(500).json({ error: error.message || "Erro interno no servidor" });
    }
  });

  app.post("/api/guardian/update", async (req, res) => {
    const { cpf, name, email, phone, address, password } = req.body;
    try {
      const updateData: any = {
        nome_completo: name,
        email: email,
        telefone: phone,
        endereco: address
      };
      
      if (password) {
        updateData.senha = password;
      }

      const { data, error } = await supabase
        .from('responsaveis')
        .update(updateData)
        .eq('cpf', cpf)
        .select()
        .single();

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
        .select('pagarme_subscription_id')
        .eq('id', enrollmentId)
        .single();

      if (matError || !matData?.pagarme_subscription_id) {
        return res.status(404).json({ error: "Assinatura não encontrada para esta matrícula." });
      }

      const secretKey = (process.env.PAGARME_SECRET_KEY || "").trim();
      if (!secretKey) throw new Error("PAGARME_SECRET_KEY não configurada.");

      const authHeader = `Basic ${Buffer.from(`${secretKey}:`).toString('base64')}`;

      // Update card in Pagar.me subscription
      await axios.patch(`https://api.pagar.me/core/v5/subscriptions/${matData.pagarme_subscription_id}/card`, {
        card: {
          number: card.number.replace(/\s/g, ''),
          holder_name: card.holder_name,
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
          .from('turmas_complementares')
          .select('valor_mensalidade')
          .eq('id', mat.turma_id)
          .maybeSingle();
        valorSistema = classData?.valor_mensalidade || 0;
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
          .from('turmas_complementares')
          .select('id, valor_mensalidade')
          .eq('nome', student.turmaComplementar)
          .maybeSingle();
        
        if (classError) {
          console.warn("Error fetching class data:", classError);
        }
        valorCobrado = classData?.valor_mensalidade || 0;
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
      
      const { data: existingGuardian, error: findError } = await supabase
        .from('responsaveis')
        .select('id')
        .eq('cpf', guardian.cpf)
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
            cpf: guardian.cpf,
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
        .eq('status', 'ativo')
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
            whatsapp_2: student.whatsapp2
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
            whatsapp_2: student.whatsapp2
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
          .eq('status', 'ativo')
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
          .eq('nome', unidadeNome)
          .gte('fim_aulas', todayStr)
          .order('inicio_aulas', { ascending: true });
        
        if (mappingError) {
          console.warn("Error fetching mapping with 'nome':", mappingError.message);
          // Fallback para 'nome_unidade'
          const { data: fallbackMappings } = await supabase
            .from('unidades_mapping')
            .select('inicio_aulas, fim_aulas, identidade, ano_letivo')
            .eq('nome_unidade', unidadeNome)
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

        let nextVencimento = new Date(today);
        
        // If today is before classes start, we start counting from the start month
        if (nextVencimento < inicioAulas) {
          nextVencimento = new Date(inicioAulas);
        }

        // Move to the next month for the first monthly installment
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
          nextVencimento.setMonth(nextVencimento.getMonth() + 1);
          nextVencimento.setDate(baseDay);
          
          // Handle month overflow
          if (nextVencimento.getDate() !== baseDay) {
            nextVencimento.setDate(0);
          }
        }
      }

      let firstPaymentId = null;

      const { data: pData, error: pError } = await supabase
        .from('pagamentos')
        .insert(installments)
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

          const retryInstallments = installments.map(inst => {
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
              const aggressiveCleanup = installments.map(inst => ({
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
          if (paymentMethod === 'pix') {
            console.log(`[Pagar.me] Criando pedido PIX para ${guardian.name}, valor: ${valorCobrado}`);
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
              code: firstPaymentId ? `${firstPaymentId}_${Date.now()}` : `enroll_pix_${Date.now()}`,
              softDescriptor,
              ip: clientIp
            });
            paymentInfo = order;
            console.log("Pagar.me PIX order created successfully:", order.id);
            
            // Salva o ID do pedido no primeiro pagamento
            if (order && order.id && firstPaymentId) {
              await supabase
                .from('pagamentos')
                .update({ pagarme: order.id })
                .eq('id', firstPaymentId);
            }
          } else if (paymentMethod === 'credit_card' && req.body.card) {
            const today = new Date();
            const isBeforeStart = inicioAulas && today < inicioAulas;
            
            if (isBeforeStart && installments.length > 1) {
              console.log(`[Pagar.me] Matrícula antecipada detectada. Cobrando matrícula hoje e agendando assinatura para ${installments[1].data_vencimento}`);
              
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
                paymentMethod: 'credit_card',
                description: `Matrícula - ${student.name} (${student.turmaComplementar})`,
                code: firstPaymentId ? `${firstPaymentId}_${Date.now()}` : `enroll_${Date.now()}`,
                softDescriptor,
                ip: clientIp
              });
              
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
                amount: Math.round(valorCobrado * 100),
                description: `Mensalidade - ${student.name} (${student.turmaComplementar})`,
                code: firstPaymentId ? `${firstPaymentId}_sub_${Date.now()}` : `sub_${Date.now()}`,
                cycles: installments.length - 1,
                start_at: new Date(installments[1].data_vencimento + "T12:00:00Z").toISOString(),
                softDescriptor,
                ip: clientIp
              });
              
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
            } else {
              // Fluxo padrão: Assinatura começa hoje
              console.log(`Creating Pagar.me subscription for ${guardian.name}, amount: ${valorCobrado}`);
              const subscription = await createPagarmeSubscription({
                customer: {
                  name: guardian.name,
                  email: guardian.email,
                  cpf: guardian.cpf,
                  phone: guardian.phone,
                  address: guardian.address
                },
                card: req.body.card,
                amount: Math.round(valorCobrado * 100), // convert to cents
                description: `Mensalidade - ${student.name} (${student.turmaComplementar})`,
                code: firstPaymentId ? `${firstPaymentId}_${Date.now()}` : `enroll_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
                cycles: installments.length,
                softDescriptor,
                ip: clientIp
              });
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
            failureReason
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

  app.get("/api/options", async (req, res) => {
    try {
      const [series, unidades, turmas, matriculas] = await Promise.all([
        supabase.from('series_anos').select('nome').order('ordem'),
        supabase.from('unidades').select('nome').order('nome'),
        supabase.from('turmas_complementares').select('*').order('nome'),
        supabase.from('matriculas').select('turma, unidade').eq('status', 'ativo')
      ]);

      if (turmas.error) console.error("Error fetching turmas:", turmas.error);
      console.log(`Fetched ${turmas.data?.length || 0} turmas from turmas_complementares`);
      if (turmas.data && turmas.data.length > 0) {
        console.log("Sample turma:", turmas.data[0]);
      }

      // Count active enrollments per class and unit
      const occupancyMap: { [key: string]: number } = {};
      matriculas.data?.forEach(m => {
        if (m.turma && m.unidade) {
          const key = `${m.unidade}|${m.turma}`;
          occupancyMap[key] = (occupancyMap[key] || 0) + 1;
        }
      });

      res.json({
        series: series.data?.map(s => s.nome) || [],
        unidades: unidades.data?.map(u => u.nome) || [],
        turmas: turmas.data?.filter(t => 
          !['Voleibol 4', 'Voleibol 5', 'Voleibol 6', 'Ginástica Rítmica 3', 'Jazz Dance 2'].includes(t.nome)
        ).map(t => ({
          ...t,
          ocupacao_atual: occupancyMap[`${t.unidade_nome}|${t.nome}`] || 0
        })) || []
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/options/:type", async (req, res) => {
    const { type } = req.params;
    const { 
      nome, 
      ordem, 
      unidade_nome, 
      series_permitidas,
      idade_minima,
      idade_maxima,
      dias_horarios,
      valor_mensalidade,
      capacidade,
      local_aula,
      data_inicio,
      professor,
      status
    } = req.body;

    let table = '';
    if (type === 'series') table = 'series_anos';
    else if (type === 'unidades') table = 'unidades';
    else if (type === 'turmas') table = 'turmas_complementares';
    else return res.status(400).json({ error: 'Invalid type' });

    try {
      const { data, error } = await supabase
        .from(table)
        .insert([{ 
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
          ...(status !== undefined ? { status } : {})
        }])
        .select();

      if (error) throw error;
      res.json(data[0]);
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
      series_permitidas,
      idade_minima,
      idade_maxima,
      dias_horarios,
      valor_mensalidade,
      capacidade,
      local_aula,
      data_inicio,
      professor,
      status
    } = req.body;

    let table = '';
    if (type === 'series') table = 'series_anos';
    else if (type === 'unidades') table = 'unidades';
    else if (type === 'turmas') table = 'turmas_complementares';
    else return res.status(400).json({ error: 'Invalid type' });

    try {
      const { data, error } = await supabase
        .from(table)
        .update({ 
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
          ...(status !== undefined ? { status } : {})
        })
        .eq('nome', decodeURIComponent(oldNome))
        .select();

      if (error) throw error;
      res.json(data[0]);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/options/:type/:nome", async (req, res) => {
    const { type, nome } = req.params;

    let table = '';
    if (type === 'series') table = 'series_anos';
    else if (type === 'unidades') table = 'unidades';
    else if (type === 'turmas') table = 'turmas_complementares';
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

  app.get("/api/test-alunos", async (req, res) => {
    const { data, error } = await supabase.from('alunos').select('*').limit(1);
    res.json(data);
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

      const today = new Date().toISOString().split('T')[0];
      if (cancellationDate < today) {
        return res.status(400).json({ error: "A data de cancelamento não pode ser anterior à data de hoje." });
      }

      const updateData: any = {
        data_cancelamento: cancellationDate,
        status: 'cancelado'
      };

      if (justificativa) {
        updateData.justificativa_cancelamento = justificativa;
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
        .select('aluno_id, turma')
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
            .eq('status', 'ativo')
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
                 .select('turma_id')
                 .eq('status', 'ativo')
                 .in('aluno_id', studentIds)
                 .single();
               
               if (remainingEnrollment && remainingEnrollment.turma_id) {
                 const { data: turmaData } = await supabase
                   .from('turmas_complementares')
                   .select('valor_mensalidade')
                   .eq('id', remainingEnrollment.turma_id)
                   .single();
                 
                 if (turmaData) {
                   await supabase
                     .from('pagamentos')
                     .update({ valor: turmaData.valor_mensalidade })
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
            const msg = `Olá *${guardianData.nome_completo}*! Confirmamos o cancelamento da matrícula de *${studentData.nome_completo}* da turma *${enrollmentData.turma}*. Os débitos mensais referentes a esta matrícula foram cessados. Agradecemos o tempo que estiveram conosco! Caso possamos ajudar em qualquer necessidade, nos sinalize.`;
            await sendWhatsAppMessage(guardianData.telefone, guardianData.nome_completo, msg)
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

      // Note: We don't necessarily pause the subscription in Pagar.me immediately 
      // because we want to postpone the NEXT billing date only when reactivating,
      // based on the actual duration of the freeze.
      // However, some might prefer to cancel and recreate. 
      // The requirement says "postergadas de acordo com os dias de afastamento".
      
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
          
          // Get current subscription to find next_billing_at
          const subRes = await axios.get(`https://api.pagar.me/core/v5/subscriptions/${matData.pagarme_subscription_id}`, {
            headers: { 'Authorization': `Basic ${authHeader}` }
          });

          const currentNextBilling = new Date(subRes.data.next_billing_at);
          const newNextBilling = new Date(currentNextBilling.getTime() + (diffDays * 24 * 60 * 60 * 1000));

          // Update subscription with new billing date
          await axios.patch(`https://api.pagar.me/core/v5/subscriptions/${matData.pagarme_subscription_id}`, {
            next_billing_at: newNextBilling.toISOString()
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
        .from('turmas_complementares')
        .select('id')
        .eq('nome', newTurma)
        .maybeSingle();

      // 2.5 Check if already enrolled in the new class
      const { data: existingEnrollment, error: enrollError } = await supabase
        .from('matriculas')
        .select('id')
        .eq('aluno_id', oldEnrollment.aluno_id)
        .eq('turma', newTurma)
        .eq('status', 'ativo')
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
          pagarme_subscription_id: oldEnrollment.pagarme_subscription_id
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
          const msg = `Olá *${guardianData.nome_completo}*! Confirmamos a transferência da matrícula de *${studentData.nome_completo}* da turma *${oldEnrollment.turma}* para *${newTurma}*. Seguimos a disposição para qualquer necessidade..`;
          await sendWhatsAppMessage(guardianData.telefone, guardianData.nome_completo, msg)
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
      // Fetch all necessary data separately to avoid complex join issues
      const [
        { data: responsaveis, error: rError },
        { data: alunos, error: aError },
        { data: matriculas, error: mError },
        { data: pagamentos, error: pError }
      ] = await Promise.all([
        supabase.from('responsaveis').select('id, nome_completo'),
        supabase.from('alunos').select('id, nome_completo, serie_ano, responsavel_id, data_nascimento'),
        supabase.from('matriculas').select('id, aluno_id, turma, unidade, status, data_cancelamento, data_matricula, plano'),
        supabase.from('pagamentos').select('responsavel_id, status, metodo_pagamento')
      ]);

      if (rError) throw rError;
      if (aError) throw aError;
      if (mError) throw mError;
      if (pError) throw pError;

      // Join the data in memory to match the expected frontend structure
      const result = (responsaveis || []).map(r => {
        const rAlunos = (alunos || [])
          .filter(a => a.responsavel_id === r.id)
          .map(a => ({
            ...a,
            matriculas: (matriculas || []).filter(m => m.aluno_id === a.id)
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

  app.get("/api/admin/debug-counts", async (req, res) => {
    try {
      const { count: sAlunos, error: saErr } = await supabase.from('alunos').select('*', { count: 'exact', head: true });
      const { count: sMatriculas, error: smErr } = await supabase.from('matriculas').select('*', { count: 'exact', head: true });
      const { count: sResp, error: srErr } = await supabase.from('responsaveis').select('*', { count: 'exact', head: true });
      const { count: sPag, error: spErr } = await supabase.from('pagamentos').select('*', { count: 'exact', head: true });
      
      res.json({
        source: { 
          alunos: sAlunos, 
          matriculas: sMatriculas, 
          responsaveis: sResp,
          pagamentos: sPag,
          errors: { saErr, smErr, srErr, spErr } 
        }
      });
    } catch (error: any) {
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
        .from('turmas_complementares')
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
          .eq('status', 'ativo')
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
        .select('*')
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
      
      await sendWhatsAppMessage(whatsapp, item.responsavel1, message);
      
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

      res.json(coupon);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/admin/financial-report", async (req, res) => {
    try {
      console.log("Fetching financial report data...");
      // Fetch all necessary data separately to avoid complex join issues
      const [
        pRes,
        rRes,
        aRes,
        mRes,
        tResInitial
      ] = await Promise.all([
        supabase.from('pagamentos').select('*'),
        supabase.from('responsaveis').select('id, nome_completo'),
        supabase.from('alunos').select('id, nome_completo, responsavel_id, turma_escolar'),
        supabase.from('matriculas').select('*'), // Fetch all columns to include professor if it exists
        supabase.from('turmas_complementares').select('id, nome, professor, unidade_nome')
      ]);

      let tRes = tResInitial;
      
      // Fallback if 'professor' column is missing
      if (tRes.error && tRes.error.message?.includes('column turmas_complementares.professor does not exist')) {
        console.warn("Column 'professor' missing in 'turmas_complementares', retrying without it...");
        tRes = await supabase.from('turmas_complementares').select('id, nome, unidade_nome');
        if (!tRes.error && tRes.data) {
          // Add null professor to each record to maintain structure
          tRes.data = tRes.data.map(t => ({ ...t, professor: null }));
        }
      }

      if (pRes.error) { console.error("Pagamentos Fetch Error:", pRes.error); throw new Error(`Pagamentos: ${getErrorMessage(pRes.error)}`); }
      if (rRes.error) { console.error("Responsaveis Fetch Error:", rRes.error); throw new Error(`Responsaveis: ${getErrorMessage(rRes.error)}`); }
      if (aRes.error) { console.error("Alunos Fetch Error:", aRes.error); throw new Error(`Alunos: ${getErrorMessage(aRes.error)}`); }
      if (mRes.error) { console.error("Matriculas Fetch Error:", mRes.error); throw new Error(`Matriculas: ${getErrorMessage(mRes.error)}`); }
      if (tRes.error) { console.error("Turmas Fetch Error:", tRes.error); throw new Error(`Turmas: ${getErrorMessage(tRes.error)}`); }

      const pagamentos = pRes.data || [];
      const responsaveis = rRes.data || [];
      const alunos = aRes.data || [];
      const matriculas = mRes.data || [];
      const turmas = tRes.data || [];

      console.log(`Data fetched: ${pagamentos.length} payments, ${responsaveis.length} guardians, ${alunos.length} students, ${matriculas.length} enrollments, ${turmas.length} classes.`);

      // Join the data in memory
      const detailedPagamentos = pagamentos.map(p => {
        const resp = responsaveis.find(r => r.id === p.responsavel_id);
        let respAlunos = [];

        // If payment is linked to a specific enrollment, use it
        if (p.matricula_id) {
          const mat = matriculas.find(m => m.id === p.matricula_id);
          if (mat) {
            const aluno = alunos.find(a => a.id === mat.aluno_id);
            if (aluno) {
              respAlunos = [{
                ...aluno,
                matriculas: [mat]
              }];
            }
          }
        } else {
          // Fallback: link to all students of the guardian (old behavior)
          respAlunos = alunos
            .filter(a => a.responsavel_id === p.responsavel_id)
            .map(a => ({
              ...a,
              matriculas: matriculas.filter(m => m.aluno_id === a.id)
            }));
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

      res.json({ pagamentos: detailedPagamentos, turmas: turmas });
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

  // Admin: Bulk Import
  app.post("/api/admin/import", async (req, res) => {
    const { rows, preview } = req.body;
    console.log(`Import request received with ${rows?.length || 0} rows. Preview: ${preview}`);
    
    if (!rows || !Array.isArray(rows)) {
      return res.status(400).json({ error: "Invalid data format. Expected an array of rows." });
    }

    // Check tables existence first
    const tablesToCheck = ['responsaveis', 'alunos', 'matriculas'];
    for (const table of tablesToCheck) {
      const { exists, error } = await checkTable(table);
      if (!exists) {
        console.error(`Critical error: table '${table}' is missing in Supabase. Error: ${error}`);
        return res.status(500).json({ 
          error: `Tabela '${table}' não encontrada no Supabase. Por favor, verifique se as migrações foram executadas.`,
          details: error
        });
      }
    }

    if (rows.length > 0) {
      console.log('First row sample:', JSON.stringify(rows[0], null, 2));
    }

    const results = {
      success: 0,
      skipped: 0,
      errors: [] as any[],
      processed: 0
    };

    for (const row of rows) {
      results.processed++;
      // Add a small delay to prevent rate limiting (100ms)
      await sleep(100);
      try {
        // 1. Process Guardian
        let guardianId: any;
        const email = String(row.responsavel_email || '').trim().toLowerCase();
        const cpf = String(row.responsavel_cpf || '').replace(/\D/g, '');
        
        if (!email && !cpf && !row.responsavel_nome) {
          console.warn(`Skipping empty row at index ${results.processed - 1}`);
          continue;
        }

        let existingGuardian = null;
        
        if (email) {
          const { data, error: gError } = await supabase
            .from('responsaveis')
            .select('id')
            .eq('email', email)
            .maybeSingle();
          if (gError) throw gError;
          existingGuardian = data;
        }
        
        if (!existingGuardian && cpf) {
          const { data, error: gError } = await supabase
            .from('responsaveis')
            .select('id')
            .eq('cpf', cpf)
            .maybeSingle();
          if (gError) throw gError;
          existingGuardian = data;
        }

        if (existingGuardian) {
          guardianId = existingGuardian.id;
        } else {
          if (preview) {
            guardianId = `preview-guardian-${results.processed}`;
          } else {
            // If CPF is missing but required by DB, generate a unique placeholder
            const finalCpf = cpf || `IMP${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
            
            const { data: newGuardian, error: gError } = await supabase
              .from('responsaveis')
              .insert([{
                nome_completo: row.responsavel_nome || 'Responsável Importado',
                cpf: finalCpf,
                email: email || null,
                telefone: row.responsavel_telefone,
                endereco: row.responsavel_endereco,
                senha: cpf || email || '123456' // Fallback password
              }])
              .select()
              .single();

            if (gError) throw gError;
            guardianId = newGuardian.id;
          }
        }

        // 2. Process Student
        let alunoId: any;
        const studentName = String(row.aluno_nome || '').trim();
        const birthDate = formatDate(row.aluno_data_nascimento);

        let studentQuery = supabase
          .from('alunos')
          .select('id')
          .eq('responsavel_id', guardianId)
          .ilike('nome_completo', studentName);
        
        if (birthDate) {
          studentQuery = studentQuery.eq('data_nascimento', birthDate);
        }

        const { data: existingStudent, error: sCheckError } = await studentQuery.maybeSingle();
        if (sCheckError) throw sCheckError;

        if (existingStudent) {
          alunoId = existingStudent.id;
        } else {
          if (preview) {
            alunoId = `preview-aluno-${results.processed}`;
          } else {
            const { data: newStudent, error: sError } = await supabase
              .from('alunos')
              .insert([{
                responsavel_id: guardianId,
                nome_completo: studentName || 'Aluno Importado',
                data_nascimento: birthDate,
                serie_ano: row.aluno_serie,
                turma_escolar: row.aluno_turma_escolar,
                responsavel_1: row.responsavel_1 || '',
                whatsapp_1: row.whatsapp_1 || '',
                responsavel_2: row.responsavel_2 || '',
                whatsapp_2: row.whatsapp_2 || ''
              }])
              .select()
              .single();

            if (sError) throw sError;
            alunoId = newStudent.id;
          }
        }

        // 3. Process Enrollment
        const enrollmentDate = formatDate(row.data_matricula) || new Date().toISOString().split('T')[0];
        const cancelDate = formatDate(row.data_cancelamento);
        const status = String(row.status || 'ativo').toLowerCase();
        const turma = row.turma_complementar;
        const unidade = row.unidade;

        // --- LOOKUP turma_id ---
        let turma_id = null;
        if (turma && unidade) {
          const { data: turmaData, error: turmaError } = await supabase
            .from('turmas')
            .select('id')
            .ilike('nome', turma)
            .eq('unidade', unidade)
            .maybeSingle();
          
          if (!turmaError && turmaData) {
            turma_id = turmaData.id;
          }
        }

        // Check if enrollment already exists - only for existing students and non-preview IDs
        if (alunoId && !String(alunoId).startsWith('preview-')) {
          let enrollmentQuery = supabase
            .from('matriculas')
            .select('id')
            .eq('aluno_id', alunoId);
            
          if (turma_id) {
            enrollmentQuery = enrollmentQuery.eq('turma_id', turma_id);
          } else if (turma) {
            enrollmentQuery = enrollmentQuery.eq('turma', turma);
          } else {
            enrollmentQuery = enrollmentQuery.is('turma', null);
          }

          if (unidade) {
            enrollmentQuery = enrollmentQuery.eq('unidade', unidade);
          } else {
            enrollmentQuery = enrollmentQuery.is('unidade', null);
          }

          const { data: existingEnrollment, error: eCheckError } = await enrollmentQuery.maybeSingle();
          if (eCheckError) {
            console.error(`Error checking existence for enrollment (${alunoId}):`, JSON.stringify(eCheckError, null, 2));
          } else if (existingEnrollment) {
            console.log(`Skipping duplicate enrollment for student ${alunoId} in class ${turma}`);
            results.skipped++;
            continue;
          }
        }

        if (preview) {
          results.success++;
          continue;
        }

        const insertMatricula: any = {
          aluno_id: alunoId,
          turma: turma,
          unidade: unidade,
          status: status,
          data_matricula: enrollmentDate,
          plano: row.plano,
          data_cancelamento: cancelDate,
          turma_id: turma_id
        };

        let { error: mError } = await supabase
          .from('matriculas')
          .insert([insertMatricula]);

        if (mError && (mError.code === '42703' || mError.code === 'PGRST204')) {
          // Some column does not exist. Let's try without 'turma'
          delete insertMatricula.turma;
          const secondInsert = await supabase.from('matriculas').insert([insertMatricula]);
          mError = secondInsert.error;
        }

        if (mError) throw mError;
        results.success++;
      } catch (err: any) {
        console.error(`Error importing row ${results.processed}:`, err);
        results.errors.push({
          row: results.processed,
          student: row.aluno_nome,
          error: getErrorMessage(err),
          data: row
        });
      }
    }

    console.log(`Import finished. Success: ${results.success}, Errors: ${results.errors.length}`);
    res.json(results);
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

  app.post("/api/admin/import-aulas-experimentais", async (req, res) => {
    const { rows, preview } = req.body;
    console.log(`Import aulas experimentais request received with ${rows?.length || 0} rows. Preview: ${preview}`);
    
    if (!rows || !Array.isArray(rows)) {
      return res.status(400).json({ error: "Invalid data format. Expected an array of rows." });
    }

    // Check table existence first
    const { exists, error: tableError } = await checkTable('aulas_experimentais');
    if (!exists) {
      console.error(`Critical error: table 'aulas_experimentais' is missing in Supabase. Error: ${tableError}`);
      return res.status(500).json({ 
        error: "Tabela 'aulas_experimentais' não encontrada no Supabase. Por favor, verifique se as migrações foram executadas.",
        details: tableError
      });
    }

    const results = {
      success: 0,
      skipped: 0,
      errors: [] as any[],
      processed: 0
    };

    for (const row of rows) {
      results.processed++;
      try {
        const getVal = (keys: string[]) => {
          const entry = Object.entries(row).find(([k]) => {
            const cleanK = k.replace(/^\uFEFF/i, '').trim().toLowerCase();
            return keys.some(key => {
              const cleanKey = key.toLowerCase();
              return cleanK === cleanKey || cleanK.includes(cleanKey);
            });
          });
          return entry ? String(entry[1]).trim() : '';
        };

        const estudante = getVal(['estudante', 'aluno']);
        const unidade = getVal(['unidade']);
        const curso = getVal(['curso']);
        const dataAulaRaw = getVal(['aula', 'data aula', 'data da aula']);
        const dataAula = formatDate(dataAulaRaw);
        const dataNascimentoRaw = getVal(['nascimento', 'data de nascimento', 'data_nascimento', 'aluno_data_nascimento']);
        const dataNascimento = formatDate(dataNascimentoRaw);
        const serieAno = getVal(['serie', 'série', 'ano', 'serie_ano', 'aluno_serie']);
        
        if (!estudante || !unidade) {
          console.warn(`Skipping invalid row at index ${results.processed - 1}`);
          results.errors.push({ row: results.processed, error: 'Estudante e Unidade são obrigatórios', data: row });
          continue;
        }

        // --- LOOKUP aluno_id ---
        let aluno_id = null;
        let isNewStudent = false;
        const { data: alunoData, error: alunoError } = await supabase
          .from('alunos')
          .select('id')
          .ilike('nome_completo', estudante)
          .maybeSingle();
        
        if (!alunoError && alunoData) {
          aluno_id = alunoData.id;
        } else {
          isNewStudent = true;
        }

        if (!aluno_id) {
          if (preview) {
            aluno_id = `preview-aluno-${results.processed}`;
          } else {
            // Register as Lead if not found
            // We need a guardian for the student. Let's try to find or create a "Lead Guardian"
            let guardianId = null;
            const { data: leadGuardian, error: lgError } = await supabase
              .from('responsaveis')
              .select('id')
              .ilike('nome_completo', 'Responsável Lead (Importação)')
              .maybeSingle();
            
            if (leadGuardian) {
              guardianId = leadGuardian.id;
            } else {
              const { data: newLG, error: nlgError } = await supabase
                .from('responsaveis')
                .insert([{ 
                  nome_completo: 'Responsável Lead (Importação)',
                  telefone: '00000000000',
                  cpf: '00000000000',
                  senha: 'lead_guardian_pass'
                }])
                .select('id')
                .maybeSingle();
              
              if (newLG) {
                guardianId = newLG.id;
              } else {
                console.error("Error creating Lead Guardian:", JSON.stringify(nlgError, null, 2));
              }
            }

            if (!guardianId) {
              results.errors.push({ 
                row: results.processed, 
                error: `Não foi possível criar ou encontrar um responsável para o aluno Lead: ${estudante}`,
                data: row 
              });
              continue;
            }

            const { data: newAluno, error: insertError } = await supabase
              .from('alunos')
              .insert([{
                nome_completo: estudante,
                responsavel_id: guardianId,
                data_nascimento: dataNascimento,
                serie_ano: serieAno
              }])
              .select('id')
              .single();

            if (insertError) {
              console.error(`Error creating Lead student for ${estudante}:`, JSON.stringify(insertError, null, 2));
              results.errors.push({ 
                row: results.processed, 
                error: `Erro ao cadastrar aluno como Lead: ${getErrorMessage(insertError)}`,
                details: insertError,
                data: row 
              });
              continue;
            }
            aluno_id = newAluno.id;
          }
        }

        // Check if aula experimental already exists - only for existing students and non-preview IDs
        if (!isNewStudent && aluno_id && !String(aluno_id).startsWith('preview-')) {
          let query = supabase
            .from('aulas_experimentais')
            .select('id')
            .eq('unidade', unidade)
            .eq('aluno_id', aluno_id);

          if (curso) {
            query = query.eq('curso', curso);
          } else {
            query = query.is('curso', null);
          }

          if (dataAula) {
            query = query.eq('aula', dataAula);
          } else {
            query = query.is('aula', null);
          }
          
          const { data: existingAulas, error: checkError } = await query;

          if (checkError) {
            console.error(`Error checking existence for aula experimental (${estudante}):`, JSON.stringify(checkError, null, 2));
            const errorMsg = getErrorMessage(checkError);
            
            results.errors.push({ 
              row: results.processed, 
              error: `Erro ao verificar existência: ${errorMsg}`,
              data: row 
            });
            continue;
          }

          if (existingAulas && existingAulas.length > 0) {
            console.log(`Skipping duplicate aula experimental for student ${estudante} at ${unidade}`);
            results.skipped++;
            continue;
          }
        }

        if (preview) {
          results.success++;
          continue;
        }

        const insertData: any = {
          id: crypto.randomUUID(),
          unidade: unidade,
          curso: curso || null,
          aula: dataAula,
          horario: getVal(['horário', 'horario']) || null,
          responsavel1: getVal(['responsável 1', 'responsavel 1', 'responsavel']) || null,
          whatsapp1: getVal(['whatsapp1', 'whatsapp 1', 'whatsapp']) || null,
          status: getVal(['status']) || 'Pendente',
          observacao_professor: getVal(['observação professor', 'observacao professor', 'observacao_professor']) || null,
          follow_up_sent: getVal(['follow-up', 'follow_up', 'follow up']).toLowerCase() === 'sim',
          lembrete_enviado: getVal(['lembrete', 'lembrete enviado']).toLowerCase() === 'sim',
          convertido: getVal(['convertido']).toLowerCase() === 'sim',
          etapa: getVal(['etapa']) || null,
          ano_escolar: getVal(['ano escolar', 'ano_escolar']) || null,
          turma_escolar: getVal(['turma escolar', 'turma_escolar']) || null,
          aluno_id: aluno_id
        };

        // Try to insert with all columns first
        let { error } = await supabase.from('aulas_experimentais').insert([insertData]);

        if (error) {
          console.error(`Error inserting aula experimental for ${estudante}:`, error);
          results.errors.push({ row: results.processed, error: getErrorMessage(error), data: row });
        } else {
          results.success++;
        }
      } catch (err: any) {
        console.error(`Exception processing row ${results.processed}:`, err);
        results.errors.push({ row: results.processed, error: err.message });
      }
    }

    return res.json(results);
  });

  app.post("/api/admin/import-ocorrencias", async (req, res) => {
    const { rows, preview } = req.body;
    console.log(`Import ocorrencias request received with ${rows?.length || 0} rows. Preview: ${preview}`);
    
    if (!rows || !Array.isArray(rows)) {
      return res.status(400).json({ error: "Invalid data format. Expected an array of rows." });
    }

    // Check table existence first
    const { exists, error: tableError } = await checkTable('ocorrencias');
    if (!exists) {
      console.error(`Critical error: table 'ocorrencias' is missing in Supabase. Error: ${tableError}`);
      return res.status(500).json({ 
        error: "Tabela 'ocorrencias' não encontrada no Supabase. Por favor, verifique se as migrações foram executadas.",
        details: tableError
      });
    }

    const results = {
      success: 0,
      skipped: 0,
      errors: [] as any[],
      processed: 0
    };

    for (const row of rows) {
      results.processed++;
      // Add a small delay to prevent rate limiting (100ms)
      await sleep(100);
      try {
        const getVal = (keys: string[]) => {
          const entry = Object.entries(row).find(([k]) => {
            const cleanK = k.replace(/^\uFEFF/i, '').trim().toLowerCase();
            return keys.some(key => {
              const cleanKey = key.toLowerCase();
              return cleanK === cleanKey || cleanK.includes(cleanKey);
            });
          });
          return entry ? String(entry[1]).trim() : '';
        };

        const dataOcorrenciaRaw = getVal(['data', 'data ocorrencia', 'data da ocorrencia']);
        const dataOcorrencia = formatDate(dataOcorrenciaRaw);
        const unidade = getVal(['unidade']);
        const estudante = getVal(['estudante', 'aluno']);
        const dataNascimentoRaw = getVal(['nascimento', 'data de nascimento', 'data_nascimento', 'aluno_data_nascimento']);
        const dataNascimento = formatDate(dataNascimentoRaw);
        const serieAno = getVal(['serie', 'série', 'ano', 'serie_ano', 'aluno_serie']);
        const observacao = getVal(['observação', 'observacao']);
        const usuario = getVal(['usuário', 'usuario']);
        
        if (!estudante || !dataOcorrencia || !observacao) {
          console.warn(`Skipping invalid row at index ${results.processed - 1}`);
          results.errors.push({ 
            row: results.processed, 
            error: 'Estudante, Data e Observação são obrigatórios',
            data: row 
          });
          continue;
        }

        // --- LOOKUP aluno_id ---
        let aluno_id = null;
        let isNewStudent = false;
        const { data: alunoData, error: alunoError } = await supabase
          .from('alunos')
          .select('id')
          .ilike('nome_completo', estudante)
          .maybeSingle();
        
        if (!alunoError && alunoData) {
          aluno_id = alunoData.id;
        } else {
          isNewStudent = true;
        }

        if (!aluno_id) {
          if (preview) {
            aluno_id = `preview-aluno-${results.processed}`;
          } else {
            // Register as Lead if not found
            // We need a guardian for the student. Let's try to find or create a "Lead Guardian"
            let guardianId = null;
            const { data: leadGuardian, error: lgError } = await supabase
              .from('responsaveis')
              .select('id')
              .ilike('nome_completo', 'Responsável Lead (Importação)')
              .maybeSingle();
            
            if (leadGuardian) {
              guardianId = leadGuardian.id;
            } else {
              const { data: newLG, error: nlgError } = await supabase
                .from('responsaveis')
                .insert([{ 
                  nome_completo: 'Responsável Lead (Importação)',
                  telefone: '00000000000',
                  cpf: '00000000000',
                  senha: 'lead_guardian_pass'
                }])
                .select('id')
                .maybeSingle();
              
              if (newLG) {
                guardianId = newLG.id;
              } else {
                console.error("Error creating Lead Guardian:", JSON.stringify(nlgError, null, 2));
              }
            }

            if (!guardianId) {
              results.errors.push({ 
                row: results.processed, 
                error: `Não foi possível criar ou encontrar um responsável para o aluno Lead: ${estudante}`,
                data: row 
              });
              continue;
            }

            const { data: newAluno, error: insertError } = await supabase
              .from('alunos')
              .insert([{
                nome_completo: estudante,
                responsavel_id: guardianId,
                data_nascimento: dataNascimento,
                serie_ano: serieAno
              }])
              .select('id')
              .single();
            
            if (insertError) {
              console.error(`Error creating Lead student for ${estudante}:`, JSON.stringify(insertError, null, 2));
              results.errors.push({ 
                row: results.processed, 
                error: `Erro ao cadastrar aluno como Lead: ${getErrorMessage(insertError)}`,
                details: insertError,
                data: row 
              });
              continue;
            }
            aluno_id = newAluno.id;
          }
        }

        // Check if ocorrencia already exists - only for existing students and non-preview IDs
        if (!isNewStudent && aluno_id && !String(aluno_id).startsWith('preview-')) {
          let query = supabase
            .from('ocorrencias')
            .select('id')
            .eq('data', dataOcorrencia)
            .eq('aluno_id', aluno_id)
            .ilike('observacao', observacao);

          if (unidade) {
            query = query.eq('unidade', unidade);
          }
          
          const { data: existingOcorrencias, error: checkError } = await query;

          if (checkError) {
            console.error(`Error checking existence for ocorrencia (${estudante}):`, JSON.stringify(checkError, null, 2));
            const errorMsg = getErrorMessage(checkError);
            
            results.errors.push({ 
              row: results.processed, 
              error: `Erro ao verificar existência: ${errorMsg}`,
              data: row 
            });
            continue;
          }

          if (existingOcorrencias && existingOcorrencias.length > 0) {
            console.log(`Skipping duplicate ocorrencia for student ${estudante} on ${dataOcorrencia}`);
            results.skipped++;
            continue;
          }
        }

        if (preview) {
          results.success++;
          continue;
        }

        const insertData: any = {
          id: crypto.randomUUID(),
          data: dataOcorrencia,
          unidade: unidade || null,
          observacao: observacao,
          usuario: usuario || null,
          aluno_id: aluno_id
        };

        // Try to insert with all columns first
        let { error } = await supabase.from('ocorrencias').insert([insertData]);

        if (error) {
          console.error(`Error inserting ocorrencia for ${estudante}:`, error);
          results.errors.push({ row: results.processed, error: getErrorMessage(error), data: row });
        } else {
          results.success++;
        }
      } catch (err: any) {
        console.error(`Exception processing row ${results.processed}:`, err);
        results.errors.push({ row: results.processed, error: err.message, data: row });
      }
    }

    return res.json(results);
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

  app.post("/api/admin/import-presencas", async (req, res) => {
    const { rows, preview } = req.body;
    console.log(`Import presencas request received with ${rows?.length || 0} rows. Preview: ${preview}`);
    
    if (!rows || !Array.isArray(rows)) {
      return res.status(400).json({ error: "Invalid data format. Expected an array of rows." });
    }

    // Check table existence first
    const { exists, error: tableError } = await checkTable('presencas');
    if (!exists) {
      console.error(`Critical error: table 'presencas' is missing in Supabase. Error: ${tableError}`);
      return res.status(500).json({ 
        error: "Tabela 'presencas' não encontrada no Supabase. Por favor, verifique se as migrações foram executadas.",
        details: tableError
      });
    }

    const results = {
      success: 0,
      skipped: 0,
      errors: [] as any[],
      processed: 0
    };

    for (const row of rows) {
      results.processed++;
      // Add a small delay to prevent rate limiting (100ms)
      await sleep(100);
      try {
        const getVal = (keys: string[]) => {
          const entry = Object.entries(row).find(([k]) => {
            const cleanK = k.replace(/^\uFEFF/i, '').trim().toLowerCase();
            return keys.some(key => {
              const cleanKey = key.toLowerCase();
              return cleanK === cleanKey || cleanK.includes(cleanKey);
            });
          });
          return entry ? String(entry[1]).trim() : '';
        };

        const dataPresencaRaw = getVal(['data']);
        const dataPresenca = formatDate(dataPresencaRaw);
        const unidade = getVal(['unidade']);
        const turma = getVal(['turma']);
        const estudante = getVal(['estudante', 'aluno']);
        const dataNascimentoRaw = getVal(['nascimento', 'data de nascimento', 'data_nascimento', 'aluno_data_nascimento']);
        const dataNascimento = formatDate(dataNascimentoRaw);
        const serieAno = getVal(['serie', 'série', 'ano', 'serie_ano', 'aluno_serie']);
        const status = getVal(['status']);
        const observacao = getVal(['observação', 'observacao']);
        const alarme = getVal(['alarme']);
        const timestampInclusao = getVal(['timestamp inclusão', 'timestamp inclusao', 'timestamp']);
        
        if (!estudante || !dataPresenca || !status) {
          console.warn(`Skipping invalid row at index ${results.processed - 1}`);
          results.errors.push({ 
            row: results.processed, 
            error: 'Estudante, Data e Status são obrigatórios',
            data: row 
          });
          continue;
        }

        // --- LOOKUP IDs ---
        let aluno_id = null;
        let turma_id = null;

        // 1. Find aluno_id by name
        let isNewStudent = false;
        if (estudante) {
          const { data: alunoData, error: alunoError } = await supabase
            .from('alunos')
            .select('id')
            .ilike('nome_completo', estudante)
            .maybeSingle();

          if (!alunoError && alunoData) {
            aluno_id = alunoData.id;
          } else {
            isNewStudent = true;
          }
        }

        // 2. Find turma_id from turmas_complementares table
        if (turma && unidade) {
          const { data: turmaData, error: turmaError } = await supabase
            .from('turmas_complementares')
            .select('id')
            .ilike('nome', turma)
            .eq('unidade_nome', unidade)
            .maybeSingle();
          
          if (!turmaError && turmaData) {
            turma_id = turmaData.id;
          }
        } else if (turma) {
          // Fallback if no unidade is provided
          const { data: turmaData, error: turmaError } = await supabase
            .from('turmas_complementares')
            .select('id')
            .ilike('nome', turma)
            .limit(1)
            .maybeSingle();
            
          if (!turmaError && turmaData) {
            turma_id = turmaData.id;
          }
        }

        if (!aluno_id) {
          if (preview) {
            aluno_id = `preview-aluno-${results.processed}`;
          } else {
            // Register as Lead if not found
            // We need a guardian for the student. Let's try to find or create a "Lead Guardian"
            let guardianId = null;
            const { data: leadGuardian, error: lgError } = await supabase
              .from('responsaveis')
              .select('id')
              .ilike('nome_completo', 'Responsável Lead (Importação)')
              .maybeSingle();
            
            if (leadGuardian) {
              guardianId = leadGuardian.id;
            } else {
              const { data: newLG, error: nlgError } = await supabase
                .from('responsaveis')
                .insert([{ 
                  nome_completo: 'Responsável Lead (Importação)',
                  telefone: '00000000000',
                  cpf: '00000000000',
                  senha: 'lead_guardian_pass'
                }])
                .select('id')
                .maybeSingle();
              
              if (newLG) {
                guardianId = newLG.id;
              } else {
                console.error("Error creating Lead Guardian:", JSON.stringify(nlgError, null, 2));
              }
            }

            if (!guardianId) {
              results.errors.push({ 
                row: results.processed, 
                error: `Não foi possível criar ou encontrar um responsável para o aluno Lead: ${estudante}`,
                data: row 
              });
              continue;
            }

            const { data: newAluno, error: insertError } = await supabase
              .from('alunos')
              .insert([{
                nome_completo: estudante,
                responsavel_id: guardianId,
                data_nascimento: dataNascimento,
                serie_ano: serieAno
              }])
              .select('id')
              .single();
            
            if (insertError) {
              console.error(`Error creating Lead student for ${estudante}:`, JSON.stringify(insertError, null, 2));
              results.errors.push({ 
                row: results.processed, 
                error: `Erro ao cadastrar aluno como Lead: ${getErrorMessage(insertError)}`,
                details: insertError,
                data: row 
              });
              continue;
            }
            aluno_id = newAluno.id;
          }
        }

        if (!turma_id && turma) {
          results.errors.push({ 
            row: results.processed, 
            error: `Turma não encontrada: ${turma}`,
            data: row 
          });
          continue;
        }

        // Check if presenca already exists - only for existing students and non-preview IDs
        if (!isNewStudent && aluno_id && !String(aluno_id).startsWith('preview-')) {
          let query = supabase
            .from('presencas')
            .select('id')
            .eq('data', dataPresenca)
            .eq('aluno_id', aluno_id);

          if (turma_id) {
            query = query.eq('turma_id', turma_id);
          }

          const { data: existingPresencas, error: checkError } = await query;

          if (checkError) {
            console.error(`Error checking existence for presenca (${estudante}):`, JSON.stringify(checkError, null, 2));
            const errorMsg = getErrorMessage(checkError);
            
            results.errors.push({ 
              row: results.processed, 
              error: `Erro ao verificar existência: ${errorMsg}`,
              data: row 
            });
            continue;
          }

          if (existingPresencas && existingPresencas.length > 0) {
            console.log(`Skipping duplicate presenca for student ${estudante} on ${dataPresenca}`);
            results.skipped++;
            continue;
          }
        }

        if (preview) {
          results.success++;
          continue;
        }

        const insertData: any = {
          id: crypto.randomUUID(),
          data: dataPresenca,
          unidade: unidade || null,
          status: status,
          observacao: observacao || null,
          alarme: alarme || null,
          timestamp_inclusao: formatTimestamp(timestampInclusao),
          aluno_id: aluno_id,
          turma_id: turma_id
        };

        // Try to insert with all columns first
        let { error } = await supabase.from('presencas').insert([insertData]);

        if (error && (error.code === '42703' || error.code === 'PGRST204')) {
          // If it fails with missing column, it might be because observacao, alarme, or timestamp_inclusao are missing in some environments
          delete insertData.alarme;
          delete insertData.observacao;
          delete insertData.timestamp_inclusao;
          const secondInsert = await supabase.from('presencas').insert([insertData]);
          error = secondInsert.error;
        }

        if (error) {
          console.error(`Error inserting presenca for ${estudante}:`, JSON.stringify(error, null, 2));
          results.errors.push({ 
            row: results.processed, 
            error: getErrorMessage(error),
            details: error,
            data: row
          });
        } else {
          results.success++;
        }
      } catch (err: any) {
        console.error(`Exception processing row ${results.processed}:`, err);
        results.errors.push({ row: results.processed, error: err.message, data: row });
      }
    }

    return res.json(results);
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
        event.type === 'invoice.paid' ||
        event.type === 'invoice.payment_failed' ||
        event.type === 'subscription.created' ||
        event.type === 'subscription.updated' ||
        event.type === 'subscription.canceled' ||
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
            } else if (data.invoice && data.invoice.subscription_id) {
              subscriptionId = data.invoice.subscription_id;
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

        if (paymentId && paymentId.includes('_') && !paymentId.startsWith('enroll_') && !paymentId.startsWith('or_') && !paymentId.startsWith('ch_') && !paymentId.startsWith('sub_') && !paymentId.startsWith('in_')) {
          paymentId = paymentId.split('_')[0];
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
            event.type === 'charge.antifraud_reproved';

          const isCanceled = 
            event.type === 'subscription.canceled' || 
            event.type === 'order.canceled' ||
            event.type === 'charge.canceled' ||
            event.type === 'invoice.canceled';

          const isRefunded = event.type === 'charge.refunded';
          
          if (!isPaid && !isFailed && !isCanceled && !isRefunded) {
            console.log(`[Webhook Pagar.me] Evento ignorado (não é pago, falha, cancelamento nem estorno). Status: ${data.status}`);
            return res.status(200).json({ received: true });
          }

          const status = isPaid ? 'pago' : (isCanceled ? 'cancelado' : (isRefunded ? 'estornado' : 'falha'));

          // Check if it's a recurring payment (cycle > 1)
          const invoice = data.invoice || (data.charges && data.charges[0] && data.charges[0].invoice) || (event.type === 'invoice.paid' ? data : null);
          const isSubscription = (invoice && invoice.subscription_id) || event.type.startsWith('subscription.');
          const cycle = invoice ? invoice.cycle : (data.current_cycle || 1);
          let targetPaymentId = paymentId;

          // 1. Tenta atualização completa
          const updatePayload: any = { 
            status: status
          };
          
          if (isPaid) {
            updatePayload.data_pagamento = new Date().toISOString();
            
            // Se for uma fatura de assinatura, preferimos salvar o ID da assinatura para facilitar cancelamentos
            if (isSubscription && invoice && invoice.subscription_id) {
              updatePayload.pagarme = invoice.subscription_id;
            } else {
              updatePayload.pagarme = data.id;
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

          if (isSubscription && cycle > 1) {
            console.log(`[Webhook Pagar.me] Pagamento recorrente detectado. Ciclo: ${cycle}`);
            // Find the original payment to get matricula_id
            const { data: originalPayment } = await supabase
              .from('pagamentos')
              .select('matricula_id')
              .eq('id', paymentId)
              .single();

            if (originalPayment && originalPayment.matricula_id) {
              // Find the next pending payment for this matricula
              const { data: nextPayment } = await supabase
                .from('pagamentos')
                .select('id')
                .eq('matricula_id', originalPayment.matricula_id)
                .eq('status', 'pendente')
                .order('data_vencimento', { ascending: true })
                .limit(1)
                .single();

              if (nextPayment) {
                targetPaymentId = nextPayment.id;
                console.log(`[Webhook Pagar.me] Atualizando parcela pendente: ${targetPaymentId}`);
              } else {
                console.warn(`[Webhook Pagar.me] Nenhuma parcela pendente encontrada para a matrícula ${originalPayment.matricula_id}`);
              }
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
                .select('status, turma_id, unidade, turma, created_at')
                .eq('id', paymentData.matricula_id)
                .single();

              if (matricula && matricula.status === 'pendente') {
                console.log(`[Webhook Pagar.me] Ativando matrícula ${paymentData.matricula_id}...`);
                
                // Fetch class data for values
                const { data: classData } = await supabase
                  .from('turmas_complementares')
                  .select('valor_mensalidade')
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

                const valorSistema = classData?.valor_mensalidade || 0;
                const valorPadrao = valorSistema * 1.10;
                const descontoTaxaZero = valorSistema * 0.10;
                const valorCheio = valorSistema;
                const valorMatricula = firstPayment?.valor || valorSistema;

                // Update matricula status to 'ativo' and set data_matricula
                await supabase
                  .from('matriculas')
                  .update({ 
                    status: 'ativo',
                    data_matricula: new Date().toISOString()
                  })
                  .eq('id', paymentData.matricula_id);

                // Fetch guardian and student details for notifications
                const { data: guardian } = await supabase
                  .from('responsaveis')
                  .select('*')
                  .eq('id', paymentData.responsavel_id)
                  .single();

                const { data: student } = await supabase
                  .from('alunos')
                  .select('nome_completo, turma_complementar, unidade')
                  .eq('responsavel_id', paymentData.responsavel_id)
                  .order('created_at', { ascending: false })
                  .limit(1)
                  .single();

                if (guardian) {
                  // Send WhatsApp
                  if (guardian.telefone) {
                    const guardianFirstName = (guardian.nome_completo || '').trim().split(' ')[0];
                    const studentFirstName = student?.nome_completo 
                      ? student.nome_completo.trim().split(' ')[0] 
                      : 'seu filho(a)';
                    const identidade = matricula.unidade === 'Colégio Bernoulli' 
                      ? "*no B+*" 
                      : `na *Sport for Kids* (${matricula.unidade})`;

                    const whatsappMsg = `Olá,*${guardianFirstName}* Que alegria ter vocês com a gente! 🎉
A matrícula de *${studentFirstName}* em *${matricula.turma}* ${identidade} foi confirmada com sucesso. Já estamos preparando tudo para que essa jornada seja incrível.🏆

Se tiver qualquer dúvida sobre as aulas, horários ou o que levar, é só responder essa mensagem. Seja muito bem-vindo(a) ao nosso time! 🏆`;

                    await sendWhatsAppMessage(
                      guardian.telefone,
                      guardian.nome_completo,
                      whatsappMsg
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
                        [{ content: base64Pdf, name: 'Contrato_SportForKids.pdf' }]
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
                .select('status, turma, aluno_id')
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
                  failureReason
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

  app.post("/api/admin/import-wix-payments", express.json({ limit: '10mb' }), async (req, res) => {
    const { payments, preview, mapping } = req.body; // Expecting an array of objects and optional mapping
    if (!Array.isArray(payments)) {
      return res.status(400).json({ error: 'Formato inválido. Esperado um array de pagamentos.' });
    }

    const fuzzy = (s: any) => {
      if (!s) return '';
      return String(s)
        .replace(/[\u0000-\u001F\u007F-\u009F\uFEFF]/g, '')
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]/gi, '')
        .toLowerCase()
        .trim();
    };

    const getVal = (row: any, keys: string[]) => {
      const entries = Object.entries(row);
      const cleanKey = (s: string) => s.replace(/[\u0000-\u001F\u007F-\u009F\uFEFF]/g, '').toLowerCase().trim();
      
      // 1. Tenta correspondência exata primeiro
      for (const key of keys) {
        const ck = cleanKey(key);
        const found = entries.find(([k]) => cleanKey(k) === ck);
        if (found) return String(found[1]).trim();
      }
      // 2. Tenta correspondência parcial se não achar exata
      for (const key of keys) {
        const ck = cleanKey(key);
        const found = entries.find(([k]) => cleanKey(k).includes(ck));
        if (found) return String(found[1]).trim();
      }
      return '';
    };

    const getMappedVal = (row: any, fieldId: string, defaultKeys: string[]) => {
      if (mapping && mapping[fieldId]) {
        return String(row[mapping[fieldId]] || '').trim();
      }
      return getVal(row, defaultKeys);
    };

    const searchInRow = (row: any, search: string) => {
      if (!search) return false;
      const s = fuzzy(search);
      if (s.length < 3) return false;
      return Object.values(row).some(val => {
        if (!val) return false;
        const fVal = fuzzy(val);
        return fVal.includes(s) || s.includes(fVal);
      });
    };

    const searchStudentInRow = (row: any, studentName: string) => {
      if (!studentName) return false;
      const s = fuzzy(studentName);
      const rowValues = Object.values(row).map(v => fuzzy(v));
      
      // Check if fuzzy full name is in any column
      if (rowValues.some(val => val.includes(s) || s.includes(val))) return true;
      
      // Split name into parts and see if at least two parts match
      const parts = studentName.toLowerCase().split(' ').filter(p => p.length > 2);
      if (parts.length < 2) {
        return rowValues.some(val => val.includes(fuzzy(studentName)));
      }
      
      let matchCount = 0;
      for (const part of parts) {
        const fPart = fuzzy(part);
        if (rowValues.some(val => val.includes(fPart))) {
          matchCount++;
        }
      }
      return matchCount >= 2;
    };

    if (preview) {
      const previewData = [];
      const sample = payments.slice(0, 10);
      
      for (const row of sample) {
        const email = getMappedVal(row, 'email', ['Email']);
        const responsavelNomeMapped = getMappedVal(row, 'responsavel_nome', ['Nome', 'Name', 'Responsável']);
        const alunoMapped = getMappedVal(row, 'aluno', ['Aluno', 'Estudante', 'Child', 'Student', 'Nome do Aluno']);
        
        // Se houver mapeamento manual, usamos ele. Caso contrário, a lógica robusta anterior.
        let nomeItem = '';
        if (mapping && mapping.plano) {
          nomeItem = String(row[mapping.plano] || '').trim();
        } else {
          // No CSV do Wix, o plano está na coluna "Nome", mas existem várias colunas "Nome".
          // Vamos tentar pegar o valor de "Nome" que NÃO seja o nome do responsável.
          const nomeResponsavel = getVal(row, ['Nome']);
          const sobrenomeResponsavel = getVal(row, ['Sobrenome']);
          const fullNameResp = (nomeResponsavel + ' ' + sobrenomeResponsavel).trim();

          // Lista de palavras que indicam que um valor é um PLANO/TURMA
          const planKeywords = ['volei', 'xadrez', 'ballet', 'judo', 'tenis', 'futsal', 'basquete', 'teatro', 'robotica', 'funcional', 'dança', 'pickleball', 'programação', 'equipe', 'kids'];

          // Busca o nome do item tentando evitar o nome do responsável
          const possibleItemKeys = ['Produtos ou serviços', 'Item', 'Plano', 'Nome do produto', 'Descrição', 'Serviço', 'Product', 'Description'];
          nomeItem = getVal(row, possibleItemKeys);

          // Se não achou ou o que achou parece ser o nome da mãe, faz varredura profunda
          const allEntries = Object.entries(row);
          let foundPlanByKeyword = '';
          let nomeColumns = [];

          for (const [key, val] of allEntries) {
            const v = String(val).trim();
            const k = key.toLowerCase();
            
            // Guarda todas as colunas que tem "nome" no título
            if (k === 'nome' || k.includes('nome')) {
              nomeColumns.push(v);
            }

            // Se o valor contém uma palavra-chave de plano e não é o nome da mãe
            if (v && v.length > 3 && !fuzzy(v).includes(fuzzy(nomeResponsavel)) && !fuzzy(fullNameResp).includes(fuzzy(v))) {
              if (planKeywords.some(kw => fuzzy(v).includes(kw))) {
                foundPlanByKeyword = v;
              }
            }
          }

          if (foundPlanByKeyword) {
            nomeItem = foundPlanByKeyword;
          } else if (nomeColumns.length >= 3) {
            nomeItem = nomeColumns[2] || nomeColumns[nomeColumns.length - 1];
          }
        }

        const data = getMappedVal(row, 'data', ['Data', 'Date']) || '---';
        
        let alunoNome = 'Não encontrado';
        
        if (email || responsavelNomeMapped) {
          let resp = null;
          if (email) {
            const { data } = await supabase.from('responsaveis').select('id').ilike('email', email.trim()).maybeSingle();
            resp = data;
          }
          
          if (!resp && responsavelNomeMapped) {
            const { data } = await supabase.from('responsaveis').select('id').ilike('nome_completo', responsavelNomeMapped.trim()).maybeSingle();
            resp = data;
          }

          if (resp) {
            const { data: students } = await supabase.from('alunos').select('id, nome').eq('responsavel_id', resp.id);
            if (students && students.length > 0) {
              const studentIds = students.map(s => s.id);
              const { data: enrollments } = await supabase
                .from('matriculas')
                .select('id, aluno_id, plano, turma, status, data_cancelamento')
                .in('aluno_id', studentIds);
              
              if (enrollments) {
                const fItem = fuzzy(nomeItem);
                
                // NOVA ABORDAGEM SÊNIOR: Filtro de Texto Obrigatório
                // Se o nome do plano foi identificado, NADA mais importa se não bater com o texto.
                let matches = [];
                
                if (fItem) {
                  // 1. Tenta match exato ou contido no plano
                  matches = enrollments.filter(e => {
                    const fp = fuzzy(e.plano);
                    return fp && (fp === fItem || fItem.includes(fp) || fp.includes(fItem));
                  });

                  // 2. Se não achou no campo plano, mas o texto do plano da matrícula está na linha do CSV
                  if (matches.length === 0) {
                    matches = enrollments.filter(e => e.plano && searchInRow(row, e.plano));
                  }

                  // 3. Se ainda não achou, tenta por palavras-chave
                  if (matches.length === 0) {
                    const planKeywords = ['volei', 'xadrez', 'ballet', 'judo', 'tenis', 'futsal', 'basquete', 'teatro', 'robotica', 'funcional', 'dança', 'pickleball', 'programação', 'equipe', 'kids'];
                    const foundKeyword = planKeywords.find(kw => fItem.includes(kw));
                    if (foundKeyword) {
                      matches = enrollments.filter(e => {
                        const fp = fuzzy(e.plano);
                        return fp && fp.includes(foundKeyword);
                      });
                    }
                  }
                }

                if (matches.length > 0) {
                  let bestMatch = null;
                  
                  // Entre os que bateram o TEXTO, agora sim aplicamos a prioridade de status e nome
                  const activeMatches = matches.filter(m => m.status === 'ativo' && !m.data_cancelamento);
                  const candidates = activeMatches.length > 0 ? activeMatches : matches;

                  if (candidates.length > 1) {
                    // Se houver mapeamento de aluno, prioriza ele
                    if (alunoMapped) {
                      bestMatch = candidates.find(m => {
                        const s = students.find(st => st.id === m.aluno_id);
                        return s && (fuzzy(s.nome).includes(fuzzy(alunoMapped)) || fuzzy(alunoMapped).includes(fuzzy(s.nome)));
                      });
                    }
                    
                    if (!bestMatch) {
                      bestMatch = candidates.find(m => {
                        const s = students.find(st => st.id === m.aluno_id);
                        return s && searchStudentInRow(row, s.nome);
                      });
                    }
                  }

                  if (!bestMatch) {
                    bestMatch = candidates[0];
                  }

                  const student = students.find(s => s.id === bestMatch.aluno_id);
                  const turmaInfo = bestMatch.turma ? ` (${bestMatch.turma})` : '';
                  alunoNome = (student ? student.nome : 'ID: ' + bestMatch.aluno_id) + turmaInfo;
                } else {
                  // Se o texto não bateu, não associamos a nenhuma turma, mesmo que o aluno seja único.
                  let matchedStudent = null;
                  if (alunoMapped) {
                    matchedStudent = students.find(s => fuzzy(s.nome).includes(fuzzy(alunoMapped)) || fuzzy(alunoMapped).includes(fuzzy(s.nome)));
                  }
                  
                  if (!matchedStudent) {
                    matchedStudent = students.find(s => searchStudentInRow(row, s.nome));
                  }

                  if (matchedStudent) {
                    alunoNome = matchedStudent.nome + ' (Plano divergente)';
                  }
                }
              }
            }
          }
        }

        previewData.push({
          Data: data,
          Item: nomeItem || '---',
          Responsável: email || '---',
          Aluno: alunoNome
        });
      }

      return res.json({ 
        processed: payments.length, 
        success: 0, 
        errors: [], 
        preview: previewData 
      });
    }

    const results = { processed: 0, success: 0, errors: [] as any[], details: [] as any[] };

    for (const row of payments) {
      results.processed++;
      // Add a small delay to prevent rate limiting (100ms)
      await sleep(100);
      try {
        const email = getMappedVal(row, 'email', ['Email']);
        const responsavelNomeMapped = getMappedVal(row, 'responsavel_nome', ['Nome', 'Name', 'Responsável']);
        const alunoMapped = getMappedVal(row, 'aluno', ['Aluno', 'Estudante', 'Child', 'Student', 'Nome do Aluno']);
        const valorStr = getMappedVal(row, 'valor', ['Valor']) || '0,00';
        const valor = parseFloat(valorStr.replace(',', '.'));
        const statusWix = getMappedVal(row, 'status', ['Status da transação', 'Status']);
        const wixId = getMappedVal(row, 'transacao_id', ['ID do provedor de pagamento']);
        
        let nomeItem = '';
        if (mapping && mapping.plano) {
          nomeItem = String(row[mapping.plano] || '').trim();
        } else {
          // Extração robusta do nome do item (mesma lógica da preview)
          const nomeResponsavel = getVal(row, ['Nome']);
          const sobrenomeResponsavel = getVal(row, ['Sobrenome']);
          const fullNameResp = (nomeResponsavel + ' ' + sobrenomeResponsavel).trim();
          const planKeywords = ['volei', 'xadrez', 'ballet', 'judo', 'tenis', 'futsal', 'basquete', 'teatro', 'robotica', 'funcional', 'dança', 'pickleball', 'programação', 'equipe', 'kids'];
          
          nomeItem = getVal(row, ['Produtos ou serviços', 'Item', 'Plano', 'Nome do produto', 'Descrição', 'Serviço', 'Product', 'Description']);
          const allEntries = Object.entries(row);
          let foundPlanByKeyword = '';
          let nomeColumns = [];
          for (const [key, val] of allEntries) {
            const v = String(val).trim();
            const k = key.toLowerCase();
            if (k === 'nome' || k.includes('nome')) nomeColumns.push(v);
            if (v && v.length > 3 && !fuzzy(v).includes(fuzzy(nomeResponsavel)) && !fuzzy(fullNameResp).includes(fuzzy(v))) {
              if (planKeywords.some(kw => fuzzy(v).includes(kw))) foundPlanByKeyword = v;
            }
          }
          if (foundPlanByKeyword) nomeItem = foundPlanByKeyword;
          else if (nomeColumns.length >= 3) nomeItem = nomeColumns[2] || nomeColumns[nomeColumns.length - 1];
        }

        const dataPagamento = formatTimestamp(getMappedVal(row, 'data', ['Data', 'Date']));

        if (!email || !wixId) {
          results.errors.push({ row: results.processed, error: `Email ou ID do Wix ausente. Email: ${email}, WixId: ${wixId}` });
          continue;
        }

        const { data: existing } = await supabase.from('pagamentos').select('id, aluno_id, matricula_id').eq('wix_transaction_id', wixId).maybeSingle();
        
        // Se já existe e já tem aluno vinculado, pula
        if (existing && existing.aluno_id) continue;

        let statusSupabase = 'pendente';
        if (statusWix === 'Bem-sucedido') statusSupabase = 'pago';
        else if (statusWix === 'Recusado') statusSupabase = 'recusado';
        else if (statusWix === 'Reembolsado' || statusWix === 'Parcialmente reembolsado') statusSupabase = 'reembolsado';

        let responsavel = null;
        if (email) {
          const { data } = await supabase.from('responsaveis').select('id').ilike('email', email.trim()).maybeSingle();
          responsavel = data;
        }
        
        if (!responsavel && responsavelNomeMapped) {
          const { data } = await supabase.from('responsaveis').select('id').ilike('nome_completo', responsavelNomeMapped.trim()).maybeSingle();
          responsavel = data;
        }

        if (!responsavel) {
          results.errors.push({ row: results.processed, error: `Responsável não encontrado: ${email || responsavelNomeMapped}` });
          continue;
        }

        let aluno_id = null;
        let matricula_id = null;
        let alunoNomeMatch = '';
        let turmaMatch = '';

        const { data: students } = await supabase.from('alunos').select('id, nome').eq('responsavel_id', responsavel.id);
        const studentIds = students?.map(s => s.id) || [];

        if (studentIds.length > 0) {
          const { data: enrollments } = await supabase
            .from('matriculas')
            .select('id, aluno_id, status, plano, turma, data_cancelamento')
            .in('aluno_id', studentIds);

          if (enrollments && enrollments.length > 0) {
            const fItem = fuzzy(nomeItem);
            
            // NOVA ABORDAGEM SÊNIOR: Filtro de Texto Obrigatório
            let matches = [];
            
            if (fItem) {
              matches = enrollments.filter(e => {
                const fp = fuzzy(e.plano);
                return fp && (fp === fItem || fItem.includes(fp) || fp.includes(fItem));
              });

              if (matches.length === 0) {
                matches = enrollments.filter(e => e.plano && searchInRow(row, e.plano));
              }

              // 3. Se ainda não achou, tenta por palavras-chave
              if (matches.length === 0) {
                const planKeywords = ['volei', 'xadrez', 'ballet', 'judo', 'tenis', 'futsal', 'basquete', 'teatro', 'robotica', 'funcional', 'dança', 'pickleball', 'programação', 'equipe', 'kids'];
                const foundKeyword = planKeywords.find(kw => fItem.includes(kw));
                if (foundKeyword) {
                  matches = enrollments.filter(e => {
                    const fp = fuzzy(e.plano);
                    return fp && fp.includes(foundKeyword);
                  });
                }
              }
            }

            if (matches.length > 0) {
              let bestMatch = null;
              
              const activeMatches = matches.filter(m => m.status === 'ativo' && !m.data_cancelamento);
              const candidates = activeMatches.length > 0 ? activeMatches : matches;

              if (candidates.length > 1) {
                // Se houver mapeamento de aluno, prioriza ele
                if (alunoMapped) {
                  bestMatch = candidates.find(m => {
                    const s = students.find(st => st.id === m.aluno_id);
                    return s && (fuzzy(s.nome).includes(fuzzy(alunoMapped)) || fuzzy(alunoMapped).includes(fuzzy(s.nome)));
                  });
                }

                if (!bestMatch) {
                  bestMatch = candidates.find(m => {
                    const s = students.find(st => st.id === m.aluno_id);
                    return s && searchStudentInRow(row, s.nome);
                  });
                }
              }

              if (!bestMatch) {
                bestMatch = candidates[0];
              }
              
              if (bestMatch) {
                matricula_id = bestMatch.id;
                aluno_id = bestMatch.aluno_id;
                const s = students.find(st => st.id === aluno_id);
                alunoNomeMatch = s ? s.nome : '';
                turmaMatch = bestMatch.turma || '';
              }
            } else {
              // Se o texto não bateu, vinculamos apenas o aluno se houver certeza, mas sem matrícula.
              let matchedStudent = null;
              if (alunoMapped) {
                matchedStudent = students.find(s => fuzzy(s.nome).includes(fuzzy(alunoMapped)) || fuzzy(alunoMapped).includes(fuzzy(s.nome)));
              }
              
              if (!matchedStudent) {
                matchedStudent = students.find(s => searchStudentInRow(row, s.nome));
              }

              if (matchedStudent) {
                aluno_id = matchedStudent.id;
                alunoNomeMatch = matchedStudent.nome;
              }
            }
          }
        }

        const updateData: any = {
          responsavel_id: responsavel.id,
          aluno_id,
          matricula_id,
          valor,
          status: statusSupabase,
          wix_email: email,
          wix_item_name: nomeItem,
          metodo_pagamento: getVal(row, ['Método de pagamento', 'Metodo', 'Payment Method']) || 'Wix'
        };

        if (dataPagamento) {
          updateData.created_at = dataPagamento;
        }

        if (existing) {
          // Atualiza registro existente que estava sem aluno
          const { error } = await supabase.from('pagamentos').update(updateData).eq('id', existing.id);
          if (error) throw error;
        } else {
          // Insere novo registro
          const { error } = await supabase.from('pagamentos').insert([{ ...updateData, wix_transaction_id: wixId }]);
          if (error) throw error;
        }
        
        results.success++;
        results.details.push({
          row: results.processed,
          item: nomeItem,
          aluno: alunoNomeMatch ? `${alunoNomeMatch}${turmaMatch ? ' (' + turmaMatch + ')' : ''}` : 'Não identificado'
        });
      } catch (err: any) {
        results.errors.push({ row: results.processed, error: err.message });
      }
    }
    res.json(results);
  });

  // Global API error handler
  app.use('/api', (err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('API Error:', err);
    res.status(err.status || 500).json({
      error: err.message || 'Internal Server Error',
      details: err.stack
    });
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
      });
      
      console.log('[Cron] Job de sincronização financeira agendado (1x por hora).');
    });
  }

  if (process.env.VERCEL !== "1") {
    startServer();
  }

export default app;
