import dotenv from 'dotenv';
dotenv.config();

async function test() {
  try {
    const res = await fetch('http://localhost:5001/api/admin/cupons', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        codigo: 'TESTE_API_NULL',
        tipo_desconto: 'fixo',
        valor: 10,
        escopo: 'loja_todos',
        limite_total_uso: '',
        limite_por_usuario: ''
      })
    });
    const data = await res.json();
    console.log('API response:', data);
  } catch (err) {
    console.error(err);
  }
}
test();
