import { StockData } from './types';

const R = '\x1b[0m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const YELLOW = '\x1b[33m';
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';

function ts2date(ts: number): string {
  return new Date(ts).toLocaleDateString('en-US', {
    timeZone: 'America/New_York',
    month: '2-digit',
    day: '2-digit',
    year: '2-digit',
  });
}

export function calcExcursions(data: StockData): string {
  const { bars } = data;
  if (bars.length < 2) return `${RED}✗ Not enough bar data for excursion analysis${R}`;

  const lines: string[] = [];

  const upMoves: number[] = [];
  const downMoves: number[] = [];
  for (let i = 1; i < bars.length; i++) {
    const pc = bars[i - 1].close;
    upMoves.push((bars[i].high - pc) / pc * 100);
    downMoves.push((bars[i].low - pc) / pc * 100);
  }

  const maxUp = Math.max(...upMoves);
  const minDown = Math.min(...downMoves);
  const maxUpIdx = upMoves.indexOf(maxUp);
  const minDownIdx = downMoves.indexOf(minDown);

  const SEP = '  ';
  const W = { date: 8, price: 8, dir: 4, vol: 13, up: 9, down: 10 };
  const totalWidth = W.date + W.price * 4 + W.dir + W.vol + W.up + W.down + SEP.length * 8;

  const hdr =
    'Date'.padStart(W.date) + SEP +
    'Open'.padStart(W.price) + SEP +
    'High'.padStart(W.price) + SEP +
    'Low'.padStart(W.price) + SEP +
    'Close'.padStart(W.price) + SEP +
    'Dir'.padStart(W.dir) + SEP +
    'Volume'.padStart(W.vol) + SEP +
    'Max Up%'.padStart(W.up) + SEP +
    'Max Down%'.padStart(W.down);
  lines.push(`${DIM}${hdr}${R}`);
  lines.push(`${DIM}${'─'.repeat(totalWidth)}${R}`);

  const rows: string[] = [];

  // bars[0] is anchor — show its own OHLC, "—" dir, zero excursion columns
  rows.push(
    `${YELLOW}${ts2date(bars[0].timestamp).padStart(W.date)}${R}${SEP}` +
    `${bars[0].open.toFixed(2).padStart(W.price)}${SEP}` +
    `${bars[0].high.toFixed(2).padStart(W.price)}${SEP}` +
    `${bars[0].low.toFixed(2).padStart(W.price)}${SEP}` +
    `${bars[0].close.toFixed(2).padStart(W.price)}${SEP}` +
    `${DIM}${'—'.padStart(W.dir)}${R}${SEP}` +
    `${Math.floor(bars[0].volume).toLocaleString('en-US').padStart(W.vol)}${SEP}` +
    `${GREEN}${'0.00%'.padStart(W.up)}${R}${SEP}` +
    `${RED}${'0.00%'.padStart(W.down)}${R}`
  );

  for (let i = 0; i < upMoves.length; i++) {
    const bar = bars[i + 1];
    const up = upMoves[i];
    const down = downMoves[i];
    const dir = bar.close > bars[i].close ? 'U' : 'D';
    const dirColor = dir === 'U' ? GREEN : RED;

    let marker = '';
    if (i === maxUpIdx && i === minDownIdx) {
      marker = `  ${YELLOW}◀ biggest up & down${R}`;
    } else if (i === maxUpIdx) {
      marker = `  ${YELLOW}◀ biggest up${R}`;
    } else if (i === minDownIdx) {
      marker = `  ${YELLOW}◀ biggest down${R}`;
    }

    rows.push(
      `${YELLOW}${ts2date(bar.timestamp).padStart(W.date)}${R}${SEP}` +
      `${bar.open.toFixed(2).padStart(W.price)}${SEP}` +
      `${bar.high.toFixed(2).padStart(W.price)}${SEP}` +
      `${bar.low.toFixed(2).padStart(W.price)}${SEP}` +
      `${bar.close.toFixed(2).padStart(W.price)}${SEP}` +
      `${dirColor}${dir.padStart(W.dir)}${R}${SEP}` +
      `${Math.floor(bar.volume).toLocaleString('en-US').padStart(W.vol)}${SEP}` +
      `${GREEN}${`+${up.toFixed(2)}%`.padStart(W.up)}${R}${SEP}` +
      `${RED}${`${down.toFixed(2)}%`.padStart(W.down)}${R}` +
      marker
    );
  }

  for (const row of [...rows].reverse()) lines.push(row);

  lines.push('');
  lines.push(`  ${BOLD}Biggest up: ${GREEN}+${maxUp.toFixed(2)}%${R}  ${BOLD}|  Biggest down: ${RED}${minDown.toFixed(2)}%${R}`);

  return lines.join('\n');
}

export function calcVolatility(data: StockData): string {
  const { bars } = data;
  if (bars.length < 2) return `${RED}✗ Not enough data for volatility${R}`;

  const returns: number[] = [];
  for (let i = 1; i < bars.length; i++) {
    returns.push(Math.log(bars[i].close / bars[i - 1].close));
  }

  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / (returns.length - 1);
  const dailyStd = Math.sqrt(variance);
  const annualVol = dailyStd * Math.sqrt(252) * 100;

  return (
    `${BOLD}Annualized Volatility${R}\n` +
    `  Daily std dev:   ${(dailyStd * 100).toFixed(3)}%\n` +
    `  Annualized vol:  ${GREEN}${annualVol.toFixed(2)}%${R}  (${returns.length} log returns)`
  );
}

export function calcMomentum(data: StockData): string {
  const { bars } = data;
  if (bars.length < 2) return `${RED}✗ Not enough data for momentum${R}`;

  const startOpen = bars[0].open;
  const endClose = bars[bars.length - 1].close;
  const pct = (endClose - startOpen) / startOpen * 100;
  const cc = pct >= 0 ? GREEN : RED;

  return (
    `${BOLD}14-Day Momentum${R}\n` +
    `  From: ${ts2date(bars[0].timestamp)} open  $${startOpen.toFixed(2)}\n` +
    `  To:   ${ts2date(bars[bars.length - 1].timestamp)} close $${endClose.toFixed(2)}\n` +
    `  Net:  ${cc}${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%${R}`
  );
}

export function calcRange(data: StockData): string {
  const { bars } = data;
  if (bars.length === 0) return `${RED}✗ No data${R}`;

  const spreads = bars.map(b => b.high - b.low);
  const avg = spreads.reduce((a, b) => a + b, 0) / spreads.length;
  const max = Math.max(...spreads);
  const min = Math.min(...spreads);

  return (
    `${BOLD}Daily High-Low Range${R}\n` +
    `  Avg spread: $${avg.toFixed(2)}\n` +
    `  Max spread: $${max.toFixed(2)}\n` +
    `  Min spread: $${min.toFixed(2)}`
  );
}

export function calcVwap(data: StockData): string {
  const { bars, snapshot } = data;
  if (bars.length === 0) return `${RED}✗ No data${R}`;

  let tpvSum = 0;
  let volSum = 0;
  for (const bar of bars) {
    const tp = (bar.high + bar.low + bar.close) / 3;
    tpvSum += tp * bar.volume;
    volSum += bar.volume;
  }

  if (volSum === 0) return `${RED}✗ Total volume is zero${R}`;

  const vwap = tpvSum / volSum;
  const last = snapshot.lastPrice;
  const lines = [
    `${BOLD}14-Day VWAP${R}`,
    `  VWAP: $${vwap.toFixed(2)}`,
  ];

  if (last !== null) {
    lines.push(`  Last: $${last.toFixed(2)}`);
    const diff = last - vwap;
    const cc = diff >= 0 ? GREEN : RED;
    lines.push(`  Last vs VWAP: ${cc}${diff >= 0 ? '+' : ''}${diff.toFixed(2)} (${diff >= 0 ? '+' : ''}${(diff / vwap * 100).toFixed(2)}%)${R}`);
  }

  return lines.join('\n');
}

export function calcRsi(data: StockData): string {
  const { bars } = data;
  if (bars.length < 2) return `${RED}✗ Not enough data for RSI${R}`;

  const changes: number[] = [];
  for (let i = 1; i < bars.length; i++) {
    changes.push(bars[i].close - bars[i - 1].close);
  }

  const gains = changes.map(c => c > 0 ? c : 0);
  const losses = changes.map(c => c < 0 ? Math.abs(c) : 0);

  const avgGain = gains.reduce((a, b) => a + b, 0) / changes.length;
  const avgLoss = losses.reduce((a, b) => a + b, 0) / changes.length;

  const rs = avgLoss === 0 ? Infinity : avgGain / avgLoss;
  const rsi = avgLoss === 0 ? 100 : 100 - (100 / (1 + rs));

  let zone: string;
  let zoneColor: string;
  if (rsi >= 70) { zone = 'OVERBOUGHT'; zoneColor = RED; }
  else if (rsi <= 30) { zone = 'OVERSOLD'; zoneColor = GREEN; }
  else { zone = 'NEUTRAL'; zoneColor = YELLOW; }

  return (
    `${BOLD}RSI (${changes.length}-period Wilder)${R}\n` +
    `  RSI: ${BOLD}${rsi.toFixed(2)}${R}  ${zoneColor}[${zone}]${R}\n` +
    `  Avg gain: ${avgGain.toFixed(4)}  |  Avg loss: ${avgLoss.toFixed(4)}\n` +
    `  Overbought ≥ 70  |  Oversold ≤ 30`
  );
}

export function calcAverage(data: StockData): string {
  const { bars } = data;
  if (bars.length === 0) return `${RED}✗ No data${R}`;

  const n = bars.length;
  const avgOpen  = bars.reduce((a, b) => a + b.open,  0) / n;
  const avgHigh  = bars.reduce((a, b) => a + b.high,  0) / n;
  const avgLow   = bars.reduce((a, b) => a + b.low,   0) / n;
  const avgClose = bars.reduce((a, b) => a + b.close, 0) / n;

  return (
    `${BOLD}${n}-Bar Averages${R}\n` +
    `  Avg Open:  $${avgOpen.toFixed(2)}\n` +
    `  Avg High:  $${avgHigh.toFixed(2)}\n` +
    `  Avg Low:   $${avgLow.toFixed(2)}\n` +
    `  Avg Close: $${avgClose.toFixed(2)}`
  );
}

export function calcSupport(data: StockData): string {
  const { bars } = data;
  if (bars.length === 0) return `${RED}✗ No data${R}`;

  const sorted = [...bars].sort((a, b) => a.low - b.low);
  const s1 = sorted[0];
  const s2 = sorted.length >= 2 ? sorted[1] : sorted[0];
  const avgLow = bars.reduce((a, b) => a + b.low, 0) / bars.length;

  return (
    `${BOLD}Support Levels${R}\n` +
    `  S1 (lowest low):     ${GREEN}$${s1.low.toFixed(2)}${R}  on ${ts2date(s1.timestamp)}\n` +
    `  S2 (2nd lowest low): ${GREEN}$${s2.low.toFixed(2)}${R}  on ${ts2date(s2.timestamp)}\n` +
    `  Avg low (${bars.length} bars): $${avgLow.toFixed(2)}`
  );
}

export function calcResistance(data: StockData): string {
  const { bars } = data;
  if (bars.length === 0) return `${RED}✗ No data${R}`;

  const sorted = [...bars].sort((a, b) => b.high - a.high);
  const r1 = sorted[0];
  const r2 = sorted.length >= 2 ? sorted[1] : sorted[0];
  const avgHigh = bars.reduce((a, b) => a + b.high, 0) / bars.length;

  return (
    `${BOLD}Resistance Levels${R}\n` +
    `  R1 (highest high):     ${RED}$${r1.high.toFixed(2)}${R}  on ${ts2date(r1.timestamp)}\n` +
    `  R2 (2nd highest high): ${RED}$${r2.high.toFixed(2)}${R}  on ${ts2date(r2.timestamp)}\n` +
    `  Avg high (${bars.length} bars): $${avgHigh.toFixed(2)}`
  );
}

export function calcSummary(data: StockData): string {
  const { ticker, bars, snapshot } = data;
  if (bars.length === 0) return `${RED}✗ No data${R}`;

  const firstClose = bars[0].close;
  const lastClose = bars[bars.length - 1].close;
  const rangeHigh = Math.max(...bars.map(b => b.high));
  const rangeLow  = Math.min(...bars.map(b => b.low));
  const periodChange = (lastClose - firstClose) / firstClose * 100;

  const last = snapshot.lastPrice;
  const prev = snapshot.prevClose;
  const dayChange = last !== null && prev !== null ? (last - prev) / prev * 100 : null;
  const dayChgStr = dayChange !== null
    ? `${dayChange >= 0 ? GREEN : RED}${dayChange >= 0 ? '+' : ''}${dayChange.toFixed(2)}%${R}`
    : `${DIM}N/A${R}`;

  const pChgColor = periodChange >= 0 ? GREEN : RED;

  return (
    `${BOLD}${ticker} Summary${R}\n` +
    `  Last price:      $${(last ?? lastClose).toFixed(2)}\n` +
    `  Day change:      ${dayChgStr}\n` +
    `  14-day range:    $${rangeLow.toFixed(2)} – $${rangeHigh.toFixed(2)}\n` +
    `  14-day change:   ${pChgColor}${periodChange >= 0 ? '+' : ''}${periodChange.toFixed(2)}%${R}  ($${firstClose.toFixed(2)} → $${lastClose.toFixed(2)})`
  );
}

export const COMMANDS: Record<string, (data: StockData) => string> = {
  excursions:  calcExcursions,
  volatility:  calcVolatility,
  momentum:    calcMomentum,
  range:       calcRange,
  vwap:        calcVwap,
  rsi:         calcRsi,
  average:     calcAverage,
  support:     calcSupport,
  resistance:  calcResistance,
  summary:     calcSummary,
};
