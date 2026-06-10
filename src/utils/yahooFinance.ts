export interface PricePoint {
  date: Date;
  close: number;
}

function toUnixSeconds(date: Date): number {
  return Math.floor(date.getTime() / 1000);
}

/** Fetches daily close prices for a symbol from Yahoo Finance's chart API, sorted oldest to newest. */
export async function fetchDailyHistory(symbol: string, from: Date, to: Date): Promise<PricePoint[]> {
  const ticker = symbol.trim().toUpperCase();
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?period1=${toUnixSeconds(from)}&period2=${toUnixSeconds(to)}&interval=1d`;

  const response = await fetch(url);
  const json = await response.json();

  const result = json?.chart?.result?.[0];
  if (!result) {
    const message = json?.chart?.error?.description ?? `No data found for symbol "${ticker}"`;
    throw new Error(message);
  }

  const timestamps: number[] = result.timestamp ?? [];
  const closes: (number | null)[] = result.indicators?.quote?.[0]?.close ?? [];

  const points: PricePoint[] = [];
  for (let i = 0; i < timestamps.length; i++) {
    const close = closes[i];
    if (close == null) continue;
    points.push({ date: new Date(timestamps[i] * 1000), close });
  }

  if (points.length === 0) {
    throw new Error(`No data found for symbol "${ticker}"`);
  }

  return points.sort((a, b) => a.date.getTime() - b.date.getTime());
}
