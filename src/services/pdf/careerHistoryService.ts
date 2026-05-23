import PDFDocument from 'pdfkit';

export function generateCareerHistoryPdf(athleteId: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const buffers: Buffer[] = [];
      
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve(Buffer.concat(buffers)));

      doc.fontSize(20).text('KINETIX HUB - Histórico de Carreira', { align: 'center' });
      doc.moveDown(1);
      doc.fontSize(14).fillColor('#666666').text('Esforço Anual Acumulado (Volume de Corrida)', { align: 'center' });
      doc.moveDown(3);

      // Mock Data: Volume (km) por Ano
      const annualData = [
        { year: '2024', volume: 850 },
        { year: '2025', volume: 1420 },
        { year: '2026', volume: 2100 }
      ];

      const startX = 100, startY = 200, maxBarWidth = 350, barHeight = 40, spacing = 30;
      const maxVol = Math.max(...annualData.map(d => d.volume));

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
    } catch (error) { reject(error); }
  });
}