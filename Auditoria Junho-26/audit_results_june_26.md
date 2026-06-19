# Relatório de Auditoria e Conciliação Financeira - Junho/2026

**Data da Auditoria:** 18/06/2026, 16:46:46
Este relatório apresenta a conciliação entre as plataformas financeiras (Wix e Pagar.me) e os registros armazenados no banco de dados Supabase do aplicativo Dojo 360.

## Resumo Geral

| Plataforma | Registros no CSV | Registros no Banco | Conciliados | Divergência de Status | Ausentes no Banco | Ausentes no CSV |
|---|---|---|---|---|---|---|
| **Wix Payments** | 147 | 141 | 117 | 12 | 10 | 24 |
| **Pagar.me** | 141 | 55 | 48 | 6 | 83 | 7 |

---

## Detalhamento: Wix Payments

### ❌ Transações Wix Ausentes no Banco de Dados (10)
Estas transações constam na planilha de exportação do Wix, mas não foram encontradas no banco do app:

| ID Transação | ID Pedido | Cliente | E-mail | Data | Valor | Status Wix |
|---|---|---|---|---|---|---|
| `280e5378-3956-430f-aa08-d4736e95114f` | `aa36d8f2-867a-4800-b9b4-7fc354b86c90` | Bernardo Veiga de Albuquerque Albuquerque | salbuquerque@gmail.com | 17/06/2026, 11:49:12 | R$ 304.00 | Bem-sucedido |
| `4f36c9c1-c827-4b2d-9819-ecaf5e78623e` | `1f4d9f6e-1dcb-40b5-8b4f-482932ef43e1` | Michele Machuca de Queiroz Fialho de Queiroz | michelemmp@gmail.com | 16/06/2026, 10:20:09 | R$ 304.00 | Bem-sucedido |
| `233423ad-6728-40ff-adee-d678cbc0ec4b` | `c6d6a58f-fbcc-4c6e-9958-5dc30ded5f5c` | Juliana de Araújo Pereira Monteiro MALVAR BLANCO | jumonteiro_@hotmail.com | 09/06/2026, 16:19:11 | R$ 304.00 | Bem-sucedido |
| `59e0c6b4-e6f1-4b82-a024-91570773c2f0` | `db3734af-c1e9-4d41-97b1-295ebf4eb0f9` | Juliana de Araújo Pereira Monteiro MALVAR BLANCO | jumonteiro_@hotmail.com | 05/06/2026, 10:46:10 | R$ 304.00 | Bem-sucedido |
| `abccd749-ebc9-4108-859a-f7ca511cae3e` | `f9b82116-0efd-4d41-bad5-c0639b3c943a` | Juliana de Araújo Pereira Monteiro MALVAR BLANCO | jumonteiro_@hotmail.com | 05/06/2026, 10:36:15 | R$ 304.00 | Bem-sucedido |
| `23b3dfd9-f99d-4b5e-8cb5-399756fa1281` | `10441` | MARCELA França | mfpamponet@tjba.jus.br | 03/06/2026, 17:34:17 | R$ 290.00 | Bem-sucedido |
| `0fd83c40-0715-4a09-a565-53f78570385c` | `fd9826dd-820e-4260-8266-33d3bc87244e` | João Bernardo Bacelar Dumêt Dumêt Guimarães | andredumet@terra.com.br | 01/06/2026, 11:57:06 | R$ 304.00 | Recusado |
| `d8926fd6-1ac4-4d36-b8d5-9c1e0bbf0bb3` | `2c39d198-c265-4525-878a-438a113baa44` | ANDRÉ VASCONCELOS PELLENZ PELLENZ | abvasconcelos88@gmail.com | 01/06/2026, 11:12:33 | R$ 273.60 | Bem-sucedido |
| `f4b25ea6-de36-45b4-abd4-ca7b77ca394b` | `090e9dd3-2717-4f02-957e-baa1a3926178` | José Alfredo Medeiros | lilianbmedeiros01@gmail.com | 18/06/2026, 00:16:12 | R$ 271.00 | Bem-sucedido |
| `0549b13d-6e21-4ea2-be64-e428664f2a5b` | `872b63ee-cef4-4289-b2f3-6d027ce1cb32` | Eduardo Silva | edu_teixeira@yahoo.com.br | 05/06/2026, 11:47:12 | R$ 262.80 | Bem-sucedido |

### ⚠️ Divergências de Status - Wix (12)
Transações localizadas no banco, mas com status diferente da plataforma Wix:

| ID Transação | Cliente | E-mail | Data | Valor | Status Wix | Status Banco |
|---|---|---|---|---|---|---|
| `2f221fe5-2e24-45ba-863d-928198fe4edf` | Lucas Ferraz de Santana Ribeiro Pereira Ribeiro | lpr.ribeiro@gmail.com | 16/06/2026, 11:47:08 | R$ 304.00 | **Recusado** | **Falhou** |
| `ae4bf59f-6513-4f84-933e-1398d0dd36af` | Guilherme Almeida lago Resende de Almeida | liuresende@yahoo.com.br | 06/06/2026, 01:24:05 | R$ 304.00 | **Recusado** | **Falhou** |
| `459cf81d-b054-4b19-9a28-e3fcb3680b9a` | Guilherme Almeida lago Resende de Almeida | liuresende@yahoo.com.br | 05/06/2026, 23:23:05 | R$ 304.00 | **Recusado** | **Falhou** |
| `10d26213-3220-4807-9d8a-a5a894597f9c` | Guilherme Almeida lago Resende de Almeida | liuresende@yahoo.com.br | 05/06/2026, 21:22:05 | R$ 304.00 | **Recusado** | **Falhou** |
| `ec495d32-6ef6-4017-a91c-3bc2ca95d6d6` | Guilherme Almeida lago Resende de Almeida | liuresende@yahoo.com.br | 05/06/2026, 19:21:05 | R$ 304.00 | **Recusado** | **Falhou** |
| `21eadf40-84e9-4abe-b780-486debe09114` | Guilherme Almeida lago Resende de Almeida | liuresende@yahoo.com.br | 05/06/2026, 17:20:11 | R$ 304.00 | **Recusado** | **Falhou** |
| `2d4c78ea-6cdf-4f15-ab68-feac3d7634e4` | Guilherme Almeida lago Resende de Almeida | liuresende@yahoo.com.br | 05/06/2026, 15:19:11 | R$ 304.00 | **Recusado** | **Falhou** |
| `f971abbf-9740-4d93-9b78-196ae80e326b` | Laura Corrêa da Trindade Mascarenhas kleber ribeiro mascarenhas silva junior | trindadelivia@hotmail.com | 02/06/2026, 14:59:07 | R$ 304.00 | **Recusado** | **Bem-sucedido** |
| `b01d1578-6798-41df-b854-7fed29b9f1a2` | BENICIO DE VASCONCELOS MERCES Oliveira das Merces | lucom78@gmail.com | 17/06/2026, 12:53:14 | R$ 271.00 | **Recusado** | **Bem-sucedido** |
| `497091c2-990b-4f2c-9314-314b043576a3` | Arthur Gabriel Andrade Araujo Araújo Santos junior | diane.andrade@gmail.com | 16/06/2026, 13:02:22 | R$ 271.80 | **Recusado** | **Bem-sucedido** |
| `7cafc976-6000-459b-89a1-60646d70c159` | Gabriel Soares Marques Nascimento da Silva Nascimento da Silva | lfnsilva2@gmail.com | 10/06/2026, 09:10:07 | R$ 263.00 | **Recusado** | **Falhou** |
| `b07648ee-1fd0-47a0-aac7-432a9337985b` | Helena Brasil Oliveira BRASIL OLIVEIRA | rebecabrasilcosta@gmail.com | 04/06/2026, 13:44:49 | R$ 262.80 | **Bem-sucedido** | **Recusado** |

### ❓ Registros no Banco de Dados Ausentes na Planilha Wix (24)
Registros na tabela `pagamentos_wix` do banco marcados em Junho/2026 que não constam nas planilhas exportadas:

| ID Interno | Cliente | E-mail | Data Transação | Valor | Status Banco |
|---|---|---|---|---|---|
| `7f54b483-c037-4a6b-a196-21999e90fe4a` | Maria Catarina Terceiro de Carvalho | catarinaterceiro@yahoo.com.br | 2026-06-02T03:00:00Z | R$ 304 | Bem-sucedido |
| `b3028819-3bae-42b3-b7ad-df695fd4196b` | Desconhecido | brunaferro@uol.com.br | 2026-06-02T12:34:25.721Z | R$ 273.6 | Bem-sucedido |
| `7e515eb5-409c-4baa-b322-826679c8f7d5` | Luiza Rodrigues Guimaraes | eduardoqblima@gmail.com | 2026-06-03T22:07:08.377Z | R$ 273.6 | Bem-sucedido |
| `630fabde-d985-4ab1-bafb-cd2cfbb23a38` | Camila Lima | camila.scl.lima@gmail.com | 2026-06-02T03:00:00Z | R$ 273.6 | Bem-sucedido |
| `80830f07-2f24-4a35-896e-1e617d70543f` | Rafael Neves | rafinha_neves91@hotmail.com | 2026-06-04T12:08:31.502Z | R$ 292 | Falhou |
| `a5c36e4d-a9f5-4cb4-8f6d-78594323245b` | Josete Mendes Ferreira Matienzo | josimendesf@hotmail.com | 2026-06-05T01:36:30.106722600Z | R$ 273.6 | Bem-sucedido |
| `8536185b-3a31-445e-a8b7-cd51331c6ffc` | Simara Lúcia Nunes Santos | simaranunes_ba@hotmail.com | 2026-06-05T00:05:39.776563617Z | R$ 304 | Bem-sucedido |
| `6fc045f6-8cf0-4142-9d1e-849808905ec2` | Sirléia Almeida | lea-a@hotmail.com | 2026-06-01T00:04:44.908Z | R$ 292 | Bem-sucedido |
| `20b6bbee-5468-4c67-985c-7bb9d2e8a9a7` | Josete Mendes Ferreira Matienzo | josimendesf@hotmail.com | 2026-06-05T01:23:42.840151869Z | R$ 273.6 | Bem-sucedido |
| `563aaa0a-982a-47c0-8043-3b8b36cb28f7` | Rafaela Souza Viana | rafaelasviana@gmail.com | 2026-06-04T19:13:40.461Z | R$ 233.6 | Bem-sucedido |
| `ac3471dc-bad8-4a31-ae3a-79d3a9968e80` | CAMILA ANGELICA CANARIO DE SA TEIXEIRA | camilangelicacst@gmail.com | 2026-06-01T23:54:39.634Z | R$ 304 | Bem-sucedido |
| `2a294320-f0c0-4405-a579-8ce55529ff9c` | Juliana de Araújo Pereira Monteiro | jumonteiro_@hotmail.com | 2026-06-05T13:45:15.432Z | R$ 273.6 | Bem-sucedido |
| `da705a44-698e-4538-a3ea-63ba7ec3d279` | Desconhecido | ahrs76@hotmail.com | 2026-06-01T23:41:06.779Z | R$ 304 | Bem-sucedido |
| `bb3c7e05-67a9-4040-aeba-034fde1e5ce5` | Andre Barreto Pereira | andrebarpereira@gmail.com | 2026-06-02T03:00:00Z | R$ 304 | Bem-sucedido |
| `298541bb-ef17-4da6-a1df-6fb9f7fff553` | Eduardo | edu_teixeira@yahoo.com.br | 2026-06-05T18:04:36.346Z | R$ 160 | Bem-sucedido |
| `24d24059-7bac-45b5-a5be-182f0df0b2ee` | Lorenzo Tonon Mai | enzoxmai@hotmail.com | 2026-06-06T17:34:28.449Z | R$ 262.8 | Bem-sucedido |
| `daf50e9c-ec11-4ae2-b9af-26152503ca94` | Mirian minari vaz | mirianminari@hotmail.com | 2026-06-08T12:21:28.145633125Z | R$ 304 | Bem-sucedido |
| `8eef841d-fbc1-478f-a9a5-da494fde5815` | Sergei Silva Serafim Machado | sergei_machado@uol.com.br | 2026-06-08T23:25:40.596Z | R$ 304 | Bem-sucedido |
| `4c551f41-9c81-4a54-bbad-bf3ee1873cd5` | Juliana de Araújo Pereira Monteiro | jumonteiro_@hotmail.com | 2026-06-09T19:18:19.999Z | R$ 273.6 | Bem-sucedido |
| `822b89f0-f254-4a71-b2bf-ce47a3449b1b` | Bruna Livia Guimaraes Rebello Ferro | brunaferro@uol.com.br | 2026-06-10T16:46:20.735Z | R$ 273.6 | Bem-sucedido |
| `9dece00c-5e7b-4825-8923-7ed0ff8b549e` | Ariana Pinho Azi | arianapinhoazi@gmail.com | 2026-06-11T09:59:12.562Z | R$ 273.6 | Bem-sucedido |
| `e4749f31-d3ea-4f70-9f35-f4526588364c` | Humberto Nogueira | alepegetti@bol.com.br | 2026-06-16T11:49:20.388Z | R$ 304 | Bem-sucedido |
| `a81d0714-cce9-414a-a448-e4c07dd52f90` | Michele Machuca de Queiroz | michelemmp@gmail.com | 2026-06-16T13:19:30.516Z | R$ 273.6 | Bem-sucedido |
| `1d0867f8-9566-4928-b35d-4150635f8319` | Sergio Araújo Lima de Albuquerque | salbuquerque@gmail.com | 2026-06-17T14:48:50.572Z | R$ 273.6 | Bem-sucedido |

---

## Detalhamento: Pagar.me

### ❌ Transações Pagar.me Ausentes no Banco de Dados (83)
Transações registradas na Pagar.me que não foram encontradas na tabela `pagamentos` do banco de dados:

| ID Cobrança | Cliente | E-mail | Data | Valor | Status Pagar.me |
|---|---|---|---|---|---|
| `ch_z6wr33HYqUwyrqGX` | Marcela Moura França | mfpamponet@tjba.jus.br | 2026-06-01 12:53:10 | R$ 273.60 | canceled |
| `ch_EQP0RobhKZtqk8va` | Karla Guimarães de Menezes Barretto | karlambarretto@gmail.com | 2026-06-04 06:50:11 | R$ 304.00 | failed |
| `ch_Q6E2V4MT6U0NOgkd` | Guilherme Soares de Andrade Freitas Oliveira | guigafoliveira@gmail.com | 2026-06-06 04:43:04 | R$ 271.80 | failed |
| `ch_BR1VQGSOYcJjZo4Y` | BRUNO MAIA PEREIRA | maiabruno@msn.com | 2026-06-07 02:28:21 | R$ 179.00 | failed |
| `ch_0QkNJKGIN2u5JKYg` | Bruno Maia Pereira | maiabruno@msn.com | 2026-06-07 02:54:27 | R$ 1.79 | paid |
| `ch_A5GnkWvFpMhRn1ae` | Bruno Maia Pereira | maiabruno@msn.com | 2026-06-07 03:11:41 | R$ 4.90 | failed |
| `ch_5EAj54hpDs0qJXop` | Bruno Maia Pereira | maiabruno@msn.com | 2026-06-07 03:13:59 | R$ 2.38 | failed |
| `ch_WJ2PDoAUNoC46BKo` | Bruno Maia Pereira | maiabruno@msn.com | 2026-06-07 04:27:57 | R$ 1.19 | paid |
| `ch_kgEwOYoUgdHAnGpN` | Bruno Maia Pereira | maiabruno@msn.com | 2026-06-07 04:50:18 | R$ 2.87 | failed |
| `ch_pj2KEpFracOQ10Eg` | Bruno Maia Pereira | maiabruno@msn.com | 2026-06-07 05:26:31 | R$ 1.96 | paid |
| `ch_Waq43G9CqIj74pPN` | Bruno Maia Pereira | maiabruno@msn.com | 2026-06-07 05:27:45 | R$ 4.76 | failed |
| `ch_0YO5kEpHQWIgaWvL` | Bruno Maia Pereira | maiabruno@msn.com | 2026-06-07 06:28:24 | R$ 9.90 | paid |
| `ch_MWDQwNVh6HWLAqOP` | Bruno Maia Pereira | maiabruno@msn.com | 2026-06-07 13:01:11 | R$ 1.96 | paid |
| `ch_Wwa2N3LUYvfGj5On` | Bruno Maia Pereira | maiabruno@msn.com | 2026-06-07 13:02:04 | R$ 7.16 | failed |
| `ch_rV4L26uRYcelLjZe` | Bruno Maia Pereira | maiabruno@msn.com | 2026-06-07 13:02:25 | R$ 7.16 | paid |
| `ch_x92P5leCaiLqwNW1` | Bruno Maia Pereira | maiabruno@msn.com | 2026-06-08 14:59:17 | R$ 1.00 | paid |
| `ch_4RXkn8bI9tkoK3g6` | Gabriella Salles | gabriellasalles92@hotmail.com | 2026-06-08 15:06:27 | R$ 38.00 | paid |
| `ch_XJ35OrpCecwL7q0Q` | Bruno Maia Pereira | maiabruno@msn.com | 2026-06-08 15:36:13 | R$ 1.89 | failed |
| `ch_AJwVBGiZ3Fw41j73` | Bruno Maia Pereira | maiabruno@msn.com | 2026-06-08 15:47:51 | R$ 9.90 | paid |
| `ch_0qxb9zrEcPH29jgQ` | Bruno Maia Pereira | maiabruno@msn.com | 2026-06-08 15:49:32 | R$ 8.40 | failed |
| `ch_LKyW8vQSajf35kQv` | Bruno Maia Pereira | maiabruno@msn.com | 2026-06-08 16:01:25 | R$ 8.40 | paid |
| `ch_ZGVeyxPF1qIDLag5` | Rita de Cássia Vivas B Cavalcante | vivasrita11@gmail.com | 2026-06-09 13:16:05 | R$ 58.00 | paid |
| `ch_YD3OxVNTArUY8jmk` | Bruno Maia Pereira | maiabruno@msn.com | 2026-06-09 17:08:39 | R$ 1.00 | paid |
| `ch_6y8pWvLIwDcPrlbA` | Bruno Maia | maiabruno@msn.com | 2026-06-09 18:58:19 | R$ 20.00 | paid |
| `ch_VB4pj33cyyF0LgvZ` | Priscila de Oliveira Catarino | priscila.catarino@gmail.com | 2026-06-10 19:30:02 | R$ 324.20 | paid |
| `ch_XkL04mQFL2FyRObM` | Luciana de melo borba carneiro | luborbacarneiropgms@gmail.com | 2026-06-11 05:37:51 | R$ 304.00 | paid |
| `ch_KeLD2415Hns8PbjM` | Maiara Reis Lima | maiarareislima@hotmail.com | 2026-06-11 10:44:51 | R$ 219.00 | canceled |
| `ch_wL4rkn3sglHMJMjP` | Lilian Sampaio | lilian.alves.almeida@gmail.com | 2026-06-11 13:23:04 | R$ 259.36 | paid |
| `ch_DvgYmZ0ieMCeEdnb` | Artur Magnavita | arturmagnavita@yahoo.com.br | 2026-06-11 15:42:53 | R$ 10.00 | paid |
| `ch_z6aVoRBHkC9oLW4l` | Affonso Henrique Ramos Sampaio | ahrs76@hotmail.com | 2026-06-12 01:09:02 | R$ 324.20 | paid |
| `ch_b1A3MYaIbc3M8r0l` | Carla Pinheiro Ladeia | carla_pinheiro@hotmail.com | 2026-06-12 03:46:45 | R$ 304.00 | paid |
| `ch_YP0p0J0FWbTZ4RKO` | Lucas Araújo Vieira | lucasvieira1984@gmail.com | 2026-06-12 14:19:35 | R$ 389.04 | failed |
| `ch_YX80l39ubYT6DJWV` | Lucas Araújo Vieira | lucasvieira1984@gmail.com | 2026-06-12 14:19:50 | R$ 389.04 | failed |
| `ch_oJWw9wRhouWY8Ma6` | Lucas Araújo Vieira | lucasvieira1984@gmail.com | 2026-06-12 14:20:08 | R$ 389.04 | failed |
| `ch_NlK53wDU7lUp5g0o` | Lucas Araújo Vieira | lucasvieira1984@gmail.com | 2026-06-12 14:34:09 | R$ 389.04 | failed |
| `ch_AybgMb5tkiOm9p1Z` | Lucas Araújo Vieira | lucasvieira1984@gmail.com | 2026-06-12 14:34:18 | R$ 389.04 | failed |
| `ch_65V8088Rs6H70Y4J` | THAYNA SANTOS COSTA | tsantoscosta20@gmail.com | 2026-06-12 14:47:27 | R$ 259.36 | paid |
| `ch_z9PMdRVUODhEGlw0` | Lucas Araújo Vieira | lucasvieira1984@gmail.com | 2026-06-12 14:49:42 | R$ 389.04 | paid |
| `ch_x8VabRFr1TXVaNde` | LIANA MORAES GUSMÃO | lunagusmao@hotmail.com | 2026-06-13 03:57:25 | R$ 304.00 | paid |
| `ch_6BQyXqtJZfe3P5zl` | leonardo paulino pita santorio | leonardosantorio@hotmail.com | 2026-06-15 14:13:16 | R$ 164.00 | paid |
| `ch_7wQoR29UyySA0oPn` | Camila Pinto Federico | camilapinto@outlook.com.br | 2026-06-15 16:23:14 | R$ 259.36 | failed |
| `ch_zDgk2JViV2IyvkVB` | Camila Pinto Federico | camilapinto@outlook.com.br | 2026-06-15 16:23:19 | R$ 259.36 | failed |
| `ch_3px06j4hr1IP505Q` | Camila Pinto Federico | camilapinto@outlook.com.br | 2026-06-15 16:24:43 | R$ 259.36 | failed |
| `ch_VeR8ZvHYXhNO8EYX` | Camila Pinto Federico | camilapinto@outlook.com.br | 2026-06-15 16:24:55 | R$ 259.36 | failed |
| `ch_JMpgkPspaI62OWRb` | Camila Pinto Federico | camilapinto@outlook.com.br | 2026-06-15 16:30:22 | R$ 259.36 | failed |
| `ch_O816lkES2H4ZpnYz` | Camila Pinto Federico | camilapinto@outlook.com.br | 2026-06-15 16:31:29 | R$ 259.36 | failed |
| `ch_BJQkZa0RSwTyL0nE` | Camila Pinto Federico | camilapinto@outlook.com.br | 2026-06-15 16:38:44 | R$ 324.20 | failed |
| `ch_6VXxNzUyBCN3xvoN` | Camila Pinto Federico | camilapinto@outlook.com.br | 2026-06-15 16:38:54 | R$ 324.20 | failed |
| `ch_GENBqK3FOF7Aqyzo` | Camila Pinto Federico | camilapinto@outlook.com.br | 2026-06-15 16:39:07 | R$ 324.20 | failed |
| `ch_KRbBMQ8JIRhd2xQL` | Camila Pinto Federico | camilapinto@outlook.com.br | 2026-06-15 16:53:04 | R$ 259.36 | failed |
| `ch_rJvMY1mCr8I6Y0Zx` | Camila Pinto Federico | camilapinto@outlook.com.br | 2026-06-15 16:53:26 | R$ 259.36 | paid |
| `ch_9krg4o8UyieG3PaE` | Juliana de Andrade Mota | julinhamota.med@gmail.com | 2026-06-15 20:02:44 | R$ 324.20 | pending |
| `ch_LMGDra5CwxCVrbpd` | Juliana de Andrade Mota | julinhamota.med@gmail.com | 2026-06-15 20:03:36 | R$ 324.20 | paid |
| `ch_DKwlnVWi97t3lN6x` | Giancarlo Oliveira | somaxvendas2020@gmail.com | 2026-06-16 07:54:51 | R$ 292.00 | processing |
| `ch_nRGylVVH01uebrQ0` | Mariana Paiva | marianaappaiva@gmail.com | 2026-06-16 14:50:57 | R$ 324.20 | failed |
| `ch_BJKprjPCnS64po45` | Vanessa Oliveira Marinho | marinho.vanessa@hotmail.com | 2026-06-16 16:54:55 | R$ 291.78 | paid |
| `ch_pb5B6PZuph1blYDd` | MARIA MANUELLA BRITTO GEDEON DO AMARAL | manuellagedeon.mg@gmail.com | 2026-06-16 18:06:35 | R$ 364.73 | pending |
| `ch_Laj8MgPT0jtY42KG` | MARIA MANUELLA BRITTO GEDEON DO AMARAL | manuellagedeon.mg@gmail.com | 2026-06-16 18:08:41 | R$ 364.73 | paid |
| `ch_5OZzByqQTzi8BdlW` | Mariana São Thiago Bezerra de Menezes | marianastbmenezes@yahoo.com.br | 2026-06-17 09:36:40 | R$ 648.40 | pending |
| `ch_yPVnO4QU5iqNKW5Q` | Mariana Paiva | marianaappaiva@gmail.com | 2026-06-17 10:38:50 | R$ 324.20 | paid |
| `ch_gk7417nzSZFex9KP` | Mariana São Thiago Bezerra de Menezes | marianastbmenezes@yahoo.com.br | 2026-06-17 11:32:09 | R$ 518.72 | paid |
| `ch_z3e491CeQIyq4d6q` | Mariana São Thiago Bezerra de Menezes | marianastbmenezes@yahoo.com.br | 2026-06-17 11:33:45 | R$ 324.20 | pending |
| `ch_81enleLIgysR1BRg` | Mariana São Thiago Bezerra de Menezes | marianastbmenezes@yahoo.com.br | 2026-06-17 11:40:34 | R$ 405.25 | pending |
| `ch_AL5WlVAswxFE6Xn9` | Mariana São Thiago Bezerra de Menezes | marianastbmenezes@yahoo.com.br | 2026-06-17 11:41:51 | R$ 324.20 | paid |
| `ch_mAdjE41c7TARXaYZ` | Valentina Ferreira Pires | baa.aline.adv@gmail.com | 2026-06-17 12:47:53 | R$ 229.00 | paid |
| `ch_MDGVvWjcjCmZ5zWe` | ALINE DE BARROS VASCONCELOS PELLENZ | abvasconcelos88@gmail.com | 2026-06-17 13:05:18 | R$ 453.88 | failed |
| `ch_rGKLz7AHlHDlWe7a` | ALINE DE BARROS VASCONCELOS PELLENZ | abvasconcelos88@gmail.com | 2026-06-17 13:08:25 | R$ 453.88 | paid |
| `ch_XVEwXpIzVUEEwMAz` | Tais Caldas da Fonseca ricupero | taicaldas@hotmail.com | 2026-06-17 13:53:53 | R$ 291.78 | paid |
| `ch_LrPMdjuayiAQ2Bng` | Mateus Leão Sacramento Esteves | mateusteves@yahoo.com.br | 2026-06-17 13:56:57 | R$ 229.00 | failed |
| `ch_dPp6GRsV7HQNqDl3` | Mateus Leão Sacramento Esteves | mateusteves@yahoo.com.br | 2026-06-17 13:57:29 | R$ 229.00 | failed |
| `ch_0XVA167fBJhgqPZ1` | Mateus Leão Sacramento Esteves | mateusteves@yahoo.com.br | 2026-06-17 13:57:57 | R$ 229.00 | failed |
| `ch_LRmy5XrhpImm6JpV` | Mateus Leão Sacramento Esteves | mateusteves@yahoo.com.br | 2026-06-17 14:01:15 | R$ 229.00 | paid |
| `ch_8BXq2meUB5fJ20OA` | Kelly Cruz Pimentel Sampaio | kellycpsampaio@gmail.com | 2026-06-17 18:55:27 | R$ 38.00 | paid |
| `ch_6aMG2QAhDZtw2K95` | TESTE 7 | teste7@bruno.com | 2026-06-17 21:31:31 | R$ 17.00 | pending |
| `ch_W57YKG7I8ATjzYqb` | TESTE 10 | teste10@bruno.com | 2026-06-17 21:45:17 | R$ 17.00 | failed |
| `ch_GEZ5R0khBt9Lx3Pz` | TESTE 11 | teste11@bruno.com | 2026-06-17 21:53:49 | R$ 17.00 | paid |
| `ch_eXmJQJdJCzCgNdzK` | TESTE 12 | teste12@bruno.com | 2026-06-17 22:21:07 | R$ 17.00 | paid |
| `ch_P09dlVUA8I08KO63` | Aluno Bruno Maia | judobrunomaia@gmail.com | 2026-06-17 23:21:55 | R$ 140.00 | paid |
| `ch_WeJknZdsKjTJOwl1` | Bruno Maia | bernoullimais@gmail.com | 2026-06-17 23:43:30 | R$ 3.35 | paid |
| `ch_0jABZZfn0uDrBwLb` | ANNA MAGNAVITA | arturmagnavita@gmail.com | 2026-06-18 00:29:29 | R$ 70.00 | paid |
| `ch_wpyDdAOHo7TbkGd6` | Carla capistrano | capistrano.carla@gmail.com | 2026-06-18 03:33:31 | R$ 304.00 | processing |
| `ch_zZRXazwu7yhrAbk8` | CAMILA ANGELICA CANARIO DE SA TEIXEIRA | camilangelicacst@gmail.com | 2026-06-18 16:02:04 | R$ 324.20 | paid |
| `ch_GbWpnW0tEEHLdjal` | Daianna aparecida dias de freitas | daiannafreitas@hotmail.com | 2026-06-18 19:35:34 | R$ 364.73 | paid |

### ⚠️ Divergências de Status - Pagar.me (6)
Cobranças encontradas no banco de dados com status divergente da plataforma Pagar.me:

| ID Cobrança | Cliente | E-mail | Data | Valor | Status Pagar.me | Status Banco |
|---|---|---|---|---|---|---|
| `ch_xKZBm72uV9Hn8egX` | Kise Marinho Bacellar Paixão | kisemarinho@hotmail.com | 2026-06-03 16:52:36 | R$ 304.00 | **failed** | **pago** |
| `ch_0ypRa35UN7Fk19Nk` | Kise Marinho Bacellar Paixão | kisemarinho@hotmail.com | 2026-06-03 16:54:51 | R$ 304.00 | **failed** | **pago** |
| `ch_GXJW4R2ToMH4eZjO` | Lilian Resende de Almeida | liuresende@yahoo.com.br | 2026-06-10 01:39:43 | R$ 304.00 | **failed** | **pago** |
| `ch_wMLPJDATxjfZejXz` | Lilian Resende de Almeida | liuresende@yahoo.com.br | 2026-06-10 01:41:59 | R$ 304.00 | **failed** | **pago** |
| `ch_N89RBPKfYTnxMXar` | Luiz Fernando Nascimento da Silva | lfnsilva2@gmail.com | 2026-06-15 12:22:57 | R$ 263.00 | **failed** | **falha** |
| `ch_mlXADlJsWs0anOZG` | Luiz Fernando Nascimento da Silva | lfnsilva2@gmail.com | 2026-06-15 12:31:57 | R$ 263.00 | **paid** | **falha** |

### ❓ Registros no Banco de Dados Ausentes na Planilha Pagar.me (7)
Registros na tabela `pagamentos` do banco marcados em Junho/2026 que não foram identificados nas cobranças da planilha exportada:

| ID Interno | ID Pagarme (Fatura) | Valor | Vencimento | Pagamento | Status Banco |
|---|---|---|---|---|---|
| `28721a11-863a-412d-8dfb-71be58737c5e` | `ch_BMNmbx5t0Izy2Lwd` | R$ 304.00 | 2026-06-06 | N/A | falha |
| `d82757e6-dba1-4d2d-991e-d7944e7a5192` | `ch_BMNmbx5t0Izy2Lwd` | R$ 304.00 | 2026-06-06 | N/A | falha |
| `4663adf1-ed32-4b80-b959-292360ff1557` | `in_lBrboW6TMPIldbNz` | R$ 292.00 | 2026-05-29 | 2026-06-03T17:28:30+00:00 | pago |
| `d9064ac1-03a8-4568-9e9b-f80f484fa325` | `in_Kjy2oLYFjaHPyeAN` | R$ 263.00 | 2026-06-15 | 2026-06-15T12:32:09.558+00:00 | pago |
| `911e3679-bf11-47b5-8cea-95fed22b2057` | `in_4VvdJooIYlSeWp7K` | R$ 304.00 | 2026-06-15 | 2026-06-15T13:13:19.628+00:00 | pago |
| `7ba3fb90-e194-4361-a7aa-19234be2fc9b` | `in_KjANAopsdiw5MQGy` | R$ 273.60 | 2026-06-16 | 2026-06-16T16:25:31.114+00:00 | pago |
| `15105edc-579d-41fe-b636-12e0a26b0727` | `in_zA7DNEkI3SXK4roL` | R$ 273.60 | 2026-06-10 | 2026-06-10T07:05:53+00:00 | pago |


## Recomendações e Análise de Erros

1. **Integração das Faturas**: Se houver transações marcadas como "Ausentes no Banco de Dados", isso indica que o webhook de notificação falhou ou que o processo de importação automatizada (seja via Wix API ou cron) não capturou essas vendas. Recomenda-se rodar uma sincronização forçada dessas IDs no Supabase.
2. **Divergências de Status**: Transações marcadas como `Recusadas` no Wix/Pagar.me que constam como `Aprovado/Pago` no app (ou vice-versa) geram relatórios gerenciais inflados e faturamento irreal. O status deve ser atualizado para condizer 100% com o gateway de pagamento.
3. **Otimizações do Banco**: Garanta que os scripts de índices criados anteriormente estão ativos para evitar gargalos durante buscas desse volume de transações.
