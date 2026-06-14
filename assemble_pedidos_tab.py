import os

with open('src/pages/Admin/UnifiedAdmin.tsx', 'r') as f:
    lines = f.readlines()

def extract_jsx(start_marker):
    start_idx = -1
    for i, line in enumerate(lines):
        if start_marker in line:
            start_idx = i
            break
    if start_idx == -1: return ""
    
    depth = 0
    end_idx = -1
    for i in range(start_idx, len(lines)):
        depth += lines[i].count('(')
        depth -= lines[i].count(')')
        if depth == 0 and lines[i].count(')') > 0:
            end_idx = i
            break
    if end_idx != -1:
        return "".join(lines[start_idx:end_idx+1])
    return ""

def extract_jsx_from_var(text, start_marker):
    lines = text.split("\n")
    start_idx = -1
    for i, line in enumerate(lines):
        if start_marker in line:
            start_idx = i
            break
    if start_idx == -1: return ""
    
    depth = 0
    end_idx = -1
    for i in range(start_idx, len(lines)):
        depth += lines[i].count('(')
        depth -= lines[i].count(')')
        if depth == 0 and lines[i].count(')') > 0:
            end_idx = i
            break
    if end_idx != -1:
        return "\n".join(lines[start_idx:end_idx+1])
    return ""

content_jsx = extract_jsx("{tab === 'pedidos' && (")
modal_jsx = extract_jsx("{pedidoDetailModal.isOpen && pedidoDetailModal.pedido && (")

# Clean wrapping
if content_jsx.startswith("{tab === 'pedidos' && ("):
    content_lines = content_jsx.split("\n")
    content_lines[0] = ""
    for i in range(len(content_lines)-1, -1, -1):
        if ")}" in content_lines[i]:
            content_lines[i] = content_lines[i].replace(")}", "")
            break
    content_jsx = "\n".join(content_lines)

out = """import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Search, X, Check, Eye, Archive, MapPin, Phone, MessageSquare, AlertCircle, RefreshCw
} from 'lucide-react';
import { useAdminStore } from '../../../stores/adminStore';
import { formatCurrency, formatDateTime } from '../../../utils/formatters';

export function PedidosTab() {
  const { pedidos, setPedidos } = useAdminStore();
  
  const [lojaSearch, setLojaSearch] = useState('');
  const [lojaStatusFilter, setLojaStatusFilter] = useState('');
  const [pedidoDetailModal, setPedidoDetailModal] = useState({ isOpen: false, pedido: null as any });

___MODAL_JSX___

  return (
    <>
      {/* MAIN CONTENT */}
___CONTENT_JSX___
    </>
  );
}
"""

out = out.replace("___MODAL_JSX___", modal_jsx)
out = out.replace("___CONTENT_JSX___", content_jsx)

with open('src/components/admin/ecommerce/PedidosTab.tsx', 'w') as f:
    f.write(out)

print("Created src/components/admin/ecommerce/PedidosTab.tsx!")
