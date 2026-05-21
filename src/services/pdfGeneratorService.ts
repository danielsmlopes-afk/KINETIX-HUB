import PDFDocument from 'pdfkit';

export async function generatePhysiologicalXRayBuffer(athleteName: string, bmr: number, bodyFat: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const buffers: Buffer[] = [];

    doc.on('data', (chunk) => buffers.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    doc.fontSize(22).text('RAIO-X FISIOLÓGICO', { align: 'center' }).moveDown();
    doc.fontSize(14).text(`Atleta Registrado: ${athleteName}`);
    doc.text(`TMB (Taxa Metabólica Basal): ${bmr} kcal`);
    doc.text(`Percentual de Gordura Atual: ${bodyFat}%`);
    doc.end();
  });
}