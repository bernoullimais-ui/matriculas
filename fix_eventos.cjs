const fs = require('fs');
const file = 'src/components/admin/courses/EventosTab.tsx';
let content = fs.readFileSync(file, 'utf8');

// Add import for loadData if not there
if (!content.includes('loadData } = useAdminStore();')) {
  content = content.replace(
    "const { eventos, setEventos, options } = useAdminStore();",
    "const { eventos, setEventos, options, loadData } = useAdminStore();"
  );
}

// Add handlers
const handlers = `
  const handleEditEvento = (evento) => {
    setEventoForm(evento);
    setSelectedId(evento.id);
    setIsEditing(true);
  };

  const handleDeleteEvento = async (id) => {
    if (!confirm('Deseja excluir este evento/curso?')) return;
    const token = sessionStorage.getItem('admin_token');
    const res = await fetch(\`/api/admin/cursos/eventos/\${id}\`, {
      method: 'DELETE',
      headers: { ...(token ? { 'Authorization': \`Bearer \${token}\` } : {}) }
    });
    if (res.ok) {
      toast.success('Excluído com sucesso!');
      loadData();
    } else {
      toast.error('Erro ao excluir');
    }
  };

  return (
`;

content = content.replace("  return (", handlers);

// Replace main content form with table
const mainContentMarker = "{/* MAIN CONTENT */}";
const splitContent = content.split(mainContentMarker);

if (splitContent.length > 1) {
  const tableContent = `
      {/* MAIN CONTENT */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-black text-slate-800 tracking-tight">Cursos e Eventos</h2>
        <button
          onClick={() => {
            setSelectedId(null);
            setEventoForm({
              titulo: '', slug: '', descricao: '', data_inicio: '', data_fim: '', prazo_inscricao: '',
              vagas_total: null, taxa_inscricao: 0, gratuito: false, status: 'ativo', local: '',
              unidade_nome: '', categorias_inscricao: [], apenas_alunos: false,
              tipo_preco: 'fixo', opcoes_precos: [], campos_personalizados: [], tipo: 'evento'
            });
            setIsEditing(true);
          }}
          className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-xl transition-all shadow-sm flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Novo Evento/Curso
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50">
              <th className="p-4 text-xs font-bold text-slate-500 uppercase">Título</th>
              <th className="p-4 text-xs font-bold text-slate-500 uppercase">Tipo</th>
              <th className="p-4 text-xs font-bold text-slate-500 uppercase">Data Início</th>
              <th className="p-4 text-xs font-bold text-slate-500 uppercase">Status</th>
              <th className="p-4 text-xs font-bold text-slate-500 uppercase text-center w-24">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {eventos.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-8 text-center text-slate-500 text-sm">
                  Nenhum evento ou curso cadastrado.
                </td>
              </tr>
            ) : (
              eventos.map((evento) => (
                <tr key={evento.id} className="hover:bg-slate-50">
                  <td className="p-4">
                    <p className="text-sm font-bold text-slate-800">{evento.titulo}</p>
                  </td>
                  <td className="p-4">
                    <span className="text-sm font-medium text-slate-600 capitalize">{evento.tipo}</span>
                  </td>
                  <td className="p-4">
                    <span className="text-sm font-medium text-slate-600">
                      {new Date(evento.data_inicio).toLocaleDateString('pt-BR')}
                    </span>
                  </td>
                  <td className="p-4">
                    <span className={\`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase \${
                      evento.status === 'ativo' ? 'bg-emerald-100 text-emerald-700' : 
                      evento.status === 'encerrado' ? 'bg-slate-100 text-slate-700' : 
                      'bg-amber-100 text-amber-700'
                    }\`}>
                      {evento.status}
                    </span>
                  </td>
                  <td className="p-4 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => handleEditEvento(evento)}
                        className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                        title="Editar"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteEvento(evento.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                        title="Excluir"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
`;
  
  content = splitContent[0] + tableContent;
}

fs.writeFileSync(file, content);
console.log("EventosTab updated!");
