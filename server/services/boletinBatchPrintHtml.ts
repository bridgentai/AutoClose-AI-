import type { StoredBoletinEntry } from '../repositories/academicBoletinBatchRepository.js';

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function asLegacyLogros(m: any): Array<{ nombre: string; peso: number | null; promedio: number | null; notas: number[] }> {
  if (Array.isArray(m?.logros)) return m.logros;
  if (Array.isArray(m?.categorias)) {
    return m.categorias.map((categoria: any) => ({
      nombre: categoria.nombre,
      peso: typeof categoria.peso === 'number' ? categoria.peso : null,
      promedio: typeof categoria.promedio === 'number' ? categoria.promedio : null,
      notas: [],
    }));
  }
  return [];
}

function oneStudentHtml(b: StoredBoletinEntry): string {
  const nombre = b.estudiante.nombre ?? 'Estudiante';
  const email = b.estudiante.email ?? '';
  const grupo = b.grupo ?? '';
  const prom = b.promedioGeneral !== null ? b.promedioGeneral.toFixed(1) : '—';
  const mejorMateria =
    b.mejorMateria?.nombre && b.mejorMateria?.promedio != null
      ? `<span class="meta-pill">Mejor: ${esc(b.mejorMateria.nombre)} (${esc(String(b.mejorMateria.promedio))})</span>`
      : '';
  const peorMateria =
    b.peorMateria?.nombre && b.peorMateria?.promedio != null
      ? `<span class="meta-pill">Por reforzar: ${esc(b.peorMateria.nombre)} (${esc(String(b.peorMateria.promedio))})</span>`
      : '';
  let materiasHtml = '';
  for (const m of b.materias) {
    const logrosData = asLegacyLogros(m);
    const logros =
      logrosData.length > 0
        ? `<div class="subject-logros">${logrosData
            .map((logro) => {
              const notas = logro.notas.length > 0 ? logro.notas.map((nota) => esc(String(nota))).join(' · ') : '—';
              return `<div class="logro-chip">
  <div class="logro-title">${esc(logro.nombre)}</div>
  <div class="logro-meta">Promedio: ${logro.promedio !== null ? esc(String(logro.promedio)) : '—'}${
    logro.peso != null ? ` · Peso ${esc(String(logro.peso))}%` : ''
  }</div>
  <div class="logro-notas">Notas: ${notas}</div>
</div>`;
            })
            .join('')}</div>`
        : '<div class="empty-card">Sin logros con notas registradas.</div>';
    const evo =
      m.evolucion.length > 0
        ? `<div class="curve-box"><div class="curve-inline">${m.evolucion
            .map((e) => `${esc(e.fecha)}: ${e.promedio}`)
            .join(' · ')}</div></div>`
        : '<div class="empty-card">Aún no hay suficientes notas para construir la curva.</div>';
    materiasHtml += `<section class="subject-card">
<div class="subject-header">
  <div>
    <h2>${esc(m.materia)}</h2>
    <p class="muted">Profesor: ${esc(m.profesor || '—')} · Asistencia: ${
      m.asistencia !== null ? `${m.asistencia}%` : '—'
    }</p>
  </div>
  <div class="subject-score">
    <div class="score-value">${m.promedio !== null ? esc(String(m.promedio)) : '—'}</div>
    <div class="score-label">${esc(m.estado)}</div>
  </div>
</div>
<div class="subject-layout">
  <div class="panel-block">
    <div class="panel-title">Notas por logro</div>
    ${logros}
  </div>
  <div class="panel-block">
    <div class="panel-title">Progreso del promedio</div>
    ${evo}
  </div>
  <div class="panel-block panel-block-ia">
    <div class="panel-title">Análisis IA de la vista analítica</div>
    <div class="ia-box subject-ia">${m.analisisIA ? esc(m.analisisIA) : 'Aún no hay análisis IA disponible para esta materia.'}</div>
  </div>
</div>
</section>`;
  }
  return `<article>
<div class="student-hero">
  <div>
    <p class="brand">Evo EduLab</p>
    <h2 style="font-size:1.55rem">${esc(nombre)}</h2>
    <p class="meta">${esc(email)}${grupo ? ` · ${esc(grupo)}` : ''}</p>
  </div>
  <div class="hero-score">
    <div class="hero-score-value">${esc(prom)}</div>
    <div class="hero-score-label">Promedio general</div>
    <span class="pill">${esc(b.estado)}</span>
  </div>
</div>
<div class="meta-row">${mejorMateria}${peorMateria}</div>
${
  b.resumenIA
    ? `<p class="ia-box"><strong>Resumen general</strong><br/>${esc(
        b.resumenIA
      )}</p>`
    : ''
}
${materiasHtml}
</article>`;
}

export function renderAcademicBoletinBatchPrintHtml(params: {
  groupName: string;
  periodo: string;
  createdAt: string;
  boletines: StoredBoletinEntry[];
}): string {
  const { groupName, periodo, createdAt, boletines } = params;
  const blocks = boletines
    .map((b) => oneStudentHtml(b))
    .join('\n<hr style="margin:2rem 0;border:none;border-top:1px solid #333" />\n');
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${esc(periodo)} · ${esc(groupName)}</title>
<style>
body{font-family:Inter,system-ui,sans-serif;background:radial-gradient(circle at top left,#1e3a8a 0%,#0f172a 42%,#020617 100%);color:#e8eefc;max-width:980px;margin:0 auto;padding:28px;line-height:1.5;}
h1{font-size:1.3rem;margin:0 0 8px;}
h2{font-size:1.2rem;margin:0 0 8px;color:#fff;}
.meta{color:rgba(255,255,255,0.7);font-size:0.92rem;margin:0;}
.muted{color:rgba(255,255,255,0.66);font-size:0.9rem;margin:6px 0 0;}
.brand{color:#9cc6ff;font-weight:700;letter-spacing:.03em;text-transform:uppercase;margin:0 0 12px;}
.student-hero,.subject-card,.ia-box{background:linear-gradient(145deg,rgba(30,58,138,0.35),rgba(15,23,42,0.62));backdrop-filter:blur(20px);border:1px solid rgba(255,255,255,0.08);box-shadow:0 0 40px rgba(37,99,235,0.18);}
.student-hero{display:flex;justify-content:space-between;gap:20px;padding:22px;border-radius:24px;align-items:flex-start;}
.hero-score{display:flex;flex-direction:column;align-items:flex-end;gap:8px;}
.hero-score-value{font-size:2.2rem;font-weight:800;color:#fff;}
.hero-score-label{font-size:0.9rem;color:rgba(255,255,255,0.68);}
.meta-row{display:flex;gap:10px;flex-wrap:wrap;margin:14px 0 0;}
.meta-pill,.pill{display:inline-block;padding:5px 10px;border-radius:999px;background:rgba(255,255,255,0.08);font-size:0.8rem;color:#eef4ff;}
.pill{text-transform:capitalize;}
.ia-box{padding:14px 16px;border-radius:18px;margin-top:18px;}
.subject-card{padding:20px;border-radius:24px;margin-top:18px;}
.subject-header{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;}
.subject-score{min-width:110px;text-align:right;}
.score-value{font-size:2rem;font-weight:800;color:#fff;}
.score-label{color:#8fb9ff;font-size:0.88rem;text-transform:capitalize;}
.subject-layout{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;margin-top:16px;align-items:stretch;}
.panel-block{background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:22px;padding:14px;min-height:290px;}
.panel-title{font-size:0.72rem;letter-spacing:.18em;text-transform:uppercase;color:rgba(255,255,255,0.58);font-weight:700;margin-bottom:12px;}
.subject-logros{display:grid;grid-template-columns:1fr;gap:12px;}
.logro-chip{background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.08);border-radius:16px;padding:12px;min-height:112px;}
.logro-title{font-weight:700;color:#fff;margin-bottom:4px;}
.logro-meta,.logro-notas{font-size:0.86rem;color:rgba(255,255,255,0.7);}
.curve-box{border:1px solid rgba(255,255,255,0.08);border-radius:18px;background:rgba(8,15,35,0.34);padding:14px;min-height:236px;}
.curve-inline{font-size:0.92rem;color:rgba(255,255,255,0.76);line-height:1.7;}
.subject-ia{margin-top:0;min-height:236px;}
.empty-card{min-height:236px;display:grid;place-items:center;text-align:center;border:1px dashed rgba(255,255,255,0.1);border-radius:18px;color:rgba(255,255,255,0.6);padding:18px;}
hr{border:none;border-top:1px solid rgba(255,255,255,0.12);}
@media print{
  body{background:#fff;color:#111827}
  .student-hero,.subject-card,.ia-box{background:#fff;color:#111827;border:1px solid #d4d8e1;box-shadow:none}
  .brand,.score-label{color:#1d4ed8}
  .meta,.muted,.logro-meta,.logro-notas,.hero-score-label{color:#475569}
  .logro-chip,.meta-pill,.pill,.panel-block,.curve-box{background:#f3f4f6;color:#111827;border:1px solid #e5e7eb}
  .empty-card{color:#475569;border:1px dashed #cbd5e1}
}
</style>
</head>
<body>
<h1>Boletines académicos</h1>
<p class="meta">${esc(groupName)} · ${esc(periodo)} · Generado ${esc(createdAt)} · ${
    boletines.length
  } estudiante(s)</p>
${blocks}
</body>
</html>`;
}
