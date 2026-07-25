import PDFDocument from 'pdfkit';
import { eq, and } from 'drizzle-orm';
import { db } from '@/db';
import { workoutSessions, workoutTemplates, strengthLogs, workoutTemplateItems, exerciseLibrary } from '@/db/schema';

export async function generateStrengthAuditPdf(sessionId: string, templateId: string): Promise<Buffer> {
  // Busca as informações da Sessão e do Template
  const sessionResult = await db.select().from(workoutSessions).where(eq(workoutSessions.id, sessionId)).limit(1);
  const session = sessionResult[0];
  if (!session) throw new Error("Sessão não encontrada");

  const templateResult = await db.select().from(workoutTemplates).where(eq(workoutTemplates.id, templateId)).limit(1);
  const template = templateResult[0];
  if (!template) throw new Error("Template de treino não encontrado");

  // Busca os dados da Auditoria (Join Relacional)
  const audit = await db.select({
    exerciseName: exerciseLibrary.name,
    plannedSets: workoutTemplateItems.sets,
    plannedReps: workoutTemplateItems.reps,
    actualSets: strengthLogs.actualSets,
    actualReps: strengthLogs.actualReps,
    weightUsed: strengthLogs.weightUsed,
  })
  .from(strengthLogs)
  .innerJoin(exerciseLibrary, eq(strengthLogs.exerciseId, exerciseLibrary.id))
  .innerJoin(workoutTemplateItems, and(
    eq(workoutTemplateItems.exerciseId, exerciseLibrary.id),
    eq(workoutTemplateItems.templateId, templateId)
  ))
  .where(eq(strengthLogs.sessionId, sessionId));

  return new Promise((resolve, reject) => {
    const Doc = typeof PDFDocument === 'function' ? PDFDocument : (PDFDocument as any).default || PDFDocument;
    const doc = new Doc({ margin: 50 });
    const buffers: Buffer[] = [];

    doc.on('data', (chunk: Buffer) => buffers.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    // Cabeçalho do Relatório
    doc.fontSize(20).fillColor('black').text('KINETIX HUB - Auditoria de Força', { align: 'center' }).moveDown();
    doc.fontSize(14).text(`Ficha Analisada: ${template.name}`, { align: 'center' }).moveDown();

    doc.fontSize(12).text(`Data da Execução: ${session.date.toLocaleDateString('pt-BR')}`);
    doc.text(`Duração Registada: ${session.durationMinutes} minutos`).moveDown(2);

    // Cabeçalho da Tabela
    const startX = 50;
    let currentY = doc.y;
    
    doc.fontSize(10).fillColor('#4b5563'); // Cinza
    doc.text('Exercício', startX, currentY, { width: 180 });
    doc.text('Planeado (Sets x Reps)', startX + 180, currentY, { width: 130 });
    doc.text('Realizado', startX + 310, currentY, { width: 100 });
    doc.text('Carga Levantada', startX + 410, currentY, { width: 90 });
    
    currentY += 20;
    doc.moveTo(startX, currentY).lineTo(540, currentY).stroke('#e5e7eb');
    currentY += 10;

    // Linhas da Tabela
    doc.fillColor('black');
    audit.forEach((row) => {
      if (currentY > 700) { doc.addPage(); currentY = 50; } // Paginação segura

      doc.text(row.exerciseName, startX, currentY, { width: 180 });
      doc.text(`${row.plannedSets} x ${row.plannedReps}`, startX + 180, currentY, { width: 130 });
      doc.text(`${row.actualSets} x ${row.actualReps}`, startX + 310, currentY, { width: 100 });
      doc.text(row.weightUsed ? `${row.weightUsed} kg` : '-', startX + 410, currentY, { width: 90 });

      currentY += 20;
      doc.moveTo(startX, currentY).lineTo(540, currentY).stroke('#f3f4f6');
      currentY += 10;
    });
    doc.end();
  });
}
