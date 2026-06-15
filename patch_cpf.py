import re

with open('server.ts', 'r') as f:
    content = f.read()

# Fix the missing CPF in the db insert for evento_inscricoes
old_respostas = """          respostas_personalizadas: {
            ...respostas,
            "Data de Nascimento do Aluno": aluno_data_nascimento,
            "WhatsApp do Responsável": responsavel_whatsapp,
            "metodo_pagamento": metodo_pagamento === 'pix' ? 'PIX' : 'Cartão de Crédito'
          },"""

new_respostas = """          respostas_personalizadas: {
            ...respostas,
            "Data de Nascimento do Aluno": aluno_data_nascimento,
            "WhatsApp do Responsável": responsavel_whatsapp,
            "CPF do Responsável": cpf_responsavel,
            "metodo_pagamento": metodo_pagamento === 'pix' ? 'PIX' : 'Cartão de Crédito'
          },"""

content = content.replace(old_respostas, new_respostas)

with open('server.ts', 'w') as f:
    f.write(content)

print("server.ts patched.")
