import PDFDocument from 'pdfkit';
import { Buffer } from 'buffer';

export async function generateLogbookPdf(cycleId: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50 });
      const buffers: Buffer[] = [];

      doc.on('data', (chunk) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));

      // 1. Capa "Boarding Pass"
      doc.rect(50, 50, 512, 100).fill('#2c3e50');
      doc.fillColor('#1abc9c').fontSize(24).text('DIÁRIO DE VIAGEM (LOGBOOK)', 70, 75);
      doc.fillColor('#ecf0f1').fontSize(12).text(`Ciclo Tático: ${cycleId} | ACWR Topography`, 70, 110);

      // 2. Gráfico ACWR (Topografia Vetorial)
      const startX = 50;
      const chartWidth = 512;
      const chartY = 250;
      const chartHeight = 200;
      const chartBottom = chartY + chartHeight;

      // Mock Array de 16 semanas (Agudo vs Crônico)
      const acwrData = [0.8, 0.9, 1.1, 1.3, 1.0, 0.8, 0.7, 1.2, 1.6, 1.4, 1.1, 0.9, 1.0, 1.2, 1.3, 1.1];
      const maxAcwr = 2.0; // Teto do eixo Y
      const stepX = chartWidth / (acwrData.length - 1);

      // Cálculo Cartesiano dos pontos (X, Y)
      const points = acwrData.map((val, index) => {
        const x = startX + index * stepX;
        // Normalização: Eixo Y inverte visualmente (Cresce para baixo no PDFKit)
        const y = chartBottom - (val / maxAcwr) * chartHeight;
        return { x, y };
      });

      // Desenho da Área de Preenchimento Base (Fill)
      doc.moveTo(points[0].x, chartBottom);
      points.forEach(p => doc.lineTo(p.x, p.y));
      doc.lineTo(points[points.length - 1].x, chartBottom);
      doc.fillOpacity(0.2).fill('#1abc9c');

      // Linha Principal de Topografia (Stroke)
      doc.fillOpacity(1);
      doc.moveTo(points[0].x, points[0].y);
      points.forEach(p => doc.lineTo(p.x, p.y));
      doc.lineWidth(3).stroke('#1abc9c');

      // Zona de Perigo de Lesão (Linha de Corte ACWR = 1.5)
      const dangerY = chartBottom - (1.5 / maxAcwr) * chartHeight;
      doc.moveTo(startX, dangerY).lineTo(startX + chartWidth, dangerY).lineWidth(1).dash(5, { space: 5 }).stroke('#e74c3c').undash();
      doc.fillColor('#e74c3c').fontSize(10).text('Zona de Perigo (ACWR 1.5)', startX + 5, dangerY - 15);

      // 3. Retângulos Inferiores (Milestones & Logística)
      doc.rect(50, 480, 246, 80).fill('#34495e');
      doc.fillColor('#ecf0f1').fontSize(14).text('Auditoria de Arsenal', 65, 495);
      doc.fontSize(10).fillColor('#95a5a6').text('Tênis Alvo: UA HOVR Sonic (340/800km)\nStatus: Operacional', 65, 520);

      doc.rect(316, 480, 246, 80).fill('#34495e');
      doc.fillColor('#ecf0f1').fontSize(14).text('Compliance de Força', 331, 495);
      doc.fontSize(10).fillColor('#95a5a6').text('IronLog: 12 Sessões\nRisco Articular: Baixo', 331, 520);

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}
