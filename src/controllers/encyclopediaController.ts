import { Context } from 'hono';
import { EncyclopediaService } from '../services/encyclopediaService';

export class EncyclopediaController {
  /**
   * GET /api/encyclopedia
   * Retorna o payload estratificado e agrupado por anos, com a flag de cache control
   */
  static async getEncyclopedia(c: Context) {
    try {
      const payload = await EncyclopediaService.getEncyclopediaData();
      
      // Retorna exatamente a estrutura exigida: { lastUpdate: ..., data: { "2026": {...} } }
      return c.json({
        lastUpdate: payload.lastUpdate,
        data: payload.data
      });
    } catch (error: any) {
      console.error('⚠️ [Encyclopedia] Falha na extração de dados históricos:', error);
      return c.json({ error: 'Falha ao buscar a enciclopédia Kinetix.' }, 500);
    }
  }

  /**
   * GET /api/encyclopedia/version
   * Retorna apenas a versão (timestamp) para controle de cache offline-first
   */
  static async getVersion(c: Context) {
    try {
      const lastUpdate = await EncyclopediaService.getEncyclopediaVersion();
      return c.json({ lastUpdate });
    } catch (error: any) {
      console.error('⚠️ [Encyclopedia] Falha na extração da versão:', error);
      return c.json({ error: 'Falha ao buscar a versão.' }, 500);
    }
  }
}