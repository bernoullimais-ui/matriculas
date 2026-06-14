const fs = require('fs');
let code = fs.readFileSync('src/pages/Admin/UnifiedAdmin.tsx', 'utf8');

// 1. Replace tab
code = code.replace(
  /\[\\'comissionamento\\', \\'Relatório Comissionamento\\'\]/,
  "[\\'consolidado\\', \\'Recebimentos Consolidado\\']"
);

// 2. Replace CSV export
const csvExportOriginal = `      } else {
        csvContent += "Data;Responsável;Aluno;Turma;Unidade;Plano;Método;Valor Líquido (R$)\\n";
        computedFinance.nominalList.forEach(n => {
          const dateFormatted = n.date ? formatDateDisplay(n.date) : '';
          csvContent += \`"\${dateFormatted}";"\${n.responsavel}";"\${n.aluno}";"\${n.turma}";"\${n.unidade}";"\${n.plano || 'Padrão'}";"\${n.metodo || '—'}";\${n.liquido.toFixed(2)}\\n\`;
        });
      }`;
      
const csvExportNew = `      } else if (finSecondaryTab === 'consolidado') {
        csvContent += "Data;Origem;Responsável/Cliente;Aluno;Turma;Unidade;Plano;Método;Valor Líquido (R$)\\n";
        const cList = [];
        computedFinance.nominalList.forEach(p => cList.push({ ...p, origem: 'Mensalidade' }));
        pedidos.filter(p => {
          const d = new Date(p.created_at);
          return d >= new Date(finStartDate) && d <= new Date(finEndDate + 'T23:59:59') && p.status === 'pago';
        }).forEach(p => cList.push({ date: p.created_at, responsavel: p.nome_cliente, origem: 'Loja', metodo: '—', liquido: p.total, status: 'pago' }));
        inscricoes.filter(i => {
          const d = new Date(i.created_at);
          return d >= new Date(finStartDate) && d <= new Date(finEndDate + 'T23:59:59') && i.status_pagamento === 'pago';
        }).forEach(i => cList.push({ date: i.created_at, responsavel: i.nome_responsavel, origem: 'Evento', metodo: '—', liquido: i.valor_total, status: 'pago' }));
        cList.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).forEach(n => {
          const dateFormatted = n.date ? formatDateDisplay(n.date) : '';
          csvContent += \`"\${dateFormatted}";"\${n.origem}";"\${n.responsavel || '—'}";"\${n.aluno || '—'}";"\${n.turma || '—'}";"\${n.unidade || '—'}";"\${n.plano || '—'}";"\${n.metodo || '—'}";\${Number(n.liquido || 0).toFixed(2)}\\n\`;
        });
      } else {
        csvContent += "Data;Responsável;Aluno;Turma;Unidade;Plano;Método;Valor Líquido (R$)\\n";
        computedFinance.nominalList.forEach(n => {
          const dateFormatted = n.date ? formatDateDisplay(n.date) : '';
          csvContent += \`"\${dateFormatted}";"\${n.responsavel}";"\${n.aluno}";"\${n.turma}";"\${n.unidade}";"\${n.plano || 'Padrão'}";"\${n.metodo || '—'}";\${n.liquido.toFixed(2)}\\n\`;
        });
      }`;

code = code.replace(csvExportOriginal, csvExportNew);

// 3. Replace UI block
const regexComissionamento = /\{\/\* 2\. Relatório Comissionamento[^]*?(?=\{\/\* 3\. Recebimentos Loja \*\/)/;
const consolidadoUI = `{/* 2. Recebimentos Consolidado */}
                          {finSecondaryTab === 'consolidado' && (() => {
                            const cList = [];
                            computedFinance.nominalList.forEach(p => cList.push({ ...p, origem: 'Mensalidade' }));
                            pedidos.filter(p => {
                              const d = new Date(p.created_at);
                              return d >= new Date(finStartDate) && d <= new Date(finEndDate + 'T23:59:59') && p.status === 'pago';
                            }).forEach(p => cList.push({ date: p.created_at, responsavel: p.nome_cliente, origem: 'Loja', metodo: '—', liquido: p.total, status: 'pago' }));
                            inscricoes.filter(i => {
                              const d = new Date(i.created_at);
                              return d >= new Date(finStartDate) && d <= new Date(finEndDate + 'T23:59:59') && i.status_pagamento === 'pago';
                            }).forEach(i => cList.push({ date: i.created_at, responsavel: i.nome_responsavel, origem: 'Evento', metodo: '—', liquido: i.valor_total, status: 'pago' }));
                            cList.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

                            return (
                              <div className="bg-white rounded-3xl border border-slate-150 overflow-hidden shadow-sm">
                                <div className="overflow-x-auto">
                                  <table className="w-full text-left text-sm border-collapse">
                                    <thead>
                                      <tr className="bg-slate-50 border-b border-slate-100 text-slate-400 font-bold uppercase text-[10px] tracking-wider">
                                        <th className="p-4">Data</th>
                                        <th className="p-4">Origem</th>
                                        <th className="p-4">Cliente/Estudante</th>
                                        <th className="p-4">Método</th>
                                        <th className="p-4 text-right">Valor</th>
                                        <th className="p-4 text-center">Status</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                      {cList.length === 0 ? (
                                        <tr>
                                          <td colSpan={6} className="p-8 text-center text-slate-400 italic">
                                            Nenhum recebimento consolidado encontrado para o período.
                                          </td>
                                        </tr>
                                      ) : (
                                        cList.map((item, idx) => (
                                          <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                                            <td className="p-4 text-xs font-semibold text-slate-600">
                                              {item.date ? formatDateDisplay(item.date) : '—'}
                                            </td>
                                            <td className="p-4">
                                              <span className={\`px-2 py-1 rounded text-[10px] font-bold uppercase \${
                                                item.origem === 'Mensalidade' ? 'bg-indigo-50 text-indigo-700' :
                                                item.origem === 'Loja' ? 'bg-amber-50 text-amber-700' :
                                                'bg-pink-50 text-pink-700'
                                              }\`}>
                                                {item.origem}
                                              </span>
                                            </td>
                                            <td className="p-4">
                                              <div className="text-xs font-bold text-slate-800">{item.responsavel}</div>
                                              {item.aluno && item.aluno !== '—' && (
                                                <div className="text-[10px] text-slate-500 font-medium">{item.aluno}</div>
                                              )}
                                            </td>
                                            <td className="p-4 text-xs font-semibold text-slate-500 uppercase">
                                              {item.metodo}
                                            </td>
                                            <td className="p-4 text-xs font-black text-slate-800 text-right">
                                              {formatCurrency(item.liquido)}
                                            </td>
                                            <td className="p-4 text-center">
                                              <span className="px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700">
                                                Bem-sucedido
                                              </span>
                                            </td>
                                          </tr>
                                        ))
                                      )}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            );
                          })()}

                          `;

code = code.replace(regexComissionamento, consolidadoUI);
fs.writeFileSync('src/pages/Admin/UnifiedAdmin.tsx', code);
console.log('Script done');
