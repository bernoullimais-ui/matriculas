import { create } from 'zustand';

interface Options {
  series: any[];
  unidades: any[];
  turmas: any[];
  professores: any[];
  parceiros: any[];
}

interface AdminStoreState {
  // Navigation
  tab: string;
  setTab: (tab: string) => void;
  
  // Data
  options: Options;
  setOptions: (options: Options) => void;
  
  financialData: any;
  setFinancialData: (data: any) => void;

  // Ecommerce Data
  produtos: any[];
  setProdutos: (produtos: any[]) => void;
  categorias: any[];
  setCategorias: (categorias: any[]) => void;
  pedidos: any[];
  setPedidos: (pedidos: any[]) => void;

  // Courses & Events Data
  eventos: any[];
  setEventos: (eventos: any[]) => void;
  inscricoes: any[];
  setInscricoes: (inscricoes: any[]) => void;
  cupons: any[];
  setCupons: (cupons: any[]) => void;
  cuponsDeMatriculas: any[];
  setCuponsDeMatriculas: (cupons: any[]) => void;

  // CRM Data
  tasks: any[];
  setTasks: (tasks: any[]) => void;
  waitlist: any[];
  setWaitlist: (waitlist: any[]) => void;
  enrollments: any[];
  setEnrollments: (enrollments: any[]) => void;
  leads: any[];
  setLeads: (leads: any[]) => void;

  // Settings
  termsTemplate: string;
  setTermsTemplate: (terms: string) => void;
  pixKey: string;
  setPixKey: (key: string) => void;
  logoUrl: string;
  setLogoUrl: (url: string) => void;

  // Global loading
  loading: boolean;
  setLoading: (loading: boolean) => void;
  loadData: () => Promise<void>;
}

export const useAdminStore = create<AdminStoreState>((set, get) => ({
  // Navigation
  tab: 'dashboard',
  setTab: (tab) => set({ tab }),

  loadData: async () => {
    try {
      const token = sessionStorage.getItem('admin_token');
      const headers = { 'Authorization': `Bearer ${token}` };
      const [
        optRes, tskRes, enrRes, wtlRes, leadsRes,
        prodRes, catRes, pedRes, evRes, insRes, 
        cupRes, cupMatRes
      ] = await Promise.all([
        fetch('/api/options', { headers }),
        fetch('/api/tasks', { headers }),
        fetch('/api/enrollments', { headers }),
        fetch('/api/waitlist', { headers }),
        fetch('/api/admin/leads', { headers }),
        fetch('/api/admin/loja/produtos', { headers }),
        fetch('/api/admin/loja/categorias', { headers }),
        fetch('/api/admin/loja/pedidos?all=true', { headers }),
        fetch('/api/admin/eventos', { headers }),
        fetch('/api/admin/eventos/inscricoes', { headers }),
        fetch('/api/admin/cupons', { headers }),
        fetch('/api/coupons', { headers })
      ]);
      
      set({
        options: optRes.ok ? await optRes.json() : get().options,
        tasks: tskRes.ok ? await tskRes.json() : get().tasks,
        enrollments: enrRes.ok ? await enrRes.json() : get().enrollments,
        waitlist: wtlRes.ok ? await wtlRes.json() : get().waitlist,
        leads: leadsRes.ok ? await leadsRes.json() : get().leads,
        produtos: prodRes.ok ? await prodRes.json() : get().produtos,
        categorias: catRes.ok ? await catRes.json() : get().categorias,
        pedidos: pedRes.ok ? await pedRes.json() : get().pedidos,
        eventos: evRes.ok ? await evRes.json() : get().eventos,
        inscricoes: insRes.ok ? await insRes.json() : get().inscricoes,
        cupons: cupRes.ok ? await cupRes.json() : get().cupons,
        cuponsDeMatriculas: cupMatRes.ok ? await cupMatRes.json() : get().cuponsDeMatriculas
      });
    } catch (error) {
      console.error('Error loading admin data:', error);
    }
  },

  // Data
  options: { series: [], unidades: [], turmas: [], professores: [], parceiros: [] },
  setOptions: (options) => set({ options }),
  
  financialData: null,
  setFinancialData: (financialData) => set({ financialData }),

  // Ecommerce Data
  produtos: [],
  setProdutos: (produtos) => set({ produtos }),
  categorias: [],
  setCategorias: (categorias) => set({ categorias }),
  pedidos: [],
  setPedidos: (pedidos) => set({ pedidos }),

  // Courses & Events Data
  eventos: [],
  setEventos: (eventos) => set({ eventos }),
  inscricoes: [],
  setInscricoes: (inscricoes) => set({ inscricoes }),
  cupons: [],
  setCupons: (cupons) => set({ cupons }),
  cuponsDeMatriculas: [],
  setCuponsDeMatriculas: (cuponsDeMatriculas) => set({ cuponsDeMatriculas }),

  // CRM Data
  tasks: [],
  setTasks: (tasks) => set({ tasks }),
  waitlist: [],
  setWaitlist: (waitlist) => set({ waitlist }),
  enrollments: [],
  setEnrollments: (enrollments) => set({ enrollments }),
  leads: [],
  setLeads: (leads) => set({ leads }),

  // Settings
  termsTemplate: '',
  setTermsTemplate: (termsTemplate) => set({ termsTemplate }),
  pixKey: '',
  setPixKey: (pixKey) => set({ pixKey }),
  logoUrl: '',
  setLogoUrl: (logoUrl) => set({ logoUrl }),

  // Global loading
  loading: false,
  setLoading: (loading) => set({ loading }),
}));
