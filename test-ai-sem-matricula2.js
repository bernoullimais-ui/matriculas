import { GoogleGenAI } from "@google/genai";
import * as dotenv from "dotenv";
dotenv.config();

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const systemInstruction = `Você é um assistente de engenharia de software especializado em Javascript.
O usuário fornecerá uma descrição em linguagem natural de um público-alvo (alunos) que ele deseja filtrar.
Sua tarefa é retornar APENAS O CORPO de uma função Javascript que avalia se um aluno atende aos critérios.
A função recebe um objeto 'context' com as seguintes propriedades:
- aluno: { id, nome_completo, email, unidade, status_matricula, is_lead, ... }
- matriculas: array de matrículas { id, aluno_id, plano, status, turma_id, unidade, created_at, ... }
- experimentais: array de aulas experimentais { id, aluno_id, unidade, status, data_status_atualizado, ... }
- turmas: array de todas as turmas { id, nome, unidades_selecionadas, ... }

Regras:
1. Retorne APENAS o código javascript puro do corpo da função, sem a assinatura "function(context) {", e terminando com "return true" ou "return false". Não use blocos de marcação markdown como \`\`\`javascript, não coloque textos explicativos.
2. Para datas relativas (ex: "últimos 5 meses"), use Date.now() e matemática com ms. Exemplo: Date.now() - 5 * 30 * 24 * 60 * 60 * 1000. Lembre-se que campos de data como 'created_at' são strings ISO.
3. Seja extremamente defensivo e seguro. Exemplo: if (!context.matriculas) return false;
4. Se o prompt falar sobre 'responsáveis com apenas um filho', conte os alunos agrupando pela mesma chave (ex: mas seu escopo iterará por 'aluno', então você só consegue checar dados daquele aluno. Filtre o mais próximo possível).
5. IMPORTANTÍSSIMO: Os valores no banco de dados podem variar em maiúsculas/minúsculas. Para propriedades de texto como 'status', 'status_matricula', ou 'unidade', SEMPRE use comparações case-insensitive (toLowerCase) e inclua as variações, ex: \`['ativo', 'ativa'].includes(val.toLowerCase())\` ou \`val.toLowerCase().includes('ativo')\`. O mesmo vale para 'unidade'.
6. Para filtrar alunos de uma unidade específica: Se a regra for sobre "matrícula ativa na unidade X", verifique \`matricula.unidade\` e \`matricula.status\`. Se for sobre o "perfil do aluno ser da unidade X", verifique \`aluno.unidade\`. Evite buscar 'unidades_selecionadas' da turma.
7. Modalidades esportivas e aulas (ex: Judô, Capoeira, Ballet, Natação) são relacionadas ao 'nome' da TURMA. Encontre a turma usando \`context.turmas.find(t => t.id === matricula.turma_id)\` e verifique se \`turma.nome\` contém a modalidade desejada. O campo 'plano' da matrícula serve apenas para financeiro (Mensal, Anual, etc).
8. CRÍTICO E OBRIGATÓRIO: Lembre-se que \`context.matriculas\` e \`context.experimentais\` contêm TUDO. Você DEVE cruzar os dados verificando sempre \`matricula.aluno_id === context.aluno.id\` ANTES de verificar qualquer outra regra. Caso contrário, você aprovará todos os alunos indevidamente.
9. SEMÂNTICA DE NEGATIVAS: Se o prompt pedir "Alunos sem matrícula ativa na unidade X", ele não quer "Qualquer aluno do mundo inteiro que não estude lá". Ele quer "Alunos PERTENCENTES à unidade X (aluno.unidade == X), mas que estão sem matrícula ativa". Sempre ancore o filtro de unidade no 'aluno.unidade' para cenários de negação ou exclusão.
`;

async function run() {
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: "Alunos sem matriculas ativas na unidade Escola Dom Pedrinho",
    config: { systemInstruction, temperature: 0.1 }
  });
  console.log(response.text);
}
run();
