// Arquivo: src/controllers/reportController.ts
import { Context } from 'hono';
import { generatePhysiologicalXRayPDF, generateRaceReportPDF, generateCareerReportPDF, generatePlanPDF } from '@/services/pdfGeneratorService';
import { athleteRepository } from '@/repositories/athleteRepository';
import { generateLogbookPdf } from '../services/pdf/logbookService';
import { generateCareerHistoryPdf } from '../services/pdf/careerHistoryService';
import { generateRaceBriefingPdf } from '../services/pdf/raceBriefingService';
import { generateCardioReportPdf } from '../services/pdf/cardioEfficiencyService';
import { generateStrengthAuditPdf } from '../services/pdf/strengthAuditService';

export const reportController = {
  async downloadXRay(c: Context) {
    try {
      const monthParam = c.req.param('month');
      const yearParam = c.req.param('year');
      let athleteId = c.req.query('athleteId');

      if (!athleteId) {
        const athlete = await athleteRepository.getPrimaryAthlete();
        if (!athlete) return c.json({ error: "Atleta não encontrado.", code: "NOT_FOUND" }, 404);
        athleteId = athlete.id;
      }

      if (!monthParam || !yearParam) {
        return c.json({ error: "Parâmetros 'month' ou 'year' não fornecidos.", code: "MISSING_PARAMS" }, 400);
      }

      const month = parseInt(monthParam, 10);
      const year = parseInt(yearParam, 10);

      if (isNaN(month) || isNaN(year)) {
        return c.json({ error: "Parâmetros 'month' ou 'year' devem ser numéricos.", code: "INVALID_PARAMS" }, 400);
      }

      const pdfBuffer = await generatePhysiologicalXRayPDF(athleteId, month, year);
      const uint8Array = new Uint8Array(pdfBuffer);

      c.header('Content-Type', 'application/pdf');
      c.header('Content-Disposition', `attachment; filename="raio_x_fisiologico_${month}_${year}.pdf"`);
      
      return c.body(uint8Array);
    } catch (error) {
      console.error('❌ [REPORT CONTROLLER] Erro fatal na geração do PDF:', error);
      return c.json({ error: "Erro interno ao gerar o dossiê em PDF.", code: "PDF_ERR" }, 500);
    }
  },

  async downloadRaceReport(c: Context) {
    try {
      const raceId = c.req.param('raceId');
      if (!raceId) {
        return c.json({ error: "ID da prova não fornecido.", code: "MISSING_PARAMS" }, 400);
      }
      
      const pdfBuffer = await generateRaceReportPDF(raceId);
      c.header('Content-Type', 'application/pdf');
      c.header('Content-Disposition', `attachment; filename="prontuario_prova_${raceId}.pdf"`);
      return c.body(new Uint8Array(pdfBuffer));
    } catch (error) {
      console.error('❌ [REPORT CONTROLLER] Erro fatal na geração do PDF de prova:', error);
      return c.json({ error: "Erro interno ao gerar o Prontuário de Prova.", code: "PDF_ERR" }, 500);
    }
  },

  async downloadCareerReport(c: Context) {
    try {
      const pdfBuffer = await generateCareerReportPDF();
      c.header('Content-Type', 'application/pdf');
      c.header('Content-Disposition', `attachment; filename="dossie_carreira.pdf"`);
      return c.body(new Uint8Array(pdfBuffer));
    } catch (error) {
      console.error('❌ [REPORT CONTROLLER] Erro fatal na geração do Dossiê de Carreira:', error);
      return c.json({ error: "Erro interno ao gerar o Dossiê de Carreira.", code: "PDF_ERR" }, 500);
    }
  },

  async downloadPlanReport(c: Context) {
    try {
      let athleteId = c.req.query('athleteId');
      if (!athleteId) {
        const athlete = await athleteRepository.getPrimaryAthlete();
        if (!athlete) return c.json({ error: "Atleta não encontrado.", code: "NOT_FOUND" }, 404);
        athleteId = athlete.id;
      }
      const pdfBuffer = await generatePlanPDF(athleteId);
      c.header('Content-Type', 'application/pdf');
      c.header('Content-Disposition', `attachment; filename="planilha_treinos.pdf"`);
      return c.body(new Uint8Array(pdfBuffer));
    } catch (error) {
      console.error('❌ [REPORT CONTROLLER] Erro fatal na geração do PDF de planilha:', error);
      return c.json({ error: "Erro interno ao gerar o PDF de Planilha.", code: "PDF_ERR" }, 500);
    }
  },

  async downloadLogbook(c: Context) {
    try {
      const cycleId = c.req.param('cycleId');
      if (!cycleId) {
        return c.json({ error: "ID do ciclo não fornecido.", code: "MISSING_PARAMS" }, 400);
      }

      const pdfBuffer = await generateLogbookPdf(cycleId);
      
      c.header('Content-Type', 'application/pdf');
      c.header('Content-Disposition', 'attachment; filename="diario_viagem.pdf"');
      return c.body(new Uint8Array(pdfBuffer));
    } catch (error) {
      console.error('❌ [REPORT CONTROLLER] Erro fatal na geração do Logbook PDF:', error);
      return c.json({ error: "Erro interno ao gerar o Diário de Viagem.", code: "PDF_ERR" }, 500);
    }
  },

  async downloadCareerHistory(c: Context) {
    try {
      const pdfBuffer = await generateCareerHistoryPdf('primary-athlete');
      c.header('Content-Type', 'application/pdf');
      c.header('Content-Disposition', 'attachment; filename="historico_carreira.pdf"');
      return c.body(new Uint8Array(pdfBuffer));
    } catch (error) {
      return c.json({ error: "Erro ao gerar Histórico.", code: "PDF_ERR" }, 500);
    }
  },

  async downloadRaceBriefing(c: Context) {
    try {
      const raceId = c.req.param('raceId') || 'SP-21K';
      const pdfBuffer = await generateRaceBriefingPdf(raceId);
      c.header('Content-Type', 'application/pdf');
      c.header('Content-Disposition', `attachment; filename="race_briefing_${raceId}.pdf"`);
      return c.body(new Uint8Array(pdfBuffer));
    } catch (error) {
      return c.json({ error: "Erro ao gerar Briefing.", code: "PDF_ERR" }, 500);
    }
  },

  async downloadCardioReport(c: Context) {
    try {
      const month = c.req.param('month') || 'Geral';
      const pdfBuffer = await generateCardioReportPdf(month);
      c.header('Content-Type', 'application/pdf');
      c.header('Content-Disposition', `attachment; filename="cardio_report_${month}.pdf"`);
      return c.body(new Uint8Array(pdfBuffer));
    } catch (error) {
      return c.json({ error: "Erro ao gerar Relatório Cardio.", code: "PDF_ERR" }, 500);
    }
  },

  async downloadStrengthAudit(c: Context) {
    try {
      const sessionId = c.req.param('sessionId');
      const templateId = c.req.query('templateId');

      if (!sessionId || !templateId) {
        return c.json({ error: "Os parâmetros 'sessionId' e 'templateId' são obrigatórios.", code: "MISSING_PARAMS" }, 400);
      }
      const pdfBuffer = await generateStrengthAuditPdf(sessionId, templateId);
      c.header('Content-Type', 'application/pdf');
      c.header('Content-Disposition', `attachment; filename="auditoria_forca_${sessionId.slice(0,6)}.pdf"`);
      return c.body(new Uint8Array(pdfBuffer));
    } catch (error) {
      return c.json({ error: "Erro ao gerar Auditoria de Força em PDF.", code: "PDF_ERR" }, 500);
    }
  }
};