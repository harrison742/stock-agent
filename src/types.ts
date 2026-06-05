export interface Bar {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface Snapshot {
  todayOpen: number | null;
  todayHigh: number | null;
  todayLow: number | null;
  lastPrice: number | null;
  prevClose: number | null;
}

export interface StockData {
  ticker: string;
  bars: Bar[];
  snapshot: Snapshot;
  fetchedAt: Date;
}
