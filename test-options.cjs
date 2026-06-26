const fetch = require('node-fetch');

async function test() {
  const res = await fetch('https://www.sportforkids.com.br/api/options');
  const data = await res.json();
  console.log('Sample turma:', data.turmas[0]);
}
test();
