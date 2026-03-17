import express from "express";
import * as path from "path";
import { fileURLToPath } from "url";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as util from "util";
import PDFDocument from 'pdfkit';
import axios from "axios";

// Handle __dirname and __filename for both ESM and CJS environments
const currentDirname = process.cwd();

dotenv.config();

// Initialize local SQLite for settings (Deprecated, moving to Supabase)
// const localDb = new Database("settings.db");
// localDb.exec("CREATE TABLE IF NOT EXISTS configuracoes (chave TEXT PRIMARY KEY, valor TEXT)");

const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || "";

let supabase: SupabaseClient<any, "public", any>;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("CRITICAL: Supabase URL or Anon Key is missing in environment variables!");
  // Initialize with dummy values to prevent crash, but warn the user
  supabase = createClient("https://dummy.supabase.co", "dummy-key");
} else {
  supabase = createClient(supabaseUrl, supabaseAnonKey);
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
          statement_descriptor: data.softDescriptor || "SPORTFORKIDS",
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
    statement_descriptor: data.softDescriptor || "SPORTFORKIDS",
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
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// API Routes
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
      console.error("Error fetching guardian:", JSON.stringify(error, null, 2));
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
        console.error("Error registering guardian:", JSON.stringify(error, null, 2));
        return res.status(400).json({ error: error.message, details: error });
      }

      res.json({ success: true, guardian: data });
    } catch (error: any) {
      console.error("Internal error registering guardian:", JSON.stringify(error, null, 2));
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/guardian/recover-password", async (req, res) => {
    const { cpf } = req.body;
    try {
      const { data, error } = await supabase
        .from('responsaveis')
        .select('nome_completo, telefone, senha')
        .eq('cpf', cpf)
        .maybeSingle();

      if (error) throw error;
      
      if (!data) {
        return res.status(404).json({ error: "Responsável não encontrado" });
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

  app.post("/api/enroll", async (req, res) => {
    const { guardian, student, paymentMethod, couponId } = req.body;
    
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
        metodo_pagamento: 'cartao_credito',
        status: 'pendente',
        data_vencimento: todayStr
      };

      if (matriculaId) {
        firstPayment.matricula_id = matriculaId;
      }
      
      installments.push(firstPayment);

      if (inicioAulas && fimAulas) {
        const baseDay = inicioAulas.getDate();
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
          let valorParcela = valorCobrado;
          
          // Check if this is the last installment
          // Rule: "a ultima parcela do ano desse cliente deve ser proporciona(preço) do seu vencimento (02/dez) a data final (10/dez)"
          const nextCycleDate = new Date(nextVencimento);
          nextCycleDate.setMonth(nextCycleDate.getMonth() + 1);
          nextCycleDate.setDate(baseDay);
          
          if (nextCycleDate > fimAulas) {
            // Proportional calculation
            const diffTime = fimAulas.getTime() - nextVencimento.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            valorParcela = (valorCobrado / 30) * Math.max(0, diffDays);
          }

          const installment: any = {
            responsavel_id: guardianId,
            aluno_id: alunoId,
            valor: Number(valorParcela.toFixed(2)),
            metodo_pagamento: 'cartao_credito',
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
        const softDescriptor = (student.unidade || "").includes("Bernoulli") ? "BernoulliMais" : "Sport for Kids";
        
        try {
          if (paymentMethod === 'credit_card' && req.body.card) {
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
                softDescriptor
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
                softDescriptor
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
                softDescriptor
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
          } else {
            console.log(`Creating Pagar.me order for ${guardian.name}, amount: ${valorCobrado}`);
            const order = await createPagarmeOrder({
              customer: {
                name: guardian.name,
                email: guardian.email,
                cpf: guardian.cpf,
                phone: guardian.phone,
                address: guardian.address
              },
              card: req.body.card,
              amount: Math.round(valorCobrado * 100), // convert to cents
              paymentMethod: 'credit_card',
              description: `Matrícula - ${student.name} (${student.turmaComplementar})`,
              code: firstPaymentId ? `${firstPaymentId}_${Date.now()}` : `enroll_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
              softDescriptor
            });
            paymentInfo = order;
            console.log("Pagar.me order created successfully");
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
        supabase.from('matriculas').select('turma').is('data_cancelamento', null)
      ]);

      if (turmas.error) console.error("Error fetching turmas:", turmas.error);
      console.log(`Fetched ${turmas.data?.length || 0} turmas from turmas_complementares`);
      if (turmas.data && turmas.data.length > 0) {
        console.log("Sample turma:", turmas.data[0]);
      }

      // Count active enrollments per class
      const occupancyMap: { [key: string]: number } = {};
      matriculas.data?.forEach(m => {
        if (m.turma) {
          occupancyMap[m.turma] = (occupancyMap[m.turma] || 0) + 1;
        }
      });

      res.json({
        series: series.data?.map(s => s.nome) || [],
        unidades: unidades.data?.map(u => u.nome) || [],
        turmas: turmas.data?.map(t => ({
          ...t,
          ocupacao_atual: occupancyMap[t.nome] || 0
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
      professor
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
          ...(professor !== undefined ? { professor } : {})
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
      professor
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
          ...(professor !== undefined ? { professor } : {})
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

  app.post("/api/enrollment/cancel", async (req, res) => {
    const { enrollmentId, cancellationDate, justificativa } = req.body;
    try {
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

      // 2. Fidelity Discount Reversion Logic
      // If one enrollment is cancelled and only one remains, the next payment loses the discount
      const { data: enrollmentData } = await supabase
        .from('matriculas')
        .select('aluno_id')
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
            const msg = `Olá ${guardianData.nome_completo}! Confirmamos o cancelamento da matrícula de ${studentData.nome_completo}. Os débitos mensais referentes a esta matrícula foram cessados. Agradecemos o tempo que estiveram conosco!`;
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
        supabase.from('matriculas').select('id, aluno_id, turma, unidade, status, data_cancelamento'),
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
      const { error: wError } = await supabase
        .from('lista_espera')
        .insert([{
          aluno_id: alunoId,
          responsavel_id: guardianId,
          unidade: student.unidade,
          turma: student.turmaComplementar,
          status: 'aguardando'
        }]);

      if (wError) throw wError;

      res.json({ success: true });
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

      if (pRes.error) { console.error("Pagamentos Fetch Error:", pRes.error); throw new Error(`Pagamentos: ${pRes.error.message || JSON.stringify(pRes.error)}`); }
      if (rRes.error) { console.error("Responsaveis Fetch Error:", rRes.error); throw new Error(`Responsaveis: ${rRes.error.message || JSON.stringify(rRes.error)}`); }
      if (aRes.error) { console.error("Alunos Fetch Error:", aRes.error); throw new Error(`Alunos: ${aRes.error.message || JSON.stringify(aRes.error)}`); }
      if (mRes.error) { console.error("Matriculas Fetch Error:", mRes.error); throw new Error(`Matriculas: ${mRes.error.message || JSON.stringify(mRes.error)}`); }
      if (tRes.error) { console.error("Turmas Fetch Error:", tRes.error); throw new Error(`Turmas: ${tRes.error.message || JSON.stringify(tRes.error)}`); }

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
      }

      console.log(`[Sync] O pedido ${paymentId} ainda está com status: ${order.status}`);
      res.json({ status: order.status, updated: false });
    } catch (error: any) {
      console.error('[Sync] Erro ao sincronizar pagamento:', error.response?.data || error.message);
      res.status(500).json({ error: 'Erro ao sincronizar com Pagar.me' });
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
        event.type === 'invoice.paid' ||
        event.type === 'subscription.created' ||
        event.type === 'subscription.updated'
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
            
          const isFailed = event.type === 'order.payment_failed';
          
          if (!isPaid && !isFailed) {
            console.log(`[Webhook Pagar.me] Evento ignorado (não é pago nem falha). Status: ${data.status}`);
            return res.status(200).json({ received: true });
          }

          const status = isPaid ? 'pago' : 'falha';

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
                .select('status')
                .eq('id', paymentData.matricula_id)
                .single();

              if (matricula && matricula.status === 'pendente') {
                console.log(`[Webhook Pagar.me] Ativando matrícula ${paymentData.matricula_id}...`);
                
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
                  .select('nome_completo, telefone, email')
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
                    await sendWhatsAppMessage(
                      guardian.telefone,
                      guardian.nome_completo,
                      `Olá ${guardian.nome_completo}! Recebemos a confirmação do seu pagamento de matrícula. A matrícula de ${student?.nome_completo || 'seu filho(a)'} foi ativada com sucesso. Seja bem-vindo à Sport for Kids!`
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
                      termsText = termsText.replace(/{{NOME_RESPONSAVEL}}/g, guardian.nome_completo);
                      if (student) {
                        termsText = termsText.replace(/{{NOME_ALUNO}}/g, student.nome_completo);
                        termsText = termsText.replace(/{{TURMA}}/g, student.turma_complementar || "");
                        termsText = termsText.replace(/{{UNIDADE}}/g, student.unidade || "");
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
              .select('matricula_id')
              .eq('id', targetPaymentId)
              .single();

            if (paymentData && paymentData.matricula_id) {
              const { data: matricula } = await supabase
                .from('matriculas')
                .select('status')
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
    });
  }

  if (process.env.VERCEL !== "1") {
    startServer();
  }

export default app;
