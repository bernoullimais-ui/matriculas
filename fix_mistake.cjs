const fs = require('fs');
const file = 'src/components/admin/courses/EventosTab.tsx';
let content = fs.readFileSync(file, 'utf8');

// Undo the wrong replacement
content = content.replace(
  `                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Tipo</label>
                        <select required value={eventoForm.tipo_preco || 'fixo'} onChange={e => setEventoForm({ ...eventoForm, tipo_preco: e.target.value as any })} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none">
                          <option value="fixo">Preço Único</option>
                          <option value="por_categoria">Preços Diferentes por Categoria</option>
                          <option value="gratuito">Gratuito</option>
                        </select>`,
  `                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Tipo</label>
                      <select required value={eventoForm.tipo || 'evento'} onChange={e => setEventoForm({ ...eventoForm, tipo: e.target.value as any })} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none text-slate-700">
                        <option value="evento">Evento Geral</option>
                        <option value="competicao">Competição / Torneio</option>
                        <option value="apresentacao">Apresentação / Festival</option>
                        <option value="workshop">Workshop / Clínica</option>
                      </select>`
);

// Do the correct replacement
content = content.replace(
  `                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Modelo de Cobrança</label>
                      <select required value={eventoForm.tipo_preco || 'fixo'} onChange={e => setEventoForm({ ...eventoForm, tipo_preco: e.target.value as any })} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none">
                        <option value="fixo">Preço Único</option>
                        <option value="categorias">Preços Diferentes por Categoria</option>
                        <option value="gratuito">Gratuito</option>
                      </select>`,
  `                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Modelo de Cobrança</label>
                      <select required value={eventoForm.tipo_preco || 'fixo'} onChange={e => setEventoForm({ ...eventoForm, tipo_preco: e.target.value as any })} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none">
                        <option value="fixo">Preço Único</option>
                        <option value="por_categoria">Preços Diferentes por Categoria</option>
                        <option value="gratuito">Gratuito</option>
                      </select>`
);

fs.writeFileSync(file, content);
console.log("Mistake fixed!");
