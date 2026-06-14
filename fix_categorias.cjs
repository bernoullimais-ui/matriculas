const fs = require('fs');
const file = 'src/components/admin/ecommerce/CategoriasTab.tsx';
let content = fs.readFileSync(file, 'utf8');

// Add import for loadData
content = content.replace(
  "const { categorias, setCategorias, loading, setLoading } = useAdminStore();",
  "const { categorias, setCategorias, loading, setLoading, loadData } = useAdminStore();"
);

// Add handlers before return
const handlers = `
  const handleEditCategoria = (categoria: Categoria) => {
    setCategoriaForm(categoria);
    setSelectedId(categoria.id);
    setIsEditing(true);
  };

  const handleDeleteCategoria = async (id: string) => {
    if (!confirm('Deseja excluir esta categoria?')) return;
    const token = sessionStorage.getItem('admin_token');
    const res = await fetch(\`/api/admin/loja/categorias/\${id}\`, {
      method: 'DELETE',
      headers: { ...(token ? { 'Authorization': \`Bearer \${token}\` } : {}) }
    });
    if (res.ok) {
      toast.success('Categoria excluída!');
      loadData();
    } else {
      toast.error('Erro ao excluir categoria');
    }
  };

  return (
`;

content = content.replace("  return (", handlers);

// Replace the main content form with table
const mainContentMarker = "{/* MAIN CONTENT */}";
const splitContent = content.split(mainContentMarker);

if (splitContent.length > 1) {
  const tableContent = `
      {/* MAIN CONTENT */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-black text-slate-800 tracking-tight">Categorias</h2>
        <button
          onClick={() => {
            setSelectedId(null);
            setCategoriaForm({ nome: '', slug: '', descricao: '', ordem: 0 });
            setIsEditing(true);
          }}
          className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-xl transition-all shadow-sm flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Nova Categoria
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50">
              <th className="p-4 text-xs font-bold text-slate-500 uppercase">Categoria</th>
              <th className="p-4 text-xs font-bold text-slate-500 uppercase">Slug</th>
              <th className="p-4 text-xs font-bold text-slate-500 uppercase text-center w-24">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {categorias.length === 0 ? (
              <tr>
                <td colSpan={3} className="p-8 text-center text-slate-500 text-sm">
                  Nenhuma categoria cadastrada.
                </td>
              </tr>
            ) : (
              categorias.map((categoria) => (
                <tr key={categoria.id} className="hover:bg-slate-50">
                  <td className="p-4">
                    <p className="text-sm font-bold text-slate-800">{categoria.nome}</p>
                    <p className="text-xs text-slate-500">{categoria.descricao}</p>
                  </td>
                  <td className="p-4">
                    <span className="text-sm font-medium text-slate-600">{categoria.slug}</span>
                  </td>
                  <td className="p-4 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => handleEditCategoria(categoria)}
                        className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                        title="Editar"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteCategoria(categoria.id)}
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
console.log("CategoriasTab updated!");
