"use client";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { defaults, type Params, simulate, validateParams } from "@/lib/engine";
const Context = createContext<{
  params: Params;
  save: (p: Params) => void;
  rows: ReturnType<typeof simulate>;
}>({ params: defaults, save: () => {}, rows: simulate() });
export function ResearchProvider({ children }: { children: ReactNode }) {
  const [params, setParams] = useState(defaults);
  const [rows] = useState(() => simulate());
  useEffect(() => {
    try {
      const s = localStorage.getItem("signal-params-v1");
      if (s) {
        const p = JSON.parse(s);
        if (!validateParams(p)) setParams(p);
      }
    } catch {}
  }, []);
  function save(p: Params) {
    setParams(p);
    try {
      localStorage.setItem("signal-params-v1", JSON.stringify(p));
    } catch {}
  }
  return (
    <Context.Provider value={{ params, save, rows }}>
      {children}
    </Context.Provider>
  );
}
export const useResearch = () => useContext(Context);
