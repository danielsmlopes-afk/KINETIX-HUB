# 🗄️ KINETIX HUB - Database & Seed

## Exceções Isométricas e Especiais (IronLog V2)
O script de injeção e laboratório `seedLaboratory.ts` utiliza transações robustas para mapear as Fichas. As seguintes exceções isométricas nos campos de repetição (`reps`) foram adicionadas:

1. **Prancha (Isometria):** 
   - `reps: '40s'`, `notes: '1 minuto de descanso'`
2. **Rolete:**
   - `reps: 'N'`, `notes: '1 minuto de descanso'`

Para os exercícios padrão de hipertrofia o esquema utiliza `sets: 3, reps: '10'`.

## Single-Tenant em Provas (races)
A tabela `races` não utiliza vínculo direto por `athleteId`, operando de forma global/single-tenant na arquitetura base. As provas alvo inseridas pelo sistema (ex: Bot Telegram) recebem obrigatoriamente a flag `isTarget: true`, definindo-as ativamente como prioridade na matriz.

## Fallbacks Manuais de Auditoria
A tabela `planned_workouts` pode ter sua coluna `complianceStatus` alterada explicitamente pelo Comandante via UI Mobile, utilizando o serviço `updateComplianceStatus` (`coachService.ts`). Isso possibilita corrigir falhas de tracking do Strava ou de check-in indoor diretamente no banco, injetando manualmente os status `VALIDATED`, `MISSED` ou `COMPLETED_NOT_VALIDATED`.

## Emissão Nativa de Relatórios (Operação Bypass)
Os endpoints que emitem binários em Buffer (PDFs) extraídos destas tabelas aceitam validação JWT na string da URL (`?token=`), facilitando requisições sem `Headers` rígidos disparadas pelas WebViews ou visualizadores nativos do Flutter.

## Junção Analítica de Telemetria (Cardio Efficiency)
O motor de PDF (`cardioEfficiencyService.ts`) efetua um `innerJoin` rigoroso entre `workout_sessions` e `planned_workouts` interceptando a âncora relacional `athleteId` e o mapeamento temporal (função estrita `DATE()`). Isso assegura que as métricas injetadas no Gráfico de Dispersão (Pace vs. Frequência Cardíaca Média) representem exclusivamente missões chanceladas de corrida ao ar livre ou esteira (RUN).

## Regra de Auto-Rebaixamento (Demotion na monumentRecords)
A tabela `monumentRecords` foi projetada com a premissa de flags de coroa excludentes. Operações que alteram a hierarquia de `isAllTimePr` ou `isYearPr` acionam atualizações de contingência: ao estabelecer um novo PR de 10K na história, o Banco de Dados destitui agressivamente os 10K anteriores, assegurando estabilidade na *Single Source of Truth* sem depender de triggers de sistema acoplados.