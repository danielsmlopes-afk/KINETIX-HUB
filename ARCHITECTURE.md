# 🏗️ KINETIX HUB - Fonte Única de Verdade (Single Source of Truth)

## 🧠 Stack Tecnológico & Ecossistema
- **Backend**: Node.js + Hono (API REST leve e rápida). Validações rígidas de Schema com Zod.
- **Database**: Neon (PostgreSQL Serverless) gerenciado com Drizzle ORM (tipagem estrita, zero 'any').
- **Frontend**: Aplicativo Flutter com **Clean Architecture**, isolando lógicas de Apresentação (UI) das camadas de Domínio e Dados (API), agrupadas por `features` (`spreadsheet`, `dashboard`).
- **Motor de IA**: Gemini 2.5 Flash / Groq operando a inteligência tática (*Head Coach*).
- **Integrações**: Strava Webhooks, Telegram Bot API, OpenWeatherMap.

## 🎯 Status de Compliance e Zonas de Treinamento
Os treinos e atividades passam por nossa Engine de Validação e são persistidos estritamente sob as seguintes flags:
- **`VALIDATED`**: Treino realizado rigorosamente dentro da planilha e metas traçadas.
- **`COMPLETED_NOT_VALIDATED`**: Atleta treinou, mas o volume ou ritmo divergiram (tolerância de +/- 3% e 15s) ou houve falha no protocolo de *Laps* (Esteira).
- **`MISSED`**: Treino não detectado na telemetria e marcado como perdido/faltante.
- **Zonas de Esforço**: Parametrizadas taticamente de Z1 a Z5 (Regenerativo ao Anaeróbico Máximo) balizando o motor de *Pacing*.

## ✅ Funcionalidades Ativas
1. **Ingestão Tática (CSV/JSON)**: Carga inteligente de macrociclos estruturados no banco.
2. **Radar de Telemetria (Strava)**: Captura de atividades via Webhook, dedução automática de Arsenal (vida útil do tênis) e Estoque (Géis).
3. **Dashboard Mobile (Flutter)**: UI reativa integrada com telemetria corporal e alertas climáticos (OpenWeatherMap).
4. **Briefing Diário**: Cronjob de notificação via Telegram contendo o checklist preditivo para o dia seguinte.
5. **Ajuste Manual de Compliance**: Endpoint de Fallback permitindo validação ou invalidação manual direto pela planilha tática em casos de falha do sensor *indoor*.

## ⚠️ Gestão de Dívida Técnica (Tech Debt)
- **Dados Mockados (Frontend)**: Progressiva eliminação do uso de mock data no Flutter. Elementos residuais nas listagens do *Arsenal* e Fichas de *Laboratório* devem ser ligados 100% via Repositórios no Backend.
- **Engine de ACWR**: Refatorar o monitoramento de Carga Aguda vs. Crônica para refletir as punições e compensações das rotas `COMPLETED_NOT_VALIDATED`.

## 🚀 Próximos Passos
- Finalizar a injeção/cruzamento da tabela do **Laboratório (Fichas de Força / IronLog)**.
- Implementação visual nativa para a janela de Inclusão de Provas (Race Input).
- Painel de download automático dos Dossiês em formato PDF.

---

## 📂 CAPÍTULO 1: Árvore de Diretórios Completa

Abaixo detalhamos a arquitetura física (Clean Architecture adaptada) presente no servidor e no App:

**Backend (`kinetix-api/`)**
```text
kinetix-api/
├── src/
│   ├── config/        # Variáveis de ambiente e loaders (env.ts)
│   ├── controllers/   # Regras de roteamento e extração de payload (ex: coachController)
│   ├── db/            # Conexão Drizzle ORM, schema (schema.ts) e migrações
│   ├── repositories/  # Acesso abstrato a dados / queries isoladas (ex: stravaRepository)
│   ├── routes/        # Declaração das rotas Hono (api.ts, coachRoutes.ts)
│   ├── scripts/       # Scripts autônomos de manipulação (ex: updateWarmups.ts)
│   └── services/      # Coração das regras de negócio, APIs externas e IAs
├── .env               # (Ignorado no Git) Variáveis locais
└── package.json
```

**Frontend (`kinetix_app/`)**
```text
kinetix_app/
├── lib/
│   ├── core/
│   │   ├── network/   # Cliente HTTP customizado (api_client.dart)
│   │   └── theme/     # Estilização global e paleta de cores
│   └── features/      # Clean Architecture: Isolamento por Domínio
│       ├── arsenal/     # Tênis e vida útil
│       ├── dashboard/   # Hub Central (Hoje, Amanhã, Bioimpedância)
│       ├── dossiers/    # Relatórios em PDF
│       ├── laboratory/  # Fichas de força
│       └── spreadsheet/ # Planilha tática
└── pubspec.yaml
```

## 🧠 CAPÍTULO 2: Dicionário de Arquivos Principais (Core Files)

- **`[coachService.ts]`** (`kinetix-api/src/services/coachService.ts`): Cérebro do sistema de auditoria. Analisa os webhooks do Strava cruzando com a planilha para determinar compliance de *volume*, *intensidade*, rua e esteira.
- **`[headCoachService.ts]`** (`kinetix-api/src/services/headCoachService.ts`): Motor Cognitivo (Gemini/IA). Cuida de requisições abstratas como recálculo de rotas e criação de macrociclos inteiros para provas alvo.
- **`[stravaController.ts]`** (`kinetix-api/src/controllers/stravaController.ts`): O Portão de Entrada. Recebe e valida a assinatura dos eventos do Strava e repassa Laps e Flags para validação.
- **`[treadmillProtocol.ts]`** (`kinetix-api/src/services/treadmillProtocol.ts`): Isolamento matemático para validação estrita de atividades indoor (Ignora o GPS e reconstrói parciais via Moving Time).
- **`[schema.ts]`** (`kinetix-api/src/db/schema.ts`): A espinha dorsal dos dados. Onde todas as tabelas em PostgreSQL são definidas.
- **`[api_client.dart]`** (`kinetix_app/lib/core/network/api_client.dart`): Wrapper de rede que lida com os tokens de autenticação (Firebase) e se comunica com o Hono.
- **`[dashboard_screen.dart]`** (`kinetix_app/lib/features/dashboard/dashboard_screen.dart`): UI principal que congrega o consumo de APIs fisiológicas, metas e exibe os selos de compliance do dia.

## 🔐 CAPÍTULO 3: Variáveis de Ambiente (.env Schema)

As chaves de sistema garantem a segurança e conectividade do motor. **Nunca insira valores reais aqui.**

- **`DATABASE_URL`**: String de conexão ao banco de dados PostgreSQL (Neon DB).
- **`PORT`**: Porta operacional do backend Hono.
- **`GEMINI_API_KEY`**: Chave do Google AI Studio para instanciar o *Head Coach*.
- **`STRAVA_CLIENT_ID`**: ID numérico fornecido pelo painel do desenvolvedor do Strava.
- **`STRAVA_CLIENT_SECRET`**: Segredo para troca de tokens com a API do Strava.
- **`STRAVA_REDIRECT_URI`**: URL de retorno pós-autenticação OAuth.
- **`STRAVA_VERIFY_TOKEN`**: String manual para validar o aperto de mãos na criação do Webhook.
- **`TELEGRAM_BOT_TOKEN`**: Token do @BotFather para disparar o Briefing Diário e Análises.
- **`TELEGRAM_CHAT_ID`**: ID do canal/grupo focado entre o Atleta e o Sistema.
- **`OPENWEATHER_API_KEY`**: Chave de telemetria climática (Pacing/Temperatura).
- **`FIREBASE_PROJECT_ID`**: Variável do Middleware de Autenticação (App <-> Hono).

## 🗄️ CAPÍTULO 4: Schema do Banco de Dados (Drizzle ORM)

Estrutura consolidada do nosso PostgreSQL Serverless (Neon):

### 1. `athletes`
- **Função:** Identidade primária.
- **Colunas:** `id` (UUID, PK), `name` (Text), `stravaAccessToken`, `stravaRefreshToken`, `stravaExpiresAt` (Int).

### 2. `planned_workouts` (A Planilha Tática)
- **Função:** Alvos semanais traçados pelo Coach.
- **Colunas:**
  - `id` (UUID, PK)
  - `athleteId` (FK -> athletes)
  - `date` (Timestamp), `activityType` (Text: RUN, BIKE, STRENGTH)
  - `title` (Text), `details` (JSONB)
  - **`warmup`** (Text): Protocolo de aquecimento (ex: '10min trote leve').
  - **`cooldown`** (Text): Protocolo de desaquecimento (ex: '5min soltura').
  - **`complianceStatus`** (Text): Recebe o atestado do motor: `VALIDATED`, `COMPLETED_NOT_VALIDATED` ou `MISSED`.

### 3. `workout_sessions` & `treadmill_intervals` (As Execuções)
- **Função:** Registo dos treinos de fato realizados (após telemetria ou inclusão manual).
- **Colunas Principais:** `id` (UUID), `durationMinutes` (Int), `distance` (Float), `warmup` e `cooldown` (Text). `treadmill_intervals` guarda parciais com FK para `sessionId`.

### 4. `races` (Provas Alvo)
- **Função:** Provas P1/P2 registradas pelo atleta.
- **Colunas Principais:** `id` (UUID), `category` (Text), `date` (Timestamp), `distance` (Float), `startLocation`, `movingTime`, `weather`, `polyline` (GPS trace).

### 5. `bioimpedance_logs` (Saúde/Laboratório)
- **Função:** Adaptação metabólica e métricas do peso.
- **Colunas Principais:** `weight`, `bodyFat`, `muscleMass`, `metabolicAge`, `tmb` (Floats / Ints). Relacionado por `athleteId`.

### 6. Tabelas de Arsenal e Laboratório
- **`shoes`**: Gerencia tênis. Relaciona pelo `stravaGearId`. Coluna `mileage` rastreia rodagem.
- **`consumables`**: `currentStock` e `alertThreshold` de Géis e Sais.
- **`exercise_library`** e **`workout_templates`**: Modelos pré-fabricados de musculação, relacionados N:N via **`workout_template_items`**.

### 7. Tabelas de Filas Táticas
- **`cron_logs`**: Guarda o resultado de execuções de rotinas (Briefing).
- **`pending_actions`**: Eventos não processados exigindo tomada de decisão do usuário ou Head Coach.
