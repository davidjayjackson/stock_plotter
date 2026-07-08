import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import DateTimePicker, { DateTimePickerChangeEvent } from '@react-native-community/datetimepicker';
import { BarChart, LineChart } from 'react-native-chart-kit';
import { fetchDailyHistory } from './src/utils/yahooFinance';
import { simpleMovingAverage } from './src/utils/movingAverage';
import { bollingerBands, macd } from './src/utils/indicators';
import { loadWatchlist, saveWatchlist } from './src/utils/watchlist';

const LOOKBACK_DAYS = 220; // extra calendar days fetched before the start date so 50/100-day averages are ready from day one
const MAX_LABELS = 6;

interface ChartData {
  labels: string[];
  close: number[];
  ma50: number[];
  ma100: number[];
  bbUpper: number[];
  bbMiddle: number[];
  bbLower: number[];
  macdLine: number[];
  signalLine: number[];
  histogram: number[];
}

function defaultStartDate(): Date {
  const date = new Date();
  date.setMonth(date.getMonth() - 6);
  return date;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString();
}

function buildLabels(dates: Date[]): string[] {
  const step = Math.max(1, Math.ceil(dates.length / MAX_LABELS));
  return dates.map((date, i) =>
    i % step === 0 ? `${date.getMonth() + 1}/${date.getDate()}/${String(date.getFullYear()).slice(2)}` : ''
  );
}

export default function App() {
  const [symbol, setSymbol] = useState('AAPL');
  const [startDate, setStartDate] = useState(defaultStartDate());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chartData, setChartData] = useState<ChartData | null>(null);
  const [watchlist, setWatchlist] = useState<string[]>([]);

  useEffect(() => {
    loadWatchlist().then(setWatchlist);
  }, []);

  const persistWatchlist = (next: string[]) => {
    setWatchlist(next);
    saveWatchlist(next);
  };

  const handleSaveSymbol = () => {
    const trimmed = symbol.trim().toUpperCase();
    if (!trimmed) {
      setError('Please enter a stock symbol.');
      return;
    }
    if (watchlist.includes(trimmed)) return;
    persistWatchlist([...watchlist, trimmed]);
  };

  const handleSelectSymbol = (saved: string) => {
    setSymbol(saved);
  };

  const handleRemoveSymbol = (saved: string) => {
    persistWatchlist(watchlist.filter((s) => s !== saved));
  };

  const onValueChangeDate = (_event: DateTimePickerChangeEvent, selected: Date) => {
    setShowDatePicker(Platform.OS === 'ios');
    setStartDate(selected);
  };

  const onDismissDate = () => {
    setShowDatePicker(false);
  };

  const handlePlot = async () => {
    Keyboard.dismiss();

    if (!symbol.trim()) {
      setError('Please enter a stock symbol.');
      return;
    }

    setError(null);
    setLoading(true);
    setChartData(null);

    try {
      const lookbackStart = new Date(startDate);
      lookbackStart.setDate(lookbackStart.getDate() - LOOKBACK_DAYS);

      const points = await fetchDailyHistory(symbol, lookbackStart, new Date());
      const closes = points.map((p) => p.close);
      const ma50 = simpleMovingAverage(closes, 50);
      const ma100 = simpleMovingAverage(closes, 100);
      const bands = bollingerBands(closes, 20, 2);
      const { macdLine, signalLine, histogram } = macd(closes);

      let sliceStart = points.findIndex((p) => p.date >= startDate);
      if (sliceStart === -1) sliceStart = 0;

      const displayDates = points.slice(sliceStart).map((p) => p.date);
      const displayClose = closes.slice(sliceStart);

      if (displayClose.length === 0) {
        throw new Error('No data available on or after the selected start date.');
      }

      const displayMa50 = ma50.slice(sliceStart).map((v, i) => v ?? displayClose[i]);
      const displayMa100 = ma100.slice(sliceStart).map((v, i) => v ?? displayClose[i]);
      const displayBbUpper = bands.upper.slice(sliceStart).map((v, i) => v ?? displayClose[i]);
      const displayBbMiddle = bands.middle.slice(sliceStart).map((v, i) => v ?? displayClose[i]);
      const displayBbLower = bands.lower.slice(sliceStart).map((v, i) => v ?? displayClose[i]);

      setChartData({
        labels: buildLabels(displayDates),
        close: displayClose,
        ma50: displayMa50,
        ma100: displayMa100,
        bbUpper: displayBbUpper,
        bbMiddle: displayBbMiddle,
        bbLower: displayBbLower,
        macdLine: macdLine.slice(sliceStart),
        signalLine: signalLine.slice(sliceStart),
        histogram: histogram.slice(sliceStart),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load data.');
    } finally {
      setLoading(false);
    }
  };

  const { width: screenWidth } = useWindowDimensions();
  const chartWidth = chartData ? Math.max(screenWidth - 32, chartData.close.length * 4) : screenWidth - 32;

  return (
    <View style={styles.container}>
      <StatusBar style="auto" />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Stock Plotter</Text>

        <Text style={styles.label}>Symbol</Text>
        <View style={styles.symbolRow}>
          <TextInput
            style={[styles.input, styles.symbolInput]}
            value={symbol}
            onChangeText={(text) => setSymbol(text.toUpperCase())}
            autoCapitalize="characters"
            autoCorrect={false}
            placeholder="e.g. AAPL"
          />
          <TouchableOpacity style={styles.saveButton} onPress={handleSaveSymbol}>
            <Text style={styles.saveButtonText}>Save</Text>
          </TouchableOpacity>
        </View>

        {watchlist.length > 0 && (
          <View style={styles.chipRow}>
            {watchlist.map((saved) => (
              <View key={saved} style={styles.chip}>
                <TouchableOpacity onPress={() => handleSelectSymbol(saved)}>
                  <Text style={styles.chipText}>{saved}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => handleRemoveSymbol(saved)}
                  hitSlop={{ top: 8, bottom: 8, left: 4, right: 8 }}
                >
                  <Text style={styles.chipRemove}>×</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        <Text style={styles.label}>Start Date</Text>
        <TouchableOpacity style={styles.input} onPress={() => setShowDatePicker(true)}>
          <Text>{formatDate(startDate)}</Text>
        </TouchableOpacity>
        {showDatePicker && (
          <DateTimePicker
            value={startDate}
            mode="date"
            display="default"
            maximumDate={new Date()}
            onValueChange={onValueChangeDate}
            onDismiss={onDismissDate}
          />
        )}

        <TouchableOpacity style={styles.button} onPress={handlePlot} disabled={loading}>
          <Text style={styles.buttonText}>{loading ? 'Loading...' : 'Plot'}</Text>
        </TouchableOpacity>

        {loading && <ActivityIndicator style={styles.spacer} size="large" />}
        {error && <Text style={styles.error}>{error}</Text>}

        {chartData && (
          <>
            <IndicatorChart
              title="Price"
              labels={chartData.labels}
              width={chartWidth}
              series={[
                { data: chartData.close, color: '#1f77b4', label: 'Close' },
                { data: chartData.ma50, color: '#ff7f0e', label: 'MA 50' },
                { data: chartData.ma100, color: '#2ca02c', label: 'MA 100' },
              ]}
            />

            <IndicatorChart
              title="Bollinger Bands"
              labels={chartData.labels}
              width={chartWidth}
              series={[
                { data: chartData.bbUpper, color: '#9467bd', label: 'Upper' },
                { data: chartData.bbMiddle, color: '#8c564b', label: 'Middle' },
                { data: chartData.bbLower, color: '#17becf', label: 'Lower' },
                { data: chartData.close, color: '#1f77b4', label: 'Close', strokeWidth: 3 },
              ]}
            />

            <MacdChart
              labels={chartData.labels}
              width={chartWidth}
              macdLine={chartData.macdLine}
              signalLine={chartData.signalLine}
              histogram={chartData.histogram}
            />
          </>
        )}
      </ScrollView>
    </View>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendSwatch, { backgroundColor: color }]} />
      <Text>{label}</Text>
    </View>
  );
}

interface Series {
  data: number[];
  color: string;
  label: string;
  strokeWidth?: number;
}

const baseChartConfig = {
  backgroundColor: '#ffffff',
  backgroundGradientFrom: '#ffffff',
  backgroundGradientTo: '#ffffff',
  decimalPlaces: 2,
  color: () => '#333333',
  labelColor: () => '#333333',
  propsForBackgroundLines: { stroke: '#e3e3e3' },
};

function IndicatorChart({ title, labels, series, width }: { title: string; labels: string[]; series: Series[]; width: number }) {
  return (
    <View style={styles.spacer}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.legend}>
        {series.map((s) => (
          <LegendItem key={s.label} color={s.color} label={s.label} />
        ))}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator>
        <LineChart
          data={{
            labels,
            datasets: series.map((s) => ({ data: s.data, color: () => s.color, strokeWidth: s.strokeWidth ?? 2 })),
          }}
          width={width}
          height={300}
          withDots={false}
          withShadow={false}
          chartConfig={baseChartConfig}
          style={styles.chart}
        />
      </ScrollView>
    </View>
  );
}

function MacdChart({
  labels,
  width,
  macdLine,
  signalLine,
  histogram,
}: {
  labels: string[];
  width: number;
  macdLine: number[];
  signalLine: number[];
  histogram: number[];
}) {
  return (
    <View style={styles.spacer}>
      <Text style={styles.sectionTitle}>MACD</Text>
      <View style={styles.legend}>
        <LegendItem color="#1f77b4" label="MACD" />
        <LegendItem color="#ff7f0e" label="Signal" />
        <LegendItem color="#2ca02c" label="Histogram" />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator>
        <View>
          <LineChart
            data={{
              labels,
              datasets: [
                { data: macdLine, color: () => '#1f77b4', strokeWidth: 2 },
                { data: signalLine, color: () => '#ff7f0e', strokeWidth: 2 },
              ],
            }}
            width={width}
            height={200}
            withDots={false}
            withShadow={false}
            withVerticalLabels={false}
            chartConfig={baseChartConfig}
            style={styles.chart}
          />
          <BarChart
            data={{ labels, datasets: [{ data: histogram }] }}
            width={width}
            height={120}
            fromZero={false}
            withInnerLines={false}
            showBarTops={false}
            showValuesOnTopOfBars={false}
            yAxisLabel=""
            yAxisSuffix=""
            chartConfig={{
              ...baseChartConfig,
              fillShadowGradient: '#2ca02c',
              fillShadowGradientOpacity: 1,
              barPercentage: 0.15,
            }}
            style={styles.chart}
          />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    paddingTop: Platform.OS === 'android' ? 40 : 60,
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
    marginTop: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  symbolRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  symbolInput: {
    flex: 1,
  },
  saveButton: {
    backgroundColor: '#1f77b4',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginLeft: 8,
    justifyContent: 'center',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 10,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eef4fa',
    borderRadius: 16,
    paddingVertical: 6,
    paddingLeft: 12,
    paddingRight: 8,
    marginRight: 8,
    marginBottom: 8,
  },
  chipText: {
    color: '#1f77b4',
    fontSize: 14,
    fontWeight: '600',
  },
  chipRemove: {
    color: '#888',
    fontSize: 18,
    marginLeft: 6,
    lineHeight: 18,
  },
  button: {
    backgroundColor: '#1f77b4',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 20,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  spacer: {
    marginTop: 20,
  },
  error: {
    color: '#d32f2f',
    marginTop: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 10,
  },
  legendSwatch: {
    width: 12,
    height: 12,
    borderRadius: 2,
    marginRight: 4,
  },
  chart: {
    borderRadius: 8,
  },
});
