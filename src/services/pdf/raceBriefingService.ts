import PDFDocument from 'pdfkit';

export function generateRaceBriefingPdf(raceId: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const buffers: Buffer[] = [];
      
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve(Buffer.concat(buffers)));

      doc.fontSize(20).fillColor('#333333').text(`Race Briefing: Tabela Smart Pace (${raceId})`, { align: 'center' });
      doc.moveDown(2);

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

      // Iteração Matemática (Tabela de Passagens do KM 1 ao 5)
      const targetPaceSeconds = 5 * 60; // Pace Base: 5:00 min/km

      for (let km = 1; km <= 5; km++) {
        // Linha divisória fina simulando borda da tabela
        doc.moveTo(startX, currentY + rowHeight).lineTo(545, currentY + rowHeight).lineWidth(0.5).stroke('#cccccc');

        doc.text(`KM ${km}`, col1, currentY + 10);
        doc.text('5:00', col2, currentY + 10);
        
        // Cálculo Aritmético do Relógio Acumulado
        const totalSeconds = targetPaceSeconds * km;
        const m = Math.floor(totalSeconds / 60);
        const s = (totalSeconds % 60).toString().padStart(2, '0');
        doc.text(`${m}:${s}`, col3, currentY + 10);

        currentY += rowHeight;
      }
      
      doc.moveDown(2).fontSize(14).font('Helvetica-Bold').text('Condições Climáticas Esperadas:');
      doc.font('Helvetica').fontSize(12).text('Temperatura na Largada: 18°C | Umidade: 65%');
      doc.end();
    } catch (error) { reject(error); }
  });
}