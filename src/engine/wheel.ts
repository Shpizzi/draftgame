// Wheel / year selection. Uniform random within the unlocked era range.
// Architecture: eras are config-driven "era packs"; adding an era = data + a config
// entry, zero changes to game logic.

import type { Rng } from './rng';
import { ERA_PACKS, type EraPack } from '@/config/gameConstants';

/** All years available across unlocked era packs. */
export function unlockedYears(eras: EraPack[] = ERA_PACKS): number[] {
  const years: number[] = [];
  for (const era of eras) {
    if (!era.unlocked) continue;
    for (let y = era.startYear; y <= era.endYear; y++) years.push(y);
  }
  return years;
}

/** Spin the wheel: pick a uniformly random year from the unlocked range. */
export function spinWheel(rng: Rng, eras: EraPack[] = ERA_PACKS): number {
  const years = unlockedYears(eras);
  if (years.length === 0) throw new Error('No unlocked era years available');
  return years[rng.int(0, years.length - 1)];
}
