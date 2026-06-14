import axios from 'axios';

async function check() {
  try {
    const res = await axios.get('http://localhost:3000/api/admin/financial-report');
    const data = res.data;
    
    console.log(`API response counts:`);
    console.log(`  matriculas: ${data.matriculas?.length}`);
    console.log(`  turmas: ${data.turmas?.length}`);
    console.log(`  pagamentos: ${data.pagamentos?.length}`);
    console.log(`  alunos: ${data.alunos?.length}`);
    console.log(`  responsaveis: ${data.responsaveis?.length}`);

    const active = data.matriculas?.filter((m: any) => m.status === 'ativo' || m.status === 'Ativo') || [];
    console.log(`  Active matriculas: ${active.length}`);

    // Check if there are duplicates by id
    const ids = new Set();
    let dupCount = 0;
    data.matriculas?.forEach((m: any) => {
      if (ids.has(m.id)) dupCount++;
      else ids.add(m.id);
    });
    console.log(`  Duplicate matriculas by ID: ${dupCount}`);
  } catch (err: any) {
    console.error('Error fetching API:', err.message);
  }
}

check();
