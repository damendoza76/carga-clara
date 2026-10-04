'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  calculateLoad, absoluteError, meanAbsoluteError, suggestLoad, loadToRpe,
  migrateLegacySession, stringifyCsv, parseCsv, CSV_HEADERS
} = require('./domain.js');

test('calculates session load from a single RPE and minutes', () => {
  assert.equal(calculateLoad(6, 50), 300);
});

test('rejects RPE and duration outside their valid ranges', () => {
  assert.throws(() => calculateLoad(-1, 50), RangeError);
  assert.throws(() => calculateLoad(11, 50), RangeError);
  assert.throws(() => calculateLoad(6, 0), RangeError);
});

test('calculates absolute prediction error and mean absolute error', () => {
  assert.equal(absoluteError(300, 380), 80);
  assert.equal(meanAbsoluteError([{ predictedLoad: 300, actualLoad: 380 }, { predictedLoad: 400, actualLoad: 360 }]), 60);
  assert.equal(meanAbsoluteError([]), null);
});

test('suggests one expected load from the most recent five sessions', () => {
  assert.equal(suggestLoad([300]), null);
  assert.deepEqual(suggestLoad([100, 200, 300, 400, 500, 600, 700]), { load: 500, count: 5 });
});

test('converts a suggested load into one RPE for the planned duration', () => {
  assert.equal(loadToRpe(360, 60), 6);
  assert.equal(loadToRpe(720, 60), 12); // callers can flag values above the RPE scale
});

test('migrates an older forecast range to its midpoint without discarding source values', () => {
  const old = { predictedRpeLow: 4, predictedRpeHigh: 6, predictedLoadLow: 240, predictedLoadHigh: 360, plannedMinutes: 60 };
  const migrated = migrateLegacySession(old);
  assert.equal(migrated.predictedRpe, 5);
  assert.equal(migrated.predictedLoad, 300);
  assert.equal(migrated.migratedFromRange, true);
  assert.equal(migrated.predictedLoadLow, 240);
});

test('parses CSV commas, escaped quotes, newlines, and UTF-8 BOM', () => {
  const rows = parseCsv('\uFEFFpersona,tipo_sesion,nota\r\n"Ana, María","Fuerza","Dijo ""bien""\ny siguió"\r\n');
  assert.deepEqual(rows, [{ persona: 'Ana, María', tipo_sesion: 'Fuerza', nota: 'Dijo "bien"\ny siguió' }]);
});

test('parses semicolon-delimited CSV saved by spreadsheet applications', () => {
  const rows = parseCsv('persona;tipo_sesion;rpe_pronosticado\r\nAna;Fuerza;5,5\r\n');
  assert.deepEqual(rows, [{ persona: 'Ana', tipo_sesion: 'Fuerza', rpe_pronosticado: '5,5' }]);
});

test('CSV export safely quotes text and protects spreadsheet formulas', () => {
  const csv = stringifyCsv([{ id: 's1', persona: 'Ana, María', tipo_sesion: '=HYPERLINK("x")', fecha_sesion: '2026-10-04' }]);
  const parsed = parseCsv(csv);
  assert.equal(parsed[0].persona, 'Ana, María');
  assert.equal(parsed[0].tipo_sesion, "'=HYPERLINK(\"x\")");
});

test('CSV export and import retain all session fields', () => {
  const record = Object.fromEntries(CSV_HEADERS.map(header => [header, '']));
  Object.assign(record, { id: 's1', persona_id: 'p1', persona: 'Ana, María', tipo_sesion: 'Fuerza "A"', fecha_sesion: '2026-10-04', rpe_pronosticado: 5.5, minutos_previstos: 60, carga_pronosticada: 330, estado: 'cerrada', rpe_reportado: 7, minutos_reales: 55, carga_real: 385, creado_en: '2026-10-04T12:00:00Z', cerrado_en: '2026-10-04T13:00:00Z' });
  const [imported] = parseCsv(stringifyCsv([record]));
  for (const key of CSV_HEADERS) assert.equal(imported[key], String(record[key]), `field ${key}`);
});
