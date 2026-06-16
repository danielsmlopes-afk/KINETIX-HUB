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
      
      // Determina a Base URL dinamicamente para construir links absolutos
      // Isso garante que o Flutter consiga baixar a imagem via http.get()
      const reqUrl = new URL(c.req.url);
      const baseUrl = process.env.API_BASE_URL || reqUrl.origin;

      // Injeta o Proxy Cartográfico em todos os anos
      const formattedData: Record<string, any> = {};
      for (const year in payload.data) {
        const yearData = payload.data[year];
        
        const buildMapUrl = (act: any) => {
          const polyline = act.map_polyline || act.mapPolyline;
          if (polyline) {
            return `${baseUrl}/api/reports/maps/render?polyline=${encodeURIComponent(polyline)}`;
          }
          return act.mapImageUrl || act.map_image_url;
        };

        formattedData[year] = {
          ...yearData,
          provas: yearData.provas?.map((act: any) => ({ ...act, mapImageUrl: buildMapUrl(act) })) || [],
          epicRides: yearData.epicRides?.map((act: any) => ({ ...act, mapImageUrl: buildMapUrl(act) })) || []
        };
      }

      // Retorna exatamente a estrutura exigida: { lastUpdate: ..., data: { "2026": {...} } }
      return c.json({
        lastUpdate: payload.lastUpdate,
        data: formattedData
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