import PDFDocument from 'pdfkit';
import { db } from '@/db';
import { workoutSessions } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function generateCareerHistoryPdf(athleteId: string): Promise<Buffer> {
  try {
    // 1. Busca o histórico real de sessões do atleta
    const sessions = await db.select().from(workoutSessions)
      .where(eq(workoutSessions.athleteId, athleteId));

    // 2. Agrupa o volume (em km) por ano
    const volumeByYear: Record<string, number> = {};
    sessions.forEach(s => {
      const year = s.date.getFullYear().toString();
      const km = (s.distance || 0) / 1000;
      if (!volumeByYear[year]) volumeByYear[year] = 0;
      volumeByYear[year] += km;
    });

    let annualData = Object.keys(volumeByYear).sort().map(year => ({
      year,
      volume: Math.round(volumeByYear[year])
    }));

    // Se não houver dados, garante que o gráfico renderize o ano atual zerado
    if (annualData.length === 0) {
      annualData = [{ year: new Date().getFullYear().toString(), volume: 0 }];
    }

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const buffers: Buffer[] = [];
      
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve(Buffer.concat(buffers)));

      doc.fontSize(20).text('KINETIX HUB - Histórico de Carreira', { align: 'center' });
      doc.moveDown(1);
      doc.fontSize(14).fillColor('#666666').text('Esforço Anual Acumulado (Volume de Corrida)', { align: 'center' });
      doc.moveDown(3);

      const startX = 100, startY = 200, maxBarWidth = 350, barHeight = 40, spacing = 30;
      const maxVol = Math.max(...annualData.map(d => d.volume), 1); // Evita divisão por zero

      // Eixo Y (Linha Vertical)
      doc.moveTo(startX, startY - 20).lineTo(startX, startY + (annualData.length * (barHeight + spacing))).stroke('#cccccc');

      // Laço Geométrico: Desenhando as Barras Horizontais
      annualData.forEach((data, index) => {
        const y = startY + index * (barHeight + spacing);
        const width = (data.volume / maxVol) * maxBarWidth;

        // Rótulo do Ano no Eixo Y
        doc.fontSize(12).fillColor('#333333').text(data.year, startX - 45, y + 15);

        // Barra Horizontal Preenchida
        doc.rect(startX, y, width, barHeight).fill('#fc4c02');

        // Rótulo de Quilometragem Flutuante na Ponta
        doc.fillColor('#333333').text(`${data.volume} km`, startX + width + 10, y + 15);
      });

      doc.end();
    });
  } catch (error) {
    throw error;
  }
}