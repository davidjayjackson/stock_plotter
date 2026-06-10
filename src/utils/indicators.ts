/** Returns the exponential moving average for each index, seeded with the first value. */
export function exponentialMovingAverage(values: number[], period: number): number[] {
  const k = 2 / (period + 1);
  const result: number[] = new Array(values.length);
  let prevEma = values[0];
  result[0] = prevEma;

  for (let i = 1; i < values.length; i++) {
    prevEma = values[i] * k + prevEma * (1 - k);
    result[i] = prevEma;
  }

  return result;
}

export interface BollingerBands {
  upper: (number | null)[];
  middle: (number | null)[];
  lower: (number | null)[];
}

/** Returns Bollinger Bands (SMA +/- multiplier * standard deviation), null where fewer than `period` values are available. */
export function bollingerBands(values: number[], period = 20, multiplier = 2): BollingerBands {
  const upper: (number | null)[] = new Array(values.length).fill(null);
  const middle: (number | null)[] = new Array(values.length).fill(null);
  const lower: (number | null)[] = new Array(values.length).fill(null);

  for (let i = period - 1; i < values.length; i++) {
    const slice = values.slice(i - period + 1, i + 1);
    const mean = slice.reduce((a, b) => a + b, 0) / period;
    const variance = slice.reduce((a, b) => a + (b - mean) ** 2, 0) / period;
    const stdDev = Math.sqrt(variance);

    middle[i] = mean;
    upper[i] = mean + multiplier * stdDev;
    lower[i] = mean - multiplier * stdDev;
  }

  return { upper, middle, lower };
}

export interface MacdResult {
  macdLine: number[];
  signalLine: number[];
  histogram: number[];
}

/** Returns the MACD line (fast EMA - slow EMA), its signal line (EMA of the MACD line), and their difference. */
export function macd(values: number[], fastPeriod = 12, slowPeriod = 26, signalPeriod = 9): MacdResult {
  const fastEma = exponentialMovingAverage(values, fastPeriod);
  const slowEma = exponentialMovingAverage(values, slowPeriod);
  const macdLine = values.map((_, i) => fastEma[i] - slowEma[i]);
  const signalLine = exponentialMovingAverage(macdLine, signalPeriod);
  const histogram = macdLine.map((v, i) => v - signalLine[i]);

  return { macdLine, signalLine, histogram };
}
