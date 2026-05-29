# ⚙️ KINETIX HUB - Services Reference

## Coach & Athlete Controllers
Todos os objetos da tabela `plannedWorkouts` processados nos serviços (ex: `coachService.ts`) ou consumidos nas controllers (`athleteController.ts`) aplicam o cast estrito (`as WorkoutDetails`) sobre o campo JSONB `details`. O acesso via raiz tipo `workout.restDetails` foi abolido e agora ocorre exclusivamente via `details.restDetails`. Isso garante deploy cloud-safe no Render mitigando falhas TS2339.
A extração de datas via `startDateLocal` aplica o cast SQL paramétrico `sql\`DATE(...)\`` formatando obrigatoriamente para `YYYY-MM-DD` nas queries do Drizzle. Isso previne falhas de leitura de timezone que resultam em falsos "Treinos Livres".

## Telegram Controller & Bot Interaction
O `telegramController.ts` agora expande as operações vitais de preenchimento de telemetria manual. Ele é responsável por varrer e aplicar callbacks de teclados inline (ex: Check-in de STRENGTH ou BIKE), atuando diretamente na tabela `planned_workouts` ao marcar a atividade como `VALIDATED`. O controlador parseia os comandos textuais (`/peso`, `/dor`, `/hoje`) transformando mensagens naturais em insert na base de dados (ex: `bioimpedance_logs` e `pending_actions`).