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
          <div style="margin-bottom: 2px;"><strong>${w.date}</strong></div>
          <div style="font-size: 6.5pt; color: #a0aec0;">${w.day}</div>
        </td>
        <td>
          <div style="margin-bottom: 4px;"><strong>${sanitizeValue(w.name)}</strong></div>
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
  <title>Relatório Tático de Macrociclo</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 12mm 10mm;
      background-color: #1a202c;
    }
    body {
      background-color: #1a202c;
      font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
      color: #e2e8f0;
      font-size: 7.5pt;
      line-height: 1.4;
      margin: 0;
      padding: 0;
    }
    p, tr, td, th, div { orphans: 3; widows: 3; }
    
    .header-banner { background-color: #2d3748; border-bottom: 3px solid #ed8936; padding: 12px; text-align: center; margin-bottom: 15px; }
    .header-banner h1 { font-size: 14pt; font-weight: 700; text-transform: uppercase; margin: 0; color: #e2e8f0; }
    
    .telemetry-card { display: table; width: 100%; background-color: #2d3748; margin-bottom: 15px; page-break-inside: avoid; }
    .telemetry-cell { display: table-cell; padding: 10px; vertical-align: middle; text-align: center; border-right: 1px solid #4a5568; }
    .telemetry-cell:last-child { border-right: none; }
    .telemetry-label { font-size: 6.5pt; color: #a0aec0; text-transform: uppercase; margin-bottom: 3px; }
    .telemetry-value { font-size: 9pt; font-weight: bold; color: #e2e8f0; }
    
    table.workouts-table { width: 100%; border-collapse: collapse; background-color: #2d3748; }
    table.workouts-table th { background-color: #4a5568; text-transform: uppercase; font-weight: bold; text-align: left; }
    table.workouts-table th, table.workouts-table td { border: 1px solid #4a5568; padding: 6px 5px; }
    table.workouts-table tr { page-break-inside: avoid; }
    table.workouts-table tr:nth-child(even) { background-color: #232d3f; }
    
    .badge { padding: 2px 4px; border-radius: 3px; font-size: 6.5pt; font-weight: bold; text-transform: uppercase; display: inline-block; }
    .badge-quality { background-color: #742a2a; color: #feb2b2; }
    .badge-endurance { background-color: #744210; color: #fbd38d; }
    .badge-locked { background-color: #4a5568; color: #a0aec0; }
    .badge-easy { background-color: #2b6cb0; color: #90cdf4; }
    .badge-recovery { background-color: #234e52; color: #81e6d9; }
    .badge-goal { background-color: #dd6b20; color: #fffff0; }
    
    .null-val { color: #718096; font-style: italic; }
    .sparkline-container { background-color: #1a202c; height: 3px; width: 100%; margin-top: 4px; }
    .sparkline-fill { background-color: #ed8936; height: 100%; }
  </style>
</head>
<body>
  <div class="header-banner">
    <h1>${title}</h1>
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
  const rows = generateWorkoutRows(workouts);
  const body = `
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

  const stage = (workouts[0] as any).mesocycleStage || 1;
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