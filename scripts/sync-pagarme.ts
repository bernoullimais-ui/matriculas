/**
 * Script de Conciliação Pagar.me
 * Busca invoices pagos e cria parcelas que não foram geradas no banco
 */
import * as dotenv from 'dotenv';
dotenv.config(); // Carrega o .env local (onde tem o Supabase Service Role)
dotenv.config({ path: '.env.production' }); // Carrega o Pagar.me Secret Key do Vercel
import { createClient } from '@supabase/supabase-js';
import axios from 'axios';

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const PAGARME_SECRET_KEY = process.env.PAGARME_SECRET_KEY;

if (!PAGARME_SECRET_KEY) {
  console.error("PAGARME_SECRET_KEY is not defined in environment variables.");
  process.exit(1);
}
const authHeader = Buffer.from(`${PAGARME_SECRET_KEY}:`).toString('base64');

const superNormalize = (t: any) => 
  String(t || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, '');

async function syncInvoices() {
  console.log('🔄 Iniciando conciliação de faturas Pagar.me...');
  
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
  
  while (true) {
    try {
      console.log(`\nBuscando página ${page} de faturas Pagar.me...`);
      const response = await axios.get(`https://api.pagar.me/core/v5/invoices?status=paid&page=${page}&size=50`, {
        headers: { 'Authorization': `Basic ${authHeader}` }
      });
      
      const invoices = response.data.data;
      if (!invoices || invoices.length === 0) {
        break; // Fim das faturas
      }
      
      for (const invoice of invoices) {
        totalProcessed++;
        const invoiceId = invoice.id; // in_XXXXX
        const subscriptionId = invoice.subscription?.id || invoice.subscription_id || (invoice.subscription ? invoice.subscription.id : null);
        
        if (!subscriptionId) {
          totalIgnored++;
          continue; // Não é fatura de assinatura
        }
        
        // Verifica se essa fatura já virou uma parcela no nosso banco
        if (existingPaymentsSet.has(invoiceId)) {
          totalIgnored++;
          process.stdout.write(`  ⏭  Fatura ${invoiceId} já existe no banco.\r`);
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
          // Vamos tentar parsear o nome do aluno e da turma a partir do item da fatura
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
                
                // Buscar matriculas ativas que contenham o nome da turma/plano
                let targetMat = studentMatriculas.find((m: any) => {
                  const normTurmaOrPlano = superNormalize(m.plano || m.turma || '');
                  return normTurmaOrPlano.includes(normParsedClass) || normParsedClass.includes(normTurmaOrPlano);
                });
                
                // Fallback: se não achar, pegar qualquer matrícula ativa
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
                  console.log(`\n🩹 [AUTO-HEAL] Associando assinatura ${subscriptionId} à matrícula ${matriculaId} (Aluno: ${matchedStudent.nome_completo}, Turma: ${parsedClassName})`);
                  
                  const { error: healErr } = await supabase
                    .from('matriculas')
                    .update({ pagarme_subscription_id: subscriptionId })
                    .eq('id', matriculaId);
                    
                  if (healErr) {
                    console.error(`  ❌ Erro ao salvar auto-cura no banco:`, healErr.message);
                  } else {
                    // Atualizar caches locais em memória
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
          console.log(`\n  ❌ Fatura ${invoiceId}: Matrícula não encontrada para a assinatura ${subscriptionId}.`);
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
          console.log(`\n  ❌ Fatura ${invoiceId}: Erro ao inserir no banco: ${insertError.message}`);
        } else {
          totalCreated++;
          existingPaymentsSet.add(invoiceId);
          console.log(`\n  ✅ Fatura ${invoiceId} sincronizada com sucesso! (R$ ${valorReal})`);
        }
      }
      
      page++;
      
      // Safety limit para não buscar infinitamente se algo der errado (20 páginas = 1000 faturas)
      if (page > 20) break; 
      
    } catch (err: any) {
      console.error('\nErro na API Pagar.me:', err.response?.data || err.message);
      break;
    }
  }
  
  console.log('\n\n──────────────────────────────────────────');
  console.log('📊 RELATÓRIO DE CONCILIAÇÃO:');
  console.log(`   Faturas analisadas : ${totalProcessed}`);
  console.log(`   ✅ Novas criadas   : ${totalCreated}`);
  console.log(`   ⏭  Já existiam    : ${totalIgnored}`);
  console.log('──────────────────────────────────────────');
}

syncInvoices();
