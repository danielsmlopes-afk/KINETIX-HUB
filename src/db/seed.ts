import { db } from './index';
import { exercises, shoes, races, consumables } from './schema';

export async function seed() {
  console.log("🌱 Iniciando o processo de Seed no KINETIX HUB...");

  // 15 Exercícios Base
  const exerciseData = Array.from({ length: 15 }).map((_, i) => ({
    name: `Exercício Padrão ${i + 1}`,
    type: i % 2 === 0 ? 'Força' : 'Cardio'
  }));
  await db.insert(exercises).values(exerciseData);

  // 2 Tênis de Performance
  await db.insert(shoes).values([
    { name: 'Nike Vaporfly Next% 3', stravaGearId: 'g12345' },
    { name: 'Asics Novablast 4', stravaGearId: 'g67890' }
  ]);

  // 1 Prova Categoria P2
  await db.insert(races).values([
    {
      category: 'P2',
      date: new Date('2026-10-12T00:00:00Z'),
      distance: 21.1,
      startTime: '06:00',
      startLocation: 'Praça Central'
    }
  ]);

  // 2 Consumíveis
  await db.insert(consumables).values([
    { type: 'gel', name: 'Gel Z2', currentStock: 10, alertThreshold: 3 },
    { type: 'salt', name: 'Cápsula de Sal', currentStock: 30, alertThreshold: 5 }
  ]);

  console.log("✅ Seed finalizado com sucesso.");
  process.exit(0);
}

// Permite execução direta via `tsx src/db/seed.ts`
if (require.main === module) {
  seed().catch(console.error);
}