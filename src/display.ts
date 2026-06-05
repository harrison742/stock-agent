import { StockData } from './types';

const R = '\x1b[0m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const CYAN = '\x1b[36m';
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';

export function fmtDate(ts: number): string {
  return new Date(ts).toLocaleDateString('en-US', {
    timeZone: 'America/New_York',
    month: '2-digit',
    day: '2-digit',
    year: '2-digit',
  });
}

function fmtPrice(n: number | null): string {
  return n === null ? '--' : n.toFixed(2);
}

function fmtPct(n: number | null): string {
  if (n === null) return '--';
  return (n >= 0 ? '+' : '') + n.toFixed(2) + '%';
}

export function displayHeader(data: StockData): void {
  const { ticker, snapshot } = data;
  const last = snapshot.lastPrice;
  const prev = snapshot.prevClose;
  const changeAmt = last !== null && prev !== null ? last - prev : null;
  const changePct = last !== null && prev !== null ? (last - prev) / prev * 100 : null;
  const cc = changePct !== null && changePct >= 0 ? GREEN : RED;

  const ts = data.fetchedAt.toLocaleString('en-US', {
    timeZone: 'America/New_York',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }) + ' ET';

  console.log();
  console.log(
    `  ${BOLD}${CYAN}${ticker}${R}` +
    `  ${BOLD}${fmtPrice(last)}${R}` +
    `  ${cc}${fmtPct(changePct)}` +
    (changeAmt !== null ? ` (${changeAmt >= 0 ? '+' : ''}${changeAmt.toFixed(2)})` : '') +
    `${R}  ${DIM}${ts}${R}`
  );
  console.log();
}

export function displayOHLC(data: StockData): void {
  const { bars } = data;

  console.log(`  ${DIM}${'Date'.padEnd(11)}${'Open'.padEnd(9)}${'High'.padEnd(9)}${'Low'.padEnd(9)}${'Close'.padEnd(9)}Chg%${R}`);
  console.log(`  ${DIM}${'─'.repeat(52)}${R}`);

  for (let i = 0; i < bars.length; i++) {
    const b = bars[i];
    const prevClose = i > 0 ? bars[i - 1].close : null;
    const pct = prevClose !== null ? (b.close - prevClose) / prevClose * 100 : null;
    const cc = pct !== null ? (pct >= 0 ? GREEN : RED) : DIM;
    const pctPlain = pct !== null ? (pct >= 0 ? '+' : '') + pct.toFixed(2) + '%' : '--';
    const pctStr = pct !== null ? `${cc}${pctPlain}${R}` : `${DIM}${pctPlain}${R}`;

    console.log(
      `  ${fmtDate(b.timestamp).padEnd(11)}` +
      `${b.open.toFixed(2).padEnd(9)}` +
      `${b.high.toFixed(2).padEnd(9)}` +
      `${b.low.toFixed(2).padEnd(9)}` +
      `${b.close.toFixed(2).padEnd(9)}` +
      pctStr
    );
  }
  console.log();
}

export function displayResult(text: string): void {
  console.log();
  text.split('\n').forEach(line => console.log(`  ${line}`));
  console.log();
}

export function displayAgentReply(text: string): void {
  console.log();
  const lines = text.split('\n');
  const prefix = `  ${BOLD}◆${R}  `;
  const indent = '     ';
  lines.forEach((line, i) => {
    console.log(i === 0 ? `${prefix}${line}` : `${indent}${line}`);
  });
  console.log();
}

export function displayError(msg: string): void {
  console.log(`  ${RED}✗ ${msg}${R}`);
}

export function displayInfo(msg: string): void {
  console.log(`  ${DIM}${msg}${R}`);
}

export function displayMarketClosed(): void {
  console.log(`  ${DIM}market closed — prev data shown${R}`);
}
