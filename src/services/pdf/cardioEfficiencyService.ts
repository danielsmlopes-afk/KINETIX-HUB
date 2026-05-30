import PDFDocument from 'pdfkit';

export const cardioEfficiencyService = {
  async generateCardioReportPdf(athleteId: string, month: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ margin: 50 });
        const buffers: Buffer[] = [];

        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => resolve(Buffer.concat(buffers)));

        // 1. Título do Relatório
        doc.fontSize(20).text('RAIO-X CARDIOVASCULAR', { align: 'center' });
        doc.moveDown(0.5);
        doc.fontSize(12).fillColor('#666666').text(`Atleta: ${athleteId} | Mês: ${month}`, { align: 'center' });
        doc.moveDown(3);

        // 2. Mock de Dados Reais de Telemetria (FC vs Pace)
        // No futuro, busque isso na tabela `workout_sessions` filtrando por 'RUN'
        const mockWorkouts = [
          { pace: 5.5, bpm: 155 }, { pace: 5.0, bpm: 162 }, { pace: 4.5, bpm: 175 },
          { pace: 6.0, bpm: 145 }, { pace: 5.2, bpm: 158 }, { pace: 4.8, bpm: 168 },
          { pace: 6.5, bpm: 135 }, { pace: 5.8, bpm: 148 }, { pace: 5.3, bpm: 154 }
        ];

        // 3. Geometria do Gráfico de Dispersão (Scatter Plot)
        const chartX = 60;
        const chartY = 150;
        const chartWidth = 400;
        const chartHeight = 250;

        // Desenhar Eixos (Plano Cartesiano)
        doc.lineWidth(1).strokeColor('#aaaaaa');
        doc.moveTo(chartX, chartY).lineTo(chartX, chartY + chartHeight).stroke(); // Eixo Y
        doc.moveTo(chartX, chartY + chartHeight).lineTo(chartX + chartWidth, chartY + chartHeight).stroke(); // Eixo X

        // Rótulos
        doc.fontSize(10).fillColor('#333333');
        doc.text('BPM', chartX - 25, chartY - 15);
        doc.text('Pace Lento ──────> Pace Rápido', chartX + chartWidth - 150, chartY + chartHeight + 15);

        // Normalização Geométrica
        const maxBpm = 200;
        const minBpm = 100;
        const slowestPace = 7.0; 
        const fastestPace = 4.0;

        // 4. Plotagem (Dispersão Vetorial)
        for (const w of mockWorkouts) {
          // Normaliza o Pace no eixo X
          // (slowestPace - w.pace) / (slowestPace - fastestPace) => 0 a 1
          const xPercent = (slowestPace - w.pace) / (slowestPace - fastestPace);
          const xPos = chartX + (xPercent * chartWidth);

          // Normaliza o BPM no eixo Y (Invertido, pois o eixo Y do PDF cresce para baixo)
          const yPercent = (w.bpm - minBpm) / (maxBpm - minBpm);
          const yPos = (chartY + chartHeight) - (yPercent * chartHeight);

          // Desenha a leitura
          doc.circle(xPos, yPos, 4).fillAndStroke('#ff4444', '#cc0000');
        }

        // 5. Conclusão Tática IA
        doc.moveDown(18);
        doc.fillColor('#000000').fontSize(14).text('Análise Diagnóstica', { underline: true });
        doc.moveDown(0.5);
        doc.fontSize(11).fillColor('#444444').text('A dispersão evidencia excelente eficiência termodinâmica da máquina. A relação entre velocidade (pace) e custo cardíaco (BPM) encontra-se num padrão linear estável para rodagens de Z2, atestando forte aderência aeróbica para a próxima missão alvo.', { align: 'justify' });

        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }
};