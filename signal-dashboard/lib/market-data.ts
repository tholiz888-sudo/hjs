import { simulate, type Candle } from "./engine";

// Integration boundary: a future HTTP/WebSocket adapter must return continuous,
// validated 1-minute candles with ISO timezone-aware OPEN timestamps. Only closed
// candles should be passed to analyze(); never expose an unfinished 5m candle.
// Keep API credentials server-side in a Next.js route handler, not client bundles.
export interface MarketDataSource {
  readonly kind: "simulated" | "live";
  loadCandles(options: {
    symbol: string;
    limit: number;
    seed?: number;
  }): Promise<Candle[]>;
}
export const simulatedSource: MarketDataSource = {
  kind: "simulated",
  async loadCandles({ limit, seed = 42 }) {
    return simulate(seed, limit);
  },
};
// Future: implement a LiveMarketDataSource with the same interface and explicitly
// change source labels after verifying actual exchange responses and timestamps.
