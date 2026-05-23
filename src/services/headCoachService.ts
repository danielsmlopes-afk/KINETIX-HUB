import { env } from '@/config/env';

export async function askHeadCoach(prompt: string, contextData?: Record<string, unknown>): Promise<string> {
  if (!env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY não configurada no .env');
  }

  // Utilizando a API REST nativa via fetch (Diretriz Zero Google cumprida: sem SDKs pesados)
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${env.GEMINI_API_KEY}`;
  
  const systemInstruction = "Você é o Head Coach IA do KINETIX HUB, um treinador de alta performance esportiva (corrida, bike e força). Você é pragmático, analítico, focado em periodização e usa a ciência do esporte. Suas respostas devem ser diretas, com tom de liderança, estruturadas e sem enrolação.";
  
  const fullPrompt = contextData 
    ? `[DADOS DE TELEMETRIA/TREINO DO ATLETA]:\n${JSON.stringify(contextData)}\n\n[DÚVIDA/SITUAÇÃO]: ${prompt}`
    : prompt;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemInstruction }] },
      contents: [{ parts: [{ text: fullPrompt }] }]
    })
  });

  if (!response.ok) {
    const errorData = await response.text();
    console.error('❌ Erro na API do Gemini:', errorData);
    throw new Error('Falha na comunicação com o Motor Cognitivo da IA.');
  }

  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "Sem resposta do Coach.";
}

export interface CoachRecalculationResponse {
  advice: string;
  updates: {
    id: string;
    action: 'RESCHEDULE' | 'CANCEL';
    newDate?: string;
    notes?: string;
  }[];
}

export async function askHeadCoachForRecalculation(prompt: string, contextData: Record<string, unknown>): Promise<CoachRecalculationResponse> {
  if (!env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY não configurada no .env');

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${env.GEMINI_API_KEY}`;
  
  const systemInstruction = `Você é o Head Coach IA do KINETIX HUB.
Sua tarefa é analisar o treino perdido (treinoPerdido) e a planilha futura (proximosTreinos) e recalcular a rota.
Você DEVE retornar EXATAMENTE um JSON válido com a seguinte estrutura:
{
  "advice": "Sua mensagem tática e motivacional para o atleta",
  "updates": [
    { "id": "ID exato do treino que sofrerá ação", "action": "RESCHEDULE ou CANCEL", "newDate": "Data ISO se for RESCHEDULE", "notes": "Explicação curta da mudança" }
  ]
}`;
  
  const fullPrompt = `[DADOS DE TELEMETRIA/TREINO DO ATLETA]:\n${JSON.stringify(contextData)}\n\n[SITUAÇÃO]: ${prompt}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemInstruction }] },
      contents: [{ parts: [{ text: fullPrompt }] }],
      generationConfig: { responseMimeType: "application/json" } // Força a saída estrita em JSON
    })
  });

  if (!response.ok) throw new Error('Falha na comunicação com a IA para recálculo.');

  const data = await response.json();
  const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
  return JSON.parse(textResponse) as CoachRecalculationResponse;
}

export interface MacrocycleGenerationRequest {
  targetRaceName: string;
  targetRaceDate: string;
  targetDistanceKm: number;
  targetPaceInstruction: string;
  athleteName: string;
  existingWorkouts?: any[];
  bioimpedance?: any;
}

export interface MacrocycleWorkout {
  date: string;
  activityType: 'RUN' | 'BIKE' | 'STRENGTH';
  title: string;
  details: Record<string, unknown>;
}

export async function askHeadCoachForMacrocycle(request: MacrocycleGenerationRequest): Promise<MacrocycleWorkout[]> {
  if (!env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY não configurada no .env');

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${env.GEMINI_API_KEY}`;
  
  const systemInstruction = `Você é o Head Coach IA do KINETIX HUB.
Sua tarefa é gerar ou adaptar um macrociclo de treinos (corrida, bike, musculação) para o atleta, com foco na prova alvo.
A planilha deve progredir gradativamente até a data da prova, respeitando a regra de periodização (ex: 3 semanas de carga + 1 de descarga).
Se houver treinos existentes, adapte a planilha considerando a nova prova (ex: adicionar treinos específicos e polimento).
Você DEVE retornar EXATAMENTE um JSON array válido com os treinos. Formato:
[
  { "date": "YYYY-MM-DDT06:00:00Z", "activityType": "RUN", "title": "Rodagem Leve", "details": { "distanceKm": 8, "pace": "5:30" } }
]`;
  
  const fullPrompt = `[ATLETA]: ${request.athleteName}
[PROVA ALVO]: ${request.targetRaceName} (${request.targetDistanceKm}km) em ${request.targetRaceDate}
[META DE RITMO (PACE)]: ${request.targetPaceInstruction}
[COMPOSIÇÃO CORPORAL]: ${request.bioimpedance ? JSON.stringify(request.bioimpedance) : 'Não informada'}
[TREINOS EXISTENTES]: ${request.existingWorkouts ? JSON.stringify(request.existingWorkouts) : 'Nenhum'}

Regras:
1. Gere a planilha de treinos até o dia da prova.
2. Siga as orientações em [META DE RITMO (PACE)] para balizar as zonas de esforço.
3. Considere a [COMPOSIÇÃO CORPORAL]. Se o % de gordura for alto, inclua treinos metabólicos. Se a massa muscular ou TMB indicarem risco de lesão, priorize hipertrofia e fortalecimento nos treinos de 'STRENGTH'.`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemInstruction }] },
      contents: [{ parts: [{ text: fullPrompt }] }],
      generationConfig: { responseMimeType: "application/json" }
    })
  });

  if (!response.ok) throw new Error('Falha na comunicação com a IA para macrociclo.');

  const data = await response.json();
  const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text || "[]";
  return JSON.parse(textResponse) as MacrocycleWorkout[];
}