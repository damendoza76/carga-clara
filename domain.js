(() => {
  'use strict';
  const CSV_HEADERS = [
    'id', 'persona_id', 'persona', 'tipo_sesion', 'fecha_sesion',
    'rpe_pronosticado', 'minutos_previstos', 'carga_pronosticada', 'estado',
    'rpe_reportado', 'minutos_reales', 'carga_real', 'creado_en', 'cerrado_en'
  ];
  const calculateLoad = (rpe, minutes) => {
    const effort = Number(rpe), duration = Number(minutes);
    if (!Number.isFinite(effort) || effort < 0 || effort > 10) throw new RangeError('RPE must be between 0 and 10.');
    if (!Number.isFinite(duration) || duration <= 0) throw new RangeError('Duration must be greater than zero.');
    return effort * duration;
  };
  const absoluteError = (predicted, actual) => Math.abs(Number(actual) - Number(predicted));
  const meanAbsoluteError = (sessions) => {
    const pairs = sessions.filter(s => Number.isFinite(Number(s.predictedLoad)) && Number.isFinite(Number(s.actualLoad)));
    if (!pairs.length) return null;
    return pairs.reduce((sum, s) => sum + absoluteError(s.predictedLoad, s.actualLoad), 0) / pairs.length;
  };
  const suggestLoad = (loads, windowSize = 5) => {
    const values = loads.map(Number).filter(Number.isFinite).slice(-windowSize);
    if (values.length < 2) return null;
    return { load: values.reduce((sum, value) => sum + value, 0) / values.length, count: values.length };
  };
  const loadToRpe = (load, minutes) => {
    const duration = Number(minutes);
    if (!Number.isFinite(duration) || duration <= 0) throw new RangeError('Duration must be greater than zero.');
    return Number(load) / duration;
  };
  const migrateLegacySession = (session) => {
    if (session.predictedLoad !== undefined && session.predictedRpe !== undefined) return { ...session };
    const lowLoad = Number(session.predictedLoadLow), highLoad = Number(session.predictedLoadHigh);
    const lowRpe = Number(session.predictedRpeLow), highRpe = Number(session.predictedRpeHigh);
    const hasLoadBand = Number.isFinite(lowLoad) && Number.isFinite(highLoad);
    const hasRpeBand = Number.isFinite(lowRpe) && Number.isFinite(highRpe);
    if (hasLoadBand || hasRpeBand) {
      const predictedLoad = hasLoadBand ? (lowLoad + highLoad) / 2 : ((lowRpe + highRpe) / 2) * Number(session.plannedMinutes || 0);
      const predictedRpe = hasRpeBand ? (lowRpe + highRpe) / 2 : (Number(session.plannedMinutes) ? predictedLoad / Number(session.plannedMinutes) : 0);
      return { ...session, predictedRpe, predictedLoad, migratedFromRange: true };
    }
    return { ...session, predictedRpe: Number(session.predictedRpe || 0), predictedLoad: Number(session.predictedLoad || 0) };
  };
  const csvCell = (value) => {
    let text = value == null ? '' : String(value);
    if (typeof value === 'string' && /^[=+@\-]/.test(text)) text = `'${text}`;
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const stringifyCsv = (records) => [CSV_HEADERS, ...records.map(record => CSV_HEADERS.map(header => csvCell(record[header])))].map(row => row.join(',')).join('\r\n');
  const parseCsv = (input) => {
    const text = String(input ?? '').replace(/^\uFEFF/, '');
    let commaCount = 0, semicolonCount = 0, inHeaderQuotes = false;
    for (let i = 0; i < text.length && text[i] !== '\n' && text[i] !== '\r'; i++) {
      if (text[i] === '"' && text[i + 1] === '"' && inHeaderQuotes) i++;
      else if (text[i] === '"') inHeaderQuotes = !inHeaderQuotes;
      else if (!inHeaderQuotes && text[i] === ',') commaCount++;
      else if (!inHeaderQuotes && text[i] === ';') semicolonCount++;
    }
    const delimiter = semicolonCount > commaCount ? ';' : ',';
    const rows = [];
    let row = [], field = '', quoted = false;
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      if (quoted) {
        if (char === '"' && text[i + 1] === '"') { field += '"'; i++; }
        else if (char === '"') quoted = false;
        else field += char;
      } else if (char === '"' && field === '') quoted = true;
      else if (char === delimiter) { row.push(field); field = ''; }
      else if (char === '\n' || char === '\r') {
        if (char === '\r' && text[i + 1] === '\n') i++;
        row.push(field); field = '';
        if (row.some(cell => cell !== '')) rows.push(row);
        row = [];
      } else field += char;
    }
    if (field !== '' || row.length) { row.push(field); if (row.some(cell => cell !== '')) rows.push(row); }
    if (quoted) throw new SyntaxError('CSV contains an unclosed quoted field.');
    if (!rows.length) throw new SyntaxError('CSV is empty.');
    const headers = rows.shift().map(header => header.trim().toLowerCase());
    return rows.map(cells => Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ''])));
  };
  const api = { CSV_HEADERS, calculateLoad, absoluteError, meanAbsoluteError, suggestLoad, loadToRpe, migrateLegacySession, stringifyCsv, parseCsv };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.CargaClaraDomain = api;
})();
