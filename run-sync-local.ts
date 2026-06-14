import axios from 'axios';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const superNormalize = (t: any) => 
  String(t || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, '');

async function dispararAvisoFalhaWix(celular: string, nome: string) {
  try {
    console.log(`[Disparar] Enviar WhatsApp de aviso de falha para ${nome} (${celular})`);
  } catch (err: any) {
    console.error('[Cron] Falha ao disparar WhatsApp:', err.message);
  }
}

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
      .select('id, status_transacao, id_provedor_pagamento, aluno_id, cobranca_email, produto_nome, provedor_pagamento, data_pagamento_gmt_03, data_transacao_gmt_03, id_pedido')
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
      let processedCount = 0;
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

            // Rule 3: Only update if the status actually changed
            if (existing.status_transacao !== statusLabel) {
              const { error: updateErr } = await supabase
                .from('pagamentos_wix')
                .update({
                  status_transacao: statusLabel,
                  data_pagamento_gmt_03: cycleStartDate,
                  data_transacao_gmt_03: cycleStartDate,
                  aluno_id,
                  matricula_id,
                  turma_id
                })
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
        processedCount++;
        if (processedCount % 100 === 0) {
          console.log(`[Cron] Processado ${processedCount}/${orders.length} ordens.`);
        }
      }

      console.log(`[Cron] Sincronização do Wix (Site ID: ${siteId}) concluída com sucesso.`);
    } catch (error: any) {
      console.error(`[Cron] Erro geral na sincronização do Wix (Site ID: ${siteId}):`, error.response?.data || error.message);
    }
  }
}

syncWixRecurringPayments();
