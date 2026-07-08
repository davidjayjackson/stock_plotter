import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'stock_plotter.watchlist';

/** Loads the saved list of stock symbols, returning an empty array if none are stored or on error. */
export async function loadWatchlist(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((s): s is string => typeof s === 'string');
  } catch {
    return [];
  }
}

/** Persists the list of stock symbols. */
export async function saveWatchlist(symbols: string[]): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(symbols));
  } catch {
    // Ignore write failures; the in-memory list still reflects the user's intent.
  }
}
