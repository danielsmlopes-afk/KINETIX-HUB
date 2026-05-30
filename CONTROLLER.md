# 🎛️ KINETIX HUB - Mapeamento Tático de Controllers (SSOT)

> ⚠️ **AVISO ESTRITO DE ARQUITETURA:** 
> Este documento representa a Fonte Única de Verdade (SSOT) para a camada de Controladores do backend Node.js/Hono. Qualquer alteração futura neste arquivo deve ser fornecida **ÚNICA E EXCLUSIVAMENTE em formato DIFF**.

A camada de Controllers atua como a linha de frente do ecossistema, validando payloads, realizando o parsing de parâmetros e roteando as operações vitais para os Services e Repositories. **Regra de Ouro:** O uso de tipos genéricos em assinaturas é proibido. Toda estrutura interage de forma tipada sob a fundação do Drizzle ORM.

---

## 1. 📱 MÓDULO TELEGRAM (`telegramController.ts`)

Orquestra a interação bot/humano (Comandante e Head Coach IA), recebendo inputs diretos e transformando linguagem natural em injeções estruturadas no banco de dados.

### Gestão de Comandos Textuais
- **`/help` & `/menu`**: Renderiza a interface de navegação principal.
- **`/peso` & `/dor`**: Ingestão clínica. Processa os parâmetros numéricos e textuais e injeta diretamente nas tabelas de telemetria médica (`bioimpedance_logs` e alertas de redução de carga).
- **`/hoje`**: Aciona o motor do briefing para fornecer a leitura tática do micro-ciclo em andamento.

### Ingestão Dupla (`/provaalvo`)
- O controlador opera um mecanismo duplo: se acionado sem parâmetros, devolve as instruções de formatação estrita em `MarkdownV2`.
- Quando recebe o payload (ex: `/provaalvo Nome da Prova | 26/07/2026 | 21km`), executa a lógica de extração e injeta ativamente os dados na base de dados (`races`) definindo a categoria como `P1` e fixando `isTarget: true`. Não é necessário referenciar o `athleteId` devido ao modelo de escopo único.

### Callbacks Inline e Teclados de Comando
- Trata os payloads originários de *Inline Keyboards* (botões no chat).
- Renderiza o Painel de Comando Premium via `/help` ou `/menu` integrando as ações `cmd_provaalvo`, `cmd_hoje`, `cmd_briefing`, `cmd_auditoria`, `cmd_peso`, e `cmd_dor`.
- Executa o check-in manual para treinos cegos à telemetria (Modos `STRENGTH` / Força e `BIKE` / Ciclismo indoor), atualizando o status para `VALIDATED` sem necessitar de acesso ao App Mobile.

---

## 2. 📁 MÓDULO DE RELATÓRIOS E AUTOMAÇÃO

Lida com a extração e despacho de Dossiês Vetoriais (PDFs).

### `reportController.ts`
- **Streaming Binário:** Orquestra o download sob demanda da interface Mobile (Flutter). 
- Aciona os serviços de PDF (Logbook, Histórico, Raio-X, Prontuário P1).
- **Protocolo HTTP:** Injeta rigorosamente os cabeçalhos de resposta `Content-Type: application/pdf` e `Content-Disposition: inline; filename="document.pdf"`, convertendo a `Promise<Buffer>` gerada pelo PDFKit em um fluxo binário consumível pelos pacotes `url_launcher` e `SfPdfViewer`.

### `webhookController.ts`
- **Operação Autônoma:** Portal de entrada exclusivo para os disparos automáticos via Cronjobs (ex: cron-job.org ou trigger de relógio do sistema).
- **Disparo Manual (Painel IA):** O `handleManualTrigger` intercepta chamadas via UI (Flutter) e roteia os payloads `{ jobId: '...' }` diretamente para os Services (`morningRaceService`, `briefingService`), ignorando o relógio mestre. Valida rigorosamente a presença do cabeçalho `x-cron-secret`.
- **Despacho Dominical:** Intercepta as chamadas como `triggerWeeklyReport`, validando obrigatoriamente a assinatura de segurança `x-cron-secret` antes de notificar o Telegram ou processar os deltas da semana no banco de dados.

---

## 3. 📡 MÓDULO DE TELEMETRIA STRAVA (`stravaController.ts`)

Coração da ingestão de dados em tempo real (Radar). A arquitetura prioriza o não-bloqueamento do gateway de terceiros.

### Handshake e Assinatura
- Implementa o `GET /api/webhook/strava`. Valida o `hub.verify_token` durante o provisionamento do túnel.
- No `POST /api/webhook/strava`, realiza o parse seguro do Payload JSON.

### Despacho Assíncrono (Fire and Forget)
- A engine do Strava exige respostas `200 OK` em menos de 2 segundos.
- O Controller despacha a requisição HTTP imediatamente via `c.text('OK')` e delega a extração pesada (parsing de Laps e Moving Time) para Promises que rodam em background.
- Aciona de forma invisível as rotinas de **Dedução Logística**: Atualização da quilometragem do tênis (`shoes` via `workoutService`) e baixa na despensa de suprimentos (Géis e Sais em `consumables`).

---

## 4. 🛡️ MÓDULO DE COMPLIANCE E WORKOUT (`coachController.ts` & `workoutController.ts`)

Ponto de comunicação direta com a UI Orientada a Tarefas (Task-Based UI) e o Checklist do aplicativo Flutter.

### `workoutController.ts` (Validação Interativa)
- **Rota:** `POST /api/workouts/validate-manual`
- Age como um *delegator*. Recebe a intenção de conclusão do usuário (checklist interativo do Mobile para Academia e Bike) e direciona ao `workoutService.ts`.
- Isola o conceito de validação assíncrona para atividades não mapeáveis por GPS.

### `coachController.ts` (Forçamento de Compliance e Zonas)
- **Rota:** `POST /api/workouts/updateCompliance`
- Rota de contorno sistêmico. Permite forçar marcações (`VALIDATED`, `MISSED`, `PARTIAL`, `COMPLETED_NOT_VALIDATED`) para corrigir auditorias onde o radar Strava tenha falhado ou omitido parciais.
- **Assinatura Estrita no Repositório (Prevenção TS2339):**
  Toda operação de leitura e extração efetuada no `planned_workouts` impõe rigor absoluto na coluna JSONB.
  ```typescript
  // Exemplo da mecânica obrigatória de parsing nas controllers de Força/Coach:
  const workout = await db.query.plannedWorkouts.findFirst({ ... });
  
  // CAST ESTRITO (Proibido o uso de inferência genérica)
  const details = workout.details as WorkoutDetails;
  
  // Acesso seguro isolando as camadas de modalidade
  const isStrength = details.academia !== undefined;
  const isRun = details.corrida !== undefined;
  ```

### Sumário de Responsabilidades de Segurança
As Controllers dependem do `authMiddleware.ts` antes da execução lógica de negócio, assegurando que o ID Atleta (`athleteId`) só seja extraído após a decodificação real do JWT Firebase ou do Fallback Híbrido por Query String (para o ecossistema de relatórios nativos).
