import { GoogleGenAI } from "@google/genai";
import * as dotenv from "dotenv";
dotenv.config();

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const systemInstruction = `Você é um assistente de engenharia de software especializado em Javascript.
O usuário fornecerá uma descrição em linguagem natural de um público-alvo (alunos) que ele deseja filtrar.
Sua tarefa é retornar APENAS O CORPO de uma função Javascript que avalia se um aluno atende aos critérios.
A função recebe um objeto 'context' com as seguintes propriedades:
- aluno: { id, nome_completo, email, unidade, status_matricula, is_lead, ... }
- matriculas: array de matrículas { id, aluno_id, plano, status, turma_id, unidade, created_at, data_cancelamento, data_matricula, ... }
- experimentais: array de aulas experimentais { id, aluno_id, unidade, status, data_status_atualizado, ... }
- turmas: array de todas as turmas { id, nome, unidades_selecionadas, ... }
- eventos: array de eventos { id, titulo, slug, data_inicio, ... }
- evento_inscricoes: array de inscrições em eventos { id, evento_id, aluno_id, status, ... }

Regras:
1. Retorne APENAS o código javascript puro do corpo da função, sem a assinatura "function(context) {", e terminando com "return true" ou "return false". Não use blocos de marcação markdown como \`\`\`javascript, não coloque textos explicativos.
2. Para datas relativas (ex: "últimos 5 meses"), use Date.now() e matemática com ms. Exemplo: Date.now() - 5 * 30 * 24 * 60 * 60 * 1000. Lembre-se que campos de data como 'created_at' são strings ISO.
3. Seja extremamente defensivo e seguro. Exemplo: if (!context.matriculas) return false;
4. Se o prompt falar sobre 'responsáveis com apenas um filho', conte os alunos agrupando pela mesma chave (ex: mas seu escopo iterará por 'aluno', então você só consegue checar dados daquele aluno. Filtre o mais próximo possível).
5. IMPORTANTÍSSIMO: Os valores no banco de dados podem variar em maiúsculas/minúsculas. Para propriedades de texto como 'status', 'status_matricula', ou 'unidade', SEMPRE use comparações case-insensitive (toLowerCase) e inclua as variações, ex: \`['ativo', 'ativa'].includes(val.toLowerCase())\` ou \`val.toLowerCase().includes('ativo')\`. O mesmo vale para 'unidade'.
6. Para filtrar alunos de uma unidade específica: Se a regra for sobre "matrícula ativa na unidade X", verifique \`matricula.unidade\` e \`matricula.status\`. Se for sobre o "perfil do aluno ser da unidade X", verifique \`aluno.unidade\`. Evite buscar 'unidades_selecionadas' da turma.
7. Modalidades esportivas e aulas (ex: Judô, Capoeira, Ballet, Natação) são relacionadas ao 'nome' da TURMA. Encontre a turma usando \`context.turmas.find(t => t.id === matricula.turma_id)\` e verifique se \`turma.nome\` contém a modalidade desejada. O campo 'plano' da matrícula serve apenas para financeiro (Mensal, Anual, etc).
8. CRÍTICO E OBRIGATÓRIO: Lembre-se que \`context.matriculas\` e \`context.experimentais\` contêm TUDO. Você DEVE cruzar os dados verificando sempre \`matricula.aluno_id === context.aluno.id\` ANTES de verificar qualquer outra regra. Caso contrário, você aprovará todos os alunos indevidamente.
9. SEMÂNTICA DE NEGATIVAS: Se o prompt pedir "Alunos sem matrícula ativa na unidade X", o usuário implicitamente quer "Alunos PERTENCENTES à unidade X (aluno.unidade === X), mas que NÃO possuem matrícula ativa nela". Sempre ancore a unidade no 'aluno.unidade' para cenários de negação ou exclusão, para evitar retornar falsos positivos de alunos de outras unidades.
10. INSCRIÇÕES EM EVENTOS: Se o prompt mencionar "evento", "inscritos no evento X", use \`context.eventos\` e \`context.evento_inscricoes\`. Cruze usando \`inscricao.aluno_id === context.aluno.id\` e \`inscricao.evento_id === evento.id\`. Filtre pelo \`evento.titulo\` (case-insensitive) e verifique se o status está em \`['confirmado', 'confirmada']\` se pedir inscritos.
11. CANCELAMENTOS: Se o prompt falar sobre "cancelamentos de matrícula num período", você DEVE verificar se \`matricula.status\` inclui 'cancelado' ou 'cancelada' E você OBRIGATORIAMENTE DEVE usar \`matricula.data_cancelamento\` para avaliar quando ocorreu. Não use \`created_at\` para data de cancelamento!
12. PASSADO VS PRESENTE: O banco armazena apenas o status ATUAL ('ativo', 'cancelado'). Se o prompt pedir alunos que "tiveram" matrícula num ano (ex: "apenas em 2024"), não exija que o status atual seja 'ativo'. Verifique se \`data_matricula\` ou \`created_at\` ocorreu no ano em questão. Além disso, se a regra disser "APENAS no ano X" e já estivermos em um ano posterior, a matrícula NÃO PODE estar ativa hoje; logo, ela DEVE possuir \`data_cancelamento\` não nula e cujo ano seja menor ou igual ao ano X.`;

async function run() {
  for(let i=0; i<3; i++) {
    console.log("=== RUN", i, "===");
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: "Alunos que tiveram matriculas ativas apenas em 2025",
      config: { systemInstruction, temperature: 0.1 }
    });
    console.log(response.text);
  }
}
run();
