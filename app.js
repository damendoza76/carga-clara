(() => {
  'use strict';
  const KEY = 'carga-clara.v1';
  const Domain = window.CargaClaraDomain;
  const state = load();
  let view = 'hoy';
  let toastTimer;
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const uid = () => crypto.randomUUID ? crypto.randomUUID() : `id-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const safe = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  function load() {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY));
      if (saved && Array.isArray(saved.people) && Array.isArray(saved.sessions)) {
        return { version: 2, people: saved.people, sessions: saved.sessions.map(Domain.migrateLegacySession) };
      }
    } catch {}
    return { version: 2, people: [], sessions: [] };
  }
  function save() { localStorage.setItem(KEY, JSON.stringify(state)); }
  function fmt(value) { return Math.round(Number(value) || 0).toLocaleString('es-CO'); }
  function fmtRpe(value) { return Number(value).toLocaleString('es-CO', { maximumFractionDigits: 1 }); }
  function dateLabel(value) {
    if (!value) return '';
    return new Date(`${value}T12:00:00`).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
  }
  function todayISO() {
    const now = new Date();
    return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  }
  function personName(id) { return state.people.find(person => person.id === id)?.name || 'Persona eliminada'; }
  function closed() { return state.sessions.filter(session => session.status === 'closed'); }
  function pending() { return state.sessions.filter(session => session.status === 'pending').sort((a, b) => a.date.localeCompare(b.date)); }
  function matchingHistory(personId, type) {
    return closed().filter(session => session.personId === personId && session.type.toLowerCase() === type.toLowerCase())
      .sort((a, b) => (a.closedAt || a.createdAt).localeCompare(b.closedAt || b.createdAt));
  }
  function notify(message) {
    const element = $('#toast'); element.textContent = message; element.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => element.classList.remove('show'), 2600);
  }
  function setView(next) {
    view = next;
    $$('.nav-item').forEach(button => button.classList.toggle('active', button.dataset.view === view));
    render(); window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function sessionCard(session, canClose = false) {
    const isClosed = session.status === 'closed';
    const person = personName(session.personId);
    const migrationNote = session.migratedFromRange ? '<div class="help">Pronóstico anterior convertido al punto medio de su rango para conservar el historial.</div>' : '';
    const outcome = isClosed ? `<div class="actual-result"><span>Real: <b>${fmt(session.actualLoad)} u</b> · RPE ${fmtRpe(session.actualRpe)}/10 × ${session.actualMinutes} min</span><span class="error-pill">Error ${fmt(Domain.absoluteError(session.predictedLoad, session.actualLoad))} u</span></div>` : '';
    const resultForm = !isClosed && canClose ? `<form class="result-form" data-close="${safe(session.id)}">
      <div class="field"><label>RPE reportado</label><div class="input-suffix"><input class="control" name="rpe" type="number" min="0" max="10" step="0.5" placeholder="0 a 10" required><span class="suffix">/10</span></div></div>
      <div class="field"><label>Duración real</label><div class="input-suffix"><input class="control" name="minutes" type="number" min="1" max="600" placeholder="minutos" required><span class="suffix">min</span></div></div>
      <button class="button primary" type="submit">Guardar resultado</button>
    </form>` : '';
    return `<article class="session-card" data-session="${safe(session.id)}">
      <div class="session-top"><div><div class="session-title">${safe(session.type)}</div><div class="session-sub">${safe(person)} · ${dateLabel(session.date)} · ${session.plannedMinutes} min previstos</div></div><span class="tag ${isClosed ? 'green' : ''}">${isClosed ? 'Cerrada' : 'Pendiente'}</span></div>
      <div><span class="muted small">Carga pronosticada</span><div class="forecast-range">${fmt(session.predictedLoad)} <span class="muted small">unidades</span></div><span class="help">RPE ${fmtRpe(session.predictedRpe)}/10 × ${session.plannedMinutes} min</span>${migrationNote}</div>
      ${outcome}${resultForm}
    </article>`;
  }

  function home() {
    const open = pending(), done = closed();
    const meanError = Domain.meanAbsoluteError(done);
    const due = open.filter(session => session.date <= todayISO());
    return `<section class="hero"><div class="eyebrow">Predice antes · compara después</div><h1>Tu criterio también se entrena.</h1><p>Pronostica un RPE para la sesión. Después multiplícalo por los minutos previstos y compáralo con el RPE que reporta el deportista y la duración real.</p><div class="hero-actions"><button class="button primary" data-go="anotar">＋ Anotar pronóstico</button><button class="button secondary" data-go="metricas">Ver cómo vas</button></div></section>
      <div class="grid three"><article class="card stat-card"><div class="stat">${open.length}</div><div class="stat-label">pronósticos por cerrar</div></article><article class="card stat-card"><div class="stat">${done.length}</div><div class="stat-label">sesiones registradas</div></article><article class="card stat-card"><div class="stat">${meanError === null ? '—' : fmt(meanError)}</div><div class="stat-label">error medio de carga · unidades</div></article></div>
      ${due.length ? `<div class="section"><div class="notice"><b>Ya puedes cerrar ${due.length === 1 ? 'un pronóstico' : 'algunos pronósticos'}.</b> Registra el RPE que reporta la persona y la duración real para comparar las dos cargas.</div></div>` : ''}
      <section class="section"><div class="section-title"><h2>Por cerrar</h2><button class="text-button" data-go="historial">Ver todo</button></div>${open.length ? `<div class="pending-list">${open.slice(0, 3).map(session => sessionCard(session, true)).join('')}</div>` : `<div class="empty"><strong>Tu bitácora está lista.</strong>Anota un RPE antes de la próxima sesión. Cuando tengas el dato real, vuelves y lo comparas.</div>`}</section>
      <p class="footer-note">Carga de sesión = RPE reportado × minutos. Es una forma práctica de registrar carga interna; no predice lesiones.</p>`;
  }

  function athleteOptions(selected = '') {
    return state.people.map(person => `<option value="${safe(person.id)}" ${selected === person.id ? 'selected' : ''}>${safe(person.name)}</option>`).join('');
  }
  function makeSuggestion(personId, type, minutes) {
    const history = matchingHistory(personId, type).slice(-5);
    const estimate = Domain.suggestLoad(history.map(session => Number(session.actualLoad)));
    if (!estimate) return null;
    return { ...estimate, rpe: Domain.loadToRpe(estimate.load, minutes) };
  }
  function forecast() {
    const noPeople = state.people.length === 0;
    return `<div class="eyebrow">Antes de entrenar</div><h1>Anota el RPE que esperas.</h1><p class="lede">El pronóstico queda guardado antes de la sesión. Después registrarás el RPE que informe la persona y los minutos reales.</p>
      ${noPeople ? '<div class="notice" style="margin-bottom:15px">Primero crea una ficha para el deportista, alumno o grupo. Cada historial se mantiene separado por persona y tipo de sesión.</div>' : ''}
      <section class="card form-card"><form id="forecastForm">
        <div class="field"><label for="person">Deportista, alumno o grupo</label><div class="row"><select class="control" id="person" name="person" ${noPeople ? 'disabled' : ''} required>${noPeople ? '<option value="">Crea una ficha primero</option>' : athleteOptions()}</select><button type="button" class="button secondary" id="addPerson">＋ Crear ficha</button></div></div>
        <div class="field"><label for="type">Tipo de sesión</label><input class="control" id="type" name="type" placeholder="Fuerza, pista, clase…" maxlength="48" list="commonTypes" required><datalist id="commonTypes"><option value="Fuerza"><option value="Pista"><option value="Partido"><option value="Clase"><option value="Gimnasio"></datalist><span class="help">Usa el mismo nombre para comparar sesiones parecidas.</span></div>
        <div class="field"><label for="rpePrediction">RPE único que esperas (0–10)</label><div class="input-suffix"><input class="control" name="rpePrediction" id="rpePrediction" type="number" min="0" max="10" step="0.5" placeholder="por ejemplo, 6" required><span class="suffix">/10</span></div><span class="help">Una sola estimación de esfuerzo percibido al terminar.</span></div>
        <div class="field"><label for="plannedMinutes">Duración que esperas</label><div class="input-suffix"><input class="control" name="plannedMinutes" id="plannedMinutes" type="number" min="1" max="600" placeholder="minutos" required><span class="suffix">minutos</span></div></div>
        <div id="suggestionBox"></div>
        <div class="computed"><div><small>Carga pronosticada · RPE × minutos</small><strong id="loadOutput">—</strong></div><span class="tag">unidades</span></div>
        <div class="field"><label for="date">¿Cuándo será la sesión?</label><input class="control" type="date" id="date" name="date" value="${todayISO()}" required></div>
        <button class="button primary" type="submit" ${noPeople ? 'disabled' : ''}>Guardar antes de la sesión</button>
        <p class="help">El resultado se registra después, cuando cierre la sesión.</p>
      </form></section>`;
  }

  function historyView() {
    const list = [...state.sessions].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return `<div class="eyebrow">Tu bitácora</div><h1>Sesiones y pronósticos.</h1><p class="lede">Conserva el RPE que anticipaste y compáralo con la carga real de la sesión.</p>
      <div class="filters"><select class="control" id="historyPerson"><option value="">Todas las personas</option>${athleteOptions()}</select><select class="control" id="historyType"><option value="">Todos los tipos</option>${[...new Set(state.sessions.map(session => session.type))].map(type => `<option>${safe(type)}</option>`).join('')}</select><select class="control" id="historyState"><option value="">Todos</option><option value="pending">Por cerrar</option><option value="closed">Cerradas</option></select></div>
      <div class="list" id="historyList">${list.length ? list.map(session => sessionCard(session, true)).join('') : '<div class="empty"><strong>Aún no hay sesiones.</strong>Al guardar el primer pronóstico, aparecerá aquí.</div>'}</div>
      <section class="section card"><div class="section-title"><h2>Personas</h2><button class="button secondary" id="managePeople">Gestionar</button></div><p class="small muted">Cada persona conserva su historial por tipo de sesión.</p><div id="peopleList"></div></section>`;
  }

  function metricView() {
    const sessions = closed().sort((a, b) => (a.closedAt || a.createdAt).localeCompare(b.closedAt || b.createdAt));
    const recent = sessions.slice(-12);
    const meanError = Domain.meanAbsoluteError(sessions);
    const maxLoad = Math.max(1, ...recent.map(session => Number(session.predictedLoad) || 0), ...recent.map(session => Number(session.actualLoad) || 0));
    const xAt = index => recent.length < 2 ? 170 : 35 + index * (275 / (recent.length - 1));
    const yAt = value => 180 - (Number(value) / maxLoad) * 145;
    const predictedPoints = recent.map((session, index) => `${xAt(index)},${yAt(session.predictedLoad)}`).join(' ');
    const actualPoints = recent.map((session, index) => `${xAt(index)},${yAt(session.actualLoad)}`).join(' ');
    const chart = recent.length ? `<div class="chart-wrap"><svg viewBox="0 0 330 220" role="img" aria-label="Gráfica de carga pronosticada y real en las últimas sesiones">
        <line class="chart-grid" x1="30" y1="35" x2="315" y2="35"/><line class="chart-grid" x1="30" y1="108" x2="315" y2="108"/><line class="chart-grid" x1="30" y1="180" x2="315" y2="180"/>
        <text class="chart-label" x="0" y="39">${fmt(maxLoad)}</text><text class="chart-label" x="0" y="112">${fmt(maxLoad / 2)}</text><text class="chart-label" x="0" y="184">0</text>
        ${recent.length > 1 ? `<polyline class="chart-line" points="${predictedPoints}"/><polyline class="chart-actual-line" points="${actualPoints}"/>` : ''}
        ${recent.map((session, index) => `<circle class="chart-dot forecast-dot" cx="${xAt(index)}" cy="${yAt(session.predictedLoad)}" r="5"><title>${dateLabel(session.date)} · pronóstico ${fmt(session.predictedLoad)} unidades</title></circle><circle class="chart-dot actual-dot" cx="${xAt(index)}" cy="${yAt(session.actualLoad)}" r="5"><title>${dateLabel(session.date)} · real ${fmt(session.actualLoad)} unidades</title></circle>`).join('')}
        ${recent.length > 1 ? `<text class="chart-label" x="35" y="210">${dateLabel(recent[0].date)}</text><text class="chart-label" x="275" y="210">${dateLabel(recent[recent.length - 1].date)}</text>` : `<text class="chart-label" x="145" y="210">${dateLabel(recent[0].date)}</text>`}
      </svg></div><div class="legend"><span><i></i>Carga pronosticada</span><span><i class="actual"></i>Carga real</span></div><p class="help">Cada punto usa RPE × minutos; cuanto más cerca estén los puntos de cada sesión, menor fue la diferencia entre pronóstico y resultado.</p>` : '<div class="empty"><strong>La gráfica empieza con tu primera sesión cerrada.</strong>Registra el RPE y los minutos reales para comparar las dos cargas.</div>';
    const byPerson = state.people.map(person => ({ person, sessions: sessions.filter(session => session.personId === person.id) })).filter(item => item.sessions.length);
    const largestPersonError = Math.max(1, ...byPerson.map(item => Domain.meanAbsoluteError(item.sessions) || 0));
    return `<div class="eyebrow">Aprende de tus datos</div><h1>Pronóstico y resultado, cara a cara.</h1><p class="lede">La diferencia media muestra cuántas unidades separan tus cargas pronosticadas de las reales. Menos diferencia significa pronósticos más cercanos en tu historial.</p>
      <div class="grid two"><article class="card"><div class="eyebrow">Error medio de carga</div><div class="metric-number">${meanError === null ? '—' : fmt(meanError)}</div><div class="metric-caption">unidades RPE × minutos · ${sessions.length} sesiones</div></article><article class="card"><div class="eyebrow">Pronósticos cerrados</div><div class="metric-number">${sessions.length}</div><div class="metric-caption">${state.sessions.filter(session => session.status === 'pending').length} todavía por cerrar</div></article></div>
      <section class="section card"><div class="section-title"><h2>Carga pronosticada y real</h2><span class="tag green">últimas 12</span></div>${chart}</section>
      <section class="section card"><div class="section-title"><h2>Error medio por persona</h2></div>${byPerson.length ? byPerson.map(item => { const error = Domain.meanAbsoluteError(item.sessions) || 0; const width = Math.max(error === 0 ? 2 : 4, error / largestPersonError * 100); return `<div class="bar-row"><span>${safe(item.person.name)}</span><div class="bar-bg"><span class="error-bar" style="width:${width}%"></span></div><b class="mono">${fmt(error)} u</b></div><div class="help">${item.sessions.length} sesiones · ${[...new Set(item.sessions.map(session => session.type))].map(safe).join(', ')}</div>`; }).join('') : '<div class="empty"><strong>Cuando cierres sesiones, verás el resumen por persona.</strong>El historial se separa por tipo de sesión para comparar cargas parecidas.</div>'}</section>
      <div class="notice"><b>Cómo se sugiere el próximo RPE:</b> para la misma persona y tipo de sesión, con dos o más registros cerrados, la app propone la carga real media de hasta las últimas cinco sesiones y la divide por los minutos previstos. Es una referencia descriptiva; tú decides si la usas.</div>`;
  }

  function settingsView() {
    return `<div class="eyebrow">Tus datos</div><h1>Ajustes y respaldos.</h1><p class="lede">La información se guarda en este navegador y dispositivo. No se envía a un servidor ni se sincroniza automáticamente.</p>
      <section class="card section"><div class="section-title"><h2>Personas</h2><button class="button primary" id="addPerson">＋ Crear ficha</button></div><p class="small muted">Elimina fichas solo si también quieres quitar sus sesiones asociadas.</p><div id="peopleList"></div></section>
      <section class="card section"><h2>Resultados CSV</h2><p class="small muted">Descarga o carga fichas y sesiones en formato CSV. La importación agrega registros y omite los que ya existen.</p><button class="button secondary" id="exportCsv">Descargar resultados CSV</button><label class="button secondary" for="importCsv" style="display:inline-flex;margin-left:6px">Cargar CSV</label><input id="importCsv" type="file" accept=".csv,text/csv" hidden><span id="csvStatus" class="help"></span></section>
      <section class="card section"><h2>Respaldo completo JSON</h2><p class="small muted">Usa JSON para guardar una copia íntegra del estado de la app.</p><button class="button secondary" id="exportJson">Descargar respaldo JSON</button><label class="button secondary" for="importJson" style="display:inline-flex;margin-left:6px">Importar JSON</label><input id="importJson" type="file" accept="application/json,.json" hidden><span id="jsonStatus" class="help"></span></section>
      <section class="card section"><h2>Borrar toda la bitácora</h2><p class="small muted">Esta acción elimina fichas y sesiones de este dispositivo.</p><button class="button danger" id="clearData">Borrar datos</button></section>
      <p class="footer-note">RPE de sesión (Foster): al terminar, el deportista reporta un esfuerzo de 0 a 10; se multiplica por la duración en minutos. Esta carga interna percibida no predice lesiones.</p>`;
  }

  function render() {
    const main = $('#mainContent');
    main.innerHTML = view === 'hoy' ? home() : view === 'anotar' ? forecast() : view === 'historial' ? historyView() : view === 'metricas' ? metricView() : settingsView();
    bindCommon();
    if (view === 'anotar') bindForecast();
    if (view === 'historial') { renderPeople(); bindFilters(); $('#managePeople')?.addEventListener('click', () => setView('ajustes')); }
    if (view === 'ajustes') { renderPeople(); bindSettings(); }
  }
  function bindCommon() {
    $$('[data-go]').forEach(button => button.addEventListener('click', () => setView(button.dataset.go)));
    $$('[data-close]').forEach(form => form.addEventListener('submit', event => { event.preventDefault(); closeSession(form.dataset.close, new FormData(form)); }));
  }
  function closeSession(id, form) {
    const session = state.sessions.find(item => item.id === id);
    if (!session || session.status === 'closed') return;
    const rpe = Number(form.get('rpe')), minutes = Number(form.get('minutes'));
    if (!Number.isFinite(rpe) || rpe < 0 || rpe > 10 || !Number.isFinite(minutes) || minutes < 1) { notify('Revisa el RPE y los minutos.'); return; }
    session.status = 'closed'; session.actualRpe = rpe; session.actualMinutes = minutes;
    session.actualLoad = Domain.calculateLoad(rpe, minutes); session.closedAt = new Date().toISOString();
    save(); render(); notify('Resultado guardado para comparar las dos cargas.');
  }

  function bindForecast() {
    const form = $('#forecastForm');
    const update = () => {
      const rpe = Number($('#rpePrediction').value), minutes = Number($('#plannedMinutes').value);
      const valid = $('#rpePrediction').value !== '' && $('#plannedMinutes').value !== '' && rpe >= 0 && rpe <= 10 && minutes > 0;
      $('#loadOutput').textContent = valid ? fmt(Domain.calculateLoad(rpe, minutes)) : '—';
      const box = $('#suggestionBox'), type = $('#type').value.trim(), personId = $('#person').value;
      const suggestion = personId && type && minutes > 0 ? makeSuggestion(personId, type, minutes) : null;
      if (!suggestion) {
        const count = personId && type ? matchingHistory(personId, type).length : 0;
        box.innerHTML = count === 1 ? '<div class="suggestion">Hay una sesión cerrada de este tipo. Después de otra aparecerá una sugerencia de RPE basada en el promedio.</div>' : count === 0 && personId && type ? '<div class="suggestion">Todavía no hay sesiones comparables. Registra el primer pronóstico para crear tu punto de partida.</div>' : '';
        return;
      }
      const unusable = suggestion.rpe > 10;
      box.innerHTML = `<div class="suggestion"><b>Promedio de las últimas ${suggestion.count} sesiones:</b> ${fmt(suggestion.load)} unidades; equivale a RPE ${fmtRpe(suggestion.rpe)} para ${minutes} min.${unusable ? ' Aumenta los minutos previstos para que la sugerencia corresponda a la escala RPE 0–10.' : ''}<button type="button" id="applySuggestion" ${unusable ? 'disabled' : ''}>Usar este RPE</button></div>`;
      if (!unusable) $('#applySuggestion').addEventListener('click', () => { $('#rpePrediction').value = Math.round(suggestion.rpe * 2) / 2; update(); });
    };
    ['input', 'change'].forEach(eventName => ['#rpePrediction', '#plannedMinutes', '#person', '#type'].forEach(selector => $(selector)?.addEventListener(eventName, update)));
    update();
    $('#addPerson').addEventListener('click', addPerson);
    form.addEventListener('submit', event => {
      event.preventDefault();
      const data = new FormData(form), rpe = Number(data.get('rpePrediction')), minutes = Number(data.get('plannedMinutes'));
      if (!Number.isFinite(rpe) || rpe < 0 || rpe > 10 || !Number.isFinite(minutes) || minutes < 1) { notify('Revisa el RPE y los minutos previstos.'); return; }
      state.sessions.push({ id: uid(), personId: data.get('person'), type: String(data.get('type')).trim(), predictedRpe: rpe, plannedMinutes: minutes, predictedLoad: Domain.calculateLoad(rpe, minutes), date: data.get('date'), createdAt: new Date().toISOString(), status: 'pending' });
      save(); view = 'hoy'; $$('.nav-item').forEach(button => button.classList.toggle('active', button.dataset.view === view)); render(); notify('Pronóstico guardado antes de la sesión.');
    });
  }

  function addPerson() {
    const name = prompt('Nombre de la persona, deportista o grupo:');
    if (!name?.trim()) return;
    state.people.push({ id: uid(), name: name.trim(), createdAt: new Date().toISOString() }); save(); render(); notify('Ficha creada.');
  }
  function renderPeople() {
    const box = $('#peopleList'); if (!box) return;
    box.innerHTML = state.people.length ? state.people.map(person => {
      const count = state.sessions.filter(session => session.personId === person.id).length;
      return `<div class="person-row"><div class="person-meta"><span class="person-avatar">${safe(person.name.slice(0, 1).toUpperCase())}</span><span><strong>${safe(person.name)}</strong><small>${count} ${count === 1 ? 'sesión' : 'sesiones'}</small></span></div><div class="person-actions"><button class="text-button" data-rename="${safe(person.id)}">Renombrar</button><button class="text-button delete" data-delete="${safe(person.id)}">Eliminar</button></div></div>`;
    }).join('') : '<div class="empty"><strong>No hay fichas creadas.</strong>Agrega una persona para empezar a registrar sesiones.</div>';
    $$('[data-rename]', box).forEach(button => button.addEventListener('click', () => {
      const person = state.people.find(item => item.id === button.dataset.rename), name = prompt('Cambiar nombre:', person.name);
      if (name?.trim()) { person.name = name.trim(); save(); render(); }
    }));
    $$('[data-delete]', box).forEach(button => button.addEventListener('click', () => {
      const person = state.people.find(item => item.id === button.dataset.delete);
      if (confirm(`¿Eliminar ${person.name} y todas sus sesiones?`)) { state.people = state.people.filter(item => item.id !== person.id); state.sessions = state.sessions.filter(session => session.personId !== person.id); save(); render(); notify('Ficha eliminada.'); }
    }));
  }
  function bindFilters() {
    const apply = () => {
      const person = $('#historyPerson').value, type = $('#historyType').value, status = $('#historyState').value;
      const list = [...state.sessions].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).filter(session => (!person || session.personId === person) && (!type || session.type === type) && (!status || session.status === status));
      $('#historyList').innerHTML = list.length ? list.map(session => sessionCard(session, true)).join('') : '<div class="empty">No hay sesiones con estos filtros.</div>';
      bindCommon();
    };
    ['historyPerson', 'historyType', 'historyState'].forEach(id => $('#' + id).addEventListener('change', apply));
  }

  function csvText(value) { return String(value ?? '').replace(/^'(?=[=+@\-])/, ''); }
  function csvNumber(value) {
    const text = String(value ?? '').trim();
    return Number(text.includes(',') && !text.includes('.') ? text.replace(',', '.') : text);
  }
  function exportCsv() {
    const records = state.sessions.map(session => ({
      id: session.id, persona_id: session.personId, persona: personName(session.personId), tipo_sesion: session.type, fecha_sesion: session.date,
      rpe_pronosticado: session.predictedRpe, minutos_previstos: session.plannedMinutes, carga_pronosticada: session.predictedLoad,
      estado: session.status === 'closed' ? 'cerrada' : 'pendiente', rpe_reportado: session.actualRpe ?? '', minutos_reales: session.actualMinutes ?? '',
      carga_real: session.actualLoad ?? '', creado_en: session.createdAt, cerrado_en: session.closedAt ?? ''
    }));
    const blob = new Blob(['\uFEFF', Domain.stringifyCsv(records)], { type: 'text/csv;charset=utf-8' });
    const link = document.createElement('a'), objectUrl = URL.createObjectURL(blob); link.href = objectUrl; link.download = `carga-clara-resultados-${todayISO()}.csv`; link.click(); setTimeout(() => URL.revokeObjectURL(objectUrl), 1000); notify('Resultados CSV descargados.');
  }
  async function importCsv(file) {
    const status = $('#csvStatus');
    try {
      const rows = Domain.parseCsv(await file.text());
      const required = ['persona', 'tipo_sesion', 'fecha_sesion', 'rpe_pronosticado', 'minutos_previstos'];
      if (required.some(key => !Object.hasOwn(rows[0], key))) throw new Error('Este CSV no tiene las columnas de Carga Clara.');
      const existingIds = new Set(state.sessions.map(session => session.id));
      const peopleByName = new Map(state.people.map(person => [person.name.trim().toLocaleLowerCase(), person]));
      const importedPeople = new Map(state.people.map(person => [person.id, person]));
      let added = 0, duplicates = 0, skipped = 0;
      for (const row of rows) {
        const name = csvText(row.persona).trim(), type = csvText(row.tipo_sesion).trim(), date = row.fecha_sesion.trim();
        if (!name || !type || !/^\d{4}-\d{2}-\d{2}$/.test(date) || String(row.rpe_pronosticado ?? '').trim() === '' || String(row.minutos_previstos ?? '').trim() === '') { skipped++; continue; }
        const rpe = csvNumber(row.rpe_pronosticado), plannedMinutes = csvNumber(row.minutos_previstos);
        if (!Number.isFinite(rpe) || rpe < 0 || rpe > 10 || !Number.isFinite(plannedMinutes) || plannedMinutes < 1) { skipped++; continue; }
        const id = csvText(row.id).trim() || uid();
        if (existingIds.has(id)) { duplicates++; continue; }
        const statusText = String(row.estado || 'pendiente').trim().toLocaleLowerCase();
        const isClosed = ['closed', 'cerrada', 'cerrado'].includes(statusText);
        let actualRpe, actualMinutes, actualLoad;
        if (isClosed) {
          if (String(row.rpe_reportado ?? '').trim() === '' || String(row.minutos_reales ?? '').trim() === '') { skipped++; continue; }
          actualRpe = csvNumber(row.rpe_reportado); actualMinutes = csvNumber(row.minutos_reales);
          if (!Number.isFinite(actualRpe) || actualRpe < 0 || actualRpe > 10 || !Number.isFinite(actualMinutes) || actualMinutes < 1) { skipped++; continue; }
          actualLoad = String(row.carga_real ?? '').trim() === '' ? Domain.calculateLoad(actualRpe, actualMinutes) : csvNumber(row.carga_real);
          if (!Number.isFinite(actualLoad)) { skipped++; continue; }
        }
        const predictedLoad = String(row.carga_pronosticada ?? '').trim() === '' ? Domain.calculateLoad(rpe, plannedMinutes) : csvNumber(row.carga_pronosticada);
        if (!Number.isFinite(predictedLoad)) { skipped++; continue; }
        const importedId = csvText(row.persona_id).trim();
        let person = importedId ? importedPeople.get(importedId) : null;
        if (person && person.name.trim().toLocaleLowerCase() !== name.toLocaleLowerCase()) person = peopleByName.get(name.toLocaleLowerCase());
        if (!person) person = peopleByName.get(name.toLocaleLowerCase());
        if (!person) {
          person = { id: importedId && !importedPeople.has(importedId) ? importedId : uid(), name, createdAt: row.creado_en || new Date().toISOString() };
          state.people.push(person); importedPeople.set(person.id, person); peopleByName.set(name.toLocaleLowerCase(), person);
        }
        const session = { id, personId: person.id, type, date, predictedRpe: rpe, plannedMinutes, predictedLoad, createdAt: row.creado_en || new Date().toISOString(), status: isClosed ? 'closed' : 'pending' };
        if (isClosed) {
          session.actualRpe = actualRpe; session.actualMinutes = actualMinutes;
          session.actualLoad = actualLoad;
          session.closedAt = row.cerrado_en || session.createdAt;
        }
        state.sessions.push(session); existingIds.add(id); added++;
      }
      save(); render(); notify(`CSV cargado: ${added} sesiones nuevas, ${duplicates} duplicadas${skipped ? ` y ${skipped} filas omitidas` : ''}.`);
    } catch (error) {
      status.textContent = error instanceof SyntaxError ? 'No se pudo leer el CSV. Verifica que esté completo y use comas o punto y coma como separador.' : error.message;
    }
  }

  function bindSettings() {
    $('#addPerson').addEventListener('click', addPerson);
    $('#exportCsv').addEventListener('click', exportCsv);
    $('#importCsv').addEventListener('change', event => { const file = event.target.files[0]; if (file) importCsv(file); event.target.value = ''; });
    $('#exportJson').addEventListener('click', () => {
      const blob = new Blob([JSON.stringify({ ...state, exportedAt: new Date().toISOString() }, null, 2)], { type: 'application/json' });
      const link = document.createElement('a'), objectUrl = URL.createObjectURL(blob); link.href = objectUrl; link.download = `carga-clara-respaldo-${todayISO()}.json`; link.click(); setTimeout(() => URL.revokeObjectURL(objectUrl), 1000); notify('Respaldo JSON descargado.');
    });
    $('#importJson').addEventListener('change', async event => {
      const file = event.target.files[0]; if (!file) return;
      try {
        const data = JSON.parse(await file.text());
        if (!Array.isArray(data.people) || !Array.isArray(data.sessions)) throw new Error('Estructura inválida');
        if (!confirm('¿Reemplazar la bitácora de este dispositivo con el respaldo JSON?')) return;
        state.people = data.people; state.sessions = data.sessions.map(Domain.migrateLegacySession); save(); render(); notify('Respaldo JSON importado.');
      } catch { $('#jsonStatus').textContent = 'No se pudo leer el archivo. Selecciona un respaldo JSON de Carga Clara.'; }
      event.target.value = '';
    });
    $('#clearData').addEventListener('click', () => {
      if (confirm('¿Borrar todas las fichas y sesiones de este dispositivo? Esta acción no se puede deshacer.')) { state.people = []; state.sessions = []; save(); render(); notify('Bitácora borrada.'); }
    });
  }

  $$('.nav-item').forEach(button => button.addEventListener('click', () => setView(button.dataset.view)));
  $('#settingsShortcut').addEventListener('click', () => setView('ajustes'));
  render();
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('./service-worker.js').catch(() => {});
})();
