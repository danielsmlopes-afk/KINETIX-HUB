import { Context } from 'hono';
import { db } from '@/db';
import { monumentRecords } from '@/db/schema';
import { desc, eq, and, asc } from 'drizzle-orm';
import { fetchMapStaticBuffer } from '@/services/pdfGeneratorService';

export const hallOfFameController = {
  async getHallOfFame(c: Context) {
    try {
      const user = c.get('user');
      const records = await db.select({
        id: monumentRecords.id,
        year: monumentRecords.year,
        eventName: monumentRecords.eventName,
        distance: monumentRecords.distance,
        officialTime: monumentRecords.officialTime,
        pace: monumentRecords.pace,
        weather: monumentRecords.weather,
        // polyline é omitida para otimizar o payload da lista
        isAllTimePr: monumentRecords.isAllTimePr,
        isYearPr: monumentRecords.isYearPr,
      })
        .from(monumentRecords)
        .where(eq(monumentRecords.athleteId, user.id))
        .orderBy(desc(monumentRecords.year), asc(monumentRecords.distance));
      return c.json({ data: records });
    } catch (error) {
      console.error('Erro ao buscar o Hall of Fame:', error);
      return c.json({ error: 'Falha ao buscar os registros do Hall of Fame.' }, 500);
    }
  },

  async addRecord(c: Context) {
    try {
      const body = await c.req.json();
      const user = c.get('user');

      const { year, eventName, distance, officialTime, pace, weather, polyline, isAllTimePr } = body;

      if (!year || !eventName || !distance || !officialTime || !pace) {
        return c.json({ error: 'Parâmetros obrigatórios ausentes.' }, 400);
      }

      // Se a nova prova já entrar como Crown Jewel, rebaixa as outras da mesma distância
      if (isAllTimePr === true) {
        await db.update(monumentRecords)
          .set({ isAllTimePr: false })
          .where(and(eq(monumentRecords.athleteId, user.id), eq(monumentRecords.distance, distance)));
      }

      const inserted = await db.insert(monumentRecords).values({
        athleteId: user.id,
        year: Number(year),
        eventName,
        distance,
        officialTime,
        pace,
        weather: weather || '--',
        polyline: polyline || null,
        isAllTimePr: isAllTimePr || false,
      }).returning();

      return c.json({ data: inserted[0], message: 'Prova épica registrada com sucesso!' }, 201);
    } catch (error) {
      console.error('Erro ao registrar no Hall of Fame:', error);
      return c.json({ error: 'Falha ao registrar prova épica.' }, 500);
    }
  },

  async getDossier(c: Context) {
    try {
      const id = c.req.param('id');
      const user = c.get('user');
      
      if (!id) {
        return c.json({ error: 'O parâmetro ID é obrigatório.' }, 400);
      }

      const records = await db.select()
        .from(monumentRecords)
        .where(and(eq(monumentRecords.id, id), eq(monumentRecords.athleteId, user.id)));
      
      if (!records || records.length === 0) {
        return c.json({ error: 'Record not found' }, 404);
      }
      
      const record = records[0];

      let base64Map = '';
      if (record.polyline) {
        const mapBuffer = await fetchMapStaticBuffer(record.polyline);
        if (mapBuffer) {
          base64Map = 'data:image/png;base64,' + Buffer.from(mapBuffer).toString('base64');
        }
      }
      
      const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>MONUMENT DOSSIER - ${record.eventName}</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800;900&family=JetBrains+Mono:wght@400;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg-dark: #0f172a;
      --bg-panel: rgba(30, 41, 59, 0.7);
      --accent-cyan: #00e5ff;
      --accent-amber: #fbbf24;
      --text-main: #f8fafc;
      --text-muted: #94a3b8;
      --border-glow: rgba(0, 229, 255, 0.3);
    }
    body {
      font-family: 'Inter', sans-serif;
      background-color: var(--bg-dark);
      color: var(--text-main);
      padding: 40px 20px;
      margin: 0;
      display: flex;
      justify-content: center;
      background-image: 
        radial-gradient(circle at 15% 50%, rgba(0, 229, 255, 0.05), transparent 25%),
        radial-gradient(circle at 85% 30%, rgba(251, 191, 36, 0.05), transparent 25%);
    }
    .dossier-container {
      max-width: 800px;
      width: 100%;
      background: var(--bg-panel);
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 16px;
      padding: 40px;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 20px var(--border-glow);
      position: relative;
      overflow: hidden;
    }
    .dossier-container::before {
      content: '';
      position: absolute;
      top: 0; left: 0; width: 100%; height: 4px;
      background: linear-gradient(90deg, var(--accent-cyan), var(--accent-amber));
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      padding-bottom: 20px;
      margin-bottom: 30px;
    }
    .header-title h1 {
      font-weight: 900;
      font-size: 2.5rem;
      letter-spacing: 4px;
      margin: 0;
      color: var(--text-main);
      text-transform: uppercase;
    }
    .header-title p {
      color: var(--accent-cyan);
      font-weight: 600;
      letter-spacing: 2px;
      margin: 5px 0 0 0;
      text-transform: uppercase;
    }
    .badge-year {
      background: rgba(251, 191, 36, 0.1);
      color: var(--accent-amber);
      padding: 8px 16px;
      border-radius: 4px;
      border: 1px solid rgba(251, 191, 36, 0.3);
      font-family: 'JetBrains Mono', monospace;
      font-weight: 700;
      font-size: 1.2rem;
    }
    .event-name {
      font-size: 1.5rem;
      font-weight: 800;
      margin-bottom: 30px;
      color: var(--text-main);
    }
    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 20px;
      margin-bottom: 40px;
    }
    .metric-card {
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.05);
      border-radius: 8px;
      padding: 20px;
      text-align: center;
      transition: transform 0.2s;
    }
    .metric-card:hover {
      transform: translateY(-2px);
      border-color: rgba(0, 229, 255, 0.3);
    }
    .metric-label {
      font-size: 0.75rem;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 1.5px;
      margin-bottom: 8px;
      font-weight: 600;
    }
    .metric-value {
      font-family: 'JetBrains Mono', monospace;
      font-size: 1.8rem;
      font-weight: 700;
      color: var(--accent-cyan);
    }
    .metric-value.highlight {
      color: var(--accent-amber);
    }
    .map-section {
      margin-top: 20px;
    }
    .map-title {
      font-size: 0.9rem;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 2px;
      margin-bottom: 15px;
      font-weight: 600;
      display: flex;
      align-items: center;
    }
    .map-title::after {
      content: '';
      flex-grow: 1;
      height: 1px;
      background: rgba(255, 255, 255, 0.1);
      margin-left: 15px;
    }
    .map-container {
      width: 100%;
      border-radius: 12px;
      overflow: hidden;
      border: 1px solid rgba(255, 255, 255, 0.1);
      position: relative;
      background: rgba(0, 0, 0, 0.3);
    }
    .map-container img {
      width: 100%;
      height: auto;
      display: block;
      filter: contrast(1.1) brightness(0.9);
    }
    .no-map {
      text-align: center;
      padding: 40px;
      color: var(--text-muted);
      font-style: italic;
      background: rgba(0,0,0,0.2);
      border-radius: 12px;
      border: 1px dashed rgba(255,255,255,0.1);
    }
    .footer {
      margin-top: 40px;
      text-align: center;
      font-size: 0.7rem;
      color: var(--text-muted);
      letter-spacing: 2px;
      text-transform: uppercase;
    }
  </style>
</head>
<body>
  <div class="dossier-container">
    <div class="header">
      <div class="header-title">
        <h1>MONUMENT</h1>
        <p>TACTICAL DOSSIER</p>
      </div>
      <div class="badge-year">${record.year}</div>
    </div>
    
    <div class="event-name">${record.eventName}</div>
    
    <div class="metrics-grid">
      <div class="metric-card">
        <div class="metric-label">DISTANCE</div>
        <div class="metric-value highlight">${record.distance}</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">OFFICIAL TIME</div>
        <div class="metric-value">${record.officialTime}</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">AVG PACE</div>
        <div class="metric-value">${record.pace}</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">WEATHER</div>
        <div class="metric-value" style="font-size: 1.2rem; margin-top: 10px;">${record.weather || '--'}</div>
      </div>
    </div>
    
    <div class="map-section">
      <div class="map-title">CARTOGRAPHIC TELEMETRY</div>
      ${base64Map ? `
      <div class="map-container">
        <img src="${base64Map}" alt="Tactical Route Map" />
      </div>` : `
      <div class="no-map">[ MAPA DE TELEMETRIA INDISPONÍVEL ]</div>`}
    </div>

    <div class="footer">
      KINETIX HUB // SECURE CHANNEL // RESTRICTED ACCESS
    </div>
  </div>
</body>
</html>`;
      return c.html(html);
    } catch (error) {
      console.error('Erro ao gerar dossiê:', error);
      return c.json({ error: 'Falha ao gerar o dossiê.' }, 500);
    }
  },

  async togglePr(c: Context) {
    try {
      const id = c.req.param('id');
      const user = c.get('user');
      
      if (!id) {
        return c.json({ error: 'O parâmetro ID é obrigatório.' }, 400);
      }

      const records = await db.select()
        .from(monumentRecords)
        .where(and(eq(monumentRecords.id, id), eq(monumentRecords.athleteId, user.id)));

      if (!records || records.length === 0) {
        return c.json({ error: 'Record not found' }, 404);
      }

      const current = records[0].isAllTimePr;
      const newValue = !current;

      // Se está promovendo uma nova Crown Jewel, rebaixa outros recordes da mesma distância
      if (newValue === true) {
        await db.update(monumentRecords)
          .set({ isAllTimePr: false })
          .where(and(eq(monumentRecords.athleteId, user.id), eq(monumentRecords.distance, records[0].distance)));
      }

      await db.update(monumentRecords)
        .set({ isAllTimePr: newValue })
        .where(and(eq(monumentRecords.id, id), eq(monumentRecords.athleteId, user.id)));

      return c.json({ success: true, newValue });
    } catch (error) {
      console.error('Erro ao alternar PR:', error);
      return c.json({ error: 'Falha ao atualizar o recorde.' }, 500);
    }
  }
};