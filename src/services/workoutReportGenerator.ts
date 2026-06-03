/**
 * KINETIX HUB - Motor Vetorial de Relatórios Táticos (WeasyPrint Compliance)
 * Gera o HTML otimizado para o compilador de PDF respeitando o BioMedal V11 Nordic Dark Mode.
 * NOTA: É terminantemente proibido o uso de Flexbox/Grid para preservar os cálculos de página.
 */

export interface PlannedWorkout {
  date: string;
  day: string;
  name: string;
  warmup: string | null;
  cooldown: string | null;
  restDetails: string | null;
  corrida: string | null;
  academia: string | null;
  bike: string | null;
  mesocycleStage?: number;
}

const sanitizeValue = (val: string | null): string => {
  if (!val || val.trim() === '' || val.trim().toLowerCase() === 'null') {
    return '<span class="null-val">-</span>';
  }
  if (val.trim().toUpperCase() === 'OFF') {
    return '<span class="null-val">OFF</span>';
  }
  return val;
};

const getBadge = (name: string, corrida: string | null): string => {
  const text = `${name} ${corrida || ''}`.toLowerCase();
  
  if (text.includes('prova') || text.includes('marathon') || text.includes('maratona')) {
    return '<span class="badge badge-goal">GOAL</span>';
  }
  if (text.includes('tiro') || text.includes('limiar') || text.includes('interval')) {
    return '<span class="badge badge-quality">QUALITY</span>';
  }
  if (text.includes('longão') || text.includes('longo') || text.includes('endurance')) {
    return '<span class="badge badge-endurance">ENDURANCE</span>';
  }
  if (text.includes('descanso') || text.includes('off')) {
    return '<span class="badge badge-locked">LOCKED</span>';
  }
  if (text.includes('regen') || text.includes('recuperação')) {
    return '<span class="badge badge-recovery">RECOVERY</span>';
  }
  
  return '<span class="badge badge-easy">EASY</span>';
};

const getSparkline = (corrida: string | null): string => {
  if (!corrida || corrida.trim() === '' || corrida.trim().toLowerCase() === 'null' || corrida === 'OFF') {
    return '';
  }
  // Extrai quilometragem (Ex: "10.5km" ou "5 km")
  const match = corrida.match(/(\d+(?:[\.,]\d+)?)\s*km/i);
  if (match) {
    const km = parseFloat(match[1].replace(',', '.'));
    const maxKm = 21; // Limite de proporção em 100%
    const percentage = Math.min((km / maxKm) * 100, 100);
    return `<div class="sparkline-container"><div class="sparkline-fill" style="width: ${percentage}%;"></div></div>`;
  }
  return '';
};

const generateWorkoutRows = (workouts: PlannedWorkout[]): string => {
  let rows = '';
  for (const w of workouts) {
    rows += `
      <tr>
        <td>
          <div style="margin-bottom: 2px; color: #06b6d4; font-weight: 800; font-size: 9pt;">${w.date}</div>
          <div style="font-size: 6.5pt; color: #64748b; text-transform: uppercase; font-weight: bold;">${w.day}</div>
        </td>
        <td>
          <div style="margin-bottom: 6px;">
            <span style="display: inline-block; width: 3px; height: 10px; background-color: #06b6d4; vertical-align: middle; margin-right: 4px; border-radius: 1px;"></span>
            <strong style="vertical-align: middle; font-size: 8pt; color: #f8fafc;">${sanitizeValue(w.name)}</strong>
          </div>
          ${getBadge(w.name, w.corrida)}
        </td>
        <td>${sanitizeValue(w.warmup)}</td>
        <td>${sanitizeValue(w.cooldown)}</td>
        <td>${sanitizeValue(w.restDetails)}</td>
        <td>
          ${sanitizeValue(w.corrida)}
          ${getSparkline(w.corrida)}
        </td>
        <td>${sanitizeValue(w.academia)}</td>
        <td>${sanitizeValue(w.bike)}</td>
      </tr>
    `;
  }
  return rows;
};

function getNutritionFooter(daysToTargetRace?: number): string {
  if (daysToTargetRace !== undefined && daysToTargetRace <= 3) {
    return `<div style="background-color: #742a2a; color: #e2e8f0; font-weight: bold; text-align: center; padding: 8px; margin-top: 15px;">
              FOCO NUTRICIONAL: Saturação de Glicogênio (D-${daysToTargetRace})
            </div>`;
  }
  return `<div style="background-color: #2d3748; color: #a0aec0; text-align: center; padding: 8px; margin-top: 15px;">
            FOCO NUTRICIONAL: Manutenção e Hidratação Padrão
          </div>`;
}

const getHtmlTemplate = (title: string, body: string, footer: string = '') => `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
  <title>Relatório Tático de Macrociclo</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 12mm 10mm;
      background-color: #0f172a;
    }
    body {
      background-color: #0f172a;
      font-family: 'Inter', 'Roboto', 'Helvetica Neue', Arial, sans-serif;
      color: #e2e8f0;
      font-size: 7.5pt;
      line-height: 1.4;
      margin: 0;
      padding: 0;
    }
    p, tr, td, th, div { orphans: 3; widows: 3; }
    
    .header-banner { padding: 0 0 12px 0; border-bottom: 2px solid #06b6d4; text-align: left; margin-bottom: 20px; background-color: transparent; }
    .header-banner h1 { font-size: 16pt; font-weight: 800; text-transform: uppercase; margin: 0; color: #f8fafc; letter-spacing: 1.5px; }
    .header-banner .subtitle { font-size: 7pt; color: #06b6d4; text-transform: uppercase; letter-spacing: 2px; margin-top: 4px; font-weight: bold; }
    
    .telemetry-card { display: table; width: 100%; background-color: #1e293b; margin-bottom: 15px; page-break-inside: avoid; border-radius: 4px; border-left: 4px solid #06b6d4; }
    .telemetry-cell { display: table-cell; padding: 12px 10px; vertical-align: middle; text-align: center; border-right: 1px solid rgba(255, 255, 255, 0.05); }
    .telemetry-cell:last-child { border-right: none; }
    .telemetry-label { font-size: 6.5pt; color: #64748b; text-transform: uppercase; margin-bottom: 3px; font-weight: bold; letter-spacing: 0.5px; }
    .telemetry-value { font-size: 9.5pt; font-weight: 800; color: #f8fafc; }
    
    table.workouts-table { width: 100%; border-collapse: collapse; background-color: transparent; margin-bottom: 15px; }
    table.workouts-table th { background-color: transparent; text-transform: uppercase; font-weight: 800; text-align: left; font-size: 6pt; letter-spacing: 1px; color: #64748b; border: none; border-bottom: 1px solid rgba(255, 255, 255, 0.1); padding: 8px; }
    table.workouts-table td { border: none; border-bottom: 1px solid rgba(255, 255, 255, 0.05); padding: 12px 8px; vertical-align: top; }
    table.workouts-table tr { page-break-inside: avoid; }
    table.workouts-table tr:nth-child(even) { background-color: rgba(255, 255, 255, 0.015); }
    
    .badge { padding: 3px 6px; border-radius: 12px; font-size: 6pt; font-weight: 800; text-transform: uppercase; display: inline-block; letter-spacing: 0.5px; border: 1px solid transparent; }
    .badge-quality { background-color: rgba(225, 29, 72, 0.15); color: #fb7185; border-color: rgba(225, 29, 72, 0.3); }
    .badge-endurance { background-color: rgba(217, 119, 6, 0.15); color: #fbbf24; border-color: rgba(217, 119, 6, 0.3); }
    .badge-locked { background-color: rgba(71, 85, 105, 0.15); color: #94a3b8; border-color: rgba(71, 85, 105, 0.3); }
    .badge-easy { background-color: rgba(16, 185, 129, 0.15); color: #34d399; border-color: rgba(16, 185, 129, 0.3); }
    .badge-recovery { background-color: rgba(6, 182, 212, 0.15); color: #22d3ee; border-color: rgba(6, 182, 212, 0.3); }
    .badge-goal { background-color: rgba(249, 115, 22, 0.15); color: #fdba74; border-color: rgba(249, 115, 22, 0.3); }
    
    .null-val { color: #334155; font-size: 8px; font-style: italic; }
    .sparkline-container { background-color: rgba(255, 255, 255, 0.05); height: 4px; width: 100%; margin-top: 6px; border-radius: 2px; overflow: hidden; }
    .sparkline-fill { background-color: #06b6d4; height: 100%; }
  </style>
</head>
<body>
  <div class="header-banner">
    <h1>${title}</h1>
    <div class="subtitle">CONFIDENTIAL TACTICAL BRIEFING - KINETIX HUB</div>
  </div>
  <div class="telemetry-card">
    <div class="telemetry-cell"><div class="telemetry-label">SISTEMA</div><div class="telemetry-value">BioMedal V11</div></div>
    <div class="telemetry-cell"><div class="telemetry-label">STATUS</div><div class="telemetry-value">ALTA PERFORMANCE</div></div>
    <div class="telemetry-cell"><div class="telemetry-label">TRAVA</div><div class="telemetry-value">SEG / SEX OFF</div></div>
  </div>
  ${body}
  ${footer}
</body>
</html>`;

const generateWeeklyPlanHtml = (workouts: PlannedWorkout[], footer: string = ''): string => {
  let totalKm = 0;
  let strengthSessions = 0;
  let bikeSessions = 0;

  for (const w of workouts) {
    if (w.corrida && w.corrida.trim() !== '' && w.corrida.trim().toLowerCase() !== 'null' && w.corrida.trim().toUpperCase() !== 'OFF') {
      const match = w.corrida.match(/(\d+(?:[\.,]\d+)?)\s*km/i);
      if (match) {
        totalKm += parseFloat(match[1].replace(',', '.'));
      }
    }
    if (w.academia && w.academia.trim() !== '' && w.academia.trim().toLowerCase() !== 'null' && w.academia.trim().toUpperCase() !== 'OFF') {
      strengthSessions++;
    }
    if (w.bike && w.bike.trim() !== '' && w.bike.trim().toLowerCase() !== 'null' && w.bike.trim().toUpperCase() !== 'OFF') {
      bikeSessions++;
    }
  }

  const rows = generateWorkoutRows(workouts);
  const body = `
  <div class="telemetry-card">
    <div class="telemetry-cell"><div class="telemetry-label">VOLUME DE PISTA</div><div class="telemetry-value">${totalKm > 0 ? totalKm.toFixed(1) + ' KM Estimados' : '-'}</div></div>
    <div class="telemetry-cell"><div class="telemetry-label">LABORATÓRIO DE FORÇA</div><div class="telemetry-value">${strengthSessions} Sess${strengthSessions === 1 ? 'ão' : 'ões'}</div></div>
    <div class="telemetry-cell"><div class="telemetry-label">ENGENHARIA DE BASE</div><div class="telemetry-value">${bikeSessions} Sess${bikeSessions === 1 ? 'ão' : 'ões'}</div></div>
  </div>
  <table class="workouts-table">
    <thead><tr><th style="width: 8%;">Data</th><th style="width: 16%;">Missão</th><th style="width: 12%;">Aquecimento</th><th style="width: 12%;">Desaquecimento</th><th style="width: 12%;">Repouso</th><th style="width: 15%;">Corrida</th><th style="width: 12%;">Academia</th><th style="width: 13%;">Bike</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  `;
  return getHtmlTemplate('Planilha Tática Semanal', body, footer);
};

const generateAcwrReportHtml = (workouts: PlannedWorkout[], footer: string = ''): string => {
  const body = `
    <div class="telemetry-card">
      <div class="telemetry-cell" style="width: 100%; border: none; text-align: left;">
        <div class="telemetry-label">DIÁRIO DE VIAGEM - FASE DE DELOAD</div>
        <div class="telemetry-value" style="font-size: 11pt;">Foco em recuperação e assimilação de ganhos.</div>
      </div>
    </div>
    <p>Placeholder para o gráfico vetorial de ACWR (Carga Aguda vs. Crônica) e resumo da semana de volume reduzido.</p>
  `;
  return getHtmlTemplate('Diário de Viagem - Deload', body, footer);
};

const generateRaceDossierHtml = (workouts: PlannedWorkout[], footer: string = ''): string => {
  const race = workouts.find(w => w.name?.toLowerCase().includes('prova'));
  const body = `
    <div class="telemetry-card">
      <div class="telemetry-cell" style="width: 100%; border: none; text-align: left;">
        <div class="telemetry-label">OPERAÇÃO: ${race?.name || 'PROVA ALVO'}</div>
        <div class="telemetry-value" style="font-size: 11pt;">Modo Combate: Protocolos de Tapering e Pico ativados.</div>
      </div>
    </div>
    <p>Placeholder para o Dossiê Global de Prova, incluindo Pace Chart, táticas de hidratação, nutrição e logística baseadas no Weather-Pacing Service.</p>
  `;
  return getHtmlTemplate('Dossiê Global de Prova', body, footer);
};

export const generateWorkoutReportHtml = (workouts: PlannedWorkout[]): string => {
  if (!workouts || workouts.length === 0) {
    return getHtmlTemplate('Relatório Semanal', '<h1>Nenhum treino para a semana.</h1>');
  }

  const stage = workouts[0].mesocycleStage || 1;
  const raceWorkout = workouts.find(w => w.name?.toLowerCase().includes('prova'));
  const isRaceWeek = !!raceWorkout;
  
  let daysToTargetRace: number | undefined;
  if (isRaceWeek && raceWorkout) {
    const raceDate = new Date(raceWorkout.date);
    const today = new Date();
    daysToTargetRace = Math.max(0, Math.ceil((raceDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));
  }

  const nutritionFooter = getNutritionFooter(daysToTargetRace);

  if (isRaceWeek) {
    return generateRaceDossierHtml(workouts, nutritionFooter); // Cenário C
  }
  if (stage === 4) {
    return generateAcwrReportHtml(workouts, nutritionFooter); // Cenário B
  }
  
  return generateWeeklyPlanHtml(workouts, nutritionFooter); // Cenário A
};