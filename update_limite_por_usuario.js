const fs = require('fs');
const path = 'src/pages/Admin/UnifiedAdmin.tsx';
let content = fs.readFileSync(path, 'utf8');

// Update initial state
content = content.replace(
  "produto_id: '', evento_id: '', limite_total_uso: '', limite_por_usuario: '1', validade: ''",
  "produto_id: '', evento_id: '', limite_total_uso: '', limite_por_usuario: '', validade: ''"
);

content = content.replace(
  "limite_por_usuario: '1',",
  "limite_por_usuario: '',"
);

// Add the input field next to limite_total_uso
const findBlock1 = `<div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Limite de Uso Global</label>
                            <input type="number" min={1} placeholder="Sem limite" value={cupomForm.limite_total_uso} onChange={e => setCupomForm({ ...cupomForm, limite_total_uso: e.target.value })} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Validade</label>`;
                            
const replaceBlock1 = `<div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Limite de Uso Global</label>
                            <input type="number" min={1} placeholder="Sem limite" value={cupomForm.limite_total_uso} onChange={e => setCupomForm({ ...cupomForm, limite_total_uso: e.target.value })} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Limite por Usuário</label>
                            <input type="number" min={1} placeholder="Sem limite" value={cupomForm.limite_por_usuario} onChange={e => setCupomForm({ ...cupomForm, limite_por_usuario: e.target.value })} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Validade</label>`;

content = content.split(findBlock1).join(replaceBlock1);

fs.writeFileSync(path, content);
console.log('Done!');
