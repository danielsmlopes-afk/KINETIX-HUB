# KINETIX HUB - Architecture & Rules

## 🎯 Objetivo

Plataforma autônoma de alta performance esportiva com foco em periodização, compliance de volume, telemetria corporal, gestão preditiva de provas e controle logístico de suplementação.

## 🛠 Stack Tecnológica & Integrações

- **Backend:** Node.js + TypeScript + Hono.
- **Database/ORM:** PostgreSQL (Neon DB Serverless) + Drizzle ORM.
- **Frontend (Mobile UI):** Flutter (Dart) - 5 Abas: Dashboard, Planilha, Laboratório, Arsenal e Dossiês.
- **IA:** Google Gemini Pro & Groq.
- **Gerador de Relatórios:** PDFKit (Backend).
- **APIs:** Strava (SSOT), Telegram Bot, OpenWeatherMap, Firebase Admin (Autenticação/Push).
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
    │   ├── athleteController.ts  # Retorna dados do atleta
    │   └── telegramController.ts # Recepção de webhooks e comandos
    ├── db/
    │   ├── index.ts            # Conexão Drizzle + Neon
    │   ├── schema.ts           # Tabelas (athletes, races, consumables, etc)
    │   └── seed.ts             # Carga inicial (Exercícios, Tênis, Prova P2)
    ├── routes/
    │   └── api.ts              # Definição de endpoints HTTP
    ├── repositories/
    │   ├── athleteRepository.ts  # Buscas do atleta
    │   └── telemetryRepository.ts# Inserção em bioimpedance_logs
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

Cadastro de Provas: Exige Categoria (P1/P2/P3), Data, Distância, Horário da Largada e Local da Largada.

2. Matriz de Frequência e Overlapping
Sessões Independentes (UUIDs): Permite múltiplos treinos no mesmo dia.

Grade Base (10 sessões): Corrida (5x/sem), Bike (2x/sem), Força (3x/sem).

3. Normalização de Carga (PNL) e Esteira
PNL: Fatoramento de Esforço x (1 + (Altimetria / 1000)).

Esteira: Ignora GPS/Clima. Aquecimento 6,5 km/h, Desaquecimento 4,5 km/h. Repouso Passivo (<= 800m) e Ativo (> 800m).

4. Telemetria Corporal e Gráficos
Recepção via Telegram de Peso, % Gordura e TMB.

DataViz (Frontend): Gráficos cruzando adaptação metabólica com Carga (PNL).

5. Arsenal: Equipamentos e Suplementação
Gear Tracking: Rastreio do gear_id (Strava) para auditar a vida útil dos tênis.

Controle de Suprimentos: Monitoramento de estoque de géis de carboidrato e cápsulas de sal. Quando o saldo atinge o limite mínimo configurado, o bot envia um alerta de reposição via Telegram.

6. Head Coach IA: Briefings e Logística (Cron Jobs)
Briefing Diário (22h00): Treino de amanhã + Clima.

Estratégia Nutricional: 1º gel aos 60 min, demais a cada 30 min + 1 extra. A quantidade recomendada é deduzida do estoque automaticamente após a confirmação do treino.

Checklist Pré-Prova (Véspera): Horário de largada, vestimenta, nutrição calculada.

7. Relatórios Táticos (PDF)
Exportação autônoma: Dossiê de Macrociclo, Prontuário de Prova, Raio-X Fisiológico e Auditoria de Equipamentos.
