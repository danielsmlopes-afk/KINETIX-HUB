# 📱 KINETIX APP - Arquitetura de UI e Fluxo Mobile

Este documento serve como mapa único da verdade (SSOT) para o projeto Flutter do ecossistema Kinetix Hub. Ele mapeia os padrões arquiteturais, o isolamento por features e as regras estritas de consumo da API V11.1.

## 1. 🏗️ Padrão Arquitetural (Clean Architecture + Feature-First)

O aplicativo móvel KINETIX (Flutter) é construído sob uma arquitetura limpa e orientada a recursos (Feature-First). Isso garante escalabilidade militar, facilidade de manutenção e um forte desacoplamento entre as regras de negócio e a interface do usuário. A estrutura é dividida verticalmente em `features` independentes, onde cada uma contém suas próprias camadas isoladas:

- **Presentation (UI)**: Responsável por Widgets, Telas e Gerenciamento de Estado reativo (Bloc/Cubit ou Provider/Riverpod). Consome os casos de uso de forma passiva para reagir e exibir estados.
- **Domain**: Contém Entidades de negócio puras (ex: `WorkoutEntity`) e Use Cases (Regras de negócio táticas). Totalmente agnóstico de bibliotecas e frameworks externos, o coração lógico do sistema.
- **Data**: Responsável pela infraestrutura de comunicação física. Contém Models (Data Transfer Objects como `WorkoutModel` em `workout_model.dart` com parse 100% tipado no `fromJson`), Repositories (orquestradores de dados) e Data Sources (a conexão HTTP bruta com a API do Hono usando o `api_client.dart`). Em conformidade estrita com o backend em português, o decodificador HTTP obriga a passagem `json.decode(utf8.decode(response.bodyBytes))` para prevenir quebras de encoding UTF-8 (Regra do Data Binding Absoluto). A UI é proibida de operar diretamente sobre mapeamentos iterados no formato `dynamic` ou `Map<String, dynamic>`.
  - **Defesa Contra Meia-Noite Fantasma (Timezone):** O parse de datas em `WorkoutModel` bloqueia ativamente o shift de timezone extraindo estritamente a string `YYYY-MM-DD`, prevenindo que a conversão automática para `.toLocal()` reduza 3 horas (UTC-3) e coloque o treino na noite do dia anterior.
  - **Defesa de Parser JSONB:** O mapeamento do metadado `details` trata contingências em formato `String` decodificando ativamente com `jsonDecode()`, evitando a corrupção por objetos nulos na camada de Apresentação.

## 2. 🗂️ Mapeamento de Features Existentes

O ecossistema móvel reflete perfeitamente as operações de retaguarda do Backend. Os módulos principais (`lib/features/`) são:

- **`features/spreadsheet/`**: A Planilha Mestre do atleta. Renderiza o calendário semanal de treinos, definindo as Zonas (Z1 a Z5) do micro-ciclo. Esta feature também expõe um botão de exportação que consome a API remota, a qual aciona internamente o serviço `workoutReportGenerator.ts`. A interface mobile orquestra o download deste Dossiê em formato PDF A4 perfeitamente fatiado, respeitando as exigências estritas e a paleta de gamificação (Badges) do "BioMedal V11 Nordic Dark Mode".
- **`features/dashboard/`**: Painel central de controle (`DashboardScreen`). Exibe o status de Compliance diário, resumos de leitura da Bioimpedância (agora engatada diretamente à `BioimpedanceProgressScreen` através da AppBar e do InkWell do Card), métricas acumuladas (ACWR) e a visão cirúrgica dos próximos alvos diários. Engata as implementações de telemetria visual com o pacote nativo `fl_chart` para renderizar tendências de Volume e Zonas Cardíacas (Z1 a Z5), além de exibir dinamicamente o progresso do Macrociclo (Barra de Progresso) para as provas P1 no `UpcomingRacesCard`.
- **`features/equipment/` / `features/arsenal/`**: A aba de Arsenal e Equipamentos. Permite rastrear o desgaste logístico de material bélico (tênis e géis). Abriga o estratégico **Painel de Controle IA** com o botão de "Disparo Antecipado", conectado de forma nativa e reativa (com `CircularProgressIndicator` e tratamento de erros visuais via SnackBar) ao endpoint `POST /api/webhook/manual-trigger`.
- **`features/inventory/`**: Tela de controle de insumos e balística nutricional. Mostra o estoque físico de géis e cápsulas de sal, disparando métricas visuais se o contingente for insuficiente para os próximos longões/provas.
- **`features/dossiers/`**: Telas focadas na visualização nativa de PDFs (Server-Driven UI). A `reports_screen.dart` faz requisições dinâmicas a `/api/reports`, gerando *cards* automaticamente ao detectar novos relatórios (como Raio-X Cardio e Histórico). Trata falhas de rede (`.catchError`) e repassa o streaming binário (com token de segurança embutido) para renderização com o `SfPdfViewer`, isolando a experiência em imersão Dark Mode e sem necessitar de permissões sistêmicas de browser.

## 3. 🔌 Compliance de Consumo da API V11.1 (O Objeto Workout)

O Motor Cognitivo no Backend atualizou a estrutura da `planned_workouts`, mapeando os fracionamentos dentro do campo metadados `details`. O contrato do aplicativo (camada `Data` -> `WorkoutModel.fromJson`) possui diretrizes intransigíveis na versão 11.1.

**Atenção ao Parser JSON (Model e View):**
- O antigo campo genérico de string `description` foi **DESTRUÍDO** permanentemente de todos os modelos de transferência.
- O objeto JSON `details` recebido da API deve mapear chaves isoladas, as quais a UI deve tratar de forma totalmente condicional e independente:
  - **`corrida`**: Se a chave `corrida` não for nula, o `UpcomingWorkoutsCard` renderiza a row de Corrida exclusiva. Ativa o ícone de calçado (Run) e destaca o Ritmo/Série.
  - **`academia`**: Se a chave `academia` não for nula, a UI instancia a row de Força. Ativa o ícone de haltere e renderiza a especificação tática isolada.
  - **`bike`**: Se a chave `bike` não for nula, a UI constrói a row de ciclismo evidenciando os tempos de Giro Livre indolor.

**Impacto no Híbrido (`UpcomingWorkoutsCard` e Padrão Checklist / Task-Based UI)**:
Ocultamos permanentemente o antigo campo genérico de `title` e adotamos o padrão **Task-Based UI / Checklist Modular**. O App agora quebra um mesmo dia de treino em *blocos atômicos* renderizados dinamicamente:
- O `UpcomingWorkoutsCard` e o `ScheduleScreen` foram desmembrados, iterando o `WorkoutModel` isolado e injetando instâncias tipadas nos componentes independentes (`RunWorkoutBlock`, `StrengthWorkoutBlock`, `BikeWorkoutBlock`).
- **Bloco Corrida**: A interface de Glanceability opera com um componente `ExpansionTile`. O estado colapsado exibe estritamente a diretriz primária do bloco (`corrida`) e o status de `complianceStatus`. A expansão revela os protocolos auxiliares (`warmup`, `restDetails` e `cooldown`). Ele apresenta também um ícone interativo no final (trailing) que abre o Checklist da modalidade.
- **Blocos Força/Bike**: São apresentados com `IconButton` no final (trailing), atuando como checklists interativos para o atleta marcar a conclusão de atividades que não dependem do radar Strava.
A telemetria gráfica foi firmada utilizando a biblioteca nativa `fl_chart`.