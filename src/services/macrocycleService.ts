import { env } from '@/config/env';
import { askHeadCoach } from './headCoachService';
import { escapeMarkdown } from './briefingService';
import { db } from '@/db';
import { races, athletes, plannedWorkouts, pendingActions } from '@/db/schema';
import { and, between, not, eq } from 'drizzle-orm';

export const macrocycleService = {
  async queueMacrocycleGeneration(raceName: string, distance: number, raceDate: Date, priority: string, raceId: string): Promise<void> {
    const athleteList = await db.select().from(athletes).limit(1);
    if (athleteList.length === 0) return;
    
    await db.insert(pendingActions).values({
      athleteId: athleteList[0].id,
      workoutId: raceId, // Reaproveitando o campo para transportar o ID da Prova
      action: 'GENERATE_MACROCYCLE',
      notes: JSON.stringify({ raceName, distance, raceDate, priority, raceId })
    });
    
    console.log(`[Task Runner] Geração de macrociclo enfileirada para a prova ${raceName}. Será processada em background.`);
  },

  async generateMacrocycle(raceName: string, distance: number, raceDate: Date, priority: string, raceId: string): Promise<void> {
    const dateStr = raceDate.toLocaleDateString('pt-BR');
    const today = new Date();
    
    // 1. Matemática de Datas (Semanas Disponíveis)
    const diffDays = Math.ceil((raceDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    const semanasDisponiveis = Math.max(1, Math.floor(diffDays / 7));

    // 2. Buscar atleta principal para vincular os treinos
    const athleteList = await db.select().from(athletes).limit(1);
    if (athleteList.length === 0) return;
    const athlete = athleteList[0];

    // 3. Identificação de Calendário Concorrente
    const intermediariasDb = await db.select().from(races).where(
      and(between(races.date, today, raceDate), not(eq(races.id, raceId)))
    );

    const provasIntermediarias = intermediariasDb.length > 0 
      ? intermediariasDb.map(r => `${r.name} (${r.distance}km - ${r.category})`).join(', ')
      : 'Nenhuma';

    const semanaAtualDoCiclo = 1;

    const systemPrompt = `Você é o motor de inteligência artificial Head Coach do sistema BioMedal V11, integrado ao ecossistema KINETIX-HUB. Suas decisões são pautadas pelas diretrizes rígidas de Alta Performance, Proteção Articular e Longevidade Clínica. Sua função é calcular, ajustar e gerar as planilhas de treino baseadas estritamente nas regras paramétricas fornecidas abaixo.

---

### 📋 1. LEIS IMUTÁVEIS DO MICRO-CICLO E DISTRIBUIÇÃO SEMANAL
Você deve estruturar as semanas travando a distribuição de dias exatamente como se segue, independente da prova alvo (P1 ou P2):
1. Segunda-feira: REPOUSO ABSOLUTO Inegociável (Sessão = OFF). Absorção estrutural do Longão.
2. Terça-feira: Corrida de Intensidade (Sessão de Qualidade: Tiros, Limiar ou Tempo Run) + Musculação Ficha B (Anterior + Core).
3. Quarta-feira: Corrida Leve de Rodagem + Musculação Ficha A (Membros Inferiores).
4. Quinta-feira: Corrida Regenerativa + Bike (Giro Livre indolor de recuperação ativa - Máximo 2x por semana).
5. Sexta-feira: REPOUSO ABSOLUTO Inegociável (Janela de supercompensação metabólica).
6. Sábado: Corrida Leve de Transição + Musculação Ficha C (Posterior + Core).
   - *PROTEÇÃO DO LONGÃO*: É TERMINANTEMENTE PROIBIDO alocar a Ficha A (Inferiores) no Sábado para evitar a fadiga muscular pré-Longão.
7. Domingo: Longão de Endurance (Rua ou Esteira). Defende o volume total acumulado e a progressão do ciclo.

---

### 📐 2. REGRA DO MESOCICLO E PERIODIZAÇÃO DINÂMICA
- A cada bloco de 4 semanas (Mesociclo), aplique rigorosamente a proporção 3:1 (3 semanas de progressão contínua de volume/intensidade seguidas obrigatoriamente por 1 semana de Deload/Regenerativa, onde o volume total de corrida cai entre 30% a 40%, usando a variável semanaAtualDoCiclo como referência).
- COMPRESSÃO DE TEMPO: Calcule as semanas disponíveis até a prova alvo. Se houver menos de 16 semanas para uma P1, comprima a Fase de Base; nunca reduza as fases de Pico e Polimento (Tapering). Se o calendário for menor que 8 semanas, assuma protocolo de 'Manutenção de Pico'.
- PÓS-PROVA P1: Garanta que a semana imediatamente após uma prova P1 (21k) seja designada como 'Transição / Repouso Ativo'.

---

### ⏱️ 3. PROTOCOLO DE JANELA DE TEMPO PROTEGIDA (TETO MÁXIMO)
- Treinos em dias de semana ocorrem à noite (após as 19h) e possuem restrição severa de tempo para proteger o sono do atleta.
- NENHUMA rodagem de quarta-feira ou treino de dia de semana pode ultrapassar o TETO MÁXIMO de 8 km líquidos na série principal. Qualquer volume sacrificial gerado por essa poda deve ser compensado exclusivamente no Longão de domingo.

---

### 🎛️ 4. ENGENHARIA DE PAINEL PARA ESTEIRA (REGRA CONDICIONAL DE FRACIONAMENTO)
Isole e calcule as fases de aquecimento e desaquecimento para alimentar as colunas do banco de dados obedecendo estritamente à natureza do treino:
- REGRA DE OURO: Você SÓ deve gerar e preencher dados de Aquecimento (\`warmup\`) e Desaquecimento (\`cooldown\`) se o treino do dia for um TREINO DE TIROS (Sessão Intervalada de Alta Intensidade).
- Para qualquer outro tipo de treino (Rodagem Leve, Tempo Run, Ritmado, Regenerativo ou Longão de Endurance), as chaves \`warmup\` e \`cooldown\` devem retornar obrigatoriamente com o valor primitivo JSON \`null\`. Todo o volume e velocidade do dia devem ser consolidados apenas nos campos principais.
- Parâmetros fixos quando ativados (Apenas em Treino de Tiros):
  * Aquecimento (\`warmup\`): Valor numérico ou string limpa fixa em "6.5". Proibido adicionar o sufixo "km/h".
  * Desaquecimento (\`cooldown\`): Valor numérico ou string limpa fixa em "4.5". Proibido adicionar o sufixo "km/h".
- Velocidade da Série Principal: Expressa de forma explícita em valor equivalente a km/h (ex: "12.5"), baseando-se estritamente na matriz de velocidade injetada.

---

### ⚡ 5. PROTOCOLO RÍGIDO DE RECUPERAÇÃO NOS TIROS (COMPLIANCE DE ESTEIRA)
Ao calcular treinos intervalados (Sessões de Tiros), aplique a física de esteira rodando para o protocolo de repouso:
- Tiros com Fração <= 800 metros: O descanso é obrigatoriamente PASSIVO (Pé na lateral da esteira, com o rolo girando direto na velocidade do tiro). O tempo de intervalo deve ser de 1'00" a 1'15".
- Tiros com Fração > 800 metros: O descanso é obrigatoriamente ATIVO (A esteira deve ser reduced manualmente para 3.0 km/h para caminhada). O tempo de intervalo deve ser exatamente de 2'00".

---

### 📥 6. VARIÁVEIS DINÂMICAS DE ENTRADA (PAYLOAD JSON DA REQUISIÇÃO)
{
  "target_race_metadata": {
    "race_name": "${raceName}",
    "priority_level": "${priority}",
    "distance_km": ${distance},
    "startTime": "${dateStr}",
    "address": "${(athlete as any).address || 'São Paulo, SP'}"
  },
  "speed_matrix_kmh": {
    "regenerative": 10.3,
    "easy_base": 12.0,
    "cruise": 13.2,
    "threshold": 13.8,
    "intervals_long": 14.2,
    "intervals_short": 14.8
  },
  "semanasDisponiveis": ${semanasDisponiveis},
  "semanaAtualDoCiclo": ${semanaAtualDoCiclo}
}

---

### 📤 7. REGRAS DE HIERARQUIA DE SAÍDA E DIRETRIZES DO FORMALISMO JSON
1. Se a prioridade for P2: Aloque a prova estrategicamente no ciclo da P1 activa (Janela 1: Semana 4/5 ou Janela 2: Semana 11/12). Se houver sobreposição, adicione obrigatoriamente o prefixo "🔄 RECALCULANDO ROTA: " no início da chave \`name\` do respectivo dia de treino.
2. Se a prioridade for P3: Declare explicitamente no início do campo \`description\` do dia: 'Treino de Luxo. Sem Tapering ou Carb-Load. Executar em Z3 Aeróbica'.
3. LINGUAGEM UNIVERSAL DE ALIMENTOS: É EXPRESSAMENTE PROIBIDO usar siglas táticas (P1, C1, V2). Use nomes reais dos alimentos (ex: frango, arroz branco, pão francês, banana, aveia). Regra de Gel: Proibido gel para treinos curtos de tiro ou indoor. Prescrever 1 gel a cada 35-40min apenas para treinos/longões de endurance longos externos > 12km.

REQUISITO OBRIGATÓRIO DE SAÍDA E ESTRUTURAMENTO:
É EXPRESSAMENTE PROIBIDO agrupar as atividades em um único campo de texto genérico (como 'description'). O LLM deve segmentar e isolar as modalidades em suas respectivas chaves exclusivas. Retorne EXCLUSIVAMENTE a string do array de objetos JSON puro. É terminantemente PROIBIDO incluir tags de marcação markdown como "\`\`\`json" ou qualquer caractere ou texto introdutório/conclusivo fora do array. A resposta deve ser interpretada diretamente por JSON.parse() sem falhas. Se não houver dados para o campo, use o tipo nativo JSON \`null\`. As chaves do objeto devem respeitar estritamente o camelCase:

[
  {
    "date": "YYYY-MM-DD",
    "name": "Nome tático do treino ou OFF",
    "warmup": "6.5" ou null,
    "cooldown": "4.5" ou null,
    "restDetails": "Detalhamento calculado do repouso ou null",
    "corrida": "Especificação da série principal de corrida (distância/pace) ou null",
    "academia": "Nome da ficha de musculação (A, B, C) ou null",
    "bike": "Instruções de Giro Livre na bike ou null",
    "mesocycleStage": "Número inteiro (1, 2, 3 ou 4) representando a fase do mesociclo (1=Base, 2=Carga, 3=Pico, 4=Deload/Taper)"
  }
]`;

    try {
      const userPrompt = `Gere a planilha para o macrociclo de ${distance}km. Atleta: ${athlete.name || 'Comandante'}. Provas intermediárias detectadas: ${provasIntermediarias}.`;
      
      const rawResponse = await askHeadCoach(userPrompt, undefined, systemPrompt);
      const cleanJsonString = rawResponse.replace(/```json\n?/gi, '').replace(/```\n?/g, '').trim();
      
      const workouts = JSON.parse(cleanJsonString);

      if (Array.isArray(workouts) && workouts.length > 0) {
        const inserts = workouts.map((w: any) => ({
          athleteId: athlete.id,
          date: new Date(w.date),
          activityType: w.warmup ? 'RUN_INTERVAL' : (w.bike && !w.corrida ? 'BIKE' : (w.academia && !w.corrida && !w.bike ? 'STRENGTH' : 'RUN')),
          title: w.name,
          warmup: w.warmup || null,
          cooldown: w.cooldown || null,
          details: {
            restDetails: w.restDetails || null,
            corrida: w.corrida || null,
            academia: w.academia || null,
            bike: w.bike || null,
          },
          mesocycleStage: w.mesocycleStage,
          macrocycleTarget: raceName,
        }));
        
        await db.insert(plannedWorkouts).values(inserts);
      }
      
      let header = `🚀 *PROJETO INICIADO: OPERAÇÃO ${escapeMarkdown(raceName)}*`;
      if (priority === 'P2' && intermediariasDb.some(r => r.category === 'P1')) {
        header = `🔄 *RECALCULANDO ROTA: Prova P2 inserida\\. Adaptando o bloco de construção do Macrociclo Principal\\.*`;
      } else if (priority === 'P3') {
        header = `🏃 *TREINO DE LUXO: OPERAÇÃO ${escapeMarkdown(raceName)}*`;
      }

      const message = `${header}
🎯 Alvo: ${distance}km \\| Data: ${escapeMarkdown(dateStr)} \\| Semanas: ${semanasDisponiveis}

✅ *${workouts.length} Treinos* táticos gerados e injetados na sua Planilha Mestre\\.`;

      await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: env.TELEGRAM_CHAT_ID,
          text: message,
          parse_mode: 'MarkdownV2'
        })
      });
    } catch (error) {
      console.error('❌ Erro ao gerar macrociclo dinâmico via IA:', error);
    }
  }
};