import type { Signal } from "./engine";
export type AlertCursor = { stream: string; time: string };
export function advanceSignalAlert(
  cursor: AlertCursor | null,
  stream: string,
  signal: Signal,
): { cursor: AlertCursor; notify: boolean } {
  const next = { stream, time: signal.time };
  if (!cursor || cursor.stream !== stream)
    return { cursor: next, notify: false };
  if (Date.parse(signal.time) <= Date.parse(cursor.time))
    return { cursor, notify: false };
  return {
    cursor: next,
    notify: signal.ready && signal.direction !== "neutral",
  };
}
