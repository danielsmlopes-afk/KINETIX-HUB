import { env } from '../config/env';

export interface RunAuditParams {
  plannedDistance: string;
  plannedPace: string;
  actualDistance: string;
  actualPace: string;
}

type GroqResponse = {
  choices?: Array<{ message?: { content?: string } }>;
};

export const coachService = {
  analyzeRun: async (params: RunAuditParams): Promise<string> => {
    const prompt = `Atue como um Head Coach incisivo e direto, avaliando o treino de corrida de um atleta de elite.
O atleta acabou de concluir uma sessão. Compare criticamente o Planeado vs Realizado.
Planeado: ${params.plannedDistance}km no pace ${params.plannedPace}
Realizado: ${params.actualDistance}km no pace ${params.actualPace}

Responda em até 2 frases curtas. Use um tom militar ou de comandante. Seja encorajador, mas exija sempre disciplina.`;

    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${(env as unknown as { GROQ_API_KEY: string }).GROQ_API_KEY || ''}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'llama3-70b-8192',
          messages: [{ role: 'user', content: prompt }]
        })
      });

      if (!response.ok) {
        throw new Error(`Erro na API Groq: ${response.statusText}`);
      }

      const data = (await response.json()) as GroqResponse;
      return data.choices?.[0]?.message?.content?.trim() || 'Treino registado, Comandante. Continue executando a missão.';
    } catch (error) {
      console.error('[COACH SERVICE] Falha ao gerar auditoria de corrida:', error);
      return 'Bom trabalho, Comandante. Auditoria salva com sucesso na base.';
    }
  }
};