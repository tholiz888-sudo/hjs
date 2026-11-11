import { simulate, type Candle } from "./engine";
import {
  aggregateCandles,
  intervalMs,
  type CandleInterval,
} from "./market-types";
export function simulatedChartRows(
  rows: Candle[],
  interval: CandleInterval,
): Candle[] {
  if (interval === "1m") return rows;
  const aggregated = aggregateCandles(rows, interval, "1m");
  if (aggregated.length >= 2) return aggregated;
  // Explicitly synthetic chart demonstration when the 24h sample cannot supply
  // multiple daily bars. This does not replace the signal's 1-minute input.
  const duration = intervalMs(interval);
  const end =
    Math.floor((Date.parse(rows.at(-1)!.datetime) + 60000) / duration) *
    duration;
  return simulate(17, 200).map((r, i) => ({
    ...r,
    datetime: new Date(end - (200 - i) * duration).toISOString(),
    volume: (r.volume * duration) / 60000,
  }));
}
