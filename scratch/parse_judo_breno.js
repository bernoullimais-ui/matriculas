import * as fs from 'fs';
const inputFile = '/Users/brunomaia/.gemini/antigravity/brain/09e5eb60-aed0-419e-b4ec-6fe921f6088a/.system_generated/steps/144/output.txt';
const outputFile = '/Users/brunomaia/.gemini/antigravity/brain/09e5eb60-aed0-419e-b4ec-6fe921f6088a/Alunos_Judo_Breno.csv';

try {
  const content = fs.readFileSync(inputFile, 'utf-8');
  const match = content.match(/<untrusted-data-[^>]+>\n(.*)\n<\/untrusted-data-/s);
  
  if (match && match[1]) {
    const data = JSON.parse(match[1]);
    
    if (data.length > 0) {
      const headers = ['Nome do Aluno', 'Unidade', 'Turma'];
      const csvRows = [];
      csvRows.push(headers.join(','));
      
      data.forEach(row => {
        const values = [
          `"${row['Nome do Aluno'] || ''}"`,
          `"${row['Unidade'] || ''}"`,
          `"${row['Turma'] || ''}"`
        ];
        csvRows.push(values.join(','));
      });
      
      fs.writeFileSync(outputFile, csvRows.join('\n'), 'utf-8');
      console.log(`CSV gerado com sucesso (${data.length} alunos):`, outputFile);
    } else {
      console.log('Nenhum dado encontrado no JSON.');
    }
  } else {
    console.log('Não foi possível extrair o JSON do arquivo.');
  }
} catch (e) {
  console.error('Erro:', e.message);
}
