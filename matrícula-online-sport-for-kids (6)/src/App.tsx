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
  X,
  Truck,
  Gift,
  Info,
  Star,
  Check,
  AlertCircle
} from 'lucide-react';

type Step = 'guardian' | 'student' | 'enrollment' | 'payment' | 'success' | 'waitlist_success' | 'admin' | 'portal';

interface Enrollment {
  nome_completo: string;
  alunos: { 
    nome_completo: string; 
    serie_ano: string;
    matriculas: {
      turma: string;
      unidade: string;
      turma_id?: string;
      status?: string;
    }[];
  }[];
  pagamentos: { status: string; metodo_pagamento: string }[];
}

export default function App() {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [step, setStep] = useState<Step>('guardian');
  const [loading, setLoading] = useState(false);
  const [searchingGuardian, setSearchingGuardian] = useState(false);
  const [guardianExists, setGuardianExists] = useState<boolean | null>(null);
  const [hasFidelityDiscount, setHasFidelityDiscount] = useState(false);
  const [verifyingPassword, setVerifyingPassword] = useState(false);
  const [recoveringPassword, setRecoveringPassword] = useState(false);
  const [isEditingGuardian, setIsEditingGuardian] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isFetchingAddress, setIsFetchingAddress] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [isCancelingEnrollment, setIsCancelingEnrollment] = useState(false);
  const [cancelingEnrollmentId, setCancelingEnrollmentId] = useState<string | null>(null);
  const [cancellationDate, setCancellationDate] = useState(new Date().toISOString().split('T')[0]);
  const [dependents, setDependents] = useState<any[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [adminTab, setAdminTab] = useState<'enrollments' | 'settings' | 'waitlist' | 'finance' | 'coupons'>('enrollments');
  const [termsTemplate, setTermsTemplate] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [isSavingTerms, setIsSavingTerms] = useState(false);
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
  const [appliedCoupon, setAppliedCoupon] = useState<any>(null);
  const [couponCode, setCouponCode] = useState('');
  const [couponError, setCouponError] = useState('');
  const isSubmittingRef = useRef(false);
  const [portalTab, setPortalTab] = useState<'dashboard' | 'payments' | 'profile'>('dashboard');
  const [payments, setPayments] = useState<any[]>([]);
  const [waitlist, setWaitlist] = useState<any[]>([]);
  const [settingsSearch, setSettingsSearch] = useState('');
  const [financialData, setFinancialData] = useState<{ pagamentos: any[], turmas: any[] } | null>(null);
  const [paymentInfo, setPaymentInfo] = useState<any>(null);
  const [financeFilters, setFinanceFilters] = useState({
    unidade: '',
    professor: '',
    search: '',
    view: 'summary' as 'summary' | 'detailed'
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
    professor: ''
  });
  const [editingOption, setEditingOption] = useState<{ type: string, oldNome: string } | null>(null);
  const [options, setOptions] = useState<{
    series: string[], 
    unidades: string[], 
    turmas: { 
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
      professor?: string
    }[]
  }>({
    series: [],
    unidades: [],
    turmas: []
  });
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

  const [transferringEnrollmentId, setTransferringEnrollmentId] = useState<number | null>(null);
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  
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
    fetch('/api/settings/terms_template')
      .then(res => res.json())
      .then(data => setTermsTemplate(data.valor || ''))
      .catch(err => console.error("Error fetching terms:", err));
  }, []);

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

  const handleCancelEnrollment = (id: string) => {
    setCancelingEnrollmentId(id);
    setIsCancelingEnrollment(true);
  };

  const confirmCancelEnrollment = async () => {
    if (!cancelingEnrollmentId) return;

    const today = new Date().toISOString().split('T')[0];
    if (cancellationDate < today) {
      alert('A data de cancelamento não pode ser anterior à data de hoje.');
      return;
    }
    
    setLoading(true);
    try {
      const response = await fetch('/api/enrollment/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          enrollmentId: cancelingEnrollmentId,
          cancellationDate: cancellationDate
        })
      });
      if (response.ok) {
        await refreshGuardianData();
        alert('Matrícula cancelada com sucesso');
        setIsCancelingEnrollment(false);
        setCancelingEnrollmentId(null);
      } else {
        const data = await response.json();
        alert(data.error || 'Erro ao cancelar matrícula');
      }
    } catch (error) {
      console.error('Error canceling enrollment:', error);
      alert('Erro de conexão');
    } finally {
      setLoading(false);
    }
  };

  const fetchOptions = async () => {
    try {
      const response = await fetch('/api/options');
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
      const data = await response.json();
      if (response.ok) {
        setEnrollments(Array.isArray(data) ? data : []);
      } else {
        console.error('API Error fetching enrollments:', data.error);
        setEnrollments([]);
        alert('Erro ao carregar matrículas: ' + (data.error || 'Erro desconhecido'));
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
      if (response.ok) {
        const data = await response.json();
        setPayments(data);
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
        alert('Senha enviada para o WhatsApp cadastrado');
      } else {
        alert(data.error || 'Erro ao recuperar senha');
      }
    } catch (error: any) {
      console.error('Error recovering password:', error);
      alert(`Erro de conexão ao recuperar senha: ${error.message || 'Erro desconhecido'}`);
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
          professor: newOption.type === 'turmas' ? newOption.professor : undefined
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
          professor: ''
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

      const response = await fetch('/api/coupons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dbPayload)
      });

      if (response.ok) {
        await fetchCoupons();
        setIsAddingCoupon(false);
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
    if (!confirm('Tem certeza que deseja excluir este cupom?')) return;
    try {
      const response = await fetch(`/api/coupons/${id}`, { method: 'DELETE' });
      if (response.ok) await fetchCoupons();
    } catch (error) {
      console.error('Error deleting coupon:', error);
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
    }
  }, [adminTab]);

  const handleNext = async () => {
    if (step === 'guardian') {
      // Validation for guardian step
      const g = formData.guardian;
      if (!g.cpf || g.cpf.replace(/\D/g, '').length !== 11) {
        alert('Por favor, insira um CPF válido.');
        return;
      }
      
      if (guardianExists === true && !g.name) {
        alert('Por favor, insira sua senha e clique em "Acessar" para carregar seus dados.');
        return;
      }

      if (!g.name || !g.email || !g.phone || !g.zipCode || !g.street || !g.number || !g.neighborhood || !g.city || !g.state || !g.password) {
        alert('Por favor, preencha todos os campos obrigatórios, incluindo a senha e o endereço completo.');
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
          alert(`Erro ao salvar dados do responsável: ${error.message}`);
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
        alert('Por favor, preencha todos os campos obrigatórios do aluno (incluindo os dois contatos).');
        return;
      }
      setStep('enrollment');
    }
    else if (step === 'enrollment') {
      if (!acceptedTerms) {
        alert('Você precisa aceitar os termos e condições para prosseguir.');
        return;
      }
      const s = formData.student;
      if (!s.unidade || !s.turmaComplementar) {
        alert('Por favor, selecione a unidade e a turma complementar.');
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
    
    // Validate credit card if selected
    if (formData.paymentMethod === 'credit_card') {
      const { number, holderName, expMonth, expYear, cvv } = formData.card;
      if (!number || number.replace(/\s/g, '').length < 13) {
        alert('Por favor, informe um número de cartão válido.');
        return;
      }
      if (!holderName) {
        alert('Por favor, informe o nome impresso no cartão.');
        return;
      }
      if (!expMonth || !expYear) {
        alert('Por favor, informe a validade do cartão.');
        return;
      }
      if (!cvv || cvv.length < 3) {
        alert('Por favor, informe um CVV válido.');
        return;
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

    const result = matchesUnit && matchesGrade && matchesAge;
    
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

              {adminTab === 'waitlist' ? (
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
                            <th className="px-6 py-4 text-sm font-bold text-slate-700">Data</th>
                            <th className="px-6 py-4 text-sm font-bold text-slate-700">Aluno</th>
                            <th className="px-6 py-4 text-sm font-bold text-slate-700">Responsável</th>
                            <th className="px-6 py-4 text-sm font-bold text-slate-700">Turma</th>
                            <th className="px-6 py-4 text-sm font-bold text-slate-700">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {waitlist.length === 0 ? (
                            <tr>
                              <td colSpan={5} className="px-6 py-10 text-center text-slate-400 italic">
                                Nenhum registro na lista de espera.
                              </td>
                            </tr>
                          ) : (
                            waitlist.map((item) => (
                              <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                                <td className="px-6 py-4 text-sm text-slate-600">
                                  {new Date(item.created_at).toLocaleDateString()}
                                </td>
                                <td className="px-6 py-4">
                                  <div className="text-sm font-bold text-slate-900">{item.alunos?.nome_completo}</div>
                                  <div className="text-xs text-slate-500">{item.alunos?.serie_ano}</div>
                                </td>
                                <td className="px-6 py-4">
                                  <div className="text-sm text-slate-900">{item.responsaveis?.nome_completo}</div>
                                  <div className="text-xs text-slate-500">{item.responsaveis?.telefone}</div>
                                </td>
                                <td className="px-6 py-4">
                                  <div className="text-sm text-slate-900">{item.turma}</div>
                                  <div className="text-xs text-slate-500">{item.unidade}</div>
                                </td>
                                <td className="px-6 py-4">
                                  <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-bold uppercase">
                                    {item.status}
                                  </span>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
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
                          <button 
                            onClick={() => handleDeleteCoupon(coupon.id)}
                            className="absolute top-4 right-4 text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                          >
                            <Trash2 size={18} />
                          </button>
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
                          placeholder="Buscar responsável..." 
                          className="pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none w-full md:w-64"
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
                        {enrollments.filter(e => e.pagamentos[0]?.status === 'pendente').length}
                      </p>
                    </div>
                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                      <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">Conciliados (PIX/Cartão)</p>
                      <p className="text-3xl font-bold text-emerald-600">
                        {enrollments.filter(e => e.pagamentos[0]?.status === 'pago').length}
                      </p>
                    </div>
                  </div>

                  {/* Table */}
                  <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200">
                            <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Responsável</th>
                            <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Aluno</th>
                            <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Turma</th>
                            <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Método</th>
                            <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                            <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Ações</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {enrollments.length === 0 ? (
                            <tr>
                              <td colSpan={6} className="px-6 py-12 text-center text-slate-400 italic">
                                Nenhuma matrícula encontrada no banco de dados.
                              </td>
                            </tr>
                          ) : (
                            enrollments.map((enrollment, idx) => (
                              <React.Fragment key={idx}>
                                {enrollment.alunos.map((aluno, aIdx) => (
                                  aluno.matriculas.map((mat, mIdx) => (
                                    <tr key={`${idx}-${aIdx}-${mIdx}`} className="hover:bg-slate-50/50 transition-colors">
                                      <td className="px-6 py-4">
                                        <p className="font-semibold text-slate-900">{enrollment.nome_completo}</p>
                                        <p className="text-[10px] text-slate-400 uppercase">Responsável</p>
                                      </td>
                                      <td className="px-6 py-4">
                                        <p className="text-sm font-medium text-slate-700">{aluno.nome_completo}</p>
                                        <p className="text-[10px] text-slate-500 uppercase">{aluno.serie_ano?.replace('_', ' ')}</p>
                                      </td>
                                      <td className="px-6 py-4">
                                        <p className="text-sm font-bold text-emerald-600">{mat.turma}</p>
                                        <p className="text-[10px] text-slate-500 uppercase">{mat.unidade}</p>
                                        {mat.status && mat.status !== 'ativo' && (
                                          <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase mt-1 inline-block ${
                                            mat.status === 'transferido' ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'
                                          }`}>
                                            {mat.status}
                                          </span>
                                        )}
                                      </td>
                                      <td className="px-6 py-4">
                                        <div className="flex items-center gap-2">
                                          {enrollment.pagamentos[0]?.metodo_pagamento === 'pix' ? (
                                            <QrCode size={14} className="text-emerald-600" />
                                          ) : (
                                            <CreditCard size={14} className="text-purple-600" />
                                          )}
                                          <span className="text-xs font-medium capitalize">
                                            {enrollment.pagamentos[0]?.metodo_pagamento?.replace('_', ' ') || 'N/A'}
                                          </span>
                                        </div>
                                      </td>
                                      <td className="px-6 py-4">
                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                          enrollment.pagamentos[0]?.status === 'pago' 
                                            ? 'bg-emerald-100 text-emerald-800' 
                                            : 'bg-amber-100 text-amber-800'
                                        }`}>
                                          {enrollment.pagamentos[0]?.status === 'pago' ? 'Conciliado' : 'Pendente'}
                                        </span>
                                      </td>
                                      <td className="px-6 py-4 text-right">
                                        <button className="text-slate-400 hover:text-emerald-600 transition-colors">
                                          <ExternalLink size={16} />
                                        </button>
                                      </td>
                                    </tr>
                                  ))
                                ))}
                              </React.Fragment>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              ) : adminTab === 'finance' ? (
                <div className="space-y-6">
                  {/* Filters */}
                  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <h3 className="text-lg font-bold text-slate-900">Relatórios Financeiros</h3>
                      <div className="flex gap-2">
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
                        {(financeFilters.unidade || financeFilters.professor || financeFilters.search) && (
                          <button 
                            onClick={() => setFinanceFilters({...financeFilters, unidade: '', professor: '', search: ''})}
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
                          // If no filters, show all
                          if (!financeFilters.unidade && !financeFilters.professor && !financeFilters.search) return true;
                          
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

                          // If only search filter is active and it matched, we're good
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
                          .filter(p => p.status === 'pago')
                          .reduce((acc, curr) => acc + Number(curr.valor), 0);
                        
                        const totalPending = filteredPayments
                          .filter(p => p.status !== 'pago')
                          .reduce((acc, curr) => acc + Number(curr.valor), 0);

                        return (
                          <>
                            {financeFilters.view === 'summary' ? (
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                                  <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">Receita (Paga)</p>
                                  <p className="text-3xl font-bold text-emerald-600">
                                    R$ {totalPaid.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                  </p>
                                </div>
                                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                                  <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">Pendente</p>
                                  <p className="text-3xl font-bold text-amber-600">
                                    R$ {totalPending.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                  </p>
                                </div>
                                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                                  <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">Transações</p>
                                  <div className="flex items-baseline gap-2">
                                    <p className="text-3xl font-bold text-slate-900">{filteredPayments.length}</p>
                                    {filteredPayments.length !== financialData.pagamentos.length && (
                                      <p className="text-xs text-slate-400 font-medium">de {financialData.pagamentos.length}</p>
                                    )}
                                  </div>
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
                                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Estudante</th>
                                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Unidade</th>
                                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Turma</th>
                                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Valor</th>
                                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Método</th>
                                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                      {filteredPayments.length === 0 ? (
                                        <tr>
                                          <td colSpan={8} className="px-6 py-10 text-center text-slate-400 italic">
                                            Nenhum pagamento encontrado com os filtros selecionados.
                                          </td>
                                        </tr>
                                      ) : (
                                        filteredPayments.map((pag, idx) => {
                                          // Get the relevant student and enrollment info
                                          const studentsInfo = pag.responsaveis?.alunos?.flatMap((a: any) => {
                                            const filteredMatriculas = a.matriculas?.filter((m: any) => {
                                              if (m.data_cancelamento) return false;
                                              
                                              // CRITICAL: If the payment is linked to a specific enrollment, ONLY show that one
                                              if (pag.matricula_id && m.id !== pag.matricula_id) return false;

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
                                                {new Date(pag.data_vencimento || pag.created_at).toLocaleDateString()}
                                              </td>
                                              <td className="px-6 py-4">
                                                <p className="font-medium text-slate-900 text-sm">{pag.responsaveis?.nome_completo}</p>
                                              </td>
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
                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                                  pag.status === 'pago' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                                                }`}>
                                                  {pag.status === 'pago' ? 'Conciliado' : 'Pendente'}
                                                </span>
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
                                <li key={t.nome} className="group flex flex-col gap-2 text-sm text-slate-600 bg-slate-50 p-4 rounded-xl border border-slate-100 relative hover:border-emerald-200 hover:bg-emerald-50/30 transition-all">
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
                                  </div>
                                </div>
                              ))
                            ) : (
                              <p className="text-sm text-slate-400 italic text-center py-4">Nenhuma matrícula ativa.</p>
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
                                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${
                                      p.status === 'pago' ? 'bg-emerald-100 text-emerald-700' : 
                                      p.status === 'pendente' ? 'bg-amber-100 text-amber-700' : 
                                      'bg-red-100 text-red-700'
                                    }`}>
                                      {p.status}
                                    </span>
                                    {p.status === 'pendente' && (
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
                                  <button 
                                    onClick={() => alert('Download de boletos e recibos estará disponível em breve.')}
                                    className="text-emerald-600 hover:text-emerald-700 text-xs font-bold flex items-center gap-1"
                                  >
                                    <FileText size={14} /> Boleto/Recibo
                                  </button>
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
                        <p className="text-slate-500 font-medium py-2.5">{formData.guardian.cpf}</p>
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
              <AnimatePresence mode="wait">
                {step === 'guardian' && (
                  <motion.div
                    key="guardian"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8"
                  >
                    <div className="flex items-center gap-3 mb-8">
                      <div className="p-3 bg-emerald-50 rounded-xl">
                        <User className="text-emerald-600" size={24} />
                      </div>
                      <div>
                        <h2 className="text-2xl font-semibold">Dados do Responsável</h2>
                        <p className="text-slate-500 text-sm">Quem responderá financeiramente pela matrícula.</p>
                      </div>
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
                        <label className="text-sm font-medium text-slate-700">Responsável 1 <span className="text-red-500">*</span></label>
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
                                <option key={t.nome} value={t.nome}>
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
                              <React.Fragment key={t.nome}>
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
                        <h2 className="text-2xl font-semibold">Método de Pagamento</h2>
                        <p className="text-slate-500 text-sm">Escolha como deseja pagar as mensalidades recorrentes.</p>
                      </div>
                    </div>

                    <div className="space-y-4">
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
                    </div>

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
                          <React.Fragment key={t.nome}>
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
                    <p className="text-slate-600 mb-8 max-w-md mx-auto">
                      A turma selecionada está lotada no momento. Registramos seu interesse na lista de espera e entraremos em contato assim que surgir uma vaga.
                    </p>
                    <button 
                      onClick={() => {
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
                    
                    {paymentInfo && paymentInfo.charges && paymentInfo.charges[0] && paymentInfo.charges[0].last_transaction && paymentInfo.charges[0].last_transaction.transaction_type === 'pix' && (
                      <div className="mb-8 p-6 bg-emerald-50 rounded-2xl border border-emerald-100 max-w-sm mx-auto">
                        <p className="text-emerald-800 font-bold mb-4 uppercase text-sm tracking-wider">Pagamento via PIX</p>
                        <div className="bg-white p-4 rounded-xl shadow-sm mb-4 inline-block">
                          <img 
                            src={paymentInfo.charges[0].last_transaction.qr_code_url} 
                            alt="QR Code PIX" 
                            className="w-48 h-48 mx-auto"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                        <div className="space-y-3">
                          <p className="text-xs text-slate-500">Escaneie o QR Code acima ou copie o código abaixo:</p>
                          <div className="flex gap-2">
                            <input 
                              readOnly 
                              value={paymentInfo.charges[0].last_transaction.qr_code}
                              className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-mono truncate"
                            />
                            <button 
                              onClick={(e) => {
                                navigator.clipboard.writeText(paymentInfo.charges[0].last_transaction.qr_code);
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
                    )}

                    {(paymentInfo && paymentInfo.charges && paymentInfo.charges[0] && paymentInfo.charges[0].payment_method === 'credit_card') || (paymentInfo && paymentInfo.payment_method === 'credit_card') ? (
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
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
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
                      min={new Date().toISOString().split('T')[0]}
                      onChange={e => setCancellationDate(e.target.value)}
                    />
                  </div>
                  <p className="text-xs text-slate-500 bg-slate-50 p-3 rounded-lg border border-slate-100">
                    <strong>Atenção:</strong> Esta ação irá remover o aluno da turma selecionada a partir da data informada.
                  </p>
                </div>

                <div className="flex gap-3">
                  <button 
                    onClick={() => setIsCancelingEnrollment(false)}
                    className="flex-1 px-6 py-3 rounded-xl font-bold text-slate-600 hover:bg-slate-100 transition-all"
                  >
                    Voltar
                  </button>
                  <button 
                    onClick={confirmCancelEnrollment}
                    disabled={loading || !cancellationDate}
                    className="flex-1 bg-red-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-red-700 transition-all shadow-lg shadow-red-200 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {loading ? <RefreshCw size={18} className="animate-spin" /> : 'Confirmar'}
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
                  <h3 className="text-xl font-bold text-slate-900">Novo cupom</h3>
                  <button 
                    onClick={() => setIsAddingCoupon(false)}
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
                      onClick={() => setIsAddingCoupon(false)}
                      className="px-6 py-3 text-slate-600 font-bold hover:bg-slate-50 rounded-2xl transition-all"
                    >
                      Cancelar
                    </button>
                    <button 
                      type="submit"
                      disabled={loading}
                      className="px-8 py-3 bg-blue-600 text-white font-bold rounded-2xl hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all disabled:opacity-50"
                    >
                      {loading ? 'Criando...' : 'Criar cupom'}
                    </button>
                  </div>
                </form>
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
      </main>

      <footer className="max-w-6xl mx-auto py-12 px-6 text-center text-slate-400 text-sm">
        <p>© 2024 Sport for Kids. Todos os direitos reservados.</p>
        <p className="mt-2 flex items-center justify-center gap-1">
          <ShieldCheck size={14} /> Ambiente Seguro e Criptografado via Supabase
        </p>
      </footer>

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
    </div>
  );
}
