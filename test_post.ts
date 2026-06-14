import dotenv from 'dotenv';
dotenv.config();

const express = require('express');
const app = express();
app.use(express.json());

app.post('/api/admin/cupons', (req, res) => {
  console.log('Received body:', req.body);
  const limite = req.body.limite_por_usuario;
  console.log('limite_por_usuario:', typeof limite, limite);
  const evaluated = limite ? Number(limite) : null;
  console.log('evaluated to:', evaluated);
  res.json({ success: true, evaluated });
});

const server = app.listen(5002, async () => {
  console.log('Test server running on 5002');
  try {
    const res = await fetch('http://localhost:5002/api/admin/cupons', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        codigo: 'TEST',
        tipo_desconto: 'porcentagem',
        valor: 0,
        escopo: 'loja_todos',
        produto_id: '',
        evento_id: '',
        limite_total_uso: '',
        limite_por_usuario: '',
        validade: ''
      })
    });
    const data = await res.json();
    console.log('Response:', data);
  } finally {
    server.close();
  }
});
