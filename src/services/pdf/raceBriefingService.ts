import PDFDocument from 'pdfkit';
import { db } from '@/db';
import { races } from '@/db/schema';
import { eq, and, gte, asc, or } from 'drizzle-orm';
import { briefingService } from '@/services/briefingService';

export async function generateRaceBriefingPdf(raceId?: string): Promise<Buffer> {
  const today = new Date();
  
  const upcomingRaces = await db.select().from(races).where(
    and(
      or(eq(races.priority, 'P1'), eq(races.category, 'P1')),
      eq(races.isTarget, true),
      gte(races.date, today)
    )
  ).orderBy(asc(races.date)).limit(1);

  const targetRace = upcomingRaces.length > 0 ? upcomingRaces[0] : null;

  let weatherForecast = 'Condição Climática Desconhecida';
  let elevationText = 'Altimetria N/D';

  if (targetRace) {
    weatherForecast = await briefingService.getWeatherPoP(targetRace.latitude, targetRace.longitude);
    elevationText = targetRace.elevationGain ? `+${targetRace.elevationGain}m de Ganho de Elevação` : 'Altimetria N/D';
  }

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const buffers: Buffer[] = [];
      
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve(Buffer.concat(buffers)));

      if (!targetRace) {
        doc.fontSize(20).fillColor('#e74c3c').text('NENHUMA MISSÃO P1 ENCONTRADA', { align: 'center' });
        doc.end();
        return;
      }

      const raceName = targetRace.name || targetRace.category;
      const raceDateStr = targetRace.date.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });

      doc.fontSize(20).fillColor('#333333').text(`Race Briefing: Tabela Smart Pace`, { align: 'center' });
      doc.fontSize(12).fillColor('#666666').text(`Operação: ${raceName} | Data: ${raceDateStr} às ${targetRace.startTime} | Distância: ${targetRace.distance}km`, { align: 'center' });
      doc.fontSize(12).fillColor('#666666').text(`Topografia da Missão: ${elevationText}`, { align: 'center' });

      const startX = 50, startY = 150, rowHeight = 30;
      const col1 = 60, col2 = 200, col3 = 350;

      // Cabeçalho da Tabela
      doc.rect(startX, startY, 495, rowHeight).fill('#333333');
      doc.fillColor('#ffffff').fontSize(12).font('Helvetica-Bold');
      doc.text('Quilômetro', col1, startY + 10);
      doc.text('Pace Alvo (min/km)', col2, startY + 10);
      doc.text('Tempo Acumulado', col3, startY + 10);

      let currentY = startY + rowHeight;
      doc.font('Helvetica').fillColor('#333333');

      let targetPaceSeconds = 5 * 60;
      let paceStr = '5:00';
      if (targetRace.targetPace) {
        const paceMatch = targetRace.targetPace.match(/(\d+):(\d{2})/);
        if (paceMatch) {
          targetPaceSeconds = parseInt(paceMatch[1], 10) * 60 + parseInt(paceMatch[2], 10);
          paceStr = targetRace.targetPace;
        }
      }

      // Iteração Matemática Dinâmica
      const limitKm = Math.floor(targetRace.distance);

      for (let km = 1; km <= limitKm; km++) {
        if (currentY > 750) {
          doc.addPage();
          currentY = 50;
        }

        // Linha divisória fina simulando borda da tabela
        doc.moveTo(startX, currentY + rowHeight).lineTo(545, currentY + rowHeight).lineWidth(0.5).stroke('#cccccc');

        doc.text(`KM ${km}`, col1, currentY + 10);
        doc.text(paceStr, col2, currentY + 10);
        
        // Cálculo Aritmético do Relógio Acumulado
        const totalSeconds = targetPaceSeconds * km;
        const m = Math.floor(totalSeconds / 60);
        const s = (totalSeconds % 60).toString().padStart(2, '0');
        doc.text(`${m}:${s}`, col3, currentY + 10);

        currentY += rowHeight;
      }
      
      doc.y = currentY;
      if (doc.y > 750) {
        doc.addPage();
        doc.y = 50;
      }

      doc.moveDown(2).fontSize(14).font('Helvetica-Bold').text('Condições Climáticas Esperadas:');
      doc.font('Helvetica').fontSize(12).text(weatherForecast);
      doc.end();
    } catch (error) { reject(error); }
  });
}
