# KINETIX HUB - Architecture & Rules

## 🎯 Objetivo

Plataforma autônoma de alta performance esportiva com foco em periodização, compliance de volume, telemetria corporal, gestão preditiva de provas e controle logístico de suplementação.

## 🛠 Stack Tecnológica & Integrações

- **Backend:** Node.js + TypeScript + Hono.
- **Database/ORM:** PostgreSQL (Neon DB Serverless) + Drizzle ORM.
- **Frontend (Mobile UI):** Flutter (Dart) - 5 Abas: Dashboard, Planilha, Laboratório, Arsenal e Dossiês.
- **IA:** Google Gemini Pro & Groq.
- **Gerador de Relatórios:** PDFKit (Backend).
- **APIs:** Strava (SSOT), Telegram Bot (Webhook & Alertas), OpenWeatherMap, Firebase Admin (Autenticação/Push).
- **Diretriz Zero Google:** Proibido o uso de APIs complexas do ecossistema Google para funções que podem ser resolvidas com alternativas nativas ou enxutas.

## 📂 Estrutura de Pastas (Backend)

O repositório `/kinetix-api` obedece rigorosamente à seguinte árvore de arquivos modulares:

```text
kinetix-api/
├── .env                        # Credenciais de produção (Não versionado)
├── .gitignore                  # Regras de exclusão do Git
├── ARCHITECTURE.md             # Lei mestre de regras de negócio
├── drizzle.config.ts           # Configuração de conexão do Drizzle ORM
├── package.json                # Dependências e scripts (Hono, Zod, Drizzle)
├── tsconfig.json               # Configurações do TypeScript e Path Aliases
└── src/
    ├── index.ts                # Ponto de entrada do servidor Hono
    ├── config/
    │   └── env.ts              # Validação Zod estrita do .env
    ├── controllers/
    │   ├── athleteController.ts  # Retorna dados do atleta principal (Single-Tenant)
    │   ├── reportController.ts   # Orquestração do download de PDFs
    │   └── telegramController.ts # Recepção de webhooks e comandos do Telegram
    ├── db/
    │   ├── index.ts            # Conexão Drizzle + Neon
    │   ├── schema.ts           # Tabelas (athletes, races, consumables, etc)
    │   └── seed.ts             # Carga inicial (Exercícios, Tênis, Prova P2)
    ├── routes/
    │   └── api.ts              # Definição de endpoints HTTP
    │   ├── reportRoutes.ts     # Rotas isoladas para geração de Dossiês
    │   └── telegramRoutes.ts   # Rotas do webhook do Telegram
    ├── repositories/
    │   ├── athleteRepository.ts  # Buscas do atleta principal
    │   └── telemetryRepository.ts# Inserção em bioimpedance_logs
    ├── validators/
    │   └── workoutSchema.ts      # Schemas Zod para tipagem estrita e validação de payloads (JSON)
    └── services/
        ├── briefingService.ts      # Montagem do briefing diário/sábado e checklist
        ├── cronJobs.ts             # Disparo autônomo do Telegram às 22h
        ├── inventoryService.ts     # Baixa de estoque e alertas de reposição
        ├── loadCalculator.ts       # Fatoramento matemático do PNL
        ├── nutritionCalculator.ts  # Estratégia de géis intra-treino
        ├── pdfGeneratorService.ts  # Estrutura base do PDFKit para dossiês
        └── treadmillProtocol.ts    # Validação de repouso (Ativo/Passivo)
📏 Regras Inquebráveis
Atomicidade: Máximo de 150 linhas por arquivo.

Tipagem Estrita: Sem any. Zod para .env e payloads.

Respostas HTTP: Sucesso { data: ... } | Erro { error: "Mensagem", code: "CODE" }.

Drizzle-first: Toda migração de banco via Drizzle CLI.

🧠 Regras de Negócio Core
1. Gestão de Provas e Macrociclos (16 Semanas)
O sistema gera ciclos de 16 semanas (3 carga + 1 descarga).

Cadastro de Provas: Suporta importação histórica via Strava e Inclusão Manual de provas futuras. O agendamento manual exige: Nome, Categoria (P1/P2/P3), Data, Distância, Horário da Largada e Local da Largada.

2. Matriz de Frequência e Overlapping
Sessões Independentes (UUIDs): Permite múltiplos treinos no mesmo dia.

Grade Base (10 sessões): Corrida (5x/sem), Bike (2x/sem), Força (3x/sem).

**3. Normalização de Carga (PNL) e Esteira**
PNL: Fatoramento de Esforço x (1 + (Altimetria / 1000)).

Esteira: Ignora GPS/Clima. Aquecimento 6,5 km/h, Desaquecimento 4,5 km/h. Repouso Passivo (<= 800m) e Ativo (> 800m).

**4. Telemetria Corporal e Gráficos**
Recepção via Telegram de Peso, % Gordura e TMB.

DataViz (Frontend): Gráficos cruzando adaptação metabólica com Carga (PNL).

**5. Arsenal: Equipamentos e Suplementação**
Gear Tracking: Rastreio do gear_id (Strava) para auditar a vida útil dos tênis.

Controle de Suprimentos: Monitoramento de estoque de géis de carboidrato e cápsulas de sal. Quando o saldo atinge o limite mínimo configurado, o bot envia um alerta de reposição via Telegram.

**6. Head Coach IA: Briefings e Logística (Cron Jobs)**
Briefing Diário (22h00): Treino de amanhã + Clima.

Estratégia Nutricional: 1º gel aos 60 min, demais a cada 30 min + 1 extra. A quantidade recomendada é deduzida do estoque automaticamente após a confirmação do treino.

Checklist Pré-Prova (Véspera): Horário de largada, vestimenta, nutrição calculada.

**Recálculo de Rota (Adaptação Dinâmica):** Caso o sistema detecte que um treino planejado foi "pulado" (ausência de dados no Strava) ou cancelado manualmente, a IA avalia o impacto no volume semanal e sugere adaptações (compensação ou descanso) para as próximas sessões.

**Geração Autônoma de Macrociclo:** O Head Coach IA pode estruturar do zero ou adaptar ciclos de treino baseados em provas alvo (P1/P2), salvando-os de forma estruturada diretamente no banco de dados.

**7. Relatórios Táticos (PDF)**
Exportação autônoma: Dossiê de Macrociclo, Prontuário de Prova, Raio-X Fisiológico, Auditoria de Equipamentos e Planilha de Treinamentos (Gerada dinamicamente).
Uso estrito do PDFKit desenhando gráficos nativamente (sem dependências de Canvas extras).

**8. Planilha de Treinamentos (Importação JSON)**
Ingestão de macrociclos estruturados via JSON. O parser mapeia a rotina diária do atleta definindo:
- `corrida` (Tipo de Atividade, Distância, Pace, Velocidade).
- `musculacao` (Grupo muscular/Foco).
- `bike` (Duração/Volume).
Esses dados alimentam diretamente o calendário do atleta e cruzam com o "Briefing Diário".
**Regra de Ouro de Periodização:** Treinos importados via planilha (JSON) possuem prioridade absoluta e precedência. Eles sempre sobrescrevem qualquer cálculo automático gerado pelo motor autônomo do sistema para as referidas datas.

### 9. Gestão Dinâmica de Treino de Força
- **Biblioteca de Exercícios:** Base de dados com ~200 movimentos pré-cadastrados (categoria, grupamento muscular, foco principal).
- **Fichas (Workouts):** O sistema não atrela o exercício diretamente ao dia. Ele utiliza **"Fichas"** (ex: Treino A, Treino B, Treino C).
- **Flexibilidade:** A qualquer momento, uma ficha pode ser reconfigurada via JSON ou Interface, atualizando os exercícios, séries e repetições sem invalidar o histórico.
- **Auditoria:** O sistema guarda o log do que foi realizado (carga/reps) comparado ao que estava na ficha daquele dia (planejado vs. realizado).

---

## 🚀 Roadmap de Desenvolvimento

- [x] **Fase 1: Setup & Fundação** - Configuração Hono, Drizzle ORM, Neon DB e estrutura de pastas modular.
- [x] **Fase 2: Core de Dados & Telemetria** - Definição do schema DB, Seed inicial, e Webhook do Telegram recebendo o JSON completo da Bioimpedância.
- [x] **Fase 3: Motor de Relatórios** - Endpoint e Serviço PDFKit para gerar o "Raio-X Fisiológico Mensal" com gráficos nativos, cruzando dados reais do banco.
- [x] **Fase 4: Single-Tenant Architect** - Refatoração para que o sistema identifique automaticamente o Atleta Principal sem depender de UUIDs na URL.
- [x] **Fase 5: Integração Strava (SSOT)** - Autenticação OAuth2, webhook de atividades em tempo real (Webhook ID ativo: `348336`), atualização de quilometragem de Tênis (`gear_id`) e importação do histórico de carreira com mapas vetoriais nativos, tempo, pace e clima retroativo (Open-Meteo).
- [x] **Fase 5.1: Agendamento de Provas** - Rota e serviço de inclusão manual de provas futuras para alimentar o motor de periodização (P1/P2/P3).
- [x] **Fase 5.2: Planilha de Treinos (JSON)** - Schema DB e endpoint de ingestão de macrociclos (Corrida, Musc, Bike) para o calendário.
- [ ] **Fase 6: Clima e Logística** - Chamadas ao OpenWeatherMap para alimentar o Briefing Diário (Logística de baixa de estoque intra-treino no webhook já concluída).
- [x] **Fase 7: Head Coach IA** - Conectar Gemini/Groq para recálculo de rota, geração autônoma de Macrociclos (estruturado em JSON) e exportação da Planilha em PDF.
- [ ] **Fase 7.1: Testes do Ciclo** - Realizar testes de ponta a ponta na geração e adaptação do ciclo de treinos estruturado pela IA.
- [ ] **Fase 8: Segurança e App Mobile** - Firebase Auth e construção das telas no Flutter (Dashboard, Planilha, Lab, Arsenal, Dossiês).
