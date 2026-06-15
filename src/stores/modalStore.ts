import { create } from 'zustand';

interface ModalState {
  // Cancel Modal
  cancelModal: { isOpen: boolean; enrollmentId: string | null; reason: string; date: string };
  setCancelModal: (state: Partial<ModalState['cancelModal']>) => void;

  // Freeze Modal
  freezeModal: { isOpen: boolean; enrollmentId: string | null; startDate: string; endDate: string };
  setFreezeModal: (state: Partial<ModalState['freezeModal']>) => void;

  // Edit Student Modal
  editStudentModal: { isOpen: boolean; studentId: string | null; nome_completo: string; unidade_origem_id: string };
  setEditStudentModal: (state: Partial<ModalState['editStudentModal']>) => void;

  // Transfer Modal
  transferModal: { isOpen: boolean; enrollmentId: string | null; targetTurma: string; targetUnidade: string };
  setTransferModal: (state: Partial<ModalState['transferModal']>) => void;

  // Detail Modal
  detailModal: { isOpen: boolean; enrollment: any | null };
  setDetailModal: (state: Partial<ModalState['detailModal']>) => void;

  // Refund Payment Modal
  refundPaymentModal: { isOpen: boolean; paymentId: string; amount: string; isTotal: boolean };
  setRefundPaymentModal: (state: Partial<ModalState['refundPaymentModal']>) => void;

  // Update Payment Modal
  updatePaymentModal: { isOpen: boolean; paymentId: string; currentAmount: number; newValue: string; updateFuture: boolean };
  setUpdatePaymentModal: (state: Partial<ModalState['updatePaymentModal']>) => void;

  // Cancel Payment Modal
  cancelPaymentModal: { isOpen: boolean; paymentId: string };
  setCancelPaymentModal: (state: Partial<ModalState['cancelPaymentModal']>) => void;
}

export const useModalStore = create<ModalState>((set) => ({
  cancelModal: { isOpen: false, enrollmentId: null, reason: '', date: '' },
  setCancelModal: (state) => set((prev) => ({ cancelModal: { ...prev.cancelModal, ...state } })),

  freezeModal: { isOpen: false, enrollmentId: null, startDate: '', endDate: '' },
  setFreezeModal: (state) => set((prev) => ({ freezeModal: { ...prev.freezeModal, ...state } })),

  editStudentModal: { isOpen: false, studentId: null, nome_completo: '', unidade_origem_id: '' },
  setEditStudentModal: (state) => set((prev) => ({ editStudentModal: { ...prev.editStudentModal, ...state } })),

  transferModal: { isOpen: false, enrollmentId: null, targetTurma: '', targetUnidade: '' },
  setTransferModal: (state) => set((prev) => ({ transferModal: { ...prev.transferModal, ...state } })),

  detailModal: { isOpen: false, enrollment: null },
  setDetailModal: (state) => set((prev) => ({ detailModal: { ...prev.detailModal, ...state } })),

  refundPaymentModal: { isOpen: false, paymentId: '', amount: '', isTotal: true },
  setRefundPaymentModal: (state) => set((prev) => ({ refundPaymentModal: { ...prev.refundPaymentModal, ...state } })),

  updatePaymentModal: { isOpen: false, paymentId: '', currentAmount: 0, newValue: '', updateFuture: false },
  setUpdatePaymentModal: (state) => set((prev) => ({ updatePaymentModal: { ...prev.updatePaymentModal, ...state } })),

  cancelPaymentModal: { isOpen: false, paymentId: '' },
  setCancelPaymentModal: (state) => set((prev) => ({ cancelPaymentModal: { ...prev.cancelPaymentModal, ...state } })),
}));
