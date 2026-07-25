import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { consumables } from '@/db/schema';
import { env } from '@/config/env';

export async function deductInventory(itemId: string, quantity: number): Promise<void> {
  const item = await db.select().from(consumables).where(eq(consumables.id, itemId)).limit(1);
  if (!item.length) return;

  const newStock = Math.max(0, item[0].currentStock - quantity);
  await db.update(consumables).set({ currentStock: newStock }).where(eq(consumables.id, itemId));

  if (newStock <= item[0].alertThreshold) {
    await alertLowStock(item[0].name, newStock);
  }
}

async function alertLowStock(itemName: string, stock: number) {
  const message = `⚠️ ALERTA LOGÍSTICO KINETIX ⚠️\nO item *${itemName}* atingiu limite crítico (${stock} unidades). Reposição necessária.`;
  const url = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage?chat_id=${env.TELEGRAM_CHAT_ID}&text=${encodeURIComponent(message)}&parse_mode=Markdown`;
  await fetch(url);
}
