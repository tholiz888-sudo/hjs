import { simulate, type Candle } from "./engine";

// Integration boundary for additional HTTP/WebSocket adapters: return continuous,
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
// Binance and OKX have server adapters in binance.ts, okx.ts and /api/market.
// This interface remains available for other sources; production UI must always
// distinguish actual exchange data, retained historical snapshots, and simulations.
