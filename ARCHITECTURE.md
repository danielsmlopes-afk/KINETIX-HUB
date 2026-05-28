# 🏗️ KINETIX HUB - Fonte Única de Verdade (Single Source of Truth)

## 📑 Índice
1.  Capítulo 1: Visão Geral e Compliance do Ecossistema
    *   Guia de Referência Técnica (SERVICES.md)
    *   Guia de Front-End e UI (APP.md)
    *   Stack Tecnológico & Ecossistema
    *   Status de Compliance e Zonas de Treinamento
    *   Funcionalidades Ativas
    *   Gestão de Dívida Técnica (Tech Debt)
    *   Próximos Passos
2.  Capítulo 2: Árvore de Diretórios (Clean Architecture)
3.  Capítulo 3: Dicionário de Arquivos Principais (Core Files)
4.  Capítulo 4: Schema do Banco de Dados (Drizzle ORM)
5.  Capítulo 5: Validação de Schema (Telemetria e Provas)
6.  Capítulo 6: Cronjobs e Automações (O Relógio Mestre)
7.  Capítulo 7: Endpoints de Força (IronLog)
8.  Capítulo 8: Endpoints de Dossiês e Relatórios (PDF Engine)
9.  Capítulo 9: Scripts Utilitários e Operações Táticas
10. Capítulo 10: Variáveis de Ambiente e Segurança (.env)

---

## Capítulo 1: Visão Geral e Compliance do Ecossistema

### Guia de Referência Técnica
Para um mapeamento exato de todos os Controladores, Rotas e Serviços do Backend, consulte obrigatoriamente o arquivo tático **`SERVICES.md`** na raiz da API.
Para o mapeamento do App Mobile, Clean Architecture e consumo da UI, consulte o documento **`src/docs/APP.md`**.

### Política de Sincronismo Temporal (Timezone)
O KINETIX HUB opera com **Fuso Horário Oficial Blindado em América/Sao_Paulo (UTC-3)**. 
* A "Meia-Noite Fantasma" de servidores em UTC não afeta os relógios mestres da aplicação. Todas as instâncias de datas computadas para consultas de briefings e painéis calculam o "hoje" e o "amanhã" usando a projeção explícita de calendário brasileiro (`new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })`).
* A orquestração global no `node-cron` força o fuso horário paramétrico para evitar descompassos em deploys internacionais (Neon/Render).

### Stack Tecnológico & Ecossistema
- **Backend**: Node.js + Hono (API REST leve e rápida). Validações rígidas de Schema com Zod.
- **Database**: Neon (PostgreSQL Serverless) gerenciado com Drizzle ORM (tipagem estrita, zero 'any').
- **Frontend**: Aplicativo Flutter com **Clean Architecture**, isolando lógicas de Apresentação (UI) das camadas de Domínio e Dados (API), agrupadas por `features` (`spreadsheet`, `dashboard`).
- **Motor de IA**: Gemini 2.5 Flash / Groq operando a inteligência tática (*Head Coach*).
- **Integrações**: Strava Webhooks, Telegram Bot API, OpenWeatherMap.

### Status de Compliance e Zonas de Treinamento
Os treinos e atividades passam por nossa Engine de Validação e são persistidos estritamente sob as seguintes flags:
- **`VALIDATED`**: Treino realizado rigorosamente dentro da planilha e metas traçadas.
- **`COMPLETED_NOT_VALIDATED`**: Atleta treinou, mas o volume ou ritmo divergiram (tolerância de +/- 3% e 15s) ou houve falha no protocolo de *Laps* (Esteira).
- **`MISSED`**: Treino não detectado na telemetria e marcado como perdido/faltante.
- **Zonas de Esforço**: Parametrizadas taticamente de Z1 a Z5 (Regenerativo ao Anaeróbico Máximo) balizando o motor de *Pacing*.

### Funcionalidades Ativas
1. **Ingestão Tática (CSV/JSON)**: Carga inteligente de macrociclos estruturados no banco.
2. **Radar de Telemetria (Strava)**: Captura de atividades via Webhook, dedução automática de Arsenal (vida útil do tênis) e Estoque (Géis).
3. **Dashboard Mobile (Flutter)**: UI reativa integrada com telemetria corporal e alertas climáticos (OpenWeatherMap).
4. **Briefing Diário (22h00)**: Notificação via Telegram contendo o checklist preditivo de logística militar (Regra de Ouro do Gel) para o dia seguinte.
5. **Motor Pré-Prova (07h00)**: Algoritmo preditivo temporal (D-3 Saturação, D-2 Pace Chart, D-1 Despertar Tático) com roteamento logístico (OSRM).
6. **Ajuste Manual de Compliance**: Endpoint de Fallback permitindo validação ou invalidação manual direto pela planilha tática em casos de falha do sensor *indoor*.
7. **Painel de Controle IA (Circuit Breaker)**: Interface de depuração (Debug) no App para disparar cronjobs manualmente, com fallback automático no Backend caso a API do Google Gemini sofra instabilidade.
8. **Análise Clínica Semanal (Bioimpedância)**: Ao registrar nova medição, o sistema compara com dados de 7 dias atrás e aciona a IA para um parecer clínico de deltas (Peso, Músculo, Gordura).
9. **Suporte a Dupla Distância (UI)**: Cards de treino no Flutter renderizam simultaneamente a distância real da planilha vs distância do painel (consolidada com repouso) para validação visual em esteira.
10. **Algoritmo de Periodização Dinâmica (IA - BioMedal V11)**: A geração de macrociclos pelo Head Coach segue as Leis Imutáveis do Micro-Ciclo:
11. **Barra de Progresso de Prova (P1)**: O aplicativo mobile calcula nativamente a progressão do macrociclo na UI, baseado na diferença entre a data atual e a data da prova alvo, dando feedback visual de aderência.
11. **Digital Twin Endurance (V12.2)**: A telemetria de longo curso extraída do Strava alimenta o modelo preditivo, renderizando análises de Pace vs Frequência Cardíaca na UI do App nativo através da integração gráfica com o `fl_chart`.
    - **Mesociclo 3:1**: Aplicação de blocos de 3 semanas de carga contínua seguidas por 1 semana obrigatória de *Deload* (redução de 30-40% do volume).
    - **Janelas Estratégicas P2**: Alocação de provas secundárias (P2) rigorosamente nas semanas 4/5 ou 11/12 do ciclo da prova P1 alvo.
    - **Proteção Articular e do Longão**: É terminantemente proibido alocar a Ficha A (Inferiores) aos sábados.
    - **Isolamento de Painel de Esteira**: O fracionamento de Aquecimento e Desaquecimento na base de dados ocorre de forma condicional, exclusivamente para treinos intervalados (Tiros). Outras rodagens possuem métricas consolidadas em painel único.

### Gestão de Dívida Técnica (Tech Debt)
- **Dados Mockados (Frontend)**: O *Arsenal* e o painel de Debug já estão consumindo dados reais. Foco total em conectar as Fichas de *Laboratório* via Repositórios no Backend.
- **Engine de ACWR**: Refatorar o monitoramento de Carga Aguda vs. Crônica para refletir as punições e compensações das rotas `COMPLETED_NOT_VALIDATED`.

### Próximos Passos
- Finalizar a injeção/cruzamento da UI do **Laboratório (Fichas de Força / IronLog)**.
- Aprimorar relatórios visuais estendendo as lógicas do motor nativo de PDF.

---

## Capítulo 2: Árvore de Diretórios (Clean Architecture)

Abaixo detalhamos a arquitetura física (Clean Architecture adaptada) presente no servidor e no App:

**Backend (`kinetix-api/`)**
```text
kinetix-api/
├── src/
│   ├── config/        # Variáveis de ambiente e loaders (env.ts)
│   ├── controllers/   # Regras de roteamento e extração de payload (ex: coachController)
│   ├── db/            # Conexão Drizzle ORM, schema (schema.ts) e migrações
│   ├── repositories/  # Acesso abstrato a dados / queries isoladas (ex: stravaRepository)
│   ├── routes/        # Declaração das rotas Hono (api.ts, coachRoutes.ts, debugRoutes.ts)
│   ├── scripts/       # Scripts autônomos de manipulação (ex: updateWarmups.ts)
│   │   └── seedBioimpedance.ts # Ingestor clínico (Parser CSV OKOK)
│   └── services/      # Coração das regras de negócio, APIs externas, Cronjobs e IAs
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
│       │   └── widgets/ # Componentização SOLID (UpcomingWorkoutsCard com ExpansionTile híbrido para Aquecimento/Desaquecimento).
│       ├── dossiers/    # Relatórios em PDF
│       │   ├── dossier_panel.dart    # Painel executivo que utiliza url_launcher para downloads de PDF.
│       ├── laboratory/  # Fichas de força
│       └── spreadsheet/ # Planilha tática
└── pubspec.yaml
```

## 🧠 CAPÍTULO 2: Dicionário de Arquivos Principais (Core Files)

- **`[coachService.ts]`** (`kinetix-api/src/services/coachService.ts`): Cérebro do sistema de auditoria. Analisa os webhooks do Strava cruzando com a planilha para determinar compliance de *volume*, *intensidade*, rua e esteira.
- **`[macrocycleService.ts]`** (`kinetix-api/src/services/macrocycleService.ts`): Serviço autônomo que intercepta cadastros de provas e gera via Head Coach IA a estrutura tática de um macrociclo dinâmico adaptado às semanas restantes e prioridade (P1/P2/P3), com notificações ao Telegram.
- **`[reportController.ts]` & `[pdfGeneratorService.ts]`**: Motor Vetorial responsável por gerar PDFs nativos via `pdfkit` (Logbook, Raio-X, Auditoria de Força), encapsulando lógica de primitivas de desenho geométrico para gráficos.
- **`[dossierController.ts]`**: Controlador executivo que lista relatórios gerados/salvos e fornece as URLs para o `url_launcher` do Flutter.
- **`[strengthRepository.ts]`** (`kinetix-api/src/repositories/strengthRepository.ts`): Gerencia a persistência das Fichas de Treino e Auditoria (IronLog), isolando lógicas de JOIN entre templates, exercícios e os registros efetivamente realizados na sessão.
- **`[headCoachService.ts]`** (`kinetix-api/src/services/headCoachService.ts`): Motor Cognitivo (Gemini/IA). Inclui proteção de *Circuit Breaker* e respostas de contingência para evitar gargalos na API do Google.
- **`[stravaController.ts]`** (`kinetix-api/src/controllers/stravaController.ts`): O Portão de Entrada. Recebe e valida a assinatura dos eventos do Strava, despacha de forma assíncrona (não-bloqueante) a dedução de logística (Géis) e arsenal (Tênis) via `workoutService`, e repassa Laps e Flags para a validação tática do Coach.
- **`[treadmillProtocol.ts]`** (`kinetix-api/src/services/treadmillProtocol.ts`): Isolamento matemático para validação estrita de atividades indoor (Ignora o GPS, reconstrói parciais via Moving Time e calcula margens dinâmicas de repouso passivo).
- **`[briefingService.ts]`** (`kinetix-api/src/services/briefingService.ts`): Orquestrador do Briefing Diário Noturno. Aplica as regras de ouro logísticas (Gel vs Hidratação) montando o payload em MarkdownV2 rígido.
- **`[morningRaceService.ts]`** (`kinetix-api/src/services/morningRaceService.ts`): Motor Pré-Prova Matinal. Executa os protocolos de contingência D-3 (Saturação de Glicogênio), D-2 (Pace Chart e Géis) e D-1 (Checklist de Véspera).
- **`[cronJobs.ts]`** (`kinetix-api/src/services/cronJobs.ts`): Relógio Mestre do sistema, responsável por inicializar as varreduras diárias com auxílio da Inteligência Artificial.
- **`[schema.ts]`** (`kinetix-api/src/db/schema.ts`): A espinha dorsal dos dados. Onde todas as tabelas em PostgreSQL são definidas.
- **`[telegramController.ts]`** (`kinetix-api/src/controllers/telegramController.ts`): Orquestra as tendências de bioimpedância calculando deltas semanais e interagindo com a IA para emitir Alertas Vermelhos de nutrição.
- **`[debugRoutes.ts]`** (`kinetix-api/src/routes/debugRoutes.ts`): Endpoints de injeção manual permitindo que o Comandante dispare varreduras temporais no frontend fora da janela agendada.
- **`[api_client.dart]`** (`kinetix_app/lib/core/network/api_client.dart`): Wrapper de rede que lida com os tokens de autenticação (Firebase) e se comunica com o Hono.
- **`[dashboard_screen.dart]`** (`kinetix_app/lib/features/dashboard/dashboard_screen.dart`): UI principal que congrega o consumo de APIs fisiológicas, metas e exibe os selos de compliance do dia.
- **`[upcoming_races_card.dart]` / `[upcoming_workouts_card.dart]`**: Componentes Flutter operando de forma isolada. O `UpcomingWorkoutsCard` utiliza o `ExpansionTile` para *Glanceability* da Série Principal no estado colapsado, ocultando detalhes periféricos (Aquecimento, Desaquecimento, Repouso) sob demanda na expansão.
- **`[lab_screen.dart]`** (`kinetix_app/lib/features/laboratory/lab_screen.dart`): Tela principal do Laboratório. Consome a rota `/api/strength/templates` para listar as fichas de treino (A, B, C) disponíveis para o atleta.
- **`[iron_log_screen.dart]`** (`kinetix_app/lib/features/laboratory/iron_log_screen.dart`): Interface de registro do treino de força (IronLog). Ao receber uma ficha, busca seus exercícios e permite que o atleta insira a carga (kg) e repetições realizadas, persistindo a sessão via `POST /api/strength/log`.
- **`[reports_screen.dart]`** (`kinetix_app/lib/features/dossiers/reports_screen.dart`): Tela que exibe e possibilita o download assíncrono em array de bytes dos relatórios PDF gerados nativamente pelo motor vetorial Hono.

---

## Capítulo 4: Schema do Banco de Dados (Drizzle ORM)

- **`GET /api/strength/templates`**: Retorna a relação completa das fichas de treino com o detalhamento de exercícios, séries e repetições (Faz o JOIN de `workout_templates`, `workout_template_items` e `exercise_library`).
- **`GET /api/strength/templates/:id/exercises`**: Retorna cirurgicamente os exercícios de uma ficha em particular.
- **`POST /api/strength/log`**: Registra uma nova sessão no Laboratório. Injeta o cabeçalho base em `workout_sessions` e o detalhamento executado de carga e repetição em `strength_logs`.
- **`GET /api/strength/log/:sessionId/audit`**: Retorna o espelho comparativo da auditoria tática (Planilha Base vs Execução Real).

Estrutura consolidada do nosso PostgreSQL Serverless (Neon):

### 1. `athletes`
- **Função:** Identidade primária.
- **Colunas:** `id` (UUID, PK), `name` (Text), `stravaAccessToken`, `stravaRefreshToken`, `stravaExpiresAt` (Int), `homeLat`, `homeLon`.

### 2. `planned_workouts` (A Planilha Tática)
- **Função:** Alvos semanais traçados pelo Coach.
- **Colunas:**
  - `id` (UUID, PK)
  - `athleteId` (FK -> athletes)
  - `date` (Timestamp), `activityType` (Text: RUN, BIKE, STRENGTH)
  - `title` (Text), `details` (JSONB)
  - **`warmup`** (Text): Protocolo de aquecimento (ex: '10min trote leve').
  - **`cooldown`** (Text): Protocolo de desaquecimento (ex: '5min soltura').
  - **`restDetails`** (Text): Tempo e tipo de repouso para treinos intervalados, agora renderizado na Planilha do App.
  - **`complianceStatus`** (Text): Recebe o atestado do motor: `VALIDATED`, `COMPLETED_NOT_VALIDATED` ou `MISSED`.

### 3. `workout_sessions` & `treadmill_intervals` (As Execuções)
- **Função:** Registo dos treinos de fato realizados (após telemetria ou inclusão manual).
- **Colunas Principais:** `id` (UUID), `durationMinutes` (Int), `distance` (Float), `warmup` e `cooldown` (Text). `treadmill_intervals` guarda parciais com FK para `sessionId`.

### 4. `races` (Provas Alvo)
- **Função:** Provas P1/P2/P3 registradas pelo atleta e orquestradas pela IA.
- **Colunas Principais:** `id` (UUID), `category`, `priority`, `date` (Timestamp), `startTime` (Text), `distance` (Float), `address` (Usado para OSRM Engine), `latitude`, `longitude`, `movingTime`, `weather`, `polyline` (GPS trace).

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

---

## Capítulo 5: Validação de Schema (Telemetria e Provas)

O banco de dados foi preparado e parametrizado para suportar o motor cognitivo:
- **`races`**: Possui a exclusividade sobre os alvos, englobando colunas logísticas vitais como `address`, `startTime`, `priority`, `latitude` e `longitude`. Responsável direto pelo acionamento do motor OSRM e Despertar Tático.
- **`planned_workouts`**: (Atualização V12.2) Detém o detalhamento fracionado de treino. O campo JSONB `details` isola as modalidades (`corrida`, `academia`, `bike`, `restDetails`). O acesso ao Drizzle é executado com cast rigoroso (`type WorkoutDetails`) para proteção em ambiente cloud, coibindo erros `TS2339`. A tabela agora inclui `mesocycle_stage` (fase do ciclo), `macrocycle_target` (prova alvo) e `long_run_performance_log` (JSONB para o Digital Twin de Endurance).
- **`athletes`**: Inclui `homeLat` e `homeLon` mapeadas em dupla precisão flutuante para assegurar cálculos de geolocalização.

---

## Capítulo 6: Cronjobs e Automações (O Relógio Mestre)

A engrenagem autônoma do KINETIX HUB (V12.2) opera com **Fuso Horário Oficial de São Paulo (UTC-3)** para orquestrar os protocolos militares:

1. **`07:00` (Morning Race Job)**: O sistema analisa o calendário de provas (`races`). Dispara os protocolos táticos D-3 (Saturação de Glicogênio e Clima), D-2 (Arsenal de Géis e Pace Chart) e D-1 (Logística de Combate, Cálculo do Despertar Tático OSRM e Waze).
2. **`14:59` (Domingo - Digital Twin)**: Varredura no Strava pelo longão do dia. Aciona a IA para gerar o `long_run_performance_log` e dispara alerta interativo de feedback no Telegram.
3. **`15:00` (Domingo - Relatórios)**: Geração do relatório semanal em PDF (WeasyPrint) em 3 camadas, baseado no `mesocycle_stage` (Planilha, Diário de Viagem ou Dossiê de Prova).
4. **`22:30` (Daily Briefing Job)**: Analisa o treino planejado (`plannedWorkouts`) para o dia seguinte e envia o resumo tático, PoP (Probabilidade de Chuva OpenWeatherMap), Arsenal Logístico e Visão do Macrociclo ao Comandante no Telegram.
5. **`23:30` (Route Recalculation Job)**: Auditoria final do dia (Compliance). Verifica se havia um treino programado para hoje e se ele de fato aconteceu (via telemetria do Strava). Se houver quebra (MISSED), a IA é engatilhada para analisar toda a semana do atleta e propor um Recálculo da Rota ou Cancelamento do evento.

*NOTA: Todos os cronjobs podem ser forçados instantaneamente pela ABA DE EQUIPAMENTOS no aplicativo Mobile através do Painel de Controle IA.*

---

## Capítulo 7: Endpoints de Força (IronLog)

O módulo do Laboratório expõe rotas restritas para a renderização do IronLog no Frontend Flutter:

- **`GET /api/strength/templates`**: Retorna a relação completa das fichas de treino com o detalhamento de exercícios, séries e repetições (Faz o JOIN de `workout_templates`, `workout_template_items` e `exercise_library`).
- **`GET /api/strength/templates/:id/exercises`**: Retorna cirurgicamente os exercícios de uma ficha em particular.
- **`POST /api/strength/log`**: Registra uma nova sessão no Laboratório. Injeta o cabeçalho base em `workout_sessions` e o detalhamento executado de carga e repetição em `strength_logs`.
- **`GET /api/strength/log/:sessionId/audit`**: Retorna o espelho comparativo da auditoria tática (Planilha Base vs Execução Real).

---

## Capítulo 8: Endpoints de Dossiês e Relatórios (PDF Engine)

O motor vetorial expõe relatórios dinâmicos diretamente em *Buffer* binário, consumidos pela `reports_screen.dart`:

- **`GET /api/dossiers`**: Lista os dossiês executivos estáticos/cloud em JSON.
- **`GET /api/reports/logbook/latest`**: Baixa o Diário de Viagem em PDF (Gráfico ACWR).
- **`GET /api/reports/career/me`**: Baixa o Histórico de Combate em PDF.
- **`GET /api/reports/race/next`**: Baixa o Prontuário de Missão P1 (Checklist & Smart Pace).
- **`GET /api/reports/cardio/current`**: Baixa o Raio-X Cardiovascular do Mês em PDF.
- **`GET /api/reports/strength-audit/:sessionId`**: Baixa a auditoria rigorosa de um treino do IronLog.

---

## Capítulo 9: Scripts Utilitários e Operações Táticas

- **`seedBioimpedance.ts`**: Ferramenta de linha de comando (`src/scripts`) para fazer o parse e a ingestão do histórico clínico do atleta. O script é desenhado para ignorar metadados irregulares das exportações da app OKOK e injetar as leituras em massa de forma segura na tabela `bioimpedance_logs`.

---

## Capítulo 10: Variáveis de Ambiente e Segurança (.env)

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

> **🚨 ALERTA DE SEGURANÇA (AUDIENCE MISMATCH):**
> O `FIREBASE_PROJECT_ID` do Backend (e sua respectiva *Service Account JSON*) **DEVE ser estritamente igual** ao `projectId` configurado no Frontend (`lib/firebase_options.dart`). 
> Divergências entre projetos (ex: App a gerar JWT em `kinetix-hub` e Hono a validar em `danielprocoach`) causarão o erro bloqueante de `incorrect "aud" (audience) claim` e a API retornará 401 Unauthorized.
