// Static data access. JSON is bundled at build time — the game never fetches at runtime.
// Swapping fake data for real data (Fase 1) means replacing these files only.

import type { SeasonData } from '@/types';
import s2020 from '../../data/seasons/2020.json';
import s2021 from '../../data/seasons/2021.json';
import s2022 from '../../data/seasons/2022.json';
import s2023 from '../../data/seasons/2023.json';
import s2024 from '../../data/seasons/2024.json';
import s2025 from '../../data/seasons/2025.json';
import s2026 from '../../data/seasons/2026.json';

const SEASONS: Record<number, SeasonData> = {
  2020: s2020 as SeasonData,
  2021: s2021 as SeasonData,
  2022: s2022 as SeasonData,
  2023: s2023 as SeasonData,
  2024: s2024 as SeasonData,
  2025: s2025 as SeasonData,
  2026: s2026 as SeasonData,
};

export function getSeason(year: number): SeasonData {
  const data = SEASONS[year];
  if (!data) throw new Error(`No season data for ${year}`);
  return data;
}
