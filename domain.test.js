'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { calculateLoad, isWithinBand, suggestLoadBand, loadBandToRpe } = require('./domain.js');

test('calculates Foster session load as reported RPE times minutes', () => {
  assert.equal(calculateLoad(6, 50), 300);
});

test('rejects RPE and duration outside their valid ranges', () => {
  assert.throws(() => calculateLoad(-1, 50), RangeError);
  assert.throws(() => calculateLoad(11, 50), RangeError);
  assert.throws(() => calculateLoad(6, 0), RangeError);
});

test('counts both endpoints as inside the forecast band', () => {
  assert.equal(isWithinBand(200, 200, 400), true);
  assert.equal(isWithinBand(400, 200, 400), true);
  assert.equal(isWithinBand(401, 200, 400), false);
});

test('waits for two comparable sessions before suggesting a band', () => {
  assert.equal(suggestLoadBand([300]), null);
});

test('suggests mean plus/minus mean absolute deviation from recent loads', () => {
  const band = suggestLoadBand([200, 300, 400]);
  assert.equal(band.count, 3);
  assert.equal(band.low, 300 - 200 / 3);
  assert.equal(band.high, 300 + 200 / 3);
});

test('limits the suggestion to the most recent five observations', () => {
  const band = suggestLoadBand([10, 20, 30, 40, 50, 100, 100]);
  assert.equal(band.count, 5);
  assert.ok(Math.abs(band.low - 35.2) < 1e-9);
  assert.ok(Math.abs(band.high - 92.8) < 1e-9);
});

test('converts a suggested load range to an RPE range for the planned duration', () => {
  assert.deepEqual(loadBandToRpe({ low: 300, high: 450 }, 60), { rpeLow: 5, rpeHigh: 7.5 });
});
