# KINETIX HUB - Estrutura do Banco de Dados

## 🎯 Visão Geral
O banco de dados do KINETIX HUB utiliza **PostgreSQL** hospedado no Neon DB (Serverless) e é totalmente gerenciado através do **Drizzle ORM**. O arquivo central (Single Source of Truth) de tipagem e modelagem do banco encontra-se em `src/db/schema.ts`.

---

## 🗄️ Dicionário de Dados

### 1. `athletes` (Atletas)
Tabela principal do sistema (Single-Tenant). Guarda os dados vitais e tokens de acesso de integrações.
- `id`: UUID (Primary Key)
- `name`: Text (Not Null)
- `stravaAccessToken`: Text (Token Strava)
- `stravaRefreshToken`: Text (Refresh Token)
- `stravaExpiresAt`: Integer (Timestamp de expiração)

### 2. `bioimpedance_logs` (Telemetria Corporal)
Log evolutivo das medições corporais. Relaciona-se ao Atleta Principal.
- `id`: UUID (Primary Key)
- `athleteId`: UUID (FK -> `athletes.id`)
- `date`: Timestamp (Not Null)
- `weight`: Float (Not Null)
- `bodyFat`: Float (Not Null)
- `muscleMass`: Float (Not Null)
- `bodyWater`: Float (Not Null)
- `visceralFat`: Float (Not Null)
- `metabolicAge`: Integer (Not Null)
- `tmb`: Float (Not Null)
- `protein`: Float (Not Null)
- `boneMass`: Float (Not Null)
- `healthNotes`: Text

### 3. `planned_workouts` (Planilha de Treinos)
Armazena os treinos planejados do macrociclo (importados por JSON ou IA).
- `id`: UUID (Primary Key)
- `athleteId`: UUID (FK -> `athletes.id` - Not Null)
- `date`: Timestamp (Not Null)
- `activityType`: Text (Not Null - ex: RUN, BIKE, STRENGTH)
- `title`: Text (Not Null)
- `details`: JSONB (Armazena distâncias, pace alvo, etc)
- `isImported`: Boolean (Default: true)

### 4. `workout_sessions` (Diário de Bordo Realizado)
Treinos efetivamente concluídos (importados do Strava ou logados manualmente).
- `id`: UUID (Primary Key)
- `athleteId`: UUID (FK -> `athletes.id`)
- `date`: Timestamp (Not Null)
- `durationMinutes`: Integer (Not Null)
- `load`: Float (Carga interna de treino PNL)
- `distance`: Float
- `gearId`: Text (ID do tênis no Strava)
- `averageHeartRate`: Integer

### 5. `strength_logs` (Auditoria de Força / IronLog)
Cruza a execução do treino de força com os exercícios da base.
- `id`: UUID (Primary Key)
- `sessionId`: UUID (FK -> `workout_sessions.id` - Cascade - Not Null)
- `exerciseId`: UUID (FK -> `exercise_library.id` - Restrict - Not Null)
- `actualSets`: Integer (Not Null)
- `actualReps`: Text (Not Null)
- `weightUsed`: Float (Carga)
- `notes`: Text

### 6. `exercise_library` (Biblioteca de Exercícios IronLog)
Dicionário canônico de movimentos de musculação pré-cadastrados.
- `id`: UUID (Primary Key)
- `name`: Text (Not Null)
- `muscleGroup`: Text (Not Null)
- `equipmentType`: Text

### 7. `workout_templates` (Fichas de Treino)
Agrupadores de treinos de força (Ex: Treino A, Treino B).
- `id`: UUID (Primary Key)
- `name`: Text (Not Null - Unique)
- `description`: Text

### 8. `workout_template_items` (Prescrição de Força)
Tabela relacional que conecta Fichas e Biblioteca, definindo Séries e Reps alvo.
- `id`: UUID (Primary Key)
- `templateId`: UUID (FK -> `workout_templates.id` - Cascade - Not Null)
- `exerciseId`: UUID (FK -> `exercise_library.id` - Restrict - Not Null)
- `sets`: Integer (Not Null)
- `reps`: Text (Not Null)
- `notes`: Text (Ex: Pausa de 1min)

### 9. `races` (Provas e Eventos)
Backlog do calendário de competições.
- `id`: UUID (Primary Key)
- `category`: Text (Not Null - P1, P2, P3)
- `date`: Timestamp (Not Null)
- `distance`: Float (Not Null)
- `startTime`: Text (Not Null)
- `startLocation`: Text (Not Null)
- `name`: Text
- `polyline`: Text (Rota mapeada)
- `movingTime`: Integer (Tempo alvo previsto)
- `weather`: Text (Clima previsto)
- `isTarget`: Boolean (Default: false)
- `targetPace`: Text

### 10. `treadmill_intervals` (Repouso Ativo/Passivo)
Integra-se às sessões de treino para definir tiros e repousos na esteira.
- `id`: UUID (Primary Key)
- `sessionId`: UUID (FK -> `workout_sessions.id`)
- `distanceMeters`: Float (Not Null)
- `speedKmh`: Float (Not Null)

### 11. Logística e Estoque (`consumables` e `shoes`)
Controle de Arsenal do Atleta.
* **`consumables`**: `id`, `type`, `name`, `currentStock`, `alertThreshold`.
* **`shoes`**: `id`, `stravaGearId`, `name`, `mileage`.

### 12. Automação (`cron_logs` e `pending_actions`)
Tabelas do sistema nervoso do Head Coach IA.
* **`cron_logs`**: Guarda a execução das varreduras em segundo plano (`jobName`, `runAt`, `status`, `message`).
* **`pending_actions`**: Refatoramentos pendentes sugeridos pela IA (ex: Recalcular rota). (`athleteId`, `workoutId`, `action`, `newDate`).

---

## 🔗 Relacionamento com o Backend

### Repositórios (`src/repositories/`)
Todas as chamadas (Query/Insert/Update/Delete) a este schema estão isoladas na camada de `Repositories`, implementando o padrão de abstração.
- `athleteRepository.ts`: Gerencia o `athletes` e seus tokens do Strava.
- `telemetryRepository.ts`: Insere as leituras em `bioimpedance_logs`.
- `stravaRepository.ts`: Atualiza tokens no `athletes`.
- `strengthRepository.ts`: Faz joins entre `workout_templates`, `workout_template_items` e `exercise_library`.

### Controladores & Serviços
- Os arquivos de `schema.ts` são frequentemente importados em `src/controllers/telegramController.ts` e serviços como `coachService.ts` para cruzamentos, como as Auditorias IA onde se consulta o `planned_workouts` vs atividades recebidas do Strava.

### Seed Inicial (`src/db/seed.ts`)
Este arquivo atua populando o estado basal destas tabelas em cold-starts do banco, construindo o *Atleta Principal*, a frota de Tênis, as metas de prova P1/P2/P3 e as fichas de Musculação da *IronLog_V2*.