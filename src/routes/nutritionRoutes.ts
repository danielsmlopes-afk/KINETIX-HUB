import { Hono } from 'hono';
import { db } from '@/db';
import { athletes, races, plannedWorkouts } from '@/db/schema';
import { eq, gte, lte, and, asc } from 'drizzle-orm';
import { gerarDecisaoNutricional } from '@/services/nutritionService';

const nutritionRoutes = new Hono();

nutritionRoutes.get('/decision', async (c) => {
  try {
    // 1. Identificar o Atleta Principal (Single-Tenant)
    const athleteList = await db.select().from(athletes).limit(1);
    if (athleteList.length === 0) {
      return c.json({ success: false, error: 'Atleta principal não encontrado.' }, 404);
    }
    const athlete = athleteList[0];

    // 2. Calcular diasParaProva (busca prova alvo mais próxima no futuro)
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const targetRaces = await db.select()
      .from(races)
      .where(and(eq(races.isTarget, true), gte(races.date, hoje)))
      .orderBy(asc(races.date))
      .limit(1);

    let diasParaProva = 23; // Fallback default se não houver provas
    if (targetRaces.length > 0) {
      const diffTime = targetRaces[0].date.getTime() - hoje.getTime();
      diasParaProva = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }

    // 3. Determinar zonaTreinoDia, rpe, tempoMinutos (busca treinos planejados para hoje)
    const hojeFim = new Date(hoje);
    hojeFim.setHours(23, 59, 59, 999);

    const treinosHoje = await db.select()
      .from(plannedWorkouts)
      .where(and(
        eq(plannedWorkouts.athleteId, athlete.id),
        gte(plannedWorkouts.date, hoje),
        lte(plannedWorkouts.date, hojeFim)
      ));

    let zonaTreinoDia = 'Z2';
    let rpe = 5;
    let tempoMinutos = 45;

    if (treinosHoje.length > 0) {
      // Prioriza treino de corrida (RUN) se houver múltiplos
      const treinoCorrida = treinosHoje.find(w => w.activityType === 'RUN');
      const treinoAtivo = treinoCorrida || treinosHoje[0];

      const searchStr = `${treinoAtivo.title} ${JSON.stringify(treinoAtivo.details || '')}`.toUpperCase();

      // 1. Tentar extrair a duração em minutos
      let duracaoDefinida = false;
      const durationMatch = searchStr.match(/(\d+)\s*(?:MIN|MINUTOS)/);
      if (durationMatch) {
        tempoMinutos = parseInt(durationMatch[1], 10);
        duracaoDefinida = true;
      } else {
        // Se não houver minutos explícitos, tentar calcular por distância e ritmo (Corrida)
        const kmMatch = searchStr.match(/(\d+(?:[.,]\d+)?)\s*KM/);
        if (kmMatch) {
          const distanciaKm = parseFloat(kmMatch[1].replace(',', '.'));
          const paceMatch = searchStr.match(/(\d{2}):(\d{2})/);
          let paceMinutos = 6.0; // ritmo padrão default de 6 min/km (10 km/h)
          if (paceMatch) {
            paceMinutos = parseInt(paceMatch[1], 10) + parseInt(paceMatch[2], 10) / 60;
          }
          tempoMinutos = Math.round(distanciaKm * paceMinutos);
          duracaoDefinida = true;
        }
      }

      if (!duracaoDefinida) {
        tempoMinutos = treinoAtivo.activityType === 'BIKE' ? 60 : (treinoAtivo.activityType === 'REST' ? 0 : 45);
      }

      // 2. Determinar zona e intensidade (Z4 = treinos intensos, longos ou intervalados)
      if (treinoAtivo.activityType === 'RUN') {
        const isLongRun = searchStr.includes('LONGÃO') || searchStr.includes('LONGA') || tempoMinutos > 60;
        const isIntervals = searchStr.includes('TIROS') || searchStr.includes('INTERVALADO') || searchStr.includes('FARTLEK');
        const isIntenseZone = searchStr.includes('Z3') || searchStr.includes('Z4');

        if (isLongRun || isIntervals || isIntenseZone) {
          zonaTreinoDia = 'Z4';
          rpe = 8;
        } else {
          zonaTreinoDia = 'Z2';
          rpe = 5;
        }
      } else if (treinoAtivo.activityType === 'STRENGTH') {
        zonaTreinoDia = 'Z2';
        rpe = 6;
        if (!duracaoDefinida) tempoMinutos = 45;
      } else if (treinoAtivo.activityType === 'BIKE') {
        zonaTreinoDia = 'Z2';
        rpe = 5;
        if (!duracaoDefinida) tempoMinutos = 60;
      }
    } else {
      // Dia de descanso total
      zonaTreinoDia = 'Z2';
      rpe = 1;
      tempoMinutos = 0;
    }

    // 4. Integrar com o Motor Nutricional Interno (substitui o antigo KinetiFuel Engine)
    console.log(`[Kinetix API] Processando decisão nutricional via nutritionService...`);
    const data = await gerarDecisaoNutricional(athlete.id, diasParaProva, zonaTreinoDia, rpe, tempoMinutos);

    const treinoAtivo = treinosHoje.length > 0 ? (treinosHoje.find(w => w.activityType === 'RUN') || treinosHoje[0]) : null;
    return c.json({
      success: true,
      data: {
        ...data,
        contexto: {
          diasParaProva,
          provaAlvo: targetRaces.length > 0 ? targetRaces[0].name : 'Nenhuma cadastrada',
          treinoHoje: treinoAtivo ? treinoAtivo.title : 'Descanso total',
          tipoAtividade: treinoAtivo ? treinoAtivo.activityType : 'REST',
          tempoMinutos,
          zonaTreinoDia
        }
      }
    });
  } catch (error: any) {
    console.error('❌ [Kinetix API] Erro no módulo de nutrição:', error);
    return c.json({ success: false, error: 'Erro interno no módulo de nutrição.' }, 500);
  }
});

export { nutritionRoutes };
