
# KINETIX HUB - Motor de Relatórios Táticos e Vetoriais (PDF)

## 🎯 Visão Geral

O Motor de Relatórios do KINETIX HUB foi projetado para gerar narrativas visuais de alta performance (Dossiês e Logbooks) diretamente no backend.
**Regra de Ouro:** Uso estrito do `pdfkit` gerando gráficos, tabelas e eixos cartesianos nativamente via vetores (sem dependências de frontend como Chart.js ou Canvas).

> **Nota de Arquitetura V11.1:** Os relatórios em PDF e os motores de briefings táticos agora buscam os dados da tabela `planned_workouts` de forma totalmente segmentada. O motor de extração mapeia cada modalidade individualmente pelas propriedades `{ corrida, academia, bike }` dentro do campo JSONB `details`, abandonando completamente o uso da antiga chave genérica `description`.

> **Soberania Cartográfica (MapStatic + Redis):** A renderização não utiliza motores front-end de mapas e não compartilha dados de localização externamente. O serviço consulta um contêiner nativo `stefanocudini/docker-mapstatic` na rede, guarda o `Buffer` localmente no Redis via LRU, e injeta o objeto nativo como imagem pura no PDF.

## 📂 Estrutura de Arquivos

```text
kinetix-api/
└── src/
    ├── controllers/
    │   ├── reportController.ts       # Orquestra os downloads manuais (streaming de Buffer)
    │   └── webhookController.ts      # Orquestra disparos autônomos via cron-job.org
    ├── routes/
    │   ├── reportRoutes.ts           # Endpoints GET para o App (Ex: /reports/logbook/:id)
    │   └── webhookRoutes.ts          # Endpoints POST protegidos por x-cron-secret
    └── services/
        └── pdf/                      # Motor Vetorial (Máximo 150 linhas/arquivo)
            ├── logbookService.ts          # Diário de Viagem (Gráfico de Topografia ACWR)
            ├── careerHistoryService.ts    # Histórico Strava (Gráfico de Barras Horizontais)
            ├── raceBriefingService.ts     # Prontuário Pré-Prova (Tabela Smart Pace e Clima)
            └── cardioEfficiencyService.ts # Raio-X Cardiovascular (Gráfico de Dispersão)

```
## 🚀 Fases de Implantação
 1. **Fase 1: Infraestrutura e Stubs:** Criação das pastas, definição dos controladores HTTP, injeção das rotas e webhooks, e criação dos esqueletos dos 4 serviços de PDF.
 2. **Fase 2: Motor de Topografia (Logbook):** Implementação do cálculo de Normalização de Escala (inversão do Eixo Y) e desenho do gráfico de área vetorial do ACWR (Agudo vs Crônico).
 3. **Fase 3: Geometria Avançada:** Injeção de loops geométricos para criação de tabelas sem bordas e gráficos de barras (Career History).
 4. **Fase 4: Injeção de Telemetria Real (Cardio):** O `cardioEfficiencyService.ts` opera via Drizzle ORM efetuando um Join rigoroso de `workoutSessions` e `plannedWorkouts` para mapear dados biológicos diretos no Gráfico de Dispersão Vetorial (Fogo Real).
## 🤖 Prompts Globais para IA (Gemini Code Assist)
Para recriar ou atualizar o sistema na IDE, utilize os prompts estruturados abaixo na ordem indicada.
### 📥 PROMPT 1: Infraestrutura, Stubs e Rotas
```text
[KINETIX HUB - MOTOR DE PDF TÁTICO & AUTOMAÇÃO DE RELATÓRIOS]
Atue como Arquiteto de Software Sênior. Vamos construir a fundação do motor de PDF e integrá-lo com os Webhooks seguros (cron-job.org).
Regras: Uso estrito do `pdfkit`, Tipagem Estrita, Máx 150 linhas/arquivo.

Sua Missão:
1. SERVIÇOS (`src/services/pdf/`): Crie os stubs retornando `Promise<Buffer>` para:
   - `logbookService.ts`: generateLogbookPdf(cycleId: string)
   - `careerHistoryService.ts`: generateCareerHistoryPdf(athleteId: string)
   - `raceBriefingService.ts`: generateRaceBriefingPdf(raceId: string)
   - `cardioEfficiencyService.ts`: generateCardioReportPdf(month: string)
   *Apenas inicie o PDFDocument, escreva um texto temporário e retorne o stream no stub.*

2. CONTROLLERS (`src/controllers/reportController.ts` e `webhookController.ts`):
   - `reportController`: Crie `downloadLogbook`, `downloadCareerHistory`, `downloadRaceBriefing`, `downloadCardioReport` para servir os Buffers via GET com os headers de 'application/pdf'.
   - `webhookController`: Adicione `triggerMonthlyReport` e `triggerRaceBriefing` validando o `x-cron-secret`.

3. ROTAS: Mapeie as chamadas em `src/routes/reportRoutes.ts` (GET) e `src/routes/webhookRoutes.ts` (POST).

```
### 📥 PROMPT 2: Geometria do Diário de Viagem (ACWR)
```text
[KINETIX HUB - MOTOR VETORIAL: src/services/pdf/logbookService.ts]
Atue como Engenheiro Sênior. Substitua o `logbookService.ts` pela implementação vetorial final (Máx 150 linhas).
Lógica a implementar:
- Ponto (0,0) é o topo esquerdo. Eixo Y cresce para baixo.
- Desenhe a Capa "Boarding Pass" (Retângulo Cinza + Títulos fixos da prova P1).
- Desenhe o Gráfico ACWR: Crie o eixo X/Y. Normalização: Calcule `stepX` dinâmico baseado no tamanho de um array de mock (16 semanas). Calcule o Y proporcional usando `chartHeight - (val / maxAcwr) * chartHeight`.
- Desenhe a área base preenchida (cinza claro) usando `doc.lineTo` e `doc.fill()`, depois o traçado forte sobreposto `doc.stroke()`.
- Desenhe a linha de "Zona de Perigo" tracejada horizontal onde ACWR = 1.5.
- Crie retângulos inferiores para Milestones e Auditoria de Gear (Ex: Tênis HOVR Sonic e IronLog).

```
### 📥 PROMPT 3: Lote Matemático (Tabelas, Barras e Dispersão)
```text
[KINETIX HUB - MOTOR MATEMÁTICO E VETORIAL PDFKIT (LOTE FINAL)]
Atue como Engenheiro de Software Sênior. Preencha os 3 stubs restantes (`careerHistoryService.ts`, `raceBriefingService.ts` e `cardioEfficiencyService.ts`) com geometria analítica (Máx 150 linhas cada).

1. `careerHistoryService.ts` (Gráfico de Barras): Crie um "Gráfico de Esforço Anual". Mock de dados de volume (2024 a 2026). Calcule `maxWidth` e proporção de largura para barras horizontais usando `doc.rect()`.
2. `raceBriefingService.ts` (Motor de Tabelas): Crie a "Tabela Smart Pace". Defina `startX, startY, rowHeight`. Crie um laço (loop de 1 a 5km), descendo o cursor Y a cada iteração, escrevendo KM/Ritmo e traçando linhas horizontais finas (simulando bordas).
3. `cardioEfficiencyService.ts` (Gráfico de Dispersão): Crie "FC vs Pace". Defina os eixos. Itere um array de treinos, transformando Pace em X e BPM em Y, plotando os resultados na tela com `doc.circle(x, y, 3).fill('#ff4444')`.

```
```

Pronto! Documento gerado e estruturado. Ele funciona como o *blueprint* exato dessa etapa, protegendo as regras de negócio e a geometria do código. 

Se o backend já estiver estável com todas as rotas do webhook, podemos oficialmente partir para o teste prático de injeção de JSON da planilha ou já estruturar a fundação do Mobile UI (Flutter). O que manda agora?

```
