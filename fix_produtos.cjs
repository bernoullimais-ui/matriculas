const fs = require('fs');
const file = 'src/components/admin/ecommerce/ProdutosTab.tsx';
let content = fs.readFileSync(file, 'utf8');

// Add import for loadData if not there
if (!content.includes('loadData } = useAdminStore();')) {
  content = content.replace(
    "const { produtos, setProdutos, categorias, loading, setLoading } = useAdminStore();",
    "const { produtos, setProdutos, categorias, loading, setLoading, loadData } = useAdminStore();"
  );
}

// Add handlers
const handlers = `
  const handleEditProduto = (produto) => {
    setProdutoForm(produto);
    setSelectedId(produto.id);
    setImagensInputText(produto.imagens?.join(', ') || '');
    setKitItens(produto.kit_itens || []);
    setIsEditing(true);
  };

  const handleDeleteProduto = async (id) => {
    if (!confirm('Deseja excluir este produto?')) return;
    const token = sessionStorage.getItem('admin_token');
    const res = await fetch(\`/api/admin/loja/produtos/\${id}\`, {
      method: 'DELETE',
      headers: { ...(token ? { 'Authorization': \`Bearer \${token}\` } : {}) }
    });
    if (res.ok) {
      toast.success('Produto excluído!');
      loadData();
    } else {
      toast.error('Erro ao excluir produto');
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
        <h2 className="text-2xl font-black text-slate-800 tracking-tight">Produtos</h2>
        <button
          onClick={() => {
            setSelectedId(null);
            setProdutoForm({
              nome: '', slug: '', descricao: '', categoria_id: '',
              imagens: [], preco: 0, estoque_por_variante: {}, is_destaque: false,
              is_kit: false, kit_itens: [], variantes: []
            });
            setImagensInputText('');
            setVariantTypeInput('');
            setVariantOptionsInput('');
            setKitItens([]);
            setIsEditing(true);
          }}
          className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-xl transition-all shadow-sm flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Novo Produto
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50">
              <th className="p-4 text-xs font-bold text-slate-500 uppercase">Produto</th>
              <th className="p-4 text-xs font-bold text-slate-500 uppercase">Preço</th>
              <th className="p-4 text-xs font-bold text-slate-500 uppercase">Status</th>
              <th className="p-4 text-xs font-bold text-slate-500 uppercase text-center w-24">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {produtos.length === 0 ? (
              <tr>
                <td colSpan={4} className="p-8 text-center text-slate-500 text-sm">
                  Nenhum produto cadastrado.
                </td>
              </tr>
            ) : (
              produtos.map((produto) => (
                <tr key={produto.id} className="hover:bg-slate-50">
                  <td className="p-4">
                    <p className="text-sm font-bold text-slate-800">{produto.nome}</p>
                    {produto.is_kit && <span className="inline-flex items-center px-2 py-0.5 mt-1 rounded text-[10px] font-bold bg-indigo-100 text-indigo-700">KIT</span>}
                  </td>
                  <td className="p-4">
                    <span className="text-sm font-medium text-slate-600">
                      R$ {Number(produto.preco).toFixed(2).replace('.', ',')}
                    </span>
                    {produto.preco_promocional && (
                      <span className="ml-2 text-xs text-rose-500 line-through">
                        R$ {Number(produto.preco_promocional).toFixed(2).replace('.', ',')}
                      </span>
                    )}
                  </td>
                  <td className="p-4">
                     {produto.is_destaque && <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-700">DESTAQUE</span>}
                  </td>
                  <td className="p-4 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => handleEditProduto(produto)}
                        className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                        title="Editar"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteProduto(produto.id)}
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
console.log("ProdutosTab updated!");
