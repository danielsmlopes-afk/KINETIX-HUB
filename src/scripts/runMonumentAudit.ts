import { MonumentAuditService } from '@/services/MonumentAuditService';

async function run() {
  try {
    const service = new MonumentAuditService();
    await service.auditRaces();
  } catch (error) {
    console.error('❌ Erro durante a auditoria de monumentos:', error);
  }
}

run();
