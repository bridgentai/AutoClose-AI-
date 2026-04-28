export interface EvoDocMetric {
  label: string;
  value: string;
  status: 'good' | 'warning' | 'critical' | 'neutral';
  icon?: string;
}

export interface EvoDocChartBar {
  label: string;
  value: number;
  maxValue?: number;
}

export interface EvoDocChartLine {
  label: string;
  value: number;
}

export interface EvoDocSection {
  title: string;
  narrative: string;
  chartType?: 'bar' | 'line';
  chartData?: EvoDocChartBar[] | EvoDocChartLine[];
}

export interface EvoDocData {
  title: string;
  subjectName: string;
  institutionName: string;
  period: string;
  docType: string;
  date: string;
  metrics: EvoDocMetric[];
  sections: EvoDocSection[];
  recommendations: string[];
}

const STATUS_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  good:     { bg: 'rgba(34,197,94,0.12)',  border: 'rgba(34,197,94,0.3)',  text: '#22c55e' },
  warning:  { bg: 'rgba(251,146,60,0.12)', border: 'rgba(251,146,60,0.3)', text: '#fb923c' },
  critical: { bg: 'rgba(239,68,68,0.12)',  border: 'rgba(239,68,68,0.3)',  text: '#ef4444' },
  neutral:  { bg: 'rgba(96,165,250,0.12)', border: 'rgba(96,165,250,0.3)', text: '#60a5fa' },
};

function renderMetricCard(m: EvoDocMetric): string {
  const c = STATUS_COLORS[m.status] || STATUS_COLORS.neutral;
  return `
    <div style="flex:1;min-width:140px;background:${c.bg};border:1px solid ${c.border};border-radius:12px;padding:16px 18px;">
      <div style="font-size:28px;font-weight:700;color:${c.text};margin-bottom:2px;">${m.value}</div>
      <div style="font-size:12px;color:rgba(255,255,255,0.5);">${m.label}</div>
    </div>`;
}

function renderBarChart(data: EvoDocChartBar[]): string {
  const maxVal = Math.max(...data.map(d => d.maxValue ?? d.value), 5);
  const bars = data.map(d => {
    const pct = Math.min((d.value / maxVal) * 100, 100);
    return `
      <div style="display:flex;flex-direction:column;align-items:center;flex:1;">
        <div style="width:100%;height:180px;display:flex;align-items:flex-end;justify-content:center;">
          <div style="width:60%;height:${pct}%;background:linear-gradient(180deg,#a855f7,#7c3aed);border-radius:6px 6px 0 0;min-height:4px;"></div>
        </div>
        <div style="font-size:11px;color:rgba(255,255,255,0.5);margin-top:8px;">${d.label}</div>
        <div style="font-size:12px;color:#e2e8f0;font-weight:600;">${d.value.toFixed(1)}</div>
      </div>`;
  }).join('');

  const yLabels = Array.from({ length: 6 }, (_, i) => maxVal - (i * maxVal / 5));
  const yAxis = yLabels.map(v => `<div style="font-size:10px;color:rgba(255,255,255,0.3);">${v.toFixed(0)}</div>`).join('');

  return `
    <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:12px;padding:20px;margin:16px 0;">
      <div style="display:flex;gap:8px;">
        <div style="display:flex;flex-direction:column;justify-content:space-between;height:180px;padding-right:8px;">${yAxis}</div>
        <div style="display:flex;gap:12px;flex:1;">${bars}</div>
      </div>
    </div>`;
}

function renderLineChart(data: EvoDocChartLine[]): string {
  if (data.length < 2) return '';
  const maxVal = Math.max(...data.map(d => d.value), 5);
  const minVal = Math.min(...data.map(d => d.value), 0);
  const range = maxVal - minVal || 1;
  const width = 600;
  const height = 180;
  const padding = 10;

  const points = data.map((d, i) => {
    const x = padding + (i / (data.length - 1)) * (width - 2 * padding);
    const y = height - padding - ((d.value - minVal) / range) * (height - 2 * padding);
    return { x, y, label: d.label, value: d.value };
  });

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const dots = points.map(p =>
    `<circle cx="${p.x}" cy="${p.y}" r="5" fill="#a855f7" stroke="#0f172a" stroke-width="2"/>`
  ).join('');
  const labels = points.map(p =>
    `<text x="${p.x}" y="${height + 16}" text-anchor="middle" fill="rgba(255,255,255,0.5)" font-size="11">${p.label}</text>`
  ).join('');

  return `
    <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:12px;padding:20px;margin:16px 0;">
      <svg width="100%" viewBox="0 0 ${width} ${height + 24}" preserveAspectRatio="xMidYMid meet">
        <path d="${pathD}" fill="none" stroke="#a855f7" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
        ${dots}
        ${labels}
      </svg>
    </div>`;
}

function renderSection(s: EvoDocSection): string {
  let chartHTML = '';
  if (s.chartType === 'bar' && s.chartData) {
    chartHTML = renderBarChart(s.chartData as EvoDocChartBar[]);
  } else if (s.chartType === 'line' && s.chartData) {
    chartHTML = renderLineChart(s.chartData as EvoDocChartLine[]);
  }

  return `
    <div style="margin-top:32px;">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;">
        <div style="width:4px;height:24px;background:#a855f7;border-radius:2px;"></div>
        <h2 style="font-size:18px;font-weight:700;color:#e2e8f0;margin:0;">${s.title}</h2>
      </div>
      <p style="font-size:13px;color:rgba(255,255,255,0.6);line-height:1.6;margin:0 0 8px 0;">${s.narrative}</p>
      ${chartHTML}
    </div>`;
}

function renderRecommendations(recs: string[]): string {
  if (recs.length === 0) return '';
  const items = recs.map(r => `
    <div style="display:flex;align-items:flex-start;gap:10px;margin-bottom:10px;">
      <div style="width:8px;height:8px;min-width:8px;background:#a855f7;border-radius:2px;margin-top:5px;"></div>
      <span style="font-size:13px;color:rgba(255,255,255,0.7);line-height:1.5;">${r}</span>
    </div>`).join('');

  return `
    <div style="margin-top:36px;background:rgba(168,85,247,0.06);border:1px solid rgba(168,85,247,0.15);border-radius:12px;padding:24px;">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:16px;">
        <div style="width:4px;height:24px;background:#a855f7;border-radius:2px;"></div>
        <h2 style="font-size:18px;font-weight:700;color:#e2e8f0;margin:0;">Recomendaciones</h2>
      </div>
      ${items}
    </div>`;
}

function docTypeBadge(docType: string): string {
  const labels: Record<string, string> = {
    student_analysis: 'Analisis Academico',
    group_risk: 'Riesgo Academico',
    attendance_report: 'Reporte Asistencia',
    custom: 'Documento',
  };
  return labels[docType] ?? 'Documento';
}

export function renderEvoDocHTML(data: EvoDocData): string {
  const metricsHTML = data.metrics.map(renderMetricCard).join('');
  const sectionsHTML = data.sections.map(renderSection).join('');
  const recsHTML = renderRecommendations(data.recommendations);

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
    * { margin:0; padding:0; box-sizing:border-box; }
    body {
      font-family: 'Inter', sans-serif;
      background: linear-gradient(170deg, #0f172a 0%, #07090f 50%, #0a0e1a 100%);
      color: #e2e8f0;
      min-height: 100vh;
      padding: 40px 48px;
    }
    @page { size: A4; margin: 0; }
  </style>
</head>
<body>
  <!-- Header -->
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:36px;">
    <div style="display:flex;align-items:center;gap:12px;">
      <div style="width:36px;height:36px;background:linear-gradient(135deg,#3b82f6,#7c3aed);border-radius:10px;display:flex;align-items:center;justify-content:center;">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
      </div>
      <span style="font-size:20px;font-weight:700;color:#e2e8f0;">Evo Docs</span>
    </div>
    <div style="display:flex;align-items:center;gap:16px;">
      <div style="text-align:right;">
        <div style="font-size:12px;color:rgba(255,255,255,0.5);">${data.institutionName}</div>
        <div style="font-size:12px;color:rgba(255,255,255,0.4);">${data.date}</div>
      </div>
      <div style="background:linear-gradient(135deg,#a855f7,#7c3aed);border-radius:20px;padding:6px 16px;">
        <span style="font-size:12px;font-weight:600;color:white;">${docTypeBadge(data.docType)}</span>
      </div>
    </div>
  </div>

  <!-- Subject info -->
  <div style="margin-bottom:28px;">
    <h1 style="font-size:28px;font-weight:700;color:#f1f5f9;margin-bottom:4px;">${data.subjectName}</h1>
    <div style="font-size:14px;color:rgba(255,255,255,0.45);">Periodo academico: ${data.period}</div>
  </div>

  <!-- KPI Metrics -->
  <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:8px;">
    ${metricsHTML}
  </div>

  <!-- Sections -->
  ${sectionsHTML}

  <!-- Recommendations -->
  ${recsHTML}

  <!-- Footer -->
  <div style="margin-top:48px;padding-top:16px;border-top:1px solid rgba(255,255,255,0.07);display:flex;justify-content:space-between;">
    <span style="font-size:11px;color:rgba(255,255,255,0.3);">Generado por Evo Agent</span>
    <span style="font-size:11px;color:rgba(255,255,255,0.3);">${data.institutionName}</span>
    <span style="font-size:11px;color:rgba(255,255,255,0.3);">Pagina 1</span>
  </div>
</body>
</html>`;
}
