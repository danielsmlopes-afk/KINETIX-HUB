import { db } from '@/db';
import { bioimpedanceLogs } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';

const SPOONACULAR_API_KEY = process.env.SPOONACULAR_API_KEY || "FICTITIOUS_KEY";

const fallbackReceitas: Record<string, any[]> = {
  tapering: [
    {
      title: "Peito de Frango Grelhado com Arroz Branco",
      image: "https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?w=500",
      sourceUrl: "https://spoonacular.com/recipes/easy-chicken-and-rice-12345"
    },
    {
      title: "Macarrão ao Alho e Óleo com Filé de Tilápia",
      image: "https://images.unsplash.com/photo-1546549032-9571cd6b27df?w=500",
      sourceUrl: "https://spoonacular.com/recipes/garlic-pasta-with-fish-12346"
    }
  ],
  altaIntensidade: [
    {
      title: "Batata Doce Assada Recheada com Frango Desfiado",
      image: "https://images.unsplash.com/photo-1598122837311-25520e4990cd?w=500",
      sourceUrl: "https://spoonacular.com/recipes/stuffed-sweet-potato-12347"
    },
    {
      title: "Omelete de Ovos Caipiras com Aveia e Espinafre",
      image: "https://images.unsplash.com/photo-1525351484163-7529414344d8?w=500",
      sourceUrl: "https://spoonacular.com/recipes/oatmeal-spinach-omelette-12348"
    }
  ],
  leveRecuperacao: [
    {
      title: "Mignon em Tiras com Salada de Lentilha e Vegetais",
      image: "https://images.unsplash.com/photo-1544025162-d76694265947?w=500",
      sourceUrl: "https://spoonacular.com/recipes/beef-strips-with-lentils-12349"
    },
    {
      title: "Bowl Fit de Carne de Panela Magra e Brócolis Vapor",
      image: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=500",
      sourceUrl: "https://spoonacular.com/recipes/grilled-beef-vegetable-bowl-12350"
    }
  ]
};

async function traduzirParaPortugues(texto: string): Promise<string> {
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=pt&dt=t&q=${encodeURIComponent(texto)}`;
    const response = await fetch(url);
    if (response.ok) {
      const data = await response.json();
      if (data && data[0] && data[0][0] && data[0][0][0]) {
        return data[0][0][0];
      }
    }
  } catch (error: any) {
    console.error(`Erro ao traduzir "${texto}":`, error.message);
  }
  return texto;
}

export async function gerarDecisaoNutricional(
  athleteId: string,
  diasParaProva: number,
  zonaTreinoDia: string,
  rpe: number,
  tempoMinutos: number
) {
  // 1. Cálculo de Carga Interna (TRIMP)
  const cargaInternaTRIMP = rpe * tempoMinutos;

  // 2. Obter Peso Real do Atleta
  let pesoKg = 80; // default
  try {
    const latestLog = await db.select()
      .from(bioimpedanceLogs)
      .where(eq(bioimpedanceLogs.athleteId, athleteId))
      .orderBy(desc(bioimpedanceLogs.date))
      .limit(1);

    if (latestLog.length > 0) {
      pesoKg = latestLog[0].weight;
      console.log(`[Nutrition Service] Utilizando peso real do atleta: ${pesoKg}kg`);
    }
  } catch (err) {
    console.error(`[Nutrition Service] Erro ao buscar bioimpedance_logs:`, err);
  }

  // 3. Cálculo de Macros
  let carboFator = 2.0;       // Base: 2g/kg
  const proteinaFator = 1.8;   // Base: 1.8g/kg

  if (cargaInternaTRIMP > 300) {
    carboFator += 1.5;
  } else if (cargaInternaTRIMP < 150) {
    carboFator -= 0.5;
  }

  const carboidratosGramas = pesoKg * carboFator;
  const proteinasGramas = pesoKg * proteinaFator;

  // 4. Determinação de Fase e Parâmetros de Busca
  let faseIdentificada = "";
  let querySpoonacular = "";
  let includeIngredients = "";
  let excludeIngredients = "";
  let fallbackKey = "";

  if (diasParaProva <= 7) {
    faseIdentificada = "Modo Tapering (Carb-loading e corte de fibras)";
    querySpoonacular = "chicken rice";
    includeIngredients = "chicken,rice";
    excludeIngredients = "beans,lentils,broccoli";
    fallbackKey = "tapering";
  } else if (zonaTreinoDia === 'Z3' || zonaTreinoDia === 'Z4') {
    faseIdentificada = "Treino Intenso Z3/Z4 (Energia Sustentada)";
    querySpoonacular = "sweet potato";
    includeIngredients = "sweet potato,chicken";
    excludeIngredients = "";
    fallbackKey = "altaIntensidade";
  } else {
    faseIdentificada = "Treino Leve/Recuperação Z1/Z2 (Giro Livre/Recuperação)";
    querySpoonacular = "beef";
    includeIngredients = "beef,lentils";
    excludeIngredients = "";
    fallbackKey = "leveRecuperacao";
  }

  // 5. Integração Spoonacular
  let receitas: any[] = [];
  try {
    const url = `https://api.spoonacular.com/recipes/complexSearch?apiKey=${SPOONACULAR_API_KEY}&query=${encodeURIComponent(querySpoonacular)}&includeIngredients=${encodeURIComponent(includeIngredients)}&excludeIngredients=${encodeURIComponent(excludeIngredients)}&number=2&addRecipeInformation=true`;
    const response = await fetch(url);
    if (response.ok) {
      const data = await response.json();
      if (data.results && data.results.length >= 2) {
        receitas = await Promise.all(data.results.map(async (r: any) => ({
          title: await traduzirParaPortugues(r.title),
          image: r.image,
          sourceUrl: r.sourceUrl || `https://spoonacular.com/recipes/${r.title.toLowerCase().replace(/ /g, '-')}-${r.id}`
        })));
      } else {
        receitas = fallbackReceitas[fallbackKey];
      }
    } else {
      receitas = fallbackReceitas[fallbackKey];
    }
  } catch (error: any) {
    console.error("Conexão falhou com a API do Spoonacular:", error.message);
    receitas = fallbackReceitas[fallbackKey];
  }

  // 6. MacroFlow
  let ingredientesRecomendados = {};
  if (diasParaProva <= 7) {
    ingredientesRecomendados = {
      carboidrato: "Simples (C2: Arroz Branco) - Foco em absorção rápida e sem fibras",
      proteina: "Magras (P1: Frango/Peixe) - De digestão leve",
      vegetais: "Evitar estruturais/fibras para reduzir resíduos intestinais",
      molho: "Citrus Power (V3) - Sem gorduras pesadas"
    };
  } else if (zonaTreinoDia === 'Z3' || zonaTreinoDia === 'Z4') {
    ingredientesRecomendados = {
      carboidrato: "Complexos (C1: Batata Doce) - Liberação gradual de energia",
      proteina: "Magras ou Vermelhas (P1/P2) - Reconstrução muscular ideal",
      vegetais: "Estruturais (V2: Brócolis) - Micronutrientes antioxidantes",
      molho: "Big Fit (V3) - Aporte calórico equilibrado"
    };
  } else {
    ingredientesRecomendados = {
      carboidrato: "Complexos/Leguminosas (C1/C3: Lentilha) - Foco em fibras e saciedade",
      proteina: "Vermelhas ou Ovolactos (P2/P3) - Reposição estrutural",
      vegetais: "Folhas (V1) - Ação antioxidante leve",
      molho: "Balsâmico Veludo (V3) - Redução do índice glicêmico"
    };
  }

  // 7. Hidratação (Hydration Tracker)
  const hidratacaoBase = pesoKg * 35; // 35ml por kg
  const hidratacaoTreino = (tempoMinutos / 60) * 500; // 500ml por hora de treino
  const hidratacaoTotalMl = hidratacaoBase + hidratacaoTreino;

  // 8. Suplementação Estratégica
  let suplementos = [];
  if (cargaInternaTRIMP > 200 || zonaTreinoDia === 'Z4') {
    suplementos.push("Whey Protein Isolado (Pós-treino)");
    suplementos.push("Gel de Carboidrato (1 a cada 45min no treino)");
    suplementos.push("Eletrólitos/Isotônico (Durante o treino)");
  } else if (cargaInternaTRIMP > 100) {
    suplementos.push("Whey Protein (Pós-treino)");
    suplementos.push("Creatina (3-5g diárias)");
  } else {
    suplementos.push("Creatina (3-5g diárias)");
    suplementos.push("Multivitamínico (Opcional)");
  }

  if (diasParaProva <= 7) {
    suplementos.push("Suco de Beterraba (Nitrato) - Pré-treino/Prova");
  }

  // 9. Timeline de Refeições (Meal Timing)
  let timeline = [
    { periodo: "Pré-Treino (2h antes)", foco: "Carboidratos complexos, baixo índice de fibras/gorduras." },
    { periodo: "Intra-Treino", foco: tempoMinutos > 60 ? "Reposição de carboidratos líquidos (gel/isotônico)." : "Água apenas." },
    { periodo: "Pós-Treino (Até 1h após)", foco: "Proteína de rápida absorção + Carboidrato simples." },
    { periodo: "Restante do Dia", foco: "Manutenção dos macros com comida de verdade, priorizando recuperação." }
  ];

  return {
    cargaInternaTRIMP,
    faseIdentificada,
    macrosCalculados: {
      pesoReferenciaKg: pesoKg,
      carboFator,
      proteinaFator,
      carboidratosGramas,
      proteinasGramas
    },
    ingredientesRecomendados,
    receitas,
    hidratacao: {
      baseMl: hidratacaoBase,
      treinoMl: hidratacaoTreino,
      totalRecomendadoMl: hidratacaoTotalMl
    },
    suplementos,
    timeline
  };
}
