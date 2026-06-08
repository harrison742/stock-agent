import * as https from 'https';
import { Bar, Snapshot, StockData } from './types';

const BASE = 'api.polygon.io';

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getTodayET(): string {
  return new Date().toLocaleDateString('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

function getBarDateET(ts: number): string {
  return new Date(ts).toLocaleDateString('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

function fetchJson(path: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const req = https.get({ host: BASE, path, headers: { 'User-Agent': 'stock-agent/1.0' } }, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => chunks.push(chunk));
      res.on('end', () => {
        try {
          resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
        } catch {
          reject(new Error('Failed to parse JSON response'));
        }
      });
      res.on('error', reject);
    });
    req.on('error', reject);
  });
}

export function isMarketHours(): boolean {
  const etStr = new Date().toLocaleString('en-US', { timeZone: 'America/New_York' });
  const et = new Date(etStr);
  const day = et.getDay();
  if (day === 0 || day === 6) return false;
  const mins = et.getHours() * 60 + et.getMinutes();
  return mins >= 9 * 60 + 30 && mins < 16 * 60;
}

interface PolygonAgg {
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

interface PolygonAggsResponse {
  status: string;
  results?: PolygonAgg[];
  error?: string;
  message?: string;
}

interface PolygonDaySnap {
  o?: number;
  h?: number;
  l?: number;
}

interface PolygonLastTrade {
  p?: number;
}

interface PolygonPrevDay {
  c?: number;
}

interface PolygonSnapshotTicker {
  day?: PolygonDaySnap;
  lastTrade?: PolygonLastTrade;
  prevDay?: PolygonPrevDay;
}

interface PolygonSnapshotResponse {
  status: string;
  ticker?: PolygonSnapshotTicker;
  error?: string;
  message?: string;
}

export async function fetchStockData(ticker: string): Promise<StockData> {
  const apiKey = process.env.POLYGON_API_KEY;
  if (!apiKey) throw new Error('POLYGON_API_KEY not set');

  const today = new Date();
  const toDate = formatDate(today);
  const fromDate = new Date(today);
  fromDate.setDate(fromDate.getDate() - 45);
  const fromStr = formatDate(fromDate);

  const aggsPath = `/v2/aggs/ticker/${ticker}/range/1/day/${fromStr}/${toDate}?adjusted=true&sort=asc&apiKey=${apiKey}`;
  const snapPath = `/v2/snapshot/locale/us/markets/stocks/tickers/${ticker}?apiKey=${apiKey}`;

  const [aggsRaw, snapRaw] = await Promise.all([fetchJson(aggsPath), fetchJson(snapPath)]);

  console.error('DEBUG aggs raw:', JSON.stringify(aggsRaw, null, 2));

  const aggsRes = aggsRaw as PolygonAggsResponse;
  const snapRes = snapRaw as PolygonSnapshotResponse;

  if ((aggsRes.status !== 'OK' && aggsRes.status !== 'DELAYED') || !aggsRes.results) {
    const msg = aggsRes.error ?? aggsRes.message ?? aggsRes.status;
    throw new Error(`Polygon aggs error for ${ticker}: ${msg}`);
  }

  const todayET = getTodayET();
  const allBars: Bar[] = aggsRes.results
    .filter(r => getBarDateET(r.t) !== todayET)
    .map(r => ({
      timestamp: r.t,
      open: r.o,
      high: r.h,
      low: r.l,
      close: r.c,
      volume: r.v,
    }));

  const bars = allBars.slice(-21);

  if (bars.length < 2) {
    throw new Error(`Not enough data for ${ticker}: only ${bars.length} completed bar(s)`);
  }

  const snap = snapRes.ticker;
  const snapshot: Snapshot = {
    todayOpen:  snap?.day?.o  ?? null,
    todayHigh:  snap?.day?.h  ?? null,
    todayLow:   snap?.day?.l  ?? null,
    lastPrice:  snap?.lastTrade?.p ?? null,
    prevClose:  snap?.prevDay?.c   ?? null,
  };

  return { ticker, bars, snapshot, fetchedAt: new Date() };
}
