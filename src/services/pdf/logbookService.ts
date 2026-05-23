import PDFDocument from 'pdfkit';

export function generateLogbookPdf(cycleId: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      // Inicialização do Documento (Tamanho A4, margens limpas de 50pt)
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const buffers: Buffer[] = [];

      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        resolve(Buffer.concat(buffers));
      });

      // --- PÁGINA 1: BOARDING PASS (CAPA VETORIAL) ---
      // Retângulo Cinza de Fundo com contorno
      doc.rect(50, 50, 495, 200).fillAndStroke('#f4f4f4', '#cccccc');
      doc.fill('#333333');
      doc.fontSize(24).text('KINETIX HUB - BOARDING PASS', 70, 70);
      doc.fontSize(14).text(`DESTINO: Nike SP 21K (Prova P1 Alvo)`, 70, 115);
      doc.text(`CICLO ID: ${cycleId}`, 70, 140);
      doc.text(`PACE DE VOO ALVO: 5:00 min/km`, 70, 165);
      doc.text(`STATUS DE DECOLAGEM: AUTORIZADO`, 70, 190);

      // --- PÁGINA 2: GRÁFICO VETORIAL ACWR ---
      doc.addPage();
      doc.fontSize(18).text('Topografia do Treinamento (ACWR)', 50, 50);
      
      // Mock de 16 semanas de treinamento
      const acwrData = [0.8, 0.9, 1.1, 1.3, 1.4, 1.6, 1.2, 1.0, 1.1, 1.4, 1.7, 1.3, 1.1, 0.9, 0.8, 1.0];
      const startX = 50, startY = 110, chartW = 495, chartH = 200;
      const maxAcwr = 2.0;
      const stepX = chartW / (acwrData.length - 1);

      // Eixos Cartesianos (X e Y)
      doc.moveTo(startX, startY).lineTo(startX, startY + chartH).lineTo(startX + chartW, startY + chartH).stroke('#999999');

      // Polígono da Área Preenchida (Cinza Claro)
      doc.moveTo(startX, startY + chartH);
      acwrData.forEach((val, i) => doc.lineTo(startX + i * stepX, startY + chartH - (val / maxAcwr) * chartH));
      doc.lineTo(startX + chartW, startY + chartH).fill('#e8e8e8');

      // Linha Contínua da Carga (Traço Escuro)
      let isFirst = true;
      acwrData.forEach((val, i) => {
        const x = startX + i * stepX, y = startY + chartH - (val / maxAcwr) * chartH;
        if (isFirst) { doc.moveTo(x, y); isFirst = false; } else doc.lineTo(x, y);
      });
      doc.stroke('#333333');

      // Limite Crítico: Zona de Perigo Tracejada (ACWR = 1.5)
      const dangerY = startY + chartH - (1.5 / maxAcwr) * chartH;
      doc.moveTo(startX, dangerY).lineTo(startX + chartW, dangerY).dash(5, { space: 5 }).stroke('#ff4444');
      doc.undash(); // Retira o tracejado para os próximos desenhos
      doc.fill('#ff4444').fontSize(10).text('Zona de Perigo (1.5)', startX + chartW - 100, dangerY - 15);

      // --- PÁGINA 3: MILESTONES (CARIMBOS DE VIAGEM) ---
      doc.addPage();
      doc.fill('#333333').fontSize(18).text('Milestones (Carimbos de Viagem)', 50, 50);
      doc.rect(50, 80, 495, 120).stroke('#cccccc');
      doc.fontSize(14).text('Provas Intermediárias e Testes de Fogo', 70, 100);
      doc.fontSize(12).fillColor('#666666');
      doc.text('🔸 Prova P2: Meia Maratona Preparatória (12/06) - Concluída', 70, 130);
      doc.text('🔸 Teste de Fogo: Longão Máximo Alcançado 18km (28/06) - Validado', 70, 155);

      // --- PÁGINA 4: INVENTÁRIO DE BORDO ---
      doc.addPage();
      doc.fill('#333333').fontSize(18).text('Inventário de Bordo', 50, 50);
      doc.rect(50, 80, 495, 150).stroke('#cccccc');
      doc.fontSize(14).text('Auditoria Final do Ciclo', 70, 100);
      doc.fontSize(12).fillColor('#666666');
      doc.text('🔸 Tênis Padrão: UA HOVR Sonic 6 Storm (Status: Ativo)', 70, 130);
      doc.text('🔸 Evolução Fisiológica: Comparativo de Bioimpedância finalizado (-2% BF)', 70, 155);
      doc.text('🔸 Força e Resiliência: Total de 36 Sessões IronLog_V2 cumpridas', 70, 180);

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}
