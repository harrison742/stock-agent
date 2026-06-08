import * as dotenv from 'dotenv';
dotenv.config();

import express, { Request, Response } from 'express';
import * as path from 'path';
import { fetchStockData } from './stock';
import { calcExcursions, calcProjections } from './calculations';
import { initAgent, chat } from './agent';
import { Bar, Snapshot } from './types';

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

const PORT = Number(process.env.PORT) || 3000;

function stripAnsi(s: string): string {
  return s.replace(/\x1b\[[0-9;]*m/g, '');
}

app.post('/api/ticker', async (req: Request, res: Response): Promise<void> => {
  const { ticker } = req.body as { ticker?: string };
  if (!ticker || typeof ticker !== 'string') {
    res.status(400).json({ error: 'ticker is required' });
    return;
  }
  try {
    const data = await fetchStockData(ticker.toUpperCase().trim());
    initAgent(data);
    const excursionsTable = stripAnsi(calcExcursions(data));
    const projections = calcProjections(data);
    res.json({ ticker: data.ticker, bars: data.bars, snapshot: data.snapshot, excursionsTable, projections });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

app.post('/api/chat', async (req: Request, res: Response): Promise<void> => {
  const { message } = req.body as { message?: string; ticker?: string; bars?: Bar[]; snapshot?: Snapshot };
  if (!message || typeof message !== 'string') {
    res.status(400).json({ error: 'message is required' });
    return;
  }
  try {
    const reply = await chat(message);
    res.json({ reply });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
