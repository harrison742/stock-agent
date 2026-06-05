import * as readline from 'readline';
import * as dotenv from 'dotenv';
import { StockData } from './types';
import { fetchStockData, isMarketHours } from './stock';
import { COMMANDS, calcExcursions } from './calculations';
import { initAgent, chat } from './agent';
import {
  displayHeader,
  displayOHLC,
  displayResult,
  displayAgentReply,
  displayError,
  displayInfo,
  displayMarketClosed,
} from './display';

dotenv.config();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function prompt(question: string): Promise<string> {
  return new Promise(resolve => {
    rl.question(question, resolve);
    rl.once('close', () => resolve('exit'));
  });
}

async function loadTicker(ticker: string): Promise<StockData | null> {
  displayInfo(`fetching ${ticker}...`);
  try {
    return await fetchStockData(ticker);
  } catch (err) {
    displayError(err instanceof Error ? err.message : String(err));
    return null;
  }
}

async function main(): Promise<void> {
  let currentData: StockData | null = null;
  let agentReady = false;

  if (!process.env.POLYGON_API_KEY) {
    displayError('POLYGON_API_KEY not set — copy .env.example to .env and add your keys');
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    displayError('ANTHROPIC_API_KEY not set — freeform questions will not work');
  }

  console.log('\n  Stock Analysis Agent');
  console.log('  Enter a ticker (e.g. AAPL), a command (excursions, rsi, …), or a question.');
  console.log('  Type "exit" to quit.\n');

  while (true) {
    const raw = await prompt('> ').catch(() => 'exit');
    const input = raw.trim();
    if (!input) continue;

    if (input.toLowerCase() === 'exit' || input.toLowerCase() === 'quit') {
      rl.close();
      console.log('\n  Goodbye!');
      break;
    }

    // Ticker match
    if (/^[A-Z]{1,5}$/.test(input)) {
      const data = await loadTicker(input);
      if (data) {
        currentData = data;
        initAgent(data);
        agentReady = true;

        if (data.snapshot.todayOpen === null) {
          displayMarketClosed();
        } else if (!isMarketHours()) {
          displayMarketClosed();
        }

        displayHeader(data);
        displayOHLC(data);
        displayResult(calcExcursions(data));
      }
      continue;
    }

    // Refresh command (not in COMMANDS map)
    if (input.toLowerCase() === 'refresh') {
      if (!currentData) {
        displayError('No ticker loaded — enter a ticker first');
        continue;
      }
      const data = await loadTicker(currentData.ticker);
      if (data) {
        currentData = data;
        initAgent(data);
        agentReady = true;
        displayHeader(data);
        displayOHLC(data);
        displayResult(calcExcursions(data));
      }
      continue;
    }

    // One-word command
    const cmd = COMMANDS[input.toLowerCase()];
    if (cmd) {
      if (!currentData) {
        displayError('No ticker loaded — enter a ticker first');
        continue;
      }
      displayResult(cmd(currentData));
      continue;
    }

    // Claude agent
    if (!agentReady) {
      displayError('Enter a ticker first (e.g. AAPL) before asking questions');
      continue;
    }
    if (!process.env.ANTHROPIC_API_KEY) {
      displayError('ANTHROPIC_API_KEY not set — cannot use Claude');
      continue;
    }

    displayInfo('thinking…');
    try {
      const reply = await chat(input);
      displayAgentReply(reply);
    } catch (err) {
      displayError(err instanceof Error ? err.message : String(err));
    }
  }
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
