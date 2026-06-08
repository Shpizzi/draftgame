import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { SeasonData } from '@/types';

export function loadSeason(year: number): SeasonData {
  const file = resolve(process.cwd(), `data/seasons/${year}.json`);
  return JSON.parse(readFileSync(file, 'utf8')) as SeasonData;
}
