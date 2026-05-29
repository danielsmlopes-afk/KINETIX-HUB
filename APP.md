# 📱 KINETIX APP - Arquitetura de UI e Fluxo Mobile

Este documento serve como mapa único da verdade (SSOT) para o projeto Flutter do ecossistema Kinetix Hub. Ele mapeia os padrões arquiteturais, o isolamento por features e as regras estritas de consumo da API V11.1.

## 1. 🏗️ Padrão Arquitetural (Clean Architecture + Feature-First)

O aplicativo móvel KINETIX (Flutter) é construído sob uma arquitetura limpa e orientada a recursos (Feature-First). Isso garante escalabilidade militar, facilidade de manutenção e um forte desacoplamento entre as regras de negócio e a interface do usuário. A estrutura é dividida verticalmente em `features` independentes, onde cada uma contém suas próprias camadas isoladas:

- **Presentation (UI)**: Responsável por Widgets, Telas e Gerenciamento de Estado reativo (Bloc/Cubit ou Provider/Riverpod). Consome os casos de uso de forma passiva para reagir e exibir estados.
- **Domain**: Contém Entidades de negócio puras (ex: `WorkoutEntity`) e Use Cases (Regras de negócio táticas). Totalmente agnóstico de bibliotecas e frameworks externos, o coração lógico do sistema.
- **Data**: Responsável pela infraestrutura de comunicação física. Contém Models (Data Transfer Objects com métodos vitais como `fromJson` e `toJson`), Repositories (orquestradores de dados) e Data Sources (a conexão HTTP bruta com a API do Hono usando o `api_client.dart`). Em conformidade estrita com o backend em português, o decodificador HTTP obriga a passagem `json.decode(utf8.decode(response.bodyBytes))` para prevenir quebras de encoding UTF-8 (Regra do Data Binding Absoluto).

## 2. 🗂️ Mapeamento de Features Existentes

O ecossistema móvel reflete perfeitamente as operações de retaguarda do Backend. Os módulos principais (`lib/features/`) são:

- **`features/spreadsheet/`**: A Planilha Mestre do atleta. Renderiza o calendário semanal de treinos dinâmicos, definindo visualmente as Zonas de Treinamento (Z1 a Z5) e orquestrando o fluxo do micro-ciclo de combate. Além disso, a interface mobile expõe e consome o endpoint de exportação acionando o módulo remoto `workoutReportGenerator.ts` para prover o download tático em PDF A4 respeitando as especificações e paleta gamificada do "BioMedal V11 Nordic Dark Mode" gerado em background.
- **`features/spreadsheet/`**: A Planilha Mestre do atleta. Renderiza o calendário semanal de treinos, definindo as Zonas (Z1 a Z5) do micro-ciclo. Esta feature também expõe um botão de exportação que consome a API remota, a qual aciona internamente o serviço `workoutReportGenerator.ts`. A interface mobile orquestra o download deste Dossiê em formato PDF A4 perfeitamente fatiado, respeitando as exigências estritas e a paleta de gamificação (Badges) do "BioMedal V11 Nordic Dark Mode".
- **`features/dashboard/`**: Painel central de controle (`DashboardScreen`). Exibe o status de Compliance diário, resumos de leitura da Bioimpedância, métricas acumuladas (ACWR) e a visão cirúrgica dos próximos alvos diários. Engata as implementações de telemetria visual com o pacote nativo `fl_chart` para renderizar tendências de Volume e Zonas Cardíacas (Z1 a Z5), além de exibir dinamicamente o progresso do Macrociclo (Barra de Progresso) para as provas P1 no `UpcomingRacesCard`.
- **`features/equipment/` (Arsenal)**: A aba de Equipamentos. Permite rastrear o desgaste logístico de material bélico (Vida útil dos tênis - limite de 800km). Abriga também o estratégico **Painel de Controle IA** (permitindo a injeção nativa de eventos para forçar a execução de Cronjobs fora do fuso-horário padrão do servidor, como o gatilho instantâneo na rota `/debug/trigger-weekly-report` para disparar a geração do PDF Dominical).
- **`features/inventory/`**: Tela de controle de insumos e balística nutricional. Mostra o estoque físico de géis e cápsulas de sal, disparando métricas visuais se o contingente for insuficiente para os próximos longões/provas.
- **`features/dossiers/`**: Tela (`reports_screen.dart`) focada no download vetorial assíncrono. Consome as URLs reais da API Hono via `url_launcher`.

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
- O `UpcomingWorkoutsCard` foi desmembrado, iterando as chaves isoladas e utilizando componentes independentes (`RunWorkoutBlock`, `StrengthWorkoutBlock`, `BikeWorkoutBlock`).
- **Bloco Corrida**: Encapsula as metas de corrida e renderiza de forma condicional metadados como `warmup`, `restDetails` e `cooldown` (com fonte menor/cinza). Ele apresenta também um ícone reativo e read-only no final (trailing), reagindo estritamente ao `complianceStatus` (`VALIDATED` = check_circle verde, `PARTIAL`/`COMPLETED_NOT_VALIDATED` = warning amarelo, `PENDING`/Nulo = círculo vazio).
- **Blocos Força/Bike**: São apresentados com `IconButton` no final (trailing), atuando como checklists interativos para o atleta marcar a conclusão de atividades que não dependem do radar Strava.
A telemetria gráfica foi firmada utilizando a biblioteca nativa `fl_chart`.