export interface PricePoint {
  date: Date;
  close: number;
}

function formatDateForStooq(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}${mm}${dd}`;
}

function normalizeSymbol(symbol: string): string {
  const trimmed = symbol.trim().toLowerCase();
  return trimmed.includes('.') ? trimmed : `${trimmed}.us`;
}

/** Fetches daily close prices for a symbol from Stooq, sorted oldest to newest. */
export async function fetchDailyHistory(symbol: string, from: Date, to: Date): Promise<PricePoint[]> {
  const ticker = normalizeSymbol(symbol);
  const url = `https://stooq.com/q/d/l/?s=${encodeURIComponent(ticker)}&d1=${formatDateForStooq(from)}&d2=${formatDateForStooq(to)}&i=d`;

  const response = await fetch(url);
  const text = await response.text();
  const trimmed = text.trim();

  if (!trimmed || trimmed.toUpperCase() === 'N/D' || !trimmed.toLowerCase().startsWith('date,')) {
    throw new Error(`No data found for symbol "${symbol.toUpperCase()}"`);
  }

  const lines = trimmed.split('\n');
  const points: PricePoint[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',');
    if (cols.length < 5) continue;
    const close = parseFloat(cols[4]);
    if (Number.isNaN(close)) continue;
    points.push({ date: new Date(cols[0]), close });
  }

  if (points.length === 0) {
    throw new Error(`No data found for symbol "${symbol.toUpperCase()}"`);
  }

  return points.sort((a, b) => a.date.getTime() - b.date.getTime());
}
