# ⚙️ KINETIX HUB - Services Reference

## Coach & Athlete Controllers
Todos os objetos da tabela `plannedWorkouts` processados nos serviços (ex: `coachService.ts`) ou consumidos nas controllers (`athleteController.ts`) aplicam o cast estrito (`as WorkoutDetails`) sobre o campo JSONB `details`. O acesso via raiz tipo `workout.restDetails` foi abolido e agora ocorre exclusivamente via `details.restDetails`. Isso garante deploy cloud-safe no Render mitigando falhas TS2339.
A extração de datas via `startDateLocal` aplica o cast SQL paramétrico `sql\`DATE(...)\`` formatando obrigatoriamente para `YYYY-MM-DD` nas queries do Drizzle. Isso previne falhas de leitura de timezone que resultam em falsos "Treinos Livres".

## Telegram Controller & Bot Interaction
O `telegramController.ts` agora expande as operações vitais de preenchimento de telemetria manual. Ele é responsável por varrer e aplicar callbacks de teclados inline (ex: Check-in de STRENGTH ou BIKE), atuando diretamente na tabela `planned_workouts` ao marcar a atividade como `VALIDATED`. O controlador parseia os comandos textuais (`/peso`, `/dor`, `/hoje`, `/provaalvo`) transformando mensagens naturais em comandos de inserção na base de dados (ex: `bioimpedance_logs`, `pending_actions` e injeção em `races` assinalada com `isTarget: true`).

## Workout Controller & Manual Validation
O `workoutController.ts` fornece o endpoint `POST /api/workouts/validate-manual` para injetar validações táticas manuais na tabela `planned_workouts`, atuando como um checklist interativo assíncrono acionado primariamente pela interface Flutter (modalidades 'academia' e 'bike'). O Controller age estritamente como delegador (roteamento), repassando as lógicas de update ao `workoutService.ts`.
Ainda no escopo manual, o `coachController.ts` expõe a rota para atualização de status de compliance (`updateCompliance`), invocando o `coachService.updateComplianceStatus(id, status)` para forçar a marcação de treinos como validados, perdidos ou concluídos com ressalvas. Essa abordagem fortalece a robustez do sistema caso falhas externas na telemetria Strava corrompam a auditoria regular.

## Auth Middleware & Autenticação Híbrida
O `authMiddleware.ts` atua como o portão de segurança do Hono. Para garantir a viabilidade da leitura nativa de PDFs via dispositivos mobile (onde a manipulação de Headers de rede no visualizador pode ser limitada ou inexistente), ele executa a **Operação Bypass**: tenta extrair primeiramente o header `Authorization: Bearer <token>` e, caso não o encontre, faz um fallback seguro extraindo o token estritamente da query string (ex: `c.req.query("token")`).

## Motor Vetorial Cartográfico (MapStatic) e Cache em Redis
Os motores de geração de dossiês (`pdfGeneratorService.ts`) executam o serviço `fetchMapStaticBuffer` para buscar imagens de trajetos sem vazar dados para a web externa. As polylines extraídas da tabela `workout_sessions` realizam uma chamada HTTP nativa que intercepta a variável `MAPSTATIC_URL`. O serviço emprega o sistema de cache no Redis para mapear requests repetitivos em buffer de memória, garantindo alta performance e segurança.

## Motor Analítico de Dispersão (Cardio Efficiency)
O serviço `cardioEfficiencyService.ts` foi promovido para "Operação Fogo Real". Ele abandonou os stubs de dados estáticos e agora orquestra a extração e transformação puramente matemática dos registros reais em banco (`workoutSessions.durationMinutes`, `distance`, `averageHeartRate`), traduzindo variáveis fisiológicas complexas diretamente para o plano cartesiano bidimensional (`pdfkit`).

## Auditoria de Monumentos (Monument Audit)
O serviço `MonumentAuditService.ts` atua como o árbitro homologador do Hall of Fame. Ele varre a tabela `races` procurando operações completadas dentro das tolerâncias estritas de distância (10K, 15K, 21K, 42K) e promove estes registros para a tabela `monumentRecords`. Ele isola a telemetria, limpa o pace (focado na distância de chancela, não no ruído do GPS) e automaticamente rebaixa registros defasados caso a nova prova represente um Recorde Absoluto (`isAllTimePr`) ou do Ano (`isYearPr`).
