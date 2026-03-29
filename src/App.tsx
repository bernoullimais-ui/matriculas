import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  User, 
  GraduationCap, 
  CreditCard, 
  CheckCircle2, 
  ChevronRight, 
  ChevronLeft,
  QrCode,
  ShieldCheck,
  LayoutDashboard,
  RefreshCw,
  Search,
  ExternalLink,
  Plus,
  Save,
  Trash2,
  Clock,
  Calendar,
  XCircle,
  FileText,
  Home,
  LogOut,
  Settings,
  Lock,
  Edit3,
  DollarSign,
  Percent,
  Tag,
  Users,
  X,
  Mail,
  Phone,
  Download,
  Truck,
  Gift,
  Info,
  Star,
  Check,
  AlertCircle,
  Upload,
  FileSpreadsheet,
  Hash,
  Sparkles
} from 'lucide-react';
import Papa from 'papaparse';

type Step = 'guardian' | 'student' | 'enrollment' | 'payment' | 'success' | 'waitlist_success' | 'admin' | 'portal' | 'complete_profile';

interface Enrollment {
  nome_completo: string;
  alunos: { 
    nome_completo: string; 
    serie_ano: string;
    data_nascimento: string;
    id: string;
    matriculas: {
      id: string;
      turma: string;
      unidade: string;
      turma_id?: string;
      status?: string;
      plano?: string;
      data_matricula?: string;
      data_cancelamento?: string;
      data_trancamento_inicio?: string;
      data_trancamento_fim?: string;
    }[];
  }[];
  pagamentos: { status: string; metodo_pagamento: string; data_vencimento?: string }[];
}

export default function App() {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [step, setStep] = useState<Step>('guardian');
  const [showWelcomeModal, setShowWelcomeModal] = useState(() => {
    const expirationDate = new Date('2026-04-22T00:00:00Z');
    const now = new Date();
    return now < expirationDate;
  });
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [isCompletingProfile, setIsCompletingProfile] = useState(false);
  const [loading, setLoading] = useState(false);
  const [searchingGuardian, setSearchingGuardian] = useState(false);
  const [guardianExists, setGuardianExists] = useState<boolean | null>(null);
  const [hasFidelityDiscount, setHasFidelityDiscount] = useState(false);
  const [verifyingPassword, setVerifyingPassword] = useState(false);
  const [recoveringPassword, setRecoveringPassword] = useState(false);
  const [isEditingGuardian, setIsEditingGuardian] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [isFetchingAddress, setIsFetchingAddress] = useState(false);
  const [isTemporaryCpf, setIsTemporaryCpf] = useState(false);
  const [isFirstAccess, setIsFirstAccess] = useState(false);
  const [isAccessingPanel, setIsAccessingPanel] = useState(true);
  const [accessError, setAccessError] = useState<string | null>(null);
  const [isCancelingEnrollment, setIsCancelingEnrollment] = useState(false);
  const [isViewingEnrollmentDetails, setIsViewingEnrollmentDetails] = useState(false);
  const [selectedEnrollmentDetails, setSelectedEnrollmentDetails] = useState<any>(null);
  const [cancelingEnrollmentId, setCancelingEnrollmentId] = useState<string | null>(null);
  const [cancellationDate, setCancellationDate] = useState(new Date().toISOString().split('T')[0]);
  const [cancellationReason, setCancellationReason] = useState('');

  const [isFreezingEnrollment, setIsFreezingEnrollment] = useState(false);
  const [freezingEnrollmentId, setFreezingEnrollmentId] = useState<string | null>(null);
  const [freezeStartDate, setFreezeStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [freezeEndDate, setFreezeEndDate] = useState('');

  const [isReactivatingEnrollment, setIsReactivatingEnrollment] = useState(false);
  const [reactivatingEnrollmentId, setReactivatingEnrollmentId] = useState<string | null>(null);
  const [reactivationDate, setReactivationDate] = useState(new Date().toISOString().split('T')[0]);

  const [isTransferringEnrollment, setIsTransferringEnrollment] = useState(false);
  const [transferTarget, setTransferTarget] = useState({ turma: '', unidade: '' });
  const [transferringStudent, setTransferringStudent] = useState<{ id: string, nome_completo: string, serie_ano: string, data_nascimento: string } | null>(null);

  const [dependents, setDependents] = useState<any[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [importData, setImportData] = useState<any[]>([]);
  const [importResults, setImportResults] = useState<any>(null);
  const [importPreviewResults, setImportPreviewResults] = useState<any>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importEncoding, setImportEncoding] = useState('UTF-8');
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importType, setImportType] = useState<'matriculas' | 'aulas_experimentais' | 'ocorrencias' | 'presencas' | 'pagamentos_wix' | 'pagamentos_pagseguro'>('matriculas');
  const [wixMapping, setWixMapping] = useState<{
    email: string;
    responsavel_nome: string;
    plano: string;
    aluno: string;
    data: string;
    valor: string;
    status: string;
    transacao_id: string;
  } | null>(null);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [showMappingModal, setShowMappingModal] = useState(false);
  const [tempWixData, setTempWixData] = useState<any[]>([]);

  useEffect(() => {
    if (importFile) {
      const reader = new FileReader();
      reader.onload = (event) => {
        let content = event.target?.result as string;
        
        // If WIX payments, check if we need to skip the first line (group headers)
        if (importType === 'pagamentos_wix') {
          const lines = content.split(/\r?\n/);
          if (lines.length > 1 && lines[0].includes('"Pagamento"') && lines[0].includes('"Informações de pagamento"')) {
            console.log('Detected WIX group headers. Skipping first line.');
            content = lines.slice(1).join('\n');
          }
        }

        Papa.parse(content, {
          header: true,
          skipEmptyLines: 'greedy',
          transformHeader: (header, index) => {
            // Remove BOM and trim
            const clean = header.replace(/^\ufeff/i, '').trim();
            if (importType === 'pagamentos_wix') {
              // For WIX, we append the index to handle duplicate column names (like "Nome", "Email", etc.)
              return `idx${index}_${clean}`;
            }
            return clean;
          },
          complete: (results) => {
            console.log('PapaParse Results:', results);
            
            if (results.data.length === 0) {
              console.warn('PapaParse returned no data rows.');
            }

            if (importType === 'pagamentos_wix' && results.meta.fields) {
              processMappedData(results.data);
              return;
            }

            // If PapaParse failed to detect the delimiter
            // and we have only one column that looks like it should be multiple
            let data = results.data;
            if (results.meta.fields && results.meta.fields.length === 1) {
              const firstField = results.meta.fields[0];
              let detectedDelimiter = null;
              if (firstField.includes(';')) detectedDelimiter = ';';
              else if (firstField.includes('\t')) detectedDelimiter = '\t';
              else if (firstField.includes('|')) detectedDelimiter = '|';

              if (detectedDelimiter) {
                console.warn(`Delimiter '${detectedDelimiter}' detected but not used by PapaParse. Re-parsing...`);
                Papa.parse(content, {
                  header: true,
                  skipEmptyLines: 'greedy',
                  delimiter: detectedDelimiter,
                  transformHeader: (header) => header.replace(/^\ufeff/i, '').trim(),
                  complete: (res) => {
                    processMappedData(res.data);
                  }
                });
                return;
              }
            }

            processMappedData(data);
          },
          error: (error) => {
            console.error(`Erro ao processar arquivo: ${error.message}`);
          }
        });
      };
      reader.readAsText(importFile, importEncoding);
    }
  }, [importEncoding, importFile, importType]);

  const runPreview = async (dataToPreview: any[], type: string) => {
    if (dataToPreview.length === 0) return;
    setIsPreviewing(true);
    setImportPreviewResults(null);
    try {
      let endpoint = '/api/admin/import';
      if (type === 'aulas_experimentais') {
        endpoint = '/api/admin/import-aulas-experimentais';
      } else if (type === 'ocorrencias') {
        endpoint = '/api/admin/import-ocorrencias';
      } else if (type === 'presencas') {
        endpoint = '/api/admin/import-presencas';
      } else if (type === 'pagamentos_wix') {
        endpoint = '/api/admin/import-wix-payments';
      } else if (type === 'pagamentos_pagseguro') {
        endpoint = '/api/admin/import-pagseguro-payments';
      }
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: type === 'pagamentos_wix' 
          ? JSON.stringify({ payments: dataToPreview, preview: true, mapping: wixMapping })
          : type === 'pagamentos_pagseguro'
            ? JSON.stringify({ payments: dataToPreview, preview: true })
            : JSON.stringify({ rows: dataToPreview, preview: true })
      });
      
      const text = await response.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        if (!response.ok) {
          throw new Error(text || `Erro no servidor (${response.status})`);
        }
        throw new Error('Resposta do servidor inválida (não é JSON)');
      }

      if (!response.ok) {
        throw new Error(data.error || 'Erro desconhecido no servidor');
      }
      setImportPreviewResults(data);
    } catch (error: any) {
      console.error('Preview error:', error);
      setErrorMessage(`Erro na pré-visualização: ${error.message || error}`);
    } finally {
      setIsPreviewing(false);
    }
  };

  const processMappedData = (rawData: any[]) => {
    if (importType === 'aulas_experimentais' || importType === 'ocorrencias' || importType === 'presencas' || importType === 'pagamentos_wix' || importType === 'pagamentos_pagseguro') {
      // For these types, just keep the raw data as the server handles the mapping
      setImportData(rawData);
      setImportResults(null);
      runPreview(rawData, importType);
      return;
    }

    // Helper to find value by multiple possible header names (case-insensitive)
    const getVal = (row: any, keys: string[]) => {
      const entry = Object.entries(row).find(([k]) => {
        const cleanK = k.replace(/^\uFEFF/i, '').trim().toLowerCase();
        return keys.some(key => {
          const cleanKey = key.toLowerCase();
          return cleanK === cleanKey || cleanK.includes(cleanKey);
        });
      });
      return entry ? String(entry[1]).trim() : '';
    };

    // Map Portuguese headers to backend keys for matriculas
    const mappedData = rawData.map((row: any) => ({
      responsavel_nome: getVal(row, ['Nome do Responsável', 'responsavel_nome', 'Responsavel']),
      responsavel_cpf: getVal(row, ['CPF do Responsável', 'responsavel_cpf', 'CPF']),
      responsavel_email: getVal(row, ['Email do Responsável', 'responsavel_email', 'Email']),
      responsavel_telefone: getVal(row, ['Telefone do Responsável', 'responsavel_telefone', 'Telefone']),
      responsavel_endereco: getVal(row, ['Endereço', 'responsavel_endereco', 'Endereco']),
      aluno_nome: getVal(row, ['Nome do Aluno', 'aluno_nome', 'Estudante', 'Aluno']),
      aluno_data_nascimento: getVal(row, ['Data de Nascimento', 'aluno_data_nascimento', 'Nascimento']),
      aluno_serie: getVal(row, ['Série', 'aluno_serie', 'Serie']),
      aluno_turma_escolar: getVal(row, ['Turma Escolar', 'aluno_turma_escolar']),
      responsavel_1: getVal(row, ['Responsável 1', 'responsavel_1']),
      whatsapp_1: getVal(row, ['WhatsApp 1', 'whatsapp_1']),
      responsavel_2: getVal(row, ['Responsável 2', 'responsavel_2']),
      whatsapp_2: getVal(row, ['WhatsApp 2', 'whatsapp_2']),
      turma_complementar: getVal(row, ['Turma Sport for Kids', 'turma_complementar', 'Turma']),
      unidade: getVal(row, ['Unidade', 'unidade']),
      status: getVal(row, ['Status da Matrícula', 'status', 'Status da Matricula']),
      data_matricula: getVal(row, ['Data da Matrícula', 'data_matricula', 'Data da Matricula']),
      plano: getVal(row, ['Plano', 'plano']),
      data_cancelamento: getVal(row, ['Data de Cancelamento', 'data_cancelamento'])
    }));
    setImportData(mappedData);
    setImportResults(null);
    runPreview(mappedData, importType);
  };

  const handleConfirmMapping = (mapping: any) => {
    setWixMapping(mapping);
    setShowMappingModal(false);
    setImportData(tempWixData);
    runPreview(tempWixData, 'pagamentos_wix');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportFile(file);
  };

  const processImport = async () => {
    if (importData.length === 0) return;
    setIsImporting(true);
    try {
      let endpoint = '/api/admin/import';
      if (importType === 'aulas_experimentais') {
        endpoint = '/api/admin/import-aulas-experimentais';
      } else if (importType === 'ocorrencias') {
        endpoint = '/api/admin/import-ocorrencias';
      } else if (importType === 'presencas') {
        endpoint = '/api/admin/import-presencas';
      } else if (importType === 'pagamentos_wix') {
        endpoint = '/api/admin/import-wix-payments';
      } else if (importType === 'pagamentos_pagseguro') {
        endpoint = '/api/admin/import-pagseguro-payments';
      }
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: importType === 'pagamentos_wix' 
          ? JSON.stringify({ payments: importData, mapping: wixMapping }) 
          : importType === 'pagamentos_pagseguro'
            ? JSON.stringify({ payments: importData })
            : JSON.stringify({ rows: importData })
      });
      
      const text = await response.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        if (!response.ok) {
          throw new Error(text || `Erro no servidor (${response.status})`);
        }
        throw new Error('Resposta do servidor inválida (não é JSON)');
      }

      if (!response.ok) {
        throw new Error(data.error || 'Erro desconhecido no servidor');
      }
      setImportResults(data);
      if (data.success > 0 && importType === 'matriculas') {
        await fetchEnrollments();
      }
    } catch (error: any) {
      alert(`Erro na importação: ${error.message || error}`);
    } finally {
      setIsImporting(false);
    }
  };

  const downloadImportTemplate = () => {
    let headers: string[] = [];
    if (importType === 'matriculas') {
      headers = [
        'Nome do Responsável', 'CPF do Responsável', 'Email do Responsável', 'Telefone do Responsável', 'Endereço',
        'Nome do Aluno', 'Data de Nascimento', 'Série', 'Turma Escolar',
        'Responsável 1', 'WhatsApp 1', 'Responsável 2', 'WhatsApp 2',
        'Turma Sport for Kids', 'Unidade', 'Status da Matrícula', 'Data da Matrícula', 'Plano', 'Data de Cancelamento'
      ];
    } else if (importType === 'aulas_experimentais') {
      headers = [
        'Estudante', 'Unidade', 'Curso', 'Aula', 'Horário', 'Responsável 1', 'WhatsApp1', 'Status',
        'Observação Professor', 'Follow-up', 'Lembrete', 'Convertido', 'Etapa', 'Ano Escolar', 'Turma Escolar'
      ];
    } else if (importType === 'ocorrencias') {
      headers = [
        'Data', 'Unidade', 'Estudante', 'Observação', 'Usuário'
      ];
    } else if (importType === 'presencas') {
      headers = [
        'Data', 'Unidade', 'Turma', 'Estudante', 'Status', 'Observação', 'Alarme', 'Timestamp Inclusão'
      ];
    } else if (importType === 'pagamentos_wix') {
      headers = ['ID do Pagamento', 'Data', 'Nome', 'Email', 'Valor', 'Status'];
    } else if (importType === 'pagamentos_pagseguro') {
      headers = ['Documento', 'Estabelecimento', 'Nome Cliente', 'E-mail Cliente', 'Código da Transação', 'Data da Transação', 'Data prevista de liberação', 'Data do cancelamento', 'Bandeira', 'Forma de Pagamento', 'Parcela', 'Valor Bruto', 'Valor Taxa', 'Valor Repasse', 'Valor Líquido', 'Status', 'Número do Cartão', 'Código NSU', 'Código de Autorização', 'Identificação da Maquininha', 'Código da Venda', 'Código Referência', 'Nome Comprador', 'E-mail Comprador', 'Código TX ID (PIX)', 'ID Split'];
    }
    const csvContent = headers.join(';') + '\n'; // Use semicolon as delimiter
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `template_importacao_${importType}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  const [adminTab, setAdminTab] = useState<'tasks' | 'enrollments' | 'settings' | 'waitlist' | 'finance' | 'coupons' | 'import'>('tasks');
  const [tasks, setTasks] = useState<any>([]);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [enrollmentSearch, setEnrollmentSearch] = useState('');
  const [termsTemplate, setTermsTemplate] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [showNotifyModal, setShowNotifyModal] = useState<{ isOpen: boolean, item: any | null }>({ isOpen: false, item: null });
  const [approveCancelModal, setApproveCancelModal] = useState<{ isOpen: boolean, task: any | null, date: string }>({ isOpen: false, task: null, date: '' });
  const [isSavingTerms, setIsSavingTerms] = useState(false);
  const [pagarmeSoftDescriptor, setPagarmeSoftDescriptor] = useState('SportForKids');
  const [pagarmeSoftDescriptorBernoulli, setPagarmeSoftDescriptorBernoulli] = useState('BernoulliMais');
  const [isSavingPagarme, setIsSavingPagarme] = useState(false);
  const [coupons, setCoupons] = useState<any[]>([]);
  const [isAddingCoupon, setIsAddingCoupon] = useState(false);
  const [newCoupon, setNewCoupon] = useState({
    codigo: '',
    nome: '',
    tipo: 'fixo',
    valor: 0,
    aplicar_em: 'primeira_parcela',
    data_inicio: new Date().toISOString().split('T')[0],
    data_expiracao: '',
    limite_uso: null as number | null,
    uso_unico_cliente: false,
    sem_expiracao: true,
    tem_limite_uso: false
  });
  const [editingCouponId, setEditingCouponId] = useState<string | null>(null);
  const [couponToDelete, setCouponToDelete] = useState<string | null>(null);
  const [appliedCoupon, setAppliedCoupon] = useState<any>(null);
  const [couponCode, setCouponCode] = useState('');
  const [couponError, setCouponError] = useState('');
  const isSubmittingRef = useRef(false);
  const [portalTab, setPortalTab] = useState<'dashboard' | 'payments' | 'profile' | 'documents'>('dashboard');
  const [isUpdatingCard, setIsUpdatingCard] = useState(false);
  const [selectedEnrollmentForCard, setSelectedEnrollmentForCard] = useState<string | null>(null);
  const [newCardData, setNewCardData] = useState({
    number: '',
    holder_name: '',
    exp_month: '',
    exp_year: '',
    cvv: ''
  });
  const [payments, setPayments] = useState<any[]>([]);
  const [waitlist, setWaitlist] = useState<any[]>([]);
  const [settingsSearch, setSettingsSearch] = useState('');
  const [financialData, setFinancialData] = useState<{ pagamentos: any[], turmas: any[] } | null>(null);
  const [paymentInfo, setPaymentInfo] = useState<any>(null);
  const [waitlistPosition, setWaitlistPosition] = useState<number | null>(null);
  const [financeFilters, setFinanceFilters] = useState({
    unidade: '',
    professor: '',
    search: '',
    status: '',
    period: '',
    startDate: '',
    endDate: '',
    view: 'summary' as 'summary' | 'detailed',
    paymentMethod: 'geral',
    wixType: ''
  });
  const [newOption, setNewOption] = useState({ 
    type: 'series', 
    nome: '', 
    ordem: 0, 
    unidade_nome: '', 
    series_permitidas: [] as string[],
    idade_minima: 0,
    idade_maxima: 18,
    dias_horarios: '',
    valor_mensalidade: 0,
    capacidade: 0,
    local_aula: '',
    data_inicio: '',
    professor: '',
    status: 'ativo'
  });
  const [editingOption, setEditingOption] = useState<{ type: string, oldNome: string } | null>(null);
  const [options, setOptions] = useState<{
    series: string[], 
    unidades: string[], 
    turmas: { 
      id?: string,
      nome: string, 
      unidade_nome?: string, 
      unidade?: string,
      unidade_atendimento?: string,
      series_permitidas?: string[] | string,
      series?: string[] | string,
      idade_minima?: number,
      idade_maxima?: number,
      dias_horarios?: string,
      valor_mensalidade?: number,
      capacidade?: number,
      ocupacao_atual?: number,
      local_aula?: string,
      data_inicio?: string,
      professor?: string,
      status?: string
    }[]
  }>({
    series: [],
    unidades: [],
    turmas: []
  });

  const mergedTasks = React.useMemo(() => {
    if (!Array.isArray(tasks)) return tasks;
    
    const waitlistTasks = waitlist
      .filter(item => {
        if (item.status === 'chamado') return false;
        const turma = options.turmas.find(t => t.nome === item.turma);
        return turma && (turma.ocupacao_atual || 0) < (turma.capacidade || 0);
      })
      .map(item => ({
        id: `waitlist-${item.id}`,
        tipo: 'vaga_disponivel',
        status: 'pendente',
        created_at: item.created_at,
        alunos: { nome_completo: item.estudante },
        responsaveis: { nome_completo: item.responsavel1 },
        detalhes: {
          turma: item.turma,
          unidade: item.unidade,
          waitlistItem: item
        }
      }));

    return [...waitlistTasks, ...tasks];
  }, [tasks, waitlist, options.turmas]);

  const [formData, setFormData] = useState({
    guardian: { 
      id: '', 
      name: '', 
      cpf: '', 
      email: '', 
      phone: '', 
      address: '', 
      password: '',
      zipCode: '',
      street: '',
      number: '',
      complement: '',
      neighborhood: '',
      city: '',
      state: ''
    },
    student: { 
      name: '', 
      birthDate: '', 
      grade: '',
      turmaEscolar: '',
      responsavel1: '',
      whatsapp1: '',
      responsavel2: '',
      whatsapp2: '',
      unidade: '',
      turmaComplementar: ''
    },
    paymentMethod: 'credit_card' as 'credit_card' | 'pix',
    card: {
      number: '',
      holderName: '',
      expMonth: '',
      expYear: '',
      cvv: ''
    }
  });

  const [transferringEnrollmentId, setTransferringEnrollmentId] = useState<string | null>(null);
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  
  const [pixClickCount, setPixClickCount] = useState(0);
  const [showPixOption, setShowPixOption] = useState(false);

  const handlePixSecretClick = () => {
    const newCount = pixClickCount + 1;
    setPixClickCount(newCount);
    if (newCount >= 5) {
      setShowPixOption(true);
    }
  };
  
  const passwordInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (guardianExists === true && !formData.guardian.name) {
      setTimeout(() => {
        passwordInputRef.current?.focus();
      }, 100);
    }
  }, [guardianExists, formData.guardian.name]);
  const [adminLogin, setAdminLogin] = useState({ username: '', password: '' });

  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (adminLogin.username === 'bmaia' && adminLogin.password === '@Bm250575') {
      setIsAdminAuthenticated(true);
    } else {
      alert('Credenciais administrativas inválidas.');
    }
  };

  const groupedDependents = React.useMemo(() => {
    const groups: { [key: string]: any } = {};
    dependents.forEach(dep => {
      const key = `${dep.nome_completo}-${dep.data_nascimento}`;
      if (!groups[key]) {
        groups[key] = {
          ...dep,
          matriculasAtivas: [],
          historico: []
        };
      }
      if (dep.turma) {
        const matInfo = {
          id: dep.id,
          turma: dep.turma,
          unidade: dep.unidade,
          status: dep.status,
          data_matricula: dep.data_matricula,
          pagarme_subscription_id: dep.pagarme_subscription_id,
          horario: dep.horario,
          data_cancelamento: dep.data_cancelamento
        };
        
        if (dep.data_cancelamento) {
          groups[key].historico.push(matInfo);
        } else {
          groups[key].matriculasAtivas.push(matInfo);
        }
      }
    });
    return Object.values(groups);
  }, [dependents]);

  const formatDateShort = (dateStr: string | undefined) => {
    if (!dateStr) return 'N/A';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return 'N/A';
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = String(d.getFullYear()).slice(-2);
    return `${day}/${month}/${year}`;
  };

  const filteredFlattenedEnrollments = React.useMemo(() => {
    const list: any[] = [];
    enrollments.forEach(enrollment => {
      enrollment.alunos.forEach(aluno => {
        aluno.matriculas.forEach(mat => {
          const search = enrollmentSearch.toLowerCase();
          const matches = enrollment.nome_completo?.toLowerCase().includes(search) ||
                          aluno.nome_completo?.toLowerCase().includes(search);
          if (matches) {
            list.push({
              ...enrollment,
              aluno: { ...aluno, matriculas: undefined },
              matricula: mat
            });
          }
        });
      });
    });
    
    return list.sort((a, b) => {
      const dateA = a.matricula.data_matricula ? new Date(a.matricula.data_matricula).getTime() : 0;
      const dateB = b.matricula.data_matricula ? new Date(b.matricula.data_matricula).getTime() : 0;
      return dateB - dateA;
    });
  }, [enrollments, enrollmentSearch]);

  const refreshGuardianData = async () => {
    if (!formData.guardian.cpf || !formData.guardian.password) return;
    try {
      const response = await fetch('/api/guardian/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          cpf: formData.guardian.cpf, 
          password: formData.guardian.password 
        })
      });
      const data = await response.json();
      if (response.ok) {
        let parsedAddress = { zipCode: '', street: '', number: '', complement: '', neighborhood: '', city: '', state: '' };
        try {
          if (data.endereco && data.endereco.startsWith('{')) {
            parsedAddress = JSON.parse(data.endereco);
          } else {
            parsedAddress.street = data.endereco || '';
          }
        } catch (e) {
          parsedAddress.street = data.endereco || '';
        }

        setFormData(prev => ({
          ...prev,
          guardian: {
            ...prev.guardian,
            id: data.id,
            name: data.nome_completo || '',
            email: data.email || '',
            phone: data.telefone || '',
            address: data.endereco || '',
            ...parsedAddress
          }
        }));
        setDependents(data.alunos || []);
        setHasFidelityDiscount(data.hasActiveEnrollments || false);
      }
    } catch (error) {
      console.error('Error refreshing guardian data:', error);
    }
  };

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const keys = [
          'terms_template',
          'pagarme_soft_descriptor',
          'pagarme_soft_descriptor_bernoulli'
        ];
        const res = await fetch(`/api/settings/bulk?keys=${keys.join(',')}`);
        
        if (!res.ok) {
          const text = await res.text();
          throw new Error(`HTTP ${res.status}: ${text.substring(0, 100)}`);
        }
        
        const contentType = res.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
          const text = await res.text();
          throw new Error(`Expected JSON but got: ${text.substring(0, 100)}`);
        }
        
        const data = await res.json();
        if (data.terms_template) setTermsTemplate(data.terms_template);
        if (data.pagarme_soft_descriptor) setPagarmeSoftDescriptor(data.pagarme_soft_descriptor);
        if (data.pagarme_soft_descriptor_bernoulli) setPagarmeSoftDescriptorBernoulli(data.pagarme_soft_descriptor_bernoulli);
      } catch (err) {
        console.error("Error fetching settings:", err);
      }
    };
    
    fetchSettings();
  }, []);

  const handleSavePagarmeSettings = async () => {
    setIsSavingPagarme(true);
    try {
      await Promise.all([
        fetch('/api/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key: 'pagarme_soft_descriptor', value: pagarmeSoftDescriptor })
        }),
        fetch('/api/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key: 'pagarme_soft_descriptor_bernoulli', value: pagarmeSoftDescriptorBernoulli })
        })
      ]);
      alert('Configurações do Pagar.me salvas com sucesso!');
    } catch (error) {
      console.error('Error saving Pagar.me settings:', error);
      alert('Erro ao salvar configurações do Pagar.me');
    } finally {
      setIsSavingPagarme(false);
    }
  };
  const handleSaveTerms = async () => {
    setIsSavingTerms(true);
    try {
      const response = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'terms_template', value: termsTemplate })
      });
      if (response.ok) {
        alert("Termos salvos com sucesso!");
      } else {
        throw new Error("Falha ao salvar");
      }
    } catch (error: any) {
      console.error(error);
      alert(`Erro ao salvar os termos: ${error.message || 'Erro desconhecido'}. Certifique-se de que a tabela 'configuracoes' existe no seu Supabase com as colunas 'chave' (PK) e 'valor'.`);
    } finally {
      setIsSavingTerms(false);
    }
  };

  const calculateFinalPrice = () => {
    const selectedTurma = options.turmas.find(t => t.nome === formData.student.turmaComplementar);
    if (!selectedTurma) return 0;

    const originalPrice = selectedTurma.valor_mensalidade || 0;
    let couponDiscount = 0;
    if (appliedCoupon) {
      if (appliedCoupon.tipo === 'fixo') {
        couponDiscount = appliedCoupon.valor;
      } else {
        couponDiscount = (originalPrice * appliedCoupon.valor) / 100;
      }
    }
    
    const priceAfterCoupon = Math.max(0, originalPrice - couponDiscount);
    const fidelityDiscount = hasFidelityDiscount ? (priceAfterCoupon * 0.10) : 0;
    return Math.max(0, priceAfterCoupon - fidelityDiscount);
  };

  const getPopulatedTerms = () => {
    let populated = termsTemplate;
    const selectedTurma = options.turmas.find(t => t.nome === formData.student.turmaComplementar);
    const finalPrice = calculateFinalPrice();
    const basePrice = selectedTurma?.valor_mensalidade || 0;
    const valorPadrao = basePrice * 1.10;
    const taxZeroDiscount = basePrice * 0.10;
    const fullValue = basePrice;
    
    const formatCurrency = (val: number) => `R$ ${val.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

    populated = populated.replace(/\[ESTUDANTE\]/g, formData.student.name || '__________');
    populated = populated.replace(/\[RESPONSAVEL\]/g, formData.guardian.name || '__________');
    populated = populated.replace(/\[UNIDADE\]/g, formData.student.unidade || '__________');
    populated = populated.replace(/\[CURSO\]/g, formData.student.turmaComplementar || '__________');
    populated = populated.replace(/\[INICIO\]/g, selectedTurma?.data_inicio ? new Date(selectedTurma.data_inicio).toLocaleDateString() : '__________');
    populated = populated.replace(/\[FIM\]/g, '__________'); 
    populated = populated.replace(/\[VALOR\]/g, formatCurrency(finalPrice));
    populated = populated.replace(/\[VALOR PADRAO\]/g, formatCurrency(valorPadrao));
    populated = populated.replace(/\[desconto taxa zero\]/g, formatCurrency(taxZeroDiscount));
    populated = populated.replace(/\[VALOR CHEIO\]/g, formatCurrency(fullValue));
    
    return populated;
  };

  const handleUpdateCard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEnrollmentForCard) return;

    setLoading(true);
    try {
      const response = await fetch('/api/portal/subscription/card', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enrollmentId: selectedEnrollmentForCard,
          card: newCardData
        })
      });

      const data = await response.json();
      if (response.ok) {
        alert('Cartão atualizado com sucesso!');
        setIsUpdatingCard(false);
        setNewCardData({ number: '', holder_name: '', exp_month: '', exp_year: '', cvv: '' });
      } else {
        alert(data.error || 'Erro ao atualizar cartão.');
      }
    } catch (error) {
      console.error('Error updating card:', error);
      alert('Erro de conexão ao atualizar cartão.');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadContract = (enrollmentId: string) => {
    window.open(`/api/portal/documents/contract/${enrollmentId}`, '_blank');
  };

  const handleDownloadReceipt = (paymentId: string) => {
    window.open(`/api/portal/documents/receipt/${paymentId}`, '_blank');
  };

  const handleCancelEnrollment = (id: string) => {
    setCancelingEnrollmentId(id);
    setIsCancelingEnrollment(true);
  };

  const confirmCancelEnrollment = async () => {
    if (!cancelingEnrollmentId) return;

    const today = new Date().toISOString().split('T')[0];
    if (step === 'portal' && cancellationDate < today) {
      setErrorMessage('A data de cancelamento não pode ser anterior à data de hoje.');
      return;
    }

    if (!cancellationReason.trim()) {
      setErrorMessage('Por favor, informe uma justificativa para o cancelamento.');
      return;
    }
    
    console.log("Canceling enrollment ID:", cancelingEnrollmentId);
    console.log("Dependents:", dependents);
    console.log("Found dependent:", dependents.find(d => d.id === cancelingEnrollmentId));
    console.log("Found aluno_id:", dependents.find(d => d.id === cancelingEnrollmentId)?.aluno_id);

    setLoading(true);
    try {
      if (step === 'portal') {
        // Create a task instead of direct cancellation
        const response = await fetch('/api/tasks/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            tipo: 'cancelamento',
            responsavel_id: formData.guardian.id,
            aluno_id: step === 'portal' 
              ? dependents.find(d => d.id === cancelingEnrollmentId)?.aluno_id
              : enrollments.find(e => e.alunos.some(a => a.matriculas.some(m => m.id === cancelingEnrollmentId)))?.alunos.find(a => a.matriculas.some(m => m.id === cancelingEnrollmentId))?.id,
            matricula_id: cancelingEnrollmentId,
            detalhes: {
              data_cancelamento: cancellationDate,
              justificativa: cancellationReason
            }
          })
        });
        if (response.ok) {
          setSuccessMessage('Sua solicitação de cancelamento foi enviada para análise da equipe administrativa.');
          setIsCancelingEnrollment(false);
          setCancelingEnrollmentId(null);
          setCancellationReason('');
        } else {
          const data = await response.json();
          setErrorMessage(data.error || 'Erro ao enviar solicitação');
        }
      } else {
        const response = await fetch('/api/enrollment/cancel', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            enrollmentId: cancelingEnrollmentId,
            cancellationDate: cancellationDate,
            justificativa: cancellationReason
          })
        });
        if (response.ok) {
          await fetchEnrollments();
          await fetchFinancialData();
          setSuccessMessage('Matrícula cancelada com sucesso');
          setIsCancelingEnrollment(false);
          setCancelingEnrollmentId(null);
          setCancellationReason('');
        } else {
          const data = await response.json();
          setErrorMessage(data.error || 'Erro ao cancelar matrícula');
        }
      }
    } catch (error: any) {
      console.error('Error canceling enrollment:', error);
      setErrorMessage(`Erro de conexão: ${error.message || 'Erro desconhecido'}`);
    } finally {
      setLoading(false);
    }
  };

  const confirmFreezeEnrollment = async () => {
    if (!freezingEnrollmentId) return;
    setLoading(true);
    try {
      const response = await fetch('/api/enrollment/freeze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          enrollmentId: freezingEnrollmentId,
          startDate: freezeStartDate,
          endDate: freezeEndDate
        })
      });
      if (response.ok) {
        await fetchEnrollments();
        await fetchFinancialData();
        alert('Matrícula trancada com sucesso');
        setIsFreezingEnrollment(false);
        setFreezingEnrollmentId(null);
      } else {
        const data = await response.json();
        alert(data.error || 'Erro ao trancar matrícula');
      }
    } catch (error) {
      console.error('Error freezing enrollment:', error);
      alert('Erro de conexão');
    } finally {
      setLoading(false);
    }
  };

  const confirmReactivateEnrollment = async () => {
    if (!reactivatingEnrollmentId) return;
    setLoading(true);
    try {
      const response = await fetch('/api/enrollment/reactivate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          enrollmentId: reactivatingEnrollmentId,
          reactivationDate: reactivationDate
        })
      });
      if (response.ok) {
        const data = await response.json();
        await fetchEnrollments();
        await fetchFinancialData();
        alert(`Matrícula reativada com sucesso! As próximas cobranças foram postergadas em ${data.daysPostponed} dias.`);
        setIsReactivatingEnrollment(false);
        setReactivatingEnrollmentId(null);
      } else {
        const data = await response.json();
        alert(data.error || 'Erro ao reativar matrícula');
      }
    } catch (error) {
      console.error('Error reactivating enrollment:', error);
      alert('Erro de conexão');
    } finally {
      setLoading(false);
    }
  };

  const confirmTransferEnrollment = async () => {
    if (!transferringEnrollmentId || !transferTarget.turma) return;
    setLoading(true);
    try {
      if (step === 'portal') {
        // Create a task instead of direct transfer
        const response = await fetch('/api/tasks/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            tipo: 'transferencia',
            responsavel_id: formData.guardian.id,
            aluno_id: transferringStudent?.id,
            matricula_id: transferringEnrollmentId,
            detalhes: {
              nova_turma: transferTarget.turma,
              nova_unidade: transferTarget.unidade
            }
          })
        });
        if (response.ok) {
          setSuccessMessage('Sua solicitação de transferência foi enviada para análise da equipe administrativa.');
          setIsTransferringEnrollment(false);
          setTransferringEnrollmentId(null);
        } else {
          const data = await response.json();
          setErrorMessage(data.error || 'Erro ao enviar solicitação');
        }
      } else {
        const response = await fetch('/api/enrollment/transfer', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            enrollmentId: transferringEnrollmentId,
            newTurma: transferTarget.turma,
            newUnidade: transferTarget.unidade
          })
        });
        if (response.ok) {
          await fetchEnrollments();
          await fetchFinancialData();
          setSuccessMessage('Transferência realizada com sucesso');
          setIsTransferringEnrollment(false);
          setTransferringEnrollmentId(null);
        } else {
          const data = await response.json();
          setErrorMessage(data.error || 'Erro ao transferir matrícula');
        }
      }
    } catch (error: any) {
      console.error('Error transferring enrollment:', error);
      setErrorMessage(`Erro de conexão: ${error.message || 'Erro desconhecido'}`);
    } finally {
      setLoading(false);
    }
  };

  const fetchTasks = async () => {
    setLoadingTasks(true);
    try {
      const response = await fetch('/api/tasks');
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.indexOf("application/json") !== -1) {
        const data = await response.json();
        if (response.ok) {
          setTasks(data);
        } else {
          setTasks({ error: data.error || 'Erro desconhecido' });
          console.error('Error fetching tasks (server):', data.error);
        }
      } else {
        const text = await response.text();
        setTasks({ error: text || 'Erro desconhecido' });
        console.error('Error fetching tasks (server text):', text);
      }
    } catch (error: any) {
      setTasks({ error: error.message || 'Erro de conexão' });
      console.error('Error fetching tasks (network/json):', error.message || error);
    } finally {
      setLoadingTasks(false);
    }
  };

  const handleApproveTask = async (task: any, customCancellationDate?: string) => {
    if (task.tipo === 'cancelamento' && !customCancellationDate) {
      setApproveCancelModal({
        isOpen: true,
        task: task,
        date: task.detalhes.data_cancelamento || new Date().toISOString().split('T')[0]
      });
      return;
    }

    if (task.tipo !== 'cancelamento' && !window.confirm('Deseja realmente aprovar esta solicitação?')) return;
    
    setLoading(true);
    try {
      let endpoint = '';
      let body = {};
      if (task.tipo === 'cancelamento') {
        endpoint = '/api/enrollment/cancel';
        body = {
          enrollmentId: task.matricula_id,
          cancellationDate: customCancellationDate || task.detalhes.data_cancelamento,
          justificativa: task.detalhes.justificativa
        };
      } else if (task.tipo === 'transferencia') {
        endpoint = '/api/enrollment/transfer';
        body = {
          enrollmentId: task.matricula_id,
          newTurma: task.detalhes.nova_turma,
          newUnidade: task.detalhes.nova_unidade
        };
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (response.ok) {
        await fetch('/api/tasks/update-status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ taskId: task.id, status: 'concluido' })
        });
        alert('Solicitação aprovada e processada com sucesso!');
        fetchTasks();
        fetchEnrollments();
      } else {
        const data = await response.json();
        alert(data.error || 'Erro ao processar solicitação');
      }
    } catch (error) {
      console.error('Error approving task:', error);
      alert('Erro de conexão');
    } finally {
      setLoading(false);
    }
  };

  const handleRejectTask = async (taskId: string) => {
    if (!window.confirm('Deseja realmente rejeitar esta solicitação?')) return;
    try {
      const response = await fetch('/api/tasks/update-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId, status: 'rejeitado' })
      });
      if (response.ok) {
        alert('Solicitação rejeitada.');
        fetchTasks();
      }
    } catch (error) {
      console.error('Error rejecting task:', error);
    }
  };

  const fetchOptions = async () => {
    try {
      const response = await fetch('/api/options');
      const contentType = response.headers.get("content-type");
      if (!contentType || contentType.indexOf("application/json") === -1) {
        console.error('Error fetching options (text):', await response.text());
        setOptions({ series: [], unidades: [], turmas: [] });
        return;
      }
      const data = await response.json();
      console.log('Fetched options:', data);
      if (data && Array.isArray(data.series) && Array.isArray(data.unidades) && Array.isArray(data.turmas)) {
        setOptions(data);
      } else {
        setOptions({ series: [], unidades: [], turmas: [] });
      }
    } catch (error) {
      console.error('Error fetching options:', error);
      setOptions({ series: [], unidades: [], turmas: [] });
    }
  };

  const fetchEnrollments = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/enrollments');
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.indexOf("application/json") !== -1) {
        const data = await response.json();
        if (response.ok) {
          setEnrollments(Array.isArray(data) ? data : []);
        } else {
          console.error('API Error fetching enrollments:', data.error);
          setEnrollments([]);
          alert('Erro ao carregar matrículas: ' + (data.error || 'Erro desconhecido'));
        }
      } else {
        const text = await response.text();
        console.error('API Error fetching enrollments (text):', text);
        setEnrollments([]);
        alert('Erro ao carregar matrículas: ' + (text || 'Erro desconhecido'));
      }
    } catch (error) {
      console.error('Error fetching enrollments:', error);
      setEnrollments([]);
      alert('Erro de rede ao carregar matrículas.');
    } finally {
      setLoading(false);
    }
  };

  const checkCPF = async (cpf: string) => {
    // Basic CPF format check (could be more robust)
    const cleanCPF = cpf.replace(/\D/g, '');
    if (cleanCPF.length !== 11) return;

    setSearchingGuardian(true);
    try {
      const response = await fetch(`/api/guardian/${cpf}`);
      const contentType = response.headers.get("content-type");
      if (!contentType || contentType.indexOf("application/json") === -1) {
        console.error('Error checking CPF (text):', await response.text());
        return;
      }
      
      const data = await response.json();
      
      if (data && data.exists) {
        setGuardianExists(true);
        setHasFidelityDiscount(data.hasActiveEnrollments || false);
        // We don't auto-fill yet, wait for password
      } else {
        setGuardianExists(false);
        setHasFidelityDiscount(false);
        setDependents([]);
      }
    } catch (error) {
      console.error('Error checking CPF:', error);
    } finally {
      setSearchingGuardian(false);
    }
  };

  const fetchPayments = async (guardianId: string) => {
    try {
      const response = await fetch(`/api/payments/${guardianId}`);
      const contentType = response.headers.get("content-type");
      if (response.ok && contentType && contentType.indexOf("application/json") !== -1) {
        const data = await response.json();
        setPayments(data);
      } else if (!response.ok) {
        console.error('Error fetching payments:', await response.text());
      }
    } catch (error) {
      console.error('Error fetching payments:', error);
    }
  };

  const verifyPassword = async () => {
    if (!formData.guardian.password) return;
    
    setVerifyingPassword(true);
    try {
      const response = await fetch('/api/guardian/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          cpf: formData.guardian.cpf, 
          password: formData.guardian.password 
        })
      });
      
      const contentType = response.headers.get("content-type");
      if (!contentType || contentType.indexOf("application/json") === -1) {
        const text = await response.text();
        setAccessError(text || "Erro de servidor");
        return;
      }
      
      const data = await response.json();
      
      if (response.ok) {
        let parsedAddress = { zipCode: '', street: '', number: '', complement: '', neighborhood: '', city: '', state: '' };
        try {
          if (data.endereco && data.endereco.startsWith('{')) {
            parsedAddress = JSON.parse(data.endereco);
          } else {
            parsedAddress.street = data.endereco || '';
          }
        } catch (e) {
          parsedAddress.street = data.endereco || '';
        }

        setFormData(prev => ({
          ...prev,
          guardian: {
            ...prev.guardian,
            id: data.id,
            name: data.nome_completo || '',
            email: data.email || '',
            phone: data.telefone || '',
            address: data.endereco || '',
            ...parsedAddress
          }
        }));
        setDependents(data.alunos || []);
        setHasFidelityDiscount(data.hasActiveEnrollments || false);
        fetchPayments(data.id);
        setStep('portal');
      } else {
        alert(data.error || 'Senha incorreta');
      }
    } catch (error) {
      console.error('Error verifying password:', error);
      alert('Erro ao verificar senha');
    } finally {
      setVerifyingPassword(false);
    }
  };

  const handleAccess = async () => {
    if (!loginIdentifier) return;
    
    setSearchingGuardian(true);
    try {
      const response = await fetch('/api/guardian/access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: loginIdentifier, password: loginPassword })
      });
      
      const contentType = response.headers.get("content-type");
      if (!contentType || contentType.indexOf("application/json") === -1) {
        const text = await response.text();
        setAccessError(text || "Erro de servidor");
        return;
      }
      
      const data = await response.json();
      
      if (response.ok) {
        setAccessError(null);
        if (data.needsProfileCompletion) {
          setIsTemporaryCpf(!!data.isTemporaryCpf);
          setIsFirstAccess(!!data.isFirstAccess);
          setFormData(prev => ({
            ...prev,
            guardian: {
              ...prev.guardian,
              id: data.guardian.id,
              name: data.guardian.nome_completo || '',
              email: data.guardian.email || '',
              phone: data.guardian.telefone || '',
              address: data.guardian.endereco || '',
              cpf: data.isTemporaryCpf ? '' : (data.guardian.cpf || '')
            }
          }));
          setStep('complete_profile');
        } else {
          let parsedAddress = { zipCode: '', street: '', number: '', complement: '', neighborhood: '', city: '', state: '' };
          try {
            if (data.endereco && data.endereco.startsWith('{')) {
              parsedAddress = JSON.parse(data.endereco);
            } else {
              parsedAddress.street = data.endereco || '';
            }
          } catch (e) {
            parsedAddress.street = data.endereco || '';
          }

          setFormData(prev => ({
            ...prev,
            guardian: {
              ...prev.guardian,
              id: data.id,
              name: data.nome_completo || '',
              cpf: data.cpf || '',
              email: data.email || '',
              phone: data.telefone || '',
              address: data.endereco || '',
              ...parsedAddress
            }
          }));
          setDependents(data.alunos || []);
          setHasFidelityDiscount(data.hasActiveEnrollments || false);
          fetchPayments(data.id);
          setStep('portal');
        }
      } else {
        setAccessError(data.error || "Cadastro não localizado.");
      }
    } catch (error) {
      console.error('Error accessing guardian panel:', error);
      alert('Erro ao acessar o painel');
    } finally {
      setSearchingGuardian(false);
    }
  };

  const handleCompleteProfile = async () => {
    if (!formData.guardian.cpf || !formData.guardian.password) {
      alert('CPF e Senha são obrigatórios');
      return;
    }

    setIsCompletingProfile(true);
    try {
      const response = await fetch('/api/guardian/complete-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: formData.guardian.id,
          cpf: formData.guardian.cpf,
          name: formData.guardian.name,
          email: formData.guardian.email,
          phone: formData.guardian.phone,
          address: JSON.stringify({
            zipCode: formData.guardian.zipCode,
            street: formData.guardian.street,
            number: formData.guardian.number,
            complement: formData.guardian.complement,
            neighborhood: formData.guardian.neighborhood,
            city: formData.guardian.city,
            state: formData.guardian.state
          }),
          password: formData.guardian.password
        })
      });

      const contentType = response.headers.get("content-type");
      if (!contentType || contentType.indexOf("application/json") === -1) {
        const text = await response.text();
        alert(text || "Erro de servidor");
        return;
      }

      const data = await response.json();
      if (response.ok) {
        setFormData(prev => ({
          ...prev,
          guardian: {
            ...prev.guardian,
            ...data.guardian
          }
        }));
        setDependents(data.guardian.alunos || []);
        setStep('portal');
      } else {
        alert(data.error || 'Erro ao completar perfil');
      }
    } catch (error) {
      console.error('Error completing profile:', error);
      alert('Erro de conexão');
    } finally {
      setIsCompletingProfile(false);
    }
  };

  const recoverLoginPassword = async () => {
    if (!loginIdentifier) {
      setAccessError('Por favor, informe seu CPF ou E-mail primeiro.');
      return;
    }
    
    setRecoveringPassword(true);
    try {
      const response = await fetch('/api/guardian/recover-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: loginIdentifier })
      });
      
      const contentType = response.headers.get("content-type");
      if (!contentType || contentType.indexOf("application/json") === -1) {
        const text = await response.text();
        setAccessError(text || "Erro de servidor");
        return;
      }
      
      const data = await response.json();
      
      if (response.ok) {
        setSuccessMessage('Sua senha de acesso foi enviada por WhatsApp ao contato cadastrado.');
      } else {
        setAccessError(data.error || 'Erro ao recuperar senha');
      }
    } catch (error: any) {
      console.error('Error recovering password:', error);
      setErrorMessage(`Erro de conexão ao recuperar senha: ${error.message || 'Erro desconhecido'}`);
    } finally {
      setRecoveringPassword(false);
    }
  };

  const recoverPassword = async () => {
    if (!formData.guardian.cpf) return;
    
    setRecoveringPassword(true);
    try {
      const response = await fetch('/api/guardian/recover-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cpf: formData.guardian.cpf })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setSuccessMessage('Sua senha de acesso foi enviada por WhatsApp ao contato cadastrado.');
      } else {
        setErrorMessage(data.error || 'Erro ao recuperar senha');
      }
    } catch (error: any) {
      console.error('Error recovering password:', error);
      setErrorMessage(`Erro de conexão ao recuperar senha: ${error.message || 'Erro desconhecido'}`);
    } finally {
      setRecoveringPassword(false);
    }
  };

  const fetchAddressByCep = async (cep: string) => {
    const cleanCep = cep.replace(/\D/g, '');
    if (cleanCep.length !== 8) return;

    setIsFetchingAddress(true);
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
      const data = await response.json();
      
      if (!data.erro) {
        setFormData(prev => ({
          ...prev,
          guardian: {
            ...prev.guardian,
            street: data.logradouro || '',
            neighborhood: data.bairro || '',
            city: data.localidade || '',
            state: data.uf || ''
          }
        }));
      }
    } catch (error) {
      console.error('Error fetching address by CEP:', error);
    } finally {
      setIsFetchingAddress(false);
    }
  };

  const updateGuardian = async () => {
    setLoading(true);
    try {
      const addressJson = JSON.stringify({
        zipCode: formData.guardian.zipCode,
        street: formData.guardian.street,
        number: formData.guardian.number,
        complement: formData.guardian.complement,
        neighborhood: formData.guardian.neighborhood,
        city: formData.guardian.city,
        state: formData.guardian.state
      });

      const response = await fetch('/api/guardian/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cpf: formData.guardian.cpf,
          name: formData.guardian.name,
          email: formData.guardian.email,
          phone: formData.guardian.phone,
          address: addressJson,
          password: isChangingPassword ? formData.guardian.password : undefined
        })
      });
      
      if (response.ok) {
        alert('Dados atualizados com sucesso!');
        setIsEditingGuardian(false);
        setIsChangingPassword(false);
      } else {
        const data = await response.json();
        alert(data.error || 'Erro ao atualizar dados');
      }
    } catch (error) {
      console.error('Error updating guardian:', error);
      alert('Erro de conexão ao atualizar dados');
    } finally {
      setLoading(false);
    }
  };

  const handleAddOption = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOption.nome) return;

    try {
      const url = editingOption 
        ? `/api/options/${editingOption.type}/${encodeURIComponent(editingOption.oldNome)}`
        : `/api/options/${newOption.type}`;
      
      const method = editingOption ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          nome: newOption.nome, 
          ordem: newOption.type === 'series' ? Number(newOption.ordem) : undefined,
          unidade_nome: newOption.type === 'turmas' ? newOption.unidade_nome : undefined,
          series_permitidas: newOption.type === 'turmas' ? newOption.series_permitidas : undefined,
          idade_minima: newOption.type === 'turmas' ? Number(newOption.idade_minima) : undefined,
          idade_maxima: newOption.type === 'turmas' ? Number(newOption.idade_maxima) : undefined,
          dias_horarios: newOption.type === 'turmas' ? newOption.dias_horarios : undefined,
          valor_mensalidade: newOption.type === 'turmas' ? Number(newOption.valor_mensalidade) : undefined,
          capacidade: newOption.type === 'turmas' ? Number(newOption.capacidade) : undefined,
          local_aula: newOption.type === 'turmas' ? newOption.local_aula : undefined,
          data_inicio: newOption.type === 'turmas' ? newOption.data_inicio : undefined,
          professor: newOption.type === 'turmas' ? newOption.professor : undefined,
          status: newOption.type === 'turmas' ? newOption.status : undefined
        })
      });

      if (response.ok) {
        setNewOption({ 
          ...newOption, 
          nome: '', 
          ordem: (newOption.ordem || 0) + 1, 
          unidade_nome: '', 
          series_permitidas: [],
          idade_minima: 0,
          idade_maxima: 18,
          dias_horarios: '',
          valor_mensalidade: 0,
          capacidade: 0,
          local_aula: '',
          data_inicio: '',
          professor: '',
          status: 'ativo'
        });
        setEditingOption(null);
        fetchOptions();
      }
    } catch (error) {
      console.error('Error adding/updating option:', error);
    }
  };

  const handleEditOption = (type: string, item: any) => {
    if (type === 'series' || type === 'unidades') {
      setNewOption({
        ...newOption,
        type: type === 'series' ? 'series' : 'unidades',
        nome: item,
        ordem: type === 'series' ? options.series.indexOf(item) : 0
      });
      setEditingOption({ type, oldNome: item });
    } else if (type === 'turmas') {
      setNewOption({
        type: 'turmas',
        nome: item.nome,
        unidade_nome: item.unidade_nome || '',
        series_permitidas: item.series_permitidas || [],
        idade_minima: item.idade_minima || 0,
        idade_maxima: item.idade_maxima || 18,
        dias_horarios: item.dias_horarios || '',
        valor_mensalidade: item.valor_mensalidade || 0,
        capacidade: item.capacidade || 0,
        local_aula: item.local_aula || '',
        data_inicio: item.data_inicio || '',
        professor: item.professor || '',
        status: item.status || 'ativo',
        ordem: 0
      });
      setEditingOption({ type: 'turmas', oldNome: item.nome });
    }
  };

  const handleDeleteOption = async (type: string, nome: string) => {
    if (!confirm(`Deseja realmente excluir "${nome}"?`)) return;

    try {
      const response = await fetch(`/api/options/${type}/${encodeURIComponent(nome)}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        fetchOptions();
      }
    } catch (error) {
      console.error('Error deleting option:', error);
    }
  };

  const fetchWaitlist = async () => {
    try {
      const response = await fetch('/api/waitlist');
      const data = await response.json();
      setWaitlist(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching waitlist:', error);
      setWaitlist([]);
    }
  };

  const fetchFinancialData = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/financial-report');
      const data = await response.json();
      if (response.ok && data && Array.isArray(data.pagamentos) && Array.isArray(data.turmas)) {
        setFinancialData(data);
      } else {
        console.error('API Error fetching financial data:', data.error || data);
        setFinancialData({ pagamentos: [], turmas: [] });
        alert('Erro ao carregar dados financeiros: ' + (data.error || 'Formato de dados inválido'));
      }
    } catch (error) {
      console.error('Error fetching financial data:', error);
      setFinancialData({ pagamentos: [], turmas: [] });
      alert('Erro de rede ao carregar dados financeiros.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOptions();
    if (step === 'admin') {
      fetchEnrollments();
      fetchWaitlist();
    }
  }, [step]);

  const fetchCoupons = async () => {
    try {
      const response = await fetch('/api/coupons');
      const data = await response.json();
      setCoupons(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching coupons:', error);
      setCoupons([]);
    }
  };

  const handleSyncPayments = async () => {
    if (!window.confirm('Deseja sincronizar os últimos 50 pagamentos pendentes com o Pagar.me? Isso pode levar alguns segundos.')) return;
    
    setLoading(true);
    try {
      const response = await fetch('/api/admin/sync-payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      const data = await response.json();
      
      if (response.ok) {
        alert(data.message || 'Sincronização concluída com sucesso!');
        // Refresh financial data
        const finResponse = await fetch('/api/admin/financial-report');
        if (finResponse.ok) {
          const finData = await finResponse.json();
          setFinancialData(finData);
        }
      } else {
        alert('Erro ao sincronizar: ' + (data.error || 'Erro desconhecido'));
      }
    } catch (error) {
      console.error('Error syncing payments:', error);
      alert('Erro de conexão ao sincronizar pagamentos.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newCoupon.codigo.trim()) {
      alert('O código do cupom é obrigatório.');
      return;
    }
    if (newCoupon.valor <= 0) {
      alert('O valor do desconto deve ser maior que zero.');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        ...newCoupon,
        codigo: newCoupon.codigo.trim().toUpperCase(),
        data_expiracao: (newCoupon.sem_expiracao || !newCoupon.data_expiracao) ? null : newCoupon.data_expiracao,
        limite_uso: newCoupon.tem_limite_uso ? (newCoupon.limite_uso || null) : null,
        usos_atuais: 0,
        ativo: true
      };
      
      // Remove UI-only fields
      const { sem_expiracao, tem_limite_uso, ...dbPayload } = payload as any;

      const url = editingCouponId ? `/api/coupons/${editingCouponId}` : '/api/coupons';
      const method = editingCouponId ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dbPayload)
      });

      if (response.ok) {
        await fetchCoupons();
        setIsAddingCoupon(false);
        setEditingCouponId(null);
        setNewCoupon({
          codigo: '',
          nome: '',
          tipo: 'fixo',
          valor: 0,
          aplicar_em: 'primeira_parcela',
          data_inicio: new Date().toISOString().split('T')[0],
          data_expiracao: '',
          limite_uso: null,
          uso_unico_cliente: false,
          sem_expiracao: true,
          tem_limite_uso: false
        });
      } else {
        const errData = await response.json();
        alert(`Erro ao criar cupom: ${errData.error || 'Erro desconhecido'}`);
      }
    } catch (error: any) {
      console.error('Error creating coupon:', error);
      alert(`Erro de conexão: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCoupon = async (id: string) => {
    try {
      const response = await fetch(`/api/coupons/${id}`, { method: 'DELETE' });
      if (response.ok) {
        await fetchCoupons();
        setCouponToDelete(null);
      }
    } catch (error) {
      console.error('Error deleting coupon:', error);
    }
  };

  const handleNotifyVacancy = (item: any) => {
    setShowNotifyModal({ isOpen: true, item });
  };

  const confirmNotifyVacancy = async () => {
    if (!showNotifyModal.item) return;
    try {
      const response = await fetch('/api/waitlist/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ waitlistId: showNotifyModal.item.id, whatsapp: showNotifyModal.item.whatsapp1 })
      });
      if (response.ok) {
        await fetchWaitlist();
        setShowNotifyModal({ isOpen: false, item: null });
      } else {
        alert('Erro ao notificar vaga.');
      }
    } catch (error) {
      console.error('Error notifying vacancy:', error);
      alert('Erro ao notificar vaga.');
    }
  };

  const validateCoupon = async () => {
    if (!couponCode) return;
    setCouponError('');
    try {
      const response = await fetch('/api/coupons/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          code: couponCode,
          guardianId: formData.guardian.id,
          cpf: formData.guardian.cpf
        })
      });
      const data = await response.json();
      if (response.ok) {
        setAppliedCoupon(data);
        setCouponError('');
      } else {
        setCouponError(data.error || 'Cupom inválido');
        setAppliedCoupon(null);
      }
    } catch (error) {
      setCouponError('Erro ao validar cupom');
    }
  };

  useEffect(() => {
    if (adminTab === 'finance') {
      fetchFinancialData();
    } else if (adminTab === 'coupons') {
      fetchCoupons();
    } else if (adminTab === 'tasks') {
      fetchTasks();
      fetchWaitlist();
      fetchOptions();
    }
  }, [adminTab]);

  const handleNext = async () => {
    if (step === 'guardian') {
      // Validation for guardian step
      const g = formData.guardian;
      if (!g.cpf || g.cpf.replace(/\D/g, '').length !== 11) {
        setErrorMessage('Por favor, insira um CPF válido.');
        return;
      }
      
      if (guardianExists === true && !g.name) {
        setErrorMessage('Por favor, insira sua senha e clique em "Acessar" para carregar seus dados.');
        return;
      }

      if (!g.name || !g.email || !g.phone || !g.zipCode || !g.street || !g.number || !g.neighborhood || !g.city || !g.state || !g.password) {
        setErrorMessage('Por favor, preencha todos os campos obrigatórios, incluindo a senha e o endereço completo.');
        return;
      }

      // Se o responsável for novo, salvamos ele agora para "seguir"
      if (guardianExists === false) {
        setLoading(true);
        try {
          const addressJson = JSON.stringify({
            zipCode: g.zipCode,
            street: g.street,
            number: g.number,
            complement: g.complement,
            neighborhood: g.neighborhood,
            city: g.city,
            state: g.state
          });

          const response = await fetch('/api/guardian/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: g.name,
              cpf: g.cpf,
              email: g.email,
              phone: g.phone,
              address: addressJson,
              password: g.password
            })
          });
          
          const data = await response.json();
          if (!response.ok) {
            throw new Error(data.error || 'Erro ao registrar responsável');
          }
          
          setGuardianExists(true); // Agora ele existe no banco
        } catch (error: any) {
          console.error('Error registering guardian:', error);
          setErrorMessage(`Erro ao salvar dados do responsável: ${error.message}`);
          setLoading(false);
          return;
        } finally {
          setLoading(false);
        }
      }

      setStep('student');
    }
    else if (step === 'student') {
      const s = formData.student;
      if (!s.name || !s.birthDate || !s.grade || !s.turmaEscolar || !s.responsavel1 || !s.whatsapp1 || !s.responsavel2 || !s.whatsapp2) {
        setErrorMessage('Por favor, preencha todos os campos obrigatórios do aluno (incluindo os dois contatos).');
        return;
      }
      setStep('enrollment');
    }
    else if (step === 'enrollment') {
      if (!acceptedTerms) {
        setErrorMessage('Você precisa aceitar os termos e condições para prosseguir.');
        return;
      }
      const s = formData.student;
      if (!s.unidade || !s.turmaComplementar) {
        setErrorMessage('Por favor, selecione a unidade e a turma complementar.');
        return;
      }
      
      const selectedTurma = options.turmas.find(t => t.nome === s.turmaComplementar);
      const isFull = selectedTurma && selectedTurma.capacidade && (selectedTurma.ocupacao_atual || 0) >= selectedTurma.capacidade;

      if (transferringEnrollmentId) {
        setLoading(true);
        try {
          const response = await fetch('/api/enrollment/transfer', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              enrollmentId: transferringEnrollmentId,
              newTurma: s.turmaComplementar,
              newUnidade: s.unidade
            })
          });
          if (response.ok) {
            setTransferringEnrollmentId(null);
            setStep('success');
          } else {
            const data = await response.json();
            alert(data.error || 'Erro ao transferir matrícula');
          }
        } catch (error) {
          console.error('Error transferring enrollment:', error);
          alert('Erro de conexão');
        } finally {
          setLoading(false);
        }
      } else if (isFull) {
        // Skip payment step for waitlist
        handleSubmit();
      } else {
        setStep('payment');
      }
    }
  };

  const resetGuardian = () => {
    setFormData({
      ...formData,
      guardian: { 
        id: '',
        name: '', 
        cpf: '', 
        email: '', 
        phone: '', 
        address: '', 
        password: '',
        zipCode: '',
        street: '',
        number: '',
        complement: '',
        neighborhood: '',
        city: '',
        state: ''
      }
    });
    setGuardianExists(null);
    setDependents([]);
  };

  const handleBack = () => {
    if (step === 'student') {
      if (guardianExists) setStep('portal');
      else setStep('guardian');
    }
    else if (step === 'enrollment') {
      setStep('student');
      setTransferringEnrollmentId(null);
    }
    else if (step === 'payment') setStep('enrollment');
  };

  const handleSubmit = async () => {
    if (isSubmittingRef.current) return;
    
    // Validate credit card if selected and not waitlist
    if (formData.paymentMethod === 'credit_card') {
      const selectedTurma = options.turmas.find(t => t.nome === formData.student.turmaComplementar);
      const isFull = selectedTurma && selectedTurma.capacidade && (selectedTurma.ocupacao_atual || 0) >= selectedTurma.capacidade;
      
      if (!isFull) {
        const { number, holderName, expMonth, expYear, cvv } = formData.card;
        if (!number || number.replace(/\s/g, '').length < 13) {
          setErrorMessage('Por favor, informe um número de cartão válido.');
          return;
        }
        if (!holderName) {
          setErrorMessage('Por favor, informe o nome impresso no cartão.');
          return;
        }
        if (!expMonth || !expYear) {
          setErrorMessage('Por favor, informe a validade do cartão.');
          return;
        }
        if (!cvv || cvv.length < 3) {
          setErrorMessage('Por favor, informe um CVV válido.');
          return;
        }
      }
    }

    isSubmittingRef.current = true;
    setLoading(true);
    try {
      const selectedTurma = options.turmas.find(t => t.nome === formData.student.turmaComplementar);
      const isFull = selectedTurma && selectedTurma.capacidade && (selectedTurma.ocupacao_atual || 0) >= selectedTurma.capacidade;

      const endpoint = isFull ? '/api/waitlist' : '/api/enroll';

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          couponId: appliedCoupon?.id
        })
      });
      
      let data;
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        const text = await response.text();
        console.error('Non-JSON response:', text);
        throw new Error(`Resposta inesperada do servidor: ${response.status} ${response.statusText}`);
      }
      
      if (response.ok) {
        setPaymentInfo(data.paymentInfo);
        if (isFull && data.position) {
          setWaitlistPosition(data.position);
        }
        setStep(isFull ? 'waitlist_success' : 'success');
      } else {
        const errorMsg = data.error || 'Erro desconhecido';
        const details = data.details ? `\nDetalhes: ${typeof data.details === 'object' ? JSON.stringify(data.details) : data.details}` : '';
        const hint = data.hint ? `\nDica: ${data.hint}` : '';
        setErrorMessage(`Erro ao realizar ${isFull ? 'entrada na lista de espera' : 'matrícula'}: ${errorMsg}${details}${hint}`);
      }
    } catch (error: any) {
      console.error('Error submitting:', error);
      setErrorMessage(`Erro ao processar solicitação: ${error.message || 'Erro de conexão'}`);
    } finally {
      setLoading(false);
      isSubmittingRef.current = false;
    }
  };

  const filteredTurmas = options.turmas.filter(t => {
    const sUnit = (formData.student.unidade || "").trim().toLowerCase();
    const tUnit = (t.unidade_nome || t.unidade || t.unidade_atendimento || "").trim().toLowerCase();
    const matchesUnit = tUnit === sUnit;
    
    const seriesData = t.series_permitidas || t.series;
    const hasSeriesDefined = (Array.isArray(seriesData) && seriesData.length > 0) || (typeof seriesData === 'string' && seriesData.length > 0);
    const matchesGrade = !hasSeriesDefined || 
      (Array.isArray(seriesData) && seriesData.includes(formData.student.grade)) ||
      (typeof seriesData === 'string' && seriesData.split(',').map((s: string) => s.trim()).includes(formData.student.grade));
    
    let matchesAge = true;
    if (formData.student.birthDate && t.idade_minima != null && t.idade_maxima != null) {
      // Se ambos forem 0, consideramos que não há restrição de idade
      if (t.idade_minima === 0 && t.idade_maxima === 0) {
        matchesAge = true;
      } else {
        const birthDate = new Date(formData.student.birthDate);
        const today = new Date();
        let age = today.getFullYear() - birthDate.getFullYear();
        const m = today.getMonth() - birthDate.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
          age--;
        }
        matchesAge = age >= t.idade_minima && age <= t.idade_maxima;
      }
    }

    const result = matchesUnit && matchesGrade && matchesAge && ((t.status || 'ativo').toLowerCase() === 'ativo');
    
    if (formData.student.unidade && formData.student.grade) {
      console.log(`Checking Turma: ${t.nome}`, { 
        result, 
        matchesUnit, 
        matchesGrade, 
        matchesAge, 
        details: {
          tUnit, sUnit,
          tSeries: t.series_permitidas, sGrade: formData.student.grade,
          tMinAge: t.idade_minima, tMaxAge: t.idade_maxima, calculatedAge: formData.student.birthDate ? "calculated" : "N/A"
        }
      });
    }
    
    return result;
  });

  return (
    <div className="min-h-screen bg-[#f8fafc] font-sans text-slate-900">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 py-4 px-6 sticky top-0 z-20 shadow-sm">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <div 
            className="flex items-center gap-2 cursor-pointer" 
            onClick={() => setStep('guardian')}
          >
            <div className="p-2 bg-emerald-600 rounded-lg">
              <ShieldCheck className="text-white" size={20} />
            </div>
            <h1 className="text-lg font-bold tracking-tight hidden sm:block">
              Sport for Kids
            </h1>
          </div>
          
          <div className="flex items-center gap-6">
            {step !== 'admin' && step !== 'success' && step !== 'portal' && step !== 'waitlist_success' && (
              <div className="hidden md:flex gap-2">
                {(['guardian', 'student', 'enrollment', 'payment'] as Step[]).map((s, i) => (
                  <div 
                    key={s}
                    className={`h-1.5 w-8 rounded-full transition-colors ${
                      step === s || 
                      (i === 0 && (step === 'student' || step === 'enrollment' || step === 'payment')) ||
                      (i === 1 && (step === 'enrollment' || step === 'payment')) ||
                      (i === 2 && step === 'payment')
                        ? 'bg-emerald-600' 
                        : 'bg-slate-200'
                    }`}
                  />
                ))}
              </div>
            )}
            
            {step !== 'portal' && (
              <button 
                onClick={() => setStep(step === 'admin' ? 'guardian' : 'admin')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  step === 'admin' 
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <LayoutDashboard size={16} />
                {step === 'admin' ? 'Voltar para Matrícula' : 'Painel Admin'}
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto py-8 px-6">
        <AnimatePresence mode="wait">
          {step === 'admin' ? (
            !isAdminAuthenticated ? (
              <motion.div
                key="admin-login"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="max-w-md mx-auto mt-20 p-8 bg-white rounded-2xl shadow-xl border border-slate-200"
              >
                <div className="flex flex-col items-center gap-4 mb-8">
                  <div className="p-4 bg-emerald-100 rounded-full text-emerald-600">
                    <ShieldCheck size={32} />
                  </div>
                  <div className="text-center">
                    <h2 className="text-2xl font-bold text-slate-900">Acesso Restrito</h2>
                    <p className="text-slate-500 text-sm">Identifique-se para acessar o painel admin.</p>
                  </div>
                </div>

                <form onSubmit={handleAdminLogin} className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">Usuário</label>
                    <input 
                      type="text" 
                      required
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                      value={adminLogin.username}
                      onChange={e => setAdminLogin({...adminLogin, username: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">Senha</label>
                    <input 
                      type="password" 
                      required
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                      value={adminLogin.password}
                      onChange={e => setAdminLogin({...adminLogin, password: e.target.value})}
                    />
                  </div>
                  <button 
                    type="submit"
                    className="w-full bg-emerald-600 text-white py-3 rounded-xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200 mt-4"
                  >
                    Entrar no Painel
                  </button>
                </form>
              </motion.div>
            ) : (
              <motion.div
                key="admin"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900">Painel Administrativo</h2>
                  <p className="text-slate-500 text-sm">Gerencie matrículas e configurações do sistema.</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex gap-2 bg-white p-1 rounded-xl shadow-sm border border-slate-200">
                    <button 
                      onClick={() => setAdminTab('tasks')}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${adminTab === 'tasks' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
                    >
                      <Clock size={16} /> Tarefas
                      {Array.isArray(mergedTasks) && mergedTasks.filter((t: any) => t.status === 'pendente').length > 0 && (
                        <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">
                          {mergedTasks.filter((t: any) => t.status === 'pendente').length}
                        </span>
                      )}
                    </button>
                    <button 
                      onClick={() => setAdminTab('enrollments')}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${adminTab === 'enrollments' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
                    >
                      Matrículas
                    </button>
                    <button 
                      onClick={() => setAdminTab('waitlist')}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${adminTab === 'waitlist' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
                    >
                      Lista de Espera
                    </button>
                    <button 
                      onClick={() => setAdminTab('settings')}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${adminTab === 'settings' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
                    >
                      Configurações
                    </button>
                    <button 
                      onClick={() => setAdminTab('finance')}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${adminTab === 'finance' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
                    >
                      Financeiro
                    </button>
                    <button 
                      onClick={() => setAdminTab('coupons')}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${adminTab === 'coupons' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
                    >
                      Cupons
                    </button>
                    <button 
                      onClick={() => setAdminTab('import')}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${adminTab === 'import' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
                    >
                      Importação
                    </button>
                  </div>
                  <button 
                    onClick={() => {
                      setIsAdminAuthenticated(false);
                      setAdminLogin({ username: '', password: '' });
                    }}
                    className="p-2 text-slate-400 hover:text-red-600 transition-colors"
                    title="Sair do Painel"
                  >
                    <XCircle size={20} />
                  </button>
                </div>
              </div>

              {adminTab === 'tasks' ? (
                <div className="space-y-6">
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="text-xl font-bold text-slate-900">Tarefas e Solicitações</h3>
                      <p className="text-slate-500 text-sm">Ações solicitadas pelos responsáveis que aguardam aprovação.</p>
                    </div>
                    <button 
                      onClick={() => {
                        fetchTasks();
                        fetchWaitlist();
                        fetchOptions();
                      }}
                      className="p-2 text-slate-400 hover:text-slate-900 transition-colors"
                    >
                      <RefreshCw size={20} className={loadingTasks ? 'animate-spin' : ''} />
                    </button>
                  </div>

                  <div className="grid gap-4">
                    {loadingTasks ? (
                      <div className="bg-white rounded-2xl p-12 text-center border border-slate-100">
                        <RefreshCw size={32} className="animate-spin text-slate-300 mx-auto mb-4" />
                        <p className="text-slate-400">Carregando tarefas...</p>
                      </div>
                    ) : mergedTasks.length === 0 ? (
                      <div className="bg-white rounded-2xl p-12 text-center border border-slate-100 shadow-sm">
                        <CheckCircle2 size={32} className="text-emerald-500 mx-auto mb-4" />
                        <p className="text-slate-500 font-medium">Tudo em dia! Nenhuma tarefa pendente.</p>
                      </div>
                    ) : mergedTasks.error ? (
                      <div className="bg-white rounded-2xl p-12 text-center border border-red-100 shadow-sm">
                        <XCircle size={32} className="text-red-500 mx-auto mb-4" />
                        <p className="text-red-500 font-medium">Erro ao carregar tarefas.</p>
                        <p className="text-slate-500 text-sm mt-2">{mergedTasks.error}</p>
                      </div>
                    ) : Array.isArray(mergedTasks) ? (
                      mergedTasks.map((task: any) => (
                        <motion.div 
                          key={task.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className={`bg-white rounded-2xl p-6 border ${task.status === 'pendente' ? 'border-amber-200 bg-amber-50/10' : 'border-slate-100'} shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6`}
                        >
                          <div className="flex items-start gap-4">
                            <div className={`p-3 rounded-xl ${
                              task.tipo === 'cancelamento' ? 'bg-red-50 text-red-600' : 
                              task.tipo === 'vaga_disponivel' ? 'bg-emerald-50 text-emerald-600' :
                              'bg-blue-50 text-blue-600'
                            }`}>
                              {task.tipo === 'cancelamento' ? <Trash2 size={24} /> : 
                               task.tipo === 'vaga_disponivel' ? <CheckCircle2 size={24} /> :
                               <RefreshCw size={24} />}
                            </div>
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${
                                  task.tipo === 'cancelamento' ? 'bg-red-100 text-red-700' : 
                                  task.tipo === 'vaga_disponivel' ? 'bg-emerald-100 text-emerald-700' :
                                  'bg-blue-100 text-blue-700'
                                }`}>
                                  {task.tipo === 'cancelamento' ? 'Cancelamento' : 
                                   task.tipo === 'vaga_disponivel' ? 'Vaga Disponível' :
                                   'Transferência'}
                                </span>
                                <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${
                                  task.status === 'pendente' ? 'bg-amber-100 text-amber-700' : 
                                  task.status === 'concluido' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-700'
                                }`}>
                                  {task.status === 'pendente' ? 'Pendente' : 
                                   task.status === 'concluido' ? 'Concluído' : 'Rejeitado'}
                                </span>
                              </div>
                              <h3 className="font-bold text-slate-900">
                                {task.alunos?.nome_completo || task.matriculas?.alunos?.nome_completo || 'Aluno não identificado'}
                              </h3>
                              <p className="text-sm text-slate-500">
                                Responsável: {task.responsaveis?.nome_completo || 'N/A'}
                              </p>
                              <div className="mt-3 text-sm bg-white/50 p-3 rounded-xl border border-slate-100">
                                {task.tipo === 'cancelamento' ? (
                                  <>
                                    {task.matriculas && (
                                      <div className="mb-2">
                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-200 text-slate-800">
                                          {task.matriculas.turma} • {task.matriculas.unidade}
                                        </span>
                                      </div>
                                    )}
                                    <p><strong>Data:</strong> {task.detalhes?.data_cancelamento}</p>
                                    <p><strong>Justificativa:</strong> {task.detalhes?.justificativa}</p>
                                  </>
                                ) : task.tipo === 'vaga_disponivel' ? (
                                  <>
                                    <p><strong>Turma:</strong> {task.detalhes?.turma}</p>
                                    <p><strong>Unidade:</strong> {task.detalhes?.unidade}</p>
                                    <p className="text-emerald-600 font-medium mt-1 italic">Uma vaga surgiu nesta turma!</p>
                                  </>
                                ) : (
                                  <>
                                    <p><strong>De:</strong> {task.matriculas?.turma} ({task.matriculas?.unidade})</p>
                                    <p><strong>Para:</strong> {task.detalhes?.nova_turma} ({task.detalhes?.nova_unidade})</p>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>

                          {task.status === 'pendente' && (
                            <div className="flex gap-2">
                              {task.tipo === 'vaga_disponivel' ? (
                                <button 
                                  onClick={() => handleNotifyVacancy(task.detalhes.waitlistItem)}
                                  className="px-6 py-2 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100 flex items-center gap-2"
                                >
                                  <Mail size={16} /> Notificar Vaga
                                </button>
                              ) : (
                                <>
                                  <button 
                                    onClick={() => handleRejectTask(task.id)}
                                    className="px-4 py-2 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-100 transition-all"
                                  >
                                    Rejeitar
                                  </button>
                                  <button 
                                    onClick={() => handleApproveTask(task)}
                                    className="px-6 py-2 bg-slate-900 text-white rounded-xl text-sm font-bold hover:bg-slate-800 transition-all shadow-lg shadow-slate-200"
                                  >
                                    Aprovar e Processar
                                  </button>
                                </>
                              )}
                            </div>
                          )}
                          <div className="text-[10px] text-slate-400">
                            Solicitado em: {new Date(task.created_at).toLocaleString('pt-BR')}
                          </div>
                        </motion.div>
                      ))
                    ) : null}
                  </div>
                </div>
              ) : adminTab === 'waitlist' ? (
                <div className="space-y-6">
                  <div className="flex justify-between items-center">
                    <h3 className="text-xl font-bold text-slate-900">Lista de Espera</h3>
                    <button 
                      onClick={fetchWaitlist}
                      className="text-emerald-600 hover:text-emerald-700 font-medium flex items-center gap-1"
                    >
                      <RefreshCw size={16} /> Atualizar
                    </button>
                  </div>

                  <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200">
                            <th className="px-6 py-4 text-sm font-bold text-slate-700">Ordem</th>
                            <th className="px-6 py-4 text-sm font-bold text-slate-700">Data</th>
                            <th className="px-6 py-4 text-sm font-bold text-slate-700">Aluno</th>
                            <th className="px-6 py-4 text-sm font-bold text-slate-700">Responsável</th>
                            <th className="px-6 py-4 text-sm font-bold text-slate-700">Turma</th>
                            <th className="px-6 py-4 text-sm font-bold text-slate-700">Horário</th>
                            <th className="px-6 py-4 text-sm font-bold text-slate-700">Status</th>
                            <th className="px-6 py-4 text-sm font-bold text-slate-700">Ação</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {waitlist.length === 0 ? (
                            <tr>
                              <td colSpan={6} className="px-6 py-10 text-center text-slate-400 italic">
                                Nenhum registro na lista de espera.
                              </td>
                            </tr>
                          ) : (
                            waitlist.map((item, index) => (
                              <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                                <td className="px-6 py-4 text-sm text-slate-600">
                                  {index + 1}
                                </td>
                                <td className="px-6 py-4 text-sm text-slate-600">
                                  {new Date(item.created_at).toLocaleDateString()}
                                </td>
                                <td className="px-6 py-4">
                                  <div className="text-sm font-bold text-slate-900">{item.estudante}</div>
                                  <div className="text-xs text-slate-500">{item.ano_escolar} - {item.turma_escolar}</div>
                                </td>
                                <td className="px-6 py-4">
                                  <div className="text-sm text-slate-900">{item.responsavel1}</div>
                                  <div className="text-xs text-slate-500">{item.whatsapp1}</div>
                                </td>
                                <td className="px-6 py-4">
                                  <div className="text-sm text-slate-900">{item.turma}</div>
                                  <div className="text-xs text-slate-500">{item.unidade}</div>
                                </td>
                                <td className="px-6 py-4 text-sm text-slate-600">
                                  {item.horario}
                                </td>
                                <td className="px-6 py-4">
                                  <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-bold uppercase">
                                    {item.status}
                                  </span>
                                </td>
                                <td className="px-6 py-4">
                                  {(() => {
                                    const turma = options.turmas.find(t => t.nome === item.turma);
                                    const temVaga = turma && (turma.ocupacao_atual || 0) < (turma.capacidade || 0);
                                    return (
                                      <button
                                        disabled={!temVaga || item.status === 'chamado'}
                                        onClick={() => handleNotifyVacancy(item)}
                                        className={`px-3 py-1 ${item.status === 'chamado' ? 'bg-red-600' : 'bg-emerald-600'} text-white rounded-lg text-xs font-bold disabled:opacity-50 hover:bg-emerald-700 transition-colors`}
                                      >
                                        {item.status === 'chamado' ? 'Notificado' : 'Notificar Vaga'}
                                      </button>
                                    );
                                  })()}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              ) : adminTab === 'import' ? (
                <div className="space-y-6">
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="text-xl font-bold text-slate-900">Importação de Dados</h3>
                      <p className="text-sm text-slate-500">Importe matrículas em massa via arquivo CSV.</p>
                    </div>
                    <button 
                      onClick={downloadImportTemplate}
                      className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 hover:bg-slate-50 transition-all"
                    >
                      <Download size={18} /> Baixar Template
                    </button>
                  </div>

                  <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm text-center">
                    <div className="max-w-md mx-auto space-y-6">
                      <div className="w-20 h-20 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center mx-auto">
                        <Upload size={40} />
                      </div>
                      <div>
                        <h4 className="text-lg font-bold text-slate-900">Upload de Arquivo</h4>
                        <p className="text-sm text-slate-500 mt-1">
                          {importType === 'matriculas' 
                            ? 'Selecione o arquivo CSV preenchido com os dados dos responsáveis, alunos e matrículas.'
                            : importType === 'aulas_experimentais'
                              ? 'Selecione o arquivo CSV preenchido com os dados das aulas experimentais.'
                              : importType === 'ocorrencias'
                                ? 'Selecione o arquivo CSV preenchido com os dados das ocorrências.'
                                : importType === 'pagamentos_wix'
                                  ? 'Selecione o arquivo CSV exportado do WIX para importar pagamentos.'
                                  : 'Selecione o arquivo CSV preenchido com os dados das presenças.'}
                        </p>
                      </div>

                      <div className="flex justify-center gap-4">
                        <div className="text-left">
                          <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">
                            Tipo de Importação
                          </label>
                          <select 
                            value={importType}
                            onChange={(e) => setImportType(e.target.value as any)}
                            className="bg-slate-100 border-none rounded-lg px-3 py-2 text-xs font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none"
                          >
                            <option value="matriculas">Matrículas</option>
                            <option value="aulas_experimentais">Aulas Experimentais</option>
                            <option value="ocorrencias">Ocorrências</option>
                            <option value="presencas">Presenças</option>
                            <option value="pagamentos_wix">Pagamentos WIX</option>
                            <option value="pagamentos_pagseguro">Pagamentos PagSeguro</option>
                          </select>
                        </div>
                        <div className="text-left">
                          <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">
                            Codificação do Arquivo
                          </label>
                          <select 
                            value={importEncoding}
                            onChange={(e) => setImportEncoding(e.target.value)}
                            className="bg-slate-100 border-none rounded-lg px-3 py-2 text-xs font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none"
                          >
                            <option value="UTF-8">UTF-8 (Padrão)</option>
                            <option value="ISO-8859-1">ISO-8859-1 (Excel Windows)</option>
                            <option value="macintosh">Macintosh (Excel Mac Antigo)</option>
                            <option value="Windows-1252">Windows-1252 (Excel Brasil)</option>
                          </select>
                          <p className="text-[9px] text-slate-400 mt-1 max-w-[200px]">
                            Se os nomes aparecerem com caracteres estranhos, tente mudar para Macintosh ou ISO-8859-1.
                          </p>
                        </div>
                      </div>
                      
                      <div className="relative">
                        <input 
                          type="file" 
                          accept=".csv"
                          onChange={handleFileUpload}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        />
                        <div className="border-2 border-dashed border-slate-200 rounded-2xl p-8 hover:border-blue-400 hover:bg-blue-50/50 transition-all">
                          <p className="text-sm font-medium text-slate-600">
                            Clique para selecionar ou arraste o arquivo aqui
                          </p>
                          <p className="text-xs text-slate-400 mt-1">Apenas arquivos .csv</p>
                        </div>
                      </div>

                      {importData.length > 0 && !importResults && (
                        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-left">
                          <div className="flex items-center gap-3 mb-3">
                            <FileSpreadsheet className="text-blue-500" size={20} />
                            <span className="text-sm font-bold text-slate-700">Arquivo carregado</span>
                          </div>
                          <p className="text-xs text-slate-500">
                            Foram detectadas <span className="font-bold text-slate-900">{importData.length}</span> linhas prontas para importação.
                          </p>

                          {isPreviewing && (
                            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-xl text-blue-700 text-sm flex items-center gap-2">
                              <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                              Analisando registros novos...
                            </div>
                          )}

                          {importPreviewResults && !isPreviewing && (
                            <div className="mt-4 p-4 bg-white border border-slate-200 rounded-xl">
                              <h5 className="text-xs font-bold text-slate-400 mb-3 uppercase tracking-wider">Análise Prévia</h5>
                              <div className="grid grid-cols-2 gap-3 text-sm">
                                <div className="bg-emerald-50 text-emerald-700 p-3 rounded-xl border border-emerald-100">
                                  <span className="block text-[10px] uppercase font-bold opacity-70 mb-1">Novos Registros</span>
                                  <span className="text-2xl font-black leading-none">{importPreviewResults.success}</span>
                                </div>
                                <div className="bg-slate-50 text-slate-600 p-3 rounded-xl border border-slate-100">
                                  <span className="block text-[10px] uppercase font-bold opacity-70 mb-1">Já Existentes (Ignorados)</span>
                                  <span className="text-2xl font-black leading-none">{importPreviewResults.skipped || 0}</span>
                                </div>
                              </div>
                              {importPreviewResults.errors?.length > 0 && (
                                <div className="mt-3 text-xs text-amber-700 bg-amber-50 p-3 rounded-xl border border-amber-100">
                                  <div className="flex items-start gap-2 mb-2">
                                    <AlertCircle size={14} className="mt-0.5 shrink-0" />
                                    <span><span className="font-bold">Atenção:</span> {importPreviewResults.errors.length} linhas contêm erros e não serão importadas.</span>
                                  </div>
                                  <div className="mt-2 max-h-40 overflow-y-auto space-y-2 border-t border-amber-200 pt-2">
                                    {importPreviewResults.errors.map((err: any, idx: number) => (
                                      <div key={idx} className="p-2 bg-white/50 rounded-lg border border-amber-100 text-[10px]">
                                        <p className="font-bold text-amber-900">Linha {err.row}: {err.error}</p>
                                        {err.data && (
                                          <p className="text-slate-500 truncate">Dados: {JSON.stringify(err.data)}</p>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Preview Table */}
                          <div className="mt-4 border border-slate-200 rounded-xl overflow-hidden bg-white">
                            <div className="bg-slate-100 px-3 py-1 text-[10px] font-bold text-slate-500 uppercase">
                              Pré-visualização (Primeiras 3 linhas)
                            </div>
                            <div className="overflow-x-auto">
                              <table className="w-full text-[10px]">
                                <thead>
                                  <tr className="border-b border-slate-100">
                                    <th className="px-3 py-2 text-left text-slate-400 font-medium">
                                      {importType === 'pagamentos_wix' || importType === 'pagamentos_pagseguro' ? 'Data' : 'Nome do Aluno'}
                                    </th>
                                    <th className="px-3 py-2 text-left text-slate-400 font-medium">
                                      {importType === 'ocorrencias' 
                                        ? 'Observação' 
                                        : importType === 'presencas'
                                          ? 'Status'
                                          : importType === 'pagamentos_wix' || importType === 'pagamentos_pagseguro'
                                            ? 'Item / Aluno'
                                            : 'Responsável'}
                                    </th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {(importPreviewResults?.preview || importData.slice(0, 3)).map((row, i) => (
                                    <tr key={i} className="border-b border-slate-50 last:border-0">
                                      <td className="px-3 py-2 text-slate-700 font-medium truncate max-w-[150px]">
                                        {importType === 'pagamentos_wix' || importType === 'pagamentos_pagseguro'
                                          ? (row.data || row.Data || '---')
                                          : importType === 'matriculas' 
                                            ? (row.aluno_nome || row['aluno_nome'] || Object.entries(row).find(([k]) => ['aluno', 'estudante'].includes(k.trim().toLowerCase()))?.[1] as string || '---')
                                            : (Object.entries(row).find(([k]) => ['estudante', 'aluno'].includes(k.trim().toLowerCase()))?.[1] as string || '---')}
                                      </td>
                                      <td className="px-3 py-2 text-slate-500 truncate max-w-[250px]">
                                        {importType === 'pagamentos_wix' || importType === 'pagamentos_pagseguro'
                                          ? (
                                            <div className="flex flex-col">
                                              <span className="font-bold text-slate-700">{row.item || row.Item || row.valor || '---'}</span>
                                              <span className="text-[9px] text-blue-600">{row.aluno || row.Aluno || '---'}</span>
                                            </div>
                                          )
                                          : importType === 'matriculas'
                                            ? (row.responsavel_nome || row['responsavel_nome'] || Object.entries(row).find(([k]) => ['responsável', 'responsavel'].includes(k.trim().toLowerCase()))?.[1] as string || '---')
                                            : importType === 'aulas_experimentais'
                                              ? (Object.entries(row).find(([k]) => ['responsável 1', 'responsavel 1', 'responsavel'].includes(k.trim().toLowerCase()))?.[1] as string || '---')
                                              : importType === 'ocorrencias'
                                                ? (Object.entries(row).find(([k]) => ['observação', 'observacao'].includes(k.trim().toLowerCase()))?.[1] as string || '---')
                                                : (Object.entries(row).find(([k]) => ['status'].includes(k.trim().toLowerCase()))?.[1] as string || '---')}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>

                          <button 
                            onClick={processImport}
                            disabled={isImporting || isPreviewing}
                            className="w-full mt-4 py-3 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                          >
                            {isImporting ? <RefreshCw size={18} className="animate-spin" /> : <CheckCircle2 size={18} />}
                            {isPreviewing ? 'Analisando...' : 'Iniciar Importação'}
                          </button>
                        </div>
                      )}

                      {importResults && (
                        <div className={`p-6 rounded-2xl border ${importResults.errors.length > 0 ? 'bg-amber-50 border-amber-200' : 'bg-emerald-50 border-emerald-200'} text-left`}>
                          <h5 className={`font-bold mb-2 ${importResults.errors.length > 0 ? 'text-amber-800' : 'text-emerald-800'}`}>
                            Resultado da Importação
                          </h5>
                          <div className="space-y-1 text-sm">
                            <p className="text-slate-700">Total processado: <span className="font-bold">{importResults.processed}</span></p>
                            <p className="text-emerald-700">Sucesso: <span className="font-bold">{importResults.success}</span></p>
                            {importResults.skipped !== undefined && (
                              <p className="text-blue-700">Ignorados (Já existentes): <span className="font-bold">{importResults.skipped}</span></p>
                            )}
                            <p className="text-red-700">Erros: <span className="font-bold">{importResults.errors.length}</span></p>
                          </div>

                          {importResults.details && importResults.details.length > 0 && (
                            <div className="mt-4">
                              <h6 className="text-[10px] font-bold text-slate-400 uppercase mb-2">Vínculos Realizados</h6>
                              <div className="max-h-40 overflow-y-auto space-y-1">
                                {importResults.details.map((detail: any, idx: number) => (
                                  <div key={idx} className="p-2 bg-white/50 rounded-lg border border-emerald-100 text-[10px] flex justify-between items-center">
                                    <span className="text-slate-600 font-medium truncate max-w-[150px]">{detail.item}</span>
                                    <span className="text-blue-600 font-bold">{detail.aluno}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          
                          {importResults.errors.length > 0 && (
                            <div className="mt-4 max-h-40 overflow-y-auto space-y-2">
                              {importResults.errors.map((err: any, idx: number) => (
                                <div key={idx} className="p-2 bg-white/50 rounded-lg border border-amber-200 text-[10px]">
                                  <p className="font-bold text-amber-900">Linha {err.row}: {err.error}</p>
                                  <p className="text-slate-500 truncate">Dados: {JSON.stringify(err.data)}</p>
                                </div>
                              ))}
                            </div>
                          )}

                          <button 
                            onClick={() => {
                              setImportData([]);
                              setImportResults(null);
                              setImportFile(null);
                            }}
                            className="w-full mt-4 py-2 bg-white border border-slate-200 text-slate-700 font-bold rounded-xl hover:bg-slate-50 transition-all text-sm"
                          >
                            Limpar e Novo Upload
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="bg-amber-50 p-6 rounded-3xl border border-amber-100">
                    <div className="flex gap-4">
                      <div className="p-2 bg-amber-100 text-amber-600 rounded-xl h-fit">
                        <Info size={20} />
                      </div>
                      <div className="space-y-2">
                        <h4 className="font-bold text-amber-900">Orientações para Importação</h4>
                        <ul className="text-sm text-amber-800 space-y-1 list-disc pl-4">
                          <li>Use o template CSV para garantir que os nomes das colunas estejam corretos.</li>
                          <li>O sistema identifica responsáveis únicos pelo <strong>CPF</strong>.</li>
                          <li><strong>Senha Inicial</strong>: O CPF do responsável será definido como sua senha inicial de acesso ao portal.</li>
                          <li>O sistema identifica alunos únicos pela combinação de <strong>Nome Completo</strong> e <strong>Data de Nascimento</strong> vinculados ao responsável.</li>
                          <li>Se um aluno tiver múltiplas matrículas, coloque cada uma em uma linha repetindo os dados do responsável e do aluno.</li>
                          <li>A data de nascimento, matrícula e cancelamento deve estar no formato <strong>AAAA-MM-DD</strong>.</li>
                          <li>Se os nomes aparecerem com caracteres incorretos (como ), mude a <strong>Codificação do Arquivo</strong> para <strong>Macintosh</strong> (se estiver no Mac) ou <strong>ISO-8859-1</strong> antes de fazer o upload.</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              ) : adminTab === 'coupons' ? (
                <div className="space-y-6">
                  <div className="flex justify-between items-center">
                    <h3 className="text-xl font-bold text-slate-900">Gestão de Cupons</h3>
                    <button 
                      onClick={() => setIsAddingCoupon(true)}
                      className="bg-slate-900 text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-slate-800 transition-all"
                    >
                      <Plus size={18} /> Novo Cupom
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {coupons.length === 0 ? (
                      <div className="col-span-full py-20 text-center text-slate-400 italic bg-white rounded-2xl border border-dashed border-slate-300">
                        Nenhum cupom cadastrado.
                      </div>
                    ) : (
                      coupons.map((coupon) => (
                        <div key={coupon.id} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative group">
                          <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button 
                              onClick={() => {
                                setEditingCouponId(coupon.id);
                                setNewCoupon({
                                  codigo: coupon.codigo,
                                  nome: coupon.nome,
                                  tipo: coupon.tipo,
                                  valor: coupon.valor,
                                  aplicar_em: coupon.aplicar_em,
                                  data_inicio: coupon.data_inicio ? coupon.data_inicio.split('T')[0] : new Date().toISOString().split('T')[0],
                                  data_expiracao: coupon.data_expiracao ? coupon.data_expiracao.split('T')[0] : '',
                                  limite_uso: coupon.limite_uso,
                                  uso_unico_cliente: coupon.uso_unico_cliente || false,
                                  sem_expiracao: !coupon.data_expiracao,
                                  tem_limite_uso: !!coupon.limite_uso
                                });
                                setIsAddingCoupon(true);
                              }}
                              className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                              title="Editar Cupom"
                            >
                              <Edit3 size={18} />
                            </button>
                            <button 
                              onClick={() => setCouponToDelete(coupon.id)}
                              className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                              title="Excluir Cupom"
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
                          <div className="flex items-center gap-3 mb-4">
                            <div className={`p-3 rounded-xl ${coupon.tipo === 'fixo' ? 'bg-orange-100 text-orange-600' : 'bg-blue-100 text-blue-600'}`}>
                              {coupon.tipo === 'fixo' ? <DollarSign size={24} /> : <Percent size={24} />}
                            </div>
                            <div>
                              <h4 className="font-bold text-slate-900">{coupon.codigo}</h4>
                              <p className="text-xs text-slate-500">{coupon.nome}</p>
                            </div>
                          </div>
                          <div className="space-y-3">
                            <div className="flex justify-between text-sm">
                              <span className="text-slate-500">Desconto:</span>
                              <span className="font-bold text-slate-900">
                                {coupon.tipo === 'fixo' ? `R$ ${coupon.valor}` : `${coupon.valor}%`}
                              </span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-slate-500">Aplicar em:</span>
                              <span className="font-medium text-slate-700">
                                {coupon.aplicar_em === 'primeira_parcela' ? '1ª Parcela' : 'Todas as Parcelas'}
                              </span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-slate-500">Usos:</span>
                              <span className="font-medium text-slate-700">
                                {coupon.usos_atuais} {coupon.limite_uso ? `/ ${coupon.limite_uso}` : ''}
                              </span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-slate-500">Expiração:</span>
                              <span className="font-medium text-slate-700">
                                {coupon.data_expiracao ? new Date(coupon.data_expiracao).toLocaleDateString() : 'Sem expiração'}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ) : adminTab === 'enrollments' ? (
                <>
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex gap-3">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input 
                          type="text" 
                          placeholder="Buscar responsável ou aluno..." 
                          className="pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none w-full md:w-64"
                          value={enrollmentSearch}
                          onChange={e => setEnrollmentSearch(e.target.value)}
                        />
                      </div>
                      <button 
                        onClick={fetchEnrollments}
                        disabled={loading}
                        className="p-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
                      >
                        <RefreshCw size={18} className={`${loading ? 'animate-spin' : ''} text-slate-600`} />
                      </button>
                      <button 
                        onClick={async () => {
                          try {
                            const res = await fetch('/api/admin/debug-counts');
                            const data = await res.json();
                            alert('Contagem de Dados:\n' + JSON.stringify(data, null, 2));
                          } catch (err) {
                            alert('Erro ao buscar debug: ' + err);
                          }
                        }}
                        className="flex items-center gap-2 px-4 py-2 bg-slate-50 text-slate-700 border border-slate-200 rounded-lg text-sm font-medium hover:bg-slate-100 transition-all"
                      >
                        Debug Counts
                      </button>
                    </div>
                  </div>

                  {/* Stats Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                      <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">Total Matrículas</p>
                      <p className="text-3xl font-bold">{enrollments.length}</p>
                    </div>
                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                      <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">Pagamentos Pendentes</p>
                      <p className="text-3xl font-bold text-amber-600">
                        {enrollments.filter(e => {
                          const p = e.pagamentos?.[0];
                          if (!p) return false;
                          const isPaid = p.status?.toLowerCase() === 'pago';
                          const isCancelled = p.status?.toLowerCase() === 'cancelado';
                          if (isPaid || isCancelled) return false;
                          
                          // If not paid or cancelled, check if it's overdue
                          if (p.data_vencimento) {
                            const dueDate = new Date(p.data_vencimento);
                            const today = new Date();
                            today.setHours(0, 0, 0, 0);
                            return dueDate < today;
                          }
                          return true; // Assume pending if no due date
                        }).length}
                      </p>
                    </div>
                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                      <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">A Vencer</p>
                      <p className="text-3xl font-bold text-blue-600">
                        {enrollments.filter(e => {
                          const p = e.pagamentos?.[0];
                          if (!p) return false;
                          const isPaid = p.status?.toLowerCase() === 'pago';
                          const isCancelled = p.status?.toLowerCase() === 'cancelado';
                          if (isPaid || isCancelled) return false;
                          
                          if (p.data_vencimento) {
                            const dueDate = new Date(p.data_vencimento);
                            const today = new Date();
                            today.setHours(0, 0, 0, 0);
                            return dueDate >= today;
                          }
                          return false;
                        }).length}
                      </p>
                    </div>
                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                      <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">Conciliados (PIX/Cartão)</p>
                      <p className="text-3xl font-bold text-emerald-600">
                        {enrollments.filter(e => e.pagamentos?.[0]?.status?.toLowerCase() === 'pago').length}
                      </p>
                    </div>
                  </div>

                  {/* Table */}
                  <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200">
                            <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Data</th>
                            <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Responsável</th>
                            <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Aluno</th>
                            <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Turma</th>
                            <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Plano</th>
                            <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Método</th>
                            <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Ações</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {filteredFlattenedEnrollments.length === 0 ? (
                            <tr>
                              <td colSpan={7} className="px-6 py-12 text-center text-slate-400 italic">
                                Nenhuma matrícula encontrada no banco de dados.
                              </td>
                            </tr>
                          ) : (
                            filteredFlattenedEnrollments.map((item, idx) => {
                              const { aluno, matricula: mat, ...enrollment } = item;
                              return (
                                <tr key={mat.id || idx} className="hover:bg-slate-50/50 transition-colors">
                                  <td className="px-6 py-4">
                                    <p className="font-semibold text-slate-900">
                                      {formatDateShort(mat.data_matricula)}
                                    </p>
                                    <p className="text-[10px] text-slate-400 uppercase">Data Matrícula</p>
                                  </td>
                                  <td className="px-6 py-4">
                                    <p className="text-sm font-medium text-slate-700">{enrollment.nome_completo}</p>
                                    <p className="text-[10px] text-slate-400 uppercase">Responsável</p>
                                  </td>
                                  <td className="px-6 py-4">
                                    <p className="text-sm font-medium text-slate-700">{aluno.nome_completo}</p>
                                    <p className="text-[10px] text-slate-500 uppercase">{aluno.serie_ano?.replace('_', ' ')}</p>
                                  </td>
                                  <td className="px-6 py-4">
                                    <p className="text-sm font-bold text-emerald-600">{mat.turma}</p>
                                    <p className="text-[10px] text-slate-500 uppercase">{mat.unidade}</p>
                                    <div className="mt-1">
                                      <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase inline-block ${
                                        (mat.status || 'ativo').trim().toLowerCase() === 'ativo' ? 'bg-emerald-100 text-emerald-700' :
                                        (mat.status || '').trim().toLowerCase() === 'transferido' ? 'bg-blue-100 text-blue-700' : 
                                        (mat.status || '').trim().toLowerCase() === 'cancelado' ? 'bg-red-100 text-red-700' :
                                        'bg-amber-100 text-amber-700'
                                      }`}>
                                        {mat.status || 'ativo'}
                                      </span>
                                      {mat.status === 'cancelado' && mat.data_cancelamento && (
                                        <p className="text-[8px] text-slate-400 mt-0.5">
                                          Cancelado em: {new Date(mat.data_cancelamento).toLocaleDateString('pt-BR')}
                                        </p>
                                      )}
                                    </div>
                                  </td>
                                  <td className="px-6 py-4">
                                    {mat.plano ? (
                                      <span className="px-2 py-1 bg-slate-100 text-slate-600 text-[10px] font-bold rounded uppercase border border-slate-200">
                                        {mat.plano}
                                      </span>
                                    ) : (
                                      <span className="text-[10px] text-slate-400 italic">Padrão</span>
                                    )}
                                  </td>
                                  <td className="px-6 py-4">
                                    <div className="flex flex-col gap-1">
                                      {(() => {
                                        const enrollmentPayment = enrollment.pagamentos?.find((p: any) => p.matricula_id === mat.id) || enrollment.pagamentos?.[0];
                                        const isPaid = enrollmentPayment?.status?.toLowerCase() === 'pago';
                                        const isCancelled = enrollmentPayment?.status?.toLowerCase() === 'cancelado';
                                        
                                        let statusLabel = 'Pendente';
                                        let statusColor = 'bg-amber-100 text-amber-800';
                                        
                                        if (isPaid) {
                                          statusLabel = 'Conciliado';
                                          statusColor = 'bg-emerald-100 text-emerald-800';
                                        } else if (isCancelled) {
                                          statusLabel = 'Cancelado';
                                          statusColor = 'bg-red-100 text-red-800';
                                        } else if (enrollmentPayment?.data_vencimento) {
                                          const dueDate = new Date(enrollmentPayment.data_vencimento);
                                          const today = new Date();
                                          today.setHours(0, 0, 0, 0);
                                          if (dueDate >= today) {
                                            statusLabel = 'A Vencer';
                                            statusColor = 'bg-blue-100 text-blue-800';
                                          }
                                        }

                                        return (
                                          <>
                                            <div className="flex items-center gap-2">
                                              {enrollmentPayment?.metodo_pagamento === 'pix' ? (
                                                <QrCode size={14} className="text-emerald-600" />
                                              ) : (
                                                <CreditCard size={14} className="text-purple-600" />
                                              )}
                                              <span className="text-xs font-medium capitalize">
                                                {enrollmentPayment?.metodo_pagamento?.replace('_', ' ') || 'N/A'}
                                              </span>
                                            </div>
                                            <span className={`inline-flex items-center w-fit px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${statusColor}`}>
                                              {statusLabel}
                                            </span>
                                          </>
                                        );
                                      })()}
                                    </div>
                                  </td>
                                  <td className="px-6 py-4 text-right">
                                    <div className="flex items-center justify-end gap-2">
                                      {mat.status === 'trancado' ? (
                                        <button 
                                          onClick={() => {
                                            setReactivatingEnrollmentId(mat.id);
                                            setIsReactivatingEnrollment(true);
                                          }}
                                          className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                                          title="Reativar Matrícula"
                                        >
                                          <RefreshCw size={16} />
                                        </button>
                                      ) : (mat.status !== 'cancelado' && mat.status !== 'transferido') && (
                                        <>
                                          <button 
                                            onClick={() => {
                                              setFreezingEnrollmentId(mat.id);
                                              setIsFreezingEnrollment(true);
                                            }}
                                            className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                                            title="Suspender Matrícula"
                                          >
                                            <Lock size={16} />
                                          </button>
                                          <button 
                                            onClick={() => {
                                              setTransferringEnrollmentId(mat.id);
                                              setTransferringStudent({
                                                id: aluno.id,
                                                nome_completo: aluno.nome_completo,
                                                serie_ano: aluno.serie_ano,
                                                data_nascimento: aluno.data_nascimento
                                              });
                                              setIsTransferringEnrollment(true);
                                              setTransferTarget({ turma: mat.turma, unidade: mat.unidade });
                                            }}
                                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                            title="Transferir Turma"
                                          >
                                            <Truck size={16} />
                                          </button>
                                          <button 
                                            onClick={() => {
                                              setCancelingEnrollmentId(mat.id);
                                              setIsCancelingEnrollment(true);
                                            }}
                                            className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                            title="Cancelar Matrícula"
                                          >
                                            <XCircle size={16} />
                                          </button>
                                        </>
                                      )}
                                      <button 
                                        onClick={() => {
                                          setSelectedEnrollmentDetails({
                                            ...enrollment,
                                            aluno,
                                            matricula: mat
                                          });
                                          setIsViewingEnrollmentDetails(true);
                                        }}
                                        className="p-1.5 text-slate-400 hover:text-emerald-600 transition-colors"
                                        title="Ver Detalhes"
                                      >
                                        <ExternalLink size={16} />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              ) : adminTab === 'finance' ? (
                <div className="space-y-6">
                  {/* Sub-Tabs */}
                  <div className="flex border-b border-slate-200">
                    <button
                      onClick={() => setFinanceFilters({ ...financeFilters, paymentMethod: 'geral' })}
                      className={`px-6 py-3 text-sm font-bold transition-all border-b-2 ${financeFilters.paymentMethod === 'geral' ? 'border-emerald-600 text-emerald-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                    >
                      Geral
                    </button>
                    <button
                      onClick={() => setFinanceFilters({ ...financeFilters, paymentMethod: 'pagarme' })}
                      className={`px-6 py-3 text-sm font-bold transition-all border-b-2 ${financeFilters.paymentMethod === 'pagarme' ? 'border-emerald-600 text-emerald-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                    >
                      Pagar.Me
                    </button>
                    <button
                      onClick={() => setFinanceFilters({ ...financeFilters, paymentMethod: 'pix' })}
                      className={`px-6 py-3 text-sm font-bold transition-all border-b-2 ${financeFilters.paymentMethod === 'pix' ? 'border-emerald-600 text-emerald-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                    >
                      PIX
                    </button>
                    <button
                      onClick={() => setFinanceFilters({ ...financeFilters, paymentMethod: 'pagseguro' })}
                      className={`px-6 py-3 text-sm font-bold transition-all border-b-2 ${financeFilters.paymentMethod === 'pagseguro' ? 'border-emerald-600 text-emerald-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                    >
                      Pagseguro
                    </button>
                    <button
                      onClick={() => setFinanceFilters({ ...financeFilters, paymentMethod: 'wix' })}
                      className={`px-6 py-3 text-sm font-bold transition-all border-b-2 ${financeFilters.paymentMethod === 'wix' ? 'border-emerald-600 text-emerald-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                    >
                      WIX
                    </button>
                  </div>

                  {/* Filters */}
                  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <h3 className="text-lg font-bold text-slate-900">Relatórios Financeiros</h3>
                      <div className="flex flex-wrap gap-2">
                        <button 
                          onClick={() => setFinanceFilters({...financeFilters, status: 'pago', view: 'detailed'})}
                          className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all border ${financeFilters.status === 'pago' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'}`}
                        >
                          Conciliados
                        </button>
                        <button 
                          onClick={() => setFinanceFilters({...financeFilters, status: 'pendente', view: 'detailed'})}
                          className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all border ${financeFilters.status === 'pendente' ? 'bg-amber-600 text-white border-amber-600' : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'}`}
                        >
                          Pendentes (Vencidos)
                        </button>
                        <button 
                          onClick={() => setFinanceFilters({...financeFilters, status: 'a_vencer', view: 'detailed'})}
                          className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all border ${financeFilters.status === 'a_vencer' ? 'bg-blue-600 text-white border-blue-600' : 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'}`}
                        >
                          A Vencer
                        </button>
                        <button 
                          onClick={handleSyncPayments}
                          disabled={loading}
                          className="px-4 py-2 rounded-lg text-sm font-medium bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-all border border-emerald-200 flex items-center gap-2 disabled:opacity-50"
                        >
                          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                          Sincronizar Pagar.me
                        </button>
                        <button 
                          onClick={() => setFinanceFilters({...financeFilters, view: 'summary'})}
                          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${financeFilters.view === 'summary' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                        >
                          Resumo
                        </button>
                        <button 
                          onClick={() => setFinanceFilters({...financeFilters, view: 'detailed'})}
                          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${financeFilters.view === 'detailed' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                        >
                          Detalhado
                        </button>
                      </div>
                    </div>

                      <div className="flex flex-wrap items-end gap-4">
                        <div className="flex-1 min-w-[200px] space-y-1">
                          <label className="text-xs font-bold text-slate-500 uppercase">Buscar Responsável ou Aluno</label>
                          <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                            <input 
                              type="text"
                              placeholder="Nome do responsável ou aluno..."
                              className="w-full pl-10 pr-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                              value={financeFilters.search}
                              onChange={e => setFinanceFilters({...financeFilters, search: e.target.value})}
                            />
                          </div>
                        </div>
                        <div className="flex-1 min-w-[200px] space-y-1">
                          <label className="text-xs font-bold text-slate-500 uppercase">Filtrar por Unidade</label>
                          <select 
                            className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                            value={financeFilters.unidade}
                            onChange={e => setFinanceFilters({...financeFilters, unidade: e.target.value})}
                          >
                            <option value="">Todas as Unidades</option>
                            {options.unidades.map(u => <option key={u} value={u}>{u}</option>)}
                          </select>
                        </div>
                        <div className="flex-1 min-w-[200px] space-y-1">
                          <label className="text-xs font-bold text-slate-500 uppercase">Filtrar por Professor</label>
                          <select 
                            className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                            value={financeFilters.professor}
                            onChange={e => setFinanceFilters({...financeFilters, professor: e.target.value})}
                          >
                            <option value="">Todos os Professores</option>
                            {Array.from(new Set(options.turmas.map(t => t.professor).filter(Boolean))).map(p => (
                              <option key={p} value={p}>{p}</option>
                            ))}
                          </select>
                        </div>
                        <div className="flex-1 min-w-[200px] space-y-1">
                          <label className="text-xs font-bold text-slate-500 uppercase">Filtrar por Status</label>
                          <select 
                            className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                            value={financeFilters.status}
                            onChange={e => setFinanceFilters({...financeFilters, status: e.target.value})}
                          >
                            <option value="">Todos os Status</option>
                            <option value="pago">Conciliado</option>
                            <option value="pendente">Pendente</option>
                            <option value="cancelado">Cancelado</option>
                            <option value="estornado">Estornado</option>
                            <option value="falha">Falhou</option>
                          </select>
                        </div>
                        <div className="flex-1 min-w-[200px] space-y-1">
                          <label className="text-xs font-bold text-slate-500 uppercase">Período</label>
                          <select 
                            className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                            value={financeFilters.period}
                            onChange={e => setFinanceFilters({...financeFilters, period: e.target.value})}
                          >
                            <option value="">Todo o período</option>
                            <option value="this_month">Este mês</option>
                            <option value="last_month">Último mês</option>
                            <option value="last_7_days">Últimos 7 dias</option>
                            <option value="custom">Personalizado</option>
                          </select>
                        </div>
                        {financeFilters.paymentMethod === 'wix' && (
                          <div className="flex-1 min-w-[200px] space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase">Filtrar por Tipo WIX</label>
                            <select 
                              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                              value={financeFilters.wixType}
                              onChange={e => setFinanceFilters({...financeFilters, wixType: e.target.value})}
                            >
                              <option value="">Todos os Tipos</option>
                              <option value="Pricing Plans">Assinatura</option>
                              <option value="Loja Virtual">Loja Virtual</option>
                            </select>
                          </div>
                        )}
                        {financeFilters.period === 'custom' && (
                          <>
                            <div className="flex-1 min-w-[140px] space-y-1">
                              <label className="text-xs font-bold text-slate-500 uppercase">Data Inicial</label>
                              <input 
                                type="date"
                                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                                value={financeFilters.startDate}
                                onChange={e => setFinanceFilters({...financeFilters, startDate: e.target.value})}
                              />
                            </div>
                            <div className="flex-1 min-w-[140px] space-y-1">
                              <label className="text-xs font-bold text-slate-500 uppercase">Data Final</label>
                              <input 
                                type="date"
                                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                                value={financeFilters.endDate}
                                onChange={e => setFinanceFilters({...financeFilters, endDate: e.target.value})}
                              />
                            </div>
                          </>
                        )}
                        {(financeFilters.unidade || financeFilters.professor || financeFilters.search || financeFilters.status || financeFilters.period || financeFilters.wixType) && (
                          <button 
                            onClick={() => setFinanceFilters({...financeFilters, unidade: '', professor: '', search: '', status: '', period: '', startDate: '', endDate: '', wixType: ''})}
                            className="px-4 py-2 text-sm font-bold text-red-500 hover:text-red-600 transition-colors flex items-center gap-1"
                          >
                            <X size={14} />
                            Limpar
                          </button>
                        )}
                      </div>
                  </div>

                  {/* Report Content */}
                  {loading ? (
                    <div className="flex justify-center py-12">
                      <RefreshCw className="animate-spin text-emerald-600" size={32} />
                    </div>
                  ) : financialData ? (
                    <div className="space-y-6">
                      {(() => {
                        const filteredPayments = financialData.pagamentos.filter(p => {
                          // Payment Method Filter
                          if (financeFilters.paymentMethod !== 'geral') {
                            if (financeFilters.paymentMethod === 'pix') {
                              if (p.metodo_pagamento !== 'pix') return false;
                            } else if (financeFilters.paymentMethod === 'pagarme') {
                              // Pagar.me usually means credit card or has pagarme id
                              if (p.metodo_pagamento !== 'cartao_credito' && !p.pagarme) return false;
                            } else if (financeFilters.paymentMethod === 'pagseguro') {
                              if (p.metodo_pagamento !== 'pagseguro') return false;
                            } else if (financeFilters.paymentMethod === 'wix') {
                              if (p.metodo_pagamento !== 'wix') return false;
                              
                              // Wix Type Filter
                              if (financeFilters.wixType) {
                                const tp = (p.tipo_pedido || '').toUpperCase().trim();
                                if (financeFilters.wixType === 'Loja Virtual') {
                                  if (tp !== 'ECOM PLATAFORMA' && tp !== 'ECOM PLATFORM' && tp !== 'LOJA VIRTUAL') return false;
                                } else if (financeFilters.wixType === 'Pricing Plans') {
                                  if (tp !== 'PRICING PLANS' && tp !== 'ASSINATURA') return false;
                                } else if (tp !== financeFilters.wixType.toUpperCase().trim()) {
                                  return false;
                                }
                              }
                            }
                          }

                          // If no filters, show all
                          if (!financeFilters.unidade && !financeFilters.professor && !financeFilters.search && !financeFilters.status && !financeFilters.period) return true;
                          
                          // Status filter
                          if (financeFilters.status) {
                            const isPaid = p.status?.toLowerCase() === 'pago';
                            const isCancelled = p.status?.toLowerCase() === 'cancelado';
                            const isFailed = p.status?.toLowerCase() === 'falha';
                            const isPending = !isPaid && !isCancelled;

                            if (financeFilters.status === 'pago') {
                              if (!isPaid) return false;
                            } else if (financeFilters.status === 'pendente') {
                              if (!isPending) return false;
                              // Check if it's overdue
                              if (p.data_vencimento) {
                                const dueDate = new Date(p.data_vencimento);
                                const today = new Date();
                                today.setHours(0, 0, 0, 0);
                                if (dueDate >= today) return false;
                              }
                            } else if (financeFilters.status === 'a_vencer') {
                              if (!isPending) return false;
                              // Check if it's future
                              if (p.data_vencimento) {
                                const dueDate = new Date(p.data_vencimento);
                                const today = new Date();
                                today.setHours(0, 0, 0, 0);
                                if (dueDate < today) return false;
                              } else {
                                return false; // No due date, assume it's not "A Vencer"
                              }
                            } else if (p.status !== financeFilters.status) {
                              return false;
                            }
                          }
                          
                          // Period filter
                          if (financeFilters.period) {
                            const paymentDateStr = (p.data_vencimento && p.data_vencimento.trim()) || p.created_at;
                            if (!paymentDateStr) return false;
                            
                            let paymentDate = new Date(paymentDateStr);
                            
                            // Manual parse if needed for filtering
                            if (isNaN(paymentDate.getTime()) && typeof paymentDateStr === 'string') {
                              if (paymentDateStr.includes('/')) {
                                const parts = paymentDateStr.split(' ')[0].split('/');
                                if (parts.length === 3) {
                                  const day = parseInt(parts[0]);
                                  const month = parseInt(parts[1]) - 1;
                                  const year = parts[2].length === 2 ? 2000 + parseInt(parts[2]) : parseInt(parts[2]);
                                  paymentDate = new Date(year, month, day);
                                }
                              } else if (paymentDateStr.includes('-')) {
                                const parts = paymentDateStr.split('T')[0].split('-');
                                if (parts.length === 3) {
                                  const year = parseInt(parts[0]);
                                  const month = parseInt(parts[1]) - 1;
                                  const day = parseInt(parts[2]);
                                  paymentDate = new Date(year, month, day);
                                }
                              }
                            }

                            if (isNaN(paymentDate.getTime())) return false;
                            
                            const today = new Date();
                            
                            if (financeFilters.period === 'this_month') {
                              if (paymentDate.getMonth() !== today.getMonth() || paymentDate.getFullYear() !== today.getFullYear()) return false;
                            } else if (financeFilters.period === 'last_month') {
                              const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
                              if (paymentDate.getMonth() !== lastMonth.getMonth() || paymentDate.getFullYear() !== lastMonth.getFullYear()) return false;
                            } else if (financeFilters.period === 'last_7_days') {
                              const sevenDaysAgo = new Date(today);
                              sevenDaysAgo.setDate(today.getDate() - 7);
                              sevenDaysAgo.setHours(0, 0, 0, 0);
                              if (paymentDate < sevenDaysAgo) return false;
                            } else if (financeFilters.period === 'custom') {
                              if (financeFilters.startDate) {
                                const [year, month, day] = financeFilters.startDate.split('-').map(Number);
                                const start = new Date(year, month - 1, day, 0, 0, 0, 0);
                                if (paymentDate < start) return false;
                              }
                              if (financeFilters.endDate) {
                                const [year, month, day] = financeFilters.endDate.split('-').map(Number);
                                const end = new Date(year, month - 1, day, 23, 59, 59, 999);
                                if (paymentDate > end) return false;
                              }
                            }
                          }
                          
                          const resp = p.responsaveis;
                          
                          // Search filter
                          let matchesSearch = true;
                          if (financeFilters.search) {
                            const searchLower = financeFilters.search.toLowerCase();
                            const respName = resp?.nome_completo?.toLowerCase() || '';
                            const studentNames = resp?.alunos?.map((a: any) => a.nome_completo?.toLowerCase() || '') || [];
                            matchesSearch = respName.includes(searchLower) || studentNames.some((name: string) => name.includes(searchLower));
                          }

                          if (!matchesSearch) return false;

                          // If only search and/or status and/or period filter is active and it matched, we're good
                          if (!financeFilters.unidade && !financeFilters.professor) return true;

                          if (!resp || !Array.isArray(resp.alunos)) return false;

                          // A payment is included if AT LEAST ONE student has an ACTIVE enrollment matching the filters
                          return resp.alunos.some((aluno: any) => {
                            if (!Array.isArray(aluno.matriculas)) return false;

                            return aluno.matriculas.some((mat: any) => {
                              // Only consider active enrollments for the financial report filters
                              if (mat.status && mat.status !== 'ativo') return false;
                              if (mat.data_cancelamento) return false;

                              // Unit Filter
                              const matchesUnidade = !financeFilters.unidade || 
                                (mat.unidade && mat.unidade.trim().toLowerCase() === financeFilters.unidade.trim().toLowerCase());
                              
                              // Professor Filter
                              let matchesProfessor = true;
                              if (financeFilters.professor) {
                                const targetProf = financeFilters.professor.trim().toLowerCase();
                                
                                // 1. Try direct match on enrollment (if professor was saved there)
                                const profInMat = mat.professor?.trim().toLowerCase();
                                
                                // 2. Try match via class data (using ID first, then name+unit)
                                const turma = financialData.turmas.find(t => 
                                  (t.id === mat.turma_id && mat.turma_id) || 
                                  (t.nome && mat.turma && t.nome.trim().toLowerCase() === mat.turma.trim().toLowerCase() && 
                                   (!mat.unidade || !t.unidade_nome || t.unidade_nome.trim().toLowerCase() === mat.unidade.trim().toLowerCase()))
                                );
                                const profInTurma = turma?.professor?.trim().toLowerCase();

                                matchesProfessor = (profInMat === targetProf) || (profInTurma === targetProf);
                              }
                              
                              return matchesUnidade && matchesProfessor;
                            });
                          });
                        });

                        const totalPaid = filteredPayments
                          .filter(p => p.status?.toLowerCase() === 'pago')
                          .reduce((acc, curr) => acc + Number(curr.valor), 0);
                        
                        const totalPending = filteredPayments
                          .filter(p => {
                            const isPaid = p.status?.toLowerCase() === 'pago';
                            const isCancelled = p.status?.toLowerCase() === 'cancelado';
                            if (isPaid || isCancelled) return false;
                            if (p.data_vencimento) {
                              const dueDate = new Date(p.data_vencimento);
                              const today = new Date();
                              today.setHours(0, 0, 0, 0);
                              return dueDate < today;
                            }
                            return true;
                          })
                          .reduce((acc, curr) => acc + Number(curr.valor), 0);

                        const totalUpcoming = filteredPayments
                          .filter(p => {
                            const isPaid = p.status?.toLowerCase() === 'pago';
                            const isCancelled = p.status?.toLowerCase() === 'cancelado';
                            if (isPaid || isCancelled) return false;
                            if (p.data_vencimento) {
                              const dueDate = new Date(p.data_vencimento);
                              const today = new Date();
                              today.setHours(0, 0, 0, 0);
                              return dueDate >= today;
                            }
                            return false;
                          })
                          .reduce((acc, curr) => acc + Number(curr.valor), 0);

                        // Sort by date descending
                        const sortedPayments = [...filteredPayments].sort((a, b) => {
                          const getDate = (p: any) => {
                            const dStr = (p.data_vencimento && p.data_vencimento.trim()) || p.created_at;
                            if (!dStr) return new Date(0);
                            
                            let d = new Date(dStr);
                            if (isNaN(d.getTime()) && typeof dStr === 'string') {
                              if (dStr.includes('/')) {
                                const parts = dStr.split(' ')[0].split('/');
                                if (parts.length === 3) {
                                  const day = parseInt(parts[0]);
                                  const month = parseInt(parts[1]) - 1;
                                  const year = parts[2].length === 2 ? 2000 + parseInt(parts[2]) : parseInt(parts[2]);
                                  d = new Date(year, month, day);
                                }
                              } else if (dStr.includes('-')) {
                                const parts = dStr.split('T')[0].split('-');
                                if (parts.length === 3) {
                                  const year = parseInt(parts[0]);
                                  const month = parseInt(parts[1]) - 1;
                                  const day = parseInt(parts[2]);
                                  d = new Date(year, month, day);
                                }
                              }
                            }
                            return isNaN(d.getTime()) ? new Date(0) : d;
                          };
                          return getDate(b).getTime() - getDate(a).getTime();
                        });

                        return (
                          <>
                            {financeFilters.view === 'summary' ? (
                              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                <button 
                                  onClick={() => setFinanceFilters({...financeFilters, status: 'pago', view: 'detailed'})}
                                  className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:border-emerald-300 hover:shadow-md transition-all text-left"
                                >
                                  <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">Receita (Paga)</p>
                                  <p className="text-3xl font-bold text-emerald-600">
                                    R$ {totalPaid.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                  </p>
                                  <p className="text-xs text-slate-400 mt-2 flex items-center gap-1">
                                    <ExternalLink size={12} /> Ver detalhes conciliados
                                  </p>
                                </button>
                                <button 
                                  onClick={() => setFinanceFilters({...financeFilters, status: 'pendente', view: 'detailed'})}
                                  className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:border-amber-300 hover:shadow-md transition-all text-left"
                                >
                                  <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">Pendente (Vencido)</p>
                                  <p className="text-3xl font-bold text-amber-600">
                                    R$ {totalPending.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                  </p>
                                  <p className="text-xs text-slate-400 mt-2 flex items-center gap-1">
                                    <ExternalLink size={12} /> Ver detalhes pendentes
                                  </p>
                                </button>
                                <button 
                                  onClick={() => setFinanceFilters({...financeFilters, status: 'a_vencer', view: 'detailed'})}
                                  className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:border-blue-300 hover:shadow-md transition-all text-left"
                                >
                                  <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">A Vencer</p>
                                  <p className="text-3xl font-bold text-blue-600">
                                    R$ {totalUpcoming.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                  </p>
                                  <p className="text-xs text-slate-400 mt-2 flex items-center gap-1">
                                    <ExternalLink size={12} /> Ver detalhes a vencer
                                  </p>
                                </button>
                                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                                  <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">Transações</p>
                                  <div className="flex items-baseline gap-2">
                                    <p className="text-3xl font-bold text-slate-900">{filteredPayments.length}</p>
                                    {filteredPayments.length !== financialData.pagamentos.length && (
                                      <p className="text-xs text-slate-400 font-medium">de {financialData.pagamentos.length}</p>
                                    )}
                                  </div>
                                  <p className="text-xs text-slate-400 mt-2">
                                    Total de registros filtrados
                                  </p>
                                </div>
                              </div>
                            ) : (
                              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                                <div className="overflow-x-auto">
                                  <table className="w-full text-left border-collapse">
                                    <thead>
                                      <tr className="bg-slate-50 border-b border-slate-200">
                                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Data</th>
                                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Responsável</th>
                                        {financeFilters.paymentMethod === 'wix' && (
                                          <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Tipo</th>
                                        )}
                                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Estudante</th>
                                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Unidade</th>
                                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Turma</th>
                                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Valor</th>
                                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Método</th>
                                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                      {sortedPayments.length === 0 ? (
                                        <tr>
                                          <td colSpan={financeFilters.paymentMethod === 'wix' ? 9 : 8} className="px-6 py-10 text-center text-slate-400 italic">
                                            Nenhum pagamento encontrado com os filtros selecionados.
                                          </td>
                                        </tr>
                                      ) : (
                                        sortedPayments.map((pag, idx) => {
                                          // Get the relevant student and enrollment info
                                          const studentsInfo = pag.responsaveis?.alunos?.flatMap((a: any) => {
                                            const filteredMatriculas = a.matriculas?.filter((m: any) => {
                                              // If the payment is linked to a specific enrollment, ONLY show that one and ignore cancellation status
                                              if (pag.matricula_id) {
                                                return String(m.id).trim() === String(pag.matricula_id).trim();
                                              }

                                              // Otherwise, filter out cancelled enrollments
                                              if (m.data_cancelamento && m.data_cancelamento.trim()) return false;

                                              if (financeFilters.unidade || financeFilters.professor) {
                                                const matchesUnidade = !financeFilters.unidade || 
                                                  (m.unidade && m.unidade.trim().toLowerCase() === financeFilters.unidade.trim().toLowerCase());
                                                
                                                let matchesProfessor = true;
                                                if (financeFilters.professor) {
                                                  const targetProf = financeFilters.professor.trim().toLowerCase();
                                                  const profInMat = m.professor?.trim().toLowerCase();
                                                  const turma = financialData.turmas.find(t => 
                                                    (t.id === m.turma_id && m.turma_id) || 
                                                    (t.nome && m.turma && t.nome.trim().toLowerCase() === m.turma.trim().toLowerCase() && 
                                                     (!m.unidade || !t.unidade_nome || t.unidade_nome.trim().toLowerCase() === m.unidade.trim().toLowerCase()))
                                                  );
                                                  const profInTurma = turma?.professor?.trim().toLowerCase();
                                                  matchesProfessor = (profInMat === targetProf) || (profInTurma === targetProf);
                                                }
                                                return matchesUnidade && matchesProfessor;
                                              }
                                              return true;
                                            });
                                            return filteredMatriculas?.map((m: any) => ({
                                              aluno: a.nome_completo,
                                              aka: a.turma_escolar,
                                              unidade: m.unidade,
                                              turma: m.turma
                                            })) || [];
                                          }) || [];

                                          // If we have multiple students but no specific matricula_id (legacy data),
                                          // and we are NOT filtering, we should probably only show the first one 
                                          // to avoid the "multi-line" row mess, as each payment usually refers to one enrollment.
                                          const displayInfo = (!pag.matricula_id && !financeFilters.unidade && !financeFilters.professor && studentsInfo.length > 1)
                                            ? [studentsInfo[0]] 
                                            : studentsInfo;

                                          return (
                                            <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                                              <td className="px-6 py-4 text-sm text-slate-600 whitespace-nowrap">
                                                {(() => {
                                                  const d = (pag.data_vencimento && pag.data_vencimento.trim()) || pag.created_at;
                                                  if (!d) return 'N/A';
                                                  
                                                  // Tenta parse normal
                                                  let date = new Date(d);
                                                  
                                                  // Se falhar e for string dd/mm/aaaa, tenta parse manual
                                                  if (isNaN(date.getTime()) && typeof d === 'string') {
                                                    if (d.includes('/')) {
                                                      const datePart = d.split(' ')[0];
                                                      const parts = datePart.split('/');
                                                      if (parts.length === 3) {
                                                        const day = parseInt(parts[0]);
                                                        const month = parseInt(parts[1]) - 1;
                                                        const year = parts[2].length === 2 ? 2000 + parseInt(parts[2]) : parseInt(parts[2]);
                                                        date = new Date(year, month, day);
                                                      }
                                                    } else if (d.includes('-')) {
                                                      // Tenta parse de YYYY-MM-DD
                                                      const datePart = d.split('T')[0];
                                                      const parts = datePart.split('-');
                                                      if (parts.length === 3) {
                                                        const year = parseInt(parts[0]);
                                                        const month = parseInt(parts[1]) - 1;
                                                        const day = parseInt(parts[2]);
                                                        date = new Date(year, month, day);
                                                      }
                                                    }
                                                  }

                                                  if (isNaN(date.getTime())) {
                                                    console.warn('Invalid date detected for payment:', pag.id, d);
                                                    return 'N/A';
                                                  }
                                                  return date.toLocaleDateString('pt-BR');
                                                })()}
                                              </td>
                                              <td className="px-6 py-4">
                                                <p className="font-medium text-slate-900 text-sm">{pag.responsaveis?.nome_completo}</p>
                                              </td>
                                              {financeFilters.paymentMethod === 'wix' && (
                                                <td className="px-6 py-4">
                                                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                                    (pag.tipo_pedido || '').toUpperCase().trim() === 'PRICING PLANS' ? 'bg-blue-50 text-blue-700 border border-blue-100' : 
                                                    ['ECOM PLATAFORMA', 'ECOM PLATFORM', 'LOJA VIRTUAL'].includes((pag.tipo_pedido || '').toUpperCase().trim()) ? 'bg-purple-50 text-purple-700 border border-purple-100' :
                                                    'bg-slate-50 text-slate-600 border border-slate-100'
                                                  }`}>
                                                    {(pag.tipo_pedido || '').toUpperCase().trim() === 'PRICING PLANS' ? 'Assinatura' : 
                                                     ['ECOM PLATAFORMA', 'ECOM PLATFORM', 'LOJA VIRTUAL'].includes((pag.tipo_pedido || '').toUpperCase().trim()) ? 'Loja Virtual' : 
                                                     pag.tipo_pedido || 'N/A'}
                                                  </span>
                                                </td>
                                              )}
                                              <td className="px-6 py-4">
                                                <div className="flex flex-col gap-1">
                                                  {displayInfo.map((si: any, sidx: number) => (
                                                    <p key={sidx} className="text-sm text-slate-700 font-semibold">
                                                      {si.aluno}
                                                    </p>
                                                  ))}
                                                  {displayInfo.length === 0 && <span className="text-slate-400 text-xs italic">N/A</span>}
                                                </div>
                                              </td>
                                              <td className="px-6 py-4">
                                                <div className="flex flex-col gap-1">
                                                  {Array.from(new Set(displayInfo.map((si: any) => si.unidade))).map((unidade: any, uidx) => (
                                                    <span key={uidx} className="text-xs text-slate-500 uppercase font-medium">
                                                      {unidade || 'N/A'}
                                                    </span>
                                                  ))}
                                                </div>
                                              </td>
                                              <td className="px-6 py-4">
                                                <div className="flex flex-wrap gap-1">
                                                  {displayInfo.map((si: any, sidx: number) => (
                                                    <span key={sidx} className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded border border-slate-200 font-bold uppercase">
                                                      {si.turma}
                                                    </span>
                                                  ))}
                                                </div>
                                              </td>
                                              <td className="px-6 py-4 font-bold text-slate-900 whitespace-nowrap">
                                                R$ {Number(pag.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                              </td>
                                              <td className="px-6 py-4 text-sm">
                                                <div className="flex items-center gap-2">
                                                  {pag.metodo_pagamento === 'pix' ? (
                                                    <QrCode size={14} className="text-emerald-600" />
                                                  ) : (
                                                    <CreditCard size={14} className="text-purple-600" />
                                                  )}
                                                  <span className="font-medium">
                                                    {pag.metodo_pagamento === 'cartao_credito' ? 'Cartão' : 
                                                     pag.metodo_pagamento === 'pix' ? 'PIX' : 
                                                     pag.metodo_pagamento?.replace('_', ' ').toUpperCase()}
                                                  </span>
                                                </div>
                                              </td>
                                              <td className="px-6 py-4">
                                                {(() => {
                                                  const isPaid = pag.status?.toLowerCase() === 'pago';
                                                  const isCancelled = pag.status?.toLowerCase() === 'cancelado';
                                                  const isRefunded = pag.status?.toLowerCase() === 'estornado';
                                                  const isFailed = pag.status?.toLowerCase() === 'falha';
                                                  
                                                  let statusLabel = 'Pendente';
                                                  let statusColor = 'bg-amber-100 text-amber-800';
                                                  
                                                  if (isPaid) {
                                                    statusLabel = 'Conciliado';
                                                    statusColor = 'bg-emerald-100 text-emerald-800';
                                                  } else if (isCancelled) {
                                                    statusLabel = 'Cancelado';
                                                    statusColor = 'bg-red-100 text-red-800';
                                                  } else if (isRefunded) {
                                                    statusLabel = 'Estornado';
                                                    statusColor = 'bg-blue-100 text-blue-800';
                                                  } else if (isFailed) {
                                                    statusLabel = 'Falhou';
                                                    statusColor = 'bg-rose-100 text-rose-800';
                                                  } else if (pag.data_vencimento) {
                                                    const dueDate = new Date(pag.data_vencimento);
                                                    const today = new Date();
                                                    today.setHours(0, 0, 0, 0);
                                                    if (dueDate >= today) {
                                                      statusLabel = 'A Vencer';
                                                      statusColor = 'bg-blue-100 text-blue-800';
                                                    }
                                                  }

                                                  return (
                                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColor}`}>
                                                      {statusLabel}
                                                    </span>
                                                  );
                                                })()}
                                              </td>
                                            </tr>
                                          );
                                        })
                                      )}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  ) : (
                    <div className="text-center py-12 text-slate-400 italic">
                      Nenhum dado financeiro disponível.
                    </div>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  <div className="lg:col-span-1 space-y-6">
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                      <h3 className="font-bold text-slate-900 mb-4 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {editingOption ? <Edit3 size={18} className="text-amber-600" /> : <Plus size={18} className="text-emerald-600" />}
                          {editingOption ? 'Editar Opção' : 'Adicionar Opção'}
                        </div>
                        {editingOption && (
                          <button 
                            onClick={() => {
                              setEditingOption(null);
                              setNewOption({
                                ...newOption,
                                nome: '',
                                unidade_nome: '',
                                series_permitidas: [],
                                idade_minima: 0,
                                idade_maxima: 18,
                                dias_horarios: '',
                                valor_mensalidade: 0,
                                capacidade: 0,
                                local_aula: '',
                                data_inicio: ''
                              });
                            }}
                            className="text-[10px] text-amber-700 underline font-bold"
                          >
                            Cancelar
                          </button>
                        )}
                      </h3>
                      <form onSubmit={handleAddOption} className="space-y-4">
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-500 uppercase">Tipo de Dado</label>
                          <select 
                            className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                            value={newOption.type}
                            onChange={e => setNewOption({...newOption, type: e.target.value})}
                          >
                            <option value="series">Série / Ano</option>
                            <option value="unidades">Unidade de Atendimento</option>
                            <option value="turmas">Turma Complementar</option>
                          </select>
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-500 uppercase">Nome / Descrição</label>
                          <input 
                            type="text" 
                            className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                            placeholder="Ex: 6º Ano Fundamental"
                            value={newOption.nome}
                            onChange={e => setNewOption({...newOption, nome: e.target.value})}
                          />
                        </div>
                        {newOption.type === 'turmas' && (
                          <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-1">
                                <label className="text-xs font-bold text-slate-500 uppercase">Vincular à Unidade</label>
                                <select 
                                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                                  value={newOption.unidade_nome}
                                  onChange={e => setNewOption({...newOption, unidade_nome: e.target.value})}
                                >
                                  <option value="">Selecione uma Unidade...</option>
                                  {options.unidades.map(u => (
                                    <option key={u} value={u}>{u}</option>
                                  ))}
                                </select>
                              </div>
                              <div className="space-y-1">
                                <label className="text-xs font-bold text-slate-500 uppercase">Local da Aula</label>
                                <input 
                                  type="text" 
                                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                                  placeholder="Ex: Sala de Ballet"
                                  value={newOption.local_aula}
                                  onChange={e => setNewOption({...newOption, local_aula: e.target.value})}
                                />
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-1">
                                <label className="text-xs font-bold text-slate-500 uppercase">Idade Mínima</label>
                                <input 
                                  type="number" 
                                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                                  value={newOption.idade_minima}
                                  onChange={e => setNewOption({...newOption, idade_minima: Number(e.target.value)})}
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="text-xs font-bold text-slate-500 uppercase">Idade Máxima</label>
                                <input 
                                  type="number" 
                                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                                  value={newOption.idade_maxima}
                                  onChange={e => setNewOption({...newOption, idade_maxima: Number(e.target.value)})}
                                />
                              </div>
                            </div>

                            <div className="space-y-1">
                              <label className="text-xs font-bold text-slate-500 uppercase">Dias e Horários</label>
                              <input 
                                type="text" 
                                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                                placeholder="Ex: Seg e Qua - 14:00 às 15:00"
                                value={newOption.dias_horarios}
                                onChange={e => setNewOption({...newOption, dias_horarios: e.target.value})}
                              />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-1">
                                <label className="text-xs font-bold text-slate-500 uppercase">Valor Mensalidade (R$)</label>
                                <input 
                                  type="number" 
                                  step="0.01"
                                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                                  value={newOption.valor_mensalidade}
                                  onChange={e => setNewOption({...newOption, valor_mensalidade: Number(e.target.value)})}
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="text-xs font-bold text-slate-500 uppercase">Capacidade</label>
                                <input 
                                  type="number" 
                                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                                  value={newOption.capacidade}
                                  onChange={e => setNewOption({...newOption, capacidade: Number(e.target.value)})}
                                />
                              </div>
                            </div>

                            <div className="space-y-1">
                              <label className="text-xs font-bold text-slate-500 uppercase">Data de Início</label>
                              <input 
                                type="date" 
                                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                                value={newOption.data_inicio}
                                onChange={e => setNewOption({...newOption, data_inicio: e.target.value})}
                              />
                            </div>

                            <div className="space-y-1">
                              <label className="text-xs font-bold text-slate-500 uppercase">Status</label>
                              <select 
                                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                                value={newOption.status}
                                onChange={e => setNewOption({...newOption, status: e.target.value})}
                              >
                                <option value="ativo">Ativo</option>
                                <option value="inativo">Inativo</option>
                              </select>
                            </div>

                            <div className="space-y-1">
                              <label className="text-xs font-bold text-slate-500 uppercase">Professor(a)</label>
                              <input 
                                type="text" 
                                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                                placeholder="Nome do professor"
                                value={newOption.professor}
                                onChange={e => setNewOption({...newOption, professor: e.target.value})}
                              />
                            </div>

                            <div className="space-y-1">
                              <label className="text-xs font-bold text-slate-500 uppercase">Séries Permitidas</label>
                              <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto p-2 border border-slate-200 rounded-lg">
                                {options.series.map(s => (
                                  <label key={s} className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer hover:bg-slate-50 p-1 rounded">
                                    <input 
                                      type="checkbox"
                                      checked={newOption.series_permitidas.includes(s)}
                                      onChange={e => {
                                        const updated = e.target.checked 
                                          ? [...newOption.series_permitidas, s]
                                          : newOption.series_permitidas.filter(item => item !== s);
                                        setNewOption({...newOption, series_permitidas: updated});
                                      }}
                                      className="rounded text-emerald-600 focus:ring-emerald-500"
                                    />
                                    {s}
                                  </label>
                                ))}
                              </div>
                              <p className="text-[10px] text-slate-400">Selecione todas as séries que podem se matricular nesta turma.</p>
                            </div>
                          </div>
                        )}
                        {newOption.type === 'series' && (
                          <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase">Ordem de Exibição</label>
                            <input 
                              type="number" 
                              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                              value={newOption.ordem}
                              onChange={e => setNewOption({...newOption, ordem: Number(e.target.value)})}
                            />
                          </div>
                        )}
                        <button 
                          type="submit"
                          className={`w-full ${editingOption ? 'bg-amber-600 hover:bg-amber-700' : 'bg-emerald-600 hover:bg-emerald-700'} text-white py-2 rounded-lg font-medium transition-colors flex items-center justify-center gap-2`}
                        >
                          {editingOption ? 'Atualizar' : 'Salvar'} <Save size={16} />
                        </button>
                      </form>
                    </div>
                  </div>

                    <div className="lg:col-span-2 space-y-6">
                      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                          <h3 className="font-bold text-slate-900">Visualização das Listas</h3>
                          <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                            <input 
                              type="text" 
                              placeholder="Filtrar itens..." 
                              className="pl-9 pr-4 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-emerald-500 outline-none w-full md:w-48"
                              value={settingsSearch}
                              onChange={e => setSettingsSearch(e.target.value)}
                            />
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                          <div className="space-y-3">
                            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                              Séries
                              <span className="bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded text-[10px]">{options.series.length}</span>
                            </h4>
                            <ul className="space-y-1 max-h-[400px] overflow-y-auto pr-1 custom-scrollbar">
                              {options.series.filter(s => s.toLowerCase().includes(settingsSearch.toLowerCase())).map(s => (
                                <li key={s} className="group flex items-center justify-between text-sm text-slate-600 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100 hover:border-emerald-200 hover:bg-emerald-50/30 transition-all">
                                <span>{s}</span>
                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                  <button 
                                    onClick={() => handleEditOption('series', s)}
                                    className="p-1 text-slate-400 hover:text-emerald-600 transition-all"
                                    title="Editar"
                                  >
                                    <Edit3 size={14} />
                                  </button>
                                  <button 
                                    onClick={() => handleDeleteOption('series', s)}
                                    className="p-1 text-slate-400 hover:text-red-500 transition-all"
                                    title="Excluir"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              </li>
                            ))}
                          </ul>
                        </div>
                          <div className="space-y-3">
                            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                              Unidades
                              <span className="bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded text-[10px]">{options.unidades.length}</span>
                            </h4>
                            <ul className="space-y-1 max-h-[400px] overflow-y-auto pr-1 custom-scrollbar">
                              {options.unidades.filter(u => u.toLowerCase().includes(settingsSearch.toLowerCase())).map(u => (
                                <li key={u} className="group flex items-center justify-between text-sm text-slate-600 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100 hover:border-emerald-200 hover:bg-emerald-50/30 transition-all">
                                <span>{u}</span>
                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                  <button 
                                    onClick={() => handleEditOption('unidades', u)}
                                    className="p-1 text-slate-400 hover:text-emerald-600 transition-all"
                                    title="Editar"
                                  >
                                    <Edit3 size={14} />
                                  </button>
                                  <button 
                                    onClick={() => handleDeleteOption('unidades', u)}
                                    className="p-1 text-slate-400 hover:text-red-500 transition-all"
                                    title="Excluir"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              </li>
                            ))}
                          </ul>
                        </div>
                          <div className="space-y-3">
                            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                              Turmas
                              <span className="bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded text-[10px]">{options.turmas.length}</span>
                            </h4>
                            <ul className="space-y-2 max-h-[400px] overflow-y-auto pr-1 custom-scrollbar">
                              {options.turmas.filter(t => t.nome.toLowerCase().includes(settingsSearch.toLowerCase()) || (t.unidade_nome || '').toLowerCase().includes(settingsSearch.toLowerCase())).map(t => (
                                <li key={t.id || t.nome} className="group flex flex-col gap-2 text-sm text-slate-600 bg-slate-50 p-4 rounded-xl border border-slate-100 relative hover:border-emerald-200 hover:bg-emerald-50/30 transition-all">
                                <div className="flex items-center justify-between">
                                  <span className="font-bold text-slate-900 text-base">{t.nome}</span>
                                  <div className="flex gap-1">
                                    <button 
                                      onClick={() => handleEditOption('turmas', t)}
                                      className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all"
                                      title="Editar"
                                    >
                                      <Edit3 size={16} />
                                    </button>
                                    <button 
                                      onClick={() => handleDeleteOption('turmas', t.nome)}
                                      className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                      title="Excluir"
                                    >
                                      <Trash2 size={16} />
                                    </button>
                                  </div>
                                  <div className="flex flex-col">
                                    <span className="text-slate-400 uppercase font-bold text-[9px]">Status</span>
                                    <span className={`font-bold ${t.status === 'inativo' ? 'text-red-500' : 'text-emerald-600'}`}>
                                      {(t.status || 'ativo').toUpperCase()}
                                    </span>
                                  </div>
                                </div>
                                
                                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-[11px]">
                                  <div className="flex flex-col">
                                    <span className="text-slate-400 uppercase font-bold text-[9px]">Unidade</span>
                                    <span className="font-medium">{t.unidade_nome || 'N/A'}</span>
                                  </div>
                                  <div className="flex flex-col">
                                    <span className="text-slate-400 uppercase font-bold text-[9px]">Local</span>
                                    <span className="font-medium">{t.local_aula || 'N/A'}</span>
                                  </div>
                                  <div className="flex flex-col">
                                    <span className="text-slate-400 uppercase font-bold text-[9px]">Horários</span>
                                    <span className="font-medium">{t.dias_horarios || 'N/A'}</span>
                                  </div>
                                  <div className="flex flex-col">
                                    <span className="text-slate-400 uppercase font-bold text-[9px]">Valor</span>
                                    <span className="font-medium text-emerald-600">R$ {t.valor_mensalidade?.toFixed(2) || '0.00'}</span>
                                  </div>
                                  <div className="flex flex-col">
                                    <span className="text-slate-400 uppercase font-bold text-[9px]">Idade</span>
                                    <span className="font-medium">{t.idade_minima} - {t.idade_maxima} anos</span>
                                  </div>
                                  <div className="flex flex-col">
                                    <span className="text-slate-400 uppercase font-bold text-[9px]">Início</span>
                                    <span className="font-medium">{t.data_inicio ? new Date(t.data_inicio).toLocaleDateString() : 'N/A'}</span>
                                  </div>
                                  <div className="flex flex-col">
                                    <span className="text-slate-400 uppercase font-bold text-[9px]">Professor(a)</span>
                                    <span className="font-medium">{t.professor || 'N/A'}</span>
                                  </div>
                                </div>

                                <div className="flex flex-wrap gap-1 mt-1">
                                  {(Array.isArray(t.series_permitidas) ? t.series_permitidas : (typeof t.series_permitidas === 'string' ? t.series_permitidas.split(',') : [])).map(s => (
                                    <span key={s} className="text-[9px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-medium">{s.trim()}</span>
                                  ))}
                                </div>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>

                    {/* Termos e Condições Section */}
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mt-6">
                      <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                        <FileText size={18} className="text-blue-600" />
                        Modelo de Termos e Condições
                      </h3>
                      <div className="space-y-4">
                        <p className="text-xs text-slate-500">
                          Use as tags dinâmicas: <strong>[ESTUDANTE]</strong>, <strong>[RESPONSAVEL]</strong>, 
                          <strong>[UNIDADE]</strong>, <strong>[CURSO]</strong>, <strong>[INICIO]</strong>, <strong>[FIM]</strong>, <strong>[VALOR]</strong>, 
                          <strong>[VALOR PADRAO]</strong>, <strong>[desconto taxa zero]</strong>, <strong>[VALOR CHEIO]</strong>
                        </p>
                        <textarea 
                          className="w-full h-64 px-4 py-3 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                          placeholder="Escreva o termo aqui..."
                          value={termsTemplate}
                          onChange={e => setTermsTemplate(e.target.value)}
                        />
                        <button 
                          onClick={handleSaveTerms}
                          disabled={isSavingTerms}
                          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 disabled:opacity-50"
                        >
                          {isSavingTerms ? 'Salvando...' : 'Salvar Termo'} <Save size={16} />
                        </button>
                      </div>
                    </div>

                    {/* Pagar.me Configuration Section */}
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mt-6">
                      <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                        <CreditCard size={18} className="text-emerald-600" />
                        Configuração Pagar.me (Fatura)
                      </h3>
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase">Descrição Padrão (Max 13 chars)</label>
                            <input 
                              type="text" 
                              maxLength={13}
                              className="w-full px-4 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                              placeholder="SportForKids"
                              value={pagarmeSoftDescriptor}
                              onChange={e => setPagarmeSoftDescriptor(e.target.value)}
                            />
                            <p className="text-[10px] text-slate-400">O que aparecerá na fatura do cartão do cliente.</p>
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase">Descrição Bernoulli (Max 13 chars)</label>
                            <input 
                              type="text" 
                              maxLength={13}
                              className="w-full px-4 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                              placeholder="BernoulliMais"
                              value={pagarmeSoftDescriptorBernoulli}
                              onChange={e => setPagarmeSoftDescriptorBernoulli(e.target.value)}
                            />
                            <p className="text-[10px] text-slate-400">Usado para unidades que contêm "Bernoulli" no nome.</p>
                          </div>
                        </div>
                        <button 
                          onClick={handleSavePagarmeSettings}
                          disabled={isSavingPagarme}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 disabled:opacity-50"
                        >
                          {isSavingPagarme ? 'Salvando...' : 'Salvar Configurações'} <Save size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              </motion.div>
            )
          ) : step === 'portal' ? (
            <motion.div
              key="portal"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900">Olá, {formData.guardian.name.split(' ')[0]}!</h2>
                  <p className="text-slate-500 text-sm">Bem-vindo ao seu portal do responsável.</p>
                </div>
                <div className="flex gap-2 bg-white p-1 rounded-xl shadow-sm border border-slate-200">
                  <button 
                    onClick={() => setPortalTab('dashboard')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${portalTab === 'dashboard' ? 'bg-emerald-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
                  >
                    Dashboard
                  </button>
                  <button 
                    onClick={() => setPortalTab('payments')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${portalTab === 'payments' ? 'bg-emerald-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
                  >
                    Financeiro
                  </button>
                  <button 
                    onClick={() => setPortalTab('profile')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${portalTab === 'profile' ? 'bg-emerald-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
                  >
                    Meu Perfil
                  </button>
                  <button 
                    onClick={() => setPortalTab('documents')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${portalTab === 'documents' ? 'bg-emerald-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
                  >
                    Documentos
                  </button>
                  <button 
                    onClick={() => {
                      resetGuardian();
                      setStep('guardian');
                    }}
                    className="px-4 py-2 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 transition-all"
                  >
                    Sair
                  </button>
                </div>
              </div>

              {portalTab === 'dashboard' && (
                <div className="space-y-6">
                  {/* Banner de CPF Provisório */}
                  {formData.guardian.cpf.startsWith('IMP') && (
                    <motion.div 
                      initial={{ opacity: 0, y: -20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-center gap-4 text-amber-800"
                    >
                      <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                        <Info className="text-amber-600" size={20} />
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold">CPF Provisório Detectado</p>
                        <p className="text-sm opacity-90">Por favor, atualize seu CPF e defina uma senha no seu perfil para garantir o acesso futuro.</p>
                      </div>
                      <button 
                        onClick={() => {
                          setPortalTab('profile');
                          setIsEditingProfile(true);
                        }}
                        className="px-4 py-2 bg-amber-600 text-white rounded-xl text-sm font-medium hover:bg-amber-700 transition-colors"
                      >
                        Atualizar Agora
                      </button>
                    </motion.div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                      <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">Dependentes</p>
                      <p className="text-3xl font-bold text-slate-900">{groupedDependents.length}</p>
                    </div>
                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                      <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">Matrículas Ativas</p>
                      <p className="text-3xl font-bold text-emerald-600">
                        {groupedDependents.reduce((acc, dep) => acc + dep.matriculasAtivas.length, 0)}
                      </p>
                    </div>
                    <button 
                      onClick={() => setStep('student')}
                      className="bg-emerald-600 p-6 rounded-2xl shadow-lg shadow-emerald-200 text-white flex flex-col items-center justify-center gap-2 hover:bg-emerald-700 transition-all group"
                    >
                      <Plus size={24} className="group-hover:scale-110 transition-transform" />
                      <span className="font-bold">Nova Matrícula</span>
                    </button>
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-lg font-bold text-slate-900">Seus Dependentes</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {groupedDependents.map((dep, idx) => (
                        <div key={idx} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                          <div className="p-6 border-b border-slate-100 flex items-center gap-4">
                            <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 font-bold text-lg">
                              {dep.nome_completo?.charAt(0)}
                            </div>
                            <div>
                              <h4 className="font-bold text-slate-900">{dep.nome_completo}</h4>
                              <p className="text-xs text-slate-500 uppercase">{dep.serie_ano?.replace('_', ' ')} • {dep.turma_escolar}</p>
                            </div>
                          </div>
                          <div className="p-6 space-y-4">
                            {dep.matriculasAtivas.length > 0 ? (
                              dep.matriculasAtivas.map((mat: any) => (
                                <div key={mat.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                                  <div>
                                    <p className="text-sm font-bold text-slate-800">{mat.turma}</p>
                                    <p className="text-[10px] text-slate-500 uppercase">{mat.unidade}</p>
                                  </div>
                                  <div className="flex gap-2">
                                    <button 
                                      onClick={() => {
                                        setFormData({
                                          ...formData,
                                          student: {
                                            ...formData.student,
                                            name: dep.nome_completo || '',
                                            birthDate: dep.data_nascimento || '',
                                            grade: dep.serie_ano || '',
                                            turmaEscolar: dep.turma_escolar || '',
                                            responsavel1: dep.responsavel_1 || '',
                                            whatsapp1: dep.whatsapp_1 || '',
                                            responsavel2: dep.responsavel_2 || '',
                                            whatsapp2: dep.whatsapp_2 || '',
                                            unidade: mat.unidade,
                                            turmaComplementar: mat.turma
                                          }
                                        });
                                        setTransferringEnrollmentId(mat.id);
                                        setTransferringStudent({
                                          id: dep.aluno_id,
                                          nome_completo: dep.nome_completo,
                                          serie_ano: dep.serie_ano,
                                          data_nascimento: dep.data_nascimento
                                        });
                                        setStep('enrollment');
                                      }}
                                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                      title="Transferir"
                                    >
                                      <RefreshCw size={16} />
                                    </button>
                                    <button 
                                      onClick={() => handleCancelEnrollment(mat.id)}
                                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                      title="Cancelar"
                                    >
                                      <Trash2 size={16} />
                                    </button>
                                    {mat.pagarme_subscription_id && !payments.some(p => p.matricula_id === mat.id && p.metodo_pagamento === 'pix') && (
                                      <button 
                                        onClick={() => {
                                          setSelectedEnrollmentForCard(mat.id);
                                          setIsUpdatingCard(true);
                                        }}
                                        className="flex items-center gap-1 px-2 py-1 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors text-[10px] font-bold uppercase"
                                        title="Atualizar Cartão"
                                      >
                                        <CreditCard size={14} />
                                        Cartão
                                      </button>
                                    )}
                                  </div>
                                </div>
                              ))
                            ) : (
                              <p className="text-sm text-slate-400 italic text-center py-4">Nenhuma matrícula ativa.</p>
                            )}

                            {/* Histórico de Matrículas no Portal */}
                            {dep.historico && dep.historico.length > 0 && (
                              <div className="pt-4 border-t border-slate-100 space-y-2">
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Histórico de Matrículas</p>
                                {dep.historico.map((mat: any) => (
                                  <div key={mat.id} className="flex items-center justify-between p-3 bg-slate-50/50 rounded-xl border border-slate-100 opacity-75">
                                    <div className="flex flex-col flex-1">
                                      <div className="flex items-center gap-2">
                                        <span className="text-xs font-bold text-slate-500 line-through">{mat.turma}</span>
                                        <span className="text-[9px] px-1.5 py-0.5 bg-slate-100 text-slate-400 rounded font-medium uppercase">{mat.unidade}</span>
                                      </div>
                                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
                                        {mat.horario && (
                                          <span className="text-[10px] text-slate-400 flex items-center gap-1">
                                            <Clock size={10} /> {mat.horario}
                                          </span>
                                        )}
                                        {mat.data_matricula && (
                                          <span className="text-[10px] text-slate-400 flex items-center gap-1">
                                            <Calendar size={10} /> Início: {(() => {
                                              const [y, m, d] = mat.data_matricula.split('T')[0].split('-');
                                              return `${d}/${m}/${y.slice(-2)}`;
                                            })()}
                                          </span>
                                        )}
                                        {mat.data_cancelamento && (
                                          <span className={`text-[10px] ${mat.status === 'transferido' ? 'text-blue-400' : 'text-red-400'} font-medium flex items-center gap-1`}>
                                            <XCircle size={10} /> {mat.status === 'transferido' ? 'Transferido' : 'Cancelado'}: {(() => {
                                              const [y, m, d] = mat.data_cancelamento.split('T')[0].split('-');
                                              return `${d}/${m}/${y.slice(-2)}`;
                                            })()}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {portalTab === 'payments' && (
                <div className="space-y-6">
                  <h3 className="text-xl font-bold text-slate-900">Financeiro</h3>
                  <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200">
                            <th className="px-6 py-4 text-sm font-bold text-slate-700">Data</th>
                            <th className="px-6 py-4 text-sm font-bold text-slate-700">Valor</th>
                            <th className="px-6 py-4 text-sm font-bold text-slate-700">Método</th>
                            <th className="px-6 py-4 text-sm font-bold text-slate-700">Status</th>
                            <th className="px-6 py-4 text-sm font-bold text-slate-700">Ações</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {payments.length === 0 ? (
                            <tr>
                              <td colSpan={5} className="px-6 py-10 text-center text-slate-400 italic">
                                Nenhum pagamento registrado.
                              </td>
                            </tr>
                          ) : (
                            payments.map((p) => (
                              <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                                <td className="px-6 py-4 text-sm text-slate-600">
                                  {new Date(p.data_vencimento || p.created_at).toLocaleDateString()}
                                </td>
                                <td className="px-6 py-4 text-sm font-bold text-slate-900">
                                  R$ {p.valor?.toFixed(2)}
                                </td>
                                <td className="px-6 py-4 text-sm text-slate-600 uppercase">
                                  {p.metodo_pagamento?.replace('_', ' ')}
                                </td>
                                <td className="px-6 py-4">
                                  <div className="flex items-center gap-2">
                                    {(() => {
                                      const isPaid = p.status?.toLowerCase() === 'pago';
                                      const isCancelled = p.status?.toLowerCase() === 'cancelado';
                                      const isRefunded = p.status?.toLowerCase() === 'estornado';
                                      const isFailed = p.status?.toLowerCase() === 'falha';
                                      
                                      let statusLabel = 'Pendente';
                                      let statusColor = 'bg-amber-100 text-amber-700';
                                      
                                      if (isPaid) {
                                        statusLabel = 'Pago';
                                        statusColor = 'bg-emerald-100 text-emerald-700';
                                      } else if (isCancelled) {
                                        statusLabel = 'Cancelado';
                                        statusColor = 'bg-red-100 text-red-700';
                                      } else if (isRefunded) {
                                        statusLabel = 'Estornado';
                                        statusColor = 'bg-blue-100 text-blue-700';
                                      } else if (isFailed) {
                                        statusLabel = 'Falhou';
                                        statusColor = 'bg-rose-100 text-rose-700';
                                      } else if (p.data_vencimento) {
                                        const dueDate = new Date(p.data_vencimento);
                                        const today = new Date();
                                        today.setHours(0, 0, 0, 0);
                                        if (dueDate >= today) {
                                          statusLabel = 'A Vencer';
                                          statusColor = 'bg-blue-100 text-blue-700';
                                        }
                                      }

                                      return (
                                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${statusColor}`}>
                                          {statusLabel}
                                        </span>
                                      );
                                    })()}
                                    {(p.status === 'pendente' || (p.data_vencimento && new Date(p.data_vencimento).getTime() >= new Date().setHours(0,0,0,0))) && (
                                      <button
                                        onClick={async () => {
                                          try {
                                            const res = await fetch(`/api/payments/sync/${p.id}`);
                                            const data = await res.json();
                                            if (data.updated) {
                                              alert('Pagamento sincronizado com sucesso!');
                                              fetchPayments(formData.guardian.id || '');
                                            } else {
                                              alert(`Status atual: ${data.status}. O pagamento ainda não foi confirmado pela Pagar.me.`);
                                            }
                                          } catch (e) {
                                            alert('Erro ao sincronizar pagamento.');
                                          }
                                        }}
                                        className="p-1 hover:bg-slate-200 rounded-lg transition-colors text-slate-500"
                                        title="Sincronizar com Pagar.me"
                                      >
                                        <RefreshCw className="w-3 h-3" />
                                      </button>
                                    )}
                                  </div>
                                </td>
                                <td className="px-6 py-4">
                                  {p.status === 'pago' ? (
                                    <button 
                                      onClick={() => handleDownloadReceipt(p.id)}
                                      className="text-emerald-600 hover:text-emerald-700 text-xs font-bold flex items-center gap-1"
                                    >
                                      <FileText size={14} /> Recibo
                                    </button>
                                  ) : (
                                    <span className="text-slate-400 text-xs italic">Indisponível</span>
                                  )}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {portalTab === 'documents' && (
                <div className="space-y-6">
                  <h3 className="text-xl font-bold text-slate-900">Central de Documentos</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="p-3 bg-blue-50 rounded-xl text-blue-600">
                          <FileText size={24} />
                        </div>
                        <h4 className="font-bold text-slate-900">Contratos de Matrícula</h4>
                      </div>
                      <p className="text-sm text-slate-500">Baixe os contratos assinados digitalmente para cada uma de suas matrículas ativas.</p>
                      <div className="space-y-2">
                        {groupedDependents.flatMap(dep => dep.matriculasAtivas).length === 0 ? (
                          <p className="text-xs text-slate-400 italic">Nenhuma matrícula ativa encontrada.</p>
                        ) : (
                          groupedDependents.flatMap(dep => dep.matriculasAtivas).map((mat: any) => (
                            <div key={mat.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                              <div>
                                <p className="text-sm font-bold text-slate-800">{mat.turma}</p>
                                <p className="text-[10px] text-slate-500 uppercase">{mat.unidade}</p>
                              </div>
                              <button 
                                onClick={() => handleDownloadContract(mat.id)}
                                className="px-3 py-1.5 bg-white border border-slate-200 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-50 transition-all flex items-center gap-2"
                              >
                                <Download size={14} />
                                Baixar PDF
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="p-3 bg-emerald-50 rounded-xl text-emerald-600">
                          <DollarSign size={24} />
                        </div>
                        <h4 className="font-bold text-slate-900">Recibos de Pagamento</h4>
                      </div>
                      <p className="text-sm text-slate-500">Acesse os recibos de todas as mensalidades quitadas até o momento.</p>
                      <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                        {payments.filter(p => p.status === 'pago').length === 0 ? (
                          <p className="text-xs text-slate-400 italic">Nenhum pagamento quitado encontrado.</p>
                        ) : (
                          payments.filter(p => p.status === 'pago').map((p) => (
                            <div key={p.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                              <div>
                                <p className="text-sm font-bold text-slate-800">R$ {p.valor?.toFixed(2)}</p>
                                <p className="text-[10px] text-slate-500 uppercase">{new Date(p.created_at).toLocaleDateString()} • {p.turma || 'Matrícula'}</p>
                              </div>
                              <button 
                                onClick={() => handleDownloadReceipt(p.id)}
                                className="px-3 py-1.5 bg-white border border-slate-200 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-50 transition-all flex items-center gap-2"
                              >
                                <Download size={14} />
                                Recibo
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {portalTab === 'profile' && (
                <div className="max-w-2xl mx-auto bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="p-8 border-b border-slate-100 flex justify-between items-center">
                    <div>
                      <h3 className="text-xl font-bold text-slate-900">Meu Perfil</h3>
                      <p className="text-slate-500 text-sm">Gerencie suas informações pessoais.</p>
                    </div>
                    {!isEditingProfile && !isChangingPassword && (
                      <div className="flex gap-2">
                        <button 
                          onClick={() => setIsEditingProfile(true)}
                          className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-bold hover:bg-slate-200 transition-all"
                        >
                          <Edit3 size={16} />
                          Atualizar Dados
                        </button>
                        <button 
                          onClick={() => setIsChangingPassword(true)}
                          className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-bold hover:bg-slate-200 transition-all"
                        >
                          <Lock size={16} />
                          Alterar Senha
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="p-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Nome Completo</label>
                        {isEditingProfile ? (
                          <input 
                            type="text" 
                            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                            value={formData.guardian.name}
                            onChange={e => setFormData({...formData, guardian: {...formData.guardian, name: e.target.value}})}
                          />
                        ) : (
                          <p className="text-slate-900 font-medium py-2.5">{formData.guardian.name}</p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">E-mail</label>
                        {isEditingProfile ? (
                          <input 
                            type="email" 
                            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                            value={formData.guardian.email}
                            onChange={e => setFormData({...formData, guardian: {...formData.guardian, email: e.target.value}})}
                          />
                        ) : (
                          <p className="text-slate-900 font-medium py-2.5">{formData.guardian.email}</p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Telefone</label>
                        {isEditingProfile ? (
                          <input 
                            type="tel" 
                            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                            value={formData.guardian.phone}
                            onChange={e => setFormData({...formData, guardian: {...formData.guardian, phone: e.target.value}})}
                          />
                        ) : (
                          <p className="text-slate-900 font-medium py-2.5">{formData.guardian.phone}</p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">CPF</label>
                        {isEditingProfile && (formData.guardian.cpf.startsWith('IMP') || !formData.guardian.cpf) ? (
                          <input 
                            type="text" 
                            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                            value={formData.guardian.cpf.startsWith('IMP') ? '' : formData.guardian.cpf}
                            placeholder="000.000.000-00"
                            onChange={e => setFormData({...formData, guardian: {...formData.guardian, cpf: e.target.value}})}
                          />
                        ) : (
                          <p className={`${formData.guardian.cpf.startsWith('IMP') ? 'text-amber-600 font-bold' : 'text-slate-900'} font-medium py-2.5`}>
                            {formData.guardian.cpf}
                            {formData.guardian.cpf.startsWith('IMP') && ' (Provisório - Clique em Atualizar)'}
                          </p>
                        )}
                      </div>
                      <div className="md:col-span-2 space-y-4">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Endereço Completo</label>
                        {isEditingProfile ? (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
                                CEP
                                {isFetchingAddress && <RefreshCw size={12} className="animate-spin text-emerald-500" />}
                              </label>
                              <input 
                                type="text" 
                                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                                value={formData.guardian.zipCode}
                                onChange={e => {
                                  const val = e.target.value.replace(/\D/g, '');
                                  const formatted = val.replace(/^(\d{5})(\d)/, '$1-$2').substring(0, 9);
                                  setFormData({...formData, guardian: {...formData.guardian, zipCode: formatted}});
                                  if (val.length === 8) fetchAddressByCep(val);
                                }}
                                onBlur={e => {
                                  const val = e.target.value.replace(/\D/g, '');
                                  if (val.length === 8) fetchAddressByCep(val);
                                }}
                                placeholder="00000-000"
                              />
                            </div>
                            <div className="space-y-2">
                              <label className="text-xs font-bold text-slate-500 uppercase">Rua</label>
                              <input 
                                type="text" 
                                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                                value={formData.guardian.street}
                                onChange={e => setFormData({...formData, guardian: {...formData.guardian, street: e.target.value}})}
                              />
                            </div>
                            <div className="space-y-2">
                              <label className="text-xs font-bold text-slate-500 uppercase">Número</label>
                              <input 
                                type="text" 
                                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                                value={formData.guardian.number}
                                onChange={e => setFormData({...formData, guardian: {...formData.guardian, number: e.target.value}})}
                              />
                            </div>
                            <div className="space-y-2">
                              <label className="text-xs font-bold text-slate-500 uppercase">Complemento</label>
                              <input 
                                type="text" 
                                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                                value={formData.guardian.complement}
                                onChange={e => setFormData({...formData, guardian: {...formData.guardian, complement: e.target.value}})}
                              />
                            </div>
                            <div className="space-y-2">
                              <label className="text-xs font-bold text-slate-500 uppercase">Bairro</label>
                              <input 
                                type="text" 
                                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                                value={formData.guardian.neighborhood}
                                onChange={e => setFormData({...formData, guardian: {...formData.guardian, neighborhood: e.target.value}})}
                              />
                            </div>
                            <div className="space-y-2">
                              <label className="text-xs font-bold text-slate-500 uppercase">Cidade</label>
                              <input 
                                type="text" 
                                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                                value={formData.guardian.city}
                                onChange={e => setFormData({...formData, guardian: {...formData.guardian, city: e.target.value}})}
                              />
                            </div>
                            <div className="space-y-2">
                              <label className="text-xs font-bold text-slate-500 uppercase">Estado (UF)</label>
                              <input 
                                type="text" 
                                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                                value={formData.guardian.state}
                                onChange={e => setFormData({...formData, guardian: {...formData.guardian, state: e.target.value.toUpperCase().substring(0, 2)}})}
                                placeholder="SP"
                              />
                            </div>
                          </div>
                        ) : (
                          <p className="text-slate-900 font-medium py-2.5">
                            {formData.guardian.street}, {formData.guardian.number}
                            {formData.guardian.complement ? ` - ${formData.guardian.complement}` : ''}
                            <br />
                            {formData.guardian.neighborhood} - {formData.guardian.city}/{formData.guardian.state}
                            <br />
                            CEP: {formData.guardian.zipCode}
                          </p>
                        )}
                      </div>

                      {/* Seção de Métodos de Pagamento */}
                      <div className="md:col-span-2 pt-8 border-t border-slate-100">
                        <div className="flex items-center gap-2 mb-6">
                          <div className="p-2 bg-amber-50 rounded-lg text-amber-600">
                            <CreditCard size={20} />
                          </div>
                          <div>
                            <h4 className="font-bold text-slate-900">Métodos de Pagamento</h4>
                            <p className="text-xs text-slate-500">Gerencie os cartões das suas assinaturas ativas.</p>
                          </div>
                        </div>

                        <div className="space-y-4">
                          {groupedDependents.flatMap(dep => dep.matriculasAtivas).filter(mat => mat.pagarme_subscription_id && !payments.some(p => p.matricula_id === mat.id && p.metodo_pagamento === 'pix')).length === 0 ? (
                            <div className="p-6 bg-slate-50 rounded-2xl border border-slate-200 text-center">
                              <p className="text-sm text-slate-400 italic">Nenhuma assinatura ativa com cartão de crédito encontrada.</p>
                            </div>
                          ) : (
                            groupedDependents.flatMap(dep => dep.matriculasAtivas).filter(mat => mat.pagarme_subscription_id && !payments.some(p => p.matricula_id === mat.id && p.metodo_pagamento === 'pix')).map((mat: any) => (
                              <div key={mat.id} className="flex flex-col md:flex-row md:items-center justify-between p-4 bg-white rounded-2xl border border-slate-200 shadow-sm gap-4">
                                <div className="flex items-center gap-4">
                                  <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600">
                                    <CreditCard size={20} />
                                  </div>
                                  <div>
                                    <p className="text-sm font-bold text-slate-900">{mat.turma}</p>
                                    <p className="text-[10px] text-slate-500 uppercase">{mat.unidade}</p>
                                  </div>
                                </div>
                                <button 
                                  onClick={() => {
                                    setSelectedEnrollmentForCard(mat.id);
                                    setIsUpdatingCard(true);
                                  }}
                                  className="px-4 py-2 bg-amber-600 text-white rounded-xl text-xs font-bold hover:bg-amber-700 transition-all flex items-center justify-center gap-2 shadow-md shadow-amber-100"
                                >
                                  <RefreshCw size={14} />
                                  Trocar Cartão
                                </button>
                              </div>
                            ))
                          )}
                        </div>
                      </div>

                      {isChangingPassword && (
                        <div className="md:col-span-2 p-6 bg-slate-50 rounded-2xl border border-slate-200 space-y-4">
                          <div className="flex items-center gap-2 text-slate-900 font-bold">
                            <Lock size={18} />
                            Alterar Senha
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <label className="text-xs font-bold text-slate-500 uppercase">Nova Senha</label>
                              <input 
                                type="password" 
                                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-all bg-white"
                                placeholder="Digite a nova senha"
                                value={formData.guardian.password}
                                onChange={e => setFormData({...formData, guardian: {...formData.guardian, password: e.target.value}})}
                              />
                            </div>
                            <div className="space-y-2">
                              <label className="text-xs font-bold text-slate-500 uppercase">Confirmar Nova Senha</label>
                              <input 
                                type="password" 
                                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-all bg-white"
                                placeholder="Repita a nova senha"
                              />
                            </div>
                          </div>
                        </div>
                      )}

                      {(isEditingProfile || isChangingPassword) && (
                        <div className="md:col-span-2 flex justify-end gap-3 pt-4">
                          <button 
                            onClick={() => {
                              setIsEditingProfile(false);
                              setIsChangingPassword(false);
                            }}
                            className="px-6 py-3 rounded-xl font-bold text-slate-600 hover:bg-slate-100 transition-all"
                          >
                            Cancelar
                          </button>
                          <button 
                            onClick={async () => {
                              setLoading(true);
                              try {
                                const addressJson = JSON.stringify({
                                  zipCode: formData.guardian.zipCode,
                                  street: formData.guardian.street,
                                  number: formData.guardian.number,
                                  complement: formData.guardian.complement,
                                  neighborhood: formData.guardian.neighborhood,
                                  city: formData.guardian.city,
                                  state: formData.guardian.state
                                });

                                const response = await fetch('/api/guardian/update', {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({
                                    cpf: formData.guardian.cpf,
                                    name: formData.guardian.name,
                                    email: formData.guardian.email,
                                    phone: formData.guardian.phone,
                                    address: addressJson,
                                    password: isChangingPassword ? formData.guardian.password : undefined
                                  })
                                });
                                if (response.ok) {
                                  alert('Perfil atualizado com sucesso!');
                                  setIsEditingProfile(false);
                                  setIsChangingPassword(false);
                                } else {
                                  alert('Erro ao atualizar perfil.');
                                }
                              } catch (error) {
                                console.error('Error updating profile:', error);
                                alert('Erro de conexão.');
                              } finally {
                                setLoading(false);
                              }
                            }}
                            disabled={loading}
                            className="bg-emerald-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200 flex items-center gap-2"
                          >
                            {loading ? <RefreshCw size={18} className="animate-spin" /> : <Save size={18} />}
                            Salvar Alterações
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          ) : (
            <div className="max-w-3xl mx-auto">
              {/* Progress Bar */}
              {['guardian', 'student', 'enrollment', 'payment'].includes(step) && (
                <div className="mb-12 px-4">
                  <div className="flex items-center justify-between relative">
                    {/* Background Line */}
                    <div className="absolute top-5 left-0 w-full h-1 bg-slate-100 -translate-y-1/2 z-0 rounded-full" />
                    
                    {/* Progress Line */}
                    <motion.div 
                      className="absolute top-5 left-0 h-1 bg-emerald-500 -translate-y-1/2 z-0 rounded-full"
                      initial={{ width: '0%' }}
                      animate={{ 
                        width: step === 'guardian' ? '0%' : 
                               step === 'student' ? '33.33%' : 
                               step === 'enrollment' ? '66.66%' : '100%' 
                      }}
                      transition={{ duration: 0.5, ease: "easeInOut" }}
                    />

                    {[
                      { id: 'guardian', label: 'Responsável', icon: User },
                      { id: 'student', label: 'Aluno', icon: GraduationCap },
                      { id: 'enrollment', label: 'Turma', icon: Clock },
                      { id: 'payment', label: 'Pagamento', icon: CreditCard },
                    ].map((s, idx) => {
                      const stepOrder = ['guardian', 'student', 'enrollment', 'payment'];
                      const currentIdx = stepOrder.indexOf(step);
                      const isCompleted = currentIdx > idx;
                      const isActive = step === s.id;
                      
                      return (
                        <div key={s.id} className="relative z-10 flex flex-col items-center gap-3">
                          <motion.div 
                            initial={false}
                            animate={{ 
                              backgroundColor: isCompleted || isActive ? '#10b981' : '#ffffff',
                              borderColor: isCompleted || isActive ? '#10b981' : '#e2e8f0',
                              color: isCompleted || isActive ? '#ffffff' : '#94a3b8',
                              scale: isActive ? 1.15 : 1,
                              boxShadow: isActive ? '0 10px 15px -3px rgba(16, 185, 129, 0.2)' : '0 0px 0px rgba(0,0,0,0)'
                            }}
                            className="w-10 h-10 rounded-full border-2 flex items-center justify-center transition-all"
                          >
                            {isCompleted ? <Check size={20} strokeWidth={3} /> : <s.icon size={18} />}
                          </motion.div>
                          <div className="flex flex-col items-center">
                            <span className={`text-[10px] font-black uppercase tracking-widest ${isActive ? 'text-emerald-600' : 'text-slate-400'}`}>
                              {s.label}
                            </span>
                            {isActive && (
                              <motion.div 
                                layoutId="activeStepDot"
                                className="w-1 h-1 bg-emerald-600 rounded-full mt-1"
                              />
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Modal Atualizar Cartão */}
          {isUpdatingCard && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden"
              >
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                  <h3 className="text-lg font-bold text-slate-900">Atualizar Cartão de Crédito</h3>
                  <button onClick={() => setIsUpdatingCard(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                    <X size={20} />
                  </button>
                </div>
                <form onSubmit={handleUpdateCard} className="p-8 space-y-6">
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-500 uppercase">Número do Cartão</label>
                      <input 
                        type="text" 
                        required
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                        placeholder="0000 0000 0000 0000"
                        value={newCardData.number}
                        onChange={e => setNewCardData({...newCardData, number: e.target.value})}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-500 uppercase">Nome no Cartão</label>
                      <input 
                        type="text" 
                        required
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                        placeholder="Como está no cartão"
                        value={newCardData.holder_name}
                        onChange={e => setNewCardData({...newCardData, holder_name: e.target.value})}
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-500 uppercase">Mês</label>
                        <input 
                          type="text" 
                          required
                          maxLength={2}
                          className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                          placeholder="MM"
                          value={newCardData.exp_month}
                          onChange={e => setNewCardData({...newCardData, exp_month: e.target.value})}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-500 uppercase">Ano</label>
                        <input 
                          type="text" 
                          required
                          maxLength={4}
                          className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                          placeholder="AAAA"
                          value={newCardData.exp_year}
                          onChange={e => setNewCardData({...newCardData, exp_year: e.target.value})}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-500 uppercase">CVV</label>
                        <input 
                          type="text" 
                          required
                          maxLength={4}
                          className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                          placeholder="123"
                          value={newCardData.cvv}
                          onChange={e => setNewCardData({...newCardData, cvv: e.target.value})}
                        />
                      </div>
                    </div>
                  </div>
                  <button 
                    type="submit"
                    disabled={loading}
                    className="w-full bg-emerald-600 text-white py-4 rounded-2xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200 flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {loading ? <RefreshCw className="animate-spin" size={20} /> : <Save size={20} />}
                    Salvar Novo Cartão
                  </button>
                </form>
              </motion.div>
            </div>
          )}

          <AnimatePresence mode="wait">
                {step === 'guardian' && (
                  <motion.div
                    key="guardian"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8"
                  >
                    {isAccessingPanel ? (
                      <>
                        <div className="flex items-center gap-3 mb-8">
                          <div className="p-3 bg-emerald-50 rounded-xl">
                            <ShieldCheck className="text-emerald-600" size={24} />
                          </div>
                          <div>
                            <h2 className="text-2xl font-semibold">Acesso ao Painel do Responsável</h2>
                            <p className="text-slate-500 text-sm">Acesse com seu CPF ou E-mail cadastrado.</p>
                          </div>
                        </div>

                        <div className="space-y-6">
                          <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-700">CPF ou E-mail</label>
                            <div className="relative">
                              <input 
                                type="text" 
                                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                                placeholder="000.000.000-00 ou seu@email.com"
                                value={loginIdentifier}
                                onChange={e => setLoginIdentifier(e.target.value)}
                                onKeyDown={e => {
                                  if (e.key === 'Enter' && !searchingGuardian && loginIdentifier) {
                                    handleAccess();
                                  }
                                }}
                              />
                              {searchingGuardian && (
                                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                  <RefreshCw size={16} className="animate-spin text-emerald-600" />
                                </div>
                              )}
                            </div>
                            {accessError && (
                              <p className="text-red-500 text-xs mt-1 flex items-center gap-1">
                                <AlertCircle size={12} /> {accessError}
                              </p>
                            )}
                          </div>

                          <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-700">Senha</label>
                            <div className="relative">
                              <input 
                                type="password" 
                                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                                placeholder="Sua senha de acesso"
                                value={loginPassword}
                                onChange={e => setLoginPassword(e.target.value)}
                                onKeyDown={e => {
                                  if (e.key === 'Enter' && !searchingGuardian && loginIdentifier && loginPassword) {
                                    handleAccess();
                                  }
                                }}
                              />
                            </div>
                            <div className="flex justify-end">
                              <button 
                                onClick={recoverLoginPassword}
                                disabled={recoveringPassword || !loginIdentifier}
                                className="text-emerald-700 text-xs font-bold hover:underline flex items-center gap-1 mt-1"
                              >
                                {recoveringPassword ? <RefreshCw size={10} className="animate-spin" /> : null}
                                Esqueci Minha Senha
                              </button>
                            </div>
                          </div>

                          <div className="flex flex-col gap-3">
                            <button 
                              onClick={handleAccess}
                              disabled={searchingGuardian || !loginIdentifier || !loginPassword}
                              className="w-full bg-emerald-600 text-white py-4 rounded-xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-600/20 disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                              {searchingGuardian ? <RefreshCw size={20} className="animate-spin" /> : <ChevronRight size={20} />}
                              Acessar Painel
                            </button>
                            
                            <div className="relative py-4">
                              <div className="absolute inset-0 flex items-center">
                                <div className="w-full border-t border-slate-100"></div>
                              </div>
                              <div className="relative flex justify-center text-xs uppercase">
                                <span className="bg-white px-2 text-slate-400 font-medium">Ou se você é novo aqui</span>
                              </div>
                            </div>

                            <button 
                              onClick={() => {
                                setIsAccessingPanel(false);
                                setLoginPassword('');
                                setAccessError(null);
                              }}
                              className="w-full bg-white text-slate-700 py-4 rounded-xl font-bold border border-slate-200 hover:bg-slate-50 transition-all flex items-center justify-center gap-2"
                            >
                              <Plus size={20} />
                              Novo Cadastro / Matrícula
                            </button>
                          </div>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex items-center justify-between mb-8">
                          <div className="flex items-center gap-3">
                            <div className="p-3 bg-emerald-50 rounded-xl">
                              <User className="text-emerald-600" size={24} />
                            </div>
                            <div>
                              <h2 className="text-2xl font-semibold">Dados do Responsável</h2>
                              <p className="text-slate-500 text-sm">Quem responderá financeiramente pela matrícula.</p>
                            </div>
                          </div>
                          <button 
                            onClick={() => {
                              setIsAccessingPanel(true);
                              setLoginPassword('');
                              setAccessError(null);
                            }}
                            className="text-slate-500 text-sm font-medium hover:text-slate-700 transition-colors"
                          >
                            Já tenho cadastro
                          </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-700">CPF</label>
                            <div className="relative">
                              <input 
                                type="text" 
                                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                                placeholder="000.000.000-00"
                                value={formData.guardian.cpf}
                                onChange={e => {
                                  const val = e.target.value;
                                  setFormData({...formData, guardian: {...formData.guardian, cpf: val}});
                                  if (val.replace(/\D/g, '').length === 11) {
                                    checkCPF(val);
                                  } else {
                                    setGuardianExists(null);
                                  }
                                }}
                              />
                              {searchingGuardian && (
                                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                  <RefreshCw size={16} className="animate-spin text-emerald-600" />
                                </div>
                              )}
                            </div>
                          </div>

                          {guardianExists === true && !formData.guardian.name && (
                            <motion.div 
                              initial={{ opacity: 0, y: -10 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="md:col-span-2 p-6 bg-emerald-50 border border-emerald-100 rounded-2xl space-y-4"
                            >
                              <div className="flex items-center gap-3 text-emerald-800">
                                <div className="p-2 bg-white rounded-lg shadow-sm">
                                  <ShieldCheck size={20} className="text-emerald-600" />
                                </div>
                                <div>
                                  <p className="font-bold text-sm">Cadastro Localizado!</p>
                                  <p className="text-xs opacity-80">Para sua segurança, confirme sua senha para realizar uma nova matrícula.</p>
                                </div>
                              </div>
                              
                              <div className="space-y-2">
                                <label className="text-xs font-bold text-emerald-700 uppercase tracking-wider">Senha de Acesso</label>
                                <div className="flex gap-2">
                                  <input 
                                    ref={passwordInputRef}
                                    type="password" 
                                    className="flex-1 px-4 py-3 rounded-xl border-2 border-emerald-200 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all bg-white"
                                    placeholder="Digite sua senha cadastrada"
                                    value={formData.guardian.password}
                                    onChange={e => setFormData({...formData, guardian: {...formData.guardian, password: e.target.value}})}
                                    onKeyDown={e => {
                                      if (e.key === 'Enter' && !verifyingPassword && formData.guardian.password) {
                                        verifyPassword();
                                      }
                                    }}
                                  />
                                  <button 
                                    onClick={verifyPassword}
                                    disabled={verifyingPassword || !formData.guardian.password}
                                    className="bg-emerald-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-600/20 disabled:opacity-50 flex items-center gap-2 whitespace-nowrap"
                                  >
                                    {verifyingPassword ? <RefreshCw size={18} className="animate-spin" /> : <ExternalLink size={18} />}
                                    Confirmar e Acessar
                                  </button>
                                </div>
                                <div className="flex justify-end">
                                  <button 
                                    onClick={recoverPassword}
                                    disabled={recoveringPassword}
                                    className="text-emerald-700 text-xs font-bold hover:underline flex items-center gap-1 mt-1"
                                  >
                                    {recoveringPassword ? <RefreshCw size={10} className="animate-spin" /> : null}
                                    Esqueci Minha Senha
                                  </button>
                                </div>
                              </div>
                            </motion.div>
                          )}

                          {(guardianExists === false || (guardianExists === true && formData.guardian.name)) && (
                            <>
                              <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-700">Nome Completo</label>
                                <input 
                                  type="text" 
                                  className={`w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-all ${guardianExists && !isEditingGuardian ? 'bg-slate-50 text-slate-500 cursor-not-allowed' : ''}`}
                                  placeholder="Ex: João Silva"
                                  value={formData.guardian.name}
                                  readOnly={guardianExists === true && !isEditingGuardian}
                                  onChange={e => setFormData({...formData, guardian: {...formData.guardian, name: e.target.value}})}
                                />
                              </div>
                              <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-700">E-mail</label>
                                <input 
                                  type="email" 
                                  className={`w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-all ${guardianExists && !isEditingGuardian ? 'bg-slate-50 text-slate-500 cursor-not-allowed' : ''}`}
                                  placeholder="joao@exemplo.com"
                                  value={formData.guardian.email}
                                  readOnly={guardianExists === true && !isEditingGuardian}
                                  onChange={e => setFormData({...formData, guardian: {...formData.guardian, email: e.target.value}})}
                                />
                              </div>
                              <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-700">Telefone</label>
                                <input 
                                  type="tel" 
                                  className={`w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-all ${guardianExists && !isEditingGuardian ? 'bg-slate-50 text-slate-500 cursor-not-allowed' : ''}`}
                                  placeholder="(11) 99999-9999"
                                  value={formData.guardian.phone}
                                  readOnly={guardianExists === true && !isEditingGuardian}
                                  onChange={e => setFormData({...formData, guardian: {...formData.guardian, phone: e.target.value}})}
                                />
                              </div>
                              <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-700">
                                  {guardianExists ? (isChangingPassword ? 'Nova Senha' : 'Senha') : 'Crie uma Senha'}
                                </label>
                                <input 
                                  type="password" 
                                  className={`w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-all ${guardianExists && !isChangingPassword ? 'bg-slate-50 text-slate-500 cursor-not-allowed' : ''}`}
                                  placeholder={guardianExists ? "********" : "Mínimo 6 caracteres"}
                                  value={isChangingPassword || !guardianExists ? formData.guardian.password : '********'}
                                  readOnly={guardianExists === true && !isChangingPassword}
                                  onChange={e => setFormData({...formData, guardian: {...formData.guardian, password: e.target.value}})}
                                />
                              </div>
                              <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                  <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                                    CEP
                                    {isFetchingAddress && <RefreshCw size={14} className="animate-spin text-emerald-500" />}
                                  </label>
                                  <input 
                                    type="text" 
                                    className={`w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-all ${guardianExists && !isEditingGuardian ? 'bg-slate-50 text-slate-500 cursor-not-allowed' : ''}`}
                                    placeholder="00000-000"
                                    value={formData.guardian.zipCode}
                                    readOnly={guardianExists === true && !isEditingGuardian}
                                    onChange={e => {
                                      const val = e.target.value.replace(/\D/g, '').substring(0, 8);
                                      const formatted = val.replace(/^(\d{5})(\d)/, '$1-$2');
                                      setFormData({...formData, guardian: {...formData.guardian, zipCode: formatted}});
                                      if (val.length === 8) fetchAddressByCep(val);
                                    }}
                                    onBlur={e => {
                                      const val = e.target.value.replace(/\D/g, '');
                                      if (val.length === 8) fetchAddressByCep(val);
                                    }}
                                  />
                                </div>
                                <div className="space-y-2">
                                  <label className="text-sm font-medium text-slate-700">Rua</label>
                                  <input 
                                    type="text" 
                                    className={`w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-all ${guardianExists && !isEditingGuardian ? 'bg-slate-50 text-slate-500 cursor-not-allowed' : ''}`}
                                    placeholder="Nome da rua"
                                    value={formData.guardian.street}
                                    readOnly={guardianExists === true && !isEditingGuardian}
                                    onChange={e => setFormData({...formData, guardian: {...formData.guardian, street: e.target.value}})}
                                  />
                                </div>
                                <div className="space-y-2">
                                  <label className="text-sm font-medium text-slate-700">Número</label>
                                  <input 
                                    type="text" 
                                    className={`w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-all ${guardianExists && !isEditingGuardian ? 'bg-slate-50 text-slate-500 cursor-not-allowed' : ''}`}
                                    placeholder="Número"
                                    value={formData.guardian.number}
                                    readOnly={guardianExists === true && !isEditingGuardian}
                                    onChange={e => setFormData({...formData, guardian: {...formData.guardian, number: e.target.value}})}
                                  />
                                </div>
                                <div className="space-y-2">
                                  <label className="text-sm font-medium text-slate-700">Complemento</label>
                                  <input 
                                    type="text" 
                                    className={`w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-all ${guardianExists && !isEditingGuardian ? 'bg-slate-50 text-slate-500 cursor-not-allowed' : ''}`}
                                    placeholder="Apto, Bloco (Opcional)"
                                    value={formData.guardian.complement}
                                    readOnly={guardianExists === true && !isEditingGuardian}
                                    onChange={e => setFormData({...formData, guardian: {...formData.guardian, complement: e.target.value}})}
                                  />
                                </div>
                                <div className="space-y-2">
                                  <label className="text-sm font-medium text-slate-700">Bairro</label>
                                  <input 
                                    type="text" 
                                    className={`w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-all ${guardianExists && !isEditingGuardian ? 'bg-slate-50 text-slate-500 cursor-not-allowed' : ''}`}
                                    placeholder="Bairro"
                                    value={formData.guardian.neighborhood}
                                    readOnly={guardianExists === true && !isEditingGuardian}
                                    onChange={e => setFormData({...formData, guardian: {...formData.guardian, neighborhood: e.target.value}})}
                                  />
                                </div>
                                <div className="space-y-2">
                                  <label className="text-sm font-medium text-slate-700">Cidade</label>
                                  <input 
                                    type="text" 
                                    className={`w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-all ${guardianExists && !isEditingGuardian ? 'bg-slate-50 text-slate-500 cursor-not-allowed' : ''}`}
                                    placeholder="Cidade"
                                    value={formData.guardian.city}
                                    readOnly={guardianExists === true && !isEditingGuardian}
                                    onChange={e => setFormData({...formData, guardian: {...formData.guardian, city: e.target.value}})}
                                  />
                                </div>
                                <div className="space-y-2">
                                  <label className="text-sm font-medium text-slate-700">Estado (UF)</label>
                                  <input 
                                    type="text" 
                                    className={`w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-all ${guardianExists && !isEditingGuardian ? 'bg-slate-50 text-slate-500 cursor-not-allowed' : ''}`}
                                    placeholder="SP"
                                    maxLength={2}
                                    value={formData.guardian.state}
                                    readOnly={guardianExists === true && !isEditingGuardian}
                                    onChange={e => setFormData({...formData, guardian: {...formData.guardian, state: e.target.value.toUpperCase()}})}
                                  />
                                </div>
                              </div>

                              {guardianExists && (
                                <div className="md:col-span-2 flex flex-wrap gap-3 mt-2">
                                  {!isEditingGuardian && !isChangingPassword ? (
                                    <>
                                      <button 
                                        onClick={() => setIsEditingGuardian(true)}
                                        className="text-emerald-600 text-sm font-bold hover:bg-emerald-50 px-4 py-2 rounded-lg border border-emerald-200 transition-all flex items-center gap-2"
                                      >
                                        <RefreshCw size={14} /> Atualizar Dados de Cadastro
                                      </button>
                                      <button 
                                        onClick={() => {
                                          setIsChangingPassword(true);
                                          setFormData(prev => ({...prev, guardian: {...prev.guardian, password: ''}}));
                                        }}
                                        className="text-slate-600 text-sm font-bold hover:bg-slate-50 px-4 py-2 rounded-lg border border-slate-200 transition-all flex items-center gap-2"
                                      >
                                        <ShieldCheck size={14} /> Alterar Senha
                                      </button>
                                    </>
                                  ) : (
                                    <>
                                      <button 
                                        onClick={updateGuardian}
                                        disabled={loading}
                                        className="bg-emerald-600 text-white text-sm font-bold px-6 py-2 rounded-lg hover:bg-emerald-700 transition-all flex items-center gap-2 shadow-lg shadow-emerald-600/20"
                                      >
                                        {loading ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
                                        Salvar Alterações
                                      </button>
                                      <button 
                                        onClick={() => {
                                          setIsEditingGuardian(false);
                                          setIsChangingPassword(false);
                                          refreshGuardianData(); // Revert changes
                                        }}
                                        className="text-slate-500 text-sm font-bold hover:bg-slate-100 px-4 py-2 rounded-lg transition-all"
                                      >
                                        Cancelar
                                      </button>
                                    </>
                                  )}
                                </div>
                              )}
                            </>
                          )}
                        </div>

                        <div className="mt-10 flex justify-between items-center">
                          <button 
                            onClick={resetGuardian}
                            className="text-slate-500 text-sm font-medium hover:text-slate-700 transition-colors flex items-center gap-1"
                          >
                            <RefreshCw size={14} /> Limpar CPF
                          </button>
                          <button 
                            onClick={handleNext}
                            disabled={loading}
                            className="bg-slate-900 text-white px-8 py-3 rounded-xl font-medium flex items-center gap-2 hover:bg-slate-800 transition-colors disabled:opacity-50"
                          >
                            {loading ? (
                              <RefreshCw size={18} className="animate-spin" />
                            ) : (
                              <>Próximo Passo <ChevronRight size={18} /></>
                            )}
                          </button>
                        </div>
                      </>
                    )}
                  </motion.div>
                )}

                {step === 'complete_profile' && (
                  <motion.div
                    key="complete_profile"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8"
                  >
                    <div className="flex items-center gap-3 mb-8">
                      <div className="p-3 bg-amber-50 rounded-xl">
                        <Info className="text-amber-600" size={24} />
                      </div>
                      <div>
                        <h2 className="text-2xl font-semibold">
                          {isFirstAccess ? 'Primeiro Acesso' : (isTemporaryCpf ? 'Atualize seu Cadastro' : 'Complete seu Cadastro')}
                        </h2>
                        <p className="text-slate-500 text-sm">
                          {isFirstAccess 
                            ? 'Bem-vindo! Para sua segurança, confirme seus dados e defina uma senha de acesso.'
                            : (isTemporaryCpf 
                                ? 'Identificamos um CPF provisório em seu cadastro. Por favor, informe seu CPF real e defina uma senha de acesso.' 
                                : 'Identificamos que faltam algumas informações importantes.')}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-slate-700">CPF</label>
                          <input 
                            type="text" 
                            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                            placeholder="000.000.000-00"
                            value={formData.guardian.cpf}
                            onChange={e => setFormData({...formData, guardian: {...formData.guardian, cpf: e.target.value}})}
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-slate-700">Defina uma Senha</label>
                          <input 
                            type="password" 
                            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                            placeholder="Mínimo 6 caracteres"
                            value={formData.guardian.password}
                            onChange={e => setFormData({...formData, guardian: {...formData.guardian, password: e.target.value}})}
                          />
                        </div>
                        
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                            CEP
                            {isFetchingAddress && <RefreshCw size={14} className="animate-spin text-emerald-500" />}
                          </label>
                          <input 
                            type="text" 
                            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                            placeholder="00000-000"
                            value={formData.guardian.zipCode}
                            onChange={e => {
                              const val = e.target.value.replace(/\D/g, '').substring(0, 8);
                              const formatted = val.replace(/^(\d{5})(\d)/, '$1-$2');
                              setFormData({...formData, guardian: {...formData.guardian, zipCode: formatted}});
                              if (val.length === 8) fetchAddressByCep(val);
                            }}
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-slate-700">Rua</label>
                          <input 
                            type="text" 
                            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                            placeholder="Nome da rua"
                            value={formData.guardian.street}
                            onChange={e => setFormData({...formData, guardian: {...formData.guardian, street: e.target.value}})}
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-slate-700">Número</label>
                          <input 
                            type="text" 
                            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                            placeholder="Número"
                            value={formData.guardian.number}
                            onChange={e => setFormData({...formData, guardian: {...formData.guardian, number: e.target.value}})}
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-slate-700">Bairro</label>
                          <input 
                            type="text" 
                            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                            placeholder="Bairro"
                            value={formData.guardian.neighborhood}
                            onChange={e => setFormData({...formData, guardian: {...formData.guardian, neighborhood: e.target.value}})}
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-slate-700">Cidade</label>
                          <input 
                            type="text" 
                            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                            placeholder="Cidade"
                            value={formData.guardian.city}
                            onChange={e => setFormData({...formData, guardian: {...formData.guardian, city: e.target.value}})}
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-slate-700">Estado (UF)</label>
                          <input 
                            type="text" 
                            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                            placeholder="SP"
                            maxLength={2}
                            value={formData.guardian.state}
                            onChange={e => setFormData({...formData, guardian: {...formData.guardian, state: e.target.value.toUpperCase()}})}
                          />
                        </div>
                      </div>

                      <div className="flex gap-4">
                        <button 
                          onClick={() => setStep('guardian')}
                          className="flex-1 bg-slate-100 text-slate-700 py-4 rounded-xl font-bold hover:bg-slate-200 transition-all"
                        >
                          Voltar
                        </button>
                        <button 
                          onClick={handleCompleteProfile}
                          disabled={isCompletingProfile}
                          className="flex-[2] bg-emerald-600 text-white py-4 rounded-xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-600/20 disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                          {isCompletingProfile ? <RefreshCw size={20} className="animate-spin" /> : <Save size={20} />}
                          Salvar e Acessar Portal
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}

                {step === 'student' && (
                  <motion.div
                    key="student"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8"
                  >
                    <div className="flex items-center gap-3 mb-8">
                      <div className="p-3 bg-blue-50 rounded-xl">
                        <GraduationCap className="text-blue-600" size={24} />
                      </div>
                      <div>
                        <h2 className="text-2xl font-semibold">Dados do Aluno</h2>
                        <p className="text-slate-500 text-sm">Informações sobre o estudante dependente.</p>
                      </div>
                    </div>

                    {groupedDependents.length > 0 && (
                      <div className="mb-8 p-4 bg-slate-50 rounded-xl border border-slate-200">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 block">Dependentes já cadastrados</label>
                        <div className="grid grid-cols-1 gap-4">
                          {groupedDependents.map((dep, idx) => (
                            <div key={idx} className="space-y-2">
                              <button
                                onClick={() => {
                                  setFormData({
                                    ...formData,
                                    student: {
                                      ...formData.student,
                                      name: dep.nome_completo || '',
                                      birthDate: dep.data_nascimento || '',
                                      grade: dep.serie_ano || '',
                                      turmaEscolar: dep.turma_escolar || '',
                                      responsavel1: dep.responsavel_1 || '',
                                      whatsapp1: dep.whatsapp_1 || '',
                                      responsavel2: dep.responsavel_2 || '',
                                      whatsapp2: dep.whatsapp_2 || '',
                                      unidade: '',
                                      turmaComplementar: ''
                                    }
                                  });
                                  setTransferringEnrollmentId(null);
                                }}
                                className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-all text-left ${
                                  formData.student.name === dep.nome_completo 
                                    ? 'bg-blue-50 border-blue-200 ring-2 ring-blue-500/20' 
                                    : 'bg-white border-slate-200 hover:border-blue-300'
                                }`}
                              >
                                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-xs">
                                  {dep.nome_completo?.charAt(0)}
                                </div>
                                <div className="flex-1 overflow-hidden">
                                  <p className="text-sm font-semibold text-slate-900 truncate">{dep.nome_completo}</p>
                                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                                    <p className="text-[10px] text-slate-500 uppercase">{dep.serie_ano?.replace('_', ' ')}</p>
                                    {dep.turma_escolar && (
                                      <>
                                        <span className="text-[10px] text-slate-300">•</span>
                                        <p className="text-[10px] text-slate-500 uppercase">Turma: {dep.turma_escolar}</p>
                                      </>
                                    )}
                                    {dep.data_nascimento && (
                                      <>
                                        <span className="text-[10px] text-slate-300">•</span>
                                        <p className="text-[10px] text-slate-500 uppercase">
                                          {(() => {
                                            try {
                                              const [y, m, d] = dep.data_nascimento.split('T')[0].split('-');
                                              return `${d}/${m}/${y.slice(-2)}`;
                                            } catch (e) {
                                              return dep.data_nascimento;
                                            }
                                          })()}
                                        </p>
                                      </>
                                    )}
                                  </div>
                                </div>
                              </button>

                              {formData.student.name === dep.nome_completo && (dep.matriculasAtivas.length > 0 || dep.historico.length > 0) && (
                                <div className="ml-11 space-y-4 mt-2">
                                  {/* Matrículas Ativas */}
                                  {dep.matriculasAtivas.length > 0 && (
                                    <div className="space-y-2">
                                      <p className="text-[10px] font-bold text-slate-400 uppercase">Matrículas Ativas</p>
                                      {dep.matriculasAtivas.map((mat: any) => (
                                        <div key={mat.id} className="flex items-center justify-between p-3 bg-white rounded-lg border border-slate-100 shadow-sm">
                                          <div className="flex flex-col flex-1">
                                            <div className="flex items-center gap-2">
                                              <span className="text-xs font-bold text-slate-700">{mat.turma}</span>
                                              <span className="text-[9px] px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded font-medium uppercase">{mat.unidade}</span>
                                            </div>
                                            <div className="flex items-center gap-3 mt-1">
                                              {mat.horario && (
                                                <span className="text-[10px] text-slate-500 flex items-center gap-1">
                                                  <Clock size={10} /> {mat.horario}
                                                </span>
                                              )}
                                              {mat.data_matricula && (
                                                <span className="text-[10px] text-slate-400 flex items-center gap-1">
                                                  <Calendar size={10} /> {(() => {
                                                    const [y, m, d] = mat.data_matricula.split('T')[0].split('-');
                                                    return `${d}/${m}/${y.slice(-2)}`;
                                                  })()}
                                                </span>
                                              )}
                                            </div>
                                          </div>
                                          {(mat.status !== 'cancelado' && mat.status !== 'transferido') && (
                                            <div className="flex gap-2 ml-4">
                                              <button 
                                                onClick={() => {
                                                  setFormData({
                                                    ...formData,
                                                    student: {
                                                      ...formData.student,
                                                      name: dep.nome_completo || '',
                                                      birthDate: dep.data_nascimento || '',
                                                      grade: dep.serie_ano || '',
                                                      turmaEscolar: dep.turma_escolar || '',
                                                      responsavel1: dep.responsavel_1 || '',
                                                      whatsapp1: dep.whatsapp_1 || '',
                                                      responsavel2: dep.responsavel_2 || '',
                                                      whatsapp2: dep.whatsapp_2 || '',
                                                      unidade: mat.unidade,
                                                      turmaComplementar: mat.turma
                                                    }
                                                  });
                                                  setTransferringEnrollmentId(mat.id);
                                                  setStep('enrollment');
                                                }}
                                                className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                title="Transferir Turma"
                                              >
                                                <RefreshCw size={14} />
                                              </button>
                                              <button 
                                                onClick={() => handleCancelEnrollment(mat.id)}
                                                className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                title="Cancelar Matrícula"
                                              >
                                                <Trash2 size={14} />
                                              </button>
                                            </div>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  )}

                                  {/* Histórico de Matrículas */}
                                  {dep.historico.length > 0 && (
                                    <div className="space-y-2">
                                      <p className="text-[10px] font-bold text-slate-400 uppercase">Histórico de Matrículas</p>
                                      {dep.historico.map((mat: any) => (
                                        <div key={mat.id} className="flex items-center justify-between p-3 bg-slate-50/50 rounded-lg border border-slate-100 opacity-75">
                                          <div className="flex flex-col flex-1">
                                            <div className="flex items-center gap-2">
                                              <span className="text-xs font-bold text-slate-500 line-through">{mat.turma}</span>
                                              <span className="text-[9px] px-1.5 py-0.5 bg-slate-100 text-slate-400 rounded font-medium uppercase">{mat.unidade}</span>
                                            </div>
                                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
                                              {mat.horario && (
                                                <span className="text-[10px] text-slate-400 flex items-center gap-1">
                                                  <Clock size={10} /> {mat.horario}
                                                </span>
                                              )}
                                              {mat.data_matricula && (
                                                <span className="text-[10px] text-slate-400 flex items-center gap-1">
                                                  <Calendar size={10} /> Início: {(() => {
                                                    const [y, m, d] = mat.data_matricula.split('T')[0].split('-');
                                                    return `${d}/${m}/${y.slice(-2)}`;
                                                  })()}
                                                </span>
                                              )}
                                              {mat.data_cancelamento && (
                                                <span className={`text-[10px] ${mat.status === 'transferido' ? 'text-blue-400' : 'text-red-400'} font-medium flex items-center gap-1`}>
                                                  {mat.status === 'transferido' ? <RefreshCw size={10} /> : <XCircle size={10} />}
                                                  {mat.status === 'transferido' ? 'Transferido' : 'Cancelado'}: {(() => {
                                                    const [y, m, d] = mat.data_cancelamento.split('T')[0].split('-');
                                                    return `${d}/${m}/${y.slice(-2)}`;
                                                  })()}
                                                </span>
                                              )}
                                            </div>
                                            {mat.justificativa_cancelamento && (
                                              <div className="mt-2 text-xs text-slate-500 bg-slate-50 p-2 rounded border border-slate-100 italic">
                                                <strong>Motivo:</strong> {mat.justificativa_cancelamento}
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          ))}
                          <button
                            onClick={() => {
                              setFormData({
                                ...formData,
                                student: {
                                  name: '', 
                                  birthDate: '', 
                                  grade: '',
                                  turmaEscolar: '',
                                  responsavel1: '',
                                  whatsapp1: '',
                                  responsavel2: '',
                                  whatsapp2: '',
                                  unidade: '',
                                  turmaComplementar: ''
                                }
                              });
                              setTransferringEnrollmentId(null);
                            }}
                            className={`flex items-center gap-3 p-3 rounded-lg border border-dashed transition-all text-left ${
                              formData.student.name === '' 
                                ? 'bg-emerald-50 border-emerald-300 ring-2 ring-emerald-500/20' 
                                : 'bg-white border-slate-300 hover:border-emerald-300'
                            }`}
                          >
                            <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
                              <Plus size={16} />
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-slate-900">Novo Dependente</p>
                              <p className="text-[10px] text-slate-500 uppercase">Cadastrar outro</p>
                            </div>
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="md:col-span-2 space-y-2">
                        <label className="text-sm font-medium text-slate-700">Nome do Aluno <span className="text-red-500">*</span></label>
                        <input 
                          type="text" 
                          className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                          placeholder="Nome completo do estudante"
                          value={formData.student.name}
                          onChange={e => setFormData({...formData, student: {...formData.student, name: e.target.value}})}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700">Data de Nascimento <span className="text-red-500">*</span></label>
                        <input 
                          type="date" 
                          className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                          value={formData.student.birthDate}
                          onChange={e => setFormData({...formData, student: {...formData.student, birthDate: e.target.value}})}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700">Série / Ano <span className="text-red-500">*</span></label>
                        <select 
                          className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                          value={formData.student.grade}
                          onChange={e => setFormData({...formData, student: {...formData.student, grade: e.target.value}})}
                        >
                          <option value="">Selecione...</option>
                          {options.series.map(s => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700">Turma Escolar <span className="text-red-500">*</span></label>
                        <select 
                          className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                          value={formData.student.turmaEscolar}
                          onChange={e => setFormData({...formData, student: {...formData.student, turmaEscolar: e.target.value}})}
                        >
                          <option value="">Selecione...</option>
                          {['A', 'B', 'C', 'D', 'E', 'F', 'Não Sei'].map(t => (
                            <option key={t} value={t}>{t}</option>
                          ))}
                        </select>
                      </div>

                      <div className="border-t border-slate-100 md:col-span-2 my-2 pt-4">
                        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Contatos Adicionais (Obrigatórios)</h3>
                      </div>

                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <label className="text-sm font-medium text-slate-700">Responsável 1 <span className="text-red-500">*</span></label>
                          <button 
                            type="button"
                            onClick={() => setFormData({
                              ...formData,
                              student: {
                                ...formData.student,
                                responsavel1: formData.guardian.name,
                                whatsapp1: formData.guardian.phone
                              }
                            })}
                            className="text-[10px] font-bold text-blue-600 hover:text-blue-700 uppercase tracking-wider flex items-center gap-1 transition-colors"
                          >
                            <User size={10} /> Copiar dados do Responsável
                          </button>
                        </div>
                        <input 
                          type="text" 
                          className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                          placeholder="Nome do contato"
                          value={formData.student.responsavel1}
                          onChange={e => setFormData({...formData, student: {...formData.student, responsavel1: e.target.value}})}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700">WhatsApp 1 <span className="text-red-500">*</span></label>
                        <input 
                          type="tel" 
                          className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                          placeholder="(00) 00000-0000"
                          value={formData.student.whatsapp1}
                          onChange={e => setFormData({...formData, student: {...formData.student, whatsapp1: e.target.value}})}
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700">Responsável 2 <span className="text-red-500">*</span></label>
                        <input 
                          type="text" 
                          className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                          placeholder="Nome do contato"
                          value={formData.student.responsavel2}
                          onChange={e => setFormData({...formData, student: {...formData.student, responsavel2: e.target.value}})}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700">WhatsApp 2 <span className="text-red-500">*</span></label>
                        <input 
                          type="tel" 
                          className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                          placeholder="(00) 00000-0000"
                          value={formData.student.whatsapp2}
                          onChange={e => setFormData({...formData, student: {...formData.student, whatsapp2: e.target.value}})}
                        />
                      </div>
                    </div>

                    <div className="mt-10 flex justify-between">
                      <button 
                        onClick={handleBack}
                        className="text-slate-600 px-6 py-3 rounded-xl font-medium flex items-center gap-2 hover:bg-slate-50 transition-colors"
                      >
                        <ChevronLeft size={18} /> Voltar
                      </button>
                      <button 
                        onClick={handleNext}
                        className="bg-blue-600 text-white px-8 py-3 rounded-xl font-medium flex items-center gap-2 hover:bg-blue-700 transition-colors"
                      >
                        Próximo Passo <ChevronRight size={18} />
                      </button>
                    </div>
                  </motion.div>
                )}

                {step === 'enrollment' && (
                  <motion.div
                    key="enrollment"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8"
                  >
                    <div className="flex items-center gap-3 mb-8">
                      <div className="p-3 bg-emerald-50 rounded-xl">
                        {transferringEnrollmentId ? <RefreshCw className="text-blue-600" size={24} /> : <Plus className="text-emerald-600" size={24} />}
                      </div>
                      <div>
                        <h2 className="text-2xl font-semibold">{transferringEnrollmentId ? 'Transferência' : 'Matrícula'}</h2>
                        <p className="text-slate-500 text-sm">{transferringEnrollmentId ? 'Selecione a nova turma para transferência.' : 'Selecione a unidade e a turma complementar.'}</p>
                      </div>
                    </div>

                    {transferringEnrollmentId && (
                      <div className="md:col-span-2 p-4 bg-blue-50 border border-blue-200 rounded-xl mb-6">
                        <p className="text-sm text-blue-800 font-medium flex items-center gap-2">
                          <RefreshCw size={16} />
                          Você está transferindo a matrícula de <strong>{formData.student.name}</strong> para uma nova turma.
                        </p>
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700">Unidade de Atendimento</label>
                        <select 
                          className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                          value={formData.student.unidade}
                          onChange={e => setFormData({
                            ...formData, 
                            student: {
                              ...formData.student, 
                              unidade: e.target.value,
                              turmaComplementar: '' // Reset turma when unit changes
                            }
                          })}
                        >
                          <option value="">Selecione a Unidade...</option>
                          {options.unidades.map(u => (
                            <option key={u} value={u}>{u}</option>
                          ))}
                        </select>
                      </div>

                      <div className="md:col-span-2 space-y-2">
                        <label className="text-sm font-medium text-slate-700">Turma (Atividade Complementar)</label>
                        <select 
                          className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                          value={formData.student.turmaComplementar}
                          onChange={e => setFormData({...formData, student: {...formData.student, turmaComplementar: e.target.value}})}
                          disabled={!formData.student.unidade || !formData.student.grade}
                        >
                          <option value="">
                            {!formData.student.unidade || !formData.student.grade 
                              ? 'Selecione primeiro a Unidade e a Série' 
                              : 'Selecione a Turma...'}
                          </option>
                          {filteredTurmas.map(t => {
                              const isFull = t.capacidade && (t.ocupacao_atual || 0) >= t.capacidade;
                              return (
                                <option key={t.id || t.nome} value={t.nome}>
                                  {t.nome} - {t.dias_horarios} (R$ {t.valor_mensalidade?.toFixed(2)}) {isFull ? '[LISTA DE ESPERA]' : `(${t.capacidade ? t.capacidade - (t.ocupacao_atual || 0) : '?'} vagas)`}
                                </option>
                              );
                            })
                          }
                        </select>
                        {formData.student.turmaComplementar && (
                          <motion.div 
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="mt-2 p-4 bg-emerald-50 rounded-xl border border-emerald-100 text-sm space-y-1"
                          >
                            {options.turmas.filter(t => t.nome === formData.student.turmaComplementar).map(t => (
                              <React.Fragment key={t.id || t.nome}>
                                <div className="flex justify-between">
                                  <span className="text-emerald-700 font-bold">Horários:</span>
                                  <span className="text-emerald-900">{t.dias_horarios}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-emerald-700 font-bold">Local:</span>
                                  <span className="text-emerald-900">{t.local_aula}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-emerald-700 font-bold">Início:</span>
                                  <span className="text-emerald-900">{t.data_inicio ? new Date(t.data_inicio).toLocaleDateString() : 'A definir'}</span>
                                </div>
                                <div className="flex justify-between pt-1 border-t border-emerald-200 mt-1">
                                  <span className="text-emerald-700 font-bold">Vagas:</span>
                                  <span className={t.capacidade && (t.ocupacao_atual || 0) >= t.capacidade ? "text-amber-600 font-bold" : "text-emerald-900"}>
                                    {t.capacidade ? `${t.ocupacao_atual || 0} / ${t.capacidade}` : 'Não definida'}
                                    {t.capacidade && (t.ocupacao_atual || 0) >= t.capacidade && " (Lotada - Lista de Espera)"}
                                  </span>
                                </div>
                                <div className="flex justify-between pt-1 border-t border-emerald-200 mt-1">
                                  <span className="text-emerald-700 font-bold">Mensalidade:</span>
                                  <div className="text-right">
                                    <span className={`text-emerald-900 font-bold ${hasFidelityDiscount ? 'line-through text-xs opacity-50 block' : ''}`}>
                                      R$ {t.valor_mensalidade?.toFixed(2)}
                                    </span>
                                    {hasFidelityDiscount && (
                                      <span className="text-emerald-900 font-bold block">
                                        R$ {(t.valor_mensalidade! * 0.9).toFixed(2)}
                                        <span className="text-[10px] ml-1 text-emerald-600 uppercase">Fidelidade</span>
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </React.Fragment>
                            ))}
                          </motion.div>
                        )}

                        {formData.student.turmaComplementar && (
                          <div className="mt-4 flex flex-col sm:flex-row items-center gap-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
                            <button 
                              onClick={() => setAcceptedTerms(!acceptedTerms)}
                              className={`px-6 py-2 rounded-lg font-bold transition-all flex items-center gap-2 ${acceptedTerms ? 'bg-emerald-600 text-white' : 'bg-white text-slate-600 border border-slate-300 hover:bg-slate-50'}`}
                            >
                              {acceptedTerms ? <Check size={18} /> : null}
                              {acceptedTerms ? 'Termos Aceitos' : 'Confirmar Aceite dos Termos'}
                            </button>
                            <button 
                              onClick={() => setShowTermsModal(true)}
                              className="text-sm text-emerald-600 font-bold underline hover:text-emerald-700"
                            >
                              Visualizar Termos e Condições
                            </button>
                          </div>
                        )}

                        {formData.student.unidade && formData.student.grade && filteredTurmas.length === 0 && (
                          <p className="text-xs text-amber-600 font-medium">Nenhuma turma disponível para esta unidade, série ou idade.</p>
                        )}
                      </div>
                    </div>

                    <div className="mt-10 flex justify-between">
                      <button 
                        onClick={handleBack}
                        className="text-slate-600 px-6 py-3 rounded-xl font-medium flex items-center gap-2 hover:bg-slate-50 transition-colors"
                      >
                        <ChevronLeft size={18} /> Voltar
                      </button>
                      {(() => {
                        const selectedTurma = options.turmas.find(t => t.nome === formData.student.turmaComplementar);
                        const isFull = selectedTurma && selectedTurma.capacidade && (selectedTurma.ocupacao_atual || 0) >= selectedTurma.capacidade;
                        
                        return (
                          <button 
                            onClick={handleNext}
                            disabled={!acceptedTerms}
                            className={`${isFull ? 'bg-orange-600 hover:bg-orange-700' : 'bg-slate-900 hover:bg-slate-800'} text-white px-8 py-3 rounded-xl font-medium flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed`}
                          >
                            {isFull ? 'Entrar na Lista de Espera' : 'Próximo Passo'} <ChevronRight size={18} />
                          </button>
                        );
                      })()}
                    </div>
                  </motion.div>
                )}

                {step === 'payment' && (
                  <motion.div
                    key="payment"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8"
                  >
                    <div className="flex items-center gap-3 mb-8">
                      <div className="p-3 bg-purple-50 rounded-xl">
                        <CreditCard className="text-purple-600" size={24} />
                      </div>
                      <div>
                        <h2 
                          className="text-2xl font-semibold cursor-default select-none"
                          onClick={handlePixSecretClick}
                        >
                          Método de Pagamento
                        </h2>
                        <p className="text-slate-500 text-sm">Cobrança automática mensal no cartão de crédito.</p>
                      </div>
                    </div>

                    {showPixOption && (
                      <div className="space-y-4 mb-6">
                        <label 
                          className={`flex items-center gap-4 p-5 rounded-2xl border-2 cursor-pointer transition-all ${
                            formData.paymentMethod === 'credit_card' 
                              ? 'border-purple-600 bg-purple-50/50' 
                              : 'border-slate-100 hover:border-slate-200'
                          }`}
                        >
                          <input 
                            type="radio" 
                            name="payment" 
                            className="hidden"
                            checked={formData.paymentMethod === 'credit_card'}
                            onChange={() => setFormData({...formData, paymentMethod: 'credit_card'})}
                          />
                          <div className="p-2 bg-white rounded-lg shadow-sm">
                            <CreditCard className="text-purple-600" size={20} />
                          </div>
                          <div className="flex-1">
                            <p className="font-semibold">Cartão de Crédito (Recorrente)</p>
                            <p className="text-xs text-slate-500">Cobrança automática mensal sem ocupar o limite total.</p>
                          </div>
                        </label>

                        <label 
                          className={`flex items-center gap-4 p-5 rounded-2xl border-2 cursor-pointer transition-all ${
                            formData.paymentMethod === 'pix' 
                              ? 'border-emerald-600 bg-emerald-50/50' 
                              : 'border-slate-100 hover:border-slate-200'
                          }`}
                        >
                          <input 
                            type="radio" 
                            name="payment" 
                            className="hidden"
                            checked={formData.paymentMethod === 'pix'}
                            onChange={() => setFormData({...formData, paymentMethod: 'pix'})}
                          />
                          <div className="p-2 bg-white rounded-lg shadow-sm">
                            <QrCode className="text-emerald-600" size={20} />
                          </div>
                          <div className="flex-1">
                            <p className="font-semibold">PIX (Mensal)</p>
                            <p className="text-xs text-slate-500">Você receberá o QR Code mensalmente por e-mail e WhatsApp.</p>
                          </div>
                        </label>
                      </div>
                    )}

                    {formData.paymentMethod === 'credit_card' && (
                      <div className="mt-6 p-6 bg-slate-50 rounded-2xl border border-slate-200 space-y-4">
                        <h3 className="font-semibold text-slate-800 mb-4">Dados do Cartão</h3>
                        
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">Número do Cartão</label>
                          <input 
                            type="text" 
                            className="w-full p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                            placeholder="0000 0000 0000 0000"
                            value={formData.card.number}
                            onChange={e => {
                              const val = e.target.value.replace(/\D/g, '').substring(0, 16);
                              const formatted = val.replace(/(\d{4})(?=\d)/g, '$1 ').trim();
                              setFormData({...formData, card: {...formData.card, number: formatted}});
                            }}
                          />
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">Nome Impresso no Cartão</label>
                          <input 
                            type="text" 
                            className="w-full p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 uppercase"
                            placeholder="NOME COMO ESTÁ NO CARTÃO"
                            value={formData.card.holderName}
                            onChange={e => setFormData({...formData, card: {...formData.card, holderName: e.target.value.toUpperCase()}})}
                          />
                        </div>
                        
                        <div className="grid grid-cols-3 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Mês (MM)</label>
                            <input 
                              type="text" 
                              className="w-full p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                              placeholder="MM"
                              value={formData.card.expMonth}
                              onChange={e => {
                                const val = e.target.value.replace(/\D/g, '').substring(0, 2);
                                setFormData({...formData, card: {...formData.card, expMonth: val}});
                              }}
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Ano (AA ou AAAA)</label>
                            <input 
                              type="text" 
                              className="w-full p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                              placeholder="AA"
                              value={formData.card.expYear}
                              onChange={e => {
                                const val = e.target.value.replace(/\D/g, '').substring(0, 4);
                                setFormData({...formData, card: {...formData.card, expYear: val}});
                              }}
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">CVV</label>
                            <input 
                              type="text" 
                              className="w-full p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                              placeholder="123"
                              value={formData.card.cvv}
                              onChange={e => {
                                const val = e.target.value.replace(/\D/g, '').substring(0, 4);
                                setFormData({...formData, card: {...formData.card, cvv: val}});
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="mt-8 space-y-4">
                      <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-700">Cupom de Desconto</label>
                        <div className="flex gap-2">
                          <input 
                            type="text" 
                            placeholder="Insira seu cupom"
                            value={couponCode}
                            onChange={e => setCouponCode(e.target.value.toUpperCase())}
                            className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all uppercase"
                          />
                          <button 
                            type="button"
                            onClick={validateCoupon}
                            className="px-6 py-3 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition-all"
                          >
                            Aplicar
                          </button>
                        </div>
                        {couponError && <p className="text-xs text-red-500 font-medium">{couponError}</p>}
                        {appliedCoupon && (
                          <div className="flex items-center justify-between bg-blue-50 p-3 rounded-xl border border-blue-100">
                            <div className="flex items-center gap-2">
                              <Tag size={14} className="text-blue-600" />
                              <span className="text-sm font-bold text-blue-700">{appliedCoupon.codigo}</span>
                              <span className="text-xs text-blue-500">({appliedCoupon.tipo === 'fixo' ? `R$ ${appliedCoupon.valor}` : `${appliedCoupon.valor}%`})</span>
                            </div>
                            <button 
                              onClick={() => { setAppliedCoupon(null); setCouponCode(''); }}
                              className="text-blue-400 hover:text-blue-600"
                            >
                              <X size={16} />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="mt-8 p-6 bg-slate-50 rounded-2xl border border-slate-200">
                      {options.turmas.filter(t => t.nome === formData.student.turmaComplementar).map(t => {
                        const originalPrice = t.valor_mensalidade || 0;
                        let couponDiscount = 0;
                        if (appliedCoupon) {
                          if (appliedCoupon.tipo === 'fixo') {
                            couponDiscount = appliedCoupon.valor;
                          } else {
                            couponDiscount = (originalPrice * appliedCoupon.valor) / 100;
                          }
                        }
                        
                        const priceAfterCoupon = Math.max(0, originalPrice - couponDiscount);
                        const fidelityDiscount = hasFidelityDiscount ? (priceAfterCoupon * 0.10) : 0;
                        const finalPrice = Math.max(0, priceAfterCoupon - fidelityDiscount);

                        return (
                          <React.Fragment key={t.id || t.nome}>
                            <div className="space-y-3 mb-4">
                              <div className="flex justify-between text-sm">
                                <span className="text-slate-500">Matrícula + 1ª Mensalidade ({t.nome})</span>
                                <span className="font-semibold">R$ {originalPrice.toFixed(2)}</span>
                              </div>
                              {appliedCoupon && (
                                <div className="flex justify-between text-sm text-blue-600 font-medium">
                                  <span>Desconto Cupom ({appliedCoupon.codigo})</span>
                                  <span>- R$ {couponDiscount.toFixed(2)}</span>
                                </div>
                              )}
                              {hasFidelityDiscount && (
                                <div className="flex justify-between text-sm text-emerald-600 font-medium">
                                  <span className="flex items-center gap-1">
                                    Desconto Fidelidade (10%) <Star size={14} fill="currentColor" />
                                  </span>
                                  <span>- R$ {fidelityDiscount.toFixed(2)}</span>
                                </div>
                              )}
                            </div>
                            <div className="pt-4 border-t border-slate-200 flex justify-between items-center">
                              <div>
                                <p className="text-lg font-bold text-slate-900">Total Hoje</p>
                                <div className="flex flex-col gap-1">
                                  {appliedCoupon && appliedCoupon.aplicar_em === 'todas_parcelas' && (
                                    <p className="text-[10px] text-blue-500 uppercase font-bold">Desconto cupom em todas as parcelas</p>
                                  )}
                                  {hasFidelityDiscount && (
                                    <p className="text-[10px] text-emerald-600 uppercase font-bold">Desconto fidelidade em todas as parcelas</p>
                                  )}
                                </div>
                              </div>
                              <span className="text-2xl font-bold text-emerald-600">R$ {finalPrice.toFixed(2)}</span>
                            </div>
                          </React.Fragment>
                        );
                      })}
                      {!formData.student.turmaComplementar && (
                        <div className="text-center text-slate-400 py-2 italic text-sm">
                          Nenhuma turma selecionada. Volte e selecione uma turma.
                        </div>
                      )}
                    </div>

                    <div className="mt-10 flex justify-between">
                      <button 
                        onClick={handleBack}
                        className="text-slate-600 px-6 py-3 rounded-xl font-medium flex items-center gap-2 hover:bg-slate-50 transition-colors"
                      >
                        <ChevronLeft size={18} /> Voltar
                      </button>
                      <button 
                        onClick={handleSubmit}
                        disabled={loading}
                        className={`${
                          options.turmas.find(t => t.nome === formData.student.turmaComplementar)?.capacidade && 
                          (options.turmas.find(t => t.nome === formData.student.turmaComplementar)?.ocupacao_atual || 0) >= 
                          (options.turmas.find(t => t.nome === formData.student.turmaComplementar)?.capacidade || 0)
                            ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-200'
                            : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200'
                        } text-white px-10 py-3 rounded-xl font-bold flex items-center gap-2 transition-all shadow-lg disabled:opacity-50`}
                      >
                        {loading ? 'Processando...' : (
                          options.turmas.find(t => t.nome === formData.student.turmaComplementar)?.capacidade && 
                          (options.turmas.find(t => t.nome === formData.student.turmaComplementar)?.ocupacao_atual || 0) >= 
                          (options.turmas.find(t => t.nome === formData.student.turmaComplementar)?.capacidade || 0)
                            ? 'Entrar na Lista de Espera'
                            : 'Finalizar Matrícula'
                        )}
                      </button>
                    </div>
                  </motion.div>
                )}

                {step === 'waitlist_success' && (
                  <motion.div
                    key="waitlist_success"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-white rounded-3xl shadow-xl border border-slate-200 p-12 text-center"
                  >
                    <div className="w-20 h-20 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-6">
                      <Clock size={40} />
                    </div>
                    <h2 className="text-3xl font-bold text-slate-900 mb-4">Lista de Espera Confirmada!</h2>
                    {waitlistPosition && (
                      <div className="mb-6 inline-flex items-center gap-2 px-4 py-2 bg-amber-50 border border-amber-100 rounded-full text-amber-700 font-bold text-sm">
                        <Users size={16} />
                        Sua posição na fila: {waitlistPosition}º
                      </div>
                    )}
                    <p className="text-slate-600 mb-8 max-w-md mx-auto">
                      A turma selecionada está lotada no momento. Registramos seu interesse na lista de espera e entraremos em contato assim que surgir uma vaga.
                    </p>
                    <button 
                      onClick={() => {
                        setWaitlistPosition(null);
                        if (guardianExists) {
                          refreshGuardianData();
                          setStep('portal');
                        } else {
                          window.location.reload();
                        }
                      }}
                      className="bg-slate-900 text-white px-8 py-3 rounded-xl font-bold hover:bg-slate-800 transition-all"
                    >
                      {guardianExists ? 'Voltar para o Portal' : 'Voltar ao Início'}
                    </button>
                  </motion.div>
                )}

                {step === 'success' && (
                  <motion.div
                    key="success"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-white rounded-3xl shadow-xl border border-slate-200 p-12 text-center"
                  >
                    <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
                      <CheckCircle2 className="text-emerald-600" size={40} />
                    </div>
                    <h2 className="text-3xl font-bold mb-4">Matrícula Realizada!</h2>
                    
                    {(() => {
                      if (!paymentInfo) return null;
                      
                      let pixTx = null;
                      
                      // Case 1: { order, subscription }
                      if (paymentInfo.order && paymentInfo.order.charges && paymentInfo.order.charges[0]?.last_transaction) {
                        const tx = paymentInfo.order.charges[0].last_transaction;
                        if (tx.transaction_type === 'pix' || paymentInfo.order.charges[0].payment_method === 'pix') {
                          pixTx = tx;
                        }
                      }
                      
                      // Case 2: order or subscription object directly with charges
                      if (!pixTx && paymentInfo.charges && paymentInfo.charges[0]?.last_transaction) {
                        const tx = paymentInfo.charges[0].last_transaction;
                        if (tx.transaction_type === 'pix' || paymentInfo.charges[0].payment_method === 'pix') {
                          pixTx = tx;
                        }
                      }

                      // Case 3: subscription object directly (via current_invoice)
                      if (!pixTx && paymentInfo.current_invoice && paymentInfo.current_invoice.charges && paymentInfo.current_invoice.charges[0]?.last_transaction) {
                        const tx = paymentInfo.current_invoice.charges[0].last_transaction;
                        if (tx.transaction_type === 'pix' || paymentInfo.current_invoice.charges[0].payment_method === 'pix') {
                          pixTx = tx;
                        }
                      }

                      if (!pixTx) return null;

                      return (
                        <div className="mb-8 p-6 bg-emerald-50 rounded-2xl border border-emerald-100 max-w-sm mx-auto">
                          <p className="text-emerald-800 font-bold mb-4 uppercase text-sm tracking-wider">Pagamento via PIX</p>
                          <div className="bg-white p-4 rounded-xl shadow-sm mb-4 inline-block">
                            {pixTx.qr_code_url ? (
                              <img 
                                src={pixTx.qr_code_url} 
                                alt="QR Code PIX" 
                                className="w-48 h-48 mx-auto"
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <div className="w-48 h-48 flex items-center justify-center bg-slate-50 border border-dashed border-slate-200 rounded-lg">
                                <QrCode size={48} className="text-slate-300" />
                              </div>
                            )}
                          </div>
                          <div className="space-y-3">
                            <p className="text-xs text-slate-500">Escaneie o QR Code acima ou copie o código abaixo:</p>
                            <div className="flex gap-2">
                              <input 
                                readOnly 
                                value={pixTx.qr_code || ''}
                                className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-mono truncate"
                              />
                              <button 
                                onClick={(e) => {
                                  const code = pixTx.qr_code || '';
                                  navigator.clipboard.writeText(code);
                                  const btn = e.currentTarget;
                                  const originalText = btn.innerText;
                                  btn.innerText = 'Copiado!';
                                  btn.classList.replace('bg-emerald-600', 'bg-slate-800');
                                  setTimeout(() => {
                                    btn.innerText = originalText;
                                    btn.classList.replace('bg-slate-800', 'bg-emerald-600');
                                  }, 2000);
                                }}
                                className="px-3 py-2 bg-emerald-600 text-white rounded-lg text-xs font-bold transition-all"
                              >
                                Copiar
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    {(
                      (paymentInfo && paymentInfo.charges && paymentInfo.charges[0] && paymentInfo.charges[0].payment_method === 'credit_card') || 
                      (paymentInfo && paymentInfo.payment_method === 'credit_card') ||
                      (paymentInfo && paymentInfo.subscription && paymentInfo.subscription.payment_method === 'credit_card') ||
                      (paymentInfo && paymentInfo.order && paymentInfo.order.charges && paymentInfo.order.charges[0] && paymentInfo.order.charges[0].payment_method === 'credit_card')
                    ) ? (
                      <div className="mb-8 p-6 bg-blue-50 rounded-2xl border border-blue-100 max-w-sm mx-auto">
                        <p className="text-blue-800 font-bold mb-2 uppercase text-sm tracking-wider">Cartão de Crédito</p>
                        <p className="text-slate-600 text-sm">
                          Seu pagamento recorrente está sendo processado. Você receberá uma confirmação em breve.
                        </p>
                      </div>
                    ) : null}

                    <p className="text-slate-500 mb-8 max-w-md mx-auto">
                      Os dados foram enviados com sucesso e estão sendo processados para o sistema <strong>Gestão Sport for Kids 3.0</strong>.
                    </p>
                    <div className="space-y-3">
                      <button 
                        onClick={() => {
                          if (guardianExists) {
                            refreshGuardianData();
                            setStep('portal');
                          } else {
                            window.location.reload();
                          }
                        }}
                        className="w-full bg-slate-900 text-white py-4 rounded-2xl font-bold hover:bg-slate-800 transition-all"
                      >
                        {guardianExists ? 'Voltar para o Portal' : 'Nova Matrícula'}
                      </button>
                      <p className="text-xs text-slate-400">Um e-mail de confirmação foi enviado para {formData.guardian.email}</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {isCancelingEnrollment && (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white rounded-3xl shadow-2xl border border-slate-200 p-8 w-full max-w-md"
              >
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-3 bg-red-50 rounded-xl">
                    <Trash2 className="text-red-600" size={24} />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold">Cancelar Matrícula</h2>
                    <p className="text-slate-500 text-sm">Informe a data de cancelamento.</p>
                  </div>
                </div>

                <div className="space-y-4 mb-8">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">Data de Cancelamento</label>
                    <input 
                      type="date" 
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-red-500 outline-none transition-all"
                      value={cancellationDate}
                      min={step === 'portal' ? new Date().toISOString().split('T')[0] : undefined}
                      onChange={e => setCancellationDate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">Justificativa do Cancelamento</label>
                    <textarea 
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-red-500 outline-none transition-all resize-none"
                      rows={3}
                      placeholder="Por favor, nos conte o motivo do cancelamento..."
                      value={cancellationReason}
                      onChange={e => setCancellationReason(e.target.value)}
                    />
                  </div>
                  <p className="text-xs text-slate-500 bg-slate-50 p-3 rounded-lg border border-slate-100">
                    <strong>Atenção:</strong> Esta ação irá remover o aluno da turma selecionada a partir da data informada e cancelar as cobranças recorrentes.
                  </p>
                </div>

                <div className="flex gap-3">
                  <button 
                    onClick={() => {
                      setIsCancelingEnrollment(false);
                      setCancellationReason('');
                    }}
                    className="flex-1 px-6 py-3 rounded-xl font-bold text-slate-600 hover:bg-slate-100 transition-all"
                  >
                    Voltar
                  </button>
                  <button 
                    onClick={confirmCancelEnrollment}
                    disabled={loading || !cancellationDate || !cancellationReason.trim()}
                    className="flex-1 bg-red-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-red-700 transition-all shadow-lg shadow-red-200 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {loading ? <RefreshCw size={18} className="animate-spin" /> : 'Confirmar'}
                  </button>
                </div>
              </motion.div>
            </div>
          )}

          {isViewingEnrollmentDetails && selectedEnrollmentDetails && (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white rounded-3xl shadow-2xl border border-slate-200 p-8 w-full max-w-2xl max-h-[90vh] overflow-y-auto"
              >
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-emerald-50 rounded-xl">
                      <User className="text-emerald-600" size={24} />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold">Detalhes da Matrícula</h2>
                      <p className="text-slate-500 text-sm">Informações completas do aluno e responsável.</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setIsViewingEnrollmentDetails(false)}
                    className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                  >
                    <X size={20} className="text-slate-400" />
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Responsável</h3>
                      <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-2">
                        <p className="text-sm font-bold text-slate-900">{selectedEnrollmentDetails.nome_completo}</p>
                        <p className="text-sm text-slate-600 flex items-center gap-2">
                          <Mail size={14} className="text-slate-400" /> {selectedEnrollmentDetails.email}
                        </p>
                        <p className="text-sm text-slate-600 flex items-center gap-2">
                          <Phone size={14} className="text-slate-400" /> {selectedEnrollmentDetails.telefone}
                        </p>
                        <p className="text-sm text-slate-600 flex items-center gap-2">
                          <CreditCard size={14} className="text-slate-400" /> CPF: {selectedEnrollmentDetails.cpf}
                        </p>
                      </div>
                    </div>

                    <div>
                      <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Aluno</h3>
                      <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-2">
                        <p className="text-sm font-bold text-slate-900">{selectedEnrollmentDetails.aluno.nome_completo}</p>
                        <p className="text-sm text-slate-600">Série/Ano: {selectedEnrollmentDetails.aluno.serie_ano?.replace('_', ' ')}</p>
                        <p className="text-sm text-slate-600">Nascimento: {new Date(selectedEnrollmentDetails.aluno.data_nascimento).toLocaleDateString('pt-BR')}</p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div>
                      <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Matrícula</h3>
                      <div className="bg-emerald-50/50 p-4 rounded-2xl border border-emerald-100 space-y-2">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="text-sm font-bold text-emerald-900">{selectedEnrollmentDetails.matricula.turma}</p>
                            <p className="text-xs text-emerald-700 font-medium uppercase">{selectedEnrollmentDetails.matricula.unidade}</p>
                          </div>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            (selectedEnrollmentDetails.matricula.status || 'ativo').toLowerCase() === 'ativo' ? 'bg-emerald-100 text-emerald-700' :
                            (selectedEnrollmentDetails.matricula.status || '').toLowerCase() === 'cancelado' ? 'bg-red-100 text-red-700' :
                            'bg-amber-100 text-amber-700'
                          }`}>
                            {selectedEnrollmentDetails.matricula.status}
                          </span>
                        </div>
                        <div className="pt-2 border-t border-emerald-100/50 space-y-1">
                          <p className="text-xs text-emerald-800">Plano: <span className="font-bold uppercase">{selectedEnrollmentDetails.matricula.plano || 'Padrão'}</span></p>
                          <p className="text-xs text-emerald-800">Data Matrícula: <span className="font-bold">{new Date(selectedEnrollmentDetails.matricula.data_matricula).toLocaleDateString('pt-BR')}</span></p>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Pagamento</h3>
                      <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-3">
                        {selectedEnrollmentDetails.pagamentos.map((pag: any, pIdx: number) => (
                          <div key={pIdx} className="flex justify-between items-center p-2 bg-white rounded-xl border border-slate-100 shadow-sm">
                            <div className="flex items-center gap-2">
                              {pag.metodo_pagamento === 'pix' ? <QrCode size={14} className="text-emerald-600" /> : <CreditCard size={14} className="text-purple-600" />}
                              <div>
                                <p className="text-[10px] font-bold text-slate-900 uppercase">{pag.metodo_pagamento?.replace('_', ' ')}</p>
                                <p className="text-[9px] text-slate-400">ID: {pag.pagarme_id?.slice(-8)}</p>
                              </div>
                            </div>
                            <span className={(() => {
                              const isPaid = pag.status?.toLowerCase() === 'pago';
                              const isCancelled = pag.status?.toLowerCase() === 'cancelado';
                              const isRefunded = pag.status?.toLowerCase() === 'estornado';
                              const isFailed = pag.status?.toLowerCase() === 'falha';
                              
                              let statusColor = 'bg-amber-100 text-amber-700';
                              
                              if (isPaid) statusColor = 'bg-emerald-100 text-emerald-700';
                              else if (isCancelled) statusColor = 'bg-red-100 text-red-700';
                              else if (isRefunded) statusColor = 'bg-blue-100 text-blue-700';
                              else if (isFailed) statusColor = 'bg-rose-100 text-rose-700';
                              else if (pag.data_vencimento) {
                                const dueDate = new Date(pag.data_vencimento);
                                const today = new Date();
                                today.setHours(0, 0, 0, 0);
                                if (dueDate >= today) statusColor = 'bg-blue-100 text-blue-700';
                              }
                              return `px-2 py-0.5 rounded text-[9px] font-bold uppercase ${statusColor}`;
                            })()}>
                              {(() => {
                                const isPaid = pag.status?.toLowerCase() === 'pago';
                                const isCancelled = pag.status?.toLowerCase() === 'cancelado';
                                const isRefunded = pag.status?.toLowerCase() === 'estornado';
                                const isFailed = pag.status?.toLowerCase() === 'falha';
                                
                                if (isPaid) return 'Conciliado';
                                if (isCancelled) return 'Cancelado';
                                if (isRefunded) return 'Estornado';
                                if (isFailed) return 'Falhou';
                                if (pag.data_vencimento) {
                                  const dueDate = new Date(pag.data_vencimento);
                                  const today = new Date();
                                  today.setHours(0, 0, 0, 0);
                                  if (dueDate >= today) return 'A Vencer';
                                }
                                return 'Pendente';
                              })()}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-8 flex justify-end">
                  <button 
                    onClick={() => setIsViewingEnrollmentDetails(false)}
                    className="px-8 py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-all shadow-lg shadow-slate-200"
                  >
                    Fechar
                  </button>
                </div>
              </motion.div>
            </div>
          )}

          {isFreezingEnrollment && (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-white rounded-3xl shadow-2xl border border-slate-200 p-8 w-full max-w-md"
              >
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-3 bg-amber-50 rounded-xl">
                    <Lock className="text-amber-600" size={24} />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold">Trancar Matrícula</h2>
                    <p className="text-slate-500 text-sm">Suspenda temporariamente a matrícula.</p>
                  </div>
                </div>

                <div className="space-y-4 mb-8">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">Data de Início</label>
                    <input 
                      type="date" 
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-amber-500 outline-none transition-all"
                      value={freezeStartDate}
                      onChange={e => setFreezeStartDate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">Data de Fim (Opcional)</label>
                    <input 
                      type="date" 
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-amber-500 outline-none transition-all"
                      value={freezeEndDate}
                      onChange={e => setFreezeEndDate(e.target.value)}
                    />
                    <p className="text-[10px] text-slate-400">Se não preenchido, a reativação será manual.</p>
                  </div>
                  <p className="text-xs text-slate-500 bg-slate-50 p-3 rounded-lg border border-slate-100">
                    <strong>Nota:</strong> As cobranças futuras serão postergadas proporcionalmente ao tempo de afastamento no momento da reativação.
                  </p>
                </div>

                <div className="flex gap-3">
                  <button 
                    onClick={() => setIsFreezingEnrollment(false)}
                    className="flex-1 px-6 py-3 rounded-xl font-bold text-slate-600 hover:bg-slate-100 transition-all"
                  >
                    Voltar
                  </button>
                  <button 
                    onClick={confirmFreezeEnrollment}
                    disabled={loading || !freezeStartDate}
                    className="flex-1 bg-amber-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-amber-700 transition-all shadow-lg shadow-amber-200 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {loading ? <RefreshCw size={18} className="animate-spin" /> : 'Confirmar'}
                  </button>
                </div>
              </motion.div>
            </div>
          )}

          {isReactivatingEnrollment && (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-white rounded-3xl shadow-2xl border border-slate-200 p-8 w-full max-w-md"
              >
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-3 bg-emerald-50 rounded-xl">
                    <RefreshCw className="text-emerald-600" size={24} />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold">Reativar Matrícula</h2>
                    <p className="text-slate-500 text-sm">Retome as atividades do aluno.</p>
                  </div>
                </div>

                <div className="space-y-4 mb-8">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">Data de Reativação</label>
                    <input 
                      type="date" 
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                      value={reactivationDate}
                      onChange={e => setReactivationDate(e.target.value)}
                    />
                  </div>
                  <p className="text-xs text-slate-500 bg-slate-50 p-3 rounded-lg border border-slate-100">
                    <strong>Atenção:</strong> O sistema calculará os dias de afastamento e postergará as próximas faturas no Pagar.me automaticamente.
                  </p>
                </div>

                <div className="flex gap-3">
                  <button 
                    onClick={() => setIsReactivatingEnrollment(false)}
                    className="flex-1 px-6 py-3 rounded-xl font-bold text-slate-600 hover:bg-slate-100 transition-all"
                  >
                    Voltar
                  </button>
                  <button 
                    onClick={confirmReactivateEnrollment}
                    disabled={loading || !reactivationDate}
                    className="flex-1 bg-emerald-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {loading ? <RefreshCw size={18} className="animate-spin" /> : 'Reativar'}
                  </button>
                </div>
              </motion.div>
            </div>
          )}

          {isTransferringEnrollment && (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-white rounded-3xl shadow-2xl border border-slate-200 p-8 w-full max-w-md"
              >
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-3 bg-blue-50 rounded-xl">
                    <Truck className="text-blue-600" size={24} />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold">Transferir Turma</h2>
                    <p className="text-slate-500 text-sm">Mude o aluno de turma ou unidade.</p>
                  </div>
                </div>

                <div className="space-y-4 mb-8">
                  {transferringStudent && (
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-xs">
                      <p className="font-bold text-slate-700">{transferringStudent.nome_completo}</p>
                      <p className="text-slate-500">{transferringStudent.serie_ano.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}</p>
                    </div>
                  )}

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">Nova Unidade</label>
                    <select 
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                      value={transferTarget.unidade}
                      onChange={e => setTransferTarget({ ...transferTarget, unidade: e.target.value, turma: '' })}
                    >
                      <option value="">Selecione a unidade...</option>
                      {options.unidades.map(u => (
                        <option key={u} value={u}>{u}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">Nova Turma</label>
                    <select 
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                      value={transferTarget.turma}
                      onChange={e => setTransferTarget({ ...transferTarget, turma: e.target.value })}
                      disabled={!transferTarget.unidade}
                    >
                      <option value="">Selecione a turma...</option>
                      {options.turmas
                        .filter(t => {
                          const normalizeUnit = (s: string) => s?.toLowerCase().trim() || '';
                          const unitMatch = normalizeUnit(t.unidade) === normalizeUnit(transferTarget.unidade) || 
                                           normalizeUnit(t.unidade_atendimento) === normalizeUnit(transferTarget.unidade) ||
                                           normalizeUnit(t.unidade_nome) === normalizeUnit(transferTarget.unidade) ||
                                           normalizeUnit(t.local_aula) === normalizeUnit(transferTarget.unidade);
                          
                          if (!unitMatch) return false;
                          if (t.status === 'inativo') return false;
                          
                          if (!transferringStudent) return true;

                          // Filter by Grade
                          let seriesPermitidas: string[] = [];
                          try {
                            if (Array.isArray(t.series_permitidas)) {
                              seriesPermitidas = t.series_permitidas;
                            } else if (typeof t.series_permitidas === 'string' && t.series_permitidas.trim() !== '') {
                              if (t.series_permitidas.trim().startsWith('[') && t.series_permitidas.trim().endsWith(']')) {
                                seriesPermitidas = JSON.parse(t.series_permitidas);
                              } else {
                                seriesPermitidas = t.series_permitidas.split(',').map((s: string) => s.trim());
                              }
                            }
                          } catch (e) {
                            console.error('Error parsing series_permitidas:', e);
                            seriesPermitidas = [];
                          }
                          
                          const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
                          
                          const gradeMatch = seriesPermitidas.length === 0 || 
                                           seriesPermitidas.some(s => normalize(s) === normalize(transferringStudent.serie_ano));
                          
                          // Filter by Age
                          const birthDate = new Date(transferringStudent.data_nascimento);
                          const today = new Date();
                          let age = today.getFullYear() - birthDate.getFullYear();
                          const m = today.getMonth() - birthDate.getMonth();
                          if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
                            age--;
                          }

                          const ageMatch = isNaN(age) || (
                            (!t.idade_minima || age >= t.idade_minima) && 
                            (!t.idade_maxima || age <= t.idade_maxima)
                          );

                          return gradeMatch && ageMatch;
                        })
                        .map(t => (
                          <option key={t.id || t.nome} value={t.nome}>{t.nome}</option>
                        ))
                      }
                    </select>
                    {transferTarget.unidade && options.turmas.filter(t => {
                      const normalizeUnit = (s: string) => s?.toLowerCase().trim() || '';
                      const unitMatch = normalizeUnit(t.unidade) === normalizeUnit(transferTarget.unidade) || 
                                       normalizeUnit(t.unidade_atendimento) === normalizeUnit(transferTarget.unidade) ||
                                       normalizeUnit(t.unidade_nome) === normalizeUnit(transferTarget.unidade) ||
                                       normalizeUnit(t.local_aula) === normalizeUnit(transferTarget.unidade);
                      return unitMatch;
                    }).filter(t => {
                      if (!transferringStudent) return true;
                      let seriesPermitidas: string[] = [];
                      try {
                        if (Array.isArray(t.series_permitidas)) {
                          seriesPermitidas = t.series_permitidas;
                        } else if (typeof t.series_permitidas === 'string' && t.series_permitidas.trim() !== '') {
                          if (t.series_permitidas.trim().startsWith('[') && t.series_permitidas.trim().endsWith(']')) {
                            seriesPermitidas = JSON.parse(t.series_permitidas);
                          } else {
                            seriesPermitidas = t.series_permitidas.split(',').map((s: string) => s.trim());
                          }
                        }
                      } catch (e) { seriesPermitidas = []; }
                      const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
                      const gradeMatch = seriesPermitidas.length === 0 || 
                                       seriesPermitidas.some(s => normalize(s) === normalize(transferringStudent.serie_ano));
                      const birthDate = new Date(transferringStudent.data_nascimento);
                      const today = new Date();
                      let age = today.getFullYear() - birthDate.getFullYear();
                      const m = today.getMonth() - birthDate.getMonth();
                      if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;
                      const ageMatch = isNaN(age) || ((!t.idade_minima || age >= t.idade_minima) && (!t.idade_maxima || age <= t.idade_maxima));
                      return gradeMatch && ageMatch;
                    }).length === 0 && (
                      <p className="text-[10px] text-red-500 mt-1">Nenhuma turma compatível com a idade/série do aluno nesta unidade.</p>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 bg-slate-50 p-3 rounded-lg border border-slate-100">
                    <strong>Nota:</strong> A matrícula atual será marcada como transferida e uma nova matrícula será criada na turma de destino.
                  </p>
                </div>

                <div className="flex gap-3">
                  <button 
                    onClick={() => {
                      setIsTransferringEnrollment(false);
                      setTransferringStudent(null);
                    }}
                    className="flex-1 px-6 py-3 rounded-xl font-bold text-slate-600 hover:bg-slate-100 transition-all"
                  >
                    Voltar
                  </button>
                  <button 
                    onClick={confirmTransferEnrollment}
                    disabled={loading || !transferTarget.turma}
                    className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {loading ? <RefreshCw size={18} className="animate-spin" /> : 'Transferir'}
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Modal Novo Cupom */}
        <AnimatePresence>
          {isAddingCoupon && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden"
              >
                <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                  <h3 className="text-xl font-bold text-slate-900">{editingCouponId ? 'Editar cupom' : 'Novo cupom'}</h3>
                  <button 
                    onClick={() => {
                      setIsAddingCoupon(false);
                      setEditingCouponId(null);
                      setNewCoupon({
                        codigo: '',
                        nome: '',
                        tipo: 'fixo',
                        valor: 0,
                        aplicar_em: 'primeira_parcela',
                        data_inicio: new Date().toISOString().split('T')[0],
                        data_expiracao: '',
                        limite_uso: null,
                        uso_unico_cliente: false,
                        sem_expiracao: true,
                        tem_limite_uso: false
                      });
                    }}
                    className="p-2 hover:bg-white rounded-xl transition-colors text-slate-400 hover:text-slate-600"
                  >
                    <X size={20} />
                  </button>
                </div>

                <form onSubmit={handleCreateCoupon} className="p-8 space-y-8 overflow-y-auto max-h-[80vh]">
                  <div className="space-y-4">
                    <p className="text-sm font-medium text-slate-700">Selecione o tipo de cupom que deseja oferecer:</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                      {[
                        { id: 'fixo', label: 'R$ Desconto', color: 'bg-orange-500', icon: <DollarSign size={20} /> },
                        { id: 'percentual', label: '% Desconto', color: 'bg-blue-500', icon: <Percent size={20} /> },
                      ].map((type) => (
                        <button
                          key={type.id}
                          type="button"
                          onClick={() => setNewCoupon(prev => ({ ...prev, tipo: type.id }))}
                          className={`flex flex-col items-center justify-center p-4 rounded-2xl border-2 transition-all gap-2 ${
                            newCoupon.tipo === type.id 
                              ? 'border-blue-500 bg-blue-50 shadow-sm' 
                              : 'border-slate-100 hover:border-slate-200'
                          }`}
                        >
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white ${type.color}`}>
                            {type.icon}
                          </div>
                          <span className="text-[10px] font-bold uppercase text-center leading-tight">{type.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-slate-700 flex items-center gap-1">
                        Código do cupom <Info size={14} className="text-blue-500" />
                      </label>
                      <input 
                        type="text"
                        required
                        placeholder="Ex.: OFERTADEVERAO20"
                        value={newCoupon.codigo}
                        onChange={e => setNewCoupon(prev => ({ ...prev, codigo: e.target.value.toUpperCase() }))}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-slate-700">Nome do cupom</label>
                      <input 
                        type="text"
                        required
                        placeholder="Ex.: Oferta de verão"
                        value={newCoupon.nome}
                        onChange={e => setNewCoupon(prev => ({ ...prev, nome: e.target.value }))}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-slate-700 flex items-center gap-1">
                        Desconto <Info size={14} className="text-blue-500" />
                      </label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">
                          {newCoupon.tipo === 'fixo' ? 'R$' : '%'}
                        </span>
                        <input 
                          type="number"
                          required
                          value={newCoupon.valor || ''}
                          onChange={e => {
                            const val = parseFloat(e.target.value);
                            setNewCoupon(prev => ({ ...prev, valor: isNaN(val) ? 0 : val }));
                          }}
                          className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-slate-700">Aplicar em</label>
                      <select 
                        value={newCoupon.aplicar_em}
                        onChange={e => setNewCoupon(prev => ({ ...prev, aplicar_em: e.target.value }))}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all appearance-none"
                      >
                        <option value="primeira_parcela">Apenas na 1ª parcela</option>
                        <option value="todas_parcelas">Em todas as parcelas</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <label className="text-sm font-bold text-slate-700 flex items-center gap-1">
                      Válido entre <Info size={14} className="text-blue-500" />
                    </label>
                    <div className="flex flex-wrap items-center gap-4">
                      <input 
                        type="date"
                        value={newCoupon.data_inicio}
                        onChange={e => setNewCoupon(prev => ({ ...prev, data_inicio: e.target.value }))}
                        className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none"
                      />
                      <span className="text-slate-400">até</span>
                      <input 
                        type="date"
                        disabled={newCoupon.sem_expiracao}
                        value={newCoupon.data_expiracao}
                        onChange={e => setNewCoupon(prev => ({ ...prev, data_expiracao: e.target.value }))}
                        className={`px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none ${newCoupon.sem_expiracao ? 'opacity-40' : ''}`}
                      />
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input 
                          type="checkbox"
                          checked={newCoupon.sem_expiracao}
                          onChange={e => setNewCoupon(prev => ({ ...prev, sem_expiracao: e.target.checked }))}
                          className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm text-slate-600">Sem expiração</span>
                      </label>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <p className="text-sm font-bold text-slate-700">Limite de uso</p>
                    <div className="space-y-3">
                      <label className="flex items-center gap-3 cursor-pointer group">
                        <input 
                          type="checkbox"
                          checked={newCoupon.tem_limite_uso}
                          onChange={e => setNewCoupon(prev => ({ ...prev, tem_limite_uso: e.target.checked }))}
                          className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm text-slate-600 group-hover:text-slate-900 transition-colors flex items-center gap-1">
                          Limite o número total de usos para esse cupom <Info size={14} className="text-blue-500" />
                        </span>
                      </label>
                      {newCoupon.tem_limite_uso && (
                        <input 
                          type="number"
                          placeholder="Quantidade total de usos"
                          value={newCoupon.limite_uso || ''}
                          onChange={e => {
                            const val = parseInt(e.target.value);
                            setNewCoupon(prev => ({ ...prev, limite_uso: isNaN(val) ? null : val }));
                          }}
                          className="w-full max-w-xs px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                      )}
                      <label className="flex items-center gap-3 cursor-pointer group">
                        <input 
                          type="checkbox"
                          checked={newCoupon.uso_unico_cliente}
                          onChange={e => setNewCoupon(prev => ({ ...prev, uso_unico_cliente: e.target.checked }))}
                          className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm text-slate-600 group-hover:text-slate-900 transition-colors">
                          Limitar a apenas um uso por cliente
                        </span>
                      </label>
                    </div>
                  </div>

                  <div className="pt-6 border-t border-slate-100 flex justify-end gap-3">
                    <button 
                      type="button"
                      onClick={() => {
                        setIsAddingCoupon(false);
                        setEditingCouponId(null);
                        setNewCoupon({
                          codigo: '',
                          nome: '',
                          tipo: 'fixo',
                          valor: 0,
                          aplicar_em: 'primeira_parcela',
                          data_inicio: new Date().toISOString().split('T')[0],
                          data_expiracao: '',
                          limite_uso: null,
                          uso_unico_cliente: false,
                          sem_expiracao: true,
                          tem_limite_uso: false
                        });
                      }}
                      className="px-6 py-3 text-slate-600 font-bold hover:bg-slate-50 rounded-2xl transition-all"
                    >
                      Cancelar
                    </button>
                    <button 
                      type="submit"
                      disabled={loading}
                      className="px-8 py-3 bg-blue-600 text-white font-bold rounded-2xl hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all disabled:opacity-50 flex items-center gap-2"
                    >
                      {loading ? <RefreshCw size={18} className="animate-spin" /> : (editingCouponId ? <Save size={18} /> : <Plus size={18} />)}
                      {editingCouponId ? 'Salvar Alterações' : 'Criar Cupom'}
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}

          {couponToDelete && (
            <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8 text-center"
              >
                <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6">
                  <AlertCircle size={32} />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">Excluir Cupom?</h3>
                <p className="text-slate-500 mb-8">
                  Tem certeza que deseja excluir este cupom? Esta ação não pode ser desfeita, mas não afetará matrículas que já utilizaram este desconto.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setCouponToDelete(null)}
                    className="flex-1 px-6 py-3 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition-all"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => handleDeleteCoupon(couponToDelete)}
                    className="flex-1 px-6 py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition-all"
                  >
                    Excluir
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {showTermsModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-100 text-emerald-600 rounded-xl">
                    <FileText size={24} />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-900">Termos e Condições</h3>
                    <p className="text-sm text-slate-500">Contrato de Prestação de Serviços</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowTermsModal(false)}
                  className="p-2 hover:bg-slate-200 rounded-full transition-colors"
                >
                  <X size={24} className="text-slate-400" />
                </button>
              </div>
              
              <div className="p-8 overflow-y-auto flex-1 bg-white">
                <div className="prose prose-slate max-w-none whitespace-pre-wrap text-slate-700 leading-relaxed font-serif text-lg">
                  {getPopulatedTerms() || "Nenhum termo configurado."}
                </div>
              </div>

              <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end gap-4">
                <button 
                  onClick={() => setShowTermsModal(false)}
                  className="px-8 py-3 bg-slate-900 text-white font-bold rounded-2xl hover:bg-slate-800 transition-all shadow-lg shadow-slate-200"
                >
                  Fechar
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {showNotifyModal.isOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8"
            >
              <h3 className="text-2xl font-bold text-slate-900 mb-4">Notificar Vaga</h3>
              <p className="text-slate-600 mb-6">
                Deseja enviar uma mensagem para <strong>{showNotifyModal.item?.responsavel1}</strong> ({showNotifyModal.item?.whatsapp1}) informando sobre a disponibilidade de vaga para <strong>{showNotifyModal.item?.estudante}</strong>?
              </p>
              <div className="flex gap-4">
                <button 
                  onClick={() => setShowNotifyModal({ isOpen: false, item: null })}
                  className="flex-1 px-6 py-3 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200 transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  onClick={confirmNotifyVacancy}
                  className="flex-1 px-6 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-colors"
                >
                  Enviar Mensagem
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </main>

      <footer className="max-w-6xl mx-auto py-12 px-6 text-center text-slate-400 text-sm">
        <p>© 2024 Sport for Kids. Todos os direitos reservados.</p>
        <p className="mt-2 flex items-center justify-center gap-1">
          <ShieldCheck size={14} /> Ambiente Seguro e Criptografado via Supabase
        </p>
      </footer>

      {/* Modal de Mapeamento WIX */}
      <AnimatePresence>
        {showMappingModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-[32px] shadow-2xl w-full max-w-2xl overflow-hidden"
            >
              <div className="p-8">
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h3 className="text-2xl font-black text-slate-900">Mapeamento de Colunas</h3>
                    <p className="text-slate-500 text-sm">Indique qual coluna do seu CSV corresponde a cada campo necessário.</p>
                  </div>
                  <button 
                    onClick={() => setShowMappingModal(false)}
                    className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                  >
                    <X size={24} />
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {[
                    { id: 'email', label: 'Email do Responsável', icon: <Mail size={16} /> },
                    { id: 'responsavel_nome', label: 'Nome do Responsável (Opcional)', icon: <User size={16} /> },
                    { id: 'aluno', label: 'Nome do Aluno (Opcional)', icon: <User size={16} /> },
                    { id: 'plano', label: 'Nome do Plano / Item', icon: <Tag size={16} /> },
                    { id: 'data', label: 'Data do Pagamento', icon: <Calendar size={16} /> },
                    { id: 'valor', label: 'Valor do Pagamento', icon: <DollarSign size={16} /> },
                    { id: 'status', label: 'Status do Pagamento', icon: <CheckCircle2 size={16} /> },
                    { id: 'transacao_id', label: 'ID da Transação (Opcional)', icon: <Hash size={16} /> }
                  ].map((field) => (
                    <div key={field.id} className="space-y-2">
                      <label className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider">
                        {field.icon} {field.label}
                      </label>
                      <select 
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                        onChange={(e) => {
                          const val = e.target.value;
                          setWixMapping(prev => ({ ...prev!, [field.id]: val }));
                        }}
                        defaultValue={
                          // Tenta pré-selecionar baseado em nomes comuns
                          csvHeaders.find(h => {
                            const cleanH = h.toLowerCase();
                            if (field.id === 'email') return cleanH.includes('email') || cleanH.includes('e-mail');
                            if (field.id === 'responsavel_nome') return cleanH === 'nome' || cleanH === 'name' || cleanH.includes('responsável') || cleanH.includes('responsavel');
                            if (field.id === 'aluno') return cleanH.includes('aluno') || cleanH.includes('estudante') || cleanH.includes('filho') || cleanH.includes('criança');
                            if (field.id === 'plano') return cleanH.includes('item') || cleanH.includes('plano') || cleanH.includes('produto');
                            if (field.id === 'data') return cleanH.includes('data') || cleanH.includes('date');
                            if (field.id === 'valor') return cleanH.includes('valor') || cleanH.includes('total') || cleanH.includes('preço') || cleanH.includes('preço');
                            if (field.id === 'status') return cleanH.includes('status');
                            if (field.id === 'transacao_id') return cleanH.includes('id') || cleanH.includes('transação') || cleanH.includes('transacao');
                            return false;
                          }) || ''
                        }
                      >
                        <option value="">-- Selecione uma coluna --</option>
                        {csvHeaders.map((header, idx) => (
                          <option key={idx} value={header}>{header}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>

                <div className="mt-10 flex gap-4">
                  <button 
                    onClick={() => setShowMappingModal(false)}
                    className="flex-1 py-4 bg-slate-100 text-slate-600 font-bold rounded-2xl hover:bg-slate-200 transition-all"
                  >
                    Cancelar
                  </button>
                  <button 
                    onClick={() => {
                      // Se o usuário não selecionou nada, tenta usar os defaults baseados no find acima
                      const finalMapping = { ...wixMapping } as any;
                      ['email', 'responsavel_nome', 'aluno', 'plano', 'data', 'valor', 'status', 'transacao_id'].forEach(f => {
                        if (!finalMapping[f]) {
                          const found = csvHeaders.find(h => {
                            const cleanH = h.toLowerCase();
                            if (f === 'email') return cleanH.includes('email') || cleanH.includes('e-mail');
                            if (f === 'responsavel_nome') return cleanH === 'nome' || cleanH === 'name' || cleanH.includes('responsável') || cleanH.includes('responsavel');
                            if (f === 'aluno') return cleanH.includes('aluno') || cleanH.includes('estudante') || cleanH.includes('filho') || cleanH.includes('criança');
                            if (f === 'plano') return cleanH.includes('item') || cleanH.includes('plano') || cleanH.includes('produto');
                            if (f === 'data') return cleanH.includes('data') || cleanH.includes('date');
                            if (f === 'valor') return cleanH.includes('valor') || cleanH.includes('total') || cleanH.includes('preço');
                            if (f === 'status') return cleanH.includes('status');
                            if (f === 'transacao_id') return cleanH.includes('id') || cleanH.includes('transação') || cleanH.includes('transacao');
                            return false;
                          });
                          if (found) finalMapping[f] = found;
                        }
                      });
                      
                      if (!finalMapping.email || !finalMapping.plano) {
                        alert('Por favor, mapeie pelo menos o Email e o Plano.');
                        return;
                      }
                      handleConfirmMapping(finalMapping);
                    }}
                    className="flex-[2] py-4 bg-slate-900 text-white font-bold rounded-2xl hover:bg-slate-800 transition-all shadow-lg shadow-slate-900/20"
                  >
                    Confirmar Mapeamento
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Error Modal */}
      {errorMessage && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden"
          >
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-red-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                  <AlertCircle size={20} className="text-red-600" />
                </div>
                <h2 className="text-xl font-bold text-red-900">Atenção</h2>
              </div>
              <button 
                onClick={() => setErrorMessage(null)}
                className="p-2 hover:bg-red-100 rounded-full transition-colors"
              >
                <X size={20} className="text-red-400" />
              </button>
            </div>
            
            <div className="p-6">
              <p className="text-slate-700 whitespace-pre-wrap">{errorMessage}</p>
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end">
              <button 
                onClick={() => setErrorMessage(null)}
                className="px-6 py-2 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition-all"
              >
                Entendi
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Success Modal */}
      {successMessage && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden"
          >
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-emerald-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
                  <CheckCircle2 size={20} className="text-emerald-600" />
                </div>
                <h2 className="text-xl font-bold text-emerald-900">Sucesso</h2>
              </div>
              <button 
                onClick={() => setSuccessMessage(null)}
                className="p-2 hover:bg-emerald-100 rounded-full transition-colors"
              >
                <X size={20} className="text-emerald-400" />
              </button>
            </div>
            
            <div className="p-6">
              <p className="text-slate-700 whitespace-pre-wrap">{successMessage}</p>
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end">
              <button 
                onClick={() => setSuccessMessage(null)}
                className="px-6 py-2 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition-all"
              >
                Continuar
              </button>
            </div>
          </motion.div>
        </div>
      )}
      {/* Approve Cancellation Modal */}
      {approveCancelModal.isOpen && approveCancelModal.task && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
          >
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <Calendar size={24} className="text-emerald-600" />
                Aprovar Cancelamento
              </h3>
              <button 
                onClick={() => setApproveCancelModal({ isOpen: false, task: null, date: '' })}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X size={24} />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <p className="text-slate-600 text-sm">
                Selecione a data efetiva do cancelamento. Esta data será usada para calcular os valores proporcionais.
              </p>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Data do Cancelamento
                </label>
                <input
                  type="date"
                  value={approveCancelModal.date}
                  onChange={(e) => setApproveCancelModal({ ...approveCancelModal, date: e.target.value })}
                  className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                />
              </div>
              
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3">
                <AlertCircle className="text-amber-600 shrink-0" size={20} />
                <div className="text-sm text-amber-800">
                  <p className="font-medium mb-1">Atenção</p>
                  <p>A data solicitada pelo cliente foi: <strong>{approveCancelModal.task.detalhes?.data_cancelamento?.split('-').reverse().join('/')}</strong></p>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
              <button 
                onClick={() => setApproveCancelModal({ isOpen: false, task: null, date: '' })}
                className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-200 rounded-xl transition-all"
              >
                Cancelar
              </button>
              <button 
                onClick={() => {
                  handleApproveTask(approveCancelModal.task, approveCancelModal.date);
                  setApproveCancelModal({ isOpen: false, task: null, date: '' });
                }}
                className="px-6 py-2 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200"
              >
                Confirmar e Processar
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Welcome Message Modal */}
      {showWelcomeModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="bg-white rounded-[32px] shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-100"
          >
            <div className="relative h-32 md:h-48 shrink-0 bg-emerald-600 flex items-center justify-center overflow-hidden">
              <div className="absolute inset-0 opacity-20">
                <div className="absolute -top-24 -left-24 w-64 h-64 bg-white rounded-full blur-3xl"></div>
                <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-white rounded-full blur-3xl"></div>
              </div>
              <div className="relative flex flex-col items-center text-white text-center px-6">
                <div className="w-12 h-12 md:w-20 md:h-20 bg-white/20 backdrop-blur-md rounded-2xl md:rounded-3xl flex items-center justify-center mb-2 md:mb-4 border border-white/30">
                  <Sparkles className="text-white w-6 h-6 md:w-10 md:h-10" />
                </div>
                <h2 className="text-xl md:text-2xl font-black uppercase tracking-tight">Migração Concluída!</h2>
              </div>
              <button 
                onClick={() => setShowWelcomeModal(false)}
                className="absolute top-4 right-4 md:top-6 md:right-6 p-2 bg-white/10 hover:bg-white/20 rounded-full transition-all text-white"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 md:p-10 space-y-6 overflow-y-auto">
              <div className="space-y-4">
                <h3 className="text-lg md:text-xl font-bold text-slate-900 leading-tight">
                  Bem-vindo(a) ao novo Portal de Matrículas Sport for Kids!
                </h3>
                <p className="text-sm md:text-base text-slate-600 leading-relaxed">
                  Para sua comodidade, migramos todos os dados da plataforma anterior para este novo ambiente. 
                  O acesso continua sendo pelo mesmo e-mail que você já utilizava.
                </p>
              </div>

              <div className="bg-slate-50 rounded-2xl p-5 md:p-6 border border-slate-100 space-y-4">
                <h4 className="text-xs md:text-sm font-black text-slate-400 uppercase tracking-widest">Para realizar seu primeiro acesso:</h4>
                <ul className="space-y-3">
                  {[
                    "Informe seu e-mail no campo indicado;",
                    "Clique em \"Esqueci minha senha\";",
                    "Você receberá uma senha temporária via WhatsApp;"
                  ].map((item, i) => (
                    <li key={i} className="flex items-start gap-3 text-slate-700">
                      <div className="mt-0.5 md:mt-1 w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0 text-emerald-600 font-bold text-[10px]">
                        {i + 1}
                      </div>
                      <span className="text-xs md:text-sm font-medium">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="flex items-start gap-3 md:gap-4 p-4 bg-amber-50 rounded-2xl border border-amber-100">
                <div className="p-1.5 md:p-2 bg-amber-100 rounded-xl text-amber-600 shrink-0">
                  <Info size={18} className="md:w-5 md:h-5" />
                </div>
                <p className="text-[11px] md:text-xs text-amber-800 leading-relaxed">
                  <strong>Importante:</strong> Após o primeiro login, solicitamos que altere essa senha para uma de sua preferência nas configurações do perfil.
                </p>
              </div>

              <p className="text-xs md:text-sm text-slate-500 text-center italic">
                Estamos à disposição para ajudar. Se precisar de qualquer suporte, não hesite em nos contatar!
              </p>

              <button 
                onClick={() => setShowWelcomeModal(false)}
                className="w-full py-3.5 md:py-4 bg-slate-900 text-white text-sm md:text-base font-black uppercase tracking-widest rounded-2xl hover:bg-slate-800 transition-all shadow-xl shadow-slate-200 shrink-0 mt-4"
              >
                Entendi, vamos lá!
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
