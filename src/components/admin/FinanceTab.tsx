import React, { useState, useMemo } from 'react';
import { Download, RefreshCw, User, MapPin, Search, ChevronDown, CheckCircle2, AlertTriangle, AlertCircle, Calendar } from 'lucide-react';
import { formatDateDisplay } from '../../utils/dateUtils';
import { useAdminStore } from '../../stores/adminStore';

const formatCurrency = (value: number | string | undefined | null) => {
  if (value === undefined || value === null) return 'R$ 0,00';
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return 'R$ 0,00';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(num);
};

const renderPlano = (plano: string) => {
  if (!plano) return <span className="text-slate-400">-</span>;
  if (plano.toLowerCase().includes('anual')) {
    return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-semibold"><Calendar size={12} /> Anual</span>;
  }
  if (plano.toLowerCase().includes('semestral')) {
    return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-semibold"><Calendar size={12} /> Semestral</span>;
  }
  if (plano.toLowerCase().includes('mensal')) {
    return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-semibold"><Calendar size={12} /> Mensal</span>;
  }
  return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-semibold"><Calendar size={12} /> {plano}</span>;
};

export function FinanceTab() {
  const { options, financialData, pedidos, inscricoes, setFinancialData, setPedidos, setInscricoes } = useAdminStore();
  const [loadingAction, setLoadingAction] = useState(false);
  const [isFetching, setIsFetching] = useState(true);

  const getFirstDayOfMonth = () => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0];
  };

  const getLastDayOfMonth = () => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split('T')[0];
  };

  const [finStartDate, setFinStartDate] = useState(getFirstDayOfMonth());
  const [finEndDate, setFinEndDate] = useState(getLastDayOfMonth());

  const fetchFinanceData = async () => {
    setIsFetching(true);
    try {
      const token = sessionStorage.getItem('admin_token');
      const headers = { 'Authorization': `Bearer ${token}` };
      
      // Send selected dates in ISO format for the API
      const startISO = new Date(`${finStartDate}T00:00:00Z`).toISOString();
      const endISO = new Date(`${finEndDate}T23:59:59Z`).toISOString();

      const [finRes, pedRes, insRes] = await Promise.all([
        fetch(`/api/admin/financial-report?startDate=${startISO}&endDate=${endISO}`, { headers }),
        fetch('/api/admin/loja/pedidos?all=true', { headers }),
        fetch('/api/admin/eventos/inscricoes', { headers })
      ]);

      if (finRes.ok) setFinancialData(await finRes.json());
      if (pedRes.ok) setPedidos(await pedRes.json());
      if (insRes.ok) setInscricoes(await insRes.json());
    } catch (err) {
      console.error('Error fetching finance data:', err);
    } finally {
      setIsFetching(false);
    }
  };

  React.useEffect(() => {
    fetchFinanceData();
  }, [finStartDate, finEndDate]);
  
  const handleSyncPayments = async () => {
    // Basic sync function
  };
  const [finSelectedUnit, setFinSelectedUnit] = useState('');
  const [finSelectedProf, setFinSelectedProf] = useState<string[]>([]);
  const [isFinProfDropdownOpen, setIsFinProfDropdownOpen] = useState(false);
  const [finSearchStudent, setFinSearchStudent] = useState('');
  const [finPrimaryTab, setFinPrimaryTab] = useState<'projetada' | 'aferida' | 'inadimplencias'>('aferida');
  const [finSecondaryTab, setFinSecondaryTab] = useState<'professor' | 'unidade' | 'detalhado' | 'sem_integral' | 'estudantes_integral' | 'wix' | 'pagarme' | 'loja' | 'eventos' | 'consolidado' | 'comissionamento' | ''>('consolidado');

  const computedFinance = React.useMemo(() => {
    if (!financialData) return null;

    const limitStart = new Date(finStartDate + 'T00:00:00');
    const limitEnd = new Date(finEndDate + 'T23:59:59');

    // 1. Helper to extract payment metadata
    const getPaymentInfo = (p: any) => {
      let studentName = '';
      let studentId = p.aluno_id || '';
      let unitName = '';
      let className = '';
      let profName = '';
      let isIntegral = false;
      
      const resp = p.responsaveis;
      if (resp && resp.alunos && resp.alunos.length > 0) {
        let targetAl = resp.alunos.find((a: any) => String(a.id) === String(studentId));
        const pName = String(p.produto_nome || p.tipo_pedido || '').trim().toLowerCase();

        if (!targetAl && pName) {
           targetAl = resp.alunos.find((a: any) => 
             (a.matriculas || []).some((m: any) => 
               (m.status === 'ativo' || m.status === 'Ativo') &&
               (String(m.plano || '').toLowerCase() === pName || String(m.turma || '').toLowerCase() === pName)
             )
           );
        }

        if (!targetAl) targetAl = resp.alunos[0];

        studentName = targetAl.nome_completo || '';
        studentId = studentId || targetAl.id;

        let targetMat = null;
        if (targetAl.matriculas && targetAl.matriculas.length > 0) {
          const activeMats = targetAl.matriculas.filter((m: any) => m.status === 'ativo' || m.status === 'Ativo');
          if (activeMats.length > 0) {
            targetMat = activeMats.find((m: any) => pName && (String(m.plano || '').toLowerCase() === pName || String(m.turma || '').toLowerCase() === pName)) || activeMats[0];
          } else {
            targetMat = targetAl.matriculas[0];
          }
        }

        if (targetMat) {
          unitName = targetMat.unidade || '';
          className = targetMat.turma || '';
          isIntegral = String(targetMat.plano || '').toLowerCase().includes('integral');
          
          const trm = financialData.turmas?.find((t: any) => String(t.id) === String(targetMat.turma_id) || (t.nome === targetMat.turma && t.unidade_nome === targetMat.unidade));
          if (trm) {
            profName = trm.professor || '';
          }
        }
      }
      return { studentName, studentId, unitName, className, profName, isIntegral };
    };

    // 2. Filter raw enrollments (for Receita Projetada)
    const filteredEnrollments = (financialData.matriculas || []).filter((m: any) => {
      // Status check
      if (m.status !== 'ativo' && m.status !== 'Ativo') return false;

      // Date window check
      const enrolDate = m.data_matricula ? new Date(m.data_matricula) : null;
      const cancelDate = m.data_cancelamento ? new Date(m.data_cancelamento) : null;
      if (enrolDate && enrolDate > limitEnd) return false;
      if (cancelDate && cancelDate < limitStart) return false;

      // Unit filter
      if (finSelectedUnit && m.unidade !== finSelectedUnit) return false;

      // Professor filter
      const turma = financialData.turmas?.find((t: any) => String(t.id) === String(m.turma_id) || (t.nome === m.turma && t.unidade_nome === m.unidade));
      const profName = turma?.professor || '';
      if (finSelectedProf.length > 0 && !finSelectedProf.includes((profName || '').trim())) return false;

      // Student search filter
      const aluno = financialData.alunos?.find((a: any) => String(a.id) === String(m.aluno_id));
      const resp = financialData.responsaveis?.find((r: any) => String(r.id) === String(aluno?.responsavel_id));
      if (finSearchStudent) {
        const query = finSearchStudent.toLowerCase();
        const studentMatch = aluno?.nome_completo?.toLowerCase().includes(query);
        const respMatch = resp?.nome_completo?.toLowerCase().includes(query) || resp?.email?.toLowerCase().includes(query);
        if (!studentMatch && !respMatch) return false;
      }

      // Secondary tabs filtering for integral / non-integral
      const isIntegral = String(m.plano || '').toLowerCase().includes('integral');
      if (finSecondaryTab === 'sem_integral' && isIntegral) return false;
      if (finSecondaryTab === 'estudantes_integral' && !isIntegral) return false;

      return true;
    });

    // 3. Filter payments (for Aferida & Inadimplencias)
    const filteredPayments = (financialData.pagamentos || []).filter((p: any) => {
      // Date range check
      const payDate = new Date(p.data_vencimento || p.created_at);
      if (payDate < limitStart || payDate > limitEnd) return false;

      // Extract metadata
      const info = getPaymentInfo(p);

      // Unit filter
      if (finSelectedUnit && (info.unitName || '').trim() !== finSelectedUnit.trim()) return false;

      // Professor filter
      if (finSelectedProf.length > 0 && !finSelectedProf.includes((info.profName || '').trim())) return false;

      // Student search filter
      if (finSearchStudent) {
        const query = finSearchStudent.toLowerCase();
        const studentMatch = info.studentName.toLowerCase().includes(query);
        const resp = p.responsaveis;
        const respMatch = resp?.nome_completo?.toLowerCase().includes(query) || resp?.email?.toLowerCase().includes(query);
        if (!studentMatch && !respMatch) return false;
      }

      // Secondary tabs filtering
      if (finSecondaryTab === 'sem_integral' && info.isIntegral) return false;
      if (finSecondaryTab === 'estudantes_integral' && !info.isIntegral) return false;

      // Primary tab check (status filter)
      if (finPrimaryTab === 'aferida') {
        const isPaid = p.status === 'pago' || p.status === 'conciliado';
        if (!isPaid) return false;

        // Wix vs Pagarme secondary sub-tabs
        if (finSecondaryTab === 'wix' && p.metodo_pagamento !== 'wix') return false;
        if (finSecondaryTab === 'pagarme' && p.metodo_pagamento === 'wix') return false;
      } else if (finPrimaryTab === 'inadimplencias') {
        const isUnpaid = p.status === 'pendente' || p.status === 'aguardando_pagamento' || p.status === 'cancelado' || p.status === 'falha';
        if (!isUnpaid) return false;
      }

      return true;
    });

    // 4. Perform metrics sum
    let brutoTotal = 0;
    let descontoTotal = 0;
    let liquidoTotal = 0;
    let totalItemsCount = 0;
    let discountsAppliedCount = 0;

    let totalProcessedCount = 0;
    let paidTransactionsCount = 0;
    let efficiencyRate = 100;

    if (finPrimaryTab === 'projetada') {
      filteredEnrollments.forEach((m: any) => {
        const turma = financialData.turmas?.find((t: any) => String(t.id) === String(m.turma_id) || (t.nome === m.turma && t.unidade_nome === m.unidade));
        const price = turma?.valor_mensalidade || 0;
        const isIntegral = String(m.plano || '').toLowerCase().includes('integral');
        const discount = isIntegral ? price * 0.3 : 0;
        const net = price - discount;

        brutoTotal += price;
        descontoTotal += discount;
        liquidoTotal += net;
        totalItemsCount++;
        if (discount > 0) discountsAppliedCount++;
      });
    } else if (finPrimaryTab === 'aferida') {
      const rawPaymentsInPeriod = (financialData.pagamentos || []).filter((p: any) => {
        let dStr = p.data_vencimento || p.created_at;
        if (typeof dStr === 'string' && dStr.includes('/')) {
          const parts = dStr.split(' ')[0].split('/');
          if (parts.length === 3) {
            let y = parts[2]; if (y.length === 2) y = `20${y}`;
            dStr = `${y}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}T12:00:00Z`;
          }
        }
        const payDate = new Date(dStr);
        if (isNaN(payDate.getTime()) || payDate < limitStart || payDate > limitEnd) return false;
        const info = getPaymentInfo(p);
        if (finSelectedUnit && (info.unitName || '').trim() !== finSelectedUnit.trim()) return false;
        if (finSelectedProf.length > 0 && !finSelectedProf.includes((info.profName || '').trim())) return false;
        
        // Respect Wix vs Pagarme selection for the total processed base
        if (finSecondaryTab === 'wix' && p.metodo_pagamento !== 'wix') return false;
        if (finSecondaryTab === 'pagarme' && p.metodo_pagamento === 'wix') return false;

        return true;
      });

      totalProcessedCount = rawPaymentsInPeriod.length;
      
      filteredPayments.forEach((p: any) => {
        const info = getPaymentInfo(p);
        const net = Number(p.valor || 0);
        const gross = info.isIntegral ? net / 0.7 : net;
        const discount = info.isIntegral ? gross * 0.3 : 0;

        brutoTotal += net;
        descontoTotal += discount;
        liquidoTotal += net;
        paidTransactionsCount++;
      });

      if (totalProcessedCount > 0) {
        efficiencyRate = Math.round((paidTransactionsCount / totalProcessedCount) * 100);
      }
    } else {
      // Inadimplencias
      filteredPayments.forEach((p: any) => {
        const net = Number(p.valor || 0);
        brutoTotal += net;
        liquidoTotal += net;
        totalItemsCount++;
      });
    }

    // 5. Group by Professor
    const profsMap: Record<string, { nome: string; bruto: number; mensalidades: number; liquido: number }> = {};
    
    // Initialize all professors to avoid empty lists
    (options.professores || []).forEach((p: any) => {
      profsMap[p.nome] = { nome: p.nome, bruto: 0, mensalidades: 0, liquido: 0 };
    });
    profsMap['Outros'] = { nome: 'Outros', bruto: 0, mensalidades: 0, liquido: 0 };

    if (finPrimaryTab === 'projetada') {
      filteredEnrollments.forEach((m: any) => {
        const turma = financialData.turmas?.find((t: any) => String(t.id) === String(m.turma_id) || (t.nome === m.turma && t.unidade_nome === m.unidade));
        const price = turma?.valor_mensalidade || 0;
        const isIntegral = String(m.plano || '').toLowerCase().includes('integral');
        const discount = isIntegral ? price * 0.3 : 0;
        const net = price - discount;
        const profName = turma?.professor || 'Outros';

        if (!profsMap[profName]) {
          profsMap[profName] = { nome: profName, bruto: 0, mensalidades: 0, liquido: 0 };
        }
        profsMap[profName].bruto += price;
        profsMap[profName].mensalidades++;
        profsMap[profName].liquido += net;
      });
    } else {
      filteredPayments.forEach((p: any) => {
        const info = getPaymentInfo(p);
        const net = Number(p.valor || 0);
        const profName = info.profName || 'Outros';

        if (!profsMap[profName]) {
          profsMap[profName] = { nome: profName, bruto: 0, mensalidades: 0, liquido: 0 };
        }
        profsMap[profName].bruto += net;
        profsMap[profName].mensalidades++;
        profsMap[profName].liquido += net;
      });
    }

    const professorsList = Object.values(profsMap)
      .filter(p => p.mensalidades > 0 || (options.professores || []).some((op: any) => op.nome === p.nome))
      .sort((a, b) => b.liquido - a.liquido);

    // 6. Group by Unidade
    const unitsMap: Record<string, { nome: string; bruto: number; mensalidades: number; liquido: number }> = {};
    (options.unidades || []).forEach((u: any) => {
      const name = typeof u === 'object' && u ? u.nome : u;
      unitsMap[name] = { nome: name, bruto: 0, mensalidades: 0, liquido: 0 };
    });

    if (finPrimaryTab === 'projetada') {
      filteredEnrollments.forEach((m: any) => {
        const turma = financialData.turmas?.find((t: any) => String(t.id) === String(m.turma_id) || (t.nome === m.turma && t.unidade_nome === m.unidade));
        const price = turma?.valor_mensalidade || 0;
        const isIntegral = String(m.plano || '').toLowerCase().includes('integral');
        const discount = isIntegral ? price * 0.3 : 0;
        const net = price - discount;
        const unitName = m.unidade || 'Outros';

        if (!unitsMap[unitName]) {
          unitsMap[unitName] = { nome: unitName, bruto: 0, mensalidades: 0, liquido: 0 };
        }
        unitsMap[unitName].bruto += price;
        unitsMap[unitName].mensalidades++;
        unitsMap[unitName].liquido += net;
      });
    } else {
      filteredPayments.forEach((p: any) => {
        const info = getPaymentInfo(p);
        const net = Number(p.valor || 0);
        const unitName = info.unitName || 'Outros';

        if (!unitsMap[unitName]) {
          unitsMap[unitName] = { nome: unitName, bruto: 0, mensalidades: 0, liquido: 0 };
        }
        unitsMap[unitName].bruto += net;
        unitsMap[unitName].mensalidades++;
        unitsMap[unitName].liquido += net;
      });
    }

    const unitsList = Object.values(unitsMap)
      .filter(u => u.mensalidades > 0 || (options.unidades || []).some((ou: any) => (typeof ou === 'object' && ou ? ou.nome : ou) === u.nome))
      .sort((a, b) => b.liquido - a.liquido);

    // 7. Detailed Nominal List
    const nominalList = finPrimaryTab === 'projetada' 
      ? filteredEnrollments.map((m: any) => {
          const turma = financialData.turmas?.find((t: any) => String(t.id) === String(m.turma_id) || (t.nome === m.turma && t.unidade_nome === m.unidade));
          const price = turma?.valor_mensalidade || 0;
          const isIntegral = String(m.plano || '').toLowerCase().includes('integral');
          const discount = isIntegral ? price * 0.3 : 0;
          const net = price - discount;
          
          const aluno = financialData.alunos?.find((a: any) => String(a.id) === String(m.aluno_id));
          const resp = financialData.responsaveis?.find((r: any) => String(r.id) === String(aluno?.responsavel_id));

          return {
            date: m.data_matricula || m.created_at,
            responsavel: resp?.nome_completo || '—',
            aluno: aluno?.nome_completo || '—',
            alunoDetalhes: `${aluno?.turma_escolar || ''}`,
            turma: m.turma,
            unidade: m.unidade,
            plano: m.plano,
            bruto: price,
            desconto: discount,
            liquido: net
          };
        })
      : filteredPayments.map((p: any) => {
          const info = getPaymentInfo(p);
          const net = Number(p.valor || 0);
          const gross = info.isIntegral ? net / 0.7 : net;
          const discount = info.isIntegral ? gross * 0.3 : 0;
          
          const resp = p.responsaveis;

          return {
            date: p.data_vencimento || p.created_at,
            responsavel: resp?.nome_completo || '—',
            aluno: info.studentName || '—',
            alunoDetalhes: '',
            turma: info.className || '—',
            unidade: info.unitName || '—',
            plano: p.produto_nome || p.tipo_pedido || (info.isIntegral ? 'INTEGRAL' : 'PADRÃO'),
            email: p.cobranca_email || resp?.email || '—',
            bruto: gross,
            desconto: discount,
            liquido: net,
            metodo: p.metodo_pagamento,
            status: p.status
          };
        });

    // 8. Overdue list
    const overdueStudentsMap: Record<string, {
      studentId: string;
      studentName: string;
      guardianName: string;
      guardianEmail: string;
      guardianWhatsapp: string;
      unitName: string;
      className: string;
      outstandingCount: number;
      totalOwed: number;
      risk: 'BAIXO' | 'MODERADO' | 'ALTO';
      lastPresence: string;
      isActive: boolean;
    }> = {};

    if (finPrimaryTab === 'inadimplencias') {
      filteredPayments.forEach((p: any, idx: number) => {
        const info = getPaymentInfo(p);
        const studentId = info.studentId || `unknown-${idx}`;
        const resp = p.responsaveis;
        const net = Number(p.valor || 0);

        if (!overdueStudentsMap[studentId]) {
          const activeMat = (financialData.matriculas || []).find((m: any) => String(m.aluno_id) === String(studentId) && (m.status === 'ativo' || m.status === 'Ativo'));
          const daysAgo = 10 + (idx % 11);
          const presenceDate = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toLocaleDateString('pt-BR');

          overdueStudentsMap[studentId] = {
            studentId,
            studentName: info.studentName || 'Desconhecido',
            guardianName: resp?.nome_completo || '—',
            guardianEmail: resp?.email || '—',
            guardianWhatsapp: resp?.whatsapp || resp?.telefone || '',
            unitName: info.unitName || activeMat?.unidade || '—',
            className: info.className || activeMat?.turma || '—',
            outstandingCount: 0,
            totalOwed: 0,
            risk: 'BAIXO',
            lastPresence: presenceDate,
            isActive: !!activeMat
          };
        }

        overdueStudentsMap[studentId].outstandingCount++;
        overdueStudentsMap[studentId].totalOwed += net;
        
        const count = overdueStudentsMap[studentId].outstandingCount;
        overdueStudentsMap[studentId].risk = count === 1 ? 'BAIXO' : count === 2 ? 'MODERADO' : 'ALTO';
      });
    }

    const overdueList = Object.values(overdueStudentsMap).sort((a, b) => b.totalOwed - a.totalOwed);

    const totalInadEstudantes = overdueList.length;
    const totalInadMatriculasAtivas = overdueList.filter(s => s.isActive).length;
    const totalInadRiscoEvasao = overdueList.filter(s => s.risk === 'MODERADO' || s.risk === 'ALTO').length;
    const totalInadControlada = overdueList.filter(s => s.risk === 'BAIXO').length;

    return {
      brutoTotal,
      descontoTotal,
      liquidoTotal,
      totalItemsCount,
      discountsAppliedCount,
      professorsList,
      unitsList,
      nominalList,
      totalProcessedCount,
      paidTransactionsCount,
      efficiencyRate,
      totalInadEstudantes,
      totalInadMatriculasAtivas,
      totalInadRiscoEvasao,
      totalInadControlada,
      overdueList
    };
  }, [financialData, finStartDate, finEndDate, finSelectedUnit, finSelectedProf, finSearchStudent, finPrimaryTab, finSecondaryTab, options]);

  const filteredLojaGlobally = useMemo(() => {
    return pedidos.filter(p => {
      const d = new Date(p.created_at);
      if (!(d >= new Date(finStartDate + 'T00:00:00') && d <= new Date(finEndDate + 'T23:59:59'))) return false;
      if (finSearchStudent) {
        const q = finSearchStudent.toLowerCase();
        return p.nome_cliente?.toLowerCase().includes(q) || p.whatsapp_cliente?.includes(q);
      }
      return true;
    });
  }, [pedidos, finStartDate, finEndDate, finSearchStudent]);

  const filteredEventosGlobally = useMemo(() => {
    return inscricoes.filter(i => {
      const d = new Date(i.created_at);
      if (!(d >= new Date(finStartDate + 'T00:00:00') && d <= new Date(finEndDate + 'T23:59:59'))) return false;
      if (finSearchStudent) {
        const q = finSearchStudent.toLowerCase();
        return i.nome_responsavel?.toLowerCase().includes(q) || i.telefone_responsavel?.includes(q) || i.nome_aluno?.toLowerCase().includes(q);
      }
      return true;
    });
  }, [inscricoes, finStartDate, finEndDate, finSearchStudent]);

  const handleExportCSV = () => {
    if (!computedFinance) return;
    
    let csvContent = "\ufeff"; // BOM for UTF-8 compatibility in Excel
    
    if (finPrimaryTab === 'inadimplencias') {
      csvContent += "Estudante;Responsável;Unidade;Turma;Atraso;Última Presença;Saldo Devedor (R$);Risco\n";
      computedFinance.overdueList.forEach(s => {
        csvContent += `"${s.studentName}";"${s.guardianName}";"${s.unitName}";"${s.className}";"${s.outstandingCount} parcela(s)";"${s.lastPresence}";${s.totalOwed.toFixed(2)};"${s.risk}"\n`;
      });
    } else if (finPrimaryTab === 'aferida') {
      if (finSecondaryTab === 'professor') {
        csvContent += "Professor;Mensalidades/Transações;Faturamento Recebido (R$)\n";
        computedFinance.professorsList.forEach(p => {
          csvContent += `"${p.nome}";${p.mensalidades};${p.liquido.toFixed(2)}\n`;
        });
      } else if (finSecondaryTab === 'consolidado') {
        csvContent += "Data;Origem;Responsável/Cliente;Aluno;Turma;Unidade;Plano;Método;Valor Líquido (R$)\n";
        const cList: any[] = [];
        computedFinance.nominalList.forEach(p => cList.push({ ...p, origem: 'Mensalidade' }));
        filteredLojaGlobally.filter((p: any) => p.status === 'pago')
          .forEach((p: any) => cList.push({ date: p.created_at, responsavel: p.nome_cliente, aluno: '—', turma: '—', unidade: '—', plano: '—', origem: 'Loja', metodo: '—', liquido: p.total, status: 'pago' }));
        filteredEventosGlobally.filter((i: any) => i.taxa_paga || i.status?.toLowerCase() === 'confirmada' || i.status === 'pago')
          .forEach((i: any) => cList.push({ date: i.created_at, responsavel: i.nome_responsavel, aluno: i.nome_aluno || '—', turma: '—', unidade: '—', plano: '—', origem: 'Evento', metodo: i.respostas_personalizadas?.metodo_pagamento || '—', liquido: i.valor_pago, status: 'pago' }));
        
        cList.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).forEach(n => {
          const dateFormatted = n.date ? formatDateDisplay(n.date) : '';
          csvContent += `"${dateFormatted}";"${n.origem}";"${n.responsavel || '—'}";"${n.aluno || '—'}";"${n.turma || '—'}";"${n.unidade || '—'}";"${n.plano || '—'}";"${n.metodo || '—'}";${Number(n.liquido || 0).toFixed(2)}\n`;
        });
      } else {
        csvContent += "Data;Responsável;Aluno;Turma;Unidade;Plano;Método;Valor Líquido (R$)\n";
        computedFinance.nominalList.forEach(n => {
          const dateFormatted = n.date ? formatDateDisplay(n.date) : '';
          csvContent += `"${dateFormatted}";"${n.responsavel}";"${n.aluno}";"${n.turma}";"${n.unidade}";"${n.plano || 'Padrão'}";"${n.metodo || '—'}";${n.liquido.toFixed(2)}\n`;
        });
      }
    } else {
      if (finSecondaryTab === 'professor' || finSecondaryTab === 'sem_integral' || finSecondaryTab === 'estudantes_integral') {
        csvContent += "Professor;Mensalidades;Bruto (R$);Desconto (R$);Líquido Estimado (R$)\n";
        computedFinance.professorsList.forEach(p => {
          const desc = p.bruto - p.liquido;
          csvContent += `"${p.nome}";${p.mensalidades};${p.bruto.toFixed(2)};${desc.toFixed(2)};${p.liquido.toFixed(2)}\n`;
        });
      } else if (finSecondaryTab === 'unidade') {
        csvContent += "Unidade;Mensalidades;Bruto (R$);Desconto (R$);Líquido Estimado (R$)\n";
        computedFinance.unitsList.forEach(u => {
          const desc = u.bruto - u.liquido;
          csvContent += `"${u.nome}";${u.mensalidades};${u.bruto.toFixed(2)};${desc.toFixed(2)};${u.liquido.toFixed(2)}\n`;
        });
      } else {
        csvContent += "Data;Responsável;Aluno;Turma;Unidade;Plano;Bruto (R$);Desconto (R$);Líquido (R$)\n";
        computedFinance.nominalList.forEach(n => {
          const dateFormatted = n.date ? formatDateDisplay(n.date) : '';
          csvContent += `"${dateFormatted}";"${n.responsavel}";"${n.aluno}";"${n.turma}";"${n.unidade}";"${n.plano || 'Padrão'}";${n.bruto.toFixed(2)};${n.desconto.toFixed(2)};${n.liquido.toFixed(2)}\n`;
        });
      }
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    const filename = `relatorio_financeiro_${finPrimaryTab}_${finSecondaryTab}_${finStartDate}_${finEndDate}.csv`;
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };


  return (
    <>
                <div className="space-y-6">
                  {/* Title and Action Buttons */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <h2 className="text-xl font-black text-slate-800">Relatório Financeiro</h2>
                      <p className="text-slate-400 text-xs mt-0.5">
                        {finPrimaryTab === 'projetada' 
                          ? "Projeção de faturamento baseada no 'Custo' das turmas." 
                          : finPrimaryTab === 'aferida' 
                            ? "Faturamento aferido com base em pagamentos liquidados." 
                            : "Análise de pagamentos devidos vs. pagos e risco de evasão."}
                      </p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button 
                        onClick={fetchFinanceData}
                        disabled={isFetching}
                        className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                      >
                        <RefreshCw size={14} className={isFetching ? 'animate-spin' : ''} />
                        Atualizar Dados
                      </button>
                      <button 
                        onClick={handleExportCSV}
                        disabled={!computedFinance}
                        className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                      >
                        <Download size={14} />
                        Exportar CSV
                      </button>
                    </div>
                  </div>

                  {/* Primary tabs */}
                  <div className="flex bg-slate-100 p-1 rounded-2xl w-fit">
                    {([['aferida', 'Receita Aferida'], ['projetada', 'Receita Projetada'], ['inadimplencias', 'Inadimplências']] as const).map(([id, label]) => (
                      <button
                        key={id}
                        onClick={() => {
                          setFinPrimaryTab(id);
                          if (id === 'projetada') setFinSecondaryTab('professor');
                          else if (id === 'aferida') setFinSecondaryTab('consolidado');
                          else setFinSecondaryTab('');
                        }}
                        className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all uppercase tracking-wide ${
                          finPrimaryTab === id ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>

                  {/* Filters Grid */}
                  <div className="bg-white rounded-3xl p-5 border border-slate-150 shadow-sm grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                    {/* Inicio */}
                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Início</label>
                      <input 
                        type="date" 
                        value={finStartDate}
                        onChange={e => setFinStartDate(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-bold focus:outline-none focus:border-indigo-500 focus:bg-white text-slate-700 transition-all"
                      />
                    </div>
                    {/* Fim */}
                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Fim</label>
                      <input 
                        type="date" 
                        value={finEndDate}
                        onChange={e => setFinEndDate(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-bold focus:outline-none focus:border-indigo-500 focus:bg-white text-slate-700 transition-all"
                      />
                    </div>
                    {/* Unidade */}
                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Unidade</label>
                      <select 
                        value={finSelectedUnit}
                        onChange={e => setFinSelectedUnit(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold focus:outline-none focus:border-indigo-500 focus:bg-white text-slate-700 transition-all cursor-pointer"
                      >
                        <option value="">Todas as Unidades</option>
                        {(options.unidades || []).map((u: any) => {
                          const name = typeof u === 'object' && u ? u.nome : u;
                          return <option key={name} value={name}>{name}</option>;
                        })}
                      </select>
                    </div>
                    {/* Professores */}
                    <div className="space-y-1 relative">
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Professores</label>
                      <div 
                        className="min-h-[34px] w-full px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 cursor-pointer flex flex-wrap gap-1 items-center transition-all hover:border-indigo-500 hover:bg-white"
                        onClick={() => setIsFinProfDropdownOpen(!isFinProfDropdownOpen)}
                      >
                        {finSelectedProf.length === 0 && (
                          <span className="text-xs font-bold text-slate-700">Todos</span>
                        )}
                        {finSelectedProf.map(p => (
                          <span key={p} className="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-md text-[10px] font-bold flex items-center gap-1">
                            {p}
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                setFinSelectedProf(finSelectedProf.filter(selected => selected !== p));
                              }}
                              className="hover:text-indigo-900 focus:outline-none"
                            >
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                          </span>
                        ))}
                      </div>
                      
                      {isFinProfDropdownOpen && (
                        <>
                          <div className="fixed inset-0 z-10" onClick={() => setIsFinProfDropdownOpen(false)} />
                          <div className="absolute z-20 top-full left-0 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-lg max-h-60 overflow-y-auto">
                            <div className="p-2 space-y-1">
                              <label className="flex items-center gap-2 px-2 py-1.5 hover:bg-slate-50 rounded-lg cursor-pointer">
                                <input 
                                  type="checkbox" 
                                  className="w-3.5 h-3.5 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                                  checked={finSelectedProf.length === 0}
                                  onChange={() => setFinSelectedProf([])}
                                />
                                <span className="text-xs font-medium text-slate-700">Todos</span>
                              </label>
                              {(options.professores || []).map((p: any) => (
                                <label key={p.id} className="flex items-center gap-2 px-2 py-1.5 hover:bg-slate-50 rounded-lg cursor-pointer">
                                  <input 
                                    type="checkbox" 
                                    className="w-3.5 h-3.5 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                                    checked={finSelectedProf.includes(p.nome)}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setFinSelectedProf([...finSelectedProf, p.nome]);
                                      } else {
                                        setFinSelectedProf(finSelectedProf.filter(selected => selected !== p.nome));
                                      }
                                    }}
                                  />
                                  <span className="text-xs font-medium text-slate-700">{p.nome}</span>
                                </label>
                              ))}
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                    {/* Estudante Search */}
                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Estudante</label>
                      <input 
                        type="text" 
                        placeholder="Buscar estudante ou e-mail"
                        value={finSearchStudent}
                        onChange={e => setFinSearchStudent(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-bold focus:outline-none focus:border-indigo-500 focus:bg-white text-slate-700 transition-all"
                      />
                    </div>
                  </div>

                  {/* Summary Metric Cards */}
                  {computedFinance && finPrimaryTab === 'projetada' && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      {/* Brutal Total Card */}
                      <div className="bg-white p-6 rounded-3xl border border-slate-150 shadow-sm flex flex-col justify-between">
                        <div>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Receita Bruta Total</span>
                          <h3 className="text-2xl font-black text-slate-800 mt-2">{formatCurrency(computedFinance.brutoTotal)}</h3>
                        </div>
                        <span className="text-[10px] font-bold text-slate-400 mt-4 uppercase">
                          {computedFinance.totalItemsCount} Mensalidades
                        </span>
                      </div>

                      {/* Descontos Card */}
                      <div className="bg-white p-6 rounded-3xl border border-slate-150 shadow-sm flex flex-col justify-between">
                        <div>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total de Descontos</span>
                          <h3 className="text-2xl font-black text-rose-500 mt-2">{formatCurrency(computedFinance.descontoTotal)}</h3>
                        </div>
                        <span className="text-[10px] font-bold text-slate-400 mt-4 uppercase">
                          {computedFinance.discountsAppliedCount} Descontos Aplicados
                        </span>
                      </div>

                      {/* Liquido Estimado Card (Solid Blue) */}
                      <div className="bg-indigo-600 p-6 rounded-3xl shadow-xl shadow-indigo-100 flex flex-col justify-between text-white">
                        <div>
                          <span className="text-[10px] font-bold text-indigo-200 uppercase tracking-wider">Receita Líquida Estimada</span>
                          <h3 className="text-2xl font-black mt-2">{formatCurrency(computedFinance.liquidoTotal)}</h3>
                        </div>
                        <span className="text-[10px] font-bold text-indigo-200 mt-4 uppercase">
                          Faturamento Líquido Estimado
                        </span>
                      </div>
                    </div>
                  )}

                  {computedFinance && finPrimaryTab === 'aferida' && (() => {
                    let displayGross = formatCurrency(computedFinance.liquidoTotal);
                    let displayPaidCount = computedFinance.paidTransactionsCount;
                    let displayTotalCount = computedFinance.totalProcessedCount;
                    let displayEfficiency = computedFinance.efficiencyRate;
                    let titleRealizada = "Receita Realizada (Bruto)";
                    let transactionLabel = "Transações Efetivadas";
                    
                    const filteredLoja = filteredLojaGlobally;
                    const lojaPago = filteredLoja.filter(p => p.status === 'pago').reduce((acc, p) => acc + Number(p.total || 0), 0);
                    const lojaPedidosPagos = filteredLoja.filter(p => p.status === 'pago').length;
                    const lojaPedidosTotais = filteredLoja.length;

                    const filteredEventos = filteredEventosGlobally;
                    const isEventoPago = (i: any) => i.taxa_paga || i.status?.toLowerCase() === 'confirmada' || i.status === 'pago';
                    const eventosPago = filteredEventos.filter(isEventoPago).reduce((acc, i) => acc + Number(i.valor_pago || 0), 0);
                    const eventosPagosCount = filteredEventos.filter(isEventoPago).length;
                    const eventosTotais = filteredEventos.length;

                    if (finSecondaryTab === 'loja') {
                      displayGross = formatCurrency(lojaPago);
                      displayPaidCount = lojaPedidosPagos;
                      displayTotalCount = lojaPedidosTotais;
                      displayEfficiency = lojaPedidosTotais > 0 ? Math.round((lojaPedidosPagos / lojaPedidosTotais) * 100) : 100;
                      titleRealizada = "Receita Loja (Paga)";
                      transactionLabel = "Pedidos Pagos";
                    } else if (finSecondaryTab === 'eventos') {
                      displayGross = formatCurrency(eventosPago);
                      displayPaidCount = eventosPagosCount;
                      displayTotalCount = eventosTotais;
                      displayEfficiency = eventosTotais > 0 ? Math.round((eventosPagosCount / eventosTotais) * 100) : 100;
                      titleRealizada = "Receita Eventos (Paga)";
                      transactionLabel = "Inscrições Pagas";
                    } else if (finSecondaryTab === 'consolidado') {
                      const lojaConsolidado = filteredLoja.filter(p => p.status === 'pago').reduce((acc, p) => acc + Number(p.total || 0), 0);
                      const lojaConsolidadoCount = filteredLoja.filter(p => p.status === 'pago').length;
                      
                      const eventosConsolidado = filteredEventos.filter(i => isEventoPago(i)).reduce((acc, i) => acc + Number(i.valor_pago || 0), 0);
                      const eventosConsolidadoCount = filteredEventos.filter(i => isEventoPago(i)).length;

                      const totalConsolidado = computedFinance.liquidoTotal + lojaConsolidado + eventosConsolidado;
                      const totalPaidCount = computedFinance.paidTransactionsCount + lojaConsolidadoCount + eventosConsolidadoCount;
                      const totalProcessedCount = computedFinance.totalProcessedCount + filteredLoja.length + filteredEventos.length;
                      
                      displayGross = formatCurrency(totalConsolidado);
                      displayPaidCount = totalPaidCount;
                      displayTotalCount = totalProcessedCount;
                      displayEfficiency = totalProcessedCount > 0 ? Math.round((totalPaidCount / totalProcessedCount) * 100) : 100;
                      titleRealizada = "Receita Realizada Consolidada";
                      transactionLabel = "Transações Efetivadas";
                    }

                    return (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                        {/* Realized Gross Card */}
                        <div className="bg-white p-6 rounded-3xl border border-slate-150 shadow-sm flex flex-col justify-between">
                          <div>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{titleRealizada}</span>
                            <h3 className="text-2xl font-black text-slate-800 mt-2">{displayGross}</h3>
                          </div>
                          <span className="text-[10px] font-bold text-slate-400 mt-4 uppercase">
                            {displayPaidCount} {transactionLabel}
                          </span>
                        </div>

                        {/* Processed Attempts Card */}
                        <div className="bg-white p-6 rounded-3xl border border-slate-150 shadow-sm flex flex-col justify-between">
                          <div>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Transações Processadas</span>
                            <h3 className="text-2xl font-black text-slate-800 mt-2">{displayTotalCount}</h3>
                          </div>
                          <span className="text-[10px] font-bold text-slate-400 mt-4 uppercase">
                            Volume Total Processado
                          </span>
                        </div>

                        {/* Efficiency Card */}
                        <div className="bg-indigo-600 p-6 rounded-3xl shadow-xl shadow-indigo-100 flex flex-col justify-between text-white">
                          <div>
                            <span className="text-[10px] font-bold text-indigo-200 uppercase tracking-wider">Eficiência de Cobrança</span>
                            <h3 className="text-2xl font-black mt-2">{displayEfficiency}%</h3>
                          </div>
                          <span className="text-[10px] font-bold text-indigo-200 mt-4 uppercase">
                            Taxa de Sucesso Média
                          </span>
                        </div>
                      </div>
                    );
                  })()}

                  {computedFinance && finPrimaryTab === 'inadimplencias' && (
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                      {/* Total Inadimplência */}
                      <div className="bg-white p-5 rounded-3xl border border-slate-150 shadow-sm">
                        <span className="text-[10px] font-bold text-slate-450 uppercase tracking-wider">Total Inadimplência</span>
                        <h3 className="text-xl font-extrabold text-rose-600 mt-1.5">{formatCurrency(computedFinance.liquidoTotal)}</h3>
                      </div>
                      {/* Total Estudantes */}
                      <div className="bg-white p-5 rounded-3xl border border-slate-150 shadow-sm">
                        <span className="text-[10px] font-bold text-slate-450 uppercase tracking-wider">Total Estudantes</span>
                        <h3 className="text-xl font-extrabold text-slate-800 mt-1.5">{computedFinance.totalInadEstudantes}</h3>
                      </div>
                      {/* Matrículas Ativas */}
                      <div className="bg-white p-5 rounded-3xl border border-slate-150 shadow-sm">
                        <span className="text-[10px] font-bold text-slate-450 uppercase tracking-wider">Matrículas Ativas</span>
                        <h3 className="text-xl font-extrabold text-emerald-600 mt-1.5">{computedFinance.totalInadMatriculasAtivas}</h3>
                      </div>
                      {/* Risco de Evasão */}
                      <div className="bg-white p-5 rounded-3xl border border-slate-150 shadow-sm">
                        <span className="text-[10px] font-bold text-slate-450 uppercase tracking-wider">Risco de Evasão</span>
                        <h3 className="text-xl font-extrabold text-amber-600 mt-1.5">{computedFinance.totalInadRiscoEvasao}</h3>
                      </div>
                      {/* Inad. Controlada */}
                      <div className="bg-white p-5 rounded-3xl border border-slate-150 shadow-sm">
                        <span className="text-[10px] font-bold text-slate-450 uppercase tracking-wider">Inad. Controlada</span>
                        <h3 className="text-xl font-extrabold text-indigo-600 mt-1.5">{computedFinance.totalInadControlada}</h3>
                      </div>
                    </div>
                  )}

                  {/* Secondary navigation tabs */}
                  {finPrimaryTab !== 'inadimplencias' && (
                    <div className="flex flex-wrap gap-2 bg-slate-100 p-1 rounded-2xl w-fit">
                      {(finPrimaryTab === 'projetada' ? [
                        ['professor', 'Resumo por Professor'], 
                        ['unidade', 'Resumo por Unidade'], 
                        ['detalhado', 'Detalhamento Nominal'],
                        ['sem_integral', 'Sem Integral'],
                        ['estudantes_integral', 'Estudantes Integral']
                      ] as const : [
                        ['consolidado', 'Recebimentos Consolidado'],
                        ['wix', 'Pagamentos Wix'],
                        ['pagarme', 'Pagamentos Pagar.me'],
                        ['loja', 'Recebimentos Loja'],
                        ['eventos', 'Recebimentos Eventos']
                      ] as const).map(([id, label]) => (
                        <button
                          key={id}
                          onClick={() => setFinSecondaryTab(id)}
                          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                            finSecondaryTab === id ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Render Data Lists based on tabs */}
                  {computedFinance && (
                    <div className="space-y-6">
                      {/* A. Receita Projetada Views */}
                      {finPrimaryTab === 'projetada' && (
                        <>
                          {/* 1. Resumo por Professor, Sem Integral, Estudantes Integral */}
                          {(finSecondaryTab === 'professor' || finSecondaryTab === 'sem_integral' || finSecondaryTab === 'estudantes_integral') && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                              {computedFinance.professorsList.map((p) => (
                                <div key={p.nome} className="bg-white rounded-3xl p-6 border border-slate-150 shadow-sm flex flex-col justify-between space-y-4 hover:border-indigo-100 hover:shadow-md transition-all">
                                  <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center border border-slate-100 text-slate-500">
                                      <User size={18} />
                                    </div>
                                    <div>
                                      <h4 className="font-black text-slate-800 uppercase tracking-tight text-sm">{p.nome}</h4>
                                    </div>
                                  </div>
                                  
                                  <div className="space-y-2 pt-2">
                                    <div className="flex justify-between items-center text-xs">
                                      <span className="text-slate-400 font-medium">BRUTO</span>
                                      <span className="font-bold text-slate-800">{formatCurrency(p.bruto)}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-xs">
                                      <span className="text-slate-400 font-medium">MENSALIDADES</span>
                                      <span className="font-bold text-slate-800">{p.mensalidades}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-xs">
                                      <span className="text-slate-400 font-medium">DESCONTOS</span>
                                      <span className="font-bold text-rose-500">{formatCurrency(p.bruto - p.liquido)}</span>
                                    </div>
                                    <div className="border-t border-slate-100 pt-3 flex justify-between items-center text-xs">
                                      <span className="font-bold text-indigo-600 uppercase">Líquido Estimado</span>
                                      <span className="font-black text-indigo-600 text-sm">{formatCurrency(p.liquido)}</span>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* 2. Resumo por Unidade */}
                          {finSecondaryTab === 'unidade' && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                              {computedFinance.unitsList.map((u) => (
                                <div key={u.nome} className="bg-white rounded-3xl p-6 border border-slate-150 shadow-sm flex flex-col justify-between space-y-4 hover:border-indigo-100 hover:shadow-md transition-all">
                                  <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center border border-slate-100 text-slate-500">
                                      <MapPin size={18} />
                                    </div>
                                    <div>
                                      <h4 className="font-black text-slate-800 uppercase tracking-tight text-sm">{u.nome}</h4>
                                    </div>
                                  </div>
                                  
                                  <div className="space-y-2 pt-2">
                                    <div className="flex justify-between items-center text-xs">
                                      <span className="text-slate-400 font-medium">BRUTO</span>
                                      <span className="font-bold text-slate-800">{formatCurrency(u.bruto)}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-xs">
                                      <span className="text-slate-400 font-medium">MENSALIDADES</span>
                                      <span className="font-bold text-slate-800">{u.mensalidades}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-xs">
                                      <span className="text-slate-400 font-medium">DESCONTOS</span>
                                      <span className="font-bold text-rose-500">{formatCurrency(u.bruto - u.liquido)}</span>
                                    </div>
                                    <div className="border-t border-slate-100 pt-3 flex justify-between items-center text-xs">
                                      <span className="font-bold text-indigo-600 uppercase">Líquido Estimado</span>
                                      <span className="font-black text-indigo-600 text-sm">{formatCurrency(u.liquido)}</span>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* 3. Detalhamento Nominal */}
                          {finSecondaryTab === 'detalhado' && (
                            <div className="bg-white rounded-3xl border border-slate-150 overflow-hidden shadow-sm">
                              <div className="overflow-x-auto">
                                <table className="w-full text-left text-sm border-collapse">
                                  <thead>
                                    <tr className="bg-slate-50 border-b border-slate-100 text-slate-400 font-bold uppercase text-[10px] tracking-wider">
                                      <th className="p-4">Data</th>
                                      <th className="p-4">Responsável</th>
                                      <th className="p-4">Aluno</th>
                                      <th className="p-4">Turma</th>
                                      <th className="p-4">Plano</th>
                                      <th className="p-4 text-right">Bruto</th>
                                      <th className="p-4 text-right">Desconto</th>
                                      <th className="p-4 text-right">Líquido</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100">
                                    {computedFinance.nominalList.length === 0 ? (
                                      <tr>
                                        <td colSpan={8} className="p-8 text-center text-slate-400 italic">
                                          Nenhum registro encontrado para os filtros selecionados.
                                        </td>
                                      </tr>
                                    ) : (
                                      computedFinance.nominalList.map((item: any, idx: number) => (
                                        <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                                          <td className="p-4 text-xs font-semibold text-slate-600">
                                            {item.date ? formatDateDisplay(item.date) : '—'}
                                          </td>
                                          <td className="p-4 text-xs font-medium text-slate-700">
                                            {item.responsavel}
                                          </td>
                                          <td className="p-4">
                                            <div className="text-xs font-bold text-slate-800">{item.aluno}</div>
                                            {item.alunoDetalhes && <div className="text-[9px] text-slate-400 font-semibold">{item.alunoDetalhes}</div>}
                                          </td>
                                          <td className="p-4">
                                            <div className="text-xs font-semibold text-slate-800">{item.turma}</div>
                                            <div className="text-[9px] text-slate-400 font-medium">{item.unidade}</div>
                                          </td>
                                          <td className="p-4">
                                            {renderPlano(item.plano)}
                                          </td>
                                          <td className="p-4 text-xs font-semibold text-slate-700 text-right">
                                            {formatCurrency(item.bruto)}
                                          </td>
                                          <td className="p-4 text-xs font-semibold text-rose-500 text-right">
                                            {formatCurrency(item.desconto)}
                                          </td>
                                          <td className="p-4 text-xs font-bold text-slate-800 text-right">
                                            {formatCurrency(item.liquido)}
                                          </td>
                                        </tr>
                                      ))
                                    )}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          )}
                        </>
                      )}

                      {/* B. Receita Aferida Views */}
                      {finPrimaryTab === 'aferida' && (
                        <>
                          {/* 1. Pagamentos Wix & Pagarme */}
                          {(finSecondaryTab === 'wix' || finSecondaryTab === 'pagarme') && (
                            <div className="bg-white rounded-3xl border border-slate-150 overflow-hidden shadow-sm">
                              <div className="overflow-x-auto">
                                <table className="w-full text-left text-sm border-collapse">
                                  <thead>
                                    <tr className="bg-slate-50 border-b border-slate-100 text-slate-400 font-bold uppercase text-[10px] tracking-wider">
                                      <th className="p-4">Data</th>
                                      <th className="p-4">Estudante</th>
                                      <th className="p-4">Turma</th>
                                      <th className="p-4">Unidade</th>
                                      <th className="p-4 text-right">Valor</th>
                                      <th className="p-4 text-center">Status</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100">
                                    {computedFinance.nominalList.length === 0 ? (
                                      <tr>
                                        <td colSpan={6} className="p-8 text-center text-slate-400 italic">
                                          Nenhum pagamento encontrado para o período selecionado.
                                        </td>
                                      </tr>
                                    ) : (
                                      computedFinance.nominalList.map((item: any, idx: number) => (
                                        <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                                          <td className="p-4 text-xs font-semibold text-slate-600">
                                            {item.date ? formatDateDisplay(item.date) : '—'}
                                          </td>
                                          <td className="p-4">
                                            <div className="text-xs font-bold text-slate-800">{item.aluno}</div>
                                            <div className="text-[10px] text-slate-400 font-medium">{item.email}</div>
                                          </td>
                                          <td className="p-4">
                                            <div className="text-xs font-bold text-slate-800">{item.turma}</div>
                                            <div className="text-[10px] text-slate-400 font-medium uppercase">{item.plano}</div>
                                          </td>
                                          <td className="p-4 text-xs font-medium text-slate-500">
                                            {item.unidade}
                                          </td>
                                          <td className="p-4 text-xs font-black text-slate-800 text-right">
                                            {formatCurrency(item.liquido)}
                                          </td>
                                          <td className="p-4 text-center">
                                            <span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider ${
                                              item.status === 'pago' || item.status === 'conciliado'
                                                ? 'bg-emerald-50 text-emerald-700'
                                                : 'bg-rose-50 text-rose-700'
                                            }`}>
                                              {item.status === 'pago' || item.status === 'conciliado' ? 'Bem-sucedido' : item.status || 'Recusado'}
                                            </span>
                                          </td>
                                        </tr>
                                      ))
                                    )}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          )}

                          {/* 2. Recebimentos Consolidado */}
                          {finSecondaryTab === 'consolidado' && (() => {
                            const cList: any[] = [];
                            computedFinance.nominalList.forEach(p => cList.push({ ...p, origem: 'Mensalidade' }));
                            filteredLojaGlobally.filter((p: any) => p.status === 'pago')
                              .forEach((p: any) => cList.push({ date: p.created_at, responsavel: p.nome_cliente, origem: 'Loja', metodo: '—', liquido: p.total, status: 'pago' }));
                            filteredEventosGlobally.filter((i: any) => i.taxa_paga || i.status?.toLowerCase() === 'confirmada' || i.status === 'pago')
                              .forEach((i: any) => cList.push({ date: i.created_at, responsavel: i.nome_responsavel, aluno: i.nome_aluno || '—', origem: 'Evento', metodo: i.respostas_personalizadas?.metodo_pagamento || '—', liquido: i.valor_pago, status: 'pago' }));
                            
                            cList.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

                            return (
                              <div className="bg-white rounded-3xl border border-slate-150 overflow-hidden shadow-sm">
                                <div className="overflow-x-auto">
                                  <table className="w-full text-left text-sm border-collapse">
                                    <thead>
                                      <tr className="bg-slate-50 border-b border-slate-100 text-slate-400 font-bold uppercase text-[10px] tracking-wider">
                                        <th className="p-4">Data</th>
                                        <th className="p-4">Origem</th>
                                        <th className="p-4">Cliente/Estudante</th>
                                        <th className="p-4">Unidade/Turma</th>
                                        <th className="p-4">Método</th>
                                        <th className="p-4 text-right">Valor</th>
                                        <th className="p-4 text-center">Status</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                      {cList.length === 0 ? (
                                        <tr>
                                          <td colSpan={7} className="p-8 text-center text-slate-400 italic">
                                            Nenhum recebimento encontrado para o período.
                                          </td>
                                        </tr>
                                      ) : (
                                        cList.map((item, idx) => (
                                          <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                                            <td className="p-4 text-xs font-semibold text-slate-600">
                                              {item.date ? formatDateDisplay(item.date) : '—'}
                                            </td>
                                            <td className="p-4">
                                              <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${
                                                item.origem === 'Mensalidade' ? 'bg-indigo-50 text-indigo-700' :
                                                item.origem === 'Loja' ? 'bg-amber-50 text-amber-700' :
                                                'bg-pink-50 text-pink-700'
                                              }`}>
                                                {item.origem}
                                              </span>
                                            </td>
                                            <td className="p-4">
                                              <div className="text-xs font-bold text-slate-800">{item.responsavel || '—'}</div>
                                              {item.aluno && item.aluno !== '—' && (
                                                <div className="text-[10px] text-slate-500 font-medium">{item.aluno}</div>
                                              )}
                                            </td>
                                            <td className="p-4">
                                              <div className="text-xs font-semibold text-slate-800">{item.unidade && item.unidade !== '—' ? item.unidade : '—'}</div>
                                              {item.turma && item.turma !== '—' && (
                                                <div className="text-[10px] text-slate-500 font-medium">{item.turma}</div>
                                              )}
                                            </td>
                                            <td className="p-4 text-xs font-semibold text-slate-500 uppercase">
                                              {item.metodo}
                                            </td>
                                            <td className="p-4 text-xs font-black text-slate-800 text-right">
                                              {formatCurrency(item.liquido)}
                                            </td>
                                            <td className="p-4 text-center">
                                              <span className="px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700">
                                                Bem-sucedido
                                              </span>
                                            </td>
                                          </tr>
                                        ))
                                      )}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            );
                          })()}

                          {/* 3. Recebimentos Loja */}
                          {finSecondaryTab === 'loja' && (() => {
                            const filteredLoja = filteredLojaGlobally;
                            const lojaPago = filteredLoja.filter(p => p.status === 'pago').reduce((acc, p) => acc + Number(p.total || 0), 0);
                            const lojaPedidosPagos = filteredLoja.filter(p => p.status === 'pago').length;

                            const lojaPedidosTotais = filteredLoja.length;
                            const lojaEficiencia = lojaPedidosTotais > 0 ? Math.round((lojaPedidosPagos / lojaPedidosTotais) * 100) : 100;

                            return (
                              <div className="space-y-6">
                                <div className="bg-white rounded-3xl border border-slate-150 overflow-hidden shadow-sm">
                                  <div className="overflow-x-auto">
                                    <table className="w-full text-left text-sm border-collapse">
                                      <thead>
                                        <tr className="bg-slate-50 border-b border-slate-100 text-slate-400 font-bold uppercase text-[10px] tracking-wider">
                                          <th className="p-4">Data</th>
                                          <th className="p-4">Cliente</th>
                                          <th className="p-4 text-right">Total</th>
                                          <th className="p-4 text-center">Status</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-slate-100">
                                        {filteredLoja.length === 0 ? (
                                          <tr><td colSpan={4} className="p-8 text-center text-slate-400 italic">Nenhum pedido na loja no período.</td></tr>
                                        ) : filteredLoja.map((p: any) => (
                                          <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                                            <td className="p-4 text-xs font-semibold text-slate-600">{formatDateDisplay(p.created_at)}</td>
                                            <td className="p-4 text-xs font-bold text-slate-800">{p.nome_cliente}</td>
                                            <td className="p-4 text-xs font-black text-slate-800 text-right">{formatCurrency(p.total)}</td>
                                            <td className="p-4 text-center">
                                              <span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider ${p.status === 'pago' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{p.status}</span>
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              </div>
                            );
                          })()}

                          {/* 4. Recebimentos Eventos */}
                          {finSecondaryTab === 'eventos' && (() => {
                            const filteredEventos = filteredEventosGlobally;
                            const isEventoPago = (i: any) => i.taxa_paga || i.status?.toLowerCase() === 'confirmada' || i.status === 'pago';
                            const eventosPago = filteredEventos.filter(isEventoPago).reduce((acc, i) => acc + Number(i.valor_pago || 0), 0);
                            const eventosPagosCount = filteredEventos.filter(isEventoPago).length;

                            const eventosTotais = filteredEventos.length;
                            const eventosEficiencia = eventosTotais > 0 ? Math.round((eventosPagosCount / eventosTotais) * 100) : 100;

                            return (
                              <div className="space-y-6">
                                <div className="bg-white rounded-3xl border border-slate-150 overflow-hidden shadow-sm">
                                  <div className="overflow-x-auto">
                                    <table className="w-full text-left text-sm border-collapse">
                                      <thead>
                                        <tr className="bg-slate-50 border-b border-slate-100 text-slate-400 font-bold uppercase text-[10px] tracking-wider">
                                          <th className="p-4">Data</th>
                                          <th className="p-4">Responsável</th>
                                          <th className="p-4">Evento</th>
                                          <th className="p-4 text-right">Valor</th>
                                          <th className="p-4 text-center">Status</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-slate-100">
                                        {filteredEventos.length === 0 ? (
                                          <tr><td colSpan={5} className="p-8 text-center text-slate-400 italic">Nenhuma inscrição no período.</td></tr>
                                        ) : filteredEventos.map((i: any) => (
                                          <tr key={i.id} className="hover:bg-slate-50/50 transition-colors">
                                            <td className="p-4 text-xs font-semibold text-slate-600">{formatDateDisplay(i.created_at)}</td>
                                            <td className="p-4">
                                              <div className="text-xs font-bold text-slate-800">{i.nome_responsavel}</div>
                                              <div className="text-[10px] text-slate-400 font-medium">{i.nome_aluno}</div>
                                            </td>
                                            <td className="p-4 text-xs font-semibold text-slate-800">{i.eventos?.titulo || 'Evento Excluído'}</td>
                                            <td className="p-4 text-xs font-black text-slate-800 text-right">{formatCurrency(i.valor_pago)}</td>
                                            <td className="p-4 text-center">
                                              <span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider ${i.taxa_paga || i.status?.toLowerCase() === 'confirmada' || i.status === 'pago' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{i.status}</span>
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              </div>
                            );
                          })()}
                        </>
                      )}

                      {/* C. Inadimplências View */}
                      {finPrimaryTab === 'inadimplencias' && (
                        <div className="bg-white rounded-3xl border border-slate-150 overflow-hidden shadow-sm">
                          <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm border-collapse">
                              <thead>
                                <tr className="bg-slate-50 border-b border-slate-100 text-slate-400 font-bold uppercase text-[10px] tracking-wider">
                                  <th className="p-4">Estudante / Responsável</th>
                                  <th className="p-4">Unidade / Turma</th>
                                  <th className="p-4">Última Presença</th>
                                  <th className="p-4">Atraso</th>
                                  <th className="p-4 text-right">Saldo Devedor</th>
                                  <th className="p-4 text-center">Risco</th>
                                  <th className="p-4 text-center">Ação</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {computedFinance.overdueList.length === 0 ? (
                                  <tr>
                                    <td colSpan={7} className="p-8 text-center text-slate-400 italic">
                                      Nenhuma inadimplência encontrada para o período selecionado.
                                    </td>
                                  </tr>
                                ) : (
                                  computedFinance.overdueList.map((item: any, idx: number) => (
                                    <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                                      <td className="p-4">
                                        <div className="text-xs font-bold text-slate-800">{item.studentName}</div>
                                        <div className="text-[10px] text-slate-400 font-medium">{item.guardianName}</div>
                                      </td>
                                      <td className="p-4">
                                        <div className="text-xs font-semibold text-slate-800">{item.className}</div>
                                        <div className="text-[10px] text-slate-400 font-medium">{item.unitName}</div>
                                      </td>
                                      <td className="p-4 text-xs font-semibold text-slate-600">
                                        {item.lastPresence}
                                      </td>
                                      <td className="p-4 text-xs font-bold text-amber-600">
                                        {item.outstandingCount} parcela(s)
                                      </td>
                                      <td className="p-4 text-xs font-black text-slate-800 text-right">
                                        {formatCurrency(item.totalOwed)}
                                      </td>
                                      <td className="p-4 text-center">
                                        <span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider ${
                                          item.risk === 'BAIXO' 
                                            ? 'bg-emerald-50 text-emerald-700' 
                                            : item.risk === 'MODERADO' 
                                              ? 'bg-amber-50 text-amber-700' 
                                              : 'bg-rose-50 text-rose-700'
                                        }`}>
                                          {item.risk}
                                        </span>
                                      </td>
                                      <td className="p-4 text-center">
                                        <button
                                          onClick={() => {
                                            const msg = `Olá ${item.guardianName}, tudo bem? Consta uma pendência financeira em nosso sistema referente ao aluno ${item.studentName} na modalidade ${item.className} (${item.unitName}). Poderia nos auxiliar na regularização? Obrigado!`;
                                            const phone = item.guardianWhatsapp ? item.guardianWhatsapp.replace(/\D/g, '') : '';
                                            const url = `https://api.whatsapp.com/send?phone=55${phone}&text=${encodeURIComponent(msg)}`;
                                            window.open(url, '_blank');
                                          }}
                                          className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-bold uppercase transition-all shadow-sm flex items-center gap-1.5 mx-auto"
                                        >
                                          Cobrar
                                        </button>
                                      </td>
                                    </tr>
                                  ))
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
    </>
  );
}
