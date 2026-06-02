# 🗺️ KINETIX HUB - Mapeamento Tático de Rotas (SSOT)

> ⚠️ **AVISO ESTRITO DE ARQUITETURA:** 
> Este documento é a Fonte Única de Verdade (SSOT) da camada de roteamento (Hono/Node.js). Qualquer alteração futura neste documento deve ser fornecida **ÚNICA E EXCLUSIVAMENTE em formato DIFF**.

---

## 1. 🔬 MÓDULO LABORATÓRIO (Força / IronLog)

Gerencia as operações do IronLog para controle estrutural, fichas de musculação e injeção de cargas na telemetria.

### `GET /api/strength/templates`
- **Descrição:** Lista todas as fichas de treino disponíveis para o atleta (Ex: Treino A, Treino B, Treino C).
- **Autenticação:** JWT (Header: `Authorization: Bearer <token>`).
- **Payload/Retorno:** Array de objetos detalhando o template (JOIN com `workout_templates` e `workout_template_items`).

### `GET /api/strength/templates/:id/exercises`
- **Descrição:** Retorna os exercícios de forma cirúrgica, acoplados a uma ficha específica.
- **Autenticação:** JWT (Header).
- **Params:** `:id` (UUID do template).
- **Payload/Retorno:** Array de exercícios (nome, séries, repetições alvo) originários da `exercise_library`.

### `POST /api/strength/log`
- **Descrição:** Ponto de injeção tática. Persiste a execução de um treino do Laboratório. Injeta cabeçalho em `workout_sessions` e o detalhamento volumétrico na `strength_logs`.
- **Autenticação:** JWT (Header).
- **Payload Esperado (Body):**
  ```json
  {
    "templateId": "uuid",
    "date": "2026-05-30T10:00:00Z",
    "durationMinutes": 45,
    "exercises": [
      { "exerciseId": "uuid", "setsCompleted": 3, "weightKg": 80, "repsCompleted": 10 }
    ]
  }
  ```

### `GET /api/strength/log/:sessionId/audit`
- **Descrição:** Realiza a extração do espelho comparativo de auditoria (Planilha Base vs Execução Real).
- **Autenticação:** JWT (Header).
- **Params:** `:sessionId` (UUID da sessão executada).

---

## 2. 📁 MÓDULO DOSSIÊS E RELATÓRIOS (PDF Engine)

Rotas de acesso e download para o Motor Vetorial de Inteligência (PDFKit/WeasyPrint).

> 🚨 **NOTA OPERACIONAL DE SEGURANÇA (OPERAÇÃO BYPASS):**
> Devido a limitações de injeção de Headers no SDK mobile (`url_launcher` e `SfPdfViewer` no Flutter), todas as rotas de exportação em PDF implementam autenticação híbrida. O middleware (`authMiddleware.ts`) fará fallback verificando a Query String `?token=<jwt>`.

### `GET /api/dossiers`
- **Descrição:** Lista os relatórios analíticos gerados, permitindo ao App renderizar os cards executivos disponíveis.
- **Autenticação:** Híbrida (Header JWT ou Query String `?token=`).

### `GET /api/reports/logbook/latest`
- **Descrição:** Baixa o Diário de Viagem em formato PDF vetorial (incluindo o Gráfico Topográfico ACWR).
- **Autenticação:** Híbrida.
- **Retorno:** Buffer de Arquivo Binário (`application/pdf`).

### `GET /api/reports/career/me`
- **Descrição:** Baixa o Histórico de Combate consolidado (Gráficos de Barras Horizontais).
- **Autenticação:** Híbrida.
- **Retorno:** Buffer de Arquivo Binário (`application/pdf`).

### `GET /api/reports/race/next`
- **Descrição:** Extrai o Prontuário de Missão P1. A IA compila um documento tático com a Tabela Smart Pace, Checklist Logístico e métricas climáticas.
- **Autenticação:** Híbrida.
- **Retorno:** Buffer de Arquivo Binário (`application/pdf`).

### `GET /api/reports/cardio/current`
- **Descrição:** Gera e baixa o Raio-X Cardiovascular do mês em curso (Gráfico de Dispersão FC vs Pace alimentado por telemetria real via JOIN entre `workout_sessions` e `planned_workouts`).
- **Autenticação:** Híbrida.
- **Retorno:** Buffer de Arquivo Binário (`application/pdf`).

### `GET /api/reports/strength-audit/:sessionId`
- **Descrição:** Emissão em PDF da auditoria de força cruzando dados do IronLog (Planejado vs Realizado).
- **Autenticação:** Híbrida.
- **Params:** `:sessionId` (UUID).
- **Retorno:** Buffer de Arquivo Binário (`application/pdf`).

---

## 3. 🛡️ MÓDULO WORKOUTS & COMPLIANCE (Planilha Tática)

Interações manuais do aplicativo com os macros do ciclo de treino e recálculos.

### `POST /api/workouts/validate-manual`
- **Descrição:** Checklist assíncrono para validação primária de exercícios isolados que não possuem telemetria Strava direta (Modos Força/Academia e Bike indoor).
- **Autenticação:** JWT (Header).
- **Payload Esperado (Body):**
  ```json
  {
    "workoutId": "uuid",
    "type": "STRENGTH"
  }
  ```

### `POST /api/workouts/updateCompliance`
- **Descrição:** Rota de contingência injetada pelo `coachController`. Permite que a UI / Comandante force o status de conformidade da planilha manual (Em caso de falha sistêmica ou testes).
- **Autenticação:** JWT (Header).
- **Payload Esperado (Body):**
  ```json
  {
    "id": "uuid",
    "status": "VALIDATED" // Opções: VALIDATED, MISSED, COMPLETED_NOT_VALIDATED, PARTIAL
  }
  ```

---

## 4. ⚙️ MÓDULO WEBHOOKS & CRON (Automação e Telemetria)

Portões de entrada autônomos para triggers do Strava, cron-jobs globais e forçamentos via painel IA.

### `POST /api/webhook/strava`
- **Descrição:** Inbound primário dos eventos webhooks do Strava. Despacha atividades assíncronas para o `stravaController` deduzir logística, processar voltas (Laps) e atualizar o motor tático.
- **Autenticação:** Validação de payload via assinatura SHA256 do Strava.
- **Payload:** JSON padrão da API Strava Webhook.

### `POST /api/webhook/manual-trigger`
- **Descrição:** Endpoint de interceptação acionado via Painel de Equipamentos do Flutter. Permite o disparo antecipado das operações vitais do ecossistema, ignorando o Relógio Mestre.
- **Autenticação:** Requer obrigatoriamente a chave de segurança no header.
- **Segurança:** Header `x-cron-secret` deve igualar-se ao segredo configurado no `.env`.
- **Payload Esperado (Body):**
  ```json
  {
    "jobId": "DAILY_BRIEFING" // Ou "MACROCYCLE", "WEEKLY_REPORT", "MORNING_RACE"
  }
  ```