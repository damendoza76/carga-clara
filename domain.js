(() => {
  'use strict';
  const calculateLoad = (rpe, minutes) => {
    const effort = Number(rpe), duration = Number(minutes);
    if (!Number.isFinite(effort) || effort < 0 || effort > 10) throw new RangeError('RPE must be between 0 and 10.');
    if (!Number.isFinite(duration) || duration <= 0) throw new RangeError('Duration must be greater than zero.');
    return effort * duration;
  };
  const isWithinBand = (value, low, high) => Number(value) >= Number(low) && Number(value) <= Number(high);
  const suggestLoadBand = (loads, windowSize = 5) => {
    const values = loads.map(Number).filter(Number.isFinite).slice(-windowSize);
    if (values.length < 2) return null;
    const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
    const meanAbsoluteDeviation = values.reduce((sum, value) => sum + Math.abs(value - mean), 0) / values.length;
    return { low: Math.max(0, mean - meanAbsoluteDeviation), high: mean + meanAbsoluteDeviation, count: values.length };
  };
  const loadBandToRpe = (band, minutes) => {
    const duration = Number(minutes);
    if (!Number.isFinite(duration) || duration <= 0) throw new RangeError('Duration must be greater than zero.');
    return {
      rpeLow: Math.max(0, Math.min(10, band.low / duration)),
      rpeHigh: Math.max(0, Math.min(10, band.high / duration))
    };
  };
  const api = { calculateLoad, isWithinBand, suggestLoadBand, loadBandToRpe };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.CargaClaraDomain = api;
})();
