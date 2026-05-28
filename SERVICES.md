# 🗺️ KINETIX HUB - Mapa Tático de Serviços e Roteamento (V11.1)

Este documento mapeia e consolida a documentação de todo o ecossistema do backend Hono com base na estrutura real de arquivos do repositório, refletindo a padronização do ecossistema BioMedal V11.1.

## 🧠 1. Camada de Serviços (`src/services/`)
O cérebro tático do ecossistema.

- **`acwrService.ts`**: Monitoramento da relação entre Carga Aguda vs. Crônica para prevenção de lesões.
- **`briefingService.ts`**: Orquestrador do Briefing Diário Noturno (22h). Formata e escapa os payloads para o MarkdownV2 do Telegram.
- **`clearRaces.ts`**: Script de utilidade para expurgar ou resetar os alvos de provas do calendário.
- **`coachService.ts`**: Cérebro da auditoria de treino. Cruza webhooks do Strava com a planilha planejada.
- **`cronJobs.ts`**: Relógio mestre que agenda os gatilhos de automação (07h00 Matinal, 14h59 Domingo para Digital Twin, 15h00 para Relatórios PDF, 22h30 para Briefing). Blindado com Fuso Horário paramétrico `America/Sao_Paulo` prevenindo bugs da Meia-Noite Fantasma de servidores UTC.
- **`dbMaintenanceService.ts`**: Rotinas de otimização de queries, limpeza e integridade física do Neon.
- **`headCoachService.ts`**: Gateway REST para a API do Gemini 2.5 Flash usando fetch nativo e JSON Estruturado.
- **`importPastRaces.ts`**: Ingestor histórico de provas anteriores executadas pelo atleta.
- **`inventoryService.ts`**: Rastreio logístico de consumíveis (Géis de Carboidrato e Sais) e alertas de estoque.
- **`loadCalculator.ts`**: Computa a Carga Interna de Treino (TRIMP via RPE/Frequência Cardíaca).
- **`macrocycleService.ts`**: Motor Cognitivo V12.2. Periodização 3:1 dinâmica, teto de 8km em dias de semana, isolamento estrito das propriedades (`corrida`, `academia`, `bike`) e carimbo obrigatório do `mesocycle_stage`.
- **`morningRaceService.ts`**: Motor pré-prova matinal (07h) acionando protocolos D-3, D-2 e D-1 (Logística OSRM/Waze).
- **`nutritionCalculator.ts`**: Engine de cálculo calórico integrado às diretrizes estritas da tabela TACO para o MacroFlow.
- **`pdfGeneratorService.ts`**: Motor vetorial (pdfkit) que desenha relatórios geométricos e prontuários binários.
- **`preRaceService.ts`**: Protocolos táticos de saturação de glicogênio e refinamento de pacing pré-evento P1.
- **`routingService.ts`**: Integração de geolocalização com OSRM Engine para cálculo de deslocamento e despertadores.
- **`stravaService.ts`**: Comunicação interna e renovação de tokens OAuth da API do Strava. Inclui o pipeline de Endurance (Digital Twin) que varre, analisa e persiste a performance dos longões de domingo.
- **`telegramMessageService.ts`**: Disparador e formatador de mensagens e alertas do bot no canal do atleta.
- **`treadmillProtocol.ts`**: Isolamento matemático para reconstrução de parciais e validação de treinos em esteira (Laps).
- **`uptimeService.ts`**: Monitor de saúde (Health Check) e disponibilidade do servidor no Render.
- **`weatherPacingService.ts`**: Algoritmo de ajuste automático de Pace Alvo baseado em temperatura e umidade (Weather-Pacing).
- **`weatherService.ts`**: Wrapper de conexão para busca de previsões climáticas em tempo real via OpenWeatherMap.
- **`workoutReportGenerator.ts`**: Engine de exportação HTML/CSS (WeasyPrint) em 3 camadas. Renderiza dinamicamente a "Planilha Semanal", o "Diário de Viagem" (Deload) ou o "Dossiê de Prova" com base no `mesocycle_stage` da semana.
- **`workoutService.ts`**: CRUD e processamento de regras específicas da planilha de treinos diários.

## 🔀 2. Camada de Rotas (`src/routes/`)
Os portões de comunicação expostos pelo Hono.

- **`api.ts`**: Ponto central de inicialização do roteador da API.
- **`coachRoutes.ts`**: Endpoints de auditoria e pareceres táticos da planilha. (Consumido pela `DashboardScreen` para abastecimento do `DigitalTwinChart` via `fl_chart`).
- **`debugRoutes.ts`**: Rotas de injeção manual permitindo que o aplicativo MOBILE force a execução de Cronjobs, incluindo o gatilho paramétrico `/debug/trigger-weekly-report`. (Consumido pelo Painel de Controle de IA na `equipment/` feature).
- **`dossierRoutes.ts`**: Entrega e listagem dos caminhos para downloads de relatórios executivos. (Consumido pela `ReportsScreen` e o executivo `dossier_panel.dart`).
- **`gearRoutes.ts`**: Roteamento do gerenciamento de arsenal (Tênis e vida útil de 800km). (Consumido pela `GearScreen` e sua feature no Flutter).
- **`importRoutes.ts`**: Endpoints para ingestão de arquivos legados (CSV/JSON).
- **`logbookService.ts` / `races.ts` / `reportRoutes.ts`**: Endpoints de diários, gestão de provas e download de buffers de PDF. (Consumidos ativamente pelas features `reports` e `dashboard`).
- **`stravaRoutes.ts`**: Endpoints de autenticação OAuth e troca de chaves com o Strava. (Acionado pelo Webview interno na fase de Onboarding do Flutter).
- **`strengthRoutes.ts`**: Endpoints restritos para o Laboratório de força (IronLog), gerenciando templates (A, B, C) e logs de carga. (Consumido massivamente por `lab_screen.dart` e `iron_log_screen.dart`).
- **`telegramRoutes.ts`**: Endpoints para webhooks de controle e interações de bioimpedância via chat. (Os deltas de peso impactam diretamente o `BioimpedanceCard` do App).
- **`webhookRoutes.ts`**: O portão de entrada principal para os eventos assíncronos enviados pelo Strava.

## 🎮 3. Camada de Controladores (`src/controllers/`)
Interceptam a requisição HTTP da rota correspondente, validam os dados e injetam os tipos higienizados (Zod Schema) diretamente nos respectivos Serviços. Esta camada inclui: `athleteController.ts`, `coachController.ts`, `cronController.ts`, `dossierController.ts`, `gearController.ts`, `headCoachController.ts`, `importController.ts`, `raceController.ts`, `reportController.ts`, `stravaController.ts`, `strengthController.ts`, `telegramController.ts`, e `webhookController.ts`.