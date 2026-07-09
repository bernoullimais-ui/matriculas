const fs = require('fs');

const inputFile = '/Users/brunomaia/.gemini/antigravity/brain/09e5eb60-aed0-419e-b4ec-6fe921f6088a/.system_generated/steps/169/output.txt';
const outputFile = '/Users/brunomaia/.gemini/antigravity/brain/09e5eb60-aed0-419e-b4ec-6fe921f6088a/Alunos_Judo_Breno.csv';

try {
  const content = fs.readFileSync(inputFile, 'utf-8');
  const startTag = '<untrusted-data-';
  const endTag = '</untrusted-data-';
  
  const startIndex = content.indexOf(startTag);
  const endIndex = content.indexOf(endTag);
  
  if (startIndex !== -1 && endIndex !== -1) {
    // Find the first newline after the start tag
    const firstNewline = content.indexOf('\n', startIndex);
    const jsonStr = content.substring(firstNewline + 1, endIndex).trim();
    
    const data = JSON.parse(jsonStr);
    
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
      console.log(`CSV gerado com sucesso (${data.length} alunos): ${outputFile}`);
    } else {
      console.log('Nenhum dado encontrado no JSON.');
    }
  } else {
    console.log('Não foi possível encontrar as tags untrusted-data no arquivo.');
  }
} catch (e) {
  console.error('Erro:', e.message);
}
