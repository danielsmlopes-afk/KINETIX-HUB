import { sql } from 'drizzle-orm';
import { db } from './index';

async function reset() {
  console.log('🗑️ Resetando o banco de dados (apagando todas as tabelas)...');
  
  try {
    // Apaga o schema public em cascata (todas as tabelas) e recria-o do zero
    await db.execute(sql`DROP SCHEMA public CASCADE;`);
    await db.execute(sql`CREATE SCHEMA public;`);
    await db.execute(sql`GRANT ALL ON SCHEMA public TO public;`);
    
    console.log('✅ Banco de dados limpo com sucesso!');
  } catch (error) {
    console.error('❌ Erro ao resetar o banco:', error);
    process.exit(1);
  }
}

reset();