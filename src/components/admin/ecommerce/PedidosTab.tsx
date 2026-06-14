import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import toast from 'react-hot-toast';
import { 
  Search, X, Check, Eye, Archive, MapPin, Phone, MessageSquare, AlertCircle, RefreshCw, ExternalLink, Trash2, Printer
} from 'lucide-react';
import { useAdminStore } from '../../../stores/adminStore';
import { formatCurrency, formatDateTime } from '../../../utils/formatters';

export function PedidosTab() {
  const { pedidos, setPedidos, loadData, enrollments } = useAdminStore();
  
  const [lojaSearch, setLojaSearch] = useState('');
  const [lojaStatusFilter, setLojaStatusFilter] = useState('');
  const [pedidoDetailModal, setPedidoDetailModal] = useState({ isOpen: false, pedido: null as any });


  return (
    <>
      {/* MAIN CONTENT */}
              {true && (() => {
                const pedidosFiltrados = pedidos.filter((ped: any) => {
                  const searchLower = lojaSearch.toLowerCase();
                  let matchesSearch = true;
                  if (searchLower) {
                    const inCliente = ped.nome_cliente?.toLowerCase().includes(searchLower) || false;
                    let inItem = false;
                    if (ped.loja_pedido_itens) {
                      inItem = ped.loja_pedido_itens.some((item: any) => {
                        let variantMatch = false;
                        try {
                          const parsed = typeof item.variante_selecionada === 'string' ? JSON.parse(item.variante_selecionada) : item.variante_selecionada;
                          variantMatch = JSON.stringify(parsed).toLowerCase().includes(searchLower);
                        } catch(e) {}
                        return variantMatch;
                      });
                    }
                    matchesSearch = inCliente || inItem;
                  }
                  const matchesStatus = lojaStatusFilter ? ped.status_entrega === lojaStatusFilter : true;
                  return matchesSearch && matchesStatus;
                });

                return (
                  <div className="space-y-4">
                    <div className="flex flex-col sm:flex-row gap-3">
                      <input 
                        type="text" 
                        placeholder="Buscar por cliente ou estudante..." 
                        value={lojaSearch}
                        onChange={e => setLojaSearch(e.target.value)}
                        className="flex-1 px-4 py-2 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                      <select 
                        value={lojaStatusFilter}
                        onChange={e => setLojaStatusFilter(e.target.value)}
                        className="px-4 py-2 border border-slate-200 rounded-xl text-sm bg-white outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="">Todos os status</option>
                        <option value="pendente">Pendente</option>
                        <option value="preparando">Preparando Pedido</option>
                        <option value="em_rota">Em Rota de Entrega</option>
                        <option value="disponivel_unidade">Disponível na Unidade</option>
                        <option value="entregue">Entregue</option>
                      </select>
                    </div>

                    <div className="bg-white rounded-3xl border border-slate-100 overflow-hidden shadow-sm">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm border-collapse">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-100 text-slate-400 font-bold uppercase text-[10px] tracking-wider">
                              <th className="p-4">Pedido ID</th>
                              <th className="p-4">Cliente</th>
                              <th className="p-4">Total</th>
                              <th className="p-4">Método</th>
                              <th className="p-4">Status</th>
                              <th className="p-4 text-right">Ações</th>
                            </tr>
                          </thead>
                          <tbody>
                            {pedidosFiltrados.map((ped: any) => (
                              <tr key={ped.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/30">
                                <td className="p-4">
                                  <div className="flex items-center gap-2">
                                    <span className="font-mono text-xs font-semibold text-indigo-600">#{ped.id.substring(0, 8)}</span>
                                    {ped.loja_pedidos_solicitacoes && ped.loja_pedidos_solicitacoes.length > 0 && (
                                      <span title="Possui solicitação de troca/devolução" className="text-xs">🔴</span>
                                    )}
                                  </div>
                                </td>
                                <td className="p-4">
                                  <p className="font-semibold text-slate-800 text-xs">{ped.nome_cliente}</p>
                                  <p className="text-[10px] text-slate-400">{ped.email_cliente}</p>
                                </td>
                                <td className="p-4 text-xs font-bold text-slate-700">{formatCurrency(ped.total)}</td>
                                <td className="p-4 text-xs uppercase text-slate-500 font-medium">{ped.metodo_pagamento}</td>
                                <td className="p-4">
                                  <span className={`text-[9px] uppercase px-2 py-0.5 rounded-full font-bold ${
                                    ped.status === 'pago' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
                                  }`}>
                                    {ped.status}
                                  </span>
                                  {ped.status_entrega && ped.status_entrega !== 'pendente' && (
                                    <span className="block mt-1 text-[9px] uppercase font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full w-max">
                                      {ped.status_entrega.replace('_', ' ')}
                                    </span>
                                  )}
                                </td>
                                <td className="p-4 text-right">
                                  <button 
                                    onClick={() => setPedidoDetailModal({ isOpen: true, pedido: ped })}
                                    className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors inline-flex mr-1"
                                    title="Ver Detalhes"
                                  >
                                    <ExternalLink size={16} />
                                  </button>
                                  <button 
                                    onClick={async () => {
                                      if (!window.confirm('Tem certeza que deseja excluir este pedido?')) return;
                                      try {
                                        const token = sessionStorage.getItem('admin_token');
                                        const res = await fetch(`/api/admin/loja/pedidos/${ped.id}`, { 
                                          method: 'DELETE',
                                          headers: token ? { 'Authorization': `Bearer ${token}` } : {}
                                        });
                                        if (res.ok) {
                                          toast.success('Pedido excluído com sucesso!');
                                          loadData();
                                        } else {
                                          toast.error('Erro ao excluir pedido');
                                        }
                                      } catch (err) {
                                        toast.error('Erro ao excluir pedido');
                                      }
                                    }}
                                    className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors inline-flex"
                                    title="Excluir Pedido"
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                );
              })()}

      {pedidoDetailModal.isOpen && pedidoDetailModal.pedido && (() => {
        const p = pedidoDetailModal.pedido;
        const solicitacoes = p.loja_pedidos_solicitacoes || [];

        const updateStatusEntrega = async (newStatus: string) => {
          try {
            const token = sessionStorage.getItem('admin_token');
            const headers: any = { 'Content-Type': 'application/json' };
            if (token) headers['Authorization'] = `Bearer ${token}`;

            const res = await fetch(`/api/admin/loja/pedidos/${p.id}/status-entrega`, {
              method: 'PUT',
              headers,
              body: JSON.stringify({ status_entrega: newStatus })
            });

            if (res.ok) {
              setPedidos(pedidos.map(ped => ped.id === p.id ? { ...ped, status_entrega: newStatus } : ped));
              setPedidoDetailModal({ ...pedidoDetailModal, pedido: { ...p, status_entrega: newStatus } });
            } else {
              alert('Falha ao atualizar o status de entrega.');
            }
          } catch (e) {
            alert('Erro ao atualizar status.');
          }
        };

        const handleSolicitacaoStatus = async (solId: string, newStatus: string) => {
          try {
            const token = sessionStorage.getItem('admin_token');
            const headers: any = { 'Content-Type': 'application/json' };
            if (token) headers['Authorization'] = `Bearer ${token}`;

            const res = await fetch(`/api/admin/loja/pedidos/solicitacoes/${solId}/status`, {
              method: 'PUT',
              headers,
              body: JSON.stringify({ status: newStatus })
            });

            if (res.ok) {
              const updatedSols = solicitacoes.map((s: any) => s.id === solId ? { ...s, status: newStatus } : s);
              setPedidos(pedidos.map(ped => ped.id === p.id ? { ...ped, loja_pedidos_solicitacoes: updatedSols } : ped));
              setPedidoDetailModal({ ...pedidoDetailModal, pedido: { ...p, loja_pedidos_solicitacoes: updatedSols } });
            } else {
              alert('Falha ao atualizar a solicitação.');
            }
          } catch (e) {
            alert('Erro ao atualizar a solicitação.');
          }
        };

      
        return createPortal(
          <AnimatePresence>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4"
              style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}
            >
              <motion.div 
                initial={{ scale: 0.95, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: 20 }}
                className="bg-white rounded-3xl w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl relative p-6"
              >
              
              <div className="flex justify-between items-start mb-6 border-b border-slate-100 pb-4">
                <div>
                  <h2 className="text-xl font-black text-slate-800">Pedido #{p.id.substring(0,8)}</h2>
                  <p className="text-xs text-slate-500 mt-1">Data: {new Date(p.created_at).toLocaleString('pt-BR')}</p>
                </div>
                <div className="flex items-center gap-3">
                  <button onClick={() => {
                    let orderAlunoNome = '';
                    let orderUnidade = '';
                    if (p.loja_pedido_itens && p.loja_pedido_itens.length > 0) {
                      const firstItem = p.loja_pedido_itens[0];
                      let parsed: any = {};
                      try {
                        parsed = typeof firstItem.variante_selecionada === 'string' ? JSON.parse(firstItem.variante_selecionada) : firstItem.variante_selecionada;
                        if (parsed['Aluno'] && typeof parsed['Aluno'] === 'string' && parsed['Aluno'].length !== 36) {
                          orderAlunoNome = parsed['Aluno'].split(' - ')[0];
                        } else if (parsed['aluno'] && typeof parsed['aluno'] === 'string' && parsed['aluno'].length !== 36) {
                          orderAlunoNome = parsed['aluno'].split(' - ')[0];
                        }
                      } catch(e) {}
                      
                      let targetAlunoId = '';
                      if (parsed['aluno_id'] && String(parsed['aluno_id']).length === 36) {
                        targetAlunoId = parsed['aluno_id'];
                      }
                      const studentEnrollment = targetAlunoId ? enrollments.find(e => e.aluno_id === targetAlunoId && e.status === 'ativo') || enrollments.find(e => e.aluno_id === targetAlunoId) : null;
                      orderUnidade = studentEnrollment ? studentEnrollment.unidade : (p.tipo_entrega === 'delivery' ? 'Entrega em Casa' : 'Unidade Padrão');
                    }

                    const printWindow = window.open('', '_blank', 'width=600,height=600');
                    if (!printWindow) return;
                    
                    const itemsHtml = (p.loja_pedido_itens || []).map((item: any) => {
                       const cleanProductName = item.nome_produto.replace(/\s*\(?\s*[a-f0-9-]{36}\s*\)?\s*/i, '').trim();
                       return `<div class="item">
                         <div class="item-name"><strong>${item.quantidade}x</strong> ${cleanProductName}</div>
                       </div>`;
                    }).join('');

                    printWindow.document.write(`
                      <html>
                        <head>
                          <title>Etiqueta Pedido #${p.id.substring(0,8)}</title>
                          <style>
                            body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 20px; margin: 0; color: #333; }
                            .label { border: 2px solid #000; padding: 30px; width: 100%; max-width: 500px; margin: 0 auto; border-radius: 12px; }
                            .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 15px; margin-bottom: 20px; }
                            .title { font-size: 28px; font-weight: 900; letter-spacing: -1px; text-transform: uppercase; }
                            .subtitle { font-size: 14px; color: #666; margin-top: 5px; }
                            .info-group { margin-bottom: 15px; }
                            .info-label { font-size: 12px; text-transform: uppercase; color: #666; font-weight: bold; letter-spacing: 1px; margin-bottom: 4px; }
                            .info-value { font-size: 22px; font-weight: bold; }
                            .items-container { margin-top: 30px; border-top: 2px dashed #ccc; padding-top: 20px; }
                            .items-title { font-size: 16px; font-weight: bold; margin-bottom: 15px; text-transform: uppercase; }
                            .item { margin-bottom: 10px; font-size: 18px; padding-bottom: 10px; border-bottom: 1px solid #eee; }
                            .item:last-child { border-bottom: none; }
                            .footer { margin-top: 30px; text-align: center; font-size: 12px; color: #999; }
                            @media print {
                              body { padding: 0; }
                              .label { border: none; max-width: none; width: 100%; height: 100vh; display: flex; flex-direction: column; justify-content: center; }
                            }
                          </style>
                        </head>
                        <body>
                          <div class="label">
                            <div class="header">
                              <div class="title">Sport For Kids</div>
                              <div class="subtitle">Pedido #${p.id.substring(0,8)}</div>
                            </div>
                            
                            <div class="info-group">
                              <div class="info-label">Destinatário (Aluno)</div>
                              <div class="info-value">${orderAlunoNome || p.nome_cliente}</div>
                            </div>
                            
                            <div class="info-group">
                              <div class="info-label">Local de Entrega</div>
                              <div class="info-value">${orderUnidade}</div>
                            </div>
                            
                            <div class="items-container">
                              <div class="items-title">Itens do Pedido</div>
                              ${itemsHtml}
                            </div>
                          </div>
                          <script>
                            window.onload = function() { window.print(); window.setTimeout(function(){ window.close(); }, 500); }
                          </script>
                        </body>
                      </html>
                    `);
                    printWindow.document.close();
                  }} className="flex items-center gap-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-4 py-2 rounded-xl transition-colors font-bold text-sm">
                    <Printer size={16} /> Imprimir Etiqueta
                  </button>
                  <button onClick={() => setPedidoDetailModal({ isOpen: false, pedido: null })} className="p-2 bg-slate-50 hover:bg-slate-100 rounded-full transition-colors">
                    <X size={20} className="text-slate-500" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Cliente</h3>
                    <p className="font-semibold text-slate-800">{p.nome_cliente}</p>
                    <p className="text-xs text-slate-500">{p.email_cliente}</p>
                    <p className="text-xs text-slate-500">{p.telefone_cliente}</p>
                  </div>

                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Detalhes de Entrega</h3>
                    <p className="text-sm text-slate-700 font-medium mb-1">
                      Tipo: <span className="uppercase text-indigo-600 text-xs font-bold">{p.tipo_entrega}</span>
                    </p>
                    {p.tipo_entrega === 'delivery' && p.endereco_entrega && typeof p.endereco_entrega === 'object' ? (
                      <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                        {p.endereco_entrega.rua}, {p.endereco_entrega.numero}
                        {p.endereco_entrega.complemento ? ` - ${p.endereco_entrega.complemento}` : ''}
                        <br/>{p.endereco_entrega.bairro} - {p.endereco_entrega.cidade}/{p.endereco_entrega.estado}
                        <br/>CEP: {p.endereco_entrega.cep}
                      </p>
                    ) : (
                      <>
                        <p className="text-xs text-slate-600 mt-1">Retirada na Unidade ou Entrega na Escola.</p>
                        {(() => {
                          let orderUnidade = 'Unidade Padrão';
                          if (p.loja_pedido_itens && p.loja_pedido_itens.length > 0) {
                            const firstItem = p.loja_pedido_itens[0];
                            let parsed: any = {};
                            try {
                              parsed = typeof firstItem.variante_selecionada === 'string' ? JSON.parse(firstItem.variante_selecionada) : firstItem.variante_selecionada;
                            } catch(e) {}
                            let targetAlunoId = '';
                            if (parsed['aluno_id'] && String(parsed['aluno_id']).length === 36) {
                              targetAlunoId = parsed['aluno_id'];
                            }
                            const studentEnrollment = targetAlunoId ? enrollments.find(e => e.aluno_id === targetAlunoId && e.status === 'ativo') || enrollments.find(e => e.aluno_id === targetAlunoId) : null;
                            if (studentEnrollment) {
                              orderUnidade = studentEnrollment.unidade;
                            }
                          }
                          return (
                            <p className="text-sm text-slate-800 font-bold mt-2">
                              Unidade: <span className="font-semibold text-slate-600 uppercase">{orderUnidade}</span>
                            </p>
                          );
                        })()}
                  

                      </>
                    )}
                  </div>
                  {p.observacoes && (
                    <div className="bg-amber-50/50 p-4 rounded-2xl border border-amber-100">
                      <h3 className="text-xs font-bold text-amber-600 uppercase tracking-wider mb-2">Observações</h3>
                      <p className="text-sm text-slate-700 italic">"{p.observacoes}"</p>
                    </div>
                  )}
                </div>

                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex flex-col">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Itens ({p.loja_pedido_itens?.length || 0})</h3>
                  <div className="space-y-3 flex-1 overflow-y-auto max-h-48 pr-2">
                    {p.loja_pedido_itens?.map((item: any) => {
                      let alunoNome = '';
                      const variantsDisplay: string[] = [];
                      let parsed: any = {};
                      if (item.variante_selecionada) {
                        try {
                          parsed = typeof item.variante_selecionada === 'string' ? JSON.parse(item.variante_selecionada) : item.variante_selecionada;
                          
                          // Safely extract student name without overwriting with ID
                          if (parsed['Aluno'] && typeof parsed['Aluno'] === 'string' && parsed['Aluno'].length !== 36) {
                            alunoNome = parsed['Aluno'].split(' - ')[0];
                          } else if (parsed['aluno'] && typeof parsed['aluno'] === 'string' && parsed['aluno'].length !== 36) {
                            alunoNome = parsed['aluno'].split(' - ')[0];
                          }

                          for (const [key, value] of Object.entries(parsed)) {
                            if (key.toLowerCase() === 'aluno' || key.toLowerCase() === 'aluno_id') {
                              continue; // Do not show as variant
                            }
                            if (value && String(value).length !== 36 && key.length !== 36 && !key.includes('__kit_items')) {
                              variantsDisplay.push(`${key}: ${value}`);
                            }
                          }
                        } catch(e) {}
                      }
                      
                      // Remove student ID UUID from product name if present
                      const cleanProductName = item.nome_produto.replace(/\s*\(?\s*[a-f0-9-]{36}\s*\)?\s*/i, '').trim();
                      const isKit = item.nome_produto.toLowerCase().includes('kit');
                      
                      return (
                        <div key={item.id} className="flex flex-col bg-white p-3 rounded-xl border border-slate-100 shadow-sm gap-2">
                          <div className="flex-1 pr-4">
                            <p className="font-semibold text-slate-800 text-sm">
                              {cleanProductName} {alunoNome && <span className="text-slate-500 font-normal">({alunoNome})</span>}
                            </p>
                            {variantsDisplay.length > 0 && (
                              <div className="text-[10px] text-slate-500 font-medium mt-1 space-y-0.5">
                                <span className="font-bold text-slate-600">{isKit ? 'Kit composto por:' : 'Características:'}</span>
                                {variantsDisplay.map((v, idx) => (
                                  <div key={idx} className="pl-2">• {v}</div>
                                ))}
                              </div>
                            )}
                          </div>
                          <div className="text-right w-full mt-2">
                            <p className="text-sm font-black text-indigo-600">{item.quantidade}x {formatCurrency(item.preco_unitario)}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-4 pt-4 border-t border-slate-200 flex justify-between items-center">
                    <span className="text-sm font-bold text-slate-500 uppercase">Total do Pedido</span>
                    <span className="text-xl font-black text-slate-800">{formatCurrency(p.total)}</span>
                  </div>
                </div>
              </div>

              <div className="mt-6 bg-indigo-50/50 p-5 rounded-2xl border border-indigo-100 flex flex-col sm:flex-row gap-4 justify-between items-center">
                <div>
                  <h3 className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider mb-1">Status de Pagamento</h3>
                  <span className={`text-[11px] uppercase px-3 py-1 rounded-full font-black ${
                    p.status === 'pago' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                  }`}>
                    {p.status}
                  </span>
                </div>
                
                <div className="flex-1 max-w-sm w-full">
                  <h3 className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider mb-1">Atualizar Logística / Entrega</h3>
                  <select 
                    value={p.status_entrega || 'pendente'} 
                    onChange={e => updateStatusEntrega(e.target.value)}
                    disabled={p.status !== 'pago'}
                    className={`w-full bg-white border border-indigo-200 rounded-xl px-3 py-2 text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 ${p.status !== 'pago' ? 'opacity-60 cursor-not-allowed bg-slate-50' : ''}`}
                  >
                    <option value="pendente">Pendente</option>
                    <option value="preparando">Preparando Pedido</option>
                    <option value="em_rota">Em Rota de Entrega</option>
                    <option value="disponivel_unidade">Disponível na Unidade</option>
                    <option value="entregue">Entregue</option>
                  </select>
                </div>
              </div>

              {solicitacoes.length > 0 && (
                <div className="mt-6 border-t border-slate-100 pt-6">
                  <h3 className="text-sm font-black text-slate-800 mb-4 flex items-center gap-2">
                    <AlertCircle size={16} className="text-rose-500" /> 
                    Solicitações de Troca ou Devolução
                  </h3>
                  <div className="space-y-3">
                    {solicitacoes.map((sol: any) => (
                      <div key={sol.id} className="bg-white p-4 rounded-2xl border border-rose-100 shadow-sm flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
                        <div className="flex-1">
                          <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${
                            sol.tipo === 'devolucao' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'
                          }`}>
                            {sol.tipo.replace('_', ' ')}
                          </span>
                          <p className="text-xs text-slate-600 mt-2 font-medium leading-relaxed">
                            <strong className="text-slate-800">Motivo/Detalhes:</strong> {sol.detalhes}
                          </p>
                          {(sol.diferenca_valor !== undefined && sol.diferenca_valor !== null) && (
                            <p className="text-xs mt-1">
                              {sol.diferenca_valor > 0 
                                ? <span className="text-rose-600 font-bold">Cliente deve pagar R$ {sol.diferenca_valor.toFixed(2)}</span>
                                : sol.diferenca_valor < 0 
                                ? <span className="text-emerald-600 font-bold">Gerar crédito de R$ {Math.abs(sol.diferenca_valor).toFixed(2)}</span>
                                : <span className="text-slate-500 font-bold">Sem diferença de valor</span>}
                            </p>
                          )}
                          {sol.cupom_gerado_id && (
                            <p className="text-[10px] text-emerald-600 font-bold mt-1 bg-emerald-50 inline-block px-2 py-1 rounded">Cupom de devolução gerado para o cliente.</p>
                          )}
                          {sol.link_pagamento_gerado && (
                            <p className="text-[10px] text-amber-600 font-bold mt-1 bg-amber-50 inline-block px-2 py-1 rounded">Pagamento pendente: {sol.link_pagamento_gerado}</p>
                          )}
                          <p className="text-[10px] text-slate-400 mt-1">Status atual: <strong className="uppercase">{sol.status}</strong></p>
                        </div>
                        {sol.status === 'pendente' && (
                          <div className="flex gap-2 shrink-0">
                            <button 
                              onClick={() => {
                                if (window.confirm('Tem certeza que deseja aprovar esta solicitação? Estoque e finanças serão processados.')) {
                                  handleSolicitacaoStatus(sol.id, 'aprovado');
                                }
                              }}
                              className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-xs rounded-lg transition-colors border border-emerald-200"
                            >
                              Aprovar
                            </button>
                            <button 
                              onClick={() => {
                                if (window.confirm('Tem certeza que deseja rejeitar?')) {
                                  handleSolicitacaoStatus(sol.id, 'rejeitado');
                                }
                              }}
                              className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs rounded-lg transition-colors border border-rose-200"
                            >
                              Rejeitar
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              </motion.div>
            </motion.div>
          </AnimatePresence>,
          document.body
        );
      })()}

    </>
  );
}
