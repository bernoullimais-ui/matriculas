import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CalendarDays } from 'lucide-react';
import toast from 'react-hot-toast';

interface TrialModalProps {
  isOpen: boolean;
  onClose: () => void;
  guardian: any;
  setGuardian: (g: any) => void;
  unidades: any[];
  turmas: any[];
  series: string[];
  initialUnidade?: string;
  initialTurma?: string;
}

export default function TrialModal({ 
  isOpen, 
  onClose, 
  guardian, 
  setGuardian, 
  unidades, 
  turmas, 
  series,
  initialUnidade = '',
  initialTurma = ''
}: TrialModalProps) {
  const [selectedAlunoId, setSelectedAlunoId] = useState<string>('');
  const [newStudentData, setNewStudentData] = useState({
    name: '',
    birthDate: '',
    grade: '',
    gender: 'Masculino'
  });
  const [bookingData, setBookingData] = useState({
    unidade: initialUnidade,
    turma: initialTurma,
    dataAula: '',
    observacoes: ''
  });
  const [submittingTrial, setSubmittingTrial] = useState(false);

  // Initialize selected student
  React.useEffect(() => {
    if (isOpen && guardian && guardian.alunos && guardian.alunos.length > 0 && !selectedAlunoId) {
      setSelectedAlunoId(guardian.alunos[0].aluno_id || guardian.alunos[0].id);
    } else if (isOpen && (!guardian?.alunos || guardian.alunos.length === 0) && !selectedAlunoId) {
      setSelectedAlunoId('novo');
    }
  }, [isOpen, guardian, selectedAlunoId]);

  // Update initial booking data if props change while opening
  React.useEffect(() => {
    if (isOpen) {
      setBookingData(prev => ({
        ...prev,
        unidade: initialUnidade || prev.unidade,
        turma: initialTurma || prev.turma
      }));
    }
  }, [isOpen, initialUnidade, initialTurma]);

  const uniqueStudents = useMemo(() => {
    if (!guardian?.alunos) return [];
    const seen = new Set();
    const list: any[] = [];
    guardian.alunos.forEach((aluno: any) => {
      const studentId = aluno.aluno_id || aluno.id;
      if (!seen.has(studentId)) {
        seen.add(studentId);
        list.push({
          realId: studentId,
          nome_completo: aluno.nome_completo || aluno.nome,
        });
      }
    });
    return list;
  }, [guardian]);

  const handleAlunoChange = (alunoId: string) => {
    setSelectedAlunoId(alunoId);
    if (alunoId !== 'novo') {
      const student = guardian?.alunos?.find((a: any) => (a.aluno_id || a.id) === alunoId);
      if (student) {
        setNewStudentData({
          name: student.nome_completo || student.nome,
          birthDate: student.data_nascimento ? student.data_nascimento.split('T')[0] : '',
          grade: student.serie_ano || '',
          gender: 'Masculino'
        });
      }
    } else {
      setNewStudentData({
        name: '',
        birthDate: '',
        grade: '',
        gender: 'Masculino'
      });
    }
  };

  const eligibleTurmas = useMemo(() => {
    if (!bookingData.unidade) return [];
    
    let birthDate = '';
    let grade = '';
    
    if (selectedAlunoId === 'novo' || !selectedAlunoId) {
      birthDate = newStudentData.birthDate;
      grade = newStudentData.grade;
    } else {
      const student = guardian?.alunos?.find((a: any) => (a.aluno_id || a.id) === selectedAlunoId);
      if (student) {
        birthDate = student.data_nascimento;
        grade = student.serie_ano;
      }
    }

    const sUnit = bookingData.unidade.trim().toLowerCase();
    
    return turmas.filter(t => {
      const tUnit = (t.unidade_nome || t.unidade || t.unidade_atendimento || "").trim().toLowerCase();
      const sharedUnits = (t.unidades_selecionadas || []).map((u: string) => u.trim().toLowerCase());
      if (tUnit !== sUnit && !sharedUnits.includes(sUnit)) return false;
      if ((t.status || 'ativo').toLowerCase() !== 'ativo') return false;
      
      const seriesData = t.series_permitidas || t.series;
      const hasSeriesDefined = (Array.isArray(seriesData) && seriesData.length > 0) || (typeof seriesData === 'string' && seriesData.length > 0);
      const matchesGrade = !hasSeriesDefined || 
        (grade && Array.isArray(seriesData) && seriesData.includes(grade)) ||
        (grade && typeof seriesData === 'string' && seriesData.split(',').map((s: string) => s.trim()).includes(grade));
        
      if (!matchesGrade) return false;
      
      let matchesAge = true;
      if (birthDate && t.idade_minima != null && t.idade_maxima != null) {
        if (t.idade_minima === 0 && t.idade_maxima === 0) {
          matchesAge = true;
        } else {
          const bDate = new Date(birthDate);
          const today = new Date();
          let age = today.getFullYear() - bDate.getFullYear();
          const m = today.getMonth() - bDate.getMonth();
          if (m < 0 || (m === 0 && today.getDate() < bDate.getDate())) {
            age--;
          }
          matchesAge = age >= t.idade_minima && age <= t.idade_maxima;
        }
      }
      
      return matchesAge;
    });
  }, [bookingData.unidade, selectedAlunoId, newStudentData.birthDate, newStudentData.grade, guardian, turmas]);

  const handleScheduleTrial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bookingData.unidade || !bookingData.turma || !bookingData.dataAula) {
      toast.error('Preencha todos os campos do agendamento.');
      return;
    }

    if (selectedAlunoId === 'novo') {
      if (!newStudentData.name.trim() || !newStudentData.birthDate || !newStudentData.grade) {
        toast.error('Preencha todos os dados do aluno.');
        return;
      }
    }

    setSubmittingTrial(true);
    try {
      const payload = {
        guardianId: guardian.id,
        alunoId: selectedAlunoId,
        studentData: selectedAlunoId === 'novo' ? newStudentData : null,
        bookingData: bookingData
      };

      const res = await fetch('/api/portal/aulas-experimentais/agendar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || 'Erro ao realizar agendamento.');

      const updatedGuardian = { ...guardian, alunos: resData.alunos };
      setGuardian(updatedGuardian);
      localStorage.setItem('guardian', JSON.stringify(updatedGuardian));

      toast.success('Aula Experimental agendada com sucesso!');
      
      onClose();
      setBookingData({
        unidade: initialUnidade || '',
        turma: initialTurma || '',
        dataAula: '',
        observacoes: ''
      });
    } catch (err: any) {
      toast.error(err.message || 'Erro ao agendar aula.');
    } finally {
      setSubmittingTrial(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-[999] animate-fadeIn">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-white rounded-3xl shadow-2xl p-6 md:p-8 max-w-lg w-full max-h-[90vh] overflow-y-auto border border-slate-100 relative"
          >
            <button
              onClick={onClose}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 font-bold text-2xl w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-50 transition-all"
            >
              &times;
            </button>

            <div className="mb-6 flex items-center gap-3">
              <div className="p-2.5 bg-emerald-50 rounded-2xl text-emerald-600">
                <CalendarDays size={22} />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900">Agendar Aula Experimental</h3>
                <p className="text-slate-500 text-xs mt-0.5">Preencha os dados abaixo para reservar o horário.</p>
              </div>
            </div>

            <form onSubmit={handleScheduleTrial} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Selecionar Aluno</label>
                <select
                  value={selectedAlunoId}
                  onChange={(e) => handleAlunoChange(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:ring-2 focus:ring-emerald-500 outline-none"
                >
                  {uniqueStudents.map((aluno: any) => (
                    <option key={aluno.realId} value={aluno.realId}>{aluno.nome_completo}</option>
                  ))}
                  <option value="novo">Cadastrar Novo Aluno</option>
                </select>
              </div>

              {selectedAlunoId === 'novo' && (
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/60 space-y-3 animate-fadeIn">
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Dados do Novo Aluno</h4>
                  
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Nome Completo</label>
                    <input
                      type="text"
                      required
                      placeholder="Nome do seu filho(a)"
                      value={newStudentData.name}
                      onChange={(e) => setNewStudentData({ ...newStudentData, name: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Nascimento</label>
                      <input
                        type="date"
                        required
                        value={newStudentData.birthDate}
                        onChange={(e) => setNewStudentData({ ...newStudentData, birthDate: e.target.value })}
                        className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Série / Ano Escolar</label>
                      <select
                        value={newStudentData.grade}
                        onChange={(e) => setNewStudentData({ ...newStudentData, grade: e.target.value })}
                        className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 outline-none font-medium"
                        required
                      >
                        <option value="">Selecione...</option>
                        {series.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Unidade de Preferência</label>
                <select
                  required
                  value={bookingData.unidade}
                  onChange={(e) => setBookingData({ ...bookingData, unidade: e.target.value, turma: '' })}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:ring-2 focus:ring-emerald-500 outline-none"
                >
                  <option value="">Selecione a Unidade...</option>
                  {unidades.map(u => {
                    const name = typeof u === 'object' && u ? u.nome : u;
                    return <option key={name} value={name}>{name}</option>;
                  })}
                </select>
                {(() => {
                  const selectedUnitObj = unidades.find(u => (typeof u === 'object' && u ? u.nome : u) === bookingData.unidade);
                  if (!selectedUnitObj || typeof selectedUnitObj !== 'object') return null;
                  return (
                    <div className="mt-3 p-3 bg-slate-50 rounded-2xl border border-slate-200/60 flex items-center gap-3 animate-fadeIn">
                      {selectedUnitObj.imagem_url && (
                        <img src={selectedUnitObj.imagem_url} alt="Banner" className="w-16 h-12 object-cover rounded-lg border border-slate-100 bg-white" />
                      )}
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-slate-800 text-[11px] truncate">{selectedUnitObj.nome}</h4>
                        {selectedUnitObj.parceria && (
                          <div className="mt-0.5 flex items-center gap-1.5">
                            <span className="text-[9px] text-slate-500 font-medium">Parceiro: <strong>{selectedUnitObj.parceria}</strong></span>
                            {selectedUnitObj.logo_parceiro_url && (
                              <img src={selectedUnitObj.logo_parceiro_url} alt="Parceiro" className="h-3 object-contain" />
                            )}
                          </div>
                        )}
                      </div>
                      {selectedUnitObj.logo_url && (
                        <img src={selectedUnitObj.logo_url} alt="Logo" className="w-8 h-8 object-contain bg-white rounded-lg p-0.5 border border-slate-100" />
                      )}
                    </div>
                  );
                })()}
              </div>

              {bookingData.unidade && (
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Turma / Modalidade Disponível</label>
                  <select
                    required
                    value={bookingData.turma}
                    onChange={(e) => setBookingData({ ...bookingData, turma: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:ring-2 focus:ring-emerald-500 outline-none"
                  >
                    <option value="">Selecione a Turma...</option>
                    {eligibleTurmas.map((t: any) => (
                      <option key={t.id} value={t.nome}>{t.nome} ({t.dias_horarios})</option>
                    ))}
                  </select>
                  {(() => {
                    const selectedTurmaObj = eligibleTurmas.find(t => t.nome === bookingData.turma);
                    if (!selectedTurmaObj) return null;
                    return (
                      <div className="mt-3 p-3 bg-emerald-50/50 rounded-2xl border border-emerald-100/60 flex gap-3 animate-fadeIn">
                        {selectedTurmaObj.imagem_url && (
                          <img src={selectedTurmaObj.imagem_url} alt={selectedTurmaObj.nome} className="w-16 h-12 object-cover rounded-lg border border-emerald-100" />
                        )}
                        <div className="flex-1 min-w-0 space-y-0.5">
                          <h4 className="font-bold text-slate-800 text-[11px]">{selectedTurmaObj.nome}</h4>
                          {selectedTurmaObj.descricao && (
                            <p className="text-[10px] text-slate-600 leading-relaxed">{selectedTurmaObj.descricao}</p>
                          )}
                          {selectedTurmaObj.professor && (
                            <div className="flex items-center gap-1.5 mt-1">
                              {selectedTurmaObj.foto_professor_url ? (
                                <img src={selectedTurmaObj.foto_professor_url} alt={selectedTurmaObj.professor} className="w-4 h-4 rounded-full object-cover border" />
                              ) : (
                                <div className="w-4 h-4 rounded-full bg-slate-200 flex items-center justify-center text-[8px] text-slate-500 font-bold">P</div>
                              )}
                              <span className="text-[10px] text-slate-500">Professor(a): <strong>{selectedTurmaObj.professor}</strong></span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                  {eligibleTurmas.length === 0 && (
                    <p className="text-[10px] text-red-500 font-bold mt-1.5">Nenhuma turma elegível encontrada para esta idade/série nesta unidade.</p>
                  )}
                </div>
              )}

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Data da Aula Experimental</label>
                <input
                  type="date"
                  required
                  value={bookingData.dataAula}
                  onChange={(e) => setBookingData({ ...bookingData, dataAula: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Observações / Informações Adicionais</label>
                <textarea
                  placeholder="Ex: Preferência por horários específicos ou histórico esportivo..."
                  value={bookingData.observacoes}
                  onChange={(e) => setBookingData({ ...bookingData, observacoes: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 h-20 resize-none focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={submittingTrial || (bookingData.unidade && eligibleTurmas.length === 0)}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-2xl font-bold transition-all shadow-lg shadow-emerald-100 mt-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submittingTrial ? 'Reservando Aula...' : 'Agendar Aula Experimental'}
              </button>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
