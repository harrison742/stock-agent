import Anthropic from '@anthropic-ai/sdk';
import { StockData } from './types';

const MODEL = 'claude-sonnet-4-5';

// Initialized lazily so dotenv.config() in index.ts runs first
let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}

type MessageParam = Anthropic.MessageParam;

let history: MessageParam[] = [];
let systemPrompt = '';

function buildOhlcTable(data: StockData): string {
  const { bars } = data;
  let table = 'Date       Open    High    Low     Close   Volume\n';
  table += '─'.repeat(56) + '\n';
  for (const bar of bars) {
    const date = new Date(bar.timestamp).toLocaleDateString('en-US', {
      timeZone: 'America/New_York',
      month: '2-digit',
      day: '2-digit',
      year: '2-digit',
    });
    table +=
      `${date.padEnd(11)}` +
      `${bar.open.toFixed(2).padEnd(8)}` +
      `${bar.high.toFixed(2).padEnd(8)}` +
      `${bar.low.toFixed(2).padEnd(8)}` +
      `${bar.close.toFixed(2).padEnd(8)}` +
      `${bar.volume.toLocaleString()}\n`;
  }
  return table;
}

function buildSystemPrompt(data: StockData): string {
  const { ticker, snapshot } = data;
  const snap = [
    `Today Open: ${snapshot.todayOpen ?? 'N/A'}`,
    `Today High: ${snapshot.todayHigh ?? 'N/A'}`,
    `Today Low: ${snapshot.todayLow ?? 'N/A'}`,
    `Last Price: ${snapshot.lastPrice ?? 'N/A'}`,
    `Prev Close: ${snapshot.prevClose ?? 'N/A'}`,
  ].join(' | ');

  return (
    `You are a concise stock analysis assistant for ${ticker}. ` +
    `Answer questions about this stock using only the data provided below. ` +
    `Keep answers brief and focused.\n\n` +
    `## 21-Day OHLC Data\n\n` +
    `${buildOhlcTable(data)}\n` +
    `## Live Snapshot\n\n` +
    `${snap}\n\n` +
    `## Instructions\n\n` +
    `- Answer questions concisely\n` +
    `- Reference specific prices and dates from the data\n` +
    `- Note when data is unavailable rather than guessing`
  );
}

export function initAgent(data: StockData): void {
  systemPrompt = buildSystemPrompt(data);
  history = [];
}

export async function chat(message: string): Promise<string> {
  history.push({ role: 'user', content: message });

  const response = await getClient().messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: [
      {
        type: 'text',
        text: systemPrompt,
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: history,
  });

  const block = response.content[0];
  if (!block || block.type !== 'text') {
    throw new Error('Unexpected response type from Claude');
  }

  const text = block.text;
  history.push({ role: 'assistant', content: text });
  return text;
}
