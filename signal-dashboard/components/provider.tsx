"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  defaults,
  type Params,
  type Candle,
  simulate,
  validateParams,
} from "@/lib/engine";
import { useBinanceMarket } from "@/lib/use-market";
import type { MarketSymbol } from "@/lib/binance";
const Context = createContext<{
  params: Params;
  marketMode: "live" | "simulated";
  setMarketMode: (mode: "live" | "simulated") => void;
  symbol: MarketSymbol;
  setSymbol: (symbol: MarketSymbol) => void;
  market: ReturnType<typeof useBinanceMarket>;
  save: (p: Params) => void;
  rows: ReturnType<typeof simulate>;
  regenerate: () => void;
  uploadedData: { name: string; rows: Candle[] } | null;
  setUploadedData: (data: { name: string; rows: Candle[] } | null) => void;
}>({
  params: defaults,
  marketMode: "live",
  setMarketMode: () => {},
  symbol: "BTCUSDT",
  setSymbol: () => {},
  market: {
    snapshot: null,
    healthy: false,
    ageMs: Infinity,
    loading: false,
    error: null,
    receivedAt: 0,
    retrySeconds: 0,
    refresh: () => {},
  },
  save: () => {},
  rows: simulate(),
  regenerate: () => {},
  uploadedData: null,
  setUploadedData: () => {},
});
export function ResearchProvider({ children }: { children: ReactNode }) {
  const [params, setParams] = useState(defaults);
  const [marketMode, setMarketMode] = useState<"live" | "simulated">("live");
  const [symbol, setSymbol] = useState<MarketSymbol>("BTCUSDT");
  const market = useBinanceMarket(symbol, marketMode === "live");
  const [uploadedData, setUploadedData] = useState<{
    name: string;
    rows: Candle[];
  } | null>(null);
  const [seed, setSeed] = useState(42);
  const [rows, setRows] = useState(() => simulate());
  function regenerate() {
    const next = seed + 1;
    setSeed(next);
    setRows(simulate(next));
  }
  useEffect(() => {
    try {
      const s = localStorage.getItem("signal-params-v1");
      if (s) {
        const p = { ...defaults, ...JSON.parse(s) };
        if (!validateParams(p)) setParams(p);
      }
    } catch {}
  }, []);
  const save = useCallback((p: Params) => {
    if (validateParams(p)) return;
    setParams(p);
    try {
      localStorage.setItem("signal-params-v1", JSON.stringify(p));
    } catch {}
  }, []);
  return (
    <Context.Provider
      value={{
        params,
        save,
        rows,
        regenerate,
        uploadedData,
        setUploadedData,
        marketMode,
        setMarketMode,
        symbol,
        setSymbol,
        market,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export const useResearch = () => useContext(Context);
