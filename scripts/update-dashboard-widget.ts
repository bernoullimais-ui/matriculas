import fs from 'fs';

let content = fs.readFileSync('../gestão-sfk-4.0/components/Dashboard.tsx', 'utf-8');

// Update Props
content = content.replace(
  /experimentais\?:\s*AulaExperimental\[\];/,
  'experimentais?: AulaExperimental[];\n  tarefas?: any[];'
);

// Update Dashboard signature
content = content.replace(
  /experimentais\s*=\s*\[\],/,
  'experimentais = [],\n  tarefas = [],'
);

const widgetHtml = `
      {/* Widget de Tarefas / Solicitações Pendentes (Matrícula Online) */}
      {user.nivel === 'Gestor Master' && tarefas.filter((t: any) => t.status === 'pendente').length > 0 && (
        <div className="bg-indigo-50 border-2 border-indigo-100 rounded-[40px] p-8 space-y-6 shadow-xl shadow-indigo-100/50 mb-8 mt-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center gap-6">
              <div className="w-16 h-16 bg-indigo-600 rounded-[24px] flex items-center justify-center text-white shadow-lg shadow-indigo-200">
                <AlertTriangle className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-xl font-black text-indigo-900 uppercase tracking-tight">Solicitações Matrícula Online</h3>
                <p className="text-indigo-600 font-bold text-sm">
                  Existem {tarefas.filter((t: any) => t.status === 'pendente').length} solicitações (cancelamento/transferência) enviadas pelos responsáveis aguardando revisão.
                </p>
              </div>
            </div>
            <button 
              onClick={() => {
                alert('Módulo de revisão de tarefas será integrado em breve! Verifique o painel da Matrícula Online para processar.');
              }}
              className="px-8 py-4 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 flex items-center gap-3"
            >
              <ExternalLink className="w-4 h-4" />
              Revisar Solicitações
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {tarefas.filter((t: any) => t.status === 'pendente').slice(0, 3).map((tarefa: any, idx: number) => (
              <div key={idx} className="bg-white p-5 rounded-3xl border border-indigo-100 space-y-3 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-black text-slate-800 uppercase truncate pr-2">{tarefa.alunos?.nome_completo || 'Aluno não identificado'}</p>
                  <span className="text-[8px] font-black bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-full uppercase">{tarefa.tipo}</span>
                </div>
                <div className="text-[10px] text-slate-500 font-medium">
                  {new Date(tarefa.created_at).toLocaleDateString('pt-BR')} - {tarefa.detalhes?.justificativa || 'Sem justificativa'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
`;

// Insert the widget before the Dashboard return jsx. The safest place is right after the Painel de Performance heading
content = content.replace(
  /{isPrivilegedUser && pendingCancellationsToSync.length > 0 && \(/,
  widgetHtml.trim() + '\n\n      {/* Alerta de Cancelamentos Pendentes de Sincronização - Apenas Master */}\n      {isPrivilegedUser && pendingCancellationsToSync.length > 0 && ('
);

// I need to import ExternalLink if it's not imported.
if (!content.includes('ExternalLink')) {
  content = content.replace(
    /AlertTriangle,/,
    'AlertTriangle,\n    ExternalLink,'
  );
}

fs.writeFileSync('../gestão-sfk-4.0/components/Dashboard.tsx', content);
console.log('Dashboard.tsx updated!');
