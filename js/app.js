// =========================================
// app.js — Calculadora de Notas Finales
// Proyecto Web 2025
// Sistema: Parciales 0-100 · EF 0-100
// 2 parciales: 30%+30%+40% | 3 parciales: 20%+20%+20%+40%
// Aprobación: nota >= 60
// =========================================

// ---- ESTADO DE LA APLICACIÓN ----
var D = JSON.parse(localStorage.getItem('cnf_v4') || '{"semestres":{},"semActual":""}');
var numP   = 2;       // parciales activos en formulario ingresar
var apNumP = 2;       // parciales activos en ¿puedo aprobar?
var sortMode = 'az';  // modo de ordenamiento actual
var chartInst = null; // instancia de Chart.js
var apParcs = [];     // parciales ingresados en ¿puedo aprobar?

function save() { localStorage.setItem('cnf_v4', JSON.stringify(D)); }
function getMats(s) { return ((D.semestres[s || D.semActual] || {}).materias) || []; }

// ---- COLORES Y BADGES ----
function nColor(n) {
  return n >= 80 ? '#4ade80' : n >= 60 ? '#fbbf24' : '#f87171';
}
function nBadge(n) {
  if (n >= 80) return '<span class="badge badge-ok">✓ Aprobado</span>';
  if (n >= 60) return '<span class="badge badge-wn">~ Aprobado justo</span>';
  return '<span class="badge badge-ml">✗ Reprobado</span>';
}

// ---- MENSAJE MOTIVACIONAL ----
function motivMsg(p) {
  if (!isFinite(p)) return null;
  if (p >= 90) return { m: '🚀 ¡Excelente rendimiento! Seguí así.', c: 'motiv-ok' };
  if (p >= 75) return { m: '👍 ¡Muy bien! Vas por buen camino.', c: 'motiv-ok' };
  if (p >= 60) return { m: '💪 Aprobaste, ¡pero podés mejorar!', c: 'motiv-wn' };
  if (p >= 40) return { m: '📚 Todavía hay tiempo para recuperar.', c: 'motiv-wn' };
  return { m: '🔥 ¡No te rindás! Hay que ponerse las pilas.', c: 'motiv-bd' };
}

// ---- NAVEGACIÓN ----
// Oculta todas las secciones y muestra la solicitada
function go(id) {
  document.querySelectorAll('.seccion').forEach(function(s) { s.classList.remove('activa'); });
  document.querySelectorAll('.nav-btn').forEach(function(b) { b.classList.remove('active'); });
  document.getElementById('s-' + id).classList.add('activa');
  document.getElementById('nav-' + id).classList.add('active');
  if (id === 'inicio')    renderInicio();
  if (id === 'resumen')   renderResumen();
  if (id === 'semestres') renderSemestres();
  if (id === 'ingresar')  updateDL();
}

// ---- SECCIÓN INICIO ----
function renderInicio() {
  var m = getMats();
  var p = m.length ? m.reduce(function(a, x) { return a + x.nota; }, 0) / m.length : NaN;
  var ap = m.filter(function(x) { return x.nota >= 60; }).length;
  document.getElementById('h-count').textContent = m.length;
  document.getElementById('h-prom').textContent  = isFinite(p) ? p.toFixed(1) : '—';
  document.getElementById('h-apro').textContent  = ap;
  document.getElementById('h-repr').textContent  = m.length - ap;
  document.getElementById('h-sem').textContent   = D.semActual || '(ninguno activo)';
  var mv = motivMsg(p);
  document.getElementById('motiv-home').innerHTML = mv ? '<div class="motiv ' + mv.c + '">' + mv.m + '</div>' : '';
}

// ---- SECCIÓN INGRESAR — datalist de semestres ----
function updateDL() {
  var dl = document.getElementById('sem-dl');
  dl.innerHTML = Object.keys(D.semestres).map(function(k) {
    return '<option value="' + k + '"></option>';
  }).join('');
  if (D.semActual) document.getElementById('inp-sem').value = D.semActual;
}

// Cambia cantidad de parciales y regenera campos
function setP(n) {
  numP = n;
  document.getElementById('sb2').classList.toggle('active', n === 2);
  document.getElementById('sb3').classList.toggle('active', n === 3);
  renderCP();
  document.getElementById('prev-box').classList.add('oculto');
}

// Genera los inputs de parciales dinámicamente
function renderCP() {
  var w = numP === 2 ? 30 : 20;
  var cls = numP === 2 ? 'form-row-2' : 'form-row-3';
  var h = '<div class="' + cls + '" style="margin-bottom:.75rem">';
  for (var i = 1; i <= numP; i++) {
    h += '<div class="form-group">' +
      '<label>Parcial ' + i + ' <span class="peso-tag">' + w + '%</span></label>' +
      '<input type="number" id="inp-p' + i + '" min="0" max="100" step="0.1" placeholder="0 – 100">' +
      '<span class="error" id="er-p' + i + '">Debe ser entre 0 y 100.</span></div>';
  }
  document.getElementById('campos-p').innerHTML = h + '</div>';
}

// Obtiene valores de parciales del formulario
function getPV() {
  var v = [];
  for (var i = 1; i <= numP; i++) v.push(+document.getElementById('inp-p' + i).value);
  return v;
}

// Valida un campo y muestra/oculta su mensaje de error
function vf(id, eid, fn) {
  var el = document.getElementById(id);
  if (!el) return true;
  var ok = fn(el.value);
  document.getElementById(eid).style.display = ok ? 'none' : 'block';
  return ok;
}

// Valida todo el formulario de ingreso
function vForm() {
  var ok = true;
  ok = vf('inp-mat', 'er-mat', function(v) { return v.trim().length > 0; }) && ok;
  for (var i = 1; i <= numP; i++) {
    (function(j) {
      ok = vf('inp-p' + j, 'er-p' + j, function(v) { return v !== '' && +v >= 0 && +v <= 100; }) && ok;
    })(i);
  }
  ok = vf('inp-ef', 'er-ef', function(v) { return v !== '' && +v >= 0 && +v <= 100; }) && ok;
  return ok;
}

// Calcula la nota final ponderada (escala 0-100)
// 2 parciales: P1×30% + P2×30% + EF×40%
// 3 parciales: P1×20% + P2×20% + P3×20% + EF×40%
function calcN(parc, ef, np) {
  var w = np === 2 ? 0.30 : 0.20;
  var s = 0;
  for (var i = 0; i < parc.length; i++) s += parc[i] * w;
  return s + ef * 0.40;
}

// Muestra el resultado sin guardar (previsualización)
function doPreview() {
  if (!vForm()) return;
  var parc = getPV();
  var ef   = +document.getElementById('inp-ef').value;
  var nota = parseFloat(calcN(parc, ef, numP).toFixed(1));
  var c = nColor(nota);
  document.getElementById('prev-nota').textContent = nota.toFixed(1);
  document.getElementById('prev-bdg').innerHTML    = nBadge(nota);
  var bar = document.getElementById('prev-bar');
  bar.style.width      = nota + '%';
  bar.style.background = c;
  var w = numP === 2 ? 30 : 20;
  var h = '';
  for (var i = 0; i < parc.length; i++) {
    h += '<div class="des-item"><div class="des-val">' + (parc[i] * w / 100).toFixed(1) + '</div><div class="des-lbl">P' + (i + 1) + ' (' + w + '%)</div></div>';
  }
  h += '<div class="des-item"><div class="des-val">' + (ef * 0.40).toFixed(1) + '</div><div class="des-lbl">EF (40%)</div></div>';
  document.getElementById('prev-des').innerHTML = h;
  document.getElementById('prev-box').classList.remove('oculto');
}

// Guarda la materia en el semestre actual
function doGuardar() {
  if (!vForm()) return;
  var sem    = document.getElementById('inp-sem').value.trim() || 'Semestre sin nombre';
  var nombre = document.getElementById('inp-mat').value.trim();
  var parc   = getPV();
  var ef     = +document.getElementById('inp-ef').value;
  var nota   = parseFloat(calcN(parc, ef, numP).toFixed(1));
  if (!D.semestres[sem]) D.semestres[sem] = { materias: [] };
  D.semActual = sem;
  D.semestres[sem].materias.push({ nombre: nombre, parciales: parc, ef: ef, nota: nota, np: numP });
  save();
  document.getElementById('inp-mat').value = '';
  for (var i = 1; i <= numP; i++) document.getElementById('inp-p' + i).value = '';
  document.getElementById('inp-ef').value = '';
  document.getElementById('prev-box').classList.add('oculto');
  go('resumen');
}

// ---- SECCIÓN ¿PUEDO APROBAR? ----
function setAP(n) {
  apNumP = n;
  document.getElementById('ap2').classList.toggle('active', n === 2);
  document.getElementById('ap3').classList.toggle('active', n === 3);
  renderCAP();
  document.getElementById('ap-res').classList.add('oculto');
}

function renderCAP() {
  var w   = apNumP === 2 ? 30 : 20;
  var cls = apNumP === 2 ? 'form-row-2' : 'form-row-3';
  var h   = '<div class="' + cls + '" style="margin-bottom:.75rem">';
  for (var i = 1; i <= apNumP; i++) {
    h += '<div class="form-group"><label>Parcial ' + i + ' <span class="peso-tag">' + w + '%</span></label>' +
      '<input type="number" id="ap-p' + i + '" min="0" max="100" step="0.1" placeholder="0 – 100"></div>';
  }
  document.getElementById('campos-ap').innerHTML = h + '</div>';
}

// Calcula el mínimo necesario en el examen final para aprobar
function doCalcAp() {
  var parc = [];
  var w = apNumP === 2 ? 0.30 : 0.20;
  for (var i = 1; i <= apNumP; i++) {
    var v = +document.getElementById('ap-p' + i).value;
    if (isNaN(v) || v < 0 || v > 100) { alert('Verificá las notas de parciales (0–100).'); return; }
    parc.push(v);
  }
  apParcs = parc;
  var sumP = 0;
  for (var j = 0; j < parc.length; j++) sumP += parc[j] * w;

  // EF mínimo = (60 - puntaje_acumulado) / 0.40
  var efMin = (60 - sumP) / 0.40;

  document.getElementById('ap-psum').textContent = sumP.toFixed(1);
  document.getElementById('ap-efmin').textContent = efMin > 100 ? '> 100' : efMin <= 0 ? '0' : efMin.toFixed(1);
  document.getElementById('ap-rest').textContent  = Math.max(0, 60 - sumP).toFixed(1);

  var msg = '';
  if (efMin <= 0) {
    msg = '<div class="warn-box warn-ok">✓ ¡Ya aseguraste la aprobación con tus parciales! Cualquier nota en el EF te mantiene aprobado/a.</div>';
  } else if (efMin > 100) {
    msg = '<div class="warn-box warn-bad">✗ No es posible aprobar. Aunque saques 100 en el examen final, la suma no alcanza los 60 puntos necesarios.</div>';
  } else if (efMin >= 80) {
    msg = '<div class="warn-box warn-med">⚠ Situación difícil. Necesitás ' + efMin.toFixed(1) + ' en el EF. Es posible, pero muy exigente.</div>';
  } else {
    msg = '<div class="warn-box warn-ok">✓ Necesitás sacar <strong>' + efMin.toFixed(1) + '</strong> o más en el examen final para aprobar.</div>';
  }
  document.getElementById('ap-msg').innerHTML = msg;

  var init = Math.max(0, Math.min(100, Math.round(efMin)));
  document.getElementById('ap-slider').value = init;
  document.getElementById('ap-res').classList.remove('oculto');
  doSim();
}

// Simulador de EF — actualiza al mover el slider
function doSim() {
  var v = +document.getElementById('ap-slider').value;
  document.getElementById('ap-slv').textContent = v;
  document.getElementById('ap-sef').textContent = v;
  if (!apParcs.length) return;
  var w = apNumP === 2 ? 0.30 : 0.20;
  var s = 0;
  for (var j = 0; j < apParcs.length; j++) s += apParcs[j] * w;
  var nota = parseFloat((s + v * 0.40).toFixed(1));
  document.getElementById('ap-snota').textContent = nota.toFixed(1);
  document.getElementById('ap-sbdg').innerHTML    = nBadge(nota);
}

// ---- SECCIÓN RESUMEN ----
function setSort(m) {
  sortMode = m;
  ['az', 'hl', 'lh'].forEach(function(s) {
    document.getElementById('srt-' + s).classList.toggle('active', s === m);
  });
  renderLista();
  tryChart();
}

// Retorna las materias del semestre activo ordenadas según el modo actual
function getSorted() {
  var arr = getMats().slice();
  if (sortMode === 'az') arr.sort(function(a, b) { return a.nombre.localeCompare(b.nombre); });
  else if (sortMode === 'hl') arr.sort(function(a, b) { return b.nota - a.nota; });
  else arr.sort(function(a, b) { return a.nota - b.nota; });
  return arr;
}

// Renderiza la lista de materias con boton de eliminar
function renderLista() {
  var sorted = getSorted();
  var all    = getMats();
  if (!sorted.length) {
    document.getElementById('res-lista').innerHTML = '<div class="vacio">Sin materias.</div>';
    return;
  }
  document.getElementById('res-lista').innerHTML = sorted.map(function(m) {
    var c   = nColor(m.nota);
    var idx = all.indexOf(m);
    var det = m.parciales.map(function(p, i) { return 'P' + (i + 1) + ': ' + p; }).join(' · ') + ' · EF: ' + m.ef;
    return '<div class="materia-item">' +
      '<div><div class="mat-nombre">' + m.nombre + '</div><div class="mat-detalle">' + det + '</div></div>' +
      '<div style="display:flex;align-items:center">' +
      '<span class="nota-pill" style="background:' + c + '22;color:' + c + '">' + m.nota.toFixed(1) + '</span>' +
      '<button class="btn-borrar" onclick="doDelMat(' + idx + ')" aria-label="Eliminar">✕</button>' +
      '</div></div>';
  }).join('');
}

// Espera a que Chart.js esté disponible antes de renderizar
function tryChart() {
  if (typeof Chart === 'undefined') { setTimeout(tryChart, 200); return; }
  renderChart();
}

// Renderiza el gráfico de barras con nota mínima de referencia
function renderChart() {
  if (typeof Chart === 'undefined') return;
  var sorted = getSorted();
  var canvas = document.getElementById('chart-c');
  if (!canvas || !sorted.length) return;
  if (chartInst) { chartInst.destroy(); chartInst = null; }
  chartInst = new Chart(canvas.getContext('2d'), {
    type: 'bar',
    data: {
      labels: sorted.map(function(m) {
        return m.nombre.length > 14 ? m.nombre.substring(0, 13) + '…' : m.nombre;
      }),
      datasets: [{
        label: 'Nota final',
        data: sorted.map(function(m) { return m.nota; }),
        backgroundColor: sorted.map(function(m) { return nColor(m.nota) + '55'; }),
        borderColor: sorted.map(function(m) { return nColor(m.nota); }),
        borderWidth: 1,
        borderRadius: 4
      }, {
        type: 'line',
        label: 'Mínimo (60)',
        data: sorted.map(function() { return 60; }),
        borderColor: 'rgba(150,150,150,0.4)',
        borderWidth: 1,
        borderDash: [5, 5],
        pointRadius: 0,
        fill: false,
        tension: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { labels: { color: '#888', font: { size: 11 }, boxWidth: 10 } } },
      scales: {
        y: { min: 0, max: 100, grid: { color: 'rgba(128,128,128,0.1)' }, ticks: { color: '#888', font: { size: 11 } } },
        x: { grid: { display: false }, ticks: { color: '#888', font: { size: 11 }, maxRotation: 30 } }
      }
    }
  });
}

// Renderiza la sección de resumen completa
function renderResumen() {
  var m     = getMats();
  var empty = document.getElementById('res-empty');
  var cont  = document.getElementById('res-content');
  if (!m.length) {
    empty.style.display = 'flex';
    cont.classList.add('oculto');
    return;
  }
  empty.style.display = 'none';
  cont.classList.remove('oculto');
  var p  = m.reduce(function(a, x) { return a + x.nota; }, 0) / m.length;
  var ap = m.filter(function(x) { return x.nota >= 60; }).length;
  document.getElementById('r-prom').textContent  = p.toFixed(1);
  document.getElementById('r-total').textContent = m.length;
  document.getElementById('r-apro').textContent  = ap;
  document.getElementById('r-repr').textContent  = m.length - ap;
  var mv = motivMsg(p);
  document.getElementById('res-motiv').innerHTML = mv ? '<div class="motiv ' + mv.c + '">' + mv.m + '</div>' : '';
  renderLista();
  tryChart();
}

// Elimina una materia por índice en el array original
function doDelMat(i) {
  D.semestres[D.semActual].materias.splice(i, 1);
  save();
  renderResumen();
  renderInicio();
}

// Limpia todas las materias del semestre activo
function doClear() {
  if (!D.semActual) return;
  if (!confirm('¿Seguro que querés limpiar todas las materias de este semestre?')) return;
  D.semestres[D.semActual].materias = [];
  save();
  renderResumen();
}

// ---- EXPORTAR PDF ----
function doExportPDF() {
  var m = getMats();
  if (!m.length) { alert('No hay materias para exportar.'); return; }
  if (typeof jspdf === 'undefined') { alert('El módulo PDF aún se está cargando. Intentá en un momento.'); return; }
  var doc = new jspdf.jsPDF();
  doc.setFontSize(16);
  doc.text('Calculadora de Notas Finales', 14, 20);
  doc.setFontSize(10);
  doc.setTextColor(120);
  doc.text('Semestre: ' + (D.semActual || '—'), 14, 28);
  doc.text('Parciales 60%  ·  Examen Final 40%  ·  Aprobación ≥ 60', 14, 34);
  var prom = m.reduce(function(a, x) { return a + x.nota; }, 0) / m.length;
  var ap   = m.filter(function(x) { return x.nota >= 60; }).length;
  doc.text('Promedio: ' + prom.toFixed(1) + '  |  Aprobadas: ' + ap + '  |  Reprobadas: ' + (m.length - ap), 14, 42);
  doc.autoTable({
    startY: 50,
    head: [['Materia', 'Notas', 'Nota Final', 'Estado']],
    body: m.map(function(x) {
      return [
        x.nombre,
        x.parciales.map(function(p, i) { return 'P' + (i + 1) + ': ' + p; }).join(' | ') + ' | EF: ' + x.ef,
        x.nota.toFixed(1),
        x.nota >= 60 ? 'Aprobado' : 'Reprobado'
      ];
    }),
    styles: { fontSize: 9 },
    headStyles: { fillColor: [20, 60, 100] },
    alternateRowStyles: { fillColor: [245, 245, 245] }
  });
  doc.save('notas-' + (D.semActual || 'semestre').replace(/\s+/g, '-') + '.pdf');
}

// ---- SECCIÓN SEMESTRES ----
function renderSemestres() {
  var sems  = Object.keys(D.semestres);
  var empty = document.getElementById('sems-empty');
  var cont  = document.getElementById('sems-cont');
  if (!sems.length) {
    empty.style.display = 'flex';
    cont.classList.add('oculto');
    return;
  }
  empty.style.display = 'none';
  cont.classList.remove('oculto');
  document.getElementById('sems-items').innerHTML = sems.map(function(s, idx) {
    var m    = getMats(s);
    var p    = m.length ? m.reduce(function(a, x) { return a + x.nota; }, 0) / m.length : NaN;
    var isAct = s === D.semActual;
    return '<div class="sem-item">' +
      '<div>' +
        '<div style="font-size:14px;font-weight:500;color:#e0e0e0">' + s +
          (isAct ? ' <span class="badge badge-activo">activo</span>' : '') + '</div>' +
        '<div style="font-size:12px;color:#555">' + m.length + ' materias · Promedio: ' + (isFinite(p) ? p.toFixed(1) : '—') + '</div>' +
      '</div>' +
      '<div style="display:flex;gap:6px;align-items:center">' +
        '<button class="btn" style="padding:5px 12px;font-size:12px;background:#1a3a5c;color:#7ec8f7;border-color:#1e5080" onclick="doViewSem(' + idx + ')" aria-label="Ver">👁 Ver</button>' +
        (!isAct ? '<button class="btn" style="padding:5px 12px;font-size:12px" onclick="doActivar(' + idx + ')">Activar</button>' : '') +
        '<button class="btn btn-danger" style="padding:5px 12px;font-size:12px" onclick="doDelSem(' + idx + ')" aria-label="Eliminar">🗑</button>' +
      '</div></div>';
  }).join('');
}

// Muestra el detalle de un semestre en la misma página
function doViewSem(idx) {
  var s = Object.keys(D.semestres)[idx];
  var m = getMats(s);
  document.getElementById('sem-det-ttl').textContent = s + ' — ' + m.length + ' materias';
  document.getElementById('sem-det-body').innerHTML = m.length ? m.map(function(x) {
    var c = nColor(x.nota);
    return '<div class="materia-item">' +
      '<div><div class="mat-nombre">' + x.nombre + '</div>' +
      '<div class="mat-detalle">' + x.parciales.map(function(p, i) { return 'P' + (i + 1) + ': ' + p; }).join(' · ') + ' · EF: ' + x.ef + '</div></div>' +
      '<span class="nota-pill" style="background:' + c + '22;color:' + c + '">' + x.nota.toFixed(1) + '</span>' +
      '</div>';
  }).join('') : '<div class="vacio">Sin materias.</div>';
  document.getElementById('sem-det').classList.remove('oculto');
}

function closeDet() { document.getElementById('sem-det').classList.add('oculto'); }

// Cambia el semestre activo
function doActivar(idx) {
  var s = Object.keys(D.semestres)[idx];
  D.semActual = s;
  save();
  renderSemestres();
  renderInicio();
}

// Elimina un semestre completo
function doDelSem(idx) {
  var sems = Object.keys(D.semestres);
  var s    = sems[idx];
  if (!confirm('¿Eliminás el semestre "' + s + '" y todas sus materias?')) return;
  delete D.semestres[s];
  if (D.semActual === s) D.semActual = Object.keys(D.semestres)[0] || '';
  save();
  renderSemestres();
  renderInicio();
}

// ---- INICIALIZACIÓN ----
renderCP();
renderCAP();
renderInicio();
