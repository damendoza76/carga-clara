(() => {
  'use strict';
  const KEY = 'carga-clara.v1';
  const state = load();
  let view = 'hoy';
  let toastTimer;
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const uid = () => crypto.randomUUID ? crypto.randomUUID() : `id-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const safe = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function load(){
    try { const v = JSON.parse(localStorage.getItem(KEY)); if(v && Array.isArray(v.people) && Array.isArray(v.sessions)) return v; } catch {}
    return {version:1, people:[], sessions:[]};
  }
  function save(){ localStorage.setItem(KEY, JSON.stringify(state)); }
  function fmt(n){ return Math.round(Number(n) || 0).toLocaleString('es-CO'); }
  function dateLabel(s){ if(!s) return ''; return new Date(`${s}T12:00:00`).toLocaleDateString('es-CO',{day:'numeric',month:'short'}); }
  function personName(id){ return state.people.find(p=>p.id===id)?.name || 'Persona eliminada'; }
  function closed(){ return state.sessions.filter(s=>s.status==='closed'); }
  function pending(){ return state.sessions.filter(s=>s.status==='pending').sort((a,b)=>a.date.localeCompare(b.date)); }
  function matchingHistory(personId,type){ return closed().filter(s=>s.personId===personId && s.type.toLowerCase()===type.toLowerCase()).sort((a,b)=>a.closedAt.localeCompare(b.closedAt)); }
  function notify(message){ const el=$('#toast');el.textContent=message;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),2400); }
  function setView(next){ view=next; $$('.nav-item').forEach(b=>b.classList.toggle('active',b.dataset.view===view)); render(); window.scrollTo({top:0,behavior:'smooth'}); }
  function sessionCard(s, canClose=false){
    const lo=Number(s.predictedLoadLow),hi=Number(s.predictedLoadHigh), ratio=Math.min(100,Math.max(3,hi/Math.max(1,hi)*100));
    const person=personName(s.personId); const result=s.status==='closed';
    return `<article class="session-card" data-session="${safe(s.id)}"><div class="session-top"><div><div class="session-title">${safe(s.type)}</div><div class="session-sub">${safe(person)} · ${dateLabel(s.date)} · ${s.plannedMinutes} min previstos</div></div><span class="tag ${result?(s.covered?'green':'red'):''}">${result?(s.covered?'Dentro del rango':'Fuera del rango'):'Pendiente'}</span></div><div><span class="muted small">Pronóstico de carga</span><div class="forecast-range">${fmt(lo)}–${fmt(hi)} <span class="muted small">unidades</span></div><div class="range-track" aria-label="Rango pronosticado"><span style="width:${ratio}%"></span></div><span class="help">RPE ${s.predictedRpeLow}–${s.predictedRpeHigh} × ${s.plannedMinutes} min</span></div>${result?`<div class="session-sub" style="margin-top:10px">Real: <b>${fmt(s.actualLoad)} unidades</b> · RPE ${s.actualRpe}/10 × ${s.actualMinutes} min</div>`:canClose?`<form class="result-form" data-close="${safe(s.id)}"><div class="field"><label>RPE reportado</label><div class="input-suffix"><input class="control" name="rpe" type="number" min="0" max="10" step="0.5" placeholder="0 a 10" required><span class="suffix">/10</span></div></div><div class="field"><label>Duración real</label><div class="input-suffix"><input class="control" name="minutes" type="number" min="1" max="600" placeholder="minutos" required><span class="suffix">min</span></div></div><button class="button primary" type="submit">Guardar resultado</button></form>`:''}</article>`;
  }
  function home(){
    const p=pending(), c=closed(), done=c.length?Math.round(c.filter(s=>s.covered).length/c.length*100):null;
    const due=p.filter(s=>s.date<=new Date().toISOString().slice(0,10));
    return `<section class="hero"><div class="eyebrow">Predice antes · compara después</div><h1>Tu criterio también se entrena.</h1><p>Anticipa la carga de la sesión. Luego compárala con el RPE que reporta el deportista y ajusta tu siguiente rango con su propio historial.</p><div class="hero-actions"><button class="button primary" data-go="anotar">＋ Anotar pronóstico</button><button class="button secondary" data-go="metricas">Ver cómo vas</button></div></section>
    <div class="grid three"><article class="card stat-card"><div class="stat">${p.length}</div><div class="stat-label">pronósticos por cerrar</div></article><article class="card stat-card"><div class="stat">${c.length}</div><div class="stat-label">sesiones registradas</div></article><article class="card stat-card"><div class="stat">${done===null?'—':done+'%'}</div><div class="stat-label">cargas dentro del rango</div></article></div>
    ${due.length?`<div class="section"><div class="notice"><b>Ya puedes cerrar ${due.length===1?'un pronóstico':'algunos pronósticos'}.</b> Registra el RPE que reporta el deportista y la duración real. Así empieza a mejorar tu referencia.</div></div>`:''}
    <section class="section"><div class="section-title"><h2>Por cerrar</h2><button class="text-button" data-go="historial">Ver todo</button></div>${p.length?`<div class="pending-list">${p.slice(0,3).map(s=>sessionCard(s,true)).join('')}</div>`:`<div class="empty"><strong>Tu bitácora está lista.</strong>Anota un rango antes de la próxima sesión. Cuando tengas el dato real, vuelves y lo comparas.</div>`}</section>
    <p class="footer-note">La carga de sesión se calcula como RPE reportado × minutos. Es una forma práctica de registrar carga interna; no es una predicción de lesiones.</p>`;
  }
  function athleteOptions(selected=''){ return state.people.map(p=>`<option value="${safe(p.id)}" ${selected===p.id?'selected':''}>${safe(p.name)}</option>`).join(''); }
  function makeSuggestion(personId,type,minutes){
    const history=matchingHistory(personId,type).slice(-5); if(history.length<2) return null;
    const values=history.map(s=>Number(s.actualLoad)); const mean=values.reduce((a,b)=>a+b,0)/values.length;
    const mad=values.reduce((a,b)=>a+Math.abs(b-mean),0)/values.length;
    const low=Math.max(0,mean-mad), high=mean+mad;
    return {low,high,rpeLow:Math.max(0,Math.min(10,low/minutes)),rpeHigh:Math.max(0,Math.min(10,high/minutes)),count:history.length};
  }
  function forecast(){
    const noPeople=state.people.length===0;
    const today=new Date().toISOString().slice(0,10);
    return `<div class="eyebrow">Antes de entrenar</div><h1>Anota el rango que esperas.</h1><p class="lede">El pronóstico queda guardado antes de la sesión. Después registrarás el RPE informado por la persona y los minutos reales.</p>
      ${noPeople?`<div class="notice" style="margin-bottom:15px">Primero crea una ficha para el deportista, alumno o grupo. Cada historial se mantiene separado por persona y tipo de sesión.</div>`:''}
      <section class="card form-card"><form id="forecastForm">
        <div class="field"><label for="person">Deportista, alumno o grupo</label><div class="row"><select class="control" id="person" name="person" ${noPeople?'disabled':''} required>${noPeople?'<option value="">Crea una ficha primero</option>':athleteOptions()}</select><button type="button" class="button secondary" id="addPerson">＋ Crear ficha</button></div></div>
        <div class="field"><label for="type">Tipo de sesión</label><input class="control" id="type" name="type" placeholder="Fuerza, pista, clase…" maxlength="48" list="commonTypes" required><datalist id="commonTypes"><option value="Fuerza"><option value="Pista"><option value="Partido"><option value="Clase"><option value="Gimnasio"></datalist><span class="help">Usa el mismo nombre para comparar sesiones parecidas.</span></div>
        <div class="field"><label>RPE que esperas (0–10)</label><div class="row"><div class="input-suffix"><input class="control" name="rpeLow" id="rpeLow" type="number" min="0" max="10" step="0.5" placeholder="mínimo" required><span class="suffix">desde</span></div><div class="input-suffix"><input class="control" name="rpeHigh" id="rpeHigh" type="number" min="0" max="10" step="0.5" placeholder="máximo" required><span class="suffix">hasta</span></div></div><span class="help">Este es el esfuerzo que esperas que la persona reporte al terminar.</span></div>
        <div class="field"><label for="plannedMinutes">Duración que esperas</label><div class="input-suffix"><input class="control" name="plannedMinutes" id="plannedMinutes" type="number" min="1" max="600" placeholder="minutos" required><span class="suffix">minutos</span></div></div>
        <div id="suggestionBox"></div>
        <div class="computed"><div><small>Rango de carga pronosticado · RPE × minutos</small><strong id="loadOutput">—</strong></div><span class="tag">unidades</span></div>
        <div class="field"><label for="date">¿Cuándo será la sesión?</label><input class="control" type="date" id="date" name="date" value="${today}" required></div>
        <button class="button primary" type="submit" ${noPeople?'disabled':''}>Guardar antes de la sesión</button>
        <p class="help">El resultado no se podrá registrar hasta que cierres este pronóstico.</p>
      </form></section>`;
  }
  function historyView(){
    const list=[...state.sessions].sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
    return `<div class="eyebrow">Tu bitácora</div><h1>Sesiones y pronósticos.</h1><p class="lede">Los rangos originales se conservan para que puedas compararlos con el resultado, incluso después de cerrar una sesión.</p>
    <div class="filters"><select class="control" id="historyPerson"><option value="">Todas las personas</option>${athleteOptions()}</select><select class="control" id="historyType"><option value="">Todos los tipos</option>${[...new Set(state.sessions.map(s=>s.type))].map(t=>`<option>${safe(t)}</option>`).join('')}</select><select class="control" id="historyState"><option value="">Todos</option><option value="pending">Por cerrar</option><option value="closed">Cerradas</option></select></div>
    <div class="list" id="historyList">${list.length?list.map(s=>sessionCard(s,true)).join(''):`<div class="empty"><strong>Aún no hay sesiones.</strong>Al guardar el primer rango, aparecerá aquí.</div>`}</div>
    <section class="section card"><div class="section-title"><h2>Personas</h2><button class="button secondary" id="managePeople">Gestionar</button></div><p class="small muted">Crea fichas para deportistas, alumnos o grupos. Cada uno conserva su propio historial por tipo de sesión.</p><div id="peopleList"></div></section>`;
  }
  function metricView(){
    const c=closed().sort((a,b)=>a.closedAt.localeCompare(b.closedAt));
    const covered=c.filter(s=>s.covered).length, rate=c.length?Math.round(covered/c.length*100):null;
    const recent=c.slice(-12); const vals=recent.map(s=>Number(s.actualLoad)); const max=Math.max(1,...recent.map(s=>Number(s.predictedLoadHigh)),...vals);
    const points=vals.map((v,i)=>`${28+(recent.length<2?0:i* (280/(recent.length-1)))},${177-v/max*145}`).join(' ');
    const chart=recent.length?`<div class="chart-wrap"><svg viewBox="0 0 330 205" role="img" aria-label="Gráfica de carga real de las últimas sesiones"><line class="chart-grid" x1="25" y1="30" x2="315" y2="30"/><line class="chart-grid" x1="25" y1="100" x2="315" y2="100"/><line class="chart-grid" x1="25" y1="177" x2="315" y2="177"/><text class="chart-label" x="0" y="34">alta</text><text class="chart-label" x="0" y="181">0</text>${recent.length>1?`<polyline class="chart-line" points="${points}"/>`:''}${recent.map((s,i)=>{const x=28+(recent.length<2?0:i*(280/(recent.length-1))),y=177-Number(s.actualLoad)/max*145;return `<circle class="chart-dot" cx="${x}" cy="${y}" r="5"><title>${dateLabel(s.date)}: ${fmt(s.actualLoad)} unidades</title></circle>`}).join('')}</svg></div><div class="legend"><span><i class="actual"></i>Carga real reportada</span></div><p class="help">Cada punto es una sesión cerrada. La gráfica ayuda a observar tu historial; no anticipa lesiones.</p>`:`<div class="empty"><strong>La gráfica empieza con tu primera sesión cerrada.</strong>Registra el RPE y los minutos reales para ver cómo cambia la carga.</div>`;
    const recentByPerson=state.people.map(p=>({person:p,sessions:c.filter(s=>s.personId===p.id)})).filter(x=>x.sessions.length);
    return `<div class="eyebrow">Aprende de tus datos</div><h1>Un rango más afinado, sesión a sesión.</h1><p class="lede">Compara el intervalo que pronosticaste con la carga que ocurrió. El porcentaje muestra cuántas sesiones quedaron dentro del rango.</p>
      <div class="grid two"><article class="card"><div class="eyebrow">Dentro del rango</div><div class="metric-number">${rate===null?'—':rate+'%'}</div><div class="metric-caption">${covered} de ${c.length} sesiones${c.length?' quedaron dentro del rango.':' cerradas.'}</div></article><article class="card"><div class="eyebrow">Pronósticos cerrados</div><div class="metric-number">${c.length}</div><div class="metric-caption">${state.sessions.filter(s=>s.status==='pending').length} todavía por cerrar</div></article></div>
      <section class="section card"><div class="section-title"><h2>Tu carga de sesión</h2><span class="tag green">últimas 12</span></div>${chart}</section>
      <section class="section card"><div class="section-title"><h2>Por persona</h2></div>${recentByPerson.length?recentByPerson.map(x=>{const ok=x.sessions.filter(s=>s.covered).length;const pct=Math.round(ok/x.sessions.length*100);return `<div class="bar-row"><span>${safe(x.person.name)}</span><div class="bar-bg"><span class="actual-bar" style="width:${pct}%"></span></div><b class="mono">${pct}%</b></div><div class="help">${ok} de ${x.sessions.length} dentro del rango · ${[...new Set(x.sessions.map(s=>s.type))].map(safe).join(', ')}</div>`}).join(''):`<div class="empty"><strong>Cuando haya sesiones cerradas, verás el resumen por persona.</strong>El historial se separa por tipo de sesión para comparar cargas parecidas.</div>`}</section>
      <div class="notice"><b>Cómo se sugiere el siguiente rango:</b> para la misma persona y el mismo tipo de sesión, después de dos registros cerrados, la app usa la media de carga real ± la desviación absoluta media de las últimas cinco sesiones. Es una referencia descriptiva, no una recomendación automática ni un indicador de riesgo.</div>`;
  }
  function settingsView(){
    return `<div class="eyebrow">Tus datos</div><h1>Ajustes y respaldo.</h1><p class="lede">La información se guarda en este navegador y dispositivo. No se envía a un servidor ni se sincroniza automáticamente.</p>
    <section class="card section"><div class="section-title"><h2>Personas</h2><button class="button primary" id="addPerson">＋ Crear ficha</button></div><p class="small muted">Elimina fichas solo si quieres quitar también sus sesiones asociadas.</p><div id="peopleList"></div></section>
    <section class="card section"><h2>Exportar respaldo</h2><p class="small muted">Descarga un archivo JSON para conservar o trasladar tus fichas y sesiones.</p><button class="button secondary" id="exportData">Descargar respaldo</button><label class="button secondary" for="importFile" style="display:inline-flex;margin-left:6px">Importar respaldo</label><input id="importFile" type="file" accept="application/json,.json" hidden><span id="importStatus" class="help"></span></section>
    <section class="card section"><h2>Borrar toda la bitácora</h2><p class="small muted">Esta acción elimina fichas y sesiones de este dispositivo.</p><button class="button danger" id="clearData">Borrar datos</button></section>
    <p class="footer-note">RPE de sesión (Foster): el deportista reporta un esfuerzo de 0 a 10 al terminar; se multiplica por la duración en minutos. El rango de carga pronosticado usa el RPE esperado por la duración prevista. La fórmula cuantifica carga interna percibida y no predice lesiones.</p>`;
  }
  function render(){
    const main=$('#mainContent');
    main.innerHTML=view==='hoy'?home():view==='anotar'?forecast():view==='historial'?historyView():view==='metricas'?metricView():settingsView();
    bindCommon();
    if(view==='anotar') bindForecast();
    if(view==='historial'){renderPeople();bindFilters();$('#managePeople')?.addEventListener('click',()=>setView('ajustes'));}
    if(view==='ajustes'){renderPeople();bindSettings();}
  }
  function bindCommon(){
    $$('[data-go]').forEach(b=>b.addEventListener('click',()=>setView(b.dataset.go)));
    $$('[data-close]').forEach(form=>form.addEventListener('submit',e=>{e.preventDefault();closeSession(form.dataset.close,new FormData(form));}));
  }
  function closeSession(id,form){
    const s=state.sessions.find(x=>x.id===id);if(!s||s.status==='closed')return;
    const rpe=Number(form.get('rpe')),minutes=Number(form.get('minutes'));
    if(!Number.isFinite(rpe)||rpe<0||rpe>10||!Number.isFinite(minutes)||minutes<1){notify('Revisa el RPE y los minutos.');return;}
    const actualLoad=rpe*minutes;
    s.status='closed';s.actualRpe=rpe;s.actualMinutes=minutes;s.actualLoad=actualLoad;s.closedAt=new Date().toISOString();s.covered=actualLoad>=s.predictedLoadLow&&actualLoad<=s.predictedLoadHigh;
    save();render();notify(s.covered?'Resultado dentro del rango.':'Resultado guardado; quedó fuera del rango.');
  }
  function bindForecast(){
    const form=$('#forecastForm');if(!form)return;
    const update=()=>{
      const low=Number($('#rpeLow').value)||0,high=Number($('#rpeHigh').value)||0,minutes=Number($('#plannedMinutes').value)||0;
      $('#loadOutput').textContent=$('#rpeLow').value!==''&&$('#rpeHigh').value!==''&&$('#plannedMinutes').value!==''?`${fmt(low*minutes)}–${fmt(high*minutes)}`:'—';
      const suggestion=makeSuggestion($('#person').value,$('#type').value.trim(),minutes||1);const box=$('#suggestionBox');
      if(!suggestion){box.innerHTML=$('#person').value&&$('#type').value.trim()?`<div class="suggestion">${matchingHistory($('#person').value,$('#type').value.trim()).length===1?'Hay una sesión cerrada de este tipo. Al completar otra, aparecerá una sugerencia de rango basada en el historial.':'Todavía no hay dos sesiones cerradas de este tipo. Puedes registrar tu propio rango de partida.'}</div>`:'';return;}
      box.innerHTML=`<div class="suggestion"><b>Rango sugerido con las últimas ${suggestion.count} sesiones:</b> ${fmt(suggestion.low)}–${fmt(suggestion.high)} unidades. Si mantienes ${minutes} min, equivale aproximadamente a RPE ${suggestion.rpeLow.toFixed(1)}–${suggestion.rpeHigh.toFixed(1)}.<button type="button" id="applySuggestion">Usar este rango</button></div>`;
      $('#applySuggestion').addEventListener('click',()=>{$('#rpeLow').value=Math.floor(suggestion.rpeLow*2)/2;$('#rpeHigh').value=Math.ceil(suggestion.rpeHigh*2)/2;update();});
    };
    ['input','change'].forEach(ev=>['#rpeLow','#rpeHigh','#plannedMinutes','#person','#type'].forEach(sel=>$(sel)?.addEventListener(ev,update)));
    update();
    $('#addPerson').addEventListener('click',()=>addPerson());
    form.addEventListener('submit',e=>{e.preventDefault();const fd=new FormData(form),low=Number(fd.get('rpeLow')),high=Number(fd.get('rpeHigh')),minutes=Number(fd.get('plannedMinutes'));
      if(low>high){notify('El RPE inicial debe ser menor que el final.');return;}
      const session={id:uid(),personId:fd.get('person'),type:String(fd.get('type')).trim(),predictedRpeLow:low,predictedRpeHigh:high,plannedMinutes:minutes,predictedLoadLow:low*minutes,predictedLoadHigh:high*minutes,date:fd.get('date'),createdAt:new Date().toISOString(),status:'pending'};
      state.sessions.push(session);save();view='hoy';$$('.nav-item').forEach(b=>b.classList.toggle('active',b.dataset.view===view));render();notify('Pronóstico guardado antes de la sesión.');
    });
  }
  function addPerson(){
    const name=prompt('Nombre de la persona, deportista o grupo:');if(!name?.trim())return;
    const person={id:uid(),name:name.trim(),createdAt:new Date().toISOString()};state.people.push(person);save();render();notify('Ficha creada.');
  }
  function renderPeople(){
    const box=$('#peopleList');if(!box)return;
    box.innerHTML=state.people.length?state.people.map(p=>{const n=state.sessions.filter(s=>s.personId===p.id).length;return `<div class="person-row"><div class="person-meta"><span class="person-avatar">${safe(p.name.slice(0,1).toUpperCase())}</span><span><strong>${safe(p.name)}</strong><small>${n} ${n===1?'sesión':'sesiones'}</small></span></div><div class="person-actions"><button class="text-button" data-rename="${safe(p.id)}">Renombrar</button><button class="text-button delete" data-delete="${safe(p.id)}">Eliminar</button></div></div>`}).join(''):`<div class="empty"><strong>No hay fichas creadas.</strong>Agrega una persona para empezar a registrar sesiones.</div>`;
    $$('[data-rename]',box).forEach(b=>b.addEventListener('click',()=>{const p=state.people.find(x=>x.id===b.dataset.rename);const name=prompt('Cambiar nombre:',p.name);if(name?.trim()){p.name=name.trim();save();render();}}));
    $$('[data-delete]',box).forEach(b=>b.addEventListener('click',()=>{const p=state.people.find(x=>x.id===b.dataset.delete);if(confirm(`¿Eliminar ${p.name} y todas sus sesiones?`)){state.people=state.people.filter(x=>x.id!==p.id);state.sessions=state.sessions.filter(x=>x.personId!==p.id);save();render();notify('Ficha eliminada.');}}));
  }
  function bindFilters(){
    const apply=()=>{const person=$('#historyPerson').value,type=$('#historyType').value,status=$('#historyState').value;const list=[...state.sessions].sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).filter(s=>(!person||s.personId===person)&&(!type||s.type===type)&&(!status||s.status===status));$('#historyList').innerHTML=list.length?list.map(s=>sessionCard(s,true)).join(''):`<div class="empty">No hay sesiones con estos filtros.</div>`;bindCommon();};
    ['historyPerson','historyType','historyState'].forEach(id=>$('#'+id).addEventListener('change',apply));
  }
  function bindSettings(){
    $('#addPerson').addEventListener('click',addPerson);
    $('#exportData').addEventListener('click',()=>{const blob=new Blob([JSON.stringify({...state,exportedAt:new Date().toISOString()},null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`carga-clara-respaldo-${new Date().toISOString().slice(0,10)}.json`;a.click();URL.revokeObjectURL(a.href);notify('Respaldo descargado.');});
    $('#importFile').addEventListener('change',async e=>{const file=e.target.files[0];if(!file)return;try{const data=JSON.parse(await file.text());if(!Array.isArray(data.people)||!Array.isArray(data.sessions))throw new Error('Estructura inválida');if(!confirm('¿Reemplazar la bitácora de este dispositivo con el respaldo?'))return;state.people=data.people;state.sessions=data.sessions;save();render();notify('Respaldo importado.');}catch{ $('#importStatus').textContent='No se pudo leer el archivo. Selecciona un respaldo de Carga Clara.';}});
    $('#clearData').addEventListener('click',()=>{if(confirm('¿Borrar todas las fichas y sesiones de este dispositivo? Esta acción no se puede deshacer.')){state.people=[];state.sessions=[];save();render();notify('Bitácora borrada.');}});
  }
  $$('.nav-item').forEach(b=>b.addEventListener('click',()=>setView(b.dataset.view)));
  $('#settingsShortcut').addEventListener('click',()=>setView('ajustes'));
  render();
  if('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('./service-worker.js').catch(()=>{});
})();
